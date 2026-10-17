import https from 'node:https';
import {WEATHER_URL} from './public/weather-scene.js';
// Use IPv4 explicitly: some hosting networks cannot reach the provider over IPv6.
function requestWeather(url,{signal}={}){
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{family:4,signal,timeout:12000,headers:{Accept:'application/json'}},res=>{
   const chunks=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>4000000){res.destroy(Error('Weather response too large'));return}chunks.push(chunk)});
   res.on('error',reject);res.on('end',()=>resolve({ok:res.statusCode===200,json:async()=>JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
  });req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Weather timeout')));
 });
}
const URL=WEATHER_URL;

export function installWeatherApi(app,{request=requestWeather,now=Date.now}={}){
 let cached=null,pending=null,aurora=null,auroraChecked=0;
 async function loadAurora(){
  if(now()-auroraChecked<10*60000)return aurora;auroraChecked=now();
  try{const r=await request('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();const d=await r.json();const forecastAt=d['Forecast Time'];if(!Number.isFinite(Date.parse(forecastAt))||Math.abs(now()-Date.parse(forecastAt))>60*60000)throw Error();const point=d.coordinates?.find(p=>p[0]===33&&p[1]===69);if(!point||!Number.isFinite(point[2]))throw Error();aurora={probability:point[2],forecastAt,source:'NOAA OVATION'};}catch{aurora=null}return aurora;
 }
 async function load(){
  const r=await request(URL,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Weather unavailable');
  const d=await r.json(),c=d.current;
  if(!c||!Number.isFinite(c.temperature_2m)||!Number.isInteger(c.weather_code)||![0,1].includes(c.is_day)||typeof c.time!=='string')throw Error('Invalid weather');
  const observedAt=new Date(c.time+(d.utc_offset_seconds===10800?'+03:00':'Z')).getTime();
  if(!Number.isFinite(observedAt)||Math.abs(now()-observedAt)>90*60*1000)throw Error('Outdated weather');
  const auroraData=await loadAurora();
  cached={cloudCover:c.cloud_cover,precipitation:c.precipitation,rain:c.rain,snowfall:c.snowfall,windSpeed:c.wind_speed_10m,windDirection:c.wind_direction_10m,aurora:auroraData,temperature:c.temperature_2m,code:c.weather_code,isDay:c.is_day===1,observedAt:new Date(observedAt).toISOString(),fetchedAt:now(),city:'Мурманск',source:'Open-Meteo'};
  return cached;
 }
 app.get('/api/weather',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   if(!cached||now()-cached.fetchedAt>5*60*1000){
    if(!pending)pending=load().finally(()=>{pending=null});
    await pending;
   }
   res.json({ok:true,...cached});
  }catch{res.status(503).json({ok:false,error:'Погода временно недоступна'});}
 });
}
