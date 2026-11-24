/* FARRUH WORKSPACE PRO 1.3.0 — authenticated, READ ONLY recipe browser.
 * recipes / ingredients / ttk_documents are separate Supabase datasets.
 * Never silently migrate recipes to ttk_documents or imply that drafts are approved TTKs.
 * No recipe data ever written by this module.
 */
(function(){
'use strict';
const SB='https://mhsmmssipligbmvfzkce.supabase.co';
const KEY='sb_publishable_JKA5HzoGDIkLxBnctT27hw_TBIqnoc0';
const $=s=>document.querySelector(s);
const list=$('#hubRecipeList'),search=$('#hubRecipeSearch'),kind=$('#hubRecipeKind');
const msg=$('#hubRecipeMessage'),refresh=$('#hubReloadRecipes');
if(!list||!msg||!refresh)return;
let recipes=[],loading=false,loaded=false,loadedFor='',loadTime=0;
function status(s){msg.textContent=s}
function sessionRead(){try{return JSON.parse(localStorage.getItem('ms_session')||'null')}catch{return null}}
async function request(url,options={}){
 const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),12000);
 try{
  const res=await fetch(url,{...options,signal:ctl.signal,cache:'no-store'});
  if(!res.ok)throw Error('HTTP '+res.status);
  return await res.json();
 }finally{clearTimeout(timeout)}
}
async function auth(){
 let session=sessionRead();
 if(!session?.access_token){
  return null;
 }
 if((Number(session.expires_at)||0)<Math.floor(Date.now()/1000)+90){
  if(!session.refresh_token)throw Error('Срок входа истёк');
  const updated=await request(SB+'/auth/v1/token?grant_type=refresh_token',{
   method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
   body:JSON.stringify({refresh_token:session.refresh_token})
  });
  if(!updated?.access_token)throw Error('Не удалось обновить доступ');
  session={...session,...updated,expires_at:updated.expires_at||Math.floor(Date.now()/1000)+Number(updated.expires_in||3600)};
  localStorage.setItem('ms_session',JSON.stringify(session));
 }
 return session;
}
function card(row){
 const root=document.createElement('div');root.className='recipe-readonly-row';
 const top=document.createElement('div');top.className='recipe-row-top';
 const symbol=document.createElement('span');symbol.className='recipe-symbol';symbol.textContent=row.kind==='prefab'?'ПФ':'🍣';
 const middle=document.createElement('div');middle.className='recipe-info';
 const name=document.createElement('strong');name.textContent=row.name||'Без названия';
 const description=document.createElement('small');description.textContent=[row.code,row.category].filter(Boolean).join(' · ')||'Без категории';
 middle.append(name,description);
 const statusEl=document.createElement('span');statusEl.className='recipe-state';statusEl.textContent=row.status||'Статус не указан';
 top.append(symbol,middle,statusEl);
 const foot=document.createElement('div');foot.className='recipe-row-foot';
 const type=document.createElement('span');type.textContent=row.kind==='prefab'?'Полуфабрикат':'Изделие / ролл';
 const weight=document.createElement('span');weight.textContent=(Number.isFinite(Number(row.yield_g))&&Number(row.yield_g)>0?'Выход '+Number(row.yield_g)+' г':'Выход не указан');
 foot.append(type,weight);
 root.append(top,foot);return root;
}
function render(){
 list.replaceChildren();
 if(!loaded)return;
 const q=(search?.value||'').trim().toLocaleLowerCase('ru');
 const filter=kind?.value||'all';
 const shown=recipes.filter(x=>(filter==='all'||x.kind===filter) && (!q||[x.name,x.code,x.category,x.status].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q))));
 const total=recipes.length;
 status('Показано '+shown.length+' из '+total+' рецептур · только просмотр');
 if(!shown.length){
  const empty=document.createElement('p');empty.className='recipe-empty';empty.textContent='По этому запросу рецептур нет.';
  list.appendChild(empty);return;
 }
 shown.slice(0,200).forEach(x=>list.appendChild(card(x)));
}
async function load(force=false){
 const s=sessionRead();
 if(!s?.access_token){
  loaded=false;loadedFor='';recipes=[];list.replaceChildren();
  status('Для просмотра рецептур войди в MORE SUSHI STUDIO. Без входа данные не показываются.');
  return;
 }
 if(loading)return;
 if(!force&&loaded&&Date.now()-loadTime<60000&&loadedFor===s.user?.id){render();return}
 loading=true;refresh.disabled=true;
 status('Читаем рецептуры из облака…');
 try{
  const session=await auth();if(!session)throw Error('Вход не подтверждён');
  const url=new URL(SB+'/rest/v1/recipes');
  url.searchParams.set('select','id,code,name,kind,category,status,yield_g,version,updated_at');
  url.searchParams.set('order','updated_at.desc');
  url.searchParams.set('limit','200');
  const response=await request(url.toString(),{headers:{apikey:KEY,Authorization:'Bearer '+session.access_token}});
  if(!Array.isArray(response))throw Error('Сервер прислал неверный формат');
  // Only the authenticated user's data are returned by the existing table RLS.
  recipes=response.filter(x=>x&&typeof x.name==='string'&&['prefab','product'].includes(x.kind));
  loaded=true;loadedFor=session.user?.id||'session';loadTime=Date.now();
  render();
 }catch(err){
  loaded=false;recipes=[];list.replaceChildren();
  status('Не удалось загрузить рецептуры. Проверь подключение или снова войди в MORE SUSHI.');
 }finally{loading=false;refresh.disabled=false}
}
refresh.addEventListener('click',()=>load(true));
search?.addEventListener('input',render);
kind?.addEventListener('change',render);
document.addEventListener('click',e=>{if(e.target.closest('[data-mss-tab="ttk"]'))setTimeout(()=>load(false),0)});
window.addEventListener('hashchange',()=>{if(location.hash==='#ttk')load(false)});
window.addEventListener('online',()=>{if(document.querySelector('#mss-ttk')?.hidden===false)load(true)});
window.addEventListener('storage',e=>{if(e.key==='ms_session'&&document.querySelector('#mss-ttk')?.hidden===false)load(true)});
if(location.hash==='#ttk')setTimeout(()=>load(false),0);
window.WorkspaceRecipes={refresh:()=>load(true),isReadOnly:true};
})();