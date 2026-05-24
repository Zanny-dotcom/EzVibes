# Tab-Mounted Session Name + Inline Rename

## Goal
Move the folder-name from inside the popup header onto the small "tab" that sticks up at the top-left of the session window, allow renaming that name via right-click, and shrink the visual bezel around the embedded terminal so more of the popup is real terminal area.

## Current State
- `.folder-terminal::before` is a CSS pseudo-element that draws a yellow tab nubbin (190px wide, 34px tall) above the popup. It is decorative only — no text, no interaction.
- `.folder-terminal-tab` is a 70px-tall row inside the popup. It holds:
  - `.session-title` = folder name (e.g., `CP`)
  - `.session-subtitle` = `claude --dangerously-skip-permissions`
  - `.session-controls` = minimize/close buttons
- `.terminal-pocket` has a 3px dark border + 8px padding around the xterm host.

## Target State
- The tab nubbin becomes a real DOM element (`.folder-terminal-nubbin`) containing the editable session name. It auto-sizes around the name with min/max width caps.
- The popup's inner header row becomes a thin strip holding only the minimize/close controls (no title, no subtitle).
- Terminal pocket border drops from 3px to 2px, with reduced padding, giving more area to the terminal.
- Right-clicking the nubbin opens a context menu with one item: **Rename**.
- Selecting Rename swaps the nubbin's label for an inline `<input>`. Enter or blur commits; Esc cancels.
- The renamed value updates `session.name` and the displayed nubbin text. It does **not** rename the folder on disk. State is in-memory only (consistent with `HANDOFF.md` noting no persistent session state).

## Out of Scope
- Renaming the actual folder on disk (separate feature listed in HANDOFF.md).
- Persisting the renamed name across app restarts.
- Multiple-rename / undo.

## Components
1. **Markup** (`renderer/app.js` `createSession()`):
   - Add `.folder-terminal-nubbin` element with the session name as text.
   - Remove `.session-title` and `.session-subtitle` from the inner tab.
2. **Styles** (`renderer/styles.css`):
   - Remove `.folder-terminal::before` styling.
   - Add `.folder-terminal-nubbin` rules mirroring the old pseudo-element shape, with text padding and auto-width.
   - Shrink inner-header grid row (e.g., `70px` → ~`36px`).
   - Drop `.terminal-pocket` border to 2px and shave padding.
3. **Interaction** (`renderer/app.js`):
   - `contextmenu` listener on the nubbin → custom menu with "Rename".
   - `startRename(session)` swaps the nubbin label for an input, commits on Enter/blur, cancels on Esc.
4. **Reuse** existing context-menu plumbing (`showContextMenu` style) — same `#context-menu` element.

## Risk / Notes
- The `::before` pseudo-element currently anchors visually to `.folder-terminal`'s top-left corner via `position: absolute` + negative top. The new real element must reproduce that anchoring without breaking the popup's `transform: translate(-50%, -50%)` centering.
- During Genie open/minimize animations, the nubbin moves with the popup. Since it'll be a child element, that comes for free.
- Tab width must not push the popup off-screen for long names — cap with `max-width` and `text-overflow: ellipsis`.
