// Employee access gate for managed FARUKH PRINT devices.
// A paired kitchen device never bypasses this gate when offline or revoked.
// Only owner-managed local installs (paired before) require staff credentials;
// unpaired personal installations retain their existing offline behavior.
(()=>{
'use strict';
const DEV='farukh-print:device:v1',MANAGED='farukh-print:staff-managed:v1',SESSION='farukh-print:staff-session:v1';
const base='/api/farukh-print/device/staff';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const root=document.querySelector('.app'),head=root?.querySelector('.header');
if(!root||!head)return;
let paired=localStorage.getItem(MANAGED)==='1',staff=null,busy=false,session='',rechecking=false;
try{
 session=localStorage.getItem(SESSION)||sessionStorage.getItem(SESSION)||'';
 if(session)localStorage.setItem(SESSION,session);
 sessionStorage.removeItem(SESSION);
}catch{}
const panel=el('section','staff-login');panel.hidden=!paired;
const top=el('div','staff-login-top');const heading=el('strong','','Доступ сотрудников');const badge=el('span','staff-badge','Вход не выполнен');top.append(heading,badge);
const info=el('p','','На подключённых устройствах доступна только печать. Войди под личным логином и паролем, полученным у управляющего.');
const form=el('form','staff-login-form');
const login=el('input');login.placeholder='Логин сотрудника';login.autocapitalize='none';login.autocomplete='username';login.maxLength=32;
const password=el('input');password.type='password';password.placeholder='Пароль';password.autocomplete='current-password';password.maxLength=180;
const submit=el('button','','Войти');submit.type='submit';form.append(login,password,submit);
const sessionText=el('p','staff-session-info','');
const logout=el('button','staff-logout','Выйти');logout.type='button';
const notice=el('p','staff-notice');notice.setAttribute('role','status');
panel.append(top,info,form,sessionText,logout,notice);
head.after(panel);
function deviceToken(){try{return JSON.parse(localStorage.getItem(DEV)||'null')?.token||''}catch{return ''}}
const tell=(msg,error=false)=>{notice.textContent=msg;notice.dataset.error=error?'yes':'no'};
function paint(){
 paired=localStorage.getItem(MANAGED)==='1';
 panel.hidden=!paired;
 form.hidden=!paired||!!staff;logout.hidden=!paired||!staff;sessionText.hidden=!paired||!staff;
 badge.textContent=staff?'● '+staff.name:'○ Вход обязателен';
 badge.dataset.active=staff?'yes':'no';
 if(staff){sessionText.textContent='Точка: '+staff.point+' · Только печать';
  const point=document.getElementById('point-name');
  if(point){point.value=staff.point;point.readOnly=true;point.title='Точка назначена в FARUKH AI';}
 }else{
  const point=document.getElementById('point-name');if(point){point.value='';point.readOnly=paired}
 }
 submit.disabled=busy;
 // Keep the employee print workspace synchronized after login/logout/expiry.
 window.dispatchEvent(new CustomEvent('farukh-print-staff-changed',{detail:{
  managed:paired,
  staff:staff?{name:staff.name,point:staff.point,login:staff.login}:null
 }}));
}
async function call(path,opts={}){
 const device=deviceToken();
 if(!device)throw Error('Устройство отключено от управляющего центра. Обратись к владельцу.');
 const headers={'Content-Type':'application/json','X-Farukh-Print-Device':device};
 if(session)headers['X-Farukh-Print-Staff']=session;
 const r=await fetch(base+path,{credentials:'same-origin',cache:'no-store',...opts,headers});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(data.error||'Не удалось проверить доступ.'),{status:r.status});
 return data;
}
async function recheck(){
 if(!paired||!session||rechecking||busy)return;
 rechecking=true;
 try{
  const result=await call('/session');
  staff=result.staff;tell('Можно печатать утверждённые этикетки для точки «'+staff.point+'».');void flushResults();
 }catch(e){
  staff=null;
  if(e.status===401||e.status===403){
   session='';try{localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION)}catch{}
   tell('Требуется вход сотрудника: '+e.message,true);
  }else tell('Сохранённый вход проверится автоматически после восстановления связи. '+e.message,true);
 }finally{rechecking=false}
 paint();
}
async function signin(e){
 e.preventDefault();if(busy)return;
 busy=true;submit.disabled=true;
 try{
  const name=login.value.trim().toLowerCase();
  const data=await call('/login',{method:'POST',body:JSON.stringify({login:name,password:password.value})});
  session=data.session;try{localStorage.setItem(SESSION,session);sessionStorage.removeItem(SESSION)}catch{}
  staff=data.staff;login.value='';password.value='';
  tell('Вход сохранён до нажатия «Выйти» или отключения доступа владельцем.');void flushResults();
 }catch(e){if(e.status===401||e.status===403)password.value='';tell(e.message,true)}
 finally{busy=false;paint()}
}
async function signout(){
 try{if(session&&deviceToken())await call('/logout',{method:'POST',body:'{}'})}catch{}
 session='';staff=null;try{localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION)}catch{}
 tell('Выход выполнен. Для печати войди под своим логином.');paint();
}
form.addEventListener('submit',signin);logout.onclick=signout;
const RESULT_QUEUE='farukh-print:result-queue:v1';
const pendingResults=()=>{
 try{const list=JSON.parse(localStorage.getItem(RESULT_QUEUE)||'[]');return Array.isArray(list)?list.slice(-40):[]}
 catch{return []}
};
async function flushResults(){
 if(!staff||!session)return;
 const list=pendingResults(),rest=[];
 for(const entry of list){
  try{await call('/print-result',{method:'POST',body:JSON.stringify(entry)})}
  catch(e){if(![400,403,404].includes(e.status))rest.push(entry)}
 }
 try{localStorage.setItem(RESULT_QUEUE,JSON.stringify(rest))}catch{}
}
const API={
 setPaired(value){
  if(value)localStorage.setItem(MANAGED,'1');
  const prior=paired;paired=localStorage.getItem(MANAGED)==='1';
  paint();
  if(paired&&!prior)void recheck();
 },
 loggedIn:()=>!!staff,
 login:()=>staff?.login||'',
 point:()=>staff?.point||'',
 async reportPrint(eventId,result,details=''){
  if(!eventId||!['sent','failed','system'].includes(result))return;
  const entry={eventId,result,details:String(details).slice(0,160)};
  try{await call('/print-result',{method:'POST',body:JSON.stringify(entry)});}
  catch(e){
   if(![400,403,404].includes(e.status)){
    const records=pendingResults();records.push(entry);
    try{localStorage.setItem(RESULT_QUEUE,JSON.stringify(records.slice(-40)))}catch{}
   }
  }
 },
 async authorize(job){
  if(localStorage.getItem(MANAGED)!=='1')return {ok:true,unmanaged:true};
  if(!staff||!session)throw Error('Сначала войди как сотрудник на панели «Доступ сотрудников» вверху страницы.');
  const product=job.product;
  if(!product?.id)throw Error('Выбери товар для печати.');
  try{
   const revision=window.FARUKH_PRINT_DEVICE_SYNC?.state().revision;
   if(!Number.isSafeInteger(revision)||revision<0)throw Error('Каталог ещё не загружен из FARUKH AI. Нажми «Обновить товары» и повтори.');
   const result=await call('/authorize-print',{
    method:'POST',body:JSON.stringify({
     productId:product.id,copies:job.copies,point:staff.point,
     printedAt:new Date(job.dateValue).toISOString(),catalogRevision:revision
    })
   });
   return result;
  }catch(e){
   if(e.status===401||(e.status===403&&/Доступ устройства отключён|Устройство не подключено/.test(e.message))){
    staff=null;session='';try{localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION)}catch{}
    tell('Доступ к печати закрыт: '+e.message,true);paint();
   }
   throw e;
  }
 }
};
window.FARUKH_PRINT_STAFF_API=API;
paint();if(paired)void recheck();
window.addEventListener('online',()=>{if(paired&&!staff)void recheck()});
setInterval(()=>{if(document.visibilityState!=='hidden'){if(paired&&session&&!staff)void recheck();void flushResults()}},30_000);
})();
