package com.farukh.ttkpro;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.LinkedHashSet;
import java.util.Locale;

public class PdfMaker {
    private final Canvas c;
    private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final int red,dark,muted,pale,line;
    private final float left=29,right=566;
    private final Context ctx;
    private final JSONObject dish;
    private final TTKStore store;
    private float size=8.6f;
    private PdfMaker(Canvas canvas,Context context,TTKStore st,JSONObject d,int template){
        c=canvas;ctx=context;store=st;dish=d;
        int[] accents={0xFFC51C2E,0xFFBD4764,0xFF304F8C,0xFFD34538};
        red=accents[Math.max(0,Math.min(3,template))];
        dark=0xFF1C2029;muted=0xFF68707A;pale=0xFFFAF3F1;line=0xFFE4E6E9;
    }
    private void box(float x,float y,float w,float h,float rad,int color){
        p.setStyle(Paint.Style.FILL);p.setColor(color);c.drawRoundRect(new RectF(x,y,x+w,y+h),rad,rad,p);
    }
    private void stroke(float x,float y,float w,float h,float rad,int color){
        p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(.7f);p.setColor(color);c.drawRoundRect(new RectF(x,y,x+w,y+h),rad,rad,p);p.setStyle(Paint.Style.FILL);
    }
    private void text(String v,float x,float y,float font,int color,boolean bold){
        p.setStyle(Paint.Style.FILL);p.setColor(color);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));p.setTextSize(font);
        c.drawText(v==null?"":v,x,y,p);
    }
    private void rule(float y){p.setColor(line);p.setStrokeWidth(.7f);c.drawLine(left,y,right,y,p);}
    private float wrap(String value,float x,float y,float width,float font,float leading,int color,boolean bold){
        p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));p.setTextSize(font);
        String src=(value==null?"":value).replace("\r","");
        for(String para:src.split("\n",-1)){
            StringBuilder curr=new StringBuilder();
            for(String word:para.split(" ",-1)){
                String trial=curr.length()==0?word:curr+" "+word;
                if(p.measureText(trial)>width&&curr.length()>0){
                    text(curr.toString(),x,y,font,color,bold);y+=leading;curr=new StringBuilder(word);
                }else curr=new StringBuilder(trial);
                while(p.measureText(curr.toString())>width && curr.length()>1){
                    String s=curr.toString();int end=s.length()-1;
                    while(end>1&&p.measureText(s.substring(0,end))>width)end--;
                    text(s.substring(0,end),x,y,font,color,bold);y+=leading;
                    curr=new StringBuilder(s.substring(end));
                }
            }
            text(curr.toString(),x,y,font,color,bold);y+=leading;
        }
        return y;
    }
    private void titleBar(String s,float x,float y,float w){
        box(x,y,w,20,5,red);text(s,x+9,y+13,9.1f,Color.WHITE,true);
    }
    private void sakura(float x,float y,float scale){
        p.setColor(0x66D34548);p.setStrokeWidth(1.3f*scale);
        c.drawLine(x-21*scale,y-15*scale,x+23*scale,y+19*scale,p);
        for(int i=0;i<5;i++){
            float px=x+(i-2)*8*scale,py=y+(i-2)*6*scale;
            for(int j=0;j<5;j++){
                double a=j*Math.PI*2/5;float dx=(float)Math.cos(a)*4*scale,dy=(float)Math.sin(a)*4*scale;
                box(px+dx-2*scale,py+dy-2*scale,4*scale,4*scale,2*scale,0x66D34548);
            }
        }
    }
    private void photo(float x,float y,float w,float h){
        String raw=dish.optString("photo","");
        if(!raw.isEmpty())try(InputStream in=ctx.getContentResolver().openInputStream(Uri.parse(raw))){
            Bitmap bmp=BitmapFactory.decodeStream(in);
            if(bmp!=null){
                float sc=Math.max(w/bmp.getWidth(),h/bmp.getHeight());
                float bw=bmp.getWidth()*sc,bh=bmp.getHeight()*sc;
                c.save();Path clip=new Path();clip.addRoundRect(new RectF(x,y,x+w,y+h),6,6,Path.Direction.CW);c.clipPath(clip);
                p.setAlpha(255);c.drawBitmap(bmp,null,new RectF(x+(w-bw)/2,y+(h-bh)/2,x+(w+bw)/2,y+(h+bh)/2),p);
                c.restore();bmp.recycle();return;
            }
        }catch(Exception ignore){}
        box(x,y,w,h,7,0xFFF9EDEF);
        text("FARUKH",x+14,y+27,17,red,true);
        text("JAPANESE PRO",x+14,y+45,9,dark,true);
        p.setColor(0xFFECCBCB);c.drawCircle(x+w-18,y+18,10,p);
        sakura(x+w-23,y+h-22,.55f);
        text("ФОТО БЛЮДА",x+14,y+h-14,7.5f,muted,false);
    }
    private float sectionText(String label,String val,float x,float y,float width){
        titleBar(label,x,y,width);
        float bottom=wrap(val,x+9,y+34,width-18,size,size+3,dark,false);
        stroke(x,y+21,width,Math.max(25,bottom-y-19),5,line);
        return bottom+11;
    }
    private float convert(String v){try{return Float.parseFloat(v.replace(',','.'));}catch(Exception ignore){return 0;}}
    private static String num(double x){return String.format(Locale.US,"%.1f",x).replace('.',',');}
    private void header(){
        c.drawColor(Color.WHITE);
        box(0,0,595,7,0,red);
        text("A",left,58,35,red,true);
        text("FARUKH",left+37,43,17,dark,true);
        text("TTK PRO",left+37,59,10,red,true);
        text("ТЕХНОЛОГИЧЕСКАЯ",262,37,15,dark,true);
        text("КАРТА (ТТК)",350,55,15,dark,true);
        p.setColor(red);p.setStrokeWidth(2);c.drawLine(left,78,right,78,p);
        p.setColor(0x18D34548);c.drawCircle(538,94,55,p);
        p.setColor(red);c.drawCircle(526,103,10,p);
        sakura(537,105,.7f);
    }
    byte[] render() throws Exception{
        JSONArray rows=dish.optJSONArray("rows");if(rows==null)rows=new JSONArray();
        String tech=dish.optString("tech","");
        size= rows.length()>18||tech.length()>550?7.2f:rows.length()>11||tech.length()>350?7.7f:8.7f;
        PdfDocument doc=new PdfDocument();
        PdfDocument.PageInfo info=new PdfDocument.PageInfo.Builder(595,842,1).create();
        PdfDocument.Page page=doc.startPage(info);
        header();
        text(dish.optString("name","Новое блюдо"),left,113,17,dark,true);
        text("Категория: "+dish.optString("category",""),left,132,9,muted,false);
        text("Выход: "+dish.optString("yield","")+" г  •  "+dish.optString("pieces","")+" шт",left,149,10,red,true);
        photo(408,91,158,75);
        float y=179;
        titleBar("1. РЕЦЕПТУРА И ВЫХОД",left,y,537);y+=22;
        box(left,y,537,16,0,0xFFF3F4F5);
        text("№",left+9,y+11,8,dark,true);
        text("Наименование сырья / полуфабриката",left+30,y+11,8,dark,true);
        text("Брутто, г",left+393,y+11,8,dark,true);
        text("Нетто, г",left+476,y+11,8,dark,true);
        y+=16;
        double total=0,cal=0,pv=0,fv=0,cv=0;
        LinkedHashSet<String> allerg=new LinkedHashSet<>();
        for(int i=0;i<rows.length();i++){
            JSONObject r=rows.optJSONObject(i);if(r==null)continue;
            float rh=size<8?15:17;
            if(i%2==0)box(left,y,537,rh,0,0xFFF9F9FA);
            String nm=r.optString("name");
            text(""+(i+1),left+9,y+11,size,dark,false);
            float nmSize=size;if(nm.length()>60)nmSize=6.7f;
            text(nm.length()>74?nm.substring(0,73)+"…":nm,left+30,y+11,nmSize,dark,false);
            text(num(r.optDouble("brutto",0)),left+395,y+11,size,dark,false);
            text(num(r.optDouble("netto",0)),left+477,y+11,size,dark,false);
            double g=r.optDouble("netto",0);total+=g;
            JSONObject ing=store.findIngredient(nm);
            if(ing!=null){cal+=g*ing.optDouble("kcal",0)/100;pv+=g*ing.optDouble("p",0)/100;
                fv+=g*ing.optDouble("f",0)/100;cv+=g*ing.optDouble("c",0)/100;
                String allergens=ing.optString("allergen","");
                if(!allergens.isEmpty())allerg.add(allergens);
            }
            y+=rh;
        }
        box(left,y,537,20,3,0xFFF7E8EA);
        text("ИТОГО НЕТТО ПО РЕЦЕПТУРЕ: "+num(total)+" г",left+9,y+13,9,red,true);
        text("Заявленный выход: "+dish.optString("yield","")+" г",left+294,y+13,8.5f,red,true);y+=33;
        y=sectionText("2. ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ",tech,left,y,537);
        float column=263,gap=11;
        float yStart=y;
        float lY=sectionText("3. ТРЕБОВАНИЯ К КАЧЕСТВУ",dish.optString("quality",""),left,yStart,column);
        lY=sectionText("4. ПОДАЧА И ОФОРМЛЕНИЕ",dish.optString("serving",""),left,lY,column);
        float rX=left+column+gap;
        String cvText="Энергия: "+num(cal)+" ккал; белки: "+num(pv)+" г; жиры: "+num(fv)+" г; углеводы: "+num(cv)+" г. Значения ориентировочные; используются данные справочника на весь состав.";
        float rY=sectionText("5. ПИЩЕВАЯ ЦЕННОСТЬ",cvText,rX,yStart,column);
        String allergText=allerg.isEmpty()?"Не определены по текущему справочнику. Требуется проверить этикетки каждого ингредиента.":String.join("; ",allerg)+". Подтвердить по этикеткам сырья.";
        rY=sectionText("6. АЛЛЕРГЕНЫ",allergText,rX,rY,column);
        y=Math.max(lY,rY)+2;
        y=sectionText("7. УСЛОВИЯ И СРОК ХРАНЕНИЯ",
             "Температура: "+dish.optString("temp","")+". Срок: "+dish.optString("storage","")+".",left,y,537);
        if(y>747){
            doc.finishPage(page);doc.close();
            throw new Exception("Слишком много текста для одного читаемого листа А4. Сократите формулировки или рецептуру.");
        }
        float fy=Math.max(765,y+13);
        rule(fy-12);
        text("Разработал: "+dish.optString("author","________________________"),left,fy,8,dark,false);
        text("Утверждаю: "+dish.optString("approver","________________________"),307,fy,8,dark,false);
        text("Подпись: ____________________",left,fy+20,8,muted,false);
        text("Дата: "+dish.optString("date","__________________"),307,fy+20,8,muted,false);
        p.setColor(red);p.setStrokeWidth(2);c.drawLine(left,809,right,809,p);
        text("FARUKH TTK PRO  •  JAPANESE COLLECTION",left,822,7,muted,false);
        text("Данные требуют профессиональной проверки и утверждения",331,822,6.2f,muted,false);
        doc.finishPage(page);
        ByteArrayOutputStream buffer=new ByteArrayOutputStream();doc.writeTo(buffer);doc.close();
        return buffer.toByteArray();
    }
    public static byte[] generate(Context ctx,TTKStore store,JSONObject dish) throws Exception{
        // A 595 x 842 point A4 canvas, as required by Android PdfDocument.
        PdfDocument test=null;
        // Canvas is only obtainable from the final PDF page; construct once below.
        PdfDocument d=new PdfDocument();
        PdfDocument.Page pg=d.startPage(new PdfDocument.PageInfo.Builder(595,842,1).create());
        PdfMaker maker=new PdfMaker(pg.getCanvas(),ctx,store,dish,dish.optInt("template",0));
        // We draw the actual page here. render() uses its own PdfDocument page,
        // but canvas fields must reference that page: delegate instead.
        d.finishPage(pg);d.close();
        return renderIntoNewDocument(ctx,store,dish);
    }
    private static byte[] renderIntoNewDocument(Context ctx,TTKStore store,JSONObject dish) throws Exception{
        PdfDocument doc=new PdfDocument();
        PdfDocument.Page page=doc.startPage(new PdfDocument.PageInfo.Builder(595,842,1).create());
        PdfMaker pm=new PdfMaker(page.getCanvas(),ctx,store,dish,dish.optInt("template",0));
        try{
            pm.drawPage();doc.finishPage(page);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();doc.writeTo(bytes);return bytes.toByteArray();
        }finally{doc.close();}
    }
    private void drawPage() throws Exception{
        JSONArray rows=dish.optJSONArray("rows");if(rows==null)rows=new JSONArray();
        String tech=dish.optString("tech","");
        size=rows.length()>18||tech.length()>550?7.2f:rows.length()>11||tech.length()>350?7.7f:8.7f;
        header();
        text(dish.optString("name","Новое блюдо"),left,113,17,dark,true);
        text("Категория: "+dish.optString("category",""),left,132,9,muted,false);
        text("Выход: "+dish.optString("yield","")+" г  •  "+dish.optString("pieces","")+" шт",left,149,10,red,true);
        photo(408,91,158,75);
        float y=179;
        titleBar("1. РЕЦЕПТУРА И ВЫХОД",left,y,537);y+=22;
        box(left,y,537,16,0,0xFFF3F4F5);
        text("№",left+9,y+11,8,dark,true);
        text("Наименование сырья / полуфабриката",left+30,y+11,8,dark,true);
        text("Брутто, г",left+393,y+11,8,dark,true);
        text("Нетто, г",left+476,y+11,8,dark,true);y+=16;
        double total=0,cal=0,pv=0,fv=0,cv=0;
        LinkedHashSet<String> allerg=new LinkedHashSet<>();
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.optJSONObject(i);if(row==null)continue;
            float rh=size<8?15:17;
            if(i%2==0)box(left,y,537,rh,0,0xFFF9F9FA);
            String nm=row.optString("name");
            text(""+(i+1),left+9,y+11,size,dark,false);
            text(nm.length()>74?nm.substring(0,73)+"…":nm,left+30,y+11,nm.length()>60?6.7f:size,dark,false);
            text(num(row.optDouble("brutto",0)),left+395,y+11,size,dark,false);
            text(num(row.optDouble("netto",0)),left+477,y+11,size,dark,false);
            double g=row.optDouble("netto",0);total+=g;
            JSONObject ing=store.findIngredient(nm);
            if(ing!=null){
                cal+=g*ing.optDouble("kcal",0)/100;pv+=g*ing.optDouble("p",0)/100;
                fv+=g*ing.optDouble("f",0)/100;cv+=g*ing.optDouble("c",0)/100;
                String a=ing.optString("allergen","");
                if(!a.isEmpty())allerg.add(a);
            }
            y+=rh;
        }
        box(left,y,537,20,3,0xFFF7E8EA);
        text("ИТОГО НЕТТО ПО РЕЦЕПТУРЕ: "+num(total)+" г",left+9,y+13,9,red,true);
        text("Заявленный выход: "+dish.optString("yield","")+" г",left+294,y+13,8.5f,red,true);y+=33;
        y=sectionText("2. ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ",tech,left,y,537);
        float col=263,gap=11;
        float ly=sectionText("3. ТРЕБОВАНИЯ К КАЧЕСТВУ",dish.optString("quality",""),left,y,col);
        ly=sectionText("4. ПОДАЧА И ОФОРМЛЕНИЕ",dish.optString("serving",""),left,ly,col);
        float rx=left+col+gap;
        float ry=sectionText("5. ПИЩЕВАЯ ЦЕННОСТЬ","Энергия: "+num(cal)+" ккал; белки: "+num(pv)+" г; жиры: "+num(fv)+" г; углеводы: "+num(cv)+" г. Расчёт ориентировочный, по текущей базе сырья.",rx,y,col);
        String allergText=allerg.isEmpty()?"Не определены по справочнику. Проверить этикетки сырья.":String.join("; ",allerg)+". Подтвердить по этикеткам сырья.";
        ry=sectionText("6. АЛЛЕРГЕНЫ",allergText,rx,ry,col);
        y=sectionText("7. УСЛОВИЯ И СРОК ХРАНЕНИЯ","Температура: "+dish.optString("temp","")+". Срок: "+dish.optString("storage","")+".",left,Math.max(ly,ry)+2,537);
        if(y>744)throw new Exception("ТТК не помещается на читаемый лист А4. Сократите текст или количество позиций.");
        float fy=Math.max(765,y+13);
        rule(fy-12);
        text("Разработал: "+dish.optString("author","________________________"),left,fy,8,dark,false);
        text("Утверждаю: "+dish.optString("approver","________________________"),307,fy,8,dark,false);
        text("Подпись: ____________________",left,fy+20,8,muted,false);
        text("Дата: "+dish.optString("date","__________________"),307,fy+20,8,muted,false);
        p.setColor(red);p.setStrokeWidth(2);c.drawLine(left,809,right,809,p);
        text("FARUKH TTK PRO  •  JAPANESE COLLECTION",left,822,7,muted,false);
        text("ТРЕБУЕТ УТВЕРЖДЕНИЯ",455,822,7,muted,false);
    }
}
