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
    "Shared/www/index.html", "Shared/www/cube.html", "Shared/www/sudoku.html", "Shared/www/music.html",
    "Shared/www/cube.js", "Shared/www/solve.js", "Shared/www/sudoku-core.js", "Shared/www/music-app.js", "Shared/www/music-bundle.js", "Shared/www/music.css",
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
if "android.permission.INTERNET" not in android_manifest:
    errors.append("AndroidManifest enthält keine INTERNET-Berechtigung für den Musikfinder.")
main_activity = read("Android/app/src/main/java/de/matthiashauck/appsammlung/MainActivity.java")
if "isAllowedMusicHost" not in main_activity or "blockedNetworkResponse" not in main_activity:
    errors.append("Android-WebView enthält keine Netzwerktrennung für App 03.")

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


# Netzwerk-Trennung: Bibliothek, Zauberwürfel und Sudoku dürfen selbst keine externen API-Aufrufe starten.
for rel in ["Shared/www/index.html", "Shared/www/cube.html", "Shared/www/sudoku.html"]:
    text = read(rel)
    if "connect-src 'none'" not in text:
        errors.append(f"Offline-Seite hat keine connect-src 'none'-Sperre: {rel}")

for rel in ["Shared/www/cube-app.js", "Shared/www/sudoku-app.js", "Shared/www/sudoku-core.js"]:
    text = read(rel)
    if re.search(r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(", text):
        errors.append(f"Offline-App enthält direkten Netzwerkaufruf: {rel}")

music_html = read("Shared/www/music.html")
if "commons.wikimedia.org" not in music_html or "archive.org" not in music_html or "itunes.apple.com" not in music_html or "ccmixter.org" not in music_html or "api.freetouse.com" not in music_html:
    errors.append("Musikfinder-CSP enthält nicht alle freigegebenen Quellen.")
if "connect-src *" in music_html or "connect-src https:" in music_html:
    errors.append("Musikfinder-CSP ist zu weit gefasst.")
music_js = read("Shared/www/music-app.js")
for required_host in ["commons.wikimedia.org", "archive.org", "itunes.apple.com", "ccmixter.org", "api.freetouse.com"]:
    if required_host not in music_js:
        errors.append(f"Musikfinder-Quelle fehlt im Code: {required_host}")


if "const MAX_RESULTS = 3;" not in music_js:
    errors.append("Musikfinder-Einzelsuche ist nicht auf die drei günstigsten Treffer begrenzt.")
if "const MAX_BUNDLES = 3;" not in music_js:
    errors.append("Musikfinder-Titelliste ist nicht auf die drei günstigsten Bundles begrenzt.")
if "buildTopBundles" not in music_js:
    errors.append("Musikfinder verwendet die Bundle-Berechnung nicht.")
music_bundle_js = read("Shared/www/music-bundle.js")
if "function parseTrackList" not in music_bundle_js or "function buildTopBundles" not in music_bundle_js:
    errors.append("Musikfinder-Bundle-Core ist unvollständig.")
if "searchItunes" not in music_js or "trackPrice" not in music_js:
    errors.append("Kostenpflichtige Apple/iTunes-Angebote sind nicht eingebunden.")


for required_provider_fn in ["searchCcMixter", "searchFreeToUse", "searchItunes", "searchCommons", "searchArchive"]:
    if required_provider_fn not in music_js:
        errors.append(f"Musikfinder-Provider fehlt: {required_provider_fn}")

# In der Client-Implementierung dürfen keine persönlichen Provider-Zugangsdaten
# oder typische Secret-Konfigurationen eingeführt werden.
secret_patterns = [
    r"client[_-]?secret\s*[:=]",
    r"api[_-]?key\s*[:=]",
    r"bearer\s+[A-Za-z0-9._~-]{12,}",
    r"authorization\s*[:=]",
    r"oauth[_-]?(?:token|secret)\s*[:=]",
]
for pattern in secret_patterns:
    if re.search(pattern, music_js, re.I):
        errors.append(f"Musikfinder enthält mögliche persönliche Provider-Zugangsdaten: {pattern}")


if "searchYouTubeReference" not in music_js or "youtube.com/watch?v=" not in music_js:
    errors.append("Musikfinder enthält keine YouTube-Prüfreferenz.")
if "YOUTUBE_SEARCH_INSTANCES" not in music_js:
    errors.append("YouTube-Suche hat keine öffentlichen no-key Suchendpunkte.")
if "Direkt prüfen" not in music_js or "preview-btn" not in music_html:
    errors.append("Kostenlose Musiktreffer haben keinen direkten Prüf-Link.")
if "youtubeReference" not in music_js or "req.youtubeReference" not in music_js:
    errors.append("YouTube-Prüfreferenz fehlt in der Titellisten-/Bundle-Suche.")
if "www.youtube.com" not in read("Android/app/src/main/java/de/matthiashauck/appsammlung/MainActivity.java"):
    errors.append("Android-Allowlist enthält YouTube nicht.")
if "www.youtube.com" not in read("iOS/HauckisAppSammlung/LocalWebView.swift"):
    errors.append("iOS-Allowlist enthält YouTube nicht.")


# Erweiterte Suche des Musikfinders
for token in ["advanced-mode-btn", "advanced-title-btn", "advanced-artist-btn", "advanced-query-input"]:
    if token not in music_html:
        errors.append(f"Musikfinder: UI der erweiterten Suche fehlt: {token}")
for token in ["runAdvancedSearch", "runAdvancedDiscovery", "discoverItunes", "discoverYouTube", "professionalYouTubeChannel"]:
    if token not in music_js:
        errors.append(f"Musikfinder: Logik der erweiterten Suche fehlt: {token}")
if "authorVerified===true" not in music_js or "-\\s*Topic" not in music_js and "Topic$" not in music_js:
    errors.append("Musikfinder: YouTube-Profi-Filter der erweiterten Suche fehlt.")
if "result.items.length" not in music_js:
    errors.append("Musikfinder: erweiterte Suche scheint keine vollständige Ergebnisliste auszugeben.")


# YouTube-Suchlinks müssen nach einem Treffer die gefundene Schreibweise verwenden.
if "applyCanonicalYouTubeSearch" not in music_js or "canonicalTrackFromOffers" not in music_js:
    errors.append("Musikfinder: kanonische Schreibweise für YouTube-Suchlinks fehlt.")
if "ref.searchUrl=youtubeSearchUrl(canonical.title,canonical.artist)" not in music_js:
    errors.append("Musikfinder: YouTube-Such-URL wird nicht aus der gefundenen Schreibweise erzeugt.")
if "req.youtubeReference=applyCanonicalYouTubeSearch" not in music_js:
    errors.append("Musikfinder: korrigierte YouTube-Suchlinks fehlen in der Bundle-/Listensuche.")


# Internet Archive darf in der Musiksuche keine reinen Bild-/Scan-Funde liefern.
for token in ["archiveAudioFiles", "bestArchiveAudioFile", "mapWithConcurrency", "Internet Archive · Audio geprüft"]:
    if token not in music_js:
        errors.append(f"Musikfinder: Internet-Archive-Audioprüfung fehlt: {token}")
if "imageOnly=" not in music_js:
    errors.append("Musikfinder: Internet-Archive-Filter gegen reine Bild-/Coverdateien fehlt.")
if "sourceUrl:c.audioUrl" not in music_js:
    errors.append("Musikfinder: erweiterte Internet-Archive-Suche verlinkt nicht direkt auf validiertes Audio.")


# Quellenfilter für die erweiterte Suche
for source_id in ["itunes","freetouse","ccmixter","commons","archive","youtube"]:
    if f'data-advanced-source="{source_id}"' not in music_html:
        errors.append(f"Musikfinder: Quellenfilter fehlt: {source_id}")
for token in ["ADVANCED_SOURCE_DEFS","selectedAdvancedSources","setAllAdvancedSources","loadAdvancedSources"]:
    if token not in music_js:
        errors.append(f"Musikfinder: Quellenfilter-Logik fehlt: {token}")
if "Bitte mindestens eine Quelle für die erweiterte Suche auswählen." not in music_js:
    errors.append("Musikfinder: erweiterte Suche behandelt leere Quellenauswahl nicht.")


# Erweiterte Suche: mehrere Titel, einer pro Zeile.
if "<textarea id=\"advanced-query-input\"" not in music_html:
    errors.append("Musikfinder: Titel-Mehrfachsuche verwendet kein mehrzeiliges Eingabefeld.")
for token in ["parseAdvancedTitleQueries","renderMultiTitleDiscovery","Interpreten für alle Titel finden"]:
    if token not in music_js:
        errors.append(f"Musikfinder: Mehrfach-Titelsuche fehlt: {token}")
if "for(let i=0;i<queries.length;i++)" not in music_js:
    errors.append("Musikfinder: Mehrfach-Titelsuche verarbeitet die Titel nicht einzeln.")
if "if(i<queries.length-1) await sleep(220)" not in music_js:
    errors.append("Musikfinder: Mehrfach-Titelsuche drosselt lange Titellisten nicht.")

# PWA-Grundprüfung
manifest = read("Shared/www/manifest.webmanifest")
if FULL_NAME not in manifest:
    errors.append("PWA-Manifest enthält nicht den vollständigen App-Namen.")
if '"display": "standalone"' not in manifest:
    warnings.append("PWA-Manifest verwendet display=standalone nicht eindeutig.")

sw = read("Shared/www/sw.js")
if "const APP_VERSION" not in sw:
    errors.append("Service Worker enthält keine versionsgebundene Cache-ID.")
if "if (!sameOrigin)" not in sw:
    errors.append("Service Worker trennt externe Musikabfragen nicht vom lokalen PWA-Cache.")

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

# Musikfinder-Bundle-Regressionstest, wenn Node verfügbar ist.
if node:
    try:
        cp = subprocess.run([node, str(ROOT / "Deployment/Tools/test_music_bundle.js")], cwd=ROOT,
                            text=True, capture_output=True, timeout=30)
        if cp.returncode:
            errors.append("Musikfinder-Bundle-Test fehlgeschlagen: " + (cp.stderr.strip() or cp.stdout.strip()))
        else:
            print(cp.stdout.strip())
    except Exception as exc:
        errors.append(f"Musikfinder-Bundle-Test konnte nicht ausgeführt werden: {exc}")

for w in warnings: print("WARNUNG:", w)
for e in errors: print("FEHLER:", e)
if errors:
    print(f"\nPreflight FEHLGESCHLAGEN: {len(errors)} Fehler, {len(warnings)} Warnungen.")
    sys.exit(1)
print(f"\nPreflight OK: {len(warnings)} Warnungen.")
