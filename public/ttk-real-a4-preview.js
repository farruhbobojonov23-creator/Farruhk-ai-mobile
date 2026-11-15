/* FARRUH AI · Real A4 showroom.
 * The previous "A4" view was an editable HTML form and did not resemble
 * the four approved print layouts. This screen displays the four real choices
 * and previews the actual server-rendered PDF, using the current unsaved data.
 * The existing editable controls remain mounted inside .ttk-paper unchanged. */
import {mountInlineTtkPage} from './ttk-inline-a4-editor.js?v=1';
const ui=(tag,cls,content)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(content!==undefined)el.textContent=content;
 return el;
};
function demoRecipe(layoutTemplate){
 return {
  id:'ttk-design-demo',name:'Филадельфия классик',category:'Холодные роллы',
  cardNumber:'001',cardDate:'2026-11-15',status:'draft',pieces:8,
  layoutTemplate,netYieldGrams:270,chef:'Фаррух Ака',approver:'Бободжонов А.',
  scope:'Технологическая карта на ролл «Филадельфия классик» для предприятия общественного питания.',
  rawRequirements:'Сырьё принимают с документами, проверяют маркировку, срок годности и условия хранения.',
  preparation:'Подготовить рис для суши, лист нори, лосось, сыр творожный и огурец.',
  forming:'Распределить рис на нори, уложить сыр и огурец. Сформировать ролл, покрыть ломтиками лосося.',
  serving:'Нарезать на 8 равных частей и подать по утверждённой рецептуре.',
  storage:'Температура и срок хранения — по утверждённой ТТК предприятия.',
  appearance:'Ровная форма, аккуратная нарезка, равномерное покрытие лососем.',
  taste:'Свойственный указанным ингредиентам, без посторонних запахов.',
  safety:'Проверка сырья при приёмке, санитарный контроль и маркировка готового блюда.',
  nutritionMode:'manual',nutrition:{protein:6.6,fat:8.9,carbs:20,kcal:188.3},
  ingredients:[
   {name:'Рис для суши готовый',grossGrams:120,grams:120,lossPercent:0},
   {name:'Нори',grossGrams:1.5,grams:1.5,lossPercent:0},
   {name:'Лосось',grossGrams:60,grams:60,lossPercent:0},
   {name:'Сыр творожный',grossGrams:50,grams:50,lossPercent:0},
   {name:'Огурец свежий',grossGrams:40,grams:38.5,lossPercent:3.75}
  ]
 };
}
export function mountTtkRealPreview(editor,{getDraft,picker,intro}={}){
 const viewport=editor?.querySelector('.ttk-viewport');
 if(!editor||!viewport||!picker||!intro||typeof getDraft!=='function')
  throw Error('Не найдена форма или селектор четырёх ТТК.');
 const stage=ui('section','ttk-real-a4-stage');
 stage.id='ttk-real-a4-stage';
 const mast=ui('div','ttk-real-a4-mast');
 mast.append(ui('span','ttk-real-a4-kicker','FARRUH AI  /  PREMIUM A4'),
  ui('h3','','4 шаблона технологической карты'),
  ui('p','','Выбери оформление и заполняй карту прямо на листе ниже. Нажимай на название, ингредиенты, технологию и другие поля — изменения сохраняются в настоящей ТТК.'));
 stage.append(mast);
 const gallery=ui('div','ttk-real-a4-gallery');
 stage.append(gallery);
 const startEdit=ui('button','ttk-real-a4-start-edit','✎ Заполнить выбранный шаблон прямо на листе');
 startEdit.type='button';
 startEdit.addEventListener('click',()=>live.page.scrollIntoView({behavior:'smooth',block:'start'}));
 stage.append(startEdit);
 const output=ui('section','ttk-real-a4-output');
 output.setAttribute('aria-label','Просмотр выбранного шаблона');
 const live=mountInlineTtkPage(editor);
 const status=ui('p','ttk-real-a4-status','Заполняй поля на выбранном листе. Для проверки печатного вида открой PDF.');
 status.setAttribute('role','status');
 const actions=ui('div','ttk-real-a4-actions');
 const preview=ui('button','ttk-real-a4-refresh','◉ Посмотреть печатный PDF А4');
 const open=ui('a','ttk-real-a4-open','↗ Открыть PDF на весь экран');
 preview.type='button';
 open.target='_blank';open.rel='noopener noreferrer';open.hidden=true;
 actions.append(preview,open);
 const frame=ui('iframe','ttk-real-a4-frame');
 frame.title='ТТК A4 — подлинный PDF выбранного дизайна';
 frame.setAttribute('loading','eager');
 frame.hidden=true;
 const note=ui('p','ttk-real-a4-footnote',
  'Галочки аллергенов предварительные. Сверяй состав с этикетками и учитывай перекрёстный контакт. Пустая клетка не означает отсутствие аллергена.');
 output.append(live.shell,status,actions,frame,note);
 stage.append(output);viewport.append(stage);
 let active=false,controller=null,requestNo=0,objectUrl=null;
 const clear=()=>{
  controller?.abort();controller=null;requestNo++;
  frame.removeAttribute('src');frame.hidden=true;
  open.removeAttribute('href');open.hidden=true;
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
 };
 const movePicker=show=>{(show?gallery:intro).append(picker);};
 function setMode(mode){
  active=mode==='paper';
  stage.hidden=!active;
  if(active){
   movePicker(true);
   // Each selected layout is a LIVE editable form, not a dead PDF frame.
   live.refresh();
   status.textContent='Заполняй поля прямо на выбранной карте. PDF нужен только для просмотра печати.';
  }else{
   movePicker(false);
   clear();
  }
 }
 function chosen(){
  return editor.dataset.ttkLayout||'teal-matrix';
 }
 async function showPdf(){
  if(!active)return;
  clear();
  const token=requestNo;
  let recipe;
  try{recipe=getDraft()}catch(error){
   status.textContent='Не удалось прочитать ТТК: '+(error.message||'проверь заполнение.');
   return;
  }
  const entered=!!recipe?.name?.trim()&&Array.isArray(recipe?.ingredients)&&
    recipe.ingredients.some(item=>String(item?.name||'').trim()&&Number(item?.grams)>0);
  const selected=chosen();
  if(!entered){status.textContent='Сначала заполни название блюда и хотя бы один ингредиент с граммовкой — после этого можно посмотреть PDF.';return;}
  const target={...recipe,layoutTemplate:selected};
  status.textContent='Готовлю печатный PDF А4 из ваших полей для «'+recipe.name+'»…';
  controller=new AbortController();
  const current=controller;
  const timeout=setTimeout(()=>current.abort(),30000);
  try{
   const response=await fetch('/api/recipes/pdf',{
    method:'POST',headers:{'Content-Type':'application/json'},
    credentials:'same-origin',body:JSON.stringify({recipe:target}),signal:current.signal
   });
   if(!response.ok){
    const problem=await response.json().catch(()=>({}));
    throw Error(problem.error||'Не удалось сформировать одностраничный PDF А4.');
   }
   const blob=await response.blob();
   if(!blob.type.includes('pdf')||blob.size<50)throw Error('Сервер не вернул PDF. Попробуй обновить предпросмотр.');
   if(requestNo!==token)return;
   objectUrl=URL.createObjectURL(blob);
   frame.src=objectUrl;frame.hidden=false;
   open.href=objectUrl;open.hidden=false;
   status.textContent='Печатная версия вашей ТТК «'+recipe.name+'». Выбранный дизайн: '+
     (picker.querySelector('[aria-pressed="true"] .ttk-design-info strong')?.textContent||selected)+'.';
  }catch(error){
   if(requestNo!==token)return;
   status.textContent=error.name==='AbortError'?
    'Превышено время формирования PDF. Нажми «Обновить PDF».':
    'Не удалось показать PDF: '+(error.message||'неизвестная ошибка');
  }finally{
   clearTimeout(timeout);
   if(controller===current)controller=null;
  }
 }
 picker.addEventListener('click',event=>{
  const card=event.target.closest?.('[data-ttk-layout]');
  if(active&&card)queueMicrotask(()=>{
   clear();live.setLayout();status.textContent='Оформление выбрано. Поля ниже можно заполнять прямо на листе.';
  });
 });
 preview.addEventListener('click',()=>void showPdf());
 setMode('form');
 return {setMode,showPdf,stage,live};
}
