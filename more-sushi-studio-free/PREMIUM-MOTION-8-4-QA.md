# PREMIUM MOTION 8.4 — FARUKH REVISION & MORE SUSHI

Source of request: 22 November 2026, user asks to restore a beautiful splash screen and slow typewriter-style appearance of words on entry, categories and cards.

## What changed
- `premium-motion.js`: one presentation-only shared helper. Full-screen brand-specific splash for FARUKH REVISION (ruby/gold on dark navy) and MORE SUSHI STUDIO (ruby/pearl). Each renders a gold/ruby 3D-like emblem, animated progress bar and 3 lines typed progressively. Visual loading text is **decorative**, does not claim a database/cloud check. Splash can always be skipped.
- View switches animate original heading, active nav label and a capped set of card titles and descriptions. Revision: overview, weighing, history, products; MORE SUSHI: all 5 mobile tabs; authenticated studio: visible headings.
- Existing source text nodes remain in the DOM, not replaced with HTML; each finishes as its original value. The script checks whether business logic updated a node while animation ran, and NEVER writes old text over newly changed data.
- Reduced-motion accessibility preference disables type and splash effects.
- Initial splash closes after ~3.65 s with a 0.56 s fade; CSS fallback makes it disappear by 5 s even without JavaScript. A visible skip button closes it early.
- Only the existing theme CSS files were edited; revision still has one inline style. Added a single JS helper, not a second theme.
- New builds: `pearl-rose-8.4.0-20261123`, `premium-motion.js?v=8.4.0`; entry links to Revision cache-busted via `?rev=044`.

## Why this should not slow data features
No network, database, login, TTK/PDF, save, update button, or inventory code was touched. No busy-waiting; independent setTimeouts for at most 20 visible labels at a time and CSS opacity/transform. User navigation remains instant; typewriting can finish concurrently. No expensive GPU backdrop blur introduced.

## Verification
- 40/40 static integration checks: build/version agreement, one mobile theme, correct motion imports, valid existing routes, cloud counts, Revision tab structures, one inline revision style, CSS brace counts, reduced-motion, functional app functions unchanged, source-safe text restore.
- JavaScript syntax verified via `new Function` for premium-motion and existing navigation scripts.
- Two in-memory execution tests run against simulated Revision UI: partial text is seen mid-animation, source text is fully restored, and an externally updated form title survives the typing callback.
- Splash behavior tested with fake timers: title types slowly, default close and Skip both remove splash and leave no timers.
- **Limitations:** no real Xiaomi WebView screenshot run or post-deploy authenticated cloud workflow verification. Signed Android APK not rebuilt. This is a website/WebView update.

## Reviewer regression checklist on Xiaomi
Open MORE SUSHI mobile, observe rose intro, optionally Skip, test all five tabs and card subtitles. Open Revision, observe ruby/gold intro, Skip, test all four tabs, switch mode during typed headings, type actual inventory quantities and save; verify cloud status and saved history. Test native Android Back and update button. Test short display/reduced motion.
