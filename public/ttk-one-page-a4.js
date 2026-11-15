import {mountTtkGeneralSettings} from './ttk-general-settings.js?v=2';
/* FARRUH AI Premium · DIRECT A4 editing.
 * Tapping a field focuses its REAL inline input, without dialog/overlay.
 * All inputs continue to update the canonical recipe. The sheet is still a
 * fixed 794×1123 A4 when printed. Editing expands THAT SAME DOM fluidly
 * to reveal all text, while save/PDF keep the original recipe and A4 format.
 */
export function mountOnePageA4(editor,stage,live){
 if(!editor||!stage||!live?.page)throw Error('Не удалось открыть редактор ТТК А4.');
 stage.classList.add('ttk-onepage-enabled','ttk-direct-a4');
 const page=live.page,shell=live.shell;
 const actions=shell.querySelector('.ttk-live-actions');
 if(actions)shell.prepend(actions);
 const sourceIngredients=editor.querySelector('#ingredients');
 let visible=false,editing=false,timer=null,observer=null,lastRatio=.35;
 const zoom=document.createElement('button');
 zoom.className='ttk-onepage-zoom';
 zoom.type='button';
 zoom.textContent='✎ Читать и заполнять';
 zoom.setAttribute('aria-pressed','false');
 zoom.setAttribute('aria-label','Показать весь текст и редактировать прямо на технологической карте');
 const quickNav=stage.querySelector('.ttk-onepage-topbar');
 quickNav?.insertBefore(zoom,quickNav.querySelector('.ttk-onepage-full-form'));
 const settings=mountTtkGeneralSettings(editor,stage,quickNav);
 const notice=document.createElement('button');
 notice.type='button';notice.className='ttk-visibility-notice';
 notice.textContent='🔍 Читать и заполнять весь текст ТТК';
 notice.setAttribute('aria-label','Раскрыть весь текст технологической карты без всплывающего окна');
 const settingsMenu=stage.querySelector('.ttk-settings-access-row');
 if(settingsMenu)settingsMenu.after(notice);
 else stage.querySelector('.ttk-onepage-topbar')?.after(notice);
 notice.addEventListener('click',()=>setEditing(true));
 const mark=document.createElement('div');
 mark.className='ttk-onepage-overflow-marker';
 mark.setAttribute('aria-live','polite');
 page.querySelector('.ttk-live-ingredient-rows')?.after(mark);
 const directSelector='.ttk-live-control:not([readonly]),'+
  '.ttk-live-ingredient-input:not([readonly]),'+
  '[contenteditable="plaintext-only"],[contenteditable="true"],'+
  '.ttk-live-add,.ttk-live-remove,.ttk-live-allergen-box[role="checkbox"]';
 function ingredientNote(){
  const n=sourceIngredients?.querySelectorAll('.ingredient').length||0;
  mark.textContent=n>5&&!editing?'+ '+(n-5)+' ингредиентов — открыть полностью через «Читать и заполнять»':'';
  page.querySelectorAll('.ttk-live-ingredient-row').forEach((row,i)=>{
   row.hidden=!editing&&i>=5;
  });
 }
 let warningTimer=null,growTimer=null;
 function syncGrowingText(){
  if(!editing)return;
  requestAnimationFrame(autogrow);
  // The canonical form has a 240 ms deferred value synchronization.
  // One animation frame is too early and leaves the newest text clipped.
  clearTimeout(growTimer);
  growTimer=setTimeout(autogrow,340);
 }
 function autogrow(){
  if(!editing)return;
  for(const ta of page.querySelectorAll('textarea.ttk-live-control')){
   const visible=ta.getBoundingClientRect();
   if(visible.width<2||visible.height<2)continue;
   // Canonical fields can be filled programmatically immediately before the
   // 240ms deferred refresh. Read the newest value BEFORE measuring height.
   const id=ta.dataset.source;
   const source=id?editor.querySelector('#'+id):null;
   if(source&&document.activeElement!==ta&&ta.value!==source.value)
    ta.value=source.value;
   ta.style.removeProperty('height');
   const height=Math.max(ta.dataset.source==='recipe-name'?70:112,ta.scrollHeight+8);
   ta.style.setProperty('height',String(height)+'px','important');
  }
 }
 function auditClipped(){
  if(!visible||editing)return;
  const targets=[...page.querySelectorAll('.ttk-live-intro-pair textarea,.ttk-live-safety textarea,'+
   '.ttk-ref-stage-body,.ttk-ref-info-row>span,.ttk-ref-haccp-card>span')];
  const count=targets.filter(el=>{
   const style=getComputedStyle(el),txt=(el.value||el.textContent||'').trim();
   return txt.length>18&&style.display!=='none'&&
    el.scrollHeight>el.clientHeight+3&&el.clientHeight>0;
  }).length;
  const n=sourceIngredients?.querySelectorAll('.ingredient').length||0;
  notice.textContent=count||n>5?
   '⚠ Часть текста не помещается на миниатюре · нажмите, чтобы прочитать всё':
   '🔍 Читать и заполнять весь текст ТТК';
  notice.dataset.overflowCount=String(count+(n>5?n-5:0));
 }
 function scheduleWarning(){
  clearTimeout(warningTimer);
  warningTimer=setTimeout(auditClipped,90);
 }
 function setEditing(value,focusTarget){
  const next=Boolean(value);
  if(editing===next){
   if(editing&&focusTarget?.isConnected)focusTarget.scrollIntoView({behavior:'instant',block:'nearest'});
   return;
  }
  editing=next;
  stage.classList.toggle('ttk-direct-editing',editing);
  zoom.textContent=editing?'✓ Весь лист А4':'✎ Читать и заполнять';
  zoom.setAttribute('aria-pressed',String(editing));
  notice.hidden=editing;
  if(!editing){
   for(const ta of page.querySelectorAll('textarea.ttk-live-control'))
    ta.style.removeProperty('height');
  }
  ingredientNote();fit();
  if(editing){
   requestAnimationFrame(()=>{
    autogrow();
    if(focusTarget?.isConnected)focusTarget.scrollIntoView({behavior:'instant',block:'nearest'});
   });
   syncGrowingText();
  }else{
   stage.scrollTop=0;
   scheduleWarning();
  }
 }
 zoom.addEventListener('click',()=>setEditing(!editing));
 page.addEventListener('input',event=>{
  if(editing&&event.target.matches('textarea.ttk-live-control'))
   syncGrowingText();
 });
 stage.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&editing&&event.target.tagName!=='TEXTAREA'){
   setEditing(false);zoom.focus();
  }
 });
 function fit(){
  if(!visible||editor.hidden||!stage.isConnected)return;
  const rect=stage.getBoundingClientRect();
  const stageStyle=getComputedStyle(stage);
  const padding=(parseFloat(stageStyle.paddingLeft)||0)+(parseFloat(stageStyle.paddingRight)||0);
  const width=Math.max(190,rect.width-padding-2);
  const mobile=window.innerWidth<=760;
  const chooser=stage.querySelector('#ttk-design-picker')?.getBoundingClientRect().height||44;
  const controls=stage.querySelector('.ttk-live-actions')?.getBoundingClientRect().height||38;
  const bar=stage.querySelector('.ttk-onepage-topbar')?.getBoundingClientRect().height||35;
  const settingsHeight=stage.querySelector('.ttk-settings-access-row')?.getBoundingClientRect().height||0;
  const noticeHeight=notice.hidden?0:notice.getBoundingClientRect().height||0;
  const available=stage.clientHeight-bar-chooser-controls-settingsHeight-noticeHeight-37;
  const spare=Math.max(160,Math.min(window.innerHeight-(mobile?155:135),available));
  const ratio=Math.max(.20,Math.min(1,width/794,spare/1123));
  lastRatio=ratio;
  const target=editing?1:ratio;
  page.style.setProperty('--ttk-onepage-zoom',String(target));
  page.dataset.ttkScale=target.toFixed(3);
  page.setAttribute('aria-description',editing?
    'Читаемый режим: весь текст прямо на листе, без обрезки и всплывающих окон.':
    'Обзор одного листа А4, масштаб '+Math.round(ratio*100)+' %. Чтобы прочитать всё, нажми «Читать и заполнять».');
 }
 function scheduleFit(){clearTimeout(timer);timer=setTimeout(fit,60);}
 function focusFirstIn(panel){
  if(!panel)return false;
  setEditing(true);
  // The compact print layout keeps several source textareas hidden.
  // Never focus those invisible nodes; prefer the visible on-sheet cells.
  const targets=[...panel.querySelectorAll(directSelector)];
  const target=targets.find(el=>{
   if(el.disabled||el.getAttribute('aria-disabled')==='true')return false;
   const r=el.getBoundingClientRect();
   return r.width>=3&&r.height>=3&&getComputedStyle(el).visibility!=='hidden';
  });
  if(!target)return false;
  target.focus({preventScroll:true});
  requestAnimationFrame(()=>{
   autogrow();
   if(target.isConnected)target.scrollIntoView({behavior:'instant',block:'nearest'});
  });
  return true;
 }
 // Clicking on any readable line edits the in-place HTML field, instead of
 // bringing up a bottom modal that hides the TTK from view.
 page.addEventListener('click',event=>{
  if(event.target.closest('button,input,select,textarea,[contenteditable],a'))return;
  const panel=event.target.closest('.ttk-live-name,.ttk-live-title,.ttk-live-meta,'+
   '.ttk-live-section,.ttk-live-signatures');
  if(panel){
   if(panel.classList.contains('ttk-live-allergens'))return;
   focusFirstIn(panel);
  }
 });
 page.addEventListener('focusin',event=>{
  const target=event.target;
  if(target.matches('input,textarea,select,[contenteditable]')){
   setEditing(true,target);
  }
 });
 page.querySelector('.ttk-live-name-sample')?.addEventListener('click',event=>{
  event.preventDefault();
  focusFirstIn(page.querySelector('.ttk-live-name'));
 });
 function wrapRefresh(method){
  const prior=live[method];
  live[method]=(...args)=>{
   const value=prior(...args);
   ingredientNote();scheduleFit();scheduleWarning();
   if(editing)syncGrowingText();
   return value;
  };
 }
 wrapRefresh('refresh');wrapRefresh('refreshComputed');
 function setVisible(value){
  visible=Boolean(value);
  if(visible){live.refresh();scheduleFit();scheduleWarning();}
  else{setEditing(false);clearTimeout(growTimer);}
 }
 window.addEventListener('resize',scheduleFit,{passive:true});
 if('ResizeObserver' in window){
  observer=new ResizeObserver(()=>{
   if(!editing)scheduleFit();
  });observer.observe(stage);
 }
 ingredientNote();
 return {dialog:null,settings,fit,scheduleFit,setVisible,setEditing,autogrow,auditClipped,openSection(index){
  const names=['.ttk-live-title','.ttk-live-name','.ttk-live-meta','.ttk-live-scope',
   '.ttk-live-raw','.ttk-live-formula','.ttk-live-allergens','.ttk-live-process',
   '.ttk-live-quality','.ttk-live-conditions','.ttk-live-nutrition',
   '.ttk-live-safety','.ttk-live-signatures'];
  return focusFirstIn(page.querySelector(names[index])||page);
 }};
}
