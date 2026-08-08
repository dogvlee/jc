# setup-emulator.ps1 — create NiimLabel_API35 AVD
$ErrorActionPreference = "Stop"
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$sdk\cmdline-tools\latest\bin;$sdk\platform-tools;$sdk\emulator;$env:Path"

Write-Host "==> SDK: $sdk" -ForegroundColor Cyan
if (-not (Test-Path "$sdk\cmdline-tools\latest\bin\sdkmanager.bat")) {
  throw "sdkmanager not found. Install Android Studio / cmdline-tools first."
}

Write-Host "==> Accept licenses (type y if prompted)..." -ForegroundColor Cyan
# pre-create license files for common packages
$lic = Join-Path $sdk "licenses"
New-Item -ItemType Directory -Force -Path $lic | Out-Null
@(
  "android-sdk-license",
  "android-sdk-preview-license",
  "google-gdk-license",
  "intel-android-extra-license",
  "mips-android-sysimage-license"
) | ForEach-Object {
  $p = Join-Path $lic $_
  if (-not (Test-Path $p)) {
    Set-Content $p "24333f8a63b6825ea9c5514f83c2829b004d1fee" -Encoding ASCII
  }
}

$image = "system-images;android-35;google_apis;x86_64"
Write-Host "==> Installing $image (may take 10-30 min, ~1GB)..." -ForegroundColor Cyan
$p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c sdkmanager.bat --install `"$image`" `"platforms;android-35`" `"emulator`" `"platform-tools`"" -WorkingDirectory "$sdk\cmdline-tools\latest\bin" -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) {
  Write-Host "sdkmanager exit $($p.ExitCode). Retry from Android Studio > SDK Manager > System Images > Android 35 Google APIs x86_64" -ForegroundColor Yellow
}

$sys = Join-Path $sdk "system-images\android-35\google_apis\x86_64"
if (-not (Test-Path (Join-Path $sys "system.img")) -and -not (Test-Path (Join-Path $sys "ramdisk.img"))) {
  # also accept package.xml presence
  $any = Get-ChildItem $sys -File -EA SilentlyContinue | Where-Object { $_.Name -match 'img|package.xml' }
  if (-not $any) { throw "System image not installed. Open Android Studio SDK Manager and install Google APIs API 35 x86_64." }
}

Write-Host "==> Creating AVD NiimLabel_API35 ..." -ForegroundColor Cyan
$create = "echo no| avdmanager.bat create avd -n NiimLabel_API35 -k `"$image`" -d pixel_6 -f"
cmd /c $create

Write-Host "==> AVD list:" -ForegroundColor Cyan
& emulator -list-avds
Write-Host "Done. Run: .\scripts\start-emulator.cmd" -ForegroundColor Green
