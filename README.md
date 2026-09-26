# Hauckis möglicherweise nützliche App-Sammlung

Multiplattform-Projekt mit einer gemeinsamen lokalen App-Codebasis. Der bevorzugte Releaseweg ist eine installierbare PWA über GitHub Pages; native Android- und iOS-Hüllen bleiben als optionale Fallbacks erhalten.

## Aktuell enthalten

### App 01 – Zauberwürfel-Löser

- 3×3×3 über Kamera/Fotos erfassen
- Farben lokal erkennen und korrigieren
- Würfelzustand prüfen
- Lösung lokal berechnen und Schritt für Schritt anzeigen

### App 02 – Sudoku

- **Drei Schwierigkeitsstufen:** Leicht, Normal und Schwer. Normal entspricht der bisherigen Rätselstufe.
- **Sudoku des Tages:** Datum auswählbar; Datum + Schwierigkeitsstufe erzeugen deterministisch dasselbe Rätsel.
- **Leicht** und **Normal** werden auf genau eine Lösung geprüft; **Schwer** darf eine oder zwei Lösungen besitzen.
- **Zufälliges Sudoku** in allen drei Schwierigkeitsstufen.
- **Sudoku-Löser** für selbst eingegebene Vorgaben, auch wenn mehrere Lösungen möglich sind. In diesem Fall wird die erste aktuell mögliche Lösung bevorzugt.
- **Markiertes Feld lösen:** Ist ein bearbeitbares Feld ausgewählt, löst der Einzelschritt-Löser genau dieses Feld; andernfalls wird das nächste freie Feld verwendet.
- Tagesfortschritt wird pro Datum und Schwierigkeitsstufe lokal gespeichert.


### App 03 – Musikfinder

- Online-App: Suche nach kostenlosen, frei lizenzierten/Public-Domain-Musikdateien und kostenpflichtigen Kaufangeboten.
- Eingabe von Titel und Interpret.
- Fehlertoleranter Vergleich, damit kleinere Schreibfehler nicht sofort zu „kein Treffer“ führen.
- Aktuelle Download-/Kaufquellen: Wikimedia Commons, Internet Archive, ccMixter, Free To Use und Apple/iTunes Store.
- Internet-Archive-Treffer werden jetzt gegen die tatsächliche Dateiliste des Items geprüft. Ein Treffer wird nur übernommen, wenn mindestens eine echte Audio-Datei (z. B. MP3/FLAC/OGG/WAV/M4A/AAC/Opus) vorhanden ist; reine Cover-/Scan-/Bildfunde werden verworfen. In der erweiterten Suche führt der Prüflink direkt zur validierten Audiodatei.
- YouTube wird zusätzlich als reine Hör-/Prüfreferenz durchsucht. Die Suche läuft ohne persönliche Zugangsdaten über öffentliche Invidious-API-Instanzen; YouTube wird nicht als Downloadquelle und nicht in der Preisberechnung verwendet.
- YouTube-Suchlinks verwenden nach erfolgreichem Abgleich die tatsächlich gefundene Schreibweise von Titel und Interpret. Dadurch wird auch die YouTube-Suchleiste mit der korrigierten Schreibweise geöffnet und nicht mit möglichen Tippfehlern aus der Eingabe.
- Internet-Archive-Treffer werden nur berücksichtigt, wenn die Quelle eine explizite freie Lizenz/Public-Domain-Kennzeichnung liefert.
- Bei direkt lesbaren Dateien versucht die App zusätzlich, eingebettete Datei-Tags (u. a. ID3, FLAC/Vorbis, Ogg/Vorbis, WAV/INFO) mit Titel und Interpret abzugleichen.
- Bestätigte Tag-Widersprüche werden nicht als Downloadtreffer angeboten.
- Kostenlose Treffer erhalten zusätzlich einen direkten „Direkt prüfen“-Link auf die angebotene Audiodatei, damit der Inhalt vor dem Download kontrolliert werden kann; Kaufangebote führen zur jeweiligen Store-Seite.
- Bei einem Einzeltitel werden ausschließlich die drei günstigsten passenden Treffer ausgegeben; kostenlose Treffer haben dabei Preis 0.
- Alternativ kann eine ganze Titelliste eingegeben werden (`Titel | Interpret`, eine Zeile pro Song).
- Für Titellisten werden automatisch die drei günstigsten **vollständigen Bundles** berechnet. Jedes Bundle enthält genau ein Angebot pro gewünschtem Titel; Anbieter dürfen innerhalb eines Bundles gemischt werden.
- Doppelte Listeneinträge werden nur einmal berücksichtigt; fehlerhafte Zeilen werden vor der Suche gemeldet.
- Für Titellisten gibt es in der App kein festes Titel-Limit. Die Titel werden nacheinander verarbeitet, damit öffentliche Quellen nicht mit Request-Spitzen belastet werden; entsprechend dauern lange Listen länger.
- Anbieter-Regel: Keine Quelle wird eingebunden, wenn API-Key, Client-ID, OAuth, Login oder andere persönliche Zugangsdaten erforderlich sind.

## Projektstruktur

- `Shared/www/` – gemeinsame App-Oberfläche und gesamte Fachlogik.
- `Android/` – optionale native Android-WebView-Hülle, Paket `de.matthiashauck.appsammlung`.
- `iOS/` – optionale native SwiftUI/WKWebView-Hülle, Bundle-ID `de.matthiashauck.appsammlung`.
- `Deployment/` – ausschließlich manuell startbare Prüf-, Build- und Release-Workflows, Datenschutz und Release-Plan.

Neue Mini-Apps werden grundsätzlich in `Shared/www/` ergänzt.

## Lokalität und Netzwerk-Trennung

App 01 (Zauberwürfel) und App 02 (Sudoku) bleiben vollständig lokal und erhalten per Content-Security-Policy keinen API-/Netzwerkzugriff. App 03 (Musikfinder) ist ausdrücklich als Online-App markiert und darf nur auf die fest freigegebenen Musikquellen zugreifen.

Die PWA-Dateien selbst werden weiterhin über GitHub Pages geladen und offline gecacht. Externe Antworten des Musikfinders werden vom Service Worker bewusst **nicht** gecacht. Es gibt keinen eigenen Backend-Server.

## Entwicklung und GitHub Actions

**Es gibt keinerlei automatisch gestartete GitHub Action.** Ein normaler Push, Pull Request oder Tag startet weder Preflight noch Build noch Deployment. Alle Workflow-Dateien verwenden ausschließlich `workflow_dispatch` und müssen in GitHub unter **Actions → Run workflow** von Hand gestartet werden.

Für eine lokale Prüfung kann jederzeit bewusst ausgeführt werden:

```bash
python Deployment/Tools/preflight.py
```

Der Workflow **Manual checks Android + iOS** ist ebenfalls rein manuell und baut nur Testartefakte; er veröffentlicht nichts.

## How to release

Ein Release ist absichtlich ein manueller Vorgang. **Weder ein normaler Push noch das Anlegen/Pushen eines Tags deployt automatisch.** Der Release-Workflow muss anschließend in GitHub Actions ausdrücklich per **Run workflow** gestartet und mit dem gewünschten Version-Tag bestätigt werden.

### 1. Version lokal vorbereiten

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File Deployment/Tools/release.ps1 -Version 1.3.0 -BuildNumber 22
```

macOS/Linux:

```bash
Deployment/Tools/release.sh 1.3.0 15
```

Das Skript setzt die gemeinsame Version und führt den Preflight aus. Es führt **kein** `git commit`, `git tag`, `git push` oder Deployment aus.

### 2. Änderungen prüfen und committen

```bash
git status
git diff
git add .
git commit -m "Release v1.3.0"
git push origin main
```

Der Push auf `main` löst **keine** GitHub Action aus.

### 3. Version-Tag bewusst von Hand anlegen

```bash
git tag -a v1.3.0 -m "Hauckis App-Sammlung v1.3.0"
git push origin v1.3.0
```

Auch dieser Tag-Push startet **kein** Release.

### 4. PWA manuell veröffentlichen

Auf GitHub:

1. Repository öffnen.
2. **Actions** öffnen.
3. Workflow **Release PWA manually** auswählen.
4. **Run workflow** wählen.
5. Bei `version_tag` exakt `v1.3.0` eintragen.
6. Workflow manuell starten.

Der Workflow checkt exakt diesen Tag aus, prüft, dass `VERSION` dazu passt, führt den Preflight aus und veröffentlicht erst danach `Shared/www/` nach GitHub Pages.

### 5. Optional: native Android-/iOS-Artefakte bauen

Falls irgendwann nötig: **Actions → Build native Android + iOS manually → Run workflow** und denselben `version_tag` angeben. Store-Uploads sind standardmäßig aus und benötigen eine zusätzliche bewusste Auswahl.

## Sicherheitsprinzip für Releases

- Push auf `main`: **kein Deployment**.
- Push eines `v*`-Tags: **kein Deployment**.
- Zeitplan/Cron: **nicht vorhanden**.
- PWA-Release: nur per manuellem GitHub-Actions-Start mit vorhandenem Version-Tag.
- Native Releases: ebenfalls nur manuell.

## Version

Aktueller Projektstand: **1.3.0 / Build 22**.
