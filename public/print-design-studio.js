// FARUKH AI draft-only, owner-facing label design studio.
// The approved FARUKH PRINT catalog and its print pipeline are intentionally untouched.
const KEY='farukh-print:my-designs:v1';
const CAP=100;
const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const dom=(tag,cls='',value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n};
const escapeXml=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const clip=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const COMPOSITIONS=[
 ['editorial','01 · Редакционный','Акцент на крупном заголовке'],
 ['modern','02 · Современный','Геометрия и строгие блоки'],
 ['layout-03','03 · Центральный','Заголовок по центру'],
 ['layout-04','04 · Контрастный','Чёрная верхняя лента'],
 ['layout-05','05 · Архитектурный','Двойная структура'],
 ['layout-06','06 · Классический','Модульные блоки'],
 ['layout-07','07 · Линейный','Сильные горизонтали'],
 ['layout-08','08 · Афиша','Крупный акцент в центре'],
 ['layout-09','09 · Газетный','Тонкие линии и сетка'],
 ['layout-10','10 · Сбалансированный','Текстовая композиция'],
 ['layout-11','11 · Рамка-архив','Даты в отдельном блоке'],
 ['layout-12','12 · Типографика','Выразительные надписи'],
 ['layout-13','13 · Минимализм','Воздух и отступы'],
 ['layout-14','14 · Геометрия','Чёткие ячейки'],
 ['layout-15','15 · Колонки','Разделение информации'],
 ['layout-16','16 · Премиум','Строгая нижняя панель'],
 ['layout-17','17 · Контур','Двойные акценты'],
 ['layout-18','18 · Выставочный','Заголовки и полосы'],
 ['layout-19','19 · Деловой','Контрастные разделители'],
 ['layout-20','20 · Монограмма','Симметричная структура']
];
const FRAMES=[
 ['double','Двойная классическая'],['single','Одинарная'],['corners','Только углы'],
 ['triple','Тройной контур'],['none','Без внешней рамки'],['thick','Массивная'],
 ['dashed','Штриховая'],['dotted','Точечная'],['inset','Глубокий отступ'],
 ['rounded','Скруглённая'],['brackets','Угловые скобки'],['ticket','Билетные боковины'],
 ['topbottom','Только верх и низ'],['leftbar','Акцент слева'],['doublecorners','Двойные уголки']
];
const RULES=[
 ['double','Двойные'],['solid','Сплошные'],['dashed','Пунктир'],
 ['dotted','Точки'],['dashdot','Штрих-точка'],['thin','Тонкие'],
 ['bold','Жирные'],['triple','Тройные'],['segmented','Сегменты'],
 ['diamonds','Ромбы'],['dotsends','Точки по краям'],['waves','Волнистые'],
 ['zigzag','Зигзаг'],['center','С центральной меткой'],['alternating','Переменные']
];
const FONTS=[
 ['serif','01 · Классический Georgia','Georgia,Times New Roman,serif'],
 ['sans','02 · Современный Arial','Arial,Helvetica,sans-serif'],
 ['times','03 · Times','Times New Roman,Times,serif'],
 ['verdana','04 · Verdana','Verdana,Geneva,sans-serif'],
 ['tahoma','05 · Tahoma','Tahoma,Geneva,sans-serif'],
 ['trebuchet','06 · Trebuchet','Trebuchet MS,Arial,sans-serif'],
 ['courier','07 · Машинописный','Courier New,Courier,monospace'],
 ['palatino','08 · Palatino','Palatino Linotype,Book Antiqua,Palatino,serif'],
 ['garamond','09 · Garamond','Garamond,Georgia,serif'],
 ['impact','10 · Impact','Impact,Arial Black,sans-serif'],
 ['arialblack','11 · Arial Black','Arial Black,Arial,sans-serif'],
 ['segoe','12 · Segoe UI','Segoe UI,Arial,sans-serif'],
 ['century','13 · Century Gothic','Century Gothic,Arial,sans-serif'],
 ['cambria','14 · Cambria','Cambria,Georgia,serif'],
 ['consolas','15 · Consolas','Consolas,Lucida Console,monospace']
];
const LABELS=[
 ['top','Верхняя подпись'],['product','Тип продукта (крупно)'],['flavor','Название товара / вкус'],
 ['compositionTitle','Подпись «Состав»'],['composition','Состав продукта'],
 ['bottlingTitle','Подпись даты разлива'],['bottling','Дата / время разлива'],
 ['expiryTitle','Подпись «Годен до»'],['expiry','Дата / время окончания'],
 ['storageTitle','Подпись условий хранения'],['storage','Условия хранения'],['footer','Нижняя подпись']
];
const TEXT_KEYS=new Set(LABELS.map(x=>x[0]));
const DEFAULT_TEXT={
 top:'ГОТОВАЯ ПРОДУКЦИЯ',product:'МОРС',flavor:'ЧЁРНОЙ СМОРОДИНЫ',
 compositionTitle:'СОСТАВ',composition:'вода, концентрированный сок чёрной смородины, сахар',
 bottlingTitle:'ДАТА РАЗЛИВА',bottling:'__.__.____   __:__',
 expiryTitle:'ГОДЕН ДО',expiry:'__.__.____   __:__',
 storageTitle:'ХРАНИТЬ ПРИ',storage:'+2…+6 °C',footer:''
};
const DEFAULT_SIZES={top:12,product:58,flavor:24,compositionTitle:12,composition:14,bottlingTitle:12,bottling:17,expiryTitle:12,expiry:17,storageTitle:12,storage:17,footer:10};
const makeText=(sample='currant')=>({...DEFAULT_TEXT,...(sample==='cranberry'?{flavor:'КЛЮКВЕННЫЙ',composition:'вода, концентрированный сок клюквы, сахар'}:{})});
const starter=[
{id:'builtin-editorial-58x40',name:'Редакционный · рамка и линии',style:'editorial',frame:'double',rule:'double',stroke:2,font:'serif',sample:'currant',size:'58x40'},
{id:'builtin-modern-58x40',name:'Современный · строгая геометрия',style:'modern',frame:'single',rule:'solid',stroke:2,font:'sans',sample:'cranberry',size:'58x40'}
];
function validate(data){
 if(!data||typeof data!=='object')throw Error('Неверный формат макета.');
 const permitted=(value,items,fallback)=>items.some(x=>x[0]===value)?value:fallback;
 const sample=data.sample==='cranberry'?'cranberry':'currant';
 const rawText=data.texts&&typeof data.texts==='object'?data.texts:{};
 const texts=makeText(sample);
 for(const key of TEXT_KEYS)if(typeof rawText[key]==='string')texts[key]=rawText[key].slice(0,key==='composition'?500:140);
 const positions={},sizes={};
 if(data.positions&&typeof data.positions==='object')for(const key of TEXT_KEYS){
  const val=data.positions[key];
  if(Array.isArray(val)&&val.length===2&&val.every(n=>Number.isFinite(Number(n))))positions[key]=[clip(val[0],15,446),clip(val[1],24,299)];
 }
 if(data.sizes&&typeof data.sizes==='object')for(const key of TEXT_KEYS){
  const v=Number(data.sizes[key]);if(Number.isFinite(v))sizes[key]=clip(v,8,76);
 }
 const p={
  id:typeof data.id==='string'&&data.id.length<120?data.id:uid(),
  name:String(data.name||'').trim().slice(0,70),
  size:'58x40',
  style:permitted(data.style,COMPOSITIONS,'editorial'),
  frame:permitted(data.frame,FRAMES,'double'),
  rule:permitted(data.rule,RULES,'solid'),
  stroke:clip(data.stroke||2,1,4),
  font:permitted(data.font,FONTS,'serif'),
  sample,texts,positions,sizes
 };
 if(!p.name)throw Error('Укажи название шаблона.');
 return p;
}
function load(){
 const raw=localStorage.getItem(KEY);
 if(raw===null)return {items:starter.map(validate),first:true};
 let data;try{data=JSON.parse(raw)}catch{throw Error('Повреждена база макетов. Сохрани данные устройства перед восстановлением.')}
 if(!Array.isArray(data)||data.length>CAP)throw Error('Неверный список макетов.');
 const items=data.map(validate);
 if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('Обнаружены повторяющиеся идентификаторы.');
 return {items,first:false};
}
const svgLine=(x1,y1,x2,y2,width=1,dash='')=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#111" stroke-width="'+width+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
const rect=(x,y,w,h,sw=1,extra='')=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="none" stroke="#111" stroke-width="'+sw+'" '+extra+'/>';
function decorations(p){
 const k=p.frame,w=p.stroke;
 if(k==='none')return '';
 if(k==='single')return rect(7,7,450,306,w);
 if(k==='double')return rect(7,7,450,306,w)+rect(13,13,438,294,1);
 if(k==='triple')return rect(4,4,456,312,1)+rect(10,10,444,300,w)+rect(15,15,434,290,1);
 if(k==='thick')return rect(8,8,448,304,Math.max(4,w+2));
 if(k==='dashed')return rect(8,8,448,304,w,'stroke-dasharray="12 6"');
 if(k==='dotted')return rect(8,8,448,304,w,'stroke-dasharray="2 6" stroke-linecap="round"');
 if(k==='inset')return rect(18,17,428,285,w)+rect(22,21,420,277,1);
 if(k==='rounded')return rect(8,8,448,304,w,'rx="22" ry="22"');
 if(k==='ticket')return rect(9,9,446,302,w,'rx="12"')+svgLine(25,5,25,315,2)+svgLine(439,5,439,315,2);
 if(k==='topbottom')return svgLine(8,9,456,9,w)+svgLine(8,311,456,311,w);
 if(k==='leftbar')return rect(7,7,450,306,1)+'<rect x="7" y="7" width="7" height="306" fill="#111"/>';
 if(['corners','doublecorners','brackets'].includes(k)){
  let s='';const len=k==='brackets'?24:17;
  for(const x of [8,456])for(const y of [8,312]){
   const sx=x===8?1:-1,sy=y===8?1:-1;
   s+=svgLine(x,y,x+sx*len,y,w)+svgLine(x,y,x,y+sy*len,w);
   if(k==='doublecorners')s+=svgLine(x+sx*5,y+sy*5,x+sx*(len+3),y+sy*5,1)+svgLine(x+sx*5,y+sy*5,x+sx*5,y+sy*(len+3),1);
  }
  if(k==='brackets')s+=svgLine(14,158,21,158,w)+svgLine(443,158,450,158,w);
  return s;
 }
 return rect(7,7,450,306,w);
}
function divider(p,y){
 const k=p.rule,w=p.stroke,x1=23,x2=441;
 if(k==='double')return svgLine(x1,y,x2,y,w)+svgLine(x1,y+4,x2,y+4,1);
 if(k==='triple')return svgLine(x1,y-3,x2,y-3,1)+svgLine(x1,y,x2,y,w)+svgLine(x1,y+3,x2,y+3,1);
 if(k==='dashed')return svgLine(x1,y,x2,y,w,'12 7');
 if(k==='dotted')return svgLine(x1,y,x2,y,w,'1 7');
 if(k==='dashdot')return svgLine(x1,y,x2,y,w,'13 5 2 5');
 if(k==='thin')return svgLine(x1,y,x2,y,.65);
 if(k==='bold')return svgLine(x1,y,x2,y,Math.max(3,w+2));
 if(k==='segmented'){let s='';for(let i=0;i<7;i++)s+=svgLine(x1+i*60,y,Math.min(x2,x1+i*60+42),y,w);return s}
 if(k==='diamonds'){let s=svgLine(x1,y,x2,y,1);for(let i=0;i<9;i++){const x=45+i*47;s+='<path d="M'+x+' '+(y-4)+' l4 4 -4 4 -4 -4 Z" fill="#111"/>'}return s}
 if(k==='dotsends')return svgLine(32,y,432,y,w)+'<circle cx="23" cy="'+y+'" r="4" fill="#111"/><circle cx="441" cy="'+y+'" r="4" fill="#111"/>';
 if(k==='waves'||k==='zigzag'){let d='M23 '+y;for(let x=29;x<=441;x+=6){const offset=k==='zigzag'?(Math.floor((x-29)/6)%2?4:-4):Math.sin((x-23)/11)*3;d+=' L'+x+' '+(y+offset)}return '<path d="'+d+'" fill="none" stroke="#111" stroke-width="'+w+'"/>'}
 if(k==='center')return svgLine(23,y,215,y,w)+svgLine(249,y,441,y,w)+'<rect x="227" y="'+(y-4)+'" width="8" height="8" fill="#111" transform="rotate(45 231 '+y+')"/>';
 if(k==='alternating')return svgLine(23,y,161,y,1)+svgLine(166,y,300,y,3)+svgLine(305,y,441,y,1);
 return svgLine(x1,y,x2,y,w);
}
function layout(style){
 const index=COMPOSITIONS.findIndex(x=>x[0]===style);
 const i=index<0?0:index;
 const group=i%5,dates=Math.floor(i/5);
 const base={
 top:[24,37],product:[23,110],flavor:[242,98],compositionTitle:[24,160],composition:[24,183],
 bottlingTitle:[26,235],bottling:[26,263],expiryTitle:[245,235],expiry:[245,263],
 storageTitle:[24,300],storage:[437,301],footer:[231,313]
 };
 if(group===1){Object.assign(base,{top:[26,37],product:[24,96],flavor:[24,126],compositionTitle:[24,159],composition:[24,183]})}
 if(group===2){Object.assign(base,{top:[231,35],product:[231,94],flavor:[231,132],compositionTitle:[25,161],composition:[25,183]})}
 if(group===3){Object.assign(base,{top:[26,37],product:[24,95],flavor:[24,131],compositionTitle:[24,160],composition:[24,181]})}
 if(group===4){Object.assign(base,{top:[24,37],product:[24,91],flavor:[238,95],compositionTitle:[24,160],composition:[24,182]})}
 if(dates===1){base.bottlingTitle=[33,230];base.bottling=[33,257];base.expiryTitle=[253,230];base.expiry=[253,257]}
 if(dates===2){base.bottlingTitle=[29,225];base.bottling=[29,253];base.expiryTitle=[247,225];base.expiry=[247,253]}
 if(dates===3){base.bottlingTitle=[30,233];base.bottling=[30,257];base.expiryTitle=[248,233];base.expiry=[248,257]}
 return {group,dates,base};
}
function wrap(text,max=47,lines=2){
 const words=String(text).split(/\s+/),out=[];let row='';
 for(const word of words){if(!word)continue;const trial=row?row+' '+word:word;if(trial.length>max&&row){out.push(row);row=word}else row=trial}
 if(row)out.push(row);
 if(out.length>lines){out[lines-1]=(out.slice(lines-1).join(' ')).slice(0,max-1)+'…';out.length=lines}
 return out.length?out:[''];
}
function draw(p,selectedField=''){
 p=validate(p);
 const {group,dates,base}=layout(p.style);
 const pos=k=>p.positions[k]||base[k];
 const selected=p.texts;
 const face=FONTS.find(x=>x[0]===p.font)[2];
 const size=k=>p.sizes[k]||DEFAULT_SIZES[k];
 const centered=group===2;
 const fTop=(group===1||group===3);
 let s='<svg xmlns="http://www.w3.org/2000/svg" width="464" height="320" viewBox="0 0 464 320" role="img" aria-label="Редактируемая этикетка 58 на 40 миллиметров" style="touch-action:none"><rect width="464" height="320" fill="#fff"/>';
 if(fTop)s+='<rect x="17" y="17" width="430" height="34" fill="#111"/>';
 if(group===4)s+='<rect x="226" y="52" width="1" height="92" fill="#111"/>';
 if(group===0)s+=svgLine(224,62,224,138,1.5);
 if(group===2)s+=svgLine(172,46,290,46,2);
 s+=decorations(p);
 s+=divider(p,56);
 s+=divider(p,145);
 s+=divider(p,204);
 if(dates===0){s+=rect(21,214,203,65,1)+rect(240,214,203,65,1)}
 if(dates===1){s+=rect(21,210,203,71,2,'rx="7"')+rect(240,210,203,71,2,'rx="7"')}
 if(dates===2){s+=svgLine(23,268,223,268,2)+svgLine(241,268,441,268,2)+svgLine(230,216,230,269,1)}
 if(dates===3){s+='<rect x="21" y="211" width="422" height="67" fill="none" stroke="#111" stroke-width="1"/>'+svgLine(232,211,232,278,2)+svgLine(21,238,443,238,1)}
 s+=divider(p,284);
 const addText=(k)=>{
  const value=selected[k];
  if(!value)return;
  const [x,y]=pos(k),sz=size(k);
  const align=centered&&['top','product','flavor'].includes(k)?'middle':(k==='storage'?'end':(k==='footer'?'middle':'start'));
  const isHeader=k==='top'&&fTop;
  const weight=['product','flavor'].includes(k)?900:(['top','compositionTitle','bottlingTitle','expiryTitle','storageTitle'].includes(k)?800:600);
  const content=k==='composition'?wrap(value,52,2):[value];
  const width=k==='composition'?420:Math.min(430,Math.max(65,Array.from(value).length*sz*.58));
  const bx=align==='middle'?x-width/2:align==='end'?x-width:x;
  let el='<g data-move="'+k+'" style="cursor:grab" aria-label="'+escapeXml(LABELS.find(f=>f[0]===k)[1])+'">';
  el+='<rect x="'+clip(bx,14,450-width)+'" y="'+clip(y-sz,15,295)+'" width="'+Math.min(width,420)+'" height="'+Math.min(48,sz+12)+'" fill="#fff" fill-opacity="0" pointer-events="all"/>';
  if(selectedField===k)el+='<rect x="'+clip(bx-3,12,450-width)+'" y="'+clip(y-sz-3,14,295)+'" width="'+Math.min(width+6,428)+'" height="'+Math.min(48,sz+15)+'" rx="3" fill="none" stroke="#237ca4" stroke-dasharray="4 3" stroke-width="1.5" pointer-events="none"/>';
  el+='<text x="'+x+'" y="'+y+'" font-family="'+escapeXml(face)+'" font-size="'+sz+'" font-weight="'+weight+'" text-anchor="'+align+'" fill="'+(isHeader?'#fff':'#111')+'" pointer-events="none">';
  for(let j=0;j<content.length;j++)el+='<tspan x="'+x+'" dy="'+(j?sz*1.2:0)+'">'+escapeXml(content[j])+'</tspan>';
  return el+'</text></g>';
 };
 for(const key of ['top','product','flavor','compositionTitle','composition','bottlingTitle','bottling','expiryTitle','expiry','storageTitle','storage','footer'])s+=addText(key)||'';
 return s+'</svg>';
}
function download(name,content,mime){
 const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob);
 const a=dom('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
export function mountPrintDesignStudio({root}){
 if(!root)return;
 if(!document.getElementById('farukh-print-design-studio-style')){
  const el=dom('style');el.id='farukh-print-design-studio-style';el.textContent=
  '#print-control-root:not([data-pc-workspace="templates"]) .pds{display:none!important}'+
  '#print-control-root[data-pc-workspace="templates"] :is(.pc-stats,.pc-readiness,.pc-toolbar,.pc-premium-template,.pc-filters,.pc-normative-notice,.pc-list,.pc-pagination,.pc-transfer,.pc-integration,.pc-log,.pcloud,.pstaff){display:none!important}'+
  '#print-control-root .pc-workspace-tabs{grid-template-columns:repeat(5,minmax(0,1fr))}'+
  '#print-control-root .pds{padding:20px 0 30px;color:#243240}'+
  '#print-control-root .pds h2{margin:0 0 8px;font-size:24px}'+
  '#print-control-root .pds p{line-height:1.5;font-size:13px;color:#627887}'+
  '#print-control-root .pds-grid{display:grid;grid-template-columns:minmax(215px,290px) minmax(0,1fr);gap:16px}'+
  '#print-control-root .pds-panel{background:#fff;border:1px solid #dce5ed;border-radius:17px;padding:17px;box-shadow:0 4px 16px #142d4210}'+
  '#print-control-root .pds-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:12px 0}'+
  '#print-control-root .pds button{border-radius:9px;border:1px solid #c9d7e1;background:#fff;padding:10px 12px;color:#243240;font-size:12px;font-weight:750;cursor:pointer}'+
  '#print-control-root .pds button.primary{background:#254b60;color:#fff;border-color:#254b60}'+
  '#print-control-root .pds button.danger{color:#a42f49}'+
  '#print-control-root .pds button:disabled{opacity:.45}'+
  '#print-control-root .pds-list{display:grid;gap:8px;max-height:390px;overflow:auto}'+
  '#print-control-root .pds-list button{text-align:left;padding:12px}'+
  '#print-control-root .pds-list button.selected{border-color:#3a718c;background:#f0f7fb}'+
  '#print-control-root .pds-list button small{display:block;color:#748695;margin-top:4px}'+
  '#print-control-root .pds-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin:14px 0}'+
  '#print-control-root .pds-fields label{display:grid;gap:5px;font-size:12px;font-weight:750;color:#445767}'+
  '#print-control-root .pds-fields .wide{grid-column:1/-1}'+
  '#print-control-root .pds input,#print-control-root .pds select,#print-control-root .pds textarea{min-width:0;width:100%;padding:10px;border-radius:9px;border:1px solid #cad7e1;background:#fff;color:#202a32;font-size:14px}'+
  '#print-control-root .pds textarea{resize:vertical;min-height:66px}'+
  '#print-control-root .pds-preview{margin:16px 0 9px;background:#edf2f6;padding:17px 9px;border-radius:12px;display:flex;justify-content:center;overflow:auto;touch-action:none}'+
  '#print-control-root .pds-preview svg{background:#fff;width:min(100%,464px);height:auto;box-shadow:0 7px 24px #131c2730;touch-action:none;user-select:none}'+
  '#print-control-root .pds-note{border:1px solid #e6d7bb;background:#fff9ed;border-radius:12px;padding:11px 14px;color:#835f25;font-size:12px;line-height:1.45;margin:12px 0}'+
  '#print-control-root .pds-inspector{border:1px solid #b9d8e7;background:#f5fbff;border-radius:12px;padding:13px;margin-top:12px}'+
  '#print-control-root .pds-inspector h3{font-size:15px;margin:0 0 7px}'+
  '#print-control-root .pds-message{min-height:19px;color:#226c58;font-size:12px;font-weight:700}'+
  '@media(max-width:780px){#print-control-root .pds-grid{grid-template-columns:1fr}#print-control-root .pc-workspace-tabs{display:flex!important;overflow-x:auto}#print-control-root .pc-workspace-tab{flex:0 0 auto;min-width:95px}}'+
  '@media(max-width:460px){#print-control-root .pds-fields{grid-template-columns:1fr}#print-control-root .pds-panel{padding:12px}}';
  document.head.append(el);
 }
 const section=dom('section','pds');section.setAttribute('aria-label','Мои шаблоны');root.append(section);
 section.append(dom('h2','','Мои шаблоны · 58 × 40 мм'),dom('p','','20 композиций · 15 рамок · 15 разделителей · 15 шрифтов. Редактируй все надписи и перетаскивай их прямо на макете.'));
 section.append(dom('div','pds-note','Макеты сохраняются локально в браузере FARUKH AI. Этот редактор не заменяет утверждённую производственную этикетку и пока не отправляет дизайны на принтер. Даты в образце не считаются автоматически.'));
 const grid=dom('div','pds-grid');grid.style.marginTop='15px';section.append(grid);
 const sidebar=dom('div','pds-panel'),editor=dom('div','pds-panel');grid.append(sidebar,editor);
 const count=dom('strong');sidebar.append(count);
 const list=dom('div','pds-list');sidebar.append(list);
 const listBar=dom('div','pds-actions'),add=dom('button','primary','＋ Новый'),copy=dom('button','','Копировать'),remove=dom('button','danger','Удалить');listBar.append(add,copy,remove);sidebar.append(listBar);
 const backupBar=dom('div','pds-actions'),backup=dom('button','','Скачать JSON'),restore=dom('button','','Импорт JSON');backupBar.append(backup,restore);sidebar.append(backupBar);
 const upload=dom('input');upload.type='file';upload.accept='application/json,.json';upload.hidden=true;sidebar.append(upload);
 const mainFields=dom('div','pds-fields');editor.append(mainFields);
 const field=(container,label,opts,wide=false)=>{
  const wrap=dom('label',wide?'wide':'');wrap.append(dom('span','',label));
  let control;
  if(Array.isArray(opts)){control=dom('select');for(const [key,value] of opts){const option=dom('option','',value);option.value=key;control.append(option)}}
  else if(opts==='textarea'){control=dom('textarea');control.rows=2}
  else{control=dom('input');control.type=opts||'text'}
  wrap.append(control);container.append(wrap);return control;
 };
 const name=field(mainFields,'Название шаблона','text',true);
 const style=field(mainFields,'Композиция · 20 вариантов',COMPOSITIONS.map(a=>[a[0],a[1]+' · '+a[2]]));
 const frame=field(mainFields,'Рамка · 15 вариантов',FRAMES);
 const rule=field(mainFields,'Разделительная линия · 15 вариантов',RULES);
 const font=field(mainFields,'Шрифт · 15 вариантов',FONTS.map(a=>a.slice(0,2)));
 const stroke=field(mainFields,'Толщина линии',[['1','1 · Тонкая'],['2','2 · Стандарт'],['3','3 · Выразительная'],['4','4 · Плотная']]);
 const product=field(mainFields,'Тип продукта (крупная надпись)','text',true);
 const flavor=field(mainFields,'Название продукта / вкус','text',true);
 const composition=field(mainFields,'Состав (можно переписать полностью)','textarea',true);
 const storage=field(mainFields,'Условия хранения (можно переписать)','text',true);
 const sampleBar=dom('div','pds-actions');const blackcurrant=dom('button','','Пример: смородина'),cranberry=dom('button','','Пример: клюква');
 sampleBar.append(dom('small','','Подставить пример: '),blackcurrant,cranberry);editor.append(sampleBar);
 editor.append(dom('h3','','Предпросмотр · перетаскивай любую надпись'));
 const preview=dom('div','pds-preview');editor.append(preview);
 const inspector=dom('div','pds-inspector');editor.append(inspector);
 inspector.append(dom('h3','','Точное редактирование всех надписей'));
 const inspectFields=dom('div','pds-fields');inspector.append(inspectFields);
 const chosen=field(inspectFields,'Выбери надпись',LABELS,true);
 const textValue=field(inspectFields,'Текст выбранной надписи','textarea',true);
 const posX=field(inspectFields,'Положение по горизонтали (X)','number');
 const posY=field(inspectFields,'Положение по вертикали (Y)','number');
 const fontSize=field(inspectFields,'Размер этой надписи','number');
 const reset=dom('button','','Вернуть позиции как в композиции');inspector.append(reset);
 const status=dom('div','pds-message');status.setAttribute('role','status');editor.append(status);
 const actions=dom('div','pds-actions'),save=dom('button','primary','Сохранить макет'),exportSvg=dom('button','','Скачать SVG');actions.append(save,exportSvg);editor.append(actions);
 let items=[],selectedId=null,currentField='flavor',draft=null,dirty=false;
 try{const loaded=load();items=loaded.items;if(loaded.first)localStorage.setItem(KEY,JSON.stringify(items))}
 catch(err){status.textContent=err.message;for(const x of [add,copy,remove,save,restore,backup])x.disabled=true;return}
 const active=()=>items.find(p=>p.id===selectedId);
 const mark=()=>{dirty=true;status.textContent='Есть несохранённые изменения'};
 const previewRender=()=>{try{preview.innerHTML=draw(draft,currentField)}catch(err){preview.replaceChildren();status.textContent='Ошибка: '+err.message}};
 const inspectRefresh=()=>{if(!draft)return;
  chosen.value=currentField;textValue.value=draft.texts[currentField];
  const {base}=layout(draft.style),point=draft.positions[currentField]||base[currentField];
  posX.value=point[0];posY.value=point[1];fontSize.value=draft.sizes[currentField]||DEFAULT_SIZES[currentField];
  previewRender();
 };
 const refreshList=()=>{count.textContent=items.length+' / '+CAP+' шаблонов';list.replaceChildren();
  for(const item of items){const b=dom('button',item.id===selectedId?'selected':'');
   const label=COMPOSITIONS.find(c=>c[0]===item.style)?.[1]||'Редакционный';
   b.append(dom('strong','',item.name),dom('small','',label));
   b.onclick=()=>{if(dirty&&!confirm('Отменить несохранённые изменения?'))return;choose(item.id)};list.append(b)}
  add.disabled=items.length>=CAP;copy.disabled=items.length>=CAP;remove.disabled=items.length<=1;
 };
 const choose=id=>{const item=items.find(x=>x.id===id);if(!item)return;
  selectedId=id;draft=validate(item);dirty=false;
  name.value=draft.name;style.value=draft.style;frame.value=draft.frame;rule.value=draft.rule;font.value=draft.font;stroke.value=draft.stroke;
  product.value=draft.texts.product;flavor.value=draft.texts.flavor;composition.value=draft.texts.composition;storage.value=draft.texts.storage;
  status.textContent='Макет сохранён на этом устройстве';refreshList();inspectRefresh();
 };
 const applyTextChange=(key,value)=>{
  draft.texts[key]=String(value).slice(0,key==='composition'?500:140);
  if(key==='product')product.value=draft.texts[key];
  if(key==='flavor')flavor.value=draft.texts[key];
  if(key==='composition')composition.value=draft.texts[key];
  if(key==='storage')storage.value=draft.texts[key];
  if(key===currentField)textValue.value=draft.texts[key];
  mark();previewRender();
 };
 for(const [input,key] of [[style,'style'],[frame,'frame'],[rule,'rule'],[font,'font']]){
  input.addEventListener('change',()=>{draft[key]=input.value;mark();inspectRefresh()});
 }
 stroke.addEventListener('change',()=>{draft.stroke=clip(stroke.value,1,4);mark();previewRender()});
 name.addEventListener('input',()=>{draft.name=name.value.slice(0,70);mark()});
 for(const [input,key] of [[product,'product'],[flavor,'flavor'],[composition,'composition'],[storage,'storage']]){
  input.addEventListener('input',()=>applyTextChange(key,input.value));
 }
 const applySample=sample=>{
  if(!confirm('Заменить тип товара, название и состав на пример? Другие надписи останутся как есть.'))return;
  const values=makeText(sample);
  draft.sample=sample;
  for(const key of ['product','flavor','composition'])draft.texts[key]=values[key];
  product.value=draft.texts.product;flavor.value=draft.texts.flavor;composition.value=draft.texts.composition;
  mark();inspectRefresh();
 };
 blackcurrant.onclick=()=>applySample('currant');cranberry.onclick=()=>applySample('cranberry');
 chosen.addEventListener('change',()=>{currentField=chosen.value;inspectRefresh()});
 textValue.addEventListener('input',()=>applyTextChange(currentField,textValue.value));
 const coordinateEdit=()=>{
  const {base}=layout(draft.style);const current=draft.positions[currentField]||base[currentField];
  draft.positions[currentField]=[clip(posX.value||current[0],15,446),clip(posY.value||current[1],24,299)];
  mark();previewRender();
 };
 posX.addEventListener('change',coordinateEdit);posY.addEventListener('change',coordinateEdit);
 fontSize.min='8';fontSize.max='76';fontSize.addEventListener('change',()=>{
  draft.sizes[currentField]=clip(fontSize.value,8,76);fontSize.value=draft.sizes[currentField];mark();previewRender();
 });
 reset.onclick=()=>{if(!confirm('Вернуть расположение всех надписей в выбранной композиции? Тексты не изменятся.'))return;draft.positions={};mark();inspectRefresh()};
 let drag=null;
 preview.addEventListener('pointerdown',event=>{
  const group=event.target.closest?.('[data-move]');if(!group||!draft)return;
  const key=group.getAttribute('data-move');if(!TEXT_KEYS.has(key))return;
  event.preventDefault();currentField=key;inspectRefresh();
  const svg=preview.querySelector('svg');if(!svg)return;
  const box=svg.getBoundingClientRect(),base=layout(draft.style).base;
  const origin=draft.positions[key]||base[key];
  drag={key,startX:event.clientX,startY:event.clientY,x:origin[0],y:origin[1],scaleX:464/box.width,scaleY:320/box.height};
  preview.setPointerCapture?.(event.pointerId);
 });
 preview.addEventListener('pointermove',event=>{
  if(!drag)return;event.preventDefault();
  draft.positions[drag.key]=[clip(drag.x+(event.clientX-drag.startX)*drag.scaleX,15,446),clip(drag.y+(event.clientY-drag.startY)*drag.scaleY,24,299)];
  posX.value=Math.round(draft.positions[drag.key][0]);posY.value=Math.round(draft.positions[drag.key][1]);
  mark();previewRender();
 });
 const stopDrag=()=>{drag=null};
 preview.addEventListener('pointerup',stopDrag);preview.addEventListener('pointercancel',stopDrag);
 preview.addEventListener('lostpointercapture',stopDrag);
 const persist=()=>{
  const index=items.findIndex(p=>p.id===selectedId);if(index<0)throw Error('Не выбран шаблон.');
  const normalized=validate(draft);items[index]=normalized;
  localStorage.setItem(KEY,JSON.stringify(items));dirty=false;choose(selectedId);
 };
 add.onclick=()=>{if(items.length>=CAP)return;if(dirty&&!confirm('Отменить несохранённые изменения?'))return;
  const p=validate({...draft,id:uid(),name:'Новый шаблон '+(items.length+1)});
  items.push(p);try{localStorage.setItem(KEY,JSON.stringify(items));choose(p.id)}catch(err){items.pop();status.textContent=err.message}
 };
 copy.onclick=()=>{if(items.length>=CAP)return;
  const p=validate({...draft,id:uid(),name:(draft.name+' · копия').slice(0,70)});
  items.push(p);try{localStorage.setItem(KEY,JSON.stringify(items));choose(p.id)}catch(err){items.pop();status.textContent=err.message}
 };
 remove.onclick=()=>{if(items.length<=1||!confirm('Удалить этот шаблон?'))return;
  const previous=items;items=items.filter(x=>x.id!==selectedId);
  try{localStorage.setItem(KEY,JSON.stringify(items));choose(items[0].id)}catch(err){items=previous;status.textContent=err.message}
 };
 save.onclick=()=>{try{persist()}catch(err){status.textContent=err.message}};
 exportSvg.onclick=()=>{try{download('etiketka-58x40-maket.svg',draw(draft),'image/svg+xml;charset=utf-8');status.textContent='Скачан демонстрационный SVG, не этикетка для производственной печати.'}catch(err){status.textContent=err.message}};
 backup.onclick=()=>download('farukh-print-designs-backup.json',JSON.stringify({format:'farukh-print-my-designs-v1',designs:items},null,2),'application/json;charset=utf-8');
 restore.onclick=()=>upload.click();
 upload.onchange=async()=>{const file=upload.files?.[0];upload.value='';if(!file)return;
  try{
   if(file.size>400000)throw Error('Файл превышает 400 КБ.');
   const data=JSON.parse(await file.text());
   if(data.format!=='farukh-print-my-designs-v1'||!Array.isArray(data.designs)||data.designs.length>CAP)throw Error('Неверный формат копии.');
   const imported=data.designs.map(validate),next=items.slice(),ids=new Set(next.map(x=>x.id));
   for(const p of imported)if(!ids.has(p.id)){ids.add(p.id);next.push(p)}
   if(next.length>CAP)throw Error('Превышено 100 шаблонов.');if(!confirm('Добавить '+(next.length-items.length)+' новых шаблонов? Старые останутся.'))return;
   localStorage.setItem(KEY,JSON.stringify(next));items=next;choose(items[0].id);
   status.textContent='Импорт выполнен. Существующие макеты сохранены.';
  }catch(err){status.textContent='Импорт: '+err.message}
 };
 choose(items[0]?.id);
}