import {AssistantStore,ownerAuth,httpError} from './assistant-store.js';
import crypto from 'node:crypto';
import {YandexAssistantStore} from './assistant-cloud-store.js';

export function installAssistantApi(app,{multer,ExcelJS,migrateState}){
  const store=process.env.YANDEX_DISK_TOKEN&&!process.env.ASSISTANT_DATA_DIR?new YandexAssistantStore(process.env.YANDEX_DISK_TOKEN):new AssistantStore(process.env.ASSISTANT_DATA_DIR||'./data/assistant');
  console.log('[assistant-storage] provider='+store.storage+' cloudConfigured='+Boolean(process.env.YANDEX_DISK_TOKEN));
  const auth=ownerAuth({password:process.env.ASSISTANT_PASSWORD,secret:process.env.ASSISTANT_SESSION_SECRET});
  const cookie=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('fai_owner='))?.slice(10)||'';
  const trustedOrigin=req=>{try{return !req.headers.origin||new URL(req.headers.origin).host===req.get('host')}catch{return false}};
  const wrap=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){if(e.status)res.status(e.status).json({ok:false,error:e.message,...(e.state?{state:e.state}:{})});else{console.error('[assistant]',e.message);res.status(500).json({ok:false,error:'Не удалось выполнить операцию. Данные не подтверждены как сохранённые.'})}}};
  let initialization;
  function initialize(){if(!initialization)initialization=(async()=>{const current=await store.state();if(current.revision===0&&migrateState){const old=await migrateState();if(old&&(old.tasks?.length||old.memory?.length||old.chat?.length))await store.save({...old,revision:0})}})().catch(e=>{initialization=null;throw httpError(503,'Не удалось проверить прежнее облачное хранилище. Повторите позже, чтобы не потерять данные.')});return initialization}
  const attempts=new Map();
  app.get('/api/auth/session',(req,res)=>res.json({configured:auth.enabled,authenticated:auth.verify(cookie(req))}));
  app.post('/api/auth/login',wrap(async(req,res)=>{
    if(!trustedOrigin(req))throw httpError(403,'Запрос отклонён');
    const key=req.ip,now=Date.now(),bucket=attempts.get(key)||{count:0,expires:now+600000};
    if(bucket.expires<now){bucket.count=0;bucket.expires=now+600000}
    if(++bucket.count>10)throw httpError(429,'Повторите вход через 10 минут.');attempts.set(key,bucket);
    const token=auth.login(req.body?.password);attempts.delete(key);
    const secure=req.secure||req.headers['x-forwarded-proto']==='https';
    res.setHeader('Set-Cookie',`fai_owner=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure?'; Secure':''}`);res.json({ok:true});
  }));
  app.post('/api/auth/logout',(req,res)=>{if(!trustedOrigin(req))return res.sendStatus(403);res.setHeader('Set-Cookie','fai_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true})});
  app.use((req,res,next)=>{
    const personal=/^\/api\/(?:state|backups|yandex|frontpad|analytics|chat|transcribe|status|documents|push)(?:\/|$)/.test(req.path);
    if(!personal)return next();
    if(!auth.enabled)return res.status(503).json({error:'Вход владельца не настроен.'});
    if(!auth.verify(cookie(req)))return res.status(401).json({error:'Войдите в личный ассистент.'});
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!trustedOrigin(req))return res.sendStatus(403);
    next();
  });
  app.get('/api/state',wrap(async(req,res)=>{await initialize();res.json({ok:true,state:await store.state()})}));
  app.put('/api/state',wrap(async(req,res)=>{await initialize();res.json({ok:true,state:await store.save(req.body||{})})}));
  app.get('/api/backups',wrap(async(req,res)=>res.json({ok:true,storage:store.storage,backups:await store.backups()})));
  app.post('/api/backups',wrap(async(req,res)=>{await initialize();res.json({ok:true,backup:await store.backup()})}));
  app.post('/api/backups/restore',wrap(async(req,res)=>{await initialize();res.json({ok:true,state:await store.restore(String(req.body?.path||''),req.body?.revision)})}));

  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}}).single('file');
  app.get('/api/documents',wrap(async(req,res)=>{const docs=await store.read('documents.json',[]);res.json({ok:true,documents:docs.map(({text,...d})=>d)})}));
  app.get('/api/documents/:id',wrap(async(req,res)=>{const d=(await store.read('documents.json',[])).find(d=>d.id===req.params.id);if(!d)throw httpError(404,'Документ не найден');res.json({ok:true,document:d})}));
  app.post('/api/documents',(req,res,next)=>upload(req,res,e=>e?res.status(400).json({error:'Файл не принят. Максимум 10 МБ.'}):next()),wrap(async(req,res)=>{
    if(!req.file)throw httpError(400,'Выберите документ');
    const name=String(req.file.originalname).slice(0,200),ext=name.split('.').pop().toLowerCase();let text='';
    if(['txt','md','csv','json'].includes(ext))text=req.file.buffer.toString('utf8');
    else if(ext==='xlsx'){const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(req.file.buffer);workbook.eachSheet(sheet=>{text+='\nЛист: '+sheet.name+'\n';sheet.eachRow(row=>{text+=row.values.slice(1).map(v=>typeof v==='object'?JSON.stringify(v):String(v??'')).join(' | ')+'\n'})})}
    else if(ext==='pdf'){const {default:parse}=await import('pdf-parse/lib/pdf-parse.js');text=(await parse(req.file.buffer)).text}
    else if(ext==='docx'){const {default:mammoth}=await import('mammoth');text=(await mammoth.extractRawText({buffer:req.file.buffer})).value}
    else throw httpError(400,'Поддерживаются PDF, DOCX, TXT, MD, CSV, JSON и XLSX.');
    text=text.trim();if(!text)throw httpError(422,'Текст не найден. Для скана PDF нужен OCR; загрузите текстовую версию.');
    if(text.length>250000)throw httpError(413,'Слишком много текста: разделите документ на части.');
    const doc={id:crypto.randomUUID(),name,text,size:req.file.size,createdAt:new Date().toISOString()};
    await store.transaction(async()=>{const docs=await store.read('documents.json',[]);if(docs.length>=100)throw httpError(400,'Достигнут лимит 100 документов');await store.write('documents.json',[...docs,doc])});
    const {text:_,...metadata}=doc;res.json({ok:true,document:metadata});
  }));
  app.delete('/api/documents/:id',wrap(async(req,res)=>{await store.transaction(async()=>await store.write('documents.json',(await store.read('documents.json',[])).filter(d=>d.id!==req.params.id)));res.json({ok:true})}));

  let webpush=null;
  const pushConfigured=!!process.env.VAPID_PUBLIC_KEY&&!!process.env.VAPID_PRIVATE_KEY&&!!process.env.VAPID_SUBJECT;
  const pushReady=pushConfigured?import('web-push').then(({default:w})=>{w.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);webpush=w}).catch(e=>console.error('[push]',e.message)):Promise.resolve();
  app.get('/api/push/status',wrap(async(req,res)=>{await pushReady;res.json({configured:!!webpush,publicKey:webpush?process.env.VAPID_PUBLIC_KEY:null})}));
  app.post('/api/push/subscribe',wrap(async(req,res)=>{
    await pushReady;if(!webpush)throw httpError(503,'Доставка напоминаний не настроена на сервере.');
    const s=req.body;let url;try{url=new URL(s.endpoint)}catch{throw httpError(400,'Некорректная подписка')}
    const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns.windows.com'];
    if(url.protocol!=='https:'||url.port||url.username||url.password||!hosts.some(h=>url.hostname===h||url.hostname.endsWith('.'+h)))throw httpError(400,'Неизвестный сервер push');
    if(!/^[\w-]{80,100}$/.test(s.keys?.p256dh||'')||!/^[\w-]{20,30}$/.test(s.keys?.auth||''))throw httpError(400,'Некорректные ключи подписки');
    await store.transaction(async()=>{const items=await store.read('subscriptions.json',[]);await store.write('subscriptions.json',[...items.filter(x=>x.endpoint!==s.endpoint),{endpoint:s.endpoint,keys:s.keys}].slice(-10))});res.json({ok:true});
  }));
  let running=false;
  async function reminders(){
    if(running||!webpush)return;running=true;
    try{
      await initialize();const state=await store.state(),subscriptions=await store.read('subscriptions.json',[]);
      for(const task of state.tasks.filter(t=>!t.done&&t.due&&!t.notifiedAt&&Date.parse(t.due)<=Date.now())){
        let delivered=false;
        for(const s of subscriptions){try{await webpush.sendNotification(s,JSON.stringify({title:'FARRUKH AI · задача',body:task.text,tag:'task-'+task.id,url:'/?open=tasks'}),{TTL:86400,timeout:10000});delivered=true}catch(e){if([404,410].includes(e.statusCode))await store.transaction(async()=>await store.write('subscriptions.json',(await store.read('subscriptions.json',[])).filter(x=>x.endpoint!==s.endpoint)));else console.error('[reminder]',e.statusCode||e.message)}}
        if(delivered)await store.mutate(current=>{const latest=current.tasks.find(t=>t.id===task.id);if(latest&&!latest.done&&latest.due===task.due)latest.notifiedAt=new Date().toISOString()});
      }
    }catch(e){console.error('[reminders]',e.message)}finally{running=false}
  }
  const timer=setInterval(reminders,30000);timer.unref();
  let lastBackup=0;
  const backupTimer=setInterval(async()=>{try{if(Date.now()-lastBackup<6*3600000)return;await initialize();await store.backup('auto');lastBackup=Date.now()}catch(e){console.error('[backup]',e.message)}},60000);backupTimer.unref();
  return {store,auth};
}
