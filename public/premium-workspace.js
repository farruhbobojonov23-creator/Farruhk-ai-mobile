/* FARRUH AI Design Studio · non-destructive interface layer.
   Recipe/HACCP/label stores and printed A4 documents are deliberately untouched. */
import {mountPremiumShowcase} from '/premium-showcase.js?v=7';
import {mountPremiumRoyalV2} from '/premium-royal-v2.js?v=1';
const DESIGN_KEY='farruh-ai-appearance-v1';
const PROJECT_KEY='farruh-ai-project-catalog-v1';
const defaults={theme:'crystal',accent:'',radius:20,density:'standard',scale:1,motion:true};
const themeNames={titanium:'Black Ice Titanium',crystal:'Arctic Crystal PRO',royal:'Royal Gold 3D',arctic:'Arctic Sapphire',ice:'Black Ice',white:'Minimal White',gold:'Executive Gold',burgundy:'Burgundy PRO'};
const themeColors={titanium:['#52caff','#07121c'],crystal:['#1379ce','#e3f3ff'],royal:['#e2b05b','#090909'],arctic:['#087bba','#e8f4ff'],ice:['#35c9ec','#08101d'],white:['#336fc4','#ffffff'],gold:['#d6ae64','#17191e'],burgundy:['#f1739d','#280f1d']};
const deepCopy=o=>JSON.parse(JSON.stringify(o));
function getJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function setJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function validDesign(raw){const c={...defaults,...(raw&&typeof raw==='object'?raw:{})};if(!themeNames[c.theme])c.theme='titanium';if(!/^#[0-9a-f]{6}$/i.test(c.accent||''))c.accent='';c.radius=Math.min(30,Math.max(8,Number(c.radius)||20));if(!['compact','standard','spacious'].includes(c.density))c.density='standard';c.scale=[.9,1,1.1,1.2].includes(Number(c.scale))?Number(c.scale):1;c.motion=c.motion!==false;return c}
function validProjects(raw){const projects=Array.isArray(raw?.projects)?raw.projects.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').map(p=>({id:p.id.slice(0,70),name:p.name.trim().slice(0,60)})).filter(p=>p.name):[];if(!projects.length)projects.push({id:'more-sushi',name:'Море Суши'},{id:'sushi-beri',name:'Суши Бери'});const selected=projects.some(p=>p.id===raw?.selected)?raw.selected:projects[0].id;return {projects,selected}}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function button(text,cls,fn){const b=node('button',cls,text);b.type='button';b.addEventListener('click',fn);return b}
function icon(key){
 const path={ttk:'M7 3h8l4 4v14H7z M15 3v5h5 M10 12h6 M10 16h6',shield:'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z M8 12l3 3 5-6',book:'M4 5c3-1 5 0 8 2 3-2 5-3 8-2v15c-4-1-6 0-8 2-2-2-5-3-8-2z M12 7v15',box:'M3 7l9-4 9 4-9 5z M3 7v10l9 4 9-4V7 M12 12v9',printer:'M6 9V3h12v6M6 18H4V10h16v8h-2 M6 15h12v7H6z',chef:'M6 12C1 10 3 3 8 4c2-3 6-3 8 0 5-1 7 6 2 8v8H6z M6 16h12',home:'M3 11L12 3l9 8M6 9v12h5v-7h3v7h5V9',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2m10-10 2-2'}[key];
 return '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
}
export function mountPremiumWorkspace(){
 let config=validDesign(getJson(DESIGN_KEY,defaults)),draft=null;
 // One-time opt-in from the owner: the approved Premium PRO (light sapphire)
 // replaces the previous default dark Titanium on existing devices.
 // Keep the previous preference structure and respect subsequent Studio changes.
 const PREMIUM_V3_KEY='farruh-ai-approved-black-gold-v1';
 if(location.hostname.startsWith('farukh-ai-premium-preview-')&&!getJson(PREMIUM_V3_KEY,false)){
  config={...config,theme:'royal',accent:''};
  setJson(DESIGN_KEY,config);
  setJson(PREMIUM_V3_KEY,true);
 }
 let projects=validProjects(getJson(PROJECT_KEY,null));
 let editingProjects=false;
 const home=document.getElementById('home'),nav=document.querySelector('#chef-menu .nav');
 if(!home||!nav)return;
 const studio=document.createElement('dialog');studio.className='pf-modal';studio.id='pf-studio-dialog';studio.setAttribute('aria-label','FARRUH AI Design Studio');document.body.append(studio);
 const projectModal=document.createElement('dialog');projectModal.className='pf-modal';projectModal.id='pf-project-dialog';projectModal.setAttribute('aria-label','Мои проекты');document.body.append(projectModal);
 function applyDesign(value){
  const c=validDesign(value);document.body.dataset.pfTheme=c.theme;document.body.dataset.pfDensity=c.density;document.body.dataset.pfMotion=c.motion?'on':'off';
  document.body.style.setProperty('--pf-radius',c.radius+'px');
  document.body.style.setProperty('--pf-scale',String(c.scale));
  if(c.accent)document.body.style.setProperty('--pf-accent',c.accent);else document.body.style.removeProperty('--pf-accent');
  // Restore the original five home layouts when one is selected in Studio.
  // Previously the legacy shell was unconditionally hidden at mount, leaving
  // Classic, Arctic, White, Gold and Burgundy themes without a usable home.
  const premium=['titanium','crystal','royal'].includes(c.theme);
  home.classList.toggle('pf-upgraded',premium);
  const legacy=home.querySelector(':scope > .arctic-shell');
  if(legacy){if(premium)legacy.style.setProperty('display','none','important');else legacy.style.removeProperty('display')}
  const workspace=home.querySelector('#pf-workspace');
  if(workspace)workspace.style.setProperty('display',premium?'flex':'none','important');
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=['titanium','royal','ice','gold','burgundy'].includes(c.theme)?themeColors[c.theme][1]:c.theme==='white'?'#f5f6f8':'#e8f4ff';
 }
 function goto(view){
  const target=nav.querySelector('button[data-view="'+view+'"]');
  if(target){target.click();return}
  location.hash=view;
 }
 function addSidebar(){
  const settings=document.getElementById('menu-settings');
  const projectButton=button('▱  Проекты','pf-sidebar-project',openProjects);
  // Keep the main menu short: Design Studio and infrequently used tools live
  // inside the existing "Настройки и данные" dialog, never in a second menu.
  nav.insertBefore(projectButton,settings);
  nav.querySelectorAll('.pf-sidebar-design,.pf-sidebar-more').forEach(el=>el.remove());
  // Label workflows remain accessible in FARUKH PRINT and in settings.
  nav.querySelectorAll('a[href="/marking.html"],a[href="/finished-labels.html"]').forEach(el=>el.remove());
  // Calculator and point control are utilities, not a top-level workspace.
  nav.querySelectorAll('button[data-view="calc"],button[data-view="checks"]').forEach(el=>el.remove());
 }
 function attachSettingsHub(){
  // The main Settings screen (site-settings), not the Voice/Data modal,
  // is the canonical home for styling and infrequently used utilities.
  const target=document.getElementById('site-settings');
  if(!target||target.hidden||target.querySelector('#pf-settings-hub'))return;
  const hub=node('section','pf-settings-hub');hub.id='pf-settings-hub';
  const title=node('h3','pf-settings-hub-title','Оформление FARRUH AI');
  const caption=node('p','pf-settings-hub-caption','Темы, кнопки и размер элементов.');
  const design=button('🎨  Дизайн и стиль','pf-settings-design-button',openStudio);
  design.id='pf-settings-design-button';
  hub.append(title,caption,design);
  const utilities=node('details','pf-settings-utilities');utilities.id='pf-settings-utilities';
  const summary=node('summary','','Редко используемые функции');
  const list=node('div','pf-settings-utilities-list');
  const openView=(name,view)=>button(name,'pf-settings-utility-button',()=>goto(view));
  list.append(openView('Калькулятор','calc'),openView('Контроль точек','checks'));
  for(const [name,href] of [
    ['Этикетки ПФ · 30 × 20','/marking.html'],
    ['Готовая продукция · 58 × 40','/finished-labels.html']
  ]){
    const a=node('a','pf-settings-utility-button',name);a.href=href;list.append(a);
  }
  utilities.append(summary,list);hub.append(utilities);
  // Place above the editable content of Settings; reattach after rerenders.
  const after=target.querySelector(':scope > .settings-actions');
  if(after)after.after(hub);else target.querySelector('h1')?.after(hub);
 }
 const tiles=[['ttk','ТТК','Технологические карты и расчёты','recipes'],['box','Полуфабрикаты','Ингредиенты и заготовки','preparations'],['printer','FARUKH PRINT','Этикетки и маркировка','print-control'],['settings','Настройки','Оформление и инструменты','site-settings']];
 const shell=node('div','pf-workspace');shell.id='pf-workspace';
 shell.innerHTML=
  '<div class="pf-top"><div><div class="pf-brand">FARRUH <span>AI</span></div><div class="pf-caption">Профессиональный кабинет шефа</div></div><div class="pf-top-actions"><button class="pf-icon-btn" data-pf-action="settings" aria-label="Настройки" title="Настройки">◈</button><button class="pf-icon-btn" data-pf-go="tasks" aria-label="Открыть задачи" title="Задачи">♧</button></div></div>'+
  '<section class="pf-hero"><div class="pf-hero-kicker">PRIVATE KITCHEN WORKSPACE</div><h1>Управляй кухней.<br>Создавай лучшее.</h1><p>Техкарты, полуфабрикаты и маркировка в одном кабинете.</p><div class="pf-project-row"><label class="pf-project-picker"><span aria-hidden="true">▱</span><select id="pf-home-project-select" aria-label="Выбрать рабочий проект"></select></label><button class="pf-icon-btn" data-pf-action="projects" aria-label="Управление проектами" title="Проекты">＋</button><div class="pf-project-note">Выбирай заказчика или рабочий проект. Сохраняй документы в нужной категории.</div></div></section>'+
  '<div class="pf-dashboard-label"><strong>Рабочие инструменты</strong><small>Выбери раздел</small></div>'+
  '<div class="pf-tiles" id="pf-home-tiles"></div>'+
  '<button class="pf-ai-button" data-pf-go="chat"><span class="pf-ai-icon" aria-hidden="true">✦</span><span style="flex:1"><strong>ИИ-помощник</strong><small>Рабочие вопросы, задачи и идеи</small></span><span aria-hidden="true">›</span></button>'+
  '<div class="pf-actions"><button data-pf-action="projects"><span>▱</span>Проекты</button><button data-pf-go="tasks"><span>☑</span>Задачи</button><button data-pf-go="calc"><span>▦</span>Калькулятор</button><button data-pf-action="studio"><span>⚙</span>Дизайн</button></div>'+
  '<nav class="pf-bottom" aria-label="Основное меню"><button aria-current="page"><span>⌂</span>Главная</button><button data-pf-action="projects"><span>▱</span>Проекты</button><button data-pf-go="recipes"><span>▤</span>ТТК</button><button data-pf-go="print-control"><span>▣</span>Печать</button><button data-pf-action="more"><span>•••</span>Ещё</button></nav>';
 shell.querySelectorAll('[data-pf-go="tasks"],[data-pf-go="lab"]').forEach(node=>node.remove());
 // The old quick-actions and AI banner duplicated Settings and working tools.
 shell.querySelector('.pf-actions')?.remove();
 shell.querySelector('.pf-ai-button')?.remove();
 const grid=shell.querySelector('#pf-home-tiles');
 for(const [symbol,title,subtitle,view] of tiles){
  const tile=node('button','pf-tile');tile.type='button';tile.dataset.pfGo=view;
  const i=node('span','pf-tile-icon');i.innerHTML=icon(symbol);tile.append(i,node('strong','',title),node('small','',subtitle));grid.append(tile);
 }
 shell.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pfGo){goto(b.dataset.pfGo);return}
  const action=b.dataset.pfAction;
  if(action==='settings')document.getElementById('menu-settings')?.click();
  if(action==='projects')openProjects();
  if(action==='more')document.getElementById('menu-toggle')?.click();
 });
 home.append(shell);
 // The selected design is applied at initialization and whenever Studio
 // changes the theme. This keeps legacy and premium dashboards exclusive.
 document.documentElement.removeAttribute('data-pf-boot');
 function updateProjectPicker(){
  const select=document.getElementById('pf-home-project-select');if(!select)return;
  select.replaceChildren();for(const p of projects.projects)select.add(new Option('Проект: '+p.name,p.id));select.value=projects.selected;document.dispatchEvent(new Event('pf:projects'));
 }
 shell.querySelector('#pf-home-project-select').addEventListener('change',e=>{
  projects.selected=e.target.value;setJson(PROJECT_KEY,projects);document.dispatchEvent(new Event('pf:projects'));
 });
 function renderProjects(){
  projectModal.replaceChildren();
  const head=node('div','pf-modal-header');head.append(node('h2','','Проекты FARRUH AI'),button('✕','',()=>projectModal.close()));projectModal.append(head);
  const body=node('div','pf-modal-body pf-projects-pane');
  body.append(node('h3','','Мои заказчики и проекты'));
  const warning=node('p','pf-warning','Техкарты можно привязать к проекту и фильтровать по нему. Старые ТТК без проекта доступны через «Все проекты» и «Без проекта». Прочие разделы пока используют общие данные.');
  body.append(warning);
  const list=node('div','pf-project-list');
  for(const p of projects.projects){
   const row=node('div','pf-project-item');const label=node('div');label.append(node('strong','',p.name),node('small','',p.id===projects.selected?'Выбран на главной':'Доступен для выбора'));row.append(label);
   const actions=node('div','');actions.style.cssText='display:flex;gap:6px';
   if(p.id!==projects.selected)actions.append(button('Выбрать','',()=>{projects.selected=p.id;setJson(PROJECT_KEY,projects);updateProjectPicker();renderProjects()}));
   actions.append(button('Изменить','',()=>{
    const name=prompt('Название проекта',p.name);if(name===null)return;
    const clean=name.trim().slice(0,60);if(!clean)return;
    p.name=clean;setJson(PROJECT_KEY,projects);updateProjectPicker();renderProjects();
   }));row.append(actions);list.append(row);
  }
  body.append(list);
  const add=node('div','pf-project-add');const input=node('input');input.placeholder='Название нового проекта';input.maxLength=60;input.setAttribute('aria-label','Название нового проекта');add.append(input);
  const addButton=button('＋ Добавить','pf-primary',()=>{
   const name=input.value.trim();if(!name)return;const id='project-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
   if(projects.projects.length>=50){alert('Доступно не более 50 проектов.');return}
   projects.projects.push({id,name});projects.selected=id;setJson(PROJECT_KEY,projects);updateProjectPicker();renderProjects();
  });add.append(addButton);input.addEventListener('keydown',e=>{if(e.key==='Enter')addButton.click()});body.append(add);
  body.append(node('p','','ТТК группируются по проектам через поле «Проект ТТК» в редакторе. Другие данные пока общие.'));
  projectModal.append(body);
 }
 function openProjects(){renderProjects();if(!projectModal.open)projectModal.showModal()}
 let tab='themes';
 function renderStudio(){
  studio.replaceChildren();
  const head=node('div','pf-modal-header');head.append(node('h2','','◈ FARRUH AI DESIGN STUDIO'),button('✕','',cancelStudio));studio.append(head);
  const body=node('div','pf-modal-body pf-studio-cols');
  const tabs=node('div','pf-studio-nav');
  for(const [id,label] of [['themes','🎨 Темы'],['layout','▦ Карточки и кнопки'],['type','Aa Шрифты и эффекты']]){
   const b=button(label,id===tab?'active':'',()=>{tab=id;renderStudio()});tabs.append(b);
  }
  const pane=node('div','pf-studio-pane');
  if(tab==='themes'){
   pane.append(node('h3','','Выбор дизайна'));
   pane.append(node('p','','Три новые 3D-дизайн-системы для телефона и компьютера плюс пять классических тем. Выбери вариант — оформление изменится сразу. Нажми «Применить», чтобы сохранить.'));
   const themes=node('div','pf-themes');
   for(const [id,name] of Object.entries(themeNames)){
    const b=button('','pf-theme-btn'+(draft.theme===id?' selected':'') ,()=>{
      draft.theme=id;draft.accent='';applyDesign(draft);renderStudio();
    });b.setAttribute('aria-pressed',String(draft.theme===id));if(['titanium','crystal','royal'].includes(id))b.dataset.premium='true';
    const sw=node('span','pf-theme-sw');sw.style.background='linear-gradient(135deg,'+themeColors[id][0]+','+themeColors[id][1]+')';b.append(sw,node('strong','',name),node('small','',({titanium:'Титан • 3D • синий',crystal:'Лёд • 3D • светлый',royal:'Золото • 3D • чёрный',arctic:'Ледяной голубой',ice:'Тёмный премиум',white:'Светлый',gold:'Графит и золото',burgundy:'Бордовый'})[id]));themes.append(b);
   }pane.append(themes);
   const colorRow=node('label','pf-control');colorRow.append(node('span','','Свой акцентный цвет'));const color=node('input');color.type='color';color.value=draft.accent||themeColors[draft.theme][0];color.addEventListener('input',()=>{draft.accent=color.value;applyDesign(draft)});colorRow.append(color);pane.append(colorRow);
  }else if(tab==='layout'){
   pane.append(node('h3','','Карточки и расположение'));
   pane.append(node('p','','Меняй плотность элементов и скругление карточек. Все рабочие функции останутся на месте.'));
   const density=node('label','pf-control');density.append(node('span','','Плотность интерфейса'));const select=node('select');
   for(const [id,label] of [['compact','Компактно'],['standard','Стандартно'],['spacious','Просторно']])select.add(new Option(label,id));
   select.value=draft.density;select.onchange=()=>{draft.density=select.value;applyDesign(draft)};density.append(select);pane.append(density);
   const radius=node('label','pf-control');radius.append(node('span','','Скругление карточек · '+draft.radius+' px'));const slider=node('input');slider.type='range';slider.min='8';slider.max='30';slider.step='1';slider.value=draft.radius;slider.oninput=()=>{draft.radius=Number(slider.value);radius.firstChild.textContent='Скругление карточек · '+draft.radius+' px';applyDesign(draft)};radius.append(slider);pane.append(radius);
  }else{
   pane.append(node('h3','','Шрифты и эффекты'));
   pane.append(node('p','','Размеры интерфейса и анимации меняются без вмешательства в ТТК и печатные PDF.'));
   const scale=node('label','pf-control');scale.append(node('span','','Масштаб интерфейса'));const select=node('select');for(const n of [.9,1,1.1,1.2])select.add(new Option(Math.round(n*100)+'%',String(n)));select.value=String(draft.scale);select.onchange=()=>{draft.scale=Number(select.value);applyDesign(draft)};scale.append(select);pane.append(scale);
   const motion=node('label','pf-control');motion.append(node('span','','Анимации и эффекты'));const check=node('input');check.type='checkbox';check.checked=draft.motion;check.onchange=()=>{draft.motion=check.checked;applyDesign(draft)};motion.append(check);pane.append(motion);
  }
  const preview=node('div','pf-studio-preview');preview.style.marginTop='18px';preview.append(node('strong','','Предпросмотр • '+themeNames[draft.theme]),node('small','','Профессиональный кабинет шефа • выбор дизайна без потери данных'));pane.append(preview);
  body.append(tabs,pane);studio.append(body);
  const footer=node('div','pf-modal-footer');
  footer.append(button('По умолчанию','',()=>{draft=deepCopy(defaults);applyDesign(draft);renderStudio()}));
  footer.append(button('Отменить','',cancelStudio));
  footer.append(button('Применить','pf-primary',()=>{config=validDesign(draft);if(!setJson(DESIGN_KEY,config)){alert('Не получилось сохранить оформление в браузере.');return}applyDesign(config);draft=null;studio.close()}));
  studio.append(footer);
 }
 function cancelStudio(){applyDesign(config);draft=null;studio.close()}
 function openStudio(){draft=deepCopy(config);tab='themes';renderStudio();if(!studio.open)studio.showModal()}
 studio.addEventListener('cancel',e=>{e.preventDefault();cancelStudio()});
 projectModal.addEventListener('click',e=>{if(e.target===projectModal)projectModal.close()});
 studio.addEventListener('click',e=>{if(e.target===studio)cancelStudio()});
 addSidebar();updateProjectPicker();applyDesign(config);
 // Premium layouts are additive, and keep the original five designs intact.
 mountPremiumShowcase({shell,goto,openStudio,openProjects});
 mountPremiumRoyalV2({shell,goto,openStudio,openProjects});
 const settingsTarget=document.getElementById('site-settings');
 if(settingsTarget){
  new MutationObserver(attachSettingsHub).observe(settingsTarget,{childList:true});
  attachSettingsHub();
 }
}
