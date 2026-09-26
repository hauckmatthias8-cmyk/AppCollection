#!/usr/bin/env python3
from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def die(msg: str):
    print(f"FEHLER: {msg}", file=sys.stderr)
    raise SystemExit(1)

if len(sys.argv) != 3:
    die("Aufruf: python Deployment/Tools/set_version.py <MAJOR.MINOR.PATCH> <BUILDNUMMER>")

version = sys.argv[1].strip()
if not re.fullmatch(r"\d+\.\d+\.\d+", version):
    die("Version muss MAJOR.MINOR.PATCH entsprechen, z. B. 1.2.0")
try:
    build = int(sys.argv[2])
except ValueError:
    die("Buildnummer muss eine positive Ganzzahl sein.")
if build < 1:
    die("Buildnummer muss >= 1 sein.")

android = ROOT / "Android/app/build.gradle"
s = android.read_text(encoding="utf-8")
s2, n1 = re.subn(r"versionCode\s+\d+", f"versionCode {build}", s, count=1)
s2, n2 = re.subn(r"versionName\s+'[^']+'", f"versionName '{version}'", s2, count=1)
if n1 != 1 or n2 != 1:
    die("Android-Version konnte nicht eindeutig aktualisiert werden.")
android.write_text(s2, encoding="utf-8")

pbx = ROOT / "iOS/HauckisAppSammlung.xcodeproj/project.pbxproj"
s = pbx.read_text(encoding="utf-8")
s, n1 = re.subn(r"CURRENT_PROJECT_VERSION = \d+;", f"CURRENT_PROJECT_VERSION = {build};", s)
s, n2 = re.subn(r"MARKETING_VERSION = [^;]+;", f"MARKETING_VERSION = {version};", s)
if n1 < 2 or n2 < 2:
    die("iOS-Version konnte nicht in Debug und Release aktualisiert werden.")
pbx.write_text(s, encoding="utf-8")


# PWA-Version / Service-Worker-Cache aktualisieren.
sw = ROOT / "Shared/www/sw.js"
s = sw.read_text(encoding="utf-8")
s2, n = re.subn(r'''const APP_VERSION = ['\"][^'\"]+['\"];''', f"const APP_VERSION = '{version}';", s, count=1)
if n != 1:
    die("PWA-Service-Worker-Version konnte nicht aktualisiert werden.")
sw.write_text(s2, encoding="utf-8")

import json
(ROOT / "Shared/www/version.json").write_text(json.dumps({"version": version, "build": build}, indent=2) + "\n", encoding="utf-8")

(ROOT / "VERSION").write_text(version + "\n", encoding="utf-8")
print(f"Version gesetzt: {version} (Build {build})")
