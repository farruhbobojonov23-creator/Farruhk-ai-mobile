/* FARUKH TTK PRO · A4 visual layout editor · 2026-11-12.
   Changes are stored inside each TTK fields.a4_design, separately per template.
   No existing recipe, validation or authentication flows are replaced. */
(function(){
'use strict';
const PAGE_W=794, PAGE_H=1123;
const BLOCKS=[
 {key:'brand',selector:'#brand',name:'Логотип и бренд'},
 {key:'title',selector:'#pageTitle',name:'Заголовок документа'},
 {key:'dish',selector:'#nameStrip',name:'Название и код блюда'},
 {key:'photo',selector:'#photoBox',name:'Фото готового блюда'},
 {key:'facts',selector:'#factBox',name:'Категория и выход'},
 {key:'scope',selector:'.card1',name:'1. Область применения'},
 {key:'raw',selector:'.card2',name:'2. Требования к сырью'},
 {key:'recipe',selector:'.card3',name:'3. Рецептура'},
 {key:'process',selector:'.card4',name:'4. Технология'},
 {key:'serving',selector:'.card5',name:'5. Реализация и хранение'},
 {key:'quality',selector:'.card6',name:'6. Качество и безопасность'},
 {key:'nutrition',selector:'.card7',name:'7. КБЖУ'},
 {key:'signatures',selector:'#foot',name:'Разработал и утвердил'}
];
const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const round=v=>Math.round(v);
let bridge=null,layoutMode=false,selectedKey=null,pointer=null,initialized=false;
function paper(){return $('paper')?.querySelector('.archive-sheet-content')}
function doc(){return bridge?.getDraft()||null}
function current(){
 const d=doc();if(!d)return null;
 d.fields=d.fields||{};
 const root=d.fields.a4_design||(d.fields.a4_design={});
 const id=d.template||'atelier';
 const cfg=root[id]||(root[id]={font:100,accent:'',blocks:{}});
 cfg.blocks=cfg.blocks&&typeof cfg.blocks==='object'?cfg.blocks:{};
 return cfg;
}
function blockFor(key){const b=BLOCKS.find(v=>v.key===key);return b&&paper()?.querySelector(b.selector)}
function mark(){bridge?.markDirty()}
function rect(el){
 const st=getComputedStyle(el);
 return {
  x:round(parseFloat(st.left)||0),y:round(parseFloat(st.top)||0),
  w:round(el.offsetWidth||parseFloat(st.width)||100),
  h:round(el.offsetHeight||parseFloat(st.height)||60)
 };
}
function setPosition(el,v){
 if(!el)return;
 for(const [prop,value] of [['left',v.x],['top',v.y],['width',v.w],['height',v.h]]){
  if(Number.isFinite(Number(value)))el.style.setProperty(prop,round(value)+'px','important');
 }
 el.style.setProperty('right','auto','important');
 el.style.setProperty('bottom','auto','important');
}
function selectorText(root){
 return root.querySelectorAll(
 '.card .edit,.card .itemInput,.card td,.card th,.card .cardHead,.card .step,'+
 '.card .value,#nameStrip .edit,#nameStrip .namedish,#nameStrip .namecode,'+
 '#factBox .value,#factBox b,#foot .sign,#foot .edit'
 );
}
function scaleText(root,mult){
 for(const el of selectorText(root)){
  if(!el.dataset.a4BaseSize){
   const num=parseFloat(getComputedStyle(el).fontSize);
   if(num>=6&&num<=32)el.dataset.a4BaseSize=String(num);
  }
  const original=Number(el.dataset.a4BaseSize||0);
  if(original)el.style.setProperty('font-size',Math.max(7.1,original*mult).toFixed(2)+'px','important');
 }
}
function isOverflow(el){
 return !!el&&el.clientHeight>0&&(
  el.scrollHeight>el.clientHeight+2 || el.scrollWidth>el.clientWidth+3
 );
}
function overflowingBlock(root){
 const cards=[...root.querySelectorAll('.card')];
 return cards.filter(card=>{
  if(isOverflow(card))return true;
  const inner=[...card.querySelectorAll('.body,#process,#f5,#recipeTable,#recipeLines,.edit,.processSteps,.step,#allergy,#qualityTable,#nutritionTable')];
  return inner.some(el=>isOverflow(el));
 });
}
function fitText(root){
 const cfg=current();if(!cfg)return false;
 const preferred=clamp(cfg.font||100,75,115)/100;
 let factor=preferred;
 for(let k=0;k<22;k++){
  scaleText(root,factor);
  if(!overflowingBlock(root).length)break;
  factor=Math.max(.66,factor-.025);
  if(factor<=.66){scaleText(root,factor);break}
 }
 const failed=overflowingBlock(root);
 root.dataset.a4TextScale=String(round(factor*100));
 const status=$('a4FitStatus');
 if(status){
  status.classList.toggle('a4-error',failed.length>0);
  status.textContent=failed.length?
   '⚠ Не всё помещается: '+failed.map(el=>el.querySelector('.cardHead')?.textContent.trim()||'раздел').join(', ')+'. Увеличьте нужные блоки или сократите текст без удаления обязательных данных.':
   '✓ Текст подогнан к формату А4. Текущий масштаб текста: '+round(factor*100)+'%.';
 }
 return failed.length===0;
}
function apply(){
 const root=paper(),cfg=current();if(!root||!cfg)return;
 root.classList.toggle('a4-layout-active',layoutMode);
 root.style.removeProperty('--a4-own-accent');
 if(/^#[0-9a-fA-F]{6}$/.test(cfg.accent||'')){
  root.style.setProperty('--ttk-red',cfg.accent);
  root.style.setProperty('--a4-own-accent',cfg.accent);
 }
 for(const b of BLOCKS){
  const el=root.querySelector(b.selector);if(!el)continue;
  el.dataset.a4Block=b.key;el.dataset.a4Name=b.name;
  if(layoutMode&&!el.querySelector(':scope > .a4-resize-handle')){
   const grip=document.createElement('i');grip.className='a4-resize-handle';grip.setAttribute('aria-hidden','true');el.appendChild(grip);
  }
  if(!layoutMode)el.querySelector(':scope > .a4-resize-handle')?.remove();
  if(cfg.blocks[b.key])setPosition(el,cfg.blocks[b.key]);
  if(selectedKey===b.key&&layoutMode)el.classList.add('a4-selected');
  else el.classList.remove('a4-selected');
 }
 fitText(root);
 refreshUI(false);
}
function refreshUI(resetControls){
 const cfg=current();if(!cfg)return;
 if($('a4Font')){$('a4Font').value=String(cfg.font||100);$('a4FontValue').textContent=(cfg.font||100)+'%'}
 if($('a4Accent'))$('a4Accent').value=cfg.accent||'#e72339';
 if($('a4MoveToggle')){$('a4MoveToggle').textContent=layoutMode?'✓ Режим макета включён':'↔ Перемещать блоки на листе';$('a4MoveToggle').setAttribute('aria-pressed',String(layoutMode))}
 const selected=selectedKey&&blockFor(selectedKey);
 const panel=$('a4Inspector');
 if(panel){
  panel.hidden=!selected;
  if(selected){
   $('a4SelectedName').textContent=BLOCKS.find(b=>b.key===selectedKey)?.name||selectedKey;
   const v=rect(selected);
   for(const k of ['x','y','w','h']){const input=$('a4Coord'+k.toUpperCase());if(input&&(resetControls||document.activeElement!==input))input.value=String(v[k])}
  }
 }
}
function pick(key){
 selectedKey=key;
 paper()?.querySelectorAll('.a4-selected').forEach(e=>e.classList.remove('a4-selected'));
 const target=blockFor(key);
 if(target&&layoutMode)target.classList.add('a4-selected');
 refreshUI(true);
}
function saveBlock(key,v){
 const cfg=current();if(!cfg||!key)return;
 const bounds={
  x:clamp(v.x,0,PAGE_W-30),y:clamp(v.y,0,PAGE_H-25),
  w:clamp(v.w,30,PAGE_W),h:clamp(v.h,25,PAGE_H)
 };
 bounds.w=Math.min(bounds.w,PAGE_W-bounds.x);
 bounds.h=Math.min(bounds.h,PAGE_H-bounds.y);
 cfg.blocks[key]=Object.fromEntries(Object.entries(bounds).map(([k,n])=>[k,round(n)]));
 setPosition(blockFor(key),cfg.blocks[key]);
 fitText(paper());mark();bridge?.checkOverflow();refreshUI(false);
}
function onDown(e){
 if(!layoutMode||e.button!==0||!doc())return;
 const item=e.target.closest('[data-a4-block]');
 if(!item||!paper()?.contains(item))return;
 if(e.target.closest('.a4-resize-handle'))e.stopPropagation();
 e.preventDefault();
 const key=item.dataset.a4Block;
 pick(key);
 const p=paper().getBoundingClientRect(),scale=p.width/PAGE_W||1;
 pointer={key,id:e.pointerId,mode:e.target.closest('.a4-resize-handle')?'resize':'move',
  x:e.clientX,y:e.clientY,scale,start:rect(item)};
 try{$('paper').setPointerCapture(e.pointerId)}catch{}
}
function onMove(e){
 if(!pointer||e.pointerId!==pointer.id)return;
 const p=pointer,dx=(e.clientX-p.x)/p.scale,dy=(e.clientY-p.y)/p.scale;
 const next={...p.start};
 if(p.mode==='resize'){next.w+=dx;next.h+=dy}
 else{next.x+=dx;next.y+=dy}
 saveBlock(p.key,next);
}
function onUp(e){
 if(!pointer||e.pointerId!==pointer.id)return;
 pointer=null;
 try{$('paper').releasePointerCapture(e.pointerId)}catch{}
 bridge?.checkOverflow();
}
function onCoord(e){
 const key=selectedKey,el=blockFor(key);if(!key||!el)return;
 const v=rect(el);
 const prop=e.target.dataset.a4Coord;
 if(!['x','y','w','h'].includes(prop))return;
 v[prop]=Number(e.target.value);
 saveBlock(key,v);
}
function switchMode(force){
 layoutMode=typeof force==='boolean'?force:!layoutMode;
 if(layoutMode&&!selectedKey)selectedKey='recipe';
 if(!layoutMode)selectedKey=null;
 apply();
 refreshUI(true);
}
function onKeyboard(e){
 if(!layoutMode||!selectedKey)return;
 if(document.activeElement?.matches('input,textarea,[contenteditable]'))return;
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
 e.preventDefault();
 const el=blockFor(selectedKey);if(!el)return;
 const v=rect(el),step=e.shiftKey?10:1;
 if(e.key==='ArrowUp')v.y-=step;
 if(e.key==='ArrowDown')v.y+=step;
 if(e.key==='ArrowLeft')v.x-=step;
 if(e.key==='ArrowRight')v.x+=step;
 saveBlock(selectedKey,v);
}
function setup(){
 if(initialized)return;
 initialized=true;
 const panel=document.querySelector('[data-tab-panel="design"]');
 if(!panel)return;
 const ui=document.createElement('section');
 ui.className='a4-designer-panel';
 ui.innerHTML=
 '<div class="a4-designer-head"><strong>✦ Дизайнер листа А4</strong><small>Персональный макет для каждого из трёх шаблонов</small></div>'+
 '<p>Меняйте расположение блоков прямо на листе: перетаскивайте мышью или пальцем, меняйте размеры за угол. Текст блюда редактируется на листе при выключенном режиме макета.</p>'+
 '<div class="a4-control-grid">'+
 '<label>Размер текста <b id="a4FontValue">100%</b><input id="a4Font" type="range" min="75" max="115" step="5" value="100"></label>'+
 '<label>Акцентный цвет<input id="a4Accent" type="color" value="#e72339"></label>'+
 '</div>'+
 '<div class="a4-actions"><button type="button" id="a4MoveToggle" class="btn btn-primary btn-sm" aria-pressed="false">↔ Перемещать блоки на листе</button>'+
 '<button type="button" id="a4FitButton" class="btn btn-light btn-sm">Подогнать текст</button>'+
 '<button type="button" id="a4Reset" class="btn btn-light btn-sm">Вернуть исходный макет</button></div>'+
 '<div id="a4Inspector" class="a4-inspector" hidden><strong id="a4SelectedName">Раздел</strong>'+
 '<div class="a4-number-grid">'+
 '<label>X, px<input type="number" min="0" max="794" id="a4CoordX" data-a4-coord="x"></label>'+
 '<label>Y, px<input type="number" min="0" max="1123" id="a4CoordY" data-a4-coord="y"></label>'+
 '<label>Ширина, px<input type="number" min="30" max="794" id="a4CoordW" data-a4-coord="w"></label>'+
 '<label>Высота, px<input type="number" min="25" max="1123" id="a4CoordH" data-a4-coord="h"></label>'+
 '</div><small>Точная настройка положения выбранного блока. Стрелки — сдвиг на 1 px, Shift + стрелка — 10 px.</small></div>'+
 '<div id="a4FitStatus" class="a4-fit-status" role="status">Автоподгонка включена.</div>'+
 '<small class="a4-note">⚠ Если текста физически больше, чем вмещает читаемый А4, система предупредит и не обрежет сведения при печати. Изменения сохраняются кнопкой «Сохранить ТТК».</small>';
 panel.appendChild(ui);
 const quick=document.createElement('button');
 quick.className='a4-quick-toggle';quick.type='button';quick.id='a4QuickToggle';
 quick.textContent='✦ Настроить макет А4';
 document.querySelector('.sheet-stylebar .sheet-styleleft')?.appendChild(quick);
 quick.addEventListener('click',()=>{
  document.querySelector('[data-tab="design"]')?.click();
  switchMode(true);
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
 });
 $('a4MoveToggle').addEventListener('click',()=>switchMode());
 $('a4Font').addEventListener('input',e=>{const cfg=current();if(!cfg)return;cfg.font=Number(e.target.value);apply();mark();bridge?.checkOverflow()});
 $('a4Accent').addEventListener('input',e=>{const cfg=current();if(!cfg)return;cfg.accent=e.target.value;apply();mark()});
 $('a4FitButton').addEventListener('click',()=>{apply();bridge?.checkOverflow()});
 $('a4Reset').addEventListener('click',()=>{
  const cfg=current();if(!cfg||!confirm('Восстановить исходное расположение и размеры блоков для выбранного шаблона? Текст ТТК останется без изменений.'))return;
  cfg.blocks={};cfg.font=100;cfg.accent='';
  selectedKey=null;bridge?.rerender();mark();
 });
 for(const input of ui.querySelectorAll('[data-a4-coord]'))input.addEventListener('change',onCoord);
 $('paper').addEventListener('pointerdown',onDown);
 $('paper').addEventListener('pointermove',onMove);
 $('paper').addEventListener('pointerup',onUp);
 $('paper').addEventListener('pointercancel',onUp);
 document.addEventListener('keydown',onKeyboard);
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-sheet-theme],[data-editor-template]')){pointer=null;selectedKey=null}
 });
 const printStyle=document.createElement('link');printStyle.rel='stylesheet';printStyle.href='./a4-design-editor.css?v=20261112-v1';document.head.appendChild(printStyle);
}
window.FARUKH_A4_EDITOR={
 init(api){bridge=api;setup()},
 apply,
 fit(){if(paper())fitText(paper())},
 hasOverflow(){return !!paper()&&overflowingBlock(paper()).length>0},
 isLayoutMode(){return layoutMode}
};
})();