import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const get=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('Entry page carries a bounded premium loading fallback and updated assets',async()=>{
 const page=await get('public/index.html');
 assert.match(page,/document\.documentElement\.dataset\.pfBoot='premium'/);
 assert.match(page,/removeAttribute\('data-pf-boot'\)/);
 assert.match(page,/premium-workspace\.js\?v=10/);
 assert.match(page,/premium-showcase\.css\?v=2/);
 assert.match(page,/requestIdleCallback\(finishStartup,\{timeout:2500\}\)/);
});
test('Owner HTML is authorized server-side without duplicate client session roundtrip',async()=>{
 const server=await get('server.js');
 const login=await get('public/owner-login.js');
 assert.match(server,/ownerOnlyPaths\.has\(req\.path\)&&!ownerSessionValid\(req\)/);
 assert.match(server,/farruh-owner-validated/);
 assert.match(login,/farruh-owner-validated/);
 assert.match(login,/if\(document\.querySelector\(/);
 assert.match(server,/controller\.abort\(\),12000/);
 assert.match(login,/AbortSignal\.timeout\(9000\)/);
});
test('External deep-link navigation reuses owner login cookie without changing API authorization',async()=>{
 const server=await get('assistant-api.js');
 assert.match(server,/SameSite=Lax/);
 assert.match(server,/HttpOnly; SameSite=Lax; Path=\/; Max-Age=604800/);
 assert.match(server,/trustedOrigin\(req\)/);
 assert.doesNotMatch(server,/SameSite=Strict/);
});
test('Premium dashboard avoids double action and costly unused weather polling',async()=>{
 const showcase=await get('public/premium-showcase.js');
 const home=await get('public/ruby-studio.js');
 assert.match(showcase,/event\.stopPropagation\(\)/);
 assert.match(home,/premiumThemes=new Set\(\['titanium','crystal','royal'\]\)/);
 assert.match(home,/ensureLegacyWeather/);
 assert.match(home,/if\(premiumThemes\.has\(theme\)\)return/);
});
test('Existing device database avoids extra cloning but backup validation remains defensive',async()=>{
 const js=await get('public/device-store.js');
 assert.match(js,/export function validateDeviceState\(value,\{clone=true\}=\{\}\)/);
 assert.match(js,/clone\?structuredClone\(state\):state/);
 assert.match(js,/validateDeviceState\(request\.result,\{clone:false\}\)/);
 assert.match(js,/records\.put\(next,'state'\)/);
});
test('3D CSS disables heavyweight mobile blurs and keeps PDF print untouched',async()=>{
 const css=await get('public/premium-showcase.css');
 for(const theme of ['titanium','crystal','royal'])assert.match(css,new RegExp('data-pf-theme="'+theme+'"'));
 assert.match(css,/backdrop-filter:none!important/);
 assert.match(css,/content-visibility:auto/);
 assert.match(css,/@media print/);
 assert.match(css,/\.pf-showcase\{display:none!important\}/);
});
