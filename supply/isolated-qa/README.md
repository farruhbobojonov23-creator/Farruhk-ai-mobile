# FARUKH SUPPLY AI — isolated invoice recognition pilot

**This branch is isolated from production.** It must not modify the installed Android APK, published web revision, or release tags.

## Goal
Verify the workflow **photo → raw OCR → supplier-specific document layout → correctly bound name / packaging / quantity / unit / VAT-inclusive unit price / line sum → human validation** before any app integration. No live deployment is authorized by this branch.

## Current evidence (2026-11-28)
- Real invoice 1 / 7: SHANGHAI-TORG (user-supplied OCR text). In a separate local lab: 6/6 SKU/quantity/price/line-total mappings and 47,486 RUB footer reconciled. Status: **OCR-text trial only; human review required**. No real image-to-form Android pass is proven.
- Synthetic tests: 9/9 categories passed, including 1, 2, 6, 20 variable rows, changing quantities, incompatible totals, missing amounts and unsupported vendor.
- Real invoices 2–7: **not tested** in this environment.
- Live Android photo → OCR → filled form → saved invoice: **not tested**.

## Rules
1. **No images, raw customer invoices, personal identifiers, keys or secrets in GitHub.** Real data belongs in a private test workspace only.
2. Distinguish raw OCR, manual review candidates, real documents and synthetic cases.
3. Even when totals match, a row is not considered verified until its name and price association is checked.
4. Do not use fixed product names/prices or memorize a particular supplier's assortment. Support 1–20 variable positions.
5. No paid services, no production or other-application changes, and **no auto-publish** from this experimental branch.
6. Next release gate: compare **all seven real invoices** against the original documents and report every field-level mismatch.

The runnable lab is packaged as a ChatGPT conversation artifact (source and synthetic tests only). This document records the isolated branch and the acceptance gate; the working prototype has **not** been merged into the application.
