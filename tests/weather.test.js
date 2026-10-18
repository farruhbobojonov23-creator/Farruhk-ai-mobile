import test from 'node:test';
import assert from 'node:assert/strict';
import {installWeatherApi} from '../weather-api.js';
import {weatherAppearance} from '../public/lunar-weather.js';
function harness(request,now){let handler;installWeatherApi({get(path,fn){assert.equal(path,'/api/weather');handler=fn}},{request,now});return async()=>{const result={status:200};await handler({}, {setHeader(){},status(code){result.status=code;return this},json(body){result.body=body}});return result}}
test('Current weather is cached and exposes observation time, never credentials',async()=>{
 const now=()=>Date.parse('2026-10-16T12:15:00Z');let calls=0;
 const invoke=harness(async(url)=>{if(url.includes("noaa.gov"))return {ok:false};calls++;return {ok:true,json:async()=>({utc_offset_seconds:10800,current:{temperature_2m:-1.8,weather_code:73,is_day:1,time:'2026-10-16T15:15'}})}},now);
 const [a,b]=await Promise.all([invoke(),invoke()]);assert.equal(calls,1);assert.equal(a.status,200);assert.equal(a.body.temperature,-1.8);assert.equal(b.body.observedAt,'2026-10-16T12:15:00.000Z');assert.equal(a.body.city,'Мурманск');await invoke();assert.equal(calls,1);
});
test('Failure or stale observations cannot produce plausible weather values',async()=>{
 for(const request of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({current:{temperature_2m:3,weather_code:0,is_day:1,time:'2020-01-01T00:00'}})}),async()=>({ok:true,json:async()=>({current:{}})})]){
  const result=await harness(request,Date.now)();assert.equal(result.status,503);assert.equal(result.body.ok,false);assert.equal(result.body.temperature,undefined);
 }
});
test('Weather effects follow precipitation codes and distinguish clear nights',()=>{
 for(const c of [71,73,75,77,85,86])assert.equal(weatherAppearance(c).kind,'snow');
 for(const c of [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99])assert.equal(weatherAppearance(c).kind,'rain');
 assert.equal(weatherAppearance(0,false).kind,'night');assert.equal(weatherAppearance(0,true).kind,'sun');assert.equal(weatherAppearance(3).kind,'cloud');assert.equal(weatherAppearance(45).kind,'fog');
});

import {sceneState} from '../public/weather-scene.js';
const sample=(date,extra={})=>({temperature:2,code:0,cloudCover:0,observedAt:date,...extra});
test('Murmansk sky follows the sun, including polar day and polar night',()=>{
 for(const [date,period] of [['2026-06-21T00:00:00Z','day'],['2026-12-21T00:00:00Z','night'],['2026-12-21T09:00:00Z','twilight'],['2026-10-17T00:00:00Z','night'],['2026-10-17T09:00:00Z','day']]){
  const state=sceneState(sample(date),new Date(date));assert.equal(state.period,period,date);
 }
});
test('Clouds, fog, stale data and the horizon determine celestial visibility',()=>{
 const noon='2026-10-17T09:00:00Z';assert.equal(sceneState(sample(noon),new Date(noon)).sunVisible,true);
 assert.equal(sceneState(sample(noon,{code:3,cloudCover:100}),new Date(noon)).sunVisible,false);
 assert.equal(sceneState(sample(noon,{code:45,cloudCover:100}),new Date(noon)).kind,'fog');
 assert.equal(sceneState(sample(noon),new Date('2026-10-17T12:00:00Z')).kind,'unknown');
 let above=0,below=0;for(let hour=0;hour<24*30;hour++){const date=new Date(Date.UTC(2026,9,1,hour)),s=sceneState(sample(date.toISOString()),date);if(s.period==='night'){if(s.moon.altitude>0&&s.phase.fraction>.015){assert.equal(s.moonVisible,true);above++}else{assert.equal(s.moonVisible,false);below++}}}assert.ok(above);assert.ok(below);
});
test('Sleet combines rain and snow, while aurora requires a fresh forecast and dark clear sky',()=>{
 const date='2026-10-17T00:00:00Z',now=new Date(date),aurora={probability:35,forecastAt:date};
 assert.equal(sceneState(sample(date,{code:73,temperature:1}),now).kind,'sleet');
 assert.equal(sceneState(sample(date,{code:73,temperature:-5}),now).kind,'snow');
 assert.equal(sceneState(sample(date,{aurora}),now).aurora,true);
 assert.equal(sceneState(sample(date,{aurora,cloudCover:95}),now).aurora,false);
 assert.equal(sceneState(sample(date,{aurora:{...aurora,forecastAt:'2026-10-16T20:00:00Z'}}),now).aurora,false);
 assert.equal(sceneState(sample(date),now).aurora,false);
});
test('Aurora feed uses the Murmansk grid point and cannot break ordinary weather',async()=>{
 const stamp='2026-10-17T00:15:00Z',now=()=>Date.parse(stamp);
 for(const forecast of [{ 'Forecast Time':stamp,coordinates:[[33,69,42],[80,69,99]]},{'Forecast Time':'2020-01-01T00:00:00Z',coordinates:[[33,69,99]]},null]){
  const invoke=harness(async url=>url.includes('noaa.gov')?{ok:!!forecast,json:async()=>forecast}:{ok:true,json:async()=>({utc_offset_seconds:10800,current:{temperature_2m:5,weather_code:0,is_day:0,time:'2026-10-17T03:15',cloud_cover:12,wind_speed_10m:17}})},now);
  const result=await invoke();assert.equal(result.status,200);assert.equal(result.body.cloudCover,12);assert.equal(result.body.windSpeed,17);assert.equal(result.body.aurora?.probability,forecast?.['Forecast Time']===stamp?42:undefined);
 }
});

test('Overcast, precipitation and fog hide the sun even with an inconsistent low cloud percentage',()=>{
 const stamp='2026-10-17T09:00:00Z';
 for(const code of [3,45,48,61,71,95])assert.equal(sceneState(sample(stamp,{code,cloudCover:10}),new Date(stamp)).sunVisible,false);
});
