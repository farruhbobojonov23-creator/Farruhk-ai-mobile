// Both editor modes use the very same controls, validation and export calculations.
export function mountRecipeFill(editor,{refresh}){
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
 const paper=editor.querySelector('.ttk-viewport'),guide=editor.querySelector('.ttk-guidance'),tools=editor.querySelector('.ttk-template-tools');
 const tabs=el('div','chef-mode-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Режим техкарты');
 const fillButton=el('button','','Заполнение'),sheetButton=el('button','','Лист А4');for(const b of [fillButton,sheetButton])b.type='button';tabs.append(fillButton,sheetButton);
 editor.querySelector('.ttk-toolbar').after(tabs);const fill=el('div','chef-recipe-fill');paper.before(fill);
 const moves=[];
 function field(parent,id,label){const input=$(id);if(!input)return;const slot=document.createComment(id);input.before(slot);const wrap=el('label','chef-field',label);wrap.append(input);parent.append(wrap);moves.push({input,slot,wrap})}
 function group(title,open=false){const box=el('details','chef-fill-group');box.open=open;box.append(el('summary','',title));const body=el('div','chef-fill-body');box.append(body);fill.append(box);return body}
 const meta=el('div','chef-fill-meta');fill.append(meta);for(const [id,label] of [['recipe-name','Название блюда'],['recipe-category','Категория'],['recipe-status','Статус'],['card-pieces','Количество'],['card-number','Номер ТТК'],['card-date','Дата']])field(meta,id,label);
 const ingredients=group('Ингредиенты',true);for(const id of ['ingredients','addingredient']){const input=$(id),slot=document.createComment(id);input.before(slot);ingredients.append(input);moves.push({input,slot,wrap:ingredients})}field(ingredients,'card-yield','Выход готового блюда, г');
 const tech=group('Технология');for(const [id,label] of [['card-prep','Подготовка'],['technology','Формовка / приготовление'],['card-serving','Нарезка / подача'],['card-storage','Хранение и реализация']])field(tech,id,label);
 const quality=group('Качество и требования');for(const [id,label] of [['card-scope','Область применения'],['card-raw','Требования к сырью'],['card-appearance','Внешний вид'],['card-taste','Вкус и консистенция'],['card-safety','Безопасность']])field(quality,id,label);
 const nutrition=group('КБЖУ');field(nutrition,'nutrition-auto','Автоматический расчёт по ингредиентам');for(const [key,label] of [['protein','Белки, г'],['fat','Жиры, г'],['carbs','Углеводы, г'],['kcal','Ккал']])field(nutrition,'card-'+key,label+' на 100 г');
 const products=$('nutrition-products'),productSlot=document.createComment('nutrition-products');products.before(productSlot);nutrition.append(products);moves.push({input:products,slot:productSlot,wrap:nutrition});
 const sign=group('Разработал и утвердил');field(sign,'card-chef','Разработал (шеф)');field(sign,'card-approver','Утверждаю (руководитель)');
 const footer=el('div','chef-fill-footer'),preview=el('button','','Предпросмотр А4'),save=el('button','primary','Сохранить');preview.type='button';save.type='submit';footer.append(preview,save);fill.append(footer);
 function mode(value){editor.dataset.editorMode=value;const filling=value==='fill';for(const {input,slot,wrap} of moves)if(filling)wrap.append(input);else slot.after(input);fill.hidden=!filling;paper.hidden=filling;guide.hidden=filling;tools.hidden=filling;fillButton.setAttribute('aria-pressed',String(filling));sheetButton.setAttribute('aria-pressed',String(!filling));refresh()}
 fillButton.onclick=()=>mode('fill');sheetButton.onclick=preview.onclick=()=>mode('sheet');
 editor.addEventListener('invalid',event=>{event.target.closest('details')?.setAttribute('open','')},true);
 mode('fill');return {mode};
}
