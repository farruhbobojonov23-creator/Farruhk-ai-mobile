import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../models/recipe.dart';

/// Local application documents archive with a backup copy.
/// Export or back up important documents outside the device as well.
class RecipeStorage {
  Future<File> _file() async => File('${(await getApplicationDocumentsDirectory()).path}/chef_ttk_recipes_v1.json');

  Future<bool> hasArchive() async {
    final file = await _file();
    return await file.exists() || await File('${file.path}.bak').exists();
  }

  Future<List<TtkRecipe>> load() async {
    final file = await _file();
    var hadArchive = false;
    for (final candidate in [file, File('${file.path}.bak')]) {
      if (!await candidate.exists()) continue;
      hadArchive = true;
      try {
        return decodeRecipes(await candidate.readAsString());
      } catch (_) {
        // Try the backup, but never mask a broken archive as an empty archive.
      }
    }
    if (hadArchive) {
      throw const FormatException(
        'Основной архив и резервная копия повреждены; дальнейшее сохранение заблокировано.',
      );
    }
    return [];
  }

  Future<void> save(List<TtkRecipe> records) async {
    final file = await _file();
    final backup = File('${file.path}.bak');
    final temporary = File('${file.path}.tmp');
    if (await file.exists()) {
      // Do not replace a good backup with a corrupted primary archive.
      try {
        decodeRecipes(await file.readAsString());
      } catch (_) {
        if (!await backup.exists()) {
          throw StateError('Локальный архив повреждён. Сохранение отменено для защиты данных.');
        }
        decodeRecipes(await backup.readAsString());
        await backup.copy(file.path);
      }
      await file.copy(backup.path);
    }
    await temporary.writeAsString(encodeRecipes(records), flush: true);
    await temporary.rename(file.path);
  }
}
