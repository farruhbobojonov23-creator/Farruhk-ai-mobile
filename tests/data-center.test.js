import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=load('index.html'),hub=load('data-center.js'),css=load('data-center.css');
const backup=load('google-backup.js'),google=load('recipe-google.js'),devices=load('device-cloud-sync.js');
const luxury=load('luxury-ui.js'),settings=load('site-settings.js');

test('a single My Data entry from TTK and Settings opens the same dialog',()=>{
 assert.match(html,/const dataCenter=createDataCenter/);
 assert.match(html,/syncQuickButton\.onclick=\(\)=>dataCenter\.open\(\)/);
 assert.match(html,/settingsDataButton\.onclick=\(\)=>dataCenter\.open\(\)/);
 assert.match(settings,/openDataCenter\?\.\(\)/);
 assert.doesNotMatch(html,/googleTtkQuickButton/);
 assert.doesNotMatch(html,/connectionSettings\.onclick/);
 assert.doesNotMatch(settings,/button\('☁️ Синхронизация телефона и планшета'/);
});

test('TTK, backup, and optional phone sync controls are all mounted inside one hub',()=>{
 assert.match(hub,/id='data-center-dialog'/);
 for(const section of ['data-local-root','data-google-root','data-backup-root','data-device-root']){
  assert.ok(hub.includes(section),'Missing section '+section);
 }
 assert.match(html,/mountRoot:dataCenter\.googleRoot/);
 assert.match(html,/buttonRoot:dataCenter\.backupRoot/);
 assert.match(html,/panelRoot:dataCenter\.deviceRoot/);
 assert.match(html,/dataCenter\.localRoot\.append\(dataTools\)/);
 assert.match(google,/\(mountRoot\|\|recipesView\)\.append\(backupTools\)/);
 assert.match(backup,/buttonRoot\|\|document\.getElementById\('device-export'\)/);
 assert.match(devices,/\(panelRoot\|\|settingsDialog\)\.append\(node\)/);
});

test('automatic backups and TTK sync are retained with no forced cloud device writes',()=>{
 assert.match(hub,/Последняя подтверждённая копия/);
 assert.match(hub,/lastBackupAt/);
 assert.match(hub,/googleDriveBackup\.backup\(\{manual:true\}\)/);
 assert.match(backup,/Date\.now\(\)-last<24\*3600\*1000/);
 assert.match(google,/retryButton\.onclick=\(\)=>flush/);
 assert.match(devices,/if\(!enabled\(\)\|\|!getState\(\)\)return/);
 assert.match(html,/dataCenter\.bind\(\{googleSync,googleDriveBackup,deviceCloudSync\}\)/);
});

test('per-recipe Google indicators do not claim local save means Google save',()=>{
 assert.match(luxury,/opts\.googleDeliveryStatus\?\.\(r\)/);
 assert.match(luxury,/opts\.onOpenCloud\?\.\(r\)/);
 assert.match(html,/Google: ожидает отправки/);
 assert.match(html,/Google: ошибка отправки/);
 assert.match(html,/Google: сохранено/);
 assert.match(html,/del\?\.pdfUrl&&del\?\.url/);
 assert.match(html,/del\.projectId===\(recipe\.projectId\|\|''\)/);
});

test('mobile hub has responsive safe-area bounds and no duplicate quick buttons',()=>{
 assert.match(html,/\/data-center\.css\?v=2/);
 assert.match(html,/\/data-center\.js\?v=1/);
 assert.match(css,/width:min\(740px,calc\(100vw - 22px\)\)/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/max-height:min\(92dvh,970px\)/, 'Hub stays within viewport');
});
