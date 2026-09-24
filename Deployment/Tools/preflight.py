#!/usr/bin/env python3
from __future__ import annotations
import re, shutil, subprocess, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FULL_NAME = "Hauckis möglicherweise nützliche App-Sammlung"
STORE_NAME = "Hauckis App-Sammlung"
errors: list[str] = []
warnings: list[str] = []

def read(rel: str) -> str:
    p = ROOT / rel
    if not p.exists():
        errors.append(f"Fehlt: {rel}")
        return ""
    return p.read_text(encoding="utf-8", errors="replace")

required = [
    "Shared/www/index.html", "Shared/www/cube.html", "Shared/www/sudoku.html",
    "Shared/www/cube.js", "Shared/www/solve.js", "Shared/www/sudoku-core.js",
    "Android/app/src/main/AndroidManifest.xml", "Android/app/build.gradle",
    "iOS/HauckisAppSammlung/Info.plist",
    "iOS/HauckisAppSammlung.xcodeproj/project.pbxproj",
    "Deployment/Store/privacy-policy.html",
    "Shared/www/manifest.webmanifest", "Shared/www/sw.js", "Shared/www/pwa.js",
    ".github/workflows/deploy-pages.yml", "Deployment/DOCUMENTATION_POLICY.md",
]
for rel in required:
    if not (ROOT / rel).exists(): errors.append(f"Fehlt: {rel}")

index = read("Shared/www/index.html")
if FULL_NAME not in index: errors.append("Vollständiger App-Name fehlt auf dem Startbildschirm.")

android_manifest = read("Android/app/src/main/AndroidManifest.xml")
if "android.permission.INTERNET" in android_manifest:
    errors.append("AndroidManifest enthält INTERNET-Berechtigung; aktuelle App soll offline bleiben.")

strings = read("Android/app/src/main/res/values/strings.xml")
if FULL_NAME not in strings: errors.append("Android-App-Name stimmt nicht.")

plist = read("iOS/HauckisAppSammlung/Info.plist")
if FULL_NAME not in plist: errors.append("iOS-Anzeigename stimmt nicht.")
if "$(MARKETING_VERSION)" not in plist or "$(CURRENT_PROJECT_VERSION)" not in plist:
    errors.append("iOS Info.plist verwendet nicht die zentralen Build-Versionen.")

wv = read("iOS/HauckisAppSammlung/LocalWebView.swift")
if "decisionHandler(.cancel)" not in wv:
    warnings.append("Externe iOS-Webnavigation scheint nicht explizit blockiert zu werden.")

# Keine extern geladenen Laufzeit-Ressourcen in den eigentlichen App-HTML-Dateien.
for html in (ROOT / "Shared/www").glob("*.html"):
    text = html.read_text(encoding="utf-8", errors="replace")
    if re.search(r'''(?:src|href)\s*=\s*["']https?://''', text, flags=re.I):
        errors.append(f"Externe Laufzeit-Ressource gefunden: {html.relative_to(ROOT)}")

# PWA-Grundprüfung
manifest = read("Shared/www/manifest.webmanifest")
if FULL_NAME not in manifest:
    errors.append("PWA-Manifest enthält nicht den vollständigen App-Namen.")
if '"display": "standalone"' not in manifest:
    warnings.append("PWA-Manifest verwendet display=standalone nicht eindeutig.")

sw = read("Shared/www/sw.js")
if "const APP_VERSION" not in sw:
    errors.append("Service Worker enthält keine versionsgebundene Cache-ID.")

# Persönliche UI-Texte dürfen nicht in öffentliche Dokumentation kopiert werden.
class _PrivateTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.buf = []
        self.values = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.depth:
            self.depth += 1
        elif attrs.get("data-doc-private") == "true":
            self.depth = 1
            self.buf = []
    def handle_endtag(self, tag):
        if self.depth:
            self.depth -= 1
            if self.depth == 0:
                value = " ".join("".join(self.buf).split())
                if value:
                    self.values.append(value)
                self.buf = []
    def handle_data(self, data):
        if self.depth:
            self.buf.append(data)

private_values = []
for html in (ROOT / "Shared/www").glob("*.html"):
    parser = _PrivateTextParser()
    parser.feed(html.read_text(encoding="utf-8", errors="replace"))
    private_values.extend(parser.values)

doc_files = [ROOT / "README.md", ROOT / "Android/README.md", ROOT / "iOS/README.md"]
doc_files += [p for p in (ROOT / "Deployment").rglob("*") if p.is_file() and p.suffix.lower() in {".md", ".html", ".txt", ".yml", ".yaml", ".json"}]
for doc in doc_files:
    text = doc.read_text(encoding="utf-8", errors="replace")
    for private_text in private_values:
        if private_text in text:
            errors.append(f"Privater UI-Text wurde in öffentliche Dokumentation kopiert: {doc.relative_to(ROOT)}")


# GitHub-Actions-Sicherheitsregel: JEDER Workflow muss ausschließlich manuell startbar sein.
# Damit führt weder Push, Pull Request, Tag, Zeitplan noch ein anderer Workflow automatisch etwas aus.
auto_trigger_patterns = {
    "push": r"(?m)^\s*push\s*:",
    "pull_request": r"(?m)^\s*pull_request\s*:",
    "pull_request_target": r"(?m)^\s*pull_request_target\s*:",
    "schedule": r"(?m)^\s*schedule\s*:",
    "workflow_run": r"(?m)^\s*workflow_run\s*:",
    "repository_dispatch": r"(?m)^\s*repository_dispatch\s*:",
}
workflow_files = list((ROOT / ".github/workflows").glob("*.yml")) + list((ROOT / ".github/workflows").glob("*.yaml"))
workflow_files += list((ROOT / "Deployment/Automation/workflows").glob("*.yml")) + list((ROOT / "Deployment/Automation/workflows").glob("*.yaml"))
for path in workflow_files:
    rel = str(path.relative_to(ROOT)).replace("\\", "/")
    wf = path.read_text(encoding="utf-8", errors="replace")
    for trigger, pattern in auto_trigger_patterns.items():
        if re.search(pattern, wf):
            errors.append(f"Workflow enthält verbotenen automatischen Trigger '{trigger}': {rel}")
    if "workflow_dispatch" not in wf:
        errors.append(f"Workflow ist nicht explizit manuell startbar: {rel}")

for rel in ["Deployment/Tools/release.ps1", "Deployment/Tools/release.sh"]:
    helper = read(rel)
    if re.search(r"(?im)^\s*git\s+push\b", helper):
        errors.append(f"Release-Hilfsskript darf nicht selbst pushen: {rel}")

# Versionsabgleich
version = read("VERSION").strip()
m_sw = re.search(r'const APP_VERSION = [\'"]([^\'"]+)[\'"]', sw)
if not m_sw or m_sw.group(1) != version:
    errors.append("Service-Worker-Version stimmt nicht mit VERSION überein.")
version_json = read("Shared/www/version.json")
if f'"version": "{version}"' not in version_json:
    errors.append("Shared/www/version.json stimmt nicht mit VERSION überein.")
gradle = read("Android/app/build.gradle")
pbx = read("iOS/HauckisAppSammlung.xcodeproj/project.pbxproj")
m = re.search(r"versionName\s+'([^']+)'", gradle)
if not m or m.group(1) != version: errors.append("Android versionName stimmt nicht mit VERSION überein.")
versions = set(re.findall(r"MARKETING_VERSION = ([^;]+);", pbx))
if versions != {version}: errors.append(f"iOS MARKETING_VERSION stimmt nicht mit VERSION überein: {versions}")

if len(STORE_NAME) > 30:
    errors.append("Store-Titel ist länger als 30 Zeichen.")

privacy = read("Deployment/Store/privacy-policy.html")
if "DEINE_EMAILADRESSE" in privacy:
    errors.append("Datenschutzseite enthält noch den Platzhalter DEINE_EMAILADRESSE.")
if "hauckmatthias8@gmail.com" not in privacy:
    errors.append("Öffentliche Kontaktadresse fehlt in der Datenschutzseite.")

# Sudoku-Regressionstest, wenn Node verfügbar ist.
node = shutil.which("node")
if node:
    try:
        cp = subprocess.run([node, str(ROOT / "Deployment/Tools/test_sudoku.js")], cwd=ROOT,
                            text=True, capture_output=True, timeout=60)
        if cp.returncode:
            errors.append("Sudoku-Test fehlgeschlagen: " + (cp.stderr.strip() or cp.stdout.strip()))
        else:
            print(cp.stdout.strip())
    except Exception as exc:
        errors.append(f"Sudoku-Test konnte nicht ausgeführt werden: {exc}")
else:
    warnings.append("Node.js nicht gefunden; automatischer Sudoku-Regressionstest wurde übersprungen.")

for w in warnings: print("WARNUNG:", w)
for e in errors: print("FEHLER:", e)
if errors:
    print(f"\nPreflight FEHLGESCHLAGEN: {len(errors)} Fehler, {len(warnings)} Warnungen.")
    sys.exit(1)
print(f"\nPreflight OK: {len(warnings)} Warnungen.")
