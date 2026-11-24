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
 private static final int MAX_SIDE=2400, MAX_PAGES=10;
 private static File prepare(Context context)throws IOException{
  File base=new File(context.getFilesDir(),"ocr-v1"),data=new File(base,"tessdata");
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
 static String read(Context context,Uri uri)throws IOException{
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
   try{return text(tess,image);}finally{image.recycle();}
  }finally{tess.recycle();}
 }
 private static String text(TessBaseAPI tess,Bitmap b){tess.setImage(b);String s=tess.getUTF8Text();return s==null?"":s;}
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
