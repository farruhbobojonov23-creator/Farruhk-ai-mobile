import {templateFor,recipeCategories} from './recipe-math.js?v=categories-13';
export const fields={preparation:'4. Подготовка',forming:'4. Приготовление',serving:'4. Нарезка и подача',storage:'5. Оформление, подача и хранение',shelfLife:'5. Срок годности',temperature:'5. Температура хранения',appearance:'6. Внешний вид',taste:'6. Вкус, запах и консистенция'};
export function validateMyTemplates(list){
 if(list===undefined)return;
 if(!Array.isArray(list)||list.some(t=>!t||typeof t.id!=='string'||typeof t.name!=='string'||!t.name.trim()||typeof t.category!=='string'||Object.keys(fields).some(k=>typeof t[k]!=='string'||t[k].length>10000)))throw Error('Повреждены мои шаблоны техкарт.');
}
export function templateValues(t){return {...t,storage:[t.storage,t.shelfLife?'Срок годности: '+t.shelfLife:'',t.temperature?'Температура хранения: '+t.temperature:''].filter(Boolean).join('\n')};}
export function mountMyRecipeTemplates({getState,save,createRecipe,notify}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const dialog=el('dialog');dialog.className='category-dialog';dialog.style.cssText='width:min(720px,94vw);max-height:90dvh;overflow:auto;padding:20px';dialog.setAttribute('aria-label','Мои шаблоны');document.body.append(dialog);
 const heading=el('div');heading.className='bar';heading.append(el('h2','Мои шаблоны'),button('Закрыть',()=>close()));dialog.append(heading);
 const list=el('div'),form=el('form');dialog.append(list,form);
 let draft=null,dirty=false;
 const close=()=>{if(dirty&&!confirm('Отменить несохранённые изменения шаблона?'))return;dialog.close();};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 const run=fn=>async()=>{try{await fn();}catch(e){notify(e.message,true);}};
 function render(){
  list.replaceChildren();form.replaceChildren();draft=null;dirty=false;
  list.append(el('p','Отдельные шаблоны для новых техкарт. Сохраняются на этом устройстве и входят в резервную копию.'));
  list.append(button('＋ Создать свой шаблон',()=>edit()));
  for(const t of getState()?.myRecipeTemplates||[]){
   const row=el('div');row.className='panel';row.append(el('h3',t.name),el('p',t.category));
   row.append(button('Изменить',()=>edit(t)),button('Создать техкарту',run(async()=>{if(await createRecipe(templateValues(t)))dialog.close();})),button('Удалить',run(async()=>{if(!confirm('Удалить свой шаблон «'+t.name+'»? Созданные техкарты останутся.'))return;await save(s=>{s.myRecipeTemplates=(s.myRecipeTemplates||[]).filter(x=>x.id!==t.id);});render();})));
   list.append(row);
  }
 }
 function edit(existing){
  list.replaceChildren();form.replaceChildren();draft=existing?structuredClone(existing):{id:crypto.randomUUID(),name:'',category:recipeCategories[0],...Object.fromEntries(Object.keys(fields).map(k=>[k,'']))};dirty=false;
  const inputs={};
  function input(key,label,tag='textarea'){
   const wrap=el('label',label),node=el(tag);node.value=draft[key]||'';node.style.cssText='display:block;width:100%;box-sizing:border-box;margin:6px 0 14px';node.maxLength=key==='name'?200:10000;if(tag==='textarea')node.rows=3;wrap.append(node);form.append(wrap);inputs[key]=node;node.oninput=()=>{draft[key]=node.value;dirty=true;};return node;
  }
  input('name','Название шаблона','input').required=true;
  const category=input('category','Категория','select');
  const names=[...new Set([...recipeCategories,...(getState()?.categories||[]).map(c=>c.name),draft.category])];for(const c of names)category.add(new Option(c,c));category.value=draft.category;
  const fill=()=>{const base=templateFor(category.value,1);for(const k of Object.keys(fields)){draft[k]=['shelfLife','temperature'].includes(k)?'':base[k]||'';if(inputs[k])inputs[k].value=draft[k];}};
  form.append(button('Взять описание категории',()=>{if(dirty&&!confirm('Заменить тексты в этом шаблоне описанием категории?'))return;fill();dirty=true;}));
  for(const [k,label] of Object.entries(fields))input(k,label,['shelfLife','temperature'].includes(k)?'input':'textarea');
  form.append(el('p','Срок и температуру укажи по подтверждённым условиям конкретного изделия. Они не назначаются автоматически.'));
  if(!existing)fill();
  const submit=el('button','Сохранить шаблон');submit.type='submit';form.append(submit,button('Отмена',()=>{if(dirty&&!confirm('Отменить изменения шаблона?'))return;render();}));
  form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{draft.name=draft.name.trim();validateMyTemplates([draft]);const item=structuredClone(draft);await save(s=>{s.myRecipeTemplates??=[];const i=s.myRecipeTemplates.findIndex(x=>x.id===item.id);if(i<0)s.myRecipeTemplates.push(item);else s.myRecipeTemplates[i]=item;});render();}catch(err){notify(err.message,true);}finally{submit.disabled=false;}};
 }
 const open=()=>{if(!getState()){notify('Данные ещё загружаются.',true);return;}render();dialog.showModal();};
 const entry=button('Мои шаблоны',open);entry.id='my-recipe-templates';document.querySelector('#recipes > .bar').append(entry);
 const editorEntry=button('Мои шаблоны · новая техкарта',open);document.querySelector('#editor .ttk-template-tools').append(editorEntry);
 return {open};
}
