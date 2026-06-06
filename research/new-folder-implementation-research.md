# New Folder Implementation Research

Date: 2026-05-27

## Why This Exists

This note captures the research that changed the implementation strategy for EZvibes' `New Folder` feature.

The goal is to preserve reusable knowledge for future work: how to create folders safely in an Electron app, how inline rename should behave, and how the "Unnamed folder adopts first file name" idea should be implemented without surprising filesystem side effects.

## Core Perspective Shift

The first implementation mostly worked, but the research changed the design in one important way:

> Directory listing should be pure. It should not rename folders, repair metadata, or perform hidden mutations.

That means `listDirectory()` should only read and return directory entries. Auto-renaming `Unnamed folder` based on the first file inside it should be a separate explicit operation triggered by file-drop/create/watch flows.

## Best Mental Model

Think of this feature as three separate capabilities:

1. **Create folder**
   - User asks for a new folder in the current directory.
   - Main process creates a collision-free placeholder.
   - Renderer starts inline rename.

2. **Rename folder**
   - User commits a typed name.
   - Main process validates it as a single folder-name segment.
   - Main process renames only that folder.

3. **Adopt first file name**
   - Only applies to EZvibes-created unnamed placeholders.
   - Triggered explicitly when EZvibes observes a file enter that folder.
   - Not triggered as a side effect of refresh/listing.

## Key Technical Lessons

### 1. Expose Semantic IPC, Not Filesystem Power

Good preload API:

```js
createFolder({ directoryId })
renameFolder({ folderId, newName })
adoptFolderName({ folderId, observedFileName })
```

Riskier preload API:

```js
renameEntry({ path, newName })
writeFile({ path, contents })
invoke(channel, payload)
```

Electron's security guidance is clear: `contextBridge` is useful, but it does not make broad IPC safe. Expose one narrow method per allowed action, not generic filesystem or generic IPC access.

### 2. Main Process Is The Security Boundary

Renderer/preload validation is UX only. Main must validate:

- sender identity
- payload shape
- name length
- invalid characters
- reserved Windows names
- path containment
- conflict behavior

Do not rely on the renderer being honest.

### 3. Use Directory Capability IDs Eventually

The stronger design is not:

```js
createFolder({ parentPath: "C:\\Users\\..." })
```

The stronger design is:

```js
createFolder({ directoryId: "dir_123" })
```

Main process owns:

```js
directoryId -> absolute path
```

This prevents renderer code from inventing arbitrary mutation paths.

### 4. Validate Folder Names As Path Segments

A folder name is not a path.

Reject:

- empty names
- `.`
- `..`
- names ending in space or period
- `/`
- `\`
- `:`
- `<`
- `>`
- `"`
- `|`
- `?`
- `*`
- NUL/control characters
- reserved device names like `CON`, `PRN`, `AUX`, `NUL`, `COM1`, `LPT1`
- reserved names with extensions like `NUL.txt`

Generated placeholder names may be sanitized. User-typed names should be rejected with a clear error instead of silently changed.

### 5. Avoid Check-Then-Act As The Final Truth

This is weaker:

```js
if (!fs.existsSync(target)) fs.mkdirSync(target);
```

Another process can create the path between the check and the action.

Better:

```js
try {
  fs.mkdirSync(target);
} catch (error) {
  if (error.code === 'EEXIST') tryNextName();
  else throw error;
}
```

Same principle applies to rename conflicts.

### 6. Case-Only Renames Need Special Handling On Windows

If the app compares paths case-insensitively, this can accidentally skip real user intent:

```text
Unnamed folder -> unnamed folder
```

On Windows, handle case-only rename intentionally, often through a temporary sibling:

```text
Unnamed folder -> .ezvibes-rename-temp-<id> -> unnamed folder
```

### 7. Inline Rename Should Match File Manager Muscle Memory

Expected behavior:

- `Ctrl+Shift+N`: create new folder on Windows/Linux.
- `Shift+Cmd+N`: create new folder on macOS later.
- focus the new folder name editor immediately.
- select the generated name.
- `Enter`: commit.
- `Escape`: cancel editing.
- blur: commit if valid.
- invalid blur: keep editor open and show error.
- after commit: keep folder selected/focused, even if sorting moves it.

### 8. Errors Must Be Visible, Not Just A Red Border

Bad:

- red border only
- browser `title` only

Better:

- visible error text near the input
- `aria-describedby` from input to error text
- polite status announcement

Example messages:

```text
A folder named "docs" already exists.
Folder name cannot contain \ / : * ? " < > |.
Folder name is reserved on Windows.
```

### 9. Auto-Adopt Needs Explicit Semantics

Best rule:

> A folder created by EZvibes as an unnamed placeholder adopts the base name of the first eligible file EZvibes observes inside it, unless the user manually named or locked the folder.

Best trigger:

- use the concrete file from a file-drop/create event when possible
- use watcher events later if needed
- use manual reconciliation only as fallback

Avoid:

- renaming during `listDirectory()`
- using raw directory order
- relying on `ctime`, `birthtime`, or `mtime` to define "first"

Fallback if multiple files already exist:

- natural alphabetic order
- ignore marker files and system noise
- strip final extension
- preserve multi-dot base names

Examples:

```text
brief.pdf -> brief
project.v1.md -> project.v1
archive.tar.gz -> archive.tar
```

### 10. Marker Metadata Is Better Than Marker Name Only

Basic marker:

```text
.ezvibes-unnamed-folder
```

Better metadata:

```text
.ezvibes-folder.json
```

Example:

```json
{
  "schemaVersion": 1,
  "id": "uuid",
  "state": "unnamed",
  "autoName": true,
  "createdAt": "2026-05-27T00:00:00.000Z"
}
```

Manual rename should disable `autoName` or remove the marker.

## Recommended Future Implementation

1. Keep the command bar `New Folder` button.
2. Add `Ctrl+Shift+N`.
3. Add empty-grid context menu `New Folder`.
4. Keep inline rename, but add visible errors and `aria-describedby`.
5. Make `listDirectory()` read-only.
6. Rename `renameEntry` to `renameFolder`.
7. Add `adoptFolderName` as a separate IPC operation.
8. Later, replace path-based mutation with directory/folder capability IDs.

## Sources

- Electron context isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron security guide: https://www.electronjs.org/docs/latest/tutorial/security
- Electron ipcRenderer guidance: https://www.electronjs.org/docs/latest/api/ipc-renderer/
- Node.js filesystem docs: https://nodejs.org/api/fs.html
- Microsoft Windows file naming rules: https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
- Microsoft Windows keyboard shortcuts: https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-c75eec
- Apple Finder folder organization: https://support.apple.com/guide/mac-help/organize-files-with-folders-mh26885/mac
- WAI-ARIA grid pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- WAI-ARIA accessible names guidance: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/

