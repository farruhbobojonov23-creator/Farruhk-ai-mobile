import {formatChat} from './chat-format.js';
import {taskCalendar} from './task-calendar.js';
import {parseLiveReports} from './analytics-values.js';
import {parseTaskCommand,zonedDate,zonedToUtc} from './task-commands.js';
import {requireOwner} from './owner-login.js';
const ownerSession=await requireOwner();
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function readJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}}
let selectedDocuments=[];
const state={chat:readJSON('fai_chat',[]),tasks:readJSON('fai_tasks',[]),memory:readJSON('fai_memory',[]),tts:readJSON('fai_tts',true),timeZone:readJSON('fai_timeZone','Europe/Moscow')};
for(const key of ['chat','tasks','memory'])if(!Array.isArray(state[key]))state[key]=[];
for(const item of [...state.tasks,...state.memory])if(!item.id)item.id=crypto.randomUUID();
let stateUpdatedAt=localStorage.getItem('fai_state_updated_at')||new Date(0).toISOString();
let syncTimer=null,syncBusy=false,bootstrapping=true,stateRevision=Number(localStorage.getItem('fai_revision')||0),changeGeneration=localStorage.getItem('fai_dirty')==='1'?1:0,savedGeneration=0,syncConflict=false;
function syncLabel(text){const el=$('#syncStatus');if(el)el.textContent=text}

function save(skipSync=false){
  try{
    localStorage.setItem('fai_chat',JSON.stringify(state.chat.slice(-40)));
    localStorage.setItem('fai_tasks',JSON.stringify(state.tasks));
    localStorage.setItem('fai_memory',JSON.stringify(state.memory.slice(-100)));
    localStorage.setItem('fai_tts',JSON.stringify(state.tts));
  }catch{toast('Не удалось сохранить данные на устройстве')}
  updateDashboardLocal();
  if(!skipSync){
    changeGeneration++;localStorage.setItem('fai_dirty','1');syncLabel('Сохраняю…');
    stateUpdatedAt=new Date().toISOString();
    localStorage.setItem('fai_state_updated_at',stateUpdatedAt);
    if(!bootstrapping)scheduleStateSync();
  }
}
function statePayload(){return {tasks:state.tasks,memory:state.memory,chat:state.chat.slice(-40),tts:state.tts,timeZone:state.timeZone,revision:stateRevision,updatedAt:stateUpdatedAt}}
function scheduleStateSync(){clearTimeout(syncTimer);syncTimer=setTimeout(syncStateNow,700)}
async function syncStateNow(){
  if(syncBusy||syncConflict||bootstrapping)return false;
  syncBusy=true;const generation=changeGeneration;
  try{
    const r=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(statePayload()),signal:AbortSignal.timeout(20000)});
    const d=await r.json();
    if(r.status===409){syncConflict=true;resolveConflict(d.state);return false}
    if(!r.ok)throw Error(d.error||'Не удалось сохранить');
    stateRevision=d.state.revision;localStorage.setItem('fai_revision',stateRevision);savedGeneration=generation;
    if(changeGeneration===generation){localStorage.removeItem('fai_dirty');stateUpdatedAt=d.state.updatedAt;localStorage.setItem('fai_state_updated_at',stateUpdatedAt);syncLabel('Сохранено')}
    return true;
  }catch(e){syncLabel('Не сохранено · повторю');syncTimer=setTimeout(syncStateNow,10000);return false}
  finally{syncBusy=false;if(!syncConflict&&changeGeneration>generation)scheduleStateSync()}
}
function adoptRemote(remote){
  state.tasks=Array.isArray(remote.tasks)?remote.tasks:[];state.memory=Array.isArray(remote.memory)?remote.memory:[];state.chat=Array.isArray(remote.chat)?remote.chat:[];state.tts=remote.tts!==false;state.timeZone=remote.timeZone||'Europe/Moscow';
  stateRevision=remote.revision;stateUpdatedAt=remote.updatedAt||new Date().toISOString();localStorage.setItem('fai_revision',stateRevision);localStorage.setItem('fai_state_updated_at',stateUpdatedAt);localStorage.setItem('fai_timeZone',JSON.stringify(state.timeZone));savedGeneration=changeGeneration;localStorage.removeItem('fai_dirty');save(true);syncLabel('Сохранено');renderCurrentIfOpen();
}
function resolveConflict(remote){
  localStorage.setItem('fai_conflict_backup',JSON.stringify(statePayload()));
  openPanel('Конфликт сохранения');body.innerHTML='<p>Данные изменились на другом устройстве. Локальная версия сохранена отдельно. Выберите, какую версию продолжить.</p><div class="conflict-actions"><button id="conflictDownload">Скачать мою копию</button><button id="conflictRemote">Загрузить серверную</button><button id="conflictLocal">Заменить серверную моей</button></div>';
  $('#conflictDownload').onclick=downloadBackup;
  $('#conflictRemote').onclick=()=>{adoptRemote(remote);syncConflict=false;panel.close();toast('Загружена серверная версия')};
  $('#conflictLocal').onclick=()=>{if(!confirm('Заменить данные сервера локальной версией? Сначала скачайте копию, если обе версии нужны.'))return;stateRevision=remote.revision;syncConflict=false;changeGeneration++;panel.close();syncStateNow()};
  syncLabel('Нужна сверка версий');
}
async function bootstrapState(){
  try{
    const r=await fetch('/api/state',{signal:AbortSignal.timeout(15000)}),d=await r.json();if(!r.ok)throw Error(d.error||'Ошибка');
    const remote=d.state,localHasData=state.tasks.length||state.memory.length||state.chat.length;
    if(remote.revision===0&&localHasData){stateRevision=0;bootstrapping=false;changeGeneration++;await syncStateNow()}
    else if(localHasData&&localStorage.getItem('fai_revision')===null){syncConflict=true;resolveConflict(remote)}
    else if(changeGeneration>savedGeneration){if(remote.revision!==stateRevision){syncConflict=true;resolveConflict(remote)}else{bootstrapping=false;await syncStateNow()}}
    else adoptRemote(remote);
  }catch{syncLabel('Сервер недоступен');toast('Локальные данные сохранены. Синхронизация пока недоступна.')}
  finally{bootstrapping=false;if(!syncConflict)renderCurrentIfOpen();refreshDashboard()}
}
async function refreshState(){
  if(syncBusy||syncConflict||changeGeneration>savedGeneration)return;
  try{const r=await fetch('/api/state',{signal:AbortSignal.timeout(10000)});if(!r.ok)return;const d=await r.json();if(d.state.revision>stateRevision)adoptRemote(d.state)}catch{}
}
setInterval(refreshState,30000);
function dashboardCounts(){
  const now=zonedDate(new Date(),state.timeZone),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let todayCount=0,overdue=0,important=0;
  for(const t of state.tasks){
    if(t.done)continue;
    if(t.priority==='high')important++;
    if(!t.due){todayCount++;continue}
    const d=zonedDate(new Date(t.due),state.timeZone);
    if(Number.isNaN(d.getTime()))continue;
    const day=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    if(d.getTime()<now.getTime())overdue++;
    else if(day.getTime()===today.getTime())todayCount++;
  }
  return {todayCount,overdue,important};
}
function updateDashboardLocal(){
  const c=dashboardCounts();
  const a=$('#dashTodayTasks'),o=$('#dashOverdue'),i=$('#dashImportant');
  if(a)a.textContent=String(c.todayCount);
  if(o)o.textContent=String(c.overdue);
  if(i)i.textContent='важных: '+c.important;
  const insight=$('#dashboardInsight');
  if(insight){
    if(c.overdue>0)insight.textContent='Сначала закрой просроченные задачи: '+c.overdue+'.';
    else if(c.important>0)insight.textContent='На сегодня есть '+c.important+' важн'+(c.important===1?'ая задача':'ых задач')+'.';
    else if(c.todayCount>0)insight.textContent='На сегодня '+c.todayCount+' активн'+(c.todayCount===1?'ая задача':'ых задач')+'.';
    else insight.textContent='Критичных задач на сегодня нет. Можно перейти к аналитике или текущему проекту.';
  }
}
async function refreshDashboard(){
  updateDashboardLocal();
  const ai=$('#dashAi'),aiNote=$('#dashAiNote'),fp=$('#dashFrontpad'),fpNote=$('#dashFrontpadNote');
  try{
    const [statusR,frontpadR,snapshotR]=await Promise.allSettled([
      fetch('/api/status',{signal:AbortSignal.timeout(10000)}),
      fetch('/api/frontpad/status',{signal:AbortSignal.timeout(10000)}),
      fetch('/api/analytics/snapshot',{signal:AbortSignal.timeout(10000)})
    ]);
    if(statusR.status==='fulfilled'){
      const d=await statusR.value.json();
      if(ai)ai.textContent=d.aiConnected?'НАСТРОЕН':'РЕЗЕРВ';
      if(aiNote)aiNote.textContent=d.aiConnected?'Доступность проверяется при запросе':'Работают локальные команды';
    }else{
      if(ai)ai.textContent='OFFLINE';
      if(aiNote)aiNote.textContent='Нет связи с сервером';
    }
    let fpd=null;
    if(frontpadR.status==='fulfilled')fpd=await frontpadR.value.json();
    let snap=null;
    if(snapshotR.status==='fulfilled')snap=await snapshotR.value.json();
    if(fp){
      if(fpd?.authenticated)fp.textContent='LIVE';
      else if(fpd?.configured)fp.textContent='НУЖЕН ВХОД';
      else fp.textContent='СНИМОК';
    }
    if(fpNote){
      if(fpd?.authenticated)fpNote.textContent='Сессия Frontpad активна';
      else if(snap?.date)fpNote.textContent='Снимок от '+snap.date;
      else fpNote.textContent='Нет свежих данных';
    }
    if(!analyticsContext&&snap){
      analyticsContext={source:'РУЧНОЙ СНИМОК',updatedAt:snap.date||null,metrics:[],branches:snap.branches||[],totalUnits:snap.totalUnits??null,summary:snap.summary||'',live:false,periodComplete:snap.periodComplete??false};
    }
  }catch{}
}
function renderCurrentIfOpen(){if(!panel?.open)return;const name=title.textContent;if(name==='Спросить AI')renderChat();else if(name==='Задачи')renderTasks();else if(name==='Память')renderMemory()}
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const toast=t=>{const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};
$('#today').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
(async()=>{try{const r=await fetch('/api/status');const d=await r.json();$('#aiStatus').textContent=d.aiConnected?'AI НАСТРОЕН':'AI РЕЗЕРВ';}catch{}})();
const panel=$('#panel'),body=$('#panelBody'),title=$('#panelTitle');
let chatBusy=false;
let analyticsContext=null;
let voiceUnlocked=false;
let handsFree=false;
let listeningNow=false;
let activeRecognition=null,recordingStop=null;
function unlockVoice(){
  if(!('speechSynthesis' in window))return false;
  try{
    speechSynthesis.resume();
    if(!voiceUnlocked){
      const u=new SpeechSynthesisUtterance(' ');
      u.lang='ru-RU';u.volume=.01;u.rate=1;
      speechSynthesis.speak(u);
    }
    voiceUnlocked=true;
    return true;
  }catch{return false}
}
document.addEventListener('pointerdown',()=>unlockVoice(),{once:true,passive:true});
function openPanel(name){title.textContent=name;if(!panel.open)panel.show()}$('#panelClose').onclick=()=>{handsFree=false;if(activeRecognition){try{activeRecognition.abort()}catch{}}panel.close()};panel.addEventListener('click',e=>{if(e.target===panel){handsFree=false;if(activeRecognition){try{activeRecognition.abort()}catch{}}panel.close()}});
function getRussianVoice(){
  if(!('speechSynthesis' in window))return null;
  const voices=speechSynthesis.getVoices()||[];
  return voices.find(v=>/^ru(-|_)/i.test(v.lang)&&/female|alena|alyona|milena|irina|svetlana|anna|maria|victoria/i.test(v.name))
    ||voices.find(v=>/^ru(-|_)/i.test(v.lang))
    ||voices[0]
    ||null;
}
function speak(text){
  if(!state.tts||!text){if(handsFree&&panel?.open)setTimeout(autoListen,350);return false;}
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
    u.volume=1;
    const voice=getRussianVoice();
    if(voice)u.voice=voice;
    u.onend=()=>{if(handsFree&&panel?.open)setTimeout(()=>autoListen(),350)};
    u.onerror=e=>{toast('Не удалось озвучить ответ');if(handsFree&&panel?.open)setTimeout(()=>autoListen(),600)};
    speechSynthesis.speak(u);
    setTimeout(()=>{try{speechSynthesis.resume()}catch{}},250);
    return true;
  }catch{toast('Не удалось включить голос');return false}
}
if('speechSynthesis' in window){
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices();
}
function renderChat(){
  body.innerHTML=(selectedDocuments.length?'<div class="document-toolbar"><span>Документов для ответа: '+selectedDocuments.length+'</span><button id="clearChatDocs">Снять выбор</button></div>':'')+'<div class="conversation-mode '+(handsFree?'on':'')+'"><span>'+(handsFree?'Живой диалог включён':'Нажми микрофон один раз — дальше отвечай голосом без лишних нажатий')+'</span></div><div class="chatlog">'+
    (state.chat.length?state.chat.map((m,index)=>'<div class="msg '+m.role+'"><div class="msg-text">'+formatChat(m.text)+'</div>'+(m.role==='ai'?'<div class="answer-actions"><button type="button" data-answer="copy" data-index="'+index+'">Копировать</button><button type="button" data-answer="speak" data-index="'+index+'">Озвучить</button><button type="button" data-answer="task" data-index="'+index+'">В задачу</button></div>':'')+'</div>').join(''):'<div class="msg ai"><div class="msg-text">Я готов. Говори или пиши — отвечу по делу и продолжу разговор с учётом контекста.</div></div>')+
    '</div>'+
    '<form class="chat-composer" id="chatComposer">'+
      '<button type="button" class="chat-mic" id="chatMic" aria-label="Ответить голосом">🎙</button>'+
      '<input id="chatInput" autocomplete="off" placeholder="Ответить FARRUKH AI…" aria-label="Ответить FARRUKH AI">'+
      '<button class="chat-send" type="submit" aria-label="Отправить">↑</button>'+
    '</form><div class="voice-controls"><span id="voiceState" role="status">Готова к разговору</span><button id="stopConversation" type="button">Остановить</button></div>';
  body.querySelectorAll('[data-answer]').forEach(button=>button.onclick=async()=>{const text=state.chat[Number(button.dataset.index)]?.text;if(!text)return;if(button.dataset.answer==='copy'){try{await navigator.clipboard.writeText(text);toast('Ответ скопирован')}catch{toast('Не удалось скопировать. Выделите текст ответа.')}}else if(button.dataset.answer==='speak'){unlockVoice();speak(text)}else{taskEditor(null,text)}});
  $('#stopConversation').onclick=stopConversation;updateVoiceState();
  const clear=$('#clearChatDocs');if(clear)clear.onclick=()=>{selectedDocuments=[];renderChat()};
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
  const now=zonedDate(new Date(),state.timeZone),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
  const local=zonedDate(d,state.timeZone),day=new Date(local.getFullYear(),local.getMonth(),local.getDate());
  const time=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:state.timeZone});
  if(day.getTime()===today.getTime())return 'Сегодня · '+time;
  if(day.getTime()===tomorrow.getTime())return 'Завтра · '+time;
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:state.timeZone})+' · '+time;
}
function addTaskFromCommand(raw){
  const task=parseTaskCommand(raw,new Date(),state.timeZone);
  if(!task)return null;
  state.tasks.unshift(task);save();return task;
}
function todayTasksText(){
  const now=zonedDate(new Date(),state.timeZone),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const rows=state.tasks.filter(t=>!t.done).filter(t=>{
    if(!t.due)return true;
    const d=zonedDate(new Date(t.due),state.timeZone);return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()&&d.getDate()===today.getDate();
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
  $('#addMemory').onclick=()=>{openPanel('Добавить в память');body.innerHTML='<form class="inline-form" id="memoryForm"><label>Что запомнить?<textarea name="note" required maxlength="1000" rows="5"></textarea></label><button>Сохранить</button></form>';$('#memoryForm').onsubmit=e=>{e.preventDefault();if(addMemory(e.target.elements.note.value)){renderMemory();toast('Факт сохранён')}}};
  list.onclick=e=>{if(e.target.dataset.memoryDel!==undefined){if(!confirm('Удалить этот факт из памяти?'))return;state.memory.splice(+e.target.dataset.memoryDel,1);save();draw()}};
}
async function askAI(text){text=String(text||'').trim();if(!text)return;
  let task;try{task=addTaskFromCommand(text)}catch(e){toast(e.message);return}
  if(task){
    const reply='Добавил задачу: '+task.text+(task.due?' — '+taskDateLabel(task.due):'')+(task.priority==='high'?' · важная':'');
    state.chat.push({role:'user',text},{role:'ai',text:reply});save();openPanel('Спросить AI');renderChat();speak(reply);return;
  }
  if(/^(что у меня сегодня|что сегодня важного|задачи на сегодня|что мне сегодня сделать)/i.test(text)){
    const reply=todayTasksText();
    state.chat.push({role:'user',text},{role:'ai',text:reply});save();openPanel('Спросить AI');renderChat();speak(reply);return;
  }
  const remember=text.match(/^\s*запомни\s*(?::|,?\s*что)?\s+(.+)$/i);
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
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history,documentIds:selectedDocuments,useWeb:false,context:{memory:memoryText(),tasks:state.tasks,frontpad:analyticsContext}}),signal:AbortSignal.timeout(40000)});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Не удалось получить ответ');
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
  const d=new Date(t.due),now=new Date(),wallNow=zonedDate(now,state.timeZone),today=new Date(wallNow.getFullYear(),wallNow.getMonth(),wallNow.getDate()),tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
  const local=zonedDate(d,state.timeZone),day=new Date(local.getFullYear(),local.getMonth(),local.getDate());
  if(d.getTime()<now.getTime())return 'overdue';
  if(day.getTime()===today.getTime())return 'today';
  if(day.getTime()===tomorrow.getTime())return 'tomorrow';
  return 'later';
}
let taskFilter='today';
function renderTasks(){
  openPanel('Задачи');
  body.innerHTML='<div class="task-toolbar"><button id="notifyTasks" class="task-remind">🔔 Напоминания</button><button id="calendarTasks" class="task-remind">В календарь телефона</button><button class="add-task" id="newTask">+ Новая задача</button></div>'+
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
  $('#calendarTasks').onclick=exportTaskCalendar;
  $('#newTask').onclick=()=>taskEditor();
  list.onchange=e=>{if(e.target.dataset.i!==undefined){state.tasks[+e.target.dataset.i].done=e.target.checked;save();draw()}};
  list.onclick=e=>{
    if(e.target.dataset.del!==undefined){if(!confirm('Удалить эту задачу?'))return;state.tasks.splice(+e.target.dataset.del,1);save();draw();return}
    if(e.target.dataset.edit!==undefined){
      const i=+e.target.dataset.edit,t=state.tasks[i];
      taskEditor(i);
    }
  };
}
function exportTaskCalendar(){
  const tasks=state.tasks.filter(t=>!t.done&&t.due&&Date.parse(t.due)>Date.now());
  if(!tasks.length)return toast('Добавьте задачу с будущей датой и временем');
  const text=taskCalendar(tasks);
  const url=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='Farrukh_AI_Tasks.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Импортируйте файл в календарь. При изменении задач календарь нужно обновить.');
}
async function requestTaskNotifications(){return enablePushNotifications()}

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
  const archiveOnly=!liveOk&&!uploaded?.ok;
  const sourceMode=liveOk?'LIVE FRONTPAD':uploaded?.ok?'ФАЙЛ FRONTPAD':'РУЧНОЙ СНИМОК';
  const updated=liveOk?live.updatedAt:uploaded?.uploadedAt||snapshot?.capturedAt||null;
  const freshness=updated?new Date(updated).toLocaleString('ru-RU'):(snapshot?.date||'дата снимка неизвестна');
  analyticsContext={
    source:sourceMode,
    updatedAt:updated||snapshot?.date||null,
    metrics,
    branches:liveOk||uploaded?[]:snapshot?.branches||[],
    totalUnits:archiveOnly?(snapshot?.totalUnits??null):null,
    summary:archiveOnly?(snapshot?.summary||''):'',
    live:liveOk,
    periodComplete:snapshot?.periodComplete??false
  };
  const cards=(metrics.length?metrics.slice(0,5):archiveOnly?[
    {label:'Продано единиц',value:snapshot?.totalUnits??'—'},
    {label:'Точек',value:(snapshot?.branches||[]).length}
  ]:[{label:'Показатели не найдены',value:'—'}]).map(m=>'<div class="analytics-card"><span>'+esc(m.label)+'</span><b>'+esc(metricValue(m.label,m.value))+'</b><small>'+esc(m.source||sourceMode)+'</small></div>').join('');
  const branches=(archiveOnly?(snapshot?.branches||[]):[]).slice().sort((a,b)=>(b.units||0)-(a.units||0)).map((b,i)=>'<div class="branch-row"><div><span class="rank">'+(i+1)+'</span><div><b>'+esc(b.name)+'</b><small>'+esc(b.strongCategory||'')+(b.topItem?' · '+esc(b.topItem):'')+'</small></div></div><strong>'+esc(b.units)+' ед.</strong></div>').join('');
  const warning=liveOk?'Данные получены из активной сессии Frontpad. Проверяй период отчёта перед управленческими выводами.':uploaded?.ok?'Показатели рассчитаны из загруженной выгрузки Frontpad.':'Сейчас показан старый ручной снимок. Для актуальной выручки и заказов подключи Frontpad или загрузи выгрузку.';
  return '<div class="analytics-top"><div><span class="analytics-status '+(liveOk?'live':'manual')+'">'+sourceMode+'</span><h3>Аналитика бизнеса</h3><p>Обновлено: '+esc(freshness)+'</p></div><button id="refreshAnalytics" class="analytics-refresh">↻</button></div>'+
    '<div class="analytics-grid">'+cards+'</div>'+
    '<div class="analytics-note">'+esc(warning)+'</div>'+
    (branches?'<div class="analytics-section"><h4>Точки · ручной снимок '+esc(snapshot?.date||'дата неизвестна')+'</h4>'+branches+'</div>':'')+
    '<div class="analytics-actions">'+
      (status?.configured&&!status?.authenticated?'<button id="connectFrontpad">Подключить Frontpad</button>':'')+
      '<label class="upload-analytics">Загрузить XLSX/CSV<input id="frontpadFile" type="file" accept=".xlsx,.csv" hidden></label>'+
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
async function renderAnalytics(uploaded=readJSON('fai_frontpad_import',null)){
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
    localStorage.setItem('fai_frontpad_import',JSON.stringify(d));toast('Выгрузка Frontpad сохранена на устройстве');renderAnalytics(d);
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
function toolCard(id,title,desc,icon){return '<button class="chef-tool-card" data-tool="'+id+'"><span class="chef-tool-icon">'+icon+'</span><div><b>'+title+'</b><small>'+desc+'</small></div><span>↗</span></button>'}
function renderTools(){
  openPanel('Инструменты');
  body.innerHTML='<div class="chef-tools-grid">'+
    toolCard('cost','Себестоимость','Граммовки × закупочная цена','₽')+
    toolCard('foodcost','Food cost','Себестоимость к цене продажи','%')+
    toolCard('scale','Перерасчёт рецепта','Масштабирование граммовок','×')+
    toolCard('kbju','КБЖУ','Белки, жиры, углеводы и ккал','K')+
    toolCard('ttk','ТТК','Собрать техкарту через AI','≡')+
    toolCard('memory','Память','Сохранённые рабочие факты','✦')+
    toolCard('settings','Настройки','Часовой пояс и вход','⚙')+
    toolCard('documents','Документы','Файлы и ответы по содержимому','▤')+
    toolCard('backup','Backup & Restore','Резервные копии и восстановление','↺')+
    '</div><div class="tool-footnote">Цены и КБЖУ не подставляются автоматически — расчёты используют только введённые тобой значения.</div>';
  body.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>openChefTool(b.dataset.tool));
}
function openChefTool(type){
  if(type==='settings')return renderSettings();
  if(type==='documents')return renderDocuments();
  if(type==='memory'){renderMemory();return}
  if(type==='backup'){renderBackupTool();return}
  if(type==='ttk'){askAI('Помоги составить техкарту блюда. Сначала спроси название блюда, выход порции и ингредиенты с граммовками. Не придумывай цены и граммовки.');return}
  if(type==='cost')return renderCostTool();
  if(type==='foodcost')return renderFoodCostTool();
  if(type==='scale')return renderScaleTool();
  if(type==='kbju')return renderKbjuTool();
}
function toolBack(){return '<button class="tool-back" id="toolBack">← Инструменты</button>'}
function bindToolBack(){const b=$('#toolBack');if(b)b.onclick=renderTools}
function applyStateObject(data){
  const s=data?.state||data;
  if(!s||typeof s!=='object')throw Error('Файл не похож на резервную копию FARRUKH AI');
  state.tasks=Array.isArray(s.tasks)?s.tasks:[];
  state.memory=Array.isArray(s.memory)?s.memory:[];
  state.chat=Array.isArray(s.chat)?s.chat:[];
  state.tts=s.tts!==false;state.timeZone=s.timeZone||state.timeZone;
  stateUpdatedAt=new Date().toISOString();
  localStorage.setItem('fai_state_updated_at',stateUpdatedAt);
  save();
  syncPanelVoice();
  updateDashboardLocal();
}
function downloadBackup(){
  const payload={version:1,createdAt:new Date().toISOString(),state:statePayload()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='FARRUKH_AI_backup_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadBackupHistory(){
  const box=$('#backupHistory');if(!box)return;
  box.innerHTML='<div class="analytics-loading">Проверяю облачные копии…</div>';
  try{
    const r=await fetch('/api/backups',{signal:AbortSignal.timeout(15000)});const d=await r.json();
    if(!r.ok)throw Error(d.error||'Ошибка');
    if(!d.backups?.length){box.innerHTML='<div class="empty-state">Резервных копий пока нет.</div>';return}
    box.innerHTML=d.backups.map((b,i)=>'<div class="backup-row"><div><b>'+(b.modified?esc(new Date(b.modified).toLocaleString('ru-RU')):esc(b.name))+'</b><small>'+esc(b.name)+'</small></div><button data-restore="'+i+'">Восстановить</button></div>').join('');
    box.onclick=async e=>{
      const idx=e.target.dataset.restore;if(idx===undefined)return;
      const b=d.backups[+idx];if(!b)return;
      if(!confirm('Восстановить эту резервную копию? Текущее состояние будет заменено.'))return;
      try{
        const rr=await fetch('/api/backups/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:b.path,revision:stateRevision}),signal:AbortSignal.timeout(20000)});
        const dd=await rr.json();if(!rr.ok)throw Error(dd.error||'Ошибка восстановления');
        adoptRemote(dd.state);toast('Резервная копия восстановлена');renderBackupTool();
      }catch(err){toast(err.message||'Не удалось восстановить')}
    };
  }catch(err){box.innerHTML='<div class="analytics-note">История облачных копий сейчас недоступна.</div>'}
}
function renderBackupTool(){
  openPanel('Backup & Restore');
  body.innerHTML=toolBack()+'<div class="calc-head"><h3>Резервные копии</h3><p>Скачай копию на устройство или восстанови состояние из облака / файла.</p></div>'+
    '<div class="backup-actions"><button id="backupNow">Создать резервную копию</button><button id="backupDownload">Скачать JSON</button><label>Восстановить из файла<input id="backupFile" type="file" accept=".json,application/json" hidden></label></div>'+
    '<div class="backup-status"><span>Автокопия</span><b id="backupCloudStatus">Проверяю…</b></div>'+
    '<p class="tool-footnote">Копия содержит чат, задачи и память. Документы хранятся отдельно в папке ассистента на Яндекс Диске.</p><h4 class="backup-title">История копий</h4><div id="backupHistory"></div>';
  bindToolBack();
  $('#backupDownload').onclick=downloadBackup;
  const file=$('#backupFile');file.onchange=async()=>{const f=file.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!confirm('Восстановить данные из файла?'))return;applyStateObject(data);await syncStateNow();toast('Данные восстановлены из файла');renderBackupTool()}catch(err){toast(err.message||'Некорректный backup')}};
  $('#backupNow').onclick=async()=>{const b=$('#backupNow');b.disabled=true;b.textContent='Создаю…';try{if(!await syncStateNow())throw Error('Сначала сохраните данные без конфликтов');const r=await fetch('/api/backups',{method:'POST',signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Ошибка');toast('Резервная копия создана');loadBackupHistory()}catch(err){toast(err.message||'Не удалось создать backup')}finally{b.disabled=false;b.textContent='Создать резервную копию'}};
  fetch('/api/yandex/status',{signal:AbortSignal.timeout(10000)}).then(r=>r.json()).then(d=>{const el=$('#backupCloudStatus');if(el)el.textContent=d.connected?'Яндекс Диск подключён · копии на серверном диске':'Копии в хранилище ассистента'}).catch(()=>{const el=$('#backupCloudStatus');if(el)el.textContent='Копии в хранилище ассистента'});
  loadBackupHistory();
}
function renderCostTool(){
  openPanel('Себестоимость');
  body.innerHTML=toolBack()+'<div class="calc-head"><h3>Себестоимость блюда</h3><p>Цена указывается за 1 кг / 1 л / 1 упаковку в той же единице, что и количество.</p></div><div id="costRows"></div><button class="calc-add" id="addCostRow">+ Ингредиент</button><div class="calc-result"><span>Себестоимость порции</span><b id="costTotal">0 ₽</b></div>';
  bindToolBack();
  const rows=$('#costRows');
  const add=()=>{const row=document.createElement('div');row.className='calc-row calc-row-cost';row.innerHTML='<input placeholder="Ингредиент"><input inputmode="decimal" placeholder="г/мл" data-qty><input inputmode="decimal" placeholder="₽/кг или л" data-price><button type="button" aria-label="Удалить">×</button>';rows.appendChild(row);row.querySelectorAll('input').forEach(i=>i.oninput=calc);row.querySelector('button').onclick=()=>{row.remove();calc()}};
  const calc=()=>{let total=0;rows.querySelectorAll('.calc-row').forEach(r=>{const q=parseFloat((r.querySelector('[data-qty]').value||'').replace(',','.'))||0;const p=parseFloat((r.querySelector('[data-price]').value||'').replace(',','.'))||0;total+=q*p/1000});$('#costTotal').textContent=money(total)};
  $('#addCostRow').onclick=add;add();add();
}
function renderFoodCostTool(){
  openPanel('Food cost');
  body.innerHTML=toolBack()+'<div class="calc-head"><h3>Food cost</h3><p>Сравни себестоимость и цену продажи.</p></div><div class="calc-form"><label>Себестоимость, ₽<input id="fcCost" inputmode="decimal" placeholder="0"></label><label>Цена продажи, ₽<input id="fcPrice" inputmode="decimal" placeholder="0"></label></div><div class="calc-result-grid"><div><span>Food cost</span><b id="fcPercent">0%</b></div><div><span>Валовая маржа</span><b id="fcMargin">0 ₽</b></div></div>';
  bindToolBack();
  const calc=()=>{const c=parseFloat(($('#fcCost').value||'').replace(',','.'))||0,p=parseFloat(($('#fcPrice').value||'').replace(',','.'))||0;$('#fcPercent').textContent=p?((c/p)*100).toFixed(1)+'%':'0%';$('#fcMargin').textContent=money(Math.max(0,p-c))};
  $('#fcCost').oninput=calc;$('#fcPrice').oninput=calc;
}
function renderScaleTool(){
  openPanel('Перерасчёт рецепта');
  body.innerHTML=toolBack()+'<div class="calc-head"><h3>Перерасчёт граммовок</h3><p>Задай исходный и новый выход блюда.</p></div><div class="calc-form two"><label>Исходный выход, г<input id="baseYield" inputmode="decimal" value="1000"></label><label>Новый выход, г<input id="newYield" inputmode="decimal" value="1500"></label></div><div id="scaleRows"></div><button class="calc-add" id="addScaleRow">+ Ингредиент</button>';
  bindToolBack();const rows=$('#scaleRows');
  const calc=()=>{const a=parseFloat($('#baseYield').value)||1,b=parseFloat($('#newYield').value)||0,k=b/a;rows.querySelectorAll('.scale-row').forEach(r=>{const q=parseFloat((r.querySelector('[data-base]').value||'').replace(',','.'))||0;r.querySelector('[data-new]').textContent=(q*k).toFixed(1)+' г'})};
  const add=()=>{const r=document.createElement('div');r.className='scale-row';r.innerHTML='<input placeholder="Ингредиент"><input inputmode="decimal" placeholder="Исходно, г" data-base><b data-new>0 г</b><button>×</button>';rows.appendChild(r);r.querySelector('[data-base]').oninput=calc;r.querySelector('button').onclick=()=>r.remove()};$('#addScaleRow').onclick=add;$('#baseYield').oninput=calc;$('#newYield').oninput=calc;add();add();
}
const KBJU_CATALOG=[
  {n:'Рис варёный',a:['рис','рис готовый','рис для суши'],k:130,p:2.4,f:0.3,c:28.7},
  {n:'Рис для суши с заправкой',a:['рис суши','суши рис','рис с заправкой'],k:150,p:2.3,f:0.3,c:34.0},
  {n:'Лосось',a:['лосось','семга','сёмга'],k:208,p:20.0,f:13.0,c:0},
  {n:'Тунец',a:['тунец'],k:132,p:29.0,f:1.0,c:0},
  {n:'Угорь копчёный',a:['угорь','унаги'],k:236,p:23.7,f:15.0,c:0},
  {n:'Креветка тигровая',a:['креветка','креветка тигровая','тигровая креветка'],k:99,p:24.0,f:0.3,c:0.2},
  {n:'Крабовые палочки',a:['краб','крабовые палочки','сурими'],k:95,p:7.0,f:0.5,c:15.0},
  {n:'Сливочный сыр',a:['сыр сливочный','сливочный сыр','крем сыр','крем-сыр'],k:342,p:5.9,f:34.2,c:4.1},
  {n:'Огурец',a:['огурец'],k:15,p:0.7,f:0.1,c:3.6},
  {n:'Авокадо',a:['авокадо'],k:160,p:2.0,f:14.7,c:8.5},
  {n:'Нори',a:['нори'],k:306,p:41.4,f:3.7,c:44.3},
  {n:'Масаго',a:['масаго','икра масаго'],k:143,p:22.3,f:6.4,c:1.5},
  {n:'Тобико',a:['тобико','икра тобико'],k:143,p:22.3,f:6.4,c:1.5},
  {n:'Майонез',a:['майонез'],k:680,p:1.0,f:75.0,c:2.6},
  {n:'Соус спайси',a:['спайси','соус спайси','спайси соус'],k:500,p:2.0,f:52.0,c:6.0},
  {n:'Соус унаги',a:['унаги соус','соус унаги'],k:150,p:3.0,f:0.2,c:34.0},
  {n:'Соевый соус',a:['соевый соус'],k:53,p:8.1,f:0.6,c:4.9},
  {n:'Кунжут',a:['кунжут'],k:573,p:17.7,f:49.7,c:23.5},
  {n:'Кунжутное масло',a:['кунжутное масло'],k:884,p:0,f:100,c:0},
  {n:'Лук зелёный',a:['лук зеленый','лук зелёный','зелёный лук','зеленый лук'],k:32,p:1.8,f:0.2,c:7.3},
  {n:'Лук фри',a:['лук фри','жареный лук'],k:545,p:6.0,f:36.0,c:48.0},
  {n:'Куриное филе',a:['курица','куриное филе','филе куриное'],k:165,p:31.0,f:3.6,c:0},
  {n:'Курица терияки',a:['курица терияки'],k:190,p:24.0,f:7.0,c:8.0},
  {n:'Яйцо куриное',a:['яйцо','яйцо куриное'],k:155,p:13.0,f:11.0,c:1.1},
  {n:'Темпурная мука',a:['темпура','темпурная мука'],k:350,p:8.0,f:1.5,c:76.0},
  {n:'Сухари панко',a:['панко','сухари панко'],k:395,p:13.0,f:5.0,c:73.0},
  {n:'Растительное масло',a:['масло растительное','растительное масло','фритюр'],k:884,p:0,f:100,c:0},
  {n:'Ананас',a:['ананас'],k:50,p:0.5,f:0.1,c:13.1},
  {n:'Манго',a:['манго'],k:60,p:0.8,f:0.4,c:15.0},
  {n:'Чука',a:['чука','салат чука'],k:90,p:1.5,f:4.0,c:12.0},
  {n:'Тофу',a:['тофу'],k:76,p:8.1,f:4.8,c:1.9},
  {n:'Удон варёный',a:['удон','лапша удон'],k:127,p:3.5,f:0.5,c:25.0},
  {n:'Лапша соба варёная',a:['соба','лапша соба'],k:99,p:5.1,f:0.1,c:21.4},
  {n:'Морковь',a:['морковь'],k:41,p:0.9,f:0.2,c:9.6},
  {n:'Перец болгарский',a:['перец болгарский','болгарский перец'],k:31,p:1.0,f:0.3,c:6.0},
  {n:'Шампиньоны',a:['шампиньоны','грибы'],k:22,p:3.1,f:0.3,c:3.3},
  {n:'Капуста пекинская',a:['пекинская капуста','капуста пекинская'],k:16,p:1.2,f:0.2,c:3.2},
  {n:'Сахар',a:['сахар'],k:387,p:0,f:0,c:100},
  {n:'Мирин',a:['мирин'],k:241,p:0.4,f:0,c:43.9},
  {n:'Рисовый уксус',a:['рисовый уксус','уксус рисовый'],k:18,p:0,f:0,c:0.6}
];
function normIngredient(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim()}
function findKbjuIngredient(name){
  const q=normIngredient(name);if(!q)return null;
  let best=null,bestScore=0;
  for(const item of KBJU_CATALOG){
    for(const raw of [item.n,...item.a]){
      const a=normIngredient(raw);
      let score=0;
      if(q===a)score=100;
      else if(q.includes(a)||a.includes(q))score=Math.min(q.length,a.length)+20;
      else{
        const qWords=q.split(' '),aWords=a.split(' ');
        score=qWords.filter(w=>aWords.includes(w)&&w.length>2).length*6;
      }
      if(score>bestScore){best=item;bestScore=score}
    }
  }
  return bestScore>=6?best:null;
}
function renderKbjuTool(){
  openPanel('КБЖУ');
  body.innerHTML=toolBack()+
    '<div class="calc-head"><h3>Авто КБЖУ</h3><p>Введи название ингредиента и массу — КБЖУ на 100 г подставится автоматически из встроенной базы. Если продукт не найден, значения можно ввести вручную.</p></div>'+
    '<datalist id="kbjuCatalog">'+KBJU_CATALOG.map(x=>'<option value="'+esc(x.n)+'"></option>').join('')+'</datalist>'+
    '<div class="kbju-auto-note">База содержит основные продукты японской кухни. Для фирменных соусов и конкретных брендов точнее использовать данные с упаковки.</div>'+
    '<div id="kbjuRows"></div><button class="calc-add" id="addKbjuRow">+ Ингредиент</button>'+
    '<div class="kbju-result"><div><span>Ккал</span><b id="sumKcal">0</b></div><div><span>Белки</span><b id="sumP">0 г</b></div><div><span>Жиры</span><b id="sumF">0 г</b></div><div><span>Углеводы</span><b id="sumC">0 г</b></div></div>'+
    '<div class="calc-result"><span>Общий вес</span><b id="sumWeight">0 г</b></div>';
  bindToolBack();const rows=$('#kbjuRows');
  const calc=()=>{
    let K=0,P=0,F=0,C=0,W=0;
    rows.querySelectorAll('.kbju-row').forEach(r=>{
      const val=s=>parseFloat((r.querySelector(s)?.value||'').replace(',','.'))||0;
      const w=val('[data-w]');W+=w;K+=val('[data-k]')*w/100;P+=val('[data-p]')*w/100;F+=val('[data-f]')*w/100;C+=val('[data-c]')*w/100;
      const subtotal=r.querySelector('[data-sub]');if(subtotal)subtotal.textContent=w?Math.round(val('[data-k]')*w/100)+' ккал':'—';
    });
    $('#sumKcal').textContent=K.toFixed(0);$('#sumP').textContent=P.toFixed(1)+' г';$('#sumF').textContent=F.toFixed(1)+' г';$('#sumC').textContent=C.toFixed(1)+' г';$('#sumWeight').textContent=W.toFixed(1).replace('.0','')+' г';
  };
  const autofill=r=>{
    const name=r.querySelector('[data-name]').value;
    const item=findKbjuIngredient(name);
    const badge=r.querySelector('[data-match]');
    if(!item){badge.textContent=name?'не найдено':'авто';badge.classList.remove('found');return}
    r.querySelector('[data-k]').value=item.k;r.querySelector('[data-p]').value=item.p;r.querySelector('[data-f]').value=item.f;r.querySelector('[data-c]').value=item.c;
    badge.textContent='✓ '+item.n;badge.classList.add('found');calc();
  };
  const add=()=>{
    const r=document.createElement('div');r.className='kbju-row kbju-auto-row';
    r.innerHTML='<div class="kbju-name"><input data-name list="kbjuCatalog" autocomplete="off" placeholder="Например: лосось"><small data-match>авто</small></div>'+
      '<input data-w inputmode="decimal" placeholder="масса, г">'+
      '<input data-k inputmode="decimal" placeholder="ккал/100г">'+
      '<input data-p inputmode="decimal" placeholder="Б/100г">'+
      '<input data-f inputmode="decimal" placeholder="Ж/100г">'+
      '<input data-c inputmode="decimal" placeholder="У/100г">'+
      '<b data-sub>—</b><button type="button" aria-label="Удалить">×</button>';
    rows.appendChild(r);
    const name=r.querySelector('[data-name]');let t=null;
    name.oninput=()=>{clearTimeout(t);t=setTimeout(()=>autofill(r),250)};
    name.onchange=()=>autofill(r);
    r.querySelectorAll('input:not([data-name])').forEach(i=>i.oninput=calc);
    r.querySelector('button').onclick=()=>{r.remove();calc()};
  };
  $('#addKbjuRow').onclick=add;add();add();
}
$$('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='chat'){openPanel('Спросить AI');renderChat()}if(a==='tasks')renderTasks();if(a==='analytics')renderAnalytics();if(a==='tools')renderTools()});
const dashRefresh=$('#dashboardRefresh');if(dashRefresh)dashRefresh.onclick=()=>{dashRefresh.classList.add('spin');refreshDashboard().finally(()=>setTimeout(()=>dashRefresh.classList.remove('spin'),450))};
const dashAsk=$('#dashboardAsk');if(dashAsk)dashAsk.onclick=()=>askAI('Дай мне краткий рабочий приоритет на сегодня с учётом моих задач и текущей аналитики. Один главный фокус и следующий шаг.');
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let micPermissionReady=false;
async function ensureMicrophonePermission(){
  if(micPermissionReady)return true;
  if(!navigator.mediaDevices?.getUserMedia){toast('Этот браузер не даёт сайту доступ к микрофону');return false}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    stream.getTracks().forEach(t=>t.stop());
    micPermissionReady=true;
    return true;
  }catch(err){
    const name=String(err?.name||'');
    if(/NotAllowed|Security/i.test(name))toast('Разреши микрофон для этого сайта в настройках браузера');
    else if(/NotFound/i.test(name))toast('Микрофон на устройстве не найден');
    else toast('Не удалось получить доступ к микрофону');
    return false;
  }
}
function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
    reader.onerror=()=>reject(reader.error||new Error('Не удалось прочитать запись'));
    reader.readAsDataURL(blob);
  });
}
async function transcribeBlob(blob,mimeType){
  const data=await blobToBase64(blob);
  const r=await fetch('/api/transcribe',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({data,mimeType:mimeType||blob.type||'audio/webm'}),
    signal:AbortSignal.timeout(35000)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||'Не удалось распознать голос');
  return String(d.text||'').trim();
}
async function runRecordedRecognition(button,onText){
  if(typeof MediaRecorder==='undefined'||!navigator.mediaDevices?.getUserMedia)return false;
  if(listeningNow)return true;
  let stream=null,recorder=null,stopTimer=null,chunks=[],finished=false,cancelled=false;
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported?.(t));
    recorder=preferred?new MediaRecorder(stream,{mimeType:preferred}):new MediaRecorder(stream);
    listeningNow=true;
    button?.classList.add('listening');
    if(button)button.setAttribute('aria-label','Слушаю');
    toast('Слушаю… говори');
    const finish=()=>new Promise(resolve=>{
      if(finished){resolve();return}
      finished=true;
      const done=()=>resolve();
      recorder.addEventListener('stop',done,{once:true});
      try{if(recorder.state!=='inactive')recorder.stop();else resolve()}catch{resolve()}
    });
    activeRecognition={abort:()=>{cancelled=true;clearTimeout(stopTimer);try{if(recorder&&recorder.state!=='inactive')recorder.stop()}catch{};try{stream?.getTracks().forEach(t=>t.stop())}catch{}}};
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
    recorder.start(250);
    recordingStop=()=>finish();
    toast('Записываю. Нажми микрофон ещё раз, чтобы закончить.');
    stopTimer=setTimeout(()=>finish(),60000);
    await new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
    clearTimeout(stopTimer);
    stream.getTracks().forEach(t=>t.stop());
    if(cancelled)return true;
    const blob=new Blob(chunks,{type:recorder.mimeType||preferred||'audio/webm'});
    if(blob.size<800){toast('Звук не записался — попробуй ещё раз');return true}
    toast('Распознаю…');
    const text=await transcribeBlob(blob,blob.type);
    if(text){
      toast('Услышал: '+text.slice(0,60));
      await onText(text);
    } else toast('Речь не распознана — попробуй говорить чуть громче');
    return true;
  }catch(err){
    try{stream?.getTracks().forEach(t=>t.stop())}catch{}
    const name=String(err?.name||'');
    if(/NotAllowed|Security/i.test(name))toast('Доступ к микрофону запрещён');
    else toast(err?.message||'Не удалось записать голос');
    return false;
  }finally{
    listeningNow=false;activeRecognition=null;recordingStop=null;
    button?.classList.remove('listening');
    if(button)button.setAttribute('aria-label','Ответить голосом');
  }
}
async function runWebSpeech(button,onText){
  if(!SR)return false;
  if(listeningNow)return true;
  return await new Promise(resolve=>{
    const r=new SR();
    activeRecognition=r;
    listeningNow=true;
    r.lang='ru-RU';r.interimResults=false;r.continuous=false;try{r.maxAlternatives=1}catch{}
    button?.classList.add('listening');
    if(button)button.setAttribute('aria-label','Слушаю');
    toast('Слушаю…');
    let got=false,settled=false;
    r.onresult=e=>{const t=(e.results?.[0]?.[0]?.transcript||'').trim();if(t){got=true;toast('Услышал');Promise.resolve(onText(t)).catch(()=>{})}};
    const done=ok=>{if(settled)return;settled=true;listeningNow=false;activeRecognition=null;button?.classList.remove('listening');if(button)button.setAttribute('aria-label','Ответить голосом');resolve(ok)};
    r.onend=()=>done(got);
    r.onerror=e=>{const code=String(e?.error||'');if(code==='aborted'){done(true);return}if(code==='no-speech'){toast('Речь не услышана. Нажмите микрофон и повторите.');done(true);return}if(code==='not-allowed'||code==='service-not-allowed'){toast('Разрешите голосовой ввод в настройках браузера');done(true);return}toast('Встроенный ввод недоступен — попробую запись');done(false)};
    try{r.start()}catch{done(false)}
  });
}
async function runRecognition(button,onText){
  if(listeningNow){if(recordingStop)recordingStop();else try{activeRecognition?.stop()}catch{};return}
  if(!(await ensureMicrophonePermission()))return;
  // На Android/Chrome сначала используем встроенное распознавание:
  // оно быстрее и не зависит от загрузки Gemini.
  if(SR){
    const webOk=await runWebSpeech(button,onText);
    if(webOk)return;
  }
  // Серверная расшифровка — только запасной путь.
  const recorded=await runRecordedRecognition(button,onText);
  if(!recorded)toast('Голосовой ввод не запустился. Попробуй ещё раз.');
}
function listenFromChat(button,input){
  unlockVoice();
  runRecognition(button,t=>{if(input)input.value=t;return askAI(t)});
}
function autoListen(){
  if(!handsFree||!panel?.open||listeningNow)return;
  const mic=$('#chatMic'),input=$('#chatInput');
  if(!mic||!input)return;
  if('speechSynthesis'in window&&speechSynthesis.speaking)return;
  listenFromChat(mic,input);
}
$('#micBtn').onclick=async()=>{
  unlockVoice();
  toast('Микрофон включается…');
  handsFree=true;
  if(!state.tts){state.tts=true;save();syncPanelVoice()}
  runRecognition($('#micBtn'),t=>{$('#askInput').value=t;return askAI(t)});
};
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&activeRecognition){try{activeRecognition.abort()}catch{}}
  else if(!document.hidden){refreshState();if(handsFree&&panel?.open)setTimeout(autoListen,700);}
});
window.addEventListener('online',()=>{toast('Интернет восстановлен');syncStateNow()});
window.addEventListener('offline',()=>toast('Нет сети — данные сохраняются на устройстве'));
const panelVoice=$('#panelVoice');
function syncPanelVoice(){if(panelVoice)panelVoice.textContent=state.tts?'🔊':'🔇'}
if(panelVoice){syncPanelVoice();panelVoice.onclick=()=>{unlockVoice();state.tts=!state.tts;save();syncPanelVoice();if(panel.open&&title.textContent==='Спросить AI')renderChat();toast(state.tts?'Голос включён':'Голос выключен');if(state.tts)setTimeout(()=>speak('Голос включён. Я готов.'),120)}}

updateDashboardLocal();refreshDashboard();bootstrapState();
const initial=new URLSearchParams(location.search).get('open');if(initial)setTimeout(()=>navigate(initial,false),0);


document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.open){handsFree=false;try{activeRecognition?.abort()}catch{}panel.close()}});
async function renderDocuments(){
  openPanel('Документы');body.innerHTML='<p>Загружаю документы…</p>';
  try{
    const r=await fetch('/api/documents'),d=await r.json();if(!r.ok)throw Error(d.error||'Ошибка загрузки');
    selectedDocuments=selectedDocuments.filter(id=>d.documents.some(doc=>doc.id===id));
    body.innerHTML='<p>Выберите до пяти документов для вопросов в чате. Ответы будут ссылаться на название и абзац.</p><div class="document-toolbar"><button id="documentUpload">Загрузить документ</button><button id="documentChat">Спросить по выбранным</button><input id="documentFile" type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,.xlsx" hidden></div><p class="tool-footnote">До 10 МБ. Для PDF-сканов нужен текстовый вариант. Документы сохраняются в хранилище ассистента.</p><div id="documentList">'+(d.documents.length?d.documents.map(doc=>'<div class="document-row"><label><input type="checkbox" data-doc-select="'+doc.id+'" '+(selectedDocuments.includes(doc.id)?'checked':'')+'><span>'+esc(doc.name)+'<small>'+new Date(doc.createdAt).toLocaleDateString('ru-RU')+' · '+Math.ceil(doc.size/1024)+' КБ</small></span></label><button data-doc-view="'+doc.id+'">Открыть</button><button data-doc-delete="'+doc.id+'">Удалить</button></div>').join(''):'<p>Документов пока нет.</p>')+'</div>';
    $('#documentUpload').onclick=()=>$('#documentFile').click();
    $('#documentFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>10*1024*1024)return toast('Максимум 10 МБ');const fd=new FormData();fd.append('file',file);const b=$('#documentUpload');b.disabled=true;b.textContent='Загружаю…';try{const r=await fetch('/api/documents',{method:'POST',body:fd,signal:AbortSignal.timeout(45000)}),d=await r.json();if(!r.ok)throw Error(d.error||'Не удалось загрузить');toast('Документ сохранён');renderDocuments()}catch(e){toast(e.message);b.disabled=false;b.textContent='Загрузить документ'}};
    $('#documentChat').onclick=()=>{if(!selectedDocuments.length)return toast('Выберите документ');navigate('chat');toast('Документов для ответа: '+selectedDocuments.length)};
    $('#documentList').onchange=e=>{const id=e.target.dataset.docSelect;if(!id)return;if(e.target.checked){if(selectedDocuments.length>=5){e.target.checked=false;return toast('Выберите не больше пяти документов')}selectedDocuments.push(id)}else selectedDocuments=selectedDocuments.filter(x=>x!==id)};
    $('#documentList').onclick=async e=>{const id=e.target.dataset.docView||e.target.dataset.docDelete;if(!id)return;try{if(e.target.dataset.docDelete){if(!confirm('Удалить документ из хранилища?'))return;const r=await fetch('/api/documents/'+id,{method:'DELETE'});if(!r.ok)throw Error('Не удалось удалить');selectedDocuments=selectedDocuments.filter(x=>x!==id);renderDocuments()}else{const r=await fetch('/api/documents/'+id),d=await r.json();if(!r.ok)throw Error(d.error);openPanel(d.document.name);body.innerHTML='<button class="tool-back" id="docBack">← Документы</button><pre class="document-preview">'+esc(d.document.text)+'</pre>';$('#docBack').onclick=renderDocuments}}catch(e){toast(e.message)}};
  }catch(e){body.innerHTML='<p>'+esc(e.message)+'</p>'}
}
async function enablePushNotifications(){
  try{
    if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('Push не поддерживается. На iPhone установите сайт на главный экран.');
    const r=await fetch('/api/push/status'),d=await r.json();if(!r.ok||!d.configured)throw Error('Серверная доставка пока не настроена. Нужны VAPID-ключи.');
    if(await Notification.requestPermission()!=='granted')throw Error('Разрешение на уведомления не выдано');
    const reg=await navigator.serviceWorker.ready;
    const base=d.publicKey.replace(/-/g,'+').replace(/_/g,'/');const decoded=atob(base+'='.repeat((4-base.length%4)%4));const key=Uint8Array.from(decoded,c=>c.charCodeAt(0));
    const subscription=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    const response=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription)});const result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось зарегистрировать');toast('Push включён. При остановке бесплатного сервера возможны задержки. Для независимых напоминаний используйте календарь.');
  }catch(e){toast(e.message)}
}
function navigate(section,push=true){
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===section));
  if(section!=='chat')stopConversation();
  if(push){const url=new URL(location.href);if(section==='home')url.searchParams.delete('open');else url.searchParams.set('open',section);history.pushState({section},'',url)}
  if(section==='home'){panel.close();window.scrollTo({top:0,behavior:'smooth'})}else if(section==='chat'){openPanel('Спросить AI');renderChat()}else if(section==='tasks')renderTasks();else if(section==='documents')renderDocuments();else if(section==='analytics')renderAnalytics();else if(section==='kitchen')renderKitchen();else if(section==='business')renderBusiness();else if(section==='cost')renderCostTool();else if(section==='newtask')taskEditor();else renderTools();
}
$$('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
$$('[data-action]').forEach(b=>b.onclick=()=>navigate(b.dataset.action));
window.addEventListener('popstate',()=>{const section=new URLSearchParams(location.search).get('open');navigate(section||'home',false)});
function renderSettings(){
  openPanel('Настройки');body.innerHTML='<form class="inline-form" id="settingsForm"><label>Часовой пояс<select name="zone"><option value="Europe/Moscow">Мурманск / Москва (UTC+3)</option><option value="'+esc(Intl.DateTimeFormat().resolvedOptions().timeZone)+'">По часовому поясу устройства</option></select></label><button>Сохранить</button></form><p>Сроки голосовых команд и даты задач используют выбранный часовой пояс.</p><button class="add-task" id="logoutOwner">Выйти</button>';
  $('#settingsForm').elements.zone.value=state.timeZone;$('#settingsForm').onsubmit=e=>{e.preventDefault();state.timeZone=e.target.elements.zone.value;localStorage.setItem('fai_timeZone',JSON.stringify(state.timeZone));save();toast('Настройки сохранены')};
  if(ownerSession?.passwordless){$('#logoutOwner').hidden=true;}
  $('#logoutOwner').onclick=async()=>{if(changeGeneration>savedGeneration&&!await syncStateNow())return toast('Сначала сохраните или скачайте изменения');await fetch('/api/auth/logout',{method:'POST'});for(const key of Object.keys(localStorage))if(key.startsWith('fai_'))localStorage.removeItem(key);location.reload()};
}
function taskEditor(index=null,draft=''){
  const existing=index===null?null:state.tasks[index],wall=existing?.due?zonedDate(new Date(existing.due),state.timeZone):null;
  const pad=n=>String(n).padStart(2,'0');const due=wall?wall.getFullYear()+'-'+pad(wall.getMonth()+1)+'-'+pad(wall.getDate())+'T'+pad(wall.getHours())+':'+pad(wall.getMinutes()):'';
  openPanel(existing?'Изменить задачу':'Новая задача');
  body.innerHTML='<form class="inline-form" id="taskEditor"><label>Задача<input name="text" required maxlength="500" value="'+esc(existing?.text||draft.slice(0,500))+'"></label><label>Дата и время · '+esc(state.timeZone)+'<input name="due" type="datetime-local" value="'+due+'"></label><label>Приоритет<select name="priority"><option value="normal">Обычная</option><option value="high">Важная</option></select></label><p>Без даты задача сохранится без напоминания.</p><div class="form-actions"><button>Сохранить</button><button type="button" id="cancelTaskEdit">Отмена</button></div><p id="taskError" role="alert"></p></form>';
  $('#taskEditor').elements.priority.value=existing?.priority||'normal';$('#cancelTaskEdit').onclick=renderTasks;
  $('#taskEditor').onsubmit=e=>{e.preventDefault();try{const f=e.target.elements,value=f.due.value;const task={...(existing||{}),id:existing?.id||crypto.randomUUID(),text:f.text.value.trim(),due:value?zonedToUtc(new Date(value),state.timeZone).toISOString():null,priority:f.priority.value,done:existing?.done||false,createdAt:existing?.createdAt||new Date().toISOString(),notifiedAt:null};if(!task.text)return;if(existing)state.tasks[index]=task;else state.tasks.unshift(task);save();renderTasks();toast('Задача сохранена')}catch(e){$('#taskError').textContent=e.message}};
}

// The hero CTA uses the existing voice flow; the portrait is a static visual.
const startConversation=document.querySelector('#startConversation');
if(startConversation)startConversation.onclick=()=>document.querySelector('#micBtn').click();

function stopConversation(){
  handsFree=false;
  if(activeRecognition){try{activeRecognition.abort()}catch{}}
  if('speechSynthesis' in window)speechSynthesis.cancel();
  updateVoiceState();
}
function updateVoiceState(){
  const speaking='speechSynthesis' in window&&speechSynthesis.speaking;
  const label=listeningNow?'Слушаю…':chatBusy?'Думаю…':speaking?'Отвечаю…':'Готова к разговору';
  const el=document.querySelector('#voiceState');if(el)el.textContent=label;
  const stop=document.querySelector('#stopConversation');if(stop)stop.disabled=!listeningNow&&!speaking&&!handsFree;
  const cta=document.querySelector('#startConversation');if(cta)cta.textContent=listeningNow?'Завершить запись':speaking?'Остановить голос':'Говорить';
}
setInterval(updateVoiceState,300);
if(startConversation)startConversation.onclick=()=>{
 if('speechSynthesis' in window&&speechSynthesis.speaking){stopConversation();return}
 document.querySelector('#micBtn').click();
};
function renderKitchen(){
 openPanel('Кухня');body.innerHTML='<p class="section-intro">Всё для расчётов и работы с блюдами.</p><div class="chef-tools-grid">'+toolCard('cost','Себестоимость','Стоимость порции по вашим ценам','₽')+toolCard('kbju','КБЖУ','Калории и пищевая ценность','K')+toolCard('ttk','Техкарта','Составить вместе с AI','▤')+toolCard('scale','Перерасчёт рецепта','Изменить количество порций','×')+toolCard('foodcost','Food cost','Доля себестоимости в цене','%')+'</div>';
 body.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>openChefTool(b.dataset.tool));
}
function renderBusiness(){
 openPanel('Бизнес');body.innerHTML='<p class="section-intro">Суши Бери · четыре точки. Отчёты и рабочие материалы.</p><div class="chef-tools-grid">'+toolCard('analytics','Продажи и отчёты','Frontpad и загрузка XLSX/CSV','▥')+toolCard('documents','Документы','Инструкции и рабочие файлы','▤')+toolCard('tasks','Задачи по точкам','Контроль выполнения','✓')+'</div>';
 body.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>navigate(b.dataset.tool));
}
panel.addEventListener('close',stopConversation);
