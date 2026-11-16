import 'package:flutter_test/flutter_test.dart';
import 'package:chef_ttk_pro/models/recipe.dart';

void main() {
  test('демо: нетто 270 г, брутто 272 г, потери огурца 5%', () {
    final recipe = TtkRecipe.demonstration();
    expect(recipe.totalNet, 270);
    expect(recipe.totalGross, 272);
    expect(recipe.ingredients.last.wastePercent, closeTo(5, 1e-10));
    expect(recipe.validate(), isNull);
  });

  test('проверка длины реквизитов: не допускается обрезание А4', () {
    final r = TtkRecipe.demonstration();
    r.name = 'Очень длинное название блюда для печати на одностраничной карте формата А4';
    expect(r.validate(), isNotNull);
  });

  test('все 8 групп аллергена представлены, неизвестные не скрываются', () {
    final recipe = TtkRecipe.demonstration();
    expect(allergenLabels.length, 8);
    expect(recipe.declaredAllergens, containsAll(['milk', 'fish']));
    expect(recipe.allAllergensChecked, isFalse);
    for (final ingredient in recipe.ingredients) {
      ingredient.allergensChecked = true;
    }
    expect(recipe.allAllergensChecked, isTrue);
  });

  test('КБЖУ нет при отсутствии даже одного источника', () {
    final recipe = TtkRecipe.demonstration();
    for (final ingredient in recipe.ingredients) {
      ingredient.nutrition = const NutritionPer100(protein: 10, fat: 4, carbs: 20, kcal: 156);
      ingredient.nutritionSource = 'Этикетка, подтверждённая шефом';
    }
    expect(recipe.allNutritionChecked, isTrue);
    expect(recipe.nutrition!.protein, closeTo(27, 1e-8));
    expect(recipe.nutrition!.fat, closeTo(10.8, 1e-8));
    expect(recipe.nutrition!.carbs, closeTo(54, 1e-8));
    expect(recipe.nutrition!.kcal, closeTo(421.2, 1e-8));
    expect(recipe.nutrition!.per100g(recipe.totalNet).kcal, closeTo(156, 1e-8));
    recipe.ingredients.last.nutritionSource = '';
    expect(recipe.nutrition, isNull);
  });

  test('чрезмерные и бесконечные граммы не допускаются', () {
    final r = TtkRecipe.demonstration();
    r.ingredients.first.gross = double.infinity;
    expect(r.validate(), isNotNull);
    r.ingredients.first.gross = 120;
    r.ingredients.first.net = 100001;
    r.ingredients.first.gross = 100001;
    expect(r.validate(), isNotNull);
  });

  test('валидация отказывает при некорректных граммах и переполнении А4', () {
    final recipe = TtkRecipe.demonstration();
    recipe.ingredients.first.net = 500;
    expect(recipe.validate(), isNotNull);
    recipe.ingredients.first.net = 120;
    recipe.steps.add('Ещё один этап');
    expect(recipe.validate(), isNotNull);
    recipe.steps.removeLast();
    expect(recipe.validate(), isNull);
  });

  test('сериализация сохраняет историю, аллергены, подтверждения и данные', () {
    final recipe = TtkRecipe.demonstration();
    recipe.ingredients[2].allergensChecked = true;
    recipe.ingredients[2].nutrition = const NutritionPer100(protein: 20, fat: 10, carbs: 0, kcal: 180);
    recipe.ingredients[2].nutritionSource = 'Этикетка партии 2026';
    recipe.driveFileId = 'test-id-123';
    final decoded = decodeRecipes(encodeRecipes([recipe]));
    expect(decoded, hasLength(1));
    expect(decoded.single.totalNet, 270);
    expect(decoded.single.ingredients[2].allergens, contains('fish'));
    expect(decoded.single.ingredients[2].nutrition!.protein, 20);
    expect(decoded.single.driveFileId, 'test-id-123');
    expect(decoded.single.validate(), isNull);
  });

  test('при копировании изменяется только ID; исходник остаётся неизменным', () {
    final original = TtkRecipe.demonstration();
    final other = original.copy(newId: 'other');
    other.ingredients[0].net = 20;
    expect(original.ingredients[0].net, 120);
    expect(original.id, 'demo-philadelphia');
    expect(other.id, 'other');
  });
}
