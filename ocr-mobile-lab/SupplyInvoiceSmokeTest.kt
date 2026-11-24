package com.paddle.ocr.benchmark

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.paddle.ocr.PaddleOCR
import com.paddle.ocr.PaddleOCRConfig
import com.paddle.ocr.EngineConfig
import com.paddle.ocr.util.OpenCVUtils
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SupplyInvoiceSmokeTest {
    @Test fun recognizesRussianInvoiceOffline() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        OpenCVUtils.init(context)
        val ocr = PaddleOCR.create(context, PaddleOCRConfig(detLimitSideLen=960,detLimitType="max"), EngineConfig())
        val bitmap = Bitmap.createBitmap(1400, 660, Bitmap.Config.ARGB_8888)
        try {
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color=Color.BLACK; textSize=34f }
            canvas.drawText("Учебная накладная",50f,65f,paint)
            val rows = listOf(listOf("Товар","Ед.","Количество","Цена","Сумма"),
                listOf("Рис для суши","кг","25,000","100,00","2500,00"),
                listOf("Сыр творожный","кг","4,900","600,00","2940,00"),
                listOf("Соус рисовый","шт","2,000","300,00","600,00"))
            val xs = listOf(50f,480f,610f,865f,1100f)
            rows.forEachIndexed { i,row -> row.forEachIndexed { j,value -> canvas.drawText(value,xs[j],150f+i*95f,paint) } }
            val result=ocr.recognize(bitmap)
            val text=result.results.joinToString(" ") { it.text }
            println("SUPPLY_SYNTHETIC_OCR: $text")
            println("SUPPLY_SYNTHETIC_MS: ${result.totalTimeMs}")
            assertTrue("Text boxes missing",result.results.isNotEmpty())
            assertTrue("Russian item not recognized",text.contains("Рис",ignoreCase=true))
            val compact=text.replace(" ","")
            assertTrue("Numeric field not recognized",compact.contains("2500"))
            assertTrue("No positioned boxes",result.results.all { it.box.points.size==4 })
        } finally { bitmap.recycle(); ocr.release() }
    }
}
