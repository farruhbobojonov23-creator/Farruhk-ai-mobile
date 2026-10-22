import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Home/voice updates do not rebuild hidden HACCP, TTK, tasks, and calculator',()=>{
 const html=get('public/index.html');
 assert.match(html,/if\(view==='home'\|\|view==='chat'\)return/);
 assert.match(html,/if\(view==='lab'\)\{haccpUi\.render\(state\);return\}/);
 assert.match(html,/if\(view==='preparations'\)\{preparationBoard\.render\(\);return\}/);
 assert.match(html,/if\(view==='tasks'\)\{taskBoard\.render\(\);return\}/);
 assert.match(html,/if\(view==='recipes'\)googleSync\?\.render\(\)/);
 assert.match(html,/if\(view==='calc'\)\{/);
 assert.match(html,/if\(state&&!\['home','chat'\]\.includes\(view\)\)queueMicrotask/);
});
test('Chat starts with 60 messages and older turns remain available on demand',()=>{
 const html=get('public/index.html');
 assert.match(html,/function showSavedChatHistory\(turns\)/);
 assert.match(html,/container\.replaceChildren\(fragment\)/);
 assert.match(html,/const container=\$\('messages'\),step=60/);
 assert.match(html,/older\.onclick=/);
 assert.doesNotMatch(html,/state\.chat\.forEach\(m=>bubble/);
 assert.match(html,/showSavedChatHistory\(state\.chat\|\|\[\]\)/);
});
test('Local indexedDB save keeps complete validated state and revision while avoiding extra clone',()=>{
 const js=get('public/device-store.js');
 assert.match(js,/const previousRevision=Number\(current\.revision\)\|\|0/);
 assert.match(js,/next=current;change\(next\);next=validateDeviceState\(next\)/);
 assert.match(js,/records\.put\(next,'state'\)/);
 assert.match(js,/tx\.oncomplete=\(\)=>resolve\(next\)/);
 assert.doesNotMatch(js,/next=structuredClone\(current\)/);
});
test('New Android PWA avoids 50 simultaneous precache requests while caching versioned static assets',()=>{
 const sw=get('public/sw.js');
 assert.match(sw,/farrukh-arctic-sapphire-v53/);
 assert.match(sw,/const CORE=\['\/','\/index\.html'/);
 assert.doesNotMatch(sw,/Promise\.allSettled\(SHELL\.map/);
 assert.match(sw,/const versioned=url\.searchParams\.has\('v'\)/);
 assert.match(sw,/caches\.match\(request\)\.then\(found=>found\|\|fetch\(request\)/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});
test('Fast text and voice requests use bounded conversation history and task context',()=>{
 const html=get('public/index.html');
 assert.match(html,/state\.chat\.slice\(voice\?-6:-10\)/);
 assert.match(html,/String\(m\.text\|\|''\)\.slice\(0,1600\)/);
 assert.match(html,/state\.tasks\.filter\(t=>!t\.done\)\.slice\(0,30\)/);
 assert.match(html,/device-store\.js\?v=68/);
 assert.match(html,/recipe-google\.js\?v=2/);
});
