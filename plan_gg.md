# Panel Mode — Comprehensive Plan (plan_gg.md)

> **Self-contained doc.** An agent reading this should be able to implement the feature end-to-end without any prior conversation context. Spec, plan, project conventions, and acceptance test are all in this one file.

---

## 0. How to use this document

1. Read sections 1 (project context), 2 (spec), and 3 (file structure) first — they establish the constraints.
2. Then execute section 4 (implementation plan) task-by-task. Each task has:
   - Files touched (with line numbers)
   - Bite-sized steps (2–5 minutes each), each with the literal code
   - A verify step you must actually run (`npm start`, then a checklist)
   - A commit step
3. After all 10 tasks ship, run the acceptance test in section 5.
4. The matching design spec lives at `docs/superpowers/specs/2026-05-26-panel-mode-design.md` and the parallel plan at `docs/superpowers/plans/2026-05-26-panel-mode.md` — this doc is a superset, edit-this-one if you change anything.

**Execution rules:**
- Manual verification only — this repo has no test framework (per `CLAUDE.md` → Known Limitations). Every "verify" step ends in *click X, expect Y*.
- Commit after every task. Do not batch.
- If a step's expected outcome doesn't match, stop and investigate. Don't proceed with a broken step.
- Do not skip the data-panel-id tagging steps (Task 2 and Task 6) — the registry uses those attributes as the sole selectability mechanism.

---

## 1. Critical project context

EZvibes is an Electron 42 app at `C:\Users\Oskari\Documents\EZvibes`. It's a folder browser + launcher for Claude Code sessions, with embedded `node-pty` terminals using `@xterm/xterm`. Stack: vanilla HTML/CSS/JS, no React, no bundler, no test framework.

**Files involved in this feature:**

- `renderer/index.html` — app shell. Topbar + sidebar + content layout. Currently loads `renderer/app.js`. We add a script tag for `renderer/panel-mode.js` and sprinkle `data-panel-id` attributes on static regions.
- `renderer/app.js` — single IIFE (~1200 lines). Owns folder navigation, terminal sessions, narration sidebar, live-log drawer, etc. Private `state` object; private helper `getActiveTab(sessionWindow)`. We expose a tiny accessor (`window.ezvibesInternals`) so the new module can resolve the active EZvibes terminal tab without breaking encapsulation.
- `renderer/panel-mode.js` — new file. Single IIFE that owns the panel-mode toggle behavior, region registry, overlay, composer, and dispatch.
- `renderer/styles.css` — append-only changes for the toggle pressed state, the mode body class, the overlay, and the composer.
- `main.js` / `preload.js` — **untouched**. We reuse `api.writeTerminal(sessionId, data)` (writes raw bytes to `node-pty.pty.write`) and `api.writeClipboard(text)`. Both already exist and require no changes.
- `CLAUDE.md` — append a Panel Mode bullet under Current UX, a key-files entry, and a known-limitations entry.

**IPC + state shape (read-only context — do not change):**
- `api.writeTerminal(sessionId, data)` — preload exposes this; it forwards to the `terminal:input` IPC, which writes the raw string directly to the PTY (`main.js:912-917`, no sanitization, multi-line safe).
- `api.writeClipboard(text)` — preload exposes this; OS clipboard write.
- `state.windowsByPath` (`renderer/app.js:9`) — `Map<folderPath, SessionWindow>`. One window per folder; the folder path is the launch path captured at session creation. Path encoding is whatever the OS reports; the accessor normalizes to forward-slash + lowercase to be robust against case/separator drift.
- `getActiveTab(sessionWindow)` (`renderer/app.js:1163-1168`) — returns the active `Tab` (or the first tab if `activeTabId` is unset). A `Tab` has `id` (which is the IPC `sessionId`), `ptyAlive` (true while the PTY is running), `agent` (`'claude'` | `'codex'`), and tab metadata.
- Highest z-index in the existing CSS is `2000` (`.new-tab-menu`). The panel-mode overlay sits at 5000 and composer at 5001.

**Conventions to respect:**
- `aria-pressed` is the standard for toggle buttons in this app (see `#narration-toggle` and `#live-log-toggle`). Use the same pattern for `#panel-mode-toggle`.
- Inline event handlers are not used — everything goes through `addEventListener` in `bindEvents()` or in the new module.
- The terminal sizing flow in `renderer/app.js` is fragile (see CLAUDE.md → "Terminal Fit Fix"). Do not touch `.terminal-host` or `fitAddon.fit()` paths. Adding a `data-panel-id` to `.terminal-pocket` is fine (the pocket is the visual frame, not the xterm host).
- Bracketed paste markers `\x1b[200~` / `\x1b[201~` tell Claude's terminal to treat the wrapped text as a single paste rather than keystrokes. Always wrap when injecting multi-line payloads into the PTY.

---

## 2. Design / Spec

### Goal
Add a `◫` toggle in the topbar that puts EZvibes into "panel mode". Hover any major UI region to see a highlight rectangle with a friendly-name chip. Click to open a small composer next to the region; type a request; hit Send. The renderer builds a structured payload (region name + selector + `file:line` + the user's text), wraps it in bracketed-paste markers, and writes it into the active live terminal tab for the EZvibes folder. If no live terminal tab exists, the unwrapped payload lands on the system clipboard and a small toast surfaces inside the composer.

The point is to remove "which bar do you mean?" round-trips — the user can point at a thing instead of describing where it is.

### User flow
1. Click `◫` in the topbar → cursor becomes crosshair, content area dims slightly, button highlights.
2. Hover any major region → blue border + name chip (`Top bar`, `Folder card`, `Session window tab strip`, etc.).
3. Click a region → composer opens next to it with read-only header (name, selector, `file:line`, description) and a focused textarea.
4. Type a request → click Send (or Ctrl+Enter).
5. If the EZvibes folder has a running active terminal tab: payload is auto-pasted into that terminal as one bracketed-paste chunk, composer closes, mode exits.
6. If not: payload is copied to clipboard, an inline toast says so, composer stays open so the user can edit / re-send / cancel.
7. Escape closes the composer (mode stays on) or exits the mode (when no composer is open). A second click of the toggle exits the mode at any time.

### Architecture
- Pure renderer feature. No `main.js` / `preload.js` / IPC additions.
- One new file (`renderer/panel-mode.js`) owns overlay + composer + dispatch.
- Selectability is governed by a curated registry (a `Map<panelId, metadata>`). Static regions are tagged with `data-panel-id` directly in `index.html`. Dynamic regions (folder cards, session windows, tab chips, etc.) are tagged in their `app.js` builders. `findRegion(target)` walks up the DOM from `document.elementFromPoint(x,y)`'s result, returning the closest ancestor whose `data-panel-id` matches an entry in the registry.
- `app.js` exposes a tiny accessor (`window.ezvibesInternals`) so `panel-mode.js` can resolve the active EZvibes terminal tab without reaching into private IIFE state.
- All document-level listeners (`mousemove`, `click`, `keydown`, `contextmenu`) are installed on mode-on and removed on mode-off, all in capture phase so panel mode wins against existing handlers (folder card clicks, the global context-menu dismissal handler at `app.js:103-105`, etc.).

### Out of scope (intentional)
- Persisting panel-mode history across launches.
- Batch / multi-region selection in one composer.
- Screenshot capture.
- Editing region metadata from inside the UI (registry is curated in source).
- Auto-detecting the EZvibes folder path (hard-coded constant; documented limitation).
- Selecting arbitrary deep DOM nodes (`<span>`, `<svg>`, xterm internal canvases). Only registered regions are selectable.
- Selecting transient popups / menus (`#context-menu`, `.new-tab-menu`). Panel mode targets persistent app regions only.

### Payload format (verbatim)
```
[EZvibes panel-mode request]
Target: <friendlyName>
Selector: [data-panel-id="<id>"]
Defined: <file>:<line>
Description: <one-line description>

Request:
<user's textarea text, trimmed>
```

Wrapped on dispatch into the PTY (only) as:
```
\x1b[200~<payload>\x1b[201~\n
```

Trailing `\n` after `\x1b[201~` submits the paste so the active terminal app receives it as a single message/paste. Clipboard copy uses the unwrapped form (clipboard recipients don't want bracketed-paste markers).

### Dispatch resolution chain
1. Read `EZVIBES_FOLDER` constant.
2. `window.ezvibesInternals.getSessionWindowByPath(EZVIBES_FOLDER)` → `SessionWindow | null`. (The accessor case- and slash-insensitively scans `state.windowsByPath`.)
3. If a window exists: `window.ezvibesInternals.getActiveTab(sessionWindow)` → `Tab | null`.
4. If a tab exists AND `tab.ptyAlive`: call `api.writeTerminal(tab.id, wrappedPayload)`. Done.
5. Otherwise: `await api.writeClipboard(unwrappedPayload)` and show toast in composer.

---

## 3. File structure

**Modify:**
- `renderer/index.html` — add toggle button (Task 1); add script tag (Task 1); sprinkle `data-panel-id` on ~20 static regions (Task 2).
- `renderer/app.js` — cache toggle element + wire click handler (Task 1); add `data-panel-id` to dynamic builders (Task 6); expose `window.ezvibesInternals` (Task 9).
- `renderer/styles.css` — append toggle pressed-state + mode body class (Task 3); append overlay (Task 5); append composer (Task 7).
- `CLAUDE.md` — append three entries (Task 10).

**Create:**
- `renderer/panel-mode.js` — single IIFE (~300 lines) created incrementally:
  - Task 1: skeleton (`setActive`, `isActive` stubs).
  - Task 3: body-class toggle.
  - Task 4: registry + `findRegion`.
  - Task 5: overlay (`ensureHighlight`, `paintHighlight`, `onMouseMove`).
  - Task 7: composer (`ensureComposer`, `positionComposer`, `openComposer`, `closeComposer`, `onClickCapture`).
  - Task 8: lifecycle (`onKeydown`, `onContextMenu`, listener teardown).
  - Task 9: dispatch (`buildPayload`, `showToast`, `dispatchPayload`, `onSend`, `EZVIBES_FOLDER` constant).

Each task below produces a self-contained, commit-able increment.

---

## 4. Implementation plan

### Task 1: Scaffold toggle button + empty panel-mode module

**Files:**
- Modify: `renderer/index.html` (insert button before line 28; insert script tag after line 77)
- Modify: `renderer/app.js` (cache element in `els = {}` block around lines 24–46; wire handler in `bindEvents()` near line 92)
- Create: `renderer/panel-mode.js`

- [ ] **Step 1: Add the toggle button to the topbar**

In `renderer/index.html`, between `#narration-toggle` (line 27) and `#live-log-toggle` (line 28), insert one new line so the topbar becomes:

```html
        <button id="narration-toggle" class="icon-button narration-toggle" title="What Was Made" aria-pressed="false">▤</button>
        <button id="panel-mode-toggle" class="icon-button panel-mode-toggle" title="Panel Mode" aria-pressed="false" data-panel-id="panel-mode-toggle">◫</button>
        <button id="live-log-toggle" class="icon-button live-log-toggle" title="Live Log" aria-pressed="false">LOG</button>
```

The `data-panel-id` on the toggle makes the toggle itself selectable later — handy for "I want this button moved" requests.

- [ ] **Step 2: Add the script tag to load `panel-mode.js`**

In `renderer/index.html`, after the existing `<script src="./app.js"></script>` (line 77), add:

```html
    <script src="./panel-mode.js"></script>
```

- [ ] **Step 3: Create `renderer/panel-mode.js` with a stub module**

Full file contents:

```js
(function () {
  let active = false;

  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    console.log('[panel-mode] active =', active);
  }

  function isActive() {
    return active;
  }

  window.ezvibesPanelMode = { setActive, isActive };
})();
```

- [ ] **Step 4: Cache the toggle element and wire the click handler in `renderer/app.js`**

In the `els = {}` cache block (the run of `els.X = document.getElementById('X')` lines starting at line 24), add this line near the other toggle caches (right after `els.narrationToggle` on line 37):

```js
    els.panelModeToggle = document.getElementById('panel-mode-toggle');
```

Then in `bindEvents()` (around line 92, right after the `els.liveLogToggle` listener), add:

```js
    els.panelModeToggle.addEventListener('click', () => {
      const panel = window.ezvibesPanelMode;
      if (!panel) return;
      const next = !panel.isActive();
      panel.setActive(next);
      els.panelModeToggle.setAttribute('aria-pressed', next ? 'true' : 'false');
    });
```

- [ ] **Step 5: Verify the wiring**

Run from `C:\Users\Oskari\Documents\EZvibes`:

```
npm start
```

Expected:
- A new `◫` button appears in the topbar between `▤` and `LOG`.
- Click it once → DevTools console (Ctrl+Shift+I) logs `[panel-mode] active = true`, the button's `aria-pressed` becomes `"true"`.
- Click again → logs `[panel-mode] active = false`, `aria-pressed="false"`.

- [ ] **Step 6: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/index.html renderer/app.js renderer/panel-mode.js
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): add toggle button and module skeleton

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tag static regions with `data-panel-id` in `index.html`

**Files:**
- Modify: `renderer/index.html` (lines 16, 17, 18, 19, 20, 21, 23, 25, 27, 32, 33, 37, 40, 41, 42, 43, 45, 48, 59 — the existing line 28 already got its `data-panel-id` in Task 1)

- [ ] **Step 1: Add `data-panel-id` to each static region**

Edit `renderer/index.html` so the attributes appear on these existing elements (do not reorder lines; only add the attribute):

| Existing element | Add attribute |
|---|---|
| `<header class="topbar">` (line 16) | `data-panel-id="topbar"` |
| `<div class="window-title">` (line 17) | `data-panel-id="window-title"` |
| `<div class="nav-buttons">` (line 18) | `data-panel-id="nav-buttons-group"` |
| `<button id="back-btn" …>` (line 19) | `data-panel-id="back-btn"` |
| `<button id="up-btn" …>` (line 20) | `data-panel-id="up-btn"` |
| `<button id="refresh-btn" …>` (line 21) | `data-panel-id="refresh-btn"` |
| `<div id="path-bar" …>` (line 23) | `data-panel-id="path-bar"` |
| `<input id="search-input" …>` (line 25) | `data-panel-id="search-input"` |
| `<button id="narration-toggle" …>` (line 27) | `data-panel-id="narration-toggle"` |
| `<button id="live-log-toggle" …>` (line 29 after Task 1) | `data-panel-id="live-log-toggle"` |
| `<aside class="sidebar">` (line 32) | `data-panel-id="sidebar"` |
| `<button id="active-sessions-btn" …>` (line 33) | `data-panel-id="active-sessions-btn"` |
| `<div id="quick-paths">` (line 37) | `data-panel-id="quick-paths-list"` |
| `<section class="content">` (line 40) | `data-panel-id="content"` |
| `<div class="command-bar">` (line 41) | `data-panel-id="command-bar"` |
| `<button id="new-session-btn" …>` (line 42) | `data-panel-id="new-session-btn"` |
| `<div id="folder-count" …>` (line 43) | `data-panel-id="folder-count"` |
| `<div id="grid" …>` (line 45) | `data-panel-id="folder-grid"` |
| `<aside id="narration-sidebar" …>` (line 48) | `data-panel-id="narration-sidebar"` |
| `<aside id="live-log-panel" …>` (line 59) | `data-panel-id="live-log-panel"` |

Example: line 23 changes from:

```html
<div id="path-bar" class="path-bar"></div>
```

to:

```html
<div id="path-bar" class="path-bar" data-panel-id="path-bar"></div>
```

- [ ] **Step 2: Verify the DOM is tagged**

`npm start`, open DevTools (Ctrl+Shift+I), run in the Console:

```js
document.querySelectorAll('[data-panel-id]').length
```

Expected: `21` (20 static regions from this task + the toggle button from Task 1).

Then run:

```js
[...document.querySelectorAll('[data-panel-id]')].map(e => e.dataset.panelId).sort()
```

Expected output (sorted): an array containing all 21 ids: `["active-sessions-btn","back-btn","command-bar","content","folder-count","folder-grid","live-log-panel","live-log-toggle","narration-sidebar","narration-toggle","nav-buttons-group","new-session-btn","panel-mode-toggle","path-bar","quick-paths-list","refresh-btn","search-input","sidebar","topbar","up-btn","window-title"]`.

- [ ] **Step 3: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/index.html
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): tag static regions with data-panel-id

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Mode CSS — body class, cursor, dim, toggle pressed state

**Files:**
- Modify: `renderer/styles.css` (append at end of file)
- Modify: `renderer/panel-mode.js`

- [ ] **Step 1: Update `setActive` to toggle the body class**

Replace the body of `setActive` in `renderer/panel-mode.js` with:

```js
  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    document.body.classList.toggle('panel-mode-active', active);
    console.log('[panel-mode] active =', active);
  }
```

- [ ] **Step 2: Append the mode CSS to `renderer/styles.css`**

At the end of `renderer/styles.css`, append:

```css
/* Panel Mode */
.panel-mode-toggle[aria-pressed="true"] {
  background: var(--panel-2);
  border-color: var(--accent);
  color: var(--accent);
}

body.panel-mode-active {
  cursor: crosshair;
}

body.panel-mode-active main.shell {
  filter: brightness(0.85);
  transition: filter 120ms ease;
}

body.panel-mode-active main.shell,
body.panel-mode-active main.shell * {
  cursor: crosshair !important;
}
```

- [ ] **Step 3: Verify**

`npm start`, click the `◫` toggle.

Expected:
- Toggle button border + text turn accent-blue, background darkens (matches the pressed `▤` look).
- Cursor over the main content becomes a crosshair.
- Main content area dims slightly (brightness 0.85).
- Click again → all three revert.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/panel-mode.js renderer/styles.css
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): mode body class, cursor, dim, toggle pressed state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Region registry + `findRegion()`

**Files:**
- Modify: `renderer/panel-mode.js`

- [ ] **Step 1: Define `PANEL_REGIONS` as a Map**

In `renderer/panel-mode.js`, replace the entire file with the version below (registry + `findRegion` added; module shape unchanged):

```js
(function () {
  const PANEL_REGIONS = new Map([
    // Static regions (tagged in renderer/index.html)
    ['topbar',                { name: 'Top bar',                       file: 'renderer/index.html', line: '16-29', describe: 'Header strip: brand label, nav buttons, path bar, search input, narration / panel-mode / log toggles.' }],
    ['window-title',          { name: 'Window title',                  file: 'renderer/index.html', line: '17',    describe: 'The "EZvibes" brand label at top-left of the header.' }],
    ['nav-buttons-group',     { name: 'Nav buttons group',             file: 'renderer/index.html', line: '18-22', describe: 'Container for the back / up / refresh icon buttons.' }],
    ['back-btn',              { name: 'Back button',                   file: 'renderer/index.html', line: '19',    describe: 'The ‹ button — navigates back in folder history.' }],
    ['up-btn',                { name: 'Up button',                     file: 'renderer/index.html', line: '20',    describe: 'The ↑ button — navigates to the parent folder.' }],
    ['refresh-btn',           { name: 'Refresh button',                file: 'renderer/index.html', line: '21',    describe: 'The ↻ button — re-reads the current folder.' }],
    ['path-bar',              { name: 'Path bar',                      file: 'renderer/index.html', line: '23',    describe: 'Displays the current folder path.' }],
    ['search-input',          { name: 'Search input',                  file: 'renderer/index.html', line: '25',    describe: 'Search box that filters visible folder/file entries.' }],
    ['narration-toggle',      { name: 'Narration toggle',              file: 'renderer/index.html', line: '27',    describe: 'The ▤ button — opens the "What Was Made" sidebar.' }],
    ['panel-mode-toggle',     { name: 'Panel-mode toggle',             file: 'renderer/index.html', line: '28',    describe: 'The ◫ button — toggles panel mode (this feature).' }],
    ['live-log-toggle',       { name: 'Live-log toggle',               file: 'renderer/index.html', line: '29',    describe: 'The LOG button — opens the live diagnostics drawer.' }],
    ['sidebar',               { name: 'Sidebar',                       file: 'renderer/index.html', line: '32-38', describe: 'Left rail: ACTIVE SESSIONS link plus the Places quick-paths.' }],
    ['active-sessions-btn',   { name: 'Active sessions link',          file: 'renderer/index.html', line: '33-35', describe: 'The green "ACTIVE SESSIONS" link at the top of the sidebar.' }],
    ['quick-paths-list',      { name: 'Places list',                   file: 'renderer/index.html', line: '37',    describe: 'Dynamic quick-paths under "Places" (Home, Desktop, Documents, …).' }],
    ['content',               { name: 'Content area',                  file: 'renderer/index.html', line: '40-46', describe: 'Center pane containing the command bar and the folder grid.' }],
    ['command-bar',           { name: 'Command bar',                   file: 'renderer/index.html', line: '41-44', describe: 'Strip above the folder grid: Launch Claude Here button + item count.' }],
    ['new-session-btn',       { name: 'Launch Claude Here button',     file: 'renderer/index.html', line: '42',    describe: 'Button that starts a Claude session in the current folder.' }],
    ['folder-count',          { name: 'Folder count',                  file: 'renderer/index.html', line: '43',    describe: 'Text showing the number of items in the current folder.' }],
    ['folder-grid',           { name: 'Folder grid',                   file: 'renderer/index.html', line: '45',    describe: 'Grid of folder/file cards in the current directory.' }],
    ['narration-sidebar',     { name: 'Narration sidebar',             file: 'renderer/index.html', line: '48-57', describe: 'Right-side "What Was Made" panel — visible when narration toggle is on.' }],
    ['live-log-panel',        { name: 'Live-log drawer',               file: 'renderer/index.html', line: '59-68', describe: 'Fixed drawer that shows recent diagnostic events; opened by the LOG button.' }],

    // Dynamic regions (will be tagged in Task 6)
    ['folder-card',                       { name: 'Folder card',                  file: 'renderer/app.js', line: '~595',  describe: 'A single folder/file card in the grid — built per entry by renderGrid().' }],
    ['session-window',                    { name: 'Session window',               file: 'renderer/app.js', line: '~1184', describe: 'The yellow folder-shaped popup hosting a Claude/Codex terminal.' }],
    ['session-window-tab-strip',         { name: 'Session window tab strip',     file: 'renderer/app.js', line: '~1187', describe: 'Chrome-style strip overhanging the top edge — tab chips + the + button.' }],
    ['session-window-header',            { name: 'Session window header',        file: 'renderer/app.js', line: '~1188', describe: 'Yellow strip flush with the top of the popup — folder-name label + minimize/close controls.' }],
    ['session-window-tab-chip',          { name: 'Session tab chip',             file: 'renderer/app.js', line: '~1288', describe: 'One tab in a session window (CLAUDE, CODEX, custom name).' }],
    ['session-window-add-tab',           { name: 'Session "new tab" button',     file: 'renderer/app.js', line: '~1206', describe: 'The + button at the right end of the tab strip — left-click adds Claude, right-click adds Codex.' }],
    ['session-window-folder-name-label', { name: 'Session window folder label',  file: 'renderer/app.js', line: '~1189', describe: 'The small folder-name chip on the yellow header strip.' }],
    ['session-window-controls',          { name: 'Session window controls',      file: 'renderer/app.js', line: '~1190', describe: 'The minimize/close buttons on the session window header.' }],
    ['terminal-pocket',                  { name: 'Terminal pocket',              file: 'renderer/app.js', line: '~1196', describe: 'The dark frame inside a session window that surrounds the xterm terminal.' }],
  ]);

  function findRegion(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const el = target.closest('[data-panel-id]');
    if (!el) return null;
    const id = el.dataset.panelId;
    const meta = PANEL_REGIONS.get(id);
    if (!meta) return null;
    return { id, element: el, meta };
  }

  let active = false;

  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    document.body.classList.toggle('panel-mode-active', active);
    console.log('[panel-mode] active =', active);
  }

  function isActive() {
    return active;
  }

  window.ezvibesPanelMode = { setActive, isActive, _test: { findRegion, PANEL_REGIONS } };
})();
```

- [ ] **Step 2: Verify `findRegion` against tagged static elements**

`npm start`, open DevTools console:

```js
window.ezvibesPanelMode._test.findRegion(document.querySelector('#path-bar'))
```

Expected: object `{ id: 'path-bar', element: <the path bar div>, meta: { name: 'Path bar', file: 'renderer/index.html', line: '23', describe: '…' } }`.

Walk-up test (use a nested icon inside the topbar):

```js
window.ezvibesPanelMode._test.findRegion(document.querySelector('#back-btn'))
```

Expected: `{ id: 'back-btn', … }` (closest data-panel-id is the button itself, not its `.topbar` ancestor).

Registry size:

```js
window.ezvibesPanelMode._test.PANEL_REGIONS.size
```

Expected: `30`.

- [ ] **Step 3: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/panel-mode.js
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): region registry and findRegion()

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Hover highlight overlay

**Files:**
- Modify: `renderer/panel-mode.js`
- Modify: `renderer/styles.css`

- [ ] **Step 1: Append overlay styles**

Append to `renderer/styles.css`:

```css
#panel-mode-highlight {
  position: fixed;
  pointer-events: none;
  border: 2px solid var(--accent);
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 4px 18px rgba(85, 182, 255, 0.25);
  z-index: 5000;
  transition: top 60ms ease, left 60ms ease, width 60ms ease, height 60ms ease, opacity 80ms ease;
  opacity: 0;
}

#panel-mode-highlight.visible {
  opacity: 1;
}

#panel-mode-highlight .panel-mode-chip {
  position: absolute;
  top: -22px;
  left: -2px;
  background: var(--accent);
  color: #0a0d0c;
  font: 11px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 2px 6px;
  border-radius: 3px 3px 0 0;
  white-space: nowrap;
  max-width: 80vw;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 2: Add overlay management and the mousemove listener to `panel-mode.js`**

In `renderer/panel-mode.js`, add the following functions inside the IIFE (just below `findRegion`):

```js
  let highlightEl = null;
  let chipEl = null;
  let currentRegion = null;

  function ensureHighlight() {
    if (highlightEl) return highlightEl;
    highlightEl = document.createElement('div');
    highlightEl.id = 'panel-mode-highlight';
    chipEl = document.createElement('span');
    chipEl.className = 'panel-mode-chip';
    highlightEl.appendChild(chipEl);
    document.body.appendChild(highlightEl);
    return highlightEl;
  }

  function paintHighlight(region) {
    ensureHighlight();
    if (!region) {
      highlightEl.classList.remove('visible');
      currentRegion = null;
      return;
    }
    const rect = region.element.getBoundingClientRect();
    highlightEl.style.top = `${rect.top}px`;
    highlightEl.style.left = `${rect.left}px`;
    highlightEl.style.width = `${rect.width}px`;
    highlightEl.style.height = `${rect.height}px`;
    chipEl.textContent = region.meta.name;
    highlightEl.classList.add('visible');
    currentRegion = region;
  }

  function onMouseMove(event) {
    if (!active) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const region = findRegion(el);
    if (!region) {
      paintHighlight(null);
      return;
    }
    if (currentRegion && currentRegion.element === region.element) return;
    paintHighlight(region);
  }
```

Then update `setActive` to install / remove the listener:

```js
  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    document.body.classList.toggle('panel-mode-active', active);
    if (active) {
      document.addEventListener('mousemove', onMouseMove, { capture: true });
    } else {
      document.removeEventListener('mousemove', onMouseMove, { capture: true });
      paintHighlight(null);
    }
    console.log('[panel-mode] active =', active);
  }
```

- [ ] **Step 3: Verify hover highlight on static regions**

`npm start`, click the `◫` toggle.

Expected when hovering each region (try at least 5):
- A 2px accent-blue border traces the region.
- A chip in the top-left of the border shows the friendly name (`Top bar`, `Sidebar`, `Path bar`, `Search input`, `Folder grid`, `Launch Claude Here button`, `Active sessions link`, etc.).
- Highlight smoothly retargets when moving between regions.
- Hovering an empty area (e.g. dead space between cards in the grid is still the grid → it should highlight `Folder grid`; outside the app frame entirely → no highlight).
- Click `◫` again → highlight disappears.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/panel-mode.js renderer/styles.css
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): hover highlight overlay

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Tag dynamic regions with `data-panel-id` in `app.js` builders

**Files:**
- Modify: `renderer/app.js` (folder card builder ~line 595; session window builder ~line 1184–1196; tab chip builder ~line 1288; add-tab button ~line 1206)

For each builder, read 30 lines of context around the cited line to find the element creation, then add the attribute. Set the attribute via `setAttribute('data-panel-id', '…')` (or include in the `innerHTML` string if the element is built that way). Use existing variable names — do not invent new ones.

- [ ] **Step 1: Tag the folder card**

Locate the folder-card construction in `renderer/app.js` (around line 595 — look for `.folder-card` className being assigned, likely `card.className = 'folder-card …'` or similar). On the same element, after the className is set, add:

```js
    card.setAttribute('data-panel-id', 'folder-card');
```

- [ ] **Step 2: Tag the session window and its sub-parts**

Locate `createSessionWindow` (or similar function around line 1184 — the `.folder-terminal` root). After the root element is created, add:

```js
    windowEl.setAttribute('data-panel-id', 'session-window');
```

(This matches the current builder: the root DOM node is `windowEl`, and the returned session object stores it later as `sessionWindow.windowEl`.)

For the tab strip (`.folder-terminal-tab-strip`, around line 1187), add:

```js
    tabStripEl.setAttribute('data-panel-id', 'session-window-tab-strip');
```

For the header bar (`.folder-terminal-tab`, around line 1188):

```js
    windowEl.querySelector('.folder-terminal-tab').setAttribute('data-panel-id', 'session-window-header');
```

For the folder-name-label (`.folder-name-label`, around line 1189):

```js
    folderNameLabel.setAttribute('data-panel-id', 'session-window-folder-name-label');
```

For the session-controls container (`.session-controls`, around line 1190):

```js
    windowEl.querySelector('.session-controls').setAttribute('data-panel-id', 'session-window-controls');
```

For the add-tab button (`.folder-terminal-tab-add`, around line 1206):

```js
    addTabBtnEl.setAttribute('data-panel-id', 'session-window-add-tab');
```

For the terminal pocket (`.terminal-pocket`, around line 1196):

```js
    terminalPocketEl.setAttribute('data-panel-id', 'terminal-pocket');
```

If the elements are built via `innerHTML` string, append the attribute inside the string instead. The exact variable names depend on the existing code — read context first.

- [ ] **Step 3: Tag the tab chip**

Locate the tab-chip builder (around line 1288 — look for `.folder-terminal-tab-chip` className assignment). On the chip element, add:

```js
    chip.setAttribute('data-panel-id', 'session-window-tab-chip');
```

- [ ] **Step 4: Verify dynamic regions highlight in panel mode**

`npm start`, then:
1. Click `◫` to enter panel mode.
2. Hover a folder card → chip reads `Folder card`.
3. Click `◫` again to exit panel mode (so the click won't be intercepted next).
4. Click `Launch Claude Here` → session window appears with a Claude tab.
5. Click `◫` to re-enter panel mode.
6. Hover the session window → chip reads `Session window`.
7. Hover the tab strip (top overhang) → chip reads `Session window tab strip`.
8. Hover the CLAUDE chip on the strip → chip reads `Session tab chip`.
9. Hover the `+` button → chip reads `Session "new tab" button`.
10. Hover the dark terminal frame → chip reads `Terminal pocket`.
11. Hover the small folder-name chip on the yellow strip → chip reads `Session window folder label`.
12. Hover the minimize/close cluster on the yellow strip → chip reads `Session window controls`.

- [ ] **Step 5: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/app.js
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): tag dynamic regions in app.js builders

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Click-to-select + composer DOM

**Files:**
- Modify: `renderer/panel-mode.js`
- Modify: `renderer/styles.css`

- [ ] **Step 1: Append composer styles**

Append to `renderer/styles.css`:

```css
#panel-mode-composer {
  position: fixed;
  z-index: 5001;
  width: 360px;
  max-width: calc(100vw - 24px);
  background: #202423;
  color: var(--ink);
  border: 1px solid #3c4542;
  border-radius: 6px;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.55);
  padding: 12px 12px 10px 12px;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#panel-mode-composer[hidden] { display: none; }

#panel-mode-composer .panel-mode-composer-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

#panel-mode-composer .panel-mode-composer-name {
  color: var(--accent);
  font-size: 13px;
}

#panel-mode-composer .panel-mode-composer-selector,
#panel-mode-composer .panel-mode-composer-file {
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #9ba6a3;
}

#panel-mode-composer .panel-mode-composer-describe {
  color: #c3ccc9;
  margin: 4px 0 0 0;
  font-size: 12px;
}

#panel-mode-composer textarea {
  resize: vertical;
  min-height: 70px;
  max-height: 220px;
  background: #161a19;
  color: var(--ink);
  border: 1px solid #2c3331;
  border-radius: 4px;
  padding: 8px;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  outline: none;
}

#panel-mode-composer textarea:focus {
  border-color: var(--accent);
}

#panel-mode-composer .panel-mode-composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

#panel-mode-composer .panel-mode-composer-actions button {
  background: #2c3331;
  color: var(--ink);
  border: 1px solid #3c4542;
  border-radius: 4px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 12px;
}

#panel-mode-composer .panel-mode-composer-actions button.primary {
  background: var(--accent);
  color: #0a0d0c;
  border-color: var(--accent);
}

#panel-mode-composer .panel-mode-composer-toast {
  background: #2c3331;
  color: var(--ink);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 11px;
}
```

- [ ] **Step 2: Add composer creation, opening, and clicking-to-select to `panel-mode.js`**

Inside the IIFE, below `paintHighlight`, add:

```js
  let composerEl = null;
  let composerTextarea = null;
  let composerToast = null;
  let composerCancelBtn = null;
  let composerSendBtn = null;
  let frozenRegion = null;

  function ensureComposer() {
    if (composerEl) return composerEl;
    composerEl = document.createElement('div');
    composerEl.id = 'panel-mode-composer';
    composerEl.hidden = true;
    composerEl.innerHTML = `
      <div class="panel-mode-composer-header">
        <span class="panel-mode-composer-name"></span>
        <code class="panel-mode-composer-selector"></code>
        <span class="panel-mode-composer-file"></span>
        <p class="panel-mode-composer-describe"></p>
      </div>
      <textarea class="panel-mode-composer-input" placeholder="Describe the change…"></textarea>
      <div class="panel-mode-composer-toast" hidden></div>
      <div class="panel-mode-composer-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" data-action="send" class="primary">Send</button>
      </div>
    `;
    document.body.appendChild(composerEl);
    composerTextarea = composerEl.querySelector('textarea');
    composerToast = composerEl.querySelector('.panel-mode-composer-toast');
    composerCancelBtn = composerEl.querySelector('[data-action="cancel"]');
    composerSendBtn = composerEl.querySelector('[data-action="send"]');
    composerCancelBtn.addEventListener('click', closeComposer);
    return composerEl;
  }

  function positionComposer(anchorRect) {
    ensureComposer();
    const margin = 12;
    const cw = composerEl.offsetWidth;
    const ch = composerEl.offsetHeight;
    let left = anchorRect.right + 8;
    if (left + cw + margin > window.innerWidth) {
      left = Math.max(margin, anchorRect.left - cw - 8);
    }
    if (left < margin) left = margin;
    let top = anchorRect.top;
    if (top + ch + margin > window.innerHeight) {
      top = Math.max(margin, window.innerHeight - ch - margin);
    }
    composerEl.style.left = `${left}px`;
    composerEl.style.top = `${top}px`;
  }

  function openComposer(region) {
    ensureComposer();
    frozenRegion = region;
    paintHighlight(region);
    composerEl.querySelector('.panel-mode-composer-name').textContent = region.meta.name;
    composerEl.querySelector('.panel-mode-composer-selector').textContent =
      `[data-panel-id="${region.id}"]`;
    composerEl.querySelector('.panel-mode-composer-file').textContent =
      `${region.meta.file}:${region.meta.line}`;
    composerEl.querySelector('.panel-mode-composer-describe').textContent = region.meta.describe;
    composerTextarea.value = '';
    composerToast.hidden = true;
    composerEl.hidden = false;
    positionComposer(region.element.getBoundingClientRect());
    composerTextarea.focus();
  }

  function closeComposer() {
    if (!composerEl) return;
    composerEl.hidden = true;
    frozenRegion = null;
    paintHighlight(null);
  }

  function onClickCapture(event) {
    if (!active) return;
    if (event.target.closest('#panel-mode-toggle')) return;
    if (event.target.closest('#panel-mode-composer')) return;
    // While panel mode is on, swallow ALL clicks outside the toggle/composer
    // so the underlying app (folder nav, etc.) does not react.
    event.preventDefault();
    event.stopPropagation();
    if (frozenRegion) return; // composer already open — don't re-open on stray clicks
    const region = findRegion(event.target);
    if (!region) return;
    openComposer(region);
  }
```

Then update the existing `onMouseMove` guard so the selected region stays frozen while the composer is open:

```js
  function onMouseMove(event) {
    if (!active || frozenRegion) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const region = findRegion(el);
    if (!region) {
      paintHighlight(null);
      return;
    }
    if (currentRegion && currentRegion.element === region.element) return;
    paintHighlight(region);
  }
```

Then update `setActive` to install / tear down the click listener and to close the composer on exit:

```js
  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    document.body.classList.toggle('panel-mode-active', active);
    if (active) {
      document.addEventListener('mousemove', onMouseMove, { capture: true });
      document.addEventListener('click', onClickCapture, { capture: true });
    } else {
      document.removeEventListener('mousemove', onMouseMove, { capture: true });
      document.removeEventListener('click', onClickCapture, { capture: true });
      closeComposer();
      paintHighlight(null);
    }
    console.log('[panel-mode] active =', active);
  }
```

- [ ] **Step 3: Verify click + composer**

`npm start`, click `◫`.

Expected:
- Hover and click the topbar → composer appears next to the topbar with header `Top bar`, selector `[data-panel-id="topbar"]`, file `renderer/index.html:16-29`, description text, an empty textarea (focused), and Cancel / Send buttons.
- The click does NOT trigger the topbar's normal behavior (no nav action fires, no folder opens when clicking a card).
- Clicking another card while composer is open does nothing (composer and highlight stay anchored to the selected region; no underlying handler fires).
- Click `Cancel` → composer disappears, highlight clears, panel mode stays active, hover targeting resumes.
- Click `◫` while composer is open → composer disappears, panel mode exits.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/panel-mode.js renderer/styles.css
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): click-to-select and composer UI

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Escape / context-menu lifecycle

**Files:**
- Modify: `renderer/panel-mode.js`

- [ ] **Step 1: Add Escape and contextmenu handlers**

In `renderer/panel-mode.js`, below `onClickCapture`, add:

```js
  function onKeydown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      if (frozenRegion) {
        closeComposer();
      } else {
        setActive(false);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  function onContextMenu(event) {
    if (!active) return;
    if (event.target.closest('#panel-mode-composer')) return;
    event.preventDefault();
    event.stopPropagation();
    paintHighlight(null);
  }
```

Update `setActive` to install / tear down them too:

```js
  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    document.body.classList.toggle('panel-mode-active', active);
    if (active) {
      document.addEventListener('mousemove', onMouseMove, { capture: true });
      document.addEventListener('click', onClickCapture, { capture: true });
      document.addEventListener('keydown', onKeydown, { capture: true });
      document.addEventListener('contextmenu', onContextMenu, { capture: true });
    } else {
      document.removeEventListener('mousemove', onMouseMove, { capture: true });
      document.removeEventListener('click', onClickCapture, { capture: true });
      document.removeEventListener('keydown', onKeydown, { capture: true });
      document.removeEventListener('contextmenu', onContextMenu, { capture: true });
      closeComposer();
      paintHighlight(null);
      const toggle = document.getElementById('panel-mode-toggle');
      if (toggle) toggle.setAttribute('aria-pressed', 'false');
    }
    console.log('[panel-mode] active =', active);
  }
```

(The `aria-pressed` reset covers the case where panel mode is exited via Escape, not the toggle click — so the button state stays in sync.)

- [ ] **Step 2: Verify exit paths**

`npm start`, then for each of the following, start from panel mode ON:

1. Press `Escape` (no composer) → panel mode exits, `◫` aria-pressed goes false.
2. Re-enter panel mode, hover a card, click → composer opens. Press `Escape` → composer closes, highlight clears, panel mode still ON.
3. With panel mode ON and no composer, right-click anywhere in the main area → no browser context menu appears, no app context menu (the folder right-click menu is suppressed in this mode), highlight clears momentarily.
4. With composer open, right-click inside the textarea → normal text-edit context menu appears (composer is excluded).
5. Click `◫` while panel mode ON → exits cleanly.

- [ ] **Step 3: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/panel-mode.js
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): Escape and context-menu lifecycle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Dispatch — auto-paste into active terminal tab, else clipboard

**Files:**
- Modify: `renderer/app.js` (expose `window.ezvibesInternals` at the bottom of the IIFE, before `})();`)
- Modify: `renderer/panel-mode.js`

- [ ] **Step 1: Expose `getSessionWindowByPath` and `getActiveTab` from `app.js`**

At the bottom of `renderer/app.js`, just before the closing `})();` of the IIFE, add:

```js
  window.ezvibesInternals = {
    getSessionWindowByPath(folderPath) {
      if (!folderPath) return null;
      const norm = String(folderPath).replace(/\\/g, '/').toLowerCase();
      for (const [key, value] of state.windowsByPath.entries()) {
        if (String(key).replace(/\\/g, '/').toLowerCase() === norm) return value;
      }
      return null;
    },
    getActiveTab(sessionWindow) {
      return getActiveTab(sessionWindow);
    },
  };
```

This case- and slash-insensitive lookup avoids surprises if `windowsByPath` keys come in with either separator or capitalization.

- [ ] **Step 2: Add the `EZVIBES_FOLDER` constant and dispatch helpers in `panel-mode.js`**

Add a constant near the top of the IIFE in `renderer/panel-mode.js`:

```js
  const EZVIBES_FOLDER = 'C:\\Users\\Oskari\\Documents\\EZvibes';
```

Add `buildPayload`, `showToast`, and `dispatchPayload` below `closeComposer`:

```js
  function buildPayload(region, message) {
    return [
      '[EZvibes panel-mode request]',
      `Target: ${region.meta.name}`,
      `Selector: [data-panel-id="${region.id}"]`,
      `Defined: ${region.meta.file}:${region.meta.line}`,
      `Description: ${region.meta.describe}`,
      '',
      'Request:',
      message.trim(),
    ].join('\n');
  }

  function showToast(text) {
    if (!composerToast) return;
    composerToast.textContent = text;
    composerToast.hidden = false;
    setTimeout(() => {
      if (composerToast) composerToast.hidden = true;
    }, 2500);
  }

  async function dispatchPayload(region, message) {
    const api = window.ezvibes;
    const internals = window.ezvibesInternals;
    const payload = buildPayload(region, message);

    const sessionWindow = internals && internals.getSessionWindowByPath
      ? internals.getSessionWindowByPath(EZVIBES_FOLDER)
      : null;
    const activeTab = sessionWindow && internals.getActiveTab
      ? internals.getActiveTab(sessionWindow)
      : null;

    if (activeTab && activeTab.ptyAlive && api && api.writeTerminal) {
      const wrapped = `\x1b[200~${payload}\x1b[201~\n`;
      api.writeTerminal(activeTab.id, wrapped);
      return { delivered: 'tab' };
    }

    if (api && api.writeClipboard) {
      await api.writeClipboard(payload);
      return { delivered: 'clipboard' };
    }

    return { delivered: 'none' };
  }
```

- [ ] **Step 3: Wire the Send button and Ctrl+Enter**

Inside `ensureComposer`, after the existing `composerCancelBtn.addEventListener('click', closeComposer);` line, add:

```js
    composerSendBtn.addEventListener('click', onSend);
    composerTextarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSend();
      }
    });
```

Add `onSend` below `dispatchPayload`:

```js
  async function onSend() {
    if (!frozenRegion) return;
    const message = composerTextarea.value.trim();
    if (!message) {
      composerTextarea.focus();
      return;
    }
    const region = frozenRegion;
    composerSendBtn.disabled = true;
    try {
      const result = await dispatchPayload(region, message);
      composerSendBtn.disabled = false;
      if (result.delivered === 'tab') {
        closeComposer();
        setActive(false);
      } else if (result.delivered === 'clipboard') {
        showToast('No active EZvibes terminal session — payload copied to clipboard.');
      } else {
        showToast('Could not deliver payload (no terminal / no clipboard).');
      }
    } catch (err) {
      composerSendBtn.disabled = false;
      showToast(`Dispatch failed: ${err && err.message ? err.message : String(err)}`);
    }
  }
```

- [ ] **Step 4: Verify dispatch path A — clipboard fallback (no live tab open)**

`npm start`. Without launching any session window for the EZvibes folder:
1. Click `◫`.
2. Hover the path bar and click it.
3. Type into the textarea: `add a button right of this to open /documents/ezvibes/inbox`.
4. Click `Send`.

Expected:
- The toast `No active EZvibes terminal session — payload copied to clipboard.` appears inside the composer for ~2.5 seconds.
- Switch to any other window (notepad, browser address bar) and paste (Ctrl+V) — the clipboard contains the structured payload starting with `[EZvibes panel-mode request]`.
- The composer stays open after the toast — the user can edit and try again or hit Cancel.

- [ ] **Step 5: Verify dispatch path B — auto-paste into active terminal tab**

`npm start`. Navigate the file browser to the EZvibes folder (or use the EZvibes quick-link in the sidebar), click `Launch Claude Here`. Wait for the Claude prompt to appear. Then:
1. Click `◫`.
2. Hover the path bar and click it.
3. Type: `add a button right of this to open /documents/ezvibes/inbox`.
4. Click `Send` (or press Ctrl+Enter).

Expected:
- The composer disappears, panel mode exits.
- The active terminal tab shows the full structured payload pasted as one block (the terminal app treats it as a single paste because of the bracketed-paste markers).

- [ ] **Step 6: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add renderer/app.js renderer/panel-mode.js
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "feat(panel-mode): dispatch to active terminal tab with clipboard fallback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (add a Panel Mode bullet under Current UX, a Key Files entry, and a Known Limitations entry)

- [ ] **Step 1: Append a Panel Mode bullet under Current UX**

In `CLAUDE.md`, find the `## Current UX` section and append the following bullet at the end of its list (before `## Known Limitations`):

```
- The topbar `◫` button toggles **Panel Mode**: hover any major UI region to highlight it (folder cards, session windows, tab chips, terminal frame, etc.), click to open a small composer, type a request, hit Send. The renderer builds a structured payload (region name + selector + `file:line` + the user's text), wraps it in bracketed-paste markers, and writes it into the active live terminal tab for the EZvibes folder. If no live tab exists, the unwrapped payload is copied to the clipboard and a 2.5s toast surfaces inside the composer. Escape exits the mode (or closes the composer first). The selectable regions live in a curated registry in `renderer/panel-mode.js`; static regions are tagged with `data-panel-id` in `renderer/index.html`, dynamic ones in their builders in `renderer/app.js`.
```

Also append under `## Key Files` (in alphabetical-ish order, after `renderer/app.js`):

```
- `renderer/panel-mode.js` — panel-mode toggle: region registry, hover highlight overlay, click composer, dispatch into active EZvibes terminal tab (clipboard fallback). Pure renderer, no main-process / IPC additions; reaches into `app.js` via `window.ezvibesInternals` only to resolve the active tab.
```

And add a Known Limitations entry:

```
- Panel mode's EZvibes folder path is a hard-coded constant in `renderer/panel-mode.js` (`EZVIBES_FOLDER`). Moving the repo means editing one line.
```

- [ ] **Step 2: Verify**

Open `CLAUDE.md` and confirm the three additions are in place. No app behavior to test.

- [ ] **Step 3: Commit**

```
git -C "C:/Users/Oskari/Documents/EZvibes" add CLAUDE.md
git -C "C:/Users/Oskari/Documents/EZvibes" commit -m "docs(panel-mode): document the new toggle and module in CLAUDE.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 5. Final acceptance test (after all 10 tasks ship)

`npm start` from `C:\Users\Oskari\Documents\EZvibes`. Run this end-to-end:

1. The topbar has three toggle icons: `▤` (narration), `◫` (panel mode, new), `LOG` (live log).
2. Click `◫`. Verify: button gains accent border + background, cursor becomes crosshair, content area dims.
3. Hover each region in turn — every one of these should show a blue border + correctly-named chip:
   - Top bar, Window title, Nav buttons group, Back button, Up button, Refresh button, Path bar, Search input, Narration toggle, Panel-mode toggle, Live-log toggle, Sidebar, Active sessions link, Places list, Content area, Command bar, Launch Claude Here button, Folder count, Folder grid, Narration sidebar (open it first via `▤`), Live-log drawer (open via `LOG`).
4. Click `◫` to exit. Click `Launch Claude Here`. Wait for the Claude prompt. Click `◫` to re-enter panel mode.
5. Hover each session-window region — chip names must match:
   - Session window, Session window tab strip, Session window header, Session tab chip, Session "new tab" button, Session window folder label, Session window controls, Terminal pocket.
6. Click the path bar in panel mode → composer opens. Type `please verify this works`. Click `Send`. Verify the active terminal tab receives the structured payload as a single pasted block beginning with `[EZvibes panel-mode request]`. Composer disappears, panel mode exits.
7. Close the session window. Re-enter panel mode. Click any region → type a message → Send. Verify the toast `No active EZvibes terminal session — payload copied to clipboard.` appears. Paste into Notepad to confirm the clipboard contains the payload.
8. Press `Escape` while composer is open → composer closes, highlight clears, panel mode stays. Press `Escape` again → panel mode exits, `◫` aria-pressed goes false.
9. Verify `CLAUDE.md` mentions Panel Mode, `renderer/panel-mode.js`, and the hard-coded folder limitation.
10. `git log --oneline -12` shows 10 new commits (one per task) plus the two pre-existing spec/plan commits.

If all 10 checks pass, the feature is complete.

---

## 6. Notes & adaptations from spec

- Spec said: "Captured once at module load via api.getInitialPath()-style lookup? No. A hard constant is simpler." → honored with `const EZVIBES_FOLDER = 'C:\\Users\\Oskari\\Documents\\EZvibes'`. Documented as a known limitation in CLAUDE.md.
- Spec said: "Multi-region 'batch' selections" is out of scope → composer accepts one region per send. The user can re-open panel mode and pick another region for the next request.
- Dispatch sends to whichever EZvibes terminal tab is active and live (`tab.ptyAlive`), regardless of whether it is Claude or Codex. Clipboard fallback is only for no live active tab / no session / missing API.
- Click-handler logic in Task 7 swallows all clicks outside the toggle/composer while panel mode is on (preventing folder navigation, etc.). This is intentional — the spec's "all non-region click and hover effects are suppressed" is implemented at the document level via the capture-phase listener.
- Z-index 5000 (highlight) and 5001 (composer) sit above the existing maximum of 2000 (`.new-tab-menu`), so panel mode is always on top.
