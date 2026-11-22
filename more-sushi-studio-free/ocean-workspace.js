/* MORE SUSHI STUDIO PRO — application-only skin. Original data and A4 unchanged. */
(function(){
'use strict';
if(!document.documentElement.classList.contains('ocean-app'))return;
function run(){
 const origin='./mobile.html';
 document.title='MORE SUSHI STUDIO PRO · Живой океан 3D';
 const m=document.querySelector('meta[name="theme-color"]');if(m)m.content='#07335d';
 const whale='<svg viewBox="0 0 220 195" aria-hidden="true"><defs><linearGradient id="appTail" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e7ffff"/><stop offset=".45" stop-color="#56d7ff"/><stop offset=".85" stop-color="#0862b2"/><stop offset="1" stop-color="#b8f8ff"/></linearGradient></defs><path d="M13 145Q42 130 70 145T205 135" fill="none" stroke="#ccfcff" stroke-width="4"/><path d="M29 116Q65 108 79 47Q109 64 113 99Q135 64 184 63Q179 102 137 118Q90 129 79 166Q69 130 29 116Z" fill="url(#appTail)" stroke="#d9faff" stroke-width="3"/></svg>';
 for(const lock of document.querySelectorAll('.brand-lockup')){
  const mark=lock.querySelector('.brand-mark');
  if(mark)mark.innerHTML=whale;
  const name=lock.querySelector('.brand-name');
  if(name)name.innerHTML='MORE SUSHI <span>STUDIO PRO</span>';
  const sub=lock.querySelector('.brand-sub');
  if(sub)sub.textContent='ЖИВОЙ ОКЕАН · ПРОФЕССИОНАЛЬНАЯ СИСТЕМА';
 }
 const showcase=document.querySelector('.auth-showcase');
 if(showcase){
  const label=showcase.querySelector('.mini-label');
  if(label)label.textContent='MORE SUSHI STUDIO · OCEAN PREMIUM 3D';
  const title=showcase.querySelector('h1');
  if(title)title.innerHTML='Твоя студия<br><em>профессиональных ТТК</em>';
  const desc=showcase.querySelector('h1+p');
  if(desc)desc.textContent='Техкарты, полуфабрикаты, ингредиенты и документы. Весь рабочий процесс шеф-повара в одной системе.';
  const points=showcase.querySelector('.auth-points');
  if(points)points.innerHTML='<span>🌊 Живой океан</span><span>☁ Защищённая база</span><span>📄 Документы А4</span>';
 }
 const card=document.querySelector('.auth-card');
 if(card){
  const label=card.querySelector('.overline');if(label)label.textContent='ДОСТУП К СТУДИИ MORE SUSHI';
  const heading=card.querySelector('h2');if(heading)heading.textContent='Добро пожаловать!';
  const desc=card.querySelector('h2+p');
  if(desc)desc.textContent='Войди один раз, чтобы открыть свои ТТК и продолжить работу.';
  const footer=card.querySelector('.auth-footer');
  if(footer)footer.textContent='Твои данные и документы останутся в защищённой базе.';
 }
 const breadcrumb=document.querySelector('.breadcrumb');
 if(breadcrumb)breadcrumb.textContent='MORE SUSHI STUDIO PRO / OCEAN WORKSPACE';
 const hero=document.querySelector('#viewDashboard .hero');
 if(hero){
  const label=hero.querySelector('.mini-label');if(label)label.textContent='MORE SUSHI · ЖИВОЙ ОКЕАН';
  const heading=hero.querySelector('h2');if(heading)heading.innerHTML='Профессиональная<br><em>кухня в твоих руках</em>';
 }
 const appbar=document.createElement('div');appbar.className='ocean-appbar';
 appbar.innerHTML='<a href="'+origin+'" aria-label="Вернуться на главный экран">‹ Назад</a><div><strong>MORE SUSHI STUDIO PRO</strong><br><small>Живой океан 3D · рабочий кабинет</small></div><button type="button" class="ocean-refresh-btn" data-ocean-refresh aria-label="Обновить рабочую студию" title="Загрузить свежую версию веб-портала"><span class="refresh-symbol" aria-hidden="true">↻</span><span class="ocean-refresh-label">Обновить</span></button><svg class="ocean-miniwhale" viewBox="0 0 180 180" aria-hidden="true"><use href="./ocean-3d-art.svg?v=3#tail"></use></svg>';
 const auth=document.getElementById('auth');
 const shell=document.getElementById('shell');
 // Always keep a way back even before login; no repeat navigation through old dark landing.
 if(auth)auth.insertAdjacentElement('beforebegin',appbar);
 const nav=document.createElement('nav');nav.className='ocean-bottomnav';nav.setAttribute('aria-label','Мобильная навигация студии');

 const items=[
  ['home','./mobile.html','tail','Главная'],
  ['ttk','./mobile.html#ttk','clipboard','ТТК'],
  ['catalog','./mobile.html#catalog','nigiri','Каталог'],
  ['pdf','./mobile.html#pdf','printer','PDF'],
  ['more','./mobile.html#more','cloudcheck','Ещё']
 ];
 nav.innerHTML=items.map(([key,href,icon,label])=>
  '<a href="'+href+'" data-ocean-nav="'+key+'" aria-label="'+label+'">'+
  '<svg class="ocean-ico-3d" viewBox="0 0 180 180" aria-hidden="true">'+
  '<use href="./ocean-3d-art.svg?v=3#'+icon+'"></use></svg><span>'+label+'</span></a>'
 ).join('');
 function setNavState(){
  const open=document.querySelector('.page:not([hidden])')?.dataset.view||'dashboard';
  const current=({dashboard:'home',editor:'ttk',library:'ttk',templates:'pdf',projects:'more',settings:'more'})[open]||'home';
  nav.querySelectorAll('[data-ocean-nav]').forEach(link=>{
   const selected=link.dataset.oceanNav===current;
   link.classList.toggle('active',selected);
   if(selected)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  });
 }
 document.querySelectorAll('.page[data-view]').forEach(page=>
  new MutationObserver(setNavState).observe(page,{attributes:true,attributeFilter:['hidden']})
 );
 setNavState();

 if(shell)shell.appendChild(nav);
 // Hide bottom navigation while the authentication form is visible.
 const show=()=>{if(nav)nav.hidden=!!(shell?.hidden)};
 if(shell){new MutationObserver(show).observe(shell,{attributes:true,attributeFilter:['hidden']});show();}
 // The existing navigation implementation updates nav-btn.active on selection.
 // Replacing branding does NOT change project/document data, editor or PDF styles.
 const sourceText=document.createElement('style');
 sourceText.textContent='.ocean-app .ocean-bottomnav[hidden]{display:none!important}';
 document.head.appendChild(sourceText);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
