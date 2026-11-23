# FARRUH WORKSPACE PRO · CHEF COMMAND CENTER 1.0.0
Date: 24 November 2026
Basis: user approved third concept and explicitly prohibited stacking new theme over old.

## Replacement
- mobile.html replaced with a fresh launcher page. Links only **workspace-command.css**. The old Ocean/Pearl/Black-Gold theme assets remain in history/repo but are NOT loaded on the new main screen.
- workspace-hub.js is a new independent navigation and project directory; old ocean-categories.js and premium-motion.js no longer loaded on main screen.
- Linked projects: MORE SUSHI STUDIO (same-site editor), FARRUH AI (Render mobile service), FARUKH REVISION (same-site), FARUKH PRINT (Render print site), FARUKH KITCHEN (chefaka), SHEF51, СУШИ БЕРИ.
- Internal project window tries iframe; some sites block embedding; always shows an explicit 'Open' fallback. No promise of cross-origin session sharing.
- User can add projects and edit links, descriptions, colors and optional scaled image. Values persist locally in browser storage only.
- No simulated online statuses; only MORE SUSHI authenticated Supabase counters and cloud status from unchanged ocean-dashboard.js.
- Static version manifest / original updater used. No signed APK rebuilt and no change to APK signature, TTK or inventory records.

## Risks / scope
Existing TTK editor (index.html) and Revision remain separate functional screens and have not been rewritten in this release. Their original application data and logic are not modified. Links to external sites depend on site availability and framing permissions.

## QA
Verify one CSS theme, JS syntax, required ids / scripts / routes, 5 tabs, link sanitation, body scroll / bottom dock. Android WebView device runtime and authenticated cloud workflow still require on-device verification.
