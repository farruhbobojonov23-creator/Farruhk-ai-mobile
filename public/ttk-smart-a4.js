/* FARRUH AI SMART PREMIUM: fixed A4 grid for 1–15 ingredient rows.
 * Keeps legacy editable form, measurements and document data unchanged.
 * Never hides unprintable information; reports overcapacity to the chef. */
import {buildApprovedA4Payload} from './ttk-approved-preview.js?v=1';
export const SMART_A4_LAYOUT='premium-smart-a4';
export function mountSmartA4Preview(editor,{getDraft,onSelect=()=>{},onChange=()=>{}}={}){
 if(!editor||typeof getDraft!=='function')throw Error('SMART А4: не найден редактор техкарт.');
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const panel=el('section','ttk-smart-controls');
 panel.id='ttk-smart-controls';panel.setAttribute('aria-label','PREMIUM SMART А4');
 const title=el('h3','','PREMIUM SMART · ТТК А4');
 const caption=el('p','','Макет № 1 · 15 фиксированных строк рецептуры · одна страница А4 · проверка текста без обрезания');
 const choose=el('button','smart-choose','✓ Выбрать PREMIUM SMART');choose.type='button';
 const edit=el('button','smart-edit','✎ Редактировать ингредиенты и текст');edit.type='button';
 const open=el('button','smart-open','🔍 Смотреть А4 крупно');open.type='button';
 const save=el('button','smart-save','✓ Сохранить ТТК');save.type='button';
 const print=el('button','smart-print','↓ Печать / PDF (А4)');print.type='button';
 const upload=el('button','smart-upload','▧ Логотип');upload.type='button';
 const photo=el('button','smart-photo','▧ Фото блюда');photo.type='button';
 const gallery=el('button','smart-legacy','◫ Другие шаблоны');gallery.type='button';
 const file=el('input');file.type='file';file.accept='image/png,image/jpeg';file.hidden=true;
 const status=el('div','smart-status','');status.setAttribute('role','status');
 const viewport=el('div','smart-inline-viewport');
 const inlineFrame=el('iframe');inlineFrame.title='Премиальная ТТК SMART на одном листе А4';
 inlineFrame.src='/ttk-smart-a4.html?v=1';viewport.append(inlineFrame);
 panel.append(title,caption,choose,edit,open,save,print,upload,photo,gallery,file,status,viewport);
 // This is deliberately outside the old showroom which is hidden in paper mode.
 const toolbar=editor.querySelector('.ttk-toolbar');
 if(toolbar)toolbar.after(panel);else editor.prepend(panel);

 const overlay=el('div','smart-fullscreen');overlay.hidden=true;overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','ТТК PREMIUM SMART · А4');
 const control=el('div','smart-fullscreen-toolbar');
 const label=el('b','','PREMIUM SMART · А4');
 const zoom=el('button','smart-zoom','100%');zoom.type='button';
 const fullPrint=el('button','smart-print-full','↓ PDF');fullPrint.type='button';
 const close=el('button','smart-close','✕ Закрыть');close.type='button';
 control.append(label,zoom,fullPrint,close);
 const fullStage=el('div','smart-fullscreen-stage');
 const fullPaper=el('div','smart-fullpaper');
 const fullFrame=el('iframe');fullFrame.src='/ttk-smart-a4.html?v=1';fullFrame.title='ТТК SMART для печати';
 fullPaper.append(fullFrame);fullStage.append(fullPaper);overlay.append(control,fullStage);document.body.append(overlay);

 let currentLogo=null,draftRecipe=null,inlineLoaded=false,fullLoaded=false,zoomed=false,timer=null,lastFocus=null;
 const isSelected=()=>editor.dataset.ttkLayout===SMART_A4_LAYOUT;
 const safeLogo=data=>typeof data==='string'&&data.length<1500000&&/^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(data);
 function data(){
  const r=getDraft();
  draftRecipe=r;
  const payload=buildApprovedA4Payload({...r,brandLogo:currentLogo||r.brandLogo||null});
  payload.photo=r.photo||null;
  payload.brandLogo=currentLogo||r.brandLogo||null;
  payload.chef=r.chef||'';payload.approver=r.approver||'';
  payload.status=r.status;
  if(Array.isArray(r.ingredients)&&r.ingredients.length>15)payload.warnings.unshift('Слишком много ингредиентов: '+r.ingredients.length+' из 15. Ничего не удалено.');
  return payload;
 }
 function size(frame,box,available){
  if(!box.clientWidth)return;
  const scale=Math.min(zoomed&&frame===fullFrame?1:Infinity,Math.max(.2,Math.min(1,(available.clientWidth-4)/1024)));
  frame.style.width='1024px';frame.style.height='1448px';
  frame.style.transform='scale('+scale+')';frame.style.transformOrigin='top left';
  box.style.height=Math.ceil(1448*scale)+'px';
  box.style.width=Math.ceil(1024*scale)+'px';
 }
 function rescale(){
  if(isSelected())size(inlineFrame,viewport,panel);
  if(!overlay.hidden)size(fullFrame,fullPaper,fullStage);
 }
 function fill(frame,payload){
  const api=frame.contentWindow;
  if(typeof api?.applyTtkData!=='function')return null;
  const result=api.applyTtkData(payload);
  const doc=frame.contentDocument;
  doc.querySelectorAll('.allergen input').forEach(input=>{
   // Only paper-fullscreen interactive changes should alter the saved overrides.
   if(frame!==fullFrame)return;
   input.onchange=()=>{
    try{
     const current=JSON.parse(editor.dataset.allergenOverrides||'{}');
     const id=input.name==='crustaceans'?'crustacean':input.name;
     current[id]=input.checked;editor.dataset.allergenOverrides=JSON.stringify(current);
     onChange();schedule();
    }catch{status.textContent='Не удалось изменить галочки аллергенов.';}
   };
  });
  return result;
 }
 function refresh(){
  const active=isSelected();panel.dataset.selected=String(active);panel.classList.toggle('is-active',active);
  choose.textContent=active?'✓ PREMIUM SMART выбран':'☆ Выбрать PREMIUM SMART';
  if(!active)return;
  try{
   const payload=data();
   const a=inlineLoaded?fill(inlineFrame,payload):null;
   const b=fullLoaded&&!overlay.hidden?fill(fullFrame,payload):null;
   const problems=(b||a)?.violations||[];
   const errors=payload.warnings.filter(x=>!/Аллергены отмечены/.test(x));
   status.textContent=[...(problems.length?['⚠ На один читаемый А4 не помещается: '+problems.join('; ')]:[]),...errors].join(' · ');
   status.dataset.overflow=String(problems.length>0);
   print.disabled=problems.length>0||!inlineLoaded;
   fullPrint.disabled=problems.length>0||!fullLoaded;
  }catch(err){status.textContent='⚠ Ошибка чтения ТТК: '+err.message;print.disabled=true;}
  rescale();
 }
 function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;refresh()},180)}
 inlineFrame.addEventListener('load',()=>{inlineLoaded=true;refresh()});
 fullFrame.addEventListener('load',()=>{fullLoaded=true;refresh()});
 editor.addEventListener('input',schedule);editor.addEventListener('change',schedule);
 window.addEventListener('resize',rescale);
 if('ResizeObserver'in window){
  new ResizeObserver(()=>{if(isSelected())rescale()}).observe(panel);
 }
 function select(){onSelect(SMART_A4_LAYOUT);onChange();refresh();panel.scrollIntoView({block:'start',behavior:'smooth'})}
 choose.onclick=select;
 function startModal(){
  lastFocus=document.activeElement;
  if(!isSelected())onSelect(SMART_A4_LAYOUT);
  zoomed=false;overlay.hidden=false;document.body.classList.add('smart-modal-open');
  requestAnimationFrame(()=>{refresh();rescale();close.focus()});
 }
 open.onclick=startModal;
 close.onclick=()=>{overlay.hidden=true;document.body.classList.remove('smart-modal-open');lastFocus?.focus?.()};
 overlay.addEventListener('click',e=>{if(e.target===overlay)close.click()});
 window.addEventListener('keydown',e=>{if(!overlay.hidden&&e.key==='Escape')close.click()});
 zoom.onclick=()=>{zoomed=!zoomed;zoom.textContent=zoomed?'По ширине':'100%';rescale()};
 function printSheet(){
  if(!isSelected())return select();
  const payload=data(),r=fullLoaded&&!overlay.hidden?fill(fullFrame,payload):inlineLoaded?fill(inlineFrame,payload):null;
  if(!r||!r.ready){status.textContent='⚠ Нельзя распечатать без потери текста: '+(r?.violations||['Шаблон ещё не загрузился']).join('; ');status.dataset.overflow='true';return}
  if(!payload.ingredients.length||!String(payload.name||'').trim()||payload.name==='—'){
   status.textContent='⚠ Заполните название блюда и состав перед печатью.';return;
  }
  const frame=!overlay.hidden&&fullLoaded?fullFrame:inlineFrame;
  frame.contentWindow.focus();frame.contentWindow.print();
 }
 print.onclick=printSheet;fullPrint.onclick=printSheet;
 edit.onclick=()=>{
  const mode=[...editor.querySelectorAll('.ttk-studio-switch-button')].find(x=>/Удобное заполнение/i.test(x.textContent));
  if(mode)mode.click();else editor.querySelector('.editor-modes button')?.click();
  editor.querySelector('#recipe-name')?.scrollIntoView({block:'center',behavior:'smooth'});
 };
 save.onclick=()=>editor.requestSubmit();
 upload.onclick=()=>file.click();
 file.addEventListener('change',()=>{
  const f=file.files?.[0];file.value='';if(!f)return;
  if(!['image/png','image/jpeg'].includes(f.type)||f.size>1000000){status.textContent='Логотип: PNG или JPEG размером до 1 МБ.';return;}
  const reader=new FileReader();reader.onload=()=>{
   const value=String(reader.result||'');
   if(!safeLogo(value)){status.textContent='Логотип не загружен: неверный формат.';return;}
   currentLogo=value;onChange();refresh();
  };reader.readAsDataURL(f);
 });
 photo.onclick=()=>editor.querySelector('#recipe-photo-file')?.click();
 gallery.onclick=()=>{
  const mode=[...editor.querySelectorAll('.ttk-studio-switch-button')].find(x=>/Лист А4/i.test(x.textContent));
  if(mode)mode.click();
  const picker=editor.querySelector('#ttk-design-picker');
  if(picker){picker.classList.add('smart-show-gallery');picker.scrollIntoView({block:'center',behavior:'smooth'})}
 };
 function populate(r){
  currentLogo=safeLogo(r?.brandLogo)?r.brandLogo:null;editor.dataset.smartLegacyVisible='false';
  choose.textContent=r?.layoutTemplate===SMART_A4_LAYOUT?'✓ PREMIUM SMART выбран':'☆ Выбрать PREMIUM SMART';
  schedule();
 }
 return {populate,refresh,getLogo:()=>currentLogo,isSelected,openForRecipe(recipe){
  if(recipe)draftRecipe=recipe;startModal();
 }};
}
