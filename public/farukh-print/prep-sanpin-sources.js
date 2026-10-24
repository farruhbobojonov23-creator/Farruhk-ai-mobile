// Read-only source guidance for Japanese kitchen prep shelf life.
// Applicable norms DO NOT waive the owner's responsibility for a documented
// food safety assessment and manufacturer instructions. No auto-approval.
(()=>{
'use strict';
const source='https://base.garant.ru/4179307/';
const current='https://legalacts.ru/doc/postanovlenie-glavnogo-gosudarstvennogo-sanitarnogo-vracha-rf-ot-02062026-n_1/';
const food='https://sudact.ru/law/reshenie-komissii-tamozhennogo-soiuza-ot-09122011-n_2/tr-ts-0212011/glava-2/statia-7/';
const direct={
 'дайкон (нарезка)':{hours:12,temp:'+2…+6 °C',clause:'Приложение 1, п. 82',category:'Обработанные, нарезанные редис и редька',warning:'Соответствие этой заготовки позиции таблицы и условиям производства подтверждает технолог.'},
 'лук зеленый (нарезка)':{hours:18,temp:'+2…+6 °C',clause:'Приложение 1, п. 84',category:'Лук зелёный обработанный',warning:'Это справочный срок для обработанного лука; внутренний более короткий срок 12 часов не противоречит этому ориентиру.'}
};
const analogous={
 'форель':{clause:'Приложение 1, п. 40',category:'Филе рыбное — 24 ч при 0…−2 °C',warning:'Это НЕ готовая норма для размороженной форели при +2…+6 °C. Проверь маркировку и ТТК.'},
 'лосось (размороженный)':{clause:'Приложение 1, п. 40',category:'Филе рыбное — 24 ч при 0…−2 °C',warning:'Нельзя переносить срок на размороженное филе при другой температуре.'},
 'креветка':{clause:'Приложение 1, п. 53',category:'Варёные креветки — 12 ч при +2…+6 °C',warning:'В карточке неизвестно, сырая креветка или варёная. Для сырой не применять.'},
 'снежный краб':{clause:'Приложение 1, п. 54',category:'Структурированные изделия (крабовые палочки и др.) — 48 ч',warning:'Не относится автоматически к продукту после вскрытия, сурими неизвестного состава и температуры.'},
 'соус спайси':{clause:'Приложение 1, п. 93',category:'Соусы и заправки для вторых блюд — 48 ч',warning:'Вид соуса, рецептура майонеза, отсутствие нагрева и фактическая технология требуют отдельного подтверждения.'}
};
const norm=name=>String(name||'').toLocaleLowerCase('ru').trim().replace(/ё/g,'е');
const get=name=>{
 const key=norm(name),d=direct[key],a=analogous[key];
 if(d)return {...d,kind:'direct',source,current,food};
 if(a)return {...a,kind:'analogy',source,current,food};
 return {kind:'individual',source,current,food,
  category:'Для точной заготовки нет однозначного сопоставления с санитарной таблицей',
  warning:'Срок назначается и подтверждается по утверждённой ТТК, технологии, условиям хранения и маркировке производителя. 12 ч — предложение, а не норма СанПиН.'};
};
window.FarukhPrepShelfReference={get,source,current,food};
})();
