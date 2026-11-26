package ai.farukh.supply;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.webkit.*;
import android.view.WindowInsets;
import android.view.View;
import androidx.webkit.WebViewAssetLoader;
public class MainActivity extends Activity {
 private WebView web;
 private ValueCallback<Uri[]> pending;
 private final java.util.concurrent.ExecutorService ocrExecutor=java.util.concurrent.Executors.newSingleThreadExecutor();
 private volatile long scanSequence=0;
 private long photoSequence=0;
 private final InvoiceOcr.PhotoSession photoSession=new InvoiceOcr.PhotoSession();
 private Uri lastScan;
 private SupplyUpdater updater;
 private ReportExport reports;
 private WebUpdates webUpdates;
 @Override public void onCreate(Bundle saved) {
 super.onCreate(saved);
 webUpdates=new WebUpdates(this);
 updater=new SupplyUpdater(this,webUpdates,()->{scanSequence++;photoSequence++;lastScan=null;ocrExecutor.execute(photoSession::close);web.clearCache(false);web.loadUrl("https://appassets.androidplatform.net/assets/index.html");});
 web=new WebView(this); reports=new ReportExport(this);reports.attach(web); web.setBackgroundColor(Color.rgb(7,24,44));
 android.widget.FrameLayout root=new android.widget.FrameLayout(this);
 root.setBackgroundColor(Color.rgb(6,22,36));
 if(android.os.Build.VERSION.SDK_INT>=30){
   getWindow().setDecorFitsSystemWindows(false);
   getWindow().getInsetsController().setSystemBarsAppearance(0,android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
 }else{
   getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
 }
 if(android.os.Build.VERSION.SDK_INT>=29){getWindow().setNavigationBarContrastEnforced(false);getWindow().setStatusBarContrastEnforced(false);}
 getWindow().setStatusBarColor(Color.TRANSPARENT);getWindow().setNavigationBarColor(Color.TRANSPARENT);
 getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
 root.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));
 root.setOnApplyWindowInsetsListener((v,insets)->{
   if(android.os.Build.VERSION.SDK_INT>=30){
     android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());
     v.setPadding(safe.left,safe.top,safe.right,safe.bottom);
     return WindowInsets.CONSUMED;
   }else{
     v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
     return insets.consumeSystemWindowInsets();
   }
 });
 setContentView(root);
 root.requestApplyInsets();
 WebSettings s=web.getSettings(); s.setCacheMode(WebSettings.LOAD_NO_CACHE);s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);
 WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
 web.setWebViewClient(new WebViewClient(){
 @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&u.getPath()!=null&&u.getPath().startsWith("/assets/")){WebResourceResponse local=webUpdates.asset(u.getPath().substring(8));if(local!=null)return local;}return loader.shouldInterceptRequest(u);}
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(r.isForMainFrame() && "https://appassets.androidplatform.net/update".equals(r.getUrl().toString())){updater.check();return true;}
 if(r.isForMainFrame()&&"https://appassets.androidplatform.net/paddle-scan".equals(r.getUrl().toString())){if(lastScan!=null)scan(lastScan,false,true);return true;}
 if(r.isForMainFrame()&&"https://appassets.androidplatform.net/rescan".equals(r.getUrl().toString())){if(lastScan!=null)scan(lastScan,true);return true;}
 return !"appassets.androidplatform.net".equals(r.getUrl().getHost());}
 });
 web.setWebChromeClient(new WebChromeClient(){
 @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){
 if(pending!=null)pending.onReceiveValue(null);pending=cb;
 try {startActivityForResult(p.createIntent(),41);return true;}catch(Exception e){pending=null;cb.onReceiveValue(null);return true;}
 }
 });
 web.clearCache(false);
 web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
 super.onActivityResult(request,result,data);
 if(reports!=null&&reports.onResult(request,result,data))return;
 if(request==41&&pending!=null){Uri[] chosen=WebChromeClient.FileChooserParams.parseResult(result,data);pending.onReceiveValue(chosen);pending=null;if(chosen!=null&&chosen.length==1){photoSequence++;lastScan=chosen[0];scan(lastScan,false);}}
 }
 private void scan(Uri uri,boolean focused){scan(uri,focused,false);}
 private void scan(Uri uri,boolean focused,boolean paddle){
 final long id=++scanSequence,token=photoSequence;
 web.evaluateJavascript("window.supplyOcrStart && window.supplyOcrStart("+id+")",null);
 ocrExecutor.execute(()->{if(id!=scanSequence)return;long started=android.os.SystemClock.elapsedRealtime();String result="",error="";try{result=paddle?InvoiceOcr.readPaddle(this,uri,photoSession,token):InvoiceOcr.read(this,uri,focused,photoSession,token);if(result.trim().isEmpty())error="Текст не найден. Выберите более чёткий снимок.";}catch(Exception|LinkageError e){error=paddle?"Новый OCR не смог обработать фото. Используйте обычное распознавание или выберите фото заново.":"Не удалось распознать документ. Проверьте формат и качество снимка.";} android.util.Log.i("SupplyOCR",(paddle?"paddle":focused?"focused":"full")+" ms="+(android.os.SystemClock.elapsedRealtime()-started));final String txt=result,msg=error;runOnUiThread(()->{if(!isDestroyed()&&id==scanSequence)web.evaluateJavascript("window.supplyOcrFinish && window.supplyOcrFinish("+id+","+org.json.JSONObject.quote(txt)+","+org.json.JSONObject.quote(msg)+")",null);});});
 }
 @Override protected void onDestroy(){scanSequence++;ocrExecutor.execute(photoSession::close);ocrExecutor.shutdown();if(updater!=null)updater.close();if(reports!=null)reports.close();if(pending!=null){pending.onReceiveValue(null);pending=null;}if(web!=null)web.destroy();super.onDestroy();}
}
