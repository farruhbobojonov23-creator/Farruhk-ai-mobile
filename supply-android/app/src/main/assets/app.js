'use strict';
const $=id=>document.getElementById(id),norm=s=>String(s||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' '),rub=n=>Number(n).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽',sections=['home','entry','invoices','products','suppliers','compare'];
let scanPass=0,scanCandidates=[],photoSupplier='',partialPage=null;let db,docs=[],editing=null,ocrId=null,scanBusy=false,previewUrl='',dirty=false;
function node(tag,txt,cls){const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n}
function status(s,ok=false){$('status').textContent=s;$('status').classList.toggle('ok',ok)}
function button(txt,fn){const n=node('button',txt);n.type='button';n.onclick=()=>Promise.resolve().then(fn).catch(e=>status(e.message));return n}
function row(parent,title,subtitle,right){const r=node('div',null,'row'),l=node('div');l.append(node('strong',title),node('br'),node('small',subtitle));r.append(l,right);parent.append(r);return r}
function empty(parent,txt){parent.append(node('p',txt,'empty'))}
function go(id){if(!$('entry').classList.contains('hide')&&id!=='entry'&&dirty&&!confirm('Выйти без сохранения?'))return;for(const v of sections)$(v).classList.toggle('hide',v!==id);document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===(id==='entry'?'invoices':id)));if(id!=='entry'){dirty=false;ocrId=null;scanBusy=false;render()}window.scrollTo(0,0)}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='entry'){reset();go('entry')}else go(b.dataset.go)});
function tx(mode,fn){return new Promise((resolve,reject)=>{if(!db){reject(Error('База ещё не открыта'));return}const t=db.transaction('invoices',mode),r=fn(t.objectStore('invoices'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error||r.error);t.onabort=()=>reject(t.error||Error('Сохранение отменено'))})}
async function refresh(){docs=await tx('readonly',s=>s.getAll());render()}
// Only reuse a unique, previously confirmed weight for the same supplier and product.
const packUnits=['шт','уп','кор'];
const productIdentity=s=>norm(s).replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim();
function knownPack(data,supplier,history=docs,field='packKg'){
 if(!packUnits.includes(data.unit)||!norm(supplier)||!data.name)return null;
 const matches=history.filter(d=>d.simpleVersion===1&&norm(d.supplierId)===norm(supplier)).flatMap(d=>d.lines||[]).filter(l=>{
  if(l.unit!==data.unit)return false;
  if(data.article&&l.article)return String(data.article)===String(l.article);
  return productIdentity(l.name)===productIdentity(data.name);
 });
 const weights=[...new Set(matches.map(l=>numeric(l[field])).filter(Boolean))];
 return weights.length===1?weights[0]:null;
}
function lineData(f){
 const value=k=>f.querySelector('[data-field='+k+']').value;
 return {name:value('name').trim(),price:numeric(value('price')),quantity:numeric(value('quantity')),unit:value('unit'),packKg:value('packMeasure')==='кг'?numeric(value('packKg')):null,packL:value('packMeasure')==='л'?numeric(value('packKg')):null,article:f.dataset.article||undefined,invoiceTotal:numeric(f.dataset.invoiceTotal)};
}
const fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:6});
function lineSummary(l){
 const m=window.supplyInvoiceParser.lineMetrics(l),parts=[];
 if(l.packKg&&packUnits.includes(l.unit))parts.push('Фасовка '+fmt(l.packKg)+' кг');
 if(l.packL&&packUnits.includes(l.unit))parts.push('Фасовка '+fmt(l.packL)+' л');
 if(l.quantity)parts.push(fmt(l.quantity)+' '+(l.unit||'ед.'));
 if(m.totalKg!==null&&l.unit!=='кг')parts.push('Всего '+fmt(m.totalKg)+' кг');
 if(m.pricePerKg!==null&&l.unit!=='кг')parts.push(rub(m.pricePerKg)+'/кг');
 if(m.totalL!=null&&l.unit!=='л')parts.push('Всего '+fmt(m.totalL)+' л');
 if(m.pricePerL!=null&&l.unit!=='л')parts.push(rub(m.pricePerL)+'/л');
 if(m.totalPrice!==null)parts.push('Сумма '+rub(m.totalPrice));
 return parts.join(' · ');
}
function addLine(data={}){
 const f=node('div',null,'line');if(data.uncertain)f.classList.add('uncertain');if(data.article)f.dataset.article=String(data.article);if(numeric(data.invoiceTotal))f.dataset.invoiceTotal=String(numeric(data.invoiceTotal));
 function field(key,title,value,placeholder){const wrap=node('label',title),i=node('input');i.dataset.field=key;i.placeholder=placeholder||'';i.value=value==null?'':String(value);if(key!=='name')i.inputMode='decimal';i.setAttribute('aria-label',title);wrap.append(i);return {wrap,i}}
 const a=field('name','Название товара',data.name,'Название товара'),p=field('price','Цена за уп., ₽',data.price,'0,00'),q=field('quantity','Количество',data.quantity,'—'),w=field('packKg','Фасовка, кг',data.packKg??data.packL,'—');
 a.i.value=data.name||'';a.i.required=p.i.required=true;
 const measure=node('select');measure.dataset.field='packMeasure';measure.setAttribute('aria-label','Единица фасовки');for(const k of ['кг','л']){const o=node('option',k);o.value=k;measure.append(o)}measure.value=data.packL&&!data.packKg?'л':'кг';const packControls=node('div',null,'qty-controls');packControls.append(w.i,measure);w.wrap.append(packControls);w.wrap.firstChild.nodeValue='Фасовка';
 const u=node('select');u.dataset.field='unit';u.setAttribute('aria-label','Единица накладной');
 for(const k of ['','шт','уп','кор','кг','г','л','мл']){const o=node('option',k||'Не указана');o.value=k;u.append(o)}u.value=data.unit||((data.name||'').match(/\s*\/\s*(кг|г|л|мл|шт|уп|кор)(?:\s+\(без НДС\))?$/i)?.[1]||'');
 q.wrap.classList.add('quantity-cell');const qtyControls=node('div',null,'qty-controls');qtyControls.append(q.i,u);q.wrap.append(qtyControls);
 const del=button('×',()=>{f.remove();dirty=true});del.setAttribute('aria-label','Удалить товар');del.classList.add('line-delete');
 function computed(title,cls){const box=node('div',null,'computed-cell '+cls),out=node('output','—');box.append(node('span',title,'cell-caption'),out);return {box,out}}
 const weight=computed('Общий вес','line-summary'),kgPrice=computed('Цена за кг','kg-price'),total=computed('Общая стоимость','line-total');
 function recalc(){const l=lineData(f),m=window.supplyInvoiceParser.lineMetrics(l),pack=packUnits.includes(l.unit),volume=['л','мл'].includes(l.unit)||(pack&&measure.value==='л');w.i.disabled=measure.disabled=!pack;w.wrap.style.background=pack&&!l.packKg&&!l.packL?'#fff1b8':'';const basis=/\(без НДС\)/i.test(l.name)?' без НДС':/\(с НДС\)/i.test(l.name)?' с НДС':'';p.wrap.firstChild.nodeValue=(pack?'Цена за уп.':l.unit==='кг'?'Цена за кг':l.unit==='л'?'Цена за л':'Цена за ед.')+basis+', ₽';p.i.setAttribute('aria-label',p.wrap.firstChild.nodeValue);weight.box.firstChild.textContent=volume?'Общий объём':'Общий вес';kgPrice.box.firstChild.textContent=(volume?'Цена за л':'Цена за кг')+basis;weight.out.textContent=volume?(m.totalL==null?'—':fmt(m.totalL)+' л'):(m.totalKg==null?'—':fmt(m.totalKg)+' кг');kgPrice.out.textContent=(volume?m.pricePerL:m.pricePerKg)==null?'—':rub(volume?m.pricePerL:m.pricePerKg);total.out.textContent=m.totalPrice==null?'—':rub(m.totalPrice);total.out.title=l.invoiceTotal?'Сумма из накладной, не пересчитывается':'Расчёт по количеству и цене';}
 function fillMissingPack(){if(!packUnits.includes(u.value)||numeric(w.i.value))return;const parser=window.supplyInvoiceParser,mass=parser.packWeight(a.i.value),volume=parser.packVolume(a.i.value),savedMass=knownPack(lineData(f),$('supplier').value),savedVolume=knownPack(lineData(f),$('supplier').value,docs,'packL');if(mass||volume||savedMass&&!savedVolume||savedVolume&&!savedMass){measure.value=mass||!volume&&savedMass?'кг':'л';w.i.value=mass||volume||savedMass||savedVolume;w.i.title=mass||volume?'Из названия товара':'Из ранее подтверждённой накладной';}}
 measure.addEventListener('change',()=>{w.i.value='';w.i.title='';recalc()});
 a.i.addEventListener('change',()=>{delete f.dataset.article;fillMissingPack();recalc()});
 u.addEventListener('change',()=>{fillMissingPack();recalc()});
 w.i.addEventListener('input',()=>{w.i.title='';});
 f.addEventListener('input',recalc);u.addEventListener('change',recalc);
 if(data.source)f.title=data.source;
 f.append(a.wrap,del,w.wrap,q.wrap,weight.box,p.wrap,kgPrice.box,total.box);$('lines').append(f);fillMissingPack();recalc();
}
function showPreview(file){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';$('preview').classList.add('hide');if(file&&file.type?.startsWith('image/')){previewUrl=URL.createObjectURL(file);$('preview').src=previewUrl;$('preview').classList.remove('hide')}}
function reset(){partialPage=null;scanPass=0;scanCandidates=[];photoSupplier='';document.getElementById('ocrDiagnostic')?.remove();ocrId=null;scanBusy=false;editing=null;$('form').reset();$('lines').replaceChildren();addLine();showPreview(null);$('ocrState').textContent='';$('retry').classList.add('hide');$('save').disabled=false;$('file').disabled=false;dirty=false;status('')}
$('addLine').onclick=()=>{addLine();dirty=true};$('form').addEventListener('input',()=>dirty=true);$('file').addEventListener('change',()=>{partialPage=null;scanPass=0;scanCandidates=[];photoSupplier='';document.getElementById('ocrDiagnostic')?.remove();showPreview($('file').files[0]);dirty=true});
function numeric(s){const n=Number(String(s).replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>0?n:null}
function dateLabel(d){const v=new Date(d);return Number.isFinite(v.getTime())?v.toLocaleDateString('ru-RU'):''}
function linesOf(d){if(d.simpleVersion===1)return Array.isArray(d.lines)?d.lines:[];if(d.status!=='confirmed')return [];return (d.lines||[]).flatMap(l=>{try{const p=window.supplyAnalytics.linePrice(l);return [{name:l.productId+' / '+p.unit+' (с НДС)',price:p.price}]}catch{return []}})}
function observations(){return docs.flatMap(d=>linesOf(d).filter(l=>l.name&&numeric(l.price)).map(l=>({name:l.name,price:Number(l.price),unit:l.unit||'',packKg:l.packKg||null,packL:l.packL||null,supplier:d.supplierId,date:d.savedAt||d.date||'',docId:d.id}))).sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function productKey(r){return JSON.stringify([norm(r.name),r.unit||'',r.packKg||null,r.packL||null]);}
function grouped(obs,key){const m=new Map();for(const r of obs){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return m}
function latest(obs){return [...grouped(obs,r=>JSON.stringify([productKey(r),norm(r.supplier)])).values()].map(s=>s[s.length-1])}
function offerDetail(r){const m=window.supplyInvoiceParser.lineMetrics(r);return [dateLabel(r.date),r.packKg?'Фасовка '+fmt(r.packKg)+' кг':r.packL?'Фасовка '+fmt(r.packL)+' л':'',m.pricePerKg!==null&&r.unit!=='кг'?rub(m.pricePerKg)+'/кг':'',m.pricePerL!=null&&r.unit!=='л'?rub(m.pricePerL)+'/л':''].filter(Boolean).join(' · ')}
function render(){const obs=observations(),last=latest(obs),products=grouped(last,productKey),suppliers=grouped(last,r=>norm(r.supplier));$('productCount').textContent=products.size;$('supplierCount').textContent=suppliers.size;
$('changes').replaceChildren();const trends=[...grouped(obs,r=>JSON.stringify([productKey(r),norm(r.supplier)])).values()].filter(s=>s.length>1).map(s=>[s[s.length-2],s[s.length-1]]).filter(([a,b])=>a.price!==b.price).slice(-6).reverse();for(const [a,b] of trends){const delta=b.price-a.price;row($('changes'),b.name,b.supplier+' · '+rub(a.price)+' → '+rub(b.price),node('strong',(delta>0?'+':'−')+rub(Math.abs(delta)),'price '+(delta>0?'up':'down')))}if(!trends.length)empty($('changes'),'Изменения появятся после повторной закупки.');
const ordered=[...docs].sort((a,b)=>String(b.savedAt||b.date||'').localeCompare(String(a.savedAt||a.date||'')));$('recent').replaceChildren();for(const d of ordered.slice(0,3))row($('recent'),d.supplierId||'Без поставщика',dateLabel(d.savedAt||d.date),button('Открыть',()=>{go('invoices')}));if(!ordered.length)empty($('recent'),'Нет накладных');
$('archive').replaceChildren();for(const d of ordered){const c=node('div',null,'card');c.append(node('h2',d.supplierId||'Без поставщика'),node('small',dateLabel(d.savedAt||d.date)));const ls=linesOf(d);if(d.simpleVersion!==1)c.append(node('p','Архив старой версии. Оригинальные данные сохранены.','muted'));for(const l of ls)row(c,l.name,lineSummary(l),node('strong',rub(l.price),'price'));const ctl=node('div',null,'controls');if(d.original?.type?.startsWith('image/'))ctl.append(button('Фото',()=>{const dlg=node('dialog');const url=URL.createObjectURL(d.original),img=node('img');img.src=url;img.style.cssText='max-width:85vw;max-height:70vh;object-fit:contain;display:block';dlg.append(img,button('Закрыть',()=>dlg.close()));dlg.addEventListener('close',()=>{URL.revokeObjectURL(url);dlg.remove()},{once:true});document.body.append(dlg);dlg.showModal()}));if(d.simpleVersion===1){ctl.append(button('Редактировать',()=>edit(d)),button('Удалить',async()=>{if(confirm('Удалить накладную?')){await tx('readwrite',s=>s.delete(d.id));await refresh();status('Удалено',true)}}))}c.append(ctl);$('archive').append(c)}if(!ordered.length)empty($('archive'),'Нет накладных');
$('productList').replaceChildren();for(const offers of [...products.values()].sort((a,b)=>a[0].name.localeCompare(b[0].name,'ru'))){if(!norm(offers[0].name).includes(norm($('search').value)))continue;const c=node('div',null,'card');c.append(node('h2',offers[0].name));for(const r of offers.sort((a,b)=>a.price-b.price))row(c,r.supplier,offerDetail(r),node('strong',rub(r.price),'price'));$('productList').append(c)}if(!$('productList').children.length)empty($('productList'),'Товары не найдены');
$('supplierList').replaceChildren();for(const list of suppliers.values()){const c=node('div',null,'card');c.append(node('h2',list[0].supplier));for(const r of list.sort((a,b)=>a.name.localeCompare(b.name,'ru')))row(c,r.name,offerDetail(r),node('strong',rub(r.price),'price'));$('supplierList').append(c)}if(!suppliers.size)empty($('supplierList'),'Нет поставщиков');
$('offers').replaceChildren();for(const list of products.values()){const c=node('div',null,'card');c.append(node('h2',list[0].name));const sorted=list.slice().sort((a,b)=>a.price-b.price);for(const r of sorted)row(c,r.supplier,offerDetail(r)+(sorted.length>1&&r.price===sorted[0].price?' · Лучшая цена':''),node('strong',rub(r.price),'price '+(sorted.length>1&&r.price===sorted[0].price?'down':'')));$('offers').append(c)}if(!products.size)empty($('offers'),'Загрузите накладные для сравнения.');
}
$('search').oninput=render;
function edit(d){reset();editing=d.id;$('supplier').value=d.supplierId;$('lines').replaceChildren();for(const l of d.lines)addLine(l);showPreview(d.original);go('entry')}
$('form').onsubmit=async e=>{e.preventDefault();if(scanBusy)return;try{const supplier=$('supplier').value.trim(),lines=[...$('lines').children].map(f=>{const l=lineData(f);if(!packUnits.includes(l.unit)){l.packKg=null;l.packL=null;}return l});if(!supplier||!lines.length||lines.some(l=>!l.name||l.price===null))throw Error('Проверьте поставщика, названия и цены');if(new Set(lines.map(l=>norm(l.name))).size!==lines.length)throw Error('Есть одинаковые названия. Уточните фасовку или удалите дубль.');if(partialPage&&!confirm('Документ содержит '+partialPage.pages+' страниц. Сейчас обработана страница '+partialPage.page+'. Сохранить только эту часть?'))return;if(!confirm('Названия, фасовки и цены сверены с оригиналом?'))return;const prior=docs.find(d=>d.id===editing);const doc={id:editing||crypto.randomUUID(),simpleVersion:1,supplierId:supplier,savedAt:prior?.savedAt||new Date().toISOString(),lines,original:$('file').files[0]||prior?.original||null};if(!editing&&docs.some(d=>d.simpleVersion===1&&norm(d.supplierId)===norm(supplier)&&JSON.stringify(d.lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())===JSON.stringify(lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())&&String(d.savedAt).slice(0,10)===doc.savedAt.slice(0,10))&&!confirm('Такие товары и цены уже сохранены сегодня. Добавить ещё раз?'))return;await tx('readwrite',s=>s.put(doc));dirty=false;await refresh();go('invoices');status('✓ Накладная сохранена',true)}catch(err){status(err.message)}};
window.supplyOcrStart=id=>{if($('entry').classList.contains('hide'))return;ocrId=id;scanBusy=true;$('save').disabled=true;$('file').disabled=true;$('retry').classList.add('hide');$('ocrState').textContent='Распознаём фото…'};
function scanDiagnostic(text){document.getElementById('ocrDiagnostic')?.remove();if(!text)return;const d=node('details');d.id='ocrDiagnostic';d.append(node('summary','Распознанный текст'));const p=node('textarea');p.readOnly=true;p.value=text;p.style.cssText='width:100%;height:150px;font:12px monospace';const copy=button('Копировать весь текст',async()=>{try{await navigator.clipboard.writeText(p.value);status('Текст скопирован',true)}catch{p.focus();p.select();if(document.execCommand('copy'))status('Текст скопирован',true);else status('Текст выделен — скопируйте его через меню телефона')}});d.append(p,copy);$('retry').after(d);p.scrollTop=0}
function scanScore(r){
 const priced=r.items.filter(x=>x.price!=null),complete=priced.filter(x=>x.quantity!=null&&x.unit);
 return (r.documentVerified?1000000:r.pageVerified?500000:0)+priced.length*1000+complete.length*100+priced.filter(x=>x.packKg!=null).length*20+r.items.length*10+(r.supplier?1:0);
}
function nextScan(path,message){
 scanBusy=true;$('save').disabled=true;$('file').disabled=true;$('retry').classList.add('hide');$('ocrState').textContent=message;
 location.href='https://appassets.androidplatform.net/'+path;
}
window.supplyOcrFinish=(id,text,error)=>{
 if(id!==ocrId||$('entry').classList.contains('hide'))return;
 scanBusy=false;$('save').disabled=false;$('file').disabled=false;$('retry').classList.remove('hide');
 try{
  let current=window.supplyInvoiceParser.parseSimple(text||'');
  // A focused table crop can omit the header. Carry forward a unique supplier
  // already read from the same photo; never fill one from a preset or a previous invoice.
  const earlierSuppliers=[...new Set([photoSupplier,...scanCandidates.map(x=>x.r.supplier)].filter(Boolean))];
  if(!current.supplier&&earlierSuppliers.length===1&&text){
   const contextual=window.supplyInvoiceParser.parseSimple('Поставщик: '+earlierSuppliers[0]+'\n'+text);
   if(scanScore(contextual)>scanScore(current))current=contextual;
  }
  if(current.supplier&&!photoSupplier)photoSupplier=current.supplier;
  scanCandidates.push({r:current,text,error});
  const native=location.origin==='https://appassets.androidplatform.net'&&$('file').files.length>0;
  const complete=current.items.length>0&&current.items.every(x=>x.price!=null&&x.quantity!=null&&x.unit)&&!current.items.some(x=>packUnits.includes(x.unit)&&!x.packKg&&!x.packL&&!window.supplyInvoiceParser.packWeight(x.name)&&!window.supplyInvoiceParser.packVolume(x.name)&&!knownPack(x,current.supplier||photoSupplier)&&!knownPack(x,current.supplier||photoSupplier,docs,'packL'));
  if(native&&scanPass<2&&!complete){
   scanPass++;nextScan(scanPass===1?'rescan':'paddle-scan',scanPass===1?'Повторная проверка товарной таблицы…':'Проверка другим OCR-модулем…');return;
  }
  const rescored=window.supplyInvoiceParser.parseSamePhotoPasses(scanCandidates.map(x=>x.text||''));
  for(const parsed of rescored)if(parsed.items.some(x=>x.price!=null))scanCandidates.push({r:parsed,text:'',error:''});
  const ranked=scanCandidates.slice().sort((a,b)=>scanScore(b.r)-scanScore(a.r)),best=ranked[0];
  let r=best.r;partialPage=r.pageInfo&&r.pageInfo.pages>1?r.pageInfo:null;const suppliers=[...new Set(ranked.map(x=>x.r.supplier).filter(Boolean))];
  if(!r.supplier&&suppliers.length===1)r={...r,supplier:suppliers[0]};
  const comparable=r.documentVerified?ranked.filter(x=>x.r.documentVerified):ranked;
  const ambiguous=new Set(comparable.map(x=>x.r.supplier).filter(Boolean)).size>1||comparable.some(other=>other!==best&&other.r.items.some(x=>x.price!=null&&r.items.some(y=>norm(y.name)===norm(x.name)&&y.price!=null&&(Math.abs(y.price-x.price)>.01||(x.quantity!=null&&y.quantity!=null&&Math.abs(x.quantity-y.quantity)>.00001)))));
  const diagnostic=ranked.map(x=>x.text).filter(Boolean).join('\n---\n');scanCandidates=[];scanPass=0;
  if(r.supplier)$('supplier').value=r.supplier;
  if(r.items.length){
   const existing=[...$('lines').children].map(lineData).filter(x=>x.name);
   const safeUpgrade=existing.length>0&&existing.every(x=>x.price==null&&x.quantity==null&&r.items.some(y=>y.price!=null&&norm(y.name).startsWith(norm(x.name))));
   if(existing.length&&!safeUpgrade&&!confirm('Заменить текущие строки распознанными?'))return;
   $('lines').replaceChildren();for(const l of r.items)addLine(l)
  }
  dirty=true;const priced=r.items.filter(x=>x.price!=null).length;
  $('ocrState').textContent=ambiguous?'Разные результаты OCR. Сверьте цены и количество с фото.':priced?'Найдено цен: '+priced+' из '+r.items.length+'. Сверьте строки с фото.':(best.error||'Товарная таблица не прочитана. Выберите более чёткое фото или крупный снимок таблицы.');
  const missingPack=[...$('lines').children].map(lineData).some(x=>packUnits.includes(x.unit)&&!x.packKg&&!x.packL);
  if(missingPack&&priced&&!ambiguous)$('ocrState').textContent+=' Фасовка не прочитана. Укажите вес нетто или объём одной упаковки — он сохранится для следующих накладных.';
  if(partialPage)$('ocrState').textContent+=' Страница '+partialPage.page+' из '+partialPage.pages+'. Остальные страницы ещё не обработаны.';
  if(!priced||ambiguous||priced<r.items.length||missingPack)scanDiagnostic(diagnostic);else document.getElementById('ocrDiagnostic')?.remove();
 }catch(e){scanCandidates=[];scanPass=0;$('ocrState').textContent='Не удалось обработать текст. Проверьте фото.';scanDiagnostic(text);}
};
$('rescan').onclick=()=>{if(!$('file').files.length){status('Выберите фото');return}scanCandidates=[];scanPass=1;nextScan('rescan','Повторная проверка товарной таблицы…')};
document.querySelector('a.update').addEventListener('click',e=>{if(dirty&&!confirm('Обновление закроет несохранённую форму. Продолжить?'))e.preventDefault()});
reset();const req=indexedDB.open('farukh-supply-preview',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('invoices'))req.result.createObjectStore('invoices',{keyPath:'id'})};req.onsuccess=()=>{db=req.result;refresh().catch(e=>status(e.message))};req.onerror=()=>status('Не удалось открыть локальную базу');
