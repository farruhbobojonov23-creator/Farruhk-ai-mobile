package com.moresushi.studio;
import android.app.Activity;import android.app.DownloadManager;import android.content.Context;import android.content.Intent;import android.net.Uri;import android.os.Build;import android.os.Bundle;import android.os.Environment;import android.graphics.Color;import android.view.ViewGroup;import android.view.WindowInsets;import android.webkit.*;import android.widget.FrameLayout;import android.widget.Toast;import android.webkit.ValueCallback;
public final class MainActivity extends Activity {
 private static final String HOME="https://more-sushi-studio.onrender.com/mobile.html";
 private static final int PICKER=1107;private WebView web;private ValueCallback<Uri[]> picker;
 @Override public void onCreate(Bundle state){super.onCreate(state);
 getWindow().setStatusBarColor(Color.rgb(4,18,39));getWindow().setNavigationBarColor(Color.rgb(4,18,39));
 if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
 if(Build.VERSION.SDK_INT>=29)getWindow().setNavigationBarContrastEnforced(false);
 getWindow().getDecorView().setSystemUiVisibility(0);
 FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(4,18,39));
 root.setOnApplyWindowInsetsListener((v,insets)->{
 if(Build.VERSION.SDK_INT>=30){
 android.graphics.Insets top=insets.getInsets(WindowInsets.Type.statusBars()|WindowInsets.Type.displayCutout());
 android.graphics.Insets bottom=insets.getInsets(WindowInsets.Type.navigationBars());
 v.setPadding(top.left,top.top,top.right,bottom.bottom);
 }else v.setPadding(0,insets.getSystemWindowInsetTop(),0,insets.getSystemWindowInsetBottom());
 return insets;});
 web=new WebView(this);web.setBackgroundColor(Color.rgb(4,18,39));
 root.addView(web,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
 setContentView(root);root.requestApplyInsets();
 WebSettings cfg=web.getSettings();cfg.setJavaScriptEnabled(true);cfg.setDomStorageEnabled(true);
 cfg.setAllowFileAccess(false);cfg.setAllowContentAccess(true);cfg.setJavaScriptCanOpenWindowsAutomatically(false);
 cfg.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);cfg.setSupportZoom(true);cfg.setBuiltInZoomControls(true);cfg.setDisplayZoomControls(false);
 CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
 web.setWebViewClient(new WebViewClient(){
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
 Uri u=r.getUrl();if("https".equalsIgnoreCase(u.getScheme())&&"more-sushi-studio.onrender.com".equalsIgnoreCase(u.getHost()))return false;
 try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}
 return true;}
 @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){
 if(r.isForMainFrame() && (v.getUrl()==null || !v.getUrl().startsWith("file:///android_asset/offline.html")))v.loadUrl("file:///android_asset/offline.html");
 }});
 web.setWebChromeClient(new WebChromeClient(){
 @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){
 if(picker!=null)picker.onReceiveValue(null);picker=cb;
 try{startActivityForResult(p.createIntent(),PICKER);return true;}
 catch(Exception e){picker=null;cb.onReceiveValue(null);return false;}}});
 web.setDownloadListener((url,agent,disposition,mime,length)->{
 try{if(!url.startsWith("https://"))throw new SecurityException();
 DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url));
 String cookies=CookieManager.getInstance().getCookie(url);if(cookies!=null)r.addRequestHeader("Cookie",cookies);
 r.addRequestHeader("User-Agent",agent);
 String name=URLUtil.guessFileName(url,disposition,mime);
 r.setTitle(name);r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
 r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,name);
 ((DownloadManager)getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
 Toast.makeText(this,"Файл сохраняется в Загрузки",Toast.LENGTH_SHORT).show();
 }catch(Exception e){Toast.makeText(this,"Не удалось загрузить файл",Toast.LENGTH_LONG).show();}});
 web.loadUrl(HOME);}
 @Override protected void onActivityResult(int r,int result,Intent data){super.onActivityResult(r,result,data);
 if(r==PICKER && picker!=null){picker.onReceiveValue(result==RESULT_OK?WebChromeClient.FileChooserParams.parseResult(result,data):null);picker=null;}}
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onPause(){super.onPause();if(web!=null)web.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){if(picker!=null)picker.onReceiveValue(null);if(web!=null)web.destroy();super.onDestroy();}
}