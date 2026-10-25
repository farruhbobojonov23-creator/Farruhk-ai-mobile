/* FARUKH PRINT PRO: privacy-first QR selection.
 * No external barcode services, uploads, or camera recording.
 * BarcodeDetector is a browser capability. Manual code search is the fallback.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id),dialog=$('pro-qr-dialog'),video=$('pro-qr-video');
if(!dialog||!video)return;
let active=false,stream=null,detector=null,timer=null;
const note=text=>$('pro-qr-status').textContent=text;
function stop(){
 active=false;clearTimeout(timer);timer=null;
 if(stream){for(const track of stream.getTracks())track.stop();stream=null}
 try{video.pause()}catch{}
 video.srcObject=null;
}
function close(){stop();if(dialog.open)dialog.close()}
function select(raw){
 const api=window.FARUKH_PRINT_PRO_SCAN;
 if(!api){note('Каталог ещё не загрузился.');return false}
 const p=api.find(raw);
 if(!p){note('Товар не найден. Проверь код и обновление каталога.');return false}
 close();
 if(!api.select(p)){note('Не удалось открыть позицию.');return false}
 return true;
}
async function step(){
 if(!active||!dialog.open)return;
 try{
  if(video.readyState>=2){
   const found=await detector.detect(video);
   if(!active||!dialog.open)return;
   for(const item of found){
    const raw=String(item.rawValue||'').slice(0,512);
    if(select(raw))return;
   }
  }
 }catch(e){note('Сканирование: '+(e.message||'ошибка камеры'))}
 if(active)timer=setTimeout(step,260);
}
async function start(){
 stop();note('Проверяю разрешение камеры…');
 if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){
  note('На этом устройстве автоматическое считывание QR недоступно. Введи код товара вручную.');
  return;
 }
 try{
  detector=new BarcodeDetector({formats:['qr_code']});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(!dialog.open){stop();return}
  active=true;video.srcObject=stream;
  await video.play();
  note('Камера включена. Наведи её на QR товара.');
  timer=setTimeout(step,100);
 }catch(e){
  stop();note('Камера недоступна: '+(e.message||'проверь разрешение')+'. Введи код вручную.');
 }
}
function open(){
 if(!dialog.open)dialog.showModal();
 void start();
}
$('pro-qr-close').onclick=close;
$('pro-qr-restart').onclick=()=>void start();
$('pro-qr-find').onclick=()=>select($('pro-qr-value').value);
$('pro-qr-value').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();select(e.currentTarget.value)}});
dialog.addEventListener('close',stop);
dialog.addEventListener('cancel',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){stop();note('Камера выключена. Для продолжения нажми «Включить камеру».')}});
window.FARUKH_PRINT_PRO_SCANNER={open,close};
})();
