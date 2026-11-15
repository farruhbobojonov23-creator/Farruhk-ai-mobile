/* FARUKH PRINT — independent owner console. No production staff API calls. */
const AUTH='/owner-auth/';
const REST='https://ep-small-forest-basx2akr.apirest.c-8.eu-central-1.aws.neon.tech/farukh_print/rest/v1';
const KEY='farukh-print:theme:owner';const $=id=>document.getElementById(id);
let token='',products=[],revision=0,editId=null,saving=false,authenticated=false;
const ownerId='084de5c3-1c6a-4ef8-8774-289ed64f8838';
function note(message,kind=''){const el=$(authenticated?'owner-status':'login-status');el.textContent=message;el.dataset.kind=kind}
function protect(e){e.preventDefault()}
async function auth(endpoint,data){
 const res=await fetch(AUTH+endpoint,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?undefined:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const json=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(json.message||json.error?.message||json.error||'Ошибка входа ('+res.status+')');
 return json;
}
async function cloud(func,args={}){
 if(!token)throw Error('Сеанс владельца не подтверждён.');
 const r=await fetch(REST+'/rpc/'+func,{method:'POST',cache:'no-store',mode:'cors',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(args)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.message||d.error||'Neon HTTP '+r.status);
 if(d?.ok===false)throw Error(d.error||'Действие отклонено Neon.');
 return d;
}
function escape(s){return String(s??'').replace(/[&<>"']/g,a=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[a]))}
function avatar(p){if(!p.photo||!(p.photo.startsWith('data:image/')||p.photo.startsWith('https://')))return null;
 const el=document.createElement('img');el.alt='';el.loading='lazy';el.referrerPolicy='no-referrer';el.src=p.photo;return el}
async function refresh(){
 const [info,cat]=await Promise.all([cloud('cloud_status'),cloud('catalog_read')]);
 if(!Array.isArray(cat.products))throw Error('Neon вернул неверный формат каталога.');
 products=cat.products;revision=info.revision;
 for(const [id,val] of [['stat-total',info.products],['stat-ready',info.ready],['stat-prep',info.prep],['stat-photos',info.photos],['cloud-items',info.products],['cloud-photos',info.photos],['cloud-revision',info.revision],['cloud-backups',info.backups]])$(id).textContent=String(val??0);
 showProducts();
 note('✓ Каталог Neon загружен: '+info.products+' товаров, '+info.photos+' фото. Ревизия '+info.revision+'.','good');
}
function showProducts(){
 const q=$('filter').value.toLocaleLowerCase('ru').trim();
 const matches=products.filter(p=>!q||(p.name+' '+(p.category||'')).toLocaleLowerCase('ru').includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 const box=$('product-list');box.replaceChildren();
 for(const p of matches){
  const b=document.createElement('button');b.type='button';b.className='product';
  const pic=avatar(p);if(pic)b.append(pic);else{const blank=document.createElement('span');blank.className='placeholder';b.append(blank)}
  const content=document.createElement('div');const name=document.createElement('strong');name.textContent=p.name;
  const info=document.createElement('small');info.textContent=(p.kind==='ready'?'58 × 40':'30 × 20')+' · '+(p.category||'Без категории')+(p.needsReview?' · требует проверки':'');
  content.append(name,info);b.append(content);b.addEventListener('click',()=>edit(p.id));box.append(b);
 }
 if(!matches.length){const empty=document.createElement('p');empty.textContent='Ничего не найдено.';box.append(empty)}
}
async function ownerSession(){
 const state=await auth('get-session');
 const u=state?.user||state?.data?.user;
 if(!u?.id)return false;
 if(u.id!==ownerId)throw Error('Это не учётная запись владельца FARUKH PRINT.');
 const result=await auth('token');
 if(!result.token||String(result.token).split('.').length!==3)throw Error('Neon не выдал токен доступа.');
 token=result.token;
 // RPC itself enforces owner identity and verified email.
 await cloud('cloud_status');
 authenticated=true;
 $('login').hidden=true;$('owner').hidden=false;
 await refresh();
 return true;
}
async function attemptLogin(event){
 event.preventDefault();
 const login=$('login-user').value.trim();const password=$('login-pass').value;
 if(login!=='admin')return note('Неверный логин. Вход владельца: admin.','bad');
 try{
  note('Проверяю логин и пароль…');
  const result=await auth('sign-in/email',{login,password});
  $('login-pass').value='';
  if(!result?.user?.id&&!(result?.token))throw Error('Сеанс не был создан.');
  if(!await ownerSession())throw Error('Сеанс пока не передан в админку.');
 }catch(e){note('Вход не выполнен: '+e.message,'bad')}
}
function tab(name){
 for(const item of document.querySelectorAll('[data-tab]'))item.setAttribute('aria-current',item.dataset.tab===name?'page':'false');
 for(const n of ['products','cloud','settings'])$('section-'+n).hidden=name!==n;
}
function pval(p,key){return p[key]??''}
function edit(id){
 const p=id?products.find(x=>x.id===id):null;if(id&&!p)return;
 editId=id||null;
 $('edit-title').textContent=p?'Изменить: '+p.name:'Новый товар';
 for(const [id,key] of [['p-name','name'],['p-kind','kind'],['p-category','category'],['p-storage','storage'],['p-composition','composition'],['p-hours','hours'],['p-weight','weight'],['p-kcal','kcal'],['p-protein','p'],['p-fat','f'],['p-carb','c']])$(id).value=pval(p||{},key);
 if(!p)$('p-kind').value='ready';
 $('p-review').checked=!!p?.needsReview;
 $('p-photo').value='';
 const preview=$('p-preview');preview.hidden=!p?.photo;if(p?.photo)preview.src=p.photo;
 $('edit-status').textContent='Изменения сохраняются в Neon после нажатия «Сохранить».';
 $('edit-overlay').hidden=false;
}
const numeric=(id)=>{const val=$(id).value.trim();return val===''?null:Number(val)};
function freshId(){return crypto.randomUUID?crypto.randomUUID():'fp-'+Date.now()+'-'+Math.random().toString(36).slice(2,11)}
async function saveEditor(e){
 e.preventDefault();if(saving)return;
 let p=editId?products.find(x=>x.id===editId):null;const before=p||{};
 const name=$('p-name').value.trim(),kind=$('p-kind').value;
 if(!name||name.length>90)return $('edit-status').textContent='Укажи название до 90 символов.';
 const weight=numeric('p-weight'),hours=numeric('p-hours'),storage=$('p-storage').value.trim();
 if((weight!==null&&(!Number.isFinite(weight)||weight<=0))||(hours!==null&&(!Number.isInteger(hours)||hours<1||hours>8760)))return $('edit-status').textContent='Проверь вес и срок хранения.';
 const near=products.some(x=>x.id!==editId&&x.kind===kind&&x.name.trim().toLowerCase()===name.toLowerCase());
 if(near)return $('edit-status').textContent='Такое название в категории уже существует.';
 const toSave={...before,id:p?.id||freshId(),name,kind,category:$('p-category').value.trim(),storage,hours,
  weight,composition:$('p-composition').value.trim(),needsReview:$('p-review').checked||!hours||!storage,
  kcal:numeric('p-kcal'),p:numeric('p-protein'),f:numeric('p-fat'),c:numeric('p-carb')};
 for(const prop of ['tolerance','weightUnit','labelStyle','photoStyle','prepEvent','point'])if(before[prop]!==undefined)toSave[prop]=before[prop];
 if(kind==='ready'&&!toSave.labelStyle)toSave.labelStyle='premium-ready-58x40';
 if(kind==='prep'&&!toSave.labelStyle)toSave.labelStyle='premium-prep-30x20';
 const selected=$('p-photo').files[0];
 if(selected){
  if(!['image/jpeg','image/webp','image/png'].includes(selected.type)||selected.size>1048576)return $('edit-status').textContent='Фото должно быть JPEG, PNG или WebP, до 1 МБ.';
  toSave.photo=await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(Error('Не удалось прочитать фото'));f.readAsDataURL(selected)});
 }
 const old=before.cloudUpdatedAt||null;delete toSave.cloudUpdatedAt;
 try{
  saving=true;$('edit-save').disabled=true;
  $('edit-status').textContent='Сохраняю в Neon…';
  const result=await cloud('save_product',{item:toSave,expected_updated_at:old});
  if(!result?.updatedAt)throw Error('Neon не подтвердил запись.');
  $('edit-overlay').hidden=true;
  await refresh();note('✓ Товар «'+name+'» сохранён в Neon.','good');
 }catch(error){$('edit-status').textContent='Не удалось сохранить: '+error.message}
 finally{saving=false;$('edit-save').disabled=false}
}
function dl(name,data){
 const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),12000);
}
async function resetRequest(){
 try{
  note('Отправляю ссылку для установки пароля владельцу…');
  await auth('request-password-reset',{login:'admin'});
  note('Если для владельца доступно восстановление пароля, письмо отправлено. Проверь почту и спам.','good');
 }catch(e){note('Не удалось отправить письмо: '+e.message,'bad')}
}
async function resetPassword(){
 const ps=$('reset-pass').value;
 if(ps.length<12||ps!==$('reset-repeat').value)return note('Пароли должны совпадать и содержать минимум 12 символов.','bad');
 const code=new URL(location.href).searchParams.get('token');
 if(!code)return note('Ссылка установки пароля не содержит действительный код.','bad');
 try{
  await auth('reset-password',{token:code,newPassword:ps});
  $('reset-pass').value='';$('reset-repeat').value='';
  history.replaceState(null,'',location.pathname);
  $('reset-panel').hidden=true;
  note('✓ Пароль установлен. Войди под логином admin.','good');
 }catch(e){note('Не удалось установить пароль: '+e.message,'bad')}
}
async function changePassword(){
 const old=$('old-password').value,pass=$('next-password').value;
 if(!old||pass.length<12)return note('Текущий пароль и новый пароль от 12 символов обязательны.','bad');
 try{
  await auth('change-password',{currentPassword:old,newPassword:pass,revokeOtherSessions:true});
  $('old-password').value='';$('next-password').value='';
  note('Пароль изменён. В целях безопасности выйди и зайди снова.','good');
 }catch(e){note('Смена пароля: '+e.message,'bad')}
}
function theme(value){
 const accepted=['neon','beige','gold','emerald'];if(!accepted.includes(value))return;
 document.body.dataset.theme=value;localStorage.setItem(KEY,value);
 for(const x of document.querySelectorAll('[data-theme-choice]'))x.setAttribute('aria-pressed',x.dataset.themeChoice===value?'true':'false');
}
async function start(){
 theme(localStorage.getItem(KEY)||'neon');
 $('login-form').addEventListener('submit',attemptLogin);
 $('first-password').addEventListener('click',()=>$('recovery-panel').hidden=!$('recovery-panel').hidden);
 $('recovery-send').addEventListener('click',resetRequest);
 $('reset-submit').addEventListener('click',resetPassword);
 $('logout').addEventListener('click',async()=>{try{await auth('sign-out',{})}catch{}token='';authenticated=false;$('owner').hidden=true;$('login').hidden=false;note('Сеанс завершён.','good')});
 for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>tab(b.dataset.tab));
 for(const b of document.querySelectorAll('[data-theme-choice]'))b.addEventListener('click',()=>theme(b.dataset.themeChoice));
 $('filter').addEventListener('input',showProducts);
 $('catalog-refresh').addEventListener('click',()=>refresh().catch(e=>note(e.message,'bad')));
 $('cloud-refresh').addEventListener('click',()=>refresh().catch(e=>note(e.message,'bad')));
 $('add-item').addEventListener('click',()=>edit(null));
 $('edit-close').addEventListener('click',()=>$('edit-overlay').hidden=true);
 $('edit-cancel').addEventListener('click',()=>$('edit-overlay').hidden=true);
 $('editor').addEventListener('submit',saveEditor);
 $('cloud-download').addEventListener('click',async()=>{try{const r=await cloud('catalog_read');dl('FARUKH_PRINT_NEON_'+new Date().toISOString().slice(0,10)+'.json',{format:r.format,products:r.products,revision:r.revision});note('✓ JSON Neon скачан.','good')}catch(e){note(e.message,'bad')}});
 $('cloud-backup').addEventListener('click',async()=>{if(!confirm('Создать резервную копию всего каталога в Neon?'))return;try{await cloud('snapshot_create',{snapshot_label:'Резервная копия владельца'});await refresh();note('✓ Резервная копия создана.','good')}catch(e){note(e.message,'bad')}});
 $('change-password').addEventListener('click',changePassword);
 if(new URL(location.href).searchParams.get('token')){$('recovery-panel').hidden=false;$('reset-panel').hidden=false;note('Установи новый пароль по полученной ссылке.')}
 else {
  note('Проверяю действующий сеанс…');
  try{if(!await ownerSession())note('Введи логин admin и пароль. Если пароль ещё не задан, нажми «Создать / восстановить пароль».')}
  catch(e){note('Введи логин admin и пароль. Подключение: '+e.message)}
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
