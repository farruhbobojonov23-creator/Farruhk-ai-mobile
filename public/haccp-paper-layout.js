/* HACCP forms are tailored to each process: a shared, auditable layout for web & PDF. */
export const journalPaperColumns=Object.freeze({
 "temperature": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.9
  ],
  [
   "equipment",
   "Оборудование",
   1.6
  ],
  [
   "measured",
   "Факт, °C",
   0.8
  ],
  [
   "temperatureLimits",
   "Норма, °C",
   1.2
  ],
  [
   "status",
   "Оценка",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.3
  ],
  [
   "notes",
   "Примечание",
   1.5
  ]
 ],
 "humidity": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Помещение / точка",
   1.1
  ],
  [
   "zone",
   "Зона контроля",
   1.3
  ],
  [
   "measured",
   "Темп., °C",
   0.8
  ],
  [
   "humidity",
   "Влажн., %",
   0.8
  ],
  [
   "limits",
   "Допустимые условия",
   1.7
  ],
  [
   "status",
   "Оценка",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.3
  ]
 ],
 "cleaning": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.85
  ],
  [
   "cleaningType",
   "Вид уборки",
   1.1
  ],
  [
   "zone",
   "Участок / инвентарь",
   1.5
  ],
  [
   "cleaningMethod",
   "Способ / средство",
   2.2
  ],
  [
   "result",
   "Итог",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.1
  ],
  [
   "notes",
   "Замечание",
   1.3
  ]
 ],
 "receiving": [
  ["at","Дата и время",1.05],
  ["point","Точка",0.72],
  ["supplier","Поставщик",1.05],
  ["productBatch","Товар / партия / накладная",1.75],
  ["quantity","Кол-во",0.8],
  ["receivedTemperature","Факт / границы, °C",1.0],
  ["expiryDay","Годен до",0.9],
  ["checks","Упаковка / маркировка / документы / качество",2.3],
  ["decision","Решение",0.75],
  ["owner","Принял",1.0]
 ],
 "storage": [
  ["at","Дата и время",1.05],
  ["point","Точка",0.70],
  ["storageProductBatch","Продукт / категория / партия",1.75],
  ["storageZone","Зона хранения",1.0],
  ["startedAt","Приготовлено / вскрыто",1.2],
  ["useBy","Использовать до",1.15],
  ["storageReview","Условия / проверки",2.15],
  ["status","Результат",0.85],
  ["owner","Ответственный",1.0]
 ],
 "audit": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   1
  ],
  [
   "checks",
   "Пункты проверки",
   4.5
  ],
  [
   "status",
   "Результат",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.35
  ],
  [
   "notes",
   "Замечания",
   1.7
  ]
 ],
 "cooking": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.8
  ],
  [
   "product",
   "Блюдо / партия",
   1.5
  ],
  [
   "stage",
   "Этап обработки",
   1.25
  ],
  [
   "measured",
   "Факт, °C",
   0.9
  ],
  [
   "limits",
   "Критерий",
   1.6
  ],
  [
   "status",
   "Оценка",
   0.9
  ],
  [
   "owner",
   "Ответственный",
   1.25
  ]
 ],
 "defrosting": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.8
  ],
  [
   "product",
   "Продукт / партия",
   1.4
  ],
  [
   "method",
   "Способ",
   1.3
  ],
  [
   "startedAt",
   "Начало",
   1.3
  ],
  [
   "finishedAt",
   "Окончание",
   1.3
  ],
  [
   "measured",
   "Факт, °C",
   0.9
  ],
  [
   "owner",
   "Ответственный",
   1.25
  ]
 ],
 "frying": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.8
  ],
  [
   "equipment",
   "Фритюрница",
   1.3
  ],
  [
   "product",
   "Масло / партия",
   1.5
  ],
  [
   "checks",
   "Контроль качества",
   1.8
  ],
  [
   "decisionText",
   "Решение",
   1.7
  ],
  [
   "result",
   "Оценка",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.3
  ]
 ],
 "quality": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.8
  ],
  [
   "product",
   "Блюдо / партия",
   1.5
  ],
  [
   "quantity",
   "Количество",
   0.85
  ],
  [
   "checks",
   "Органолептическая оценка",
   2.3
  ],
  [
   "decisionText",
   "Решение",
   1.5
  ],
  [
   "result",
   "Результат",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.2
  ]
 ],
 "hygiene": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.8
  ],
  [
   "employee",
   "Сотрудник",
   1.4
  ],
  [
   "role",
   "Смена / должность",
   1.3
  ],
  [
   "checks",
   "Осмотр (без диагноза)",
   2
  ],
  [
   "decisionText",
   "Допуск к работе",
   1.6
  ],
  [
   "result",
   "Оценка",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.3
  ]
 ],
 "pests": [
  [
   "at",
   "Дата и время",
   1.2
  ],
  [
   "point",
   "Точка",
   0.8
  ],
  [
   "zone",
   "Контрольная зона",
   1.4
  ],
  [
   "checks",
   "Результат осмотра",
   2
  ],
  [
   "method",
   "Мероприятия",
   1.7
  ],
  [
   "reviewer",
   "Исполнитель",
   1.3
  ],
  [
   "result",
   "Оценка",
   1
  ],
  [
   "owner",
   "Ответственный",
   1.2
  ]
 ]
});
const status={ok:'Без замечаний',deviation:'Отклонение',unconfigured:'Не оценено'};
const values={done:'Выполнено',problem:'Замечание',accepted:'Принято',rejected:'Отказ',daily:'Текущая',general:'Генеральная',yes:'Да',no:'Нет',na:'Не применимо'};
const dateFields=new Set(['at','startedAt','finishedAt','expiry','useBy']);
const formattedTime=value=>{
 if(value===null||value===undefined||value==='')return '—';
 const date=new Date(value);
 return Number.isFinite(date.getTime())?
  date.toLocaleString('ru-RU',{timeZone:'Europe/Moscow',year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):String(value);
};
export function paperColumns(kind){
 const definition=journalPaperColumns[kind];
 if(!definition)throw Error('Неизвестный вид журнала ХАССП.');
 return definition.map(([key,label,weight])=>({key,label,weight}));
}
export function paperCell(record,key,points=[],{draft=false}={}){
 const details=record?.details||{};
 const point=points.find(p=>p.id===record.pointId)?.name||record.pointId||'—';
 let value;
 if(key==='point')value=point;
 else if(key==='status')value=draft?'Черновик':status[record.status]||'Не оценено';
 else if(key==='owner')value=record.owner;
 else if(key==='notes')value=record.notes;
 else if(key==='productBatch')value=[
  details.product,details.batch&&'Партия: '+details.batch,
  details.invoice&&'Док.: '+details.invoice
 ].filter(Boolean).join('\n');
 else if(key==='expiryDay'){
  const expiry=details.expiry;
  if(!expiry)return '—';
  const date=new Date(expiry);
  return Number.isFinite(date.getTime())?
   date.toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}):'—';
 }
 else if(key==='storageProductBatch'){
  const groups={raw:'Сырьё',semifinished:'Полуфабрикат',prepared:'Готовая продукция',opened:'Вскрытое',other:'Прочее'};
  value=[details.product,groups[details.storageType],
   details.batch&&'Партия: '+details.batch].filter(Boolean).join('\n');
 }
 else if(key==='storageReview'){
  if(draft)return 'Черновик — требуется проверка фактических условий';
  const checks={ok:'Да',problem:'Нарушение'};
  value=[details.conditions,
   details.labelCheck&&'Маркировка: '+(checks[details.labelCheck]||details.labelCheck),
   details.conditionsCheck&&'Условия: '+(checks[details.conditionsCheck]||details.conditionsCheck)]
   .filter(Boolean).join('\n');
 }
 else if(key==='receivedTemperature'){
  if(details.measured===null||details.measured===undefined||details.measured==='')return 'Не измерена';
  const hasMin=details.min!==null&&details.min!==undefined&&String(details.min).trim()!=='';
  const hasMax=details.max!==null&&details.max!==undefined&&String(details.max).trim()!=='';
  const range=!hasMin&&!hasMax?'границы не заданы':
   !hasMin?'до '+details.max:!hasMax?'от '+details.min:details.min+' … '+details.max;
  return String(details.measured)+' °C; '+range;
 }
 else if(key==='temperatureLimits')value=
  details.min==null&&details.max==null?'Не заданы':
  (details.min==null?'до '+details.max:details.max==null?'от '+details.min:details.min+' … '+details.max);
 else if(key==='cleaningMethod')value=[details.method,details.agent,details.concentration&&'Конц.: '+details.concentration,details.exposure&&'Выдержка: '+details.exposure].filter(Boolean).join(' / ');
 else value=details[key]??record?.[key];
 if((key==='result'||key==='decision')&&draft)return 'Черновик';
 if(Array.isArray(value))value=value.map(item=>
  item&&typeof item==='object'?(item.label||'Пункт')+': '+(values[item.result]||item.result||'—'):String(item)
 ).join('; ');
 if(dateFields.has(key))return formattedTime(value);
 if(value===undefined||value===null||String(value).trim()==='')return '—';
 if(typeof value==='boolean')return value?'Да':'Нет';
 return String(values[value]??value).trim().slice(0,4000);
}
