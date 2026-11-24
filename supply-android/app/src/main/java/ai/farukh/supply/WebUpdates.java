package ai.farukh.supply;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.AtomicFile;
import android.util.Base64;
import android.webkit.WebResourceResponse;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateFactory;
import java.security.MessageDigest;
import java.util.*;

final class WebUpdates {
 private static final int LIMIT=1024*1024;
 private static final Set<String> NAMES=new HashSet<>(Arrays.asList("index.html","app.js","analytics.js","invoice-parser.js"));
 private final Context context;
 private final AtomicFile storage;
 private final long nativeVersion,embedded;
 private volatile Bundle active;
 private static final class Bundle{
  final long revision;final Map<String,byte[]> files;
  Bundle(long r,Map<String,byte[]> f){revision=r;files=Collections.unmodifiableMap(f);}
 }
 WebUpdates(Context c){
  context=c;storage=new AtomicFile(new File(c.getFilesDir(),"supply-web-signed.json"));
  long n=-1,e=1;
  try{PackageInfo p=c.getPackageManager().getPackageInfo(c.getPackageName(),0);n=Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}catch(Exception ignored){}
  try(InputStream in=c.getAssets().open("web-version.txt")){e=Long.parseLong(new String(read(in,64),StandardCharsets.UTF_8).trim());}catch(Exception ignored){}
  nativeVersion=n;embedded=e;
  try(FileInputStream in=storage.openRead()){Bundle b=verify(read(in,LIMIT));if(b.revision>embedded)active=b;}catch(Exception ignored){}
 }
 long revision(){Bundle b=active;return b==null?embedded:b.revision;}
 static byte[] read(InputStream in,int max)throws IOException{
  ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;
  while((n=in.read(buf))!=-1){if(out.size()+n>max)throw new IOException("Too large");out.write(buf,0,n);}return out.toByteArray();
 }
 private Bundle verify(byte[] envelope)throws Exception{
  JSONObject outer=new JSONObject(new String(envelope,StandardCharsets.UTF_8));
  byte[] payload=Base64.decode(outer.getString("payload"),Base64.NO_WRAP),sig=Base64.decode(outer.getString("signature"),Base64.NO_WRAP);
  PackageInfo p=context.getPackageManager().getPackageInfo(context.getPackageName(),Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES);
  android.content.pm.Signature[] certs=Build.VERSION.SDK_INT>=28?p.signingInfo.getApkContentsSigners():p.signatures;
  if(certs==null||certs.length!=1)throw new SecurityException("Signing certificate");
  java.security.cert.Certificate cert=CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(certs[0].toByteArray()));
  java.security.Signature verifier=java.security.Signature.getInstance("SHA256withRSA");verifier.initVerify(cert);verifier.update(payload);
  if(!verifier.verify(sig))throw new SecurityException("Web update signature");
  JSONObject doc=new JSONObject(new String(payload,StandardCharsets.UTF_8));
  if(!"ai.farukh.supply".equals(doc.getString("package"))||doc.getLong("nativeVersion")!=nativeVersion)throw new SecurityException("Web compatibility");
  long rev=doc.getLong("revision");if(rev<1)throw new SecurityException("Revision");
  JSONObject content=doc.getJSONObject("files");if(content.length()!=NAMES.size())throw new SecurityException("Files");
  Map<String,byte[]> map=new HashMap<>();
  for(String name:NAMES){byte[] data=Base64.decode(content.getString(name),Base64.NO_WRAP);if(data.length<1||data.length>512*1024)throw new SecurityException("File size");map.put(name,data);}
  return new Bundle(rev,map);
 }
 synchronized boolean install(byte[] envelope)throws Exception{
  if(envelope.length>LIMIT)throw new SecurityException("Web size");
  Bundle b=verify(envelope);if(b.revision<=revision())return false;
  FileOutputStream out=storage.startWrite();
  try{out.write(envelope);storage.finishWrite(out);}catch(Exception e){storage.failWrite(out);throw e;}
  active=b;return true;
 }
 WebResourceResponse asset(String name){
  Bundle b=active;if(b==null||!NAMES.contains(name))return null;
  byte[] data=b.files.get(name);
  return new WebResourceResponse(name.endsWith(".html")?"text/html":"application/javascript","UTF-8",new ByteArrayInputStream(data));
 }
}
