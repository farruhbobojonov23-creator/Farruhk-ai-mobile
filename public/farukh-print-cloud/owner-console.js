/* FARUKH PRINT Cloud owner console — PIN-only test UI.
   The PIN stays on the Render server and is never embedded in this public script.
   Catalog editing remains disabled until the Neon bridge has been tested. */
const $=id=>document.getElementById(id);
async function api(path,payload){
 const req={method:payload===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store'};
 if(payload!==undefined){req.headers={'Content-Type':'application/json'};req.body=JSON.stringify(payload);}
 const r=await fetch('/api/owner/'+path,req);
 let data={};try{data=await r.json()}catch{throw Error('Неверный ответ сервера.')}
 if(!r.ok||data.ok===false)throw Error(data.error||'Ошибка соединения: '+r.status);
 return data;
}
function show(which){for(const x of ['loading','entry','dashboard'])$(x).hidden=x!==which;}
function note(text,type=''){$('login-note').textContent=text;$('login-note').dataset.type=type;}
async function init(){
 try{
  const s=await api('session');
  show(s.authorized?'dashboard':'entry');
 }catch(e){show('entry');note(e.message,'error');}
 $('pin-form').addEventListener('submit',async(event)=>{
  event.preventDefault();
  const pin=$('pin').value;
  if(!/^\d{5,12}$/.test(pin))return note('Код должен содержать от 5 до 12 цифр.','error');
  $('enter').disabled=true;note('Проверяю код…');
  try{const response=await api('pin',{pin});$('pin').value='';if(!response.authorized)throw Error('Код не подтверждён.');
   show('dashboard');$('owner-note').textContent='✓ Вход подтверждён. На этом устройстве открыт защищённый доступ.';}
  catch(e){$('pin').value='';note(e.message,'error');}
  finally{$('enter').disabled=false;}
 });
 $('logout').addEventListener('click',async()=>{
  try{await api('logout',{})}catch{}
  show('entry');note('Сеанс завершён. Для нового входа введи код.');
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
