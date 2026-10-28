'use strict';
/*
 FARUKH KITCHEN OWNER, experimental protected preview.
 Do not connect production customer data until persistent DB + backups are available.
*/
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {URL}=require('node:url');
const PORT=Number(process.env.PORT)||10000;
const ADMIN_USER=process.env.ADMIN_USER||'chef';
const SALT=process.env.ADMIN_PASSWORD_SALT;
const HASH=process.env.ADMIN_PASSWORD_HASH;
const SECRET=process.env.SESSION_SECRET;
if(!SALT||!HASH||!SECRET||SECRET.length<50)throw new Error('Admin credentials are not configured');
const root=path.join(__dirname,'public');
const attempts=new Map();
const maxAge=12*60*60;
const now=()=>Math.floor(Date.now()/1000);
const uaIp=req=>String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
function equal(a,b){const A=Buffer.from(a),B=Buffer.from(b);return A.length===B.length&&crypto.timingSafeEqual(A,B)}
function signature(s){return crypto.createHmac('sha256',SECRET).update(s).digest('hex')}
function session(req){const raw=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('fk_owner='))?.slice(9);
 if(!raw)return false;const [exp,nonce,sig]=raw.split('.');if(!exp||!nonce||!sig||+exp<=now()||+exp>now()+maxAge+30)return false;
 return equal(signature(exp+'.'+nonce),sig);
}
function headers(res,extra={}){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');for(const [k,v]of Object.entries(extra))res.setHeader(k,v)}
function reply(res,status,obj){headers(res,{'Content-Type':'application/json; charset=utf-8'});res.writeHead(status);res.end(JSON.stringify(obj))}
function html(res,status,body){headers(res,{'Content-Type':'text/html; charset=utf-8'});res.writeHead(status);res.end(body)}
const loginPage=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f5e9d8"><title>FARUKH KITCHEN · Вход владельца</title><link rel="stylesheet" href="/login.css"></head><body><div class="shell"><div class="logo"><span>✦</span><div>FARUKH <b>KITCHEN</b><small>ЛИЧНЫЙ УПРАВЛЯЮЩИЙ ЦЕНТР</small></div></div><main><div class="eyebrow">CHAMPAGNE GOLD · OWNER</div><h1>Вход шеф-повара</h1><p>Закрытый кабинет разработчика технологических карт. Доступ только владельцу.</p><form id="login"><label>Логин<input type="text" autocomplete="username" name="username" required></label><label>Пароль<input type="password" autocomplete="current-password" name="password" required></label><button type="submit">Войти в управляющий центр →</button><div id="message" role="alert"></div></form><div class="info">🔒 Защищённый вход · демоверсия. Данные ТТК пока сохраняются локально в вашем браузере и требуют экспорта резервной копии.</div></main></div><script src="/login.js" defer></script></body></html>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
function file(res,file){const safe=path.resolve(root,file);if(!safe.startsWith(root+path.sep))return reply(res,400,{error:'Invalid path'});fs.readFile(safe,(err,buf)=>{if(err)return reply(res,404,{error:'Not found'});headers(res,{'Content-Type':mime[path.extname(safe)]||'application/octet-stream'});res.writeHead(200);res.end(buf)})}
function read(req){return new Promise((ok,no)=>{let b='';req.on('data',x=>{b+=x;if(b.length>4000){req.destroy();no(Error('Too large'))}});req.on('end',()=>ok(b));req.on('error',no)})}
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'https://localhost');const p=u.pathname;
 if(p==='/health')return reply(res,200,{ok:true,app:'FARUKH KITCHEN OWNER',storage:'browser-local demo'});
 if(p==='/api/login'&&req.method==='POST'){
   const ip=uaIp(req),v=attempts.get(ip)||{n:0,until:0};if(v.until<now()){v.n=0;v.until=now()+900}
   if(v.n>=8){res.setHeader('Retry-After',String(v.until-now()));return reply(res,429,{error:'Слишком много попыток. Попробуйте позже.'})}
   const body=JSON.parse(await read(req));const password=String(body.password||'');const name=String(body.username||'').trim();
   if(password.length>160)return reply(res,400,{error:'Некорректный пароль'});
   const found=crypto.pbkdf2Sync(password,Buffer.from(SALT,'hex'),230000,32,'sha256').toString('hex');
   if(name!==ADMIN_USER||!equal(found,HASH)){v.n++;attempts.set(ip,v);return reply(res,401,{error:'Неверный логин или пароль'})}
   attempts.delete(ip);const exp=String(now()+maxAge),nonce=crypto.randomBytes(18).toString('hex');
   res.setHeader('Set-Cookie','fk_owner='+exp+'.'+nonce+'.'+signature(exp+'.'+nonce)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge);
   return reply(res,200,{ok:true,expiresIn:maxAge});
 }
 if(p==='/api/logout'&&req.method==='POST'){res.setHeader('Set-Cookie','fk_owner=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return reply(res,200,{ok:true})}
 if(p==='/api/claim-code'&&req.method==='GET')
   return session(req)?reply(res,200,{bootstrapToken:process.env.FK_OWNER_CLAIM_TOKEN||null}):reply(res,401,{error:'Только для владельца'});
 if(p==='/api/session')return reply(res,200,{authenticated:session(req)});
 if(p==='/api/config')return session(req)?reply(res,200,{sheetUrl:process.env.OWNER_SHEET_URL||''}):reply(res,401,{error:'Требуется вход'});
 if(p==='/login.js'||p==='/login.css')return file(res,p.slice(1));
 if(!session(req)){
   if(p==='/'||p==='/admin'||p==='/index.html')return html(res,200,loginPage);
   return reply(res,401,{error:'Необходим вход владельца'});
 }
 if(p==='/'||p==='/admin'||p==='/index.html')return file(res,'index.html');
 if(p==='/app.js'||p==='/styles.css'||p==='/cloud.js')return file(res,p.slice(1));
 return reply(res,404,{error:'Not found'});
 }catch(e){return reply(res,400,{error:'Некорректный запрос'})}
});
server.listen(PORT,'0.0.0.0',()=>console.log('FARUKH KITCHEN OWNER ready on '+PORT));
