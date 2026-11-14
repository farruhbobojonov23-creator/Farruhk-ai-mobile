import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const google=readFileSync(new URL('../public/recipe-google.js',import.meta.url),'utf8');
const device=readFileSync(new URL('../public/device-cloud-sync.js',import.meta.url),'utf8');

test('Settings Google button opens the actual Google connection dialog',()=>{
 assert.match(html,/connectionSettings\.onclick=\(\)=>\{settingsDialog\.close\(\);show\('recipes'\);googleSync\.open\(\)\}/);
 assert.doesNotMatch(html,/ttk-sync-summary button:last-of-type/);
 assert.match(google,/return \{schedule,render,open,openStatus\}/);
 assert.match(google,/button\.dataset\.googleSettings='1'/);
});

test('Device cloud sync is not incorrectly reported as a Google Docs delivery',()=>{
 assert.match(device,/Google Документы: не подключены/);
 assert.match(device,/Черновики остаются в Farukh AI/);
 assert.match(device,/farruh:device-cloud-synced/);
 assert.match(google,/addEventListener\('farruh:device-cloud-synced',schedule\)/);
 assert.match(google,/нет ТТК со статусом «Рецептура готова»/);
 assert.match(html,/Google ТТК · статус/);
 assert.match(html,/googleSync\.openStatus\(\)/);
 assert.match(html,/Отправка в Google ещё не подтверждена/);
 assert.match(html,/не выбран проект/);
});

test('Updated Google and device sync modules bypass stale browser cache',()=>{
 assert.match(html,/\/recipe-google\.js\?v=9/);
 assert.match(html,/\/device-cloud-sync\.js\?v=3/);
});
