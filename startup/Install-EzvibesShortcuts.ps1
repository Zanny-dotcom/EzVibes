param(
  [switch]$CreateStartupShortcut
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$appUserModelId = 'com.ezvibes.app'
$launcherPath = Join-Path $repoRoot 'ezvibes.vbs'
$iconPath = Join-Path $repoRoot 'renderer\ezvibes.ico'

if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "Launcher not found: $launcherPath. Make sure ezvibes.vbs exists at the repo root."
}

if (-not (Test-Path -LiteralPath $iconPath)) {
  throw "Icon not found: $iconPath. Run scripts/build-ezvibes-icon.ps1 first."
}

if (-not ([System.Management.Automation.PSTypeName]'Ezvibes.ShellShortcutProperties').Type) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace Ezvibes {
  public static class ShellShortcutProperties {
    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    private interface IPropertyStore {
      [PreserveSig]
      int GetCount(out uint cProps);
      [PreserveSig]
      int GetAt(uint iProp, out PROPERTYKEY pkey);
      [PreserveSig]
      int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
      [PreserveSig]
      int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
      [PreserveSig]
      int Commit();
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PROPERTYKEY {
      public Guid fmtid;
      public uint pid;

      public PROPERTYKEY(Guid fmtid, uint pid) {
        this.fmtid = fmtid;
        this.pid = pid;
      }
    }

    [StructLayout(LayoutKind.Explicit, Size = 16)]
    private struct PROPVARIANT {
      [FieldOffset(0)]
      public ushort vt;
      [FieldOffset(8)]
      public IntPtr pointerValue;
    }

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PROPVARIANT propVariant);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SHGetPropertyStoreFromParsingName(
      [MarshalAs(UnmanagedType.LPWStr)] string pszPath,
      IntPtr zero,
      uint flags,
      ref Guid riid,
      out IntPtr propertyStore);

    public static void SetAppUserModelId(string shortcutPath, string appUserModelId) {
      Guid propertyStoreId = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
      IntPtr propertyStorePtr;
      int hr = SHGetPropertyStoreFromParsingName(shortcutPath, IntPtr.Zero, 2, ref propertyStoreId, out propertyStorePtr);
      Marshal.ThrowExceptionForHR(hr);

      var propertyStore = (IPropertyStore)Marshal.GetTypedObjectForIUnknown(propertyStorePtr, typeof(IPropertyStore));

      try {
        var appIdKey = new PROPERTYKEY(new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 5);

        PROPVARIANT propVariant = new PROPVARIANT();
        propVariant.vt = 31; // VT_LPWSTR
        propVariant.pointerValue = Marshal.StringToCoTaskMemUni(appUserModelId);

        try {
          hr = propertyStore.SetValue(ref appIdKey, ref propVariant);
          Marshal.ThrowExceptionForHR(hr);

          hr = propertyStore.Commit();
          Marshal.ThrowExceptionForHR(hr);
        } finally {
          PropVariantClear(ref propVariant);
        }
      } finally {
        Marshal.Release(propertyStorePtr);
      }
    }
  }
}
'@
}

function ConvertTo-ComparablePath {
  param([AllowNull()][string]$PathValue)

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return ''
  }

  $trimChars = [char[]]@('\', '/')
  try {
    return [System.IO.Path]::GetFullPath($PathValue).TrimEnd($trimChars).ToLowerInvariant()
  } catch {
    return $PathValue.Trim().TrimEnd($trimChars).ToLowerInvariant()
  }
}

function Set-EzvibesShortcutAppId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ShortcutPath
  )

  [Ezvibes.ShellShortcutProperties]::SetAppUserModelId($ShortcutPath, $appUserModelId)
}

function Test-EzvibesShortcut {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ShortcutPath
  )

  if (-not (Test-Path -LiteralPath $ShortcutPath)) {
    return $false
  }

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)

  $targetPath = ConvertTo-ComparablePath $shortcut.TargetPath
  $workingDirectory = ConvertTo-ComparablePath $shortcut.WorkingDirectory
  $arguments = [string]$shortcut.Arguments

  $repoPath = ConvertTo-ComparablePath $repoRoot
  $expectedWscript = ConvertTo-ComparablePath (Join-Path $env:WINDIR 'System32\wscript.exe')
  $expectedElectron = ConvertTo-ComparablePath (Join-Path $repoRoot 'node_modules\electron\dist\electron.exe')

  if ($targetPath -eq $expectedWscript -and $arguments.IndexOf($launcherPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    return $true
  }

  if ($targetPath -eq $expectedElectron -and $workingDirectory -eq $repoPath) {
    return $true
  }

  return $false
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
  Set-EzvibesShortcutAppId -ShortcutPath $ShortcutPath
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
$unrelatedElectronPinSkipped = $false

if ((Test-Path -LiteralPath $electronPin) -and -not (Test-Path -LiteralPath $ezvibesPin)) {
  if (Test-EzvibesShortcut -ShortcutPath $electronPin) {
    Move-Item -LiteralPath $electronPin -Destination $ezvibesPin
  } else {
    $unrelatedElectronPinSkipped = $true
  }
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
if ($unrelatedElectronPinSkipped) {
  Write-Host "Skipped unrelated Electron taskbar pin: $electronPin"
}
if ($CreateStartupShortcut) {
  Write-Host "Startup shortcut: $startupShortcut"
}
