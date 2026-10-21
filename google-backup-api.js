import {validGoogleEndpoint} from './recipe-export-api.js';

// Browser data is backed up explicitly into the owner's Google Drive, through
// their personally deployed Apps Script receiver. No OAuth token is handled here.
export function installGoogleBackupApi(app,{request=fetch}={}){
 const actions=new Set(['check','backup','list','fetch']);
 app.post('/api/backups/google-drive',async(req,res)=>{
  try{
   const {endpoint,key,action,backupId,snapshot}=req.body||{};
   if(!validGoogleEndpoint(endpoint)||typeof key!=='string'||key.length<24||key.length>200)
    return res.status(400).json({error:'Проверь адрес подключения Google и ключ.'});
   if(!actions.has(action))return res.status(400).json({error:'Неизвестная операция резервного копирования.'});
   if(action==='fetch'&&(typeof backupId!=='string'||!/^[\w-]{15,130}$/.test(backupId)))
    return res.status(400).json({error:'Некорректный идентификатор резервной копии.'});
   if(action==='backup'){
    const data=snapshot?.state;
    if(!snapshot||snapshot.version!==1||!data||typeof data!=='object'||Array.isArray(data)
     ||!['recipes','tasks','chat','inspections','preparations','haccp'].some(k=>data[k]!==undefined))
     return res.status(400).json({error:'Резервная копия не содержит данных приложения.'});
    if(JSON.stringify(snapshot).length>7_500_000)
     return res.status(413).json({error:'Резервная копия слишком большая (максимум 7,5 МБ).'});
    // Connection credentials must stay only on the local device.
    if(data.googleBackup||data.googleSync||data.googleDelivery)
     return res.status(400).json({error:'Резервная копия не должна содержать ключи подключения.'});
   }
   const packet={key,action,...(action==='backup'?{snapshot}:{}),...(action==='fetch'?{backupId}:{})};
   const response=await request(endpoint,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(packet),redirect:'follow',signal:AbortSignal.timeout(50000)
   });
   if(!response.ok)throw Error('Google не ответил на запрос резервной копии.');
   const result=await response.json();
   if(result?.ok!==true)throw Error(String(result?.error||'Google не подтвердил операцию.').slice(0,230));
   if(action==='backup'&&(typeof result.id!=='string'||!result.id))throw Error('Google не подтвердил создание файла.');
   if(action==='list'&&!Array.isArray(result.items))throw Error('Google не вернул список копий.');
   if(action==='fetch'){
    const content=result?.snapshot;
    if(!content||content.version!==1||!content.state||typeof content.state!=='object')
     throw Error('Google вернул повреждённую резервную копию.');
   }
   res.set('Cache-Control','no-store');
   return res.json({ok:true,...(action==='check'?{folderName:String(result.folderName||'FARRUH AI — резервные копии')}:{}),
    ...(action==='backup'?{id:result.id,name:result.name,createdAt:result.createdAt}:{}),
    ...(action==='list'?{items:result.items.slice(0,100).map(item=>({
     id:String(item.id||''),name:String(item.name||'').slice(0,180),createdAt:String(item.createdAt||''),
     size:Number(item.size)||0
    }))}:{}),
    ...(action==='fetch'?{snapshot:result.snapshot}:{})
   });
  }catch(error){
   // Errors must not contain a Google script URL or connection credentials.
   console.error('[google-backup] action='+String(req.body?.action||'unknown').slice(0,24)+' status=failed');
   return res.status(502).json({error:'Не удалось выполнить операцию с Google Диском. Проверь подключение и попробуй позже. Локальные данные не изменены.'});
  }
 });
}
