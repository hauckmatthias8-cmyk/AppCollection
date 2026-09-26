@echo off
setlocal EnableExtensions
cd /d "%~dp0"

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

echo [App-Sammlung] Baue Debug-APK...
call "%GRADLE_HOME%\bin\gradle.bat" --no-daemon :app:assembleDebug
if errorlevel 1 exit /b 1

copy /Y "app\build\outputs\apk\debug\app-debug.apk" "Hauckis-App-Sammlung-debug.apk" >nul

echo.
echo Fertig: %CD%\Hauckis-App-Sammlung-debug.apk
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
