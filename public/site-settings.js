const BASE=[['home','Кабинет шефа'],['lab','ХАССП'],['recipes','Техкарты'],['preparations','Заготовки'],['calc','Калькулятор'],['checks','Контроль точек'],['tasks','Задачи'],['chat','Ассистент']];
export function settingsState(raw={}){
 const saved=Array.isArray(raw.sections)?raw.sections:[];
 const sections=saved.filter(s=>s&&typeof s.id==='string'&&(BASE.some(([id])=>id===s.id)||/^custom-[a-z0-9-]+$/.test(s.id))).map(s=>({...s,name:String(s.name||'Раздел').slice(0,60),content:String(s.content||'').slice(0,20000)}));
 for(let i=sections.length-1;i>=0;i--)if(sections.findIndex(s=>s.id===sections[i].id)!==i)sections.splice(i,1);
 for(const [id,name] of BASE)if(!sections.some(s=>s.id===id))sections.push({id,name});
 for(const s of sections)if(typeof s.home!=='boolean')s.home=['recipes','lab','tasks'].includes(s.id);
 const home=sections.find(s=>s.id==='home');home.hidden=false;home.deleted=false;
 return {sections,brand:String(raw.brand||'FARRUH AI').slice(0,40),headline:String(raw.headline||'Будущее. В ваших руках.').slice(0,120),homeImage:typeof raw.homeImage==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(raw.homeImage)?raw.homeImage:'',subtitle:String(raw.subtitle||'Интеллект, который работает для вас.').slice(0,180),motion:raw.motion!==false,scale:[1,1.1,1.2].includes(raw.scale)?raw.scale:1};
}
export function mountSiteSettings({getState,save,show,titles,settingsDialog,notify}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
 const root=el('section');root.id='site-settings';root.className='view';root.hidden=document.body.dataset.view!=='site-settings';document.querySelector('main > .glass').append(root);titles['site-settings']='Настройки';
 const style=el('style');style.textContent=`[data-config-hidden="true"]{display:none!important}#site-settings{max-width:1000px;margin:auto;padding:20px}#site-settings .settings-row{padding:16px;margin:12px 0;background:#ffffffa6;border:1px solid #c7d8e8;border-radius:18px}#site-settings .settings-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}#site-settings input,#site-settings textarea{width:100%;box-sizing:border-box}#site-settings button{min-height:44px}body.config-still *,body.config-still *::before,body.config-still *::after{animation:none!important;transition:none!important}#home.arctic-home .home-shortcuts{grid-template-columns:repeat(5,minmax(0,1fr))!important}#home.arctic-home .home-shortcuts button{min-width:0!important;font-size:11px!important}@media(max-width:420px){#home.arctic-home .home-shortcuts{gap:5px!important}#home.arctic-home .home-shortcuts button{padding:8px 3px!important}}`;
 document.head.append(style);
 const button=(label,fn,parent)=>{const b=el('button',label);b.type='button';b.onclick=async()=>{try{await fn()}catch(e){notify(e.message,true)}};parent?.append(b);return b};
 const homeButton=button('Настройки',()=>show('site-settings'));homeButton.prepend(el('span','⚙'));homeButton.dataset.view='site-settings';document.querySelector('.home-shortcuts').insertBefore(homeButton,document.getElementById('ruby-menu'));
 const menuSettings=document.getElementById('menu-settings');menuSettings.textContent='Настройки';menuSettings.onclick=()=>show('site-settings');
 document.getElementById('ruby-settings').onclick=()=>show('site-settings');document.getElementById('lunar-settings').onclick=()=>show('site-settings');
 mountHomeEditor();
 const originals=new Map();let lastConfig='',lastView='',draft=null;
 const config=()=>settingsState(getState()?.siteSettings);
 const persist=async next=>{await save(s=>{s.siteSettings=next});draft=null;render(true)};
 function apply(c){
  document.body.classList.toggle('config-still',!c.motion);document.documentElement.style.fontSize=16*c.scale+'px';
  document.querySelectorAll('.aurora-brand,.sidebar .brand,.arctic-title strong,.arctic-greeting .eyebrow').forEach(n=>n.textContent=c.brand);
  const heading=document.querySelector('.arctic-greeting h1');if(c.headline==='Будущее. В ваших руках.')heading.replaceChildren(document.createTextNode('Будущее.'),el('br'),el('em','В ваших руках.'));else heading.textContent=c.headline;document.querySelector('.arctic-greeting p').textContent=c.subtitle;
  const scene=document.querySelector('.arctic-art-area');let custom=scene.querySelector('.owner-home-image');if(c.homeImage){if(!custom){custom=el('img');custom.className='owner-home-image';custom.alt='Изображение главного экрана';custom.style.cssText='width:100%;height:100%;object-fit:contain;position:absolute;inset:0';scene.append(custom)}custom.src=c.homeImage}if(custom)custom.hidden=!c.homeImage;scene.querySelector('.ruby-scene').style.visibility=c.homeImage?'hidden':'';
  const nav=document.querySelector('#chef-menu .nav');nav.querySelectorAll('[data-custom-nav]').forEach(n=>n.remove());
  document.querySelectorAll('[data-custom-page],[data-custom-shortcut]').forEach(n=>n.remove());
  for(const s of c.sections){
   titles[s.id]=s.name;
   if(s.id.startsWith('custom-')){
    const b=button(s.name,()=>show(s.id));b.dataset.view=s.id;b.dataset.customNav='true';nav.insertBefore(b,menuSettings);
    const page=el('section');page.id=s.id;page.className='view';page.dataset.customPage='true';page.hidden=document.body.dataset.view!==s.id;page.append(el('h1',s.name));const text=el('p',s.content||'Эта страница пока пустая. Добавь текст в настройках.');text.style.whiteSpace='pre-wrap';page.append(text);page.append(button('Редактировать страницу',()=>show('site-settings')));root.before(page);
   }
   if(s.home&&!['home','recipes','lab','tasks'].includes(s.id)){const shortcut=button(s.name,()=>show(s.id));shortcut.prepend(el('span','◇'));shortcut.dataset.view=s.id;shortcut.dataset.customShortcut='true';homeButton.before(shortcut)}
   const targets=[...document.querySelectorAll('button[data-view="'+s.id+'"]')];if(s.id==='recipes')targets.push(document.getElementById('home-new-recipe'));
   for(const n of targets.filter(Boolean)){
    if(!originals.has(n))originals.set(n,n.innerHTML);
    const hidden=!!s.hidden||!!s.deleted||(n.closest('.home-shortcuts')&&!s.home);n.dataset.configHidden=String(!!hidden);if(hidden)n.style.setProperty('display','none','important');else n.style.removeProperty('display');n.style.order=String(c.sections.indexOf(s));
    const labelNodes=[...n.childNodes].filter(x=>x.nodeType===3);if(labelNodes.length){labelNodes[ labelNodes.length-1].textContent=s.name}else{n.append(document.createTextNode(s.name))}
    n.setAttribute('aria-label',s.name);
   }
   const navButton=[...nav.querySelectorAll('button[data-view]')].find(n=>n.dataset.view===s.id);if(navButton)nav.insertBefore(navButton,menuSettings);
  }
  homeButton.style.order='98';document.getElementById('ruby-menu').style.order='99';
  document.getElementById('viewtitle').textContent=titles[document.body.dataset.view]||'';
 }
 function mountHomeEditor(){
  const panel=el('dialog');panel.setAttribute('aria-label','Настроить главный экран');panel.style.cssText='width:min(620px,92vw);max-height:85dvh;overflow:auto;border:1px solid #c7d8e8;border-radius:22px;padding:20px;background:#f3f8ff;color:#17324d';document.body.append(panel);
  const entry=document.getElementById('ruby-settings');entry.textContent='Настроить';entry.setAttribute('aria-label','Настроить главный экран');entry.title='Настроить главный экран';entry.onclick=open;entry.style.cssText='width:auto;min-height:44px;padding:8px 14px;font-size:14px';
  let working=null,saving=false;
  const cancel=()=>{if(saving)return;apply(config());panel.close();working=null};
  panel.addEventListener('cancel',e=>{e.preventDefault();cancel()});
  function open(){if(!getState())return;working=structuredClone(config());draw();panel.showModal()}
  function preview(){apply(working)}
  function draw(){panel.replaceChildren(el('h2','Настроить главный экран'));panel.append(el('p','Изменяй и смотри результат. «Готово» сохранит, «Отмена» вернёт прежний вид.'));
   for(const [key,label] of [['brand','Название сайта'],['headline','Заголовок'],['subtitle','Подпись']]){const field=input(panel,label,working[key]);field.maxLength=key==='brand'?40:key==='headline'?120:180;field.oninput=()=>{working[key]=field.value;preview()}}
   const upload=input(panel,'Изображение главного экрана','','file');upload.accept='image/png,image/jpeg,image/webp';upload.onchange=async()=>{try{const file=upload.files[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>10*1024*1024)throw Error('Выбери JPG, PNG или WEBP до 10 МБ.');const target=working;const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas'),ratio=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();if(target!==working)return;working.homeImage=canvas.toDataURL('image/webp',.85);preview()}catch(e){notify(e.message,true)}};
   button('Вернуть стандартное изображение',()=>{working.homeImage='';preview()},panel);
   panel.append(el('h3','Разделы на главной'));
   for(const section of working.sections.filter(x=>x.id!=='home'&&!x.deleted)){const row=el('div');row.style.cssText='border-top:1px solid #c7d8e8;padding:12px 0';const name=input(row,'Название',section.name);name.maxLength=60;name.oninput=()=>{section.name=name.value;preview()};const actions=el('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';row.append(actions);
    button(section.home&&!section.hidden?'Скрыть с главной':'Показать на главной',()=>{section.home=!(section.home&&!section.hidden);section.hidden=false;preview();draw()},actions);
    for(const [label,delta] of [['← Раньше',-1],['Позже →',1]])button(label,()=>{const i=working.sections.indexOf(section),j=i+delta;if(j>=0&&j<working.sections.length){[working.sections[i],working.sections[j]]=[working.sections[j],working.sections[i]];preview();draw()}},actions);
    button('В корзину',()=>{section.deleted=true;preview();draw()},actions);panel.append(row)
   }
   button('Добавить раздел',()=>{working.sections.push({id:'custom-'+crypto.randomUUID(),name:'Новый раздел',content:'',home:true});preview();draw()},panel);
   for(const section of working.sections.filter(x=>x.deleted))button('Восстановить «'+section.name+'»',()=>{section.deleted=false;section.hidden=false;preview();draw()},panel);
   const footer=el('div');footer.style.cssText='position:sticky;bottom:0;background:#f3f8ff;padding:14px 0;display:flex;gap:12px';panel.append(footer);
   const done=button('Готово',async()=>{if(saving)return;if(working.sections.some(x=>!x.name.trim()))throw Error('Укажи названия разделов.');saving=true;done.disabled=true;try{await persist(settingsState(working));panel.close();working=null}finally{saving=false;done.disabled=false}},footer);button('Отмена',cancel,footer)
  }
 }
 function input(parent,label,value,type='text'){const l=el('label',label),i=el(type==='textarea'?'textarea':'input');if(type!=='textarea')i.type=type;i.value=value;l.append(i);parent.append(l);return i}
 function render(force=false){if(!getState())return;const c=config(),serial=JSON.stringify(c),view=document.body.dataset.view;if(serial!==lastConfig){apply(c);lastConfig=serial}if(view!=='site-settings'){lastView=view;return}if(!force&&lastView===view&&draft)return;lastView=view;draft=structuredClone(c);root.replaceChildren(el('h1','Настройки'),el('p','Управляй разделами, главной страницей и данными. Изменения сохраняются на этом устройстве.'));
  const top=el('div');top.className='settings-actions';root.append(top);button('Голос, Google и резервные копии',()=>settingsDialog.showModal(),top);button('Открыть управление точками и оборудованием',()=>show('lab'),top);
  const appearance=el('section');appearance.className='settings-row';appearance.append(el('h2','Оформление'));
  const brand=input(appearance,'Название в меню',draft.brand);brand.maxLength=40;
  const motion=el('label',' Анимация и эффекты '),check=el('input');check.type='checkbox';check.checked=draft.motion;check.style.width='auto';motion.prepend(check);appearance.append(motion);
  const label=el('label','Размер текста'),scale=el('select');for(const v of [1,1.1,1.2])scale.add(new Option(Math.round(v*100)+'%',v));scale.value=draft.scale;label.append(scale);appearance.append(label);button('Сохранить оформление',()=>persist({...config(),brand:brand.value.trim()||'FARRUH AI',motion:check.checked,scale:Number(scale.value)}),appearance);root.append(appearance);
  root.append(el('h2','Разделы сайта'),el('p','↑ и ↓ меняют порядок. Скрытые разделы можно вернуть. Удаление убирает раздел в корзину и сохраняет его содержимое. Главная и настройки остаются доступными.'));
  const change=async(id,fn)=>{const next=config();fn(next.sections.find(s=>s.id===id),next);await persist(next)};
  for(const s of c.sections.filter(s=>!s.deleted)){
   const card=el('section');card.className='settings-row';const name=input(card,'Название раздела',s.name);name.maxLength=60;let content;if(s.id.startsWith('custom-')){content=input(card,'Текст страницы',s.content,'textarea');content.rows=5;content.maxLength=20000}
   const actions=el('div');actions.className='settings-actions';card.append(actions);
   button('Сохранить',()=>{if(!name.value.trim())throw Error('Укажи название раздела.');return change(s.id,x=>{x.name=name.value.trim();if(content)x.content=content.value})},actions);
   for(const [text,delta] of [['↑',-1],['↓',1]]){const b=button(text,()=>change(s.id,(_,next)=>{const i=next.sections.findIndex(x=>x.id===s.id),j=i+delta;if(j>=0&&j<next.sections.length)[next.sections[i],next.sections[j]]=[next.sections[j],next.sections[i]]}),actions);b.setAttribute('aria-label',text+' '+s.name)}
   if(s.id!=='home'){button(s.home?'Убрать с главной':'На главный экран',()=>change(s.id,x=>x.home=!x.home),actions);button(s.hidden?'Показать':'Скрыть',()=>change(s.id,x=>x.hidden=!x.hidden),actions);button('Убрать в корзину',()=>change(s.id,x=>x.deleted=true),actions)}button('Открыть',()=>show(s.id),actions);root.append(card);
  }
  const add=el('section');add.className='settings-row';add.append(el('h2','Добавить категорию'));const name=input(add,'Название новой категории','');name.maxLength=60;const content=input(add,'Текст новой страницы','','textarea');content.maxLength=20000;button('Добавить страницу',async()=>{if(!name.value.trim())throw Error('Укажи название.');const next=config();next.sections.push({id:'custom-'+crypto.randomUUID(),name:name.value.trim(),content:content.value});await persist(next)},add);root.append(add);
  const trash=el('section');trash.className='settings-row';trash.append(el('h2','Корзина разделов'));for(const s of c.sections.filter(s=>s.deleted))button('Восстановить «'+s.name+'»',()=>change(s.id,x=>{x.deleted=false;x.hidden=false}),trash);if(!c.sections.some(s=>s.deleted))trash.append(el('p','Корзина пуста.'));root.append(trash);
  button('Вернуть исходные названия, порядок и оформление',()=>{const next=settingsState();next.sections.push(...config().sections.filter(s=>s.id.startsWith('custom-')));return persist(next)},root);
 }
 return {render};
}
