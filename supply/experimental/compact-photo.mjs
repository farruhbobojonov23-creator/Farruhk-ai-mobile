// Mobile shadow correction. Original source image remains unchanged.
// Estimate the bright paper background tile-by-tile, then smoothly interpolate.
export function normalizePaper(im){
 const {width:w,height:h,data}=im;
 if(!(w>0&&h>0&&data.length===w*h*4))throw Error('Invalid raster');
 const nx=Math.max(2,Math.ceil(w/64)),ny=Math.max(2,Math.ceil(h/64)),bg=new Float32Array(nx*ny);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const hist=new Uint32Array(256);let count=0;
  for(let j=Math.floor(y*h/ny);j<Math.floor((y+1)*h/ny);j+=2)
   for(let i=Math.floor(x*w/nx);i<Math.floor((x+1)*w/nx);i+=2){
    const p=(j*w+i)*4,v=Math.round(.299*data[p]+.587*data[p+1]+.114*data[p+2]);hist[v]++;count++;
   }
  let n=0,v=255;for(;v>0;v--){n+=hist[v];if(n>=count*.15)break;}
  bg[y*nx+x]=Math.max(48,v);
 }
 const smooth=new Float32Array(bg.length);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  let sum=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
   const ix=Math.max(0,Math.min(nx-1,x+i)),iy=Math.max(0,Math.min(ny-1,y+j)),k=(i===0?2:1)*(j===0?2:1);
   sum+=bg[iy*nx+ix]*k;n+=k;
  }smooth[y*nx+x]=sum/n;
 }
 const out=new Uint8ClampedArray(data.length);
 for(let y=0;y<h;y++){
  const gy=Math.max(0,Math.min(ny-1,(y+.5)*ny/h-.5)),y0=Math.floor(gy),y1=Math.min(ny-1,y0+1),v=gy-y0;
  for(let x=0;x<w;x++){
   const gx=Math.max(0,Math.min(nx-1,(x+.5)*nx/w-.5)),x0=Math.floor(gx),x1=Math.min(nx-1,x0+1),u=gx-x0;
   const b=(smooth[y0*nx+x0]*(1-u)+smooth[y0*nx+x1]*u)*(1-v)+(smooth[y1*nx+x0]*(1-u)+smooth[y1*nx+x1]*u)*v;
   const factor=Math.min(3,245/Math.max(48,b)),p=(y*w+x)*4;
   for(let c=0;c<3;c++)out[p+c]=Math.min(255,Math.round(data[p+c]*factor));out[p+3]=data[p+3];
  }
 }
 return {width:w,height:h,data:out};
}

// SLANet input is BGR, resized proportionally and padded after normalization.
export function tableInput(im,size=488){
 const w=im.width,h=im.height,r=Math.min(size/w,size/h),rw=Math.max(1,Math.round(w*r)),rh=Math.max(1,Math.round(h*r)),n=size*size,out=new Float32Array(3*n);
 const mean=[.485,.456,.406],std=[.229,.224,.225];
 for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){
  const sx=Math.min(w-1,Math.floor((x+.5)*w/rw)),sy=Math.min(h-1,Math.floor((y+.5)*h/rh)),p=(sy*w+sx)*4;
  for(let c=0;c<3;c++)out[c*n+y*size+x]=(im.data[p+2-c]/255-mean[c])/std[c];
 }return out;
}
export function decodeStructure(outputs,dict){
 const probs=Object.values(outputs).find(x=>x.dims.length===3&&x.dims[2]===dict.length);
 if(!probs)throw Error('Unknown SLANet output shape');
 const tokens=[],scores=[];for(let i=0;i<probs.dims[1];i++){
  let k=0;for(let j=1;j<dict.length;j++)if(probs.data[i*dict.length+j]>probs.data[i*dict.length+k])k=j;
  if(dict[k]==='eos')break;if(dict[k]==='sos')continue;
  tokens.push(dict[k]);scores.push(probs.data[i*dict.length+k]);
 }
 const html=tokens.join('');return{html,rows:(html.match(/<tr>/g)||[]).length,cells:(html.match(/<td(?:>| )/g)||[]).length,score:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0};
}
