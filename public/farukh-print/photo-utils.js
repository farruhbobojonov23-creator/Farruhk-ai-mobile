/* FARUKH PRINT: user-uploaded product thumbnails only, never generated.
 * Photos are stored in the product catalog and follow JSON backups/cloud
 * after the owner publishes. Thermal TSPL images stay strictly monochrome.
 */
(()=>{
'use strict';
const CAP=45000;
const isPhoto=v=>v===''||(typeof v==='string'&&v.length<=CAP&&/^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v));
function compress(file){
 return new Promise((resolve,reject)=>{
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>8*1024*1024)return reject(Error('Выбери JPG, PNG или WEBP не больше 8 МБ.'));
  const url=URL.createObjectURL(file),img=new Image();
  const cleanup=()=>URL.revokeObjectURL(url);
  img.onerror=()=>{cleanup();reject(Error('Фотография повреждена или не поддерживается.'))};
  img.onload=()=>{
   cleanup();
   if(!img.naturalWidth||!img.naturalHeight)return reject(Error('Размер фотографии не определён.'));
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)return reject(Error('Обработка фото недоступна в этом браузере.'));
   const fit=Math.min(1,300/img.naturalWidth,250/img.naturalHeight);
   const baseW=Math.max(1,Math.round(img.naturalWidth*fit));
   const baseH=Math.max(1,Math.round(img.naturalHeight*fit));
   const mime=file.type==='image/jpeg'?'image/jpeg':'image/webp';
   for(const factor of [1,.86,.7,.54,.4,.3]){
    canvas.width=Math.max(1,Math.round(baseW*factor));
    canvas.height=Math.max(1,Math.round(baseH*factor));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [.78,.64,.5,.38]){
     const result=canvas.toDataURL(mime,quality);
     if(isPhoto(result))return resolve(result);
    }
   }
   reject(Error('Фото слишком сложное для синхронизации. Выбери другое изображение.'));
  };
  img.src=url;
 });
}
window.FarukhPrintPhotos={compress,isPhoto,MAX_LENGTH:CAP};
})();
