import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function httpError(status,message){return Object.assign(new Error(message),{status})}
export function cleanState(input={}){
  const text=(v,n)=>String(v??'').slice(0,n);
  const list=(v)=>Array.isArray(v)?v:[];
  return {
    tasks:list(input.tasks).slice(-300).map(t=>({id:text(t.id||crypto.randomUUID(),80),text:text(t.text,500),done:!!t.done,priority:t.priority==='high'?'high':'normal',due:t.due&&Number.isFinite(Date.parse(t.due))?new Date(t.due).toISOString():null,createdAt:text(t.createdAt,64)||new Date().toISOString(),notifiedAt:t.notifiedAt?text(t.notifiedAt,64):null})).filter(t=>t.text),
    memory:list(input.memory).slice(-200).map(m=>({id:text(m.id||crypto.randomUUID(),80),text:text(m.text,1000),createdAt:text(m.createdAt,64)})).filter(m=>m.text),
    chat:list(input.chat).slice(-80).map(m=>({role:m.role==='user'?'user':'ai',text:text(m.text,6000)})).filter(m=>m.text),
    tts:input.tts!==false,
    timeZone:validTimeZone(input.timeZone)?input.timeZone:'Europe/Moscow'
  };
}
export function validTimeZone(value){try{new Intl.DateTimeFormat('ru',{timeZone:value});return typeof value==='string'&&value.length<80}catch{return false}}
export class AssistantStore{
  constructor(directory){this.storage='disk';this.directory=path.resolve(directory);this.queue=Promise.resolve()}
  async read(name,fallback){try{return JSON.parse(await fs.readFile(path.join(this.directory,name),'utf8'))}catch(e){if(e.code==='ENOENT')return structuredClone(fallback);throw e}}
  async write(name,data){
    const target=path.join(this.directory,name),temp=target+'.'+crypto.randomUUID()+'.tmp';
    await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});
    const handle=await fs.open(temp,'wx',0o600);
    try{await handle.writeFile(JSON.stringify(data));await handle.sync()}finally{await handle.close()}
    await fs.rename(temp,target);
  }
  transaction(fn){const job=this.queue.then(fn);this.queue=job.catch(()=>{});return job}
  async state(){return this.read('state.json',{...cleanState(),revision:0,updatedAt:null,storage:this.storage})}
  save(input){return this.transaction(async()=>{
    const current=await this.state();
    if(input.revision!==current.revision)throw Object.assign(httpError(409,'Данные изменились на другом устройстве. Сверьте версии перед сохранением.'),{state:current});
    const next={...cleanState(input),revision:current.revision+1,updatedAt:new Date().toISOString(),storage:this.storage};
    await this.write('state.json',next);return next;
  })}
  mutate(fn){return this.transaction(async()=>{const current=await this.state();await fn(current);const next={...current,revision:current.revision+1,updatedAt:new Date().toISOString(),storage:this.storage};await this.write('state.json',next);return next})}
  async backup(reason='manual'){
    return this.transaction(async()=>{
      const state=await this.state(),name='backup-'+Date.now()+'-'+crypto.randomUUID()+'.json';
      await this.write('backups/'+name,{version:2,reason,createdAt:new Date().toISOString(),state});
      return {name,path:name,storage:this.storage,createdAt:new Date().toISOString()};
    });
  }
  async backups(){
    const dir=path.join(this.directory,'backups');await fs.mkdir(dir,{recursive:true,mode:0o700});
    const names=(await fs.readdir(dir)).filter(n=>/^backup-[\w-]+\.json$/.test(n)).sort().reverse().slice(0,30);
    return Promise.all(names.map(async name=>{const stat=await fs.stat(path.join(dir,name));return {name,path:name,size:stat.size,modified:stat.mtime.toISOString()}}));
  }
  async restore(name,revision){
    if(!/^backup-[\w-]+\.json$/.test(name))throw httpError(400,'Некорректное имя копии');
    const data=await this.read('backups/'+name,null);if(!data?.state)throw httpError(404,'Копия не найдена');
    await this.backup('before-restore');return this.save({...data.state,revision});
  }
}

export function ownerAuth({password,secret,now=()=>Date.now()}){
  const enabled=!!password&&!!secret;
  const signature=value=>crypto.createHmac('sha256',secret||'disabled').update(value).digest('hex');
  const equal=(a,b)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};
  return {
    enabled,
    login(value){if(!enabled)throw httpError(503,'Вход не настроен: задайте ASSISTANT_PASSWORD и ASSISTANT_SESSION_SECRET на сервере.');if(!equal(crypto.createHash('sha256').update(String(value)).digest('hex'),crypto.createHash('sha256').update(password).digest('hex')))throw httpError(401,'Неверный пароль');const body=String(now()+7*86400000);return body+'.'+signature(body)},
    verify(value){if(!enabled||typeof value!=='string')return false;const [expiry,sig,...extra]=value.split('.');return !extra.length&&Number(expiry)>now()&&Number(expiry)<=now()+7*86400000+1000&&equal(sig||'',signature(expiry))}
  };
}
