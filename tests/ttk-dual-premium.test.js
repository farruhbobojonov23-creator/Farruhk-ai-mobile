import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import {PREMIUM_TTK_THEMES} from '../public/ttk-premium-themes.js';
import {cleanState} from '../assistant-store.js';
import {premiumRecipePdf} from '../recipe-premium-pdf.js';
import {recipeWord} from '../recipe-word.js';

const example={
 name:'Филадельфия классик',cardNumber:'001',cardDate:'2026-11-19',
 category:'Холодные роллы',status:'ready',pieces:8,netYieldGrams:250,
 projectName:'Море Суши',scope:'Ролл для продажи в ресторане и доставке.',
 rawRequirements:'Использовать проверенное доброкачественное сырьё.',
 preparation:'Подготовить охлаждённые компоненты.',
 forming:'Сформировать ролл из риса, нори, лосося, сыра и огурца.',
 serving:'Нарезать на восемь равных частей.',
 storage:'Подавать в охлаждённом виде. Срок и температура хранения — по утверждённой документации предприятия.',
 appearance:'Ровная нарезка и однородная форма.',taste:'Характерный вкус и запах, без посторонних привкусов.',
 safety:'Контроль сырья и технологии по программе производственного контроля.',
 chef:'Шеф-повар',approver:'Руководитель',allergens:['fish','milk','soy'],
 nutritionMode:'manual',nutrition:{protein:9.8,fat:12.6,carbs:17.9,kcal:225},
 ingredients:[
  {name:'Рис для суши',grossGrams:120,grams:120},
  {name:'Лосось',grossGrams:65,grams:65},
  {name:'Сыр сливочный',grossGrams:40,grams:40},
  {name:'Огурец',grossGrams:23,grams:23},
  {name:'Нори',grossGrams:2,grams:2}
 ]
};
const pdfBytes=doc=>new Promise((resolve,reject)=>{
 const out=[];doc.on('data',b=>out.push(b));doc.on('end',()=>resolve(Buffer.concat(out)));doc.on('error',reject);doc.end();
});
for(const palette of PREMIUM_TTK_THEMES){
 test('approved premium palette '+palette.id+' saves and exports one A4 PDF with checked allergen data',async()=>{
  const r=cleanState({recipes:[{...example,layoutTemplate:palette.id}]}).recipes[0];
  assert.equal(r.layoutTemplate,palette.id);
  assert.deepEqual(r.allergens,['fish','milk','soy']);
  const doc=premiumRecipePdf(r);assert.ok(doc.ttkLayoutScale>=.78);
  const pdf=await parsePdf(await pdfBytes(doc));
  assert.equal(pdf.numpages,1,palette.name);
  for(const label of ['ОБЛАСТЬ ПРИМЕНЕНИЯ','ТРЕБОВАНИЯ К СЫРЬЮ','РЕЦЕПТУРА','ТЕХНОЛОГИЧЕСКИЙ','ПИЩЕВАЯ','АЛЛЕРГЕНЫ','РАЗРАБОТАЛ','УТВЕРЖДАЮ']){
   assert.ok(pdf.text.toUpperCase().includes(label),label);
  }
  assert.ok(pdf.text.includes('Огурец'));
 });
 test('same premium palette '+palette.id+' produces editable native Word',async()=>{
  const r=cleanState({recipes:[{...example,layoutTemplate:palette.id}]}).recipes[0];
  const bytes=await recipeWord(r);assert.equal(bytes.subarray(0,2).toString(),'PK');
  const result=await mammoth.extractRawText({buffer:bytes});
  for(const label of ['Филадельфия классик','РЕЦЕПТУРА','ТЕХНОЛОГИЧЕСКИЙ','АЛЛЕРГЕНЫ','Лосось','Рыба','Разработал'.toUpperCase()]){
   assert.ok(result.value.toUpperCase().includes(label.toUpperCase()),label);
  }
 });
}
test('malicious external logo and unknown allergens do not survive normalization',()=>{
 const saved=cleanState({recipes:[{...example,layoutTemplate:'emerald-gold-a4',brandLogo:'https://untrusted.example/p.png',allergens:['fish','unknown']}]}).recipes[0];
 assert.equal(saved.brandLogo,null);assert.deepEqual(saved.allergens,['fish']);
});
test('exceptionally dense premium PDF is rejected instead of microprinting or truncating',()=>{
 const r={...example,layoutTemplate:'emerald-gold-a4',ingredients:Array.from({length:140},(_,i)=>({name:'Ингредиент '+i,grossGrams:2,grams:2})),netYieldGrams:280};
 assert.throws(()=>premiumRecipePdf(r),error=>error?.status===422&&error?.code==='TTK_A4_TOO_DENSE');
});
