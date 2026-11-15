
/* FARUKH PRINT: isolated owner operations and employee preview/print journal.
 * Database writes and employee access are server-side; deployed independently
 * from the existing Bluetooth print gateway and existing FARUKH AI app.
 */
import crypto from 'node:crypto';
import {Pool} from 'pg';

const cn=String(process.env.FARUKH_PRINT_PG_URL||'');
const pool=cn?new Pool({connectionString:cn,max:3,connectionTimeoutMillis:9000,idleTimeoutMillis:15000,statement_timeout:13000,query_timeout:17000}):null;
pool?.on('error',err=>console.error('[print-ops] idle pool',err.code||'error'));
const secret=String(process.env.FARUKH_PRINT_SESSION_KEY||'');
const pepper=String(process.env.FARUKH_PRINT_PIN_PEPPER||'');
const origin='https://farukh-print-cloud-test-20261115.onrender.com';
const statusSet=new Set(['active','disabled','blocked']);
const deviceStates=new Set(['approved','blocked','revoked']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const err=(res,e)=>{console.error('[print-ops] failed',String(e?.code||e?.name||'error'));return res.status(503).json({ok:false,error:'Не удалось выполнить действие в Neon. Попробуй ещё раз.'})};
function trim(s,n=120){return String(s??'').trim().slice(0,n)}
function safeEq(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function cryptoHash(password){
 const salt=crypto.randomBytes(16).toString('hex');
 return salt+':'+crypto.scryptSync(password+pepper,Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
}
function verifyPassword(p,stored){
 if(!/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(stored||''))return false;
 const [salt,hash]=stored.split(':');
 return safeEq(crypto.scryptSync(p+pepper,Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex'),hash);
}
function cookie(req,name){
 const p=String(req.headers.cookie||'').split(';').find(s=>s.trim().startsWith(name+'='));
 return p?decodeURIComponent(p.trim().slice(name.length+1)):'';
}
function setCookie(res,name,val,maxAge){
 res.append('Set-Cookie',name+'='+encodeURIComponent(val)+'; Path=/; Max-Age='+maxAge+'; HttpOnly; Secure; SameSite=Lax');
}
function signedSession(id){
 const body=Buffer.from(JSON.stringify({id,iat:Date.now(),exp:Date.now()+8*3600_000})).toString('base64url');
 return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');
}
function verifySession(s){
 const cut=s.lastIndexOf('.');if(cut<0||secret.length<40)return null;
 const body=s.slice(0,cut),sig=s.slice(cut+1);
 if(!safeEq(sig,crypto.createHmac('sha256',secret).update(body).digest('base64url')))return null;
 try{const b=JSON.parse(Buffer.from(body,'base64url').toString());return b.exp>Date.now()&&Number.isFinite(b.iat)&&uuid.test(b.id)?b:null}catch{return null}
}
function sameOrigin(req,res,next){
 if(req.method==='GET'||req.get('origin')===origin)return next();
 return res.status(403).json({ok:false,error:'Запрос отклонён: другой адрес.'});
}
async function staffAuth(req,res,next){
 const session=verifySession(cookie(req,'fp_staff'));
 if(!session)return res.status(401).json({ok:false,error:'Войди как сотрудник.'});
 try{
  const q=await pool.query('SELECT id,login,display_name,role,location_id,status,expires_at,updated_at FROM farukh_print.staff_accounts WHERE id=$1',[session.id]);
  const s=q.rows[0];
  if(!s||s.status!=='active'||(s.expires_at&&new Date(s.expires_at)<new Date())||new Date(s.updated_at).getTime()>session.iat+1000)
   return res.status(401).json({ok:false,error:'Доступ сотрудника отключён или истёк.'});
  req.staff=s;next();
 }catch(e){err(res,e)}
}
function devHash(t){return crypto.createHash('sha256').update(t+secret).digest('hex')}
function maskedDevice(req){const token=cookie(req,'fp_device');return /^[0-9a-f]{64}$/.test(token)?devHash(token):null}
async function deviceFor(req){
 const hash=maskedDevice(req);
 if(!hash)return null;
 const q=await pool.query('SELECT id,display_name,location_id,staff_id,status,last_seen_at FROM farukh_print.devices WHERE fingerprint_hash=$1',[hash]);
 return q.rows[0]||null;
}
function staffJson(s){return {id:s.id,login:s.login,name:s.display_name,role:s.role,locationId:s.location_id}}
function bad(res,message){return res.status(400).json({ok:false,error:message})}
const failMap=new Map();
function limited(req,login){
 const key=String(req.ip||'unknown').slice(0,70)+':'+login;
 const now=Date.now();let data=failMap.get(key)||{n:0,until:now+900000};
 if(now>data.until)data={n:0,until:now+900000};
 if(data.n>=6)return true;data.n++;failMap.set(key,data);
 if(failMap.size>3000)failMap.clear();
 return false;
}
function clearLimit(req,login){failMap.delete(String(req.ip||'unknown').slice(0,70)+':'+login)}
export function mountPrintOperations(app,authPin){
 // Owner operations, entirely protected by the existing PIN session.
 app.use('/api/owner/ops',authPin,sameOrigin,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!pool)return res.status(503).json({ok:false,error:'Neon не подключён.'});
  const url=req.path;
  try{
   if(req.method==='GET'&&url==='/summary'){
    const q=await pool.query(`SELECT
      (SELECT count(*)::int FROM farukh_print.staff_accounts) staff,
      (SELECT count(*)::int FROM farukh_print.devices) devices,
      (SELECT count(*)::int FROM farukh_print.devices WHERE status='pending') pending,
      (SELECT count(*)::int FROM farukh_print.print_events) events`);
    return res.json({ok:true,...q.rows[0]});
   }
   if(req.method==='GET'&&url==='/locations'){
    const q=await pool.query('SELECT id,code,name,active FROM farukh_print.locations ORDER BY id');
    return res.json({ok:true,locations:q.rows});
   }
   if(req.method==='GET'&&url==='/staff'){
    const q=await pool.query(`SELECT s.id,s.login,s.display_name AS name,s.role,s.status,s.location_id AS "locationId",
        l.name AS "locationName",s.expires_at AS "expiresAt",s.created_at AS "createdAt"
      FROM farukh_print.staff_accounts s LEFT JOIN farukh_print.locations l ON l.id=s.location_id ORDER BY s.created_at DESC`);
    return res.json({ok:true,staff:q.rows});
   }
   if(req.method==='POST'&&url==='/staff'){
    const b=req.body||{},name=trim(b.name),login=trim(b.login,120).toLowerCase();
    const locationId=Number(b.locationId),role=b.role==='manager'?'manager':'employee';
    if(name.length<1||name.length>120||!/^[a-z0-9._-]{3,48}$/.test(login)||
       !Number.isInteger(locationId)||locationId<1||locationId>4) return bad(res,'Проверь имя, логин и точку.');
    const secretPassword=crypto.randomBytes(12).toString('base64url');
    const pwhash=cryptoHash(secretPassword);
    try{
     const q=await pool.query(`INSERT INTO farukh_print.staff_accounts
       (login,display_name,role,location_id,status,expires_at,password_hash,credential_algorithm)
       VALUES($1,$2,$3,$4,'active',now()+interval '30 days',$5,'scrypt-v1')
       RETURNING id,login,display_name,role,location_id,expires_at`,
       [login,name,role,locationId,pwhash]);
     return res.json({ok:true,staff:q.rows[0],temporaryPassword:secretPassword});
    }catch(e){
     if(e.code==='23505')return res.status(409).json({ok:false,error:'Такой логин уже существует.'});
     throw e;
    }
   }
   if(req.method==='POST'&&url==='/staff/update'){
    const b=req.body||{};
    if(!uuid.test(String(b.id||'')))return bad(res,'Неверный сотрудник.');
    const newStatus=b.status;
    const loc=Number(b.locationId);
    if(!statusSet.has(newStatus)||!Number.isInteger(loc)||loc<1||loc>4)
      return bad(res,'Проверь статус и точку сотрудника.');
    const q=await pool.query(`UPDATE farukh_print.staff_accounts
       SET status=$2,location_id=$3,updated_at=now() WHERE id=$1 RETURNING id,status,location_id`,
      [b.id,newStatus,loc]);
    if(!q.rows.length)return res.status(404).json({ok:false,error:'Сотрудник не найден.'});
    return res.json({ok:true,staff:q.rows[0]});
   }
   if(req.method==='POST'&&url==='/staff/reset'){
    const b=req.body||{};if(!uuid.test(String(b.id||'')))return bad(res,'Неверный сотрудник.');
    const pass=crypto.randomBytes(12).toString('base64url');
    const hash=cryptoHash(pass);
    const q=await pool.query(`UPDATE farukh_print.staff_accounts SET password_hash=$2,
       credential_algorithm='scrypt-v1',updated_at=now() WHERE id=$1 RETURNING id,login`,[b.id,hash]);
    if(!q.rows.length)return res.status(404).json({ok:false,error:'Сотрудник не найден.'});
    return res.json({ok:true,temporaryPassword:pass,login:q.rows[0].login});
   }
   if(req.method==='GET'&&url==='/devices'){
    const q=await pool.query(`SELECT d.id,d.display_name AS name,d.status,d.location_id AS "locationId",
      l.name AS "locationName",s.display_name AS "staffName",d.staff_id AS "staffId",
      d.created_at AS "createdAt",d.last_seen_at AS "lastSeenAt"
      FROM farukh_print.devices d LEFT JOIN farukh_print.staff_accounts s ON s.id=d.staff_id
       LEFT JOIN farukh_print.locations l ON l.id=d.location_id ORDER BY d.created_at DESC LIMIT 300`);
    return res.json({ok:true,devices:q.rows});
   }
   if(req.method==='POST'&&url==='/devices/update'){
    const b=req.body||{},loc=Number(b.locationId);
    if(!uuid.test(String(b.id||''))||!deviceStates.has(b.status)||!Number.isInteger(loc)||loc<1||loc>4)
      return bad(res,'Неверные параметры устройства.');
    // Approved devices must remain on their employee's assigned point.
    const q=await pool.query(`UPDATE farukh_print.devices d SET status=$2,location_id=$3,updated_at=now()
       FROM farukh_print.staff_accounts s WHERE d.id=$1 AND s.id=d.staff_id
         AND ($2 <> 'approved' OR (s.status='active' AND s.location_id=$3))
       RETURNING d.id,d.status,d.location_id`,[b.id,b.status,loc]);
    if(!q.rows.length)return res.status(409).json({ok:false,error:'Устройство не найдено или точка не совпадает с сотрудником.'});
    return res.json({ok:true,device:q.rows[0]});
   }
   if(req.method==='GET'&&url==='/events'){
    const limit=Math.min(150,Math.max(1,Number(req.query.limit)||80));
    const q=await pool.query(`SELECT e.id,e.event_at AS "eventAt",e.product_name AS product,
       e.label_format AS format,e.quantity,e.result,e.failure_reason AS "failureReason",
       l.name AS location,s.display_name AS employee,d.display_name AS device
       FROM farukh_print.print_events e
       LEFT JOIN farukh_print.locations l ON l.id=e.location_id
       LEFT JOIN farukh_print.staff_accounts s ON s.id=e.staff_id
       LEFT JOIN farukh_print.devices d ON d.id=e.device_id
       ORDER BY e.id DESC LIMIT $1`,[limit]);
    return res.json({ok:true,events:q.rows});
   }
   if(req.method==='GET'&&url==='/labels/check'){
    const q=await pool.query(`SELECT count(*)::int total,
      count(*) FILTER(WHERE p.kind='prep')::int prep,
      count(*) FILTER(WHERE p.storage IS NULL OR p.shelf_life_hours IS NULL)::int missingStorageOrHours,
      count(*) FILTER(WHERE p.net_weight IS NULL)::int missingWeight,
      count(*) FILTER(WHERE p.kind='ready' AND nullif(btrim(coalesce(p.composition,'')),'') IS NULL)::int readyMissingComposition,
      count(*) FILTER(WHERE p.approved_for_print)::int approved,
      count(*) FILTER(WHERE ph.product_id IS NULL)::int withoutPhotos
      FROM farukh_print.products p LEFT JOIN farukh_print.product_photos ph ON ph.product_id=p.id WHERE p.active`);
    return res.json({ok:true,checks:q.rows[0],hardwareTested:false,formats:['58x40','30x20']});
   }
   if(req.method==='GET'&&url.startsWith('/labels/product/')){
    const id=decodeURIComponent(url.slice('/labels/product/'.length));
    if(id.length>128)return bad(res,'Слишком длинный код.');
    const q=await pool.query(`SELECT p.id,p.name,p.kind,p.category,p.composition,p.storage,
       p.shelf_life_hours AS hours,p.net_weight AS weight,p.weight_unit AS "weightUnit",
       p.tolerance,p.nutrition,p.approved_for_print AS approved,p.needs_review AS "needsReview"
      FROM farukh_print.products p WHERE id=$1 AND active`,[id]);
    if(!q.rows.length)return res.status(404).json({ok:false,error:'Товар не найден.'});
    return res.json({ok:true,product:q.rows[0]});
   }
   if(req.method==='POST'&&url==='/labels/approval'){
    const b=req.body||{};
    if(typeof b.id!=='string'||b.id.length>128||typeof b.approved!=='boolean')
      return bad(res,'Неверный выбор товара.');
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     const record=await client.query('SELECT id,kind,storage,shelf_life_hours,composition,net_weight FROM farukh_print.products WHERE id=$1 AND active FOR UPDATE',[b.id]);
     if(!record.rows.length){await client.query('ROLLBACK');return res.status(404).json({ok:false,error:'Нет такого товара.'})}
     const p=record.rows[0];
     if(b.approved&&(!p.storage||!p.shelf_life_hours||
       p.kind==='ready'&&(!p.net_weight||!p.composition))){
       await client.query('ROLLBACK');return bad(res,'Для допуска к печати нужны условия, срок хранения, а у готового товара также масса и состав.');
     }
     await client.query('UPDATE farukh_print.products SET approved_for_print=$2,needs_review=NOT $2,updated_at=now() WHERE id=$1',[b.id,b.approved]);
     await client.query('COMMIT');
     return res.json({ok:true,approved:b.approved});
    }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release()}
   }
   return res.status(404).json({ok:false,error:'Неизвестный раздел.'});
  }catch(e){err(res,e)}
 });
 // Separate staff session. Never re-use the owner PIN as an employee password.
 app.post('/api/staff/login',sameOrigin,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const login=trim(req.body?.login,120).toLowerCase(),pass=req.body?.password;
  if(!/^[a-z0-9._-]{3,48}$/.test(login)||typeof pass!=='string'||pass.length>100)
   return bad(res,'Неверный логин или пароль.');
  if(limited(req,login))return res.status(429).json({ok:false,error:'Слишком много попыток. Попробуй позже.'});
  try{
   const q=await pool.query(`SELECT * FROM farukh_print.staff_accounts WHERE login=$1 AND status='active'
      AND (expires_at IS NULL OR expires_at>now())`,[login]);
   const s=q.rows[0];
   if(!s||!verifyPassword(pass,s.password_hash))
    return res.status(401).json({ok:false,error:'Неверный логин или пароль.'});
   clearLimit(req,login);
   setCookie(res,'fp_staff',signedSession(s.id),8*3600);
   return res.json({ok:true,staff:staffJson(s)});
  }catch(e){err(res,e)}
 });
 app.post('/api/staff/logout',sameOrigin,(_req,res)=>{
  setCookie(res,'fp_staff','',0);res.json({ok:true});
 });
 app.use('/api/staff',staffAuth,sameOrigin,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!pool)return res.status(503).json({ok:false,error:'База ещё не подключена.'});
  const url=req.path;
  try{
   if(req.method==='GET'&&url==='/me'){
    return res.json({ok:true,staff:staffJson(req.staff),device:await deviceFor(req)});
   }
   if(req.method==='POST'&&url==='/devices/request'){
    const name=trim(req.body?.name,100);
    if(!name)return bad(res,'Укажи название устройства.');
    let token=cookie(req,'fp_device');
    if(!/^[0-9a-f]{64}$/.test(token))token=crypto.randomBytes(32).toString('hex');
    const fingerprint=devHash(token);
    const existing=await pool.query('SELECT id,staff_id,status FROM farukh_print.devices WHERE fingerprint_hash=$1',[fingerprint]);
    if(existing.rows.length){
     const d=existing.rows[0];
     if(d.staff_id!==req.staff.id)return res.status(409).json({ok:false,error:'Устройство зарегистрировано другим сотрудником.'});
     setCookie(res,'fp_device',token,90*24*3600);
     return res.json({ok:true,id:d.id,status:d.status});
    }
    const q=await pool.query(`INSERT INTO farukh_print.devices
     (display_name,fingerprint_hash,staff_id,location_id,status,app_version,last_seen_at)
     VALUES ($1,$2,$3,$4,'pending','owner-staff-cloud-v1',now()) RETURNING id,status`,
      [name,fingerprint,req.staff.id,req.staff.location_id]);
    setCookie(res,'fp_device',token,90*24*3600);
    return res.json({ok:true,id:q.rows[0].id,status:'pending'});
   }
   if(req.method==='GET'&&url==='/catalog'){
    const q=await pool.query(`SELECT id,name,kind,category,composition,storage,
      shelf_life_hours AS hours,net_weight AS weight,weight_unit AS "weightUnit",tolerance,nutrition,
      approved_for_print AS approved FROM farukh_print.products WHERE active ORDER BY name`);
    return res.json({ok:true,products:q.rows});
   }
   if(req.method==='POST'&&url==='/print/request'){
    const b=req.body||{},format=b.format,qty=Number(b.quantity),id=trim(b.productId,128);
    if(!['58x40','30x20'].includes(format)||!Number.isInteger(qty)||qty<1||qty>50||id.length<1)
     return bad(res,'Проверь формат, количество (1–50) и товар.');
    const device=await deviceFor(req);
    if(!device||device.status!=='approved'||device.staff_id!==req.staff.id||device.location_id!==req.staff.location_id)
     return res.status(403).json({ok:false,error:'Это устройство ещё не разрешено владельцем на данной точке.'});
    const prod=await pool.query('SELECT id,name,kind,approved_for_print FROM farukh_print.products WHERE id=$1 AND active',[id]);
    const p=prod.rows[0];
    if(!p||!p.approved_for_print)return res.status(403).json({ok:false,error:'Товар ещё не допущен владельцем к печати.'});
    if(format==='30x20'&&p.kind!=='prep')
      return res.status(403).json({ok:false,error:'30×20 предназначен для полуфабрикатов.'});
    const e=await pool.query(`INSERT INTO farukh_print.print_events
       (staff_id,device_id,location_id,product_id,product_name,label_format,quantity,result,meta)
       VALUES($1,$2,$3,$4,$5,$6,$7,'requested',$8::jsonb) RETURNING id`,
      [req.staff.id,device.id,device.location_id,p.id,p.name,format,qty,JSON.stringify({source:'cloud-staff-preview',printerConfirmed:false})]);
    return res.json({ok:true,eventId:e.rows[0].id,status:'requested'});
   }
   if(req.method==='POST'&&url==='/print/confirm'){
    const b=req.body||{},result=b.result;
    if(!['completed','failed','cancelled'].includes(result)||!/^[0-9]+$/.test(String(b.eventId||'')))
     return bad(res,'Неверный результат печати.');
    const device=await deviceFor(req);
    if(!device||device.status!=='approved'||device.staff_id!==req.staff.id||device.location_id!==req.staff.location_id)
     return res.status(403).json({ok:false,error:'Устройство недоступно.'});
    const q=await pool.query(`UPDATE farukh_print.print_events SET
       result=$4,failure_reason=$5,meta=meta||$6::jsonb
       WHERE id=$1 AND staff_id=$2 AND device_id=$3 AND result='requested'
       RETURNING id,result`,
       [b.eventId,req.staff.id,device.id,result,trim(b.reason,200)||null,
        JSON.stringify({operatorReported:true,physicalPrinterTelemetry:false})]);
    if(!q.rows.length)return res.status(409).json({ok:false,error:'Запись отсутствует или уже завершена.'});
    return res.json({ok:true,...q.rows[0]});
   }
   return res.status(404).json({ok:false,error:'Неизвестная команда.'});
  }catch(e){err(res,e)}
 });
}
