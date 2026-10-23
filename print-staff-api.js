// Staff access for paired FARUKH PRINT devices. Owner controls accounts;
// employees may only authorize a print job for their assigned kitchen point.
// Password hashes persist in protected Yandex store, sessions are held only in
// process memory and expire after 12 hours / immediately upon account revocation.
import crypto from 'node:crypto';
const USERS='farukh-print-staff.json',HISTORY='farukh-print-staff-activity.json';
const EXPIRE=12*60*60*1000,MAX_STAFF=80,MAX_EVENTS=500;
const bad=(status,message)=>Object.assign(new Error(message),{status});
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const hash=(pass,salt)=>crypto.scryptSync(pass,salt,32,{N:16384,r:8,p:1}).toString('hex');
const userSafe=u=>({id:u.id,name:u.name,login:u.login,point:u.point,role:'Повар · только печать',active:u.active!==false,createdAt:u.createdAt});
const sameOrigin=req=>{
 const origin=req.get('origin');if(!origin)return true;
 try{return new URL(origin).origin==='https://'+req.get('host')}catch{return false}
};
const ownerCookie=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('fai_owner='))?.slice(10)||'';
const trim=(v,n)=>String(v||'').trim().slice(0,n);
export function installPrintStaffApi(app,{store,auth,enabled,protectDevice,readCatalog}){
 const sessions=new Map(),limits=new Map();
 const readUsers=async()=>{
  const data=await store.read(USERS,[]);
  if(!Array.isArray(data)||data.some(x=>!x||typeof x.id!=='string'||typeof x.passhash!=='string'))throw bad(503,'Файл учётных записей повреждён.');
  return data;
 };
 const safe=fn=>async(req,res)=>{try{await fn(req,res)}catch(e){console.warn('[print-staff]',e.status||500,e.message);res.status(e.status||503).json({ok:false,error:e.status?e.message:'Сервис временно недоступен.'})}};
 const owner=(req,res,next)=>{
  if(!enabled)return res.status(503).json({ok:false,error:'Нужны постоянное облако и авторизация владельца.'});
  if(!auth.verify(ownerCookie(req)))return res.status(401).json({ok:false,error:'Сначала войди в FARUKH AI как владелец.'});
  if(!['GET','HEAD'].includes(req.method)&&!sameOrigin(req))return res.status(403).json({ok:false,error:'Неверный источник запроса.'});
  next();
 };
 const requireStaff=async(req,res,next)=>{
  const credential=String(req.get('X-Farukh-Print-Staff')||'');
  if(!/^[A-Za-z0-9_-]{43}$/.test(credential))return res.status(401).json({ok:false,error:'Нужен вход сотрудника.'});
  const id=sha(credential),session=sessions.get(id);
  if(!session||session.until<=Date.now()||session.deviceId!==req.farukhPrintDevice.id){
   sessions.delete(id);return res.status(401).json({ok:false,error:'Сеанс сотрудника завершён. Войди снова.'});
  }
  try{
   const user=(await readUsers()).find(x=>x.id===session.userId&&x.active!==false);
   if(!user){sessions.delete(id);return res.status(403).json({ok:false,error:'Доступ сотрудника отключён владельцем.'})}
   req.farukhStaff=user;req.farukhSession=id;next();
  }catch(e){return res.status(e.status||503).json({ok:false,error:'Не удалось проверить права сотрудника.'})}
 };
 const staffRate=(req,res,next)=>{
  const key=trim(req.ip||'unknown',100)+':'+trim(req.body?.login,32).toLowerCase();
  const now=Date.now();let row=limits.get(key);
  if(!row||row.until<now)row={n:0,until:now+15*60*1000};
  row.n++;limits.set(key,row);
  if(limits.size>1200)for(const [k,v] of limits)if(v.until<now)limits.delete(k);
  if(row.n>7)return res.status(429).json({ok:false,error:'Слишком много попыток. Повтори через 15 минут.'});
  next();
 };
 app.get('/api/farukh-print/admin/staff',owner,safe(async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({ok:true,staff:(await readUsers()).map(userSafe)});
 }));
 app.post('/api/farukh-print/admin/staff',owner,safe(async(req,res)=>{
  const name=trim(req.body?.name,65),login=trim(req.body?.login,32).toLowerCase(),point=trim(req.body?.point,60);
  if(!name||name.length<2||!point||point.length<2||!/^[a-z][a-z0-9_-]{2,31}$/.test(login))throw bad(400,'Нужны имя, точка и логин латиницей (3–32 символа).');
  const password=token().slice(0,16);const salt=crypto.randomBytes(16).toString('hex');
  const user={id:crypto.randomUUID(),name,login,point,passhash:hash(password,salt),salt,active:true,createdAt:new Date().toISOString()};
  await store.transaction(async()=>{
   const all=await readUsers();if(all.length>=MAX_STAFF)throw bad(409,'Достигнут лимит сотрудников.');
   if(all.some(x=>x.login===login))throw bad(409,'Этот логин уже занят.');
   all.push(user);await store.write(USERS,all);
  });
  res.set('Cache-Control','no-store');res.status(201).json({ok:true,staff:userSafe(user),password,warning:'Пароль показывается только сейчас. Сохрани его и передай сотруднику лично.'});
 }));
 app.post('/api/farukh-print/admin/staff/:id/reset',owner,safe(async(req,res)=>{
  const password=token().slice(0,16),salt=crypto.randomBytes(16).toString('hex');
  let target;
  await store.transaction(async()=>{
   const all=await readUsers();target=all.find(x=>x.id===req.params.id);
   if(!target)throw bad(404,'Сотрудник не найден.');
   target.salt=salt;target.passhash=hash(password,salt);target.active=true;
   await store.write(USERS,all);
  });
  for(const [key,session] of sessions)if(session.userId===target.id)sessions.delete(key);
  res.set('Cache-Control','no-store');res.json({ok:true,staff:userSafe(target),password});
 }));
 app.post('/api/farukh-print/admin/staff/:id/status',owner,safe(async(req,res)=>{
  if(typeof req.body?.active!=='boolean')throw bad(400,'Не указан статус сотрудника.');
  let target;
  await store.transaction(async()=>{
   const all=await readUsers();target=all.find(x=>x.id===req.params.id);if(!target)throw bad(404,'Сотрудник не найден.');
   target.active=req.body.active;await store.write(USERS,all);
  });
  if(!target.active)for(const [key,session] of sessions)if(session.userId===target.id)sessions.delete(key);
  res.json({ok:true,staff:userSafe(target)});
 }));
 app.get('/api/farukh-print/admin/staff/activity',owner,safe(async(req,res)=>{
  const entries=await store.read(HISTORY,[]);
  if(!Array.isArray(entries))throw bad(503,'Журнал действий повреждён.');
  res.set('Cache-Control','no-store');
  res.json({ok:true,events:entries.slice(-70).reverse()});
 }));
 app.post('/api/farukh-print/device/staff/login',protectDevice,staffRate,safe(async(req,res)=>{
  if(!sameOrigin(req))throw bad(403,'Неверный источник запроса.');
  const login=trim(req.body?.login,32).toLowerCase(),password=String(req.body?.password||'');
  if(!/^[a-z][a-z0-9_-]{2,31}$/.test(login)||password.length<8||password.length>180)throw bad(401,'Неверный логин или пароль.');
  const account=(await readUsers()).find(x=>x.login===login&&x.active!==false);
  const salt=account?.salt||'0'.repeat(32);
  const expected=account?.passhash||'0'.repeat(64);
  const actual=hash(password,salt);
  if(!crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'))||!account)throw bad(401,'Неверный логин или пароль.');
  for(const [k,v] of sessions)if(v.until<Date.now())sessions.delete(k);
  const session=token();
  sessions.set(sha(session),{userId:account.id,deviceId:req.farukhPrintDevice.id,until:Date.now()+EXPIRE});
  res.set('Cache-Control','no-store');
  res.json({ok:true,session,expiresAt:new Date(Date.now()+EXPIRE).toISOString(),staff:userSafe(account)});
 }));
 app.get('/api/farukh-print/device/staff/session',protectDevice,requireStaff,safe(async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({ok:true,staff:userSafe(req.farukhStaff)});
 }));
 app.post('/api/farukh-print/device/staff/logout',protectDevice,requireStaff,safe(async(req,res)=>{
  sessions.delete(req.farukhSession);res.json({ok:true});
 }));
 app.post('/api/farukh-print/device/staff/authorize-print',protectDevice,requireStaff,safe(async(req,res)=>{
  if(!sameOrigin(req))throw bad(403,'Неверный источник запроса.');
  const productId=trim(req.body?.productId,150),copies=Number(req.body?.copies),point=trim(req.body?.point,60);
  const printedAt=String(req.body?.printedAt||'');
  if(!Number.isSafeInteger(copies)||copies<1||copies>20||point!==req.farukhStaff.point||!Number.isFinite(Date.parse(printedAt)))throw bad(403,'Нельзя печатать на другой точке или с неверными данными.');
  const list=await readCatalog(),product=list.products.find(x=>x.id===productId);
  if(!product||product.needsReview===true||!product.storage||!Number.isInteger(product.hours)||product.hours<=0)throw bad(403,'Этикетка отсутствует в утверждённой облачной базе или не проверена.');
  const item={id:crypto.randomUUID(),at:new Date().toISOString(),status:'Запрос печати (не подтверждение физической печати)',staff:req.farukhStaff.name,
    login:req.farukhStaff.login,point:req.farukhStaff.point,product:product.name,copies,device:req.farukhPrintDevice.name};
  await store.transaction(async()=>{
   const events=await store.read(HISTORY,[]);
   if(!Array.isArray(events))throw bad(503,'Журнал действий повреждён.');
   events.push(item);await store.write(HISTORY,events.slice(-MAX_EVENTS));
  });
  res.set('Cache-Control','no-store');res.json({ok:true,eventId:item.id,staff:userSafe(req.farukhStaff)});
 }));
}
