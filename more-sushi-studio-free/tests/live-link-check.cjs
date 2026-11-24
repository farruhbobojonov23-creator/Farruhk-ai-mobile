/* User-owned production URLs: read-only navigation probe without credentials.
 * Results are context, not proof of authenticated business functionality.
 * All requests are GET without tokens; no write or login.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const services=[
 {project:'MORE SUSHI STUDIO',url:'https://more-sushi-studio.onrender.com/index.html?ocean=1'},
 {project:'FARRUH AI',url:'https://farruhk-ai-mobile.onrender.com/'},
 {project:'FARUKH REVISION',url:'https://more-sushi-studio.onrender.com/revision.html?rev=045'},
 {project:'FARUKH PRINT',url:'https://farruhk-ai-mobile.onrender.com/farukh-print/staff/'},
 {project:'FARUKH KITCHEN',url:'https://chefaka.onrender.com/'},
 {project:'SHEF51',url:'https://shef51.onrender.com/'},
 {project:'СУШИ БЕРИ',url:'https://sushi-beri.ru/murmansk'}
];
const out=path.join(__dirname,'qa-results');fs.mkdirSync(out,{recursive:true});
async function probe(s){
 const now=Date.now();let response;
 try{
  response=await fetch(s.url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(20000),
   headers:{'Accept':'text/html,*/*;q=0.8','User-Agent':'FARRUH-WORKSPACE-QA/1.0'}});
  const status=response.status;
  try{await response.body?.cancel()}catch{}
  const reachable=[200,201,202,203,204,206,301,302,303,307,308,401,403,429].includes(status);
  return {project:s.project,url:s.url,http_status:status,response_ms:Date.now()-now,
    redirect_url:response.url!==s.url?response.url:null,reachable,
    note:status===401||status===403?'Сервер отвечает, но доступ ограничен':
     status>=500?'Ошибка сервера 5xx':status===404?'Путь отсутствует (404)':
     reachable?'Сервер отвечает; работу внутри приложения нужно проверять отдельно':'Неожиданный HTTP статус'};
 }catch(e){
  return {project:s.project,url:s.url,http_status:null,response_ms:Date.now()-now,reachable:false,note:'Сбой запроса/таймаут: '+String(e?.name||'ошибка')};
 }
}
(async()=>{
 const results=await Promise.all(services.map(probe));
 const data={checked_at:new Date().toISOString(),notes:'Не проверяет вход, TTK, печать, Android, внутренние ошибки JS. Доступность сети не равна работоспособности приложения.',results};
 fs.writeFileSync(path.join(out,'live-link-health.json'),JSON.stringify(data,null,2));
 const good=results.filter(x=>x.reachable).length;
 for(const x of results)console.log((x.reachable?'SERVER REPLIED':'CHECK REQUIRED')+' '+x.project+' HTTP '+(x.http_status??'unknown')+' '+x.response_ms+'ms '+x.note);
 console.log('External URLs answering requests: '+good+'/'+results.length+'. This probe is informative only.');
})().catch(e=>{console.error(e);process.exitCode=1});
