/* FARRUH AI Premium · one A4 page on phone and desktop.
 * A4 stays in landscape? No: portrait 794 × 1123, never a long mobile form.
 * Tapping an A4 section opens large accessible controls in a dialog.
 * Values only ever update the canonical existing recipe controls.
 */
import {TTK_ALLERGENS,recipeAllergenMatrix,validAllergenOverrides} from './ttk-allergens.js?v=1';
export function mountOnePageA4(editor,stage,live){
 if(!editor||!stage||!live?.page)throw Error('Невозможно открыть одностраничный редактор ТТК.');
 stage.classList.add('ttk-onepage-enabled');
 const page=live.page;
 const shell=live.shell;
 const actions=shell.querySelector('.ttk-live-actions');
 if(actions)shell.prepend(actions);
 const recipeInputs=editor.querySelector('#ingredients');
 const original=id=>editor.querySelector('#'+id);
 const dialog=document.createElement('dialog');
 dialog.className='ttk-onepage-dialog';
 dialog.id='ttk-onepage-dialog';
 dialog.setAttribute('aria-label','Редактирование выбранного блока ТТК');
 const header=document.createElement('div');header.className='ttk-onepage-dialog-head';
 const title=document.createElement('h2');title.textContent='Заполнение ТТК';
 const close=document.createElement('button');close.type='button';close.textContent='✕';
 close.className='ttk-onepage-dialog-close';close.setAttribute('aria-label','Закрыть редактирование');
 header.append(title,close);
 const content=document.createElement('div');content.className='ttk-onepage-dialog-body';
 const footer=document.createElement('div');footer.className='ttk-onepage-dialog-footer';
 const finish=document.createElement('button');finish.type='button';finish.textContent='✓ Готово';
 finish.className='ttk-onepage-dialog-finish';
 footer.append(finish);dialog.append(header,content,footer);document.body.append(dialog);
 let visible=false,refreshTimer=null,resizeObserver=null;
 const make=(tag,klass,txt)=>{
  const n=document.createElement(tag);
  if(klass)n.className=klass;if(txt!==undefined)n.textContent=txt;return n;
 };
 const dispatch=(n,type)=>n.dispatchEvent(new Event(type,{bubbles:true}));
 const inputIds={
  'recipe-name':'Название блюда','card-number':'Номер ТТК',
  'recipe-category':'Категория','card-yield':'Выход, г',
  'card-pieces':'Количество штук','card-date':'Дата',
  'recipe-status':'Статус','card-scope':'Область применения',
  'card-raw':'Требования к сырью','card-prep':'Подготовка',
  technology:'Формовка / приготовление','card-serving':'Нарезка / подача',
  'card-appearance':'Внешний вид','card-taste':'Вкус, запах, консистенция',
  'card-storage':'Хранение и реализация','card-safety':'ХАССП',
  'card-chef':'Разработал','card-approver':'Утверждаю',
  'card-protein':'Белки, г','card-fat':'Жиры, г',
  'card-carbs':'Углеводы, г','card-kcal':'Ккал'
 };
 function field(id){
  const source=original(id);
  if(!source)return null;
  const wrap=make('label','ttk-onepage-field');
  wrap.append(make('span','',inputIds[id]||id));
  let control;
  if(source.tagName==='TEXTAREA'){control=make('textarea');control.rows=5;}
  else if(source.tagName==='SELECT'){
   control=make('select');
   for(const option of source.options)control.add(new Option(option.text,option.value));
  }else{
   control=make('input');control.type=source.type||'text';
   if(source.type==='number'){control.min=source.min;control.max=source.max;control.step=source.step;}
  }
  control.className='ttk-onepage-field-input';
  control.setAttribute('aria-label',inputIds[id]||id);
  control.value=source.value;control.readOnly=!!source.readOnly;
  if(source.readOnly)wrap.append(make('small','','Рассчитывается автоматически по ингредиентам.'));
  const sync=event=>{
   source.value=control.value;
   dispatch(source,event.type);
   live.refreshComputed();
   scheduleFit();
  };
  control.addEventListener('input',sync);
  control.addEventListener('change',sync);
  wrap.append(control);
  return wrap;
 }
 function inventory(){
  content.replaceChildren();
  const note=make('p','ttk-onepage-dialog-note',
   'Изменения сразу попадают в настоящую рецептуру ТТК. Все ингредиенты остаются в базе, даже если на компактном листе показаны только первые строки.');
  content.append(note);
  const materials=[...recipeInputs.querySelectorAll('.ingredient')];
  materials.forEach((row,i)=>{
   const card=make('div','ttk-onepage-product');
   const heading=make('div','ttk-onepage-product-head');
   heading.append(make('strong','','№ '+(i+1)));
   const del=make('button','','× Удалить');del.type='button';del.setAttribute('aria-label','Удалить ингредиент №'+(i+1));
   del.addEventListener('click',()=>{row.querySelector('button')?.click();live.refresh();inventory();});
   heading.append(del);card.append(heading);
   const grid=make('div','ttk-onepage-product-grid');
   for(const [key,label] of [
    ['name','Название ингредиента'],['grams','Нетто, г'],
    ['lossPercent','Отходы, %'],['grossGrams','Брутто, г']
   ]){
    const src=row.querySelector('[data-key="'+key+'"]');
    if(!src)continue;
    const wrapper=make('label','ttk-onepage-field');
    wrapper.append(make('span','',label));
    const input=make('input','ttk-onepage-field-input');
    input.type=key==='name'?'text':'number';input.value=src.value;
    if(key!=='name'){input.step='any';input.min='0';}
    input.readOnly=!!src.readOnly;
    input.addEventListener('input',()=>{
     src.value=input.value;dispatch(src,'input');
     const gross=row.querySelector('[data-key="grossGrams"]');
     const grossModal=card.querySelector('[data-modal-key="grossGrams"]');
     if(grossModal)grossModal.value=gross.value;
     live.refreshComputed();scheduleFit();
    });
    input.setAttribute('data-modal-key',key);
    wrapper.append(input);grid.append(wrapper);
   }
   card.append(grid);content.append(card);
  });
  const add=make('button','ttk-onepage-add','＋ Добавить ингредиент');
  add.type='button';add.addEventListener('click',()=>{
   original('addingredient')?.click();
   live.refresh();inventory();
   const names=content.querySelectorAll('[data-modal-key="name"]');
   names[names.length-1]?.focus();
  });content.append(add);
  const footerNote=make('small','ttk-onepage-dialog-note','Галочки аллергенов рассчитываются по составу. Сверяй информацию с этикетками поставщика.');
  content.append(footerNote);
 }
 function nutrition(){
  content.replaceChildren();
  const toggle=make('label','ttk-onepage-auto');
  const checkbox=make('input');checkbox.type='checkbox';
  checkbox.checked=original('nutrition-auto')?.checked||false;
  checkbox.addEventListener('change',()=>{
   const src=original('nutrition-auto');src.checked=checkbox.checked;dispatch(src,'change');
   live.refreshComputed();
   for(const [id,fieldEl] of fields){
    const control=fieldEl.querySelector('.ttk-onepage-field-input');
    const srcNode=original(id);if(control&&srcNode){control.value=srcNode.value;control.readOnly=srcNode.readOnly;}
   }
  });
  toggle.append(checkbox,make('span','','Автоматический расчёт КБЖУ'));content.append(toggle);
  const fields=[];
  for(const id of ['card-protein','card-fat','card-carbs','card-kcal']){
   const f=field(id);if(f){content.append(f);fields.push([id,f]);}
  }
  content.append(make('small','ttk-onepage-dialog-note',
   'КБЖУ на 100 г продукта указывай по этикетке. Справочные показатели ориентировочны.'));
  const details=make('details','ttk-onepage-nutrition-details');
  const summary=make('summary','','КБЖУ каждого ингредиента · заполнить');
  details.append(summary);
  const items=[...recipeInputs.querySelectorAll('.ingredient')];
  for(const [index,row] of items.entries()){
   const source=document.getElementById(row.dataset.nutritionId);
   if(!source)continue;
   const block=make('div','ttk-onepage-nutrition-ingredient');
   const name=row.querySelector('[data-key="name"]')?.value||'Ингредиент №'+(index+1);
   block.append(make('strong','',name));
   const grid=make('div','ttk-onepage-nutrition-grid');
   for(const [key,label] of [['protein','Белки'],['fat','Жиры'],['carbs','Углеводы'],['kcal','Ккал']]){
    const src=source.querySelector('[data-key="'+key+'"]');
    if(!src)continue;
    const wrapper=make('label','ttk-onepage-field');
    wrapper.append(make('span','',label+' на 100 г'));
    const input=make('input','ttk-onepage-field-input');
    input.type='number';input.step='any';input.min='0';input.value=src.value;
    input.addEventListener('input',()=>{
     src.value=input.value;dispatch(src,'input');
     live.refreshComputed();
     for(const [id,el] of fields){
      const modal=el.querySelector('.ttk-onepage-field-input');
      if(modal){modal.value=original(id)?.value||'';modal.readOnly=!!original(id)?.readOnly;}
     }
    });
    wrapper.append(input);grid.append(wrapper);
   }
   block.append(grid);details.append(block);
  }
  content.append(details);
 }
 function allergens(){
  content.replaceChildren();
  const raw=editor.dataset.allergenOverrides||'{}';
  let overrides={};
  try{overrides=validAllergenOverrides(JSON.parse(raw))}catch{}
  const ingredients=[...recipeInputs.querySelectorAll('.ingredient')].map(row=>({
   name:row.querySelector('[data-key="name"]')?.value||''
  }));
  const matrix=recipeAllergenMatrix({ingredients,allergenOverrides:overrides});
  const note=make('p','ttk-onepage-dialog-note',
   'Предварительные галочки по названиям ингредиентов. Проверь этикетки поставщиков и состав полуфабрикатов. Снятая галочка НЕ подтверждает отсутствие аллергена.');
  content.append(note);
  for(const group of matrix.groups){
   const line=make('label','ttk-onepage-allergen-line');
   const check=make('input');check.type='checkbox';check.checked=group.checked;
   const text=make('span','',group.label);
   const caption=make('small','',group.manual?'Изменено вручную':group.checked?'Обнаружено по названию':'Не выявлено по названию · требуется проверка');
   check.addEventListener('change',()=>{
    overrides[group.id]=check.checked;
    editor.dataset.allergenOverrides=JSON.stringify(overrides);
    caption.textContent='Изменено вручную · проверь этикетку';
    live.refreshComputed();
   });
   line.append(check,text,caption);content.append(line);
  }
  const reset=make('button','ttk-onepage-allergen-reset','↺ Вернуть автоопределение');
  reset.type='button';reset.addEventListener('click',()=>{
   editor.dataset.allergenOverrides='{}';live.refreshComputed();allergens();
  });
  content.append(reset);
 }
 const panels=[
  ['.ttk-live-title',['card-number'],'Номер технологической карты'],
  ['.ttk-live-name',['recipe-name'],'Название блюда'],
  ['.ttk-live-meta',['recipe-category','card-yield','card-pieces','card-date','recipe-status'],'Основные параметры ТТК'],
  ['.ttk-live-scope',['card-scope'],'Область применения'],
  ['.ttk-live-raw',['card-raw'],'Требования к сырью'],
  ['.ttk-live-formula',null,'Рецептура и ингредиенты'],
  ['.ttk-live-allergens',null,'Матрица аллергенов'],
  ['.ttk-live-process',['card-prep','technology','card-serving'],'Технология приготовления'],
  ['.ttk-live-quality',['card-appearance','card-taste'],'Контроль качества'],
  ['.ttk-live-conditions',['card-storage'],'Условия хранения'],
  ['.ttk-live-nutrition',null,'Пищевая ценность (КБЖУ)'],
  ['.ttk-live-safety',['card-safety'],'Безопасность (ХАССП)'],
  ['.ttk-live-signatures',['card-chef','card-approver'],'Разработал и утвердил']
 ];
 function openSection(index){
  const entry=panels[index];if(!entry)return;
  const [,,heading]=entry;
  title.textContent=heading;content.replaceChildren();
  if(index===5)inventory();
  else if(index===6)allergens();
  else if(index===10)nutrition();
  else for(const id of entry[1]||[]){
   const f=field(id);if(f)content.append(f);
  }
  if(!dialog.open)dialog.showModal();
  content.scrollTop=0;
  // Long-screen page remains fixed while dialog is open.
  document.documentElement.classList.add('ttk-onepage-dialog-open');
 }
 function closeDialog(){
  if(dialog.open)dialog.close();
  document.documentElement.classList.remove('ttk-onepage-dialog-open');
  live.refresh();scheduleFit();
 }
 close.addEventListener('click',closeDialog);
 finish.addEventListener('click',closeDialog);
 dialog.addEventListener('close',()=>{
  document.documentElement.classList.remove('ttk-onepage-dialog-open');
  live.refresh();scheduleFit();
 });
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});
 for(const [index,[selector]] of panels.entries()){
  const target=page.querySelector(selector);
  if(!target)continue;
  target.classList.add('ttk-onepage-tap');
  target.tabIndex=0;target.setAttribute('role','button');
  target.setAttribute('aria-label','Изменить: '+panels[index][2]);
  // Editing tiny inline inputs in a scaled sheet is error-prone.
  // Open large accessible controls instead; underlying inputs remain synced.
  target.addEventListener('click',e=>{
   e.preventDefault();e.stopPropagation();openSection(index);
  },true);
  target.addEventListener('keydown',e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();openSection(index);}
  });
 }
 const mark=make('div','ttk-onepage-overflow-marker');
 mark.setAttribute('aria-live','polite');
 page.querySelector('.ttk-live-ingredient-rows')?.after(mark);
 function ingredientNote(){
  const n=recipeInputs.querySelectorAll('.ingredient').length;
  mark.textContent=n>5?'+ '+(n-5)+' ингредиентов — нажми «Рецептура», чтобы редактировать все':'';
  const rows=page.querySelectorAll('.ttk-live-ingredient-row');
  for(const [i,row] of rows.entries())row.hidden=i>=5;
 }
 function fit(){
  if(!visible||editor.hidden||!stage.isConnected)return;
  ingredientNote();
  const rect=stage.getBoundingClientRect();
  const parent=page.parentElement;
  if(!parent)return;
  const stageStyle=getComputedStyle(stage);
  const padding=(parseFloat(stageStyle.paddingLeft)||0)+(parseFloat(stageStyle.paddingRight)||0);
  const shellRect=parent.getBoundingClientRect();
  const width=Math.max(190,Math.min(rect.width-padding,shellRect.width-2));
  const mobile=window.innerWidth<=760;
  // Keep both A4 height and chooser within the mobile viewport.
  const chooser=stage.querySelector('#ttk-design-picker')?.getBoundingClientRect().height||44;
  const controls=stage.querySelector('.ttk-live-actions')?.getBoundingClientRect().height||38;
  const bar=stage.querySelector('.ttk-onepage-topbar')?.getBoundingClientRect().height||35;
  // Fit inside the ACTUAL fixed preview region, not the entire document;
  // leave room for header, four compact tabs, save/print actions and gutters.
  const available=stage.clientHeight-bar-chooser-controls-30;
  const spare=Math.max(160,Math.min(window.innerHeight-(mobile?155:135),available));
  const ratio=Math.max(.20,Math.min(1,width/794,spare/1123));
  page.style.setProperty('--ttk-onepage-zoom',String(ratio));
  page.dataset.ttkScale=ratio.toFixed(3);
  page.setAttribute('aria-description','Лист А4 в масштабе '+Math.round(ratio*100)+' %. Нажми на блок для редактирования крупным шрифтом.');
 }
 function scheduleFit(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(fit,45);
 }
 let oldRefresh=live.refresh;
 live.refresh=(...args)=>{
  const outcome=oldRefresh(...args);
  ingredientNote();scheduleFit();
  return outcome;
 };
 let oldRefreshComputed=live.refreshComputed;
 live.refreshComputed=(...args)=>{
  const outcome=oldRefreshComputed(...args);
  ingredientNote();scheduleFit();
  return outcome;
 };
 function setVisible(isVisible){
  visible=!!isVisible;
  if(visible){live.refresh();scheduleFit();}
  else if(dialog.open)closeDialog();
 }
 const resize=()=>scheduleFit();
 window.addEventListener('resize',resize,{passive:true});
 if('ResizeObserver' in window){
  resizeObserver=new ResizeObserver(scheduleFit);
  resizeObserver.observe(stage);
 }
 return {dialog,fit,scheduleFit,setVisible,openSection};
}
