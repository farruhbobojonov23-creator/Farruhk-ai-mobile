/* FARRUH AI Premium V2 — rebuilt dashboard in the approved composition.
   Navigation uses existing callbacks. KPI and recent recipe values come exclusively
   from the real on-device store. No synthetic connection, counts, projects or recipes. */
import {DeviceStore} from '/device-store.js?v=72';
const ICONS={
chef:'<path d="M7 21V12C1 8 6 2 12 6c5-5 13 0 12 6v9M7 21h17M7 26h17"/>',
home:'<path d="m3 14 13-11 13 11M7 12v17h18V12M13 29V18h6v11"/>',
projects:'<rect x="5" y="5" width="23" height="25" rx="4"/><path d="M10 11h13M10 17h13M10 23h9"/>',
ttk:'<path d="M5 5c6-2 9-1 11 2 3-3 7-4 12-2v23c-6-2-9-1-12 2-3-3-6-4-11-2zM16 7v22M9 12h4M20 12h4"/>',
box:'<path d="m3 10 13-7 13 7-13 8zM3 10v14l13 7 13-7V10M16 18v13"/>',
ingredient:'<path d="M27 5C13 3 5 14 6 27c13 1 23-8 21-22zM6 27 25 8"/>',
printer:'<path d="M7 11V4h18v7M7 26H4V13h24v13h-3M7 21h18v9H7zM23 17h1"/>',
settings:'<circle cx="16" cy="16" r="5"/><path d="M12 2h8l1 5 4 2 4-2 3 6-4 3v4l4 3-3 6-4-2-4 2-1 4h-8l-1-4-4-2-4 2-3-6 4-3v-4l-4-3 3-6 4 2 4-2z"/>',
calc:'<rect x="7" y="3" width="18" height="27" rx="3"/><path d="M11 9h10M11 15h2M18 15h3M11 21h2M18 21h3"/>',
assistant:'<rect x="7" y="6" width="18" height="21" rx="5"/><path d="M11 3v3M21 3v3M3 12h4M25 12h4M12 15v5m8-5v5M12 24h8"/>',
search:'<circle cx="13" cy="13" r="9"/><path d="m20 20 9 9"/>',
plus:'<circle cx="16" cy="16" r="13"/><path d="M16 8v16M8 16h16"/>',
check:'<circle cx="16" cy="16" r="13"/><path d="m9 16 5 5 9-11"/>',
clock:'<circle cx="16" cy="16" r="13"/><path d="M16 8v9l6 4"/>',
chart:'<path d="M5 29V19h5v10M14 29V12h5v17M23 29V5h5v24M3 29h27"/>',
layers:'<path d="m3 11 13-8 13 8-13 8zM3 17l13 8 13-8M3 23l13 8 13-8"/>',
arrow:'<path d="M5 16h22M19 8l8 8-8 8"/>',
menu:'<path d="M4 9h24M4 16h24M4 23h24"/>'
};
function icon(k){return '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[k]||ICONS.box)+'</svg>'}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function button(text,cls,fn){const b=el('button',cls,text);b.type='button';if(fn)b.addEventListener('click',fn);return b}
function projects(){try{const d=JSON.parse(localStorage.getItem('farruh-ai-project-catalog-v1')||'{}');return Array.isArray(d.projects)?d.projects.filter(x=>x&&typeof x.name==='string'&&x.name.trim()).slice(0,12):[]}catch{return []}}
function short(name){return String(name||'').trim().split(/\s+/).slice(0,2).map(s=>s.charAt(0).toUpperCase()).join('')||'A'}
function setCount(node,n){node.textContent=Number.isFinite(n)?new Intl.NumberFormat('ru-RU').format(n):'—'}
export function mountPremiumRoyalV2({shell,goto,openStudio,openProjects}){
 if(!shell||shell.querySelector('.pfv-showcase'))return;
 if(!document.querySelector('link[data-pfv]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/premium-v2.css?v=1';link.dataset.pfv='true';document.head.append(link)}
 const root=el('div','pfv-showcase');
 const side=el('aside','pfv-side');
 const brand=el('div','pfv-brand');
 brand.innerHTML='<span class="pfv-brand-icon">'+icon('chef')+'</span><span><strong>Farukh <em>AI</em></strong><small>ПРОФЕССИОНАЛЬНАЯ СИСТЕМА</small></span>';
 side.append(brand,el('div','pfv-premium','♛  PREMIUM'));
 const nav=el('nav');nav.setAttribute('aria-label','Разделы');
 const navigation=[
  ['home','Главная','home'],['projects','Проекты','projects'],['ttk','ТТК','recipes'],
  ['ingredient','Ингредиенты','preparations'],['layers','Полуфабрикаты','preparations'],
  ['printer','FARUKH PRINT','print-control'],['calc','Калькулятор','calc'],
  ['assistant','Ассистент','chat'],['settings','Настройки','site-settings']
 ];
 for(const [symbol,label,route] of navigation){const b=button(label,'pfv-nav'+(route==='home'?' active':''));b.insertAdjacentHTML('afterbegin',icon(symbol));b.addEventListener('click',()=>route==='projects'?openProjects():goto(route));nav.append(b)}
 side.append(nav);
 const foot=el('div','pfv-side-footer');foot.innerHTML='<span class="pfv-avatar">FA</span><span><strong>Chef Aka</strong><small>Личный кабинет шефа</small></span>';side.append(foot);
 const content=el('main','pfv-content');
 const header=el('header','pfv-header');const search=el('label','pfv-search');search.innerHTML=icon('search');const searchInput=el('input');searchInput.type='search';searchInput.placeholder='Поиск по ТТК, ингредиентам, проектам…';searchInput.setAttribute('aria-label','Поиск по ТТК');search.append(searchInput);searchInput.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();goto('recipes');requestAnimationFrame(()=>{const i=document.getElementById('recipe-search');if(i){i.value=searchInput.value;i.dispatchEvent(new Event('input',{bubbles:true}));i.focus()}})});header.append(search);
 const headerActions=el('div','pfv-header-actions');const settingButton=button('','pfv-icon-btn',()=>goto('site-settings'));settingButton.innerHTML=icon('settings');settingButton.setAttribute('aria-label','Настройки');const personButton=button('','pfv-icon-btn',()=>openProjects());personButton.innerHTML=icon('projects');personButton.setAttribute('aria-label','Мои проекты');headerActions.append(settingButton,personButton);header.append(headerActions);content.append(header);
 const intro=el('section','pfv-intro');intro.innerHTML='<div class="pfv-intro-copy"><h1>Добро пожаловать, Фаррух Ака! 👋</h1><p>Единая платформа для разработки ТТК, полуфабрикатов, меню и управления проектами</p></div><div class="pfv-script" aria-hidden="true">Chef Aka</div>';content.append(intro);
 const kpis=el('div','pfv-kpis');const kpiItems=[
  ['ttk','ТТК','—','в базе'],['box','Ингредиенты','—','уникальных'],['layers','Полуфабрикаты','—','в базе'],['projects','Проекты','—','в списке']];
 const kpiNodes=[];
 for(const [symbol,label,num,unit] of kpiItems){const card=el('div','pfv-kpi');card.innerHTML='<span class="pfv-kpi-ico">'+icon(symbol)+'</span><span><span class="pfv-kpi-label"></span><strong>—</strong><small></small></span>';card.querySelector('.pfv-kpi-label').textContent=label;card.querySelector('small').textContent=unit;kpis.append(card);kpiNodes.push(card.querySelector('strong'))}content.append(kpis);
 const section=(label,symbol)=>{const s=el('section','pfv-section');const h=el('div','pfv-section-title');h.innerHTML='<h2>'+icon(symbol)+'</h2>';h.querySelector('h2').append(document.createTextNode(label));s.append(h);return {section:s,header:h}};
 const projectBlock=section('Мои проекты','layers');const allProj=button('Все проекты →','pfv-section-link',openProjects);projectBlock.header.append(allProj);const projGrid=el('div','pfv-projects');projectBlock.section.append(projGrid);content.append(projectBlock.section);
 function drawProjects(){projGrid.replaceChildren();const ps=projects();setCount(kpiNodes[3],ps.length);if(!ps.length){projGrid.append(el('p','pfv-muted','Список проектов пока пуст. Создай первый проект.'));return}for(const p of ps.slice(0,3)){const card=button('','pfv-project',openProjects);const mark=el('span','pfv-project-mark',short(p.name));const info=el('span','pfv-project-info');info.append(el('strong','',p.name),el('small','','Открыть настройки проекта'));card.append(mark,info);projGrid.append(card)}}
 drawProjects();document.addEventListener('pf:projects',drawProjects);
 const actionBlock=section('Быстрые действия','plus'),actions=el('div','pfv-actions');
 const acts=[['plus','Создать ТТК',()=>{goto('recipes');requestAnimationFrame(()=>document.getElementById('newrecipe')?.click())}],['ttk','Все ТТК',()=>goto('recipes')],['layers','Добавить ПФ',()=>goto('preparations')],['box','Ингредиенты',()=>goto('preparations')],['calc','Калькулятор',()=>goto('calc')],['printer','Печать',()=>goto('print-control')]];
 for(const [symbol,label,action] of acts){const b=button('','pfv-action',action);b.innerHTML=icon(symbol);b.append(el('span','',label));actions.append(b)}
 actionBlock.section.append(actions);content.append(actionBlock.section);
 const lower=el('div','pfv-bottom-grid');const recent=section('Последние ТТК','ttk');recent.header.append(button('Все ТТК →','pfv-section-link',()=>goto('recipes')));const recentRows=el('div');recent.section.append(recentRows);const status=section('Состояние системы','shield');const statusRows=el('div','pfv-status');status.section.append(statusRows);lower.append(recent.section,status.section);content.append(lower);
 function addStatus(label,ok=false){const r=el('div','pfv-status-item'+(ok?' ok':''));r.innerHTML=icon(ok?'check':'clock');r.append(el('span','',label));statusRows.append(r)}
 addStatus('Проверка локальных данных…');addStatus('Google: состояние подключения здесь не проверено');addStatus('Резервное копирование: статус необходимо проверить в настройках');
 const mobile=el('nav','pfv-phone-nav');mobile.setAttribute('aria-label','Быстрые переходы');for(const [sym,txt,route] of [['home','Главная','home'],['projects','Проекты','projects'],['ttk','ТТК','recipes'],['printer','Печать','print-control'],['menu','Ещё','site-settings']]){const b=button('', '',()=>route==='projects'?openProjects():goto(route));b.innerHTML=icon(sym);b.append(el('span','',txt));mobile.append(b)}content.append(mobile);
 root.addEventListener('click',event=>{if(event.target.closest('button'))event.stopPropagation()});
 root.append(side,content);shell.prepend(root);
 let dataLoaded=false;
 const readDashboardData=async()=>{if(dataLoaded||document.body.dataset.pfTheme!=='royal')return;dataLoaded=true;try{const state=await new DeviceStore().load();if(!root.isConnected)return;const recipes=Array.isArray(state?.recipes)?state.recipes:[];const prep=Array.isArray(state?.preparations)?state.preparations:[];const ingredientSet=new Set();for(const r of recipes)for(const i of r?.ingredients||[]){const name=String(i?.name||'').trim().toLocaleLowerCase('ru-RU');if(name)ingredientSet.add(name)}
 setCount(kpiNodes[0],recipes.length);setCount(kpiNodes[1],ingredientSet.size);setCount(kpiNodes[2],prep.length);
 recentRows.replaceChildren();const latest=recipes.filter(r=>r&&r.name&&!r.archived).slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,4);
 if(!latest.length)recentRows.append(el('p','pfv-muted','На этом устройстве пока нет сохранённых ТТК.'));
 for(const r of latest){const row=el('div','pfv-recipe');row.append(el('span','pfv-recipe-icon',short(r.name)));const info=el('div','pfv-recipe-text');info.append(el('strong','',r.name),el('small','',r.cardNumber?'ТТК №'+r.cardNumber:r.category||'Техкарта'));row.append(info);row.append(el('span','pfv-recipe-status'+(r.status==='ready'?'':' draft'),r.status==='ready'?'Готова':'Черновик'));recentRows.append(row)}
 statusRows.replaceChildren();addStatus('Локальное хранилище доступно',true);addStatus('Google: состояние подключения здесь не проверено');addStatus('Резервное копирование: статус в настройках');
 }catch(e){statusRows.replaceChildren();addStatus('Не удалось прочитать локальные данные');addStatus('Проверь сохранённые ТТК в разделе «ТТК»');recentRows.replaceChildren();recentRows.append(el('p','pfv-muted','Данные пока не загружены.'))}};
 new MutationObserver(()=>{if(document.body.dataset.pfTheme==='royal')void readDashboardData()}).observe(document.body,{attributes:true,attributeFilter:['data-pf-theme']});
 void readDashboardData();
}
