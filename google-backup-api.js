import {validGoogleEndpoint} from './recipe-export-api.js';

// Browser data is backed up only through the owner's personally authorized Apps
// Script. Never log or return the endpoint, deployment ID, or connection key.
const failure=(reason,message,status=502)=>Object.assign(new Error(message),{reason,status});
const ERROR_HINTS={
 'invalid-endpoint':'Нужен адрес веб-приложения Google Apps Script, который начинается с https://script.google.com/macros/s/ и заканчивается на /exec. Ссылка на папку Google Диска не подходит.',
 'invalid-key-format':'Укажи ключ из журнала выполнения initializeBackup. Он длиннее 24 символов и находится в «Свойствах скрипта» под BACKUP_CONNECTION_KEY.',
 'google-access':'Google не разрешил открыть опубликованный скрипт. В Apps Script открой «Начать развертывание → Управление развертываниями», проверь «Выполнять от имени: Меня» и «Доступ: Все». Затем скопируй именно URL веб-приложения с /exec.',
 'google-not-found':'Google не нашёл веб-приложение. Открой Apps Script → «Управление развертываниями» и скопируй действующий URL, заканчивающийся на /exec.',
 'google-html':'Вместо ответа скрипта Google вернул веб-страницу. Проверь, что развернут тип «Веб-приложение» и доступ установлен «Все», а адрес взят из развертывания и заканчивается на /exec.',
 'google-key':'Адрес скрипта принят, но личный ключ не совпадает. В Google Apps Script открой ⚙️ «Настройки проекта» → «Свойства скрипта» → BACKUP_CONNECTION_KEY. Скопируй значение целиком, без пробелов.',
 'google-script':'Скрипт выполнился, но вернул ошибку. Открой Apps Script → «Выполнения» для подробностей. Проверь, что вставлен весь код FARRUH AI и опубликована его последняя версия.',
 'google-response':'Google ответил, но формат ответа неверный. Проверь, что в Apps Script вставлен код FARRUH AI для резервных копий (не код для техкарт), и заново разверни версию.',
 'google-network':'Не удалось связаться с Google. Попробуй повторить позже. Локальные данные не изменены.',
 'google-quota':'Google временно ограничил количество запросов. Попробуй ещё раз позже.',
};
export function installGoogleBackupApi(app,{request=fetch}={}){
 const actions=new Set(['check','backup','list','fetch']);
 app.post('/api/backups/google-drive',async(req,res)=>{
  try{
   const {endpoint,key,action,backupId,snapshot}=req.body||{};
   if(!validGoogleEndpoint(endpoint))
    throw failure('invalid-endpoint',ERROR_HINTS['invalid-endpoint'],400);
   if(typeof key!=='string'||key.length<24||key.length>200)
    throw failure('invalid-key-format',ERROR_HINTS['invalid-key-format'],400);
   if(!actions.has(action))
    throw failure('invalid-action','Неизвестная операция резервного копирования.',400);
   if(action==='fetch'&&(typeof backupId!=='string'||! /^[\w-]{15,130}$/.test(backupId)))
    throw failure('invalid-backup','Некорректный идентификатор резервной копии.',400);
   if(action==='backup'){
    const data=snapshot?.state;
    if(!snapshot||snapshot.version!==1||!data||typeof data!=='object'||Array.isArray(data)
     ||!['recipes','tasks','chat','inspections','preparations','haccp'].some(k=>data[k]!==undefined))
     throw failure('invalid-backup','Резервная копия не содержит данных приложения.',400);
    if(JSON.stringify(snapshot).length>7_500_000)
     throw failure('large-backup','Резервная копия слишком большая (максимум 7,5 МБ).',413);
    if(data.googleBackup||data.googleSync||data.googleDelivery)
     throw failure('secret-backup','Резервная копия не должна содержать ключи подключения.',400);
   }
   const packet={key,action,...(action==='backup'?{snapshot}:{}),...(action==='fetch'?{backupId}:{})};
   let response;
   try{
    response=await request(endpoint,{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify(packet),redirect:'follow',signal:AbortSignal.timeout(50000)
    });
   }catch{throw failure('google-network',ERROR_HINTS['google-network'])}
   if(response.status===401||response.status===403)
    throw failure('google-access',ERROR_HINTS['google-access']);
   if(response.status===404||response.status===410)
    throw failure('google-not-found',ERROR_HINTS['google-not-found']);
   if(response.status===429)
    throw failure('google-quota',ERROR_HINTS['google-quota']);
   if(!response.ok)
    throw failure('google-network',ERROR_HINTS['google-network']);
   const contentType=response.headers?.get?.('content-type')?.toLowerCase()||'';
   if(contentType.includes('text/html'))
    throw failure('google-html',ERROR_HINTS['google-html']);
   let result;
   try{result=await response.json()}catch{throw failure('google-response',ERROR_HINTS['google-response'])}
   if(!result||typeof result!=='object')
    throw failure('google-response',ERROR_HINTS['google-response']);
   if(result.ok!==true){
    const message=String(result.error||'');
    if(/ключ|key|secret/i.test(message))
     throw failure('google-key',ERROR_HINTS['google-key']);
    if(/доступ|permission|authoriz|access|scope/i.test(message))
     throw failure('google-access',ERROR_HINTS['google-access']);
    throw failure('google-script',ERROR_HINTS['google-script']);
   }
   if(action==='backup'&&(typeof result.id!=='string'||!result.id))
    throw failure('google-response','Google не подтвердил создание файла. Данные устройства не изменены.');
   if(action==='list'&&!Array.isArray(result.items))
    throw failure('google-response','Google не вернул список резервных копий.');
   if(action==='fetch'){
    const content=result?.snapshot;
    if(!content||content.version!==1||!content.state||typeof content.state!=='object')
     throw failure('google-response','Google вернул повреждённую резервную копию. Восстановление не выполнено.');
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
   const reason=error?.reason||'google-network';
   const message=error?.reason?error.message:ERROR_HINTS['google-network'];
   // Log only non-sensitive machine-readable reason, NEVER the submitted URL/key.
   console.error('[google-backup] action='+String(req.body?.action||'unknown').slice(0,24)+' reason='+reason);
   return res.status(error?.status||502).json({ok:false,error:message,reason});
  }
 });
}
