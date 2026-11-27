package ai.farukh.supply;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.webkit.ValueCallback;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Field;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SupplyPhotoPickerTest {
 private static void setPending(MainActivity activity, ValueCallback<Uri[]> callback) throws Exception {
  Field field=MainActivity.class.getDeclaredField("pending");
  field.setAccessible(true);
  field.set(activity,callback);
 }
 private static Uri[] queued(MainActivity activity) throws Exception {
  Field field=MainActivity.class.getDeclaredField("queuedPhotos");
  field.setAccessible(true);
  return (Uri[])field.get(activity);
 }
 @Test public void preservesBothImagesFromGalleryClipData() throws Exception {
  android.app.Instrumentation inst=InstrumentationRegistry.getInstrumentation();
  android.content.Context context=inst.getTargetContext();
  MainActivity activity=(MainActivity)inst.startActivitySync(
    new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  try {
   final AtomicReference<Uri[]> received=new AtomicReference<>();
   inst.runOnMainSync(()->{
    try {
     setPending(activity,received::set);
     Uri first=Uri.parse("content://photo-test.local/page-one.jpg");
     Uri second=Uri.parse("content://photo-test.local/page-two.jpg");
     ClipData selected=new ClipData("Photos",new String[]{"image/jpeg"},new ClipData.Item(first));
     selected.addItem(new ClipData.Item(second));
     Intent result=new Intent();result.setData(first);result.setClipData(selected);
     activity.onActivityResult(41,Activity.RESULT_OK,result);
     assertNotNull("Multi-select callback not invoked",received.get());
     assertEquals("Both selected photos must reach WebView",2,received.get().length);
     assertEquals(first,received.get()[0]);
     assertEquals(second,received.get()[1]);
     assertEquals("Two pages queued until FileList.change",2,queued(activity).length);
    }catch(Exception e){throw new RuntimeException(e);}
   });
  }finally{inst.runOnMainSync(activity::finish);}
 }
 @Test public void handlesSingleImageInXiaomiClipData() throws Exception {
  android.app.Instrumentation inst=InstrumentationRegistry.getInstrumentation();
  android.content.Context context=inst.getTargetContext();
  MainActivity activity=(MainActivity)inst.startActivitySync(
    new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  try {
   final AtomicReference<Uri[]> received=new AtomicReference<>();
   inst.runOnMainSync(()->{
    try {
     setPending(activity,received::set);
     Uri photo=Uri.parse("content://xiaomi-gallery.local/single.jpg");
     Intent result=new Intent();
     result.setClipData(new ClipData("Photo",new String[]{"image/jpeg"},new ClipData.Item(photo)));
     assertNull(result.getData());
     activity.onActivityResult(41,Activity.RESULT_OK,result);
     assertNotNull("Single ClipData image must reach WebView",received.get());
     assertEquals(1,received.get().length);
     assertEquals(photo,received.get()[0]);
     assertEquals(photo,queued(activity)[0]);
    }catch(Exception e){throw new RuntimeException(e);}
   });
  }finally{inst.runOnMainSync(activity::finish);}
 }
 @Test public void handlesOnePhotoWithoutClipData() throws Exception {
  android.app.Instrumentation inst=InstrumentationRegistry.getInstrumentation();
  android.content.Context context=inst.getTargetContext();
  MainActivity activity=(MainActivity)inst.startActivitySync(
    new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  try {
   final AtomicReference<Uri[]> received=new AtomicReference<>();
   inst.runOnMainSync(()->{
    try {
     setPending(activity,received::set);
     Uri photo=Uri.parse("content://photo-test.local/single-photo.jpg");
     activity.onActivityResult(41,Activity.RESULT_OK,new Intent().setData(photo));
     assertNotNull("Single photo callback not invoked",received.get());
     assertEquals(1,received.get().length);
     assertEquals(photo,received.get()[0]);
     assertEquals(1,queued(activity).length);
    }catch(Exception e){throw new RuntimeException(e);}
   });
  }finally{inst.runOnMainSync(activity::finish);}
 }
}
