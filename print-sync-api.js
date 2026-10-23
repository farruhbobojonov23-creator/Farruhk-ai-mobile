// FARUKH PRINT protected synchronization: independently stored catalog and
// revocable device permissions. Never mixes with FARUKH AI TTK or HACCP.
// Storage reuses the existing YandexAssistantStore through assistant.store.
// A Render free ephemeral disk is NOT a safe database: fail closed without
// Yandex cloud or an explicitly configured persistent installation.
import crypto from 'node:crypto';
import {installPrintStaffApi} from './print-staff-api.js';

const FILE_CATALOG='farukh-print-catalog.json';
const FILE_DEVICES='farukh-print-devices.json';
const MAX_PRODUCTS=1000;
const MAX_JSON=1024*1024;
const printableChars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const error=(status,message)=>Object.assign(new Error(message),{status});
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const sameOrigin=req=>{
  const origin=req.get('origin');
  if(!origin)return true; // Native WebView/Android requests may not send Origin.
  try{const u=new URL(origin);return u.protocol==='https:'&&u.host===req.get('host')}catch{return false}
};
const cookie=req=>String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('fai_owner='))?.slice(10)||'';
function validateCatalog(data){
  if(!Array.isArray(data)||data.length>MAX_PRODUCTS)throw error(400,'База этикеток превышает допустимый размер.');
  const names=new Set();
  return data.map(p=>{
    if(!p||!['ready','prep'].includes(p.kind)||typeof p.name!=='string'||!p.name.trim()||p.name.length>90)throw error(400,'Некорректное название или тип этикетки.');
    const kind=p.kind,name=p.name.trim(),storage=String(p.storage||'').slice(0,60);
    const needsReview=p.needsReview===true;
    const key=kind+'|'+name.toLocaleLowerCase('ru');
    if(names.has(key))throw error(400,'В каталоге есть повторяющиеся названия.');names.add(key);
    let hours=p.hours===null||p.hours===undefined||p.hours===''?null:Number(p.hours);
    if(hours!==null&&(!Number.isSafeInteger(hours)||hours<1||hours>8760))throw error(400,'Неверный срок годности «'+name+'».');
    if(!needsReview&&(!storage||hours===null))throw error(400,'Для готовой к печати этикетки необходим подтверждённый срок и хранение: '+name);
    const clean={id:typeof p.id==='string'&&p.id.length<=150?p.id:crypto.randomUUID(),kind,name,storage,hours,
      needsReview,point:String(p.point||'').slice(0,40)};
    // User-selected JPG thumbnail, aggressively compressed on device. Photos
    // are not printed on thermal labels and never bypass expiry approval.
    if(p.photo!==undefined&&p.photo!==''){
      if(typeof p.photo!=='string'||p.photo.length>45000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.photo))
        throw error(400,'Фотография «'+name+'» должна быть сжата до 45 КБ в JPEG. Попробуй выбрать её повторно.');
      clean.photo=p.photo;
    }
    if(typeof p.recipeMemo==='string')clean.recipeMemo=p.recipeMemo.slice(0,1000);
    if(kind==='ready'){
      clean.composition=String(p.composition||'').slice(0,600);
      for(const field of ['p','f','c','kcal','weight','tolerance']){
        const val=p[field];
        clean[field]=val===null||val===undefined||val===''?null:Number(val);
        if(clean[field]!==null&&(!Number.isFinite(clean[field])||clean[field]<0))throw error(400,'Неверный показатель '+field+' у '+name);
      }
      if(!needsReview&&(!clean.composition||['p','f','c','kcal','weight','tolerance'].some(k=>clean[k]===null)||clean.weight<=0))throw error(400,'Не заполнен состав/КБЖУ готовой этикетки '+name);
    }
    return clean;
  });
}
const safeDevice=d=>({id:d.id,name:d.name,createdAt:d.createdAt,lastSeenAt:d.lastSeenAt||null,revoked:!!d.revoked});
const digits=(len)=>Array.from(crypto.randomBytes(len),b=>printableChars[b%printableChars.length]).join('');
export function installPrintSyncApi(app,{store,auth,readyCatalogImport}){
  const persistent=store?.storage==='yandex'||process.env.FARUKH_PRINT_PERSISTENT_STORAGE==='true';
  const enabled=!!persistent&&!!auth?.enabled; // do not bypass owner password in passwordless mode
  const pending=new Map(),attempts=new Map();
  const readCatalog=async()=>{
    const data=await store.read(FILE_CATALOG,{revision:0,products:[],updatedAt:null});
    if(!data||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.products))throw error(503,'База FARUKH PRINT повреждена: изменения запрещены.');
    return data;
  };
  let importPromise;
  const ensureReadyCatalog=async()=>{
    if(!enabled||!readyCatalogImport)return;
    if(!importPromise)importPromise=store.transaction(async()=>{
      const current=await readCatalog();
      if(current.appliedImports?.includes(readyCatalogImport.version))return;
      const products=validateCatalog(readyCatalogImport.merge(current.products));
      await store.write(FILE_CATALOG,{...current,products,revision:current.revision+1,
        appliedImports:[...(current.appliedImports||[]),readyCatalogImport.version],updatedAt:new Date().toISOString()});
    }).catch(e=>{importPromise=null;throw e});
    await importPromise;
  };
  const readDevices=async()=>{
    const data=await store.read(FILE_DEVICES,[]);
    if(!Array.isArray(data))throw error(503,'Список устройств повреждён.');
    return data;
  };
  const protectOwner=(req,res,next)=>{
    if(!enabled)return res.status(503).json({ok:false,error:'Онлайн-синхронизация требует защищённого входа владельца и постоянного облачного хранилища (Яндекс Диск).'});
    if(!auth.verify(cookie(req)))return res.status(401).json({ok:false,error:'Сначала войди в FARUKH AI как владелец.'});
    if(!['GET','HEAD'].includes(req.method)&&!sameOrigin(req))return res.status(403).json({ok:false,error:'Запрос с другого сайта запрещён.'});
    next();
  };
  const protectDevice=async(req,res,next)=>{
    if(!enabled)return res.status(503).json({ok:false,error:'Онлайн-синхронизация ещё не настроена владельцем.'});
    const token=String(req.get('X-Farukh-Print-Device')||'');
    if(!/^[a-zA-Z0-9_-]{43,90}$/.test(token))return res.status(401).json({ok:false,error:'Устройство не подключено.'});
    try{
      const devices=await readDevices(),entry=devices.find(d=>d.hash===sha(token)&&!d.revoked);
      if(!entry)return res.status(403).json({ok:false,error:'Доступ устройства отключён владельцем.'});
      req.farukhPrintDevice=entry;
      await ensureReadyCatalog();
      next();
    }catch(e){res.status(e.status||503).json({ok:false,error:'Не удалось подтвердить устройство.'})}
  };
  const wrap=fn=>async(req,res)=>{try{await ensureReadyCatalog();await fn(req,res)}catch(e){console.error('[farukh-print-sync]',e.status||503,e.message);res.status(e.status||503).json({ok:false,error:e.status?e.message:'Хранилище временно недоступно. Изменения не опубликованы.'})}};
  app.get('/api/farukh-print/sync/status',(req,res)=>res.json({ok:true,enabled,permanent:!!persistent,ownerConfigured:!!auth?.enabled}));
  app.get('/api/farukh-print/admin/catalog',protectOwner,wrap(async(req,res)=>{
    const catalog=await readCatalog();res.set('Cache-Control','no-store');res.json({ok:true,...catalog});
  }));
  app.put('/api/farukh-print/admin/catalog',protectOwner,wrap(async(req,res)=>{
    if(JSON.stringify(req.body||{}).length>MAX_JSON)throw error(413,'Каталог слишком большой.');
    const incoming=validateCatalog(req.body?.products);
    const revision=req.body?.revision;
    if(!Number.isSafeInteger(revision)||revision<0)throw error(400,'Отсутствует версия каталога.');
    const next=await store.transaction(async()=>{
      const current=await readCatalog();
      if(current.revision!==revision)throw error(409,'Каталог изменён в другом окне. Обнови данные перед публикацией.');
      const newState={...current,revision:revision+1,products:incoming,updatedAt:new Date().toISOString()};
      await store.write(FILE_CATALOG,newState);return newState;
    });
    res.json({ok:true,...next});
  }));
  app.get('/api/farukh-print/admin/devices',protectOwner,wrap(async(req,res)=>{
    res.set('Cache-Control','no-store');res.json({ok:true,devices:(await readDevices()).map(safeDevice)});
  }));
  app.post('/api/farukh-print/admin/pair',protectOwner,wrap(async(req,res)=>{
    for(const [key,row] of pending)if(row.expires<Date.now())pending.delete(key);
    if(pending.size>=20)throw error(429,'Слишком много активных приглашений.');
    const code=digits(12),expires=Date.now()+10*60*1000;
    pending.set(sha(code),{expires});
    res.json({ok:true,code,expiresAt:new Date(expires).toISOString(),message:'Введи этот код на телефоне или планшете FARUKH PRINT в течение 10 минут.'});
  }));
  app.delete('/api/farukh-print/admin/devices/:id',protectOwner,wrap(async(req,res)=>{
    const list=await store.transaction(async()=>{
      const found=await readDevices();const d=found.find(x=>x.id===req.params.id);
      if(!d)throw error(404,'Устройство не найдено.');
      d.revoked=true;d.revokedAt=new Date().toISOString();
      await store.write(FILE_DEVICES,found);return found;
    });
    res.json({ok:true,devices:list.map(safeDevice)});
  }));
  app.post('/api/farukh-print/device/pair',wrap(async(req,res)=>{
    if(!enabled)throw error(503,'Владелец ещё не включил защищённую синхронизацию.');
    if(!sameOrigin(req))throw error(403,'Запрос с другого сайта запрещён.');
    const ip=req.ip,now=Date.now(),attempt=attempts.get(ip)||{n:0,end:now+600000};
    if(attempt.end<now){attempt.n=0;attempt.end=now+600000}
    if(++attempt.n>12){attempts.set(ip,attempt);throw error(429,'Слишком много попыток. Подожди 10 минут.')}
    attempts.set(ip,attempt);
    const code=String(req.body?.code||'').replace(/[\s-]/g,'').toUpperCase();
    if(!/^[A-Z2-9]{12}$/.test(code))throw error(400,'Код состоит из 12 символов.');
    const key=sha(code),ticket=pending.get(key);
    if(!ticket||ticket.expires<now)throw error(401,'Код не подходит или срок действия истёк.');
    pending.delete(key);attempts.delete(ip);
    const name=String(req.body?.name||'Android FARUKH PRINT').trim().slice(0,60)||'Android FARUKH PRINT';
    const token=crypto.randomBytes(32).toString('base64url');
    const createdAt=new Date().toISOString();
    const device={id:crypto.randomUUID(),hash:sha(token),name,createdAt,lastSeenAt:createdAt,revoked:false};
    try{
      await store.transaction(async()=>{
        const list=await readDevices();
        if(list.filter(x=>!x.revoked).length>=30)throw error(429,'Превышено количество подключённых устройств.');
        list.push(device);await store.write(FILE_DEVICES,list);
      });
    }catch(e){pending.set(key,ticket);throw e}
    res.set('Cache-Control','no-store');res.json({ok:true,token,device:safeDevice(device)});
  }));
  app.get('/api/farukh-print/device/catalog',protectDevice,wrap(async(req,res)=>{
    const state=await readCatalog();
    res.set('Cache-Control','no-store');res.json({ok:true,...state,device:safeDevice(req.farukhPrintDevice)});
    const device=req.farukhPrintDevice;
    // Connection heartbeat is not a print confirmation. Update no more than every five minutes.
    if(Date.now()-Date.parse(device.lastSeenAt||0)>5*60*1000){
      void store.transaction(async()=>{
        const rows=await readDevices(),found=rows.find(d=>d.id===device.id&&!d.revoked);
        if(found){found.lastSeenAt=new Date().toISOString();await store.write(FILE_DEVICES,rows)}
      }).catch(e=>console.warn('[farukh-print-last-seen]',e.status||'unavailable'));
    }
  }));
  installPrintStaffApi(app,{store,auth,enabled,protectDevice,readCatalog});
}
