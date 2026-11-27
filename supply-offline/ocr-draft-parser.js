/* FARUKH SUPPLY: offline OCR draft parser. No network calls.
 * Input: PaddleOCR text regions [{text,score,box:[[x,y],...]}] for ONE deskewed page.
 * Column ranges are normalized to image width, supplied by a confirmed template.
 * Output: draft only; never automatically imports unverified data.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FarukhSupplyOCR=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function decimal(s){
  s=String(s??'').trim().replace(/[\s\u00a0\u202f]/g,'');
  if(!/^\d+(?:[.,]\d{1,3})?$/.test(s))return null;
  const n=Number(s.replace(',','.'));return Number.isFinite(n)?n:null;
}
function unit(s){
  s=String(s??'').toLowerCase().trim().replace(/\s|\./g,'');
  return ({'кг':'кг','kg':'кг','kг':'кг','кg':'кг','шт':'шт','шt':'шт','упак':'шт','уп':'шт','меш':'шт','л':'л','l':'л'})[s]??null;
}
function moneyOK(q,p,a){return [q,p,a].every(Number.isFinite)&&q>0&&p>=0&&a>=0&&Math.abs(Math.round(q*p*100)-Math.round(a*100))<=1;}
function parsePage(regions,template){
  if(!template||!Number.isFinite(template.width)||template.width<=0||!Number.isFinite(template.height)||template.height<=0)throw Error('Image dimensions required');
  const keys=['name','qty','unit','price','amount'];
  for(const k of keys){const v=template.columns?.[k];if(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||v[0]<0||v[1]<=v[0]||v[1]>1)throw Error('Invalid column: '+k);} const sorted=keys.slice().sort((a,b)=>template.columns[a][0]-template.columns[b][0]); for(let i=1;i<sorted.length;i++){if(template.columns[sorted[i]][0]<template.columns[sorted[i-1]][1])throw Error('Overlapping columns: '+sorted[i]);}
  const top=template.top??0,bottom=template.bottom??1,tol=template.rowTolerance??0.009;
  if(!(top>=0&&bottom<=1&&top<bottom&&tol>0&&tol<0.05))throw Error('Invalid page bounds');
  const rows=[];const unassigned=[];const ignored=[];
  const points=(regions||[]).flatMap(r=>{
    if(!r||!Array.isArray(r.box)||r.box.length<4||!r.box.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite))){unassigned.push(r);return [];}
    const x=r.box.reduce((n,p)=>n+p[0],0)/r.box.length/template.width;
    const y=r.box.reduce((n,p)=>n+p[1],0)/r.box.length/template.height;
    if(y<top||y>bottom){ignored.push(r);return [];}
    const xmin=Math.min(...r.box.map(p=>p[0]))/template.width,xmax=Math.max(...r.box.map(p=>p[0]))/template.width;
    const key=keys.find(k=>xmin>=template.columns[k][0]&&xmax<=template.columns[k][1]);
    if(!key){unassigned.push(r);return [];}
    return [{x,y,key,text:String(r.text??'').trim(),score:Number.isFinite(r.score)?r.score:0}];
  }).sort((a,b)=>a.y-b.y||a.x-b.x);
  const groups=[];
  for(const p of points){let g=groups[groups.length-1];if(!g||Math.abs(p.y-g.anchor)>tol){g={anchor:p.y,cells:[]};groups.push(g);}g.cells.push(p);}
  for(const g of groups){
    const raw={};const flags=[];
    for(const k of keys){const a=g.cells.filter(p=>p.key===k).sort((a,b)=>a.x-b.x);raw[k]=a.map(p=>p.text).join(' ');if(a.some(p=>p.score<0.85))flags.push('low_confidence:'+k);}
    const q=decimal(raw.qty),p=decimal(raw.price),a=decimal(raw.amount),u=unit(raw.unit);
    if(!raw.name)flags.push('missing_name');
    if(q===null||q<=0)flags.push('invalid_qty');
    if(p===null)flags.push('invalid_price');
    if(a===null)flags.push('invalid_amount');
    if(!u)flags.push('unknown_unit');
    if(!moneyOK(q,p,a))flags.push('arithmetic_mismatch');
    if(u==='шт')flags.push('packaging_factor_requires_confirmation');
    rows.push({name:raw.name,qty:q,unit:u,price:p,amount:a,factor:u==='шт'?null:(u?1:null),product_key:'',raw,flags,requires_review:true});
  }
  return {source:'offline_ocr_draft',supplier:null,number:null,date:null,total:null,tax_status:null,complete:false,rows,unassigned,ignored,requires_review:true};
}
return {decimal,unit,moneyOK,parsePage};
});
