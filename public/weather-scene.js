import {weatherClouds} from './weather-clouds.js?v=1';
import {celestialLight} from './celestial-light.js?v=3';
import {auroraFrame} from './aurora-ribbons.js?v=2';
import SunCalc from './sky-astronomy.js';
export const LOCATION={lat:68.9707,lon:33.0749};
export const WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=68.9707&longitude=33.0749&current=temperature_2m,weather_code,is_day,cloud_cover,precipitation,rain,showers,snowfall,wind_speed_10m,wind_direction_10m&timezone=Europe%2FMoscow';
export function sceneState(weather,now=new Date()){
 const sun=SunCalc.getPosition(now,LOCATION.lat,LOCATION.lon),moon=SunCalc.getMoonPosition(now,LOCATION.lat,LOCATION.lon),phase=SunCalc.getMoonIllumination(now);
 const altitude=sun.altitude*180/Math.PI;
 const period=altitude>0?'day':altitude>-6?'twilight':'night';
 const fresh=weather&&Math.abs(+now-Date.parse(weather.observedAt))<=90*60000;
 const c=fresh?weather.code:null;
 const cloud=fresh?(Number.isFinite(weather.cloudCover)?weather.cloudCover/100:c===0?0:[1,2].includes(c)?.4:.95):0;
 const snow=[71,73,75,77,85,86].includes(c),rain=[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(c);
 const wetSnow=fresh&&((snow&&weather.temperature>0)||(snow&&weather.rain>0)||(rain&&weather.snowfall>0));
 const aurora=fresh&&period==='night'&&cloud<.5&&weather.aurora?.probability>=15&&Math.abs(+now-Date.parse(weather.aurora.forecastAt))<60*60000;
 return {period,altitude,sun,moon,phase,cloud:Math.max(0,Math.min(1,cloud)),fresh,kind:!fresh?'unknown':wetSnow?'sleet':snow?'snow':rain?'rain':[45,48].includes(c)?'fog':c===3?'cloud':period==='day'?'sun':'night',sunVisible:fresh&&altitude>0&&cloud<.8,moonVisible:fresh&&period!=='day'&&moon.altitude>0&&cloud<.8&&phase.fraction>.015,aurora,thunder:[95,96,99].includes(c),wind:fresh?Math.min(70,weather.windSpeed||0):0,windDirection:weather?.windDirection||0,intensity:fresh?Math.min(1,Math.max(.2,(weather.precipitation||0)/3)):0};
}
// Full-viewport atmosphere stays behind the controls; all coordinates are decorative.
export function mountWeatherScene(){
 const layer=document.createElement('div');layer.className='live-weather-scene';layer.ariaHidden='true';
 const canvas=document.createElement('canvas');layer.append(canvas);document.body.prepend(layer);
 const ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)'),light=celestialLight(),clouds=weatherClouds(()=>resume());
 let state=sceneState(null),w=0,h=0,frame=0,last=0,elapsed=0,disposed=false;
 const stars=Array.from({length:100},()=>({x:Math.random(),y:Math.random()*.64,r:.35+Math.random(),a:.2+Math.random()*.6}));
 const particles=Array.from({length:110},()=>({x:Math.random(),y:Math.random(),z:.3+Math.random()*.7}));
 const cloudCanvas=document.createElement('canvas');cloudCanvas.width=900;cloudCanvas.height=350;
 const cc=cloudCanvas.getContext('2d');for(let i=0;i<65;i++){const x=Math.random()*900,y=100+Math.random()*160,r=35+Math.random()*85,g=cc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(220,227,241,.12)');g.addColorStop(1,'rgba(220,227,241,0)');cc.fillStyle=g;cc.fillRect(x-r,y-r,r*2,r*2)}
 // Feather every edge before drifting the cloud texture across the sky.
 cc.globalCompositeOperation='destination-in';
 for(const vertical of [false,true]){const edge=cc.createLinearGradient(0,0,vertical?0:900,vertical?350:0);edge.addColorStop(0,'transparent');edge.addColorStop(.14,'white');edge.addColorStop(.86,'white');edge.addColorStop(1,'transparent');cc.fillStyle=edge;cc.fillRect(0,0,900,350)}
 cc.globalCompositeOperation='source-over';
 function resize(){w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);draw(0)}
 function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r)}
 // Render a continuous translucent field, rather than overlapping horizontal strips.
 const auroraCanvas=document.createElement('canvas'),ac=auroraCanvas.getContext('2d');
 let auroraPaintedAt=-Infinity;
 function drawSoftAurora(){
  const scale=Math.min(1,560/w,640/h),aw=Math.max(2,Math.round(w*scale)),ah=Math.max(2,Math.round(h*scale));
  if(auroraCanvas.width!==aw||auroraCanvas.height!==ah){auroraCanvas.width=aw;auroraCanvas.height=ah;auroraPaintedAt=-Infinity}
  if(elapsed-auroraPaintedAt>=.09||auroraPaintedAt===-Infinity){
   const image=ac.createImageData(aw,ah);image.data.set(auroraFrame(aw,ah,elapsed));ac.putImageData(image,0,0);auroraPaintedAt=elapsed;
  }
  ctx.save();ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter='blur(.7px)';ctx.drawImage(auroraCanvas,0,0,w,h);ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(0,h*.84,w,h*.16);ctx.clip();
  glow(w*.53,h*.97,w*.25,'rgba(86,190,153,.045)');ctx.restore();
 }
 function draw(dt){
  ctx.clearRect(0,0,w,h);const s=state,night=s.period==='night';
  // Tint the original photo without losing the mountain and water details.
  const g=ctx.createLinearGradient(0,0,0,h);
  if(s.period==='day'){
   g.addColorStop(0,s.cloud>.8?'rgba(57,98,145,.76)':'rgba(40,112,188,.84)');
   g.addColorStop(.42,s.cloud>.8?'rgba(117,147,177,.60)':'rgba(85,150,211,.65)');
   g.addColorStop(.72,'rgba(196,200,207,.08)');g.addColorStop(.84,'rgba(255,231,190,.06)');g.addColorStop(1,'rgba(57,99,150,.08)');
  }else{g.addColorStop(0,night?'rgba(3,10,40,.91)':'rgba(40,50,100,.62)');g.addColorStop(.75,night?'rgba(9,21,53,.68)':'rgba(167,106,119,.25)');g.addColorStop(1,night?'rgba(6,17,44,.72)':'rgba(57,75,102,.08)')}
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);

  if(night&&s.fresh&&s.cloud<.8){for(const star of stars){ctx.globalAlpha=star.a*(1-s.cloud);ctx.fillStyle='#e8eeff';ctx.beginPath();ctx.arc(star.x*w,star.y*h,star.r,0,7);ctx.fill()}ctx.globalAlpha=1}
  if(s.aurora) drawSoftAurora();
  clouds.draw(ctx,s,w,h,elapsed,'far');
  if(s.sunVisible)light.sun(ctx,s,w,h,elapsed,cloudCanvas);
  if(s.moonVisible)light.moon(ctx,s,w,h,elapsed,cloudCanvas);
  clouds.draw(ctx,s,w,h,elapsed,'near');
  if(s.kind==='fog'){ctx.save();ctx.globalAlpha=.7;ctx.drawImage(cloudCanvas,-w*.1+Math.sin(elapsed*.03)*w*.1,h*.25,w*1.4,h*.8);ctx.drawImage(cloudCanvas,-w*.2,h*.45,w*1.6,h*.6);ctx.restore()}
  if(['snow','rain','sleet'].includes(s.kind)){const count=Math.round((w<700?55:100)*(.45+s.intensity*.55)),wind=Math.sin(s.windDirection*Math.PI/180)*s.wind;for(let i=0;i<count;i++){const p=particles[i],rain=s.kind==='rain'||(s.kind==='sleet'&&i%2===0);if(!motion.matches){p.y+=dt*(rain?.75:.035)*p.z;p.x+=dt*wind*.0007*p.z;if(p.y>1.05)p.y=-.05;p.x=(p.x+1)%1}ctx.globalAlpha=.25+p.z*.55;ctx.strokeStyle=night?'#b9cce6':'#849ab4';ctx.fillStyle='#fff';ctx.lineWidth=.5+p.z*.6;const x=p.x*w,y=p.y*h;if(rain){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+wind*.3,y+12+p.z*15);ctx.stroke()}else{ctx.shadowColor='#e4edff';ctx.shadowBlur=p.z>.8?4:0;ctx.beginPath();ctx.arc(x,y,.7+p.z*2,0,7);ctx.fill()}}ctx.globalAlpha=1;ctx.shadowBlur=0}
 }
 function animate(t){frame=0;if(disposed)return;if(!document.hidden&&document.body.dataset.view==='home'){if(t-last>40){const dt=Math.min((t-last)/1000,.1);last=t;elapsed+=dt;draw(dt)}}if(!motion.matches&&!document.hidden)frame=requestAnimationFrame(animate)}
 function resume(){if(disposed)return;if(!frame&&!motion.matches&&!document.hidden)frame=requestAnimationFrame(animate);draw(0)}
 resize();resume();addEventListener('resize',resize);document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);
 return {update(next){state=next;document.body.dataset.sky=next.period;document.body.dataset.weather=next.kind;document.body.dataset.aurora=String(!!next.aurora);draw(0);resume()},dispose(){disposed=true;light.dispose();clouds.dispose();cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resume);motion.removeEventListener('change',resume);layer.remove()}};
}
