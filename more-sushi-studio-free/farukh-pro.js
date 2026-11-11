/* FARUKH TTK PRO — private professional recipe document studio */
(function(){
'use strict';
const SB='https://mhsmmssipligbmvfzkce.supabase.co';
const KEY='sb_publishable_JKA5HzoGDIkLxBnctT27hw_TBIqnoc0';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>v===''||v==null?null:(Number.isFinite(Number(v))?Number(v):null);
const fmt=v=>Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:2});
const clone=x=>JSON.parse(JSON.stringify(x));
const dateRu=v=>v?new Date(v).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
let session=null,projects=[],docs=[],prefs={studio_name:'FARUKH TTK PRO',title:'Студия технико-технологических карт',chef_name:''};
let currentView='dashboard',editorTab='main',draft=null,dirty=false,workingId=null,modalProjectId=null,modalLogo=null,pendingCreate=false,copySourceId=null,busy=false,toastTimer;
const templates=[
 {id:'atelier',name:'Atelier Signature',sub:'Графит · шампань',desc:'Фирменная классика с мягкими золотистыми акцентами.'},
 {id:'classic',name:'Chef Executive',sub:'Синий · красный',desc:'Строгая ресторанная техкарта с акцентом на структуру.'},
 {id:'arctic',name:'Arctic Minimal',sub:'Тиффани · лёд',desc:'Светлый современный стиль и деликатные оттенки моря.'}
];
const iconPaths={
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/>',
 book:'<path d="M4 4h15v17H6a2 2 0 0 1 0-4h13"/><path d="M6 4v13"/>',
 edit:'<path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 5 3 3m-9 6 3-.6L21 5l-3-3-8 8z"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 save:'<path d="M4 3h14l3 3v15H3V3z"/><path d="M7 3v7h10V3M7 21v-9h10v9"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 print:'<path d="M7 9V3h10v6M7 18H4V9h16v9h-3"/><path d="M7 14h10v7H7z"/>',
 list:'<path d="M9 5h12M9 12h12M9 19h12"/><circle cx="4" cy="5" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="19" r="1"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
 left:'<path d="m14 5-7 7 7 7M7 12h14"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 star:'<path d="m12 2 3.3 6.7 7.4 1.1-5.3 5.2 1.2 7.3L12 18.9 5.4 22.3l1.3-7.3-5.3-5.2 7.3-1.1z"/>',
 trash:'<path d="M4 7h16M10 4h4m-7 3 1 13h8l1-13M10 11v6m4-6v6"/>',
 archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v12h14V9M10 14h4"/>'
};
function icon(name){const p=iconPaths[name]||iconPaths.grid;return '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">'+p+'</svg></span>'}
function paintIcons(){document.querySelectorAll('[data-icon]').forEach(el=>{const name=el.getAttribute('data-icon');el.innerHTML='<svg viewBox="0 0 24 24">'+(iconPaths[name]||'')+'</svg>';el.removeAttribute('data-icon')})}
function tell(message,error=false){const el=$('toast');el.textContent=message;el.className='toast'+(error?' error':'');el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},4800)}
function setBusy(flag){busy=flag;['saveDoc','projectSaveButton','loginButton'].forEach(id=>{const el=$(id);if(el)el.disabled=flag})}
function errText(e){return String(e?.message||e||'Неизвестная ошибка')}
async function api(path,opts={}){
 const headers={apikey:KEY,...opts.headers};
 if(opts.body!=null)headers['Content-Type']='application/json';
 if(session?.access_token)headers.Authorization='Bearer '+session.access_token;
 const res=await fetch(SB+path,{method:opts.method||'GET',headers,body:opts.body!=null?JSON.stringify(opts.body):undefined});
 const raw=await res.text();let data;
 try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!res.ok)throw Error(data?.message||data?.msg||data?.error_description||data?.error||('Сервер вернул '+res.status));
 return data;
}
function storedSession(){try{return JSON.parse(localStorage.getItem('ms_session')||'null')}catch{return null}}
function persist(){if(session)localStorage.setItem('ms_session',JSON.stringify(session));else localStorage.removeItem('ms_session')}
async function freshSession(){
 if(!session)return false;
 if(session.expires_at&&session.expires_at>Math.floor(Date.now()/1000)+100)return true;
 if(!session.refresh_token)return false;
 try{session=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});persist();return !!session.access_token}
 catch{return false}
}
async function signIn(ev){ev.preventDefault();if(busy)return;
 const email=$('loginEmail').value.trim(),password=$('loginPassword').value;
 if(!email||password.length<8){$('authError').textContent='Укажите электронную почту и пароль не менее 8 символов.';return}
 setBusy(true);$('authError').textContent='';
 try{session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  persist();await enter();
 }catch(e){$('authError').textContent='Не удалось войти: '+errText(e)}
 finally{setBusy(false)}
}
async function signOut(){
 if(dirty&&!confirm('Выйти без сохранения изменений ТТК?'))return;
 try{await api('/auth/v1/logout',{method:'POST'})}catch{}
 session=null;persist();projects=[];docs=[];draft=null;dirty=false;
 $('shell').hidden=true;$('auth').hidden=false;$('loginPassword').value='';$('authError').textContent='';window.scrollTo(0,0);
}
async function loadAll(){
 const [p,d,pref]=await Promise.all([
  api('/rest/v1/ttk_projects?select=*&order=updated_at.desc&limit=1000'),
  api('/rest/v1/ttk_documents?select=*&order=updated_at.desc&limit=2000'),
  api('/rest/v1/ttk_preferences?select=*&limit=1')
 ]);
 projects=Array.isArray(p)?p:[];docs=Array.isArray(d)?d:[];
 prefs=Array.isArray(pref)&&pref[0]?pref[0]:{studio_name:'FARUKH TTK PRO',title:'Студия технико-технологических карт',chef_name:''};
 renderAll();
}
async function enter(){
 $('auth').hidden=true;$('shell').hidden=false;
 $('sideEmail').textContent=session?.user?.email||'Закрытый аккаунт';
 try{await loadAll();navigate('dashboard',true)}catch(e){tell('Не удалось загрузить базу: '+errText(e),true);navigate('dashboard',true)}
}
const pageTitle={dashboard:'Обзор студии',projects:'Мои проекты',library:'Библиотека ТТК',editor:'Конструктор ТТК',templates:'Шаблоны документов',settings:'Настройки студии'};
function navigate(view,force=false){
 if(!pageTitle[view])return false;
 if(!force&&currentView==='editor'&&view!=='editor'&&dirty&&!confirm('У вас есть несохранённые изменения ТТК. Закрыть без сохранения?'))return false;
 if(view==='editor'&&!draft){startNewDoc();return true}
 currentView=view;
 document.querySelectorAll('.page').forEach(el=>el.hidden=el.dataset.view!==view);
 document.querySelectorAll('.nav-btn[data-nav]').forEach(el=>{
  const active=el.dataset.nav===view;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');
 });
 $('topTitle').textContent=pageTitle[view];window.scrollTo(0,0);
 if(view==='editor')requestAnimationFrame(()=>{fitPaper();detectOverflow()});
 return true;
}
async function imageData(file,maxSize=800){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Поддерживаются только PNG, JPG и WEBP.');
 if(file.size>12*1024*1024)throw Error('Файл слишком большой (до 12 МБ).');
 const img=await new Promise((resolve,reject)=>{
  const u=URL.createObjectURL(file),i=new Image();
  i.onload=()=>{URL.revokeObjectURL(u);resolve(i)};
  i.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Файл изображения повреждён.'))};i.src=u;
 });
 const ratio=Math.min(1,maxSize/Math.max(img.naturalWidth,img.naturalHeight));
 const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.naturalWidth*ratio));cv.height=Math.max(1,Math.round(img.naturalHeight*ratio));
 const c=cv.getContext('2d');if(!c)throw Error('Обработка фото в браузере недоступна.');
 c.clearRect(0,0,cv.width,cv.height);c.drawImage(img,0,0,cv.width,cv.height);
 const out=cv.toDataURL('image/webp',.87);
 if(out.length>1250000)throw Error('Изображение после обработки слишком большое.');
 return out;
}
const validImg=x=>typeof x==='string'&&x.length<1400000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(x);
function emptyView(title,description,button,action){
 return '<div class="empty"><div class="empty-symbol">'+icon('folder')+'</div><strong>'+esc(title)+'</strong><p>'+esc(description)+'</p>'+
 (button?'<button type="button" class="btn btn-primary btn-sm" data-command="'+esc(action)+'">'+esc(button)+'</button>':'')+'</div>';
}
function byProject(id){return projects.find(p=>p.id===id)||null}
function projectName(id){return byProject(id)?.name||'Проект не найден'}
function docStatus(doc){const c=doc.status==='Утверждено'?'approved':doc.status==='На проверке'?'review':doc.status==='Архив'?'archive':'';return '<span class="pill '+c+'">'+esc(doc.status||'Черновик')+'</span>'}
function renderAll(){
 renderDash();renderProjects();renderLibrary();renderTemplates();renderSettings();
}
/* Projects: client brands live inside this single closed chef workspace. */
let pendingTemplate='atelier';
function renderDash(){
 $('statProjects').textContent=projects.filter(p=>!p.is_archived).length;
 $('statDocuments').textContent=docs.filter(d=>d.status!=='Архив').length;
 $('statDrafts').textContent=docs.filter(d=>d.status==='Черновик'||d.status==='На проверке').length;
 $('statApproved').textContent=docs.filter(d=>d.status==='Утверждено').length;
 const recent=docs.filter(d=>d.status!=='Архив').slice(0,4);
 $('dashDocs').innerHTML=recent.length?'<div class="list">'+recent.map(d=>rowHtml(d,true)).join('')+'</div>':
 emptyView('Начни с первой ТТК','Создай проект, а затем добавь первую технологическую карту.','Создать ТТК','newDoc');
 const active=projects.filter(p=>!p.is_archived).slice(0,2);
 $('dashProjects').innerHTML=active.map(projectCard).join('')+
 '<button type="button" class="project-card surface project-add" data-command="newProject"><span class="plus">+</span><strong>Новый проект</strong><small>Ресторан · бренд · заказчик</small></button>';
}
function projectCard(p){
 const count=docs.filter(d=>d.project_id===p.id&&d.status!=='Архив').length;
 const initial=esc((p.name||'P').trim().slice(0,1).toLocaleUpperCase('ru'));
 const logo=validImg(p.logo_data)?'<img src="'+p.logo_data+'" alt="">':initial;
 return '<article class="surface project-card" style="--project-color:'+esc(p.accent||'#0F6479')+'">'+
 '<div class="row between"><div class="proj-mark">'+logo+'</div><span class="pill '+(p.is_archived?'archive':'approved')+'">'+(p.is_archived?'Архив':'Активный')+'</span></div>'+
 '<div><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'Частная коллекция ТТК')+'</p><p style="margin-top:6px">'+count+' документов</p></div>'+
 '<div class="proj-actions"><button type="button" class="btn btn-primary btn-sm" data-project-open="'+p.id+'">Открыть ТТК →</button>'+
 '<button type="button" class="btn btn-light btn-sm" data-project-edit="'+p.id+'" aria-label="Настроить проект">Изменить</button></div></article>';
}
function renderProjects(){
 const q=$('projectSearch').value.trim().toLocaleLowerCase('ru'),status=$('projectStatus').value;
 const filtered=projects.filter(p=>(status==='all'||(status==='active'?!p.is_archived:p.is_archived))&&
 (!q||[p.name,p.description].some(t=>String(t||'').toLocaleLowerCase('ru').includes(q))));
 $('projectGrid').innerHTML=filtered.map(projectCard).join('')+
 (status!=='archive'?'<button type="button" class="project-card surface project-add" data-command="newProject"><span class="plus">+</span><strong>Создать новый проект</strong><small>Открой следующую коллекцию</small></button>':'')||
 emptyView('Пока нет проектов','Создай первое заведение для своей коллекции ТТК.','Новый проект','newProject');
}
function rowHtml(d,compact=false){
 const meta=esc(d.code||'Без кода')+' · '+dateRu(d.updated_at);
 return '<article class="doc-row"><div class="doc-main"><div class="doc-label">'+esc(d.title)+'</div><div class="doc-meta">'+meta+'</div></div>'+
 '<span class="doc-project">'+esc(projectName(d.project_id))+'</span>'+docStatus(d)+
 '<div class="action-menu"><button class="btn btn-primary btn-sm" type="button" data-doc-open="'+d.id+'">Открыть</button>'+
 (compact?'': '<button class="btn btn-light btn-sm" type="button" data-doc-copy="'+d.id+'" aria-label="Копировать">Копия</button>'+
 '<button class="btn btn-light btn-sm" type="button" data-doc-archive="'+d.id+'">'+(d.status==='Архив'?'Вернуть':'В архив')+'</button>'+
 '<button class="btn btn-danger btn-sm" type="button" data-doc-delete="'+d.id+'" aria-label="Удалить документ">×</button>')+
 '</div></article>';
}
function renderLibrary(){
 const old=$('docProject').value;
 $('docProject').innerHTML='<option value="">Все проекты</option>'+projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
 if(projects.some(p=>p.id===old))$('docProject').value=old;
 const p=$('docProject').value,s=$('docStatus').value,q=$('docSearch').value.trim().toLocaleLowerCase('ru');
 const filtered=docs.filter(d=>(!p||d.project_id===p)&&
 (s==='all'||s==='active'&&d.status!=='Архив'||d.status===s)&&
 (!q||[d.title,d.code,d.category,projectName(d.project_id)].some(x=>String(x||'').toLocaleLowerCase('ru').includes(q))));
 $('libraryDocs').innerHTML=filtered.length?filtered.map(d=>rowHtml(d)).join(''):
 emptyView('Документов пока нет','Создайте первую ТТК. Здесь появятся карточки всех заведений.','Создать ТТК','newDoc');
 $('libraryCount').textContent='Показано: '+filtered.length+' из '+docs.length+' документов';
}
function renderTemplates(){
 $('templateGrid').innerHTML=templates.map(t=>
 '<article class="surface template-card"><div class="design-mini '+esc(t.id)+'"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
 '<div class="mini-label">'+esc(t.sub)+'</div><h3>'+esc(t.name)+'</h3><p>'+esc(t.desc)+'</p>'+
 '<button type="button" class="btn btn-primary" data-template-create="'+esc(t.id)+'">'+icon('plus')+' Создать ТТК в этом стиле</button></article>').join('');
}
function renderSettings(){
 $('prefStudio').value=prefs.studio_name||'FARUKH TTK PRO';
 $('prefTitle').value=prefs.title||'Студия технико-технологических карт';
 $('prefChef').value=prefs.chef_name||'';
}
async function saveSettings(ev){ev.preventDefault();if(busy)return;
 const data={owner_id:session?.user?.id,studio_name:$('prefStudio').value.trim().slice(0,100)||'FARUKH TTK PRO',
 title:$('prefTitle').value.trim().slice(0,180),chef_name:$('prefChef').value.trim().slice(0,160),updated_at:new Date().toISOString()};
 setBusy(true);try{
 const rows=await api('/rest/v1/ttk_preferences?on_conflict=owner_id&select=*',{
  method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:data});
 if(!rows?.[0])throw Error('Настройки не подтверждены сервером');
 prefs=rows[0];tell('Настройки студии сохранены');
 }catch(e){tell('Ошибка сохранения настроек: '+errText(e),true)}finally{setBusy(false)}
}
function openProjectDialog(id=null){
 const p=id?byProject(id):null;
 modalProjectId=p?.id||null;modalLogo=p?.logo_data||null;
 $('projectDialogTitle').textContent=p?'Редактировать проект':'Новый проект';
 $('pName').value=p?.name||'';$('pDesc').value=p?.description||'';$('pColor').value=p?.accent||'#0F6479';
 $('pLogo').value='';$('pLogoStatus').textContent=modalLogo?'Логотип уже загружен':'Логотип пока не выбран';
 $('projectDialog').showModal();$('pName').focus();
}
async function logoSelected(){
 const file=$('pLogo').files?.[0];if(!file)return;
 try{modalLogo=await imageData(file,500);$('pLogoStatus').textContent='Логотип подготовлен · '+Math.round(modalLogo.length/1024)+' КБ'}
 catch(e){tell(errText(e),true)}
 finally{$('pLogo').value=''}
}
async function saveProject(ev){
 ev.preventDefault();if(busy)return;
 const name=$('pName').value.trim().replace(/\s+/g,' ');
 if(!name){tell('Введите название проекта.',true);return}
 const patch={name,description:$('pDesc').value.trim().slice(0,500),accent:$('pColor').value,logo_data:modalLogo,updated_at:new Date().toISOString()};
 setBusy(true);
 try{
  const rows=modalProjectId?await api('/rest/v1/ttk_projects?id=eq.'+modalProjectId+'&select=*',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:patch}):
   await api('/rest/v1/ttk_projects?select=*',{
    method:'POST',headers:{Prefer:'return=representation'},body:patch});
  if(!rows?.[0]?.id)throw Error('Сервер не подтвердил сохранение проекта');
  const saved=rows[0];
  if(modalProjectId){projects=projects.map(p=>p.id===saved.id?saved:p)}
  else projects.unshift(saved);
  $('projectDialog').close();renderAll();tell(modalProjectId?'Проект обновлён':'Новый проект создан');
  if(pendingCreate){pendingCreate=false;startNewDoc(saved.id,pendingTemplate)}
 }catch(e){tell('Не удалось сохранить проект: '+errText(e),true)}
 finally{setBusy(false)}
}
async function toggleProjectArchive(id){
 const p=byProject(id);if(!p)return;
 const next=!p.is_archived;
 if(next&&!confirm('Переместить проект «'+p.name+'» в архив? ТТК сохранятся.'))return;
 try{
  const rows=await api('/rest/v1/ttk_projects?id=eq.'+id+'&select=*',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:{is_archived:next,updated_at:new Date().toISOString()}});
  if(!rows?.[0])throw Error('Изменения не подтверждены сервером');
  projects=projects.map(x=>x.id===id?rows[0]:x);renderAll();tell(next?'Проект отправлен в архив':'Проект восстановлен');
 }catch(e){tell(errText(e),true)}
}
async function removeProject(id){
 const p=byProject(id);if(!p)return;
 if(docs.some(d=>d.project_id===id)){tell('В проекте есть ТТК. Сначала перенесите или удалите документы.',true);return}
 if(!confirm('Безвозвратно удалить пустой проект «'+p.name+'»?'))return;
 try{
  const rows=await api('/rest/v1/ttk_projects?id=eq.'+id+'&select=id',{method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!rows?.[0])throw Error('Удаление не подтверждено');
  projects=projects.filter(x=>x.id!==id);renderAll();tell('Пустой проект удалён');
 }catch(e){tell(errText(e),true)}
}
async function listForProject(id){
 $('docProject').value=id;navigate('library',true);renderLibrary();
}

})();
