/* Isolated Neon Cloud V2 / FARUKH PRINT admin, 2026-11-15 */
const AUTH='https://ep-small-forest-basx2akr.neonauth.c-8.eu-central-1.aws.neon.tech/farukh_print/auth';
const REST='https://ep-small-forest-basx2akr.apirest.c-8.eu-central-1.aws.neon.tech/farukh_print/rest/v1';
const CAT='farukh-print:catalog:v1';
const $=id=>document.getElementById(id);
let jwt='',online=false,baseline=null,queue=Promise.resolve(),pulling=false,autosync=false,revision=0;
function notify(message,good=false){const el=$('ns-status');el.textContent=message;el.dataset.state=good?'good':'neutral'}
async function authReq(path,body){
 const res=await fetch(AUTH+path,{method:body===undefined?'GET':'POST',credentials:'include',mode:'cors',cache:'no-store',
 headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.message||data.error?.message||data.error||'Auth HTTP '+res.status);
 return data;
}
async function rpc(method,args={}){
 if(!jwt)throw Error('Вход владельца Neon обязателен.');
 const res=await fetch(REST+'/rpc/'+method,{method:'POST',mode:'cors',cache:'no-store',
  headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'Bearer '+jwt},
  body:JSON.stringify(args)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.message||'Neon HTTP '+res.status);
 if(data.ok===false)throw Error(data.error||'Запись не принята Neon.');
 return data;
}
function localProducts(){try{const x=JSON.parse(localStorage.getItem(CAT)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function plain(p){const x={...p};delete x.cloudUpdatedAt;return x}
function stable(p){const obj=plain(p);return JSON.stringify(Object.fromEntries(Object.keys(obj).sort().map(k=>[k,obj[k]])))}
function download(name,data){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function safeRun(fn){Promise.resolve().then(fn).catch(e=>{notify('⚠ '+(e.message||'Ошибка подключения'));console.warn('[neon-cloud]',e.message)})}
function build(){
 const slot=document.createElement('section');slot.id='ns';slot.setAttribute('aria-label','Облако Neon');
 slot.innerHTML=[
 '<div class="ns-head"><b class="ns-icon">☁</b><div><small>FARUKH PRINT · NEON CLOUD</small><h2>Облако подключено к базе — настройка входа</h2></div></div>',
 '<p>110 товаров и 110 фотографий сохранены в независимой базе Neon. Вход защищён проверкой владельца. Печать сотрудников не затронута.</p>',
 '<div class="ns-notice" id="ns-status" role="status" aria-live="polite">Проверяю авторизацию…</div>',
 '<div id="ns-guest">',
 '<div class="ns-buttons"><button class="ns-primary" type="button" id="ns-google">Войти через Google</button><button type="button" id="ns-show-email">Войти по email</button><button type="button" id="ns-check-login">↻ Проверить вход</button></div>',
 '<div id="ns-email-panel" hidden><label>Email владельца</label><input id="ns-email" type="email" autocomplete="email" placeholder="Email Neon">',
 '<label>Пароль</label><input id="ns-password" type="password" autocomplete="current-password" placeholder="Пароль">',
 '<div class="ns-buttons"><button class="ns-primary" id="ns-magic" type="button">✉ Получить ссылку для входа</button><button id="ns-login" type="button">Войти по паролю</button><button id="ns-reset" type="button">Установить / восстановить пароль</button><button id="ns-verify" type="button">Подтвердить email</button></div>',
 '<div id="ns-reset-panel" hidden><label>Новый пароль (от 12 символов)</label><input id="ns-newpass" type="password" autocomplete="new-password"><button id="ns-change-pass" type="button">Сохранить новый пароль</button></div>',
 '</div></div>',
 '<div id="ns-authed" hidden><div class="ns-cards"><div><b id="ns-products">—</b><small>Товары Neon</small></div><div><b id="ns-photos">—</b><small>Фото</small></div><div><b id="ns-revision">—</b><small>Ревизия</small></div><div><b>4</b><small>Точки</small></div></div>',
 '<div class="ns-buttons"><button class="ns-primary" id="ns-pull" type="button">↓ Получить товары из Neon</button><button id="ns-refresh" type="button">↻ Проверить облако</button><button id="ns-backup" type="button">☁ Создать копию</button><button id="ns-export" type="button">↓ Скачать JSON</button><button id="ns-signout" type="button">Выйти</button></div>',
 '<div class="ns-notice" id="ns-autosync">Автосохранение включится после загрузки каталога Neon.</div></div>',
 '<p class="ns-foot">Доступ только у владельца · защита от конфликтов правок · рабочее приложение сотрудников не меняем.</p>'
 ].join('');
 const anchor=document.querySelector('.migration-panel')||document.querySelector('#print-control');
 anchor.parentNode.insertBefore(slot,anchor);
 const style=document.createElement('style');
 style.textContent='#ns{max-width:1160px;margin:14px auto;padding:22px;border-radius:22px;background:linear-gradient(125deg,#172c60,#111638);border:1px solid #456ca3;color:#eaf3ff;font:500 13px/1.6 Inter,system-ui,sans-serif}#ns *{box-sizing:border-box}#ns .ns-head{display:flex;gap:14px;align-items:center}#ns .ns-icon{width:46px;height:46px;flex-shrink:0;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,#3ee5eb,#9076e5);color:#081434;font-size:23px}#ns h2{color:white;font-size:clamp(19px,3vw,24px);margin:4px 0}#ns .ns-head small{color:#64ecf4;letter-spacing:.14em;font-size:10px;font-weight:850}#ns p{color:#bbd2f3;margin:12px 0}#ns .ns-notice{border:1px solid #597ca5;border-radius:11px;padding:10px 13px;background:#113151;color:#e0f5ff;white-space:pre-wrap}#ns .ns-notice[data-state=good]{color:#78f9d5;border-color:#2bafa5}#ns .ns-buttons{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0}#ns button{font-weight:850;font-size:12px;cursor:pointer;color:white;padding:11px 13px;min-height:42px;border-radius:10px;border:1px solid #5874a6;background:#263d78}#ns button.ns-primary{background:linear-gradient(105deg,#43dce8,#96a8ff);color:#0c2043}#ns label{display:block;margin-top:9px;font-size:11px;font-weight:800}#ns input{padding:11px;border:1px solid #6587b5;border-radius:10px;background:#0b1734;color:white;display:block;width:min(100%,400px);font-size:14px}#ns .ns-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}#ns .ns-cards div{padding:12px;border:1px solid #5269a8;border-radius:13px;background:#152752}#ns .ns-cards b{font-size:26px;display:block}#ns .ns-cards small{font-size:10px;color:#c0d0eb}#ns .ns-foot{font-size:11px}@media(max-width:650px){#ns{margin:10px 12px;padding:15px}#ns .ns-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}';
 document.head.append(style);
}
async function stats(){
 const s=await rpc('cloud_status');
 revision=s.revision;
 $('ns-products').textContent=s.products;
 $('ns-photos').textContent=s.photos;
 $('ns-revision').textContent=s.revision;
 return s;
}
async function loginState(){
 const data=await authReq('/get-session');
 if(!(data?.user?.id||data?.data?.user?.id))return false;
 const token=await authReq('/token');
 jwt=token.token||token.data?.token||'';
 if(jwt.split('.').length!==3)throw Error('JWT Neon Auth не получен');
 const s=await stats();
 online=true;$('ns-guest').hidden=true;$('ns-authed').hidden=false;
 notify('✓ Neon защищён и доступен. Товаров: '+s.products+'. Фото: '+s.photos+'.',true);
 return true;
}
async function pullCloud(){
 if(!online)throw Error('Нужно войти.');
 const cloudData=await rpc('catalog_read');
 if(!Array.isArray(cloudData.products)||!cloudData.products.length)throw Error('База Neon пуста.');
 const current=localProducts(),demos=current.length<=2&&current.some(p=>String(p.id).startsWith('demo-'));
 if(!demos){
  if(!confirm('Загрузить '+cloudData.products.length+' товаров из Neon? Сначала автоматически сохраню прежнюю локальную базу в JSON.'))return;
  download('FARUKH_PRINT_копия_перед_синхронизацией.json',{format:'farukh-print-catalog-v1',products:current});
 }
 pulling=true;
 baseline=new Map(cloudData.products.map(p=>[p.id,p]));
 localStorage.setItem(CAT,JSON.stringify(cloudData.products.map(plain)));
 autosync=true;
 sessionStorage.setItem('farukh-neon:lastpulled',String(cloudData.revision));
 $('ns-autosync').textContent='✓ Каталог из Neon загружен. Все следующие изменения автоматически записываются в облако.';
 notify('✓ Загружено '+cloudData.products.length+' товаров. Перезагружаю редактор…',true);
 setTimeout(()=>location.reload(),1100);
}
async function resumeSync(){
 if(!online)return;
 const local=localProducts();
 if(local.length!==110)return;
 const remote=await rpc('catalog_read');
 if(remote.products.length!==local.length)return;
 const names=new Map(local.map(p=>[p.id,p]));
 if(!remote.products.every(p=>names.has(p.id)&&stable(p)===stable(names.get(p.id)))){
  notify('⚠ Каталоги на телефоне и в Neon отличаются. Нажми «Получить товары из Neon» — старая локальная копия сохранится автоматически.');
  return;
 }
 baseline=new Map(remote.products.map(p=>[p.id,p]));
 autosync=true;$('ns-autosync').textContent='● Автосохранение в Neon включено · каталог согласован';
 notify('✓ Каталог синхронизирован, изменения сохраняются в Neon.',true);
}
async function syncDelta(){
 if(!online||!autosync||!baseline||pulling)return;
 const current=localProducts(),map=new Map(current.map(p=>[p.id,p]));
 const changed=current.filter(p=>!baseline.has(p.id)||stable(baseline.get(p.id))!==stable(p));
 const deleted=[...baseline.keys()].filter(id=>!map.has(id));
 if(!changed.length&&!deleted.length)return;
 notify('Сохраняю в Neon: '+(changed.length+deleted.length)+' изменений…');
 for(const p of changed){
  const prev=baseline.get(p.id);
  const out=await rpc('save_product',{item:plain(p),expected_updated_at:prev?.cloudUpdatedAt||null});
  baseline.set(p.id,{...plain(p),cloudUpdatedAt:out.updatedAt});
  revision=out.revision;
 }
 for(const id of deleted){
  const prev=baseline.get(id);
  const out=await rpc('archive_product',{product_id:id,expected_updated_at:prev.cloudUpdatedAt});
  baseline.delete(id);revision=out.revision;
 }
 notify('✓ Изменения в Neon сохранены. Рабочие сотрудники не подключены.',true);
 $('ns-revision').textContent=revision;$('ns-products').textContent=baseline.size;
}
function onLocalChange(){
 if(!autosync)return;
 queue=queue.then(syncDelta).catch(error=>{
  autosync=false;notify('⚠ Не удалось сохранить в облако: '+error.message+'\\nЛокальные данные не удалены. Автосохранение приостановлено.');
  $('ns-autosync').textContent='○ Автосохранение остановлено — требуется сверка каталога.';
 });
}
function bind(){
 $('ns-google').onclick=()=>safeRun(async()=>{
  notify('Открываю защищённый вход Neon через Google…');
  try{sessionStorage.setItem('fp-google-login-attempt',String(Date.now()))}catch{}
  const x=await authReq('/sign-in/social',{provider:'google',callbackURL:location.origin+location.pathname});
  if(typeof x.url!=='string'||!x.url.startsWith('https://'))throw Error('Google вход недоступен.');
  location.assign(x.url);
 });
 $('ns-show-email').onclick=()=>$('ns-email-panel').hidden=!$('ns-email-panel').hidden;
 $('ns-check-login').onclick=()=>safeRun(async()=>{
  notify('Проверяю сессию Neon…');
  if(await loginState()){await resumeSync();try{sessionStorage.removeItem('fp-google-login-attempt')}catch{}}
  else notify('⚠ Вход подтверждён на сервере Neon, но этот браузер не показывает сессию. Открой ссылку на админку во внешнем Google Chrome и войди там. Если всё ещё не работает, пришли скриншот.'); 
 });
 $('ns-login').onclick=()=>safeRun(async()=>{
  await authReq('/sign-in/email',{email:$('ns-email').value,password:$('ns-password').value});
  $('ns-password').value='';
  if(!await loginState())throw Error('Сеанс не создан. Проверь подтверждение email.');
  await resumeSync();
 });
 $('ns-magic').onclick=()=>safeRun(async()=>{
  const email=$('ns-email').value.trim();
  if(!email)throw Error('Введи email аккаунта владельца Neon.');
  await authReq('/sign-in/magic-link',{email,callbackURL:location.origin+location.pathname});
  notify('✓ Ссылка для входа запрошена. Открой письмо и перейди по ссылке в течение 15 минут.',true);
 });
 $('ns-reset').onclick=()=>safeRun(async()=>{
  if(!$('ns-email').value)throw Error('Введи email.');
  await authReq('/request-password-reset',{email:$('ns-email').value,redirectTo:location.origin+location.pathname});
  notify('Отправлен запрос на установку пароля. Проверь почту.',true);
 });
 $('ns-verify').onclick=()=>safeRun(async()=>{
  if(!$('ns-email').value)throw Error('Введи email.');
  await authReq('/send-verification-email',{email:$('ns-email').value,callbackURL:location.origin+location.pathname});
  notify('Запрошено письмо подтверждения email.',true);
 });
 const code=new URLSearchParams(location.search).get('token');
 if(code){$('ns-email-panel').hidden=false;$('ns-reset-panel').hidden=false}
 $('ns-change-pass').onclick=()=>safeRun(async()=>{
  if(!code||$('ns-newpass').value.length<12)throw Error('Нужен корректный код и пароль длиной от 12 символов.');
  await authReq('/reset-password',{token:code,newPassword:$('ns-newpass').value});
  $('ns-newpass').value='';history.replaceState(null,'',location.pathname);
  notify('Пароль установлен, можно войти по email.',true);
 });
 $('ns-pull').onclick=()=>safeRun(pullCloud);
 $('ns-refresh').onclick=()=>safeRun(async()=>{
  const old=revision,s=await stats();
  if(autosync&&Number(old)!==Number(s.revision)){autosync=false;$('ns-autosync').textContent='Обнови каталог перед редактированием.';}
  notify('Neon: '+s.products+' товаров, '+s.photos+' фото · ревизия '+s.revision,true);
 });
 $('ns-backup').onclick=()=>safeRun(async()=>{
  if(!confirm('Создать резервную копию всех товаров Neon?'))return;
  const r=await rpc('snapshot_create',{snapshot_label:'Ручная копия Farukh Print'});
  notify('✓ Резервная копия Neon создана. Товаров: '+r.products,true);
 });
 $('ns-export').onclick=()=>safeRun(async()=>{
  const cloudData=await rpc('catalog_read');
  download('FARUKH_PRINT_Neon_'+new Date().toISOString().slice(0,10)+'.json',
   {format:'farukh-print-catalog-v1',products:cloudData.products.map(plain),source:'Neon',createdAt:new Date().toISOString()});
  notify('JSON-файл Neon скачан.',true);
 });
 $('ns-signout').onclick=()=>safeRun(async()=>{
  await authReq('/sign-out',{});jwt='';online=false;baseline=null;autosync=false;
  $('ns-authed').hidden=true;$('ns-guest').hidden=false;notify('Выход выполнен. Локальные товары сохранены.');
 });
 window.addEventListener('farukh-print-catalog-local-updated',onLocalChange);
}
async function init(){
 build();bind();
 try{
  if(await loginState())await resumeSync();
  else {
   const started=Number(sessionStorage.getItem('fp-google-login-attempt')||0);
   if(started&&Date.now()-started<20*60*1000)
    notify('⚠ После входа через Google браузер не передал сессию в админку. Нажми «Проверить вход». Если экран не изменится, открой сайт во внешнем Chrome (встроенный браузер может блокировать cookies).');
   else notify('● Neon работает. Войди через Google аккаунтом владельца, чтобы подключить редактирование.');
  }
 }catch(e){notify('Проверка входа: '+e.message)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
