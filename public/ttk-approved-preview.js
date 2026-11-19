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
export function mountApprovedA4Preview(editor,{getDraft,onChange=()=>{},onSelectMaster=()=>{}}={}){
 if(!editor||typeof getDraft!=='function')throw Error('Не найден редактор или источник ТТК.');
 const el=(tag,cls,label)=>{
  const n=document.createElement(tag);if(cls)n.className=cls;
  if(label!==undefined)n.textContent=label;return n;
 };
 const menu=el('section','ttk-approved-controls');
 menu.id='ttk-approved-controls';menu.setAttribute('aria-label','Эталонный шаблон Emerald Gold');
 const heading=el('h3',null,'Эталон Emerald Gold · А4');
 const note=el('p',null,'Макет MORE SUSHI: один лист А4, семь разделов, таблицы, аллергены и подписи. Заполняется из текущей ТТК. PDF — через печать браузера.');
 const open=el('button','ttk-approved-open','👁 Открыть эталон А4');
 open.type='button';open.id='ttk-approved-open';
 const select=el('button','ttk-approved-select','★ Выбрать Emerald Gold для этой ТТК');select.type='button';
 const logo=el('button','ttk-approved-logo','▧ Загрузить логотип');
 logo.type='button';const file=el('input');file.type='file';file.accept='image/png,image/jpeg';file.hidden=true;
 const showFields=el('button','ttk-approved-fields','✎ Редактировать поля ТТК');showFields.type='button';
 const mini=el('div','ttk-approved-mini');mini.hidden=true;
 const miniMessage=el('div','ttk-approved-mini-note','');miniMessage.setAttribute('role','status');
 const miniPage=el('div','ttk-approved-mini-page');
 const miniFrame=el('iframe');miniFrame.title='Предпросмотр Emerald Gold A4 · текущая ТТК';
 miniFrame.src='/ttk-approved-master.html?v=owner-master-20261119';
 miniPage.append(miniFrame);mini.append(miniMessage,miniPage);
 const saveA4=el('button','ttk-approved-save','✓ Сохранить ТТК');saveA4.type='button';
 const backA4=el('button','ttk-approved-back','← Назад к ТТК');backA4.type='button';
 menu.append(heading,note,select,open,logo,showFields,saveA4,backA4,file,mini);
 // This must be outside the studio intro AND outside the old A4 viewport:
 // both are reorganized/hidden by the existing phone-mode renderer.
 const topToolbar=editor.querySelector('.ttk-toolbar');
 if(topToolbar)topToolbar.after(menu);
 else editor.prepend(menu);
 saveA4.addEventListener('click',()=>editor.querySelector('.ttk-toolbar button[type="submit"]')?.click());
 backA4.addEventListener('click',()=>editor.querySelector('#closeeditor')?.click());
 editor.addEventListener('click',event=>{
  const switchButton=event.target.closest?.('.ttk-studio-switch-button');
  if(!switchButton||!selected())return;
  const toForm=switchButton.classList.contains('ttk-studio-check-button')?null:
   /заполн|редактор|форм/i.test(switchButton.textContent||'');
  if(toForm===true){editor.dataset.ttkShowLegacy='true';showFields.textContent='✓ Скрыть старую миниатюру'}
  else if(toForm===false){editor.dataset.ttkShowLegacy='false';showFields.textContent='✎ Редактировать поля ТТК'}
 },true);
 const dialog=el('div','ttk-approved-modal');dialog.hidden=true;dialog.id='ttk-approved-modal';
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Просмотр эталонной ТТК А4');
 const shell=el('div','ttk-approved-modal-inner'),head=el('div','ttk-approved-modal-head');
 const title=el('strong',null,'ТТК Emerald Gold · один лист А4');
 const scaleBtn=el('button',null,'100%');scaleBtn.type='button';scaleBtn.setAttribute('aria-pressed','false');
 const print=el('button',null,'🖨 Печать / сохранить PDF');print.type='button';
 const close=el('button',null,'✕ Закрыть');close.type='button';
 head.append(title,scaleBtn,print,close);
 const warning=el('div','ttk-approved-warning');
 warning.setAttribute('role','status');
 const canvas=el('div','ttk-approved-canvas');
 const sheet=el('div','ttk-approved-sheet');
 const iframe=el('iframe');iframe.title='Эталонная ТТК А4';
 iframe.src='/ttk-approved-master.html?v=owner-master-20261119';
 sheet.append(iframe);canvas.append(sheet);shell.append(head,warning,canvas);dialog.append(shell);
 document.body.append(dialog);
 let current=null,loaded=false,miniLoaded=false,zoomOne=false,brandLogo=null,lastFocus=null,miniTick=null;
 const selected=()=>editor.dataset.ttkLayout===APPROVED_A4_LAYOUT;
 function scaleMini(){
  if(mini.hidden||!miniPage.clientWidth)return;
  const width=Math.min(1024,miniPage.clientWidth),factor=width/1024;
  miniFrame.style.transform='scale('+factor+')';
  miniFrame.style.transformOrigin='top left';
  miniPage.style.height=Math.ceil(1448*factor)+'px';
 }
 function updateInline(){
  const active=selected();mini.hidden=!active;showFields.hidden=!active;
  menu.dataset.selected=String(active);
  if(!active)return;
  if(!('ttkShowLegacy'in editor.dataset))editor.dataset.ttkShowLegacy='false';
  if(!miniLoaded){scaleMini();return}
  let draft;
  try{draft=getDraft()}catch(err){miniMessage.textContent='Для просмотра заполните основные поля ТТК.';scaleMini();return}
  const data=buildApprovedA4Payload({...draft,brandLogo:brandLogo||draft.brandLogo||null});
  try{
   miniFrame.contentWindow.applyTtkData(data);
   const doc=miniFrame.contentDocument;
   const portion=doc.querySelector('.nutrition thead th:last-child');
   if(portion)portion.textContent='На порцию ('+(data.portionWeight?displayNum(data.portionWeight)+' г':'—')+')';
   doc.querySelectorAll('[contenteditable]').forEach(n=>n.setAttribute('contenteditable','false'));
   const brand=doc.querySelector('.brand');
   if(brand&&!data.brandLogo){
    brand.style.backgroundImage='none';brand.textContent=String(data.brandName).slice(0,28);
    Object.assign(brand.style,{display:'flex',alignItems:'center',justifyContent:'center',font:'bold 25px Georgia,serif',color:'#f6dc91'});
   }
   const check=miniFrame.contentWindow.checkTtkPage();
   miniMessage.textContent=check.ready?'':'⚠ ТТК выходит за рамки А4. Проверьте длинные тексты перед сохранением PDF.';
   miniMessage.dataset.overflow=String(!check.ready);
  }catch(err){miniMessage.textContent='Не удалось обновить предпросмотр. Откройте полный лист А4.'}
  scaleMini();
 }
 function scheduleInline(){
  if(miniTick!==null)clearTimeout(miniTick);
  miniTick=setTimeout(()=>{miniTick=null;updateInline()},160);
 }
 miniFrame.addEventListener('load',()=>{miniLoaded=true;updateInline()});
 editor.addEventListener('input',scheduleInline);
 editor.addEventListener('change',scheduleInline);
 window.addEventListener('resize',scaleMini);
 if('ResizeObserver'in window)new ResizeObserver(scaleMini).observe(miniPage);
 showFields.addEventListener('click',()=>{
  const show=editor.dataset.ttkShowLegacy!=='true';
  editor.dataset.ttkShowLegacy=String(show);
  showFields.textContent=show?'✓ Скрыть старую миниатюру':'✎ Редактировать поля ТТК';
  (show?editor.querySelector('.ttk-viewport'):menu)?.scrollIntoView({block:'start',behavior:'smooth'});
 });
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
  const messages=[...r.warnings];
  if(!report.ready)messages.unshift('⚠ Текст выходит за пределы блока. Печать остановлена — сократите или исправьте содержание.');
  warning.textContent=messages.join('  •  ');
  warning.dataset.overflow=String(!report.ready);
  fit();
 }
 iframe.addEventListener('load',()=>{loaded=true;render()});
 function show(recipe){
  lastFocus=document.activeElement;
  current=recipe||getDraft();zoomOne=false;dialog.hidden=false;
  document.body.classList.add('ttk-approved-preview-open');
  requestAnimationFrame(()=>{fit();render();close.focus()});
 }
 function hide(){dialog.hidden=true;document.body.classList.remove('ttk-approved-preview-open');lastFocus?.focus?.();}
 select.onclick=()=>{onSelectMaster();select.textContent='✓ Emerald Gold выбран';editor.dataset.ttkShowLegacy='false';showFields.textContent='✎ Редактировать поля ТТК';onChange();updateInline();mini.scrollIntoView({behavior:'smooth',block:'start'})};
 open.onclick=()=>show(getDraft());
 editor.addEventListener('ttk:show-approved',()=>show(getDraft()));
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
  select.textContent=r?.layoutTemplate===APPROVED_A4_LAYOUT?'✓ Emerald Gold выбран':'★ Выбрать Emerald Gold для этой ТТК';
  editor.dataset.ttkShowLegacy='false';
  showFields.textContent='✎ Редактировать поля ТТК';
  scheduleInline();
 }
 logo.onclick=()=>file.click();
 file.addEventListener('change',()=>{
  const f=file.files?.[0];file.value='';
  if(!f)return;
  if(!['image/png','image/jpeg'].includes(f.type)||f.size>1050000){alert('Логотип: PNG/JPEG до 1 МБ.');return;}
  const reader=new FileReader();
  reader.onload=()=>{brandLogo=typeof reader.result==='string'?reader.result:null;logo.textContent='▧ Заменить логотип';onChange();if(isOpen())render();updateInline()};
  reader.readAsDataURL(f);
 });
 iframe.addEventListener('load',()=>{
  iframe.contentDocument?.querySelectorAll('.allergen input').forEach(box=>{
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
 return {openForRecipe:show,populate,getLogo:()=>brandLogo,openCurrent:()=>show(getDraft()),isOpen,refreshInline:updateInline};
}
