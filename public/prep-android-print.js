// Native FARUKH AI companion: direct TSPL bitmap 31×20 mm for semi-finished labels.
// In a normal browser marking.html retains its existing Android/desktop print dialog.
if(window.FarukhPrinter?.postMessage){
  const W=248,H=160,pxByte=W/8;
  const $=id=>document.getElementById(id);
  const status=document.createElement('div');
  status.id='prep-native-status';
  status.style.cssText='padding:9px 12px;margin:10px 0;border-radius:9px;font-size:12px;background:#ecf9f2;color:#285d47;line-height:1.5';
  status.textContent='Android-приложение: печать 31 × 20 мм напрямую по Bluetooth.';
  $('status')?.after(status);
  const change=document.createElement('button');
  change.className='soft';change.type='button';change.textContent='⌁ Выбрать V3 BT';
  $('print')?.after(change);
  let busy=false;
  const post=value=>window.FarukhPrinter.postMessage(JSON.stringify(value));
  window.FarukhPrinter.onmessage=event=>{
    busy=false;
    try{const value=JSON.parse(event.data);status.textContent=value.message||'Ответ принтера.';status.style.background=value.ok?'#ecf9f2':'#fff3f2';status.style.color=value.ok?'#285d47':'#a33c41'}
    catch{status.textContent='Ответ принтера получен.'}
  };
  change.onclick=()=>{if(busy)return;busy=true;status.textContent='Выбираю Bluetooth-принтер…';try{post({type:'select'})}catch(e){busy=false;status.textContent=e.message}};
  const drawText=(g,text,x,y,size,maxWidth,min=8,bold=true,align='left')=>{
    let current=size;
    const value=String(text||'');
    do{g.font=(bold?'bold ':'')+current+'px Arial,sans-serif';if(g.measureText(value).width<=maxWidth||current<=min)break;current-=.5}while(current>min);
    g.textAlign=align;g.fillText(value,x,y);
  };
  function drawLabel(obj){
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const g=canvas.getContext('2d',{willReadFrequently:true});
    if(!g)throw Error('Печать Canvas не поддерживается.');
    g.fillStyle='#fff';g.fillRect(0,0,W,H);
    g.fillStyle='#000';g.strokeStyle='#000';g.lineWidth=2;g.textBaseline='middle';
    g.strokeRect(3,3,242,154);
    drawText(g,'FARUKH AI · МАРКИРОВКА',10,14,9,188,7);
    drawText(g,'П/Ф',237,14,9,35,7,true,'right');
    g.beginPath();g.moveTo(9,24);g.lineTo(239,24);g.stroke();
    const name=String(obj.name||'').toUpperCase();
    drawText(g,name,124,41,17,226,9,true,'center');
    g.beginPath();g.moveTo(9,56);g.lineTo(239,56);g.stroke();
    drawText(g,'Изготовлено:',10,72,11,104,8);
    drawText(g,obj.made,238,72,12,120,9,true,'right');
    g.strokeRect(9,87,230,30);
    drawText(g,'Годен до:',14,103,10,86,8);
    drawText(g,obj.expires,234,103,13,137,9,true,'right');
    g.beginPath();g.moveTo(9,131);g.lineTo(239,131);g.stroke();
    drawText(g,obj.storage,10,144,11,151,8);
    drawText(g,obj.point,238,144,10,76,7,true,'right');
    return canvas;
  }
  function bytesForLabel(obj,copies){
    if(!Number.isInteger(copies)||copies<1||copies>20)throw Error('Допустимо от 1 до 20 этикеток.');
    const can=drawLabel(obj);
    const rgba=can.getContext('2d').getImageData(0,0,W,H).data;
    const bits=new Uint8Array(pxByte*H);bits.fill(255);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const pos=(y*W+x)*4;
      const dark=(rgba[pos]*299+rgba[pos+1]*587+rgba[pos+2]*114)/1000<164;
      if(dark&&rgba[pos+3]>80)bits[y*pxByte+(x>>3)]&=~(0x80>>(x&7));
    }
    const encode=new TextEncoder();
    const head=encode.encode('\r\nSIZE 31 mm,20 mm\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,31,160,0,');
    const tail=encode.encode('\r\nPRINT 1,'+copies+'\r\n');
    const all=new Uint8Array(head.length+bits.length+tail.length);all.set(head);all.set(bits,head.length);all.set(tail,head.length+bits.length);return all;
  }
  const base64=bytes=>{
    let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary);
  };
  window.FARUKH_PREP_NATIVE_PRINT=(label,copies)=>{
    if(busy){status.textContent='Предыдущая печать ещё выполняется.';return}
    busy=true;
    try{
      const bytes=bytesForLabel(label,copies);
      post({type:'print',tspl:base64(bytes)});
      status.textContent='Отправляю '+copies+' шт. на V3 BT…';
    }catch(e){busy=false;status.textContent='Печать не выполнена: '+e.message}
  };
}
