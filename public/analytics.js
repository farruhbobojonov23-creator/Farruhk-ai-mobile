;(()=>{
  const ANALYTICS_ID='analytics';
  const style=document.createElement('style');
  style.textContent=`
    .analytics-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .analytics-kpi{background:linear-gradient(180deg,#0f181b,#0a1012);border:1px solid #183028;border-radius:16px;padding:14px}
    .analytics-kpi small{display:block;color:#7f9098;font-size:10px;letter-spacing:.08em;margin-bottom:6px}
    .analytics-kpi strong{font-size:24px;color:#74ffad}
    .analytics-kpi span{display:block;color:#91a0a6;font-size:10px;margin-top:4px}
    .analytics-card{background:linear-gradient(180deg,#0e161a,#0a0f12);border:1px solid #17262d;border-radius:18px;padding:16px;margin-bottom:12px}
    .analytics-card h3{font-size:15px;margin:0 0 12px}.analytics-card p{color:#98a6ab;font-size:12px;line-height:1.5;margin:8px 0}
    .bar-row{display:grid;grid-template-columns:118px 1fr 34px;gap:8px;align-items:center;margin:10px 0}
    .bar-row label{font-size:11px;color:#dce4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bar-track{height:11px;background:#111c20;border:1px solid #1a2c31;border-radius:99px;overflow:hidden}
    .bar-fill{height:100%;background:linear-gradient(90deg,#23d66e,#72ffad);border-radius:99px}
    .bar-row b{font-size:11px;text-align:right;color:#b9c5c9}
    .branch-card{padding:11px 0;border-bottom:1px solid #17242a}.branch-card:last-child{border-bottom:0}
    .branch-card .head{display:flex;justify-content:space-between;gap:10px}.branch-card .head b{font-size:13px}.branch-card .head span{font-size:12px;color:#72ffad}
    .branch-card small{display:block;color:#7f9098;margin-top:5px;line-height:1.4}
    .report-pill{display:inline-block;border:1px solid #2a5b3e;background:#102019;color:#75ffad;border-radius:999px;padding:5px 8px;font-size:9px;margin:3px 4px 3px 0}
    .report-note{padding:10px 12px;border-radius:12px;background:#0c1518;border:1px solid #17302a;color:#aebbc0;font-size:11px;line-height:1.5}
    .analytics-refresh{width:100%;border:none;border-radius:14px;padding:12px;background:linear-gradient(135deg,#5dffa1,#20d86d);color:#062211;font-weight:800;margin-top:10px}
  `;
  document.head.appendChild(style);

  const main=document.querySelector('main');
  const nav=document.querySelector('.bottom-nav');
  if(!main||!nav||document.getElementById(ANALYTICS_ID))return;

  const screen=document.createElement('section');
  screen.id=ANALYTICS_ID;
  screen.className='screen';
  screen.innerHTML=`
    <div class="section-title"><span>FRONTPAD</span><h2>Аналитика продаж</h2></div>
    <div id="analyticsStatus" class="report-note">Загружаю данные…</div>
    <div id="analyticsBody" style="margin-top:12px"></div>
  `;
  main.appendChild(screen);

  const btn=document.createElement('button');
  btn.className='nav';
  btn.dataset.screen=ANALYTICS_ID;
  btn.innerHTML='▥<span>Аналитика</span>';
  nav.insertBefore(btn,nav.lastElementChild);
  nav.style.gridTemplateColumns='repeat(7,1fr)';
  btn.onclick=()=>{try{show(ANALYTICS_ID)}catch(e){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===ANALYTICS_ID));document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x===btn));}loadAnalytics();};

  const fmt=n=>new Intl.NumberFormat('ru-RU').format(Number(n||0));
  const escA=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function bars(branches){
    const max=Math.max(...branches.map(x=>x.units),1);
    return branches.map(x=>`<div class="bar-row"><label>${escA(x.name)}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,Math.round(x.units/max*100))}%"></div></div><b>${fmt(x.units)}</b></div>`).join('');
  }

  function render(data){
    const status=document.getElementById('analyticsStatus');
    const body=document.getElementById('analyticsBody');
    if(!body||!status)return;
    const branches=data.branches||[];
    const strongest=[...branches].sort((a,b)=>b.units-a.units)[0];
    const weakest=[...branches].sort((a,b)=>a.units-b.units)[0];
    status.innerHTML=`Последние данные: <b>${escA(data.date)}</b> · ${escA(data.source)}<br><span style="color:#78ffad">4 точки подключены к отчёту</span>`;
    body.innerHTML=`
      <div class="analytics-kpis">
        <div class="analytics-kpi"><small>ПРОДАНО ЕДИНИЦ</small><strong>${fmt(data.totalUnits)}</strong><span>по 4 точкам</span></div>
        <div class="analytics-kpi"><small>ТОЧЕК</small><strong>${branches.length}</strong><span>в сравнении</span></div>
        <div class="analytics-kpi"><small>СИЛЬНЕЕ ПО ОБЪЁМУ</small><strong style="font-size:16px">${escA(strongest?.name||'—')}</strong><span>${fmt(strongest?.units||0)} ед.</span></div>
        <div class="analytics-kpi"><small>ЗОНА ВНИМАНИЯ</small><strong style="font-size:16px">${escA(weakest?.name||'—')}</strong><span>${fmt(weakest?.units||0)} ед.</span></div>
      </div>

      <div class="analytics-card"><h3>Продажи по точкам</h3>${bars(branches)}<p>Показатель — количество проданных единиц из отчёта Frontpad «Товары». Это не выручка и не количество заказов.</p></div>

      <div class="analytics-card"><h3>Точки</h3>${branches.map(x=>`<div class="branch-card"><div class="head"><b>${escA(x.name)}</b><span>${fmt(x.units)} ед.</span></div><small>Сильная категория: ${escA(x.strongCategory||'—')} · ${fmt(x.strongCategoryUnits||0)} ед.</small><small>Лидер: ${escA(x.topItem||'—')} · ${fmt(x.topItemUnits||0)} шт.</small></div>`).join('')}</div>

      <div class="analytics-card"><h3>Отчёт шефу</h3>
        <span class="report-pill">Сильные точки</span><span class="report-pill">Слабые позиции</span><span class="report-pill">Нулевые продажи</span><span class="report-pill">Категории</span><span class="report-pill">Сравнение филиалов</span>
        <p>${escA(data.summary||'')}</p>
        <div class="report-note">Ежедневный полный отчёт настроен на вечер. Для автоматического обновления без ручной выгрузки следующим этапом подключаем получение свежих данных Frontpad.</div>
        <button id="frontpadReportBtn" class="analytics-refresh">Сформировать отчёт сейчас</button>
      </div>
    `;
    const reportBtn=document.getElementById('frontpadReportBtn');
    if(reportBtn)reportBtn.onclick=()=>{if(typeof askAI==='function')askAI('Сформируй полный отчёт Frontpad по четырём точкам на основе последних доступных данных: сильные и слабые точки, категории, топ-позиции, слабые позиции и что проверить шефу.');};
  }

  async function loadAnalytics(){
    try{
      const r=await fetch('/api/analytics/snapshot',{cache:'no-store'});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Ошибка');
      render(d);
    }catch(e){
      const status=document.getElementById('analyticsStatus');
      if(status)status.textContent='Не удалось загрузить аналитику: '+e.message;
    }
  }
  loadAnalytics();
})();
