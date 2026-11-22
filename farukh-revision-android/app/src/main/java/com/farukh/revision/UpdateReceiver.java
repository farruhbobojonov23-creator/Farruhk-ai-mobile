package com.farukh.revision;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
public final class UpdateReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent) {
  if (intent==null) return;
  int code=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  String status;
  if (code==PackageInstaller.STATUS_PENDING_USER_ACTION) {
   Intent confirm;
   if(Build.VERSION.SDK_INT>=33) confirm=intent.getParcelableExtra(Intent.EXTRA_INTENT,Intent.class);
   else { @SuppressWarnings("deprecation") Intent tmp=intent.getParcelableExtra(Intent.EXTRA_INTENT); confirm=tmp; }
   if(confirm!=null) {
    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try{context.startActivity(confirm);status="Подтверди установку Android.";}
    catch(Exception e){status="Не удалось открыть подтверждение установки.";}
   } else status="Android не предоставил окно подтверждения.";
  } else if (code==PackageInstaller.STATUS_SUCCESS) status="Обновление установлено.";
  else status="Установка не выполнена (код "+code+").";
  context.getSharedPreferences("farukh-update-status",Activity.MODE_PRIVATE).edit().putString("last-status",status).apply();
 }
}
