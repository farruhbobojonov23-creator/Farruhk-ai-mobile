package ai.farukh.supply;

import android.graphics.Bitmap;
import com.googlecode.tesseract.android.TessBaseAPI;
import org.opencv.android.Utils;
import org.opencv.core.*;
import org.opencv.imgproc.Imgproc;
import java.util.*;
import java.util.regex.*;

/** Offline, ruled UPD only. A failed or ambiguous grid never replaces ordinary OCR. */
final class UpdCellOcr {
 static final class Rule {
  final int pos; final double slope,score,mid;
  Rule(int p,double s,double q,double m){pos=p;slope=s;score=q;mid=m;}
  double at(double x){return pos+slope*(x-mid);}
 }
 static final class Grid {
  final List<Rule> h,v;
  Grid(List<Rule> h,List<Rule> v){this.h=h;this.v=v;}
  int rows(){return h.size()-4;}
 }
 // Project long ink rules with small perspective slopes. This is not text OCR.
 static List<Rule> profile(byte[] pixels,int w,int h,boolean vertical,int start,int end,int low,int high,double threshold){
  ArrayList<Rule> out=new ArrayList<>();
  double mid=(start+end)/2.0;
  double[] best=new double[high-low],slopes=new double[high-low];
  int samples=(end-start+1)/2;
  for(int si=-20;si<=20;si++){
   double slope=si*.002;int[] offsets=new int[samples];
   for(int k=0;k<samples;k++)offsets[k]=(int)Math.round(slope*(start+2*k-mid));
   for(int p=low;p<high;p++){
    int hits=0;
    for(int k=0;k<samples;k++){
     int x=start+2*k,y=p+offsets[k];
     int xx=vertical?y:x,yy=vertical?x:y;
     if(xx>=0&&xx<w&&yy>=0&&yy<h&&(pixels[yy*w+xx]&255)!=0)hits++;
    }
    double q=(double)hits/samples;
    if(q>best[p-low]){best[p-low]=q;slopes[p-low]=slope;}
   }
  }
  int last=-100,peak=-1;
  for(int i=0;i<best.length;i++)if(best[i]>=threshold){
   if(i-last>3&&peak>=0){out.add(new Rule(low+peak,slopes[peak],best[peak],mid));peak=-1;}
   if(peak<0||best[i]>best[peak])peak=i;
   last=i;
  }
  if(peak>=0)out.add(new Rule(low+peak,slopes[peak],best[peak],mid));
  return out;
 }
 static List<Grid> grids(Mat gray){
  int w=gray.cols(),h=gray.rows();
  ArrayList<Grid> out=new ArrayList<>();
  if(w<500||h<500||w>h*1.8||h>w*2.2)return out;
  Mat bin=new Mat(),horizontal=new Mat(),vertical=new Mat();
  Mat kh=Imgproc.getStructuringElement(Imgproc.MORPH_RECT,new Size(1,3));
  Mat kv=Imgproc.getStructuringElement(Imgproc.MORPH_RECT,new Size(3,1));
  try{
   Imgproc.adaptiveThreshold(gray,bin,255,Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,Imgproc.THRESH_BINARY_INV,35,9);
   Imgproc.dilate(bin,horizontal,kh);Imgproc.dilate(bin,vertical,kv);
   byte[] hp=new byte[w*h],vp=new byte[w*h];horizontal.get(0,0,hp);vertical.get(0,0,vp);
   List<Rule> hs=profile(hp,w,h,false,(int)(w*.07),(int)(w*.95),(int)(h*.12),(int)(h*.75),.72);
   for(int i=0;i+4<hs.size();i++){
    int a=hs.get(i).pos,c=hs.get(i+1).pos,d=hs.get(i+2).pos;
    if(c-a<=w*.04||c-a>=w*.12||d-c<=w*.006||d-c>=w*.02)continue;
    for(int j=i+4;j<Math.min(i+32,hs.size());j++){
     int e=hs.get(j-1).pos,f=hs.get(j).pos;
     if(f-e>w*.09)break;
     if(f-e<=w*.006||f-e>=w*.025)continue;
     List<Rule> vs=profile(vp,w,h,true,a+5,f-5,(int)(w*.04),(int)(w*.98),.78);
     if(vs.size()!=16&&vs.size()!=17)continue;
     if(vs.get(vs.size()-1).pos-vs.get(0).pos<w*.75)continue;
     double nameWidth=vs.get(3).pos-vs.get(2).pos;
     if(nameWidth<=w*.12||nameWidth>=w*.30)continue;
     out.add(new Grid(new ArrayList<>(hs.subList(i,j+1)),vs));
    }
   }
   return out;
  }finally{bin.release();horizontal.release();vertical.release();kh.release();kv.release();}
 }
 static Point cross(Rule horizontal,Rule vertical){
  double x=(vertical.pos+vertical.slope*(horizontal.pos-horizontal.slope*horizontal.mid-vertical.mid))/(1-vertical.slope*horizontal.slope);
  return new Point(x,horizontal.at(x));
 }
 static Bitmap cell(Mat gray,Grid g,int row,int col,int colEnd){
  Rule top=g.h.get(row),bottom=g.h.get(row+1),left=g.v.get(col),right=g.v.get(colEnd);
  Point[] p={cross(top,left),cross(top,right),cross(bottom,right),cross(bottom,left)};
  for(Point q:p)if(q.x<0||q.y<0||q.x>=gray.cols()||q.y>=gray.rows())throw new IllegalArgumentException("Invalid cell");
  int w=(int)Math.round((Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)+Math.hypot(p[2].x-p[3].x,p[2].y-p[3].y))/2);
  int h=(int)Math.round((Math.hypot(p[3].x-p[0].x,p[3].y-p[0].y)+Math.hypot(p[2].x-p[1].x,p[2].y-p[1].y))/2);
  if(w<8||h<5)throw new IllegalArgumentException("Small cell");
  MatOfPoint2f src=new MatOfPoint2f(p),dst=new MatOfPoint2f(new Point(0,0),new Point(w-1,0),new Point(w-1,h-1),new Point(0,h-1));
  Mat transform=Imgproc.getPerspectiveTransform(src,dst),patch=new Mat(),inner=null,up=new Mat(),padded=new Mat();
  try{
   Imgproc.warpPerspective(gray,patch,transform,new Size(w,h),Imgproc.INTER_CUBIC,Core.BORDER_CONSTANT,new Scalar(255));
   int inset=Math.min(3,Math.max(1,Math.min(w,h)/10));
   inner=patch.submat(inset,h-inset,inset,w-inset);
   Imgproc.resize(inner,up,new Size(),3,3,Imgproc.INTER_CUBIC);
   Core.copyMakeBorder(up,padded,12,12,12,12,Core.BORDER_CONSTANT,new Scalar(255));
   Bitmap bitmap=Bitmap.createBitmap(padded.cols(),padded.rows(),Bitmap.Config.ARGB_8888);
   Utils.matToBitmap(padded,bitmap);return bitmap;
  }finally{if(inner!=null)inner.release();src.release();dst.release();transform.release();patch.release();up.release();padded.release();}
 }
 static String recognize(TessBaseAPI tess,Bitmap b,boolean numeric){
  try{
   tess.setVariable("tessedit_char_whitelist",numeric?"0123456789., ":"");
   tess.setPageSegMode(numeric?TessBaseAPI.PageSegMode.PSM_SINGLE_LINE:TessBaseAPI.PageSegMode.PSM_SINGLE_BLOCK);
   tess.setImage(b);String t=tess.getUTF8Text();
   return t==null?"":t.replaceAll("\\s+"," ").trim();
  }finally{tess.setVariable("tessedit_char_whitelist","");b.recycle();}
 }
 static String readCell(TessBaseAPI t,Mat g,Grid grid,int row,int col,boolean numeric){
  return recognize(t,cell(g,grid,row,col,col+1),numeric);
 }
 static long cents(String s){
  s=s.replace(" ","").replace(',','.');
  if(!s.matches("\\d{1,9}\\.\\d{2}"))return -1;
  try{return new java.math.BigDecimal(s).movePointRight(2).longValueExact();}catch(Exception e){return -1;}
 }
 static String money(long c){return String.format(Locale.ROOT,"%d.%02d",c/100,c%100);}
 static boolean vat(long net,long tax){for(int v:new int[]{0,5,7,10,20,22})if(Math.abs(Math.round(net*v/100.0)-tax)<=1)return true;return false;}
 // Use only a valid printed total and exact row reconciliations; no product dictionary.
 static String read(Bitmap source,TessBaseAPI tess){
  if(!org.opencv.android.OpenCVLoader.initLocal())return "";
  Mat rgba=new Mat(),gray=new Mat(),small=new Mat();
  try{
   Utils.bitmapToMat(source,rgba);Imgproc.cvtColor(rgba,gray,Imgproc.COLOR_RGBA2GRAY);
   double scale=Math.min(1.0,1085.0/gray.cols());
   Imgproc.resize(gray,small,new Size(),scale,scale,Imgproc.INTER_AREA);
   List<Grid> candidates=grids(small);
   if(candidates.isEmpty())return "";
   int top=candidates.get(0).h.get(0).pos;
   // OCR the header separately; exclude the ruled table and signatures.
   Bitmap header=Bitmap.createBitmap(source,0,0,source.getWidth(),Math.min(source.getHeight(),Math.max(1,(int)((top-8)/scale))));
   String head;
   try{
    tess.setVariable("tessedit_char_whitelist","");
    tess.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);tess.setImage(header);
    head=tess.getUTF8Text();
   }finally{if(header!=source)header.recycle();}
   if(head==null||!Pattern.compile("сч[её]т[- ]фактура",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE).matcher(head).find()||
    !Pattern.compile("продавец",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE).matcher(head).find())return "";
   // Test candidate footer cells first. Choose only an independently balanced document.
   LinkedHashSet<String> results=new LinkedHashSet<>();
   for(Grid g:candidates){
    if(g.rows()<1||g.rows()>28||g.h.get(0).pos!=top)continue;
    int foot=g.h.size()-2;
    long fn=cents(readCell(tess,small,g,foot,8,true)),ft=cents(readCell(tess,small,g,foot,11,true)),fg=cents(readCell(tess,small,g,foot,12,true));
    if(fn<=0||ft<0||fn+ft!=fg)continue;
    StringBuilder out=new StringBuilder(head).append("\nНаименование товара Количество Цена Стоимость\n");
    long sn=0,st=0,sg=0;boolean good=true;
    for(int row=2;row<foot;row++){
     String name=readCell(tess,small,g,row,2,false);
     String code=readCell(tess,small,g,row,4,true).replace(" ","");
     long p=cents(readCell(tess,small,g,row,7,true)),n=cents(readCell(tess,small,g,row,8,true)),tax=cents(readCell(tess,small,g,row,11,true)),gross=cents(readCell(tess,small,g,row,12,true));
     if(!name.matches(".*\\p{L}{3}.*")||!code.matches("796|778|990|166")||p<=0||n<=0||tax<0||n+tax!=gross||!vat(n,tax)){good=false;break;}
     String quantity=readCell(tess,small,g,row,6,true).replace(" ","").replace(',','.');
     double q;
     try{q=Double.parseDouble(quantity);}catch(Exception ignored){q=0;}
     if(q<=0||Math.abs(q*p-n)>Math.max(1,q*.5+.01)){
      // A damaged quantity cell may be recovered only from net and unit price.
      // Fractional/weight units are never inferred here.
      if(code.equals("166")){good=false;break;}
      q=Math.round((double)n/p);
      if(q<=0||Math.abs(q*p-n)>Math.max(1,q*.5+.01)){good=false;break;}
     }
     if(!code.equals("166")&&q!=Math.rint(q)){good=false;break;}
     String unit=code.equals("796")?"шт":code.equals("990")?"меш":code.equals("166")?"кг":"упак";
     out.append(name).append(' ').append(code).append(' ').append(unit).append(' ').append(String.format(Locale.ROOT,"%.3f",q)).append(' ').append(money(p)).append(' ').append(money(n)).append(' ').append(money(tax)).append(' ').append(money(gross)).append('\n');
     sn+=n;st+=tax;sg+=gross;
    }
    if(good&&sn==fn&&st==ft&&sg==fg){
     out.append("Всего к оплате (9) ").append(money(fn)).append(" x ").append(money(ft)).append(' ').append(money(fg));
     results.add(out.toString());
    }
   }
   return results.size()==1?results.iterator().next():"";
  }catch(RuntimeException|LinkageError e){return "";}
  finally{rgba.release();gray.release();small.release();tess.setVariable("tessedit_char_whitelist","");}
 }
}
