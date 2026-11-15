#!/usr/bin/env bash
set -euo pipefail
# Reuse the user's OWN approved MORE SUSHI category-photo library.
# Images are downloaded only during the GitHub build and embedded in the
# generated APK, so the finished application shows them offline from day one.
ASSET_DIR="$(pwd)/app/src/main/assets/food"
mkdir -p "$ASSET_DIR"
BASE="https://raw.githubusercontent.com/farruhbobojonov23-creator/Farruhk-ai-mobile/more-sushi-studio-free/public/assets/categories"
for key in cold baked tempura maki sushi gunkan onigiri wok beridog snacks preparations; do
  echo "Fetching original $key.png"
  curl --fail --location --retry 3 --max-time 60 --silent --show-error     --output "$ASSET_DIR/$key.png" "$BASE/$key.png"
  test -s "$ASSET_DIR/$key.png"
done
echo "Offline Japanese food photographs embedded in the Android package:"
du -sh "$ASSET_DIR"
