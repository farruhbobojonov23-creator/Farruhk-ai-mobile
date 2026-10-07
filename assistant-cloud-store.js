import {AssistantStore,httpError} from './assistant-store.js';

// A single Render instance serializes updates; the cloud persists across restarts.
export class YandexAssistantStore extends AssistantStore{
  constructor(token,request=fetch){super('./unused-cloud-path');this.token=token;this.request=request;this.storage='yandex';this.base='/FARRUKH_AI_STORAGE/FARRUKH_AI_V2/'}
  async api(suffix,options={}){
    const r=await this.request('https://cloud-api.yandex.net/v1/disk'+suffix,{...options,headers:{Authorization:'OAuth '+this.token,...options.headers},signal:AbortSignal.timeout(12000)});
    if(r.status===204)return {};
    const data=await r.json();if(!r.ok)throw httpError(r.status,data.message||'Ошибка облачного хранилища');return data;
  }
  async folder(name){try{await this.api('/resources?path='+encodeURIComponent(name),{method:'PUT'})}catch(e){if(e.status!==409)throw e}}
  async read(name,fallback){
    let link;try{link=await this.api('/resources/download?path='+encodeURIComponent(this.base+name))}catch(e){if(e.status===404)return structuredClone(fallback);throw e}
    const r=await this.request(link.href,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw httpError(502,'Не удалось прочитать облачные данные');return r.json();
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
