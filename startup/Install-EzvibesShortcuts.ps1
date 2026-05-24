param(
  [switch]$CreateStartupShortcut
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$launcherPath = Join-Path $repoRoot 'ezvibes.vbs'
$iconPath = Join-Path $repoRoot 'renderer\ezvibes.ico'

if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "Launcher not found: $launcherPath. Make sure ezvibes.vbs exists at the repo root."
}

if (-not (Test-Path -LiteralPath $iconPath)) {
  throw "Icon not found: $iconPath. Run scripts/build-ezvibes-icon.ps1 first."
}

function New-EzvibesShortcut {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ShortcutPath
  )

  $shortcutDir = Split-Path -Parent $ShortcutPath
  New-Item -ItemType Directory -Force -Path $shortcutDir | Out-Null

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $shortcut.Arguments = '"' + $launcherPath + '"'
  $shortcut.WorkingDirectory = [string]$repoRoot
  $shortcut.IconLocation = $iconPath + ',0'
  $shortcut.Description = 'Launch ezvibes'
  $shortcut.Save()
}

# Start Menu shortcut (this is what Windows Search indexes)
$programsDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$startMenuShortcut = Join-Path $programsDir 'ezvibes.lnk'
New-EzvibesShortcut -ShortcutPath $startMenuShortcut

# Taskbar pin refresh
# Modern Windows blocks programmatic taskbar pinning; we can only refresh an existing pin.
$taskbarDir = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
$electronPin = Join-Path $taskbarDir 'Electron.lnk'
$ezvibesPin = Join-Path $taskbarDir 'ezvibes.lnk'

if ((Test-Path -LiteralPath $electronPin) -and -not (Test-Path -LiteralPath $ezvibesPin)) {
  Move-Item -LiteralPath $electronPin -Destination $ezvibesPin
}

$pinRefreshed = $false
if (Test-Path -LiteralPath $ezvibesPin) {
  New-EzvibesShortcut -ShortcutPath $ezvibesPin
  $pinRefreshed = $true
}

# Optional Startup shortcut
$startupShortcut = $null
if ($CreateStartupShortcut) {
  $startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
  $startupShortcut = Join-Path $startupDir 'ezvibes.lnk'
  New-EzvibesShortcut -ShortcutPath $startupShortcut
}

# Best-effort icon cache refresh
$ie4uinit = Join-Path $env:WINDIR 'System32\ie4uinit.exe'
if (Test-Path -LiteralPath $ie4uinit) {
  Start-Process -FilePath $ie4uinit -ArgumentList '-show' -WindowStyle Hidden -ErrorAction SilentlyContinue
}

Write-Host "Start Menu shortcut: $startMenuShortcut"
if ($pinRefreshed) {
  Write-Host "Taskbar shortcut refreshed: $ezvibesPin"
} else {
  Write-Host "Taskbar shortcut not created. Pin ezvibes from Windows Search after running this script."
}
if ($CreateStartupShortcut) {
  Write-Host "Startup shortcut: $startupShortcut"
}
