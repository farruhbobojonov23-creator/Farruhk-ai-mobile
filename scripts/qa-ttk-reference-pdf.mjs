/* Public, synthetic four-layout reference fixture. Never exports user recipes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {recipePdf} from '../recipe-pdf.js';
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../artifacts');
await fs.mkdir(out,{recursive:true});
const ingredients=[
 {name:'Рис для суши готовый',grossGrams:120,grams:120},
 {name:'Нори (0,5 листа)',grossGrams:1.5,grams:1.5},
 {name:'Лосось (филе)',grossGrams:60,grams:60},
 {name:'Сыр творожный',grossGrams:50,grams:50},
 {name:'Огурец свежий',grossGrams:40,grams:38.5}
];
const recipe={
 name:'Филадельфия классик',category:'Холодные роллы',cardNumber:'001',
 cardDate:'2026-11-15',status:'draft',pieces:8,netYieldGrams:270,
 scope:'Технологическая карта ролла «Филадельфия классик» для предприятия общественного питания.',
 rawRequirements:'Сырьё используют в пределах срока годности по проверенным документам поставщиков.',
 preparation:'Подготовить охлаждённый рис, нори, лосось, сыр и огурец.',
 forming:'Равномерно распределить рис на нори. Выложить сыр и огурец. Сформовать ролл и покрыть лососем.',
 serving:'Нарезать на 8 равных частей. Подать по утверждённому стандарту.',
 storage:'Хранить при +2…+6 °C. Срок годности 12 часов с момента приготовления.',
 appearance:'Ровная форма и аккуратная нарезка, покрытие лососем.',
 taste:'Свойственный ингредиентам, свежий, без посторонних запахов.',
 safety:'Контроль сырья при приёмке. Соблюдение температурного режима. Проверка маркировки.',
 chef:'Шеф-технолог',approver:'Руководитель',
 nutritionMode:'manual',nutrition:{protein:6.6,fat:8.9,carbs:20,kcal:188.3},
 ingredients
};
const render=doc=>new Promise((resolve,reject)=>{
 const parts=[];doc.on('data',x=>parts.push(x));doc.on('error',reject);
 doc.on('end',()=>resolve(Buffer.concat(parts)));doc.end();
});
const rows=[];
for(const style of ['teal-matrix','process-matrix','gold-allergen','premium-blue']){
 const doc=recipePdf({...recipe,layoutTemplate:style});
 const data=await render(doc);
 const parsed=await parsePdf(data);
 if(parsed.numpages!==1)throw Error(style+': must be exactly one A4 page');
 if(doc.ttkLayoutScale<.74)throw Error(style+': unreadable '+doc.ttkLayoutScale);
 const file=path.join(out,'ttk-reference-'+style+'.pdf');
 await fs.writeFile(file,data);
 rows.push({style,pages:parsed.numpages,scale:doc.ttkLayoutScale,
  bytes:data.byteLength,ingredientCount:ingredients.length});
}
await fs.writeFile(path.join(out,'ttk-reference-review.json'),JSON.stringify(rows,null,2));
console.log('TTK_REFERENCE_A4='+JSON.stringify(rows));
