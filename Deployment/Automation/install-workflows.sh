#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$ROOT/.github/workflows"
cp "$(dirname "$0")"/workflows/*.yml "$ROOT/.github/workflows/"
echo "Workflows installiert nach $ROOT/.github/workflows"
echo 'Jetzt committen: git add .github/workflows Deployment && git commit -m "Add deployment automation"'
