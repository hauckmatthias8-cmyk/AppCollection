#!/bin/bash
set -euo pipefail
if [ $# -ne 2 ]; then
  echo "Aufruf: $0 <VERSION> <BUILDNUMMER>"
  exit 1
fi
VERSION="$1"
BUILD="$2"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
python3 Deployment/Tools/set_version.py "$VERSION" "$BUILD"
python3 Deployment/Tools/preflight.py
echo
echo "Release v$VERSION ist lokal vorbereitet."
echo "Dieses Skript committet, taggt, pusht und deployt ABSICHTLICH NICHT."
echo 'Nächste Schritte: Abschnitt "How to release" in README.md.'
