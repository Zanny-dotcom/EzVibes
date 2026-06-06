# Workspaces Redesign + Critical Bug Fix Plan

**Date:** 2026-05-28
**Status:** Draft — awaiting user approval.

**Context:** The workspaces feature shipped on `main` (commits `b32c740`→`6a91b85`) but was never visually smoke-tested. It has one **critical correctness bug** that prevents the app from booting in its intended state, plus a list of **visual issues** that make the result look amateurish to the user. See the previous build plan at `docs/2026-05-28-workspaces-plan.md` for the original 13-task feature.

This plan does **not** rebuild the feature — it fixes the bug and reskins the rail. All existing data model, persistence, hotkeys, and grid integration stay intact.

---

## Problems being solved

### P1 — Boot infinite loop (critical; blocks everything else)

`TabsFeature.bootInitialTabs` (in `renderer/features/tabs/tabs.renderer.js:145-156`) iterates `activeWs.tabs` with `for...of` while `addTab → WorkspacesFeature.registerTabOwner` (in `renderer/features/workspaces/workspaces.renderer.js:149-155`) **mutates the same array** by pushing `{tabId: <new>}` entries.

Trace (user's actual state: `~/.yourterm/config.json` has v1 `tabState: [{customName:'grid', ...}]`):

1. Migration wraps the array into `workspaces:[{tabs:[<original>]}]`. `activeWs.tabs` length = 1.
2. Loop iteration 0: `addTab('grid', ...)` → `tabCounter=1, tabId='tab-1'` → `registerTabOwner` pushes `{tabId:'tab-1'}`. Length now 2.
3. Loop iteration 1: entry = `{tabId:'tab-1'}` (no `type`, no `customName`). `addTab(undefined, undefined, ...)` → creates **"Terminal 2"**. Pushes `{tabId:'tab-2'}`. Length now 3.
4. Iteration 2: → **"Terminal 3"**. Length 4.
5. ... continues until the renderer is killed by Chromium's long-running-script guard.

Observed: user's screenshot shows `grid`, `Terminal 2`, `Terminal 3`, `Terminal 4` even though only `grid` is persisted. The loop is producing them. Even though the app remains visible, every subsequent boot deals with this corrupt state.

### P2 — Workspace rail design is wrong

Current behavior (`workspaces.styles.css`, `workspaces.renderer.js::renderRail`):
- 44 px wide, dark column on the left.
- Tiles 40 px tall, abbreviated text via `shortLabel()` ("Workspace 1" → "WOR").
- Each tile shows a hotkey chip (`^⇧1`, `^⇧2`...).
- `+` button styled with a dashed border, also chip-labeled `^⇧T`.

User wants (confirmed 2026-05-28 via annotated screenshot — top tab circled in green, left tile circled in green):
- Vertical bar on the **left**, matching the existing top tab-bar's red-glow aesthetic.
- Tiles **match top-tab dimensions exactly**: same visual width (~140-150 px) and same height (~32 px). Wide rectangles — **not** square, not narrow.
- Tile shows the full workspace name with ellipsis (e.g. "Workspace 1"), not a 3-char abbreviation.
- **Always visible**, even with one workspace.
- `+` button sits at the bottom of the rail, sized to fit the rail width.
- No hotkey chips on tiles or on the `+` button.

### P3 — Hotkey chips everywhere look goofy

The previous build sprayed `hotkey-chip` spans on:
- Tab-bar `+` button (`^T`) — `tabs.renderer.js:110`.
- Workspace rail `+` button (`^⇧T`) — `workspaces.renderer.js:52`.
- Workspace tiles (`^⇧1`..`^⇧9`) — `workspaces.renderer.js:106-110`.
- Sidebar `Grid` toggle (`^⇧G`) — `renderer/index.html:33`.

Remove all of them. Hotkey discoverability moves to button `title=` tooltips, which is already populated.

### P4 — Sidebar `Grid` button visual overlap

In `renderer/index.html:33` the `Grid` button has both `<span class="grid-glyph">Grid</span>` and `<span class="hotkey-chip">^⇧G</span>`. The chip sits in the top-right corner of a small button and visually collides with the "Grid" text. Fixing P3 removes the chip; the button reverts to a clean "Grid" label.

---

## Conventions used in this plan

- **Style:** matches the existing codebase — CommonJS in main, IIFE in renderer, semicolons, single quotes, camelCase identifiers, PascalCase namespaces.
- **Commits:** one commit per task. Conventional-style messages (`fix(...)`, `feat(...)`, `refactor(...)`).
- **Smoke tests:** each task ends with a manual smoke step. Run with `npm start`. Close fully between runs.

---

## Task 1: Fix the boot-restore infinite loop **(CRITICAL — do first)**

**Files:**
- Modify: `renderer/features/tabs/tabs.renderer.js`

**Steps:**

- [ ] **Step 1: Snapshot `activeWs.tabs` before the restore loop.**

Replace (`tabs.renderer.js:145-156`):

```js
isRestoring = true;
for (const entry of (activeWs && activeWs.tabs) || []) {
  // Persisted entries carry a stale tabId from a previous session — let
  // addTab assign a fresh one. Workspace ownership re-registers via the
  // active-workspace context (registerTabOwner inside addTab).
  const type = entry.type || 'terminal';
  const payload = entry.payload || null;
  addTab(entry.customName, entry.theme, { type, payload, restoring: true });
}
isRestoring = false;
// Clear the stale tabIds we just restored from — addTab pushed fresh ones.
if (activeWs) activeWs.tabs = activeWs.tabs.filter((t) => t.tabId && !isStaleTabId(t.tabId));
```

with:

```js
isRestoring = true;
// Snapshot before iterating: addTab → WorkspacesFeature.registerTabOwner
// pushes new entries into activeWs.tabs as a side effect. Iterating the
// live array would see those pushes and create duplicate tabs forever.
const restoreEntries = (activeWs && activeWs.tabs) ? activeWs.tabs.slice() : [];
for (const entry of restoreEntries) {
  const type = entry.type || 'terminal';
  const payload = entry.payload || null;
  addTab(entry.customName, entry.theme, { type, payload, restoring: true });
}
isRestoring = false;
// Drop the original persisted entries (no tabId) — addTab pushed fresh
// {tabId} entries that the filter below keeps.
if (activeWs) activeWs.tabs = activeWs.tabs.filter((t) => t.tabId && !isStaleTabId(t.tabId));
```

- [ ] **Step 2: Smoke test — config restores to the right number of tabs.**

Delete the working `~/.yourterm/config.json` backup first (so we can compare), then:

```
npm start
```

Expected: ONE tab in the top tab bar, labeled `grid`, with no extra "Terminal 2/3/4" duplicates. Close the app; reopen — still one `grid` tab. Open `~/.yourterm/config.json` and confirm `tabState.version === 2` with one entry under `workspaces[0].tabs`.

- [ ] **Step 3: Commit.**

```
git add renderer/features/tabs/tabs.renderer.js
git commit -m "fix(tabs): snapshot activeWs.tabs to avoid restore-loop tab duplication

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Strip every hotkey-chip from buttons

**Files:**
- Modify: `renderer/features/tabs/tabs.renderer.js` (tab `+` button)
- Modify: `renderer/features/tabs/tabs.styles.css` (remove `.hotkey-chip` rules)
- Modify: `renderer/features/workspaces/workspaces.renderer.js` (rail `+` + tile chips)
- Modify: `renderer/index.html` (sidebar `Grid` button)

**Steps:**

- [ ] **Step 1: Tab-bar `+` button.**

In `tabs.renderer.js::setupTabBar` (~line 107-113) replace:

```js
addButton = document.createElement('button');
addButton.id = 'tab-add';
addButton.className = 'tab-add-btn hotkey-chip-host';
addButton.innerHTML = '<span class="add-glyph">+</span><span class="hotkey-chip">^T</span>';
addButton.title = 'New tab (Ctrl+T) — right-click for browser tab';
```

with:

```js
addButton = document.createElement('button');
addButton.id = 'tab-add';
addButton.className = 'tab-add-btn';
addButton.textContent = '+';
addButton.title = 'New tab (Ctrl+T) — right-click for browser tab';
```

- [ ] **Step 2: Workspace rail `+` button.**

In `workspaces.renderer.js::init` (~line 45-52) replace:

```js
state.addButton = document.createElement('button');
state.addButton.id = 'workspace-rail-add';
state.addButton.className = 'workspace-add-btn hotkey-chip-host';
state.addButton.title = 'New workspace (Ctrl+Shift+T)';
state.addButton.setAttribute('aria-label', 'New workspace');
state.addButton.innerHTML =
  '<span class="add-glyph">+</span>' +
  '<span class="hotkey-chip">^⇧T</span>';
```

with:

```js
state.addButton = document.createElement('button');
state.addButton.id = 'workspace-rail-add';
state.addButton.className = 'workspace-add-btn';
state.addButton.title = 'New workspace (Ctrl+Shift+T)';
state.addButton.setAttribute('aria-label', 'New workspace');
state.addButton.textContent = '+';
```

- [ ] **Step 3: Workspace tiles — drop the chip span.**

In `workspaces.renderer.js::renderRail` (~line 95-111) remove:

```js
tile.className = 'workspace-tile hotkey-chip-host';
```

→

```js
tile.className = 'workspace-tile';
```

and delete the whole `if (idx < 9) { ... chip ... tile.appendChild(chip); }` block (lines 106-111).

Also change the `nameSpan.textContent = shortLabel(ws.name)` line to `nameSpan.textContent = ws.name;` — Task 3 will redesign the tile to fit the full name. `shortLabel` becomes dead code; **delete the entire `shortLabel` function** (~lines 128-137).

- [ ] **Step 4: Sidebar `Grid` toggle.**

In `renderer/index.html` (line 33) replace:

```html
<button id="grid-view-toggle" class="mode-btn hotkey-chip-host" type="button" aria-pressed="false" title="Toggle grid view of all tabs (Ctrl+Shift+G)"><span class="grid-glyph">Grid</span><span class="hotkey-chip">^⇧G</span></button>
```

with:

```html
<button id="grid-view-toggle" class="mode-btn" type="button" aria-pressed="false" title="Toggle grid view of all tabs (Ctrl+Shift+G)">Grid</button>
```

- [ ] **Step 5: Delete unused CSS.**

In `renderer/features/tabs/tabs.styles.css` delete the trailing block (~lines 328-343):

```css
/* Hotkey-chip utility ... */
.hotkey-chip {
  position: absolute;
  ...
}
.hotkey-chip-host {
  position: relative;
}
```

- [ ] **Step 6: Smoke test.**

```
npm start
```

Expected: every button shows plain text/glyph only. No `^T`, `^⇧T`, `^⇧G`, `^⇧1` chips. Hover any of them — the hotkey is shown in the native tooltip. The sidebar `Grid` button reads cleanly as "Grid" with no overlap.

- [ ] **Step 7: Commit.**

```
git add renderer/features/tabs/tabs.renderer.js renderer/features/tabs/tabs.styles.css renderer/features/workspaces/workspaces.renderer.js renderer/index.html
git commit -m "refactor(ui): remove hotkey-chip labels from + buttons and grid toggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Reskin the workspace rail to match the tab-bar aesthetic

**Files:**
- Modify: `renderer/features/workspaces/workspaces.styles.css` (full rewrite)
- Modify: `renderer/features/workspaces/workspaces.renderer.js` (tile DOM cleanup)

**Steps:**

- [ ] **Step 1: Rewrite `workspaces.styles.css`.**

Replace the entire file with:

```css
/* Vertical workspace rail. Each tile has the same width × height footprint
   as a top-bar tab (wide rectangle, ~140 px × 32 px), so the rail reads as
   "the top tab bar rotated 90° onto the left edge". */
#workspace-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 160px;
  flex: 0 0 160px;
  background: var(--tab-bar-bg);
  border-right: 1px solid var(--border);
  padding: 6px 6px 6px 4px;     /* asymmetric — tighter on the left edge */
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
}

.workspace-tile {
  position: relative;
  height: 32px;
  min-height: 32px;
  border-radius: 6px 0 0 6px;     /* round outer (left) corners only — mirrors top tab's top-rounded corners, rotated */
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 11px;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 0 10px;
  transition: background 0.12s, color 0.12s, border-color 0.12s, box-shadow 0.12s;
}

.workspace-tile .workspace-name {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.workspace-tile:hover {
  background: var(--surface);
  color: var(--text-dim);
}

.workspace-tile.active {
  background: var(--app-bg);
  color: var(--text);
  border-color: var(--border);
  box-shadow: inset 3px 0 0 var(--accent);
}

.workspace-tile.colored {
  border-bottom: 2px solid var(--tab-color);
  box-shadow:
    inset 3px 0 0 var(--tab-color),
    0 0 4px var(--tab-color),
    0 3px 10px color-mix(in oklch, var(--tab-color) 55%, transparent);
}

.workspace-tile.colored .workspace-name {
  color: var(--tab-color);
  text-shadow:
    0 0 4px var(--tab-color),
    0 0 10px color-mix(in oklch, var(--tab-color) 55%, transparent);
}

.workspace-tile.colored.active {
  background: var(--app-bg);
  color: var(--text);
}

/* + button — fills the rail width, sits at the bottom, quiet dashed style. */
.workspace-add-btn {
  position: relative;
  height: 32px;
  margin-top: auto;       /* push to the bottom of the rail */
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-muted);
  border-radius: 6px 0 0 6px;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workspace-add-btn:hover {
  background: var(--accent-soft);
  color: var(--text);
  border-color: var(--accent-border);
}

/* Context menu and rename input — unchanged from the previous styling, just
   moved here for completeness. */
.workspace-context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 6px;
  min-width: 180px;
  box-shadow: 0 8px 24px var(--shadow);
  font-size: 12px;
  color: var(--text);
}
.workspace-context-menu.hidden { display: none; }
.workspace-context-label {
  padding: 4px 8px;
  color: var(--text-dim);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.workspace-swatch-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 4px;
}
.workspace-swatch {
  width: 100%;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border);
  cursor: pointer;
}
.workspace-context-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: inherit;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.workspace-context-item:hover { background: var(--accent-soft); }
.workspace-context-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.workspace-rename-input {
  width: 100%;
  background: var(--app-bg);
  border: 1px solid var(--accent);
  color: var(--text);
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 4px;
  outline: none;
  text-align: center;
}
```

- [ ] **Step 2: Clean up the renderer's tile creation.**

`workspaces.renderer.js::renderRail` should already be simpler after Task 2. After Task 3 it looks like this (only the tile-creation block changes — `insertBefore` order, click handlers, contextmenu handler are unchanged):

```js
function renderRail() {
  if (!state.rail) return;
  state.rail.querySelectorAll('.workspace-tile').forEach((el) => el.remove());
  state.workspaces.forEach((ws) => {
    const tile = document.createElement('div');
    tile.className = 'workspace-tile';
    tile.dataset.workspaceId = ws.id;
    tile.setAttribute('role', 'tab');
    tile.setAttribute('tabindex', ws.id === state.activeWorkspaceId ? '0' : '-1');
    tile.title = ws.name;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'workspace-name';
    nameSpan.textContent = ws.name;
    tile.appendChild(nameSpan);
    if (ws.id === state.activeWorkspaceId) tile.classList.add('active');
    if (ws.color) {
      tile.classList.add('colored');
      const hex = ThemeManager.THEMES[ws.color] && ThemeManager.THEMES[ws.color].brand;
      if (hex) tile.style.setProperty('--tab-color', hex);
    }
    tile.addEventListener('click', () => activate(ws.id));
    tile.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(ws.id, e.clientX, e.clientY);
    });
    state.rail.insertBefore(tile, state.addButton);
  });
}
```

Note: the old `idx < 9` chip branch is gone (handled in Task 2). The `shortLabel` helper should already be deleted from Task 2.

- [ ] **Step 3: Smoke test.**

```
npm start
```

Expected:
- 160 px-wide rail on the far left, dark with subtle right-border. Rail width matches a comfortable top-tab width.
- One workspace tile ("Workspace 1") roughly 150 px wide × 32 px tall — same wide-rectangle shape as a top-bar tab. Currently active, highlighted with a red 3 px left-edge stripe (`inset 3px 0 0 var(--accent)`).
- `+` button at the bottom of the rail, 32 px tall × full rail width, dashed border, hover-glows red.
- Ctrl+Shift+T → second tile "Workspace 2" appears above the `+`; clicking either tile switches the top tab bar between the two workspaces' tabs.
- Right-click any tile → color/rename/close menu still works. Picking a color (e.g. Mint) gives the tile a coloured left-stripe + soft glow.
- Top tab bar UNCHANGED from before the workspaces feature — same Chrome-style curved tabs, same `+` glyph, same colored-tab glow. No chip anywhere.

Close the app.

- [ ] **Step 4: Commit.**

```
git add renderer/features/workspaces/workspaces.styles.css renderer/features/workspaces/workspaces.renderer.js
git commit -m "refactor(workspaces): reskin rail with bulkier tiles + tab-bar aesthetic

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Grid view → single-workspace "security cam" tile grid

The previous build laid grid mode out as one column per workspace (`renderer/features/grid-view/grid-view.renderer.js::refreshLayout` lines 84-148 and the matching CSS `--workspace-cols` / `.workspace-column-header` rules in `grid-view.styles.css`). With one workspace, that gives a single tall column of stretched rows — which the user rejected (see the 2026-05-28 screenshot showing "WORKSPACE 1" + ~15 wide-strip tiles stacked vertically).

The user wants the **classic "security cam" tile grid**: only the ACTIVE workspace's tabs are shown, arranged as an N × M matrix (roughly square). Workspace switching happens via the left rail; the grid re-lays-out for the newly-active workspace's tabs.

**Files:**
- Modify: `renderer/features/grid-view/grid-view.renderer.js`
- Modify: `renderer/features/grid-view/grid-view.styles.css`

**Steps:**

- [ ] **Step 1: Rewrite `refreshLayout` to be single-workspace.**

In `grid-view.renderer.js`, replace the existing `refreshLayout` body (~lines 84-148) with:

```js
function refreshLayout() {
  const activeWs = (typeof WorkspacesFeature !== 'undefined' && WorkspacesFeature.getActiveWorkspace)
    ? WorkspacesFeature.getActiveWorkspace()
    : null;
  const activeTabIds = activeWs
    ? new Set((activeWs.tabs || []).map((t) => t.tabId).filter(Boolean))
    : new Set();

  // Toggle visibility per workspace ownership. The `.workspace-hidden`
  // class is forced display:none via a high-specificity rule in
  // grid-view.styles.css so it wins over the grid-mode `display: block !important`
  // (which itself defeats switchTerminal's per-tab display toggles).
  contentEl.querySelectorAll('.terminal-panel').forEach((panel) => {
    const inActiveWs = activeTabIds.has(panel.dataset.tabId);
    panel.classList.toggle('workspace-hidden', !inActiveWs);
    // Reset any leftover inline grid placement from the old multi-workspace layout.
    panel.style.removeProperty('grid-column-start');
    panel.style.removeProperty('grid-row-start');
    if (inActiveWs) {
      panel.dataset.tileLabel = labelFor(panel.dataset.tabId);
      const color = colorFor(panel.dataset.tabId);
      if (color) panel.style.setProperty('--tab-color', color);
      else panel.style.removeProperty('--tab-color');
    }
  });

  // Old per-workspace column headers don't exist in the new layout.
  contentEl.querySelectorAll('.workspace-column-header').forEach((el) => el.remove());

  const tileCount = activeTabIds.size;
  if (tileCount === 0) {
    contentEl.style.setProperty('--grid-cols', '1');
    contentEl.style.setProperty('--grid-rows', '1');
    requestRelayout();
    return;
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(tileCount)));
  const rows = Math.max(1, Math.ceil(tileCount / cols));
  contentEl.style.setProperty('--grid-cols', String(cols));
  contentEl.style.setProperty('--grid-rows', String(rows));
  requestRelayout();
}
```

- [ ] **Step 2: Strengthen the workspace-switched hook.**

In `grid-view.renderer.js::init`, the existing `WorkspacesFeature.onWorkspaceSwitched` only focuses a tile. Change it to do a full `refreshLayout` (so the new workspace's tabs become the visible tiles):

```js
WorkspacesFeature.onWorkspaceSwitched(() => {
  if (!state.active) return;
  refreshLayout();
  const ws = WorkspacesFeature.getActiveWorkspace();
  if (ws && ws.activeTabId) focusTile(ws.activeTabId);
});
```

- [ ] **Step 3: Rewrite `grid-view.styles.css`.**

Replace the entire file with:

```css
#grid-view-toggle.mode-btn {
  margin-top: 2px;
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  padding-top: 2px;
  position: relative;
}

#grid-view-toggle.mode-btn[aria-pressed="true"],
#grid-view-toggle.mode-btn.active {
  background: var(--accent);
  color: #000;
}

#terminal-content.grid-mode {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols, 1), 1fr);
  grid-template-rows: repeat(var(--grid-rows, 1), 1fr);
  gap: 8px;
  padding: 8px 10px 10px 10px;
  overflow: auto;
}

#terminal-content.grid-mode .terminal-panel {
  position: static;
  top: auto;
  left: auto;
  right: auto;
  bottom: auto;
  display: block !important;       /* defeat switchTerminal's display:none toggle */
  overflow: hidden;
  cursor: pointer;
  contain: layout paint;
  min-width: 0;
  min-height: 0;
  border: 2px solid var(--tab-color, var(--border));
}

/* Higher specificity than the above so it wins; same !important. Drives
   "only active-workspace panels are visible in grid mode". */
#terminal-content.grid-mode .terminal-panel.workspace-hidden {
  display: none !important;
}

#terminal-content.grid-mode .terminal-panel .xterm {
  transform: scale(var(--grid-scale, 0.5));
  transform-origin: top left;
  width: calc(100% / var(--grid-scale, 0.5));
  height: calc(100% / var(--grid-scale, 0.5));
  pointer-events: auto;
}

#terminal-content.grid-mode .terminal-panel.grid-focused {
  outline: 3px solid var(--tab-color, var(--accent));
  outline-offset: -3px;
  box-shadow: 0 0 18px color-mix(in oklch, var(--tab-color, var(--accent)) 30%, transparent);
}

#terminal-content.grid-mode .terminal-panel::after {
  content: attr(data-tile-label);
  position: absolute;
  top: 6px;
  left: 10px;
  z-index: 3;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(8, 8, 8, 0.78);
  border: 1px solid var(--tab-color, var(--border, rgba(255, 255, 255, 0.1)));
  border-radius: 4px;
  color: var(--tab-color, var(--text-dim, #cccccc));
  pointer-events: none;
  max-width: calc(100% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#terminal-content.grid-mode .terminal-panel.grid-focused::after {
  color: var(--tab-color, var(--accent));
  border-color: var(--tab-color, var(--accent));
}

/* Browser tabs don't tile; keep hidden until grid is exited. */
#terminal-content.grid-mode .browser-panel {
  display: none !important;
}
```

Note: `.workspace-column-header` rule and the `--workspace-cols` variable are gone.

- [ ] **Step 4: Smoke test — security cam layout.**

```
npm start
```

Setup: open ~5 terminal tabs in Workspace 1.

Expected:
- Click `Grid` → all 5 tabs tile as a 3 × 2 grid (5 tiles, last cell empty), each tile shows the live xterm scaled to fit. Click any tile → focus moves; grid stays on. `Ctrl+T` → 6th tile appears; layout reflows to 3 × 2.
- Press `Ctrl+Shift+T` → Workspace 2 created. Top tab bar swaps to its single default tab. Grid mode immediately re-lays-out: ONE big tile (Workspace 2's single tab). The 5 Workspace-1 tiles are gone from view (panels are `.workspace-hidden`, not in the grid).
- Click the rail's first tile → Workspace 1 returns; grid re-lays-out to its 5-tile matrix.
- Click `Grid` again → exit grid mode. The active tab fills the content area normally; no leftover tile borders or labels.
- Inspect `#terminal-content` in DevTools while in grid mode: it has `style="--grid-cols: 3; --grid-rows: 2;"`, no `--workspace-cols`, no `.workspace-column-header` children.

Close the app.

- [ ] **Step 5: Commit.**

```
git add renderer/features/grid-view/grid-view.renderer.js renderer/features/grid-view/grid-view.styles.css
git commit -m "refactor(grid-view): single-workspace security-cam tile grid

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Doc sweep (rules + FEATURE-MAP)

**Files:**
- Modify: `.claude/rules/workspaces.md`
- Modify: `.claude/rules/grid-view.md`
- Modify: `FEATURE-MAP.md`

**Steps:**

- [ ] **Step 1: Drop chip-related references.**

Search the three files for any mention of `hotkey-chip` / `^⇧` / chip-host and remove the lines. The hotkey-chip utility no longer exists.

- [ ] **Step 2: Update the rail width / tile size description.**

In `FEATURE-MAP.md`'s Workspaces entry and `.claude/rules/workspaces.md`, change the rail-width mention from `44 px` to `160 px`. Note that each tile matches the top-tab footprint (~150 px × 32 px) and the rail is now always visible (no auto-hide).

- [ ] **Step 3: Commit.**

```
git add .claude/rules/workspaces.md .claude/rules/grid-view.md FEATURE-MAP.md
git commit -m "docs: update workspaces/grid rules after redesign

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final smoke checklist

After Tasks 1-5 land, confirm in a single `npm start` session:

- [ ] Cold start with the user's current saved state (one `grid` tab) → exactly one tab visible at top, no duplicates.
- [ ] Top tab bar looks IDENTICAL to pre-workspaces (Chrome curve, red glow on active, clean `+` with no chip).
- [ ] Left workspace rail visible, 160 px wide, one tile labeled "Workspace 1" (full name, not "WOR"), tile shape matches a top-bar tab (wide rectangle, 32 px tall).
- [ ] Click rail `+` → second workspace; top tab bar resets to a single default tab; click first tile → original `grid` tab returns.
- [ ] Right-click a tile → context menu intact (color/rename/close).
- [ ] Sidebar `Grid` button reads "Grid" with no overlap; clicking toggles grid mode; `Ctrl+Shift+G` also toggles it.
- [ ] **Grid mode shows only the active workspace as an N × M tile grid** (e.g. W1 with 3 tabs → 2×2 grid with one empty cell). Clicking a W2 tile in the left rail → grid re-lays-out to show only W2's tabs. No "WORKSPACE N" column headers. No side-by-side columns.
- [ ] Closing a tab while in grid mode → its tile disappears; grid re-lays-out to a tighter matrix.
- [ ] All Ctrl+Shift+* hotkeys (T/W/Tab/1-9/G) still work — verified via tooltips, no chips visible.
- [ ] Restart → all workspaces, tabs, colors, and names persist.

If any step fails, fix in place; don't ship the redesign until the entire list is green.

---

## Out of scope

- The multi-workspace grid layout (cross-workspace columns) from the original plan stays as is; Task 3 doesn't touch grid CSS or the column-header element. If the user later wants the grid view's column headers to also pick up the new rail style, that's a follow-up.
- No changes to the workspaces data model, persistence schema (v2 stays), IPC names, or hotkey bindings.
- No revert of the original 13-commit feature build — this plan stacks on top of it.
