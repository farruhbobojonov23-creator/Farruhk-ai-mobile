/* Draft extraction from on-device OCR, never directly saves an invoice. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SupplyDraft=factory();})(globalThis,function(){
'use strict';
const norm=s=>String(s??'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const number=s=>{s=String(s??'').replace(/[\s\u00a0\u202f]/g,'');return /^\d+(?:[,.]\d{1,3})?$/.test(s)?Number(s.replace(',','.')):null;};
const unit=s=>({кг:'кг',kg:'кг',шт:'шт',упак:'шт',уп:'шт',меш:'шт',л:'л',l:'л'})[norm(s).replace(/\./g,'')]||null;
const textOf=r=>String(r.text??'').trim();
function extract(scan,catalog=[]){
 if(scan?.schema!=='farukh-ocr-regions-v1'||!Array.isArray(scan.regions)||!(scan.width>0&&scan.height>0))throw Error('Неверный формат OCR');
 const points=scan.regions.filter(r=>Array.isArray(r.box)&&r.box.length>=4&&r.box.every(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))).map(r=>{
 const xs=r.box.map(p=>p[0]/scan.width),ys=r.box.map(p=>p[1]/scan.height);
 return {text:textOf(r),x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),score:Number(r.score)||0};}).filter(r=>r.text).sort((a,b)=>a.y-b.y||a.x-b.x);
 const full=points.map(p=>p.text).join(' '), upper=points.filter(p=>p.y<.4).map(p=>p.text).join(' ');
 const suppliers=[...new Set(catalog.map(d=>d.supplier).filter(Boolean))].filter(s=>norm(upper).includes(norm(s)));
 const supplier=suppliers.length===1?suppliers[0]:'';
 const match=upper.match(/(?:накладная|счет[- ]фактура|счёт[- ]фактура|реализация|упд)\s*(?:№|n|no)?\s*([A-Za-zА-Яа-я0-9/.-]*\d[A-Za-zА-Яа-я0-9/.-]*)\s*(?:от)?\s*(\d{2})[./](\d{2})[./](\d{4})/i);
 const warnings=['OCR: сверить с оригиналом все строки, фасовку, НДС, номер и дату; полнота не подтверждена.'];
 let rows=[],tax='unknown',total=null;
 const lineGroups=[];
 for(const p of points){let g=lineGroups.at(-1);if(!g||Math.abs(p.y-g.y)>.008){g={y:p.y,p:[]};lineGroups.push(g);}g.p.push(p);}
 const header=lineGroups.find(g=>g.p.some(p=>/^(наименование|товар)(\s|$)/i.test(p.text))&&g.p.some(p=>/кол[- ]?во|количество/i.test(p.text))&&g.p.some(p=>/^сумма|^общая стоимость/i.test(p.text))&&g.p.some(p=>/^цена/i.test(p.text)));
 let cols=null,bodyTop=0,bodyEnd=1;
 if(header){
 const find=(re)=>header.p.find(p=>re.test(p.text));
 const n=find(/^(наименование|товар)(\s|$)/i),q=find(/кол[- ]?во|количество/i),u=find(/^ед\.?\s*(изм)?\.?$/i),pr=find(/^цена/i),a=find(/^сумма|^общая стоимость/i);
 if(n&&q&&u&&pr&&a&&new Set([n,q,u,pr,a]).size===5){
 cols={name:n.x,qty:q.x,unit:u.x,price:pr.x,amount:a.x};bodyTop=header.y+.008;
 }
 }
 // Numbered columns used in tax invoices. Require unique numeric header codes.
 if(!cols){
 for(const g of lineGroups){
 const codes=new Map();for(const p of g.p){const k=norm(p.text).replace(/a/g,'а');if(!codes.has(k))codes.set(k,[]);codes.get(k).push(p);}
 const get=k=>codes.get(k)?.length===1?codes.get(k)[0]:null;
 const up=!!get('1а')&&!!get('2а')&&!!get('3')&&!!get('4')&&!!get('9')&&!!get('5')&&!!get('8');
 const act=/акт приема-передачи|акт приемки|акт приема передачи/i.test(upper)&&['3','4','9','10','11'].every(k=>get(k));
 const ttn=/товарно-транспортная накладная/i.test(upper)&&['2','4','7','8','9'].every(k=>get(k));
 let map=up?{name:'1а',unit:'2а',qty:'3',price:'4',amount:'9'}:act?{name:'3',unit:'4',qty:'11',price:'9',amount:'10'}:ttn?{name:'2',unit:'4',qty:'8',amount:'7'}:null;
 if(!map)continue;
 const pairs=Object.entries(map).map(([k,c])=>[k,get(c)?.x]);if(pairs.some(([,x])=>!Number.isFinite(x)))continue;
 // Use all numeric column centers, including columns that are not imported.
 const all=g.p.filter(p=>/^\d{1,2}[аaбв]?$/.test(norm(p.text))).map(p=>p.x).sort((a,b)=>a-b);
 if(all.length<5)continue;
 cols=Object.fromEntries(pairs);cols._all=all;bodyTop=g.y+.004;tax='included';
 if(up)warnings.push('УПД: итог строки берётся с НДС; цена без НДС не используется как цена закупки.');
 break;
 }
 }
 if(cols){
 const centers=Object.entries(cols).filter(([k])=>k!=='_all'),all=cols._all||centers.map(([,x])=>x).sort((a,b)=>a-b);
 function col(p){let nearest=all.reduce((best,x)=>Math.abs(p.x-x)<Math.abs(p.x-best)?x:best,all[0]);return centers.find(([,x])=>Math.abs(x-nearest)<1e-6)?.[0]||null;}
 const end=points.find(p=>p.y>bodyTop&&/^(итого|всего к оплате|всего по накладной|всего наименований)/i.test(p.text));
 if(end)bodyEnd=end.y-.002;
 const body=points.filter(p=>p.y>=bodyTop&&p.y<=bodyEnd);
 const amounts=body.filter(p=>col(p)==='amount'&&number(p.text)!=null&&p.score>=.65).sort((a,b)=>a.y-b.y);
 for(let i=0;i<amounts.length;i++){
 const a=amounts[i],lo=i?(amounts[i-1].y+a.y)/2:Math.max(bodyTop,a.y-.035),hi=i+1<amounts.length?(a.y+amounts[i+1].y)/2:Math.min(bodyEnd,a.y+.035);
 const cells=body.filter(p=>p.y>=lo&&p.y<hi);
 const take=k=>cells.filter(p=>col(p)===k).sort((a,b)=>a.y-b.y||a.x-b.x);
 const name=take('name').map(p=>p.text).join(' '),qs=take('qty'),us=take('unit'),ps=take('price');
 if(!name||!/[а-яa-z]/i.test(name)||qs.length!==1||us.length!==1)continue;
 const qty=number(qs[0].text),u=unit(us[0].text),amount=number(a.text);
 if(!(qty>0)||!u||amount===null)continue;
 const exact=catalog.flatMap(d=>d.rows||[]).filter(r=>norm(r.name)===norm(name)&&r.factor>0&&['кг','шт','л'].includes(r.unit));
 const distinct=new Map(exact.map(r=>[r.unit+':'+r.factor,r]));
 let factor=u==='кг'||u==='л'?1:null,compare=u,product_key='';
 if(distinct.size===1){const r=[...distinct.values()][0];factor=r.factor;compare=r.unit;product_key=r.product_key||'';}
 else if(u==='шт'){
 if(/порцион/i.test(name))factor=1;
 else {const pack=name.match(/(\d+(?:[.,]\d+)?)\s*(кг|гр\.?|г|л|мл|лист(?:ов|а)?|пар|шт)\b/iu);
 if(pack){const n=number(pack[1]),p=norm(pack[2]);if(n>0){factor=/^(г|гр|мл)/.test(p)?n/1000:n;compare=/^(кг|г)/.test(p)?'кг':/^(л|мл)/.test(p)?'л':'шт';}}}
 }
 const flags=[];
 if(factor===null)flags.push('Уточнить фасовку и единицу сравнения');
 if(cells.some(p=>p.score<.85))flags.push('Низкая уверенность OCR');
 if(ps.length===1&&tax!=='included'){const p=number(ps[0].text);if(p==null||Math.abs(qty*p-amount)>.02)flags.push('Цена × количество не совпадает с суммой');}
 rows.push({name,qty,factor:factor??'',unit:compare,amount,product_key,flags});
 }
 }
 if(!rows.length)warnings.push('Структура таблицы не определена. Автоматически строки не внесены.');
 else warnings.push('Найдено строк: '+rows.length+'. Сверить число строк с документом.');
 return {supplier,number:match?.[1]||'',date:match?[match[4],match[3],match[2]].join('-'):'',total,tax_status:tax,complete:false,source:'offline_ocr_draft',warnings,rows,rawText:full};
}
return {extract};
});
