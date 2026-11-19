/* FARRUH AI Premium · global A4 TTK defaults, device-local only.
   No private recipes or cloud credentials are stored here. Existing recipe
   cards are NEVER rewritten when defaults change. */
const STORAGE_KEY='farruh_ai_ttk_defaults_v1';
const DEFAULT=Object.freeze({
  layout:'premium-smart-a4',pieces:'8',nutritionAuto:true,showPencils:true,chef:'',approver:''
});
const LAYOUTS=[
 ['premium-smart-a4','00 · PREMIUM SMART · А4 / 15 позиций'],
 ['teal-matrix','01 · Бирюзовая матрица'],
 ['process-matrix','02 · Технологический процесс'],
 ['gold-allergen','03 · Золотая нумерация'],
 ['premium-blue','04 · Золотые аллергены']
];
function preferences(){
 let raw={};
 try{raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
 const validLayouts=LAYOUTS.map(x=>x[0]);
 return {
  layout:validLayouts.includes(raw.layout)?raw.layout:DEFAULT.layout,
  pieces:['1','4','6','8','10','12','16'].includes(String(raw.pieces))?String(raw.pieces):DEFAULT.pieces,
  nutritionAuto:typeof raw.nutritionAuto==='boolean'?raw.nutritionAuto:DEFAULT.nutritionAuto,
  showPencils:typeof raw.showPencils==='boolean'?raw.showPencils:DEFAULT.showPencils,
  chef:typeof raw.chef==='string'?raw.chef.slice(0,90):'',
  approver:typeof raw.approver==='string'?raw.approver.slice(0,90):''
 };
}
function store(value){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));return true;}catch{return false;}
}
const elem=(tag,cls,text)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(text!==undefined)x.textContent=text;return x;
};
export function mountTtkGeneralSettings(editor,stage,topbar){
 if(!editor||!stage||!topbar)throw Error('Нет панели редактирования ТТК.');
 const menu=elem('details','ttk-general-settings ttk-settings-access-row');
 const trigger=elem('summary','','⚙ Общие настройки ТТК');
 trigger.setAttribute('aria-label','Общие настройки ТТК');
 trigger.title='Общие настройки ТТК';
 const panel=elem('div','ttk-general-panel');
 const heading=elem('h3','','⚙ Общие настройки ТТК');
 const info=elem('p','ttk-general-note','Настройки по умолчанию для новых техкарт на этом устройстве. Сохранённые ТТК не изменятся.');
 panel.append(heading,info);
 const config=preferences();
 function persist(){
  const ok=store(config);
  note.textContent=ok?'✓ Настройки сохранены для новых ТТК.':'Не удалось сохранить: разрешите хранение данных браузера.';
  stage.classList.toggle('ttk-hide-edit-pencils',!config.showPencils);
 }
 function select(label,options,value,change){
  const row=elem('label','ttk-general-field');
  row.append(elem('span','',label));
  const control=elem('select','');
  for(const [id,text] of options)control.add(new Option(text,id));
  control.value=value;
  control.addEventListener('change',()=>{change(control.value);persist();});
  row.append(control);panel.append(row);
  return control;
 }
 select('Шаблон для новой ТТК',LAYOUTS,config.layout,
  value=>config.layout=value);
 select('Количество штук по умолчанию',
  ['1','4','6','8','10','12','16'].map(v=>[v,v+' шт.']),config.pieces,
  value=>config.pieces=value);
 function toggle(label,key){
  const row=elem('label','ttk-general-check');
  const control=elem('input');control.type='checkbox';control.checked=config[key];
  control.addEventListener('change',()=>{config[key]=control.checked;persist();});
  row.append(control,elem('span','',label));panel.append(row);
 }
 toggle('Автоматически рассчитывать КБЖУ в новых ТТК','nutritionAuto');
 toggle('Показывать значки ✎ на редактируемых блоках','showPencils');
 function textField(label,key){
  const row=elem('label','ttk-general-field');
  row.append(elem('span','',label));
  const input=elem('input');input.type='text';input.value=config[key];
  input.maxLength=90;input.placeholder=key==='chef'?'Шеф-повар / разработал':'Утверждаю';
  input.addEventListener('input',()=>{config[key]=input.value;persist();});
  row.append(input);panel.append(row);
 }
 textField('Разработал (для новых ТТК)','chef');
 textField('Утверждаю (для новых ТТК)','approver');
 panel.append(elem('p','ttk-general-note',
  'Формат PDF остаётся А4 — один лист. Нормы хранения, аллергены и сроки устанавливаются для каждого блюда отдельно.'));
 const action=elem('div','ttk-general-actions');
 const reset=elem('button','','↺ Сбросить настройки');reset.type='button';
 reset.addEventListener('click',()=>{
  const d={...DEFAULT};
  Object.assign(config,d);store(d);
  menu.open=false;panel.querySelectorAll('select').forEach((x,i)=>{
   x.value=i===0?config.layout:config.pieces;
  });
  panel.querySelectorAll('.ttk-general-check input').forEach((x,i)=>{
   x.checked=i===0?config.nutritionAuto:config.showPencils;
  });
  const names=panel.querySelectorAll('.ttk-general-field input');
  if(names[0])names[0].value='';if(names[1])names[1].value='';
  persist();
 });
 const done=elem('button','ttk-general-close','✓ Готово');done.type='button';
 done.addEventListener('click',()=>{menu.open=false;});
 action.append(reset,done);panel.append(action);
 const note=elem('p','ttk-general-note','');note.setAttribute('aria-live','polite');
 panel.append(note);
 // Standalone visible row UNDER the A4 toolbar. The old tiny ⚙ icon was
 // cramped between four toolbar controls on Android and could be clipped.
 menu.append(trigger,panel);topbar.after(menu);
 const applyToNew=()=>{
  if(editor.hidden)return;
  if(!editor.querySelector('#edit-title')?.textContent?.includes('Новая техкарта'))return;
  const settings=preferences();
  const qty=editor.querySelector('#card-pieces');
  if(qty){
   if(![...qty.options].some(o=>o.value===settings.pieces))
    qty.add(new Option(settings.pieces+' шт.',settings.pieces));
   if(qty.value!==settings.pieces){
    qty.value=settings.pieces;
    qty.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }
  const auto=editor.querySelector('#nutrition-auto');
  if(auto&&auto.checked!==settings.nutritionAuto){
   auto.checked=settings.nutritionAuto;
   auto.dispatchEvent(new Event('change',{bubbles:true}));
  }
  for(const [id,value] of [['card-chef',settings.chef],['card-approver',settings.approver]]){
   const field=editor.querySelector('#'+id);
   if(field&&value&&field.value!==value){
    field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));
   }
  }
  if(settings.layout==='premium-smart-a4'&&editor.dataset.ttkLayout!==settings.layout)document.dispatchEvent(new CustomEvent('ttk:choose-layout',{detail:{id:settings.layout,notify:false}}));
  else {
   const card=editor.querySelector('#ttk-design-picker [data-ttk-layout="'+settings.layout+'"]');
   if(card&&card.getAttribute('aria-pressed')!=='true')card.click();
  }
 };
 // Main app opens a NEW card synchronously through these existing buttons.
 // Apply defaults one tick later; NEVER overwrite a saved card being edited.
 document.addEventListener('click',event=>{
  if(!event.target.closest?.('#newrecipe,#home-new-recipe,#quickrecipe'))return;
  setTimeout(applyToNew,0);
 });
 document.addEventListener('click',event=>{
  if(menu.open&&!menu.contains(event.target))menu.open=false;
 });
 stage.classList.toggle('ttk-hide-edit-pencils',!config.showPencils);
 return {menu,preferences,applyToNew};
}
