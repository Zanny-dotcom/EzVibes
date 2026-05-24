# Copy/Paste Fix — Parallel Orchestration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Restore Ctrl+C / Ctrl+V / right-click copy-paste across the whole app — the search bar (and any native input), the xterm terminal selection (copy), and the xterm pty (paste) — while preserving Ctrl+C as SIGINT inside the terminal.

**Architecture:** Three files change in parallel under a Phase 0 contract:
- `main.js` owns the Electron Edit menu (one accelerator: Ctrl+V), the native right-click handler for editable elements, and the clipboard IPC handlers.
- `preload.js` owns the clipboard bridge surfaced as `controlPanel.readClipboard()` / `controlPanel.writeClipboard(text)`.
- `renderer/app.js` owns the xterm.js custom-key handler (Ctrl+Shift+C / Ctrl+Shift+V) and the terminal right-click context menu (reusing the existing `.context-menu` DOM/CSS).

**Tech stack:** Electron 33 (`clipboard` module, `Menu`, `webContents.on('context-menu')`), node-pty 1.1, `@xterm/xterm` 5.5 (`term.attachCustomKeyEventHandler`, `term.getSelection()`, `term.selectAll()`), vanilla JS/HTML/CSS.

---

## Why parallel sub-agents

Three independent file edits with a single locked contract → zero merge risk. The renderer slice (Agent C) is biggest; ultrathink is essential to attach the xterm handler inside the IIFE without breaking the existing session lifecycle, narration handlers, or focus-aware preview behavior.

---

## Phase 0 — Contract Lock-In

### IPC channels (main creates handlers, preload consumes)

| Channel | Args | Returns |
|---|---|---|
| `clipboard:read` | none | `string` (clipboard text, empty if none) |
| `clipboard:write` | `text: string` | nothing |

### Preload public API (renderer consumes)

```javascript
controlPanel.readClipboard()           // → Promise<string>
controlPanel.writeClipboard(text)      // → Promise<void>
```

These are ADDITIONS to the existing `controlPanel` object — do not rename or restructure existing methods.

### Application menu (main owns)

```javascript
Menu.setApplicationMenu(Menu.buildFromTemplate([
  {
    label: 'Edit',
    submenu: [
      { role: 'paste' }, // the only accelerator we want registered: Ctrl+V
    ],
  },
]));
```

Only `paste` is in the app menu. We deliberately do NOT add `copy`/`cut`/`selectAll` accelerators because:
- Chromium handles Ctrl+C / Ctrl+X / Ctrl+A natively on text inputs once any app menu is set.
- Adding them as accelerators would also intercept Ctrl+C in the terminal and break SIGINT to the pty.

Existing `win.setMenuBarVisibility(false)` stays — menu is hidden but Ctrl+V accelerator still registers.

### Right-click context menu (main, for editable elements)

```javascript
win.webContents.on('context-menu', (event, params) => {
  if (!params.isEditable && !params.selectionText) return;
  const items = [];
  if (params.editFlags.canCut)       items.push({ role: 'cut' });
  if (params.editFlags.canCopy)      items.push({ role: 'copy' });
  if (params.editFlags.canPaste)     items.push({ role: 'paste' });
  if (items.length && params.editFlags.canSelectAll) items.push({ type: 'separator' });
  if (params.editFlags.canSelectAll) items.push({ role: 'selectAll' });
  if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
});
```

Folder cards and the terminal-host element preventDefault their contextmenu → Chromium does not emit `context-menu` to main → this handler doesn't fire there. Only inputs/textareas trigger it.

### Terminal keybindings (renderer, via xterm `attachCustomKeyEventHandler`)

- **Ctrl+Shift+C** — copy `term.getSelection()` to clipboard (no-op if no selection).
- **Ctrl+Shift+V** — read clipboard, write to pty.
- Everything else (including plain Ctrl+C / Ctrl+V) passes through to xterm. Ctrl+V hits xterm's textarea, fires Chromium's paste event, xterm forwards to pty.

### Terminal right-click menu (renderer)

Reuses the existing `#context-menu` DOM element and `.context-menu*` CSS via the existing `addMenuItem(label, action, disabled)` helper. Items in order:
1. **Copy** — disabled if `term.getSelection()` is empty.
2. **Paste**
3. **Select All** — `term.selectAll()`

---

## Phase 1 — Parallel Build (dispatch all three in ONE message)

`subagent_type: general-purpose`. Every prompt ends with the literal word `ultrathink`.

### Agent A — `main.js`

**Scope:**
- Import `Menu` and `clipboard` from `electron` (extend the existing destructure).
- After `app.whenReady()` (or before `createWindow()`), call `Menu.setApplicationMenu` with the single-paste Edit submenu.
- Inside `registerIpc(mainWindow)`, add `win.webContents.on('context-menu', …)` (note: the function receives `mainWindow` — use it).
- Add two `ipcMain.handle` calls for `clipboard:read` and `clipboard:write`.
- Do NOT modify the existing IPC handlers, PTY logic, or window options.

**Critical preconditions:**
- The existing `const { app, BrowserWindow, ipcMain } = require('electron');` line must be extended, not replaced wholesale.
- The webContents `context-menu` listener must check `params.isEditable || params.selectionText` and skip otherwise (so it doesn't fire on folder cards or terminal — both of which preventDefault).
- The Edit menu must contain ONLY `{ role: 'paste' }` — adding `copy`/`cut`/`selectAll` accelerators would break terminal Ctrl+C.

### Agent B — `preload.js`

**Scope:**
- Extend the existing `controlPanel` object exposed via `contextBridge.exposeInMainWorld` with two methods: `readClipboard` and `writeClipboard`.
- Do not touch any existing method.

**Exact additions** (inside the existing object literal, place after `closeTerminal`):

```javascript
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
```

### Agent C — `renderer/app.js`

**Scope:** Wire xterm.js to support Ctrl+Shift+C / Ctrl+Shift+V, and add a right-click context menu on the terminal area. Must work inside the existing IIFE without disturbing narration handlers, preview logic, or the session pipeline.

**Change 1 — Inside `createSession(folderPath)`, after `windowEl.querySelector('.minimize').addEventListener(...)` and `windowEl.querySelector('.close').addEventListener(...)`, before `return session;` — attach the xterm custom-key handler and the contextmenu listener:**

```javascript
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;
      if (!event.ctrlKey || !event.shiftKey) return true;
      const key = event.key.toLowerCase();
      if (key === 'c') {
        const selection = term.getSelection();
        if (selection) api.writeClipboard(selection);
        return false;
      }
      if (key === 'v') {
        api.readClipboard().then((text) => {
          if (text) api.writeTerminal(session.id, text);
        });
        return false;
      }
      return true;
    });

    terminalEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTerminalContextMenu(session, event.clientX, event.clientY);
    });
```

(Note: `session.id`, `session.term`, and `session.terminalEl` are already constructed at this point. The handler captures `session` by closure.)

**Change 2 — Add `showTerminalContextMenu(session, x, y)` helper.** Place it in the helper block (between `escapeHtml` and `getNarration`):

```javascript
  function showTerminalContextMenu(session, x, y) {
    hideContextMenu();
    els.contextMenu.innerHTML = '';

    const selection = session.term.getSelection();
    addMenuItem('Copy', () => {
      const sel = session.term.getSelection();
      if (sel) api.writeClipboard(sel);
    }, !selection);
    addMenuItem('Paste', async () => {
      const text = await api.readClipboard();
      if (text) api.writeTerminal(session.id, text);
    });
    addMenuItem('Select All', () => {
      session.term.selectAll();
    });

    els.contextMenu.hidden = false;
    const rect = els.contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 12);
    const top = Math.min(y, window.innerHeight - rect.height - 12);
    els.contextMenu.style.left = `${Math.max(12, left)}px`;
    els.contextMenu.style.top = `${Math.max(12, top)}px`;
  }
```

**Critical preconditions:**
- Existing `showContextMenu(entry, x, y, sourceCard)` for folder cards stays untouched.
- `addMenuItem(label, action, disabled)` signature is already used — do not change it.
- The xterm handler must `return false` ONLY when it consumes the event; otherwise `return true` so xterm processes normally.
- Do not break the existing narration handlers (`session.term.onData → handleTerminalInput`) or the click/dblclick preview logic.

**Acceptance:** `node --check renderer/app.js` exits 0.

---

## Phase 2 — Integration Verification (orchestrator)

- [ ] `node --check main.js` exits 0.
- [ ] `node --check preload.js` exits 0.
- [ ] `node --check renderer/app.js` exits 0.
- [ ] Grep verifies the contract names appear on both producer and consumer sides:
  - `clipboard:read` → ≥2 hits (main.js + preload.js)
  - `clipboard:write` → ≥2 hits (main.js + preload.js)
  - `readClipboard` → ≥2 hits (preload.js + renderer/app.js)
  - `writeClipboard` → ≥2 hits (preload.js + renderer/app.js)
  - `attachCustomKeyEventHandler` → ≥1 hit in renderer/app.js
  - `showTerminalContextMenu` → ≥2 hits in renderer/app.js (definition + caller)

---

## Phase 3 — Runtime verification (user runs `npm start`)

- [ ] Type in search bar; Ctrl+A selects all → Ctrl+C copies → Ctrl+V pastes back (works).
- [ ] Right-click in search bar → native menu appears with Cut/Copy/Paste/Select All.
- [ ] Launch a Claude session.
- [ ] Press Ctrl+C in terminal → still triggers the "press Ctrl+C again to exit" interrupt prompt (SIGINT preserved).
- [ ] Select text in terminal with mouse → Ctrl+Shift+C copies to clipboard → paste somewhere else to verify.
- [ ] Place caret in terminal → Ctrl+V pastes from clipboard into the pty.
- [ ] Ctrl+Shift+V also pastes into the pty (alternate keybinding).
- [ ] Right-click in terminal → custom menu with Copy (disabled if no selection) / Paste / Select All.
- [ ] Right-click a folder card → existing folder menu still shows (regression check).

---

## Phase 4 — Commit

```powershell
git add main.js preload.js renderer/app.js docs/superpowers/plans/2026-05-24-copy-paste-fix-parallel.md
git commit -m @'
fix: copy/paste across app (search bar, terminal selection, paste into pty)

- main.js: app menu with only Ctrl+V accelerator + webContents context-menu
  handler for editable elements + clipboard IPC
- preload.js: readClipboard / writeClipboard bridge
- renderer/app.js: xterm Ctrl+Shift+C copies selection, Ctrl+Shift+V pastes;
  terminal right-click menu (Copy/Paste/Select All) reuses existing
  .context-menu DOM; Ctrl+C in terminal still sends SIGINT
'@
```

---

## Why this specific menu strategy (one paste accelerator, no copy accelerator)

If we added `{ role: 'copy' }` with the default Ctrl+C accelerator, Electron's menu would intercept Ctrl+C *globally* — including inside xterm's hidden textarea. xterm would never receive Ctrl+C, and the pty would never receive `\x03`, breaking Claude's interrupt. By leaving Ctrl+C off the menu and trusting Chromium's native input handling (which only requires the presence of *any* application menu), inputs still copy correctly and the terminal still SIGINTs correctly. Ctrl+V is safe to register because xterm's textarea participates in Chromium's paste event — pasting into the focused terminal naturally forwards to the pty.
