@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

rem ============================================================
rem Hauckis App-Sammlung - lokaler PWA-Release
rem
rem Ablauf:
rem   1. Remote-Tags aktualisieren und letzte Release-Version anzeigen
rem   2. Neue SemVer-Version abfragen
rem   3. Buildnummer automatisch +1
rem   4. Versionen/Daten/README aktualisieren + Preflight
rem   5. Alle Release-Aenderungen committen und main pushen
rem   6. vX.Y.Z taggen und Tag pushen
rem   7. GitHub Pages Workflow starten und auf Ergebnis warten
rem ============================================================

cd /d "%~dp0"
set "REPO=hauckmatthias8-cmyk/AppCollection"
set "PAGES_URL=https://hauckmatthias8-cmyk.github.io/AppCollection/"

echo.
echo ============================================================
echo  Hauckis App-Sammlung - PWA Release
echo ============================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo FEHLER: Git wurde nicht gefunden.
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo FEHLER: Python wurde nicht gefunden.
    exit /b 1
)

set "GH=gh"
where gh >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\GitHub CLI\gh.exe" (
        set "GH=C:\Program Files\GitHub CLI\gh.exe"
    ) else (
        echo FEHLER: GitHub CLI ^(gh^) wurde nicht gefunden.
        echo Installation: winget install --id GitHub.cli -e
        exit /b 1
    )
)

set "RELEASE_OWNER=hauckmatthias8-cmyk"

echo GitHub-CLI-Anmeldung pruefen...
"%GH%" auth status --hostname github.com >nul 2>&1
if errorlevel 1 (
    echo GitHub-Login erforderlich.
    "%GH%" auth login --hostname github.com --git-protocol https --web
    if errorlevel 1 exit /b 1
)

set "GH_LOGIN="
set "GH_LOGIN_FILE=%TEMP%\appcollection_gh_login_%RANDOM%_%RANDOM%.txt"

"%GH%" api user --jq ".login" > "!GH_LOGIN_FILE!" 2>nul
if errorlevel 1 (
    if exist "!GH_LOGIN_FILE!" del /q "!GH_LOGIN_FILE!" >nul 2>&1
    echo FEHLER: GitHub-Benutzer konnte nicht ueber die GitHub-API ermittelt werden.
    echo Bitte pruefen mit:
    echo   "%GH%" auth status --hostname github.com
    echo   "%GH%" api user --jq ".login"
    exit /b 1
)

set /p "GH_LOGIN="<"!GH_LOGIN_FILE!"
del /q "!GH_LOGIN_FILE!" >nul 2>&1

if not defined GH_LOGIN (
    echo FEHLER: GitHub-API lieferte keinen Benutzernamen zurueck.
    exit /b 1
)

if /I not "!GH_LOGIN!"=="!RELEASE_OWNER!" (
    echo.
    echo FEHLER: Releases duerfen nur mit dem GitHub-Konto !RELEASE_OWNER! gestartet werden.
    echo Aktuell bei gh angemeldet: !GH_LOGIN!
    exit /b 1
)

echo GitHub-Benutzer fuer Release autorisiert: !GH_LOGIN!
echo.
git rev-parse --show-toplevel >nul 2>&1

if errorlevel 1 (
    echo FEHLER: release_pwa.bat muss im AppCollection-Repository liegen.
    exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if /I not "!BRANCH!"=="main" (
    echo FEHLER: Aktueller Branch ist "!BRANCH!". Erwartet wird main.
    exit /b 1
)

echo Remote-Stand aktualisieren...
git fetch origin --prune --prune-tags --tags
if errorlevel 1 goto :failed

for /f "delims=" %%H in ('git rev-parse HEAD') do set "LOCAL_HEAD=%%H"
for /f "delims=" %%H in ('git rev-parse origin/main') do set "REMOTE_HEAD=%%H"

if /I not "!LOCAL_HEAD!"=="!REMOTE_HEAD!" (
    echo.
    echo FEHLER: Lokaler HEAD und origin/main sind nicht identisch.
    echo Lokal : !LOCAL_HEAD!
    echo Remote: !REMOTE_HEAD!
    echo Bitte erst synchronisieren. Lokale uncommittete Dateien sind erlaubt,
    echo lokale bereits vorhandene Commits vor dem Release jedoch nicht.
    exit /b 1
)

set "LAST_TAG="
for /f "delims=" %%T in ('git tag --list "v[0-9]*.[0-9]*.[0-9]*" --sort=-version:refname') do (
    if not defined LAST_TAG set "LAST_TAG=%%T"
)

if not defined LAST_TAG (
    set "LAST_VERSION=keine"
) else (
    set "LAST_VERSION=!LAST_TAG:~1!"
)

echo.
echo Letzte Release-Version im Remote-Repository: !LAST_VERSION!
echo.

:ask_version
set "NEW_VERSION="
set /p "NEW_VERSION=Neue Release-Version eingeben (z.B. 1.0.1): "
if not defined NEW_VERSION goto :ask_version

echo(!NEW_VERSION!| findstr /r /x "[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*" >nul
if errorlevel 1 (
    echo Ungueltiges Format. Erwartet wird MAJOR.MINOR.PATCH, z.B. 1.0.1.
    echo.
    goto :ask_version
)

if /I not "!LAST_VERSION!"=="keine" (
    powershell.exe -NoProfile -Command "if ([version]'!NEW_VERSION!' -le [version]'!LAST_VERSION!') { exit 1 } else { exit 0 }"
    if errorlevel 1 (
        echo Die neue Version muss groesser als !LAST_VERSION! sein.
        echo.
        goto :ask_version
    )
)

git ls-remote --exit-code --tags origin "refs/tags/v!NEW_VERSION!" >nul 2>&1
if not errorlevel 1 (
    echo FEHLER: Remote-Tag v!NEW_VERSION! existiert bereits.
    exit /b 1
)

set "CURRENT_BUILD="
for /f "delims=" %%B in ('python -c "import json; print(int(json.load(open(r'Shared/www/version.json', encoding='utf-8-sig'))['build']))"') do set "CURRENT_BUILD=%%B"
if not defined CURRENT_BUILD (
    echo FEHLER: Aktuelle Buildnummer konnte nicht aus Shared/www/version.json gelesen werden.
    exit /b 1
)
set /a NEW_BUILD=CURRENT_BUILD+1

echo.
echo Geplanter Release:
echo   Version: !NEW_VERSION!
echo   Build  : !NEW_BUILD!
echo.

echo Versionen aktualisieren...
python Deployment/Tools/set_version.py "!NEW_VERSION!" "!NEW_BUILD!"
if errorlevel 1 goto :failed

echo Kreuzwortraetsel-Katalog pruefen/erweitern...
python Deployment/Tools/expand_crossword_catalog.py
if errorlevel 1 goto :failed

echo Kreuzwortraetsel-Datenpaket bauen...
python Deployment/Tools/build_crossword_data.py
if errorlevel 1 goto :failed

echo Preflight ausfuehren...
python Deployment/Tools/preflight.py
if errorlevel 1 goto :failed

echo.
echo Zu committen:
git status --short
echo.

git add -A
if errorlevel 1 goto :failed

git diff --cached --quiet
if errorlevel 1 (
    echo Erzeuge Release-Commit...
    git commit -m "Release v!NEW_VERSION!"
    if errorlevel 1 goto :failed
) else (
    echo Keine Dateiaenderungen zu committen.
)

for /f "delims=" %%S in ('git status --porcelain') do (
    echo FEHLER: Nach dem Release-Commit ist der Working Tree nicht sauber.
    git status --short
    exit /b 1
)

echo Push main...
git push origin main
if errorlevel 1 goto :failed

for /f "delims=" %%H in ('git rev-parse HEAD') do set "PUSHED_SHA=%%H"

echo Erzeuge Tag v!NEW_VERSION!...
git tag -a "v!NEW_VERSION!" -m "Hauckis App-Sammlung v!NEW_VERSION!"
if errorlevel 1 goto :failed

git push origin "v!NEW_VERSION!"
if errorlevel 1 goto :failed


echo.
echo Starte GitHub Pages Release fuer v!NEW_VERSION!...
"%GH%" workflow run deploy-pages.yml --repo "%REPO%" --ref main -f "version_tag=v!NEW_VERSION!"
if errorlevel 1 goto :failed

set "RUN_ID="
for /L %%I in (1,1,30) do (
    if not defined RUN_ID (
        for /f "delims=" %%R in ('"%GH%" run list --repo "%REPO%" --workflow deploy-pages.yml --commit "!PUSHED_SHA!" --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do set "RUN_ID=%%R"
        if not defined RUN_ID timeout /t 2 /nobreak >nul
    )
)

if not defined RUN_ID (
    echo FEHLER: Workflow wurde gestartet, aber die Run-ID konnte nicht gefunden werden.
    exit /b 1
)

echo Workflow-Run: !RUN_ID!
echo Warte auf Preflight und Pages-Deployment...
"%GH%" run watch "!RUN_ID!" --repo "%REPO%" --exit-status
if errorlevel 1 (
    echo.
    echo RELEASE FEHLGESCHLAGEN.
    echo Tag v!NEW_VERSION! bleibt zur Diagnose bestehen.
    echo Run: https://github.com/%REPO%/actions/runs/!RUN_ID!
    exit /b 1
)

echo.
echo ============================================================
echo  RELEASE ERFOLGREICH
echo ============================================================
echo Version : v!NEW_VERSION!
echo Build   : !NEW_BUILD!
echo Commit  : !PUSHED_SHA!
echo PWA     : %PAGES_URL%
echo ============================================================
echo.
exit /b 0

:failed
echo.
echo FEHLER: Release-Vorgang wurde abgebrochen.
exit /b 1
