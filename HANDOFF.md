# Claude Control Panel - Handoff

## Purpose

This is a standalone Electron app in `C:\Users\Oskari\Documents\CP`.

It is a simplified Explorer-style control panel for launching folder-scoped
Claude sessions. The user can browse folders, right-click any folder, and launch
Claude inside that folder without opening a normal PowerShell window.

Core interaction:

1. Browse folders in an Explorer-like grid.
2. Right-click a folder and choose `Launch Claude`.
3. The app opens a folder-shaped popup containing an embedded terminal.
4. The terminal starts in that folder and runs:

   ```powershell
   claude --dangerously-skip-permissions
   ```

5. The popup title uses the folder name.
6. Minimizing the popup animates it back toward the source folder.
7. The source folder turns orange while the Claude session is minimized.
8. Double-clicking the orange folder restores the running session.

## Stack

- Electron 33
- Vanilla JavaScript, HTML, CSS
- `node-pty` for real interactive terminal sessions
- `@xterm/xterm` for terminal rendering
- `@xterm/addon-fit` for terminal sizing

There is no React, TypeScript, bundler, or test framework yet.

## Key Files

- `package.json` - app scripts and dependencies.
- `main.js` - Electron main process, directory listing IPC, PTY session lifecycle.
- `preload.js` - safe `contextBridge` API exposed as `window.controlPanel`.
- `renderer/index.html` - app shell and script/style loading.
- `renderer/app.js` - folder browser UI, context menu, session state, terminal popup lifecycle.
- `renderer/styles.css` - Explorer-like UI, folder visuals, orange minimized state, Genie-style animations.
- `scripts/postinstall.js` - patches/rebuilds `node-pty` for Windows/Electron.

## Launch

```powershell
cd C:\Users\Oskari\Documents\CP
npm start
```

Install/rebuild:

```powershell
npm install
```

`npm install` runs `scripts/postinstall.js`, which patches `node-pty` build files
and runs `@electron/rebuild`.

## Runtime Model

Renderer code must not use Node/Electron directly. It talks to main through
`window.controlPanel` from `preload.js`.

Main IPC currently exposes:

- `app:initial-path`
- `app:quick-paths`
- `fs:list-directory`
- `terminal:create`
- `terminal:input`
- `terminal:resize`
- `terminal:close`
- `terminal:data`
- `terminal:exit`

Terminal sessions are stored in `main.js` in a `Map` keyed by renderer-created
`sessionId`. Renderer keeps matching state in:

- `sessionsByPath`
- `sessionsById`

Minimized sessions keep running. Closing a session kills the PTY.

## Claude Launch Details

`main.js` detects `pwsh` first, then falls back to `powershell.exe`.

For PowerShell shells, it uses `-EncodedCommand` with UTF-16LE base64. The
script:

- installs a prompt wrapper that emits OSC cwd updates,
- `Set-Location`s to the selected folder,
- runs `claude --dangerously-skip-permissions`.

For non-PowerShell shells, it falls back to spawning the shell in the selected
folder and writing the Claude command after a short delay.

## Terminal Fit Fix

The terminal popup is a visual folder frame, but xterm must not measure against
that padded frame. The current structure is:

```html
<div class="terminal-pocket">
  <div class="terminal-host"></div>
</div>
```

xterm opens inside `.terminal-host`.

Important sizing behavior in `renderer/app.js`:

- Waits for the Genie opening animation to finish.
- Waits for `document.fonts.ready`.
- Waits two `requestAnimationFrame` ticks.
- Then calls `fitAddon.fit()` and sends the PTY resize.
- Uses a per-session `ResizeObserver` on `.terminal-host`.

This avoids clipping the right edge of terminal content.

## Current UX

- Starts at the user's Documents folder.
- Sidebar has quick links for Home, Desktop, Documents, Downloads, and CP when present.
- Search filters visible folder/file entries.
- Double-clicking a normal folder navigates into it.
- Right-clicking a folder opens actions.
- Right-clicking a file has no real actions yet.
- `Launch Claude Here` launches a Claude session for the current directory.

## Known Limitations / Next Improvements

- No persistent session state across app restarts.
- No file operations yet: rename, delete, copy, move, create folder.
- No watcher yet, so folder contents do not live-refresh.
- No breadcrumb segments yet, only a path bar.
- No multi-window support.
- No tests yet.
- No packaged build config yet.
- Folder icons are CSS-drawn, not native Windows icons/thumbnails.
- Orange minimized state exists only in memory.
- If the selected folder is no longer visible after navigation, restore/minimize animation falls back to screen center.

## Cautions

- Keep the terminal embedded through `node-pty`; do not replace it with a normal
  PowerShell window. The product requirement is an in-app terminal popup.
- Be careful changing terminal sizing. xterm should open in `.terminal-host`,
  not `.terminal-pocket`.
- Do not remove the delayed stable-fit sequence unless you replace it with an
  equivalent layout-safe approach.
- `claude --dangerously-skip-permissions` is intentionally powerful. Any future
  UI that broadens launch behavior should make the target folder and command
  explicit.
- `node-pty` rebuilds are fragile on Windows. If install fails, check
  `scripts/postinstall.js` and generated Visual Studio project files for
  Spectre-mitigation settings.
