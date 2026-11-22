/* MORE SUSHI STUDIO PRO · PEARL ROSE 8.2 workspace companion.
   This REPLACES the old OCEAN workspace decorator, not an additional theme.
   The real TTK editor, PDF/A4, Supabase, and nav logic remain in their original files. */
(function(){
  'use strict';
  if(!document.documentElement.classList.contains('ocean-app')) return;
  function mount(){
    // The studio's legacy theme switcher must not override the approved Pearl palette.
    // Keep user preferences in storage; only disable the competing DOM style selection.
    document.documentElement.removeAttribute('data-studio-theme');
    document.title='MORE SUSHI STUDIO PRO · PEARL ROSE ULTRA';
    const theme=document.querySelector('meta[name="theme-color"]');
    if(theme) theme.content='#fff4f7';
    // Keep one coherent brand: no giant blue whale, OCEAN label or 180px icons.
    for(const lockup of document.querySelectorAll('.brand-lockup')){
      const mark=lockup.querySelector('.brand-mark');
      if(mark){
        mark.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 33c11 0 15-8 19-17 7 3 9 9 12 15 7-10 12-13 19-12-3 15-12 20-23 24-8 3-13 8-16 14-1-13-5-18-11-24Z" fill="currentColor"/><path d="M8 51q14-6 25-2 12-7 23-3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
      }
      const subtitle=lockup.querySelector('.brand-sub');
      if(subtitle) subtitle.textContent='ПРОФЕССИОНАЛЬНАЯ СТУДИЯ ШЕФ-ПОВАРА';
    }
    const breadcrumb=document.querySelector('.breadcrumb');
    if(breadcrumb) breadcrumb.textContent='MORE SUSHI STUDIO PRO / PEARL ROSE';
    const origin='./mobile.html';
    if(!document.querySelector('.pearl-appbar')){
      const bar=document.createElement('div');
      bar.className='pearl-appbar';
      bar.innerHTML='<a class="pearl-appbar-back" href="'+origin+'" aria-label="Назад на главную">‹ <span>Главная</span></a>'+
        '<div class="pearl-appbar-title"><b>MORE SUSHI STUDIO PRO</b><small>Рабочая студия ТТК</small></div>'+
        '<button type="button" class="ocean-refresh-btn" data-ocean-refresh aria-label="Проверить обновления интерфейса"><span class="refresh-symbol" aria-hidden="true">↻</span> Обновить</button>';
      const auth=document.getElementById('auth');
      if(auth) auth.insertAdjacentElement('beforebegin',bar);
      else document.body.prepend(bar);
    }
    // The original page's side-nav drives real workspace views.
    // Do not duplicate it with the old, oversized Ocean bottom nav.
    document.querySelector('.ocean-bottomnav')?.remove();
    document.querySelector('.ocean-appbar')?.remove();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
