/* Two owner-approved A4 TTK visual layouts.
   Separate from "Мои шаблоны" recipe-content templates:
   style changes never overwrite recipe ingredients or technology. */
export const TTK_LAYOUTS=Object.freeze([
 {id:'arctic-a4',name:'01 · Arctic Glass',subtitle:'Светло-голубой · премиальные блоки',description:'Ледяной голубой, белые карточки, плавные линии. Фото блюда сохраняется с исходным фоном.',tone:'arctic'},
 {id:'royal-a4',name:'02 · Royal Blue',subtitle:'Тёмно-синий · золото · белый',description:'Представительный документ с глубокими синими заголовками, тонкими золотыми линиями и фотографией.',tone:'royal'}
]);
export const TTK_DEFAULT_LAYOUT='arctic-a4';
export const ttkLayoutId=value=>TTK_LAYOUTS.some(i=>i.id===value)?value:TTK_DEFAULT_LAYOUT;
export const ttkLayout=key=>TTK_LAYOUTS.find(i=>i.id===ttkLayoutId(key));
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
export function layoutPreview(item){
 const page=el('div','ttk-design-thumb ttk-design-'+item.tone);
 page.setAttribute('aria-hidden','true');
 page.innerHTML='<div class="ttk-design-preview-top"><b>A</b><span>FARRUH AI</span><i></i></div>'+
 '<div class="ttk-design-preview-heading">ТЕХНОЛОГИЧЕСКАЯ КАРТА</div>'+
 '<div class="ttk-design-preview-hero"><div class="ttk-design-preview-fields"><i></i><i></i><i></i><i></i></div><div class="ttk-design-preview-photo">▧</div></div>'+
 '<div class="ttk-design-preview-line"></div><div class="ttk-design-preview-two"><div><b></b><i></i><i></i><i></i><i></i></div><div><b></b><i></i><i></i><i></i><i></i></div></div>'+
 '<div class="ttk-design-preview-two lower"><div><b></b><i></i><i></i></div><div><b></b><i></i><i></i></div></div>'+
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
 panel.append(el('p','ttk-design-help','Выбери один из двух утверждённых дизайнов. Состав, КБЖУ и технология не меняются. Фото остаётся с исходным фоном.'));
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
