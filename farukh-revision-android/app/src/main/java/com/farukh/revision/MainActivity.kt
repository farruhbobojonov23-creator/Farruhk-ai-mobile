package com.farukh.revision

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject

/** FARUKH REVISION PRO.
 * Loads the ONE current, HTTPS web app instead of the obsolete bundled HTML.
 * Web changes apply without reinstalling APK. Never clears WebView storage.
 *
 * IMPORTANT: Replacing an INSTALLED APK still requires a new APK signed with
 * the SAME signing certificate. This Activity only reloads web content.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var legacyProbe: WebView? = null
    private var started = false
    private var appliedLegacy = false
    private var pendingCsv: ByteArray? = null
    private val csvRequestCode = 1208
    private val home = "https://more-sushi-studio.onrender.com/revision.html?v=0.6.8"
    private val trustedHost = "more-sushi-studio.onrender.com"
    private val prefs by lazy { getSharedPreferences("farukh_revision_upgrade", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        if (android.os.Build.VERSION.SDK_INT >= 26) webView.settings.safeBrowsingEnabled = true
        WebView.setWebContentsDebuggingEnabled(false)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (!request.isForMainFrame) return false
                if (uri.scheme.equals("https", true)
                    && uri.host.equals(trustedHost, true)
                    && (uri.path == "/revision.html" || uri.path == "/revision.html/")) return false
                Toast.makeText(this@MainActivity, "Доступна только защищённая панель ревизии", Toast.LENGTH_SHORT).show()
                return true
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                if (!appliedLegacy && url?.startsWith("https://$trustedHost/revision.html") == true) {
                    importLegacyToRemote()
                }
            }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    Toast.makeText(this@MainActivity, "Нет интернета — открой панель при наличии сети; затем доступен офлайн-кэш", Toast.LENGTH_LONG).show()
                }
            }
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                handler?.cancel()
                Toast.makeText(this@MainActivity, "Небезопасный сертификат — соединение заблокировано", Toast.LENGTH_SHORT).show()
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message ?: "Подтвердить действие?")
                    .setPositiveButton("Да") { _, _ -> result?.confirm() }
                    .setNegativeButton("Нет") { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message ?: "")
                    .setPositiveButton("ОК") { _, _ -> result?.confirm() }
                    .show()
                return true
            }
        }
        // The top-level WebView is restricted to one trusted HTTPS document.
        webView.addJavascriptInterface(Bridge(), "FarukhAndroid")
        if (savedInstanceState != null) {
            started = true
            webView.restoreState(savedInstanceState)
        } else if (prefs.getBoolean("legacy_checked", false)) {
            openRemote()
        } else {
            // Before leaving the old appassets origin, preserve unpublished local
            // inventories from the previous bundled 0.2.0 application.
            inspectLegacyStorage()
        }
    }

    private fun openRemote() {
        if (started) return
        started = true
        webView.loadUrl(home)
    }

    private fun inspectLegacyStorage() {
        val probe = WebView(this)
        legacyProbe = probe
        probe.settings.javaScriptEnabled = true
        probe.settings.domStorageEnabled = true
        probe.settings.allowFileAccess = false
        val timeout = Handler(Looper.getMainLooper())
        val rescue = Runnable {
            if (!started) {
                legacyProbe?.destroy()
                legacyProbe = null
                openRemote()
            }
        }
        timeout.postDelayed(rescue, 1500)
        probe.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                view?.evaluateJavascript("(function(){try{return localStorage.getItem('farukh-revision-demo-v1')||''}catch(e){return ''}})()") { encoded ->
                    timeout.removeCallbacks(rescue)
                    try {
                        val data = JSONArray("[$encoded]").getString(0)
                        val parsed = JSONObject(data)
                        val rows = parsed.optJSONArray("history")
                        if (rows != null && rows.length() > 0) {
                            prefs.edit().putString("legacy_pending", data).apply()
                        }
                        prefs.edit().putBoolean("legacy_checked", true).apply()
                    } catch (_: Exception) {
                        // An empty legacy storage is common; never reset anything.
                        prefs.edit().putBoolean("legacy_checked", true).apply()
                    }
                    legacyProbe?.destroy()
                    legacyProbe = null
                    openRemote()
                }
            }
        }
        probe.loadDataWithBaseURL(
            "https://appassets.androidplatform.net/",
            "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>",
            "text/html", "UTF-8", null
        )
    }

    private fun importLegacyToRemote() {
        val backup = prefs.getString("legacy_pending", null)
        if (backup.isNullOrEmpty()) {
            appliedLegacy = true
            return
        }
        // Do not replace newer local records. Import remains separate until
        // user explicitly chooses 'Перенести локальные ревизии' in web settings.
        val escaped = JSONObject.quote(backup)
        webView.evaluateJavascript(
            "(function(){try{var key='farukh-revision-demo-v1';" +
                "if(!localStorage.getItem(key))localStorage.setItem(key,$escaped);" +
                "return localStorage.getItem(key)!==null}catch(e){return false}})()"
        ) { result ->
            if (result == "true") {
                prefs.edit().remove("legacy_pending").apply()
                appliedLegacy = true
                // Reload once to refresh local catalog/history without clearing
                // the signed-in cloud session or unsent drafts.
                webView.reload()
            }
        }
    }

    inner class Bridge {
        @JavascriptInterface
        fun refreshWebUi() {
            Handler(Looper.getMainLooper()).post { if (::webView.isInitialized) webView.reload() }
        }

        @JavascriptInterface
        fun saveCsv(name: String, base64: String) {
            try {
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                Handler(Looper.getMainLooper()).post {
                    pendingCsv = bytes
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "text/csv"
                        putExtra(Intent.EXTRA_TITLE, name.take(100))
                    }
                    startActivityForResult(intent, csvRequestCode)
                }
            } catch (_: Exception) {
                Handler(Looper.getMainLooper()).post {
                    Toast.makeText(this@MainActivity, "Ошибка экспорта CSV", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun print() {
            Handler(Looper.getMainLooper()).post {
                val manager = getSystemService(PRINT_SERVICE) as PrintManager
                manager.print(
                    "FARUKH REVISION",
                    webView.createPrintDocumentAdapter("FARUKH REVISION"),
                    PrintAttributes.Builder().build()
                )
            }
        }
    }

    @Deprecated("Legacy document picker callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == csvRequestCode) {
            val bytes = pendingCsv
            val uri = data?.data
            if (resultCode == RESULT_OK && bytes != null && uri != null) {
                try {
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    Toast.makeText(this, "CSV сохранён", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {
                    Toast.makeText(this, "Не удалось записать CSV", Toast.LENGTH_LONG).show()
                }
            }
            pendingCsv = null
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Legacy WebView back navigation")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        legacyProbe?.destroy()
        legacyProbe = null
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
