# FARUKH REVISION PRO — изолированный сервер обновлений

Deploy в Render, workspace **My Workspace**, отдельная ветка `feature/farukh-revision-updater-20261122`, отдельный бесплатный web service.

* Server path: `farukh-revision-update-server/server.mjs`.
* Start: `node farukh-revision-update-server/server.mjs`.
* `GET /health` — состояние сервера.
* `GET /revision-app/latest.json` — статус обновления. Если подписанный APK ещё не опубликован, `available:false` (никогда не заявляем несуществующую новую версию).
* `GET /revision-app/revision-pro.apk` — APK; 404 до публикации.
* CORS для WebView, no-store для манифеста, sha256 при подаче APK.

Для выпуска новой версии поместить в `farukh-revision-update-server/releases/`:

1. `revision-pro.apk` (подписанная APK, совпадающий applicationId и сертификат подписи; versionCode выше установленной).
2. `release.json` с `{"versionCode":8,"versionName":"0.2.8","sha256":"<64 lowercase hex>" }`.

Нужна **реальная** Android-оболочка с мостом `installVerifiedUpdate` для установки из приложения: старые сборки только проверяют манифест. Установка в Android требует подтверждения, без удаления приложения при совпадении сертификата/пакета.

Пока `release.json` и подписанный APK отсутствуют — сервер не объявляет фиктивное обновление. Не размещать закрытые ключи подписи в репозитории.

Render free web services may spin down; for high availability select an appropriate plan yourself after cost review.
