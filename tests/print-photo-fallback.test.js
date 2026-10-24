import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {photoFor} from '../public/farukh-print/supplemental-photos.js';

// Execute the actual owner's displayPhoto function with browser dependencies
// supplied as arguments. Do not duplicate implementation in a test helper.
const source=await fs.readFile(new URL('../public/print-control.js',import.meta.url),'utf8');
const match=source.match(/ function displayPhoto\(p\)\{([\s\S]*?)\n \}\n function loadPhotoAssets\(\)/);
assert.ok(match,'Could not locate FARUKH AI catalog's displayPhoto');
const compute=new Function('p','window','cloudPhotos','photoKey','text','brothPhoto','supplementalPhotos','readyPhotos',match[1]);
const isPhoto=value=>value===''||(typeof value==='string'&&value.length<=45000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
const createContext=(name,{local='',remote='',supplemental={photoFor},broth='',ready=null}={})=>{
 const p={id:'test-'+name,kind:'prep',name,photo:local};
 const remoteMap=new Map(remote?[[p.id,remote]]:[]);
 return compute(p,{FarukhPrintPhotos:{isPhoto}},remoteMap,x=>x.kind+'|'+x.name.toLocaleLowerCase('ru'),x=>String(x||'').trim(),broth,supplemental,ready);
};

test('Empty photo fields never hide installed cucumber and omelet photos',()=>{
 for(const name of ['Огурцы','Омлет']){
  const valid=photoFor({kind:'prep',name});
  assert.match(valid,/^data:image\/jpeg;base64,/);
  assert.equal(createContext(name),valid,'Catalog photo was lost for '+name);
 }
});
test('Owner photo wins; cloud photo wins over stock fallback, and empty remains empty only without fallbacks',()=>{
 const base=photoFor({kind:'prep',name:'Огурцы'});
 const owner=photoFor({kind:'prep',name:'Омлет'});
 assert.equal(createContext('Огурцы',{local:owner}),owner);
 assert.equal(createContext('Огурцы',{remote:owner}),owner);
 assert.equal(createContext('Огурцы',{supplemental:{photoFor:()=>''}}),'');
 assert.equal(createContext('Бульон Том Ям',{supplemental:{photoFor:()=>''},broth:base}),base);
});
