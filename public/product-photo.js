// Remove only background pixels connected to the image perimeter; enclosed dark food stays intact.
export function edgeMask(data,width,height,tolerance=38){
 const samples=[];for(let x=0;x<width;x+=Math.max(1,Math.floor(width/30)))for(const y of [0,height-1])samples.push((y*width+x)*4);
 for(let y=0;y<height;y+=Math.max(1,Math.floor(height/30)))for(const x of [0,width-1])samples.push((y*width+x)*4);
 const median=k=>samples.map(i=>data[i+k]).sort((a,b)=>a-b)[Math.floor(samples.length/2)];
 const bg=[median(0),median(1),median(2)];
 const distance=i=>Math.max(...bg.map((v,k)=>Math.abs(data[i*4+k]-v)));
 const uniform=samples.filter(i=>data[i+3]<10||Math.max(...bg.map((v,k)=>Math.abs(data[i+k]-v)))<tolerance).length/samples.length;
 if(uniform<.78)return false;
 const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let tail=0;
 const add=i=>{if(!seen[i]&&(data[i*4+3]<10||distance(i)<=tolerance)){seen[i]=1;queue[tail++]=i}};
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x)}for(let y=0;y<height;y++){add(y*width);add(y*width+width-1)}
 for(let head=0;head<tail;head++){const i=queue[head],x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);if(i>=width)add(i-width);if(i<width*(height-1))add(i+width)}
 for(let i=0;i<seen.length;i++)if(seen[i])data[i*4+3]=0;
 return true;
}
async function canvasFor(source){
 const img=new Image();if(typeof source==='string')img.src=source;else img.src=URL.createObjectURL(source);
 try{await img.decode();const scale=Math.min(1,1000/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas}finally{if(typeof source!=='string')URL.revokeObjectURL(img.src)}
}
export async function preparePhoto(source,{tolerance=38,ai=true,onProgress=()=>{}}={}){
 const canvas=await canvasFor(source),ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 let transparent=false;for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<245){transparent=true;break}
 if(transparent)return canvas.toDataURL('image/png');
 if(edgeMask(pixels.data,canvas.width,canvas.height,tolerance)){ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png')}
 if(!ai)throw Error('Фон неоднородный. Используй AI-обработку.');
 onProgress('Загружаю AI для удаления сложного фона. Первый запуск может занять несколько минут…');
 const {removeBackground}=await import('/vendor/background/index.js');
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 const result=await removeBackground(blob,{publicPath:new URL('/photo-resources/',location.origin).href,model:'isnet_quint8',device:'cpu',output:{format:'image/png'},progress:(key,current,total)=>onProgress('AI: '+Math.round(current/Math.max(total,1)*100)+'%')});
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(result)});
}
const cached=new Map();
export function showProductPhoto(img,source){
 img.src=source;
 if(!source.startsWith('/assets/categories/')||source.endsWith('.svg'))return;
 img.style.opacity='0';
 if(!cached.has(source))cached.set(source,preparePhoto(source,{ai:false}).catch(()=>source));
 cached.get(source).then(result=>{if(img.isConnected){img.src=result;img.style.opacity='1'}});
}
