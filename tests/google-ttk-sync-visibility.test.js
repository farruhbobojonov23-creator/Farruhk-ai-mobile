import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const google=readFileSync(new URL('../public/recipe-google.js',import.meta.url),'utf8');
const device=readFileSync(new URL('../public/device-cloud-sync.js',import.meta.url),'utf8');

test('Settings Google button opens the actual Google connection dialog',()=>{
 assert.match(html,/settingsDataButton\.onclick=\(\)=>dataCenter\.open\(\)/);
 assert.match(google,/\(mountRoot\|\|recipesView\)\.append\(backupTools\)/);
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
 assert.match(html,/Мои данные · Google и резервные копии/);
 assert.match(html,/dataCenter\.googleRoot/);
 assert.match(html,/Отправка в Google ещё не подтверждена/);
 assert.match(html,/не выбран проект/);
});

test('Updated Google and device sync modules bypass stale browser cache',()=>{
 assert.match(html,/\/recipe-google\.js\?v=17/);
 assert.match(html,/\/device-cloud-sync\.js\?v=6/);
});
