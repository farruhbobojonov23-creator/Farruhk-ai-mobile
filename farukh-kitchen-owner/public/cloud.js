'use strict';
/*
 FARUKH KITCHEN optional Supabase owner sync.
 Existing recipe editor and browser-local data remain unchanged.
 Public publishable key is safe in frontend: actual access is enforced by RLS + owner claim.
*/
const FK_CLOUD_URL='https://rwvljbgsqnabvzmoaxgg.supabase.co';
const FK_CLOUD_KEY='sb_publishable_VD-jbYP5drGWQneUwaGytA_u-OWJclT';
const FK_CLOUD_SESSION_KEY='fk_kitchen_sb_session_v01';
let fkCloudSession=null, fkCloudAuthorized=false, fkCloudBusy=false;
try{fkCloudSession=JSON.parse(sessionStorage.getItem(FK_CLOUD_SESSION_KEY)||'null')}catch{}
const fkCloudEls=()=>document.getElementById('fk-cloud');
function fkCloudMessage(s,type='info'){
 const el=document.getElementById('fk-cloud-status');if(!el)return;
 el.textContent=s;el.dataset.type=type;
}
function fkCloudView(){
 const box=fkCloudEls();if(!box)return;
 const logged=fkCloudSession?.access_token&&fkCloudAuthorized;
 const email=logged?String(fkCloudSession?.user?.email||''):null;
 const area=document.getElementById('fk-cloud-logged');
 const form=document.getElementById('fk-cloud-auth');
 if(area)area.hidden=!logged;
 if(form)form.hidden=!!logged;
 document.getElementById('fk-cloud-identity').textContent=email||'Личный аккаунт';
}
function fkCloudMount(){
 if(state.page!=='settings'||!document.getElementById('main')||fkCloudEls())return;
 const root=document.createElement('section');root.id='fk-cloud';root.className='fk-cloud-panel';
 root.innerHTML=`<div class="eyebrow">ОБЛАЧНАЯ БАЗА · SUPABASE</div><h2>☁️ Синхронизация ТТК</h2>
 <p>Редактор остался прежним. После подключения облако позволит переносить собственные рецептуры между телефоном и компьютером. <b>Ничего не переносится и не стирается автоматически.</b></p>
 <div id="fk-cloud-status" class="fk-cloud-note" role="status" aria-live="polite">Для начала войдите в личный аккаунт Supabase.</div>
 <form id="fk-cloud-auth" class="fk-cloud-fields" autocomplete="on">
 <label>Электронная почта<input name="email" type="email" autocomplete="email" required placeholder="Ваша почта"></label>
 <label>Пароль Supabase<input name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="От 8 символов"></label>
 <div class="fk-cloud-actions"><button type="submit" data-mode="signin" class="main-button">Войти в облако</button>
 <button type="submit" data-mode="signup" class="outline">Создать облачный аккаунт</button></div>
 <small>Это отдельный вход для безопасного хранения. После создания аккаунта подтвердите адрес через письмо Supabase.</small>
 </form>
 <div id="fk-cloud-logged" hidden><div class="fk-cloud-identity">✓ Подключено: <strong id="fk-cloud-identity"></strong></div>
 <div class="fk-cloud-actions"><button type="button" id="fk-cloud-upload" class="main-button">↑ Сохранить ТТК в облако</button>
 <button type="button" id="fk-cloud-download" class="outline">↓ Загрузить из облака</button>
 <button type="button" id="fk-cloud-logout" class="outline">Выйти из облака</button></div>
 <small>Загрузка из облака объединяет записи по ID. Существующие не затронутые записи останутся. Для страховки сначала скачайте JSON.</small></div>
 </section>`;
 document.getElementById('main').appendChild(root);
 fkCloudView();
 if(fkCloudSession?.access_token)fkCloudCheck().catch(()=>{});
}
function fkCloudHeaders(token,extra={}){
 return {'apikey':FK_CLOUD_KEY,'Authorization':'Bearer '+(token||FK_CLOUD_KEY),...extra};
}
async function fkCloudFetch(path,{method='GET',payload=null,prefer=''}={}){
 const token=fkCloudSession?.access_token;
 if(!token)throw Error('Сначала выполните вход в Supabase');
 const headers=fkCloudHeaders(token,{'Content-Type':'application/json'});
 if(prefer)headers.Prefer=prefer;
 let res=await fetch(FK_CLOUD_URL+path,{method,headers,body:payload===null?undefined:JSON.stringify(payload)});
 if(res.status===401&&fkCloudSession?.refresh_token){
  await fkCloudRefresh();headers.Authorization='Bearer '+fkCloudSession.access_token;
  res=await fetch(FK_CLOUD_URL+path,{method,headers,body:payload===null?undefined:JSON.stringify(payload)});
 }
 if(!res.ok){
  const error=await res.json().catch(()=>({}));
  throw Error(String(error.msg||error.error_description||error.message||'Ошибка облака: HTTP '+res.status).slice(0,200));
 }
 const body=await res.text();return body?JSON.parse(body):null;
}
function fkCloudRemember(data){
 if(!data?.access_token||!data?.refresh_token)throw Error('Не удалось получить сессию Supabase');
 fkCloudSession={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user||fkCloudSession?.user||null};
 sessionStorage.setItem(FK_CLOUD_SESSION_KEY,JSON.stringify(fkCloudSession));
}
async function fkCloudRefresh(){
 const refresh=fkCloudSession?.refresh_token;if(!refresh)throw Error('Сессия истекла');
 const response=await fetch(FK_CLOUD_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',
  headers:fkCloudHeaders(null,{'Content-Type':'application/json'}),body:JSON.stringify({refresh_token:refresh})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.msg||data.error_description||'Войдите снова');
 fkCloudRemember(data);
}
async function fkCloudLogin(mode){
 if(fkCloudBusy)return;
 const form=document.getElementById('fk-cloud-auth'),email=form.querySelector('[name=email]').value.trim().toLowerCase(),password=form.querySelector('[name=password]').value;
 if(!email||password.length<8)return fkCloudMessage('Введите почту и пароль не короче 8 символов','error');
 fkCloudBusy=true;fkCloudMessage(mode==='signup'?'Создаём аккаунт…':'Проверяем доступ…');
 try{
  const route=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
  const response=await fetch(FK_CLOUD_URL+route,{method:'POST',
    headers:fkCloudHeaders(null,{'Content-Type':'application/json'}),
    body:JSON.stringify({email,password})});
  const data=await response.json().catch(()=>({}));
  form.querySelector('[name=password]').value='';
  if(!response.ok)throw Error(String(data.msg||data.error_description||data.message||'Ошибка входа').slice(0,200));
  if(!data.access_token){fkCloudMessage('Письмо для подтверждения отправлено. Подтвердите почту и нажмите «Войти в облако».');return}
  fkCloudRemember(data);
  await fkCloudCheck();
 }catch(e){fkCloudMessage(e.message,'error')}
 finally{fkCloudBusy=false}
}
async function fkCloudCheck(){
 const user=await fkCloudFetch('/auth/v1/user');
 if(!user?.id)throw Error('Сессия недействительна');
 fkCloudSession.user=user;
 const rows=await fkCloudFetch('/rest/v1/fk_admins?select=user_id&user_id=eq.'+encodeURIComponent(user.id));
 if(!Array.isArray(rows)||!rows.length){
  const proof=await fetch('/api/claim-code',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null);
  if(proof?.bootstrapToken){
   const response=await fkCloudFetch('/rest/v1/rpc/fk_claim_first_owner',{method:'POST',payload:{p_token:proof.bootstrapToken}});
   if(response!==true)throw Error('Первичный доступ владельца не подтверждён');
  }else throw Error('Этот аккаунт ещё не одобрен как владелец базы');
 }
 fkCloudAuthorized=true;fkCloudView();fkCloudMessage('✓ Личный доступ подтверждён. Можно синхронизировать ТТК.','success');
}
async function fkCloudPush(){
 if(fkCloudBusy||!fkCloudAuthorized)return;const count=state.records.length;
 if(!count)return fkCloudMessage('Сначала создайте хотя бы одну ТТК.','error');
 if(count>500)return fkCloudMessage('Лимит 500 документов за одну синхронизацию.','error');
 if(!confirm('Сохранить '+count+' локальных ТТК в Supabase? Если ID совпадают, облачные версии будут заменены. Другие рецептуры в облаке не удаляются.'))return;
 fkCloudBusy=true;
 try{
  fkCloudMessage('Отправка данных…');const uid=fkCloudSession.user.id;
  for(let n=0;n<count;n+=5){
   const batch=state.records.slice(n,n+5).map(record=>{
    if(!record?.id||!record?.name)throw Error('Обнаружена неполная карта; отмена синхронизации');
    const bytes=JSON.stringify(record);
    if(bytes.length>800000)throw Error('Слишком большой документ для синхронизации: '+record.name);
    return {owner_id:uid,local_id:String(record.id).slice(0,120),payload:record};
   });
   await fkCloudFetch('/rest/v1/fk_draft_snapshots?on_conflict=owner_id,local_id',{
    method:'POST',payload:batch,prefer:'resolution=merge-duplicates,return=minimal'});
   fkCloudMessage('Сохранено '+Math.min(n+5,count)+' из '+count+'…');
  }
  fkCloudMessage('✓ В облаке сохранено '+count+' ТТК. На другом устройстве войдите в этот же аккаунт и нажмите «Загрузить из облака».','success');
 }catch(e){fkCloudMessage('Ошибка: '+e.message+'. Локальные карты не изменены.','error')}
 finally{fkCloudBusy=false}
}
async function fkCloudPull(){
 if(fkCloudBusy||!fkCloudAuthorized)return;
 fkCloudBusy=true;
 try{
  fkCloudMessage('Читаем облачные ТТК…');
  const rows=await fkCloudFetch('/rest/v1/fk_draft_snapshots?select=local_id,payload,changed_at&order=changed_at.desc&limit=500');
  if(!Array.isArray(rows))throw Error('Ошибка ответа базы');
  const good=rows.filter(x=>x.payload&&typeof x.payload==='object'&&typeof x.payload.id==='string'&&typeof x.payload.name==='string');
  if(!good.length){fkCloudMessage('В облаке пока нет ТТК.','info');return}
  if(!confirm('Получено '+good.length+' ТТК. Создать JSON-резервную копию перед объединением и загрузить записи? Совпадающие ID будут взяты из облака.'))return;
  exportJson(); // Always back up the device before merging.
  const originals=state.records.slice(),byId=new Map(originals.map(x=>[x.id,x]));
  for(const r of good)byId.set(r.payload.id,r.payload);
  state.records=[...byId.values()];
  if(!keep()){state.records=originals;return}
  render();fkCloudMessage('✓ Загружено '+good.length+' облачных ТТК. Объединено записей: '+state.records.length,'success');
 }catch(e){fkCloudMessage('Ошибка: '+e.message,'error')}
 finally{fkCloudBusy=false}
}
function fkCloudLogout(){
 sessionStorage.removeItem(FK_CLOUD_SESSION_KEY);
 fkCloudSession=null;fkCloudAuthorized=false;fkCloudView();fkCloudMessage('Отключено. Локальные ТТК сохранены.');
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||!b.closest('#fk-cloud'))return;
 if(b.dataset.mode){event.preventDefault();fkCloudLogin(b.dataset.mode);return}
 if(b.id==='fk-cloud-upload')fkCloudPush();
 if(b.id==='fk-cloud-download')fkCloudPull();
 if(b.id==='fk-cloud-logout')fkCloudLogout();
});
document.addEventListener('submit',event=>{
 if(event.target.id==='fk-cloud-auth'){event.preventDefault();fkCloudLogin(event.submitter?.dataset.mode||'signin')}
});
