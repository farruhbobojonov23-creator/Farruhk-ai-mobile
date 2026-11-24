/* FARRUH WORKSPACE PRO v1.1 · independent project launcher. 
   All user-owned changes save locally first and send a scoped cloud-sync event.
   Login/session data are managed by the existing MORE SUSHI studio. */
(function(){
'use strict';
const root=document.documentElement;
const app=document.getElementById('mssCategoryApp');
if(!app)return;
const tabs=new Set(['home','projects','ttk','tools','more']);
const defaults=[
 {id:'more',name:'MORE SUSHI STUDIO',desc:'ТТК · Рецептуры · Каталог · PDF',url:'./index.html?ocean=1',color:'ruby',symbol:'wc-fish'},
 {id:'ai',name:'FARRUH AI',desc:'ИИ-помощник шеф-повара',url:'https://farruhk-ai-mobile.onrender.com/',color:'charcoal',symbol:'wc-a'},
 {id:'revision',name:'FARUKH REVISION',desc:'Ревизия · Склад · Остатки',url:'./revision.html?rev=045',color:'green',symbol:'wc-chart'},
 {id:'print',name:'FARUKH PRINT',desc:'Этикетки · QR · Печать',url:'https://farruhk-ai-mobile.onrender.com/farukh-print/staff/',color:'blue',symbol:'wc-print'},
 {id:'kitchen',name:'FARUKH KITCHEN',desc:'База ТТК · ПФ · Обучение',url:'https://chefaka.onrender.com/',color:'gold',symbol:'wc-book'},
 {id:'shef51',name:'SHEF51',desc:'Сайт · Услуги · Бронирование',url:'https://shef51.onrender.com/',color:'blue',label:'51'},
 {id:'sushiberi',name:'СУШИ БЕРИ',desc:'Доставка · Меню · Акции',url:'https://sushi-beri.ru/murmansk',color:'ruby',symbol:'wc-fish'}
];
const key='farruh-workspace-projects-v1',favoritesKey='farruh-workspace-favorites-v1';
const safeColors=new Set(['ruby','blue','green','gold','charcoal']);
const $=(selector,parent=document)=>parent.querySelector(selector);
const $$=(selector,parent=document)=>Array.from(parent.querySelectorAll(selector));
function load(name,fallback){
 try{const x=JSON.parse(localStorage.getItem(name)||'null');return x===null?fallback:x}catch{return fallback}
}
let custom=load(key,[]);
if(!Array.isArray(custom))custom=[];
custom=custom.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.url==='string').slice(0,60);
let favorites=load(favoritesKey,[]);
if(!Array.isArray(favorites))favorites=[];
const persistLocal=()=>{try{localStorage.setItem(key,JSON.stringify(custom));localStorage.setItem(favoritesKey,JSON.stringify(favorites))}catch{toast('Не удалось сохранить: память устройства заполнена')}};
const save=()=>{persistLocal();window.dispatchEvent(new CustomEvent('hub:local-saved',{detail:{reason:'user-edit'}}))};
function toast(message){
 const el=$('#hubToast');if(!el)return;
 el.textContent=message;el.hidden=false;clearTimeout(el._timer);el._timer=setTimeout(()=>{el.hidden=true},3600);
}
function normalizeUrl(raw){
 try{const u=new URL(String(raw).trim(),document.baseURI);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))return null;
 return u.href;
 }catch{return null}
}
function allProjects(){
 const modified=defaults.map(p=>Object.assign({},p,custom.find(x=>x.id===p.id&&x.override) || {}));
 const own=custom.filter(p=>!p.override);
 return [...modified,...own].filter(p=>!!normalizeUrl(p.url));
}
function icon(name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 const use=document.createElementNS('http://www.w3.org/2000/svg','use');
 use.setAttribute('href','#'+name);svg.appendChild(use);return svg;
}
// Server applications with X-Frame-Options / CSP frame restrictions must not
// be opened as nested iframes: Android WebView shows ERR_BLOCKED_BY_RESPONSE.
// Treat external websites as top-level navigation by default, except the two
// sites verified in user screenshots to support embedding.
const frameApproved=new Map([
 ['kitchen','https://chefaka.onrender.com'],
 ['shef51','https://shef51.onrender.com']
]);
function canEmbed(p,url){
 try{
  const target=new URL(url);
  if(target.origin===location.origin)return true;
  return frameApproved.get(p.id)===target.origin;
 }catch{return false}
}
function directIcon(p){
 const url=normalizeUrl(p.url);
 return url&&!canEmbed(p,url)?'wc-external':'wc-arrow';
}
function byFavorite(list){return [...list].sort((a,b)=>Number(favorites.includes(b.id))-Number(favorites.includes(a.id)))}
function renderCard(p,{wide=false,edit=false}={}){
 const card=document.createElement('article');
 card.className='project-card p-'+(safeColors.has(p.color)?p.color:'ruby')+(wide?' wide-project':'');
 const top=document.createElement('div');top.className='project-top';
 const logo=document.createElement('span');logo.className='project-logo';
 if(typeof p.logo==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(p.logo)&&p.logo.length<140000){
   const img=document.createElement('img');img.src=p.logo;img.alt='';logo.appendChild(img);
 }else if(p.symbol){logo.appendChild(icon(p.symbol))}
 else {logo.textContent=p.label||p.name.slice(0,2).toUpperCase()}
 const fav=document.createElement('button');fav.type='button';fav.className='project-fav'+(favorites.includes(p.id)?' is-favorite':'');
 fav.setAttribute('aria-label',(favorites.includes(p.id)?'Убрать из избранного: ':'В избранное: ')+p.name);
 fav.appendChild(icon('wc-star'));
 fav.addEventListener('click',()=>{favorites=favorites.includes(p.id)?favorites.filter(x=>x!==p.id):[...favorites,p.id];save();renderProjects()});
 top.append(logo,fav);
 const name=document.createElement('strong');name.className='project-title';name.textContent=p.name;
 const desc=document.createElement('small');desc.className='project-desc';desc.textContent=p.desc;
 const go=document.createElement('button');go.type='button';go.className='project-go';go.setAttribute('aria-label','Открыть '+p.name);go.appendChild(icon(directIcon(p)));go.addEventListener('click',()=>openProject(p));
 card.append(top,name,desc,go);
 if(edit){
 const editBtn=document.createElement('button');editBtn.type='button';editBtn.className='project-edit';editBtn.textContent='Изменить';
 editBtn.addEventListener('click',()=>editProject(p));card.appendChild(editBtn);
 }
 card.addEventListener('click',e=>{
 if(e.target.closest('button'))return;
 openProject(p);
 });
 card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label',p.name);
 card.addEventListener('keydown',e=>{if(e.target!==card)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();openProject(p)}});
 return card;
}
function renderProjects(){
 const list=byFavorite(allProjects());
 const featured=$('#hubFeaturedProjects'),full=$('#hubAllProjects');
 if(featured){
  featured.replaceChildren();
  list.slice(0,7).forEach((p,i)=>featured.appendChild(renderCard(p,{wide:i===6})));
 }
 if(full){
  full.replaceChildren();
  const search=($('#hubProjectSearch')?.value||'').trim().toLowerCase();
  list.filter(p=>[p.name,p.desc].some(t=>String(t||'').toLowerCase().includes(search))).forEach(p=>full.appendChild(renderCard(p,{edit:true})));
  const add=document.createElement('button');add.type='button';add.className='add-project-tile';add.append(icon('wc-plus'),document.createTextNode('Добавить проект'));add.addEventListener('click',()=>editProject(null));full.appendChild(add);
 }
}
$('#hubProjectSearch')?.addEventListener('input',renderProjects);
const form=$('#hubProjectForm'),dialog=$('#hubProjectDialog');
function editProject(p){
 if(!form||!dialog)return;
 form.reset();
 $('#hubEditId').value=p?.id||'';
 $('#hubEditName').value=p?.name||'';
 $('#hubEditUrl').value=p?.url||'';
 $('#hubEditDescription').value=p?.desc||'';
 $('#hubEditColor').value=p?.color||'ruby';
 $('#hubDialogTitle').textContent=p?'Изменить проект':'Добавить проект';
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
$$('[data-hub-add]').forEach(button=>button.addEventListener('click',()=>editProject(null)));
$$('[data-hub-close-dialog]').forEach(button=>button.addEventListener('click',()=>dialog?.close()));
dialog?.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
function readLogo(file){
 return new Promise((resolve,reject)=>{
  if(!file){resolve(null);return}
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>4*1024*1024){reject(new Error('Выбери PNG, JPG или WEBP до 4 МБ'));return}
  const image=new Image(),reader=new FileReader();
  reader.onerror=()=>reject(new Error('Не удалось прочитать изображение'));
  reader.onload=()=>{image.onload=()=>{
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   const ctx=canvas.getContext('2d');if(!ctx){reject(new Error('Canvas недоступен'));return}
   ctx.clearRect(0,0,128,128);
   const k=Math.min(128/image.width,128/image.height);const w=image.width*k,h=image.height*k;
   ctx.drawImage(image,(128-w)/2,(128-h)/2,w,h);
   resolve(canvas.toDataURL('image/png'));
  };image.onerror=()=>reject(new Error('Ошибка изображения'));image.src=reader.result};
  reader.readAsDataURL(file);
 });
}
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 const name=$('#hubEditName').value.trim(),url=normalizeUrl($('#hubEditUrl').value),desc=$('#hubEditDescription').value.trim(),color=$('#hubEditColor').value;
 if(!name||!url){toast('Проверь название и ссылку https://');return}
 const id=$('#hubEditId').value||'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
 const existing=allProjects().find(x=>x.id===id);
 let logo=existing?.logo||'';
 try{const image=await readLogo($('#hubEditLogo').files[0]);if(image)logo=image}catch(error){toast(error.message);return}
 const replacement={id,name,url,desc,color,logo};
 if(defaults.some(p=>p.id===id))replacement.override=true;
 custom=custom.filter(p=>p.id!==id);
 custom.push(replacement);save();renderProjects();dialog.close();toast('Проект сохранён на этом устройстве ✓');
});
let activeTab='home';
const viewer=$('#hubViewer'),frame=$('#hubViewerFrame'),viewerExternal=$('#hubViewerExternal');
let viewing=null;
function openProject(p){
 const url=normalizeUrl(p.url);if(!url){toast('Ссылка проекта некорректна');return}
 // The Chromium iframe error "ERR_BLOCKED_BY_RESPONSE" is not a site outage.
 // Open non-frameable destinations as real pages, not in a frame. Android
 // users can return using the hardware/system Back button; browser history
 // has a Workspace entry immediately before the external destination.
 if(!canEmbed(p,url)){
   dismissViewer();
   try{sessionStorage.setItem('farruh-workspace-external-return-v1',JSON.stringify({
    project:p.id,back:location.href,savedAt:Date.now()
   }))}catch{}
   window.location.assign(url);
   return;
 }
 viewing=p;$('#hubViewerTitle').textContent=p.name;frame.title=p.name;frame.src=url;
 viewerExternal.href=url;viewerExternal.setAttribute('rel','noopener noreferrer');
 // Same-site pages should remain in the WebView; the fallback is also a regular
 // link for devices and sites that block iframe embedding.
 viewerExternal.target='_self';
 if(typeof viewer.showModal==='function')viewer.showModal();else viewer.setAttribute('open','');
 history.pushState({hubViewer:p.id,hubTab:activeTab},'', '#open-'+encodeURIComponent(p.id));
}
function dismissViewer(){
 if(!viewer?.open)return;
 frame.src='about:blank';viewing=null;viewer.close();
}
$('#hubViewerBack')?.addEventListener('click',()=>{
 if(location.hash.startsWith('#open-'))history.back();else dismissViewer();
});
viewer?.addEventListener('cancel',event=>{
 event.preventDefault();if(location.hash.startsWith('#open-'))history.back();else dismissViewer();
});
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-hub-open]');
 if(!link)return;
 const url=normalizeUrl(link.getAttribute('href'));if(!url)return;
 event.preventDefault();openProject({id:'tool-'+Date.now(),name:link.dataset.title||link.textContent.trim(),url});
});
function tabFromHash(){
 const fragment=decodeURIComponent(location.hash.replace(/^#/,''));
 if(tabs.has(fragment))return fragment;
 if(fragment==='catalog'||fragment==='pdf')return 'tools';
 if(fragment.startsWith('open-'))return history.state?.hubTab||activeTab;
 return 'home';
}
function showTab(tab,record=false,withMotion=true){
 if(!tabs.has(tab))tab='home';
 activeTab=tab;root.dataset.mssTab=tab;
 $$('[data-mss-panel]').forEach(panel=>panel.hidden=panel.dataset.mssPanel!==tab);
 $$('.bottomnav [data-mss-tab]').forEach(button=>{
  const active=button.dataset.mssTab===tab;button.classList.toggle('active',active);
  button.setAttribute('aria-current',active?'page':'false');
  button.setAttribute('aria-pressed',String(active));
 });
 if(record)history.pushState({hubTab:tab},'',tab==='home'?'#home':'#'+tab);
 if(!record&&location.hash.startsWith('#open-'))return;
 window.scrollTo({top:0,behavior:'instant'});
 if(withMotion)animateVisible(tab);
}
function animateVisible(tab){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 root.classList.add('hub-motion');
 const panel=$('#mss-'+tab);
 const nodes=tab==='home'?$$('.section-heading,.project-card,.quick-tool,.system-card',panel):$$('.panel-heading,.project-card,.action-card,.ttk-stat-card,.settings-row',panel);
 nodes.slice(0,23).forEach((node,index)=>{
  node.classList.remove('hub-appear');void node.offsetWidth;
  node.style.setProperty('--hub-delay',Math.min(index*50,650)+'ms');
  node.classList.add('hub-appear');
 });
}
$$('[data-mss-tab]').forEach(button=>button.addEventListener('click',()=>{
 const tab=button.dataset.mssTab;
 if(!tabs.has(tab))return;
 dismissViewer();showTab(tab,true);
}));
function syncHistory(){
 if(!location.hash.startsWith('#open-'))dismissViewer();
 showTab(tabFromHash());
}
window.addEventListener('popstate',syncHistory);
window.addEventListener('hashchange',syncHistory);
function startSplash(){
 const splash=$('#hubSplash');if(!splash)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let replay=false;try{replay=sessionStorage.getItem('hub-replay')==='1';sessionStorage.removeItem('hub-replay')}catch{}
 if(replay)root.classList.add('hub-explicit-motion');
 const shouldPlay=!reduced||replay;
 if(!shouldPlay){splash.remove();return}
 const line=$('#hubSplashText'),full='FARRUH WORKSPACE PRO';
 if(line){
  const chars=Array.from(full);let i=0;line.textContent='';
  const write=()=>{if(!line.isConnected)return;line.textContent=chars.slice(0,++i).join('');if(i<chars.length)setTimeout(write,59)};
  setTimeout(write,240);
 }
 let done=false;
 function finish(){
  if(done)return;done=true;splash.classList.add('is-leaving');
  setTimeout(()=>{splash.remove();animateVisible(activeTab);if(activeTab==='home')typeHeroOnce()},470);
 }
 const timeout=setTimeout(finish,2650);
 $('#hubSkipSplash')?.addEventListener('click',()=>{clearTimeout(timeout);finish()},{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timeout);finish()}},{once:true});
}
let heroTypedOnce=false;
function typeHeroOnce(){
 if(heroTypedOnce||(window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!root.classList.contains('hub-explicit-motion')))return;
 heroTypedOnce=true;
 const heading=$('#hubHeroHeading');if(!heading)return;
 const plain=Array.from(heading.childNodes).find(n=>n.nodeType===3&&n.nodeValue.trim());
 const emphasis=heading.querySelector('em')?.firstChild;
 const textNodes=[plain,emphasis].filter(Boolean);
 if(!textNodes.length)return;
 const originals=textNodes.map(n=>n.nodeValue);
 textNodes.forEach(n=>n.nodeValue='');
 const start=performance.now();const period=55;
 function frame(){
  if(!heading.isConnected)return;
  const count=Math.floor((performance.now()-start)/period);
  let written=0;
  textNodes.forEach((node,i)=>{
   const full=Array.from(originals[i]);const length=Math.max(0,Math.min(full.length,count-written));
   node.nodeValue=full.slice(0,length).join('');written+=full.length;
  });
  if(count<originals.reduce((n,s)=>n+Array.from(s).length,0))requestAnimationFrame(frame);
  else textNodes.forEach((node,i)=>node.nodeValue=originals[i]);
 }
 requestAnimationFrame(frame);
}
$('#hubReplay')?.addEventListener('click',()=>{
 try{sessionStorage.setItem('hub-replay','1')}catch{}
 location.reload();
});
$('#hubNotifications')?.addEventListener('click',()=>toast('Уведомления пока не подключены — события проектов здесь не отображаются.'));
$('#hubCloudSyncSettings')?.addEventListener('click',()=>window.WorkspaceCloud?.syncNow());
window.FarruhWorkspace={
 snapshot:()=>({projects:custom.map(x=>({...x})),favorites:[...favorites]}),
 applyCloud(value){
  if(!value||typeof value!=='object')return;
  custom=Array.isArray(value.projects)?value.projects.filter(p=>p&&typeof p.id==='string'&&p.id.length<90&&typeof p.name==='string'&&p.name.length<=70&&typeof p.url==='string'&&p.url.length<2000&&!!normalizeUrl(p.url)).slice(0,80).map(p=>({...p})):custom;
  favorites=Array.isArray(value.favorites)?value.favorites.filter(s=>typeof s==='string'&&s.length<90).slice(0,150):favorites;
  persistLocal();renderProjects();
 },
 safeProjectCount:()=>allProjects().length
};
renderProjects();showTab(tabFromHash(),false,false);startSplash();
})();