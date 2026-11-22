# CHEF SIGNATURE ULTRA 7.0 — release audit

**Approved visual reference:** variant 12 (dark professional chef studio, ruby/red highlights, glossy and realistic 3D food). This implements the selected **direction** in existing real HTML. It is *not* claimed to be a pixel-exact export of a composited concept poster.

## Important architectural rule

Only **one mobile theme** is loaded: `chef-signature.css`. The old `ruby-white.css` is no longer linked. The only mobile-specific UI helper is `chef-signature-ui.js`, replacing `ruby-ui.js`. The three existing functional scripts remain for tab history, read-only cloud status and version-verified update checking.

The authenticated workspace continues to require its three **base editor/A4 stylesheets** (`farukh-pro.css`, `studio-themes.css`, `archive-sheet.css`); its single **active visual theme** is now `chef-signature-workspace.css`, replacing `ruby-workspace.css`. These base stylesheets are retained to avoid damaging document forms and print rendering. This is replacement, not an additional layered visual theme.

## Visual changes

- Deep black graphite/charcoal with bright ruby-red accents and clean white text.
- Actual food photographs on cards: salmon, sushi rolls, prepared ingredients, sauces, TTK clipboard, and printing.
- Glossy red action buttons, subtle chrome edges and compact 5-item dock.
- Five inner tabs styled in one family; status badges of seven not-yet-functional catalog/history sections are retained as `СКОРО`.
- Authenticated studio theme now matches dark signature palette, while actual paper documents and entry forms deliberately remain light for accuracy.

## Regression checks

34/34 source-structure checks passed: same five panels, same real TTK editor, PDF, library and project routes; no changes to updater/cloud/auth scripts; real cloud status preserved; all seven referenced image resources exist; CSS braces balanced and JS parses; old theme links removed.

**Local Chromium screen preview only:** 320×640, 360×740, 393×760, 393×850, 430×930. No hero text or CTA overlap; all seven images load, five bottom tabs remain visible; no horizontal overflow. At 393×850, all six home cards fit above the dock; on very short screens, the home may scroll rather than crop actions. Four inner tabs were also rendered at 393×850 and checked for layout overflow.

**Unverified:** on-device Xiaomi WebView, live authenticated studio operations, exact image match to the four-up reference, real-world load speed. No signed native APK release; this is an update of the web UI. Existing assets are optimized WebP, not actual 8K photographs.
