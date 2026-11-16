import 'dart:convert';
import 'dart:typed_data';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import '../models/recipe.dart';

/// Google Drive optional sync. Requires OAuth client registration in Google Cloud
/// matching this app's applicationId, signing certificate SHA-1 and consent screen.
/// Never handles or stores passwords or permanent access tokens.
class GoogleDriveSync {
  static const scopes = ['https://www.googleapis.com/auth/drive.file'];
  GoogleSignInAccount? _account;
  bool _initialized = false;
  bool get connected => _account != null;
  String? get accountEmail => _account?.email;

  Future<void> _initialize() async {
    if (_initialized) return;
    const serverClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
    await GoogleSignIn.instance.initialize(
      serverClientId: serverClientId.isEmpty ? null : serverClientId,
    );
    _initialized = true;
  }

  /// Restore only if an already granted scope can be used without prompting.
  Future<void> restore() async {
    await _initialize();
    final user = await GoogleSignIn.instance.attemptLightweightAuthentication();
    if (user != null &&
        await user.authorizationClient.authorizationForScopes(scopes) != null) {
      _account = user;
    }
  }

  Future<void> connect() async {
    await _initialize();
    final account = await GoogleSignIn.instance.authenticate();
    await account.authorizationClient.authorizeScopes(scopes);
    _account = account;
  }

  Future<void> disconnect() async {
    _account = null;
    if (_initialized) await GoogleSignIn.instance.signOut();
  }

  /// Returns a Drive file ID on success. On failure caller must preserve the
  /// local record, display the error and offer retry without losing content.
  Future<String> uploadPdf(TtkRecipe recipe, Uint8List pdfBytes) async {
    final user = _account;
    if (user == null) throw StateError('Сначала подключите Google Диск.');
    final headers = await user.authorizationClient.authorizationHeaders(scopes);
    if (headers == null) throw StateError('Доступ к Google Диску истёк. Подключите его снова.');
    final fileId = recipe.driveFileId;
    final filename = 'TTK_${recipe.documentNumber}_${recipe.name.replaceAll(RegExp(r'[/\\]'), '_')}.pdf';
    final client = http.Client();
    try {
      if (fileId != null && fileId.isNotEmpty) {
        final uri = Uri.parse('https://www.googleapis.com/upload/drive/v3/files/${Uri.encodeComponent(fileId)}?uploadType=media&fields=id,name');
        final response = await client.patch(uri, headers: {...headers, 'Content-Type': 'application/pdf'}, body: pdfBytes);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw StateError('Google Drive: обновление PDF не удалось (${response.statusCode}).');
        }
        return fileId;
      }
      // Google Drive multipart/related upload. Form-data is NOT accepted here.
      final boundary = 'chef-ttk-${DateTime.now().microsecondsSinceEpoch}';
      final metadata = jsonEncode({'name': filename, 'mimeType': 'application/pdf'});
      final body = BytesBuilder(copy: false)
        ..add(utf8.encode('--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$metadata\r\n'))
        ..add(utf8.encode('--$boundary\r\nContent-Type: application/pdf\r\n\r\n'))
        ..add(pdfBytes)
        ..add(utf8.encode('\r\n--$boundary--\r\n'));
      final uri = Uri.parse('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name');
      final response = await client.post(uri,
        headers: {...headers, 'Content-Type': 'multipart/related; boundary=$boundary'},
        body: body.toBytes(),
      );
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw StateError('Google Drive: загрузка PDF не удалась (${response.statusCode}).');
      }
      final id = (jsonDecode(response.body) as Map<String, dynamic>)['id']?.toString();
      if (id == null || id.isEmpty) throw StateError('Google Drive не вернул ID документа.');
      return id;
    } finally {
      client.close();
    }
  }
}
