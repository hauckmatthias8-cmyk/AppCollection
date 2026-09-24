#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS="$ROOT/iOS"
ART="$ROOT/Artifacts/iOS"
DERIVED="$ART/DerivedData"
mkdir -p "$ART"
rm -rf "$DERIVED" "$ART/HauckisAppSammlung-simulator.zip"

xcodebuild \
  -project "$IOS/HauckisAppSammlung.xcodeproj" \
  -scheme HauckisAppSammlung \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP="$DERIVED/Build/Products/Debug-iphonesimulator/HauckisAppSammlung.app"
if [ ! -d "$APP" ]; then echo "Simulator-App nicht gefunden: $APP"; exit 1; fi
cd "$(dirname "$APP")"
ditto -c -k --sequesterRsrc --keepParent "$(basename "$APP")" "$ART/HauckisAppSammlung-simulator.zip"
echo "Fertig: $ART/HauckisAppSammlung-simulator.zip"
