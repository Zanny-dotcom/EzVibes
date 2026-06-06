# Workspace Folder Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each workspace directory-bound — creating one always picks a folder (custom in-app grid), the workspace is auto-named after it, and every tab launches an agent (Claude/Codex) or a Brave browser already running in that folder, so the user never touches a bare shell.

**Architecture:** A new isolated `launcher` feature owns the folder picker (custom grid over one configured root), the agent→command map, and root persistence. Workspaces calls `LauncherFeature.pickWorkspaceFolder()`; Tabs calls `LauncherFeature.getAgentLaunch()` + a new `+` menu; Terminal persists each tab's `{agentType,cwd,cmd}` so restores relaunch the agent. Recent-Paths is removed. Persistence bumps to schema v3 with a `folder` per workspace; old state is wiped (fresh start), and zero workspaces shows a "Create workspace" empty state.

**Tech Stack:** Electron (main + preload + renderer), vanilla JS IIFE features (CommonJS in main), `node:test` for pure modules (no renderer test harness — UI verified by `npm start`).

**Spec:** `docs/2026-05-29-workspace-folder-launcher-design.md`

**Dependency note:** Tasks 1–4 are additive (app keeps working). Tasks 5–7 are the interdependent "flip" — full new behavior is reached only after **Task 7**; do not restart the app between 5 and 7 expecting stable persistence. Tasks 8–10 finish cleanup, docs, and verification.

> ⚠️ **This dev session runs INSIDE the terminal-emulator app.** Do NOT close, kill, or restart the Electron app while executing — it would terminate this session (and any sibling Claude tab in the app). The agent executing this plan must NOT run `npm start`, `electron .`, or kill the app. Where a step says *Run: `npm start`* or *restart the app*, ask the **user** to launch/restart a separate instance and report what they see. Unit-test steps (`node --test ...`, `node <file>`) are safe — they don't touch the running app.

---

### Task 1: Launcher agent-command map (pure, testable)

The single source of truth for what each agent tab runs. Dual-exported (browser global `LauncherAgents` + Node `module.exports`) like `tabs.state.js`, so it is unit-testable.

**Files:**
- Create: `renderer/features/launcher/launcher.agents.js`
- Test: `renderer/features/launcher/launcher.agents.test.js`

- [ ] **Step 1: Write the failing test**

Create `renderer/features/launcher/launcher.agents.test.js`:

```js
// Run with: node --test renderer/features/launcher/launcher.agents.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { AGENTS, getAgentLaunch } = require('./launcher.agents.js');

test('AGENTS lists claude, codex, brave in order', () => {
  assert.deepEqual(AGENTS.map((a) => a.type), ['claude', 'codex', 'brave']);
  assert.deepEqual(AGENTS.map((a) => a.label), ['New Claude tab', 'New Codex tab', 'New Brave tab']);
});

test('getAgentLaunch returns the command for claude and codex', () => {
  assert.deepEqual(getAgentLaunch('claude'), { cmd: 'claude --dangerously-skip-permissions' });
  assert.deepEqual(getAgentLaunch('codex'), { cmd: 'codex --yolo' });
});

test('getAgentLaunch returns null for brave (no command) and unknown types', () => {
  assert.equal(getAgentLaunch('brave'), null);
  assert.equal(getAgentLaunch('nope'), null);
  assert.equal(getAgentLaunch(undefined), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/launcher/launcher.agents.test.js`
Expected: FAIL — `Cannot find module './launcher.agents.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `renderer/features/launcher/launcher.agents.js`:

```js
// Feature: Launcher — agent launch command map (pure, node-testable).
// Single source of truth for what each agent tab runs.
// Exposes LauncherAgents (browser global) AND module.exports (Node tests).
(function (root) {
  'use strict';

  const AGENTS = [
    { type: 'claude', label: 'New Claude tab', cmd: 'claude --dangerously-skip-permissions' },
    { type: 'codex',  label: 'New Codex tab',  cmd: 'codex --yolo' },
    { type: 'brave',  label: 'New Brave tab',  cmd: null },
  ];

  function getAgentLaunch(type) {
    const a = AGENTS.find((x) => x.type === type);
    if (!a || a.cmd == null) return null;
    return { cmd: a.cmd };
  }

  const api = { AGENTS, getAgentLaunch };
  if (typeof window !== 'undefined') root.LauncherAgents = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test renderer/features/launcher/launcher.agents.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add renderer/features/launcher/launcher.agents.js renderer/features/launcher/launcher.agents.test.js
git commit -m "feat(launcher): add agent command map (claude/codex/brave)"
```

---

### Task 2: Launcher main process (root + subfolder listing + native dialog)

**Files:**
- Create: `src/main/features/launcher/launcher.main.js`
- Test: `src/main/features/launcher/launcher.main.test.js`
- Modify: `src/main/shared/config.js:4-11` (add `launcher` default — SHARED edit, additive only)
- Modify: `src/main/index.js:19-29` (require), `:126-131` (register), `:135-146` (cleanup)
- Modify: `src/preload/preload.js` (3 new methods)

- [ ] **Step 1: Write the failing test**

Create `src/main/features/launcher/launcher.main.test.js`:

```js
// Run with: node --test src/main/features/launcher/launcher.main.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { listSubdirectories } = require('./launcher.main');

test('lists immediate subdirectories sorted by name, ignoring files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-'));
  fs.mkdirSync(path.join(tmp, 'zeta'));
  fs.mkdirSync(path.join(tmp, 'alpha'));
  fs.writeFileSync(path.join(tmp, 'note.txt'), 'x');
  const out = listSubdirectories(tmp);
  assert.deepEqual(out.map((d) => d.name), ['alpha', 'zeta']);
  assert.equal(out[0].path, path.join(tmp, 'alpha'));
});

test('returns [] for missing, empty, or non-string paths', () => {
  assert.deepEqual(listSubdirectories(path.join(os.tmpdir(), 'nope-' + 'x'.repeat(8))), []);
  assert.deepEqual(listSubdirectories(''), []);
  assert.deepEqual(listSubdirectories(null), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/main/features/launcher/launcher.main.test.js`
Expected: FAIL — `Cannot find module './launcher.main'`.

- [ ] **Step 3: Add the config default (shared edit)**

In `src/main/shared/config.js`, add a `launcher` block to `DEFAULT_CONFIG` (additive; `deepMerge` already guards objects):

```js
const DEFAULT_CONFIG = {
  _schemaVersion: 1,
  activeProject: 'Terminal',
  imagesDir: IMAGES_DIR,
  naming: { autoRename: true, counter: 1 },
  terminal: { shell: 'auto', theme: 'dark' },
  sidebar: { sortBy: 'newest', showStaged: true },
  launcher: { rootFolder: null },
};
```

- [ ] **Step 4: Write minimal implementation**

Create `src/main/features/launcher/launcher.main.js`:

```js
// Feature: Launcher (main side)
// Depends on: shared/config (rootFolder persistence)
// IPC: launcher:get-root (handle), launcher:choose-root (handle), launcher:list-folders (handle)
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { getCurrentConfig, setCurrentConfig, writeConfig } = require('../../shared/config');

function getRoot() {
  const config = getCurrentConfig() || {};
  const root = config.launcher && config.launcher.rootFolder;
  return typeof root === 'string' && root ? root : null;
}

function setRoot(folderPath) {
  const config = getCurrentConfig() || {};
  config.launcher = Object.assign({}, config.launcher, { rootFolder: folderPath });
  setCurrentConfig(config);
  writeConfig(config);
  return folderPath;
}

// Pure, node-testable: immediate subdirectories of a folder, sorted by name.
function listSubdirectories(rootPath) {
  if (typeof rootPath !== 'string' || !rootPath) return [];
  let entries;
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: path.join(rootPath, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function register(mainWindow) {
  ipcMain.handle('launcher:get-root', () => getRoot());

  ipcMain.handle('launcher:choose-root', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose your main folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths || !result.filePaths.length) return null;
    return setRoot(result.filePaths[0]);
  });

  ipcMain.handle('launcher:list-folders', () => {
    const root = getRoot();
    return root ? listSubdirectories(root) : [];
  });
}

function cleanup() {
  ipcMain.removeHandler('launcher:get-root');
  ipcMain.removeHandler('launcher:choose-root');
  ipcMain.removeHandler('launcher:list-folders');
}

module.exports = { register, cleanup, listSubdirectories, getRoot, setRoot };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test src/main/features/launcher/launcher.main.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire into the main bootstrap**

In `src/main/index.js`, add the require alongside the other feature requires (after line 29 `const browser = ...`):

```js
  const launcher = require('./features/launcher/launcher.main');
```

Add the register call in `app.whenReady().then(...)` after `browser.register(mainWindow);` (line 131):

```js
    launcher.register(mainWindow);
```

Add the cleanup call in the `mainWindow.on('closed', ...)` handler after `browser.cleanup();` (line 145):

```js
      launcher.cleanup();
```

- [ ] **Step 7: Expose preload methods**

In `src/preload/preload.js`, inside the `exposeInMainWorld('terminalAPI', { ... })` object (next to `getConfig`/`setConfig`), add:

```js
  launcherGetRoot: () => ipcRenderer.invoke('launcher:get-root'),
  launcherChooseRoot: () => ipcRenderer.invoke('launcher:choose-root'),
  launcherListFolders: () => ipcRenderer.invoke('launcher:list-folders'),
```

- [ ] **Step 8: Commit**

```bash
git add src/main/features/launcher/launcher.main.js src/main/features/launcher/launcher.main.test.js src/main/shared/config.js src/main/index.js src/preload/preload.js
git commit -m "feat(launcher): main-process root storage + subfolder listing + native dialog IPC"
```

---

### Task 3: Launcher renderer (the folder-picker modal)

DOM feature (no unit test — verified by `npm start`). Re-exports the agent map so the public surface matches the spec (`LauncherFeature.getAgentLaunch`, `LauncherFeature.AGENTS`).

**Files:**
- Create: `renderer/features/launcher/launcher.renderer.js`
- Create: `renderer/features/launcher/launcher.styles.css`
- Modify: `renderer/index.html:19` (css link), `:65-66` (scripts), 
- Modify: `renderer/app.js:1-2` (init)

- [ ] **Step 1: Write the renderer feature**

Create `renderer/features/launcher/launcher.renderer.js`:

```js
// Feature: Launcher (renderer)
// Depends on: window.terminalAPI (launcher:* IPC), LauncherAgents (agent map global)
// Provides: LauncherFeature.init(), pickWorkspaceFolder(), getAgentLaunch(type), AGENTS
// Consumed by: WorkspacesFeature (pickWorkspaceFolder), TabsFeature (getAgentLaunch, AGENTS)
const LauncherFeature = (function () {
  let overlay = null;
  let gridEl = null;
  let resolveCurrent = null;

  function init() {
    buildModal();
  }

  function buildModal() {
    overlay = document.createElement('div');
    overlay.id = 'launcher-modal';
    overlay.className = 'modal-overlay hidden';

    const dialogEl = document.createElement('div');
    dialogEl.className = 'modal-dialog launcher-dialog';

    const title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = 'Choose a folder for this workspace';
    dialogEl.appendChild(title);

    gridEl = document.createElement('div');
    gridEl.className = 'launcher-grid';
    dialogEl.appendChild(gridEl);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const changeBtn = document.createElement('button');
    changeBtn.className = 'modal-btn';
    changeBtn.textContent = 'Change main folder';
    changeBtn.addEventListener('click', async () => {
      const root = await window.terminalAPI.launcherChooseRoot();
      if (root) renderGrid();
    });
    actions.appendChild(changeBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn';
    cancelBtn.textContent = 'Cancel (Esc)';
    cancelBtn.addEventListener('click', () => finish(null));
    actions.appendChild(cancelBtn);

    dialogEl.appendChild(actions);
    overlay.appendChild(dialogEl);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('hidden') && e.key === 'Escape') finish(null);
    });
  }

  // Returns { path, name } on pick, or null if the user cancels (incl. cancelling
  // the first-time root dialog).
  async function pickWorkspaceFolder() {
    if (resolveCurrent) return null; // already open — ignore re-entry
    let root = await window.terminalAPI.launcherGetRoot();
    if (!root) {
      root = await window.terminalAPI.launcherChooseRoot();
      if (!root) return null;
    }
    return new Promise((resolve) => {
      resolveCurrent = resolve;
      overlay.classList.remove('hidden');
      renderGrid();
    });
  }

  async function renderGrid() {
    gridEl.innerHTML = '';
    const folders = await window.terminalAPI.launcherListFolders();
    if (!folders || !folders.length) {
      const empty = document.createElement('div');
      empty.className = 'launcher-empty';
      empty.textContent = 'No subfolders here. Use “Change main folder”.';
      gridEl.appendChild(empty);
      return;
    }
    for (const folder of folders) {
      const tile = document.createElement('button');
      tile.className = 'launcher-tile';
      tile.title = folder.path;
      const icon = document.createElement('span');
      icon.className = 'launcher-tile-icon';
      icon.textContent = '\u{1F4C1}';
      const name = document.createElement('span');
      name.className = 'launcher-tile-name';
      name.textContent = folder.name;
      tile.appendChild(icon);
      tile.appendChild(name);
      tile.addEventListener('click', () => finish({ path: folder.path, name: folder.name }));
      gridEl.appendChild(tile);
    }
  }

  function finish(result) {
    overlay.classList.add('hidden');
    const r = resolveCurrent;
    resolveCurrent = null;
    if (r) r(result);
  }

  return {
    init,
    pickWorkspaceFolder,
    getAgentLaunch: (type) => LauncherAgents.getAgentLaunch(type),
    AGENTS: LauncherAgents.AGENTS,
  };
})();
```

- [ ] **Step 2: Write the styles**

Create `renderer/features/launcher/launcher.styles.css` (reuses the existing `.modal-overlay` / `.modal-dialog` / `.modal-title` / `.modal-actions` / `.modal-btn` from the naming modal):

```css
.launcher-dialog {
  min-width: 420px;
  max-width: 640px;
}

.launcher-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  margin: 12px 0;
}

.launcher-tile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface-raised, #1a1a1a);
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.launcher-tile:hover { border-color: var(--brand, #c0392b); }
.launcher-tile-icon { font-size: 16px; }
.launcher-tile-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.launcher-empty { grid-column: 1 / -1; opacity: 0.7; padding: 16px; text-align: center; }
```

- [ ] **Step 3: Include in index.html**

In `renderer/index.html`, add the stylesheet after the workspaces stylesheet (line 19):

```html
  <link rel="stylesheet" href="features/launcher/launcher.styles.css">
```

Add the scripts right after `shared/themes.js` (line 65), BEFORE `terminal.renderer.js`/`workspaces.renderer.js`/`tabs.renderer.js` (which consume them):

```html
  <script src="features/launcher/launcher.agents.js"></script>
  <script src="features/launcher/launcher.renderer.js"></script>
```

- [ ] **Step 4: Init in app.js**

In `renderer/app.js`, add `LauncherFeature.init();` as the FIRST init (before `WorkspacesFeature.init()`):

```js
(async function () {
  LauncherFeature.init();
  WorkspacesFeature.init();
  TabsFeature.init();
  TerminalFeature.init();
  BrowserFeature.init();
  RecentPathsFeature.init();
  ClipboardFeature.init();
  GridViewFeature.init();
  await TabsFeature.bootInitialTabs();
  await ConfigFeature.init();
  SidebarFeature.init();
  NamingFeature.init();
  DragFeature.init();
})();
```

- [ ] **Step 5: Manual smoke check**

Run: `npm start`
Expected: app launches exactly as before (modal exists in DOM but hidden; nothing visibly changed yet). In DevTools console, run `LauncherFeature.getAgentLaunch('codex')` → `{cmd: 'codex --yolo'}`.

- [ ] **Step 6: Commit**

```bash
git add renderer/features/launcher/launcher.renderer.js renderer/features/launcher/launcher.styles.css renderer/index.html renderer/app.js
git commit -m "feat(launcher): folder-picker modal + renderer API"
```

---

### Task 4: Terminal persists & relaunches agent launch info

So a restored agent tab respawns its agent in its folder. Backward-compatible: tabs created without launch info serialize `{}` and restore as a bare terminal (today's behavior).

**Files:**
- Modify: `renderer/features/terminal/terminal.renderer.js:5-13` (add map), `:21-30` (handler), `:53-123` (createTerminal), `:160-179` (closeTerminal)

- [ ] **Step 1: Add the launchInfo map**

In `terminal.renderer.js`, add to the module state (near line 5, with the other `Map`s):

```js
  const launchInfo = new Map();    // tabId -> { agentType, cwd, cmd } for serialize/relaunch
```

- [ ] **Step 2: Capture launch info on create**

In `createTerminal(tabId, opts)`, just after `const launchOptions = (opts && opts.launchOptions) || null;` (line 54), add:

```js
    if (launchOptions && (launchOptions.cmd || launchOptions.agentType)) {
      launchInfo.set(tabId, {
        agentType: launchOptions.agentType || null,
        cwd: launchOptions.cwd || null,
        cmd: launchOptions.cmd || null,
      });
    }
```

- [ ] **Step 3: Make serialize/restore use it**

Replace the type-handler registration body (lines 21-30) so `serialize` returns the stored info and `restore` feeds it back through `createTerminal`:

```js
    TabsFeature.registerType('terminal', {
      // opts: { payload?, launchOptions? }. launchOptions carries {cwd, cmd, agentType}.
      // serialize returns the persisted launch info so a restore can relaunch the
      // agent in its folder. Never stores anything when no agent was launched.
      create: (tabId, opts) => createTerminal(tabId, opts || {}),
      activate: switchTerminal,
      close: closeTerminal,
      serialize: (tabId) => launchInfo.get(tabId) || {},
      restore: (tabId, payload) => createTerminal(tabId, { launchOptions: payload || {} }),
    });
```

- [ ] **Step 4: Clean up on close**

In `closeTerminal(tabId)`, after `fitAddons.delete(tabId);` (line 164), add:

```js
    launchInfo.delete(tabId);
```

- [ ] **Step 5: Manual verification**

Run: `npm start`. In DevTools console:
```js
TabsFeature.addTab(undefined, undefined, { type: 'terminal', launchOptions: { cwd: 'C:\\Users\\Oskari', cmd: 'echo relaunch-test', agentType: 'claude' } });
```
Expected: a new tab spawns in `C:\Users\Oskari` and runs `echo relaunch-test`. Then close & reopen the app — the restored tab should re-run `echo relaunch-test` in the same folder. (After Task 7 this path is driven by the UI; here it's a manual console check.)

- [ ] **Step 6: Commit**

```bash
git add renderer/features/terminal/terminal.renderer.js
git commit -m "feat(terminal): persist agent launch info so restores relaunch the agent"
```

---

### Task 5: Persistence schema v3 (wipe old state, folder field, zero-workspace default)

**Files:**
- Modify: `renderer/features/tabs/tabs.state.js:1-70` (defaultEmpty, repairWorkspace, migrate)
- Test: `renderer/features/tabs/tabs.state.test.js` (rewrite cases for v3)

- [ ] **Step 1: Rewrite the test for v3**

Replace the whole body of `renderer/features/tabs/tabs.state.test.js` with:

```js
'use strict';

const assert = require('assert');
const { migrate, defaultEmpty } = require('./tabs.state.js');

(function main() {
  // 1. defaultEmpty is v3 with ZERO workspaces (first-launch empty state)
  {
    const out = defaultEmpty();
    assert.strictEqual(out.version, 3);
    assert.deepStrictEqual(out.workspaces, []);
    assert.strictEqual(out.activeWorkspaceId, null);
    assert.strictEqual(out.nextWorkspaceCounter, 1);
  }

  // 2. Legacy v1 (flat array) is discarded -> empty v3
  {
    const legacy = [{ type: 'terminal', customName: 'Build', theme: 'crimson', payload: null }];
    const out = migrate(legacy);
    assert.strictEqual(out.version, 3);
    assert.deepStrictEqual(out.workspaces, []);
  }

  // 3. Legacy v2 object is discarded -> empty v3 (start fresh)
  {
    const v2 = {
      version: 2,
      workspaces: [{ id: 'ws-1', name: 'Alpha', color: 'mint', activeTabId: null, tabs: [] }],
      activeWorkspaceId: 'ws-1',
      nextWorkspaceCounter: 2,
    };
    const out = migrate(v2);
    assert.strictEqual(out.version, 3);
    assert.deepStrictEqual(out.workspaces, []);
  }

  // 4. Valid v3 passes through, preserving the folder field
  {
    const v3 = {
      version: 3,
      workspaces: [
        { id: 'ws-1', name: 'EZvibes', color: 'mint', folder: 'C:\\Users\\Oskari\\Documents\\EZvibes', activeTabId: 'tab-2', tabs: [] },
      ],
      activeWorkspaceId: 'ws-1',
      nextWorkspaceCounter: 2,
    };
    const out = migrate(v3);
    assert.deepStrictEqual(out, v3);
  }

  // 5. Corrupt v3 workspace gets repaired (folder defaults to null)
  {
    const corrupt = { version: 3, workspaces: [{ id: 'ws-1', tabs: [] }], activeWorkspaceId: 'ws-1', nextWorkspaceCounter: 2 };
    const out = migrate(corrupt);
    assert.strictEqual(out.workspaces[0].name, 'Workspace 1');
    assert.strictEqual(out.workspaces[0].folder, null);
    assert.strictEqual(out.workspaces[0].color, null);
  }

  // 6. null / undefined / {} -> empty v3
  for (const input of [null, undefined, {}]) {
    const out = migrate(input);
    assert.strictEqual(out.version, 3);
    assert.deepStrictEqual(out.workspaces, []);
    assert.strictEqual(out.activeWorkspaceId, null);
  }

  console.log('PASS: tabs.state.test.js (v3 migration cases)');
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node renderer/features/tabs/tabs.state.test.js`
Expected: FAIL — first assertion (`out.version` is `2`, not `3`).

- [ ] **Step 3: Implement v3**

In `renderer/features/tabs/tabs.state.js`, update the header comment's schema line to `version: 3`, then replace `defaultEmpty`, `repairWorkspace`, and `migrate`:

```js
  function defaultEmpty() {
    return {
      version: 3,
      workspaces: [],
      activeWorkspaceId: null,
      nextWorkspaceCounter: 1,
    };
  }

  function repairWorkspace(ws, index) {
    return {
      id: ws.id || ('ws-' + (index + 1)),
      name: ws.name || ('Workspace ' + (index + 1)),
      color: ws.color == null ? null : ws.color,
      folder: typeof ws.folder === 'string' ? ws.folder : null,
      activeTabId: ws.activeTabId == null ? null : ws.activeTabId,
      tabs: Array.isArray(ws.tabs) ? ws.tabs : [],
    };
  }

  function migrate(raw) {
    // Only schema v3 is supported. Anything else (legacy v1 array, v2 object,
    // null, garbage) is discarded — "start fresh" into the empty state.
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultEmpty();
    if (raw.version !== 3 || !Array.isArray(raw.workspaces)) return defaultEmpty();

    const workspaces = raw.workspaces.map(repairWorkspace);
    const maxIndex = workspaces.reduce((acc, ws) => {
      const m = /^ws-(\d+)$/.exec(ws.id);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 0);
    const activeWorkspaceId =
      raw.activeWorkspaceId && workspaces.some((ws) => ws.id === raw.activeWorkspaceId)
        ? raw.activeWorkspaceId
        : (workspaces[0] ? workspaces[0].id : null);
    const nextWorkspaceCounter = Math.max(
      typeof raw.nextWorkspaceCounter === 'number' ? raw.nextWorkspaceCounter : 0,
      maxIndex + 1,
      1
    );
    return { version: 3, workspaces, activeWorkspaceId, nextWorkspaceCounter };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node renderer/features/tabs/tabs.state.test.js`
Expected: `PASS: tabs.state.test.js (v3 migration cases)`.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/tabs/tabs.state.js renderer/features/tabs/tabs.state.test.js
git commit -m "feat(tabs): schema v3 — wipe legacy state, add workspace folder, zero-workspace default"
```

---

### Task 6: Tabs — agent `+` menu, `openAgentTab`, Ctrl+T, and fallbacks

**Files:**
- Modify: `renderer/features/tabs/tabs.renderer.js` (add menu + `openAgentTab`; lines `50` Ctrl+T, `59` guest-new, `107-119` add button, `420-428` empty fallback, `655-658` last-tab fallback, `128-166` bootInitialTabs, public surface `922-935`)
- Modify: `renderer/features/tabs/tabs.styles.css` (menu styles)

- [ ] **Step 1: Add `openAgentTab` and the `+` menu builder**

In `tabs.renderer.js`, add a module-level `let addMenu = null;` next to the other `let` declarations (near line 20). Then add these functions (place them just after `addTab` ends, ~line 568):

```js
  // Opens a new tab for an agent type in the given (or active-workspace) folder.
  // 'claude'/'codex' spawn a terminal running the agent; 'brave' opens a browser tab.
  function openAgentTab(agentType, opts) {
    opts = opts || {};
    if (agentType === 'brave') {
      addTab(undefined, undefined, { type: 'browser' });
      return;
    }
    const launch = LauncherFeature.getAgentLaunch(agentType);
    if (!launch) return;
    let cwd = opts.cwd;
    if (!cwd && typeof WorkspacesFeature !== 'undefined' && WorkspacesFeature.getActiveWorkspace) {
      const ws = WorkspacesFeature.getActiveWorkspace();
      cwd = ws && ws.folder ? ws.folder : undefined;
    }
    addTab(undefined, undefined, {
      type: 'terminal',
      launchOptions: { cwd, cmd: launch.cmd, agentType },
    });
  }

  function buildAddMenu() {
    addMenu = document.createElement('div');
    addMenu.className = 'tab-add-menu hidden';
    for (const agent of LauncherFeature.AGENTS) {
      const item = document.createElement('button');
      item.className = 'tab-add-menu-item';
      item.textContent = agent.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAddMenu();
        openAgentTab(agent.type, {});
      });
      addMenu.appendChild(item);
    }
    document.body.appendChild(addMenu);
    document.addEventListener('click', () => closeAddMenu());
  }

  function showAddMenu() {
    if (!addMenu) return;
    addMenu.classList.remove('hidden');
    const rect = addButton.getBoundingClientRect();
    addMenu.style.top = (rect.bottom + 4) + 'px';
    const left = Math.min(rect.left, window.innerWidth - addMenu.offsetWidth - 4);
    addMenu.style.left = Math.max(4, left) + 'px';
  }

  function closeAddMenu() {
    if (addMenu) addMenu.classList.add('hidden');
  }
```

- [ ] **Step 2: Wire the `+` button to the menu (replace left-click + remove right-click)**

In `setupTabBar()`, replace the add-button event wiring (lines 113-118):

```js
    addButton.addEventListener('click', () => addTab());
    addButton.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addTab(undefined, undefined, { type: 'browser' });
    });
```

with:

```js
    addButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (addMenu && !addMenu.classList.contains('hidden')) { closeAddMenu(); return; }
      showAddMenu();
    });
```

Update the add-button title (line 111):

```js
    addButton.title = 'New tab — Claude, Codex, or Brave';
```

Add `buildAddMenu();` at the end of `setupTabBar()`, right after `buildContextMenu();` (line 124):

```js
    buildAddMenu();
```

- [ ] **Step 3: Make Ctrl+T and guest-new open a Claude tab**

In `init()`, change the tab-new handler (line 50):

```js
    window.terminalAPI.onTabNew(() => openAgentTab('claude', {}));
```

And in the `onBrowserGuestKeyTabAction` switch, change the `'new'` case (line 59):

```js
        case 'new': openAgentTab('claude', {}); break;
```

- [ ] **Step 4: Swap the empty-workspace and last-tab fallbacks to Claude**

In `setActiveWorkspaceContext`, find the activation block (lines 419-429) and drop the auto-create `else` branch (Task 7 makes workspace creation explicitly add the first Claude tab). OLD:

```js
    if (targetTabId) {
      activateTab(targetTabId);
    } else {
      // No tabs in this workspace — create a default one.
      addTab();
    }
    updateScrollButtons();
```

NEW:

```js
    if (targetTabId) {
      activateTab(targetTabId);
    }
    updateScrollButtons();
```

In `closeTab`, find the last-tab fallback (lines 655-659). OLD:

```js
    if (tabOrder.length === 0) {
      addTab();
      saveTabState();
      return;
    }
```

NEW — reopen Claude when a workspace is still active, but NOT when the workspace itself is being closed (signalled by a null active workspace; see Task 7 Step 5):

```js
    if (tabOrder.length === 0) {
      const hasActiveWs = typeof WorkspacesFeature !== 'undefined'
        && WorkspacesFeature.getActiveWorkspaceId
        && WorkspacesFeature.getActiveWorkspaceId();
      if (hasActiveWs) openAgentTab('claude', {});
      saveTabState();
      return;
    }
```

- [ ] **Step 5: Make bootInitialTabs zero-workspace aware**

Replace the body of `bootInitialTabs` (lines 128-166) with:

```js
  async function bootInitialTabs() {
    const saved = await TabState.load();          // v3 object (post-migration)
    WorkspacesFeature.bootFromState(saved);
    const activeWs = WorkspacesFeature.getActiveWorkspace();   // null when zero workspaces

    let coldLaunch = null;
    if (window.terminalAPI && typeof window.terminalAPI.appRendererReady === 'function') {
      try { coldLaunch = await window.terminalAPI.appRendererReady(); } catch { coldLaunch = null; }
    }

    if (activeWs) {
      isRestoring = true;
      const restoreEntries = activeWs.tabs.slice();
      for (const entry of restoreEntries) {
        addTab(entry.customName, entry.theme, {
          type: entry.type || 'terminal',
          payload: entry.payload || null,
          restoring: true,
        });
      }
      isRestoring = false;
      activeWs.tabs = activeWs.tabs.filter((t) => t.tabId && !isStaleTabId(t.tabId));
    }

    if (coldLaunch && (coldLaunch.cwd || coldLaunch.cmd)) {
      // External (Explorer-emulator) launch. Ensure a workspace owns the tab.
      if (!WorkspacesFeature.getActiveWorkspace() && WorkspacesFeature.addFromPath) {
        WorkspacesFeature.addFromPath(coldLaunch.cwd);
      }
      addTab(undefined, undefined, { type: 'terminal', launchOptions: coldLaunch });
    } else if (activeWs && activeWs.tabs.length === 0) {
      openAgentTab('claude', {});
    }
    saveTabState();
  }
```

- [ ] **Step 6: Export `openAgentTab`**

In the returned object (lines 922-935), add `openAgentTab,` to the public surface.

- [ ] **Step 7: Add menu styles**

Append to `renderer/features/tabs/tabs.styles.css` (mirrors `.tab-context-menu`):

```css
.tab-add-menu {
  position: fixed;
  min-width: 150px;
  background: var(--surface-raised, #1a1a1a);
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  padding: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.tab-add-menu.hidden { display: none; }

.tab-add-menu-item {
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
}

.tab-add-menu-item:hover { background: var(--brand, #c0392b); }
```

- [ ] **Step 8: Manual verification**

Run: `npm start`. Click the top-right `+` → a menu with **New Claude tab / New Codex tab / New Brave tab** appears. Click "New Codex tab" → a tab opens running `codex --yolo` (in your home dir for now — folders arrive in Task 7). Press `Ctrl+T` → a Claude tab opens. Right-click `+` → nothing happens (browser shortcut removed).

- [ ] **Step 9: Commit**

```bash
git add renderer/features/tabs/tabs.renderer.js renderer/features/tabs/tabs.styles.css
git commit -m "feat(tabs): + opens Claude/Codex/Brave menu; openAgentTab; folder-aware fallbacks"
```

---

### Task 7: Workspaces — folder-bound creation, auto-name, empty state, close-to-empty

After this task the full new behavior is live.

**Files:**
- Modify: `renderer/features/workspaces/workspaces.renderer.js` (init, add/createWorkspace/addFromPath, close, serialize, bootFromState, empty-state)
- Modify: `renderer/features/workspaces/workspaces.styles.css` (empty-state)
- Modify: `renderer/index.html:22-24` (empty-state DOM)

- [ ] **Step 1: Add the empty-state DOM**

In `renderer/index.html`, inside `<div id="app">`, add the empty-state overlay right after the `#terminal-container` div (after line 24):

```html
    <div id="workspace-empty-state" class="hidden">
      <div class="empty-state-card">
        <div class="empty-state-title">No workspaces yet</div>
        <div class="empty-state-sub">Create a workspace to pick a folder and start coding.</div>
        <button id="empty-state-create" class="modal-btn modal-btn-primary">Create workspace</button>
      </div>
    </div>
```

- [ ] **Step 2: Add a folder-name helper and the workspace-creation core**

In `workspaces.renderer.js`, add a helper near the top of the IIFE (after the `PALETTE` const, ~line 39):

```js
  function baseName(folderPath) {
    if (!folderPath) return 'Workspace';
    const parts = String(folderPath).replace(/[\\/]+$/, '').split(/[\\/]/);
    return parts[parts.length - 1] || folderPath;
  }
```

Replace the existing `add()` (lines 147-155) with the picker-driven async version plus a non-prompting core used by external launches:

```js
  function createWorkspace(folderPath) {
    const id = 'ws-' + state.nextCounter++;
    const ws = { id, name: baseName(folderPath), color: null, folder: folderPath || null, activeTabId: null, tabs: [] };
    state.workspaces.push(ws);
    renderRail();
    for (const cb of onAddedHooks) { try { cb(id); } catch {} }
    activate(id);                 // switches context; new ws has no tabs yet
    return id;
  }

  let adding = false;
  async function add() {
    if (adding) return null;
    adding = true;
    try {
      const picked = await LauncherFeature.pickWorkspaceFolder();
      if (!picked) return null;   // cancelled — create nothing
      const id = createWorkspace(picked.path);
      // First tab is Claude, already running in the chosen folder.
      if (typeof TabsFeature !== 'undefined' && TabsFeature.openAgentTab) {
        TabsFeature.openAgentTab('claude', { cwd: picked.path });
      }
      return id;
    } finally {
      adding = false;
    }
  }

  function addFromPath(folderPath) {
    if (!folderPath) return null;
    return createWorkspace(folderPath);   // caller opens the tab (external launch path)
  }
```

- [ ] **Step 3: Add folder to serialize (v3)**

Replace `serialize()` (lines 233-246):

```js
  function serialize() {
    return {
      version: 3,
      workspaces: state.workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        color: ws.color,
        folder: ws.folder || null,
        activeTabId: ws.activeTabId,
        tabs: ws.tabs.slice(),
      })),
      activeWorkspaceId: state.activeWorkspaceId,
      nextWorkspaceCounter: state.nextCounter,
    };
  }
```

- [ ] **Step 4: Wire the empty-state and toggle it on changes**

In `init()`, after `buildContextMenu();` (line 54), wire the empty-state create button and do an initial toggle:

```js
    const emptyCreateBtn = document.getElementById('empty-state-create');
    if (emptyCreateBtn) emptyCreateBtn.addEventListener('click', () => add());
    updateEmptyState();
```

Add the toggle function (near `renderRail`):

```js
  function updateEmptyState() {
    const el = document.getElementById('workspace-empty-state');
    if (el) el.classList.toggle('hidden', state.workspaces.length > 0);
  }
```

Call `updateEmptyState();` at the end of `renderRail()` (after the `forEach`, line 117) and at the end of `bootFromState()` (after `renderRail();`, line 87).

- [ ] **Step 5: Close-to-empty instead of auto-recreate**

Replace the tail of `close()` (lines 167-185, from the active-fallback block through the end) with:

```js
    const goingEmpty = state.workspaces.filter((w) => w.id !== wsId).length === 0;

    if (!goingEmpty && wsId === state.activeWorkspaceId) {
      const idx = state.workspaces.findIndex((w) => w.id === wsId);
      const fallback = state.workspaces[idx + 1] || state.workspaces[idx - 1] || null;
      if (fallback) activate(fallback.id);
    }

    if (goingEmpty) {
      // Null the active workspace BEFORE closing tabs so TabsFeature.closeTab's
      // "last tab" fallback does NOT auto-open a Claude tab (see Task 6 Step 4).
      state.activeWorkspaceId = null;
    }

    for (const t of ws.tabs.slice()) {
      if (t.tabId && typeof TabsFeature !== 'undefined' && TabsFeature.closeTab) {
        TabsFeature.closeTab(t.tabId);
      }
    }

    state.workspaces = state.workspaces.filter((w) => w.id !== wsId);
    renderRail();                 // also refreshes the empty state
    updateEmptyState();
    for (const cb of onRemovedHooks) { try { cb(wsId); } catch {} }
    if (typeof TabsFeature !== 'undefined' && TabsFeature.requestSave) TabsFeature.requestSave();
```

- [ ] **Step 6: Export `addFromPath`**

In the returned object (lines 376-382), add `addFromPath,` next to `add`.

- [ ] **Step 7: Empty-state styles**

Append to `renderer/features/workspaces/workspaces.styles.css`:

```css
#workspace-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface, #0a0a0a);
  z-index: 50;
}

#workspace-empty-state.hidden { display: none; }

.empty-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 40px;
  border: 1px solid var(--border, #333);
  border-radius: 10px;
  background: var(--surface-raised, #1a1a1a);
}

.empty-state-title { font-size: 18px; font-weight: 600; }
.empty-state-sub { opacity: 0.7; font-size: 13px; }
```

> Note: `#workspace-empty-state` uses `position: absolute`, so confirm `#app` (or its relevant ancestor) is a positioned container. If the overlay covers the whole window instead of the terminal area, add `position: relative` to `#terminal-container` in `base.styles.css` — but check first; do not add it blindly.

- [ ] **Step 8: Manual verification (the big one)**

Run: `npm start`.
1. On first launch the **"No workspaces yet"** empty state shows. Click **Create workspace** → native folder dialog (first time only) → pick a parent → the subfolder grid (Terminal118) appears.
2. Pick a subfolder → a workspace named after it appears in the rail, and its first tab is **Claude running in that folder** (no `cd` line).
3. Click `+` → **New Codex tab** → Codex starts in the same folder.
4. Create a second workspace (rail `+`) in a different folder → its Claude runs in *that* folder.
5. Close a workspace (right-click → Close) with >1 remaining → switches to a neighbor. Close the last workspace → back to the empty state.
6. Restart the app → workspaces + tabs restore, each agent relaunching in its folder.

- [ ] **Step 9: Commit**

```bash
git add renderer/features/workspaces/workspaces.renderer.js renderer/features/workspaces/workspaces.styles.css renderer/index.html
git commit -m "feat(workspaces): folder-bound creation, auto-name, empty state, close-to-empty"
```

---

### Task 8: Remove the Recent-Paths feature

**Files:**
- Delete: `renderer/features/recent-paths/recent-paths.renderer.js`, `renderer/features/recent-paths/recent-paths.styles.css`
- Modify: `renderer/app.js:6` (remove init)
- Modify: `renderer/index.html:16` (css), `:76` (script)
- Modify: `renderer/features/grid-view/grid-view.renderer.js:4` (comment), `:151-153`, `:197-199` (remove setSuppressed)

- [ ] **Step 1: Delete the feature files**

```bash
git rm renderer/features/recent-paths/recent-paths.renderer.js renderer/features/recent-paths/recent-paths.styles.css
```

- [ ] **Step 2: Remove the init call**

In `renderer/app.js`, delete the line `  RecentPathsFeature.init();` (line 6).

- [ ] **Step 3: Remove the index.html references**

In `renderer/index.html`, delete the stylesheet link (line 16) and the script tag (line 76) for recent-paths.

- [ ] **Step 4: Remove the GridView dependency**

In `renderer/features/grid-view/grid-view.renderer.js`, delete BOTH `RecentPathsFeature.setSuppressed` blocks:

Lines 151-153 (in the enter-grid path):
```js
    if (typeof RecentPathsFeature !== 'undefined' && RecentPathsFeature.setSuppressed) {
      RecentPathsFeature.setSuppressed(true);
    }
```

Lines 197-199 (in `exitGrid`):
```js
    if (typeof RecentPathsFeature !== 'undefined' && RecentPathsFeature.setSuppressed) {
      RecentPathsFeature.setSuppressed(false);
    }
```

Also update the header comment (line 4) to drop the `RecentPathsFeature (setSuppressed)` dependency line.

- [ ] **Step 5: Manual verification**

Run: `npm start`. App launches with no console errors. Open a tab and click into it — the old "recent paths" popup no longer appears. Toggle grid view (Ctrl+Shift+G) on/off — no errors.

- [ ] **Step 6: Commit**

```bash
git add -A renderer/features/recent-paths renderer/app.js renderer/index.html renderer/features/grid-view/grid-view.renderer.js
git commit -m "refactor: remove Recent-Paths feature (obsolete under folder-bound workspaces)"
```

---

### Task 9: Update project documentation

**Files:**
- Modify: `CLAUDE.md` (new Launcher section + seam note)
- Modify: `FEATURE-MAP.md` (add Launcher; remove Recent Paths; update Tabs/Workspaces/Grid View/Terminal/Config; note schema v3)
- Create: `.claude/rules/launcher.md`
- Modify: `.claude/rules/workspaces.md`, `.claude/rules/grid-view.md`, `.claude/rules/tabs.md`, `.claude/rules/terminal.md`
- Delete: `.claude/rules/recent-paths.md`

- [ ] **Step 1: Create the launcher rule**

Create `.claude/rules/launcher.md`:

```markdown
You are editing the LAUNCHER feature. Your files:
- `src/main/features/launcher/launcher.main.js` (root storage in config.launcher.rootFolder; subfolder listing; native folder dialog)
- `renderer/features/launcher/launcher.agents.js` (pure agent→command map; dual-exported for node:test)
- `renderer/features/launcher/launcher.renderer.js` (the folder-picker modal; public API)
- `renderer/features/launcher/launcher.styles.css`

IPC channels owned (all `handle`): `launcher:get-root`, `launcher:choose-root`, `launcher:list-folders`.

Public renderer API (`LauncherFeature`): `init()`, `async pickWorkspaceFolder() -> {path,name}|null`, `getAgentLaunch(type) -> {cmd}|null`, `AGENTS`.

Depends on: `src/main/shared/config.js` (rootFolder under `config.launcher`).
Consumed by: WorkspacesFeature (`pickWorkspaceFolder`), TabsFeature (`getAgentLaunch`, `AGENTS`).

Key invariants:
- Agent commands live ONLY in `launcher.agents.js`. Do not hardcode them elsewhere.
- `pickWorkspaceFolder()` resolves `null` on cancel (including cancelling the first-time root dialog) — callers must treat null as "create nothing".
- Subfolders-only, flat (no drill-down). The native dialog is used solely to set/change the root.

DO NOT edit files from other features.
```

- [ ] **Step 2: Update FEATURE-MAP.md**

Add a `## Launcher` section (files, IPC, depends/consumed, storage `config.launcher.rootFolder`). Delete the `## Recent Paths` section. In `## Tabs`, note `openAgentTab(agentType, {cwd})`, the `+` agent menu, and terminal-tab payload `{agentType,cwd,cmd}`. In `## Workspaces`, note `folder` field, async `add()`, `addFromPath()`, the empty state, and schema v3. In `## Terminal`, note that the `terminal` type serializes `{agentType,cwd,cmd}` and relaunches on restore. In `## Grid View`, drop the RecentPathsFeature dependency. In `## Config`, note the new `launcher.rootFolder` key.

- [ ] **Step 3: Update CLAUDE.md**

Add a `## Launcher (cross-cutting integration)` section summarizing: folder-bound workspaces, the `launcher` feature, the seam (`Workspaces → Launcher/Tabs`, `Tabs → Launcher/Workspaces`), schema v3 wipe of legacy state, and the agent commands. Update the existing Workspaces section: `Ctrl+Shift+T` now opens the folder picker; closing the last workspace shows the empty state (no auto-recreate).

- [ ] **Step 4: Update the touched rule files**

- `.claude/rules/workspaces.md`: async `add()` (picker-driven) + `addFromPath()`; `folder` field; "always at least one workspace" invariant REPLACED by "zero workspaces → empty state"; depends on `LauncherFeature.pickWorkspaceFolder` and `TabsFeature.openAgentTab`.
- `.claude/rules/grid-view.md`: remove the `RecentPathsFeature.setSuppressed` dependency line.
- `.claude/rules/tabs.md`: `+` opens the Claude/Codex/Brave menu (right-click browser shortcut removed); `openAgentTab`; terminal payload now `{agentType,cwd,cmd}`; depends on `LauncherFeature`.
- `.claude/rules/terminal.md`: the `terminal` type now `serialize`s `{agentType,cwd,cmd}` and `restore`s by relaunching via `createTerminal`.
- Delete `.claude/rules/recent-paths.md`:

```bash
git rm .claude/rules/recent-paths.md
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md FEATURE-MAP.md .claude/rules
git commit -m "docs: document launcher feature, schema v3, and remove recent-paths references"
```

---

### Task 10: Final end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run all unit tests**

```bash
node --test renderer/features/launcher/launcher.agents.test.js
node --test src/main/features/launcher/launcher.main.test.js
node --test src/main/shared/argv.test.js
node renderer/features/tabs/tabs.state.test.js
```
Expected: all pass.

- [ ] **Step 2: Fresh-state walkthrough**

Delete (or rename) `~/.yourterm/config.json`'s `tabState`/`launcher` keys OR just rely on the v3 wipe, then `npm start` and verify the full spec flow:
- Empty state → Create workspace → native dialog sets root → subfolder grid.
- Pick folder → workspace auto-named → first tab is Claude in that folder (no `cd` line, no bare prompt).
- `+` menu → Codex/Brave each open correctly (Codex in folder; Brave is a browser tab).
- Second workspace in another folder → its agents run in that folder.
- `Ctrl+Shift+T` opens the picker; `Ctrl+T` opens a Claude tab in the active folder.
- Close last workspace → empty state. Restart → restore relaunches every agent in its folder.

- [ ] **Step 3: Confirm no regressions**

Grid view (Ctrl+Shift+G) tiles the active workspace; drag-from-sidebar still targets the right tile; theming/rename/color on tabs and workspaces still work; Explorer-emulator launch (`electron . --cwd "<path>" --cmd "claude"`) opens a workspace+tab at that path.

- [ ] **Step 4: Use the finishing-a-development-branch skill**

Invoke `superpowers:finishing-a-development-branch` to decide merge/PR/cleanup.
