import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {installRecipeExportApi} from '../recipe-export-api.js';

const endpoint='https://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRST/exec';
const docUrl='https://docs.google.com/document/d/1uQdJ3l_sfR2nl317O1C85-T_x6s2BwYE8gj1Hhx-cm8/edit';
const folderUrl='https://drive.google.com/drive/folders/1Hv4IxMj6bCUrZwgu_x2OrV8fH_oLQZvD';
async function withGateway(reply,run){
 const app=express();
 app.use(express.json());
 installRecipeExportApi(app,{request:async (_url,{body})=>({ok:true,json:async()=>reply(JSON.parse(body))})});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const api='http://127.0.0.1:'+server.address().port+'/api/recipes/google-sync';
 const send=async(action,fields={})=>{
  const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint,key:'K'.repeat(48),action,...fields})});
  return {status:response.status,data:await response.json()};
 };
 try{await run(send)}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}

test('a backup Apps Script cannot silently pass as connected TTK Google Docs',async()=>{
 await withGateway(()=>({ok:true,folderName:'FARRUH AI — резервные копии'}),async send=>{
  const response=await send('check');
  assert.equal(response.status,502);
  assert.match(response.data.error,/резервных копий.*вместо скрипта Google ТТК/);
 });
});

test('a correct Google TTK check is accepted but project links are required',async()=>{
 await withGateway(packet=>packet.action==='check'?{ok:true,documentUrl:docUrl}:{ok:true,documentUrl:docUrl},async send=>{
  assert.equal((await send('check')).status,200);
  const project=await send('ensureProject',{projectId:'more-sushi',projectName:'Море Суши'});
  assert.equal(project.status,502);
  assert.match(project.data.error,/не подтвердил папку и документ/);
 });
});

test('TTK project is confirmed only if both Google Docs and Drive folder URLs exist',async()=>{
 await withGateway(()=>({ok:true,documentUrl:docUrl,folderUrl}),async send=>{
  const project=await send('ensureProject',{projectId:'more-sushi',projectName:'Море Суши'});
  assert.equal(project.status,200);
  assert.equal(project.data.documentUrl,docUrl);
  assert.equal(project.data.folderUrl,folderUrl);
 });
});

test('unknown operation from backups is explained instead of being reported as success',async()=>{
 await withGateway(()=>({ok:false,error:'Неизвестная операция.'}),async send=>{
  const project=await send('ensureProject',{projectId:'more-sushi',projectName:'Море Суши'});
  assert.equal(project.status,502);
  assert.match(project.data.error,/резервных копий вместо Google ТТК/);
 });
});

test('check distinguishes a working Google Doc from a published PDF-capable receiver',async()=>{
 await withGateway(()=>({ok:true,documentUrl:docUrl}),async send=>{
  const old=await send('check');
  assert.equal(old.status,200);
  assert.equal(old.data.pdfA4Supported,false);
  assert.equal(old.data.documentUrl,docUrl);
 });
 await withGateway(()=>({ok:true,documentUrl:docUrl,pdfA4Supported:true,receiverVersion:'a4-pdf-1'}),async send=>{
  const current=await send('check');
  assert.equal(current.status,200);
  assert.equal(current.data.pdfA4Supported,true);
  assert.equal(current.data.receiverVersion,'a4-pdf-1');
 });
});
