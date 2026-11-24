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
 private long scanSequence=0;
 private SupplyUpdater updater;
 @Override public void onCreate(Bundle saved) {
 super.onCreate(saved);
 updater=new SupplyUpdater(this);
 web=new WebView(this); web.setBackgroundColor(Color.rgb(7,24,44));
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
 @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return loader.shouldInterceptRequest(r.getUrl());}
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(r.isForMainFrame() && "https://appassets.androidplatform.net/update".equals(r.getUrl().toString())){updater.check();return true;}
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
 if(request==41&&pending!=null){Uri[] chosen=WebChromeClient.FileChooserParams.parseResult(result,data);pending.onReceiveValue(chosen);pending=null;if(chosen!=null&&chosen.length==1)scan(chosen[0]);}
 }
 private void scan(Uri uri){
 final long id=++scanSequence;
 web.evaluateJavascript("window.supplyOcrStart && window.supplyOcrStart("+id+")",null);
 ocrExecutor.execute(()->{String result="",error="";try{result=InvoiceOcr.read(this,uri);if(result.trim().isEmpty())error="Текст не найден. Выберите более чёткий снимок.";}catch(Exception|LinkageError e){error="Не удалось распознать документ. Проверьте формат и качество снимка.";} final String txt=result,msg=error;runOnUiThread(()->{if(!isDestroyed()&&id==scanSequence)web.evaluateJavascript("window.supplyOcrFinish && window.supplyOcrFinish("+id+","+org.json.JSONObject.quote(txt)+","+org.json.JSONObject.quote(msg)+")",null);});});
 }
 @Override protected void onDestroy(){ocrExecutor.shutdownNow();if(updater!=null)updater.close();if(pending!=null){pending.onReceiveValue(null);pending=null;}if(web!=null)web.destroy();super.onDestroy();}
}
