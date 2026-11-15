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

 const removed=Array.isArray(value.deletedRecipeIds)?value.deletedRecipeIds:[];
 if(removed.length>4000||removed.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(id)))
  throw httpError(400,'Повреждён список удалённых ТТК.');
 result.deletedRecipeIds=[...new Set(removed)];
 if(result.deletedRecipeIds.length){
  const deleted=new Set(result.deletedRecipeIds);
  for(const field of ['recipes','releasedRecipes'])result[field]=result[field].filter(item=>!deleted.has(item.id));
 }
 const size=Buffer.byteLength(JSON.stringify(result),'utf8');
 if(size>MAX_BYTES)throw httpError(413,'Слишком большой объём для синхронизации. Сохраните локальную копию и уменьшите размер фотографий.');
 return result;
}

export function installDeviceSyncApi(app,{store,auth}){
 // Require a signed owner session even if a legacy passwordless flag is set.
 app.use('/api/device-sync',(req,res,next)=>{
  const token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('fai_owner='))?.slice('fai_owner='.length)||'';
  if(!auth?.enabled||!auth.verify(token))return res.status(401).json({ok:false,error:'Требуется вход владельца.'});
  next();
 });
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
 app.delete('/api/device-sync/recipes/:recipeId',async(req,res)=>{
  try{
   if(!durable)throw httpError(503,'Для удаления нужен доступ к постоянному облачному хранилищу.');
   const recipeId=req.params.recipeId;
   if(typeof recipeId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(recipeId))
    throw httpError(400,'Неверный идентификатор ТТК.');
   const expected=req.body?.revision;
   if(!Number.isSafeInteger(expected)||expected<0)throw httpError(400,'Требуется актуальная версия облака.');
   const updated=await store.transaction(async()=>{
    const current=await store.read(FILE,{revision:0,snapshot:null,updatedAt:null});
    if(current.revision!==expected)throw httpError(409,'Облако изменилось. Обновите список и подтвердите удаление ещё раз.');
    if(!current.snapshot)throw httpError(404,'Облачная база пуста.');
    const existing=safeSnapshot(current.snapshot);
    const found=(existing.recipes||[]).some(r=>r.id===recipeId)||(existing.releasedRecipes||[]).some(r=>r.id===recipeId);
    if(!found)throw httpError(404,'Такой ТТК в общей облачной базе нет.');
    const next=safeSnapshot({...existing,
      recipes:existing.recipes.filter(r=>r.id!==recipeId),
      releasedRecipes:existing.releasedRecipes.filter(r=>r.id!==recipeId),
      deletedRecipeIds:[...(existing.deletedRecipeIds||[]),recipeId]});
    const output={revision:expected+1,snapshot:next,updatedAt:new Date().toISOString()};
    // Keep old revision for emergency recovery and do not touch independent backups.
    await store.write('device-sync-previous-v1.json',current);
    await store.write(FILE,output);
    return output;
   });
   res.setHeader('Cache-Control','no-store');
   res.json({ok:true,recipeId,deleted:true,revision:updated.revision});
  }catch(e){res.status(e.status||503).json({ok:false,error:e.message||'Не удалось удалить из облачной базы.'});}
 });
 app.put('/api/device-sync',async(req,res)=>{
  try{
   if(!durable)throw httpError(503,'Нужно постоянное облачное хранилище.');
   const supplied=req.body||{},expected=supplied.revision;
   if(!Number.isSafeInteger(expected)||expected<0)throw httpError(400,'Нет версии облачных данных.');
   const submitted=safeSnapshot(supplied.snapshot);
   const next=await store.transaction(async()=>{
    const current=await store.read(FILE,{revision:0,snapshot:null,updatedAt:null});
    if(current.revision!==expected)throw httpError(409,'Данные изменились на другом устройстве. Повторяем объединение.');
    // Older app versions may omit tombstones. Never let them restore a recipe
    // deliberately deleted by the owner in this cloud workspace.
    const snapshot=safeSnapshot({...submitted,deletedRecipeIds:[
     ...(current.snapshot?.deletedRecipeIds||[]),...(submitted.deletedRecipeIds||[])
    ]});
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
