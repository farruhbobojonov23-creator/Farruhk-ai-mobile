/**
 * One entry point for all FARRUH AI data flows. The underlying services remain
 * independent: saving a recipe locally never implies Google Docs delivery.
 * Existing device data, backups and connection keys are never migrated/deleted.
 */
export function createDataCenter({getState,settingsDialog,notify}){
 const dialog=document.createElement('dialog');
 dialog.id='data-center-dialog';
 dialog.className='data-center-dialog';
 dialog.setAttribute('aria-label','Мои данные — сохранение и синхронизация');
 dialog.innerHTML=`<div class="data-center-shell">
  <header class="data-center-header"><div><span class="data-center-eyebrow">FARRUH AI · БЕЗОПАСНОЕ ХРАНЕНИЕ</span>
   <h2>☁️ Мои данные</h2><p>Все сохранения, Google и синхронизация — в одном месте.</p></div>
   <button type="button" data-close aria-label="Закрыть мои данные">✕</button></header>
  <section class="data-center-section" data-local-section><h3>💾 На этом устройстве</h3>
   <p class="data-center-info" data-local-status role="status">Техкарты сохраняются в этом браузере.</p>
   <div data-local-root></div></section>
  <section class="data-center-section" data-google-section><h3>📄 Google Документы · готовые ТТК</h3>
   <p class="data-center-info">Готовые техкарты отправляются в документ своего проекта. Черновики не отправляются. Для печати хранится PDF A4.</p>
   <div data-google-root></div></section>
  <section class="data-center-section" data-backup-section><h3>🛡 Google Диск · резервная копия</h3>
   <p class="data-center-info" data-backup-status role="status">Проверяю резервирование…</p>
   <div class="data-center-actions"><button type="button" data-backup-now>Создать копию сейчас</button></div>
   <div data-backup-root></div></section>
  <section class="data-center-section" data-device-section><h3>📱 Телефон и планшет</h3>
   <p class="data-center-info">Необязательно. Используйте только если нужны общие ТТК на нескольких устройствах. При конфликте версий объединение останавливается без удаления записей.</p>
   <div data-device-root></div></section>
  <p class="data-center-footnote">В Google сохраняются только подтверждённые отправки. Выключение функции не удаляет уже сохранённые документы и копии.</p>
 </div>`;
 document.body.append(dialog);
 const root=selector=>dialog.querySelector(selector);
 const localRoot=root('[data-local-root]');
 const googleRoot=root('[data-google-root]');
 const backupRoot=root('[data-backup-root]');
 const deviceRoot=root('[data-device-root]');
 let bindings=null;
 const localStatus=root('[data-local-status]'),backupStatus=root('[data-backup-status]'),backupNow=root('[data-backup-now]');
 root('[data-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{
  if(e.target!==dialog)return;
  const box=dialog.getBoundingClientRect();
  if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();
 });
 function refresh(){
  const state=getState();
  const recipes=state?.recipes||[];
  const ready=recipes.filter(r=>r.status==='ready'&&!r.archived).length;
  const drafts=recipes.filter(r=>r.status!=='ready'&&!r.archived).length;
  localStatus.textContent=state?'✅ На устройстве: '+ready+' готовых ТТК, '+drafts+' в разработке.':'Загружаю сохранённые данные устройства…';
  const google=state?.googleBackup;
  if(!google?.endpoint||!google?.key){
   backupStatus.textContent='⚪ Google Диск не подключён. Локальную резервную копию можно скачать ниже.';
  }else if(google.enabled===false){
   backupStatus.textContent='⏸ Автокопии выключены. Ранее созданные файлы не удалены.';
  }else if(google.lastBackupAt){
   const date=Date.parse(google.lastBackupAt);
   backupStatus.textContent='✅ Ежедневное резервирование включено. Последняя подтверждённая копия: '+(Number.isFinite(date)?new Date(date).toLocaleString('ru-RU'):'дата неизвестна')+'.';
  }else{
   backupStatus.textContent='🟡 Автокопии включены, первая копия Google ещё не подтверждена.';
  }
  backupNow.disabled=!google?.endpoint||!google?.key;
  bindings?.googleSync?.render();
  bindings?.googleDriveBackup?.render();
 }
 backupNow.onclick=async()=>{
  if(!bindings?.googleDriveBackup)return;
  backupNow.disabled=true;
  backupStatus.textContent='Отправляю резервную копию в Google Диск…';
  try{
   const confirmed=await bindings.googleDriveBackup.backup({manual:true});
   refresh();
   if(!confirmed)backupStatus.textContent='⚠️ Google не подтвердил новую копию. Откройте настройки Google Диска для просмотра ошибки.';
  }catch(e){backupStatus.textContent='⚠️ '+String(e.message||e);notify?.(e.message||String(e),true)}
  finally{backupNow.disabled=!getState()?.googleBackup?.endpoint}
 };
 function bind({googleSync,googleDriveBackup,deviceCloudSync}){
  bindings={googleSync,googleDriveBackup,deviceCloudSync};
  refresh();
 }
 function open(){
  if(settingsDialog?.open)settingsDialog.close();
  if(!dialog.open)dialog.showModal();
  const local=dialog.querySelector('[data-local-root] details');
  if(local)local.open=true;
  const google=dialog.querySelector('[data-google-root] details');
  if(google)google.open=true;
  const devices=dialog.querySelector('[data-device-root] details');
  if(devices)devices.open=true;
  refresh();
 }
 return {dialog,localRoot,googleRoot,backupRoot,deviceRoot,bind,open,refresh};
}
