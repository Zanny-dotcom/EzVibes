# Folder Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-click `Delete` action to folder cards that confirms via an in-renderer modal, then moves the folder to the Windows Recycle Bin via Electron's `shell.trashItem()`. Block deletion when the folder has a live Claude/Codex session.

**Architecture:** Renderer adds a `Delete` item (red-tinted, disabled with tooltip when a session exists) to the existing directory context menu. Click → `confirmDestructiveClose` modal already in the codebase → `await api.deleteFolder({ path })` → new `fs:delete-folder` IPC handler in main → `shell.trashItem(absPath)`. Errors flow to the existing `showInboxToast(..., 'error')`; success refreshes the listing and adds a narration entry.

**Tech Stack:** Electron 42, `shell.trashItem` (Promise-based), context-isolated IPC (`window.ezvibes` bridge in `preload.js`), `confirmDestructiveClose` modal helper at `renderer/app.js:1733`, `showInboxToast(text, kind)` toast helper at `renderer/app.js:1382`, JSONL diagnostics log via `writeLog(level, event, details)` in `main.js`.

**Note on tests:** This project has no test framework (per `CLAUDE.md`: "No tests yet"). Verification in each task is by running the app and observing behavior — `npm start`, exercise the path, check `%APPDATA%\EZvibes\logs\ezvibes-YYYY-MM-DD.jsonl` for the logged event.

---

## Task 1: Extend `addMenuItem` to accept an options object

**Files:**
- Modify: `renderer/app.js:937-950`

**Why:** The current `addMenuItem(label, action, disabled)` signature can't carry a `title` (for the disabled-state tooltip) or a `variant` (for the red `Delete` styling). One small backwards-compatible extension covers both.

- [ ] **Step 1: Replace `addMenuItem` with the extended signature**

Find this block at `renderer/app.js:937-950`:

```js
  function addMenuItem(label, action, disabled) {
    const button = document.createElement('button');
    button.className = 'context-menu-item';
    button.textContent = label;
    button.disabled = !!disabled;
    if (action) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        hideContextMenu();
        action();
      });
    }
    els.contextMenu.appendChild(button);
  }
```

Replace with:

```js
  function addMenuItem(label, action, optionsOrDisabled) {
    const opts = (optionsOrDisabled && typeof optionsOrDisabled === 'object')
      ? optionsOrDisabled
      : { disabled: !!optionsOrDisabled };
    const button = document.createElement('button');
    button.className = 'context-menu-item';
    if (opts.variant === 'danger') button.classList.add('is-danger');
    button.textContent = label;
    button.disabled = !!opts.disabled;
    if (opts.title) button.title = opts.title;
    if (action) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        hideContextMenu();
        action();
      });
    }
    els.contextMenu.appendChild(button);
  }
```

The non-object third argument branch keeps every existing call site working unchanged (`addMenuItem('No folder actions', null, true)` at `renderer/app.js:926` and the tab/clipboard menu items further down all pass either `true`, omit the arg, or pass `undefined` — the type guard handles all three).

- [ ] **Step 2: Sanity-check existing call sites still parse**

Run: `npm start`

Expected: app launches with no console errors. Right-click anywhere that opens a context menu (folder card, tab chip, terminal text area). Existing items still render correctly. Close the app when verified.

---

## Task 2: Add `Delete` menu item + CSS for divider and danger styling

**Files:**
- Modify: `renderer/app.js:910-927` (the directory branch of `showContextMenu`)
- Modify: `renderer/styles.css` (append new rules)

- [ ] **Step 1: Append the divider and `Delete` item in `showContextMenu`**

Find this directory branch at `renderer/app.js:914-927`:

```js
    if (entry.kind === 'directory') {
      addMenuItem('Open Folder', () => navigateTo(entry.path));
      addMenuItem('Launch Claude', () => launchClaudeForPath(entry.path, sourceCard));
      const sessionWindow = state.windowsByPath.get(entry.path);
      if (sessionWindow) {
        addMenuItem(sessionWindow.minimized ? 'Restore Session' : 'Minimize Session', () => {
          if (sessionWindow.minimized) restoreSessionWindow(sessionWindow, sourceCard);
          else minimizeSessionWindow(sessionWindow, sourceCard);
        });
        addMenuItem('Close Session', () => requestCloseSessionWindow(sessionWindow, { animate: true }));
      }
    } else {
      addMenuItem('No folder actions', null, true);
    }
```

Replace with:

```js
    if (entry.kind === 'directory') {
      addMenuItem('Open Folder', () => navigateTo(entry.path));
      addMenuItem('Launch Claude', () => launchClaudeForPath(entry.path, sourceCard));
      const sessionWindow = state.windowsByPath.get(entry.path);
      if (sessionWindow) {
        addMenuItem(sessionWindow.minimized ? 'Restore Session' : 'Minimize Session', () => {
          if (sessionWindow.minimized) restoreSessionWindow(sessionWindow, sourceCard);
          else minimizeSessionWindow(sessionWindow, sourceCard);
        });
        addMenuItem('Close Session', () => requestCloseSessionWindow(sessionWindow, { animate: true }));
      }
      const divider = document.createElement('hr');
      divider.className = 'context-menu-divider';
      els.contextMenu.appendChild(divider);
      const hasLiveSession = !!sessionWindow;
      addMenuItem('Delete', () => deleteFolderWithConfirm(entry, sourceCard), {
        disabled: hasLiveSession,
        title: hasLiveSession ? 'Close the session first.' : undefined,
        variant: 'danger',
      });
    } else {
      addMenuItem('No folder actions', null, true);
    }
```

`deleteFolderWithConfirm` doesn't exist yet — Task 4 adds it. The reference is fine because functions hoist within the IIFE; the menu handler only fires on click.

- [ ] **Step 2: Add CSS for `.context-menu-divider` and `.context-menu-item.is-danger`**

The existing `.context-menu-item:disabled { color: #68716d; }` rule sits at `renderer/styles.css:679-681`. We must ship the `is-danger:disabled` override from day one — equal-specificity cascade order means a later-defined `.is-danger { color: red; }` would otherwise overpower the disabled grey on disabled `Delete` items.

After the existing `.context-menu-item:disabled` rule (line 681), append:

```css
.context-menu-divider {
  margin: 4px 0;
  border: 0;
  height: 1px;
  background: #3c4542;
}

.context-menu-item.is-danger {
  color: #ff8a8a;
}

.context-menu-item.is-danger:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.12);
}

.context-menu-item.is-danger:disabled {
  color: #68716d;
}
```

The `:disabled` selector on `.is-danger` has higher specificity (0,2,1 vs 0,2,0 for `.context-menu-item:disabled`), so this rule wins for disabled red items regardless of source order.

- [ ] **Step 3: Visual verification**

Run: `npm start`

Expected behavior:
1. Right-click any folder card with no session → menu shows existing items, then a thin grey horizontal line, then a red `Delete` item.
2. Launch Claude in that folder (so it gets a live session), close the menu, right-click the same card → the `Delete` item is disabled (greyed) and hovering it shows the tooltip "Close the session first."
3. Clicking the disabled `Delete` does nothing.

Don't actually click the enabled `Delete` yet — `deleteFolderWithConfirm` doesn't exist; clicking will throw a ReferenceError in the console. That's expected. Close the app.

---

## Task 3: Add `fs:delete-folder` IPC — preload + main

**Files:**
- Modify: `preload.js:104` (next to `createFolder`)
- Modify: `main.js:1` (`shell` import), after `main.js:686` (`createFolder` close), after `main.js:938` (`fs:create-folder` handler close)

- [ ] **Step 1: Expose `deleteFolder` on the preload bridge**

In `preload.js`, find the existing `createFolder` line at line 104:

```js
  createFolder: (payload) => ipcRenderer.invoke('fs:create-folder', payload),
```

Add the new bridge line directly below it:

```js
  deleteFolder: (payload) => ipcRenderer.invoke('fs:delete-folder', payload),
```

- [ ] **Step 2: Add the `deleteFolder` function in `main.js`**

Find `function createFolder(payload)` at `main.js:668-686`. Directly after its closing `}` at line 686, add:

```js
async function deleteFolder(payload) {
  if (!payload || typeof payload.path !== 'string' || !payload.path.trim()) {
    throw new Error('Folder path is required.');
  }
  const target = path.resolve(payload.path);
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    throw new Error('Only folders can be deleted from EZvibes.');
  }
  await shell.trashItem(target);
  const result = {
    success: true,
    path: target,
    parent: path.dirname(target),
    name: path.basename(target),
  };
  writeLog('info', 'fs.folder_trashed', {
    path: result.path,
    parent: result.parent,
    name: result.name,
  });
  return result;
}
```

`path.resolve(...)` guarantees backslash form on Windows (the research called this out: raw forward-slash paths cause `shell.trashItem` to throw "Failed to parse path"). `fs.statSync` throws ENOENT if the path doesn't exist; the IPC wrapper converts that into `{ success: false, error: ... }`. We do not catch the `shell.trashItem` rejection here — same reason, the wrapper handles it.

- [ ] **Step 3: Add `shell` to the Electron import in `main.js`**

`shell` is NOT currently imported. Replace line 1 of `main.js`:

```js
const { app, BrowserWindow, ipcMain, Menu, clipboard, session, webContents } = require('electron');
```

With:

```js
const { app, BrowserWindow, ipcMain, Menu, clipboard, session, webContents, shell } = require('electron');
```

Without this, Task 3 Step 2 throws `ReferenceError: shell is not defined` the first time anyone tries to delete.

- [ ] **Step 4: Add the IPC handler**

Find the `fs:create-folder` handler at `main.js:931-938`. Directly after its closing `});` at line 938, add:

```js
  ipcMain.handle('fs:delete-folder', async (_event, payload) => {
    try {
      return await deleteFolder(payload);
    } catch (error) {
      writeLog('error', 'fs.folder_trash_failed', { error, path: payload && payload.path });
      return { success: false, error: (error && error.message) || String(error) };
    }
  });
```

`async` handler is required because `deleteFolder` is async (`shell.trashItem` returns a Promise). The existing sync handlers around it don't need to change.

- [ ] **Step 5: Restart and sanity-check**

Stop any running instance, then run: `npm start`

Expected: app launches, no errors in console, no JSONL log error events about the new code. Don't try to delete anything yet — Task 4 adds the renderer wiring. Close the app.

---

## Task 4: Renderer flow — `deleteFolderWithConfirm`

**Files:**
- Modify: `renderer/app.js:629` (insert after `createFolderInCurrentDirectory` close)

- [ ] **Step 1: Add the `deleteFolderWithConfirm` function**

`createFolderInCurrentDirectory` runs `renderer/app.js:611-629`. Directly after its closing `}` at line 629 (and before `function goBack()` at line 631), add:

```js
  async function deleteFolderWithConfirm(entry, sourceCard) {
    if (!entry || !api.deleteFolder) return;
    if (state.windowsByPath.get(entry.path)) {
      showInboxToast('Close the session for this folder before deleting it.', 'error');
      return;
    }
    const confirmed = await confirmDestructiveClose({
      title: `Delete "${entry.name}"?`,
      body: 'Moves the folder to the Recycle Bin. You can restore it from there.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
      returnFocusTo: sourceCard || null,
    });
    if (!confirmed) return;
    try {
      const result = await api.deleteFolder({ path: entry.path });
      if (!result || !result.success) {
        throw new Error((result && result.error) || 'Could not delete folder.');
      }
      if (state.previewPath === entry.path) state.previewPath = '';
      await refreshCurrentDirectory();
      addNarrationEvent(state.currentPath, 'folder-deleted', `Sent "${result.name}" to Recycle Bin.`);
      if (api.logEvent) api.logEvent('renderer.folder.deleted', { folderPath: result.path, name: result.name });
    } catch (error) {
      showInboxToast('Could not delete: ' + ((error && error.message) || String(error)), 'error');
    }
  }
```

`confirmDestructiveClose` defaults `initialFocus` to `'cancel'` whenever `danger: true` (see `renderer/app.js:1744`), so we don't need to set it explicitly. `showInboxToast` and `addNarrationEvent` and `refreshCurrentDirectory` are already in this file.

- [ ] **Step 2: End-to-end check — happy path**

Run: `npm start`

In the app:
1. Navigate to a scratch directory (e.g., your Desktop).
2. Click `New Folder`, accept the auto-name or rename to `delete-test`.
3. Right-click the `delete-test` folder → `Delete`.
4. Expected: modal `Delete "delete-test"?` with body `Moves the folder to the Recycle Bin. You can restore it from there.`, focus on Cancel, ESC dismisses, Tab toggles between buttons.
5. Click `Delete`.
6. Expected: modal closes, the folder card disappears from the grid. (No toast on success — the success surface is the narration sidebar, not a toast.) Open the narration sidebar (▤ button) → "Sent 'delete-test' to Recycle Bin." appears under the current folder.
7. Open the Recycle Bin (Windows desktop) → `delete-test` is there.

Close the app.

- [ ] **Step 3: End-to-end check — session guard**

Run: `npm start`

In the app:
1. Navigate to a scratch directory.
2. Right-click a folder → `Launch Claude` (a session window opens for that folder).
3. Close the menu (or click elsewhere), then right-click the same folder again.
4. Expected: `Delete` item is greyed out. Hover it → tooltip "Close the session first."
5. Click the disabled item → nothing happens.
6. Close the session (via the session window's close button or the Close Session menu item).
7. Right-click the folder again → `Delete` is now enabled.

Close the app (cancel the exit-confirmation if any session is still up).

- [ ] **Step 4: End-to-end check — failure surface**

Reproduce a failure: easiest is to delete the folder via Explorer between right-click and Confirm. Or temporarily try to delete a known-blocked path like `C:\Windows` (will be rejected by Windows). The toast should appear bottom-right with red border, text starting `Could not delete: ...`, auto-hiding after 2.2s.

If you don't want to chase a failure case here, skip — Task 6 will exercise it.

- [ ] **Step 5: Verify diagnostics**

Open: `%APPDATA%\EZvibes\logs\ezvibes-YYYY-MM-DD.jsonl` (today's file)

Expected entries (recent ones):
- `fs.folder_trashed` info entry with `{ path, parent, name }`
- `renderer.folder.deleted` info entry with `{ folderPath, name }`
- (If you forced a failure) `fs.folder_trash_failed` error entry with the path and error message

---

## Task 5: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (the IPC channels list, the preload API list, the "Current UX" section, the "Known Limitations" section)

- [ ] **Step 1: Add the new IPC channel to the IPC list**

Find the bulleted list of IPC channels in `CLAUDE.md` under "Runtime Model". After the line ``- `fs:list-directory` ``, add the create and delete channels (the project currently has no `fs:rename-*` channel; only `create` and `delete` belong here):

```markdown
- `fs:create-folder`
- `fs:delete-folder`
```

If `fs:create-folder` is already in the list, just add the `fs:delete-folder` line adjacent to it.

- [ ] **Step 2: Add `deleteFolder` to the preload API list**

Find the line that starts ``Preload API on `window.ezvibes`:`` in `CLAUDE.md`. Edit the inline comma-separated list to include `createFolder` and `deleteFolder` (the project no longer has a `renameEntry` bridge):

```markdown
... `listDirectory`, `createFolder`, `deleteFolder`, `createTerminal`, ...
```

If `renameEntry` is mentioned in the existing CLAUDE.md inline list, remove it — the bridge no longer exists in `preload.js`.

- [ ] **Step 3: Add a UX bullet under "Current UX"**

Find the "Current UX" section in `CLAUDE.md`. After the bullet describing right-click folder actions, add:

```markdown
- Right-click a folder → `Delete` moves the folder to the Windows Recycle Bin via `shell.trashItem`. The modal confirms the action; ESC cancels. If the folder has a live Claude/Codex session attached, the `Delete` item is disabled with a "Close the session first." tooltip.
```

- [ ] **Step 4: Add a known-limitation bullet for OneDrive**

Find the "Known Limitations / Next Improvements" section. Append:

```markdown
- Folders inside OneDrive may be routed to OneDrive's own trash rather than the Windows Recycle Bin when deleted (Electron `shell.trashItem` behavior). EZvibes treats either outcome as success once the folder disappears from the grid.
```

- [ ] **Step 5: Re-read the file once for inconsistencies**

Run: `Read CLAUDE.md`

Skim for stale references (e.g., a "no delete" note left from before, or counts that need updating). Fix any inline.

---

## Task 6: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Launch fresh**

Stop any running instance of EZvibes. Run: `npm start`

- [ ] **Step 2: Happy path**

1. Navigate to Desktop (or any scratch parent).
2. Create three test folders via `Ctrl+Shift+N`, name them `del-a`, `del-b`, `del-c`.
3. Delete `del-a` via right-click → Delete → Confirm. Verify it disappears.
4. Delete `del-b` the same way. Verify.
5. Delete `del-c` but click Cancel on the modal. Verify it's still there.
6. Press ESC in the modal for `del-c` (re-trigger). Verify ESC dismisses and `del-c` is still there.
7. Delete `del-c` for real this time.

- [ ] **Step 3: Session-blocked path**

1. Create folder `del-with-session`.
2. Launch Claude in it.
3. Right-click → confirm `Delete` is disabled and the tooltip reads "Close the session first."
4. Close the session window.
5. Right-click again → `Delete` is now enabled. Delete it.

- [ ] **Step 4: Recycle Bin check**

Open the Windows Recycle Bin. Verify `del-a`, `del-b`, `del-c`, `del-with-session` are all there with their full original paths in the "Original Location" column.

- [ ] **Step 5: Diagnostics log check**

Open `%APPDATA%\EZvibes\logs\ezvibes-YYYY-MM-DD.jsonl`. Search for `fs.folder_trashed`. There should be 4 entries matching the four successful deletions (path, parent, name). Search for `renderer.folder.deleted`. There should be 4 matching entries.

- [ ] **Step 6: Failure surface (optional but recommended)**

1. Create a folder.
2. Open a terminal in the folder (real Windows terminal, not EZvibes) and `cd` into it.
3. In EZvibes, right-click → Delete → Confirm. The folder may or may not delete depending on Windows version. If it fails, the toast appears bottom-right with the raw error. Either outcome is acceptable; the goal is to confirm the failure surface itself works.

- [ ] **Step 7: Commit (if user requests)**

The user controls when commits happen. If they ask for one, propose splitting into two:

1. `feat(folder-delete): add fs:delete-folder IPC and shell.trashItem handler`
   - `main.js`, `preload.js`
2. `feat(folder-delete): add Delete context-menu item and confirm flow`
   - `renderer/app.js`, `renderer/styles.css`, `CLAUDE.md`

Or a single combined commit. The user picks.

---

## Notes for the implementer

- **No new dependencies.** Everything is in the standard library or already imported.
- **No new files.** All edits go into existing files: `main.js`, `preload.js`, `renderer/app.js`, `renderer/styles.css`, `CLAUDE.md`.
- **`shell.trashItem` is async.** The IPC handler must be `async`, and the renderer must `await api.deleteFolder(...)`. Don't forget the await — silent un-awaited promises will eat errors.
- **Path resolution is the load-bearing line.** `path.resolve(payload.path)` on Windows produces backslash form; without it, raw forward-slash strings cause `Failed to parse path` rejections from `shell.trashItem`. Don't skip it.
- **The renderer can already navigate to arbitrary paths via `fs:list-directory`.** Don't add a path allowlist to the new delete handler "for safety" — it's symbolic and inconsistent with the existing IPC surface. The OS layer (Windows refuses to trash protected paths; `shell.trashItem` rejects on Recycle Bin disabled) is the real boundary.
- **OneDrive paths are best-effort.** Trust whatever `shell.trashItem` reports. Don't try to detect or warn — the known-limitation bullet in `CLAUDE.md` covers this.
- **Symlinks/junctions.** `fs.statSync(target).isDirectory()` follows the link, so a directory junction passes the "must be a directory" check. `shell.trashItem` trashes the link itself, not the target — which is what the user sees and expects ("the entry I clicked is gone"). No special handling needed, but worth knowing if a tester reports "I deleted the link and the target is still there." That's correct.
