/* Four genuinely different DOM arrangements for the owner's four A4 references.
 * Only layout/presentation changes here; original form, calculations and
 * persistence remain the single source of truth. No hard-coded example data.
 */
const node=(tag,cls,txt)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(txt!==undefined)x.textContent=txt;return x;
};
const ICONS=Object.freeze({
 fish:'<path d="M3 12c4-6 9-8 14 0-5 8-10 6-14 0Z"/><path d="m17 12 5-5v10l-5-5ZM7 11h.01"/>',
 milk:'<path d="M9 2h6v4l2 3v12H7V9l2-3V2ZM7 10h10"/>',
 grain:'<path d="M12 22V4M8 8l4 4m4-4-4 4M7 12l5 4m5-4-5 4M10 6l2-3 2 3"/>',
 egg:'<path d="M12 2c-6 0-9 9-9 14a9 9 0 0 0 18 0c0-5-3-14-9-14Z"/>',
 crab:'<path d="M6 12c0-5 12-5 12 0v4H6v-4ZM3 9l3 3M21 9l-3 3M4 17l3-2M20 17l-3-2M8 18v3M16 18v3"/>',
 soy:'<path d="M5 5c8-5 14 4 9 10-5 5-13-1-9-10ZM7 8l3 3m4-4-2 3"/>',
 sesame:'<circle cx="7" cy="7" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="10" cy="14" r="2"/><circle cx="18" cy="15" r="2"/><circle cx="5" cy="19" r="2"/>',
 nuts:'<path d="M4 15c-2-8 5-14 12-11 8 4 4 15-4 17-3 1-6-1-8-6ZM8 10l5 5m0-10-3 7"/>'
});
function icon(name){
 const x=node('span','ttk-ref-icon');
 x.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||ICONS.sesame)+'</svg>';
 return x;
}
const fmt=v=>v==null||v===''||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1});
const displayDate=v=>{
 const date=String(v||'');
 return /^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(8)+'.'+date.slice(5,7)+'.'+date.slice(0,4):date||'—';
};
const splitSentences=value=>{
 const text=String(value||'');
 if(text.includes('\n')){
  const [first,...remaining]=text.split('\n');
  return [first||'—',remaining.join('\n')||'—'];
 }
 const parts=text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
 if(parts.length<2)return [parts[0]||'—','—'];
 const boundary=Math.ceil(parts.length/2);
 return [parts.slice(0,boundary).join(' '),parts.slice(boundary).join(' ')];
};
function sectionTitle(panel,label,count){
 const h=panel.querySelector(':scope > .ttk-live-section-head');
 if(!h)return;
 h.querySelector('strong').textContent=label;
 const existing=h.querySelector('.ttk-live-count');
 if(count==null){existing?.remove();}
 else{
  const badge=existing||node('span','ttk-live-count');
  badge.textContent=String(count);if(!existing)h.prepend(badge);
 }
}
export function mountReferenceLayouts(page,editor,controls){
 const {lower,process,processFields,quality,conditions,nutrition,safety,signs,regulatory,
  qualityPair,scope,raw,formula,allergens,allergenRows,meta}=controls;
 const get=id=>editor.querySelector('#'+id);
 const duoProcess=node('div','ttk-ref-duo ttk-ref-process-quality');
 const duoConditions=node('div','ttk-ref-duo ttk-ref-conditions-nutrition');
 const stages=node('div','ttk-ref-process-stages');
 process.append(stages);
 const stageCards=[];
 for(const [i,title,ic] of [[1,'ПОДГОТОВКА','grain'],[2,'ФОРМОВКА','soy'],[3,'СБОРКА','nuts'],[4,'НАРЕЗКА И ПОДАЧА','fish']]){
  const card=node('div','ttk-ref-stage');
  const head=node('div','ttk-ref-stage-head');
  head.append(node('b','ttk-ref-stage-index',String(i)),node('strong','',title),icon(ic));
  const body=node('p','ttk-ref-stage-body','—');
  card.append(head,body);
  stages.append(card);stageCards.push(body);
 }
 const qualityTable=node('div','ttk-ref-info-table ttk-ref-quality-table');
 quality.append(qualityTable);
 const storageTable=node('div','ttk-ref-info-table ttk-ref-storage-table');
 conditions.append(storageTable);
 const nutritionTable=node('div','ttk-ref-info-table ttk-ref-nutri-table');
 nutrition.append(nutritionTable);
 const safetyCols=node('div','ttk-ref-haccp-cards');
 for(const heading of ['Критические точки','Контроль','Результат']){
  const cell=node('div','ttk-ref-haccp-card');
  cell.append(node('b','',heading),node('span','','—'));safetyCols.append(cell);
 }
 safety.append(safetyCols);
 const addedDate=[...signs.querySelectorAll(':scope > .ttk-live-label')].map(label=>{
  const data=node('span','ttk-ref-sign-date','—');
  const line=node('span','ttk-ref-sign-line','(подпись)　　　　　　　　　(дата)');
  label.append(data,line);return data;
 });
 const footerBrand=node('strong','ttk-ref-footer-brand');
 footerBrand.append(icon('grain'),node('span','','FARRUH AI'),node('em','','Premium'));
 regulatory.append(footerBrand);
 const piecesField=meta.querySelector('[data-ttk-field="card-pieces"]');
 // Quantity belongs in its own LABEL on the yellow recipe yield bar.
 // It must not float over the empty grams input (old black "8 шт." glitch).
 const yieldBand=page.querySelector('.ttk-live-yield');
 const piecesLabel=node('label','ttk-ref-piece-field');
 piecesLabel.append(node('span','','Количество:'));
 const yieldPieces=node('select','ttk-ref-yield-pieces ttk-ref-pieces-select');
 piecesLabel.append(yieldPieces);
 yieldBand?.append(piecesLabel);
 const sourcePieces=get('card-pieces');
 if(sourcePieces){
  for(const option of sourcePieces.options)yieldPieces.add(new Option(option.text,option.value));
  yieldPieces.value=sourcePieces.value;
  yieldPieces.setAttribute('aria-label','Количество порций / штук');
  yieldPieces.addEventListener('change',()=>{
   sourcePieces.value=yieldPieces.value;
   sourcePieces.dispatchEvent(new Event('change',{bubbles:true}));
  });
 }
 yieldField?.append(yieldPieces);
 // Inline switch above the calorie table; nothing is hidden in a modal.
 const sourceAuto=get('nutrition-auto');
 const autoLabel=node('label','ttk-ref-auto-switch');
 const autoInput=node('input');autoInput.type='checkbox';
 autoInput.checked=Boolean(sourceAuto?.checked);
 autoInput.setAttribute('aria-label','Автоматический расчёт КБЖУ');
 autoInput.addEventListener('change',()=>{
  if(!sourceAuto)return;
  sourceAuto.checked=autoInput.checked;
  sourceAuto.dispatchEvent(new Event('change',{bubbles:true}));
 });
 autoLabel.append(autoInput,node('span','','Авто'));
 nutrition.querySelector('.ttk-live-section-head')?.append(autoLabel);
 const metaIcons=['soy','nuts','grain','fish','crab'];
 [...meta.querySelectorAll(':scope > .ttk-live-label')].forEach((label,index)=>{
  label.prepend(icon(metaIcons[index]||'soy'));
 });
 const allergenIcons=['fish','milk','grain','egg','crab','soy','sesame','nuts'];
 // A tiny contenteditable CELL is the field itself, not an overlay. All edits
 // flow through the existing canonical form/validation/persistence controls.
 const write=(id,value)=>{
  const source=get(id);if(!source||source.readOnly)return;
  source.value=String(value);
  source.dispatchEvent(new Event('input',{bubbles:true}));
 };
 const editable=(cell,label,save)=>{
  cell.contentEditable='plaintext-only';cell.tabIndex=0;cell.spellcheck=true;
  cell.classList.add('ttk-ref-direct-cell');
  cell.setAttribute('role','textbox');cell.setAttribute('aria-label',label);
  cell.addEventListener('focus',()=>{
   if(cell.textContent.trim()==='—')cell.textContent='';
  });
  cell.addEventListener('input',()=>save(cell.textContent));
  cell.addEventListener('blur',()=>{
   if(!cell.textContent.trim())cell.textContent='—';
   queueMicrotask(update);
  });
  return cell;
 };
 stageCards.forEach((cell,i)=>editable(cell,
  ['Подготовка','Формовка','Сборка','Нарезка и подача'][i],value=>{
   if(i===0)write('card-prep',value);
   else if(i===3)write('card-serving',value);
   else write('technology',stageCards.slice(1,3).map(x=>x.textContent.trim()).join('\n'));
  }));
 const storageRows=(array)=>{
  array.forEach(([title,body])=>{
   const row=node('div','ttk-ref-info-row');
   const cell=node('span','',body||'—');
   if(title==='Условия хранения')editable(cell,'Условия хранения',value=>write('card-storage',value));
   if(title==='Срок годности')editable(cell,'Срок годности',value=>{
    const old=String(get('card-storage')?.value||'');
    const match=/\d+(?:[.,]\d+)?\s*(?:час(?:а|ов)?|ч\.?|сут(?:ок|ки)?|дн(?:ей|я)?|день)(?![а-я])/i;
    write('card-storage',match.test(old)?old.replace(match,value):
     old.trim()+' Срок годности '+value);
   });
   row.append(node('strong','',title),cell);
   storageTable.append(row);
  });
 };
 function update(){
  const rawTech=String(get('technology')?.value||'');
  const [form,assembly]=splitSentences(rawTech);
  for(const [i,txt] of [get('card-prep')?.value,form,assembly,get('card-serving')?.value].entries())
   if(document.activeElement!==stageCards[i])stageCards[i].textContent=String(txt||'—');
  if(!qualityTable.contains(document.activeElement)){
  qualityTable.replaceChildren();
  for(const [heading,id] of [['Показатель',''],['Внешний вид','card-appearance'],['Вкус и запах','card-taste'],['Консистенция','']]){
   const row=node('div','ttk-ref-info-row');
   const cell=node('span','',id?String(get(id)?.value||'—'):
    heading==='Консистенция'?'—':'Требование');
   if(id)editable(cell,heading,value=>write(id,value));
   row.append(node('strong','',heading),cell);
   qualityTable.append(row);
  }
  }
  const value=String(get('card-storage')?.value||'').trim();
  const expiry=value.match(/\d+(?:[.,]\d+)?\s*(?:час(?:а|ов)?|ч\.?|сут(?:ок|ки)?|дн(?:ей|я)?|день)(?![а-я])/i)?.[0]||'Не указан';
  if(!storageTable.contains(document.activeElement)){
   storageTable.replaceChildren();
   storageRows([['Условия хранения',value||'—'],['Срок годности',expiry]]);
  }
  if(!nutritionTable.contains(document.activeElement)){
  nutritionTable.replaceChildren();
  const header=node('div','ttk-ref-info-row ttk-ref-nutri-head');
  header.append(node('strong','','Показатель'),node('span','','На 100 г'),node('span','','На порцию'));
  nutritionTable.append(header);
  const factor=Number(get('card-yield')?.value)/100;
  for(const [label,id] of [['Белки, г','card-protein'],['Жиры, г','card-fat'],['Углеводы, г','card-carbs'],['Калорийность, ккал','card-kcal']]){
   const raw=get(id)?.value;
   const numeric=Number(raw);
   const row=node('div','ttk-ref-info-row');
   const valueCell=node('span','',fmt(raw));
   if(!get(id)?.readOnly)editable(valueCell,label+' на 100 г',
    value=>write(id,value.trim().replace(',','.')));
   row.append(node('strong','',label),valueCell,
    node('span','',raw!==''&&Number.isFinite(numeric)&&factor>0?fmt(numeric*factor):'—'));
   nutritionTable.append(row);
  }
  }
  const safetyVal=String(get('card-safety')?.value||'').trim();
  const sentences=safetyVal.includes('\n')?safetyVal.split('\n'):
   safetyVal.split(/(?<=[.!?;])\s+/).filter(Boolean);
  [...safetyCols.children].forEach((c,i)=>{
   const span=c.querySelector('span');
   if(!span.dataset.directConnected){
    editable(span,['Критические точки','Контроль','Результат'][i],()=>{
     write('card-safety',[...safetyCols.children].map(row=>row.querySelector('span').textContent.trim()).join('\n'));
    });
    span.dataset.directConnected='true';
   }
   if(document.activeElement!==span)span.textContent=sentences[i]||'—';
  });
  for(const d of addedDate)d.textContent=displayDate(get('card-date')?.value);
  if(sourcePieces&&document.activeElement!==yieldPieces)yieldPieces.value=sourcePieces.value;
  if(sourceAuto&&document.activeElement!==autoInput)autoInput.checked=sourceAuto.checked;
  [...allergenRows.querySelectorAll('.ttk-live-allergen-row')].forEach((row,i)=>{
   if(!row.querySelector('.ttk-ref-icon'))row.prepend(icon(allergenIcons[i]||'sesame'));
  });
  const rows=page.querySelectorAll('.ttk-live-ingredient-row');
  for(const [i,row] of rows.entries()){
   let number=row.querySelector('.ttk-ref-ingredient-index');
   if(!number){number=node('b','ttk-ref-ingredient-index',String(i+1));row.prepend(number);}
   number.textContent=String(i+1);
  }
 }
 function arrange(value){
  const layout=['teal-matrix','process-matrix','gold-allergen','premium-blue'].includes(value)?value:'teal-matrix';
  page.dataset.ttkLayout=layout;
  const flow=layout==='process-matrix',gold=layout==='gold-allergen',blue=layout==='premium-blue';
  const unnumbered=flow||blue;
  sectionTitle(scope,flow?'НАЗНАЧЕНИЕ И ОБЛАСТЬ ПРИМЕНЕНИЯ':'ОБЛАСТЬ ПРИМЕНЕНИЯ',unnumbered?null:1);
  sectionTitle(raw,'ТРЕБОВАНИЯ К СЫРЬЮ',unnumbered?null:2);
  sectionTitle(formula,'РЕЦЕПТУРА (НОРМА ЗАКЛАДКИ НА 1 ПОРЦИЮ)',unnumbered?null:3);
  sectionTitle(allergens,blue?'АЛЛЕРГЕНЫ В БЛЮДЕ':'МАТРИЦА АЛЛЕРГЕНОВ',gold?4:null);
  sectionTitle(process,flow?'ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС ПРИГОТОВЛЕНИЯ':'ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ',unnumbered?null:gold?5:4);
  sectionTitle(quality,flow?'СТАНДАРТЫ КАЧЕСТВА':'КОНТРОЛЬ КАЧЕСТВА',unnumbered?null:gold?6:5);
  sectionTitle(conditions,flow?'УСЛОВИЯ ХРАНЕНИЯ':'УСЛОВИЯ ХРАНЕНИЯ И РЕАЛИЗАЦИИ',unnumbered?null:gold?7:6);
  sectionTitle(nutrition,'ПИЩЕВАЯ ЦЕННОСТЬ (КБЖУ)',unnumbered?null:gold?8:7);
  sectionTitle(safety,'БЕЗОПАСНОСТЬ (ХАССП)',unnumbered?null:gold?9:8);
  if(flow){
   qualityPair.append(quality,conditions,nutrition);
   lower.replaceChildren(process,qualityPair,safety,signs,regulatory);
  }else{
   duoProcess.append(process,quality);
   duoConditions.append(conditions,nutrition);
   lower.replaceChildren(duoProcess,duoConditions,safety,signs,regulatory);
  }
  piecesField?.classList.add('ttk-ref-pieces-field');
  update();
 }
 arrange(page.dataset.ttkLayout);
 return {arrange,update};
}
