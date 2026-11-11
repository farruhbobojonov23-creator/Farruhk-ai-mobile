/* FARUKH TTK PRO · classic More Sushi 'Настройка ТТК' restored.
   Saved inside document.fields.a4_design[document.template], with existing document save flow. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const E=()=>window.FARUKH_A4_EDITOR;
const root=()=>$('paper')?.querySelector('.archive-sheet-content');
const cfg=()=>E()?.getConfig?.()||null;
const doc=()=>E()?.getDraft?.()||null;
const hex=x=>/^#[0-9a-fA-F]{6}$/.test(String(x||''));
const bound=(x,min,max)=>Math.max(min,Math.min(max,Number(x)||0));
const original={navy:'#082a4b',blue:'#0c5790',red:'#e72339',paper:'#ffffff',logoSize:126,font:100};
const photoDefault={scene:'transparent',color:'#d8e6f0',fit:'contain',scale:100,x:0,y:0,shadow:true,backdrop:null};
const gradients={
 transparent:'transparent',
 stone:'radial-gradient(ellipse at 60% 86%, #c8d3dc 0%, #e7f1f8 40%, #91adc0 100%)',
 ice:'radial-gradient(ellipse at 50% 85%, #edfdff 0%, #bfe2f7 50%, #75b9e5 100%)',
 white:'radial-gradient(ellipse at 40% 60%, #fff 0%, #f3f7f9 70%, #d5e3ed 100%)',
 navy:'radial-gradient(ellipse at 50% 76%, #4b839e 0%, #124a70 54%, #071f3e 100%)',
 silver:'linear-gradient(135deg,#b6c4cc 0%,#eff5f9 45%,#a4b7c4 100%)'
};
let initialized=false,opened=false,lastFocus=null;
function state(){
 const c=cfg();if(!c)return null;
 if(!c.photo||typeof c.photo!=='object')c.photo={};
 return c;
}
function photo(){
 const c=state();
 if(!c)return {...photoDefault};
 const p={...photoDefault,...c.photo};
 if(!['transparent','stone','ice','white','navy','silver','custom'].includes(p.scene))p.scene='transparent';
 if(!['contain','cover'].includes(p.fit))p.fit='contain';
 if(!hex(p.color))p.color=photoDefault.color;
 p.scale=bound(p.scale,50,175);p.x=bound(p.x,-100,100);p.y=bound(p.y,-100,100);
 p.shadow=Boolean(p.shadow);
 if(!/^data:image\/(jpeg|png|webp);base64,/.test(p.backdrop||''))p.backdrop=null;
 return p;
}
function apply(){
 const c=cfg(),page=root();
 if(!c||!page)return;
 for(const key of ['navy','blue']){
  if(hex(c[key]))page.style.setProperty('--ttk-'+key,c[key]);
  else page.style.removeProperty('--ttk-'+key);
 }
 const red=hex(c.red)?c.red:(hex(c.accent)?c.accent:null);
 if(red)page.style.setProperty('--ttk-red',red);
 else page.style.removeProperty('--ttk-red');
 const colorBackground=hex(c.paper)?c.paper:null;
 const sheetBg=page.querySelector('.lux-background');
 if(colorBackground){
  page.style.setProperty('background',colorBackground,'important');
  if(sheetBg)sheetBg.style.opacity='0';
 }else{
  page.style.removeProperty('background');
  if(sheetBg)sheetBg.style.removeProperty('opacity');
 }
 const logo=page.querySelector('#logo');
 if(logo){
  const k={atelier:1,classic:.48,arctic:.72}[doc()?.template]||1;
  if(Number.isFinite(Number(c.logoSize))){
   const side=Math.round(bound(c.logoSize,72,145)*k)+'px';
   logo.style.setProperty('width',side,'important');
   logo.style.setProperty('height',side,'important');
  }else{
   logo.style.removeProperty('width');logo.style.removeProperty('height');
  }
 }
 const p=photo();
 const box=page.querySelector('#photoBox'),img=page.querySelector('#dishPhoto');
 if(box){
  let background=p.scene==='custom'?p.color:(gradients[p.scene]||'transparent');
  if(p.backdrop)background='center / cover no-repeat url("'+p.backdrop+'")';
  box.style.setProperty('background',background,'important');
  if(p.scene==='transparent'&&!p.backdrop)box.style.setProperty('border','0','important');
 }
 if(img){
  img.style.setProperty('object-fit',p.fit,'important');
  img.style.setProperty('transform','translate('+p.x+'px,'+p.y+'px) scale('+(p.scale/100)+')','important');
  img.style.setProperty('filter',p.shadow?'drop-shadow(0 9px 8px rgba(8,25,41,.26))':'none','important');
 }
 const ocean=page.querySelectorAll('#topArtwork #ocean stop');
 if(ocean.length>2&&hex(c.navy)&&hex(c.blue)){
  ocean[0].setAttribute('stop-color',c.navy);ocean[1].setAttribute('stop-color',c.blue);ocean[2].setAttribute('stop-color',c.navy);
 }
 const foot=page.querySelectorAll('#bottomWave #seaFoot stop');
 if(foot.length>1){
  if(hex(c.navy))foot[0].setAttribute('stop-color',c.navy);
  if(hex(c.blue))foot[1].setAttribute('stop-color',c.blue);
 }
 if(red)page.querySelectorAll('#topArtwork path[stroke]').forEach(el=>el.setAttribute('stroke',red));
}
function renderControls(){
 const c=cfg();if(!c||!$('a4ClassicSettings'))return;
 const p=photo();
 const vals={
  navy:hex(c.navy)?c.navy:original.navy,blue:hex(c.blue)?c.blue:original.blue,
  red:hex(c.red)?c.red:hex(c.accent)?c.accent:original.red,
  paper:hex(c.paper)?c.paper:original.paper,
  logoSize:c.logoSize??original.logoSize,font:c.font??original.font,
  scene:p.scene,color:p.color,fit:p.fit,scale:p.scale,x:p.x,y:p.y,shadow:p.shadow
 };
 for(const input of $('a4ClassicSettings').querySelectorAll('[data-ttk-setting]')){
  const name=input.dataset.ttkSetting;
  const value=vals[name];
  if(value===undefined)continue;
  if(input.type==='checkbox')input.checked=Boolean(value);
  else input.value=String(value);
 }
 for(const name of ['logoSize','font','scale','x','y']){
  const label=$('ttkValue'+name[0].toUpperCase()+name.slice(1));
  if(label)label.textContent=String(vals[name])+(name==='scale'||name==='font'?'%':name==='logoSize'?' px':' px');
 }
 const badge=$('ttkSelectedTheme');
 if(badge)badge.textContent={atelier:'Фирменный LUX',classic:'ARCTIC PRO',arctic:'DEEP BLUE'}[doc()?.template]||'Текущий дизайн';
 $('ttkRemoveBackdrop').disabled=!p.backdrop;
}
function notifyChanged(){
 E()?.markDirty?.();
 E()?.apply?.();
 apply();
 E()?.checkOverflow?.();
}
function setInput(e){
 const el=e.target;
 const key=el.dataset.ttkSetting;
 const c=state();if(!c||!key)return;
 const v=el.type==='checkbox'?el.checked:el.value;
 if(['navy','blue','red','paper'].includes(key)){
  if(!hex(v))return;
  c[key]=v;
  if(key==='red')c.accent=v;
 }else if(['logoSize','font'].includes(key)){
  c[key]=bound(v,key==='logoSize'?72:85,key==='logoSize'?145:112);
 }else {
  const p=photo();
  if(['scale','x','y'].includes(key))p[key]=Number(v);
  else p[key]=v;
  c.photo=p;
 }
 notifyChanged();
 renderControls();
}
function updatePhoto(key,value){
 const c=state();if(!c)return;
 c.photo={...photo(),[key]:value};
 notifyChanged();renderControls();
}
function setOpen(open){
 if(!$('a4ClassicSettings')||!$('ttkSettingsOverlay'))return;
 if(open&&!doc())return;
 opened=!!open;
 $('a4ClassicSettings').hidden=!opened;
 $('ttkSettingsOverlay').hidden=!opened;
 $('ttkClassicOpen').setAttribute('aria-expanded',String(opened));
 document.body.classList.toggle('ttk-settings-open',opened);
 if(opened){lastFocus=document.activeElement;renderControls();$('ttkClassicClose').focus({preventScroll:true})}
 else{lastFocus?.focus?.({preventScroll:true})}
}
function validateAllergens(){
 const d=doc(),el=$('ttkAllergenInfo');if(!d||!el)return;
 const value=String(d.fields?.allergens||'').trim();
 const confirmed=d.fields?.verified==='yes';
 if(!value){el.textContent='⚠ Аллергены не заполнены. Внесите данные по подтверждённым этикеткам ингредиентов.';el.className='ttk-allergen-info warn';}
 else if(!confirmed){el.textContent='⚠ Поле аллергенов заполнено, но подтверждение сведений ещё не отмечено в ТТК.';el.className='ttk-allergen-info warn';}
 else {el.textContent='✓ Поле аллергенов заполнено и отмечено как проверенное вручную. Ответственный должен подтвердить соответствие фактической рецептуре.';el.className='ttk-allergen-info';}
}
function designReset(){
 const c=state();if(!c)return;
 if(!confirm('Вернуть фирменные цвета, текст и фото к исходным настройкам? Рецептура и расположение блоков сохранятся.'))return;
 for(const key of ['navy','blue','red','paper','logoSize','photo'])delete c[key];
 c.accent='';
 c.font=100;
 notifyChanged();renderControls();
}
async function fileBackdrop(event){
 const file=event.target.files?.[0];
 event.target.value='';
 if(!file)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>8*1024*1024){
  alert('Выберите PNG, JPG или WebP до 8 МБ.');return;
 }
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
  const scale=Math.min(1,800/img.naturalWidth,560/img.naturalHeight);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/webp',.70);
  if(data.length>320000)throw Error('Файл после оптимизации слишком большой. Возьмите изображение меньшего размера.');
  updatePhoto('backdrop',data);
 }catch(e){alert('Не удалось добавить фон: '+(e.message||e))}
 finally{URL.revokeObjectURL(url)}
}
function setup(){
 if(initialized)return;
 const top=document.querySelector('#viewEditor .editor-head .row');
 if(!top)return;
 initialized=true;
 const button=document.createElement('button');
 button.id='ttkClassicOpen';button.type='button';button.className='btn btn-light ttk-classic-launch';
 button.textContent='⚙ Настройка ТТК';
 button.setAttribute('aria-expanded','false');
 button.setAttribute('aria-controls','a4ClassicSettings');
 top.prepend(button);
 const overlay=document.createElement('div');overlay.id='ttkSettingsOverlay';overlay.className='ttk-settings-overlay';overlay.hidden=true;
 const panel=document.createElement('aside');panel.id='a4ClassicSettings';panel.className='ttk-settings-drawer';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','ttkClassicHeading');
 panel.innerHTML=[
 '<header class="ttk-settings-heading"><div><span class="ttk-kicker">FARUKH · DOCUMENT STUDIO</span>',
 '<h2 id="ttkClassicHeading">⚙ Настройка ТТК</h2><p>Полноценное оформление листа А4, как в проекте «Море Суши».</p></div>',
 '<button id="ttkClassicClose" type="button" aria-label="Закрыть настройки">×</button></header>',
 '<div class="ttk-settings-scroll">',
 '<div class="ttk-settings-template"><span>НАСТРАИВАЕМЫЙ ШАБЛОН</span><b id="ttkSelectedTheme">Фирменный LUX</b><small>Настройки сохраняются отдельно для каждого дизайна этой ТТК.</small></div>',
 '<section class="ttk-settings-group"><h3>🎨 Цвета листа</h3>',
 '<label>Тёмно-синий <input data-ttk-setting="navy" type="color" value="#082a4b"></label>',
 '<label>Синий <input data-ttk-setting="blue" type="color" value="#0c5790"></label>',
 '<label>Красный акцент <input data-ttk-setting="red" type="color" value="#e72339"></label>',
 '<label>Фон страницы <input data-ttk-setting="paper" type="color" value="#ffffff"></label>',
 '</section>',
 '<section class="ttk-settings-group"><h3>🔠 Логотип и текст</h3>',
 '<label>Размер логотипа <span id="ttkValueLogoSize">126 px</span><input data-ttk-setting="logoSize" type="range" min="72" max="145" step="1"></label>',
 '<label>Размер текста <span id="ttkValueFont">100%</span><input data-ttk-setting="font" type="range" min="85" max="112" step="1"></label>',
 '<div class="ttk-settings-row"><button type="button" data-command="sheetProjectEdit" class="ttk-settings-subbtn">↺ Заменить логотип бренда</button>',
 '<button type="button" id="ttkFitPage" class="ttk-settings-subbtn">Подогнать на А4</button></div>',
 '</section>',
 '<section class="ttk-settings-group"><h3>🍣 Фото товара</h3>',
 '<label>Стиль фона <select data-ttk-setting="scene">',
 '<option value="transparent">Без фона (PNG)</option><option value="stone">Камень / премиум</option>',
 '<option value="ice">Ледяной голубой</option><option value="white">Белый студийный</option>',
 '<option value="navy">Морской тёмный</option><option value="silver">Серебристый</option>',
 '<option value="custom">Мой цвет</option></select></label>',
 '<label>Цвет фона <input data-ttk-setting="color" type="color" value="#d8e6f0"></label>',
 '<label>Как показать фото <select data-ttk-setting="fit">',
 '<option value="contain">Полностью без обрезки</option><option value="cover">Заполнить область фото</option></select></label>',
 '<label>Размер товара <span id="ttkValueScale">100%</span><input data-ttk-setting="scale" type="range" min="50" max="175" step="5"></label>',
 '<label>Сдвиг ↔ <span id="ttkValueX">0 px</span><input data-ttk-setting="x" type="range" min="-100" max="100" step="2"></label>',
 '<label>Сдвиг ↕ <span id="ttkValueY">0 px</span><input data-ttk-setting="y" type="range" min="-100" max="100" step="2"></label>',
 '<label class="ttk-settings-check">Тень под товаром <input data-ttk-setting="shadow" type="checkbox" checked></label>',
 '<label>Свой фоновый рисунок <input type="file" id="ttkPhotoBackdrop" accept="image/png,image/jpeg,image/webp"></label>',
 '<div class="ttk-settings-row"><button type="button" class="ttk-settings-subbtn" id="ttkRemoveBackdrop">Убрать фоновый рисунок</button>',
 '<button type="button" class="ttk-settings-subbtn" id="ttkUploadPhoto">Заменить фото блюда</button></div>',
 '</section>',
 '<section class="ttk-settings-group"><h3>🛡️ Проверка аллергенов</h3>',
 '<p>В исходном проекте аллергены брались из связанной базы ингредиентов. В этой студии ТТК ингредиенты пока вводятся текстом, поэтому сведения нужно подтверждать вручную.</p>',
 '<button type="button" class="ttk-settings-subbtn" id="ttkCheckAllergens">Проверить заполнение аллергенов</button>',
 '<div id="ttkAllergenInfo" class="ttk-allergen-info">Поле не проверено.</div>',
 '</section>',
 '<div class="ttk-settings-actions"><button type="button" id="ttkResetColors">↶ Вернуть исходное оформление</button>',
 '<button type="button" class="ttk-settings-save" id="ttkSettingsSave">✓ Сохранить ТТК</button></div>',
 '<p class="ttk-settings-note">Все изменения применяются к листу сразу. Для закрепления на сервере нажмите «Сохранить ТТК». Печать ограничена одним листом A4.</p>',
 '</div>'
 ].join('');
 document.body.append(overlay,panel);
 const css=document.createElement('link');css.rel='stylesheet';css.href='./a4-classic-settings.css?v=20261112-1';document.head.appendChild(css);
 button.addEventListener('click',()=>setOpen(!opened));
 $('ttkClassicClose').addEventListener('click',()=>setOpen(false));
 overlay.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();setOpen(false)}});
 panel.addEventListener('input',e=>{if(e.target.matches('[data-ttk-setting]'))setInput(e)});
 panel.addEventListener('change',e=>{if(e.target.matches('[data-ttk-setting]'))setInput(e)});
 $('ttkPhotoBackdrop').addEventListener('change',fileBackdrop);
 $('ttkRemoveBackdrop').addEventListener('click',()=>updatePhoto('backdrop',null));
 $('ttkUploadPhoto').addEventListener('click',()=>$('ePhotoInput')?.click());
 $('ttkResetColors').addEventListener('click',designReset);
 $('ttkFitPage').addEventListener('click',()=>{E()?.apply?.();apply();E()?.checkOverflow?.()});
 $('ttkCheckAllergens').addEventListener('click',validateAllergens);
 $('ttkSettingsSave').addEventListener('click',()=>{$('saveDoc')?.click();setOpen(false)});
 // Project switching changes document settings, without discarding other projects' preferences.
 document.addEventListener('click',e=>{
  if(!e.target.closest('[data-sheet-theme],[data-editor-template]'))return;
  requestAnimationFrame(()=>{apply();renderControls()});
 });
}
window.FARUKH_TTK_SETTINGS={init:setup,apply,refresh:renderControls,open:()=>setOpen(true)};
})();