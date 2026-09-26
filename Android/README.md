# Hauckis möglicherweise nützliche App-Sammlung – Android

Optionale native Android-Hülle der App-Sammlung. Diese Version enthält zwei Apps:

1. **Zauberwürfel-Löser** – 3×3×3 per Foto/Farberkennung erfassen und lokal lösen.
2. **Sudoku** – Sudoku des Tages, zufälliges Sudoku und Sudoku-Löser für eigene Vorgaben.

## Sudoku-Funktionen

- **Sudoku des Tages:** Das Datum ist auswählbar; das heutige Datum ist voreingestellt. Für dasselbe Datum wird immer dasselbe Sudoku erzeugt.
- Jedes automatisch erzeugte Sudoku wird während der Erzeugung auf **genau eine Lösung** geprüft.
- **Zufälliges Sudoku:** bei jedem Erzeugen ein neuer Seed, ebenfalls mit Eindeutigkeitsprüfung.
- **Sudoku-Löser:** eigenes Startgitter eingeben. Der Einzelschritt-Löser startet erst, wenn die Vorgabe widerspruchsfrei und eindeutig lösbar ist.
- **Nächstes Feld lösen:** trägt genau ein weiteres korrektes Feld ein.
- Beim Tages-Sudoku wird der aktuelle Spielstand lokal auf dem Gerät gespeichert.

## Lokal / Datenschutz

Die Android-App enthält bewusst **keine `INTERNET`-Berechtigung**. Zauberwürfel-Solver, Sudoku-Generator, Sudoku-Solver und Bildauswertung laufen im WebView vollständig lokal. Kameraaufnahmen werden nur temporär im privaten App-Cache abgelegt.

## Technische Daten

- App-Name: **Hauckis möglicherweise nützliche App-Sammlung**
- Paketname: `de.matthiashauck.appsammlung`
- Version: `1.0.4`
- Mindestversion: Android 10 / API 29
- Ziel-SDK: Android 15 / API 35
- Java 17
- Gradle 8.9 / Android Gradle Plugin 8.7.3

## Debug-APK unter Windows

Android Studio bzw. Android SDK Platform 35 installieren. Anschließend im Projektordner:

```text
build_debug.bat
```

Erzeugt:

```text
Hauckis-App-Sammlung-debug.apk
```

## Signiertes Release

1. Dauerhaften Android-Release-Key erzeugen und sicher aufbewahren.
2. `keystore.properties.example` nach `keystore.properties` kopieren.
3. Pfad, Alias und Passwörter eintragen.
4. `build_release.bat` starten.

Erzeugt:

```text
Hauckis-App-Sammlung-release.apk
Hauckis-App-Sammlung-release.aab
```

## Drittanbieter

Der lokale Zauberwürfel-Solver basiert auf `cubejs`. Lizenz: `THIRD_PARTY_LICENSES.txt`.
