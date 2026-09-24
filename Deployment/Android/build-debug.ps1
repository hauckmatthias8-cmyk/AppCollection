$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$Android=Join-Path $Root 'Android'
$Artifacts=Join-Path $Root 'Artifacts/Android'
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
Push-Location $Android
try {
  & .\build_debug.bat
  if ($LASTEXITCODE -ne 0) { throw 'Android Debug-Build fehlgeschlagen.' }
  Copy-Item 'Hauckis-App-Sammlung-debug.apk' (Join-Path $Artifacts 'Hauckis-App-Sammlung-debug.apk') -Force
} finally { Pop-Location }
Write-Host "APK: $Artifacts\Hauckis-App-Sammlung-debug.apk" -ForegroundColor Green
