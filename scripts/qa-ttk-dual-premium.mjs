import fs from 'node:fs/promises';
import {PREMIUM_TTK_THEMES} from '../public/ttk-premium-themes.js';
import {premiumRecipePdf} from '../recipe-premium-pdf.js';
import {recipeWord} from '../recipe-word.js';
const demo={
 name:'Филадельфия классик — образец',cardNumber:'DEMO-001',cardDate:'2026-11-19',
 status:'draft',category:'Холодные роллы',pieces:8,netYieldGrams:250,projectName:'Образец предприятия',
 scope:'Демонстрационная ТТК на холодный ролл для предприятий общественного питания. Применение после утверждения рецептуры.',
 rawRequirements:'Сырьё должно отвечать применимым требованиям безопасности, иметь подтверждающие документы и контролируемые условия хранения.',
 preparation:'Подготовить сырьё и компоненты по утверждённой инструкции предприятия. Выполнить входной контроль.',
 forming:'Распределить подготовленный рис по нори, добавить сливочный сыр и огурец, сформировать ролл, покрыть лососем.',
 serving:'Нарезать на восемь равных частей. Контролировать массу и внешний вид.',
 storage:'Срок годности и температурный режим необходимо установить в утверждённых технологических документах предприятия, исходя из технологии, условий реализации и результатов оценки риска.',
 appearance:'Ровные кусочки ролла; компоненты распределены равномерно.',
 taste:'Свежий характерный вкус и запах, без посторонних привкусов.',
 safety:'Обеспечить контроль сырья, хранения и санитарной обработки в рамках производственного контроля и ХАССП.',
 chef:'',approver:'',allergens:['fish','milk','soy'],allergenOther:'',
 nutritionMode:'manual',nutrition:{protein:9.8,fat:12.6,carbs:17.9,kcal:225},
 ingredients:[
  {name:'Рис для суши, готовый',grams:120,grossGrams:120},
  {name:'Лосось, подготовленный',grams:65,grossGrams:65},
  {name:'Сливочный сыр',grams:40,grossGrams:40},
  {name:'Огурец',grams:23,grossGrams:23},
  {name:'Нори',grams:2,grossGrams:2}
 ]
};
await fs.mkdir('artifacts/ttk-dual',{recursive:true});
for(const [i,theme] of PREMIUM_TTK_THEMES.entries()){
 const r={...demo,layoutTemplate:theme.id},base='artifacts/ttk-dual/TTK-'+(i+1)+'-'+theme.tone;
 const pdf=premiumRecipePdf(r),parts=[];
 await new Promise((resolve,reject)=>{pdf.on('data',b=>parts.push(b));pdf.on('end',resolve);pdf.on('error',reject);pdf.end();});
 await fs.writeFile(base+'.pdf',Buffer.concat(parts));
 await fs.writeFile(base+'.docx',await recipeWord(r));
 console.log(JSON.stringify({theme:theme.id,scale:pdf.ttkLayoutScale,warnings:pdf.ttkWarnings,paths:[base+'.pdf',base+'.docx']}));
}
