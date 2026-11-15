/**
 * Owner-controlled, per-record removal from three independent locations.
 * No background deletion, no bulk delete, and no claim of remote success
 * until the correct backend confirms that exact recipe ID.
 */
export function mountRecipeDeletionManager({getState,store,onState,downloadFile,notify,mountRoot,openDataCenter,onGoogleChanged}){
 const panel=document.createElement('details');
 panel.className='recipe-deletion-manager';
 panel.innerHTML=`<summary>🗑️ Удалить ТТК</summary>
  <p class="small">Нажмите ✕ рядом с нужной ТТК. Удалится только выбранная копия — с телефона, из общей базы или Google.</p>
  <p class="small">Удаление из Google требует обновлённого Apps Script. Оно не устраняет ошибку экспорта PDF А4.</p>
  <div class="recipe-delete-list" data-list></div>
  <p class="small" data-count></p>
  <div class="recipe-delete-feedback" data-feedback role="status" aria-live="polite"></div>`;
 mountRoot.append(panel);
 const list=panel.querySelector('[data-list]');
 const count=panel.querySelector('[data-count]');
 const feedback=panel.querySelector('[data-feedback]');
 let busy=false,undoRecord=null;
 const byId=s=>{
  const records=new Map();
  for(const r of [...(s?.recipes||[]),...(s?.releasedRecipes||[])])
   if(r?.id&&!records.has(r.id))records.set(r.id,r);
  for(const [id,r] of Object.entries(s?.deletedRecipeRefs||{}))
   if(!records.has(id))records.set(id,r);
  return records;
 };
 function recordRef(s,id,record){
  s.deletedRecipeRefs??={};
  const r=record||s.recipes?.find(x=>x.id===id)||s.releasedRecipes?.find(x=>x.id===id)||s.deletedRecipeRefs[id];
  if(r)s.deletedRecipeRefs[id]={id,name:String(r.name||'ТТК'),category:String(r.category||''),projectId:String(r.projectId||''),projectName:String(r.projectName||'')};
 }
 const locations=[
  {scope:'phone',label:'📱 ✕',description:'Удалить с телефона'},
  {scope:'cloud',label:'☁️ ✕',description:'Удалить из общей базы телефона и планшета'},
  {scope:'google',label:'📄 ✕',description:'Удалить из Google Документов'}
 ];
 function message(text,undo=false){
  feedback.replaceChildren();
  const p=document.createElement('span');p.textContent=text;feedback.append(p);
  if(undo&&undoRecord){
   const button=document.createElement('button');button.type='button';button.textContent='↶ Отменить';
   button.setAttribute('aria-label','Вернуть удалённую ТТК на телефон');
   button.onclick=()=>void undoPhoneDelete();
   feedback.append(button);
  }
 }
 function render(){
  const s=getState()||{},records=[...byId(s).values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru'));
  list.replaceChildren();
  for(const recipe of records){
   const row=document.createElement('div');row.className='recipe-delete-row';
   const info=document.createElement('div');info.className='recipe-delete-record';
   const title=document.createElement('strong');title.textContent=recipe.name||'ТТК';
   const detail=document.createElement('small');detail.textContent=(recipe.category||'Без категории')+' · '+(recipe.projectName||recipe.projectId||'Без проекта');
   info.append(title,detail);
   const actions=document.createElement('div');actions.className='recipe-delete-actions';
   const local=(s.recipes||[]).some(r=>r.id===recipe.id)||(s.releasedRecipes||[]).some(r=>r.id===recipe.id);
   for(const option of locations){
    const button=document.createElement('button');button.type='button';
    button.className='recipe-delete-x recipe-delete-x-'+option.scope;
    button.textContent=option.label;
    button.title=option.description+' · '+recipe.name;
    button.setAttribute('aria-label',option.description+' — '+recipe.name);
    button.disabled=busy||(option.scope==='phone'&&!local)||
     (option.scope==='cloud'&&!!s.cloudDeletedRecipes?.[recipe.id])||
     (option.scope==='google'&&!!s.googleDeletedRecipes?.[recipe.id]);
    button.onclick=()=>void removeOne(recipe.id,option.scope);
    actions.append(button);
   }
   row.append(info,actions);
   if(s.googleSuppressed?.[recipe.id]&&local){
    const resume=document.createElement('button');resume.type='button';resume.className='recipe-delete-resume';
    resume.textContent='↻ Возобновить Google';
    resume.disabled=busy;
    resume.onclick=async()=>{
     if(busy)return;
     busy=true;
     try{
      const next=await store.mutate(d=>{delete d.googleSuppressed?.[recipe.id];delete d.googleDeletedRecipes?.[recipe.id]});
      onState(next);onGoogleChanged?.();message('Отправка «'+recipe.name+'» в Google разрешена.');render();
     }catch(e){message('⚠️ '+String(e.message||e))}
     finally{busy=false;render()}
    };
    row.append(resume);
   }
   list.append(row);
  }
  if(!records.length){
   const empty=document.createElement('p');empty.className='small';
   empty.textContent='Сохранённых ТТК на устройстве пока нет.';list.append(empty);
  }
  count.textContent='Показано ТТК: '+records.length+'. Кнопки 📱, ☁️ и 📄 удаляют из разных мест.';
 }
 async function postGoogle(s,id,recipe){
  const cfg=s?.googleSync;
  if(!cfg?.endpoint||!cfg?.key)throw Error('Google ТТК не подключён. Сначала настройте Google Документы.');
  const reply=await fetch('/api/recipes/google-sync',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'deleteRecipe',endpoint:cfg.endpoint,key:cfg.key,recipeId:id,projectId:recipe.projectId||'',projectName:recipe.projectName||''}),
   signal:AbortSignal.timeout(110000)
  });
  const data=await reply.json().catch(()=>({}));
  if(!reply.ok||data.ok!==true)throw Error(data.error||'Google не подтвердил удаление. Обновите Google Apps Script.');
  if(data.recipeId!==id||data.deleted!==true)throw Error(data.found===false?'Google не нашёл ранее отправленную ТТК. Запись на устройстве оставлена; отправка в Google приостановлена.':'Google не подтвердил удаление этой ТТК.');
  return data;
 }
 async function deleteCloud(id){
  const request=async(url,options={})=>{
   const response=await fetch(url,{...options,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(60000)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||data.ok!==true)throw Error(data.error||'Облачное хранилище не подтвердило удаление.');
   return data;
  };
  const cloud=await request('/api/device-sync');
  const found=[...(cloud.snapshot?.recipes||[]),...(cloud.snapshot?.releasedRecipes||[])].some(r=>r.id===id);
  if(!found)throw Error('В общей облачной базе эта ТТК не найдена. На телефоне её можно удалить отдельно.');
  const done=await request('/api/device-sync/recipes/'+encodeURIComponent(id),{
   method:'DELETE',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({revision:cloud.revision})
  });
  if(done.deleted!==true||done.recipeId!==id)throw Error('Облако не подтвердило удаление конкретной ТТК.');
 }
 async function backupBeforeRemote(){
  const backup=await store.load();
  // Preserve a restorable local snapshot before deleting remote content.
  downloadFile(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state:backup},null,2)],{type:'application/json'}),
   'FARRUH_AI_before_delete_'+new Date().toISOString().slice(0,10)+'.json');
 }
 async function undoPhoneDelete(){
  if(busy||!undoRecord)return false;
  const previous=undoRecord;busy=true;message('Восстанавливаю «'+previous.name+'»…');render();
  try{
   const next=await store.mutate(d=>{
    d.recipes??=[];d.releasedRecipes??=[];
    for(const r of previous.recipes)if(!d.recipes.some(x=>x.id===r.id))d.recipes.push(r);
    for(const r of previous.released)if(!d.releasedRecipes.some(x=>x.id===r.id))d.releasedRecipes.push(r);
    if(previous.wasSuppressed) {d.googleSuppressed??={};d.googleSuppressed[previous.id]=true}
    else delete d.googleSuppressed?.[previous.id];
    if(previous.wasLocalOnly){d.localOnlyDeletedIds??={};d.localOnlyDeletedIds[previous.id]=true}
    else delete d.localOnlyDeletedIds?.[previous.id];
   });
   onState(next);
   undoRecord=null;
   onGoogleChanged?.();
   message('✅ «'+previous.name+'» восстановлена на телефоне.');
   notify?.('ТТК восстановлена: '+previous.name);
   return true;
  }catch(e){message('⚠️ Не удалось восстановить: '+String(e.message||e),true);return false}
  finally{busy=false;render()}
 }
 async function removeOne(id,scope){
  if(busy)return false;
  const s=getState(),recipe=byId(s).get(id);
  if(!recipe||!locations.some(option=>option.scope===scope))return false;
  busy=true;render();
  const label={phone:'телефона',cloud:'общей базы',google:'Google Документов'}[scope];
  message('Удаляю «'+recipe.name+'» из '+label+'…');
  try{
   if(scope==='phone'){
    const local=await store.load();
    const recipes=(local.recipes||[]).filter(r=>r.id===id);
    const released=(local.releasedRecipes||[]).filter(r=>r.id===id);
    if(!recipes.length&&!released.length)throw Error('На телефоне эта ТТК уже отсутствует.');
    const wasSuppressed=!!local.googleSuppressed?.[id];
    const wasLocalOnly=!!local.localOnlyDeletedIds?.[id];
    const next=await store.mutate(d=>{
     recordRef(d,id,recipe);
     d.recipes=(d.recipes||[]).filter(r=>r.id!==id);
     d.releasedRecipes=(d.releasedRecipes||[]).filter(r=>r.id!==id);
     d.googleSuppressed??={};d.googleSuppressed[id]=true;
     // Do not turn a local-only deletion into a cross-device cloud deletion.
     d.localOnlyDeletedIds??={};d.localOnlyDeletedIds[id]=true;
    });
    undoRecord={id,name:recipe.name,recipes,released,wasSuppressed,wasLocalOnly};
    onState(next);onGoogleChanged?.();
    message('✅ Удалена с телефона: «'+recipe.name+'». Google и общая база не затронуты.',true);
   }else if(scope==='cloud'){
    await backupBeforeRemote();
    await deleteCloud(id);
    const next=await store.mutate(d=>{recordRef(d,id,recipe);d.cloudDeletedRecipes??={};d.cloudDeletedRecipes[id]=true});
    onState(next);
    message('✅ Удалена из общей облачной базы: «'+recipe.name+'».');
   }else{
    await backupBeforeRemote();
    const paused=await store.mutate(d=>{
     recordRef(d,id,recipe);d.googleSuppressed??={};d.googleSuppressed[id]=true;
    });
    onState(paused);onGoogleChanged?.();
    await postGoogle(paused,id,recipe);
    const next=await store.mutate(d=>{
     recordRef(d,id,recipe);d.googleDeletedRecipes??={};d.googleDeletedRecipes[id]=true;
     if(d.googleDelivery)delete d.googleDelivery[id];
    });
    onState(next);onGoogleChanged?.();
    message('✅ Google подтвердил удаление «'+recipe.name+'».');
   }
   notify?.('Удалена «'+recipe.name+'» из '+label+'.');
   return true;
  }catch(e){
   message('⚠️ Не удалена из '+label+': '+String(e.message||e));
   notify?.(String(e.message||e),true);
   return false;
  }finally{busy=false;render()}
 }
 document.addEventListener('farruh:delete-recipe-fast',e=>{
  const id=e.detail?.id;if(!id)return;
  void removeOne(id,'phone').then(ok=>{
   if(ok)e.detail?.onDone?.();
   else e.detail?.onFail?.();
  }).catch(()=>e.detail?.onFail?.());
 });
 document.addEventListener('farruh:manage-recipe',e=>{
  const id=e.detail?.id;if(!id)return;
  openDataCenter();panel.open=true;render();
  const row=[...list.querySelectorAll('.recipe-delete-row')].find(row=>
   row.querySelector('.recipe-delete-x-phone')?.getAttribute('aria-label')?.endsWith(' — '+byId(getState()).get(id)?.name));
  row?.scrollIntoView({block:'nearest',behavior:'smooth'});
 });
 return {panel,render,removeOne};
}
