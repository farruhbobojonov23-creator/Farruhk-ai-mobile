import {getDeviceSyncHealth} from './device-sync-status.js?v=1';
/* Verified status indicators. A green badge never means an untested cloud service works. */
import {DeviceStore} from '/device-store.js?v=72';
import {googleReady} from '/recipe-google.js';
import {recipeDigest} from '/recipe-release.js';

const STALE_BACKUP_MS = 36 * 60 * 60 * 1000;
let recent = null;
let recentRevision = null;
const item = (level, label) => ({level, label});
const hasPdf = value => {
 try {
  const u = new URL(value);
  return u.protocol === 'https:' && u.hostname === 'drive.google.com' &&
   /^\/file\/d\/[A-Za-z0-9_-]{10,}\/view$/.test(u.pathname);
 } catch { return false; }
};

export async function inspectSystemHealth({state, force = false} = {}) {
 const now = Date.now();
 const phone = getDeviceSyncHealth({enabled: (() => {try {return localStorage.getItem('farruh-device-cloud-sync-enabled-v1') !== 'false';} catch {return false;}})(), online: typeof navigator === 'undefined' || navigator.onLine !== false, now});
 if (!force && recent && recent.phoneLabel === phone.label && now - recent.checkedAt < 12000 &&
     (state === undefined || state?.revision === recentRevision)) return recent;

 let local = false, s = state;
 try {
  if (!s) s = await new DeviceStore().load();
  local = Boolean(s && Array.isArray(s.recipes));
 } catch { local = false; }
 let server = false;
 try {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
   throw Error('Устройство офлайн');
  const response = await fetch('/healthz', {cache: 'no-store', signal: AbortSignal.timeout(8000)});
  server = response.ok && (await response.json()).ok === true;
 } catch { server = false; }

 let google = item('warn', 'Google ТТК: не подключено');
 let googleLevel = 'warn';
 if (local && s.googleSync?.enabled && s.googleSync.endpoint && s.googleSync.key) {
  const ready = googleReady(s);
  if (!ready.length) {
   google = item('warn', 'Google ТТК: подключение указано, готовых карт нет');
  } else {
   try {
    const digests = await Promise.all(ready.map(recipeDigest));
    let confirmed = 0, failed = 0;
    ready.forEach((recipe, index) => {
     const delivery = s.googleDelivery?.[recipe.id];
     if (delivery?.error) failed++;
     if (delivery?.digest === digests[index] &&
         delivery?.layoutVersion === 'a4-pdf-1' && !delivery?.error &&
         hasPdf(delivery.pdfUrl)) confirmed++;
    });
    if (confirmed === ready.length) {
     googleLevel = 'ok';
     google = item('ok', 'Google ТТК и PDF А4: подтверждено ' + confirmed + '/' + ready.length);
    } else if (failed) {
     googleLevel = 'error';
     google = item('error', 'Google ТТК: ошибка PDF/отправки · ' + confirmed + '/' + ready.length);
    } else {
     google = item('warn', 'Google ТТК: ожидают подтверждения PDF · ' + (ready.length-confirmed));
    }
   } catch {
    google = item('warn', 'Google ТТК: не удалось проверить версии');
   }
  }
 } else if (local && s.googleSync?.enabled) {
  google = item('warn', 'Google ТТК: проверьте ссылку и ключ');
 }

 let backup = item('warn', 'Google Диск: резервирование не подтверждено');
 let backupLevel = 'warn';
 if (local && s.googleBackup?.enabled && s.googleBackup.endpoint && s.googleBackup.key) {
  const last = Date.parse(s.googleBackup.lastBackupAt || '');
  if (Number.isFinite(last) && last <= now && now - last <= STALE_BACKUP_MS) {
   backupLevel = 'ok';
   backup = item('ok', 'Google Диск: копия подтверждена ' +
    new Date(last).toLocaleString('ru-RU', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}));
  } else if (Number.isFinite(last)) {
   backup = item('warn', 'Google Диск: последняя копия старше 36 часов');
  } else {
   backup = item('warn', 'Google Диск: первая копия не подтверждена');
  }
 } else if (local && !s.googleBackup?.enabled) {
  backup = item('warn', 'Google Диск: автокопии отключены');
 }

 const result = {
  checkedAt: now, local, server, googleLevel, backupLevel, phoneLevel: phone.level, phoneLabel: phone.label,
  items: [
   item(server ? 'ok' : 'error', server ? 'Сервер Farukh AI отвечает' : 'Сервер: нет подтверждения связи'),
   item(local ? 'ok' : 'error', local ? 'Локальная база ТТК читается' : 'Локальная база недоступна'),
   google, backup, phone
  ],
  areas: {
   home: local && server, projects: local, recipes: local,
   preparations: local, lab: local, checks: local, tasks: local,
   calc: local, 'site-settings': local
  }
 };
 recent = result; recentRevision = s?.revision ?? null;
 return result;
}

function ensureStyle() {
 if (document.getElementById('fai-health-style')) return;
 const style = document.createElement('style');
 style.id = 'fai-health-style';
 style.textContent = `
 .fai-health-badge{display:inline-flex;flex:0 0 22px;align-items:center;justify-content:center;
  width:22px;height:22px;box-sizing:border-box;padding:0;border-radius:50%;
  border:1px solid rgba(49,217,147,.55);background:rgba(13,91,61,.88);
  box-shadow:0 0 0 1px rgba(13,91,61,.12),0 0 10px rgba(48,220,151,.12);
  color:#50ecaf;font:800 15px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:0;white-space:nowrap;user-select:none;pointer-events:none}
 .fai-health-badge[data-level="warn"]{border-color:rgba(234,178,94,.4);
  background:rgba(80,54,24,.75);color:#f0c77d}
 .pfv-status-item.error svg{color:#ff9ca5}
 .fai-health-badge[data-level="error"]{border-color:rgba(234,96,104,.4);
  background:rgba(86,27,35,.72);color:#ff9ca5}
 .pfv-hub-tile,.pfv-project,.pfv-action,.category-card,.view .tile,#lab .haccp-journal-card{position:relative}
 .pfv-hub-tile>.fai-health-badge,.pfv-project>.fai-health-badge,
 .pfv-action>.fai-health-badge,.category-card>.fai-health-badge,
 .view .tile>.fai-health-badge,#lab .haccp-journal-card>.fai-health-badge{
  position:absolute;right:8px;top:8px;pointer-events:none;z-index:1}
 .pfv-project>.fai-health-badge{top:auto;bottom:7px}
 #lab .haccp-journal-card>.fai-health-badge{top:auto;bottom:5px;right:8px}
 .pfv-action>.fai-health-badge{top:5px;right:5px;width:20px;height:20px;flex-basis:20px;font-size:13px}
 .pfv-nav>.fai-health-badge,.pfv-phone-nav .fai-health-badge{margin-left:auto}
 .pfv-nav,.pfv-phone-nav button{min-width:0}
 .pfv-nav .fai-health-badge{width:19px;height:19px;flex-basis:19px;font-size:13px}
 .pfv-phone-nav .fai-health-badge{width:16px;height:16px;flex-basis:16px;font-size:11px}
 #recipes .catalog-heading>.fai-health-badge{margin-left:auto}
 .view>.bar>.fai-health-badge,.data-center-section>h3>.fai-health-badge{
  margin-left:9px;vertical-align:middle}
 @media(max-width:600px){
  .pfv-hub-tile>.fai-health-badge,.category-card>.fai-health-badge{width:20px;height:20px;flex-basis:20px;font-size:13px}
  .pfv-project>.fai-health-badge{bottom:4px}
 }
 `;
 document.head.append(style);
}

function putBadge(node, level, message, title) {
 if (!node || !node.isConnected) return;
 let badge = Array.from(node.children).find(child => child.matches?.('[data-fai-health]'));
 if (!badge) {
  badge = document.createElement('span');
  badge.dataset.faiHealth = '1';
  badge.className = 'fai-health-badge';
  node.append(badge);
 }
 // Keep detailed diagnostics available to assistive tech and long-press tooltips,
 // but use one compact symbol in the interface without a visible status label.
 const icon = level === 'ok' ? '✓' : level === 'error' ? '!' : '?';
 const explanation = [message, title].filter(Boolean).join(' — ');
 if (badge.dataset.level !== level) badge.dataset.level = level;
 if (badge.textContent !== icon) badge.textContent = icon;
 if (badge.title !== explanation) badge.title = explanation;
 if (badge.getAttribute('aria-label') !== explanation) badge.setAttribute('aria-label', explanation);
 if (badge.getAttribute('role') !== 'img') badge.setAttribute('role','img');
}

export function mountSystemBadges() {
 if (window.__faiHealthBadgesMounted) return;
 window.__faiHealthBadgesMounted = true;
 ensureStyle();
 let snapshot = null, timer = null, busy = false, pendingCheck = false;
 function render() {
  if (!snapshot) return;
  // Navigation is not a functional check. Only show badges for measured data services.
  document.querySelectorAll('[data-fai-health]').forEach(badge=>{
   if(!badge.closest('[data-local-section],[data-google-section],[data-backup-section],[data-device-section]'))badge.remove();
  });
  for (const [section, level, label] of [
   ['[data-local-section]', snapshot.local ? 'ok' : 'error', snapshot.local ? '✓ Работает' : '! Ошибка'],
   ['[data-google-section]', snapshot.googleLevel, snapshot.googleLevel === 'ok' ? '✓ PDF сохранён' : '• Проверить'],
   ['[data-backup-section]', snapshot.backupLevel, snapshot.backupLevel === 'ok' ? '✓ Копия есть' : '• Проверить'],
   ['[data-device-section]', snapshot.phoneLevel, snapshot.phoneLabel]
  ]) {
   const h = document.querySelector('.data-center-section' + section + '>h3');
   if (h) putBadge(h, level, label, 'Статус основан на последней подтверждённой проверке, не на цвете кнопки.');
  }
 }

 const scheduleRender = () => {
  clearTimeout(timer);
  timer = setTimeout(render, 100);
 };
 const check = async (force = false) => {
  if (document.hidden) return;
  if (busy) {pendingCheck = true; return;}
  busy = true;
  try { snapshot = await inspectSystemHealth({force}); render(); }
  finally {busy = false; if (pendingCheck) {pendingCheck = false; void check(true);}}
 };
 // Newly opened data panels receive their last confirmed status.
 const observer = new MutationObserver(mutations => {
  if (mutations.some(m => [...m.addedNodes].some(n =>
   n.nodeType === 1 && !n.matches?.('[data-fai-health]')))) scheduleRender();
 });
 observer.observe(document.body, {childList:true, subtree:true});
 for (const name of ['farruh:device-cloud-status-changed','farruh:google-ttk-status-changed','farruh:device-cloud-synced',
  'farruh:projects-changed','pf:projects']) document.addEventListener(name, () => { void check(true); });
 window.addEventListener('offline', () => { void check(true); });
 window.addEventListener('storage', () => { void check(true); });
 window.addEventListener('focus', () => { void check(true); });
 document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(true); });
 setInterval(() => { if (!document.hidden) void check(true); }, 60000);
 void check(true);
}
