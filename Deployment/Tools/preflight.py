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
    "Shared/www/index.html", "Shared/www/cube.html", "Shared/www/sudoku.html", "Shared/www/music.html", "Shared/www/crossword.html",
    "Shared/www/cube.js", "Shared/www/solve.js", "Shared/www/sudoku-core.js", "Shared/www/music-app.js", "Shared/www/music-bundle.js", "Shared/www/music.css",
    "Shared/www/crossword-core.js", "Shared/www/crossword-app.js", "Shared/www/crossword.css", "Shared/www/crossword-data.js",
    "Crossword/data/crossword_catalog.tsv", "Crossword/data/solution_words.txt", "Crossword/data/sources.json",
    "Crossword/data/catalog_stats.json",
    "Deployment/Tools/validate_crossword_catalog.py", "Deployment/Tools/validate_crossword_catalog.py",
    "LICENSE", "NOTICE", "Shared/www/LICENSE.txt", "Shared/www/NOTICE.txt", "Shared/www/licenses.html", "Shared/www/privacy.html",
    "Android/app/src/main/AndroidManifest.xml", "Android/app/build.gradle",
    "iOS/HauckisAppSammlung/Info.plist",
    "iOS/HauckisAppSammlung.xcodeproj/project.pbxproj",
    "Deployment/Store/privacy-policy.html",
    "Shared/www/manifest.webmanifest", "Shared/www/sw.js", "Shared/www/pwa.js", "Shared/www/install-guide.js",
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
# Normale <a href="https://…">-Navigationslinks sind erlaubt; sie laden beim Seitenstart nichts nach.
for html in (ROOT / "Shared/www").glob("*.html"):
    text = html.read_text(encoding="utf-8", errors="replace")
    if (re.search(r'''\bsrc\s*=\s*["']https?://''', text, flags=re.I) or
        re.search(r'''<link\b[^>]*\bhref\s*=\s*["']https?://''', text, flags=re.I)):
        errors.append(f"Externe Laufzeit-Ressource gefunden: {html.relative_to(ROOT)}")


# Netzwerk-Trennung: Bibliothek, Zauberwürfel und Sudoku dürfen selbst keine externen API-Aufrufe starten.
for rel in ["Shared/www/index.html", "Shared/www/cube.html", "Shared/www/sudoku.html", "Shared/www/crossword.html"]:
    text = read(rel)
    if "connect-src 'none'" not in text:
        errors.append(f"Offline-Seite hat keine connect-src 'none'-Sperre: {rel}")

for rel in ["Shared/www/cube-app.js", "Shared/www/sudoku-app.js", "Shared/www/sudoku-core.js", "Shared/www/crossword-app.js", "Shared/www/crossword-core.js"]:
    text = read(rel)
    if re.search(r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(", text):
        errors.append(f"Offline-App enthält direkten Netzwerkaufruf: {rel}")

music_html = read("Shared/www/music.html")
if "commons.wikimedia.org" not in music_html or "archive.org" not in music_html or "itunes.apple.com" not in music_html or "ccmixter.org" not in music_html or "api.freetouse.com" not in music_html:
    errors.append("Musikfinder-CSP enthält nicht alle freigegebenen Quellen.")
if "connect-src *" in music_html or "connect-src https:" in music_html:
    errors.append("Musikfinder-CSP ist zu weit gefasst.")
music_js = read("Shared/www/music-app.js")
android_main = read("Android/app/src/main/java/de/matthiashauck/appsammlung/MainActivity.java")
ios_webview = read("iOS/HauckisAppSammlung/LocalWebView.swift")
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


# YouTube darf ausschließlich über nutzerinitiierte normale Suchlinks geöffnet werden.
for forbidden in ["YOUTUBE_SEARCH_INSTANCES","searchYouTubeReference","discoverYouTube","professionalYouTubeChannel","invidious.nerdvpn.de","inv.nadeko.net","yt.chocolatemoo53.com","invidious.tiekoetter.com"]:
    if forbidden in music_js or forbidden in music_html:
        errors.append(f"Musikfinder: unerlaubte automatische/inoffizielle YouTube-Suche noch vorhanden: {forbidden}")
for token in ["youtubeSearchUrl","youtubeMusicSearchUrl","buildYouTubeReference","YouTube-Suche öffnen","YouTube Music suchen"]:
    if token not in music_js:
        errors.append(f"Musikfinder: nutzerinitiierter YouTube-Suchlink fehlt: {token}")
if 'data-advanced-source="youtube"' in music_html:
    errors.append("Musikfinder: YouTube darf nicht mehr als automatische Discovery-Quelle auswählbar sein.")
if "music.youtube.com" not in android_main or "music.youtube.com" not in ios_webview:
    errors.append("Native Allowlist enthält YouTube Music nicht.")
if "youtube.com" not in android_main or "youtube.com" not in ios_webview:
    errors.append("Native Allowlist enthält YouTube nicht.")

# Lizenz-/Quellenhinweise müssen öffentlich erreichbar sein.
licenses_html = read("Shared/www/licenses.html")
for token in ["Apache License 2.0","cube.js 1.3.2","vom Projektinhaber bereitgestellten eigenen Sammlung","YouTube/YouTube Music"]:
    if token not in licenses_html:
        errors.append(f"Lizenzseite unvollständig: {token}")
if 'href="licenses.html"' not in index:
    errors.append("Startseite verlinkt Lizenzen & Quellen nicht.")
if not (ROOT / "LICENSE").exists() or not (ROOT / "Shared/www/LICENSE.txt").exists():
    errors.append("Apache-2.0-Lizenz fehlt im Source oder Publish-Paket.")

# Internet Archive darf in der Musiksuche keine reinen Bild-/Scan-Funde liefern.
for token in ["archiveAudioFiles", "bestArchiveAudioFile", "mapWithConcurrency", "Internet Archive · Audio geprüft"]:
    if token not in music_js:
        errors.append(f"Musikfinder: Internet-Archive-Audioprüfung fehlt: {token}")
if "imageOnly=" not in music_js:
    errors.append("Musikfinder: Internet-Archive-Filter gegen reine Bild-/Coverdateien fehlt.")
if "sourceUrl:c.audioUrl" not in music_js:
    errors.append("Musikfinder: erweiterte Internet-Archive-Suche verlinkt nicht direkt auf validiertes Audio.")


# Quellenfilter für die erweiterte Suche
for source_id in ["itunes","freetouse","ccmixter","commons","archive"]:
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


# App 04 – Kreuzworträtsel
crossword_html = read("Shared/www/crossword.html")
crossword_js = read("Shared/www/crossword-app.js")
crossword_core = read("Shared/www/crossword-core.js")
if "APP 04" not in index or 'href="crossword.html"' not in index:
    errors.append("App 04 fehlt in der Bibliothek.")
if "connect-src 'none'" not in crossword_html:
    errors.append("Kreuzworträtsel ist nicht hart auf Offline-Betrieb begrenzt.")
for token in ["15 × 20","20 × 30","Rätsel des Tages","zoom-in","zoom-out"]:
    if token not in crossword_html:
        errors.append(f"Kreuzworträtsel-UI fehlt: {token}")
for token in ["generatePuzzle","chooseSolutionMarks","puzzleSignature"]:
    if token not in crossword_core:
        errors.append(f"Kreuzworträtsel-Core fehlt: {token}")
for token in ["daily|","fitZoom","solution-progress","crossword.progress."]:
    if token not in crossword_js and token not in crossword_html:
        errors.append(f"Kreuzworträtsel-App fehlt: {token}")

# Klartext bleibt im Source, aber nicht im veröffentlichten Shared/www.
for forbidden_name in ["crossword_catalog.tsv","solution_words.txt"]:
    if (ROOT / "Shared/www" / forbidden_name).exists():
        errors.append(f"Klartext-Kreuzworträtseldaten liegen im Publish-Verzeichnis: {forbidden_name}")
packed = read("Shared/www/crossword-data.js")
if not packed.startswith("// Generated by Deployment/Tools/build_crossword_data.py"):
    errors.append("Gepackter Kreuzworträtsel-Datencontainer fehlt oder ist nicht generiert.")
if "\tclue\t" in packed or "SCHMETTERLING\n" in packed:
    errors.append("Kreuzworträtsel-Datencontainer scheint Klartext zu enthalten.")

try:
    cp = subprocess.run([sys.executable, str(ROOT / "Deployment/Tools/validate_crossword_catalog.py")],
                        cwd=ROOT, text=True, capture_output=True, timeout=30)
    if cp.returncode:
        errors.append("Kreuzworträtsel-Katalogprüfung fehlgeschlagen: " + (cp.stderr.strip() or cp.stdout.strip()))
    else:
        print(cp.stdout.strip())
except Exception as exc:
    errors.append(f"Kreuzworträtsel-Katalogprüfung konnte nicht ausgeführt werden: {exc}")

# Der veröffentlichte Großkatalog soll bewusst im Zielbereich bleiben.
try:
    import csv as _csv
    with (ROOT / "Crossword/data/crossword_catalog.tsv").open(encoding="utf-8", newline="") as _f:
        _rows = list(_csv.DictReader(_f, delimiter="\t"))
    if len(_rows) != 7367:
        errors.append(f"Kreuzworträtsel-Katalog muss exakt 7.367 Einträge enthalten: {len(_rows)}")
    _seen=set(); _dups=0
    for _r in _rows:
        _k=(re.sub(r"[^A-Z]", "", (_r.get("answer") or "").upper()), " ".join((_r.get("clue") or "").split()).casefold())
        if _k in _seen: _dups += 1
        else: _seen.add(_k)
    if _dups:
        errors.append(f"Kreuzworträtsel-Katalog enthält {_dups} doppelte Frage-Antwort-Paare.")
except Exception as exc:
    errors.append(f"Kreuzworträtsel-Duplikatprüfung konnte nicht ausgeführt werden: {exc}")

try:
    cp = subprocess.run([sys.executable, str(ROOT / "Deployment/Tools/build_crossword_data.py"), "--check"],
                        cwd=ROOT, text=True, capture_output=True, timeout=30)
    if cp.returncode:
        errors.append("Kreuzworträtsel-Datenpaket ist veraltet: " + (cp.stderr.strip() or cp.stdout.strip()))
    else:
        print(cp.stdout.strip())
except Exception as exc:
    errors.append(f"Kreuzworträtsel-Datenprüfung konnte nicht ausgeführt werden: {exc}")

# Keine Invidious-/Proxy-Hosts in CSP oder nativem Code.
for forbidden in ["inv.nadeko.net","invidious.nerdvpn.de","yt.chocolatemoo53.com","invidious.tiekoetter.com"]:
    for rel in ["Shared/www/music.html","Shared/www/music-app.js","Android/app/src/main/java/de/matthiashauck/appsammlung/MainActivity.java","iOS/HauckisAppSammlung/LocalWebView.swift"]:
        if forbidden in read(rel): errors.append(f"Inoffizieller YouTube-Proxy noch vorhanden in {rel}: {forbidden}")
if "connect-src 'none'" not in licenses_html:
    errors.append("Lizenzseite ist nicht vollständig lokal.")

# Datenschutzseite muss den aktuellen Netzwerkfluss korrekt beschreiben.
privacy_html = read("Shared/www/privacy.html")
if "Invidious" in privacy_html:
    errors.append("Datenschutzerklärung nennt noch entfernte Invidious-Dienste.")
for token in ["Wikimedia Commons","Internet Archive","ccMixter","Free To Use","Apple/iTunes Store","YouTube und YouTube Music werden nicht automatisch abgefragt"]:
    if token not in privacy_html:
        errors.append(f"Datenschutzerklärung unvollständig: {token}")
if 'href="privacy.html"' not in index:
    errors.append("Startseite verlinkt die Datenschutzerklärung nicht.")
if "connect-src 'none'" not in privacy_html:
    errors.append("Datenschutzseite ist nicht vollständig lokal.")

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


# Animierte Installationsanleitung auf der Startseite.
install_js = read("Shared/www/install-guide.js")
for token in ['id="install-title"','data-platform="ios"','data-platform="android"','Zum Home-Bildschirm','App installieren']:
    if token not in index:
        errors.append(f"PWA-Installationsanleitung fehlt: {token}")
for token in ['beforeinstallprompt','data-step','setInterval','appinstalled']:
    if token not in install_js:
        errors.append(f"PWA-Installationsanimation/-logik fehlt: {token}")
if "'./install-guide.js'" not in sw:
    errors.append("Installationsanleitung ist nicht im PWA-Precache enthalten.")

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


# Kreuzworträtsel-Regressionstest, wenn Node verfügbar ist.
if node:
    try:
        cp = subprocess.run([node, str(ROOT / "Deployment/Tools/test_crossword.js")], cwd=ROOT,
                            text=True, capture_output=True, timeout=90)
        if cp.returncode:
            errors.append("Kreuzworträtsel-Test fehlgeschlagen: " + (cp.stderr.strip() or cp.stdout.strip()))
        else:
            print(cp.stdout.strip())
    except Exception as exc:
        errors.append(f"Kreuzworträtsel-Test konnte nicht ausgeführt werden: {exc}")

for w in warnings: print("WARNUNG:", w)
for e in errors: print("FEHLER:", e)
if errors:
    print(f"\nPreflight FEHLGESCHLAGEN: {len(errors)} Fehler, {len(warnings)} Warnungen.")
    sys.exit(1)
print(f"\nPreflight OK: {len(warnings)} Warnungen.")
