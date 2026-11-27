'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {recognizeOcrText,parsePack}=require('../recognizer.cjs');
const R=n=>n.toFixed(2).replace('.',',');
function synth({count=6,omitTotal=false,corruptRow=-1,oneLineHeader=false,supplier='ООО «ШАНХАЙ-ТОРГ»',totalOffset=0,qtyStart=1}={}){
 let lines=['Универсальный передаточный документ','Продавец '+supplier,'УПД № SAMPLE2026 от 14.11.2026',oneLineHeader?'A 1':'А\n1'];
 let sum=0;
 for(let i=0;i<count;i++){
  const q=qtyStart+i,price=100+i*5,total=q*price;
  sum+=total;
  lines.push(`Универсальный товар пробный ${String.fromCharCode(65+i)} 1 кг`);
  if(i!==corruptRow)lines.push(`6e3 % 1,00 ${R(total)}`);
  lines.push(`796 ШТ ${q},000 ${R(price/1.1)} ${R(price)}`);
  lines.push(`Z${String(8000+i)} ${i+1}`);
 }
 if(!omitTotal)lines.push(`Всего к оплате ${R(sum+totalOffset)}`);
 return lines.join('\n');
}
test('dynamic rows for 1, 2, 6 and 20 products; no hardcoded brands, products, prices',()=>{
 for(const count of [1,2,6,20]){
  const x=recognizeOcrText(synth({count}));
  assert.equal(x.items.length,count);
  assert.equal(x.status,'review');
  assert.equal(x.verified,false);
  assert.equal(x.warnings.length,0);
  assert.equal(x.calculatedTotalRub,x.printedTotalRub);
  assert.equal(x.items[0].name,'Универсальный товар пробный A 1 кг');
  assert.equal(x.items[count-1].article,`Z${8000+count-1}`);
  assert.equal(x.items[count-1].unitPriceRub,100+(count-1)*5);
  assert.equal(x.items[count-1].quantity,count);
  assert.equal(x.items[count-1].pack.weightKg,1);
  assert(x.items.every(i=>i.issues.length===0&&i.unit==='шт'&&i.unitCode===796));
 }
});
test('custom quantity and variable price, do not guess from product name',()=>{
 const a=recognizeOcrText(synth({count:3,qtyStart:11}));
 assert.deepEqual(a.items.map(x=>x.quantity),[11,12,13]);
 assert.deepEqual(a.items.map(x=>x.unitPriceRub),[100,105,110]);
 assert.equal(a.status,'review');
});
test('printed document total mismatch cannot pass validation',()=>{
 const a=recognizeOcrText(synth({totalOffset:200}));
 assert.equal(a.status,'incomplete');
 assert.equal(a.printedTotalRub,null);
 assert(a.warnings.some(x=>x.includes('не совпадает')));
});
test('missing printed line amount is flagged even when quantity*price can be computed',()=>{
 const a=recognizeOcrText(synth({corruptRow:2}));
 assert.equal(a.status,'incomplete');
 assert(a.items[2].issues.some(x=>x.includes('сумма строки')));
});
test('missing document footer requires review, no invented totals',()=>{
 const a=recognizeOcrText(synth({omitTotal:true}));
 assert.equal(a.status,'incomplete');
 assert.equal(a.printedTotalRub,null);
});
test('vendor detection is strict',()=>{
 const a=recognizeOcrText(synth({supplier:'ООО ИНОЙ ПОСТАВЩИК'}));
 assert.equal(a.status,'unsupported');
 assert.equal(a.items.length,0);
});
test('invalid or empty document must not be accepted',()=>{
 for(const text of ['','Кунжут 1 кг','ШАНХАЙ-ТОРГ договор без товаров']){
  const a=recognizeOcrText(text);
  assert(['unsupported','review','incomplete'].includes(a.status));
  assert.equal(a.items.length,0);
 }
});
test('1-20 boundary enforced',()=>{
 const a=recognizeOcrText(synth({count:21}));
 assert.equal(a.status,'review');
 assert.equal(a.items.length,0);
});
test('weight and piece packaging are separate fields',()=>{
 assert.equal(parsePack('Сыр 10,5 кг').weightKg,10.5);
 assert.equal(parsePack('Майонез 10 л (9,3 кг)').volumeL,10);
 assert.equal(parsePack('Майонез 10 л (9,3 кг)').weightKg,9.3);
 assert.equal(parsePack('Нори 100 листов').countPerPack,100);
 assert.equal(parsePack('Палочки 100пар/уп').countPerPack,100);
 assert.equal(parsePack('Нори 100 листов').weightKg,null);
});