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


// Independent evidence from long ruled lines. Reject incomplete grids rather than
// trusting a high-confidence neural prediction that silently loses rows or columns.
export function ruledGrid(im){
 const {width:w,height:h,data}=im,rows=new Uint32Array(h),cols=new Uint32Array(w);
 const mask=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=(y*w+x)*4;mask[y*w+x]=(.299*data[p]+.587*data[p+1]+.114*data[p+2])<110?1:0;
 }
 for(let y=0;y<h;y++){let start=-1,last=-1;for(let x=0;x<w;x++){if(mask[y*w+x]){if(start<0||x-last>5)start=x;last=x;rows[y]=Math.max(rows[y],x-start+1)}}}
 const peaks=(v,min)=>{const a=[];for(let i=0;i<v.length;i++){if(v[i]<min)continue;let j=i;while(j+1<v.length&&v[j+1]>=min)j++;a.push(Math.round((i+j)/2));i=j;}return a.filter((x,i)=>i===0||x-a[i-1]>5);};
 const ys=peaks(rows,w*.55);if(ys.length<3)return null;
 const top=ys[0],bottom=ys.at(-1),height=bottom-top;
 for(let x=0;x<w;x++){let start=-1,last=-1;for(let y=top;y<=bottom;y++){if(mask[y*w+x]){if(start<0||y-last>5)start=y;last=y;cols[x]=Math.max(cols[x],y-start+1)}}}
 const xs=peaks(cols,height*.75);
 if(xs.length<4||xs.at(-1)-xs[0]<w*.55)return null;
 if(ys.slice(1).some((y,i)=>y-ys[i]<12)||xs.slice(1).some((x,i)=>x-xs[i]<12))return null;
 return{xs,ys,rows:ys.length-1,cols:xs.length-1};
}
export function assignGridText(grid,items){
 const {xs,ys}=grid;
 const out=Array.from({length:ys.length-1},()=>Array.from({length:xs.length-1},()=>[]));let ambiguous=0;
 for(const i of items){
  if(!i.poly?.length||!i.text)continue;
  const x=i.poly.reduce((s,p)=>s+p[0],0)/i.poly.length,y=i.poly.reduce((s,p)=>s+p[1],0)/i.poly.length;
  const c=xs.findIndex((v,k)=>k>0&&x>xs[k-1]&&x<v)-1,r=ys.findIndex((v,k)=>k>0&&y>ys[k-1]&&y<v)-1;
  if(c<0||r<0)continue;
  const left=Math.min(...i.poly.map(p=>p[0])),right=Math.max(...i.poly.map(p=>p[0]));
  const top=Math.min(...i.poly.map(p=>p[1])),bottom=Math.max(...i.poly.map(p=>p[1]));
  const coverage=Math.max(0,Math.min(right,xs[c+1])-Math.max(left,xs[c]))*Math.max(0,Math.min(bottom,ys[r+1])-Math.max(top,ys[r]));
  if(coverage<.85*Math.max(1,(right-left)*(bottom-top))){ambiguous++;continue;}
  out[r][c].push({x,y,text:i.text});
 }
 return{rows:out.map(row=>row.map(cell=>cell.sort((a,b)=>Math.abs(a.y-b.y)>8?a.y-b.y:a.x-b.x).map(i=>i.text).join(' '))),ambiguous};
}

// Independently detect the visible grid. The neural structure is advisory when
// the actual printed rules prove a different row/column count.
export function ruledGrid(im){
 const {width:w,height:h,data}=im,px=new Uint32Array(w),py=new Uint32Array(h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=(y*w+x)*4;if((data[p]+data[p+1]+data[p+2])/3<85){px[x]++;py[y]++;}
 }
 const peaks=(arr,min)=>{const a=[];let start=-1;for(let i=0;i<=arr.length;i++){
  if(i<arr.length&&arr[i]>=min){if(start<0)start=i;}else if(start>=0){a.push(Math.round((start+i-1)/2));start=-1;}
 }return a;};
 const xs=peaks(px,h*.65),ys=peaks(py,w*.65);
 if(xs.length<3||ys.length<3||xs.length>80||ys.length>502||xs.some((v,i)=>i&&v-xs[i-1]<12)||ys.some((v,i)=>i&&v-ys[i-1]<12))return null;
 return {xs,ys,rows:ys.length-1,cols:xs.length-1};
}
export function assignGrid(items,grid){
 const {xs,ys,rows,cols}=grid;
 const cells=Array.from({length:rows},()=>Array.from({length:cols},()=>[]));let outside=0;
 for(const item of items){
  const x=item.poly.reduce((s,p)=>s+p[0],0)/item.poly.length,y=item.poly.reduce((s,p)=>s+p[1],0)/item.poly.length;
  const col=xs.findIndex((v,i)=>i>0&&x>xs[i-1]&&x<v)-1,row=ys.findIndex((v,i)=>i>0&&y>ys[i-1]&&y<v)-1;
  if(row<0||col<0){outside++;continue;}cells[row][col].push({x,y,text:item.text,score:item.score});
 }
 return {rows:cells.map(row=>row.map(cell=>cell.sort((a,b)=>a.y-b.y||a.x-b.x).map(i=>i.text).join(' '))),outside};
}
