package com.farukh.ttkpro;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.Intent;
import android.content.UriPermission;
import android.net.Uri;
import android.provider.DocumentsContract;
import org.json.JSONObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.List;

/**
 * Android Storage Access Framework archive.
 * User explicitly picks the destination folder (including Google Drive when its
 * document provider exposes writable folders). Persistent URI permissions allow
 * later PDF backups on every Save. No passwords or Google tokens are stored here.
 * This is NOT a Google Drive API OAuth implementation; providers may not support
 * writable document trees, and failures must be surfaced to the user.
 */
public final class AutoArchive {
    private static final String PREFS="farukh_ttk_archive";
    private static final String KEY_FOLDER="folderUri";
    private static final String KEY_LABEL="folderLabel";
    private static final String KEY_STATUS="lastStatus";
    private static final String KEY_TIME="lastTime";
    private static final String MIME_PDF="application/pdf";
    private static final String MIME_JSON="application/json";
    private AutoArchive(){}

    public static Intent picker(){
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                   Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                   Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        return i;
    }
    private static SharedPreferences prefs(Context ctx){
        return ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }
    public static boolean enabled(Context ctx){
        return !prefs(ctx).getString(KEY_FOLDER,"").isEmpty();
    }
    public static String label(Context ctx){
        return prefs(ctx).getString(KEY_LABEL,"Папка не выбрана");
    }
    public static String lastStatus(Context ctx){
        return prefs(ctx).getString(KEY_STATUS,"Сохранений в облачную папку пока не было");
    }
    public static void disable(Context ctx){
        prefs(ctx).edit().remove(KEY_FOLDER).remove(KEY_LABEL)
            .putString(KEY_STATUS,"Автоархив отключён").apply();
    }
    public static void select(Context ctx,Uri uri,int flags)throws Exception{
        if(uri==null)throw new Exception("Папка не выбрана");
        int persist=flags&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if((persist&Intent.FLAG_GRANT_WRITE_URI_PERMISSION)==0)
            throw new Exception("Провайдер не разрешает запись в выбранную папку");
        ctx.getContentResolver().takePersistableUriPermission(uri,persist);
        String folder=uri.toString();
        prefs(ctx).edit().putString(KEY_FOLDER,folder)
            .putString(KEY_LABEL,uri.getAuthority()+" / "+DocumentsContract.getTreeDocumentId(uri))
            .putString(KEY_STATUS,"Папка подключена. Запись будет проверена при сохранении ТТК.").apply();
    }
    public static String archive(Context ctx,TTKStore store,JSONObject dish)throws Exception{
        String raw=prefs(ctx).getString(KEY_FOLDER,"");
        if(raw.isEmpty())throw new Exception("Папка Google Диска или файлового архива не выбрана");
        Uri tree=Uri.parse(raw);
        if(!hasWritePermission(ctx,tree))throw new Exception("Нет постоянного разрешения на запись — выбери папку повторно");
        byte[] pdf=PdfMaker.generate(ctx,store,dish);
        String id=dish.optString("id","ttk").replaceAll("[^0-9A-Za-z_-]","");
        String name=safe(dish.optString("name","Блюдо"));
        String stamp=new SimpleDateFormat("yyyyMMdd-HHmmss",Locale.US).format(new Date());
        String pdfName="TTK_"+name+"_"+id+"_"+stamp+".pdf";
        Uri saved=writeFile(ctx,tree,pdfName,MIME_PDF,pdf);
        // Keep a restorable local catalog alongside the PDF in the user's folder.
        byte[] json=store.backup().toString(2).getBytes(StandardCharsets.UTF_8);
        try{
            writeFile(ctx,tree,"FARUKH_TTK_PRO_backup_"+stamp+".json",MIME_JSON,json);
            mark(ctx,"✅ PDF и база ТТК сохранены: "+pdfName);
        }catch(Exception e){
            mark(ctx,"⚠ PDF сохранён, база не сохранена: "+e.getMessage());
        }
        return saved.toString();
    }
    private static String safe(String s){
        s=s.replaceAll("[^\\p{L}\\p{N}_-]+","_");
        if(s.length()>42)s=s.substring(0,42);
        return s.isEmpty()?"dish":s;
    }
    private static void mark(Context ctx,String message){
        prefs(ctx).edit().putString(KEY_STATUS,message).putLong(KEY_TIME,System.currentTimeMillis()).apply();
    }
    public static void error(Context ctx,Exception e){
        mark(ctx,"❌ Автоархив не сохранён: "+e.getMessage());
    }
    private static boolean hasWritePermission(Context ctx,Uri tree){
        for(UriPermission grant:ctx.getContentResolver().getPersistedUriPermissions())
            if(grant.getUri().equals(tree)&&grant.isWritePermission())return true;
        return false;
    }
    private static Uri writeFile(Context ctx,Uri tree,String name,String type,byte[] data)throws Exception{
        Uri folder=DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));
        Uri dst=DocumentsContract.createDocument(ctx.getContentResolver(),folder,type,name);
        if(dst==null)throw new Exception("Папка не поддерживает создание файла (возможно, Google Диск не поддерживает доступ SAF)");
        try(OutputStream out=ctx.getContentResolver().openOutputStream(dst,"w")){
            if(out==null)throw new Exception("Не удалось открыть файл");
            out.write(data);
            out.flush();
        }catch(Exception e){
            try{DocumentsContract.deleteDocument(ctx.getContentResolver(),dst);}catch(Exception ignore){}
            throw e;
        }
        return dst;
    }
}
