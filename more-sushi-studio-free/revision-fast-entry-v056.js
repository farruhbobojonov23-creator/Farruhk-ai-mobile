/* FARUKH REVISION PRO 0.5.6 — rapid mobile weighing without altering saved data.
 * One product per screen, explicit zero, next-field/next-product, and safe draft autosave.
 * Business calculations remain in revision.html; no changes to Supabase, Android or history.
 */
(()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const rows=byId('rows');
 const section=rows?.closest('section.card');
 const table=section?.querySelector('.tablewrap');
 if(!rows||!section||!table||typeof renderRows!=='function')return;
 const STORE_KEY='farukh-revision-quick-entry-v056';
 const labels={program:'Учёт Frontpad',raw:'На складе',pf:'Полуфабрикат'};
 const key=()=>byId('store').value+'|'+byId('mode').value;
 const allRows=()=>[...rows.querySelectorAll('tr[data-product]')];
 const canUseQuick=()=>!!rows.querySelector('.rev-product');
 const initial=()=>window.matchMedia?.('(max-width:720px)')?.matches===true;
 let quick=initial(),index=0,context=key(),saveTimer=0;
 try{const setting=localStorage.getItem(STORE_KEY);if(setting==='1'||setting==='0')quick=setting==='1'}catch{}
 const attr=(input,k)=>input?.dataset.field===k;
 const numberValue=value=>{
  if(value===undefined||value===null||String(value).trim()==='')return null;
  return number(String(value));
 };
 function valuesFor(name){
  const v=getDraft(name)||{};
  const program=numberValue(v.program),raw=numberValue(v.raw);
  const pf=numberValue(v.pf);
  const actual=weightOf(name,v);
  return {v,program,raw,pf,actual,valid:actual!==null&&(byId('mode').value==='start'||program!==null)};
 }
 function firstIssue(name){
  const data=valuesFor(name);
  if(byId('mode').value!=='start'&&data.program===null)return 'program';
  // A blank warehouse with a valid PF is supported by the stock calculation.
  if(data.actual===null){
   if(data.v.raw!==''&&data.raw===null)return 'raw';
   if(pfAllowed(name)&&data.v.pf!==''&&data.pf===null)return 'pf';
   return 'raw';
  }
  return null;
 }
 function firstUnfinished(){
  const products=state.products||[];
  const i=products.findIndex(name=>!valuesFor(name).valid);
  return i<0?Math.max(0,Math.min(index,products.length-1)):i;
 }
 function productNode(i){return allRows()[i]||null}
 function focusField(row,field){
  const fieldInput=row?.querySelector('input[data-field="'+field+'"]');
  if(!fieldInput)return;
  const adv=fieldInput.closest('.rev-advanced');if(adv)adv.open=true;
  fieldInput.focus({preventScroll:true});
  row.scrollIntoView({block:'start',behavior:'auto'});
 }
 function productFocus(row){
  const name=row?.dataset.product;
  const wanted=firstIssue(name)|| (byId('mode').value==='start'?'raw':'program');
  focusField(row,wanted);
 }
 function saveSnapshot(){
  clearTimeout(saveTimer);saveTimer=0;
  try{rev040Snapshot()}catch(error){console.warn('Revision draft not persisted',error)}
 }
 function scheduleSnapshot(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveSnapshot,180);
 }
 const switcher=document.createElement('div');switcher.className='rev056-switcher';
 switcher.id='rev056Switcher';
 switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Способ заполнения ревизии');
 switcher.innerHTML='<div class="rev056-switch-copy"><strong>Режим ввода</strong><small>Быстрый — по одному продукту. Список — все сразу.</small></div>'+
   '<div class="rev056-switch-buttons"><button type="button" class="btn" id="rev056Quick" aria-pressed="false">⚡ Быстрый</button>'+
   '<button type="button" class="btn" id="rev056All" aria-pressed="false">☷ Список</button></div>';
 section.querySelector('.toolbar')?.after(switcher);
 const nav=document.createElement('div');nav.id='rev056Nav';nav.className='rev056-nav';
 nav.innerHTML='<div class="rev056-nav-top"><strong id="rev056Current">Продукт</strong>'+
    '<span id="rev056Counter" aria-live="polite"></span></div>'+
    '<div class="rev056-nav-buttons">'+
    '<button type="button" class="btn" id="rev056Previous">← Назад</button>'+
    '<button type="button" class="btn" id="rev056Skip">Пропустить</button>'+
    '<button type="button" class="btn main" id="rev056Next">Следующий →</button></div>'+
    '<p id="rev056Notice" role="status" aria-live="polite"></p>';
 table.after(nav);
 function updateNav(){
  const products=state.products||[];
  index=Math.max(0,Math.min(index,Math.max(0,products.length-1)));
  document.body.classList.toggle('rev056-quick',quick && canUseQuick());
  byId('rev056Quick').setAttribute('aria-pressed',String(quick));
  byId('rev056All').setAttribute('aria-pressed',String(!quick));
  switcher.classList.toggle('rev056-no-items',products.length===0);
  nav.hidden=!quick||!products.length||!canUseQuick();
  if(nav.hidden)return;
  const current=products[index],currentData=valuesFor(current);
  byId('rev056Current').textContent=current;
  byId('rev056Counter').textContent=(index+1)+' из '+products.length;
  const count=products.reduce((n,name)=>n+(valuesFor(name).valid?1:0),0);
  const next=byId('rev056Next');
  next.textContent=index===products.length-1?'К результатам →':'Следующий →';
  byId('rev056Previous').disabled=index===0;
  byId('rev056Skip').hidden=products.length<=1;
  nav.classList.toggle('rev056-complete',count===products.length);
  nav.classList.toggle('rev056-current-done',currentData.valid);
  allRows().forEach((row,i)=>{
   row.classList.toggle('rev056-active',i===index);
   const details=row.querySelector('details.rev-product');
   if(quick&&details)details.open=i===index;
  });
 }
 function setIndex(i,{focus=false}={}){
  const length=(state.products||[]).length;
  if(!length)return;
  index=Math.min(length-1,Math.max(0,i));
  byId('rev056Notice').textContent='';
  updateNav();
  if(quick){
   const row=productNode(index);
   if(focus){productFocus(row)}
   else row?.scrollIntoView({block:'start',behavior:'auto'});
  }
 }
 function setMode(next){
  quick=next;
  try{localStorage.setItem(STORE_KEY,quick?'1':'0')}catch{}
  if(quick)index=firstUnfinished();
  updateNav();
  if(quick)productNode(index)?.scrollIntoView({block:'start',behavior:'auto'});
 }
 byId('rev056Quick').addEventListener('click',()=>setMode(true));
 byId('rev056All').addEventListener('click',()=>setMode(false));
 byId('rev056Previous').addEventListener('click',()=>setIndex(index-1,{focus:true}));
 byId('rev056Skip').addEventListener('click',()=>{
  if(index<(state.products||[]).length-1)setIndex(index+1,{focus:true});
  else{
   byId('rev056Notice').textContent='Проверь незаполненные позиции перед сохранением.';
   byId('rev054Final')?.scrollIntoView({block:'center',behavior:'smooth'});
  }
 });
 byId('rev056Next').addEventListener('click',()=>{
  const products=state.products||[];
  if(!products.length)return;
  const name=products[index],missing=firstIssue(name);
  if(missing){
   const title=labels[missing]||'вес';
   byId('rev056Notice').textContent='Заполни «'+title+'» для «'+name+'». Если вес равен нулю — нажми «0».';
   focusField(productNode(index),missing);
   return;
  }
  saveSnapshot();
  if(index<products.length-1)setIndex(index+1,{focus:true});
  else{
   byId('rev054Final')?.scrollIntoView({block:'center',behavior:'smooth'});
  }
 });
 function enhanceRows(){
  const currentKey=key();
  if(currentKey!==context){
   context=currentKey;
   index=firstUnfinished();
  }
  for(const row of allRows()){
   for(const field of row.querySelectorAll('.rev-field')){
    const input=field.querySelector('input[data-field]');
    if(!input||!['program','raw','pf'].includes(input.dataset.field))continue;
    input.setAttribute('enterkeyhint','next');
    input.setAttribute('autocomplete','off');
    if(field.querySelector('.rev056-zero'))continue;
    const zero=document.createElement('button');
    zero.type='button';zero.className='rev056-zero';zero.textContent='0';
    zero.setAttribute('aria-label','Указать 0 кг: '+(labels[input.dataset.field]||'Остаток')+' — '+row.dataset.product);
    input.after(zero);
    zero.addEventListener('click',()=>{
      input.value='0';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      if(quick){
       const fields=[...row.querySelectorAll('input[data-field]')].filter(x=>['program','raw','pf'].includes(x.dataset.field));
       const next=fields[fields.indexOf(input)+1];
       if(next){next.focus({preventScroll:true});next.scrollIntoView({block:'center',behavior:'auto'})}
       else input.blur();
      }
    });
   }
  }
  updateNav();
 }
 const oldRenderRows=renderRows;
 renderRows=function(){
  oldRenderRows();
  enhanceRows();
 };
 rows.addEventListener('input',()=>{
  scheduleSnapshot();
  updateNav();
 });
 rows.addEventListener('change',saveSnapshot);
 rows.addEventListener('keydown',event=>{
  if(!quick||event.key!=='Enter'||!event.target?.matches('input[data-field]'))return;
  event.preventDefault();
  const row=event.target.closest('tr[data-product]');
  if(!row)return;
  const fields=[...row.querySelectorAll('input[data-field]')].filter(x=>['program','raw','pf'].includes(x.dataset.field));
  const j=fields.indexOf(event.target);
  if(j>=0&&j<fields.length-1){
   fields[j+1].focus({preventScroll:true});
   fields[j+1].scrollIntoView({block:'center',behavior:'auto'});
  }else byId('rev056Next')?.click();
 });
 // Keep shortcut UI consistent after navigation, including when the cloud refreshes the product list.
 const oldGo=go;
 go=function(view,button){
  const result=oldGo(view,button);
  if(view==='revision')updateNav();
  return result;
 };
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')saveSnapshot();
 });
 window.addEventListener('pagehide',saveSnapshot);
 enhanceRows();
 // Version shown in the existing information button; never report a native APK release.
 showRevisionInfo=function(){notice('FARUKH REVISION PRO · веб-интерфейс 0.5.6. Быстрый ввод по продуктам, явный ноль, сохранение черновика после ввода. APK не переустанавливается.');};
})();
