/* FARUKH REVISION 0.6.3 — every saved product, matching card heights.
 * Read only. No writes to accounts, history, draft or catalogue.
 */
(()=>{
'use strict';
const css=[
'.revision-crimson #summaryCards{align-items:stretch!important;grid-auto-flow:row!important}',
'.revision-crimson #summaryCards .summarytile.rev063-card{display:grid!important;grid-template-columns:39px minmax(0,1fr)!important;grid-template-rows:minmax(76px,auto) minmax(0,1fr) 42px!important;align-content:stretch!important;align-items:stretch!important;gap:7px 7px!important;min-height:0!important;height:100%!important;overflow:visible!important;padding:10px!important;box-sizing:border-box!important}',
'.revision-crimson #summaryCards .rev063-card .point-icon{grid-column:1!important;grid-row:1!important;align-self:start!important}',
'.revision-crimson #summaryCards .rev063-card .point-info{grid-column:2!important;grid-row:1!important;min-width:0!important;align-self:start!important}',
'.revision-crimson #summaryCards .rev063-card .rev053-store-kg{display:none!important}',
'.revision-crimson #summaryCards .rev063-card .rev063-mini{grid-column:1/-1!important;grid-row:2!important;min-width:0!important;width:100%!important;align-self:stretch!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:0!important;margin:0!important;padding:8px!important;border:1px solid #38506b!important;border-radius:11px!important;background:#0b192cb8!important;position:relative;z-index:1}',
'.revision-crimson #summaryCards .rev063-card .point-open{grid-column:1/-1!important;grid-row:3!important;align-self:end!important;justify-self:stretch!important;width:100%!important;height:42px!important;min-height:42px!important;max-height:42px!important;margin:0!important;padding:7px 5px!important;font-size:10.3px!important;box-sizing:border-box!important}',
'.revision-crimson .rev063-mini .rev063-title{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;margin-bottom:3px;padding-bottom:6px;border-bottom:1px solid #31455b;font-size:9px;font-weight:850;color:#ddc18d}',
'.revision-crimson .rev063-mini .rev063-row{padding:6px 1px 7px;border-bottom:1px solid #26384d;min-width:0;flex:0 0 auto}',
'.revision-crimson .rev063-mini .rev063-row:last-of-type{border-bottom:0}',
'.revision-crimson .rev063-mini .rev063-name{font-size:10.6px;line-height:1.3;font-weight:800;color:#f2f6ff;overflow-wrap:anywhere}',
'.revision-crimson .rev063-mini .rev063-values{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px 6px;margin-top:3px;font-size:10px;line-height:1.3}',
'.revision-crimson .rev063-mini .rev063-qty{font-size:10px;font-weight:850;white-space:nowrap}',
'.revision-crimson .rev063-mini .rev063-money{font-size:10px;font-weight:850;white-space:nowrap}',
'.revision-crimson .rev063-mini .rev063-negative{color:#ff7796!important}',
'.revision-crimson .rev063-mini .rev063-positive{color:#76ebbc!important}',
'.revision-crimson .rev063-mini .rev063-neutral{color:#c1cce0!important}',
'.revision-crimson .rev063-mini .rev063-muted{color:#dec18d!important;font-size:9px!important}',
'.revision-crimson .rev063-mini .rev063-empty{font-size:10.2px;line-height:1.6;color:#a8b9cb;padding:7px 1px}',
'.revision-crimson .rev063-mini .rev063-foot{font-size:9px;color:#a4b4ca;margin-top:auto;padding-top:7px;line-height:1.35}',
'@media(min-width:740px){.revision-crimson .rev063-mini .rev063-name{font-size:12px}.revision-crimson .rev063-mini .rev063-qty,.revision-crimson .rev063-mini .rev063-money{font-size:11.5px}}',
'@media(max-width:340px){.revision-crimson #summaryCards .rev063-card{grid-template-columns:31px minmax(0,1fr)!important;padding:7px!important;gap:5px!important}.revision-crimson .rev063-mini .rev063-values{font-size:9px}}'
].join('\n');
function style(){
 if(document.getElementById('rev063Styles'))return;
 const node=document.createElement('style');node.id='rev063Styles';node.textContent=css;
 document.head.append(node);
}
const number=(v,decimals=3)=>Number(v).toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:decimals});
const rub=v=>number(v,2)+' ₽';
const signed=v=>(v>0?'+':v<0?'−':'')+number(Math.abs(v),3);
const value=v=>(v===null||v===undefined||v==='')?null:(Number.isFinite(Number(v))?Number(v):null);
function latest(store){
 const rows=Array.isArray(state?.history)?state.history:[];
 const records=rows.filter(r=>r&&r.store===store&&Array.isArray(r.products));
 records.sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0));
 return records.find(r=>r.type==='weekly')||records.find(r=>r.type==='start')||null;
}
function label(textName,klass,txt){
 const el=document.createElement(textName);
 if(klass)el.className=klass;
 if(txt!==undefined)el.textContent=txt;
 return el;
}
function addSummary(tile,audit){
 const view=label('section','rev063-mini');
 view.setAttribute('aria-label',audit?'Все продукты из последней сохранённой '+(audit.type==='start'?'начальной':'повторной')+' ревизии':'Нет сохранённых ревизий');
 // Tiles are clickable to enter a point, but interacting with the informational
 // rows should not navigate accidentally.
 view.addEventListener('click',ev=>ev.stopPropagation());
 const title=label('div','rev063-title');
 title.append(label('span','',audit?.type==='start'?'Продукт':'Продукт'),
              label('span','',audit?.type==='start'?'Остаток':'± кг · ± ₽'));
 view.append(title);
 if(!audit){
  view.append(label('div','rev063-empty','После первой ревизии здесь будут все продукты и их остатки.'));
  return view;
 }
 const input=Array.isArray(audit.products)?audit.products:[];
 const start=audit.type==='start';
 const list=input.map((p,i)=>({
  i,name:String(p?.name||'Без названия'),
  delta:value(p?.diff),actual:value(p?.actual),price:value(p?.price)
 }));
 // For weekly audits display shortages first, then surpluses, then exact matches.
 // All products, including coincident and those with a missing price, remain visible.
 if(!start)list.sort((a,b)=>{
  const rank=v=>v.delta===null?3:v.delta<0?0:v.delta>0?1:2;
  return rank(a)-rank(b)||a.i-b.i;
 });
 let matches=0,missing=0;
 for(const p of list){
  const row=label('div','rev063-row');
  row.append(label('div','rev063-name',p.name));
  const values=label('div','rev063-values');
  let quantity='',money='',color='rev063-neutral';
  if(start){
   quantity='Факт: '+(p.actual===null?'не указан':number(p.actual)+' кг');
   money='База';
  }else if(p.delta===null){
   quantity='Нет данных';money='—';
  }else if(Math.abs(p.delta)<0.0005){
   quantity='0 кг';money='0 ₽';matches++;
  }else{
   quantity=signed(p.delta)+' кг';
   color=p.delta<0?'rev063-negative':'rev063-positive';
   if(p.price===null){money='нет цены';missing++}
   else money=(p.delta>0?'+':'−')+rub(Math.abs(p.delta*p.price));
  }
  values.append(label('span','rev063-qty '+color,quantity),
                label('span','rev063-money '+(money==='нет цены'?'rev063-muted':color),money));
  row.append(values);view.append(row);
 }
 if(!list.length)view.append(label('div','rev063-empty','В этой сохранённой записи нет продуктов.'));
 const note=start?'Начальная база · без расчёта расхождений':
   (matches?'Совпадений: '+matches+' · ':'')+(!missing?'Все суммы рассчитаны':'Без цены: '+missing);
 view.append(label('div','rev063-foot',note));
 return view;
}
function enhance(){
 const host=document.getElementById('summaryCards');
 if(!host)return;
 host.querySelectorAll('.rev053-store-card').forEach(tile=>{
  const store=tile.dataset.rev053Store;
  if(!store)return;
  tile.querySelector('.rev062-mini')?.remove();
  tile.querySelector('.rev063-mini')?.remove();
  const mini=addSummary(tile,latest(store));
  const action=tile.querySelector('.point-open');
  if(action)tile.insertBefore(mini,action);
  else tile.append(mini);
  tile.classList.add('rev063-card');
  tile.dataset.rev062Mini='no';
 });
}
function install(){
 if(typeof renderSummary!=='function')return;
 style();
 const previous=renderSummary;
 renderSummary=function(){
  const result=previous.apply(this,arguments);
  enhance();
  return result;
 };
 enhance();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();