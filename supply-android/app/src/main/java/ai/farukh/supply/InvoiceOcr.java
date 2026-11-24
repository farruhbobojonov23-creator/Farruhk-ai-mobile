package ai.farukh.supply;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.ImageDecoder;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.os.Build;
import android.graphics.BitmapFactory;
import com.googlecode.tesseract.android.TessBaseAPI;
import java.io.*;
import java.util.Locale;
final class InvoiceOcr {
 private static final int MAX_SIDE=3200, MAX_PAGES=10;
 private static File prepare(Context context)throws IOException{
  File base=new File(context.getFilesDir(),"ocr-v2"),data=new File(base,"tessdata");
  if(!data.isDirectory()&&!data.mkdirs())throw new IOException("OCR directory");
  for(String lang:new String[]{"rus","eng"}){
   File dst=new File(data,lang+".traineddata");
   if(dst.length()>100000)continue;
   File temp=new File(data,lang+".tmp");
   try(InputStream in=context.getAssets().open("tessdata/"+lang+".traineddata");OutputStream out=new FileOutputStream(temp)){
    byte[] buf=new byte[16384];int count;while((count=in.read(buf))!=-1)out.write(buf,0,count);
   }
   if(temp.length()<100000||!temp.renameTo(dst))throw new IOException("OCR model");
  }
  return base;
 }
 static String read(Context context,Uri uri,boolean focused)throws IOException{
  TessBaseAPI tess=new TessBaseAPI();
  try{
   if(!tess.init(prepare(context).getAbsolutePath(),"rus+eng"))throw new IOException("OCR init");
   String mime=context.getContentResolver().getType(uri);
   if("application/pdf".equals(mime))return pdf(context,uri,tess);
   Bitmap image;
   if(Build.VERSION.SDK_INT>=28){
    image=ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.getContentResolver(),uri),(decoder,info,src)->{
     int w=info.getSize().getWidth(),h=info.getSize().getHeight();float ratio=Math.min(1f,(float)MAX_SIDE/Math.max(w,h));
     decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);decoder.setTargetSize(Math.max(1,Math.round(w*ratio)),Math.max(1,Math.round(h*ratio)));
    });
   }else{
    BitmapFactory.Options opt=new BitmapFactory.Options();opt.inJustDecodeBounds=true;
    try(InputStream in=context.getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,opt);}
    opt.inSampleSize=1;while(Math.max(opt.outWidth,opt.outHeight)/opt.inSampleSize>MAX_SIDE)opt.inSampleSize*=2;
    opt.inJustDecodeBounds=false;try(InputStream in=context.getContentResolver().openInputStream(uri)){image=BitmapFactory.decodeStream(in,null,opt);}
   }
   if(image==null)throw new IOException("Image");
   try{
    Bitmap prepared=prepareImage(image,focused);
    try{return text(tess,prepared);}finally{if(prepared!=image)prepared.recycle();}
   }finally{image.recycle();}
  }finally{tess.recycle();}
 }
 static String readPaddle(Context context,Uri uri)throws IOException{
  if("application/pdf".equals(context.getContentResolver().getType(uri)))throw new IOException("Photo only");
  Bitmap image;
  if(Build.VERSION.SDK_INT>=28){
   image=ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.getContentResolver(),uri),(decoder,info,src)->{
    int w=info.getSize().getWidth(),h=info.getSize().getHeight();float ratio=Math.min(1f,3200f/Math.max(w,h));
    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);decoder.setTargetSize(Math.max(1,Math.round(w*ratio)),Math.max(1,Math.round(h*ratio)));
   });
  }else{
   BitmapFactory.Options opt=new BitmapFactory.Options();opt.inJustDecodeBounds=true;
   try(InputStream in=context.getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,opt);}
   opt.inSampleSize=1;while(Math.max(opt.outWidth,opt.outHeight)/opt.inSampleSize>3200)opt.inSampleSize*=2;
   opt.inJustDecodeBounds=false;try(InputStream in=context.getContentResolver().openInputStream(uri)){image=BitmapFactory.decodeStream(in,null,opt);}
  }
  if(image==null)throw new IOException("Image");
  try{return com.paddle.ocr.SupplyPaddleBridge.read(context,image).plainText();}finally{image.recycle();}
 }
 private static String text(TessBaseAPI tess,Bitmap b){tess.setVariable("preserve_interword_spaces","1");tess.setImage(b);String s=tess.getUTF8Text();return s==null?"":s;}
 // Remove dark screenshot margins only if a broad, continuous white document region is found.
 private static Bitmap prepareImage(Bitmap image,boolean focused){
  int w=image.getWidth(),h=image.getHeight(),start=-1,bestStart=0,bestEnd=h,bestLength=0;
  for(int y=0;y<h;y+=4){
   int white=0,samples=0;
   for(int x=w/10;x<w-w/10;x+=Math.max(1,w/70)){
    int c=image.getPixel(x,y);if(android.graphics.Color.red(c)>190&&android.graphics.Color.green(c)>190&&android.graphics.Color.blue(c)>190)white++;samples++;
   }
   boolean paper=samples>0&&white>=samples*.72;
   if(paper&&start<0)start=y;
   if((!paper||y+4>=h)&&start>=0){int end=Math.min(h,y+4);if(end-start>bestLength){bestLength=end-start;bestStart=start;bestEnd=end;}start=-1;}
  }
  // Keep the full image unless the likely paper spans most of its height.
  Bitmap region=image;
  if(focused){
   int top=bestLength>h*.35?Math.max(0,bestStart-12):0;
   int end=bestLength>h*.35?bestEnd:h;
   int bottom=Math.min(h,top+Math.round((end-top)*.62f));
   if(bottom-top>h*.2)region=Bitmap.createBitmap(image,0,top,w,bottom-top);
  }else if(bestLength>h*.85&&bestLength<h*.94){
   int top=Math.max(0,bestStart-24),bottom=Math.min(h,bestEnd+24);
   region=Bitmap.createBitmap(image,0,top,w,bottom-top);
  }
  float scale=Math.min(2f,Math.max(1f,2800f/Math.max(region.getWidth(),region.getHeight())));
  Bitmap gray=Bitmap.createBitmap(Math.round(region.getWidth()*scale),Math.round(region.getHeight()*scale),Bitmap.Config.ARGB_8888);
  android.graphics.Canvas canvas=new android.graphics.Canvas(gray);canvas.drawColor(android.graphics.Color.WHITE);
  android.graphics.Paint paint=new android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG);
  android.graphics.ColorMatrix matrix=new android.graphics.ColorMatrix();matrix.setSaturation(0);
  android.graphics.ColorMatrix contrast=new android.graphics.ColorMatrix(new float[]{1.18f,0,0,0,-22,0,1.18f,0,0,-22,0,0,1.18f,0,-22,0,0,0,1,0});matrix.postConcat(contrast);
  paint.setColorFilter(new android.graphics.ColorMatrixColorFilter(matrix));
  canvas.drawBitmap(region,null,new android.graphics.Rect(0,0,gray.getWidth(),gray.getHeight()),paint);
  if(region!=image)region.recycle();return gray;
 }
 private static String pdf(Context context,Uri uri,TessBaseAPI tess)throws IOException{
  ParcelFileDescriptor fd=context.getContentResolver().openFileDescriptor(uri,"r");if(fd==null)throw new IOException("PDF");
  PdfRenderer renderer;try{renderer=new PdfRenderer(fd);}catch(Exception e){fd.close();throw new IOException("PDF renderer",e);}
  try(PdfRenderer pdf=renderer){
   StringBuilder out=new StringBuilder();int pages=Math.min(pdf.getPageCount(),MAX_PAGES);
   for(int i=0;i<pages;i++){
    if(Thread.currentThread().isInterrupted())throw new IOException("Cancelled");
    try(PdfRenderer.Page page=pdf.openPage(i)){
     float ratio=(float)MAX_SIDE/Math.max(page.getWidth(),page.getHeight());
     Bitmap bitmap=Bitmap.createBitmap(Math.max(1,Math.round(page.getWidth()*ratio)),Math.max(1,Math.round(page.getHeight()*ratio)),Bitmap.Config.ARGB_8888);
     try{bitmap.eraseColor(android.graphics.Color.WHITE);page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);out.append("\n--- Страница ").append(i+1).append(" ---\n").append(text(tess,bitmap));}finally{bitmap.recycle();}
    }
   }
   if(pdf.getPageCount()>MAX_PAGES)out.append("\nРаспознаны только первые 10 страниц. Остальные проверьте вручную.");
   return out.toString();
  }
 }
}
