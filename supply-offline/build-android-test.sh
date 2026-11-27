#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
src="$work/PaddleOCR"
git init -q "$src"
git -C "$src" remote add origin https://github.com/PaddlePaddle/PaddleOCR.git
git -C "$src" fetch --depth=1 origin dab3fe35379033fdcb2d0e9572fac0b36c9a9ebf
git -C "$src" checkout --detach FETCH_HEAD
project="$src/deploy/ppocr-android"
models="$project/ppocr-sdk/src/main/assets/models"
mkdir -p "$models/det" "$models/rec"
download() { curl --fail --location --retry 3 --connect-timeout 20 --max-time 240 "$1" -o "$2"; }
download https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/df0bd9dee2bc627e80a2a1798ccab35a332e22d6/inference.onnx "$models/det/inference.onnx"
echo "a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d  $models/det/inference.onnx" | sha256sum -c -
rec=https://huggingface.co/PaddlePaddle/cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/2cef88145434beb8afa9dd82d77d799eb1ad7b29
download "$rec/inference.onnx" "$models/rec/inference.onnx"
download "$rec/inference.yml" "$models/rec/inference.yml"
test "$(wc -c < "$models/rec/inference.onnx")" -gt 1000000
grep -q 'character_dict:' "$models/rec/inference.yml"
cp "$here/android/MainActivity.kt" "$project/app/src/main/java/com/paddle/ocr/demo/MainActivity.kt"
cp "$here/android/RegistryActivity.kt" "$project/app/src/main/java/com/paddle/ocr/demo/RegistryActivity.kt"
mkdir -p "$project/app/src/main/assets"
python3 - "$project" "$here" <<'PY'
import pathlib,sys,os
p=pathlib.Path(sys.argv[1])
here=pathlib.Path(sys.argv[2])
html=(here/'android/registry.html').read_text()
assert 'const SEED=[];' in html and '/*SUPPLY_DRAFT_MODULE*/' in html
module=(here/'invoice-draft.js').read_text()
assert '</script' not in module.lower()
(p/'app/src/main/assets/registry.html').write_text(html.replace('/*SUPPLY_DRAFT_MODULE*/',module))
catalog=p/'gradle/libs.versions.toml'
v=catalog.read_text().replace('opencv = "4.5.3"','opencv = "4.10.0"').replace('group = "com.quickbirdstudios", name = "opencv"','group = "org.opencv", name = "opencv"')
assert 'group = "org.opencv"' in v and 'opencv = "4.10.0"' in v
catalog.write_text(v)
utils=p/'ppocr-sdk/src/main/java/com/paddle/ocr/util/OpenCVUtils.kt'
s=utils.read_text().replace('Log.e("OpenCVUtils", "Failed to initialize OpenCV: ${e.message}")','throw IllegalStateException("OpenCV native load: ${e.message}", e)')
utils.write_text(s)
g=p/'app/build.gradle.kts'
s=g.read_text().replace('applicationId = "com.paddle.ocr.demo"','applicationId = "ai.farukh.supply.offline.test"').replace('minSdk = 26','minSdk = 28')
s=s.replace('implementation(project(":ppocr-sdk"))','implementation(project(":ppocr-sdk"))\n    implementation(libs.kotlinx.coroutines.android)')
g.write_text(s)
(p/'app/src/main/AndroidManifest.xml').write_text('''<manifest xmlns:android="http://schemas.android.com/apk/res/android">
<application android:allowBackup="false" android:label="FARUKH SUPPLY Offline Test" android:theme="@android:style/Theme.Material.Light.NoActionBar">
<activity android:name="com.paddle.ocr.demo.MainActivity" android:exported="true" android:configChanges="orientation|screenSize|keyboardHidden">
<intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
</activity><activity android:name="com.paddle.ocr.demo.RegistryActivity" android:exported="false" android:configChanges="orientation|screenSize|keyboardHidden"/></application></manifest>''')
# Remove unused demo UI to avoid coupling to its original activity.
for file in (p/'app/src/main/java/com/paddle/ocr/demo').rglob('*.kt'):
    if file.name not in ('MainActivity.kt','RegistryActivity.kt'): file.unlink()
if os.getenv('SUPPLY_REGISTRY')=='1':
    manifest=p/'app/src/main/AndroidManifest.xml'
    m=manifest.read_text().replace('com.paddle.ocr.demo.MainActivity','com.paddle.ocr.demo.SWAP').replace('com.paddle.ocr.demo.RegistryActivity','com.paddle.ocr.demo.MainActivity').replace('com.paddle.ocr.demo.SWAP','com.paddle.ocr.demo.RegistryActivity').replace('FARUKH SUPPLY Offline Test','FARUKH SUPPLY AI')
    manifest.write_text(m)
# Use standard Maven repositories, rather than regional mirrors.
settings=p/'settings.gradle.kts'
settings.write_text('\n'.join(line for line in settings.read_text().splitlines() if 'maven.aliyun.com' not in line)+'\n')
PY
cd "$project"
chmod +x gradlew
./gradlew --no-daemon :app:assembleDebug
out="$here/build-output"
mkdir -p "$out"
cp app/build/outputs/apk/debug/app-debug.apk "$out/FARUKH-SUPPLY-OFFLINE-TEST.apk"
sha256sum "$out/FARUKH-SUPPLY-OFFLINE-TEST.apk"
