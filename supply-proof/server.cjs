'use strict';
// ISOLATED TEST PROJECT. Does NOT modify APK, live web assets or Render.
// Sensitive image files live briefly in OS temp and are deleted in finally.
const http=require('node:http');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'public');
const maxBytes=8*1024*1024;
const port=Number(process.env.PORT||8765);
const bind=process.env.BIND||'127.0.0.1';
let active=false;
function reply(res,status,content,type='application/json; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(Buffer.isBuffer(content)?content:(typeof content==='string'?content:JSON.stringify(content)));
}
function tsvToLayout(raw){
 const rows=String(raw).split(/\r?\n/u),header=rows.shift(),cols=header.split('\t'),ix=Object.fromEntries(cols.map((x,i)=>[x,i]));
 if(ix.text==null||ix.level==null)throw Error('Invalid OCR TSV');
 let tokens=[],groups=new Map();
 for(const line of rows){
  const c=line.split('\t');if(c.length<cols.length||c[ix.level]!=='5')continue;
  const word=c.slice(ix.text).join('\t').trim();if(!word)continue;
  const left=Number(c[ix.left]),top=Number(c[ix.top]),w=Number(c[ix.width]),h=Number(c[ix.height]);
  const confidence=Math.max(0,Math.min(1,Number(c[ix.conf])/100));
  if([left,top,w,h,confidence].some(x=>!Number.isFinite(x))||w<1||h<1)continue;
  tokens.push({text:word,left,top,right:left+w,bottom:top+h,confidence});
  const key=[c[ix.page_num],c[ix.block_num],c[ix.par_num],c[ix.line_num]].join('.');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({word,left});
  if(tokens.length>12000)throw Error('OCR token limit');
 }
 return {text:[...groups.values()].map(row=>row.sort((a,b)=>a.left-b.left).map(x=>x.word).join(' ')).join('\n'),
  boxes:tokens,source:'tesseract-local-geometry',savedOnServer:false};
}
function validMagic(type,b){
 if(type==='image/jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
 if(type==='image/png')return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(type==='image/webp')return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
 return false;
}
function ocr(file){
 return new Promise((resolve,reject)=>{
  const cmd=spawn('tesseract',[file,'stdout','-l','rus+eng','--psm','11','tsv'],{stdio:['ignore','pipe','pipe']});
  let out='',err='',timed=false;
  const timeout=setTimeout(()=>{timed=true;cmd.kill('SIGKILL')},55000);
  cmd.stdout.setEncoding('utf8');cmd.stdout.on('data',c=>{out+=c;if(out.length>1800000)cmd.kill('SIGKILL')});
  cmd.stderr.setEncoding('utf8');cmd.stderr.on('data',c=>{err+=c.slice(0,1000)});
  cmd.on('error',e=>{clearTimeout(timeout);reject(e)});
  cmd.on('close',code=>{clearTimeout(timeout);if(code!==0||timed)reject(new Error(timed?'OCR timeout':err.slice(0,140)));
    else try{resolve(tsvToLayout(out))}catch(e){reject(e)}})
 })
}

const types={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/recognizer.js':'recognizer.js','/vendor-layouts-v2.js':'vendor-layouts-v2.js','/styles.css':'styles.css','/spatial-layout.js':'spatial-layout.js','/marr-block-layout.js':'marr-block-layout.js'};
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==='GET'&&req.url==='/health')return reply(res,200,{status:'ok',scope:'isolated',offline:true,publication:false});
  if(req.method==='GET'&&types[req.url]){
   const name=types[req.url],bytes=await fsp.readFile(path.join(root,name));
   return reply(res,200,bytes,mimes[path.extname(name)]||'application/octet-stream');
  }
  if(req.method==='POST'&&req.url==='/ocr'){
   if(active)return reply(res,429,{error:'Другой документ уже распознаётся; дождитесь завершения.'});
   const mime=String(req.headers['content-type']||'').split(';')[0];
   if(!['image/jpeg','image/png','image/webp'].includes(mime))return reply(res,415,{error:'Поддерживаются JPEG, PNG, WebP.'});
   const len=Number(req.headers['content-length']||0);
   if(len>maxBytes)return reply(res,413,{error:'Файл больше 8 МБ.'});
   active=true;let folder;
   try{
    const chunks=[];let length=0;
    for await(const chunk of req){length+=chunk.length;if(length>maxBytes)throw new Error('Файл больше 8 МБ');chunks.push(chunk)}
    if(length<50)throw new Error('Файл пустой');
    folder=await fsp.mkdtemp(path.join(os.tmpdir(),'farukh-supply-private-'));
    const suffix=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
    const file=path.join(folder,'scan.'+suffix);
    await fsp.writeFile(file,Buffer.concat(chunks),{mode:0o600});
    const bytes=await fsp.readFile(file);if(!validMagic(mime,bytes))return reply(res,415,{error:'Invalid image format'});
    const data=await ocr(file);
    return reply(res,200,data);
   }catch(e){return reply(res,422,{error:String(e.message||e)});}finally{active=false;if(folder)await fsp.rm(folder,{recursive:true,force:true}).catch(()=>{});}
  }
  reply(res,404,{error:'Not found'});
 }catch(e){reply(res,500,{error:'Ошибка тестового сервера: '+e.message});}
});
if(require.main===module)server.listen(port,bind,()=>console.log(`ISOLATED local preview: http://${bind}:${port} (not production)`));
module.exports=server;module.exports.tsvToLayout=tsvToLayout;module.exports.validMagic=validMagic;