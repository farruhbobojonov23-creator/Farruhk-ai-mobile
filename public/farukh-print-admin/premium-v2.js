/* Farukh Print Admin Premium V2 — preview-only navigation + honest demo dashboard.
 * All existing owner modules remain mounted and unmodified. No production calls.
 */
const SYMBOLS={
 home:'<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 box:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>',
 team:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>',
 cloud:'<path d="M7 19H6a4 4 0 0 1-.6-8A7 7 0 0 1 19 12a3.5 3.5 0 0 1-.5 7H17M12 12v10m0-10-3.5 3.5M12 12l3.5 3.5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M4.5 9.5 3 12l1.5 2.5 2.4.4.8 2.2-1.3 2.1 2.8 1.5 2-1.4 2.2.3 1.2 2.2 3-1.1.1-2.5 1.7-1.5 2.4.2L23 14l-1.5-2.4-2.4-.4-.8-2.2 1.3-2.1-2.8-1.5-2 1.4-2.2-.3L11.4 4l-3 1.1-.1 2.5-1.7 1.5z"/>',
 printer:'<path d="M6 8V3h12v5M6 19H4a2 2 0 0 1-2-2v-7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2h-2M6 15h12v7H6zM17 11h2"/>',
 label:'<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 8h10M7 12v6m3-6v6m3-6v6m3-6v6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 chart:'<path d="M3 3v18h18M7 16v-4m5 4V7m5 9V4"/>',
 arrow:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
 bolt:'<path d="m13 2-9 11h7l-1 9 10-12h-8z"/>',
 shield:'<path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6zM8 12l3 3 5-6"/>'
};
const icon=(name,cls='')=>'<svg class="'+cls+'" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+SYMBOLS[name]+'</svg>';
const NAV=[
 ['home','Главная','home'],
 ['catalog','Товары','box'],
 ['staff','Сотрудники','team'],
 ['cloud','Облако','cloud'],
 ['backup','Настройки','settings']
];
const make=(tag,cl)=>{const n=document.createElement(tag);if(cl)n.className=cl;return n};
function productCount(){
 try{
  const value=JSON.parse(localStorage.getItem('farukh-print:catalog:v1')||'[]');
  return Array.isArray(value)?value.filter(x=>x&&['ready','prep'].includes(x.kind)).length:0;
 }catch{return 0}
}
function productTitles(){
 try{
  const value=JSON.parse(localStorage.getItem('farukh-print:catalog:v1')||'[]');
  return Array.isArray(value)?value.filter(x=>x?.name).slice(0,3).map(x=>String(x.name)): [];
 }catch{return []}
}
export function mountPremiumV2({root,main}){
 if(!root||!main)throw Error('Не найден контейнер Farukh Print Admin');
 const nav=make('nav','v2-nav');
 nav.setAttribute('aria-label','Навигация Farukh Print Admin');
 nav.setAttribute('data-premium-v2','true');
 nav.innerHTML='<span class="v2-nav-label">ПАНЕЛЬ УПРАВЛЕНИЯ</span>';
 const navButtons=new Map();
 for(const [key,label,symbol] of NAV){
  const b=make('button','v2-nav-btn');
  b.type='button';b.dataset.v2Page=key;b.setAttribute('aria-current','false');
  b.innerHTML=icon(symbol)+'<span>'+label+'</span>';
  b.addEventListener('click',()=>go(key));
  nav.append(b);navButtons.set(key,b);
 }
 main.parentNode.insertBefore(nav,main);
 const dashboard=make('section','v2-dashboard');
 dashboard.id='v2-dashboard';dashboard.setAttribute('aria-label','Главная панель Farukh Print Admin');
 dashboard.innerHTML=[
 '<div class="v2-hero">',
 ' <div class="v2-hero-copy"><span class="v2-kicker">FARUKH PRINT ADMIN · PREMIUM V2</span>',
 ' <h1>Добро пожаловать,<br>администратор!</h1>',
 ' <p>Товары, этикетки, сотрудники и принтеры — единый управляющий центр.</p>',
 ' <span class="v2-hero-tag">✦ Демонстрационная версия · независима от Farukh AI</span></div>',
 ' <div class="v2-hero-art" aria-hidden="true">',
 '  <div class="v2-glow-ring"></div><div class="v2-printer">',
 '  <div class="v2-printer-top"></div><div class="v2-printer-body"><span class="v2-printer-light"></span></div>',
 '  <div class="v2-printer-paper"><b>FARUKH PRINT</b><i></i><i></i><i></i><small>58 × 40 мм</small></div>',
 '  </div></div>',
 '</div>',
 '<div class="v2-section-title"><h2>Обзор системы</h2><span class="v2-micro-tag">Предпросмотр · демо</span></div>',
 '<div class="v2-kpi-grid">',
 ' <div class="v2-kpi"><span class="v2-kpi-icon">'+icon('printer')+'</span><small>Печать сегодня</small><strong>—</strong><em>Статистика не подключена</em></div>',
 ' <div class="v2-kpi"><span class="v2-kpi-icon">'+icon('box')+'</span><small>Товаров в демокаталоге</small><strong id="v2-product-count">2</strong><em>Только на этом устройстве</em></div>',
 ' <div class="v2-kpi"><span class="v2-kpi-icon">'+icon('team')+'</span><small>Сотрудников</small><strong>0</strong><em>Демо · нет реальных данных</em></div>',
 ' <div class="v2-kpi"><span class="v2-kpi-icon">'+icon('label')+'</span><small>Этикеток напечатано</small><strong>—</strong><em>Учёт печати не подключён</em></div>',
 '</div>',
 '<div class="v2-overview-grid">',
 ' <div class="v2-surface v2-sync-card"><div class="v2-card-heading">'+icon('cloud')+'<span>Синхронизация</span></div>',
 ' <span class="v2-state v2-state-off">○ Не подключена</span>',
 ' <p>Каталог сотрудников и рабочее облако отключены в демонстрационной версии.</p>',
 ' <button type="button" class="v2-soft-link" data-v2-action="cloud">Посмотреть раздел '+icon('arrow')+'</button></div>',
 ' <div class="v2-surface v2-chart-card"><div class="v2-card-heading">'+icon('chart')+'<span>Динамика печати · 7 дней</span></div>',
 ' <div class="v2-chart-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
 ' <div class="v2-chart-days"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>',
 ' <p>Нет данных. График появится после подключения реального журнала печати.</p></div>',
 '</div>',
 '<div class="v2-section-title"><h2>'+icon('bolt')+' Быстрые действия</h2></div>',
 '<div class="v2-actions-grid">',
 ' <button type="button" class="v2-action" data-v2-action="add"><span>'+icon('plus')+'</span><strong>Добавить товар</strong><small>Демонстрационный каталог</small></button>',
 ' <button type="button" class="v2-action" data-v2-action="ready"><span>'+icon('label')+'</span><strong>Редактор этикеток</strong><small>Формат 58 × 40 мм</small></button>',
 ' <button type="button" class="v2-action" data-v2-action="cloud"><span>'+icon('printer')+'</span><strong>Управление принтерами</strong><small>Проверить подключение</small></button>',
 '</div>',
 '<div class="v2-section-title"><h2>Редакторы этикеток</h2><span class="v2-micro-tag">2 формата</span></div>',
 '<div class="v2-label-grid">',
 ' <button type="button" class="v2-label-card v2-label-ready" data-v2-action="ready"><span class="v2-label-symbol">'+icon('label')+'</span><b>Этикетка<br>58 × 40 мм</b><small>Для готовой продукции</small><span class="v2-label-cta">Открыть редактор '+icon('arrow')+'</span></button>',
 ' <button type="button" class="v2-label-card v2-label-prep" data-v2-action="prep"><span class="v2-label-symbol">'+icon('label')+'</span><b>Этикетка<br>30 × 20 мм</b><small>Для полуфабрикатов</small><span class="v2-label-cta">Открыть редактор '+icon('arrow')+'</span></button>',
 '</div>',
 '<div class="v2-bottom-grid">',
 ' <div class="v2-surface"><div class="v2-card-heading">'+icon('printer')+'<span>Подключённые принтеры</span></div>',
 ' <div class="v2-empty-row"><span class="v2-empty-icon">'+icon('shield')+'</span><div><strong>0 устройств</strong><small>В демоверсии соединение не настроено</small></div></div>',
 ' <button type="button" class="v2-soft-link" data-v2-action="cloud">Облачное управление '+icon('arrow')+'</button></div>',
 ' <div class="v2-surface"><div class="v2-card-heading">'+icon('box')+'<span>Товары</span></div>',
 ' <div id="v2-product-list" class="v2-product-list" aria-live="polite"></div>',
 ' <button type="button" class="v2-soft-link" data-v2-action="catalog">Открыть каталог '+icon('arrow')+'</button></div>',
 '</div>',
 '<footer class="v2-footer">FARUKH PRINT · ADMIN <span>Premium V2 · интерфейс предпросмотра</span></footer>'
 ].join('');
 main.insertBefore(dashboard,root);
 function refresh(){
  const count=dashboard.querySelector('#v2-product-count');
  if(count)count.textContent=String(productCount());
  const list=dashboard.querySelector('#v2-product-list');
  if(list){
   list.replaceChildren();
   const products=productTitles();
   if(!products.length){const row=make('p','v2-empty-copy');row.textContent='Демо-каталог пуст';list.append(row);}
   else for(const name of products){
    const row=make('div','v2-product-row');
    const thumb=make('span','v2-product-thumb');thumb.innerHTML=icon('box');
    const title=make('span');title.textContent=name;
    const sub=make('small');sub.textContent='Локальный демотовар';
    const detail=make('div');detail.append(title,sub);row.append(thumb,detail);list.append(row);
   }
  }
 }
 let current='home';
 function go(page,opts={}){
  if(!NAV.some(x=>x[0]===page))page='home';
  const target=page==='home'?null:root.querySelector('.pc-workspace-tab[data-workspace="'+page+'"]');
  if(page!=='home'&&!target)return;
  if(target)target.click();
  current=page;document.body.dataset.adminPage=page;
  for(const [key,button] of navButtons){const chosen=key===page;button.classList.toggle('active',chosen);button.setAttribute('aria-current',chosen?'page':'false');}
  if(page==='home')refresh();
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(!opts.noScroll)nav.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
 }
 dashboard.addEventListener('click',event=>{
  const action=event.target.closest('[data-v2-action]')?.dataset.v2Action;
  if(!action)return;
  if(['catalog','staff','cloud','backup'].includes(action)){go(action);return;}
  if(action==='add'){go('catalog');root.querySelector('.pc-toolbar-actions .pc-primary')?.click();return;}
  if(action==='ready'||action==='prep'){
   go('catalog');
   const selector=action==='ready'?'.pc-premium-template:not(.pc-prep-template) .pc-premium-template-button':'.pc-prep-template .pc-premium-template-button';
   root.querySelector(selector)?.click();
  }
 });
 window.addEventListener('storage',event=>{if(event.key==='farukh-print:catalog:v1')refresh()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current==='home')refresh()});
 go('home',{noScroll:true});
 return {navigate:go,refresh};
}
