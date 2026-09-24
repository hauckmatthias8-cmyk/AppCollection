#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Baue Hauckis möglicherweise nützliche App-Sammlung für iOS (Simulator, ohne Signierung)..."
xcodebuild -project HauckisAppSammlung.xcodeproj -scheme HauckisAppSammlung -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
