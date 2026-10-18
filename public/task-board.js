export const priorities={high:'Высокий',normal:'Обычный',low:'Низкий'};
export function taskDay(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
export function selectTasks(tasks,{filter='active',day=taskDay(),query='',now=new Date()}={}){
 return tasks.filter(t=>String(t.text).toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))).filter(t=>filter==='all'||filter==='done'?filter==='all'||t.done:!t.done&&(filter==='active'||filter==='day'&&t.due&&taskDay(t.due)===day||filter==='overdue'&&t.due&&Date.parse(t.due)<+now)).sort((a,b)=>Number(a.done)-Number(b.done)||({high:0,normal:1,low:2}[a.priority]??1)-({high:0,normal:1,low:2}[b.priority]??1)||(Date.parse(a.due)||Infinity)-(Date.parse(b.due)||Infinity));
}
export function updateTask(state,id,input,now=new Date()){
 const t=state.tasks.find(t=>t.id===id);if(!t)throw Error('Задача не найдена.');
 const text=String(input.text??t.text).trim();if(!text||text.length>500)throw Error('Напиши задачу длиной до 500 символов.');
 const priority=input.priority??t.priority??'normal';if(!priorities[priority])throw Error('Выбери приоритет.');
 const due=input.due===undefined?t.due:input.due;if(due&&!Number.isFinite(Date.parse(due)))throw Error('Проверь срок задачи.');
 Object.assign(t,{text,priority,due:due?new Date(due).toISOString():null,updatedAt:now.toISOString()});
 if(input.done!==undefined){t.done=!!input.done;t.completedAt=t.done?now.toISOString():null}return t;
}
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
export function mountTaskBoard(root,{getState,save,notify}){
 const controls=el('div',undefined,'task-controls'),nav=el('nav',undefined,'haccp-tabs'),search=el('input'),day=el('input'),summary=el('p',undefined,'small');
 search.placeholder='Найти задачу';search.setAttribute('aria-label','Найти задачу');day.type='date';day.value=taskDay();day.setAttribute('aria-label','Дата плана');
 controls.append(nav,search,day,summary);root.before(controls);let filter='active';
 for(const [key,label] of [['active','Активные'],['day','План на день'],['overdue','Просрочено'],['done','Выполнено'],['all','Все']]){const b=el('button',label);b.type='button';b.dataset.filter=key;b.onclick=()=>{filter=key;render()};nav.append(b)}
 const form=document.getElementById('taskform'),label=el('label','Приоритет'),priority=el('select');priority.id='taskpriority';for(const [v,t] of Object.entries(priorities))priority.add(new Option(t,v));priority.value='normal';label.append(priority);form.insertBefore(label,form.lastElementChild);
 async function act(fn){try{await save(fn)}catch(e){notify(e.message,true)}}
 function render(){const tasks=getState()?.tasks||[];root.replaceChildren();day.hidden=filter!=='day';for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.filter===filter));const now=new Date();summary.textContent=tasks.filter(t=>!t.done).length+' активных · '+tasks.filter(t=>!t.done&&t.due&&Date.parse(t.due)<+now).length+' просроченных · '+tasks.filter(t=>t.done).length+' выполнено';
 const visible=selectTasks(tasks,{filter,day:day.value,query:search.value,now});if(!visible.length)root.append(el('p','В этом списке задач пока нет.','empty'));
 for(const task of visible){const late=!task.done&&task.due&&Date.parse(task.due)<+now;const card=el('article',undefined,'task-card'+(late?' task-overdue':'')+(task.done?' task-done':''));const title=el('h3',task.text),meta=el('p',(priorities[task.priority]||'Обычный')+' приоритет · '+(task.due?new Date(task.due).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' (МСК)':'Без срока')+(late?' · Просрочено':''),'small');card.append(title,meta);if(task.done&&task.completedAt)card.append(el('p','Выполнено '+new Date(task.completedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}),'small'));
 const actions=el('div',undefined,'bar'),done=el('button',task.done?'Вернуть в работу':'Готово');done.type='button';done.onclick=()=>act(s=>updateTask(s,task.id,{done:!task.done}));actions.append(done);const edit=el('button','Изменить');edit.type='button';edit.onclick=()=>editTask(task);actions.append(edit);card.append(actions);root.append(card)}
 }
 function editTask(task){const dialog=el('dialog',undefined,'category-dialog'),f=el('form');dialog.setAttribute('aria-label','Изменить задачу');f.append(el('h2','Изменить задачу'));const fields={};for(const [key,title,type] of [['text','Задача','text'],['due','Срок (время устройства)','datetime-local']]){const l=el('label',title),i=el('input');i.type=type;i.required=key==='text';i.maxLength=500;i.value=key==='due'?(task.due?new Date(Date.parse(task.due)-new Date(task.due).getTimezoneOffset()*60000).toISOString().slice(0,16):''):task.text;l.append(i);f.append(l);fields[key]=i}const l=el('label','Приоритет'),p=el('select');for(const [v,t]of Object.entries(priorities))p.add(new Option(t,v));p.value=task.priority||'normal';l.append(p);f.append(l);const submit=el('button','Сохранить','primary');submit.type='submit';const cancel=el('button','Отмена');cancel.type='button';cancel.onclick=()=>dialog.close();f.append(submit,cancel);f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await save(s=>updateTask(s,task.id,{text:fields.text.value,due:fields.due.value,priority:p.value}));dialog.close()}catch(e){notify(e.message,true)}finally{submit.disabled=false}};dialog.append(f);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal()}
 search.oninput=day.onchange=render;return {render};
}
