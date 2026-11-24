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
 @Override public void onCreate(Bundle saved) {
 super.onCreate(saved);
 web=new WebView(this); web.setBackgroundColor(Color.rgb(7,24,44));
 setContentView(web);
 web.setOnApplyWindowInsetsListener((v,insets)->{
 if(android.os.Build.VERSION.SDK_INT>=30){
 android.graphics.Insets i=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
 v.setPadding(i.left,i.top,i.right,i.bottom);
 }else{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());}
 return insets;
 });
 web.requestApplyInsets();
 WebSettings s=web.getSettings(); s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);
 WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
 web.setWebViewClient(new WebViewClient(){
 @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return loader.shouldInterceptRequest(r.getUrl());}
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !"appassets.androidplatform.net".equals(r.getUrl().getHost());}
 });
 web.setWebChromeClient(new WebChromeClient(){
 @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){
 if(pending!=null)pending.onReceiveValue(null);pending=cb;
 try {startActivityForResult(p.createIntent(),41);return true;}catch(Exception e){pending=null;cb.onReceiveValue(null);return true;}
 }
 });
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
 @Override protected void onDestroy(){ocrExecutor.shutdownNow();if(pending!=null){pending.onReceiveValue(null);pending=null;}if(web!=null)web.destroy();super.onDestroy();}
}
