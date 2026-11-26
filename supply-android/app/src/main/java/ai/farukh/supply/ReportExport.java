package ai.farukh.supply;
import android.app.Activity;
import android.content.Intent;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.*;
import java.util.zip.*;

final class ReportExport {
 private static final int REQUEST=72,MAX=2*1024*1024;
 private final Activity activity;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private byte[] pending;
 private boolean busy;
 ReportExport(Activity a){activity=a;}
 void attach(WebView web){
  if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;
  WebViewCompat.addWebMessageListener(web,"SupplyReports",Collections.singleton("https://appassets.androidplatform.net"),(view,message,origin,main,reply)->{
   if(!main||!"https://appassets.androidplatform.net".equals(origin.toString()))return;
   final String raw=message.getData();
   activity.runOnUiThread(()->prepare(raw));
  });
 }
 private void toast(String s){activity.runOnUiThread(()->{if(!activity.isDestroyed())Toast.makeText(activity,s,Toast.LENGTH_LONG).show();});}
 private void prepare(String raw){
  if(busy||activity.isDestroyed())return;
  if(raw==null||raw.length()>MAX){toast("Отчёт слишком большой. Выберите меньший период.");return;}
  busy=true;
  worker.execute(()->{
   try{
    JSONObject msg=new JSONObject(raw);String kind=msg.getString("kind");byte[] bytes;String mime;
    if("xlsx".equals(kind)){bytes=xlsx(msg.getJSONArray("rows"));mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";}
    else if("pdf".equals(kind)){bytes=pdf(msg.getString("summary"));mime="application/pdf";}
    else throw new IOException("unsupported");
    activity.runOnUiThread(()->{if(activity.isDestroyed())return;pending=bytes;try{
     Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(mime);i.putExtra(Intent.EXTRA_TITLE,"FARUKH-SUPPLY-report."+kind);activity.startActivityForResult(i,REQUEST);
    }catch(Exception e){pending=null;busy=false;toast("Не удалось открыть выбор файла.");}});
   }catch(Exception e){activity.runOnUiThread(()->{busy=false;toast("Не удалось сформировать отчёт. Проверьте размер и данные.");});}
  });
 }
 boolean onResult(int request,int result,Intent data){
  if(request!=REQUEST)return false;
  byte[] bytes=pending;pending=null;
  if(result!=Activity.RESULT_OK||data==null||data.getData()==null||bytes==null){busy=false;return true;}
  worker.execute(()->{try(OutputStream out=activity.getContentResolver().openOutputStream(data.getData(),"w")){
   if(out==null)throw new IOException("output");out.write(bytes);out.flush();toast("Отчёт сохранён.");
  }catch(Exception e){toast("Не удалось записать файл.");}finally{activity.runOnUiThread(()->busy=false);}});
  return true;
 }
 void close(){worker.shutdownNow();pending=null;}
 private static String xml(String s){StringBuilder b=new StringBuilder();for(int i=0;i<s.length();i++){char c=s.charAt(i);if(c=='&')b.append("&amp;");else if(c=='<')b.append("&lt;");else if(c=='>')b.append("&gt;");else if(c==34)b.append("&quot;");else if(c==9||c==10||c==13||c>=32&&c!=0xfffe&&c!=0xffff)b.append(c);}return b.toString();}
 private static void zip(ZipOutputStream z,String name,String data)throws IOException{z.putNextEntry(new ZipEntry(name));z.write(data.getBytes(StandardCharsets.UTF_8));z.closeEntry();}
 private static final String X="http://schemas.openxmlformats.org/spreadsheetml/2006/main",R="http://schemas.openxmlformats.org/officeDocument/2006/relationships",P="http://schemas.openxmlformats.org/package/2006/relationships";
 static byte[] xlsx(JSONArray rows)throws Exception{
  if(rows.length()<1||rows.length()>10001)throw new IOException("rows");
  ByteArrayOutputStream out=new ByteArrayOutputStream();
  try(ZipOutputStream z=new ZipOutputStream(out)){
   zip(z,"[Content_Types].xml","<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
   zip(z,"_rels/.rels","<Relationships xmlns=\""+P+"\"><Relationship Id=\"rId1\" Type=\""+R+"/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
   zip(z,"xl/workbook.xml","<workbook xmlns=\""+X+"\" xmlns:r=\""+R+"\"><sheets><sheet name=\"Закупки\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
   zip(z,"xl/_rels/workbook.xml.rels","<Relationships xmlns=\""+P+"\"><Relationship Id=\"rId1\" Type=\""+R+"/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
   StringBuilder sheet=new StringBuilder("<worksheet xmlns=\""+X+"\"><sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews><cols><col min=\"1\" max=\"4\" width=\"22\" customWidth=\"1\"/><col min=\"5\" max=\"5\" width=\"48\" customWidth=\"1\"/><col min=\"6\" max=\"10\" width=\"19\" customWidth=\"1\"/></cols><sheetData>");
   for(int i=0;i<rows.length();i++){JSONArray row=rows.getJSONArray(i);if(row.length()!=10)throw new IOException("columns");sheet.append("<row r=\"").append(i+1).append("\">");
    for(int j=0;j<row.length();j++){Object v=row.opt(j);String cell=Character.toString((char)('A'+j))+(i+1);sheet.append("<c r=\"").append(cell).append("\"");if(v instanceof Number&&Double.isFinite(((Number)v).doubleValue()))sheet.append("><v>").append(v).append("</v></c>");else sheet.append(" t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(xml(v==null||v==JSONObject.NULL?"":String.valueOf(v))).append("</t></is></c>");}
    sheet.append("</row>");}
   sheet.append("</sheetData><autoFilter ref=\"A1:J").append(rows.length()).append("\"/></worksheet>");zip(z,"xl/worksheets/sheet1.xml",sheet.toString());
  }return out.toByteArray();
 }
 static byte[] pdf(String summary)throws IOException{
  if(summary.length()>100000)throw new IOException("length");
  try(PdfDocument doc=new PdfDocument();ByteArrayOutputStream out=new ByteArrayOutputStream()){
   Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));paint.setTextSize(12);
   java.util.List<String> lines=new java.util.ArrayList<>();for(String text:summary.split("\\n",-1)){
    if(text.isEmpty()){lines.add("");continue;}while(!text.isEmpty()){int take=paint.breakText(text,true,515,null);if(take<1)take=1;lines.add(text.substring(0,take));text=text.substring(take);}
   }
   int pageNo=0;for(int start=0;start<lines.size();start+=39){
    PdfDocument.Page page=doc.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());Canvas c=page.getCanvas();paint.setColor(Color.rgb(50,46,145));paint.setTextSize(19);paint.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));c.drawText("FARUKH SUPPLY",40,48,paint);paint.setStrokeWidth(2);c.drawLine(40,62,555,62,paint);
    paint.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));paint.setTextSize(12);paint.setColor(Color.rgb(28,34,56));int y=92;for(int i=start;i<Math.min(lines.size(),start+39);i++){c.drawText(lines.get(i),40,y,paint);y+=18;}paint.setColor(Color.GRAY);c.drawText("Страница "+pageNo,40,810,paint);doc.finishPage(page);
   }doc.writeTo(out);return out.toByteArray();
  }
 }
}
