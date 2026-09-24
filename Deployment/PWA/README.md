# PWA / GitHub Pages – manueller Releaseweg

Die App-Sammlung wird primär als installierbare PWA ausgeliefert. **Ein Push auf `main` oder ein Tag-Push veröffentlicht nichts.**

## Einmalige Einrichtung

1. Repository zu GitHub pushen.
2. GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Die Workflows aus `.github/workflows/` committen.

## Release

1. Release-Version vorbereiten.
2. Commit nach `main` pushen.
3. Version-Tag, z. B. `v1.0.0`, manuell anlegen und pushen.
4. GitHub → **Actions → Release PWA manually → Run workflow**.
5. `version_tag` exakt auf den gewünschten Tag setzen.
6. Workflow starten.

Der Workflow checkt ausschließlich den angegebenen Tag aus, prüft den Versionsabgleich und deployt erst nach bestandenem Preflight.

## Installation

### iPhone / iPad
Safari → **Teilen** → **Zum Home-Bildschirm** → **Hinzufügen**.

### Android
Chrome → Menü → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.

## Updates

Eine neue Version erscheint erst nach einem weiteren bewusst gestarteten manuellen PWA-Release. Nach dem nächsten Online-Start übernimmt der Service Worker die neue versionsgebundene Cache-Version; anschließend ist die App wieder offline nutzbar.

## Keine Hintergrund-Releases

Es gibt keinen Cronjob, keinen Zeitplan und keinen Push-/Tag-Trigger für Deployments.
