/* FARUKH REVISION PRO 0.6.2 — compact per-store discrepancies.
   Read-only: displays the LATEST SAVED weekly audit for each store.
   Never edits prices, historic snapshots, cloud data, or draft fields. */
(()=>{
 'use strict';
 const STYLES=[
 '.revision-crimson .summarytile[data-rev062-mini="yes"]{grid-template-rows:minmax(52px,auto) auto auto!important}',
 '.revision-crimson .summarytile[data-rev062-mini="yes"] .rev062-mini{grid-row:2!important}',
 '.revision-crimson .summarytile[data-rev062-mini="yes"] .point-open{grid-column:1/-1!important;grid-row:3!important}',
 '.revision-crimson .rev062-mini{grid-column:1/-1!important;grid-row:auto!important;min-width:0!important;width:100%!important;margin-top:4px!important;padding:8px!important;border:1px solid #364e68;border-radius:11px;background:#0a1729a8;box-sizing:border-box;position:relative;z-index:1}',
 '.revision-crimson .rev053-store-card[data-rev062-mini="yes"] .rev053-store-kg{display:none!important}',
 '.revision-crimson .rev062-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;margin-bottom:3px;padding:0 1px 6px;border-bottom:1px solid #324962;color:#d2b57f;font-weight:750;font-size:9.5px;line-height:1.2}',
 '.revision-crimson .rev062-line{padding:6px 1px;border-bottom:1px solid #26394e;min-width:0}',
 '.revision-crimson .rev062-product{font-size:11px;font-weight:750;line-height:1.3;color:#edf3ff;overflow-wrap:anywhere;white-space:normal}',
 '.revision-crimson .rev062-values{display:flex;align-items:baseline;justify-content:space-between;gap:5px;margin-top:3px;min-width:0}',
 '.revision-crimson .rev062-kg{font-size:10px;font-weight:750;white-space:nowrap}',
 '.revision-crimson .rev062-rub{font-size:10px;font-weight:800;white-space:nowrap;text-align:right}',
 '.revision-crimson .rev062-neg{color:#ff7c96!important}',
 '.revision-crimson .rev062-pos{color:#74e9b6!important}',
 '.revision-crimson .rev062-zero{color:#a9b9cd!important}',
 '.revision-crimson .rev062-price-missing{font-size:9px!important;color:#f0c88e!important}',
 '.revision-crimson .rev062-line[hidden]{display:none!important}',
 '.revision-crimson .rev062-foot{font-size:9px;color:#adbed1;margin-top:6px;line-height:1.25}',
 '.revision-crimson .summarytile .rev062-toggle{display:block!important;width:100%!important;min-height:31px!important;height:auto!important;border:1px solid #54647c!important;border-radius:8px!important;margin:8px 0 0!important;padding:5px!important;color:#f3ce94!important;background:#182840!important;box-shadow:none!important;font-size:10px!important;font-weight:750!important;text-align:center}',
 '.revision-crimson .rev062-empty{font-size:10px;color:#8de0b8;font-weight:750;padding:7px 0 3px}',
 '.revision-crimson .rev062-summary-hint{color:#a8bbd2;font-size:9px}',
 '@media(min-width:740px){.revision-crimson .rev062-mini{padding:10px!important}.revision-crimson .rev062-product{font-size:12px}.revision-crimson .rev062-kg,.revision-crimson .rev062-rub{font-size:11px}}',
 '@media print{.revision-crimson .rev062-toggle{display:none!important}.revision-crimson .rev062-line[hidden]{display:block!important}}'
 ].join('\n');
 function style(){
  if(document.getElementById('rev062StoreStyles'))return;
  const el=document.createElement('style');
  el.id='rev062StoreStyles';
  el.textContent=STYLES;
  document.head.append(el);
 }
 const num=(value,max=3)=>Number(value).toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:max});
 const rub=value=>num(value,2)+' ₽';
 const signed=(value,suffix)=> (value>0?'+':value<0?'−':'')+num(Math.abs(value))+' '+suffix;
 const info=record=>({
  positive:Number(record.diff)>0,
  negative:Number(record.diff)<0,
  diff:Number(record.diff),
  name:String(record.name||'Без названия'),
  price:(record.price===null||record.price===undefined||record.price===''||!Number.isFinite(Number(record.price))||Number(record.price)<0)?null:Number(record.price)
 });
 const latest=(store)=>{
  const list=Array.isArray(state?.history)?state.history:[];
  return list.filter(r=>r&&r.store===store&&r.type==='weekly'&&Array.isArray(r.products))
    .sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0))[0]||null;
 };
 function appendMini(tile,record){
  if(!tile||!record)return;
  const data=record.products.filter(p=>p&&p.name!==undefined).map(info).filter(p=>Number.isFinite(p.diff));
  const difference=data.filter(p=>p.diff!==0);
  const matchCount=data.length-difference.length;
  // Shortages first, surpluses second; within category, largest absolute weight first.
  difference.sort((a,b)=>(a.positive?1:0)-(b.positive?1:0)||Math.abs(b.diff)-Math.abs(a.diff));
  const section=document.createElement('section');
  section.className='rev062-mini';
  section.setAttribute('aria-label','Расхождения по продуктам: '+record.store);
  section.addEventListener('click',event=>event.stopPropagation());
  const head=document.createElement('div');
  head.className='rev062-head';
  const a=document.createElement('span');a.textContent='Продукт';
  const b=document.createElement('span');b.textContent='Разница · сумма';
  head.append(a,b);
  section.append(head);
  const count=Math.min(difference.length,3);
  difference.forEach((p,index)=>{
   const line=document.createElement('div');
   line.className='rev062-line';
   if(index>=count)line.hidden=true;
   const name=document.createElement('div');name.className='rev062-product';name.textContent=p.name;
   const vals=document.createElement('div');vals.className='rev062-values';
   const delta=document.createElement('span');delta.className='rev062-kg '+(p.diff<0?'rev062-neg':'rev062-pos');
   delta.textContent=signed(p.diff,'кг');
   const amount=document.createElement('span');amount.className='rev062-rub '+(p.diff<0?'rev062-neg':'rev062-pos');
   if(p.price===null){amount.textContent='нет цены';amount.classList.add('rev062-price-missing')}
   else amount.textContent=(p.diff>0?'+':'−')+rub(Math.abs(p.diff*p.price));
   vals.append(delta,amount);line.append(name,vals);section.append(line);
  });
  if(!difference.length){
   const empty=document.createElement('div');empty.className='rev062-empty';empty.textContent='✓ Все продукты совпадают';
   section.append(empty);
  }
  if(matchCount){
   const foot=document.createElement('div');foot.className='rev062-foot';
   foot.textContent='Совпадений: '+matchCount;
   section.append(foot);
  }
  if(difference.length>count){
   const button=document.createElement('button');button.type='button';
   button.className='rev062-toggle';button.textContent='Все расхождения ('+difference.length+') ▾';
   button.setAttribute('aria-expanded','false');
   button.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    const expanded=button.getAttribute('aria-expanded')==='true';
    section.querySelectorAll('.rev062-line').forEach((node,index)=>{if(index>=count)node.hidden=expanded});
    button.setAttribute('aria-expanded',String(!expanded));
    button.textContent=expanded?'Все расхождения ('+difference.length+') ▾':'Свернуть ▴';
   };
   section.append(button);
  }
  // Insert after existing summary, spanning full width of narrow two-column card.
  const action=tile.querySelector('.point-open');
  if(action)tile.insertBefore(section,action);else tile.append(section);
  tile.dataset.rev062Mini='yes';
 }
 function enhance(){
  const host=document.getElementById('summaryCards');if(!host)return;
  host.querySelectorAll('.rev053-store-card').forEach(tile=>{
   const name=tile.dataset.rev053Store;
   if(!name)return;
   tile.querySelector('.rev062-mini')?.remove();
   const audit=latest(name);
   if(!audit){delete tile.dataset.rev062Mini;return}
   appendMini(tile,audit);
  });
 }
 function install(){
  if(typeof renderSummary!=='function')return;
  style();
  const oldRender=renderSummary;
  renderSummary=function(){
   const result=oldRender.apply(this,arguments);
   enhance();
   return result;
  };
  enhance();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
