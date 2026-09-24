# iOS Deployment

Ein echter iOS-Build benötigt macOS. Für App-Store-Uploads 2026 ist Xcode 26 oder neuer
vorgesehen; die GitHub-Automatisierung nutzt deshalb `macos-26`.

## Simulator-Build ohne Signierung

```bash
chmod +x Deployment/iOS/*.sh
Deployment/iOS/build-simulator.sh
```

Ergebnis: `Artifacts/iOS/HauckisAppSammlung-simulator.zip`.

## Lokales App-Store-Archiv

In Xcode einmal mit deinem Apple Developer Team anmelden, dann:

```bash
export APPLE_TEAM_ID=DEIN_TEAM_ID
Deployment/iOS/archive-appstore.sh
```

Das Skript verwendet automatische Signierung und `-allowProvisioningUpdates`.
Ergebnis: `.xcarchive` und – wenn Export/Signing erfolgreich sind – eine `.ipa` unter
`Artifacts/iOS/`.

## TestFlight vollautomatisch

Für CI werden Distribution-Zertifikat, Provisioning Profile und App Store Connect API Key
als GitHub Secrets hinterlegt. Siehe `../SECRETS.md` und `../Automation/workflows/release-both.yml`.
