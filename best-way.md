# Best Way To Implement EZvibes New Folder

Last updated: 2026-05-27

## Executive Summary

The button placement is right: a visible `New Folder` action belongs in the command bar next to the other current-folder actions.

The implementation should be stricter than the first patch in four places:

1. `listDirectory()` must stay read-only. It should never rename folders as a side effect.
2. Folder creation, rename, and auto-adopt should be separate semantic IPC operations.
3. The renderer should not send arbitrary filesystem paths for mutation forever; main should eventually issue directory capability IDs.
4. Inline rename needs first-class UX: shortcut, context menu, visible errors, accessible status, and intentional `Enter` / `Escape` / blur behavior.

## Best Product Behavior

### New Folder

- Add `New Folder` in the command bar near `ACTIVATE`.
- Also support:
  - empty-grid context menu: `New Folder`
  - keyboard shortcut: `Ctrl+Shift+N` on Windows/Linux
  - later if macOS is supported: `Shift+Cmd+N`
- On click/shortcut:
  - create a real folder named `Unnamed folder`, `Unnamed folder 2`, etc.
  - select it
  - scroll it into view
  - focus an inline text input with the whole name selected

### Inline Rename

- `Enter`: commit the typed name.
- `Escape`: cancel editing and keep the generated placeholder folder.
- Blur: commit if valid; if invalid, keep edit mode active and show a visible error.
- `F2`: later, rename the selected folder.
- Duplicate typed names should show an error, not silently suffix. Only generated placeholder names should auto-suffix.

### Auto-Adopt Name

Keep the rule, but define it precisely:

> A folder created by EZvibes as an unnamed placeholder adopts the base name of the first eligible file EZvibes observes inside it, unless the user manually named or locked the folder.

Do not implement adoption inside `listDirectory()`.

Better triggers:

- when EZvibes itself drops/copies/creates a file into that unnamed folder
- later, from a debounced file watcher event
- optionally, from an explicit reconciliation command such as `fs:reconcile-unnamed-folders`

Fallback semantics when multiple files already exist:

- use natural alphabetic order
- ignore the marker file and system noise like `.DS_Store`
- strip the final extension: `brief.pdf` -> `brief`
- preserve multi-dot names: `project.v1.md` -> `project.v1`
- resolve conflicts as `Name`, `Name 2`, `Name 3`

Do not auto-adopt while:

- inline rename is active
- the folder has a live Claude/Codex session using it as `cwd`
- the user explicitly chose to keep the placeholder name

## Best Architecture

### Main Process Owns Filesystem Mutation

Keep filesystem mutation in `main.js` or extract it later to `folder-manager.js`.

Expose narrow IPC verbs:

```js
fs:list-directory
fs:create-folder
fs:rename-folder
fs:adopt-folder-name
fs:disable-folder-auto-name
```

Avoid a generic `renameEntry` API unless the renderer has full state migration for sessions, narration, and tabs keyed by folder path.

### Directory Capabilities

The current path-based API is acceptable for a local prototype, but the stronger design is:

1. Renderer asks main to list a directory.
2. Main returns entries plus a `directoryId`.
3. Main stores `directoryId -> absolute path` for that renderer.
4. Renderer calls `createFolder({ directoryId })`, not `createFolder({ parentPath })`.

This keeps the renderer from using filesystem mutation APIs on arbitrary paths it invents.

### Pure Listing

`fs:list-directory` should only:

- validate the directory
- read entries
- sort entries
- return data

It should not:

- create markers
- rename folders
- repair metadata
- adopt names

Mutation during listing makes refresh/navigation surprising and can stale renderer maps keyed by absolute path.

## Main-Process Rules

### Folder Name Validation

Treat names as untrusted path segments, not paths.

Reject:

- empty names
- `.`
- `..`
- names ending in period or space
- `/`, `\`, `:`, `<`, `>`, `"`, `|`, `?`, `*`
- NUL and control characters
- Windows reserved device names, including extension forms:
  - `CON`, `PRN`, `AUX`, `NUL`
  - `COM1` through `COM9`
  - `LPT1` through `LPT9`
  - also reject `NUL.txt`, `CON.md`, etc.

For generated names, sanitize. For user-typed names, reject and show the user the reason.

### Race Handling

Do not rely on `existsSync()` as the final source of truth.

For generated placeholders:

1. Try `mkdir("Unnamed folder")`.
2. If `EEXIST`, try `Unnamed folder 2`.
3. Continue until success or a reasonable cap.

For user rename:

1. Validate the new name.
2. Resolve under the trusted parent.
3. Ensure it stays in that parent.
4. Attempt `rename`.
5. If the target exists, return a duplicate-name error.

Handle case-only renames intentionally on Windows. If needed, rename through a temporary sibling name:

```text
Unnamed folder -> .ezvibes-rename-temp-<id> -> unnamed folder
```

### Metadata

Use marker metadata, not just the folder name.

Preferred file:

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

Write metadata with exclusive create (`wx`). If marker creation fails after folder creation, either remove the still-empty folder or leave it as a normal folder without auto-adopt.

Manual rename to a non-placeholder name should set `autoName: false` or remove the marker.

## Renderer UX Rules

### Command Bar

Use a real button:

```html
<button id="new-folder-btn" class="command-button new-folder-button" type="button">
  New Folder
</button>
```

Add an accessible name only if the visible text is removed later.

### Inline Rename Editor

Use a native text input, not `contenteditable`.

Required behavior:

- `aria-label="Folder name"`
- `maxlength="120"`
- visible error element on failure
- `aria-describedby` pointing to the error element when invalid
- focus returned to the committed folder card
- selected folder remains selected after sorting moves it

Error examples:

- `A folder named "docs" already exists.`
- `Folder name cannot contain \ / : * ? " < > |.`
- `Folder name is reserved on Windows.`

### Announcements

Add a small polite status region or reuse narration only if it is always available to assistive tech.

Announce:

- `Folder created. Type a name.`
- `Folder renamed to docs.`
- `A folder named docs already exists.`

## Better Auto-Adopt Flow

Best explicit operation:

```js
fs:adopt-folder-name({
  folderId,
  observedFileName,
  reason: 'drop' | 'file-create' | 'watcher' | 'manual-reconcile'
})
```

Main returns:

```js
{
  success: true,
  renamed: true,
  oldPath,
  newPath,
  name
}
```

Renderer then migrates local state:

- selected path
- preview path
- `windowsByPath`
- narration path keys
- any browser/session path references

If migration is not implemented yet, skip auto-adopt for folders with active sessions.

## What I Would Change From The First Patch

1. Remove adoption from `listDirectory()`.
2. Rename `renameEntry` to `renameFolder`.
3. Add `createFolder` conflict retry based on catching `EEXIST`, not pre-checking only.
4. Make user rename validation and generated-name sanitization separate functions.
5. Handle case-only renames.
6. Add `Ctrl+Shift+N`.
7. Add empty-grid context menu item.
8. Add visible rename error text and `aria-describedby`.
9. Replace `.ezvibes-unnamed-folder` with `.ezvibes-folder.json` metadata.
10. Add an explicit `adoptFolderName` path used by file-drop/create/watch flows.

## Suggested Milestones

### Milestone 1: Make Current Feature Correct

- Keep button placement.
- Keep inline rename.
- Make `listDirectory()` pure.
- Rename IPC to `fs:rename-folder`.
- Add visible inline errors.
- Add `Ctrl+Shift+N`.
- Add context-menu `New Folder`.
- Add syntax checks.

### Milestone 2: Harden Filesystem API

- Add directory capability IDs.
- Validate sender ownership.
- Add path/name validation helpers.
- Retry create on `EEXIST`.
- Add case-only rename handling.
- Add structured error codes.

### Milestone 3: Auto-Adopt Properly

- Add `.ezvibes-folder.json`.
- Add `fs:adopt-folder-name`.
- Trigger adoption from file-drop/create flows.
- Add reconciliation command only as a deliberate action.
- Add state migration for renamed session paths.

## Sources

- Electron context isolation and IPC bridge safety: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron security guide: https://www.electronjs.org/docs/latest/tutorial/security
- Electron `ipcRenderer` guidance: https://www.electronjs.org/docs/latest/api/ipc-renderer/
- Node.js filesystem docs: https://nodejs.org/api/fs.html
- Microsoft Windows file naming rules: https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
- Microsoft Windows keyboard shortcuts: https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec
- Apple Finder folder organization: https://support.apple.com/guide/mac-help/organize-files-with-folders-mh26885/mac
- WAI-ARIA grid pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- WAI-ARIA accessible names guidance: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
