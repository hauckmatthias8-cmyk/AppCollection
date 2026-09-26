# Deployment-Plan

## 1. Primärer Weg: manuelle PWA über GitHub Pages

Die installierbare PWA aus `Shared/www/` ist der Standard für iOS und Android. Es existiert **kein automatischer Release-Trigger**. Ein Release benötigt immer zwei bewusste Schritte: einen vorhandenen Version-Tag und anschließend einen manuellen Start des GitHub-Actions-Workflows.

## 2. Automatische Ausführung

Keine. Es gibt absichtlich **keinen** `push`, `pull_request`, `schedule`, `workflow_run` oder sonstigen automatischen Trigger in `.github/workflows/`. Auch der Preflight läuft auf GitHub nur nach einem manuellen **Run workflow**.

## 3. Manuelle Ausführung

- **Manual checks Android + iOS**: Preflight + Debug-Builds auf ausdrücklichen Wunsch.
- **Release PWA manually**: PWA-Deployment eines bereits vorhandenen Version-Tags.
- **Build native Android + iOS manually**: native Release-Artefakte; Store-Upload nur nach zusätzlicher expliziter Auswahl.

Das Erstellen oder Pushen eines Tags startet selbst keinen Workflow.

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

Zauberwürfel, Sudoku und Bildverarbeitung laufen lokal auf dem Gerät. Der Musikfinder ist als Online-App getrennt und greift nur auf seine freigegebenen Musikquellen zu. Zusätzlich wird Netzwerk für das Laden bzw. Aktualisieren der PWA benötigt.
