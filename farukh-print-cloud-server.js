// FARUKH PRINT owner cloud — separate from FARUKH AI and production staff print.
// Only one dashboard, one first-party login and Neon Auth verified JWT -> Neon Data API.
import express from 'express';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const app=express();app.enable('strict routing');app.disable('x-powered-by');app.set('trust proxy',1);
const PORT=Number(process.env.PORT)||10000;
const SELF='https://farukh-print-cloud-test-20261115.onrender.com';
const AUTH='https://ep-small-forest-basx2akr.neonauth.c-8.eu-central-1.aws.neon.tech/farukh_print/auth';
const OWNER=String(process.env.FARUKH_PRINT_OWNER_EMAIL||'');
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'public','farukh-print-cloud');
app.use(express.json({limit:'16kb',strict:true}));
app.use((_req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','no-referrer');
 next();
});
app.get('/',(_req,res)=>res.redirect(302,'/cloud/'));
app.get('/cloud',(_req,res)=>res.redirect(302,'/cloud/'));
app.get('/cloud/',(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://ep-small-forest-basx2akr.apirest.c-8.eu-central-1.aws.neon.tech; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 res.sendFile(path.join(ROOT,'index.html'));
});
app.use('/cloud/assets',express.static(ROOT,{index:false,fallthrough:false,maxAge:600000}));
app.get('/healthz',(_req,res)=>res.json({ok:true,service:'farukh-print-owner-cloud',authConfigured:OWNER.includes('@'),staffConnected:false,legacyEndpointsRemoved:true}));

/* Temporary single-PIN owner entry, verified only on server.
 * PIN hash, pepper and HMAC key are configured as Render secret env values.
 * The PIN itself is never included in public JS or GitHub.
 */
const PIN_SALT=process.env.FARUKH_PRINT_PIN_SALT||'';
const PIN_HASH=process.env.FARUKH_PRINT_PIN_HASH||'';
const PIN_PEPPER=process.env.FARUKH_PRINT_PIN_PEPPER||'';
const PIN_SESSION_KEY=process.env.FARUKH_PRINT_SESSION_KEY||'';
const PIN_READY=PIN_SALT.length===32&&PIN_HASH.length===64&&PIN_PEPPER.length>=40&&PIN_SESSION_KEY.length>=40;
const pinLimitByIP=new Map();let globalPinWindow={until:0,count:0};
function pinCookie(res,value,age=1209600){
 res.setHeader('Set-Cookie','fp_owner='+encodeURIComponent(value)+'; Path=/; Max-Age='+age+'; HttpOnly; Secure; SameSite=Lax');
}
function readPinCookie(req){
 const raw=String(req.headers.cookie||'').split(';').find(s=>s.trim().startsWith('fp_owner='));
 if(!raw)return '';
 try{return decodeURIComponent(raw.trim().slice('fp_owner='.length))}catch{return ''}
}
const hmac=(value)=>crypto.createHmac('sha256',PIN_SESSION_KEY).update(value).digest('base64url');
function safeEqual(a,b){
 const x=Buffer.from(String(a)),y=Buffer.from(String(b));
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function validPinSession(req){
 if(!PIN_READY)return false;
 const cookie=readPinCookie(req),point=cookie.lastIndexOf('.');
 if(point<2)return false;
 const message=cookie.slice(0,point),mac=cookie.slice(point+1);
 if(!safeEqual(mac,hmac(message)))return false;
 try{
  const body=JSON.parse(Buffer.from(message,'base64url').toString('utf8'));
  return body.kind==='owner-pin-v1'&&Number.isFinite(body.expires)&&Date.now()<body.expires;
 }catch{return false}
}
function authPin(req,res,next){
 if(!validPinSession(req))return res.status(401).json({ok:false,error:'Срок доступа истёк. Введи код ещё раз.'});
 next();
}
function sameOrigin(req){return req.get('origin')==='https://farukh-print-cloud-test-20261115.onrender.com'}
function pinThrottled(req){
 const now=Date.now(),ip=String(req.ip||'unknown').slice(0,120);
 if(pinLimitByIP.size>1200)pinLimitByIP.clear();
 let rec=pinLimitByIP.get(ip);
 if(!rec||now>rec.until)rec={count:0,until:now+900000};
 if(now>globalPinWindow.until)globalPinWindow={until:now+900000,count:0};
 if(rec.count>=5||globalPinWindow.count>=40)return true;
 rec.count++;globalPinWindow.count++;pinLimitByIP.set(ip,rec);return false;
}
app.get('/api/owner/session',(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.json({ok:true,authorized:validPinSession(req),method:'pin',cloudConnected:false,staffConnected:false});
});
app.post('/api/owner/pin',(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!sameOrigin(req))return res.status(403).json({ok:false,error:'Неверный адрес.'});
 if(!PIN_READY)return res.status(503).json({ok:false,error:'Защита кода ещё не настроена.'});
 if(pinThrottled(req))return res.status(429).json({ok:false,error:'Слишком много попыток. Подожди 15 минут.'});
 const code=req.body?.pin;
 if(typeof code!=='string'||!(/^[0-9]{5,12}$/).test(code))return res.status(401).json({ok:false,error:'Неверный код.'});
 const computed=crypto.scryptSync(code+PIN_PEPPER,Buffer.from(PIN_SALT,'hex'),32,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 if(!safeEqual(computed,PIN_HASH))return res.status(401).json({ok:false,error:'Неверный код.'});
 const data=Buffer.from(JSON.stringify({kind:'owner-pin-v1',expires:Date.now()+1209600000})).toString('base64url');
 pinCookie(res,data+'.'+hmac(data));pinLimitByIP.delete(String(req.ip||'unknown').slice(0,120));
 res.json({ok:true,authorized:true,method:'pin'});
});
app.post('/api/owner/logout',(req,res)=>{
 if(!sameOrigin(req))return res.status(403).json({ok:false,error:'Неверный адрес.'});
 pinCookie(res,'',0);res.json({ok:true});
});
app.get('/api/owner/catalog-status',authPin,(_req,res)=>{
 res.json({ok:true,staffConnected:false,connected:false,
  productsStoredInNeon:110,photosStoredInNeon:110,
  message:'Вход владельца активен. Прямой обмен с Neon ещё проходит проверку.'});
});

const METHODS=new Map([
 ['/get-session','GET'],['/token','GET'],['/sign-in/email','POST'],
 ['/request-password-reset','POST'],['/reset-password','POST'],
 ['/change-password','POST'],['/sign-out','POST']
]);
const attempts=new Map();
function throttle(req){
 const key=String(req.ip||'unknown').slice(0,90),now=Date.now();
 if(attempts.size>2000)attempts.clear();
 let record=attempts.get(key);
 if(!record||now>record.until)record={count:0,until:now+600000};
 record.count++;
 attempts.set(key,record);
 return record.count<=12;
}
function cookies(res,upstream){
 const array=upstream.headers.getSetCookie?.()||[];
 for(const raw of array){
  const v=raw.replace(/;\s*Domain=[^;]*/gi,'').replace(/;\s*Path=[^;]*/gi,'')
   .replace(/;\s*SameSite=[^;]*/gi,'').replace(/;\s*Partitioned/gi,'');
  res.append('Set-Cookie',v+'; Path=/; Secure; HttpOnly; SameSite=Lax');
 }
}
app.use('/owner-auth',async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.get('host')!=='farukh-print-cloud-test-20261115.onrender.com')
  return res.status(421).json({error:'Открой основной адрес FARUKH PRINT Cloud.'});
 const endpoint=req.path;
 if(METHODS.get(endpoint)!==req.method)return res.status(404).json({error:'Действие не найдено.'});
 if(!OWNER.includes('@'))return res.status(503).json({error:'Владелец не настроен на сервере.'});
 if(req.method==='POST'){
  if(req.get('origin')!==SELF)return res.status(403).json({error:'Неверный адрес запроса.'});
  if(!req.is('application/json'))return res.status(415).json({error:'Необходим JSON.'});
  if(['/sign-in/email','/request-password-reset','/reset-password'].includes(endpoint)&&!throttle(req))
   return res.status(429).json({error:'Много попыток. Подожди 10 минут.'});
 }
 let body=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?{...req.body}:{};
 if(endpoint==='/sign-in/email'){
  if(body.login!=='admin'||typeof body.password!=='string'||body.password.length<8||body.password.length>128)
   return res.status(401).json({error:'Неверный логин или пароль.'});
  body={email:OWNER,password:body.password};
 }else if(endpoint==='/request-password-reset'){
  body={email:OWNER,redirectTo:SELF+'/cloud/'};
 }else if(endpoint==='/reset-password'){
  if(typeof body.token!=='string'||body.token.length<16||typeof body.newPassword!=='string'||body.newPassword.length<12)
   return res.status(400).json({error:'Нужна действительная ссылка и пароль от 12 символов.'});
  body={token:body.token,newPassword:body.newPassword};
 }else if(endpoint==='/change-password'){
  if(typeof body.currentPassword!=='string'||typeof body.newPassword!=='string'||body.newPassword.length<12)
   return res.status(400).json({error:'Укажи текущий и новый пароль от 12 символов.'});
  body={currentPassword:body.currentPassword,newPassword:body.newPassword,revokeOtherSessions:true};
 }else if(endpoint==='/sign-out')body={};
 const headers={'Accept':'application/json','Origin':SELF,'Referer':SELF+'/cloud/'};
 if(req.headers.cookie)headers.Cookie=String(req.headers.cookie);
 if(req.method==='POST')headers['Content-Type']='application/json';
 try{
  const upstream=await fetch(AUTH+endpoint,{method:req.method,headers,body:req.method==='POST'?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(16000)});
  const raw=await upstream.text();
  if(!(upstream.headers.get('content-type')||'').includes('json')||raw.length>300000)throw Error('bad_auth_payload');
  cookies(res,upstream);
  res.status(upstream.status).type('json').send(raw);
 }catch(e){
  console.error('[farukh-print] auth provider unavailable',e.name||'unknown');
  res.status(503).json({error:'Авторизация Neon временно недоступна.'});
 }
});
app.use('/api/print-cloud/v1',(_req,res)=>res.status(410).json({error:'Старый API отключён. Используй панель владельца FARUKH PRINT Cloud.'}));
app.use((_req,res)=>res.status(404).json({error:'Страница не найдена.'}));
app.listen(PORT,'0.0.0.0',()=>{
 console.info('[farukh-print] minimal owner console live; staff production untouched');
 setTimeout(async()=>{
  try {
   const result=await fetch('https://br-solitary-brook-baxakvoe-fpdbcheck.compute.c-8.eu-central-1.aws.neon.tech/',{signal:AbortSignal.timeout(14000)});
   const raw=(await result.text()).slice(0,320);
   let data={};try{data=JSON.parse(raw)}catch{}
   console.info('[farukh-print] test-only Neon native query',JSON.stringify({status:result.status,type:result.headers.get('content-type'),ok:data.ok,stage:data.stage,products:data.products,excerpt:raw.slice(0,180)}));
  } catch(e) { console.warn('[farukh-print] Neon native probe fetch unavailable',e.name||'error') }
 },2500);
});
