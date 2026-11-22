import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APK = path.join(ROOT, 'releases', 'revision-pro.apk');
const META = path.join(ROOT, 'releases', 'release.json');
const PORT = Number(process.env.PORT || 10000);
const BASE = '/revision-app';
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff'
};

function release() {
  if (!existsSync(APK) || !existsSync(META)) return null;
  try {
    const meta = JSON.parse(readFileSync(META, 'utf8'));
    if (!Number.isSafeInteger(meta.versionCode) || meta.versionCode < 1 ||
        typeof meta.versionName !== 'string' || !/^\d+\.\d+\.\d+$/.test(meta.versionName) ||
        typeof meta.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(meta.sha256)) return null;
    const data = readFileSync(APK);
    const calculated = createHash('sha256').update(data).digest('hex');
    if (calculated !== meta.sha256.toLowerCase()) return null;
    if (data.length < 100000 || data.slice(0, 2).toString() !== 'PK') return null;
    return { ...meta, sha256:calculated, sizeBytes:data.length };
  } catch { return null; }
}

function json(res, obj, status=200) {
  res.writeHead(status, {...HEADERS, 'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(obj));
}
function page(res, html) {
  res.writeHead(200, {...HEADERS, 'Content-Type':'text/html; charset=utf-8'});
  res.end(html);
}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url || '/', 'http://localhost');
  const pathname=url.pathname;
  if(req.method==='OPTIONS') { res.writeHead(204,HEADERS); return res.end(); }
  if(!['GET','HEAD'].includes(req.method)) return json(res,{error:'method_not_allowed'},405);
  const rel=release();
  if(pathname==='/health') return json(res, { ok:true, service:'farukh-revision-updates', updateReady:!!rel });
  if(pathname===BASE+'/latest.json' || pathname==='/api/v1/latest') {
    if(!rel) return json(res,{
      available:false,
      versionCode:null,
      versionName:null,
      message:'Сервер работает. Подписанная APK пока не опубликована — обновление недоступно.'
    });
    const host=(process.env.PUBLIC_BASE_URL || 'https://farukh-revision-updates.onrender.com').replace(/\/$/,'');
    return json(res,{
      available:true, versionCode:rel.versionCode, versionName:rel.versionName,
      apkUrl:host+BASE+'/revision-pro.apk', sha256:rel.sha256,
      sizeBytes:rel.sizeBytes
    });
  }
  if(pathname===BASE+'/revision-pro.apk') {
    if(!rel) return json(res, {error:'release_not_published'},404);
    res.writeHead(200,{...HEADERS,'Content-Type':'application/vnd.android.package-archive',
      'Content-Length':statSync(APK).size,
      'Content-Disposition':'attachment; filename="FARUKH_REVISION_PRO.apk"',
      'Cache-Control':'public, max-age=300'});
    return req.method==='HEAD' ? res.end() : createReadStream(APK).pipe(res);
  }
  if(pathname==='/' || pathname==='/index.html') {
    return page(res,`<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FARUKH REVISION PRO — обновления</title><style>body{font:16px system-ui;background:#071322;color:#f5f5f5;margin:0;padding:26px}main{max-width:640px;margin:6vh auto;background:#112239;border:1px solid #d9b87555;border-radius:24px;padding:32px}h1{color:#f3d58b;font-size:27px}p{color:#b7c7d6;line-height:1.6}.pill{display:inline-block;padding:9px 14px;border:1px solid #c19b55;border-radius:99px;color:#e0c389}a{color:#f0c96b}</style><main><div class="pill">FARUKH • REVISION PRO</div><h1>Сервер обновлений</h1><p>${rel?'Подписанная версия '+rel.versionName+' доступна для проверки.':'Сервер работает. Подписанная APK ещё не опубликована. Обновления пока недоступны.'}</p><p><a href="/revision-app/latest.json">Проверить JSON версии</a> • <a href="/health">Проверка сервера</a></p><p>Существующие данные ревизий не затрагиваются.</p></main></html>`);
  }
  return json(res,{error:'not_found'},404);
});
server.listen(PORT,'0.0.0.0',()=>console.log('FARUKH REVISION UPDATES listening on',PORT));
