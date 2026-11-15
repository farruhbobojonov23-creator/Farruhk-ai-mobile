// FARUKH PRINT Cloud V1 — standalone, protected Neon staging service.
// This service never loads FARUKH AI account data or the staff production API.
// Owner catalog upload is an explicit, one-time, authenticated action.
import express from 'express';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
const PORT=Number(process.env.PORT)||10000;
const dburl=String(process.env.FARUKH_PRINT_DATABASE_URL||'');
const sessionSecret=String(process.env.FARUKH_PRINT_CLOUD_SESSION_SECRET||'');
const setupCode=String(process.env.FARUKH_PRINT_CLOUD_SETUP_CODE||'');
const configured=dburl.startsWith('postgres')&&sessionSecret.length>=40&&setupCode.length>=20;
if(!configured)console.warn('[print-cloud] Awaiting Neon DATABASE_URL and private owner secrets in Render');
const pool=configured
 ? new Pool({connectionString:dburl,max:3,idleTimeoutMillis:15000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true}})
 : {query:async()=>{throw new Error('configuration_required')},connect:async()=>{throw new Error('configuration_required')},end:async()=>{}};
const folder=path.dirname(fileURLToPath(import.meta.url));
const appRoot=path.join(folder,'public','farukh-print-cloud');
const api='/api/print-cloud/v1';
app.use((req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','no-referrer');
 if(req.path.startsWith(api))res.setHeader('Cache-Control','no-store');
 next();
});
app.use(express.json({limit:'12mb',strict:true}));
app.get('/',(_req,res)=>res.redirect(302,'/cloud/'));
app.get('/cloud',(_req,res)=>res.redirect(302,'/cloud/'));
app.get('/cloud/',(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://ep-small-forest-basx2akr.apirest.c-8.eu-central-1.aws.neon.tech; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 res.sendFile(path.join(appRoot,'index.html'));
});
app.use('/cloud/assets',express.static(appRoot,{index:false,fallthrough:false,maxAge:3600000}));
function secureCookie(res,token){
 const attrs=['HttpOnly','Secure','SameSite=Strict','Path=/api/print-cloud/v1','Max-Age='+(token?21600:0)];
 res.setHeader('Set-Cookie','fp_cloud_session='+encodeURIComponent(token||'')+'; '+attrs.join('; '));
}
function parseCookie(req){
 const cookies=String(req.headers.cookie||'').split(';');
 const raw=cookies.find(c=>c.trim().startsWith('fp_cloud_session='));
 if(!raw)return '';
 try{return decodeURIComponent(raw.trim().slice('fp_cloud_session='.length))}catch{return ''}
}
const digest=(data)=>crypto.createHmac('sha256',sessionSecret).update(data).digest('base64url');
function constantEqual(a,b){
 const left=Buffer.from(String(a)),right=Buffer.from(String(b));
 return left.length===right.length&&crypto.timingSafeEqual(left,right);
}
function issueSession(res,record){
 const data=Buffer.from(JSON.stringify({exp:Date.now()+21600e3,v:record.hash.slice(0,20)})).toString('base64url');
 secureCookie(res,data+'.'+digest(data));
}
async function ownerRecord(){
 const r=await pool.query("SELECT setting_value FROM farukh_print.app_settings WHERE setting_key='owner_password'");
 return r.rows[0]?.setting_value||null;
}
async function authorized(req){
 const session=parseCookie(req),i=session.lastIndexOf('.');
 if(i<1)return false;
 const data=session.slice(0,i),mac=session.slice(i+1);
 if(!constantEqual(mac,digest(data)))return false;
 let value;
 try{value=JSON.parse(Buffer.from(data,'base64url').toString('utf8'))}catch{return false}
 if(!Number.isFinite(value.exp)||value.exp<Date.now())return false;
 const record=await ownerRecord();
 return !!record?.hash&&constantEqual(value.v,record.hash.slice(0,20));
}
const auth=async(req,res,next)=>{
 try{
  if(!await authorized(req))return res.status(401).json({ok:false,error:'Войди как владелец Farukh Print Cloud.'});
  next();
 }catch{res.status(503).json({ok:false,error:'Проверка доступа временно недоступна.'})}
};
function passwordRecord(pass){
 const salt=crypto.randomBytes(16).toString('hex');
 const hash=crypto.scryptSync(pass,Buffer.from(salt,'hex'),32).toString('hex');
 return {algorithm:'scrypt-v1',salt,hash,createdAt:new Date().toISOString()};
}
function verifyPassword(password,record){
 if(record?.algorithm!=='scrypt-v1'||!record.salt||!record.hash)return false;
 try{
  const candidate=crypto.scryptSync(password,Buffer.from(record.salt,'hex'),32).toString('hex');
  return constantEqual(candidate,record.hash);
 }catch{return false}
}
const attempts=new Map();
function gate(req,res,next){
 const ip=String(req.ip||'unknown').slice(0,96),now=Date.now();
 if(attempts.size>1000)attempts.clear();
 const row=attempts.get(ip)||{count:0,until:now+900000};
 if(now>row.until){row.count=0;row.until=now+900000}
 if(row.count>=8)return res.status(429).json({ok:false,error:'Слишком много попыток. Повтори через 15 минут.'});
 row.count++;attempts.set(ip,row);req.loginIp=ip;next();
}
function clearGate(req){if(req.loginIp)attempts.delete(req.loginIp)}
function validOrigin(req){
 const o=String(req.headers.origin||'');
 const host=String(req.headers.host||'');
 return o==='https://'+host||o==='http://localhost:'+PORT;
}
app.use(api,(req,res,next)=>{
 if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
  if(!validOrigin(req))return res.status(403).json({ok:false,error:'Запрос не из Farukh Print Cloud.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({ok:false,error:'Требуется JSON.'});
 }
 next();
});
const neonFnUrl=String(process.env.FARUKH_PRINT_NEON_FUNCTION_URL||'');
app.get('/neon-probe',async(_req,res)=>{
 if(!neonFnUrl.startsWith('https://'))return res.status(503).json({ok:false,error:'Neon Function not configured'});
 try{
  const upstream=await fetch(new URL('/healthz',neonFnUrl),{signal:AbortSignal.timeout(12000)});
  const body=await upstream.json().catch(()=>({}));
  res.status(upstream.status).json({ok:upstream.ok&&body.ok===true,neonApiStatus:upstream.status,neonConnected:body?.neonConnected===true||body?.points===4,points:body?.points??null});
 }catch(err){
  console.error('[print-cloud] Neon native function probe failed',err?.code||err?.name||'network-error');
  res.status(503).json({ok:false,error:'Neon function not reachable'});
 }
});
// First-party Neon Auth bridge; does not expose PostgreSQL secrets or staff production routes.
// All browser auth cookies remain HttpOnly on the Cloud test origin.
const authBaseUrl='https://ep-small-forest-basx2akr.neonauth.c-8.eu-central-1.aws.neon.tech/farukh_print/auth';
const authOwnerEmail=String(process.env.FARUKH_PRINT_OWNER_EMAIL||'');
const authSite='https://farukh-print-cloud-test-20261115.onrender.com';
const allowedAuthMethods=new Map([
 ['/get-session','GET'],['/token','GET'],['/sign-in/email','POST'],
 ['/request-password-reset','POST'],['/reset-password','POST'],
 ['/change-password','POST'],['/sign-out','POST']
]);
app.use('/owner-auth',async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.get('host')!=='farukh-print-cloud-test-20261115.onrender.com')return res.status(421).json({error:'Неправильный адрес сервиса.'});
 const rest=req.path.replace(/\\/g,'/');
 if(allowedAuthMethods.get(rest)!==req.method)return res.status(404).json({error:'Нет такого действия.'});
 if(!authOwnerEmail.includes('@'))return res.status(503).json({error:'Учетная запись владельца пока не настроена на сервере.'});
 if(req.method==='POST'){
  if(req.get('origin')!==authSite)return res.status(403).json({error:'Неверное происхождение запроса.'});
  if(!req.is('application/json'))return res.status(415).json({error:'Нужен JSON.'});
 }
 let body=req.body&&typeof req.body==='object'?{...req.body}:{};
 if(rest==='/sign-in/email'){
  if(body.login!=='admin'||typeof body.password!=='string'||body.password.length<8||body.password.length>128)
   return res.status(401).json({error:'Неверный логин или пароль.'});
  body={email:authOwnerEmail,password:body.password};
 }
 if(rest==='/request-password-reset')body={email:authOwnerEmail,redirectTo:authSite+'/cloud/'};
 if(rest==='/change-password'){
  if(typeof body.currentPassword!=='string'||typeof body.newPassword!=='string'||body.newPassword.length<12)
   return res.status(400).json({error:'Нужен текущий и новый пароль от 12 символов.'});
  body={currentPassword:body.currentPassword,newPassword:body.newPassword,revokeOtherSessions:true};
 }
 if(rest==='/reset-password'){
  if(typeof body.newPassword!=='string'||body.newPassword.length<12||!body.token)
   return res.status(400).json({error:'Неверный код восстановления или пароль.'});
  body={token:String(body.token),newPassword:body.newPassword};
 }
 const upstreamHeaders={'Accept':'application/json','Origin':authSite,'Referer':authSite+'/cloud/'};
 if(req.headers.cookie)upstreamHeaders['Cookie']=String(req.headers.cookie);
 if(req.method==='POST')upstreamHeaders['Content-Type']='application/json';
 try{
  const response=await fetch(authBaseUrl+rest,{
   method:req.method,headers:upstreamHeaders,body:req.method==='POST'?JSON.stringify(body):undefined,
   redirect:'manual',signal:AbortSignal.timeout(16000)
  });
  const contentType=response.headers.get('content-type')||'';
  const raw=await response.text();
  if(!contentType.includes('json')||raw.length>300000)throw Error('bad_auth_upstream');
  const cookies=response.headers.getSetCookie?.()||[];
  for(const v of cookies){
   const cookie=v.replace(/;\\s*Domain=[^;]*/gi,'').replace(/;\\s*Path=[^;]*/gi,'').replace(/;\\s*SameSite=[^;]*/gi,'');
   res.append('Set-Cookie',cookie.replace(/;\\s*Partitioned/gi,'')+'; Path=/; Secure; HttpOnly; SameSite=Lax');
  }
  res.status(response.status).type('application/json').send(raw);
 }catch(err){
  console.error('[farukh-print] auth bridge unavailable',err.name||'error');
  res.status(503).json({error:'Сервис проверки пароля временно недоступен.'});
 }
});
app.get('/neon-security-check',async(_req,res)=>{
 const url='https://ep-small-forest-basx2akr.apirest.c-8.eu-central-1.aws.neon.tech/farukh_print/rest/v1/rpc/cloud_status';
 try{
  const upstream=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
   body:'{}',signal:AbortSignal.timeout(12000)});
  const denied=upstream.status===401||upstream.status===403||upstream.status===404;
  res.status(denied?200:503).json({ok:denied,anonymousDenied:denied,httpStatus:upstream.status,
    detail:denied?'Neon data protected from unauthenticated requests':'Review permission configuration'});
 }catch(err){res.status(503).json({ok:false,error:'Connectivity check failed',type:err?.name||'error'})}
});
app.get('/healthz',async(_req,res)=>{
 try{
  const result=await pool.query('SELECT 1 FROM farukh_print.locations LIMIT 1');
  return res.json({ok:true,service:'farukh-print-cloud-staging',database:'neon',schema:'farukh_print',ready:result.rowCount>=1,staffConnected:false});
 }catch(error){
  console.error('[print-cloud] health-check failed',error.code||'db_unavailable');
  return res.status(503).json({ok:false,service:'farukh-print-cloud-staging',database:'unavailable'});
 }
});
app.get(api+'/status',async(_req,res)=>{
 try{
  const ready=await ownerRecord();
  const q=await pool.query('SELECT count(*)::int AS locations FROM farukh_print.locations');
  res.json({ok:true,connected:true,database:'FARUKH PRINT / Neon',setupRequired:!ready,locations:q.rows[0].locations,staging:true,staffConnected:false});
 }catch(err){
  console.error('[print-cloud] status failed',err.code||'db_unavailable');
  res.status(503).json({ok:false,connected:false,error:'База данных пока недоступна.'});
 }
});
app.post(api+'/setup',gate,async(req,res)=>{
 try{
  const provided=String(req.body?.setupCode||''),password=String(req.body?.password||'');
  if(!constantEqual(provided,setupCode))return res.status(401).json({ok:false,error:'Неверный код первичной настройки.'});
  if(password.length<12||password.length>128)return res.status(400).json({ok:false,error:'Пароль должен содержать от 12 до 128 символов.'});
  const hash=passwordRecord(password);
  const r=await pool.query("INSERT INTO farukh_print.app_settings (setting_key,setting_value) VALUES ('owner_password',$1::jsonb) ON CONFLICT (setting_key) DO NOTHING RETURNING setting_key",[JSON.stringify(hash)]);
  if(!r.rowCount)return res.status(409).json({ok:false,error:'Пароль уже установлен. Используй обычный вход.'});
  clearGate(req);issueSession(res,hash);
  res.json({ok:true,setupComplete:true});
 }catch(err){console.error('[print-cloud] setup failed',err.code||'error');res.status(503).json({ok:false,error:'Не удалось установить пароль. Попробуй позже.'})}
});
app.post(api+'/login',gate,async(req,res)=>{
 try{
  const pass=String(req.body?.password||'');
  const row=await ownerRecord();
  if(!row||!verifyPassword(pass,row))return res.status(401).json({ok:false,error:'Неверный пароль.'});
  clearGate(req);issueSession(res,row);res.json({ok:true});
 }catch(err){console.error('[print-cloud] login failed',err.code||'error');res.status(503).json({ok:false,error:'Ошибка входа.'})}
});
app.post(api+'/logout',(_req,res)=>{secureCookie(res,'');res.json({ok:true})});
app.get(api+'/me',auth,(_req,res)=>res.json({ok:true,owner:true}));
const statsSQL="SELECT (SELECT count(*)::int FROM farukh_print.locations) AS locations, (SELECT count(*)::int FROM farukh_print.products) AS products, (SELECT count(*)::int FROM farukh_print.products WHERE kind='ready') AS ready, (SELECT count(*)::int FROM farukh_print.products WHERE kind='prep') AS prep, (SELECT count(*)::int FROM farukh_print.product_photos) AS photos, (SELECT count(*)::int FROM farukh_print.staff_accounts) AS staff, (SELECT count(*)::int FROM farukh_print.devices) AS devices, (SELECT count(*)::int FROM farukh_print.print_events) AS events, (SELECT count(*)::int FROM farukh_print.catalog_backups) AS backups, (SELECT coalesce(max(id),0)::bigint::text FROM farukh_print.catalog_revisions) AS revision";
app.get(api+'/stats',auth,async(_req,res)=>{
 try{const r=await pool.query(statsSQL);res.json({ok:true,staging:true,staffConnected:false,...r.rows[0]})}
 catch(err){console.error('[print-cloud] stats failed',err.code||'error');res.status(503).json({ok:false,error:'Нет связи с каталогом.'})}
});
function verifyCatalog(blob){
 if(!blob||blob.format!=='farukh-print-catalog-v1'||!Array.isArray(blob.products)||blob.products.length>1000||!blob.products.length)throw Error('Нужна непустая JSON-копия каталога Farukh Print.');
 const seenId=new Set(),seenName=new Set();
 const arr=[],photos=[];
 let ready=0,prep=0,inline=0,references=0,needsReview=0;
 for(const raw of blob.products){
  if(!raw||typeof raw!=='object')throw Error('В копии есть повреждённая карточка.');
  const id=String(raw.id||''),kind=String(raw.kind||''),name=String(raw.name||'').trim();
  if(!id||id.length>128||!['ready','prep'].includes(kind)||!name||name.length>90)throw Error('Некорректный идентификатор, тип или название.');
  const norm=kind+'|'+name.toLocaleLowerCase('ru').replace(/ё/g,'е');
  if(seenId.has(id)||seenName.has(norm))throw Error('В копии повторяются товары или идентификаторы.');
  seenId.add(id);seenName.add(norm);
  const storage=typeof raw.storage==='string'?raw.storage.trim():null;
  if(storage&&storage.length>60)throw Error('Слишком длинные условия хранения: '+name);
  const hours=Number.isInteger(raw.hours)&&raw.hours>=1&&raw.hours<=8760?raw.hours:null;
  const unverified=raw.needsReview===true||!hours||!storage;
  if(unverified)needsReview++;
  if(kind==='ready')ready++;else prep++;
  let photo=null;
  const payload={...raw};
  const image=typeof raw.photo==='string'?raw.photo:'';
  if(image.startsWith('data:')){
   const m=/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(image);
   if(!m)throw Error('Неподдерживаемый формат фотографии: '+name);
   const bytes=Buffer.from(m[2].replace(/\s/g,''),'base64');
   if(!bytes.length||bytes.length>1048576)throw Error('Размер фотографии превышает 1 МБ: '+name);
   photo={id,mime:m[1].toLowerCase(),buffer:bytes};
   delete payload.photo;
   inline++;
  }else if(/^https:\/\//i.test(image)){
   if(image.length>2048)throw Error('Слишком длинная ссылка на изображение: '+name);
   photo={id,mime:image.toLowerCase().endsWith('.png')?'image/png':image.toLowerCase().endsWith('.jpg')?'image/jpeg':'image/webp',url:image};references++;
   delete payload.photo;
  }
  if(photo)photos.push(photo);
  const weight=Number(raw.weight);
  const nutrition={};
  for(const k of ['p','f','c','kcal'])if(typeof raw[k]==='number'&&Number.isFinite(raw[k])&&raw[k]>=0)nutrition[k]=raw[k];
  const row={
   id,kind,name,category:typeof raw.category==='string'?raw.category.slice(0,120):null,
   composition:typeof raw.composition==='string'?raw.composition.slice(0,600):null,
   storage,shelf_life_hours:hours,needs_review:unverified,
   net_weight:Number.isFinite(weight)&&weight>0&&weight<1000000?weight:null,
   weight_unit:['г','кг','мл','л','шт'].includes(raw.weightUnit)?raw.weightUnit:null,
   tolerance:typeof raw.tolerance==='number'&&Number.isFinite(raw.tolerance)&&raw.tolerance>=0?raw.tolerance:null,
   nutrition,label_style:typeof raw.labelStyle==='string'?raw.labelStyle.slice(0,120):null,payload
  };
  arr.push(row);
 }
 return {rows:arr,photos,stats:{total:arr.length,ready,prep,inlinePhotos:inline,linkedPhotos:references,needsReview}};
}
app.post(api+'/catalog/import',auth,async(req,res)=>{
 let content;
 try{content=verifyCatalog(req.body)}
 catch(err){return res.status(400).json({ok:false,error:err.message})}
 const client=await pool.connect().catch(()=>null);
 if(!client)return res.status(503).json({ok:false,error:'Нет соединения с базой.'});
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(41508015)');
  const existing=await client.query('SELECT (SELECT count(*)::int FROM farukh_print.products) AS products, (SELECT count(*)::int FROM farukh_print.catalog_revisions) AS revisions');
  if(existing.rows[0].products||existing.rows[0].revisions){
   await client.query('ROLLBACK');
   return res.status(409).json({ok:false,error:'Каталог Neon уже содержит данные. Автоматическая перезапись запрещена.'});
  }
  for(const p of content.rows){
   await client.query(
    'INSERT INTO farukh_print.products (id,kind,name,category,composition,storage,shelf_life_hours,needs_review,approved_for_print,net_weight,weight_unit,tolerance,nutrition,label_style,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10,$11,$12::jsonb,$13,$14::jsonb)',
    [p.id,p.kind,p.name,p.category,p.composition,p.storage,p.shelf_life_hours,p.needs_review,p.net_weight,p.weight_unit,p.tolerance,JSON.stringify(p.nutrition),p.label_style,JSON.stringify(p.payload)]
   );
  }
  for(const p of content.photos){
   await client.query('INSERT INTO farukh_print.product_photos (product_id,mime_type,image_data,external_url,byte_size) VALUES ($1,$2,$3,$4,$5)',
    [p.id,p.mime,p.buffer||null,p.url||null,p.buffer?.length||null]);
  }
  const id=await client.query("INSERT INTO farukh_print.catalog_revisions(source,products_count,ready_count,prep_count,note) VALUES ('owner-json-first-import',$1,$2,$3,'Catalog copy; no production staff access') RETURNING id",
    [content.stats.total,content.stats.ready,content.stats.prep]);
  await client.query("INSERT INTO farukh_print.catalog_backups (revision_id,label,snapshot,note) VALUES ($1,$2,$3::jsonb,$4)",[id.rows[0].id,'Initial owner JSON backup',JSON.stringify(req.body),'Original verified JSON backup; independent from FARUKH AI']);
  await client.query('COMMIT');
  res.status(201).json({ok:true,revision:String(id.rows[0].id),...content.stats,staffConnected:false,printEnabled:false});
 }catch(err){
  try{await client.query('ROLLBACK')}catch{}
  console.error('[print-cloud] import failed',err.code||'error');
  res.status(503).json({ok:false,error:'Не удалось сохранить каталог. Изменения отменены.'});
 }finally{client.release()}
});
app.get(api+'/catalog',auth,async(_req,res)=>{
 try{
  const r=await pool.query("SELECT p.payload,p.id,p.name,p.kind,ph.mime_type,ph.image_data,ph.external_url FROM farukh_print.products p LEFT JOIN farukh_print.product_photos ph ON ph.product_id=p.id ORDER BY p.kind,p.name");
  const products=r.rows.map(row=>{
   const product={...row.payload,id:row.id,name:row.name,kind:row.kind};
   if(row.image_data&&row.mime_type)product.photo='data:'+row.mime_type+';base64,'+Buffer.from(row.image_data).toString('base64');
   else if(row.external_url)product.photo=row.external_url;
   return product;
  });
  res.json({ok:true,format:'farukh-print-catalog-v1',products,staging:true,staffConnected:false});
 }catch(err){console.error('[print-cloud] catalog read failed',err.code||'error');res.status(503).json({ok:false,error:'Не удалось прочитать каталог.'})}
});
app.use(api,(_req,res)=>res.status(404).json({ok:false,error:'Неизвестный адрес API.'}));
app.listen(PORT,'0.0.0.0',()=>{
 console.info('[print-cloud] test service listening, separate Neon storage, staff sync disabled');
 if(neonFnUrl.startsWith('https://'))setTimeout(async()=>{
  try{
   const r=await fetch(neonFnUrl,{signal:AbortSignal.timeout(15000)});
   const probe=await r.json().catch(()=>({}));
   console.info('[print-cloud] Neon native probe',r.status,JSON.stringify({ok:probe.ok,points:probe.points,neonConnected:probe.neonConnected,code:probe.error||null}).slice(0,220));
  }catch(err){console.warn('[print-cloud] Neon native probe unavailable',err.name||'error')}
 },1500);
});
process.on('SIGTERM',()=>{pool.end().finally(()=>process.exit(0))});
