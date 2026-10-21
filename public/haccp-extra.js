const f=(name,label,type='text')=>({name,label,type});
export const extraJournals={
 humidity:{title:'Температура и влажность склада',hint:'Для складов, где условия хранения требуют контроля влажности. Пределы — из маркировки и утверждённых процедур.',fields:[f('zone','Помещение / зона'),f('measured','Температура, °C','number'),f('humidity','Относительная влажность, %','number'),f('limits','Утверждённые допустимые условия')]},
 cooking:{title:'Тепловая обработка и охлаждение',hint:'Заполняй для контролируемых этапов по вашему плану ХАССП: нагрев, охлаждение или повторный нагрев.',fields:[f('product','Блюдо / партия'),f('stage','Этап процесса'),f('startedAt','Начало этапа','datetime-local'),f('finishedAt','Окончание этапа','datetime-local'),f('measured','Измеренная температура продукта, °C','number'),f('limits','Критерий по утверждённой техкарте / процедуре')]},
 defrosting:{title:'Размораживание',hint:'Сырьё размораживают по утверждённой инструкции и маркировке. Единого срока в часах для всех продуктов СанПиН 2.3/2.4.4282-26 не устанавливает.',fields:[f('product','Продукт / партия'),f('quantity','Количество и единица'),f('method','Способ размораживания'),f('startedAt','Начало','datetime-local'),f('finishedAt','Окончание','datetime-local'),f('measured','Температура продукта, °C','number'),f('chamberTemperature','Фактическая температура холодильника, °C','number'),f('approvedHours','Допустимое время по утверждённой инструкции, ч','number'),f('reviewer','Проверил / старший смены')]},
 frying:{title:'Контроль фритюрного масла',hint:'Для кухни, использующей фритюр. Решение о дальнейшем использовании принимает ответственный по результатам контроля.',fields:[f('equipment','Фритюрница'),f('product','Масло / партия'),f('startedAt','Начало использования','datetime-local'),f('checks','Оценка качества / результат измерения'),f('decisionText','Решение: использовать или заменить')]},
 quality:{title:'Бракераж готовой продукции',hint:'Применяй в рамках утверждённой программы контроля и требований к вашему виду питания.',fields:[f('product','Блюдо / партия'),f('quantity','Количество и единица'),f('startedAt','Приготовлено','datetime-local'),f('checks','Внешний вид, консистенция, запах и вкус'),f('decisionText','Решение о реализации'),f('reviewer','Проверил / состав комиссии')]},
 hygiene:{title:'Гигиенический осмотр',hint:'Для уполномоченного ответственного. Фиксируй результат осмотра и допуск; медицинские диагнозы в журнал не вносятся.',fields:[f('employee','Сотрудник'),f('role','Должность / смена'),f('checks','Результат осмотра по принятой форме'),f('decisionText','Допуск к работе / отстранение')]},
 pests:{title:'Контроль вредителей',hint:'Фактические осмотры и мероприятия по программе производственного контроля.',fields:[f('zone','Зона / контрольная точка'),f('checks','Результат осмотра / обнаруженные признаки'),f('method','Проведённые мероприятия'),f('reviewer','Исполнитель / организация')]}
};
export const extraFieldNames=Object.fromEntries(Object.values(extraJournals).flatMap(s=>s.fields.map(f=>[f.name,f.label])));
export function defrostingDetails(input){
 const req=(key,label)=>{const v=String(input[key]??'').trim();if(!v)throw Error('Укажи: '+label);return v};
 const started=req('startedAt','начало размораживания');
 const start=Date.parse(started),endRaw=String(input.finishedAt??'').trim();
 const end=endRaw?Date.parse(endRaw):null;
 if(!Number.isFinite(start)||end!==null&&!Number.isFinite(end))throw Error('Проверь время размораживания.');
 if(end!==null&&end<start)throw Error('Окончание раньше начала.');
 const measuredRaw=String(input.measured??'').trim().replace(',','.');
 const measured=measuredRaw===''?null:Number(measuredRaw);
 const chamberRaw=String(input.chamberTemperature??'').trim().replace(',','.');
 const chamberTemperature=chamberRaw===''?null:Number(chamberRaw);
 const hoursRaw=String(input.approvedHours??'').trim().replace(',','.');
 const approvedHours=hoursRaw===''?null:Number(hoursRaw);
 if([measured,chamberTemperature,approvedHours].some(v=>v!==null&&!Number.isFinite(v))||approvedHours!==null&&approvedHours<=0)
  throw Error('Проверь температуру или часы.');
 const result=req('result','фактический результат');
 if(!['na','done','problem'].includes(result))throw Error('Выбери результат процесса.');
 if(result==='done'&&(end===null||measured===null||chamberTemperature===null||!String(input.reviewer??'').trim()))
  throw Error('Для завершения укажи окончание, обе температуры и ФИО старшего смены.');
 if(result==='na'&&end!==null)throw Error('Для завершённого процесса выбери результат.');
 const elapsed=end===null?null:Math.round((end-start)/3600000*100)/100;
 const outside=chamberTemperature!==null&&(chamberTemperature<2||chamberTemperature>6);
 const overtime=approvedHours!==null&&elapsed!==null&&elapsed>approvedHours;
 if(result==='done'&&(outside||overtime))
  throw Error('Есть отклонение температуры холодильника или превышен утверждённый срок. Выбери «Нарушение» и опиши действие.');
 if((outside||overtime||result==='problem')&&!String(input.notes??'').trim())
  throw Error('При нарушении укажи причину и действия в комментарии.');
 return {
  product:req('product','сырьё или партия').slice(0,300),
  batch:String(input.batch??'').trim().slice(0,120),
  quantity:req('quantity','масса и единица').slice(0,100),
  method:req('method','способ размораживания').slice(0,300),
  startedAt:new Date(start).toISOString(),
  finishedAt:end===null?null:new Date(end).toISOString(),
  measured,chamberTemperature,approvedHours,elapsedHours:elapsed,
  reviewer:String(input.reviewer??'').trim().slice(0,120),result,
  approvedSource:String(input.approvedSource??'').trim().slice(0,300)
 };
}
export function extraDetails(kind,input){if(kind==='defrosting')return defrostingDetails(input);const spec=extraJournals[kind],details={};if(!spec)throw Error('Неизвестный журнал.');for(const field of spec.fields){const value=String(input[field.name]??'').trim();if(!value)throw Error('Укажи: '+field.label);if(field.type==='number'){const n=Number(value.replace(',','.'));if(!Number.isFinite(n)||field.name==='humidity'&&(n<0||n>100))throw Error('Проверь: '+field.label);details[field.name]=n}else if(field.type==='datetime-local'){if(!Number.isFinite(Date.parse(value)))throw Error('Проверь дату: '+field.label);details[field.name]=new Date(value).toISOString()}else details[field.name]=value.slice(0,1000)}if(details.finishedAt&&details.startedAt&&details.finishedAt<details.startedAt)throw Error('Окончание этапа раньше начала.');if(!['done','problem','na'].includes(input.result))throw Error('Выбери результат контроля.');details.result=input.result;return details}
