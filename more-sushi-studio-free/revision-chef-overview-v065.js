/* FARUKH REVISION 0.6.5 · Chef dashboard. READ ONLY.
 * Latest saved weekly revision from each trading point; no draft totals.
 * Missing historical purchase prices stay missing, never silently backfilled.
 */
(()=>{
'use strict';
const STYLES=[
'.revision-crimson.view-summary.rev065-ready #rev054Guide{display:none!important}',
'.revision-crimson.view-summary.rev065-ready .premium-replay-revision{display:none!important}',
'.revision-crimson .rev065-board{margin:0 0 15px!important;padding:17px 15px!important;border:1px solid #455f7b!important;border-radius:19px!important;background:linear-gradient(135deg,#1a2c44,#102038 70%,#25182d)!important;box-shadow:inset 0 1px #ffffff20,0 8px 24px #0005!important;min-width:0;box-sizing:border-box;color:#f4f8ff}',
'.revision-crimson .rev065-header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
'.revision-crimson .rev065-eyebrow{font-size:10px;color:#e7ca91;letter-spacing:1.3px;font-weight:850}',
'.revision-crimson .rev065-header h2{font-size:20px!important;line-height:1.25!important;margin:5px 0!important;color:#fff!important}',
'.revision-crimson .rev065-sub{font-size:10.5px!important;color:#b7c9dd!important;margin:4px 0 0!important;line-height:1.45}',
'.revision-crimson .rev065-coverage{background:#4836285c;border:1px solid #725b47;border-radius:10px;padding:8px 10px;font-size:11px;color:#f5d393;font-weight:850;white-space:nowrap}',
'.revision-crimson .rev065-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
'.revision-crimson .rev065-metric{display:flex;flex-direction:column;justify-content:center;min-width:0;min-height:91px;background:linear-gradient(150deg,#182a41,#0d1b30);border:1px solid #38526b;border-radius:13px;padding:10px;box-sizing:border-box}',
'.revision-crimson .rev065-metric .rev065-label{font-size:10.5px;font-weight:750;color:#bdccdd}',
'.revision-crimson .rev065-metric strong{font-size:19px!important;line-height:1.22;font-weight:900;margin:5px 0 3px;overflow-wrap:anywhere;letter-spacing:-.2px}',
'.revision-crimson .rev065-metric small{font-size:10px;line-height:1.35;color:#afc1d7}',
'.revision-crimson .rev065-loss strong{color:#fc7896}',
'.revision-crimson .rev065-gain strong{color:#74e7b5}',
'.revision-crimson .rev065-match strong{color:#eccc8b}',
'.revision-crimson .rev065-audits strong{color:#ecf2ff}',
'.revision-crimson .rev065-warnings{margin:11px 0 0;padding:10px 11px;border:1px solid #776449;background:#382b2b63;border-radius:11px;font-size:10.5px;color:#f1cc93;line-height:1.55}',
'.revision-crimson .rev065-issues{border-top:1px solid #405773;margin-top:12px;padding-top:11px}',
'.revision-crimson .rev065-issues h3{font-size:14px!important;color:#eed29b!important;margin:0 0 4px!important}',
'.revision-crimson .rev065-issues .rev065-note{font-size:10px!important;color:#aebfd5!important;line-height:1.45;margin:0 0 7px!important}',
'.revision-crimson .rev065-item{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid #30445a;padding:8px 0}',
'.revision-crimson .rev065-item:last-child{border-bottom:0}',
'.revision-crimson .rev065-item .rev065-name{min-width:0;flex:1}',
'.revision-crimson .rev065-item .rev065-name b{display:block;font-size:11.5px;color:#f4f8ff;overflow-wrap:anywhere}',
'.revision-crimson .rev065-item .rev065-name small{display:block;font-size:10px;color:#aabed7;margin-top:3px}',
'.revision-crimson .rev065-item .rev065-value{display:grid;gap:3px;text-align:right;flex-shrink:0}',
'.revision-crimson .rev065-item strong{font-size:11px;font-weight:850}',
'.revision-crimson .rev065-item .rev065-value small{font-size:10px;font-weight:800}',
'.revision-crimson .rev065-neg{color:#ff809c!important}',
'.revision-crimson .rev065-pos{color:#74e7b5!important}',
'.revision-crimson .rev065-noprice{color:#e6c080!important}',
'.revision-crimson .rev065-empty{font-size:11px;color:#b5c9dc;line-height:1.45;margin:7px 0}',
'@media(max-width:380px){.revision-crimson .rev065-board{padding:12px 10px!important}.revision-crimson .rev065-header h2{font-size:18px!important}.revision-crimson .rev065-metric{padding:9px 7px;min-height:84px}.revision-crimson .rev065-metric strong{font-size:17px!important}}',
'@media(min-width:760px){.revision-crimson .rev065-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
'@media print{.revision-crimson .rev065-board{break-inside:avoid}}'
].join('\n');
const make=(tag,klass,label)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(label!==undefined)e.textContent=label;return e};
const number=(n,decimals=3)=>Number(n).toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:decimals});
const rub=n=>Number(n).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽';
const finite=value=>value===null||value===undefined||value===''?null:(Number.isFinite(Number(value))?Number(value):null);
const signed=delta=>(delta<0?'−':delta>0?'+':'')+number(Math.abs(delta))+' кг';
function latestByStore(stores,history){
 return stores.map(store=>{
  const items=history.filter(a=>a?.store===store&&a.type==='weekly'&&Array.isArray(a.products))
    .sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0));
  const latest=items[0]||null;
  const other=latest?.id?items.find(a=>a.id===latest.id&&!a.pendingSync):null;
  return {store,audit:other||latest};
 });
}
function aggregate(stores,history){
 const out={stores:stores.length,covered:0,shortKg:0,extraKg:0,shortRub:0,extraRub:0,checked:0,matches:0,missingPrices:0,missingDiff:0,pending:0,issues:[]};
 for(const {store,audit} of latestByStore(stores,history)){
  if(!audit)continue;
  out.covered++;
  if(audit.pendingSync)out.pending++;
  for(const p of audit.products){
   const diff=finite(p?.diff);
   if(diff===null){out.missingDiff++;continue}
   out.checked++;
   if(Math.abs(diff)<0.0005){out.matches++;continue}
   const price=finite(p?.price);
   const validPrice=price!==null&&price>=0;
   const amount=validPrice?Math.abs(diff)*price:null;
   if(diff<0){out.shortKg+=-diff;if(validPrice)out.shortRub+=amount}
   else{out.extraKg+=diff;if(validPrice)out.extraRub+=amount}
   if(!validPrice)out.missingPrices++;
   out.issues.push({store,name:String(p?.name||'Без названия'),diff,amount});
  }
 }
 out.issues.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)||a.name.localeCompare(b.name,'ru')||a.store.localeCompare(b.store,'ru'));
 return out;
}
function paint(board,info){
 board.replaceChildren();
 const top=make('header','rev065-header');
 const block=make('div');
 block.append(make('span','rev065-eyebrow','CHEF CONTROL · 4 ТОЧКИ'),make('h2','','Общая сводка'),make('p','rev065-sub','Последняя сохранённая повторная ревизия каждой точки'));
 top.append(block,make('span','rev065-coverage',info.covered+' / '+info.stores+' точек'));
 board.append(top);
 const grid=make('div','rev065-grid');
 const entries=[
  ['🔴 Недостача','rev065-loss',info.covered?'− '+number(info.shortKg)+' кг':'—',rub(info.shortRub)],
  ['🟢 Излишек','rev065-gain',info.covered?'+ '+number(info.extraKg)+' кг':'—',rub(info.extraRub)],
  ['✅ Совпадений','rev065-match',info.covered?info.matches+' / '+info.checked:'—','проверенных продуктов'],
  ['🏪 Сверено','rev065-audits',info.covered+' / '+info.stores,'торговых точек']
 ];
 for(const [label,cls,main,sub] of entries){
  const e=make('div','rev065-metric '+cls);
  const note=info.missingPrices&&['rev065-loss','rev065-gain'].includes(cls)?'По указанным ценам: '+sub:sub;
  e.append(make('span','rev065-label',label),make('strong','',main),make('small','',note));grid.append(e);
 }
 board.append(grid);
 const notes=[];
 if(info.covered<info.stores)notes.push('Нет повторной ревизии: '+(info.stores-info.covered)+' точк.');
 if(info.missingPrices)notes.push('Без цены: '+info.missingPrices+' позиций. Суммы в ₽ неполные.');
 if(info.missingDiff)notes.push('Неполные записи: '+info.missingDiff+'.');
 if(info.pending)notes.push('Ожидают облака: '+info.pending+' точк.');
 if(notes.length)board.append(make('div','rev065-warnings',notes.join(' ')));
 const issues=make('section','rev065-issues');
 issues.append(make('h3','','Самые большие расхождения'),make('p','rev065-note','Три крупнейших по весу · остальные товары в карточках ниже'));
 if(!info.issues.length)issues.append(make('p','rev065-empty',info.covered?'Расхождений нет — проверенные остатки совпали.':'После повторной ревизии здесь появятся результаты.'));
 for(const item of info.issues.slice(0,3)){
  const row=make('div','rev065-item'),name=make('div','rev065-name'),values=make('div','rev065-value');
  const clr=item.diff<0?'rev065-neg':'rev065-pos';
  name.append(make('b','',item.name),make('small','',item.store));
  values.append(make('strong',clr,signed(item.diff)),
    make('small',item.amount===null?'rev065-noprice':clr,item.amount===null?'нет цены':(item.diff<0?'−':'+')+rub(item.amount)));
  row.append(name,values);issues.append(row);
 }
 board.append(issues);
}
function install(){
 if(typeof renderSummary!=='function'||typeof state!=='object')return;
 const root=document.getElementById('view-summary');
 const cards=document.getElementById('summaryCards');
 if(!root||!cards)return;
 const section=cards.closest('section.card');
 if(!section)return;
 if(!document.getElementById('rev065ChefCss')){const style=make('style');style.id='rev065ChefCss';style.textContent=STYLES;document.head.append(style)}
 const dashboard=make('section','rev065-board');dashboard.id='rev065Dashboard';dashboard.setAttribute('role','region');dashboard.setAttribute('aria-label','Сводка последних ревизий по всем точкам');
 root.insertBefore(dashboard,section);
 document.body.classList.add('rev065-ready');
 function refreshDashboard(){
  const select=document.getElementById('store');
  const stores=select?[...select.options].map(x=>x.value):[];
  paint(dashboard,aggregate(stores,Array.isArray(state.history)?state.history:[]));
 }
 const oldRender=renderSummary;
 renderSummary=function(){const result=oldRender.apply(this,arguments);refreshDashboard();return result};
 refreshDashboard();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();