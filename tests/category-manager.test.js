import test from 'node:test';
import assert from 'node:assert/strict';
import {categoriesFor,updateCategory,deleteCategory} from '../public/category-model.js';
import {validateCategories} from '../public/category-validation.js';
import {validateDeviceState,mergeDeviceState} from '../public/device-store.js';
import {cleanState} from '../assistant-store.js';
import {edgeMask} from '../public/product-photo.js';
test('Rename preserves linked recipes, duplicates fail, deleting requires a valid transfer destination',()=>{
 const s={recipes:[{id:'r',name:'Ролл',category:'Холодные роллы',ingredients:[]}]},c=categoriesFor(s)[0];
 updateCategory(s,{...c,name:'Мои роллы'});assert.equal(s.recipes[0].category,'Мои роллы');
 assert.throws(()=>updateCategory(s,{id:'new',name:'мои роллы'}));
 assert.throws(()=>deleteCategory(s,c.id));assert.equal(s.recipes.length,1);
 deleteCategory(s,c.id,'Полуфабрикаты');assert.equal(s.recipes[0].category,'Полуфабрикаты');assert.ok(!categoriesFor(s).some(x=>x.id===c.id));
 assert.equal(categoriesFor(s).length,10);
});
test('Categories and images survive device backups, imports and cloud sanitation',()=>{
 const categories=[{id:'c',name:'Своё',image:'data:image/png;base64,aGVsbG8=',visible:false,color:'#e8eef5',scale:1.2}];
 const state=validateDeviceState({recipes:[],categories});assert.deepEqual(cleanState(state).categories,categories);
 assert.deepEqual(mergeDeviceState({recipes:[]},state).categories,categories);
 assert.throws(()=>validateCategories([{...categories[0],image:'javascript:alert(1)'}]));
 assert.throws(()=>validateDeviceState({recipes:[],categories:[categories[0],categories[0]]}));
});
test('Background removal preserves dark enclosed product pixels and rejects complex edges',()=>{
 const w=7,h=7,data=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)data[i*4+3]=255;
 for(let y=2;y<=4;y++)for(let x=2;x<=4;x++){const i=(y*w+x)*4;data[i]=255;data[i+1]=255;data[i+2]=255}
 const center=(3*w+3)*4;data[center]=data[center+1]=data[center+2]=0;
 assert.equal(edgeMask(data,w,h),true);assert.equal(data[3],0);assert.equal(data[center+3],255);
 const complex=new Uint8ClampedArray(20*20*4);for(let i=0;i<400;i++){complex[i*4]=i%2?255:0;complex[i*4+3]=255}assert.equal(edgeMask(complex,20,20),false);
});
