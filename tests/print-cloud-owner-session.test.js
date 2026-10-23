import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.className='';this.hidden=false;this.disabled=false;this.dataset={};this.value='';this.onclick=null;this.events={};}
  append(...children){this.children.push(...children)}
  insertBefore(node,reference){const i=this.children.indexOf(reference);i<0?this.append(node):this.children.splice(i,0,node)}
  querySelectorAll(tag){const recurse=node=>node.children.flatMap(x=>[x,...recurse(x)]);return recurse(this).filter(x=>x.tagName===tag)}
  addEventListener(type,fn){this.events[type]=fn}
  replaceChildren(...xs){this.children=[];this.append(...xs)}
}
const flatten=node=>[node,...node.children.flatMap(flatten)];
function createEnvironment(source,{loginOk=true}={}){
  const root=new Element('div');root.children=Array.from({length:6},()=>new Element('div'));
  const document={createElement:tag=>new Element(tag),body:{dataset:{view:'print-control'}}};
  const calls=[];let session=false;
  const fetch=async(url,options={})=>{
    calls.push(url);
    const data=url.endsWith('/sync/status')?{ok:true,enabled:true,permanent:true}
      :url.endsWith('/admin/catalog')?session?{ok:true,revision:0,products:[]}:{ok:false,error:'Сначала войди в FARUKH AI как владелец.'}
      :url.endsWith('/api/auth/login')?loginOk?(session=true,{ok:true}):{ok:false,error:'Неверный пароль'}
      :url.endsWith('/admin/devices')?{ok:true,devices:[]}
      :{ok:false,error:'Ошибка проверки'};
    return {ok:data.ok,status:data.ok?200:401,json:async()=>data};
  };
  const construct=new Function('document','window','fetch','localStorage','confirm',source.replace('export function mountPrintCloudControl','function mountPrintCloudControl')+';return mountPrintCloudControl;');
  construct(document,{addEventListener(){}},fetch,{getItem:()=> '[]'},()=>true)({root});
  const elements=flatten(root);
  return {calls,root,elements,form:elements.find(x=>x.className==='pcloud-owner-login'),password:elements.find(x=>x.className==='pcloud-owner-password'),status:elements.find(x=>x.className==='pcloud-status'),pair:elements.find(x=>x.textContent==='＋ Подключить телефон / планшет')};
}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
const source=await fs.readFile(new URL('../public/print-control-cloud.js',import.meta.url),'utf8');

test('Print Control shows separate owner login when FARUKH AI home used passwordless session',async()=>{
 const a=createEnvironment(source);
 await tick();
 assert.equal(a.form.hidden,false);
 assert.equal(a.pair.disabled,true);
 assert.match(a.status.textContent,/вход владельца/);
 a.password.value='correct-owner-password';
 await a.form.events.submit({preventDefault(){}});
 await tick();
 assert.equal(a.form.hidden,true);
 assert.equal(a.password.value,'');
 assert.equal(a.pair.disabled,false);
 assert.equal(a.calls.filter(x=>x==='/api/auth/login').length,1);
 assert.equal(a.calls.filter(x=>x==='/api/farukh-print/admin/catalog').length,2);
});

test('Print Control refuses wrong owner password, does not unlock device pairing',async()=>{
 const a=createEnvironment(source,{loginOk:false});
 await tick();
 a.password.value='wrong';
 await a.form.events.submit({preventDefault(){}});
 await tick();
 assert.equal(a.form.hidden,false);
 assert.equal(a.pair.disabled,true);
 assert.match(a.status.textContent,/Неверный пароль/);
 assert.equal(a.password.value,'');
});
