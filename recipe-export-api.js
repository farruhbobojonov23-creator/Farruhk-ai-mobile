import {recipeWord,recipeSections} from './recipe-word.js';
import {cleanState} from './assistant-store.js';
export function validGoogleEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='script.google.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/macros\/s\/[A-Za-z0-9_-]{15,}\/exec$/.test(u.pathname)}catch{return false}}
const isGoogleDocUrl=value=>{
 try{
  const u=new URL(value),parts=u.pathname.split('/').filter(Boolean);
  return u.protocol==='https:'&&u.hostname==='docs.google.com'&&parts[0]==='document'&&parts[1]==='d'&&/^[A-Za-z0-9_-]{10,}$/.test(parts[2]||'');
 }catch{return false}
};
const isGoogleDriveFolderUrl=value=>{
 try{
  const u=new URL(value),parts=u.pathname.split('/').filter(Boolean);
  return u.protocol==='https:'&&u.hostname==='drive.google.com'&&parts[0]==='drive'&&parts[1]==='folders'&&/^[A-Za-z0-9_-]{10,}$/.test(parts[2]||'');
 }catch{return false}
};
const isGoogleSheetUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='docs.google.com'&&/^\/spreadsheets\/d\/[A-Za-z0-9_-]{10,}(?:\/|$)/.test(u.pathname)}catch{return false}};
const WRONG_GOOGLE_RECEIVER='Подключён скрипт резервных копий Google Диска вместо скрипта Google ТТК. Откройте Farukh AI → Настройки → Подключение Google Документов и укажите URL веб-приложения «Farukh AI ТТК» (не «Резервные копии»), затем ключ именно этого скрипта. Инструкция: /google-ttk-setup.html.';
export function installRecipeExportApi(app,{request=fetch}={}){
 const recipeFrom=raw=>{if(!raw||typeof raw.id!=='string'||!raw.id||!raw.name?.trim()||!Array.isArray(raw.ingredients)||raw.ingredients.length>300||raw.ingredients.some(i=>!i||typeof i!=='object'))throw Error('Неверная техкарта.');return cleanState({recipes:[raw]}).recipes[0]};
 app.post('/api/recipes/word',async(req,res)=>{try{const recipe=recipeFrom(req.body?.recipe),buffer=await recipeWord(recipe);res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.set('Content-Disposition',"attachment; filename=recipe.docx; filename*=UTF-8''"+encodeURIComponent('ТТК_'+recipe.name+'.docx'));res.send(buffer)}catch{res.status(400).json({error:'Не удалось сформировать Word. Проверь техкарту.'})}});
 app.post('/api/recipes/google-sync',async(req,res)=>{
  try{
   const {endpoint,key,action,digest}=req.body||{};
   if(!validGoogleEndpoint(endpoint)||typeof key!=='string'||key.length<24||key.length>200)return res.status(400).json({error:'Проверь адрес подключения Google и ключ.'});
   if(!['check','sync','ensureProject','deleteRecipe'].includes(action))return res.status(400).json({error:'Неизвестное действие Google.'});
   const recipe=action==='sync'?recipeFrom(req.body?.recipe):null;
   const recipeId=action==='deleteRecipe'?req.body?.recipeId:null;
   if(action==='deleteRecipe'&&(typeof recipeId!=='string'||!/^[-a-zA-Z0-9_]{1,160}$/.test(recipeId)))
    return res.status(400).json({error:'Неверный идентификатор удаляемой ТТК.'});
   const projectId=String(recipe?.projectId||req.body?.projectId||'').trim().slice(0,100);
   const projectName=String(req.body?.projectName||recipe?.projectName||'').trim().slice(0,120);
   if(recipe&&recipe.status!=='ready')return res.status(400).json({error:'В Google передаются только готовые ТТК.'});
   if(recipe&&!/^[a-f0-9]{64}$/.test(digest||''))return res.status(400).json({error:'Неверная версия ТТК.'});
   // Native Google Sheets stores structured data; Google Docs stores an editable card.
   // PDF remains an optional, independent print/export feature.
   const payload={key,action,digest,projectId,projectName,...(recipeId?{recipeId}:{}),...(recipe?recipeSections(recipe):{})};
   const response=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(100000),redirect:'follow'});
   if(!response.ok)throw Error('Google временно недоступен. Сохранённая ТТК осталась на устройстве.');
   const result=await response.json();
   if(result.ok!==true){
    if(/неизвестная операция/i.test(String(result.error||'')))
     throw Error('Google не распознаёт отправку ТТК. Вероятно, указано веб-приложение резервных копий вместо Google ТТК или опубликована старая версия. Откройте /google-ttk-setup.html и проверьте подключение.');
    throw Error(result.error||'Google не подтвердил сохранение.');
   }
   // The backup Apps Script also answers action=check with ok:true, but it
   // returns folderName instead of documentUrl. A matching secret is NOT enough.
   if(action==='check'&&!isGoogleDocUrl(result.documentUrl))
    throw Error(result.folderName?WRONG_GOOGLE_RECEIVER:'Google ответил, но не подтвердил документ ТТК. Проверьте опубликованную версию Google Apps Script «Farukh AI ТТК»: /google-ttk-setup.html.');
   if(action==='check'){
    if(result.sheetSupported!==true||!isGoogleSheetUrl(result.sheetUrl))throw Error('Google Документ доступен, но Google Таблицы не подключены. Обновите код и развертывание Apps Script «Farukh AI ТТК»: /google-ttk-setup.html.');
    return res.json({ok:true,documentUrl:result.documentUrl,sheetUrl:result.sheetUrl,sheetSupported:true,receiverVersion:result.receiverVersion||null});
   }
   if(action==='ensureProject'&&(!isGoogleDocUrl(result.documentUrl)||!isGoogleDriveFolderUrl(result.folderUrl)||result.sheetSupported!==true||!isGoogleSheetUrl(result.sheetUrl)))
    throw Error('Google не подтвердил папку и документ проекта. Обновите развертывание Apps Script «Farukh AI ТТК» по инструкции /google-ttk-setup.html.');
   if(recipe&&(result.recipeId!==recipe.id||result.digest!==digest))throw Error('Google не подтвердил версию ТТК.');
   // A green status is allowed only if BOTH cloud destinations acknowledge this version.
   if(recipe&&(!isGoogleDocUrl(result.documentUrl)||!isGoogleSheetUrl(result.sheetUrl)||result.documentSaved!==true||result.sheetSaved!==true))
    return res.status(502).json({code:'GOOGLE_CLOUD_NOT_CONFIRMED',documentSaved:result.documentSaved===true&&isGoogleDocUrl(result.documentUrl),sheetSaved:result.sheetSaved===true&&isGoogleSheetUrl(result.sheetUrl),documentUrl:isGoogleDocUrl(result.documentUrl)?result.documentUrl:null,sheetUrl:isGoogleSheetUrl(result.sheetUrl)?result.sheetUrl:null,error:'ТТК ещё не подтверждена одновременно в Google Таблицах и Google Документах. Обновите веб-приложение «Farukh AI ТТК» и повторите отправку. Данные на устройстве не удалены.'});
   if(action==='deleteRecipe'){
    if(result.recipeId!==recipeId||typeof result.deleted!=='boolean'||typeof result.found!=='boolean')
     throw Error('Google не подтвердил удаление выбранной ТТК. Опубликуйте актуальную версию Google Apps Script.');
    return res.json({ok:true,recipeId,deleted:result.deleted,found:result.found,tabDeleted:!!result.tabDeleted,pdfTrashed:!!result.pdfTrashed});
   }
   res.json({ok:true,recipeId:result.recipeId,digest:result.digest,projectId:result.projectId,
    documentUrl:result.documentUrl,folderUrl:result.folderUrl,tabId:result.tabId,sheetUrl:result.sheetUrl,
    documentReady:result.documentSaved===true,sheetReady:result.sheetSaved===true});
  }catch(e){res.status(502).json({error:e.message||'Не удалось записать ТТК в Google.'})}
 });
}
