# Electron 42 Upgrade Plan

## Goal

Upgrade EZvibes from `electron@33.4.11` to `electron@42.2.0` while keeping the current repo-launched workflow working first. Packaging can be handled after the runtime upgrade is stable.

Current important facts:

- Current Electron: `33.4.11`
- Target Electron: `42.2.0`
- Current Electron ABI: `130`
- Target Electron ABI: `146`
- Target Electron runtime stack: Chromium `148.0.7778.97`, Node `24.15.0`, V8 `14.8.178.14`
- Native runtime dependency: `node-pty@1.1.0`
- Local host Node checked during planning: `v24.13.0`
- `@electron/rebuild@4.0.4` requires host Node `>=22.12.0`

Official references:

- Electron breaking changes: https://www.electronjs.org/docs/latest/breaking-changes
- Electron 42 release: https://releases.electronjs.org/release/v42.2.0
- Electron installation docs: https://www.electronjs.org/docs/latest/tutorial/installation
- Native Node modules docs: https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules

## What Was Checked

### Native Modules

EZvibes has one native runtime module: `node-pty`.

Relevant files:

- `main.js` imports `node-pty`.
- `main.js` calls `pty.spawn(...)` for Claude/Codex terminals.
- `scripts/postinstall.js` patches and rebuilds `node-pty`.
- `package-lock.json` currently locks Electron `33.4.11`.

The installed `node-pty` build was verified as Electron 33 ABI `130`:

```text
node_modules/node-pty/build/Release/.forge-meta -> x64--130
node_modules/node-pty/build/config.gypi -> node_module_version 130, target 33.4.11
```

Electron `42.2.0` needs ABI `146`, so `node-pty` must be rebuilt after the Electron bump.

### Electron 42 Binary Download Behavior

Electron 42 no longer downloads the Electron binary during package `postinstall`. It downloads on first `electron` bin run, or via `install-electron`.

This matters because `ezvibes.vbs` directly checks:

```text
node_modules\electron\dist\electron.exe
```

After a fresh install, `ezvibes.vbs` and shortcuts can falsely report Electron as missing unless the binary has been prewarmed.

### Breaking Changes 34-42

Current active code is mostly unaffected by Electron API removals between 34 and 42:

- `WebFrameMain` detached/null behavior is not active because EZvibes does not currently use `WebFrameMain`, `event.senderFrame`, or `webFrameMain`.
- Electron 39 `window.open` resizable-popup behavior is not relevant because all popups are denied.
- `--host-rules` deprecation is not relevant because EZvibes does not use host resolver switches.
- Linux dialog/Wayland/GTK/dark-theme changes are not active code paths for this Windows-oriented app.
- Electron 40 renderer `clipboard` deprecation is not an issue because clipboard access is bridged through preload/main IPC.

Still relevant:

- Native ABI jump: Electron 33 ABI `130` to Electron 42 ABI `146`.
- Electron 42 lazy binary download.
- Electron 38+ requires macOS 12+ if macOS support is ever relevant. Windows 10+ is already the practical floor.

## Phase 0: Preserve Current State

1. Check the dirty worktree.

   ```powershell
   git status --short
   ```

2. Do not mix the Electron upgrade with unrelated existing edits in:

   - `main.js`
   - `preload.js`
   - `renderer/app.js`
   - `renderer/styles.css`

3. Create a branch.

   ```powershell
   git switch -c upgrade/electron-42
   ```

## Phase 1: Add Upgrade Guardrails

### Add Toolchain Requirements

Add this to `package.json`:

```json
"engines": {
  "node": ">=22.12.0"
}
```

Optionally add `.node-version`:

```text
24.13.0
```

Windows build prerequisites to document:

- Node `>=22.12.0`
- npm compatible with that Node version
- Python available to `node-gyp`
- Visual Studio 2022 Build Tools
- Desktop development with C++ workload
- Windows SDK

### Add Scripts

Add scripts like these:

```json
"check:syntax": "node --check main.js && node --check preload.js && node --check renderer/app.js && node --check scripts/postinstall.js",
"electron:install": "install-electron --no",
"rebuild:native": "electron-rebuild --force --which-module node-pty --build-from-source",
"rebuild": "node scripts/postinstall.js"
```

Notes:

- `electron:install` handles Electron 42 lazy binary download.
- `rebuild:native` force-rebuilds only `node-pty`.
- `rebuild` should run the repo's patch-and-rebuild flow.

### Harden `scripts/postinstall.js`

Update `scripts/postinstall.js` so it:

- Fails if expected `node-pty` patch files are missing.
- Counts replacements and fails if expected replacement strings are not found.
- Uses the local `node_modules\.bin\electron-rebuild.cmd`, not bare `npx`.
- Force-rebuilds `node-pty`.
- Prints the target Electron version and expected ABI where possible.

Current risk:

- The script silently skips missing files.
- It logs success even if patch strings do not match.
- `npx @electron/rebuild` can fetch or fail unpredictably in offline/CI setups.

## Phase 2: Fix Electron 42 Install Flow

Electron 42's binary must be prewarmed before direct launcher use.

Required setup flow after the bump:

```powershell
npm install
npm run electron:install
npm run rebuild:native
```

Update docs and installer behavior:

- `CLAUDE.md`
- `startup/README.md`
- `startup/Install-EzvibesShortcuts.ps1`

Recommended installer behavior:

- Validate `node_modules\electron\dist\electron.exe` before writing shortcuts.
- If missing, print a clear instruction:

  ```powershell
  npm run electron:install
  npm run rebuild:native
  ```

Do not use `ELECTRON_SKIP_BINARY_DOWNLOAD` as a new flow. Electron 42 removed the old behavior around that install path.

## Phase 3: Add Minimum Security Hardening

These are not Electron 42 breaking changes, but they should land during the upgrade because EZvibes exposes powerful preload and PTY capabilities.

### Block Top-Level Navigation

In `main.js`, keep popup denial and add top-level navigation blocking.

Current:

```js
win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
```

Add:

- `will-navigate` handler that prevents navigation away from the app document.
- Optional `will-redirect` handling if future navigation flows are added.

Goal:

- Remote pages must never receive `window.ezvibes`.

### Deny Permissions By Default

Add deny-by-default permission handlers:

```js
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
  callback(false);
});

session.defaultSession.setPermissionCheckHandler(() => false);
```

This requires importing `session` from Electron.

### Own PTY Sessions By WebContents

Current sessions are global by renderer-created `sessionId`.

Change `sessions` from:

```js
Map<sessionId, pty>
```

to:

```js
Map<sessionId, { pty, ownerWebContentsId }>
```

Then:

- On `terminal:create`, store `event.sender.id`.
- On `terminal:input`, `terminal:resize`, and `terminal:close`, reject calls from a different `event.sender.id`.
- Route output to the owning `webContents`, not `currentMainWindow`.
- Kill sessions owned by a renderer when that renderer crashes, reloads, navigates away, or closes.

### Sanitize PTY Environment

Current code passes:

```js
const env = { ...process.env };
```

Replace with a small allowlist and explicit secret stripping.

Keep basics:

- `PATH`
- `Path`
- `SystemRoot`
- `WINDIR`
- `USERPROFILE`
- `APPDATA`
- `LOCALAPPDATA`
- `TEMP`
- `TMP`
- `ComSpec`
- `PSModulePath`

Drop variables matching:

- `*KEY*`
- `*TOKEN*`
- `*SECRET*`
- `AWS_*`
- `AZURE_*`
- `OPENAI_*`
- `ANTHROPIC_*`

Test with sentinel env vars before and after.

## Phase 4: Bump Electron

Run:

```powershell
npm install --save-dev electron@42.2.0 @electron/rebuild@4.0.4
npm run electron:install
npm run rebuild:native
npm run check:syntax
npm audit
```

Expected:

- `electron@42.2.0`
- Electron Node `24.15.0`
- Electron modules/ABI `146`
- `npm audit` no longer reports the current Electron high vulnerability.

## Phase 5: Verify `node-pty` ABI

Run:

```powershell
node -e "const abi=require('node-abi'); const e=require('electron/package.json').version; console.log(e, abi.getAbi(e,'electron'))"
```

Expected:

```text
42.2.0 146
```

Check native metadata:

```powershell
Get-Content .\node_modules\node-pty\build\Release\.forge-meta
Select-String -Path .\node_modules\node-pty\build\config.gypi -Pattern '"node_module_version"|"runtime"|"target"|"nodedir"'
```

Expected:

```text
x64--146
node_module_version: 146
runtime: electron
target: 42.2.0
```

Test native load inside Electron:

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
.\node_modules\electron\dist\electron.exe -e "console.log(process.versions.electron, process.versions.node, process.versions.modules); require('node-pty'); console.log('node-pty ok')"
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

Expected:

```text
42.2.0 24.15.0 146
node-pty ok
```

## Phase 6: Smoke Test The App

### Launch Tests

Run:

```powershell
npm start
```

Then run:

```powershell
.\ezvibes.vbs
```

Expected:

- App window opens.
- No console flash from VBS.
- No "Electron is not installed" message.
- App icon still groups correctly in taskbar.

### Manual Functional Tests

Test:

- Folder browsing.
- Quick paths.
- Search input.
- Right-click folder context menu.
- `Launch Claude Here`.
- Right-click folder -> `Launch Claude`.
- Add Claude tab.
- Add Codex tab.
- Terminal input.
- Terminal output.
- Terminal resize after window resize.
- Hidden tab receives output and restores correctly.
- Session minimize/restore.
- Close middle tab.
- Close last tab.
- Close whole session.
- App quit kills PTYs.
- Clipboard copy/paste in inputs.
- Clipboard copy/paste in terminal.
- Drag/drop folder into grid.
- Drag/drop path into terminal.

Also check Task Manager for orphan processes after quit:

- `powershell.exe`
- `pwsh.exe`
- `claude`
- `codex`

## Phase 7: Add Automated Smoke Tests

Recommended harness:

- Playwright Electron.
- Fake `claude.cmd` and `codex.cmd` in a temporary directory prepended to `PATH`.
- Fake commands print marker text and echo input so tests do not depend on real Claude/Codex installs.

Minimum tests:

1. App opens.
2. `window.ezvibes` exists on the app page.
3. Attempted navigation to `https://example.com` is blocked.
4. Fake Claude session launches.
5. Xterm shows marker text.
6. Input reaches PTY exactly once.
7. Resize sends nonzero cols/rows.
8. Hidden tab is not fit at `0x0`.
9. Minimize/restore keeps terminal output visible.
10. Closing tab kills its PTY.
11. Closing app kills all PTYs.
12. Clipboard bridge still supports intended paste/copy workflows.

Keep these as manual initially:

- Native Explorer drag/drop using real disk-backed `File` objects.
- Shortcut pinning/taskbar grouping.
- Display scaling checks at 100%, 125%, and 150%.

## Phase 8: Distribution Decision

After repo-launched Electron 42 works, choose one path.

### Option A: Keep Repo-Launched App

Document setup:

```powershell
npm install
npm run electron:install
npm run rebuild:native
.\startup\Install-EzvibesShortcuts.ps1
```

Keep:

- `ezvibes.vbs`
- Start Menu shortcut installer
- `node_modules\electron\dist\electron.exe` launcher contract

### Option B: Package As A Real App

Add Forge or electron-builder.

Required packaging work:

- Make shortcuts point to packaged `EZvibes.exe`, not `node_modules\electron\dist\electron.exe`.
- Copy or bundle xterm assets instead of loading directly from `../node_modules`.
- Configure native unpack for `node-pty`.
- Smoke-test packaged app on a clean Windows profile.
- Cache Electron downloads and native build output in CI.

Do this after the Electron 42 repo-launched upgrade is stable.

## Suggested Commit Sequence

1. `chore: add electron upgrade guardrails`
   - `engines`
   - `.node-version`
   - scripts
   - syntax check

2. `build: harden node-pty rebuild flow`
   - deterministic patch checks
   - local `electron-rebuild`
   - explicit native rebuild

3. `main: harden navigation permissions and PTY ownership`
   - navigation block
   - permission deny
   - PTY owner validation
   - env sanitizer

4. `chore: upgrade electron to 42`
   - `package.json`
   - `package-lock.json`
   - verified rebuild

5. `docs: update electron 42 setup flow`
   - `CLAUDE.md`
   - `startup/README.md`
   - installer guidance

6. `test: add electron smoke harness`
   - Playwright Electron
   - fake agent CLIs
   - terminal lifecycle tests

## Quick Resume Checklist

Start here tomorrow:

```powershell
cd C:\Users\Oskari\Documents\EZvibes
git status --short
node -v
npm -v
npm audit
```

Then implement Phase 1 first. Do not bump Electron until `postinstall.js`, `electron:install`, and the basic hardening are in place.
