import {PREMIUM_TTK_THEMES} from './ttk-premium-themes.js';
/* Four owner-approved premium A4 TTK visual layouts.
   Separate from "Мои шаблоны" recipe-content templates:
   style changes never overwrite recipe ingredients or technology. */
export const TTK_LAYOUTS=Object.freeze(
 PREMIUM_TTK_THEMES.map(({id,name,subtitle,tone})=>({id,name,subtitle,tone,description:'Единая сетка: 1|2, 3|4, 5|6, 7|аллергены. Логотип и галочки.'}))
);
const LEGACY_TTK_LAYOUTS=Object.freeze([
 {id:'arctic-a4',name:'Arctic Glass (ранее)',subtitle:'Светло-голубой',tone:'arctic'},
 {id:'royal-a4',name:'Royal Blue (ранее)',subtitle:'Тёмно-синий',tone:'royal'}
]);
const allStyles=[...TTK_LAYOUTS,...LEGACY_TTK_LAYOUTS];
export const TTK_DEFAULT_LAYOUT='emerald-gold-a4';
export const ttkLayoutId=value=>allStyles.some(i=>i.id===value)?value:TTK_DEFAULT_LAYOUT;
export const ttkLayout=key=>allStyles.find(i=>i.id===ttkLayoutId(key));
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
export function layoutPreview(item){
 const page=el('div','ttk-design-thumb ttk-design-'+item.tone);
 page.setAttribute('aria-hidden','true');
 page.innerHTML='<div class="ttk-design-preview-top"><b>A</b><span>FARRUH AI</span><i></i></div>'+
 '<div class="ttk-design-preview-heading">ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА</div>'+
 '<div class="ttk-design-preview-hero"><div class="ttk-design-preview-fields"><i></i><i></i><i></i><i></i></div><div class="ttk-design-preview-photo">▧</div></div>'+
 '<div class="ttk-design-preview-two"><div><b>1 · Применение</b><i></i><i></i></div><div><b>2 · Сырьё</b><i></i><i></i></div></div>'+
 '<div class="ttk-design-preview-two"><div><b>3 · Рецептура</b><i></i><i></i><i></i></div><div><b>4 · Технология</b><i></i><i></i><i></i></div></div>'+
 '<div class="ttk-design-preview-two"><div><b>5 · Хранение</b><i></i><i></i></div><div><b>6 · Качество</b><i></i><i></i></div></div>'+
 '<div class="ttk-design-preview-two lower"><div><b>7 · КБЖУ</b><i></i><i></i></div><div><b>Аллергены ☑</b><i></i><i></i></div></div>'+
 '<div class="ttk-design-preview-signatures">Разработал __________　 Утвердил __________</div>';
 return page;
}
export function layoutCard(item,selected,onPick){
 const b=el('button','ttk-design-card ttk-design-card-'+item.tone);
 b.type='button';b.dataset.ttkLayout=item.id;b.setAttribute('aria-pressed',String(!!selected));
 const picture=layoutPreview(item);const info=el('span','ttk-design-info');
 info.append(el('strong','',item.name),el('small','',item.subtitle),el('em','',selected?'✓ Выбран':'Выбрать оформление'));
 b.append(picture,info);
 b.addEventListener('click',()=>onPick(item.id));
 return b;
}
export function mountTtkDesignPicker(editor,{onChange=()=>{}}={}){
 if(!editor)throw Error('Не найден редактор ТТК');
 const panel=el('section','ttk-design-picker');
 panel.id='ttk-design-picker';panel.append(el('h3','','Шаблон оформления · A4'));
 panel.append(el('p','ttk-design-help','Четыре премиальных цвета с одинаковой двухколоночной сеткой. В Word и PDF сохраняются те же разделы, состав и аллергены. Ранее сохранённые стили продолжают работать в старых картах.'));
 const grid=el('div','ttk-design-grid');panel.append(grid);
 const tools=editor.querySelector('.lx-editor-extras')||editor.querySelector('.editor-modes')||editor.firstElementChild;
 tools?.after(panel);
 let chosen=TTK_DEFAULT_LAYOUT;
 function select(id,{notify=true}={}){
  chosen=ttkLayoutId(id);
  grid.replaceChildren(...TTK_LAYOUTS.map(item=>layoutCard(item,item.id===chosen,select)));
  editor.dataset.ttkLayout=chosen;
  const paper=editor.querySelector('.ttk-paper');if(paper)paper.dataset.ttkLayout=chosen;
  if(notify)onChange(chosen);
 }
 select(chosen,{notify:false});
 document.addEventListener('ttk:choose-layout',e=>select(e.detail?.id));
 return {populate:recipe=>select(recipe?.layoutTemplate,{notify:false}),get:()=>chosen,select};
}
