# Tab feature plan - Chrome-style tabs per Claude session window

Date: 2026-05-24
Status: design approved by user, plan corrected for implementation

This document is the full design and implementation outline for adding Chrome-style tabs to Claude Control Panel. It is intended for multiple Claude/Codex agents to execute later. Do not treat this file as implementation; the app code has not been changed yet.

Canonical project context: read `CLAUDE.md` first. `CLAUDE.md` is the source of truth for product intent, runtime constraints, and terminal sizing cautions.

---

## Goal

Add Chrome-style tabs to each open Claude session window. Each tab is an independent `claude --dangerously-skip-permissions` PTY running in the same folder as the containing session window.

Existing behavior to preserve:

- One visible folder-shaped popup per folder.
- Minimize and restore operate on the whole popup/window, not on individual tabs.
- All tab PTYs keep running while the window is minimized.
- A minimized folder card stays orange while its window is minimized.
- Reopening/launching a folder that already has a session window restores that window.
- xterm must stay embedded in `.terminal-host`; never replace it with an external PowerShell window.

User decisions already confirmed:

1. Tab labels are numeric by default: `1`, `2`, `3`, etc.
2. Right-click any tab chip -> Rename. A custom tab name overrides the numeric label.
3. Each tab has a small close button, visible on hover, Chrome-style.
4. Closing the last tab closes the entire session window.
5. The `+` button on an open session window starts another independent Claude instance in the same folder.

---

## Current architecture

Single-window Electron 33 app. Stack:

- `node-pty@1.1.0`
- `@xterm/xterm@5.5.0`
- `@xterm/addon-fit@0.10.0`
- Vanilla JavaScript, HTML, CSS
- Sandboxed renderer with `contextIsolation: true`, `nodeIntegration: false`

### Main process: `main.js`

The main process already supports many concurrent PTYs:

- `sessions: Map<sessionId, ptyProcess>` stores every live PTY by renderer-created `sessionId`.
- `terminal:create` validates `sessionId` and `cwd`, clamps `cols`/`rows`, detects `pwsh` or `powershell.exe`, and spawns a PTY.
- PowerShell launch uses `-NoExit -EncodedCommand` with a UTF-16LE base64 script that sets the folder and runs `claude --dangerously-skip-permissions`.
- `terminal:input`, `terminal:resize`, and `terminal:close` route by `sessionId`.
- `terminal:data` and `terminal:exit` emit `{ sessionId, ... }` back to the renderer.

No main-process change should be required for tabs. Each tab is just another `sessionId`.

### Preload: `preload.js`

`window.controlPanel` exposes the terminal, filesystem, clipboard, and drag/drop path bridge:

- `createTerminal({ sessionId, cwd, cols, rows })`
- `writeTerminal(sessionId, data)`
- `resizeTerminal(sessionId, cols, rows)`
- `closeTerminal(sessionId)`
- `onTerminalData(callback)`
- `onTerminalExit(callback)`
- clipboard and folder APIs

No preload change should be required for tabs.

### Renderer: `renderer/app.js`

The renderer is one IIFE and currently models exactly one Claude session per folder:

```js
state.sessionsByPath: Map<folderPath, session>
state.sessionsById:   Map<sessionId, session>
```

Current session lifecycle:

- `launchClaudeForPath(folderPath, sourceCard)` dedupes by path, creates one session, opens xterm, fits it, then calls `api.createTerminal`.
- `createSession(folderPath)` builds `.folder-terminal`, `.folder-terminal-nubbin`, `.terminal-pocket`, and one `.terminal-host`.
- `minimizeSession` / `restoreSession` operate on the entire popup.
- `closeSession` kills one PTY, disposes one xterm, and removes one popup immediately.
- `fitAfterStableLayout` waits for animation, fonts, and two frames before `fitAddon.fit()` and PTY resize.
- `findSessionForElement` currently finds the nearest `.folder-terminal` and reads `data-session-id`.

That last point must change. With multiple tabs, terminal events, context menus, clipboard, and drag/drop must route by the `.terminal-host` / tab id, not by the outer session window.

### Renderer: `renderer/styles.css`

Current visual structure:

```html
<section class="folder-terminal" data-session-id="...">
  <div class="folder-terminal-nubbin">
    <span class="nubbin-text">folder name</span>
  </div>
  <div class="folder-terminal-tab">
    <div class="session-controls">...</div>
  </div>
  <div class="terminal-pocket">
    <div class="terminal-host"></div>
  </div>
</section>
```

The tab implementation should replace the single `.folder-terminal-nubbin` with a tab strip. Do not keep a separate window-level nubbin rename target; the old nubbin behavior becomes per-tab rename.

---

## Design

### Renderer-only implementation

Main and preload stay untouched. All grouping of tabs into windows is renderer state.

Use the term `SessionWindow` in the code plan instead of a local variable named `window`. Do not create local variables named `window` in `renderer/app.js`; the browser global `window` is already used throughout the file.

### State model

Replace the renderer's one-session-per-folder state with one session window per folder and many tabs per session window:

```js
state.windowsByPath: Map<folderPath, SessionWindow> // replaces sessionsByPath
state.tabsById:     Map<tabId, Tab>                 // replaces sessionsById for IPC routing
```

`windowsById` is optional and not required unless the implementation chooses to look windows up by DOM id. Avoid adding it unless it removes real complexity.

Target shapes:

```js
SessionWindow = {
  id,                    // renderer UUID; not an IPC sessionId
  folderPath,
  folderName,
  windowEl,              // .folder-terminal
  tabStripEl,            // .folder-terminal-tab-strip
  addTabBtnEl,
  terminalPocketEl,      // .terminal-pocket
  tabs: Tab[],
  activeTabId,
  minimized,
  nextTabNumber,         // monotonic; starts at 1
  resizeObserver,        // preferably observes terminalPocketEl and fits active tab
  resizeTimer,
}

Tab = {
  id,                    // renderer UUID; this IS the IPC sessionId
  sessionWindow,          // reference to containing SessionWindow
  numericLabel,           // 1, 2, 3, never reused
  customName,             // null means show numericLabel
  ptyAlive,
  inputBuffer,            // moved from old session object
  term,
  fitAddon,
  terminalEl,             // one .terminal-host per tab
  tabChipEl,
  tabLabelEl,
  closeBtnEl,
}
```

Recommended helpers:

```js
getActiveTab(sessionWindow)
getTabLabel(tab)
createSessionWindow(folderPath)
createTab(sessionWindow, options)
startTerminalForTab(tab, options)
activateTab(sessionWindow, tabId, options)
closeTab(tab)
closeSessionWindow(sessionWindow, options)
scheduleStableFit(tab, options)
fitAfterStableLayout(tab, options)
fitTab(tab)
findTabForElement(element)
showTabContextMenu(tab, x, y)
startTabRename(tab)
```

### DOM contract

Build the tab strip dynamically in `renderer/app.js`. `renderer/index.html` should not need to change.

Target structure:

```html
<section class="folder-terminal" data-window-id="...">
  <div class="folder-terminal-tab-strip" role="tablist" aria-label="Claude sessions">
    <div class="folder-terminal-tab-chip is-active" role="presentation" data-tab-id="...">
      <button class="tab-activate" role="tab" aria-selected="true" title="Tab 1">
        <span class="tab-label">1</span>
      </button>
      <button class="tab-close" title="Close tab">x</button>
    </div>
    <button class="folder-terminal-tab-add" title="New tab">+</button>
  </div>

  <div class="folder-terminal-tab">
    <div class="session-controls">
      <button class="session-control minimize" title="Minimize">_</button>
      <button class="session-control close" title="Close">x</button>
    </div>
  </div>

  <div class="terminal-pocket">
    <div class="terminal-host is-active" data-tab-id="..."></div>
    <div class="terminal-host" data-tab-id="..." hidden></div>
  </div>
</section>
```

Notes:

- A tab chip is the rename target. There is no separate window-name rename in v1.
- The tab activation button and close button are siblings. Do not nest a `<button>` inside another `<button>`.
- The tab close button must stop event propagation so it does not also activate the tab.
- The add button must stop event propagation.
- The active tab chip should visually inherit the old nubbin shape. Inactive chips can be narrower, but labels must remain readable.
- Hidden terminal hosts must not be fitted. They measure as 0x0.
- Each `.terminal-host` gets `data-tab-id` so terminal-specific events can find the correct tab.

### Lifecycle behavior

#### Open first tab for a folder

1. If `state.windowsByPath` already has `folderPath`, restore that session window and focus its active tab.
2. Otherwise create a `SessionWindow`.
3. Create its first tab with numeric label `1`.
4. Add `state.windowsByPath.set(folderPath, sessionWindow)`.
5. Add `state.tabsById.set(tab.id, tab)`.
6. Render grid state so the folder shows as open.
7. Run existing Genie open animation against the session window.
8. Open xterm into the first tab's `.terminal-host`.
9. Attach `term.onData((data) => handleTerminalInput(tab, data))`.
10. Wait for stable layout using the existing delayed-fit discipline.
11. Call `api.createTerminal({ sessionId: tab.id, cwd: sessionWindow.folderPath, cols, rows })`.
12. Narration: `session-started` for the folder.

#### Click `+`

1. Create a new `Tab` in the same `SessionWindow`.
2. Assign `numericLabel = sessionWindow.nextTabNumber++`.
3. Append a new tab chip and `.terminal-host`.
4. Open xterm into the new host.
5. Activate the new tab.
6. Fit the visible host and call `api.createTerminal` with `cwd: sessionWindow.folderPath`.
7. Narration: `tab-opened`, ideally including the displayed tab label.

No window open/minimize animation runs when adding a tab.

#### Switch tabs

1. If target tab is already active, focus it and return.
2. Hide every other tab's `.terminal-host`.
3. Show the target tab's `.terminal-host`.
4. Update `sessionWindow.activeTabId`.
5. Toggle chip classes and ARIA state.
6. Wait one or two animation frames, then `fitAddon.fit()` and `api.resizeTerminal(tab.id, tab.term.cols, tab.term.rows)`.
7. Focus the target xterm if requested.

Do not call `fitAddon.fit()` on inactive/hidden tabs.

#### Close a non-last tab

1. Choose the next active tab before removing the current one. Prefer the right neighbor, else the left neighbor.
2. Call `api.closeTerminal(tab.id)`. This is idempotent if the PTY already exited.
3. Dispose the xterm.
4. Disconnect any tab-owned observer/timer if used.
5. Remove chip and terminal host DOM.
6. Remove from `sessionWindow.tabs` and `state.tabsById`.
7. Activate the chosen neighbor.
8. Narration: `tab-closed`, including the displayed tab label.

#### Close the last tab

Closing the last tab closes the entire `SessionWindow`.

Current code removes a session immediately; there is no existing close animation. For this feature, implement a `closeSessionWindow(sessionWindow, { animate: true })` helper that reuses the existing `genieOut` / `.minimizing` animation toward the folder card, but does not set `sessionWindow.minimized = true`. After animation ends, dispose and remove the window.

Close behavior:

1. Kill or close every tab PTY with `api.closeTerminal(tab.id)`.
2. Dispose all xterms.
3. Disconnect observers/timers.
4. Remove all tab ids from `state.tabsById`.
5. Remove the folder path from `state.windowsByPath`.
6. Run the close animation if requested.
7. Remove the DOM.
8. Render grid so the folder is no longer open/orange.

#### Minimize and restore

Minimize/restore operate on `SessionWindow`, not on a tab.

- Minimize: run the existing Genie minimize animation, hide the whole session window, set `sessionWindow.minimized = true`, render grid.
- Restore: unhide the whole session window, set `minimized = false`, run the existing open animation, then fit/focus only the active tab.
- PTYs for all tabs keep running while minimized.

#### PTY exits by itself

`api.onTerminalExit` must look up the tab in `state.tabsById`.

On exit:

1. `tab.ptyAlive = false`.
2. Add an exited class to the tab chip, for example `.is-exited`.
3. Write a banner into that tab's xterm.
4. Do not auto-close the tab.
5. Do not mark the whole window exited unless every tab is dead.
6. Add/update narration for the containing folder.

Remove the old `.session-subtitle` update during this refactor. Current markup no longer contains `.session-subtitle`.

### Numbering rule

Tabs auto-label as strings derived from `numericLabel`: `1`, `2`, `3`, etc.

Numbers are not reused after closing tabs. `sessionWindow.nextTabNumber` is the source of truth. A custom name overrides the numeric label but does not change the numeric counter.

### Narration

`narrationByPath` stays keyed by folder path.

New event kinds:

- `tab-opened`
- `tab-closed`

Existing event kinds still apply:

- `session-started` means the window opened and its first tab started.
- `user-task`, `agent-activity`, `plan-created`, `completed`, `error`, and `note` remain folder-level.

`handleTerminalInput` and `handleTerminalOutput` should accept a `Tab`, not a `SessionWindow`. They should write narration against `tab.sessionWindow.folderPath`. Keep `inputBuffer` on the tab so typing in multiple tabs does not mix command buffers.

### Clipboard, context menu, and drag/drop routing

All terminal-specific interactions must route to the tab under the event target:

- Replace `findSessionForElement(element)` with `findTabForElement(element)`.
- `findTabForElement` should find `element.closest('.terminal-host')`, read `data-tab-id`, and return `state.tabsById.get(tabId) || null`.
- Terminal context menu actions use `tab.term` and `tab.id`.
- Ctrl+C/Ctrl+V handling for terminal focus uses the tab under the target.
- Drag/drop into a terminal host writes paths to that tab's PTY.

Do not route these interactions through the outer `.folder-terminal`, because that no longer identifies one PTY.

### Terminal sizing

Do not weaken the existing delayed-fit sequence. Preserve the important ordering:

1. Wait for opening animation when applicable.
2. Wait for `document.fonts.ready`.
3. Wait two `requestAnimationFrame` ticks.
4. Call `fitAddon.fit()`.
5. Send `api.resizeTerminal(tab.id, tab.term.cols, tab.term.rows)`.

Recommended observer model:

- Prefer one `ResizeObserver` per `SessionWindow` observing `.terminal-pocket`.
- On resize, schedule fit for `getActiveTab(sessionWindow)` only.
- If using one observer per tab host instead, guard against hidden hosts and 0x0 measurements.

Global `window.resize` should schedule fits for active tabs only, not every tab.

### Failure handling

Handle both unsuccessful results and rejected promises from `api.createTerminal`.

If terminal creation fails for a tab:

1. Write the error into that tab's xterm.
2. Mark `tab.ptyAlive = false`.
3. Add an exited/error class to the tab chip.
4. Add a narration `error` event for the folder.
5. Keep the tab visible so the user can read the error and close it.

---

## Files expected to change during implementation

| File | Expected change |
| --- | --- |
| `renderer/app.js` | Bulk of implementation: state model, tab DOM, tab lifecycle, terminal routing, clipboard/drag-drop routing, tab-aware fit/resize, tab rename, close/minimize/restore updates. |
| `renderer/styles.css` | Tab strip/chip/add/close styles, active/inactive/exited tab states, multi-host visibility, preserve folder popup and terminal sizing. |
| `CLAUDE.md` | Update Runtime Model, Current UX, and Cautions after implementation. Replace `sessionsByPath` / `sessionsById` notes with `windowsByPath` / `tabsById`. |
| `renderer/index.html` | No expected change. Tab strip is created by JS. |
| `main.js` | No expected change. |
| `preload.js` | No expected change. |
| `package.json` / `package-lock.json` | No expected change. |

Do not reference or update `HANDOFF.md`; that file is not present in this repo.

---

## Parallel execution guidance

This feature is renderer-heavy. Parallel agents can help, but do not let two agents edit `renderer/app.js` at the same time unless their patches are strictly sequenced.

Recommended ownership:

1. Renderer agent: owns `renderer/app.js`.
2. Styles agent: owns `renderer/styles.css`, using the DOM/class contract in this plan.
3. Docs/verification agent: owns `CLAUDE.md` after implementation and runs checks.

Safe sequencing:

1. Renderer agent lands the state/DOM contract first, or at least confirms final class names.
2. Styles agent updates CSS against that contract.
3. Docs/verification agent updates `CLAUDE.md` and verifies syntax/runtime behavior.

If multiple agents are used for `renderer/app.js`, split by sequential phases, not parallel patches:

- Phase A: state rename and helper extraction.
- Phase B: tab DOM and lifecycle.
- Phase C: terminal routing, clipboard, drag/drop, narration, and fit cleanup.

---

## Implementation outline

Each step should be small enough to review and commit independently.

### Step 1 - Rename folder-level session state to window state

Scope: `renderer/app.js`

- Rename `state.sessionsByPath` to `state.windowsByPath`.
- Rename session lifecycle functions to window lifecycle names:
  - `createSession` -> `createSessionWindow`
  - `minimizeSession` -> `minimizeSessionWindow`
  - `restoreSession` -> `restoreSessionWindow`
  - `closeSession` -> `closeSessionWindow`
- Keep behavior identical at this step.
- Keep the old one-PTY object shape temporarily if needed.
- Run `node --check renderer/app.js`.

Do not introduce tabs in this step.

### Step 2 - Extract the first tab from the window object

Scope: `renderer/app.js`

- Add `state.tabsById = new Map()`.
- Convert each window to contain `tabs: [tab]` and `activeTabId`.
- Move PTY/xterm-specific fields from the window object to the tab:
  - `term`
  - `fitAddon`
  - `terminalEl`
  - `inputBuffer`
  - `ptyAlive` / `exited`
- Add `getActiveTab(sessionWindow)`.
- Update terminal data/exit routing to use `tabsById`.
- Update `handleTerminalInput` and `handleTerminalOutput` to take a tab.
- Keep one tab only and keep UI behavior identical.
- Run `node --check renderer/app.js`.

### Step 3 - Replace nubbin with a tab strip

Scope: `renderer/app.js` and `renderer/styles.css`

- Replace `.folder-terminal-nubbin` DOM with `.folder-terminal-tab-strip`.
- Render one `.folder-terminal-tab-chip` for the existing first tab.
- Render one `.folder-terminal-tab-add` button.
- Keep session controls in `.folder-terminal-tab`.
- The active chip visually matches the old nubbin style.
- Move rename behavior from `showNubbinContextMenu` / `startRename` to `showTabContextMenu` / `startTabRename`.
- With one tab, behavior should still match the previous single-session UI except the visible label is `1` instead of the folder name.
- Run `node --check renderer/app.js`.

### Step 4 - Implement `createTab`

Scope: `renderer/app.js`

- Create a new tab id.
- Assign `numericLabel = sessionWindow.nextTabNumber++`.
- Build a new tab chip.
- Build a new `.terminal-host data-tab-id="..."`.
- Create a new `Terminal` and `FitAddon`.
- Open xterm into the new host.
- Attach `term.onData((data) => handleTerminalInput(tab, data))`.
- Add to `sessionWindow.tabs` and `state.tabsById`.
- Activate the new tab.
- Fit visible layout.
- Call `api.createTerminal` with `cwd: sessionWindow.folderPath`.
- Add narration `tab-opened`.
- Handle create failure as described above.
- Run `node --check renderer/app.js`.

### Step 5 - Implement `activateTab`

Scope: `renderer/app.js` and `renderer/styles.css`

- Hide inactive `.terminal-host` elements.
- Show only the active host.
- Toggle chip active classes and `aria-selected`.
- Focus and fit the active tab.
- Update all call sites that assume `session.term` to use `getActiveTab(sessionWindow)` or a specific tab.
- Run `node --check renderer/app.js`.

### Step 6 - Implement `closeTab`

Scope: `renderer/app.js`

- If more than one tab exists, close only that tab's PTY and remove only that tab's DOM/state.
- If the closed tab was active, activate the right neighbor, else the left neighbor.
- If it is the last tab, call `closeSessionWindow(sessionWindow, { animate: true })`.
- Add narration `tab-closed` only for per-tab close, not for whole-window close of all tabs.
- Run `node --check renderer/app.js`.

### Step 7 - Update window close/minimize/restore

Scope: `renderer/app.js`

- Window close button closes all tabs.
- Closing all tabs must remove every tab id from `state.tabsById`.
- Minimize hides the whole session window and marks only the folder/window minimized.
- Restore opens the whole session window and fits only the active tab.
- Reopening an existing folder restores the existing window and focuses the active tab.
- Run `node --check renderer/app.js`.

### Step 8 - Update terminal interaction routing

Scope: `renderer/app.js`

- Replace `findSessionForElement` with `findTabForElement`.
- Update terminal copy/paste handling.
- Update terminal right-click menu.
- Update drag/drop into terminal.
- Update global resize handling to active tabs only.
- Ensure no code still routes terminal input/output by outer `.folder-terminal data-session-id`.
- Run `node --check renderer/app.js`.

### Step 9 - Update narration and terminal exit behavior

Scope: `renderer/app.js`

- `api.onTerminalData` writes to the tab xterm and calls `handleTerminalOutput(tab, data)`.
- `api.onTerminalExit` marks only that tab exited.
- Add `.is-exited` or equivalent tab-chip state.
- Remove stale `.session-subtitle` logic.
- Keep exited tabs visible until user closes them.
- Run `node --check renderer/app.js`.

### Step 10 - Update CSS polish

Scope: `renderer/styles.css`

- Style tab strip, tab chips, active chip, inactive chips, hover close buttons, add button, and exited state.
- Preserve popup size and terminal-pocket behavior.
- Ensure tab strip does not overlap session controls.
- Ensure long custom tab names ellipsize.
- Ensure text does not overflow buttons/chips.
- Ensure `.terminal-host[hidden]` or inactive hosts do not consume layout.

### Step 11 - Update `CLAUDE.md`

Scope: `CLAUDE.md`

Update only after implementation is complete:

- Runtime Model: renderer now stores `windowsByPath` and `tabsById`.
- Current UX: session windows have tabs and a `+` button.
- Cautions: hidden terminal hosts measure 0; tab switching must refit the newly active tab.
- Known limitations: tabs are in-memory only, no restart persistence.

### Step 12 - Verification

Run static checks:

```powershell
node --check main.js
node --check preload.js
node --check renderer\app.js
npm ls --depth=0
```

Manual runtime checks:

- Launch app with `npm start`.
- Open a session on folder A; one tab appears and Claude launches.
- Click `+`; second tab appears and launches Claude in folder A.
- Switch tabs; both terminals remain responsive and correctly fitted.
- Right-click tab 2; Rename changes only that tab label.
- Close tab 2; tab 1 remains and window stays open.
- Open folder B; it has its own independent session window and tab set.
- Minimize folder A window; all A tabs keep running and folder A turns orange.
- Restore folder A; previously active tab is still active and fitted.
- Close folder A window; every A PTY is closed and folder A un-oranges.
- Let a PTY exit by itself; only that tab is marked exited and remains closable.
- Drag/drop a path into a non-first tab; the path is written to that tab's terminal.
- Terminal copy/paste/context menu target the active/clicked tab.

---

## Risks to avoid

1. Do not change `main.js` or `preload.js` unless a verified blocker appears.
2. Do not fit hidden xterm hosts.
3. Do not leave closed tab ids in `state.tabsById`.
4. Do not close only the active PTY when the whole window closes.
5. Do not keep a separate window-level nubbin rename; rename is per tab.
6. Do not shadow the browser global with a local variable named `window`.
7. Do not weaken the existing delayed-fit sequence.
8. Do not remove folder-level narration; tabs add detail inside the same folder context.
9. Do not allow tab close/add button clicks to bubble into tab activation unexpectedly.
10. Do not reuse numeric tab labels after closes.

---

## Out of scope for v1

- Persisting windows/tabs across app restart.
- Dragging tabs to reorder.
- Detaching tabs into separate windows.
- Keyboard shortcuts such as Ctrl+Tab or Ctrl+W.
- File operations such as folder rename/delete/copy/move.
- Main-process tracking of window-to-tab groups.

---

## Handoff prompt for future agents

Use this prompt for the implementation session:

> Read `CLAUDE.md` and `tab-plan.md` in the repo root. Implement the tab plan, but do not change `main.js` or `preload.js` unless you find a real blocker. Keep renderer terminal routing tab-based via `.terminal-host data-tab-id`. Preserve the existing delayed xterm fit sequence. Commit after each completed implementation step.
