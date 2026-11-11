/* MORE SUSHI · North Pearl dashboard & navigation enhancements.
   Presentation only: never changes recipes, prices, approvals or storage data. */
(function(){
'use strict';
const d=document;
const home=d.getElementById('homePage');
if(!home||d.getElementById('msHomeHero'))return;
const hero=d.createElement('section');
hero.id='msHomeHero';hero.className='msHomeHero';
hero.setAttribute('aria-label','Рабочее пространство Море Суши');
hero.innerHTML=
 '<div class="msHomeCopy">'+
 '<small class="msHomeEyebrow">МОРЕ СУШИ / STUDIO PRO</small>'+
 '<h2>Твоя кухня.<br>Твой стандарт.</h2>'+
 '<p>Все рецептуры под контролем: ингредиенты, полуфабрикаты, роллы и технико-технологические карты — в одной системе.</p>'+
 '<div class="msHomeCtas">'+
 '<button type="button" data-ms-go="product">🍣 Открыть меню</button>'+
 '<button type="button" class="msHomeGhost" data-ms-go="prefab">🥣 Полуфабрикаты</button></div></div>'+
 '<div class="msHomeSymbol" aria-hidden="true"><span>🍣</span></div>';
home.insertBefore(hero,home.firstChild);
const heading=d.createElement('div');
heading.className='msSectionHead';
heading.innerHTML='<div><h2>Путь от сырья до готового ролла</h2>'+
 '<p>Начинай с любого раздела. Все данные связаны между собой.</p></div>'+
 '<span class="msStepCount">4 этапа</span>';
const stepWrap=d.createElement('div');stepWrap.className='msHomeSteps';
const steps=[
 {n:'01',icon:'🥬',title:'Ингредиенты',description:'Производитель, фото, КБЖУ и аллергены.',button:'Открыть базу',page:'ingredients'},
 {n:'02',icon:'🥣',title:'Полуфабрикаты',description:'Состав, граммовки, технология и выход.',button:'Открыть ПФ',page:'prefab'},
 {n:'03',icon:'🍣',title:'Товары и роллы',description:'Холодные и запечённые роллы, готовые к проработке.',button:'Открыть меню',page:'product'},
 {n:'04',icon:'📄',title:'ТТК на листе А4',description:'Цветные шаблоны, редактирование, печать и PDF.',button:'Открыть конструктор',url:'./ttk.html'}
];
steps.forEach(s=>{
 const card=d.createElement('article');card.className='msStep';
 const top=d.createElement('div');top.className='msStepTop';
 const icon=d.createElement('span');icon.className='msStepIcon';icon.textContent=s.icon;
 const number=d.createElement('span');number.className='msStepNum';number.textContent=s.n;
 top.append(icon,number);
 const h=d.createElement('h3');h.textContent=s.title;
 const p=d.createElement('p');p.textContent=s.description;
 const action=s.page?d.createElement('button'):d.createElement('a');
 action.textContent=s.button;
 if(s.page){action.type='button';action.dataset.msGo=s.page}
 else{action.href=s.url}
 card.append(top,h,p,action);stepWrap.append(card);
});
const statCards=home.querySelector('.cards');
if(statCards){statCards.after(heading,stepWrap)}
const review=d.createElement('section');review.className='msReviewPanel';review.id='msReviewPanel';
review.innerHTML='<h2>✅ Готовность технической базы</h2>'+
 '<p>Счётчики обновляются по реальным данным. Статус «Черновик» не означает утверждения рецептуры.</p>'+
 '<div class="msReviewGrid">'+
 '<div class="msReviewItem"><div class="msReviewItemTop"><span>КБЖУ ингредиентов проверено</span><strong id="msVerifiedNutrition">—</strong></div>'+
 '<div class="msReviewTrack" aria-hidden="true"><span id="msNutritionTrack"></span></div></div>'+
 '<div class="msReviewItem"><div class="msReviewItemTop"><span>Аллергены подтверждены</span><strong id="msVerifiedAllergens">—</strong></div>'+
 '<div class="msReviewTrack" aria-hidden="true"><span id="msAllergenTrack"></span></div></div>'+
 '<div class="msReviewItem"><div class="msReviewItemTop"><span>Полуфабрикаты утверждены</span><strong id="msApprovedPf">—</strong></div>'+
 '<div class="msReviewTrack" aria-hidden="true"><span id="msPfTrack"></span></div></div>'+
 '<div class="msReviewItem"><div class="msReviewItemTop"><span>ТТК готовых товаров утверждены</span><strong id="msApprovedProducts">—</strong></div>'+
 '<div class="msReviewTrack" aria-hidden="true"><span id="msProductTrack"></span></div></div>'+
 '</div>'+
 '<div class="msReviewFoot">ℹ️ Проверку сроков хранения, фактического выхода, КБЖУ и безопасности проводят по документации сырья и производственной проработке. Непроверенные сведения не подставляются автоматически.</div>'+
 '<div class="msReviewFooter"><span class="muted">Рабочая база «Море Суши»</span><a href="./ttk.html?design=choose">Выбрать дизайн ТТК →</a></div>';
if(stepWrap.parentNode)stepWrap.after(review);
home.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-ms-go]');
 if(b&&home.contains(b)&&typeof window.switchPage==='function')window.switchPage(b.dataset.msGo);
});
function renderProgress(id,track,verified,total){
 const label=d.getElementById(id),bar=d.getElementById(track);
 if(!label||!bar)return;
 label.textContent=verified+' / '+total;
 bar.style.width=(total?Math.max(0,Math.min(100,verified*100/total)):0)+'%';
}
function refreshStats(){
 try{
  if(typeof ingredients==='undefined'||typeof recipes==='undefined')return;
  const listIng=Array.isArray(ingredients)?ingredients:[];
  const listR=Array.isArray(recipes)?recipes:[];
  const prefabs=listR.filter(r=>r.kind==='prefab');
  const products=listR.filter(r=>r.kind==='product');
  renderProgress('msVerifiedNutrition','msNutritionTrack',listIng.filter(i=>i.nutrition_review_status==='verified').length,listIng.length);
  renderProgress('msVerifiedAllergens','msAllergenTrack',listIng.filter(i=>i.allergen_status==='verified').length,listIng.length);
  renderProgress('msApprovedPf','msPfTrack',prefabs.filter(r=>r.status==='Утверждено').length,prefabs.length);
  renderProgress('msApprovedProducts','msProductTrack',products.filter(r=>r.status==='Утверждено').length,products.length);
 }catch(e){console.warn('Studio design summary:',e.message)}
}
const counter=d.getElementById('nIng');
if(counter){
 const observer=new MutationObserver(refreshStats);
 ['nIng','nPf','nPr'].forEach(id=>{const el=d.getElementById(id);if(el)observer.observe(el,{childList:true,characterData:true,subtree:true})});
}
refreshStats();
d.documentElement.classList.add('msDesignReady');
})();