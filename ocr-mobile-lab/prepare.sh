#!/usr/bin/env bash
set -euo pipefail
sdk="$1/ppocr-sdk/src/main/assets/models"
mkdir -p "$sdk/det" "$sdk/rec"
curl -fL --retry 3 "https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx" -o "$sdk/det/inference.onnx"
for f in inference.onnx inference.yml; do
  curl -fL --retry 3 "https://huggingface.co/PaddlePaddle/cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/2cef881/$f" -o "$sdk/rec/$f"
done
test "$(wc -c < "$sdk/det/inference.onnx")" -gt 100000
test "$(wc -c < "$sdk/rec/inference.onnx")" -gt 100000
grep -q 'character_dict' "$sdk/rec/inference.yml"
sha256sum "$sdk/det/inference.onnx" "$sdk/rec/inference.onnx" "$sdk/rec/inference.yml"
