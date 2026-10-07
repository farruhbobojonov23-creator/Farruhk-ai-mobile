export function parseLiveReports(data){
  const metrics=[];const seen=new Set();
  const wanted=[
    ['Выручка',/выручк|оборот|сумма продаж/i],
    ['Заказы',/заказ/i],
    ['Средний чек',/средн.*чек/i],
    ['Прибыль',/прибыл/i],
    ['Себестоимость',/себестоим/i]
  ];
  const toNumber=v=>{if(v===null||v===undefined||!String(v).trim()||/%/.test(String(v)))return null;const s=String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,'').replace(',','.').replace(/[^\d.-]/g,'');const n=Number(s);return Number.isFinite(n)?n:null};
  for(const report of data?.reports||[]){
    for(const table of report.tables||[]){
      const rows=Array.isArray(table)?table:[];
      for(const row of rows){
        const text=(row||[]).join(' ');
        for(const [label,re] of wanted){
          if(seen.has(label)||!re.test(text))continue;
          const vals=(row||[]).slice(1).map(toNumber).filter(v=>v!==null);
          if(vals.length===1){metrics.push({label,value:vals[0],source:report.title||report.sourceTitle||'Frontpad'});seen.add(label)}
        }
      }
    }
  }
  return metrics;
}
