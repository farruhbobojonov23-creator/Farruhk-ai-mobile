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
module.exports={extractTable};
