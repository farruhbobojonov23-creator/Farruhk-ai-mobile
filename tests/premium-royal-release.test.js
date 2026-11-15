import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Royal Premium V2 is opt-in once for existing devices and default on new devices',async()=>{
 const ws=await read('public/premium-workspace.js');
 assert.match(ws,/const defaults=\{theme:'royal'/);
 assert.match(ws,/const ROYAL_V2_APPROVAL='farruh-ai-approved-royal-premium-20261114'/);
 assert.match(ws,/setJson\(ROYAL_V2_APPROVAL,true\)/);
 assert.match(ws,/mountPremiumRoyalV2\(\{shell,goto,openStudio,openProjects\}\)/);
 assert.match(ws,/const BLACK_ICE_APPROVAL=/); // legacy design kept selectable
});
test('Premium styles and screen elements remain separate from printing and data',async()=>{
 const html=await read('public/index.html');
 const js=await read('public/premium-royal-v2.js');
 const server=await read('server.js');
 const css=await read('public/premium-v2.css');
 assert.match(html,/fai-premium-system\.css\?v=3/);
 assert.match(html,/premium-workspace\.js\?v=22/);
 assert.match(js,/export function mountPremiumRoyalV2/);
 assert.match(js,/from '\/device-store\.js/);
 assert.match(js,/FARUKH PRINT/);
 assert.match(server,/FARRUH AI <span>Premium<\/span>/);
 assert.match(css,/@media screen/);
});