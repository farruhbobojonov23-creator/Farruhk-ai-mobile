// Staff access for paired FARUKH PRINT devices. Owner controls accounts;
// employees may only authorize a print job for their assigned kitchen point.
// Password hashes and device-bound hashed sessions persist in protected store.
// Every login and printing request checks staff expiry against server time.
import crypto from 'node:crypto';
import {getTemplate} from './public/farukh-print/haccp-catalog.js';
const USERS='farukh-print-staff.json',HISTORY='farukh-print-staff-activity.json',POINTS='farukh-print-points.json',SESSIONS='farukh-print-staff-sessions.json';
const MAX_STAFF=80,MAX_EVENTS=4000,MAX_SESSIONS=200;
const bad=(status,message)=>Object.assign(new Error(message),{status});
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const hash=(pass,salt)=>crypto.scryptSync(pass,salt,32,{N:16384,r:8,p:1}).toString('hex');
// Missing expiry on legacy employee records means indefinite access.
const expiryReached=(u,now=Date.now())=>!!u.expiresAt&&(!Number.isFinite(Date.parse(u.expiresAt))||Date.parse(u.expiresAt)<=now);
const canAccess=(u,now=Date.now())=>!!u&&u.active!==false&&!expiryReached(u,now);
const userSafe=u=>({id:u.id,name:u.name,login:u.login,point:u.point,role:'Повар · только печать',
 active:u.active!==false,accessAllowed:canAccess(u),expired:expiryReached(u),
 expiresAt:u.expiresAt||null,createdAt:u.createdAt});
const expiryFromDays=(days,now=Date.now())=>{
 if(days===null)return null;
 if(!Number.isInteger(days)||days<1||days>3650)throw bad(400,'Срок доступа должен быть от 1 до 3650 дней либо без ограничения.');
 return new Date(now+days*86400000).toISOString();
};
const accessDaysFromBody=(body,{creation=false}={})=>{
 if(!Object.prototype.hasOwnProperty.call(body||{},'accessDays')){
  if(creation)return null; // Keep older integrations working, no silent edits.
  throw bad(400,'Укажи срок доступа: число дней или «Без ограничения».');
 }
 return body.accessDays;
};
const sameOrigin=req=>{
 const origin=req.get('origin');if(!origin)return true;
 try{return new URL(origin).origin==='https://'+req.get('host')}catch{return false}
};
const ownerCookie=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('fai_owner='))?.slice(10)||'';
const trim=(v,n)=>String(v||'').trim().slice(0,n);
export function installPrintStaffApi(app,{store,auth,enabled,protectDevice,readCatalog}){
 const limits=new Map();
 const readSessions=async()=>{
  const entries=await store.read(SESSIONS,[]);
  if(!Array.isArray(entries)||entries.length>MAX_SESSIONS||entries.some(x=>!x||typeof x.hash!=='string'||typeof x.userId!=='string'||typeof x.deviceId!=='string'))throw bad(503,'Журнал входов сотрудников повреждён.');
  return entries;
 };
 const revokeSessions=async userId=>{
  await store.transaction(async()=>{
   const all=await readSessions();
   const remaining=all.filter(x=>x.userId!==userId);
   if(remaining.length!==all.length)await store.write(SESSIONS,remaining);
  });
 };
 const moscowDay=at=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
 const readHistory=async()=>{
  const records=await store.read(HISTORY,[]);
  if(!Array.isArray(records))throw bad(503,'Журнал действий повреждён.');
  return records;
 };

 const readUsers=async()=>{
  const data=await store.read(USERS,[]);
  if(!Array.isArray(data)||data.some(x=>!x||typeof x.id!=='string'||typeof x.passhash!=='string'))throw bad(503,'Файл учётных записей повреждён.');
  return data;
 };
 const pointName=v=>String(v||'').trim();
 const validPoint=v=>v.length>=2&&v.length<=60&&!Array.from(v).some(ch=>ch.charCodeAt(0)<32);
 const samePoint=(a,b)=>a.toLocaleLowerCase('ru')===b.toLocaleLowerCase('ru');
 const readPoints=async()=>{
  const points=await store.read(POINTS,['Плазма']);
  if(!Array.isArray(points)||points.length<1||points.length>30||points.some(p=>typeof p!=='string'||!validPoint(p)))throw bad(503,'Список точек повреждён. Изменения заблокированы.');
  if(new Set(points.map(p=>p.toLocaleLowerCase('ru'))).size!==points.length)throw bad(503,'Список точек содержит дубликаты.');
  return points;
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
  try{
   // Durable device-bound sessions survive browser restarts and server deploys.
   // A session remains valid until explicit logout or owner reset/block/revoke.
   const id=sha(credential),session=(await readSessions()).find(x=>x.hash===id&&x.deviceId===req.farukhPrintDevice.id);
   if(!session)return res.status(401).json({ok:false,error:'Сеанс сотрудника завершён. Войди снова.'});
   const user=(await readUsers()).find(x=>x.id===session.userId);
   if(!user||user.active===false)return res.status(403).json({ok:false,error:'Доступ сотрудника отключён владельцем.'});
   if(expiryReached(user))return res.status(403).json({ok:false,error:'Срок доступа сотрудника истёк. Обратись к управляющему для продления.'});
   req.farukhStaff=user;req.farukhSession=id;req.farukhSessionData=session;next();
  }catch(e){return res.status(e.status||503).json({ok:false,error:'Не удалось проверить права сотрудника.'})}
 };
 const passwordFromOwner=body=>{
  if(body?.password===undefined||body?.password===null||body?.password==='')return {password:token().slice(0,16),custom:false};
  if(typeof body.password!=='string'||body.password.length<8||body.password.length>128
    ||body.password!==body.password.trim()||Array.from(body.password).some(ch=>ch.charCodeAt(0)<32||ch.charCodeAt(0)===127)
    ||['password','12345678','87654321','qwerty123','11111111','00000000'].includes(body.password.toLowerCase()))
    throw bad(400,'Пароль должен быть от 8 до 128 символов, без пробелов по краям, управляющих символов и простых комбинаций.');
  return {password:body.password,custom:true};
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
 app.get('/api/farukh-print/admin/staff/points',owner,safe(async(req,res)=>{
  res.set('Cache-Control','no-store');res.json({ok:true,points:await readPoints()});
 }));
 app.post('/api/farukh-print/admin/staff/points',owner,safe(async(req,res)=>{
  const name=pointName(req.body?.name);
  if(!validPoint(name))throw bad(400,'Название точки должно содержать от 2 до 60 символов.');
  const points=await store.transaction(async()=>{
   const list=await readPoints();
   if(list.some(p=>samePoint(p,name)))throw bad(409,'Такая точка уже есть.');
   if(list.length>=30)throw bad(409,'Достигнут лимит точек.');
   list.push(name);await store.write(POINTS,list);return list;
  });
  res.status(201).json({ok:true,points});
 }));
 app.patch('/api/farukh-print/admin/staff/points',owner,safe(async(req,res)=>{
  const former=pointName(req.body?.oldName),name=pointName(req.body?.name);
  if(!validPoint(former)||!validPoint(name))throw bad(400,'Проверь название точки.');
  const result=await store.transaction(async()=>{
   const list=await readPoints(),index=list.findIndex(p=>samePoint(p,former));
   if(index<0)throw bad(404,'Точка не найдена.');
   if(list.some((p,i)=>i!==index&&samePoint(p,name)))throw bad(409,'Такая точка уже существует.');
   const currentName=list[index],employees=await readUsers();
   list[index]=name;
   for(const employee of employees)if(samePoint(employee.point,currentName))employee.point=name;
   // A rename changes the permitted employee point and revokes current sessions.
   // Historical requests keep their original location for audit correctness.
   await store.write(POINTS,list);
   await store.write(USERS,employees);
   return {points:list,users:employees,prior:currentName};
  });
  for(const u of result.users)if(samePoint(u.point,name))await revokeSessions(u.id);
  res.json({ok:true,points:result.points,notice:'Учётные записи переведены на новую точку. Старые запросы печати не изменены.'});
 }));
 app.delete('/api/farukh-print/admin/staff/points',owner,safe(async(req,res)=>{
  const name=pointName(req.body?.name);
  const points=await store.transaction(async()=>{
   const list=await readPoints();
   if(list.length<=1)throw bad(409,'Нельзя удалить последнюю точку.');
   const pos=list.findIndex(p=>samePoint(p,name));if(pos<0)throw bad(404,'Точка не найдена.');
   if((await readUsers()).some(u=>samePoint(u.point,name)))throw bad(409,'Сначала переведи сотрудников на другую точку.');
   list.splice(pos,1);await store.write(POINTS,list);return list;
  });
  res.json({ok:true,points});
 }));
 app.patch('/api/farukh-print/admin/staff/:id',owner,safe(async(req,res)=>{
  const name=pointName(req.body?.name),login=pointName(req.body?.login).toLowerCase(),point=pointName(req.body?.point);
  if(name.length<2||name.length>65||!/^[a-z][a-z0-9_-]{2,31}$/.test(login)||!validPoint(point))throw bad(400,'Нужны имя, логин латиницей и точка.');
  const result=await store.transaction(async()=>{
   const points=await readPoints();
   const actual=points.find(p=>samePoint(p,point));
   if(!actual)throw bad(400,'Сначала добавь эту точку в список точек.');
   const users=await readUsers(),employee=users.find(u=>u.id===req.params.id);
   if(!employee)throw bad(404,'Сотрудник не найден.');
   if(users.some(u=>u.id!==employee.id&&u.login===login))throw bad(409,'Этот логин уже занят.');
   const changed=employee.name!==name||employee.login!==login||employee.point!==actual;
   employee.name=name;employee.login=login;employee.point=actual;
   if(changed)await store.write(USERS,users);
   return {employee,changed};
  });
  if(result.changed)await revokeSessions(result.employee.id);
  res.json({ok:true,staff:userSafe(result.employee),sessionRevoked:result.changed});
 }));
 app.get('/api/farukh-print/admin/staff/report',owner,safe(async(req,res)=>{
  const days=String(req.query?.days||'30');
  if(!['shift','today','month','7','30','90','all'].includes(days))throw bad(400,'Период отчёта: с момента входа, сегодня, этот месяц, 7/30/90 дней или всё время.');
  const point=pointName(req.query?.point);
  const [configured,users,events,activeSessions]=await Promise.all([readPoints(),readUsers(),readHistory(),readSessions()]);
  if(!Array.isArray(events))throw bad(503,'Журнал действий повреждён.');
  const today=moscowDay(Date.now());
  const after=['all','shift','today','month'].includes(days)?-Infinity:Date.now()-Number(days)*86400000;
  const valid=events.filter(e=>{
   if(!e||!Number.isFinite(Date.parse(e.at)))return false;
   if(days==='today')return moscowDay(e.at)===today;
   if(days==='month')return moscowDay(e.at).slice(0,7)===today.slice(0,7);
   if(days==='shift')return activeSessions.some(t=>t.userId===e.userId&&t.deviceId===e.deviceId&&t.loginAt===e.sessionAt);
   return Date.parse(e.at)>=after;
  });
  const points=[...new Set([...configured,...users.map(u=>u.point),...valid.map(e=>e.point)].filter(Boolean))];
  if(point&&!points.some(p=>samePoint(p,point)))throw bad(404,'Точка не найдена.');
  const rows=points.filter(p=>!point||samePoint(p,point)).map(p=>{
   const workers=users.filter(u=>samePoint(u.point,p)),logs=valid.filter(e=>samePoint(e.point,p));
   return {point:p,staff:workers.length,active:workers.filter(u=>canAccess(u)).length,requests:logs.length,
    labels:logs.reduce((acc,e)=>acc+(Number.isSafeInteger(e.copies)&&e.copies>0?e.copies:0),0),
    lastRequestAt:logs.length?logs.reduce((a,e)=>a>e.at?a:e.at,''):null,
    transmitted:logs.filter(e=>e.result==='sent').length,failed:logs.filter(e=>e.result==='failed').length,
    users:workers.map(u=>{
      const requests=logs.filter(e=>e.userId===u.id||(!e.userId&&e.login===u.login));
      return {id:u.id,name:u.name,login:u.login,active:canAccess(u),
       requests:requests.length,labels:requests.reduce((n,e)=>n+(e.copies||0),0),
       transmitted:requests.filter(e=>e.result==='sent').length,failed:requests.filter(e=>e.result==='failed').length};
    })};
  });
  const sum=k=>rows.reduce((n,r)=>n+r[k],0);
  res.set('Cache-Control','no-store');
  res.json({ok:true,days,point,summary:{points:rows.length,staff:sum('staff'),active:sum('active'),requests:sum('requests'),labels:sum('labels')},
   rows,
   topProducts:[...valid.filter(e=>!point||samePoint(e.point,point)).reduce((map,e)=>{
    const key=e.productId||e.product||'unknown';
    const row=map.get(key)||{id:key,name:e.product||'Этикетка',requests:0,requestedLabels:0,transmittedJobs:0,failedJobs:0};
    row.requests++;row.requestedLabels+=Number.isSafeInteger(e.copies)?e.copies:0;
    if(e.result==='sent')row.transmittedJobs++;
    if(e.result==='failed')row.failedJobs++;
    map.set(key,row);return map;
   },new Map()).values()].sort((a,b)=>b.requests-a.requests).slice(0,12),
   historyLimit:MAX_EVENTS,note:'Запросы и передача на принтер — не доказательство фактической печати. Смена — с последнего входа сотрудника на устройстве. История хранит последние 4000 запросов.'});
 }));
 app.get('/api/farukh-print/admin/staff',owner,safe(async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({ok:true,staff:(await readUsers()).map(userSafe)});
 }));
 app.post('/api/farukh-print/admin/staff',owner,safe(async(req,res)=>{
  const name=trim(req.body?.name,65),login=trim(req.body?.login,32).toLowerCase(),point=trim(req.body?.point,60);
  if(!name||name.length<2||!point||point.length<2||!/^[a-z][a-z0-9_-]{2,31}$/.test(login))throw bad(400,'Нужны имя, точка и логин латиницей (3–32 символа).');
  const configured=await readPoints(),actual=configured.find(p=>samePoint(p,point));
  if(!actual)throw bad(400,'Сначала добавь эту точку в список точек.');
  const {password,custom}=passwordFromOwner(req.body);
  const expiresAt=expiryFromDays(accessDaysFromBody(req.body,{creation:true}));
  const salt=crypto.randomBytes(16).toString('hex');
  const user={id:crypto.randomUUID(),name,login,point:actual,passhash:hash(password,salt),salt,
   active:true,expiresAt,createdAt:new Date().toISOString()};
  await store.transaction(async()=>{
   const all=await readUsers();if(all.length>=MAX_STAFF)throw bad(409,'Достигнут лимит сотрудников.');
   if(all.some(x=>x.login===login))throw bad(409,'Этот логин уже занят.');
   all.push(user);await store.write(USERS,all);
  });
  res.set('Cache-Control','no-store');
  res.status(201).json({ok:true,staff:userSafe(user),...(!custom?{password}:{}),
    warning:custom?'Сотрудник создан с заданным владельцем паролем. Он хранится только в виде защищённого хеша.':'Сохрани сгенерированный пароль сейчас: повторно посмотреть его нельзя.'});
 }));
 // A new term starts at the moment of the owner's action, not at the previous expiry.
 // Limit changes revoke sessions and require a fresh login; no existing credentials or
 // employee history are destroyed. Explicit null grants unlimited access.
 app.post('/api/farukh-print/admin/staff/:id/access',owner,safe(async(req,res)=>{
  const days=accessDaysFromBody(req.body);
  const expiresAt=expiryFromDays(days);
  let target,changed=false;
  await store.transaction(async()=>{
   const users=await readUsers();target=users.find(x=>x.id===req.params.id);
   if(!target)throw bad(404,'Сотрудник не найден.');
   changed=(target.expiresAt||null)!==expiresAt;
   if(changed){
    target.expiresAt=expiresAt;
    await store.write(USERS,users);
   }
  });
  if(changed)await revokeSessions(target.id);
  res.set('Cache-Control','no-store');
  res.json({ok:true,staff:userSafe(target),sessionRevoked:changed,
   notice:days===null?'Срок доступа снят.':'Срок доступа установлен до '+new Date(expiresAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' (Москва).'});
 }));
 app.post('/api/farukh-print/admin/staff/:id/reset',owner,safe(async(req,res)=>{
  const {password,custom}=passwordFromOwner(req.body);
  const salt=crypto.randomBytes(16).toString('hex');
  let target;
  await store.transaction(async()=>{
   const all=await readUsers();target=all.find(x=>x.id===req.params.id);
   if(!target)throw bad(404,'Сотрудник не найден.');
   target.salt=salt;target.passhash=hash(password,salt);target.active=true;
   await store.write(USERS,all);
  });
  await revokeSessions(target.id);
  res.set('Cache-Control','no-store');
  res.json({ok:true,staff:userSafe(target),...(!custom?{password}:{}),
    warning:custom?'Пароль сотрудника обновлён владельцем.':'Новый пароль показан только сейчас.'});
 }));
 app.post('/api/farukh-print/admin/staff/:id/status',owner,safe(async(req,res)=>{
  if(typeof req.body?.active!=='boolean')throw bad(400,'Не указан статус сотрудника.');
  let target;
  await store.transaction(async()=>{
   const all=await readUsers();target=all.find(x=>x.id===req.params.id);if(!target)throw bad(404,'Сотрудник не найден.');
   target.active=req.body.active;await store.write(USERS,all);
  });
  if(!target.active)await revokeSessions(target.id);
  res.json({ok:true,staff:userSafe(target)});
 }));
 app.get('/api/farukh-print/admin/staff/activity',owner,safe(async(req,res)=>{
  const start=String(req.query?.from||''),end=String(req.query?.to||'');
  if((start&&!/^\d{4}-\d{2}-\d{2}$/.test(start))||(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end))||(start&&end&&start>end))throw bad(400,'Неверный диапазон дат.');
  const point=trim(req.query?.point,60),login=trim(req.query?.login,32).toLowerCase(),state=trim(req.query?.result,20),
   product=trim(req.query?.product,90).toLocaleLowerCase('ru');
  if(state&&!['sent','failed','system','pending'].includes(state))throw bad(400,'Неверный статус печати.');
  const limit=Math.min(300,Math.max(1,Number(req.query?.limit)||100));
  const records=(await readHistory()).filter(e=>{
   if(point&&e.point!==point)return false;
   if(login&&e.login!==login)return false;
   if(product&&!String(e.product||'').toLocaleLowerCase('ru').includes(product))return false;
   if(state&&(e.result||'pending')!==state)return false;
   if(!Number.isFinite(Date.parse(e.at)))return false;
   const day=moscowDay(e.at);
   return (!start||day>=start)&&(!end||day<=end);
  });
  res.set('Cache-Control','no-store');
  res.json({ok:true,events:records.slice(-limit).reverse(),total:records.length,historyLimit:MAX_EVENTS});
 }));
 // Owner-only full filtered CSV export. Never includes employee passwords,
 // session tokens or printer binary data. Escape CSV formula injection.
 app.get('/api/farukh-print/admin/staff/activity-export',owner,safe(async(req,res)=>{
  const start=String(req.query?.from||''),end=String(req.query?.to||'');
  if((start&&!/^\d{4}-\d{2}-\d{2}$/.test(start))||(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end))||(start&&end&&start>end))
   throw bad(400,'Неверный диапазон дат.');
  const point=trim(req.query?.point,60),login=trim(req.query?.login,32).toLowerCase(),
   state=trim(req.query?.result,20),product=trim(req.query?.product,90).toLocaleLowerCase('ru');
  if(state&&!['sent','failed','system','pending'].includes(state))throw bad(400,'Неверный статус.');
  const events=(await readHistory()).filter(e=>{
   if(point&&e.point!==point)return false;
   if(login&&e.login!==login)return false;
   if(product&&!String(e.product||'').toLocaleLowerCase('ru').includes(product))return false;
   if(state&&(e.result||'pending')!==state)return false;
   if(!Number.isFinite(Date.parse(e.at)))return false;
   const day=moscowDay(e.at);
   return (!start||day>=start)&&(!end||day<=end);
  });
  const csvField=value=>{
   const clean=String(value??'').replace(/[\r\n\t]+/g,' ').slice(0,250);
   const safe=/^[\s]*[=+@-]/.test(clean)?"'"+clean:clean;
   return '"'+safe.replace(/"/g,'""')+'"';
  };
  const fields=['Дата UTC','Точка','Сотрудник','Логин','Товар','Количество в запросе','Результат','Устройство','Описание'];
  const rows=[fields,...events.map(e=>[e.at,e.point,e.staff,e.login,e.product,e.copies,e.result||'pending',e.device,e.details])];
  const csv='\uFEFF'+rows.map(r=>r.map(csvField).join(';')).join('\r\n')+'\r\n';
  res.set('Cache-Control','no-store');
  res.set('Content-Type','text/csv; charset=utf-8');
  res.set('Content-Disposition','attachment; filename="farukh-print-history.csv"');
  res.send(csv);
 }));
 app.get('/api/farukh-print/admin/staff/alerts',owner,safe(async(req,res)=>{
  const events=await readHistory();
  const errors=events.filter(e=>e.result==='failed').slice(-30).reverse().map(e=>({
   type:'print_error',id:e.id,at:e.resultAt||e.at,point:e.point,staff:e.staff,device:e.device,
   message:(e.product||'Этикетка')+' · '+(e.details||'Не удалось отправить на принтер')
  }));
  const devices=await store.read('farukh-print-devices.json',[]);
  if(!Array.isArray(devices))throw bad(503,'Не удалось прочитать устройства.');
  const offline=devices.filter(d=>!d.revoked&&d.lastSeenAt&&Date.now()-Date.parse(d.lastSeenAt)>20*60*1000)
   .map(d=>({type:'offline',id:d.id,at:d.lastSeenAt,device:d.name,message:'Нет связи более 20 минут'}));
  res.set('Cache-Control','no-store');
  res.json({ok:true,alerts:[...errors,...offline].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,60),
   note:'Уведомления показываются в управляющем центре. Если устройство без сети, ошибка появится только после передачи данных.'});
 }));
 app.post('/api/farukh-print/device/staff/login',protectDevice,staffRate,safe(async(req,res)=>{
  if(!sameOrigin(req))throw bad(403,'Неверный источник запроса.');
  const login=trim(req.body?.login,32).toLowerCase(),password=String(req.body?.password||'');
  if(!/^[a-z][a-z0-9_-]{2,31}$/.test(login)||password.length<8||password.length>180)throw bad(401,'Неверный логин или пароль.');
  const account=(await readUsers()).find(x=>x.login===login);
  const salt=account?.salt||'0'.repeat(32);
  const expected=account?.passhash||'0'.repeat(64);
  const actual=hash(password,salt);
  if(!crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'))||!account)throw bad(401,'Неверный логин или пароль.');
  if(account.active===false)throw bad(401,'Неверный логин или пароль.');
  if(expiryReached(account))throw bad(403,'Срок доступа сотрудника истёк. Обратись к управляющему для продления.');
  const session=token(),since=new Date().toISOString();
  await store.transaction(async()=>{
   const all=await readSessions();
   const next=all.filter(x=>!(x.userId===account.id&&x.deviceId===req.farukhPrintDevice.id));
   if(next.length>=MAX_SESSIONS)throw bad(429,'Слишком много активных входов. Обратись к управляющему.');
   next.push({hash:sha(session),userId:account.id,deviceId:req.farukhPrintDevice.id,loginAt:since});
   await store.write(SESSIONS,next);
  });
  res.set('Cache-Control','no-store');
  res.json({ok:true,session,staff:userSafe(account),remembered:true});
 }));
 app.get('/api/farukh-print/device/staff/session',protectDevice,requireStaff,safe(async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({ok:true,staff:userSafe(req.farukhStaff)});
 }));
 app.post('/api/farukh-print/device/staff/logout',protectDevice,requireStaff,safe(async(req,res)=>{
  await store.transaction(async()=>{
   const all=await readSessions();await store.write(SESSIONS,all.filter(x=>x.hash!==req.farukhSession));
  });
  res.json({ok:true});
 }));
 app.post('/api/farukh-print/device/staff/authorize-print',protectDevice,requireStaff,safe(async(req,res)=>{
  if(!sameOrigin(req))throw bad(403,'Неверный источник запроса.');
  const productId=trim(req.body?.productId,150),copies=Number(req.body?.copies),point=trim(req.body?.point,60);
  const printedAt=String(req.body?.printedAt||'');
  if(!Number.isSafeInteger(copies)||copies<1||copies>20||point!==req.farukhStaff.point||!Number.isFinite(Date.parse(printedAt)))throw bad(403,'Нельзя печатать на другой точке или с неверными данными.');
  const list=await readCatalog();
  // A worker must not print dates/temperatures from an out-of-date local
  // catalog after the owner has changed a TTK or expiry in FARUKH AI.
  if(!Number.isSafeInteger(req.body?.catalogRevision)||req.body.catalogRevision!==list.revision)
    throw bad(409,'Каталог обновлён владельцем. Нажми «Обновить товары» и выбери этикетку заново.');
  const product=list.products.find(x=>x.id===productId);
  if(!product||product.needsReview===true||(!getTemplate(product)&&(!product.storage||!Number.isInteger(product.hours)||product.hours<=0)))throw bad(403,'Этикетка отсутствует в утверждённой облачной базе или не проверена.');
  const item={id:crypto.randomUUID(),at:new Date().toISOString(),status:'Запрос печати (не подтверждение физической печати)',result:'pending',
    staff:req.farukhStaff.name,userId:req.farukhStaff.id,sessionAt:req.farukhSessionData.loginAt,
    deviceId:req.farukhPrintDevice.id,login:req.farukhStaff.login,point:req.farukhStaff.point,
    productId:product.id,product:product.name,copies,device:req.farukhPrintDevice.name};
  await store.transaction(async()=>{
   const events=await readHistory();
   events.push(item);await store.write(HISTORY,events.slice(-MAX_EVENTS));
  });
  res.set('Cache-Control','no-store');res.json({ok:true,eventId:item.id,staff:userSafe(req.farukhStaff)});
 }));
 app.post('/api/farukh-print/device/staff/print-result',protectDevice,requireStaff,safe(async(req,res)=>{
  if(!sameOrigin(req))throw bad(403,'Неверный источник запроса.');
  const id=String(req.body?.eventId||''),result=String(req.body?.result||'');
  if(!/^[a-f0-9-]{36}$/.test(id)||!['sent','failed','system'].includes(result))throw bad(400,'Неверные данные результата.');
  const details=trim(req.body?.details,160);
  const updated=await store.transaction(async()=>{
   const rows=await readHistory();
   const entry=rows.find(e=>e.id===id&&e.userId===req.farukhStaff.id&&e.deviceId===req.farukhPrintDevice.id);
   if(!entry)throw bad(404,'Запрос печати не найден.');
   if(entry.result!=='pending')return entry;
   entry.result=result;entry.resultAt=new Date().toISOString();entry.details=details;
   entry.status=result==='sent'?'Данные переданы принтеру':result==='failed'?'Ошибка отправки': 'Открыт системный диалог печати';
   await store.write(HISTORY,rows);return entry;
  });
  res.set('Cache-Control','no-store');
  res.json({ok:true,eventId:updated.id,result:updated.result});
 }));

}
