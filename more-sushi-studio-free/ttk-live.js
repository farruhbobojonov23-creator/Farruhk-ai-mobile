(function(){
'use strict';
const g=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode=false,style=null,toolbar=null,fitTimer=null;
function notice(s){const t=g('ttkNotice');if(t)t.textContent=s;}
function addStyle(){
 if(style)return;
 let rules=[];
 for(const sh of document.styleSheets){
  let arr;try{arr=sh.cssRules}catch{continue}
  for(const r of arr)if(r.type===4&&/print/.test(r.conditionText))
   for(const a of r.cssRules)if(a.type===1&&a.selectorText)
    rules.push(a.selectorText.split(',').map(t=>'body.ttk-live '+t.trim()).join(',')+'{'+a.style.cssText+'}');
 }
 style=document.createElement('style');
 style.textContent=rules.join('\n')+
 'body.ttk-live{background:#e8f0f7!important}body.ttk-live .side,body.ttk-live .top,body.ttk-live .screen-only{display:none!important}'+
 'body.ttk-live #app,body.ttk-live .wrap,body.ttk-live .main{display:block!important;padding:0!important;max-width:none!important}'+
 'body.ttk-live #printSheet{display:block!important;width:210mm!important;height:297mm!important;min-height:297mm!important;max-height:297mm!important;overflow:hidden!important;position:relative!important;margin:74px auto 26px!important;box-shadow:0 8px 25px #2346643b!important;background:#fff!important}'+
 'body.ttk-live #printSheet [contenteditable=true]{outline:none;cursor:text;border-bottom:1px dashed #5e99ca}body.ttk-live #printSheet [contenteditable=true]:focus{background:#fff2c9!important}'+
 'body.ttk-live #printSheet select,body.ttk-live #printSheet input{font:inherit;color:#173859;max-width:100%;background:transparent;border:1px dashed #b4c9d7}'+
 '#ttkTopbar{position:fixed;z-index:500;top:0;left:0;right:0;background:#103959;color:#fff;display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:10px 15px;font:13px Arial;box-shadow:0 2px 10px #17395955}'+
 '#ttkTopbar b{font-size:16px;margin-right:auto}#ttkTopbar button{background:#dbeefc;color:#114872;padding:9px 11px;border:0;border-radius:7px;cursor:pointer}#ttkTopbar button.primary{background:#218bce;color:white}#ttkTopbar span{font-size:11px;color:#bbdbef}'+
 '.ttk-del{font-size:11px;color:#ba263c!important;padding:0 3px!important;background:transparent!important;border:0!important;cursor:pointer}'+
 '@media print{#ttkTopbar,.ttk-del{display:none!important}body.ttk-live #printSheet{margin:0!important;box-shadow:none!important;height:297mm!important;max-height:297mm!important;overflow:hidden!important}body.ttk-live #printSheet [contenteditable=true]{border:0!important;background:transparent!important}body.ttk-live #printSheet input,body.ttk-live #printSheet select{appearance:none!important;-webkit-appearance:none!important;border:0!important;background:transparent!important}}';
 document.head.appendChild(style);
}
function link(el,id){
 if(!el)return;
 el.contentEditable='true';el.spellcheck=false;
 el.addEventListener('input',()=>{
  if(g(id))g(id).value=el.innerText;
  notice('Есть изменения. Нажмите «Сохранить».');scheduleFit();
 });
}
function wrap(el,id,label){
 if(!el)return;
 const value=g(id)?.value||'';
 el.innerHTML=(label||'')+'<span class="ttk-data"></span>';
 const span=el.querySelector('span');span.textContent=value;link(span,id);
}
function optionList(selected){
 let o='<option value="">Выберите…</option>';
 for(const i of ingredients)o+='<option value="i'+i.id+'" '+(selected==='i'+i.id?'selected':'')+'>'+esc(i.name)+'</option>';
 for(const p of recipes.filter(x=>x.kind==='prefab'&&x.id!==editing?.id))o+='<option value="p'+p.id+'" '+(selected==='p'+p.id?'selected':'')+'>ПФ · '+esc(p.name)+'</option>';
 return o;
}
function lines(){
 const tab=g('printSheet')?.querySelectorAll('.psection')[2]?.querySelector('table');
 if(!tab)return;
 const rows=Array.from(tab.querySelectorAll('tr')).filter(tr=>tr.querySelectorAll('td').length>=4);
 rows.forEach((tr,i)=>{
  if(i>=components.length)return;
  const c=components[i],td=tr.querySelectorAll('td');
  const v=(c.source_type==='prefab'?'p':'i')+c.source_id;
  td[1].innerHTML='<select aria-label="Ингредиент">'+optionList(v)+'</select><button class="ttk-del" title="Удалить строку">×</button>';
  td[1].querySelector('select').addEventListener('change',e=>{const x=e.target.value;if(!x)return;c.source_type=x[0]==='p'?'prefab':'ingredient';c.source_id=Number(x.slice(1));notice('Состав изменён. Сохраните.')});
  td[1].querySelector('button').addEventListener('click',()=>{components.splice(i,1);render()});
  for(const [column,key] of [[2,'gross_g'],[3,'net_g']]){
   td[column].innerHTML='<input aria-label="'+(column===2?'Брутто':'Нетто')+'" type="number" min="0" step="0.1" style="width:48px;text-align:right" value="'+esc(c[key])+'">';
   td[column].querySelector('input').addEventListener('input',e=>{c[key]=Number(e.target.value||0);notice('Граммовка изменена. Сохраните.');scheduleFit()});
  }
 });
}
function edit(){
 const sh=g('printSheet');if(!sh)return;
 const secs=Array.from(sh.querySelectorAll('.psection'));
 [['rScope',0],['rRaw',1],['rProcess',3],['rServing',4],['rQuality',5],['rNutrition',6]].forEach(([id,i])=>link(secs[i]?.querySelector('.ptext'),id));
 const nrow=secs[6]?.querySelectorAll('table.nutrition tbody tr td');
 if(nrow&&nrow.length===4){
  const putNutrition=()=>{
   const v=Array.from(nrow).map(x=>x.innerText.trim());
   g('rNutrition').value='По образцу, не проверено. На порцию: белки — '+v[0]+' г; жиры — '+v[1]+' г; углеводы — '+v[2]+' г; энергетическая ценность — '+v[3]+' ккал.';
   notice('КБЖУ изменено. Сохраните.');
  };
  nrow.forEach(cell=>{cell.contentEditable='true';cell.spellcheck=false;cell.addEventListener('input',()=>{putNutrition();scheduleFit()})});
 }
 const h=sh.querySelector('h1');
 if(h){
  h.innerHTML='<span id="ttkCode"></span> · <span id="ttkName"></span>';
  g('ttkCode').textContent=g('rCode').value;g('ttkName').textContent=g('rName').value;
  link(g('ttkCode'),'rCode');link(g('ttkName'),'rName');
 }
 const facts=Array.from(sh.querySelectorAll('.pfact'));
 wrap(facts[0]?.querySelector('span'),'rCategory','');
 const stat=facts[1]?.querySelector('span');
 if(stat){
  stat.innerHTML='<select aria-label="Статус"><option>Черновик</option><option>Тест</option><option>Утверждено</option><option>Архив</option></select>';
  const s=stat.querySelector('select');s.value=g('rStatus').value;s.addEventListener('change',()=>{g('rStatus').value=s.value;notice('Статус изменён. Сохраните.')});
 }
 const out=facts[2]?.querySelector('span');
 if(out){
  out.innerHTML='<input type="number" aria-label="Выход" min="0" step="0.1" style="width:60px"> г';
  const x=out.querySelector('input');x.value=g('rYield').value;
  x.addEventListener('input',()=>{g('rYield').value=x.value;notice('Выход изменён. Сохраните.')});
 }
 wrap(secs[4]?.querySelector('p'),'rStorage','<b>Условия и срок хранения:</b> ');
 wrap(secs[5]?.querySelector('.pnote'),'rAllergens','<b>Аллергены:</b> ');
 const signs=sh.querySelectorAll('.psign');
 for(const [el,id,title] of [[signs[0],'rDeveloped','Разработал:'],[signs[1],'rApproved','Утвердил:']]){if(!el)continue;el.innerHTML='<b>'+title+'</b> <span class="ttk-data"></span><div class="psign__line"></div><small>Ф.И.О., подпись</small>';const sp=el.querySelector('span');sp.textContent=g(id)?.value||'';link(sp,id)}
 const ver=sh.querySelector('.pversion');
 if(ver){ver.innerHTML='Версия '+esc(editing?.version||1)+'<br>Дата: <span id="ttkDate"></span>';g('ttkDate').textContent=g('rApprovedDate')?.value||'';link(g('ttkDate'),'rApprovedDate')}
 const pic=sh.querySelector('.pimage');
 if(pic){pic.style.cursor='pointer';pic.title='Нажмите, чтобы добавить фотографию';pic.addEventListener('click',()=>g('photoFile')?.click())}
 lines();
 const grid=sh.querySelector('.pgrid'),app=sh.querySelector('.papproval'),foot=sh.querySelector('.pfooterwave');
 if(grid&&!g('ttkFit')){
  const area=document.createElement('div');area.id='ttkFit';area.style.transformOrigin='top left';area.style.width='100%';
  grid.before(area);area.appendChild(grid);if(app)area.appendChild(app);if(foot)area.appendChild(foot);
 }
 scheduleFit();
}
function render(){
 const original=window.print;window.print=function(){};
 try{printRecipe()}finally{window.print=original}
 edit();
}
function scheduleFit(){clearTimeout(fitTimer);fitTimer=setTimeout(fit,100)}
function fit(){
 const sheet=g('printSheet'),area=g('ttkFit');if(!sheet||!area)return;
 const allowed=1123-area.offsetTop-26;let f=1;
 for(let i=0;i<45;i++){
  area.style.width=100/f+'%';area.style.transform='scale('+f+')';
  if(area.scrollHeight*f<=allowed+1)break;
  if(f<=.50)break;
  f*=.95;
 }
 if(area.scrollHeight*f>allowed+1){notice('Текст не помещается на один А4 без обрезки. Сократите формулировки.');return false;}
 if(f<.65)notice('Внимание: мелкий текст ('+Math.round(f*100)+'%). Проверьте читаемость.');
 return true;
}
function toolbarInit(){
 if(toolbar)return;
 toolbar=document.createElement('div');toolbar.id='ttkTopbar';
 toolbar.innerHTML='<b>🌊 Море Суши · цветная ТТК А4</b><button class="primary" id="ttkSave">Сохранить</button><button id="ttkAdd">+ Строка</button><button id="ttkPrint">Печать / PDF</button><button id="ttkBack">Назад</button><span id="ttkNotice">Редактируйте на листе</span>';
 document.body.appendChild(toolbar);
 g('ttkSave').addEventListener('click',async()=>{await saveRecipe();render();notice(g('saveInfo')?.innerText||'Сохранение завершено')});
 g('ttkAdd').addEventListener('click',()=>{components.push({source_type:'ingredient',source_id:ingredients[0]?.id||0,gross_g:0,net_g:0});render();notice('Строка добавлена. Сохраните.')});
 g('ttkPrint').addEventListener('click',()=>{if(fit())window.print();else alert('Чтобы ТТК была строго на одном листе А4 без обрезки, сократите слишком длинный текст.');});
 g('ttkBack').addEventListener('click',()=>{mode=false;document.body.classList.remove('ttk-live');toolbar.remove();toolbar=null;style?.remove();style=null;switchPage(currentKind)});
}
g('photoFile')?.addEventListener('change',async()=>{if(!mode)return;try{await uploadPhoto();render();notice('Фотография обновлена. Нажмите «Сохранить».')}catch(e){notice('Ошибка фото: '+e.message)}});
window.openTTK=function(){
 if(!editing){alert('Сначала сохраните новую карточку товара.');return}
 mode=true;addStyle();document.body.classList.add('ttk-live');toolbarInit();render();
};
})();
