/* Interface appearance only: never changes a recipe, project or printed A4. */
(function () {
  'use strict';
  const key = 'shef-ai-premium-interface-v1';
  const themes = [
    { id: 'chef-glass', name: 'ШЕФ AI · Glass Premium', note: '3D стекло · арктический голубой', detail: 'Премиальная студия: объёмные панели, мягкие блики, градиенты и единый дизайн всех разделов.' },
    { id: 'shef51', name: 'SHEF51 Original', note: 'Чёрный · красный · белый', detail: 'Характер Shef51: глубокий чёрный, яркие акценты и выразительные заголовки.' },
    { id: 'pearl', name: 'SHEF51 Pearl', note: 'Светлый · красный · графит', detail: 'Светлая рабочая студия с фирменными красными кнопками.' },
    { id: 'gold', name: 'SHEF51 Gold', note: 'Графит · шампань · золото', detail: 'Спокойный тёмный кабинет с тёплыми золотыми деталями.' },
    { id: 'burgundy', name: 'SHEF51 Burgundy', note: 'Бордо · розовый · сливочный', detail: 'Мягкие винные оттенки, округлые окна и авторская типографика.' }
  ];
  let selected = 'chef-glass';
  try {
    const saved = localStorage.getItem(key);
    if (themes.some(theme => theme.id === saved)) selected = saved;
  } catch (_) { /* Storage may be disabled; appearance still works. */ }
  function apply(id) {
    const theme = themes.find(item => item.id === id);
    if (!theme) return;
    selected = id;
    document.documentElement.dataset.studioTheme = id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = { 'chef-glass':'#071426', shef51: '#090909', pearl: '#f7f5f1', gold: '#141412', burgundy: '#24171d' }[id];
    document.querySelectorAll('[data-interface-theme]').forEach(button => {
      const active = button.dataset.interfaceTheme === id;
      button.setAttribute('aria-checked', String(active));
      button.tabIndex = active ? 0 : -1;
      button.querySelector('.appearance-selected').textContent = active ? '✓ Выбрано' : 'Выбрать';
    });
    document.querySelectorAll('[data-current-interface-theme]').forEach(el => { el.textContent = theme.name; });
  }
  apply(selected); // Before the first paint: no flash of a different palette.
  function cards() {
    return themes.map(theme => `<button type="button" class="appearance-option" role="radio" aria-checked="false" data-interface-theme="${theme.id}" aria-label="${theme.name}: ${theme.note}">
      <span class="appearance-mini appearance-${theme.id}" aria-hidden="true"><span class="appearance-mini-nav"><i></i><i></i><i></i></span><span class="appearance-mini-main"><span class="appearance-mini-top"></span><span class="appearance-mini-cards"><i></i><i></i></span><span class="appearance-mini-sheet"><i></i><i></i><i></i></span></span></span>
      <span class="appearance-title">${theme.name}</span><span class="appearance-note">${theme.note}</span><span class="appearance-detail">${theme.detail}</span><span class="appearance-selected">Выбрать</span></button>`).join('');
  }
  function init() {
    const settings = document.getElementById('viewSettings');
    const settingsForm = document.getElementById('settingsForm');
    if (!settings || !settingsForm) return;
    const panel = document.createElement('section');
    panel.className = 'appearance-settings surface';
    panel.setAttribute('aria-labelledby', 'appearanceHeading');
    panel.innerHTML = `<div class="appearance-heading"><div><div class="mini-label">ВАШ СТИЛЬ</div><h3 id="appearanceHeading">Дизайн студии</h3><p>Выберите оформление меню, кнопок и окон. Переключение — сразу, без перезагрузки.</p></div><span class="appearance-current" data-current-interface-theme></span></div><div class="appearance-grid" role="radiogroup" aria-label="Дизайн интерфейса">${cards()}</div><p class="appearance-caption">Выбор сохраняется в этом браузере. Шаблон листа А4 выбирается отдельно в конструкторе ТТК.</p>`;
    settings.insertBefore(panel, settingsForm);
    const dialog = document.createElement('dialog');
    dialog.id = 'appearanceDialog';
    dialog.setAttribute('aria-labelledby', 'appearanceDialogTitle');
    dialog.innerHTML = `<div class="modal-head"><div><div class="mini-label">ШЕФ AI PREMIUM</div><h2 id="appearanceDialogTitle">Выберите свой стиль</h2><p>Пять оформлений, включая новый премиальный стеклянный стиль.</p></div><button type="button" class="modal-close" aria-label="Закрыть выбор дизайна">×</button></div><div class="modal-body"><div class="appearance-grid" role="radiogroup" aria-label="Быстрый выбор дизайна">${cards()}</div><p class="appearance-caption">Меняются окна, меню и кнопки. Ваш документ и его оформление сохраняются.</p><p class="appearance-feedback" role="status" aria-live="polite"></p></div><div class="modal-foot"><button type="button" class="btn btn-primary appearance-done">Готово</button></div>`;
    document.body.append(dialog);
    let opener = null;
    const open = event => {
      opener = event.currentTarget;
      dialog.showModal();
      dialog.querySelector('[aria-checked="true"]').focus();
    };
    const close = () => dialog.close();
    dialog.querySelector('.modal-close').addEventListener('click', close);
    dialog.querySelector('.appearance-done').addEventListener('click', close);
    dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
    });
    const switcher = document.createElement('button');
    switcher.type = 'button';
    switcher.className = 'btn btn-light appearance-switch';
    switcher.setAttribute('aria-label', 'Выбрать дизайн студии');
    switcher.setAttribute('aria-haspopup', 'dialog');
    switcher.setAttribute('aria-controls', 'appearanceDialog');
    switcher.innerHTML = '<span class="appearance-switch-dot" aria-hidden="true"></span><span>Дизайн</span>';
    switcher.addEventListener('click', open);
    document.querySelector('.top-actions')?.prepend(switcher);
    const authSwitcher = switcher.cloneNode(true);
    authSwitcher.classList.add('appearance-auth-switch');
    authSwitcher.addEventListener('click', open);
    document.querySelector('.auth-panel')?.append(authSwitcher);
    function choose(id) {
      apply(id);
      let message = 'Дизайн сохранён в этом браузере: ' + themes.find(theme => theme.id === selected).name;
      try { localStorage.setItem(key, selected); }
      catch (_) { message = 'Дизайн применён. Браузер не разрешает сохранить выбор после закрытия.'; }
      dialog.querySelector('.appearance-feedback').textContent = message;
      panel.querySelector('.appearance-caption').textContent = message + '. Шаблон А4 выбирается отдельно.';
    }
    [panel, dialog].forEach(container => {
      container.addEventListener('click', event => {
        const button = event.target.closest('[data-interface-theme]');
        if (button) choose(button.dataset.interfaceTheme);
      });
      container.addEventListener('keydown', event => {
        const button = event.target.closest('[data-interface-theme]');
        if (!button || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...button.closest('[role="radiogroup"]').querySelectorAll('[data-interface-theme]')];
        let index = buttons.indexOf(button);
        if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = buttons.length - 1;
        else index = (index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length;
        choose(buttons[index].dataset.interfaceTheme);
        buttons[index].focus();
      });
    });
    window.addEventListener('storage', event => {
      if (event.key === key) apply(event.newValue || 'chef-glass');
    });
    apply(selected);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
