// ==UserScript==
// @name         FARRUKH AI — Frontpad Live
// @namespace    https://farruhk-ai-mobile.onrender.com/
// @version      3.0.0
// @description  Автоматически отправляет открытый отчёт Frontpad в FARRUKH AI
// @match        *://*.frontpad.ru/*
// @match        *://frontpad.ru/*
// @grant        GM_xmlhttpRequest
// @connect      farruhk-ai-mobile.onrender.com
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const ENDPOINT = 'https://farruhk-ai-mobile.onrender.com/api/frontpad/browser-import';
  const REPORTS = [
    ['revenue', 'Выручка'],
    ['products', 'Товары'],
    ['cost', 'Себестоимость'],
    ['raw-materials', 'Движение сырья'],
    ['purchases', 'История закупок'],
    ['abc', 'ABC-анализ'],
    ['cohort', 'Когортный анализ']
  ];
  const PERIODS = ['Сегодня','Вчера','Неделя','Месяц','Год'];

  let lastSignature = '';
  let lastSentAt = 0;
  let timer = null;

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  function badge(text, ok) {
    let el = document.getElementById('farrukh-ai-sync-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'farrukh-ai-sync-badge';
      Object.assign(el.style, {
        position:'fixed', right:'14px', bottom:'14px', zIndex:'2147483647',
        padding:'10px 13px', borderRadius:'999px', font:'600 12px Arial,sans-serif',
        boxShadow:'0 10px 30px rgba(0,0,0,.22)', cursor:'default'
      });
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
    el.style.background = ok ? '#0f8f55' : '#161616';
    el.style.color = '#fff';
    el.style.border = ok ? '1px solid #48c989' : '1px solid #4b4b4b';
  }

  function detectReport() {
    const all = clean(document.body?.innerText).toLowerCase();
    for (const [id, name] of REPORTS) {
      if (all.includes(name.toLowerCase())) return {id, name};
    }
    return {id:'', name:''};
  }

  function detectPeriod() {
    const selected = [...document.querySelectorAll(
      '[aria-selected="true"],[aria-pressed="true"],.active,.selected,.current,.is-active'
    )].map(x => clean(x.innerText || x.textContent)).join(' | ');

    for (const p of PERIODS) if (selected.includes(p)) return p;

    const body = clean(document.body?.innerText);
    for (const p of PERIODS) if (body.includes(p)) return p;

    const inputs = [...document.querySelectorAll('input')].map(x => clean(x.value)).filter(Boolean);
    if (inputs.length >= 2) return inputs[0] + ' — ' + inputs[1];
    return '';
  }

  function detectBranch() {
    const selects = [...document.querySelectorAll('select')];
    for (const el of selects) {
      const label = clean((el.name || '') + ' ' + (el.id || '') + ' ' + (el.previousElementSibling?.textContent || ''));
      if (/точк|филиал|branch|point|restaurant|подраздел/i.test(label)) {
        const t = clean(el.selectedOptions?.[0]?.textContent);
        if (t) return t;
      }
    }
    return '';
  }

  function extractTables() {
    const result = [];
    document.querySelectorAll('table').forEach((table, index) => {
      const rows = [...table.querySelectorAll('tr')].map(tr =>
        [...tr.querySelectorAll('th,td')].map(td => clean(td.innerText || td.textContent))
      ).filter(r => r.some(Boolean));
      if (!rows.length) return;

      const caption = clean(table.querySelector('caption')?.innerText);
      const holder = table.closest('section,article,.card,.panel,.content,.tab-pane,.report');
      const nearby = clean(holder?.querySelector('h1,h2,h3,h4,h5')?.innerText);

      result.push({
        title: caption || nearby || ('Таблица ' + (index + 1)),
        rows: rows.slice(0, 1000)
      });
    });
    return result.slice(0, 50);
  }

  function makePayload() {
    const report = detectReport();
    return {
      source:'frontpad',
      url:location.href,
      title:document.title,
      heading:clean(document.querySelector('h1,h2,h3')?.innerText),
      report:report.id,
      reportName:report.name,
      period:detectPeriod(),
      branch:detectBranch(),
      timestamp:new Date().toISOString(),
      tables:extractTables(),
      text:clean(document.body?.innerText).slice(0,150000)
    };
  }

  function post(data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method:'POST',
        url:ENDPOINT,
        headers:{'Content-Type':'application/json'},
        data:JSON.stringify(data),
        timeout:20000,
        onload:r => r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error('HTTP ' + r.status)),
        onerror:() => reject(new Error('network')),
        ontimeout:() => reject(new Error('timeout'))
      });
    });
  }

  async function send(force = false) {
    const data = makePayload();
    const signature = JSON.stringify({
      url:data.url, report:data.report, period:data.period, branch:data.branch, tables:data.tables
    });
    const now = Date.now();
    if (!force && signature === lastSignature && now - lastSentAt < 30000) return;

    badge('FARRUKH AI · отправка…', false);
    try {
      await post(data);
      lastSignature = signature;
      lastSentAt = now;
      badge('FARRUKH AI ✓ данные отправлены', true);
      console.log('[FARRUKH AI] sync ok', {
        report:data.reportName || 'не определён',
        period:data.period || 'не определён',
        branch:data.branch || 'все точки',
        tables:data.tables.length
      });
    } catch (e) {
      badge('FARRUKH AI · ошибка отправки', false);
      console.error('[FARRUKH AI] sync error', e);
    }
  }

  function schedule(force = false) {
    clearTimeout(timer);
    timer = setTimeout(() => send(force), 1200);
  }

  badge('FARRUKH AI · скрипт запущен', false);
  window.addEventListener('load', () => schedule(true));
  document.addEventListener('click', () => schedule(false), true);
  document.addEventListener('change', () => schedule(true), true);

  let oldUrl = location.href;
  setInterval(() => {
    if (location.href !== oldUrl) {
      oldUrl = location.href;
      schedule(true);
    } else {
      send(false);
    }
  }, 15000);

  new MutationObserver(() => schedule(false))
    .observe(document.documentElement, {subtree:true, childList:true, characterData:true});

  schedule(true);
})();