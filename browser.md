# Retteli Terminal Emulator — Browser Tab Pipeline

How a right-click on the `+` button becomes a fully hardened, in-app Chromium browser tab. End-to-end audit of the renderer trigger, the tab-type registry, the `<webview>` lifecycle, the main-process IPC and security hardening, popup interception, keyboard-chord forwarding, persistence, and cross-feature invariants.

Audit basis: live source under `C:\Users\Oskari\Documents\Terminal-Emulator` as of 2026-05-24. All file:line references in this document refer to that tree.

---

## 1. TL;DR

- **Trigger**: right-click the `+` button at `renderer/features/tabs/tabs.renderer.js:114-118`. The handler swallows the OS context menu and calls `addTab(undefined, undefined, { type: 'browser' })`.
- **Dispatch**: TabsFeature owns a *type registry*. `addTab` looks up the `'browser'` handler that BrowserFeature registered at init time and calls `handler.create(tabId, { payload: null, launchOptions: null })`.
- **Panel + webview**: BrowserFeature builds a `.browser-panel` containing a toolbar (back/fwd/reload + URL bar) and an `<webview>` element with `partition=persist:brave-tabs`, `allowpopups`, sandboxed `webpreferences`, and a Brave UA string. The webview navigates to `LANDING_URL` (Brave Search) by default.
- **Main-process attach**: as Chromium attaches the guest, `mainWindow.webContents.on('will-attach-webview')` clamps `sandbox=true`, `nodeIntegration=false`, `contextIsolation=true`, `webSecurity=true`, and forces `partition=persist:brave-tabs`. Then `did-attach-webview` installs `setWindowOpenHandler` (always denies, forwards re-validated URLs as in-app tabs) and `before-input-event` (intercepts global tab chords + browser content chords).
- **Mapping**: on the guest's `dom-ready`, the renderer sends `browser:register-guest` with `{tabId, webContentsId}`. Main keeps a bidirectional `webContentsId ↔ tabId` map used by key forwarding and unregister cleanup.
- **Persistence**: navigation events (`did-navigate`, `did-navigate-in-page`) trigger a 500 ms debounced save through `TabsFeature.requestSave()`. The tab list (terminal + browser entries) is persisted under `tabState` in `~/.yourterm/config.json`.

The full chain — renderer trigger → registry dispatch → DOM construction → Chromium attach → main hardening → guest mapping → ready browser — typically completes in a few hundred milliseconds.

---

## 2. Three-process architecture

```
+--------------------------+        +--------------------------+        +---------------------------+
|        RENDERER          |  IPC   |    MAIN (Node.js)        |  attach |       GUEST <webview>     |
|  (xterm host BrowserWin) | <----> | (Electron main process)  | <-----> |  (Chromium tab content)   |
|                          |        |                          |        |                           |
|  TabsFeature (registry)  |        | BrowserWindow            |        |  sandbox: true            |
|  BrowserFeature          |        |  - webviewTag: true      |        |  contextIsolation: true   |
|   - .browser-panel       |        |  - sandbox: false (host) |        |  nodeIntegration: false   |
|   - <webview>            |        |                          |        |  webSecurity: true        |
|     attrs:               |        | browser.main.js          |        |  partition: persist:brave |
|       partition          |        |  - will-attach-webview   |        |                           |
|       allowpopups        |        |  - did-attach-webview    |        |  Untrusted page content   |
|       webpreferences     |        |  - setWindowOpenHandler  |        |  (Brave Search by default)|
|       useragent          |        |  - before-input-event    |        |                           |
|       src                |        |  - IPC handlers          |        +---------------------------+
|                          |        |  - guest mapping (Maps)  |
|  + toolbar (back/fwd/    |        |                          |
|     reload + URL bar)    |        |                          |
+--------------------------+        +--------------------------+
                |                              ^
                | preload.js exposes           | mainWindow.webContents.send(...)
                v contextBridge methods        |
            terminalAPI.* (browser:* channels) +
```

There are *three* renderer-side surfaces here: (1) the host BrowserWindow's renderer (Tabs + Browser features), (2) the guest webview's content (untrusted), and (3) the preload script that bridges (1) ↔ main. The guest webview has NO preload and is sandboxed.

The seven `browser:*` IPC channels (four invoke-style or fire-and-forget request channels and three push channels) form the contract between renderer and main. All seven are listed in `.claude/rules/browser.md:7-13`.

---

## 3. The trigger — right-click on `+`

### 3.1 The `+` button (DOM + listeners)

`renderer/features/tabs/tabs.renderer.js:107-119`:

```js
addButton = document.createElement('button');
addButton.id = 'tab-add';
addButton.className = 'tab-add-btn';
addButton.textContent = '+';
addButton.title = 'New tab (Ctrl+T) — right-click for browser tab';
addButton.setAttribute('aria-label', 'New tab');
addButton.addEventListener('click', () => addTab());
addButton.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
  addTab(undefined, undefined, { type: 'browser' });
});
tabBar.appendChild(addButton);
```

- `click` → `addTab()` with no args → terminal tab (default).
- `contextmenu` → `addTab(undefined, undefined, { type: 'browser' })` → browser tab.
- `e.preventDefault()` suppresses the OS context menu (paste/inspect-element).
- `e.stopPropagation()` is defense-in-depth so the document-level contextmenu handler (line 292-294, which dismisses the per-tab color menu) doesn't see the event.
- The `title` attribute is the *only* user-facing affordance for the right-click behavior — no popover, no documentation in the UI.
- The button is appended directly to `#tab-bar`, not `#tab-track`, so it stays pinned alongside the scroll arrows while the track scrolls behind it.

### 3.2 `addTab(customName, themeName, opts)` flow

`renderer/features/tabs/tabs.renderer.js:364-443`:

```js
function addTab(customName, themeName, opts) {
  opts = opts || {};
  const type = opts.type || 'terminal';
  const payload = opts.payload || null;
  const launchOptions = opts.launchOptions || null;
  ...
  const tabId = 'tab-' + (++tabCounter);
  tabOrder.push(tabId);
  tabTypes.set(tabId, type);                 // <- registers the type
  if (payload) tabPayloads.set(tabId, payload);
  ...
  // tab BUTTON DOM (lines 379-420)
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.classList.add('type-' + type);       // <- 'type-browser' marker
  tabEl.dataset.tabId = tabId;
  ...
  const handler = getTypeHandler(type);      // throws if not registered
  if (opts.restoring && typeof handler.restore === 'function') {
    handler.restore(tabId, payload || {});
  } else {
    handler.create(tabId, { payload, launchOptions });
  }
  activateTab(tabId);
  ...
  saveTabState();
}
```

For the right-click case:
- `type = 'browser'`, `payload = null`, `launchOptions = null`.
- A new `tabId = 'tab-N'` is assigned.
- `tabTypes` Map records the type; `tabPayloads` is *not* set (payload is null).
- The tab button element gets class `type-browser`, which styles in `browser.styles.css:66-71` add a 🌐 globe-emoji prefix before the title.
- `getTypeHandler('browser')` looks up the handler BrowserFeature registered during init.
- Since `opts.restoring` is falsy, `handler.create(tabId, { payload: null, launchOptions: null })` runs.
- `activateTab(tabId)` follows immediately, making the new browser tab visible.
- `saveTabState()` persists the updated tab list.

If BrowserFeature hadn't registered its type yet (e.g., `init()` order broken), `getTypeHandler` would throw `Error('Tab type not registered: browser')` at `tabs.renderer.js:356`.

---

## 4. Tab type registry

The registry is the central abstraction that lets TabsFeature dispatch to multiple tab kinds (currently `'terminal'` and `'browser'`) without knowing the implementation.

### 4.1 Data structures

`renderer/features/tabs/tabs.renderer.js:10-12`:

```js
const tabTypes = new Map();      // tabId -> 'terminal' | 'browser'
const tabPayloads = new Map();   // tabId -> opaque payload (for serialize/restore)
const typeHandlers = new Map();  // typeName -> handler object
```

Parallel maps rather than a single tab-object — a deliberate design choice to keep the existing terminal-only code paths from churning during the introduction of the registry.

### 4.2 `registerType(name, handler)`

`tabs.renderer.js:349-352`:

```js
function registerType(name, handler) {
  // handler: { create(tabId, opts), activate(tabId), close(tabId), serialize(tabId), restore(tabId, payload) }
  typeHandlers.set(name, handler);
}
```

Exposed publicly as `TabsFeature.registerType` (line 794).

### 4.3 Browser feature registration

`renderer/features/browser/browser.renderer.js:18-29` (inside `init()`):

```js
contentArea = document.getElementById('terminal-content');
TabsFeature.registerType('browser', {
  create:    (tabId, opts) => createBrowserTab(tabId, (opts && opts.payload && opts.payload.url) || LANDING_URL),
  activate:  activateBrowserTab,
  close:     closeBrowserTab,
  serialize: (tabId) => ({ url: getUrl(tabId) || LANDING_URL }),
  restore:   (tabId, payload) => createBrowserTab(tabId, (payload && payload.url) || LANDING_URL),
});
```

- `create` extracts `opts.payload.url`. The right-click path passes `{ payload: null, ... }` → URL falls through to `LANDING_URL = 'https://search.brave.com/'` (line 8).
- `serialize` returns `{ url: ... }` — exactly the shape `restore` consumes back. Symmetric round-trip.
- `restore` and `create` route to the *same* `createBrowserTab(tabId, url)` builder — there is no distinct restore code path; only the URL source differs.

The terminal type registers symmetrically at `terminal.renderer.js:21-30` with `serialize: () => ({})` (terminal tabs persist nothing beyond their type/name/theme).

### 4.4 Init order (load-bearing)

`renderer/app.js:1-13`:

```js
(async function () {
  TabsFeature.init();         // builds #tab-bar, +button, contextmenu, doesn't create tabs
  TerminalFeature.init();     // registers 'terminal' type AND creates #terminal-content
  BrowserFeature.init();      // reads #terminal-content, registers 'browser' type
  RecentPathsFeature.init();
  ClipboardFeature.init();
  GridViewFeature.init();
  await TabsFeature.bootInitialTabs();  // consumes registered types to restore
  ...
})();
```

Three ordering constraints:
1. `TabsFeature.init` before everything else (provides the registry).
2. `BrowserFeature.init` after `TerminalFeature.init` — Terminal creates `#terminal-content`, Browser reads it.
3. `bootInitialTabs` last — both type handlers must be registered before any restored tab can be dispatched.

If browser-init were re-ordered ahead of terminal-init, `document.getElementById('terminal-content')` would return `null` at `browser.renderer.js:22` and the next `contentArea.appendChild(panel)` would throw.

### 4.5 Active-tab tracking (type-agnostic)

`tabs.renderer.js:445-483` (`activateTab`):

```js
function activateTab(tabId) {
  ...
  activeTabId = tabId;
  ...
  // Hide every other tab's content panel regardless of type. Each type handler's
  // `activate` only sweeps its own kind of panel...
  const contentArea = document.getElementById('terminal-content');
  if (contentArea) {
    for (const panel of contentArea.children) {
      if (panel.dataset && panel.dataset.tabId !== undefined && panel.dataset.tabId !== tabId) {
        panel.style.display = 'none';
      }
    }
  }

  const type = getTypeOf(tabId);
  getTypeHandler(type).activate(tabId);

  const themeName = tabColors.get(tabId) || null;
  applyFullTheme(themeName);

  scrollTabIntoView(tabId);
}
```

The type-agnostic *hide-others* sweep (lines 467-474) is critical for cross-type correctness. Each type handler's own `activate` only sweeps panels it owns (e.g., `activateBrowserTab` only touches `.browser-panel`), so without this sweep the *previously-active panel of the other type* would remain visible when switching across types (terminal → browser would leave the terminal visible).

`activeTabId` is module-private to TabsFeature. `TerminalFeature.getActiveTabId()` is a delegate that calls back into `TabsFeature.getActiveTabId()` — there is exactly one source of truth.

---

## 5. Browser renderer lifecycle

### 5.1 `createBrowserTab(tabId, url)` — panel + toolbar + webview

`renderer/features/browser/browser.renderer.js:40-71`:

```js
function createBrowserTab(tabId, url) {
  const panel = document.createElement('div');
  panel.className = 'browser-panel';
  panel.dataset.tabId = tabId;
  panel.style.display = TabsFeature.getActiveTabId() && TabsFeature.getActiveTabId() !== tabId ? 'none' : '';

  const toolbar = document.createElement('div');
  toolbar.className = 'browser-toolbar';
  toolbar.innerHTML = ''
    + '<button class="browser-btn back" title="Back (Alt+Left)">←</button>'
    + '<button class="browser-btn fwd" title="Forward (Alt+Right)">→</button>'
    + '<button class="browser-btn reload" title="Reload (Ctrl+R)">⟳</button>'
    + '<input class="browser-url-input" type="text" spellcheck="false" />';
  panel.appendChild(toolbar);

  const webview = document.createElement('webview');
  webview.className = 'browser-webview';
  webview.setAttribute('partition', 'persist:brave-tabs');
  webview.setAttribute('allowpopups', '');
  webview.setAttribute('webpreferences', 'contextIsolation=yes,sandbox=yes,nodeIntegration=no');
  webview.setAttribute('useragent', buildUserAgent());
  webview.setAttribute('src', url);
  panel.appendChild(webview);

  contentArea.appendChild(panel);          // <- inserts into #terminal-content
  panels.set(tabId, panel);
  webviews.set(tabId, webview);
  urlBars.set(tabId, toolbar.querySelector('.browser-url-input'));

  wireToolbar(tabId, panel, webview);
  wireWebviewEvents(tabId, webview);
}
```

Critical `<webview>` attributes:

| Attribute | Value | Purpose |
|---|---|---|
| `partition` | `persist:brave-tabs` | Shared persistent session across ALL browser tabs. Cookies/storage survive restarts. Isolated from anything outside the browser feature. |
| `allowpopups` | (boolean empty) | **REQUIRED** for `setWindowOpenHandler` to fire. Without it Chromium silently swallows `window.open` and the popup handler never runs (`.claude/rules/browser.md:20`). |
| `webpreferences` | `contextIsolation=yes,sandbox=yes,nodeIntegration=no` | Renderer-declared guest hardening — main re-asserts the same in `will-attach-webview`. |
| `useragent` | Brave UA (built by `buildUserAgent()` at line 214) | UA spoofing — Brave-aware sites render their Brave experience. Fallback to `'120.0.0.0'` for `process.versions.chrome` because `process` may not be present under contextIsolation. |
| `src` | URL string | Initial navigation target. |

Notes:
- Panel parent is `#terminal-content` (the same container terminal panels use). Inline comment at line 19-21 explicitly says this MUST not be `#terminal-container` (which holds the tab bar).
- Newly-created panel hides itself if there's already an active tab and it isn't us (line 44). `activateTab` then runs the cross-type sweep + the browser-specific activate immediately.
- The URL bar is NOT pre-populated. It gets the URL on `did-navigate` (line 136). A brief flash of empty URL bar on first paint is possible.

### 5.2 Toolbar wiring

`browser.renderer.js:96-120` (`wireToolbar`):

```js
function wireToolbar(tabId, panel, webview) {
  const back = panel.querySelector('.browser-btn.back');
  const fwd = panel.querySelector('.browser-btn.fwd');
  const reload = panel.querySelector('.browser-btn.reload');
  const urlBar = panel.querySelector('.browser-url-input');

  back.disabled = true;
  fwd.disabled = true;
  reload.disabled = true; // re-enabled on dom-ready

  back.addEventListener('click', () => { try { webview.goBack(); } catch (_) {} });
  fwd.addEventListener('click', () => { try { webview.goForward(); } catch (_) {} });
  reload.addEventListener('click', () => { try { webview.reload(); } catch (_) {} });

  urlBar.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const input = urlBar.value;
    const result = await window.terminalAPI.browserCanonicalizeOrSearch(input);
    if (result && result.ok) {
      navigate(tabId, result.url);
    }
  });
  urlBar.addEventListener('focus', () => urlBar.select());
}
```

- All three buttons start disabled. Reload re-enables on `dom-ready`. Back/forward update via `refreshNavState()` on each navigation event.
- Every webview method is wrapped in `try/catch` (webview methods can throw during teardown races).
- URL bar Enter → `browser:canonicalize-or-search` IPC → only navigates on `{ ok: true }`.
- `focus` → select-all for easy editing.

### 5.3 Webview event subscriptions

`browser.renderer.js:121-182` (`wireWebviewEvents`) — six handlers:

1. **`did-navigate`**: refresh URL bar, refresh nav-state, schedule debounced save.
2. **`did-navigate-in-page`**: same. (SPA pushState wouldn't fire `did-navigate`.)
3. **`dom-ready`**: enable reload button, refresh nav state, **and register the guest with main**:
    ```js
    const id = webview.getWebContentsId();
    window.terminalAPI.browserRegisterGuest({ tabId, webContentsId: id });
    ```
   This is the most important integration point — without this `webContentsId → tabId` mapping in main, key-forwarding from inside the guest cannot resolve a tabId. `getWebContentsId()` is only available after dom-ready.
4. **`page-title-updated`**: trim title, push first 40 chars to `TabsFeature.updateTabTitle(tabId, ...)`. Empty titles dropped. Errors swallowed.
5. **`did-fail-load`**: two filters — ignore `errorCode -3` (ERR_ABORTED, fires on cancelled navigations) and ignore subframes (`isMainFrame === false`). On a real main-frame failure, attach a `.browser-error-overlay` div with the error text + URL.
6. **`did-start-loading`**: remove any existing error overlay (a successful retry clears prior errors).

### 5.4 Debounced persistence

`browser.renderer.js:184-191`:

```js
function scheduleSave(tabId) {
  const prior = saveDebounceTimers.get(tabId);
  if (prior) clearTimeout(prior);
  saveDebounceTimers.set(tabId, setTimeout(() => {
    saveDebounceTimers.delete(tabId);
    try { TabsFeature.requestSave(); } catch (_) {}
  }, 500));
}
```

Per-tab 500 ms debounce on navigation. Coalesces rapid in-page nav (anchor links, pushState bursts). Timers cleared on tab close.

### 5.5 `activateBrowserTab`

`browser.renderer.js:73-79`:

```js
function activateBrowserTab(tabId) {
  for (const [id, panel] of panels) {
    if (id !== tabId) panel.style.display = 'none';
  }
  const panel = panels.get(tabId);
  if (panel) panel.style.display = '';
}
```

Type-internal sweep (only `.browser-panel` elements). Cross-type hiding is handled by `TabsFeature.activateTab`'s generic sweep (§4.5).

Notable: this does NOT call `webview.focus()`. After switching to a browser tab the user must click into the webview or URL bar. Asymmetric with terminal tabs (`switchTerminal` calls `terminal.focus()` at terminal.renderer.js:143).

### 5.6 `closeBrowserTab`

`browser.renderer.js:81-94`:

```js
function closeBrowserTab(tabId) {
  const panel = panels.get(tabId);
  if (panel) panel.remove();
  panels.delete(tabId);
  const wv = webviews.get(tabId);
  if (wv) {
    try { window.terminalAPI.browserUnregisterGuest({ tabId }); } catch (_) {}
  }
  webviews.delete(tabId);
  urlBars.delete(tabId);
  const t = saveDebounceTimers.get(tabId);
  if (t) clearTimeout(t);
  saveDebounceTimers.delete(tabId);
}
```

Sequence: remove panel from DOM (which detaches the webview) → notify main via `browser:unregister-guest` → drop all per-tab Maps → clear pending save debounce.

---

## 6. Main process — BrowserWindow, register/cleanup, IPC handlers

### 6.1 BrowserWindow configuration

`src/main/index.js:100-119`:

```js
mainWindow = new BrowserWindow({
  width: 900, height: 600, minWidth: 400, minHeight: 300,
  icon: path.join(__dirname, '..', '..', 'renderer', 'favicon.ico'),
  titleBarStyle: 'hidden',
  titleBarOverlay: { color: '#050505', symbolColor: '#cccccc', height: 22 },
  webPreferences: {
    preload: path.join(__dirname, '..', 'preload', 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false,           // required for file.path on drag-drop in Electron 33+
    webviewTag: true,         // enables <webview> for the Browser feature
  },
});
```

| webPreference | Value | Notes |
|---|---|---|
| `preload` | `src/preload/preload.js` | Single contextBridge surface (`terminalAPI`). |
| `nodeIntegration` | `false` | Host renderer cannot `require()` Node. |
| `contextIsolation` | `true` | Preload world is isolated. |
| `sandbox` | **`false`** | Host concession for drag-drop `file.path`. Guest `<webview>`s independently re-impose `sandbox: true` (see §7). |
| `webviewTag` | `true` | **Required.** Without this, `<webview>` is an inert no-op shell (Electron disables by default since v5). |

Note on `main.js` at the repo root: a pre-refactor monolith, **not** the live entry point. Its `webPreferences` block does NOT set `webviewTag`. If anyone ever rewires `package.json`'s `main` to it, browser tabs would silently break.

### 6.2 `browser.main.js` module-scoped state

`browser.main.js:4-6`:

```js
const guestByContentsId = new Map(); // webContentsId -> tabId  (reverse map)
const tabIdByGuest = new Map();      // tabId -> webContentsId  (forward map)
let registeredMainWindow = null;
```

Bidirectional mapping is required:
- Reverse map: `before-input-event` on a guest needs to find which tab owns it.
- Forward map: `browser:unregister-guest` needs to find which webContentsId to evict from the reverse map.

### 6.3 `register(mainWindow)` — `browser.main.js:36-86`

Called from `src/main/index.js:131` (`browser.register(mainWindow);`), after the main window is constructed and core features (config, terminal, sidebar, theme, clipcap) are registered. Order matters because the browser feature stores `mainWindow` for `webContents.send()` pushes.

Installs:
1. `registeredMainWindow = mainWindow`
2. `ipcMain.handle('browser:validate-url', ...)`
3. `ipcMain.handle('browser:canonicalize-or-search', ...)`
4. `ipcMain.on('browser:register-guest', ...)`
5. `ipcMain.on('browser:unregister-guest', ...)`
6. `mainWindow.webContents.on('will-attach-webview', ...)` — attach-time lockdown
7. `mainWindow.webContents.on('did-attach-webview', ...)` — installs `setWindowOpenHandler` + key handlers per guest

### 6.4 `cleanup()` — `browser.main.js:148-156`

```js
function cleanup() {
  ipcMain.removeHandler('browser:validate-url');
  ipcMain.removeHandler('browser:canonicalize-or-search');
  ipcMain.removeAllListeners('browser:register-guest');
  ipcMain.removeAllListeners('browser:unregister-guest');
  guestByContentsId.clear();
  tabIdByGuest.clear();
  registeredMainWindow = null;
}
```

Called from `mainWindow.on('closed', ...)` at `src/main/index.js:145`. Tears down both Maps and all IPC handlers. Does NOT remove the `will-attach-webview` / `did-attach-webview` listeners on `mainWindow.webContents` nor the per-guest `before-input-event` handlers — in practice masked because the closed mainWindow already destroys all guest WebContents. A hot-reload scenario would leak.

### 6.5 IPC handlers (six channels owned by browser)

#### `browser:validate-url` — `browser.main.js:39-42`
- `ipcMain.handle` (invoke, returns Promise).
- Input: any string. Output: `{ ok: true, url }` or `{ ok: false }`.
- Delegates to `validateUrl()` (see §8).
- Preload binding: `browserValidateUrl` at `preload.js:104`.

#### `browser:canonicalize-or-search` — `browser.main.js:44-47`
- `ipcMain.handle`.
- Input: any string. Output: `{ ok: true, url }` or `{ ok: false }`.
- Delegates to `canonicalizeUrlOrSearch()` (see §8).
- Used by the URL bar. Preload binding: `browserCanonicalizeOrSearch` at `preload.js:105`.

#### `browser:register-guest` — `browser.main.js:49-54`
- `ipcMain.on` (fire-and-forget).
- Input: `{ tabId: string, webContentsId: number }`. Strict runtime type check.
- Side effects: writes both Maps; calls `attachGuestHandlers(webContentsId)` (idempotent via sentinel).
- Preload binding: `browserRegisterGuest` at `preload.js:106`.
- Renderer call site: `browser.renderer.js:151-154` (inside `dom-ready` handler).

#### `browser:unregister-guest` — `browser.main.js:56-61`
- `ipcMain.on`.
- Input: `{ tabId: string }`. Strict type check.
- Side effects: looks up `id = tabIdByGuest.get(tabId)` BEFORE deleting (lookup-then-delete pattern), then deletes from both Maps.
- Preload binding: `browserUnregisterGuest` at `preload.js:107`.

#### `browser:new-tab-from-popup` — main → renderer (push)
- No `ipcMain` registration; only `mainWindow.webContents.send(...)` from inside `setWindowOpenHandler`.
- Payload: `{ url: string }` (validated http(s) URL only).
- Defensive: send only fires if `valid && registeredMainWindow && !registeredMainWindow.isDestroyed()`.
- Preload binding: `onBrowserNewTabFromPopup` at `preload.js:108-111`.
- Renderer subscriber: `browser.renderer.js:31-33` → `TabsFeature.newTab('browser', { payload: { url } })`.

#### `browser:guest-key-tab-action` — main → renderer (push)
- Payload: `{ action: 'new'|'close'|'prev'|'next'|'goto', index?: number }`.
- `index` only for `'goto'` (parsed from key `'1'..'9'`).
- Preload binding: `onBrowserGuestKeyTabAction` at `preload.js:112-115`.
- Renderer subscriber: `tabs.renderer.js:56-65` (switch on action).

#### `browser:guest-key-content` — main → renderer (push)
- Payload: `{ tabId: string, action: 'focus-url'|'back'|'forward'|'reload' }`.
- Carries `tabId` because the renderer must operate on a specific guest's `<webview>` (e.g., `wv.goBack()`); focus may have moved by the time the IPC arrives.
- Preload binding: `onBrowserGuestKeyContent` at `preload.js:116-119`.
- Renderer subscriber: `browser.renderer.js:34-37` → `handleGuestContentKey(tabId, action)`.

---

## 7. Guest webview hardening (security boundary)

### 7.1 `will-attach-webview` — attach-time lockdown

`browser.main.js:64-73`:

```js
mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
  webPreferences.nodeIntegration = false;
  webPreferences.contextIsolation = true;
  webPreferences.sandbox = true;
  webPreferences.webSecurity = true;
  // Force partition isolation
  if (!params.partition || !params.partition.startsWith('persist:brave-tabs')) {
    params.partition = 'persist:brave-tabs';
  }
});
```

The renderer-declared `<webview>` attributes are *advisory*. This is the authoritative chokepoint that re-asserts hardening regardless of what the renderer asks for:

| Clamp | Value | Effect |
|---|---|---|
| `nodeIntegration` | `false` | Guest renderer cannot `require()` Node. |
| `contextIsolation` | `true` | Guest renderer JS isolated from any preload (and there is no preload on the guest). |
| `sandbox` | `true` | Strongest lockdown — guest runs in Chromium sandbox. **Host BrowserWindow runs with `sandbox: false`, but the guest does NOT inherit.** |
| `webSecurity` | `true` | Same-origin policy + CSP enforced. |
| `params.partition` | Forced to `persist:brave-tabs` | Prevents arbitrary partition injection from the renderer. The `startsWith('persist:brave-tabs')` allows the renderer-declared value but rewrites anything else. |

What is *not* explicitly clamped:
- `params.preload` — the `<webview>` doesn't set a preload attribute today, so it's `undefined`. Future-proofing would explicitly null it.
- `params.src` — not validated. Trust the renderer-set value; guest is sandboxed anyway.
- `allowpopups` is set as an *attribute* on the `<webview>` element (renderer-side), not as a `webPreferences` field. Main leaves it untouched intentionally — see §9.

### 7.2 `did-attach-webview` — per-guest handler installation

`browser.main.js:76-85`:

```js
mainWindow.webContents.on('did-attach-webview', (_event, guestContents) => {
  guestContents.setWindowOpenHandler(({ url }) => {
    const valid = validateUrl(url);
    if (valid && registeredMainWindow && !registeredMainWindow.isDestroyed()) {
      registeredMainWindow.webContents.send('browser:new-tab-from-popup', { url: valid });
    }
    return { action: 'deny' };
  });
  attachGuestHandlers(guestContents.id);
});
```

Two effects:
1. Install `setWindowOpenHandler` on the guest (only main can — the renderer's `<webview>` DOM only exposes `getWebContentsId()`, not the WebContents object).
2. Call `attachGuestHandlers(guestContents.id)` — install `before-input-event` for key forwarding.

Note: `attachGuestHandlers` runs *immediately* on attach (before the renderer's `dom-ready` fires and sends `browser:register-guest`). The renderer-triggered call inside `browser:register-guest` is a no-op via the `_retteliKeyHandlerAttached` sentinel at `browser.main.js:92`.

This means key handlers exist on the guest during the brief window before the renderer registers. During that window the reverse map is empty, so content-key handlers (which need a tabId) return early — only tab-action chords work. Acceptable, since the user almost certainly hasn't focused the guest in those few hundred ms.

### 7.3 `setWindowOpenHandler` — always deny + forward

The handler:
1. Calls `validateUrl(url)` — same scheme allowlist as the URL bar (http/https only, bare-host auto-promote applies, search promotion does NOT).
2. If valid and main window alive: `webContents.send('browser:new-tab-from-popup', { url: valid })`.
3. **Always returns `{ action: 'deny' }`** regardless of validation outcome.

Effects:
- Native popup window is NEVER opened (no detached `BrowserWindow` with default webPrefs).
- All popup destinations flow through the same hardened guest pipeline as URL-bar input.
- Defense in depth: even if a future renderer change forwarded raw URLs without validation, main re-validates.

### 7.4 What is NOT installed (intentional gaps)

- No `will-navigate` listener. A guest navigating to `file://` mid-session via in-page navigation/redirect is not blocked at the navigation layer (sandbox + webSecurity still apply, limiting impact).
- No `will-redirect` listener (same gap).
- No `did-fail-load` in main — renderer handles error overlay (browser.renderer.js:161-175).
- No `app.on('web-contents-created', ...)` — hardening is exclusively per-guest via attach events. Future child windows of any other kind would NOT inherit this hardening.

---

## 8. URL validation flow

### 8.1 The scheme allowlist — `validateUrl(input)`

`browser.main.js:8-20`:

```js
function validateUrl(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch (_) { /* fall through */ }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    try { return new URL('https://' + trimmed).toString(); } catch (_) { return null; }
  }
  return null;
}
```

**Exactly two schemes allowed: `http:` and `https:`**. Everything else rejected:
- `javascript:` → parses; non-http(s); bare-host regex doesn't match → `null`.
- `file:`, `data:`, `chrome:`, `chrome-extension:`, `blob:`, `view-source:`, `about:`, `ftp:`, `mailto:`, `ws:`, `wss:` — all rejected by the same path.

Bare-host auto-promote regex: `/^[\w.-]+\.[a-z]{2,}/i`. Matches `example.com`, `sub.example.io`. Does NOT match `localhost` (no `.tld`), raw IPs, or anything that already parsed as a URL.

### 8.2 `canonicalizeUrlOrSearch(input)` — URL bar logic

`browser.main.js:22-34`:

```js
function canonicalizeUrlOrSearch(input) {
  const valid = validateUrl(input);
  if (valid) return valid;
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;
  // If it parses as a URL but the scheme isn't http/https, reject (silent no-op).
  // This blocks javascript:, file:, data:, chrome:, etc. from being promoted to search.
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  } catch (_) { /* not parseable as URL — fall through to search */ }
  return 'https://search.brave.com/search?q=' + encodeURIComponent(trimmed);
}
```

Three-stage decision tree:
1. Valid URL (per `validateUrl`) → canonical URL.
2. Parses as URL but non-http(s) (e.g., `javascript:alert(1)`) → `null` (silent reject — prevents `javascript:` from being wrapped in a Brave Search query).
3. Doesn't parse as URL → wrap in `https://search.brave.com/search?q=<encoded>`.

Query is properly `encodeURIComponent`-encoded — no injection vector on the search side.

### 8.3 Auto-promote behavior per call site

| Call site | Bare-host auto-promote | Search-query auto-promote | Function |
|---|---|---|---|
| URL bar Enter | YES (via embedded `validateUrl`) | YES | `canonicalizeUrlOrSearch` |
| Direct `browser:validate-url` | YES | NO | `validateUrl` |
| Popup re-validation in `setWindowOpenHandler` | YES | NO | `validateUrl` |

Documentation discrepancy: `.claude/rules/browser.md:21` says "Bare hosts and search queries are NOT auto-promoted for popups". This is partially incorrect — bare hosts ARE promoted (popups use `validateUrl`, which does promotion). Only search-query promotion is correctly omitted for popups. Real-world impact is minimal — for exploitation a guest would have to call `window.open('example.com')`, which would resolve to a normal `https://example.com`.

### 8.4 Why popup URLs are re-validated

`setWindowOpenHandler` re-validates at `browser.main.js:78` even though the URL bar already validates upstream. Reasons:
1. Popup URLs never go through the URL bar — they come from `window.open(url)` in untrusted guest content. No upstream validation exists.
2. Defense in depth.
3. Scheme attack surface — a guest could try `window.open('javascript:fetch(...)')` to escape the sandbox; re-validation drops it cold.

### 8.5 Failure behavior

All validation failures are silent:
- `browser:validate-url` → `{ ok: false }`.
- `browser:canonicalize-or-search` → `{ ok: false }`; renderer silently skips navigation if `result.ok` is false.
- Popup re-validation → no IPC sent, popup denied, renderer never learns.
- Malformed `register-guest` / `unregister-guest` payloads → silent `return;`.

No telemetry, no logging, no UI feedback. A user pasting `javascript:alert(1)` into the URL bar gets nothing — input simply doesn't navigate.

---

## 9. Popup handling — full trace

A complete walkthrough of `<a target="_blank">` clicked inside a guest:

1. **Guest invokes `window.open(url, '_blank')`** (or `<a target=_blank>`, programmatic, form submit).
2. **Chromium consults `<webview>`'s `allowpopups`**. The element has `allowpopups` (browser.renderer.js:58). **Without this attribute, the popup is silently dropped before `setWindowOpenHandler` ever sees it.**
3. **`setWindowOpenHandler` fires in main** (browser.main.js:77), installed at `did-attach-webview` time.
4. **URL is re-validated** at browser.main.js:78 via `validateUrl(url)`. Same http/https allowlist; bare-host auto-promote applies; search-query promotion does NOT.
5. **If validation passes and main window is alive**:
    ```js
    if (valid && registeredMainWindow && !registeredMainWindow.isDestroyed()) {
      registeredMainWindow.webContents.send('browser:new-tab-from-popup', { url: valid });
    }
    ```
6. **Handler always returns `{ action: 'deny' }`** (browser.main.js:82). Native popup suppressed unconditionally.
7. **Preload bridges the IPC** (preload.js:108-111):
    ```js
    onBrowserNewTabFromPopup: (callback) => {
      ipcRenderer.removeAllListeners('browser:new-tab-from-popup');
      ipcRenderer.on('browser:new-tab-from-popup', (_, payload) => callback(payload));
    },
    ```
8. **Renderer's BrowserFeature.init subscriber** (browser.renderer.js:31-33):
    ```js
    window.terminalAPI.onBrowserNewTabFromPopup((payload) => {
      if (payload && payload.url) TabsFeature.newTab('browser', { payload: { url: payload.url } });
    });
    ```
9. **`TabsFeature.newTab('browser', ...)`** → dispatches to the `'browser'` handler → `createBrowserTab(tabId, url)` → fresh `<webview>` pointed at the validated URL.

External links open as new in-app tabs with the same hardened guest pipeline — never as detached `BrowserWindow`s.

---

## 10. Keyboard chord interception

### 10.1 Why this exists

Terminal's `before-input-event` is installed on `mainWindow.webContents` (terminal.main.js:153) for Ctrl+T/W/Tab/1-9. **That handler does NOT fire when focus is inside a guest `<webview>`** — Chromium routes input events directly to the guest process.

Without per-guest interception, all tab-navigation chords would be swallowed by the guest browser when focus is in a browser tab. The user would be unable to open or switch tabs.

### 10.2 `attachGuestHandlers(webContentsId)` — `browser.main.js:88-146`

Idempotent via `_retteliKeyHandlerAttached` sentinel (line 92). Installs:

```js
guest.on('before-input-event', (event, input) => {
  if (input.type !== 'keyDown') return;
  if (!registeredMainWindow || registeredMainWindow.isDestroyed()) return;
  // ... chord matching
});
```

### 10.3 Intercepted chord set

Each chord calls `event.preventDefault()` (stops guest from receiving it) and dispatches an IPC.

| Chord | Channel | Payload | Renderer end-state |
|---|---|---|---|
| `Ctrl+T` | `browser:guest-key-tab-action` | `{action: 'new'}` | New TERMINAL tab (no Ctrl+T variant for browser) |
| `Ctrl+W` | `browser:guest-key-tab-action` | `{action: 'close'}` | Close active tab |
| `Ctrl+Tab` | `browser:guest-key-tab-action` | `{action: 'next'}` | Cycle forward |
| `Ctrl+Shift+Tab` | `browser:guest-key-tab-action` | `{action: 'prev'}` | Cycle backward |
| `Ctrl+1..9` | `browser:guest-key-tab-action` | `{action: 'goto', index: N}` | Switch to Nth tab |
| `Ctrl+L` | `browser:guest-key-content` | `{tabId, action: 'focus-url'}` | Focus + select URL bar |
| `Alt+ArrowLeft` | `browser:guest-key-content` | `{tabId, action: 'back'}` | `wv.goBack()` if can |
| `Alt+ArrowRight` | `browser:guest-key-content` | `{tabId, action: 'forward'}` | `wv.goForward()` if can |
| `Ctrl+R` | `browser:guest-key-content` | `{tabId, action: 'reload'}` | `wv.reload()` |

Tab-action chords are matched first and short-circuit. Content chords require resolving the tabId from `guestByContentsId.get(webContentsId)` (line 122); early return if not mapped.

Modifier hygiene: all tab-action chords assert `!input.shift && !input.alt` (except Ctrl+Tab where Shift is the cycle-direction modifier). Content chords assert proper modifier exclusion. This prevents accidental matches like Ctrl+Shift+T from being captured.

### 10.4 Renderer dispatch

Tab-action listener at `tabs.renderer.js:56-65`:

```js
window.terminalAPI.onBrowserGuestKeyTabAction((payload) => {
  if (!payload || !payload.action) return;
  switch (payload.action) {
    case 'new':   addTab(); break;
    case 'close': closeActiveTab(); break;
    case 'next':  cycleTab(1); break;
    case 'prev':  cycleTab(-1); break;
    case 'goto':  if (typeof payload.index === 'number') gotoTab(payload.index); break;
  }
});
```

Content-key dispatcher at `browser.renderer.js:192-212` (`handleGuestContentKey`) — switch on action, calls `webview.focus/select/goBack/goForward/reload` with `try/catch` around each.

Critical: content payloads carry **`tabId` from main's mapping**, NOT from `getActiveTabId()`. Focus may have moved between the keypress and the IPC arrival; the captured tabId is the right answer.

### 10.5 What is NOT intercepted

DevTools (`Ctrl+Shift+I`, `F12`), zoom (`Ctrl+±0`), find-in-page (`Ctrl+F`), copy/paste, Esc — all pass to Chromium defaults inside the guest. Explicit out-of-scope per the original plan.

---

## 11. Persistence

### 11.1 Schema

Each saved tab entry:

```js
{
  type: 'terminal' | 'browser',
  customName: string | null,
  theme: string | null,
  payload: object | null,
}
```

Browser payload: `{ url: 'https://...' }`. Terminal payload: `{}`.

Persisted under `tabState` in `~/.yourterm/config.json`:

```json
{
  "tabState": [
    { "type": "terminal", "customName": null, "theme": "crimson", "payload": {} },
    { "type": "browser",  "customName": null, "theme": null,      "payload": { "url": "https://search.brave.com/" } }
  ]
}
```

### 11.2 `TabState` (tabs.state.js:1-14)

```js
const TabState = (function () {
  async function load() {
    const config = await window.terminalAPI.getConfig();
    return config?.tabState || [];
  }
  function save(tabs) {
    window.terminalAPI.setConfig({ tabState: tabs });
  }
  return { load, save };
})();
```

Piggybacks on shared config. The actual on-disk store is `~/.yourterm/config.json` managed by `src/main/shared/config.js` (atomic write via `.tmp` + rename, debounced).

### 11.3 Save triggers

`saveTabState()` is called from: color change, addTab, closeTab, rename commit, reorder finish, and `TabsFeature.requestSave()` (used by browser via `scheduleSave`).

`isRestoring` (tabs.renderer.js:13) gates `saveTabState` — restore-loop `addTab` calls don't each write a partial snapshot.

### 11.4 Restore (`bootInitialTabs`)

`tabs.renderer.js:128-162`:

```js
if (saved.length > 0) {
  isRestoring = true;
  for (const entry of saved) {
    const type = entry.type || 'terminal'; // backward-compat: pre-feature entries
    const payload = entry.payload || null;
    addTab(entry.customName, entry.theme, { type, payload, restoring: true });
  }
  isRestoring = false;
  ...
}
```

`restoring: true` makes `addTab` call `handler.restore(tabId, payload || {})` instead of `handler.create(...)`. For browser, this calls `createBrowserTab(tabId, payload.url || LANDING_URL)` — fully equivalent to fresh creation, just with the saved URL.

Backward compat: entries missing `type` default to `'terminal'`. The original payload-less terminal entries restore cleanly.

Cold-start CLI args (`--cwd`/`--cmd`) are appended as an EXTRA tab, never overwriting a restored tab (lines 152-155).

---

## 12. Cross-feature integration

### 12.1 Strict feature isolation upheld

`browser.main.js` imports only `electron` (line 2). No imports from `../shared/*`, no imports from other features. Self-contained.

`browser.renderer.js` depends on TabsFeature only (five methods listed in `.claude/rules/browser.md:16`):
- `registerType` (line 23)
- `getActiveTabId` (line 44, twice)
- `newTab` (line 32)
- `updateTabTitle` (line 159)
- `requestSave` (line 189)

### 12.2 Documented cross-cutting exceptions

- `src/main/index.js:29, 131, 145` — bootstrap imports + register/cleanup wiring (all features have this).
- `src/main/index.js:117` — `webviewTag: true` in BrowserWindow webPreferences. The one host-level concession the browser feature requires.
- `src/preload/preload.js:103-119` — seven preload exposures for the seven browser IPC channels. Preload is a shared resource — documented in CLAUDE.md as "only edit when adding IPC channels".

### 12.3 Why other features naturally skip browser tabs

Browser tabs use `.browser-panel`. Other features iterate `.terminal-panel` and skip browser tabs without needing explicit type checks:

- **GridView** (grid-view.renderer.js:37, 74, 88, 106, 137, 151): all `.terminal-panel` selectors. Grid mode tiles only terminal tabs; browser tabs remain hidden via `activateTab`'s cross-type sweep. `TerminalFeature.getTabCount()` (terminal.renderer.js:272) returns `terminals.size`, so it already excludes browser tabs — grid won't enter with only browser tabs open.
- **Drag** (drag.renderer.js:22): `closest('.terminal-panel')` returns null for drops on browser panels — drops silently fall through. Browser tabs use Chromium's native DnD instead.
- **RecentPaths** (recent-paths.renderer.js:24): subscribes to `TerminalFeature.onTerminalCreated`, which only fires for terminal tabs.
- **Clipcap, Naming**: terminal-specific or focus-driven — no browser interaction.

### 12.4 Latent crash-avoidance in NamingFeature

`naming.renderer.js:90-91` — guards `.focus()` on `TerminalFeature.getTerminal()` result because browser tabs return undefined:

```js
const term = TerminalFeature.getTerminal();
if (term && typeof term.focus === 'function') term.focus();
```

Without this guard, closing the rename modal while a browser tab is active would crash.

### 12.5 Theme behavior for browser tabs

`tabs.renderer.js:341-347` (`applyFullTheme`) runs for every tab activation. For browser tabs, `TerminalFeature.getTerminal()` is undefined; the `if (terminal)` guard prevents crash. CSS variables are still updated, so the URL bar focus border reads `var(--tab-color)` (browser.styles.css:48) and picks up the active tab's theme.

### 12.6 Visual decoration

`tabs.renderer.js:381` — `tabEl.classList.add('type-' + type)` → browser tab buttons get class `type-browser`. CSS at `browser.styles.css:66-71`:

```css
.tab.type-browser .tab-title::before {
  content: '\1F310';   /* globe emoji */
  font-size: 11px;
  margin-right: 4px;
  opacity: 0.7;
}
```

### 12.7 Shared session partition

All browser tabs use `partition="persist:brave-tabs"`. Cookies, localStorage, IndexedDB, service workers are shared across all browser tabs and persist across restarts. No per-tab isolation — by design, matching how a normal browser's "new tab in same window" behaves.

---

## 13. End-to-end pipeline — sequence from right-click to ready browser

```
USER                            RENDERER                                    MAIN                            GUEST
 |                                |                                          |                               |
 | right-click +                  |                                          |                               |
 |--------------------------------> contextmenu handler                      |                               |
 |                                | (tabs.renderer.js:114)                   |                               |
 |                                | e.preventDefault(); e.stopPropagation()  |                               |
 |                                | addTab(undef, undef, {type:'browser'})   |                               |
 |                                |                                          |                               |
 |                                | tabId = 'tab-N'                          |                               |
 |                                | tabTypes.set(tabId, 'browser')           |                               |
 |                                | build tab button DOM (class type-browser)|                               |
 |                                | handler = typeHandlers.get('browser')    |                               |
 |                                | handler.create(tabId, {payload:null,...})|                               |
 |                                |                                          |                               |
 |                                | createBrowserTab(tabId, LANDING_URL)     |                               |
 |                                | build .browser-panel + toolbar           |                               |
 |                                | build <webview> with attrs:              |                               |
 |                                |   partition, allowpopups, webpreferences |                               |
 |                                |   useragent, src                         |                               |
 |                                | contentArea.appendChild(panel)           |                               |
 |                                |                                          |                               |
 |                                |                          Chromium attaches guest                          |
 |                                |                                          |                               |
 |                                |              will-attach-webview ------> | clamp nodeIntegration=false   |
 |                                |              (browser.main.js:64)        | clamp contextIsolation=true   |
 |                                |                                          | clamp sandbox=true            |
 |                                |                                          | clamp webSecurity=true        |
 |                                |                                          | force partition=brave-tabs    |
 |                                |                                          |                               |
 |                                |              did-attach-webview -------> | setWindowOpenHandler(deny)    |
 |                                |              (browser.main.js:76)        | attachGuestHandlers(id)       |
 |                                |                                          | install before-input-event ---> guest
 |                                |                                          | sentinel _retteliKeyHandler   |
 |                                |                                          |                               |
 |                                |                                          | guest navigates to LANDING_URL --> renders
 |                                |                                          |                               |
 |                                | activateTab(tabId)                       |                               |
 |                                | type-agnostic hide-others sweep          |                               |
 |                                | activateBrowserTab(tabId): show panel    |                               |
 |                                | applyFullTheme(themeName)                |                               |
 |                                |                                          |                               |
 |                                | saveTabState() -> persists tabState      |                               |
 |                                |                                          |                               |
 |                                |       <webview> 'dom-ready' fires                                        |
 |                                | refresh nav state, enable reload         |                               |
 |                                | webContentsId = webview.getWebContentsId()                               |
 |                                | browserRegisterGuest({tabId,wcId}) ----> | guestByContentsId.set(wcId,tab)|
 |                                |                                          | tabIdByGuest.set(tab,wcId)    |
 |                                |                                          | attachGuestHandlers (no-op)   |
 |                                |                                          |                               |
 | sees ready browser tab         |                                          |                               |
 |                                |                                          |                               |
 |--types url + Enter------------>| url bar keydown                          |                               |
 |                                | browserCanonicalizeOrSearch(input) ----> | canonicalize-or-search        |
 |                                |                                          | validateUrl or wrap in Brave  |
 |                                |       <----------------- {ok:true,url} or {ok:false}                     |
 |                                | if ok: webview.loadURL(url) ----------------------------------------> navigate
 |                                |                                          |                               |
 |                                |       <webview> 'did-navigate' fires                                     |
 |                                | refresh url bar, refresh nav state       |                               |
 |                                | scheduleSave(tabId)  ---------- 500ms debounce ---->                     |
 |                                | TabsFeature.requestSave()                |                               |
 |                                | saveTabState() persists new URL          |                               |
 |                                |                                          |                               |
 |--clicks link with target=_blank in guest------------------------------------------------------------------> window.open(url)
 |                                |                                          |                               |
 |                                |                                          | setWindowOpenHandler fires    |
 |                                |                                          | validateUrl(url)              |
 |                                |       <----- 'browser:new-tab-from-popup' {url:valid}                    |
 |                                |              IF valid && win alive       | return {action:'deny'}        |
 |                                | TabsFeature.newTab('browser',{url})      |                               |
 |                                | -> addTab(... type:'browser', payload:{url})                             |
 |                                | -> createBrowserTab(newTabId, url) -- (whole sequence repeats) ---->     |
 |                                |                                          |                               |
 |--closes browser tab            |                                          |                               |
 |                                | closeBrowserTab(tabId)                   |                               |
 |                                | panel.remove() -> guest webContents destroyed                            |
 |                                | browserUnregisterGuest({tabId}) -------> | tabIdByGuest.get(tabId) -> wcId|
 |                                | clear per-tab Maps                       | guestByContentsId.delete(wcId)|
 |                                | clear save debounce                      | tabIdByGuest.delete(tabId)    |
```

---

## 14. Files involved (manifest)

### Renderer (host BrowserWindow)
| File | Role |
|---|---|
| `renderer/index.html` | Loads `browser.styles.css` (line 18) and `browser.renderer.js` (line 67, after tabs.renderer.js). |
| `renderer/app.js` | Init order: Tabs.init → Terminal.init → Browser.init → ... → Tabs.bootInitialTabs. |
| `renderer/features/tabs/tabs.renderer.js` | `+` button + right-click handler (114-118), `addTab`, type registry, `activateTab`, key-action subscriber. |
| `renderer/features/tabs/tabs.state.js` | Tab list load/save via shared config. |
| `renderer/features/tabs/tabs.styles.css` | `.tab-add-btn`, `.tab-context-menu` styling. |
| `renderer/features/browser/browser.renderer.js` | Registers 'browser' type, manages `.browser-panel` + `<webview>` lifecycle, toolbar, content-key dispatcher. |
| `renderer/features/browser/browser.styles.css` | `.browser-panel`, `.browser-toolbar`, `.browser-webview`, `.browser-error-overlay`, `.tab.type-browser` globe marker. |

### Preload
| File | Role |
|---|---|
| `src/preload/preload.js:103-119` | Seven browser-related contextBridge methods. |

### Main process
| File | Role |
|---|---|
| `src/main/index.js` | BrowserWindow with `webviewTag: true` (117); imports and calls `browser.register(mainWindow)` (131); calls `browser.cleanup()` on close (145). |
| `src/main/features/browser/browser.main.js` | IPC handlers, guest hardening, popup interception, key forwarding, bidirectional guest mapping. |

### Rules / docs
| File | Role |
|---|---|
| `.claude/rules/browser.md` | Feature ownership, IPC channels, popup-handler invariant, `.browser-panel` vs `.terminal-panel` invariant. |
| `.claude/rules/tabs.md` | Type registry mechanics, persistence schema, right-click on `+`. |
| `.claude/rules/terminal.md` | Type registry symmetry. |
| `docs/browser-plan.md` | Historical design + hand-off rationale. |
| `FEATURE-MAP.md` | Repo-wide feature index. |

---

## 15. Known gaps / soft spots (not exploits, defense-in-depth)

1. **`cleanup()` doesn't unhook attach listeners.** `will-attach-webview` / `did-attach-webview` on `mainWindow.webContents` and per-guest `before-input-event` handlers persist after `cleanup()`. Masked in practice by mainWindow destruction killing all WebContents; would leak in a hot-reload scenario.
2. **No `'destroyed'` listener on guest WebContents.** If the renderer's `browser:unregister-guest` is missed (renderer crash, race), the maps leak entries. Numeric `webContentsId` recycling could later route keys to a wrong tab.
3. **`will-attach-webview` doesn't explicitly null `params.preload`.** The renderer doesn't set a preload today, but defense in depth would clear it.
4. **No `will-navigate` / `will-redirect` blocks.** A guest navigating to `file://` mid-session via in-page navigation/redirect isn't blocked at the navigation layer. Sandbox + webSecurity still apply, limiting impact.
5. **Rule doc inaccuracy.** `.claude/rules/browser.md:21` says popups don't auto-promote bare hosts. They actually do (via `validateUrl`). Only search-query promotion is correctly omitted.
6. **Legacy `main.js` at repo root lacks `webviewTag`.** Dead code today but a footgun if `package.json`'s `main` is ever rewired.
7. **All validation failures are silent.** Rejected URLs (in the URL bar or popups), malformed IPC payloads — none produce telemetry/logging/UI feedback. Debugging requires reading source.
8. **No focus on activation.** Switching to a browser tab leaves keyboard focus wherever it was. User must click into the webview/URL bar. Asymmetric with terminal behavior.
9. **URL bar briefly empty.** Not pre-populated; only filled on `did-navigate`. Minor cosmetic flash on first paint.
10. **`crimson-dark` theme name default.** Right-click path passes `themeName = undefined`; the fallback string at tabs.renderer.js:371 doesn't match any palette entry — leaves the tab uncolored rather than crashing.

---

## 16. Summary

The browser-tab pipeline is a tightly-scoped feature module that:

- **Triggers** from a single contextmenu listener on the `+` button (4 lines).
- **Dispatches** through TabsFeature's string-keyed type registry — adding a new tab kind is purely additive.
- **Renders** a `.browser-panel` containing a hand-built toolbar and an Electron `<webview>`, configured for Brave-compatible UA and a shared persistent session partition.
- **Hardens** the guest at two main-process attach hooks (`will-attach-webview` for security clamps, `did-attach-webview` for popup interception and key forwarding) so the renderer cannot loosen guest security.
- **Validates** every URL with a strict http/https allowlist; routes URL-bar input through a canonicalize-or-search helper that auto-promotes bare hosts and falls back to Brave Search; re-validates popup URLs as a defense-in-depth measure.
- **Maps** each guest webContents to its tabId bidirectionally for accurate key routing.
- **Intercepts** five tab-action chords and four content chords inside guest focus, forwarding them via two push IPC channels.
- **Persists** browser tabs (URL + name + theme) under `tabState` in `~/.yourterm/config.json`, restoring them on next launch via a `restore` handler that's functionally identical to `create`.
- **Stays strictly isolated** from other features — no imports from other feature folders, no shared-module edits. Cross-cutting touches confined to bootstrap (`src/main/index.js`), preload (`src/preload/preload.js`), and one BrowserWindow flag.

The full chain from user right-click to a ready, interactive browser tab is on the order of a few hundred milliseconds, dominated by Chromium guest spawn and initial navigation. All IPC seams use the documented `browser:*` channel naming. All security-critical decisions (URL validation, guest hardening, popup denial) live in `src/main/features/browser/browser.main.js` — a single 159-line file.
