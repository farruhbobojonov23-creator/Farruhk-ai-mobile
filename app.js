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
function speak(text){
 if(!state.tts || !('speechSynthesis' in window) || !text) return;
 speechSynthesis.cancel();
 speechSynthesis.resume();
 const u=new SpeechSynthesisUtterance(String(text));
 u.lang='ru-RU';u.rate=.96;u.pitch=.96;u.volume=1;
 refreshVoices();
 const ru=ttsVoices.find(v=>v.lang&&v.lang.toLowerCase().startsWith('ru'))||ttsVoices.find(v=>v.default);
 if(ru)u.voice=ru;
 u.onerror=e=>console.warn('TTS error',e.error);
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
function listen(){
 unlockTTS();
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