import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedRecipes,recipeToLabel,combineWithTTKs} from '../public/label-ttk-sync.js';

const recipe=(overrides={})=>({
 id:'recipe-1',name:'Ролл Филадельфия',category:'Холодные роллы',status:'ready',
 netYieldGrams:275,ingredients:[{name:'рис'},{name:'сыр творожный'},{name:'огурец'}],
 nutrition:{protein:7,fat:10.2,carbs:15.5,kcal:183},...overrides
});
const sample={
 id:'philadelphia',name:'Ролл Филадельфия',
 composition:'рис, нори, сыр творожный, огурец, форель',
 p:7,f:10.2,c:15.5,kcal:183,weight:275,tolerance:10,
 hours:12,storage:'+2…+6 °C'
};
test('only ready finished-good TTK and last approved archive are imported',()=>{
 const saved=recipe();
 const result=approvedRecipes({
   recipes:[saved,recipe({id:'draft',status:'draft'}),recipe({id:'prep',category:'Полуфабрикаты'})],
   releasedRecipes:[recipe({id:'old',name:'Последняя утверждённая версия'})]
 });
 assert.deepEqual(result.map(x=>x.id),['old','recipe-1']);
});
test('map only TTK fields and never invent missing net weight or nutrition',()=>{
 const converted=recipeToLabel(recipe({nutrition:{protein:0,fat:null,carbs:2,kcal:undefined},netYieldGrams:null}));
 assert.equal(converted.p,0);
 assert.equal(converted.f,null);
 assert.equal(converted.kcal,null);
 assert.equal(converted.weight,null);
 assert.equal(converted.needsReview,true);
 assert.equal(converted.storage,'+2…+6 °C');
});
test('pristine demonstration is replaced, but other manual label is preserved',()=>{
 const a=combineWithTTKs([sample],[recipe()]);
 assert.equal(a.products.length,1);
 assert.equal(a.products[0].ttkId,'recipe-1');
 assert.equal(a.products[0].needsReview,true);
 assert.equal(a.products[0].composition,'рис, сыр творожный, огурец');
 const b=combineWithTTKs([({...sample,id:'custom',p:8})],[recipe()]);
 assert.equal(b.products[0].p,8);
 assert.equal(b.stats.conflicts,1);
});
test('import stays idempotent and respects reviewed manual edits',()=>{
 const first=combineWithTTKs([],[recipe()]).products;
 assert.equal(combineWithTTKs(first,[recipe()]).products.length,1);
 const reviewed={...first[0],manualEdited:true,needsReview:false,composition:'Свой утверждённый состав'};
 const updated=combineWithTTKs([reviewed],[recipe({nutrition:{protein:8,fat:10,carbs:11,kcal:200}})]);
 assert.equal(updated.products[0].composition,'Свой утверждённый состав');
 assert.equal(updated.products[0].sourceChanged,true);
 assert.equal(updated.products[0].kcal,183);
});
test('stale Google backup cannot override a device recipe',()=>{
 const local=combineWithTTKs([],[recipe()]).products;
 const backup=combineWithTTKs(local,[recipe({name:'Старое название'})],{source:'google'});
 assert.equal(backup.products[0].name,'Ролл Филадельфия');
 assert.equal(backup.stats.unchanged,1);
});
