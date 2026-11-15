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
test('categories and subcategories are annotated', () => {
  for (const token of ['.pfv-nav[data-pfv-route]', '#recipe-categories .category-card', '#lab .haccp-journal-card', '.data-center-section']) assert.ok(health.includes(token), token);
});
test('dashboard checks live data instead of fake green', () => {
  assert.ok(dashboard.includes('mountSystemBadges()'));
  assert.ok(dashboard.includes('inspectSystemHealth({state,force})'));
  assert.ok(!dashboard.includes('Google: состояние подключения здесь не проверено'));
});
