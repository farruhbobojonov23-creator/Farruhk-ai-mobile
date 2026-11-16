import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../models/recipe.dart';

/// Единственная утверждённая тема печати: белый А4, изумрудные шапки,
/// золотые номера, плотные читаемые таблицы, без логотипа и кнопок навигации.
/// До проверки исходных данных документ всегда помечен как ЧЕРНОВИК.
class TtkPdfService {
  static final PdfColor dark = PdfColor.fromHex('#005845');
  static final PdfColor green = PdfColor.fromHex('#006F5A');
  static final PdfColor gold = PdfColor.fromHex('#E9BC55');
  static final PdfColor paleGold = PdfColor.fromHex('#FFF2CC');
  static final PdfColor pale = PdfColor.fromHex('#E6F4EE');
  static final PdfColor quiet = PdfColor.fromHex('#F5FAF8');
  static final PdfColor ink = PdfColor.fromHex('#163F32');
  static final PdfColor line = PdfColor.fromHex('#A9D2C4');

  // PDF шрифты загружаются из APK и работают без доступа к интернету.
  static Future<(pw.Font, pw.Font)> _fonts() async {
    final normal = await rootBundle.load('assets/pdf/NotoSans-Regular.ttf');
    final bold = await rootBundle.load('assets/pdf/NotoSans-Bold.ttf');
    return (pw.Font.ttf(normal), pw.Font.ttf(bold));
  }

  static Future<Uint8List> render(TtkRecipe recipe) async {
    final problem = recipe.validate();
    if (problem != null) throw StateError(problem);
    final (normal, bold) = await _fonts();
    final doc = pw.Document();
    final theme = pw.ThemeData.withFont(base: normal, bold: bold);

    pw.Text text(String s, {double size = 7.5, bool heavy = false, PdfColor? color,
      int maxLines = 8, pw.TextAlign? align}) => pw.Text(
      s,
      textAlign: align,
      maxLines: maxLines,
      style: pw.TextStyle(fontSize: size, color: color ?? ink,
        fontWeight: heavy ? pw.FontWeight.bold : pw.FontWeight.normal,
        lineSpacing: .35),
    );


    pw.Widget section(int num, String heading, pw.Widget content,
      {required double height, bool golden = false}) {
      final top = golden ? gold : green;
      return pw.Container(
        height: height,
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: golden ? gold : line, width: .85),
          borderRadius: pw.BorderRadius.circular(6),
        ),
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
          pw.Container(
            height: 24,
            decoration: pw.BoxDecoration(
              color: top,
              borderRadius: const pw.BorderRadius.only(
                topLeft: pw.Radius.circular(5), topRight: pw.Radius.circular(5),
              ),
            ),
            padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            child: pw.Row(children: [
              pw.Container(
                width: 20, height: 18, alignment: pw.Alignment.center,
                decoration: pw.BoxDecoration(
                  color: golden ? paleGold : gold,
                  borderRadius: pw.BorderRadius.circular(5),
                ),
                child: text('$num', size: 11.5, heavy: true, color: ink),
              ),
              pw.SizedBox(width: 8),
              pw.Expanded(child: text(heading, size: 9.1, heavy: true,
                color: golden ? dark : PdfColors.white, maxLines: 1)),
            ]),
          ),
          pw.Expanded(child: pw.Padding(
            padding: const pw.EdgeInsets.fromLTRB(7, 5, 7, 5),
            child: content,
          )),
        ]),
      );
    }

    pw.Widget columns(pw.Widget l, pw.Widget r) => pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [pw.Expanded(child: l), pw.SizedBox(width: 8), pw.Expanded(child: r)],
    );

    pw.Widget field(String key, String value) => pw.Expanded(child: pw.Container(
      height: 34,
      margin: const pw.EdgeInsets.only(right: 4),
      padding: const pw.EdgeInsets.fromLTRB(8, 4, 5, 2),
      decoration: pw.BoxDecoration(
        color: PdfColors.white,
        border: pw.Border.all(color: line, width: .8),
        borderRadius: pw.BorderRadius.circular(5),
      ),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        text(key, size: 6.5, heavy: true, color: green, maxLines: 1),
        text(value, size: 8.1, heavy: true, maxLines: 1),
      ]),
    ));

    pw.Widget tableCell(String content, {double size = 7.0,
      bool heavy = false, pw.TextAlign align = pw.TextAlign.left}) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 2, horizontal: 3),
        child: text(content, size: size, heavy: heavy, align: align, maxLines: 2),
      );

    pw.Widget recipeTable() => pw.Column(children: [
      pw.Container(
        height: 18, color: pale,
        child: pw.Row(children: [
          pw.SizedBox(width: 19, child: tableCell('№', size: 6.5, heavy: true)),
          pw.Expanded(flex: 48, child: tableCell('Ингредиент', size: 7, heavy: true)),
          pw.Expanded(flex: 19, child: tableCell('Брутто, г', size: 6.3, heavy: true)),
          pw.Expanded(flex: 18, child: tableCell('Отходы, %', size: 6.2, heavy: true)),
          pw.Expanded(flex: 17, child: tableCell('Нетто, г', size: 6.3, heavy: true)),
        ]),
      ),
      ...recipe.ingredients.asMap().entries.map((entry) {
        final i = entry.key;
        final e = entry.value;
        return pw.Container(
          height: 15.7,
          color: i.isOdd ? quiet : PdfColors.white,
          child: pw.Row(children: [
            pw.SizedBox(width: 19, child: tableCell('${i + 1}', size: 7)),
            pw.Expanded(flex: 48, child: tableCell(e.name, size: 6.7)),
            pw.Expanded(flex: 19, child: tableCell(e.gross.toStringAsFixed(1), size: 6.7)),
            pw.Expanded(flex: 18, child: tableCell(e.wastePercent.toStringAsFixed(1), size: 6.7)),
            pw.Expanded(flex: 17, child: tableCell(e.net.toStringAsFixed(1), size: 6.7)),
          ]),
        );
      }),
      pw.Spacer(),
      pw.Container(
        height: 23,
        padding: const pw.EdgeInsets.symmetric(horizontal: 8),
        decoration: pw.BoxDecoration(
          color: paleGold, borderRadius: pw.BorderRadius.circular(4),
        ),
        child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          text('Выход готового блюда:', size: 8, heavy: true),
          text('${recipe.totalNet.toStringAsFixed(1)} г (${recipe.pieces} шт.)', size: 8, heavy: true),
        ]),
      ),
    ]);

    pw.Widget allergens() => pw.Column(children: [
      ...allergenLabels.entries.map((entry) {
        final idx = allergenLabels.keys.toList().indexOf(entry.key);
        final present = recipe.declaredAllergens.contains(entry.key);
        final label = present ? 'ДА*' : (recipe.allAllergensChecked ? 'НЕТ' : '?');
        return pw.Container(
          height: 16.8,
          color: idx.isEven ? quiet : PdfColors.white,
          child: pw.Row(children: [
            pw.SizedBox(width: 18, child: tableCell('${idx + 1}', size: 6.8)),
            pw.Expanded(child: tableCell(entry.value, size: 7.2)),
            pw.Container(
              width: 31, margin: const pw.EdgeInsets.all(2), alignment: pw.Alignment.center,
              decoration: pw.BoxDecoration(
                color: present ? gold : PdfColors.white,
                border: pw.Border.all(color: line, width: .6),
                borderRadius: pw.BorderRadius.circular(3),
              ),
              child: text(label, size: 6.4, heavy: true),
            ),
          ]),
        );
      }),
      pw.SizedBox(height: 3),
      text('* По данным карточки. Подтвердить по этикетке каждого продукта.',
        size: 5.9, color: dark, maxLines: 1),
    ]);

    pw.Widget steps() => pw.Column(children: [
      ...recipe.steps.asMap().entries.map((entry) => pw.Container(
        height: 19.5,
        padding: const pw.EdgeInsets.symmetric(vertical: 1),
        decoration: pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: pale, width: .5)),
        ),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
          pw.Container(
            width: 18, height: 17, alignment: pw.Alignment.center,
            decoration: pw.BoxDecoration(color: gold, borderRadius: pw.BorderRadius.circular(9)),
            child: text('${entry.key + 1}', size: 8.0, heavy: true),
          ),
          pw.SizedBox(width: 6),
          pw.Expanded(child: text(entry.value, size: 7.2, maxLines: 2)),
        ]),
      )),
    ]);

    final qualityParts = recipe.qualityNotes.split(RegExp(r'[;\n]'))
        .map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    pw.Widget quality() => pw.Column(children: [
      pw.Container(height: 17, color: pale,
        child: pw.Row(children: [
          pw.SizedBox(width: 88, child: tableCell('Показатель', size: 6.7, heavy: true)),
          pw.Expanded(child: tableCell('Требование', size: 6.7, heavy: true)),
        ])),
      ...qualityParts.take(4).toList().asMap().entries.map((entry) => pw.Container(
        height: 19.7,
        color: entry.key.isOdd ? quiet : PdfColors.white,
        child: pw.Row(children: [
          pw.SizedBox(width: 88, child: tableCell('Контроль ${entry.key + 1}', size: 7.0, heavy: true)),
          pw.Expanded(child: tableCell(entry.value, size: 7.0)),
        ]),
      )),
    ]);

    pw.Widget storage() => pw.Column(children: [
      pw.Container(
        color: quiet, padding: const pw.EdgeInsets.all(5),
        child: pw.Row(children: [
          pw.SizedBox(width: 88, child: text('Условия хранения', size: 7.2, heavy: true)),
          pw.Expanded(child: text(recipe.storageNotes.isEmpty ? 'Не установлены' : recipe.storageNotes, size: 7.5)),
        ]),
      ),
      pw.SizedBox(height: 4),
      pw.Container(
        color: quiet, padding: const pw.EdgeInsets.all(5),
        child: pw.Row(children: [
          pw.SizedBox(width: 88, child: text('Срок реализации', size: 7.2, heavy: true)),
          pw.Expanded(child: text(recipe.expiryNotes.isEmpty ? 'Не установлен' : recipe.expiryNotes, size: 7.5)),
        ]),
      ),
    ]);

    final nutr = recipe.nutrition;
    final per100 = nutr?.per100g(recipe.totalNet);
    pw.Widget nutrition() => pw.Column(children: [
      pw.Container(height: 17, color: pale,
        child: pw.Row(children: [
          pw.Expanded(flex: 4, child: tableCell('Показатель', size: 6.8, heavy: true)),
          pw.Expanded(flex: 3, child: tableCell('На 100 г', size: 6.8, heavy: true)),
          pw.Expanded(flex: 3, child: tableCell('Порция', size: 6.8, heavy: true)),
        ])),
      ...<({String name, double? a, double? b})>[
        (name: 'Белки, г', a: per100?.protein, b: nutr?.protein),
        (name: 'Жиры, г', a: per100?.fat, b: nutr?.fat),
        (name: 'Углеводы, г', a: per100?.carbs, b: nutr?.carbs),
        (name: 'Ккал', a: per100?.kcal, b: nutr?.kcal),
      ].asMap().entries.map((e) => pw.Container(
        height: 11.8,
        color: e.key.isOdd ? quiet : PdfColors.white,
        child: pw.Row(children: [
          pw.Expanded(flex: 4, child: tableCell(e.value.name, size: 6.8)),
          pw.Expanded(flex: 3, child: tableCell(e.value.a?.toStringAsFixed(1) ?? '—', size: 6.8)),
          pw.Expanded(flex: 3, child: tableCell(e.value.b?.toStringAsFixed(1) ?? '—', size: 6.8)),
        ]),
      )),
    ]);

    pw.Widget signature(String title, String value) => pw.Expanded(child: pw.Container(
      height: 54,
      margin: const pw.EdgeInsets.only(right: 3),
      padding: const pw.EdgeInsets.fromLTRB(10, 7, 10, 4),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: gold, width: .9),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        text(title, size: 8.7, heavy: true),
        pw.SizedBox(height: 3),
        pw.Row(children: [
          pw.Expanded(child: text(value.trim().isEmpty ? '______________________' : value, size: 8.6)),
          text('Дата: __________', size: 7.2),
        ]),
        pw.SizedBox(height: 2),
        text('(подпись) ______________________', size: 7.2),
      ]),
    ));

    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(16, 12, 16, 12),
      theme: theme,
      build: (_) => pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
        pw.Container(height: 42,
          decoration: pw.BoxDecoration(
            color: dark, borderRadius: pw.BorderRadius.circular(10),
          ),
          padding: const pw.EdgeInsets.symmetric(horizontal: 13),
          child: pw.Row(children: [
            pw.Container(width: 25, height: 2, color: gold),
            pw.SizedBox(width: 12),
            pw.Expanded(child: text('ТЕХНОЛОГИЧЕСКАЯ КАРТА (ТТК)',
              size: 16.8, heavy: true, color: PdfColors.white, maxLines: 1)),
            pw.Container(
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: gold, width: 1),
                color: paleGold,
                borderRadius: pw.BorderRadius.circular(5),
              ),
              padding: const pw.EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              child: text('№ ${recipe.documentNumber}', size: 10.3, heavy: true),
            ),
          ]),
        ),
        pw.SizedBox(height: 6),
        pw.Container(height: 29, padding: const pw.EdgeInsets.only(left: 5),
          child: text(recipe.name, size: 18.9, heavy: true, color: dark, maxLines: 1)),
        pw.SizedBox(height: 5),
        pw.Row(children: [
          field('КАТЕГОРИЯ', recipe.category),
          field('ВЫХОД', '${recipe.totalNet.toStringAsFixed(1)} г / ${recipe.pieces} шт.'),
          field('ДАТА', recipe.documentDate.isEmpty ? '__________' : recipe.documentDate),
          field('СТАТУС', 'Черновик'),
        ]),
        pw.SizedBox(height: 7),
        columns(
          section(1, 'ОБЛАСТЬ ПРИМЕНЕНИЯ', text(
            recipe.scopeNotes.isEmpty ? 'Предприятие общественного питания. Данные требуют проверки.' : recipe.scopeNotes,
            size: 7.55), height: 74),
          section(2, 'ТРЕБОВАНИЯ К СЫРЬЮ', text(
            recipe.rawMaterialNotes.isEmpty ? 'Сырьё по действующим требованиям, с документами и маркировкой.' : recipe.rawMaterialNotes,
            size: 7.55), height: 74),
        ),
        pw.SizedBox(height: 7),
        columns(
          section(3, 'РЕЦЕПТУРА (НА 1 ПОРЦИЮ)', recipeTable(), height: 183),
          section(4, 'АЛЛЕРГЕНЫ В БЛЮДЕ', allergens(), height: 183, golden: true),
        ),
        pw.SizedBox(height: 7),
        columns(
          section(5, 'ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ', steps(), height: 141),
          section(6, 'КОНТРОЛЬ КАЧЕСТВА', quality(), height: 141),
        ),
        pw.SizedBox(height: 7),
        columns(
          section(7, 'ХРАНЕНИЕ И РЕАЛИЗАЦИЯ', storage(), height: 105),
          section(8, 'ПИЩЕВАЯ ЦЕННОСТЬ (КБЖУ)', nutrition(), height: 105),
        ),
        pw.SizedBox(height: 7),
        section(9, 'БЕЗОПАСНОСТЬ (ХАССП)',
          text(recipe.safetyNotes.isEmpty ? 'Контроль приёмки, температуры, санитарной обработки и маркировки.' : recipe.safetyNotes,
            size: 7.6), height: 61),
        pw.SizedBox(height: 8),
        pw.Row(children: [signature('Разработал:', recipe.developerName),
          pw.SizedBox(width: 8), signature('Утверждаю:', recipe.approverName)]),
        pw.Spacer(),
        pw.Container(height: 14,
          decoration: pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(color: gold, width: .9))),
          padding: const pw.EdgeInsets.only(top: 3),
          child: text('ГОСТ 31987-2012  •  СанПиН 2.3/2.4.4282-26   |   ОБРАЗЕЦ: ПРОВЕРКА ДАННЫХ ОБЯЗАТЕЛЬНА',
            size: 6.35, color: PdfColor.fromHex('#627E75'), heavy: true, maxLines: 1),
        ),
      ]),
    ));
    return doc.save();
  }

  static Future<void> share(TtkRecipe recipe) async => Printing.sharePdf(
        bytes: await render(recipe),
        filename: 'TTK_${recipe.name.replaceAll(RegExp(r'[/\\]'), '_')}.pdf',
      );

  static Future<void> printCard(TtkRecipe recipe) async => Printing.layoutPdf(
        onLayout: (_) => render(recipe),
        name: 'ТТК ${recipe.name}',
      );
}
