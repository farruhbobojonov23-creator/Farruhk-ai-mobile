/* Isolated OCR geometry proof. No real invoices, names or prices in the code. */
(function(root){
'use strict';
const num=x=>{if(x==null)return null;let s=String(x).trim().replace(/[ \u00a0\u202f₽]/g,'').replace(',','.');return /^\d+(?:\.\d{1,3})?$/.test(s)?Number(s):null};
const cents=n=>Math.round((Number(n)+Number.EPSILON)*100);
const tx=x=>String(x.text||'').trim(),xm=b=>(b.left+b.right)/2,ym=b=>(b.top+b.bottom)/2;
const k=s=>String(s).toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');
function normBoxes(data){
 if(!Array.isArray(data)||data.length>12000)return [];
 return data.filter(b=>b&&tx(b)&&[b.left,b.right,b.top,b.bottom].every(Number.isFinite)&&b.left>=0&&b.top>=0&&b.right>b.left&&b.bottom>b.top)
 .map(b=>({...b,text:tx(b),confidence:Number.isFinite(b.confidence)?b.confidence:null}));
}
function groupLines(data){
 const src=normBoxes(data).sort((a,b)=>ym(a)-ym(b)||a.left-b.left);
 const heights=src.map(b=>b.bottom-b.top).sort((a,b)=>a-b),h=heights[Math.floor(heights.length/2)]||12,lines=[];
 for(const b of src){
  let l=lines.findLast(x=>Math.abs(ym(b)-x.y)<=Math.min(h*.48,Math.max(3,(b.bottom-b.top)*.55)));
  if(!l){l={boxes:[],y:ym(b)};lines.push(l)}
  l.boxes.push(b);l.y=l.boxes.reduce((s,x)=>s+ym(x),0)/l.boxes.length;
 }
 return lines.sort((a,b)=>a.y-b.y).map(l=>({...l,boxes:l.boxes.sort((a,b)=>a.left-b.left),text:l.boxes.map(b=>b.text).join(' ')}));
}
function role(text){
 let s=k(text);
 if(/^(наименование|товар|название|номенклатура)/.test(s))return 'name';
 if(/^(количество|колво|колич|qty)/.test(s))return 'qty';
 if(/^(ценасндс|ценасналогом|grossprice)/.test(s))return 'gross';
 if(/^(цена|ценазаединицу)/.test(s))return 'price';
 if(/^(сумма|стоимость|итого)/.test(s))return 'total';
 return null;
}
function header(lines){
 const found=[];
 for(let i=0;i<lines.length;i++){
  const col={};for(const box of lines[i].boxes){let r=role(box.text);if(r&&!Number.isFinite(col[r]))col[r]=xm(box)}
  if(Number.isFinite(col.gross))col.price=col.gross;
  if([col.name,col.qty,col.price,col.total].every(Number.isFinite)&&col.name<col.qty&&col.qty<col.price&&col.price<col.total)found.push({i,y:lines[i].y,col});
 }
 return found.length===1?found[0]:null;
}
function parse(boxes,opt={}){
 const l=groupLines(boxes),h=header(l),out={status:'incomplete',verified:false,source:'ocr-boxes',supplier:opt.supplier||null,
 number:opt.number||null,date:opt.date||null,printedTotalRub:opt.printedTotalRub??null,calculatedTotalRub:0,
 items:[],warnings:[],ocrBoxesCount:normBoxes(boxes).length};
 if(!out.supplier){out.warnings.push('Поставщик не определён');return out}
 if(!h){out.warnings.push('Колонки OCR не определены — не связываем названия по общему итогу');return out}
 let rows=[];
 for(const ln of l.slice(h.i+1)){
  let numbers=ln.boxes.filter(b=>num(b.text)!=null),match={};
  for(const key of ['qty','price','total']){
   const center=h.col[key],other=['name','qty','price','total'].map(x=>h.col[x]),left=Math.max(-Infinity,...other.filter(x=>x<center).map(x=>(x+center)/2)),right=Math.min(Infinity,...other.filter(x=>x>center).map(x=>(x+center)/2));
   const c=numbers.filter(b=>xm(b)>=left&&xm(b)<right);if(c.length===1)match[key]=c[0];
  }
  if(Object.keys(match).length!==3)continue;
  const q=num(match.qty.text),p=num(match.price.text),total=num(match.total.text);
  if(q>0&&p>0&&total>0&&Math.abs(cents(q*p)-cents(total))<=Math.max(2,Math.ceil(q)))rows.push({y:ln.y,q,p,total,match});
  else out.warnings.push('Несовпадение арифметики внутри строки OCR');
 }
 rows=rows.filter((r,i)=>!i||Math.abs(r.y-rows[i-1].y)>4);
 if(!rows.length){out.warnings.push('Нет полных строк количество/цена/сумма');return out}
 for(let i=0;i<rows.length;i++){
  const r=rows[i],from=i?(rows[i-1].y+r.y)/2:h.y+.1,to=i+1<rows.length?(r.y+rows[i+1].y)/2:r.y+60;
  const words=l.filter(x=>x.y>=from&&x.y<to).flatMap(x=>x.boxes.filter(b=>xm(b)<(h.col.name+h.col.qty)/2&&/[а-яa-z0-9]/iu.test(b.text)).sort((a,b)=>a.left-b.left));
  const name=words.map(b=>b.text).join(' ').replace(/\s+/g,' ').trim();
  if(!name||/^(наименование|товар|цена|сумма|количество)/iu.test(name)){out.warnings.push('Название строки требует ручной проверки');continue}
  const used=[...words,...Object.values(r.match)],issues=used.some(x=>x.confidence!=null&&x.confidence<.65)?['Низкая уверенность OCR']:['Проверьте название по фото'];
  out.items.push({name,index:out.items.length+1,article:'',quantity:r.q,unit:'',unitPriceRub:r.p,lineTotalRub:r.total,
  pack:null,issues,sourceLines:[name,String(r.q)+' × '+String(r.p)+' = '+String(r.total)]});
 }
 out.calculatedTotalRub=out.items.reduce((a,x)=>a+cents(x.lineTotalRub),0)/100;
 if(opt.expectedItems>0&&opt.expectedItems!==out.items.length)out.warnings.push('Количество товарных строк не совпало');
 if(out.printedTotalRub==null)out.warnings.push('Итог накладной не найден');
 else if(cents(out.printedTotalRub)!==cents(out.calculatedTotalRub))out.warnings.push('Итог строк не совпал с итогом накладной');
 if(out.items.length&&!out.warnings.length)out.status='review';
 return out;
}
const api={parse,groupLines,normBoxes};if(typeof module==='object'&&module.exports)module.exports=api;root.FARUKH_SPATIAL=api;
})(globalThis);
