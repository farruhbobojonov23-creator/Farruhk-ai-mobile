import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('8 pieces is a real selectable default, but must not cover net yield grams',async()=>{
 const [layout,inline,css,html]=await Promise.all([
  source('public/ttk-reference-layouts.js'),
  source('public/ttk-inline-a4-editor.js'),
  source('public/ttk-direct-inline.css'),
  source('public/index.html')
 ]);
 assert.match(html,/<option value="8" selected>8 шт\.<\/option>/);
 assert.doesNotMatch(layout,/yieldField\?\.append\(yieldPieces\)/);
 assert.match(layout,/yieldBand\?\.append\(piecesLabel\)/);
 assert.match(layout,/node\('span','','Количество:'\)/);
 assert.match(layout,/yieldPieces\.replaceChildren/);
 assert.match(inline,/yieldBand\.querySelector\('\.ttk-live-yield-value'\)\.textContent/);
 assert.doesNotMatch(inline,/yieldBand\.lastChild\.textContent/);
 assert.match(css,/\.ttk-live-yield \.ttk-ref-pieces-select\{[\s\S]*?position:static!important/);
});

test('global settings are optional and apply only to newly created TTKs',async()=>{
 const [s,onepage,html]=await Promise.all([
  source('public/ttk-general-settings.js'),
  source('public/ttk-one-page-a4.js'),
  source('public/index.html')
 ]);
 assert.match(s,/farruh_ai_ttk_defaults_v1/);
 assert.match(s,/['"]1['"],['"]4['"],['"]6['"],['"]8['"],['"]10['"],['"]12['"],['"]16['"]/);
 assert.match(s,/['"]emerald-master-a4['"]/);
 assert.match(s,/['"]teal-matrix['"]/);
 assert.match(s,/['"]gold-allergen['"]/);
 assert.match(s,/['"]premium-blue['"]/);
 assert.match(s,/nutritionAuto/);
 assert.match(s,/showPencils/);
 assert.match(s,/chef:/);
 assert.match(s,/approver:/);
 assert.match(s,/localStorage\.setItem/);
 assert.match(s,/Новая техкарта/);
 assert.match(s,/#newrecipe,#home-new-recipe,#quickrecipe/);
 assert.match(onepage,/mountTtkGeneralSettings\(editor,stage,quickNav\)/);
 assert.match(html,/ttk-direct-inline\.css\?v=3/);
 assert.match(html,/ttk-studio\.js\?v=14/);
});

test('settings and quantity are visually separated with accessible labels',async()=>{
 const [js,css]=await Promise.all([
  source('public/ttk-general-settings.js'),source('public/ttk-direct-inline.css')
 ]);
 assert.match(js,/Общие настройки ТТК/);
 assert.match(js,/Количество штук по умолчанию/);
 assert.match(js,/Шаблон для новой ТТК/);
 assert.match(js,/Настройки по умолчанию для новых техкарт на этом устройстве/);
 assert.match(css,/\.ttk-general-panel\{/);
 assert.match(css,/\.ttk-general-settings>summary\{/);
 assert.match(css,/\.ttk-ref-piece-field\{/);
});
