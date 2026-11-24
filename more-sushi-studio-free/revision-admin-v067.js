/* FARUKH REVISION PRO 0.6.7
 * Admin = authenticated audit owner. Menu is owner-only; database RLS is final authority.
 * Edits use revision_no optimistic concurrency, server-triggered history and 30-day bin.
 * Never automatically change earlier or later audits; archived prices stay unchanged.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const make=(tag,klass,txt)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(txt!==undefined)n.textContent=txt;return n};
const num=(n,d=3)=>Number(n).toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:d});
const money=n=>num(n,2)+' ₽';
const status=msg=>{if(typeof notice==='function')notice(msg)};
const owner=()=>{try{return cloudEnabled&&rev041Account()?rev041Account():null}catch{return null}};
let roleCheckedFor=null,adminVerified=false;
function checkAdminRole(){
 const id=owner();
 if(!id){roleCheckedFor=null;adminVerified=false;return}
 if(roleCheckedFor===id)return;
 roleCheckedFor=id;adminVerified=false;
 void rest('revision_audit_admins',{query:'?user_id=eq.'+encodeURIComponent(id)+'&select=user_id'})
 .then(rows=>{
  if(owner()!==id)return;
  adminVerified=Array.isArray(rows)&&rows.length===1&&rows[0].user_id===id;
  renderHistory();
 }).catch(err=>{
  if(owner()===id)roleCheckedFor=null;
  console.warn('Audit admin permission check unavailable',err);
 });
}
const currentOwner=r=>adminVerified&&owner()&&r.ownerId===owner()&&!r.pendingSync&&!r.deletedAt;
const norm=r=>({id:r.id,rev:Number(r.revisionNo||1)});
const valid=v=>{const s=String(v??'').trim().replace(',','.');if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(s))throw Error('Вес должен быть числом от 0, до трёх знаков после запятой');return Number(s)};
const rounded=v=>Math.round((Number(v)+Number.EPSILON)*1000)/1000;
const isoToday=()=>{const d=new Date(),n=new Date(d.getTime()-d.getTimezoneOffset()*60000);return n.toISOString().slice(0,10)};
function el(tag,klass,text){return make(tag,klass,text)}
let activeOverlay=null;
function overlay(title){
 if(activeOverlay){activeOverlay.remove();activeOverlay=null}
 const screen=el('div','rev067-overlay'),panel=el('section','rev067-panel');
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);
 const top=el('div','rev067-heading'),heading=el('h2','',title),close=el('button','rev067-close','×');
 close.type='button';close.setAttribute('aria-label','Закрыть');
 top.append(heading,close);panel.append(top);screen.append(panel);document.body.append(screen);
 const finished=()=>{screen.remove();if(activeOverlay===screen)activeOverlay=null;document.removeEventListener('keydown',key)};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();finished()}};
 close.onclick=finished;document.addEventListener('keydown',key);
 activeOverlay=screen;
 close.focus();
 return {screen,panel,close:finished};
}
function subtitle(root,text){root.append(el('p','rev067-sub',text))}
function btn(label,fn,extra=''){
 const b=el('button','btn soft '+extra,label);b.type='button';b.addEventListener('click',fn);return b;
}
function actions(root,buttons){const box=el('div','rev067-buttons');buttons.forEach(b=>box.append(b));root.append(box)}
function fail(panel,error){
 let node=panel.querySelector('.rev067-error');
 if(!node){node=el('div','rev067-error');panel.append(node)}
 node.textContent=String(error?.message||error||'Неизвестная ошибка');
}
function storeRecord(server){return rev041CloudRecord(server)}
function updateUi(){
 try{rev041SaveCloudCache()}catch(error){console.warn('Audit cache refresh failed',error)}
 try{renderHistory();renderSummary()}catch(error){console.warn('Audit list refresh failed',error)}
}
async function patch(r,body){
 if(!currentOwner(r))throw Error('Изменения доступны только владельцу облачного аккаунта');
 const query='?id=eq.'+encodeURIComponent(r.id)+'&revision_no=eq.'+encodeURIComponent(r.revisionNo||1)+'&select=*';
 const result=await rest('revision_audits',{method:'PATCH',query,body});
 if(!Array.isArray(result)||result.length!==1||result[0].id!==r.id)
  throw Error('Запись изменилась на сервере. Обновите историю и повторите действие.');
 const saved=storeRecord(result[0]);
 if(saved.revisionNo!==(Number(r.revisionNo||1)+1))
  throw Error('Новый номер версии не подтверждён. Проверьте историю.');
 return saved;
}
function getRecord(id){return (state.history||[]).find(r=>r.id===id)||null}
function recordMeta(r){return r.store+' · '+r.date+' · '+(r.type==='start'?'Начальная':'Повторная')+' · '+r.products.length+' продуктов'}
function previewMeta(panel,r){panel.append(el('div','rev067-meta',recordMeta(r)+' · версия '+r.revisionNo))}
function confirmDialog(title,description,yes,doIt,after){
 const {panel,close}=overlay(title);
 subtitle(panel,description);
 const buttons=el('div','rev067-form-actions');
 buttons.append(btn('Отмена',close),btn(yes,async()=>{
  const b=buttons.lastChild;b.disabled=true;
  try{await doIt();close();if(after)after()}
  catch(err){fail(panel,err)}
  finally{b.disabled=false}
 },'main'));
 panel.append(buttons);
}
function openMenu(id){
 const r=getRecord(id);
 if(!r||!currentOwner(r)){status('Только владелец может изменить сохранённую облачную ревизию');return}
 const {panel,close}=overlay('Управление ревизией');
 previewMeta(panel,r);
 subtitle(panel,'Историческая закупочная цена остаётся без изменений. Все исправления записываются в журнал.');
 actions(panel,[
  btn('👁 Посмотреть продукты',()=>{
   close();go('history',document.querySelectorAll('.menu button')[2]);
   const details=[...$('allhistory').querySelectorAll('.rev053-history-card')].find(el=>el.dataset.rev067Id===id)?.querySelector('details.rev053-history-details');
   if(details){details.open=true;details.scrollIntoView({behavior:'smooth',block:'center'})}
  }),
  btn('✏️ Редактировать',()=>openEditor(id)),
  btn('🕘 История изменений',()=>openEvents(id)),
  btn('🗑 Переместить в корзину',()=>trashConfirm(id),'rev067-danger')
 ]);
}
async function trashConfirm(id){
 const r=getRecord(id);if(!r||!currentOwner(r))return status('Нет прав на удаление');
 const {panel,close}=overlay('В корзину на 30 дней?');
 subtitle(panel,'Ревизия исчезнет из истории и общей сводки. В течение 30 дней её можно восстановить. Никакие другие ревизии не изменятся.');
 previewMeta(panel,r);
 if(r.type==='start')panel.append(el('div','rev067-warning','Внимание: это начальная база. Её удаление не пересчитает автоматически последующие ревизии.'));
 const row=el('div','rev067-form-actions');
 row.append(btn('Отмена',close),btn('Да, в корзину',async()=>{
  const button=row.lastChild;button.disabled=true;
  try{
   await patch(r,{deleted_at:new Date().toISOString()});
   state.history=state.history.filter(x=>x.id!==id);
   close();updateUi();status('Ревизия перемещена в корзину. Восстановление — 30 дней.');
  }catch(e){fail(panel,e)}finally{button.disabled=false}
 },'rev067-danger'));
 panel.append(row);
}
function field(name,kind,value,params={}){
 const l=el('label','',name),input=el('input');
 input.type=kind==='number'?'text':kind;input.value=value==null?'':String(value);
 if(kind==='number'){input.inputMode='decimal';input.autocomplete='off'}
 if(params.maxLength)input.maxLength=params.maxLength;
 l.append(input);return {label:l,input};
}
function openEditor(id){
 const r=getRecord(id);
 if(!r||!currentOwner(r))return status('Нет прав на редактирование');
 const {panel,close}=overlay('Редактировать ревизию');
 previewMeta(panel,r);
 const note=el('p','rev067-sub','Измени количество и нажми «Сохранить изменения». Недостача, излишек и суммы пересчитаются автоматически. Цена за кг сохранена из этой ревизии.');
 panel.append(note);
 if(r.type==='start')panel.append(el('div','rev067-warning','Исправление начальной базы не изменит уже проведённые повторные сверки.'));
 const form=el('form','rev067-form');form.noValidate=true;
 const date=field('Дата ревизии','date',r.date);
 date.input.max=isoToday();
 const operator=field('Сотрудник','text',r.operator,{maxLength:120});
 const memo=el('label','','Комментарий');
 const notes=el('textarea');notes.maxLength=2000;notes.rows=2;notes.value=r.notes||'';memo.append(notes);
 form.append(date.label,operator.label,memo);
 const rows=[];
 for(const p of r.products){
  const row=el('div','rev067-editline'),name=el('strong','rev067-editname',p.name);
  row.append(name);
  const start=r.type==='start',pfEnabled=Number(p.loss||0)>0||Number(p.pf||0)>0;
  const base=field('Склад, кг','number',p.raw??p.actual??0);
  const semi=pfEnabled?field('Полуфабрикаты, кг','number',p.pf??0):null;
  const program=start?null:field('Учёт Frontpad, кг','number',p.program??0);
  row.append(base.label);
  if(semi)row.append(semi.label);
  if(program)row.append(program.label);
  const annotation=el('div','rev067-readonly','Цена в этой ревизии: '+(p.price==null?'не указана':money(p.price)+'/кг')+
   (pfEnabled?' · поправка ПФ '+num(p.loss||0,1)+'%':''));
  row.append(annotation);
  const totals=el('div','rev067-totals'),result=el('span'),price=el('b');totals.append(result,price);row.append(totals);
  const item={p,base,semi,program,result,price};
  const recalc=()=>{
   try{
    const r1=valid(base.input.value),p1=semi?valid(semi.input.value):0;
    const loss=Number(p.loss||0);
    const actual=rounded(r1+p1*(1+loss/100));
    const account=start?actual:valid(program.input.value);
    const diff=rounded(actual-account);
    result.textContent=start?'Факт: '+num(actual)+' кг':'Разница: '+(diff>0?'+':diff<0?'−':'')+num(Math.abs(diff))+' кг';
    price.textContent=start?'Начальная база':p.price==null?'нет цены':
      (diff<0?'−':diff>0?'+':'')+money(Math.abs(diff*Number(p.price)));
    price.style.color=diff<0?'#ff7e9b':diff>0?'#7ce8b8':'#e8d09e';
    return {...p,raw:r1,pf:p1,actual,program:account,diff};
   }catch{result.textContent='Проверь число';price.textContent='—';return null}
  };
  [base,semi,program].filter(Boolean).forEach(x=>x.input.addEventListener('input',recalc));
  form.append(row);rows.push({recalc,p});
  recalc();
 }
 const error=el('div','rev067-error');form.append(error);
 const controls=el('div','rev067-form-actions');
 const cancel=btn('Отмена',close),save=btn('💾 Сохранить изменения',async()=>{},'main');
 save.type='submit';controls.append(cancel,save);form.append(controls);
 form.addEventListener('submit',async e=>{
  e.preventDefault();error.textContent='';
  if(!currentOwner(r)){error.textContent='Владелец не подтверждён';return}
  const chosen=date.input.value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(chosen)||chosen>isoToday()){error.textContent='Проверь дату ревизии';return}
  const changed=rows.map(x=>x.recalc());
  if(changed.some(v=>!v)){error.textContent='Проверь введённые веса продуктов';return}
  const name=operator.input.value.trim();
  if(name.length>120){error.textContent='Имя сотрудника слишком длинное';return}
  const same=chosen===r.date&&name===r.operator&&(notes.value||'')===(r.notes||'')&&JSON.stringify(changed)===JSON.stringify(r.products);
  if(same){error.textContent='Изменений нет';return}
  save.disabled=true;save.textContent='Сохраняю…';
  try{
   const updated=await patch(r,{audit_date:chosen,operator_name:name,notes:notes.value,items:changed});
   state.history=state.history.map(v=>v.id===id?updated:v);
   close();updateUi();status('✅ Исправления сохранены в облаке. Версия №'+updated.revisionNo);
  }catch(err){error.textContent=String(err.message||err)}
  finally{save.disabled=false;save.textContent='💾 Сохранить изменения'}
 });
 panel.append(form);
}
async function openEvents(id){
 const r=getRecord(id);if(!r||!currentOwner(r))return status('Нет доступа к истории изменений');
 const {panel,close}=overlay('История изменений');
 previewMeta(panel,r);subtitle(panel,'Все правки хранят исходные значения. Каждая операция содержит время и номер версии.');
 panel.append(el('p','rev067-sub','Загрузка…'));
 try{
  const list=await rest('revision_audit_events',{query:'?audit_id=eq.'+encodeURIComponent(r.id)+
   '&select=operation,revision_no,changed_at,actor_id,before_record,after_record&order=changed_at.desc&limit=150'});
  panel.querySelector('p.rev067-sub:last-of-type')?.remove();
  if(!Array.isArray(list)||list.length===0){panel.append(el('div','rev067-meta','Изменений пока нет. Это исходная запись.'));return}
  const verbs={edit:'✏️ Исправление',trash:'🗑 В корзину',restore:'♻ Восстановление'};
  for(const log of list){
   const block=el('article','rev067-event');
   block.append(el('strong','',(verbs[log.operation]||log.operation)+' · версия '+log.revision_no));
   const time=new Date(log.changed_at).toLocaleString('ru-RU');
   block.append(el('small','',time+' · аккаунт: '+(log.actor_id?'авторизованный владелец':'администратор сервера')));
   const ds=el('details'),summary=el('summary','','Было / стало');
   ds.append(summary);
   const before=log.before_record||{},after=log.after_record||{};
   const content=el('pre','',
    'БЫЛО: '+JSON.stringify({дата:before.audit_date,сотрудник:before.operator_name,продукты:before.items},null,2)+
    '\n\nСТАЛО: '+JSON.stringify({дата:after.audit_date,сотрудник:after.operator_name,продукты:after.items},null,2));
   ds.append(content);block.append(ds);panel.append(block);
  }
 }catch(error){fail(panel,error)}
}
function restoreAllConfirm(records){
 const owned=records.filter(raw=>raw.owner_id===owner()&&raw.deleted_at&&
   Date.now()-Date.parse(raw.deleted_at)<30*86400000);
 if(!owned.length)return status('В корзине нет доступных для восстановления ревизий');
 const {panel,close}=overlay('Восстановить '+owned.length+' ревизий?');
 subtitle(panel,'Все выбранные ревизии вернутся в историю и появятся в отчётах. Уже выполненные действия не будут повторяться.');
 panel.append(el('div','rev067-warning','Подтверди массовое восстановление. Данные продуктов и цены не будут изменены.'));
 const confirmation=field('Напиши ВОССТАНОВИТЬ','text','');
 panel.append(confirmation.label);
 const error=el('div','rev067-error');panel.append(error);
 const buttons=el('div','rev067-form-actions'),cancel=btn('Отмена',close);
 const submit=btn('♻ Восстановить все',async()=>{
  error.textContent='';
  if(confirmation.input.value.trim()!=='ВОССТАНОВИТЬ'){
   error.textContent='Для подтверждения напиши ВОССТАНОВИТЬ';return
  }
  submit.disabled=true;cancel.disabled=true;
  let completed=0,failed=0;
  for(const raw of owned){
   try{
    const result=await rest('revision_audits',{
      method:'PATCH',
      query:'?id=eq.'+encodeURIComponent(raw.id)+'&revision_no=eq.'+
          encodeURIComponent(raw.revision_no)+'&select=*',
      body:{deleted_at:null}
    });
    if(!Array.isArray(result)||result.length!==1||result[0].id!==raw.id||result[0].deleted_at)
       throw Error('Сервер не подтвердил восстановление');
    const updated=storeRecord(result[0]);
    state.history=state.history.filter(x=>x.id!==raw.id).concat([updated]);
    completed++;
   }catch(e){failed++;console.warn('Could not restore audit',raw.id,e)}
  }
  if(completed)updateUi();
  close();
  status('Восстановлено '+completed+' ревизий'+(failed?'; требует проверки: '+failed:''));
  void trashList();
 },'main');
 buttons.append(cancel,submit);panel.append(buttons);
}

async function trashList(){
 if(!owner()||!adminVerified){status('Для корзины нужен доступ администратора');return}
 const {panel}=overlay('Корзина ревизий');
 subtitle(panel,'Ревизии скрыты из отчётов. Восстановление доступно 30 дней, после этого можно удалить запись навсегда.');
 const loading=el('p','rev067-sub','Загружаю корзину…');panel.append(loading);
 try{
  const list=await rest('revision_audits',{query:'?deleted_at=not.is.null&select=*&order=deleted_at.desc&limit=100'});
  loading.remove();
  if(!Array.isArray(list)||list.length===0){panel.append(el('div','rev067-meta','Корзина пуста.'));return}
  const accessible=list.filter(raw=>raw.owner_id===owner()&&raw.deleted_at&&Date.now()-Date.parse(raw.deleted_at)<30*86400000);
  if(accessible.length>1){
    const area=el('div','rev067-buttons');area.append(btn('♻ Восстановить все ('+accessible.length+')',()=>restoreAllConfirm(accessible),'main'));panel.append(area);
  }
  for(const raw of list){
   if(raw.owner_id!==owner())continue;
   const r=storeRecord(raw),block=el('article','rev067-binitem');
   const until=Date.parse(raw.deleted_at)+30*86400000;
   const eligible=Date.now()<=until;
   block.append(el('strong','',recordMeta(r)));
   block.append(el('small','',(eligible?'Можно восстановить до ':'Восстановление закончилось: ')+new Date(until).toLocaleDateString('ru-RU')));
   const buttons=el('div','rev067-buttons');
   if(eligible)buttons.append(btn('♻ Восстановить',async()=>{
    const b=buttons.firstChild;b.disabled=true;
    try{
     const update=await rest('revision_audits',{method:'PATCH',query:'?id=eq.'+encodeURIComponent(r.id)+
       '&revision_no=eq.'+encodeURIComponent(r.revisionNo)+'&select=*',body:{deleted_at:null}});
     if(!Array.isArray(update)||update.length!==1||update[0].id!==r.id||update[0].deleted_at)
      throw Error('Сервер не подтвердил восстановление');
     state.history=state.history.filter(x=>x.id!==r.id).concat([storeRecord(update[0])]);
     updateUi();status('✅ Ревизия восстановлена');
     void trashList();
    }catch(err){fail(panel,err)}finally{b.disabled=false}
   },'main'));
   else buttons.append(btn('🗑 Удалить навсегда',()=>purgeConfirm(r),'rev067-danger'));
   block.append(buttons);panel.append(block);
  }
 }catch(error){loading.remove();fail(panel,error)}
}
function purgeConfirm(r){
 const {panel,close}=overlay('Удалить навсегда?');
 panel.append(el('div','rev067-warning','Это необратимое действие! Ревизия и её журнал изменений будут удалены из облака. Доступно только после 30 дней в корзине.'));
 previewMeta(panel,r);
 const confirm=field('Для подтверждения напиши УДАЛИТЬ','text','');
 panel.append(confirm.label);
 const error=el('div','rev067-error');panel.append(error);
 const buttons=el('div','rev067-form-actions');buttons.append(btn('Отмена',close));
 buttons.append(btn('Удалить навсегда',async()=>{
  if(confirm.input.value.trim()!=='УДАЛИТЬ'){error.textContent='Напиши УДАЛИТЬ заглавными буквами';return}
  const b=buttons.lastChild;b.disabled=true;
  try{
   const result=await rest('revision_audits',{method:'DELETE',query:'?id=eq.'+encodeURIComponent(r.id)+
     '&deleted_at=lt.'+encodeURIComponent(new Date(Date.now()-30*86400000).toISOString())+'&select=*'});
   if(!Array.isArray(result)||result.length!==1||result[0].id!==r.id)
    throw Error('Удаление не подтверждено — возможно, 30 дней ещё не прошло');
   close();updateUi();status('Ревизия окончательно удалена');void trashList();
  }catch(e){error.textContent=String(e.message||e)}finally{b.disabled=false}
 },'rev067-danger'));panel.append(buttons);
}
function enhanceHistory(){
 checkAdminRole();
 const host=$('allhistory');if(!host)return;
 const archives=[...host.querySelectorAll('.rev053-history-card')];
 const records=typeof inStore==='function'?inStore():[];
 archives.forEach((card,i)=>{
  const r=records[i];
  if(!r?.id)return;
  card.dataset.rev067Id=r.id;
  card.querySelector('.rev067-history-actions')?.remove();
  if(!currentOwner(r))return;
  const foot=el('div','rev067-history-actions');
  const button=btn('⋯ Управление',()=>openMenu(r.id));
  button.setAttribute('aria-label','Управление ревизией '+r.store+' '+r.date);
  foot.append(button);card.append(foot);
 });
 const history=$('view-history');
 if(history&&!$('rev067TrashBar')){
  const bar=el('div');bar.id='rev067TrashBar';const button=btn('♻ Корзина',trashList);
  button.id='rev067TrashButton';bar.append(button);
  const section=history.querySelector('.sectionheading');
  if(section)section.after(bar);else history.prepend(bar);
 }
 if($('rev067TrashBar'))$('rev067TrashBar').hidden=!adminVerified;
}
function install(){
 if(typeof renderHistory!=='function')return;
 const prior=renderHistory;
 renderHistory=function(){
  const res=prior.apply(this,arguments);
  enhanceHistory();
  return res;
 };
 enhanceHistory();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();