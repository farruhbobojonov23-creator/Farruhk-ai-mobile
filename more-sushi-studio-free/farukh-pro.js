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
{id:'atelier',name:'Море Суши · фирменный',sub:'Архив · вариант 1',desc:'Исходный фирменный лист с синими полосами и красными акцентами.'},
{id:'classic',name:'Море Суши · А4 PRO',sub:'Архив · вариант 2',desc:'Исходный горизонтальный фирменный блок и крупное фото.'},
{id:'arctic',name:'Море Суши · северный',sub:'Архив · вариант 4',desc:'Исходное северное оформление из проекта Море Суши.'}
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
let lastRemovedLine=null;
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
 '<button type="button" class="btn btn-light btn-sm" data-project-edit="'+p.id+'" aria-label="Настроить проект">Изменить</button>'+
 '<button type="button" class="btn btn-light btn-sm" data-project-archive="'+p.id+'">'+(p.is_archived?'Вернуть':'В архив')+'</button>'+
 (docs.every(d=>d.project_id!==p.id)?'<button type="button" class="btn btn-danger btn-sm" data-project-remove="'+p.id+'">Удалить</button>':'')+
 '</div></article>';
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
function renderLogoPreview(){
 const preview=$('pLogoPreview');
 preview.innerHTML=validImg(modalLogo)?'<img src="'+modalLogo+'" alt="Предпросмотр логотипа бренда">':'<span>Логотип бренда</span>';
}
function openProjectDialog(id=null){
 const p=id?byProject(id):null;
 modalProjectId=p?.id||null;modalLogo=p?.logo_data||null;
 $('projectDialogTitle').textContent=p?'Редактировать проект':'Новый проект';
 $('pName').value=p?.name||'';$('pDesc').value=p?.description||'';$('pColor').value=p?.accent||'#0F6479';
 $('pLogo').value='';$('pLogoStatus').textContent=modalLogo?'Логотип уже загружен':'Логотип пока не выбран';
 renderLogoPreview();$('projectDialog').showModal();$('pName').focus();
}
async function logoSelected(){
 const file=$('pLogo').files?.[0];if(!file)return;
 try{modalLogo=await imageData(file,1000);renderLogoPreview();$('pLogoStatus').textContent='Логотип подготовлен · '+Math.round(modalLogo.length/1024)+' КБ'}
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
  $('projectDialog').close();renderAll();
  if(draft&&draft.project_id===saved.id)renderPreview();
  tell(modalProjectId?'Проект обновлён':'Новый проект создан');
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

/* Document studio: a separate card belongs to one selected restaurant project. */
const fieldMap={
 fScope:'scope',fRaw:'raw',fProcess:'process',fServing:'serving',fStorage:'storage',
 fQuality:'quality',fAllergens:'allergens',fNutrition:'nutrition',fDeveloped:'developed',
 fApproved:'approved',fDate:'date',fVerified:'verified'
};
function nextTtkCode(projectId){
 const nums=docs.filter(d=>d.project_id===projectId).map(d=>
  String(d.code||'').match(/^(?:ТТК|TTK)-(\d+)$/i)).filter(Boolean).map(m=>Number(m[1]));
 const next=Math.max(0,...nums)+1;
 return 'ТТК-'+String(next).padStart(3,'0');
}
function blankDoc(projectId,template='atelier'){
 return {id:null,project_id:projectId||'',title:'',code:projectId?nextTtkCode(projectId):'',category:'Блюда',status:'Черновик',
  yield_g:null,photo_data:null,lines:[{name:'',gross_g:null,net_g:null}],fields:{scope:'',raw:'',process:'',serving:'',storage:'',
   quality:'',allergens:'',nutrition:'',developed:prefs.chef_name||'',approved:'',date:'',verified:'no'},
  template,version:1};
}
function confirmNew(){
 if(dirty&&!confirm('Создать новую ТТК? Несохранённые изменения текущей карты будут потеряны.'))return false;
 return true;
}
function startNewDoc(projectId=null,template=pendingTemplate){
 if(!confirmNew())return;
 const suitable=projects.filter(p=>!p.is_archived);
 if(!suitable.length){
  pendingCreate=true;pendingTemplate=template||'atelier';
  tell('Сначала создайте проект для будущих ТТК.');
  openProjectDialog();return;
 }
 const chosen=suitable.find(p=>p.id===projectId)?.id||suitable[0].id;
 draft=blankDoc(chosen,template||'atelier');workingId=null;dirty=false;editorTab='main';
 fillEditor();navigate('editor',true);
}
function openDocument(id){
 const item=docs.find(d=>d.id===id);
 if(!item){tell('ТТК не найдена в библиотеке',true);return}
 if(currentView==='editor'&&dirty&&!confirm('Открыть другую ТТК без сохранения текущих изменений?'))return;
 draft=clone(item);draft.fields={...blankDoc().fields,...(draft.fields||{})};
 draft.lines=Array.isArray(draft.lines)?draft.lines:[];
 workingId=id;dirty=false;editorTab='main';
 fillEditor();navigate('editor',true);
}
function fillEditor(){
 if(!draft)return;
 lastRemovedLine=null;
 const sel=$('eProject');
 sel.innerHTML='<option value="">Выберите проект</option>'+
 projects.filter(p=>!p.is_archived||p.id===draft.project_id).map(p=>
 '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
 $('eProject').value=draft.project_id||'';
 $('eTitle').value=draft.title||'';$('eCode').value=draft.code||'';$('eCategory').value=draft.category||'Блюда';
 $('eYield').value=draft.yield_g??'';$('eStatus').value=draft.status||'Черновик';
 Object.entries(fieldMap).forEach(([id,key])=>{$(id).value=draft.fields?.[key]|| (key==='verified'?'no':'')});
 $('ePhotoInput').value='';renderPhotoZone();renderLineRows();setTab(editorTab);
 $('editorHeading').textContent=draft.title||'Новая технико-технологическая карта';
 $('editorDuplicate').hidden=!draft.id;renderEditorDesigns();renderPreview();renderReview();
}
function renderPhotoZone(){
 const z=$('photoZone');if(!z)return;
 if(validImg(draft?.photo_data)){
  z.innerHTML='<img src="'+draft.photo_data+'" alt="Фото блюда"><strong>Нажмите, чтобы заменить фото</strong><span>Изображение добавлено</span>';
  $('removePhoto').disabled=false;
 }else{
  z.innerHTML=icon('upload')+'<strong>Загрузить фотографию</strong><span>PNG / JPG / WEBP · будет отображаться в ТТК</span>';
  $('removePhoto').disabled=true;
 }
}
function renderLineRows(){
 const rows=Array.isArray(draft?.lines)?draft.lines:[];
 $('editorLines').innerHTML=rows.map((line,i)=>
 '<tr data-line="'+i+'"><td><input class="control" maxlength="180" data-line-field="name" aria-label="Ингредиент '+(i+1)+'" placeholder="Название сырья или ПФ" value="'+esc(line.name||'')+'"></td>'+
 '<td><input class="control" data-line-field="gross_g" type="number" min="0" step=".001" inputmode="decimal" aria-label="Брутто '+(i+1)+'" placeholder="0" value="'+esc(line.gross_g??'')+'"></td>'+
 '<td><input class="control" data-line-field="net_g" type="number" min="0" step=".001" inputmode="decimal" aria-label="Нетто '+(i+1)+'" placeholder="0" value="'+esc(line.net_g??'')+'"></td>'+
 '<td><div class="line-actions">'+
 '<button type="button" title="Переместить выше" data-move-line="'+i+'" data-direction="-1" aria-label="Выше: '+(i+1)+'" '+(i===0?'disabled':'')+'>'+icon('left')+'</button>'+
 '<button type="button" title="Переместить ниже" data-move-line="'+i+'" data-direction="1" aria-label="Ниже: '+(i+1)+'" '+(i===rows.length-1?'disabled':'')+'>'+icon('left')+'</button>'+
 '<button type="button" title="Дублировать строку" data-duplicate-line="'+i+'" aria-label="Дублировать: '+(i+1)+'">'+icon('copy')+'</button>'+
 '<button type="button" class="remove-line" title="Удалить строку" data-remove-line="'+i+'" aria-label="Удалить: '+(i+1)+'">'+icon('trash')+'</button>'+
 '</div></td></tr>').join('');
 $('undoLineBtn').hidden=!lastRemovedLine;
 sumLines();
}
function sumLines(){
 let gross=0,net=0;
 for(const l of draft?.lines||[]){
  gross+=Math.max(0,Number(l.gross_g)||0);
  net+=Math.max(0,Number(l.net_g)||0);
 }
 $('sumNet').textContent=fmt(net)+' г';$('sumGross').textContent=fmt(gross)+' г';
 const y=draft?.yield_g;
 const info=$('yieldCompare');
 if(!info)return;
 if(y==null||Number(y)<=0){info.textContent='Укажи выход блюда на вкладке «Основное», чтобы сравнить массу.';info.className='line-yield-compare';return}
 const delta=Number(y)-net;
 info.textContent='Заявленный выход: '+fmt(y)+' г · сумма нетто: '+fmt(net)+' г · разница: '+fmt(delta)+' г. Расхождение требует технологической проверки.';
 info.className='line-yield-compare'+(Math.abs(delta)<.001?' matched':' discrepancy');
}
function getLineInputs(){
 draft.lines=[...$('editorLines').querySelectorAll('tr[data-line]')].map(tr=>({
  name:tr.querySelector('[data-line-field="name"]')?.value.trim()||'',
  gross_g:n(tr.querySelector('[data-line-field="gross_g"]')?.value),
  net_g:n(tr.querySelector('[data-line-field="net_g"]')?.value)
 }));
}
function syncDraft(options={}){
 if(!draft)return;
 draft.project_id=$('eProject').value;draft.title=$('eTitle').value.trim();
 draft.code=$('eCode').value.trim();draft.category=$('eCategory').value.trim()||'Блюда';
 draft.yield_g=n($('eYield').value);draft.status=$('eStatus').value;
 draft.fields=draft.fields||{};
 Object.entries(fieldMap).forEach(([id,key])=>draft.fields[key]=$(id).value.trim());
 getLineInputs();dirty=true;
 $('editorHeading').textContent=draft.title||'Новая технико-технологическая карта';
 sumLines();
 if(options.noPaperRender){renderReview()}
 else renderPreview();
}
function lineRemove(index){
 if(!draft)return;syncDraft();
 if(index<0||index>=draft.lines.length)return;
 lastRemovedLine={index,line:clone(draft.lines[index])};
 draft.lines.splice(index,1);dirty=true;renderLineRows();renderPreview();renderReview();
 tell('Строка удалена. Можно вернуть её кнопкой «Вернуть строку».');
}
function lineUndo(){
 if(!draft||!lastRemovedLine)return;
 syncDraft();
 draft.lines.splice(Math.min(lastRemovedLine.index,draft.lines.length),0,lastRemovedLine.line);
 lastRemovedLine=null;dirty=true;renderLineRows();renderPreview();renderReview();
}
function lineMove(index,direction){
 if(!draft)return;syncDraft();
 const other=index+direction;
 if(index<0||other<0||index>=draft.lines.length||other>=draft.lines.length)return;
 [draft.lines[index],draft.lines[other]]=[draft.lines[other],draft.lines[index]];
 dirty=true;renderLineRows();renderPreview();renderReview();
}
function lineDuplicate(index){
 if(!draft)return;syncDraft();
 if(index<0||index>=draft.lines.length)return;
 if(draft.lines.length>=100){tell('Допустимо не более 100 строк на документ.',true);return}
 draft.lines.splice(index+1,0,clone(draft.lines[index]));
 dirty=true;renderLineRows();renderPreview();renderReview();
}
function clearEmptyLines(){
 if(!draft)return;syncDraft();
 const before=draft.lines.length;
 draft.lines=draft.lines.filter(l=>String(l.name||'').trim()||l.gross_g!=null||l.net_g!=null);
 if(before===draft.lines.length){tell('Пустых строк нет.');return}
 lastRemovedLine=null;dirty=true;renderLineRows();renderPreview();renderReview();
 tell('Удалено пустых строк: '+(before-draft.lines.length));
}
function setTab(tab){
 editorTab=['main','lines','tech','design','review'].includes(tab)?tab:'main';
 document.querySelectorAll('[data-tab]').forEach(b=>{
  const on=b.dataset.tab===editorTab;b.classList.toggle('active',on);
  b.setAttribute('aria-selected',on?'true':'false');
 });
 document.querySelectorAll('[data-tab-panel]').forEach(p=>p.hidden=p.dataset.tabPanel!==editorTab);
}
function renderEditorDesigns(){
 if(!$('editorDesigns'))return;
 $('editorDesigns').innerHTML=templates.map(t=>
 '<button type="button" class="design-tile '+(draft?.template===t.id?'active':'')+'" data-editor-template="'+t.id+'">'+
 '<div class="design-mini '+t.id+'"><i></i><i></i><i></i><i></i><i></i></div><strong>'+esc(t.name)+'</strong><small>'+esc(t.sub)+'</small></button>').join('');
}
async function photoSelected(){
 if(!draft)return;
 const file=$('ePhotoInput').files?.[0];if(!file)return;
 try{draft.photo_data=await imageData(file,950);dirty=true;renderPhotoZone();renderPreview();tell('Фото блюда загружено в редактор. Сохраните ТТК, чтобы закрепить его.')}
 catch(e){tell(errText(e),true)}finally{$('ePhotoInput').value=''}
}
function approvedIssues(d){
 const f=d.fields||{},issues=[];
 if(!d.project_id||!byProject(d.project_id))issues.push('проект');
 if(!d.title.trim())issues.push('название блюда');
 if(!Number.isFinite(Number(d.yield_g))||Number(d.yield_g)<=0)issues.push('выход блюда');
 if(!Array.isArray(d.lines)||!d.lines.length||d.lines.some(l=>!String(l.name||'').trim()||n(l.gross_g)==null||n(l.net_g)==null||n(l.gross_g)<0||n(l.net_g)<0))issues.push('полная рецептура брутто/нетто');
 for(const [key,label] of [['scope','область применения'],['raw','требования к сырью'],['process','технологический процесс'],['serving','подача и реализация'],['storage','условия хранения'],['quality','показатели качества'],['allergens','аллергены'],['nutrition','КБЖУ'],['developed','разработал'],['approved','утвердил'],['date','дата утверждения']]){
  if(!String(f[key]||'').trim())issues.push(label);
 }
 if(f.verified!=='yes')issues.push('ручное подтверждение документов');
 return issues;
}
function validateDoc(d){
 if(!d||!d.project_id||!byProject(d.project_id))throw Error('Сначала выберите проект.');
 if(!d.title.trim())throw Error('Введите название блюда.');
 if(d.title.length>180)throw Error('Название длиннее 180 символов.');
 if(d.yield_g!=null&&(!Number.isFinite(Number(d.yield_g))||Number(d.yield_g)<=0))throw Error('Выход блюда должен быть больше нуля.');
 if(!Array.isArray(d.lines)||d.lines.length>100)throw Error('В ТТК должно быть не более 100 ингредиентов.');
 for(const l of d.lines){
  if(n(l.gross_g)!=null&&n(l.gross_g)<0||n(l.net_g)!=null&&n(l.net_g)<0)throw Error('Масса ингредиента не может быть отрицательной.');
 }
 if(d.status==='Утверждено'){
  const issues=approvedIssues(d);
  if(issues.length)throw Error('Для утверждения проверьте: '+issues.slice(0,5).join(', ')+(issues.length>5?' и другие обязательные поля':''));
 }
}
async function saveDocument(){
 if(!draft||busy)return;
 syncDraft();
 try{validateDoc(draft)}catch(e){tell(errText(e),true);return}
 setBusy(true);
 const payload={project_id:draft.project_id,title:draft.title,code:draft.code||'',category:draft.category||'Блюда',
  status:draft.status,yield_g:draft.yield_g,photo_data:draft.photo_data||null,
  lines:draft.lines,fields:draft.fields,template:draft.template,updated_at:new Date().toISOString()};
 try{
  let rows;
  if(workingId){
   const version=draft.version||1;
   rows=await api('/rest/v1/ttk_documents?id=eq.'+workingId+'&version=eq.'+version+'&select=*',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:{...payload,version:version+1}});
   if(!rows?.[0])throw Error('Карточка изменилась в другом окне. Обновите её из библиотеки перед сохранением.');
  }else{
   rows=await api('/rest/v1/ttk_documents?select=*',{method:'POST',
     headers:{Prefer:'return=representation'},body:payload});
   if(!rows?.[0]?.id)throw Error('Сервер не подтвердил создание ТТК.');
  }
  const saved=rows[0];workingId=saved.id;draft=clone(saved);dirty=false;
  docs=docs.filter(d=>d.id!==saved.id);docs.unshift(saved);lastRemovedLine=null;
  $('editorDuplicate').hidden=false;renderAll();fillEditor();
  tell('ТТК сохранена в проекте «'+projectName(saved.project_id)+'» · версия '+saved.version);
 }catch(e){tell('Не удалось сохранить ТТК: '+errText(e),true)}
 finally{setBusy(false)}
}
async function archiveDocument(id){
 const d=docs.find(x=>x.id===id);if(!d)return;
 const next=d.status==='Архив'?'Черновик':'Архив';
 if(next==='Архив'&&!confirm('Отправить «'+d.title+'» в архив? Документ сохранится.'))return;
 try{
  const rows=await api('/rest/v1/ttk_documents?id=eq.'+id+'&version=eq.'+d.version+'&select=*',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:{status:next,version:d.version+1,updated_at:new Date().toISOString()}});
  if(!rows?.[0])throw Error('Изменения не подтверждены. Обновите страницу.');
  docs=docs.map(x=>x.id===id?rows[0]:x);
  if(workingId===id&&draft){draft.status=rows[0].status;draft.version=rows[0].version;$('eStatus').value=draft.status;renderPreview()}
  renderAll();tell(next==='Архив'?'ТТК перенесена в архив':'ТТК восстановлена как черновик');
 }catch(e){tell(errText(e),true)}
}
async function deleteDocument(id){
 const d=docs.find(x=>x.id===id);if(!d)return;
 if(!confirm('Удалить ТТК «'+d.title+'» безвозвратно? Это действие нельзя отменить.'))return;
 try{
  const rows=await api('/rest/v1/ttk_documents?id=eq.'+id+'&select=id',{
   method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!rows?.[0])throw Error('Сервер не подтвердил удаление');
  docs=docs.filter(x=>x.id!==id);
  if(workingId===id){workingId=null;draft=null;dirty=false;navigate('library',true)}
  renderAll();tell('ТТК удалена из библиотеки');
 }catch(e){tell('Не удалось удалить: '+errText(e),true)}
}
function openCopy(id){
 const d=docs.find(x=>x.id===id)|| (draft?.id===id?draft:null);if(!d)return;
 if(!projects.some(p=>!p.is_archived)){tell('Создайте активный проект для копии.',true);return}
 copySourceId=id;
 $('copyProject').innerHTML=projects.filter(p=>!p.is_archived).map(p=>
 '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
 $('copyProject').value=projects.some(p=>p.id===d.project_id&&!p.is_archived)?d.project_id:projects.find(p=>!p.is_archived).id;
 $('copyDialog').showModal();
}
async function copyDocument(ev){
 ev.preventDefault();if(busy)return;
 const source=docs.find(x=>x.id===copySourceId)|| (draft?.id===copySourceId?draft:null);
 if(!source){tell('Оригинальная ТТК не найдена',true);return}
 const dest=byProject($('copyProject').value);
 if(!dest||dest.is_archived){tell('Выберите действующий проект',true);return}
 const fields={...clone(source.fields||{}),verified:'no',approved:'',date:''};
 const payload={project_id:dest.id,title:source.title+' — копия',code:source.code?source.code+'-COPY':'',
  category:source.category,status:'Черновик',yield_g:source.yield_g,photo_data:source.photo_data,
  lines:clone(source.lines||[]),fields,template:source.template||'atelier',version:1};
 setBusy(true);try{
  const rows=await api('/rest/v1/ttk_documents?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:payload});
  if(!rows?.[0])throw Error('Сервер не подтвердил создание копии');
  docs.unshift(rows[0]);$('copyDialog').close();renderAll();openDocument(rows[0].id);
  tell('Независимая копия сохранена в «'+dest.name+'»');
 }catch(e){tell('Не удалось скопировать: '+errText(e),true)}finally{setBusy(false)}
}

function renderReview(){
 if(!draft)return;
 const f=draft.fields||{},validLines=Array.isArray(draft.lines)&&draft.lines.length>0&&draft.lines.every(l=>
  !!String(l.name||'').trim()&&n(l.gross_g)!=null&&n(l.net_g)!=null&&n(l.gross_g)>=0&&n(l.net_g)>=0);
 const check=[
  ['Выбран проект',!!byProject(draft.project_id),'main'],
  ['Название блюда',!!draft.title?.trim(),'main'],
  ['Выход блюда больше нуля',draft.yield_g!=null&&draft.yield_g>0,'main'],
  ['Рецептура: названия и граммовки',validLines,'lines'],
  ['Область применения',!!f.scope?.trim(),'tech'],
  ['Требования к сырью',!!f.raw?.trim(),'tech'],
  ['Технологический процесс',!!f.process?.trim(),'tech'],
  ['Оформление и реализация',!!f.serving?.trim(),'tech'],
  ['Сроки и условия хранения',!!f.storage?.trim(),'tech'],
  ['Качество и безопасность',!!f.quality?.trim(),'tech'],
  ['Аллергены (источник проверен вручную)',!!f.allergens?.trim(),'tech'],
  ['КБЖУ (источник проверен вручную)',!!f.nutrition?.trim(),'tech'],
  ['Разработал и утвердил',!!f.developed?.trim()&&!!f.approved?.trim(),'tech'],
  ['Дата утверждения',!!f.date?.trim(),'tech'],
  ['Ручное подтверждение сведений',f.verified==='yes','tech']
 ];
 const done=check.filter(v=>v[1]).length,total=check.length;
 const pct=Math.round(done/total*100);
 $('ttkCheckCount').textContent=done+' / '+total;
 $('ttkCheckBar').style.width=pct+'%';
 $('ttkCheckTitle').textContent=done===total?'Поля документа заполнены':'Проверка заполненности ТТК';
 $('ttkCheckHint').textContent=done===total?
  'Теперь ответственный должен подтвердить соответствие продукции требованиям.' :
  'Не заполнено: '+(total-done)+' пунктов. До проверки сохраняй документ как черновик.';
 $('reviewChecklist').innerHTML=check.map(([label,ok,tab],i)=>
  '<button class="review-item '+(ok?'complete':'incomplete')+'" type="button" data-review-tab="'+tab+'">'+
  '<span class="review-number">'+(ok?icon('check'):(i+1))+'</span>'+
  '<span class="review-item-text">'+esc(label)+'</span>'+
  '<strong>'+(ok?'Заполнено':'Заполнить')+'</strong></button>').join('');
 const badge=$('editorSaveBadge');
 if(badge){
  badge.textContent=!draft.id?'● Новый документ · не сохранён':
    dirty?'● Есть несохранённые изменения':'✓ Сохранено в библиотеке · версия '+(draft.version||1);
  badge.className='editor-save-badge'+(!draft.id||dirty?' unsaved':' saved');
 }
 const save=$('saveDoc');if(save)save.textContent=dirty&&!!draft.id?'Сохранить изменения':'Сохранить ТТК';
}

/* Premium A4 preview; all variable content is escaped before interpolation. */

function editablePaper(id,val,hint,kind='multi'){
 const label=String(hint||id);
 if(kind==='date')return '<input type="date" class="sheet-edit sheet-date" data-sheet-field="'+id+'" value="'+esc(val||'')+'" aria-label="'+esc(label)+'">';
 if(kind==='number')return '<input type="number" min="0.001" step="0.001" inputmode="decimal" class="sheet-edit sheet-number" data-sheet-field="'+id+'" value="'+esc(val??'')+'" placeholder="0" aria-label="'+esc(label)+'">';
 return '<span class="sheet-edit '+(kind==='line'?'sheet-single':'sheet-text')+'" contenteditable="true" spellcheck="false" data-sheet-field="'+id+'" role="textbox" aria-label="'+esc(label)+'" data-placeholder="'+esc(label)+'">'+esc(String(val||'')).replace(/\n/g,'<br>')+'</span>';
}
function sheetParagraph(id,number,label,val,hint,sectionClass=''){
 return '<section class="sheet-section '+sectionClass+'"><div class="sheet-section-head"><span>'+esc(number)+'</span><h3>'+esc(label)+'</h3></div>'+
 '<div class="sheet-section-content">'+editablePaper(id,val,hint)+'</div></section>';
}
function buildSheetRow(line,i){
 return '<tr data-sheet-line="'+i+'">'+
 '<td class="sheet-seq">'+String(i+1).padStart(2,'0')+'</td>'+
 '<td class="sheet-item-name"><span class="sheet-edit sheet-single" contenteditable="true" spellcheck="false" data-sheet-line-field="name" data-placeholder="Название сырья / ПФ" role="textbox" aria-label="Название ингредиента '+(i+1)+'">'+esc(line.name||'')+'</span></td>'+
 '<td><input class="sheet-edit sheet-weight" type="number" min="0" step="0.001" inputmode="decimal" data-sheet-line-field="gross_g" value="'+esc(line.gross_g??'')+'" placeholder="0" aria-label="Брутто, строка '+(i+1)+'"></td>'+
 '<td><input class="sheet-edit sheet-weight" type="number" min="0" step="0.001" inputmode="decimal" data-sheet-line-field="net_g" value="'+esc(line.net_g??'')+'" placeholder="0" aria-label="Нетто, строка '+(i+1)+'"></td>'+
 '<td class="sheet-row-actions sheet-screen-only">'+
 '<button type="button" data-sheet-move="'+i+'" data-sheet-move-dir="-1" aria-label="Строка выше" title="Выше">↑</button>'+
 '<button type="button" data-sheet-move="'+i+'" data-sheet-move-dir="1" aria-label="Строка ниже" title="Ниже">↓</button>'+
 '<button type="button" data-sheet-remove="'+i+'" aria-label="Убрать ингредиент" title="Удалить строку">×</button></td>'+
 '</tr>';
}
function renderPreview(){
 if(!draft)return;
 const paper=$('paper'),p=byProject(draft.project_id),f=draft.fields||{};
 paper.className='sheet-document archive-sheet';
 paper.innerHTML='<div class="sheet-main archive-sheet-content" data-template="'+({atelier:'a4-01',classic:'a4-02',arctic:'a4-04'}[draft.template]||'a4-01')+'">'+window.FARUKH_ARCHIVE_HTML+'</div>';
 const q=s=>paper.querySelector(s);
 paper.querySelectorAll('[data-layout]').forEach(el=>el.removeAttribute('contenteditable'));
 const mapping={code:['eCode',draft.code],name:['eTitle',draft.title],category:['eCategory',draft.category],yield_g:['eYield',draft.yield_g],scope:['fScope',f.scope],raw_requirements:['fRaw',f.raw],storage:['fStorage',f.storage],allergens:['fAllergens',f.allergens],introduced_at:['fDate',f.date],developed_by:['fDeveloped',f.developed],approved_by:['fApproved',f.approved]};
 Object.entries(mapping).forEach(([key,[id,value]])=>{const el=q('[data-key="'+key+'"]');if(!el)return;el.dataset.sheetField=id;if(el.matches('input')){el.value=value??'';el.readOnly=false}else el.textContent=value||'';el.setAttribute('aria-label',key)});
 const parts=f.archive_parts||{};
 const groups={process:['step1','step2','step3','step4'],serving:['serving_design','serving_sale','serving_transport'],quality:['quality_appearance','quality_consistency','quality_taste','quality_color','quality_safety'],nutrition:['protein','fat','carbs','kcal']};
 Object.entries(groups).forEach(([group,keys])=>keys.forEach((key,i)=>{const el=q('[data-key="'+key+'"]');el.dataset.archiveField=key;el.dataset.archiveGroup=group;el.textContent=parts[key]??(i===0&&group!=='nutrition'?(f[group]||''):'');el.setAttribute('aria-label',key)}));
 q('#nutritionHead').textContent='На 100 г готового продукта:';
 if(f.nutrition&&!groups.nutrition.some(k=>parts[k])){const legacy=document.createElement('div');legacy.className='archive-nutrition-legacy edit';legacy.dataset.sheetField='fNutrition';legacy.contentEditable='true';legacy.textContent=f.nutrition;q('.card7 .body').append(legacy)}
 q('#brand').dataset.command='sheetProjectEdit';q('#brand').title='Изменить логотип бренда';
 q('.brandname').textContent=p?.name||'Ваш бренд';q('.brandsub').textContent='';
 const logo=q('#logo');if(p&&validImg(p.logo_data))logo.src=p.logo_data;else if(!/море|more/i.test(p?.name||'')){logo.remove();q('.brandname').style.marginTop='35px'}
 q('#photoInput')?.remove();q('#photoBox').dataset.command='sheetPhoto';q('#photoBox').setAttribute('role','button');q('#photoBox').tabIndex=0;
 if(validImg(draft.photo_data)){q('#dishPhoto').src=draft.photo_data;q('#dishPhoto').style.display='block';q('#photoPlaceholder').style.display='none'}
 const rows=draft.lines||[];q('#recipeLines').id='sheetIngredients';q('#sheetIngredients').innerHTML=rows.map(buildSheetRow).join('');
 q('#recipeTable th:last-child').textContent='';q('#recipeTable th:last-child').classList.add('sheet-screen-only');
 q('#recipeTable tfoot td').colSpan=3;q('#totalYield').textContent=fmt(draft.yield_g)+' г';
 q('.smalltools').innerHTML='<button type="button" data-command="sheetAddLine">＋ Строка</button><span>Брутто: <b id="sheetTotalGross">'+fmt(rows.reduce((s,l)=>s+(Number(l.gross_g)||0),0))+' г</b> · Нетто: <b id="sheetTotalNet">'+fmt(rows.reduce((s,l)=>s+(Number(l.net_g)||0),0))+' г</b></span>';
 $('previewStatus').textContent=draft.status||'Черновик';refreshSheetToolbar();fitPaper();requestAnimationFrame(detectOverflow);renderReview();
}

/* One-sheet, WYSIWYG editing. Existing validated data model remains the source of truth. */
let sheetManualZoom=null, sheetOverflowRequest=0;
function refreshSheetToolbar(){
 const project=$('sheetProject'),status=$('sheetStatus'),verified=$('sheetVerified');
 if(!project||!status||!verified||!draft)return;
 const options=projects.filter(p=>!p.is_archived||p.id===draft.project_id);
 const now=project.value;
 const currentOptions=options.map(p=>p.id).join('|');
 if(project.dataset.optionIds!==currentOptions){
  project.innerHTML='<option value="">Выберите проект</option>'+options.map(p=>
   '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
  project.dataset.optionIds=currentOptions;
 }
 project.value=draft.project_id||'';
 status.value=draft.status||'Черновик';
 verified.checked=draft.fields?.verified==='yes';
 document.querySelectorAll('[data-sheet-theme]').forEach(btn=>{
  const active=btn.dataset.sheetTheme===draft.template;
  btn.classList.toggle('active',active);
  btn.setAttribute('aria-pressed',String(active));
 });
}
function collectSheetValues(){
 if(!draft)return;
 const paper=$('paper');
 if(!paper||!paper.classList.contains('sheet-document'))return;
 for(const field of paper.querySelectorAll('[data-sheet-field]')){
  const id=field.dataset.sheetField,hidden=$(id);
  if(!hidden)continue;
  const isNative=field.matches('input,select,textarea');
  let val=isNative?field.value:field.innerText;
  val=String(val||'').replace(/\u00a0/g,' ').replace(/\r/g,'').trim();
  if(id==='eTitle')val=val.slice(0,180);
  if(id==='eCode')val=val.slice(0,40);
  if(id==='eCategory')val=val.slice(0,90);
  hidden.value=val;
 }
 const archive=[...paper.querySelectorAll('[data-archive-field]')];
 if(archive.length){
  draft.fields=draft.fields||{};const parts=draft.fields.archive_parts||{};
  archive.forEach(el=>parts[el.dataset.archiveField]=(el.innerText||'').trim());draft.fields.archive_parts=parts;
  const ids={process:'fProcess',serving:'fServing',quality:'fQuality',nutrition:'fNutrition'};
  Object.entries(ids).forEach(([group,id])=>{const cells=archive.filter(el=>el.dataset.archiveGroup===group);const labels={protein:'Белки, г',fat:'Жиры, г',carbs:'Углеводы, г',kcal:'Энергия, ккал',quality_appearance:'Внешний вид',quality_consistency:'Консистенция',quality_taste:'Вкус и запах',quality_color:'Цвет',quality_safety:'Безопасность'};const text=cells.filter(el=>parts[el.dataset.archiveField]).map(el=>(labels[el.dataset.archiveField]?labels[el.dataset.archiveField]+': ':'')+parts[el.dataset.archiveField]).join('\n');if(group!=='nutrition'||text)$(id).value=text});
 }
 const rows=[...paper.querySelectorAll('tr[data-sheet-line]')];
 draft.lines=rows.map(tr=>{
  const name=tr.querySelector('[data-sheet-line-field="name"]');
  const gross=tr.querySelector('[data-sheet-line-field="gross_g"]');
  const net=tr.querySelector('[data-sheet-line-field="net_g"]');
  return {
   name:(name?.innerText||'').replace(/\u00a0/g,' ').trim().slice(0,180),
   gross_g:n(gross?.value??''),net_g:n(net?.value??'')
  };
 });
 renderLineRows(); // synchronize the hidden legacy form for shared save/validation functions
}
function sheetMassSummary(){
 if(!draft)return;
 const gross=draft.lines.reduce((acc,l)=>acc+(Number(l.gross_g)||0),0);
 const net=draft.lines.reduce((acc,l)=>acc+(Number(l.net_g)||0),0);
 if($('totalYield'))$('totalYield').textContent=fmt(draft.yield_g)+' г';
 if($('sheetTotalGross'))$('sheetTotalGross').textContent=fmt(gross)+' г';
 if($('sheetTotalNet'))$('sheetTotalNet').textContent=fmt(net)+' г';
 sumLines();
}
function sheetInputHandler(event){
 if(!draft||!event.target.closest('[data-sheet-field],[data-sheet-line],[data-archive-field]'))return;
 collectSheetValues();
 syncDraft({noPaperRender:true});
 sheetMassSummary();
 // Don't replace the live paper while the caret is inside an editable field.
 cancelAnimationFrame(sheetOverflowRequest);
 sheetOverflowRequest=requestAnimationFrame(()=>detectOverflow());
}
function directSheetMove(index,direction){
 collectSheetValues();
 lineMove(index,direction);
}
function directSheetRemove(index){
 collectSheetValues();
 lineRemove(index);
}
function plainSheetPaste(event){
 const edit=event.target.closest('[contenteditable="true"]');
 if(!edit)return;
 event.preventDefault();
 const text=event.clipboardData?.getData('text/plain')||'';
 const max=edit.dataset.sheetField==='eTitle'?180:edit.dataset.sheetField==='eCode'?40:
  edit.dataset.sheetField==='eCategory'?90:edit.hasAttribute('data-sheet-line-field')?180:2400;
 const selection=window.getSelection();
 if(!selection||!selection.rangeCount)return;
 const range=selection.getRangeAt(0);
 const used=(edit.innerText||'').length-selection.toString().length;
 const chunk=text.replace(/\r/g,'').slice(0,Math.max(0,max-used));
 range.deleteContents();
 const node=document.createTextNode(chunk);
 range.insertNode(node);
 range.setStartAfter(node);range.collapse(true);
 selection.removeAllRanges();selection.addRange(range);
 edit.dispatchEvent(new Event('input',{bubbles:true}));
}
function sheetZoomBy(amount){
 const stage=$('paperStage');
 if(!stage)return;
 const natural=Math.min(1,Math.max(.35,(stage.clientWidth-28)/794));
 sheetManualZoom=Math.max(.4,Math.min(1.6,Math.round(((sheetManualZoom??natural)+amount)*100)/100));
 fitPaper();
}
function sheetSelectProject(){
 if(!draft)return;
 collectSheetValues();
 const id=$('sheetProject').value;
 if(!byProject(id)){tell('Выберите проект для ТТК',true);return}
 const prior=draft.project_id;
 $('eProject').value=id;
 if(!draft.id&&$('eCode').value===nextTtkCode(prior))$('eCode').value=nextTtkCode(id);
 syncDraft();
}
function sheetSelectStatus(){
 if(!draft)return;
 collectSheetValues();
 const value=$('sheetStatus').value;
 if(value==='Утверждено'){
  $('eStatus').value=value;
  syncDraft({noPaperRender:true});
  const issues=approvedIssues(draft);
  if(issues.length){
   $('eStatus').value='На проверке';
   draft.status='На проверке';
   $('sheetStatus').value='На проверке';
   tell('Пока нельзя утвердить ТТК: '+issues.slice(0,3).join(', ')+'. Сохраняй как черновик или «На проверке».',true);
  }
 }else $('eStatus').value=value;
 syncDraft();
}
function sheetCheckVerified(){
 if(!draft)return;
 const checked=$('sheetVerified').checked;
 if(checked&&!confirm('Подтверждаете, что сведения о сырье, аллергенах, КБЖУ и хранении проверены по документам и проработке?')){
  $('sheetVerified').checked=false;return;
 }
 collectSheetValues();
 $('fVerified').value=checked?'yes':'no';
 if(!checked&&$('eStatus').value==='Утверждено')$('eStatus').value='На проверке';
 syncDraft();
}

function fitPaper(){
 const stage=$('paperStage'),holder=$('paperHolder'),paper=$('paper');
 if(!stage||!holder||!paper||stage.clientWidth<50)return;
 const auto=Math.min(1,Math.max(.35,(stage.clientWidth-28)/794));
 const scale=sheetManualZoom??auto;
 holder.style.width=Math.round(794*scale)+'px';
 holder.style.height=Math.round(1123*scale)+'px';
 paper.style.transform='scale('+scale+')';
 if($('sheetZoomValue'))$('sheetZoomValue').textContent=Math.round(scale*100)+'%';
}
function detectOverflow(){
 const paper=$('paper'),stage=$('paperStage'),main=paper?.querySelector('.sheet-main');
 if(!paper||!stage||!main)return false;
 // Full A4: never silently clip content or shrink typography to hide overflows.
 const bodyOverflow=main.scrollHeight>main.clientHeight+3||main.scrollWidth>main.clientWidth+3;
 const pageOverflow=paper.scrollHeight>1126||paper.scrollWidth>797;
 const childOverflow=[...main.querySelectorAll('.sheet-section,.sheet-dish-header,.sheet-recipe-section,.sheet-signatures,.card .body,.card .edit,#f5 .edit' )]
  .some(el=>el.scrollHeight>el.clientHeight+4||el.scrollWidth>el.clientWidth+4);
 const overflow=bodyOverflow||pageOverflow||childOverflow;
 let hint=$('paperOverflow');
 if(!hint){
  hint=document.createElement('div');
  hint.id='paperOverflow';hint.className='notice sheet-overflow-notice';
  hint.style.marginTop='10px';stage.after(hint);
 }
 hint.hidden=!overflow;
 hint.textContent=overflow?
  '⚠️ Материалы не помещаются на 1 лист А4. Сократите формулировки без удаления обязательных сведений. Печать заблокирована, чтобы не обрезать документ.':'';
 if($('editorPrint')){
  $('editorPrint').disabled=overflow;
  $('editorPrint').title=overflow?'Переполнение листа А4. Сначала исправьте документ.':'Печать / сохранение в PDF';
 }
 return overflow;
}
async function printDocument(){
 if(!draft){tell('Сначала создайте или откройте ТТК',true);return}
 collectSheetValues();
 syncDraft();
 if(draft.status==='Утверждено'){
  const issues=approvedIssues(draft);if(issues.length){tell('Нельзя печатать как утверждённую ТТК: '+issues.slice(0,3).join(', '),true);return}
 }
 try{
  await Promise.all([...$('paper').querySelectorAll('img')].map(img=>img.decode()));
  if(document.fonts?.ready)await document.fonts.ready;
 }catch{tell('Фото или фон ещё не загружены. Проверьте соединение и повторите печать.',true);return}
 if(detectOverflow()){tell('Печать заблокирована: документ выходит за границы одного листа А4.',true);return}
 window.print();
}
/* Main actions and keyboard-safe event wiring. */
function onCommand(name){
 if(name==='sheetAddLine'){
  if(!draft)return;
  collectSheetValues();
  if(draft.lines.length>=100){tell('Не более 100 ингредиентов на ТТК.',true);return}
  draft.lines.push({name:'',gross_g:null,net_g:null});
  renderLineRows();dirty=true;renderPreview();
  const row=$('paper')?.querySelector('tr[data-sheet-line]:last-child [data-sheet-line-field="name"]');
  row?.focus();return;
 }
 if(name==='sheetUndoLine'){collectSheetValues();lineUndo();return}
 if(name==='sheetPhoto'){$('ePhotoInput')?.click();return}
 if(name==='sheetRemovePhoto'){
  if(!draft)return;
  collectSheetValues();
  if(!confirm('Удалить фотографию из этой ТТК?'))return;
  draft.photo_data=null;dirty=true;renderPhotoZone();renderPreview();return;
 }
 if(name==='sheetProjectEdit'){
  if(draft?.project_id)return openProjectDialog(draft.project_id);
  tell('Сначала выберите проект.',true);return;
 }
 if(name==='sheetZoomIn')return sheetZoomBy(.1);
 if(name==='sheetZoomOut')return sheetZoomBy(-.1);
 if(name==='sheetZoomFit'){sheetManualZoom=null;fitPaper();return}
 if(name==='newDoc')return startNewDoc();
 if(name==='newProject')return openProjectDialog();
 if(name==='closeProject'){pendingCreate=false;$('projectDialog').close();return}
 if(name==='closeCopy'){$('copyDialog').close();return}
 if(name==='saveDoc')return saveDocument();
 if(name==='library'||name==='projects'||name==='templates'||name==='dashboard'||name==='settings')return navigate(name);
 if(name==='addLine'){
  if(!draft)return;
  syncDraft();draft.lines.push({name:'',gross_g:null,net_g:null});
  renderLineRows();renderPreview();return;
 }
 if(name==='undoLine')return lineUndo();
 if(name==='clearEmptyLines')return clearEmptyLines();
 if(name==='showReview'){setTab('review');renderReview();return}
 if(name==='goTech'){setTab('tech');return}
 if(name==='removePhoto'){if(draft){draft.photo_data=null;dirty=true;renderPhotoZone();renderPreview()}return}
 if(name==='print')return printDocument();
 if(name==='duplicate'){if(draft?.id)return openCopy(draft.id);tell('Сначала сохраните ТТК для копирования.',true);return}
}
function clickHandler(ev){
 const t=ev.target;
 const btn=t.closest('[data-nav],[data-link],[data-command],[data-project-open],[data-project-edit],[data-project-archive],[data-project-remove],[data-doc-open],[data-doc-copy],[data-doc-archive],[data-doc-delete],[data-template-create],[data-editor-template],[data-tab],[data-remove-line],[data-sheet-remove],[data-sheet-move],[data-sheet-theme],[data-move-line],[data-duplicate-line],[data-review-tab]');
 if(!btn)return;
 if(btn.matches('a'))ev.preventDefault();
 if(btn.dataset.nav!==undefined){if(btn.dataset.nav==='editor'){if(draft)navigate('editor');else startNewDoc()}else navigate(btn.dataset.nav);return}
 if(btn.dataset.link!==undefined){navigate(btn.dataset.link);return}
 if(btn.dataset.command!==undefined){onCommand(btn.dataset.command);return}
 if(btn.dataset.projectOpen!==undefined){listForProject(btn.dataset.projectOpen);return}
 if(btn.dataset.projectEdit!==undefined){openProjectDialog(btn.dataset.projectEdit);return}
 if(btn.dataset.projectArchive!==undefined){toggleProjectArchive(btn.dataset.projectArchive);return}
 if(btn.dataset.projectRemove!==undefined){removeProject(btn.dataset.projectRemove);return}
 if(btn.dataset.docOpen!==undefined){openDocument(btn.dataset.docOpen);return}
 if(btn.dataset.docCopy!==undefined){openCopy(btn.dataset.docCopy);return}
 if(btn.dataset.docArchive!==undefined){archiveDocument(btn.dataset.docArchive);return}
 if(btn.dataset.docDelete!==undefined){deleteDocument(btn.dataset.docDelete);return}
 if(btn.dataset.templateCreate!==undefined){pendingTemplate=btn.dataset.templateCreate;startNewDoc(null,pendingTemplate);return}
 if(btn.dataset.editorTemplate!==undefined){if(draft){syncDraft();draft.template=btn.dataset.editorTemplate;dirty=true;renderEditorDesigns();renderPreview()}return}
 if(btn.dataset.sheetTheme!==undefined){
  if(!draft)return;
  collectSheetValues();
  if(templates.some(t=>t.id===btn.dataset.sheetTheme)){
   draft.template=btn.dataset.sheetTheme;dirty=true;renderPreview();
  }return;
 }
 if(btn.dataset.sheetRemove!==undefined){directSheetRemove(Number(btn.dataset.sheetRemove));return}
 if(btn.dataset.sheetMove!==undefined){
  directSheetMove(Number(btn.dataset.sheetMove),Number(btn.dataset.sheetMoveDir));return;
 }
 if(btn.dataset.tab!==undefined){setTab(btn.dataset.tab);return}
 if(btn.dataset.reviewTab!==undefined){setTab(btn.dataset.reviewTab);return}
 if(btn.dataset.moveLine!==undefined){lineMove(Number(btn.dataset.moveLine),Number(btn.dataset.direction));return}
 if(btn.dataset.duplicateLine!==undefined){lineDuplicate(Number(btn.dataset.duplicateLine));return}
 if(btn.dataset.removeLine!==undefined){lineRemove(Number(btn.dataset.removeLine));return}
}
function init(){
 paintIcons();
 document.addEventListener('click',clickHandler);
 $('loginForm').addEventListener('submit',signIn);
 $('logout').addEventListener('click',signOut);
 $('logoutMobile').addEventListener('click',signOut);
 $('projectForm').addEventListener('submit',saveProject);
 $('copyForm').addEventListener('submit',copyDocument);
 $('settingsForm').addEventListener('submit',saveSettings);
 $('pLogo').addEventListener('change',logoSelected);
 $('pRemoveLogo').addEventListener('click',()=>{modalLogo=null;renderLogoPreview();$('pLogoStatus').textContent='Логотип удалён из формы проекта'});
 for(const id of ['projectSearch','projectStatus'])$(id).addEventListener('input',renderProjects);
 for(const id of ['docSearch','docProject','docStatus'])$(id).addEventListener('input',renderLibrary);
 const editorIds=['eProject','eTitle','eCode','eCategory','eYield','eStatus',...Object.keys(fieldMap)];
 editorIds.forEach(id=>$(id).addEventListener('input',()=>{
  if(!draft)return;
  if(id==='eProject'&&!draft.id){
   const previous=nextTtkCode(draft.project_id);
   const current=$('eCode').value.trim();
   if(!current||current===previous)$('eCode').value=nextTtkCode($('eProject').value);
  }
  syncDraft();
 }));
 $('editorLines').addEventListener('input',()=>{if(draft)syncDraft()});
 $('ePhotoInput').addEventListener('change',photoSelected);
 $('paper').addEventListener('input',sheetInputHandler);
 $('paper').addEventListener('change',sheetInputHandler);
 $('paper').addEventListener('paste',plainSheetPaste);
 $('sheetProject').addEventListener('change',sheetSelectProject);
 $('sheetStatus').addEventListener('change',sheetSelectStatus);
 $('sheetVerified').addEventListener('change',sheetCheckVerified);

 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(currentView==='editor')fitPaper()}).observe($('paperStage'));
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 // Reuse the existing user login so this replacement starts empty without requiring new account setup.
 session=storedSession();
 if(!session){$('auth').hidden=false;return}
 (async()=>{if(await freshSession())await enter();else{
   session=null;persist();$('shell').hidden=true;$('auth').hidden=false;
 }})().catch(e=>{session=null;persist();$('shell').hidden=true;$('auth').hidden=false;
  $('authError').textContent='Войдите снова: '+errText(e)});
}
init();

})();
