package ai.farukh.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native Android companion to the existing FARUKH AI website.
 * Only the first-party HTTPS main frame may request printing.
 * The label's 58×40 bitmap is produced by FARUKH AI and sent using
 * Bluetooth Classic SPP directly to the paired Xprinter/V3 device.
 */
public final class MainActivity extends Activity {
    private static final String HOST = "farruhk-ai-mobile.onrender.com";
    private static final String HOME = "https://" + HOST + "/";
    private static final String ORIGIN = "https://" + HOST;
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int REQUEST_BT = 601, REQUEST_WEB = 602, REQUEST_FILE = 603;
    private static final int MAX_PAYLOAD = 64_000;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooser;
    private PermissionRequest pendingWebPermission;
    private JavaScriptReplyProxy pendingPrinterReply;
    private byte[] pendingLabel;
    private boolean pendingSelectOnly;
    private final AtomicBoolean printing = new AtomicBoolean(false);
    private final ExecutorService printerWorker = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptCookie(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri url = req.getUrl();
                if (isOurUrl(url)) return false;
                if (req.isForMainFrame() && req.hasGesture()) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (ActivityNotFoundException e) { toast("Нет приложения для открытия ссылки."); }
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooser != null) fileChooser.onReceiveValue(null);
                fileChooser = callback;
                try {
                    Intent select = params.createIntent();
                    startActivityForResult(select, REQUEST_FILE);
                    return true;
                } catch (Exception error) {
                    fileChooser = null;
                    return false;
                }
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "FarukhPrinter", Set.of(ORIGIN),
                (view, message, origin, isMainFrame, replyProxy) -> {
                    if (!isMainFrame || !ORIGIN.equals(origin.toString())) {
                        respond(replyProxy, false, "Запрос отклонён: неверный источник.");
                        return;
                    }
                    processPrintMessage(message, replyProxy);
                });
        } else {
            toast("Для прямой печати обнови Android System WebView.");
        }
        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(HOME);
    }

    private boolean isOurUrl(Uri url) {
        return url != null && "https".equalsIgnoreCase(url.getScheme())
            && HOST.equalsIgnoreCase(url.getHost())
            && (url.getPort() == -1 || url.getPort() == 443);
    }

    private void processPrintMessage(WebMessageCompat message, JavaScriptReplyProxy reply) {
        final JSONObject request;
        try { request = new JSONObject(message.getData()); }
        catch (Exception error) { respond(reply, false, "Некорректная команда."); return; }
        String type = request.optString("type", "");
        if ("select".equals(type)) {
            pendingLabel = null;
            pendingSelectOnly = true;
        } else if ("print".equals(type)) {
            if (printing.get()) { respond(reply, false, "Принтер занят. Дождись окончания предыдущей печати."); return; }
            try { pendingLabel = checkLabel(request.getString("tspl")); }
            catch (Exception error) { respond(reply, false, "Неверный формат данных этикетки: " + error.getMessage()); return; }
            pendingSelectOnly = false;
        } else { respond(reply, false, "Неизвестная команда печати."); return; }

        pendingPrinterReply = reply;
        if (Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, REQUEST_BT);
        } else chooseOrPrint();
    }

    /**
     * Accept only the canonical TSPL bitmap packet generated by the site's
     * printing module. Arbitrary binary printer commands are rejected.
     */
    private byte[] checkLabel(String encoded) {
        if (encoded.length() > MAX_PAYLOAD) throw new IllegalArgumentException("слишком большой файл");
        byte[] packet;
        try { packet = Base64.decode(encoded, Base64.DEFAULT); }
        catch (Exception error) { throw new IllegalArgumentException("повреждена передача"); }

        int raster;
        String header;
        if (startsWith(packet, "\r\nSIZE 58 mm,40 mm\r\n")) {
            raster = 58 * 320;
            header = "\r\nSIZE 58 mm,40 mm\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,58,320,0,";
        } else if (startsWith(packet, "\r\nSIZE 31 mm,20 mm\r\n")) {
            raster = 31 * 160;
            header = "\r\nSIZE 31 mm,20 mm\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,31,160,0,";
        } else throw new IllegalArgumentException("размер должен быть 58×40 или 31×20");
        byte[] prefix = header.getBytes(StandardCharsets.US_ASCII);
        if (packet.length < prefix.length + raster + 13 || !startsWith(packet, header))
            throw new IllegalArgumentException("нет блока печати");
        String suffix = new String(packet, prefix.length + raster,
            packet.length - prefix.length - raster, StandardCharsets.US_ASCII);
        if (!suffix.matches("\\r\\nPRINT 1,(?:[1-9]|1[0-9]|20)\\r\\n"))
            throw new IllegalArgumentException("неверное число этикеток");
        return packet;
    }

    private boolean startsWith(byte[] bytes, String ascii) {
        byte[] prefix = ascii.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) if (bytes[i] != prefix[i]) return false;
        return true;
    }

    private void chooseOrPrint() {
        BluetoothManager manager = (BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
        if (adapter == null) { finishPending(false, "На устройстве нет Bluetooth."); return; }
        if (!adapter.isEnabled()) { finishPending(false, "Включи Bluetooth в настройках Android."); return; }

        Set<BluetoothDevice> paired;
        try { paired = adapter.getBondedDevices(); }
        catch (SecurityException e) { finishPending(false, "Разреши FARUKH AI доступ к Bluetooth."); return; }
        if (paired.isEmpty()) {
            finishPending(false, "Сначала сопряги Printer001 с Android в настройках Bluetooth.");
            return;
        }
        List<BluetoothDevice> devices = new ArrayList<>(paired);
        String saved = getPreferences(MODE_PRIVATE).getString("printerAddress", "");
        for (BluetoothDevice item : devices) if (saved.equals(item.getAddress())) {
            if (pendingSelectOnly) finishPending(true, "Выбран принтер " + safeName(item));
            else sendLabel(item);
            return;
        }
        String[] names = new String[devices.size()];
        for (int i = 0; i < devices.size(); i++) names[i] = safeName(devices.get(i));
        new AlertDialog.Builder(this)
            .setTitle("Выбери Bluetooth-принтер")
            .setItems(names, (dialog, i) -> {
                BluetoothDevice chosen = devices.get(i);
                getPreferences(MODE_PRIVATE).edit().putString("printerAddress", chosen.getAddress()).apply();
                if (pendingSelectOnly) finishPending(true, "Выбран принтер " + safeName(chosen));
                else sendLabel(chosen);
            })
            .setNegativeButton("Отмена", (dialog, i) -> finishPending(false, "Принтер не выбран."))
            .setOnCancelListener(dialog -> finishPending(false, "Подключение отменено."))
            .show();
    }

    private String safeName(BluetoothDevice device) {
        try { return (device.getName() == null ? "Bluetooth-принтер" : device.getName()) + " · " + device.getAddress(); }
        catch (SecurityException e) { return "Bluetooth-принтер"; }
    }

    private void sendLabel(BluetoothDevice device) {
        final byte[] label = pendingLabel;
        final JavaScriptReplyProxy callback = pendingPrinterReply;
        pendingLabel = null;
        pendingPrinterReply = null;
        if (label == null || !printing.compareAndSet(false, true)) {
            respond(callback, false, "Печать занята. Попробуй ещё раз.");
            return;
        }
        printerWorker.execute(() -> {
            BluetoothSocket socket = null;
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP);
                socket.connect();
                OutputStream stream = socket.getOutputStream();
                // Many compact V3 printers have a small Bluetooth receive buffer.
                for (int offset = 0; offset < label.length; offset += 256) {
                    int size = Math.min(256, label.length - offset);
                    stream.write(label, offset, size);
                    stream.flush();
                    Thread.sleep(20);
                }
                mainHandler.post(() -> respond(callback, true,
                    "Задание отправлено. Проверь выход этикетки из принтера."));
            } catch (Exception error) {
                final String hint = error.getMessage() == null ? "ошибка Bluetooth" : error.getMessage();
                mainHandler.post(() -> respond(callback, false,
                    "Принтер не принял задание: " + hint +
                    ". Закрой 4Barcode, проверь подключение Printer001 и повтори."));
            } finally {
                if (socket != null) try { socket.close(); } catch (Exception ignored) {}
                printing.set(false);
            }
        });
    }

    private void finishPending(boolean ok, String message) {
        JavaScriptReplyProxy callback = pendingPrinterReply;
        pendingPrinterReply = null;
        pendingLabel = null;
        respond(callback, ok, message);
    }

    private void respond(JavaScriptReplyProxy reply, boolean ok, String message) {
        if (reply == null) return;
        try {
            JSONObject obj = new JSONObject();
            obj.put("ok", ok);
            obj.put("message", message);
            reply.postMessage(obj.toString());
        } catch (JSONException ignored) {}
    }

    private void handleWebPermission(PermissionRequest request) {
        if (request.getOrigin() == null || !isOurUrl(request.getOrigin())) {
            request.deny(); return;
        }
        List<String> resources = Arrays.asList(request.getResources());
        boolean microphone = resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
        boolean camera = resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
        List<String> needed = new ArrayList<>();
        if (microphone && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.RECORD_AUDIO);
        if (camera && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.CAMERA);
        if (needed.isEmpty()) {
            grantRequested(request);
        } else {
            pendingWebPermission = request;
            requestPermissions(needed.toArray(new String[0]), REQUEST_WEB);
        }
    }

    private void grantRequested(PermissionRequest request) {
        List<String> permitted = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
                permitted.add(resource);
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
                permitted.add(resource);
        }
        if (permitted.isEmpty()) request.deny();
        else request.grant(permitted.toArray(new String[0]));
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == REQUEST_BT) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) chooseOrPrint();
            else finishPending(false, "Разрешение Bluetooth отклонено.");
        } else if (code == REQUEST_WEB && pendingWebPermission != null) {
            PermissionRequest pending = pendingWebPermission;
            pendingWebPermission = null;
            grantRequested(pending);
        }
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQUEST_FILE && fileChooser != null) {
            fileChooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileChooser = null;
        }
    }
    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        webView.saveState(out);
        super.onSaveInstanceState(out);
    }
    @Override protected void onDestroy() {
        printerWorker.shutdownNow();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
    private void toast(String str) { Toast.makeText(this, str, Toast.LENGTH_LONG).show(); }
}
