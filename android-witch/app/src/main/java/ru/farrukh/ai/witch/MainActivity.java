package ru.farrukh.ai.witch;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends Activity implements RecognitionListener, TextToSpeech.OnInitListener {
    private static final int REQ_MIC = 7;
    private static final String APP_URL = "https://farruhk-ai-mobile.onrender.com/";
    private static final String CHAT_URL = "https://farruhk-ai-mobile.onrender.com/api/chat";
    private static final String MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip";
    private static final String MODEL_DIR = "vosk-model-small-ru-0.22";

    private enum Mode { PREPARING, WAKE, COMMAND, BUSY }
    private Mode mode = Mode.PREPARING;

    private final Handler main = new Handler(Looper.getMainLooper());
    private TextView status;
    private WebView web;
    private TextToSpeech tts;
    private Model model;
    private SpeechService speechService;
    private boolean commandHandled = false;
    private boolean ttsReady = false;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        buildUi();

        tts = new TextToSpeech(this, this);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onError(String id) { main.post(() -> afterSpeech(id)); }
            @Override public void onDone(String id) { main.post(() -> afterSpeech(id)); }
        });

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
        } else {
            prepareModel();
        }
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(238, 248, 255));

        status = new TextView(this);
        status.setText("Подготовка голосового режима…");
        status.setTextSize(16f);
        status.setTextColor(Color.rgb(25, 56, 78));
        status.setGravity(Gravity.CENTER_VERTICAL);
        status.setPadding(dp(18), dp(14), dp(18), dp(14));
        root.addView(status, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.loadUrl(APP_URL);
        root.addView(web, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onInit(int result) {
        if (result == TextToSpeech.SUCCESS) {
            ttsReady = true;
            tts.setLanguage(new Locale("ru", "RU"));
            tts.setSpeechRate(0.96f);
            tts.setPitch(0.98f);
        }
    }

    private void setStatus(String s) {
        main.post(() -> status.setText(s));
    }

    private void prepareModel() {
        File dir = new File(getFilesDir(), MODEL_DIR);
        if (isModelReady(dir)) {
            loadModel(dir);
            return;
        }

        setStatus("Первый запуск: загружаю офлайн-голосовую модель… 0%");
        new Thread(() -> {
            File zip = new File(getCacheDir(), "vosk-ru.zip");
            try {
                downloadModel(zip);
                unzipModel(zip, getFilesDir());
                //noinspection ResultOfMethodCallIgnored
                zip.delete();
                File modelDir = new File(getFilesDir(), MODEL_DIR);
                if (!isModelReady(modelDir)) throw new IOException("Модель распакована не полностью");
                loadModel(modelDir);
            } catch (Exception e) {
                setStatus("Не удалось подготовить голос: " + e.getMessage());
            }
        }, "vosk-model-loader").start();
    }

    private boolean isModelReady(File dir) {
        return dir.isDirectory()
                && new File(dir, "conf").isDirectory()
                && new File(dir, "am").isDirectory()
                && new File(dir, "graph").isDirectory();
    }

    private void downloadModel(File target) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(MODEL_URL).openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        c.setRequestProperty("User-Agent", "FarrukhAI-Witch/2.0");
        int total = c.getContentLength();
        if (c.getResponseCode() / 100 != 2) throw new IOException("HTTP " + c.getResponseCode());

        try (BufferedInputStream in = new BufferedInputStream(c.getInputStream());
             BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(target))) {
            byte[] buf = new byte[64 * 1024];
            long done = 0;
            int last = -1;
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                done += n;
                if (total > 0) {
                    int p = (int) (done * 100L / total);
                    if (p != last && p % 2 == 0) {
                        last = p;
                        setStatus("Первый запуск: загружаю офлайн-голосовую модель… " + p + "%");
                    }
                }
            }
        } finally {
            c.disconnect();
        }
    }

    private void unzipModel(File zipFile, File destRoot) throws Exception {
        String rootPath = destRoot.getCanonicalPath() + File.separator;
        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            byte[] buf = new byte[64 * 1024];
            while ((entry = zis.getNextEntry()) != null) {
                File out = new File(destRoot, entry.getName());
                String outPath = out.getCanonicalPath();
                if (!outPath.startsWith(rootPath)) throw new IOException("Некорректный архив модели");
                if (entry.isDirectory()) {
                    //noinspection ResultOfMethodCallIgnored
                    out.mkdirs();
                } else {
                    File parent = out.getParentFile();
                    if (parent != null) {
                        //noinspection ResultOfMethodCallIgnored
                        parent.mkdirs();
                    }
                    try (BufferedOutputStream bos = new BufferedOutputStream(new FileOutputStream(out))) {
                        int n;
                        while ((n = zis.read(buf)) > 0) bos.write(buf, 0, n);
                    }
                }
                zis.closeEntry();
            }
        }
    }

    private void loadModel(File dir) {
        try {
            model = new Model(dir.getAbsolutePath());
            main.post(this::startWake);
        } catch (Exception e) {
            setStatus("Ошибка запуска голосовой модели: " + e.getMessage());
        }
    }

    private void stopSpeech() {
        if (speechService != null) {
            try { speechService.stop(); } catch (Exception ignored) {}
            try { speechService.shutdown(); } catch (Exception ignored) {}
            speechService = null;
        }
    }

    private void startWake() {
        if (model == null || isFinishing()) return;
        stopSpeech();
        commandHandled = false;
        mode = Mode.WAKE;
        setStatus("Тихий режим активен · скажи «Ведьма»");
        try {
            Recognizer rec = new Recognizer(model, 16000.0f, "[\"ведьма\", \"[unk]\"]");
            speechService = new SpeechService(rec, 16000.0f);
            speechService.startListening(this);
        } catch (IOException e) {
            setStatus("Не удалось включить микрофон: " + e.getMessage());
        }
    }

    private void wakeDetected() {
        if (mode != Mode.WAKE) return;
        stopSpeech();
        mode = Mode.BUSY;
        setStatus("Ведьма услышала · отвечаю");
        speak("Я слушаю.", "wake_ack");
    }

    private void startCommand() {
        if (model == null || isFinishing()) return;
        stopSpeech();
        commandHandled = false;
        mode = Mode.COMMAND;
        setStatus("Говорите команду…");
        try {
            Recognizer rec = new Recognizer(model, 16000.0f);
            speechService = new SpeechService(rec, 16000.0f);
            speechService.startListening(this, 12000);
        } catch (IOException e) {
            setStatus("Не удалось услышать команду: " + e.getMessage());
            main.postDelayed(this::startWake, 700);
        }
    }

    private String field(String json, String key) {
        try { return new JSONObject(json).optString(key, "").trim(); }
        catch (Exception e) { return ""; }
    }

    @Override
    public void onPartialResult(String hypothesis) {
        if (mode == Mode.WAKE) {
            String p = field(hypothesis, "partial").toLowerCase(Locale.ROOT).replace('ё', 'е');
            if (p.contains("ведьма")) wakeDetected();
        }
    }

    @Override
    public void onResult(String hypothesis) {
        String text = field(hypothesis, "text");
        if (mode == Mode.WAKE) {
            if (text.toLowerCase(Locale.ROOT).replace('ё', 'е').contains("ведьма")) wakeDetected();
        } else if (mode == Mode.COMMAND && !text.isEmpty() && !commandHandled) {
            handleCommand(text);
        }
    }

    @Override
    public void onFinalResult(String hypothesis) {
        if (mode == Mode.COMMAND && !commandHandled) {
            String text = field(hypothesis, "text");
            if (!text.isEmpty()) handleCommand(text);
            else {
                setStatus("Не расслышала. Скажите «Ведьма» и попробуйте ещё раз.");
                main.postDelayed(this::startWake, 900);
            }
        }
    }

    @Override public void onError(Exception e) {
        setStatus("Ошибка микрофона. Возвращаюсь в режим ожидания.");
        main.postDelayed(this::startWake, 900);
    }

    @Override public void onTimeout() {
        if (mode == Mode.COMMAND && !commandHandled) {
            setStatus("Команда не прозвучала. Снова жду слово «Ведьма».");
            main.postDelayed(this::startWake, 700);
        }
    }

    private void handleCommand(String text) {
        if (commandHandled) return;
        commandHandled = true;
        stopSpeech();
        mode = Mode.BUSY;
        setStatus("Услышала: «" + text + "» · думаю…");
        new Thread(() -> {
            String reply;
            try {
                JSONObject body = new JSONObject();
                body.put("message", text);
                HttpURLConnection c = (HttpURLConnection) new URL(CHAT_URL).openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(20000);
                c.setReadTimeout(65000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                c.getOutputStream().write(bytes);

                int code = c.getResponseCode();
                java.io.InputStream input = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
                String raw = new String(input.readAllBytes(), StandardCharsets.UTF_8);
                c.disconnect();

                JSONObject json = new JSONObject(raw);
                reply = json.optString("reply", "");
                if (reply.isEmpty()) reply = json.optString("error", "Ответ не получен.");
            } catch (Exception e) {
                reply = "Не удалось связаться с Фаррух AI. Проверь интернет и попробуй ещё раз.";
            }
            final String finalReply = reply;
            main.post(() -> {
                setStatus("Farrukh AI отвечает");
                speak(finalReply, "reply");
                try { web.evaluateJavascript("window.location.hash='#chat';", null); } catch (Exception ignored) {}
            });
        }, "farrukh-ai-request").start();
    }

    private void speak(String text, String id) {
        stopSpeech();
        if (!ttsReady) {
            main.postDelayed(() -> {
                if (ttsReady) speak(text, id);
                else afterSpeech(id);
            }, 500);
            return;
        }
        Bundle b = new Bundle();
        b.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, b, id);
    }

    private void afterSpeech(String id) {
        if ("wake_ack".equals(id)) {
            main.postDelayed(this::startCommand, 200);
        } else {
            main.postDelayed(this::startWake, 450);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(requestCode, permissions, grants);
        if (requestCode == REQ_MIC) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) prepareModel();
            else setStatus("Нужен доступ к микрофону, чтобы слышать слово «Ведьма».");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (model != null && mode == Mode.PREPARING) startWake();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopSpeech();
        if (!isFinishing()) {
            mode = Mode.PREPARING;
            setStatus("Голос приостановлен · вернись в приложение");
        }
    }

    @Override
    protected void onDestroy() {
        stopSpeech();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (model != null) {
            try { model.close(); } catch (Exception ignored) {}
        }
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
