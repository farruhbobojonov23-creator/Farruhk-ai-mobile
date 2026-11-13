import test from 'node:test';
import assert from 'node:assert/strict';
import {TTK_LAYOUTS,ttkLayoutId} from '../public/ttk-layouts.js';
import {cleanState} from '../assistant-store.js';
import {recipePdf} from '../recipe-pdf.js';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';

const recipe={
 id:'style-001',name:'Филадельфия классик',category:'Холодные роллы',
 cardNumber:'001',cardDate:'2026-11-13',status:'ready',pieces:8,netYieldGrams:265,
 ingredients:[
  {name:'Рис для суши',grams:130,grossGrams:130},
  {name:'Лосось',grams:60,grossGrams:60},
  {name:'Сливочный сыр',grams:55,grossGrams:55},
  {name:'Огурец',grams:20,grossGrams:20}
 ],
 scope:'Ролл по технологической карте',rawRequirements:'Сырьё безопасно.',
 preparation:'Подготовить рис и остальные компоненты.',forming:'Сформировать ролл.',serving:'Нарезать на восемь частей.',
 storage:'Условия и срок — по утверждённой ТТК.',appearance:'Ровные кусочки.',taste:'Без посторонних привкусов.',
 safety:'Проверить сырьё и условия хранения.',chef:'Шеф',approver:'Руководитель',
 nutritionMode:'manual',nutrition:{kcal:220,protein:8,fat:9,carbs:27},
 photo:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/OQAAAABJRU5ErkJggg=='
};
const pdfBytes=doc=>new Promise((resolve,reject)=>{const buffers=[];doc.on('data',chunk=>buffers.push(chunk));doc.on('end',()=>resolve(Buffer.concat(buffers)));doc.on('error',reject);doc.end()});

test('two approved visual options are selectable',()=>{
 assert.deepEqual(TTK_LAYOUTS.map(x=>x.id),['arctic-a4','royal-a4']);
 assert.equal(ttkLayoutId('royal-a4'),'royal-a4');
 assert.equal(ttkLayoutId('unknown'),'arctic-a4');
});

for(const layoutTemplate of ['arctic-a4','royal-a4']){
 test(layoutTemplate+' persists through normalization and produces readable one-page A4 PDF',async()=>{
  const input={...recipe,layoutTemplate};
  const normalized=cleanState({recipes:[input]}).recipes[0];
  assert.equal(normalized.layoutTemplate,layoutTemplate);
  assert.equal(normalized.photo,input.photo);
  const buffer=await pdfBytes(recipePdf(normalized));
  const output=await parsePdf(buffer);
  assert.equal(output.numpages,1);
  assert.match(output.text,/FARRUH AI/);
  assert.match(output.text,/Филадельфия классик/);
  assert.match(output.text,/ТЕХНОЛОГИЧЕСКАЯ КАРТА/);
  assert.match(output.text,/Разработал/);
  assert.match(output.text,/Утверждаю/);
  assert.match(output.text,/Лосось/);
 });
}
test('untrusted design or photo payload is not accepted by server normalization',()=>{
 const out=cleanState({recipes:[{...recipe,layoutTemplate:'evil-style',photo:'https://example.com/evil.png'}]}).recipes[0];
 assert.equal(out.layoutTemplate,'classic');
 assert.equal(out.photo,null);
});
