/* FARUKH KITCHEN · zero-dependency smoke checks. Run: node tests/farukh-kitchen-smoke.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../farukh-kitchen');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const srcs=[...html.matchAll(/<script\s+src="([^"?#]+)/g)].map(m=>m[1]);
assert.equal(srcs.length,12,'All 12 scripts must be present in index.html');
for(const asset of srcs)assert.ok(fs.existsSync(path.join(root,asset)), 'Missing JS: '+asset);
const scripts=srcs.map(asset=>fs.readFileSync(path.join(root,asset),'utf8'));
for(let i=0;i<scripts.length;i++)assert.doesNotThrow(()=>new vm.Script(scripts[i]),'Syntax error in '+srcs[i]);
const catalogSource=fs.readFileSync(path.join(root,'assets/catalog-data-4eebdc24d2d8.js'),'utf8');
const srcIndex=fs.readFileSync(path.join(root,'assets/ttk-source-index-20261029.js'),'utf8');
const doc={
 elements:new Map(),body:{style:{}},activeElement:null,
 getElementById(id){
  if(!this.elements.has(id))this.elements.set(id,{innerHTML:'',textContent:'',style:{},focus(){},
   addEventListener(){},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){}});
  return this.elements.get(id);
 },
 addEventListener(){},querySelectorAll(){return []},querySelector(){return null}
};
const store={getItem(){return null},setItem(){}};
const context=vm.createContext({
 document:doc,window:{addEventListener(){},scrollTo(){}},
 location:{hash:'#home'},history:{pushState(){}},localStorage:store,
 URLSearchParams,structuredClone,Intl,JSON,Array,Number,Object,String,Set,Map,Math,
 setTimeout,clearTimeout,Date,console
});
for(const script of scripts)vm.runInContext(script,context,{timeout:15000});
const data=vm.runInContext('PROJECT_CATALOG.map(p=>({id:p.id,name:p.name,cat:p.cat,plans:p.plans,yieldGrams:p.yieldGrams}))',context);
const sourceKeys=vm.runInContext('Object.keys(window.FK_TTK_SOURCE_INDEX)',context);
assert.equal(data.length,59);
assert.equal(new Set(data.map(x=>x.id)).size,59);
assert.equal(sourceKeys.length,45);
assert.equal(data.filter(x=>x.plans.includes('start')).length,44);
assert.equal(data.filter(x=>x.plans.includes('pro')).length,59);
assert.equal(data.filter(x=>x.cat==='Онигири').length,4);
assert.ok(data.filter(x=>x.cat==='Онигири').every(x=>x.yieldGrams===120));
for(const page of ['home','recipes','prep','calculator','packages','how','saved','workspace','buyer']){
 vm.runInContext('route('+JSON.stringify(page)+')',context,{timeout:15000});
 assert.ok(doc.getElementById('main').innerHTML.length>400,'Empty page: '+page);
}
for(const tab of ['overview','orders','files','company']){
 vm.runInContext('state.page="buyer";state.buyerTab='+JSON.stringify(tab)+';render()',context,{timeout:15000});
 const html=doc.getElementById('main').innerHTML;
 assert.ok(html.includes('Защищённый вход пока не подключён'), 'Must disclose prelaunch status');
 assert.ok(html.includes('aria-selected="true"'), 'Buyer tab not selected: '+tab);
 assert.ok(!html.includes('href="assets/private'), 'Do not publish direct private TTK links');
}
vm.runInContext('showPackageCatalog("start")',context,{timeout:15000});
assert.ok(doc.getElementById('main').innerHTML.includes('Найдено: 44'));
vm.runInContext('showPackageCatalog("pro")',context,{timeout:15000});
assert.ok(doc.getElementById('main').innerHTML.includes('Найдено: 59'));
vm.runInContext('state.catalogView="samples";render()',context,{timeout:15000});
assert.ok(doc.getElementById('main').innerHTML.includes('Образцы ТТК'));
vm.runInContext('registryDetails("FK-001")',context,{timeout:15000});
assert.ok(doc.getElementById('modal-root').innerHTML.includes('Филадельфия'));
const photos=[];
for(const text of scripts)for(const x of text.matchAll(/assets\/photos\/[a-z0-9.-]+\.webp/g))photos.push(x[0]);
assert.equal(photos.length,21,'Native photos should not be lost or duplicated');
for(const src of photos)assert.ok(fs.existsSync(path.join(root,src)),'Missing WebP '+src);
const forbidden=fs.readdirSync(root,{recursive:true}).filter(x=>/\.(pdf|zip|docx|xlsx)$/i.test(x));
assert.deepEqual(forbidden,[],'Private source documents cannot be inside the public website');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/package-manifest-20261030.json'),'utf8'));
assert.equal(manifest.purchaseEnabled,false);
assert.equal(manifest.loginEnabled,false);
assert.equal(manifest.packages.start.sourceTtkCount,33);
assert.equal(manifest.packages.pro.sourceTtkCount,45);
console.log('PASS · FARUKH KITCHEN: 12 scripts, 9 pages, 4 buyer tabs, 59 products, 21 WebP, private files absent, START/PRO closed.');
