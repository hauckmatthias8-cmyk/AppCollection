# Deployment-Plan

## 1. Primärer Weg: manuelle PWA über GitHub Pages

Die installierbare PWA aus `Shared/www/` ist der Standard für iOS und Android. Es existiert **kein automatischer Release-Trigger**. Ein Release benötigt immer zwei bewusste Schritte: einen vorhandenen Version-Tag und anschließend einen manuellen Start des GitHub-Actions-Workflows.

## 2. Was automatisch laufen darf

`ci.yml` darf bei Pushes und Pull Requests Preflight, Android-Debug-Build und iOS-Simulator-Build ausführen. Diese Jobs veröffentlichen nichts.

## 3. Was niemals automatisch läuft

- kein GitHub-Pages-Deployment bei Push auf `main`
- kein Deployment bei Push eines `v*`-Tags
- kein zeitgesteuerter/Cron-Release
- kein automatischer Store-Upload

## 4. Release-Ablauf

Die verbindliche Schritt-für-Schritt-Anleitung steht in der globalen `README.md` unter **How to release**. Kurzform:

1. Version/Build lokal setzen und Preflight ausführen.
2. Änderungen prüfen, committen und nach `main` pushen.
3. `vMAJOR.MINOR.PATCH` manuell taggen und den Tag pushen.
4. GitHub → Actions → **Release PWA manually**.
5. Den vorhandenen Tag als `version_tag` eintragen.
6. Workflow bewusst starten.

## 5. Schutz gegen falsche Tags

Der PWA-Workflow akzeptiert nur Tags im Format `vMAJOR.MINOR.PATCH`, prüft, ob der Tag tatsächlich existiert, checkt genau diesen Stand aus und vergleicht den Tag mit der Datei `VERSION`. Erst nach bestandenem Preflight wird GitHub Pages aktualisiert.

## 6. Optionale native Builds

Android APK/AAB und iOS IPA bleiben als Fallback vorhanden. Auch diese werden nur über **Build native Android + iOS manually** mit einem existierenden Version-Tag gebaut. Store-Uploads sind standardmäßig aus und benötigen bei einem manuellen Lauf eine zusätzliche explizite Auswahl.

## 7. Installation der PWA

- iOS/iPadOS: Safari → Teilen → Zum Home-Bildschirm.
- Android: Chrome → App installieren / Zum Startbildschirm hinzufügen.

## 8. Lokalität

Solver, Sudoku und Bildverarbeitung laufen lokal auf dem Gerät. Netzwerk wird nur zum erstmaligen Laden bzw. zum bewussten Abruf einer veröffentlichten neuen Version benötigt.
