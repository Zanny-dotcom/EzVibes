# EZvibes — Codebase Audit + Research Summary

**Generated:** 2026-05-25
**Method:** 15 parallel codebase-audit agents → synthesis → 15 parallel research agents (each carrying the full facts pack, with up to 20% off-topic spread) → this consolidated summary.
**Scope:** Everything tracked in `C:\Users\Oskari\Documents\EZvibes` plus 2024–2026 external context on Electron, node-pty, xterm.js, PowerShell shell-integration, Windows shell APIs, AI-agent CLIs, packaging/signing, and prior-art terminal apps.

---

## 1. Executive Summary

EZvibes is an Electron 33 desktop app that turns the Windows file-system into a launcher for folder-scoped AI agent sessions. Right-click a folder → embedded xterm popup running `claude --dangerously-skip-permissions` or `codex --yolo`. Minimize → Genie animation back to the source folder, which turns orange. Tabs per session window.

The codebase is small (~287 lines `main.js`, ~25 lines `preload.js`, ~1916-line single-IIFE `renderer/app.js`, ~1047 lines CSS), hardened on the Electron security baseline (`contextIsolation`/`sandbox`/`nodeIntegration:false`/`webSecurity` all set, allowlisted preload, popup-deny, CSP), and intentionally unconstrained at the agent boundary (`--dangerously-skip-permissions` / `--yolo` are EZvibes's whole value).

Three load-bearing subsystems:
1. **PTY plumbing** — IPC bridge, shell detection, PowerShell `-EncodedCommand` with ConEmu OSC 9;9 cwd reporting.
2. **Visual choreography** — Genie animation pair + fit-after-stable-layout recipe + folder-shaped CSS.
3. **Windows identity** — AppUserModelID `com.ezvibes.EZvibes` set in three places (main.js, BrowserWindow icon, shortcut PropertyStore).

Largest single piece of debt: **7 duplicated `agent === 'codex'` ternary sites in `renderer/app.js`** + `AGENT_COMMANDS` in `main.js` — must consolidate to a `KNOWN_AGENTS` table before adding a third agent.

Largest single piece of latent risk: **Electron 33 reached end of Chromium back-port support in spring 2025**. V8 CVE-2025-10585 (KEV-listed) is unpatched in this line.

---

## 2. Project Snapshot

### 2.1 Stack
- **Runtime:** Electron 33.4.11 (devDep `^33.0.0`), Node ABI 130.
- **Native:** `node-pty@1.1.0` (exact pin), patched + rebuilt via `scripts/postinstall.js` + `@electron/rebuild@4.0.4` (needs Node ≥22.12.0).
- **Terminal:** `@xterm/xterm@^5.5.0`, `@xterm/addon-fit@^0.10.0`. DOM renderer (no canvas/webgl addon).
- **Language:** Vanilla JS + HTML + CSS. No TypeScript, no bundler, no React/Vue/Solid, no tests.
- **Build/packaging:** None. No `electron-builder`, `@electron-forge`, or `electron-packager`. No CI.

### 2.2 Repository Map
```
EZvibes/
├── CLAUDE.md                       canonical project doc (auto-loads)
├── package.json, package-lock.json
├── main.js                         Electron main + IPC + PTY lifecycle (287 lines)
├── preload.js                      contextBridge (25 lines, 13 exposed methods)
├── ezvibes.vbs                     silent wscript.exe launcher (18 lines)
├── renderer/
│   ├── index.html                  shell + CSP meta + narration markup (68 lines)
│   ├── app.js                      single IIFE — browser/tabs/Genie/narration (1916 lines)
│   ├── styles.css                  Explorer UI + folder visuals + Genie keyframes (1047 lines)
│   └── ezvibes.ico                 committed yellow-folder-Z icon (PNG-in-ICO)
├── scripts/
│   ├── postinstall.js              node-pty winpty/Spectre patch + electron-rebuild (48 lines)
│   └── build-ezvibes-icon.ps1      System.Drawing icon generator (166 lines)
├── startup/
│   ├── Install-EzvibesShortcuts.ps1 Start Menu + taskbar pin refresh (234 lines)
│   └── README.md
├── docs/superpowers/
│   ├── specs/  ← 3 approved/implemented
│   └── plans/  ← 4 done-on-main
├── browser.md                      audit of sibling Terminal-Emulator's browser-tab pipeline (1088 lines, NOT mentioned in CLAUDE.md)
├── browser-plan.md                 plan for <webview> browser tabs as 3rd tab kind (1416 lines, NOT mentioned in CLAUDE.md)
├── research/                       empty
└── .obsidian/                      untracked vault config
```

**Stale doc reference:** `CLAUDE.md` lists `tab-plan.md` as "implemented; retained for reference" — but the file is **absent on disk**. Remove the reference or restore the doc.

### 2.3 Specs & Plans (all shipped on `main`)
- **specs/** (approved + live):
  1. `2026-05-24-tab-name-rename-design.md` — pseudo-element tab nub → real `.folder-terminal-nubbin` DOM node; right-click Rename; pocket border 3→2 px.
  2. `2026-05-24-codex-tab-via-right-click-plus-design.md` — two-value `agent` enum; right-click `+` = Codex; introduced `defaultTabLabel`; teal `[data-agent="codex"]` chip palette.
  3. `2026-05-25-ezvibes-launcher-design.md` — VBS launcher + System.Drawing icon generator + PowerShell shortcut installer.
- **plans/** (parallel-orchestration or sequential-task templates):
  1. `2026-05-24-narration-sidebar-parallel.md`, `2026-05-24-copy-paste-fix-parallel.md`, `2026-05-24-codex-tab-via-right-click-plus.md`, `2026-05-25-ezvibes-launcher.md`.
- Convention: plan ends with explicit CLAUDE.md update + 10-step manual UX smoke + `node --check` greps. No automated tests.

---

## 3. Architecture

### 3.1 `main.js` — Electron Main + IPC + PTY (287 lines)

**Window:** `BrowserWindow` 1500×930 (min 980×640), `backgroundColor:#101312`, `show:false` until `ready-to-show`, `icon: renderer/ezvibes.ico`. webPreferences hardened: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, `webSecurity:true`, allowlisted preload. `setMenuBarVisibility(false)`, `setWindowOpenHandler` denies all popups, native `context-menu` event wired for cut/copy/paste/selectAll on editable text fields.

**Identity:** Module load executes `app.setAppUserModelId('com.ezvibes.EZvibes')` **before** `app.whenReady()`.

**IPC surface:**
| Channel | Dir | Mech | Payload | Notes |
|---|---|---|---|---|
| `app:initial-path` | r→m | invoke | () | → `~/Documents` if exists else home |
| `app:quick-paths` | r→m | invoke | () | filtered Home/Desktop/Documents/Downloads/EZvibes |
| `fs:list-directory` | r→m | invoke | `folderPath:string` | → `{path,parent,entries[]}`; dirs-first, name case-insensitive; sync `fs.statSync` (blocks main thread) |
| `terminal:create` | r→m | invoke | `{sessionId,cwd,agent,cols,rows}` | idempotent on duplicate sessionId |
| `terminal:input` | r→m | send | `{sessionId,data}` | high-frequency |
| `terminal:resize` | r→m | send | `{sessionId,cols,rows}` | clamps 20–300 / 8–120 |
| `terminal:close` | r→m | invoke | **BARE `sessionId` string** | **shape inconsistent with rest of terminal:*** |
| `terminal:data` | m→r | send | `{sessionId,data}` | |
| `terminal:exit` | m→r | send | `{sessionId,exitCode}` | fires twice on user-initiated close (kill→onExit also deletes) |
| `clipboard:read` / `clipboard:write` | r→m | invoke | text | coerces falsy→'' |

**Sessions:** `const sessions = new Map<sessionId, IPty>` — singleton, no per-window scoping. `currentMainWindow` is also a singleton — multi-window would mis-route `terminal:data`/`exit`. Cleanup on `before-quit` iterates and kills.

**Shell + agent launch:**
1. `detectShell()` runs `execSync('pwsh --version', {stdio:'ignore'})`; on throw returns `'powershell.exe'`. Called per `terminal:create` (small fork cost, no memoization).
2. For PowerShell shells, `buildShellArgs(shell,cwd,agent)` returns `['-NoExit','-EncodedCommand', base64]`. base64 = `Buffer.from(script,'utf16le').toString('base64')`. Encoded script = prompt-wrapper + `Set-Location -LiteralPath '<cwd>'` + agent command.
3. Prompt wrapper saves `$function:prompt` into `$__origPrompt`, then redefines `global:prompt` to call original + emit `ESC]9;9;<cwd>ESC\` (ConEmu OSC 9;9 cwd report). Same pattern Microsoft ships in VS Code's `shellIntegration.ps1`.
4. `AGENT_COMMANDS = { claude:'claude --dangerously-skip-permissions', codex:'codex --yolo' }`. `resolveAgentCommand(agent)` defaults unknown→claude.
5. Non-PowerShell fallback: spawn shell at cwd, `setTimeout(500)` then write `<command>\r\n`. No prompt wrapper installed.
6. PTY env = `{...process.env}` — **leaks every parent env var** (API keys, AWS creds, NPM tokens, SSH agent socket) into the agent.

### 3.2 `preload.js` — Bridge (25 lines)

`contextBridge.exposeInMainWorld('ezvibes', …)` with 13 methods. `invoke` for everything except `writeTerminal`/`resizeTerminal` (`send`, high-frequency). `onTerminalData(cb)`/`onTerminalExit(cb)` return **disposers** to sidestep Electron #27039 (callback identity-loss through contextBridge); renderer is responsible for calling them. `getPathForFile(file)` synchronously wraps `webUtils.getPathForFile` (post-Electron-32 replacement for the removed `File.path`); preload trusts the renderer's `File` object.

### 3.3 `renderer/app.js` — Single IIFE (1916 lines)

**State:**
- Browsing: `currentPath`, `parentPath`, `entries[]`, `history` (back stack, no forward), `query`, `viewMode: 'all'|'active-sessions'`, `previewPath`.
- Sessions: `windowsByPath: Map<folderPath, SessionWindow>` (one per folder), `tabsById: Map<tabId, Tab>` (tabId === IPC sessionId).
- Narration: `narrationByPath: Map<folderPath, Narration>`, `narrationOpen: boolean`.

`SessionWindow`: id, folderPath, folderName, DOM refs (`windowEl`, `tabStripEl`, `addTabBtnEl`, `terminalPocketEl`), `tabs: Tab[]`, `activeTabId`, `minimized`, `nextTabNumber` (monotonic, **never reused** after close), `resizeObserver`, `resizeTimer`, `attentionState`, `_closing`.

`Tab`: id, `agent: 'claude'|'codex'`, `numericLabel` (snapshot of nextTabNumber at create), `customName`, lifecycle flags (`ptyAlive`/`exited`/`failed`), `inputBuffer`, `oscBuffer`, `lastNotificationKey/At` (2-second dedupe), `attentionState`, `needsViewportRefresh`, `scrollToBottomOnReveal`, xterm `term`/`fitAddon`, DOM refs, `_closing`, `_suppressExitEvent`.

**Render pipeline:** imperative. After mutation call `renderQuickPaths`/`renderPath`/`renderGrid`/`renderNarrationSidebar`/`syncTabA11y`. `renderGrid` wipes `innerHTML` — search input has **no debounce**, every keystroke rebuilds.

**Drag-drop:** Drop on `.terminal-host` writes single-quoted paths to PTY; drop on `<input>` inserts; drop on grid background → `navigateTo(paths[0])` (other paths discarded).

### 3.4 Folder Browser & Context Menu
- Quick paths sidebar (Home/Desktop/Documents/Downloads/EZvibes if present).
- Search filter: substring on `name`, lowercased, no regex/glob/path match.
- Path bar is a plain text node — no breadcrumb segments.
- Dbl-click folder → `launchClaudeForPath(entry.path, card)`; files do nothing.
- Right-click folder → `showContextMenu` with Open / Launch Claude / Minimize|Restore Session (if exists) / Close Session (animate).
- Right-click file → single disabled "No folder actions" (truly inert).
- **CLAUDE.md says folder Rename action exists; code only has Rename on tab chips. Doc stale.**

### 3.5 Terminal Popup + Genie Animation

**DOM:** `<section class="folder-terminal">` in `#session-layer`. Children: `.folder-terminal-tab-strip` (overhangs top:-30 px) + controls strip + `.terminal-pocket` (padded folder frame, 2 px amber rim, `overflow:hidden`, `background:#050505`) > one `.terminal-host` per tab (100/100, no padding). xterm `Terminal.open(.terminal-host)`. Inactive hosts: `hidden=true` → CSS `display:none` → measure 0×0.

**Genie animations** (CSS, all hex literals — no palette variables for chips):
- `genieIn` 340 ms `cubic-bezier(0.16, 1, 0.3, 1)`: `scale(0.12, 0.05) translate(--from-x,--from-y) saturate(1.25)` → 62% overshoot `scale(1.03, 0.96)` → 100% `scale(1)` at center.
- `genieOut` 380 ms `cubic-bezier(0.55, 0, 0.35, 1) forwards`: full → 58% `scale(0.55, 0.17)` partway toward `--to-x/--to-y` → 100% `scale(0.1, 0.035) opacity 0.08` at destination. **Vertical squash >> horizontal — bottle-funnel feel.**
- 500 ms safety timeout if `animationend` never fires.
- `findCard(folderPath)` returns null → animation falls back to viewport center (documented limitation).

**Fit recipe (`fitAfterStableLayout`)**:
1. `await waitForOpeningAnimation` — `.opening` animationend OR 500 ms timeout.
2. `await document.fonts.ready` (errors swallowed).
3. `await nextFrame()` (rAF #1).
4. `await nextFrame()` (rAF #2).
5. `fitTab(tab)` — **GATED** on `sessionWindow.minimized || windowEl.hidden || terminalEl.hidden`. If gate passes: `fitAddon.fit()` then `api.resizeTerminal(tab.id, cols, rows)`. Both inside try/catch.
6. `repairTerminalViewport`: `term.refresh(0, rows-1)` twice (now + rAF), optional `scrollToBottom`.
7. `opts.focus` → `term.focus()`.

`scheduleStableFit`: 80 ms debounce; auto-promotes `waitForAnimation:true` if `.opening` is still present.

**ResizeObserver:** one per session window, target is `.terminal-pocket` (**not** `.terminal-host` — pocket survives host hide/show; hosts go 0×0 when inactive). Plus a window-level `resize` listener that fits every active tab.

**Orange minimized state:** `.folder-card.session-minimized` CSS class toggled in `renderGrid` based on `state.windowsByPath[entry.path].minimized`. Gradient `#ffb13d → #ff7b18`. `.needs-attention` adds a `#ff5f57` dot — but **only when minimized && attentionState** (which means an attention-needed running window that is currently open shows no badge).

### 3.6 Tab System

- `+` button: **left-click** toggles a small menu (Claude/Codex items); **right-click** bypasses menu and calls `createTab({agent:'codex'})`.
- `defaultTabLabel`: `numericLabel===1 → 'CLAUDE'|'CODEX'`; else `'CLAUDE N'|'CODEX N'`. **nextTabNumber never reused after close** (intentional gaps).
- Rename: right-click chip → `showTabContextMenu` → `startTabRename` swaps label `<span>` for `<input>`. Enter/blur commits; trimmed empty OR `=== restoreDefault` (captured at rename start) clears `customName`; Esc cancels.
- Visual: `chip.dataset.agent` drives `[data-agent="…"]` CSS. **All hex literals — no CSS variables for chip palettes.** Claude amber #d99422→#a06d12 (inactive) / #ffd045→#f2a414 (active). Codex teal #3a8294→#1c5564 / #6ddaee→#2ea6c0.
- Open: `buildTab → tabsById.set → attachTabChip` (insert before `+`) → `term.open` → `activateTab` (2× rAF then fitTab) → IPC `createTerminal`.
- Close: `requestCloseTab` → `confirmDestructiveClose` if last live → `performCloseTab` sets `_suppressExitEvent`, awaits IPC, disposes xterm, splices, picks right-then-left neighbor. **Last tab close reaps whole session window.**
- `launchClaudeForPath` checks `windowsByPath` first — existing window is restored, no duplicate ever.

**Extension debt — 7 `agent === 'codex'` ternary sites + `AGENT_COMMANDS`:** `defaultTabLabel` (line 921), `buildTab` (1127), `createTab` (1283–1284), `attachTabChip` (1034), `getAgentLabel` (533), `getAgentShortLabel` (537), new-tab-menu items array (~615–618), plus `main.js:58–61` `AGENT_COMMANDS`. CLAUDE.md mandates consolidation to a single `KNOWN_AGENTS` registry before adding a third agent.

### 3.7 Narration Sidebar — "What Was Made"
- `state.narrationByPath: Map<folderPath, {folderPath, folderName, status, summary, events:[], transcriptBuffer:string (capped slice(-20000), scanned trailing 4000 chars), seenHints:{[k]:true}}>`.
- Event shape: `{id:crypto.randomUUID(), time:ms, kind, text}`.
- Kinds: `session-started`, `tab-started`, `tab-created`, `tab-closed`, `session-closed`, `completed`, `error`, `user-task`, `attention`, `notification`, `agent-activity`, `plan-created`.
- `handleTerminalInput` accumulates printable chars into `tab.inputBuffer`, flushes on `\r`/`\n` as `user-task` event (also sets folder summary "Working on: …").
- `processOscNotifications` parses OSC sequences from PTY output, classifies with regex on title+body. **2-second per-tab dedupe** via `lastNotificationKey/At`.
- `NARRATION_HINTS` regex array scanned in `handleTerminalOutput`; `seenHints[key]` makes each hint fire once-per-folder-per-app-run.
- Sidebar reflects `state.previewPath || state.currentPath` — **NOT necessarily the active session**. Hidden via `@media (max-width:1024px)`.
- **Pure in-memory** — renderer reload wipes everything.

### 3.8 ezvibes Launcher Pipeline

- **`ezvibes.vbs`** (18 lines, `Option Explicit`): resolves own dir via `fso.GetParentFolderName(WScript.ScriptFullName)`; targets `node_modules/electron/dist/electron.exe`; `MsgBox`+Quit 1 if missing; `shell.Run electronExe, 1, False` (fire-and-forget). Invoked via **`wscript.exe`** (GUI host, no console flash).
- **`scripts/build-ezvibes-icon.ps1`** (166 lines): emits PNG-in-ICO at **16/24/32/48/64/128/256 px**. `Format32bppArgb`, `AntiAlias` + `HighQualityBicubic` + `AntiAliasGridFit`. Tab `#D9A93A`, body `#EDB840` flat (≤24 px) or rounded `GraphicsPath` filled with `#F5C24A→#E0A828`, outlined `#8A6020`. "Z" via `Segoe UI Black → Arial Black → Impact → GenericSansSerif` fallback chain. **RectangleF workaround**: PS 5.1's `Graphics.DrawString` resolves `Rectangle` to the `PointF` overload (uses only X,Y, ignoring layout bounds); explicit `[RectangleF]::new(...)` forces the layout-rect overload.
- **`startup/Install-EzvibesShortcuts.ps1`** (234 lines): writes `%APPDATA%\Microsoft\Windows\Start Menu\Programs\ezvibes.lnk` (the Windows-Search-indexed location). `TargetPath=%WINDIR%\System32\wscript.exe`, `Arguments=` quoted launcher path, `WorkingDirectory=` repo, `IconLocation=ezvibes.ico,0`. **Taskbar pin REFRESH only** (Windows blocks programmatic creation since 10 1809) — rewrites the existing `…\Quick Launch\User Pinned\TaskBar\ezvibes.lnk` in place, or renames an EZvibes-owned stale `Electron.lnk`. Optional `-CreateStartupShortcut`. Final `ie4uinit.exe -show` icon-cache refresh.
- **AppUserModelID stamping**: inlined C# `Ezvibes.ShellShortcutProperties` via P/Invoke `SHGetPropertyStoreFromParsingName` + `IPropertyStore.SetValue` with `PKEY_AppUserModel_ID` (GUID `{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}`, pid 5, `VT_LPWSTR`).
- **First-time pin is manual** (right-click Start-menu result → Pin to taskbar). Re-runs keep pin in sync.

### 3.9 `scripts/postinstall.js` — node-pty Windows Build Patches (48 lines)

Triggered automatically by `npm install`'s `postinstall` hook.
1. Patches `node-pty/deps/winpty/src/winpty.gyp`: `cd shared && GetCommitHash.bat` → `cd shared && .\GetCommitHash.bat` (and same for `UpdateGenVersion.bat`). **Reason: CVE-2024-27980** — Node ≥18.20.2 refuses to `spawn` `.bat`/`.cmd` files without an explicit relative-path prefix. Plus `'SpectreMitigation':'Spectre' → ''`.
2. Patches `node-pty/binding.gyp`: same Spectre strip.
3. Walks `node-pty/build/` for `.vcxproj`/`.props`/`.targets`; rewrites `<SpectreMitigation>Spectre</SpectreMitigation>` → `false`. 6 `.vcxproj` exist: `conpty`, `conpty_console_list`, `pty`, `winpty-agent`, `winpty-debugserver`, `winpty`.
4. `execSync('npx @electron/rebuild', {stdio:'inherit'})` against Electron 33's NODE_MODULE_VERSION 130 ABI.

Patches are **string substitution — whitespace-fragile** to upstream node-pty changes. Spectre is stripped because the alternative (Spectre-mitigated libs MSVC v143 component) is a ~1–2 GB Visual Studio Installer add-on. Without the strip, MSBuild aborts with **MSB8040**.

---

## 4. Research Findings — What EZvibes Does Well

1. **Electron security baseline is correct.** `contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`, `webSecurity:true`, allowlisted preload, popup-deny, CSP meta. Matches the 2025 hardening posture VS Code took years to reach (the multi-year sandbox migration is documented in Microsoft's Nov 2022 blog post).
2. **Preload listener-disposal pattern sidesteps Electron #27039** (the contextBridge identity-loss bug). Returning a closure-captured `removeListener` disposer is the only safe pattern; EZvibes implements it.
3. **Terminal fit recipe matches official xterm.js guidance.** `document.fonts.ready` + double rAF + gate-against-hidden + per-pocket `ResizeObserver` + window resize listener is the production pattern in the official `/xtermjs/xterm.js` llms.txt. EZvibes's 80 ms debounce sits in the 80–150 ms consensus band.
4. **PowerShell `-EncodedCommand` mechanics are canonical.** UTF-16LE → Base64 is correct (UTF-8 would silently corrupt). The `$function:prompt` chaining wrapper is the same Microsoft ships in VS Code's `shellIntegration.ps1`. Not passing `-NoProfile` is correct — preserves user oh-my-posh/starship/posh-git, then the encoded block installs the wrapper on top.
5. **Windows AUMID identity is correctly stamped in all three places** (main process, BrowserWindow icon, shortcut PropertyStore). The wscript.exe-as-launcher problem is solved exactly because the .lnk overrides the host-process exclusion via stamped `PKEY_AppUserModel_ID`.
6. **`%APPDATA%\…\Programs` IS the Windows-Search-indexed Start-Menu folder** — general AppData indexing is off; that specific subdirectory is whitelisted. EZvibes picked the right install path.
7. **Genie approximation is design-correct.** Pure scale+translate (no clip-path / mesh warp) is GPU-compositor-friendly. The squash ratio (~3.2× at the 58% keyframe) and ease-in-out cubic-bezier hit the perceptual signature of Apple's 2001 Genie; expo-out + 1.03×0.96 overshoot adds Disney's anticipation/follow-through. Performance budget at 60 fps is comfortable.
8. **Electron 32+ drag-drop migration is already done.** `webUtils.getPathForFile` via contextBridge — preload-callable, not renderer-callable. EZvibes avoids the macOS regression in Electron 30–33 by being Windows-only.
9. **`filter: drop-shadow` is the correct shadow choice for transparent folder shapes.** Follows the rendered alpha; one composited pass; outperforms equivalent `box-shadow` stacks.
10. **`@APPDATA%`-based ezvibes shortcut + AUMID stamp is genuinely a good zero-distribution pattern for a single-user tool.** Replacing it with an NSIS installer is a 1-day swap when EZvibes needs multi-machine deploy.

---

## 5. Research Findings — Gaps & Risks

### 5.1 Critical

- **Electron 33 is EOL since spring 2025.** Only the latest three majors get Chromium security back-ports. **V8 CVE-2025-10585 (KEV-listed) is unpatched in this line.** ANGLE OOB CVE-2025-14174 also requires Chromium ≥140. *Plan migration to a supported line (≥38) before any external user gets a build.*
- **`env={...process.env}` leaks every parent secret to the PTY.** ANTHROPIC_API_KEY, OPENAI_API_KEY, AWS_*, GH_TOKEN, BITWARDEN_*, SSH_AUTH_SOCK — all flow unchanged into the agent. Industry consensus (Bitwarden, Knostic, DZone 2025–2026): host should strip `*KEY*`/`*TOKEN*`/`*SECRET*`/`AWS_*`/`AZURE_*`/vendor-AI keys from the PTY env unless explicitly needed.
- **No IPC sender validation.** None of the six `ipcMain.handle` calls check `event.senderFrame.url` against a `file://…/renderer/index.html` allowlist or schema-validate `{folderPath, agent, cols, rows, sessionId}`. With a renderer compromise (e.g., prompt-injection via narration parsing), `terminal:create` becomes arbitrary command exec at any folder.
- **`terminal:close` shape inconsistency.** Bare `sessionId` string while every other `terminal:*` channel uses `{sessionId, …}`. Normalize before more callers accumulate.
- **`currentMainWindow` singleton.** Will mis-route `terminal:data`/`exit` events the moment a second window appears. Replace with `Map<sessionId, webContents.id>` lookup now, before multi-window lands.
- **`assertDirectory` uses `fs.statSync` synchronously** — blocks main thread on slow disks / network shares / broken symlinks.

### 5.2 Important

- **Postinstall patches are whitespace-fragile.** Any upstream node-pty whitespace change silently no-ops the substitution. Recommend defensive: error if substitution count = 0. The `.\` patch is rooted in **CVE-2024-27980** (not CVE-2024-3566, which is the broader "BatBadBut" class).
- **node-pty winpty patches become dead code when PR #868 lands** (Issue #842, Dec 2025): Microsoft is removing winpty support from the 1.x main branch because Windows 10 1809 mainstream support has ended. Watch for node-pty 1.2.0 stable.
- **`useConptyDll: true` is the more reliable PTY path** — uses node-pty's bundled ConPTY DLL (sourced from Windows Terminal team) instead of OS-shipped `conpty.dll`. Worth testing.
- **`@lydell/node-pty` is a prebuilt-only fork** — viable escape from the postinstall pipeline if it ever breaks irreparably.
- **No code signing.** SmartScreen warns on first run; CA/B Forum 2023 killed software-stored OV certs (now require FIPS HSM / hardware token). 2026 recommended path: **Azure Trusted Signing** (~$120/yr, no hardware, eligible for individual US/Canada developers; EV cert + USB token no longer auto-bypasses SmartScreen).
- **Tab-strip `overflow: hidden`** silently clips chips past a certain count — no scroll, no overflow menu. Chrome v144 removed scrollable tab strip and is pushing vertical tabs as the canonical overflow story.
- **No tab keyboard shortcuts** (`Ctrl+Tab`/`Ctrl+Shift+Tab`/`Ctrl+Shift+T`/`Ctrl+Shift+W`/`Ctrl+Alt+N`). Universal across Warp, Windows Terminal, Tabby, VS Code.
- **No ARIA tablist semantics on the tab strip.** Missing `role=tablist|tab|tabpanel`, `aria-selected`, `aria-controls`, roving `tabindex`. Screen readers can't announce "tab 2 of 4, CLAUDE 2, selected."
- **Codex emits no OSC notifications natively** — EZvibes's narration parser fires for Claude turns but stays silent for Codex turns. Two fixes: (a) append `printf '\033]9;Codex turn complete\007'` to the codex command; (b) match Codex TUI prompt-state strings in `NARRATION_HINTS`.
- **`renderGrid` wipes `innerHTML` every keystroke** with no debounce. Search input on a large directory thrashes layout.
- **Source-card-not-visible fallback is anti-wayfinding.** When `findCard` returns null the Genie animates to viewport center — bad UX. Better: scroll the card into view first, then animate.
- **`prefers-reduced-motion` is not honored.** Should collapse Genie to a 100 ms cross-fade when set.

### 5.3 Latent

- **OSC 9;9 has no nonce.** A hostile process inside the PTY can fake a cwd change. Low impact today (cwd is informational); VS Code added nonces to its OSC 633 sequences after spoofing concerns.
- **`--folder-hot #ff9d21` is a dead CSS token** (declared, never used). Kill it or repurpose for `.needs-attention` background to distinguish from minimized orange.
- **CSP `style-src 'unsafe-inline'`** is currently unavoidable for xterm.js 5.x (DOM renderer injects inline `<style>` nodes before WebGL renderer activates — issue xterm.js#4133, #4445). Best practice today: `'unsafe-hashes'` + precomputed hash list, but xterm.js doesn't emit stable nonces.
- **16/24/32 px launcher-icon sizes will degrade.** The PowerShell generator emits PNGs at all 7 sizes from the same recipe; the white highlight gradient and bevels vanish under 32 px. Hand-author 16/24 with `PixelOffsetMode=Half` and `SmoothingMode=None`.
- **CSV folder-yellow vs minimized-orange ambiguity for deuteranopia.** Both fall in the yellow-orange band. The `#ff5f57` red dot is the only differentiator — and it only appears with attention + minimized.
- **Quoting bug**: dropped paths are PowerShell-single-quoted but apostrophes are not doubled. Folders like `Ozan's Notes` are an injection risk on drop into the terminal-host.
- **WCAG 2.5.7 (dragging movements)**: drag-drop into PTY has no keyboard equivalent.

### 5.4 Stale / Doc-Code Drift
- **`tab-plan.md` referenced in CLAUDE.md but absent on disk.**
- **CLAUDE.md claims folder Rename action exists in context menu**; code only has Rename on tab chips.
- **`browser.md` (1088 lines) and `browser-plan.md` (1416 lines) are not listed in CLAUDE.md** — sizable in-flight artifacts for adding `<webview>`-based browser tabs as a third tab kind.
- **`research/` is an empty directory** with no documented purpose.

---

## 6. Recommended Next Moves (Prioritized)

### P0 — Safety & Identity
1. **Allowlist PTY env in `main.js` `terminal:create`** before `pty.spawn`: pass only `{PATH, USERPROFILE, APPDATA, LOCALAPPDATA, SYSTEMROOT, TEMP, HOME, LANG}` and explicitly strip `*KEY*`/`*TOKEN*`/`*SECRET*`/`AWS_*`/`AZURE_*`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`.
2. **Add `senderFrame` validation + shape validation to every `ipcMain.handle`**: `if (!event.senderFrame.url.startsWith('file://') || !event.senderFrame.url.endsWith('/renderer/index.html')) return;` plus zod/valibot parse of payloads.
3. **Schedule Electron migration past 33** — at minimum to the supported triplet of the latest three majors. The V8 CVE in 33 is the single highest-impact risk.
4. **Add `webContents.on('will-navigate', e => e.preventDefault())`** to complement existing `setWindowOpenHandler` deny.

### P1 — Consistency & Debt
5. **Consolidate to `KNOWN_AGENTS` table** (one place defines: command, label, short label, palette CSS variable, badge text). Remove the 7 codex ternaries. Required before any third agent.
6. **Promote chip palette HEX literals to CSS variables** keyed off `[data-agent]`. Removes the "~6 hand-edited rule blocks" footgun when adding agents.
7. **Normalize `terminal:close` payload** to `{sessionId}` to match the rest of the family. Trivial diff in `preload.js` + `main.js`.
8. **Replace `currentMainWindow` singleton** with `Map<sessionId, webContents.id>` lookup. Trivial today; brittle once multi-window lands.
9. **Fix redundant `terminal:exit`** on user-close: set a `closing` flag before `kill()` and short-circuit in `onExit`, or have `terminal:close` resolve only after `onExit` fires.
10. **Add tab keyboard shortcuts**: `Ctrl+Tab`/`Ctrl+Shift+Tab`/`Ctrl+Shift+T`/`Ctrl+Shift+W`/`Ctrl+Alt+1..9`. One PR.
11. **Add `role=tablist|tab|tabpanel`, `aria-selected`, `aria-controls`, roving `tabindex`** on the tab strip. Implement APG manual-activation pattern.
12. **Debounce search input** at 50–100 ms in `renderGrid` callers.
13. **Double apostrophes in dropped paths** before single-quoting for PowerShell paste targets.

### P2 — UX Polish
14. **Honor `prefers-reduced-motion`**: collapse Genie to 100 ms cross-fade.
15. **Strengthen `findCard` fallback**: scroll the source card into view first, then animate; fallback to a persistent "minimized sessions tray" if the source folder isn't reachable.
16. **Adopt Idiomorph (3.3 kB)** for `renderGrid` to preserve focus/scroll across re-renders. One-line dependency change.
17. **Tab-strip overflow fix**: replace `overflow:hidden` with `overflow-x:auto` + scroll-snap, hide scrollbar via `::-webkit-scrollbar`. Long-term: vertical-tabs sidebar.
18. **Add inline-rename hardening**: `input.maxLength=60`, `input.select()` on entry, `trim()` on commit.
19. **Add agent glyph (`CL`/`CX`) to chips** so renamed Codex tabs ("scratchpad") still visually identify their agent.
20. **Add per-chip `needs-attention` pulse** (CSS `::before` keyframe; respects reduced-motion) so attention is signaled even on open windows, not just minimized ones.
21. **Pause xterm rendering during minimize animation** (`xterm.options.disableStdin = true` + buffer output) for smoother genieOut on busy sessions.

### P3 — Platform & Distribution
22. **Persist `events.jsonl` per folder** for cross-restart narration history. Replay on app boot to rebuild `state.narrationByPath`. Fixes the "in-memory only" limitation.
23. **Add `terminalSequence` PostToolUse hook** (Claude Agent SDK) so attention state is signaled by structured event rather than parsed PTY bytes.
24. **Switch Codex tabs to `--output-format stream-json` on a sidecar pipe** if/when Codex supports it — replace regex-on-PTY with typed event stream.
25. **Add `electron-builder` + NSIS + `electron-updater`** when EZvibes leaves single-user. Reuse `ezvibes.ico` as `build.win.icon`, AUMID as `build.appId`. Sign with Azure Trusted Signing.
26. **Add `asarUnpack: ["**/node_modules/node-pty/build/Release/*", "**/node_modules/node-pty/lib/**"]`** as a precondition for any packaging step.
27. **Watch node-pty PR #868 (winpty removal)** — when it lands, lines 16–20 of `scripts/postinstall.js` become dead code.
28. **Test `useConptyDll: true` in `pty.spawn`** for more reliable PTY behavior across Win 10/11 builds.

### P4 — Cleanup
29. **Remove the stale `tab-plan.md` reference from `CLAUDE.md`** (file absent on disk).
30. **Document `browser.md` + `browser-plan.md`** in CLAUDE.md or mark explicitly as "exploratory, not on roadmap".
31. **Remove `--folder-hot` dead CSS token** (or repurpose for `.needs-attention`).
32. **Fix the rename "restore default" UX**: comparing against `restoreDefault` captured at rename start means typing the bare agent name (e.g. "CLAUDE") on a `CLAUDE 2` tab won't reset — only the exact numbered default does.
33. **Hand-author 16/24 px launcher PNGs** in `build-ezvibes-icon.ps1` with `PixelOffsetMode=Half` and `SmoothingMode=None`.

---

## 7. Adjacent Opportunities (the 20% spread)

- **MCP + A2A complementarity**: MCP = agent↔tools; A2A = agent↔agent delegation. A2A v1.0 hit production at 150 orgs by Google Cloud Next 2026 (Azure AI Foundry, SAP Joule, Adobe, S&P Global all wired). Natural EZvibes evolution: each tab becomes an A2A-addressable agent; EZvibes routes work between them. Folder-scoping is EZvibes's differentiator vs cmux/Warp.
- **Claude Agent SDK** (renamed from Claude Code SDK in Mar 2026) exposes Claude's agent loop programmatically with sub-agents-by-default and isolated context windows per sub-agent. **Managed Agents** public beta Apr 8 2026.
- **`@xterm/addon-shell-integration`**: register an OSC handler via `term.parser.registerOscHandler(9, …)` to consume EZvibes's own OSC 9;9 cwd emissions in the renderer for things like "open new tab here".
- **View Transitions API** (Chrome 111+, Safari 18+, Firefox 134+ same-doc) is tempting but the **wrong fit** for EZvibes's Genie — VT shines for two persistent elements that swap; EZvibes's popup is a transient overlay shrinking into a grid cell. Keep the imperative animation.
- **CSS Anchor Positioning** (Chromium 125+) is the cleanest modern solution to the moving-target problem; Firefox/Safari lagging.
- **WSL2 PTY bridging via ConPTY** works today through node-pty's Windows path (`wsl.exe -d Ubuntu -- /bin/bash`). Caveat: SIGWINCH semantics differ; Claude/Codex re-renders may double-fire.
- **Idiomorph + signals**: cheapest two-step migration if EZvibes outgrows its current vanilla state model. Idiomorph gives focus-preserving re-renders; Preact Signals (~5 kB) or 36-line vanilla signals replace manual `render*()` calls with effects.
- **OpenTelemetry GenAI semconv (`gen_ai.*` spans)**: normalize EZvibes's narration events to the cross-vendor schema. Future-proofs adding Phoenix/Langfuse export.
- **Sparse Package** (Windows 11) is a viable identity bridge between unpackaged EZvibes and a full MSIX — unlocks toast notifications, file associations, Windows Share targets without the full MSIX migration. Caveat: known Electron crash requiring `--no-sandbox`.
- **MSIX migration via electron-builder's `msix` target** — long-term Windows packaging direction; Store-certifiable if desired (though `--dangerously-skip-permissions` is a likely Store-review hard "no").
- **Tabby is the closest peer prior art** — Electron-based, hierarchical splits, drag-reorder, session serialization for tab recovery. Important proof that an Electron app *can* persist tab structure.
- **Konsole 25.07** adds cwd + size + startup commands to its tab-layout JSON — useful reference for a future EZvibes `windowsByPath` persistence schema.

---

## 8. Sources & Further Reading (consolidated)

**Electron security:**
- Electron Security tutorial: https://www.electronjs.org/docs/latest/tutorial/security
- VS Code Process Sandboxing: https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox
- Doyensec Electronegativity: https://github.com/doyensec/electronegativity
- Bishop Fox: Designing a Reasonably Secure Electron Framework: https://bishopfox.com/blog/reasonably-secure-electron
- KEV V8 CVE-2025-10585 hits Electron: https://medium.com/meetcyber/kev-v8-cve-2025-10585-hits-electron-apps-04544099f585

**node-pty / Windows PTY:**
- microsoft/node-pty Releases: https://github.com/microsoft/node-pty/releases
- microsoft/node-pty Issue #842 (Remove winpty): https://github.com/microsoft/node-pty/issues/842
- Node April 2024 Security (CVE-2024-27980): https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
- Microsoft DevBlogs — Introducing ConPTY: https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/
- @lydell/node-pty: https://www.npmjs.com/package/@lydell/node-pty

**xterm.js:**
- xterm.js issue #494 (hidden viewport): https://github.com/xtermjs/xterm.js/issues/494
- @xterm/addon-fit on npm: https://www.npmjs.com/package/@xterm/addon-fit
- xterm.js v6 release notes (canvas removal): https://github.com/xtermjs/xterm.js/releases

**PowerShell + OSC:**
- VS Code Terminal Shell Integration: https://code.visualstudio.com/docs/terminal/shell-integration
- ConEmu ANSI X3.64 and OSC 9;X codes: https://conemu.github.io/en/AnsiEscapeCodes.html
- microsoft/terminal#8330 (OSC 9;9 implementation): https://github.com/microsoft/terminal/pull/8330
- Contour Terminal — OSC 133 spec: https://contour-terminal.org/vt-extensions/osc-133-shell-integration/

**Genie / animations:**
- Recreating macOS Genie Effect: https://harshil.net/blog/recreating-the-mac-genie-effect/
- View Transition API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Smashing Magazine — CSS GPU Animation: https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/

**Tabs / ARIA:**
- W3C WAI-ARIA APG: Tabs Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- W3C APG: Tabs with Action Buttons: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-actions/
- Chromium Tab Strip Design (Mac): https://www.chromium.org/developers/design-documents/tab-strip-mac/

**Agent CLIs:**
- Claude Code permission modes: https://code.claude.com/docs/en/permission-modes
- Claude Code Configure your terminal: https://code.claude.com/docs/en/terminal-config
- Claude Agent SDK overview: https://code.claude.com/docs/en/agent-sdk/overview
- Codex CLI features: https://developers.openai.com/codex/cli/features
- Cmux (Feb 2026, AGPL Ghostty-based): https://noqta.tn/en/blog/cmux-macos-terminal-ai-coding-agents-parallel-sessions-2026
- Warp Agent Mode: https://docs.warp.dev/agent-platform/local-agents/interacting-with-agents/terminal-and-agent-modes/
- A2A v1.0 announcement: https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/

**Windows shell / AUMID:**
- AppUserModelIDs (Microsoft Learn): https://learn.microsoft.com/en-us/windows/win32/shell/appids
- Sparse Packages (grant identity): https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/grant-identity-to-nonpackaged-apps
- Velopack ShellLink (managed PKEY_AppUserModel_ID): https://docs.velopack.io/reference/cs/Velopack/Windows/ShellLink/PROPERTYKEY/properties/PKEY_AppUserModel_ID

**Skeuomorphism:**
- The Renaissance of Skeuomorphic Design (UXmatters 2024): https://www.uxmatters.com/mt/archives/2024/11/the-renaissance-of-skeuomorphic-design-in-modern-user-experiences-bridging-the-digital-and-the-physi.php
- Skeuomorphism: an unexpected comeback in 2025 (Kryzalid): https://kryzalid.net/en/web-marketing-blog/skeuomorphism-an-unexpected-comeback-in-2025/

**Electron IPC patterns:**
- Electron IPC tutorial: https://www.electronjs.org/docs/latest/tutorial/ipc
- electron-trpc: https://github.com/jsonnull/electron-trpc
- The Case Against electron-trpc: https://seedteamtalks.hyper.media/tech-talks/the-case-against-electron-trpc-when-type-safety-becomes-a-performance-tax
- Memory leak passing IPC over contextBridge (#27039): https://github.com/electron/electron/issues/27039

**Vanilla state:**
- Preact Signals: https://preactjs.com/guide/v10/signals/
- Idiomorph: https://github.com/bigskysoftware/idiomorph
- Beyond Signals — Ryan Carniato: https://gitnation.com/contents/beyond-signals

**Agent observability:**
- Stream-JSON output format: https://backgroundclaude.com/blog/stream-json
- OpenTelemetry GenAI semantic conventions: https://opentelemetry.io/blog/2026/genai-observability/
- Langfuse Claude Agent SDK integration: https://langfuse.com/integrations/frameworks/claude-agent-sdk
- Warp block model: https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment

**Drag-drop:**
- Electron `webUtils` API: https://www.electronjs.org/docs/latest/api/web-utils
- Electron Native File Drag & Drop tutorial: https://www.electronjs.org/docs/latest/tutorial/native-file-drag-drop
- electron#43195 (File.path deprecation): https://github.com/electron/electron/issues/43195

**Packaging / signing:**
- Trusted Signing public preview for individuals: https://techcommunity.microsoft.com/blog/microsoft-security-blog/trusted-signing-is-now-open-for-individual-developers-to-sign-up-in-public-previ/4273554
- electron-builder Auto Update: https://www.electron.build/auto-update
- Electron Forge auto-unpack-natives plugin: https://www.electronforge.io/config/plugins/auto-unpack-natives

**Terminal apps prior art:**
- Warp split panes: https://docs.warp.dev/terminal/windows/split-panes/
- Wezterm SplitPane: https://wezterm.org/config/lua/keyassignment/SplitPane.html
- Ghostty surface mobility discussion #12126: https://github.com/ghostty-org/ghostty/discussions/12126
- Tabby split tab system: https://deepwiki.com/Eugeny/tabby/5.2-split-tab-system
- Tmux vs Zellij comparison (2026): https://dasroot.net/posts/2026/02/terminal-multiplexers-tmux-vs-zellij-comparison/

---

## 9. Method (for reproducibility)

**Wave 1 — Codebase audit (15 parallel agents).** Each agent received a focused scope (one file or one subsystem) plus project context, and returned a structured ≤500-word summary. Coverage: `package.json`+deps, `main.js` IPC+PTY lifecycle, `main.js` shell+launch, `preload.js`, folder browser, terminal popup+Genie, tab system, narration sidebar, HTML+CSS, postinstall, ezvibes launcher, specs, plans, top-level docs + repo layout, cross-cutting security/debt.

**Wave 2 — Research (15 parallel agents, ≤800-word outputs each).** Each agent received the same distilled facts pack plus a focused angle with explicit 20%-spread guidance, and used WebSearch / WebFetch / context7 docs. Angles: Electron security, node-pty/ConPTY, xterm.js fit/resize, PowerShell+OSC, Genie history, tabs UX/a11y, multi-agent CLIs, Windows AUMID/pinning, skeuomorphic UI, Electron IPC patterns, vanilla state architecture, AI observability, drag-drop file paths, packaging/signing, tabbed terminal prior art.

Both waves dispatched in a single message each for true parallel execution.
