const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const state={chat:JSON.parse(localStorage.getItem('fai_chat')||'[]'),tasks:JSON.parse(localStorage.getItem('fai_tasks')||'[]'),memory:JSON.parse(localStorage.getItem('fai_memory')||'[]'),tts:JSON.parse(localStorage.getItem('fai_tts')??'true')};
let stateUpdatedAt=localStorage.getItem('fai_state_updated_at')||new Date(0).toISOString();
let syncTimer=null,syncBusy=false,bootstrapping=true;
function save(skipSync=false){
  localStorage.setItem('fai_chat',JSON.stringify(state.chat.slice(-40)));
  localStorage.setItem('fai_tasks',JSON.stringify(state.tasks));
  localStorage.setItem('fai_memory',JSON.stringify(state.memory.slice(-100)));
  localStorage.setItem('fai_tts',JSON.stringify(state.tts));
  if(!skipSync){
    stateUpdatedAt=new Date().toISOString();
    localStorage.setItem('fai_state_updated_at',stateUpdatedAt);
    if(!bootstrapping)scheduleStateSync();
  }
}
function statePayload(){return {tasks:state.tasks,memory:state.memory,chat:state.chat.slice(-40),tts:state.tts,updatedAt:stateUpdatedAt}}
function scheduleStateSync(){clearTimeout(syncTimer);syncTimer=setTimeout(syncStateNow,700)}
async function syncStateNow(){
  if(syncBusy)return;
  syncBusy=true;
  try{
    const r=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(statePayload()),signal:AbortSignal.timeout(12000)});
    const d=await r.json();
    if(r.ok&&d?.state?.updatedAt){stateUpdatedAt=d.state.updatedAt;localStorage.setItem('fai_state_updated_at',stateUpdatedAt)}
  }catch{}
  finally{syncBusy=false}
}
async function bootstrapState(){
  try{
    const r=await fetch('/api/state',{signal:AbortSignal.timeout(12000)});
    const d=await r.json();
    const remote=d?.state;
    if(r.ok&&remote){
      const rt=Date.parse(remote.updatedAt||0)||0,lt=Date.parse(stateUpdatedAt||0)||0;
      const remoteHasData=(remote.tasks?.length||remote.memory?.length||remote.chat?.length);
      const localHasData=(state.tasks.length||state.memory.length||state.chat.length);
      if(remoteHasData&&rt>=lt){
        state.tasks=Array.isArray(remote.tasks)?remote.tasks:[];
        state.memory=Array.isArray(remote.memory)?remote.memory:[];
        state.chat=Array.isArray(remote.chat)?remote.chat:[];
        state.tts=remote.tts!==false;
        stateUpdatedAt=remote.updatedAt||new Date().toISOString();
        localStorage.setItem('fai_state_updated_at',stateUpdatedAt);
        save(true);
      }else if(localHasData){
        await syncStateNow();
      }
      const storage=remote.storage==='yandex'?'облако':'сервер';
      toast('Синхронизация: '+storage);
    }
  }catch{toast('Работаю локально — синхронизация восстановится позже')}
  finally{bootstrapping=false;renderCurrentIfOpen()}
}
function renderCurrentIfOpen(){if(!panel?.open)return;const name=title.textContent;if(name==='Спросить AI')renderChat();else if(name==='Задачи')renderTasks();else if(name==='Память')renderMemory()}
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const toast=t=>{const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};
$('#today').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
(async()=>{try{const r=await fetch('/api/status');const d=await r.json();$('#aiStatus').textContent=d.aiConnected?'AI ONLINE':'AI';}catch{}})();
const panel=$('#panel'),body=$('#panelBody'),title=$('#panelTitle');
let chatBusy=false;
let analyticsContext=null;
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
function taskDateLabel(iso){
  if(!iso)return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return '';
  const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
  const day=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const time=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  if(day.getTime()===today.getTime())return 'Сегодня · '+time;
  if(day.getTime()===tomorrow.getTime())return 'Завтра · '+time;
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' · '+time;
}
function parseTaskCommand(raw){
  const original=String(raw||'').trim();
  if(!original)return null;
  const lower=original.toLowerCase();
  if(!/^(добавь|добавить|создай|создать|напомни|запиши|поставь|сделай задач)/i.test(lower))return null;
  let text=original
    .replace(/^\s*(добавь|добавить|создай|создать|напомни|запиши|поставь|сделай)\s*/i,'')
    .replace(/^задач[уа]\s*/i,'')
    .trim();

  const now=new Date();
  let due=null;
  let target=new Date(now);
  const hasTomorrow=/\bзавтра\b/i.test(text);
  const hasToday=/\bсегодня\b/i.test(text);
  if(hasTomorrow){target.setDate(target.getDate()+1);text=text.replace(/\bна\s+завтра\b|\bзавтра\b/ig,' ').trim();}
  else if(hasToday){text=text.replace(/\bна\s+сегодня\b|\bсегодня\b/ig,' ').trim();}

  let hour=null,minute=0;
  const hm=text.match(/(?:в|к)\s*(\d{1,2})(?::(\d{2}))?/i);
  if(hm){hour=Math.min(23,Math.max(0,+hm[1]));minute=hm[2]?Math.min(59,+hm[2]):0;text=text.replace(hm[0],' ').trim();}
  else if(/\bутром\b/i.test(text)){hour=9;text=text.replace(/\bутром\b/ig,' ').trim();}
  else if(/\bдн[её]м\b/i.test(text)){hour=14;text=text.replace(/\bдн[её]м\b/ig,' ').trim();}
  else if(/\bвечером\b/i.test(text)){hour=19;text=text.replace(/\bвечером\b/ig,' ').trim();}

  if(hasTomorrow||hasToday||hour!==null){
    if(hour===null)hour=hasTomorrow?9:Math.min(23,now.getHours()+1);
    target.setHours(hour,minute,0,0);
    due=target.toISOString();
  }

  const priority=/\b(важно|важная|срочно|приоритет)\b/i.test(text)?'high':'normal';
  text=text.replace(/\b(важно|важная|срочно|приоритет)\b/ig,' ').replace(/\s+/g,' ').replace(/^[,.:;\-–—\s]+|[,.:;\-–—\s]+$/g,'').trim();
  if(!text)return null;
  return {text,due,priority,done:false,createdAt:new Date().toISOString()};
}
function addTaskFromCommand(raw){
  const task=parseTaskCommand(raw);
  if(!task)return null;
  state.tasks.unshift(task);save();return task;
}
function todayTasksText(){
  const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const rows=state.tasks.filter(t=>!t.done).filter(t=>{
    if(!t.due)return true;
    const d=new Date(t.due);return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()&&d.getDate()===today.getDate();
  });
  if(!rows.length)return 'На сегодня активных задач нет.';
  const important=rows.filter(t=>t.priority==='high');
  const normal=rows.filter(t=>t.priority!=='high');
  const format=t=>'• '+t.text+(t.due?' — '+taskDateLabel(t.due):'');
  return [important.length?'Важное:\n'+important.map(format).join('\n'):'',normal.length?'Остальное:\n'+normal.map(format).join('\n'):''].filter(Boolean).join('\n\n');
}
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
  const task=addTaskFromCommand(text);
  if(task){
    const reply='Добавил задачу: '+task.text+(task.due?' — '+taskDateLabel(task.due):'')+(task.priority==='high'?' · важная':'');
    state.chat.push({role:'user',text},{role:'ai',text:reply});save();openPanel('Спросить AI');renderChat();speak(reply);return;
  }
  if(/^(что у меня сегодня|что сегодня важного|задачи на сегодня|что мне сегодня сделать)/i.test(text)){
    const reply=todayTasksText();
    state.chat.push({role:'user',text},{role:'ai',text:reply});save();openPanel('Спросить AI');renderChat();speak(reply);return;
  }
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
  if(chatBusy){toast('Подожди ответ AI');return}
  chatBusy=true;
  state.chat.push({role:'user',text});save();openPanel('Спросить AI');renderChat();
  const log=body.querySelector('.chatlog');const tmp=document.createElement('div');tmp.className='msg ai thinking';tmp.textContent='Думаю…';log.appendChild(tmp);body.scrollTop=body.scrollHeight;
  try{
    const history=state.chat.slice(-10,-1).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text}));
    let d=null,lastErr=null;
    for(let attempt=1;attempt<=2;attempt++){
      try{
        const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history,useWeb:false,context:{memory:memoryText(),tasks:state.tasks,frontpad:analyticsContext}}),signal:AbortSignal.timeout(45000)});
        d=await r.json();
        if(!r.ok)throw Error(d.error||'Ошибка');
        break;
      }catch(err){lastErr=err;if(attempt<2)await new Promise(r=>setTimeout(r,650));}
    }
    if(!d)throw lastErr||Error('AI unavailable');
    const reply=d.reply||'Ответ не получен';
    state.chat.push({role:'ai',text:reply});save();renderChat();
    $('#aiStatus').textContent=d.degraded?'AI RESERVE':'AI ONLINE';
    if(d.notice)toast(d.notice);
    speak(reply);
  }catch(e){
    state.chat.push({role:'ai',text:'Связь с AI временно пропала. Твой запрос сохранён — попробуй ещё раз.'});save();renderChat();$('#aiStatus').textContent='AI OFFLINE';
  }finally{chatBusy=false}}
$('#askForm').onsubmit=e=>{e.preventDefault();const v=$('#askInput').value;$('#askInput').value='';askAI(v)};$$('[data-prompt]').forEach(b=>b.onclick=()=>askAI(b.dataset.prompt));
function taskGroup(t){
  if(t.done)return 'done';
  if(!t.due)return 'all';
  const d=new Date(t.due),now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
  const day=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  if(d.getTime()<now.getTime())return 'overdue';
  if(day.getTime()===today.getTime())return 'today';
  if(day.getTime()===tomorrow.getTime())return 'tomorrow';
  return 'later';
}
let taskFilter='today';
function renderTasks(){
  openPanel('Задачи');
  body.innerHTML='<div class="task-toolbar"><button id="notifyTasks" class="task-remind">🔔 Напоминания</button><button class="add-task" id="newTask">+ Новая задача</button></div>'+
    '<div class="task-filters">'+['today','tomorrow','overdue','all','done'].map(k=>'<button data-filter="'+k+'" class="'+(taskFilter===k?'active':'')+'">'+({today:'Сегодня',tomorrow:'Завтра',overdue:'Просрочено',all:'Все',done:'Готово'}[k])+'</button>').join('')+'</div>'+
    '<div id="taskList"></div>';
  const list=$('#taskList');
  const draw=()=>{
    body.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===taskFilter));
    const rows=state.tasks.filter(t=>taskFilter==='all'?!t.done:taskGroup(t)===taskFilter);
    list.innerHTML=rows.length?rows.map(t=>{const i=state.tasks.indexOf(t);const grp=taskGroup(t);return '<div class="task-row '+(t.done?'done ':'')+(grp==='overdue'?'overdue':'')+'"><label><input type="checkbox" data-i="'+i+'" '+(t.done?'checked':'')+'><span class="task-copy"><b>'+esc(t.text)+'</b><small>'+(t.priority==='high'?'ВАЖНАЯ · ':'')+(t.due?esc(taskDateLabel(t.due)):'Без срока')+'</small></span></label><div class="task-actions"><button data-edit="'+i+'" aria-label="Изменить">✎</button><button data-del="'+i+'" aria-label="Удалить">×</button></div></div>'}).join(''):'<p class="empty-state">Здесь пока ничего нет.</p>';
  };
  draw();
  body.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{taskFilter=b.dataset.filter;draw()});
  $('#notifyTasks').onclick=requestTaskNotifications;
  $('#newTask').onclick=()=>{
    const t=prompt('Новая задача:');
    if(t&&t.trim()){state.tasks.unshift({text:t.trim(),done:false,priority:'normal',due:null,createdAt:new Date().toISOString(),notifiedAt:null});save();draw()}
  };
  list.onchange=e=>{if(e.target.dataset.i!==undefined){state.tasks[+e.target.dataset.i].done=e.target.checked;save();draw()}};
  list.onclick=e=>{
    if(e.target.dataset.del!==undefined){state.tasks.splice(+e.target.dataset.del,1);save();draw();return}
    if(e.target.dataset.edit!==undefined){
      const i=+e.target.dataset.edit,t=state.tasks[i];
      const name=prompt('Задача:',t.text);if(name===null)return;
      const when=prompt('Срок: сегодня 18:00 / завтра 10:00 / без срока',t.due?taskDateLabel(t.due):'');
      t.text=name.trim()||t.text;
      if(when!==null)t.due=parseDueText(when,t.due);
      const pr=confirm('Сделать задачу важной?');t.priority=pr?'high':'normal';t.notifiedAt=null;save();draw();
    }
  };
}
function parseDueText(input,fallback=null){
  const s=String(input||'').trim().toLowerCase();
  if(!s||s==='без срока'||s==='нет')return null;
  const now=new Date(),d=new Date(now);
  if(s.includes('завтра'))d.setDate(d.getDate()+1);
  const hm=s.match(/(\d{1,2})(?::(\d{2}))?/);
  const h=hm?Math.min(23,+hm[1]):9,m=hm&&hm[2]?Math.min(59,+hm[2]):0;
  d.setHours(h,m,0,0);return d.toISOString();
}
async function requestTaskNotifications(){
  if(!('Notification' in window)){toast('Уведомления не поддерживаются этим браузером');return}
  const p=await Notification.requestPermission();
  toast(p==='granted'?'Напоминания включены':'Разрешение на уведомления не выдано');
  if(p==='granted')notifyDueTasks();
}
async function sendTaskNotification(t){
  const title='FARRUKH AI · задача';
  const options={body:t.text,tag:'task-'+(t.createdAt||t.text),renotify:false,icon:'/icon-192.svg'};
  try{
    const reg=await navigator.serviceWorker?.ready;
    if(reg?.showNotification)await reg.showNotification(title,options);
    else new Notification(title,options);
  }catch{try{new Notification(title,options)}catch{}}
}
function notifyDueTasks(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const now=Date.now();
  state.tasks.forEach(t=>{
    if(t.done||!t.due||t.notifiedAt)return;
    const due=Date.parse(t.due);
    if(Number.isFinite(due)&&due<=now&&due>now-12*60*60*1000){t.notifiedAt=new Date().toISOString();sendTaskNotification(t)}
  });
  save();
}
setInterval(notifyDueTasks,30000);

function money(v){
  const n=Number(v);if(!Number.isFinite(n))return String(v??'—');
  return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+' ₽';
}
function num(v){
  const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n):String(v??'—');
}
function metricValue(label,value){
  return /выруч|сумм|оборот|прибыл|себестоим|закуп|чек/i.test(label)?money(value):num(value);
}
function parseLiveReports(data){
  const metrics=[];const seen=new Set();
  const wanted=[
    ['Выручка',/выручк|оборот|сумма продаж/i],
    ['Заказы',/заказ/i],
    ['Средний чек',/средн.*чек/i],
    ['Прибыль',/прибыл/i],
    ['Себестоимость',/себестоим/i]
  ];
  const toNumber=v=>{const s=String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,'').replace(',','.').replace(/[^\d.-]/g,'');const n=Number(s);return Number.isFinite(n)?n:null};
  for(const report of data?.reports||[]){
    for(const table of report.tables||[]){
      const rows=Array.isArray(table)?table:[];
      for(const row of rows){
        const text=(row||[]).join(' ');
        for(const [label,re] of wanted){
          if(seen.has(label)||!re.test(text))continue;
          const vals=(row||[]).map(toNumber).filter(v=>v!==null);
          if(vals.length){metrics.push({label,value:vals[vals.length-1],source:report.title||report.sourceTitle||'Frontpad'});seen.add(label)}
        }
      }
    }
  }
  return metrics;
}
function uploadMetrics(data){
  const out=[];const seen=new Set();
  for(const sheet of data?.sheets||[]){
    for(const m of sheet.metrics||[]){
      if(seen.has(m.label))continue;
      seen.add(m.label);out.push({...m,source:sheet.name||'Файл Frontpad'});
    }
  }
  return out;
}
function analyticsHtml(snapshot,status,live,uploaded){
  const liveMetrics=parseLiveReports(live),fileMetrics=uploadMetrics(uploaded);
  const metrics=liveMetrics.length?liveMetrics:fileMetrics;
  const liveOk=Boolean(live?.ok&&live?.authenticated);
  const sourceMode=liveOk?'LIVE FRONTPAD':uploaded?.ok?'ФАЙЛ FRONTPAD':'РУЧНОЙ СНИМОК';
  const updated=liveOk?live.updatedAt:uploaded?.uploadedAt||snapshot?.capturedAt||null;
  const freshness=updated?new Date(updated).toLocaleString('ru-RU'):(snapshot?.date||'дата снимка неизвестна');
  analyticsContext={
    source:sourceMode,
    updatedAt:updated||snapshot?.date||null,
    metrics,
    branches:snapshot?.branches||[],
    totalUnits:snapshot?.totalUnits??null,
    summary:snapshot?.summary||'',
    live:liveOk,
    periodComplete:snapshot?.periodComplete??false
  };
  const cards=(metrics.length?metrics.slice(0,5):[
    {label:'Продано единиц',value:snapshot?.totalUnits??'—'},
    {label:'Точек',value:(snapshot?.branches||[]).length}
  ]).map(m=>'<div class="analytics-card"><span>'+esc(m.label)+'</span><b>'+esc(metricValue(m.label,m.value))+'</b><small>'+esc(m.source||sourceMode)+'</small></div>').join('');
  const branches=(snapshot?.branches||[]).slice().sort((a,b)=>(b.units||0)-(a.units||0)).map((b,i)=>'<div class="branch-row"><div><span class="rank">'+(i+1)+'</span><div><b>'+esc(b.name)+'</b><small>'+esc(b.strongCategory||'')+(b.topItem?' · '+esc(b.topItem):'')+'</small></div></div><strong>'+esc(b.units)+' ед.</strong></div>').join('');
  const warning=liveOk?'Данные получены из активной сессии Frontpad. Проверяй период отчёта перед управленческими выводами.':uploaded?.ok?'Показатели рассчитаны из загруженной выгрузки Frontpad.':'Сейчас показан старый ручной снимок. Для актуальной выручки и заказов подключи Frontpad или загрузи выгрузку.';
  return '<div class="analytics-top"><div><span class="analytics-status '+(liveOk?'live':'manual')+'">'+sourceMode+'</span><h3>Аналитика бизнеса</h3><p>Обновлено: '+esc(freshness)+'</p></div><button id="refreshAnalytics" class="analytics-refresh">↻</button></div>'+
    '<div class="analytics-grid">'+cards+'</div>'+
    '<div class="analytics-note">'+esc(warning)+'</div>'+
    (branches?'<div class="analytics-section"><h4>Точки</h4>'+branches+'</div>':'')+
    '<div class="analytics-actions">'+
      (status?.configured&&!status?.authenticated?'<button id="connectFrontpad">Подключить Frontpad</button>':'')+
      '<label class="upload-analytics">Загрузить XLS/CSV<input id="frontpadFile" type="file" accept=".xls,.xlsx,.csv" hidden></label>'+
      '<button id="askAnalytics">Спросить AI по цифрам</button>'+
    '</div><div id="frontpadAuthBox"></div>';
}
async function loadAnalyticsData(){
  const [snapR,statusR]=await Promise.allSettled([fetch('/api/analytics/snapshot'),fetch('/api/frontpad/status')]);
  const snapshot=snapR.status==='fulfilled'?await snapR.value.json():{};
  const status=statusR.status==='fulfilled'?await statusR.value.json():{};
  let live=null;
  if(status?.authenticated){
    try{const r=await fetch('/api/frontpad/reports',{signal:AbortSignal.timeout(30000)});live=await r.json()}catch{}
  }
  return {snapshot,status,live};
}
async function renderAnalytics(uploaded=null){
  openPanel('Аналитика');
  body.innerHTML='<div class="analytics-loading">Загружаю аналитику Frontpad…</div>';
  try{
    const {snapshot,status,live}=await loadAnalyticsData();
    body.innerHTML=analyticsHtml(snapshot,status,live,uploaded);
    $('#refreshAnalytics').onclick=()=>renderAnalytics(uploaded);
    const connect=$('#connectFrontpad');if(connect)connect.onclick=()=>startFrontpadAuth(snapshot,status,uploaded);
    const file=$('#frontpadFile');if(file)file.onchange=async()=>{if(!file.files?.[0])return;await uploadFrontpadFile(file.files[0])};
    $('#askAnalytics').onclick=()=>askAI('Проанализируй текущие данные Frontpad. Скажи коротко: что происходит, какая точка требует внимания и какое одно действие сделать первым. Не придумывай отсутствующие показатели.');
  }catch(e){body.innerHTML='<div class="analytics-note">Не удалось загрузить аналитику. Попробуй обновить через несколько секунд.</div>'}
}
async function uploadFrontpadFile(file){
  const fd=new FormData();fd.append('file',file);
  body.innerHTML='<div class="analytics-loading">Разбираю выгрузку '+esc(file.name)+'…</div>';
  try{
    const r=await fetch('/api/frontpad/upload',{method:'POST',body:fd,signal:AbortSignal.timeout(45000)});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Ошибка файла');
    toast('Выгрузка Frontpad загружена');renderAnalytics(d);
  }catch(e){toast(e.message||'Не удалось прочитать файл');renderAnalytics()}
}
async function startFrontpadAuth(snapshot,status,uploaded){
  const box=$('#frontpadAuthBox');if(!box)return;
  box.innerHTML='<div class="analytics-loading">Открываю вход Frontpad…</div>';
  try{
    const r=await fetch('/api/frontpad/auth/start',{method:'POST'});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Не удалось начать вход');
    if(d.requiresCode){
      box.innerHTML='<div class="frontpad-auth"><p>Введите код с картинки Frontpad</p>'+(d.captchaUrl?'<img src="'+d.captchaUrl+'" alt="Код Frontpad">':'')+'<div><input id="frontpadCode" inputmode="numeric" placeholder="Код"><button id="finishFrontpad">Подключить</button></div></div>';
      $('#finishFrontpad').onclick=async()=>{const code=$('#frontpadCode').value.trim();const rr=await fetch('/api/frontpad/auth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const dd=await rr.json();if(!rr.ok){toast(dd.error||'Frontpad не подключён');return}toast('Frontpad подключён');renderAnalytics(uploaded)};
    }else{
      const rr=await fetch('/api/frontpad/auth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      const dd=await rr.json();if(!rr.ok)throw Error(dd.error||'Frontpad не подключён');toast('Frontpad подключён');renderAnalytics(uploaded);
    }
  }catch(e){box.innerHTML='<div class="analytics-note">'+esc(e.message||'Не удалось подключить Frontpad')+'</div>'}
}
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
  r.onend=()=>{listeningNow=false;activeRecognition=null;button?.classList.remove('listening');if(button)button.setAttribute('aria-label','Ответить голосом');if(handsFree&&panel?.open&&!document.hidden&&(!('speechSynthesis' in window)||!speechSynthesis.speaking))setTimeout(autoListen,900)};
  r.onerror=e=>{listeningNow=false;activeRecognition=null;if(e?.error!=='no-speech'&&e?.error!=='aborted')toast('Не удалось распознать речь');button?.classList.remove('listening');if(button)button.setAttribute('aria-label','Ответить голосом');if(e?.error==='no-speech'&&handsFree&&panel?.open&&!document.hidden)setTimeout(autoListen,1200)};
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
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&activeRecognition){try{activeRecognition.abort()}catch{}}
  else if(!document.hidden&&handsFree&&panel?.open)setTimeout(autoListen,700);
});
window.addEventListener('online',()=>{toast('Интернет восстановлен');syncStateNow()});
window.addEventListener('offline',()=>toast('Нет сети — данные сохраняются на устройстве'));
const panelVoice=$('#panelVoice');
function syncPanelVoice(){if(panelVoice)panelVoice.textContent=state.tts?'🔊':'🔇'}
if(panelVoice){syncPanelVoice();panelVoice.onclick=()=>{unlockVoice();state.tts=!state.tts;save();syncPanelVoice();if(panel.open)renderChat();toast(state.tts?'Голос включён':'Голос выключен')}}

bootstrapState();notifyDueTasks();
