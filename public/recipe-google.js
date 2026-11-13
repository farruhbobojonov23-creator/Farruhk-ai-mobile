import {readyArchive,recipeDigest} from './recipe-release.js';
const PROJECT_CATALOG_KEY='farruh-ai-project-catalog-v1';
const PROJECT_FILTER_KEY='farruh-ai-ttk-project-filter-v2';
function linkedProjects(state){
 let saved;
 try{saved=JSON.parse(localStorage.getItem(PROJECT_CATALOG_KEY)||'null')?.projects}catch{}
 const defaults=[{id:'more-sushi',name:'Море Суши'},{id:'sushi-beri',name:'Суши Бери'}];
 const projects=new Map([['general',{id:'general',name:'Без проекта'}]]);
 for(const project of Array.isArray(saved)?saved:defaults)
  if(typeof project?.id==='string'&&project.id.trim()&&typeof project?.name==='string'&&project.name.trim())
    projects.set(project.id,{id:project.id,name:project.name.trim()});
 for(const recipe of [...(state?.recipes||[]),...(state?.releasedRecipes||[])])
  if(recipe.projectId&&!projects.has(recipe.projectId))
    projects.set(recipe.projectId,{id:recipe.projectId,name:recipe.projectName||'Проект '+recipe.projectId});
 return [...projects.values()];
}
export function mountGoogleSync({getState,store,onState,notify}){
 let running=false,timer,settingsOpen=false,projectSyncError='';const summary=document.createElement('div');summary.className='ttk-sync-summary';const status=document.createElement('span');status.setAttribute('role','status');const button=document.createElement('button');button.type='button';button.textContent='Google Документы';const archiveButton=document.createElement('button');archiveButton.type='button';archiveButton.textContent='Готовые версии';summary.append(status,archiveButton,button);const documentLink=document.createElement('a');documentLink.hidden=true;documentLink.target='_blank';documentLink.rel='noopener';documentLink.textContent='Открыть сборник';summary.append(documentLink);
 const retryButton=document.createElement('button');retryButton.type='button';retryButton.textContent='↻ Отправить сейчас';retryButton.hidden=true;retryButton.setAttribute('aria-label','Повторно отправить готовые техкарты в Google');
 const syncDetail=document.createElement('p');syncDetail.className='small';syncDetail.hidden=true;syncDetail.setAttribute('role','status');syncDetail.style.margin='10px 0 0';syncDetail.style.overflowWrap='anywhere';summary.append(retryButton,syncDetail);// Keep optional Google controls accessible without breaking the approved TTK
 // header: the hero subtitle lives inside a strict CSS grid.
 const recipesView=document.querySelector('#recipes');
 const backupTools=document.createElement('details');backupTools.className='lx-sync-details';
 const backupTitle=document.createElement('summary');backupTitle.textContent='Облачные копии и готовые версии ТТК';
 backupTools.append(backupTitle,summary);recipesView.append(backupTools);
 const dialog=document.createElement('dialog');dialog.className='category-dialog';dialog.setAttribute('aria-label','Автосохранение готовых ТТК');dialog.innerHTML='<div class="bar"><h2>Автосохранение готовых ТТК</h2><button data-close type="button">✕</button></div><p>Только готовые ТТК отправляются в Google. Изменения обновляют ту же вкладку, без дублей. Возврат в разработку сохраняет последнюю готовую версию.</p><p><a href="/google-ttk-setup.html" target="_blank" rel="noopener">Как один раз подключить Google</a></p><form><label>Адрес подключения Google<input name="endpoint" type="url" placeholder="https://script.google.com/macros/s/…/exec" required></label><div class="bar"><button data-copy-endpoint type="button">📋 Скопировать ссылку</button></div><label>Ключ подключения<input name="key" type="password" minlength="24" autocomplete="off" required></label><div class="bar"><button data-toggle-key type="button">Показать ключ</button><button data-copy-key type="button">📋 Скопировать ключ</button></div><p class="small">Адрес и ключ сохраняются в этом браузере. Ключ можно скопировать для повторного подключения, не показывая его на экране. Никому не передавайте ключ.</p><label><input name="enabled" type="checkbox" style="width:auto" checked> Автоматически сохранять готовые ТТК</label><div class="bar"><button class="primary" type="submit">Проверить и подключить</button><button data-disable type="button">Отключить</button></div></form><p data-result role="status"></p>';document.body.append(dialog);
 const archiveDialog=document.createElement('dialog');archiveDialog.className='category-dialog';archiveDialog.setAttribute('aria-label','Последние готовые версии ТТК');document.body.append(archiveDialog);
 archiveButton.onclick=()=>{archiveDialog.innerHTML='<div class="bar"><h2>Последние готовые версии</h2><button type="button">✕</button></div><p>Здесь остаётся последняя сохранённая готовая версия каждой ТТК, даже после возврата в разработку.</p>';archiveDialog.querySelector('button').onclick=()=>archiveDialog.close();const recipes=readyArchive(getState()||{});if(!recipes.length){const empty=document.createElement('p');empty.textContent='Готовых ТТК пока нет.';archiveDialog.append(empty)}for(const recipe of recipes){const row=document.createElement('div');row.className='row';const label=document.createElement('span');label.textContent=recipe.name+' · '+recipe.category;const download=document.createElement('button');download.type='button';download.textContent='Скачать Word';download.onclick=async()=>{download.disabled=true;try{const response=await fetch('/api/recipes/word',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipe})});if(!response.ok)throw Error('Не удалось подготовить Word.');const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='ТТК_'+recipe.name+'.docx';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){notify(e.message,true)}finally{download.disabled=false}};row.append(label,download);archiveDialog.append(row)}archiveDialog.showModal()};
 const form=dialog.querySelector('form'),result=dialog.querySelector('[data-result]');dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{settingsOpen=false;form.elements.key.type='password';dialog.querySelector('[data-toggle-key]').textContent='Показать ключ'});
 const copySetting=async(name,label)=>{const value=String(form.elements[name].value||'').trim();if(!value){result.textContent=label+' ещё не указан.';return}try{await navigator.clipboard.writeText(value);result.textContent=label+' скопирован'+(name==='endpoint'?'а':'')+'.'}catch{result.textContent='Не удалось автоматически скопировать. Выделите значение в поле и скопируйте вручную.'}};
 dialog.querySelector('[data-copy-endpoint]').onclick=()=>copySetting('endpoint','Ссылка');
 dialog.querySelector('[data-copy-key]').onclick=()=>copySetting('key','Ключ');
 dialog.querySelector('[data-toggle-key]').onclick=()=>{const input=form.elements.key;const show=input.type==='password';input.type=show?'text':'password';dialog.querySelector('[data-toggle-key]').textContent=show?'Скрыть ключ':'Показать ключ'};
 const mutate=async fn=>{const next=await store.mutate(fn);onState(next);render()};
 const post=async body=>{const response=await fetch('/api/recipes/google-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(110000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Google временно недоступен.');return data};
 button.onclick=()=>{if(!getState())return;const config=getState().googleSync||{};form.elements.endpoint.value=config.endpoint||'';form.elements.key.value=config.key||'';form.elements.enabled.checked=config.enabled!==false;result.textContent='';settingsOpen=true;dialog.showModal()};
 form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;result.textContent='Проверяю соединение с Google…';try{const config={endpoint:form.elements.endpoint.value.trim(),key:form.elements.key.value.trim(),enabled:form.elements.enabled.checked};if(/^https?:\/\//i.test(config.key)||config.key===config.endpoint)throw Error('В поле «Ключ подключения» вставлена ссылка Google Apps Script. Ссылка и ключ — разные данные. Скопируйте настоящий ключ из подключённого устройства или журнала выполнения initialize в Google Apps Script.');if(/\/\*|\*\/|function\s|const\s|Farukh AI ready|WORKING_DOCUMENT_ID|\n/i.test(config.key))throw Error('Вы вставили код программы Code.gs, а не ключ. В существующем проекте Google Apps Script выполните initialize и скопируйте из журнала только значение после «Ключ подключения:».');const checked=await post({...config,action:'check'});const old=getState().googleSync;await mutate(s=>{s.googleSync={...config,documentUrl:checked.documentUrl};if(old?.endpoint!==config.endpoint||old?.key!==config.key){s.googleDelivery={};s.googleProjects={}}});result.textContent='Google подключён. Готовые ТТК будут отправлены автоматически.';schedule()}catch(err){result.textContent=err.message}finally{submit.disabled=false}};
 dialog.querySelector('[data-disable]').onclick=async()=>{try{await mutate(s=>{if(s.googleSync)s.googleSync.enabled=false});result.textContent='Автоматическая отправка отключена. ТТК в Google сохранены.'}catch(e){result.textContent=e.message}};
 async function render(){
  const s=getState();if(!s)return;
  const recipes=readyArchive(s),count=recipes.length,config=s.googleSync;
  let safeUrl=null;
  const selected=localStorage.getItem(PROJECT_FILTER_KEY)||'all';
  const chosen=selected==='all'?null:s.googleProjects?.[selected];
  const fallback=selected==='all'||selected==='sushi-beri'?config?.documentUrl:null;
  try{const u=new URL(chosen?.documentUrl||fallback);if(u.protocol==='https:'&&u.hostname==='docs.google.com')safeUrl=u.href}catch{}
  documentLink.hidden=!safeUrl;
  documentLink.textContent=chosen?'Открыть Google-документ этого проекта':'Открыть Google-документ';
  if(safeUrl)documentLink.href=safeUrl;
  retryButton.hidden=!config?.enabled||!count;
  retryButton.disabled=running;
  syncDetail.hidden=true;
  if(projectSyncError){syncDetail.textContent=projectSyncError;syncDetail.hidden=false}
  if(!config?.enabled){status.textContent='Готовых ТТК: '+count+' · Google не подключён';return}
  if(!navigator.onLine){status.textContent='Google: нет интернета. Готовые ТТК остаются на устройстве.';return}
  if(running){status.textContent='Отправляю готовые ТТК в Google…';return}
  status.textContent='Google: проверяю готовые версии…';
  try{
   const digests=await Promise.all(recipes.map(recipeDigest));
   if(getState()!==s||running)return;
   const deliveries=recipes.map(r=>s.googleDelivery?.[r.id]);
   const confirmed=deliveries.filter((d,i)=>d?.digest===digests[i]&&d?.layoutVersion==='burgundy-1'&&!d.error).length;
   const pending=count-confirmed;
   const failed=deliveries.filter(d=>d?.error);
   retryButton.hidden=!pending;
   if(!pending){status.textContent='✅ Google: сохранено '+confirmed+' из '+count+' готовых ТТК';return}
   status.textContent='Google: ожидают отправки '+pending+' из '+count+' готовых ТТК.';
   if(failed.length){
    const error=failed[failed.length-1];
    const name=recipes.find(r=>s.googleDelivery?.[r.id]===error)?.name||'ТТК';
    const safeError=String(error.error||'Неизвестная ошибка').split(config.key||'\u0000').join('[ключ скрыт]').split(config.endpoint||'\u0000').join('[адрес скрыт]');
    syncDetail.textContent='Причина для «'+name+'»: '+safeError.slice(0,350)+'. Нажмите «Отправить сейчас» для повторной попытки.';
    syncDetail.hidden=false;
   }
  }catch(e){status.textContent='Google: не удалось проверить готовые ТТК';syncDetail.textContent=String(e.message||e);syncDetail.hidden=false}
 }
 async function ensureProjects(){
  const config=getState()?.googleSync;
  if(!config?.enabled||!config.endpoint||!config.key)return false;
  const list=linkedProjects(getState());
  for(const project of list){
   const previous=getState()?.googleProjects?.[project.id];
   if(previous?.name===project.name&&previous.documentUrl&&!previous.error)continue;
   try{
    const result=await post({...config,action:'ensureProject',projectId:project.id==='general'?'':project.id,projectName:project.name});
    if(!result.documentUrl||!result.folderUrl)throw Error('Не получена ссылка на папку и документ проекта. Обновите Google Apps Script.');
    await mutate(s=>{if(s.googleSync?.endpoint!==config.endpoint||s.googleSync?.key!==config.key)return;
      s.googleProjects??={};s.googleProjects[project.id]={name:project.name,documentUrl:result.documentUrl,folderUrl:result.folderUrl,syncedAt:new Date().toISOString()};
    });
    projectSyncError='';
   }catch(err){
    projectSyncError='Google: проект «'+project.name+'» не подключён. '+String(err?.message||err).slice(0,250);
    render();
    return false;
   }
  }
  return true;
 }
 async function flush(){
  const config=getState()?.googleSync;
  if(running||!config?.enabled||!navigator.onLine)return;
  running=true;render();
  let failures=0;
  try{
   if(!await ensureProjects())return;
   for(const recipe of readyArchive(getState())){
    if(!getState()?.googleSync?.enabled||getState().googleSync.endpoint!==config.endpoint||getState().googleSync.key!==config.key)break;
    const digest=await recipeDigest(recipe);
    const previous=getState().googleDelivery?.[recipe.id];
    if(previous?.digest===digest&&previous?.layoutVersion==='burgundy-1'&&!previous.error)continue;
    try{
     const name=linkedProjects(getState()).find(x=>x.id===(recipe.projectId||'general'))?.name||recipe.projectName||'Без проекта';
     const response=await post({...config,action:'sync',recipe,digest,projectId:recipe.projectId||'',projectName:name});
     await mutate(s=>{
      if(s.googleSync?.endpoint!==config.endpoint||s.googleSync?.key!==config.key)return;
      s.googleDelivery??={};
      s.googleDelivery[recipe.id]={digest,layoutVersion:'burgundy-1',projectId:recipe.projectId||'',url:response.documentUrl,tabId:response.tabId,syncedAt:new Date().toISOString()};
     });
    }catch(e){
     failures++;
     await mutate(s=>{
      if(s.googleSync?.endpoint!==config.endpoint||s.googleSync?.key!==config.key)return;
      s.googleDelivery??={};
      s.googleDelivery[recipe.id]={...s.googleDelivery[recipe.id],error:String(e?.message||'Google не подтвердил сохранение.'),lastAttemptAt:new Date().toISOString()};
     });
     // A broken TTK must not block other ready TTKs. Avoid hammering an unavailable Google service.
     if(failures>=4)break;
    }
   }
  }finally{running=false;render()}
 }
 retryButton.onclick=()=>flush().catch(e=>notify('Google: '+e.message,true));
 function schedule(){
  const cfg=getState()?.googleSync;
  if(!cfg?.enabled||!cfg.endpoint)return; // No configured Google account: no background work.
  clearTimeout(timer);
  // Debounce rapid changes; do not re-hash every TTK on each ordinary task/chat save.
  timer=setTimeout(()=>flush().catch(e=>notify(e.message,true)),1500);
  if(settingsOpen)render();
 }
 window.addEventListener('online',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 document.addEventListener('pf:projects',schedule);
 // Immediate save after a change is still scheduled; periodic retry is deliberately sparse.
 setInterval(()=>{if(!document.hidden)flush().catch(()=>{})},5*60*1000);
 return {schedule,render};
}
