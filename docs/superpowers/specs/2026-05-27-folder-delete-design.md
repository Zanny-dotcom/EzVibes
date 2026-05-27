# Folder Delete (Right-Click → Recycle Bin)

## Goal
Let the user right-click any folder in the EZvibes grid, choose `Delete`, confirm "Yes, delete," and have the folder moved to the Windows Recycle Bin via Electron's `shell.trashItem()`. A folder with a live Claude/Codex session attached cannot be deleted — the menu item is disabled and surfaces "Close the session first." in its tooltip.

The point is to let the user clean up scratch folders (and the new `Unnamed folder` placeholders) from inside EZvibes instead of alt-tabbing to Explorer. Recycle Bin (not permanent delete) was chosen so the confirm dialog is a speed bump, not a point of no return — recoverability lives in the OS, not in EZvibes.

## Current State
- The directory context menu is built in `renderer/app.js:885-902` via `showContextMenu(entry, x, y, sourceCard)` and the `addMenuItem(label, action, disabled)` helper at `renderer/app.js:912-924`. Today the directory branch only offers `Open Folder`, `Launch Claude`, and (when a session window exists) `Minimize Session` / `Restore Session` / `Close Session`. There is no `Delete` item and no separator.
- A modal helper already exists: `confirmDestructiveClose(opts)` at `renderer/app.js:1733-1799`. It returns `Promise<boolean>`, supports `title`, `body`, `confirmLabel`, `cancelLabel`, `danger`, `returnFocusTo`, and `initialFocus`. The dialog uses `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, traps Tab between the two buttons, ESC cancels, and respects the `_modalInFlight` guard so it can't double-open. This matches the WAI-ARIA alertdialog pattern called out by the confirm-dialog research.
- Live session windows are tracked in `state.windowsByPath: Map<folderPath, SessionWindow>` (`renderer/app.js:9`). A folder card is given `session-minimized` / `session-open` classes during `renderGrid` based on the same map.
- The renderer talks to main through `window.ezvibes` (declared in `preload.js`). Existing filesystem verbs are `listDirectory` and `createFolder` (preload lines 103-104). Main's IPC handlers live near `main.js:930-938` and follow a consistent pattern: thin `ipcMain.handle` shim that wraps a pure function and converts thrown errors to `{ success: false, error }` while logging to JSONL.
- `main.js` already imports `shell` from `electron` (line 1). `shell.trashItem(absPath)` is the async API; the older `shell.moveItemToTrash` is removed in Electron 30+. The research surfaced four non-obvious quirks: paths must be backslash-normalized via `path.resolve()`; OneDrive paths sometimes route to OneDrive's trash, not the Recycle Bin; per-drive Recycle Bin disabled → rejection (no permanent fallback); error messages are opaque strings (`Failed to create FileOperation instance`, `Failed to parse path`) so we catch broadly.
- A generic toast helper exists: `showInboxToast(text, kind)` at `renderer/app.js:1382-1400`. It creates a polite `aria-live` toast in the bottom-right (`position: fixed; right: 16px; bottom: 16px`) that auto-hides after 2.2s. `kind` is `'info' | 'success' | 'error'` and maps to `.inbox-toast.is-{kind}` CSS classes already defined in `renderer/styles.css:431-461`. The name carries "inbox" historically; the toast itself is general-purpose. The other error surface, `showError(error)`, replaces the entire grid with an error panel — that's appropriate for catastrophic listing failures but too aggressive for a transient delete error.
- Success events are surfaced via `addNarrationEvent(folderPath, kind, message)`.
- The diagnostics log file (`%APPDATA%\EZvibes\logs\ezvibes-YYYY-MM-DD.jsonl`) already carries `fs.folder_created` and `fs.entry_renamed` events. A delete event will follow the same shape.

## Target State
- Right-clicking a directory card opens the context menu with a new bottom row: a thin visual separator followed by a red-tinted `Delete` item. When `state.windowsByPath.get(entry.path)` exists, the item is rendered disabled with `title="Close the session first."` and no click handler.
- Clicking the enabled `Delete` item opens `confirmDestructiveClose` with:
  - `title`: `Delete "FolderName"?`
  - `body`: `Moves the folder to the Recycle Bin. You can restore it from there.`
  - `confirmLabel`: `Delete`
  - `cancelLabel`: `Cancel`
  - `danger: true` (red confirm button)
  - `initialFocus: 'cancel'` (the helper's default for `danger: true` — matches NN/g guidance against pre-selecting destructive actions)
  - `returnFocusTo`: the folder card, so focus is sane if the user cancels
- On Confirm, the renderer calls `await api.deleteFolder({ path: entry.path })`. On success:
  - The narration log gets `Sent "FolderName" to Recycle Bin.` for the parent folder (so the entry shows up under the folder the user was browsing, not under the deleted folder).
  - The current directory is refreshed via the existing `refreshCurrentDirectory()` so the deleted card disappears.
  - The diagnostics log records `fs.folder_trashed` with `{ path, parent, name }`.
  - Focus returns to the grid.
- On failure (Recycle Bin disabled, locked file, OneDrive routing error, validation error), the renderer surfaces the message through `showInboxToast('Could not delete: <raw message>', 'error')`. The diagnostics log records `fs.folder_trash_failed` with the path and error.

## Out of Scope
- Permanent delete (Shift+Delete style). Recycle Bin only; this was explicitly chosen.
- "Don't ask again" suppression checkbox. Anti-pattern for recoverable destructive actions per NN/g.
- Type-the-folder-name-to-confirm. Anti-pattern for recoverable deletes.
- Keyboard shortcut on the `Delete` key. Would need terminal-input guarding similar to `Ctrl+Shift+N`; deferred.
- Bulk delete / multi-select.
- Deleting files (the spec is folder-scoped, matching the user request).
- Undo toast. Recycle Bin restoration is a native OS operation; an in-app undo would either re-implement that or store original paths and timing — out of scope.
- Pre-validating the path against an allowlist of "safe" roots. The renderer can already navigate to arbitrary paths via `fs:list-directory`; narrowing the delete surface alone doesn't move the trust boundary in a useful way for a single-user local launcher. Standard path resolution + statSync existence check + a "must be a directory" gate is enough.
- Special handling for OneDrive paths beyond surfacing whatever error/success `shell.trashItem` reports. If the OS routes the item to OneDrive's trash rather than the Recycle Bin, EZvibes treats that as success (the folder is gone from the grid); we do not try to detect or warn about it.

## Components

### 1. Menu item (renderer)
- Extend `addMenuItem` in `renderer/app.js:912-924` to accept an options object: `addMenuItem(label, action, options)` where `options` is `{ disabled?: boolean, title?: string, variant?: 'danger' }`. For backwards compatibility, treat a non-object truthy third argument as `{ disabled: true }`, so existing call sites (e.g., `addMenuItem('No folder actions', null, true)` at `renderer/app.js:901`) keep working unchanged. When `options.title` is set, assign it to the button's `title` attribute. When `options.variant === 'danger'`, add the CSS class `is-danger` to the button.
- In `showContextMenu` directory branch (`renderer/app.js:885-902`), after the existing session-related items, append:
  - A separator: `const sep = document.createElement('hr'); sep.className = 'context-menu-divider'; els.contextMenu.appendChild(sep);`
  - A `Delete` item: `addMenuItem('Delete', () => deleteFolderWithConfirm(entry, sourceCard), { disabled: hasLiveSession, title: hasLiveSession ? 'Close the session first.' : undefined, variant: 'danger' })` where `hasLiveSession = !!state.windowsByPath.get(entry.path)`.
- Add CSS in `renderer/styles.css`:
  - `.context-menu-divider`: 1px line in `#3c4542` (matching the menu border), `margin: 4px 0`, no left/right margin, `border: 0`, `height: 1px`, `background: #3c4542`.
  - `.context-menu-item.is-danger`: foreground color `#ff8a8a`. On `:hover:not(:disabled)`, background tinted with `rgba(255, 107, 107, 0.12)`. When disabled, keep the muted-text color used by other disabled items (i.e. `.is-danger` styling does not override the disabled appearance).

### 2. Renderer flow (`deleteFolderWithConfirm`)
- New function in `renderer/app.js`, near the other directory-action helpers (e.g., right after `createFolderInCurrentDirectory`).
- Steps:
  1. Re-check `state.windowsByPath.get(entry.path)` (race guard — between menu render and click, a session could have been launched). If a session exists, bail with `showInboxToast('Close the session for this folder before deleting it.', 'error')`. (Different wording than the disabled-tooltip "Close the session first." — the tooltip is short for a transient hover state; the toast is the explanation when an action is actually blocked.)
  2. Call `confirmDestructiveClose({ title, body, confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true, returnFocusTo: sourceCard })`. Await the boolean.
  3. If `false`, return — focus already restored by the modal helper.
  4. If `true`, call `await api.deleteFolder({ path: entry.path })`.
  5. On `{ success: true }`: clear `state.previewPath` if it equals `entry.path`, call `refreshCurrentDirectory()`, call `addNarrationEvent(state.currentPath, 'folder-deleted', 'Sent "FolderName" to Recycle Bin.')`, and log `renderer.folder.deleted` via `api.logEvent`.
  6. On `{ success: false, error }`: call `showInboxToast('Could not delete: ' + error, 'error')`. Do not refresh — the folder is presumably still there.

### 3. Preload bridge
- Add to `preload.js` (next to `createFolder` at line 104):
  ```js
  deleteFolder: (payload) => ipcRenderer.invoke('fs:delete-folder', payload),
  ```

### 4. Main handler (`fs:delete-folder`)
- New function `deleteFolder(payload)` after `createFolder` in `main.js` (around line 686). Steps:
  1. Validate: `payload.path` must be a non-empty string. Throw `Folder path is required.` if not.
  2. `const target = path.resolve(payload.path);` (this guarantees backslash form on Windows; the research called this out).
  3. `const stat = fs.statSync(target);` — throws ENOENT if missing.
  4. If `!stat.isDirectory()` → throw `Only folders can be deleted from EZvibes.`
  5. `await shell.trashItem(target);` — may reject with opaque message.
  6. Log `fs.folder_trashed` `{ path: target, parent: path.dirname(target), name: path.basename(target) }`.
  7. Return `{ success: true, path: target, parent: path.dirname(target), name: path.basename(target) }`.
- Add the IPC wrapper near the others:
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
- Note: the handler is `async` (unlike the existing `fs:list-directory` / `fs:create-folder`) because `shell.trashItem` is Promise-based. The function it calls is also `async`. The existing handlers don't need to change.

### 5. Diagnostics
- Two new log events:
  - `fs.folder_trashed` — info level, fired on success in main.
  - `fs.folder_trash_failed` — error level, fired on any thrown error in the handler.
- A third renderer-side event: `renderer.folder.deleted` — info level, fired after a successful trash and refresh.

### 6. CLAUDE.md update
- Add `fs:delete-folder` to the IPC channel list.
- Add `deleteFolder` to the `window.ezvibes` API list.
- Add a one-line bullet under "Current UX" describing the new menu item and its session guard.
- Add a one-line known-limitation about OneDrive paths potentially routing to OneDrive's trash rather than the Recycle Bin.
