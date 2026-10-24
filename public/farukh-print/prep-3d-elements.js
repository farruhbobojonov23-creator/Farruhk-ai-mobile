/* FARUKH PRINT · 3D-style vector ingredient elements.
   Catalogue visuals only: never replace photos in the database and never
   change expiration dates, TTK, labels, cloud sync or thermal printing.
   Original artwork composed of SVG gradients/shapes; no external images. */
(()=>{
'use strict';
const normalize=x=>String(typeof x==='string'?x:x?.name||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const cache=new Map();
const defs='<defs>'+
'<linearGradient id="orange" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#ffe8c6"/><stop offset=".37" stop-color="#ffae74"/><stop offset=".75" stop-color="#ff7140"/><stop offset="1" stop-color="#ca3b27"/></linearGradient>'+
'<linearGradient id="salmon" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fff1cb"/><stop offset=".25" stop-color="#ffbe83"/><stop offset=".7" stop-color="#ff733d"/><stop offset="1" stop-color="#e94f2d"/></linearGradient>'+
'<linearGradient id="green" x1=".1" y1="0" x2=".8" y2="1"><stop stop-color="#e7ff9c"/><stop offset=".34" stop-color="#8bd72d"/><stop offset=".8" stop-color="#2d993a"/><stop offset="1" stop-color="#176731"/></linearGradient>'+
'<linearGradient id="leaf" x1="0" y1="0" x2=".95" y2=".9"><stop stop-color="#d9ffa6"/><stop offset=".48" stop-color="#56b850"/><stop offset="1" stop-color="#1c7035"/></linearGradient>'+
'<linearGradient id="cream" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fffefa"/><stop offset=".45" stop-color="#fff2d9"/><stop offset="1" stop-color="#d6bd9f"/></linearGradient>'+
'<linearGradient id="white" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#f5f7f5"/><stop offset="1" stop-color="#cbd2d1"/></linearGradient>'+
'<linearGradient id="pink" x1=".1" y1=".1" x2=".9" y2="1"><stop stop-color="#ffe7e2"/><stop offset=".47" stop-color="#ffaab6"/><stop offset=".96" stop-color="#d94c77"/></linearGradient>'+
'<linearGradient id="red" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#ffd3b1"/><stop offset=".35" stop-color="#f65945"/><stop offset="1" stop-color="#bd2130"/></linearGradient>'+
'<linearGradient id="yellow" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fffec1"/><stop offset=".45" stop-color="#ffd752"/><stop offset="1" stop-color="#ed991b"/></linearGradient>'+
'<linearGradient id="brown" x1=".1" y1="0" x2=".85" y2=".95"><stop stop-color="#efb978"/><stop offset=".4" stop-color="#96542f"/><stop offset=".79" stop-color="#4d261e"/><stop offset="1" stop-color="#241e20"/></linearGradient>'+
'<linearGradient id="dark" x1=".1" y1=".1" x2=".9" y2="1"><stop stop-color="#b4d2d1"/><stop offset=".35" stop-color="#526d73"/><stop offset="1" stop-color="#273b4c"/></linearGradient>'+
'<linearGradient id="bowl" x1=".1" y1="0" x2=".9" y2=".95"><stop stop-color="#fff"/><stop offset=".45" stop-color="#fff"/><stop offset=".8" stop-color="#e8edf0"/><stop offset="1" stop-color="#b6c4cb"/></linearGradient>'+
'<radialGradient id="soup" cx=".37" cy=".25" r=".87"><stop stop-color="#ffb16d"/><stop offset=".52" stop-color="#ed5d2a"/><stop offset="1" stop-color="#a52420"/></radialGradient>'+
'<filter id="shadow" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>'+
'<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>'+
'</defs>';
const ellipse=(x,y,rx,ry,fill,stroke='',sw=1)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+sw+'"':'')+'/>';
const path=(d,fill,stroke='',sw=1)=>'<path d="'+d+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linejoin="round" stroke-linecap="round"':'')+'/>';
const shine=(x,y,rx,ry,opacity=.6)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" transform="rotate(-19 '+x+' '+y+')" fill="#fff" opacity="'+opacity+'" filter="url(#glow)"/>';
const layer=(body,x=0,y=0,rot=0,scale=1)=>'<g transform="translate('+x+' '+y+') rotate('+rot+') scale('+scale+')">'+body+'</g>';
const leaf=(x,y,r=0,s=1)=>layer(path('M0 0 Q-18 -28 4 -50 Q25 -24 0 0Z','url(#leaf)','#3b8f43',1)+path('M0 0 Q2 -26 4 -48','none','#e4ffb0',1.8),x,y,r,s);
const cucumber=()=>{
 let a=layer('<rect x="-75" y="-26" width="150" height="68" rx="30" fill="url(#green)" stroke="#2a8335" stroke-width="3"/>'+
  '<path d="M-53 -18 Q10 -40 59 -11" stroke="#fff" stroke-width="7" opacity=".34" fill="none"/>'+ellipse(72,7,13,34,'url(#green)','#28752f',2),122,92,-20,1);
 for(let i=0;i<4;i++){const x=77+i*28,y=113-i*5;let disc=ellipse(0,0,33,31,'url(#green)','#2a913c',3)+ellipse(0,0,27,26,'#e8ffad','#b8e474',2)+ellipse(0,0,9,9,'#d4f8b1')+Array.from({length:5},(_,k)=>ellipse(Math.cos(k*1.26)*17,Math.sin(k*1.26)*14,4,2,'#c0e9a0')).join('')+shine(-10,-13,11,5,.54);a+=layer(disc,x,y,0,.9)}
 return a;
};
const shrimp=()=>{
 let a='';
 for(const [x,y,r,s] of [[80,113,-31,.85],[147,105,22,.86]]){
 const t=path('M-33 -32 C-68 13 -33 53 12 43 C50 34 58 6 43 -15','none','#bd593f',30)+
 path('M-33 -32 C-68 13 -33 53 12 43 C50 34 58 6 43 -15','none','url(#orange)',25)+
 path('M38 -22 Q52 -55 68 -50 L58 -16 L83 -29 Q74 -3 46 -3Z','url(#red)','#c85030',2)+
 Array.from({length:5},(_,k)=>path('M'+(-43+k*14)+' '+(1+k*7)+' l9 -11','none','#ffe0c3',3)).join('')+
 shine(-39,-10,10,5,.8);
 a+=layer(t,x,y,r,s)
 }return a+leaf(177,78,29,.8);
};
const crab=()=>Array.from({length:3},(_,i)=>{
 const t='<rect x="-76" y="-13" width="153" height="33" rx="8" fill="url(#white)" stroke="#e6d8d1" stroke-width="1.5"/>'+
 '<path d="M-67 -11 H66" stroke="#f35b61" stroke-width="9" stroke-linecap="round"/>'+
 '<path d="M-68 -4 H65 M-68 6 H65" stroke="#f7646b" stroke-width="3" opacity=".87"/>'+
 '<path d="M-53 15 H57" stroke="#fff" stroke-width="5" opacity=".9"/>';
 return layer(t,131,88+i*19,i%2?18:-15,1)
}).join('');
const fillet=(eel=false)=>{
 let b=path('M-88 -35 Q-62 -56 55 -38 L84 -16 L91 25 Q10 56 -80 31Z',eel?'url(#brown)':'url(#salmon)',eel?'#4a291d':'#da593c',2);
 if(eel)b+=path('M-78 -22 Q-2 -48 75 -14 L80 3 Q-4 0 -73 8Z','#d78f49')+
  Array.from({length:9},(_,i)=>ellipse(-64+i*16,-5+(i%3)*4,2.5,1.8,'#f7d5a5')).join('');
 else b+=Array.from({length:7},(_,i)=>path('M'+(-70+i*22)+' -30 Q'+(-84+i*23)+' 3 '+(-65+i*22)+' 31','none','#ffe1ca',3)).join('');
 return layer(b+shine(-42,-21,33,5,.38),130,98,-11,1);
};
const avocado=()=>{
 let b=layer(ellipse(0,0,63,55,'#205d35')+ellipse(0,-2,55,47,'url(#green)')+
 ellipse(0,-3,44,36,'#f0f8a1')+ellipse(12,4,20,20,'url(#brown)')+shine(-27,-18,19,8,.3),110,92,-20,1);
 for(let i=0;i<4;i++)b+=layer(ellipse(0,0,25,36,'url(#green)','#45954a',2)+ellipse(-2,0,20,29,'#eff4a7'),162+i*13,116+i*3,18,1-i*.09);
 return b;
};
const bowl=(color='url(#soup)',garnish='')=>{
 return ellipse(130,123,85,41,'url(#bowl)','#cdd7dd',2)+path('M48 112 Q59 175 130 177 Q207 174 214 112 Q176 145 130 146 Q74 145 48 112Z','url(#bowl)','#ccd4da',2)+
 ellipse(131,111,87,40,'#f2f5f7','#d4dee3',2)+ellipse(131,108,77,31,color)+
 ellipse(110,93,39,8,'#fff','',0).replace('fill="#fff"','fill="#fff" opacity=".15"')+
 garnish+path('M66 143 Q113 178 177 149','none','#fff',5);
};
const herb=()=>leaf(138,112,-20,.35)+leaf(141,115,27,.35)+path('M140 116 Q151 103 158 99','none','#246f39',2);
const mushrooms=()=>{
 let a='';for(const [x,y,r,s] of [[80,112,-23,.95],[157,111,19,1],[122,94,-5,.75]]){
 const m=path('M-15 2 L-13 48 Q0 62 14 48 L13 2Z','url(#cream)','#d4c4b1',1.4)+
 path('M-55 10 Q-49 -49 0 -55 Q52 -42 56 10 Q0 38 -55 10Z','url(#cream)','#b9a38c',2)+
 path('M-37 5 Q4 -19 37 7','none','#fff',8)+ellipse(0,11,35,8,'#ded0bc');
 a+=layer(m,x,y,r,s);
 }return a+leaf(196,118,45,.45);
};
const strands=(color,count=14)=>{
 let b='';for(let i=0;i<count;i++){
 const x=68+(i*17)%128,y=105+Math.floor(i/5)*12,r=-34+(i*23)%72;
 b+=layer('<rect x="-42" y="-5" width="84" height="10" rx="5" fill="'+color+'" stroke="#e7e4cf" stroke-width=".6"/>'+
 path('M-34 -2 H31','none','#fff',1.6),x,y,r,1);
 }return b+leaf(195,99,35,.42);
};
const ginger=()=>{
 let b='';for(let i=0;i<8;i++){const x=120+Math.cos(i*2.4)*31,y=103+Math.sin(i*2.4)*23;
 b+=layer(path('M-23 23 Q-47 -9 -12 -43 Q3 -53 16 -31 Q37 -3 24 25 Q0 12 -23 23Z','url(#pink)','#f1a4af',1.5)+shine(-12,-22,12,6,.45),x,y,i*30,.72)
 }return b;
};
const squid=()=>Array.from({length:5},(_,i)=>{
 const cx=92+(i%3)*32,cy=119-Math.floor(i/3)*31;
 return layer(ellipse(0,0,37,22,'url(#cream)','#d6c9b8',2)+ellipse(0,-2,22,12,'#fff','#e9d9c4',2)+shine(-15,-8,12,3,.45),cx,cy,(i*31)%60-25,.95);
}).join('')+leaf(190,100,25,.45);
const roe=()=>{
 let b=bowl('url(#orange)');
 for(let i=0;i<60;i++){
 const x=65+(i*37)%131,y=85+Math.floor(i/15)*11+Math.sin(i*2)*2;
 if((x-131)**2/80**2+(y-110)**2/34**2>1)continue;
 b+=ellipse(x,y,4,4,'url(#orange)','#ec7217',.6)+ellipse(x-1.2,y-1.2,1.3,1.1,'#fff3bb');
 }return b;
};
const lettuce=()=>Array.from({length:8},(_,i)=>leaf(128+(i%4-1.5)*29,130+Math.floor(i/4)*14,(i*43)%130-60,.85)).join('');
const toms=()=>Array.from({length:5},(_,i)=>layer(ellipse(0,0,24,22,'url(#red)','#ad2f2c',1.5)+
 path('M-13 0 Q0 -14 14 0 Q0 14 -13 0Z','#ffd39a')+ellipse(0,-17,6,3,'url(#leaf)'),81+(i%3)*44,101+Math.floor(i/3)*34,(i*35)%70-30,1)).join('');
const omelet=()=>Array.from({length:3},(_,i)=>layer('<rect x="-39" y="-22" width="76" height="51" rx="11" fill="url(#yellow)" stroke="#d8a13a" stroke-width="2"/>'+
 ellipse(-4,5,23,17,'url(#cream)','#e1a755',2)+ellipse(-4,5,10,8,'url(#yellow)')+
 path('M-27 -14 H24','none','#fff4ae',5),89+i*38,113-i*10,-9,1)).join('');
const chicken=()=>Array.from({length:3},(_,i)=>layer(path('M-52 -12 Q-35 -41 9 -28 Q52 -30 55 9 Q40 30 -17 29 Q-60 20 -52 -12Z','url(#cream)','#bf9e74',2)+
 path('M-35 -9 Q-4 -28 38 -6','none','#fff',6)+path('M-30 16 Q3 23 37 9','none','#d1a77b',3),86+(i%3)*32,115-(i%2)*14,(i-1)*14,.8)).join('');
const mussel=()=>Array.from({length:4},(_,i)=>layer(path('M0 -41 Q40 -20 31 15 Q14 48 -6 50 Q-35 14 0 -41Z','url(#dark)','#263d4c',2)+
 path('M0 -35 Q20 -5 17 18 Q1 32 -7 14Z','url(#yellow)')+
 path('M-9 -9 Q-5 -26 0 -33','none','#e8f1ed',2),76+(i%3)*46,110+Math.floor(i/3)*27,i*35-35,.8)).join('');
const lime=()=>Array.from({length:4},(_,i)=>layer(ellipse(0,0,29,28,'url(#green)','#278e42',2)+ellipse(0,0,24,22,'#f8ffd7')+
 Array.from({length:7},(_,k)=>path('M0 0 L'+Math.cos(k*6.28/7)*23+' '+Math.sin(k*6.28/7)*21,'none','#b3db61',2)).join('')+shine(-10,-13,12,4,.35),82+i*28,110-i*9,(i%2)*23-14,.8)).join('');
const pepper=()=>Array.from({length:4},(_,i)=>layer(path('M-20 -31 Q9 -53 34 -24 Q49 18 0 38 Q-42 26 -20 -31Z','url(#red)','#bb3d2e',2)+
 path('M-12 -14 Q8 -34 21 -12 Q31 10 3 23 Q-21 15 -12 -14Z','#fff8db')+
 shine(-20,-26,10,4,.45),77+i*35,120-(i%2)*18,i*22-35,.72)).join('');
const seaweed=()=>Array.from({length:12},(_,i)=>layer(path('M-12 30 Q-33 -12 1 -42 Q28 -11 13 26Z','url(#leaf)','#32754a',1)+
 path('M-2 -36 Q9 -10 1 23','none','#caff9a',2),82+(i%5)*25,118+Math.floor(i/5)*8,(i*57)%120-60,.65)).join('');
const takuan=()=>Array.from({length:5},(_,i)=>layer('<rect x="-40" y="-17" width="80" height="34" rx="9" fill="url(#yellow)" stroke="#dcaa31" stroke-width="2"/>'+
 path('M-31 -8 H25','none','#fff6a7',5),87+i*24,109+(i%2)*18,-25+i*11,.68)).join('');
function imageFor(name){
 const n=normalize(name);
 if(n==='креветка')return shrimp();
 if(n==='огурцы'||n==='огурцы (нарезка)')return cucumber();
 if(n==='снежный краб')return crab();
 if(n==='угорь')return fillet(true);
 if(n==='форель'||n.includes('лосось'))return fillet();
 if(n.includes('авокадо'))return avocado();
 if(n==='бульон том ям')return bowl('url(#soup)',herb()+ellipse(101,105,14,7,'#eab774')+ellipse(176,115,11,5,'#fff0cb'));
 if(n.includes('грибы'))return mushrooms();
 if(n.includes('дайкон'))return strands('url(#white)');
 if(n.includes('масага')||n.includes('масаго')||n.includes('тобико'))return roe();
 if(n.includes('имбирь'))return ginger();
 if(n.includes('кальмар'))return squid();
 if(n.includes('капуста'))return lettuce();
 if(n.includes('такуан'))return takuan();
 if(n.includes('курица'))return chicken();
 if(n.includes('перец'))return pepper();
 if(n.includes('омлет'))return omelet();
 if(n.includes('морковь'))return strands('url(#orange)');
 if(n.includes('лук зелен'))return strands('url(#green)')+leaf(195,91,-20,.5);
 if(n.includes('лайм')||n.includes('лимон'))return lime();
 if(n.includes('мидии'))return mussel();
 if(n.includes('чука')||n.includes('вакаме'))return seaweed();
 if(n.includes('томаты')||n.includes('черри'))return toms();
 if(n.includes('сыр')||n.includes('сливочный сыр')||n.includes('начинка'))return bowl('url(#cream)',shine(108,101,39,8,.75));
 if(n.includes('соус')||n.includes('спайси')||n.includes('чили')||n.includes('терияки')){
  const sweet=n.includes('чили'),spicy=n.includes('спайси'),tomyum=n.includes('том ям');
  const unagi=n.includes('унаги')||n.includes('терияки');
  const color=unagi?'url(#brown)':spicy||tomyum||sweet?'url(#soup)':'url(#cream)';
  const garnish=spicy||sweet||tomyum?Array.from({length:10},(_,i)=>ellipse(72+i*11,107+(i%3)*7,2,2,'#d53526')).join(''):'';
  return bowl(color,garnish);
 }
 return null;
}
function svg(body){
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 190" width="520" height="380" role="img">'+
 defs+
 ellipse(131,166,76,11,'#8c96a4').replace('fill="#8c96a4"','fill="#8c96a4" opacity=".23" filter="url(#shadow)"')+
 body+'</svg>';
}
window.FarukhPrep3DElements=Object.freeze({
 version:'1.0',find(p){
  const key=normalize(p);
  if(cache.has(key))return cache.get(key);
  const art=imageFor(key);
  if(!art)return null;
  const item={url:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(art)),studio:true,threeD:true};
  cache.set(key,item);
  return item;
 }
});
})();