export function nearestReminder(tasks,now=Date.now()){
 const pending=(tasks||[]).filter(t=>!t.done&&t.due&&Number.isFinite(Date.parse(t.due))).sort((a,b)=>Date.parse(a.due)-Date.parse(b.due));
 const task=pending[0];if(!task)return null;
 return {task,overdue:Date.parse(task.due)<now};
}
export function weatherLabel(code){if(code===0)return 'Ясно';if([1,2].includes(code))return 'Малооблачно';if(code===3)return 'Облачно';if([45,48].includes(code))return 'Туман';if([71,73,75,77,85,86].includes(code))return 'Снег';if(code>=95)return 'Гроза';if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return 'Дождь';return 'Погода'}
export function mountHomeWeather(root){
 const button=document.createElement('button');button.type='button';button.className='home-weather';button.textContent='Мурманск · Погода…';root.append(button);
 const dialog=document.createElement('dialog');dialog.className='weather-dialog';dialog.setAttribute('aria-label','Погода в Мурманске');
 const bar=document.createElement('div');bar.className='bar';const title=document.createElement('h2');title.textContent='Погода · Мурманск';const close=document.createElement('button');close.type='button';close.textContent='✕';close.setAttribute('aria-label','Закрыть погоду');close.onclick=()=>dialog.close();bar.append(title,close);
 const detail=document.createElement('p');detail.textContent='Загружаю текущую погоду…';const source=document.createElement('a');source.href='https://open-meteo.com/';source.target='_blank';source.rel='noopener';source.textContent='Источник: Open-Meteo';const retry=document.createElement('button');retry.type='button';retry.textContent='Обновить';dialog.append(bar,detail,source,retry);document.body.append(dialog);button.onclick=()=>dialog.showModal();
 let pending=false,last=0;
 async function refresh(){if(pending||document.hidden)return;pending=true;retry.disabled=true;
  try{const r=await fetch('/api/weather',{signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.ok||!Number.isFinite(d.temperature)||!Number.isFinite(Date.parse(d.observedAt))||Math.abs(Date.now()-Date.parse(d.observedAt))>90*60000)throw Error();
   const temperature=Math.round(d.temperature),label=weatherLabel(d.code);button.textContent=`Мурманск · ${temperature>0?'+':''}${temperature}° · ${label}`;button.title='Открыть подробности погоды';detail.textContent=`${label}, ${temperature} °C`+(Number.isFinite(d.windSpeed)?`. Ветер ${Math.round(d.windSpeed)} км/ч`:'')+`. Данные на ${new Date(d.observedAt).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'})} МСК.`;last=Date.now();
  }catch{button.textContent='Мурманск · Погода недоступна';button.title='Открыть погоду и повторить загрузку';detail.textContent='Не удалось получить свежие данные. Попробуй обновить позже.';}finally{pending=false;retry.disabled=false}
 }
 retry.onclick=refresh;refresh();setInterval(()=>{if(document.body.dataset.view==='home'&&Date.now()-last>=10*60000)refresh()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-last>=10*60000)refresh()});
 return {refresh};
}
