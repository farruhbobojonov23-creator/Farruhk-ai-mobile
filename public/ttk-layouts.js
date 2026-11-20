/* Four owner-approved Premium A4 TTK layouts (teal, process, allergen, blue).
 * Recipe, nutrition and safety data are unaffected by selecting a design.
 * Legacy two-style recipes are transparently mapped to the closest new style. */
export const TTK_LAYOUTS=Object.freeze([
 {id:'teal-matrix',name:'01 · Бирюзовая матрица',subtitle:'Бирюзовый · матрица аллергенов',description:'Бирюзовые заголовки, таблица рецептуры и чек-лист аллергенов.',tone:'teal'},
 {id:'process-matrix',name:'02 · Технологический процесс',subtitle:'Бирюзовый · этапы приготовления',description:'Технология в четырёх последовательных блоках и матрица аллергенов.',tone:'process'},
 {id:'gold-allergen',name:'03 · Золотая нумерация',subtitle:'Бирюзовый · девять разделов',description:'Девять разделов с золотыми номерами и проверкой аллергенов.',tone:'gold'},
 {id:'premium-blue',name:'04 · Золотые аллергены',subtitle:'Бирюзовый · золотая матрица',description:'Крупная золотая матрица аллергенов и самостоятельная структура А4.',tone:'blue'}
]);
// Keep the original four stable for older saved cards and reports.
// The fifth owner-approved Emerald Gold joins the SAME design gallery.
export const TTK_GALLERY_LAYOUTS=Object.freeze([...TTK_LAYOUTS,
 {id:'emerald-master-a4',name:'05 · Emerald Gold',subtitle:'Изумруд и золото · утверждённый эталон',description:'Один лист A4. Точная печатная версия открывается кнопкой просмотра.',tone:'emerald'}
]);
export const TTK_DEFAULT_LAYOUT='teal-matrix';
const LEGACY_LAYOUTS=Object.freeze({'emerald-master-a4':'emerald-master-a4','arctic-a4':'teal-matrix','royal-a4':'premium-blue',classic:TTK_DEFAULT_LAYOUT});
export const ttkLayoutId=value=>TTK_LAYOUTS.some(i=>i.id===value)?value:LEGACY_LAYOUTS[value]||TTK_DEFAULT_LAYOUT;
export const ttkLayout=key=>ttkLayoutId(key)==='emerald-master-a4'?{id:'emerald-master-a4',name:'Emerald Gold · утверждённый эталон',tone:'emerald'}:TTK_LAYOUTS.find(i=>i.id===ttkLayoutId(key));
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
const row=(n=3)=>Array.from({length:n},()=>'<i></i>').join('');
export function layoutPreview(item){
 const page=el('div','ttk-design-thumb ttk-design-'+item.tone);
 page.setAttribute('aria-hidden','true');
 const isBlue=item.id==='premium-blue',isProcess=item.id==='process-matrix',isGold=item.id==='premium-blue',isNumbered=item.id==='gold-allergen',isEmerald=item.id==='emerald-master-a4';
 const top='<div class="ttk-mini-brand"><b>♛</b> '+(isEmerald?'MORE SUSHI':'FARRUH AI')+' <em>Premium</em></div>'+
  '<div class="ttk-mini-title">ТЕХНОЛОГИЧЕСКАЯ КАРТА (ТТК)</div>'+
  '<div class="ttk-mini-name">Филадельфия классик <span>№ 001</span></div>';
 if(isEmerald){
  // Lightweight thumbnail; the real approved printable master loads on demand.
  page.innerHTML='<div class="ttk-mini-emerald-head"><span>✦ MORE SUSHI</span><b>ТТК · 001</b></div>'+
    '<div class="ttk-mini-emerald-dish">Филадельфия Классик<small>ХОЛОДНЫЕ РОЛЛЫ · 8 ШТ.</small></div>'+
    '<div class="ttk-mini-emerald-cells">'+
    ['01 · ОБЛАСТЬ ПРИМЕНЕНИЯ','02 · ТРЕБОВАНИЯ К СЫРЬЮ','03 · РЕЦЕПТУРА','04 · ТЕХНОЛОГИЯ','05 · УСЛОВИЯ','06 · КАЧЕСТВО','07 · КБЖУ','АЛЛЕРГЕНЫ'].map(title=>
      '<div class="ttk-mini-emerald-cell"><b>'+title+'</b><i></i><i></i><i></i></div>').join('')+
    '</div><div class="ttk-mini-emerald-sign">Разработал __________　Утверждаю __________</div>';
  return page;
 }
 const meta='<div class="ttk-mini-meta"><span>270 г · 8 шт.</span><span>15.11.2026</span></div>';
 const section=(title,body)=>'<div class="ttk-mini-section"><b>'+title+'</b><div>'+body+'</div></div>';
 const tinyRows=row(4);
 const table=section('РЕЦЕПТУРА','<div class="ttk-mini-table">'+tinyRows+'<strong>Выход: 270 г</strong></div>');
 const checks=section(isGold?'АЛЛЕРГЕНЫ В БЛЮДЕ':isNumbered?'4. МАТРИЦА АЛЛЕРГЕНОВ':'МАТРИЦА АЛЛЕРГЕНОВ',
  '<div class="ttk-mini-checks"><span>Рыба <strong>✓</strong></span><span>Молоко <strong>✓</strong></span><span>Глютен <i>□</i></span><span>Соя <i>□</i></span></div>');
 const process=section('ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ',
  '<div class="'+(isProcess?'ttk-mini-flow':'ttk-mini-steps')+'">'+
  ['Подготовка','Формовка','Сборка','Подача'].map((x,i)=>'<span><b>'+(i+1)+'</b>'+x+'</span>').join('')+'</div>');
 const nutrition=section('КБЖУ','<div class="ttk-mini-nutrients">'+row(3)+'</div>');
 const upper=isBlue?table+checks:
 '<div class="ttk-mini-duo">'+table+checks+'</div>';
 page.innerHTML=top+meta+upper+process+
  '<div class="ttk-mini-duo lower">'+section('КАЧЕСТВО',tinyRows)+section('УСЛОВИЯ',row(2))+'</div>'+
  '<div class="ttk-mini-sign">Разработал ______　Утверждаю ______</div>';
 return page;
}
export function layoutCard(item,selected,onPick){
 const b=el('button','ttk-design-card ttk-design-card-'+item.tone);
 b.type='button';b.dataset.ttkLayout=item.id;b.setAttribute('aria-pressed',String(!!selected));
 const picture=layoutPreview(item);const info=el('span','ttk-design-info');
 info.append(el('strong','',item.name),el('small','',item.subtitle),el('em','',selected?'✓ Выбран':'Выбрать оформление'));
 b.append(picture,info);b.addEventListener('click',()=>onPick(item.id));
 return b;
}
export function mountTtkDesignPicker(editor,{onChange=()=>{}}={}){
 if(!editor)throw Error('Не найден редактор ТТК');
 const panel=el('section','ttk-design-picker');panel.id='ttk-design-picker';
 panel.append(el('h3','','Шаблон оформления · А4'));
 panel.append(el('p','ttk-design-help','Все пять утверждённых шаблонов А4 в одном месте. Выбери вариант. Для Emerald Gold доступен точный просмотр перед печатью. Рецептура, КБЖУ и аллергены от оформления не меняются.'));
 const grid=el('div','ttk-design-grid');panel.append(grid);
 const tools=editor.querySelector('.lx-editor-extras')||editor.querySelector('.editor-modes')||editor.firstElementChild;tools?.after(panel);
 let chosen=TTK_DEFAULT_LAYOUT;
 function select(id,{notify=true}={}){
  chosen=ttkLayoutId(id);
  grid.replaceChildren(...TTK_GALLERY_LAYOUTS.map(item=>layoutCard(item,item.id===chosen,select)));
  editor.dataset.ttkLayout=chosen;
  const paper=editor.querySelector('.ttk-paper');if(paper)paper.dataset.ttkLayout=chosen;
  editor.dispatchEvent(new CustomEvent('ttk:layout-change',{detail:{id:chosen}}));
  if(notify)onChange(chosen);
 }
 select(chosen,{notify:false});
 document.addEventListener('ttk:choose-layout',e=>select(e.detail?.id));
 return {populate:recipe=>select(recipe?.layoutTemplate,{notify:false}),get:()=>chosen,select};
}
