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
 if(/^(наименование|товар|номенклатура|продукция)$/.test(t))return 'name';
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
function candidate(boxes,raw,base,parser,upd){
 const lines=spatialLines(boxes);
 if(!lines.length||!base?.supplier||base.documentVerified||base.pageVerified)return null;
 if(upd?.structured){
  // Use the original text's independent VAT-inclusive footer, never a guessed tax rate.
  if(upd.conflictingTotals||!(upd.printedTotal>0))return null;
  const reflow=lines.map(l=>l.text).join('\n');
  const r=parser.parseSimple(reflow);
  if(!r.documentVerified||!r.supplier||r.supplier.toLowerCase()!==base.supplier.toLowerCase()||!r.items.length||r.items.some(x=>!(x.quantity>0&&x.price>0&&x.invoiceTotal>0)||!x.unit))return null;
  if(Math.round(r.items.reduce((s,x)=>s+x.invoiceTotal,0)*100)!==Math.round(upd.printedTotal*100))return null;
  return {...r,spatialVerified:true};
 }
 // VAT/transport layouts must not be interpreted as a simple price × quantity table.
 if(/НДС|товарно[- ]транспортная|сч[её]т[- –]фактура/i.test(raw))return null;
 const result=spatialSimple(lines);
 if(!result)return null;
 const items=result.items.map(x=>{
  const unit=unitName(x.unit),name=x.name+' / '+unit;
  const item={name,unit,quantity:x.quantity,price:x.price,invoiceTotal:x.total,packKg:parser.packWeight(name),packL:parser.packVolume(name),uncertain:true,source:x.name};
  return {...item,...parser.lineMetrics(item)};
 });
 return {...base,items,documentVerified:true,spatialVerified:true};
}
const api={extractTable,spatialLines,spatialSimple,candidate};
if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.supplySpatial=api;

})();
