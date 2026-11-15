/* FARRUH AI Premium · DIRECT A4 editing.
 * Tapping a field focuses its REAL inline input, without dialog/overlay.
 * All inputs continue to update the canonical recipe. The sheet is still a
 * fixed 794×1123 A4; "Увеличить" changes only the editing viewport zoom.
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
 zoom.textContent='＋ Увеличить';
 zoom.setAttribute('aria-pressed','false');
 zoom.setAttribute('aria-label','Увеличить лист А4 для заполнения непосредственно в шаблоне');
 const quickNav=stage.querySelector('.ttk-onepage-topbar');
 quickNav?.insertBefore(zoom,quickNav.querySelector('.ttk-onepage-full-form'));
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
  mark.textContent=n>5?'+ '+(n-5)+' ингредиентов — увеличь лист и прокрути таблицу':'';
  page.querySelectorAll('.ttk-live-ingredient-row').forEach((row,i)=>{
   row.hidden=!editing&&i>=5;
  });
 }
 function setEditing(value,focusTarget){
  editing=Boolean(value);
  stage.classList.toggle('ttk-direct-editing',editing);
  zoom.textContent=editing?'− Весь лист':'＋ Увеличить';
  zoom.setAttribute('aria-pressed',String(editing));
  ingredientNote();fit();
  if(focusTarget&&editing){
   requestAnimationFrame(()=>{
    if(focusTarget.isConnected)focusTarget.scrollIntoView({behavior:'instant',block:'nearest',inline:'center'});
   });
  }
 }
 zoom.addEventListener('click',()=>setEditing(!editing));
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
  const available=stage.clientHeight-bar-chooser-controls-30;
  const spare=Math.max(160,Math.min(window.innerHeight-(mobile?155:135),available));
  const ratio=Math.max(.20,Math.min(1,width/794,spare/1123));
  lastRatio=ratio;
  const target=editing&&mobile?Math.max(.76,ratio):ratio;
  page.style.setProperty('--ttk-onepage-zoom',String(target));
  page.dataset.ttkScale=target.toFixed(3);
  page.setAttribute('aria-description',editing?
    'Пиши в поля непосредственно на листе А4. Прокручивай увеличенный лист пальцем.':
    'Лист А4 в масштабе '+Math.round(ratio*100)+' %. Нажми на поле для ввода.');
 }
 function scheduleFit(){clearTimeout(timer);timer=setTimeout(fit,60);}
 function focusFirstIn(panel){
  const target=panel.querySelector(directSelector);
  if(target&&target.getAttribute('aria-disabled')!=='true'&&!target.disabled){
   setEditing(true,target);target.focus({preventScroll:true});return true;
  }
  return false;
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
   ingredientNote();scheduleFit();
   return value;
  };
 }
 wrapRefresh('refresh');wrapRefresh('refreshComputed');
 function setVisible(value){
  visible=Boolean(value);
  if(visible){live.refresh();scheduleFit();}
  else setEditing(false);
 }
 window.addEventListener('resize',scheduleFit,{passive:true});
 if('ResizeObserver' in window){
  observer=new ResizeObserver(scheduleFit);observer.observe(stage);
 }
 ingredientNote();
 return {dialog:null,fit,scheduleFit,setVisible,setEditing,openSection(index){
  const names=['.ttk-live-title','.ttk-live-name','.ttk-live-meta','.ttk-live-scope',
   '.ttk-live-raw','.ttk-live-formula','.ttk-live-allergens','.ttk-live-process',
   '.ttk-live-quality','.ttk-live-conditions','.ttk-live-nutrition',
   '.ttk-live-safety','.ttk-live-signatures'];
  return focusFirstIn(page.querySelector(names[index])||page);
 }};
}
