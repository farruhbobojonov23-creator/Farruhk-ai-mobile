// FARUKH AI owner-only draft label design studio.
// Intentionally does not modify FARUKH PRINT printer templates or the approved product catalog.
const KEY='farukh-print:my-designs:v1';
const CAP=100;
const rand=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const e=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const defaults=[
{id:'builtin-editorial-58x40',name:'Редакционный · рамка и линии',style:'editorial',frame:'double',rule:'double',stroke:2,font:'serif',sample:'currant',size:'58x40'},
{id:'builtin-modern-58x40',name:'Современный · строгая геометрия',style:'modern',frame:'single',rule:'solid',stroke:2,font:'sans',sample:'cranberry',size:'58x40'}
];
function validate(p){
 if(!p||typeof p!=='object')throw Error('Неверный формат шаблона.');
 const x={
  id:typeof p.id==='string'&&p.id.length<120?p.id:rand(),
  name:String(p.name||'').trim().slice(0,70),
  size:'58x40',
  style:['editorial','modern'].includes(p.style)?p.style:'editorial',
  frame:['single','double','corners'].includes(p.frame)?p.frame:'double',
  rule:['solid','double','dashed'].includes(p.rule)?p.rule:'solid',
  stroke:Math.min(4,Math.max(1,Number(p.stroke)||2)),
  font:p.font==='sans'?'sans':'serif',
  sample:['currant','cranberry'].includes(p.sample)?p.sample:'currant'
 };
 if(!x.name)throw Error('Укажи название шаблона.');
 return x;
}
function safeLoad(){
 const raw=localStorage.getItem(KEY);
 if(raw===null)return {list:defaults.map(x=>({...x})),fresh:true};
 let parsed;
 try{parsed=JSON.parse(raw)}catch{throw Error('Сохранённые шаблоны повреждены. Экспортируй данные устройства перед изменениями.')}
 if(!Array.isArray(parsed)||parsed.length>CAP)throw Error('Неверная база шаблонов.');
 const list=parsed.map(validate);
 if(new Set(list.map(x=>x.id)).size!==list.length)throw Error('В базе повторяются идентификаторы.');
 return {list,fresh:false};
}
const svgLine=(x1,y1,x2,y2,stroke=1,dash='')=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#111" stroke-width="'+stroke+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
function draw(p){
 const sample=p.sample==='cranberry'?{title:'КЛЮКВЕННЫЙ',ingredients:'вода, концентрированный сок клюквы, сахар'}:{title:'ЧЁРНОЙ СМОРОДИНЫ',ingredients:'вода, концентрированный сок чёрной смородины, сахар'};
 const serif=p.font==='serif'?'Georgia, Times New Roman, serif':'Arial, sans-serif';
 const sans='Arial, sans-serif';
 const line=(y,start=20,end=444)=>{
  const dash=p.rule==='dashed'?'8 5':'';
  return svgLine(start,y,end,y,p.stroke,dash)+(p.rule==='double'?svgLine(start,y+5,end,y+5,1):'');
 };
 const txt=(x,y,t,size=14,weight=500,family=sans,extra='')=>'<text x="'+x+'" y="'+y+'" fill="#111" font-family="'+family+'" font-size="'+size+'" font-weight="'+weight+'" '+extra+'>'+esc(t)+'</text>';
 let s='<svg xmlns="http://www.w3.org/2000/svg" width="464" height="320" viewBox="0 0 464 320" role="img" aria-label="Предпросмотр этикетки 58 на 40 миллиметров"><rect width="464" height="320" fill="#fff"/>';
 if(p.frame==='single'||p.frame==='double'){
  s+='<rect x="6" y="6" width="452" height="308" rx="3" fill="none" stroke="#111" stroke-width="'+p.stroke+'"/>';
  if(p.frame==='double')s+='<rect x="12" y="12" width="440" height="296" rx="2" fill="none" stroke="#111" stroke-width="1"/>';
 }else{
  const k=16;for(const x of [7,457])for(const y of [7,313]){const sx=x===7?1:-1,sy=y===7?1:-1;s+=svgLine(x,y,x+sx*k,y,p.stroke)+svgLine(x,y,x,y+sy*k,p.stroke)}
 }
 if(p.style==='editorial'){
  s+=txt(24,36,'ГОТОВАЯ ПРОДУКЦИЯ',13,800,sans,'letter-spacing="1.5"');
  s+=txt(440,36,'58 × 40',11,650,sans,'text-anchor="end"');
  s+=line(48);
  s+=txt(23,115,'МОРС',68,900,serif);
  s+=svgLine(229,59,229,132,1.5);
  const titleSize=sample.title==='ЧЁРНОЙ СМОРОДИНЫ'?19:25;
  const nameParts=sample.title==='ЧЁРНОЙ СМОРОДИНЫ'?['ЧЁРНОЙ','СМОРОДИНЫ']:[sample.title];
  nameParts.forEach((v,i)=>s+=txt(242,92+i*26,v,titleSize,900,serif));
  s+=line(143);
  s+=txt(24,166,'СОСТАВ',13,850,sans,'letter-spacing="1.2"');
  s+=txt(24,186,sample.ingredients.slice(0,44),15,500,sans);
  if(sample.ingredients.length>44)s+=txt(24,205,sample.ingredients.slice(44),15,500,sans);
  s+=line(219);
  s+='<rect x="21" y="229" width="201" height="52" fill="none" stroke="#111" stroke-width="1"/><rect x="242" y="229" width="201" height="52" fill="none" stroke="#111" stroke-width="1"/>';
  s+=txt(32,246,'ДАТА РАЗЛИВА',12,800,sans);
  s+=txt(32,269,'__.__.____   __:__',16,700,sans);
  s+=txt(253,246,'ГОДЕН ДО',12,800,sans);
  s+=txt(253,269,'__.__.____   __:__',16,700,sans);
  s+=txt(231,301,'ХРАНИТЬ ПРИ +2…+6 °C',13,800,sans,'text-anchor="middle"');
 }else{
  s+='<rect x="14" y="14" width="436" height="34" fill="#111"/>';
  s+='<text x="26" y="37" fill="#fff" font-family="'+sans+'" font-size="16" font-weight="800" letter-spacing="1">МОРС • ГОТОВАЯ ПРОДУКЦИЯ</text>';
  s+=txt(24,90,sample.title==='ЧЁРНОЙ СМОРОДИНЫ'?'ЧЁРНОЙ СМОРОДИНЫ':'КЛЮКВЕННЫЙ',sample.title==='ЧЁРНОЙ СМОРОДИНЫ'?27:34,900,serif);
  s+=line(108);
  s+=txt(24,134,'СОСТАВ:',13,850,sans);
  s+=txt(99,134,sample.ingredients.slice(0,42),14,500,sans);
  if(sample.ingredients.length>42)s+=txt(24,153,sample.ingredients.slice(42),14,500,sans);
  s+=line(169);
  s+=txt(24,196,'ДАТА РАЗЛИВА',13,850,sans);
  s+=txt(244,196,'ГОДЕН ДО',13,850,sans);
  s+=svgLine(232,180,232,262,1.5);
  s+=txt(24,228,'__.__.____  __:__',18,700,sans);
  s+=txt(244,228,'__.__.____  __:__',18,700,sans);
  s+=line(263);
  s+=txt(24,290,'УСЛОВИЯ ХРАНЕНИЯ',12,700,sans);
  s+=txt(440,291,'+2…+6 °C',18,900,serif,'text-anchor="end"');
 }
 return s+'</svg>';
}
function download(name,content,mime){
 const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function mountPrintDesignStudio({root}){
 if(!root)return;
 if(!document.getElementById('farukh-print-design-studio-style')){
 const st=e('style');st.id='farukh-print-design-studio-style';st.textContent=
 '#print-control-root:not([data-pc-workspace="templates"]) .pds{display:none!important}'+
 '#print-control-root[data-pc-workspace="templates"] :is(.pc-stats,.pc-readiness,.pc-toolbar,.pc-premium-template,.pc-filters,.pc-normative-notice,.pc-list,.pc-pagination,.pc-transfer,.pc-integration,.pc-log,.pcloud,.pstaff){display:none!important}'+
 '#print-control-root .pc-workspace-tabs{grid-template-columns:repeat(5,minmax(0,1fr))}'+
 '#print-control-root .pds{padding:20px 0 30px;color:#243240}'+
 '#print-control-root .pds h2{margin:0 0 7px;font-size:25px;letter-spacing:-.6px}'+
 '#print-control-root .pds p{color:#6d7b87;line-height:1.5;font-size:13px;margin:7px 0 18px}'+
 '#print-control-root .pds-grid{display:grid;grid-template-columns:minmax(225px,300px) minmax(0,1fr);gap:17px}'+
 '#print-control-root .pds-panel{background:#fff;border:1px solid #dce5ed;border-radius:17px;padding:17px;box-shadow:0 5px 18px #162e4210}'+
 '#print-control-root .pds-bar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:12px 0}'+
 '#print-control-root .pds button{border-radius:10px;border:1px solid #cbd8e3;background:#fff;padding:10px 12px;color:#243240;font-size:12px;font-weight:750;cursor:pointer}'+
 '#print-control-root .pds button.primary{background:#254b60;color:#fff;border-color:#254b60}'+
 '#print-control-root .pds button.danger{color:#a42f49}'+
 '#print-control-root .pds button:disabled{opacity:.45;cursor:default}'+
 '#print-control-root .pds-list{display:grid;gap:8px;max-height:370px;overflow:auto}'+
 '#print-control-root .pds-list button{text-align:left;padding:12px;min-height:62px}'+
 '#print-control-root .pds-list button.selected{border-color:#3a718c;background:#f0f7fb}'+
 '#print-control-root .pds-list button small{display:block;color:#748695;margin-top:4px}'+
 '#print-control-root .pds-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:15px}'+
 '#print-control-root .pds-fields label{display:grid;gap:5px;font-size:12px;font-weight:750;color:#445767}'+
 '#print-control-root .pds-fields input,#print-control-root .pds-fields select{min-width:0;width:100%;padding:11px;border-radius:10px;border:1px solid #cad7e1;background:#fff;color:#202a32;font-size:14px}'+
 '#print-control-root .pds-fields .wide{grid-column:1/-1}'+
 '#print-control-root .pds-preview{margin:15px 0 8px;background:#edf2f6;padding:20px 10px;border-radius:12px;display:flex;justify-content:center;overflow:auto}'+
 '#print-control-root .pds-preview svg{background:#fff;width:min(100%,464px);height:auto;box-shadow:0 7px 24px #131c2730}'+
 '#print-control-root .pds-note{border:1px solid #e6d7bb;background:#fff9ed;border-radius:12px;padding:11px 14px;color:#835f25;font-size:12px;line-height:1.45}'+
 '#print-control-root .pds-message{min-height:20px;color:#226c58;font-size:12px;font-weight:700}'+
 '@media(max-width:750px){#print-control-root .pds-grid{grid-template-columns:1fr}#print-control-root .pc-workspace-tabs{display:flex!important;overflow-x:auto}#print-control-root .pc-workspace-tab{flex:0 0 auto;min-width:95px}}'+
 '@media(max-width:420px){#print-control-root .pds-fields{grid-template-columns:1fr}#print-control-root .pds-panel{padding:13px}}';
 document.head.append(st);
 }
 const box=e('section','pds');box.setAttribute('aria-label','Редактор моих шаблонов');root.append(box);
 const title=e('h2','','Мои шаблоны · 58 × 40 мм');
 const desc=e('p','','Чёрно-белые дизайны для V3 BT. Рамки, линии, крупные названия. До 100 сохранённых макетов; рабочие этикетки и каталог не изменяются.');
 const note=e('div','pds-note','Режим дизайна: сохраняется только в этом браузере FARUKH AI. Назначение товару и печать нового шаблона пока не подключены. Даты и состав в предпросмотре — образец, не готовая маркировка.');
 box.append(title,desc,note);
 const grid=e('div','pds-grid');grid.style.marginTop='16px';box.append(grid);
 const left=e('div','pds-panel'),right=e('div','pds-panel');grid.append(left,right);
 const meta=e('div','pds-bar');const count=e('strong','','');meta.append(count);left.append(meta);
 const listEl=e('div','pds-list');left.append(listEl);
 const bar=e('div','pds-bar');left.append(bar);
 const add=e('button','primary','＋ Новый'),copy=e('button','','Дублировать'),remove=e('button','danger','Удалить');
 bar.append(add,copy,remove);
 const jsonBar=e('div','pds-bar'),exportAll=e('button','','Резервная копия JSON'),importBtn=e('button','','Импорт JSON');
 jsonBar.append(exportAll,importBtn);left.append(jsonBar);
 const file=e('input');file.type='file';file.accept='application/json,.json';file.hidden=true;left.append(file);
 const fields=e('div','pds-fields');right.append(fields);
 const createField=(label,values,wide=false)=>{
  const wrap=e('label',wide?'wide':'');wrap.append(e('span','',label));
  let input;if(Array.isArray(values)){input=e('select');for(const [key,v] of values){const opt=e('option','',v);opt.value=key;input.append(opt)}}else{input=e('input');input.type=values||'text';}
  wrap.append(input);fields.append(wrap);return input;
 };
 const name=createField('Название дизайна','text',true);
 const style=createField('Композиция',[['editorial','Вариант 3 · редакционный'],['modern','Вариант 4 · геометрия']]);
 const frame=createField('Рамка',[['double','Двойная'],['single','Одинарная'],['corners','Только углы']]);
 const rule=createField('Разделительные линии',[['double','Двойные'],['solid','Сплошные'],['dashed','Пунктир']]);
 const font=createField('Шрифт названия',[['serif','Классический'],['sans','Современный']]);
 const stroke=createField('Толщина линий',[['1','Тонкие · 1'],['2','Средние · 2'],['3','Выразительные · 3'],['4','Плотные · 4']]);
 const sample=createField('Образец продукта',[['currant','Морс чёрной смородины'],['cranberry','Морс клюквенный']],true);
 const preview=e('div','pds-preview');right.append(preview);
 const status=e('div','pds-message');status.setAttribute('role','status');right.append(status);
 const controls=e('div','pds-bar');const save=e('button','primary','Сохранить изменения'),svg=e('button','','Скачать SVG');controls.append(save,svg);right.append(controls);
 let loaded,items=[],selectedId=null,dirty=false;
 try{loaded=safeLoad();items=loaded.list;if(loaded.fresh)localStorage.setItem(KEY,JSON.stringify(items))}
 catch(err){status.textContent=err.message;for(const b of [add,copy,remove,save,exportAll,importBtn])b.disabled=true;return}
 const selected=()=>items.find(x=>x.id===selectedId);
 const value=()=>validate({id:selectedId||rand(),name:name.value,style:style.value,frame:frame.value,rule:rule.value,stroke:stroke.value,font:font.value,sample:sample.value});
 const pick=id=>{selectedId=id;dirty=false;const p=selected();if(!p)return;for(const [k,el] of Object.entries({name,style,frame,rule,font,stroke,sample}))el.value=p[k];render()};
 const render=()=>{count.textContent=items.length+' / '+CAP+' шаблонов';listEl.replaceChildren();
  for(const t of items){const b=e('button',t.id===selectedId?'selected':'');b.append(e('strong','',t.name),e('small','',t.style==='modern'?'Вариант 4 · строгая геометрия':'Вариант 3 · рамки и линии'));b.onclick=()=>{if(dirty&&!confirm('Не сохранять изменения текущего дизайна?'))return;pick(t.id)};listEl.append(b)}
  try{preview.innerHTML=draw(value());status.textContent=dirty?'Есть несохранённые изменения':'Предпросмотр · макет 58 × 40 мм'}
  catch(err){preview.replaceChildren();status.textContent='Ошибка предпросмотра: '+err.message}
  remove.disabled=items.length<=1;copy.disabled=items.length>=CAP;add.disabled=items.length>=CAP;
 };
 const persist=()=>{localStorage.setItem(KEY,JSON.stringify(items));dirty=false;render()};
 for(const x of [name,style,frame,rule,font,stroke,sample]){x.addEventListener('input',()=>{dirty=true;render()})}
 add.onclick=()=>{if(items.length>=CAP)return;if(dirty&&!confirm('Отменить несохранённые изменения?'))return;
 const p=validate({...selected(),id:rand(),name:'Новый дизайн '+(items.length+1)});items.push(p);try{persist();pick(p.id)}catch(err){items.pop();status.textContent=err.message}};
 copy.onclick=()=>{if(items.length>=CAP)return;const p=selected();if(!p)return;
 const clone={...value(),id:rand(),name:(p.name+' · копия').slice(0,70)};items.push(clone);try{persist();pick(clone.id)}catch(err){items.pop();status.textContent=err.message}};
 remove.onclick=()=>{const p=selected();if(!p||items.length<=1)return;if(!confirm('Удалить шаблон «'+p.name+'»?'))return;
 const old=items;items=items.filter(x=>x.id!==p.id);try{persist();pick(items[0].id)}catch(err){items=old;status.textContent=err.message}};
 save.onclick=()=>{try{const p=value(),idx=items.findIndex(x=>x.id===selectedId);if(idx<0)throw Error('Выбери шаблон.');items[idx]=p;persist()}catch(err){status.textContent=err.message}};
 svg.onclick=()=>{try{download('etiketka-58x40-'+(selected()?.style||'design')+'.svg',draw(value()),'image/svg+xml;charset=utf-8');status.textContent='SVG скачан. Это макет для просмотра, не для производственной печати.'}catch(err){status.textContent=err.message}};
 exportAll.onclick=()=>download('farukh-print-designs-backup.json',JSON.stringify({format:'farukh-print-my-designs-v1',designs:items},null,2),'application/json;charset=utf-8');
 importBtn.onclick=()=>file.click();
 file.onchange=async()=>{const f=file.files?.[0];file.value='';if(!f)return;try{
 if(f.size>300000)throw Error('Файл слишком большой.');
 const data=JSON.parse(await f.text());if(data.format!=='farukh-print-my-designs-v1'||!Array.isArray(data.designs)||data.designs.length>CAP)throw Error('Это не резервная копия шаблонов.');
 const incoming=data.designs.map(validate);
 const merged=items.slice(),used=new Set(items.map(x=>x.id));
 for(const x of incoming){if(!used.has(x.id)){merged.push(x);used.add(x.id)}}
 if(merged.length>CAP)throw Error('Лимит 100 макетов. Удали ненужные перед импортом.');
 if(!confirm('Добавить '+(merged.length-items.length)+' шаблонов из файла? Существующие останутся.'))return;
 items=merged;persist();pick(items[0]?.id);status.textContent='Импорт завершён. Прежние шаблоны сохранены.';
 }catch(err){status.textContent='Импорт: '+err.message}};
 pick(items[0]?.id);
}