/**
 * Owner-controlled, per-record removal from three independent locations.
 * No background deletion, no bulk delete, and no claim of remote success
 * until the correct backend confirms that exact recipe ID.
 */
export function mountRecipeDeletionManager({getState,store,onState,downloadFile,notify,mountRoot,openDataCenter,onGoogleChanged}){
 const panel=document.createElement('details');
 panel.className='recipe-deletion-manager';
 panel.innerHTML=`<summary>🗑️ Управление ТТК · выборочное удаление</summary>
  <p class="small">Можно удалить одну выбранную ТТК отдельно с телефона, из общей облачной базы или из Google Документов. Никакого автоматического удаления всех ТТК.</p>
  <p class="small"><strong>Важно:</strong> удаление ТТК не исправит ошибку «PDF А4 не подтверждён». Для неё нужно обновить опубликованный Google Apps Script.</p>
  <p class="small">Перед удалением приложение скачает резервную копию данных телефона. Старые резервные копии Google Диска не затрагиваются.</p>
  <div class="recipe-delete-list" data-list></div><p class="small" data-status role="status" aria-live="polite"></p>`;
 mountRoot.append(panel);
 const list=panel.querySelector('[data-list]'),listStatus=panel.querySelector('[data-status]');
 const dialog=document.createElement('dialog');
 dialog.className='category-dialog data-center-subdialog recipe-delete-confirm';
 dialog.setAttribute('aria-label','Выборочное удаление техкарты');
 dialog.innerHTML=`<div class="bar"><h2>Удалить выбранную ТТК</h2><button type="button" data-close aria-label="Отмена">✕</button></div>
  <p class="small" data-recipe></p>
  <p class="small">Выберите <strong>одно место</strong>. Другие копии автоматически не удаляются.</p>
  <fieldset class="recipe-delete-scope"><legend>Откуда удалить?</legend>
   <label><input type="radio" name="deleteScope" value="phone"> 💾 Из телефона (включая сохранённую готовую версию)</label>
   <label><input type="radio" name="deleteScope" value="cloud"> ☁️ Из общей базы телефона и планшета</label>
   <label><input type="radio" name="deleteScope" value="google"> 📄 Из Google Документов (только вкладку ТТК и её PDF)</label>
  </fieldset>
  <p class="small" data-warning>Резервные копии и другие техкарты останутся без изменений.</p>
  <label>Для подтверждения напишите УДАЛИТЬ
   <input data-confirm autocomplete="off" inputmode="text" placeholder="УДАЛИТЬ" maxlength="16">
  </label>
  <div class="bar"><button class="primary" type="button" data-apply>Удалить только выбранную ТТК</button><button type="button" data-cancel>Отмена</button></div>
  <p class="small" data-result role="status" aria-live="polite"></p>`;
 document.body.append(dialog);
 const selectedName=dialog.querySelector('[data-recipe]');
 const warning=dialog.querySelector('[data-warning]');
 const input=dialog.querySelector('[data-confirm]');
 const apply=dialog.querySelector('[data-apply]');
 const result=dialog.querySelector('[data-result]');
 const scopes=Array.from(dialog.querySelectorAll('input[name="deleteScope"]'));
 let selectedId=null,busy=false;
 const clean=String,byId=s=>{const m=new Map();
  for(const r of [...(s?.recipes||[]),...(s?.releasedRecipes||[])])if(r?.id&&!m.has(r.id))m.set(r.id,r);
  for(const [id,r] of Object.entries(s?.deletedRecipeRefs||{}))if(!m.has(id))m.set(id,r);
  return m;
 };
 function recordRef(s,id,record){
  s.deletedRecipeRefs??={};
  const r=record||s.recipes?.find(x=>x.id===id)||s.releasedRecipes?.find(x=>x.id===id)||s.deletedRecipeRefs[id];
  if(r)s.deletedRecipeRefs[id]={id,name:String(r.name||'ТТК'),category:String(r.category||''),projectId:String(r.projectId||''),projectName:String(r.projectName||'')};
 }
 function render(){
  const s=getState()||{};
  list.replaceChildren();
  const recipes=[...byId(s).values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru'));
  for(const recipe of recipes){
   const row=document.createElement('div');row.className='recipe-delete-row';
   const info=document.createElement('div');info.className='recipe-delete-record';
   const title=document.createElement('strong');title.textContent=recipe.name||'ТТК';
   const detail=document.createElement('small');detail.textContent=(recipe.category||'Без категории')+' · '+(recipe.projectName||recipe.projectId||'Без проекта');
   const local=(s.recipes||[]).some(r=>r.id===recipe.id)||(s.releasedRecipes||[]).some(r=>r.id===recipe.id);
   const badge=document.createElement('small');badge.textContent=
    (local?'📱 На телефоне':'📱 Удалена с телефона')+
    (s.googleDeletedRecipes?.[recipe.id]?' · 📄 Google удалено':s.googleSuppressed?.[recipe.id]?' · 📄 Отправка в Google приостановлена':'')+
    (s.cloudDeletedRecipes?.[recipe.id]?' · ☁️ Удалена из общей базы':'');
   info.append(title,detail,badge);
   const action=document.createElement('button');action.type='button';action.textContent='Управлять';
   action.onclick=()=>open(recipe.id);
   row.append(info,action);
   if(s.googleSuppressed?.[recipe.id]&&local){
    const resume=document.createElement('button');resume.type='button';resume.textContent='Возобновить Google';
    resume.onclick=async()=>{
     if(!window.confirm('Разрешить автоматическую отправку «'+recipe.name+'» в Google Документы заново?'))return;
     const next=await store.mutate(d=>{delete d.googleSuppressed?.[recipe.id];delete d.googleDeletedRecipes?.[recipe.id]});
     onState(next);onGoogleChanged?.();render();
     listStatus.textContent='Автоотправка этой ТТК в Google возобновлена.';
    };
    row.append(resume);
   }
   list.append(row);
  }
  if(!recipes.length){const p=document.createElement('p');p.className='small';p.textContent='ТТК на устройстве и в списке предыдущих удалений нет.';list.append(p);}
  listStatus.textContent='ТТК в списке: '+recipes.length+'. Управление доступно только после отдельного подтверждения.';
 }
 function open(id){
  if(busy)return;
  const recipe=byId(getState()).get(id);if(!recipe)return;
  selectedId=id;
  selectedName.textContent='Выбрана: «'+recipe.name+'» · '+(recipe.category||'')+'.';
  scopes.forEach(r=>{r.checked=false});
  input.value='';result.textContent='';
  updateWarning();
  if(!dialog.open)dialog.showModal();
 }
 function updateWarning(){
  const choice=scopes.find(r=>r.checked)?.value;
  warning.textContent=choice==='google'
   ?'Автоотправка этой ТТК будет приостановлена, иначе она вновь появится в Google. Вкладка проекта и другие ТТК сохранятся. Для удаления требуется обновлённый Apps Script.'
   :choice==='cloud'
   ?'Удаление затронет общую базу всех синхронизируемых устройств. На телефоне запись останется до отдельного удаления или следующей синхронизации. При конфликте версия облака не будет перезаписана.'
   :choice==='phone'
   ?'Будут удалены и черновик, и последняя готовая версия этой ТТК на данном телефоне. Если копия есть в общей базе, она может вернуться при включении синхронизации.'
   :'Резервные копии Google Диска и другие ТТК не затрагиваются.';
 }
 scopes.forEach(r=>r.addEventListener('change',updateWarning));
 const close=()=>{if(!busy)dialog.close()};
 dialog.querySelector('[data-close]').onclick=close;
 dialog.querySelector('[data-cancel]').onclick=close;
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
 apply.onclick=async()=>{
  if(busy)return;
  const id=selectedId,s=getState(),recipe=byId(s).get(id);
  const scope=scopes.find(r=>r.checked)?.value;
  if(!id||!recipe||!scope){result.textContent='Выберите одну техкарту и место удаления.';return}
  if(input.value.trim()!=='УДАЛИТЬ'){result.textContent='Введите слово УДАЛИТЬ полностью.';return}
  if(!window.confirm('Подтвердите удаление «'+recipe.name+'» из: '+({phone:'телефона',cloud:'общей облачной базы',google:'Google Документов'}[scope])+'. Другие места не будут изменены.'))return;
  busy=true;apply.disabled=true;result.textContent='Сохраняю страховочную копию…';
  try{
   // Always keep a restorable snapshot of the device before irreversible action.
   const backup=await store.load();
   downloadFile(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state:backup},null,2)],{type:'application/json'}),
    'FARRUH_AI_before_delete_'+new Date().toISOString().slice(0,10)+'.json');
   if(scope==='phone'){
    const next=await store.mutate(d=>{
     const inPhone=(d.recipes||[]).some(x=>x.id===id)||(d.releasedRecipes||[]).some(x=>x.id===id);
     if(!inPhone)throw Error('ТТК уже отсутствует на этом устройстве.');
     recordRef(d,id,recipe);
     d.recipes=(d.recipes||[]).filter(x=>x.id!==id);
     d.releasedRecipes=(d.releasedRecipes||[]).filter(x=>x.id!==id);
     d.googleSuppressed??={};d.googleSuppressed[id]=true;
    });
    onState(next);
    result.textContent='✅ ТТК удалена с этого телефона вместе с готовой версией. Google и общая облачная база не изменены.';
   }else if(scope==='cloud'){
    result.textContent='Удаляю из общей облачной базы…';
    await deleteCloud(id);
    const next=await store.mutate(d=>{recordRef(d,id,recipe);d.cloudDeletedRecipes??={};d.cloudDeletedRecipes[id]=true});
    onState(next);
    result.textContent='✅ ТТК удалена из общей облачной базы с защитой от восстановления другими устройствами. На телефоне пока осталась.';
   }else{
    const paused=await store.mutate(d=>{recordRef(d,id,recipe);d.googleSuppressed??={};d.googleSuppressed[id]=true});
    onState(paused);onGoogleChanged?.();
    result.textContent='Запрашиваю удаление одной ТТК и её PDF из Google…';
    await postGoogle(paused,id,recipe);
    const next=await store.mutate(d=>{
     recordRef(d,id,recipe);
     d.googleDeletedRecipes??={};d.googleDeletedRecipes[id]=true;
     if(d.googleDelivery)delete d.googleDelivery[id];
    });
    onState(next);
    result.textContent='✅ Google подтвердил удаление вкладки этой ТТК и её PDF (если существовали). Другие Google Документы и резервные копии сохранены.';
   }
   render();onGoogleChanged?.();
   notify?.('Удаление выбранной ТТК: выполнено для '+({phone:'телефона',cloud:'облака устройств',google:'Google Документов'}[scope])+'.');
  }catch(e){result.textContent='⚠️ '+String(e.message||e);notify?.(String(e.message||e),true)}
  finally{busy=false;apply.disabled=false}
 };
 document.addEventListener('farruh:manage-recipe',e=>{
  const id=e.detail?.id;if(!id)return;
  const reveal=()=>{openDataCenter();panel.open=true;render();open(id)};
  setTimeout(reveal,0);
 });
 return {panel,dialog,render,open};
}
