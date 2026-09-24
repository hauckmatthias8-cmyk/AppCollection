$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$Android=Join-Path $Root 'Android'
$Artifacts=Join-Path $Root 'Artifacts/Android'
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
if (-not (Test-Path (Join-Path $Android 'keystore.properties'))) {
  throw 'Android/keystore.properties fehlt. Zuerst Deployment/Android/create-keystore.ps1 ausführen.'
}
Push-Location $Android
try {
  & .\build_release.bat
  if ($LASTEXITCODE -ne 0) { throw 'Android Release-Build fehlgeschlagen.' }
  Copy-Item 'Hauckis-App-Sammlung-release.apk' (Join-Path $Artifacts 'Hauckis-App-Sammlung-release.apk') -Force
  Copy-Item 'Hauckis-App-Sammlung-release.aab' (Join-Path $Artifacts 'Hauckis-App-Sammlung-release.aab') -Force
} finally { Pop-Location }
Write-Host "Release-Artefakte: $Artifacts" -ForegroundColor Green
