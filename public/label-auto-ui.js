import {deviceReadyRecipes,googleBackupReadyRecipes,recipeToLabel,combineWithTTKs} from './label-ttk-sync.js?v=1';

// Labels and TTKs share an origin and the existing IndexedDB store. Import reads
// only; no changes are ever written to the TTK database or Google Drive.
const labelApp=window.FARUKH_LABELS;
if(labelApp){
 const $=id=>document.getElementById(id),status=$('ttk-state'),localBtn=$('sync-ttk'),cloudBtn=$('sync-google');
 let running=false;
 const ttkCache=new Map();
 const stamp=date=>{try{return new Date(date).toLocaleDateString('ru-RU')}catch{return 'неизвестна'}};
 const msg=(text)=>{status.textContent=text};
 async function sync({google=false,silent=false}={}){
   if(running)return;
   running=true;localBtn.disabled=cloudBtn.disabled=true;
   msg(google?'Проверяю последнюю резервную копию Google Диска…':'Ищу готовые техкарты на устройстве…');
   try{
     // Respect the owner's login before reading potentially private TTKs from the device.
     const sessionResponse=await fetch('/api/auth/session',{cache:'no-store',credentials:'same-origin'});
     if(!sessionResponse.ok)throw Error('Не удалось проверить вход владельца.');
     const session=await sessionResponse.json();
     if(!session.authenticated)throw Error('Войди в FARUKH AI через главный экран, затем открой этикетки снова.');
     const source=google?await googleBackupReadyRecipes():await deviceReadyRecipes();
     const recipes=source.recipes||[];
     if(!recipes.length){
       msg(google?'В последней резервной копии Google нет готовых ТТК.':'На этом устройстве готовые ТТК пока не найдены. Сохрани техкарты со статусом «Готово» или попробуй загрузить копию Google.');
       return;
     }
     for(const recipe of recipes)ttkCache.set(String(recipe.id),{...recipeToLabel(recipe),ttkSource:source.source});
     const {products,stats}=combineWithTTKs(labelApp.getProducts(),recipes,{source:source.source});
     if(stats.added||stats.updated||stats.changed)labelApp.applyProducts(products);
     const count=recipes.length;
     let text='Готовых ТТК: '+count+'. Новых этикеток: '+stats.added+'. Обновлено: '+stats.updated+'.';
     if(stats.changed)text+=' Изменились '+stats.changed+' ранее отредактированных ТТК — проверь их перед печатью.';
     if(stats.conflicts)text+=' Совпали названия '+stats.conflicts+' товаров — ручные этикетки оставлены без изменений.';
     if(google)text+=' Данные из резервной копии'+(source.backupDate?' от '+stamp(source.backupDate):'')+' (не живая синхронизация).';
     else text+=' Источник — ТТК на этом устройстве.';
     msg(text);
   }catch(error){msg((silent?'Автоматическая загрузка ТТК: ':'Загрузка не выполнена: ')+(error?.message||'ошибка чтения'))}
   finally{running=false;localBtn.disabled=cloudBtn.disabled=false}
 }
 localBtn.addEventListener('click',()=>sync());
 cloudBtn.addEventListener('click',()=>{
   if(!confirm('Загрузить готовые ТТК из последней резервной копии Google Диска? Существующие ручные этикетки не будут заменены.'))return;
   void sync({google:true});
 });
 const dialog=$('editor'),actions=dialog?.querySelector('.dialog-actions');
 if(actions){
   const pull=document.createElement('button');pull.type='button';pull.className='soft';pull.textContent='↻ Взять новые данные из ТТК';pull.hidden=true;
   actions.insertBefore(pull,actions.lastElementChild);
   const refresh=()=>{
     const current=labelApp.getCurrent();
     pull.hidden=!dialog.open||!current?.ttkId;
   };
   pull.addEventListener('click',async()=>{
     const current=labelApp.getCurrent();
     if(!current?.ttkId)return;
     let fresh=ttkCache.get(String(current.ttkId));
     if(!fresh){
       try{const data=await deviceReadyRecipes();const original=data.recipes.find(r=>String(r.id)===String(current.ttkId));if(original)fresh={...recipeToLabel(original),ttkSource:'device'};}catch{}
     }
     if(!fresh){msg('ТТК не найдена на устройстве. Сначала обнови список из ТТК или Google.');return;}
     labelApp.updateEditorFields(fresh);
     msg('Поля загружены из ТТК. Проверь и нажми «Сохранить» в редакторе; срок и условия хранения не изменены.');
   });
   new MutationObserver(refresh).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 void sync({silent:true});
}
