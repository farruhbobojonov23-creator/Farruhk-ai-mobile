import {regulatoryBasis,scopeForName} from './recipe-math.js?v=ttk-5';
// Keep the existing form controls and calculations; arrange them on an editable A4 sheet.
export function mountRecipeSheet(editor){
 const $=id=>document.getElementById(id),el=(tag,className)=>{const n=document.createElement(tag);if(className)n.className=className;return n};
 const controls=new Map([...editor.querySelectorAll('[id]')].map(n=>[n.id,n]));
 const get=id=>{const node=controls.get(id);if(!node)throw Error('Missing recipe control: '+id);return node};
 const toolbar=el('div','ttk-toolbar');toolbar.append(get('edit-title'));
 const oldSave=editor.querySelector('button[type="submit"],button.primary');oldSave.textContent='Сохранить';toolbar.append(oldSave);
 const download=el('button');download.id='sheet-download';download.type='button';download.textContent='Сохранить и скачать PDF';toolbar.append(download,get('delete-recipe'),get('closeeditor'));
 const guidance=el('p','ttk-guidance');guidance.textContent='Редактируй прямо в ячейках. Нетто и отходы вводятся вручную, брутто и выход рассчитываются. PDF сохраняется на одном листе А4; при большом объёме текста шрифт уменьшается. На телефоне лист целиком помещается по ширине экрана; для мелкого текста увеличь страницу двумя пальцами.';
 const viewport=el('div','ttk-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Редактируемая техкарта');
 const paper=el('div','ttk-paper');viewport.append(paper);
 const title=el('div','ttk-document-title');title.textContent='ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА (Суши Бери)';paper.append(title);
 function table(){const t=el('table','ttk-table');t.append(el('tbody'));paper.append(t);return t.tBodies[0]}
 function pair(row,caption,id){const th=el('th'),td=el('td');th.scope='row';th.textContent=caption;const input=get(id);input.setAttribute('aria-label',caption);td.append(input);row.append(th,td)}
 const metadata=table();for(const pairs of [[['Блюдо:','recipe-name'],['Дата:','card-date']],[['Категория:','recipe-category'],['ТТК №:','card-number']],[['Статус:','recipe-status'],['Количество:','card-pieces']]]){const row=el('tr');for(const [caption,id] of pairs)pair(row,caption,id);metadata.append(row)}
 function section(text){const h=el('h3','ttk-section-title'),span=el('span');span.textContent=text;h.append(span);paper.append(h)}
 function full(id,caption){const body=table(),row=el('tr'),td=el('td');const input=get(id);input.setAttribute('aria-label',caption);td.append(input);row.append(td);body.append(row)}
 section('1. Область применения');full('card-scope','Область применения');section('2. Требования к сырью');full('card-raw','Требования к сырью');
 section('3. Рецептура');
 const ingredients=el('div','ttk-ingredient-table');ingredients.setAttribute('role','table');ingredients.setAttribute('aria-label','Матрица ингредиентов');
 const header=el('div','ttk-ingredient-head');header.setAttribute('role','row');for(const text of ['Наименование сырья / полуфабриката','Брутто, г','Нетто, г','Отходы, %','']){const cell=el('span');cell.textContent=text;cell.setAttribute('role','columnheader');header.append(cell)}
 ingredients.append(header,get('ingredients'));paper.append(ingredients);
 const add=get('addingredient');add.classList.add('ttk-add');add.textContent='＋ Добавить ингредиент';paper.append(add);
 const output=table(),outputRow=el('tr');pair(outputRow,'ВЫХОД ГОТОВОГО БЛЮДА, г:','card-yield');get('card-yield').removeAttribute('aria-describedby');const outputNote=el('td');outputNote.colSpan=2;outputNote.textContent='Сумма нетто готовых ингредиентов';outputRow.append(outputNote);output.append(outputRow);
 section('4. Технологический процесс');
 const process=table(),head=el('tr');for(const text of ['Этап','Описание действий']){const th=el('th');th.textContent=text;head.append(th)}process.append(head);
 for(const [caption,id] of [['Подготовка','card-prep'],['Формовка / приготовление','technology'],['Нарезка / подача','card-serving']]){const row=el('tr');pair(row,caption,id);process.append(row)}
 section('5. Оформление, подача, реализация и хранение');full('card-storage','Оформление, подача и хранение');
 section('6. Показатели качества и безопасности');const organoleptic=table();for(const [caption,id] of [['Внешний вид','card-appearance'],['Вкус, запах и консистенция','card-taste']]){const row=el('tr');pair(row,caption,id);organoleptic.append(row)}
 full('card-safety','Показатели безопасности');section('7. Пищевая ценность (на 100 г / на порцию)');
 const mode=el('label','ttk-nutrition-mode');mode.append(get('nutrition-auto'),document.createTextNode(' Автоматический расчёт по данным ингредиентов'));paper.append(mode);
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
 paper.append(top,blocks[2],blocks[3],lower,blocks[6]);
 editor.replaceChildren(toolbar,guidance,viewport,tools);editor.classList.add('ttk-sheet-editor');
 function fitPaper(){
  const available=viewport.clientWidth-4;
  if(available>0)paper.style.zoom=String(Math.min(1,available/794));
 }
 // Observe the available column, including opening the editor and rotating a phone.
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitPaper).observe(viewport);
 else window.addEventListener('resize',fitPaper);
 function refresh(){if(editor.hidden)return;fitPaper();const scope=$('card-scope');scope.value=scopeForName(scope.value,$('recipe-name').value);for(const area of editor.querySelectorAll('textarea')){area.style.height='auto';area.style.height=Math.max(38,area.scrollHeight+2)+'px'}const topHeight=Math.max($('card-scope').scrollHeight,$('card-raw').scrollHeight)+2;$('card-scope').style.height=topHeight+'px';$('card-raw').style.height=topHeight+'px';const yieldGrams=Number($('card-yield').value);for(const key of ['protein','fat','carbs','kcal']){const raw=$('card-'+key).value;$('sheet-portion-'+key).textContent=raw!==''&&yieldGrams>0?(Number(raw)*yieldGrams/100).toLocaleString('ru-RU',{maximumFractionDigits:2}):'-'}}
 editor.addEventListener('input',()=>queueMicrotask(refresh));editor.addEventListener('change',()=>queueMicrotask(refresh));
 return {refresh,downloadButton:download};
}

