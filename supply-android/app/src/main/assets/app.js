'use strict';
// v20: wait for Android gallery FileList before OCR; batch remains entirely on device.
;(function(){
'use strict';
// Experimental offline spatial table extraction. Column and row boundaries must be verified by the native layout detector. Prices and totals must use the same tax basis. Never infer missing cells.
function extractTable(boxes, columns, bands, expectedTotal = null) {
  const roles = new Set(["name","quantity","price","total","vat","unit","code","ignore"]);
  if (!Array.isArray(columns)||!Array.isArray(bands)||!Array.isArray(boxes)) throw Error("Invalid layout");
  function checkIntervals(values, a, b) {
    let last=-Infinity;
    for(const v of values) {
      if(!Number.isFinite(v[a])||!Number.isFinite(v[b])||v[a]<last||v[b]<=v[a])throw Error("Overlapping or invalid boundaries");
      last=v[b];
    }
  }
  checkIntervals(columns,"left","right");checkIntervals(bands,"top","bottom");
  if(columns.some(c=>!roles.has(c.role))||["name","quantity","price","total"].some(r=>columns.filter(c=>c.role===r).length!==1))throw Error("Unverified table schema");
  const rows=bands.map(()=>({cells:columns.map(()=>[]),issues:[]}));
  const issues=[];
  for(const b of boxes) {
    if(!b||typeof b.text!=="string"||!b.text.trim()||![b.left,b.right,b.top,b.bottom].every(Number.isFinite)||b.right<=b.left||b.bottom<=b.top) {issues.push("Invalid OCR box");continue;}
    const overlaps=bands.map((r,i)=>b.top<r.bottom&&b.bottom>r.top?i:-1).filter(i=>i>=0);
    if(!overlaps.length)continue;
    const contained=overlaps.filter(i=>b.top>=bands[i].top&&b.bottom<=bands[i].bottom);
    if(contained.length!==1){for(const i of overlaps)rows[i].issues.push("Box crosses row boundary");continue;}
    const row=rows[contained[0]];
    const ci=columns.findIndex(c=>b.left>=c.left&&b.right<=c.right);
    if(ci<0){row.issues.push("Box crosses column boundary");continue;}
    if(!Number.isFinite(b.confidence)||b.confidence<0.65||b.confidence>1)row.issues.push("Uncertain OCR: "+columns[ci].role);
    row.cells[ci].push(b);
  }
  const decimal=(value)=>{
    const s=value.replace(/[\s\u00a0\u202f]/g,"").replace(",",".");
    if(!/^\d+(?:\.\d{1,3})?$/.test(s))return null;
    const v=Number(s);return Number.isFinite(v)?v:null;
  };
  const items=rows.map(row=>{
    const fields={};
    columns.forEach((c,i)=>{
      if(c.role==="ignore")return;
      fields[c.role]=row.cells[i].sort((a,b)=>a.top-b.top||a.left-b.left).map(x=>x.text.trim()).join(" ");
    });
    const quantity=decimal(fields.quantity),price=decimal(fields.price),total=decimal(fields.total);
    if(!fields.name||quantity===null||price===null||total===null||quantity<=0)row.issues.push("Missing required cell");
    else if(Math.abs(Math.round(quantity*price*100)-Math.round(total*100))>1)row.issues.push("Quantity × price differs from row total");
    return {name:fields.name,quantity,price,total,vat:fields.vat||null,unit:fields.unit||null,code:fields.code||null,issues:[...new Set(row.issues)]};
  });
  const rowsVerified=items.length>0&&!issues.length&&items.every(x=>!x.issues.length);
  const totalCents=items.every(x=>x.total!==null)?items.reduce((sum,x)=>sum+Math.round(x.total*100),0):null;
  if(expectedTotal!==null&&(!Number.isFinite(expectedTotal)||expectedTotal<0||totalCents!==Math.round(expectedTotal*100)))issues.push('Document total differs from extracted rows');
  return {items,issues,verified:rowsVerified&&!issues.length,documentVerified:rowsVerified&&!issues.length&&expectedTotal!==null,total:totalCents===null?null:totalCents/100};
}


function spatialLines(boxes){
 if(!Array.isArray(boxes)||!boxes.length||boxes.length>12000)return [];
 const valid=boxes.filter(b=>b&&typeof b.text==='string'&&b.text.trim()&&[b.left,b.right,b.top,b.bottom,b.confidence].every(Number.isFinite)&&b.right>b.left&&b.bottom>b.top&&b.confidence>=0&&b.confidence<=1);
 if(valid.length!==boxes.length)return [];
 const cy=b=>(b.top+b.bottom)/2;
 const heights=valid.map(b=>b.bottom-b.top).sort((a,b)=>a-b),h=heights[Math.floor(heights.length/2)];
 const lines=[];
 for(const b of valid.slice().sort((a,b)=>cy(a)-cy(b)||a.left-b.left)){
  const l=lines[lines.length-1];
  if(l&&Math.abs(cy(b)-l.y)<=h*.45){l.boxes.push(b);l.y=l.boxes.reduce((s,x)=>s+cy(x),0)/l.boxes.length;}
  else lines.push({y:cy(b),boxes:[b]});
 }
 return lines.map(l=>({...l,boxes:l.boxes.sort((a,b)=>a.left-b.left),top:Math.min(...l.boxes.map(b=>b.top)),bottom:Math.max(...l.boxes.map(b=>b.bottom)),text:l.boxes.map(b=>b.text.trim()).join(' ')}));
}
const roleOf=s=>{
 const t=s.toLowerCase().replace(/[.:]$/g,'');
 if(/^(наименование(?:\s+(?:товара|товаров|продукции))?|товар|номенклатура|продукция)$/.test(t))return 'name';
 if(/^(количество|кол[- ]?во|кол)$/.test(t))return 'quantity';
 if(/^(ед|единица|ед\.изм|ед\. изм)$/.test(t))return 'unit';
 if(/^цена$/.test(t))return 'price';
 if(/^(сумма|стоимость)$/.test(t))return 'total';
 if(/^(№|код|артикул)$/.test(t))return 'ignore';
 return null;
};
const moneyNumber=s=>/^\d+(?:[,.]\d{1,3})?$/.test(s.replace(/\s/g,''))?Number(s.replace(/\s/g,'').replace(',','.')):null;
const unitName=s=>({'упак':'уп','упаковка':'уп','коробка':'кор','мешок':'уп','меш':'уп'}[s.toLowerCase().replace(/\.$/,'')]||s.toLowerCase().replace(/\.$/,''));
function spatialSimple(lines){
 const hs=lines.map((l,i)=>({l,i,roles:l.boxes.map(b=>roleOf(b.text.trim()))})).filter(({roles})=>roles.every(Boolean)&&['name','unit','quantity','price','total'].every(k=>roles.filter(r=>r===k).length===1));
 if(hs.length!==1)return null;
 const {l:header,i:hi,roles}=hs[0];
 const footer=lines.slice(hi+1).map((l,i)=>({l,i:i+hi+1,m:l.text.match(/^(?:итого|всего(?:\s+к\s+оплате|\s+по\s+накладной)?)\s*[: ]*\s*((?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{2})\s*(?:руб\.?|₽)?$/i)})).filter(x=>x.m);
 if(footer.length!==1)return null;
 const {i:fi,m}=footer[0], body=lines.slice(hi+1,fi);
 if(!body.length||body.length>250)return null;
 const expected=moneyNumber(m[1]);
 if(!(expected>0)||footer[0].l.boxes.some(b=>b.confidence<.65))return null;
 const bounds=[Math.min(...header.boxes.map(b=>b.left),...body.flatMap(l=>l.boxes.map(b=>b.left)))-1];
 for(let i=1;i<header.boxes.length;i++){
  if(header.boxes[i-1].right>=header.boxes[i].left)return null;
  bounds.push((header.boxes[i-1].right+header.boxes[i].left)/2);
 }
 bounds.push(Math.max(...header.boxes.map(b=>b.right),...body.flatMap(l=>l.boxes.map(b=>b.right)))+1);
 const columns=roles.map((role,i)=>({role,left:bounds[i],right:bounds[i+1]}));
 const q=columns.find(c=>c.role==='quantity');
 const anchors=body.map((l,i)=>({l,i,values:l.boxes.filter(b=>b.left>=q.left&&b.right<=q.right)})).filter(x=>x.values.length&&moneyNumber(x.values.map(b=>b.text).join(' '))>0);
 // Unassigned lines before the first item or overlapping row bounds are unsafe.
 if(!anchors.length||anchors[0].i!==0)return null;
 const bands=anchors.map((a,i)=>{
  const group=body.slice(a.i,anchors[i+1]?.i??body.length);
  return {top:Math.min(...group.map(l=>l.top)),bottom:Math.max(...group.map(l=>l.bottom))};
 });
 let result;try{result=extractTable(body.flatMap(l=>l.boxes),columns,bands,expected)}catch{return null;}
 if(!result.documentVerified||result.items.some(x=>!(x.price>0&&x.total>0)||!/\p{L}{2}/u.test(x.name)||!x.unit||! /^(кг|г|л|мл|шт|уп|кор)$/.test(unitName(x.unit))))return null;
 return result;
}

/* Recover table cells from each OCR pass independently, without a list of known products. */
function spatialInvoiceTable(boxes,raw,base,parser){
 const ls=spatialLines(boxes);if(!ls.length)return null;
 const fold=s=>String(s).normalize('NFKC').toLowerCase().replace(/ё/g,'е').trim();
 const mark=s=>fold(s).replace(/[.\s]/g,'').replace(/а/g,'a').replace(/б/g,'b');
 const cx=b=>(b.left+b.right)/2;
 const amount=s=>{const t=String(s).replace(/\s/g,'').replace(',','.');return /^\d+\.\d{2}$/.test(t)?Math.round(Number(t)*100):null;};
 const quantity=s=>{const t=String(s).replace(/[\s✓✔]/g,'').replace(',','.');return /^\d+(?:\.\d{1,3})?$/.test(t)?Number(t):null;};
 const definitions=[
 ['upd',['1','1a','2','2a','3','4','5','7','8','9'],['row','name','unitcode','unit','quantity','price','net','rate','tax','total']],
 ['act',['1','2','3','4','5','6','7','8','9','10','11','12','13'],['row','code','name','unit','ignore','ignore','ignore','rate','price','total','quantity','ignore','ignore']]
 ];
 const candidates=[];
 for(const l of ls){
  const marks=l.boxes.map(b=>mark(b.text));
  for(const [kind,keys,roles] of definitions){
   if(kind==='act'&&marks.includes('1a'))continue;
   const inds=keys.map(m=>marks.indexOf(m));
   if(inds.some((v,i)=>v<0||i>0&&v<=inds[i-1]))continue;
   const map=new Map(inds.map((i,j)=>[i,roles[j]]));
   candidates.push({kind,header:l,cols:l.boxes.map((b,i)=>({x:cx(b),role:map.get(i)||'ignore'}))});
  }
  const roles=l.boxes.map(b=>{const t=fold(b.text);if(t==='№'||t==='no')return 'row';if(t==='код')return 'code';if(t==='наименование')return 'name';if(/^ед\.?(?:\s*изм\.?)?$/.test(t))return 'unit';if(t==='мест')return 'ignore';if(/^(кол[- ]?во|количество)$/.test(t))return 'quantity';if(/^вес(?:\s*кг)?$/.test(t))return 'weight';if(t==='цена')return 'price';if(t==='сумма')return 'total';return null;});
  if(['row','code','name','unit','quantity','weight','price','total'].every(k=>roles.filter(x=>x===k).length===1))candidates.push({kind:'marr',header:l,cols:l.boxes.flatMap((b,i)=>roles[i]?[{x:cx(b),role:roles[i]}]:[])});
 }
 // A headerless continuation is accepted only with the MARR supplier already
 // recognized in the current document and an independently recognizable row.
 if(!candidates.length&&/марр\s+руссия/i.test(base.supplier||'')){
  const rows=ls.flatMap(l=>{
   const b=l.boxes,code=b.findIndex(x=>/^\d{8,12}$/.test(x.text.trim()));
   if(code!==1||!/^\d{1,3}$/.test(b[0].text.trim()))return [];
   const u=b.findIndex((x,i)=>i>code+1&&/^(?:упак|уп|шт|кор|кг)\.?$/i.test(x.text.trim()));
   if(u<0||b.length!==u+5||quantity(b[u+1].text)===null||quantity(b[u+2].text)===null||amount(b[u+3].text)===null||amount(b[u+4].text)===null)return [];
   const nameX=(b[code].right+b[u].left)/2;
   return [[{role:'row',x:cx(b[0])},{role:'code',x:cx(b[code])},{role:'name',x:nameX},{role:'unit',x:cx(b[u])},{role:'quantity',x:cx(b[u+1])},{role:'weight',x:cx(b[u+2])},{role:'price',x:cx(b[u+3])},{role:'total',x:cx(b[u+4])}]];
  });
  // Require two complete rows supporting the same column geometry.
  if(rows.length>=2&&rows.every(r=>r.every((c,i)=>Math.abs(c.x-rows[0][i].x)<Math.max(3,(rows[0][i+1]?.x-c.x||30)*.25)))){
   candidates.push({kind:'marr',header:{y:ls[0].top-2,bottom:ls[0].top-1},cols:rows[0]});
  }
 }
 if(candidates.length!==1)return null;
 const {kind,header,cols}=candidates[0];
 const reflow=ls.map(l=>l.text).join('\n'),parsed=parser.parseSimple(reflow),supplier=base.supplier||parsed.supplier;
 if(!supplier)return null;
 if(base.supplier&&parsed.supplier&&fold(base.supplier)!==fold(parsed.supplier))return null;
 const footer=ls.find(l=>l.y>header.y&&/^(?:всего\s+к\s+оплате|итого(?:\s*:|\s|$))/i.test(l.text));
 const stop=ls.find(l=>l.y>header.y&&/^(?:руководитель|документ\s+составлен|основание\s+передачи|товар\s+\(груз\)|главный\s+бухгалтер|комментарий|автор)/i.test(l.text));
 const end=Math.min(footer?.top??Infinity,stop?.top??Infinity);
 const body=ls.filter(l=>l.top>=header.bottom&&l.y<end&&!/^(?:место\s+хранения|изм\.?|кг)$/i.test(l.text)&&!/^место\s+хранения/i.test(l.text));
 if(!body.length||body.length>400)return null;
 const bounds=cols.map((c,i)=>i===0?-Infinity:(cols[i-1].x+c.x)/2);bounds.push(Infinity);
 const role=b=>{const i=bounds.findIndex((v,i)=>i<cols.length&&cx(b)>=v&&cx(b)<bounds[i+1]);return cols[i]?.role||'ignore';};
 const data=body.map(l=>({l,fields:new Map()}));
 for(const d of data)for(const b of d.l.boxes){const k=role(b);if(k==='ignore')continue;const a=d.fields.get(k)||[];a.push(b);d.fields.set(k,a);}
 const get=(d,k)=>(d.fields.get(k)||[]).map(b=>b.text).join(' ').trim();
 const anchors=data.map((d,i)=>({i,n:/^\d{1,3}$/.test(get(d,'row'))?Number(get(d,'row')):null})).filter(a=>a.n>0);
 if(!anchors.length||anchors.length>200||new Set(anchors.map(a=>a.n)).size!==anchors.length)return null;
 let starts=anchors.map(a=>a.i);
 if(kind==='marr'){
  const cats=data.map((d,i)=>({i,s:get(d,'name')})).filter(x=>/^[0()]+\s*\([^)]{2,100}\)/.test(x.s)).map(x=>x.i);
  if(cats.length===anchors.length&&cats.every((v,i)=>v<=anchors[i].i&&(i===0||v>anchors[i-1].i)))starts=cats;
 }
 if(starts[0]!==0)return null;
 const rows=[];
 for(let i=0;i<anchors.length;i++){
  const group=data.slice(starts[i],starts[i+1]??data.length);
  const values=k=>group.flatMap(d=>d.fields.get(k)||[]);
  const cell=k=>values(k).map(b=>b.text).join(' ').trim();
  const read=(k,fn)=>{const a=values(k);return !a.length||a.some(b=>b.confidence<.60)?null:fn(cell(k));};
  const sourceRow=String(anchors[i].n);
  let name=cell('name').replace(/^[0()]+\s*\([^)]{2,100}\)\s*/,'').trim();
  if(!/\p{L}{3}/u.test(name)||name.length>300||values('name').some(b=>b.confidence<.45))return null;
  let unit=unitName(cell('unit')),q=read('quantity',quantity),p=read('price',amount),t=read('total',amount);
  const article=cell('code').replace(/\s/g,'')||undefined;
  let n=null,tax=null,w=null;
  if(kind==='upd'){
   unit=({'796':'шт','778':'уп','990':'уп','166':'кг','112':'л'})[cell('unitcode').replace(/\s/g,'')]||unit;
   n=read('net',amount);tax=read('tax',amount);
   if(!(p>0&&n>0&&t>0&&tax!==null&&tax>=0&&n+tax===t))return null;
   // Recover an unreadable quantity only from independently printed price and net sum.
   if(q===null&&['шт','уп','кор'].includes(unit))q=Math.round(n/p);
   if(!(q>0)||Math.abs(q*p-n)>Math.max(1,q*.5+.01))return null;
   const rates=[0,5,7,10,20,22].filter(v=>Math.abs(Math.round(n*v/100)-tax)<=1);
   const rate=cell('rate').replace(/\s/g,'').match(/^(\d{1,2})%$/);
   if(rates.length!==1||rate&&Number(rate[1])!==rates[0])return null;
  }else{
   if(!(p>0&&t>0)||!article||!/^\d{8,14}$/.test(article))return null;
   if(kind==='act'&&q===null&&Number.isInteger(t/p))q=t/p;
   if(!(q>0)||Math.abs(Math.round(q*p)-t)>1)return null;
   if(kind==='marr'){w=read('weight',quantity);if(!(w>0)||unit==='кг'&&Math.abs(q-w)>.001)return null;}
  }
  if(!/^(шт|уп|кор|кг|л)$/.test(unit))return null;
  const x={name:name+' / '+unit+(kind==='upd'?' (без НДС)':kind==='act'?' (с НДС)':''),unit,article,quantity:q,price:p/100,invoiceTotal:t/100,sourceRow,uncertain:true,source:name,packKg:unit==='кг'?null:parser.packWeight(name),packL:unit==='кг'?null:parser.packVolume(name)};
  if(w!==null)x.invoiceWeightKg=w;if(n!==null)x.netPrice=p/100;
  rows.push({...x,...parser.lineMetrics(x),_net:n,_tax:tax});
 }
 const total=rows.reduce((s,x)=>s+Math.round(x.invoiceTotal*100),0);
 const foot=(k,fn)=>fn((footer?.boxes||[]).filter(b=>role(b)===k).map(b=>b.text).join(' '));
 let verified=false,marrControl=null;
 if(kind==='upd'){
  if(!footer)return null;
  const n=foot('net',amount),tax=foot('tax',amount),g=foot('total',amount);
  if(n===null||tax===null||g===null||n+tax!==g||g!==total||rows.reduce((s,x)=>s+x._net,0)!==n||rows.reduce((s,x)=>s+x._tax,0)!==tax)return null;
  verified=true;
 }else if(kind==='marr'&&footer){
  const g=foot('total',amount),q=foot('quantity',quantity),w=foot('weight',quantity);
  if(g===null||q===null||w===null)return null;
  marrControl={total:g/100,quantity:q,weightKg:w};
  verified=total===g&&Math.abs(rows.reduce((s,x)=>s+x.quantity,0)-q)<.00001&&rows.reduce((s,x)=>s+Math.round(x.invoiceWeightKg*1000),0)===Math.round(w*1000);
  if(!verified&&(total>=g||rows.reduce((s,x)=>s+x.quantity,0)>=q))return null;
 }
 const items=rows.map(({_net,_tax,...x})=>x);
 return {...base,supplier,items,documentVerified:verified,pageVerified:verified,spatialVerified:verified,spatialRecovered:true,marrControl};
}

function candidate(boxes,raw,base,parser,upd){
 if(base&&!base.documentVerified&&!base.pageVerified){const table=spatialInvoiceTable(boxes,raw,base,parser);if(table&&(table.documentVerified||table.items.length>base.items.filter(x=>x.price!=null).length))return table;}
 const lines=spatialLines(boxes);
 if(!lines.length||!base||base.documentVerified||base.pageVerified)return null;
 if(upd?.structured){
  // Use the original text's independent VAT-inclusive footer, never a guessed tax rate.
  if(upd.conflictingTotals||!(upd.printedTotal>0))return null;
  const reflow=lines.map(l=>l.text).join('\n');
  const r=parser.parseSimple(reflow);
  if(!r.documentVerified||!r.supplier||(base.supplier&&r.supplier.toLowerCase()!==base.supplier.toLowerCase())||!r.items.length||r.items.some(x=>!(x.quantity>0&&x.price>0&&x.invoiceTotal>0)||!x.unit))return null;
  if(Math.round(r.items.reduce((s,x)=>s+x.invoiceTotal,0)*100)!==Math.round(upd.printedTotal*100))return null;
  return {...r,spatialVerified:true};
 }
 // VAT/transport layouts must not be interpreted as a simple price × quantity table.
 if(!base.supplier||/НДС|товарно[- ]транспортная|сч[её]т[- –]фактура/i.test(raw))return null;
 const result=spatialSimple(lines);
 if(!result)return null;
 const items=result.items.map(x=>{
  const unit=unitName(x.unit),name=x.name+' / '+unit;
  const item={name,unit,quantity:x.quantity,price:x.price,invoiceTotal:x.total,packKg:parser.packWeight(name),packL:parser.packVolume(name),uncertain:true,source:x.name};
  return {...item,...parser.lineMetrics(item)};
 });
 return {...base,items,documentVerified:true,spatialVerified:true};
}
const api={extractTable,spatialLines,spatialSimple,spatialInvoiceTable,candidate};
if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.supplySpatial=api;

})();

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
function cleanInvoiceName(name){
 return String(name||'').replace(/\s*\/\s*(?:кг|г|л|мл|шт|уп|кор)(?:\s*\((?:с|без)\s+НДС\))?\s*$/i,'')
 .replace(/\s*\((?:с|без)\s+НДС\)\s*$/i,'').replace(/\s+/g,' ').trim();
}
function addLine(data={}){
 data=grossRow(data);
 data={...data,name:cleanInvoiceName(data.name)};
 const f=node('div',null,'line');if(data.ocrOriginalName){f.dataset.ocrOriginalName=data.ocrOriginalName;if(data.ocrOriginalArticle)f.dataset.ocrOriginalArticle=data.ocrOriginalArticle;}if(data.uncertain)f.classList.add('uncertain');if(data.nameNeedsReview)f.dataset.nameNeedsReview='1';if(data.article)f.dataset.article=String(data.article);if(data.pageKey)f.dataset.pageKey=data.pageKey;if(data.sourceRow)f.dataset.sourceRow=String(data.sourceRow);if(numeric(data.invoiceWeightKg))f.dataset.invoiceWeightKg=String(data.invoiceWeightKg);if(numeric(data.invoiceTotal))f.dataset.invoiceTotal=String(numeric(data.invoiceTotal));if(numeric(data.netPrice))f.dataset.netPrice=String(data.netPrice);
 function field(key,title,value,placeholder){const wrap=node('label',title),i=node('input');i.dataset.field=key;i.placeholder=placeholder||'';i.value=value==null?'':String(value);if(key!=='name')i.inputMode='decimal';i.setAttribute('aria-label',title);wrap.append(i);return {wrap,i}}
 const a=field('name','Название товара',data.name,'Название товара'),p=field('price','Цена за уп., ₽',data.price,'0,00'),q=field('quantity','Количество',data.quantity,'—'),w=field('packKg','Фасовка, кг',data.packKg??data.packL,'—');
 a.i.value=data.name||'';a.i.required=p.i.required=true;
 const fullName=node('small','','full-product-name');a.wrap.append(fullName);
 const showFullName=()=>{fullName.textContent=a.i.value.length>43?a.i.value:'';a.i.title=a.i.value;};
 a.i.addEventListener('input',showFullName);showFullName();
 const measure=node('select');measure.dataset.field='packMeasure';measure.setAttribute('aria-label','Единица фасовки');for(const k of ['кг','л']){const o=node('option',k);o.value=k;measure.append(o)}measure.value=data.packL&&!data.packKg?'л':'кг';const packControls=node('div',null,'qty-controls');packControls.append(w.i,measure);w.wrap.append(packControls);w.wrap.firstChild.nodeValue='Фасовка';
 const u=node('select');u.dataset.field='unit';u.setAttribute('aria-label','Единица накладной');
 for(const k of ['','шт','уп','кор','кг','г','л','мл']){const o=node('option',k||'Не указана');o.value=k;u.append(o)}u.value=data.unit||((data.name||'').match(/\s*\/\s*(кг|г|л|мл|шт|уп|кор)(?:\s+\(без НДС\))?$/i)?.[1]||'');
 q.wrap.classList.add('quantity-cell');const qtyControls=node('div',null,'qty-controls');qtyControls.append(q.i,u);q.wrap.append(qtyControls);
 const del=button('×',()=>{f.remove();dirty=true});del.setAttribute('aria-label','Удалить товар');del.classList.add('line-delete');
 function computed(title,cls){const box=node('div',null,'computed-cell '+cls),out=node('output','—');box.append(node('span',title,'cell-caption'),out);return {box,out}}
 const weight=computed('Общий вес','line-summary'),kgPrice=computed('Цена за кг','kg-price'),total=computed('Общая стоимость','line-total');const weightNote=node('small','','muted');weight.box.append(weightNote);
 function recalc(){const l=lineData(f),m=grossMetrics(l);f.classList.toggle('line-invalid',!!l.name&&l.price===null);const pack=packUnits.includes(l.unit),piece=m.basis==='шт',volume=m.basis==='л';w.i.disabled=measure.disabled=!pack;w.wrap.classList.toggle('pack-required',needsPack(l));const basis=' с НДС';p.wrap.firstChild.nodeValue=(piece&&l.unit==='шт'?'Цена за шт.':pack?'Цена за уп.':l.unit==='кг'?'Цена за кг':l.unit==='л'?'Цена за л':'Цена за ед.')+basis+', ₽';p.i.setAttribute('aria-label',p.wrap.firstChild.nodeValue);const per=m.piecesPerPack;q.wrap.firstChild.nodeValue=piece&&per&&l.unit==='шт'&&m.totalPieces!=null?'Количество ('+fmt(per)+' шт./кор.)':'Количество';weight.box.firstChild.textContent=piece?'Общее количество':volume?'Общий объём':'Общий вес';kgPrice.box.firstChild.textContent=(piece?'Цена за шт.':volume?'Цена за л':'Цена за кг')+basis;const qty=piece?m.totalPieces:volume?m.totalL:m.totalKg,price=piece?m.pricePerPiece:volume?m.pricePerL:m.pricePerKg;weight.out.textContent=qty==null?'—':fmt(qty)+' '+(piece?'шт.':volume?'л':'кг');const printed=l.invoiceWeightKg,nominal=pack?window.supplyInvoiceParser.packWeight(l.name):null;weightNote.textContent=printed&&(!m.totalKg||Math.abs(printed-m.totalKg)>.000001)?'Вес по накладной: '+fmt(printed)+' кг (отдельно)':nominal&&l.packKg&&Math.abs(nominal-l.packKg)>.000001?'В названии указано '+fmt(nominal)+' кг — проверьте фасовку':'';weightNote.style.display=weightNote.textContent?'block':'none';if(piece&&per&&qty!=null&&l.unit==='шт'&&qty%per===0)weight.out.textContent+=' · '+fmt(qty/per)+' кор.';kgPrice.out.textContent=price==null?'—':rub(price);total.out.textContent=m.totalPrice==null?'—':rub(m.totalPrice);total.out.title=l.invoiceTotal?'Сумма к оплате из накладной':'Расчёт по количеству и цене с НДС';}
 function fillMissingPack(){if(!packUnits.includes(u.value)||numeric(w.i.value))return;const parser=window.supplyInvoiceParser,mass=parser.packWeight(a.i.value),volume=parser.packVolume(a.i.value),savedMass=knownPack(lineData(f),$('supplier').value),savedVolume=knownPack(lineData(f),$('supplier').value,docs,'packL');if(mass||volume||savedMass&&!savedVolume||savedVolume&&!savedMass){measure.value=mass||!volume&&savedMass?'кг':'л';w.i.value=mass||volume||savedMass||savedVolume;w.i.title=mass||volume?'Из названия товара':'Из ранее подтверждённой накладной';}}
 measure.addEventListener('change',()=>{w.i.value='';w.i.title='';recalc()});
 a.i.addEventListener('change',()=>{delete f.dataset.article;fillMissingPack();recalc()});
 u.addEventListener('change',()=>{fillMissingPack();recalc()});
 w.i.addEventListener('input',()=>{w.i.title='';});
 for(const input of [p.i,q.i])input.addEventListener('input',()=>{delete f.dataset.invoiceTotal;delete f.dataset.netPrice;if(input===q.i)delete f.dataset.invoiceWeightKg;});
 f.addEventListener('input',recalc);u.addEventListener('change',()=>{delete f.dataset.invoiceTotal;delete f.dataset.netPrice;delete f.dataset.invoiceWeightKg;recalc()});
 if(data.source)f.title=data.source;
  if(data.nameNeedsReview){const warning=node('small','⚠ Название повреждено распознаванием. Исправьте по оригиналу.','muted');warning.style.cssText='display:block;color:#f6c96b;margin:4px 0';f.append(warning);a.i.addEventListener('input',()=>{delete f.dataset.nameNeedsReview;warning.remove();});}
 if(data.unitEvidence){const hint=node('small','⚠ Единица распознана по ОКЕИ. Сверьте с накладной.','muted');hint.style.cssText='display:block;color:#f6c96b;margin:4px 0';f.append(hint);u.addEventListener('change',()=>hint.remove());}
 if(data.quantityCorrected){const warning=node('small','⚠ OCR неверно прочитал количество. Проверьте с оригиналом.','muted');warning.style.cssText='display:block;color:#f6c96b;margin:4px 0';f.append(warning);q.i.addEventListener('input',()=>warning.remove());}
 const badge=button('',()=>productLinkDialog(()=>lineData(f),()=>$('supplier').value,()=>catalogBadge(f)));badge.className='catalog-badge hide';
 const learned=f.dataset.ocrOriginalName&&norm(a.i.value)===norm(f.dataset.ocrOriginalName)?correctionFor(f.dataset.ocrOriginalName,$('supplier').value,f.dataset.ocrOriginalArticle):null;
 const suggestion=learned?button('Подсказка: '+learned,()=>{a.i.value=learned;delete f.dataset.article;suggestion.remove();recalc();catalogBadge(f);dirty=true;}):null;
 if(suggestion){suggestion.className='catalog-badge review';suggestion.setAttribute('aria-label','Применить сохранённое исправление: '+learned);}
 f.append(a.wrap,del,w.wrap,q.wrap,weight.box,p.wrap,kgPrice.box,total.box,badge);if(suggestion)f.append(suggestion);$('lines').append(f);fillMissingPack();recalc();catalogBadge(f);f.addEventListener('change',()=>catalogBadge(f));
}
function showPreview(file){
 if(previewUrl)URL.revokeObjectURL(previewUrl);
 previewUrl='';
 const img=$('preview');
 img.classList.add('hide');
 img.removeAttribute('src');
 if(!file||file.type==='application/pdf')return;
 try {
  previewUrl=URL.createObjectURL(file);
  img.onload=()=>{img.classList.remove('hide')};
  img.onerror=()=>{
   img.classList.add('hide');
   if(!scanBusy)$('ocrState').textContent='Предпросмотр этого формата недоступен, но проверяем фото встроенным распознаванием.';
  };
  img.src=previewUrl;
 }catch(e){
  $('ocrState').textContent='Не удалось показать превью; попробуйте другой формат JPG или PNG.';
 }
}
function reset(){if($('structureJson'))$('structureJson').value='';if($('structureWarnings'))$('structureWarnings').textContent='';scanStartedAt=0;stageStartedAt=0;scanTrace=[];$('scanProgress').replaceChildren();pages=[];activePage=null;pendingPhoto=null;partialPage=null;scanPass=0;scanCandidates=[];photoPassTexts=[];photoSupplier='';document.getElementById('ocrDiagnostic')?.remove();ocrId=null;scanBusy=false;editing=null;$('form').reset();$('lines').replaceChildren();addLine();showPreview(null);$('ocrState').textContent='';$('retry').classList.add('hide');$('save').disabled=false;$('file').disabled=false;dirty=false;pageStatus();showInvoiceIntegrity();status('')}
$('supplier').addEventListener('change',()=>{for(const f of $('lines').children)catalogBadge(f)});
$('addLine').onclick=()=>{addLine(pages.length===1?{pageKey:pages[0].key}:{});dirty=true;showInvoiceIntegrity()};$('form').addEventListener('input',()=>{dirty=true;showInvoiceIntegrity()});$('form').addEventListener('change',showInvoiceIntegrity);let photoPickerWaitTimer=null;
$('file').addEventListener('click',()=>{
 clearTimeout(photoPickerWaitTimer);
 if($('entry').classList.contains('hide'))return;
 $('ocrState').textContent='Открываем выбор фотографий…';
 photoPickerWaitTimer=setTimeout(()=>{
  if(!$('entry').classList.contains('hide')&&!scanBusy&&!$('file').files.length)
   $('ocrState').textContent='Фото не передано из галереи. Повторите выбор через «Файлы».';
 },8000);
});
$('file').addEventListener('change',()=>{
 clearTimeout(photoPickerWaitTimer);
 const selected=[...$('file').files],file=selected[0];
 if(!file){
  $('ocrState').textContent='Галерея не передала выбранный файл. Попробуйте выбрать через «Файлы».';
  return;
 }
 activePage=null;pendingPhoto=file;scanPass=0;scanCandidates=[];photoPassTexts=[];photoSupplier='';
 scanStartedAt=performance.now();scanTrace=[];
 document.getElementById('ocrDiagnostic')?.remove();
 showPreview(file);pageStatus();dirty=true;
 $('ocrState').textContent=selected.length>1?'Выбрано фотографий: '+selected.length+'. Подготавливаем распознавание…':'Фотография выбрана. Подготавливаем распознавание…';
 // Synchronize the native OCR start with WebView's FileList/change event.
 // Prevents Android picker results arriving before the selected File is visible in JS.
 if(location.origin==='https://appassets.androidplatform.net')
  location.href='https://appassets.androidplatform.net/ocr-selected?count='+selected.length;
});

function pageStatus(){
 const label=$('fileLabel');if(label)label.textContent=pages.length?'＋ Добавить страницу':'▣ Выбрать фото накладной';
 const numbers=[...new Set(pages.map(p=>p.number).filter(Boolean))],expected=Math.max(0,...pages.map(p=>p.expected||0));
 const complete=expected>0&&numbers.length===expected&&numbers.every(n=>n>=1&&n<=expected);
 partialPage=expected&&!complete?{pages:expected,page:numbers.length}:null;
 $('pageState').textContent=pages.length?'Страниц в форме: '+pages.length+(expected?' · Страниц '+numbers.length+' из '+expected:''):'';
}
function invoiceHeader(raw){
 const text=String(raw||'').replace(/[|│]/g,' ');
 const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
 const dates=new Set(),ids=new Set();
 const add=(y,m,d)=>{if(!m)return;const iso=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');if(Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso)dates.add(iso);};
 const heads=/(?:реализация|универсальный\s+передаточный\s+документ|по\s+УПД|УПД|сч[её]т\s*[-– ]?\s*фактура|накладная|накладной)\s*(?:№|No|N[еe]|N°|N)\s*:?\s*([a-zа-яё0-9][a-zа-яё0-9/.-]*(?:[ \t]+\d{3,})?)/gi;
 for(const match of text.matchAll(heads)){
  ids.add(norm(match[1]).replace(/\s+/g,''));
  const tail=text.slice(match.index+match[0].length,match.index+match[0].length+65);
  const numeric=tail.match(/^\s*(?:(?:[оo][тtrг]|[оo])\s*)?(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(?!\d)/i);
  if(numeric){add(numeric[3],Number(numeric[2]),Number(numeric[1]));continue;}
  const named=tail.match(/^\s*(?:(?:[оo][тtrг]|[оo])\s*)?(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})(?!\d)/i);
  if(named){const month=months.indexOf(named[2].toLowerCase());if(month>=0)add(named[3],month+1,Number(named[1]));}
 }
 return {documentNumber:ids.size===1?[...ids][0]:null,documentDate:dates.size===1?[...dates][0]:null};
}
function purchaseDate(d){return d.documentDate||d.pages?.find(p=>p.documentDate)?.documentDate||d.date||d.savedAt||''}
function purchaseDay(d){return String(purchaseDate(d)).slice(0,10)}
function dailyPurchases(records){return [...grouped(records,purchaseDay).entries()].map(([day,items])=>({day,count:items.length,total:items.flatMap(linesOf).reduce((s,l)=>s+Math.round((grossMetrics(l).totalPrice||0)*100),0)/100})).sort((a,b)=>b.day.localeCompare(a.day))}
function sameDocument(a,b){return !!(a.documentNumber&&b.documentNumber&&norm(a.documentNumber).replace(/\s+/g,'')===norm(b.documentNumber).replace(/\s+/g,'')&&supplierKey(a.supplierId)===supplierKey(b.supplierId)&&(!a.documentDate||!b.documentDate||a.documentDate===b.documentDate))}
// Independent control total: only an explicit UPD footer with consistent net, VAT and gross.
function updEvidence(raw){
 const text=String(raw||''),structured=/сч[её]т\s*[-– ]?\s*фактура|универсальный\s+передаточный\s+документ/i.test(text);
 const totals=new Set();
 if(structured)for(const part of text.split(/\r?\n\s*---\s*\r?\n/)){
  const lines=part.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   if(!/^\s*всего\s+к\s+оплате/i.test(lines[i]))continue;
   let tail=lines[i].replace(/^\s*всего\s+к\s+оплате\s*(?:\(\s*9\s*\))?\s*/i,'');
   if(!tail.trim()&&/^[\d.,\sхx–—-]+$/i.test(lines[i+1]||''))tail=lines[i+1];
   const values=[...tail.replace(/[\u00a0\u202f]/g,' ').matchAll(/(?<![\d.,])(?:\d{1,3}(?: \d{3})+|\d+)[.,]\d{2}(?![\d.,])/g)].map(m=>Math.round(Number(m[0].replace(/\s/g,'').replace(',','.'))*100));
   if(values.length===3&&values[0]>0&&values[1]>=0&&values[0]+values[1]===values[2])totals.add(values[2]);
  }
 }
 return {structured,printedTotal:totals.size===1?[...totals][0]/100:null,conflictingTotals:totals.size>1};
}
function marrDocumentEvidence(raw){
 const text=String(raw||'').replace(/[\u00a0\u202f|│]/g,' ');
 const values=[];
 for(const l of text.split(/\r?\n/)){
  const m=l.match(/^\s*итого\s*:\s*(\d+)\s+(\d+[.,]\d{3})\s+((?:\d{1,3}(?: \d{3})+|\d+)[.,]\d{2})\s*$/i);
  if(m)values.push({quantity:Number(m[1]),weightKg:Number(m[2].replace(',','.')),total:Number(m[3].replace(/\s/g,'').replace(',','.'))});
 }
 const distinct=new Map(values.map(x=>[JSON.stringify(x),x]));
 return {control:distinct.size===1?[...distinct.values()][0]:null,conflict:distinct.size>1};
}
function marrIntegrity(lines,records,raw){
 const ev=marrDocumentEvidence(raw);
 const controls=[...records.map(p=>p.marrControl).filter(Boolean),...(ev.control?[ev.control]:[])];
 const unique=new Map(controls.map(x=>[JSON.stringify([x.total,x.quantity,x.weightKg]),x]));
 if(ev.conflict||records.some(p=>p.marrConflict)||unique.size>1)return {message:'МАРР: разные итоги документа. Проверьте страницы.',error:true};
 if(!unique.size)return {message:'МАРР: итог документа не прочитан. Добавьте последнюю страницу или сверьте оригинал.',error:true};
 const c=[...unique.values()][0];
 if(lines.some(l=>!(l.quantity>0)||!(l.price>0)||!(l.invoiceWeightKg>0)))return {message:'МАРР: количество, цена или вес строки не прочитаны.',error:true};
 const total=lines.reduce((s,l)=>s+Math.round((grossMetrics(l).totalPrice||0)*100),0);
 const q=lines.reduce((s,l)=>s+Number(l.quantity),0);
 const w=lines.reduce((s,l)=>s+Math.round(l.invoiceWeightKg*1000),0);
 if(total!==Math.round(c.total*100)||Math.abs(q-c.quantity)>.00001||w!==Math.round(c.weightKg*1000))return {message:'МАРР: сумма, количество или вес не совпадают с итогом. Добавьте недостающие страницы или проверьте строки.',error:true};
 return {message:'✓ МАРР: сумма, количество и вес совпадают с итогом документа.',error:false,verified:true};
}
function acceptanceFooterTotal(raw){
 const values=[];
 const moneyPattern=/(?<![\d.,])(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)[,.]\d{2}(?![\d.,])/g;
 const lines=String(raw||'').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const m=lines[i].match(/^\s*всего\s+передано\s*[:=]?\s*(.*)$/i);
  if(!m)continue;
  const tail=m[1].trim()||String(lines[i+1]||'').trim();
  const sums=[...tail.matchAll(moneyPattern)].map(x=>Number(x[0].replace(/[\s\u00a0\u202f]/g,'').replace(',','.')));
  if(sums.length===1&&Number.isFinite(sums[0]))values.push(Math.round(sums[0]*100));
 }
 const distinct=[...new Set(values)];
 return distinct.length===1?distinct[0]/100:null;
}
function invoiceIntegrity(lines,records,raw,date){
 if(records.some(p=>p.marr)||/марр\s+руссия/i.test(raw||''))return marrIntegrity(lines,records,raw);
 const pending=updEvidence(raw);
 const receiptControls=records.filter(p=>p.footerOnly&&Number.isFinite(p.footerTotal));
 let receiptVerified=false;
 if(receiptControls.length){
  const totals=[...new Set(receiptControls.map(p=>Math.round(p.footerTotal*100)))];
  if(totals.length!==1)return {message:'В документе противоречивые итоги приёмки.',error:true};
  if(lines.some(l=>!l.name||!(l.quantity>0)||!(l.price>0)))
   return {message:'Не все строки прочитаны — нельзя сверить итог приёмки.',error:true};
  const actual=lines.reduce((sum,l)=>sum+Math.round((grossMetrics(l).totalPrice||0)*100),0);
  if(Math.abs(actual-totals[0])>1)
   return {message:'Сумма распознанных товаров '+rub(actual/100)+' не совпадает с итогом приёмки '+rub(totals[0]/100)+'. Проверьте все страницы.',error:true};
  receiptVerified=true;
 }
 const structured=records.some(p=>p.structured)||pending.structured;
 if(!structured)return {message:receiptVerified?'✓ Итог приёмки совпадает с суммой строк.':'',error:false,verified:receiptVerified};
 if(!date)return {message:'Укажите дату накладной по оригиналу.',error:true};
 if(lines.some(l=>!l.name||!(l.quantity>0)||!(l.price>0)||!l.unit))return {message:'УПД: заполните количество, единицу и цену каждой строки.',error:true};
 if(pending.conflictingTotals||records.some(p=>p.conflictingTotals))return {message:'OCR прочитал разные итоги. Сверьте оригинал и загрузите чёткое фото.',error:true};
 const checks=records.filter(p=>p.structured&&p.printedTotal!=null).map(p=>({expected:p.printedTotal,lines:lines.filter(l=>l.pageKey===p.key)}));
 if(pending.structured&&pending.printedTotal!=null&&!records.length)checks.push({expected:pending.printedTotal,lines});
 for(const c of checks){const actual=c.lines.reduce((s,l)=>s+Math.round((grossMetrics(l).totalPrice||0)*100),0)/100;
  if(Math.abs(actual-c.expected)>.01)return {message:'Итог строк '+rub(actual)+' ≠ итогу УПД '+rub(c.expected)+'. Проверьте все товары.',error:true};}
 return {message:receiptVerified?'✓ Итог приёмки совпадает с суммой строк.':checks.length?'✓ Итог строк совпадает с УПД.':'Итог УПД не распознан — сверка по оригиналу обязательна.',error:false,verified:checks.length>0||receiptVerified};
}
function showInvoiceIntegrity(){
 const el=$('invoiceCheck');if(!el)return;
 const rows=[...$('lines').children].map(lineData);const result=invoiceIntegrity(rows,pages,pendingPhoto?photoPassTexts.join('\n---\n'):'',$('documentDate').value);
 const summary=$('simpleTotal');if(summary){const priced=rows.filter(l=>l.name&&l.quantity>0&&l.price>0);const total=priced.reduce((sum,l)=>sum+Math.round((grossMetrics(l).totalPrice||0)*100),0)/100;summary.textContent=priced.length?'Товаров: '+priced.length+' · Итого: '+rub(total):'Итого: —';}
 const direct=pages.filter(p=>(p.smartSimple||p.balancedInvoice)&&p.expectedTotal!=null);const mismatch=direct.some(p=>Math.abs(rows.filter(l=>l.pageKey===p.key).reduce((sum,l)=>sum+Math.round((grossMetrics(l).totalPrice||0)*100),0)/100-p.expectedTotal)>.01);
 const corrected=pages.some(p=>p.quantityCorrections>0);
 const incomplete=rows.some(l=>!l.name||!(l.quantity>0)||!(l.price>0)||!l.unit);
 const msg=incomplete?'⚠ Не все позиции заполнены: проверьте количество, единицы и цены.':mismatch?'Итог товаров не совпадает с накладной.':corrected?'✓ Сумма строк совпадает. ⚠ Количество восстановлено расчётом — проверьте по фото.':result.message||(direct.length?'✓ Итог товаров совпадает с накладной.':'');
 el.textContent=msg;el.className=msg?(mismatch||result.error?'up':incomplete||corrected?'warn':result.verified||direct.length?'down':'warn'):'hide';
}
function pageMeta(r,raw){
 const text=String(raw||'');
 const header=invoiceHeader(text);
 const page=text.match(/(?:стр\.|страница|cmp\.)\s*([1-9]\d*|I)\s*(?:из|u3)\s*(\d+)/i);
 const number=r.pageInfo?.page|| (page?(page[1].toUpperCase()==='I'?1:Number(page[1])):null);
 const expected=r.pageInfo?.pages|| (page?Number(page[2]):null);
 const marr=/марр\s+руссия/i.test(r.supplier||'');const ev=marr?marrDocumentEvidence(text):{};
 return {...header,...updEvidence(text),number,expected,marr,marrControl:r.marrControl||ev.control||null,marrConflict:!!ev.conflict};
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
 for(const [i,l] of r.items.entries())addLine({...l,ocrOriginalName:l.name,ocrOriginalArticle:l.article||undefined,pageKey:key,sourceRow:r.smartSimple&&r.documentVerified?String(i+1):l.article?(l.sourceRow||(r.documentVerified?String(i+1):undefined)):undefined});
 const record={...meta,key,file,identity,fingerprint,balancedInvoice:!!r.balancedInvoice,quantityCorrections:r.quantityCorrections||0,smartSimple:!!r.smartSimple,expectedTotal:(r.documentVerified||r.balancedInvoice)&&r.items.every(l=>numeric(l.invoiceTotal))?r.items.reduce((s,l)=>s+Math.round(l.invoiceTotal*100),0)/100:null,reviewRequired:!r.documentVerified&&!r.pageVerified};
 if(previous)pages=pages.map(p=>p.key===key?record:p);else pages.push(record);
 activePage=key;pendingPhoto=null;pageStatus();showInvoiceIntegrity();return true;
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
 $('savingNote').textContent=covered?'По последним известным ценам':'Недостаточно данных';
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
 else{const x=selectedSeries.slice(-10),vals=x.map(quotePrice),min=Math.min(...vals),max=Math.max(...vals),points=vals.map((v,i)=>[12+i*276/(vals.length-1),92-(v-min)*72/(max-min||1)]);trend.append(node('strong',catalogTitle(x[0])),node('small',x[0].supplier+' · '+historyPrice(x.at(-1))));const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 300 108');svg.setAttribute('role','img');svg.setAttribute('aria-label','Динамика цены от '+rub(vals[0])+' до '+rub(vals.at(-1)));const line=document.createElementNS(ns,'polyline');line.setAttribute('points',points.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#8abaff');line.setAttribute('stroke-width','3');svg.append(line);points.forEach(([x,y])=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','4');dot.setAttribute('fill','#8abaff');svg.append(dot);});trend.append(svg,node('small',dateLabel(x[0].date)+' — '+dateLabel(x.at(-1).date)+' · '+rub(vals[0])+' → '+rub(vals.at(-1))));}
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
  ['Десерты',/десерт|тарталет|чизкейк|пирожн|торт(?:\s|$)|моти(?:\s|$)|тирамису/],
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
if(archive){$('archive').replaceChildren();const query=norm($('invoiceSearch').value),archiveDocs=(supplierFilter===null?ordered:ordered.filter(d=>supplierKey(d.supplierId)===supplierFilter)).filter(d=>!query||norm([d.supplierId,d.documentNumber,purchaseDay(d),dateLabel(purchaseDate(d)),pointLabel(d),...linesOf(d).map(r=>r.name)].join(' ')).includes(query));if(supplierFilter!==null)$('archive').append(button('Все накладные',()=>{supplierFilter=null;render()}));for(const d of archiveDocs){const c=node('div',null,'card compact-invoice'),ls=linesOf(d),known=ls.map(l=>grossMetrics(l).totalPrice).filter(x=>x!=null),sum=known.reduce((s,x)=>s+Math.round(x*100),0)/100;const head=node('div',null,'compact-head');head.append(node('h2',d.supplierId||'Без поставщика'),node('strong',known.length?rub(sum):'—','compact-amount'));c.append(head,node('small',[d.documentDate||d.pages?.some(p=>p.documentDate)?dateLabel(purchaseDate(d)):'Дата документа не указана',d.documentNumber?'№ '+d.documentNumber.toUpperCase():'',d.pointId?pointLabel(d):'',ls.length+' поз.',known.length<ls.length?'Сумма неполная':''].filter(Boolean).join(' · '),'compact-meta'));const detail=compactDetails('Товары · '+ls.length);if(d.simpleVersion!==1)detail.append(node('p','Архив старой версии. Оригинальные данные сохранены.','muted'));for(const l of ls)row(detail,l.name,lineSummary(l),node('strong',historyPrice(l),'price'));const footer=node('div',null,'compact-footer');footer.append(detail);const ctl=node('div',null,'controls');const photos=(d.pages||[]).map(p=>p.file).filter(f=>f?.type?.startsWith('image/'));if(!photos.length&&d.original?.type?.startsWith('image/'))photos.push(d.original);if(photos.length)ctl.append(button(photos.length>1?'Фото ('+photos.length+')':'Фото',()=>{const dlg=node('dialog'),urls=[];for(let i=0;i<photos.length;i++){const url=URL.createObjectURL(photos[i]),img=node('img');urls.push(url);img.src=url;img.style.cssText='max-width:85vw;max-height:70vh;object-fit:contain;display:block';dlg.append(node('p','Фото '+(i+1)+' из '+photos.length),img)}dlg.append(button('Закрыть',()=>dlg.close()));dlg.addEventListener('close',()=>{urls.forEach(u=>URL.revokeObjectURL(u));dlg.remove()},{once:true});document.body.append(dlg);dlg.showModal()}));const pdfOriginal=(d.pages||[]).find(p=>p.file?.type==='application/pdf')?.file||(d.original?.type==='application/pdf'?d.original:null);if(pdfOriginal)ctl.append(node('small','PDF сохранён: '+pdfOriginal.name));if(d.simpleVersion===1){ctl.append(button('Редактировать',()=>edit(d)),button('Удалить',async()=>{if(confirm('Удалить накладную?')){await tx('readwrite',s=>s.delete(d.id));await refresh();status('Удалено',true)}}))}for(const b of ctl.querySelectorAll('button'))if(b.textContent==='Удалить')b.classList.add('danger');footer.append(ctl);c.append(footer);$('archive').append(c)}if(!archiveDocs.length)empty($('archive'),'Нет накладных');
}
if(catalog){renderMatchCandidates(last);visionOptions($('categoryFilter'),[['','Все категории'],...[...new Set([...products.values()].map(rs=>categoryFor(catalogTitle(rs[0]))))].sort((a,b)=>a.localeCompare(b,'ru')).map(x=>[x,x])]);$('productList').replaceChildren();for(const offers of [...products.values()].sort((a,b)=>a[0].name.localeCompare(b[0].name,'ru'))){if($('favoriteFilter').value==='favorite'&&!offers.some(r=>catalogState.quality[variantKey(r)]?.favorite))continue;if($('categoryFilter').value&&categoryFor(catalogTitle(offers[0]))!==$('categoryFilter').value)continue;if(!norm(catalogTitle(offers[0])).includes(norm($('search').value))&&!offers.some(r=>norm(r.name).includes(norm($('search').value))))continue;const c=node('div',null,'card compact-product'),title=catalogTitle(offers[0]),head=node('div',null,'product-top'),titleNode=node('h2',title);titleNode.title=title;head.append(titleNode);c.append(head);const bottom=node('div',null,'product-bottom');bottom.append(node('small',categoryFor(title),'tag'));if(offers.some(r=>catalogState.quality[variantKey(r)]?.favorite))bottom.append(node('span','★','tag'));const valid=offers.filter(r=>quotePrice(r)>0&&quoteUnit(r)),comparable=valid.length===offers.length&&valid.every(r=>quoteUnit(r)===quoteUnit(valid[0]));if(comparable&&valid.length){const sorted=valid.slice().sort((a,b)=>quotePrice(a)-quotePrice(b));head.append(node('strong',rub(quotePrice(sorted[0]))+'/'+quoteUnit(sorted[0]),'compact-amount'));c.append(node('p',sorted[0].supplier+' · с НДС','product-supplier'));}const detail=compactDetails('Предложения · '+offers.length);for(const r of offers.sort((a,b)=>quotePrice(a)-quotePrice(b))){row(detail,r.supplier,[r.name,offerDetail(r),qualityDetail(r)].filter(Boolean).join(' · '),node('strong',historyPrice(r),'price'));const link=button('Связать / разделить · качество',()=>productLinkDialog(()=>r,()=>r.supplier,render));link.classList.add('catalog-action');detail.append(link);}bottom.append(detail);c.append(bottom);$('productList').append(c)}if(!$('productList').children.length)empty($('productList'),'Товары не найдены');
}
if(supplier){$('supplierList').replaceChildren();
const docsBySupplier=grouped(ordered,d=>supplierKey(d.supplierId)),obsBySupplier=grouped(obs,r=>supplierKey(r.supplier));
for(const [key,list] of [...suppliers.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru'))){
 const c=node('div',null,'card compact-supplier'),purchases=docsBySupplier.get(key)||[],all=obsBySupplier.get(key)||[],histories=grouped(all,variantKey);
 c.append(node('h2',purchases[0]?.supplierId||list[0].supplier));const profile=supplierProfile(key);c.append(node('small',list.length+' товаров · '+purchases.length+' накладных'+(profile.minimum!=null?' · Мин. '+rub(profile.minimum):''),'compact-meta'));const actions=node('div',null,'supplier-actions');const invoiceButton=button('Накладные',()=>{supplierFilter=key;go('invoices')});invoiceButton.setAttribute('aria-label','Накладные поставщика');actions.append(invoiceButton);
 if(profile.contact||profile.schedule)c.append(node('p',[profile.contact,profile.schedule].filter(Boolean).join(' · '),'supplier-profile'));const profileButton=button('Карточка',()=>supplierDialog(key,purchases[0]?.supplierId||list[0].supplier));profileButton.setAttribute('aria-label','Карточка поставщика');actions.append(profileButton);
 const daily=node('details');daily.append(node('summary','Закупки по дням'));for(const d of dailyPurchases(purchases))row(daily,dateLabel(d.day)||'Дата не указана',d.count+' накл.',node('strong',rub(d.total),'price'));const detail=compactDetails('Подробнее');if(profile.note)detail.append(node('p',profile.note,'muted'));detail.append(daily,node('h2','Товары и история цен'));for(const r of list.sort((a,b)=>a.name.localeCompare(b.name,'ru'))){
  row(detail,r.name,offerDetail(r),node('strong',historyPrice(r),'price'));
  supplierHistory(detail,histories.get(variantKey(r))||[r]);
 }const footer=node('div',null,'compact-footer');footer.append(detail,actions);c.append(footer);
 $('supplierList').append(c);
}if(!suppliers.size)empty($('supplierList'),'Нет поставщиков');
}
if(compare){renderMatchCandidates(last);$('offers').replaceChildren();for(const list of products.values()){const query=norm($('compareSearch').value);if(query&&!norm([catalogTitle(list[0]),...list.flatMap(r=>[r.name,r.supplier])].join(' ')).includes(query))continue;const c=node('div',null,'card compact-compare');c.append(node('h2',catalogTitle(list[0])));const sorted=list.slice().sort((a,b)=>quotePrice(a)-quotePrice(b)),best=sorted[0];for(const r of sorted){const good=sorted.length>1&&new Set(sorted.map(x=>supplierKey(x.supplier))).size>1&&sorted.every(x=>quoteUnit(x)&&quoteUnit(x)===quoteUnit(r)&&quotePrice(x)>0)&&quotePrice(r)===quotePrice(best);const amount=node('div',null,'price compare-price '+(good?'down':''));amount.append(node('strong',quotePrice(r)!=null?rub(quotePrice(r)):'—'));amount.append(node('small',quoteUnit(r)?'за '+quoteUnit(r):'Уточнить единицу'));row(c,r.supplier,[dateLabel(r.date),r.packKg?'Фасовка '+fmt(r.packKg)+' кг':r.packL?'Фасовка '+fmt(r.packL)+' л':'',qualityDetail(r),good?'Лучшая цена':''].filter(Boolean).join(' · '),amount);if(sorted.length<2||!sorted.every(x=>quoteUnit(x)===quoteUnit(r)&&quotePrice(x)>0)||new Set(sorted.map(x=>supplierKey(x.supplier))).size<2)continue;const bar=node('div',null,'offer-bar');const fill=node('i');fill.style.width=(100*quotePrice(r)/Math.max(...sorted.map(quotePrice)))+'%';fill.className=good?'best':r===sorted.at(-1)&&sorted.length>1&&new Set(sorted.map(x=>supplierKey(x.supplier))).size>1&&sorted.every(x=>quoteUnit(x)&&quoteUnit(x)===quoteUnit(r)&&quotePrice(x)>0)?'worst':'';bar.append(fill);c.append(bar);}$('offers').append(c)}if(!$('offers').children.length)empty($('offers'),products.size?'Нет товаров по запросу.':'Загрузите накладные для сравнения.');
 renderOrderAdvice(last);}
 if(home){renderDashboard(obs,last);renderVision(obs,last);}
}
$('orderProduct').onchange=()=>renderOrderAdvice(latest(observations()));$('orderQuantity').oninput=()=>renderOrderAdvice(latest(observations()));$('compareSearch').oninput=()=>render('compare');$('invoiceSearch').oninput=()=>render('invoices');$('search').oninput=() => render('products');$('categoryFilter').onchange=() => render('products');$('favoriteFilter').onchange=() => render('products');$('period').onchange=() => render('home');for(const id of ['visionProduct','visionBasis','trendSelect','reportPoint','alertThreshold'])$(id).onchange=() => render('home');
function edit(d){reset();editing=d.id;pages=Array.isArray(d.pages)?d.pages.slice():d.original?[{key:'legacy',file:d.original,identity:photoFingerprint(d.original),fingerprint:pageFingerprint(d.lines)}]:[];$('supplier').value=d.supplierId;$('documentNumber').value=d.documentNumber||pages.find(p=>p.documentNumber)?.documentNumber||'';$('documentDate').value=d.documentDate||pages.find(p=>p.documentDate)?.documentDate||'';$('invoicePoint').value=Object.prototype.hasOwnProperty.call(POINTS,d.pointId)?d.pointId:'';$('lines').replaceChildren();for(const l of d.lines)addLine({...l,pageKey:l.pageKey||(pages.length===1?pages[0].key:undefined)});showPreview(pages.at(-1)?.file||d.original);pageStatus();showInvoiceIntegrity();go('entry')}
let savingInvoice=false;
$('form').onsubmit=async e=>{e.preventDefault();if(scanBusy||savingInvoice)return;savingInvoice=true;try{const next=e.submitter?.id==='saveNext',supplier=$('supplier').value.trim(),lines=[...$('lines').children].map(f=>{const l=lineData(f);if(!packUnits.includes(l.unit)){l.packKg=null;l.packL=null;}return l});if(!supplier||!lines.length||lines.some(l=>!l.name||!(l.price>0)||!(l.quantity>0)||!l.unit))throw Error('Заполните поставщика, название, количество, единицу и цену с НДС каждой позиции');if([...$('lines').children].some(f=>f.dataset.nameNeedsReview))throw Error('Исправьте искажённые названия товаров по оригиналу перед сохранением');const integrity=invoiceIntegrity(lines,pages,pendingPhoto?photoPassTexts.join('\n---\n'):'',$('documentDate').value);if(integrity.error){showInvoiceIntegrity();if(!confirm(integrity.message+'\n\nСохранить только после ручной сверки с оригиналом?'))return;}const duplicates=grouped(lines,l=>JSON.stringify([norm(l.name),l.pageKey||'']));for(const group of duplicates.values())if(group.length>1&&(!group.every(l=>l.sourceRow&&l.pageKey&&(pages.some(p=>p.key===l.pageKey&&p.smartSimple&&p.expectedTotal!=null)||l.article&&l.article===group[0].article))||new Set(group.map(l=>l.sourceRow)).size!==group.length))throw Error('Есть одинаковые названия. Уточните фасовку или удалите дубль.');if(pages.some(pg=>pg.reviewRequired)&&!confirm('Не все строки накладной автоматически сверены. Сравните количество позиций и общую сумму с оригиналом. Сохранить?'))return;for(const pg of pages){if(pg.expectedTotal==null)continue;const actual=lines.filter(l=>l.pageKey===pg.key).reduce((s,l)=>s+Math.round((grossMetrics(l).totalPrice||0)*100),0)/100;if(Math.abs(actual-pg.expectedTotal)>.01&&!confirm('Сумма страницы '+rub(actual)+' отличается от сверенного итога '+rub(pg.expectedTotal)+'. Сохранить изменённые данные?'))return;}if(pendingPhoto&&!pages.length){if(!confirm('Сохранить вручную сверенные строки вместе с оригиналом накладной?'))return;const meta=pageMeta({},photoPassTexts.join('\n---\n')),key=crypto.randomUUID();for(const l of lines)l.pageKey=key;pages=[{...meta,key,file:pendingPhoto,identity:photoFingerprint(pendingPhoto),fingerprint:pageFingerprint(lines),reviewRequired:true}];pendingPhoto=null;}else if(pendingPhoto&&!confirm('Последнее фото ещё не добавлено. Сохранить только обработанные товары?'))return;if(partialPage&&!confirm('Документ содержит '+partialPage.pages+' страниц. Добавлено '+partialPage.page+'. Сохранить только эту часть?'))return;if(!confirm('Названия, фасовки и цены сверены с оригиналом?'))return;const prior=docs.find(d=>d.id===editing);const doc={id:editing||crypto.randomUUID(),simpleVersion:1,supplierId:supplier,documentNumber:norm($('documentNumber').value).replace(/\s+/g,'')||null,documentDate:$('documentDate').value||null,pointId:$('invoicePoint').value||null,savedAt:prior?.savedAt||new Date().toISOString(),lines,original:pages[0]?.file||(!pendingPhoto?$('file').files[0]:null)||prior?.original||null,pages:pages.slice()};if(docs.some(d=>d.id!==editing&&sameDocument({...d,documentNumber:d.documentNumber||d.pages?.find(p=>p.documentNumber)?.documentNumber},doc)))throw Error('Накладная с этим номером уже сохранена. Откройте её в архиве.');if(!editing&&!doc.documentNumber&&docs.some(d=>d.simpleVersion===1&&supplierKey(d.supplierId)===supplierKey(supplier)&&JSON.stringify(d.lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())===JSON.stringify(lines.map(l=>[norm(l.name),l.price,l.quantity||null,l.unit||'',l.packKg||null,l.packL||null]).sort())&&String(d.savedAt).slice(0,10)===doc.savedAt.slice(0,10))&&!confirm('Такие товары и цены уже сохранены сегодня. Добавить ещё раз?'))return;await tx('readwrite',s=>s.put(doc));dirty=false;supplierFilter=null;await refresh();await autoBackup();if(next){reset();$('supplier').value=supplier;go('entry');status('✓ Накладная сохранена. Добавьте фото следующей.',true)}else{go('invoices');status('✓ Накладная сохранена',true)}}catch(err){status(err.message)}finally{savingInvoice=false}};
function scanLabel(){return scanPass===0?'Распознавание фото':scanPass===1?'Быстрая проверка Paddle OCR':'Углублённая проверка таблицы';}
function showScanProgress(){const el=$('scanProgress');el.replaceChildren();for(const s of scanTrace)el.append(node('div',(s.failed?'⚠ ':'✓ ')+s.label+' · '+fmt(s.seconds)+' с',s.failed?'scan-step':'scan-step done'));if(scanBusy&&stageStartedAt)el.append(node('div','● '+scanLabel()+' · '+fmt(Math.round((performance.now()-stageStartedAt)/100)/10)+' с','scan-step active'));if(!scanBusy&&scanTrace.length)el.append(node('div',scanTrace[scanTrace.length-1].failed?'Товары не извлечены.':'Проверьте результат по оригиналу','scan-step'));}
setInterval(()=>{if(scanBusy)showScanProgress();},500);
window.supplyOcrStart=id=>{if($('entry').classList.contains('hide'))return;ocrId=id;if(!scanStartedAt)scanStartedAt=performance.now();stageStartedAt=performance.now();scanBusy=true;$('save').disabled=true;$('file').disabled=true;$('retry').classList.add('hide');$('ocrState').textContent=scanLabel()+'…';showScanProgress()};
function scanDiagnostic(text){document.getElementById('ocrDiagnostic')?.remove();if(!text)return;const d=node('details');d.id='ocrDiagnostic';d.append(node('summary','Распознанный текст'));const p=node('textarea');p.readOnly=true;p.value=text;p.style.cssText='width:100%;height:150px;font:12px monospace';const copy=button('Копировать весь текст',async()=>{try{await navigator.clipboard.writeText(p.value);status('Текст скопирован',true)}catch{p.focus();p.select();if(document.execCommand('copy'))status('Текст скопирован',true);else status('Текст выделен — скопируйте его через меню телефона')}});d.append(p,copy);$('retry').after(d);p.scrollTop=0}
function scanScore(r){
 const priced=r.items.filter(x=>x.price!=null),complete=priced.filter(x=>x.quantity!=null&&x.unit);
 return (r.documentVerified?1000000:r.balancedInvoice?750000:r.pageVerified?500000:0)+priced.length*1000+complete.length*100+priced.filter(x=>x.packKg!=null).length*20+r.items.length*10+(r.supplier?1:0);
}
function needsPack(x){const p=window.supplyInvoiceParser;return packUnits.includes(x.unit)&&!x.packKg&&!x.packL&&!p.packWeight(x.name)&&!p.packVolume(x.name)&&(!!x.invoiceWeightKg||p.purchaseMetrics(x).basis!=='шт'||/майонез|запекания с массовой долей|сыр(?:\s|$)|сливки|масло(?:\s|$)|рис(?:\s|$)|мука|форель|лосось|креветк/i.test(x.name));}
function scanFieldsComplete(r){return !!r.supplier&&r.items.length>0&&r.items.every(x=>x.name&&x.price>0&&x.quantity>0&&x.unit&&!x.nameNeedsReview)}
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
 // Do not repeat expensive OCR solely for absent packaging on a VAT-balanced UPD.
 if(current.balancedInvoice&&scanFieldsComplete(current)&&!evidence.some(x=>x!==current&&x.documentVerified&&scanConflicts(current,x)))return null;
 const footer=updEvidence(photoPassTexts.join('\n---\n')).printedTotal;
 const gross=current.items.reduce((s,x)=>s+Math.round((Number(x.invoiceTotal)||0)*100),0)/100;
 const footerMismatch=footer!=null&&Math.abs(footer-gross)>.01;
 if(evidence.some(x=>supplierKey(x.supplier)==='ооо марр руссия'))return pass===0?'paddle-scan':'rescan';
 // Re-use the existing on-device Paddle route before the costly focused Tesseract retry.
 if(pass===0)return complete&&!footerMismatch&&!evidence.some(x=>scanConflicts(x,current))?null:'paddle-scan';
 // If two OCR passes found no complete price/quantity/unit row, a third full-image
 // pass usually repeats the same failure. Keep manual re-scan available.
 if(pass===1&&!evidence.some(r=>r.items?.some(x=>x.name&&x.price>0)))return null;
 if(complete&&!footerMismatch&&!evidence.some(x=>scanConflicts(x,current)))return null;
 return 'rescan';
}

function nextScan(path,message){
 scanBusy=true;$('save').disabled=true;$('file').disabled=true;$('retry').classList.add('hide');$('ocrState').textContent=message;
 location.href='https://appassets.androidplatform.net/'+path;
}

function acceptPdf(text,parseStarted,scanError=''){
 const selected=[...$('file').files],photos=selected.length>1&&selected.every(f=>f.type!=='application/pdf');
 const file=pendingPhoto||selected[0]||pages.find(p=>p.file?.type==='application/pdf')?.file;
 if(!file)throw Error('Android не передал выбранное фото в форму. Выберите его ещё раз.');
 const source=JSON.parse(text.slice('FARUKH_PDF_PAGES_V1\n'.length));
 if(!Array.isArray(source)||!source.length||source.length>20||!source.every(x=>typeof x==='string'))throw Error('Не удалось прочитать страницы документа');
 if(photos&&source.length!==selected.length)throw Error('Число фотографий не совпадает с числом страниц OCR');
 const parser=window.supplyInvoiceParser,parsed=source.map(s=>parser.parseSimple(s));
 const suppliers=[...new Map(parsed.filter(x=>x.supplier).map(x=>[supplierKey(x.supplier),x.supplier])).values()];
 const ids=[...new Set(source.map((s,i)=>pageMeta(parsed[i],s).documentNumber).filter(Boolean))];
 if(suppliers.length!==1||ids.length>1)throw Error('Не подтверждён единый поставщик или номер накладной. Не объединяйте разные документы.');
 const supplier=suppliers[0],records=[],rows=[];let review=0,missing=0;
 for(let i=0;i<source.length;i++){
  let r=parsed[i];
  if(!r.supplier){const withHeader=parser.parseSimple('Поставщик: '+supplier+'\n'+source[i]);if(scanScore(withHeader)>scanScore(r))r=withHeader;}
  const key=crypto.randomUUID(),pageFile=photos?selected[i]:(i===0?file:null);
  if(!r.items.length){
   // A final receipt/acceptance page often has only signatures and the grand total.
   // Preserve its page evidence, but never fabricate item rows or auto-approve totals.
   if(source[i].trim()&&/(?:всего\s+передано|всего\s+к\s+оплате|итого\s+по\s+документу)/i.test(source[i])){
    records.push({...updEvidence(source[i]),key,number:i+1,expected:source.length,
     documentNumber:ids[0]||null,documentDate:invoiceHeader(source[i]).documentDate,
     file:pageFile,identity:photoFingerprint(pageFile||file)+'#'+(i+1),
     fingerprint:'footer-only:'+i,footerOnly:true,footerTotal:acceptanceFooterTotal(source[i]),reviewRequired:true});
    review++;
   }else missing++;
   continue;
  }
  if(!r.documentVerified&&!r.pageVerified||r.items.some(x=>x.price==null||x.quantity==null))review++;
  records.push({...updEvidence(source[i]),documentDate:invoiceHeader(source[i]).documentDate,key,number:i+1,expected:source.length,documentNumber:ids[0]||null,file:pageFile,identity:photoFingerprint(pageFile||file)+'#'+(i+1),fingerprint:pageFingerprint(r.items),reviewRequired:!r.documentVerified&&!r.pageVerified});
  for(const item of r.items)rows.push({...item,pageKey:key});
 }
 if(!rows.length)throw Error('В PDF не найдены товарные строки');
 if(!records.some(p=>p.file))records[0].file=file;
 if(pages.length&&!confirm('Заменить результаты текущей накладной выбранными страницами?'))return;
 $('lines').replaceChildren();$('supplier').value=supplier;$('documentNumber').value=ids[0]||'';$('documentDate').value=source.map(s=>invoiceHeader(s).documentDate).find(Boolean)||'';pages=records;activePage=null;pendingPhoto=null;
 for(const row of rows)addLine(row);pageStatus();showInvoiceIntegrity();dirty=true;
 scanTrace.push({label:'Распределение товаров и сверка',seconds:Math.round((performance.now()-parseStarted)/100)/10});scanStartedAt=0;showScanProgress();
 $('ocrState').textContent=(photos?'Фото: ':'PDF: ')+source.length+' стр. · '+rows.length+' позиций. '+(missing?'Не прочитано страниц: '+missing+'. ':'')+(review?'Требуют сверки: '+review+' стр. ':'')+(scanError?scanError+' ':'')+'Сверьте с оригиналом.';
 if(missing||review)scanDiagnostic(source.map((s,i)=>'Страница '+(i+1)+'\n'+s).join('\n---\n'));
}

window.supplyOcrFinish=(id,text,error,spatialJson)=>{
 if(id!==ocrId||$('entry').classList.contains('hide'))return;
 if(stageStartedAt)scanTrace.push({label:scanLabel()+' (получение текста)',seconds:Math.round((performance.now()-stageStartedAt)/100)/10,failed:!!error||!String(text||'').trim()});stageStartedAt=0;const parseStarted=performance.now();scanBusy=false;$('save').disabled=false;$('file').disabled=false;$('retry').classList.remove('hide');
 try{
  if(String(text||'').startsWith('FARUKH_PDF_PAGES_V1\n')){acceptPdf(text,parseStarted,error);return;}
  if(pendingPhoto?.type==='application/pdf'||/\.pdf$/i.test(pendingPhoto?.name||'')){throw Error(error||'PDF не прочитан. Выберите файл повторно.');}
  let current=window.supplyInvoiceParser.parseSimple(text||'');
  // SMART SIMPLE: prefer the direct purchase-only interpretation when it is
  // independently reconciled, or when legacy found no complete rows.
  const simple=window.supplyInvoiceParser.parsePurchaseFields(text||'');
  if(simple&&(simple.documentVerified||(!simple.unparsed&&simple.printedTotal==null&&!current.items.some(x=>x.price!=null&&x.quantity!=null))))current=simple;

  // A focused table crop can omit the header. Carry forward a unique supplier
  // already read from the same photo; never fill one from a preset or a previous invoice.
  const continuationSupplier=pages.length&&!invoiceHeader(text).documentNumber?$('supplier').value.trim():'';const earlierSuppliers=[...new Set([photoSupplier,continuationSupplier,...scanCandidates.map(x=>x.r.supplier)].filter(Boolean))];
  if(!current.supplier&&earlierSuppliers.length===1&&text){
   const contextual=window.supplyInvoiceParser.parseSimple('Поставщик: '+earlierSuppliers[0]+'\n'+text);
   if(scanScore(contextual)>scanScore(current))current=contextual;
  }
  if(current.supplier&&!photoSupplier)photoSupplier=current.supplier;
  if(text&&String(text).trim()&&!photoPassTexts.includes(text))photoPassTexts.push(text);
  // Recover complete table rows from native OCR word coordinates. The text
  // fallback remains untouched for invoices whose layout is not verified.
  // Never guess missing quantities, prices or packing from similar products.
  let recoveredByColumns=false;
  if(spatialJson&&spatialJson!=='[]'&&String(text||'').trim()){
   try{
    const boxes=JSON.parse(spatialJson);
    if(Array.isArray(boxes)&&boxes.length>=8&&boxes.length<=12000){
     const coordinateResult=window.supplySpatial?.candidate(boxes,String(text),current,window.supplyInvoiceParser,updEvidence(String(text)));
     const previousComplete=current.items.filter(x=>x.price>0&&x.quantity>0&&x.unit).length;
     const coordinateComplete=coordinateResult?.items?.filter(x=>x.name&&x.price>0&&x.quantity>0&&x.invoiceTotal>0&&x.unit).length||0;
     const reliable=coordinateResult?.items?.length===coordinateComplete&&!scanConflicts(current,coordinateResult);
     if(!current.documentVerified&&!current.pageVerified&&reliable&&
        (coordinateResult.documentVerified||coordinateResult.pageVerified||coordinateComplete>previousComplete)){
      current=coordinateResult;
      recoveredByColumns=true;
     }
    }
   }catch(e){console.warn('Supply OCR: unsupported spatial table evidence',e?.message||'invalid coordinates');}
  }
  // The native word positions can reflow a rotated UPD into readable rows.
  // Reconciliation still requires each row's VAT and independent document total.
  if(spatialJson&&!current.documentVerified&&!current.balancedInvoice&&/вирго/i.test(current.supplier||'')){
   try{
    const boxes=JSON.parse(spatialJson);
    if(Array.isArray(boxes)&&boxes.length>=8&&boxes.length<=12000){
     const reflow=window.supplySpatial?.spatialLines(boxes)?.map(l=>l.text).join('\n');
     if(reflow){
      const parsed=window.supplyInvoiceParser.parseSimple('Поставщик: ООО «ВИРГО»\n'+reflow);
      const expected=updEvidence(String(text)).printedTotal;
      if(parsed.balancedInvoice&&parsed.items.length&&(!expected||Math.abs(parsed.items.reduce((s,x)=>s+x.invoiceTotal,0)-expected)<.02)&&!scanConflicts(current,parsed)){
       current=parsed;recoveredByColumns=true;
       if(!photoPassTexts.includes(reflow))photoPassTexts.push(reflow);
      }
     }
    }
   }catch(e){console.warn('Supply UPD reflow:',e?.message||'bad coordinates');}
  }
  scanCandidates.push({r:current,text,error});
  const native=location.origin==='https://appassets.androidplatform.net'&&$('file').files.length>0;
  // A missing pack weight alone is not a reason to scan a reconciled invoice again.
  // Preserve the original amount and request an explicit pack weight if unknown.
  const complete=scanFieldsComplete(current); // Missing pack is a review warning, not a reason for OCR retry.
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
  const diagnostic=photoPassTexts.join('\n---\n');const scanCandidatesError=ranked.map(x=>x.error).filter(Boolean).join(' · ');scanTrace.push({label:'Распределение товаров и сверка',seconds:Math.round((performance.now()-parseStarted)/100)/10,failed:!r.items.some(x=>x.price!=null)});const elapsed=(performance.now()-scanStartedAt)/1000;scanStartedAt=0;showScanProgress();scanCandidates=[];scanPass=0;
  if(r.items.length&&r.items.some(x=>x.price!=null)){try{if(!acceptPage(r,diagnostic))return;}catch(err){$('ocrState').textContent=err.message;scanDiagnostic(diagnostic);return;}}
  else if(!pages.length){if(r.supplier)$('supplier').value=r.supplier;const header=invoiceHeader(diagnostic);if(header.documentNumber&&!$('documentNumber').value)$('documentNumber').value=header.documentNumber.toUpperCase();if(header.documentDate&&!$('documentDate').value)$('documentDate').value=header.documentDate;if(r.items.length){$('lines').replaceChildren();for(const l of r.items)addLine(l)}}
  dirty=true;showInvoiceIntegrity();const priced=r.items.filter(x=>x.price!=null).length;
  $('ocrState').textContent=ambiguous?'Разные результаты OCR. Сверьте цены и количество с фото.':r.balancedInvoice&&priced===r.items.length?'Арифметика строк совпадает: '+priced+' из '+r.items.length+' · '+rub(r.items.reduce((s,l)=>s+(grossMetrics(l).totalPrice||0),0))+'. Проверьте количество с фото.':r.documentVerified&&priced===r.items.length?'Сверено строк: '+priced+' из '+r.items.length+'. Итог: '+rub(r.items.reduce((s,l)=>s+(grossMetrics(l).totalPrice||0),0))+'. Сверьте с фото.':priced?'Найдено цен: '+priced+' из '+r.items.length+'. Сверьте строки с фото.':(diagnostic.trim()?'Текст прочитан, но товары и цены не извлечены. Откройте «Распознанный текст» для диагностики.':(scanCandidatesError||'Текст не найден ни на одном этапе. Выберите более чёткое фото.'));
  if(recoveredByColumns)$('ocrState').textContent+=' Колонки восстановлены по расположению на фото; сверьте итог.';
  if(r.quantityCorrections)$('ocrState').textContent+=' ⚠ В '+r.quantityCorrections+' строках количество восстановлено по сумме и цене. Проверьте с накладной.';
  if(r.reviewIssues?.length)$('ocrState').textContent+=' ⚠ Контроль качества: '+r.reviewIssues.slice(0,3).join(' · ')+(r.reviewIssues.length>3?' · и ещё '+(r.reviewIssues.length-3):'')+'.';
  const missingPack=[...$('lines').children].map(lineData).some(needsPack);
  if(Number.isFinite(elapsed))$('ocrState').textContent+=' · '+fmt(Math.round(elapsed*10)/10)+' с';
  if(missingPack&&priced&&!ambiguous)$('ocrState').textContent+=' Фасовка не прочитана. Укажите вес нетто или объём одной упаковки — он сохранится для следующих накладных.';
  if(partialPage)$('ocrState').textContent+=' Добавлено страниц: '+partialPage.page+' из '+partialPage.pages+'. Загрузите остальные фото.';
  if(!priced&&activePage){$('ocrState').textContent='Повторная проверка не улучшила результат. Предыдущие строки сохранены.';}
  if(!priced||ambiguous||priced<r.items.length||missingPack||!r.documentVerified&&!r.pageVerified)scanDiagnostic(diagnostic);else document.getElementById('ocrDiagnostic')?.remove();
  if(native&&!priced&&pendingPhoto&&!activePage){const file=pendingPhoto;queueMicrotask(()=>window.supplyTryLocalAuto?.(id,file));}
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

(function(){
// Experimental local-only model-pack bootstrap. No invoice bytes are sent to any endpoint.
// The signed web code pins each asset by exact size + SHA-256. Cache is separate from invoices.
const version='ocr5-cyrillic-ort1.31.1';
const npm='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
const hf='https://huggingface.co/PaddlePaddle/';
const MODEL_PACK=Object.freeze({
 'ort.wasm.min.mjs':{url:npm+'ort.wasm.min.mjs',size:53725,sha256:'c21d9c326d453a4a61398270c804d5979e118540597cb0c07f7b3d64e6098234'},
 'ort-wasm-simd-threaded.mjs':{url:npm+'ort-wasm-simd-threaded.mjs',size:24738,sha256:'30ed0b5cd1182ede931fea448afb567d4dc705ec957af09f108a2be5f770dac3'},
 'ort-wasm-simd-threaded.wasm':{url:npm+'ort-wasm-simd-threaded.wasm',size:14848852,sha256:'4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d'},
 'det.onnx':{url:hf+'PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx',size:4826518,sha256:'a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d'},
 'rec.onnx':{url:hf+'cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',size:8048799,sha256:'5371ee1ddaa7983cc62d0818d99e982b6804638c85e4f960d59a574094e172e5'},
 'rec.yml':{url:hf+'cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.yml',size:6991,sha256:'5c76cc91fa98410178a09f498db10050d0ec1634a660053d3005ab7be581f501'}
});
const MODEL_PACK_BYTES=Object.values(MODEL_PACK).reduce((a,b)=>a+b.size,0);
const hex=buf=>Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');
async function verifyAsset(name,bytes){
 const spec=MODEL_PACK[name];if(!spec||bytes.byteLength!==spec.size||hex(await crypto.subtle.digest('SHA-256',bytes))!==spec.sha256)throw Error('Неверная контрольная сумма модели: '+name);
 return bytes;
}
async function readModelPack({progress=()=>{},fetchAsset=(name,spec)=>fetch(spec.url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'}),offline=false}={}){
 if(!globalThis.crypto?.subtle||!globalThis.WebAssembly)throw Error('WebView не поддерживает защищённую загрузку моделей');
 const cache=await caches.open('farukh-supply-models-'+version);const result={};let loaded=0;
 for(const [name,spec] of Object.entries(MODEL_PACK)){
  const key=new Request(new URL('/__farukh_models__/'+version+'/'+name,location.origin));
  let bytes;const saved=await cache.match(key);
  if(saved){try{bytes=await verifyAsset(name,await saved.arrayBuffer())}catch{await cache.delete(key)}}
  if(!bytes){if(offline)throw Error('Модель ещё не установлена: '+name);const res=await fetchAsset(name,spec);if(!res.ok)throw Error('Загрузка модели: '+name+' HTTP '+res.status);bytes=await verifyAsset(name,await res.arrayBuffer());await cache.put(key,new Response(bytes));}
  result[name]=bytes;loaded+=spec.size;progress({name,loaded,total:MODEL_PACK_BYTES});
 }
 return result;
}
async function openModelSessions(pack){
 for(const [name,bytes] of Object.entries(pack))await verifyAsset(name,bytes);
 if(Object.keys(MODEL_PACK).some(n=>!pack[n]))throw Error('Неполный комплект моделей');
 const urls=[];const url=(name,mime)=>{const u=URL.createObjectURL(new Blob([pack[name]],{type:mime}));urls.push(u);return u;};
 try{
  const ort=await import(url('ort.wasm.min.mjs','text/javascript'));
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
  ort.env.wasm.wasmPaths={mjs:url('ort-wasm-simd-threaded.mjs','text/javascript')};
  ort.env.wasm.wasmBinary=pack['ort-wasm-simd-threaded.wasm'];
  const options={executionProviders:['wasm'],logSeverityLevel:3};
  let det,rec;try{det=await ort.InferenceSession.create(new Uint8Array(pack['det.onnx']),options);rec=await ort.InferenceSession.create(new Uint8Array(pack['rec.onnx']),options)}catch(e){if(det)await det.release();throw e;}
  return{ort,det,rec,dictionaryYaml:new TextDecoder().decode(pack['rec.yml']),dispose:async()=>{try{await Promise.all([det.release(),rec.release()])}finally{urls.forEach(u=>URL.revokeObjectURL(u))}}};
 }catch(e){urls.forEach(u=>URL.revokeObjectURL(u));throw e;}
}

// Experimental source-only layout recovery. No product, price or invoice constants.
const B=items=>items.filter(b=>b.text?.trim()&&Array.isArray(b.poly)&&b.poly.length===4).map(b=>{let xs=b.poly.map(p=>p[0]),ys=b.poly.map(p=>p[1]);return {t:b.text.trim(),x:xs.reduce((a,b)=>a+b)/4,y:ys.reduce((a,b)=>a+b)/4,l:Math.min(...xs),r:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys),score:b.score??0}});
// Match duplicate OCR header digits by ordered positions, not overwrite by recognition order.
function orderedHeader(boxes,anchor,keys,dy){const m={'9':anchor},at=keys.indexOf('9'),near=boxes.filter(b=>Math.abs(b.y-anchor.y)<dy);let x=anchor.x;for(let i=at-1;i>=0;i--){const a=near.filter(b=>b.t===keys[i]&&b.x<x).sort((a,b)=>b.x-a.x)[0];if(!a)return null;m[keys[i]]=a;x=a.x;}x=anchor.x;for(let i=at+1;i<keys.length;i++){const a=near.filter(b=>b.t===keys[i]&&b.x>x).sort((a,b)=>a.x-b.x)[0];if(!a)return null;m[keys[i]]=a;x=a.x;}return m;}
const norm=t=>t.replace(/\s/g,'').replace(',','.');
const cash=t=>/^\d+\.\d{2}$/.test(norm(t))?Math.round(Number(norm(t))*100):null;
const qty=t=>/^\d+(?:\.\d{1,3})?$/.test(norm(t))?Number(norm(t)):null;
const letters=t=>/[а-яёa-z]/i.test(t), order=(a,b)=>a.y-b.y||a.x-b.x;
const sum=rs=>rs.reduce((s,r)=>s+(r.total??0),0);
const row=(parts,q,p,t,extra={})=>({name:parts.map(b=>b.t).join(' ').trim(),quantity:q,price:p==null?null:p/100,total:t==null?null:t/100,nameReview:!parts.length||parts.some(b=>b.score<.92),rawName:parts.map(b=>b.t),...extra});
function marr(boxes,inherited){
 const header=[];for(const n of boxes.filter(b=>/^Наименование$/i.test(b.t))){const h=boxes.filter(b=>Math.abs(b.y-n.y)<30),get=re=>h.find(b=>re.test(b.t));const c=get(/^код$/i),p=get(/^цена$/i),q=get(/^кол-?во$/i),u=get(/^[ЕE]д\.?$/i),t=get(/^[СC][уy][мm][мm][аa]$/i),w=get(/^[ВB][еe][сc]$/i);if(c&&p&&q&&u&&t&&w)header.push({n,layout:{code:c.x,name:n.x,unit:u.x,qty:q.x,weight:w.x,price:p.x,total:t.x}})}
 const layout=header.length===1?header[0].layout:header.length===0?inherited:null;if(!layout)return null;
 const start=header.length===1?header[0].n.y+25:0;const foot=boxes.filter(b=>b.y>start&&/^итого:?$/i.test(b.t)).sort(order)[0],end=foot?foot.y-20:Infinity;
 const anchors=boxes.filter(b=>b.y>start&&b.y<end&&Math.abs(b.x-layout.code)<75&&/^(?:\d{1,2}\s*\|\s*\d{8,12}|\d{8,14})$/.test(b.t)).sort(order);if(!anchors.length)return null;
 let prev=start;const rows=[];for(const a of anchors){const parts=boxes.filter(b=>b.y>prev+10&&b.y<=a.y+15&&b.l>layout.code+25&&b.r<layout.unit-18&&letters(b.t)&&!/Место хранения/i.test(b.t)).sort(order);const near=boxes.filter(b=>b.y>a.y-28&&b.y<=a.y+20);const pick=(key,fn,shift,limit)=>near.filter(b=>Math.abs(b.x-layout[key]-shift)<limit&&fn(b.t)!=null).sort((b,c)=>Math.abs(b.x-layout[key]-shift)+Math.abs(b.y-a.y)*.2-Math.abs(c.x-layout[key]-shift)-Math.abs(c.y-a.y)*.2)[0];let pb=pick('price',cash,10,40),tb=pick('total',cash,35,65),p=pb&&pb!==tb?cash(pb.t):null,t=tb?cash(tb.t):null;if(p==null){const b=near.find(b=>/^\d+[.,]\d{3}\d+[.,]\d{2}$/.test(b.t.replace(/ /g,''))&&Math.abs(b.x-(layout.weight+layout.price)/2)<65);if(b){const m=b.t.replace(/ /g,'').match(/^(\d+[.,]\d{3})(\d+[.,]\d{2})$/);p=cash(m[2])}}const qb=pick('qty',s=>/^\d{1,4}$/.test(s)?Number(s):null,30,36),rawQ=qb?Number(qb.t):null,estimate=p>0&&t>0?t/p:null,derived=estimate!=null&&Math.abs(estimate-Math.round(estimate))<.0001?Math.round(estimate):null,q=rawQ&&(derived==null||rawQ===derived)?rawQ:derived;rows.push(row(parts,q,p,t,{articleRaw:a.t,quantityDerived:q!==rawQ||rawQ==null,arithmeticOK:q>0&&p>0&&t>0&&Math.abs(q*p-t)<=1}));prev=a.y}
 return {kind:'marr',rows,layout,continuation:!header.length,printedTotal:foot?boxes.filter(b=>Math.abs(b.y-foot.y)<25&&Math.abs(b.x-layout.total-35)<70&&cash(b.t)!=null).sort((a,b)=>Math.abs(a.y-foot.y)-Math.abs(b.y-foot.y)).map(b=>cash(b.t)/100)[0]??null:null};
}
function act(boxes){const hs=[];for(const b of boxes.filter(b=>b.t==='9')){const keys=['2','3','4','8','9','10','12','13','14','15'],m=orderedHeader(boxes,b,keys,8);if(m)hs.push({b,m})}if(hs.length!==1)return null;const {b,m}=hs[0],x=k=>m[k].x,sp=x('10')-x('9'),nameMin=(x('2')+x('3'))/2,nameMax=(x('3')+x('4'))/2;const prices=boxes.filter(a=>a.y>b.y&&Math.abs(a.x-x('9')-sp*.16)<sp*.39&&cash(a.t)>0).sort(order);const rows=[];for(let i=0;i<prices.length;i++){const p=prices[i],totals=boxes.filter(a=>Math.abs(a.y-p.y)<10&&Math.abs(a.x-x('10')-sp*.22)<sp*.4&&cash(a.t)>0);if(totals.length!==1)continue;const pc=cash(p.t),tc=cash(totals[0].t),q=tc/pc;if(Math.abs(q-Math.round(q))>1e-8)continue;const shift=.7*(m['3'].y-b.y),upper=(i?(prices[i-1].y+p.y)/2:(b.y+p.y)/2)+shift,lower=(i+1<prices.length?(prices[i+1].y+p.y)/2:p.y+(i?(p.y-prices[i-1].y)/2:10))+shift;const parts=boxes.filter(a=>a.y>upper&&a.y<=lower&&a.r<x('4')-10&&a.r>nameMin&&a.x<nameMax&&letters(a.t)).sort(order).map(a=>({...a,t:a.t.replace(/^\s*(?:\d{1,3}\s+)?\d{8,14}\s*/,'')}));const match=boxes.some(a=>Math.abs(a.y-p.y)<8&&a.x>x('10')+sp*.75&&a.x<x('12')-sp*.32&&qty(a.t)===q);rows.push(row(parts,Math.round(q),pc,tc,{quantityDerived:!match,arithmeticOK:true,nameBounds:[Math.round(x('2')+(x('3')-x('2'))*.19),Math.round(upper),Math.round(x('4')-20),Math.round(lower)]}))}return rows.length?{kind:'act',rows,printedTotal:null,expectedRows:prices.length}:null;}
function upd(boxes){const hs=[],direct=boxes.filter(b=>b.t==='9'),virtual=[];for(const a of boxes.filter(b=>b.t==='8'))for(const c of boxes.filter(b=>b.t==='10')){const gap=c.x-a.x;if(gap<50||gap>180||Math.abs(c.y-a.y)>12||direct.some(b=>Math.abs(b.y-(a.y+c.y)/2)<12&&b.x>a.x&&b.x<c.x))continue;virtual.push({t:'9',x:(a.x+c.x)/2,y:(a.y+c.y)/2,inferred:true});}for(const b of [...direct,...virtual]){const keys=['2','3','8','9','10'],m=orderedHeader(boxes,b,keys,17);if(!m)continue;const sp=m['9'].x-m['8'].x;if(m['3'].x-m['2'].x>.5*sp&&m['3'].x-m['2'].x<2*sp)hs.push({b,m,sp})}if(hs.length!==1)return null;const {b,m,sp}=hs[0],x=k=>m[k].x,start=b.y+7;let foot=boxes.filter(a=>a.y>start&&a.x<x('2')&&/(?:всего|[bвdсs][cс]его|[bвdсs][cс]ero)\s+.{0,12}(?:оплат|[oо]nnат|[oо]nnaт)/i.test(a.t));if(!foot.length)foot=boxes.filter(a=>a.y>start&&a.x<x('2')&&/руководитель|главный бухгалтер/i.test(a.t));if(!foot.length)return null;const end=Math.min(...foot.map(a=>a.y))+4,gross=boxes.filter(a=>a.y>start&&a.y<end&&Math.abs(a.x-x('9')-sp*.15)<sp*.47&&cash(a.t)!=null).sort(order);if(gross.length<2)return null;const control=gross.pop();const near=(g,center,fn,width,dy=12)=>boxes.filter(a=>Math.abs(a.x-center)<sp*width&&Math.abs(a.y-g.y)<=dy&&fn(a.t)!=null).sort((a,b)=>Math.abs(a.x-center)+Math.abs(a.y-g.y)*.5-Math.abs(b.x-center)-Math.abs(b.y-g.y)*.5)[0];const rows=gross.map((g,i)=>{const lo=g.y-2,hi=(gross[i+1]??control).y-2,parts=boxes.filter(a=>a.y>lo&&a.y<hi&&a.l>x('2')-sp*4.6&&a.r<x('2')-sp*.35&&/[а-яa-z]{2}/i.test(a.t)).sort(order);const qfn=s=>/^\d+\.\d{1,3}$|^\d{1,2}$/.test(norm(s))?Number(norm(s)):null,qb=near(g,x('3')+sp*.07,qfn,.38,15),nb=near(g,x('9')-sp*3.1,cash,.52),ub=near(g,x('9')-sp*4.2,cash,.50);let q=qb?qfn(qb.t):null,derived=false;const net=nb?cash(nb.t):null,unit=ub?cash(ub.t):null,rates=[...new Set(boxes.filter(a=>Math.abs(a.y-g.y)<9&&a.x>x('9')-sp*2.7&&a.x<x('9')-sp*1.6).flatMap(a=>[...a.t.matchAll(/(?:^|\s)(\d{1,2})\s*%/g)].map(m=>Number(m[1]))).filter(v=>[0,5,7,10,20,22].includes(v)))],rate=rates.length===1?rates[0]:null,t=cash(g.t);if(q==null&&unit>0&&rate!=null){const guess=t*100/(unit*(100+rate));if(Math.round(guess)>0&&Math.abs(guess-Math.round(guess))<.005){q=Math.round(guess);derived=true}}const p=q>0?Math.round(t/q):null,conflicts=[];if(unit&&rate!=null&&p&&Math.abs(unit*(100+rate)/100-p)>2)conflicts.push('net-unit');if(net&&rate!=null&&Math.abs(net*(100+rate)/100-t)>2)conflicts.push('net-row');return row(parts,q,p,t,{rate,quantityDerived:derived,arithmeticOK:q>0&&p>0&&Math.abs(p*q-t)<=1,conflicts})});return{kind:'upd',rows,printedTotal:cash(control.t)/100,headerInferred:!!b.inferred};}
function extractLayout(items,options={}){const boxes=B(items);const candidates=[marr(boxes,options.continuationLayout),act(boxes),upd(boxes)].filter(Boolean);if(candidates.length!==1)return{rows:[],error:'Не удалось однозначно определить таблицу'};const r=candidates[0];r.sum=Math.round(sum(r.rows)*100)/100;r.totalOK=r.printedTotal!=null&&Math.round(r.printedTotal*100)===Math.round(r.sum*100);r.reviewRequired=true;return r;}

// Local OCR engine: use a verified model pack, never send a photo to an API.


let sessionPromise=null;
function dictionary(yaml){const lines=yaml.split(/\r?\n/),i=lines.findIndex(x=>/^\s+character_dict:\s*$/.test(x));if(i<0)throw Error('Missing character dictionary');const a=[];for(const line of lines.slice(i+1)){const m=line.match(/^  - (.*)$/);if(!m)break;let v=m[1];if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1).replace(/''/g,"'");else if(v.startsWith('"')&&v.endsWith('"'))v=JSON.parse(v);if([...v].length!==1)throw Error('Invalid character');a.push(v);}if(a.length!==850)throw Error('Incorrect character count');return ['',...a,' '];}
async function load(progress,offline){if(!sessionPromise)sessionPromise=readModelPack({progress:v=>progress('Модели '+Math.round(v.loaded*100/v.total)+'%'),offline}).then(openModelSessions).then(s=>({...s,chars:dictionary(s.dictionaryYaml)})).catch(e=>{sessionPromise=null;throw e;});return sessionPromise;}
const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
function hull(points){points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const l=[],u=[];for(const p of points){while(l.length>1&&cross(l.at(-2),l.at(-1),p)<=0)l.pop();l.push(p);}for(let i=points.length-1;i>=0;i--){const p=points[i];while(u.length>1&&cross(u.at(-2),u.at(-1),p)<=0)u.pop();u.push(p);}return [...l.slice(0,-1),...u.slice(0,-1)];}
function minRect(points){const h=hull(points);if(h.length<3)return null;let best=null;for(let i=0;i<h.length;i++){const a=h[i],b=h[(i+1)%h.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!len)continue;const ux=(b[0]-a[0])/len,uy=(b[1]-a[1])/len;let l=Infinity,r=-Infinity,t=Infinity,bt=-Infinity;for(const p of h){const x=p[0]*ux+p[1]*uy,y=-p[0]*uy+p[1]*ux;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);bt=Math.max(bt,y);}const w=r-l,ht=bt-t,area=w*ht;if(!best||area<best.area)best={ux,uy,l,r,t,bt,w,ht,area};}return best;}
function polys(map,w,h,ow,oh){const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),out=[];for(let start=0;start<map.length;start++){if(seen[start]||map[start]<=.3)continue;let head=0,tail=1,score=0;queue[0]=start;seen[start]=1;const edges=[];while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w);score+=map[k];let boundary=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h){boundary=true;continue;}const j=yy*w+xx;if(map[j]<=.3){boundary=true;continue;}if(!seen[j]){seen[j]=1;queue[tail++]=j;}}if(boundary)edges.push([x,y]);}if(tail<12||score/tail<.5||edges.length<3)continue;const a=minRect(edges);if(!a||Math.min(a.w,a.ht)<2)continue;const d=1.35*a.w*a.ht/(2*(a.w+a.ht));const xy=(x,y)=>[(x*a.ux-y*a.uy)*ow/w,(x*a.uy+y*a.ux)*oh/h];const p=[xy(a.l-d,a.t-d),xy(a.r+d,a.t-d),xy(a.r+d,a.bt+d),xy(a.l-d,a.bt+d)].sort((a,b)=>a[0]-b[0]);const left=p.slice(0,2).sort((a,b)=>a[1]-b[1]),right=p.slice(2).sort((a,b)=>a[1]-b[1]);out.push([left[0],right[0],right[1],left[1]]);}return out;}
function sample(im,x,y,ch){const w=im.width,h=im.height,d=im.data; x=Math.min(w-1,Math.max(0,x));y=Math.min(h-1,Math.max(0,y));const l=Math.floor(x),t=Math.floor(y),r=Math.min(w-1,l+1),b=Math.min(h-1,t+1),u=x-l,v=y-t;const c=2-ch;return (d[(t*w+l)*4+c]*(1-u)+d[(t*w+r)*4+c]*u)*(1-v)+(d[(b*w+l)*4+c]*(1-u)+d[(b*w+r)*4+c]*u)*v;}
function imageTensor(im,w,h,normalize){const n=w*h,a=new Float32Array(3*n);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sx=(x+.5)*im.width/w-.5,sy=(y+.5)*im.height/h-.5;for(let j=0;j<3;j++)a[j*n+y*w+x]=normalize(Math.round(sample(im,sx,sy,j)),j);}return a;}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function crop(im,p){let [tl,tr,br,bl]=p;let w=Math.max(2,Math.floor(Math.max(dist(tl,tr),dist(bl,br)))),h=Math.max(2,Math.floor(Math.max(dist(tl,bl),dist(tr,br))));if(h>w*1.5){[tl,tr,br,bl]=[tr,br,bl,tl];[w,h]=[h,w];}const actual=Math.min(640,Math.ceil(48*w/h)),width=Math.min(640,Math.max(64,Math.ceil((48*w/h+16)/64)*64));const n=48*width,buf=new Float32Array(n*3);for(let y=0;y<48;y++)for(let x=0;x<Math.min(actual,width);x++){const u=Math.max(0,Math.min(w-1,(x+.5)*w/actual-.5))/(w-1),v=Math.max(0,Math.min(h-1,(y+.5)*h/48-.5))/(h-1),sx=(tl[0]*(1-u)+tr[0]*u)*(1-v)+(bl[0]*(1-u)+br[0]*u)*v,sy=(tl[1]*(1-u)+tr[1]*u)*(1-v)+(bl[1]*(1-u)+br[1]*u)*v;for(let j=0;j<3;j++)buf[j*n+y*width+x]=Math.round(sample(im,sx,sy,j))/127.5-1;}return{buf,width};}
let busy=false;
async function scanPhoto(file,options={}){if(!file||!file.type?.startsWith('image/'))throw Error('Выберите фотографию');const im=await createImageBitmap(file);try{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);return await scanRaster(ctx.getImageData(0,0,im.width,im.height),options);}finally{im.close();}}
async function scanRaster(im,{progress=()=>{},continuationLayout=null,offline=false,sessions=null}={}){if(busy)throw Error('Дождитесь окончания распознавания');busy=true;try{const t=performance.now();progress('Загрузка моделей');const {ort,det,rec,chars}=sessions||await load(progress,offline);const ow=im.width,oh=im.height,scale=Math.min(1,3200/Math.max(ow,oh)),w=Math.max(32,Math.round(ow*scale/32)*32),h=Math.max(32,Math.round(oh*scale/32)*32),mean=[.485,.456,.406],std=[.229,.224,.225];progress('Распознавание областей');const x=imageTensor(im,w,h,(v,j)=>(v/255-mean[j])/std[j]);const ds=await det.run({[det.inputNames[0]]:new ort.Tensor('float32',x,[1,3,h,w])}),o=Object.values(ds)[0];const boxes=polys(o.data,o.dims.at(-1),o.dims.at(-2),ow,oh);o.dispose?.();const groups={};for(const p of boxes){const c=crop(im,p);if(c)(groups[c.width]??=[]).push({...c,p});}const items=[];let done=0;for(const [widthStr,g] of Object.entries(groups)){const width=Number(widthStr);for(let i=0;i<g.length;i+=8){const batch=g.slice(i,i+8),n=3*48*width,v=new Float32Array(batch.length*n);batch.forEach((c,j)=>v.set(c.buf,j*n));const r=await rec.run({[rec.inputNames[0]]:new ort.Tensor('float32',v,[batch.length,3,48,width])}),y=Object.values(r)[0],T=y.dims[1],C=y.dims[2];if(C!==chars.length)throw Error('Model dictionary mismatch');for(let j=0;j<batch.length;j++){let text='',prev=-1,conf=[];for(let k=0;k<T;k++){let off=(j*T+k)*C,max=-Infinity,best=-1;for(let c=0;c<C;c++){const a=y.data[off+c];if(a>max){max=a;best=c;}}if(best!==prev&&best!==0){text+=chars[best]||'?';conf.push(max);}prev=best;}if(text.trim())items.push({text,score:conf.length?conf.reduce((a,b)=>a+b)/conf.length:0,poly:batch[j].p});}y.dispose?.();done+=batch.length;progress('Текст: '+done+' / '+boxes.length);}}const result=extractLayout(items,{continuationLayout});return {items,result,seconds:(performance.now()-t)/1000};}finally{busy=false;}}

window.supplySmartScan={scanPhoto,modelBytes:MODEL_PACK_BYTES};
})();

(function(){
 const retry=$('retry'),smart=button('Проверить таблицу (PaddleOCR)',()=>runSmart());
 smart.type='button';smart.id='smartScan';retry.append(smart);
 let running=false,autoAttempted=null;
 function rawText(items){
  const words=items.map(x=>({t:x.text,x:x.poly.reduce((s,p)=>s+p[0],0)/4,y:x.poly.reduce((s,p)=>s+p[1],0)/4})).sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines=[];for(const w of words){const a=lines.at(-1);if(a&&Math.abs(a.y-w.y)<7)a.words.push(w);else lines.push({y:w.y,words:[w]});}
  return lines.map(l=>l.words.sort((a,b)=>a.x-b.x).map(w=>w.t).join(' ')).join('\n');
 }
 function propose(result,raw){
  const p=window.supplyInvoiceParser,old=photoPassTexts.map(t=>p.parseSimple(t)),parsed=p.parseSimple(raw);
  const names=new Map([parsed,...old].filter(x=>x.supplier).map(x=>[supplierKey(x.supplier),x.supplier]));
  const supplier=names.size===1?[...names.values()][0]:$('supplier').value.trim();
  const prior=[...old.flatMap(x=>x.items),...parsed.items];
  const rows=result.rows.map((r,i)=>{
   const matches=prior.filter(x=>x.quantity===r.quantity&&Math.abs(grossRow(x).price-r.price)<.011&&x.unit&&x.name&&norm(x.name).includes(norm(r.name).slice(0,Math.min(12,r.name.length))));
   const units=[...new Set(matches.map(x=>x.unit))],unit=units.length===1?units[0]:'';
   return {name:r.name,price:r.price,quantity:r.quantity,invoiceTotal:r.total,unit,packKg:p.packWeight(r.name),packL:p.packVolume(r.name),uncertain:true,sourceRow:i+1};
  });
  return {supplier,items:rows,documentVerified:false,pageVerified:false};
 }
 async function runSmart(automatic=false){
  if(running||scanBusy)return;
  const file=pendingPhoto||pages.find(p=>p.key===activePage)?.file||$('file').files[0];
  if(!file?.type?.startsWith('image/')){status('Выберите фотографию');return;}
  if(!automatic&&!confirm('Дополнительная проверка PaddleOCR. При первом запуске загрузятся модели (около 28 МБ). Фото остаётся на устройстве. Результат нужно сверить. Продолжить?'))return;
  running=true;scanBusy=true;smart.disabled=true;$('rescan').disabled=true;$('save').disabled=true;$('saveNext').disabled=true;$('file').disabled=true;
  const original=file,started=performance.now(),requestId=ocrId,previousMessage=$('ocrState').textContent;let message='';
  try{
   const output=await window.supplySmartScan.scanPhoto(file,{progress:v=>{if(ocrId===requestId&&!$('entry').classList.contains('hide'))$('ocrState').textContent='PaddleOCR · проверка таблицы: '+v;}});
   if(ocrId!==requestId||(pendingPhoto||pages.find(p=>p.key===activePage)?.file||$('file').files[0])!==original||$('entry').classList.contains('hide'))return;
   const r=output.result,raw=rawText(output.items);
   if(!r.rows.length)throw Error(r.error||'Таблица не распознана');
   if(r.rows.some(x=>!x.name||!(x.quantity>0)||!(x.price>0)||!(x.total>0)||!x.arithmeticOK||x.conflicts?.length)||r.expectedRows&&r.expectedRows!==r.rows.length||r.printedTotal!=null&&!r.totalOK)throw Error('Не все строки прошли проверку; старые данные сохранены.');
   const candidate=propose(r,raw);if(!candidate.supplier)throw Error('Поставщик не подтверждён; старые данные сохранены.');
   const preview=r.rows.map((x,i)=>(i+1)+'. '+x.name+' — '+x.quantity+' × '+rub(x.price)+' = '+rub(x.total)).join('\n');
   scanDiagnostic(raw);
   if(!automatic&&!confirm('SMART SCAN: '+candidate.supplier+' · '+r.rows.length+' строк, сумма '+rub(r.sum)+'. '+(r.totalOK?'Итог совпал.':'Итог документа не подтверждён.')+'\nНазвания и единицы требуют проверки. Заменить строки на этой странице?\n\n'+preview.slice(0,1500)))return;
   if(!acceptPage(candidate,raw))return;
   dirty=true;showInvoiceIntegrity();message=(automatic?'PaddleOCR · автоматически: ':'SMART SCAN (тест): ')+r.rows.length+' строк · '+rub(r.sum)+' · '+fmt(Math.round((performance.now()-started)/100)/10)+' с. Сверьте поставщика, названия, единицы и суммы с фото.';
  }catch(e){message=automatic?previousMessage+' · Дополнительная проверка не помогла.':'SMART SCAN: '+(e.message||'Ошибка распознавания')+' Старое распознавание доступно.';}
  finally{running=false;smart.disabled=false;$('rescan').disabled=false;if(ocrId===requestId&&!$('entry').classList.contains('hide')){scanBusy=false;$('save').disabled=false;$('saveNext').disabled=false;$('file').disabled=false;if(message)$('ocrState').textContent=message;}}
 }
 window.supplyTryLocalAuto=(id,file)=>{if(id!==ocrId||!file||file!==pendingPhoto||autoAttempted===file||running||scanBusy||activePage||$('entry').classList.contains('hide')||[...$('lines').children].some(f=>{const l=lineData(f);return l.price!=null||l.quantity!=null;}))return;autoAttempted=file;return runSmart(true);};
})();

/* PP_STRUCTURE_IMPORT_BEGIN */
function structureImport(raw){
 const entries=JSON.parse(raw);
 if(!Array.isArray(entries)||!entries.length||entries.length>250)throw Error('Некорректный отчёт PP-StructureV3');
 if(entries.some(p=>!p||p.error||!Array.isArray(p.tables)||!Array.isArray(p.text)||!p.text.every(x=>typeof x==='string')||typeof p.file!=='string'))throw Error('В отчёте есть непрочитанные страницы. Повторите OCR.');
 if(new Set(entries.map(p=>p.file)).size!==1)throw Error('Импортируйте одну накладную за раз: один PDF или одно фото.');
 const pageIds=entries.map(p=>p.page);
 if(pageIds.some(x=>!Number.isInteger(x)||x<1)||new Set(pageIds).size!==entries.length||pageIds.some((x,i)=>x!==i+1))throw Error('Нарушен порядок страниц.');
 const key=s=>String(s??'').toLowerCase().replace(/ё/g,'е').replace(/[\s.,:;()]/g,'');
 const number=s=>{const x=String(s??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');return /^\d+(?:\.\d+)?$/.test(x)&&Number.isFinite(+x)&&+x>0?+x:null};
 const unit=s=>({кг:'кг',г:'г',л:'л',мл:'мл',шт:'шт',штука:'шт',штук:'шт',уп:'уп',упак:'уп',упаковка:'уп',кор:'кор',коробка:'кор'})[key(s)]||'';
 const items=[],warnings=[];let missing=0;
 for(const p of entries){
  let recognized=0;
  for(const table of p.tables){
   if(!Array.isArray(table)||table.some(r=>!Array.isArray(r)||r.some(x=>typeof x!=='string')))throw Error('Повреждена таблица');
   let cols=null;
   for(const r of table){
    const k=r.map(key);
    const find=re=>k.findIndex(x=>re.test(x));
    const h={name:find(/^(наименование(?:товара|продукции)?|товар|названиетовара|номенклатура)$/),quantity:find(/^(количество|колво|кол)$/),unit:find(/^(ед|едизм|единица|единицаизмерения)$/),price:find(/^(цена(?:заед)?сндс|ценасучетомндс|ценавключаяндс)$/),total:find(/^(суммасндс|стоимостьсндс|всегосндс|суммакоплате)$/)};
    if(h.name>=0&&h.quantity>=0&&(h.price>=0||h.total>=0)){cols=h;recognized++;continue}
    if(!cols)continue;
    if(!r.some(x=>x.trim()))continue;
    if(/^(итого|всегокоплате|всего)$/.test(k[cols.name]||k.find(Boolean)||'')){
     const printed=number(r[cols.total]);if(printed!=null){const actual=items.filter(x=>x.sourcePage===p.page).reduce((s,x)=>s+(x.invoiceTotal||0),0);if(Math.abs(actual-printed)>.01)warnings.push('Стр. '+p.page+': итог не совпадает.');}continue
    }
    const name=(r[cols.name]||'').trim();const quantity=number(r[cols.quantity]);let price=number(r[cols.price]);const invoiceTotal=number(r[cols.total]);const u=unit(r[cols.unit]);
    if(!name||!quantity||(!price&&!invoiceTotal)){missing++;continue}
    if(price==null&&invoiceTotal!=null)price=invoiceTotal/quantity;
    if(invoiceTotal!=null&&Math.abs(quantity*price-invoiceTotal)>.02)warnings.push('Стр. '+p.page+': сумма строки не совпадает — '+name);
    if(!u)warnings.push('Уточните единицу: '+name);
    items.push({name,quantity,price,unit:u,invoiceTotal,sourcePage:p.page,uncertain:true,ocrOriginalName:name});
   }
  }
  if(!recognized)warnings.push('Стр. '+p.page+': не найдены однозначные заголовки товара, количества и цены/суммы с НДС.');
 }
 if(!items.length)throw Error('Не найдены надёжно размеченные товарные строки. Используйте ручной ввод или исходный текст.');
 if(items.length>5000)throw Error('Слишком много строк');
 if(missing)warnings.push('Не импортировано строк: '+missing+'. Добавьте их по оригиналу.');
 return {items,warnings,text:entries.map(p=>p.text.join('\n')).join('\n---\n')};
}
/* PP_STRUCTURE_IMPORT_END */
$('structureImportButton').onclick=()=>{
 try{
  if(scanBusy||savingInvoice)throw Error('Завершите текущую обработку');
  if(editing||pages.length||pendingPhoto||[...$('lines').children].some(f=>lineData(f).name))throw Error('Откройте новую пустую накладную для импорта PP-StructureV3.');
  const input=$('structureJson').value.trim();if(input.length>4000000)throw Error('Отчёт слишком большой');
  const r=structureImport(input);
  const headers=invoiceHeader(r.text),parsed=window.supplyInvoiceParser.parseSimple(r.text);
  const sourceSupplier=parsed.supplier||'';
  if(sourceSupplier)$('supplier').value=sourceSupplier;
  if(headers.documentNumber)$('documentNumber').value=headers.documentNumber.toUpperCase();
  if(headers.documentDate)$('documentDate').value=headers.documentDate;
  $('lines').replaceChildren();
  for(const item of r.items)addLine(item);
  $('structureJson').value='';dirty=true;showInvoiceIntegrity();
  $('ocrState').textContent='PP-StructureV3: '+r.items.length+' строк. Сверка с оригиналом обязательна.';
  $('structureWarnings').textContent=r.warnings.join('\n')||'Проверьте названия, цены, фасовку и реквизиты.';
  scanDiagnostic(r.text);
 }catch(e){$('structureWarnings').textContent=e.message||'Не удалось импортировать отчёт';}
};

// Optional automatic PP-StructureV3 endpoint. Native OCR remains the fallback.
// No photo is transmitted until the user explicitly enables their private server.
(function(){
 const nativeFinish=window.supplyOcrFinish, nativeStart=window.supplyOcrStart;
 let cfg=null, attempted=null, busy=false;
 const set=$('structureAutoSave'), url=$('structureEndpoint'), token=$('structureToken'), enabled=$('structureAuto');
 try{const old=JSON.parse(localStorage.getItem('supplyStructureEndpoint')||'null');if(old){url.value=old.url;token.value=old.token;enabled.checked=true;cfg=old;}}catch{}
 set.onclick=()=>{
  try{
   if(!enabled.checked){cfg=null;localStorage.removeItem('supplyStructureEndpoint');url.value='';token.value='';$('structureWarnings').textContent='Автоматический PP-StructureV3 отключён.';return;}
   const endpoint=new URL(url.value.trim());
   if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/v1/ocr'||token.value.trim().length<32)throw Error('Укажите HTTPS-адрес /v1/ocr и ключ доступа (от 32 символов).');
   if(!confirm('Фотографии накладных будут автоматически отправляться на указанный вами сервер. Включить?'))return;
   cfg={url:endpoint.href,token:token.value.trim()};localStorage.setItem('supplyStructureEndpoint',JSON.stringify(cfg));$('structureWarnings').textContent='Автоматический PP-StructureV3 включён.';
  }catch(e){$('structureWarnings').textContent=e.message;}
 };
 window.supplyOcrStart=id=>{nativeStart(id);};
 window.supplyOcrFinish=async(id,text,error,spatialJson)=>{
  const file=pendingPhoto||$('file').files[0];
  if(String(text||'').startsWith('FARUKH_PDF_PAGES_V1\n'))return nativeFinish(id,text,error,spatialJson);
  if(!cfg||busy||id!==ocrId||!file?.type?.startsWith('image/')||attempted===file||$('entry').classList.contains('hide'))return nativeFinish(id,text,error,spatialJson);
  attempted=file;busy=true;const settings={...cfg};$('saveNext').disabled=true;
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
  $('ocrState').textContent='PP-StructureV3: распознавание таблицы…';
  try{
   const body=new FormData();body.append('image',file,'invoice');
   const response=await fetch(settings.url,{method:'POST',headers:{Authorization:'Bearer '+settings.token},body,signal:controller.signal,redirect:'error',cache:'no-store'});
   if(!response.ok)throw Error('Сервер OCR: '+response.status);
   const raw=await response.text();if(raw.length>4000000)throw Error('Слишком большой результат');
   const r=structureImport(raw);
   if(id!==ocrId||$('entry').classList.contains('hide')||pendingPhoto!==file)return;
   // Do not auto-accept incomplete or contradictory monetary rows.
   if(r.warnings.some(w=>/итог не совпадает|сумма строки не совпадает|не импортировано|не найдены однозначные/i.test(w)))throw Error('Таблица требует сверки');
   const parsed=window.supplyInvoiceParser.parseSimple(r.text);
   if(!parsed.supplier)throw Error('Поставщик не распознан');
   if(!acceptPage({supplier:parsed.supplier,items:r.items,documentVerified:false,pageVerified:false},r.text))throw Error('Страница не принята');
   scanBusy=false;dirty=true;$('save').disabled=false;$('file').disabled=false;$('retry').classList.remove('hide');stageStartedAt=0;scanStartedAt=0;showScanProgress();
   $('ocrState').textContent='PP-StructureV3: '+r.items.length+' строк. Сверьте названия, единицы и суммы с оригиналом.';
   $('structureWarnings').textContent=r.warnings.join('\n');scanDiagnostic(r.text);
  }catch(e){
   if(id===ocrId&&!$('entry').classList.contains('hide')){nativeFinish(id,text,error,spatialJson);$('structureWarnings').textContent='PP-StructureV3 недоступен или результат неполный. Использован резервный OCR.';}
  }finally{clearTimeout(timer);busy=false;$('saveNext').disabled=false;}
 };
})();
