/* FARRUH AI · Premium PRO interface (variant 3).
   Presentation layer. Does not change recipe, HACCP, journal or print storage. */
import {categoryPhotos} from './recipe-catalog.js?v=2';

const ICONS = {
  total:'<path d="m4 7 8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4"/>',
  ready:'<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
  draft:'<path d="M4 20h16M6 16l10-10 3 3-10 10-4 1zM14 8l3 3"/>',
  category:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'
};
const icon=key=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+ICONS[key]+'</svg>';

export function mountLuxuryUI({onRefresh=()=>{},onOpenProjects=()=>{}}={}){
 document.body.classList.add('lx-pro');
 const root=document.getElementById('recipes');
 if(!root)return {updateStats(){},updateCategories(){},matchStatus(){return true},decorateRow(){}};
 root.classList.add('lx-recipes');
 const hero=root.querySelector(':scope > .bar');
 if(hero)hero.classList.add('lx-hero');
 const lead=root.querySelector(':scope > .section-subtitle');
 if(lead)lead.textContent='Рецептуры · Технологии · Производственные стандарты';
 const stats=document.createElement('div');
 stats.className='lx-stats';
 const metrics=[['total','Всего ТТК'],['ready','Готовые'],['draft','Черновики'],['category','Категории']];
 for(const [key,label] of metrics){
  const card=document.createElement('div');card.className='lx-stat lx-stat-'+key;
  card.innerHTML='<span class="lx-stat-icon">'+icon(key)+'</span><span class="lx-stat-body"><strong data-lx-count="'+key+'">0</strong><small></small></span>';
  card.querySelector('small').textContent=label;stats.append(card);
 }
 lead?.after(stats);
 const projectRow=document.createElement('div');projectRow.className='lx-workspace-row';
 const projectInfo=document.createElement('div');projectInfo.className='lx-workspace-info';
 projectInfo.innerHTML='<span class="lx-workspace-mark">'+icon('total')+'</span><span><strong>Библиотека техкарт</strong><small>Все сохранённые рецептуры на этом устройстве</small></span>';
 const projectButton=document.createElement('button');projectButton.type='button';projectButton.className='lx-button-subtle';projectButton.textContent='Проекты ↗';
 projectButton.addEventListener('click',onOpenProjects);
 projectRow.append(projectInfo,projectButton);
 const catHeading=root.querySelector('.catalog-heading');
 catHeading?.before(projectRow);
 const strip=document.createElement('div');strip.className='lx-status-filters';strip.setAttribute('aria-label','Фильтр статусов');
 const tabs=[['all','Все'],['ready','Готовые'],['draft','Черновики']];
 let selected='all';
 for(const [key,label] of tabs){
  const b=document.createElement('button');b.type='button';b.dataset.lxStatus=key;
  b.setAttribute('aria-pressed',String(key===selected));b.textContent=label;
  b.addEventListener('click',()=>{
   selected=key;
   strip.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.lxStatus===key)));
   onRefresh();
  });strip.append(b);
 }
 const results=root.querySelector('#catalog-results');
 if(results)results.before(strip);
 const catNav=root.querySelector('#recipe-categories');
 const searchWrap=root.querySelector('.catalog-search');
 const favoriteFilters=root.querySelector('.catalog-filters');
 if(catNav&&searchWrap)catNav.after(searchWrap);
 if(searchWrap&&favoriteFilters)searchWrap.after(favoriteFilters);
 const title=root.querySelector('#catalog-title');
 if(title)title.textContent='Категории блюд';
 const search=root.querySelector('#recipe-search');
 if(search)search.placeholder='Поиск по названию или категории…';
 const statsByKey=key=>stats.querySelector('[data-lx-count="'+key+'"]');
 return {
  matchStatus:recipe=>selected==='all'||(selected==='ready'?recipe.status==='ready':recipe.status!=='ready'),
  updateStats(recipes=[]){
   const ready=recipes.filter(r=>r.status==='ready').length;
   const values={total:recipes.length,ready,draft:recipes.length-ready,category:new Set(recipes.map(r=>r.category).filter(Boolean)).size};
   for(const [key,value] of Object.entries(values)){const el=statsByKey(key);if(el)el.textContent=value.toLocaleString('ru-RU')}
  },
  updateCategories(category='Все'){
   root.querySelectorAll('#recipe-categories .category-card').forEach(b=>{
    const active=category!=='Все'&&b.dataset.category===category;
    b.classList.toggle('lx-selected',active);b.setAttribute('aria-pressed',String(active));
   });
  },
  decorateRow(row,recipe){
   if(!row||row.classList.contains('lx-recipe'))return;
   row.classList.add('lx-recipe');
   const name=row.querySelector(':scope > span:first-child');
   const badge=row.querySelector(':scope > .recipe-status');
   const edit=row.querySelector(':scope > button:not([aria-pressed]):not(.recipe-delete)');
   const favorite=row.querySelector(':scope > button[aria-pressed]');
   const yieldInfo=row.querySelector(':scope > small');
   const downloads=[...row.querySelectorAll(':scope > a')];
   const remove=row.querySelector(':scope > .recipe-delete');
   const photo=document.createElement('div');photo.className='lx-recipe-photo';
   if(categoryPhotos[recipe.category]){
    const image=document.createElement('img');image.src=categoryPhotos[recipe.category];
    image.alt='';image.loading='lazy';image.decoding='async';photo.append(image);
   }else{photo.classList.add('lx-photo-placeholder');photo.textContent='ТТК'}
   const content=document.createElement('div');content.className='lx-recipe-content';
   const top=document.createElement('div');top.className='lx-recipe-top';
   const title=document.createElement('strong');title.className='lx-recipe-name';
   title.textContent=recipe.name||'Без названия';
   top.append(title);if(badge)top.append(badge);
   const meta=document.createElement('div');meta.className='lx-recipe-meta';
   const category=document.createElement('span');category.className='lx-meta-category';category.textContent=recipe.category||'Без категории';meta.append(category);
   if(yieldInfo?.textContent)meta.append(yieldInfo);
   if(recipe.cardNumber){const code=document.createElement('small');code.textContent='№ '+recipe.cardNumber;meta.append(code)}
   if(Number.isFinite(Number(recipe.pieces))&&Number(recipe.pieces)>0){
    const pieces=document.createElement('small');pieces.textContent=recipe.pieces+' шт.';meta.append(pieces);
   }
   const nutrition=recipe.nutrition;
   if(nutrition&&['kcal','protein','fat','carbs'].every(k=>nutrition[k]!==null&&nutrition[k]!==''&&Number.isFinite(Number(nutrition[k])))){
    const line=document.createElement('small');line.className='lx-nutrition';
    line.textContent='КБЖУ: '+['kcal','protein','fat','carbs'].map(k=>Number(nutrition[k]).toLocaleString('ru-RU',{maximumFractionDigits:1})).join(' / ');
    meta.append(line);
   }
   content.append(top,meta);
   const actions=document.createElement('div');actions.className='lx-recipe-actions';actions.hidden=true;
   if(edit){edit.textContent='✎ Редактировать';actions.append(edit)}
   for(const node of [favorite,...downloads,remove])if(node)actions.append(node);
   const more=document.createElement('button');more.type='button';more.className='lx-recipe-more';
   more.textContent='Действия';more.setAttribute('aria-label','Действия с техкартой '+(recipe.name||''));
   more.setAttribute('aria-expanded','false');more.addEventListener('click',()=>{
    actions.hidden=!actions.hidden;more.setAttribute('aria-expanded',String(!actions.hidden));
   });
   row.replaceChildren(photo,content,more,actions);
  }
 };
}
