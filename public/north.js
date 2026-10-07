const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const state={chat:JSON.parse(localStorage.getItem('fai_chat')||'[]'),tasks:JSON.parse(localStorage.getItem('fai_tasks')||'[]'),memory:JSON.parse(localStorage.getItem('fai_memory')||'[]'),tts:JSON.parse(localStorage.getItem('fai_tts')??'true')};
const save=()=>{localStorage.setItem('fai_chat',JSON.stringify(state.chat.slice(-40)));localStorage.setItem('fai_tasks',JSON.stringify(state.tasks));localStorage.setItem('fai_memory',JSON.stringify(state.memory.slice(-100)));localStorage.setItem('fai_tts',JSON.stringify(state.tts))};
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const toast=t=>{const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};
$('#today').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
(async()=>{try{const r=await fetch('/api/status');const d=await r.json();$('#aiStatus').textContent=d.aiConnected?'AI ONLINE':'AI';}catch{}})();
const panel=$('#panel'),body=$('#panelBody'),title=$('#panelTitle');
let voiceUnlocked=false;
let handsFree=false;
let listeningNow=false;
let activeRecognition=null;
function unlockVoice(){
  if(!('speechSynthesis' in window))return false;
  try{speechSynthesis.resume();voiceUnlocked=true;return true}catch{return false}
}
document.addEventListener('pointerdown',()=>unlockVoice(),{once:true,passive:true});
function openPanel(name){title.textContent=name;panel.showModal()}$('#panelClose').onclick=()=>{handsFree=false;if(activeRecognition){try{activeRecognition.abort()}catch{}}panel.close()};panel.addEventListener('click',e=>{if(e.target===panel){handsFree=false;if(activeRecognition){try{activeRecognition.abort()}catch{}}panel.close()}});
function getRussianVoice(){
  if(!('speechSynthesis' in window))return null;
  const voices=speechSynthesis.getVoices()||[];
  return voices.find(v=>/^ru(-|_)/i.test(v.lang)&&/female|alena|alyona|milena|irina|svetlana|anna|maria|victoria/i.test(v.name))
    ||voices.find(v=>/^ru(-|_)/i.test(v.lang))
    ||voices[0]
    ||null;
}
function speak(text){
  if(!state.tts||!text)return false;
  if(!('speechSynthesis' in window)){toast('На этом браузере озвучивание недоступно');return false;}
  const clean=String(text).replace(/[*#_~`>]/g,' ').replace(/\s+/g,' ').trim();
  if(!clean)return;
  try{
    speechSynthesis.cancel();
    speechSynthesis.resume();
    const u=new SpeechSynthesisUtterance(clean);
    u.lang='ru-RU';
    u.rate=0.98;
    u.pitch=1.02;
    const voice=getRussianVoice();
    if(voice)u.voice=voice;
    u.onend=()=>{if(handsFree&&panel?.open)setTimeout(()=>autoListen(),350)};
    u.onerror=()=>{if(handsFree&&panel?.open)setTimeout(()=>autoListen(),600)};
    speechSynthesis.speak(u);
    return true;
  }catch{toast('Не удалось включить голос');return false}
}
if('speechSynthesis' in window){
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices();
}
function renderChat(){
  body.innerHTML='<div class="conversation-mode '+(handsFree?'on':'')+'"><span>'+(handsFree?'Живой диалог включён':'Нажми микрофон один раз — дальше отвечай голосом без лишних нажатий')+'</span></div><div class="chatlog">'+
    (state.chat.length?state.chat.map(m=>'<div class="msg '+m.role+'"><div class="msg-text">'+esc(m.text)+'</div></div>').join(''):'<div class="msg ai"><div class="msg-text">Я готов. Говори или пиши — отвечу по делу и продолжу разговор с учётом контекста.</div></div>')+
    '</div>'+
    '<form class="chat-composer" id="chatComposer">'+
      '<button type="button" class="chat-mic" id="chatMic" aria-label="Ответить голосом">🎙</button>'+
      '<input id="chatInput" autocomplete="off" placeholder="Ответить FARRUKH AI…" aria-label="Ответить FARRUKH AI">'+
      '<button class="chat-send" type="submit" aria-label="Отправить">↑</button>'+
    '</form>';
  const form=$('#chatComposer'),input=$('#chatInput'),mic=$('#chatMic');
  if(form)form.onsubmit=e=>{e.preventDefault();const v=input.value.trim();if(!v)return;input.value='';askAI(v)};
  if(mic)mic.onclick=()=>{handsFree=true;renderChat();setTimeout(()=>listenFromChat($('#chatMic'),$('#chatInput')),0)};
  requestAnimationFrame(()=>{body.scrollTop=body.scrollHeight})
}
function addMemory(note){
  note=String(note||'').trim().replace(/^[:\-–—\s]+/,'');
  if(!note)return false;
  const exists=state.memory.some(x=>String(x.text||'').toLowerCase()===note.toLowerCase());
  if(!exists)state.memory.push({text:note,createdAt:new Date().toISOString()});
  save();return true;
}
function memoryText(){return state.memory.map(x=>x.text).filter(Boolean)}
function renderMemory(){
  openPanel('Память');
  body.innerHTML='<div class="memory-head"><button class="add-task" id="addMemory">+ Добавить факт</button><span>'+state.memory.length+' сохранено</span></div><div id="memoryList"></div>';
  const list=$('#memoryList');
  const draw=()=>{list.innerHTML=state.memory.length?state.memory.slice().reverse().map((m,ri)=>{const i=state.memory.length-1-ri;return '<div class="memory-row"><span>'+esc(m.text)+'</span><button data-memory-del="'+i+'">×</button></div>'}).join(''):'<p style="color:#a9a197">Память пока пустая. Скажи: «Запомни, что …»</p>'};
  draw();
  $('#addMemory').onclick=()=>{const v=prompt('Что запомнить?');if(v&&addMemory(v)){draw();toast('Запомнил')}};
  list.onclick=e=>{if(e.target.dataset.memoryDel!==undefined){state.memory.splice(+e.target.dataset.memoryDel,1);save();draw()}};
}
async function askAI(text){text=String(text||'').trim();if(!text)return;
  const remember=text.match(/^\s*запомни(?:\s*,?\s*что)?\s+(.+)$/i);
  if(remember){
    const note=remember[1].trim();
    addMemory(note);
    state.chat.push({role:'user',text},{role:'ai',text:'Запомнил: '+note});
    save();openPanel('Спросить AI');renderChat();speak('Запомнил');return;
  }
  if(/^\s*(что ты помнишь|покажи память|моя память)\s*\??$/i.test(text)){
    state.chat.push({role:'user',text});
    const reply=state.memory.length?'Я помню:\n'+state.memory.map((x,i)=>(i+1)+'. '+x.text).join('\n'):'Пока в моей памяти нет сохранённых фактов.';
    state.chat.push({role:'ai',text:reply});save();openPanel('Спросить AI');renderChat();speak(reply);return;
  }
  state.chat.push({role:'user',text});save();openPanel('Спросить AI');renderChat();const log=body.querySelector('.chatlog');const tmp=document.createElement('div');tmp.className='msg ai thinking';tmp.textContent='Думаю…';log.appendChild(tmp);body.scrollTop=body.scrollHeight;try{const history=state.chat.slice(-10,-1).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text}));const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history,useWeb:false,context:{memory:memoryText(),tasks:state.tasks}})});const d=await r.json();if(!r.ok)throw Error(d.error||'Ошибка');const reply=d.reply||'Ответ не получен';state.chat.push({role:'ai',text:reply});save();renderChat();speak(reply)}catch(e){tmp.textContent='Не удалось получить ответ. Попробуй ещё раз.'}}
$('#askForm').onsubmit=e=>{e.preventDefault();const v=$('#askInput').value;$('#askInput').value='';askAI(v)};$$('[data-prompt]').forEach(b=>b.onclick=()=>askAI(b.dataset.prompt));
function renderTasks(){openPanel('Задачи');body.innerHTML='<button class="add-task" id="newTask">+ Новая задача</button><div id="taskList"></div>';const list=$('#taskList');const draw=()=>{list.innerHTML=state.tasks.length?state.tasks.map((t,i)=>'<label class="task-row"><span><input type="checkbox" data-i="'+i+'" '+(t.done?'checked':'')+'> '+esc(t.text)+'</span><button data-del="'+i+'">×</button></label>').join(''):'<p style="color:#a9a197">Список пуст. Добавь первую задачу.</p>'};draw();$('#newTask').onclick=()=>{const t=prompt('Новая задача:');if(t&&t.trim()){state.tasks.unshift({text:t.trim(),done:false});save();draw()}};list.onchange=e=>{if(e.target.dataset.i!==undefined){state.tasks[+e.target.dataset.i].done=e.target.checked;save()}};list.onclick=e=>{if(e.target.dataset.del!==undefined){state.tasks.splice(+e.target.dataset.del,1);save();draw()}}}
async function renderAnalytics(){openPanel('Аналитика');body.innerHTML='<p class="thinking">Загружаю данные…</p>';try{const r=await fetch('/api/analytics/snapshot');const d=await r.json();body.innerHTML='<div class="metric-row"><span>Источник</span><b>'+esc(d.source||'—')+'</b></div><div class="metric-row"><span>Всего единиц</span><b>'+esc(d.totalUnits??'—')+'</b></div>'+(d.branches||[]).map(x=>'<div class="metric-row"><span>'+esc(x.name)+'</span><b>'+esc(x.units)+' ед.</b></div>').join('')+'<p style="color:#c4b59d;line-height:1.55">'+esc(d.summary||'')+'</p>'}catch{body.innerHTML='<p>Данные аналитики сейчас недоступны.</p>'}}
function renderTools(){openPanel('Инструменты');body.innerHTML='<div class="tool-row"><span>Интернет-поиск</span><b>Выключен</b></div><div class="tool-row"><span>Голосовой ввод и ответы</span><b>Включены</b></div><div class="tool-row"><span>Память</span><button id="openMemory">'+state.memory.length+' фактов</button></div><div class="tool-row"><span>Frontpad / аналитика</span><b>Подключение</b></div><div class="tool-row"><span>Калькуляторы и ТТК</span><button id="askTool">Спросить AI</button></div>';$('#openMemory').onclick=renderMemory;$('#askTool').onclick=()=>{panel.close();$('#askInput').value='Помоги рассчитать себестоимость или техкарту блюда: ';$('#askInput').focus()}}
$$('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='chat'){openPanel('Спросить AI');renderChat()}if(a==='tasks')renderTasks();if(a==='analytics')renderAnalytics();if(a==='tools')renderTools()});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function runRecognition(button,onText){
  if(!SR){toast('Открой в Chrome на Android для голосового ввода');return}
  if(listeningNow)return;
  const r=new SR();
  activeRecognition=r;
  listeningNow=true;
  r.lang='ru-RU';r.interimResults=false;r.continuous=false;
  button?.classList.add('listening');
  if(button)button.setAttribute('aria-label','Слушаю');
  r.onresult=e=>{const t=(e.results?.[0]?.[0]?.transcript||'').trim();if(t)onText(t)};
  r.onend=()=>{listeningNow=false;activeRecognition=null;button?.classList.remove('listening');if(button)button.setAttribute('aria-label','Ответить голосом')};
  r.onerror=e=>{listeningNow=false;activeRecognition=null;if(e?.error!=='no-speech')toast('Не удалось распознать речь');button?.classList.remove('listening');if(button)button.setAttribute('aria-label','Ответить голосом')};
  try{r.start()}catch{toast('Микрофон уже используется')}
}
function listenFromChat(button,input){
  unlockVoice();
  runRecognition(button,t=>{if(input)input.value=t;askAI(t)});
}
function autoListen(){
  if(!handsFree||!panel?.open||listeningNow)return;
  const mic=$('#chatMic'),input=$('#chatInput');
  if(!mic||!input)return;
  if('speechSynthesis' in window&&speechSynthesis.speaking)return;
  listenFromChat(mic,input);
}
$('#micBtn').onclick=()=>{handsFree=true;runRecognition($('#micBtn'),t=>{$('#askInput').value=t;askAI(t)})};
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
const panelVoice=$('#panelVoice');
function syncPanelVoice(){if(panelVoice)panelVoice.textContent=state.tts?'🔊':'🔇'}
if(panelVoice){syncPanelVoice();panelVoice.onclick=()=>{unlockVoice();state.tts=!state.tts;save();syncPanelVoice();if(panel.open)renderChat();toast(state.tts?'Голос включён':'Голос выключен')}}
