# FARUKH SUPPLY AI — seven supplier reference profiles V7 (isolated)

Date: 2026-11-28. Experimental branch; NEVER publish to current Android APK until verified.

Seven profiles and original reference files, kept in a **private ZIP**, not in this GitHub branch:
- shanghai / ШАНХАЙ-ТОРГ — 56800(2).jpg, УПД, printed gross unit price (4а), amount (9).
- alidi / АЛИДИ ПРОФ — 56801(2).jpg, landscape УПД, gross price to the RIGHT of gross amount, and packaging columns.
- vesta / ВЕСТА — 56802(2).jpg, УПД, price without VAT (4) and amount with VAT (9).
- virgo / ВИРГО — 56803(2).jpg, УПД, distinct identity from ВЕСТА despite similar table.
- chistyakova / ИП Чистякова — 56804(2).jpg, УПД, price without VAT, optional SKU.
- vostok_zapad / ВОСТОК-ЗАПАД — 56805(2).jpg, ТТН, no explicit unit-price column: must NOT derive silently; mass and number of places are not interchangeable.
- marr / МАРР РУССИЯ — 56806(2).jpg, item code + name + qty + price + total; existing numeric V6 benchmark 11/11, 42 025.44 RUB; names, packs and units remain incomplete.

Local V7 prototype adds per-supplier category menu, sample-specific visual column maps, OCR-coordinate parsing under strict validation, price mode separation, isolated per-supplier browser drafts, supplier-mismatch blocking, and 7 original invoice images private within its user-downloadable package. No images or other private supplier documents have been committed to GitHub.

Verification of local package: 57/57 Node.js synthetic tests; 17/17 Python MARR-V6 tests; 7/7 sample images served by local HTTP server. It is NOT a validated end-to-end OCR solution: 0/7 original documents fully verified with V7. No Android build, APK, or live deployment. Original main application is unchanged.

The full V7 prototype, including code and **private real invoice samples**, is distributed to the user as a local ZIP; do not upload that archive to a public repository.