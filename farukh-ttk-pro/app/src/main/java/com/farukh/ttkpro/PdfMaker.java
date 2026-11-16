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
    private final int red,dark,muted,pale,line,template;
    private final float left=29,right=566;
    private final Context ctx;
    private final JSONObject dish;
    private final TTKStore store;
    private float size=8.6f;
    private PdfMaker(Canvas canvas,Context context,TTKStore st,JSONObject d,int template){
        c=canvas;ctx=context;store=st;dish=d;this.template=template;
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
        Bitmap bmp=null;
        boolean owned=false;
        String uri=dish.optString("photo","");
        if(!uri.isEmpty()){
            try(InputStream in=ctx.getContentResolver().openInputStream(Uri.parse(uri))){
                bmp=BitmapFactory.decodeStream(in);owned=bmp!=null;
            }catch(Exception ignore){}
        }
        if(bmp==null){
            String asset=FoodPhotos.categoryAsset(dish.optString("category",""));
            bmp=FoodPhotos.cached(ctx,asset);
        }
        if(bmp!=null){
            // Render photo inside a rounded rectangle without stretching.
            c.save();Path clip=new Path();
            clip.addRoundRect(new RectF(x,y,x+w,y+h),6,6,Path.Direction.CW);
            c.clipPath(clip);box(x,y,w,h,6,0xFFFCF8F7);
            float scale=Math.min(w/bmp.getWidth(),h/bmp.getHeight());
            float dw=bmp.getWidth()*scale,dh=bmp.getHeight()*scale;
            p.setColor(Color.WHITE);p.setAlpha(255);
            c.drawBitmap(bmp,null,new RectF(x+(w-dw)/2,y+(h-dh)/2,x+(w+dw)/2,y+(h+dh)/2),p);
            c.restore();
            if(owned)bmp.recycle();
            return;
        }
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
        text("ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ",220,37,11.5f,dark,true);
        text("КАРТА (ТТК)",350,55,15,dark,true);
        p.setColor(red);p.setStrokeWidth(2);c.drawLine(left,78,right,78,p);
        p.setColor(0x18D34548);c.drawCircle(538,94,55,p);
        p.setColor(red);c.drawCircle(526,103,10,p);
        if(template==0){
            sakura(537,105,.7f);torii(536,145,.6f);
        }else if(template==1){
            sakura(538,108,1.0f);sakura(490,68,.45f);
        }else if(template==2){
            mountain(505,139,1.0f);wave(left,157,.7f);
        }else{
            torii(524,142,1.05f);sakura(563,77,.4f);
        }
    }
    private void torii(float x,float y,float sc){
        p.setStyle(Paint.Style.FILL);p.setColor(red);
        c.drawRect(x-28*sc,y-20*sc,x+28*sc,y-15*sc,p);
        c.drawRect(x-23*sc,y-11*sc,x+23*sc,y-8*sc,p);
        c.drawRect(x-20*sc,y-15*sc,x-15*sc,y+14*sc,p);
        c.drawRect(x+15*sc,y-15*sc,x+20*sc,y+14*sc,p);
    }
    private void mountain(float x,float y,float sc){
        p.setColor(0x55304F8C);Path m=new Path();
        m.moveTo(x-55*sc,y);m.lineTo(x,y-45*sc);m.lineTo(x+55*sc,y);m.close();c.drawPath(m,p);
        p.setColor(Color.WHITE);Path snow=new Path();
        snow.moveTo(x-13*sc,y-34*sc);snow.lineTo(x,y-45*sc);snow.lineTo(x+12*sc,y-35*sc);
        snow.lineTo(x+6*sc,y-31*sc);snow.lineTo(x,y-34*sc);snow.lineTo(x-6*sc,y-31*sc);
        snow.close();c.drawPath(snow,p);
    }
    private void wave(float x,float y,float sc){
        p.setColor(red);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.0f);
        for(int j=0;j<3;j++)for(int i=0;i<8;i++){
            float xx=x+(i*16+j*7)*sc;RectF r=new RectF(xx,y+j*4*sc,xx+14*sc,y+(j*4+10)*sc);
            c.drawArc(r,180,180,false,p);
        }p.setStyle(Paint.Style.FILL);
    }
    public static byte[] generate(Context ctx,TTKStore store,JSONObject dish) throws Exception{
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
        RecipeAudit audit=RecipeAudit.inspect(store,dish);
        header();
        String dishTitle=dish.optString("name","Новое блюдо");
        if(dishTitle.length()>38)throw new Exception("Длинное название блюда не помещается в заголовок А4.");
        text(dishTitle,left,113,17,dark,true);
        text("Категория: "+dish.optString("category",""),left,132,9,muted,false);
        text("Выход: "+dish.optString("yield","")+" г  •  "+dish.optString("pieces","")+" шт",left,149,10,red,true);
        String scope=dish.optString("scope","");
        text("Область: "+(scope.isEmpty()?"не указана":scope.length()>55?scope.substring(0,55)+"…":scope),left,165,7.2f,muted,false);
        photo(408,91,158,75);
        float y=179;
        titleBar("1. РЕЦЕПТУРА И ВЫХОД",left,y,537);y+=22;
        box(left,y,537,16,0,0xFFF3F4F5);
        text("№",left+9,y+11,8,dark,true);
        text("Наименование сырья / полуфабриката",left+30,y+11,8,dark,true);
        text("Брутто, г",left+393,y+11,8,dark,true);
        text("Нетто, г",left+476,y+11,8,dark,true);y+=16;
        double total=0,cal=0,pv=0,fv=0,cv=0;int missingNutrition=0;
        LinkedHashSet<String> allerg=new LinkedHashSet<>();
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.optJSONObject(i);if(row==null)continue;
            float rh=size<8?15:17;
            if(i%2==0)box(left,y,537,rh,0,0xFFF9F9FA);
            String nm=row.optString("name");
            text(""+(i+1),left+9,y+11,size,dark,false);
            p.setTextSize(nm.length()>60?6.7f:size);p.setTypeface(Typeface.DEFAULT);
            if(p.measureText(nm)>355)throw new Exception("Слишком длинное название ингредиента: "+nm);
            text(nm,left+30,y+11,nm.length()>60?6.7f:size,dark,false);
            text(num(row.optDouble("brutto",0)),left+395,y+11,size,dark,false);
            text(num(row.optDouble("netto",0)),left+477,y+11,size,dark,false);
            double g=row.optDouble("netto",0);total+=g;
            JSONObject ing=store.findIngredient(nm);
            if(ing!=null){
                cal+=g*ing.optDouble("kcal",0)/100;pv+=g*ing.optDouble("p",0)/100;
                fv+=g*ing.optDouble("f",0)/100;cv+=g*ing.optDouble("c",0)/100;
                String a=ing.optString("allergen","");
                if(!a.isEmpty())allerg.add(a);
            }else missingNutrition++;
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
        String nutrition="На 100 г: "+num(audit.kcal100())+" ккал / Б "+num(audit.protein100())+" / Ж "+num(audit.fat100())+" / У "+num(audit.carbohydrates100())+" г. ";
        nutrition+="На порцию: "+num(audit.kcal)+" ккал. ";
        nutrition+=!audit.missingIngredients.isEmpty()||audit.unverifiedIngredients>0
            ? "ДЕМО: неполные или неподтверждённые данные." : "Расчёт по проверенной базе ингредиентов.";
        float ry=sectionText("5. ПИЩЕВАЯ ЦЕННОСТЬ",nutrition,rx,y,col);
        String allergText=audit.allergens.isEmpty()?"Аллергены не установлены по данным справочника.":"Выявлены: "+String.join("; ",audit.allergens)+".";
        allergText+=(audit.unknownAllergens>0?" НЕ ПОДТВЕРЖДЕНО: "+audit.unknownAllergens+" ингредиентов.":" Сверено с этикетками.");
        ry=sectionText("6. АЛЛЕРГЕНЫ",allergText,rx,ry,col);
        y=sectionText("7. СЫРЬЁ И ПОКАЗАТЕЛИ БЕЗОПАСНОСТИ",
            dish.optString("rawRequirements","")+". "+dish.optString("safety",""),left,Math.max(ly,ry)+2,537);
        y=sectionText("8. ХРАНЕНИЕ И РЕАЛИЗАЦИЯ",
            "Температура: "+dish.optString("temp","")+". Срок: "+dish.optString("storage","")+".",left,y,537);
        if(y>744)throw new Exception("ТТК не помещается на читаемый лист А4. Сократите текст или количество позиций.");
        // Elegant Japanese artwork fills empty space on short cards, without
        // stealing any of the required sections or obscuring signature fields.
        if(y<716){
            float start=Math.max(y+10,683);
            float height=Math.min(742-start,55);
            if(height>16){
                box(left,start,537,height,9,template==2?0xFFF1F5FA:0xFFFFF6F6);
                p.setColor(0x22C51C2E);c.drawCircle(455,start+height*.34f,Math.min(19,height*.35f),p);
                mountain(466,start+height-4,.52f);
                sakura(88,start+20,.52f);
                wave(132,start+height-16,.72f);
                torii(545,start+height-16,.43f);
            }
        }
        float fy=Math.max(765,y+13);
        rule(fy-12);
        text("Разработал: "+dish.optString("author","________________________"),left,fy,8,dark,false);
        text("Утверждаю: "+dish.optString("approver","________________________"),307,fy,8,dark,false);
        text("Подпись: ____________________",left,fy+20,8,muted,false);
        text("Дата: "+dish.optString("date","__________________"),307,fy+20,8,muted,false);
        p.setColor(red);p.setStrokeWidth(2);c.drawLine(left,809,right,809,p);
        text("FARUKH TTK PRO  •  JAPANESE COLLECTION",left,822,7,muted,false);
        text("СанПиН 4282-26 / ГОСТ 31987-2012",294,822,6.6f,muted,false);
        text(audit.readyForApproval?"К УТВЕРЖДЕНИЮ":"ЧЕРНОВИК",502,822,7,red,true);
    }
}
