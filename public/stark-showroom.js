/**
 * FARUKH AI · STARK MINIMAL 4
 * Home-only presentation. Recipes, HACCP, Google sync and local device storage
 * remain owned by their original modules. No continuous rendering loop.
 */
const ICONS={
 recipe:'<path d="M7 3h9l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v5h5M9 12h7M9 16h7"/>',
 shield:'<path d="m12 2 8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6zM8 12l3 3 5-6"/>',
 tools:'<path d="M12 3v18M3 12h18M5 5l14 14M19 5 5 19"/><circle cx="12" cy="12" r="3"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m10 2 4 0 1 3 2 1 3-1 2 4-2 2v2l2 2-2 4-3-1-2 1-1 3h-4l-1-3-2-1-3 1-2-4 2-2v-2L2 9l2-4 3 1 2-1z"/>',
 arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
 chat:'<path d="M4 5h16v12H9l-5 4V5zM8 10h8M8 14h5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
};
function svg(which){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" aria-hidden="true">'+ICONS[which]+'</svg>'}
export function mountStarkShowroom({host,getRecipes=()=>[],onOpenRecipes=()=>{},onOpenChat=()=>{},onNavigate=()=>{}}={}){
 if(!host)throw new Error('Home element not found');
 const root=document.createElement('div');
 root.className='stark-showroom v4-home';
 root.innerHTML=`
  <div class="v4-meta">
   <div class="v4-meta-brand"><span class="v4-meta-dot" aria-hidden="true"></span> КАБИНЕТ ШЕФА <span class="v4-sep">/</span> STARK MINIMAL</div>
   <div class="v4-meta-right"><span class="v4-weather" title="Погода из виджета приложения">Погода —</span><time class="v4-now"></time></div>
  </div>
  <header class="v4-heading">
   <span class="v4-kicker">ИНТЕЛЛЕКТУАЛЬНАЯ СИСТЕМА КУХНИ</span>
   <h1>FARUKH <span>AI</span></h1>
   <p>Ваша кухня. Ваши стандарты. Всё под контролем.</p>
  </header>
  <main class="v4-stage" aria-label="Рабочие разделы FARUKH AI">
   <div class="v4-side v4-left">
    <button type="button" class="v4-card" data-target="recipes"><span class="v4-card-icon">${svg('recipe')}</span><span class="v4-card-body"><small>01 / РЕЦЕПТУРЫ</small><strong>ТТК</strong><span>Создание, редактирование и скачивание технологических карт</span></span><span class="v4-card-arrow">${svg('arrow')}</span></button>
    <button type="button" class="v4-card" data-target="tools" aria-expanded="false" aria-controls="v4-tools"><span class="v4-card-icon">${svg('tools')}</span><span class="v4-card-body"><small>03 / УПРАВЛЕНИЕ</small><strong>Рабочие инструменты</strong><span>Задачи, калькуляторы, заготовки и контроль</span></span><span class="v4-card-arrow">${svg('arrow')}</span></button>
   </div>
   <div class="v4-center">
    <div class="v4-rings" aria-hidden="true"><span></span><span></span><span></span></div>
    <button type="button" class="v4-orb" aria-label="Открыть FARUKH AI — умный помощник">
     <span class="v4-orb-highlight" aria-hidden="true"></span>
     <svg class="v4-orb-logo" viewBox="0 0 90 90" fill="none" aria-hidden="true"><path d="m16 66 29-46 29 46M31 66l14-23 14 23M45 20v22" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <span class="v4-orb-top">ЗНАНИЯ &nbsp; · &nbsp; КОНТРОЛЬ &nbsp; · &nbsp; РАЗВИТИЕ</span>
    <button type="button" class="v4-talk"> ${svg('chat')} <span>Спросить FARUKH AI</span> <span aria-hidden="true">↗</span></button>
   </div>
   <div class="v4-side v4-right">
    <button type="button" class="v4-card" data-target="lab"><span class="v4-card-icon">${svg('shield')}</span><span class="v4-card-body"><small>02 / БЕЗОПАСНОСТЬ</small><strong>ХАССП</strong><span>Журналы, проверки и контроль пищевой безопасности</span></span><span class="v4-card-arrow">${svg('arrow')}</span></button>
    <button type="button" class="v4-card" data-target="settings"><span class="v4-card-icon">${svg('settings')}</span><span class="v4-card-body"><small>04 / ПАРАМЕТРЫ</small><strong>Настройки</strong><span>Google, параметры системы и управление данными</span></span><span class="v4-card-arrow">${svg('arrow')}</span></button>
   </div>
  </main>
  <div class="v4-tools" id="v4-tools" hidden>
   <div class="v4-tools-head"><strong>Рабочие инструменты</strong><button type="button" class="v4-tools-close" aria-label="Закрыть инструменты">×</button></div>
   <div class="v4-tools-grid"><button type="button" data-tool="calc">Калькулятор ↗</button><button type="button" data-tool="tasks">Задачи ↗</button><button type="button" data-tool="checks">Контроль точек ↗</button><button type="button" data-tool="preparations">Заготовки ↗</button></div>
  </div>
  <footer class="v4-footer">
   <div class="v4-status"><span class="v4-green-dot" aria-hidden="true"></span><span>Рабочий кабинет</span><small>Данные хранятся в этом браузере</small></div>
   <span class="v4-count" aria-live="polite"></span>
   <div class="v4-fast"><button type="button" class="v4-create">+ Создать ТТК</button><button type="button" class="v4-journals">Журналы ХАССП ↗</button></div>
  </footer>`;
 host.prepend(root);
 const toolsPanel=root.querySelector('.v4-tools'),toolsButton=root.querySelector('[data-target="tools"]');
 function setTools(open){toolsPanel.hidden=!open;toolsButton.setAttribute('aria-expanded',String(open))}
 function navigate(target){
  setTools(false);
  if(target==='settings'){document.getElementById('lunar-settings')?.click();return}
  if(target==='preparations'){document.getElementById('menu-preparations')?.click();return}
  if(target==='recipes'){onOpenRecipes();return}
  onNavigate(target);
 }
 root.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',()=>{
  const target=b.dataset.target;
  if(target==='tools')setTools(toolsPanel.hidden);
  else navigate(target);
 }));
 root.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.tool)));
 root.querySelector('.v4-tools-close').addEventListener('click',()=>setTools(false));
 root.querySelector('.v4-orb').addEventListener('click',onOpenChat);
 root.querySelector('.v4-talk').addEventListener('click',onOpenChat);
 root.querySelector('.v4-create').addEventListener('click',()=>{
   const create=document.getElementById('pearl-new-recipe');
   if(create)create.click();else onOpenRecipes();
 });
 root.querySelector('.v4-journals').addEventListener('click',()=>navigate('lab'));
 root.addEventListener('keydown',e=>{if(e.key==='Escape')setTools(false)});
 const clock=root.querySelector('.v4-now');
 const weather=root.querySelector('.v4-weather');
 function updateMeta(){
  const now=new Date();
  clock.textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}).format(now);
  const value=document.querySelector('[data-weather-temp]')?.textContent?.trim();
  weather.textContent=value&&value!=='—'?'Мурманск · '+value:'Мурманск · погода —';
 }
 updateMeta();
 const clockTimer=setInterval(()=>{if(root.isConnected)updateMeta();else clearInterval(clockTimer)},60000);
 const oldWeather=document.querySelector('[data-weather-temp]');
 if(oldWeather&&typeof MutationObserver!=='undefined'){
  const watcher=new MutationObserver(updateMeta);
  watcher.observe(oldWeather,{characterData:true,childList:true,subtree:true});
 }
 function updateRecipes(recipes){
  const count=Array.isArray(recipes)?recipes.length:0;
  root.querySelector('.v4-count').textContent=count?count+' ТТК в вашей базе':'ТТК · ваша база';
 }
 try{updateRecipes(getRecipes())}catch{updateRecipes([])}
 document.body.classList.add('stark-ready');
 document.body.classList.remove('stark-booting');
 return {updateRecipes,selectCategory:()=>navigate('recipes')};
}
