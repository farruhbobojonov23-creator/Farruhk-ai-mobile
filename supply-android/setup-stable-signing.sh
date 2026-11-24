#!/usr/bin/env bash
# Run in a trusted terminal with Java keytool and GitHub CLI installed.
# Never commit the generated key or passwords. Keep an encrypted offline backup.
set -euo pipefail
umask 077
repo='farruhbobojonov23-creator/Farruhk-ai-mobile'
for cmd in gh keytool openssl base64; do command -v "$cmd" >/dev/null || { echo "Missing: $cmd"; exit 1; }; done
gh auth status >/dev/null
names=$(gh secret list --repo "$repo" --json name --jq '.[].name')
if grep -q '^FARUKH_SUPPLY_.*\(KEYSTORE\|SIGNING\)' <<< "$names"; then
  echo 'Supply signing secrets already exist. Refusing to replace them; recover the original signing key instead.'
  exit 1
fi
dir="$HOME/.farukh-supply-signing"
if [ -e "$dir" ]; then echo "Key directory already exists: $dir. Refusing to overwrite."; exit 1; fi
mkdir -m 700 "$dir"
password=$(openssl rand -hex 32)
printf '%s' "$password" > "$dir/password.txt"
keytool -genkeypair -storetype PKCS12 -keystore "$dir/supply.p12" -storepass "$password" -keypass "$password" -alias supply -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=FARUKH SUPPLY AI'
echo 'Save an encrypted offline backup of the key and password before continuing.'
echo "Private directory: $dir"
read -r -p 'Backup saved? Type YES: ' answer
[ "$answer" = YES ] || { echo 'Stopped before adding secrets. Keep the key safe.'; exit 1; }
base64 < "$dir/supply.p12" | tr -d '\r\n' | gh secret set FARUKH_SUPPLY_KEYSTORE_BASE64 --repo "$repo"
printf '%s' "$password" | gh secret set FARUKH_SUPPLY_SIGNING_STORE_PASSWORD --repo "$repo"
printf '%s' supply | gh secret set FARUKH_SUPPLY_SIGNING_KEY_ALIAS --repo "$repo"
printf '%s' "$password" | gh secret set FARUKH_SUPPLY_SIGNING_KEY_PASSWORD --repo "$repo"
unset password
echo 'Signing secrets configured. Do not delete your private backup.'
echo 'Re-run the newest FARUKH SUPPLY AI preview APK workflow in GitHub Actions.'
