package com.farukh.revision

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.widget.Toast

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var pendingCsv: ByteArray? = null
    private val csvRequestCode = 1208

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return true
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
        webView.addJavascriptInterface(Bridge(), "FarukhAndroid")
        val html = assets.open("revision.html").bufferedReader(Charsets.UTF_8).use { it.readText() }
        webView.loadDataWithBaseURL("https://appassets.androidplatform.net/", html, "text/html", "UTF-8", null)
    }

    inner class Bridge {
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

    @Deprecated("Legacy WebView back navigation")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
