import {publicWeatherClient,firstLiveWeather} from './browser-weather.js?v=1';
import {mountWeatherScene,sceneState,WEATHER_URL} from './weather-scene.js?v=mobile-repair-9';
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
export const SKY_PREVIEWS={
 sun:{label:'Солнце',icon:'☀',scene:{period:'day',kind:'sun',cloud:.38,sunVisible:true,moonVisible:false,altitude:28,sun:{altitude:.49,azimuth:.6}}},
 moon:{label:'Луна',icon:'☾',scene:{period:'night',kind:'night',cloud:.38,sunVisible:false,moonVisible:true,moon:{altitude:.62,azimuth:.6,parallacticAngle:0}}},
 snow:{label:'Снег',icon:'❄',scene:{period:'day',kind:'snow',cloud:.9,sunVisible:false,moonVisible:false,intensity:.85,wind:18,windDirection:250}},
 rain:{label:'Дождь',icon:'☂',scene:{period:'day',kind:'rain',cloud:.95,sunVisible:false,moonVisible:false,intensity:.85,wind:22,windDirection:250}},
 fog:{label:'Туман',icon:'≋',scene:{period:'day',kind:'fog',cloud:.98,sunVisible:false,moonVisible:false,intensity:0,wind:2,windDirection:250}}
};
export function mountLunarWeather(root){
 const time=root.querySelector('[data-clock]'),date=root.querySelector('[data-date]'),card=root.querySelector('[data-weather]');
 const clockFormat=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});
 const dateFormat=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',weekday:'long',day:'numeric',month:'long'});
 const scene=mountWeatherScene(),preview=new URL(location.href).searchParams.get('previewSky'),preset=Object.hasOwn(SKY_PREVIEWS,preview)?SKY_PREVIEWS[preview]:null;
 if(preset){const badge=document.createElement('a');badge.className='sky-preview-badge';badge.textContent='Предпросмотр: '+preset.label.toLowerCase()+' · Вернуться к погоде';const url=new URL(location.href);url.searchParams.delete('previewSky');badge.href=url.href;document.body.append(badge)}
 const loadPublicWeather=publicWeatherClient();
 let weather=null,lastSuccess=0,loading=false,lastMinute=-1;
 function updateScene(){
  const s=sceneState(weather);if(preset)Object.assign(s,preset.scene,{fresh:true,aurora:false});scene.update(s);
  if(preset){card.querySelector('[data-weather-temp]').textContent='—';card.querySelector('[data-weather-icon]').textContent=preset.icon;card.querySelector('[data-weather-label]').textContent=preset.label+' · предпросмотр';card.title='Предпросмотр эффекта. Не текущая погода Мурманска.';return}
  if(weather&&s.fresh){const label=s.kind==='sleet'?'Мокрый снег':weatherAppearance(weather.code,s.period==='day').label;card.querySelector('[data-weather-label]').textContent=label+(s.aurora?' · возможно сияние':'');card.title='Мурманск · Open-Meteo · данные на '+clockFormat.format(new Date(weather.observedAt))+' · обновление каждые 5 минут'+(s.aurora?' · NOAA: вероятность сияния, видимость не подтверждена':'');}else if(weather){unavailable()}
 }

 function tick(){const now=new Date();time.textContent=clockFormat.format(now);time.dateTime=now.toISOString();date.textContent=dateFormat.format(now);const minute=Math.floor(+now/60000);if(minute!==lastMinute){lastMinute=minute;updateScene()}}tick();
 function unavailable(){weather=null;if(preset){updateScene();return}scene.update(sceneState(null));card.querySelector('[data-weather-temp]').textContent='—';card.querySelector('[data-weather-label]').textContent='Нет свежих данных';card.querySelector('[data-weather-icon]').textContent='↻';card.title='Погода временно недоступна. Следующая проверка автоматически.';}
 async function refresh(){if(loading)return;loading=true;
  try{const d=await firstLiveWeather(async()=>{const r=await fetch('/api/weather',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('weather');return r.json()},()=>loadPublicWeather(WEATHER_URL));
   weather=d;lastSuccess=Date.now();const w=weatherAppearance(d.code,d.isDay);card.querySelector('[data-weather-temp]').textContent=(Math.round(d.temperature)>0?'+':'')+Math.round(d.temperature)+'°';card.querySelector('[data-weather-icon]').textContent=w.icon;updateScene();
  }catch{unavailable()}finally{loading=false}
 }
 refresh();const clock=setInterval(tick,1000),poll=setInterval(()=>{if(!document.hidden)refresh()},5*60000);
 const visibility=()=>{if(!document.hidden){tick();if(Date.now()-lastSuccess>5*60000)refresh()}};document.addEventListener('visibilitychange',visibility);
 // pagehide can enter the back/forward cache; restart on return rather than losing timers.
 const show=e=>{if(e.persisted){tick();refresh()}};window.addEventListener('pageshow',show);
 return ()=>{clearInterval(clock);clearInterval(poll);scene.dispose();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pageshow',show)};
}
