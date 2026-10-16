import test from 'node:test';
import assert from 'node:assert/strict';
import {installWeatherApi} from '../weather-api.js';
import {weatherAppearance} from '../public/lunar-weather.js';
function harness(request,now){let handler;installWeatherApi({get(path,fn){assert.equal(path,'/api/weather');handler=fn}},{request,now});return async()=>{const result={status:200};await handler({}, {setHeader(){},status(code){result.status=code;return this},json(body){result.body=body}});return result}}
test('Current weather is cached and exposes observation time, never credentials',async()=>{
 const now=()=>Date.parse('2026-10-16T12:15:00Z');let calls=0;
 const invoke=harness(async()=>{calls++;return {ok:true,json:async()=>({utc_offset_seconds:10800,current:{temperature_2m:-1.8,weather_code:73,is_day:1,time:'2026-10-16T15:15'}})}},now);
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
