
/* Product-only interactive 3D textured Earth. No changes to Google sync or recipe storage. */
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

const SAMPLE_PHOTOS={
 rolls:['cold.png','maki.png','sushi.png'],
 baked:['baked.png','gunkan.png'],
 sets:['cold.png','maki.png','sushi.png'],
 snacks:['snacks.png','tempura.png','beridog.png'],
 onigiri:['onigiri.png'],
 semi:[],
 soups:[],
 salads:[]
};
// Product photographs were already bundled with FARUKH AI. They are display-only
// samples, never written into a real recipe. Matte removal runs once per asset, offscreen.
const cutoutCache=new Map();
function sampleCutout(src){
 if(cutoutCache.has(src))return cutoutCache.get(src);
 const promise=(async()=>{
  const image=new Image();image.src=src;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=280;canvas.height=280;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Canvas 2D unavailable');
  ctx.drawImage(image,0,0,280,280);
  const pixels=ctx.getImageData(0,0,280,280);
  for(let i=0;i<pixels.data.length;i+=4){
   const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
   const strength=Math.max(r,g,b);
   // Only remove near-black studio backdrops; preserve food, rice and seaweed.
   const opacity=Math.max(0,Math.min(1,(strength-9)/33));
   pixels.data[i+3]=Math.round(pixels.data[i+3]*opacity);
  }
  ctx.putImageData(pixels,0,0);
  return canvas.toDataURL('image/webp',.88);
 })().catch(()=>src);
 cutoutCache.set(src,promise);
 return promise;
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
export function mountStarkShowroom({host,getRecipes=()=>[],onOpenRecipes=()=>{},onOpenChat=()=>{},onNavigate=()=>{}}={}){
 if(!host)throw new Error('Missing home element for Stark showroom');
 const root=document.createElement('div');root.className='stark-showroom';root.innerHTML=
  '<header class="ss-head"><div class="ss-eyebrow">FARRUKH AI · PREMIUM EDITION</div><h1>Ваша кухня <span>под контролем</span></h1><p>Выберите раздел или вращайте глобус — все категории и товары у вас под рукой.</p></header>'+
  '<section class="ss-portal" tabindex="0" aria-label="Поверните планету стрелками клавиатуры или проведите пальцем. Категории товаров — отдельные кнопки.">'+
  '<div class="ss-world" aria-hidden="true"><span class="ss-world-shine"></span></div><div class="ss-ring" aria-hidden="true"></div><div class="ss-ring second" aria-hidden="true"></div>'+
  '<div class="ss-markers" aria-label="Категории товаров"></div>'+ 
  '<aside class="ss-sideinfo" aria-label="Время и погода"><small>ВРЕМЯ ШЕФА</small><strong class="ss-clock">--:--</strong><small class="ss-weather">Погода: —</small></aside>'+ 
  '<aside class="ss-side-ai" aria-label="Помощник"><span class="ss-ai-icon">✦</span><strong>FARUKH AI</strong><small>Ваш помощник</small><button class="ss-chat" type="button">Открыть ассистента ↗</button></aside>'+ 
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
 // Real navigation shortcuts in the approved premium mockup: each goes to a working module.
 // No invented orders, finance or warehouse screens.
 const shortcuts=[
  ['Техкарты','recipes','<path d="M5 17h14M6 17V8a6 6 0 0 1 12 0v9M9 8V5m6 3V5M4 20h16"/>'],
  ['ХАССП','lab','<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>'],
  ['Заготовки','preparations','<path d="m3 7 9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>'],
  ['Калькулятор','calc','<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2"/>'],
  ['Контроль','checks','<path d="M8 4h12v18H4V4h4m0-2h8v4H8zM8 11l2 2 4-4M8 18h8"/>'],
  ['Задачи','tasks','<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 3 3 6-7"/>'],
  ['Ассистент','chat','<path d="M4 5h16v13H9l-5 4V5zM8 10h8M8 14h5"/>'],
  ['Настройки','settings','<circle cx="12" cy="12" r="3"/><path d="M10 2h4l1 3 2 1 3-1 2 4-2 2v2l2 2-2 4-3-1-2 1-1 3h-4l-1-3-2-1-3 1-2-4 2-2v-2L2 9l2-4 3 1 2-1z"/>']
 ];
 const actions=document.createElement('section');
 actions.className='ss-home-tools';
 actions.setAttribute('aria-label','Быстрый доступ к разделам');
 const ask=document.createElement('button');
 ask.type='button';ask.className='ss-ask';
 ask.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/></svg><span>Спросите помощника о работе кухни…</span><span class="ss-ask-end" aria-hidden="true">↗</span>';
 ask.addEventListener('click',onOpenChat);
 const grid=document.createElement('nav');grid.className='ss-quick-grid';grid.setAttribute('aria-label','Рабочие разделы');
 for(const [label,destination,icon] of shortcuts){
  const b=document.createElement('button');b.type='button';b.className='ss-shortcut';
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icon+'</svg><span>'+label+'</span>';
  b.addEventListener('click',()=>{
   if(destination==='preparations')document.getElementById('menu-preparations')?.click();
   else if(destination==='settings')document.getElementById('lunar-settings')?.click();
   else onNavigate(destination);
  });
  grid.append(b);
 }
 actions.append(ask,grid);
 root.querySelector('.ss-showcase').before(actions);
 const portal=root.querySelector('.ss-portal'),world=root.querySelector('.ss-world');
 const markers=root.querySelector('.ss-markers'),deck=root.querySelector('.ss-deck'),items=root.querySelector('.ss-items');
 let portalW=portal.clientWidth,portalH=portal.clientHeight,deckW=deck.clientWidth,deckH=deck.clientHeight;
 const title=root.querySelector('.ss-category-name'),caption=root.querySelector('.ss-selected-caption');
 const pause=root.querySelector('.ss-pause');
 root.querySelector('.ss-ttk').addEventListener('click',onOpenRecipes);
 root.querySelector('.ss-chat').addEventListener('click',onOpenChat);
 const clock=root.querySelector('.ss-clock'),weather=root.querySelector('.ss-weather');
 const refreshMeta=()=>{clock.textContent=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date());const t=document.querySelector('[data-weather-temp]')?.textContent?.trim();weather.textContent=t&&t!=='—'?'Погода: '+t:'Погода: —'};
 refreshMeta();setInterval(refreshMeta,60000);
 let yaw=0.31,pitch=0.06,orbit=0,tableOrbit=0,velocityX=0,velocityY=0,paused=false;
 let selected=0,chosenItem=-1,drag=null,deckDrag=null,landProducts=[],draggedUntil=0,deckDraggedUntil=0,hoveredOrbit=0,hoveredTable=0;
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const mobile=matchMedia('(hover: none), (max-width: 750px)');
 if(reduceMotion.matches||mobile.matches){paused=true;pause.textContent='▶ Вращать';pause.setAttribute('aria-pressed','true')}
 const buttons=CATEGORIES.map((c,i)=>{
  const b=document.createElement('button');b.type='button';b.className='ss-marker';
  b.setAttribute('aria-pressed',i===selected?'true':'false');
  const ico=document.createElement('span');ico.className='ss-mark';ico.textContent=c.icon;ico.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.textContent=c.name;b.append(ico,label);
  b.addEventListener('click',()=>{if(performance.now()>=draggedUntil)select(i)});b.addEventListener('mouseenter',()=>hoveredOrbit++);b.addEventListener('mouseleave',()=>hoveredOrbit=Math.max(0,hoveredOrbit-1));markers.append(b);return b;
 });
 function getProducts(i){
  const category=CATEGORIES[i];const matched=landProducts.filter(p=>categorize(p.category||p.name||'')===category.id);
  if(matched.length)return matched.slice(0,5).map((p,n)=>({label:String(p.name||'Товар '+(n+1)),image:photoUrl(p),kind:category.kind}));
  const photoNames=SAMPLE_PHOTOS[category.id]||[];
  if(photoNames.length)return photoNames.map((filename,j)=>({label:category.name+' · образец '+(j+1),kind:category.kind,image:'/assets/categories/'+filename,demo:true}));
  return [{label:'Фото товара появится здесь',kind:category.kind,image:'',demo:true}];
 }
 function select(i){
  selected=i;chosenItem=-1;title.textContent=CATEGORIES[i].name;
  buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
  caption.textContent='Коснитесь образца, чтобы рассмотреть товар.';
  items.replaceChildren();
  getProducts(i).forEach((p,j)=>{
    const item=document.createElement('button');item.type='button';item.className='ss-item';item.setAttribute('aria-pressed','false');
    item.setAttribute('aria-label',p.label);
    if(p.image){const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';if(p.demo){img.style.opacity='0';sampleCutout(p.image).then(result=>{if(img.isConnected){img.src=result;img.style.opacity='1'}})}else img.src=p.image;img.onerror=()=>{img.remove();const placeholder=document.createElement('div');placeholder.className='ss-food ss-food-'+p.kind;item.prepend(placeholder)};item.append(img)}
    else{const food=document.createElement('div');food.className='ss-food ss-food-'+p.kind;food.setAttribute('aria-hidden','true');item.append(food)}
    const text=document.createElement('span');text.textContent=p.label;item.append(text);
    item.addEventListener('mouseenter',()=>hoveredTable++);item.addEventListener('mouseleave',()=>hoveredTable=Math.max(0,hoveredTable-1));
    item.addEventListener('click',()=>{if(performance.now()<deckDraggedUntil)return;chosenItem=j;items.querySelectorAll('button').forEach((x,k)=>x.setAttribute('aria-pressed',String(j===k)));caption.textContent=p.label+(p.demo?' · Демонстрационное фото — заменим на ваше':p.image?' · Фотография товара':' · Фото добавим позже')});
    items.append(item);
  });
  positionTable();
 }

 // Lightweight CSS globe: the curved image is composited by the browser GPU, not repainted in JavaScript.
 function drawGlobe(){
  const longitude=yaw/(2*Math.PI)*100;
  world.style.setProperty('--ss-longitude',(((65-longitude)%100+100)%100).toFixed(2)+'%');
  world.style.setProperty('--ss-tilt',(pitch*18).toFixed(2)+'deg');
 }
 function placeMarkers(){
  const w=portalW,h=portalH,rx=Math.min(w*(w<750?.34:.39),385),ry=h*.375;
  buttons.forEach((b,i)=>{
   const a=i*2*Math.PI/buttons.length+orbit;
   const depth=Math.cos(a), x=w*.5+Math.sin(a)*rx, y=h*.44+Math.cos(a)*ry*.74+Math.sin(a)*ry*.23*Math.sin(pitch*.5+.3);
   b.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) scale('+(.82+.17*(depth+1)/2)+')';b.style.zIndex=String(20+Math.round(12*depth));b.style.opacity=String(.65+.35*(depth+1)/2);
  });
 }
 function positionTable(){
  const list=items.querySelectorAll('.ss-item'),n=list.length;items.dataset.count=String(n);if(!n)return;
  const w=deckW,h=deckH,rx=Math.min(w*.34,250),ry=Math.min(h*.20,58);
  list.forEach((el,i)=>{
   const a=i*2*Math.PI/n+tableOrbit,depth=Math.sin(a);
   const x=n===1?0:Math.cos(a)*rx,y=n===1?0:Math.sin(a)*ry;
   el.style.transform='translate3d('+(w/2+x)+'px,'+(h*.48+y)+'px,0) translate(-50%,-50%) scale('+(0.82+(depth+1)*.12)+')';
   el.style.zIndex=String(30+Math.round(depth*10));
  });
 }

 // On mobile there are no persistent render loops. Desktop drifts only 5-6 times per second.
 let frameTimer=null;
 function frame(){
  if(paused||document.hidden||document.body.dataset.view!=='home'||!root.isConnected){frameTimer=null;return}
  const dt=180;
  yaw+=dt*.00007;
  if(!hoveredOrbit&&!drag)orbit+=dt*.000055;
  if(!hoveredTable&&!deckDrag)tableOrbit+=dt*.000055;
  yaw+=velocityX*dt;pitch=clamp(pitch+velocityY*dt,-.82,.82);
  velocityX*=.5;velocityY*=.5;
  drawGlobe();placeMarkers();positionTable();
  frameTimer=setTimeout(frame,180);
 }
 function startFrame(){if(!paused&&!frameTimer)frameTimer=setTimeout(frame,180)}
 function stopFrame(){if(frameTimer){clearTimeout(frameTimer);frameTimer=null}}
 function resize(){
  const w=Math.max(1,Math.round(portal.clientWidth)),h=Math.max(1,Math.round(portal.clientHeight));
  if(w<12||h<12)return;
  portalW=w;portalH=h;deckW=deck.clientWidth;deckH=deck.clientHeight;
  drawGlobe();placeMarkers();positionTable();
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
  drag.x=e.clientX;drag.y=e.clientY;drag.t=performance.now();placeMarkers();drawGlobe();
 });
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])portal.addEventListener(evt,()=>{if(drag?.moved)draggedUntil=performance.now()+230;drag=null});
 portal.addEventListener('keydown',e=>{
  const actions={ArrowLeft:[-.19,0],ArrowRight:[.19,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]};
  if(!actions[e.key])return;e.preventDefault();
  yaw+=actions[e.key][0];orbit+=actions[e.key][0];pitch=clamp(pitch+actions[e.key][1],-.82,.82);
  placeMarkers();drawGlobe();
 });
 const reset=root.querySelector('.ss-reset');
 reset.addEventListener('click',()=>{yaw=.31;pitch=.06;orbit=0;tableOrbit=0;velocityX=0;velocityY=0;placeMarkers();positionTable()});
 pause.addEventListener('click',()=>{paused=!paused;pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'▶ Вращать':'Ⅱ Пауза';if(paused){stopFrame();drawGlobe()}else startFrame()});
 deck.addEventListener('pointerdown',e=>{deckDrag={x:e.clientX,moved:false};(e.target.closest('.ss-item')||deck).setPointerCapture(e.pointerId)});
 deck.addEventListener('pointermove',e=>{if(!deckDrag)return;const dx=e.clientX-deckDrag.x;if(Math.abs(dx)>3)deckDrag.moved=true;tableOrbit+=dx*.008;deckDrag.x=e.clientX;positionTable()});
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])deck.addEventListener(evt,()=>{if(deckDrag?.moved)deckDraggedUntil=performance.now()+230;deckDrag=null});
 function updateRecipes(recipes){landProducts=Array.isArray(recipes)?recipes.filter(p=>p&&p.name):[];select(selected)}
 try{landProducts=getRecipes()||[]}catch{}
 select(0);
 if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(portal);
 else window.addEventListener('resize',resize);
 resize();startFrame();
 document.body.classList.add('stark-ready');document.body.classList.remove('stark-booting');
 return {updateRecipes,selectCategory:id=>{const i=CATEGORIES.findIndex(c=>c.id===id);if(i>=0)select(i)}};
}
