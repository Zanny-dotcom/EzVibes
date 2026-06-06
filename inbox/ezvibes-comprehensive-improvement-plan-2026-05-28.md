# EZvibes — Comprehensive Improvement Plan

## Executive summary

EZvibes is structurally sound where it matters most: the Electron security posture is already strong (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, denied `setWindowOpenHandler`, locked-down `will-navigate`, a narrow `contextBridge` preload, argv-form PTY spawning with an allowlisted env that strips `*KEY*/*TOKEN*/*SECRET*`), and the xterm fit pipeline matches xterm.js maintainer guidance line-for-line (font-ready gate, non-zero-box + finite `proposeDimensions()` check, 2-stable-frame wait, active-tab-only debounced `ResizeObserver`, change-gated PTY resize). These are assets to protect, not rebuild.

The risk concentrates in three places. **First, the main process trusts the renderer as a security boundary it is not.** `fs:delete-folder` (main.js:733) trashes any absolute path with only an "is it a directory" check — the confirm dialog and session guard live entirely in the renderer (app.js:636) and are trivially bypassable, and the same handler ignores live PTYs running in *subfolders* of the deletion target, enabling silent data loss of in-progress work. Since the renderer deliberately hosts `claude --dangerously-skip-permissions` and `codex --yolo`, renderer-resident code is a realistic threat model. **Second, several renderer/main lifecycle races leak resources or orphan PTYs** — most acutely the launch-await gap (app.js:1719) that spawns a real, unkillable PTY plus a leaked `ResizeObserver` if the user closes a session window during the ~500ms open animation. **Third, the app is not distributable and untested**: no packaged build, a fragile `node_modules`-mutating Spectre patch, and zero behavior tests behind a parse-only `check:syntax` gate.

The through-line: **move every safety-critical decision into the main process, close the lifecycle races, then make the app durable (persistence, packaging, tests) — all without touching the terminal embedding, the fit sequence, or the `window.ezvibes` contract.**

## How this plan was built

This plan synthesizes a parallel audit -> adversarial verification -> web-research pipeline. **32 audit findings** (of 35 raised; 3 were refuted and dropped) were each independently confirmed real by an adversarial reviewer (every `verdict.real === true`), with severities re-graded against the single-user, Windows-only, no-bundler reality of the app (several "high" claims were correctly downgraded — e.g. the PTY-disposable leak is a GC-collectible island, not a true leak). **7 research subjects** (Electron security hardening, node-pty/Electron native rebuilds, xterm sizing, state persistence, packaging, no-bundler renderer organization, and testing strategy) supply best-practice grounding with source URLs. Where the adversarial reviewer downgraded severity, this plan uses the *adjusted* severity for prioritization.

## Guardrails: functionality we must NOT break

These are load-bearing per CLAUDE.md and the verified findings. Every change below is checked against them:

1. **The embedded `node-pty` terminal** — never replace with a normal PowerShell window. The in-app popup terminal is the product.
2. **The delayed stable-fit sequence** — xterm opens in `.terminal-host`, never `.terminal-pocket`. Never call `fitAddon.fit()` on a hidden/0×0 host. Do not remove the font-ready + 2-stable-frame + finite-`proposeDimensions()` gate.
3. **Per-tab PTY isolation + session ownership by `webContents.id`** — the `sessions` Map keying and owner checks that stop cross-renderer access.
4. **The launch commands** — `claude.exe --dangerously-skip-permissions` and `codex.exe --yolo`; the two-value agent enum in `main.js` `AGENT_COMMANDS` and the matching ternaries in `app.js`.
5. **Genie minimize/restore animations** and the **orange minimized-folder state** — including the JS dependency that fit waits for `animationend`.
6. **The `window.ezvibes` IPC contract** — the renderer never touches Node/Electron directly; all new persistence/state goes through new preload channels, never raw `fs` in the renderer.
7. **Minimized windows keep all tab PTYs running** — the session-survival contract.

**Standing security maintenance:** Electron is a security-relevant dependency. Periodically check Electron's supported-releases window and re-pin the major **before** it ages out of Chromium security backports (see 3.2). Treat each bump as a deliberate task paired with the node-pty rebuild (3.1/3.3) and an xterm-fit + full-E2E verification — never an incidental caret drift.

---

## 1. Security & correctness fixes

### 1.1 — `fs:delete-folder` has no path confinement (P0, M)
**Problem:** `deleteFolder` (main.js:733) resolves the path and checks only `stat.isDirectory()` before `shell.trashItem(target)`. Unlike `createFolder`/`renameFolder` (which call `isPathInside(parentDir, targetPath)`), it applies no containment. The confirm dialog and session check live in the renderer (`deleteFolderWithConfirm`, app.js:636), which is not a trust boundary. Any renderer-resident script can call `window.ezvibes.deleteFolder({ path: 'C:/Windows/System32' })` directly.
**Recommended change:** Thread `parentPath` from the renderer (it already has `state.currentPath` at app.js:652) and enforce in main: `const parentDir = assertDirectory(payload.parentPath); if (!isPathInside(parentDir, target) || path.dirname(target) !== parentDir) throw new Error('Folder to delete is outside the declared parent directory.');`. Change the call site to `api.deleteFolder({ path: entry.path, parentPath: state.currentPath })`.
**Why it preserves functionality:** Mirrors the exact pattern `createFolder`/`renameFolder` already use; normal deletes (always an immediate child of the browsed dir) pass unchanged. It blocks only payloads whose target is not a child of the declared parent.
**Source:** Electron security checklist item 17/20 — keep validation authoritative in main. https://www.electronjs.org/docs/latest/tutorial/security

### 1.2 — Folder delete ignores live PTYs in subfolders (P0, M)
**Problem:** The renderer guard (`state.windowsByPath.get(entry.path)`, app.js:638) is keyed on the *exact* folder path. Deleting a parent whose subfolder hosts a running agent passes the guard (`hasLiveSession === false`), so `shell.trashItem` moves the live cwd to the Recycle Bin while the PTY keeps running — silent loss of in-progress work plus an orphaned agent.
**Recommended change:** In `deleteFolderWithConfirm`, before confirming, prefix-check session roots: `const prefix = entry.path.endsWith('\\') ? entry.path : entry.path + '\\'; const blocked = [...state.windowsByPath.keys()].some(k => k === entry.path || k.startsWith(prefix)); if (blocked) { showInboxToast('Close sessions in this folder before deleting it.', 'error'); return; }`. (Defense-in-depth: thread live cwds into main's `deleteFolder` so the authority also refuses — combine with 1.1.)
**Why it preserves functionality:** Reuses the existing toast/guard UX; uses `path.sep`-anchored prefix so `app` vs `app2` siblings are not falsely blocked. No new IPC for the renderer-side guard.

### 1.3 — Add a Content-Security-Policy (P1, S)
**Problem:** Research confirms EZvibes defines **no CSP anywhere** — `renderer/index.html` has no `<meta http-equiv="Content-Security-Policy">`. It renders untrusted-by-nature content (agent/terminal output, user-authored panel-mode payloads) in a privileged `file://` context.
**Recommended change:** Add one meta tag, deny-by-default and widened only to what xterm needs: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'`. (`style-src 'unsafe-inline'` is required by xterm's injected styles; `connect-src 'none'` because the renderer makes no network calls.)
**Why it preserves functionality:** For `file://` apps the meta tag is the supported delivery mechanism; the directives are scoped to the real local assets (`app.js`, `panel-mode.js`, xterm CSS). Verify the terminal still renders after applying.
**Source:** Electron security checklist item 7. https://www.electronjs.org/docs/latest/tutorial/security

### 1.4 — Validate the sending frame on privileged IPC (P1, M)
**Problem:** Handlers authorize by stored `webContents.id` ownership but never confirm the *sending frame* is the trusted app document. Research flags this as the highest-value structural hardening gap (checklist item 17).
**Recommended change:** Add `isTrustedSender(event)` comparing `event.senderFrame?.url` to the already-computed `APP_INDEX_URL` (main.js:16), and call it at the top of `fs:create/rename/delete-folder`, `terminal:create/input/resize/close`, `inbox:read-markdown`, `clipboard:write`. Reject (no-op / `{success:false}`) and `writeLog` a warning on mismatch; guard for null `senderFrame` after navigation.
**Why it preserves functionality:** Composes with existing ownership checks; the legitimate top-level renderer always passes. Purely additive rejection of unexpected frames.
**Source:** https://www.electronjs.org/docs/latest/tutorial/security

### 1.5 — `before-quit` deadlock: webContents-destroyed guard + single-window count mismatch (P1, S)
**Problem (two verified findings, same `if` condition at main.js:1262):**
- **(a) webContents-destroyed guard:** `before-quit` checks `!currentMainWindow.isDestroyed()` but **not** `!currentMainWindow.webContents.isDestroyed()`. It calls `event.preventDefault()` then `requestCloseConfirmation`, which silently returns false (main.js:177) without sending IPC — so no dialog appears and `confirmedAppQuit` can never be set. Partially self-healing via `render-process-gone`/`destroyed` handlers, but a real quit-fails race.
- **(b) single-window count mismatch (`close-confirm-flow-assumes-single-window`):** the guard gates on the **global** `sessions.size > 0` (main.js:1262), but `requestCloseConfirmation` only counts the owner's sessions via `countSessionsForWebContents` (main.js:178). Today there is one window so the two sets coincide, but if a second window ever owned sessions, the global check could be true while the owner's count is zero — `event.preventDefault()` fires and `requestCloseConfirmation` silently returns false, wedging quit with no dialog. Verified at main.js:1262 (global gate) and main.js:178 (per-owner count).
**Recommended change (single edit satisfies BOTH):** Replace the global `sessions.size > 0` term with the per-owner count *and* add the webContents-destroyed guard, so the guard and the confirmation target the same session set and only fire when the renderer can respond:
```js
if (!confirmedAppQuit
    && currentMainWindow
    && !currentMainWindow.isDestroyed()
    && !currentMainWindow.webContents.isDestroyed()
    && countSessionsForWebContents(currentMainWindow.webContents.id) > 0) {
```
Apply (a) and (b) **together** — they edit the same condition, so landing one without the other re-opens the race the other closes.
**Why it preserves functionality:** Mirrors the guard already inside `requestCloseConfirmation` and aligns the gate with the function it calls; the healthy-single-window confirm prompt is unchanged. If multi-window support arrives later, the gate now scopes correctly to the owner being quit.

### 1.6 — `will-navigate` kills PTYs before the allow-check (+ `will-redirect` / `will-attach-webview` hardening) (P1, S)
**Problem:** `will-navigate` (main.js:874) calls `killSessionsForWebContents(...)` *unconditionally* before the `navigationUrl !== APP_INDEX_URL` check that `preventDefault()`s. Any benign navigation it then cancels (in-page anchor, accidental hash, dragged link, Ctrl+R) destroys every live PTY first, silently breaking the session-survival contract. Separately, `will-navigate` does not fire for **server-driven / `meta refresh` redirects**, so a redirect-based navigation can bypass the guard entirely, and webview attachment is not denied.
**Recommended change:**
- Reorder `will-navigate` — check `navigationUrl !== APP_INDEX_URL` first and `preventDefault()`+`return`; only call `killSessionsForWebContents` on the allowed `APP_INDEX_URL` reload branch.
- Add a **`will-redirect`** handler mirroring the same allow-check (`preventDefault()` unless `navigationUrl === APP_INDEX_URL`) so redirect-driven navigation can't slip past — defense-in-depth per security research item 5. Verify no legitimate in-app redirect flow exists first (there is none today; the renderer makes no network calls).
- Add **`win.webContents.on('will-attach-webview', (e) => e.preventDefault())`** since EZvibes uses no `<webview>` tags; this is a purely additive deny.
**Why it preserves functionality:** Reload-of-index still reaps PTYs; external navigation and redirects stay blocked; the separate `destroyed` handler (main.js:894) remains the backstop for genuine cross-document navigation. The webview deny is a no-op for the current UI (no webviews exist).
**Source:** Electron security checklist item 5 — lock down `will-navigate`, also add `will-redirect`, and deny `will-attach-webview`. https://www.electronjs.org/docs/latest/tutorial/security

### 1.7 — Launch-await gap orphans a PTY + leaks an observer (P0, S)
**Problem:** `launchClaudeForPath` (app.js:1719) `await`s `terminalBecameVisible` (up to ~500ms animation + `document.fonts.ready`), then calls `observeSessionSize` and `api.createTerminal` with **no re-check that the window still exists**. If the user closes the window during the await, `performCloseSessionWindow` has already disposed the tab and cleared `resizeObserver` — so a new `ResizeObserver` attaches to a detached node (never disconnected) and a real PTY spawns whose `terminal:data`/`terminal:exit` are dropped (its xterm already disposed). `createTab` (app.js:2634/2640) has the identical shape.
**Recommended change:** After each `await terminalBecameVisible(...)`, add `if (!state.tabsById.has(tab.id)) return;`. `tabsById` is the authoritative registry; `performCloseSessionWindow` deletes the entry, making this a reliable sentinel.
**Why it preserves functionality:** Distinguishes "window gone" (abort cleanly) from "merely minimized" (tab still in `tabsById`, PTY still created — minimized windows keep PTYs per spec). No IPC changes.

### 1.8 — Agent `.cmd/.ps1` fallback PATH-shim hijack (P2, S)
**Problem:** `findExecutableOnPath` (main.js:571) iterates *names* in the outer loop, so `claude.exe` is tried across all dirs before any `.cmd`. But for npm installs (only a `.cmd` shim exists), `prependPathDirs` puts `%USERPROFILE%\.local\bin` ahead of `%APPDATA%\npm`, so a planted `claude.cmd` there wins and runs via `cmd /c` (or `-ExecutionPolicy Bypass` for `.ps1`), while the UI still shows `claude --dangerously-skip-permissions`.
**Recommended change:** Swap loop order to dirs-outer, names-inner ("first dir wins across all extensions"). Combined with the existing `.exe`-before-`.cmd` name ordering, a legitimate earlier-PATH binary beats a later user-writable shim.
**Why it preserves functionality:** All single-install setups resolve identically; only winner selection changes when the same agent exists under multiple extensions in different dirs. The npm `.cmd` happy path still works.

### 1.9 — Lower-risk IPC hardening bundle (P2, S each)
Group these small main.js changes:
- **`clipboard:read` unrestricted (main.js:1238):** gate with `if (event.sender.id !== mainWindow.webContents.id) return '';` — mirrors the terminal-close ownership pattern; the three gesture-driven paste call sites are unaffected.
- **`app:log` event spoofing (main.js:979):** allowlist `level` to `info/warn/error/debug` and force-prefix the event with `renderer.` so renderer entries can't impersonate `terminal.kill`/`app.close.confirmed`. App.js already emits `renderer.*`, so well-behaved callers are unchanged.
- **`fs:list-directory` recon (main.js:999):** block listing of `~/.ssh` and `~/.aws` (`BLOCKED_LISTING_PATHS`) with a `writeLog('warn', ...)`; zero impact on normal browsing (users never browse those in EZvibes). Broad free-navigation stays intact by design.
- **Exit event after explicit close (main.js:1113):** add a `closedIntentionally` flag set in `killSession`; in `onExit` log at `info` (not `warn`) with `reason: 'user-initiated'` and optionally skip the redundant `sendToSessionOwner`. Renderer already discards the event safely.

### 1.10 — PTY onData/onExit disposables never disposed (P3, S)
**Problem:** The `IDisposable`s from `terminalProcess.onData/onExit` (main.js:1109) are discarded; `killSession` never disposes them. The adversarial review confirms this is a GC-collectible reference island, not a real leak, but it violates the IDisposable contract.
**Recommended change:** Store `onDataDisposable`/`onExitDisposable` on `sessionRecord` and `.dispose()` them (in try/catch) after `pty.kill()` in `killSession`.
**Why it preserves functionality:** Cleanup is eager and explicit; the final exit emission still fires before disposal. Zero behavioral change.

---

## 2. Architecture & maintainability

### 2.1 — Panel-mode: hard-coded EZvibes path (P1, M)
**Problem:** `EZVIBES_FOLDER = 'C:\\Users\\Oskari\\Documents\\EZvibes'` (panel-mode.js:2) is the only value passed to `getSessionWindowByPath`. Move/clone the repo and every Send silently degrades to clipboard with a misleading toast.
**Recommended change:** Add `app:folder` IPC returning `app.getAppPath()`, expose as `window.ezvibes.getAppFolder()`, and resolve it at module load with the literal as fallback.
**Why it preserves functionality:** Returns the identical path on the current machine (no behavior change), but auto-corrects elsewhere. Preserve the slash/case normalization `getSessionWindowByPath` does (app.js:3656).

### 2.2 — Panel-mode liveness gate mismatch (P1, S)
**Problem:** Dispatch gates on `activeTab.ptyAlive` only (panel-mode.js:203), but tabs are born `ptyAlive: true, ptyCreated: false` (app.js:2440). The app's own contract is `isTabReadyForInput = isTabLive(tab) && ptyCreated === true` (app.js:1798). A write can land in a not-yet-spawned PTY and silently vanish while the user sees "delivered".
**Recommended change:** Expose `isTabReadyForInput` on `window.ezvibesInternals` and gate on it in panel-mode.
**Why it preserves functionality:** Tabs passing the new gate are a strict subset of the old; the extra cases (pre-spawn/exited/failed) fall to the clipboard fallback instead of dropping silently.

### 2.3 — Panel-mode ignores live sibling tabs (P2, S)
**Problem:** Dispatch only considers the EZvibes window's single active tab (panel-mode.js:196). If that tab is a dead Codex while a live sibling exists, it falls to clipboard. App.js already has the richer `getCurrentInputTab` (app.js:1807), unexposed.
**Recommended change:** Expose `getCurrentInputTab` on internals and delegate to it. **Scope caution:** keep dispatch constrained to the EZvibes self-editing session — do not route into an unrelated project's session.
**Why it preserves functionality:** Reuses the resolver the feature was designed around (sibling tabs, minimized windows, `lastActiveTabId`).

### 2.4 — Panel-mode unconditional trailing CR (P2, S)
**Problem:** Every payload appends a bare `\r` *outside* the bracketed-paste markers (panel-mode.js:207), force-submitting into Codex/TUI contexts mid-response. The CR is justified only for Claude's LF-drop quirk.
**Recommended change:** Remove the trailing `\r` from the wrapped string. Claude still auto-submits on the `\x1b[201~` terminator.
**Why it preserves functionality:** Claude behavior is unchanged (terminator triggers submit); Codex/TUI no longer receive a spurious Enter.

### 2.5 — Panel-mode internals coupling undocumented (P3, S)
**Problem:** Panel-mode duck-types `window.ezvibesInternals` with optional-chaining guards that swallow breakage into a silent clipboard fallback (panel-mode.js:196). A rename of `ptyAlive` in app.js would silently disable dispatch.
**Recommended change:** Add a JSDoc contract above the `window.ezvibesInternals` assignment documenting the stable surface and the Tab fields read; optionally expose `isTabLive` so panel-mode stops reading the raw field. (Folded into the modularization in 2.8.)

### 2.6 — Narration log unbounded in memory (P3, S)
**Problem:** `addNarrationEvent` (app.js:3492) pushes events with no cap; `state.narrationByPath` is renderer-only and lost on restart. (`transcriptBuffer` is already capped at 20k chars; only `events[]` grows.)
**Recommended change:** Trim after push: `if (n.events.length > 500) n.events.splice(0, n.events.length - 500);` (matches the main `LIVE_LOG_LIMIT=500`).
**Why it preserves functionality:** Keeps the most-recent events the sidebar renders; no persistence/IPC needed.

### 2.7 — State persistence across restarts (P2, M)
**Problem:** Zero persistence — all session/window/tab state lives in in-memory Maps (app.js:3-10); restart wipes window layout, tab labels, custom names, counters, orange state.
**Recommended change:** Add a main-process JSON store + `state:load`/`state:save` IPC on `window.ezvibes` (no raw fs in renderer). Persist a **plain-JSON snapshot only** (`folderPath, folderName, nextTabNumber, minimized`, and tabs `{agent, customLabel, numericLabel}`) — never DOM nodes, observers, timers, or live `sessionId`s. On startup: validate shape, drop folders that no longer exist, rebuild windows via existing builders, then **spawn fresh PTYs** (node-pty sessions die with the process — "restore" means re-creating layout + relaunching agents, not reattaching). Independently, restore the top-level BrowserWindow geometry via the windowStateKeeper pattern with an off-screen guard (`screen.getAllDisplays()`).
**Why it preserves functionality:** Uses the existing IPC/preload pattern; the serializable projection avoids corrupting reload. **Hard constraint:** main.js is CommonJS while modern `electron-store` is ESM-only — write a ~30-line atomic JSON store (write-temp-then-rename) to avoid the ESM mismatch, the lowest-risk fit for this no-bundler app.
**Source:** https://github.com/sindresorhus/electron-store ; https://github.com/mawie81/electron-window-state

### 2.8 — Modularize the ~3650-line `app.js` IIFE (P3, L)
**Problem:** `renderer/app.js` is one ~3650-line IIFE (CLAUDE.md's "1200 lines" is stale) with a 49-field `state` object and cross-file coupling via the `window.ezvibesInternals` global. Registers ~98 `addEventListener`/`ResizeObserver` bindings vs ~16 removals — manual, asymmetric lifecycle.
**Recommended change:** Switch `index.html` scripts to `type="module"` (keep the two vendor xterm scripts as classic scripts loaded first), split into cohesive modules (`folder-browser`, `session-windows`, `tabs`, `terminal-lifecycle`, `narration`, `inbox`, `live-log`), replace `window.ezvibesInternals` with explicit `export`/`import`, and tie per-instance listeners to an `AbortController` torn down on window close. Use event delegation on `els.grid`/tab strip/inbox body for churned children.
**Why it preserves functionality:** ES modules are deferred and run once with private scope; relative specifiers need no bundler. **Do this last and incrementally** — it touches everything, so it must follow the correctness fixes and be verified against the fit sequence and the full E2E flow.
**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules ; https://css-tricks.com/build-a-state-management-system-with-vanilla-javascript/

### 2.9 — New-tab menu outside-handler leak (P3, S)
**Problem:** `openNewTabMenu` registers the outside-close `mousedown` via `setTimeout(...,0)` (app.js:1958); if the window closes in the same tick, `closeNewTabMenu`'s `removeEventListener` runs before the listener exists, leaking a capture-phase handler on a detached node.
**Recommended change:** Register synchronously (drop the `setTimeout`); the existing `if (ev.target === addBtn) return;` guard already prevents the opening click from self-closing.
**Why it preserves functionality:** "Click + then click elsewhere closes" behavior is unchanged; removal now always finds the handler.

---

## 3. Build / native deps / packaging / testing

### 3.1 — Stop patching Spectre out of node_modules (P1, M)
**Problem:** `postinstall.js` strips `'SpectreMitigation': 'Spectre'` from `binding.gyp`/`winpty.gyp` and generated `.vcxproj` (the opposite of node-pty's documented fix), then `electron-rebuild --build-from-source`. It also hard-throws if upstream strings change (line 93), failing the entire `npm install`.
**Recommended change:** Document the maintainer-sanctioned prerequisite — install "MSVC v143 Spectre-mitigated libs" via the VS Installer — and prefer it. Keep the patch only as a clearly-labeled, gated fallback. **Convert the hard `throw` at line 93 to `console.warn`** so a future node-pty bump degrades gracefully. Also drop/guard the dead winpty.gyp patches (node-pty 1.x uses ConPTY on Win 11; winpty is unused).
**Why it preserves functionality:** `electron-rebuild --force --build-from-source` (the correct part) stays. The warn-instead-of-throw only changes a missing-string abort into a visible warning.
**Source:** https://raw.githubusercontent.com/microsoft/node-pty/main/README.md ; https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules

### 3.2 — Pin Electron exactly + deterministic rebuild + upgrade cadence (P2, S)
**Problem:** `electron` is `^42.2.0` (caret) while `node-pty` is exact `1.1.0`; a silent caret bump changes the ABI without re-triggering rebuild in lockstep, producing a node-pty binary that won't load. Separately, security research item 16 frames Electron currency as a recurring control, not a one-time pin: an exact pin gives ABI determinism but, left untouched, lets the app sit on an Electron major that has aged out of Chromium security backports.
**Recommended change:**
- Pin `electron` to `42.2.0` exactly; pass `--version <electronVersion>` to electron-rebuild (the script already reads it via `readElectronVersion()`). Add `node-abi` as an explicit `devDependency` (it's currently an undeclared transitive dep behind the ABI diagnostic, postinstall.js:70).
- **Establish an upgrade cadence (security control, distinct from the pin):** periodically check [Electron's supported-releases window](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) and bump the pinned major **before** it leaves Chromium security backports. Pair each bump with the node-pty rebuild (3.1/3.3) and an xterm-fit + full-E2E verification, and re-pin deliberately. Record this as a recurring CLAUDE.md caution so future agents re-pin on purpose rather than by caret drift.
**Why it preserves functionality:** The pin makes the rebuilt ABI deterministic across machines (no runtime change); the cadence is a process note, not a code change, and each bump is gated behind the existing rebuild + fit/E2E verification.
**Source:** https://github.com/electron/rebuild/blob/main/README.md ; Electron security checklist item 16 + release timelines: https://www.electronjs.org/docs/latest/tutorial/electron-timelines

### 3.3 — Toolchain preflight in postinstall (P2, S)
**Problem:** `runElectronRebuild` (postinstall.js:152) forces `--build-from-source` with no MSVC/Python check; a missing toolchain dies with a raw node-gyp error — the single biggest barrier to standing the app up on a new box.
**Recommended change:** Add `checkWindowsBuildTools()` (`where.exe cl.exe` + `python --version`) before the rebuild; on failure print an actionable message (VS Build Tools "Desktop development with C++" + Spectre libs + Python links) and exit. Runs only on win32; near-instant on a configured machine.
**Why it preserves functionality:** Pure preflight; correct environments are unaffected. Keep `--build-from-source` (node-pty has no Electron prebuilds — a wrong-ABI prebuild would reintroduce PTY load failures).

### 3.4 — Add a packaged build (P2, M)
**Problem:** No packaging at all — the only run path is a from-source clone + native rebuild (CLAUDE.md "No packaged build config yet").
**Recommended change:** Add `electron-builder` (devDep) with a Windows NSIS target, a `dist` script, and a `build` block. **Critically, `asarUnpack: ['**/node_modules/node-pty/**']`** so node-pty's `.node` and spawn-helper load (native `.node` cannot load from inside asar). Smoke-test that a terminal tab launches from the installed build. An NSIS oneClick installer can create the Start-Menu shortcut + AppUserModelID natively, letting `ezvibes.vbs`/`Install-EzvibesShortcuts.ps1` become optional (keep `com.ezvibes.app` consistent for taskbar grouping). Layer Azure Trusted Signing + electron-updater later (signing first, then updates verify).
**Why it preserves functionality:** No bundler to integrate; `npm start` (`electron .`) is untouched. The asarUnpack rule protects the product-critical terminal.
**Source:** https://www.electronforge.io/config/plugins/auto-unpack-natives ; https://github.com/electron-userland/electron-builder ; https://www.electronjs.org/docs/latest/tutorial/code-signing

### 3.5 — Logging robustness (P2, S)
**Problem:** `writeLog` (main.js:133) calls `mkdirSync` + `appendFileSync` synchronously on **every** event with an empty `catch {}`; daily JSONL files accumulate forever with no rotation (main.js:84).
**Recommended change:** Cache the dir-created check (`let logDirEnsured = false;`), replace `catch {}` with `console.error(...)` so write failures are visible, and add a startup prune of `ezvibes-*.jsonl` older than 30 days (try/catch, never deletes today's live file).
**Why it preserves functionality:** Same write path and filename scheme; only the repeated stat and silent-swallow are removed. Don't rewrite/unlink the file currently being appended.

### 3.6 — Async + consistent errors for fs IPC (P3, M)
**Problem:** `listDirectory` (main.js:757) does `readdirSync` + per-entry `statSync`, blocking the main thread on large dirs; `fs:list-directory` (main.js:999) has no try/catch, leaking raw Node errors (absolute paths, ENOENT/EPERM) to the renderer — inconsistent with the `{success:false}` shape of create/rename/delete.
**Recommended change:** Wrap the handler in try/catch returning `{path, parent:null, entries:[], error}` and guard callers (`navigateTo`, `refreshCurrentDirectory`) on `listing.error`. Migrate to `fs.promises` as a follow-up (preserve the per-entry stat-skip degradation).
**Why it preserves functionality:** Success path unchanged; the try/catch wrapper alone fixes the error-contract inconsistency at minimal risk.

### 3.7 — Add a test suite (P3, M)
**Problem:** Zero behavior tests behind a parse-only `check:syntax` gate.
**Recommended change:** Adopt the pyramid. Add **Vitest** (no Babel/bundler config) with a two-project split — `node` env for main.js logic, `jsdom` for renderer. Mock `window.ezvibes` and `node-pty` at the module boundary so tests run in plain Node with no Electron rebuild. Cover the riskiest pure logic first: `defaultTabLabel`/`nextTabNumber`, `AGENT_COMMANDS` normalization, panel-mode payload building, PTY session-ownership guard. Layer a thin Playwright `_electron.launch({ args: ['.'] })` E2E suite (~10-20 critical flows, using `data-panel-id` as stable hooks) on a `windows-latest` CI runner (no xvfb) that runs `electron:install` + `rebuild:native` first.
**Why it preserves functionality:** Tests are additive; mocking keeps them off the native addon.
**Source:** https://www.electronjs.org/docs/latest/tutorial/automated-testing ; https://playwright.dev/docs/api/class-electron ; https://playwright.dev/docs/ci

---

## 4. UX & accessibility

### 4.1 — Folder context menu is keyboard/AT-inaccessible (P1, M)
**Problem:** `showContextMenu` (app.js:1114/1146) builds bare `<button>`s in a `<div>` with no `role="menu"`/`menuitem`, never focuses an item, and is reachable only via physical right-click — no ContextMenu-key/Shift+F10 path. The new-tab menu (app.js:1896) already does this correctly. This is the app's **primary** interaction (Launch Claude/Open/Rename/Delete).
**Recommended change:** Mirror `openNewTabMenu`: set `role="menu"` on the container, `role="menuitem"`+`tabIndex=-1` per item, focus the first enabled item on open, add Arrow/Escape/Tab keydown, and a card `keydown` for ContextMenu/Shift+F10 that opens at the card rect with a return-focus path.
**Why it preserves functionality:** Additive — the mouse flow (innerHTML rebuild, global click-to-close, `stopPropagation`+`hideContextMenu`) is unchanged; just ensure focus-on-open doesn't fight the global click/Escape handlers.

### 4.2 — No `prefers-reduced-motion` support (P2, S)
**Problem:** No `prefers-reduced-motion` anywhere (styles.css). An infinite `attentionPulse` (styles.css:1511) and full-window genie squash/stretch (styles.css:1140-1176) run unconditionally — exactly the vestibular/WCAG 2.3.3 motion the OS preference exists to suppress.
**Recommended change:** Add one `@media (prefers-reduced-motion: reduce)` block: make the attention dot static (`animation:none; opacity:0.8`) and replace `.folder-terminal.opening/.minimizing` with a plain opacity transition (`animation:none; transition: opacity 150ms ease`).
**Why it preserves functionality:** **Critical:** the genie open animation's `animationend` is what triggers the stable-fit. Use a short opacity *transition* (which still fires `transitionend`) or otherwise ensure the fit callback still runs — never set `animation:none` without preserving the completion signal, or the terminal may open 0×0.

### 4.3 — Disabled/muted text low contrast (P3, S)
**Problem:** `.icon-button:disabled { color:#59605d }` (~2.9:1 on `#151817`) and `.context-menu-item:disabled { color:#68716d }` (~3.1:1 on `#202423`, used for the documented Rename/Delete "Close the session first." state).
**Recommended change:** Raise to `#7a8480` (icon) and `#848e8a` (menu, including the `is-danger:disabled` override at styles.css:717 in lockstep).
**Why it preserves functionality:** Color-only; keep disabled visibly dimmer than enabled so it doesn't read as clickable.

### 4.4 — Glyph-only icon buttons lack accessible names (P3, S)
**Problem:** Back/Up/Refresh (index.html:19-21) and the close "X"s carry only `title` + a bare Unicode glyph; `title` is not a reliable accessible name and never shows on keyboard focus.
**Recommended change:** Add `aria-label` matching each `title` (`Back`/`Up`/`Refresh`/`What Was Made`/`Panel Mode`/`Close`). Don't collide with the existing `aria-pressed` toggles or double-label the Launch-Claude SVG (already `aria-hidden`).
**Why it preserves functionality:** Pure HTML attribute additions, zero behavior change.

### 4.5 — Tab strip clips overflowing tabs (P3, S)
**Problem:** `.folder-terminal-tab-strip` is `overflow:hidden` with no scroll/affordance (styles.css:755); the unlimited `+` button can push rightmost chips (and their close buttons) out of reach while their PTYs keep running.
**Recommended change:** Change to `overflow-x:auto; overflow-y:hidden` with `scrollbar-width:none` (+ `::-webkit-scrollbar{display:none}`).
**Why it preserves functionality:** Preserves the 72px right padding reserved for the minimize/close controls; native flex scroll reaches all chips without altering active-chip sizing tied to the fit assumptions.

### 4.6 — `nextTabNumber` grows unbounded (P3, S)
**Problem:** `nextTabNumber++` (app.js:2438) is never reset; after closing tabs, labels show gaps (`CLAUDE`, `CLAUDE 5`) and the counter grows forever in a long-lived window.
**Recommended change:** In `performCloseTab`, reset only when the window empties: `if (sessionWindow.tabs.length === 0) sessionWindow.nextTabNumber = 1;`.
**Why it preserves functionality:** Preserves the documented "no reuse while tabs exist" contract; never relabels live tabs (avoids retroactively rewriting narration/log history).

### 4.7 — Per-tab xterm addons: dispose FitAddon, add web-links, optional WebGL (P3, S/M)
**Problem:** The per-tab `FitAddon` is never explicitly `dispose()`d on tab/window close. Separately, URLs in Claude/Codex output are not clickable, even though the app's entire purpose is hosting agent sessions whose output frequently contains URLs — xterm research names `@xterm/addon-web-links` a concrete, low-effort win that composes with the existing per-tab disposables.
**Recommended change:**
- Add `tab.fitAddon.dispose()` to the tab-close path alongside existing disposables.
- **Add `@xterm/addon-web-links` (P3/S):** add the dependency, `loadAddon(new WebLinksAddon())` per tab in `buildTab` **right after `term.open()` and before the first `fit()`**, and dispose it on tab close alongside the existing per-tab disposables and the new `tab.fitAddon.dispose()`. It makes URLs in agent output clickable and **cannot affect the fit sequence** (it only registers a link provider).
- Optionally add `@xterm/addon-webgl` per tab (load after `term.open()`, before first `fit()`) with `onContextLoss(() => webgl.dispose())` to speed up large Claude/Codex output bursts (auto-falls back to DOM).
**Why it preserves functionality:** All three are local to `buildTab`/teardown and cannot affect the sizing sequence. WebGL falls back automatically on context loss; web-links and FitAddon only add/remove a provider and an observer.
**Source:** https://github.com/xtermjs/xterm.js/blob/master/addons/addon-fit/README.md ; https://github.com/xtermjs/xterm.js/blob/master/addons/addon-web-links/README.md ; https://github.com/xtermjs/xterm.js/blob/master/addons/addon-webgl/README.md

---

## Phased roadmap

Each phase ends with a verification step that proves the guardrails hold.

### Phase 1 — P0 safety (do first)
**Items:** 1.1 delete confinement, 1.2 nested-session delete guard, 1.7 launch-await guard.
**Verify:** From DevTools console, `window.ezvibes.deleteFolder({path:'C:/Windows'})` is rejected; deleting a parent of a live-session folder is blocked with the toast; rapidly Launch-then-Close a window during the open animation and confirm (via the JSONL log + Task Manager) **no orphaned `claude`/`codex` process** survives. Confirm a normal child-folder delete still trashes correctly.

### Phase 2 — P1 hardening & high-value correctness
**Items:** 1.3 CSP, 1.4 sender validation, 1.5 before-quit guard (webContents-destroyed **and** per-owner count, applied as one edit), 1.6 will-navigate reorder + will-redirect/will-attach-webview, 2.1 panel-mode path, 2.2 liveness gate, 3.1 Spectre/postinstall, 4.1 context-menu a11y.
**Verify:** App launches and a terminal tab renders **with CSP applied** (no console CSP violations). Quit-with-live-sessions still prompts; a renderer crash no longer wedges quit; the before-quit gate counts the owner's sessions (not the global Map). Ctrl+R reload reaps PTYs but an in-page hash navigation does not; a synthetic redirect to a non-index URL is blocked by `will-redirect`; a `<webview>` attach attempt is denied. Panel-mode Send reaches the terminal from a fresh clone path and only when the tab is truly ready. Fresh `npm install` succeeds on a box with Spectre libs and warns (not aborts) on a simulated upstream-string change. Open the folder menu and operate Launch Claude entirely by keyboard (ContextMenu key -> arrows -> Enter).

### Phase 3 — Durability: persistence, packaging, build determinism
**Items:** 2.7 state persistence, 3.2 pin/deterministic rebuild + upgrade-cadence note, 3.3 toolchain preflight, 3.4 packaged build, 3.5 logging robustness, 1.8/1.9 IPC bundle, 4.2 reduced-motion.
**Verify:** Restart the app — window layout + tab labels restore and **fresh PTYs spawn** (no attempt to reattach dead sessions); a deleted/missing folder is silently dropped. Build the NSIS installer, install on a clean profile, and confirm a terminal tab launches (asarUnpack works). `prefers-reduced-motion` OS setting kills the pulse/genie motion **yet the terminal still fits** (fit callback fires via the opacity transition). Logs prune past 30 days and surface write errors. Confirm the upgrade-cadence caution is recorded in CLAUDE.md.

### Phase 4 — Maintainability & polish (last, highest churn)
**Items:** 2.8 modularize app.js, 2.3/2.4/2.5/2.6/2.9 panel-mode + leak cleanups, 3.6 async fs IPC, 3.7 tests, 4.3-4.7 contrast/labels/overflow/counter/addon-dispose+web-links+WebGL.
**Verify:** Run the new Vitest suite green; run the Playwright E2E pyramid on `windows-latest`. After the ES-module split, re-run the **full E2E flow** (Launch Claude -> `+` Claude/Codex tabs -> close last tab closes window -> minimize -> orange restore) and confirm the fit sequence still produces a correctly sized terminal in `.terminal-host`. Confirm a URL in agent output is clickable (web-links) and that closing a tab disposes its FitAddon/web-links/WebGL addons. Confirm panel-mode dispatch still works via the explicit module import (no `window.ezvibesInternals` regression).

**Sequencing rationale:** Phase 1 stops data loss and orphaned processes (irreversible harm) before anything else. Phase 2 closes the security/lifecycle gaps that are cheap and self-contained. Phase 3 makes the app durable and distributable without touching renderer internals. Phase 4 — the high-churn modularization and tests — comes last so it lands on a codebase whose behavior is already correct and (by then) test-covered, minimizing the risk that refactoring silently breaks the terminal embedding or the fit sequence.

Relevant files: `C:\Users\Oskari\Documents\EZvibes\main.js`, `C:\Users\Oskari\Documents\EZvibes\preload.js`, `C:\Users\Oskari\Documents\EZvibes\renderer\app.js`, `C:\Users\Oskari\Documents\EZvibes\renderer\panel-mode.js`, `C:\Users\Oskari\Documents\EZvibes\renderer\index.html`, `C:\Users\Oskari\Documents\EZvibes\renderer\styles.css`, `C:\Users\Oskari\Documents\EZvibes\scripts\postinstall.js`, `C:\Users\Oskari\Documents\EZvibes\package.json`.