package ai.farukh.supply;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class SupplyUpdater {
 private static final String BASE="https://github.com/farruhbobojonov23-creator/Farruhk-ai-mobile/releases/download/farukh-supply-current/";
 private static final long MAX_APK=100L*1024*1024;
 private final Activity activity;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private boolean busy=false;
 SupplyUpdater(Activity a){activity=a;}
 void close(){worker.shutdownNow();}
 private void notice(String s){activity.runOnUiThread(()->{if(!activity.isDestroyed())Toast.makeText(activity,s,Toast.LENGTH_LONG).show();});}
 void check(){
  if(busy)return;
  if(!activity.getPackageManager().canRequestPackageInstalls()){
   new AlertDialog.Builder(activity).setTitle("Обновления").setMessage("Разрешите установку обновлений из FARUKH SUPPLY AI в настройках Android. Затем вернитесь и нажмите «Обновить».").setNegativeButton("Отмена",null).setPositiveButton("Настройки",(d,w)->{
    try{activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));}catch(Exception e){notice("Откройте разрешение установки в настройках Android.");}
   }).show();return;
  }
  busy=true;notice("Проверяем обновление…");
  worker.execute(()->{
   try{downloadAndCheck();}
   catch(FileNotFoundException e){notice("Стабильная версия для обновления пока не опубликована.");}
   catch(SecurityException e){notice("Обновление отклонено: подпись или контрольная сумма не совпадает.");}
   catch(Exception e){notice("Не удалось проверить обновление. Проверьте интернет и попробуйте снова.");}
   finally{activity.runOnUiThread(()->busy=false);}
  });
 }
 private static HttpsURLConnection connect(String name)throws IOException{
  HttpsURLConnection c=(HttpsURLConnection)new URL(BASE+name).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setUseCaches(false);c.setInstanceFollowRedirects(true);
  int code=c.getResponseCode();if(code==404){c.disconnect();throw new FileNotFoundException(name);}if(code!=200){c.disconnect();throw new IOException("HTTP "+code);}return c;
 }
 private static byte[] manifest()throws IOException{
  HttpsURLConnection c=connect("update.json");try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(out.size()+n>16384)throw new IOException("manifest too large");out.write(buf,0,n);}return out.toByteArray();
  }finally{c.disconnect();}
 }
 private static long version(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}
 private static Signature[] signatures(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.signingInfo.getApkContentsSigners():p.signatures;}
 private void downloadAndCheck()throws Exception{
  JSONObject m=new JSONObject(new String(manifest(),java.nio.charset.StandardCharsets.UTF_8));
  long code=m.getLong("versionCode");String hash=m.getString("sha256"),name=m.getString("file");
  if(!"ai.farukh.supply".equals(m.getString("package"))||!name.equals("FARUKH-SUPPLY-"+code+".apk")||!hash.matches("[0-9a-fA-F]{64}"))throw new SecurityException("manifest");
  PackageManager pm=activity.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
  PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),flags);
  if(code<=version(installed)){notice("Установлена актуальная версия.");return;}
  File dir=new File(activity.getCacheDir(),"updates");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("cache");
  File apk=new File(dir,name),tmp=new File(dir,name+".part");MessageDigest digest=MessageDigest.getInstance("SHA-256");
  HttpsURLConnection c=connect(name);
  try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(tmp)){
   byte[] buf=new byte[32768];long size=0;int n;while((n=in.read(buf))!=-1){if(Thread.currentThread().isInterrupted())throw new IOException("cancelled");size+=n;if(size>MAX_APK)throw new IOException("APK too large");digest.update(buf,0,n);out.write(buf,0,n);}
  }catch(Exception e){tmp.delete();throw e;}finally{c.disconnect();}
  StringBuilder hex=new StringBuilder();for(byte b:digest.digest())hex.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
  if(!hash.equalsIgnoreCase(hex.toString())){tmp.delete();throw new SecurityException("hash");}
  PackageInfo candidate=pm.getPackageArchiveInfo(tmp.getAbsolutePath(),flags);
  // APK parsing may depend on the extension on some devices: rename first and verify the final file.
  if(apk.exists()&&!apk.delete()){tmp.delete();throw new IOException("cache");}
  if(!tmp.renameTo(apk))throw new IOException("rename");
  candidate=pm.getPackageArchiveInfo(apk.getAbsolutePath(),flags);
  if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||version(candidate)!=code||!Arrays.equals(signatures(installed),signatures(candidate))){apk.delete();throw new SecurityException("signature");}
  activity.runOnUiThread(()->{if(activity.isDestroyed())return;
   try{Uri uri=FileProvider.getUriForFile(activity,"ai.farukh.supply.updates",apk);
    Intent i=new Intent(Intent.ACTION_VIEW);i.setDataAndType(uri,"application/vnd.android.package-archive");i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivity(i);
   }catch(Exception e){notice("Не удалось открыть системный установщик Android.");}
  });
 }
}
