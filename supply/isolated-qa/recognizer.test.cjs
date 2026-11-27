'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {recognizeOcrText,parsePack}=require('./recognizer.cjs');
const rub=n=>n.toFixed(2).replace('.',',');
function fixture(n=6,options={}){
 const opts={start:1,offset:0,skipRow:-1,skipFooter:false,vendor:'ООО «ШАНХАЙ-ТОРГ»',...options};
 const lines=['Универсальный передаточный документ','Продавец '+opts.vendor,'УПД № SAMPLE2026 от 14.11.2026','А','1'];let total=0;
 for(let i=0;i<n;i++){
  const q=opts.start+i,p=100+i*5,amount=q*p;total+=amount;
  lines.push('Тестовый товар номер '+(i+1)+' 1 кг');
  if(opts.skipRow!==i)lines.push('6e3 % 1,00 '+rub(amount));
  lines.push('796 ШТ '+q+',000 '+rub(p/1.1)+' '+rub(p));
  lines.push('R'+(8000+i)+' '+(i+1));
 }
 if(!opts.skipFooter)lines.push('Всего к оплате '+rub(total+opts.offset));
 return lines.join('\n');
}
test('1, 2, 6 and 20 variable products: all rows bound to the correct prices',()=>{
 for(const n of [1,2,6,20]){
  const r=recognizeOcrText(fixture(n));
  assert.equal(r.status,'review');assert.equal(r.verified,false);
  assert.equal(r.items.length,n);assert.equal(r.calculatedTotalRub,r.printedTotalRub);
  for(let i=0;i<n;i++){
   const x=r.items[i];
   assert.equal(x.article,'R'+(8000+i));
   assert.equal(x.quantity,1+i);assert.equal(x.unit,'шт');
   assert.equal(x.unitPriceRub,100+5*i);
   assert.equal(x.lineTotalRub,(1+i)*(100+5*i));
   assert(x.name.includes('Тестовый товар номер '+(i+1)));
   assert.equal(x.pack.weightKg,1);
   assert.deepEqual(x.issues,[]);
  }
 }
});
test('changing quantity while keeping the same new products',()=>{
 const r=recognizeOcrText(fixture(3,{start:11}));
 assert.deepEqual(r.items.map(x=>x.quantity),[11,12,13]);
 assert.deepEqual(r.items.map(x=>x.unitPriceRub),[100,105,110]);
 assert.equal(r.status,'review');
});
test('wrong printed grand total remains incomplete',()=>{
 const r=recognizeOcrText(fixture(6,{offset:21}));
 assert.equal(r.status,'incomplete');
 assert.equal(r.printedTotalRub,null);
});
test('missing printed product-line amount remains incomplete',()=>{
 const r=recognizeOcrText(fixture(6,{skipRow:2}));
 assert.equal(r.status,'incomplete');
 assert(r.items[2].issues.length>0);
});
test('missing invoice footer is not fabricated',()=>{
 const r=recognizeOcrText(fixture(2,{skipFooter:true}));
 assert.equal(r.status,'incomplete');
 assert.equal(r.printedTotalRub,null);
});
test('unsupported supplier never inferred from a product',()=>{
 const r=recognizeOcrText(fixture(2,{vendor:'ООО ДРУГОЙ ПОСТАВЩИК'}));
 assert.equal(r.status,'unsupported');
 assert.equal(r.items.length,0);
});
test('an empty or meaningless photo text is rejected',()=>{
 for(const txt of ['', 'шампиньоны 2 кг', 'ШАНХАЙ-ТОРГ только переписка']){
  const r=recognizeOcrText(txt);assert.equal(r.items.length,0);
 }
});
test('over 20 items cannot be silently accepted',()=>{
 const r=recognizeOcrText(fixture(21));
 assert.equal(r.items.length,0);
});
test('pack measures are not conflated with kg',()=>{
 assert.equal(parsePack('сыр 10,5 кг').weightKg,10.5);
 assert.equal(parsePack('майонез 10 л (9,3 кг)').volumeL,10);
 assert.equal(parsePack('палочки 100пар/уп').countPerPack,100);
 assert.equal(parsePack('нори 100 листов').weightKg,null);
});