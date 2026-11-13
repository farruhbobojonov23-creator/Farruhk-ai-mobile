import {httpError} from './assistant-store.js';

// A separate, owner-only workspace. Never overwrite the legacy assistant state
// or a device's IndexedDB during initial migration.
const FILE='device-sync-v1.json';
const COLLECTIONS=['recipes','releasedRecipes','preparations','tasks','inspections','memory','myRecipeTemplates','categories'];
const MAX_BYTES=18*1024*1024;

function safeSnapshot(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw httpError(400,'Некорректный набор данных синхронизации.');
 const result={};
 for(const name of COLLECTIONS){
  if(name==='categories'&&value[name]===undefined)continue;
  const items=value[name]??[];
  if(!Array.isArray(items)||items.length>4000)throw httpError(400,'Повреждён раздел '+name);
  const ids=new Set();
  result[name]=items.map(item=>{
   if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.id!=='string'||!item.id||item.id.length>160||ids.has(item.id))throw httpError(400,'Некорректный ID в разделе '+name);
   ids.add(item.id);
   return item;
  });
 }
 if(value.siteSettings!==undefined){
  if(!value.siteSettings||typeof value.siteSettings!=='object'||Array.isArray(value.siteSettings))throw httpError(400,'Некорректные настройки.');
  result.siteSettings=value.siteSettings;
 }
 const catalog=value.projectCatalog||{};
 const projects=Array.isArray(catalog.projects)?catalog.projects:[];
 if(projects.length>100)throw httpError(400,'Слишком много проектов.');
 const ids=new Set();
 result.projectCatalog={projects:projects.map(project=>{
  if(!project||typeof project.id!=='string'||!/^[a-z0-9_-]{1,100}$/i.test(project.id)||ids.has(project.id)||typeof project.name!=='string'||!project.name.trim())throw httpError(400,'Некорректный каталог проектов.');
  ids.add(project.id);
  return {id:project.id,name:project.name.trim().slice(0,100)};
 })};
 const size=Buffer.byteLength(JSON.stringify(result),'utf8');
 if(size>MAX_BYTES)throw httpError(413,'Слишком большой объём для синхронизации. Сохраните локальную копию и уменьшите размер фотографий.');
 return result;
}

export function installDeviceSyncApi(app,{store}){
 // A local Render directory without a configured persistent path is not safe
 // as the single source of truth across deployments.
 const durable=store.storage==='yandex'||(process.env.DEVICE_SYNC_ISOLATED_TEST==='true'&&Boolean(process.env.ASSISTANT_DATA_DIR));
 app.get('/api/device-sync',async(req,res)=>{
  try{
   if(!durable)throw httpError(503,'Нужно подключить постоянное облачное хранилище для синхронизации.');
   const current=await store.read(FILE,{revision:0,snapshot:null,updatedAt:null});
   res.setHeader('Cache-Control','no-store');
   res.json({ok:true,revision:current.revision||0,snapshot:current.snapshot||null,updatedAt:current.updatedAt,storage:store.storage});
  }catch(e){res.status(e.status||503).json({ok:false,error:e.message||'Не удалось прочитать облачные данные.'});}
 });
 app.put('/api/device-sync',async(req,res)=>{
  try{
   if(!durable)throw httpError(503,'Нужно постоянное облачное хранилище.');
   const supplied=req.body||{},expected=supplied.revision;
   if(!Number.isSafeInteger(expected)||expected<0)throw httpError(400,'Нет версии облачных данных.');
   const snapshot=safeSnapshot(supplied.snapshot);
   const next=await store.transaction(async()=>{
    const current=await store.read(FILE,{revision:0,snapshot:null,updatedAt:null});
    if(current.revision!==expected)throw httpError(409,'Данные изменились на другом устройстве. Повторяем объединение.');
    const saved={revision:expected+1,snapshot,updatedAt:new Date().toISOString()};
    // Keep the last confirmed cloud revision for emergency recovery.
    if(current.snapshot&&current.revision>0)await store.write('device-sync-previous-v1.json',current);
    await store.write(FILE,saved);
    return saved;
   });
   res.setHeader('Cache-Control','no-store');
   res.json({ok:true,revision:next.revision,updatedAt:next.updatedAt});
  }catch(e){res.status(e.status||503).json({ok:false,error:e.message||'Облако не подтвердило сохранение.'});}
 });
}

export {safeSnapshot};
