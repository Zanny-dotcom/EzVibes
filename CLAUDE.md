# EZvibes

This file is the canonical source of truth for the project. Read it before any non-trivial change.

## Purpose

Standalone Electron app at `C:\Users\Oskari\Documents\EZvibes`. A simplified Explorer-style launcher for folder-scoped Claude sessions.

Core interaction:

1. Browse folders in an Explorer-like grid.
2. Right-click a folder and choose `Launch Claude`.
3. The app opens a folder-shaped popup containing an embedded terminal.
4. The terminal starts in that folder and runs:

   ```powershell
   claude --dangerously-skip-permissions
   ```

5. The popup title uses the folder name.
6. Minimizing the popup animates it back toward the source folder (Genie).
7. The source folder turns orange while the Claude session is minimized.
8. Double-clicking the orange folder restores the running session.

## Stack

- Electron 42
- Vanilla JavaScript, HTML, CSS (no React, TypeScript, bundler, or tests)
- `node-pty@1.1.0` for real interactive terminal sessions
- `@xterm/xterm@5.5.0` for terminal rendering
- `@xterm/addon-fit@0.10.0` for terminal sizing

## Key Files

- `package.json` — app scripts and dependencies.
- `main.js` — Electron main process, directory listing IPC, PTY session lifecycle, system clipboard IPC, suppressed default menu.
- `preload.js` — safe `contextBridge` API exposed as `window.ezvibes` (folder browsing, terminal IPC, clipboard, `webUtils.getPathForFile`).
- `renderer/index.html` — app shell, narration-sidebar markup, script/style loading.
- `renderer/app.js` — folder browser UI, context menu, session window + tab state, terminal popup lifecycle, narration sidebar logic. One IIFE, ~1200 lines.
- `renderer/panel-mode.js` — panel-mode toggle: region registry, hover highlight overlay, click composer, dispatch into active EZvibes terminal tab (clipboard fallback). Pure renderer, no main-process / IPC additions; reaches into `app.js` via `window.ezvibesInternals` only to resolve the active tab.
- `renderer/styles.css` — Explorer-like UI, folder visuals, orange minimized state, Genie-style animations, narration sidebar.
- `scripts/postinstall.js` — patches/rebuilds `node-pty` for Windows/Electron.
- `scripts/build-ezvibes-icon.ps1` — one-off PowerShell generator that draws a yellow folder + black "Z" via .NET System.Drawing and writes `renderer/ezvibes.ico` (PNG-in-ICO at 16/24/32/48/64/128/256 px).
- `renderer/ezvibes.ico` — generated icon for the Windows shortcut. Committed; re-run the generator if you tweak the design.
- `ezvibes.vbs` — silent Electron launcher. Invoked via `wscript.exe` so launching from a shortcut shows no console window. Resolves the app dir from its own path.
- `startup/Install-EzvibesShortcuts.ps1` — installs the Start Menu shortcut, refreshes any existing taskbar pin, and optionally writes a Startup folder shortcut. See `startup/README.md`.
- `docs/superpowers/specs/` — approved feature designs.
- `docs/superpowers/plans/` — in-flight feature plans.
- `tab-plan.md` — design + step-by-step implementation outline for Chrome-style tabs per session window. **Implemented; retained for reference.**

## Launch

```powershell
cd C:\Users\Oskari\Documents\EZvibes
npm start
```

Install/rebuild:

```powershell
npm install
npm run electron:install
npm run rebuild:native
```

`npm install` runs `scripts/postinstall.js`, which patches `node-pty` build files and runs the local `electron-rebuild` binary. `npm run electron:install` prewarms Electron's runtime binary for repo-launched shortcuts, and `npm run rebuild:native` force-rebuilds `node-pty` against the installed Electron version.

## ezvibes Launcher

EZvibes can also be launched and pinned to the taskbar as a normal Windows app, surfaced by searching `ezvibes` in the Start menu.

One-time setup:

```powershell
./scripts/build-ezvibes-icon.ps1   # only if renderer/ezvibes.ico is missing or you tweaked the design
npm run electron:install
npm run rebuild:native
./startup/Install-EzvibesShortcuts.ps1
```

Then press **Win**, type `ezvibes`, right-click the result, and choose **Pin to taskbar**. Re-running `Install-EzvibesShortcuts.ps1` will keep that pin in sync with the latest launcher + icon. Add `-CreateStartupShortcut` to also auto-launch EZvibes at sign-in. See `startup/README.md` for details.

The shortcut targets `wscript.exe ezvibes.vbs`, which runs Electron without a console window flash.

The main process sets Windows AppUserModelID `com.ezvibes.app`, and the shortcut installer stamps the same ID onto Start Menu/taskbar shortcuts. `BrowserWindow` also uses `renderer/ezvibes.ico`, so launched windows group with the pinned Z folder shortcut instead of Electron's default identity.

## Runtime Model

Renderer code must not use Node/Electron directly. It talks to main through `window.ezvibes` from `preload.js`.

Main IPC channels:

- `app:initial-path`
- `app:quick-paths`
- `fs:list-directory`
- `terminal:create`
- `terminal:input`
- `terminal:resize`
- `terminal:close`
- `terminal:data` (main → renderer)
- `terminal:exit` (main → renderer)
- `app:live-log`
- `app:live-log-entry` (main → renderer)
- `app:log`
- `app:close-requested` (main → renderer)
- `app:confirm-close`
- `clipboard:read`
- `clipboard:write`

Preload API on `window.ezvibes`: `getInitialPath`, `getQuickPaths`, `listDirectory`, `createTerminal`, `writeTerminal`, `resizeTerminal`, `closeTerminal`, `onTerminalData`, `onTerminalExit`, `getLiveLog`, `onLiveLogEntry`, `logEvent`, `onAppCloseRequested`, `confirmAppClose`, `readClipboard`, `writeClipboard`, `getPathForFile`.

Terminal sessions are stored in `main.js` in a `Map` keyed by renderer-created `sessionId`; each record also stores the owning `webContents` id so other renderers cannot write to or close it. The renderer groups PTYs into session windows (one per folder), each holding one or more tabs. State lives in:

- `state.windowsByPath` — `Map<folderPath, SessionWindow>`. One session window per folder.
- `state.tabsById` — `Map<tabId, Tab>`. The tab id doubles as the IPC `sessionId` passed to main.

Each `SessionWindow` carries `tabs: Tab[]`, an `activeTabId`, and a monotonic `nextTabNumber` (used for default numeric tab labels; never reused after a tab closes).

Minimized session windows keep all their tab PTYs running. Closing a tab kills that tab's PTY; closing the last tab closes the whole window.

The default Electron application menu is suppressed (`Menu.setApplicationMenu(null)`).

## Operational Diagnostics

EZvibes has a live diagnostics log for app lifecycle and terminal session events. The top bar `LOG` button opens an in-app Live Log drawer. The drawer shows the most recent in-memory events and the current disk log path.

Durable logs are written as JSONL files under:

```powershell
$env:APPDATA\EZvibes\logs\ezvibes-YYYY-MM-DD.jsonl
```

The log records app/window lifecycle, close attempts, renderer failures, PTY creation/exits/kills, and renderer diagnostic events. It intentionally does not record terminal input/output text, prompts, model responses, or shell scrollback.

If a top-level app close is requested while live PTY sessions exist, `main.js` prevents the close and asks the renderer to show an `Exit EZvibes?` confirmation. The safe default is to stay in the app. Confirming the dialog allows the close and kills all live sessions; cancelling leaves the app and sessions running.

The safety/diagnostics plan lives at `docs/superpowers/plans/2026-05-26-ezvibes-safety-logging.md`.

## Agent Launch Details

`main.js` resolves agent executables before creating a PTY. The preferred launch path is direct:

- Claude: `claude.exe --dangerously-skip-permissions`
- Codex: native `codex.exe --yolo` from the installed `@openai/codex` package

The PTY environment is intentionally small, but keeps Windows command-resolution basics such as `PATH`, `PATHEXT`, `SystemRoot`, `SystemDrive`, user profile paths, temp paths, and npm / `.local\bin` command folders. Secrets such as `*KEY*`, `*TOKEN*`, `*SECRET*`, `AWS_*`, `AZURE_*`, `OPENAI_*`, and `ANTHROPIC_*` are stripped. PowerShell/CMD wrappers are used only as fallbacks when a direct executable cannot be found.

## Terminal Fit Fix

The terminal popup is a visual folder frame, but xterm must not measure against that padded frame. The current structure is:

```html
<div class="terminal-pocket">
  <div class="terminal-host"></div>
</div>
```

xterm opens inside `.terminal-host`.

Important sizing behavior in `renderer/app.js`:

- Waits for the Genie opening animation to finish.
- Waits for `document.fonts.ready`.
- Waits until the active `.terminal-host` has a usable non-zero layout box and `fitAddon.proposeDimensions()` returns finite rows/cols.
- Then calls `fitAddon.fit()`, sends a PTY resize only when the terminal dimensions changed, refreshes the viewport, and scrolls to bottom when the tab was previously at bottom or was revealed after hidden output.
- Uses a per-session `ResizeObserver` on `.terminal-pocket` to schedule the active tab's visible-terminal reconcile path.

This avoids fitting against 0x0/stale hidden hosts and prevents terminal edge or bottom clipping.

## Current UX

- Starts at the user's Documents folder.
- Sidebar has quick links for Home, Desktop, Documents, Downloads, and EZvibes when present.
- Search filters visible folder/file entries.
- Double-clicking a normal folder navigates into it.
- Right-clicking a folder opens actions (`Launch Claude`, minimize/restore when a session window exists, rename, etc.).
- Right-clicking a file has no real actions yet.
- `Launch Claude Here` launches a Claude session window for the current directory.
- Session windows show a Chrome-style tab strip at the top. Each tab is an independent PTY running in the window's folder; today the agent is either `claude --dangerously-skip-permissions` or `codex --yolo`.
- Each session window also shows a small `.folder-name-label` chip on the yellow top strip, just left of the minimize/close buttons. It displays the folder basename (e.g., `EZvibes`) so the user can tell which folder the window is rooted in; hovering shows the full path via the `title` attribute. The value is captured once at window creation.
- Tabs are labelled by their agent. Default labels are `CLAUDE` / `CODEX`; the second-and-later tabs in a window also carry the per-window monotonic counter as a suffix (`CLAUDE 2`, `CODEX 3`). The counter is never reused after a tab closes.
- Right-click a tab chip → Rename to override the default label with a custom name. Typing the literal default back in clears the custom name.
- Codex chips are tinted teal so they read as distinct from the amber Claude chips. Active / hover / exited modifiers mirror across both palettes.
- Each tab chip has a small hover close button (Chrome-style). Closing the last tab closes the whole session window.
- The `+` button on the strip is dual-action: **left-click** starts another `claude --dangerously-skip-permissions` tab in the same folder; **right-click** starts a `codex --yolo` tab instead. The initial tab created when a folder is first launched is always Claude.
- Minimize/restore still operate on the whole session window; PTYs for every tab keep running while minimized, and the source folder card stays orange.
- Launching for (or reopening) a folder that already has a session window restores that window and focuses its active tab rather than creating a new one.
- Narration sidebar ("What Was Made") toggles open via the header button. It shows a per-folder activity log for any Claude session that has run in that folder, plus a session summary. Tab open/close events are folded into the same folder log.
- The topbar `◫` button toggles Panel Mode: hover any major UI region to highlight it (folder cards, session windows, tab chips, terminal frame, etc.), click to open a small composer, type a request, hit Send. The renderer builds a structured payload (region name + selector + `file:line` + the user's text), wraps it in bracketed-paste markers, and writes it into the active live terminal tab for the EZvibes folder. If no live tab exists, the unwrapped payload is copied to the clipboard and a 2.5s toast surfaces inside the composer. Escape exits the mode (or closes the composer first). The selectable regions live in a curated registry in `renderer/panel-mode.js`; static regions are tagged with `data-panel-id` in `renderer/index.html`, dynamic ones in their builders in `renderer/app.js`.
- System clipboard works in input fields via right-click (cut/copy/paste/select-all).

## Known Limitations / Next Improvements

- No persistent session state across app restarts.
- Tabs are in-memory only; closing the app loses tab state (labels, custom names, count).
- No tab keyboard shortcuts yet (Ctrl+Tab, Ctrl+W, etc.).
- Tabs cannot be reordered or detached into separate windows.
- No file operations yet: rename, delete, copy, move, create folder.
- No watcher yet, so folder contents do not live-refresh.
- No breadcrumb segments yet, only a path bar.
- No multi-window support.
- No tests yet.
- No packaged build config yet.
- Folder icons are CSS-drawn, not native Windows icons/thumbnails.
- Orange minimized state exists only in memory.
- Panel mode's EZvibes folder path is a hard-coded constant in `renderer/panel-mode.js` (`EZVIBES_FOLDER`). Moving the repo means editing one line.
- If the selected folder is no longer visible after navigation, restore/minimize animation falls back to screen center.
- First-time taskbar pin still requires the user to right-click the Start menu result and select "Pin to taskbar"; subsequent re-runs of `startup/Install-EzvibesShortcuts.ps1` keep the pin in sync.

## Cautions

- Keep the terminal embedded through `node-pty`; do not replace it with a normal PowerShell window. The product requirement is an in-app terminal popup.
- Be careful changing terminal sizing. xterm should open in `.terminal-host`, not `.terminal-pocket`.
- Do not remove the delayed stable-fit sequence unless you replace it with an equivalent layout-safe approach.
- Hidden terminal hosts (`.terminal-host[hidden]` / inactive tabs) measure 0×0. Do not call `fitAddon.fit()` on them — only fit the active tab.
- When switching tabs, refit the newly active tab after a layout frame; any fit applied to a host that is now hidden is stale and will mis-size the next time that tab becomes active.
- `claude --dangerously-skip-permissions` is intentionally powerful. Any future UI that broadens launch behavior should make the target folder and command explicit.
- The `agent` field in the `terminal:create` IPC payload is currently a two-value enum (`'claude'` | `'codex'`); `main.js` defaults unknown values to `'claude'`. Adding a third agent means updating `AGENT_COMMANDS` in `main.js` **and** the `agent === 'codex' ? ... : ...` ternaries in `renderer/app.js` (`buildTab`, `createTab`, `attachTabChip`, `defaultTabLabel`, and the exit handler). If a third agent is on the roadmap, normalize those into a single `KNOWN_AGENTS` set in one place.
- `node-pty` rebuilds are fragile on Windows. If install fails, check `scripts/postinstall.js` and generated Visual Studio project files for Spectre-mitigation settings.
