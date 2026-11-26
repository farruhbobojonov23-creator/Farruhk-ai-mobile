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
}
