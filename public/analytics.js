;(()=>{
 const main=document.querySelector('main');if(!main||document.getElementById('analytics'))return;
 const section=document.createElement('section');section.id='analytics';section.className='screen';
 section.innerHTML='<div class="section-title"><span>СУШИ БЕРИ / FRONTPAD</span><h2>Аналитика четырёх точек</h2></div><div id="analyticsStatus" class="notice">Загружаю последний снимок…</div><div id="analyticsBody"></div>';
 main.append(section);
 const nav=document.createElement('button');nav.className='nav';nav.dataset.screen='analytics';nav.innerHTML='▥<span>Аналитика</span>';
 document.querySelector('.bottom-nav').append(nav);
 nav.onclick=()=>show('analytics');
 // Five main destinations; projects and management are accessible from the workspace.
 const bar=document.querySelector('.bottom-nav');['home','analytics','chat','cost','settings'].forEach(id=>{const b=bar.querySelector('[data-screen="'+id+'"]');if(b){b.hidden=false;bar.append(b)}});
 bar.querySelectorAll('[data-screen="projects"],[data-screen="admin"]').forEach(b=>b.hidden=true);bar.style.gridTemplateColumns='repeat(5,1fr)';
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=v=>new Intl.NumberFormat('ru-RU').format(v);let snapshot=null;
 function report(d,branches){return 'СУШИ БЕРИ · СНИМОК ПРОДАЖ\nДата: '+d.date+'\nИсточник: '+d.source+'\nПериод неполный. Время выгрузки не указано.\n\n'+branches.map(b=>b.name+': '+n(b.units)+' ед.\nЛидер по количеству: '+b.topItem+' — '+n(b.topItemUnits)+' шт.').join('\n\n')+'\n\nВсего в выбранных точках: '+n(branches.reduce((s,b)=>s+b.units,0))+' ед.\n\nКоличество единиц не равно количеству заказов. Данных о выручке, прибыли и прошлых периодах нет. Автовыгрузка не подключена.\n\nЧто проверить: одинаковый период выгрузок, стоп-лист, доступность популярных блюд. Это пункты проверки, а не установленные причины различий.';}
 function render(){
 const d=snapshot;const selected=document.getElementById('branchFilter')?.value||'';
 const branches=d.branches.filter(b=>!selected||b.name===selected);const total=branches.reduce((s,b)=>s+b.units,0);const max=Math.max(1,...branches.map(b=>b.units));
 const today=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow'}).format(new Date());
 document.getElementById('analyticsStatus').innerHTML='<b>'+ (d.date===today?'Частичный снимок':'Архивный снимок')+' за '+e(d.date)+'</b><br>'+e(d.source)+'. Время выгрузки неизвестно. Автоматическое обновление не подключено.';
 const body=document.getElementById('analyticsBody');
 body.innerHTML='<div class="report-toolbar"><select id="branchFilter" class="field" aria-label="Выбрать точку"><option value="">Все четыре точки</option>'+d.branches.map(b=>'<option '+(selected===b.name?'selected':'')+' value="'+e(b.name)+'">'+e(b.name)+'</option>').join('')+'</select><button class="secondary" id="refreshSnapshot">Обновить снимок</button></div>'+ 
 '<div class="metrics"><div class="metric"><small>ПРОДАНО ЕДИНИЦ</small><strong>'+n(total)+'</strong><p>В загруженном периоде</p></div><div class="metric"><small>ТОЧЕК В ВЫБОРКЕ</small><strong>'+branches.length+'</strong><p>Из четырёх точек сети</p></div><div class="metric"><small>ВЫРУЧКА</small><strong>—</strong><p>Отчёт не загружен</p></div><div class="metric"><small>СРЕДНИЙ ЧЕК</small><strong>—</strong><p>Нет суммы и числа заказов</p></div></div>'+
 '<div class="analytics-columns"><div class="card"><h3>Объём продаж</h3>'+[...branches].sort((a,b)=>b.units-a.units).map(b=>'<div class="branch-row"><div><b>'+e(b.name)+'</b><small>'+n(b.units/Math.max(total,1)*100)+'% выбранного объёма</small></div><strong>'+n(b.units)+' ед.</strong><div class="branch-bar"><i style="width:'+Math.round(b.units/max*100)+'%"></i></div></div>').join('')+'<p class="muted">Сравнение по количеству единиц. По неполному снимку нельзя оценить прибыльность или качество работы точки.</p></div><div class="card"><h3>Лидеры в загруженном отчёте</h3>'+branches.map(b=>'<div class="branch-row"><div><b>'+e(b.name)+'</b><small>'+e(b.topItem)+'</small></div><strong>'+n(b.topItemUnits)+' шт.</strong></div>').join('')+'<p class="muted">Для нулевых продаж и динамики нужны полные выгрузки товаров за сопоставимые периоды.</p></div></div>'+
 '<div class="card"><h3>Отчёт шефу</h3><div class="report-copy" id="reportText"></div><div class="report-toolbar"><button class="secondary" id="copyReport">Копировать отчёт</button><button class="secondary" id="downloadReport">Скачать TXT</button><button class="secondary" id="askReport">Разобрать с AI</button></div></div><div class="notice"><b>Ежедневный отчёт · 21:00 МСК</b><br>Это целевое время. Получение свежих данных из Frontpad и автоматическая доставка в этом приложении ещё не подключены.</div>';
 document.getElementById('reportText').textContent=report(d,branches);
 document.getElementById('branchFilter').onchange=render;
 document.getElementById('refreshSnapshot').onclick=load;
 document.getElementById('copyReport').onclick=async()=>{try{await navigator.clipboard.writeText(report(d,branches));window.chefToast('Отчёт скопирован')}catch{window.chefToast('Не удалось скопировать. Используй «Скачать TXT».')}};
 document.getElementById('downloadReport').onclick=()=>{const u=URL.createObjectURL(new Blob([report(d,branches)],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='Sushi-Beri-'+d.date+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 document.getElementById('askReport').onclick=()=>askAI('Разбери снимок Frontpad. Отдели факты от гипотез и предложи три действия шефу. Не считай этот снимок полным днём. Выбранные точки: '+branches.map(b=>b.name).join(', '));
 }
 async function load(){const button=document.getElementById('refreshSnapshot');if(button)button.disabled=true;try{const r=await fetch('/api/analytics/snapshot',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.branches)||!d.branches.every(b=>typeof b.name==='string'&&Number.isFinite(b.units)&&b.units>=0))throw Error();snapshot=d;render();}catch{document.getElementById('analyticsStatus').textContent='Не удалось получить снимок. Проверь интернет и повтори.';if(!snapshot)document.getElementById('analyticsBody').innerHTML='<button id="retryAnalytics" class="secondary">Повторить</button>';const retry=document.getElementById('retryAnalytics');if(retry)retry.onclick=load;}finally{const b=document.getElementById('refreshSnapshot');if(b)b.disabled=false}}
 load();
})();
