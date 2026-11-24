/* FARUKH REVISION PRO 0.5.7 — explicit save lifecycle and durable receipt.
 * Never display "saved" unless the new record exists in the audited state.
 * No schema changes, no synthetic audits, no automatic retries, no new writes.
 */
(()=>{
 'use strict';
 const el=id=>document.getElementById(id);
 const $create=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n};
 const storageKey='farukh-revision-last-save-receipt-v057';
 let pending=false,lastConsent='untouched',lastRecord=null;
 let status='';
 function stamp(rec){
  const date=new Date(Number(rec.timestamp)||Date.now());
  return date.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 }
 function receiptHTML(rec){
  const stateLabel=rec.pendingSync?'Сохранено на устройстве · ожидает облака':
    cloudEnabled?'Сохранено в облаке MORE SUSHI':'Сохранено на устройстве';
  const icon=rec.pendingSync?'⏳':'✅';
  return '<div class="rev057-receipt-heading">'+icon+' '+stateLabel+'</div>'+
   '<div class="rev057-receipt-details">Точка: <b>'+safe(rec.store)+'</b> · '+
   (rec.type==='start'?'Начальная':'Повторная')+' ревизия · '+safe(rec.date)+
   '<br>Позиций: '+(rec.products?.length||0)+' · Запись: '+stamp(rec)+'</div>'+
   '<div class="rev057-receipt-actions"><button type="button" class="btn soft" data-rev057-history>Открыть историю →</button></div>';
 }
 const row=el('view-revision')?.querySelector('.tablewrap + .row');
 const saveButton=row?.querySelector('button[onclick="saveRevision()"]');
 if(!row||!saveButton)return;
 const banner=$create('section','rev057-save-banner');
 banner.id='rev057SaveBanner';banner.setAttribute('aria-live','polite');
 banner.setAttribute('role','status');
 banner.innerHTML='<strong>Результат пока не сохранён</strong><small>Сейчас открыт черновик. Нажми «Сохранить», чтобы добавить ревизию в историю.</small>';
 row.before(banner);
 const historyBanner=$create('section','rev057-history-receipt');
 historyBanner.id='rev057HistoryReceipt';
 const history=el('view-history');
 history?.querySelector('.sectionheading')?.after(historyBanner);
 let lastAttempt=null;
 function show(type,html){
  const target=type==='success'||type==='pending'?historyBanner:banner;
  if(type==='success'||type==='pending'){
   historyBanner.className='rev057-history-receipt is-'+type;
   historyBanner.innerHTML=html;
   banner.className='rev057-save-banner is-'+type;
   banner.innerHTML=html;
  }else{
   banner.className='rev057-save-banner is-'+type;
   banner.innerHTML=html;
  }
  for(const b of document.querySelectorAll('[data-rev057-history]')){
   b.addEventListener('click',()=>go('history',document.querySelectorAll('.menu button')[2]));
  }
 }
 function showReceipt(rec){
  lastRecord=rec;
  const type=rec.pendingSync?'pending':'success';
  show(type,receiptHTML(rec));
  try{sessionStorage.setItem(storageKey,String(rec.id))}catch{}
 }
 function captureHistoryReceipt(){
  const id=(()=>{try{return sessionStorage.getItem(storageKey)}catch{return null}})();
  const found=id?state.history.find(r=>String(r.id)===id):null;
  if(found && found.store===el('store')?.value)showReceipt(found);
  else {historyBanner.className='rev057-history-receipt';historyBanner.innerHTML='';}
 }
 function resetDraftReceipt(){
  if(pending)return;
  if(banner.classList.contains('is-success')||banner.classList.contains('is-pending')){
   banner.className='rev057-save-banner';
   banner.innerHTML='<strong>Текущая ревизия — черновик</strong><small>Последняя сохранённая запись находится в «Истории». Новые значения сохраняются отдельно.</small>';
  }
 }
 const dialog=$create('dialog','rev057-confirm');
 dialog.id='rev057Confirm';
 dialog.innerHTML='<form method="dialog" class="rev057-confirm-body">'+
  '<span class="rev057-confirm-icon" aria-hidden="true">💾</span>'+
  '<h2>Сохранить ревизию?</h2>'+
  '<p>Проверка попадёт в историю только после успешного сохранения.</p>'+
  '<div id="rev057ConfirmDetail"></div>'+
  '<div class="rev057-confirm-actions">'+
  '<button type="button" class="btn soft" id="rev057Cancel">Вернуться</button>'+
  '<button type="button" class="btn main" id="rev057Approve">Да, сохранить</button></div></form>';
 document.body.append(dialog);
 window.rev057Confirm=async function(message){
  lastConsent='not-accepted';
  if(!dialog.showModal){const response=window.confirm(message);lastConsent=response?'approved':'canceled';return response}
  const name=el('store')?.value||'',date=el('when')?.value||'';
  const mode=el('mode')?.value==='start'?'Начальная':'Повторная';
  const detail=el('rev057ConfirmDetail');
  detail.textContent=mode+' ревизия · '+name+' · '+date+' · '+state.products.length+' позиций';
  return new Promise(resolve=>{
   let done=false;
   const finish=accepted=>{
    if(done)return;done=true;lastConsent=accepted?'approved':'canceled';
    if(dialog.open)dialog.close();
    resolve(accepted);
   };
   const yes=el('rev057Approve'),no=el('rev057Cancel');
   yes.onclick=()=>finish(true);
   no.onclick=()=>finish(false);
   dialog.oncancel=e=>{e.preventDefault();finish(false)};
   try{dialog.showModal()}catch{
    finish(window.confirm(message));
   }
  });
 };
 const formerSave=saveRevision;
 saveRevision=async function(){
  if(pending)return;
  pending=true;lastConsent='untouched';
  const existing=new Set(state.history.map(r=>String(r.id)));
  const originalLabel=saveButton.innerHTML;
  saveButton.disabled=true;
  saveButton.textContent='Сохраняется…';
  show('working','<strong>⏳ Проверка сохранения</strong><small>Подтверди действие в появившемся окне. Пока новая запись не создана.</small>');
  try{
   await formerSave();
   const newAudit=state.history.find(r=>!existing.has(String(r.id)));
   if(newAudit){
    showReceipt(newAudit);
    // Old code changes to the History tab only for a genuinely created record.
    if(active!=='history')go('history',document.querySelectorAll('.menu button')[2]);
    renderHistory();
    notice(newAudit.pendingSync?'Сохранено на телефоне. Ожидает отправки в облако.':'Ревизия сохранена. Запись есть в истории.');
   }else if(lastConsent==='canceled'){
    show('canceled','<strong>Сохранение отменено</strong><small>Ревизия осталась черновиком. Ничего не удалено.</small>');
   }else{
    show('failed','<strong>❌ Не сохранено</strong><small>Новая запись в истории не появилась. Проверь введённые значения и сообщение об ошибке. Черновик остаётся на устройстве.</small>');
   }
  }catch(err){
   const message=String(err?.message||err||'неизвестная ошибка');
   show('failed','<strong>❌ Ошибка сохранения</strong><small>Новая запись не подтверждена. '+safe(message)+'. Проверь соединение, не очищай черновик.</small>');
   notice('Не удалось сохранить ревизию: '+message);
  }finally{
   saveButton.disabled=false;saveButton.innerHTML=originalLabel;pending=false;
  }
 };
 const formerHistory=renderHistory;
 renderHistory=function(){
  formerHistory();
  captureHistoryReceipt();
 };
 const inputs=el('rows');
 inputs?.addEventListener('input',resetDraftReceipt);
 el('store')?.addEventListener('change',resetDraftReceipt);
 el('mode')?.addEventListener('change',resetDraftReceipt);
 const originalGo=go;
 go=function(view,button){
  const result=originalGo(view,button);
  if(view==='revision')resetDraftReceipt();
  return result;
 };
 captureHistoryReceipt();
})();
