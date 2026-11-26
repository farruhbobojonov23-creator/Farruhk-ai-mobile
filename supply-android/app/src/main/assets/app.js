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
 const value={products:[...products.values()],aliases,byId:products};
 catalogCache={docs,state:catalogState,value};return value;
}
function catalogMatch(r,supplier=r.supplier){
 const c=catalogSnapshot(),key=catalogAPI.aliasKey(supplier,r),known=key&&Object.prototype.hasOwnProperty.call(c.aliases,key)?c.aliases[key]:null;if(known&&c.byId.has(known.productId))return {status:'known',productId:known.productId,variantId:known.variantId};return catalogAPI.resolve(r,supplier,c.products,c.aliases);
}
function catalogTitle(r){const c=catalogSnapshot(),m=catalogMatch(r);return c.byId.get(m.productId)?.name||r.name;}
function variantKey(r){const m=catalogMatch(r);return m.variantId||catalogAPI.aliasKey(r.supplier,r)||originalProductKey(r);}
function productLinkDialog(getRow,getSupplier,onSaved=()=>{},suggestedId=null){
 if(catalogStorageError)throw Error(catalogStorageError);
 const r=getRow(),supplier=getSupplier();if(!r.name||!supplier)throw Error('Сначала укажите товар и поставщика');
 const c=catalogSnapshot(),m=catalogMatch(r,supplier),dlg=node('dialog',null,'catalog-dialog');
 dlg.append(node('h2','Связать с ингредиентом'),node('p',r.name,'muted'),node('small',supplier));
 const choice=node('select');choice.setAttribute('aria-label','Ингредиент');
 const fresh=node('option','Создать отдельный ингредиент');fresh.value='';choice.append(fresh);
 const preferred=new Set([...catalogAPI.suggest(r.name,c.products).map(s=>s.productId),...(suggestedId?[suggestedId]:[])]);
 const sorted=c.products.slice().sort((a,b)=>Number(preferred.has(b.id))-Number(preferred.has(a.id))||a.name.localeCompare(b.name,'ru'));
 for(const p of sorted){const opt=node('option',(preferred.has(p.id)?'★ ':'')+p.name);opt.value=p.id;choice.append(opt);}
 choice.value=suggestedId&&c.products.some(p=>p.id===suggestedId)?suggestedId:m.status==='known'?m.productId:'';
 const label=node('label','Ингредиент');label.append(choice);dlg.append(label);if(suggestedId)dlg.append(node('p','Проверьте бренд, сорт, размер, обработку и фасовку. Связывайте только сопоставимые продукты.','muted'));
 const title=node('input');title.value=r.name.replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim();
 title.setAttribute('aria-label','Название нового ингредиента');const newLabel=node('label','Название новой карточки');newLabel.append(title);dlg.append(newLabel);
 const key=catalogAPI.aliasKey(supplier,r),vid=m.variantId||'variant:'+key;
 const existing=catalogState.quality[vid]||{};
 const quality=node('input'),yieldInput=node('input');quality.type=yieldInput.type='number';quality.min='1';quality.max='10';quality.step='.1';yieldInput.min='.1';yieldInput.max='100';yieldInput.step='.1';quality.value=existing.rating??'';yieldInput.value=existing.yieldPct??'';
 for(const [caption,control] of [['Качество (1–10, необязательно)',quality],['Фактический выход, % (необязательно)',yieldInput]]){const lab=node('label',caption);lab.append(control);dlg.append(lab);}
 const losses={};for(const [key,caption] of [['glazePct','Глазурь, %'],['thawPct','Потери при разморозке, %'],['trimPct','Потери при зачистке, %']]){
  const input=node('input');input.type='number';input.min='0';input.max='99.9';input.step='.1';input.value=existing[key]??'';const lab=node('label',caption+' (необязательно)');lab.append(input);dlg.append(lab);losses[key]=input;
 }
 const note=node('textarea');note.value=existing.note||'';note.maxLength=500;note.rows=2;note.style.cssText='width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:10px';const nl=node('label','Комментарий по качеству');nl.append(note);dlg.append(nl);
 const fav=node('select');for(const [value,label] of [['no','Нет'],['yes','Да']]){const o=node('option',label);o.value=value;fav.append(o);}fav.value=existing.favorite?'yes':'no';const fl=node('label','Избранный товар поставщика');fl.append(fav);dlg.append(fl);
 dlg.append(node('small','Потери указываются отдельно по вашим замерам. Стоимость после обработки считается только по подтверждённому фактическому выходу.','muted'));
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
   const measured={};for(const [key,input] of Object.entries(losses)){const value=input.value===''?null:Number(input.value);if(value!==null&&(!Number.isFinite(value)||value<0||value>=100))throw Error('Потери должны быть от 0 до 99,9%');measured[key]=value;}
   saveCatalog({...catalogState,products,aliases,quality:{...catalogState.quality,[vid]:{...existing,rating,yieldPct,...measured,note:note.value.trim(),favorite:fav.value==='yes'}}});dlg.close();onSaved();
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
 if(quality.favorite)parts.push('★ Избранное');if(quality.rating!=null)parts.push('★ '+fmt(quality.rating)+'/10');for(const [key,label] of [['glazePct','Глазурь'],['thawPct','Разморозка'],['trimPct','Зачистка']])if(quality[key]!=null)parts.push(label+' '+fmt(quality[key])+'%');if(quality.note)parts.push(quality.note);
 if(quality.yieldPct!=null){parts.push('Выход '+fmt(quality.yieldPct)+'%');const p=quotePrice(r);if(p!=null&&quoteUnit(r)==='кг')parts.push('После обработки '+rub(p/(quality.yieldPct/100))+'/кг');}
 return parts.join(' · ');
}

function node(tag,txt,cls){const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n}
function status(s,ok=false){$('status').textContent=s;$('status').classList.toggle('ok',ok)}
function button(txt,fn){const n=node('button',txt);n.type='button';n.onclick=()=>Promise.resolve().then(fn).catch(e=>status(e.message));return n}
function row(parent,title,subtitle,right){const r=node('div',null,'row'),l=node('div');l.append(node('strong',title),node('br'),node('small',subtitle));r.append(l,right);parent.append(r);return r}
function empty(parent,txt){parent.append(node('p',txt,'empty'))}
function go(id){if(!$('entry').classList.contains('hide')&&id!=='entry'&&dirty&&!confirm('Выйти без сохранения?'))return;for(const v of sections)$(v).classList.toggle('hide',v!==id);document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===(id==='entry'?'invoices':id)));if(id!=='entry'){dirty=false;ocrId=null;scanBusy=false;render(id)}window.scrollTo(0,0)}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='entry'){reset();go('entry')}else {if(b.dataset.go==='invoices')supplierFilter=null;go(b.dataset.go)}});
function tx(mode,fn){return new Promise((resolve,reject)=>{if(!db){reject(Error('База ещё не открыта'));return}const t=db.transaction('invoices',mode),r=fn(t.objectStore('invoices'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error||r.error);t.onabort=()=>reject(t.error||Error('Сохранение отменено'))})}
async function refresh(){docs=await tx('readonly',s=>s.getAll());render()}
// Only reuse a unique, previously confirmed weight for the same supplier and product.
const packUnits=['шт','уп','кор'];
const productIdentity=s=>norm(s).replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim();
let packIndexCache=null;
function packIndex(history){
 if(packIndexCache?.history===history)return packIndexCache.index;
 const index=new Map();
 const put=(key,row)=>{if(!index.has(key))index.set(key,[]);index.get(key).push(row)};
 for(const d of history)if(d.simpleVersion===1)for(const l of d.lines||[]){
  const key=[supplierKey(d.supplierId),l.unit];
  if(l.article)put(JSON.stringify([...key,'article',String(l.article)]),l);
  put(JSON.stringify([...key,'name',productIdentity(l.name)]),l);
 }
 packIndexCache={history,index};return index;
}
function knownPack(data,supplier,history=docs,field='packKg'){
 if(!packUnits.includes(data.unit)||!norm(supplier)||!data.name)return null;
 const parser=window.supplyInvoiceParser,explicit=field==='packKg'?parser.packWeight(data.name):parser.packVolume(data.name);
 const index=packIndex(history),key=[supplierKey(supplier),data.unit];
 const byName=index.get(JSON.stringify([...key,'name',productIdentity(data.name)]))||[];
 const matches=data.article?[...(index.get(JSON.stringify([...key,'article',String(data.article)]))||[]),...byName.filter(l=>!l.article)]:byName;
 const weights=[...new Set(matches.map(l=>numeric(l[field])).filter(Boolean))];
 if(weights.length!==1||explicit&&Math.abs(explicit-weights[0])>.000001)return null;
 return weights[0];
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
// Learn only from a saved invoice with an explicitly corrected OCR label.
let correctionCache=null;
function correctionFor(raw,supplier,article,history=docs){
 if(!raw||!supplier)return null;
 if(correctionCache?.history!==history){
  const index=new Map();
  for(const d of history){if(d.simpleVersion!==1)continue;for(const r of d.lines||[]){
   if(!r.ocrOriginalName||!r.name||norm(r.ocrOriginalName)===norm(r.name))continue;
   const k=JSON.stringify([supplierKey(d.supplierId),norm(r.ocrOriginalName),String(r.ocrOriginalArticle||'')]);
   if(!index.has(k))index.set(k,new Set());index.get(k).add(r.name);
  }}
  correctionCache={history,index};
 }
 const found=correctionCache.index.get(JSON.stringify([supplierKey(supplier),norm(raw),String(article||'')]));
 return found?.size===1?[...found][0]:null;
}
function lineData(f){
 const value=k=>f.querySelector('[data-field='+k+']').value;
 return {name:value('name').trim(),price:numeric(value('price')),quantity:numeric(value('quantity')),unit:value('unit'),packKg:value('packMeasure')==='кг'?numeric(value('packKg')):null,packL:value('packMeasure')==='л'?numeric(value('packKg')):null,article:f.dataset.article||undefined,ocrOriginalName:f.dataset.ocrOriginalName||undefined,ocrOriginalArticle:f.dataset.ocrOriginalArticle||undefined,invoiceTotal:numeric(f.dataset.invoiceTotal),netPrice:numeric(f.dataset.netPrice),pageKey:f.dataset.pageKey||undefined,sourceRow:f.dataset.sourceRow||undefined,invoiceWeightKg:numeric(f.dataset.invoiceWeightKg)};
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
 if(m.basis==='шт'){if(m.totalPieces!=null&&l.unit!=='шт')parts.push('Всего '+fmt(m.totalPieces)+' шт');if(m.pricePerPiece!=null)parts.push(rub(m.pricePerPiece)+'/шт');}if(l.invoiceWeightKg&&(!m.totalKg||Math.abs(l.invoiceWeightKg-m.totalKg)>.000001))parts.push('Вес по накладной '+fmt(l.invoiceWeightKg)+' кг');if(m.totalPrice!==null)parts.push('Сумма '+rub(m.totalPrice));
 return parts.join(' · ');
}
function addLine(data={}){
 data=grossRow(data);
 const f=node('div',null,'line');if(data.ocrOriginalName){f.dataset.ocrOriginalName=data.ocrOriginalName;if(data.ocrOriginalArticle)f.dataset.ocrOriginalArticle=data.ocrOriginalArticle;}if(data.uncertain)f.classList.add('uncertain');if(data.article)f.dataset.article=String(data.article);if(data.pageKey)f.dataset.pageKey=data.pageKey;if(data.sourceRow)f.dataset.sourceRow=String(data.sourceRow);if(numeric(data.invoiceWeightKg))f.dataset.invoiceWeightKg=String(data.invoiceWeightKg);if(numeric(data.invoiceTotal))f.dataset.invoiceTotal=String(numeric(data.invoiceTotal));if(numeric(data.netPrice))f.dataset.netPrice=String(data.netPrice);
 function field(key,title,value,placeholder){const wrap=node('label',title),i=node('input');i.dataset.field=key;i.placeholder=placeholder||'';i.value=value==null?'':String(value);if(key!=='name')i.inputMode='decimal';i.setAttribute('aria-label',title);wrap.append(i);return {wrap,i}}
 const a=field('name','Название товара',data.name,'Название товара'),p=field('price','Цена за уп., ₽',data.price,'0,00'),q=field('quantity','Количество',data.quantity,'—'),w=field('packKg','Фасовка, кг',data.packKg??data.packL,'—');
 a.i.value=data.name||'';a.i.required=p.i.required=true;
 const measure=node('select');measure.dataset.field='packMeasure';measure.setAttribute('aria-label','Единица фасовки');for(const k of ['кг','л']){const o=node('option',k);o.value=k;measure.append(o)}measure.value=data.packL&&!data.packKg?'л':'кг';const packControls=node('div',null,'qty-controls');packControls.append(w.i,measure);w.wrap.append(packControls);w.wrap.firstChild.nodeValue='Фасовка';
 const u=node('select');u.dataset.field='unit';u.setAttribute('aria-label','Единица накладной');
 for(const k of ['','шт','уп','кор','кг','г','л','мл']){const o=node('option',k||'Не указана');o.value=k;u.append(o)}u.value=data.unit||((data.name||'').match(/\s*\/\s*(кг|г|л|мл|шт|уп|кор)(?:\s+\(без НДС\))?$/i)?.[1]||'');
 q.wrap.classList.add('quantity-cell');const qtyControls=node('div',null,'qty-controls');qtyControls.append(q.i,u);q.wrap.append(qtyControls);
 const del=button('×',()=>{f.remove();dirty=true});del.setAttribute('aria-label','Удалить товар');del.classList.add('line-delete');
 function computed(title,cls){const box=node('div',null,'computed-cell '+cls),out=node('output','—');box.append(node('span',title,'cell-caption'),out);return {box,out}}
 const weight=computed('Общий вес','line-summary'),kgPrice=computed('Цена за кг','kg-price'),total=computed('Общая стоимость','line-total');const weightNote=node('small','','muted');weight.box.append(weightNote);
 function recalc(){const l=lineData(f),m=grossMetrics(l);f.classList.toggle('line-invalid',!!l.name&&l.price===null);const pack=packUnits.includes(l.unit),piece=m.basis==='шт',volume=m.basis==='л';w.i.disabled=measure.disabled=!pack;w.wrap.style.background=needsPack(l)?'#fff1b8':'';const basis=' с НДС';p.wrap.firstChild.nodeValue=(piece&&l.unit==='шт'?'Цена за шт.':pack?'Цена за уп.':l.unit==='кг'?'Цена за кг':l.unit==='л'?'Цена за л':'Цена за ед.')+basis+', ₽';p.i.setAttribute('aria-label',p.wrap.firstChild.nodeValue);const per=m.piecesPerPack;q.wrap.firstChild.nodeValue=piece&&per&&l.unit==='шт'&&m.totalPieces!=null?'Количество ('+fmt(per)+' шт./кор.)':'Количество';weight.box.firstChild.textContent=piece?'Общее количество':volume?'Общий объём':'Общий вес';kgPrice.box.firstChild.textContent=(piece?'Цена за шт.':volume?'Цена за л':'Цена за кг')+basis;const qty=piece?m.totalPieces:volume?m.totalL:m.totalKg,price=piece?m.pricePerPiece:volume?m.pricePerL:m.pricePerKg;weight.out.textContent=qty==null?'—':fmt(qty)+' '+(piece?'шт.':volume?'л':'кг');const printed=l.invoiceWeightKg,nominal=pack?window.supplyInvoiceParser.packWeight(l.name):null;weightNote.textContent=printed&&(!m.totalKg||Math.abs(printed-m.totalKg)>.000001)?'Вес по накладной: '+fmt(printed)+' кг (отдельно)':nominal&&l.packKg&&Math.abs(nominal-l.packKg)>.000001?'В названии указано '+fmt(nominal)+' кг — проверьте фасовку':'';weightNote.style.display=weightNote.textContent?'block':'none';if(piece&&per&&qty!=null&&l.unit==='шт'&&qty%per===0)weight.out.textContent+=' · '+fmt(qty/per)+' кор.';kgPrice.out.textContent=price==null?'—':rub(price);total.out.textContent=m.totalPrice==null?'—':rub(m.totalPrice);total.out.title=l.invoiceTotal?'Сумма к оплате из накладной':'Расчёт по количеству и цене с НДС';}
 function fillMissingPack(){if(!packUnits.includes(u.value)||numeric(w.i.value))return;const parser=window.supplyInvoiceParser,mass=parser.packWeight(a.i.value),volume=parser.packVolume(a.i.value),savedMass=knownPack(lineData(f),$('supplier').value),savedVolume=knownPack(lineData(f),$('supplier').value,docs,'packL');if(mass||volume||savedMass&&!savedVolume||savedVolume&&!savedMass){measure.value=mass||!volume&&savedMass?'кг':'л';w.i.value=mass||volume||savedMass||savedVolume;w.i.title=mass||volume?'Из названия товара':'Из ранее подтверждённой накладной';}}
 measure.addEventListener('change',()=>{w.i.value='';w.i.title='';recalc()});
 a.i.addEventListener('change',()=>{delete f.dataset.article;fillMissingPack();recalc()});
 u.addEventListener('change',()=>{fillMissingPack();recalc()});
 w.i.addEventListener('input',()=>{w.i.title='';});
 for(const input of [p.i,q.i])input.addEventListener('input',()=>{delete f.dataset.invoiceTotal;delete f.dataset.netPrice;if(input===q.i)delete f.dataset.invoiceWeightKg;});
 f.addEventListener('input',recalc);u.addEventListener('change',()=>{delete f.dataset.invoiceTotal;delete f.dataset.netPrice;delete f.dataset.invoiceWeightKg;recalc()});
 if(data.source)f.title=data.source;
 const badge=button('',()=>productLinkDialog(()=>lineData(f),()=>$('supplier').value,()=>catalogBadge(f)));badge.className='catalog-badge hide';
 const learned=f.dataset.ocrOriginalName&&norm(a.i.value)===norm(f.dataset.ocrOriginalName)?correctionFor(f.dataset.ocrOriginalName,$('supplier').value,f.dataset.ocrOriginalArticle):null;
 const suggestion=learned?button('Подсказка: '+learned,()=>{a.i.value=learned;delete f.dataset.article;suggestion.remove();recalc();catalogBadge(f);dirty=true;}):null;
 if(suggestion){suggestion.className='catalog-badge review';suggestion.setAttribute('aria-label','Применить сохранённое исправление: '+learned);}
 f.append(a.wrap,del,w.wrap,q.wrap,weight.box,p.wrap,kgPrice.box,total.box,badge);if(suggestion)f.append(suggestion);$('lines').append(f);fillMissingPack();recalc();catalogBadge(f);f.addEventListener('change',()=>catalogBadge(f));
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
function invoiceHeader(raw){
 const text=String(raw||'');
 const found=[...text.matchAll(/(?:реализация|по\s+УПД|УПД|сч[её]т[- ]фактура|накладная|накладной)\s*(?:№|No|N[еe])\s*([a-zа-яё0-9][a-zа-яё0-9/.-]*(?:[ \t]+\d{3,})?)(?:[ \t]+от[ \t]+(\d{1,2})[.\/](\d{1,2})[.\/](\d{4}))?/gi)];
 const ids=[...new Set(found.map(m=>norm(m[1]).replace(/\s+/g,'')))];
 const dates=[...new Set(found.filter(m=>m[4]).map(m=>m[4]+'-'+m[3].padStart(2,'0')+'-'+m[2].padStart(2,'0')).filter(d=>Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d))];
 return {documentNumber:ids.length===1?ids[0]:null,documentDate:dates.length===1?dates[0]:null};
}
function purchaseDate(d){return d.documentDate||d.pages?.find(p=>p.documentDate)?.documentDate||d.date||d.savedAt||''}
function purchaseDay(d){return String(purchaseDate(d)).slice(0,10)}
function dailyPurchases(records){return [...grouped(records,purchaseDay).entries()].map(([day,items])=>({day,count:items.length,total:items.flatMap(linesOf).reduce((s,l)=>s+Math.round((grossMetrics(l).totalPrice||0)*100),0)/100})).sort((a,b)=>b.day.localeCompare(a.day))}
function sameDocument(a,b){return !!(a.documentNumber&&b.documentNumber&&norm(a.documentNumber).replace(/\s+/g,'')===norm(b.documentNumber).replace(/\s+/g,'')&&supplierKey(a.supplierId)===supplierKey(b.supplierId)&&(!a.documentDate||!b.documentDate||a.documentDate===b.documentDate))}
function pageMeta(r,raw){
 const text=String(raw||'');
 const header=invoiceHeader(text);
 const page=text.match(/(?:стр\.|страница|cmp\.)\s*([1-9]\d*|I)\s*(?:из|u3)\s*(\d+)/i);
 const number=r.pageInfo?.page|| (page?(page[1].toUpperCase()==='I'?1:Number(page[1])):null);
 const expected=r.pageInfo?.pages|| (page?Number(page[2]):null);
 return {...header,number,expected};
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
 const currentNumber=norm($('documentNumber').value).replace(/\s+/g,'');
 if(others.length&&meta.documentNumber&&(currentNumber&&meta.documentNumber!==currentNumber||others.some(p=>p.documentNumber&&meta.documentNumber!==p.documentNumber)))throw Error('Другой номер накладной. Нажмите «Сохранить и следующая накладная».');
 if(others.some(p=>meta.documentDate&&p.documentDate&&meta.documentDate!==p.documentDate))throw Error('Другая дата накладной. Сохраните текущую и начните следующую.');
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
 if(meta.documentNumber&&!$('documentNumber').value)$('documentNumber').value=meta.documentNumber.toUpperCase();
 if(meta.documentDate&&!$('documentDate').value)$('documentDate').value=meta.documentDate;
 for(const [i,l] of r.items.entries())addLine({...l,ocrOriginalName:l.name,ocrOriginalArticle:l.article||undefined,pageKey:key,sourceRow:r.documentVerified&&l.article?String(i+1):undefined});
 const record={...meta,key,file,identity,fingerprint,expectedTotal:r.documentVerified&&r.items.every(l=>numeric(l.invoiceTotal))?r.items.reduce((s,l)=>s+Math.round(l.invoiceTotal*100),0)/100:null,reviewRequired:!r.documentVerified&&!r.pageVerified};
 if(previous)pages=pages.map(p=>p.key===key?record:p);else pages.push(record);
 activePage=key;pendingPhoto=null;pageStatus();return true;
}

function numeric(s){const n=Number(String(s).replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>0?n:null}
function dateLabel(d){const iso=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(iso)return iso[3]+'.'+iso[2]+'.'+iso[1];const v=new Date(d);return Number.isFinite(v.getTime())?v.toLocaleDateString('ru-RU'):''}
function linesOf(d){if(d.simpleVersion===1)return Array.isArray(d.lines)?d.lines.map(grossRow):[];if(d.status!=='confirmed')return [];return (d.lines||[]).flatMap(l=>{try{const p=window.supplyAnalytics.linePrice(l);return [{name:l.productId+' / '+p.unit+' (с НДС)',price:p.price}]}catch{return []}})}
function supplierKey(s){
 return norm(s).replace(/^общество с ограниченной ответственностью\s+/, 'ооо ').replace(/[«»"“”]/g,'').replace(/\s+/g,' ').trim();
}
let observationsCache=null;function observations(){if(observationsCache?.docs===docs)return observationsCache.rows;const rows=docs.flatMap(d=>linesOf(d).filter(l=>l.name&&numeric(l.price)).map(l=>({...l,name:l.name,price:Number(l.price),unit:l.unit||'',packKg:l.packKg||null,packL:l.packL||null,supplier:d.supplierId,date:purchaseDate(d),docId:d.id}))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));observationsCache={docs,rows};return rows;}
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


function visionOptions(select,entries){
 const previous=select.value;
 select.replaceChildren();
 if(!entries.length){const o=node('option','Нет данных');o.value='';select.append(o);select.disabled=true;return;}
 select.disabled=false;
 for(const [key,label] of entries){const o=node('option',label);o.value=key;select.append(o);}
 if(entries.some(x=>x[0]===previous))select.value=previous;
}
function visionComparable(r,afterYield){
 const price=quotePrice(r),unit=quoteUnit(r);
 if(!(price>0)||!unit)return null;
 if(!afterYield)return price;
 const y=catalogState.quality[variantKey(r)]?.yieldPct;
 return unit==='кг'&&Number.isFinite(y)&&y>0&&y<=100?price/(y/100):null;
}
function renderVision(period,last){
 const afterYield=$('visionBasis').value==='yield';
 const groups=[...grouped(last,productKey).entries()].filter(([,rs])=>rs.every(r=>quoteUnit(r)===quoteUnit(rs[0]))&&new Set(rs.map(r=>supplierKey(r.supplier))).size>=2);
 visionOptions($('visionProduct'),groups.map(([k,rs])=>[k,catalogTitle(rs[0])+' · '+quoteUnit(rs[0])]));
 const offer=$('visionOffers');offer.replaceChildren();
 const selected=groups.find(([k])=>k===$('visionProduct').value)?.[1]||[];
 const valid=selected.map(r=>({r,p:visionComparable(r,afterYield)})).filter(x=>x.p!==null).sort((a,b)=>a.p-b.p);
 if(valid.length<2)empty(offer,afterYield?'Нужны подтверждённые значения выхода минимум у двух поставщиков одного товара (₽/кг).':'Добавьте сопоставимый товар у двух поставщиков.');
 else{
  const best=valid[0].p,max=valid.at(-1).p;
  for(const {r,p} of valid){
   const box=node('div',null,'vision-offer'+(p===best?' best':''));
   row(box,r.supplier,dateLabel(r.date),node('strong',rub(p)+'/'+quoteUnit(r),'price'));
   const bar=node('div',null,'offer-bar'),fill=node('i');fill.style.width=100*p/max+'%';fill.className=p===best?'best':'';bar.append(fill);box.append(bar,node('small',p===best?'Лучшая из известных цен':'+'+fmt(Math.round((p/best-1)*1000)/10)+'% к лучшей'));offer.append(box);
  }
  if(valid.length<selected.length)offer.append(node('small','Не учтено предложений без подтверждённого выхода: '+(selected.length-valid.length),'muted'));
  offer.append(node('small','Последние известные цены с НДС. Не текущие коммерческие предложения.','muted'));
 }
 const ranking=$('supplierQuality');ranking.replaceChildren();
 // Ratings are manual and each variant counts only once. Unrated suppliers are not scored.
 const rated=last.filter(r=>Number.isFinite(catalogState.quality[variantKey(r)]?.rating));
 const results=[...grouped(rated,r=>supplierKey(r.supplier)).values()].map(rs=>({name:rs[0].supplier,count:rs.length,score:rs.reduce((s,r)=>s+catalogState.quality[variantKey(r)].rating,0)/rs.length})).sort((a,b)=>b.score-a.score);
 for(const r of results){row(ranking,r.name,r.count+' оценённых вариантов',node('strong',fmt(Math.round(r.score*10)/10)+'/10','price'));const bar=node('div',null,'offer-bar'),fill=node('i');fill.style.width=r.score*10+'%';bar.append(fill);ranking.append(bar);}
 if(!results.length)empty(ranking,'Пока нет оценок качества. Добавьте их в карточках товаров.');
 else ranking.append(node('small','Среднее ручных оценок товаров. Не рейтинг надёжности поставок.','muted'));
}

const POINTS={baumana:'Баумана 18',plasma:'Плазма',heroes:'Героев Североморцев',polyar:'Полярные Зори'};
function pointLabel(d){return Object.prototype.hasOwnProperty.call(POINTS,d.pointId)?POINTS[d.pointId]:'Не указана';}
function priceStats(rows){
 const vals=rows.map(quotePrice);if(!vals.length||!quoteUnit(rows[0])||!rows.every((r,i)=>quoteUnit(r)===quoteUnit(rows[0])&&Number.isFinite(vals[i])&&vals[i]>0))return null;
 return {min:Math.min(...vals),max:Math.max(...vals),mean:vals.reduce((s,n)=>s+n,0)/vals.length,change:(vals.at(-1)/vals[0]-1)*100,unit:quoteUnit(rows[0]),count:vals.length};
}
function renderPriceAlerts(trends){
 const el=$('priceAlerts');el.replaceChildren();const threshold=Number($('alertThreshold').value);
 const changes=trends.map(([a,b])=>({a,b,s:priceStats([a,b])})).filter(x=>x.s&&x.s.change>=threshold-1e-8).sort((a,b)=>b.s.change-a.s.change);
 for(const {a,b,s} of changes)row(el,catalogTitle(b),b.supplier+' · '+historyPrice(a)+' → '+historyPrice(b),node('strong','+'+fmt(Math.round(s.change*10)/10)+'%','up'));
 if(!changes.length)empty(el,'Нет подтверждённого роста выше выбранного порога за период.');
}
function periodRecords(now=new Date(),days=Number($('period').value)||0){
 const local=new Date(now.getTime()-now.getTimezoneOffset()*60000),today=local.toISOString().slice(0,10);local.setUTCDate(local.getUTCDate()-Math.max(0,days-1));const start=local.toISOString().slice(0,10);
 return docs.filter(d=>{const day=purchaseDay(d);return !days||(day>=start&&day<=today);});
}
function reportRecords(){
 const point=$('reportPoint').value;
 return periodRecords().filter(d=>!point||(point==='unassigned'?pointLabel(d)==='Не указана':d.pointId===point));
}
function reportTable(records){
 const rows=[['Дата','Накладная','Точка','Поставщик','Товар','Количество','Ед.','Цена с НДС за сопоставимую ед.','Ед. цены','Сумма с НДС']];
 for(const d of records)for(const r of linesOf(d)){const total=grossMetrics(r).totalPrice;rows.push([purchaseDay(d),d.documentNumber||'',pointLabel(d),d.supplierId||'',r.name,r.quantity??'',r.unit||'',quotePrice(r)??'',quoteUnit(r),total??'']);}
 return rows;
}
// CSV fields from invoices are not trusted spreadsheet formulas.
function reportCsv(rows){
 const cell=v=>{let s=typeof v==='number'?String(v).replace('.',','):String(v??'');if(typeof v!=='number'&&/^[\s\uFEFF]*[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 return '\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
}
function reportDialog(){
 const records=reportRecords();if(!records.length){status('Нет накладных для отчёта');return;}
 const rows=reportTable(records),known=records.flatMap(linesOf).map(r=>grossMetrics(r).totalPrice).filter(v=>v!=null),total=known.reduce((s,v)=>s+Math.round(v*100),0)/100;
 const dlg=node('dialog',null,'catalog-dialog'),summary=['FARUKH SUPPLY — отчёт по закупкам','Период: '+$('period').selectedOptions[0].textContent,'Точка: '+$('reportPoint').selectedOptions[0].textContent,'Накладных: '+records.length,'Позиций: '+(rows.length-1),'Сумма с НДС: '+(known.length?rub(total):'не определена'),'Без суммы: '+(rows.length-1-known.length),'',...Array.from(grouped(records,d=>d.supplierId||'Без поставщика'),([name,ds])=>{const v=ds.flatMap(linesOf).map(r=>grossMetrics(r).totalPrice).filter(x=>x!=null);return name+' — '+(v.length?rub(v.reduce((s,x)=>s+Math.round(x*100),0)/100):'сумма не определена');})].join('\n');
 dlg.append(node('h2','Отчёт по закупкам'));const area=node('textarea');area.readOnly=true;area.value=summary;area.rows=12;area.style.cssText='width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:10px';dlg.append(area,button('Выделить текст',()=>{area.focus();area.select();area.setSelectionRange(0,area.value.length);}));
 if(location.origin!=='https://appassets.androidplatform.net'){
  dlg.append(button('Скачать CSV для Excel',()=>{const url=URL.createObjectURL(new Blob([reportCsv(rows)],{type:'text/csv;charset=utf-8'})),a=node('a');a.href=url;a.download='FARUKH-SUPPLY-report.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}));
 }else dlg.append(node('small','Текст можно скопировать. Сохранение файлов и системная печать PDF на Android требуют обновления встроенного модуля.','muted'));
 dlg.append(button('Закрыть',()=>dlg.close()));dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
}
$('reportOpen').onclick=reportDialog;
function renderPurchaseReport(history){
 const el=$('purchaseReport');el.replaceChildren();const point=$('reportPoint').value;
 const records=reportRecords();
 const lines=records.flatMap(linesOf),known=lines.map(r=>grossMetrics(r).totalPrice).filter(x=>x!=null);
 const total=known.reduce((s,x)=>s+Math.round(x*100),0)/100;
 row(el,'Сумма с НДС',records.length+' накладных · '+lines.length+' позиций',node('strong',known.length?rub(total):'—','price'));
 if(known.length<lines.length)el.append(node('small','Не включено позиций без суммы: '+(lines.length-known.length),'muted'));
 for(const [name,ds] of grouped(records,pointLabel))row(el,name,ds.length+' накладных',node('strong',rub(ds.flatMap(linesOf).reduce((s,r)=>s+Math.round((grossMetrics(r).totalPrice||0)*100),0)/100),'price'));
 if(!records.length)empty(el,'Нет накладных за выбранный период и точку.');
}
function renderDashboard(obs,last){
 const history=periodRecords(),ids=new Set(history.map(d=>d.id));
 const period=obs.filter(r=>ids.has(r.docId));
 const totals=history.flatMap(d=>linesOf(d)).map(r=>grossMetrics(r).totalPrice).filter(x=>x!=null);
 const total=totals.reduce((s,x)=>s+x,0);
 $('spend').textContent=totals.length?rub(total):'—';
 $('periodPositions').textContent=period.length;
 $('productCount').textContent=new Set(period.map(productKey)).size;
 $('supplierCount').textContent=new Set(history.map(d=>supplierKey(d.supplierId)).filter(Boolean)).size;
 const by=grouped(last,productKey),offers=[...by.values()].filter(x=>new Set(x.map(r=>supplierKey(r.supplier))).size>1&&x.every(r=>quotePrice(r)>0&&quoteUnit(r)));
 const trends=[...grouped(obs,r=>variantKey(r)).values()].filter(x=>x.length>1).map(x=>[x.at(-2),x.at(-1)]).filter(x=>ids.has(x[1].docId));
 $('upCount').textContent=trends.filter(([a,b])=>(priceStats([a,b])?.change||0)>0).length;
 $('downCount').textContent=trends.filter(([a,b])=>(priceStats([a,b])?.change||0)<0).length;renderPriceAlerts(trends);renderPurchaseReport(history);
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
 const series=[...grouped(period,variantKey).values()].filter(x=>x.length>1&&x.every(r=>quotePrice(r)>0&&quoteUnit(r)===quoteUnit(x[0]))).sort((a,b)=>String(b.at(-1).date).localeCompare(String(a.at(-1).date)));visionOptions($('trendSelect'),series.map(x=>[variantKey(x[0]),catalogTitle(x[0])+' · '+x[0].supplier]));const selectedSeries=series.find(x=>variantKey(x[0])===$('trendSelect').value)||series[0];
 const stats=$('priceStats');stats.replaceChildren();const s=selectedSeries&&priceStats(selectedSeries);if(s){for(const [label,val] of [['Минимум',s.min],['Максимум',s.max],['Средняя цена (по закупкам)',s.mean]])row(stats,label,s.count+' наблюдений',node('strong',rub(val)+'/'+s.unit,'price'));row(stats,'Изменение за период','Первая → последняя цена',node('strong',(s.change>0?'+':'')+fmt(Math.round(s.change*10)/10)+'%',s.change>0?'up':'down'));}if(!series.length)empty(trend,'График появится после повторной закупки.');
 else{const x=selectedSeries.slice(-10),vals=x.map(quotePrice),min=Math.min(...vals),max=Math.max(...vals),points=vals.map((v,i)=>[12+i*276/(vals.length-1),92-(v-min)*72/(max-min||1)]);trend.append(node('strong',catalogTitle(x[0])),node('small',x[0].supplier+' · '+historyPrice(x.at(-1))));const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 300 108');svg.setAttribute('role','img');svg.setAttribute('aria-label','Динамика цены от '+rub(vals[0])+' до '+rub(vals.at(-1)));const line=document.createElementNS(ns,'polyline');line.setAttribute('points',points.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#6935de');line.setAttribute('stroke-width','3');svg.append(line);points.forEach(([x,y])=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','4');dot.setAttribute('fill','#6935de');svg.append(dot);});trend.append(svg,node('small',dateLabel(x[0].date)+' — '+dateLabel(x.at(-1).date)+' · '+rub(vals[0])+' → '+rub(vals.at(-1))));}
}

// Suggestions are derived, never written until a user explicitly confirms.
function matchCandidates(last){
 const catalog=catalogSnapshot(),byId=new Map();
 for(const r of last){const id=catalogMatch(r).productId;if(!id)continue;if(!byId.has(id))byId.set(id,[]);byId.get(id).push(r);}
 const result=[],seen=new Set(),supplierSets=new Map();
 for(const [id,rows] of byId)supplierSets.set(id,new Set(rows.map(r=>supplierKey(r.supplier))));
 for(const [id,rows] of byId){
  const r=rows[0],unit=quoteUnit(r);if(!unit||!(quotePrice(r)>0))continue;
  const own=supplierSets.get(id);
  for(const hint of catalogAPI.suggest(r.name,catalog.products)){
   if(hint.productId===id||hint.score<.35)continue;
   const others=byId.get(hint.productId)||[];
   const t=others.find(x=>quoteUnit(x)===unit&&quotePrice(x)>0&&!own.has(supplierKey(x.supplier)));
   if(!t)continue;
   const pair=JSON.stringify([id,hint.productId].sort());if(seen.has(pair))continue;seen.add(pair);
   result.push({r,t,target:hint.productId,score:hint.score});
  }
 }
 return result.sort((a,b)=>b.score-a.score||a.r.name.localeCompare(b.r.name,'ru'));
}
// Category labels are presentation-only and never merge identities or modify invoice records.
function categoryFor(name){
 const s=norm(name).replace(/ё/g,'е');
 for(const [label,pattern] of [
  ['Рыба и морепродукты',/кревет|лосос|форел|семг|тун[е]?ц|тунц|угор|угр[яь]|миди|кальмар|краб|осьминог|гребеш|икра|масаго|тобико/],
  ['Рис, лапша и нори',/\b(?:rice|nori)\b|рис(?:\s|$)|лапш|нори|удон|соба|фунчоз/],
  ['Молочные продукты и яйца',/сыр|сливки|маскарпоне|молоко|яйц|омлет|творог/],
  ['Овощи и фрукты',/огур|авокад|лимон|манго|морков|капуст|картоф|салат|такуан|лук|помидор/],
  ['Соусы и специи',/соус|майонез|васаби|имбир|кунжут|уксус|масло|сахар|соль|спайси|маринад|паниров/],
  ['Мясо и птица',/куриц|курин|говядин|свинин|индей|бекон/],
  ['Упаковка и расходники',/контейнер|салфет|пакет|палочки|перчат|стакан|пленк|крышк|упаковоч/]
 ])if(pattern.test(s))return label;
 return 'Прочее';
}
function renderMatchCandidates(last){
 const list=$('matchList');list.replaceChildren();
 const matches=matchCandidates(last),query=norm($('search').value);
 const filtered=matches.filter(x=>!query||norm(x.r.name+' '+x.t.name).includes(query));
 $('matchCard').classList.toggle('hide',!filtered.length);
 $('matchShortcut').classList.toggle('hide',!matches.length);
 $('matchShortcut').textContent='Сопоставить похожие товары · '+matches.length;
 for(const {r,t,target} of filtered.slice(0,12)){
  const box=node('div',null,'tip');
  box.append(node('strong',r.name),node('p',r.supplier+' · '+historyPrice(r)),node('strong',t.name),node('p',t.supplier+' · '+historyPrice(t)));
  const action=button('Проверить и связать',()=>productLinkDialog(()=>r,()=>r.supplier,render,target));action.classList.add('catalog-action');box.append(action);list.append(box);
 }
 if(filtered.length>12)list.append(node('small','Показаны первые 12. Для остальных используйте поиск.','muted'));
}
function supplierProfile(key){return Object.prototype.hasOwnProperty.call(catalogState.suppliers||{},key)?catalogState.suppliers[key]:{};}
function supplierDialog(key,name){
 const previous=supplierProfile(key),dlg=node('dialog',null,'catalog-dialog');dlg.append(node('h2',name));const fields={};
 for(const [id,label,limit] of [['contact','Контакт / телефон',150],['schedule','Дни и время поставок',200],['minimum','Минимальный заказ, ₽',30],['note','Комментарий',500]]){
  const input=node('input');input.maxLength=limit;input.value=previous[id]??'';if(id==='minimum'){input.type='number';input.min='0';input.step='.01';}const l=node('label',label);l.append(input);dlg.append(l);fields[id]=input;
 }
 const error=node('p','','up');dlg.append(error,button('Сохранить карточку',()=>{
  try{const minimum=fields.minimum.value===''?null:Number(fields.minimum.value);if(minimum!==null&&(!Number.isFinite(minimum)||minimum<0))throw Error('Проверьте сумму заказа');
   const profile={contact:fields.contact.value.trim(),schedule:fields.schedule.value.trim(),minimum,note:fields.note.value.trim()};
   saveCatalog({...catalogState,suppliers:{...catalogState.suppliers,[key]:profile}});dlg.close();render('suppliers');
  }catch(e){error.textContent=e.message;}
 }),button('Отмена',()=>dlg.close()));dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
}
function plannedOrders(){return Array.isArray(catalogState.orders)?catalogState.orders:[];}
function renderOrderList(){
 const el=$('orderList');el.replaceChildren();const orders=plannedOrders();if(!orders.length)return;
 el.append(node('h2','Список закупок'),node('small','Цены зафиксированы при добавлении. Перед заказом уточните актуальность.'));
 for(const [supplier,items] of grouped(orders,x=>x.supplier)){
  const group=node('div',null,'tip');group.append(node('strong',supplier));let total=0;
  for(const x of items){const sum=Math.round(x.quantity*x.price*100)/100;total+=sum;row(group,x.name,fmt(x.quantity)+' '+x.unit+' · '+rub(sum),button('Удалить',()=>{saveCatalog({...catalogState,orders:plannedOrders().filter(o=>o.id!==x.id)});renderOrderList();}));}
  group.append(node('p','Итого: '+rub(total)));const minimum=supplierProfile(supplierKey(supplier)).minimum;if(minimum!=null&&total<minimum)group.append(node('small','До минимального заказа: '+rub(minimum-total),'up'));el.append(group);
 }
 const total=orders.reduce((s,x)=>s+Math.round(x.quantity*x.price*100),0)/100;el.append(node('strong','Общая сумма: '+rub(total)),button('Текст заказа',()=>{
  const dlg=node('dialog',null,'catalog-dialog'),area=node('textarea');area.readOnly=true;area.rows=12;area.style.width='100%';area.value=Array.from(grouped(orders,x=>x.supplier),([s,items])=>s+'\n'+items.map(x=>x.name+' — '+fmt(x.quantity)+' '+x.unit).join('\n')).join('\n\n');dlg.append(node('h2','Список для поставщиков'),area,button('Выделить текст',()=>{area.focus();area.select();}),button('Закрыть',()=>dlg.close()));dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
 }));
}
function renderOrderAdvice(last){
 const groups=[...grouped(last,productKey).entries()].filter(([,rows])=>new Set(rows.map(r=>supplierKey(r.supplier))).size>=2&&rows.every(r=>quoteUnit(r)&&quoteUnit(r)===quoteUnit(rows[0])&&quotePrice(r)>0));
 visionOptions($('orderProduct'),groups.map(([key,rows])=>[key,catalogTitle(rows[0])+' · '+quoteUnit(rows[0])]));
 const el=$('orderAdvice'),add=$('orderAdd');el.replaceChildren();add.classList.add('hide');add.onclick=null;renderOrderList();const rows=groups.find(([key])=>key===$('orderProduct').value)?.[1]||[];
 const qty=Number($('orderQuantity').value);
 if(!rows.length){empty(el,'Нужны сопоставимые цены двух поставщиков.');return;}
 if(!(qty>0&&Number.isFinite(qty))){empty(el,'Введите количество для расчёта.');return;}
 const sorted=rows.slice().sort((a,b)=>quotePrice(a)-quotePrice(b));
 for(const r of sorted)row(el,r.supplier,r.name+' · '+dateLabel(r.date),node('strong',rub(quotePrice(r)*qty),'price '+(r===sorted[0]?'down':'')));
 const best=sorted[0],worst=sorted.at(-1);add.classList.remove('hide');add.onclick=()=>{
  try{const entry={id:crypto.randomUUID(),name:best.name,supplier:best.supplier,unit:quoteUnit(best),price:quotePrice(best),quantity:qty,date:best.date||''};saveCatalog({...catalogState,orders:[...plannedOrders(),entry]});renderOrderList();}
  catch(e){status(e.message);}
 };row(el,'Разница с самым дорогим',fmt(qty)+' '+quoteUnit(best),node('strong',rub((quotePrice(worst)-quotePrice(best))*qty),'down'));
 el.append(node('small','Расчёт по последним известным ценам с НДС, без доставки и минимальных партий. Уточните наличие и цены перед заказом.','muted'));
}
function setupPanels(buttonAttr,panelAttr){const buttons=[...document.querySelectorAll('['+buttonAttr+']')],panels=[...document.querySelectorAll('['+panelAttr+']')];for(const b of buttons)b.onclick=()=>{const id=b.getAttribute(buttonAttr);for(const x of buttons){const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));}for(const p of panels)p.classList.toggle('hide',p.getAttribute(panelAttr)!==id);};}
setupPanels('data-panel','data-home-panel');setupPanels('data-compare','data-compare-panel');
function compactDetails(title){const d=node('details',null,'list-detail');d.append(node('summary',title));return d;}
function render(scope='all'){const obs=observations(),last=latest(obs),products=grouped(last,productKey),suppliers=grouped(last,r=>supplierKey(r.supplier));
const home=scope==='all'||scope==='home',archive=scope==='all'||scope==='invoices',catalog=scope==='all'||scope==='products',supplier=scope==='all'||scope==='suppliers',compare=scope==='all'||scope==='compare';
const ordered=[...docs].sort((a,b)=>String(purchaseDate(b)).localeCompare(String(purchaseDate(a))));
if(home){
$('changes').replaceChildren();const trends=[...grouped(obs,r=>JSON.stringify([variantKey(r),supplierKey(r.supplier)])).values()].filter(s=>s.length>1).map(s=>[s[s.length-2],s[s.length-1]]).filter(([a,b])=>quotePrice(a)!==quotePrice(b)).slice(-6).reverse();for(const [a,b] of trends){const delta=quotePrice(b)-quotePrice(a);row($('changes'),b.name,b.supplier+' · '+historyPrice(a)+' → '+historyPrice(b),node('strong',(delta>0?'+':'−')+rub(Math.abs(delta)),'price '+(delta>0?'up':'down')))}if(!trends.length)empty($('changes'),'Изменения появятся после повторной закупки.');
$('recent').replaceChildren();for(const d of ordered.slice(0,3))row($('recent'),d.supplierId||'Без поставщика',dateLabel(purchaseDate(d)),button('Открыть',()=>{supplierFilter=null;go('invoices')}));if(!ordered.length)empty($('recent'),'Нет накладных');
}
if(archive){$('archive').replaceChildren();const query=norm($('invoiceSearch').value),archiveDocs=(supplierFilter===null?ordered:ordered.filter(d=>supplierKey(d.supplierId)===supplierFilter)).filter(d=>!query||norm([d.supplierId,d.documentNumber,purchaseDay(d),dateLabel(purchaseDate(d)),pointLabel(d),...linesOf(d).map(r=>r.name)].join(' ')).includes(query));if(supplierFilter!==null)$('archive').append(button('Все накладные',()=>{supplierFilter=null;render()}));for(const d of archiveDocs){const c=node('div',null,'card');c.append(node('h2',d.supplierId||'Без поставщика'),node('small',[dateLabel(purchaseDate(d)),d.documentNumber?'№ '+d.documentNumber.toUpperCase():'',d.pointId?pointLabel(d):''].filter(Boolean).join(' · ')));const ls=linesOf(d),known=ls.map(l=>grossMetrics(l).totalPrice).filter(x=>x!=null),sum=known.reduce((s,x)=>s+Math.round(x*100),0)/100;c.append(node('p',ls.length+' поз. · '+(known.length?rub(sum):'Сумма не указана')+(known.length<ls.length?' · неполные суммы':''),'muted'));const detail=compactDetails('Товары · '+ls.length);if(d.simpleVersion!==1)detail.append(node('p','Архив старой версии. Оригинальные данные сохранены.','muted'));for(const l of ls)row(detail,l.name,lineSummary(l),node('strong',historyPrice(l),'price'));c.append(detail);const ctl=node('div',null,'controls');const photos=(d.pages||[]).map(p=>p.file).filter(f=>f?.type?.startsWith('image/'));if(!photos.length&&d.original?.type?.startsWith('image/'))photos.push(d.original);if(photos.length)ctl.append(button(photos.length>1?'Фото ('+photos.length+')':'Фото',()=>{const dlg=node('dialog'),urls=[];for(let i=0;i<photos.length;i++){const url=URL.createObjectURL(photos[i]),img=node('img');urls.push(url);img.src=url;img.style.cssText='max-width:85vw;max-height:70vh;object-fit:contain;display:block';dlg.append(node('p','Фото '+(i+1)+' из '+photos.length),img)}dlg.append(button('Закрыть',()=>dlg.close()));dlg.addEventListener('close',()=>{urls.forEach(u=>URL.revokeObjectURL(u));dlg.remove()},{once:true});document.body.append(dlg);dlg.showModal()}));const pdfOriginal=(d.pages||[]).find(p=>p.file?.type==='application/pdf')?.file||(d.original?.type==='application/pdf'?d.original:null);if(pdfOriginal)ctl.append(node('small','PDF сохранён: '+pdfOriginal.name));if(d.simpleVersion===1){ctl.append(button('Редактировать',()=>edit(d)),button('Удалить',async()=>{if(confirm('Удалить накладную?')){await tx('readwrite',s=>s.delete(d.id));await refresh();status('Удалено',true)}}))}c.append(ctl);$('archive').append(c)}if(!archiveDocs.length)empty($('archive'),'Нет накладных');
}
if(catalog){renderMatchCandidates(last);visionOptions($('categoryFilter'),[['','Все категории'],...[...new Set([...products.values()].map(rs=>categoryFor(catalogTitle(rs[0]))))].sort((a,b)=>a.localeCompare(b,'ru')).map(x=>[x,x])]);$('productList').replaceChildren();for(const offers of [...products.values()].sort((a,b)=>a[0].name.localeCompare(b[0].name,'ru'))){if($('favoriteFilter').value==='favorite'&&!offers.some(r=>catalogState.quality[variantKey(r)]?.favorite))continue;if($('categoryFilter').value&&categoryFor(catalogTitle(offers[0]))!==$('categoryFilter').value)continue;if(!norm(catalogTitle(offers[0])).includes(norm($('search').value))&&!offers.some(r=>norm(r.name).includes(norm($('search').value))))continue;const c=node('div',null,'card');c.append(node('h2',catalogTitle(offers[0])),node('small',categoryFor(catalogTitle(offers[0])),'tag'));const valid=offers.filter(r=>quotePrice(r)>0&&quoteUnit(r)),comparable=valid.length===offers.length&&valid.every(r=>quoteUnit(r)===quoteUnit(valid[0]));if(comparable&&valid.length){const sorted=valid.slice().sort((a,b)=>quotePrice(a)-quotePrice(b));c.append(node('p',historyPrice(sorted[0])+' · '+sorted[0].supplier,'muted'));}const detail=compactDetails('Предложения · '+offers.length);for(const r of offers.sort((a,b)=>quotePrice(a)-quotePrice(b))){row(detail,r.supplier,[r.name,offerDetail(r),qualityDetail(r)].filter(Boolean).join(' · '),node('strong',historyPrice(r),'price'));const link=button('Связать / разделить · качество',()=>productLinkDialog(()=>r,()=>r.supplier,render));link.classList.add('catalog-action');detail.append(link);}c.append(detail);$('productList').append(c)}if(!$('productList').children.length)empty($('productList'),'Товары не найдены');
}
if(supplier){$('supplierList').replaceChildren();
const docsBySupplier=grouped(ordered,d=>supplierKey(d.supplierId)),obsBySupplier=grouped(obs,r=>supplierKey(r.supplier));
for(const [key,list] of [...suppliers.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru'))){
 const c=node('div',null,'card'),purchases=docsBySupplier.get(key)||[],all=obsBySupplier.get(key)||[],histories=grouped(all,variantKey);
 c.append(node('h2',purchases[0]?.supplierId||list[0].supplier),node('p',list.length+' товаров · '+purchases.length+' накладных','muted'),button('Накладные поставщика',()=>{supplierFilter=key;go('invoices')}));
 const profile=supplierProfile(key);if(profile.contact||profile.schedule||profile.minimum!=null||profile.note)c.append(node('p',[profile.contact,profile.schedule,profile.minimum!=null?'Мин. заказ '+rub(profile.minimum):'',profile.note].filter(Boolean).join(' · '),'muted'));c.append(button('Карточка поставщика',()=>supplierDialog(key,purchases[0]?.supplierId||list[0].supplier)));
 const daily=node('details');daily.append(node('summary','Закупки по дням'));for(const d of dailyPurchases(purchases))row(daily,dateLabel(d.day)||'Дата не указана',d.count+' накл.',node('strong',rub(d.total),'price'));c.append(daily);
 const detail=compactDetails('Товары и история цен · '+list.length);for(const r of list.sort((a,b)=>a.name.localeCompare(b.name,'ru'))){
  row(detail,r.name,offerDetail(r),node('strong',historyPrice(r),'price'));
  supplierHistory(detail,histories.get(variantKey(r))||[r]);
 }c.append(detail);
 $('supplierList').append(c);
}if(!suppliers.size)empty($('supplierList'),'Нет поставщиков');
}
if(compare){renderMatchCandidates(last);$('offers').replaceChildren();for(const list of products.values()){const c=node('div',null,'card');c.append(node('h2',catalogTitle(list[0])));const sorted=list.slice().sort((a,b)=>quotePrice(a)-quotePrice(b)),best=sorted[0];for(const r of sorted){const good=sorted.length>1&&new Set(sorted.map(x=>supplierKey(x.supplier))).size>1&&sorted.every(x=>quoteUnit(x)&&quoteUnit(x)===quoteUnit(r)&&quotePrice(x)>0)&&quotePrice(r)===quotePrice(best);row(c,r.supplier,[r.name,offerDetail(r),qualityDetail(r),good?'Лучшая цена':''].filter(Boolean).join(' · '),node('strong',historyPrice(r),'price '+(good?'down':'')));const bar=node('div',null,'offer-bar');const fill=node('i');fill.style.width=(100*quotePrice(r)/Math.max(...sorted.map(quotePrice)))+'%';fill.className=good?'best':r===sorted.at(-1)&&sorted.length>1&&new Set(sorted.map(x=>supplierKey(x.supplier))).size>1&&sorted.every(x=>quoteUnit(x)&&quoteUnit(x)===quoteUnit(r)&&quotePrice(x)>0)?'worst':'';bar.append(fill);c.append(bar);}$('offers').append(c)}if(!products.size)empty($('offers'),'Загрузите накладные для сравнения.');
 renderOrderAdvice(last);}
 if(home){renderDashboard(obs,last);renderVision(obs,last);}
}
$('orderProduct').onchange=()=>renderOrderAdvice(latest(observations()));$('orderQuantity').oninput=()=>renderOrderAdvice(latest(observations()));$('invoiceSearch').oninput=()=>render('invoices');$('search').oninput=() => render('products');$('categoryFilter').onchange=() => render('products');$('favoriteFilter').onchange=() => render('products');$('period').onchange=() => render('home');for(const id of ['visionProduct','visionBasis','trendSelect','reportPoint','alertThreshold'])$(id).onchange=() => render('home');
function edit(d){reset();editing=d.id;pages=Array.isArray(d.pages)?d.pages.slice():d.original?[{key:'legacy',file:d.original,identity:photoFingerprint(d.original),fingerprint:pageFingerprint(d.lines)}]:[];$('supplier').value=d.supplierId;$('documentNumber').value=d.documentNumber||pages.find(p=>p.documentNumber)?.documentNumber||'';$('documentDate').value=d.documentDate||pages.find(p=>p.documentDate)?.documentDate||'';$('invoicePoint').value=Object.prototype.hasOwnProperty.call(POINTS,d.pointId)?d.pointId:'';$('lines').replaceChildren();for(const l of d.lines)addLine({...l,pageKey:l.pageKey||(pages.length===1?pages[0].key:undefined)});showPreview(pages.at(-1)?.file||d.original);pageStatus();go('entry')}
let savingInvoice=false;
$('form').onsubmit=async e=>{e.preventDefault();if(scanBusy||savingInvoice)return;savingInvoice=true;try{const next=e.submitter?.id==='saveNext',supplier=$('supplier').value.trim(),lines=[...$('lines').children].map(f=>{const l=lineData(f);if(!packUnits.includes(l.unit)){l.packKg=null;l.packL=null;}return l});if(!supplier||!lines.length||lines.some(l=>!l.name||l.price===null))throw Error('Проверьте поставщика, названия и цены с НДС');const duplicates=grouped(lines,l=>JSON.stringify([norm(l.name),l.pageKey||'']));for(const group of duplicates.values())if(group.length>1&&(!group.every(l=>l.article&&l.sourceRow&&l.pageKey&&l.article===group[0].article)||new Set(group.map(l=>l.sourceRow)).size!==group.length))throw Error('Есть одинаковые названия. Уточните фасовку или удалите дубль.');if(pages.some(pg=>pg.reviewRequired)&&!confirm('Не все строки накладной автоматически сверены. Сравните количество позиций и общую сумму с оригиналом. Сохранить?'))return;for(const pg of pages){if(pg.expectedTotal==null)continue;const actual=lines.filter(l=>l.pageKey===pg.key).reduce((s,l)=>s+Math.round((grossMetrics(l).totalPrice||0)*100),0)/100;if(Math.abs(actual-pg.expectedTotal)>.01&&!confirm('Сумма страницы '+rub(actual)+' отличается от сверенного итога '+rub(pg.expectedTotal)+'. Сохранить изменённые данные?'))return;}if(pendingPhoto&&!confirm('Последнее фото ещё не добавлено. Сохранить только обработанные товары?'))return;if(partialPage&&!confirm('Документ содержит '+partialPage.pages+' страниц. Добавлено '+partialPage.page+'. Сохранить только эту часть?'))return;if(!confirm('Названия, фасовки и цены сверены с оригиналом?'))return;const prior=docs.find(d=>d.id===editing);const doc={id:editing||crypto.randomUUID(),simpleVersion:1,supplierId:supplier,documentNumber:norm($('documentNumber').value).replace(/\s+/g,'')||null,documentDate:$('documentDate').value||null,pointId:$('invoicePoint').value||null,savedAt:prior?.savedAt||new Date().toISOString(),lines,original:pages[0]?.file||(!pendingPhoto?$('file').files[0]:null)||prior?.original||null,pages:pages.slice()};if(docs.some(d=>d.id!==editing&&sameDocument({...d,documentNumber:d.documentNumber||d.pages?.find(p=>p.documentNumber)?.documentNumber},doc)))throw Error('Накладная с этим номером уже сохранена. Откройте её в архиве.');if(!editing&&!doc.documentNumber&&docs.some(d=>d.simpleVersion===1&&supplierKey(d.supplierId)===supplierKey(supplier)&&JSON.stringify(d.lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())===JSON.stringify(lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())&&String(d.savedAt).slice(0,10)===doc.savedAt.slice(0,10))&&!confirm('Такие товары и цены уже сохранены сегодня. Добавить ещё раз?'))return;await tx('readwrite',s=>s.put(doc));dirty=false;supplierFilter=null;await refresh();await autoBackup();if(next){reset();$('supplier').value=supplier;go('entry');status('✓ Накладная сохранена. Добавьте фото следующей.',true)}else{go('invoices');status('✓ Накладная сохранена',true)}}catch(err){status(err.message)}finally{savingInvoice=false}};
function scanLabel(){return scanPass===0?'Распознавание фото':scanPass===1?'Быстрая проверка Paddle OCR':'Углублённая проверка таблицы';}
function showScanProgress(){const el=$('scanProgress');el.replaceChildren();for(const s of scanTrace)el.append(node('div',(s.failed?'⚠ ':'✓ ')+s.label+' · '+fmt(s.seconds)+' с',s.failed?'scan-step':'scan-step done'));if(scanBusy&&stageStartedAt)el.append(node('div','● '+scanLabel()+' · '+fmt(Math.round((performance.now()-stageStartedAt)/100)/10)+' с','scan-step active'));if(!scanBusy&&scanTrace.length)el.append(node('div','Проверьте результат по оригиналу','scan-step'));}
setInterval(()=>{if(scanBusy)showScanProgress();},500);
window.supplyOcrStart=id=>{if($('entry').classList.contains('hide'))return;ocrId=id;if(!scanStartedAt)scanStartedAt=performance.now();stageStartedAt=performance.now();scanBusy=true;$('save').disabled=true;$('file').disabled=true;$('retry').classList.add('hide');$('ocrState').textContent=scanLabel()+'…';showScanProgress()};
function scanDiagnostic(text){document.getElementById('ocrDiagnostic')?.remove();if(!text)return;const d=node('details');d.id='ocrDiagnostic';d.append(node('summary','Распознанный текст'));const p=node('textarea');p.readOnly=true;p.value=text;p.style.cssText='width:100%;height:150px;font:12px monospace';const copy=button('Копировать весь текст',async()=>{try{await navigator.clipboard.writeText(p.value);status('Текст скопирован',true)}catch{p.focus();p.select();if(document.execCommand('copy'))status('Текст скопирован',true);else status('Текст выделен — скопируйте его через меню телефона')}});d.append(p,copy);$('retry').after(d);p.scrollTop=0}
function scanScore(r){
 const priced=r.items.filter(x=>x.price!=null),complete=priced.filter(x=>x.quantity!=null&&x.unit);
 return (r.documentVerified?1000000:r.pageVerified?500000:0)+priced.length*1000+complete.length*100+priced.filter(x=>x.packKg!=null).length*20+r.items.length*10+(r.supplier?1:0);
}
function needsPack(x){const p=window.supplyInvoiceParser;return packUnits.includes(x.unit)&&!x.packKg&&!x.packL&&!p.packWeight(x.name)&&!p.packVolume(x.name)&&(!!x.invoiceWeightKg||p.purchaseMetrics(x).basis!=='шт'||/майонез|запекания с массовой долей|сыр(?:\s|$)|сливки|масло(?:\s|$)|рис(?:\s|$)|мука|форель|лосось|креветк/i.test(x.name));}
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
 if(evidence.some(x=>supplierKey(x.supplier)==='ооо марр руссия'))return pass===0?'paddle-scan':'rescan';
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
 $('lines').replaceChildren();$('supplier').value=supplier;$('documentNumber').value=ids[0]||'';$('documentDate').value=source.map(s=>invoiceHeader(s).documentDate).find(Boolean)||'';pages=records;activePage=null;pendingPhoto=null;
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
  else if(!pages.length){if(r.supplier)$('supplier').value=r.supplier;const header=invoiceHeader(diagnostic);if(header.documentNumber&&!$('documentNumber').value)$('documentNumber').value=header.documentNumber.toUpperCase();if(header.documentDate&&!$('documentDate').value)$('documentDate').value=header.documentDate;if(r.items.length){$('lines').replaceChildren();for(const l of r.items)addLine(l)}}
  dirty=true;const priced=r.items.filter(x=>x.price!=null).length;
  $('ocrState').textContent=ambiguous?'Разные результаты OCR. Сверьте цены и количество с фото.':r.documentVerified&&priced===r.items.length?'Сверено строк: '+priced+' из '+r.items.length+'. Итог: '+rub(r.items.reduce((s,l)=>s+(grossMetrics(l).totalPrice||0),0))+'. Сверьте с фото.':priced?'Найдено цен: '+priced+' из '+r.items.length+'. Сверьте строки с фото.':(best.error||'Товарная таблица не прочитана. Выберите более чёткое фото или крупный снимок таблицы.');
  const missingPack=[...$('lines').children].map(lineData).some(needsPack);
  if(Number.isFinite(elapsed))$('ocrState').textContent+=' · '+fmt(Math.round(elapsed*10)/10)+' с';
  if(missingPack&&priced&&!ambiguous)$('ocrState').textContent+=' Фасовка не прочитана. Укажите вес нетто или объём одной упаковки — он сохранится для следующих накладных.';
  if(partialPage)$('ocrState').textContent+=' Добавлено страниц: '+partialPage.page+' из '+partialPage.pages+'. Загрузите остальные фото.';
  if(!priced&&activePage){$('ocrState').textContent='Повторная проверка не улучшила результат. Предыдущие строки сохранены.';}
  if(!priced||ambiguous||priced<r.items.length||missingPack||!r.documentVerified&&!r.pageVerified)scanDiagnostic(diagnostic);else document.getElementById('ocrDiagnostic')?.remove();
 }catch(e){scanCandidates=[];scanPass=0;scanStartedAt=0;stageStartedAt=0;showScanProgress();$('ocrState').textContent=e.message||'Не удалось обработать документ.';scanDiagnostic(text);}
};
$('rescan').onclick=()=>{if(!$('file').files.length){status('Выберите документ');return}scanCandidates=photoPassTexts.map(text=>({r:window.supplyInvoiceParser.parseSimple(text),text,error:''}));scanStartedAt=performance.now();scanTrace=[];scanPass=2;nextScan('rescan','Углублённая проверка таблицы…')};
document.querySelector('a.update').addEventListener('click',e=>{if(dirty&&!confirm('Обновление закроет несохранённую форму. Продолжить?'))e.preventDefault()});

// Local recovery copies and portable, checksummed backups. No network calls.
const BACKUP_FORMAT='farukh-supply-backup-v1',BACKUP_LIMIT=64*1024*1024;
let backupDbPromise=null,backupBusy=false,backupReady=false,autoBackupBusy=false;
function openBackupDb(){
 if(!backupDbPromise)backupDbPromise=new Promise((resolve,reject)=>{
  const r=indexedDB.open('farukh-supply-backups-v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('copies');
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Закройте другие окна приложения'));
 }).catch(e=>{backupDbPromise=null;throw e;});
 return backupDbPromise;
}
async function backupOp(mode,fn){
 const b=await openBackupDb();
 return new Promise((resolve,reject)=>{
  const t=b.transaction('copies',mode),r=fn(t.objectStore('copies'));
  t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error||r.error);t.onabort=()=>reject(t.error||Error('Операция отменена'));
 });
}
const getCopy=k=>backupOp('readonly',s=>s.get(k)),putCopy=(k,v)=>backupOp('readwrite',s=>s.put(v,k)),deleteCopy=k=>backupOp('readwrite',s=>s.delete(k));
function validateBackup(v){
 if(!v||v.format!==BACKUP_FORMAT||!Number.isFinite(Date.parse(v.createdAt))||!Array.isArray(v.invoices)||!v.catalog||!Array.isArray(v.catalog.products)||!v.catalog.aliases||!v.catalog.quality)throw Error('Неверный формат резервной копии');
 const ids=new Set(),products=new Set();
 for(const d of v.invoices){
  if(!d||typeof d.id!=='string'||!d.id||ids.has(d.id)||!Array.isArray(d.lines)||d.simpleVersion===1&&typeof d.supplierId!=='string'||d.lines.some(l=>!l||typeof l!=='object'||Array.isArray(l)))throw Error('Повреждена запись накладной');
  ids.add(d.id);
  if(d.original!=null&&!(d.original instanceof Blob))throw Error('Повреждён оригинал накладной');
  if(d.pages!=null&&(!Array.isArray(d.pages)||d.pages.some(p=>!p||typeof p!=='object'||p.file!=null&&!(p.file instanceof Blob))))throw Error('Повреждены фотографии страниц');
 }
 for(const p of v.catalog.products){if(!p||typeof p.id!=='string'||!p.id||products.has(p.id)||typeof p.name!=='string')throw Error('Повреждён справочник');products.add(p.id);}
 for(const [k,x] of Object.entries(v.catalog.aliases))if(!k||!x||!products.has(x.productId)||typeof x.variantId!=='string')throw Error('Повреждены связи товаров');
 for(const x of Object.values(v.catalog.quality))if(!x||typeof x!=='object'||x.rating!=null&&(!Number.isFinite(x.rating)||x.rating<1||x.rating>10)||x.yieldPct!=null&&(!Number.isFinite(x.yieldPct)||x.yieldPct<=0||x.yieldPct>100)||['glazePct','thawPct','trimPct'].some(k=>x[k]!=null&&(!Number.isFinite(x[k])||x[k]<0||x[k]>=100))||x.note!=null&&(typeof x.note!=='string'||x.note.length>500)||x.favorite!=null&&typeof x.favorite!=='boolean')throw Error('Повреждены оценки товаров');
 if(v.catalog.suppliers!=null&&(typeof v.catalog.suppliers!=='object'||Array.isArray(v.catalog.suppliers)||Object.values(v.catalog.suppliers).some(x=>!x||typeof x!=='object'||['contact','schedule','note'].some(k=>x[k]!=null&&typeof x[k]!=='string')||x.minimum!=null&&(!Number.isFinite(x.minimum)||x.minimum<0))))throw Error('Повреждены карточки поставщиков');
 if(v.catalog.orders!=null&&(!Array.isArray(v.catalog.orders)||v.catalog.orders.some(x=>!x||typeof x.id!=='string'||typeof x.name!=='string'||typeof x.supplier!=='string'||typeof x.unit!=='string'||!Number.isFinite(x.price)||x.price<=0||!Number.isFinite(x.quantity)||x.quantity<=0)))throw Error('Повреждён список закупок');
 return v;
}
async function autoBackup(){
 if(!backupReady||backupBusy||autoBackupBusy||catalogStorageError)return;
 autoBackupBusy=true;
 try{
  const previous=await getCopy('automatic'),now=new Date(),day=now.toLocaleDateString('sv-SE');
  if(previous&&new Date(previous.createdAt).toLocaleDateString('sv-SE')===day)return;
  const snapshot=await captureBackup();if(!snapshot.invoices.length)return;
  await putCopy('automatic',snapshot);
 }catch(e){console.warn('Automatic local backup failed',e.message);}
 finally{autoBackupBusy=false;}
}
async function captureBackup(){
 if(catalogStorageError)throw Error(catalogStorageError);
 return validateBackup({format:BACKUP_FORMAT,createdAt:new Date().toISOString(),invoices:await tx('readonly',s=>s.getAll()),catalog:JSON.parse(JSON.stringify(catalogState))});
}
function replaceInvoices(records){
 return new Promise((resolve,reject)=>{
  const t=db.transaction('invoices','readwrite'),s=t.objectStore('invoices');
  t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Восстановление отменено'));
  try{s.clear();for(const d of records)s.put(d);}catch(e){try{t.abort()}catch{}reject(e);}
 });
}
function setBackupCatalog(catalog){
 localStorage.setItem(CATALOG_KEY,JSON.stringify(catalog));catalogState=catalog;catalogStorageError='';catalogCache=null;packIndexCache=null;
}
async function recoverInterruptedRestore(){
 const journal=await getCopy('restore-journal');
 if(!journal)return false;
 validateBackup(journal);
 await replaceInvoices(journal.invoices);
 setBackupCatalog(journal.catalog);
 await deleteCopy('restore-journal');
 return true;
}
async function restoreBackup(snapshot){
 validateBackup(snapshot);
 if(await getCopy('restore-journal'))throw Error('Сначала завершите восстановление после сбоя');
 const old=await captureBackup();
 // Both the pre-restore recovery point and journal are durable before any changes.
 await backupOp('readwrite',s=>{s.put(old,'before-restore');return s.put(old,'restore-journal')});
 try{
  setBackupCatalog(snapshot.catalog);
  await replaceInvoices(snapshot.invoices);
  await deleteCopy('restore-journal');
 }catch(e){
  try{await recoverInterruptedRestore()}catch(rollback){backupReady=false;throw Error('Восстановление прервано. Не удаляйте приложение. Перезапустите его для восстановления прежней базы.')}
  throw Error('Восстановление отменено, прежняя база сохранена: '+(e.message||'ошибка записи'));
 }
 await refresh();
}
// File bytes, names, MIME types, and modification times survive portable export.
// A tagged array representation avoids reserved-key collisions in source data.
async function packBackup(value,budget,depth=0){
 if(depth>60)throw Error('Слишком сложная структура копии');
 if(value===undefined)return ['u'];
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return ['v',value];
 if(value instanceof Blob){
  budget.bytes+=value.size;if(budget.bytes>BACKUP_LIMIT)throw Error('Копия слишком большая для переноса через браузер (64 МБ файлов). Локальная копия доступна.');
  const bytes=new Uint8Array(await value.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return ['f',value instanceof File?value.name:null,value.type,value instanceof File?value.lastModified:null,btoa(binary)];
 }
 if(value instanceof Date)return ['d',value.toISOString()];
 if(Array.isArray(value))return ['a',await Promise.all(value.map(x=>packBackup(x,budget,depth+1)))];
 if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('Неподдерживаемые данные в копии');
 return ['o',await Promise.all(Object.entries(value).map(async ([k,v])=>[k,await packBackup(v,budget,depth+1)]))];
}
function unpackBackup(x,budget,depth=0){
 if(depth>60||!Array.isArray(x)||++budget.nodes>2000000)throw Error('Повреждена структура копии');
 switch(x[0]){
  case 'u':if(x.length===1)return undefined;break;
  case 'v':if(x.length===2&&(x[1]===null||['string','boolean','number'].includes(typeof x[1])))return x[1];break;
  case 'd':if(x.length===2&&typeof x[1]==='string'&&Number.isFinite(Date.parse(x[1])))return new Date(x[1]);break;
  case 'a':if(x.length===2&&Array.isArray(x[1]))return x[1].map(v=>unpackBackup(v,budget,depth+1));break;
  case 'o':if(x.length===2&&Array.isArray(x[1])){
   const out=Object.create(null);
   for(const entry of x[1]){
    if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||['__proto__','constructor','prototype'].includes(entry[0])||Object.hasOwn(out,entry[0]))throw Error('Недопустимое поле копии');
    out[entry[0]]=unpackBackup(entry[1],budget,depth+1);
   }
   return out;
  }break;
  case 'f':if(x.length===5&&(x[1]===null||typeof x[1]==='string')&&typeof x[2]==='string'&&typeof x[4]==='string'){
   budget.bytes+=Math.ceil(x[4].length*3/4);if(budget.bytes>BACKUP_LIMIT+4096)throw Error('Превышен лимит копии');
   const b=Uint8Array.from(atob(x[4]),c=>c.charCodeAt(0));
   return x[1]===null?new Blob([b],{type:x[2]}):new File([b],x[1],{type:x[2],lastModified:Number(x[3])||0});
  }break;
 }
 throw Error('Повреждены данные копии');
}
async function backupDigest(text){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
async function encodeBackup(snapshot){
 validateBackup(snapshot);
 const payload=JSON.stringify(await packBackup(snapshot,{bytes:0}));
 if(payload.length>96*1024*1024)throw Error('Копия слишком большая для переноса через браузер');
 return JSON.stringify({format:BACKUP_FORMAT,sha256:await backupDigest(payload),payload});
}
async function decodeBackup(text){
 if(typeof text!=='string'||text.length>110*1024*1024)throw Error('Файл слишком большой');
 const envelope=JSON.parse(text);
 if(envelope?.format!==BACKUP_FORMAT||typeof envelope.payload!=='string'||typeof envelope.sha256!=='string'||await backupDigest(envelope.payload)!==envelope.sha256)throw Error('Контрольная сумма не совпадает. Файл повреждён.');
 return validateBackup(unpackBackup(JSON.parse(envelope.payload),{bytes:0,nodes:0}));
}
function backupDialog(){
 if(!backupReady||savingInvoice||scanBusy||dirty||backupBusy){status('Сначала завершите сохранение и открытие базы');return;}
 const dlg=node('dialog',null,'catalog-dialog'),msg=node('p','Проверка резервных копий…','muted'),info=node('p','','muted');
 dlg.append(node('h2','Резервная копия'),node('p','Накладные, оригиналы фото/PDF, товары, связи и оценки.'),info,msg);
 const native=location.origin==='https://appassets.androidplatform.net';
 let controls=[];
 const run=async(fn)=>{
  if(backupBusy)return;backupBusy=true;controls.forEach(b=>b.disabled=true);msg.textContent='Выполняется…';
  try{await fn()}catch(e){msg.textContent=e.message||'Не удалось выполнить операцию';}
  finally{backupBusy=false;controls.forEach(b=>b.disabled=false);}
 };
 const describe=v=>dateLabel(v.createdAt)+' · '+new Date(v.createdAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+' · '+v.invoices.length+' накладных';
 async function showCopies(){
  const local=await getCopy('manual'),undo=await getCopy('before-restore'),automatic=await getCopy('automatic');
  info.textContent='Локальная копия: '+(local?describe(local):'нет')+'. Автоматическая: '+(automatic?describe(automatic):'нет')+'. До восстановления: '+(undo?describe(undo):'нет')+'.';
 }
 async function recover(key){const copy=await getCopy(key);if(!copy)throw Error('Копия не найдена');if(!confirm('Восстановить '+describe(copy)+'? Текущая база будет сохранена отдельно перед заменой.')){msg.textContent='Отменено';return;}await restoreBackup(copy);await showCopies();msg.textContent='✓ База восстановлена';}
 const local=button('Создать локальную копию',()=>run(async()=>{
  const old=await getCopy('manual');if(old&&!confirm('Заменить предыдущую локальную копию?')){msg.textContent='Отменено';return;}
  const v=await captureBackup();await putCopy('manual',v);await showCopies();msg.textContent='✓ Локальная копия создана';
 }));local.classList.add('primary');
 controls=[local,button('Восстановить локальную копию',()=>run(()=>recover('manual'))),button('Восстановить автоматическую копию',()=>run(()=>recover('automatic'))),button('Вернуть базу до восстановления',()=>run(()=>recover('before-restore')))];
 if(!native){
  controls.push(button('Скачать файл копии',()=>run(async()=>{
   const json=await encodeBackup(await captureBackup()),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
   const link=node('a');link.href=url;link.download='FARUKH-SUPPLY-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);msg.textContent='Файл передан браузеру для скачивания. Проверьте папку загрузок.';
  })));
 }else dlg.append(node('p','Локальная копия не защищает от удаления приложения или очистки данных. Экспорт файла на Android требует отдельного обновления модуля.','muted'));
 const file=node('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','Файл резервной копии');
 const importLabel=node('label','Восстановить из файла JSON');importLabel.append(file);
 file.onchange=()=>run(async()=>{
  const f=file.files[0];if(!f)return;try{
   if(f.size>110*1024*1024)throw Error('Файл слишком большой');
   const v=await decodeBackup(await f.text());
   if(!confirm('Восстановить '+describe(v)+'? Перед заменой будет создана копия текущей базы.')){msg.textContent='Отменено';return;}
   await restoreBackup(v);await showCopies();msg.textContent='✓ Файл проверен, база восстановлена';
  }finally{file.value='';}
 });
 const close=button('Закрыть',()=>dlg.close());
 for(const b of controls)dlg.append(b);dlg.append(importLabel,close);controls.push(file,close);
 dlg.addEventListener('cancel',e=>{if(backupBusy)e.preventDefault()});
 dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
 run(async()=>{await showCopies();msg.textContent='Копия хранится только на устройстве. Файл содержит данные закупок — храните его в безопасном месте.';});
}
$('backupOpen').onclick=backupDialog;

reset();const req=indexedDB.open('farukh-supply-preview',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('invoices'))req.result.createObjectStore('invoices',{keyPath:'id'})};req.onsuccess=async()=>{db=req.result;try{const recovered=await recoverInterruptedRestore();backupReady=true;await refresh();if(recovered)status('✓ Прежняя база восстановлена после прерывания',true)}catch(e){status('Резервное хранилище недоступно: '+e.message);if(!backupReady)await refresh().catch(err=>status(err.message));}};req.onerror=()=>status('Не удалось открыть локальную базу');
