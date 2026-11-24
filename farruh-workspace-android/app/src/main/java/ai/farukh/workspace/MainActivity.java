package ai.farukh.workspace;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.provider.Settings;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * All HTTPS project navigations stay top-level inside this ONE persistent
 * Android WebView. A pinned native Home button is always available.
 * No JS bridges, proxying or circumventing the sites' iframe restrictions.
 */
public final class MainActivity extends Activity {
    private static final String HOME = "https://more-sushi-studio.onrender.com/mobile.html";
    private static final String UA = "FarruhWorkspaceNative/1.0";
    private static final String UPDATE_JSON = "https://more-sushi-studio.onrender.com/workspace-android-update.json";
    private static final String TRUSTED_APK_PREFIX = "https://more-sushi-studio.onrender.com/android-updates/";
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final int PICK_FILE = 801, MEDIA_REQUEST = 802;
    private static final Set<String> MEDIA_HOSTS = new HashSet<>(Arrays.asList(
      "more-sushi-studio.onrender.com","farruhk-ai-mobile.onrender.com",
      "chefaka.onrender.com","shef51.onrender.com","sushi-beri.ru","www.sushi-beri.ru"
    ));
    private WebView browser;
    private TextView caption;
    private ProgressBar progress;
    private ValueCallback<Uri[]> filePicker;
    private PermissionRequest pendingMedia;
    private long pendingDownload = -1L;
    private String pendingHash = null;
    private Uri verifiedInstallUri = null;
    private boolean downloadReceiverActive = false;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        getWindow().setStatusBarColor(Color.rgb(30,26,35));
        getWindow().setNavigationBarColor(Color.rgb(30,26,35));
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((v,insets)->{
            if(Build.VERSION.SDK_INT>=30){
                android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());
                v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            }else{
                v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        LinearLayout bar=new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(dp(6),dp(4),dp(6),dp(4));
        bar.setBackgroundColor(Color.rgb(37,34,46));
        root.addView(bar,new LinearLayout.LayoutParams(-1,dp(52)));
        Button home=button("‹ Проекты",12);
        home.setOnClickListener(v->browser.loadUrl(HOME));
        bar.addView(home,new LinearLayout.LayoutParams(dp(96),dp(42)));
        caption=new TextView(this);caption.setText("FARRUH WORKSPACE");
        caption.setTextColor(Color.WHITE);caption.setTextSize(11);
        caption.setTypeface(Typeface.DEFAULT,Typeface.BOLD);caption.setGravity(Gravity.CENTER);
        caption.setSingleLine(true);caption.setEllipsize(android.text.TextUtils.TruncateAt.END);
        bar.addView(caption,new LinearLayout.LayoutParams(0,dp(42),1f));
        Button pdf=button("PDF",12);
        pdf.setOnClickListener(v->saveAsPdf());
        bar.addView(pdf,new LinearLayout.LayoutParams(dp(47),dp(42)));
        Button reload=button("Обновить",11);
        reload.setOnClickListener(v->checkForUpdates());
        bar.addView(reload,new LinearLayout.LayoutParams(dp(84),dp(42)));
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);progress.setVisibility(View.GONE);
        root.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
        browser=new WebView(this);browser.setBackgroundColor(Color.WHITE);
        root.addView(browser,new LinearLayout.LayoutParams(-1,0,1f));
        setContentView(root);
        setupBrowser();
        IntentFilter downloads=new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if(Build.VERSION.SDK_INT>=33)
            registerReceiver(downloadReceiver,downloads,Context.RECEIVER_EXPORTED);
        else registerReceiver(downloadReceiver,downloads);
        downloadReceiverActive=true;
        if(savedState!=null)browser.restoreState(savedState);
        else browser.loadUrl(HOME);
    }
    private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
    private Button button(String title,int textSize){
        Button b=new Button(this);
        b.setAllCaps(false);b.setText(title);b.setTextSize(textSize);
        b.setTextColor(Color.WHITE);b.setPadding(0,0,0,0);
        b.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(176,20,76)));
        return b;
    }
    private boolean safeHttps(Uri uri){
        return uri!=null&&"https".equalsIgnoreCase(uri.getScheme())
           &&uri.getHost()!=null&&!uri.getHost().isEmpty();
    }
    private boolean isHome(String url){
        if(url==null)return false;
        Uri u=Uri.parse(url);
        return safeHttps(u)&&"more-sushi-studio.onrender.com".equalsIgnoreCase(u.getHost())
            &&"/mobile.html".equals(u.getPath());
    }
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
    private void handleOther(Uri uri){
        if(uri==null)return;
        String scheme=uri.getScheme()==null?"":uri.getScheme().toLowerCase(Locale.ROOT);
        if(Arrays.asList("tel","sms","mailto","geo").contains(scheme)){
            try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
            catch(ActivityNotFoundException ex){toast("Для этой ссылки нет подходящего приложения.");}
        }else toast("Открытие разрешено только для защищённых HTTPS-сайтов.");
    }
    private void updateCaption(String url){
        if(isHome(url)){caption.setText("FARRUH WORKSPACE PRO");return;}
        if(url==null){caption.setText("ПРОЕКТ");return;}
        String host=Uri.parse(url).getHost();
        caption.setText(host==null?"ПРОЕКТ":host.replace(".onrender.com","").toUpperCase(Locale.ROOT));
    }
    private void setupBrowser(){
        WebSettings settings=browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUseWideViewPort(true);
        if(Build.VERSION.SDK_INT>=26)settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString()+" "+UA);
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser,false);
        browser.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                if(!request.isForMainFrame())return false;
                if(safeHttps(request.getUrl()))return false; // SAME Android WebView, not Chrome.
                handleOther(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){
                progress.setVisibility(View.VISIBLE);updateCaption(url);
            }
            @Override public void onPageFinished(WebView v,String url){
                progress.setVisibility(View.GONE);updateCaption(url);
            }
            @Override public void onReceivedError(WebView v,WebResourceRequest request,WebResourceError error){
                if(request.isForMainFrame())toast("Не удалось открыть сайт. Проверь интернет и нажми ↻.");
            }
            @Override public void onReceivedSslError(WebView v,SslErrorHandler h,SslError err){
                h.cancel();toast("Страница с небезопасным сертификатом заблокирована.");
            }
        });
        browser.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView v,int n){
                progress.setProgress(n);progress.setVisibility(n>=100?View.GONE:View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(filePicker!=null)filePicker.onReceiveValue(null);
                filePicker=callback;
                try{startActivityForResult(params.createIntent(),PICK_FILE);return true;}
                catch(Exception ex){filePicker=null;toast("Не удалось выбрать файл");return false;}
            }
            @Override public void onPermissionRequest(PermissionRequest request){
                runOnUiThread(()->grantMedia(request));
            }
            @Override public boolean onCreateWindow(WebView parent,boolean dialog,boolean gesture,Message msg){
                // target=_blank must navigate inside the same Android app.
                if(!gesture)return false;
                WebView popup=new WebView(MainActivity.this);
                popup.getSettings().setJavaScriptEnabled(true);
                popup.setWebViewClient(new WebViewClient(){
                    private boolean moved=false;
                    private void transfer(Uri to){
                        if(moved)return;moved=true;
                        if(safeHttps(to))browser.loadUrl(to.toString());
                        else handleOther(to);
                        handler.postDelayed(popup::destroy,250);
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){
                        if(req.isForMainFrame())transfer(req.getUrl());
                        return true;
                    }
                    @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){
                        if(url!=null&&!"about:blank".equals(url))transfer(Uri.parse(url));
                    }
                });
                WebView.WebViewTransport transport=(WebView.WebViewTransport)msg.obj;
                transport.setWebView(popup);msg.sendToTarget();
                return true;
            }
        });
        browser.setDownloadListener((url,agent,disposition,mime,length)->{
            Uri uri=Uri.parse(url);
            if(!safeHttps(uri)){toast("Для PDF нажми верхнюю кнопку PDF.");return;}
            try{
                String name=URLUtil.guessFileName(url,disposition,mime);
                DownloadManager.Request request=new DownloadManager.Request(uri);
                request.setTitle(name);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,name);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                if(mime!=null&&!mime.isEmpty())request.setMimeType(mime);
                String cookie=CookieManager.getInstance().getCookie(url);
                if(cookie!=null&&!cookie.isEmpty())request.addRequestHeader("Cookie",cookie);
                if(agent!=null&&!agent.isEmpty())request.addRequestHeader("User-Agent",agent);
                ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                toast("Файл загружается в папку «Загрузки»: "+name);
            }catch(Exception ex){toast("Загрузка недоступна. Попробуй кнопку PDF.");}
        });
    }

    /* Web content refreshes in-place. A new NATIVE APK can only replace the
     * installed version when the package ID AND signing certificate match.
     * Never clear cookies or local storage during either update. */
    private void checkForUpdates(){
        // Web changes apply immediately even if no native APK update is offered.
        if(browser!=null)browser.reload();
        new Thread(()->{
            try{
                HttpURLConnection c=(HttpURLConnection)new URL(UPDATE_JSON+"?t="+System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(9000);
                c.setReadTimeout(9000);
                c.setInstanceFollowRedirects(false);
                c.setRequestProperty("Accept","application/json");
                if(c.getResponseCode()!=200)throw new Exception("HTTP "+c.getResponseCode());
                ByteArrayOutputStream out=new ByteArrayOutputStream();
                try(InputStream input=c.getInputStream()){
                    byte[] buf=new byte[1024];int n;
                    while((n=input.read(buf))!=-1){
                        out.write(buf,0,n);
                        if(out.size()>8000)throw new Exception("Слишком большой ответ");
                    }
                }finally{c.disconnect();}
                JSONObject json=new JSONObject(out.toString("UTF-8"));
                if(!getPackageName().equals(json.optString("packageName")))
                    throw new Exception("Несовместимый пакет");
                int published=json.optInt("versionCode",0);
                int installed=(int)getPackageManager().getPackageInfo(getPackageName(),0).getLongVersionCode();
                if(published<=installed){
                    runOnUiThread(()->toast("Веб-интерфейс обновлён. Новых обновлений APK нет."));
                    return;
                }
                String url=json.optString("apkUrl","");
                String sha=json.optString("sha256","").toLowerCase(Locale.ROOT);
                if(!url.startsWith(TRUSTED_APK_PREFIX)||!url.endsWith(".apk")||!sha.matches("[a-f0-9]{64}"))
                    throw new Exception("Не опубликована проверенная подписанная APK");
                final String safeUrl=url;final String safeHash=sha;final int code=published;
                runOnUiThread(()->new AlertDialog.Builder(this)
                    .setTitle("Доступно обновление APK")
                    .setMessage("Найдена новая версия "+code+". Скачать и обновить приложение без удаления? Android попросит подтвердить установку. Данные останутся, если подпись совпадает.")
                    .setNegativeButton("Позже",null)
                    .setPositiveButton("Скачать", (dialog,which)->downloadUpdate(safeUrl,safeHash,code))
                    .show());
            }catch(Exception e){
                runOnUiThread(()->toast("Веб-страница обновлена. Проверка APK недоступна."));
            }
        },"FarruhAPKVersionCheck").start();
    }
    private void downloadUpdate(String source,String sha,int code){
        try{
            String name="FARRUH_WORKSPACE_PRO_"+code+".apk";
            DownloadManager.Request r=new DownloadManager.Request(Uri.parse(source));
            r.setTitle("Обновление FARRUH WORKSPACE PRO");
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setMimeType(APK_MIME);
            r.setDestinationInExternalFilesDir(this,Environment.DIRECTORY_DOWNLOADS,name);
            pendingHash=sha;
            pendingDownload=((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
            toast("APK скачивается. Установку подтвердит Android.");
        }catch(Exception e){toast("Не удалось скачать обновление. Текущая версия сохранена.");}
    }
    private final BroadcastReceiver downloadReceiver=new BroadcastReceiver(){
        @Override public void onReceive(Context context,Intent intent){
            if(!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction()))return;
            long id=intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID,-1L);
            if(id!=pendingDownload||id<0)return;
            final String expected=pendingHash;
            pendingDownload=-1L;pendingHash=null;
            new Thread(()->{
                try{
                    DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE);
                    Uri uri=dm.getUriForDownloadedFile(id);
                    if(uri==null||expected==null)throw new Exception("Скачивание не завершено");
                    MessageDigest digest=MessageDigest.getInstance("SHA-256");
                    try(InputStream input=getContentResolver().openInputStream(uri)){
                        if(input==null)throw new Exception("Файл не доступен");
                        byte[] chunk=new byte[32768];int n;
                        while((n=input.read(chunk))!=-1)digest.update(chunk,0,n);
                    }
                    StringBuilder hex=new StringBuilder();
                    for(byte b:digest.digest())hex.append(String.format(Locale.ROOT,"%02x",b&255));
                    if(!expected.equals(hex.toString()))throw new Exception("Контрольная сумма APK не совпала");
                    runOnUiThread(()->{
                        verifiedInstallUri=uri;
                        new AlertDialog.Builder(thisActivity())
                          .setTitle("APK проверена")
                          .setMessage("Файл скачан и SHA-256 совпадает. Перейти к стандартной установке Android?")
                          .setNegativeButton("Позже",null)
                          .setPositiveButton("Установить",(dialog,which)->installVerified())
                          .show();
                    });
                }catch(Exception e){
                    runOnUiThread(()->toast("APK не прошла проверку. Установка отменена."));
                }
            },"FarruhAPKDigest").start();
        }
    };
    private MainActivity thisActivity(){return this;}
    private void installVerified(){
        if(verifiedInstallUri==null)return;
        if(Build.VERSION.SDK_INT>=26&&!getPackageManager().canRequestPackageInstalls()){
            toast("Разреши обновление из этого приложения в настройках Android.");
            Intent i=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:"+getPackageName()));
            try{startActivity(i);}catch(Exception e){toast("Не удалось открыть настройки установки");}
            return;
        }
        try{
            Intent i=new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(verifiedInstallUri,APK_MIME);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        }catch(Exception e){toast("Не удалось запустить установку APK");}
    }
    @Override protected void onResume(){
        super.onResume();
        // User may have returned from Android "Install unknown apps" permission page.
        // Never trigger a silent install: ask for confirmation again.
    }

    private void saveAsPdf(){
        if(browser==null||browser.getUrl()==null){toast("Сначала открой документ.");return;}
        try{
            PrintManager mgr=(PrintManager)getSystemService(PRINT_SERVICE);
            PrintAttributes attrs=new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS).build();
            mgr.print("FARRUH WORKSPACE A4",
                browser.createPrintDocumentAdapter("FARRUH WORKSPACE"),attrs);
        }catch(Exception ex){toast("Не удалось открыть меню печати.");}
    }
    private void grantMedia(PermissionRequest req){
        Uri u=req.getOrigin();
        if(!safeHttps(u)||!MEDIA_HOSTS.contains(u.getHost().toLowerCase(Locale.ROOT))){
            req.deny();return;
        }
        Set<String> requested=new HashSet<>();
        for(String kind:req.getResources()){
            if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(kind))requested.add(Manifest.permission.CAMERA);
            else if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(kind))requested.add(Manifest.permission.RECORD_AUDIO);
            else {req.deny();return;}
        }
        if(requested.isEmpty()){req.deny();return;}
        String[] missing=requested.stream().filter(p->checkSelfPermission(p)!=PackageManager.PERMISSION_GRANTED).toArray(String[]::new);
        if(missing.length==0){req.grant(req.getResources());return;}
        pendingMedia=req;requestPermissions(missing,MEDIA_REQUEST);
    }
    @Override public void onRequestPermissionsResult(int req,String[] names,int[] results){
        super.onRequestPermissionsResult(req,names,results);
        if(req!=MEDIA_REQUEST)return;
        PermissionRequest pending=pendingMedia;pendingMedia=null;
        if(pending==null)return;
        if(results.length==0){pending.deny();return;}
        for(int result:results)if(result!=PackageManager.PERMISSION_GRANTED){pending.deny();return;}
        pending.grant(pending.getResources());
    }
    @Override @Deprecated protected void onActivityResult(int req,int status,Intent data){
        super.onActivityResult(req,status,data);
        if(req==PICK_FILE){
            ValueCallback<Uri[]> c=filePicker;filePicker=null;
            if(c!=null)c.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(status,data));
        }
    }
    @Override public void onSaveInstanceState(Bundle state){
        browser.saveState(state);super.onSaveInstanceState(state);
    }
    @Override @Deprecated public void onBackPressed(){
        if(browser.canGoBack())browser.goBack();
        else if(!isHome(browser.getUrl()))browser.loadUrl(HOME);
        else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(downloadReceiverActive){unregisterReceiver(downloadReceiver);downloadReceiverActive=false;}
        if(filePicker!=null){filePicker.onReceiveValue(null);filePicker=null;}
        if(pendingMedia!=null){pendingMedia.deny();pendingMedia=null;}
        browser.stopLoading();browser.destroy();
        super.onDestroy();
    }
}
