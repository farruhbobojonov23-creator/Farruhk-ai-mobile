import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [js,html,css,staff,api]=await Promise.all([
 read('public/farukh-print/print.js'),read('public/farukh-print/index.html'),
 read('public/farukh-print/print.css'),read('public/farukh-print/print-staff.js'),
 read('print-sync-api.js')]);

function fixture(){
 const injected=js.replace('boot();\n})();','window.__guest={canPrint,canManage,doPrint,runBatchPrint,choosePrinter};\n})();');
 assert.notEqual(injected,js);
 const values=new Map(),state={staff:false,connected:false,message:''};
 const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const window={
  FARUKH_PRINT_STAFF_API:{loggedIn:()=>state.staff},
  FARUKH_PRINT_DEVICE_SYNC:{state:()=>({connected:state.connected})}
 };
 const document={getElementById:id=>{
  assert.equal(id,'print-message');
  return {dataset:{},set textContent(v){state.message=v},get textContent(){return state.message}};
 }};
 new Function('window','document','localStorage',injected)(window,document,localStorage);
 return {access:window.__guest,localStorage,state};
}
test('Guests can never print (Bluetooth, system dialog, batch, or printer pairing)',async()=>{
 const {access,localStorage,state}=fixture();
 assert.equal(access.canPrint(),false);
 assert.equal(access.canManage(),false);
 assert.equal(await access.doPrint(true),false);
 assert.match(state.message,/Сначала подключи устройство/);
 assert.equal(await access.doPrint(false),false);
 access.choosePrinter();assert.match(state.message,/войди под логином/);
 await access.runBatchPrint();assert.match(state.message,/Пакетная печать/);
 localStorage.setItem('farukh-print:staff-managed:v1','1');
 assert.equal(access.canPrint(),false,'Pairing is not authentication');
 state.staff=true;assert.equal(access.canPrint(),false,'Cloud connectivity is required');
 state.connected=true;assert.equal(access.canPrint(),true,'Valid paired employee may print');
 state.staff=false;assert.equal(access.canPrint(),false,'Logout immediately revokes printing');
});
test('Product browsing and vector preview stay accessible without signing in',()=>{
 for(const id of ['choose-prep','choose-ready','product-list','preview-svg','print-access-note'])assert.ok(html.includes('id="'+id+'"'));
 assert.doesNotMatch(css,/worker-managed:not\(\.worker-logged-in\) #catalog\{display:none/);
 assert.doesNotMatch(css,/worker-managed:not\(\.worker-logged-in\) #home \.choice-grid/);
 assert.match(css,/body\.print-guest:not\(\.print-owner\) #manage/);
 assert.match(js,/Просмотр этикетки\. Для печати войди/);
});
test('Each print uses server authorization; local editing requires verified owner',()=>{
 assert.match(js,/function requirePrintAccess\(\)/);
 assert.match(js,/const authorized=await api\.authorize/);
 assert.match(js,/requirePrintAccess\(\);\s*if\(!native\|\|forceSystem\)/);
 assert.match(js,/requirePrintAccess\(\);\s*const legacy=/);
 assert.match(js,/if\(isManaged\(\)\)return;\s*if\(!canManage\(\)\)return;/);
 assert.match(js,/fetch\('\/api\/farukh-print\/admin\/session'/);
 assert.match(api,/app\.get\('\/api\/farukh-print\/admin\/session',protectOwner/);
 assert.match(staff,/panel\.hidden=false/);
 assert.match(staff,/form\.hidden=!paired\|\|!enrolled\|\|!!staff/);
});
