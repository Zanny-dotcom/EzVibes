# ezvibes Windows Shortcuts

Run these from PowerShell at the repo root.

## One-time icon generation

The committed `renderer/ezvibes.ico` is the output of:

```powershell
./scripts/build-ezvibes-icon.ps1
```

Only re-run this if you edit the generator script and want to update the icon.

## Install / refresh shortcuts

Electron 42 downloads the Electron runtime on first explicit install/run, not during package postinstall. Before installing shortcuts on a fresh checkout, run:

```powershell
npm install
npm run electron:install
npm run rebuild:native
```

The shortcut installer checks for `node_modules\electron\dist\electron.exe` and prints these commands if the runtime is missing.

```powershell
./startup/Install-EzvibesShortcuts.ps1
```

This:

- Writes `ezvibes.lnk` to your user Start Menu (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\`). Windows Search indexes this, so typing `ezvibes` in the Start menu surfaces it.
- Refreshes an existing taskbar pin (renaming an EZvibes-owned stale `Electron.lnk` if present) so the pin targets `wscript.exe ezvibes.vbs` with the Z folder icon.
- Refreshes Explorer's icon cache via `ie4uinit.exe -show`.

## Auto-launch at sign-in

```powershell
./startup/Install-EzvibesShortcuts.ps1 -CreateStartupShortcut
```

Adds `ezvibes.lnk` to `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`. Remove that file to stop auto-launch.

## First-time taskbar pinning (one manual step)

Modern Windows blocks programmatic taskbar pin creation. The first time:

1. Press **Win**, type `ezvibes`, **right-click** the result, choose **Pin to taskbar**.
2. Re-run `./startup/Install-EzvibesShortcuts.ps1` — it will detect the pin and refresh it with the correct icon/target.

After that, re-running the installer keeps the pin in sync with whatever the launcher and icon currently are.
