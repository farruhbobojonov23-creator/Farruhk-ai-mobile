/* FARRUH AI Premium · editable visual TTK page.
 * All values are proxied into the ORIGINAL form elements. No duplicated
 * recipe persistence, formulas, attachments or approval state.
 */
import {recipeAllergenMatrix} from './ttk-allergens.js?v=2';
import {mountReferenceLayouts} from './ttk-reference-layouts.js?v=1';
const node=(tag,cls,text)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=text;
 return n;
};
// Inline SVG uses only trusted, constant paths. Scales cleanly on mobile A4
// without loading an icon font, PNG, third-party resource or user HTML.
const mastIconPaths=Object.freeze({
 crown:'<path d="m2 7 4.5 4 5.5-7 5.5 7L22 7l-2 12H4L2 7Z"/><path d="M5 22h14"/>',
 chef:'<path d="M6 19v-7a4 4 0 0 1-.5-7.5A5 5 0 0 1 12 3a5 5 0 0 1 6.5 1.5A4 4 0 0 1 18 12v7"/><path d="M6 16h12M6 20h12"/>',
 shield:'<path d="M12 2 4 5v6c0 5.5 3.1 8.4 8 11 4.9-2.6 8-5.5 8-11V5l-8-3Z"/><path d="m8.5 12.3 2.5 2.5 4.7-5.3"/>',
 box:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/>',
 print:'<path d="M6 8V3h12v5M6 18H4a2 2 0 0 1-2-2v-5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2h-2"/><path d="M6 15h12v7H6zM18 12h.01"/>'
});
function mastIcon(name){
 const outer=node('span','ttk-live-mast-icon');
 outer.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+mastIconPaths[name]+'</svg>';
 return outer;
}
const number=x=>Number(x)>0?Number(x).toLocaleString('ru-RU',{maximumFractionDigits:2}):'—';
const entries={
 'recipe-name':'Блюдо','card-number':'ТТК №','recipe-category':'Категория',
 'card-pieces':'Количество','card-yield':'Выход, г','card-date':'Дата',
 'recipe-status':'Статус','card-scope':'Область применения',
 'card-raw':'Требования к сырью','card-prep':'Подготовка','technology':'Формовка / приготовление',
 'card-serving':'Нарезка и подача','card-appearance':'Внешний вид',
 'card-taste':'Вкус, запах и консистенция','card-storage':'Хранение и реализация',
 'card-safety':'ХАССП / безопасность','card-chef':'Разработал (шеф)',
 'card-approver':'Утверждаю','card-protein':'Белки','card-fat':'Жиры',
 'card-carbs':'Углеводы','card-kcal':'Ккал'
};
export function mountInlineTtkPage(editor){
 if(!editor)throw Error('Не найдена форма для заполнения ТТК.');
 const page=node('div','ttk-live-page');
 page.id='ttk-live-page';page.dataset.ttkLayout=editor.dataset.ttkLayout||'teal-matrix';
 page.setAttribute('aria-label','Редактируемый шаблон технологической карты А4');
 const bounds=new Map();
 const get=id=>editor.querySelector('#'+id);
 const emit=(el,kind='input')=>el.dispatchEvent(new Event(kind,{bubbles:true}));
 function proxy(id,opts={}){
  const source=get(id);
  if(!source)throw Error('Не найдено поле ТТК: '+id);
  const label=node('label','ttk-live-label '+(opts.className||''));
  label.dataset.ttkField=id;
  const caption=node('span','ttk-live-caption',opts.caption||entries[id]||id);
  let input;
  if(source.tagName==='SELECT'){
   input=node('select','ttk-live-control');
   for(const option of source.options)input.add(new Option(option.textContent,option.value));
  }else if(source.tagName==='TEXTAREA'){
   input=node('textarea','ttk-live-control');
   input.rows=opts.rows||2;
  }else{
   input=node('input','ttk-live-control');
   input.type=source.type||'text';
   if(source.type==='number'){
    input.min=source.min||'0';input.max=source.max||'10000000';input.step=source.step||'any';
   }
   if(source.maxLength>0)input.maxLength=source.maxLength;
  }
  input.setAttribute('aria-label',entries[id]||id);
  input.dataset.source=id;
  input.value=source.value;
  if(opts.placeholder)input.placeholder=opts.placeholder;
  input.readOnly=!!source.readOnly;
  if(source.tagName==='SELECT'){
   input.addEventListener('change',()=>{
    source.value=input.value;emit(source,'change');refreshComputed();
   });
  }else{
   input.addEventListener('input',()=>{
    source.value=input.value;emit(source);
    refreshComputed();
    if(id==='recipe-name')nameShown.textContent=input.value.trim()||'Название блюда';
   });
   input.addEventListener('change',()=>{source.value=input.value;emit(source,'change');refreshComputed()});
  }
  label.append(caption,input);
  bounds.set(id,input);
  return label;
 }
 // Firm-style paper masthead intentionally matches the four approved A4
 // references. The badges are printed labels, not false navigation buttons.
 const masthead=node('header','ttk-live-hero ttk-live-paper-mast');
 masthead.setAttribute('aria-label','FARRUH AI Premium — профессиональные технологические карты');
 const mastBrand=node('div','ttk-live-paper-brand');
 mastBrand.append(mastIcon('crown'));
 const brandWords=node('span','ttk-live-brand-words');
 brandWords.append(node('strong','','FARRUH AI'),node('em','','Premium'));
 mastBrand.append(brandWords);
 const descriptor=node('div','ttk-live-paper-descriptor');
 descriptor.append(node('span','','ПРОФЕССИОНАЛЬНАЯ СИСТЕМА'),
  node('span','','ТЕХНОЛОГИЧЕСКИХ КАРТ'),
  node('span','','ДЛЯ HORECA'));
 const badges=node('div','ttk-live-paper-badges');
 for(const [icon,label] of [['chef','ТТК'],['shield','ХАССП'],['box','ПФ'],['print','Печать']]){
  const badge=node('span','ttk-live-paper-badge');
  badge.append(mastIcon(icon),node('span','',label));
  badges.append(badge);
 }
 masthead.append(mastBrand,descriptor,badges);
 const title=node('div','ttk-live-title');
 title.append(node('strong','','ТЕХНОЛОГИЧЕСКАЯ КАРТА (ТТК)'),node('span','','№'));
 const numberInput=proxy('card-number',{caption:'Номер карты'});
 numberInput.classList.add('ttk-live-number');
 title.append(numberInput);
 const name=node('div','ttk-live-name');
 const nameShown=node('span','ttk-live-name-sample');
 nameShown.textContent=get('recipe-name').value.trim()||'Название блюда';
 name.append(nameShown,proxy('recipe-name',{caption:'Название блюда',placeholder:'Например, Филадельфия классик'}));
 const meta=node('div','ttk-live-meta');
 meta.append(proxy('recipe-category'),proxy('card-yield'),proxy('card-pieces'),proxy('card-date'),proxy('recipe-status'));
 const section=(number,title,cls='')=>{
  const panel=node('section','ttk-live-section '+cls);
  const header=node('h3','ttk-live-section-head');
  if(number!==null)header.append(node('span','ttk-live-count',String(number)));
  header.append(node('strong','',title));
  panel.append(header);return panel;
 };
 const scope=section(1,'ОБЛАСТЬ ПРИМЕНЕНИЯ','ttk-live-scope');
 scope.append(proxy('card-scope',{rows:4}));
 const raw=section(2,'ТРЕБОВАНИЯ К СЫРЬЮ','ttk-live-raw');
 raw.append(proxy('card-raw',{rows:4}));
 const introPair=node('div','ttk-live-row ttk-live-intro-pair');introPair.append(scope,raw);
 const formula=section(3,'РЕЦЕПТУРА (НОРМА ЗАКЛАДКИ НА ПОРЦИЮ)','ttk-live-formula');
 const ingredientHead=node('div','ttk-live-ingredient-head');
 for(const name of ['Ингредиент','Брутто, г','Отходы, %','Нетто, г',''])ingredientHead.append(node('span','',name));
 const rows=node('div','ttk-live-ingredient-rows');
 const add=node('button','ttk-live-add','＋ Добавить ингредиент');add.type='button';
 add.addEventListener('click',()=>{
  get('addingredient').click();renderIngredients();refreshComputed();
  rows.lastElementChild?.querySelector('input')?.focus();
 });
 const yieldBand=node('div','ttk-live-yield');
 yieldBand.append(node('strong','','Выход готового блюда:'),node('span','ttk-live-yield-value','—'));
 formula.append(ingredientHead,rows,add,yieldBand);
 const allergens=section(null,'МАТРИЦА АЛЛЕРГЕНОВ','ttk-live-allergens');
 const allergenRows=node('div','ttk-live-allergen-rows');allergens.append(allergenRows);
 allergens.append(node('small','ttk-live-allergen-info','Предварительные отметки по ингредиентам; необходимо сверять этикетки.'));
 const recipePair=node('div','ttk-live-row ttk-live-recipe-pair');recipePair.append(formula,allergens);
 const process=section(4,'ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ','ttk-live-process');
 const processFields=node('div','ttk-live-process-fields');
 const pre=proxy('card-prep',{caption:'1 · Подготовка',rows:3});
 const forming=proxy('technology',{caption:'2 · Формовка и приготовление',rows:3});
 const serving=proxy('card-serving',{caption:'3 · Нарезка и подача',rows:3});
 processFields.append(pre,forming,serving);process.append(processFields);
 const quality=section(5,'КОНТРОЛЬ КАЧЕСТВА','ttk-live-quality');
 quality.append(proxy('card-appearance',{rows:3}),proxy('card-taste',{rows:3}));
 const conditions=section(6,'УСЛОВИЯ ХРАНЕНИЯ И РЕАЛИЗАЦИИ','ttk-live-conditions');
 conditions.append(proxy('card-storage',{rows:4}));
 const nutrition=section(7,'ПИЩЕВАЯ ЦЕННОСТЬ (КБЖУ)','ttk-live-nutrition');
 const auto=node('label','ttk-live-auto');
 const autoCheckbox=node('input');autoCheckbox.type='checkbox';
 const sourceAuto=get('nutrition-auto');
 autoCheckbox.checked=sourceAuto.checked;
 autoCheckbox.addEventListener('change',()=>{
  sourceAuto.checked=autoCheckbox.checked;emit(sourceAuto,'change');refreshComputed();
 });
 auto.append(autoCheckbox,node('span','','Автоматический расчёт'));
 nutrition.append(auto);
 const nutriFields=node('div','ttk-live-nutri-grid');
 for(const id of ['card-protein','card-fat','card-carbs','card-kcal'])nutriFields.append(proxy(id));
 nutrition.append(nutriFields,node('small','ttk-live-nutri-note','Показатели на 100 г. При автоматическом расчёте используются данные ингредиентов.'));
 const qualityPair=node('div','ttk-live-row ttk-live-quality-pair');
 qualityPair.append(quality,conditions,nutrition);
 const safety=section(8,'БЕЗОПАСНОСТЬ (ХАССП)','ttk-live-safety');
 safety.append(proxy('card-safety',{rows:3}));
 const signs=node('div','ttk-live-signatures');
 signs.append(proxy('card-chef'),proxy('card-approver'));
 const regulatory=node('footer','ttk-live-regulatory',
   'Нормативная основа: действующие санитарные правила и технические регламенты. Данные и аллергены проверяют до утверждения.');
 const lower=node('div','ttk-live-lower');lower.append(process,qualityPair,safety,signs,regulatory);
 page.append(masthead,title,name,meta,introPair,recipePair,lower);
 const status=node('p','ttk-live-edit-status','Нажимайте на поля непосредственно в выбранном шаблоне. Все изменения идут в настоящую ТТК.');
 status.setAttribute('role','status');
 const tools=node('div','ttk-live-actions');
 const save=node('button','ttk-live-save','✓ Сохранить ТТК');
 save.type='button';
 save.addEventListener('click',()=>{
  // Using the same submit handler avoids duplicating validation and persistence.
  editor.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
 });
 const download=node('button','ttk-live-download','↓ Сохранить и скачать PDF');
 download.type='button';
 download.addEventListener('click',()=>get('sheet-download').click());
 tools.append(save,download);
 const shell=node('div','ttk-live-shell');shell.append(page,status,tools);
 function sourceProxy(row,key,label,readOnly=false){
  const input=node('input','ttk-live-ingredient-input');
  const original=row.querySelector('[data-key="'+key+'"]');
  input.type=key==='name'?'text':'number';input.value=original?.value||'';
  input.setAttribute('aria-label',label);
  input.dataset.ingredientKey=key;
  if(key!=='name'){input.step='any';input.min='0';}
  input.readOnly=readOnly;
  if(!original)return input;
  input.addEventListener('input',()=>{
   original.value=input.value;emit(original);
   const gross=row.querySelector('[data-key="grossGrams"]');
   const grossProxy=input.closest('.ttk-live-ingredient-row')?.querySelector('[data-ingredient-key="grossGrams"]');
   if(grossProxy)grossProxy.value=gross.value;
   refreshComputed();
  });
  input.addEventListener('change',()=>{original.value=input.value;emit(original,'change');refreshComputed()});
  return input;
 }
 function renderIngredients(){
  rows.replaceChildren();
  const sourceRows=[...get('ingredients').querySelectorAll('.ingredient')];
  sourceRows.forEach((sourceRow,index)=>{
   const row=node('div','ttk-live-ingredient-row');
   row.dataset.index=String(index);
   row.append(
    sourceProxy(sourceRow,'name','Ингредиент №'+(index+1)),
    sourceProxy(sourceRow,'grossGrams','Брутто, г',true),
    sourceProxy(sourceRow,'lossPercent','Отходы, %'),
    sourceProxy(sourceRow,'grams','Нетто, г'));
   const remove=node('button','ttk-live-remove','×');
   remove.type='button';remove.title='Удалить ингредиент '+(index+1);
   remove.setAttribute('aria-label','Удалить ингредиент '+(index+1));
   remove.addEventListener('click',()=>{
    sourceRow.querySelector('button')?.click();
    renderIngredients();refreshComputed();
   });row.append(remove);rows.append(row);
  });
  if(!sourceRows.length){
   const missing=node('p','ttk-live-empty','Добавьте ингредиенты, чтобы сформировать рецептуру.');
   rows.append(missing);
  }
 }
 function syncFromSource(){
  for(const [id,input] of bounds){
   const src=get(id);
   if(!src||input===document.activeElement)continue;
   if(src.tagName==='SELECT'){
    const desired=[...src.options].map(x=>x.value).join('|');
    const actual=[...input.options].map(x=>x.value).join('|');
    if(desired!==actual)input.replaceChildren(...[...src.options].map(o=>new Option(o.text,o.value)));
   }
   input.value=src.value;
   input.readOnly=!!src.readOnly;
  }
  autoCheckbox.checked=sourceAuto.checked;
  nameShown.textContent=get('recipe-name').value.trim()||'Название блюда';
  for(const [i,sourceRow] of [...get('ingredients').querySelectorAll('.ingredient')].entries()){
   const shadow=rows.querySelector('[data-index="'+i+'"]');if(!shadow)continue;
   for(const key of ['name','grams','grossGrams','lossPercent']){
    const input=shadow.querySelector('[data-ingredient-key="'+key+'"]');
    const original=sourceRow.querySelector('[data-key="'+key+'"]');
    if(input&&original&&document.activeElement!==input)input.value=original.value;
   }
  }
 }
 function refreshComputed(){
  yieldBand.lastChild.textContent=number(get('card-yield').value)+' г ('+
   (get('card-pieces').selectedOptions?.[0]?.textContent||get('card-pieces').value)+' )';
  let allergenOverrides={};
  try{allergenOverrides=JSON.parse(editor.dataset.allergenOverrides||'{}')}catch{}
  const matrix=recipeAllergenMatrix({
   allergenOverrides,
   ingredients:[...get('ingredients').querySelectorAll('.ingredient')].map(row=>({
    name:row.querySelector('[data-key="name"]')?.value||''
   }))
  });
  allergenRows.replaceChildren(...matrix.groups.map(group=>{
   const entry=node('div','ttk-live-allergen-row');
   const marker=node('strong','ttk-live-allergen-box',group.checked?'✓':group.possible?'?':'');
   marker.dataset.state=group.checked?'present':group.possible?'possible':'absent';
   marker.title=group.manual?'Отметка вручную: требуется проверка по этикетке':group.checked?'Предположительно присутствует':group.possible?'Возможно присутствие':'Не найдено по названию ингредиентов, проверь состав';
   entry.append(node('span','',group.label),marker);return entry;
  }));
  syncFromSource();reference.update();
  // Delayed text personalization sets source inputs programmatically.
  clearTimeout(refreshComputed.timer);
  refreshComputed.timer=setTimeout(syncFromSource,240);
 }
 const reference=mountReferenceLayouts(page,editor,{lower,process,processFields,quality,
  conditions,nutrition,safety,signs,regulatory,qualityPair,scope,raw,formula,
  allergens,allergenRows,meta});
 function refresh(){
  reference.arrange(editor.dataset.ttkLayout||'teal-matrix');
  renderIngredients();
  refreshComputed();
 }
 return {shell,page,refresh,refreshComputed,setLayout:()=>{
  reference.arrange(editor.dataset.ttkLayout||'teal-matrix');refreshComputed();
 }};
}
