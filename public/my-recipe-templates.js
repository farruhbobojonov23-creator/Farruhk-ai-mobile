import {templateFor,recipeCategories} from './recipe-math.js?v=categories-13';
export const fields={preparation:'4. Подготовка',forming:'4. Приготовление',serving:'4. Нарезка и подача',storage:'5. Оформление, подача и хранение',shelfLife:'5. Срок годности',temperature:'5. Температура хранения',appearance:'6. Внешний вид',taste:'6. Вкус, запах и консистенция'};
export function validateMyTemplates(list){
 if(list===undefined)return;
 if(Array.isArray(list)&&list.some(t=>t&&['deliveryMode','packaging'].some(k=>t[k]!==undefined&&(typeof t[k]!=='string'||t[k].length>10000))))throw Error('Неверные условия подачи шаблона.');
 if(!Array.isArray(list)||list.some(t=>!t||typeof t.id!=='string'||typeof t.name!=='string'||!t.name.trim()||typeof t.category!=='string'||Object.keys(fields).some(k=>typeof t[k]!=='string'||t[k].length>10000)))throw Error('Повреждены мои шаблоны техкарт.');
}
export function templateValues(t){return {...t,storage:[t.storage,t.shelfLife?'Срок годности: '+t.shelfLife:'',t.temperature?'Температура хранения: '+t.temperature:'',t.deliveryMode?'Режим: '+t.deliveryMode:'',t.packaging?'Упаковка и доставка: '+t.packaging:''].filter(Boolean).join('\n')};}
export function mountMyRecipeTemplates({getState,save,createRecipe,notify}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const dialog=el('dialog');dialog.className='my-template-dialog';const css=el('link');css.rel='stylesheet';css.href='/my-recipe-templates.css?v=1';document.head.append(css);dialog.setAttribute('aria-label','Мои шаблоны');document.body.append(dialog);
 const heading=el('div');heading.className='template-topbar';heading.append(el('h2','Мои шаблоны'),button('Закрыть',()=>close()));dialog.append(heading);
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
  const inputs={},previews=[];
  const title=el('h1','Мой шаблон'),tag=el('p','Для новой техкарты');tag.className='template-kicker';form.append(title,tag);
  const error=el('p');error.className='template-error';error.setAttribute('role','alert');error.hidden=true;form.append(error);
  const fail=e=>{error.hidden=false;error.textContent=e.message;error.scrollIntoView({block:'nearest'});};
  function input(parent,key,label,tag='textarea'){
   const wrap=el('label'),caption=el('span',label),node=el(tag);wrap.append(caption,node);wrap.className='template-field';node.value=draft[key]||'';node.setAttribute('aria-label',label);node.maxLength=key==='name'?200:10000;if(tag==='textarea')node.rows=4;parent.append(wrap);inputs[key]=node;node.oninput=()=>{draft[key]=node.value;dirty=true;if(key==='name')title.textContent=node.value.trim()?'Шаблон · '+node.value:'Мой шаблон';};return node;
  }
  const meta=el('section');meta.className='template-card template-meta';form.append(meta);
  input(meta,'name','Название шаблона','input').required=true;
  if(draft.name)title.textContent='Шаблон · '+draft.name;
  const category=input(meta,'category','Категория','select');
  for(const c of [...new Set([...recipeCategories,...(getState()?.categories||[]).map(c=>c.name),draft.category])])category.add(new Option(c,c));category.value=draft.category;
  const description=el('p');description.className='template-kicker';
  function card(label){const n=el('section');n.className='template-card';const bar=el('div');bar.className='template-card-heading';bar.append(el('h2',label));n.append(bar);form.append(n);return {n,bar};}
  function textCard(label,keys,subtitle){const {n,bar}=card(label),preview=el('div'),editor=el('div');preview.className='template-copy';editor.hidden=true;if(subtitle)n.append(subtitle);n.append(preview,editor);
   const draw=()=>{preview.replaceChildren();for(const [key,name] of keys){const p=el('p');p.append(el('strong',name+': '),document.createTextNode(draft[key]||'Не заполнено'));preview.append(p)}};previews.push(draw);
   for(const [key,name] of keys)input(editor,key,name);
   const edit=button('✎ Изменить',()=>{if(editor.hidden){editor.hidden=false;preview.hidden=true;edit.textContent='✓ Готово';editor.querySelector('textarea')?.focus()}else{editor.hidden=true;preview.hidden=false;edit.textContent='✎ Изменить';draw()}});bar.append(edit);return n;
  }
  textCard('4. Технологический процесс',[['preparation','Подготовка'],['forming','Приготовление'],['serving','Подача']],description);
  const {n:storage}=card('5. Подача и хранение');
  const modes=el('div');modes.className='template-modes';storage.append(modes);
  for(const name of ['Горячая доставка','Охлаждённое хранение']){const label=el('label'),radio=el('input');radio.type='radio';radio.name='template-delivery-mode';radio.value=name;radio.checked=draft.deliveryMode===name;radio.onchange=()=>{draft.deliveryMode=name;dirty=true;};label.append(radio,el('span',name));modes.append(label);}
  input(storage,'shelfLife','Срок годности','input').placeholder='Указать для блюда';
  input(storage,'temperature','Температура хранения','input').placeholder='Указать режим';
  input(storage,'packaging','Упаковка и доставка','input').placeholder='Указать упаковку';
  const details=el('details');details.append(el('summary','Описание подачи и хранения'));storage.append(details);input(details,'storage','Описание подачи и хранения');
  const note=el('p','Срок и режим — по утверждённой ТТК. Не назначаются автоматически.');note.className='template-warning';storage.append(note);
  textCard('6. Показатели качества',[['appearance','Внешний вид'],['taste','Вкус, запах и консистенция']]);
  const refresh=()=>{description.textContent='Шаблон для категории «'+draft.category+'»';for(const draw of previews)draw()};
  const fill=()=>{const base=templateFor(category.value,1);for(const k of Object.keys(fields)){draft[k]=['shelfLife','temperature'].includes(k)?'':base[k]||'';if(inputs[k])inputs[k].value=draft[k];}draft.deliveryMode='';draft.packaging='';inputs.packaging.value='';modes.querySelectorAll('input').forEach(i=>i.checked=false);refresh();};
  if(!existing)fill();else refresh();
  category.oninput=null;category.onchange=()=>{if(dirty&&!confirm('Сменить категорию и подставить её описание? Тексты этого шаблона будут заменены.')){category.value=draft.category;return;}draft.category=category.value;fill();dirty=true;};
  const reset=button('Взять описание категории заново',()=>{if(!confirm('Заменить тексты описанием выбранной категории?'))return;fill();dirty=true;});reset.className='template-reset';form.append(reset);
  const footer=el('div');footer.className='template-footer';form.append(footer);
  const submit=el('button','Сохранить шаблон');submit.type='submit';submit.className='primary';footer.append(submit);
  const pdf=button('Предпросмотр PDF',async()=>{pdf.disabled=true;try{const values=templateValues(draft);const response=await fetch('/api/recipes/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipe:{...values,name:'Шаблон — '+(draft.name||draft.category)+' (без рецептуры)',customTemplate:true,technology:values.forming,ingredients:[]}}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Не удалось подготовить PDF.');const url=URL.createObjectURL(await response.blob()),viewer=el('dialog');viewer.className='template-pdf';const close=()=>{viewer.close();viewer.remove();URL.revokeObjectURL(url)};viewer.append(el('h2','PDF шаблона — без состава блюда'),button('Закрыть PDF',close));const link=el('a','Скачать PDF');link.href=url;link.download='Мой-шаблон.pdf';viewer.append(link);const frame=el('iframe');frame.title='Предпросмотр PDF шаблона';frame.src=url;viewer.append(frame);viewer.addEventListener('cancel',e=>{e.preventDefault();close()});document.body.append(viewer);viewer.showModal();}catch(e){fail(e)}finally{pdf.disabled=false}});footer.append(pdf);
  footer.append(button('Отмена',()=>{if(dirty&&!confirm('Отменить изменения шаблона?'))return;render();}));
  form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{draft.name=draft.name.trim();validateMyTemplates([draft]);const item=structuredClone(draft);await save(s=>{s.myRecipeTemplates??=[];const i=s.myRecipeTemplates.findIndex(x=>x.id===item.id);if(i<0)s.myRecipeTemplates.push(item);else s.myRecipeTemplates[i]=item;});render();}catch(err){fail(err)}finally{submit.disabled=false;}};
  dialog.scrollTop=0;
 }
 const open=()=>{if(!getState()){notify('Данные ещё загружаются.',true);return;}render();dialog.showModal();};
 const entry=button('Мои шаблоны',open);entry.id='my-recipe-templates';document.querySelector('#recipes > .bar').append(entry);
 const editorEntry=button('Мои шаблоны · новая техкарта',open);document.querySelector('#editor .ttk-template-tools').append(editorEntry);
 return {open};
}
