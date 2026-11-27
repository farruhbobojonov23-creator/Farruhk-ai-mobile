package com.paddle.ocr.demo

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.JsResult
import android.widget.Toast
import android.app.AlertDialog
import org.json.JSONObject
import java.io.File
import kotlinx.coroutines.*

/** Local-only registry. No remote pages, no network permission. */
class RegistryActivity : Activity() {
    private lateinit var view: WebView
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var pendingExport: String? = null
    private var busy = false
    private val maxBytes = 5 * 1024 * 1024
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        view = WebView(this)
        setContentView(view)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            blockNetworkLoads = true
            javaScriptCanOpenWindowsAutomatically = false
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView?, request: WebResourceRequest?): Boolean = true
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onJsConfirm(v: WebView?, url: String?, message: String?, result: JsResult): Boolean {
                AlertDialog.Builder(this@RegistryActivity).setMessage(message)
                    .setPositiveButton("Да") { _, _ -> result.confirm() }
                    .setNegativeButton("Нет") { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }.show()
                return true
            }
        }
        view.addJavascriptInterface(Bridge(), "NativeSupply")
        val html = assets.open("registry.html").bufferedReader(Charsets.UTF_8).use { it.readText() }
        view.loadDataWithBaseURL("https://farukh.local/registry/", html, "text/html", "UTF-8", null)
    }
    private fun message(s: String) {
        Toast.makeText(this, s, Toast.LENGTH_LONG).show()
    }
    private fun send(name: String, payload: String) {
        view.evaluateJavascript("window." + name + "(" + JSONObject.quote(payload) + ")", null)
    }
    private fun launch(intent: Intent, request: Int) {
        if (busy) return
        busy = true
        try { startActivityForResult(intent, request) }
        catch (e: Exception) { busy = false; pendingExport = null; message("Не удалось открыть файл: " + e.message) }
    }
    inner class Bridge {
        @JavascriptInterface fun scan() = runOnUiThread {
            if (!busy) {
                File(filesDir, "registry-scan.json").delete()
                launch(Intent(this@RegistryActivity, MainActivity::class.java).putExtra("registry_mode", true), 201)
            }
        }
        @JavascriptInterface fun importBackup() = runOnUiThread {
            launch(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json"), 202)
        }
        @JavascriptInterface fun exportFile(name: String, data: String, mime: String) = runOnUiThread {
            if (busy) return@runOnUiThread
            if (data.toByteArray(Charsets.UTF_8).size > maxBytes) { message("Файл слишком большой"); return@runOnUiThread }
            pendingExport = data
            launch(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType(if (mime.startsWith("text/csv")) "text/csv" else "application/json")
                .putExtra(Intent.EXTRA_TITLE, if (mime.startsWith("text/csv")) "farukh-supply.csv" else "farukh-supply-backup.json"), 203)
        }
    }
    override fun onActivityResult(request: Int, result: Int, data: Intent?) {
        super.onActivityResult(request, result, data)
        busy = false
        if (result != RESULT_OK) { if (request == 203) pendingExport = null; return }
        scope.launch {
            try {
                when (request) {
                    201 -> {
                        val payload = withContext(Dispatchers.IO) {
                            val f = File(filesDir, "registry-scan.json")
                            require(f.isFile && f.length() <= maxBytes) { "Черновик недоступен" }
                            try { f.readText(Charsets.UTF_8) } finally { f.delete() }
                        }
                        send("receiveScan", payload)
                    }
                    202 -> {
                        val uri = data?.data ?: error("Файл не выбран")
                        val payload = withContext(Dispatchers.IO) {
                            val stream = contentResolver.openInputStream(uri) ?: error("Файл недоступен")
                            stream.use {
                                val output = java.io.ByteArrayOutputStream()
                                val buffer = ByteArray(8192)
                                while (true) {
                                    val n = it.read(buffer); if (n < 0) break
                                    require(output.size() + n <= maxBytes) { "Файл слишком большой" }
                                    output.write(buffer, 0, n)
                                }
                                output.toString("UTF-8")
                            }
                        }
                        send("receiveBackup", payload)
                    }
                    203 -> {
                        val uri = data?.data ?: error("Файл не выбран")
                        val payload = pendingExport ?: error("Данные для экспорта недоступны")
                        withContext(Dispatchers.IO) {
                            val stream = contentResolver.openOutputStream(uri) ?: error("Файл недоступен")
                            stream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                        }
                        message("Файл сохранён")
                    }
                }
            } catch (e: CancellationException) { throw e }
              catch (e: Exception) { message("Ошибка: " + e.message) }
            finally { if (request == 203) pendingExport = null }
        }
    }
    override fun onDestroy() {
        scope.cancel()
        view.removeJavascriptInterface("NativeSupply")
        view.destroy()
        super.onDestroy()
    }
}
