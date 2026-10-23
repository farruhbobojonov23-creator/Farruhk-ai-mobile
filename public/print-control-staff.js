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
 for(const [v,label] of [['7','7 дней'],['30','30 дней'],['90','90 дней'],['all','Всё время']])period.append(opt(v,label));
 period.value='30';
 const reload=button('↻ Обновить',()=>reloadAll(),'pstaff-button');
 filters.append(pointFilter,search,period,reload);
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
 createForm.append(name.wrap,login.wrap,pointLabel,addStaff);
 const secret=el('div','pstaff-new-key');secret.hidden=true;
 secret.append(el('strong','','Пароль показан только один раз — сохрани и передай сотруднику лично.'));
 const creds=el('div','pstaff-secret');secret.append(creds,button('Пароль сохранён · закрыть',()=>{secret.hidden=true;creds.replaceChildren()}));
 const rosterHead=el('h3','','Сотрудники');
 const staffList=el('div','pstaff-list');
 const reportHead=el('div','pstaff-report-head');reportHead.append(el('h3','','Отчёт по точкам'));
 const reportNote=el('p','pstaff-report-note','Учитываются только запросы на отправку этикетки, а не подтверждённая физическая печать. Журнал ограничен последними 500 запросами.');
 const reportGrid=el('div','pstaff-report-grid');
 const activityTitle=el('h3','','Последние запросы выбранной точки');
 const activity=el('div','pstaff-activity');
 panel.append(header,summary,notification,metrics,filters,managePoints,createHeading,createForm,secret,rosterHead,staffList,reportHead,reportNote,reportGrid,activityTitle,activity);
 root.insertBefore(panel,root.querySelector('.pc-toolbar')||null);

 let points=[],users=[],report=null,events=[],authorized=false,busy=false;
 const notify=(message,error=false)=>{notification.textContent=message;notification.dataset.error=error?'yes':'no'};
 const disabled=on=>{busy=on;addPoint.disabled=on;addStaff.disabled=on;reload.disabled=on};
 const selection=()=>pointFilter.value;
 function secretShow(data){
  creds.replaceChildren();
  const named=el('div');named.append(el('small','','Логин'),el('strong','',data.staff.login));
  const pass=el('div');pass.append(el('small','','Пароль — показать один раз'),el('strong','',data.password));
  creds.append(named,pass);secret.hidden=false;
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
   identity.append(el('span','pstaff-status '+(user.active?'pstaff-status-on':'pstaff-status-off'),user.active?'● Доступ открыт':'○ Доступ отключён'));
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
   const reset=button('Новый пароль',async()=>{
    if(!confirm('Сбросить пароль «'+user.name+'»? Старый пароль перестанет работать, текущий сеанс завершится.'))return;
    disabled(true);
    try{const data=await send('/'+encodeURIComponent(user.id)+'/reset','POST');secretShow(data);await reloadAll();notify('Новый пароль создан. Сохрани его сейчас.')}
    catch(e){notify(e.message,true)}finally{disabled(false)}
   });
   const toggle=button(user.active?'Отключить':'Включить',async()=>{
    if(!confirm((user.active?'Отключить':'Включить')+' доступ «'+user.name+'»?'))return;
    await mutate('/'+encodeURIComponent(user.id)+'/status','POST',{active:!user.active});
   });
   controls.append(editBtn,reset,toggle);
   card.append(identity,controls,editBox);staffList.append(card);
  }
 }
 function renderReport(){
  reportGrid.replaceChildren();const chosen=selection();
  nStaff.textContent=report?.summary?.staff??'—';
  nActive.textContent=report?.summary?.active??'—';
  nRequests.textContent=report?.summary?.requests??'—';
  nLabels.textContent=report?.summary?.labels??'—';
  const rows=report?.rows||[];
  if(!rows.length){reportGrid.append(el('p','pstaff-empty','Нет данных по точкам. Добавь хотя бы одну точку.'))}
  for(const row of rows){
   const card=el('div','pstaff-report-card');
   card.append(el('strong','',row.point));
   const counters=el('div','pstaff-report-values');
   for(const [value,label] of [[row.active+' / '+row.staff,'сотрудников активно'],[row.requests,'запросов печати'],[row.labels,'наклеек в запросах']]){
    const item=el('div');item.append(el('strong','',String(value)),el('small','',label));counters.append(item)
   }
   card.append(counters,el('small','','Последний запрос: '+smallTime(row.lastRequestAt)));reportGrid.append(card);
  }
  activity.replaceChildren();
  const matches=events.filter(ev=>!chosen||pointEqual(ev.point,chosen));
  if(!matches.length)activity.append(el('p','pstaff-empty','Запросов печати пока нет.'));
  for(const event of matches.slice(0,20)){
   const item=el('div','pstaff-event');
   item.append(el('strong','',(event.staff||'Сотрудник')+' · '+(event.product||'Этикетка')));
   item.append(el('small','',(event.point||'')+' · '+smallTime(event.at)+' · '+event.copies+' шт. · Запрос (не факт печати)'));
   activity.append(item);
  }
 }
 async function reportLoad(){
  const params=new URLSearchParams({days:period.value});
  if(selection())params.set('point',selection());
  const [r,h]=await Promise.all([fetchStaff('/report?'+params.toString()),fetchStaff('/activity')]);
  report=r;events=h.events||[];renderReport();
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
   await reportLoad();
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
  e.preventDefault();if(busy)return;disabled(true);
  try{
   const result=await send('','POST',{name:name.input.value.trim(),login:login.input.value.trim().toLowerCase(),point:staffPoint.value});
   secretShow(result);name.input.value='';login.input.value='';
   disabled(false);await reloadAll();notify('Доступ для «'+result.staff.name+'» создан. Сохрани пароль.');
  }catch(e){notify(e.message,true)}finally{disabled(false)}
 });
 pointFilter.addEventListener('change',()=>{renderStaff();void reportLoad().catch(e=>notify(e.message,true))});
 search.addEventListener('input',renderStaff);
 period.addEventListener('change',()=>{void reportLoad().catch(e=>notify(e.message,true))});
 window.addEventListener('farukh-print-owner-authenticated',()=>void reloadAll());
 void reloadAll();
 return {refresh:reloadAll};
}
