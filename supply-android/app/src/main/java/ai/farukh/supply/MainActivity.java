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
 private Uri[] queuedPhotos;
 private final android.os.Handler uiHandler=new android.os.Handler(android.os.Looper.getMainLooper());
 private final java.util.concurrent.ExecutorService ocrExecutor=java.util.concurrent.Executors.newSingleThreadExecutor();
 private volatile long scanSequence=0;
 private long photoSequence=0;
 private final InvoiceOcr.PhotoSession photoSession=new InvoiceOcr.PhotoSession();
 private Uri lastScan;
 private SupplyUpdater updater;
 private WebUpdates webUpdates;
 @Override public void onCreate(Bundle saved) {
 super.onCreate(saved);
 webUpdates=new WebUpdates(this);
 updater=new SupplyUpdater(this,webUpdates,()->{scanSequence++;photoSequence++;lastScan=null;ocrExecutor.execute(photoSession::close);web.clearCache(false);web.loadUrl("https://appassets.androidplatform.net/assets/index.html");});
 web=new WebView(this); web.setBackgroundColor(Color.rgb(7,24,44));
 android.widget.FrameLayout root=new android.widget.FrameLayout(this);
 root.setBackgroundColor(Color.rgb(6,22,36));
 if(android.os.Build.VERSION.SDK_INT>=30){
   getWindow().setDecorFitsSystemWindows(false);

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
 if(android.os.Build.VERSION.SDK_INT>=30){
   root.post(()->{if(!isDestroyed()){android.view.WindowInsetsController controller=getWindow().getInsetsController();if(controller!=null)controller.setSystemBarsAppearance(0,android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);}});
 }
 root.requestApplyInsets();
 WebSettings s=web.getSettings(); s.setCacheMode(WebSettings.LOAD_NO_CACHE);s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);
 WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
 web.setWebViewClient(new WebViewClient(){
 @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&u.getPath()!=null&&u.getPath().startsWith("/assets/")){WebResourceResponse local=webUpdates.asset(u.getPath().substring(8));if(local!=null)return local;}return loader.shouldInterceptRequest(u);}
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(r.isForMainFrame() && "https://appassets.androidplatform.net/update".equals(r.getUrl().toString())){updater.check();return true;}
 if(r.isForMainFrame()&&"https://appassets.androidplatform.net/paddle-scan".equals(r.getUrl().toString())){if(lastScan!=null)scan(lastScan,false,true);return true;}
 if(r.isForMainFrame()&&"https://appassets.androidplatform.net/rescan".equals(r.getUrl().toString())){if(lastScan!=null)scan(lastScan,true);return true;}
 if(r.isForMainFrame()&&"https://appassets.androidplatform.net".equals(r.getUrl().getScheme()+"://"+r.getUrl().getHost())
  &&"/ocr-selected".equals(r.getUrl().getPath())){
   String count=r.getUrl().getQueryParameter("count");
   try { startQueuedScan(Integer.parseInt(count),false); }
   catch(Exception e){android.util.Log.w("SupplyOCR","Picker change signal error",e);}
   return true;
 }
 return !"appassets.androidplatform.net".equals(r.getUrl().getHost());}
 });
 web.setWebChromeClient(new WebChromeClient(){
 @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){
 if(pending!=null)pending.onReceiveValue(null);
 pending=cb;queuedPhotos=null;
 try {
  Intent open=p.createIntent();
  open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
  if(p.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE)open.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
  startActivityForResult(open,41);
 }catch(Exception primary){
  try {
   Intent fallback=new Intent(Intent.ACTION_OPEN_DOCUMENT);
   fallback.addCategory(Intent.CATEGORY_OPENABLE);
   fallback.setType("image/*");
   fallback.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
   fallback.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   startActivityForResult(fallback,41);
  }catch(Exception secondary){
   pending=null;cb.onReceiveValue(null);
   android.widget.Toast.makeText(MainActivity.this,"Не удалось открыть галерею. Попробуйте через Файлы.",android.widget.Toast.LENGTH_LONG).show();
  }
 }
 return true;
 }
 });
 web.clearCache(false);
 web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
 super.onActivityResult(request,result,data);
 if(request!=41||pending==null)return;
 Uri[] chosen=WebChromeClient.FileChooserParams.parseResult(result,data);
 // Different Android/Xiaomi gallery apps can return both data and ClipData.
 // Preserve *all* selected photos instead of silently using only the first.
 if(result==RESULT_OK&&data!=null){
  android.content.ClipData clip=data.getClipData();
  if(clip!=null&&clip.getItemCount()>1&&clip.getItemCount()<=20){
   chosen=new Uri[clip.getItemCount()];
   for(int i=0;i<clip.getItemCount();i++)chosen[i]=clip.getItemAt(i).getUri();
  }else if((chosen==null||chosen.length==0)&&data.getData()!=null)chosen=new Uri[]{data.getData()};
 }
 if(chosen!=null&&chosen.length>20){
  pending.onReceiveValue(null);pending=null;
  android.widget.Toast.makeText(this,"Выберите не более 20 страниц одной накладной",android.widget.Toast.LENGTH_LONG).show();return;
 }
 if(chosen!=null&&chosen.length>0){
  // Queue before callback: the WebView file-change event may fire synchronously.
  queuedPhotos=chosen.clone();
  photoSequence++;
  lastScan=null;
 }
 pending.onReceiveValue(chosen);
 pending=null;
 if(chosen!=null&&chosen.length>0){
  final Uri[] selected=queuedPhotos;
  uiHandler.postDelayed(()->{
   if(!isDestroyed()&&queuedPhotos==selected){
    android.util.Log.w("SupplyOCR","File change delayed; using picker fallback");
    startQueuedScan(selected.length,true);
   }
  },1800);
 }
 }
 private void startQueuedScan(int selectedCount,boolean fallback){
  if(queuedPhotos==null||selectedCount!=queuedPhotos.length)return;
  Uri[] chosen=queuedPhotos;
  queuedPhotos=null;
  if(fallback)web.evaluateJavascript(
   "(function(){var f=document.getElementById('file'),s=document.getElementById('ocrState');"
   +"if(s&&(!f||!f.files||!f.files.length))s.textContent='Android не передал фото в форму. Откройте галерею повторно.';})()",null);
  if(chosen.length==1){lastScan=chosen[0];scan(lastScan,false);}
  else{lastScan=null;scanBatch(chosen);}
 }
 // Several supplier photos are passed to the existing multi-page invoice review,
 // never auto-saved or sent off-device. Each photo has a separate OCR cache token.
 private void scanBatch(Uri[] uris){
  final long id=++scanSequence,token=photoSequence;
  web.evaluateJavascript("window.supplyOcrStart && window.supplyOcrStart("+id+")",null);
  ocrExecutor.execute(()->{
   org.json.JSONArray pages=new org.json.JSONArray();
   int failed=0;
   for(int i=0;i<uris.length;i++){
    if(id!=scanSequence||Thread.currentThread().isInterrupted())return;
    final int pageNumber=i+1;
    runOnUiThread(()->{
     if(!isDestroyed()&&id==scanSequence)web.evaluateJavascript(
      "(function(){var e=document.getElementById('ocrState');if(e)e.textContent="
       +org.json.JSONObject.quote("Читаем страницу "+pageNumber+" из "+uris.length+"…")+"})()",null);
    });
    try{
     String text=InvoiceOcr.read(this,uris[i],false,photoSession,token+i);
     if(text.trim().isEmpty()||text.length()>1000000){failed++;pages.put("");}
     else pages.put(text);
    }catch(Exception|LinkageError e){
     failed++;pages.put("");
     android.util.Log.w("SupplyOCR","Batch page "+pageNumber+" requires manual review",e);
    }
   }
   if(id!=scanSequence)return;
   final int failures=failed;
   final String joined="FARUKH_PDF_PAGES_V1\n"+pages.toString();
   runOnUiThread(()->{
    if(isDestroyed()||id!=scanSequence)return;
    String error=failures>0
     ?"Не удалось распознать страниц: "+failures+". Проверьте оригиналы и добавьте страницы вручную.":"";
    web.evaluateJavascript(
     "window.supplyOcrFinish && window.supplyOcrFinish("+id+","
      +org.json.JSONObject.quote(joined)+","+org.json.JSONObject.quote(error)+",\"[]\")",null);
   });
  });
 }
 private void scan(Uri uri,boolean focused){scan(uri,focused,false);}
 private void scan(Uri uri,boolean focused,boolean paddle){
 final long id=++scanSequence,token=photoSequence;
 web.evaluateJavascript("window.supplyOcrStart && window.supplyOcrStart("+id+")",null);
 ocrExecutor.execute(()->{if(id!=scanSequence)return;long started=android.os.SystemClock.elapsedRealtime();String result="",error="";try{result=paddle?InvoiceOcr.readPaddle(this,uri,photoSession,token):InvoiceOcr.read(this,uri,focused,photoSession,token);if(result.trim().isEmpty())error="Текст не найден. Выберите более чёткий снимок.";}catch(Exception|LinkageError e){error=paddle?"Новый OCR не смог обработать фото. Используйте обычное распознавание или выберите фото заново.":"Не удалось распознать документ. Проверьте формат и качество снимка.";} android.util.Log.i("SupplyOCR",(paddle?"paddle":focused?"focused":"full")+" ms="+(android.os.SystemClock.elapsedRealtime()-started));final String txt=result,msg=error,boxes=error.isEmpty()?photoSession.wordBoxes:"[]";runOnUiThread(()->{if(!isDestroyed()&&id==scanSequence)web.evaluateJavascript("window.supplyOcrFinish && window.supplyOcrFinish("+id+","+org.json.JSONObject.quote(txt)+","+org.json.JSONObject.quote(msg)+","+org.json.JSONObject.quote(boxes)+")",null);});});
 }
 @Override protected void onDestroy(){queuedPhotos=null;scanSequence++;ocrExecutor.execute(photoSession::close);ocrExecutor.shutdown();if(updater!=null)updater.close();if(pending!=null){pending.onReceiveValue(null);pending=null;}if(web!=null)web.destroy();super.onDestroy();}
}
