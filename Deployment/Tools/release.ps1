param(
    [Parameter(Mandatory=$true)][string]$Version,
    [Parameter(Mandatory=$true)][int]$BuildNumber
)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $Root

python Deployment/Tools/set_version.py $Version $BuildNumber
python Deployment/Tools/preflight.py

Write-Host ''
Write-Host "Release v$Version ist lokal vorbereitet." -ForegroundColor Green
Write-Host 'Dieses Skript committet, taggt, pusht und deployt ABSICHTLICH NICHT.' -ForegroundColor Yellow
Write-Host 'Nächste Schritte stehen im Abschnitt "How to release" der globalen README.md.' -ForegroundColor Cyan
