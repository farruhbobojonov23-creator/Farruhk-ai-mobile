export function weatherAppearance(code,isDay=true){
 if([71,73,75,77,85,86].includes(code))return {kind:'snow',icon:'❄',label:'Снег'};
 if([56,57,66,67].includes(code))return {kind:'rain',icon:'☂',label:'Ледяной дождь'};
 if([51,53,55,61,63,65,80,81,82].includes(code))return {kind:'rain',icon:'☂',label:code<60?'Морось':'Дождь'};
 if([95,96,99].includes(code))return {kind:'rain',icon:'ϟ',label:'Гроза'};
 if([45,48].includes(code))return {kind:'fog',icon:'≋',label:'Туман'};
 if(code===0)return {kind:isDay?'sun':'night',icon:isDay?'☀':'☾',label:isDay?'Ясно':'Ясная ночь'};
 if([1,2].includes(code))return {kind:isDay?'sun':'night',icon:isDay?'☀':'☾',label:'Малооблачно'};
 if(code===3)return {kind:'cloud',icon:'☁',label:'Облачно'};
 return {kind:'cloud',icon:'☁',label:'Без осадков'};
}
export function mountLunarWeather(root){
 const time=root.querySelector('[data-clock]'),date=root.querySelector('[data-date]'),card=root.querySelector('[data-weather]');
 const clockFormat=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});
 const dateFormat=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',weekday:'long',day:'numeric',month:'long'});
 function tick(){const now=new Date();time.textContent=clockFormat.format(now);time.dateTime=now.toISOString();date.textContent=dateFormat.format(now)}tick();
 const clock=setInterval(tick,1000);let lastSuccess=0,loading=false;
 const effects=document.createElement('div');effects.className='lunar-weather-effects';effects.ariaHidden='true';document.body.prepend(effects);
 for(let i=0;i<36;i++){const flake=document.createElement('i');flake.style.setProperty('--x',String(i%2?82+Math.random()*18:Math.random()*18));flake.style.setProperty('--delay',String(-Math.random()*20)+'s');flake.style.setProperty('--duration',String(8+Math.random()*9)+'s');flake.style.setProperty('--size',String(2+Math.random()*4)+'px');effects.append(flake)}
 function unavailable(){document.body.dataset.weather='unknown';card.querySelector('[data-weather-temp]').textContent='—';card.querySelector('[data-weather-label]').textContent='Нет свежих данных';card.querySelector('[data-weather-icon]').textContent='↻';card.title='Погода временно недоступна. Следующая проверка автоматически.';}
 async function refresh(){
  if(loading)return;loading=true;
  try{let d;
   try{const r=await fetch('/api/weather',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('weather');d=await r.json()}
   catch{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude=68.9707&longitude=33.0749&current=temperature_2m,weather_code,is_day&timezone=Europe%2FMoscow',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('weather');const raw=await r.json(),c=raw.current;if(!c)throw Error('weather');d={ok:true,temperature:c.temperature_2m,code:c.weather_code,isDay:c.is_day===1,observedAt:c.time+'+03:00'}}
   if(!d.ok||!Number.isFinite(d.temperature)||!Number.isInteger(d.code)||!Number.isFinite(Date.parse(d.observedAt))||Date.now()-Date.parse(d.observedAt)>90*60*1000)throw Error('weather');
   const w=weatherAppearance(d.code,d.isDay);lastSuccess=Date.now();document.body.dataset.weather=w.kind;
   card.querySelector('[data-weather-temp]').textContent=(Math.round(d.temperature)>0?'+':'')+Math.round(d.temperature)+'°';card.querySelector('[data-weather-label]').textContent=w.label;card.querySelector('[data-weather-icon]').textContent=w.icon;
   card.title='Мурманск · Open-Meteo · данные на '+clockFormat.format(new Date(d.observedAt));
  }catch{unavailable()}finally{loading=false}
 }
 refresh();const poll=setInterval(()=>{if(!document.hidden)refresh()},10*60*1000);
 const visibility=()=>{if(!document.hidden){tick();if(Date.now()-lastSuccess>10*60*1000)refresh()}};document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',()=>{clearInterval(clock);clearInterval(poll);document.removeEventListener('visibilitychange',visibility)},{once:true});
}
