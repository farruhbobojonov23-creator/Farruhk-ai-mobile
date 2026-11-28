/* Frontpad screenshot table reader. Only evidence from THIS screenshot is used;
   no supplier SKUs/prices/photos are embedded. Any ambiguity requires review. */
;(function(root){
'use strict';
const clean=s=>String(s??'').normalize('NFKC').replace(/[\u00a0\u202f]/gu,' ').replace(/\s+/gu,' ').trim();
const number=s=>{const x=clean(s).replace(/\s/gu,'').replace(',','.');return /^\d{1,9}(?:\.\d{1,3})?$/u.test(x)?Number(x):null};
const money=s=>{const x=clean(s).replace(/руб(?:лей|\.)?/giu,'').replace(/₽/gu,'');const m=[...x.matchAll(/(?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{1,2}/gu)];return m.length===1?number(m[0][0]):null};
const unit=s=>{const m=clean(s).toLowerCase().match(/(?:^|\s)(кг|шт|упак|уп|л|г)(?=[.\s,;:]|$)/u);return m?(m[1]==='упак'?'уп':m[1]):''};
const quantity=s=>{const m=clean(s).toLowerCase().match(/(\d+(?:[,.]\d{1,3})?)\s*(кг|шт|упак|уп|л|г)(?=[.\s,;:]|$)/u);return m?{value:number(m[1]),unit:unit(m[2])}:null};
const cent=x=>Math.round(x*100);
function match(q,p,t){if(!(q>0&&p>0&&t>0))return null;
 if(Math.abs(q*p-t)<=Math.max(.035,q*.0051+.02))return {quantity:q,corrected:false};
 const guess=Math.round(t/p*1000)/1000;
 // A digit-confusion hypothesis is only a proposed correction, not a fact.
 if(guess>0&&Math.abs(guess*p-t)<=Math.max(.035,guess*.0051+.02)&&
    Math.abs(guess-q)<=30&&String(guess).split('.').at(-1)===String(q).split('.').at(-1))
  return {quantity:guess,corrected:true};
 return null;
}
function parseWords(items,{width,supplier=''}={}){
 if(!Array.isArray(items)||!(width>0)||items.length<8||items.length>12000)return null;
 const words=items.map(x=>{
  const p=x.poly;if(!Array.isArray(p)||p.length<4||!p.every(z=>Array.isArray(z)&&z.length>=2))return null;
  const cx=p.reduce((s,z)=>s+Number(z[0]),0)/4,cy=p.reduce((s,z)=>s+Number(z[1]),0)/4;
  const h=Math.max(...p.map(z=>Number(z[1])))-Math.min(...p.map(z=>Number(z[1])));
  return {s:clean(x.text),x:cx,y:cy,h,confidence:x.score};
 }).filter(x=>x&&x.s&&Number.isFinite(x.x)&&Number.isFinite(x.y));
 if(words.length<8)return null;
 const hs=words.map(w=>w.h).filter(h=>h>=5&&h<=90).sort((a,b)=>a-b);
 const gap=Math.max(6,Math.min(17,(hs[Math.floor(hs.length/2)]||14)*.64));
 const lines=[];
 for(const w of words.sort((a,b)=>a.y-b.y||a.x-b.x)){
  const l=lines.findLast(t=>Math.abs(t.y-w.y)<gap);
  if(l){l.w.push(w);l.y=l.w.reduce((s,x)=>s+x.y,0)/l.w.length;}
  else lines.push({y:w.y,w:[w]});
 }
 for(const l of lines)l.w.sort((a,b)=>a.x-b.x);
 const header=lines.find(l=>{const s=l.w.map(w=>w.s.toLowerCase()).join(' ');
  return /наименование/u.test(s)&&/кол(?:-|\s*)во/u.test(s)&&/цен/u.test(s)&&/сумм/u.test(s)});
 if(!header)return null;
 const foot=lines.find(l=>l.y>header.y&&/^итого(?:\s|:|$)/iu.test(l.w.map(w=>w.s).join(' ')));
 if(!foot)return null;
 const found=[],issues=[];
 for(const l of lines.filter(l=>l.y>header.y+gap&&l.y<foot.y-gap)){
  const seg=(a,b)=>l.w.filter(w=>w.x/width>=a&&w.x/width<b).map(x=>x.s).join(' ');
  const name=seg(.08,.385).replace(/^\d{1,2}\s+/u,'').trim();
  if(name.length<3||!/\p{L}/u.test(name))continue;
  const q=quantity(seg(.385,.518)),p=money(seg(.518,.656)),t=money(seg(.656,.82));
  if(!q||p==null||t==null){issues.push(name+': не все числа прочитаны');continue;}
  const check=match(q.value,p,t);
  if(!check){issues.push(name+': количество и цена не соответствуют сумме');continue;}
  found.push({name,quantity:check.quantity,unit:q.unit,price:p,invoiceTotal:t,
   sourceRow:found.length+1,uncertain:true,nameNeedsReview:check.corrected,
   quantityCorrected:check.corrected,ocrOriginalQuantity:q.value});
 }
 const printed=money(foot.w.filter(w=>w.x/width>.6).map(x=>x.s).join(' '));
 const sum=found.reduce((s,x)=>s+cent(x.invoiceTotal),0)/100;
 const balanced=found.length>0&&issues.length===0&&printed!=null&&Math.abs(sum-printed)<=.02;
 return {items:found,printedTotal:printed,issues,balanced,supplier,source:'frontpad-screenshot',needsReview:true};
}
function parseText(raw){
 const lines=String(raw||'').split(/\r?\n/u).map(clean).filter(Boolean);
 const rx=/^\s*\d{1,2}\s+(.+?)\s+(\d+(?:[.,]\d{1,3})?)\s*(кг|шт|упак|уп|л|г)\.?\s+(\d+(?:[.,]\d{1,2})?)\s*(?:руб(?:\.|лей)?|₽)?\s+(\d+(?:[.,]\d{1,2})?)\s*(?:руб(?:\.|лей)?|₽)?\s*$/iu;
 const found=[],issues=[];
 for(const s of lines){const m=rx.exec(s);if(!m)continue;
  const q=number(m[2]),p=number(m[4]),t=number(m[5]),check=match(q,p,t);
  if(!check){issues.push(s);continue;}
  found.push({name:m[1],quantity:check.quantity,unit:unit(m[3]),price:p,invoiceTotal:t,
   uncertain:true,nameNeedsReview:check.corrected,quantityCorrected:check.corrected,ocrOriginalQuantity:q});
 }
 const foot=lines.findLast(x=>/^итого(?:\s|:|$)/iu.test(x)),printedTotal=foot?money(foot):null;
 const sum=found.reduce((s,x)=>s+cent(x.invoiceTotal),0)/100;
 return {items:found,printedTotal,issues,balanced:found.length>0&&printedTotal!=null&&!issues.length&&Math.abs(sum-printedTotal)<=.02};
}
const api={parseWords,parseText};
root.supplyFrontpadScan=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
