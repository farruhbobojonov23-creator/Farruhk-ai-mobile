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
 const ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let state=sceneState(null),w=0,h=0,frame=0,last=0,elapsed=0,disposed=false;
 const stars=Array.from({length:100},()=>({x:Math.random(),y:Math.random()*.64,r:.35+Math.random(),a:.2+Math.random()*.6}));
 const particles=Array.from({length:110},()=>({x:Math.random(),y:Math.random(),z:.3+Math.random()*.7}));
 const cloudCanvas=document.createElement('canvas');cloudCanvas.width=900;cloudCanvas.height=350;
 const cc=cloudCanvas.getContext('2d');for(let i=0;i<65;i++){const x=Math.random()*900,y=100+Math.random()*160,r=35+Math.random()*85,g=cc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(220,227,241,.12)');g.addColorStop(1,'rgba(220,227,241,0)');cc.fillStyle=g;cc.fillRect(x-r,y-r,r*2,r*2)}
 function resize(){w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);draw(0)}
 function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r)}
 // Continuous curved sheets, rendered at bounded resolution and softly blended.
 // No tiled columns: the old per-column rectangles produced the visible grid.
 const auroraCanvas=document.createElement('canvas'),ac=auroraCanvas.getContext('2d');
 function drawSoftAurora(){
  const aw=Math.min(900,Math.round(w)),ah=Math.max(1,Math.round(aw*h/w));
  if(auroraCanvas.width!==aw||auroraCanvas.height!==ah){auroraCanvas.width=aw;auroraCanvas.height=ah}
  ac.clearRect(0,0,aw,ah);
  const t=elapsed*.055;
  ac.globalCompositeOperation='screen';
  ac.filter='blur(2.6px)';
  // The curtain's lower edge meanders; its upper edge dissolves into darkness.
  for(let band=0;band<2;band++){
   const points=[];
   for(let i=0;i<=180;i++){
    const u=i/180,angle=u*5.4+t+band*2.3;
    const fold=Math.sin(u*12.5-t*.7+band)*.025+Math.sin(u*23+t*.4)*.006;
    const y=ah*(.27+band*.105+Math.sin(angle)*.085+fold);
    const height=ah*(.14+.065*(1+Math.sin(u*7.1+t*.6+band)));
    const x=u*aw+Math.sin(angle*1.6)*aw*.025;
    points.push({x,y,height,lean:aw*(.035*Math.sin(angle)+.018)});
   }
   for(let strip=0;strip<28;strip++){
    const v=strip/28,v2=Math.min(1,(strip+1.7)/28);
    // A restrained green lower rim with a very faint violet upper fringe.
    const alpha=Math.pow(Math.sin(Math.PI*v),1.5)*(.038+(band===0?.025:0));
    ac.fillStyle=v<.27?`rgba(151,115,209,${alpha*.6})`:`rgba(102,214,161,${alpha})`;
    ac.beginPath();
    points.forEach((p,i)=>{const x=p.x+p.lean*(1-v),y=p.y-p.height*(1-v);if(i===0)ac.moveTo(x,y);else ac.lineTo(x,y)});
    for(let i=points.length-1;i>=0;i--){const p=points[i];ac.lineTo(p.x+p.lean*(1-v2),p.y-p.height*(1-v2))}
    ac.closePath();ac.fill();
   }
   // A soft irregular luminous hem ties the translucent curtain together.
   ac.beginPath();points.forEach((p,i)=>{if(i===0)ac.moveTo(p.x,p.y);else ac.lineTo(p.x,p.y)});
   ac.lineWidth=ah*.006;ac.strokeStyle='rgba(133,236,175,.13)';ac.stroke();
  }
  ac.filter='none';
  // Fade the whole sheet at the lateral boundaries, avoiding hard screen edges.
  ac.globalCompositeOperation='destination-in';
  const edge=ac.createLinearGradient(0,0,aw,0);
  edge.addColorStop(0,'transparent');edge.addColorStop(.1,'white');edge.addColorStop(.88,'white');edge.addColorStop(1,'transparent');
  ac.fillStyle=edge;ac.fillRect(0,0,aw,ah);
  ctx.save();ctx.globalCompositeOperation='screen';ctx.drawImage(auroraCanvas,0,0,w,h);ctx.restore();
  // Quiet reflected colour stays below the mountain horizon.
  ctx.save();ctx.beginPath();ctx.rect(0,h*.84,w,h*.16);ctx.clip();
  glow(w*.53,h*.97,w*.25,'rgba(86,190,153,.055)');ctx.restore();
 }
 function draw(dt){
  ctx.clearRect(0,0,w,h);const s=state,night=s.period==='night';
  // Tint the original photo without losing the mountain and water details.
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,night?'rgba(3,10,40,.91)':s.period==='twilight'?'rgba(40,50,100,.62)':s.cloud>.75?'rgba(55,73,110,.36)':'rgba(255,235,192,.04)');g.addColorStop(.75,night?'rgba(9,21,53,.68)':s.period==='twilight'?'rgba(167,106,119,.25)':'rgba(65,80,108,.04)');g.addColorStop(1,night?'rgba(6,17,44,.72)':'rgba(57,75,102,.08)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  if(night&&s.fresh&&s.cloud<.8){for(const star of stars){ctx.globalAlpha=star.a*(1-s.cloud);ctx.fillStyle='#e8eeff';ctx.beginPath();ctx.arc(star.x*w,star.y*h,star.r,0,7);ctx.fill()}ctx.globalAlpha=1}
  if(s.aurora) drawSoftAurora();
  if(s.sunVisible){const x=w*(.67+Math.sin(s.sun.azimuth)*.17),y=h*Math.max(.12,.62-s.altitude/100);glow(x,y,Math.min(w*.3,280),'rgba(255,226,167,.55)');glow(x,y,70,'rgba(255,239,198,.75)');ctx.fillStyle='#fff6d8';ctx.beginPath();ctx.arc(x,y,15,0,7);ctx.fill();glow(x,h*.94,100,'rgba(255,219,154,.19)')}
  if(s.moonVisible){const r=w<700?17:23,x=w*(.65+Math.sin(s.moon.azimuth)*.16),y=h*Math.max(.12,.58-s.moon.altitude*.5);glow(x,y,r*3,'rgba(215,229,255,.18)');ctx.save();ctx.translate(x,y);ctx.rotate(s.phase.angle-s.moon.parallacticAngle);ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.clip();ctx.fillStyle='#182442';ctx.fillRect(-r,-r,2*r,2*r);const sign=s.phase.phase<.5?1:-1,k=1-2*s.phase.fraction;ctx.fillStyle='#e0e7ef';for(let yy=-r;yy<=r;yy++){const edge=Math.sqrt(Math.max(0,r*r-yy*yy)),terminator=k*edge;ctx.fillRect(sign>0?terminator:-edge,yy,edge-terminator,1.2)}ctx.globalAlpha=.16;ctx.fillStyle='#52657e';for(let i=0;i<12;i++){ctx.beginPath();ctx.arc(Math.sin(i*19)*r*.7,Math.cos(i*13)*r*.7,1+i%4,0,7);ctx.fill()}ctx.restore()}
  if(s.cloud>.03&&s.fresh){ctx.save();ctx.globalAlpha=Math.min(.92,s.cloud);ctx.globalCompositeOperation=night?'source-over':'multiply';for(let i=0;i<3;i++){const cw=Math.max(w,650),x=((elapsed*(3+s.wind*.2)+i*cw*.7)%(cw*2))-cw;ctx.drawImage(cloudCanvas,x,h*(.03+i*.12),cw,h*.36);ctx.drawImage(cloudCanvas,x+cw,h*(.03+i*.12),cw,h*.36)}ctx.restore()}
  if(s.kind==='fog'){ctx.save();ctx.globalAlpha=.7;ctx.drawImage(cloudCanvas,-w*.1+Math.sin(elapsed*.03)*w*.1,h*.25,w*1.4,h*.8);ctx.drawImage(cloudCanvas,-w*.2,h*.45,w*1.6,h*.6);ctx.restore()}
  if(['snow','rain','sleet'].includes(s.kind)){const count=Math.round((w<700?55:100)*(.45+s.intensity*.55)),wind=Math.sin(s.windDirection*Math.PI/180)*s.wind;for(let i=0;i<count;i++){const p=particles[i],rain=s.kind==='rain'||(s.kind==='sleet'&&i%2===0);if(!motion.matches){p.y+=dt*(rain?.75:.035)*p.z;p.x+=dt*wind*.0007*p.z;if(p.y>1.05)p.y=-.05;p.x=(p.x+1)%1}ctx.globalAlpha=.25+p.z*.55;ctx.strokeStyle=night?'#b9cce6':'#849ab4';ctx.fillStyle='#fff';ctx.lineWidth=.5+p.z*.6;const x=p.x*w,y=p.y*h;if(rain){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+wind*.3,y+12+p.z*15);ctx.stroke()}else{ctx.shadowColor='#e4edff';ctx.shadowBlur=p.z>.8?4:0;ctx.beginPath();ctx.arc(x,y,.7+p.z*2,0,7);ctx.fill()}}ctx.globalAlpha=1;ctx.shadowBlur=0}
 }
 function animate(t){frame=0;if(disposed)return;if(!document.hidden&&document.body.dataset.view==='home'){if(t-last>40){const dt=Math.min((t-last)/1000,.1);last=t;elapsed+=dt;draw(dt)}}if(!motion.matches&&!document.hidden)frame=requestAnimationFrame(animate)}
 function resume(){if(disposed)return;if(!frame&&!motion.matches&&!document.hidden)frame=requestAnimationFrame(animate);draw(0)}
 resize();resume();addEventListener('resize',resize);document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);
 return {update(next){state=next;document.body.dataset.sky=next.period;document.body.dataset.weather=next.kind;document.body.dataset.aurora=String(!!next.aurora);draw(0);resume()},dispose(){disposed=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resume);motion.removeEventListener('change',resume);layer.remove()}};
}
