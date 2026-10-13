// ==UserScript==
// @name         FARRUKH AI — Frontpad Reports Sync
// @namespace    https://farruhk-ai-mobile.onrender.com/
// @version      2.0.0
// @description  Синхронизация отчётов Frontpad с FARRUKH AI
// @match        https://app.frontpad.ru/*
// @grant        none
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

  let timer = null;
  let lastSignature = '';
  let lastSentAt = 0;

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  function visible(el) {
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }

  function activeText() {
    const selectors = [
      '[aria-current="page"]','[aria-selected="true"]','[aria-pressed="true"]',
      '.active','.selected','.current','.is-active','.nav-active',
      'h1','h2','h3'
    ];
    const parts = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        if (visible(el)) {
          const t = clean(el.innerText || el.textContent);
          if (t && t.length < 180) parts.push(t);
        }
      });
    }
    return parts.join(' | ');
  }

  function detectReport() {
    const focused = activeText();
    for (const [id, name] of REPORTS) {
      if (focused.toLowerCase().includes(name.toLowerCase())) return {id, name};
    }
    const heading = clean(document.querySelector('h1,h2,h3')?.innerText);
    for (const [id, name] of REPORTS) {
      if (heading.toLowerCase().includes(name.toLowerCase())) return {id, name};
    }
    return {id:'', name:''};
  }

  function detectPeriod() {
    const candidates = [...document.querySelectorAll('button,a,[role="button"],label,span')];
    for (const p of PERIODS) {
      const hit = candidates.find(el => visible(el) && clean(el.textContent) === p &&
        (el.matches('[aria-selected="true"],[aria-pressed="true"],.active,.selected,.current,.is-active') ||
         el.closest('[aria-selected="true"],[aria-pressed="true"],.active,.selected,.current,.is-active')));
      if (hit) return p;
    }
    const dateInputs = [...document.querySelectorAll('input')].filter(el =>
      visible(el) && /date|дата/i.test((el.type||'')+' '+(el.name||'')+' '+(el.placeholder||'')));
    const vals = dateInputs.map(x => clean(x.value)).filter(Boolean);
    if (vals.length >= 2) return vals[0] + ' — ' + vals[1];
    return '';
  }

  function detectBranch() {
    const selectors = [
      'select[name*="branch" i]','select[name*="point" i]','select[name*="filial" i]',
      'select[id*="branch" i]','select[id*="point" i]','select[id*="filial" i]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const t = clean(el?.selectedOptions?.[0]?.textContent);
      if (t) return t;
    }
    return '';
  }

  function extractTables() {
    return [...document.querySelectorAll('table')].filter(visible).map((table, index) => {
      const rows = [...table.querySelectorAll('tr')].map(tr =>
        [...tr.querySelectorAll('th,td')].map(td => clean(td.innerText || td.textContent))
      ).filter(r => r.some(Boolean));
      const caption = clean(table.querySelector('caption')?.innerText);
      const nearby = clean(table.closest('section,article,.card,.panel,.content,.tab-pane')?.querySelector('h1,h2,h3,h4,h5')?.innerText);
      return {
        title: caption || nearby || ('Таблица ' + (index + 1)),
        rows
      };
    }).filter(t => t.rows.length);
  }

  function payload() {
    const report = detectReport();
    const heading = clean(document.querySelector('h1,h2,h3')?.innerText);
    const tables = extractTables();
    return {
      source: 'frontpad',
      url: location.href,
      title: document.title,
      heading,
      report: report.id,
      reportName: report.name,
      period: detectPeriod(),
      branch: detectBranch(),
      timestamp: new Date().toISOString(),
      tables,
      text: clean(document.body?.innerText).slice(0, 150000)
    };
  }

  async function send(force = false) {
    try {
      const data = payload();
      const signature = JSON.stringify({
        url:data.url, report:data.report, period:data.period, branch:data.branch,
        tables:data.tables
      });
      const now = Date.now();
      if (!force && signature === lastSignature && now - lastSentAt < 60000) return;

      const r = await fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);

      lastSignature = signature;
      lastSentAt = now;
      console.log('[FARRUKH AI] Frontpad sync OK', {
        report:data.reportName || 'не определён',
        period:data.period || 'не определён',
        tables:data.tables.length
      });
    } catch (e) {
      console.error('[FARRUKH AI] Frontpad sync error', e);
    }
  }

  function schedule(force = false) {
    clearTimeout(timer);
    timer = setTimeout(() => send(force), 1400);
  }

  window.addEventListener('load', () => schedule(true));
  document.addEventListener('click', () => schedule(false), true);
  document.addEventListener('change', () => schedule(true), true);

  const observer = new MutationObserver(() => schedule(false));
  observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true});

  setInterval(() => send(false), 60000);
  schedule(true);
})();
