package com.farukh.revision;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.view.ViewGroup;
import android.util.Base64;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String ORIGIN="https://appassets.androidplatform.net/";
    private static final String UPDATE_HOST="farukh-revision-updates.onrender.com";
    // The trusted static site publishes visual-only changes; APK binaries remain signed separately.
    private static final String UI_HOST="more-sushi-studio.onrender.com";
    private static final String UI_URL="https://"+UI_HOST+"/revision.html";
    private static final int MAX_UI_BYTES=3*1024*1024;
    private static final String UI_CACHE="revision-ui-cache-v1.html";

    private static final long MAX_APK_SIZE=120L*1024L*1024L;
    private static final int CSV_REQUEST=701;
    private WebView web;
    private byte[] pendingCsv;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Handler ui=new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(6,14,27));
        getWindow().setNavigationBarColor(Color.rgb(6,14,27));
        // Android 15/16 enforces edge-to-edge windows for targetSdk >= 35.
        // Let WebView receive system bar insets and explicitly keep its content clear.
        getWindow().getDecorView().setSystemUiVisibility(0);
        if(Build.VERSION.SDK_INT>=30) getWindow().setDecorFitsSystemWindows(false);
        if(Build.VERSION.SDK_INT>=29) getWindow().setNavigationBarContrastEnforced(false);
        // A padded root container prevents *all* WebView content (including CSS fixed
        // navigation and header) from rendering behind Android 16's system bars.
        FrameLayout root=new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(6,14,27));
        root.setOnApplyWindowInsetsListener((v,insets)->{
            if(Build.VERSION.SDK_INT>=30){
                android.graphics.Insets top=insets.getInsets(WindowInsets.Type.statusBars()|WindowInsets.Type.displayCutout());
                android.graphics.Insets bottom=insets.getInsets(WindowInsets.Type.navigationBars());
                v.setPadding(top.left,top.top,top.right,bottom.bottom);
            }else{
                v.setPadding(0,insets.getSystemWindowInsetTop(),0,insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(6,14,27));
        root.addView(web,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if(Build.VERSION.SDK_INT>=20) root.requestApplyInsets();
        WebSettings w=web.getSettings();
        w.setJavaScriptEnabled(true);
        w.setDomStorageEnabled(true);
        w.setAllowFileAccess(false);
        w.setAllowContentAccess(false);
        w.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){
                Uri uri=req.getUrl();
                if(req.isForMainFrame() && !ORIGIN.equals(uri.toString())) {
                    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
                    catch(Exception e){notice("Не удалось открыть внешнюю ссылку.");}
                    return true;
                }
                return false;
            }
            @Override public void onPageFinished(WebView v,String url){
                // CSS uses viewport-relative header and nav only after native insets apply.
                v.evaluateJavascript("document.body.classList.add('native-insets')",null);
                showPendingStatus();
            }
        });
        web.addJavascriptInterface(new AndroidBridge(),"FarukhAndroid");
        try{
            File cache=new File(getFilesDir(),UI_CACHE);
            String html=readSmall(cache.exists()?new FileInputStream(cache):getAssets().open("revision.html"),MAX_UI_BYTES);
            loadUi(html);
        }catch(Exception e){
            try{loadUi(readSmall(getAssets().open("revision.html"),MAX_UI_BYTES));}
            catch(Exception second){loadUi("<h1>Ошибка загрузки интерфейса</h1>");}
        }
    }
    private static String readSmall(InputStream input,int limit)throws Exception{
        try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] bytes=new byte[32768];int n;
            while((n=in.read(bytes))!=-1){
                if(out.size()+n>limit)throw new SecurityException("UI too large");
                out.write(bytes,0,n);
            }
            return out.toString("UTF-8");
        }
    }
    private void loadUi(String html){
        if(web!=null)web.loadDataWithBaseURL(ORIGIN,html,"text/html","UTF-8",null);
    }
    private static String normalizeTrustedHtml(String html)throws Exception{
        if(!html.contains("<title>FARUKH REVISION")||
           !html.contains("id=\"compactCloudTools\"")||
           !html.contains("id=\"view-revision\"")||
           !html.contains("checkAppUpdate()")||
           !html.contains("function weightOf("))
            throw new SecurityException("UI structure invalid");
        // Keep the same HTTPS origin across revisions, so localStorage never changes.
        // Link external visual assets explicitly to the trusted static site.
        return html.replace("src=\"./","src=\"https://"+UI_HOST+"/")
                   .replace("href=\"./","href=\"https://"+UI_HOST+"/");
    }
    private void refreshVisualUi(){
        io.execute(()->{
            try{
                notice("Проверяем обновление интерфейса…");
                HttpURLConnection c=(HttpURLConnection)new URL(UI_URL+"?native_check="+System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(9000);c.setReadTimeout(12000);
                c.setInstanceFollowRedirects(false);c.setUseCaches(false);
                String html;
                try{
                    if(c.getResponseCode()!=200)throw new IllegalStateException("HTTP "+c.getResponseCode());
                    html=normalizeTrustedHtml(readSmall(c.getInputStream(),MAX_UI_BYTES));
                }finally{c.disconnect();}
                byte[] bytes=html.getBytes("UTF-8");
                byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);
                StringBuilder hash=new StringBuilder();
                for(byte x:digest)hash.append(String.format(Locale.ROOT,"%02x",x&255));
                String previous=getSharedPreferences("farukh-ui-update",MODE_PRIVATE).getString("sha256","");
                if(hash.toString().equals(previous)){
                    notice("Интерфейс актуален. Все данные сохранены.");
                    return;
                }
                File tmp=new File(getFilesDir(),UI_CACHE+".tmp");
                File destination=new File(getFilesDir(),UI_CACHE);
                try(FileOutputStream out=new FileOutputStream(tmp)){
                    out.write(bytes);out.getFD().sync();
                }
                if(!tmp.renameTo(destination))throw new IllegalStateException("UI cache unavailable");
                getSharedPreferences("farukh-ui-update",MODE_PRIVATE).edit().putString("sha256",hash.toString()).apply();
                getSharedPreferences("farukh-update-status",MODE_PRIVATE).edit()
                    .putString("last-status","Интерфейс обновлён. Данные ревизий сохранены.").apply();
                ui.post(()->loadUi(html));
            }catch(Exception e){
                Log.w("FarukhRevision","Visual UI refresh failed",e);
                notice("Не удалось обновить интерфейс. Данные в безопасности; попробуй позже.");
            }
        });
    }
    private void notice(String msg){
        ui.post(()->{
            if(web==null)return;
            String escaped=msg.replace("\\","\\\\").replace("'","\\'").replace("\n"," ").replace("\r"," ");
            web.evaluateJavascript("(function(){var e=document.getElementById('appUpdateStatus');if(e){e.textContent='"+escaped+"';e.setAttribute('role','status');}})()",null);
        });
    }
    private void showPendingStatus(){
        String msg=getSharedPreferences("farukh-update-status",MODE_PRIVATE).getString("last-status","");
        if(!msg.isEmpty()){
            getSharedPreferences("farukh-update-status",MODE_PRIVATE).edit().remove("last-status").apply();
            notice(msg);
        }
    }
    @Override protected void onResume(){super.onResume();showPendingStatus();}
    @Override protected void onDestroy(){
        io.shutdownNow();
        if(web!=null){web.removeJavascriptInterface("FarukhAndroid");web.destroy();web=null;}
        super.onDestroy();
    }
    private long ownVersion(){
        try{
            PackageInfo p=getPackageManager().getPackageInfo(getPackageName(),0);
            return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;
        }catch(Exception e){return -1;}
    }
    public final class AndroidBridge {
        @JavascriptInterface public long getInstalledVersionCode(){return ownVersion();}
        @JavascriptInterface public void refreshWebUi(){refreshVisualUi();}
        @JavascriptInterface public void print(){
            ui.post(()->{
                PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);
                if(manager!=null&&web!=null)manager.print("FARUKH REVISION",web.createPrintDocumentAdapter("Ревизия"),null);
            });
        }
        @JavascriptInterface public void saveCsv(String filename,String base64){
            try{pendingCsv=Base64.decode(base64,Base64.DEFAULT);}
            catch(Exception e){notice("Ошибка подготовки CSV");return;}
            ui.post(()->{
                Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("text/csv");
                i.putExtra(Intent.EXTRA_TITLE,filename);
                startActivityForResult(i,CSV_REQUEST);
            });
        }
        @JavascriptInterface public void installVerifiedUpdate(String link,String sha256){
            if(link==null||sha256==null||!sha256.matches("(?i)[a-f0-9]{64}")){
                notice("Некорректные данные обновления");return;
            }
            Uri uri=Uri.parse(link);
            if(!"https".equalsIgnoreCase(uri.getScheme())||!UPDATE_HOST.equalsIgnoreCase(uri.getHost())||
               !"/revision-app/revision-pro.apk".equals(uri.getPath())){
                notice("Неподтверждённый сервер обновлений");return;
            }
            ui.post(()->{
                if(Build.VERSION.SDK_INT>=26&&!getPackageManager().canRequestPackageInstalls()){
                    notice("Разреши установку из FARUKH REVISION, затем нажми «Обновить» ещё раз.");
                    Intent i=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName()));
                    startActivity(i);
                }else io.execute(()->downloadAndInstall(link,sha256));
            });
        }
    }
    private static boolean isSameSigner(PackageInfo a,PackageInfo b){
        Signature[] x,y;
        if(Build.VERSION.SDK_INT>=28){
            if(a.signingInfo==null||b.signingInfo==null)return false;
            x=a.signingInfo.getApkContentsSigners();y=b.signingInfo.getApkContentsSigners();
        }else {x=a.signatures;y=b.signatures;}
        return x!=null&&y!=null&&x.length==1&&y.length==1&&
               MessageDigest.isEqual(x[0].toByteArray(),y[0].toByteArray());
    }
    private void downloadAndInstall(String link,String expected){
        File apk=new File(getCacheDir(),"verified-update.apk");
        try{
            notice("Скачиваем обновление…");
            HttpURLConnection c=(HttpURLConnection)new URL(link).openConnection();
            c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Accept","application/vnd.android.package-archive");
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            long count=0;
            try{
                if(c.getResponseCode()!=200)throw new IllegalStateException("HTTP "+c.getResponseCode());
                try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(apk)){
                    byte[] buf=new byte[65536];int n;
                    while((n=in.read(buf))!=-1){
                        count+=n;
                        if(count>MAX_APK_SIZE)throw new SecurityException("APK слишком большой");
                        digest.update(buf,0,n);out.write(buf,0,n);
                    }
                    out.getFD().sync();
                }
            }finally{c.disconnect();}
            StringBuilder sha=new StringBuilder();
            for(byte b:digest.digest())sha.append(String.format(Locale.ROOT,"%02x",b&255));
            if(!sha.toString().equalsIgnoreCase(expected))throw new SecurityException("SHA-256 не совпадает");
            PackageManager pm=getPackageManager();
            int f=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
            PackageInfo other=pm.getPackageArchiveInfo(apk.getAbsolutePath(),f);
            PackageInfo own=pm.getPackageInfo(getPackageName(),f);
            if(other==null||!getPackageName().equals(other.packageName)||!isSameSigner(other,own))
                throw new SecurityException("Подпись или имя пакета не совпадают");
            long remoteCode=Build.VERSION.SDK_INT>=28?other.getLongVersionCode():other.versionCode;
            if(remoteCode<=ownVersion())throw new SecurityException("Новая версия должна быть новее установленной");
            notice("APK проверена. Подтверди установку в Android.");
            PackageInstaller pi=pm.getPackageInstaller();
            PackageInstaller.SessionParams params=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(getPackageName());
            int sessionId=pi.createSession(params);
            // PackageInstaller.commit() MUST run after every openWrite stream is closed.
            // Otherwise Android rejects the install with "Files still open".
            boolean committed=false;
            try(PackageInstaller.Session session=pi.openSession(sessionId)){
                try(FileInputStream in=new FileInputStream(apk);
                    OutputStream out=session.openWrite("base.apk",0,apk.length())){
                    byte[] buf=new byte[65536];int n;
                    while((n=in.read(buf))!=-1)out.write(buf,0,n);
                    session.fsync(out);
                }
                Intent intent=new Intent(MainActivity.this,UpdateReceiver.class).setAction("com.farukh.revision.UPDATE_STATUS");
                int flags=PendingIntent.FLAG_UPDATE_CURRENT;
                if(Build.VERSION.SDK_INT>=31)flags|=PendingIntent.FLAG_MUTABLE;
                PendingIntent callback=PendingIntent.getBroadcast(MainActivity.this,sessionId,intent,flags);
                session.commit(callback.getIntentSender());
                committed=true;
            }finally{
                if(!committed)pi.abandonSession(sessionId);
            }
        }catch(Exception e){
            Log.e("FarukhRevision","Update failed",e);
            notice("Обновление не установлено: "+(e instanceof SecurityException?e.getMessage():"проверь интернет и файл."));
        }finally{apk.delete();}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=CSV_REQUEST)return;
        if(result!=RESULT_OK||data==null||data.getData()==null||pendingCsv==null)return;
        try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
            if(out!=null)out.write(pendingCsv);
        }catch(Exception e){notice("Не удалось сохранить CSV");}
        finally{pendingCsv=null;}
    }
}
