import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=load('index.html'),hub=load('data-center.js'),css=load('data-center.css');
const backup=load('google-backup.js'),google=load('recipe-google.js'),devices=load('device-cloud-sync.js');
const luxury=load('luxury-ui.js'),settings=load('site-settings.js');
const premium=load('data-center-premium.css');

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
 assert.match(html,/dataCenter\.bind\(\{googleSync,googleDriveBackup,deviceCloudSync,deletionManager\}\)/);
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
 assert.match(html,/\/data-center\.js\?v=2/);
 assert.match(css,/width:min\(740px,calc\(100vw - 22px\)\)/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/max-height:min\(92dvh,970px\)/, 'Hub stays within viewport');
});

test('My Data and its connection dialogs use one black/gold premium theme',()=>{
 assert.match(html,/\/data-center-premium\.css\?v=4/);
 assert.ok(html.indexOf('/data-center-premium.css?v=4')>html.indexOf('/ttk-four-layouts.css?v=1'),'premium overrides must load LAST');
 assert.match(html,/\/recipe-google\.js\?v=18/);
 assert.match(google,/dialog\.className='category-dialog data-center-subdialog'/);
 assert.match(google,/archiveDialog\.className='category-dialog data-center-subdialog'/);
 assert.match(premium,/dialog#data-center-dialog\.data-center-dialog/);
 assert.match(premium,/data-center-section :is\(details,\.panel,\.lx-sync-details\)/);
 assert.match(premium,/dialog\.google-backup-dialog/);
 assert.match(premium,/dialog\.category-dialog\.data-center-subdialog/);
 assert.match(premium,/color-scheme:dark!important/);
 assert.match(premium,/background-color:#16110e!important/);
 assert.match(premium,/background:#251e18!important/);
 assert.match(premium,/@media \(max-width:560px\)/);
});

test('TTK can be managed individually from saved versions or My Data without any global wipe',()=>{
 const manager=load('recipe-delete-manager.js');
 assert.match(hub,/data-delete-root/);
 assert.match(html,/mountRecipeDeletionManager\(\{/);
 assert.match(html,/mountRoot:dataCenter\.deletionRoot/);
 assert.match(google,/farruh:manage-recipe/);
 assert.match(manager,/scope:'phone',label:'📱 Телефон ✕'/);
 assert.match(manager,/scope:'cloud',label:'☁️ Облако ✕'/);
 assert.match(manager,/scope:'google',label:'📄 Google ✕'/);
 assert.doesNotMatch(manager,/data-confirm|Введите слово УДАЛИТЬ|window\.confirm\('Подтвердите удаление/);
 assert.match(manager,/store\.mutate/);
 assert.match(manager,/s\.googleSuppressed\?\./);
 assert.doesNotMatch(manager,/localStorage\.clear\(\)/);
 assert.doesNotMatch(manager,/\bdeleteAll\b/);
});

test('one tap X deletes a single TTK without a typing field, scope dialog or confirmation step',()=>{
 const manager=load('recipe-delete-manager.js');
 assert.match(manager,/button\.onclick=\(\)=>void removeOne\(recipe\.id,option\.scope\)/);
 assert.match(manager,/async function removeOne\(id,scope\)/);
 assert.match(manager,/async function undoPhoneDelete\(\)/);
 assert.match(manager,/↶ Отменить/);
 assert.match(manager,/localOnlyDeletedIds/);
 assert.match(google,/ready-version-delete-x/);
 assert.match(google,/farruh:delete-recipe-fast/);
 assert.match(html,/deletionManager\.removeOne\(id,'phone'\)/);
 assert.doesNotMatch(manager,/\.showModal\(\)/);
 assert.doesNotMatch(manager,/window\.confirm\(/);
});
