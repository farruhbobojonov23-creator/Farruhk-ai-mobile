/* Render two truthful PDF previews from the production renderer.
   This file uses a synthetic recipe and an existing category photo.
   Never place private recipe data from connected Drive into a public CI artifact. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {premiumRecipePdf} from '../recipe-premium-pdf.js';
import {templateFor} from '../public/recipe-math.js';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'artifacts');await fs.mkdir(out,{recursive:true});
const photo=await fs.readFile(path.join(root,'public/assets/categories/cold.png'));
const recipe={
 ...templateFor('Холодные роллы',8),
 name:'ДЕМО · Холодный ролл',category:'Холодные роллы',pieces:8,
 cardNumber:'DEMO-01',cardDate:'2026-11-13',status:'draft',
 chef:'',approver:'',netYieldGrams:286,
 nutritionMode:'manual',nutrition:{protein:null,fat:null,carbs:null,kcal:null},
 ingredients:[
  {name:'Рис готовый',grams:130,grossGrams:130},
  {name:'Нори',grams:1,grossGrams:1},
  {name:'Сыр творожный',grams:65,grossGrams:65},
  {name:'Огурец',grams:30,grossGrams:30},
  {name:'Форель',grams:60,grossGrams:60}
 ],
 photo:'data:image/png;base64,'+photo.toString('base64')
};
const makeBytes=doc=>new Promise((resolve,reject)=>{
 const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);
 doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end();
});
const records=[];
for(const [id,label] of [['arctic-a4','Arctic-Glass'],['royal-a4','Royal-Blue']]){
 const d=premiumRecipePdf({...recipe,layoutTemplate:id});
 const scale=d.ttkLayoutScale;
 const bytes=await makeBytes(d);
 const parsed=await parsePdf(bytes);
 if(parsed.numpages!==1)throw Error('A4 output unexpectedly spans '+parsed.numpages+' pages');
 for(const term of ['ДЕМО','Форель','Разработал','Утверждаю','Пищевая ценность']){
  if(!parsed.text.includes(term))throw Error(id+' missing '+term);
 }
 const file=path.join(out,'ttk-demo-'+label+'.pdf');await fs.writeFile(file,bytes);
 records.push({id,label,file:'ttk-demo-'+label+'.pdf',pages:parsed.numpages,
  scale:+scale.toFixed(3),bytes:bytes.length,photo:'category sample; original background'});
}
await fs.writeFile(path.join(out,'ttk-demo-review.json'),JSON.stringify(records,null,2));
console.log('TTK_PDF_REVIEW '+JSON.stringify(records));
