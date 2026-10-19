
/* Product-only, canvas-rendered 3D globe. No changes to Google sync or recipe storage. */
const CATEGORIES=[
  {id:'rolls',name:'Холодные роллы',icon:'🍣',kind:'roll',samples:['Образец ролла 01','Образец ролла 02','Образец ролла 03']},
  {id:'baked',name:'Запечённые',icon:'🍱',kind:'roll',samples:['Запечённый ролл 01','Запечённый ролл 02','Запечённый ролл 03']},
  {id:'sets',name:'Сеты',icon:'🍥',kind:'roll',samples:['Сет 01','Сет 02','Сет 03']},
  {id:'snacks',name:'Закуски',icon:'🥟',kind:'salad',samples:['Закуска 01','Закуска 02','Закуска 03']},
  {id:'onigiri',name:'Онигири',icon:'🍙',kind:'onigiri',samples:['Онигири 01','Онигири 02','Онигири 03']},
  {id:'soups',name:'Супы',icon:'🍜',kind:'soup',samples:['Суп 01','Суп 02','Суп 03']},
  {id:'salads',name:'Салаты',icon:'🥗',kind:'salad',samples:['Салат 01','Салат 02','Салат 03']},
  {id:'semi',name:'Полуфабрикаты',icon:'🥡',kind:'roll',samples:['Полуфабрикат 01','Полуфабрикат 02','Полуфабрикат 03']}
];
// Rough coastline outlines for the stylized projected globe, longitude/latitude degrees.
const LANDS=[
[[-168,66],[-153,71],[-140,69],[-129,58],[-125,50],[-117,47],[-124,41],[-116,32],[-107,30],[-105,24],[-98,18],[-90,15],[-83,9],[-78,14],[-82,22],[-81,29],[-75,35],[-69,44],[-59,48],[-53,56],[-62,60],[-79,58],[-86,67],[-100,72],[-119,72],[-139,69],[-154,71]],
[[-82,13],[-74,12],[-67,10],[-61,6],[-52,3],[-48,-1],[-43,-5],[-35,-7],[-39,-18],[-44,-24],[-48,-30],[-54,-38],[-61,-54],[-68,-55],[-71,-46],[-73,-36],[-77,-25],[-81,-11],[-79,-1],[-82,13]],
[[-75,84],[-46,83],[-18,78],[-39,60],[-52,59],[-57,67],[-67,72],[-75,84]],
[[-11,36],[-17,28],[-15,17],[-17,10],[-12,4],[-7,3],[10,-1],[12,-8],[19,-15],[22,-25],[18,-35],[11,-34],[7,-30],[1,-28],[-2,-21],[-9,-15],[-14,-2],[-17,14],[-11,36]],
[[-10,36],[-11,43],[-5,47],[-10,53],[-3,59],[13,59],[23,63],[29,71],[40,70],[49,59],[43,54],[36,44],[30,41],[28,36],[38,35],[44,40],[46,47],[52,51],[54,57],[63,60],[69,56],[78,56],[82,50],[92,52],[98,58],[113,58],[121,50],[135,48],[140,43],[146,45],[142,52],[157,57],[170,61],[179,65],[168,70],[144,70],[126,73],[103,77],[80,74],[59,71],[37,68],[23,67],[11,60],[2,58],[-11,52],[-10,36]],
[[34,31],[48,29],[56,24],[60,25],[57,17],[50,12],[45,12],[42,16],[38,22],[34,31]],
[[69,23],[75,29],[81,27],[86,21],[89,23],[92,19],[86,10],[81,7],[77,8],[73,17],[69,23]],
[[96,21],[104,22],[108,17],[115,11],[120,6],[117,-3],[111,-7],[108,-6],[105,2],[99,10],[96,21]],
[[112,-12],[121,-14],[129,-12],[135,-14],[145,-17],[153,-24],[150,-32],[142,-38],[132,-35],[125,-34],[116,-29],[112,-22],[112,-12]],
[[44,-13],[50,-15],[49,-25],[46,-26],[43,-18],[44,-13]],
[[-179,-67],[-144,-70],[-115,-69],[-85,-73],[-54,-70],[-12,-72],[35,-69],[80,-73],[119,-69],[150,-73],[180,-67]]
];
const RAD=Math.PI/180;
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function categorize(name){
 const t=String(name||'').toLowerCase();
 if(/полуфаб|заготов/.test(t))return 'semi';
 if(/онигири/.test(t))return 'onigiri';
 if(/запеч/.test(t))return 'baked';
 if(/набор|сет/.test(t))return 'sets';
 if(/закуск|темпур|наггет|фри|дог/.test(t))return 'snacks';
 if(/суп|том ям|рамэн|мисо/.test(t))return 'soups';
 if(/салат|поке/.test(t))return 'salads';
 return 'rolls';
}
function photoUrl(recipe){
 const p=recipe?.photoUrl||recipe?.photo?.url||recipe?.photo?.dataUrl||recipe?.imageUrl||recipe?.image||recipe?.photo;
 if(typeof p!=='string')return '';
 if(/^https?:\/\//i.test(p)||p.startsWith('/assets/')||/^data:image\/(?:png|webp|jpeg|gif);base64,/i.test(p))return p;
 return '';
}
function addButton(parent,cls,label,onClick){
 const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',onClick);parent.append(b);return b;
}
export function mountStarkShowroom({host,getRecipes=()=>[],onOpenRecipes=()=>{}}={}){
 if(!host)throw new Error('Missing home element for Stark showroom');
 const root=document.createElement('div');root.className='stark-showroom';root.innerHTML=
  '<header class="ss-head"><div class="ss-eyebrow">FARUKH AI · PREMIUM STARK V4</div><h1>Товары <span>в новом измерении</span></h1><p>Вращайте планету пальцем. Коснитесь категории, чтобы увидеть товары.</p></header>'+
  '<section class="ss-portal" tabindex="0" aria-label="Поверните планету стрелками клавиатуры или проведите пальцем. Категории товаров — отдельные кнопки.">'+
  '<canvas aria-hidden="true"></canvas><div class="ss-ring" aria-hidden="true"></div><div class="ss-ring second" aria-hidden="true"></div>'+
  '<div class="ss-markers" aria-label="Категории товаров"></div>'+
  '<div class="ss-hud"><span class="ss-hud-dot"></span>ГОЛОГРАФИЧЕСКАЯ ВИТРИНА</div>'+
  '<div class="ss-controls"><button type="button" class="ss-small-btn ss-reset" aria-label="Вернуть исходное положение">⟲ Сброс</button><button type="button" class="ss-small-btn ss-pause" aria-label="Остановить автоматическое вращение" aria-pressed="false">Ⅱ Пауза</button></div></section>'+
  '<section class="ss-showcase" aria-label="Виртуальный стол с товарами">'+
  '<div class="ss-showcase-title">ВИТРИНА ОБРАЗЦОВ</div><h2 class="ss-category-name">Холодные роллы</h2>'+
  '<div class="ss-deck" aria-label="Вращающиеся образцы выбранной категории">'+
  '<div class="ss-disc" aria-hidden="true"></div><div class="ss-items"></div></div>'+
  '<p class="ss-selected-caption" aria-live="polite">Выберите товар на столе, чтобы посмотреть его.</p>'+
  '<button type="button" class="ss-ttk">Открыть товары и техкарты ↗</button>'+
  '<p class="ss-footnote">Пока стоят демонстрационные образцы — ваши фотографии добавим позже.</p></section>';
 host.prepend(root);
 const portal=root.querySelector('.ss-portal'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:true});
 const markers=root.querySelector('.ss-markers'),deck=root.querySelector('.ss-deck'),items=root.querySelector('.ss-items');
 const title=root.querySelector('.ss-category-name'),caption=root.querySelector('.ss-selected-caption');
 const pause=root.querySelector('.ss-pause');
 root.querySelector('.ss-ttk').addEventListener('click',onOpenRecipes);
 let yaw=0.31,pitch=0.06,orbit=0,tableOrbit=0,velocityX=0,velocityY=0,paused=false;
 let selected=0,chosenItem=-1,drag=null,deckDrag=null,lastTime=0,lastDraw=0,landProducts=[],draggedUntil=0,deckDraggedUntil=0;
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
 if(reduceMotion.matches){paused=true;pause.textContent='▶ Вращать';pause.setAttribute('aria-pressed','true')}
 const buttons=CATEGORIES.map((c,i)=>{
  const b=document.createElement('button');b.type='button';b.className='ss-marker';
  b.setAttribute('aria-pressed',i===selected?'true':'false');
  const ico=document.createElement('span');ico.className='ss-mark';ico.textContent=c.icon;ico.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.textContent=c.name;b.append(ico,label);
  b.addEventListener('click',()=>{if(performance.now()>=draggedUntil)select(i)});markers.append(b);return b;
 });
 function getProducts(i){
  const category=CATEGORIES[i];const matched=landProducts.filter(p=>categorize(p.category||p.name||'')===category.id);
  if(matched.length)return matched.slice(0,5).map((p,n)=>({label:String(p.name||'Товар '+(n+1)),image:photoUrl(p),kind:category.kind}));
  return category.samples.map(s=>({label:s,kind:category.kind,image:''}));
 }
 function select(i){
  selected=i;chosenItem=-1;title.textContent=CATEGORIES[i].name;
  buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
  caption.textContent='Коснитесь образца, чтобы рассмотреть товар.';
  items.replaceChildren();
  getProducts(i).forEach((p,j)=>{
    const item=document.createElement('button');item.type='button';item.className='ss-item';item.setAttribute('aria-pressed','false');
    item.setAttribute('aria-label',p.label);
    if(p.image){const img=document.createElement('img');img.src=p.image;img.alt='';img.loading='lazy';img.onerror=()=>{img.remove();const placeholder=document.createElement('div');placeholder.className='ss-food ss-food-'+p.kind;item.prepend(placeholder)};item.append(img)}
    else{const food=document.createElement('div');food.className='ss-food ss-food-'+p.kind;food.setAttribute('aria-hidden','true');item.append(food)}
    const text=document.createElement('span');text.textContent=p.label;item.append(text);
    item.addEventListener('click',()=>{if(performance.now()<deckDraggedUntil)return;chosenItem=j;items.querySelectorAll('button').forEach((x,k)=>x.setAttribute('aria-pressed',String(j===k)));caption.textContent=p.label+(p.image?' · Фотография товара':' · Фото заменим на ваше, когда пришлёте')});
    items.append(item);
  });
  positionTable();
 }
 function project(lon,lat,r,cx,cy){
  const a=lon*RAD+yaw, b=lat*RAD;
  const x=Math.cos(b)*Math.sin(a), y=Math.sin(b), z=Math.cos(b)*Math.cos(a);
  const yr=y*Math.cos(pitch)-z*Math.sin(pitch), zr=y*Math.sin(pitch)+z*Math.cos(pitch);
  return {x:cx+r*x,y:cy-r*yr,z:zr};
 }
 function drawGlobe(w,h,t){
  if(!ctx)return;
  ctx.clearRect(0,0,w,h);
  const cx=w*.5,cy=h*.44,r=Math.min(w*.228,h*.31,225);
  const aura=ctx.createRadialGradient(cx,cy,r*.65,cx,cy,r*1.68);
  aura.addColorStop(0,'#e62c481f');aura.addColorStop(.68,'#c7282a10');aura.addColorStop(1,'#ae263200');
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(cx,cy,r*1.68,0,Math.PI*2);ctx.fill();
  const ocean=ctx.createRadialGradient(cx-r*.31,cy-r*.38,r*.07,cx+r*.2,cy+r*.1,r*1.25);
  ocean.addColorStop(0,'#a9384d');ocean.addColorStop(.25,'#451e32');ocean.addColorStop(.7,'#17111f');ocean.addColorStop(1,'#080a12');
  ctx.fillStyle=ocean;ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r-.4,0,Math.PI*2);ctx.clip();
  function polyLine(coords,stroke,width=1){
   ctx.beginPath();let open=false;
   for(const [lon,lat] of coords){const p=project(lon,lat,r,cx,cy);if(p.z>=0){if(!open){ctx.moveTo(p.x,p.y);open=true}else ctx.lineTo(p.x,p.y)}else open=false}
   ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();
  }
  for(let lat=-75;lat<=75;lat+=15){const a=[];for(let lon=-180;lon<=180;lon+=3)a.push([lon,lat]);polyLine(a,'#ff637422',.7)}
  for(let lon=-180;lon<180;lon+=20){const a=[];for(let lat=-89;lat<=89;lat+=2)a.push([lon,lat]);polyLine(a,'#ff698026',.7)}
  for(const land of LANDS){
   // Subdivide edges for a smoother projection while retaining the light-weight low-poly look.
   const outline=[];for(let i=0;i<land.length-1;i++){const a=land[i],b=land[i+1];for(let k=0;k<6;k++){const u=k/6;outline.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u])}}outline.push(land[land.length-1]);
   const forward=outline.map(p=>project(p[0],p[1],r,cx,cy)).filter(p=>p.z>.01);
   if(forward.length>2){
    ctx.beginPath();ctx.moveTo(forward[0].x,forward[0].y);for(const p of forward.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();
    ctx.fillStyle='#b32b42b0';ctx.fill();ctx.strokeStyle='#ff718bba';ctx.lineWidth=1.1;ctx.stroke();
   }
  }
  const sheen=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
  sheen.addColorStop(0,'#ffb3ba55');sheen.addColorStop(.47,'#ffb3ba00');sheen.addColorStop(1,'#060711aa');
  ctx.fillStyle=sheen;ctx.fillRect(cx-r,cy-r,2*r,2*r);ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.lineWidth=2;ctx.strokeStyle='#e95164ce';ctx.shadowColor='#e2224c';ctx.shadowBlur=26;ctx.stroke();ctx.shadowBlur=0;
  const ring=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
  ring.addColorStop(0,'#ca253d28');ring.addColorStop(.5,'#ff849760');ring.addColorStop(1,'#ca253d28');
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-.18);ctx.scale(1,.29);ctx.beginPath();ctx.arc(0,0,r*1.35,0,2*Math.PI);ctx.strokeStyle=ring;ctx.lineWidth=3;ctx.stroke();ctx.restore();
  for(let k=0;k<18;k++){const a=k*2.399+t*.0001,rr=r*(1.15+.42*(k%3)/3);const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr*.75;ctx.globalAlpha=.16+.12*(Math.sin(t/900+k)+1);ctx.fillStyle='#f6455f';ctx.fillRect(x,y,1.3,1.3)}
  ctx.globalAlpha=1;
 }
 function placeMarkers(){
  const w=portal.clientWidth,h=portal.clientHeight,rx=Math.min(w*.39,385),ry=h*.375;
  buttons.forEach((b,i)=>{
   const a=i*2*Math.PI/buttons.length+orbit;
   const depth=Math.cos(a), x=w*.5+Math.sin(a)*rx, y=h*.44+Math.cos(a)*ry*.48+Math.sin(a)*ry*.54*Math.sin(pitch*.5+.3);
   b.style.left=x+'px';b.style.top=y+'px';b.style.zIndex=String(20+Math.round(12*depth));b.style.opacity=String(.65+.35*(depth+1)/2);
   b.style.scale=String(.82+.17*(depth+1)/2);
  });
 }
 function positionTable(){
  const list=items.querySelectorAll('.ss-item'),n=list.length;if(!n)return;
  const w=deck.clientWidth,h=deck.clientHeight,rx=Math.min(w*.34,250),ry=Math.min(h*.20,58);
  list.forEach((el,i)=>{
   const a=i*2*Math.PI/n+tableOrbit,depth=Math.sin(a);
   const x=Math.cos(a)*rx,y=Math.sin(a)*ry;
   el.style.left=(w/2+x)+'px';el.style.top=(h*.48+y)+'px';
   el.style.transform='translate(-50%,-50%) scale('+(0.82+(depth+1)*.12)+')';
   el.style.zIndex=String(30+Math.round(depth*10));
  });
 }
 function frame(ts){
  const dt=Math.min(55,Math.max(0,ts-(lastTime||ts)));lastTime=ts;
  if(!document.hidden&&document.body.dataset.view==='home'&&root.isConnected){
   if(!paused){
    yaw+=dt*.00018;orbit+=dt*.00022;tableOrbit+=dt*.00024;
    yaw+=velocityX*dt;pitch=clamp(pitch+velocityY*dt,-.82,.82);
    velocityX*=Math.pow(.92,dt/16);velocityY*=Math.pow(.92,dt/16);
   }
   placeMarkers();positionTable();
   if(ts-lastDraw>33){drawGlobe(canvas.clientWidth,canvas.clientHeight,ts);lastDraw=ts}
  }
  requestAnimationFrame(frame);
 }
 let dpr=1;
 function resize(){
  const w=Math.max(1,Math.round(portal.clientWidth)),h=Math.max(1,Math.round(portal.clientHeight));
  dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  ctx?.setTransform(dpr,0,0,dpr,0,0);
  placeMarkers();positionTable();drawGlobe(w,h,performance.now());
 }
 portal.addEventListener('pointerdown',e=>{
  if(e.target.closest('.ss-controls'))return;
  drag={x:e.clientX,y:e.clientY,t:performance.now(),moved:false};velocityX=0;velocityY=0;
  const target=e.target.closest('.ss-marker')||portal;target.setPointerCapture(e.pointerId);
 });
 portal.addEventListener('pointermove',e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y,dt=Math.max(12,performance.now()-drag.t);
  if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;
  yaw+=dx*.006;orbit+=dx*.006;pitch=clamp(pitch+dy*.004,-.82,.82);
  velocityX=clamp(dx*.006/dt,-.015,.015);velocityY=clamp(dy*.004/dt,-.009,.009);
  drag.x=e.clientX;drag.y=e.clientY;drag.t=performance.now();placeMarkers();drawGlobe(canvas.clientWidth,canvas.clientHeight,performance.now());
 });
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])portal.addEventListener(evt,()=>{if(drag?.moved)draggedUntil=performance.now()+230;drag=null});
 portal.addEventListener('keydown',e=>{
  const actions={ArrowLeft:[-.19,0],ArrowRight:[.19,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]};
  if(!actions[e.key])return;e.preventDefault();
  yaw+=actions[e.key][0];orbit+=actions[e.key][0];pitch=clamp(pitch+actions[e.key][1],-.82,.82);
  placeMarkers();drawGlobe(canvas.clientWidth,canvas.clientHeight,performance.now());
 });
 const reset=root.querySelector('.ss-reset');
 reset.addEventListener('click',()=>{yaw=.31;pitch=.06;orbit=0;tableOrbit=0;velocityX=0;velocityY=0;placeMarkers();positionTable()});
 pause.addEventListener('click',()=>{paused=!paused;pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'▶ Вращать':'Ⅱ Пауза'});
 deck.addEventListener('pointerdown',e=>{deckDrag={x:e.clientX,moved:false};(e.target.closest('.ss-item')||deck).setPointerCapture(e.pointerId)});
 deck.addEventListener('pointermove',e=>{if(!deckDrag)return;const dx=e.clientX-deckDrag.x;if(Math.abs(dx)>3)deckDrag.moved=true;tableOrbit+=dx*.008;deckDrag.x=e.clientX;positionTable()});
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])deck.addEventListener(evt,()=>{if(deckDrag?.moved)deckDraggedUntil=performance.now()+230;deckDrag=null});
 function updateRecipes(recipes){landProducts=Array.isArray(recipes)?recipes.filter(p=>p&&p.name):[];select(selected)}
 try{landProducts=getRecipes()||[]}catch{}
 select(0);
 if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(portal);
 else window.addEventListener('resize',resize);
 resize();requestAnimationFrame(frame);
 return {updateRecipes,selectCategory:id=>{const i=CATEGORIES.findIndex(c=>c.id===id);if(i>=0)select(i)}};
}
