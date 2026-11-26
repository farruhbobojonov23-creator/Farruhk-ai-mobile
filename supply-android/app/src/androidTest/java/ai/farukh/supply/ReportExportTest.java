package ai.farukh.supply;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONArray;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class ReportExportTest {
 @Test public void workbookHasNumericCellsAndSafeInlineText() throws Exception {
  JSONArray rows=new JSONArray("[[\"Дата\",\"Номер\",\"Точка\",\"Поставщик\",\"Товар\",\"Количество\",\"Ед.\",\"Цена\",\"Ед.\",\"Сумма\"],[\"2026-11-26\",\"A1\",\"Баумана\",\"Тест\",\"=SUM(1)&<\",2,\"кг\",125.5,\"кг\",251]]");
  Map<String,String> parts=new HashMap<>();
  try(ZipInputStream in=new ZipInputStream(new ByteArrayInputStream(ReportExport.xlsx(rows)))){
   ZipEntry e;while((e=in.getNextEntry())!=null){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);parts.put(e.getName(),out.toString("UTF-8"));}
  }
  assertTrue(parts.containsKey("xl/workbook.xml"));String sheet=parts.get("xl/worksheets/sheet1.xml");
  assertTrue(sheet.contains("=SUM(1)&amp;&lt;"));assertTrue(sheet.contains("<c r=\"H2\"><v>125.5</v></c>"));assertFalse(sheet.contains("<f>"));
 }
 @Test public void pdfHasValidHeader() throws Exception {
  byte[] pdf=ReportExport.pdf("Отчёт по закупкам\nСумма: 251 ₽");assertTrue(pdf.length>500);assertTrue(new String(pdf,0,5,StandardCharsets.US_ASCII).equals("%PDF-"));
 }
}
