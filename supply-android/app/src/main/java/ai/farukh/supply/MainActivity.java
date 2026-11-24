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
 if(request==41&&pending!=null){pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));pending=null;}
 }
 @Override protected void onDestroy(){if(pending!=null){pending.onReceiveValue(null);pending=null;}if(web!=null)web.destroy();super.onDestroy();}
}
