package ru.farrukh.ai;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQ_MIC = 101;
    private static final String APP_URL = "https://farruhk-ai-mobile.onrender.com/";
    private static final String CHAT_URL = APP_URL + "api/chat";
    private static final String WAKE_WORD = "ведьма";

    private enum Mode { WAIT_WAKE, WAIT_COMMAND }

    private WebView webView;
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Mode mode = Mode.WAIT_WAKE;
    private boolean listening = false;
    private boolean speaking = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl(APP_URL);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(new Locale("ru", "RU"));
                tts.setSpeechRate(0.95f);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) { speaking = true; }
                    @Override public void onError(String utteranceId) { onSpeechFinished(utteranceId); }
                    @Override public void onDone(String utteranceId) { onSpeechFinished(utteranceId); }
                });
            }
        });

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
        } else {
            setupRecognizer();
        }
    }

    private void setupRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Toast.makeText(this, "Распознавание речи недоступно на этом телефоне", Toast.LENGTH_LONG).show();
            return;
        }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) { listening = true; }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() { listening = false; }
            @Override public void onError(int error) {
                listening = false;
                if (!speaking) scheduleListen(500);
            }
            @Override public void onResults(Bundle results) {
                listening = false;
                handleRecognition(results, false);
            }
            @Override public void onPartialResults(Bundle partialResults) {
                handleRecognition(partialResults, true);
            }
            @Override public void onEvent(int eventType, Bundle params) {}
        });
        scheduleListen(250);
    }

    private Intent recognizerIntent() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ru-RU");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        return intent;
    }

    private void startListening() {
        if (recognizer == null || speaking || listening || isFinishing()) return;
        try {
            recognizer.startListening(recognizerIntent());
        } catch (Exception e) {
            scheduleListen(700);
        }
    }

    private void scheduleListen(long delayMs) {
        handler.postDelayed(this::startListening, delayMs);
    }

    private void handleRecognition(Bundle bundle, boolean partial) {
        if (bundle == null) return;
        ArrayList<String> variants = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (variants == null || variants.isEmpty()) return;

        if (mode == Mode.WAIT_WAKE) {
            for (String text : variants) {
                if (text != null && text.toLowerCase(Locale.ROOT).contains(WAKE_WORD)) {
                    triggerWake();
                    return;
                }
            }
            if (!partial) scheduleListen(250);
            return;
        }

        if (mode == Mode.WAIT_COMMAND && !partial) {
            String command = variants.get(0) == null ? "" : variants.get(0).trim();
            if (command.isEmpty()) {
                mode = Mode.WAIT_WAKE;
                scheduleListen(250);
            } else {
                sendCommand(command);
            }
        }
    }

    private void triggerWake() {
        mode = Mode.WAIT_COMMAND;
        stopRecognition();
        speak("Я слушаю", "ack");
    }

    private void stopRecognition() {
        if (recognizer != null) {
            try { recognizer.cancel(); } catch (Exception ignored) {}
        }
        listening = false;
    }

    private void speak(String text, String utteranceId) {
        stopRecognition();
        speaking = true;
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
    }

    private void onSpeechFinished(String utteranceId) {
        runOnUiThread(() -> {
            speaking = false;
            if ("ack".equals(utteranceId)) {
                scheduleListen(200);
            } else {
                mode = Mode.WAIT_WAKE;
                scheduleListen(350);
            }
        });
    }

    private void sendCommand(String command) {
        stopRecognition();
        new Thread(() -> {
            String reply;
            try {
                URL url = new URL(CHAT_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(12000);
                conn.setReadTimeout(35000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

                JSONObject context = new JSONObject();
                context.put("source", "android_apk");
                context.put("wakeWord", "Ведьма");
                JSONObject body = new JSONObject();
                body.put("message", command);
                body.put("context", context);

                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) { os.write(bytes); }

                int code = conn.getResponseCode();
                BufferedReader reader = new BufferedReader(new InputStreamReader(
                    code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream(),
                    StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();

                JSONObject json = new JSONObject(sb.toString());
                reply = json.optString("reply", "");
                if (reply.isEmpty()) reply = json.optString("error", "Не удалось получить ответ.");
            } catch (Exception e) {
                reply = "Связь с сервером не удалась. Попробуйте ещё раз.";
            }
            String finalReply = reply;
            runOnUiThread(() -> speak(finalReply, "reply"));
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_MIC && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            setupRecognizer();
        } else if (requestCode == REQ_MIC) {
            Toast.makeText(this, "Без доступа к микрофону слово «Ведьма» работать не будет", Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (recognizer != null && !speaking) scheduleListen(250);
    }

    @Override protected void onPause() {
        super.onPause();
        stopRecognition();
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) recognizer.destroy();
        if (tts != null) tts.shutdown();
        if (webView != null) webView.destroy();
    }
}
