/* FARUKH AI · Owner approved A4 template bridge (19 Nov 2026).
 * Live editor data are authoritative; the visual master never saves demo ingredients.
 * Printing uses the browser's A4 PDF pathway because the old server PDF is a
 * different design. Word parity is not claimed. */
import {recipeAllergenMatrix} from './ttk-allergens.js?v=2';
export const APPROVED_A4_LAYOUT='emerald-master-a4';
const escapeText=s=>String(s??'');
const displayNum=n=>n===null||n===undefined||n===''||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
const showDate=raw=>{
 const s=String(raw||'').trim(),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
 return match?match[3]+'.'+match[2]+'.'+match[1]:(s||'—');
};
export function buildApprovedA4Payload(recipe={}){
 const r=recipe||{},net=Number(r.netYieldGrams),pieces=Number(r.pieces)||0;
 const portionWeight=Number.isFinite(net)&&net>0?net:0;
 const weightLabel=portionWeight?displayNum(net)+' г':'—';
 const selected=recipeAllergenMatrix(r).groups.filter(g=>g.checked).map(g=>g.id==='crustacean'?'crustaceans':g.id);
 const nutrition=Object.fromEntries(['protein','fat','carbs','kcal'].map(k=>{
  const v=r.nutrition?.[k],n=v===null||v===undefined||v===''?null:Number(v);
  return [k,{per100:n!==null&&Number.isFinite(n)?displayNum(n):'—',
    perPortion:n!==null&&Number.isFinite(n)&&portionWeight?displayNum(n*portionWeight/100):'—'}];
 }));
 const ingredients=(Array.isArray(r.ingredients)?r.ingredients:[]).map(row=>({
  name:escapeText(row?.name||''),
  gross:displayNum(row?.grossGrams),
  net:displayNum(row?.grams)
 }));
 const stages=[
  ['Подготовка',r.preparation],
  ['Формовка и приготовление',r.forming||r.technology],
  ['Нарезка и подача',r.serving]
 ].filter(([,s])=>String(s||'').trim()).map(([title,description])=>({title,description:escapeText(description)}));
 const quality=[r.appearance&&'Внешний вид: '+r.appearance,r.taste&&'Вкус, запах и консистенция: '+r.taste].filter(Boolean).join('\n');
 const overrides=r.allergenOverrides&&typeof r.allergenOverrides==='object'?r.allergenOverrides:{};
 return {
  cardNumber:r.cardNumber||'—',name:r.name||'—',category:r.category||'—',
  yield:(pieces?pieces+' шт. · ':'')+weightLabel,portionWeight,date:showDate(r.cardDate),
  status:r.status==='ready'?'Рецептура готова':'В разработке',
  scope:r.scope||'',rawRequirements:r.rawRequirements||'',ingredients,
  technologyStages:stages,serving:r.serving||'',sale:'',storage:r.storage||'',
  quality,safety:r.safety||'',nutrition,allergens:selected,
  brandLogo:r.brandLogo||null,brandName:r.projectName||'FARUKH AI',
  warnings:[
   ...(r.status!=='ready'?['Документ находится в разработке.']:[]),
   ...(ingredients.length===0?['Не указаны ингредиенты.']:[]),
   ...(portionWeight===0?['Не указан выход готового блюда.']:[]),
   ...(Object.values(nutrition).some(x=>x.per100==='—')?['КБЖУ не полностью рассчитаны.']:[]),
   'Аллергены отмечены предварительно — проверьте этикетки, ПФ и сырьё.'
  ],
  overrides
 };
}
export function mountApprovedA4Preview(editor,{getDraft,onChange=()=>{},onEditRecipe=null}={}){
 if(!editor||typeof getDraft!=='function')throw Error('Не найден редактор или источник ТТК.');
 const el=(tag,cls,label)=>{
  const n=document.createElement(tag);if(cls)n.className=cls;
  if(label!==undefined)n.textContent=label;return n;
 };
 // Contextual tools belong to the selected Emerald card in the ONE A4 gallery.
 const menu=el('div','ttk-approved-controls');
 menu.id='ttk-approved-controls';menu.setAttribute('aria-label','Инструменты шаблона Emerald Gold');
 menu.hidden=true;
 const heading=el('h3',null,'05 · Emerald Gold — утверждённый эталон');
 const note=el('p',null,'Это печатный вид. Для заполнения нажми «✎ Заполнить ТТК» или коснись нужного раздела на листе. После заполнения вернись к предпросмотру и сохрани PDF.');
 const open=el('button','ttk-approved-open','👁 Просмотреть эталон А4');
 open.type='button';open.id='ttk-approved-open';
 const logo=el('button','ttk-approved-logo','▧ Загрузить логотип');
 logo.type='button';const file=el('input');file.type='file';file.accept='image/png,image/jpeg';file.hidden=true;
 menu.append(heading,note,open,logo,file);
 const picker=editor.querySelector('#ttk-design-picker');
 if(picker)picker.append(menu);else (editor.querySelector('.editor-modes')||editor).after(menu);
 const syncVisibility=id=>{menu.hidden=id!==APPROVED_A4_LAYOUT};
 editor.addEventListener('ttk:layout-change',e=>syncVisibility(e.detail?.id));
 syncVisibility(editor.dataset.ttkLayout);
 const dialog=el('div','ttk-approved-modal');dialog.hidden=true;dialog.id='ttk-approved-modal';
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Просмотр эталонной ТТК А4');
 const shell=el('div','ttk-approved-modal-inner'),head=el('div','ttk-approved-modal-head');
 const title=el('strong',null,'ТТК Emerald Gold · один лист А4');
 const edit=el('button','ttk-approved-edit','✎ Заполнить ТТК');edit.type='button';
 const scaleBtn=el('button',null,'100%');scaleBtn.type='button';scaleBtn.setAttribute('aria-pressed','false');
 const print=el('button',null,'🖨 Печать / сохранить PDF');print.type='button';
 const retry=el('button',null,'↻ Повторить загрузку');retry.type='button';retry.hidden=true;
 const close=el('button',null,'✕ Закрыть');close.type='button';
 head.append(title,edit,scaleBtn,print,retry,close);
 const warning=el('div','ttk-approved-warning');
 warning.setAttribute('role','status');
 const canvas=el('div','ttk-approved-canvas');
 const sheet=el('div','ttk-approved-sheet');
 const iframe=el('iframe');iframe.title='Эталонная ТТК А4';
 // The approved visual master is ~1 MB of embedded print artwork. Do not
 // download or parse it during the dashboard startup; open it on demand.
 let masterRequested=false,masterLoadTimer=null,retryCount=0;
 function loadFailed(){
  if(loaded)return;
  clearTimeout(masterLoadTimer);
  masterRequested=false;
  retry.hidden=false;
  warning.textContent='⚠ Не удалось загрузить лист А4. Нажмите «Повторить загрузку». Если ошибка останется, обновите страницу FARRUH AI.';
 }
 function ensureMasterLoaded(){
  if(masterRequested||loaded)return;
  masterRequested=true;
  retry.hidden=true;
  warning.textContent='Загружаю утверждённый макет А4…';
  clearTimeout(masterLoadTimer);
  masterLoadTimer=setTimeout(loadFailed,15000);
  // New query revision prevents Android's cached DENY header from being reused.
  iframe.src='/ttk-approved-master.html?v=owner-master-20261120-frame'+(retryCount?'&attempt='+retryCount:'');
 }
 retry.onclick=()=>{loaded=false;masterRequested=false;retryCount++;ensureMasterLoaded()};
 iframe.addEventListener('error',loadFailed);
 sheet.append(iframe);canvas.append(sheet);shell.append(head,warning,canvas);dialog.append(shell);
 document.body.append(dialog);
 let current=null,loaded=false,zoomOne=false,brandLogo=null,lastFocus=null;
 const isOpen=()=>!dialog.hidden;
 function fit(){
  const w=Math.max(0,canvas.clientWidth-8),factor=zoomOne?1:Math.min(1,w/1024);
  iframe.style.width='1024px';iframe.style.height='1448px';
  iframe.style.transform='scale('+factor+')';iframe.style.transformOrigin='top left';
  sheet.style.width=Math.round(1024*factor)+'px';sheet.style.height=Math.round(1448*factor)+'px';
  canvas.classList.toggle('is-zoomed',zoomOne);
  scaleBtn.textContent=zoomOne?'По ширине':'100%';
  scaleBtn.setAttribute('aria-pressed',String(zoomOne));
 }
 if('ResizeObserver'in window)new ResizeObserver(()=>{if(isOpen())fit()}).observe(canvas);
 function render(){
  if(!isOpen()||!loaded||!iframe.contentWindow?.applyTtkData||!current)return;
  const r=buildApprovedA4Payload({...current,brandLogo:brandLogo||current.brandLogo||null});
  const doc=iframe.contentDocument;
  iframe.contentWindow.applyTtkData(r);
  const portionHeader=doc.querySelector('.nutrition thead th:last-child');
  if(portionHeader)portionHeader.textContent='На порцию ('+(r.portionWeight?displayNum(r.portionWeight)+' г':'—')+')';
  doc.querySelectorAll('[contenteditable]').forEach(n=>n.setAttribute('contenteditable','false'));
  const brand=doc.querySelector('.brand');
  if(brand&&!r.brandLogo){
   brand.style.backgroundImage='none';brand.style.display='flex';
   brand.style.alignItems='center';brand.style.justifyContent='center';
   brand.style.font='bold 25px Georgia,serif';
   brand.style.color='#f6dc91';
   brand.textContent=String(r.brandName).slice(0,28);
  }
  const report=iframe.contentWindow.checkTtkPage();
  const hasRequiredFields=Boolean(r.name&&r.name!=='—'&&r.ingredients.some(row=>row.name.trim()&&row.net!=='—')&&r.portionWeight>0);
  if(!hasRequiredFields){
   // A blank draft may contain long category examples. Do not pretend that
   // these examples mean the owner entered overflowing content.
   warning.textContent='✎ ТТК ещё не заполнена. Нажми «Заполнить ТТК» или коснись раздела А4. Название, ингредиенты и граммовки укажи в редакторе.';
   warning.dataset.overflow='false';
  }else{
   const messages=[...r.warnings];
   if(!report.ready)messages.unshift('⚠ Текст выходит за пределы блока. Печать остановлена — сократите или исправьте содержание.');
   warning.textContent=messages.join('  •  ');
   warning.dataset.overflow=String(!report.ready);
  }
  fit();
 }
 iframe.addEventListener('load',()=>{
  clearTimeout(masterLoadTimer);
  try{
   loaded=typeof iframe.contentWindow?.applyTtkData==='function'&&
     typeof iframe.contentWindow?.checkTtkPage==='function';
  }catch{loaded=false;}
  if(!loaded){loadFailed();return}
  retry.hidden=true;
  render();
 });
 function show(recipe){
  lastFocus=document.activeElement;
  current=recipe||getDraft();zoomOne=false;dialog.hidden=false;
  document.body.classList.add('ttk-approved-preview-open');
  if(!loaded)warning.textContent='Загружаю утверждённый макет А4…';
  ensureMasterLoaded();
  requestAnimationFrame(()=>{fit();render();close.focus()});
 }
 function hide(){dialog.hidden=true;document.body.classList.remove('ttk-approved-preview-open');lastFocus?.focus?.();}
 function editCurrent(fieldId='#recipe-name'){
  const recipe=current||getDraft();
  hide();
  // Print view can also open from a saved recipe list. In that case load the
  // selected card into the ORIGINAL editor before focusing a field.
  let sameDraft=false;
  if(!editor.hidden){
   try{
    const draft=getDraft();
    sameDraft=Boolean(recipe?.id)?draft?.id===recipe.id:!draft?.id;
   }catch{}
  }
  if(!sameDraft&&typeof onEditRecipe==='function')onEditRecipe(recipe);
  if(editor.hidden){warning.textContent='Не удалось открыть редактор ТТК.';dialog.hidden=false;return;}
  const formButton=[...editor.querySelectorAll('.ttk-studio-switch-button')][0];
  if(formButton)formButton.click();
  requestAnimationFrame(()=>{
   const field=editor.querySelector(fieldId)||editor.querySelector('#recipe-name');
   if(!field)return;
   field.scrollIntoView({block:'center',behavior:'smooth'});
   // On Android, focus without opening the keyboard automatically; tap to type.
   field.focus({preventScroll:true});
  });
 }
 edit.onclick=()=>editCurrent();
 open.onclick=()=>show(getDraft());
 close.onclick=hide;
 dialog.addEventListener('click',event=>{if(event.target===dialog)hide()});
 window.addEventListener('keydown',e=>{if(isOpen()&&e.key==='Escape'){hide();e.stopPropagation()}});
 scaleBtn.onclick=()=>{zoomOne=!zoomOne;fit()};
 function printCurrent(){
  if(!loaded||!iframe.contentWindow?.checkTtkPage){warning.textContent='Шаблон ещё не загрузился.';return}
  render();
  if(!iframe.contentWindow.checkTtkPage().ready){warning.textContent='ТТК не помещается на один лист А4. Проверьте длинные описания и таблицу.';return}
  const r=buildApprovedA4Payload({...current,brandLogo:brandLogo||current?.brandLogo});
  if(!r.ingredients.length||!r.name||r.name==='—'){warning.textContent='Заполните название и ингредиенты перед печатью.';return}
  iframe.contentWindow.focus();
  iframe.contentWindow.print(); // browser print dialog, users choose Save as PDF
 }
 print.onclick=printCurrent;
 function populate(r){
  brandLogo=r?.brandLogo||null;
  logo.textContent=brandLogo?'▧ Заменить логотип':'▧ Загрузить логотип';
  syncVisibility(r?.layoutTemplate);
 }
 logo.onclick=()=>file.click();
 file.addEventListener('change',()=>{
  const f=file.files?.[0];file.value='';
  if(!f)return;
  if(!['image/png','image/jpeg'].includes(f.type)||f.size>1050000){alert('Логотип: PNG/JPEG до 1 МБ.');return;}
  const reader=new FileReader();
  reader.onload=()=>{brandLogo=typeof reader.result==='string'?reader.result:null;logo.textContent='▧ Заменить логотип';onChange();if(isOpen())render()};
  reader.readAsDataURL(f);
 });
 iframe.addEventListener('load',()=>{
  const master=iframe.contentDocument;
  // Tapping a section of the *printed* A4 jumps to the corresponding real
  // recipe field, instead of silently refusing to edit the scaled preview.
  master?.addEventListener('click',event=>{
   if(!isOpen()||!loaded||event.target.closest('.allergen input'))return;
   const field=event.target.closest('[data-field]')?.dataset.field;
   const section=event.target.closest('.sect');
   const sectionClass=[...section?.classList||[]].find(x=>/^section-[1-8]$/.test(x));
   const fieldTarget={
    name:'#recipe-name',cardNumber:'#card-number',
    category:'#recipe-category',date:'#card-date',status:'#recipe-status',
    yield:'#addingredient',scope:'#card-scope',rawRequirements:'#card-raw',
    serving:'#card-serving',sale:'#card-storage',storage:'#card-storage',
    quality:'#card-appearance',safety:'#card-safety'
   };
   const sectionTarget={
    'section-1':'#card-scope','section-2':'#card-raw',
    'section-3':'#addingredient','section-4':'#technology',
    'section-5':'#card-storage','section-6':'#card-appearance',
    'section-7':'#card-protein','section-8':'#recipe-name'
   };
   const target=fieldTarget[field]||sectionTarget[sectionClass]||null;
   if(target)editCurrent(target);
  });
  master?.querySelectorAll('.allergen input').forEach(box=>{
   box.addEventListener('change',()=>{
    if(!current)return;
    const overrides={...(current.allergenOverrides||{})};
    const id=box.name==='crustaceans'?'crustacean':box.name;
    overrides[id]=box.checked;
    current.allergenOverrides=overrides;
    if(!editor.hidden){editor.dataset.allergenOverrides=JSON.stringify(overrides);onChange()}
    render();
   });
  });
 });
 return {openForRecipe:show,populate,getLogo:()=>brandLogo,openCurrent:()=>show(getDraft()),isOpen};
}
