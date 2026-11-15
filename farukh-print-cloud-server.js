// FARUKH PRINT owner cloud — separate from FARUKH AI and production staff print.
// Only one dashboard, one first-party login and Neon Auth verified JWT -> Neon Data API.
import express from 'express';
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
   const result=await fetch('https://br-solitary-brook-baxakvoe-fpprobe.compute.c-8.eu-central-1.aws.neon.tech/healthz',{signal:AbortSignal.timeout(14000)});
   const raw=(await result.text()).slice(0,320);
   let data={};try{data=JSON.parse(raw)}catch{}
   console.info('[farukh-print] test-only Neon native query',JSON.stringify({status:result.status,type:result.headers.get('content-type'),ok:data.ok,stage:data.stage,products:data.products,excerpt:raw.slice(0,180)}));
  } catch(e) { console.warn('[farukh-print] Neon native probe fetch unavailable',e.name||'error') }
 },2500);
});
