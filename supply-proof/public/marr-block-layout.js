/* Supplier-specific geometry recovery for documents where the product article
   is printed at the end of each physical row. No customer fixtures, SKU values,
   prices or supplier documents are embedded. Candidate rows require arithmetic
   proof and human photo review; never auto-approve. */
;(function(root){
'use strict';
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/gu,' ').trim();
const val=s=>{let t=norm(s).replace(/[\s\u00a0\u202f₽]/gu,'').replace(',','.');return /^\d+(?:\.\d{1,3})?$/u.test(t)?Number(t):null};
const cents=x=>Math.round((x+Number.EPSILON)*100);
const valid=b=>b&&norm(b.text)&&[b.left,b.right,b.top,b.bottom].every(Number.isFinite)&&b.right>b.left&&b.bottom>b.top;
const xm=b=>(b.left+b.right)/2,ym=b=>(b.top+b.bottom)/2;
function amounts(words){
 let out=[];for(const b of words){let n=val(b.text);if(n!=null&&/[,.]\d{2}$/u.test(norm(b.text)))out.push({n,boxes:[b]})}
 const ordered=words.slice().sort((a,b)=>a.left-b.left);
 for(let i=0;i+1<ordered.length;i++){const a=ordered[i],b=ordered[i+1];
  if(!/^\d{1,3}$/u.test(norm(a.text))||!/^\d{3}[,.]\d{2}$/u.test(norm(b.text)))continue;
  if(b.left-a.right>30||Math.abs(ym(a)-ym(b))>18)continue;
  const n=val(norm(a.text)+norm(b.text));if(n!=null)out.push({n,boxes:[a,b]});
 }
 return out;
}
function parse(boxes,opts={}){
 const supplier=opts.supplier||'';
 const r={status:'incomplete',verified:false,source:'geometry-article-block',supplier,number:opts.number||null,
  date:opts.date||null,printedTotalRub:opts.printedTotalRub??null,calculatedTotalRub:0,items:[],warnings:[],
  ocrBoxesCount:boxes?.length||0};
 if(!/марр|marr|mapp/iu.test(supplier)){r.warnings.push('Другой тип документа');return r}
 const b=Array.isArray(boxes)?boxes.filter(valid):[];
 if(b.length<12||b.length>12000){r.warnings.push('Координаты OCR отсутствуют');return r}
 const slots={name:[],qty:[],price:[],total:[]};
 for(const x of b){if(x.top<100||x.top>2000)continue;const t=norm(x.text).toLowerCase();
  if(/^наименование/u.test(t))slots.name.push(x);
  if(/^(?:кол-во|колво|количество)$/u.test(t))slots.qty.push(x);
  if(/^цена$/u.test(t))slots.price.push(x);
  if(/^(?:сумма|стоимость)$/u.test(t))slots.total.push(x);
 }
 let candidates=[];
 for(const q of slots.qty){const h={qty:q};
  for(const key of ['name','price','total'])h[key]=slots[key].filter(x=>Math.abs(ym(x)-ym(q))<35)
    .sort((a,b)=>Math.abs(ym(a)-ym(q))-Math.abs(ym(b)-ym(q)))[0]||null;
  if([h.name,h.price,h.total].every(Boolean)&&xm(h.name)<xm(q)&&xm(q)<xm(h.price)&&xm(h.price)<xm(h.total))candidates.push(h);
 }
 if(candidates.length!==1){r.warnings.push('Заголовки колонок не определены однозначно');return r}
 const h=candidates[0],xs=[h.name,h.qty,h.price,h.total].map(xm),maxY=Math.max(...Object.values(h).map(ym));
 const qtyLeft=(xs[0]+xs[1])/2,qtyRight=(xs[1]+xs[2])/2,amountLeft=(xs[2]+xs[3])/2;
 // OCR reads articles on the baseline following the merchandise description.
 const anchors=b.filter(x=>x.left<xs[0]*.72&&ym(x)>maxY+32&&/\d{9,13}/u.test(norm(x.text))&&!/[,\.]\d/u.test(norm(x.text)))
  .sort((a,z)=>ym(a)-ym(z)).filter((x,i,a)=>!i||Math.abs(ym(x)-ym(a[i-1]))>9);
 if(!anchors.length){r.warnings.push('Кодовые якоря строк не обнаружены');return r}
 let start=maxY+45;
 for(const [i,anchor] of anchors.entries()){
  const end=ym(anchor)+9,part=b.filter(x=>ym(x)>start&&ym(x)<end);start=end;
  const words=part.filter(x=>x.left>xs[0]*.53&&xm(x)<qtyLeft&&/[\p{L}\d]/u.test(x.text))
   .sort((a,z)=>ym(a)-ym(z)||a.left-z.left);
  const groups=[];
  for(const w of words){let g=groups.findLast(x=>Math.abs(ym(w)-x.y)<=12);
   if(!g){g={y:ym(w),parts:[]};groups.push(g)}
   g.parts.push(w);g.y=g.parts.reduce((sum,x)=>sum+ym(x),0)/g.parts.length;
  }
  const name=groups.sort((a,z)=>a.y-z.y).flatMap(g=>g.parts.sort((a,z)=>a.left-z.left))
   .map(x=>norm(x.text)).join(' ').trim();
  const units=part.filter(x=>xm(x)>qtyLeft&&xm(x)<xs[1]-20&&
   /^(?:шт|упак|кг|л|уп|кор)$/iu.test(norm(x.text).replace(/^[^а-яa-z]+|[^а-яa-z]+$/giu,'')));
  const quants=part.filter(x=>xm(x)>xs[1]-25&&xm(x)<qtyRight&&val(x.text)>0&&/^\d{1,4}$/u.test(norm(x.text)));
  const prices=amounts(part.filter(x=>xm(x)>=qtyRight&&xm(x)<=amountLeft));
  const sums=amounts(part.filter(x=>xm(x)>=amountLeft));
  let options=[];
  for(const q of quants)for(const p of prices)for(const total of sums){
   if(Math.abs(cents(val(q.text)*p.n)-cents(total.n))<=Math.max(2,val(q.text)))
    options.push({q,p,total,delta:Math.abs(ym(q)-ym(p.boxes[0]))+Math.abs(ym(q)-ym(total.boxes[0]))});
  }
  if(options.length!==1||name.length<5){r.warnings.push('Строка '+(i+1)+': данные требуют ручной проверки');continue}
  const pick=options[0],unit=units.length===1?norm(units[0].text).toLowerCase()
   .replace(/^[^а-яa-z]+|[^а-яa-z]+$/giu,'').replace(/упак/u,'уп'):'';
  if(!unit)r.warnings.push('Строка '+(i+1)+': единица измерения не найдена');
  const used=[...words,pick.q,...pick.p.boxes,...pick.total.boxes,...units];
  const issues=[...(used.some(x=>Number(x.confidence)<.65)?['Низкая уверенность OCR']:[]),
   'Проверьте точное название по оригиналу'];
  r.items.push({index:i+1,article:'',name,quantity:val(pick.q.text),unit,unitPriceRub:pick.p.n,
   lineTotalRub:pick.total.n,pack:null,issues,sourceLines:[name,
    val(pick.q.text)+' × '+pick.p.n+' = '+pick.total.n]});
 }
 r.calculatedTotalRub=r.items.reduce((sum,x)=>sum+cents(x.lineTotalRub),0)/100;
 if(anchors.length!==r.items.length)r.warnings.push('Обнаружено '+anchors.length+' строк, разобрано '+r.items.length);
 if(r.printedTotalRub==null||cents(r.printedTotalRub)!==cents(r.calculatedTotalRub))
  r.warnings.push('Общий итог требует сверки');
 if(r.items.length)r.status=r.warnings.length?'incomplete':'review';
 return r;
}
const api={parse};
if(typeof module==='object'&&module.exports)module.exports=api;
root.FARUKH_MARR_BLOCK=api;
})(globalThis);
