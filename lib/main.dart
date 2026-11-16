import 'package:flutter/material.dart';
import 'models/recipe.dart';
import 'services/recipe_storage.dart';
import 'services/google_drive_sync.dart';
import 'services/ttk_pdf.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ChefTtkApp());
}

const deepNavy = Color(0xFF091425);
const surface = Color(0xFF12223B);
const emerald = Color(0xFF006B59);
const brightBlue = Color(0xFF09B8EF);
const violet = Color(0xFF8351EB);
const gold = Color(0xFFF2D082);

class ChefTtkApp extends StatelessWidget {
  const ChefTtkApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'CHEF TTK PRO',
    theme: ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: deepNavy,
      colorScheme: ColorScheme.fromSeed(seedColor: brightBlue, brightness: Brightness.dark),
      useMaterial3: true,
      inputDecorationTheme: InputDecorationTheme(
        isDense: true, filled: true, fillColor: const Color(0xFF182A45),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(13)),
      ),
      cardTheme: CardThemeData(color: surface, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17))),
    ),
    home: const HomeScreen(),
  );
}

class GlowPanel extends StatelessWidget {
  const GlowPanel({required this.child, super.key, this.padding = const EdgeInsets.all(18)});
  final Widget child;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(24),
      gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
        colors: [Color(0xFF09506A), Color(0xFF20275A), Color(0xFF371C61)]),
      border: Border.all(color: const Color(0xFF569FF2).withValues(alpha: .55)),
      boxShadow: [BoxShadow(color: violet.withValues(alpha: .16), blurRadius: 22, spreadRadius: 1)],
    ),
    child: child,
  );
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final RecipeStorage storage = RecipeStorage();
  final GoogleDriveSync drive = GoogleDriveSync();
  List<TtkRecipe> recipes = [];
  bool busy = false;
  bool loading = true;
  String? lastSyncProblem;

  @override void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final stored = await storage.load();
      if (!mounted) return;
      final hasArchive = await storage.hasArchive();
      try { await drive.restore(); } catch (_) { /* OAuth is optional. */ }
      if (!mounted) return;
      setState(() { recipes = (stored.isEmpty && !hasArchive) ? [TtkRecipe.demonstration()] : stored; loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { recipes = [TtkRecipe.demonstration()]; loading = false; });
      _message('Не удалось прочитать архив: $e');
    }
  }

  void _message(String value) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value), duration: const Duration(seconds: 5)));
  }

  Future<void> _newOrEdit([TtkRecipe? initial]) async {
    final seed = initial?.copy() ?? TtkRecipe(
      id: DateTime.now().microsecondsSinceEpoch.toString(), name: '',
      category: 'Холодные роллы', ingredients: [], steps: [],
      documentDate: '${DateTime.now().day.toString().padLeft(2, '0')}.${DateTime.now().month.toString().padLeft(2, '0')}.${DateTime.now().year}',
    );
    final changed = await Navigator.of(context).push<TtkRecipe>(
      MaterialPageRoute(builder: (_) => RecipeEditor(recipe: seed)),
    );
    if (changed == null || !mounted) return;
    final copy = [...recipes];
    final index = copy.indexWhere((r) => r.id == changed.id);
    if (index < 0) { copy.insert(0, changed); } else { copy[index] = changed; }
    try {
      await storage.save(copy);
      if (!mounted) return;
      setState(() => recipes = copy);
      _message('ТТК сохранена на устройстве.');
      if (drive.connected) await _sync(changed, quietSuccess: true);
    } catch (e) { _message('Ошибка сохранения: $e'); }
  }

  Future<void> _pdfAction(Future<void> Function() operation) async {
    setState(() => busy = true);
    try { await operation(); }
    catch (e) { _message('PDF: $e'); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _connectDrive() async {
    setState(() => busy = true);
    try {
      await drive.connect();
      if (mounted) { setState(() => lastSyncProblem = null); _message('Подключён ${drive.accountEmail}. Теперь PDF синхронизируется после сохранения ТТК.'); }
    } catch (e) { _message('Для Google Диска требуется OAuth-настройка Android-приложения: $e'); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _sync(TtkRecipe recipe, {bool quietSuccess = false}) async {
    if (!drive.connected) { _message('Сначала подключите Google Диск.'); return; }
    setState(() => busy = true);
    try {
      final bytes = await TtkPdfService.render(recipe);
      final id = await drive.uploadPdf(recipe, bytes);
      final copy = recipes.map((r) => r.copy()).toList();
      final updated = copy.firstWhere((r) => r.id == recipe.id);
      updated.driveFileId = id;
      await storage.save(copy);
      if (!mounted) return;
      setState(() { recipes = copy; lastSyncProblem = null; });
      if (!quietSuccess) _message('PDF сохранён на Google Диск.');
    } catch (e) {
      if (!mounted) return;
      setState(() => lastSyncProblem = 'Синхронизация не выполнена: $e');
      _message('Локальная ТТК сохранена, но Google Диск недоступен: $e');
    } finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _delete(TtkRecipe recipe) async {
    final yes = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Удалить ТТК?'),
      content: Text('«${recipe.name}» будет удалена только из локального архива. Файл на Диске не затрагивается.'),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Отмена')),
        TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Удалить'))],
    ));
    if (yes != true || !mounted) return;
    try {
      final next = recipes.where((r) => r.id != recipe.id).toList();
      await storage.save(next);
      if (mounted) setState(() => recipes = next);
    } catch (e) { _message('Не удалось удалить: $e'); }
  }

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('CHEF TTK PRO', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1)), backgroundColor: Colors.transparent),
    floatingActionButton: FloatingActionButton.extended(
      backgroundColor: violet, foregroundColor: Colors.white,
      onPressed: busy ? null : () => _newOrEdit(),
      icon: const Icon(Icons.add), label: const Text('Новая ТТК'),
    ),
    body: loading ? const Center(child: CircularProgressIndicator()) : SafeArea(child: ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 90), children: [
        GlowPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.auto_awesome_rounded, color: gold, size: 34),
          const SizedBox(height: 10),
          const Text('Создавайте ТТК профессионально', style: TextStyle(fontSize: 25, height: 1.16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          const Text('Редактор • расчёт по введённым данным • PDF А4', style: TextStyle(color: Color(0xFFE0EAFB))),
          const SizedBox(height: 17),
          FilledButton.icon(onPressed: busy ? null : () => _newOrEdit(), icon: const Icon(Icons.add),
            label: const Text('Создать ТТК'), style: FilledButton.styleFrom(backgroundColor: violet, padding: const EdgeInsets.all(15))),
        ])),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('GOOGLE ДИСК', style: TextStyle(color: gold, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(drive.connected ? 'Подключён: ${drive.accountEmail}' : 'Не подключён. Для прямой загрузки требуется OAuth Google Cloud.', style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: busy ? null : _connectDrive, icon: const Icon(Icons.cloud_outlined), label: const Text('Подключить Google Диск')),
          if (lastSyncProblem != null) Text(lastSyncProblem!, style: const TextStyle(color: Colors.orangeAccent, fontSize: 12)),
        ]))),
        const SizedBox(height: 15),
        Text('Мои ТТК (${recipes.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
        const SizedBox(height: 8),
        if (recipes.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(25), child: Text('Пока нет документов. Создайте первую ТТК.'))),
        for (final recipe in recipes) Card(key: ValueKey(recipe.id), child: Padding(
          padding: const EdgeInsets.all(13), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.restaurant_menu, color: gold), const SizedBox(width: 8),
              Expanded(child: Text(recipe.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
              IconButton(onPressed: busy ? null : () => _delete(recipe), icon: const Icon(Icons.delete_outline), tooltip: 'Удалить'),
            ]),
            Text('${recipe.category}  •  ${recipe.totalNet.toStringAsFixed(1)} г  •  № ${recipe.documentNumber}', style: const TextStyle(color: Color(0xFFB8C6DB))),
            const SizedBox(height: 8),
            Text('КБЖУ: ${recipe.allNutritionChecked ? 'рассчитано по введённым значениям' : 'недостаточно данных'}  ·  Аллергены: ${recipe.allAllergensChecked ? 'проверены' : 'не все подтверждены'}', style: const TextStyle(fontSize: 11.5, color: gold)),
            const SizedBox(height: 9),
            Wrap(spacing: 5, runSpacing: 3, children: [
              TextButton.icon(onPressed: busy ? null : () => _newOrEdit(recipe), icon: const Icon(Icons.edit_outlined), label: const Text('Изменить')),
              TextButton.icon(onPressed: busy ? null : () => _pdfAction(() => TtkPdfService.share(recipe)), icon: const Icon(Icons.picture_as_pdf_outlined), label: const Text('PDF')),
              TextButton.icon(onPressed: busy ? null : () => _pdfAction(() => TtkPdfService.printCard(recipe)), icon: const Icon(Icons.print_outlined), label: const Text('Печать')),
              if (drive.connected) TextButton.icon(onPressed: busy ? null : () => _sync(recipe), icon: const Icon(Icons.cloud_upload_outlined), label: const Text('На Диск')),
            ]),
          ]),
        )),
        const SizedBox(height: 12),
        const Text('Демонстрационные данные и образцы не являются утверждёнными ТТК. Проверяйте сырьё, выход, КБЖУ, аллергены, условия и сроки хранения перед применением.', style: TextStyle(fontSize: 12, color: Color(0xFFA7B8CE))),
      ],
    )),
  );
}

class RecipeEditor extends StatefulWidget {
  const RecipeEditor({required this.recipe, super.key});
  final TtkRecipe recipe;
  @override State<RecipeEditor> createState() => _RecipeEditorState();
}

class _RecipeEditorState extends State<RecipeEditor> {
  late final TtkRecipe recipe = widget.recipe;
  late final Map<String, TextEditingController> fields = {
    'name': TextEditingController(text: recipe.name),
    'category': TextEditingController(text: recipe.category),
    'documentNumber': TextEditingController(text: recipe.documentNumber),
    'date': TextEditingController(text: recipe.documentDate),
    'pieces': TextEditingController(text: '${recipe.pieces}'),
    'scope': TextEditingController(text: recipe.scopeNotes),
    'raw': TextEditingController(text: recipe.rawMaterialNotes),
    'steps': TextEditingController(text: recipe.steps.join('\n')),
    'quality': TextEditingController(text: recipe.qualityNotes),
    'storage': TextEditingController(text: recipe.storageNotes),
    'expiry': TextEditingController(text: recipe.expiryNotes),
    'safety': TextEditingController(text: recipe.safetyNotes),
    'developer': TextEditingController(text: recipe.developerName),
    'approver': TextEditingController(text: recipe.approverName),
  };

  @override void dispose() { for (final c in fields.values) { c.dispose(); } super.dispose(); }

  Widget input(String key, String title, {int lines = 1, TextInputType? keyboard}) => Padding(
    padding: const EdgeInsets.only(bottom: 11),
    child: TextField(controller: fields[key], maxLines: lines, keyboardType: keyboard,
      decoration: InputDecoration(labelText: title)),
  );

  Widget title(String title) => Padding(padding: const EdgeInsets.symmetric(vertical: 14), child:
    Text(title, style: const TextStyle(color: gold, fontWeight: FontWeight.w800, fontSize: 18)));

  void _save() {
    recipe.name = fields['name']!.text.trim();
    recipe.category = fields['category']!.text.trim();
    recipe.documentNumber = fields['documentNumber']!.text.trim();
    recipe.documentDate = fields['date']!.text.trim();
    recipe.pieces = int.tryParse(fields['pieces']!.text.trim()) ?? 0;
    recipe.scopeNotes = fields['scope']!.text.trim();
    recipe.rawMaterialNotes = fields['raw']!.text.trim();
    recipe.steps = fields['steps']!.text.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    recipe.qualityNotes = fields['quality']!.text.trim();
    recipe.storageNotes = fields['storage']!.text.trim();
    recipe.expiryNotes = fields['expiry']!.text.trim();
    recipe.safetyNotes = fields['safety']!.text.trim();
    recipe.developerName = fields['developer']!.text.trim();
    recipe.approverName = fields['approver']!.text.trim();
    final problem = recipe.validate();
    if (problem != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(problem)));
      return;
    }
    Navigator.pop(context, recipe);
  }

  Future<void> _editDetails(Ingredient item) async {
    final protein = TextEditingController(text: item.nutrition?.protein.toString() ?? '');
    final fat = TextEditingController(text: item.nutrition?.fat.toString() ?? '');
    final carbs = TextEditingController(text: item.nutrition?.carbs.toString() ?? '');
    final kcal = TextEditingController(text: item.nutrition?.kcal.toString() ?? '');
    final source = TextEditingController(text: item.nutritionSource);
    var flags = {...item.allergens};
    var checked = item.allergensChecked;
    final ok = await showDialog<bool>(context: context, builder: (context) => StatefulBuilder(builder: (context, update) => AlertDialog(
      title: const Text('Показатели ингредиента'),
      content: SizedBox(width: 400, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('КБЖУ на 100 г нетто. Вводить по этикетке или подтверждённому источнику.', style: TextStyle(fontSize: 12)),
        for (final entry in [('Белки, г', protein), ('Жиры, г', fat), ('Углеводы, г', carbs), ('Ккал', kcal)])
          Padding(padding: const EdgeInsets.only(top: 7), child: TextField(controller: entry.$2,
            keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: entry.$1))),
        const SizedBox(height: 8),
        TextField(controller: source, decoration: const InputDecoration(labelText: 'Источник: этикетка / спецификация')),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Аллергены проверены по маркировке', style: TextStyle(fontSize: 13)),
          value: checked, onChanged: (v) => update(() => checked = v)),
        for (final flag in allergenLabels.entries)
          CheckboxListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text(flag.value, style: const TextStyle(fontSize: 12)),
            value: flags.contains(flag.key), onChanged: (v) => update(() {
              if (v == true) { flags.add(flag.key); } else { flags.remove(flag.key); }
            })),
      ]))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Отмена')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Применить')),
      ],
    )));
    if (ok == true) {
      final all = [protein.text.trim(), fat.text.trim(), carbs.text.trim(), kcal.text.trim()];
      if (all.any((v) => v.isNotEmpty) && all.any((v) => v.isEmpty)) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Для КБЖУ заполните все четыре показателя.')));
      } else {
        NutritionPer100? nutrition;
        if (all.every((v) => v.isNotEmpty)) {
          final values = all.map((v) => double.tryParse(v.replaceAll(',', '.'))).toList();
          if (values.any((v) => v == null || !v.isFinite || v < 0)) {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Проверьте числовые показатели КБЖУ.')));
            return;
          }
          nutrition = NutritionPer100(protein: values[0]!, fat: values[1]!, carbs: values[2]!, kcal: values[3]!);
        }
        setState(() {
          item.nutrition = nutrition;
          item.nutritionSource = source.text.trim();
          item.allergens = flags;
          item.allergensChecked = checked;
        });
      }
    }
    protein.dispose(); fat.dispose(); carbs.dispose(); kcal.dispose(); source.dispose();
  }

  Widget _ingredient(Ingredient item) => Card(key: ValueKey(item), child: Padding(
    padding: const EdgeInsets.all(11), child: Column(children: [
      Row(children: [
        Expanded(child: TextFormField(key: ValueKey('n${identityHashCode(item)}'),
          initialValue: item.name, decoration: const InputDecoration(labelText: 'Наименование'),
          onChanged: (v) { item.name = v; })),
        IconButton(onPressed: () => setState(() => recipe.ingredients.remove(item)),
          icon: const Icon(Icons.close), tooltip: 'Удалить ингредиент'),
      ]),
      const SizedBox(height: 6),
      Row(children: [
        Expanded(child: TextFormField(key: ValueKey('g${identityHashCode(item)}'),
          initialValue: item.gross.toString(), keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Брутто, г'), onChanged: (v) => setState(() => item.gross = double.tryParse(v.replaceAll(',', '.')) ?? 0))),
        const SizedBox(width: 8),
        Expanded(child: TextFormField(key: ValueKey('w${identityHashCode(item)}'),
          initialValue: item.net.toString(), keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Нетто, г'), onChanged: (v) => setState(() => item.net = double.tryParse(v.replaceAll(',', '.')) ?? 0))),
      ]),
      const SizedBox(height: 4),
      Row(children: [
        Expanded(child: Text('Отходы ${item.wastePercent.isFinite ? item.wastePercent.toStringAsFixed(1) : '—'} %  ·  ${item.hasNutrition ? 'КБЖУ введены' : 'КБЖУ нет'}  ·  ${item.allergensChecked ? 'Аллергены проверены' : 'Аллергены неизвестны'}', style: const TextStyle(fontSize: 11, color: gold))),
        IconButton(onPressed: () => _editDetails(item), icon: const Icon(Icons.tune), tooltip: 'КБЖУ и аллергены'),
      ]),
    ]),
  ));

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Редактор ТТК'), backgroundColor: Colors.transparent,
      actions: [TextButton.icon(onPressed: _save, icon: const Icon(Icons.save_outlined), label: const Text('Сохранить'))]),
    body: SafeArea(child: ListView(padding: const EdgeInsets.fromLTRB(17, 4, 17, 24), children: [
      const Text('Формат документа: 1 лист А4', style: TextStyle(color: gold, fontWeight: FontWeight.bold)),
      title('Название и параметры'),
      input('name', 'Название блюда'),
      input('category', 'Категория'),
      Row(children: [Expanded(child: input('documentNumber', '№ ТТК')),
        const SizedBox(width: 8), Expanded(child: input('pieces', 'Количество штук', keyboard: TextInputType.number))]),
      input('date', 'Дата составления'),
      title('Ингредиенты • ${recipe.totalNet.toStringAsFixed(1)} г нетто'),
      ...recipe.ingredients.map(_ingredient),
      OutlinedButton.icon(onPressed: recipe.ingredients.length >= 8 ? null : () => setState(() => recipe.ingredients.add(Ingredient(name: '', gross: 0, net: 0))),
        icon: const Icon(Icons.add), label: const Text('Добавить ингредиент (макс. 8)')),
      const SizedBox(height: 6),
      Text(recipe.nutrition == null
        ? 'КБЖУ: нужны полные данные по каждому ингредиенту'
        : 'КБЖУ: ${recipe.nutrition!.kcal.toStringAsFixed(1)} ккал на порцию',
        style: const TextStyle(color: gold)),
      if (!recipe.allAllergensChecked) const Text('Аллергены не определены полностью — заполните сведения по маркировке каждого ингредиента.', style: TextStyle(color: Colors.orangeAccent, fontSize: 12)),
      title('Технология и безопасность'),
      input('scope', 'Область применения', lines: 3),
      input('raw', 'Требования к сырью', lines: 3),
      input('steps', 'Технология: 1 этап = 1 строка (макс. 5)', lines: 6),
      input('quality', 'Контроль качества', lines: 3),
      input('storage', 'Условия хранения (проверенные)', lines: 2),
      input('expiry', 'Срок реализации (обоснованный)', lines: 2),
      input('safety', 'Безопасность / контроль', lines: 3),
      title('Подписи (поля для подписания в PDF)'),
      input('developer', 'Разработал: ФИО'),
      input('approver', 'Утверждаю: ФИО'),
      const SizedBox(height: 10),
      FilledButton.icon(onPressed: _save, icon: const Icon(Icons.check), label: const Text('Сохранить ТТК')),
      const SizedBox(height: 8),
      const Text('Статус документа — черновик до проверки и фактического утверждения ответственным лицом.', style: TextStyle(color: Color(0xFFA8BDD6), fontSize: 12)),
    ])),
  );
}
