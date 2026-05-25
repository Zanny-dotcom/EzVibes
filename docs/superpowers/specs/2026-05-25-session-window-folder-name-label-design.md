# Session Window Folder-Name Label

## Goal
Add a small folder-name label to the top bar of every session window so the user can tell at a glance which folder the terminal session belongs to. Today the tab strip shows the agent (`CLAUDE 4`), but nothing on the window tells you which folder you are in.

## Current State
- `createSessionWindow` (`renderer/app.js`) builds the popup with two visible rows above the terminal pocket:
  1. `.folder-terminal-tab-strip` — absolute-positioned strip overhanging the top edge, containing tab chips + `+` button.
  2. `.folder-terminal-tab` — the yellow strip flush with the top of the popup, currently containing only the minimize/close controls (right-aligned via `justify-content: flex-end`).
- The folder name lives in `sessionWindow.folderName` (basename of `folderPath`) but is never rendered into the popup.

## Target State
- A `.folder-name-label` element appears inside `.folder-terminal-tab`, immediately before `.session-controls` (so visually: `… [ folder name ] [_][x]` flush right).
- Text content is the folder's basename (e.g., `EZvibes`).
- `title` attribute is the full folder path, so the user can hover for the absolute path.
- Styling matches the existing yellow tab-strip language: dark text on a faint cream background, small rounded rectangle, similar height to the session-control buttons.
- Long folder names truncate with ellipsis (`max-width` + `text-overflow: ellipsis`).
- Static text — no click/rename behavior in this feature.

## Out of Scope
- Clicking the label to navigate to the folder, copy the path, or rename. (Could be added later.)
- Showing the full path; only the basename appears in the label.
- Updating the label live if the folder is renamed externally — the value is captured once at session-window creation.

## Components
1. **Markup** (`renderer/app.js`, inside `createSessionWindow`'s `innerHTML` template):
   - Add `<span class="folder-name-label"></span>` as the first child of `.folder-terminal-tab`, before `.session-controls`.
   - After parsing the template, set `folderNameLabel.textContent = name` and `folderNameLabel.title = folderPath` (to avoid HTML-escaping concerns on arbitrary paths).
2. **Styles** (`renderer/styles.css`):
   - New `.folder-name-label` rule: `flex: 0 1 auto`, `min-width: 0`, `max-width: ~220px`, faint cream background matching `.session-control`, dark text, padding, rounded corners, `overflow: hidden; white-space: nowrap; text-overflow: ellipsis`.

## Risk / Notes
- `.folder-terminal-tab` is `display: flex; justify-content: flex-end`, so adding the label before `.session-controls` will naturally sit it just to the left of `[_][x]` — matches the mockup.
- The label sits next to the session controls and must not push them off-screen on narrow popups. `max-width` plus `flex: 0 1 auto` lets it shrink before the controls do.
- Minimize/restore: the label is part of the window subtree, so it follows the Genie animations for free.
- No agent-specific styling — the label is per session window, not per tab.
