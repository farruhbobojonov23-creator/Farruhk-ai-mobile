package ai.farukh.supply;
import android.graphics.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class InvoiceOrientationTest {
 @Test public void readsAllRotations() throws Exception {
  Bitmap source=Bitmap.createBitmap(1500,900,Bitmap.Config.ARGB_8888);
  Canvas c=new Canvas(source);c.drawColor(Color.WHITE);
  Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);p.setColor(Color.BLACK);p.setTextSize(43);p.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));
  String[] lines={"ТОВАРНАЯ НАКЛАДНАЯ","Поставщик: ООО Учебный","Продавец и покупатель","Наименование товара   Количество   Цена","Рис учебный 25 кг       3          1000.00","Соус учебный 1 л         2          500.00","Итого к оплате 4000.00"};
  for(int i=0;i<lines.length;i++)c.drawText(lines[i],70,100+i*105,p);
  p.setStrokeWidth(2);for(int y:new int[]{345,450,555,660,765})c.drawLine(45,y,1455,y,p);
  for(int angle:new int[]{0,90,180,270,17,-30}){
   Bitmap b=InvoiceOcr.rotate(source,angle);
   try{
    String actual=InvoiceOcr.readOrientedForTest(InstrumentationRegistry.getInstrumentation().getTargetContext(),b).toLowerCase(java.util.Locale.ROOT);
    assertTrue("rotation "+angle+": "+actual,actual.contains("накладная")&&actual.contains("поставщик")&&actual.contains("4000"));
   }finally{if(b!=source)b.recycle();}
  }
  source.recycle();
 }

 @Test public void reusesOrientationOnlyForSameSelection() throws Exception {
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  java.io.File file=new java.io.File(context.getCacheDir(),"supply-ocr-session-test.png");
  android.net.Uri uri=android.net.Uri.fromFile(file);
  Bitmap image=Bitmap.createBitmap(1500,900,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(image);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setColor(Color.BLACK);paint.setTextSize(48);
  try(InvoiceOcr.PhotoSession session=new InvoiceOcr.PhotoSession()){
   for(int i=0;i<2;i++){
    canvas.drawColor(Color.WHITE);
    canvas.drawText("ТОВАРНАЯ НАКЛАДНАЯ",60,110,paint);
    canvas.drawText("Поставщик: ООО Учебный",60,230,paint);
    canvas.drawText("Наименование товара Количество Цена",60,350,paint);
    canvas.drawText(i==0?"Итого 12345.00":"Итого 67890.00",60,500,paint);
    try(java.io.FileOutputStream out=new java.io.FileOutputStream(file)){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}
    String first=InvoiceOcr.read(context,uri,false,session,i+1);
    assertTrue(first,first.contains(i==0?"12345":"67890"));
    assertEquals(i+1,session.preparations());
    if(i==0){
     String repeated=InvoiceOcr.read(context,uri,false,session,1);
     assertTrue(repeated,repeated.contains("12345"));
     assertEquals("Repeated OCR must not repeat orientation",1,session.preparations());
    }else assertFalse(first,first.contains("12345"));
   }
  }finally{image.recycle();file.delete();}
 }

 @Test public void ranksRowOrderAboveSidewaysColumns(){
  String upright="Счет-фактура № 123\nНаименование товара Количество Цена\nРис учебный 3,000 100,00 300,00\nСоус учебный 1,000 200,00 200,00\nВсего к оплате 500,00";
  String sideways="Всего к оплате Счет-фактура № 123\nРис учебный Соус учебный Наименование товара\n1,000 3,000\n200,00 100,00 300,00\n500,00 200,00 300,00";
  assertTrue(InvoiceOcr.layoutScore(upright)>InvoiceOcr.layoutScore(sideways));
  assertTrue(InvoiceOcr.layoutScore(sideways)<0);
 }
 @Test public void fastOrientationRequiresOrderedHeaderFooterAndHighConfidence(){
  String good="Товарная накладная\nПоставщик: ООО Учебный\nНаименование товара Количество Цена\nРис учебный 3,000 100,00 300,00\nВсего к оплате 300,00";
  assertTrue(InvoiceOcr.canSkipOtherOrientations(good,95));
  assertFalse(InvoiceOcr.canSkipOtherOrientations(good,70));
  assertFalse(InvoiceOcr.canSkipOtherOrientations("Всего к оплате 300,00\n"+good.replace("Всего к оплате 300,00",""),95));
  assertFalse(InvoiceOcr.canSkipOtherOrientations(good.replace("Поставщик: ООО Учебный",""),95));
 }
}
