# Android Deployment

## Debug APK

```powershell
powershell -ExecutionPolicy Bypass -File Deployment/Android/build-debug.ps1
```

Ergebnis: `Artifacts/Android/Hauckis-App-Sammlung-debug.apk`

## Release-Key einmalig erzeugen

```powershell
powershell -ExecutionPolicy Bypass -File Deployment/Android/create-keystore.ps1
```

Das Skript legt den Key standardmäßig unter `Deployment/secrets/` ab und erzeugt
`Android/keystore.properties`. Beide Dateien sind durch `.gitignore` ausgeschlossen.
Den `.jks`-Key zusätzlich außerhalb des Projekts sichern. Ohne denselben Schlüssel sind
spätere Updates derselben Android-App problematisch, sofern nicht vollständig über Play App
Signing verwaltet.

## Release lokal bauen

```powershell
powershell -ExecutionPolicy Bypass -File Deployment/Android/build-release.ps1
```

Ergebnis:

- `Artifacts/Android/Hauckis-App-Sammlung-release.apk`
- `Artifacts/Android/Hauckis-App-Sammlung-release.aab`

Für Google Play ist das AAB die relevante Datei.
