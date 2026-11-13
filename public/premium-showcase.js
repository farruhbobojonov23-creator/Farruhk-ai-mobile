import {showProductPhoto} from '/product-photo.js?v=3';
/* FARRUH AI · premium desktop/mobile layouts.
   Presentation only: existing project, recipe, HACCP, journal and print storage stays untouched. */
const PREMIUM=new Set(['titanium','crystal','royal']);
let svgSerial=0;
const shapes={
 home:'<path d="M10 29 32 10l22 19M16 25v29h13V38h7v16h13V25"/>',
 projects:'<path d="M8 28 32 15l24 13-24 13zM8 38l24 13 24-13M8 47l24 13 24-13" transform="translate(0 -6)"/>',
 ttk:'<path d="M17 15h30a4 4 0 0 1 4 4v36H13V19a4 4 0 0 1 4-4zM25 15v-5h14v5M20 29l4 4 7-8M35 29h9M20 43l4 4 7-8M35 44h9"/>',
 shield:'<path d="M32 7 52 15v14c0 14-9 22-20 27-11-5-20-13-20-27V15zM22 32l7 7 14-16"/>',
 book:'<path d="M6 12c12-3 20-1 26 5 6-6 14-8 26-5v39c-12-3-20-1-26 5-6-6-14-8-26-5zM32 18v37M13 23c5-1 10 0 14 3M37 26c5-3 10-4 15-3"/>',
 box:'<path d="m9 21 23-12 23 12-23 13zM9 21v23l23 13 23-13V21M32 34v23M21 15l23 13"/>',
 printer:'<path d="M17 10h30v17H17zM11 26h42a5 5 0 0 1 5 5v19H47M17 50H6V31a5 5 0 0 1 5-5M17 40h30v18H17zM44 33h4M23 46h18M23 52h14"/>',
 assistant:'<rect x="14" y="14" width="36" height="36" rx="8"/><path d="M14 25H7M14 38H7M50 25h7M50 38h7M25 14V7M38 14V7M25 50v7M38 50v7M25 40l6-17 7 17M27 35h9M43 23v17"/>',
 settings:'<path d="M29 7h6l2 6 6 2 6-3 5 5-3 6 2 6 6 2v7l-6 2-2 6 3 6-5 5-6-3-6 2-2 6h-6l-2-6-6-2-6 3-5-5 3-6-2-6-6-2v-7l6-2 2-6-3-6 5-5 6 3 6-2z"/><circle cx="32" cy="33" r="9"/>',
 tasks:'<rect x="14" y="12" width="36" height="44" rx="6"/><path d="M24 12v-5h15v5M21 30l4 4 6-8M36 30h7M21 43l4 4 6-8M36 43h7"/>',
 analytics:'<path d="M9 55V35h10v20M27 55V22h10v33M45 55V10h10v45M7 56h52"/>',
 kitchen:'<path d="M14 40V24c-9-3-5-18 7-17 6-8 15-8 21 0 12-1 16 14 7 17v16zM14 41h35v14H14zM14 46h35"/>'
};
function icon3d(kind,small=false){
 const i='pf3d-'+(++svgSerial);
 const shape=shapes[kind]||shapes.box;
 return '<svg class="pf-3d-icon'+(small?' pf-3d-small':'')+'" viewBox="0 0 64 64" fill="none" aria-hidden="true"><defs><linearGradient id="'+i+'m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--pf-metal-hi)"/><stop offset=".48" style="stop-color:var(--pf-metal-mid)"/><stop offset="1" style="stop-color:var(--pf-metal-lo)"/></linearGradient><linearGradient id="'+i+'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--pf-glow)"/><stop offset="1" style="stop-color:var(--pf-accent)"/></linearGradient></defs>'+
 '<g transform="translate(1.8 2.4)" stroke="#04090c" opacity=".62" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">'+shape+'</g>'+
 '<g stroke="url(#'+i+'m)" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">'+shape+'</g>'+
 '<g stroke="url(#'+i+'g)" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" transform="translate(-.8 -.9)" opacity=".65">'+shape+'</g></svg>';
}
const shortcuts=[
 {icon:'ttk',label:'ТТК',description:'Технологические карты и рецептуры',route:'recipes'},
 {icon:'shield',label:'ХАССП',description:'Безопасность производства',route:'lab'},
 {icon:'book',label:'Журналы',description:'Учёт, контроль и печать',route:'lab'},
 {icon:'box',label:'Полуфабрикаты',description:'Заготовки и нормы',route:'preparations'},
 {icon:'printer',label:'FARUKH PRINT',description:'Этикетки и маркировка',route:'print-control'},
 {icon:'assistant',label:'Ассистент AI',description:'Рецепты, расчёты и идеи',route:'chat'},
 {icon:'tasks',label:'Задачи',description:'Поручения и контроль',route:'tasks'},
 {icon:'settings',label:'Настройки',description:'Оформление и разделы',route:'site-settings'}
];
function el(name,cls,html){
 const e=document.createElement(name);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e;
}
export function mountPremiumShowcase({shell,goto,openStudio,openProjects}){
 if(!shell||shell.querySelector('.pf-showcase'))return;
 const root=el('div','pf-showcase');
 const aside=el('aside','pf-showcase-side');
 aside.innerHTML='<div class="pf-showcase-side-brand">'+icon3d('kitchen',true)+'<div><strong>FARRUH <em>AI</em></strong><small>PRIVATE KITCHEN INTELLIGENCE</small></div></div><p class="pf-side-caption">РАБОЧИЙ КАБИНЕТ</p><nav class="pf-side-links" aria-label="Разделы кухни"></nav><div class="pf-side-foot"><span class="pf-side-live"></span><div>Кабинет бренд-шефа<small>Мои проекты и документы</small></div></div>';
 const sideNav=aside.querySelector('.pf-side-links');
 const sideActions=[
  ['home','Главная','home'],['projects','Проекты','projects'],
  ['ttk','ТТК','recipes'],['box','Полуфабрикаты','preparations'],
  ['shield','ХАССП','lab'],['book','Журналы','lab'],
  ['printer','FARUKH PRINT','print-control'],['tasks','Задачи','tasks'],
  ['assistant','Ассистент AI','chat'],['analytics','Контроль кухни','checks'],
  ['settings','Настройки','site-settings']
 ];
 for(const [kind,title,route] of sideActions){
  if(['lab','tasks','chat','checks'].includes(route))continue; // Focused workspace: less-used routes remain in Settings/menu.
  const b=el('button','pf-side-link'+(route==='home'?' active':''),icon3d(kind,true)+'<span></span>');
  b.type='button';b.querySelector('span').textContent=title;
  if(route==='projects')b.dataset.pfAction='projects';else b.dataset.pfGo=route;
  sideNav.append(b);
 }
 const main=el('main','pf-showcase-main');
 main.innerHTML=
 '<header class="pf-showcase-top">'+
 '<div class="pf-showcase-logo">'+icon3d('kitchen',true)+'<div><strong>FARRUH <em>AI</em></strong><span>Профессиональный кабинет шефа</span></div></div>'+
 '<div class="pf-showcase-top-actions"><button type="button" data-pf-action="settings" class="pf-showcase-top-button" title="Настройки" aria-label="Настройки">'+icon3d('settings',true)+'</button><button type="button" data-pf-go="tasks" class="pf-showcase-top-button" title="Задачи" aria-label="Задачи">'+icon3d('tasks',true)+'</button></div>'+
 '</header>'+
 '<section class="pf-showcase-banner">'+
 '<div class="pf-banner-copy"><p class="pf-overline">FARRUH AI • КАБИНЕТ ШЕФА</p><h1>Управляй кухней.<br><span>Создавай лучшее.</span></h1><p>Техкарты, полуфабрикаты и маркировка в одной системе.</p><button type="button" class="pf-banner-cta" data-pf-go="recipes">Открыть ТТК <span aria-hidden="true">↗</span></button></div>'+
 '<div class="pf-banner-visual"><div class="pf-banner-aura"></div><img src="/assets/categories/cold.png" alt="" loading="eager" decoding="async"></div>'+
 '</section>'+
 '<div class="pf-showcase-controls">'+
 '<label class="pf-showcase-select">'+icon3d('projects',true)+'<span class="pf-actual-select"><small>Текущий проект</small><select aria-label="Рабочий проект" id="pf-showcase-project-select"></select></span></label>'+
 '<button type="button" class="pf-add-project" data-pf-action="projects">＋ <span>Проекты</span></button>'+
 '<div class="pf-project-disclaimer" title="Список проектов — отдельная навигация по заказчикам">ТТК по проектам · остальные данные общие</div>'+
 '</div>'+
 '<div class="pf-showcase-info"><span>'+icon3d('ttk',true)+' ТТК и рецептуры</span><span>'+icon3d('box',true)+' Заготовки</span><span>'+icon3d('shield',true)+' Безопасность</span><span>'+icon3d('book',true)+' Журналы</span></div>'+
 '<section class="pf-showcase-tools"><div class="pf-showcase-tools-main"><div class="pf-showcase-section"><div><small>РАБОЧЕЕ ПРОСТРАНСТВО</small><h2>Инструменты кухни</h2></div><button type="button" class="pf-showcase-all" data-pf-action="studio">◈ Настроить вид</button></div><div class="pf-showcase-grid"></div></div>'+
 '<aside class="pf-showcase-quick"><h2>✦ Быстрые действия</h2><button type="button" data-pf-action="newrecipe">＋ Создать ТТК <span>↗</span></button><button type="button" data-pf-go="preparations">▣ Заготовки <span>↗</span></button><button type="button" data-pf-go="lab">▤ Заполнить журнал <span>↗</span></button><button type="button" data-pf-go="tasks">☑ Открыть задачи <span>↗</span></button><button type="button" data-pf-go="chat">✦ ИИ-помощник <span>↗</span></button><p>Все документы и функции сохранены в действующей системе.</p></aside></section>'+
 '<div class="pf-showcase-banner-bottom"><span>FARRUH <b>AI</b></span> · Профессиональная кухня начинается с порядка</div>'+
 '<nav class="pf-showcase-bottom" aria-label="Быстрый переход"><button class="active" data-pf-go="home">'+icon3d('home',true)+'<span>Главная</span></button><button data-pf-action="projects">'+icon3d('projects',true)+'<span>Проекты</span></button><button data-pf-go="recipes">'+icon3d('ttk',true)+'<span>ТТК</span></button><button data-pf-go="print-control">'+icon3d('printer',true)+'<span>Печать</span></button><button data-pf-action="more">'+icon3d('settings',true)+'<span>Ещё</span></button></nav>';
 // Remove quick-entry buttons and informational chips for hidden modules.
 main.querySelectorAll('[data-pf-go="lab"],[data-pf-go="tasks"]').forEach(node=>node.remove());
 const info=main.querySelector('.pf-showcase-info');
 if(info){while(info.children.length>2)info.lastElementChild.remove();info.append(el('span','',icon3d('printer',true)+' Маркировка'))}
 main.querySelector('.pf-showcase-all')?.remove();
 main.querySelector('.pf-showcase-quick [data-pf-go="chat"]')?.remove();
 const grid=main.querySelector('.pf-showcase-grid');
 for(const item of shortcuts){
  if(['lab','tasks','chat'].includes(item.route))continue;
  const b=el('button','pf-showcase-card',icon3d(item.icon)+'<span class="pf-card-title"></span><span class="pf-card-desc"></span><span class="pf-card-arrow" aria-hidden="true">↗</span>');
  b.type='button';b.dataset.pfGo=item.route;
  b.querySelector('.pf-card-title').textContent=item.label;b.querySelector('.pf-card-desc').textContent=item.description;
  grid.append(b);
 }
 const select=main.querySelector('#pf-showcase-project-select');
 function syncProjects(){
  const original=document.getElementById('pf-home-project-select');if(!original)return;
  const before=select.value;select.replaceChildren();
  for(const option of original.options)select.add(new Option(option.text.replace(/^Проект:\s*/,'') ,option.value));
  select.value=original.value||before;
 }
 select.addEventListener('change',()=>{
  const original=document.getElementById('pf-home-project-select');if(!original)return;
  original.value=select.value;original.dispatchEvent(new Event('change',{bubbles:true}));
 });
 document.addEventListener('pf:projects',syncProjects);
 root.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  // Buttons also live inside the legacy #pf-workspace click listener.
  // Stop bubbling so each action runs once (especially navigation with dirty TTK).
  event.stopPropagation();
  if(target.dataset.pfGo)goto(target.dataset.pfGo);
  if(target.dataset.pfAction==='settings')document.getElementById('menu-settings')?.click();
  if(target.dataset.pfAction==='newrecipe'){
   goto('recipes');
   // Real action: open the recipe editor, not just the recipe list.
   requestAnimationFrame(()=>document.getElementById('newrecipe')?.click());
  }
  if(target.dataset.pfAction==='projects')openProjects();
  if(target.dataset.pfAction==='more')document.getElementById('menu-toggle')?.click();
 });
 root.append(aside,main);shell.prepend(root);syncProjects();
 const heroPhoto=root.querySelector('.pf-banner-visual img');
 if(heroPhoto)showProductPhoto(heroPhoto,'/assets/categories/cold.png');
}
