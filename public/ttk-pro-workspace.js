/* FARRUH AI · Premium PRO TTK editor — trial UI.
   The existing TTK form, storage, and A4 PDF export are authoritative.
   These controls never mark a document as legally approved or change its data. */
const node=(tag,cls,text)=>{
 const el=document.createElement(tag);if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;return el;
};
const str=v=>String(v??'').trim();
const readyNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0;
const completeNutrition=n=>['protein','fat','carbs','kcal'].every(k=>
 n?.[k]!==undefined&&n?.[k]!==null&&n?.[k]!==''&&Number.isFinite(Number(n[k])));
const formatPercent=n=>Math.max(0,Math.min(100,Math.round(n)));
/** Completeness of entered fields, NOT compliance or food-safety approval. */
export function auditTtkDraft(r={}){
 const ingredients=Array.isArray(r.ingredients)?r.ingredients:[];
 const validIngredients=ingredients.length>0&&ingredients.every(i=>
   str(i.name)&&readyNumber(i.grams)&&readyNumber(i.grossGrams)&&Number(i.grossGrams)>=Number(i.grams));
 const checks=[
  ['name','Название блюда',!!str(r.name),'recipe-name'],
  ['category','Категория и номер ТТК',!!str(r.category)&&!!str(r.cardNumber),'card-number'],
  ['date','Дата документа',!!str(r.cardDate),'card-date'],
  ['ingredients','Ингредиенты, брутто и нетто',validIngredients,'ingredients'],
  ['yield','Выход готового блюда',readyNumber(r.netYieldGrams),'card-yield'],
  ['raw','Требования к сырью',!!str(r.rawRequirements),'card-raw'],
  ['process','Подготовка и технология',!!str(r.preparation)&&!!str(r.forming||r.technology),'card-prep'],
  ['serving','Нарезка и подача',!!str(r.serving),'card-serving'],
  ['storage','Хранение и реализация',!!str(r.storage),'card-storage'],
  ['quality','Внешний вид и органолептика',!!str(r.appearance)&&!!str(r.taste),'card-appearance'],
  ['safety','Показатели безопасности',!!str(r.safety),'card-safety'],
  ['nutrition','Показатели КБЖУ',completeNutrition(r.nutrition),'card-kcal'],
  ['signatures','Разработал и утвердил',!!str(r.chef)&&!!str(r.approver),'card-chef']
 ].map(([id,label,ok,focus])=>({id,label,ok:Boolean(ok),focus}));
 const complete=checks.filter(x=>x.ok).length;
 const reference=ingredients.filter(x=>x.nutritionOrigin==='reference').map(x=>str(x.name)).filter(Boolean);
 const warnings=[];
 if(reference.length)warnings.push('Справочные КБЖУ: '+reference.slice(0,3).join(', ')+'. Сверь с этикетками.');
 if(!r.photo)warnings.push('Фото блюда не добавлено (необязательно).');
 if(r.status==='ready'&&complete!==checks.length)
  warnings.push('Указан статус «Готова», но часть данных отсутствует.');
 return {checks,complete,total:checks.length,percent:formatPercent(complete/checks.length*100),
  warnings,allFieldsFilled:complete===checks.length};
}
export function mountTtkProWorkspace(editor,{getDraft,onPreview}={}){
 if(!editor||typeof getDraft!=='function')throw Error('Редактор ТТК не подключён');
 const existing=editor.querySelector('.ttk-pro-shell');
 if(existing)return {refresh(){},open(){}};
 const toolbar=editor.querySelector('.ttk-toolbar');
 const viewport=editor.querySelector('.ttk-viewport');
 const designs=editor.querySelector('#ttk-design-picker');
 if(!toolbar||!viewport||!designs)throw Error('Не найдены базовые элементы редактора ТТК');
 const top=node('section','ttk-pro-head');
 const brand=node('span','ttk-pro-overline','FARRUH AI  /  КОНСТРУКТОР ТТК');
 const title=node('h3','ttk-pro-title','Технологическая карта · А4');
 const subtitle=node('p','ttk-pro-subtitle','Выбор оформления, заполнение и проверка документа');
 const status=node('span','ttk-pro-save-state','Без несохранённых изменений');
 status.dataset.state='saved';status.setAttribute('role','status');
 const heading=node('div','ttk-pro-heading');heading.append(brand,title,subtitle);
 const progressBox=node('div','ttk-pro-progress');
 const gauge=node('div','ttk-pro-gauge');gauge.setAttribute('role','progressbar');
 gauge.setAttribute('aria-label','Заполненность полей ТТК');gauge.setAttribute('aria-valuemin','0');gauge.setAttribute('aria-valuemax','100');
 const percent=node('strong','ttk-pro-progress-number','0%');
 gauge.append(percent);
 const description=node('small','','Заполненность полей');
 progressBox.append(gauge,description);
 top.append(heading,progressBox,status);
 toolbar.after(top);
 const tabs=node('nav','ttk-pro-tabs');tabs.setAttribute('aria-label','Работа с техкартой');
 const tab=(label,action,accent=false)=>{
  const b=node('button','ttk-pro-tab'+(accent?' is-accent':''),label);b.type='button';b.addEventListener('click',action);return b;
 };
 const report=node('aside','ttk-pro-audit');report.id='ttk-pro-audit';
 const auditTitle=node('h3','','Проверка заполнения');
 const auditHelp=node('p','ttk-pro-audit-note','Проверяем наличие данных, не соответствие санитарным требованиям.');
 const auditList=node('div','ttk-pro-checks');
 const warn=node('div','ttk-pro-warnings');
 const density=node('p','ttk-pro-paper-estimate');
 report.append(auditTitle,auditHelp,auditList,warn,density);
 const shell=node('div','ttk-pro-shell');
 const rail=node('div','ttk-pro-rail');
 viewport.before(shell);shell.append(viewport,rail);rail.append(designs,report);
 tabs.append(
  tab('✎ Заполнение',()=>{editor.querySelector('.editor-modes button:first-child')?.click();viewport.scrollIntoView({behavior:'smooth',block:'start'})}),
  tab('◈ Дизайн',()=>designs.scrollIntoView({behavior:'smooth',block:'center'})),
  tab('✓ Проверка',()=>report.scrollIntoView({behavior:'smooth',block:'center'})),
  tab('◉ Предпросмотр PDF',()=>onPreview?.(),true)
 );
 top.after(tabs);
 let currentDirty=false,hasPersistedRecipe=false,timer=null;
 function pdfDensity(){
  const paper=editor.querySelector('.ttk-paper');
  const basis=paper?.querySelector('.ttk-regulatory');
  if(!paper||!basis)return null;
  const p=paper.getBoundingClientRect(),b=basis.getBoundingClientRect();
  if(p.width<=0||b.bottom<=0)return null;
  const zoom=p.width/794;
  return Math.max(0,Math.round((b.bottom-p.top)/zoom/1090*100));
 }
 function refresh(){
  if(editor.hidden)return;
  let result;
  try{result=auditTtkDraft(getDraft());}catch{return}
  title.textContent=str(document.getElementById('recipe-name')?.value)||'Новая техкарта';
  subtitle.textContent=(str(document.getElementById('recipe-category')?.value)||'Техкарта')+
    '  ·  '+(editor.dataset.ttkLayout==='royal-a4'?'Royal Blue':'Arctic Glass')+
    '  ·  Лист A4';
  percent.textContent=result.percent+'%';
  gauge.style.setProperty('--ttk-audit-pct',result.percent+'%');
  gauge.setAttribute('aria-valuenow',String(result.percent));
  auditTitle.textContent='Проверка заполнения · '+result.complete+'/'+result.total;
  auditList.replaceChildren(...result.checks.map(item=>{
   const b=node('button','ttk-pro-check'+(item.ok?' is-ok':' is-missing'));
   b.type='button';b.innerHTML='<span class="ttk-pro-check-dot" aria-hidden="true">'+(item.ok?'✓':'!')+'</span>';
   b.append(node('span','',item.label));b.setAttribute('aria-label',(item.ok?'Заполнено: ':'Не заполнено: ')+item.label);
   b.addEventListener('click',()=>{
    const target=document.getElementById(item.focus);
    if(!target)return;
    editor.querySelector('.editor-modes button:first-child')?.click();
    target.scrollIntoView({behavior:'smooth',block:'center'});
    if(item.focus!=='ingredients'&&typeof target.focus==='function')target.focus({preventScroll:true});
   });
   return b;
  }));
  warn.replaceChildren(...result.warnings.map(message=>node('p','ttk-pro-warning',message)));
  const ratio=pdfDensity();
  if(ratio!==null){
   density.textContent='Оценка заполнения макета А4: '+ratio+'%. Итоговую печать проверь в PDF.';
   density.dataset.level=ratio>100?'overflow':ratio>95?'near':'ok';
  }else density.textContent='Размер итогового документа проверяется в PDF.';
  status.textContent=currentDirty?'● Изменения не сохранены':
    hasPersistedRecipe?'✓ Данные сохранены':'○ Новая ТТК · ещё не сохранена';
  status.dataset.state=currentDirty?'dirty':hasPersistedRecipe?'saved':'new';
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(refresh,160)}
 editor.addEventListener('input',()=>{currentDirty=true;schedule()});
 editor.addEventListener('change',()=>{currentDirty=true;schedule()});
 editor.addEventListener('click',e=>{if(e.target.closest('#ttk-design-picker')){currentDirty=true;schedule()}});
 return {
  refresh,open({persisted=false}={}){currentDirty=false;hasPersistedRecipe=persisted;queueMicrotask(refresh)},
  markSaved(){currentDirty=false;hasPersistedRecipe=true;queueMicrotask(refresh)},
  markDirty(){currentDirty=true;schedule()}
 };
}
