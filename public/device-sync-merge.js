// Three-way reconciliation: old shared baseline, this device, and latest cloud.
// Never replace a local record merely because another device has an older copy.
export const LIST_FIELDS=Object.freeze(['recipes','releasedRecipes','preparations','tasks','inspections','memory','myRecipeTemplates','categories']);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const index=items=>new Map((Array.isArray(items)?items:[]).map(x=>[x.id,x]));
const conflict=label=>{throw Error('Конфликт изменений: '+label+'. Данные обоих устройств сохранены. Требуется проверить эту запись перед повторной синхронизацией.')};

export function pickSyncSnapshot(state,projects){
 const snapshot={};
 for(const key of LIST_FIELDS)snapshot[key]=structuredClone(Array.isArray(state?.[key])?state[key]:[]);
 if(state?.siteSettings)snapshot.siteSettings=structuredClone(state.siteSettings);
 const raw=projects?.projects;
 snapshot.projectCatalog={projects:structuredClone(Array.isArray(raw)?raw.map(p=>({id:p.id,name:p.name})):[])};
 return snapshot;
}

function mergedItems(field,baseline,local,remote){
 const a=index(baseline),b=index(local),c=index(remote),out=[];
 const ids=new Set([...a.keys(),...b.keys(),...c.keys()]);
 for(const id of ids){
  const old=a.get(id),left=b.get(id),right=c.get(id);
  let chosen;
  if(equal(left,right))chosen=left;
  else if(equal(left,old))chosen=right;
  else if(equal(right,old))chosen=left;
  else if(old===undefined&&left&&right&&['recipes','releasedRecipes','myRecipeTemplates'].includes(field)){
   // Two independently edited copies may share the same legacy ID. Keep both.
   out.push(structuredClone(right));
   out.push({...structuredClone(left),id:crypto.randomUUID(),name:(left.name||'Запись')+' (копия с другого устройства)'});
   continue;
  }
  else conflict(field+' / '+(left?.name||right?.name||id));
  if(chosen!==undefined)out.push(structuredClone(chosen));
 }
 return out;
}

function mergedObject(field,old,local,remote){
 if(equal(local,remote))return structuredClone(local);
 if(equal(local,old))return structuredClone(remote);
 if(equal(remote,old))return structuredClone(local);
 conflict(field);
}

export function reconcileSnapshots(baseline,local,remote){
 const base=baseline||{},ours=local||{},theirs=remote||{},result={};
 for(const key of LIST_FIELDS)
  result[key]=mergedItems(key,base[key],ours[key],theirs[key]);
 result.siteSettings=mergedObject('Настройки',base.siteSettings,ours.siteSettings,theirs.siteSettings);
 result.projectCatalog={projects:mergedItems('Проекты',base.projectCatalog?.projects,ours.projectCatalog?.projects,theirs.projectCatalog?.projects)};
 return result;
}
