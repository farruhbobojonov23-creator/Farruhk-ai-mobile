const URL = 'https://api.open-meteo.com/v1/forecast?latitude=68.9707&longitude=33.0749&current=temperature_2m,weather_code,is_day&timezone=Europe%2FMoscow';
export function installWeatherApi(app,{request=fetch,now=Date.now}={}){
 let cached=null,pending=null;
 async function load(){
  const r=await request(URL,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Weather unavailable');
  const d=await r.json(),c=d.current;
  if(!c||!Number.isFinite(c.temperature_2m)||!Number.isInteger(c.weather_code)||![0,1].includes(c.is_day)||typeof c.time!=='string')throw Error('Invalid weather');
  const observedAt=new Date(c.time+(d.utc_offset_seconds===10800?'+03:00':'Z')).getTime();
  if(!Number.isFinite(observedAt)||Math.abs(now()-observedAt)>90*60*1000)throw Error('Outdated weather');
  cached={temperature:c.temperature_2m,code:c.weather_code,isDay:c.is_day===1,observedAt:new Date(observedAt).toISOString(),fetchedAt:now(),city:'Мурманск',source:'Open-Meteo'};
  return cached;
 }
 app.get('/api/weather',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   if(!cached||now()-cached.fetchedAt>10*60*1000){
    if(!pending)pending=load().finally(()=>{pending=null});
    await pending;
   }
   res.json({ok:true,...cached});
  }catch{res.status(503).json({ok:false,error:'Погода временно недоступна'});}
 });
}
