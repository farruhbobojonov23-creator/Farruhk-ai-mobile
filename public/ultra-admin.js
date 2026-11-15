/* Owner-only Ultra Admin category. Navigation to implemented tools only.
   Advanced features are explicitly listed as planned, never faked as operational. */
export function mountUltraAdmin({root,goTo,openStudio,openProjects,openDataCenter}){
 if(!root||root.dataset.ultraMounted==='1')return;
 root.dataset.ultraMounted='1';root.classList.add('fai-ultra-admin');
 const element=(tag,className,text)=>{
  const x=document.createElement(tag);
  if(className)x.className=className;
  if(text!==undefined)x.textContent=text;
  return x;
 };
 const hero=element('header','fai-ua-hero');
 hero.append(element('div','fai-ua-eyebrow','FARRUH AI · OWNER EDITION'),
             element('h1','', '♛ ULTRA ADMIN'),
             element('p','', 'Единый центр управления приложением. Выбирайте инструмент — откроется рабочий раздел.'));
 const headerActions=element('div','fai-ua-hero-actions');
 const returnHome=element('button','fai-ua-back','← На главную');returnHome.type='button';returnHome.onclick=()=>goTo('home');
 headerActions.append(returnHome);hero.append(headerActions);root.append(hero);
 const title=element('h2','fai-ua-heading','Инструменты владельца');root.append(title);
 const grid=element('div','fai-ua-grid');root.append(grid);
 const showCategories=()=>{
  goTo('recipes');
  if(document.body.dataset.view!=='recipes')return;
  const categoryButton=document.getElementById('manage-categories');
  if(categoryButton){categoryButton.click();}
 };
 const actions=[
  ['✏','Редактор страниц','Названия, подписи, порядок и видимость разделов',()=>goTo('site-settings')],
  ['◈','Дизайн-студия','Темы, цвет, скругления, размеры и анимации',openStudio],
  ['▦','Категории ТТК','Добавление, переименование, порядок, фото и цвета',showCategories],
  ['▤','ТТК и шаблоны','Открыть каталог и редактор технологических карт',()=>goTo('recipes')],
  ['▧','Ингредиенты и ПФ','Учёт заготовок и работа с рецептурами',()=>goTo('preparations')],
  ['▱','Мои проекты','Создание и выбор проектов',openProjects],
  ['♧','ХАССП','Журналы и контроль безопасности',()=>goTo('lab')],
  ['▣','Маркировка и печать','Открыть FARUKH PRINT и управление этикетками',()=>goTo('print-control')],
  ['☁','Данные и Google','Резервные копии, Google ТТК и синхронизация',openDataCenter]
 ];
 for(const [symbol,name,description,action] of actions){
  const card=element('button','fai-ua-card');card.type='button';
  const icon=element('span','fai-ua-icon',symbol);
  const copy=element('span','fai-ua-card-copy');
  copy.append(element('strong','',name),element('small','',description));
  const state=element('span','fai-ua-open','Открыть ›');
  card.append(icon,copy,state);
  card.addEventListener('click',()=>{try{action?.()}catch(error){console.error('ULTRA ADMIN:',error);}});
  grid.append(card);
 }
 const planned=element('section','fai-ua-planned');
 planned.append(element('h2','','Расширенные функции'),
  element('p','','Полный редактор каждого элемента, отдельные макеты телефона и ПК, конструктор новых блоков и история версий пока не реализованы. Раздел будет расширяться без изменения данных ТТК.'));
 const chips=element('div','fai-ua-chips');
 for(const label of ['Визуальный редактор всех экранов','Свободное перемещение элементов','Конструктор модулей','История дизайнов']){
  chips.append(element('span','',label+' · планируется'));
 }
 planned.append(chips);root.append(planned);
}
