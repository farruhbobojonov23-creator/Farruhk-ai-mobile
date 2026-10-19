# FARUKH AI — Premium Stark V4: product-only scene

## Approved UX
- Bright premium minimalist solid background with restrained red and black accents; no window or scenery.
- Interactive 3D Earth centered on home screen. Users can rotate with touch drag in any direction (up/down/left/right/circular); momentum with damping, optional slow idle rotation.
- ONLY product category nodes orbit Earth. Remove unrelated category nodes from the visual orbit; do not delete underlying application features or data.
- Tap an orbiting product category to focus it and reveal its products with cinematic but responsive transitions.
- Lower virtual tabletop displays ONLY product samples, rotating gently, with touch-to-rotate and tap-to-inspect.
- Use temporary tasteful placeholder products until user provides actual product images/models; make assets replaceable through configuration, not hard-coded.
- Preserve Google integration and TTK structure/data untouched.
- Mobile first: drag gestures must not block clicks, maintain accessible controls, adaptive performance/reduced motion, graceful fallback when WebGL unavailable.
- Keep changes isolated to redesign/premium-stark-v4; do not deploy or modify production before functional QA.

## Acceptance checks
1. Earth rotates in both axes by touch and mouse drag.
2. Orbit displays product categories only; every visible node responds to tap.
3. Product table shows products only, and samples rotate independently.
4. Placeholder products can be replaced without rebuilding scene.
5. Existing Google and TTK flows remain functional.
6. No startup flash, missing navigation, or inert buttons on mobile.
