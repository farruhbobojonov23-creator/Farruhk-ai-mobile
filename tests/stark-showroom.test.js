
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const pageUrl=new URL('../public/index.html',import.meta.url);
const sceneUrl=new URL('../public/stark-showroom.js',import.meta.url);
const cssUrl=new URL('../public/stark-showroom.css',import.meta.url);
async function sources(){return Promise.all([readFile(pageUrl,'utf8'),readFile(sceneUrl,'utf8'),readFile(cssUrl,'utf8')])}

test('Arctic Sapphire is mounted on live homepage; old Stark files remain available but inactive',async()=>{
 const [html,legacyJs]=await sources();
 const [svg,arcticCss]=await Promise.all([
   readFile(new URL('../public/arctic-glass-orb.svg',import.meta.url),'utf8'),
   readFile(new URL('../public/arctic-approved-orb.css',import.meta.url),'utf8')
 ]);
 assert.doesNotThrow(()=>new Function(legacyJs.replace('export function mountStarkShowroom','function mountStarkShowroom')));
 assert.match(html,/class="view ruby-home arctic-home"/);
 assert.match(html,/src="\/arctic-glass-orb\.svg"/);
 assert.match(html,/arctic-approved-orb\.css\?v=/);
 assert.match(html,/import \{mountRubyHome\} from '\/ruby-studio\.js\?v=/);
 assert.doesNotMatch(html,/mountStarkShowroom\(/,'Old showroom must not replace the current home');
 assert.match(svg,/<svg [^>]*viewBox="0 0 900 850"/);
 assert.match(svg,/id="sphereMotion"/);
 assert.match(arcticCss,/\.arctic-reference-orb/);
 assert.match(html,/<h1>Будущее\.<br><em>В ваших руках\.<\/em><\/h1>/);
 assert.match(html,/id="taskpriority"/,'Task form must contain its priority control');
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
                          'prefers-reduced-motion','drawGlobe','photoUrl',
                          'pause.addEventListener','onOpenRecipes'])assert.ok(js.includes(expected),expected);
 for(const id of ['rolls','baked','sets','snacks','onigiri','soups','salads','semi'])
  assert.ok(js.includes("id:'"+id+"'"),id);
});
