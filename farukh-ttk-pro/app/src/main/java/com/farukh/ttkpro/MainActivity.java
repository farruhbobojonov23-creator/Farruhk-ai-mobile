package com.farukh.ttkpro;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.content.ContentValues;
import android.provider.MediaStore;
import android.os.Build;
import android.widget.*;
import android.view.*;
import java.io.OutputStream;
public class MainActivity extends Activity {
 EditText name, ingredients, method;
 @Override public void onCreate(Bundle b) {
 super.onCreate(b);
 LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setPadding(28,32,28,24);root.setBackgroundColor(Color.rgb(250,248,245));
 TextView title=new TextView(this);title.setText("FARUKH TTK PRO");title.setTextSize(26);title.setTypeface(null,Typeface.BOLD);title.setTextColor(Color.rgb(175,28,34));root.addView(title);
 TextView sub=new TextView(this);sub.setText("JAPANESE PRO · Редактор технологической карты");sub.setTextColor(Color.DKGRAY);root.addView(sub);
 name=field(root,"Название блюда","Филадельфия");
 ingredients=field(root,"Рецептура, граммы","Рис 130 г\nНори 3 г\nСыр сливочный 50 г\nЛосось 40 г");
 method=field(root,"Технология приготовления","Подготовить ингредиенты, сформовать ролл, нарезать и оформить.");
 Button save=new Button(this);save.setText("СОХРАНИТЬ PDF A4");root.addView(save);
 save.setOnClickListener(v->exportPdf());
 ScrollView scroll=new ScrollView(this);scroll.addView(root);setContentView(scroll);
 }
 EditText field(LinearLayout parent,String hint,String value) {
 TextView label=new TextView(this);label.setText(hint);label.setTextColor(Color.BLACK);label.setPadding(0,24,0,4);parent.addView(label);
 EditText e=new EditText(this);e.setText(value);e.setMinLines(2);e.setTextSize(16);parent.addView(e);return e;
 }
 void exportPdf(){
 try{
 PdfDocument pdf=new PdfDocument();PdfDocument.PageInfo info=new PdfDocument.PageInfo.Builder(595,842,1).create();
 PdfDocument.Page page=pdf.startPage(info);android.graphics.Canvas c=page.getCanvas();android.graphics.Paint p=new android.graphics.Paint(3);
 p.setColor(Color.WHITE);c.drawColor(Color.WHITE);p.setColor(Color.rgb(170,27,34));p.setTextSize(22);p.setTypeface(Typeface.DEFAULT_BOLD);c.drawText("FARUKH TTK PRO",35,55,p);
 p.setColor(Color.BLACK);p.setTextSize(16);c.drawText(name.getText().toString(),35,105,p);
 p.setTextSize(12);int y=150;
 for(String s:("РЕЦЕПТУРА\n"+ingredients.getText()+"\nТЕХНОЛОГИЯ\n"+method.getText()).split("\\n")){if(y>775)break;c.drawText(s.length()>75?s.substring(0,75):s,35,y,p);y+=22;}
 pdf.finishPage(page);
 ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.DISPLAY_NAME,"FARUKH_TTK_"+System.currentTimeMillis()+".pdf");values.put(MediaStore.MediaColumns.MIME_TYPE,"application/pdf");values.put(MediaStore.MediaColumns.RELATIVE_PATH,"Documents/FarukhTTK");
 android.net.Uri uri=getContentResolver().insert(MediaStore.Files.getContentUri("external"),values);
 if(uri==null)throw new Exception("Cannot create file");
 try(OutputStream out=getContentResolver().openOutputStream(uri)){pdf.writeTo(out);}pdf.close();
 Toast.makeText(this,"PDF сохранён в Documents/FarukhTTK",Toast.LENGTH_LONG).show();
 }catch(Exception ex){Toast.makeText(this,"Ошибка: "+ex.getMessage(),Toast.LENGTH_LONG).show();}
 }
}
