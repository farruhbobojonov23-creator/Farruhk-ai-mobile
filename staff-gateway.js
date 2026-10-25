import http from 'node:http';
import https from 'node:https';
const upstream = new URL(process.env.FARUKH_PRINT_UPSTREAM || 'https://farruhk-ai-mobile.onrender.com');
const port = Number(process.env.PORT || 10000);
const hopByHop = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade']);
http.createServer((req,res)=>{
 if(req.url==='/healthz'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end('{"ok":true,"service":"farukh-print-staff-gateway"}');}
 if(req.url==='/'||req.url==='/staff'||req.url==='/staff/'){res.writeHead(302,{location:'/farukh-print/staff/','cache-control':'no-store'});return res.end();}
 const target=new URL(req.url,upstream);
 const headers={...req.headers,host:upstream.host,'x-forwarded-host':req.headers.host||'','x-forwarded-proto':'https'};
 if(headers.origin)headers.origin=upstream.origin;
 for(const h of hopByHop)delete headers[h];
 const transport=target.protocol==='https:'?https:http;
 const proxyReq=transport.request(target,{method:req.method,headers},proxyRes=>{
  const rh={...proxyRes.headers};for(const h of hopByHop)delete rh[h];
  if(rh.location){try{const loc=new URL(rh.location,upstream);if(loc.host===upstream.host)rh.location=loc.pathname+loc.search+loc.hash;}catch{}}
  rh['x-frame-options']='DENY';res.writeHead(proxyRes.statusCode||502,rh);proxyRes.pipe(res);
 });
 proxyReq.on('error',err=>{if(!res.headersSent){res.writeHead(502,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end('FARUKH PRINT временно недоступен. Попробуй обновить страницу.');}else res.destroy(err);});
 req.pipe(proxyReq);
}).listen(port,'0.0.0.0',()=>console.log('FARUKH PRINT staff gateway listening on '+port));
