export const journalTypes={temperature:'Температуры',cleaning:'Уборка и дезинфекция',receiving:'Приёмка продуктов',storage:'Маркировка и хранение',audit:'Проверки точек'};
export const auditItems=['Чистота рабочих зон и инвентаря','Маркировка и сроки продуктов','Разделение сырья и готовой продукции','Состояние холодильного оборудования','Личная гигиена и рабочая одежда'];
export const emptyHaccp=()=>({version:1,revision:0,points:Array.from({length:4},(_,i)=>({id:'point-'+(i+1),name:'Точка '+(i+1)})),equipment:[],records:[],actions:[],documents:[]});
const text=(v,n=2000)=>String(v??'').trim().slice(0,n);
const required=(v,label,n)=>{const s=text(v,n);if(!s)throw Error('Укажи: '+label);return s};
function number(v,label,optional=false){if(v===null||v===undefined||String(v).trim()===''){if(optional)return null;throw Error('Укажи: '+label)}const n=Number(v);if(!Number.isFinite(n))throw Error('Неверное число: '+label);return n}
function date(v,label){const s=required(v,label,80);if(!Number.isFinite(Date.parse(s)))throw Error('Неверная дата: '+label);return new Date(s).toISOString()}
export function temperatureStatus(value,min,max){if(min===null&&max===null)return 'unconfigured';return (min!==null&&value<min)||(max!==null&&value>max)?'deviation':'ok'}
export function validateHaccp(value){
 if(value===undefined)return emptyHaccp();if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Повреждён раздел ХАССП.');
 const result={...emptyHaccp(),...structuredClone(value)};
 for(const k of ['points','equipment','records','actions','documents'])if(!Array.isArray(result[k])||result[k].some(x=>!x||typeof x!=='object'||Array.isArray(x)||typeof x.id!=='string'||!x.id))throw Error('Повреждён журнал ХАССП: '+k);
 for(const k of ['points','equipment','records','actions','documents'])if(new Set(result[k].map(x=>x.id)).size!==result[k].length)throw Error('Повторяющиеся записи ХАССП: '+k);
 if(!result.points.length||result.points.some(p=>typeof p.name!=='string'||!p.name.trim()))throw Error('Укажи названия точек.');
 const points=new Set(result.points.map(p=>p.id));
 for(const item of result.equipment){if(!points.has(item.pointId)||typeof item.name!=='string'||!item.name.trim())throw Error('Неверное оборудование ХАССП.');for(const key of ['min','max'])if(item[key]!==null&&!Number.isFinite(item[key]))throw Error('Неверные границы температуры.');if(item.min!==null&&item.max!==null&&item.min>item.max)throw Error('Минимум температуры больше максимума.')}
 let attachments=0;
 for(const collection of ['records','actions','documents'])for(const item of result[collection]){
  if(collection!=='documents'&&!points.has(item.pointId))throw Error('Не найдена точка записи ХАССП.');
  if(collection==='records'&&(!item.details||typeof item.details!=='object'||Array.isArray(item.details)||!['ok','deviation','unconfigured'].includes(item.status)||!journalTypes[item.kind]||!Number.isFinite(Date.parse(item.at))||typeof item.owner!=='string'||!item.owner.trim()))throw Error('Повреждена запись журнала ХАССП.');
  if(collection==='actions'&&(!['open','closed'].includes(item.status)||typeof item.sourceId!=='string'||typeof item.owner!=='string'||!item.owner.trim()||typeof item.text!=='string'||!Number.isFinite(Date.parse(item.createdAt))))throw Error('Повреждено корректирующее действие.');
  if(collection==='actions'&&item.status==='closed'&&(!item.action||!item.reviewer||!Number.isFinite(Date.parse(item.closedAt))))throw Error('Не заполнена проверка корректирующего действия.');
  if(collection==='records')for(const detail of Object.values(item.details)){if(Array.isArray(detail)){if(detail.some(x=>!x||typeof x.label!=='string'||!['yes','no','na'].includes(x.result)))throw Error('Повреждены пункты проверки.')}else if(detail!==null&&!['string','number','boolean'].includes(typeof detail))throw Error('Повреждены подробности записи.');}
  if(collection==='actions'&&(!result.records.some(r=>r.id===item.sourceId&&r.pointId===item.pointId)||(item.due&&!Number.isFinite(Date.parse(item.due)))))throw Error('Неверный источник или срок действия.');
  const data=item.photo||item.data;
  if(data){if(typeof data!=='string'||!/^data:(image\/(?:png|jpeg|webp)|application\/(?:pdf|octet-stream|vnd\.[\w.+-]+|msword)|text\/plain);base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('Неверный формат вложения ХАССП.');if(item.photo&&!/^data:image\/(png|jpeg|webp);base64,/.test(data))throw Error('Фотография должна быть PNG, JPEG или WebP.');attachments+=data.length}
  if(collection==='documents'&&(['title','fileName','data','owner'].some(k=>typeof item[k]!=='string'||!item[k].trim())||!Number.isFinite(Date.parse(item.createdAt))))throw Error('Не заполнен документ ХАССП.');
 }
 if(attachments>50*1024*1024)throw Error('Достигнут лимит вложений ХАССП (50 МБ). Сохрани архив; новые записи можно добавлять без файлов.');return result;
}
export function addEquipment(state,input,id=crypto.randomUUID()){
 const h=validateHaccp(state.haccp);const equipment={id,pointId:input.pointId,name:required(input.name,'оборудование',120),min:number(input.min,'минимум',true),max:number(input.max,'максимум',true)};
 if(h.equipment.some(e=>e.pointId===equipment.pointId&&e.name===equipment.name))throw Error('Такое оборудование уже добавлено на точке.');h.equipment.push(equipment);state.haccp=validateHaccp(h);return equipment;
}
export function updateEquipment(state,id,input){
 const h=validateHaccp(state.haccp),item=h.equipment.find(e=>e.id===id);if(!item)throw Error('Оборудование не найдено.');item.name=required(input.name,'оборудование',120);item.min=number(input.min,'минимум',true);item.max=number(input.max,'максимум',true);if(h.equipment.some(e=>e.id!==id&&e.pointId===item.pointId&&e.name===item.name))throw Error('Такое оборудование уже добавлено на точке.');state.haccp=validateHaccp(h);
}
export function addJournalRecord(state,input,id=crypto.randomUUID(),now=new Date()){
 const h=validateHaccp(state.haccp),kind=input.kind;if(!journalTypes[kind])throw Error('Выбери журнал.');
 const at=date(input.at,'дата и время'),record={id,kind,pointId:required(input.pointId,'точка'),at,createdAt:now.toISOString(),owner:required(input.owner,'ответственный',120),notes:text(input.notes),photo:input.photo||null,status:'ok',details:{}};
 if(!h.points.some(p=>p.id===record.pointId))throw Error('Выбери точку.');
 if(kind==='temperature'){
  const e=h.equipment.find(e=>e.id===input.equipmentId&&e.pointId===record.pointId);if(!e)throw Error('Добавь и выбери оборудование этой точки.');const measured=number(input.measured,'измеренная температура');record.details={equipmentId:e.id,equipment:e.name,measured,min:e.min,max:e.max};record.status=temperatureStatus(measured,e.min,e.max);
 }else if(kind==='cleaning'){
  record.details={zone:required(input.zone,'зона или инвентарь',200),method:required(input.method,'выполненная обработка',500),agent:required(input.agent,'средство или способ',200),concentration:text(input.concentration,100),exposure:text(input.exposure,100),result:input.result};if(!['done','problem'].includes(input.result))throw Error('Выбери результат уборки.');record.status=input.result==='problem'?'deviation':'ok';
 }else if(kind==='receiving'){
  const expiry=input.expiry?date(input.expiry,'годен до'):null;record.details={supplier:required(input.supplier,'поставщик',200),product:required(input.product,'продукт / партия',300),quantity:required(input.quantity,'количество с единицей',100),measured:number(input.measured,'температура при приёмке',true),expiry,checks:required(input.checks,'результат проверки маркировки, упаковки и документов',1000),decision:input.decision};if(!['accepted','rejected'].includes(input.decision))throw Error('Выбери решение по приёмке.');if(expiry&&Date.parse(expiry)<=Date.parse(at)&&input.decision==='accepted')throw Error('Указанный срок истёк на момент приёмки. Исправь дату или выбери отказ.');record.status=input.decision==='rejected'?'deviation':'ok';
 }else if(kind==='storage'){
  const start=date(input.startedAt,'дата приготовления / вскрытия'),end=date(input.useBy,'использовать до');if(Date.parse(end)<=Date.parse(start))throw Error('Окончание срока должно быть позже приготовления / вскрытия.');record.details={product:required(input.product,'продукт / полуфабрикат',300),batch:text(input.batch,100),startedAt:start,useBy:end,conditions:required(input.conditions,'утверждённые условия хранения',500)};record.status=Date.parse(end)<=Date.parse(at)?'deviation':'ok';
 }else{
  const checks=auditItems.map((label,i)=>({label,result:input['check'+i]}));if(checks.some(x=>!['yes','no','na'].includes(x.result)))throw Error('Ответь на все пункты проверки.');record.details={checks};record.status=checks.some(x=>x.result==='no')?'deviation':checks.every(x=>x.result==='na')?'unconfigured':'ok';
 }
 h.records.push(record);
 if(record.status==='deviation')h.actions.push({id:'action-'+id,sourceId:id,pointId:record.pointId,owner:record.owner,text:journalTypes[kind]+': '+(record.details.equipment||record.details.product||record.details.zone||'замечание проверки'),createdAt:now.toISOString(),due:input.due?date(input.due,'срок устранения'):null,status:'open',action:'',reviewer:'',closedAt:null});
 state.haccp=validateHaccp(h);return record;
}
export function closeCorrectiveAction(state,id,{action,reviewer},now=new Date()){
 const h=validateHaccp(state.haccp),item=h.actions.find(a=>a.id===id);if(!item)throw Error('Действие не найдено.');if(item.status==='closed')throw Error('Действие уже закрыто.');item.action=required(action,'что сделано',2000);item.reviewer=required(reviewer,'кто проверил',120);item.closedAt=now.toISOString();item.status='closed';state.haccp=validateHaccp(h);
}
export function mergeHaccp(current,incoming){const a=validateHaccp(current),b=validateHaccp(incoming);for(const key of ['points','equipment','records','actions','documents']){const ids=new Set(a[key].map(x=>x.id));for(const item of b[key])if(!ids.has(item.id)){a[key].push(item);ids.add(item.id)}}a.revision=Math.max(Number(a.revision)||0,Number(b.revision)||0)+1;return validateHaccp(a)}
export function journalCsv(records,points){const safe=v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[['Дата и время','Журнал','Точка','Ответственный','Результат','Подробности','Комментарий'],...records.map(r=>[r.at,journalTypes[r.kind],points.find(p=>p.id===r.pointId)?.name||r.pointId,r.owner,r.status,JSON.stringify(r.details),r.notes])].map(row=>row.map(safe).join(';')).join('\r\n')}
