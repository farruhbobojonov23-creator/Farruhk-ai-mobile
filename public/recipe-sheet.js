import {regulatoryBasis,scopeForName,nutritionOnPortion} from './recipe-math.js?v=ttk-6';
// Keep the existing form controls and calculations; arrange them on an editable A4 sheet.
export function mountRecipeSheet(editor){
 const $=id=>document.getElementById(id),el=(tag,className)=>{const n=document.createElement(tag);if(className)n.className=className;return n};
 const controls=new Map([...editor.querySelectorAll('[id]')].map(n=>[n.id,n]));
 const get=id=>{const node=controls.get(id);if(!node)throw Error('Missing recipe control: '+id);return node};
 const toolbar=el('div','ttk-toolbar');toolbar.append(get('edit-title'));
 const oldSave=editor.querySelector('button[type="submit"],button.primary');oldSave.textContent='Сохранить';toolbar.append(oldSave);
 const download=el('button');download.id='sheet-download';download.type='button';download.textContent='Сохранить и скачать PDF';toolbar.append(download,get('delete-recipe'),get('closeeditor'));
 const guidance=el('p','ttk-guidance');guidance.textContent='Заполняй удобные поля или переключись на лист А4. Брутто и выход рассчитываются автоматически. Перед скачиванием PDF изменения сохраняются.';
 const viewport=el('div','ttk-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Редактируемая техкарта');
 const paper=el('div','ttk-paper');viewport.append(paper);
 const brand=el('div','ttk-document-brand');
 brand.innerHTML='<span>✦ &nbsp;FARRUH AI</span><span>♛ &nbsp;Premium</span>';
 paper.append(brand);
 const title=el('div','ttk-document-title');title.textContent='ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА';paper.append(title);
 const nameBar=el('div','ttk-document-namebar'),productName=el('strong'),productState=el('span');
 nameBar.append(productName,productState);paper.append(nameBar);
 function table(){const t=el('table','ttk-table');t.append(el('tbody'));paper.append(t);return t.tBodies[0]}
 function pair(row,caption,id){const th=el('th'),td=el('td');th.scope='row';th.textContent=caption;const input=get(id);input.setAttribute('aria-label',caption);td.append(input);row.append(th,td)}
 const metadata=table();for(const pairs of [[['Блюдо:','recipe-name'],['Дата:','card-date']],[['Категория:','recipe-category'],['ТТК №:','card-number']],[['Статус:','recipe-status'],['Количество:','card-pieces']]]){const row=el('tr');for(const [caption,id] of pairs)pair(row,caption,id);metadata.append(row)}
 function section(text){const h=el('h3','ttk-section-title'),span=el('span');span.textContent=text;h.append(span);paper.append(h)}
 function full(id,caption){const body=table(),row=el('tr'),td=el('td');const input=get(id);input.setAttribute('aria-label',caption);td.append(input);row.append(td);body.append(row)}
 section('1. Область применения');full('card-scope','Область применения');section('2. Требования к сырью');full('card-raw','Требования к сырью');
 section('3. Рецептура');
 const recipeHelp=el('p','ttk-recipe-help','Состав и нормы закладки ингредиентов на одну порцию. Укажи брутто, нетто и отходы для каждого ингредиента.');
 paper.append(recipeHelp);
 const ingredients=el('div','ttk-ingredient-table');ingredients.setAttribute('role','table');ingredients.setAttribute('aria-label','Матрица ингредиентов');
 const header=el('div','ttk-ingredient-head');header.setAttribute('role','row');for(const text of ['Наименование сырья / полуфабриката','Брутто, г','Нетто, г','Отходы, %','']){const cell=el('span');cell.textContent=text;cell.setAttribute('role','columnheader');header.append(cell)}
 ingredients.append(header,get('ingredients'));paper.append(ingredients);
 const add=get('addingredient');add.classList.add('ttk-add');add.textContent='＋ Добавить ингредиент';paper.append(add);
 const output=table(),outputRow=el('tr');pair(outputRow,'ВЫХОД ГОТОВОГО БЛЮДА, г:','card-yield');get('card-yield').removeAttribute('aria-describedby');const outputNote=el('td');outputNote.colSpan=2;outputNote.textContent='Сумма нетто готовых ингредиентов';outputRow.append(outputNote);output.append(outputRow);
 const recipeTotals=el('div','ttk-recipe-totals');
 recipeTotals.innerHTML='<span class="ttk-recipe-total-title">⚖ &nbsp;Итого по рецептуре</span>'+
  '<span>Брутто, г <b data-total="gross">—</b></span>'+
  '<span>Нетто, г <b data-total="net">—</b></span>'+
  '<span>Отходы, % <b data-total="loss">—</b></span>';
 paper.append(recipeTotals);
 section('4. Технологический процесс');
 const process=table(),head=el('tr');for(const text of ['Этап','Описание действий']){const th=el('th');th.textContent=text;head.append(th)}process.append(head);
 for(const [caption,id] of [['Подготовка','card-prep'],['Формовка / приготовление','technology'],['Нарезка / подача','card-serving']]){const row=el('tr');pair(row,caption,id);process.append(row)}
 section('5. Оформление, подача, реализация и хранение');full('card-storage','Оформление, подача и хранение');
 section('6. Показатели качества');const organoleptic=table();for(const [caption,id] of [['Внешний вид','card-appearance'],['Вкус, запах и консистенция','card-taste']]){const row=el('tr');pair(row,caption,id);organoleptic.append(row)}
 full('card-safety','Показатели безопасности');const safety=el('section','ttk-block ttk-safety-block'),safetyTitle=el('h3','ttk-section-title'),safetySpan=el('span');safetySpan.textContent='Безопасность';safetyTitle.append(safetySpan);safety.append(safetyTitle,get('card-safety').closest('table'));section('7. Пищевая ценность (на 100 г / на порцию)');
 const mode=el('label','ttk-nutrition-mode');mode.append(get('nutrition-auto'),document.createTextNode(' Автоматический расчёт КБЖУ'));paper.append(mode);
 const nutritionStatus=el('p','ttk-nutrition-status small');nutritionStatus.id='nutrition-status';nutritionStatus.setAttribute('role','status');nutritionStatus.textContent='Для расчёта укажи КБЖУ ингредиентов на 100 г.';paper.append(nutritionStatus);
 const nutrition=table(),nHead=el('tr');for(const caption of ['Показатель','Белки, г','Жиры, г','Углеводы, г','Ккал']){const th=el('th');th.textContent=caption;nHead.append(th)}nutrition.append(nHead);
 const per100=el('tr'),label=el('td');label.textContent='На 100 г';per100.append(label);for(const key of ['protein','fat','carbs','kcal']){const td=el('td'),input=get('card-'+key);td.append(input);per100.append(td)}nutrition.append(per100);
 const portion=el('tr'),portionLabel=el('td');portionLabel.textContent='На порцию';portion.append(portionLabel);for(const key of ['protein','fat','carbs','kcal']){const td=el('td'),out=el('output');out.id='sheet-portion-'+key;out.textContent='-';td.append(out);portion.append(td)}nutrition.append(portion);
 paper.append(get('nutrition-products'));
 const signatures=table(),signatureRow=el('tr');pair(signatureRow,'Разработал (Шеф):','card-chef');pair(signatureRow,'Утверждаю (Руководитель):','card-approver');signatures.append(signatureRow);signatures.parentNode.classList.add('ttk-signatures');
 const basis=el('p','ttk-regulatory');basis.textContent=regulatoryBasis;paper.append(basis);const tools=el('div','ttk-template-tools');tools.append(get('apply-roll-template'));const note=el('p');note.textContent='Стандартные тексты доступны для правки. Проверь применимость к блюду перед утверждением.';tools.append(note);
 // Move the existing controls, preserving every listener and input identity.
 const blocks=[];let block;
 for(const node of [...paper.children]){
  if(node.matches('.ttk-section-title')){block=el('section','ttk-block');block.dataset.section=String(blocks.length+1);blocks.push(block)}
  if(block)block.append(node);
 }
 const top=el('div','ttk-top-pair');top.append(blocks[0],blocks[1]);
 const lower=el('div','ttk-lower-grid');lower.append(blocks[4],blocks[5]);
 paper.append(top,blocks[2],blocks[3],lower,safety,blocks[6]);
 const modes=el('nav','editor-modes');modes.setAttribute('aria-label','Режим техкарты');
 const formMode=el('button'),paperMode=el('button');formMode.type=paperMode.type='button';formMode.textContent='Заполнение';paperMode.textContent='Лист А4';
 function setEditorMode(value){editor.dataset.mode=value;formMode.setAttribute('aria-pressed',String(value==='form'));paperMode.setAttribute('aria-pressed',String(value==='paper'));refresh()}
 formMode.onclick=()=>setEditorMode('form');paperMode.onclick=()=>setEditorMode('paper');modes.append(formMode,paperMode);
 editor.dataset.mode='form';formMode.setAttribute('aria-pressed','true');paperMode.setAttribute('aria-pressed','false');
 editor.replaceChildren(toolbar,modes,guidance,viewport,tools);editor.classList.add('ttk-sheet-editor');
 function fitPaper(){
  if(editor.dataset.mode==='form'){paper.style.zoom='1';return}const available=viewport.clientWidth-4;
  if(available>0)paper.style.zoom=String(Math.min(1,available/794));
 }
 // Observe the available column, including opening the editor and rotating a phone.
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitPaper).observe(viewport);
 else window.addEventListener('resize',fitPaper);
 function refresh(){
  if(editor.hidden)return;
  // Match the backend A4 ingredient-column count in the interactive sheet.
  // The original input nodes and their listeners stay intact.
  const count=$('ingredients')?.children.length||0;
  const cols=count>65?4:count>46?3:count>18?2:1;
  paper.dataset.ttkIngredientColumns=String(cols);
  paper.style.setProperty('--ttk-screen-ingredient-cols',String(cols));
  paper.style.setProperty('--ttk-screen-ingredient-rows',String(Math.max(1,Math.ceil(count/cols))));
  productName.textContent=$('recipe-name').value.trim()||'Название блюда';
  productState.textContent=$('recipe-status').value==='ready'?'✓ Готова':'В разработке';
  const rows=[...$('ingredients').querySelectorAll('.ingredient')];
  const numberFor=(el,key)=>Number(el.querySelector('[data-key="'+key+'"]')?.value)||0;
  const gross=rows.reduce((sum,row)=>sum+numberFor(row,'grossGrams'),0);
  const net=rows.reduce((sum,row)=>sum+numberFor(row,'grams'),0);
  const ru=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:1});
  recipeTotals.querySelector('[data-total="gross"]').textContent=rows.length?ru(gross):'—';
  recipeTotals.querySelector('[data-total="net"]').textContent=rows.length?ru(net):'—';
  recipeTotals.querySelector('[data-total="loss"]').textContent=rows.length&&gross>0?ru(Math.max(0,(gross-net)/gross*100)):'—';
  fitPaper();const scope=$('card-scope');scope.value=scopeForName(scope.value,$('recipe-name').value);for(const area of editor.querySelectorAll('textarea')){area.style.height='auto';area.style.height=Math.max(38,area.scrollHeight+2)+'px'}const topHeight=Math.max($('card-scope').scrollHeight,$('card-raw').scrollHeight)+2;$('card-scope').style.height=topHeight+'px';$('card-raw').style.height=topHeight+'px';const yieldGrams=$('card-yield').value;
 const nutrition=Object.fromEntries(['protein','fat','carbs','kcal'].map(key=>[key,$('card-'+key).value===''?null:Number($('card-'+key).value)]));
 const portionValues=nutritionOnPortion(nutrition,yieldGrams);
 portionLabel.textContent=Number(yieldGrams)>0?'На порцию ('+Number(yieldGrams).toLocaleString('ru-RU',{maximumFractionDigits:2})+' г)':'На порцию';
 for(const key of ['protein','fat','carbs','kcal'])
  $('sheet-portion-'+key).textContent=portionValues?
   portionValues[key].toLocaleString('ru-RU',{maximumFractionDigits:2,minimumFractionDigits:0}):'—';
 }
 editor.addEventListener('input',()=>queueMicrotask(refresh));editor.addEventListener('change',()=>queueMicrotask(refresh));
 return {refresh,downloadButton:download};
}

