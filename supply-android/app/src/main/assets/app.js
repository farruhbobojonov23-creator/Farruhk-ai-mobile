'use strict';
(function(root){
'use strict';
// Separate product family, supplier-specific variant and alias. Never infer
// the brand, processing state, glaze or current price from a similar name.
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”]/g,'').replace(/\s+/g,' ').trim();
const supplierKey=s=>normalize(s).replace(/^общество с ограниченной ответственностью\s+/,'ооо ');
const nameKey=s=>normalize(s).replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim();
const tokens=s=>new Set(nameKey(s).match(/[а-яa-z0-9]+(?:[\/,.-][0-9]+)*/gi)||[]);
const aliasKey=(supplier,row)=>{
 const s=supplierKey(supplier),n=nameKey(row.name),article=normalize(row.article);
 return s&&n?JSON.stringify([s,article,n,row.unit||'',Number(row.packKg)||null,Number(row.packL)||null]):null;
};
function suggest(name,catalog){
 const query=tokens(name);if(!query.size)return [];
 return catalog.map(p=>{
  const target=tokens(p.name),shared=[...query].filter(x=>target.has(x)).length;
  return {productId:p.id,name:p.name,score:shared/Math.max(query.size,target.size,1)};
 }).filter(x=>x.score>=.35).sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name),'ru')).slice(0,5);
}
function resolve(row,supplier,catalog,aliases){
 const key=aliasKey(supplier,row);
 const exact=key&&Object.prototype.hasOwnProperty.call(aliases,key)?aliases[key]:null;
 if(exact&&catalog.some(p=>p.id===exact.productId))return {status:'known',productId:exact.productId,variantId:exact.variantId};
 const suggestions=suggest(row.name,catalog);
 return {status:suggestions.length?'review':'new',suggestions};
}
function confirm(row,supplier,productId,variantId,catalog,aliases){
 const key=aliasKey(supplier,row);
 if(!key||!variantId||!catalog.some(p=>p.id===productId))throw Error('Нужно подтвердить поставщика, товар и вариант');
 return {...aliases,[key]:{productId,variantId}};
}
function unlink(row,supplier,aliases){
 const next={...aliases},key=aliasKey(supplier,row);if(key)delete next[key];return next;
}
const api={normalize,aliasKey,resolve,confirm,unlink,suggest};
if(typeof module==='object'&&module.exports)module.exports=api;else root.supplyProductCatalog=api;
})(globalThis);

const $=id=>document.getElementById(id),norm=s=>String(s||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' '),rub=n=>Number(n).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽',sections=['home','entry','invoices','products','suppliers','compare'];
let scanStartedAt=0,stageStartedAt=0,scanTrace=[],scanPass=0,scanCandidates=[],photoPassTexts=[],photoSupplier='',partialPage=null,pages=[],activePage=null,pendingPhoto=null;let db,docs=[],editing=null,ocrId=null,scanBusy=false,previewUrl='',dirty=false,supplierFilter=null;

const catalogAPI=window.supplyProductCatalog;
const CATALOG_KEY='farukh-supply-catalog-v1';
let catalogState={products:[],aliases:{},quality:{}},catalogCache=null,catalogStorageError='';
try{const raw=localStorage.getItem(CATALOG_KEY);if(raw){const saved=JSON.parse(raw);if(!Array.isArray(saved.products)||!saved.aliases||!saved.quality)throw Error('Неверный формат справочника');catalogState=saved;}}catch(e){catalogStorageError='Справочник недоступен: '+e.message;}
function saveCatalog(next){if(catalogStorageError)throw Error(catalogStorageError);localStorage.setItem(CATALOG_KEY,JSON.stringify(next));catalogState=next;catalogCache=null;}
function originalProductKey(r){return JSON.stringify([productIdentity(r.name),r.unit||'',r.packKg||null,r.packL||null]);}
function catalogSnapshot(){
 if(catalogCache?.docs===docs&&catalogCache?.state===catalogState)return catalogCache.value;
 const products=new Map(catalogState.products.map(p=>[p.id,p])),aliases={...catalogState.aliases};
 for(const d of docs)for(const r of linesOf(d)){
  const key=catalogAPI.aliasKey(d.supplierId,r);if(!key)continue;
  if(aliases[key]&&products.has(aliases[key].productId))continue;
  const id='legacy:'+originalProductKey(r);
  if(!products.has(id))products.set(id,{id,name:productIdentity(r.name)?r.name.replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim():r.name});
  aliases[key]={productId:id,variantId:'variant:'+key};
 }
 const value={products:[...products.values()],aliases};
 catalogCache={docs,state:catalogState,value};return value;
}
function catalogMatch(r,supplier=r.supplier){
 const c=catalogSnapshot();return catalogAPI.resolve(r,supplier,c.products,c.aliases);
}
function catalogTitle(r){const c=catalogSnapshot(),m=catalogMatch(r);return c.products.find(p=>p.id===m.productId)?.name||r.name;}
function variantKey(r){const m=catalogMatch(r);return m.variantId||catalogAPI.aliasKey(r.supplier,r)||originalProductKey(r);}
function productLinkDialog(getRow,getSupplier,onSaved=()=>{}){
 if(catalogStorageError)throw Error(catalogStorageError);
 const r=getRow(),supplier=getSupplier();if(!r.name||!supplier)throw Error('Сначала укажите товар и поставщика');
 const c=catalogSnapshot(),m=catalogMatch(r,supplier),dlg=node('dialog',null,'catalog-dialog');
 dlg.append(node('h2','Связать с ингредиентом'),node('p',r.name,'muted'),node('small',supplier));
 const choice=node('select');choice.setAttribute('aria-label','Ингредиент');
 const fresh=node('option','Создать отдельный ингредиент');fresh.value='';choice.append(fresh);
 const preferred=new Set((m.suggestions||[]).map(s=>s.productId));
 const sorted=c.products.slice().sort((a,b)=>Number(preferred.has(b.id))-Number(preferred.has(a.id))||a.name.localeCompare(b.name,'ru'));
 for(const p of sorted){const opt=node('option',(preferred.has(p.id)?'★ ':'')+p.name);opt.value=p.id;choice.append(opt);}
 choice.value=m.status==='known'?m.productId:'';
 const label=node('label','Ингредиент');label.append(choice);dlg.append(label);
 const title=node('input');title.value=r.name.replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim();
 title.setAttribute('aria-label','Название нового ингредиента');const newLabel=node('label','Название новой карточки');newLabel.append(title);dlg.append(newLabel);
 const key=catalogAPI.aliasKey(supplier,r),vid=m.variantId||'variant:'+key;
 const existing=catalogState.quality[vid]||{};
 const quality=node('input'),yieldInput=node('input');quality.type=yieldInput.type='number';quality.min='1';quality.max='10';quality.step='.1';yieldInput.min='.1';yieldInput.max='100';yieldInput.step='.1';quality.value=existing.rating??'';yieldInput.value=existing.yieldPct??'';
 for(const [caption,control] of [['Качество (1–10, необязательно)',quality],['Фактический выход, % (необязательно)',yieldInput]]){const lab=node('label',caption);lab.append(control);dlg.append(lab);}
 function sync(){newLabel.classList.toggle('hide',!!choice.value);}choice.onchange=sync;sync();
 const error=node('p','','up');dlg.append(error);
 const save=button('Подтвердить',()=>{
  try{const current=getRow();if(catalogAPI.aliasKey(getSupplier(),current)!==key)throw Error('Товар изменился. Откройте карточку снова.');
   let id=choice.value,products=catalogState.products.slice();
   if(!id){if(!title.value.trim())throw Error('Введите название');id=crypto.randomUUID();products.push({id,name:title.value.trim()});}
   else if(!products.some(p=>p.id===id)){const selected=c.products.find(p=>p.id===id);if(!selected)throw Error('Товар не найден');products.push(selected);}
   const rating=quality.value===''?null:Number(quality.value),yieldPct=yieldInput.value===''?null:Number(yieldInput.value);
   if(rating!==null&&(!Number.isFinite(rating)||rating<1||rating>10)||yieldPct!==null&&(!Number.isFinite(yieldPct)||yieldPct<=0||yieldPct>100))throw Error('Проверьте оценку и выход');
   const aliases=catalogAPI.confirm(r,supplier,id,vid,products,catalogState.aliases);
   saveCatalog({products,aliases,quality:{...catalogState.quality,[vid]:{rating,yieldPct}}});dlg.close();onSaved();
  }catch(e){error.textContent=e.message;}
 });save.classList.add('primary');dlg.append(save,button('Отмена',()=>dlg.close()));dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
}
function catalogBadge(f){
 const r=lineData(f),supplier=$('supplier').value.trim(),badge=f.querySelector('.catalog-badge');
 if(!badge)return;if(!r.name||!supplier){badge.classList.add('hide');return;}
 const match=catalogMatch(r,supplier);badge.classList.remove('hide','known','review','new');badge.classList.add(match.status);
 badge.textContent=match.status==='known'?'✓ В справочнике':match.status==='review'?'! Сопоставить ингредиент':'＋ Новый ингредиент';
}
function qualityDetail(r){
 const quality=catalogState.quality[variantKey(r)]||{},parts=[];
 if(quality.rating!=null)parts.push('★ '+fmt(quality.rating)+'/10');
 if(quality.yieldPct!=null){parts.push('Выход '+fmt(quality.yieldPct)+'%');const p=quotePrice(r);if(p!=null&&quoteUnit(r)==='кг')parts.push('После обработки '+rub(p/(quality.yieldPct/100))+'/кг');}
 return parts.join(' · ');
}

function node(tag,txt,cls){const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n}
function status(s,ok=false){$('status').textContent=s;$('status').classList.toggle('ok',ok)}
function button(txt,fn){const n=node('button',txt);n.type='button';n.onclick=()=>Promise.resolve().then(fn).catch(e=>status(e.message));return n}
function row(parent,title,subtitle,right){const r=node('div',null,'row'),l=node('div');l.append(node('strong',title),node('br'),node('small',subtitle));r.append(l,right);parent.append(r);return r}
function empty(parent,txt){parent.append(node('p',txt,'empty'))}
function go(id){if(!$('entry').classList.contains('hide')&&id!=='entry'&&dirty&&!confirm('Выйти без сохранения?'))return;for(const v of sections)$(v).classList.toggle('hide',v!==id);document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===(id==='entry'?'invoices':id)));if(id!=='entry'){dirty=false;ocrId=null;scanBusy=false;render()}window.scrollTo(0,0)}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='entry'){reset();go('entry')}else {if(b.dataset.go==='invoices')supplierFilter=null;go(b.dataset.go)}});
function tx(mode,fn){return new Promise((resolve,reject)=>{if(!db){reject(Error('База ещё не открыта'));return}const t=db.transaction('invoices',mode),r=fn(t.objectStore('invoices'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error||r.error);t.onabort=()=>reject(t.error||Error('Сохранение отменено'))})}
async function refresh(){docs=await tx('readonly',s=>s.getAll());render()}
// Only reuse a unique, previously confirmed weight for the same supplier and product.
const packUnits=['шт','уп','кор'];
const productIdentity=s=>norm(s).replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim();
function knownPack(data,supplier,history=docs,field='packKg'){
 if(!packUnits.includes(data.unit)||!norm(supplier)||!data.name)return null;
 const matches=history.filter(d=>d.simpleVersion===1&&supplierKey(d.supplierId)===supplierKey(supplier)).flatMap(d=>d.lines||[]).filter(l=>{
  if(l.unit!==data.unit)return false;
  if(data.article&&l.article)return String(data.article)===String(l.article);
  return productIdentity(l.name)===productIdentity(data.name);
 });
 const weights=[...new Set(matches.map(l=>numeric(l[field])).filter(Boolean))];
 return weights.length===1?weights[0]:null;
}
// The payable invoice line total is the authoritative gross amount.
function grossRow(row){
 const name=String(row.name||''),net=/\(без НДС\)/i.test(name),quantity=numeric(row.quantity),total=numeric(row.invoiceTotal);
 const originalNet=numeric(row.netPrice)??(net?numeric(row.price):null);
 const price=total&&quantity?Math.round((total/quantity+Number.EPSILON)*100)/100:net?null:numeric(row.price);
 return {...row,name:name.replace(/\(без НДС\)/gi,'(с НДС)'),price,netPrice:originalNet,invoiceTotal:total};
}
function grossMetrics(row){
 const r=grossRow(row),q=numeric(r.quantity);
 const p=r.invoiceTotal&&q?r.invoiceTotal/q:r.price;
 return window.supplyInvoiceParser.purchaseMetrics({...r,price:p});
}
function quotePrice(row){
 const m=grossMetrics(row);
 return m.basis==='кг'&&m.pricePerKg!=null?m.pricePerKg:m.basis==='л'&&m.pricePerL!=null?m.pricePerL:m.basis==='шт'&&m.pricePerPiece!=null?m.pricePerPiece:grossRow(row).price;
}
function quoteUnit(row){
 const m=grossMetrics(row);
 return m.basis==='кг'&&m.pricePerKg!=null?'кг':m.basis==='л'&&m.pricePerL!=null?'л':m.basis==='шт'&&m.pricePerPiece!=null?'шт':row.unit||'';
}
function lineData(f){
 const value=k=>f.querySelector('[data-field='+k+']').value;
 return {name:value('name').trim(),price:numeric(value('price')),quantity:numeric(value('quantity')),unit:value('unit'),packKg:value('packMeasure')==='кг'?numeric(value('packKg')):null,packL:value('packMeasure')==='л'?numeric(value('packKg')):null,article:f.dataset.article||undefined,invoiceTotal:numeric(f.dataset.invoiceTotal),netPrice:numeric(f.dataset.netPrice),pageKey:f.dataset.pageKey||undefined};
}
const fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:6});
function lineSummary(l){
 const m=grossMetrics(l),parts=[];
 if(l.packKg&&packUnits.includes(l.unit))parts.push('Фасовка '+fmt(l.packKg)+' кг');
 if(l.packL&&packUnits.includes(l.unit))parts.push('Фасовка '+fmt(l.packL)+' л');
 if(l.quantity)parts.push(fmt(l.quantity)+' '+(l.unit||'ед.'));
 if(m.basis==='кг'&&m.totalKg!==null&&l.unit!=='кг')parts.push('Всего '+fmt(m.totalKg)+' кг');
 if(m.basis==='кг'&&m.pricePerKg!==null&&l.unit!=='кг')parts.push(rub(m.pricePerKg)+'/кг');
 if(m.basis==='л'&&m.totalL!=null&&l.unit!=='л')parts.push('Всего '+fmt(m.totalL)+' л');
 if(m.basis==='л'&&m.pricePerL!=null&&l.unit!=='л')parts.push(rub(m.pricePerL)+'/л');
 if(m.basis==='шт'){if(m.totalPieces!=null&&l.unit!=='шт')parts.push('Всего '+fmt(m.totalPieces)+' шт');if(m.pricePerPiece!=null)parts.push(rub(m.pricePerPiece)+'/шт');}if(m.totalPrice!==null)parts.push('Сумма '+rub(m.totalPrice));
 return parts.join(' · ');
}
function addLine(data={}){
 data=grossRow(data);
 const f=node('div',null,'line');if(data.uncertain)f.classList.add('uncertain');if(data.article)f.dataset.article=String(data.article);if(data.pageKey)f.dataset.pageKey=data.pageKey;if(numeric(data.invoiceTotal))f.dataset.invoiceTotal=String(numeric(data.invoiceTotal));if(numeric(data.netPrice))f.dataset.netPrice=String(data.netPrice);
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
 function recalc(){const l=lineData(f),m=grossMetrics(l);f.classList.toggle('line-invalid',!!l.name&&l.price===null);const pack=packUnits.includes(l.unit),piece=m.basis==='шт',volume=m.basis==='л';w.i.disabled=measure.disabled=!pack;w.wrap.style.background=needsPack(l)?'#fff1b8':'';const basis=' с НДС';p.wrap.firstChild.nodeValue=(piece&&l.unit==='шт'?'Цена за шт.':pack?'Цена за уп.':l.unit==='кг'?'Цена за кг':l.unit==='л'?'Цена за л':'Цена за ед.')+basis+', ₽';p.i.setAttribute('aria-label',p.wrap.firstChild.nodeValue);const per=m.piecesPerPack;q.wrap.firstChild.nodeValue=piece&&per&&l.unit==='шт'&&m.totalPieces!=null?'Количество ('+fmt(per)+' шт./кор.)':'Количество';weight.box.firstChild.textContent=piece?'Общее количество':volume?'Общий объём':'Общий вес';kgPrice.box.firstChild.textContent=(piece?'Цена за шт.':volume?'Цена за л':'Цена за кг')+basis;const qty=piece?m.totalPieces:volume?m.totalL:m.totalKg,price=piece?m.pricePerPiece:volume?m.pricePerL:m.pricePerKg;weight.out.textContent=qty==null?'—':fmt(qty)+' '+(piece?'шт.':volume?'л':'кг');if(piece&&per&&qty!=null&&l.unit==='шт'&&qty%per===0)weight.out.textContent+=' · '+fmt(qty/per)+' кор.';kgPrice.out.textContent=price==null?'—':rub(price);total.out.textContent=m.totalPrice==null?'—':rub(m.totalPrice);total.out.title=l.invoiceTotal?'Сумма к оплате из накладной':'Расчёт по количеству и цене с НДС';}
 function fillMissingPack(){if(!packUnits.includes(u.value)||numeric(w.i.value))return;const parser=window.supplyInvoiceParser,mass=parser.packWeight(a.i.value),volume=parser.packVolume(a.i.value),savedMass=knownPack(lineData(f),$('supplier').value),savedVolume=knownPack(lineData(f),$('supplier').value,docs,'packL');if(mass||volume||savedMass&&!savedVolume||savedVolume&&!savedMass){measure.value=mass||!volume&&savedMass?'кг':'л';w.i.value=mass||volume||savedMass||savedVolume;w.i.title=mass||volume?'Из названия товара':'Из ранее подтверждённой накладной';}}
 measure.addEventListener('change',()=>{w.i.value='';w.i.title='';recalc()});
 a.i.addEventListener('change',()=>{delete f.dataset.article;fillMissingPack();recalc()});
 u.addEventListener('change',()=>{fillMissingPack();recalc()});
 w.i.addEventListener('input',()=>{w.i.title='';});
 for(const input of [p.i,q.i])input.addEventListener('input',()=>{delete f.dataset.invoiceTotal;delete f.dataset.netPrice;});
 f.addEventListener('input',recalc);u.addEventListener('change',()=>{delete f.dataset.invoiceTotal;delete f.dataset.netPrice;recalc()});
 if(data.source)f.title=data.source;
 const badge=button('',()=>productLinkDialog(()=>lineData(f),()=>$('supplier').value,()=>catalogBadge(f)));badge.className='catalog-badge hide';
 f.append(a.wrap,del,w.wrap,q.wrap,weight.box,p.wrap,kgPrice.box,total.box,badge);$('lines').append(f);fillMissingPack();recalc();catalogBadge(f);f.addEventListener('change',()=>catalogBadge(f));
}
function showPreview(file){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';$('preview').classList.add('hide');if(file&&file.type?.startsWith('image/')){previewUrl=URL.createObjectURL(file);$('preview').src=previewUrl;$('preview').classList.remove('hide')}}
function reset(){scanStartedAt=0;stageStartedAt=0;scanTrace=[];$('scanProgress').replaceChildren();pages=[];activePage=null;pendingPhoto=null;partialPage=null;scanPass=0;scanCandidates=[];photoPassTexts=[];photoSupplier='';document.getElementById('ocrDiagnostic')?.remove();ocrId=null;scanBusy=false;editing=null;$('form').reset();$('lines').replaceChildren();addLine();showPreview(null);$('ocrState').textContent='';$('retry').classList.add('hide');$('save').disabled=false;$('file').disabled=false;dirty=false;pageStatus();status('')}
$('supplier').addEventListener('change',()=>{for(const f of $('lines').children)catalogBadge(f)});
$('addLine').onclick=()=>{addLine();dirty=true};$('form').addEventListener('input',()=>dirty=true);$('file').addEventListener('change',()=>{const file=$('file').files[0];if(!file)return;activePage=null;pendingPhoto=file;scanPass=0;scanCandidates=[];photoPassTexts=[];photoSupplier='';scanStartedAt=performance.now();scanTrace=[];document.getElementById('ocrDiagnostic')?.remove();showPreview(file);pageStatus();dirty=true});

function pageStatus(){
 const label=$('fileLabel');if(label)label.textContent=pages.length?'＋ Добавить страницу':'▣ Выбрать фото или PDF';
 const numbers=[...new Set(pages.map(p=>p.number).filter(Boolean))],expected=Math.max(0,...pages.map(p=>p.expected||0));
 const complete=expected>0&&numbers.length===expected&&numbers.every(n=>n>=1&&n<=expected);
 partialPage=expected&&!complete?{pages:expected,page:numbers.length}:null;
 $('pageState').textContent=pages.length?'Страниц в форме: '+pages.length+(expected?' · Страниц '+numbers.length+' из '+expected:''):'';
}
function pageMeta(r,raw){
 const text=String(raw||'');
 const id=text.match(/(?:по\s+УПД|сч[её]т[- ]фактура|накладная|накладной)\s*(?:№|No|N[еe])\s*([a-zа-яё0-9][a-zа-яё0-9/.-]*)/i)?.[1]||null;
 const page=text.match(/(?:стр\.|страница|cmp\.)\s*([1-9]\d*|I)\s*(?:из|u3)\s*(\d+)/i);
 const number=r.pageInfo?.page|| (page?(page[1].toUpperCase()==='I'?1:Number(page[1])):null);
 const expected=r.pageInfo?.pages|| (page?Number(page[2]):null);
 return {documentNumber:id?norm(id):null,number,expected};
}
function pageFingerprint(items){
 return JSON.stringify(items.map(l=>[norm(l.name),l.quantity??null,l.price??null,l.invoiceTotal??null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function photoFingerprint(f){return f?JSON.stringify([f.name,f.size,f.lastModified,f.type]):null}
function acceptPage(r,raw){
 const previous=pages.find(p=>p.key===activePage);
 const others=pages.filter(p=>p.key!==activePage);
 const supplier=$('supplier').value.trim(),meta=pageMeta(r,raw);
 const file=pendingPhoto||previous?.file||$('file').files[0]||null;
 const identity=photoFingerprint(file),fingerprint=pageFingerprint(r.items);
 if(others.length&&r.supplier&&supplier&&supplierKey(r.supplier)!==supplierKey(supplier))throw Error('Другой поставщик. Страница не добавлена.');
 if(others.some(p=>meta.documentNumber&&p.documentNumber&&meta.documentNumber!==p.documentNumber))throw Error('Другой номер накладной. Страница не добавлена.');
 if(others.some(p=>meta.expected&&p.expected&&meta.expected!==p.expected))throw Error('Не совпадает число страниц. Страница не добавлена.');
 if(others.some(p=>(meta.number&&p.number===meta.number)||(identity&&p.identity===identity)||(fingerprint===p.fingerprint&&!(meta.number&&p.number&&meta.number!==p.number))))throw Error('Эта страница уже добавлена.');
 if(others.length&&(!meta.documentNumber||!others.some(p=>p.documentNumber===meta.documentNumber)||!r.supplier)&&!confirm('Убедитесь, что фото относится к этой же накладной. Добавить страницу?'))return false;
 const key=previous?.key||crypto.randomUUID();
 const existing=[...$('lines').children].map(lineData).filter(x=>x.name&&(!previous||x.pageKey===key));
 if(previous&&existing.length&&!confirm('Заменить распознанные товары только на этой странице?'))return false;
 if(!others.length&&!previous&&existing.length&&!existing.every(x=>x.price==null&&x.quantity==null)&&!confirm('Заменить текущие строки распознанными?'))return false;
 if(!others.length&&!previous)$('lines').replaceChildren();
 else if(previous){for(const el of [...$('lines').children])if(el.dataset.pageKey===key)el.remove();}
 else {for(const el of [...$('lines').children])if(!lineData(el).name)el.remove();}
 if(r.supplier)$('supplier').value=r.supplier;
 for(const l of r.items)addLine({...l,pageKey:key});
 const record={...meta,key,file,identity,fingerprint};
 if(previous)pages=pages.map(p=>p.key===key?record:p);else pages.push(record);
 activePage=key;pendingPhoto=null;pageStatus();return true;
}

function numeric(s){const n=Number(String(s).replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>0?n:null}
function dateLabel(d){const v=new Date(d);return Number.isFinite(v.getTime())?v.toLocaleDateString('ru-RU'):''}
function linesOf(d){if(d.simpleVersion===1)return Array.isArray(d.lines)?d.lines.map(grossRow):[];if(d.status!=='confirmed')return [];return (d.lines||[]).flatMap(l=>{try{const p=window.supplyAnalytics.linePrice(l);return [{name:l.productId+' / '+p.unit+' (с НДС)',price:p.price}]}catch{return []}})}
function supplierKey(s){
 return norm(s).replace(/^общество с ограниченной ответственностью\s+/, 'ооо ').replace(/[«»"“”]/g,'').replace(/\s+/g,' ').trim();
}
function observations(){return docs.flatMap(d=>linesOf(d).filter(l=>l.name&&numeric(l.price)).map(l=>({...l,name:l.name,price:Number(l.price),unit:l.unit||'',packKg:l.packKg||null,packL:l.packL||null,supplier:d.supplierId,date:d.savedAt||d.date||'',docId:d.id}))).sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function historyPrice(r){const price=quotePrice(r),unit=quoteUnit(r);return price==null?'Уточнить цену с НДС':rub(price)+(unit?'/'+unit:'')+' с НДС'}
function supplierHistory(parent,history){
 const h=node('details',null,'supplier-history');h.style.cssText='margin:4px 0 12px;padding:0 0 6px;border-bottom:1px solid var(--line)';
 const summary=node('summary','История цен ('+history.length+')');summary.style.cssText='cursor:pointer;color:var(--purple);font-weight:700;padding:8px 0';
 h.append(summary);
 for(let i=history.length-1;i>=0;i--){
  const r=history[i],previous=history[i-1],delta=previous?quotePrice(r)-quotePrice(previous):0;
  const desc=[dateLabel(r.date),lineSummary(r),previous?(delta===0?'Цена без изменений':(delta>0?'Рост ':'Снижение ')+rub(Math.abs(delta))):'Первая закупка'].filter(Boolean).join(' · ');
  row(h,r.name,desc,node('strong',historyPrice(r),'price '+(delta>0?'up':delta<0?'down':'')));
 }
 parent.append(h);
}
function productKey(r){const m=catalogMatch(r);return m.productId?JSON.stringify([m.productId,quoteUnit(r)]):originalProductKey(r);}
function grouped(obs,key){const m=new Map();for(const r of obs){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return m}
function latest(obs){return [...grouped(obs,r=>JSON.stringify([variantKey(r),supplierKey(r.supplier)])).values()].map(s=>s[s.length-1])}
function offerDetail(r){const m=grossMetrics(r);return [dateLabel(r.date),r.packKg?'Фасовка '+fmt(r.packKg)+' кг':r.packL?'Фасовка '+fmt(r.packL)+' л':'',m.basis==='шт'&&m.pricePerPiece!=null?rub(m.pricePerPiece)+'/шт':'',m.basis==='кг'&&m.pricePerKg!=null&&r.unit!=='кг'?rub(m.pricePerKg)+'/кг':'',m.basis==='л'&&m.pricePerL!=null&&r.unit!=='л'?rub(m.pricePerL)+'/л':''].filter(Boolean).join(' · ')}

function renderDashboard(obs,last){
 const select=$('period'),days=Number(select.value)||0,now=new Date(),cutoff=days?new Date(now.getTime()-days*86400000):null;
 const history=docs.filter(d=>!cutoff||new Date(d.savedAt||d.date)>=cutoff),ids=new Set(history.map(d=>d.id));
 const period=obs.filter(r=>ids.has(r.docId));
 const totals=history.flatMap(d=>linesOf(d)).map(r=>grossMetrics(r).totalPrice).filter(x=>x!=null);
 const total=totals.reduce((s,x)=>s+x,0);
 $('spend').textContent=totals.length?rub(total):'—';
 $('periodPositions').textContent=period.length;
 $('productCount').textContent=new Set(period.map(productKey)).size;
 $('supplierCount').textContent=new Set(history.map(d=>supplierKey(d.supplierId)).filter(Boolean)).size;
 const by=grouped(last,productKey),offers=[...by.values()].filter(x=>new Set(x.map(r=>supplierKey(r.supplier))).size>1&&x.every(r=>quotePrice(r)>0&&quoteUnit(r)));
 const trends=[...grouped(obs,r=>variantKey(r)).values()].filter(x=>x.length>1).map(x=>[x.at(-2),x.at(-1)]).filter(x=>ids.has(x[1].docId));
 $('upCount').textContent=trends.filter(([a,b])=>quotePrice(b)>quotePrice(a)).length;
 $('downCount').textContent=trends.filter(([a,b])=>quotePrice(b)<quotePrice(a)).length;
 const recommendations=offers.map(rows=>{const sorted=rows.slice().sort((a,b)=>quotePrice(a)-quotePrice(b));return {best:sorted[0],worst:sorted.at(-1),gap:quotePrice(sorted.at(-1))-quotePrice(sorted[0])};}).filter(x=>x.gap>0).sort((a,b)=>b.gap-a.gap);
 const comparable=new Map(offers.map(rows=>[productKey(rows[0]),Math.min(...rows.map(quotePrice))]));
 let saving=0,covered=0;
 for(const r of period){const min=comparable.get(productKey(r)),m=grossMetrics(r),unit=quoteUnit(r),qty=unit==='кг'?m.totalKg:unit==='л'?m.totalL:unit==='шт'?m.totalPieces:null;if(min!=null&&qty>0){saving+=Math.max(0,quotePrice(r)-min)*qty;covered++;}}
 $('saving').textContent=covered?rub(saving):'—';
 $('savingNote').textContent=covered?'Оценка по последним известным сопоставимым ценам':'Недостаточно сопоставимых цен';
 const tips=$('recommendations');tips.replaceChildren();
 if(!recommendations.length)empty(tips,'Нужны сопоставимые предложения минимум двух поставщиков.');
 for(const x of recommendations.slice(0,4)){const card=node('div',null,'tip');card.append(node('strong',catalogTitle(x.best)),node('p','Дешевле: '+x.best.supplier+' · '+historyPrice(x.best),'down'),node('p','Дороже: '+x.worst.supplier+' · '+historyPrice(x.worst),'up'),node('small','Разница '+rub(x.gap)+'/'+quoteUnit(x.best)));tips.append(card);}
 const spendBySupplier=new Map();for(const d of history){const key=supplierKey(d.supplierId),value=linesOf(d).map(r=>grossMetrics(r).totalPrice||0).reduce((s,n)=>s+n,0);const prior=spendBySupplier.get(key)||{name:d.supplierId||'Без поставщика',value:0};prior.value+=value;spendBySupplier.set(key,prior);}
 const parts=[...spendBySupplier.values()].filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
 const dist=$('spendChart');dist.replaceChildren();if(!parts.length)empty(dist,'Нет сохранённых закупок с суммами.');
 else{const colors=['#632bdc','#9b63f4','#7258e8','#4793dc','#aeabc9'],segments=[];let pct=0;parts.forEach((x,i)=>{const next=pct+100*x.value/total;segments.push(colors[i%colors.length]+' '+pct+'% '+next+'%');pct=next;});const ring=node('div',null,'donut');ring.style.background='conic-gradient('+segments.join(',')+')';ring.append(node('strong',rub(total)));dist.append(ring);parts.forEach((x,i)=>{const line=row(dist,x.name,fmt(Math.round(1000*x.value/total)/10)+'%',node('strong',rub(x.value),'price'));line.style.borderLeft='3px solid '+colors[i%colors.length];line.style.paddingLeft='7px';});}
 const ranking=$('qualityRank');ranking.replaceChildren();
 const rated=last.filter(r=>catalogState.quality[variantKey(r)]?.rating!=null).sort((a,b)=>catalogState.quality[variantKey(b)].rating-catalogState.quality[variantKey(a)].rating);
 if(!rated.length)empty(ranking,'Оцените качество и выход в карточке товара. Рейтинг не придумывается.');
 for(const r of rated.slice(0,5))row(ranking,catalogTitle(r),r.supplier+' · '+qualityDetail(r),node('strong','★ '+fmt(catalogState.quality[variantKey(r)].rating),'down'));
 const products=$('topPurchases');products.replaceChildren();
 const spending=[...grouped(period,productKey).values()].map(rows=>({name:catalogTitle(rows[0]),total:rows.reduce((s,r)=>s+(grossMetrics(r).totalPrice||0),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
 for(const x of spending.slice(0,5)){row(products,x.name,'Расход за период',node('strong',rub(x.total),'price'));const bar=node('div',null,'offer-bar'),fill=node('i');fill.style.width=(100*x.total/spending[0].total)+'%';bar.append(fill);products.append(bar);}if(!spending.length)empty(products,'Нет данных за период.');
 const trend=$('trendChart');trend.replaceChildren();
 const series=[...grouped(obs,variantKey).values()].filter(x=>x.length>1&&x.every(r=>quotePrice(r)>0&&quoteUnit(r)===quoteUnit(x[0]))).sort((a,b)=>String(b.at(-1).date).localeCompare(String(a.at(-1).date)));
 if(!series.length)empty(trend,'График появится после повторной закупки.');
 else{const x=series[0].slice(-10),vals=x.map(quotePrice),min=Math.min(...vals),max=Math.max(...vals),points=vals.map((v,i)=>[12+i*276/(vals.length-1),92-(v-min)*72/(max-min||1)]);trend.append(node('strong',catalogTitle(x[0])),node('small',x[0].supplier+' · '+historyPrice(x.at(-1))));const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 300 108');svg.setAttribute('role','img');svg.setAttribute('aria-label','Динамика цены от '+rub(vals[0])+' до '+rub(vals.at(-1)));const line=document.createElementNS(ns,'polyline');line.setAttribute('points',points.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#6935de');line.setAttribute('stroke-width','3');svg.append(line);points.forEach(([x,y])=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','4');dot.setAttribute('fill','#6935de');svg.append(dot);});trend.append(svg,node('small',dateLabel(x[0].date)+' — '+dateLabel(x.at(-1).date)+' · '+rub(vals[0])+' → '+rub(vals.at(-1))));}
}

function render(){const obs=observations(),last=latest(obs),products=grouped(last,productKey),suppliers=grouped(last,r=>supplierKey(r.supplier));$('productCount').textContent=products.size;$('supplierCount').textContent=suppliers.size;
$('changes').replaceChildren();const trends=[...grouped(obs,r=>JSON.stringify([variantKey(r),supplierKey(r.supplier)])).values()].filter(s=>s.length>1).map(s=>[s[s.length-2],s[s.length-1]]).filter(([a,b])=>quotePrice(a)!==quotePrice(b)).slice(-6).reverse();for(const [a,b] of trends){const delta=quotePrice(b)-quotePrice(a);row($('changes'),b.name,b.supplier+' · '+historyPrice(a)+' → '+historyPrice(b),node('strong',(delta>0?'+':'−')+rub(Math.abs(delta)),'price '+(delta>0?'up':'down')))}if(!trends.length)empty($('changes'),'Изменения появятся после повторной закупки.');
const ordered=[...docs].sort((a,b)=>String(b.savedAt||b.date||'').localeCompare(String(a.savedAt||a.date||'')));$('recent').replaceChildren();for(const d of ordered.slice(0,3))row($('recent'),d.supplierId||'Без поставщика',dateLabel(d.savedAt||d.date),button('Открыть',()=>{supplierFilter=null;go('invoices')}));if(!ordered.length)empty($('recent'),'Нет накладных');
$('archive').replaceChildren();const archiveDocs=supplierFilter===null?ordered:ordered.filter(d=>supplierKey(d.supplierId)===supplierFilter);if(supplierFilter!==null)$('archive').append(button('Все накладные',()=>{supplierFilter=null;render()}));for(const d of archiveDocs){const c=node('div',null,'card');c.append(node('h2',d.supplierId||'Без поставщика'),node('small',dateLabel(d.savedAt||d.date)));const ls=linesOf(d);if(d.simpleVersion!==1)c.append(node('p','Архив старой версии. Оригинальные данные сохранены.','muted'));for(const l of ls)row(c,l.name,lineSummary(l),node('strong',historyPrice(l),'price'));const ctl=node('div',null,'controls');const photos=(d.pages||[]).map(p=>p.file).filter(f=>f?.type?.startsWith('image/'));if(!photos.length&&d.original?.type?.startsWith('image/'))photos.push(d.original);if(photos.length)ctl.append(button(photos.length>1?'Фото ('+photos.length+')':'Фото',()=>{const dlg=node('dialog'),urls=[];for(let i=0;i<photos.length;i++){const url=URL.createObjectURL(photos[i]),img=node('img');urls.push(url);img.src=url;img.style.cssText='max-width:85vw;max-height:70vh;object-fit:contain;display:block';dlg.append(node('p','Фото '+(i+1)+' из '+photos.length),img)}dlg.append(button('Закрыть',()=>dlg.close()));dlg.addEventListener('close',()=>{urls.forEach(u=>URL.revokeObjectURL(u));dlg.remove()},{once:true});document.body.append(dlg);dlg.showModal()}));const pdfOriginal=(d.pages||[]).find(p=>p.file?.type==='application/pdf')?.file||(d.original?.type==='application/pdf'?d.original:null);if(pdfOriginal)ctl.append(node('small','PDF сохранён: '+pdfOriginal.name));if(d.simpleVersion===1){ctl.append(button('Редактировать',()=>edit(d)),button('Удалить',async()=>{if(confirm('Удалить накладную?')){await tx('readwrite',s=>s.delete(d.id));await refresh();status('Удалено',true)}}))}c.append(ctl);$('archive').append(c)}if(!archiveDocs.length)empty($('archive'),'Нет накладных');
$('productList').replaceChildren();for(const offers of [...products.values()].sort((a,b)=>a[0].name.localeCompare(b[0].name,'ru'))){if(!norm(catalogTitle(offers[0])).includes(norm($('search').value))&&!offers.some(r=>norm(r.name).includes(norm($('search').value))))continue;const c=node('div',null,'card');c.append(node('h2',catalogTitle(offers[0])));for(const r of offers.sort((a,b)=>quotePrice(a)-quotePrice(b))){row(c,r.supplier,[r.name,offerDetail(r),qualityDetail(r)].filter(Boolean).join(' · '),node('strong',historyPrice(r),'price'));const link=button('Связать / разделить · качество',()=>productLinkDialog(()=>r,()=>r.supplier,render));link.classList.add('catalog-action');c.append(link);}$('productList').append(c)}if(!$('productList').children.length)empty($('productList'),'Товары не найдены');
$('supplierList').replaceChildren();
for(const [key,list] of [...suppliers.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru'))){
 const c=node('div',null,'card'),purchases=ordered.filter(d=>supplierKey(d.supplierId)===key),all=obs.filter(r=>supplierKey(r.supplier)===key),histories=grouped(all,variantKey);
 c.append(node('h2',purchases[0]?.supplierId||list[0].supplier),node('p',list.length+' товаров · '+purchases.length+' накладных','muted'),button('Накладные поставщика',()=>{supplierFilter=key;go('invoices')}));
 for(const r of list.sort((a,b)=>a.name.localeCompare(b.name,'ru'))){
  row(c,r.name,offerDetail(r),node('strong',historyPrice(r),'price'));
  supplierHistory(c,histories.get(variantKey(r))||[r]);
 }
 $('supplierList').append(c);
}if(!suppliers.size)empty($('supplierList'),'Нет поставщиков');
$('offers').replaceChildren();for(const list of products.values()){const c=node('div',null,'card');c.append(node('h2',catalogTitle(list[0])));const sorted=list.slice().sort((a,b)=>quotePrice(a)-quotePrice(b)),best=sorted[0];for(const r of sorted){const good=sorted.length>1&&quotePrice(r)===quotePrice(best);row(c,r.supplier,[r.name,offerDetail(r),qualityDetail(r),good?'Лучшая цена':''].filter(Boolean).join(' · '),node('strong',historyPrice(r),'price '+(good?'down':'')));const bar=node('div',null,'offer-bar');const fill=node('i');fill.style.width=(100*quotePrice(r)/Math.max(...sorted.map(quotePrice)))+'%';fill.className=good?'best':r===sorted.at(-1)&&sorted.length>1?'worst':'';bar.append(fill);c.append(bar);}$('offers').append(c)}if(!products.size)empty($('offers'),'Загрузите накладные для сравнения.');
 renderDashboard(obs,last);
}
$('search').oninput=render;$('period').onchange=render;
function edit(d){reset();editing=d.id;pages=Array.isArray(d.pages)?d.pages.slice():d.original?[{key:'legacy',file:d.original,identity:photoFingerprint(d.original),fingerprint:pageFingerprint(d.lines)}]:[];$('supplier').value=d.supplierId;$('lines').replaceChildren();for(const l of d.lines)addLine({...l,pageKey:l.pageKey||(pages.length===1?pages[0].key:undefined)});showPreview(pages.at(-1)?.file||d.original);pageStatus();go('entry')}
$('form').onsubmit=async e=>{e.preventDefault();if(scanBusy)return;try{const supplier=$('supplier').value.trim(),lines=[...$('lines').children].map(f=>{const l=lineData(f);if(!packUnits.includes(l.unit)){l.packKg=null;l.packL=null;}return l});if(!supplier||!lines.length||lines.some(l=>!l.name||l.price===null))throw Error('Проверьте поставщика, названия и цены с НДС');if(new Set(lines.map(l=>JSON.stringify([norm(l.name),l.pageKey||'']))).size!==lines.length)throw Error('Есть одинаковые названия. Уточните фасовку или удалите дубль.');if(pendingPhoto&&!confirm('Последнее фото ещё не добавлено. Сохранить только обработанные товары?'))return;if(partialPage&&!confirm('Документ содержит '+partialPage.pages+' страниц. Добавлено '+partialPage.page+'. Сохранить только эту часть?'))return;if(!confirm('Названия, фасовки и цены сверены с оригиналом?'))return;const prior=docs.find(d=>d.id===editing);const doc={id:editing||crypto.randomUUID(),simpleVersion:1,supplierId:supplier,savedAt:prior?.savedAt||new Date().toISOString(),lines,original:pages[0]?.file||(!pendingPhoto?$('file').files[0]:null)||prior?.original||null,pages:pages.slice()};if(!editing&&docs.some(d=>d.simpleVersion===1&&supplierKey(d.supplierId)===supplierKey(supplier)&&JSON.stringify(d.lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())===JSON.stringify(lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())&&String(d.savedAt).slice(0,10)===doc.savedAt.slice(0,10))&&!confirm('Такие товары и цены уже сохранены сегодня. Добавить ещё раз?'))return;await tx('readwrite',s=>s.put(doc));dirty=false;supplierFilter=null;await refresh();go('invoices');status('✓ Накладная сохранена',true)}catch(err){status(err.message)}};
function scanLabel(){return scanPass===0?'Распознавание фото':scanPass===1?'Быстрая проверка Paddle OCR':'Углублённая проверка таблицы';}
function showScanProgress(){const el=$('scanProgress');el.replaceChildren();for(const s of scanTrace)el.append(node('div',(s.failed?'⚠ ':'✓ ')+s.label+' · '+fmt(s.seconds)+' с',s.failed?'scan-step':'scan-step done'));if(scanBusy&&stageStartedAt)el.append(node('div','● '+scanLabel()+' · '+fmt(Math.round((performance.now()-stageStartedAt)/100)/10)+' с','scan-step active'));if(!scanBusy&&scanTrace.length)el.append(node('div','Проверьте результат по оригиналу','scan-step'));}
setInterval(()=>{if(scanBusy)showScanProgress();},500);
window.supplyOcrStart=id=>{if($('entry').classList.contains('hide'))return;ocrId=id;if(!scanStartedAt)scanStartedAt=performance.now();stageStartedAt=performance.now();scanBusy=true;$('save').disabled=true;$('file').disabled=true;$('retry').classList.add('hide');$('ocrState').textContent=scanLabel()+'…';showScanProgress()};
function scanDiagnostic(text){document.getElementById('ocrDiagnostic')?.remove();if(!text)return;const d=node('details');d.id='ocrDiagnostic';d.append(node('summary','Распознанный текст'));const p=node('textarea');p.readOnly=true;p.value=text;p.style.cssText='width:100%;height:150px;font:12px monospace';const copy=button('Копировать весь текст',async()=>{try{await navigator.clipboard.writeText(p.value);status('Текст скопирован',true)}catch{p.focus();p.select();if(document.execCommand('copy'))status('Текст скопирован',true);else status('Текст выделен — скопируйте его через меню телефона')}});d.append(p,copy);$('retry').after(d);p.scrollTop=0}
function scanScore(r){
 const priced=r.items.filter(x=>x.price!=null),complete=priced.filter(x=>x.quantity!=null&&x.unit);
 return (r.documentVerified?1000000:r.pageVerified?500000:0)+priced.length*1000+complete.length*100+priced.filter(x=>x.packKg!=null).length*20+r.items.length*10+(r.supplier?1:0);
}
function needsPack(x){const p=window.supplyInvoiceParser;return packUnits.includes(x.unit)&&!x.packKg&&!x.packL&&!p.packWeight(x.name)&&!p.packVolume(x.name)&&(p.purchaseMetrics(x).basis!=='шт'||/майонез|запекания с массовой долей|сыр(?:\s|$)|сливки|масло(?:\s|$)|рис(?:\s|$)|мука|форель|лосось|креветк/i.test(x.name));}
function scanFieldsComplete(r){return !!r.supplier&&r.items.length>0&&r.items.every(x=>x.price!=null&&x.quantity!=null&&x.unit)}
function scanConflicts(a,b){
 if(a.supplier&&b.supplier&&supplierKey(a.supplier)!==supplierKey(b.supplier))return true;
 if(a===b||pageFingerprint(a.items)===pageFingerprint(b.items))return false;
 const same=(x,y)=>!!((x.article&&y.article&&String(x.article)===String(y.article))||norm(y.name)===norm(x.name));
 const agrees=(x,y)=>Math.abs(x.price-y.price)<=.01&&(x.quantity==null||y.quantity==null||Math.abs(x.quantity-y.quantity)<=.00001);
 return a.items.some(x=>{if(x.price==null)return false;const matches=b.items.filter(y=>y.price!=null&&same(x,y));return matches.length>0&&!matches.some(y=>agrees(x,y));})||b.items.some(y=>{if(y.price==null)return false;const matches=a.items.filter(x=>x.price!=null&&same(x,y));return matches.length>0&&!matches.some(x=>agrees(x,y));});
}
function scanNextPass(pass,current,complete,evidence){
 if(pass>=2)return null;
 const verified=evidence.filter(x=>x.documentVerified&&scanFieldsComplete(x));
 const agree=verified.length>0&&verified.every(x=>!scanConflicts(x,verified[0])&&x.items.length===verified[0].items.length&&pageFingerprint(x.items)===pageFingerprint(verified[0].items));
 if(agree)return null;
 // Re-use the existing on-device Paddle route before the costly focused Tesseract retry.
 if(pass===0)return complete&&!evidence.some(x=>scanConflicts(x,current))?null:'paddle-scan';
 if(complete&&!evidence.some(x=>scanConflicts(x,current)))return null;
 return 'rescan';
}

function nextScan(path,message){
 scanBusy=true;$('save').disabled=true;$('file').disabled=true;$('retry').classList.add('hide');$('ocrState').textContent=message;
 location.href='https://appassets.androidplatform.net/'+path;
}

function acceptPdf(text,parseStarted){
 const file=pendingPhoto||$('file').files[0]||pages.find(p=>p.file?.type==='application/pdf')?.file;
 if(!file||pages.some(p=>p.file!==file)&&pages.length)throw Error('Откройте новую накладную для PDF');
 const source=JSON.parse(text.slice('FARUKH_PDF_PAGES_V1\n'.length));
 if(!Array.isArray(source)||!source.length||!source.every(x=>typeof x==='string'))throw Error('Не удалось прочитать страницы PDF');
 const parser=window.supplyInvoiceParser,parsed=source.map(s=>parser.parseSimple(s));
 const suppliers=[...new Map(parsed.filter(x=>x.supplier).map(x=>[supplierKey(x.supplier),x.supplier])).values()];
 const ids=[...new Set(source.map((s,i)=>pageMeta(parsed[i],s).documentNumber).filter(Boolean))];
 if(suppliers.length!==1||ids.length>1)throw Error('В PDF не подтверждён единый поставщик или номер накладной. Разделите документы.');
 const supplier=suppliers[0],records=[],rows=[];let review=0,missing=0;
 for(let i=0;i<source.length;i++){
  let r=parsed[i];
  if(!r.supplier){const withHeader=parser.parseSimple('Поставщик: '+supplier+'\n'+source[i]);if(scanScore(withHeader)>scanScore(r))r=withHeader;}
  const key=crypto.randomUUID();
  if(!r.items.length){missing++;continue;}
  if(!r.documentVerified&&!r.pageVerified||r.items.some(x=>x.price==null||x.quantity==null))review++;
  records.push({key,number:i+1,expected:source.length,documentNumber:ids[0]||null,file:i===0?file:null,identity:photoFingerprint(file)+'#'+(i+1),fingerprint:pageFingerprint(r.items)});
  for(const item of r.items)rows.push({...item,pageKey:key});
 }
 if(!rows.length)throw Error('В PDF не найдены товарные строки');
 if(!records.some(p=>p.file))records[0].file=file;
 if(pages.length&&!confirm('Заменить результаты этого PDF?'))return;
 $('lines').replaceChildren();$('supplier').value=supplier;pages=records;activePage=null;pendingPhoto=null;
 for(const row of rows)addLine(row);pageStatus();dirty=true;
 scanTrace.push({label:'Распределение товаров и сверка',seconds:Math.round((performance.now()-parseStarted)/100)/10});scanStartedAt=0;showScanProgress();
 $('ocrState').textContent='PDF: '+source.length+' стр. · '+rows.length+' позиций. '+(missing?'Не прочитано страниц: '+missing+'. ':'')+(review?'Требуют сверки: '+review+' стр. ':'')+'Сверьте с оригиналом.';
 if(missing||review)scanDiagnostic(source.map((s,i)=>'Страница '+(i+1)+'\n'+s).join('\n---\n'));
}

window.supplyOcrFinish=(id,text,error)=>{
 if(id!==ocrId||$('entry').classList.contains('hide'))return;
 if(stageStartedAt)scanTrace.push({label:scanLabel(),seconds:Math.round((performance.now()-stageStartedAt)/100)/10,failed:!!error||!String(text||'').trim()});stageStartedAt=0;const parseStarted=performance.now();scanBusy=false;$('save').disabled=false;$('file').disabled=false;$('retry').classList.remove('hide');
 try{
  if(String(text||'').startsWith('FARUKH_PDF_PAGES_V1\n')){acceptPdf(text,parseStarted);return;}
  if(pendingPhoto?.type==='application/pdf'||/\.pdf$/i.test(pendingPhoto?.name||'')){throw Error(error||'PDF не прочитан. Выберите файл повторно.');}
  let current=window.supplyInvoiceParser.parseSimple(text||'');
  // A focused table crop can omit the header. Carry forward a unique supplier
  // already read from the same photo; never fill one from a preset or a previous invoice.
  const earlierSuppliers=[...new Set([photoSupplier,...scanCandidates.map(x=>x.r.supplier)].filter(Boolean))];
  if(!current.supplier&&earlierSuppliers.length===1&&text){
   const contextual=window.supplyInvoiceParser.parseSimple('Поставщик: '+earlierSuppliers[0]+'\n'+text);
   if(scanScore(contextual)>scanScore(current))current=contextual;
  }
  if(current.supplier&&!photoSupplier)photoSupplier=current.supplier;
  if(text&&String(text).trim()&&!photoPassTexts.includes(text))photoPassTexts.push(text);
  scanCandidates.push({r:current,text,error});
  const native=location.origin==='https://appassets.androidplatform.net'&&$('file').files.length>0;
  // A missing pack weight alone is not a reason to scan a reconciled invoice again.
  // Preserve the original amount and request an explicit pack weight if unknown.
  const complete=scanFieldsComplete(current)&&!current.items.some(x=>needsPack(x)&&!knownPack(x,current.supplier||photoSupplier)&&!knownPack(x,current.supplier||photoSupplier,docs,'packL'));
  const rescored=scanCandidates.length===1&&complete&&current.documentVerified&&current.supplier
   ? [] : (scanPass>0||!complete?window.supplyInvoiceParser.parseSamePhotoPasses(photoPassTexts):[]);
  const evidence=[...scanCandidates.map(x=>x.r),...rescored];
  const action=scanNextPass(scanPass,current,complete,evidence);
  if(native&&action){
   scanPass=action==='paddle-scan'?1:2;
   nextScan(action,scanPass===1?'Быстрая проверка Paddle OCR…':'Углублённая проверка таблицы…');return;
  }
  for(const parsed of rescored)if(parsed.items.some(x=>x.price!=null))scanCandidates.push({r:parsed,text:'',error:''});
  const ranked=scanCandidates.slice().sort((a,b)=>scanScore(b.r)-scanScore(a.r)),best=ranked[0];
  let r=best.r;const suppliers=[...new Set(ranked.map(x=>x.r.supplier).filter(Boolean))];
  if(!r.supplier&&suppliers.length===1)r={...r,supplier:suppliers[0]};
  const comparable=r.documentVerified?ranked.filter(x=>x.r.documentVerified):ranked;
  const ambiguous=new Set(comparable.map(x=>x.r.supplier).filter(Boolean)).size>1||comparable.some(other=>other!==best&&scanConflicts(r,other.r));
  const diagnostic=photoPassTexts.join('\n---\n');scanTrace.push({label:'Распределение товаров и сверка',seconds:Math.round((performance.now()-parseStarted)/100)/10,failed:!r.items.some(x=>x.price!=null)});const elapsed=(performance.now()-scanStartedAt)/1000;scanStartedAt=0;showScanProgress();scanCandidates=[];scanPass=0;
  if(r.items.length&&r.items.some(x=>x.price!=null)){try{if(!acceptPage(r,diagnostic))return;}catch(err){$('ocrState').textContent=err.message;scanDiagnostic(diagnostic);return;}}
  else if(!pages.length){if(r.supplier)$('supplier').value=r.supplier;if(r.items.length){$('lines').replaceChildren();for(const l of r.items)addLine(l)}}
  dirty=true;const priced=r.items.filter(x=>x.price!=null).length;
  $('ocrState').textContent=ambiguous?'Разные результаты OCR. Сверьте цены и количество с фото.':priced?'Найдено цен: '+priced+' из '+r.items.length+'. Сверьте строки с фото.':(best.error||'Товарная таблица не прочитана. Выберите более чёткое фото или крупный снимок таблицы.');
  const missingPack=[...$('lines').children].map(lineData).some(needsPack);
  if(Number.isFinite(elapsed))$('ocrState').textContent+=' · '+fmt(Math.round(elapsed*10)/10)+' с';
  if(missingPack&&priced&&!ambiguous)$('ocrState').textContent+=' Фасовка не прочитана. Укажите вес нетто или объём одной упаковки — он сохранится для следующих накладных.';
  if(partialPage)$('ocrState').textContent+=' Добавлено страниц: '+partialPage.page+' из '+partialPage.pages+'. Загрузите остальные фото.';
  if(!priced&&activePage){$('ocrState').textContent='Повторная проверка не улучшила результат. Предыдущие строки сохранены.';}
  if(!priced||ambiguous||priced<r.items.length||missingPack)scanDiagnostic(diagnostic);else document.getElementById('ocrDiagnostic')?.remove();
 }catch(e){scanCandidates=[];scanPass=0;scanStartedAt=0;stageStartedAt=0;showScanProgress();$('ocrState').textContent=e.message||'Не удалось обработать документ.';scanDiagnostic(text);}
};
$('rescan').onclick=()=>{if(!$('file').files.length){status('Выберите документ');return}scanCandidates=photoPassTexts.map(text=>({r:window.supplyInvoiceParser.parseSimple(text),text,error:''}));scanStartedAt=performance.now();scanTrace=[];scanPass=2;nextScan('rescan','Углублённая проверка таблицы…')};
document.querySelector('a.update').addEventListener('click',e=>{if(dirty&&!confirm('Обновление закроет несохранённую форму. Продолжить?'))e.preventDefault()});
reset();const req=indexedDB.open('farukh-supply-preview',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('invoices'))req.result.createObjectStore('invoices',{keyPath:'id'})};req.onsuccess=()=>{db=req.result;refresh().catch(e=>status(e.message))};req.onerror=()=>status('Не удалось открыть локальную базу');
