package com.farukh.ttkpro;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.View;

/** True light-paper thumbnail for the four real A4 PDF themes. */
public class TemplateThumbnail extends View {
    private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final int theme;
    private final boolean active;
    private static final int[] ACCENTS={
        0xFFC51C2E,0xFFBD4764,0xFF304F8C,0xFFD34538
    };
    public TemplateThumbnail(Context ctx,int template,boolean selected){
        super(ctx);theme=template;active=selected;
        setLayerType(View.LAYER_TYPE_SOFTWARE,null);
    }
    private void rect(Canvas c,float x,float y,float w,float h,float r,int color){
        p.setStyle(Paint.Style.FILL);p.setColor(color);c.drawRoundRect(new RectF(x,y,x+w,y+h),r,r,p);
    }
    @Override protected void onDraw(Canvas c){
        super.onDraw(c);
        float sx=getWidth()/100f,sy=getHeight()/136f;c.save();c.scale(sx,sy);
        p.setShadowLayer(3,0,1,0x28000000);
        rect(c,4,4,92,128,5,Color.WHITE);p.clearShadowLayer();
        int red=ACCENTS[theme];
        rect(c,4,4,92,4,1,red);rect(c,8,13,12,12,2,red);
        p.setColor(0xFF242630);p.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);p.setTextSize(6.2f);
        c.drawText("FARUKH",22,18,p);c.drawText("ТТК",22,24,p);
        // The Japanese Pro covers keep consistent white sheets and red/blue motifs.
        p.setStyle(Paint.Style.FILL);
        p.setColor(theme==2?0x22304F8C:0x20CC3040);c.drawCircle(81,22,10,p);
        if(theme==2){
            p.setColor(0xFFB6C6DF);Path m=new Path();m.moveTo(62,34);
            m.lineTo(81,12);m.lineTo(98,34);m.close();c.drawPath(m,p);
        }else if(theme==0||theme==3){
            p.setColor(red);
            c.drawRect(73,30,92,32,p);c.drawRect(76,34,89,36,p);
            c.drawRect(77,32,79,44,p);c.drawRect(86,32,88,44,p);
        }else{
            for(int i=0;i<5;i++){
                double a=2*Math.PI*i/5;
                rect(c,(float)(82+Math.cos(a)*7),(float)(26+Math.sin(a)*7),5,5,3,0xFFE9A2B6);
            }
        }
        rect(c,8,38,44,5,1,0xFF292B33);
        rect(c,8,46,75,5,1,red);
        rect(c,8,55,84,6,1,red);
        for(int i=0;i<5;i++){
            rect(c,8,63+i*6,84,5,0.5f,i%2==0?0xFFF4F3F4:0xFFFFFFFF);
            p.setColor(0xFFCDD0D6);p.setStrokeWidth(.5f);
            c.drawLine(64,63+i*6,64,68+i*6,p);
        }
        rect(c,8,96,84,5,1,red);
        for(int i=0;i<4;i++)rect(c,8,104+i*4,56+(i%2)*18,2,0,0xFFC7C9CD);
        rect(c,8,125,84,2,0,red);
        if(active){p.setColor(0xFFE31B36);p.setStrokeWidth(2.5f);p.setStyle(Paint.Style.STROKE);
            c.drawRoundRect(new RectF(3,3,97,133),6,6,p);p.setStyle(Paint.Style.FILL);
        }
        c.restore();
    }
}
