# Signierung und GitHub-Secrets

Niemals Zertifikate, Passwörter, private Schlüssel oder Service-Account-Dateien committen.

## Android

### Lokal

`Android/keystore.properties`:

```properties
storeFile=../Deployment/secrets/hauckis-app-sammlung-release.jks
storePassword=DEIN_PASSWORT
keyAlias=hauckis-app-sammlung
keyPassword=DEIN_PASSWORT
```

### GitHub Actions

Repository → Settings → Secrets and variables → Actions:

- `ANDROID_KEYSTORE_BASE64` – komplette JKS-Datei base64-codiert.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` – JSON des Google-Play-Service-Accounts.

PowerShell zum Codieren der JKS:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('hauckis-app-sammlung-release.jks')) | Set-Clipboard
```

## iOS

- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE_BASE64` – Apple-Distribution-Zertifikat `.p12` als Base64.
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64` – App-Store-`.mobileprovision` als Base64.
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_BASE64` – Inhalt der `AuthKey_XXXX.p8` Datei als Base64.

macOS zum Codieren:

```bash
base64 -i AppleDistribution.p12 | pbcopy
base64 -i HauckisAppSammlung.mobileprovision | pbcopy
base64 -i AuthKey_XXXX.p8 | pbcopy
```

## GitHub-Environments

Empfohlen:

- Environment `internal` für Android Internal Testing + TestFlight.
- Environment `production` für spätere öffentliche Releases.
- Für `production` manuelle Freigabe/Required Reviewer aktivieren.
