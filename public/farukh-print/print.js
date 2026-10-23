(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='farukh-print:catalog:v1';
// Названия получены от владельца. СанПиН 2.3/2.4.4282-26 (с 01.09.2026)
// не задаёт единого срока годности для каждой из этих заготовок.
// Черновики НЕ пригодны для печати до подтверждения технологической документации.
const STARTER_PREP_NAMES=[
 'Соус спайси','Соус сырный','Фирменный соус','Огурцы','Капуста',
 'Такуан','Форель','Угорь','Креветка','Курица готовая','Снежный краб',
 'Сливочный соус','Перец','Омлет','Морковь','Бульон Том Ям',
 'Унаги соус','Терияки соус','Сладкий чили'
];
// Рекомендации по оформлению сведений без назначения вымышленных сроков.
// Категория описывает ожидаемый способ использования, но не доказывает
// безопасность, отсутствие термообработки или исходную температуру.
const PREP_GUIDANCE={
 'Соус спайси':['Соус собственного приготовления, без нагрева','ТТК, состав, документы на майонез после вскрытия; 48 ч — только предложение владельца, не норма СанПиН.'],
 'Соус сырный':['Соус собственного приготовления','ТТК с полным составом, технологией и утверждённым сроком смешанной продукции.'],
 'Фирменный соус':['Соус собственного приготовления','ТТК с полным составом, обработкой и утверждённым сроком хранения.'],
 'Сливочный соус':['Соус собственного приготовления','ТТК: уточнить состав, наличие нагрева, охлаждение и срок.'],
 'Огурцы':['Свежие овощи, подготовленные к использованию','Форма обработки: цельные, промытые или нарезанные; срок после обработки по ТТК.'],
 'Капуста':['Свежие овощи, подготовленные к использованию','Состав заготовки и обработка: целая, шинкованная, маринованная; срок по ТТК.'],
 'Перец':['Свежие овощи, подготовленные к использованию','Форма нарезки, мойка, режим хранения и утверждённая ТТК.'],
 'Морковь':['Свежие овощи, подготовленные к использованию','Мойка, очистка и нарезка; технология и срок по ТТК.'],
 'Такуан':['Готовый к использованию маринованный продукт','Маркировка поставщика и указанный изготовителем срок после вскрытия; факт нарезки.'],
 'Форель':['Рыба для приготовления блюд','Особо важно: происхождение, сырой/солёный/термообработанный вид, размораживание, температура по маркировке, ТТК.'],
 'Угорь':['Рыба/рыбная заготовка','Уточнить, готовый ли термообработанный угорь или иной продукт; маркировка поставщика после вскрытия и ТТК.'],
 'Креветка':['Морепродукт для приготовления блюд','Уточнить сырая/варёная/размороженная, упаковка, дата вскрытия и условия изготовителя.'],
 'Курица готовая':['Готовая птица после тепловой обработки','ТТК: достаточность термообработки, охлаждение, порционирование и утверждённый срок.'],
 'Снежный краб':['Готовый крабовый продукт/сурими — тип уточняется','Маркировка изготовителя, фактический состав, режим и срок после вскрытия; ТТК при смешивании.'],
 'Омлет':['Готовый продукт из яиц','ТТК, термообработка, охлаждение, хранение; не переносить срок другого продукта.'],
 'Бульон Том Ям':['Готовая заготовка бульона','ТТК: термообработка, охлаждение, контейнер, хранение; срок обосновать.'],
 'Унаги соус':['Соус: готовый заводской или собственный — уточняется','Для заводского — маркировка после вскрытия; для собственного — рецептура и ТТК.'],
 'Терияки соус':['Соус: готовый заводской или собственный — уточняется','Для заводского — маркировка после вскрытия; для собственного — рецептура и ТТК.'],
 'Сладкий чили':['Соус: готовый заводской или собственный — уточняется','Для заводского — маркировка после вскрытия; для собственного — рецептура и ТТК.']
};
const guideFor=p=>p?.kind==='prep'?PREP_GUIDANCE[p.name]||['Полуфабрикат','Состав, технологию, температуру и срок подтвердить по ТТК/производителю.']:null;
const WIDTH={ready:464,prep:248},HEIGHT={ready:320,prep:160};
let products=[],kind='ready',manageKind='ready',selected=null,editing=null,busy=false,previewError='',editFromCatalog=null;
const native=typeof window.FarukhPrinter?.postMessage==='function';
const sendNative=packet=>window.FarukhPrinter.postMessage(JSON.stringify(packet));
const status=(message,error=false)=>{const node=$('print-message');node.textContent=message;node.dataset.error=error?'yes':'no'};
const nowLocal=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const formatted=epoch=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(epoch)).replace(',','');
const nv=n=>String(n).replace('.',',');
const str=s=>String(s??'').trim();
const makeId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
// Pechagin Professional 67%, dry spices, cold-mixed, as supplied by the
// owner. 48 h is an OWNER-PROPOSED interval, NOT a shelf life verified by
// SanPiN or the manufacturer; printing stays disabled until separate approval.
const SPICY_PROPOSAL={storage:'+2…+6 °C',hours:48,recipeMemo:'Майонез «Печагин» 67%, сухие специи; смешивание без нагрева.',needsReview:true};
function isSpicy(p){return p.kind==='prep'&&str(p.name).toLocaleLowerCase('ru')==='соус спайси'}
function draftFor(name){const row={id:makeId(),kind:'prep',name,storage:'',hours:null,point:'',needsReview:true};return isSpicy(row)?{...row,...SPICY_PROPOSAL}:row}
function fillSpicyProposal(){
 let changed=false;
 for(const row of products){
  if(!isSpicy(row)||row.needsReview!==true)continue;
  // Only fill *empty* owner-unreviewed drafts. Never overwrite a chosen
  // storage temperature, a shelf life, or a confirmed recipe.
  const fillHours=row.hours===null||row.hours===undefined||row.hours==='';
  const fillStorage=!str(row.storage);
  if(fillHours){row.hours=SPICY_PROPOSAL.hours;changed=true}
  if(fillStorage){row.storage=SPICY_PROPOSAL.storage;changed=true}
  if(!row.recipeMemo){row.recipeMemo=SPICY_PROPOSAL.recipeMemo;changed=true}
 }
 return changed;
}
function mergeStarterPrep(){
 const existing=new Set(products.filter(p=>p.kind==='prep').map(p=>str(p.name).toLocaleLowerCase('ru')));
 const additions=STARTER_PREP_NAMES.filter(name=>!existing.has(name.toLocaleLowerCase('ru')));
 if(additions.length)products.push(...additions.map(draftFor));
 return additions.length;
}
function load(){
 let saved=null;
 try{saved=localStorage.getItem(KEY);const old=JSON.parse(saved||'[]');products=Array.isArray(old)?old.filter(x=>x&&['ready','prep'].includes(x.kind)&&typeof x.name==='string').slice(0,1000):[]}catch{products=[]}
 // Only fresh installations are seeded automatically. Existing user data is
 // never overwritten and can be supplemented with the explicit import button.
 if(saved===null){mergeStarterPrep();save()}
 else if(fillSpicyProposal())save()
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(products));return true}catch(e){alert('Не удалось сохранить базу на этом устройстве: '+e.message);return false}}
function node(tag,cls,txt){const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x}
function current(){return products.find(p=>p.id===selected&&p.kind===kind)||null}
function show(section){
 for(const id of ['home','catalog','manage'])$(id).hidden=id!==section;
 window.scrollTo?.({top:0,behavior:'instant'});
}
function renderHome(){
 $('count-ready').textContent=products.filter(x=>x.kind==='ready').length;
 $('count-prep').textContent=products.filter(x=>x.kind==='prep').length;
 $('manage-count-ready').textContent=products.filter(x=>x.kind==='ready').length;
 $('manage-count-prep').textContent=products.filter(x=>x.kind==='prep').length;
}
function openCatalog(type){
 kind=type;selected=null;$('catalog-search').value='';
 $('catalog-title').textContent=type==='ready'?'Готовая продукция · 58 × 40':'Полуфабрикаты · 31 × 20';
 $('catalog-kicker').textContent=type==='ready'?'ГОТОВАЯ ПРОДУКЦИЯ':'ПОЛУФАБРИКАТЫ';
 $('print-size-badge').textContent=type==='ready'?'58 × 40 мм':'31 × 20 мм';
 $('point-field').hidden=type==='ready';
 $('printed-at').value=nowLocal();$('copies').value='1';
 show('catalog');renderCatalog();
}
function renderCatalog(){
 const list=$('product-list');list.replaceChildren();
 const q=str($('catalog-search').value).toLocaleLowerCase('ru');
 const items=products.filter(p=>p.kind===kind&&p.name.toLocaleLowerCase('ru').includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 if(selected&&!products.some(p=>p.id===selected&&p.kind===kind))selected=null;
 $('catalog-empty').hidden=items.length!==0;
 for(const p of items){
  const item=node('button','product-item'+(p.id===selected?' selected':''));item.type='button';
  const left=node('span');left.append(node('strong','',p.name));
  const guide=guideFor(p);if(guide)left.append(node('small','',guide[0]));
  left.append(node('small','',p.needsReview?(isSpicy(p)&&p.hours===48?'Предложено: 48 ч · +2…+6 °C · требуется подтверждение':'Срок и хранение — только после подтверждения'):kind==='ready'?(p.weight+' г · '+p.hours+' ч'):(p.hours+' ч · '+p.storage)));
  item.append(left,node('span','chevron','›'));item.addEventListener('click',()=>{selected=p.id;if(kind==='prep')$('point-name').value=p.point||'';renderCatalog()});list.append(item);
 }
 updatePreview();
}
function openManage(type=manageKind){
 manageKind=type;show('manage');renderManage();
}
function renderManage(){
 renderHome();$('manage-ready').classList.toggle('selected',manageKind==='ready');$('manage-prep').classList.toggle('selected',manageKind==='prep');
 const list=$('manage-list');list.replaceChildren();
 const items=products.filter(p=>p.kind===manageKind).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 $('manage-empty').hidden=items.length>0;
 for(const p of items){
  const row=node('div','manage-item'), info=node('div');
  info.append(node('strong','',p.name));
  const guide=guideFor(p);
  if(guide){info.append(node('small','prep-kind',guide[0]));info.append(node('small','prep-guide',guide[1]))}
  info.append(node('small','',p.needsReview?(isSpicy(p)&&p.hours===48?'Предложено владельцем: 48 ч · +2…+6 °C · печать до подтверждения заблокирована':'Требуется подтверждение данных · печать заблокирована'):manageKind==='ready'?('Вес '+p.weight+' г · '+p.hours+' ч · '+p.storage):(p.hours+' ч · '+p.storage)));
  const actions=node('div');const edit=node('button','','Изменить'),del=node('button','delete','Удалить');
  edit.type='button';del.type='button';edit.onclick=()=>openEditor(p);
  del.onclick=()=>{if(!confirm('Удалить этикетку «'+p.name+'» из базы?'))return;products=products.filter(x=>x.id!==p.id);if(save()){renderManage();if(selected===p.id)selected=null}};
  actions.append(edit,del);row.append(info,actions);list.append(row);
 }
}
function setFormKind(type){
 $('ready-fields').hidden=type!=='ready';$('prep-fields').hidden=type!=='prep';
 $('ready-fields').querySelectorAll('input,textarea').forEach(el=>el.disabled=type!=='ready');
 $('prep-fields').querySelectorAll('input').forEach(el=>el.disabled=type!=='prep');
 $('approval-area').hidden=type!=='prep';
}
function openEditor(p){
 editing=p?.id||null;
 const type=p?.kind||manageKind;
 setFormKind(type);
 $('editor-title').textContent=p?'Изменить этикетку':'Новый товар';
 const vals={name:p?.name||'',composition:p?.composition||'',p:p?.p??'',f:p?.f??'',c:p?.c??'',kcal:p?.kcal??'',weight:p?.weight??'',tolerance:p?.tolerance??10,point:p?.point||'',storage:p?.storage??(type==='ready'?'+2…+6 °C':''),hours:p?.hours??(type==='ready'?12:'')};
 for(const [key,val] of Object.entries(vals))$('edit-'+key).value=val;
 $('edit-approval').checked=!!p&&!p.needsReview;
 const tip=guideFor(p||{kind:type,name:str($('edit-name').value)});
 $('sanpin-item-guidance').hidden=!tip;
 $('sanpin-item-guidance').textContent=tip?'Для проверки: '+tip[1]:'';
 $('editor').showModal();setTimeout(()=>$('edit-name').focus(),30);
}
function saveEditor(ev){
 ev.preventDefault();
 const type=manageKind, fields={name:str($('edit-name').value),kind:type,storage:str($('edit-storage').value),hours:Number($('edit-hours').value)};
 if(!fields.name||!fields.storage||!Number.isSafeInteger(fields.hours)||fields.hours<=0||fields.hours>8760){alert('Заполни название, хранение и срок годности.');return}
 if(type==='ready'){
  fields.composition=str($('edit-composition').value);
  for(const x of ['p','f','c','kcal','weight','tolerance'])fields[x]=Number($('edit-'+x).value);
  if(!fields.composition||['p','f','c','kcal','weight','tolerance'].some(x=>$('edit-'+x).value===''||!Number.isFinite(fields[x]))||fields.weight<=0||fields.tolerance<0){
   alert('Заполни состав, вес и все значения КБЖУ. Неизвестные цифры нельзя заменять нулями.');return;
  }
 }else{fields.point=str($('edit-point').value);fields.needsReview=!$('edit-approval').checked}
 if(!editing&&products.some(p=>p.kind===type&&p.name.toLocaleLowerCase('ru')===fields.name.toLocaleLowerCase('ru'))){
  alert('Этикетка с таким названием уже есть в выбранной категории.');return;
 }
 if(editing){const at=products.findIndex(p=>p.id===editing);if(at>=0)products[at]={...products[at],...fields}}
 else products.push({id:makeId(),...fields});
 if(save()){
  $('editor').close();
  if(editFromCatalog){
    selected=editFromCatalog;editFromCatalog=null;
    show('catalog');renderCatalog();
  }else renderManage();
}
}
const rect=(g,x,y,w,h,line=2)=>{g.lineWidth=line;g.strokeRect(x+.5,y+.5,w-1,h-1)};
const hLine=(g,y,x1,x2)=>{g.beginPath();g.moveTo(x1,y+.5);g.lineTo(x2,y+.5);g.stroke()};
const vLine=(g,x,y1,y2)=>{g.beginPath();g.moveTo(x+.5,y1);g.lineTo(x+.5,y2);g.stroke()};
function fit(g,value,max,size=15,min=8,weight='700'){
 let fontSize=size;
 for(;fontSize>=min;fontSize-=.5){g.font=weight+' '+fontSize+'px Arial,sans-serif';if(g.measureText(value).width<=max)break}
 g.font=weight+' '+Math.max(min,fontSize)+'px Arial,sans-serif';
 return g.measureText(value).width<=max;
}
function write(g,value,x,y,opts={}){
 const content=String(value??'');
 if(!fit(g,content,opts.width??400,opts.size??14,opts.min??8,opts.weight??'700'))throw Error('Надпись «'+content.slice(0,25)+'…» слишком длинная для этикетки.');
 g.textAlign=opts.align||'left';g.fillText(content,x,y);
}
function wrap(g,text,maxWidth,maxLines,size,weight='400'){
 g.font=weight+' '+size+'px Arial,sans-serif';
 const words=String(text).split(/\s+/).filter(Boolean);const out=[];let row='';
 for(const word of words){
  const next=row?row+' '+word:word;
  if(g.measureText(next).width<=maxWidth)row=next;
  else{
   if(row)out.push(row);
   row='';
   for(const letter of word){if(row&&g.measureText(row+letter).width>maxWidth){out.push(row);row=letter}else row+=letter}
  }
 }
 if(row)out.push(row);
 if(out.length>maxLines)throw Error('Состав не помещается на этикетку 58 × 40. Сократи текст или название ингредиентов.');
 return out;
}
function canvasBase(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});if(!g)throw Error('Canvas недоступен');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#000';g.strokeStyle='#000';g.textBaseline='middle';return {c,g}}
function drawReady(p,epoch){
 const {c,g}=canvasBase(464,320);
 rect(g,6,6,452,308);rect(g,12,12,440,296);
 hLine(g,50,19,445);write(g,'СУШИ БЕРИ',23,33,{size:21,weight:'900',width:200});
 write(g,'Готовая продукция',443,34,{size:11,weight:'400',align:'right',width:182});
 const title=p.name.toUpperCase();
 if(!fit(g,title,412,24,11,'900')){
  const rows=wrap(g,title,402,2,17,'900');
  rows.forEach((line,i)=>write(g,line,232,65+i*19,{size:17,min:10,weight:'900',align:'center',width:409}));
 }else write(g,title,232,73,{size:24,min:11,weight:'900',align:'center',width:412});
 hLine(g,96,19,445);
 rect(g,20,99,425,60);hLine(g,122,20,445);hLine(g,141,20,445);
 write(g,'Пищевая ценность на 100 г',232,111,{size:13,width:410,align:'center',weight:'800'});
 const nutr=[['Б (г)',nv(p.p)],['Ж (г)',nv(p.f)],['У (г)',nv(p.c)],['Ккал',nv(p.kcal)]];
 const cell=425/4;
 for(let i=0;i<4;i++){if(i)vLine(g,20+cell*i,122,159);const mid=20+cell*(i+.5);
  write(g,nutr[i][0],mid,132,{size:13,min:9,width:cell-8,align:'center',weight:'800'});
  write(g,nutr[i][1],mid,149.3,{size:13,min:9,width:cell-8,align:'center'});
 }
 rect(g,20,163,425,49);
 let composition='Состав: '+p.composition;
 let rows;
 try{rows=wrap(g,composition,410,3,11.2)}catch{rows=wrap(g,composition,410,4,9.2)}
 const font=rows.length<=3?11.2:9.2,step=rows.length<=3?13:9.5;
 g.font='400 '+font+'px Arial,sans-serif';g.textAlign='left';
 rows.forEach((line,i)=>g.fillText(line,27,174+i*step));
 rect(g,20,216,425,88);vLine(g,179,216,304);vLine(g,339,216,304);hLine(g,260,339,445);
 write(g,'Вес нетто:',27,245,{size:12,width:145});
 write(g,p.weight+' г (±'+p.tolerance+' г)',27,266,{size:18,min:10,width:149,weight:'900'});
 write(g,'Изготовлено:',185,229,{size:11,width:146});
 write(g,formatted(epoch),185,244,{size:12.6,min:10,width:148});
 write(g,'Годен до:',185,270,{size:11,width:146});
 write(g,formatted(epoch+Number(p.hours)*3600000),185,285,{size:12.6,min:10,width:148});
 write(g,'Хранить при:',392,229,{size:10.5,min:8,width:96,align:'center',weight:'400'});
 write(g,p.storage,392,247,{size:13.1,min:8,width:95,align:'center',weight:'900'});
 write(g,'Срок годн.:',392,274,{size:10,min:8,width:96,align:'center',weight:'400'});
 write(g,p.hours+' ч',392,291,{size:15.5,min:10,width:96,align:'center',weight:'900'});
 return c;
}
function drawPrep(p,epoch,point){
 const {c,g}=canvasBase(248,160);
 rect(g,3,3,242,154);
 write(g,'FARUKH PRINT · МАРКИРОВКА',10,14,{size:9,min:7,width:199});
 write(g,'П/Ф',238,14,{size:9,min:7,width:34,align:'right'});
 hLine(g,24,9,239);
 const name=p.name.toUpperCase();
 if(!fit(g,name,225,17,9,'900')){
  const rows=wrap(g,name,225,2,13,'900');
  rows.forEach((line,i)=>write(g,line,124,36+i*13,{size:13,min:8,width:225,align:'center',weight:'900'}));
 }else write(g,name,124,41,{size:17,min:9,width:226,align:'center',weight:'900'});
 hLine(g,56,9,239);
 write(g,'Изгот.:',10,72,{size:10.7,width:60});
 write(g,formatted(epoch),238,72,{size:12,min:9,width:150,align:'right'});
 rect(g,9,87,230,30);
 write(g,'Годен до:',14,103,{size:10.5,width:84});
 write(g,formatted(epoch+Number(p.hours)*3600000),234,103,{size:12.7,min:9,width:138,align:'right'});
 hLine(g,131,9,239);
 write(g,p.storage,10,144,{size:11,min:8,width:150});
 write(g,point||'—',238,144,{size:10,min:8,width:75,align:'right'});
 return c;
}
function makePreview(){
 const p=current();if(!p){previewError='';return null}
 if(kind==='prep'&&(p.needsReview||!str(p.storage)||!Number.isInteger(p.hours)||p.hours<=0)){
   throw Error('Этот продукт пока не готов к печати. Нажми «Заполнить срок и условия хранения» ниже, укажи данные по ТТК или маркировке изготовителя и подтверди их.');
 }
 const when=new Date($('printed-at').value).getTime();
 if(!Number.isFinite(when))throw Error('Укажи дату и время изготовления.');
 return kind==='ready'?drawReady(p,when):drawPrep(p,when,str($('point-name').value)||p.point);
}
function updatePreview(){
 const p=current();$('no-preview').hidden=!!p;$('preview-canvas').hidden=!p;
 $('print-now').disabled=!p;
 $('fix-label').hidden=!p||kind!=='prep'||!p.needsReview;
 if(!p){status('Выбери товар из списка.');return}
 try{
  const canvas=makePreview();const prev=$('preview-canvas');prev.width=canvas.width;prev.height=canvas.height;
  prev.getContext('2d').drawImage(canvas,0,0);
  previewError='';$('no-preview').textContent='Выбери товар для просмотра';
  status(native?'Готово. Bluetooth-печать из приложения.':'Готово. Браузер откроет системную печать.');
 }catch(e){
  previewError=e.message;$('preview-canvas').hidden=true;$('no-preview').hidden=false;
  $('no-preview').textContent='Срок и условия хранения не подтверждены';
  status('Проверь данные: '+e.message,true);$('print-now').disabled=true
 }
}
function tspl(canvas,copies){
 const w=canvas.width,h=canvas.height;
 if(!((w===464&&h===320)||(w===248&&h===160)))throw Error('Неподдерживаемый формат этикетки.');
 const info=canvas.getContext('2d').getImageData(0,0,w,h).data;
 const bitmap=new Uint8Array((w/8)*h);bitmap.fill(255);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  if((info[i]*299+info[i+1]*587+info[i+2]*114)/1000<164&&info[i+3]>80)bitmap[y*w/8+(x>>3)]&=~(128>>(x&7));
 }
 const mm=w===464?'58 mm,40 mm':'31 mm,20 mm';
 const prefix=new TextEncoder().encode('\r\nSIZE '+mm+'\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,'+(w/8)+','+h+',0,');
 const suffix=new TextEncoder().encode('\r\nPRINT 1,'+copies+'\r\n');
 const result=new Uint8Array(prefix.length+bitmap.length+suffix.length);
 result.set(prefix);result.set(bitmap,prefix.length);result.set(suffix,prefix.length+bitmap.length);return result;
}
function toBase64(bytes){
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);
}
function job(){
 const p=current();if(!p)throw Error('Выбери товар.');
 const copies=Number($('copies').value);
 if(!Number.isInteger(copies)||copies<1||copies>20)throw Error('Количество — от 1 до 20.');
 const canvas=makePreview();return {canvas,copies};
}
function browserPrint({canvas,copies}){
 const paper=$('print-paper');paper.replaceChildren();
 const width=canvas.width===464?58:31,height=canvas.height===320?40:20;
 const printStyle=$('print-size-style')||node('style');printStyle.id='print-size-style';
 printStyle.textContent='@media print{@page{size:'+width+'mm '+height+'mm;margin:0}.paper-only{width:'+width+'mm!important}.paper-only img{width:'+width+'mm!important;height:'+height+'mm!important}}';
 if(!printStyle.parentElement)document.head.append(printStyle);
 const url=canvas.toDataURL('image/png');
 for(let i=0;i<copies;i++){const img=node('img');img.src=url;img.alt='Этикетка';paper.append(img)}
 window.print();
}
function doPrint(forceSystem=false){
 if(busy)return;
 let value;try{value=job()}catch(e){status(e.message,true);return}
 if(!native||forceSystem){browserPrint(value);return}
 busy=true;$('print-now').disabled=true;status('Передаю этикетку на Bluetooth-принтер V3 BT…');
 try{sendNative({type:'print',tspl:toBase64(tspl(value.canvas,value.copies))})}
 catch(e){busy=false;$('print-now').disabled=false;status('Ошибка Bluetooth: '+e.message,true)}
}
function choosePrinter(){
 if(!native){status('Прямое подключение доступно в Android-приложении FARUKH PRINT. В браузере используй системную печать.');return}
 if(busy)return;busy=true;status('Выбери Printer001 в списке Bluetooth-устройств…');
 try{sendNative({type:'select'})}catch(e){busy=false;status('Ошибка: '+e.message,true)}
}
if(native){
 window.FarukhPrinter.onmessage=event=>{
  busy=false;let answer;
  try{answer=JSON.parse(event.data)}catch{answer={ok:false,message:'Не удалось прочитать ответ Android.'}}
  status(answer.message,answer.ok===false);
  $('print-now').disabled=!current()||!!previewError;
 };
}
function exportDB(){
 const output={format:'farukh-print-catalog-v1',createdAt:new Date().toISOString(),products};
 const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const link=node('a');link.href=url;link.download='farukh-print-backup-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function importDB(ev){
 const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
 if(file.size>2*1024*1024){alert('Файл базы слишком большой (лимит 2 МБ).');return}
 try{
  const payload=JSON.parse(await file.text());
  if(payload.format!=='farukh-print-catalog-v1'||!Array.isArray(payload.products)||payload.products.length>1000)throw Error('Неверный формат базы FARUKH PRINT.');
  const items=[];const used=new Set();
  for(const p of payload.products){
   if(!p||!['ready','prep'].includes(p.kind)||typeof p.name!=='string'||!str(p.name))throw Error('Не все товары имеют названия.');
   if(!p.needsReview&&(!str(p.storage)||!Number.isSafeInteger(p.hours)||p.hours<1||p.hours>8760))throw Error('Не все действующие этикетки имеют подтверждённый срок и хранение.');
   if(p.kind==='ready'&&(!str(p.composition)||!['p','f','c','kcal','weight','tolerance'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))))throw Error('Ошибка состава, веса или КБЖУ.');
   const key=p.kind+'|'+p.name.toLocaleLowerCase('ru');if(used.has(key))throw Error('В резервной копии есть дублирующиеся товары.');used.add(key);
   items.push({...p,id:makeId(),name:p.name.slice(0,90),storage:p.storage.slice(0,60),composition:str(p.composition).slice(0,600),point:str(p.point).slice(0,40)});
  }
  if(!confirm('Заменить текущую базу из '+products.length+' товаров на '+items.length+' товаров из резервной копии?'))return;
  const old=products;products=items;if(!save()){products=old;return}
  selected=null;renderManage();alert('Готово! Импортировано '+items.length+' товаров.');
 }catch(e){alert('Не удалось загрузить базу: '+e.message)}
}
function boot(){
 load();renderHome();$('printed-at').value=nowLocal();
 $('choose-ready').onclick=()=>openCatalog('ready');$('choose-prep').onclick=()=>openCatalog('prep');
 $('manage-from-home').onclick=()=>openManage('ready');$('open-settings').onclick=()=>openManage('ready');
 $('go-home').onclick=()=>{show('home');renderHome()};
 $('catalog-back').onclick=()=>{show('home');renderHome()};$('manage-back').onclick=()=>{show('home');renderHome()};
 $('catalog-search').addEventListener('input',renderCatalog);
 $('printed-at').addEventListener('input',updatePreview);
 $('point-name').addEventListener('input',updatePreview);
 $('manage-ready').onclick=()=>openManage('ready');$('manage-prep').onclick=()=>openManage('prep');
 $('load-starter-prep').onclick=()=>{
  const count=STARTER_PREP_NAMES.filter(n=>!products.some(p=>p.kind==='prep'&&p.name.toLocaleLowerCase('ru')===n.toLocaleLowerCase('ru'))).length;
  if(!count){alert('Все 19 названий уже есть в базе.');return}
  if(!confirm('Добавить '+count+' полуфабрикатов из согласованного списка? Сроки хранения останутся незаполненными, до проверки печать недоступна.'))return;
  const old=[...products];mergeStarterPrep();if(save()){openManage('prep');alert('Добавлено '+count+' названий. Уточним сроки и затем разрешим печать.')}else products=old;
 };
 $('add-item').onclick=()=>openEditor(null);
 $('editor-form').addEventListener('submit',saveEditor);
 $('cancel-editor').onclick=()=>{editFromCatalog=null;$('editor').close()};
 $('close-editor').onclick=()=>{editFromCatalog=null;$('editor').close()};
 $('editor').addEventListener('cancel',()=>{editFromCatalog=null});
 $('fix-label').onclick=()=>{
   const p=current();if(!p||p.kind!=='prep')return;
   editFromCatalog=p.id;manageKind='prep';openEditor(p);
 };
 $('print-now').onclick=()=>doPrint(false);$('print-system').onclick=()=>doPrint(true);
 $('select-printer').onclick=choosePrinter;
 $('export-db').onclick=exportDB;$('import-db').onclick=()=>$('import-file').click();
 $('import-file').addEventListener('change',importDB);
 window.addEventListener('afterprint',()=>$('print-paper').replaceChildren());
 $('preview-canvas').hidden=true;$('no-preview').hidden=false;$('print-now').disabled=true;
 if(!native){$('select-printer').textContent='Android Bluetooth';}
}
boot();
})();
