param(
    [string]$ApkPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'artifacts\label-studio-core-debug.apk')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$resolvedApk = (Resolve-Path -LiteralPath $ApkPath).Path
$zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedApk)

try {
    $entry = $zip.Entries |
        Where-Object FullName -eq 'assets/public/assets/app.js' |
        Select-Object -First 1

    if (-not $entry) {
        throw 'Bundled app.js was not found in the APK.'
    }

    $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    try {
        $javascript = $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
    }

    $bleMatch = [regex]::Match($javascript, '.{0,45}androidNeverForLocation.{0,45}')
    $elementTypes = @('text', 'barcode', 'qrcode', 'date', 'serial', 'image', 'material', 'rect', 'line', 'table')
    $missingTypes = @($elementTypes | Where-Object { -not $javascript.Contains($_) })

    Write-Output "entry=$($entry.FullName) compressed=$($entry.CompressedLength) size=$($entry.Length)"
    Write-Output "ble_config=$($bleMatch.Value)"
    Write-Output "element_types=$($elementTypes -join ',')"
    Write-Output "missing=$($missingTypes -join ',')"

    if (-not $bleMatch.Success -or $bleMatch.Value -notmatch 'true|!0' -or $missingTypes.Count) {
        throw 'Bundled core verification failed.'
    }

    Write-Output 'bundled_core_verified=true'
} finally {
    $zip.Dispose()
}
