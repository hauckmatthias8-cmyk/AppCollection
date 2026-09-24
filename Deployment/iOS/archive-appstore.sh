#!/bin/bash
set -euo pipefail
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID fehlt. Beispiel: export APPLE_TEAM_ID=ABC123XYZ}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS="$ROOT/iOS"
ART="$ROOT/Artifacts/iOS"
ARCHIVE="$ART/HauckisAppSammlung.xcarchive"
EXPORT="$ART/export"
PLIST="$ART/ExportOptions.plist"
mkdir -p "$ART"
rm -rf "$ARCHIVE" "$EXPORT"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>signingStyle</key><string>automatic</string>
<key>teamID</key><string>${APPLE_TEAM_ID}</string>
<key>uploadSymbols</key><true/>
</dict></plist>
PLIST

xcodebuild \
  -project "$IOS/HauckisAppSammlung.xcodeproj" \
  -scheme HauckisAppSammlung \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  archive

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT" \
  -exportOptionsPlist "$PLIST" \
  -allowProvisioningUpdates

IPA="$(find "$EXPORT" -maxdepth 1 -name '*.ipa' -print -quit)"
[ -n "$IPA" ] || { echo 'Keine IPA erzeugt.'; exit 1; }
cp "$IPA" "$ART/Hauckis-App-Sammlung.ipa"
echo "Fertig: $ART/Hauckis-App-Sammlung.ipa"
