// Personal sample values are kept separate from measured HACCP records.
export function generateTemperatureSamples({from,to,equipment,records=[],samples=[],random=Math.random}){
 const parse=s=>{if(!/^20\d{2}-\d{2}-\d{2}$/.test(s))throw Error('Выбери даты с и по.');const n=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw Error('Неверная дата.');return n};
 const start=parse(from),end=parse(to),days=(end-start)/86400000+1;
 if(days<1||days>366)throw Error('Выбери период от 1 до 366 дней.');
 if(!equipment.length)throw Error('На выбранной точке нет оборудования.');
 for(const e of equipment)if(e.min==null||e.max==null||e.min===''||e.max===''||!Number.isFinite(Number(e.min))||!Number.isFinite(Number(e.max))||Number(e.min)>Number(e.max)||Math.ceil(Number(e.min)*10)>Math.floor(Number(e.max)*10))throw Error('Укажи корректный диапазон для '+e.name+'.');
 const occupied=new Set(samples.map(r=>r.equipmentId+'|'+r.day));
 for(const r of records.filter(r=>r.kind==='temperature')){
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date(r.at));occupied.add(r.details.equipmentId+'|'+day);
 }
 const result=[];
 for(let n=start;n<=end;n+=86400000){const day=new Date(n).toISOString().slice(0,10);for(const e of equipment){
  if(occupied.has(e.id+'|'+day))continue;
  const lo=Math.ceil(Number(e.min)*10),hi=Math.floor(Number(e.max)*10);
  result.push({id:'sample:'+e.id+':'+day,pointId:e.pointId,equipmentId:e.id,day,value:(lo+Math.floor(Math.min(.999999999,Math.max(0,random()))*(hi-lo+1)))/10,source:'sample',edited:false});
 }}return result;
}
export function mountTemperatureGenerator(root,{getHaccp,pointId,commit,notify,month}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
 const panel=el('details');panel.className='panel';panel.append(el('summary','Генерация по образцу · выбрать даты'));
 const note=el('p','Личный журнал · значения сгенерированы по образцу, не фактические замеры. Заполненные дни пропускаются. Перед сохранением можно изменить каждое число.');note.className='small';panel.append(note);
 const field=(parent,title,type,value)=>{const l=el('label',title),i=el('input');i.type=type;i.value=value??'';l.append(i);parent.append(l);return i};
 const controls=el('div');controls.className='fields';panel.append(controls);
 const from=field(controls,'С какого дня','date',month+'-01'),to=field(controls,'По какой день','date',month+'-'+new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate());
 const equipment=getHaccp().equipment.filter(e=>e.pointId===pointId);
 const ranges=equipment.map(e=>{const row=el('div');row.className='fields';row.append(el('strong',e.name));const min=field(row,'От, °C','number',e.min),max=field(row,'До, °C','number',e.max);min.step=max.step='0.1';panel.append(row);return {e,min,max}});
 const actions=el('div');actions.className='bar';const generate=el('button','Сгенерировать'),save=el('button','Сохранить личный журнал'),cancel=el('button','Отменить генерацию');for(const b of [generate,save,cancel])b.type='button';save.className='primary';actions.append(generate,save,cancel);panel.append(actions);
 const message=el('p');message.setAttribute('role','status');const preview=el('div');preview.className='haccp-grid-viewport';panel.append(message,preview);root.append(panel);
 let pending=[];let editors=[];
 function draw(){preview.replaceChildren();editors=[];save.disabled=!pending.length;cancel.disabled=!pending.length;
  if(!pending.length)return;
  const table=el('table');table.className='haccp-month-table';table.append(el('caption','Личный журнал · значения по образцу · 11:00 МСК'));
  const head=el('tr');for(const label of ['Дата','Оборудование','Температура, °C'])head.append(el('th',label));table.append(head);
  for(const item of pending){const row=el('tr');row.append(el('td',item.day),el('td',equipment.find(e=>e.id===item.equipmentId)?.name||item.equipmentId));const cell=el('td'),input=el('input');input.type='number';input.step='0.1';input.value=item.value;input.setAttribute('aria-label',item.day+' '+equipment.find(e=>e.id===item.equipmentId)?.name);input.oninput=()=>{item.edited=true};cell.append(input);row.append(cell);table.append(row);editors.push({item,input})}preview.append(table);
 }
 generate.onclick=()=>{try{if(!pointId)throw Error('Сначала выбери одну точку.');pending=generateTemperatureSamples({from:from.value,to:to.value,equipment:ranges.map(({e,min,max})=>({...e,min:min.value,max:max.value})),records:getHaccp().records,samples:getHaccp().personalTemperatureSamples||[]});draw();message.textContent=pending.length?'Подготовлено '+pending.length+' значений. Проверь, поправь и сохрани.':'Все выбранные дни уже заполнены.';}catch(e){message.textContent=e.message}};
 cancel.onclick=()=>{pending=[];draw();message.textContent='Генерация отменена. Сохранённые данные не изменены.'};
 save.onclick=async()=>{try{const rows=editors.map(({item,input})=>{if(input.value===''||!Number.isFinite(Number(input.value)))throw Error('Заполни все температуры числами.');return {...item,value:Number(input.value),source:'sample'}});save.disabled=true;await commit(state=>{
  const h=state.haccp,existing=h.personalTemperatureSamples||[],occupied=new Set(existing.map(x=>x.equipmentId+'|'+x.day));
  for(const r of h.records.filter(r=>r.kind==='temperature'))occupied.add(r.details.equipmentId+'|'+new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date(r.at)));
  h.personalTemperatureSamples=[...existing,...rows.filter(r=>!occupied.has(r.equipmentId+'|'+r.day))];
 });pending=[];draw();message.textContent='Личный журнал сохранён. Значения остаются помеченными как созданные по образцу.';}catch(e){message.textContent=e.message;notify(e.message,true);save.disabled=!pending.length}};
 draw();if(!pointId)message.textContent='Выбери одну точку выше, чтобы настроить генерацию.';
}
