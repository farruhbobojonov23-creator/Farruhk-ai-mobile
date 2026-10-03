const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const state={
  tasks:JSON.parse(localStorage.getItem('farrukh_mobile_tasks')||'null')||[
    {text:'Проверить чистоту и маркировки на точке №2',priority:'high',done:false},
    {text:'Проверить меню A3',priority:'high',done:false},
    {text:'Сверить закупки и остатки',priority:'normal',done:false}
  ],
  chat:JSON.parse(localStorage.getItem('farrukh_mobile_chat')||'[]'),
  tts:JSON.parse(localStorage.getItem('farrukh_mobile_tts')??'true')
};
function save(){localStorage.setItem('farrukh_mobile_tasks',JSON.stringify(state.tasks));localStorage.setItem('farrukh_mobile_chat',JSON.stringify(state.chat));localStorage.setItem('farrukh_mobile_tts',JSON.stringify(state.tts))}
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

let ttsVoices=[];
function refreshVoices(){
 if('speechSynthesis' in window) ttsVoices=speechSynthesis.getVoices()||[];
}
function unlockTTS(){
 if(!state.tts || !('speechSynthesis' in window)) return;
 try{
   speechSynthesis.resume();
   const u=new SpeechSynthesisUtterance(' ');
   u.volume=0;u.lang='ru-RU';
   speechSynthesis.speak(u);
   setTimeout(()=>speechSynthesis.cancel(),60);
 }catch(e){}
}
if('speechSynthesis' in window){
 refreshVoices();
 speechSynthesis.onvoiceschanged=refreshVoices;
}
function speak(text,onDone){
 if(!state.tts || !('speechSynthesis' in window) || !text){if(onDone)onDone();return}
 speechSynthesis.cancel();
 speechSynthesis.resume();
 const u=new SpeechSynthesisUtterance(String(text));
 u.lang='ru-RU';u.rate=.96;u.pitch=.96;u.volume=1;
 refreshVoices();
 const ru=ttsVoices.find(v=>v.lang&&v.lang.toLowerCase().startsWith('ru'))||ttsVoices.find(v=>v.default);
 if(ru)u.voice=ru;
 let finished=false;
 const done=()=>{if(finished)return;finished=true;if(onDone)onDone()};
 u.onend=done;
 u.onerror=e=>{console.warn('TTS error',e.error);done()};
 setTimeout(()=>{speechSynthesis.resume();speechSynthesis.speak(u)},80);
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
   const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
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
$('#sendBtn').onclick=()=>{unlockTTS();const t=$('#msgInput').value;$('#msgInput').value='';askAI(t)};
$('#msgInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#sendBtn').click()}});
$('[data-cmd]').forEach(b=>b.onclick=()=>{unlockTTS();askAI(b.dataset.cmd)});

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let wakeRecognition=null;
let commandRecognition=null;
let wakeEnabled=true;
let commandActive=false;
let wakeRestartTimer=null;

function setWakeUI(mode){
 const btn=$('#wakeBtn');
 if(!btn)return;
 if(mode==='listening'){btn.textContent='🟢';btn.title='Ведьма слушает ключевое слово';}
 else if(mode==='command'){btn.textContent='🎙';btn.title='Ведьма слушает команду';}
 else {btn.textContent='⚪';btn.title='Нажмите, чтобы включить Ведьму';}
}

function stopWakeRecognition(){
 clearTimeout(wakeRestartTimer);
 if(wakeRecognition){
   const r=wakeRecognition;
   wakeRecognition=null;
   try{r.onend=null;r.stop()}catch(e){}
 }
}

function scheduleWakeRestart(delay=500){
 clearTimeout(wakeRestartTimer);
 if(wakeEnabled&&!commandActive&&!document.hidden){
   wakeRestartTimer=setTimeout(startWakeListener,delay);
 }
}

function startWakeListener(){
 if(!SR||!wakeEnabled||commandActive||document.hidden||wakeRecognition)return;
 const r=new SR();
 wakeRecognition=r;
 r.lang='ru-RU';
 r.continuous=true;
 r.interimResults=true;
 setWakeUI('listening');
 r.onresult=e=>{
   for(let i=e.resultIndex;i<e.results.length;i++){
     const heard=(e.results[i][0].transcript||'').toLowerCase().trim();
     if(/(^|\s)(ведьма|ведма)(\s|$|[,.!?])/.test(heard)){
       stopWakeRecognition();
       activateWitch();
       return;
     }
   }
 };
 r.onerror=e=>{
   wakeRecognition=null;
   if(e.error==='not-allowed'||e.error==='service-not-allowed'){
     wakeEnabled=false;
     setWakeUI('off');
   }else{
     scheduleWakeRestart(900);
   }
 };
 r.onend=()=>{
   if(wakeRecognition===r)wakeRecognition=null;
   scheduleWakeRestart(500);
 };
 try{r.start()}catch(e){wakeRecognition=null;scheduleWakeRestart(900)}
}

function startCommandListening(){
 if(!SR)return;
 stopWakeRecognition();
 commandActive=true;
 setWakeUI('command');
 const r=new SR();
 commandRecognition=r;
 r.lang='ru-RU';
 r.continuous=false;
 r.interimResults=false;
 let gotResult=false;
 r.onresult=e=>{
   gotResult=true;
   const text=e.results[0][0].transcript.trim();
   commandActive=false;
   commandRecognition=null;
   if(text)askAI(text).finally(()=>scheduleWakeRestart(700));
   else scheduleWakeRestart(500);
 };
 r.onerror=()=>{
   commandActive=false;
   commandRecognition=null;
   setWakeUI('listening');
   scheduleWakeRestart(700);
 };
 r.onend=()=>{
   if(commandRecognition===r){
     commandRecognition=null;
     commandActive=false;
     if(!gotResult)scheduleWakeRestart(500);
   }
 };
 try{r.start()}catch(e){commandActive=false;commandRecognition=null;scheduleWakeRestart(700)}
}

function activateWitch(){
 commandActive=true;
 setWakeUI('command');
 unlockTTS();
 speak('Я слушаю.',()=>{
   commandActive=false;
   startCommandListening();
 });
}

function listen(){
 unlockTTS();
 if(!SR){alert('Голосовой ввод лучше всего работает в Chrome на Android.');return}
 stopWakeRecognition();
 commandActive=true;
 const r=new SR();commandRecognition=r;
 r.lang='ru-RU';r.continuous=false;r.interimResults=false;
 $('#talkBtn').textContent='🎙 Слушаю...';
 r.onresult=e=>{
   commandActive=false;commandRecognition=null;
   askAI(e.results[0][0].transcript).finally(()=>scheduleWakeRestart(700));
 };
 r.onend=()=>{
   $('#talkBtn').textContent='🎙 Говорить';
   if(commandRecognition===r){commandRecognition=null;commandActive=false;scheduleWakeRestart(500)}
 };
 r.onerror=()=>{$('#talkBtn').textContent='🎙 Говорить';commandRecognition=null;commandActive=false;scheduleWakeRestart(700)};
 r.start();
}
$('#talkBtn').onclick=listen;
$('#wakeBtn').onclick=()=>{
 unlockTTS();
 wakeEnabled=!wakeEnabled;
 if(wakeEnabled){setWakeUI('listening');startWakeListener()}
 else{stopWakeRecognition();setWakeUI('off')}
};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)stopWakeRecognition();
 else scheduleWakeRestart(300);
});
setTimeout(()=>startWakeListener(),1200);

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
renderTasks();renderChat();status();