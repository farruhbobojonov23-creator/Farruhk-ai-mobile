// FARUKH PRINT owner cloud — separate from FARUKH AI and production staff print.
// Only one dashboard, one first-party login and Neon Auth verified JWT -> Neon Data API.
import express from 'express';
import {jwks,selfCheck,signOwnerJWT} from './farukh-print-jwt.js';
import {mountPrintNeonBridge} from './farukh-print-neon-proxy.js';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const app=express();app.enable('strict routing');app.disable('x-powered-by');app.set('trust proxy',1);
const PORT=Number(process.env.PORT)||10000;
const SELF='https://farukh-print-cloud-test-20261115.onrender.com';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'public','farukh-print-cloud');
app.use(express.json({limit:'2mb',strict:true}));
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
app.get('/.well-known/farukh-print-jwks.json',(_req,res)=>{
 res.setHeader('Cache-Control','public,max-age=120');
 res.json(jwks());
});
app.get('/api/owner/jwt-check',authPin,(_req,res)=>{
 try{res.json({ok:selfCheck(),jwtSigningReady:selfCheck()})}
 catch(e){res.status(503).json({ok:false,jwtSigningReady:false,error:'Signing key missing or incorrect'})}
});
app.get('/healthz',(_req,res)=>res.json({ok:true,service:'farukh-print-owner-cloud',pinReady:PIN_READY,staffConnected:false,legacyEndpointsRemoved:true}));

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
const GATEWAY=String(process.env.FARUKH_PRINT_GATEWAY_KEY||'');
const DATA_API='https://ep-small-forest-basx2akr.apirest.c-8.eu-central-1.aws.neon.tech/farukh_print/rest/v1';
async function gatewayCall(method,fields={}){
 if(GATEWAY.length!==64)throw Error('SERVICE_CONFIGURATION_REQUIRED');
 const response=await fetch(DATA_API+'/rpc/'+method,{method:'POST',headers:{
  'Content-Type':'application/json','Accept':'application/json',
  'Content-Profile':'farukh_print_api','Accept-Profile':'farukh_print_api'},
  body:JSON.stringify({key:GATEWAY,...fields}),signal:AbortSignal.timeout(18000)});
 const json=await response.json().catch(()=>({}));
 if(!response.ok||json?.ok===false){
  const code=String(json?.code||'');
  const safeMessage=String(json?.message||json?.error||'').slice(0,250);
  console.warn('[farukh-print] Neon Data API',method,'HTTP',response.status,'code',code);
  throw Error('NEON_DATA_API_'+response.status+(code?'_'+code:'')+(safeMessage?'_'+safeMessage:''));
 }
 return json;
}
async function handleGateway(res,method,fields={}){
 try{const result=await gatewayCall(method,fields);res.setHeader('Cache-Control','no-store');res.json(result)}
 catch(e){res.status(503).json({ok:false,error:'Нет соединения с Neon. Данные сохранены, повтори позже.'})}
}
app.get('/api/owner/cloud/status',authPin,async(_req,res)=>handleGateway(res,'gateway_status'));
app.get('/api/owner/cloud/catalog',authPin,async(_req,res)=>handleGateway(res,'gateway_catalog'));


mountPrintNeonBridge(app,authPin);
app.use('/api/print-cloud/v1',(_req,res)=>res.status(410).json({error:'Старый API отключён. Используй панель владельца FARUKH PRINT Cloud.'}));
app.use((_req,res)=>res.status(404).json({error:'Страница не найдена.'}));
app.listen(PORT,'0.0.0.0',()=>{
 console.info('[farukh-print] PIN console live, pinConfigured='+PIN_READY+', staff gateway untouched');
 setTimeout(async()=>{
  try{const response=await fetch('https://br-solitary-brook-baxakvoe-fpcloudapi.compute.c-8.eu-central-1.aws.neon.tech/',{
    headers:{Authorization:'Bearer '+GATEWAY},signal:AbortSignal.timeout(15000)});
   const data=await response.json().catch(()=>({}));
   console.info('[farukh-print] Neon FUNCTION SQL probe',JSON.stringify({status:response.status,ok:data.ok,products:data.products,error:data.error,type:data.type,serverReady:data.serverReady,headerReady:data.headerReady,gatewayReady:GATEWAY.length===64,dbPasswordPresent:data.dbPasswordPresent,hostValid:data.hostValid,sqlMessage:data.sqlMessage}));
  }catch(e){console.warn('[farukh-print] Neon FUNCTION SQL probe unavailable',e.name||'error')}
 },2300);
});

// Temporary public metadata probe; no credentials or data returned.
setTimeout(async()=>{
 try {
  const res=await fetch('https://br-solitary-brook-baxakvoe-fpjwt.compute.c-8.eu-central-1.aws.neon.tech/probe',{signal:AbortSignal.timeout(15000)});
  const data=await res.json().catch(()=>({}));
  console.info('[farukh-print] pg runtime check',JSON.stringify({status:res.status,ok:data.ok,pgAvailable:data.pgAvailable,pgError:data.pgError,dbHostIsNeon:data.dbHostIsNeon,dbHasPassword:data.dbHasPassword}));
 }catch(e){console.warn('[farukh-print] pg runtime check unavailable',e.name||'error')}
},2500);
