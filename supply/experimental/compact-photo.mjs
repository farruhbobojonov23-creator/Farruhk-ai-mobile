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


// Re-read every required cell directly from its pixels, not from page OCR text.
// A second contrast rendering is used when the independent readings disagree.
export async function readCell(im,grid,row,col,s,{contrast=false}={}){
 const l=grid.xs[col]+3,t=grid.ys[row]+3,r=grid.xs[col+1]-3,b=grid.ys[row+1]-3;
 let x0=r,y0=b,x1=l,y1=t;
 for(let y=t;y<b;y++)for(let x=l;x<r;x++){
  const p=(y*im.width+x)*4;
  if((im.data[p]+im.data[p+1]+im.data[p+2])/3<150){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 }
 if(x1<x0||y1<y0)return '';
 x0=Math.max(l,x0-3);y0=Math.max(t,y0-3);x1=Math.min(r-1,x1+3);y1=Math.min(b-1,y1+3);
 const w=x1-x0+1,h=y1-y0+1,c=document.createElement('canvas');
 const cw=Math.min(960,Math.max(12,Math.round(w*48/h)));c.width=cw;c.height=48;
 const raw=document.createElement('canvas');raw.width=w;raw.height=h;const rc=raw.getContext('2d'),pixels=rc.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=((y+y0)*im.width+x+x0)*4,k=(y*w+x)*4;
  for(let j=0;j<3;j++){const a=im.data[p+j];pixels.data[k+j]=contrast?Math.max(0,Math.min(255,(a-100)*1.8+100)):a;}
  pixels.data[k+3]=255;
 }
 rc.putImageData(pixels,0,0);const ctx=c.getContext('2d');ctx.drawImage(raw,0,0,cw,48);
 const d=ctx.getImageData(0,0,cw,48).data,width=Math.ceil((cw+16)/64)*64,n=48*width,buf=new Float32Array(3*n);
 for(let y=0;y<48;y++)for(let x=0;x<cw;x++)for(let k=0;k<3;k++)buf[k*n+y*width+x]=d[(y*cw+x)*4+2-k]/127.5-1;
 const out=Object.values(await s.rec.run({[s.rec.inputNames[0]]:new s.ort.Tensor('float32',buf,[1,3,48,width])}))[0];
 try{const T=out.dims[1],C=out.dims[2];if(C!==s.chars.length)throw Error('Model dictionary mismatch');let prev=-1,value='';
 for(let t=0;t<T;t++){let k=0;for(let j=1;j<C;j++)if(out.data[t*C+j]>out.data[t*C+k])k=j;if(k&&k!==prev)value+=s.chars[k];prev=k;}return value.trim();
 }finally{out.dispose?.();}
}
const num=s=>/^\d+(?:[,.]\d+)?$/.test(String(s).replace(/\s/g,''))?Number(String(s).replace(/\s/g,'').replace(',','.')):NaN;
export function verifiedNumbers(readings){
 // Independent OCR candidates only; arithmetic is a filter, never a generator.
 const choices=readings.map(a=>[...new Set(a.map(num).filter(v=>Number.isFinite(v)&&v>0))]);
 const candidates=[];for(const q of choices[0])for(const p of choices[1])for(const a of choices[2]){
  if(Math.abs(Math.round(q*p*100)-Math.round(a*100))<=1)candidates.push([q,p,a]);
 }
 return candidates.length===1?candidates[0]:null;
}
export async function verifyGridCells(im,grid,assigned,s){
 const rows=assigned.rows.map(r=>r.slice()),review=[];
 const head=rows[0].map(v=>v.toLowerCase());
 const name=head.findIndex(v=>/наименован|товар/.test(v)),qty=head.findIndex(v=>/кол.?во|количество/.test(v)),price=head.findIndex(v=>/цен[аы].*ндс/.test(v)&&!v.includes('без')),amount=head.findIndex(v=>/сумма/.test(v)&&!v.includes('ндс'));
 if([name,qty,price,amount].some(v=>v<0)||new Set([name,qty,price,amount]).size!==4)return {rows,review:['Не подтверждены колонки'],verified:false};
 for(let i=1;i<rows.length;i++){
  if(rows[i].some(v=>/^итого|^всего/i.test(v)))continue;
  const cols=[qty,price,amount],readings=[];
  for(const j of cols){
   const a=await readCell(im,grid,i,j,s),b=await readCell(im,grid,i,j,s,{contrast:true});readings.push([rows[i][j],a,b]);
  }
  const verified=verifiedNumbers(readings);
  if(!verified){review.push('Строка '+i+': цифры не подтверждены');continue;}
  cols.forEach((j,k)=>rows[i][j]=String(verified[k]).replace('.',','));
  const a=await readCell(im,grid,i,name,s),b=await readCell(im,grid,i,name,s,{contrast:true});
  if(a&&a===b)rows[i][name]=a;else if(!a||a!==rows[i][name])review.push('Строка '+i+': название требует сверки');
 }
 const totals=rows.filter(r=>r.some(v=>/^итого|^всего/i.test(v)));
 const sum=rows.slice(1).filter(r=>!r.some(v=>/^итого|^всего/i.test(v))).reduce((s,r)=>s+Math.round(num(r[amount])*100),0);
 if(totals.length!==1||!Number.isFinite(sum)||sum!==Math.round(num(totals[0]?.[amount])*100))review.push('Итог не подтверждён');
 return {rows,review,verified:review.length===0&&assigned.ambiguous===0};
}
