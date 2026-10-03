const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const DEFAULT_KNOWLEDGE=`ПРОФИЛЬ
Фаррух Ака — бренд-шеф японской кухни.
Бренд: Суши Бери.
Город: Мурманск.
Рабочих точек: 4.

МЕНЮ И СТАНДАРТЫ
Во всех составах роллов обязательно указывать рис.
Меню A3: холодные роллы слева, запечённые справа, горизонтальный формат.
Фото блюд — свои, товар крупно, единый ракурс.
Ключевые направления: роллы, маки, темпура, воки, Бери доги, закуски, суши, гунканы.

ОПЕРАЦИИ
Контроль чистоты, маркировок, хранения и стандартов кухни.
Контроль персонала и чек-листов.
Закупки, поставщики и остатки.
Разработка новых блюд.

ПРОЕКТЫ
Меню A3.
Экраны в зале.
Шеф на дому.
Техкарты, КБЖУ и себестоимость.
Личный сайт и бренд.
Новые блюда и R&D.`;

const state={
  tasks:JSON.parse(localStorage.getItem('farrukh_mobile_tasks')||'null')||[
    {text:'Проверить чистоту и маркировки на точке №2',priority:'high',done:false},
    {text:'Проверить меню A3',priority:'high',done:false},
    {text:'Сверить закупки и остатки',priority:'normal',done:false}
  ],
  projects:JSON.parse(localStorage.getItem('farrukh_mobile_projects')||'null')||[
    'Меню A3: холодные + запечённые',
    'Экраны: контент для 3 мониторов',
    'Шеф на дому: японская кухня',
    'Техкарты: КБЖУ и себестоимость',
    'Личный сайт и бренд',
    'Новые блюда и R&D'
  ],
  knowledge:localStorage.getItem('farrukh_mobile_knowledge')||DEFAULT_KNOWLEDGE,
  chat:JSON.parse(localStorage.getItem('farrukh_mobile_chat')||'[]'),
  tts:JSON.parse(localStorage.getItem('farrukh_mobile_tts')??'true')
};
function save(){localStorage.setItem('farrukh_mobile_tasks',JSON.stringify(state.tasks));localStorage.setItem('farrukh_mobile_projects',JSON.stringify(state.projects));localStorage.setItem('farrukh_mobile_knowledge',state.knowledge);localStorage.setItem('farrukh_mobile_chat',JSON.stringify(state.chat));localStorage.setItem('farrukh_mobile_tts',JSON.stringify(state.tts))}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function show(name){$$('.screen').forEach(x=>x.classList.toggle('active',x.id===name));$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.screen===name))}
$$('.nav').forEach(b=>b.onclick=()=>show(b.dataset.screen));

function renderTasks(){
 $('#taskList').innerHTML=state.tasks.map((t,i)=>`<div class="task ${t.done?'done':''}"><div class="task-left"><input type="checkbox" data-check="${i}" ${t.done?'checked':''}><div><b>${esc(t.text)}</b><small>${t.priority==='high'?'Важная':'Обычная'}</small></div></div><button data-del="${i}">×</button></div>`).join('');
 save();
}
$('#taskList').addEventListener('change',e=>{if(e.target.dataset.check!==undefined){state.tasks[+e.target.dataset.check].done=e.target.checked;renderTasks()}});
$('#taskList').addEventListener('click',e=>{if(e.target.dataset.del!==undefined){state.tasks.splice(+e.target.dataset.del,1);renderTasks()}});
$('#addTask').onclick=()=>$('#taskModal').classList.add('show');
$('#cancelTask').onclick=()=>$('#taskModal').classList.remove('show');
$('#saveTask').onclick=()=>{const text=$('#taskText').value.trim();if(!text)return;state.tasks.unshift({text,priority:$('#taskPriority').value,done:false});$('#taskText').value='';$('#taskModal').classList.remove('show');renderTasks()};

const voicePresets={
 hero:{label:'Громовой герой',gender:'male',rate:0.86,pitch:0.72,sample:'Фаррух Ака, система готова. Все задачи под контролем.'},
 ai:{label:'Технологичный AI',gender:'male',rate:0.94,pitch:0.88,sample:'FARRUKH AI онлайн. Чем могу помочь сегодня?'},
 girl:{label:'Живая девушка',gender:'female',rate:1.02,pitch:1.08,sample:'Привет, Фаррух Ака. Я готова помочь с задачами, меню и проектами.'},
 velvet:{label:'Бархатная девушка',gender:'female',rate:0.90,pitch:0.98,sample:'Добрый вечер, Фаррух Ака. Я рядом и готова помочь с вашей работой.'}
};
let voicePreset=localStorage.getItem('farrukh_voice_preset')||'ai';

function getPreferredVoice(preset){
 const voices=speechSynthesis.getVoices();
 const ru=voices.filter(v=>v.lang&&v.lang.toLowerCase().startsWith('ru'));
 const all=ru.length?ru:voices;
 if(!all.length)return null;

 // Browser APIs don't expose gender reliably. Use common voice-name hints when available.
 const femaleHints=['female','alena','alyona','milena','irina','svetlana','victoria','anna','katya','natasha','julia','maria'];
 const maleHints=['male','maxim','yuri','pavel','alexander','dmitry','mikhail','nikolai'];
 const hints=preset.gender==='female'?femaleHints:maleHints;
 const found=all.find(v=>hints.some(h=>v.name.toLowerCase().includes(h)));
 return found||all[0];
}

function speakWithPreset(text,presetKey=voicePreset){
 if(!state.tts || !('speechSynthesis' in window) || !text)return;
 const preset=voicePresets[presetKey]||voicePresets.ai;
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text);
 u.lang='ru-RU';
 const customRate=parseFloat(localStorage.getItem('farrukh_voice_rate')||'0');
 u.rate=customRate||preset.rate;
 u.pitch=preset.pitch;
 const chosen=getPreferredVoice(preset);
 if(chosen)u.voice=chosen;
 speechSynthesis.speak(u);
}

function speak(text){
 speakWithPreset(text,voicePreset);
}

function updateVoiceUI(){
 document.querySelectorAll('.voice-card').forEach(card=>{
   const key=card.dataset.voicePreset;
   card.classList.toggle('selected',key===voicePreset);
   const btn=card.querySelector('.select-voice');
   if(btn){
     btn.classList.toggle('active',key===voicePreset);
     btn.textContent=key===voicePreset?'✓ Выбран':'Выбрать';
   }
 });
}

function initVoiceSettings(){
 document.querySelectorAll('[data-preview]').forEach(btn=>{
   btn.onclick=()=>{
     const key=btn.dataset.preview;
     const p=voicePresets[key];
     if(p)speakWithPreset(p.sample,key);
   };
 });
 document.querySelectorAll('[data-select]').forEach(btn=>{
   btn.onclick=()=>{
     voicePreset=btn.dataset.select;
     localStorage.setItem('farrukh_voice_preset',voicePreset);
     updateVoiceUI();
     const p=voicePresets[voicePreset];
     if(p)speakWithPreset(`Голос ${p.label} выбран.`,voicePreset);
   };
 });
 const slider=$('#voiceRate');
 const value=$('#voiceRateValue');
 if(slider){
   const saved=localStorage.getItem('farrukh_voice_rate');
   if(saved)slider.value=saved;
   if(value)value.textContent=Number(slider.value).toFixed(2)+'×';
   slider.oninput=e=>{
     localStorage.setItem('farrukh_voice_rate',e.target.value);
     if(value)value.textContent=Number(e.target.value).toFixed(2)+'×';
   };
 }
 updateVoiceUI();
 if('speechSynthesis' in window){
   speechSynthesis.getVoices();
   speechSynthesis.onvoiceschanged=()=>updateVoiceUI();
 }
}

function renderChat(){
 $('#messages').innerHTML=state.chat.map(m=>`<div class="msg ${m.role==='user'?'user':'ai'}">${esc(m.text)}</div>`).join('');
 $('#messages').scrollTop=$('#messages').scrollHeight;save();
}
async function askAI(text){
 if(!text.trim())return;
 state.chat.push({role:'user',text});renderChat();show('chat');
 state.chat.push({role:'ai',text:'Думаю…',temp:true});renderChat();
 try{
   const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      message:text,
      context:{
        tasks:state.tasks,
        projects:state.projects,
        app:{brand:'Суши Бери',points:4,role:'бренд-шеф японской кухни'},knowledge:state.knowledge
      }
    })});
   const d=await r.json();
   state.chat=state.chat.filter(x=>!x.temp);
   const reply=d.reply||d.error||'Нет ответа';
   state.chat.push({role:'ai',text:reply});renderChat();speak(reply);
 }catch(e){
   state.chat=state.chat.filter(x=>!x.temp);
   const reply='Сервер сейчас недоступен. После размещения приложения на сервере AI заработает здесь же.';
   state.chat.push({role:'ai',text:reply});renderChat();speak(reply);
 }
}
$('#sendBtn').onclick=()=>{const t=$('#msgInput').value;$('#msgInput').value='';askAI(t)};
$('#msgInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#sendBtn').click()}});
$$('[data-cmd]').forEach(b=>b.onclick=()=>askAI(b.dataset.cmd));

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function listen(){
 if(!SR){alert('Голосовой ввод лучше всего работает в Chrome на Android.');return}
 const r=new SR();r.lang='ru-RU';r.continuous=false;r.interimResults=false;
 $('#talkBtn').textContent='🎙 Слушаю...';
 r.onresult=e=>askAI(e.results[0][0].transcript);
 r.onend=()=>$('#talkBtn').textContent='🎙 Говорить';
 r.onerror=()=>$('#talkBtn').textContent='🎙 Говорить';
 r.start();
}
$('#talkBtn').onclick=listen;
$('#wakeBtn').onclick=listen;

function addIng(name='',g='',p=''){
 const row=document.createElement('div');row.className='ingredient';
 row.innerHTML=`<input placeholder="Продукт" value="${esc(name)}"><input class="g" type="number" placeholder="г" value="${g}"><input class="p" type="number" placeholder="₽/кг" value="${p}"><button>×</button>`;
 $('#ingredients').appendChild(row);row.querySelectorAll('input').forEach(x=>x.oninput=calc);row.querySelector('button').onclick=()=>{row.remove();calc()}
}
function calc(){
 let total=0;$$('.ingredient').forEach(r=>{total+=(+r.querySelector('.g').value||0)/1000*(+r.querySelector('.p').value||0)});
 $('#totalCost').textContent=total.toFixed(2).replace('.',',')+' ₽';
 const sale=+$('#salePrice').value||0;
 $('#foodCost').textContent=sale?((total/sale)*100).toFixed(1)+'%':'—';
 $('#margin').textContent=sale?(sale-total).toFixed(2)+' ₽':'—';
}
$('#addIng').onclick=()=>addIng();$('#salePrice').oninput=calc;
$('#askCost').onclick=()=>{const rows=[...$$('.ingredient')].map(r=>({name:r.children[0].value,grams:r.children[1].value,price:r.children[2].value}));askAI(`Блюдо: ${$('#dishName').value||'без названия'}. Ингредиенты: ${JSON.stringify(rows)}. Себестоимость: ${$('#totalCost').textContent}. Цена продажи: ${$('#salePrice').value||'не указана'} ₽. Проанализируй food cost и предложи диапазон цены.`)};


function renderAdmin(){
 const at=$('#adminTasks');
 if(at) at.innerHTML=state.tasks.map((t,i)=>`<div class="admin-item"><div class="meta"><b>${esc(t.text)}</b><span>${t.priority==='high'?'Важная':'Обычная'} • ${t.done?'Готово':'Активна'}</span></div><div class="actions"><button data-edit-task="${i}">✎</button><button data-del-task="${i}">×</button></div></div>`).join('');

 const ap=$('#adminProjects');
 if(ap) ap.innerHTML=state.projects.map((p,i)=>`<div class="admin-item"><div class="meta"><b>${esc(p)}</b><span>Проект</span></div><div class="actions"><button data-edit-project="${i}">✎</button><button data-del-project="${i}">×</button></div></div>`).join('');

 const ki=$('#knowledgeInput');
 if(ki) ki.value=state.knowledge;
}

if($('#adminTasks')){
 $('#adminTasks').addEventListener('click',e=>{
   if(e.target.dataset.delTask!==undefined){
     state.tasks.splice(+e.target.dataset.delTask,1);save();renderTasks();renderAdmin();
   }
   if(e.target.dataset.editTask!==undefined){
     const i=+e.target.dataset.editTask;
     const v=prompt('Измени задачу:',state.tasks[i].text);
     if(v&&v.trim()){state.tasks[i].text=v.trim();save();renderTasks();renderAdmin();}
   }
 });
}
if($('#adminProjects')){
 $('#adminProjects').addEventListener('click',e=>{
   if(e.target.dataset.delProject!==undefined){
     state.projects.splice(+e.target.dataset.delProject,1);save();renderAdmin();
   }
   if(e.target.dataset.editProject!==undefined){
     const i=+e.target.dataset.editProject;
     const v=prompt('Измени проект:',state.projects[i]);
     if(v&&v.trim()){state.projects[i]=v.trim();save();renderAdmin();}
   }
 });
}
if($('#adminAddTask')) $('#adminAddTask').onclick=()=>{
 const v=prompt('Новая задача:');
 if(v&&v.trim()){state.tasks.unshift({text:v.trim(),priority:'normal',done:false});save();renderTasks();renderAdmin();}
};
if($('#adminAddProject')) $('#adminAddProject').onclick=()=>{
 const v=prompt('Новый проект:');
 if(v&&v.trim()){state.projects.unshift(v.trim());save();renderAdmin();}
};
if($('#saveKnowledge')) $('#saveKnowledge').onclick=()=>{
 state.knowledge=$('#knowledgeInput').value.trim()||DEFAULT_KNOWLEDGE;
 save();renderAdmin();alert('База знаний сохранена.');
};
if($('#resetKnowledge')) $('#resetKnowledge').onclick=()=>{
 if(confirm('Вернуть базовую базу знаний?')){state.knowledge=DEFAULT_KNOWLEDGE;save();renderAdmin();}
};
if($('#addKnowledge')) $('#addKnowledge').onclick=()=>{
 const v=$('#quickKnowledge').value.trim();
 if(!v)return;
 state.knowledge=(state.knowledge.trim()+'\\n'+v).trim();
 $('#quickKnowledge').value='';
 save();renderAdmin();alert('Факт добавлен в базу знаний AI.');
};

$('#ttsToggle').checked=state.tts;$('#ttsToggle').onchange=e=>{state.tts=e.target.checked;save()};

async function status(){
 try{const r=await fetch('/api/status');const d=await r.json();$('#serverState').textContent='онлайн';$('#aiState').textContent=d.aiConnected?'подключён':'локальный режим'}catch(e){$('#serverState').textContent='не подключён';$('#aiState').textContent='—'}
}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true};

if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

const h=new Date().getHours();$('#greeting').textContent=h<12?'Доброе утро, Фаррух Ака':h<18?'Добрый день, Фаррух Ака':'Добрый вечер, Фаррух Ака';
addIng('Рис готовый',80,0);addIng('Лосось',40,0);addIng('Сыр',30,0);
renderTasks();renderChat();renderAdmin();status();initVoiceSettings();
