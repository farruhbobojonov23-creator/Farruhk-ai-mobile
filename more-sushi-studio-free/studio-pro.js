/* МОРЕ СУШИ • STUDIO PRO • precise navigation and ingredient workflows */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const nav=el('nav'),ingPage=el('ingredientsPage');
if(!nav||!ingPage||window.MSStudioProReady)return;
window.MSStudioProReady=true;
const icons={
home:'<rect x="3" y="10" width="18" height="11" rx="2"/><path d="m3 10 9-7 9 7M9 21v-7h6v7"/>',
ingredients:'<path d="M5 21h14M7 21v-7M17 21v-7M6 14V6l6-3 6 3v8z"/><path d="M12 9v12M9 9h6"/>',
prefab:'<path d="M3 10h18M5 10c0 6 3 9 7 9s7-3 7-9M10 7h4M7 4h10"/><path d="M9 22h6"/>',
product:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h10M7 16h6"/>',
ttk:'<path d="M8 3h8l5 5v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M16 3v6h5M10 13h7M10 17h7"/>'
};
const configs=[
 {selector:'button[data-page="home"]',title:'Обзор',icon:'home'},
 {selector:'button[data-page="ingredients"]',title:'Ингредиенты',icon:'ingredients'},
 {selector:'button[data-page="prefab"]',title:'Полуфабрикаты',icon:'prefab'},
 {selector:'button[data-page="product"]',title:'Товары и меню',icon:'product'},
 {selector:'button:not([data-page])',title:'ТТК и печать',icon:'ttk'}
];
const externals=[...nav.querySelectorAll('button:not([data-page])')];
if(externals.length>1)externals.slice(1).forEach(b=>b.remove());
configs.forEach(item=>{
 const b=nav.querySelector(item.selector);if(!b)return;
 const i=document.createElement('span');i.className='msNavIcon';i.setAttribute('aria-hidden','true');
 i.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[item.icon]+'</svg>';
 const label=document.createElement('span');label.textContent=item.title;
 b.replaceChildren(i,label);
 if(item.icon==='ttk')b.classList.add('msTtkNav');
});
const aside=nav.closest('.side');
if(aside&&!aside.querySelector('.msShellVersion')){
 const meta=document.createElement('div');meta.className='msShellVersion';meta.textContent='STUDIO PRO • РАБОЧАЯ СИСТЕМА';
 nav.after(meta);
}
const form=el('ingredientFormPanel');
const list=ingPage.querySelectorAll(':scope > .panel')[1];
if(form&&list){
 list.classList.add('msIngredientListPanel');
 const tools=document.createElement('div');tools.className='msIngredientsToolbar';
 tools.innerHTML='<div><h2>Каталог ингредиентов</h2><p>Выберите категорию, найдите сырьё или откройте карточку для редактирования.</p></div>'+
 '<div class="msIngredientTools">'+
 '<button type="button" id="msAddIngredient">＋ Добавить ингредиент</button>'+
 '<button type="button" class="secondary" id="msIngredientClearSearch">Сбросить поиск</button></div>';
 ingPage.insertBefore(tools,list);
 list.after(form);
 form.hidden=true;
 const formHeader=form.querySelector(':scope > .row.between');
 const closeButton=document.createElement('button');
 closeButton.type='button';closeButton.className='secondary msFormCloseButton';
 closeButton.textContent='✕ Закрыть форму';
 if(formHeader)formHeader.append(closeButton);
 const reveal=(open=true)=>{
  form.hidden=!open;
  el('msAddIngredient').setAttribute('aria-expanded',String(open));
  if(open)requestAnimationFrame(()=>form.scrollIntoView({behavior:'smooth',block:'start'}));
 };
 closeButton.addEventListener('click',()=>{
  if(!el('ingEditStatus').classList.contains('hidden')&&
     !confirm('Закрыть карточку ингредиента без сохранения изменений?'))return;
  window.resetIngredientForm();reveal(false);
 });
 el('msAddIngredient').setAttribute('aria-controls','ingredientFormPanel');
 el('msAddIngredient').setAttribute('aria-expanded','false');
 el('msAddIngredient').addEventListener('click',()=>{
  if(!form.hidden && !el('ingEditStatus').classList.contains('hidden')){
   if(!confirm('Перейти к новому ингредиенту? Несохранённые изменения формы будут потеряны.'))return;
  }
  window.resetIngredientForm();reveal(true);
 });
 el('msIngredientClearSearch').addEventListener('click',()=>{
  el('ingSearch').value='';el('ingCatFilter').value='';
  if(typeof ingredientPage!=='undefined')ingredientPage=1;
  if(typeof window.renderIngredients==='function')window.renderIngredients();
  list.scrollIntoView({behavior:'smooth',block:'start'});
 });
 const baseEdit=window.editIngredient;
 window.editIngredient=function(id){reveal(true);return baseEdit(id)};
 const baseReset=window.resetIngredientForm;
 window.resetIngredientForm=function(){const result=baseReset();reveal(false);return result};
}
const navButtons=[...nav.querySelectorAll('button[data-page]')];
const titleMap={home:'Обзор',ingredients:'Ингредиенты',prefab:'Полуфабрикаты',product:'Товары и меню',editor:'Редактор ТТК'};
const titles=el('pageTitle');
const baseNavigate=window.switchPage;
window.switchPage=function(page){
 const result=baseNavigate(page);
 if(titles&&page!=='prefab')titles.textContent=titleMap[page]||titles.textContent;
 navButtons.forEach(b=>b.setAttribute('aria-current',b.dataset.page===page?'page':'false'));
 return result;
};
document.documentElement.classList.add('msProInterface');
})();