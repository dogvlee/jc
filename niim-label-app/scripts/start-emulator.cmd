@echo off
setlocal
set SDK=%LOCALAPPDATA%\Android\Sdk
set ANDROID_HOME=%SDK%
set ANDROID_SDK_ROOT=%SDK%
set PATH=%SDK%\emulator;%SDK%\platform-tools;%PATH%

set AVD=NiimLabel_API35
if not "%~1"=="" set AVD=%~1

echo Starting AVD: %AVD%
start "Android Emulator" "%SDK%\emulator\emulator.exe" -avd %AVD% -netdelay none -netspeed full -gpu auto
echo Waiting for device...
adb wait-for-device
:loop
for /f "tokens=*" %%i in ('adb shell getprop sys.boot_completed 2^>nul') do set BOOT=%%i
if "%BOOT%"=="1" goto ready
timeout /t 3 /nobreak >nul
goto loop
:ready
echo Emulator is ready.
adb devices
