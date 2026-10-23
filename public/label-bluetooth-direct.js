// Bluetooth Classic (SPP/RFCOMM) -> Web Serial -> TSPL native label bitmap.
// Chrome Android 138+ supports Web Serial over paired Bluetooth Classic.
// This tool only prints after an explicit user gesture, with the current
// already-reviewed product. Existing 58x40 HTML template is not modified.
const W=464, H=320, DPI=8, encoder=new TextEncoder();
const asBytes=value=>encoder.encode(value);
const printerState={port:null,connected:false,working:false};
const androidNative=!!window.FarukhPrinter?.postMessage;
const nativeSend=data=>window.FarukhPrinter.postMessage(JSON.stringify(data));
const encode64=bytes=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)};
const $=id=>document.getElementById(id);
const status=$('bluetooth-status'),connect=$('bt-connect'),button=$('direct-print');
const available=()=>!!navigator.serial&&!!navigator.serial.requestPort;
const app=window.FARUKH_LABELS;
function say(message,error=false){
  status.textContent=message;
  status.dataset.error=error?'yes':'no';
}
function setUI(){
  button.disabled=printerState.working||$('print').disabled;
  if(androidNative){connect.disabled=printerState.working;connect.textContent='⌁ Выбрать Bluetooth-принтер';return}
  connect.disabled=printerState.working||!available();
  connect.textContent=printerState.connected?'✓ V3 подключён':'⌁ Подключить V3 BT';
}
if(androidNative){
  say('Приложение FARUKH AI: Bluetooth-печать готова. Нажми «Печатать на V3».');
  window.FarukhPrinter.onmessage=event=>{
    try{const m=JSON.parse(event.data);say(m.message||'Ответ принтера',!m.ok)}
    catch{say('Ответ от приложения получен.')}
    printerState.working=false;setUI();
  };
}else if(!available()){
  say('Прямой Bluetooth из браузера недоступен. Установи Android-приложение FARUKH AI.',true);
  connect.disabled=true;
}else say('Подключи V3 BT один раз, затем печатай прямо из FARUKH AI.');
async function selectPort(){
  // requestPort must be called from within the original tap.
  const port=await navigator.serial.requestPort();
  await port.open({baudRate:9600});
  printerState.port=port;
  printerState.connected=true;
  say('V3 BT подключён. Можно печатать этикетки напрямую.');
  setUI();
}
connect.addEventListener('click',async()=>{
  if(printerState.working)return;
  if(androidNative){printerState.working=true;setUI();try{nativeSend({type:'select'})}catch(e){printerState.working=false;say(e.message,true);setUI()}return}
  if(printerState.connected){say('Принтер уже подключён. Нажми «Печатать на V3».');return}
  if(!available()){say('В этом браузере нет Web Serial. Открой страницу в последней версии Google Chrome.',true);return}
  try{
    await selectPort();
  }catch(error){
    if(error.name==='NotFoundError')say('Принтер не выбран. Убедись, что V3 BT сопряжён с телефоном, и выбери его в списке.',true);
    else say('Не удалось подключить V3 BT: '+(error.message||'ошибка')+'. Закрой 4Barcode и повтори.',true);
  }
  setUI();
});

const rect=(ctx,x,y,w,h,line=2)=>{ctx.lineWidth=line;ctx.strokeRect(x+.5,y+.5,w-1,h-1)};
const horizontal=(ctx,y,x1,x2)=>{ctx.beginPath();ctx.moveTo(x1,y+.5);ctx.lineTo(x2,y+.5);ctx.stroke()};
const vertical=(ctx,x,y1,y2)=>{ctx.beginPath();ctx.moveTo(x+.5,y1);ctx.lineTo(x+.5,y2);ctx.stroke()};
function fit(ctx,str,maxWidth,size=16,min=8,weight='700'){
  let fontSize=size;
  do{ctx.font=weight+' '+fontSize+'px Arial, sans-serif';if(ctx.measureText(str).width<=maxWidth||fontSize<=min)break;fontSize-=.5}while(fontSize>min);
  return fontSize;
}
function write(ctx,str,x,y,{width=420,size=16,min=7,weight='700',align='left'}={}){
  const content=String(str??'');
  fit(ctx,content,width,size,min,weight);
  ctx.textAlign=align;ctx.fillText(content,x,y);
}
function lines(ctx,text,maxWidth,maxLines,size=11.5){
  ctx.font='normal '+size+'px Arial, sans-serif';
  const words=String(text||'').trim().split(/\s+/).filter(Boolean);
  const all=[];let row='';
  for(const word of words){
    const next=row?row+' '+word:word;
    if(ctx.measureText(next).width<=maxWidth)row=next;
    else{
      if(row)all.push(row);
      if(ctx.measureText(word).width<=maxWidth)row=word;
      else{
        // Long unspaced words (ingredients): split at character boundaries.
        row='';
        for(const ch of word){if(row&&ctx.measureText(row+ch).width>maxWidth){all.push(row);row=ch}else row+=ch}
      }
    }
  }
  if(row)all.push(row);
  return {draw:all.slice(0,maxLines),truncated:all.length>maxLines,all};
}
// Rasterized rendering of the *same approved label content* on a 203-dpi canvas.
// Typography is tailored to 58x40mm, without PDF scaling or system margins.
export function rasterLabel(p,epoch,can=document.createElement('canvas')){
  can.width=W;can.height=H;
  const g=can.getContext('2d',{willReadFrequently:true});
  if(!g)throw Error('Canvas на этом устройстве недоступен.');
  g.fillStyle='#fff';g.fillRect(0,0,W,H);
  g.fillStyle='#000';g.strokeStyle='#000';g.textBaseline='middle';g.lineJoin='miter';g.lineWidth=2;
  rect(g,6,6,452,308,2);rect(g,12,12,440,296,2);
  // Header and product name.
  horizontal(g,50,19,445);
  write(g,'СУШИ БЕРИ',23,33,{size:21,weight:'900',width:220});
  write(g,'Готовая продукция',443,34,{size:11,weight:'400',align:'right',width:187});
  const title=String(p.name||'').toUpperCase();
  g.font='900 11px Arial,sans-serif';
  if(g.measureText(title).width>412){
    const wrapped=lines(g,title,404,2,17);
    if(wrapped.truncated)throw Error('Название слишком длинное для этикетки. Укороти его в редакторе.');
    wrapped.draw.forEach((line,i)=>write(g,line,232,65+i*19,{size:18,min:11,weight:'900',align:'center',width:410}));
  }else write(g,title,232,73,{size:24,min:11,weight:'900',align:'center',width:412});
  horizontal(g,96,19,445);
  // KБЖУ — fixed height, dedicated centered cells.
  rect(g,20,99,425,60,2);
  horizontal(g,122,20,445); horizontal(g,141,20,445);
  write(g,'Пищевая ценность на 100 г',232,111,{align:'center',size:13.2,min:11.5,width:415,weight:'800'});
  const nutrition=[
    ['Б (г)',String(p.p).replace('.',',')],['Ж (г)',String(p.f).replace('.',',')],
    ['У (г)',String(p.c).replace('.',',')],['Ккал',String(p.kcal)]
  ];
  const colW=425/4;
  for(let i=0;i<4;i++){
    if(i)vertical(g,20+colW*i,122,159);
    const mid=20+colW*(i+.5);
    write(g,nutrition[i][0],mid,132,{size:13,min:10,weight:'800',align:'center',width:colW-7});
    write(g,nutrition[i][1],mid,149.4,{size:13.1,min:10,weight:'700',align:'center',width:colW-7});
  }
  // Composition block: no text may spill outside the frame.
  rect(g,20,163,425,49,2);
  const composition='Состав: '+String(p.composition||'');
  let composed=lines(g,composition,411,3,11.2);
  if(composed.truncated){
    composed=lines(g,composition,411,4,9.1);
    if(composed.truncated)throw Error('Состав слишком длинный для этикетки 58×40. Сократи текст в редакторе.');
    g.font='normal 9.1px Arial, sans-serif';
    composed.draw.forEach((v,i)=>g.fillText(v,27,173.4+i*9.6));
  }else{
    g.font='normal 11.2px Arial, sans-serif';
    composed.draw.forEach((v,i)=>g.fillText(v,27,174+i*13.2));
  }
  // Bottom 3 columns: weight / two datetimes / temperature & storage.
  rect(g,20,216,425,88,2);
  vertical(g,179,216,304);vertical(g,339,216,304);horizontal(g,260,339,445);
  write(g,'Вес нетто:',27,245,{size:12,min:10,width:145,weight:'700'});
  write(g,p.weight+' г (±'+p.tolerance+' г)',27,266,{size:19,min:11,width:149,weight:'900'});
  const dateFmt=milliseconds=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(milliseconds)).replace(',','');
  write(g,'Изготовлено:',185,229,{size:11,min:9,width:146});
  write(g,dateFmt(epoch),185,244,{size:12.6,min:10,width:146,weight:'800'});
  write(g,'Годен до:',185,270,{size:11,min:9,width:146});
  write(g,dateFmt(epoch+Number(p.hours)*3600000),185,285,{size:12.6,min:10,width:146,weight:'800'});
  write(g,'Хранить при:',392,229,{size:10.5,min:8,width:98,align:'center',weight:'400'});
  write(g,p.storage,392,247,{size:13.1,min:9,width:97,align:'center',weight:'900'});
  write(g,'Срок годн.:',392,274,{size:10,min:8,align:'center',width:97,weight:'400'});
  write(g,p.hours+' ч',392,291,{size:15.5,min:10,align:'center',width:97,weight:'900'});
  return can;
}
export function buildTSPL(canvas,copies=1){
  if(canvas.width!==W||canvas.height!==H)throw Error('Неверный размер этикетки 58×40.');
  if(!Number.isInteger(copies)||copies<1||copies>20)throw Error('Разрешено печатать 1–20 этикеток.');
  const data=canvas.getContext('2d').getImageData(0,0,W,H).data;
  const raster=new Uint8Array((W/8)*H);
  // TSPL: 0-bit = printed/dark dot, 1-bit = blank/light dot.
  raster.fill(255);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const pixel=(y*W+x)*4;
    const gray=(data[pixel]*299+data[pixel+1]*587+data[pixel+2]*114)/1000;
    if(data[pixel+3]>80&&gray<164)raster[y*(W/8)+(x>>3)]&=~(0x80>>(x&7));
  }
  const head=asBytes('\r\nSIZE 58 mm,40 mm\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,58,320,0,');
  const tail=asBytes('\r\nPRINT 1,'+copies+'\r\n');
  const result=new Uint8Array(head.length+raster.length+tail.length);
  result.set(head,0);result.set(raster,head.length);result.set(tail,head.length+raster.length);
  return result;
}
async function printNow(){
  if(printerState.working)return;
  let job;
  try{job=app?.getPrintJob();if(!job)throw Error('Сначала подтверди сведения на этикетке и укажи дату.')}
  catch(e){say(e.message,true);return}
  if(androidNative){
    printerState.working=true;setUI();
    try{
      const bytes=buildTSPL(rasterLabel(job.product,job.epoch),job.copies);
      nativeSend({type:'print',tspl:encode64(bytes)});
      say('Передаю задание в Bluetooth-принтер…');
    }catch(e){say('Печать не отправлена: '+e.message,true);printerState.working=false;setUI()}
    return;
  }
  if(!available()){say('Прямой Bluetooth-печати нет в этом браузере. Открой FARUKH AI через Google Chrome.',true);return}
  if(!printerState.connected||!printerState.port){
    // The same print tap may request Bluetooth access and then submit the job.
    // requestPort is invoked before the first await to retain user activation.
    try{await selectPort()}catch(e){
      if(e.name==='NotFoundError')say('Нужно выбрать V3 BT в окне Bluetooth. Попробуй снова.',true);
      else say('Не удалось подключить V3: '+(e.message||'ошибка')+'. Закрой 4Barcode и повтори.',true);
      setUI();return;
    }
  }
  printerState.working=true;setUI();
  try{
    const bytes=buildTSPL(rasterLabel(job.product,job.epoch),job.copies);
    const writer=printerState.port.writable?.getWriter();
    if(!writer)throw Error('Bluetooth-канал недоступен. Подключи принтер снова.');
    try{
      // Several small serial writes are safer for V3's limited Bluetooth buffer.
      for(let offset=0;offset<bytes.length;offset+=512){
        await writer.write(bytes.subarray(offset,Math.min(offset+512,bytes.length)));
      }
    }finally{writer.releaseLock()}
    say('Команда для '+job.copies+' этикеток отправлена в V3 BT. Если бумага не вышла, проверь режим TSPL и зазор между наклейками.');
  }catch(e){
    say('Печать не подтверждена: '+e.message+'. Если V3 занят, закрой 4Barcode и подключи принтер снова.',true);
    printerState.connected=false;
    try{await printerState.port?.close()}catch{}
    printerState.port=null;
  }finally{printerState.working=false;setUI()}
}
button.addEventListener('click',printNow);
const observer=new MutationObserver(setUI);
observer.observe($('print'),{attributes:true,attributeFilter:['disabled']});
setUI();
// After the first explicit pairing, Chrome may remember the grant. Try to
// reconnect without opening another picker; failures do not print anything.
if(!androidNative&&available()&&navigator.serial.getPorts){
  void navigator.serial.getPorts().then(async ports=>{
    if(printerState.port||printerState.working||ports.length!==1)return;
    try{
      await ports[0].open({baudRate:9600});
      printerState.port=ports[0];printerState.connected=true;
      say('Сохранённый принтер V3 BT подключён. Можно печатать одной кнопкой.');setUI();
    }catch{
      // Printer may be off or busy with 4Barcode. User can connect manually.
      say('Нажми «Печатать на V3», чтобы подключить принтер и распечатать этикетку.');
    }
  }).catch(()=>{});
}
