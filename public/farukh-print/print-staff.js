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
let paired=localStorage.getItem(MANAGED)==='1',staff=null,busy=false,session='';
try{session=sessionStorage.getItem(SESSION)||''}catch{}
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
 if(!paired||!session)return;
 try{
  const result=await call('/session');
  staff=result.staff;tell('Можно печатать утверждённые этикетки для точки «'+staff.point+'».');
 }catch(e){
  staff=null;session='';try{sessionStorage.removeItem(SESSION)}catch{}
  tell('Требуется вход сотрудника: '+e.message,true);
 }
 paint();
}
async function signin(e){
 e.preventDefault();if(busy)return;
 busy=true;submit.disabled=true;
 try{
  const name=login.value.trim().toLowerCase();
  const data=await call('/login',{method:'POST',body:JSON.stringify({login:name,password:password.value})});
  session=data.session;try{sessionStorage.setItem(SESSION,session)}catch{}
  staff=data.staff;login.value='';password.value='';
  tell('Вход выполнен. Печать доступна только на точке «'+staff.point+'».');
 }catch(e){password.value='';tell(e.message,true)}
 finally{busy=false;paint()}
}
async function signout(){
 try{if(session&&deviceToken())await call('/logout',{method:'POST',body:'{}'})}catch{}
 session='';staff=null;try{sessionStorage.removeItem(SESSION)}catch{}
 tell('Выход выполнен. Для печати войди под своим логином.');paint();
}
form.addEventListener('submit',signin);logout.onclick=signout;
const API={
 setPaired(value){
  if(value)localStorage.setItem(MANAGED,'1');
  const prior=paired;paired=localStorage.getItem(MANAGED)==='1';
  paint();
  if(paired&&!prior)void recheck();
 },
 loggedIn:()=>!!staff,
 point:()=>staff?.point||'',
 async authorize(job){
  if(localStorage.getItem(MANAGED)!=='1')return {ok:true,unmanaged:true};
  if(!staff||!session)throw Error('Сначала войди как сотрудник на панели «Доступ сотрудников» вверху страницы.');
  const product=job.product;
  if(!product?.id)throw Error('Выбери товар для печати.');
  try{
   const result=await call('/authorize-print',{
    method:'POST',body:JSON.stringify({
     productId:product.id,copies:job.copies,point:staff.point,
     printedAt:new Date(job.dateValue).toISOString()
    })
   });
   return result;
  }catch(e){
   if(e.status===401||e.status===403){
    staff=null;session='';try{sessionStorage.removeItem(SESSION)}catch{}
    tell('Доступ к печати закрыт: '+e.message,true);paint();
   }
   throw e;
  }
 }
};
window.FARUKH_PRINT_STAFF_API=API;
paint();if(paired)void recheck();
})();
