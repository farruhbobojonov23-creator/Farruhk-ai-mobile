import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.mkdir(path.join(root,'artifacts/smart-a4'),{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1024,height:1448}});
await page.goto('file://'+path.join(root,'public/ttk-smart-a4.html'));
const data=n=>({
 name:'Контрольная техкарта',category:'Холодные роллы',cardNumber:'001',yield:n+' г',portionWeight:n,
 ingredients:Array.from({length:n},(_,i)=>({name:'Ингредиент '+i,gross:'1',net:'1'})),
 scope:'Применение по утверждённой рецептуре.',rawRequirements:'Входной контроль сырья.',
 technologyStages:Array.from({length:5},(_,i)=>({title:'Этап '+i,description:'Приготовление по утверждённой технологии.'})),
 serving:'Подача по утверждённой карте.',storage:'Условия хранения по утверждённой карте.',
 quality:'Внешний вид, вкус и запах по спецификации.',safety:'Производственный контроль.',
 nutrition:{protein:{per100:'10',perPortion:'10'},fat:{per100:'10',perPortion:'10'},carbs:{per100:'20',perPortion:'20'},kcal:{per100:'200',perPortion:'200'}},
 allergens:['fish']
});
let first=null;
for(const n of [1,15]){
 const result=await page.evaluate(x=>window.applyTtkData(x),data(n));
 assert.equal(result.ready,true,JSON.stringify(result.violations));
 assert.equal(result.ingredientCount,n);assert.equal(result.rows,15);
 const coords=await page.evaluate(()=>[...document.querySelectorAll('.gridpair')].map(e=>[e.offsetTop,e.offsetHeight]));
 if(first)assert.deepEqual(coords,first);else first=coords;
 await page.screenshot({path:path.join(root,'artifacts/smart-a4',n+'-ingredients.png')});
 const pdf=await page.pdf({path:path.join(root,'artifacts/smart-a4',n+'-ingredients.pdf'),preferCSSPageSize:true,printBackground:true});
 assert.equal((await parsePdf(pdf)).numpages,1);
}
assert.equal((await page.evaluate(x=>window.applyTtkData(x),data(16))).ready,false,'16th ingredient must not be silently dropped');
let huge=data(5);huge.scope='Описание '.repeat(900);
assert.equal((await page.evaluate(x=>window.applyTtkData(x),huge)).ready,false,'overflow must be explicit');
await browser.close();
console.log('SMART A4: fixed geometry, printable 1/15 rows and explicit overflow passed.');
