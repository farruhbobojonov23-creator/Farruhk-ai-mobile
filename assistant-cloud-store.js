import {AssistantStore,httpError} from './assistant-store.js';
import https from 'node:https';

// Download hosts can time out over IPv6 from the hosting network.
// Keep TLS verification and follow only HTTPS redirects, without OAuth headers.
export function cloudDownload(url,{signal}={},redirects=0){
  return new Promise((resolve,reject)=>{
    const target=new URL(url);if(target.protocol!=='https:')return reject(httpError(502,'Небезопасная ссылка облака'));
    const req=https.get(target,{family:4,signal,timeout:30000},res=>{
      if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){
        res.resume();if(redirects>=5)return reject(httpError(502,'Слишком много перенаправлений облака'));
        resolve(cloudDownload(new URL(res.headers.location,target).href,{signal},redirects+1));return;
      }
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>20*1024*1024){res.destroy(httpError(502,'Файл облака слишком большой'));return}chunks.push(chunk)});
      res.on('error',reject);res.on('end',()=>{const body=Buffer.concat(chunks).toString('utf8');resolve({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,json:async()=>JSON.parse(body)})});
    });
    req.on('timeout',()=>req.destroy(Object.assign(new Error('Cloud download timeout'),{code:'ETIMEDOUT'})));req.on('error',reject);
  });
}

// A single Render instance serializes updates; the cloud persists across restarts.
export class YandexAssistantStore extends AssistantStore{
  constructor(token,request=fetch){super('./unused-cloud-path');this.token=String(token||'').trim();this.request=request;this.download=request===fetch?cloudDownload:request;this.storage='yandex';this.base='/FARRUKH_AI_STORAGE/FARRUKH_AI_V2/'}
  async fetchCloud(url,options={}){
    let last;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await this.request(url,{...options,signal:AbortSignal.timeout(10000)});
        if([429,500,502,503,504].includes(r.status)&&attempt===0){await r.body?.cancel();continue}
        return r;
      }catch(e){last=e;if(attempt===1)console.error('[cloud-read] host='+(String(url).startsWith('https://cloud-api.yandex.net/')?'api':'download')+' name='+e.name+' cause='+(e.cause?.code||e.code||'unknown')+' frames='+String(e.stack||'').split('\n').slice(1,5).join(' | '));if(!['TimeoutError','AbortError','TypeError'].includes(e.name)||attempt===1)throw e}
    }
    throw last;
  }
  async api(suffix,options={}){
    const r=await this.fetchCloud('https://cloud-api.yandex.net/v1/disk'+suffix,{...options,headers:{Authorization:'OAuth '+this.token,'Accept':'application/json',...options.headers}});
    if(r.status===204)return {};
    const data=await r.json();if(!r.ok)throw httpError(r.status,data.message||'Ошибка облачного хранилища');return data;
  }
  async folder(name){try{await this.api('/resources?path='+encodeURIComponent(name),{method:'PUT'})}catch(e){if(e.status!==409)throw e}}
  async read(name,fallback){
    let downloadError;
    for(let attempt=0;attempt<2;attempt++){
      let link;try{link=await this.api('/resources/download?path='+encodeURIComponent(this.base+name))}catch(e){if(e.status===404)return structuredClone(fallback);throw e}
      try{const r=await this.download(link.href,{signal:AbortSignal.timeout(30000)});if(!r.ok){console.error('[cloud-download] status='+r.status);throw httpError(502,'Не удалось прочитать облачные данные')}return await r.json()}
      catch(e){if(e instanceof SyntaxError)throw e;downloadError=e}
    }
    // Yandex can return HTTP 500 from the temporary downloader even when
    // the file itself is intact. Its resource metadata can expose a separate
    // direct `file` URL. Read-only fallback: NEVER interpret an unavailable
    // download as a missing or empty document.
    try {
      const metadata=await this.api('/resources?path='+encodeURIComponent(this.base+name)+'&fields='+encodeURIComponent('type,size,file,modified'));
      const alternate=metadata?.type==='file'&&typeof metadata.file==='string'&&metadata.file.startsWith('https://')?metadata.file:null;
      console.info('[cloud-metadata] type='+(metadata?.type==='file'?'file':'other')+' alternate='+Boolean(alternate));
      if(alternate){
        const r=await this.download(alternate,{signal:AbortSignal.timeout(30000)});
        if(r.ok){const json=await r.json();console.info('[cloud-recovery] alternate download succeeded');return json}
        console.error('[cloud-meta-download] status='+r.status);
      }
    }catch(e){
      // Metadata is an optional recovery path, not evidence the main file
      // disappeared. Never log signed URLs, OAuth credentials or file body.
      console.error('[cloud-metadata] unavailable status='+(e?.status||0)+' type='+(e instanceof SyntaxError?'invalid-json':'read-failed'));
      if(e instanceof SyntaxError)throw e;
    }
    // WebDAV may reject OAuth depending on plan and authorization method.
    // It remains an extra read-only attempt for compatible installations.
    // Failure must preserve the original signed-download error.
    const path=(this.base+name).split('/').map(encodeURIComponent).join('/');
    const r=await this.fetchCloud('https://webdav.yandex.ru'+path,{redirect:'error',headers:{Authorization:'OAuth '+this.token}});
    if(!r.ok){console.error('[cloud-webdav] status='+r.status);throw downloadError}return r.json();
  }
  async write(name,data){
    await this.folder('/FARRUKH_AI_STORAGE/');await this.folder(this.base);
    if(name.startsWith('backups/'))await this.folder(this.base+'backups/');
    const link=await this.api('/resources/upload?path='+encodeURIComponent(this.base+name)+'&overwrite=true');
    const r=await this.request(link.href,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw httpError(502,'Облако не подтвердило сохранение');
  }
  async backups(){
    let data;try{data=await this.api('/resources?path='+encodeURIComponent(this.base+'backups/')+'&limit=30&sort=-modified')}catch(e){if(e.status===404)return [];throw e}
    return (data._embedded?.items||[]).filter(x=>/^backup-[\w-]+\.json$/.test(x.name)).map(x=>({name:x.name,path:x.name,size:x.size,modified:x.modified}));
  }
}
