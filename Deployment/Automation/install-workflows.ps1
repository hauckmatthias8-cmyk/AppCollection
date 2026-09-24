$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$Dest=Join-Path $Root '.github/workflows'
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'workflows/*.yml') $Dest -Force
Write-Host "Workflows installiert nach $Dest" -ForegroundColor Green
Write-Host 'Jetzt committen: git add .github/workflows Deployment && git commit -m "Add deployment automation"'
