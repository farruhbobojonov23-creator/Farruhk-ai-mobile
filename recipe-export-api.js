import {recipeWord,recipeSections} from './recipe-word.js';
import {cleanState} from './assistant-store.js';
export function validGoogleEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='script.google.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/macros\/s\/[A-Za-z0-9_-]{15,}\/exec$/.test(u.pathname)}catch{return false}}
export function installRecipeExportApi(app,{request=fetch}={}){
 const recipeFrom=raw=>{if(!raw||typeof raw.id!=='string'||!raw.id||!raw.name?.trim()||!Array.isArray(raw.ingredients)||raw.ingredients.length>300||raw.ingredients.some(i=>!i||typeof i!=='object'))throw Error('Неверная техкарта.');return cleanState({recipes:[raw]}).recipes[0]};
 app.post('/api/recipes/word',async(req,res)=>{try{const recipe=recipeFrom(req.body?.recipe),buffer=await recipeWord(recipe);res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.set('Content-Disposition',"attachment; filename=recipe.docx; filename*=UTF-8''"+encodeURIComponent('ТТК_'+recipe.name+'.docx'));res.send(buffer)}catch{res.status(400).json({error:'Не удалось сформировать Word. Проверь техкарту.'})}});
 app.post('/api/recipes/google-sync',async(req,res)=>{
  try{
   const {endpoint,key,action,digest}=req.body||{};
   if(!validGoogleEndpoint(endpoint)||typeof key!=='string'||key.length<24||key.length>200)return res.status(400).json({error:'Проверь адрес подключения Google и ключ.'});
   const recipe=action==='check'?null:recipeFrom(req.body?.recipe);
   if(recipe&&recipe.status!=='ready')return res.status(400).json({error:'В Google передаются только готовые ТТК.'});
   if(recipe&&!/^[a-f0-9]{64}$/.test(digest||''))return res.status(400).json({error:'Неверная версия ТТК.'});
   const payload={key,action:recipe?'sync':'check',digest,...(recipe?recipeSections(recipe):{})};
   const response=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(100000),redirect:'follow'});
   if(!response.ok)throw Error('Google временно недоступен. Сохранённая ТТК осталась на устройстве.');
   const result=await response.json();
   if(result.ok!==true)throw Error(result.error||'Google не подтвердил сохранение.');
   if(recipe&&(result.recipeId!==recipe.id||result.digest!==digest))throw Error('Google не подтвердил версию ТТК.');
   res.json({ok:true,recipeId:result.recipeId,digest:result.digest,documentUrl:result.documentUrl,tabId:result.tabId});
  }catch(e){res.status(502).json({error:e.message||'Не удалось записать ТТК в Google.'})}
 });
}
