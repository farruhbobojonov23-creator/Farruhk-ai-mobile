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
  // Real Bluetooth raster uses the SAME vector geometry as both previews.
  // No independent old template, no test values or substituted timestamps.
  can.width=W;can.height=H;
  const g=can.getContext('2d',{willReadFrequently:true});
  if(!g)throw Error('Canvas на этом устройстве недоступен.');
  if(!window.FarukhPremiumReady?.draw)throw Error('Премиальный шаблон этикетки ещё не загрузился.');
  const dateFmt=ms=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','');
  window.FarukhPremiumReady.draw(g,p,epoch,{formatDate:dateFmt});
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
