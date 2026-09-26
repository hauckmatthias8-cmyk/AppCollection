param(
  [string]$Alias='hauckis-app-sammlung',
  [string]$DName='CN=Matthias Hauck, OU=Development, O=Hauckis App-Sammlung, C=DE'
)
$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$Secrets=Join-Path $Root 'Deployment/secrets'
$Keystore=Join-Path $Secrets 'hauckis-app-sammlung-release.jks'
New-Item -ItemType Directory -Force -Path $Secrets | Out-Null

function Find-Keytool {
  if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\keytool.exe")) { return "$env:JAVA_HOME\bin\keytool.exe" }
  $as="$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe"
  if (Test-Path $as) { return $as }
  $cmd=Get-Command keytool.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw 'keytool.exe nicht gefunden. Android Studio oder JDK 17+ installieren.'
}
function Plain([Security.SecureString]$s) {
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if (Test-Path $Keystore) { throw "Keystore existiert bereits: $Keystore" }
$pw1=Read-Host 'Neues Keystore-Passwort' -AsSecureString
$pw2=Read-Host 'Passwort wiederholen' -AsSecureString
$p1=Plain $pw1; $p2=Plain $pw2
if ($p1 -ne $p2 -or [string]::IsNullOrWhiteSpace($p1)) { throw 'Passwörter stimmen nicht überein oder sind leer.' }
$keytool=Find-Keytool
& $keytool -genkeypair -v -keystore $Keystore -alias $Alias -keyalg RSA -keysize 4096 -validity 10000 -storepass $p1 -keypass $p1 -dname $DName
if ($LASTEXITCODE -ne 0) { throw 'Keystore-Erstellung fehlgeschlagen.' }

$props=@"
storeFile=../Deployment/secrets/hauckis-app-sammlung-release.jks
storePassword=$p1
keyAlias=$Alias
keyPassword=$p1
"@
Set-Content -Path (Join-Path $Root 'Android/keystore.properties') -Value $props -Encoding UTF8
$p1=$null; $p2=$null
Write-Host "Keystore erstellt: $Keystore" -ForegroundColor Green
Write-Host 'WICHTIG: Sichere die JKS-Datei zusätzlich außerhalb dieses Projektordners.' -ForegroundColor Yellow
