// Independent public-feed fallback; failure never creates plausible weather values.
export const AURORA_URL='https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
export function auroraAtMurmansk(feed,now=Date.now()){
 const forecastAt=feed?.['Forecast Time'];
 if(!Number.isFinite(Date.parse(forecastAt))||Math.abs(now-Date.parse(forecastAt))>60*60000)return null;
 const point=feed.coordinates?.find(p=>p[0]===33&&p[1]===69);
 return point&&Number.isFinite(point[2])?{probability:point[2],forecastAt,source:'NOAA OVATION'}:null;
}
export function publicWeatherClient(request=fetch,now=Date.now){
 let aurora=null,checked=-Infinity;
 async function forecast(){
  if(now()-checked<10*60000)return aurora;
  checked=now();
  try{const r=await request(AURORA_URL,{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('aurora');aurora=auroraAtMurmansk(await r.json(),now())}catch{aurora=null}
  return aurora;
 }
 return async url=>{
  const [r,a]=await Promise.all([request(url,{signal:AbortSignal.timeout(12000)}),forecast()]);
  if(!r.ok)throw Error('weather');const raw=await r.json(),c=raw.current;
  if(!c)throw Error('weather');
  return {ok:true,temperature:c.temperature_2m,code:c.weather_code,isDay:c.is_day===1,observedAt:c.time+'+03:00',cloudCover:c.cloud_cover,precipitation:c.precipitation,rain:c.rain,snowfall:c.snowfall,windSpeed:c.wind_speed_10m,windDirection:c.wind_direction_10m,aurora:a};
 };
}

export function validWeather(d,now=Date.now()){
 return !!d?.ok&&Number.isFinite(d.temperature)&&Number.isInteger(d.code)&&[true,false].includes(d.isDay)&&Number.isFinite(Date.parse(d.observedAt))&&Math.abs(now-Date.parse(d.observedAt))<=90*60000;
}
export async function firstLiveWeather(server,publicFeed,now=Date.now){
 const checked=async load=>{const d=await load();if(!validWeather(d,now()))throw Error('Stale or invalid weather');return d};
 return Promise.any([checked(server),checked(publicFeed)]);
}
