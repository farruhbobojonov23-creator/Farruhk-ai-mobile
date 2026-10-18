import test from 'node:test';
import assert from 'node:assert/strict';
import {landscapeState,photoCrop,cloudOffset,harborLandscape} from '../public/harbor-landscape.js';
test('Photographic scenes cover day, cloud, precipitation, twilight and dark cloudy skies',()=>{
 const day={period:'day',kind:'sun',cloud:.1};assert.equal(landscapeState(day).base,'sun');
 for(const kind of ['rain','fog','cloud'])assert.equal(landscapeState({...day,kind}).base,'overcast');
 for(const kind of ['snow','sleet'])assert.equal(landscapeState({...day,kind}).base,'snow');
 assert.equal(landscapeState({...day,cloud:.9}).base,'overcast');
 const night=landscapeState({...day,period:'night',kind:'snow'});assert.equal(night.base,'night');assert.equal(night.sky,'overcast');assert.equal(night.darkSky,true);
 assert.equal(landscapeState({...day,period:'twilight'}).twilight,true);
});
test('Photo sampling has overscan on portrait and wide screens; sky movement stops before the ridge',()=>{
 for(const [w,h] of [[390,844],[1920,1080],[3440,1440]]){const c=photoCrop(3840,2160,w,h);assert.ok(c.x>0&&c.y>0);assert.ok(c.x+c.width<3840);assert.ok(c.y+c.height<2160)}
 assert.equal(cloudOffset(280,280,20,40),0);assert.equal(cloudOffset(600,280,20,40),0);assert.notEqual(cloudOffset(20,280,0),cloudOffset(20,280,30));assert.ok(Math.abs(cloudOffset(279.99,280,30))<.00001);
});
test('A loaded scene stays visible while the next photo downloads; reduced motion and disposal remain stable',()=>{
 const original=globalThis.Image,images=[];globalThis.Image=class{constructor(){this.naturalWidth=3840;this.naturalHeight=2160;images.push(this)}};
 try{let calls=0;const ctx={save(){},restore(){},drawImage(){calls++},fillRect(){}};const p=harborLandscape(),s={period:'day',kind:'sun',cloud:0,wind:12};assert.equal(p.draw(ctx,390,844,s,0,false),false);images[0].onload();assert.equal(p.draw(ctx,390,844,s,0,false),true);assert.ok(calls>1);const before=calls;assert.equal(p.draw(ctx,390,844,{...s,kind:'snow'},1,false),true);assert.ok(calls>before);images[1].onload();assert.equal(p.draw(ctx,390,844,{...s,kind:'snow'},2,true),true);assert.ok(p.skyEnd>0);p.dispose();assert.ok(images.every(i=>i.onload===null));}finally{globalThis.Image=original}
});
