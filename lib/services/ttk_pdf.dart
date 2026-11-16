import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../models/recipe.dart';

/// Одностраничный A4 PDF. Сырьевые показатели, аллергены, сроки и КБЖУ
/// проходят обязательную проверку ответственным специалистом перед утверждением.
class TtkPdfService {
  static final deepGreen = PdfColor.fromHex('#005845');
  static final green = PdfColor.fromHex('#00705B');
  static final gold = PdfColor.fromHex('#E9C46A');
  static final pale = PdfColor.fromHex('#E3F1EC');
  static final ink = PdfColor.fromHex('#194236');

  static Future<Uint8List> render(TtkRecipe recipe) async {
    final err = recipe.validate();
    if (err != null) throw StateError(err);

    // PdfGoogleFonts загружается через сеть при первом применении.
    // Для production/offline нужно заменить проверенным локальным механизмом шрифтов.
    final regular = await PdfGoogleFonts.notoSansRegular();
    final bold = await PdfGoogleFonts.notoSansBold();
    final doc = pw.Document();
    final theme = pw.ThemeData.withFont(base: regular, bold: bold);

    pw.Widget panel(String title, pw.Widget content, {double? height, PdfColor? headerColor}) => pw.Container(
          height: height,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: PdfColor.fromHex('#B4D7CD'), width: .65),
            borderRadius: pw.BorderRadius.circular(5),
          ),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
            pw.Container(
              color: headerColor ?? green,
              padding: const pw.EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              child: pw.Text(title, style: pw.TextStyle(color: headerColor == null ? PdfColors.white : ink, fontSize: 9, fontWeight: pw.FontWeight.bold)),
            ),
            pw.Expanded(child: pw.Padding(padding: const pw.EdgeInsets.all(7), child: content)),
          ]),
        );

    pw.Widget row2(pw.Widget l, pw.Widget r, {double gap = 9}) => pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [pw.Expanded(child: l), pw.SizedBox(width: gap), pw.Expanded(child: r)],
        );

    pw.Widget compactText(String text, {double size = 7.7}) =>
        pw.Text(text, style: pw.TextStyle(fontSize: size, color: ink), maxLines: 8);

    pw.Widget field(String label, String value) => pw.Expanded(
          child: pw.Container(
            margin: const pw.EdgeInsets.only(right: 5),
            padding: const pw.EdgeInsets.all(6),
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColor.fromHex('#B4D7CD'))),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text(label, style: pw.TextStyle(fontSize: 6, color: ink, fontWeight: pw.FontWeight.bold)),
              pw.Text(value, style: pw.TextStyle(fontSize: 8.4, color: ink, fontWeight: pw.FontWeight.bold), maxLines: 1),
            ]),
          ),
        );

    pw.Widget ingredientTable() => pw.Column(children: [
          pw.Container(color: pale, padding: const pw.EdgeInsets.all(3), child: pw.Row(children: [
            pw.Expanded(flex: 5, child: compactText('Ингредиент', size: 7)),
            pw.Expanded(flex: 2, child: compactText('Брутто, г', size: 6.3)),
            pw.Expanded(flex: 2, child: compactText('Отходы, %', size: 6.3)),
            pw.Expanded(flex: 2, child: compactText('Нетто, г', size: 6.3)),
          ])),
          ...recipe.ingredients.map((e) => pw.Container(
                padding: const pw.EdgeInsets.symmetric(vertical: 3, horizontal: 3),
                decoration: pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: pale, width: .5))),
                child: pw.Row(children: [
                  pw.Expanded(flex: 5, child: compactText(e.name, size: 7.1)),
                  pw.Expanded(flex: 2, child: compactText(e.gross.toStringAsFixed(1), size: 7.1)),
                  pw.Expanded(flex: 2, child: compactText(e.wastePercent.toStringAsFixed(1), size: 7.1)),
                  pw.Expanded(flex: 2, child: compactText(e.net.toStringAsFixed(1), size: 7.1)),
                ]),
              )),
          pw.SizedBox(height: 5),
          pw.Container(
            color: gold,
            padding: const pw.EdgeInsets.all(4),
            child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
              compactText('Выход готового блюда:', size: 8),
              pw.Text('${recipe.totalNet.toStringAsFixed(1)} г', style: pw.TextStyle(fontSize: 8, color: ink, fontWeight: pw.FontWeight.bold)),
            ]),
          ),
        ]);

    final allergenRows = allergenLabels.entries.map((e) => (e.value, recipe.declaredAllergens.contains(e.key))).toList();
    pw.Widget allergenTable() => pw.Column(children: allergenRows.map((a) => pw.Container(
      padding: const pw.EdgeInsets.symmetric(vertical: 3, horizontal: 5),
      decoration: pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: pale, width: .5))),
      child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        compactText(a.$1, size: 7.8),
        compactText(a.$2 ? 'ДА' : recipe.allAllergensChecked ? 'НЕТ' : '?', size: 8),
      ]),
    )).toList());

    pw.Widget technology() => pw.Column(children: [
      for (var i = 0; i < recipe.steps.length; i++)
        pw.Padding(
          padding: const pw.EdgeInsets.symmetric(vertical: 1),
          child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Container(width: 17, child: pw.Text('${i+1}.', style: pw.TextStyle(fontSize: 8.5, color: ink, fontWeight: pw.FontWeight.bold))),
            pw.Expanded(child: compactText(recipe.steps[i], size: 7.0)),
          ]),
        ),
    ]);

    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(24),
      theme: theme,
      build: (context) => pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
        pw.Container(height: 43, color: deepGreen, padding: const pw.EdgeInsets.symmetric(horizontal: 16),
          child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
            pw.Text('ТЕХНОЛОГИЧЕСКАЯ КАРТА (ТТК)', style: pw.TextStyle(fontSize: 17, color: PdfColors.white, fontWeight: pw.FontWeight.bold)),
            pw.Container(padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 9), color: gold,
              child: pw.Text('№ ${recipe.documentNumber}', style: pw.TextStyle(fontSize: 9, color: ink, fontWeight: pw.FontWeight.bold))),
          ]),
        ),
        pw.SizedBox(height: 9),
        pw.Text(recipe.name, style: pw.TextStyle(fontSize: 20, color: deepGreen, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.Row(children: [field('КАТЕГОРИЯ', recipe.category), field('ВЫХОД', '${recipe.totalNet.toStringAsFixed(1)} г / ${recipe.pieces} шт.'), field('ДАТА', recipe.documentDate.isEmpty ? '__________' : recipe.documentDate), field('СТАТУС', 'Черновик / проверка')]),
        pw.SizedBox(height: 9),
        row2(panel('1  ОБЛАСТЬ ПРИМЕНЕНИЯ', compactText(recipe.scopeNotes.isEmpty ? 'Рецептура и способ приготовления блюда для предприятия общественного питания. Данные требуют проверки.' : recipe.scopeNotes), height: 66),
             panel('2  ТРЕБОВАНИЯ К СЫРЬЮ', compactText(recipe.rawMaterialNotes.isEmpty ? 'Сырьё должно иметь документы, подтверждающие качество и происхождение; проверять маркировку и условия хранения.' : recipe.rawMaterialNotes), height: 66)),
        pw.SizedBox(height: 9),
        row2(panel('3  РЕЦЕПТУРА (НА 1 ПОРЦИЮ)', ingredientTable(), height: 195),
             panel('4  АЛЛЕРГЕНЫ В БЛЮДЕ', allergenTable(), height: 195, headerColor: gold)),
        pw.SizedBox(height: 9),
        row2(panel('5  ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ', technology(), height: 145),
             panel('6  КОНТРОЛЬ КАЧЕСТВА', compactText(recipe.qualityNotes), height: 145)),
        pw.SizedBox(height: 9),
        row2(panel('7  ХРАНЕНИЕ / РЕАЛИЗАЦИЯ', compactText('Хранение: ${recipe.storageNotes.isEmpty ? 'не установлено' : recipe.storageNotes}\nРеализация: ${recipe.expiryNotes.isEmpty ? 'не установлено' : recipe.expiryNotes}'), height: 91),
             panel('8  ПИЩЕВАЯ ЦЕННОСТЬ (КБЖУ)', pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start,children: [
               pw.Container(color: pale, padding: const pw.EdgeInsets.all(3), child: pw.Row(children: [pw.Expanded(flex: 3, child: compactText('Показатель', size: 7)), pw.Expanded(flex: 2, child: compactText('На 100 г', size: 7)), pw.Expanded(flex: 2, child: compactText('На порцию', size: 7))])),
               ...[
                 ('Белки, г', recipe.nutrition?.per100g(recipe.totalNet).protein, recipe.nutrition?.protein),
                 ('Жиры, г', recipe.nutrition?.per100g(recipe.totalNet).fat, recipe.nutrition?.fat),
                 ('Углеводы, г', recipe.nutrition?.per100g(recipe.totalNet).carbs, recipe.nutrition?.carbs),
                 ('Ккал', recipe.nutrition?.per100g(recipe.totalNet).kcal, recipe.nutrition?.kcal),
               ].map((n) => pw.Row(children: [
                 pw.Expanded(flex: 3, child: compactText(n.$1, size: 6.4)),
                 pw.Expanded(flex: 2, child: compactText(n.$2?.toStringAsFixed(1) ?? '—', size: 6.4)),
                 pw.Expanded(flex: 2, child: compactText(n.$3?.toStringAsFixed(1) ?? '—', size: 6.4)),
               ])),
             ]), height: 91)),
        pw.SizedBox(height: 9),
        panel('9  БЕЗОПАСНОСТЬ И КОНТРОЛЬ', compactText(recipe.safetyNotes), height: 63),
        pw.SizedBox(height: 10),
        pw.Row(children: [field('РАЗРАБОТАЛ', '${recipe.developerName.isEmpty ? '_________________' : recipe.developerName}   подпись: ______'), field('УТВЕРЖДАЮ', '${recipe.approverName.isEmpty ? '_________________' : recipe.approverName}   подпись: ______')]),
        pw.Spacer(),
        pw.Text('ГОСТ 31987-2012 • СанПиН 2.3/2.4.4282-26   |   ЧЕРНОВИК — сведения требуют проверки',
          style: pw.TextStyle(fontSize: 7, color: PdfColor.fromHex('#748880'))),
      ]),
    ));
    return doc.save();
  }

  static Future<void> share(TtkRecipe recipe) async => Printing.sharePdf(
        bytes: await render(recipe),
        filename: 'TTK_${recipe.name.replaceAll(' ', '_')}.pdf',
      );

  static Future<void> printCard(TtkRecipe recipe) async => Printing.layoutPdf(
        onLayout: (format) => render(recipe),
        name: 'ТТК ${recipe.name}',
      );
}
