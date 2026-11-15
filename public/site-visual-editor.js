/* FARRUH AI — actual on-screen visual editor, no placeholder controls.
 * Owner-only initialization. Visual changes are reversible and stored on this device.
 * Do not alter recipe payloads, print documents, API credentials, or form values.
 */
const STORAGE_KEY='farruh-ai-visual-layout-v1';
const PAGES=[['home','Главная'],['recipes','ТТК'],['preparations','Полуфабрикаты'],['lab','ХАССП'],['tasks','Задачи'],['calc','Калькулятор'],['checks','Контроль точек'],['print-control','Печать'],['chat','Ассистент'],['site-settings','Настройки']];
const EDIT_STYLES={
 color:'color',background:'background-color',fontSize:'font-size',
 fontFamily:'font-family',fontWeight:'font-weight',borderRadius:'border-radius',
 padding:'padding',order:'order',textAlign:'text-align',width:'width'
};
const textNodes=element=>{
 const found=[],walk=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
 while(walk.nextNode()){
  const n=walk.currentNode;
  if(n.nodeValue.trim()&&!n.parentElement.closest('svg,script,style'))found.push(n);
 }
 return found;
};
const textNode=element=>textNodes(element)[0]||null;
const toHex=color=>{
 if(/^#[0-9a-f]{6}$/i.test(color))return color;
 const v=(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
 return v.length===3?'#'+v.map(x=>Math.min(255,Math.max(0,Math.round(x))).toString(16).padStart(2,'0')).join(''):'#e9bd72';
};
const clone=value=>JSON.parse(JSON.stringify(value));
const cleanValue=(key,val)=>{
 if(key==='color'||key==='background')return /^#[0-9a-f]{6}$/i.test(val)?val:null;
 if(key==='fontSize')return Number.isFinite(+val)&&+val>=8&&+val<=80?+val+'px':null;
 if(key==='borderRadius')return Number.isFinite(+val)&&+val>=0&&+val<=64?+val+'px':null;
 if(key==='padding')return Number.isFinite(+val)&&+val>=0&&+val<=100?+val+'px':null;
 if(key==='width')return val==='auto'?'auto':Number.isFinite(+val)&&+val>=0&&+val<=1500?+val+'px':null;
 if(key==='order')return Number.isInteger(+val)&&+val>=-100&&+val<=100?String(+val):null;
 if(key==='fontWeight')return ['400','500','600','700','800'].includes(String(val))?String(val):null;
 if(key==='textAlign')return ['left','center','right'].includes(val)?val:null;
 if(key==='fontFamily')return ['inherit','Arial, sans-serif','Georgia, serif','system-ui, sans-serif','monospace'].includes(val)?val:null;
 return null;
};
function loadRecords(){
 try {
  const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  if(!Array.isArray(data))return [];
  return data.filter(r=>r&&typeof r.selector==='string'&&r.selector.length<550&&
   r.selector.startsWith('#')&&r.selector.indexOf('>')>=0).slice(0,250);
 }catch{return [];}
}
function selectorFor(element){
 const root=element.closest('.view,#chef-menu');
 if(!root||!root.id||element===root)return '';
 let el=element;
 const parts=[];
 for(let depth=0;el&&el!==root&&depth<22;depth++){
  const parent=el.parentElement;if(!parent)return '';
  const tag=el.tagName.toLowerCase();
  const same=[...parent.children].filter(n=>n.tagName===el.tagName);
  const idx=same.indexOf(el)+1;
  if(idx<1)return '';
  parts.unshift(tag+':nth-of-type('+idx+')');
  el=parent;
 }
 if(el!==root)return '';
 return '#'+CSS.escape(root.id)+' > '+parts.join(' > ');
}
function create(tag,className,label){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(label!==undefined)el.textContent=label;
 return el;
}
export function mountVisualEditor({show}={}){
 if(window.__faiVisualEditor)return window.__faiVisualEditor;
 const original=new WeakMap(),tracked=new Set();
 let active=false,panel=null,selected=null,selectedKey='',saved=loadRecords(),draft=clone(saved),lastCommit=null;
 const managed=Object.values(EDIT_STYLES);
 const register=el=>{
  if(original.has(el))return;
  const styles={};for(const prop of [...managed,'display'])styles[prop]=[el.style.getPropertyValue(prop),el.style.getPropertyPriority(prop)];
  const node=textNode(el);
  original.set(el,{styles,text:node?.nodeValue??null,node});
  tracked.add(el);
 };
 function restore(el){
  const before=original.get(el);if(!before)return;
  for(const [prop,[value,priority]] of Object.entries(before.styles)){
   if(value)el.style.setProperty(prop,value,priority);else el.style.removeProperty(prop);
  }
  const n=before.node;
  if(n?.isConnected&&before.text!==null&&n.nodeValue!==before.text)n.nodeValue=before.text;
 }
 function applyRecords(records=draft){
  for(const el of tracked){if(!el.isConnected){tracked.delete(el);continue;}restore(el);}
  for(const record of records){
   let el;try{el=document.querySelector(record.selector)}catch{continue}
   if(!el||el.closest('#fai-visual-editor-panel'))continue;
   register(el);
   if(record.label!==undefined&&typeof record.label==='string'){
    const node=textNode(el);
    if(node&&node.nodeValue!==record.label)node.nodeValue=record.label.slice(0,180);
   }
   for(const [key,prop] of Object.entries(EDIT_STYLES)){
    const val=record.styles?.[key];
    if(val===undefined)continue;
    const safe=cleanValue(key,val);if(safe!==null&&el.style.getPropertyValue(prop)!==safe)el.style.setProperty(prop,safe,'important');
   }
   if(record.hidden&&el.style.getPropertyValue('display')!=='none')el.style.setProperty('display','none','important');
  }
 }
 function getRecord(selector){
  let rec=draft.find(r=>r.selector===selector);
  if(!rec){rec={selector,styles:{},hidden:false};draft.push(rec);}
  return rec;
 }
 function mutate(updater){
  if(!selectedKey)return;
  lastCommit=clone(draft);
  const rec=getRecord(selectedKey);
  updater(rec);
  applyRecords(draft);
  refreshHidden();
 }
 function inputRow(label,field){const wrap=create('label','fai-ve-field');wrap.append(create('span','',label),field);return wrap;}
 function buildPanel(){
  const ui=create('aside','fai-ve-panel');ui.id='fai-visual-editor-panel';ui.setAttribute('aria-label','Визуальный редактор FARRUH AI');
  const head=create('div','fai-ve-top');
  const names=create('div');
  names.append(create('strong','','✏️ Визуальная настройка'),create('small','','Коснитесь элемента, чтобы изменить его. Сохранение действует на этом устройстве.'));
  const close=create('button','fai-ve-close','✕');close.type='button';close.setAttribute('aria-label','Закрыть без сохранения');close.onclick=cancel;
  head.append(names,close);ui.append(head);
  const choice=create('select','fai-ve-page');choice.setAttribute('aria-label','Открыть страницу для редактирования');
  for(const [id,name] of PAGES)choice.add(new Option(name,id));
  choice.onchange=()=>{selected=null;selectedKey='';show?.(choice.value);clearHighlight();showInspector();};
  const nav=inputRow('Страница',choice);ui.append(nav);
  const chosen=create('p','fai-ve-selected','Выберите элемент на странице.');chosen.dataset.selected='1';ui.append(chosen);
  const inspector=create('div','fai-ve-inspector');inspector.dataset.inspector='1';ui.append(inspector);
  const hidden=create('details','fai-ve-hidden');hidden.innerHTML='<summary>Скрытые элементы · восстановить</summary><div data-hidden-list></div>';ui.append(hidden);
  const actions=create('div','fai-ve-actions');
  const undo=create('button','','↶ Отменить');undo.type='button';undo.onclick=()=>{if(!lastCommit)return;draft=lastCommit;lastCommit=null;applyRecords(draft);showInspector();refreshHidden();};
  const cancelButton=create('button','','Отмена');cancelButton.type='button';cancelButton.onclick=cancel;
  const save=create('button','fai-ve-save','✓ Сохранить');save.type='button';save.onclick=commit;
  const resetAll=create('button','fai-ve-danger','Сбросить все изменения');resetAll.type='button';
  resetAll.onclick=()=>{if(!confirm('Вернуть исходное оформление всех страниц на этом устройстве? Техкарты не затрагиваются.'))return;lastCommit=clone(draft);draft=[];applyRecords(draft);refreshHidden();showInspector();};
  actions.append(undo,cancelButton,save);ui.append(actions,resetAll);
  document.body.append(ui);
  panel=ui;showInspector();refreshHidden();
 }
 function clearHighlight(){
  document.querySelectorAll('[data-fai-ve-highlight]').forEach(el=>el.removeAttribute('data-fai-ve-highlight'));
 }
 function showInspector(){
  if(!panel)return;
  const inspect=panel.querySelector('[data-inspector]');inspect.replaceChildren();
  const label=panel.querySelector('[data-selected]');
  if(!selected||!selected.isConnected){label.textContent='Нажмите на текст, кнопку или блок на странице.';return;}
  label.textContent='Выбрано: '+selected.tagName.toLowerCase()+
   ' · '+(selected.textContent||'Элемент').trim().slice(0,48);
  const rec=draft.find(r=>r.selector===selectedKey)||{styles:{},hidden:false};
  const computed=getComputedStyle(selected);
  const text=textNode(selected);
  const name=create('input');name.type='text';name.maxLength=180;name.placeholder='Текст';name.value=rec.label??(text?.nodeValue.trim()||'');
  name.addEventListener('change',()=>mutate(r=>{r.label=name.value}));inspect.append(inputRow('Надпись',name));
  const grid=create('div','fai-ve-grid');inspect.append(grid);
  const field=(title,key,type,defaultValue,options)=>{
   const control=options?create('select'):create('input');control.dataset.key=key;
   if(options){for(const [id,label] of options)control.add(new Option(label,id))}
   else{control.type=type;if(type==='number'){control.step='1';control.min='0'}}
   const raw=rec.styles?.[key];
   control.value=raw!==undefined?String(raw).replace(/px$/,''):defaultValue;
   control.addEventListener(type==='color'?'input':'change',()=>{
    mutate(r=>{const v=cleanValue(key,control.value);
      if(v!==null){r.styles??={};r.styles[key]=control.value;}});
   });
   grid.append(inputRow(title,control));return control;
  };
  field('Цвет текста','color','color',toHex(computed.color));
  field('Цвет фона','background','color',toHex(computed.backgroundColor));
  field('Размер шрифта, px','fontSize','number',Math.round(parseFloat(computed.fontSize))||16);
  field('Скругление, px','borderRadius','number',Math.round(parseFloat(computed.borderTopLeftRadius))||0);
  field('Отступы, px','padding','number',Math.round(parseFloat(computed.paddingTop))||0);
  field('Порядок','order','number',computed.order==='0'?'0':parseInt(computed.order)||0);
  field('Шрифт','fontFamily','select','inherit',[
   ['inherit','Как на сайте'],['system-ui, sans-serif','Системный'],['Arial, sans-serif','Arial'],
   ['Georgia, serif','Georgia'],['monospace','Моноширинный']]);
  field('Толщина текста','fontWeight','select','400',[
   ['400','Обычный'],['500','Средний'],['600','Полужирный'],['700','Жирный'],['800','Очень жирный']]);
  field('Выравнивание','textAlign','select',computed.textAlign==='center'?'center':'left',[
   ['left','Слева'],['center','По центру'],['right','Справа']]);
  const bar=create('div','fai-ve-element-actions');
  const hide=create('button','fai-ve-danger',rec.hidden?'↶ Показать':'✕ Скрыть / убрать');hide.type='button';
  hide.onclick=()=>{
   mutate(r=>{r.hidden=!r.hidden});
   if(draft.find(x=>x.selector===selectedKey)?.hidden){clearHighlight();selected=null;selectedKey='';}
   showInspector();
  };
  const reset=create('button','','Сбросить элемент');reset.type='button';
  reset.onclick=()=>{lastCommit=clone(draft);draft=draft.filter(x=>x.selector!==selectedKey);applyRecords(draft);showInspector();refreshHidden();};
  bar.append(hide,reset);inspect.append(bar);
 }
 function refreshHidden(){
  if(!panel)return;
  const list=panel.querySelector('[data-hidden-list]');list.replaceChildren();
  const hidden=draft.filter(r=>r.hidden);
  for(const r of hidden){
   const row=create('div','fai-ve-hidden-row');
   row.append(create('span','',r.label||r.selector.slice(-75)));
   const showButton=create('button','','Восстановить');showButton.type='button';
   showButton.onclick=()=>{lastCommit=clone(draft);r.hidden=false;applyRecords(draft);refreshHidden();showInspector();};
   row.append(showButton);list.append(row);
  }
  if(!hidden.length)list.append(create('p','','Нет скрытых элементов.'));
 }
 function selectFrom(event){
  if(!active||!panel)return;
  if(event.target.closest('#fai-visual-editor-panel'))return;
  const inApp=event.target.closest('.view,#chef-menu');
  if(!inApp)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(event.target.closest('input,textarea,select,form,dialog,#editor,.login-overlay'))return;
  let target=event.target.closest('button,a,h1,h2,h3,h4,p,small,strong,summary,label,article,span,section,div');
  if(!target||target===inApp)return;
  // Do not permit saving an override that hides the entire page or data form.
  if(target.matches('.view,form,nav,main,header')||target.closest('#fai-visual-editor-panel'))return;
  const selector=selectorFor(target);if(!selector)return;
  selected=target;selectedKey=selector;
  clearHighlight();target.setAttribute('data-fai-ve-highlight','1');showInspector();
 }
 async function commit(){
  try{
   if(draft.length>250)throw Error('Превышено количество настроек (250).');
   const value=JSON.stringify(draft);
   if(value.length>200000)throw Error('Слишком много данных оформления.');
   localStorage.setItem(STORAGE_KEY,value);
   saved=clone(draft);exit();applyRecords(saved);
  }catch(error){alert('Не удалось сохранить оформление: '+error.message)}
 }
 function exit(){
  active=false;selected=null;selectedKey='';clearHighlight();
  document.body.classList.remove('fai-ve-active');panel?.remove();panel=null;
 }
 function cancel(){draft=clone(saved);exit();applyRecords(saved);}
 function open(){
  if(active)return;
  saved=loadRecords();draft=clone(saved);lastCommit=null;active=true;
  document.body.classList.add('fai-ve-active');
  show?.('home');
  buildPanel();panel.querySelector('.fai-ve-page').value='home';
  applyRecords(draft);
 }
 document.addEventListener('click',selectFrom,true);
 const observer=new MutationObserver(mutations=>{
  if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&
    !n.matches?.('#fai-visual-editor-panel')&&!n.closest?.('#fai-visual-editor-panel')))){
   clearTimeout(observer.timer);
   observer.timer=setTimeout(()=>applyRecords(active?draft:saved),70);
  }
 });
 observer.observe(document.body,{subtree:true,childList:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)applyRecords(active?draft:saved)});
 setTimeout(()=>applyRecords(saved),0);
 const api={open,isActive:()=>active};window.__faiVisualEditor=api;
 if(new URLSearchParams(location.search).get('visualEditor')==='1')setTimeout(open,120);
 return api;
}
