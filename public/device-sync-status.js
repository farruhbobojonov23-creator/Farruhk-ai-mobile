// Session-local evidence: a reload must obtain a fresh cloud confirmation.
let phase = 'unknown';
let confirmedAt = 0;
export function setDeviceSyncStatus(next) {
 phase = next;
 if (next === 'ok') confirmedAt = Date.now();
 if (typeof document !== 'undefined')
  document.dispatchEvent(new Event('farruh:device-cloud-status-changed'));
}
export function getDeviceSyncHealth({enabled = true, online = true, now = Date.now()} = {}) {
 const result = (level, label) => ({level, label: 'Телефон ↔ облако: ' + label});
 if (!enabled) return result('warn', 'синхронизация отключена');
 if (!online) return result('error', 'нет подключения к сети');
 if (phase === 'error') return result('error', 'последняя синхронизация не подтверждена');
 if (phase === 'checking') return result('warn', 'идёт синхронизация');
 if (phase === 'ok' && now >= confirmedAt && now - confirmedAt <= 120000)
  return result('ok', 'синхронизация подтверждена');
 return result('warn', 'ожидает подтверждения синхронизации');
}
