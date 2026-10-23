# FARUKH AI — Android

This is an Android wrapper for the existing site, **not a replacement** for it.

- First-party HTTPS site: https://farruhk-ai-mobile.onrender.com
- One interface on both Android phones and tablets.
- Bluetooth Classic SPP (paired **Printer001 / V3 BT**) uses a native printer bridge.
- One app supports **58 × 40 mm** ready-goods and **31 × 20 mm** preparation labels.
- Each phone or tablet is paired separately with the same nearby printer. Print sequentially, not simultaneously.
- Web site and Google backup remain independent, and labels stored locally in the browser do not automatically sync between devices.
- Print command TSPL is a hypothesis based on the V3 printer family; print one test label first, inspect image/paper feed. Other printer firmware may use a different language.
- Tested in JavaScript mocks, **physical printer and Android APK still need testing**.

## Build

Open the **android/** folder in Android Studio (Java 17, Android SDK 35), then Build > Build APK.
Or download a test APK from the GitHub Actions run `Android FARUKH AI APK` > Artifacts > `FARUKH-AI-Android-test`. A debug APK is signed with an automatically generated debug key and intended for testing only. For production, use a stable release keystore and normal updates.

Install the APK on both Android devices. Pair the V3 BT separately in Android Bluetooth settings. Close 4Barcode before printing from FARUKH AI; it may hold the Bluetooth SPP connection.

Open "Готовая продукция · 58 × 40", select a verified product, tap "Печатать на V3". At first connection choose Printer001. Later actions remember the printer on that device. For semi-finished products use 31 × 20 mm section. The native bridge only accepts the existing first-party HTTPS main frame, and the app connects to bonded Bluetooth devices (no scanning).

### Limitations

Google Docs sync is handled by the existing website, not the APK. Native Android WebView does not support all full Chrome extensions/features, e.g. some browser-specific speech-recognition implementations. Camera/microphone requested by the site are permission-gated. Printing depends on printer's support for Bluetooth Classic SPP and TSPL bitmap format; V3 family firmware may vary.

The app never stores Bluetooth data remotely or sends label bitmaps to Google: label job passes from the hosted page to a local Android WebMessage bridge and paired printer.
