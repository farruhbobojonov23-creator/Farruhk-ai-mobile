package com.paddle.ocr

import android.content.Context
import android.graphics.Bitmap
import com.paddle.ocr.util.OpenCVUtils
import kotlinx.coroutines.runBlocking
import kotlin.math.abs

/**
 * Blocking adapter for Supply's dedicated OCR worker, never the UI thread.
 * All data stays on device. Rows are suggestions, not confirmed accounting data.
 */
object SupplyPaddleBridge {
    data class Cell(val text: String, val left: Float, val right: Float,
                    val top: Float, val bottom: Float, val confidence: Float) {
        val center: Float get() = (top + bottom) / 2f
        val height: Float get() = bottom - top
    }
    data class Scan(val rows: List<List<Cell>>, val elapsedMs: Long) {
        fun plainText(): String = rows.joinToString("\n") { row ->
            row.joinToString(" ") { it.text }
        }
    }
    @JvmStatic fun read(context: Context, bitmap: Bitmap): Scan = runBlocking {
        check(OpenCVUtils.init(context.applicationContext)) { "OpenCV native library failed to initialize" }
        val engine = PaddleOCR.create(context.applicationContext,
            PaddleOCRConfig(detLimitSideLen=1280, detLimitType="max"), EngineConfig())
        try {
            val result = engine.recognize(bitmap)
            val cells = result.results.mapNotNull { item ->
                val points = item.box.points
                val cell = Cell(item.text, points.minOf { it.x }, points.maxOf { it.x },
                    points.minOf { it.y }, points.maxOf { it.y }, item.confidence)
                if (cell.height > 0f && cell.right > cell.left && cell.text.isNotBlank()) cell else null
            }.sortedWith(compareBy<Cell> { it.center }.thenBy { it.left })
            val groups = mutableListOf<MutableList<Cell>>()
            for (cell in cells) {
                val candidate = groups.filter { group ->
                    val center=group.map { it.center }.average().toFloat()
                    val height=group.map { it.height }.sorted()[group.size/2]
                    abs(center-cell.center)<=.45f*minOf(height,cell.height)
                }.minByOrNull { group -> abs(group.map { it.center }.average().toFloat()-cell.center) }
                if (candidate == null) groups.add(mutableListOf(cell)) else candidate.add(cell)
            }
            Scan(groups.map { it.sortedBy { cell -> cell.left } }, result.totalTimeMs)
        } finally { engine.release() }
    }
}
