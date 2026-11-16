import 'dart:convert';

/// An ingredient's nutritional values are provided per 100 g of edible (net)
/// ingredient. Null values must NOT be silently interpreted as zero.
class NutritionPer100 {
  const NutritionPer100({required this.protein, required this.fat, required this.carbs, required this.kcal});
  final double protein, fat, carbs, kcal;

  factory NutritionPer100.fromJson(Map<String, dynamic> data) => NutritionPer100(
    protein: (data['protein'] as num).toDouble(),
    fat: (data['fat'] as num).toDouble(),
    carbs: (data['carbs'] as num).toDouble(),
    kcal: (data['kcal'] as num).toDouble(),
  );
  Map<String, dynamic> toJson() => {'protein': protein, 'fat': fat, 'carbs': carbs, 'kcal': kcal};
  bool get isValid => [protein, fat, carbs, kcal].every((v) => v.isFinite && v >= 0);
}

const allergenLabels = <String, String>{
  'fish': 'Рыба и продукты из рыбы',
  'milk': 'Молоко и молочные продукты',
  'gluten': 'Злаки, содержащие глютен',
  'eggs': 'Яйца и продукты из них',
  'crustaceans': 'Ракообразные',
  'soy': 'Соя и продукты из сои',
  'sesame': 'Кунжут и продукты из него',
  'nuts': 'Орехи',
};

class Ingredient {
  Ingredient({
    required this.name,
    required this.gross,
    required this.net,
    this.nutrition,
    Set<String>? allergens,
    this.allergensChecked = false,
    this.nutritionSource = '',
  }) : allergens = allergens ?? <String>{};

  String name;
  double gross;
  double net;
  NutritionPer100? nutrition;
  Set<String> allergens;
  /// Whether the ingredient's actual label/specification has been checked.
  bool allergensChecked;
  String nutritionSource;

  double get wastePercent => gross == 0 ? 0 : (gross - net) / gross * 100;
  bool get hasNutrition => nutrition != null && nutrition!.isValid && nutritionSource.trim().isNotEmpty;
  bool get isValid => name.trim().isNotEmpty && gross.isFinite && net.isFinite &&
      gross >= net && net > 0 && gross <= 100000 && net <= 100000 && (nutrition == null || nutrition!.isValid) &&
      allergens.every(allergenLabels.containsKey);

  Ingredient copy() => Ingredient(
    name: name, gross: gross, net: net, nutrition: nutrition,
    allergens: {...allergens}, allergensChecked: allergensChecked,
    nutritionSource: nutritionSource,
  );

  Map<String, dynamic> toJson() => {
    'name': name, 'gross': gross, 'net': net,
    'nutrition': nutrition?.toJson(), 'allergens': allergens.toList(),
    'allergensChecked': allergensChecked, 'nutritionSource': nutritionSource,
  };

  factory Ingredient.fromJson(Map<String, dynamic> data) => Ingredient(
    name: (data['name'] ?? '').toString(),
    gross: (data['gross'] as num).toDouble(),
    net: (data['net'] as num).toDouble(),
    nutrition: data['nutrition'] is Map ? NutritionPer100.fromJson(Map<String, dynamic>.from(data['nutrition'] as Map)) : null,
    allergens: (data['allergens'] as List<dynamic>? ?? []).map((e) => e.toString()).toSet(),
    allergensChecked: data['allergensChecked'] == true,
    nutritionSource: (data['nutritionSource'] ?? '').toString(),
  );
}

class NutritionTotals {
  const NutritionTotals({required this.protein, required this.fat, required this.carbs, required this.kcal});
  final double protein, fat, carbs, kcal;
  NutritionTotals per100g(double yield) => NutritionTotals(
    protein: protein * 100 / yield, fat: fat * 100 / yield,
    carbs: carbs * 100 / yield, kcal: kcal * 100 / yield,
  );
}

class TtkRecipe {
  TtkRecipe({
    required this.id,
    required this.name,
    required this.category,
    required this.ingredients,
    required this.steps,
    this.documentNumber = '001',
    this.pieces = 8,
    this.documentDate = '',
    this.scopeNotes = '',
    this.rawMaterialNotes = '',
    this.qualityNotes = '',
    this.storageNotes = '',
    this.expiryNotes = '',
    this.safetyNotes = '',
    this.developerName = '',
    this.approverName = '',
    this.status = 'Черновик',
    this.driveFileId,
  });
  String id, documentNumber, name, category, documentDate, scopeNotes,
      rawMaterialNotes, qualityNotes, storageNotes, expiryNotes,
      safetyNotes, developerName, approverName, status;
  String? driveFileId;
  int pieces;
  List<Ingredient> ingredients;
  List<String> steps;

  double get totalNet => ingredients.fold<double>(0, (sum, e) => sum + e.net);
  double get totalGross => ingredients.fold<double>(0, (sum, e) => sum + e.gross);
  Set<String> get declaredAllergens => ingredients.expand((e) => e.allergens).toSet();
  bool get allAllergensChecked => ingredients.isNotEmpty && ingredients.every((e) => e.allergensChecked);
  bool get allNutritionChecked => ingredients.isNotEmpty && ingredients.every((e) => e.hasNutrition);
  NutritionTotals? get nutrition {
    if (!allNutritionChecked || totalNet <= 0) return null;
    double p = 0, f = 0, c = 0, kcal = 0;
    for (final i in ingredients) {
      final n = i.nutrition!;
      final scale = i.net / 100;
      p += n.protein * scale;
      f += n.fat * scale;
      c += n.carbs * scale;
      kcal += n.kcal * scale;
    }
    return NutritionTotals(protein: p, fat: f, carbs: c, kcal: kcal);
  }

  /// The A4 grid has a defined capacity; reject overflow rather than silently
  /// omitting ingredient rows or preparation steps from an official document.
  String? validate() {
    if (name.trim().isEmpty || category.trim().isEmpty) return 'Введите название и категорию.';
    if (name.length > 38 || category.length > 30 || documentNumber.length > 10 || documentDate.length > 14) {
      return 'Название или реквизиты слишком длинные для одностраничного А4.';
    }
    if (developerName.length > 42 || approverName.length > 42) {
      return 'ФИО слишком длинное для поля подписи А4.';
    }
    if (ingredients.isEmpty || ingredients.length > 8) return 'Для одного А4 укажите от 1 до 8 ингредиентов.';
    if (ingredients.any((e) => !e.isValid)) return 'Ошибка в ингредиентах: проверьте название, брутто, нетто и пищевые данные.';
    if (pieces < 1 || pieces > 100) return 'Количество частей должно быть от 1 до 100.';
    if (!totalNet.isFinite || !totalGross.isFinite || totalNet <= 0 || totalNet > 100000) {
      return 'Проверьте итоговый выход блюда: число должно быть допустимым и конечным.';
    }
    if (steps.isEmpty || steps.length > 5 || steps.any((s) => s.trim().isEmpty)) return 'Для одного А4 укажите от 1 до 5 этапов.';
    if (ingredients.any((e) => e.name.length > 52) || steps.any((s) => s.length > 70)) {
      return 'Сократите слишком длинные строки: таблицы должны умещаться на А4.';
    }
    if (qualityNotes.length > 200 || safetyNotes.length > 90 ||
        scopeNotes.length > 110 || rawMaterialNotes.length > 110 ||
        storageNotes.length > 80 || expiryNotes.length > 80) {
      return 'Текст разделов слишком длинный для одного листа А4.';
    }
    return null;
  }

  TtkRecipe copy({String? newId}) => TtkRecipe.fromJson({...toJson(), 'id': newId ?? id});

  Map<String, dynamic> toJson() => {
    'id': id, 'documentNumber': documentNumber, 'name': name,
    'category': category, 'ingredients': ingredients.map((e) => e.toJson()).toList(),
    'steps': steps, 'pieces': pieces, 'documentDate': documentDate,
    'scopeNotes': scopeNotes, 'rawMaterialNotes': rawMaterialNotes,
    'qualityNotes': qualityNotes, 'storageNotes': storageNotes,
    'expiryNotes': expiryNotes, 'safetyNotes': safetyNotes,
    'developerName': developerName, 'approverName': approverName,
    'status': status, 'driveFileId': driveFileId,
  };
  factory TtkRecipe.fromJson(Map<String, dynamic> data) => TtkRecipe(
    id: (data['id'] ?? '').toString(),
    documentNumber: (data['documentNumber'] ?? '001').toString(),
    name: (data['name'] ?? '').toString(), category: (data['category'] ?? '').toString(),
    ingredients: (data['ingredients'] as List<dynamic>? ?? [])
        .map((e) => Ingredient.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
    steps: (data['steps'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
    pieces: (data['pieces'] as num?)?.toInt() ?? 8,
    documentDate: (data['documentDate'] ?? '').toString(),
    scopeNotes: (data['scopeNotes'] ?? '').toString(),
    rawMaterialNotes: (data['rawMaterialNotes'] ?? '').toString(),
    qualityNotes: (data['qualityNotes'] ?? '').toString(),
    storageNotes: (data['storageNotes'] ?? '').toString(),
    expiryNotes: (data['expiryNotes'] ?? '').toString(),
    safetyNotes: (data['safetyNotes'] ?? '').toString(),
    developerName: (data['developerName'] ?? '').toString(),
    approverName: (data['approverName'] ?? '').toString(),
    status: (data['status'] ?? 'Черновик').toString(),
    driveFileId: data['driveFileId']?.toString(),
  );

  static TtkRecipe demonstration() => TtkRecipe(
    id: 'demo-philadelphia', documentNumber: '001',
    name: 'Филадельфия классик', category: 'Холодные роллы',
    pieces: 8, documentDate: '16.11.2026',
    ingredients: [
      Ingredient(name: 'Рис для суши (готовый)', gross: 120, net: 120),
      Ingredient(name: 'Нори', gross: 2, net: 2),
      Ingredient(name: 'Лосось (филе)', gross: 60, net: 60, allergens: {'fish'}),
      Ingredient(name: 'Сыр сливочный', gross: 50, net: 50, allergens: {'milk'}),
      Ingredient(name: 'Огурец свежий', gross: 40, net: 38),
    ],
    steps: [
      'Проверить состояние сырья, целостность упаковки и массы.',
      'Распределить подготовленный рис по листу нори.',
      'Добавить сыр и огурец, сформовать ролл.',
      'Покрыть поверхность ломтиками лосося.',
      'Нарезать на 8 частей и оформить подачу.',
    ],
    scopeNotes: 'Рецептура и технология приготовления блюда в предприятии общественного питания. Данные демонстрационные.',
    rawMaterialNotes: 'Проверить маркировку сырья, поставочные документы, качество и условия хранения.',
    qualityNotes: 'Ровная форма; аккуратная нарезка; запах без посторонних нот; характерная консистенция.',
    storageNotes: 'Требуется подтверждение температурного режима.',
    expiryNotes: 'Срок должен быть обоснован технологом.',
    safetyNotes: 'Контроль приёмки, температур, санитарной обработки инвентаря и маркировки.',
  );
}

String encodeRecipes(List<TtkRecipe> recipes) => jsonEncode({
  'schemaVersion': 1, 'recipes': recipes.map((e) => e.toJson()).toList(),
});

List<TtkRecipe> decodeRecipes(String jsonText) {
  final data = jsonDecode(jsonText) as Map<String, dynamic>;
  if (data['schemaVersion'] != 1) throw const FormatException('Неподдерживаемый формат архива.');
  return (data['recipes'] as List<dynamic>)
      .map((e) => TtkRecipe.fromJson(Map<String, dynamic>.from(e as Map))).toList();
}
