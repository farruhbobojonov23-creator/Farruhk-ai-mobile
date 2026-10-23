// Owner-only staff administration in FARUKH AI; passwords generated on
// server, displayed once. No employee receives permission to edit labels.
const section=(tag,cl,txt)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(txt!==undefined)e.textContent=txt;return e};
const action=(txt,fn,cl='pstaff-button')=>{const b=section('button',cl,txt);b.type='button';b.onclick=fn;return b};
async function request(path,opts={}){
 const r=await fetch('/api/farukh-print/admin/staff'+path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...opts});
 const result=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(result.error||'Сервис сотрудников недоступен.'),{status:r.status});
 return result;
}
export function mountPrintStaffControl({root}){
 const box=section('section','pstaff');
 const header=section('div','pstaff-header');
 header.append(section('h2','','Сотрудники FARUKH PRINT'),section('span','pstaff-role','ПОВАР · ТОЛЬКО ПЕЧАТЬ'));
 const info=section('p','pstaff-info','Создай каждому повару свой логин. Назначь точку: сотрудник сможет печатать только подтверждённые этикетки своей точки. Редактирование каталога останется у владельца.');
 const message=section('p','pstaff-message');
 const form=section('form','pstaff-form');
 const field=(label,placeholder)=>{const holder=section('label','pstaff-field'),title=section('span','',label),input=section('input');
  input.type='text';input.placeholder=placeholder;input.maxLength=65;input.required=true;holder.append(title,input);return {holder,input}};
 const name=field('Имя сотрудника','Например, Гуля');
 const login=field('Логин латиницей','Например, gulya01');login.input.maxLength=32;login.input.pattern='[a-z][a-z0-9_-]{2,31}';
 const point=field('Точка','Например, Плазма');point.input.maxLength=60;
 const submit=section('button','pstaff-create','＋ Создать доступ');submit.type='submit';
 form.append(name.holder,login.holder,point.holder,submit);
 const newKey=section('div','pstaff-new-key');newKey.hidden=true;
 const savedTitle=section('strong','','Доступ сотрудника создан · пароль показан один раз');
 const credentials=section('div','pstaff-secret');
 const secretHint=section('p','','Передай логин и пароль сотруднику лично. После закрытия блока пароль больше нельзя получить, только сбросить.');
 newKey.append(savedTitle,credentials,secretHint,action('Я сохранил пароль — закрыть',()=>{newKey.hidden=true;credentials.replaceChildren()}));
 const listTitle=section('h3','','Действующие учётные записи');
 const list=section('div','pstaff-list');
 const activityTitle=section('h3','','Последние запросы печати');
 const activity=section('div','pstaff-activity');
 const reload=action('↻ Обновить список',()=>load());
 box.append(header,info,message,form,newKey,listTitle,reload,list,activityTitle,activity);
 root.append(box);
 let available=false;
 const notify=(text,error=false)=>{message.textContent=text;message.dataset.error=error?'yes':'no'};
 const mask=busy=>{submit.disabled=busy;reload.disabled=busy};
 async function create(e){
  e.preventDefault();mask(true);
  try{
   const data=await request('',{method:'POST',body:JSON.stringify({name:name.input.value.trim(),login:login.input.value.trim().toLowerCase(),point:point.input.value.trim()})});
   name.input.value='';login.input.value='';point.input.value='';
   credentials.replaceChildren();
   const l=section('div');l.append(section('small','','Логин'),section('strong','',data.staff.login));
   const p=section('div');p.append(section('small','','Пароль'),section('strong','',data.password));
   credentials.append(l,p);newKey.hidden=false;
   notify('Создан доступ для «'+data.staff.name+'». Сохрани пароль сейчас.');
   await load();
  }catch(e){notify(e.message,true)}
  finally{mask(false)}
 }
 form.addEventListener('submit',create);
 function showCredentials(data){
  credentials.replaceChildren();
  const title=section('div');title.append(section('small','','Логин'),section('strong','',data.staff.login));
  const pwd=section('div');pwd.append(section('small','','Новый пароль'),section('strong','',data.password));
  credentials.append(title,pwd);newKey.hidden=false;notify('Пароль изменён. Передай его сотруднику.');
 }
 async function load(){
  try{
   const [staff,logs]=await Promise.all([request(''),request('/activity')]);
   available=true;list.replaceChildren();activity.replaceChildren();
   if(!staff.staff.length)list.append(section('p','pstaff-empty','Сотрудников пока нет. Заполни форму выше.'));
   for(const row of staff.staff){
    const card=section('div','pstaff-item'),bio=section('div');
    bio.append(section('strong','',row.name),section('small','',row.login+' · '+row.point+' · '+(row.active?'Доступ открыт':'Отключён')));
    const controls=section('div','pstaff-controls');
    const reset=action('Сбросить пароль',async()=>{
     if(!confirm('Создать новый пароль для «'+row.name+'»? Старый перестанет работать, активные сеансы завершатся.'))return;
     try{showCredentials(await request('/'+encodeURIComponent(row.id)+'/reset',{method:'POST',body:'{}'}));await load()}catch(e){notify(e.message,true)}
    });
    const toggle=action(row.active?'Отключить':'Включить',async()=>{
     if(!confirm((row.active?'Запретить':'Разрешить')+' доступ «'+row.name+'»?'))return;
     try{await request('/'+encodeURIComponent(row.id)+'/status',{method:'POST',body:JSON.stringify({active:!row.active})});newKey.hidden=true;credentials.replaceChildren();await load();notify('Права сотрудника обновлены.')}catch(e){notify(e.message,true)}
    });
    controls.append(reset,toggle);card.append(bio,controls);list.append(card);
   }
   if(!logs.events.length)activity.append(section('p','pstaff-empty','Пока запросов печати нет.'));
   for(const event of logs.events.slice(0,20)){
    const item=section('div','pstaff-event');
    let dt='—';try{dt=new Date(event.at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}catch{}
    item.append(section('strong','',event.staff+' · '+event.product),section('small','',event.point+' · '+dt+' · '+event.copies+' шт. · '+event.status));
    activity.append(item);
   }
   notify('Сотрудников: '+staff.staff.filter(x=>x.active).length+' активных. Доступ только для печати.');
  }catch(e){
   if(e.status===401)notify('Сначала войди как владелец в облачном управлении выше.',true);
   else notify('Проверка сотрудников: '+e.message,true);
  }
 }
 window.addEventListener('farukh-print-owner-authenticated',()=>void load());
 void load();
 return {refresh:load};
}
