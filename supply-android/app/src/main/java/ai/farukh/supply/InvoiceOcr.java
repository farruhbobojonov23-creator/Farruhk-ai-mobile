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
 // Worker-thread-only cache, keyed by a new token for each selected photo.
 static final class PhotoSession implements AutoCloseable {
  private Bitmap oriented;
  private Uri uri;
  private long token=Long.MIN_VALUE;
  private int preparations;
  private boolean weakLayout;
  int preparations(){return preparations;}
  void select(Uri next,long nextToken){
   if(nextToken!=token||!java.util.Objects.equals(next,uri)){close();uri=next;token=nextToken;}
  }
  Bitmap get(Context context,Uri next,long nextToken,TessBaseAPI tess)throws IOException{
   select(next,nextToken);
   if(oriented!=null&&!oriented.isRecycled())return oriented;
   long started=android.os.SystemClock.elapsedRealtime();
   Bitmap image=decode(context,next);
   try{oriented=orient(tess,image);preparations++;android.util.Log.i("SupplyOCR","Photo preparation ms="+(android.os.SystemClock.elapsedRealtime()-started));return oriented;}
   finally{if(oriented!=image)image.recycle();}
  }
  @Override public void close(){if(oriented!=null){oriented.recycle();oriented=null;}uri=null;token=Long.MIN_VALUE;weakLayout=false;}
 }
 private static Bitmap decode(Context context,Uri uri)throws IOException{
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

  return image;
 }
 static String read(Context context,Uri uri,boolean focused,PhotoSession session,long token)throws IOException{
  session.select(uri,token);
  TessBaseAPI tess=new TessBaseAPI();
  try{
   if(!tess.init(prepare(context).getAbsolutePath(),"rus+eng"))throw new IOException("OCR init");
   if("application/pdf".equals(context.getContentResolver().getType(uri)))return pdf(context,uri,tess);
   Bitmap oriented=session.get(context,uri,token,tess);
   if(focused&&session.weakLayout){
    // A low-quality full read can mean the orientation probe selected a
    // sideways document. Re-evaluate cardinal alternatives at full size.
    // Keep the best candidate for the following Paddle pass.
    String best="";int bestScore=Integer.MIN_VALUE;Bitmap chosen=oriented;
    try{
     for(int degrees:new int[]{0,90,180,270}){
      Bitmap candidate=rotate(oriented,degrees);
      try{
       Bitmap prepared=prepareImage(candidate,false);
       String recognized;
       try{tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);recognized=text(tess,prepared);}
       finally{if(prepared!=candidate)prepared.recycle();}
       int score=orientationScore(recognized,tess.meanConfidence());
       if(score>bestScore){if(chosen!=oriented)chosen.recycle();chosen=candidate;candidate=null;bestScore=score;best=recognized;}
      }finally{if(candidate!=null&&candidate!=oriented)candidate.recycle();}
     }
     if(chosen!=oriented){session.oriented=chosen;oriented.recycle();oriented=chosen;}
     session.weakLayout=false;
     if(layoutScore(best)>0)return best;
    }finally{if(chosen!=session.oriented&&chosen!=oriented&&!chosen.isRecycled())chosen.recycle();}
   }
   if(focused){
    Bitmap improved=null;
    try{
     improved=enhanceTable(oriented);
     if(improved!=null){
      tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_SINGLE_BLOCK);
      String result=text(tess,improved);
      if(result.trim().length()>60)return result;
     }
    }catch(RuntimeException|LinkageError ignored){}
    finally{if(improved!=null)improved.recycle();}
   }
   tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);
   Bitmap prepared=prepareImage(oriented,focused);
   try{String result=text(tess,prepared);if(!focused)session.weakLayout=layoutScore(result)<=0;return result;}finally{if(prepared!=oriented)prepared.recycle();}
  }finally{tess.recycle();}
 }
 static String readPaddle(Context context,Uri uri,PhotoSession session,long token)throws IOException{
  session.select(uri,token);
  if("application/pdf".equals(context.getContentResolver().getType(uri)))throw new IOException("Photo only");
  Bitmap oriented=session.oriented;
  if(oriented==null){
   TessBaseAPI tess=new TessBaseAPI();
   try{
    if(!tess.init(prepare(context).getAbsolutePath(),"rus+eng"))throw new IOException("OCR init");
    oriented=session.get(context,uri,token,tess);
   }finally{tess.recycle();}
  }
  return com.paddle.ocr.SupplyPaddleBridge.read(context,oriented).plainText();
 }

 // Rotations are applied only to a working copy, never to the original.
 static Bitmap rotate(Bitmap source,float degrees){
  if(Math.abs(degrees)<.05f)return source;
  android.graphics.Matrix m=new android.graphics.Matrix();m.setRotate(degrees);
  android.graphics.RectF bounds=new android.graphics.RectF(0,0,source.getWidth(),source.getHeight());
  m.mapRect(bounds);m.postTranslate(-bounds.left,-bounds.top);
  Bitmap result=Bitmap.createBitmap(Math.max(1,(int)Math.ceil(bounds.width()-.001)),Math.max(1,(int)Math.ceil(bounds.height()-.001)),Bitmap.Config.ARGB_8888);
  android.graphics.Canvas canvas=new android.graphics.Canvas(result);canvas.drawColor(android.graphics.Color.WHITE);
  canvas.drawBitmap(source,m,new android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG));return result;
 }
 // Estimate small or diagonal tilt modulo 90 degrees from long table rules.
 // A reliable consensus is required; arbitrary photographs stay unmodified.
 private static float tilt(Bitmap image){
  try{if(!org.opencv.android.OpenCVLoader.initLocal())return 0;}catch(RuntimeException|LinkageError ignored){return 0;}
  org.opencv.core.Mat rgba=new org.opencv.core.Mat(),gray=new org.opencv.core.Mat(),edges=new org.opencv.core.Mat(),segments=new org.opencv.core.Mat();
  try{
   org.opencv.android.Utils.bitmapToMat(image,rgba);
   org.opencv.imgproc.Imgproc.cvtColor(rgba,gray,org.opencv.imgproc.Imgproc.COLOR_RGBA2GRAY);
   org.opencv.imgproc.Imgproc.Canny(gray,edges,50,140);
   double side=Math.min(gray.cols(),gray.rows());
   org.opencv.imgproc.Imgproc.HoughLinesP(edges,segments,1,Math.PI/720,Math.max(35,(int)(side*.10)),side*.25,side*.025);
   java.util.ArrayList<double[]> votes=new java.util.ArrayList<>();
   for(int i=0;i<segments.rows();i++){
    double[] line=segments.get(i,0);if(line==null||line.length<4)continue;
    double dx=line[2]-line[0],dy=line[3]-line[1],len=Math.hypot(dx,dy);
    if(len<side*.25)continue;
    double angle=Math.toDegrees(Math.atan2(dy,dx));
    angle=((angle+225)%90)-45;votes.add(new double[]{angle,len});
   }
   double best=0,weight=0,total=0;int support=0;
   for(double[] v:votes)total+=v[1];
   for(double[] v:votes){double sum=0,weighted=0;int count=0;
    for(double[] x:votes){double delta=x[0]-v[0];if(delta>45)delta-=90;if(delta< -45)delta+=90;if(Math.abs(delta)<=2.5){sum+=x[1];weighted+=(v[0]+delta)*x[1];count++;}}
    if(sum>weight){weight=sum;best=weighted/sum;support=count;}
   }
   if(support<4||weight<total*.65||Math.abs(best)<.7)return 0;
   best=((best+225)%90)-45;return (float)-best;
  }catch(RuntimeException|LinkageError ignored){return 0;}
  finally{rgba.release();gray.release();edges.release();segments.release();}
 }
 private static final String[] WORDS={"накладная","накладной","поставщик","продавец","покупатель","наименование","товара","количество","стоимость","оплате","отгружено","передачи","документ","сумма","цена","акциза","единица","измерения","итого","фактура"};
 static int orientationScore(String text,int confidence){
  String s=text.toLowerCase(Locale.ROOT);
  int hits=0;for(String word:WORDS)if(s.contains(word))hits++;
  java.util.regex.Matcher matcher=java.util.regex.Pattern.compile("[а-яё]{4,}").matcher(s);
  int words=0;while(matcher.find())words++;
  java.util.regex.Matcher amounts=java.util.regex.Pattern.compile("\\d+[,.]\\d{2}(?!\\d)").matcher(s);
  int numbers=0;while(amounts.find())numbers++;
  return hits*80+Math.min(words,180)*2+Math.min(numbers,60)*3+Math.max(0,confidence)*3+layoutScore(s);
 }
 // Auto segmentation may recognize a sideways document column by column.
 // Reward header -> table -> totals order and names with numeric cells on
 // the same line; penalize reversed header/footer and long numeric columns.
 static int layoutScore(String text){
  String s=text.toLowerCase(Locale.ROOT);
  java.util.regex.Matcher head=java.util.regex.Pattern.compile("сч[её]т[- ]фактура|товарная накладная|поставщик\\s*:|универсальный передаточный документ").matcher(s);
  java.util.regex.Matcher foot=java.util.regex.Pattern.compile("всего\\s+к\\s+оплате|итого\\s+к\\s+оплате|итого\\s+по\\s+накладной").matcher(s);
  int score=0;
  if(head.find()&&foot.find())score+=head.start()<foot.start()?700:-1100;
  java.util.regex.Pattern cash=java.util.regex.Pattern.compile("\\d+[.,]\\d{2}(?!\\d)");
  java.util.regex.Pattern qty=java.util.regex.Pattern.compile("\\d+[.,]\\d{3}(?!\\d)");
  int rows=0,columns=0;
  for(String line:s.split("\\r?\\n")){
   java.util.regex.Matcher m=cash.matcher(line);int amounts=0;while(m.find())amounts++;
   boolean letters=line.matches(".*[а-яё]{3,}.*");
   if(letters&&amounts>=1&&qty.matcher(line).find())rows++;
   if(!letters&&amounts>=3)columns++;
  }
  return score+Math.min(rows,12)*180-Math.min(columns,8)*150;
 }
 // A clear, correctly ordered invoice is strong evidence for the default orientation.
 // Keep all four probes for rotated, incomplete or low-confidence documents.
 static boolean canSkipOtherOrientations(String text,int confidence){
  if(confidence<85||layoutScore(text)<700)return false;
  String s=text.toLowerCase(Locale.ROOT);
  return s.contains("наименование")&&(s.contains("количество")||s.contains("стоимость"))&&
    (s.contains("поставщик")||s.contains("продавец"))&&
    (s.contains("всего к оплате")||s.contains("итого к оплате")||s.contains("итого по накладной"));
 }
 // Probe the default direction first; use all cardinal directions if evidence is weak.
 static Bitmap orient(TessBaseAPI tess,Bitmap image){
  float scale=Math.min(1f,1600f/Math.max(image.getWidth(),image.getHeight()));
  Bitmap small=scale<1?Bitmap.createScaledBitmap(image,Math.max(1,Math.round(image.getWidth()*scale)),Math.max(1,Math.round(image.getHeight()*scale)),true):image;
  Bitmap straight=small;
  try{
   float correction=tilt(small);straight=rotate(small,correction);
   int best=0,bestScore=Integer.MIN_VALUE;
   for(int degrees:new int[]{0,90,180,270}){
    if(Thread.currentThread().isInterrupted())break;
    Bitmap probe=rotate(straight,degrees);
    try{
     tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);
     String recognized=text(tess,probe);int confidence=tess.meanConfidence();int score=orientationScore(recognized,confidence);
      if(score>bestScore){bestScore=score;best=degrees;}
      if(degrees==0&&canSkipOtherOrientations(recognized,confidence))break;
    }finally{if(probe!=straight)probe.recycle();}
   }
   tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);
   return rotate(image,correction+best);
  }finally{if(straight!=small)straight.recycle();if(small!=image)small.recycle();}
 }
 static String readOrientedForTest(Context context,Bitmap image)throws IOException{
  TessBaseAPI tess=new TessBaseAPI();
  try{
   if(!tess.init(prepare(context).getAbsolutePath(),"rus+eng"))throw new IOException("OCR init");
   Bitmap rotated=orient(tess,image);
   try{return text(tess,rotated);}finally{if(rotated!=image)rotated.recycle();}
  }finally{tess.recycle();}
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
   int bottom=Math.min(h,end+24);
   if(bestLength>h*.85&&bottom-top>h*.85)region=Bitmap.createBitmap(image,0,top,w,bottom-top);
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
 
 // Experimental focused path: straighten long table rules and suppress uneven illumination.
 // Never alter the original photo. This path is only used by the existing /rescan route.
 private static Bitmap enhanceTable(Bitmap image){
  if(!org.opencv.android.OpenCVLoader.initLocal())return null;
  org.opencv.core.Mat rgba=new org.opencv.core.Mat(),gray=new org.opencv.core.Mat(),edges=new org.opencv.core.Mat(),segments=new org.opencv.core.Mat(),rotated=new org.opencv.core.Mat(),background=new org.opencv.core.Mat(),normalized=new org.opencv.core.Mat(),up=new org.opencv.core.Mat(),matrix=null,roi=null;
  try{
   org.opencv.android.Utils.bitmapToMat(image,rgba);
   org.opencv.imgproc.Imgproc.cvtColor(rgba,gray,org.opencv.imgproc.Imgproc.COLOR_RGBA2GRAY);
   int w=gray.cols(),h=gray.rows();
   if(w<300||h<300)return null;
   org.opencv.imgproc.Imgproc.Canny(gray,edges,45,125);
   org.opencv.imgproc.Imgproc.HoughLinesP(edges,segments,1,Math.PI/1800,Math.max(45,w/14),w*.32,Math.max(15,w*.03));
   java.util.ArrayList<Double> angles=new java.util.ArrayList<>();
   for(int i=0;i<segments.rows();i++){
    double[] line=segments.get(i,0);if(line==null||line.length<4)continue;
    double dx=line[2]-line[0],dy=line[3]-line[1],cy=(line[1]+line[3])/2;
    if(cy<h*.16||cy>h*.62||Math.abs(dx)<w*.30)continue;
    double a=Math.toDegrees(Math.atan2(dy,dx));if(a>90)a-=180;if(a< -90)a+=180;
    if(Math.abs(a)<=12)angles.add(a);
   }
   java.util.Collections.sort(angles);
   double angle=angles.size()>=3?angles.get(angles.size()/2):0;
   matrix=org.opencv.imgproc.Imgproc.getRotationMatrix2D(new org.opencv.core.Point(w/2.0,h/2.0),angle,1);
   org.opencv.imgproc.Imgproc.warpAffine(gray,rotated,matrix,new org.opencv.core.Size(w,h),org.opencv.imgproc.Imgproc.INTER_CUBIC,org.opencv.core.Core.BORDER_CONSTANT,new org.opencv.core.Scalar(255));
   // Keep the header, all columns and the total on TTN-style documents. Full original is a separate OCR pass.
   org.opencv.core.Rect table=findTable(rotated);
   if(table!=null){
    int left=Math.max(0,table.x-w/60),right=Math.min(w,table.x+table.width+w/60);
    int top=Math.max(0,table.y-h/45),bottom=Math.min(h,table.y+table.height+h/35);
    roi=rotated.submat(top,bottom,left,right);
   }else roi=rotated.submat(0,h,0,w);
   double sigma=Math.max(12,w/70.0);
   org.opencv.imgproc.Imgproc.GaussianBlur(roi,background,new org.opencv.core.Size(0,0),sigma);
   org.opencv.core.Core.divide(roi,background,normalized,235);
   double scale=Math.max(1,Math.min(3,3000.0/roi.cols()));
   org.opencv.imgproc.Imgproc.resize(normalized,up,new org.opencv.core.Size(),scale,scale,org.opencv.imgproc.Imgproc.INTER_CUBIC);
   Bitmap out=Bitmap.createBitmap(up.cols(),up.rows(),Bitmap.Config.ARGB_8888);
   org.opencv.android.Utils.matToBitmap(up,out);return out;
  }finally{
   if(roi!=null)roi.release();if(matrix!=null)matrix.release();
   for(org.opencv.core.Mat m:new org.opencv.core.Mat[]{rgba,gray,edges,segments,rotated,background,normalized,up})m.release();
  }
 }

 // Detect the connected ruled table instead of enlarging the whole page.
 // Reject narrow barcodes, page borders and isolated decorative lines.
 private static org.opencv.core.Rect findTable(org.opencv.core.Mat gray){
  int w=gray.cols(),h=gray.rows(),top=(int)(h*.06),bottom=(int)(h*.96);
  org.opencv.core.Mat band=gray.submat(top,bottom,0,w),binary=new org.opencv.core.Mat(),closed=new org.opencv.core.Mat(),hierarchy=new org.opencv.core.Mat(),kernel=null;
  java.util.ArrayList<org.opencv.core.MatOfPoint> contours=new java.util.ArrayList<>();
  try{
   int block=Math.max(35,((w/35)|1));
   org.opencv.imgproc.Imgproc.adaptiveThreshold(band,binary,255,org.opencv.imgproc.Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,org.opencv.imgproc.Imgproc.THRESH_BINARY_INV,block,9);
   kernel=org.opencv.imgproc.Imgproc.getStructuringElement(org.opencv.imgproc.Imgproc.MORPH_RECT,new org.opencv.core.Size(3,3));
   org.opencv.imgproc.Imgproc.morphologyEx(binary,closed,org.opencv.imgproc.Imgproc.MORPH_CLOSE,kernel);
   org.opencv.imgproc.Imgproc.findContours(closed,contours,hierarchy,org.opencv.imgproc.Imgproc.RETR_EXTERNAL,org.opencv.imgproc.Imgproc.CHAIN_APPROX_SIMPLE);
   org.opencv.core.Rect best=null;double score=0;
   for(org.opencv.core.MatOfPoint contour:contours){
    org.opencv.core.Rect b=org.opencv.imgproc.Imgproc.boundingRect(contour);
    double area=org.opencv.imgproc.Imgproc.contourArea(contour);
    if(b.width<w*.56||b.height<h*.055||b.height>h*.82||b.width>4.0*b.height*3||area<b.area()*.30)continue;
    if(area>score){score=area;best=new org.opencv.core.Rect(b.x,b.y+top,b.width,b.height);}
   }
   return best;
  }finally{for(org.opencv.core.MatOfPoint contour:contours)contour.release();if(kernel!=null)kernel.release();band.release();binary.release();closed.release();hierarchy.release();}
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
