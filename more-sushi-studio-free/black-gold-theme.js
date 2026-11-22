/* MORE SUSHI STUDIO PRO · BLACK GOLD 5.0
   DOM adaptation of the approved mockup, NOT a screenshot overlay.
   Keeps 5-tab navigation and original links; no user data is edited. */
(function(){
 'use strict';
 const root=document.documentElement;
 const stage=document.getElementById('mssCategoryApp');
 const home=document.getElementById('mss-home');
 const hero=document.querySelector('.wrap > .hero');
 const nav=document.querySelector('.bottomnav');
 const cloud=document.querySelector('.wrap > .cloudbar');
 if(!stage||!home||!hero||!nav||!cloud)return;
 root.classList.add('black-gold-ui');
 root.classList.remove('ocean40-art-ready');

 // 1. Real DOM hero: nothing here is rasterized text, clickable CTA is genuine.
 const oldArt=hero.querySelector('.bg-gold-hero-art');
 if(!oldArt){
  const img=document.createElement('img');
  img.className='bg-gold-hero-art';img.alt='';img.decoding='async';
  img.src='./black-gold/bg-hero.webp?v=5.0';img.setAttribute('aria-hidden','true');
  hero.insertBefore(img,hero.firstChild);
 }
 const copy=hero.querySelector('.hero-copy');
 if(copy){
  copy.replaceChildren();
  const kicker=document.createElement('div');kicker.className='bg-gold-kicker';kicker.textContent='ПРОФЕССИОНАЛЬНЫЕ';
  const h=document.createElement('h1');h.textContent='ТТК';
  const line=document.createElement('span');line.className='bg-gold-hairline';line.setAttribute('aria-hidden','true');
  const desc=document.createElement('p');desc.textContent='Рецептуры, технологии, КБЖУ и контроль качества';
  const btn=document.createElement('a');btn.className='hero-stamp';
  btn.href='./index.html?ocean=1&view=editor';btn.textContent='Создать ТТК';
  const arrow=document.createElement('span');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');btn.appendChild(arrow);
  copy.append(kicker,h,line,desc,btn);
 }
 hero.setAttribute('aria-label','Технологические карты MORE SUSHI. Создать ТТК');

 // 2. Approved six-card grid using cropped art from the selected reference.
 //    The old metric nodes are deliberately preserved (for live cloud counters).
 const grid=home.querySelector('.mss-feature-grid');
 const cards=[
  {name:'ТТК',desc:'Создание и управление',asset:'ttk',url:'./index.html?ocean=1&view=editor'},
  {name:'Ингредиенты',desc:'Сырьё, состав и КБЖУ',asset:'ingredients',tab:'catalog'},
  {name:'Полуфабрикаты',desc:'Заготовки и потери',asset:'prep',tab:'catalog'},
  {name:'Готовые блюда',desc:'Роллы, суши и другое',asset:'roll',tab:'catalog'},
  {name:'Соусы',desc:'Рецептуры и раскладки',asset:'sauces',tab:'catalog'},
  {name:'PDF и печать',desc:'Шаблоны и экспорт ТТК',asset:'pdf',url:'./index.html?ocean=1&view=templates'}
 ];
 if(grid){
  grid.replaceChildren();grid.classList.add('bg-gold-grid');
  grid.setAttribute('aria-label','Разделы профессиональной кухни');
  for(const item of cards){
   const clickable=document.createElement(item.url?'a':'button');
   clickable.className='bg-gold-card';
   if(item.url)clickable.href=item.url;
   else{clickable.type='button';clickable.dataset.mssTab=item.tab;clickable.setAttribute('aria-label',item.name+' — открыть каталог (раздел готовится)');}
   const img=document.createElement('img');img.className='bg-gold-photo';
   img.src='./black-gold/bg-'+item.asset+'.webp?v=5.0';img.alt='';img.decoding='async';img.loading='eager';img.setAttribute('aria-hidden','true');
   const title=document.createElement('strong');title.className='bg-gold-label';title.textContent=item.name;
   const sub=document.createElement('small');sub.className='bg-gold-desc';sub.textContent=item.desc;
   const arrow=document.createElement('span');arrow.className='bg-gold-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
   clickable.append(img,title,sub,arrow);grid.append(clickable);
  }
 }

 // 3. Inner sections keep their real link/feature semantics, but share the
 //    same approved photographic cards and gold outline visual language.
 const artByTitle={
  'Новая ТТК':'ttk','Все ТТК':'ttk','Черновики':'ttk','Готовые ТТК':'roll',
  'Ингредиенты':'ingredients','Полуфабрикаты':'prep','Готовые блюда':'roll',
  'Соусы':'sauces','Шаблоны А4':'pdf','Печать ТТК':'pdf',
  'Шаблоны ТТК':'pdf','История PDF':'pdf'
 };
 for(const panel of stage.querySelectorAll('[data-mss-panel]')){
  const title=panel.querySelector('.mss-title h2');
  if(title){
   const value=title.textContent.trim().replace(/^[^\p{L}\p{N}]+/u,'');
   title.textContent=value;
  }
  for(const card of panel.querySelectorAll('.mss-grid>.mss-card')){
   const name=card.querySelector('strong')?.textContent?.trim();
   const asset=artByTitle[name];
   if(!asset||card.querySelector('.bg-gold-inner-photo'))continue;
   const img=document.createElement('img');img.alt='';img.setAttribute('aria-hidden','true');
   img.className='bg-gold-inner-photo';img.src='./black-gold/bg-'+asset+'.webp?v=5.0';
   img.loading='lazy';img.decoding='async';card.insertBefore(img,card.firstChild);
  }
 }

 // 4. Accessibility-first home fit. Real clickable tiles never get cropped.
 //    Other tabs retain scrolling; small-height home screens can scroll too.
 let pending=false;
 let lastTab=null;
 const setPX=(name,value)=>root.style.setProperty(name,Math.max(0,Math.round(value))+'px');
 function release(){root.classList.remove('bg-home-locked');root.removeAttribute('data-bg-fit');}
 function fit(){
  pending=false;
  if(root.dataset.mssTab!=='home'){
   release();lastTab=root.dataset.mssTab;return;
  }
  if(lastTab!=='home')window.scrollTo({top:0,left:0,behavior:'instant'});
  lastTab='home';
  release();
  const h=Math.min(window.visualViewport?.height||window.innerHeight,window.innerHeight);
  const navTop=nav.getBoundingClientRect().top;
  const header=document.querySelector('.wrap > header');
  const headerH=header?.getBoundingClientRect().height||62;
  const available=navTop - 14;
  // Layout reserves actual padding/gaps and all 6 cards before fixing the view.
  const gridTop=grid.getBoundingClientRect().top;
  const current=grid.getBoundingClientRect().height;
  const requiredMinCards=82;
  const other=gridTop - (hero.getBoundingClientRect().height);
  if(h<700){
   // Small-height / large-font Android: real content must remain fully visible.
   // Locking an overpacked screen would crop the live hero CTA, so scroll here.
   setPX('--bg-hero-height',184);
   setPX('--bg-card-height',94);
   root.dataset.bgFit='accessible-scroll';
   return;
  }
  const desiredHero=Math.max(149,Math.min(245,h*0.255));
  const cardGap=9;
  let maxCard=Math.floor((available - other - desiredHero - 2*cardGap)/3);
  let heroHeight=desiredHero;
  if(maxCard<requiredMinCards){
   heroHeight=Math.max(135,desiredHero- (requiredMinCards-maxCard)*3);
   maxCard=Math.floor((available - other - heroHeight - 2*cardGap)/3);
  }
  const cardHeight=Math.min(156,Math.max(78,maxCard));
  setPX('--bg-hero-height',heroHeight);
  setPX('--bg-card-height',cardHeight);
  // Browser resolves styles next frame; any clipping means allow scrolling.
  requestAnimationFrame(()=>{
   if(root.dataset.mssTab!=='home')return;
   const last=grid.querySelector('.bg-gold-card:last-child');
   if(!last)return;
   const bottom=last.getBoundingClientRect().bottom;
   const topNav=nav.getBoundingClientRect().top;
   const fits=(bottom<=topNav-5) && cardHeight>=80 && heroHeight>=138;
   if(fits){root.classList.add('bg-home-locked');root.dataset.bgFit='locked';}
   else{release();root.dataset.bgFit='accessible-scroll';}
  });
 }
 function schedule(){if(pending)return;pending=true;requestAnimationFrame(fit);}
 new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-mss-tab']});
 window.addEventListener('resize',schedule,{passive:true});
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('orientationchange',schedule,{passive:true});
 window.addEventListener('pageshow',schedule,{passive:true});
 if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});
 schedule();
})();
