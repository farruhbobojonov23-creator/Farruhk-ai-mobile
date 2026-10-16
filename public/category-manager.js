import {categoriesFor,updateCategory,deleteCategory,categoryColors} from './category-model.js';
import {preparePhoto,showProductPhoto} from './product-photo.js';
export function mountCategoryManager({getState,save,notify,onChange}){
 const button=document.createElement('button');button.id='manage-categories';button.type='button';button.textContent='Управлять категориями';document.querySelector('.catalog-heading').append(button);
 const dialog=document.createElement('dialog');dialog.className='category-dialog';dialog.setAttribute('aria-label','Управление категориями');document.body.append(dialog);
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node};
 const action=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=async()=>{try{await fn()}catch(e){notify(e.message,true);let error=dialog.querySelector('.category-error');if(!error){error=el('p');error.className='category-error';error.setAttribute('role','alert');dialog.prepend(error)}error.textContent=e.message;error.scrollIntoView({block:'nearest'})}};return b};
 const commit=async fn=>{await save(fn);onChange();list()};
 function header(title){dialog.replaceChildren();const row=el('div');row.className='bar';row.append(el('h2',title),action('✕',()=>dialog.close()));dialog.append(row)}
 function list(){header('Управление категориями');dialog.append(el('p','Добавляй категории, меняй фото и цвет, порядок и видимость. Техкарты сохраняются при переименовании и переносе.'));
 dialog.append(action('＋ Добавить категорию',()=>edit()));
 const list=categoriesFor(getState());
 list.forEach((c,index)=>{const row=el('div');row.className='category-manage-row';const img=el('img');if(c.image)showProductPhoto(img,c.image);img.alt='';img.style.background=c.color;const info=el('div');info.append(el('strong',c.name),el('small',(getState().recipes||[]).filter(r=>r.category===c.name).length+' техкарт'+(c.visible===false?' · скрыта':'')));const buttons=el('div');buttons.className='category-row-actions';
 const move=async delta=>commit(s=>{const cats=categoriesFor(s);[cats[index],cats[index+delta]]=[cats[index+delta],cats[index]];s.categories=cats});
 const up=action('↑',()=>move(-1));up.disabled=index===0;up.setAttribute('aria-label','Поднять '+c.name);
 const down=action('↓',()=>move(1));down.disabled=index===list.length-1;down.setAttribute('aria-label','Опустить '+c.name);
 buttons.append(up,down,action('Изменить',()=>edit(c)),action(c.visible===false?'Показать':'Скрыть',()=>commit(s=>{s.categories=categoriesFor(s).map(x=>x.id===c.id?{...x,visible:x.visible===false}:x)})),action('Удалить',()=>remove(c)));row.append(img,info,buttons);dialog.append(row)})
 }
 function remove(c){header('Удалить «'+c.name+'»?');const count=(getState().recipes||[]).filter(r=>r.category===c.name).length;dialog.append(el('p',count?'В категории '+count+' техкарт. Выбери, куда их перенести.':'Категория будет удалена. Техкарты не затрагиваются.'));const select=el('select');select.setAttribute('aria-label','Перенести техкарты в');select.append(new Option('Выбери категорию',''));for(const x of categoriesFor(getState()).filter(x=>x.id!==c.id))select.add(new Option(x.name,x.name));if(count)dialog.append(select);dialog.append(action('Подтвердить удаление',()=>commit(s=>deleteCategory(s,c.id,select.value))),action('Отмена',list))}
 function edit(existing){
 const c=existing?{...existing}:{id:crypto.randomUUID(),name:'',image:'',color:categoryColors[0],visible:true,scale:1};let photoSource=null,photoBusy=false,photoFailed=false,job=0;
 header(existing?'Изменить категорию':'Новая категория');
 const label=(text,input)=>{const l=el('label',text);l.append(input);dialog.append(l)};
 const name=el('input');name.value=c.name;name.maxLength=100;name.placeholder='Например, Полуфабрикаты';label('Название',name);
 const color=el('input');color.type='color';color.value=c.color||categoryColors[0];label('Цвет карточки',color);
 const preview=el('div');preview.className='category-photo-preview';preview.style.background=color.value;const image=el('img');image.alt='Предпросмотр товара';preview.append(image);if(c.image)showProductPhoto(image,c.image);dialog.append(preview);color.oninput=()=>preview.style.background=color.value;
 const status=el('p');status.role='status';dialog.append(status);
 const upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';label('Фото товара — фон удалится автоматически',upload);
 const tolerance=el('input');tolerance.type='range';tolerance.min='8';tolerance.max='85';tolerance.value='38';label('Чувствительность удаления однотонного фона',tolerance);
 async function process(){const token=++job;photoBusy=true;photoFailed=false;saveButton.disabled=true;status.textContent='Удаляю фон…';try{const result=await preparePhoto(photoSource,{tolerance:Number(tolerance.value),onProgress:t=>{if(token===job)status.textContent=t}});if(token!==job)return;c.image=result;image.src=result;status.textContent='Готово. Проверь края товара перед сохранением.'}catch(e){if(token!==job)return;photoFailed=true;status.textContent='Обработка не завершена. Проверь интернет и нажми «Повторить обработку». Можно также загрузить готовый PNG без фона.'}finally{if(token===job){photoBusy=false;saveButton.disabled=photoFailed}}}
 upload.onchange=async()=>{const file=upload.files[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>15*1024*1024){status.textContent='Выбери JPG, PNG или WEBP до 15 МБ.';return}photoSource=file;await process()};
 tolerance.onchange=()=>{if(photoSource)process()};
 dialog.append(action('Повторить обработку',async()=>{if(photoSource)await process()}),action('Убрать фото',()=>{job++;photoBusy=false;photoFailed=false;photoSource=null;c.image='';image.removeAttribute('src');status.textContent='Фото убрано';saveButton.disabled=false}));
 const scale=el('input');scale.type='range';scale.min='.6';scale.max='1.6';scale.step='.05';scale.value=c.scale||1;label('Размер товара в карточке',scale);scale.oninput=()=>image.style.transform='scale('+scale.value+')';scale.oninput();
 const visible=el('input');visible.type='checkbox';visible.checked=c.visible!==false;label('Показывать в каталоге',visible);
 const saveButton=action('Сохранить категорию',async()=>{if(photoBusy||photoFailed)throw Error('Дождись успешной обработки фото.');await commit(s=>updateCategory(s,{...c,name:name.value,color:color.value,visible:visible.checked,scale:Number(scale.value)}))});saveButton.className='primary';dialog.append(saveButton,action('Отмена',()=>{job++;list()}));
 }
 button.onclick=()=>{if(!getState())return;list();dialog.showModal()};
}
