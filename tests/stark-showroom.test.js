
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const pageUrl=new URL('../public/index.html',import.meta.url);
const sceneUrl=new URL('../public/stark-showroom.js',import.meta.url);
const cssUrl=new URL('../public/stark-showroom.css',import.meta.url);
async function sources(){return Promise.all([readFile(pageUrl,'utf8'),readFile(sceneUrl,'utf8'),readFile(cssUrl,'utf8')])}

test('Premium Stark V4 module parses and is mounted on the real public home',async()=>{
 const [html,js,css]=await sources();
 assert.doesNotThrow(()=>new Function(js.replace('export function mountStarkShowroom','function mountStarkShowroom')));
 assert.match(html,/import \{mountStarkShowroom\} from '\/stark-showroom\.js\?v=1';/);
 assert.match(html,/starkShowroom=mountStarkShowroom\(\{host:\$\('home'\)/);
 assert.match(html,/starkShowroom\?\.updateRecipes\(state\?\.recipes\|\|\[\]\)/);
 assert.match(css,/body\[data-view="home"\]\.stark-ready #home > :not\(\.stark-showroom\)/);
 assert.match(css,/stark-booting #home > :not\(\.stark-showroom\)/);
 assert.match(js,/classList\.add\('stark-ready'\)/);
});

test('Existing Google synchronization, TTK and HACCP code paths remain linked',async()=>{
 const [html]=await sources();
 assert.match(html,/import \{mountGoogleSync\} from '\/recipe-google\.js'/);
 assert.match(html,/import \{deleteRecipe,upsertRecipe\} from '\/recipe-actions\.js/);
 assert.match(html,/import \{mountHaccp\} from '\/haccp-ui\.js/);
 assert.match(html,/id="recipes"/);
 assert.match(html,/id="chef-menu"/);
});

test('Scene supports touch, keyboard, accessible category activation and stop',async()=>{
 const [,js]=await sources();
 for(const expected of ['pointerdown','pointermove','pointercancel','keydown','aria-pressed',
                          'prefers-reduced-motion','requestAnimationFrame','photoUrl',
                          'pause.addEventListener','onOpenRecipes'])assert.ok(js.includes(expected),expected);
 for(const id of ['rolls','baked','sets','snacks','onigiri','soups','salads','semi'])
  assert.ok(js.includes("id:'"+id+"'"),id);
});
