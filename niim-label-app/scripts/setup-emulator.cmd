@echo off
setlocal
set SDK=%LOCALAPPDATA%\Android\Sdk
set ANDROID_HOME=%SDK%
set ANDROID_SDK_ROOT=%SDK%
set PATH=%SDK%\cmdline-tools\latest\bin;%SDK%\platform-tools;%SDK%\emulator;%PATH%

echo [1/4] Accepting licenses...
call sdkmanager --licenses < nul
echo y| call sdkmanager --licenses >nul 2>&1

echo [2/4] Installing system image (Android 35 Google APIs x86_64)...
echo This downloads ~1GB. Please wait.
call sdkmanager "system-images;android-35;google_apis;x86_64" "platforms;android-35" "emulator" "platform-tools"

echo [3/4] Creating AVD: NiimLabel_API35
echo no | call avdmanager create avd -n NiimLabel_API35 -k "system-images;android-35;google_apis;x86_64" -d pixel_6 --force

echo [4/4] Done. AVD list:
call emulator -list-avds
echo.
echo Start emulator: scripts\start-emulator.cmd
echo Install app:    scripts\run-android-emulator.cmd
