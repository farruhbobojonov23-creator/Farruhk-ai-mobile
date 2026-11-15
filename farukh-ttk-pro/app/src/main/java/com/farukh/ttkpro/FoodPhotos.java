package com.farukh.ttkpro;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.widget.ImageView;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.util.LruCache;

/**
 * Loads the 11 category photographs from the user's own More Sushi photo library.
 * First load uses a public HTTPS path and then caches the file on the phone
 * for offline browsing. Local user-selected images always take priority.
 */
public final class FoodPhotos {
    private static final String BASE="https://raw.githubusercontent.com/farruhbobojonov23-creator/"
        +"Farruhk-ai-mobile/more-sushi-studio-free/public/assets/categories/";
    private static final ExecutorService WORKERS=Executors.newFixedThreadPool(3);
    private static final Handler UI=new Handler(Looper.getMainLooper());
    private static final LruCache<String,Bitmap> MEMORY=new LruCache<String,Bitmap>(8*1024){
        @Override protected int sizeOf(String key,Bitmap bmp){return Math.max(1,bmp.getByteCount()/1024);}
    };
    private FoodPhotos(){}
    public static String categoryAsset(String category){
        if(category==null)return "cold.png";
        if(category.contains("Запеч"))return "baked.png";
        if(category.contains("Темпура"))return "tempura.png";
        if(category.contains("Маки"))return "maki.png";
        if(category.contains("Гункан"))return "gunkan.png";
        if(category.contains("Онигири"))return "onigiri.png";
        if(category.contains("Воки"))return "wok.png";
        if(category.contains("Бери-дог"))return "beridog.png";
        if(category.contains("Закус"))return "snacks.png";
        if(category.contains("Набор"))return "cold.png";
        if(category.contains("Полуфаб"))return "preparations.png";
        if(category.contains("Суши"))return "sushi.png";
        return "cold.png";
    }
    private static String sanitize(String key){
        return key!=null && key.matches("[a-z_]+\\.png")?key:"cold.png";
    }
    private static File cachePath(Context ctx,String asset){
        File dir=new File(ctx.getFilesDir(),"ttk_photo_cache");
        if(!dir.exists())dir.mkdirs();
        return new File(dir,sanitize(asset));
    }
    private static Bitmap decoded(byte[] data){
        BitmapFactory.Options probe=new BitmapFactory.Options();
        probe.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(data,0,data.length,probe);
        if(probe.outWidth<=0||probe.outHeight<=0)return null;
        BitmapFactory.Options opts=new BitmapFactory.Options();
        int max=Math.max(probe.outWidth,probe.outHeight);
        opts.inSampleSize=max>1800?4:max>900?2:1;
        return BitmapFactory.decodeByteArray(data,0,data.length,opts);
    }
    public static Bitmap cached(Context ctx,String asset){
        asset=sanitize(asset);
        Bitmap bmp=MEMORY.get(asset);if(bmp!=null && !bmp.isRecycled())return bmp;
        File file=cachePath(ctx,asset);
        if(!file.exists())return null;
        try{
            byte[] data=read(file);
            bmp=decoded(data);
            if(bmp!=null){MEMORY.put(asset,bmp);return bmp;}
        }catch(Exception ignore){}
        return null;
    }
    private static byte[] read(File file)throws Exception{
        try(InputStream in=new FileInputStream(file)){
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            byte[] buf=new byte[8192];int n;
            while((n=in.read(buf))!=-1){
                if(out.size()+n>2*1024*1024)throw new Exception("Image too large");
                out.write(buf,0,n);
            }
            return out.toByteArray();
        }
    }
    public static void show(Context ctx,ImageView image,String asset){
        final String key=sanitize(asset);
        image.setTag(key);
        Bitmap bmp=cached(ctx,key);
        if(bmp!=null){image.setImageBitmap(bmp);return;}
        image.setImageDrawable(null);
        WORKERS.execute(()->{
            Bitmap result=cached(ctx,key);
            if(result==null){
                HttpURLConnection conn=null;
                try{
                    URL url=new URL(BASE+key);
                    conn=(HttpURLConnection)url.openConnection();
                    conn.setConnectTimeout(9000);conn.setReadTimeout(9000);
                    conn.setInstanceFollowRedirects(false);
                    if(conn.getResponseCode()==200){
                        File file=cachePath(ctx,key),tmp=new File(file.getAbsolutePath()+".tmp");
                        try(InputStream in=conn.getInputStream();FileOutputStream out=new FileOutputStream(tmp)){
                            int count=0;byte[] buf=new byte[8192];int n;
                            while((n=in.read(buf))!=-1){
                                count+=n;if(count>2*1024*1024)throw new Exception("Image too large");
                                out.write(buf,0,n);
                            }
                        }
                        if(countIsImage(tmp)){
                            if(!tmp.renameTo(file))throw new Exception("Cannot cache image");
                            result=cached(ctx,key);
                        }else tmp.delete();
                    }
                }catch(Exception ignore){}
                finally{if(conn!=null)conn.disconnect();}
            }
            final Bitmap imageBitmap=result;
            if(imageBitmap!=null)UI.post(()->{
                if(key.equals(image.getTag())){
                    image.setImageBitmap(imageBitmap);image.setAlpha(0f);
                    image.animate().alpha(1f).setDuration(220).start();
                }
            });
        });
    }
    private static boolean countIsImage(File f){
        try(InputStream in=new FileInputStream(f)){
            byte[] head=new byte[8];if(in.read(head)!=8)return false;
            return head[0]==(byte)0x89&&head[1]=='P'&&head[2]=='N'&&head[3]=='G';
        }catch(Exception e){return false;}
    }
}
