// FARUKH AI — opt-in, read-only bridges from existing TTK storage to retail labels.
// No edits to source TTK, Google documents, or backup snapshots.
const fields=['protein','fat','carbs','kcal'];
const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const norm=value=>String(value??'').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g,' ');
const listed=value=>Array.isArray(value)?value:[];

export function approvedRecipes(state){
  const ready=new Map();
  for(const recipe of listed(state?.releasedRecipes)){
    if(recipe?.status==='ready'&&recipe.id&&recipe.name&&!ready.has(recipe.id))ready.set(recipe.id,recipe);
  }
  for(const recipe of listed(state?.recipes)){
    if(recipe?.status==='ready'&&recipe.id&&recipe.name&&!ready.has(recipe.id))ready.set(recipe.id,recipe);
  }
  return [...ready.values()].filter(r=>r.category!=='Полуфабрикаты');
}

export function recipeToLabel(recipe){
  const ingredients=listed(recipe.ingredients).map(i=>String(i?.name??'').trim()).filter(Boolean);
  const composition=ingredients.join(', ');
  // Nutrition must come from the saved recipe's own calculated/manual per-100g values.
  // Never invent calories/macros for an ingredient or extrapolate a portion from unknown yield.
  const n=recipe.nutrition||{};
  const val=k=>numeric(n[k])?Number(n[k]):null;
  const weight=numeric(recipe.netYieldGrams)&&Number(recipe.netYieldGrams)>0?Number(recipe.netYieldGrams):null;
  const name=String(recipe.name||'').trim();
  return {
    id:'ttk-'+String(recipe.id),ttkId:String(recipe.id),ttkSource:'device',
    name,composition,
    p:val('protein'),f:val('fat'),c:val('carbs'),kcal:val('kcal'),
    weight,tolerance:10,
    // Approved defaults for this label design are NOT claims extracted from the TTK.
    hours:12,storage:'+2…+6 °C',
    source:'ttk',needsReview:true,manualEdited:false,
    ttkSignature:JSON.stringify([name,composition,weight,...fields.map(k=>val(k)),recipe.status,recipe.category]),
    sourceChanged:false
  };
}
const sampleIsUntouched=p=>p?.id==='philadelphia'&&p.name==='Ролл Филадельфия'&&p.composition==='рис, нори, сыр творожный, огурец, форель'&&p.p===7&&p.f===10.2&&p.c===15.5&&p.kcal===183&&p.weight===275&&p.hours===12&&p.tolerance===10&&p.storage==='+2…+6 °C';

export function combineWithTTKs(existing,recipes,{source='device'}={}){
  const products=[...listed(existing)];
  const stats={added:0,updated:0,unchanged:0,conflicts:0,changed:0,total:recipes.length};
  for(const recipe of recipes){
    if(!recipe||!recipe.id||!recipe.name)continue;
    const imported=recipeToLabel(recipe);imported.ttkSource=source;
    const ix=products.findIndex(x=>x.ttkId===String(recipe.id));
    if(ix>=0){
      const old=products[ix];
      if(old.ttkSignature===imported.ttkSignature){stats.unchanged++;continue}
      if(old.manualEdited){
        products[ix]={...old,sourceChanged:true};
        stats.changed++;
        continue;
      }
      products[ix]={...imported,id:old.id,hours:old.hours??12,storage:old.storage||'+2…+6 °C',tolerance:old.tolerance??10,needsReview:true};
      stats.updated++;
      continue;
    }
    const sameIndex=products.findIndex(x=>norm(x.name)===norm(imported.name));
    if(sameIndex>=0){
      // Replace only the untouched demonstration card. Never override a user's real product.
      if(sampleIsUntouched(products[sameIndex])){
        products[sameIndex]={...imported,id:products[sameIndex].id};
        stats.updated++;
      }else stats.conflicts++;
      continue;
    }
    products.push(imported);stats.added++;
  }
  return {products,stats};
}

export async function loadDeviceState(){
  if(!globalThis.indexedDB)throw Error('На этом устройстве недоступно хранилище техкарт.');
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('farrukh-ai-device',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records')};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('Не удалось открыть техкарты на устройстве.'));
    request.onblocked=()=>reject(Error('Закрой другие вкладки FARUKH AI и попробуй снова.'));
  });
  try{
    return await new Promise((resolve,reject)=>{
      if(!db.objectStoreNames.contains('records'))return reject(Error('На устройстве нет сохранённых техкарт.'));
      const tx=db.transaction('records','readonly'),request=tx.objectStore('records').get('state');
      let value;
      request.onsuccess=()=>value=request.result;
      tx.oncomplete=()=>resolve(value||{});
      tx.onerror=tx.onabort=()=>reject(Error('Не удалось прочитать техкарты.'));
    });
  }finally{db.close()}
}
export async function deviceReadyRecipes(){
  const state=await loadDeviceState();
  return {recipes:approvedRecipes(state),source:'device'};
}

export async function googleBackupReadyRecipes(){
  const device=await loadDeviceState(),config=device.googleBackup;
  if(!config?.endpoint||!config?.key)throw Error('Резервное копирование Google Диска не настроено на этом устройстве. Настрой его в FARUKH AI → Настройки и данные → Google Диск.');
  const request=async(action,extra={})=>{
    const r=await fetch('/api/backups/google-drive',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({endpoint:config.endpoint,key:config.key,action,...extra}),
      signal:AbortSignal.timeout(35000)
    });
    let answer;try{answer=await r.json()}catch{throw Error('Google вернул неподдерживаемый ответ.')}
    if(!r.ok||answer.ok===false)throw Error(answer.error||answer.message||'Не удалось получить копию Google Диска.');
    return answer;
  };
  const listing=await request('list');
  const items=listed(listing.items).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
  const latest=items.find(x=>typeof x.id==='string'&&/^[\w-]{15,130}$/.test(x.id));
  if(!latest)throw Error('В Google Диске пока нет резервных копий техкарт.');
  const result=await request('fetch',{backupId:latest.id});
  const snapshot=result.snapshot?.state||result.snapshot;
  if(!snapshot||!Array.isArray(snapshot.recipes))throw Error('В копии Google нет списка техкарт.');
  return {recipes:approvedRecipes(snapshot),source:'google',backupDate:latest.createdAt||''};
}
