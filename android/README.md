# Farrukh AI Android test APK

Test flow:
1. Open the app and allow microphone access.
2. Keep the app open on screen.
3. Say: **«Ведьма»**.
4. The app answers: **«Я слушаю»**.
5. Say a command.
6. The command is sent to the existing Farrukh AI `/api/chat` endpoint and the reply is spoken aloud.

This first test build intentionally verifies the native wake-word loop while the app is open. A later build can add a foreground service and a dedicated offline wake-word engine for screen-off/background operation.
