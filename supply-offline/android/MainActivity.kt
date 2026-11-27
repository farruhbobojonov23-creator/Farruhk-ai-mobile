package com.paddle.ocr.demo

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.os.Bundle
import android.widget.*
import android.view.ViewGroup
import com.paddle.ocr.PaddleOCR
import com.paddle.ocr.PaddleOCRConfig
import com.paddle.ocr.EngineConfig
import com.paddle.ocr.util.OpenCVUtils
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject

/** Separate offline diagnostic app: no INTERNET permission, no automatic database writes. */
class MainActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var engine: PaddleOCR? = null
    private var scan: JSONObject? = null
    private lateinit var status: TextView
    private lateinit var results: TextView
    private lateinit var pick: Button
    private lateinit var export: Button
    private var running = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 48, 24, 24)
        }
        status = TextView(this).apply { textSize = 18f; text = "FARUKH SUPPLY · Offline\nЗагрузка моделей..." }
        pick = Button(this).apply { text = "Выбрать фото накладной"; isEnabled = false }
        export = Button(this).apply { text = if (intent.getBooleanExtra("registry_mode", false)) "Перенести в накладную" else "Сохранить черновик OCR (JSON)"; isEnabled = false }
        results = TextView(this).apply { textSize = 15f; setTextIsSelectable(true) }
        root.addView(status); root.addView(pick); root.addView(export)
        root.addView(ScrollView(this).apply { addView(results) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
        pick.setOnClickListener {
            val base = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            var launched = false
            for (pkg in listOf("com.google.android.documentsui", "com.android.documentsui")) {
                try {
                    startActivityForResult(Intent(base).setPackage(pkg), 101)
                    launched = true
                    break
                } catch (_: android.content.ActivityNotFoundException) {}
                catch (_: SecurityException) {}
            }
            if (!launched) {
                try {
                    startActivityForResult(base, 101)
                    launched = true
                } catch (_: android.content.ActivityNotFoundException) {}
                catch (_: SecurityException) {}
            }
            status.text = if (launched) "Выбор файла накладной…" else "Не удалось открыть системный выбор файлов."
        }
        val qaPage2 = java.io.File(filesDir, "qa-invoice-page2.png")
        val qaFile = java.io.File(filesDir, "qa-invoice.png")
        if ((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0 && qaFile.isFile) {
            val qa = Button(this).apply { text = "Диагностика OCR" }
            root.addView(qa, 3)
            qa.setOnClickListener {
                if (engine == null) status.text = "Сканер ещё загружается."
                else if (!running) recognizeMany(listOf(ImageDecoder.createSource(qaFile)))
            }
            if (qaPage2.isFile) {
                val twoPages = Button(this).apply { text = "Диагностика OCR · 2 страницы" }
                root.addView(twoPages, 4)
                twoPages.setOnClickListener {
                    if (engine == null) status.text = "Сканер ещё загружается."
                    else if (!running) recognizeMany(listOf(ImageDecoder.createSource(qaFile), ImageDecoder.createSource(qaPage2)))
                }
            }
        }
        export.setOnClickListener {
            if (intent.getBooleanExtra("registry_mode", false)) {
                val payload = scan?.toString() ?: return@setOnClickListener
                try {
                    java.io.File(filesDir, "registry-scan.json").writeText(payload, Charsets.UTF_8)
                    setResult(RESULT_OK)
                    finish()
                } catch (e: Exception) { status.text = "Ошибка передачи: " + e.message }
                return@setOnClickListener
            }
            startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE); type = "application/json"
                putExtra(Intent.EXTRA_TITLE, "farukh-ocr-draft.json")
            }, 102)
        }
        scope.launch {
            try {
                engine = withContext(Dispatchers.IO) {
                    check(OpenCVUtils.init(this@MainActivity)) { "OpenCV не загрузился" }
                    PaddleOCR.create(this@MainActivity,
                        PaddleOCRConfig(detLimitSideLen = 960, detLimitType = "max", detMaxSideLimit = 3200, recScoreThresh = 0.0f, recBatchSize = 1),
                        EngineConfig(numThreads = 4),
                        "models/det/inference.onnx", "models/rec/inference.onnx", "models/rec/inference.yml")
                }
                status.text = "Сканер загружен. Выбери фото. Интернет не нужен."
                pick.isEnabled = true
            } catch (e: CancellationException) { throw e }
              catch (e: Exception) { status.text = "Ошибка загрузки: " + e.message }
              catch (e: LinkageError) { status.text = "Ошибка нативной библиотеки: " + e.message }
        }
    }

    @Deprecated("Activity result API for isolated test app")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) {
            if (requestCode == 101 && !running && engine != null) status.text = "Выбор фотографии отменён. Выбери фото."
            return
        }
        val uri = data?.data ?: data?.clipData?.getItemAt(0)?.uri ?: run {
            if (requestCode == 101) status.text = "Фотография не получена. Выбери файл повторно."
            return
        }
        if (requestCode == 102) {
            val payload = scan?.toString(2) ?: return
            scope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        val out = contentResolver.openOutputStream(uri) ?: error("Файл недоступен")
                        out.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                    }
                    status.text = "Черновик сохранён. В реестр не внесён."
                } catch (e: CancellationException) { throw e }
                  catch (e: Exception) { status.text = "Ошибка сохранения: " + e.message }
            }
            return
        }
        if (requestCode != 101 || running) return
        try {
            val uris = mutableListOf<android.net.Uri>()
            data?.clipData?.let { clip ->
                for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri)
            }
            if (uris.isEmpty()) uris.add(uri)
            if (uris.size > 20) { status.text = "Максимум 20 страниц за раз"; return }
            recognizeMany(uris.map { ImageDecoder.createSource(contentResolver, it) })
        } catch (e: Exception) {
            status.text = "Не удалось открыть фото: " + e.message
        }
    }

    private fun recognizeMany(sources: List<ImageDecoder.Source>) {
        if (running || sources.isEmpty()) return
        val ocr = engine ?: return
        android.util.Log.i("FarukhOffline", "OCR_INPUT_RECEIVED pages=${sources.size}")
        running = true; pick.isEnabled = false; export.isEnabled = false; scan = null
        status.text = "Распознавание на устройстве…"; results.text = ""
        scope.launch {
            try {
                val pages = JSONArray()
                val display = StringBuilder()
                for ((index, source) in sources.withIndex()) {
                    status.text = "Распознавание страницы ${index + 1} из ${sources.size}…"
                    val bmp = withContext(Dispatchers.IO) {
                        ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                            val w = info.size.width; val h = info.size.height
                            val ratio = minOf(1.0, 3200.0 / maxOf(w, h))
                            decoder.setTargetSize(maxOf(1, (w * ratio).toInt()), maxOf(1, (h * ratio).toInt()))
                        }
                    }
                    val width = bmp.width; val height = bmp.height
                    android.util.Log.i("FarukhOffline", "OCR_IMAGE_DECODED page=${index + 1} ${width}x${height}")
                    val res = withContext(Dispatchers.Default) { try { ocr.recognize(bmp) } finally { bmp.recycle() } }
                    android.util.Log.i("FarukhOffline", "OCR_INFERENCE_COMPLETE page=${index + 1} blocks=${res.results.size} ms=${res.totalTimeMs}")
                    val regions = JSONArray()
                    res.results.forEach { item ->
                        val box = JSONArray()
                        item.box.points.forEach { pt ->
                            box.put(JSONArray().put(pt.x.toDouble()).put(pt.y.toDouble()))
                        }
                        regions.put(JSONObject().put("text", item.text).put("score", item.confidence.toDouble()).put("box", box))
                    }
                    pages.put(JSONObject().put("schema", "farukh-ocr-regions-v1")
                        .put("width", width).put("height", height).put("regions", regions)
                        .put("requires_review", true).put("elapsed_ms", res.totalTimeMs))
                    display.append("--- Страница ${index + 1} ---\n")
                    display.append(res.results.joinToString("\\n") { it.text + if (it.confidence < 0.85f) " ⚠" else "" })
                    display.append("\\n")
                }
                scan = if (pages.length() == 1) pages.getJSONObject(0)
                    else JSONObject().put("schema", "farukh-ocr-batch-v1").put("pages", pages).put("requires_review", true)
                results.text = display.toString()
                status.text = if (pages.length() == 1)
                    "Найдено блоков: " + pages.getJSONObject(0).getJSONArray("regions").length() + " · Черновик требует проверки"
                    else "Распознано страниц: ${pages.length()} · Черновик требует проверки"
                export.isEnabled = pages.length() > 0
            } catch (e: CancellationException) { throw e }
              catch (e: Exception) { status.text = "Ошибка распознавания: " + e.message }
            finally { running = false; pick.isEnabled = true }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        // The OS reclaims native resources on process exit; avoid releasing while inference is active.
        if (!running) engine?.let { instance -> CoroutineScope(Dispatchers.IO).launch { instance.release() } }
        super.onDestroy()
    }
}
