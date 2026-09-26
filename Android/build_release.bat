@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist keystore.properties (
  echo FEHLER: keystore.properties fehlt.
  echo Kopiere keystore.properties.example nach keystore.properties und trage deinen Release-Key ein.
  echo Alternativ in Android Studio: Build ^> Generate Signed App Bundle / APK.
  exit /b 1
)

set "GRADLE_VERSION=8.9"
set "TOOLS=%CD%\.gradle-dist"
set "GRADLE_HOME=%TOOLS%\gradle-%GRADLE_VERSION%"
set "ZIP=%TOOLS%\gradle-%GRADLE_VERSION%-bin.zip"

call :find_java || exit /b 1
call :find_sdk || exit /b 1

if not exist "%GRADLE_HOME%\bin\gradle.bat" (
  echo [App-Sammlung] Lade Gradle %GRADLE_VERSION% einmalig herunter...
  if not exist "%TOOLS%" mkdir "%TOOLS%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile '%ZIP%'"
  if errorlevel 1 exit /b 1
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%TOOLS%' -Force"
  if errorlevel 1 exit /b 1
)

set "SDK_FWD=%ANDROID_SDK_ROOT:\=/%"
> local.properties echo sdk.dir=%SDK_FWD%

echo [App-Sammlung] Baue signierte Release-APK und AAB...
call "%GRADLE_HOME%\bin\gradle.bat" --no-daemon :app:assembleRelease :app:bundleRelease
if errorlevel 1 exit /b 1

copy /Y "app\build\outputs\apk\release\app-release.apk" "Hauckis-App-Sammlung-release.apk" >nul
copy /Y "app\build\outputs\bundle\release\app-release.aab" "Hauckis-App-Sammlung-release.aab" >nul

echo.
echo Fertig:
echo   %CD%\Hauckis-App-Sammlung-release.apk
echo   %CD%\Hauckis-App-Sammlung-release.aab
exit /b 0

:find_java
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" exit /b 0
if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
  set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
  exit /b 0
)
where java.exe >nul 2>&1
if not errorlevel 1 exit /b 0
echo FEHLER: Kein Java gefunden. Installiere Android Studio oder JDK 17+.
exit /b 1

:find_sdk
if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\platforms" exit /b 0
if defined ANDROID_HOME if exist "%ANDROID_HOME%\platforms" (
  set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
  exit /b 0
)
if exist "%LOCALAPPDATA%\Android\Sdk\platforms" (
  set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
  exit /b 0
)
echo FEHLER: Android SDK nicht gefunden. Android Studio ^> SDK Manager installieren.
exit /b 1
