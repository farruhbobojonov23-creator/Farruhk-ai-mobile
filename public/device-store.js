import {validateCategories} from './category-validation.js';
import {emptyHaccp,validateHaccp,mergeHaccp} from './haccp-model.js';
const blank=()=>({haccp:emptyHaccp(),tasks:[],memory:[],chat:[],recipes:[],inspections:[],tts:true,timeZone:'Europe/Moscow',revision:0,storage:'device'});
export function validateDeviceState(value){
 const state=value?.state??value;
 if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Неверный формат резервной копии.');
 for(const key of ['tasks','memory','chat','recipes','inspections'])if(state[key]!==undefined&&(!Array.isArray(state[key])||state[key].some(x=>!x||typeof x!=='object'||Array.isArray(x))))throw Error('Повреждён раздел: '+key);
 if(!['tasks','recipes','chat','inspections','memory'].some(k=>Array.isArray(state[k])))throw Error('В файле нет данных ассистента.');
 for(const recipe of state.recipes||[])if(typeof recipe.name!=='string'||!recipe.name.trim()||typeof recipe.id!=='string'||!Array.isArray(recipe.ingredients)||recipe.ingredients.some(i=>!i||typeof i.name!=='string'||!Number.isFinite(Number(i.grams))||Number(i.grams)<0))throw Error('Повреждена техкарта в резервной копии.');
 if(state.categories!==undefined)validateCategories(state.categories);
 return {...blank(),...structuredClone(state),haccp:validateHaccp(state.haccp),storage:'device'};
}
export function mergeDeviceState(current,incoming){
 const next=validateDeviceState(current),source=validateDeviceState(incoming);
 for(const key of ['tasks','memory','recipes','inspections']){
  const ids=new Set(next[key].map(x=>x.id));
  for(const item of source[key])if(!item.id||!ids.has(item.id)){next[key].push(item);ids.add(item.id)}
 }
 const turns=new Set(next.chat.map(x=>JSON.stringify([x.role,x.text])));
 for(const item of source.chat){const key=JSON.stringify([item.role,item.text]);if(!turns.has(key)){next.chat.push(item);turns.add(key)}}
 if(source.categories){const categories=next.categories||[];for(const category of source.categories)if(!categories.some(c=>c.id===category.id||c.name.toLocaleLowerCase('ru')===category.name.toLocaleLowerCase('ru')))categories.push(category);next.categories=categories}
 next.haccp=mergeHaccp(next.haccp,source.haccp);
 return next;
}
export class DeviceStore{
 constructor(factory=globalThis.indexedDB){this.factory=factory;this.connection=null}
 open(){
  if(!this.factory)return Promise.reject(Error('Браузер не поддерживает сохранение на устройстве.'));
  if(!this.connection)this.connection=new Promise((resolve,reject)=>{
   const request=this.factory.open('farrukh-ai-device',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('records');
   request.onerror=()=>{this.connection=null;reject(Error('Не удалось открыть данные устройства.'))};
   request.onblocked=()=>{this.connection=null;reject(Error('Закрой другие вкладки ассистента и повтори.'))};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.connection=null};resolve(db)};
  });return this.connection;
 }
 async load(){
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('records','readonly'),request=tx.objectStore('records').get('state');let result;
   request.onsuccess=()=>{try{result=request.result===undefined?blank():validateDeviceState(request.result)}catch(e){reject(e)}};
   tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(Error('Не удалось прочитать данные устройства.'));
  });
 }
 async mutate(change){
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('records','readwrite'),records=tx.objectStore('records'),request=records.get('state');let next,failure;
   request.onsuccess=()=>{try{const current=request.result===undefined?blank():validateDeviceState(request.result);next=structuredClone(current);change(next);next=validateDeviceState(next);next.revision=(Number(current.revision)||0)+1;next.updatedAt=new Date().toISOString();records.put(next,'state')}catch(e){failure=e;tx.abort()}};
   tx.oncomplete=()=>resolve(next);tx.onerror=tx.onabort=()=>reject(failure||Error('Не удалось сохранить на устройстве. Проверь свободное место и разрешения браузера.'));
  });
 }
}
