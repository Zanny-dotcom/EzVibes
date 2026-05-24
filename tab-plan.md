# Tab feature plan — Chrome-style tabs per Claude session window

Date: 2026-05-24
Status: design approved by user, not yet implemented

This document is the full design + implementation outline. It is self-contained so a future session can pick up cold.

---

## Goal

Add Chrome-style tabs to each open Claude session window. Each tab is an independent `claude --dangerously-skip-permissions` instance running in the **same folder** as the window. Otherwise the app behaves exactly as today: per-folder windows, Genie minimize back to the folder card, orange folder while minimized, double-click orange to restore.

User intent (verbatim): "we want to add feature, where the user is able to open more claude instances by clicking + on the open claude session the same way google chrome has tabs ... if i minimize 3 tabs, they all stay in their own folder. so i can have multiple folders having sessions open with multiple tabs."

---

## User decisions (already confirmed)

1. **Tab label**: just a number (`"1"`, `"2"`, `"3"`). Right-click → Rename on every tab (same as existing nubbin rename).
2. **Per-tab close**: tiny `×` on each tab on hover, Chrome-style.
3. **Last tab close**: closing the last tab closes the whole window (Genie close animation, folder un-oranges).

---

## Current architecture (what's there today)

Single-window Electron 33 app. Stack: `node-pty@1.1.0`, `@xterm/xterm@5.5.0`, `@xterm/addon-fit@0.10.0`. PowerShell-first (pwsh → powershell.exe fallback). Sandbox + contextIsolation true, nodeIntegration false. See `HANDOFF.md` for product intent.

### Main process — `main.js`

- `sessions: Map<sessionId, ptyProcess>` (`main.js:8`) — flat map of every live PTY, keyed by the renderer-supplied sessionId. **Already supports N concurrent PTYs.**
- `detectShell()` (`main.js:20`) — pwsh, fallback to powershell.exe.
- `buildShellArgs(shell, cwd)` (`main.js:38`) — for PowerShell, builds an OSC-emitting prompt wrapper + `Set-Location -LiteralPath <cwd>` + `claude --dangerously-skip-permissions`, UTF-16LE base64-encodes as `-NoExit -EncodedCommand <b64>`.
- IPC: `terminal:create` (`main.js:136`), `terminal:input` (`:187`), `terminal:resize` (`:194`), `terminal:close` (`:204`); main emits `terminal:data` and `terminal:exit`.

### Preload — `preload.js`

Exposes `window.controlPanel`: `createTerminal({sessionId, cwd, cols, rows})`, `writeTerminal`, `resizeTerminal`, `closeTerminal`, `onTerminalData`, `onTerminalExit`, `readClipboard`, `writeClipboard`, plus folder browsing.

### Renderer — `renderer/app.js` (~one big IIFE)

Relevant state (`app.js:3`):
```js
sessionsByPath: Map<folderPath, session>
sessionsById:   Map<sessionId, session>
```

Relevant DOM created per session (`createSession`, `app.js:403`):
```html
<section class="folder-terminal" data-session-id="…">
  <div class="folder-terminal-nubbin" title="Right-click to rename">
    <span class="nubbin-text">…</span>
  </div>
  <div class="folder-terminal-tab">
    <div class="session-controls">
      <button class="session-control minimize">_</button>
      <button class="session-control close">×</button>
    </div>
  </div>
  <div class="terminal-pocket">
    <div class="terminal-host"></div>   <!-- xterm opens here -->
  </div>
</section>
```

Key existing functions:
- `launchClaudeForPath(folderPath, sourceCard)` (`app.js:371`) — dedupes by path, creates session, plays open animation, calls `api.createTerminal`.
- `createSession(folderPath)` (`app.js:403`) — builds the DOM above, wires controls.
- `minimizeSession` / `restoreSession` (`app.js:494`, `:509`) — Genie animations to/from the folder card.
- `animateOpen(session, sourceCard)` (`app.js:528`) — Genie open.
- `fitAfterStableLayout(session, opts)` (referenced from `app.js:388`) — the delayed-fit sequence the HANDOFF warns against breaking.
- Nubbin rename: inline-input pattern at `app.js:691-716` triggered from the nubbin context menu (`app.js:485`).
- `api.onTerminalExit(...)` (`app.js:215`) — handles PTY death.

---

## Design

### Approach: renderer-only refactor

Main process and IPC stay untouched. Each tab is just another sessionId in the existing IPC contract; main already routes per-sessionId. All window↔tab bookkeeping lives in the renderer.

Alternatives rejected:
- *Main also tracks window→tabs grouping.* Overkill; main doesn't care about UI grouping.
- *One shell hosting multiple claude in panes.* Wrong model; tabs need independent PTYs.

### Layout

The existing `.folder-terminal-nubbin` already looks like a Chrome tab. Extend it: the nubbin becomes the **active tab's chip**; additional tab chips extend horizontally to the right; the `+` button sits at the end of the strip (this is where the user drew the red square). Window controls (`_`, `×`) stay top-right and now act on the whole window.

```
 ┌─[Tab 1] [Tab 2 ×] [Tab 3 ×] [+]──────────[_ ×]┐
 │                                               │
 │   <active tab's terminal-host>                │
 │                                               │
 └───────────────────────────────────────────────┘
```

Inactive tabs reveal their `×` on hover. Active tab keeps the current nubbin/tab visual.

### Renderer state model

Rename the existing `session` concept → **window**, and introduce **tab** underneath:

```js
state.windowsByPath : Map<folderPath, Window>   // was sessionsByPath
state.windowsById   : Map<windowId,   Window>
state.tabsById      : Map<tabId,      Tab>      // was sessionsById; tabId == IPC sessionId

Window = {
  id,                                // window UUID (not an IPC sessionId)
  folderPath,
  windowEl,                          // .folder-terminal
  tabStripEl,                        // new container holding tab chips + `+`
  terminalPocketEl,                  // .terminal-pocket — now holds N .terminal-host children
  tabs: Tab[],                       // ordered left-to-right
  activeTabId,
  minimized,
  customName,                        // window-level rename, set via nubbin context menu (existing)
}

Tab = {
  id,                                // UUID, used as the IPC sessionId
  windowId,
  term,                              // xterm instance
  terminalEl,                        // its own .terminal-host inside the pocket
  tabChipEl,                         // its chip in the tab strip
  tabLabelEl,
  closeBtnEl,
  customName,                        // null → auto-numbered, else the renamed string
  numericLabel,                      // monotonic insertion number; never reused
  ptyAlive,
}
```

### Lifecycles

- **Open first session for a folder** (existing flow, slightly modified): if `windowsByPath` already has the path → restore. Otherwise create window + first tab in one go, play existing Genie open animation, call `api.createTerminal({sessionId: tab.id, cwd: window.folderPath, ...})`. Narration: `session-started` ("Claude launched in <folder>.").
- **Click `+`**: create a new tab on the same window. Build a new `.terminal-host` inside the pocket, hide the previously-active host, open xterm in the new host, set new tab active, call `api.createTerminal({sessionId, cwd: window.folderPath, cols, rows})`. No window animation. Narration: `tab-opened` ("Tab N launched.").
- **Click a tab chip**: toggle active.
  1. Hide previous active `.terminal-host` (`display: none`).
  2. Show new one.
  3. `fitAddon.fit()` on the newly visible term (it likely has stale geometry — hidden hosts measure 0).
  4. `api.resizeTerminal(tab.id, cols, rows)`.
  5. Focus the new term.
  6. Update `aria-selected` / active class on chips.
- **Click `×` on a tab chip**:
  - If it's the only tab → behave exactly like the existing window-close (kill PTY, play Genie close animation, un-orange the folder card).
  - Else → `api.closeTerminal(tab.id)`, remove its chip + its `.terminal-host` from the DOM, drop it from `window.tabs`. If it was the active tab, activate its right neighbor (else left). Narration: `tab-closed`.
- **Minimize / restore**: unchanged. Operates on the whole window; all tabs travel with it. All PTYs keep running while minimized.
- **Window `×` (existing control)**: kill every tab's PTY (`api.closeTerminal` for each), then run the existing close animation, then DOM-remove the window.
- **Rename window**: nubbin context menu → existing inline-input pattern at `app.js:691-716`. Unchanged. Persists as `window.customName`.
- **Rename a tab**: right-click any tab chip → context-menu item "Rename" → reuse the same inline-input pattern, but on the chip's label. Persists as `tab.customName`.
- **PTY exits on its own** (`terminal:exit`): mark `tab.ptyAlive = false`, write a red banner into that tab's xterm (`\r\n\x1b[31mclaude exited (code N)\x1b[0m`), keep the chip visible. Don't auto-close. User can close the dead tab via its `×`.

### Numbering rule

Tabs auto-label `"1"`, `"2"`, `"3"`, … by insertion order. **Numbers are not reused** when a tab in the middle closes (avoids jumpy labels and protects custom names). New tabs take `max(window.tabs.map(t => t.numericLabel)) + 1`. `tab.customName` always wins over the number.

### Narration

`narrationByPath` stays keyed by folder. New event types:
- `tab-opened` — fired by `+`.
- `tab-closed` — fired by per-tab `×`. Not fired on window-close (that's the existing session-end event).

Existing `session-started` continues to mean "the window opened" (= first tab created).

### Files touched

| File | Change |
| --- | --- |
| `renderer/app.js` | State model rename (session → window/tab), tab-strip DOM, tab lifecycle fns, tab-aware fit/resize, tab rename, multi-host pocket switching. Bulk of the work. |
| `renderer/styles.css` | Tab chip styles, hover-`×` state, `+` button styling, multi-host pocket (only active host visible), active-tab visual matching the existing nubbin. |
| `renderer/index.html` | No change (tab strip is built in JS). |
| `main.js` | No change. |
| `preload.js` | No change. |
| `HANDOFF.md` | Update "Runtime Model" + "Current UX" sections to describe windows containing tabs. |

### Risks (do not regress)

1. **xterm in a hidden host doesn't auto-fit.** Tab switching must call `fitAddon.fit()` and send `terminal:resize` for the newly visible tab. Mirror the existing `fitAfterStableLayout` discipline (the HANDOFF flags this as the #1 thing not to break).
2. **`ResizeObserver` per tab.** Each `.terminal-host` keeps its own observer, but hidden hosts report 0×0. Guard against `cols/rows < 1` before calling `term.resize` / `api.resizeTerminal`.
3. **Animation lookup currently keyed by path → session.** With tabs, animation still targets the **window**, not a tab. Don't accidentally start an open/close animation per-tab.
4. **Window close must kill every tab's PTY**, not just the active tab's. A single missed `closeTerminal` leaks a PTY (main keeps it in its `sessions` Map until app quit).
5. **Folder orange state is per-window** (= per folderPath), not per-tab. Should not flicker when tabs come and go.
6. **Encoded-command init only runs in the first PTY of each tab.** That's correct — each new tab gets its own PowerShell with its own `Set-Location` + `claude --dangerously-skip-permissions` via `buildShellArgs`. No change needed in main.

---

## Implementation outline (step-by-step)

A future session can follow this. Each step is small enough to commit independently.

### Step 1 — Rename `session` → `window` in renderer state (pure rename, no behavior change)

- Rename `state.sessionsByPath` → `state.windowsByPath`, `state.sessionsById` → `state.windowsById`.
- Rename `createSession` → `createWindow`, `minimizeSession` → `minimizeWindow`, `restoreSession` → `restoreWindow`, `findCard`/other call-sites updated.
- The window object still has exactly one PTY/term at this point — no tabs yet.
- Verify the app still runs identically. **Commit.**

### Step 2 — Extract the tab from the window object

Introduce the `Tab` shape inside each `Window` even with only one tab:
- `window.tabs = [tab0]`, `window.activeTabId = tab0.id`
- Move `term`, `terminalEl`, `ptyAlive` off the window onto the tab.
- `state.tabsById = new Map()` for IPC routing.
- All call-sites that touch `term` / `terminalEl` now go through `getActiveTab(window)`.
- Still no tab strip in the DOM. Behavior identical. **Commit.**

### Step 3 — Build the tab-strip DOM

- Extend `createWindow` so `.folder-terminal-tab` contains a tab strip on the left (chips + `+`) and the existing controls on the right.
- The active tab's chip visually IS the existing nubbin — fold `.folder-terminal-nubbin` into the chip so the iconic visual is preserved.
- With only one tab, the strip just shows that one chip + `+`.
- Wire the `+` button to a new `createTab(window)` function that initially just logs.
- Wire chip click to a new `switchToTab(window, tabId)` function that initially just logs.
- Wire per-chip `×` to a new `closeTab(window, tabId)` function that initially just logs.
- Style in `styles.css`. **Commit.**

### Step 4 — `createTab` implementation

- Mint a new tab UUID.
- Append a new `.terminal-host` inside `window.terminalPocketEl` (hidden via CSS class until switched to).
- Construct an xterm instance + FitAddon for it.
- Add a tab chip to the strip (numbered = `max(numericLabel)+1`).
- Set as active (calls into `switchToTab`).
- Call `api.createTerminal({sessionId: tab.id, cwd: window.folderPath, cols, rows})`.
- Add narration `tab-opened`.

### Step 5 — `switchToTab` implementation

- Hide every host in this window's pocket; show the target tab's host.
- `tab.fitAddon.fit()`; `api.resizeTerminal(tab.id, term.cols, term.rows)`.
- Focus the term.
- Toggle `aria-selected` / `.active` on chips.

### Step 6 — `closeTab` implementation

- If `window.tabs.length === 1` → call existing window-close path.
- Else: `api.closeTerminal(tab.id)`; dispose xterm; remove chip and host from DOM; splice from `window.tabs`; remove from `state.tabsById`. If was active, switch to the right neighbor (else left).
- Add narration `tab-closed`.

### Step 7 — Window-close kills all PTYs

- Update the existing window `×` handler to iterate `window.tabs` and call `api.closeTerminal(tab.id)` for each before/while running the close animation.

### Step 8 — Per-tab rename

- Add a context-menu handler on each tab chip with a single "Rename" item.
- Reuse the inline-input pattern at `app.js:691-716`. On commit, set `tab.customName` and re-render the chip label.

### Step 9 — Handle `terminal:exit` per tab

- Existing `api.onTerminalExit` (`app.js:215`) currently looks up by sessionId in `sessionsById`. It will now find the tab in `tabsById`.
- Mark `tab.ptyAlive = false`; write the red banner into its xterm; **do not** close the chip. Keep the tab visible until the user closes it.

### Step 10 — HANDOFF.md update

- Update "Runtime Model" to describe `windowsByPath` / `tabsById`.
- Update "Current UX" to mention tabs and the `+` button.
- Add to "Cautions": tab switching must re-fit; hidden hosts measure 0.

### Step 11 — Manual verification

Run `npm start` and verify:
- Open a session on folder A → one tab, behaves like today.
- Click `+` → second tab opens in folder A's cwd, Claude launches.
- Switch between tabs → both terminals are responsive, no truncation/clipping.
- Right-click tab 2 → Rename → label updates.
- Close tab 2 via its `×` → tab 1 remains, window stays.
- Open a second session on folder B → independent window.
- Minimize window A → all tabs minimize together, folder A turns orange.
- Restore window A → previously-active tab is still active, terminal still responsive.
- Close window A via its `×` → both PTYs die, folder un-oranges.

---

## Open questions / things to decide during implementation

None that block design approval. The following are minor and can be settled while implementing:

- **Visual width of inactive tab chips.** Probably narrower than the active nubbin so the strip fits a few tabs without overflow. If overflow happens, hide overflowing chips behind a small "more" affordance — but defer until a user actually opens 6+ tabs.
- **Keyboard shortcuts.** Out of scope for v1 unless trivial to add (Ctrl+Tab / Ctrl+W). User didn't ask. Defer.
- **Persisting tabs across app restart.** Out of scope; HANDOFF says "no persistent session state across app restarts" is a known limitation already.
- **Dragging tabs to reorder.** Out of scope for v1.

---

## How to resume in a future session

Tell the next Claude:
> "Read `tab-plan.md` at the repo root. The design is approved. Start at Step 1 of the Implementation Outline. Commit after each step."

Or just paste this file's contents into the new session.
