package ai.farukh.print;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground Android update assistant. It checks, downloads and verifies an APK
 * automatically; Android's own Package Installer ALWAYS requires the user's
 * approval. Never attempts root/silent installation or deletion of app data.
 *
 * Release metadata: versionCode, SHA-256 and one known APK asset from GitHub.
 * Every candidate APK must be signed by the SAME key as this installed app.
 * This prevents the common "incompatible" error caused by regenerated debug
 * signing keys, and avoids encouraging a data-losing uninstall.
 */
final class NativeUpdater {
    private static final String API =
        "https://api.github.com/repos/farruhbobojonov23-creator/Farruhk-ai-mobile/releases/tags/farukh-print-current";
    private static final String REPO_DOWNLOAD =
        "https://github.com/farruhbobojonov23-creator/Farruhk-ai-mobile/releases/download/";
    private static final String FILE_NAME = "FARUKH-PRINT-test.apk";
    private static final long EVERY_MS = 6L * 60 * 60 * 1000;
    private static final int MAX_BYTES = 30 * 1024 * 1024;
    private static final int INSTALL_PERMISSION_REQUEST = 722;
    private final MainActivity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile boolean closed;
    private boolean running, awaitingUnknownSources;
    private long lastCheckElapsed;
    private int shownVersion = -1;
    private File readyApk;
    private String readyVersion;

    NativeUpdater(MainActivity activity) { this.activity = activity; }

    void onResume() {
        if (closed) return;
        if (awaitingUnknownSources) {
            awaitingUnknownSources = false;
            if (canInstallPackages() && readyApk != null) {
                promptInstall(); // Still requires an explicit user tap.
            } else if (!canInstallPackages()) {
                Toast.makeText(activity, "Без разрешения Android установка невозможна.", Toast.LENGTH_LONG).show();
            }
        }
        checkIfDue();
    }

    void checkIfDue() {
        long now = SystemClock.elapsedRealtime();
        if (closed || running || (lastCheckElapsed != 0 && now-lastCheckElapsed < EVERY_MS)) return;
        running = true;
        lastCheckElapsed = now;
        worker.execute(() -> {
            try {
                JSONObject release = readRelease();
                int version = readVersion(release);
                if (version <= installedVersion()) return;
                JSONObject asset = findAsset(release);
                String sha256 = releaseValue(release.optString("body"), "FARUKH_PRINT_SHA256");
                if (asset == null || !sha256.matches("[a-fA-F0-9]{64}")) return;
                String href = asset.optString("browser_download_url");
                int size = asset.optInt("size", -1);
                if (!href.startsWith(REPO_DOWNLOAD) || !href.endsWith("/" + FILE_NAME)
                        || size < 1024 || size > MAX_BYTES) return;

                File output = new File(new File(activity.getCacheDir(), "updates"), FILE_NAME);
                if (!output.getParentFile().exists() && !output.getParentFile().mkdirs()) return;
                if (!output.isFile() || !sha256.equalsIgnoreCase(hashFile(output))) {
                    if (output.exists() && !output.delete()) return;
                    download(href, output, sha256, size);
                }
                if (closed) return;
                // Both version and signing identity are checked against *installed*
                // app before Android Package Installer is ever opened.
                inspectCandidate(output, version);
                String label = releaseValue(release.optString("body"), "FARUKH_PRINT_VERSION_NAME");
                ui.post(() -> {
                    if (closed || version == shownVersion) return;
                    readyApk = output;
                    readyVersion = label.isEmpty() ? String.valueOf(version) : label;
                    waitUntilNotPrinting(version, 0);
                });
            } catch (IncompatibleSigningException differentSignature) {
                // Do not offer an impossible in-place upgrade. Never delete old data.
                ui.post(() -> {
                    if (!closed && shownVersion != -2) {
                        shownVersion = -2;
                        new AlertDialog.Builder(activity)
                            .setTitle("Обновление требует проверки подписи")
                            .setMessage("Новое APK подписано другим ключом. Android не разрешит обновить его поверх установленного. Не удаляй FARUKH PRINT: сначала сохрани JSON-базу. Для безопасных обновлений нужен постоянный ключ подписи.")
                            .setPositiveButton("Понятно", null).show();
                    }
                });
            } catch (Exception ignored) {
                // No intrusive error popups on a kitchen workstation if offline.
                // A later foreground check will retry.
            } finally {
                ui.post(() -> running = false);
            }
        });
    }

    private JSONObject readRelease() throws Exception {
        HttpURLConnection conn = (HttpURLConnection)new URL(API).openConnection();
        conn.setConnectTimeout(10000); conn.setReadTimeout(15000);
        conn.setRequestProperty("User-Agent", "FARUKH-PRINT-Android-Updater");
        conn.setRequestProperty("Accept", "application/vnd.github+json");
        try {
            if (conn.getResponseCode() != 200) throw new Exception("Update API unavailable");
            try (InputStream stream = conn.getInputStream()) {
                byte[] bytes = new byte[256 * 1024];
                int off = 0, n;
                while ((n = stream.read(bytes, off, bytes.length-off)) > 0) {
                    off += n;
                    if (off == bytes.length) throw new Exception("Oversized release manifest");
                }
                return new JSONObject(new String(bytes, 0, off, StandardCharsets.UTF_8));
            }
        } finally { conn.disconnect(); }
    }

    private int readVersion(JSONObject release) throws Exception {
        String s = releaseValue(release.optString("body"), "FARUKH_PRINT_VERSION_CODE");
        if (!s.matches("[0-9]{1,8}")) throw new Exception("Release without version code");
        return Integer.parseInt(s);
    }
    private static String releaseValue(String body, String key) {
        for (String line : body.split("\\r?\\n")) {
            if (line.startsWith(key + "=")) return line.substring(key.length()+1).trim();
        }
        return "";
    }
    private JSONObject findAsset(JSONObject release) {
        JSONArray assets = release.optJSONArray("assets");
        if (assets == null) return null;
        for (int i=0; i<assets.length(); i++) {
            JSONObject a=assets.optJSONObject(i);
            if (a!=null && FILE_NAME.equals(a.optString("name"))) return a;
        }
        return null;
    }
    private long installedVersion() throws Exception {
        PackageInfo p=activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    }

    private static boolean trustedRedirect(URL url) {
        if (!"https".equalsIgnoreCase(url.getProtocol())) return false;
        String host=url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
            || host.equals("objects.githubusercontent.com");
    }
    private void download(String from, File output, String expectedHash, int expectedSize) throws Exception {
        URL next = new URL(from);
        HttpURLConnection conn = null;
        File part = new File(output.getParentFile(), FILE_NAME + ".partial");
        if (part.exists()) part.delete();
        try {
            for (int redirects=0; redirects<7; redirects++) {
                if (!trustedRedirect(next)) throw new Exception("Untrusted APK download host");
                conn = (HttpURLConnection)next.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(12000); conn.setReadTimeout(20000);
                conn.setRequestProperty("User-Agent", "FARUKH-PRINT-Android-Updater");
                int response=conn.getResponseCode();
                if (response==301 || response==302 || response==303 || response==307 || response==308) {
                    String location=conn.getHeaderField("Location");
                    if (location==null) throw new Exception("Missing redirect");
                    next=new URL(next,location); conn.disconnect(); conn=null; continue;
                }
                if (response!=200) throw new Exception("APK download unavailable");
                MessageDigest md=MessageDigest.getInstance("SHA-256");
                int count=0;
                try(InputStream in=conn.getInputStream(); FileOutputStream out=new FileOutputStream(part)) {
                    byte[] buffer=new byte[16384]; int n;
                    while ((n=in.read(buffer))!=-1) {
                        count+=n;
                        if (count>MAX_BYTES || count>expectedSize) throw new Exception("Invalid APK size");
                        out.write(buffer,0,n); md.update(buffer,0,n);
                    }
                    out.getFD().sync();
                }
                if (count!=expectedSize || !hex(md.digest()).equalsIgnoreCase(expectedHash))
                    throw new Exception("APK integrity check failed");
                if (!part.renameTo(output)) throw new Exception("Cannot stage APK");
                return;
            }
            throw new Exception("Too many redirects");
        } finally {
            if (conn!=null) conn.disconnect();
            if (part.exists()) part.delete();
        }
    }
    private String hashFile(File file) throws Exception {
        MessageDigest md=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new java.io.FileInputStream(file)) {
            byte[] b=new byte[16384]; int n;
            while((n=in.read(b))!=-1) md.update(b,0,n);
        }
        return hex(md.digest());
    }
    private static String hex(byte[] b) {
        StringBuilder out=new StringBuilder(b.length*2);
        for(byte value:b)out.append(String.format(Locale.ROOT,"%02x",value & 0xff));
        return out.toString();
    }
    private void inspectCandidate(File file, int expectedVersion) throws Exception {
        PackageManager pm=activity.getPackageManager();
        int flag = Build.VERSION.SDK_INT>=28
            ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo installed=pm.getPackageInfo(activity.getPackageName(), flag);
        PackageInfo candidate=pm.getPackageArchiveInfo(file.getAbsolutePath(), flag);
        if (candidate==null || !activity.getPackageName().equals(candidate.packageName))
            throw new Exception("Wrong package");
        long code=Build.VERSION.SDK_INT>=28 ? candidate.getLongVersionCode() : candidate.versionCode;
        if (code!=expectedVersion || code<=installedVersion()) throw new Exception("Wrong APK version");
        Signature[] a=signatures(installed);
        Signature[] b=signatures(candidate);
        if (a==null || b==null || a.length==0 || a.length!=b.length)
            throw new IncompatibleSigningException();
        for(Signature signer:a) {
            boolean found=false;
            for(Signature second:b) if (signer.equals(second)) {found=true;break;}
            if (!found) throw new IncompatibleSigningException();
        }
    }
    private static Signature[] signatures(PackageInfo p) {
        if (Build.VERSION.SDK_INT>=28)
            return p.signingInfo == null ? null : p.signingInfo.getApkContentsSigners();
        return p.signatures;
    }
    private void waitUntilNotPrinting(int version, int attempt) {
        if (closed || version==shownVersion) return;
        if (activity.isPrintBusy()) {
            if(attempt<60) ui.postDelayed(() -> waitUntilNotPrinting(version,attempt+1),3000);
            return;
        }
        shownVersion=version;
        new AlertDialog.Builder(activity)
            .setTitle("FARUKH PRINT · обновление " + readyVersion)
            .setMessage("Новая версия автоматически загружена и проверена. Все этикетки останутся на месте. Для установки потребуется подтверждение Android. Обновить сейчас?")
            .setPositiveButton("Обновить", (dialog, choice) -> installReady())
            .setNegativeButton("Позже", null)
            .show();
    }
    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < 26 ||
            activity.getPackageManager().canRequestPackageInstalls();
    }
    private void installReady() {
        if(readyApk==null || !readyApk.isFile()) return;
        if(!canInstallPackages()) {
            awaitingUnknownSources = true;
            Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:"+activity.getPackageName()));
            activity.startActivityForResult(permission, INSTALL_PERMISSION_REQUEST);
            return;
        }
        try {
            Uri apk=FileProvider.getUriForFile(activity,
                activity.getPackageName()+".updates", readyApk);
            Intent install=new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(apk,"application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(install);
        } catch(Exception error) {
            Toast.makeText(activity,"Не удалось открыть установщик Android.",Toast.LENGTH_LONG).show();
        }
    }
    private void promptInstall() {
        new AlertDialog.Builder(activity)
            .setTitle("Разрешение получено")
            .setMessage("Перейти в установщик FARUKH PRINT? Данные останутся на месте.")
            .setPositiveButton("Установить", (d,w)->installReady())
            .setNegativeButton("Позже",null).show();
    }
    void close() {
        closed=true; worker.shutdownNow();
    }
    private static final class IncompatibleSigningException extends Exception {}
}
