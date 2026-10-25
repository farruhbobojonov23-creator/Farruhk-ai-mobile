// FARUKH PRINT legacy static portal -> canonical protected cloud catalog.
// Keep each device's original localStorage untouched. Local records MUST NOT be
// silently overwritten, posted to the cloud, or discarded during migration.
(()=>{
  'use strict';
  const CLOUD='https://farruhk-ai-mobile.onrender.com/farukh-print/staff/';
  const KEY='farukh_print_v1_labels';
  let original=null,items=[],broken=false;
  try{
    original=localStorage.getItem(KEY);
    if(original!==null){
      const parsed=JSON.parse(original);
      if(!Array.isArray(parsed))broken=true;
      else items=parsed.filter(x=>x&&typeof x.name==='string'&&['ready','semi'].includes(x.type));
    }
  }catch{broken=true}
  // Fresh visitors have no local catalogue to migrate.
  if(!broken&&items.length===0&&(!original||original==='[]')){
    location.replace(CLOUD);
    return;
  }
  const mount=()=>{
    const wrap=document.createElement('div');
    wrap.id='farukh-cloud-migration';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.setAttribute('aria-label','Единая база FARUKH PRINT');
    wrap.style.cssText='position:fixed;inset:0;z-index:999999;overflow:auto;background:#eef2f7;display:flex;align-items:center;justify-content:center;padding:22px;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#142034';
    const box=document.createElement('div');
    box.style.cssText='box-sizing:border-box;max-width:510px;width:100%;padding:28px;border-radius:24px;background:#fff;box-shadow:0 20px 85px #12234426;text-align:left';
    const heading=document.createElement('h1');
    heading.textContent='Единая база FARUKH PRINT';
    heading.style.cssText='font-size:25px;line-height:1.2;margin:0 0 15px';
    const intro=document.createElement('p');
    intro.textContent='Мы переходим на общую облачную базу. Все подключённые телефоны и планшеты будут получать одни и те же названия, фотографии и сроки годности.';
    intro.style.cssText='font-size:15px;line-height:1.55;margin:0 0 14px';
    const notice=document.createElement('p');
    notice.textContent=broken?'На этом устройстве обнаружены данные старой базы, которые не удалось прочитать. Сначала сохрани исходную копию.':'На этом устройстве сохранено '+items.length+' позиций старой локальной базы. Они НЕ переносятся автоматически. Сначала сохрани резервную копию, чтобы не потерять отличающиеся позиции и фотографии.';
    notice.style.cssText='background:#fff5e7;border:1px solid #f7dfbc;padding:13px 15px;border-radius:13px;font-size:14px;line-height:1.5';
    const status=document.createElement('p');
    status.setAttribute('role','status');
    status.style.cssText='font-size:13px;min-height:1.3em;line-height:1.5';
    const row=document.createElement('div');
    row.style.cssText='display:grid;gap:10px;margin:20px 0';
    const button=(label,background,color)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='width:100%;border:0;border-radius:12px;padding:15px 12px;cursor:pointer;font:600 15px inherit;font-family:inherit;background:'+background+';color:'+color;return b};
    const backup=button('↓ Скачать резервную копию старого каталога','#162a47','#fff');
    const open=button('Открыть единую базу ↗','#e9f0fa','#142034');
    open.disabled=true;open.style.opacity='.5';
    backup.addEventListener('click',()=>{
      try{
        if(original===null)throw Error('Локальная копия отсутствует.');
        const payload={format:'farukh-print-legacy-v1',createdAt:new Date().toISOString(),source:location.origin,products:broken?null:items,originalRaw:original};
        const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;
        a.download='farukh-print-legacy-'+new Date().toISOString().slice(0,10)+'.json';
        document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
        status.textContent='Копия подготовлена для скачивания. Проверь файл в загрузках перед переходом.';
        open.disabled=false;open.style.opacity='1';
      }catch(e){status.textContent='Не удалось подготовить копию: '+e.message}
    });
    open.addEventListener('click',()=>{
      if(!confirm('Проверь, что резервная копия действительно скачана. Перейти к единой облачной базе? Старые данные на этом устройстве останутся нетронутыми.'))return;
      location.assign(CLOUD);
    });
    row.append(backup,open);
    const old=button('Продолжить в старом каталоге (без синхронизации)','#f6f7f9','#607086');
    old.addEventListener('click',()=>wrap.remove());
    const foot=document.createElement('p');
    foot.textContent='В новой системе подключение устройства выполняется по коду владельца из FARUKH AI. Печать — только после входа сотрудника.';
    foot.style.cssText='font-size:12px;line-height:1.5;color:#6c7485';
    box.append(heading,intro,notice,row,status,old,foot);
    wrap.append(box);document.body.append(wrap);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
