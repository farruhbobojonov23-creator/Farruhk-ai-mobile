/* FARRUH AI · TTK Studio.
 * Reuses the original controls, validators, photo handler and PDF exporter.
 * No duplicated form state, no changes to recipe persistence or sanitation data.
 */
const make=(tag,className,text)=>{
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=text;
 return el;
};
export function mountTtkStudio(editor){
 if(!editor)throw Error('TTK Studio: редактор не найден.');
 if(editor.classList.contains('ttk-studio-enabled'))return {open(){}};
 const toolbar=editor.querySelector('.ttk-toolbar');
 const picker=editor.querySelector('#ttk-design-picker');
 const workspace=editor.querySelector('.ttk-pro-shell');
 const viewport=editor.querySelector('.ttk-viewport');
 const photo=editor.querySelector('.ttk-inline-photo');
 const fileInput=editor.querySelector('#recipe-photo-file');
 const modeButtons=[...editor.querySelectorAll('.editor-modes button')];
 if(!toolbar||!picker||!workspace||!viewport||!photo||!fileInput||modeButtons.length<2)
  throw Error('TTK Studio: базовые элементы редактора не подключены.');
 editor.classList.add('ttk-studio-enabled');

 // Preserve original button events; only change placement and presentation.
 const back=toolbar.querySelector('#closeeditor');
 const save=toolbar.querySelector('button[type="submit"]');
 const download=toolbar.querySelector('#sheet-download');
 const remove=toolbar.querySelector('#delete-recipe');
 if(back)back.textContent='← Назад';
 if(save)save.textContent='✓ Сохранить';
 const preview=make('button','ttk-studio-preview','◉ Предпросмотр PDF');
 preview.type='button';
 preview.addEventListener('click',()=>editor.querySelector('.ttk-pro-tab.is-accent')?.click());
 const menu=make('details','ttk-studio-menu');
 const menuTitle=make('summary','','⋯ Ещё');menu.append(menuTitle);
 const menuBody=make('div','ttk-studio-menu-body');
 if(download){download.textContent='↓ Сохранить и скачать PDF';menuBody.append(download)}
 if(remove)menuBody.append(remove);
 menu.append(menuBody);
 toolbar.append(preview,menu);

 // Large, visible design cards are part of the editor, not a hidden sidebar.
 const intro=make('section','ttk-studio-intro');
 const kicker=make('div','ttk-studio-kicker','FARRUH AI · DESIGN STUDIO');
 const heading=make('div','ttk-studio-intro-title');
 heading.append(make('h3','','Оформление технологической карты'),
  make('p','','Выбери стиль — он сразу применится к рабочему листу. Содержание останется без изменений.'));
 intro.append(kicker,heading);
 const project=editor.querySelector('.lx-editor-project');
 if(project){project.classList.add('ttk-studio-project');intro.append(project)}
 picker.querySelector('h3')?.replaceChildren(document.createTextNode('Выбери дизайн А4'));
 intro.append(picker);
 toolbar.after(intro);
 const progress=editor.querySelector('.ttk-pro-head');
 if(progress)intro.after(progress);

 // One clear switch for a comfortable phone form or a real A4 working sheet.
 const switcher=make('nav','ttk-studio-switch');
 switcher.setAttribute('aria-label','Вид редактора');
 const form=make('button','ttk-studio-switch-button','✎ Удобное заполнение');
 const sheet=make('button','ttk-studio-switch-button','▤ Лист А4');
 const check=make('button','ttk-studio-switch-button ttk-studio-check-button','✓ Проверка');
 for(const b of [form,sheet,check])b.type='button';
 switcher.append(form,sheet,check);
 (progress||intro).after(switcher);

 const rail=workspace.querySelector('.ttk-pro-rail');
 const audit=editor.querySelector('.ttk-pro-audit');
 const qa=make('details','ttk-studio-advanced');
 qa.id='ttk-studio-checks';
 qa.append(make('summary','','Проверка заполнения · открыть замечания'));
 if(audit)qa.append(audit);
 if(rail)rail.append(qa);
 const tools=editor.querySelector('.ttk-template-tools');
 if(tools){
  const extra=make('details','ttk-studio-advanced ttk-studio-template');
  extra.append(make('summary','','Дополнительно · шаблон текста'));
  extra.append(tools);if(rail)rail.append(extra);
 }
 check.addEventListener('click',()=>{
  qa.open=true;qa.scrollIntoView({behavior:'smooth',block:'center'});
 });
 function setMode(value){
  const button=value==='paper'?modeButtons[1]:modeButtons[0];
  button.click();editor.dataset.studioMode=value;
  form.setAttribute('aria-pressed',String(value==='form'));
  sheet.setAttribute('aria-pressed',String(value==='paper'));
 }
 form.addEventListener('click',()=>setMode('form'));
 sheet.addEventListener('click',()=>setMode('paper'));

 // The existing photo input keeps its full processing/validation handlers.
 // Move it out of the hidden legacy upload panel to keep the file picker reliable.
 fileInput.hidden=true;editor.append(fileInput);
 photo.classList.add('ttk-studio-photo');
 photo.setAttribute('aria-label','Фото блюда: нажми, чтобы добавить или заменить');
 const photoButton=make('button','ttk-studio-photo-action','＋ Добавить фото');
 photoButton.type='button';
 photoButton.title='Загрузить или заменить фотографию блюда';
 photo.append(photoButton);
 const removePhoto=make('button','ttk-studio-photo-remove','×');
 removePhoto.type='button';removePhoto.hidden=true;
 removePhoto.setAttribute('aria-label','Удалить фотографию');
 removePhoto.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  editor.querySelector('.lx-remove-photo')?.click();
 });
 photo.append(removePhoto);
 const openFile=()=>fileInput.click();
 photoButton.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openFile()});
 photo.addEventListener('click',e=>{
  if(e.target.closest('button'))return;
  e.preventDefault();openFile();
 });
 const refreshPhoto=()=>{
  const hasImage=Boolean(photo.querySelector('img')?.getAttribute('src'));
  photo.classList.toggle('ttk-studio-photo-filled',hasImage);
  photoButton.textContent=hasImage?'✎ Заменить фото':'＋ Добавить фото';
  removePhoto.hidden=!hasImage;
 };
 new MutationObserver(refreshPhoto).observe(photo,{attributes:true,subtree:true,
  attributeFilter:['src','hidden']});
 refreshPhoto();

 const name=editor.querySelector('#recipe-name');
 if(name){
  name.setAttribute('placeholder','Например, Филадельфия классик');
 }
 const displayStyle=()=>{
  intro.dataset.layout=editor.dataset.ttkLayout||'arctic-a4';
 };
 new MutationObserver(displayStyle).observe(editor,{attributes:true,attributeFilter:['data-ttk-layout']});
 displayStyle();
 return {
  open(){
   menu.open=false;qa.open=false;
   // A4 sheet on desktop; full-size, readable fields on a phone.
   setMode(window.matchMedia('(min-width: 1050px)').matches?'paper':'form');
   refreshPhoto();displayStyle();
  },
  setMode
 };
}
