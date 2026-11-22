/* MORE SUSHI · OCEAN 4.0.1
   Lock only the home dashboard (no vertical scrolling).
   Fit live controls above the fixed dock instead of clipping them.
   Other pages scroll normally; no touch handlers intercept button clicks.
 */
(function(){
 'use strict';
 const root=document.documentElement;
 const nav=document.querySelector('.bottomnav');
 const hero=document.querySelector('.wrap>.hero');
 const cloud=document.querySelector('.wrap>.cloudbar');
 const metrics=document.querySelector('.wrap>.metrics');
 const metric=metrics?.querySelector('.metric');
 const heading=document.querySelector('[data-mss-panel="home"] .mss-heading');
 const grid=document.querySelector('[data-mss-panel="home"] .mss-feature-grid');
 const quick=document.querySelector('[data-mss-panel="home"] .mss-quick');
 const wave=document.querySelector('.approved-water-band');
 const viewportVariables=[
  '--ocean-home-viewport','--ocean-home-hero','--ocean-home-hero-gap',
  '--ocean-home-cloud-gap','--ocean-home-metrics-gap',
  '--ocean-home-metric-height','--ocean-home-heading-gap',
  '--ocean-home-card-row','--ocean-home-quick-gap',
  '--ocean-home-quick-height','--ocean-home-wave-gap',
  '--ocean-home-wave-height'
 ];
 if(!nav||!hero||!cloud||!metrics||!metric||!heading||!grid||!quick||!wave)return;
 let scheduled=false;
 let lastTab='';
 const pixels=n=>Math.max(0,Math.round(n*10)/10)+'px';
 const number=n=>Number.isFinite(n)?n:0;
 const height=el=>number(el.getBoundingClientRect().height);
 const margin=(el,side)=>number(parseFloat(getComputedStyle(el)[side]));
 const set=(name,value)=>root.style.setProperty(name,pixels(value));
 function clear(){
  root.classList.remove('ocean-home-locked','ocean-home-fit');
  root.removeAttribute('data-ocean-home-fit');
  viewportVariables.forEach(key=>root.style.removeProperty(key));
 }
 function shrink(state,key,min,needed,weight=1){
  const value=state[key],floor=Math.min(min,value);
  const removable=Math.max(0,(value-floor)*weight);
  const use=Math.min(removable,needed);
  state[key]=Math.max(floor,value-use/weight);
  return needed-use;
 }
 function fit(){
  scheduled=false;
  if(root.dataset.mssTab!=='home'){
   clear();
   lastTab=root.dataset.mssTab||'';
   return;
  }
  if(lastTab!=='home')window.scrollTo({top:0,left:0,behavior:'instant'});
  lastTab='home';
  // Measure the unmodified approved design before calculating necessary changes.
  clear();
  const navTop=nav.getBoundingClientRect().top;
  const available=navTop-8;
  const rowGap=number(parseFloat(getComputedStyle(grid).rowGap));
  const state={
   hero:height(hero),
   heroGap:margin(hero,'marginBottom'),
   cloudGap:margin(cloud,'marginBottom'),
   metricsGap:margin(metrics,'marginBottom'),
   metric:height(metric),
   headingGap:margin(heading,'marginBottom'),
   row:(height(grid)-rowGap)/2,
   quickGap:margin(quick,'marginTop'),
   quick:height(quick),
   waveGap:margin(wave,'marginTop'),
   wave:height(wave)
  };
  if(!state.hero||!state.row||!Number.isFinite(available))return;
  let needed=Math.max(0,wave.getBoundingClientRect().bottom-available);
  if(needed>0){
   // Remove decoration and large gaps before reducing essential interactive areas.
   needed=shrink(state,'wave',0,needed);
   needed=shrink(state,'waveGap',0,needed);
   needed=shrink(state,'heroGap',5,needed);
   needed=shrink(state,'cloudGap',4,needed);
   needed=shrink(state,'metricsGap',4,needed);
   needed=shrink(state,'headingGap',5,needed);
   needed=shrink(state,'quickGap',5,needed);
   // Grid occupies two rows, so every px saved there frees two in the layout.
   needed=shrink(state,'row',Math.max(74,state.row*0.86),needed,2);
   needed=shrink(state,'metric',Math.max(59,state.metric*0.86),needed);
   needed=shrink(state,'hero',Math.max(158,state.hero*0.87),needed);
   needed=shrink(state,'quick',Math.max(49,state.quick*0.90),needed);
  }
  set('--ocean-home-viewport',navTop);
  set('--ocean-home-hero',state.hero);
  set('--ocean-home-hero-gap',state.heroGap);
  set('--ocean-home-cloud-gap',state.cloudGap);
  set('--ocean-home-metrics-gap',state.metricsGap);
  set('--ocean-home-metric-height',state.metric);
  set('--ocean-home-heading-gap',state.headingGap);
  set('--ocean-home-card-row',state.row);
  set('--ocean-home-quick-gap',state.quickGap);
  set('--ocean-home-quick-height',state.quick);
  set('--ocean-home-wave-gap',state.waveGap);
  set('--ocean-home-wave-height',state.wave);
  root.classList.add('ocean-home-fit');
  const fits=wave.getBoundingClientRect().bottom<=nav.getBoundingClientRect().top-3;
  if(fits){
   root.classList.add('ocean-home-locked');
   root.dataset.oceanHomeFit='locked';
   if(window.scrollY)window.scrollTo({top:0,left:0,behavior:'instant'});
  }else{
   // Very short screens / large text: never conceal buttons beneath the dock.
   // Preserve scrolling for accessibility rather than silently clipping a CTA.
   clear();
   root.dataset.oceanHomeFit='accessible-scroll';
  }
 }
 function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(fit);
 }
 new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-mss-tab']});
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('orientationchange',schedule,{passive:true});
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('pageshow',schedule);
 window.addEventListener('hashchange',schedule);
 if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
 else schedule();
 window.addEventListener('load',schedule,{once:true});
})();
