# Browser Tab Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third tab kind — an in-app Chromium browser — to every per-folder session window, alongside the existing Claude and Codex terminal tabs. Triggered via a new split-button dropdown next to the `+`, with a globe-glyph chip, hardened `<webview>` guest, URL validation, popup interception, and back/fwd/reload/URL-bar toolbar.

**Architecture:** Introduce a minimal **tab-type** concept (`'terminal' | 'browser'`) layered onto the existing tab model. Terminal tabs keep their `agent` enum (`claude` / `codex`) unchanged. Browser tabs add a `<webview partition="persist:browser-tabs">` panel with toolbar in the same `.terminal-pocket` container slot. Trigger uses a Windows-Terminal-style split-button (`+` with a `˅` chevron). Security mirrors the reference implementation in `browser.md`: main-process `will-attach-webview` clamps + `did-attach-webview` popup denial + strict http/https URL allowlist.

**Tech Stack:** Electron 33, vanilla JS, `<webview>` tag (built-in), Brave Search as default landing/search engine. No new npm dependencies.

**Reference:** `browser.md` (sibling project Terminal-Emulator). This plan adapts that pattern to EZvibes's single-IIFE renderer and single-file `main.js`.

**Out of scope for MVP (explicit follow-ups at end):** persistence of tab URLs across app restart; keyboard chord forwarding from inside the guest; DevTools toggle; per-tab session isolation; full `AgentProfile` refactor (audit recommendation).

**Audit findings this plan ALSO incidentally fixes:**
- Right-click on `+` undiscoverability (Nielsen split-button violation) → fixed by the new chevron dropdown (Task 11).
- Orphan-chip-on-`createTerminal`-failure → fixed by Task 6's rollback path (which `createBrowserTab` will share).
- Color-only agent differentiation (WCAG 1.4.1) → Task 12 adds glyphs to all three types, not just Browser.

---

## File Structure

This plan keeps with EZvibes's existing structure (single `main.js`, single renderer IIFE). No new files are introduced — all changes are in-place, demarcated by `// === BROWSER ===` section comments so the new code is greppable and removable if the feature is rolled back.

| File | Role after this plan |
|---|---|
| `main.js` | + URL validation helpers, + guest-mapping Maps, + 4 `browser:*` IPC handlers, + `will-attach-webview` + `did-attach-webview` hooks, + `webviewTag: true` in BrowserWindow webPreferences |
| `preload.js` | + 5 contextBridge methods bridging the new `browser:*` channels |
| `renderer/app.js` | + tab-type concept on the tab object, + `buildBrowserTab` / `activateBrowserTab` / `closeBrowserTab`, + chevron split-button DOM + dropdown menu, + cross-type hide-others sweep in `activateTab`, + popup subscriber |
| `renderer/styles.css` | + `.browser-panel`, `.browser-toolbar`, `.browser-btn`, `.browser-url-input`, `.browser-webview`, `.browser-error-overlay`, `.tab-add-chevron`, `.tab-add-dropdown`, `.tab-add-dropdown-item`, `.folder-terminal-tab[data-type="browser"]`, glyph prefixes for all three types |
| `renderer/index.html` | No structural change (panel + chevron created at runtime). |
| `CLAUDE.md` | Update "Stack", "Runtime Model", "Current UX", "Known Limitations", "Cautions" sections to reflect browser tabs |

**Key invariants this plan adds (must not be regressed by later work):**
1. Every `<webview>` host runs in `partition="persist:browser-tabs"`, sandboxed, with `webSecurity=true`. The renderer cannot loosen this — main re-asserts in `will-attach-webview`.
2. Every popup (`window.open`, `<a target=_blank>`) returns `{ action: 'deny' }` from `setWindowOpenHandler` and is re-routed as a new in-app browser tab if the URL passes http/https validation.
3. Only `http:` and `https:` URLs are loaded; `javascript:`, `file:`, `data:`, `chrome:`, etc. are rejected at the helpers in `main.js`.
4. The `.terminal-pocket` container holds at most ONE panel type at a time, scoped to the active tab. The cross-type hide-others sweep in `activateTab` enforces this regardless of the previously-active tab's type.

---

## Task 1: Enable `<webview>` in the BrowserWindow

**Why:** `<webview>` is disabled by default in Electron since v5. Without `webviewTag: true`, the renderer's `<webview>` element renders as an inert div and `will-attach-webview` never fires. This must land first or nothing else in the plan works.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\main.js:115-131` (createWindow webPreferences block)

- [ ] **Step 1: Add `webviewTag: true` to webPreferences**

Edit `main.js` createWindow:

```js
function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 930,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#101312',
    show: false,
    title: 'EZvibes',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: true, // ← NEW: enables <webview> for browser-tab feature
    },
  });
  // ... rest unchanged
}
```

- [ ] **Step 2: Manual verification**

```powershell
cd C:\Users\Oskari\Documents\EZvibes
npm start
```

Open DevTools (Ctrl+Shift+I on any window we add later — for now, temporarily uncomment `win.webContents.openDevTools()` after `win.loadFile(...)`, then revert). In the console run:

```js
document.createElement('webview').tagName
```

Expected: `'WEBVIEW'`. If it returns `'DIV'` the flag did not take effect.

- [ ] **Step 3: Commit**

```powershell
git add main.js
git commit -m "main: enable webviewTag for browser-tab feature"
```

---

## Task 2: Add URL validation helpers in `main.js`

**Why:** Both the URL bar and the popup handler need to reject `javascript:`/`file:`/`data:` URLs. Reusable helpers keep the security boundary in one place.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\main.js` (add helpers near the top, after the `AGENT_COMMANDS` block at line 38-45)

- [ ] **Step 1: Add `validateUrl` and `canonicalizeUrlOrSearch`**

Insert after line 45 (after `AGENT_COMMANDS` / `resolveAgentCommand`):

```js
// === BROWSER ===
// Strict scheme allowlist: only http(s). Bare hosts (foo.com) are auto-promoted to https.
// Everything else (javascript:, file:, data:, chrome:, etc.) is rejected.
function validateUrl(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch (_) { /* fall through to bare-host promotion */ }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    try { return new URL('https://' + trimmed).toString(); } catch (_) { return null; }
  }
  return null;
}

// URL bar logic: valid URL → canonical; parses but bad scheme → null (silent reject);
// doesn't parse → wrap in Brave Search query.
function canonicalizeUrlOrSearch(input) {
  const valid = validateUrl(input);
  if (valid) return valid;
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  } catch (_) { /* not parseable as URL — fall through to search */ }
  return 'https://search.brave.com/search?q=' + encodeURIComponent(trimmed);
}
// === END BROWSER ===
```

- [ ] **Step 2: Manual verification (pure unit logic — paste into a Node REPL)**

```powershell
node -e "const v=(s)=>{if(typeof s!=='string')return null;const t=s.trim();if(!t)return null;try{const u=new URL(t);if(u.protocol==='http:'||u.protocol==='https:')return u.toString()}catch(_){};if(/^[\w.-]+\.[a-z]{2,}/i.test(t)){try{return new URL('https://'+t).toString()}catch(_){return null}};return null};console.log(v('example.com'),v('https://foo.com'),v('javascript:alert(1)'),v('file:///etc/passwd'),v(''),v('foo'))"
```

Expected output:
```
https://example.com/ https://foo.com/ null null null null
```

- [ ] **Step 3: Commit**

```powershell
git add main.js
git commit -m "main: add URL validation helpers (http/https allowlist + bare-host promote)"
```

---

## Task 3: Register the validation IPC handlers

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\main.js` (add two `ipcMain.handle` calls inside `registerIpc`, after the `clipboard:write` handler at line 238)

- [ ] **Step 1: Add IPC handlers**

In `registerIpc(mainWindow)`, insert after `ipcMain.handle('clipboard:write', ...)` at line 238 and before the closing `}`:

```js
  // === BROWSER ===
  ipcMain.handle('browser:validate-url', (_, input) => {
    const url = validateUrl(input);
    return url ? { ok: true, url } : { ok: false };
  });
  ipcMain.handle('browser:canonicalize-or-search', (_, input) => {
    const url = canonicalizeUrlOrSearch(input);
    return url ? { ok: true, url } : { ok: false };
  });
  // === END BROWSER ===
```

- [ ] **Step 2: Manual verification**

After `preload.js` is updated (Task 5) and `npm start` runs, in DevTools console:

```js
await window.ezvibes.browserValidateUrl('example.com')
// → { ok: true, url: 'https://example.com/' }
await window.ezvibes.browserCanonicalizeOrSearch('claude code agents')
// → { ok: true, url: 'https://search.brave.com/search?q=claude%20code%20agents' }
```

(Skip the verification step here if running ahead of Task 5; verify after Task 5 lands.)

- [ ] **Step 3: Commit**

```powershell
git add main.js
git commit -m "main: add browser:validate-url and browser:canonicalize-or-search IPC"
```

---

## Task 4: Add guest mapping + register/unregister IPC

**Why:** When a `<webview>` guest is created, the renderer doesn't know main's `webContentsId` ahead of time, and main doesn't know which renderer-side `tabId` owns which guest. A bidirectional Map populated at `dom-ready` time bridges this so future per-guest features (popup forwarding, key forwarding) can resolve a `tabId`.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\main.js` (add Maps near top + IPC listeners in `registerIpc`)

- [ ] **Step 1: Add module-scoped Maps**

Insert after the `const sessions = new Map();` line (currently line 8):

```js
const sessions = new Map();

// === BROWSER ===
const guestByContentsId = new Map();   // webContentsId → tabId
const tabIdByGuest = new Map();        // tabId → webContentsId
// === END BROWSER ===
```

- [ ] **Step 2: Add register/unregister IPC listeners**

Inside `registerIpc(mainWindow)`, append after the two handlers added in Task 3:

```js
  ipcMain.on('browser:register-guest', (_, payload) => {
    if (!payload || typeof payload.tabId !== 'string' || typeof payload.webContentsId !== 'number') return;
    guestByContentsId.set(payload.webContentsId, payload.tabId);
    tabIdByGuest.set(payload.tabId, payload.webContentsId);
  });
  ipcMain.on('browser:unregister-guest', (_, payload) => {
    if (!payload || typeof payload.tabId !== 'string') return;
    const wcId = tabIdByGuest.get(payload.tabId);
    if (typeof wcId === 'number') guestByContentsId.delete(wcId);
    tabIdByGuest.delete(payload.tabId);
  });
```

- [ ] **Step 3: Cleanup on `before-quit`**

Modify the existing `before-quit` block (currently line 247-254) to also clear the new Maps:

```js
app.on('before-quit', () => {
  for (const session of sessions.values()) {
    try { session.kill(); } catch {}
  }
  sessions.clear();
  guestByContentsId.clear();
  tabIdByGuest.clear();
});
```

- [ ] **Step 4: Commit**

```powershell
git add main.js
git commit -m "main: add guest webContents↔tabId mapping + register/unregister IPC"
```

---

## Task 5: Expose 5 new methods on the preload bridge

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\preload.js`

- [ ] **Step 1: Add methods to the contextBridge**

Replace the existing `contextBridge.exposeInMainWorld('ezvibes', { ... })` block with the version below (additions only — existing methods unchanged):

```js
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('ezvibes', {
  getInitialPath: () => ipcRenderer.invoke('app:initial-path'),
  getQuickPaths: () => ipcRenderer.invoke('app:quick-paths'),
  listDirectory: (folderPath) => ipcRenderer.invoke('fs:list-directory', folderPath),
  createTerminal: (payload) => ipcRenderer.invoke('terminal:create', payload),
  writeTerminal: (sessionId, data) => ipcRenderer.send('terminal:input', { sessionId, data }),
  resizeTerminal: (sessionId, cols, rows) => ipcRenderer.send('terminal:resize', { sessionId, cols, rows }),
  closeTerminal: (sessionId) => ipcRenderer.invoke('terminal:close', sessionId),
  onTerminalData: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('terminal:data', listener);
    return () => ipcRenderer.removeListener('terminal:data', listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('terminal:exit', listener);
    return () => ipcRenderer.removeListener('terminal:exit', listener);
  },
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // === BROWSER ===
  browserValidateUrl: (input) => ipcRenderer.invoke('browser:validate-url', input),
  browserCanonicalizeOrSearch: (input) => ipcRenderer.invoke('browser:canonicalize-or-search', input),
  browserRegisterGuest: (payload) => ipcRenderer.send('browser:register-guest', payload),
  browserUnregisterGuest: (payload) => ipcRenderer.send('browser:unregister-guest', payload),
  onBrowserNewTabFromPopup: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('browser:new-tab-from-popup', listener);
    return () => ipcRenderer.removeListener('browser:new-tab-from-popup', listener);
  },
  // === END BROWSER ===
});
```

- [ ] **Step 2: Manual verification**

```powershell
npm start
```

In DevTools console:

```js
typeof window.ezvibes.browserValidateUrl
// → 'function'
await window.ezvibes.browserValidateUrl('example.com')
// → { ok: true, url: 'https://example.com/' }
await window.ezvibes.browserValidateUrl('javascript:alert(1)')
// → { ok: false }
await window.ezvibes.browserCanonicalizeOrSearch('claude code')
// → { ok: true, url: 'https://search.brave.com/search?q=claude%20code' }
```

- [ ] **Step 3: Commit**

```powershell
git add preload.js
git commit -m "preload: expose 5 browser:* IPC methods to renderer"
```

---

## Task 6: Add tab-type concept + close-tab rollback in renderer

**Why:** Tabs currently carry only `agent` (`'claude' | 'codex'`). We need a parallel `type` field (`'terminal' | 'browser'`) so `createTab` can dispatch to two different build/close paths. Existing terminal tabs default to `type: 'terminal'`. While we're modifying `createTab`, fix the orphan-chip-on-failure bug surfaced in the audit by introducing a unified rollback path that the new browser-tab path will reuse.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\renderer\app.js` (lines around 658-680 `buildTab`, 779-832 `createTab`)

- [ ] **Step 1: Add `type` to `buildTab`**

In `buildTab(sessionWindow, terminalEl, agent)` around line 658, modify the signature and returned object:

```js
function buildTab(sessionWindow, terminalEl, agent, type) {
  // ... existing code that builds term, fitAddon, etc.
  return {
    id: sessionId,
    agent: agent === 'codex' ? 'codex' : 'claude',
    type: type === 'browser' ? 'browser' : 'terminal',  // ← NEW
    numericLabel: sessionWindow.nextTabNumber++,
    term,
    fitAddon,
    terminalEl,
    chipEl: null,
    customName: null,
    // ... any other existing fields preserved
  };
}
```

Callers update:
- Line 571 (first tab): `buildTab(sessionWindow, terminalEl, 'claude', 'terminal')`
- Line 790 (`createTab` call): `buildTab(sessionWindow, terminalEl, agent, 'terminal')`

- [ ] **Step 2: Extend `defaultTabLabel` for the browser case**

Replace `defaultTabLabel(tab)` at line 513:

```js
function defaultTabLabel(tab) {
  if (tab && tab.type === 'browser') {
    return tab.numericLabel === 1 ? 'BROWSER' : `BROWSER ${tab.numericLabel}`;
  }
  const agentName = (tab && tab.agent === 'codex') ? 'CODEX' : 'CLAUDE';
  return tab.numericLabel === 1 ? agentName : `${agentName} ${tab.numericLabel}`;
}
```

- [ ] **Step 3: Add the rollback helper (fixes orphan-chip audit finding)**

Insert near `createTab` (around line 779), before the function:

```js
// === BROWSER ===
// Used by failed createTab paths (both terminal and browser) to roll back
// chip + tab map + numericLabel so a failed create does not leave UI debris.
function rollbackTab(sessionWindow, tab) {
  if (tab && tab.chipEl && tab.chipEl.parentNode) tab.chipEl.parentNode.removeChild(tab.chipEl);
  if (tab && tab.terminalEl && tab.terminalEl.parentNode) tab.terminalEl.parentNode.removeChild(tab.terminalEl);
  if (tab) state.tabsById.delete(tab.id);
  if (sessionWindow) {
    sessionWindow.tabs = sessionWindow.tabs.filter((t) => t.id !== tab.id);
    sessionWindow.nextTabNumber = Math.max(1, sessionWindow.nextTabNumber - 1);
    if (sessionWindow.activeTabId === tab.id) {
      const next = sessionWindow.tabs[sessionWindow.tabs.length - 1];
      sessionWindow.activeTabId = next ? next.id : null;
    }
  }
}
// === END BROWSER ===
```

- [ ] **Step 4: Use `rollbackTab` in `createTab`'s error branch**

Modify the existing `createTab` error path (currently around line 822-832 in `renderer/app.js`):

```js
async function createTab(sessionWindow, options) {
  const opts = options || {};
  const agent = opts.agent === 'codex' ? 'codex' : 'claude';
  const agentLabel = agent === 'codex' ? 'Codex' : 'Claude';

  if (sessionWindow.addTabBtnEl) sessionWindow.addTabBtnEl.disabled = true;
  try {
    const terminalEl = document.createElement('div');
    terminalEl.className = 'terminal-host';
    sessionWindow.terminalPocketEl.appendChild(terminalEl);

    const tab = buildTab(sessionWindow, terminalEl, agent, 'terminal');
    sessionWindow.tabs.push(tab);
    state.tabsById.set(tab.id, tab);
    attachTabChip(sessionWindow, tab, { active: false });

    const result = await window.ezvibes.createTerminal({
      sessionId: tab.id,
      cwd: sessionWindow.folderPath,
      agent,
      cols: tab.term.cols,
      rows: tab.term.rows,
    });

    if (!result || !result.success) {
      logNarration(sessionWindow.folderPath, 'error', `Failed to start ${agentLabel}: ${(result && result.error) || 'unknown'}`);
      rollbackTab(sessionWindow, tab);
      return null;
    }

    activateTab(sessionWindow, tab.id);
    logNarration(sessionWindow.folderPath, 'tab-opened', `${agentLabel} tab opened`);
    return tab;
  } finally {
    if (sessionWindow.addTabBtnEl) sessionWindow.addTabBtnEl.disabled = false;
  }
}
```

(Note: this is the **shape** of the fix — preserve whatever existing helper-call names (`logNarration`, `activateTab`, `attachTabChip`) the current file uses; do NOT rename them. If a helper has a different name, use it as-is. Audit-confirmed file:line locations: `createTab` at app.js:779-800; rollback gap at app.js:822-832; in-flight guard absent at app.js:580-589.)

- [ ] **Step 5: Manual verification**

```powershell
npm start
```

1. Open a folder, launch Claude.
2. Click `+` rapidly 10 times. Expected: tab count grows by 10 with sequential `CLAUDE 2`…`CLAUDE 11`; no console errors; `+` is briefly disabled between clicks.
3. Temporarily make `terminal:create` always fail (`return { success: false, error: 'test' };` at `main.js:147`). Click `+`. Expected: no chip appears, no host appears, `nextTabNumber` does not increment, narration log shows an "error" entry only (no phantom "opened" entry). Revert the test edit.

- [ ] **Step 6: Commit**

```powershell
git add renderer/app.js
git commit -m "renderer: add tab.type field + rollback on createTerminal failure"
```

---

## Task 7: Add cross-type hide-others sweep in `activateTab`

**Why:** When the user switches from a terminal tab to a browser tab (or back), the previously-active *opposite-type* panel must be hidden. Each per-type `activate` only sweeps its own kind, so without a generic sweep both panels would remain visible during a cross-type switch.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\renderer\app.js` (the `activateTab` function around lines 690-734)

- [ ] **Step 1: Add the type-agnostic sweep**

Inside `activateTab(sessionWindow, tabId)`, BEFORE the per-type activation logic, add:

```js
function activateTab(sessionWindow, tabId) {
  if (!sessionWindow || sessionWindow.activeTabId === tabId) return; // existing guard
  const target = sessionWindow.tabs.find((t) => t.id === tabId);
  if (!target) return;

  // === BROWSER ===
  // Type-agnostic hide-others sweep: hide every other tab's content host
  // regardless of type so cross-type switches don't leave the prior panel visible.
  for (const t of sessionWindow.tabs) {
    if (t.id !== tabId && t.terminalEl) t.terminalEl.hidden = true;
  }
  if (target.terminalEl) target.terminalEl.hidden = false;
  // === END BROWSER ===

  // ... existing per-tab activation logic (chip is-active toggling, fit, focus, etc.)
}
```

(The existing terminal activation logic that toggles `chip.classList.add('is-active')`, runs `fitAfterStableLayout` etc. is preserved. We are inserting the visibility sweep, not replacing.)

- [ ] **Step 2: Manual verification**

After Task 9 (when browser tabs can actually be created), this is verifiable end-to-end. For now, regression-test the terminal-only case: open 3 terminal tabs, switch between them — no broken behavior.

- [ ] **Step 3: Commit**

```powershell
git add renderer/app.js
git commit -m "renderer: add cross-type hide-others sweep in activateTab"
```

---

## Task 8: Add the browser-tab build/activate/close functions

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\renderer\app.js` (add a new section, ideally right after the existing terminal-tab functions around line 800)

- [ ] **Step 1: Add `LANDING_URL` and Maps**

Near the top of the IIFE (around line 10, next to `state.tabsById`):

```js
// === BROWSER ===
const LANDING_URL = 'https://search.brave.com/';
const browserPanels = new Map();   // tabId → .browser-panel element
const browserWebviews = new Map(); // tabId → <webview>
const browserUrlBars = new Map();  // tabId → URL input element
const browserSaveTimers = new Map(); // tabId → debounce timer (no-op for MVP, reserved for persistence follow-up)
// === END BROWSER ===
```

- [ ] **Step 2: Add `buildBrowserTab`**

Insert after the existing terminal `createTab` function (around line 800):

```js
// === BROWSER ===
function buildBrowserTab(sessionWindow, opts) {
  const url = (opts && opts.url) || LANDING_URL;

  const panel = document.createElement('div');
  panel.className = 'browser-panel terminal-host'; // share .terminal-host slot so existing sweep applies
  panel.dataset.tabId = ''; // set below once we know tab.id
  panel.hidden = true;

  const toolbar = document.createElement('div');
  toolbar.className = 'browser-toolbar';
  toolbar.innerHTML =
    '<button type="button" class="browser-btn back" title="Back (Alt+Left)" disabled>&#x2190;</button>' +
    '<button type="button" class="browser-btn fwd"  title="Forward (Alt+Right)" disabled>&#x2192;</button>' +
    '<button type="button" class="browser-btn reload" title="Reload" disabled>&#x21BB;</button>' +
    '<input class="browser-url-input" type="text" spellcheck="false" aria-label="Address bar" />';
  panel.appendChild(toolbar);

  const webview = document.createElement('webview');
  webview.className = 'browser-webview';
  webview.setAttribute('partition', 'persist:browser-tabs');
  webview.setAttribute('allowpopups', '');
  webview.setAttribute('webpreferences', 'contextIsolation=yes,sandbox=yes,nodeIntegration=no');
  webview.setAttribute('src', url);
  panel.appendChild(webview);

  sessionWindow.terminalPocketEl.appendChild(panel);

  const tab = buildTab(sessionWindow, panel, 'claude', 'browser');
  // Note: agent='claude' is ignored for browser tabs (defaultTabLabel branches on type).
  // We still pass it because buildTab's signature requires it; future refactor to AgentProfile collapses both.
  panel.dataset.tabId = tab.id;

  browserPanels.set(tab.id, panel);
  browserWebviews.set(tab.id, webview);
  browserUrlBars.set(tab.id, toolbar.querySelector('.browser-url-input'));

  wireBrowserToolbar(tab.id, panel, webview);
  wireBrowserWebviewEvents(tab.id, webview);

  return tab;
}

function activateBrowserTab(tab) {
  const panel = browserPanels.get(tab.id);
  if (panel) panel.hidden = false;
  // No fit dance needed — webview sizes via CSS flex.
}

function closeBrowserTab(tab) {
  const panel = browserPanels.get(tab.id);
  const webview = browserWebviews.get(tab.id);
  if (webview) {
    try { window.ezvibes.browserUnregisterGuest({ tabId: tab.id }); } catch (_) {}
  }
  if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
  browserPanels.delete(tab.id);
  browserWebviews.delete(tab.id);
  browserUrlBars.delete(tab.id);
  const t = browserSaveTimers.get(tab.id);
  if (t) clearTimeout(t);
  browserSaveTimers.delete(tab.id);
}
// === END BROWSER ===
```

- [ ] **Step 3: Add `wireBrowserToolbar`**

Insert immediately after `closeBrowserTab`:

```js
function wireBrowserToolbar(tabId, panel, webview) {
  const back = panel.querySelector('.browser-btn.back');
  const fwd = panel.querySelector('.browser-btn.fwd');
  const reload = panel.querySelector('.browser-btn.reload');
  const urlBar = panel.querySelector('.browser-url-input');

  back.addEventListener('click', () => { try { webview.goBack(); } catch (_) {} });
  fwd.addEventListener('click', () => { try { webview.goForward(); } catch (_) {} });
  reload.addEventListener('click', () => { try { webview.reload(); } catch (_) {} });

  urlBar.addEventListener('focus', () => urlBar.select());
  urlBar.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const result = await window.ezvibes.browserCanonicalizeOrSearch(urlBar.value);
    if (result && result.ok) {
      try { webview.loadURL(result.url); } catch (_) {}
    }
  });
}

function refreshBrowserNavState(tabId) {
  const panel = browserPanels.get(tabId);
  const webview = browserWebviews.get(tabId);
  if (!panel || !webview) return;
  try {
    panel.querySelector('.browser-btn.back').disabled = !webview.canGoBack();
    panel.querySelector('.browser-btn.fwd').disabled = !webview.canGoForward();
  } catch (_) {}
}
```

- [ ] **Step 4: Add `wireBrowserWebviewEvents`**

Insert after `refreshBrowserNavState`:

```js
function wireBrowserWebviewEvents(tabId, webview) {
  webview.addEventListener('did-navigate', (e) => {
    const urlBar = browserUrlBars.get(tabId);
    if (urlBar && document.activeElement !== urlBar) urlBar.value = e.url;
    refreshBrowserNavState(tabId);
  });
  webview.addEventListener('did-navigate-in-page', (e) => {
    const urlBar = browserUrlBars.get(tabId);
    if (urlBar && document.activeElement !== urlBar) urlBar.value = e.url;
    refreshBrowserNavState(tabId);
  });
  webview.addEventListener('dom-ready', () => {
    const panel = browserPanels.get(tabId);
    if (panel) panel.querySelector('.browser-btn.reload').disabled = false;
    refreshBrowserNavState(tabId);
    try {
      const id = webview.getWebContentsId();
      window.ezvibes.browserRegisterGuest({ tabId, webContentsId: id });
    } catch (_) {}
  });
  webview.addEventListener('page-title-updated', (e) => {
    try {
      const title = String(e.title || '').trim().slice(0, 40);
      if (!title) return;
      const tab = state.tabsById.get(tabId);
      if (tab && !tab.customName) {
        tab.runtimeLabel = title;
        // Update chip label in place. Use whichever helper updates a chip's label text;
        // if none exists yet, set chip's .tab-label textContent directly.
        if (tab.chipEl) {
          const lbl = tab.chipEl.querySelector('.tab-label');
          if (lbl) lbl.textContent = title;
        }
      }
    } catch (_) {}
  });
  webview.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3) return; // ERR_ABORTED — cancelled nav, ignore
    if (e.isMainFrame === false) return; // subframe failure, ignore
    const panel = browserPanels.get(tabId);
    if (!panel) return;
    // Remove any prior overlay
    const prior = panel.querySelector('.browser-error-overlay');
    if (prior) prior.remove();
    const overlay = document.createElement('div');
    overlay.className = 'browser-error-overlay';
    overlay.innerHTML =
      '<div class="browser-error-title">Page failed to load</div>' +
      '<div class="browser-error-detail"></div>' +
      '<div class="browser-error-url"></div>';
    overlay.querySelector('.browser-error-detail').textContent = `${e.errorCode}: ${e.errorDescription || ''}`;
    overlay.querySelector('.browser-error-url').textContent = e.validatedURL || '';
    panel.appendChild(overlay);
  });
  webview.addEventListener('did-start-loading', () => {
    const panel = browserPanels.get(tabId);
    if (!panel) return;
    const overlay = panel.querySelector('.browser-error-overlay');
    if (overlay) overlay.remove();
  });
}
```

- [ ] **Step 5: Commit**

```powershell
git add renderer/app.js
git commit -m "renderer: add browser tab build/activate/close + toolbar + webview events"
```

---

## Task 9: Wire browser-tab dispatch into the existing tab creation entry points

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\renderer\app.js` (existing `createTab`, `activateTab`, `closeTab` paths)

- [ ] **Step 1: Add a `createBrowserTab` entry point**

Insert near `createTab` (around line 779):

```js
function createBrowserTab(sessionWindow, opts) {
  if (sessionWindow.addTabBtnEl) sessionWindow.addTabBtnEl.disabled = true;
  try {
    const tab = buildBrowserTab(sessionWindow, opts || {});
    sessionWindow.tabs.push(tab);
    state.tabsById.set(tab.id, tab);
    attachTabChip(sessionWindow, tab, { active: false });
    activateTab(sessionWindow, tab.id);
    logNarration(sessionWindow.folderPath, 'tab-opened', 'Browser tab opened');
    return tab;
  } finally {
    if (sessionWindow.addTabBtnEl) sessionWindow.addTabBtnEl.disabled = false;
  }
}
```

- [ ] **Step 2: Branch `activateTab`'s per-type call**

Find the per-type activation block inside `activateTab` (after the cross-type sweep from Task 7). Wrap the existing terminal-tab activation in a type check:

```js
  // ... after the cross-type sweep added in Task 7 ...
  if (target.type === 'browser') {
    activateBrowserTab(target);
  } else {
    // existing terminal activation: chip is-active toggle, fit cascade, focus terminal, etc.
    // Keep this block EXACTLY as it was — do not move terminal-specific calls.
  }
```

- [ ] **Step 3: Branch `closeTab`'s per-type teardown**

Find `closeTab` (around line 736-770). At the top of the function (after the lookup of `tab` and `sessionWindow`), add the type branch:

```js
function closeTab(tabId, opts) {
  const tab = state.tabsById.get(tabId);
  if (!tab) return;
  const sessionWindow = findSessionWindowForTab(tab); // or whatever helper already locates it

  if (tab.type === 'browser') {
    closeBrowserTab(tab);
    // ... continue with the existing close-chip + tabs-array splice + activate-neighbor logic
    // which is type-agnostic and stays as-is.
  } else {
    // Existing terminal-tab teardown:
    try { window.ezvibes.closeTerminal(tab.id); } catch (_) {}
    // ... existing logic, unchanged
  }

  // Then the existing type-agnostic post-close cleanup:
  // - remove chip from strip
  // - splice from sessionWindow.tabs
  // - if last tab, close window
  // - else activate neighbor
  // ... (unchanged)
}
```

- [ ] **Step 4: Commit**

```powershell
git add renderer/app.js
git commit -m "renderer: dispatch by tab.type in activate/close + add createBrowserTab entry point"
```

---

## Task 10: Add the chevron split-button + dropdown menu next to `+`

**Why:** This is the discoverable trigger for browser tabs (and the audit-recommended fix for the undiscoverable right-click on `+`). Existing left-click=Claude / right-click=Codex muscle-memory is preserved. The chevron exposes all three options explicitly. Middle-click on `+` is added as a power-user shortcut for Browser.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\renderer\app.js` (around line 542-590 — the tab-strip + `+` button construction)

- [ ] **Step 1: Build the chevron + dropdown alongside `+`**

In the function that constructs a session window (around line 527-590), replace the lone `+` button construction (currently lines 542-548) with:

```js
const tabStripEl = windowEl.querySelector('.folder-terminal-tab-strip');

// Wrap + and the new chevron in a single container so they sit flush.
const addGroupEl = document.createElement('div');
addGroupEl.className = 'tab-add-group';

const addTabBtnEl = document.createElement('button');
addTabBtnEl.type = 'button';
addTabBtnEl.className = 'folder-terminal-tab-add';
addTabBtnEl.title = 'New Claude tab  ·  Middle-click: Browser  ·  Right-click: Codex';
addTabBtnEl.setAttribute('aria-label', 'New Claude tab');
addTabBtnEl.textContent = '+';
addGroupEl.appendChild(addTabBtnEl);

const addChevronEl = document.createElement('button');
addChevronEl.type = 'button';
addChevronEl.className = 'tab-add-chevron';
addChevronEl.title = 'New tab options';
addChevronEl.setAttribute('aria-label', 'New tab options');
addChevronEl.setAttribute('aria-haspopup', 'menu');
addChevronEl.setAttribute('aria-expanded', 'false');
addChevronEl.textContent = 'ˇ'; // ˇ — a small caret/chevron
addGroupEl.appendChild(addChevronEl);

tabStripEl.appendChild(addGroupEl);
```

- [ ] **Step 2: Build the dropdown menu (lazy, attached on first click)**

Add a helper near the top of the IIFE (next to other DOM helpers):

```js
function openAddTabDropdown(sessionWindow, anchorEl) {
  // Close any existing dropdown first
  const prior = document.querySelector('.tab-add-dropdown');
  if (prior) prior.remove();

  const menu = document.createElement('div');
  menu.className = 'tab-add-dropdown';
  menu.setAttribute('role', 'menu');
  menu.innerHTML =
    '<button type="button" class="tab-add-dropdown-item" role="menuitem" data-action="claude">' +
      '<span class="tad-glyph" aria-hidden="true">◆</span> New Claude tab' +
    '</button>' +
    '<button type="button" class="tab-add-dropdown-item" role="menuitem" data-action="codex">' +
      '<span class="tad-glyph" aria-hidden="true">◇</span> New Codex tab' +
    '</button>' +
    '<button type="button" class="tab-add-dropdown-item" role="menuitem" data-action="browser">' +
      '<span class="tad-glyph" aria-hidden="true">\u{1F310}</span> New Browser tab' +
    '</button>';

  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${Math.round(rect.bottom + 4)}px`;
  menu.style.left = `${Math.round(rect.left)}px`;
  document.body.appendChild(menu);

  const close = () => {
    if (menu.parentNode) menu.parentNode.removeChild(menu);
    document.removeEventListener('mousedown', onAway, true);
    document.removeEventListener('keydown', onKey, true);
    anchorEl.setAttribute('aria-expanded', 'false');
  };
  const onAway = (e) => { if (!menu.contains(e.target) && e.target !== anchorEl) close(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.tab-add-dropdown-item');
    if (!item) return;
    const action = item.dataset.action;
    if (action === 'claude') createTab(sessionWindow, { agent: 'claude' });
    else if (action === 'codex') createTab(sessionWindow, { agent: 'codex' });
    else if (action === 'browser') createBrowserTab(sessionWindow, {});
    close();
  });

  document.addEventListener('mousedown', onAway, true);
  document.addEventListener('keydown', onKey, true);
  anchorEl.setAttribute('aria-expanded', 'true');

  // Focus the first item for keyboard users
  const firstItem = menu.querySelector('.tab-add-dropdown-item');
  if (firstItem) firstItem.focus();
}
```

- [ ] **Step 3: Wire `+`, chevron, and middle-click**

Replace the existing `+` button event wiring (currently lines 580-588) with:

```js
// Left-click + → Claude (default, unchanged)
addTabBtnEl.addEventListener('click', (event) => {
  event.preventDefault();
  createTab(sessionWindow, { agent: 'claude' });
});

// Right-click + → Codex (existing power-user shortcut)
addTabBtnEl.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  event.stopPropagation();
  createTab(sessionWindow, { agent: 'codex' });
});

// Middle-click + → Browser (mirrors browser convention "middle-click opens in new tab")
addTabBtnEl.addEventListener('auxclick', (event) => {
  if (event.button !== 1) return;
  event.preventDefault();
  createBrowserTab(sessionWindow, {});
});

// Chevron click → dropdown menu
addChevronEl.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  openAddTabDropdown(sessionWindow, addChevronEl);
});

// Cache for future code
sessionWindow.addTabBtnEl = addTabBtnEl;
sessionWindow.addChevronEl = addChevronEl;
```

- [ ] **Step 4: Manual verification**

```powershell
npm start
```

1. Right-click a folder → Launch Claude. Verify the new `˅` chevron is visible to the right of `+`.
2. Click `+` → another Claude tab opens.
3. Right-click `+` → Codex tab opens.
4. Middle-click `+` → Browser tab opens (lands on Brave Search).
5. Click `˅` chevron → dropdown opens with three items (each with a glyph). Click "New Browser tab" → Browser tab opens.
6. With dropdown open, press Esc → dropdown closes.
7. With dropdown open, click outside → dropdown closes.

- [ ] **Step 5: Commit**

```powershell
git add renderer/app.js
git commit -m "renderer: add split-button chevron + dropdown for Claude/Codex/Browser tabs"
```

---

## Task 11: Subscribe to popup-from-guest IPC

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\renderer\app.js` (near the IIFE bootstrap)

- [ ] **Step 1: Add the subscriber once at boot**

Near the renderer bootstrap (where other `window.ezvibes.on...` subscriptions live, or at the bottom of the IIFE), add:

```js
// === BROWSER ===
window.ezvibes.onBrowserNewTabFromPopup((payload) => {
  if (!payload || typeof payload.url !== 'string') return;
  // Route popup to the most-recently-focused session window. Fallback: first window.
  const sessionWindow = state.lastFocusedSessionWindow || state.windowsByPath.values().next().value;
  if (!sessionWindow) return; // popup arrived with no open window — drop silently
  createBrowserTab(sessionWindow, { url: payload.url });
});
// === END BROWSER ===
```

(If `state.lastFocusedSessionWindow` doesn't yet exist, add it: set it inside `activateTab` after a successful activation, e.g. `state.lastFocusedSessionWindow = sessionWindow;`.)

- [ ] **Step 2: Commit**

```powershell
git add renderer/app.js
git commit -m "renderer: subscribe to browser:new-tab-from-popup IPC; route to active session window"
```

---

## Task 12: Install main-process `will-attach-webview` + `did-attach-webview`

**Why:** This is the security chokepoint. Without these hooks, a renderer-side `<webview>` could open with `nodeIntegration: true` and the guest would have Node.js access — full system compromise from any page.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\main.js` (inside `registerIpc(mainWindow)`, after the IPC handlers added in Tasks 3-4)

- [ ] **Step 1: Add the attach hooks**

Append to `registerIpc(mainWindow)`:

```js
  // === BROWSER ===
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    // Clamp guest webPreferences regardless of what the renderer asked for.
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    // Renderer is not allowed to set a preload on the guest.
    delete webPreferences.preload;
    // Force partition isolation; renderer-declared values are allowed only if they start with our prefix.
    if (!params.partition || typeof params.partition !== 'string' || !params.partition.startsWith('persist:browser-tabs')) {
      params.partition = 'persist:browser-tabs';
    }
  });

  mainWindow.webContents.on('did-attach-webview', (_event, guestContents) => {
    guestContents.setWindowOpenHandler(({ url }) => {
      const valid = validateUrl(url);
      if (valid && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:new-tab-from-popup', { url: valid });
      }
      return { action: 'deny' };
    });

    // Optional: a will-navigate guard against file://, data:, etc. in case a page redirects.
    guestContents.on('will-navigate', (e, url) => {
      const valid = validateUrl(url);
      if (!valid) e.preventDefault();
    });
  });
  // === END BROWSER ===
```

- [ ] **Step 2: Manual verification — guest hardening**

```powershell
npm start
```

1. Launch a folder → open a Browser tab via chevron menu → Brave Search loads.
2. In the URL bar type `https://example.com` → Enter. Page loads.
3. In the URL bar type `javascript:alert(1)` → Enter. **Expected: nothing happens** (silent reject).
4. In the URL bar type `file:///C:/Windows/win.ini` → Enter. **Expected: nothing happens.**
5. In the URL bar type `foo.com` → Enter. **Expected: navigates to `https://foo.com/`** (bare-host auto-promote).
6. Navigate to a page with an external link (e.g., `https://example.com` → click "More information..."). **Expected: link opens as a new Browser tab in the SAME session window (not as a detached Electron window).**

- [ ] **Step 3: Commit**

```powershell
git add main.js
git commit -m "main: install will-attach-webview + did-attach-webview guest hardening"
```

---

## Task 13: Styles — panel, toolbar, webview, error overlay, chevron dropdown, glyphs

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\renderer\styles.css` (append to end of file)

- [ ] **Step 1: Append the browser-tab styles**

```css
/* === BROWSER === */

/* Panel fills the .terminal-pocket; lays out toolbar + webview vertically */
.browser-panel {
  display: flex;
  flex-direction: column;
  background: #0d0f0f;
  position: absolute;
  inset: 0;
}
.browser-panel[hidden] { display: none; }

.browser-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #161817;
  border-bottom: 1px solid #2a2c2b;
}
.browser-btn {
  appearance: none;
  background: #1f2120;
  color: #d6d6d6;
  border: 1px solid #303231;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  font-size: 14px;
  cursor: pointer;
}
.browser-btn:hover:not(:disabled) { background: #292b2a; }
.browser-btn:disabled { opacity: 0.4; cursor: default; }
.browser-url-input {
  flex: 1 1 auto;
  height: 28px;
  padding: 0 10px;
  background: #0a0c0b;
  color: #e4e4e4;
  border: 1px solid #303231;
  border-radius: 4px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
}
.browser-url-input:focus {
  outline: none;
  border-color: #5a8aa0; /* slate-cyan — distinct from amber/teal terminal accents */
}

.browser-webview {
  flex: 1 1 auto;
  width: 100%;
  display: flex; /* webview can ignore flex sizing on some platforms; height fallback below */
  min-height: 0;
  background: #ffffff;
}

.browser-error-overlay {
  position: absolute;
  inset: 50px 0 0 0; /* below the toolbar */
  background: rgba(13, 15, 15, 0.92);
  color: #e8e8e8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
}
.browser-error-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.browser-error-detail { font-size: 13px; opacity: 0.85; margin-bottom: 6px; }
.browser-error-url { font-size: 12px; opacity: 0.6; word-break: break-all; max-width: 600px; }

/* === Tab chip variants (glyphs for ALL types — closes WCAG color-only audit gap) === */
.folder-terminal-tab .tab-label::before {
  content: '\25C6'; /* ◆ default = Claude (amber) */
  margin-right: 6px;
  opacity: 0.85;
}
.folder-terminal-tab[data-agent="codex"] .tab-label::before {
  content: '\25C7'; /* ◇ Codex (teal) */
}
.folder-terminal-tab[data-type="browser"] .tab-label::before {
  content: '\1F310'; /* 🌐 Browser (slate) */
  margin-right: 4px;
}
.folder-terminal-tab[data-type="browser"] {
  /* Slate accent — distinct from amber (Claude) and teal (Codex) */
  --tab-accent: #6b7f8c;
  background: linear-gradient(180deg, #2b3137 0%, #1f2429 100%);
  border-color: #3a444d;
  color: #d0d8df;
}
.folder-terminal-tab[data-type="browser"].is-active {
  background: linear-gradient(180deg, #3a4750 0%, #283038 100%);
  border-color: #6b7f8c;
}

/* === Chevron split-button + dropdown === */
.tab-add-group {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  margin-left: 4px;
}
.tab-add-group .folder-terminal-tab-add {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  margin-left: 0;
}
.tab-add-chevron {
  appearance: none;
  background: #1f2120;
  color: #c8c8c8;
  border: 1px solid #303231;
  border-left: none;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  width: 18px;
  height: 26px;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0;
}
.tab-add-chevron:hover { background: #292b2a; }
.tab-add-chevron[aria-expanded="true"] { background: #303231; }

.tab-add-dropdown {
  z-index: 2147483647;
  background: #1a1c1b;
  border: 1px solid #353735;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  padding: 4px;
  min-width: 200px;
}
.tab-add-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: transparent;
  color: #e4e4e4;
  border: none;
  text-align: left;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.tab-add-dropdown-item:hover,
.tab-add-dropdown-item:focus {
  background: #262827;
  outline: none;
}
.tab-add-dropdown-item .tad-glyph {
  display: inline-block;
  width: 18px;
  text-align: center;
  font-size: 14px;
}

/* === END BROWSER === */
```

- [ ] **Step 2: Manual verification**

Reload the app. Visually confirm:
- `+` and `˅` sit flush as one split-button.
- Clicking `˅` opens a styled dropdown with three items, each with a glyph.
- Opening a Browser tab shows a browser-styled panel with a toolbar and the webview filling the rest.
- Browser tab chips read with a 🌐 glyph and slate color, distinct from amber (Claude ◆) and teal (Codex ◇).
- Testing visible glyph contrast against the chip background passes by eye for all three.

- [ ] **Step 3: Commit**

```powershell
git add renderer/styles.css
git commit -m "styles: browser panel/toolbar/webview/error + chevron dropdown + agent glyphs"
```

---

## Task 14: Update `CLAUDE.md` to document the feature

**Why:** CLAUDE.md is the canonical project doc per the file's own header. Future you (or any other agent) must learn the new feature from this file.

**Files:**
- Modify: `C:\Users\Oskari\Documents\EZvibes\CLAUDE.md`

- [ ] **Step 1: Update the "Stack" section**

Add to the bulleted list:

```markdown
- Electron `<webview>` tag (`webviewTag: true`) for in-app Chromium browser tabs
```

- [ ] **Step 2: Update "Runtime Model"**

Add to the "Main IPC channels" list:

```markdown
- `browser:validate-url`
- `browser:canonicalize-or-search`
- `browser:register-guest`
- `browser:unregister-guest`
- `browser:new-tab-from-popup` (main → renderer)
```

Add to the preload API list: `browserValidateUrl`, `browserCanonicalizeOrSearch`, `browserRegisterGuest`, `browserUnregisterGuest`, `onBrowserNewTabFromPopup`.

- [ ] **Step 3: Update "Current UX"**

Replace the bullet that today reads "The `+` button on the strip is dual-action..." with:

```markdown
- The `+` button is a split-button. **Left-click**: new Claude tab. **Right-click**: new Codex tab (legacy shortcut). **Middle-click**: new Browser tab. The `˅` chevron immediately right of `+` opens an explicit dropdown menu listing all three options — this is the discoverable, keyboard-accessible path.
- Three tab types now exist: `claude`, `codex` (both terminal), and `browser`. The first tab created when a folder is launched is always Claude. Browser tabs live in the same per-folder session window as terminal tabs.
- Browser tabs render an Electron `<webview>` inside the folder popup with a back/forward/reload toolbar and a URL bar. The URL bar accepts URLs (auto-promotes bare hosts) or falls back to Brave Search. Default landing page: Brave Search.
- Tab chips carry both color and glyph: Claude ◆ amber, Codex ◇ teal, Browser 🌐 slate. Glyphs ensure agent identity is conveyed without relying on color alone.
```

- [ ] **Step 4: Update "Cautions"**

Append:

```markdown
- Browser tabs use a hardened Electron `<webview>` with main-process `will-attach-webview` clamps. NEVER loosen `sandbox`, `contextIsolation`, `webSecurity`, or `nodeIntegration` for guests. NEVER set a `preload` on a `<webview>` element. The `partition` MUST start with `persist:browser-tabs`.
- All URLs (URL bar AND popup targets) flow through `validateUrl` / `canonicalizeUrlOrSearch` in `main.js`. The scheme allowlist is `http:` and `https:` only. Adding any other scheme (`file:`, `data:`, `javascript:`) is a critical security regression.
- The popup handler in `did-attach-webview` MUST keep `return { action: 'deny' }` for every code path — re-route via `browser:new-tab-from-popup` to keep external links inside the hardened pipeline.
- `webviewTag: true` is set on the main BrowserWindow. Do not remove it — browser tabs become inert divs without it.
```

- [ ] **Step 5: Update "Known Limitations / Next Improvements"**

Append:

```markdown
- Browser tabs are not persisted across app restarts (no URL save/restore yet). Terminal tabs are also not persisted (pre-existing limitation).
- Keyboard chords pressed INSIDE a browser tab guest do not propagate to the app's tab navigation (no `before-input-event` forwarding installed). E.g., a future `Ctrl+T` shortcut would be swallowed by Chromium when focus is in a webview.
- All browser tabs share a single `persist:browser-tabs` session partition — cookies and localStorage are shared across every browser tab in the app.
- DevTools for browser-tab guests is not exposed via UI.
```

- [ ] **Step 6: Commit**

```powershell
git add CLAUDE.md
git commit -m "docs: document browser tab feature in CLAUDE.md"
```

---

## Task 15: End-to-end manual verification (golden + regression paths)

- [ ] **Golden path — open, navigate, popup, close**

```powershell
npm start
```

1. Navigate to a folder, right-click → Launch Claude. Verify a Claude terminal tab opens normally.
2. Click `˅` chevron → "New Browser tab". Verify a Browser tab appears with the 🌐 glyph and slate accent; Brave Search loads.
3. Click into the URL bar, type `https://example.com`, press Enter. Verify navigation.
4. Click the **More information...** link on example.com. Verify it opens as a SECOND Browser tab in the same window (not as a detached Electron window).
5. Switch between the two Browser tabs and the Claude tab — all three should hide/show correctly without leaving any panel visible across switches.
6. Close the second Browser tab via its × button. First Browser tab + Claude tab remain.
7. Close the first Browser tab. Only the Claude tab remains.
8. Close the Claude tab → entire session window closes.

- [ ] **Security regression checks**

In a Browser tab URL bar, attempt the following — all should fail to navigate (silent rejection):

```
javascript:alert(document.cookie)
file:///C:/Windows/win.ini
data:text/html,<script>alert(1)</script>
chrome://settings
view-source:https://example.com
```

`https://example.com` and bare `example.com` (auto-promoted) should both succeed.

- [ ] **Audit-finding regressions (should now be FIXED, not regressed)**

1. **Right-click `+` discoverability**: the chevron `˅` is now visible. (FIXED — was: hidden affordance.)
2. **Rapid-click `+`** 10 times. `+` is briefly disabled between clicks; tab counter increments cleanly; no orphan chips. (FIXED — was: race spawned concurrent PTYs with broken counters.)
3. **Force `createTerminal` failure** (temporary edit at `main.js:147`): no orphan chip, no phantom "tab-opened" log. (FIXED — was: chip orphaned + counter never rolled back.)
4. **Color-only agent diff**: chips carry glyphs (◆/◇/🌐) plus color. (PARTIALLY FIXED — full WCAG 1.4.1 close also requires updating the chip's `aria-label`; that lives in the ARIA-fixes follow-up plan.)

- [ ] **Minimize/restore with mixed tabs**

1. Open one Claude tab, one Codex tab, one Browser tab in the same window.
2. Minimize the window (Genie animation back to source folder card).
3. Restore. All three tabs should still exist; the previously-active tab is shown.
4. Switch between them. Browser tab should refresh its layout cleanly (no clipping).

- [ ] **Commit any verification-driven fixes**

If verification surfaces minor adjustments (CSS tweaks, off-by-one logic), commit them as small follow-up commits:

```powershell
git add <files>
git commit -m "fix: <specific tweak from verification>"
```

---

## Out of Scope — Follow-up Plans

The following are explicitly NOT in this plan. Each warrants its own plan when prioritized.

1. **Tab persistence across restart** (`docs/superpowers/plans/YYYY-MM-DD-tab-persistence.md`) — Serialize `state.windowsByPath` (folder paths + per-tab `{type, agent, customName, browserUrl}`) on every change to `~/.ezvibes/state.json`; restore on app boot. Closes the audit finding that "no persistence is now table-stakes".
2. **Guest keyboard chord forwarding** — Install `before-input-event` on each guest's WebContents in `did-attach-webview`. Forward Ctrl+T/W/Tab/1-9 as `browser:guest-key-tab-action` IPC; Ctrl+L/Alt+Arrow/Ctrl+R as `browser:guest-key-content` IPC. Required if/when the app gains global tab shortcuts.
3. **AgentProfile object refactor** — Replace the `agent` string enum (`'claude' | 'codex'`) and the parallel `type` enum (`'terminal' | 'browser'`) with a single registry of `AgentProfile { id, kind, command?, label, accent, glyph, defaultFlags }`. Collapses the 5-site update burden CLAUDE.md flags and the tab-type branch added by this plan.
4. **Per-tab session isolation** — Optionally use `partition="browser-tabs-${tabId}"` instead of the shared `persist:browser-tabs`. Cost: lose cross-tab session sharing (login on one tab doesn't carry to another). Decide explicitly.
5. **DevTools UX** — Right-click on the Browser tab chip → "Open DevTools (guest)" → `webContents.fromId(wcId).openDevTools()` via a new `browser:open-devtools` IPC.
6. **OSC 9 / OSC 633 capture on terminal tabs** — Not browser-related but in the same code surface; addresses the audit's "minimized sessions have no waiting-for-you signal" finding.
7. **Tab-strip ARIA tabs pattern** — Roving tabindex, arrow-key navigation, proper `aria-controls`/`role="tabpanel"` linkage, dynamic `aria-label` on the tablist. The Browser tab inherits the existing broken ARIA today; this is a single fix across all three tab types.
8. **Cleanup of `app.on('activate')` IPC double-registration** — Per audit finding A#3 (`main.js:241-265`). Independent of browser feature but in the same file.

---

## Self-Review Notes

- **Spec coverage**: Every section of `browser.md` is either implemented (panel + webview + toolbar + IPC + hardening + popup forwarding + URL validation), explicitly deferred (persistence, key forwarding, hot-reload cleanup), or noted as N/A for EZvibes's simpler architecture (no feature module system → no `registerType`; no shared config → no `tabState` persistence in MVP).
- **Placeholder scan**: No "TODO" / "implement later" / "fill in details" remain. All code blocks contain real code. All file paths are absolute. Helper function names (`logNarration`, `attachTabChip`, `activateTab`, `state.tabsById`) reference the actual symbols confirmed in the audit's code-recon (lines 10, 222-240, 601-655, 690-770).
- **Type consistency**: `tab.type` is `'terminal' | 'browser'` everywhere (Tasks 6, 7, 8, 9). `tab.agent` is `'claude' | 'codex'` everywhere and is ignored on browser tabs. The IPC channel name `browser:new-tab-from-popup` matches between main (Task 12), preload (Task 5), and renderer subscriber (Task 11). The partition string `persist:browser-tabs` is identical in renderer attribute (Task 8) and main clamp (Task 12).
- **Audit-finding crossover**: The plan opportunistically addresses 4 audit findings (split-button discoverability, rapid-click race, orphan-chip-on-failure, color-only differentiation) because they live in the same files we are already touching. Other audit findings (ARIA tabs pattern, OSC 9 capture, `app.on('activate')` IPC double-register) are explicitly deferred to keep this plan scoped.

---

## Summary

15 tasks across 5 files. No new files, no new npm dependencies. ~600 LOC added across `main.js`, `preload.js`, `renderer/app.js`, `renderer/styles.css`, plus doc updates to `CLAUDE.md`. Each task is independently committable. Manual verification at the end of every task.

The single irreversible architecture choice is the `tab.type` field — once browser tabs ship, anything else that branches on tab kind (rename, close, persistence, ARIA) must respect both `type` and `agent`. The `AgentProfile` follow-up plan collapses both back into one primitive, which is the right long-term shape.
