import test from 'node:test';
import assert from 'node:assert/strict';
import {firstLiveWeather,validWeather,publicWeatherClient} from '../public/browser-weather.js';
const stamp='2026-10-18T20:00:00Z',now=()=>Date.parse(stamp),good={ok:true,temperature:3,code:1,isDay:false,observedAt:stamp};
test('Unavailable or stale server responses cannot block a fresh direct weather response',async()=>{
 for(const load of [async()=>{throw Error('503')},async()=>({...good,observedAt:'2020-01-01T00:00:00Z'})])assert.equal((await firstLiveWeather(load,async()=>good,now)).temperature,3);
});
test('A fresh server response remains usable when the direct provider fails',async()=>{
 assert.equal(await firstLiveWeather(async()=>good,async()=>{throw Error('offline')},now),good);
});
test('Both failed providers report unavailability rather than a plausible forecast',async()=>{
 await assert.rejects(firstLiveWeather(async()=>({ok:true}),async()=>({ok:false}),now));
 assert.equal(validWeather({...good,observedAt:'2020-01-01T00:00:00Z'},now()),false);
});
test('An unavailable aurora feed cannot break fresh ordinary weather',async()=>{
 const load=publicWeatherClient(async url=>url.includes('noaa.gov')?{ok:false}:{ok:true,json:async()=>({current:{temperature_2m:3,weather_code:1,is_day:0,time:'2026-10-18T23:00',cloud_cover:35}})},now);
 const d=await load('weather');assert.equal(validWeather(d,now()),true);assert.equal(d.aurora,null);
});
