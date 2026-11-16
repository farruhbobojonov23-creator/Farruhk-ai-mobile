import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const health = readFileSync(new URL('../public/system-health.js', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../public/premium-royal-v2.js', import.meta.url), 'utf8');
test('health indicator uses real server and Google PDF confirmations', () => {
  for (const token of ["fetch('/healthz'", 'new DeviceStore().load()', 'ready.map(recipeDigest)', 'hasPdf(delivery.pdfUrl)', 'delivery?.error']) assert.ok(health.includes(token), token);
  assert.ok(health.includes("googleLevel = 'error'"));
});
test('backup green requires recent confirmed copy', () => {
  for (const token of ['lastBackupAt', 'now - last <= STALE_BACKUP_MS', 'первая копия не подтверждена']) assert.ok(health.includes(token), token);
});
test('badges are reserved for confirmed data services, not untested navigation', () => {
  assert.ok(health.includes("badge.remove()"));
  assert.ok(health.includes("[data-local-section],[data-google-section],[data-backup-section],[data-device-section]"));
  assert.ok(!health.includes("snapshot.areas[route]"));
  assert.ok(!health.includes("✓ Доступно"));
});
test('dashboard checks live data instead of fake green', () => {
  assert.ok(dashboard.includes('mountSystemBadges()'));
  assert.ok(dashboard.includes('inspectSystemHealth({state,force})'));
  assert.ok(!dashboard.includes('Google: состояние подключения здесь не проверено'));
});

test('badges show symbols only and retain accessible descriptions', () => {
  assert.ok(health.includes("level === 'ok' ? '✓' : level === 'error' ? '!' : '?'"));
  assert.ok(health.includes("badge.textContent !== icon"));
  assert.ok(health.includes("badge.setAttribute('aria-label', explanation)"));
  assert.ok(health.includes("badge.setAttribute('role','img')"));
  assert.ok(health.includes("width:22px;height:22px"));
  assert.ok(!health.includes("badge.textContent !== message"));
});
