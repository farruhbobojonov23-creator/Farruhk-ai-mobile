// Isolated FARUKH PRINT Neon Data API bridge.
// PIN verification is performed in Render before a short-lived signed JWT is minted.
// Neon verifies the signature against our *public* JWKS. No database passwords leave Neon.
// All endpoints initially target a copy of the catalog in staging-pin-jwt-20261115.
import {signOwnerJWT} from './farukh-print-jwt.js';
const STAGE_API='https://ep-polished-frost-baf2s4dg.apirest.c-8.eu-central-1.aws.neon.tech/farukh_print/rest/v1';
const PRIMARY_API='https://ep-small-forest-basx2akr.apirest.c-8.eu-central-1.aws.neon.tech/farukh_print/rest/v1';
function routeMap(){return {
 '/status':{name:'cloud_status',read:true},
 '/catalog':{name:'catalog_read',read:true},
 '/save':{name:'save_product',read:false},
 '/archive':{name:'archive_product',read:false},
 '/backup':{name:'snapshot_create',read:false}
}}
export function mountPrintNeonBridge(app,authPin){
 app.use('/api/owner/neon',authPin,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const route=routeMap()[req.path];
  if(!route||!(req.method==='GET'&&route.read||req.method==='POST'&&!route.read))
    return res.status(404).json({ok:false,error:'Неизвестное действие'});
  if(req.method==='POST'&&req.get('origin')!=='https://farukh-print-cloud-test-20261115.onrender.com')
    return res.status(403).json({ok:false,error:'Запрос не из админки.'});
  let payload=req.method==='GET'?{}:req.body;
  if(req.method==='POST'&&(payload===null||typeof payload!=='object'||Array.isArray(payload)))
    return res.status(400).json({ok:false,error:'Некорректный запрос.'});
  if(req.path==='/save'&&JSON.stringify(payload).length>1500000)
    return res.status(413).json({ok:false,error:'Фото слишком большое. Макс. 1 МБ.'});
  let token;
  try{token=signOwnerJWT()}catch(e){console.error('[print-bridge] JWT unavailable',e.name||'error');return res.status(503).json({ok:false,error:'Облачный ключ ещё не настроен.'})}
  const api=process.env.FARUKH_PRINT_ACTIVE_NEON_API==='main'?PRIMARY_API:STAGE_API;
  try{
   const response=await fetch(api+'/rpc/'+route.name,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Accept':'application/json',
       'Content-Profile':'farukh_print_api','Accept-Profile':'farukh_print_api'},
    body:JSON.stringify(payload)});
   const raw=await response.text();
   if(raw.length>16000000)return res.status(502).json({ok:false,error:'Слишком большой ответ облака.'});
   let data;
   try{data=JSON.parse(raw)}catch{return res.status(502).json({ok:false,error:'Неверный ответ Neon.'})}
   if(!response.ok) {
    console.warn('[print-bridge] Neon RPC failed',{op:route.name,status:response.status,code:data.code||'rpc-error'});
    return res.status(response.status>=500?503:response.status).json({ok:false,error:data.message||data.error||'Neon отклонил запрос.',code:data.code||null});
   }
   if(data?.ok===false)return res.status(data.conflict?409:400).json(data);
   res.json(data);
  }catch(err){console.error('[print-bridge] Neon temporarily unavailable',{op:route.name,type:err.name||'error'});
   res.status(503).json({ok:false,error:'Соединение с облаком временно недоступно.'})}
 });
}