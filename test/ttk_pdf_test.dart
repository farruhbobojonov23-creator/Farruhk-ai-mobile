import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:chef_ttk_pro/models/recipe.dart';
import 'package:chef_ttk_pro/services/ttk_pdf.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Создание образца PDF A4 с локальными шрифтами без сети', () async {
    final recipe = TtkRecipe.demonstration();
    final bytes = await TtkPdfService.render(recipe);
    expect(bytes.length, greaterThan(3000));
    expect(String.fromCharCodes(bytes.sublist(0, 4)), '%PDF');
    final file = File('build/ttk_pdf_preview/philadelphia_a4.pdf');
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes, flush: true);
  });

  test('Ошибочная рецептура не попадает в печатный документ', () async {
    final recipe = TtkRecipe.demonstration();
    recipe.ingredients[0].net = -1;
    await expectLater(TtkPdfService.render(recipe), throwsA(isA<StateError>()));
  });
}
