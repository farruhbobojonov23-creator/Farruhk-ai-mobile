// Owner workspace for staff accounts and kitchen point reporting.
// Only server endpoints guarded by FARUKH AI owner session can change accounts.
const el=(tag,cls,txt)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(txt!==undefined)node.textContent=txt;return node
};
const button=(label,run,cls='pstaff-button')=>{
 const node=el('button',cls,label);node.type='button';node.addEventListener('click',run);return node
};
const API='/api/farukh-print/admin/staff';
async function fetchStaff(path='',opts={}){
 const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...opts});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(data.error||'Нет соединения с управляющим центром.'),{status:r.status});
 return data
}
const send=(path,method,payload={})=>fetchStaff(path,{method,body:JSON.stringify(payload)});
const pointEqual=(a,b)=>String(a).toLocaleLowerCase('ru')===String(b).toLocaleLowerCase('ru');
const opt=(v,label=v)=>{const o=el('option','',label);o.value=v;return o};
const fillOptions=(select,points,{all=false,value=''}={})=>{
 select.replaceChildren();
 if(all)select.append(opt('','Все точки'));
 for(const point of points)select.append(opt(point));
 if([...select.options].some(o=>o.value===value))select.value=value;
 else if(all)select.value='';
 else select.selectedIndex=0;
};
const accessPicker=(label='Срок доступа',value='30')=>{
 const wrap=el('div','pstaff-access-picker');
 const field=el('label','pstaff-field');field.append(el('span','',label));
 const select=el('select','pstaff-select');select.setAttribute('aria-label',label);
 for(const [v,t] of [['1','1 день'],['7','7 дней'],['30','30 дней'],['90','90 дней'],['180','180 дней'],['365','1 год'],['custom','Своё количество дней'],['unlimited','Без ограничения']])select.append(opt(v,t));
 select.value=value;
 const custom=el('input','pstaff-password-input');custom.type='number';custom.min='1';custom.max='3650';custom.step='1';custom.value='30';custom.placeholder='От 1 до 3650 дней';custom.setAttribute('aria-label','Количество дней доступа');
 const change=()=>{custom.hidden=select.value!=='custom'};select.addEventListener('change',change);change();
 const hint=el('small','pstaff-access-hint','Автоматическое отключение в установленный срок. Старые сотрудники без срока сохраняют прежний доступ.');
 field.append(select);wrap.append(field,custom,hint);
 const days=()=>{const val=select.value==='unlimited'?null:select.value==='custom'?Number(custom.value):Number(select.value);
  if(val!==null&&(!Number.isInteger(val)||val<1||val>3650))throw Error('Укажи срок от 1 до 3650 дней.');
  return val;};
 return {wrap,days,select};
};
const smallTime=at=>{
 if(!at)return '—';
 const d=new Date(at);
 return Number.isFinite(d.getTime())?d.toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
};
export function mountPrintStaffControl({root}){
 const panel=el('section','pstaff pstaff-workspace');
 const header=el('div','pstaff-header');
 header.append(el('h2','','Управление сотрудниками'),el('span','pstaff-role','ВЛАДЕЛЕЦ · 4 ТОЧКИ'));
 const summary=el('p','pstaff-info','Выбирай точку, находи поваров, меняй их данные и смотри запросы печати. Сотрудникам доступна только печать утверждённых этикеток.');
 const notification=el('p','pstaff-message');
 notification.setAttribute('role','status');
 const metrics=el('div','pstaff-metrics');
 const metric=(label)=>{const node=el('div','pstaff-metric');const value=el('strong','','—');node.append(el('small','',label),value);metrics.append(node);return value};
 const nStaff=metric('Сотрудников на выбранных точках');
 const nActive=metric('Активных сотрудников');
 const nRequests=metric('Запросов печати за период');
 const nLabels=metric('Наклеек в запросах');
 const filters=el('div','pstaff-toolbar');
 const pointFilter=el('select','pstaff-select');pointFilter.setAttribute('aria-label','Выбор точки');
 const search=el('input','pstaff-search');search.type='search';search.placeholder='Поиск сотрудника по имени или логину';search.setAttribute('aria-label','Поиск сотрудников');search.maxLength=100;
 const period=el('select','pstaff-select');period.setAttribute('aria-label','Период отчёта');
 for(const [v,label] of [['shift','С момента входа'],['today','Сегодня'],['7','7 дней'],['30','30 дней'],['month','Этот месяц'],['90','90 дней'],['all','Всё время']])period.append(opt(v,label));
 period.value='30';
 const reload=button('↻ Обновить',()=>reloadAll(),'pstaff-button');
 filters.append(pointFilter,period,reload);
 const managePoints=el('details','pstaff-points');
 const pointsHeading=el('summary','','Настроить названия точек');
 const pointsInfo=el('p','','Добавь остальные точки самостоятельно. «Плазма» уже указана. Переименование переведёт сотрудников на новое название и завершит их текущие сеансы.');
 const pointForm=el('form','pstaff-point-form');
 const newPoint=el('input');newPoint.placeholder='Название новой точки';newPoint.maxLength=60;newPoint.required=true;newPoint.setAttribute('aria-label','Новая точка');
 const addPoint=el('button','pstaff-create','＋ Добавить точку');addPoint.type='submit';
 pointForm.append(newPoint,addPoint);
 const pointRows=el('div','pstaff-point-rows');
 managePoints.append(pointsHeading,pointsInfo,pointForm,pointRows);
 const createHeading=el('h3','','Добавить сотрудника');
 const createForm=el('form','pstaff-form');
 const field=(label,placeholder)=>{
  const wrap=el('label','pstaff-field'),input=el('input');
  input.type='text';input.placeholder=placeholder;input.required=true;
  wrap.append(el('span','',label),input);return {wrap,input}
 };
 const name=field('Имя','Например, Гуля');
 const login=field('Логин латиницей','Например, gulya01');
 login.input.pattern='[a-z][a-z0-9_-]{2,31}';login.input.maxLength=32;name.input.maxLength=65;
 const pointLabel=el('label','pstaff-field');pointLabel.append(el('span','','Назначить точку'));
 const staffPoint=el('select','pstaff-select');staffPoint.required=true;staffPoint.setAttribute('aria-label','Точка нового сотрудника');pointLabel.append(staffPoint);
 const addStaff=el('button','pstaff-create','＋ Создать доступ');addStaff.type='submit';
 const createAccess=accessPicker('Доступ на срок','30');
 const createPassword=el('input','pstaff-password-input');
 createPassword.type='password';createPassword.autocomplete='new-password';
 createPassword.placeholder='Придумай пароль (от 8 символов)';
 createPassword.minLength=8;createPassword.maxLength=128;
 const createConfirm=el('input','pstaff-password-input');
 createConfirm.type='password';createConfirm.autocomplete='new-password';
 createConfirm.placeholder='Повтори пароль';
 createConfirm.maxLength=128;
 const passwordGroup=el('div','pstaff-password-group');
 const pwField=el('label','pstaff-field');pwField.append(el('span','','Пароль сотрудника'),createPassword);
 const confirmField=el('label','pstaff-field');confirmField.append(el('span','','Подтверждение пароля'),createConfirm);
 const pwHint=el('p','pstaff-password-hint','Придумай пароль самостоятельно — от 8 символов. Если оба поля пустые, пароль будет создан автоматически.');
 const viewPw=button('Показать пароль',()=>{
  const show=createPassword.type==='password';createPassword.type=show?'text':'password';createConfirm.type=show?'text':'password';
  viewPw.textContent=show?'Скрыть пароль':'Показать пароль'
 },'pstaff-password-toggle');
 passwordGroup.append(pwField,confirmField,viewPw,pwHint);
 createForm.append(name.wrap,login.wrap,pointLabel,createAccess.wrap,passwordGroup,addStaff);
 const secret=el('div','pstaff-new-key');secret.hidden=true;
 secret.append(el('strong','','Пароль показан только один раз — сохрани и передай сотруднику лично.'));
 const creds=el('div','pstaff-secret');secret.append(creds,button('Пароль сохранён · закрыть',()=>{secret.hidden=true;creds.replaceChildren()}));
 const rosterHead=el('h3','','Сотрудники');
 const staffList=el('div','pstaff-list');
 const reportHead=el('div','pstaff-report-head');reportHead.append(el('h3','','Отчёт по точкам'));
 const reportNote=el('p','pstaff-report-note','Запросы, отправки и ошибки ведутся отдельно. Отправка данных принтеру не означает физическую печать. «С момента входа» — статистика текущих активных сеансов.');
 const reportGrid=el('div','pstaff-report-grid');
 const workerReportHeading=el('h3','','Статистика сотрудников');
 const workerReport=el('div','pstaff-worker-report');
 const topProductsHeading=el('h3','','Популярные товары по запросам');
 const topProducts=el('div','pstaff-products');
 const topProductsHint=el('p','pstaff-report-note','Количество запросов и отправок не означает подтверждённую физическую печать.');
 const alertsHeading=el('h3','','Уведомления владельцу');
 const alertsHelp=el('p','pstaff-report-note','Здесь показываются ошибки отправки на принтер и устройства без связи более 20 минут. Это сообщения внутри FARUKH AI, не push-уведомления.');
 const alertCount=el('span','pstaff-alert-count','Нет новых ошибок');
 const alerts=el('div','pstaff-alerts');
 const activityTitle=el('h3','','История печати · фильтры');
 const activityFilters=el('div','pstaff-history-filters');
 const staffFilter=el('input','pstaff-search');staffFilter.type='search';staffFilter.maxLength=32;staffFilter.placeholder='Логин сотрудника';staffFilter.setAttribute('aria-label','История: логин сотрудника');
 const productFilter=el('input','pstaff-search');productFilter.type='search';productFilter.maxLength=90;productFilter.placeholder='Название товара';productFilter.setAttribute('aria-label','История: поиск товара');
 const startDate=el('input');startDate.type='date';startDate.setAttribute('aria-label','Начало периода истории');
 const endDate=el('input');endDate.type='date';endDate.setAttribute('aria-label','Конец периода истории');
 const statusFilter=el('select','pstaff-select');statusFilter.setAttribute('aria-label','Результат печати');
 for(const [v,label] of [['','Все результаты'],['sent','Передано принтеру'],['failed','Ошибка'],['system','Диалог печати'],['pending','Ожидает результата']])statusFilter.append(opt(v,label));
 const historyCount=el('p','pstaff-report-note');
 const exportCsv=button('⇩ Скачать историю CSV',()=>void downloadHistory(),'pstaff-button pstaff-export');
 activityFilters.append(staffFilter,productFilter,startDate,endDate,statusFilter,exportCsv);
 const activity=el('div','pstaff-activity');
 const tabNav=el('nav','pstaff-tabbar');tabNav.setAttribute('aria-label','Разделы сотрудников');
 const overviewPanel=el('section','pstaff-tab-panel');const teamPanel=el('section','pstaff-tab-panel');
 const historyPanel=el('section','pstaff-tab-panel');const pointsPanel=el('section','pstaff-tab-panel');
 const staffPages=[['overview','Обзор',overviewPanel],['team','Команда',teamPanel],['history','История',historyPanel],['points','Точки',pointsPanel]];
 const tabs=[];
 for(const [key,label] of staffPages){
  const t=button(label,()=>selectTab(key),'pstaff-tab');t.dataset.tab=key;tabNav.append(t);tabs.push(t);
 }
 function selectTab(key){
  for(const [name,,section] of staffPages)section.hidden=key!==name;
  for(const tab of tabs){const chosen=tab.dataset.tab===key;tab.classList.toggle('active',chosen);tab.setAttribute('aria-selected',String(chosen))}
 }
 const workerDetails=el('details','pstaff-worker-details');workerDetails.append(el('summary','','Статистика сотрудников по отдельности'),workerReport);
 const createDetails=el('details','pstaff-create-details');createDetails.append(el('summary','','＋ Добавить сотрудника'),createForm);
 overviewPanel.append(metrics,reportHead,reportNote,reportGrid,workerDetails,topProductsHeading,topProducts,topProductsHint,alertsHeading,alertsHelp,alertCount,alerts);
 teamPanel.append(search,createDetails,secret,rosterHead,staffList);
 historyPanel.append(activityTitle,activityFilters,historyCount,activity);
 pointsPanel.append(managePoints);
 panel.append(header,summary,notification,filters,tabNav,overviewPanel,teamPanel,historyPanel,pointsPanel);
 selectTab('overview');
 root.insertBefore(panel,root.querySelector('.pc-toolbar')||null);

 let points=[],users=[],report=null,events=[],alertRows=[],historyTotal=0,authorized=false,busy=false,historyTimer=null;
 const notify=(message,error=false)=>{notification.textContent=message;notification.dataset.error=error?'yes':'no'};
 const disabled=on=>{busy=on;addPoint.disabled=on;addStaff.disabled=on;reload.disabled=on};
 const selection=()=>pointFilter.value;
 function customPasswordValid(pass,confirmPassword){
  if(!pass&&!confirmPassword)return true;
  if(pass.length<8||pass.length>128){notify('Пароль должен содержать от 8 до 128 символов.',true);return false}
  if(pass!==confirmPassword){notify('Пароли не совпадают. Повтори ввод.',true);return false}
  return true;
 }
 function secretShow(data){
  creds.replaceChildren();
  const named=el('div');named.append(el('small','','Логин'),el('strong','',data.staff.login));
  creds.append(named);
  if(typeof data.password==='string'){
   const pass=el('div');pass.append(el('small','','Пароль — показать один раз'),el('strong','',data.password));creds.append(pass);
  }
  secret.hidden=false;
 }
 function renderPointRows(){
  pointRows.replaceChildren();
  for(const point of points){
   const row=el('div','pstaff-point-row');row.append(el('strong','',point));
   const actions=el('div','pstaff-controls');
   actions.append(button('Переименовать',async()=>{
    const name=prompt('Новое название точки «'+point+'»:',point);
    if(name===null||name.trim()===point)return;
    if(!name.trim())return notify('Название точки не может быть пустым.',true);
    if(!confirm('Переименовать «'+point+'» в «'+name.trim()+'»? Все сотрудники точки получат новое назначение, их сеансы будут завершены. Исторические запросы останутся под прежним названием.'))return;
    await mutate('/points','PATCH',{oldName:point,name:name.trim()},()=>{
     if(pointEqual(selection(),point))pointFilter.dataset.nextValue=name.trim();
    });
   }));
   actions.append(button('Удалить',async()=>{
    if(!confirm('Удалить точку «'+point+'»? Это разрешено, только когда за ней нет сотрудников.'))return;
    await mutate('/points','DELETE',{name:point},()=>{
     if(pointEqual(selection(),point))pointFilter.dataset.nextValue='';
    });
   }));
   row.append(actions);pointRows.append(row);
  }
 }
 function renderStaff(){
  staffList.replaceChildren();
  const phrase=search.value.trim().toLocaleLowerCase('ru'),chosen=selection();
  const visible=users.filter(u=>(!chosen||pointEqual(u.point,chosen))&&
   (!phrase||(u.name+' '+u.login+' '+u.point).toLocaleLowerCase('ru').includes(phrase)))
   .sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name,'ru'));
  if(!visible.length){
   staffList.append(el('p','pstaff-empty',users.length?'По этому фильтру сотрудники не найдены.':'Сотрудников ещё нет. Создай доступ выше.'));return;
  }
  for(const user of visible){
   const card=el('div','pstaff-item');
   const identity=el('div','pstaff-identity');
   identity.append(el('strong','',user.name),el('small','',user.login+' · '+user.point));
   const expired=user.expired===true;
   const currentlyAllowed=user.active&&!expired;
   identity.append(el('span','pstaff-status '+(currentlyAllowed?'pstaff-status-on':'pstaff-status-off'),
    !user.active?'○ Доступ отключён':expired?'○ Срок истёк':'● Доступ открыт'));
   const timeLabel=user.expiresAt?'Доступ до: '+smallTime(user.expiresAt)+' (Москва)':'Доступ без ограничения';
   identity.append(el('small','pstaff-access-date',timeLabel));
   const controls=el('div','pstaff-controls');
   const editBox=el('form','pstaff-inline-edit');editBox.hidden=true;
   const editName=el('input');editName.value=user.name;editName.maxLength=65;editName.required=true;editName.setAttribute('aria-label','Имя сотрудника');
   const editLogin=el('input');editLogin.value=user.login;editLogin.maxLength=32;editLogin.pattern='[a-z][a-z0-9_-]{2,31}';editLogin.required=true;editLogin.setAttribute('aria-label','Логин сотрудника');
   const editPoint=el('select','pstaff-select');editPoint.setAttribute('aria-label','Изменить точку сотрудника');fillOptions(editPoint,[...new Set([...points,user.point])],{value:user.point});
   const saveBtn=el('button','pstaff-create','Сохранить');saveBtn.type='submit';
   const cancel=button('Отмена',()=>{editBox.hidden=true});
   editBox.append(editName,editLogin,editPoint,saveBtn,cancel);
   editBox.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!confirm('Изменить данные «'+user.name+'»? Активный сеанс сотрудника будет завершён.'))return;
    await mutate('/'+encodeURIComponent(user.id),'PATCH',{name:editName.value.trim(),login:editLogin.value.trim().toLowerCase(),point:editPoint.value});
   });
   const editBtn=button('Изменить',()=>{editBox.hidden=!editBox.hidden;});
   const resetBox=el('form','pstaff-reset-box');resetBox.hidden=true;
   const resetLabel=el('strong','','Установить пароль для «'+user.name+'»');
   const resetPw=el('input','pstaff-password-input');resetPw.type='password';resetPw.autocomplete='new-password';
   resetPw.placeholder='Новый пароль · от 8 символов';resetPw.maxLength=128;resetPw.minLength=8;
   const resetConfirm=el('input','pstaff-password-input');resetConfirm.type='password';resetConfirm.autocomplete='new-password';
   resetConfirm.placeholder='Повтори новый пароль';resetConfirm.maxLength=128;
   const resetButtons=el('div','pstaff-reset-actions');
   const resetSave=el('button','pstaff-create','Установить мой пароль');resetSave.type='submit';
   const resetAuto=button('Сгенерировать автоматически',async()=>{
    if(!confirm('Создать новый случайный пароль для «'+user.name+'»? Старый пароль перестанет работать.'))return;
    disabled(true);
    try{
     const data=await send('/'+encodeURIComponent(user.id)+'/reset','POST');
     resetBox.hidden=true;secretShow(data);await reloadAll();notify('Случайный пароль создан. Сохрани его сейчас.');
    }catch(e){notify(e.message,true)}finally{disabled(false)}
   });
   const resetCancel=button('Отмена',()=>{resetBox.hidden=true;resetPw.value='';resetConfirm.value=''});
   resetButtons.append(resetSave,resetAuto,resetCancel);
   resetBox.append(resetLabel,resetPw,resetConfirm,resetButtons);
   resetBox.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!customPasswordValid(resetPw.value,resetConfirm.value)||!resetPw.value){
     if(!resetPw.value)notify('Введите свой пароль или нажми «Сгенерировать автоматически».',true);
     return;
    }
    if(!confirm('Заменить пароль «'+user.name+'»? Его текущие сеансы завершатся.'))return;
    disabled(true);
    try{
     await send('/'+encodeURIComponent(user.id)+'/reset','POST',{password:resetPw.value});
     resetPw.value='';resetConfirm.value='';resetBox.hidden=true;secret.hidden=true;
     await reloadAll();notify('Твой новый пароль установлен для «'+user.name+'».');
    }catch(e){notify(e.message,true)}finally{disabled(false)}
   });
   const reset=button('Пароль',()=>{resetBox.hidden=!resetBox.hidden});
   const accessBox=el('form','pstaff-access-box');accessBox.hidden=true;
   const accessTitle=el('strong','','Установить новый срок для «'+user.name+'»');
   const periodPicker=accessPicker('Новый срок доступа',user.expiresAt?'30':'unlimited');
   const accessButtons=el('div','pstaff-reset-actions');
   const saveAccess=el('button','pstaff-create','Сохранить срок');saveAccess.type='submit';
   accessButtons.append(saveAccess,button('Отмена',()=>{accessBox.hidden=true}));
   accessBox.append(accessTitle,periodPicker.wrap,accessButtons);
   accessBox.addEventListener('submit',async e=>{
    e.preventDefault();
    let days;try{days=periodPicker.days()}catch(err){notify(err.message,true);return}
    if(!confirm((days===null?'Убрать ограничение срока доступа':'Выдать новый доступ на '+days+' дн.')+' для «'+user.name+'»? Активный сеанс будет завершён.'))return;
    await mutate('/'+encodeURIComponent(user.id)+'/access','POST',{accessDays:days});
   });
   const setAccess=button(expired?'Продлить':'Срок',()=>{accessBox.hidden=!accessBox.hidden;});
   const toggle=button(user.active?'Отключить':'Включить',async()=>{
    if(!confirm((user.active?'Отключить':'Включить')+' доступ «'+user.name+'»?'))return;
    await mutate('/'+encodeURIComponent(user.id)+'/status','POST',{active:!user.active});
   });
   controls.append(editBtn,setAccess,reset,toggle);
   card.append(identity,controls,editBox,accessBox,resetBox);staffList.append(card);
  }
 }
 function renderReport(){
  reportGrid.replaceChildren();workerReport.replaceChildren();topProducts.replaceChildren();
  nStaff.textContent=report?.summary?.staff??'—';
  nActive.textContent=report?.summary?.active??'—';
  nRequests.textContent=report?.summary?.requests??'—';
  nLabels.textContent=report?.summary?.labels??'—';
  const rows=report?.rows||[];
  const maxRequests=Math.max(1,...rows.map(item=>Number(item.requests)||0));
  if(!rows.length)reportGrid.append(el('p','pstaff-empty','Нет данных за выбранный период.'));
  for(const row of rows){
   const card=el('div','pstaff-report-card');card.append(el('strong','',row.point));
   const counters=el('div','pstaff-report-values');
   for(const [value,label] of [[row.active+' / '+row.staff,'сотрудников активно'],[row.requests,'запросов'],[row.labels,'наклеек запрошено'],[row.transmitted||0,'передано принтеру'],[row.failed||0,'ошибок']]){
    const item=el('div');item.append(el('strong','',String(value)),el('small','',label));counters.append(item)
   }
   const chart=el('div','pstaff-mini-chart');const chartLabel=el('span','','Активность · '+(Number(row.requests)||0)+' запросов');
   const track=el('div','pstaff-mini-track');const bar=el('span','pstaff-mini-bar');
   bar.style.width=Math.min(100,Math.max(0,(Number(row.requests)||0)/maxRequests*100))+'%';
   track.setAttribute('role','img');track.setAttribute('aria-label',String(row.requests||0)+' запросов из максимальных '+maxRequests+' среди точек');
   track.append(bar);chart.append(chartLabel,track);
   card.append(counters,chart,el('small','','Последний запрос: '+smallTime(row.lastRequestAt)));reportGrid.append(card);
   for(const user of row.users||[]){
    const line=el('div','pstaff-worker-row');
    const who=el('div');who.append(el('strong','',user.name),el('small','',user.login+' · '+row.point));
    const numbers=el('span','','Запросы: '+user.requests+' · Этикетки: '+user.labels+' · Передано: '+user.transmitted+' · Ошибки: '+user.failed);
    line.append(who,numbers);workerReport.append(line);
   }
  }
  if(!workerReport.children.length)workerReport.append(el('p','pstaff-empty','Сотрудники не найдены.'));
  for(const [index,product] of (report?.topProducts||[]).entries()){
   const row=el('div','pstaff-product-row');
   row.append(el('b','','#'+(index+1)),el('strong','',product.name),
    el('span','',product.requests+' запросов · '+product.requestedLabels+' этикеток запрошено · '+product.transmittedJobs+' передано · '+product.failedJobs+' ошибок'));
   topProducts.append(row);
  }
  if(!topProducts.children.length)topProducts.append(el('p','pstaff-empty','За выбранный период запросов нет.'));
  reportNote.textContent=report?.note||reportNote.textContent;
 }
 function renderAlerts(){
  alerts.replaceChildren();const chosen=selection();
  const visible=alertRows.filter(e=>!chosen||!e.point||pointEqual(e.point,chosen));
  alertCount.textContent=visible.length?'Требуют внимания: '+visible.length:'Ошибок и длительных отключений не обнаружено';
  alertCount.dataset.active=visible.length?'yes':'no';
  if(!visible.length){alerts.append(el('p','pstaff-empty','Уведомлений пока нет.'));return}
  for(const row of visible.slice(0,20)){
   const box=el('div','pstaff-alert-item');
   box.append(el('strong','',row.type==='offline'?'Нет связи с устройством':'Ошибка отправки на принтер'));
   box.append(el('small','',(row.device||'')+(row.point?' · '+row.point:'')+' · '+smallTime(row.at)));
   box.append(el('span','',row.message||'Нет сведений'));
   alerts.append(box);
  }
 }
 function renderActivity(){
  activity.replaceChildren();
  historyCount.textContent='Найдено записей: '+historyTotal+' · показаны последние '+events.length+' (не более 300).';
  if(!events.length)activity.append(el('p','pstaff-empty','За этот период запросов печати нет.'));
  const label=e=>({sent:'Передано на принтер',failed:'Ошибка отправки',system:'Системный диалог',pending:'Ожидает результата'})[e.result||'pending']||'Запрос';
  for(const event of events){
   const item=el('div','pstaff-event');
   item.append(el('strong','',(event.staff||'Сотрудник')+' · '+(event.product||'Этикетка')));
   item.append(el('small','',(event.point||'')+' · '+smallTime(event.at)+' · '+event.copies+' шт. · '+label(event)));
   if(event.details)item.append(el('small','',event.details));
   activity.append(item);
  }
 }
 async function reportLoad(){
  const params=new URLSearchParams({days:period.value});
  if(selection())params.set('point',selection());
  report=await fetchStaff('/report?'+params.toString());
  renderReport();
 }
 function historyParams(){
  const params=new URLSearchParams();
  if(selection())params.set('point',selection());
  if(staffFilter.value.trim())params.set('login',staffFilter.value.trim().toLowerCase());
  if(productFilter.value.trim())params.set('product',productFilter.value.trim());
  if(startDate.value)params.set('from',startDate.value);
  if(endDate.value)params.set('to',endDate.value);
  if(statusFilter.value)params.set('result',statusFilter.value);
  return params;
 }
 async function historyLoad(){
  const params=historyParams();params.set('limit','300');
  const r=await fetchStaff('/activity?'+params);
  events=r.events||[];historyTotal=r.total??events.length;renderActivity();
 }
 async function downloadHistory(){
  if(busy)return;
  exportCsv.disabled=true;
  try{
   const response=await fetch(API+'/activity-export?'+historyParams(),{credentials:'same-origin',cache:'no-store'});
   if(!response.ok){
    const error=await response.json().catch(()=>({}));
    throw Error(error.error||'Не удалось скачать историю.');
   }
   const blob=await response.blob();
   if(blob.size>8*1024*1024)throw Error('Файл слишком большой для загрузки.');
   const url=URL.createObjectURL(blob);
   const link=el('a');link.href=url;link.download='FARUKH-PRINT-история-'+new Date().toISOString().slice(0,10)+'.csv';
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
   notify('История по выбранным фильтрам выгружена в CSV.');
  }catch(e){notify('Экспорт не выполнен: '+e.message,true)}
  finally{exportCsv.disabled=false}
 }
 async function alertsLoad(){
  const r=await fetchStaff('/alerts');alertRows=r.alerts||[];renderAlerts();
 }
 async function reloadMetrics(){
  await Promise.all([reportLoad(),historyLoad(),alertsLoad()]);
 }
 async function reloadAll(){
  if(busy)return;
  disabled(true);
  try{
   const [p,u]=await Promise.all([fetchStaff('/points'),fetchStaff('')]);
   points=p.points;users=u.staff;authorized=true;
   const prior=pointFilter.dataset.nextValue!==undefined?pointFilter.dataset.nextValue:selection();
   delete pointFilter.dataset.nextValue;
   fillOptions(pointFilter,points,{all:true,value:prior});
   fillOptions(staffPoint,points,{value:staffPoint.value});
   renderPointRows();renderStaff();
   await reloadMetrics();
   notify('Готово. Сотрудников: '+users.length+'; точек настроено: '+points.length+'.');
  }catch(e){
   if(e.status===401)notify('Войди как владелец в облачном управлении выше.',true);
   else notify('Не удалось обновить данные: '+e.message,true);
  }finally{disabled(false)}
 }
 async function mutate(path,method,body,after){
  if(busy)return;
  disabled(true);
  try{
   const result=await send(path,method,body);
   if(after)after(result);
   disabled(false);await reloadAll();
   notify(result.notice||'Изменения сохранены.');
  }catch(e){notify('Не удалось сохранить: '+e.message,true)}finally{disabled(false)}
 }
 pointForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const value=newPoint.value.trim();if(!value)return;
  await mutate('/points','POST',{name:value},()=>{newPoint.value='';pointFilter.dataset.nextValue=value});
 });
 createForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(busy||!customPasswordValid(createPassword.value,createConfirm.value))return;
  disabled(true);
  try{
   const custom=!!createPassword.value;
   const days=createAccess.days();
   const result=await send('','POST',{
    name:name.input.value.trim(),login:login.input.value.trim().toLowerCase(),point:staffPoint.value,
    accessDays:days,
    ...(custom?{password:createPassword.value}:{})
   });
   name.input.value='';login.input.value='';createPassword.value='';createConfirm.value='';
   if(custom){secret.hidden=true;creds.replaceChildren()}
   else secretShow(result);
   disabled(false);await reloadAll();
   notify((custom?'Доступ создан с заданным паролем.':'Доступ создан. Сохрани автоматически созданный пароль.')+
    (days===null?' Без ограничения срока.':' Срок '+days+' дн., после него вход и печать будут заблокированы.'));
  }catch(e){notify(e.message,true)}finally{disabled(false)}
 });
 pointFilter.addEventListener('change',()=>{
  renderStaff();void reloadMetrics().catch(e=>notify(e.message,true))
 });
 search.addEventListener('input',renderStaff);
 period.addEventListener('change',()=>{void reportLoad().catch(e=>notify(e.message,true))});
 const debounceHistory=()=>{clearTimeout(historyTimer);historyTimer=setTimeout(()=>void historyLoad().catch(e=>notify(e.message,true)),350)};
 staffFilter.addEventListener('input',debounceHistory);
 productFilter.addEventListener('input',debounceHistory);
 for(const field of [startDate,endDate,statusFilter])field.addEventListener('change',debounceHistory);
 window.addEventListener('farukh-print-owner-authenticated',()=>void reloadAll());
 void reloadAll();
 return {refresh:reloadAll};
}
