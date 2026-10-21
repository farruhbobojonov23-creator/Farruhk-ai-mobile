import {extraJournals,extraDetails} from './haccp-extra.js';
import {RECEIVING_GROUPS,receivingInspection,validateReceivingSettings} from './receiving-config.js';
export const journalTypes={temperature:'Температуры',cleaning:'Уборка и дезинфекция',receiving:'Приёмка продуктов',storage:'Маркировка и хранение',audit:'Проверки точек',...Object.fromEntries(Object.entries(extraJournals).map(([k,v])=>[k,v.title]))};
export const auditItems=['Чистота рабочих зон и инвентаря','Маркировка и сроки продуктов','Разделение сырья и готовой продукции','Состояние холодильного оборудования','Личная гигиена и рабочая одежда'];
export const defaultDailyControls=Object.freeze(['temperature','cleaning','storage','hygiene']);
export const emptyHaccp=()=>({version:1,revision:0,points:Array.from({length:4},(_,i)=>({id:'point-'+(i+1),name:'Точка '+(i+1)})),equipment:[],records:[],actions:[],documents:[],autoTemplates:[],autoDrafts:[],dailyControls:[...defaultDailyControls],generalCleaningTarget:2});
const text=(v,n=2000)=>String(v??'').trim().slice(0,n);
const required=(v,label,n)=>{const s=text(v,n);if(!s)throw Error('Укажи: '+label);return s};
function number(v,label,optional=false){if(v===null||v===undefined||String(v).trim()===''){if(optional)return null;throw Error('Укажи: '+label)}const n=Number(v);if(!Number.isFinite(n))throw Error('Неверное число: '+label);return n}
function date(v,label){const s=required(v,label,80);if(!Number.isFinite(Date.parse(s)))throw Error('Неверная дата: '+label);return new Date(s).toISOString()}
export function temperatureStatus(value,min,max){if(min===null&&max===null)return 'unconfigured';return (min!==null&&value<min)||(max!==null&&value>max)?'deviation':'ok'}
export function validateHaccp(value){
 if(value===undefined)return emptyHaccp();if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Повреждён раздел ХАССП.');
 const result={...emptyHaccp(),...structuredClone(value)};
 if(!Array.isArray(result.dailyControls)||new Set(result.dailyControls).size!==result.dailyControls.length||result.dailyControls.some(kind=>typeof kind!=='string'||!journalTypes[kind]))throw Error('Неверный план ежедневных журналов ХАССП.');
 if(!Number.isInteger(result.generalCleaningTarget)||result.generalCleaningTarget<0||result.generalCleaningTarget>10)throw Error('Неверная периодичность генеральной уборки.');
 if(!Array.isArray(result.autoTemplates)||result.autoTemplates.length>200||result.autoTemplates.some(t=>
  !t||typeof t.id!=='string'||!journalTypes[t.kind]||typeof t.pointId!=='string'||typeof t.startDay!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(t.startDay)||
  !t.form||typeof t.form!=='object'||Array.isArray(t.form)||Object.keys(t.form).length>60||
  Object.values(t.form).some(v=>typeof v!=='string'||v.length>1200)))
  throw Error('Повреждены образцы журналов ХАССП.');
 if(!Array.isArray(result.autoDrafts)||result.autoDrafts.length>6000||result.autoDrafts.some(d=>
  !d||typeof d.id!=='string'||!journalTypes[d.kind]||typeof d.pointId!=='string'||typeof d.day!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(d.day)||
  !d.form||typeof d.form!=='object'||Array.isArray(d.form)||Object.keys(d.form).length>60||
  Object.values(d.form).some(v=>typeof v!=='string'||v.length>1200)))
  throw Error('Повреждены черновики журналов ХАССП.');
 if(new Set(result.autoTemplates.map(t=>t.id)).size!==result.autoTemplates.length||
    new Set(result.autoDrafts.map(d=>d.id)).size!==result.autoDrafts.length)throw Error('Повтор черновиков ХАССП.');
 for(const row of [...result.autoTemplates,...result.autoDrafts])
  if(!result.points.some(p=>p.id===row.pointId))throw Error('У образца журнала нет указанной точки.');
 for(const k of ['points','equipment','records','actions','documents'])if(!Array.isArray(result[k])||result[k].some(x=>!x||typeof x!=='object'||Array.isArray(x)||typeof x.id!=='string'||!x.id))throw Error('Повреждён журнал ХАССП: '+k);
 for(const k of ['points','equipment','records','actions','documents'])if(new Set(result[k].map(x=>x.id)).size!==result[k].length)throw Error('Повторяющиеся записи ХАССП: '+k);
 if(!result.points.length||result.points.some(p=>typeof p.name!=='string'||!p.name.trim()))throw Error('Укажи названия точек.');
 const points=new Set(result.points.map(p=>p.id));
 validateReceivingSettings(result.receivingSettings,[...points]);
 for(const item of result.equipment){if(!points.has(item.pointId)||typeof item.name!=='string'||!item.name.trim())throw Error('Неверное оборудование ХАССП.');for(const key of ['min','max'])if(item[key]!==null&&!Number.isFinite(item[key]))throw Error('Неверные границы температуры.');if(item.min!==null&&item.max!==null&&item.min>item.max)throw Error('Минимум температуры больше максимума.')}
 let attachments=0;
 for(const collection of ['records','actions','documents'])for(const item of result[collection]){
  if(collection!=='documents'&&!points.has(item.pointId))throw Error('Не найдена точка записи ХАССП.');
  if(collection==='records'&&(!item.details||typeof item.details!=='object'||Array.isArray(item.details)||!['ok','deviation','unconfigured'].includes(item.status)||!journalTypes[item.kind]||!Number.isFinite(Date.parse(item.at))||typeof item.owner!=='string'||!item.owner.trim()))throw Error('Повреждена запись журнала ХАССП.');
  if(collection==='records'&&item.kind==='cleaning'&&item.details.cleaningType!==undefined&&!['daily','general'].includes(item.details.cleaningType))throw Error('Неверный тип уборки в журнале.');
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
  if(input.cleaningType&&!['daily','general'].includes(input.cleaningType))throw Error('Неверный тип уборки.');
  record.details={cleaningType:input.cleaningType||'daily',zone:required(input.zone,'зона или инвентарь',200),method:required(input.method,'выполненная обработка',500),agent:required(input.agent,'средство или способ',200),concentration:text(input.concentration,100),exposure:text(input.exposure,100),result:input.result};if(!['done','problem'].includes(input.result))throw Error('Выбери результат уборки.');record.status=input.result==='problem'?'deviation':'ok';
 }else if(kind==='receiving'){
  const decision=input.decision;
  if(!['accepted','rejected'].includes(decision))throw Error('Выбери решение по приёмке.');
  // Date-only expiry is valid through the printed date (Moscow kitchen clock);
  // older full timestamps retain the time entered by the operator.
  const expiry=input.expiry?date(/^20\\d{2}-\\d{2}-\\d{2}$/.test(input.expiry)?
   input.expiry+'T23:59:59+03:00':input.expiry,'годен до'):null;
  const measured=number(input.measured,'температура при приёмке',true);
  const category=text(input.category,40);
  if(category&&!RECEIVING_GROUPS.some(([key])=>key===category))throw Error('Выбери категорию сырья.');
  const structured=receivingInspection(input);
  const checks=structured?.text||required(input.checks,'проверка маркировки, упаковки и документов',1000);
  if(structured?.failed.length&&decision==='accepted')
   throw Error('Есть нарушения при приёмке. Укажи отказ либо исправь результаты проверки.');
  if(category==='chilled'||category==='frozen'){
   if(measured===null&&decision==='accepted')throw Error('Укажи фактическую температуру охлаждённого или замороженного продукта.');
  }
  const min=number(input.min,'утверждённый минимум',true);
  const max=number(input.max,'утверждённый максимум',true);
  if(min!==null&&max!==null&&min>max)throw Error('Неверные границы температуры при приёмке.');
  const outside=measured!==null&&((min!==null&&measured<min)||(max!==null&&measured>max));
  if(outside&&decision==='accepted')throw Error('Температура за утверждёнными границами. Оформи отказ и замечание.');
  if(expiry&&Date.parse(expiry)<=Date.parse(at)&&decision==='accepted')
   throw Error('Срок продукта истёк на момент приёмки. Исправь маркировку или оформи отказ.');
  if(category&&decision==='rejected'&&!text(input.notes))
   throw Error('Укажи причину отказа в комментарии.');
  record.details={
   supplier:required(input.supplier,'поставщик',200),
   product:required(input.product,'продукт / партия',300),
   quantity:required(input.quantity,'количество с единицей',100),
   batch:text(input.batch,100),invoice:text(input.invoice,120),category,
   measured,min,max,expiry,checks,decision
  };
  record.status=decision==='rejected'?'deviation':
   ((category==='chilled'||category==='frozen')&&min===null&&max===null?'unconfigured':'ok');
 }else if(kind==='storage'){
  const start=date(input.startedAt,'дата приготовления / вскрытия'),end=date(input.useBy,'использовать до');if(Date.parse(end)<=Date.parse(start))throw Error('Окончание срока должно быть позже приготовления / вскрытия.');record.details={product:required(input.product,'продукт / полуфабрикат',300),batch:text(input.batch,100),startedAt:start,useBy:end,conditions:required(input.conditions,'утверждённые условия хранения',500)};record.status=Date.parse(end)<=Date.parse(at)?'deviation':'ok';
 }else if(extraJournals[kind]){
  record.details=extraDetails(kind,input);record.status=input.result==='problem'?'deviation':input.result==='na'?'unconfigured':'ok';
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
export function mergeHaccp(current,incoming){const a=validateHaccp(current),b=validateHaccp(incoming);
 // A newly installed device should recover the owner's inspection plan from a backup.
 // If it already has HACCP activity or its own custom plan, preserve local settings.
 const untouched=!a.records.length&&!a.actions.length&&!a.equipment.length&&!a.documents.length&&!a.autoTemplates.length&&!a.autoDrafts.length&&a.dailyControls.join('|')===defaultDailyControls.join('|')&&a.generalCleaningTarget===2;
 if(untouched){a.dailyControls=[...b.dailyControls];a.generalCleaningTarget=b.generalCleaningTarget}
 if(untouched){
  // A clean device can restore owner-authored templates and pending drafts.
  a.autoTemplates=structuredClone(b.autoTemplates);
  a.autoDrafts=structuredClone(b.autoDrafts);
 }else{
  const templates=new Set(a.autoTemplates.map(t=>t.id));
  for(const template of b.autoTemplates)if(!templates.has(template.id)){a.autoTemplates.push(template);templates.add(template.id)}
  const drafts=new Set(a.autoDrafts.map(d=>d.id));
  for(const draft of b.autoDrafts)if(!drafts.has(draft.id)){a.autoDrafts.push(draft);drafts.add(draft.id)}
 }
 for(const key of ['points','equipment','records','actions','documents']){const ids=new Set(a[key].map(x=>x.id));for(const item of b[key])if(!ids.has(item.id)){a[key].push(item);ids.add(item.id)}}a.revision=Math.max(Number(a.revision)||0,Number(b.revision)||0)+1;return validateHaccp(a)}
export function journalCsv(records,points){const safe=v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[['Дата и время','Журнал','Точка','Ответственный','Результат','Подробности','Комментарий'],...records.map(r=>[r.at,journalTypes[r.kind],points.find(p=>p.id===r.pointId)?.name||r.pointId,r.owner,r.status,JSON.stringify(r.details),r.notes])].map(row=>row.map(safe).join(';')).join('\r\n')}
