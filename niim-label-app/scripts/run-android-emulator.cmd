@echo off
setlocal
set SDK=%LOCALAPPDATA%\Android\Sdk
set ANDROID_HOME=%SDK%
set ANDROID_SDK_ROOT=%SDK%
set PATH=%SDK%\platform-tools;%PATH%
cd /d "%~dp0.."

echo Building web assets...
call npm.cmd run build
if errorlevel 1 exit /b 1

echo Syncing Capacitor Android...
call npx.cmd cap sync android
if errorlevel 1 exit /b 1

echo Assembling debug APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 exit /b 1
cd ..

echo Installing on emulator/device...
adb install -r "android\app\build\outputs\apk\debug\app-debug.apk"
if errorlevel 1 (
  echo Install failed. Is emulator running? Try scripts\start-emulator.cmd
  exit /b 1
)

echo Launching app...
adb shell am start -n com.jc.niimlabel/.MainActivity
echo Done.
