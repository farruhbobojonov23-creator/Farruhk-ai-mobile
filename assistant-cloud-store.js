import {AssistantStore,httpError} from './assistant-store.js';

// A single Render instance serializes updates; the cloud persists across restarts.
export class YandexAssistantStore extends AssistantStore{
  constructor(token,request=fetch){super('./unused-cloud-path');this.token=String(token||'').trim();this.request=request;this.storage='yandex';this.base='/FARRUKH_AI_STORAGE/FARRUKH_AI_V2/'}
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
    let link;try{link=await this.api('/resources/download?path='+encodeURIComponent(this.base+name))}catch(e){if(e.status===404)return structuredClone(fallback);throw e}
    const r=await this.fetchCloud(link.href);if(!r.ok)throw httpError(502,'Не удалось прочитать облачные данные');return r.json();
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
