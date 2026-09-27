# Hauckis mÃ¶glicherweise nÃ¼tzliche App-Sammlung

Multiplattform-Projekt mit einer gemeinsamen lokalen App-Codebasis. Der bevorzugte Releaseweg ist eine installierbare PWA Ã¼ber GitHub Pages; native Android- und iOS-HÃ¼llen bleiben als optionale Fallbacks erhalten.

## Aktuell enthalten

### App 01 â€“ ZauberwÃ¼rfel-LÃ¶ser

- 3Ã—3Ã—3 Ã¼ber Kamera/Fotos erfassen
- Farben lokal erkennen und korrigieren
- WÃ¼rfelzustand prÃ¼fen
- LÃ¶sung lokal berechnen und Schritt fÃ¼r Schritt anzeigen

### App 02 â€“ Sudoku

- **Drei Schwierigkeitsstufen:** Leicht, Normal und Schwer. Normal entspricht der bisherigen RÃ¤tselstufe.
- **Sudoku des Tages:** Datum auswÃ¤hlbar; Datum + Schwierigkeitsstufe erzeugen deterministisch dasselbe RÃ¤tsel.
- **Leicht** und **Normal** werden auf genau eine LÃ¶sung geprÃ¼ft; **Schwer** darf eine oder zwei LÃ¶sungen besitzen.
- **ZufÃ¤lliges Sudoku** in allen drei Schwierigkeitsstufen.
- **Sudoku-LÃ¶ser** fÃ¼r selbst eingegebene Vorgaben, auch wenn mehrere LÃ¶sungen mÃ¶glich sind. In diesem Fall wird die erste aktuell mÃ¶gliche LÃ¶sung bevorzugt.
- **Markiertes Feld lÃ¶sen:** Ist ein bearbeitbares Feld ausgewÃ¤hlt, lÃ¶st der Einzelschritt-LÃ¶ser genau dieses Feld; andernfalls wird das nÃ¤chste freie Feld verwendet.
- Tagesfortschritt wird pro Datum und Schwierigkeitsstufe lokal gespeichert.


### App 03 â€“ Musikfinder

- Online-App: Suche nach kostenlosen, frei lizenzierten/Public-Domain-Musikdateien und kostenpflichtigen Kaufangeboten.
- Eingabe von Titel und Interpret.
- Fehlertoleranter Vergleich, damit kleinere Schreibfehler nicht sofort zu â€žkein Trefferâ€œ fÃ¼hren.
- Aktuelle Download-/Kaufquellen: Wikimedia Commons, Internet Archive, ccMixter, Free To Use und Apple/iTunes Store.
- Internet-Archive-Treffer werden jetzt gegen die tatsÃ¤chliche Dateiliste des Items geprÃ¼ft. Ein Treffer wird nur Ã¼bernommen, wenn mindestens eine echte Audio-Datei (z. B. MP3/FLAC/OGG/WAV/M4A/AAC/Opus) vorhanden ist; reine Cover-/Scan-/Bildfunde werden verworfen. In der erweiterten Suche fÃ¼hrt der PrÃ¼flink direkt zur validierten Audiodatei.
- YouTube/YouTube Music werden nicht automatisch abgefragt. Die App erzeugt ausschließlich nutzerinitiierte normale Suchlinks aus bereits über die freigegebenen Musikkataloge ermittelten Titel-/Interpret-Metadaten.
- YouTube-Suchlinks verwenden nach erfolgreichem Abgleich die tatsÃ¤chlich gefundene Schreibweise von Titel und Interpret. Dadurch wird auch die YouTube-Suchleiste mit der korrigierten Schreibweise geÃ¶ffnet und nicht mit mÃ¶glichen Tippfehlern aus der Eingabe.
- Internet-Archive-Treffer werden nur berÃ¼cksichtigt, wenn die Quelle eine explizite freie Lizenz/Public-Domain-Kennzeichnung liefert.
- Bei direkt lesbaren Dateien versucht die App zusÃ¤tzlich, eingebettete Datei-Tags (u. a. ID3, FLAC/Vorbis, Ogg/Vorbis, WAV/INFO) mit Titel und Interpret abzugleichen.
- BestÃ¤tigte Tag-WidersprÃ¼che werden nicht als Downloadtreffer angeboten.
- Kostenlose Treffer erhalten zusÃ¤tzlich einen direkten â€žDirekt prÃ¼fenâ€œ-Link auf die angebotene Audiodatei, damit der Inhalt vor dem Download kontrolliert werden kann; Kaufangebote fÃ¼hren zur jeweiligen Store-Seite.
- Bei einem Einzeltitel werden ausschlieÃŸlich die drei gÃ¼nstigsten passenden Treffer ausgegeben; kostenlose Treffer haben dabei Preis 0.
- Alternativ kann eine ganze Titelliste eingegeben werden (`Titel | Interpret`, eine Zeile pro Song).
- FÃ¼r Titellisten werden automatisch die drei gÃ¼nstigsten **vollstÃ¤ndigen Bundles** berechnet. Jedes Bundle enthÃ¤lt genau ein Angebot pro gewÃ¼nschtem Titel; Anbieter dÃ¼rfen innerhalb eines Bundles gemischt werden.
- Doppelte ListeneintrÃ¤ge werden nur einmal berÃ¼cksichtigt; fehlerhafte Zeilen werden vor der Suche gemeldet.
- FÃ¼r Titellisten gibt es in der App kein festes Titel-Limit. Die Titel werden nacheinander verarbeitet, damit Ã¶ffentliche Quellen nicht mit Request-Spitzen belastet werden; entsprechend dauern lange Listen lÃ¤nger.
- Anbieter-Regel: Keine Quelle wird eingebunden, wenn API-Key, Client-ID, OAuth, Login oder andere persÃ¶nliche Zugangsdaten erforderlich sind.


### App 04 â€“ KreuzwortrÃ¤tsel

- VollstÃ¤ndig lokal; `connect-src 'none'`.
- Zwei GrÃ¶ÃŸen: **Normal 15 Ã— 20** und **GroÃŸ 20 Ã— 30**.
- ZufÃ¤lliges KreuzwortrÃ¤tsel.
- **KreuzwortrÃ¤tsel des Tages**: FÃ¼r Datum + GrÃ¶ÃŸe + Katalogversion wird deterministisch immer dasselbe RÃ¤tsel erzeugt.
- LÃ¶sungswort aus einer kuratierten Liste real existierender WÃ¶rter mit **10â€“20 Buchstaben**. Die nummerierten Einzelfelder im Raster ergeben das LÃ¶sungswort.
- Zoom `âˆ’ / Einpassen / +` fÃ¼r groÃŸe Raster.
- Klickbare waagerechte und senkrechte Fragen, Tastatureingabe und lokale Fortschrittsspeicherung.
- Fragenkatalog und LÃ¶sungswortliste liegen im Source lesbar unter `Crossword/data/`.
- Beim Build erzeugt `Deployment/Tools/build_crossword_data.py` daraus einen komprimierten und reversibel verschleierten Datencontainer `Shared/www/crossword-data.js`. Die Klartextdateien werden nicht unter `Shared/www` verÃ¶ffentlicht.
- Der statische Offline-Katalog enthält **7.367 unterschiedliche Frage-Antwort-Paare** aus der vom Projektinhaber bereitgestellten Sammlung mit **5.398 unterschiedlichen Lösungen**. Beim Import werden nur exakte Frage-Antwort-Dubletten entfernt.
- Kurze klassische Rasterlösungen bleiben erhalten; der Import und die Layout-Engine unterstützen deshalb ausdrücklich Antworten ab **2 Buchstaben**.
- Der Release greift für App 04 nicht auf das Internet zu: `validate_crossword_catalog.py` prüft den statischen Katalog, danach erzeugt `build_crossword_data.py` ausschließlich lokal den PWA-Datencontainer.


### PWA-Installation auf dem Handy

Die Startseite enthÃ¤lt eine animierte Installationsanleitung fÃ¼r iPhone und Android. Sie zeigt die nÃ¶tigen Schritte fÃ¼r â€žZum Home-Bildschirmâ€œ bzw. â€žApp installierenâ€œ direkt in einer animierten Handy-Darstellung. Auf unterstÃ¼tzten Android-Browsern erscheint zusÃ¤tzlich ein direkter Installationsknopf, sobald der Browser das PWA-Installationsereignis anbietet.

## Projektstruktur

- `Shared/www/` â€“ gemeinsame App-OberflÃ¤che und gesamte Fachlogik.
- `Android/` â€“ optionale native Android-WebView-HÃ¼lle, Paket `de.matthiashauck.appsammlung`.
- `iOS/` â€“ optionale native SwiftUI/WKWebView-HÃ¼lle, Bundle-ID `de.matthiashauck.appsammlung`.
- `Deployment/` â€“ ausschlieÃŸlich manuell startbare PrÃ¼f-, Build- und Release-Workflows, Datenschutz und Release-Plan.

Neue Mini-Apps werden grundsÃ¤tzlich in `Shared/www/` ergÃ¤nzt.

## LokalitÃ¤t und Netzwerk-Trennung

App 01 (ZauberwÃ¼rfel) und App 02 (Sudoku) bleiben vollstÃ¤ndig lokal und erhalten per Content-Security-Policy keinen API-/Netzwerkzugriff. App 03 (Musikfinder) ist ausdrÃ¼cklich als Online-App markiert und darf nur auf die fest freigegebenen Musikquellen zugreifen.

Die PWA-Dateien selbst werden weiterhin Ã¼ber GitHub Pages geladen und offline gecacht. Externe Antworten des Musikfinders werden vom Service Worker bewusst **nicht** gecacht. Es gibt keinen eigenen Backend-Server.

## Entwicklung und GitHub Actions

**Es gibt keinerlei automatisch gestartete GitHub Action.** Ein normaler Push, Pull Request oder Tag startet weder Preflight noch Build noch Deployment. Alle Workflow-Dateien verwenden ausschlieÃŸlich `workflow_dispatch` und mÃ¼ssen in GitHub unter **Actions â†’ Run workflow** von Hand gestartet werden.

FÃ¼r eine lokale PrÃ¼fung kann jederzeit bewusst ausgefÃ¼hrt werden:

```bash
python Deployment/Tools/preflight.py
```

Der Workflow **Manual checks Android + iOS** ist ebenfalls rein manuell und baut nur Testartefakte; er verÃ¶ffentlicht nichts.

## How to release

Ein Release ist absichtlich ein manueller Vorgang. **Weder ein normaler Push noch das Anlegen/Pushen eines Tags deployt automatisch.** Der Release-Workflow muss anschlieÃŸend in GitHub Actions ausdrÃ¼cklich per **Run workflow** gestartet und mit dem gewÃ¼nschten Version-Tag bestÃ¤tigt werden.

### 1. Version lokal vorbereiten

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File Deployment/Tools/release.ps1 -Version 1.0.0 -BuildNumber 1
```

macOS/Linux:

```bash
Deployment/Tools/release.sh 1.0.0 1
```

Das Skript setzt die gemeinsame Version und fÃ¼hrt den Preflight aus. Es fÃ¼hrt **kein** `git commit`, `git tag`, `git push` oder Deployment aus.

### 2. Ã„nderungen prÃ¼fen und committen

```bash
git status
git diff
git add .
git commit -m "Release v1.0.0"
git push origin main
```

Der Push auf `main` lÃ¶st **keine** GitHub Action aus.

### 3. Version-Tag bewusst von Hand anlegen

```bash
git tag -a v1.0.0 -m "Hauckis App-Sammlung v1.0.0"
git push origin v1.0.0
```

Auch dieser Tag-Push startet **kein** Release.

### 4. PWA manuell verÃ¶ffentlichen

Auf GitHub:

1. Repository Ã¶ffnen.
2. **Actions** Ã¶ffnen.
3. Workflow **Release PWA manually** auswÃ¤hlen.
4. **Run workflow** wÃ¤hlen.
5. Bei `version_tag` exakt `v1.0.0` eintragen.
6. Workflow manuell starten.

Der Workflow checkt exakt diesen Tag aus, prÃ¼ft, dass `VERSION` dazu passt, fÃ¼hrt den Preflight aus und verÃ¶ffentlicht erst danach `Shared/www/` nach GitHub Pages.

### 5. Optional: native Android-/iOS-Artefakte bauen

Falls irgendwann nÃ¶tig: **Actions â†’ Build native Android + iOS manually â†’ Run workflow** und denselben `version_tag` angeben. Store-Uploads sind standardmÃ¤ÃŸig aus und benÃ¶tigen eine zusÃ¤tzliche bewusste Auswahl.

## Sicherheitsprinzip fÃ¼r Releases

- Push auf `main`: **kein Deployment**.
- Push eines `v*`-Tags: **kein Deployment**.
- Zeitplan/Cron: **nicht vorhanden**.
- PWA-Release: nur per manuellem GitHub-Actions-Start mit vorhandenem Version-Tag.
- PWA-Release-Akteur: ausschließlich GitHub-Benutzer "hauckmatthias8-cmyk"; andere Benutzer werden im Workflow abgewiesen.
- Native Releases: ebenfalls nur manuell.

## Version

Aktueller Projektstand: **1.3.0 / Build 9**.


## Lizenzierung und Quellen

- Projekt-eigener Code: Apache License 2.0 (`LICENSE`).
- Drittanbieter-Code/-Daten behalten ihre eigene Lizenz; Ãœbersicht: `Shared/www/licenses.html` und `Shared/www/THIRD_PARTY_LICENSES.txt`.
- Kreuzworträtsel-Katalog: vom Projektinhaber bereitgestellte Sammlung; keine Faker-/CountryInfo-/OpenThesaurus-/Wikidata-Daten werden für den aktuellen Katalog benötigt.
- Musikfinder: Medien und Metadaten externer Quellen werden nicht durch dieses Projekt neu lizenziert. Der konkrete Quellen-/Lizenzlink bleibt maÃŸgeblich.
- YouTube/YouTube Music werden nicht automatisiert abgefragt. Es werden ausschlieÃŸlich nutzerinitiierte Suchlinks aus bereits gefundenen Titel-/Interpret-Metadaten erzeugt.
