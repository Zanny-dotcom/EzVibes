# Panel Mode

## Goal
Add a top-right toggle that puts EZvibes into "panel mode": the user hovers any major UI region, clicks to select it, types a request in a small floating composer, and the structured payload (region name + selector + file:line + the user's request) is sent into the active Claude tab for the EZvibes folder. When no live Claude tab exists for EZvibes, the payload falls back to the system clipboard so the user can paste it into any Claude session.

The point is to remove the "which bar do you mean?" round-trips this session has been full of — the user can point at a thing instead of describing where it is.

## Current State
- The topbar (`renderer/index.html:16-29`) has two existing toggles wired the same way: `#narration-toggle` (▤) and `#live-log-toggle` (LOG). Both flip a renderer-state flag, update `aria-pressed`, and either add a class to a parent (`.shell.narration-open`) or toggle `hidden` on a fixed-position panel. Handlers live in `renderer/app.js:82-105`.
- The context menu (`#context-menu`, built at `renderer/app.js:647-691`) demonstrates the existing pattern for a small floating UI anchored at viewport coordinates with edge-clamping (`app.js:667-671`) and global `click` + `Escape` dismissal (`app.js:103-105`).
- The renderer keeps a session-by-folder map at `state.windowsByPath` (`app.js:9`), and the active tab for a window is resolved via `getActiveTab(sessionWindow)` (`app.js:1163-1168`). Each tab's `id` is the IPC `sessionId`.
- `api.writeTerminal(sessionId, text)` (`preload.js:105`) forwards raw bytes to `node-pty` via `terminal:input` in `main.js:912-917`. No sanitization, no rate limiting, multi-line safe. Already used today for clipboard paste (`app.js:176-185`) and dropped-file paths (`app.js:385`) — both send the entire string in a single call.
- `api.writeClipboard(text)` is already exposed for the fallback path.
- Highest current `z-index` in `styles.css` is 2000 (`.new-tab-menu` at `styles.css:1024`). A panel-mode overlay needs to sit above that.
- Static regions are defined in `renderer/index.html`. Dynamic regions (folder cards, session windows, tab chips, terminal pockets) are built in `renderer/app.js` and have no stable `data-*` hooks today.

## Target State
- A new `#panel-mode-toggle` icon button appears in the topbar between `#narration-toggle` and `#live-log-toggle`. Default label is the symbol `◫` with `title="Panel Mode"`. It uses the same `aria-pressed` styling as the other two toggles.
- Clicking the toggle flips `state.panelModeActive`, adds `panel-mode-active` to `<body>`, and installs the panel-mode listeners on `document`. A second click (or `Escape`, or a successful Send) exits the mode and tears everything down.
- While the mode is active:
  - A single overlay element `#panel-mode-highlight` follows the mouse, snapping its bounding box to the nearest ancestor that is registered as a selectable region. A small chip in the top-left of the highlight shows the region's friendly name.
  - All non-region click and hover effects on the page are visually suppressed (subtle dim on `<main>` + `cursor: crosshair`). Clicks on the toggle itself and on the highlight overlay are still allowed; everything else is intercepted in capture phase.
  - Right-click cancels the current hover but does not exit the mode.
- Clicking a highlighted region freezes the highlight and opens `#panel-mode-composer` next to it, edge-clamped via the same logic the context menu uses. The composer shows:
  - Read-only header: friendly name, CSS selector, `file:line` reference, one-line description.
  - A `<textarea>` for the user's request, auto-focused.
  - `Send` and `Cancel` buttons. `Ctrl+Enter` submits; `Escape` cancels (closes composer, keeps mode active so the user can pick a different region).
- On Send, the renderer builds the structured payload (format below), tries to inject it into the active Claude tab for the EZvibes folder, otherwise copies it to the clipboard and surfaces an inline toast inside the composer. Successful injection clears the composer and exits panel mode.

## Out of Scope
- Persisting a history of panel-mode selections across launches.
- Multi-region "batch" selections in a single composer message.
- Screenshot capture of the selected region. (The composer payload is text-only; screenshots remain a separate user workflow.)
- Editing region metadata (friendly name, file:line, description) from inside the panel UI. The registry is curated in source.
- Auto-detecting which folder is the EZvibes project — the target folder is a constant pointing at the repo root.
- Selecting arbitrary deep DOM nodes (`<span>`, `<svg>`, internal xterm canvases, etc.). Only entries in the curated registry are selectable.
- Hot-reload / live-edit of the region registry. Adding a new selectable region is a code change.

## Components

### 1. Toggle button (markup + handler)
- `renderer/index.html`: add `<button id="panel-mode-toggle" class="icon-button panel-mode-toggle" title="Panel Mode" aria-pressed="false">◫</button>` between `#narration-toggle` and `#live-log-toggle` (around `renderer/index.html:27-28`).
- `renderer/app.js`: cache `els.panelModeToggle`, add a click handler that calls `setPanelModeActive(!state.panelModeActive)`. Mirror the narration/live-log handler structure at `app.js:82-105`.
- `renderer/styles.css`: reuse the existing `.icon-button` rules; add a `.panel-mode-toggle[aria-pressed="true"]` rule that matches the narration/live-log pressed-state styling (accent border + background).

### 2. Panel-mode module (`renderer/panel-mode.js`)
A new file, loaded after `app.js` from `renderer/index.html`. Exposes one entry point:

```js
window.ezvibesPanelMode = {
  setActive(active),
  isActive(),
};
```

Internally it owns:
- `PANEL_REGIONS` — the curated registry (next section).
- The overlay element (`#panel-mode-highlight`) and composer element (`#panel-mode-composer`), both created lazily on first activation, hidden the rest of the time.
- The `mousemove`/`click`/`keydown`/`contextmenu` document listeners installed only while the mode is active.
- `state.currentRegion` (the registry entry currently under the cursor or selected) and `state.frozen` (true once a region has been selected and the composer is open).
- `findRegion(target)` — walks up from `document.elementFromPoint`'s result, returning the first ancestor that either (a) has a `data-panel-id` attribute matching a registry entry, or (b) matches one of the static-region CSS selectors.
- `paintHighlight(region)` — positions `#panel-mode-highlight` at the region element's `getBoundingClientRect()`, updates the chip label.
- `openComposer(region, anchorEl)` — builds the composer markup, positions it with edge-clamping, focuses the textarea.
- `dispatchPayload(region, message)` — builds the payload string (format below), resolves the EZvibes folder's active Claude tab, sends via `api.writeTerminal` with bracketed-paste wrappers, or falls back to `api.writeClipboard` + toast.

`app.js` does not need to know the module's internals beyond `setActive(bool)`.

### 3. Region registry (`PANEL_REGIONS`)
A const array inside `renderer/panel-mode.js`. Each entry:

```js
{
  id: 'topbar',                        // matches data-panel-id on dynamic regions
  selector: '#app > header.topbar',    // CSS selector for static regions; null for dynamic ones
  friendlyName: 'Top bar',
  file: 'renderer/index.html',
  line: '16-29',
  describe: () =>
    'Header with brand label, back/up/refresh nav, path bar, search, narration & log toggles.',
}
```

Initial registry (~25 entries, all already inventoried during research):

Static (matched by selector in `renderer/index.html`):
- `topbar`, `window-title`, `nav-buttons-group`, `back-btn`, `up-btn`, `refresh-btn`, `path-bar`, `search-input`, `narration-toggle`, `live-log-toggle`, `panel-mode-toggle` (selectable for meta-changes), `sidebar`, `active-sessions-btn`, `quick-paths-list`, `command-bar`, `new-session-btn`, `folder-count`, `folder-grid`, `narration-sidebar`, `live-log-panel`, `context-menu`.

Dynamic (need `data-panel-id` added in builders, all in `renderer/app.js`):
- `folder-card` — set in the card-construction block around `app.js:595`.
- `session-window` — set on the root `.folder-terminal` element built around `app.js:1184`.
- `session-window-tab-strip` — `.folder-terminal-tab-strip` around `app.js:1187`.
- `session-window-tab-chip` — `.folder-terminal-tab-chip` around `app.js:1288`.
- `session-window-add-tab` — `.folder-terminal-tab-add` around `app.js:1206`.
- `session-window-folder-name-label` — `.folder-name-label` around `app.js:1189`.
- `session-window-controls` — `.session-controls` around `app.js:1190`.
- `terminal-pocket` — `.terminal-pocket` around `app.js:1196` (the visual folder frame; the inner `.terminal-host` is intentionally not selectable to avoid xterm-internal capture).

`findRegion` prefers the closest ancestor with `data-panel-id`; if none match, it tries the static selectors from outermost-first (so clicking a `.folder-card` inside `#grid` returns `folder-card`, not `folder-grid`).

### 4. Overlay + composer (DOM + CSS)
- `#panel-mode-highlight` — a `position: fixed` `<div>` with a transparent body, 2px solid accent border, no `pointer-events`, `z-index: 5000` (above the current max of 2000). A nested `<span class="panel-mode-chip">` in the top-left displays the friendly name. The element is created once and reused.
- `#panel-mode-composer` — `position: fixed`, `z-index: 5001`, dark panel matching the existing context-menu styling (`styles.css:326-354`). Inner structure:
  ```html
  <div class="panel-mode-composer-header">
    <strong class="panel-mode-composer-name"></strong>
    <code class="panel-mode-composer-selector"></code>
    <span class="panel-mode-composer-file"></span>
    <p class="panel-mode-composer-describe"></p>
  </div>
  <textarea class="panel-mode-composer-input" placeholder="Describe the change…"></textarea>
  <div class="panel-mode-composer-toast" hidden></div>
  <div class="panel-mode-composer-actions">
    <button data-action="cancel">Cancel</button>
    <button data-action="send" class="primary">Send</button>
  </div>
  ```
- `body.panel-mode-active` styles: `main.shell` gets `filter: brightness(0.85)`, body cursor becomes `crosshair`. Toggle button's `aria-pressed="true"` uses the existing accent border + background.

### 5. Payload format
```
[EZvibes panel-mode request]
Target: <friendlyName>
Selector: <selector or data-panel-id>
Defined: <file>:<line>
Description: <describe()>

Request:
<user textarea text, trimmed>
```

Wrapped on dispatch in bracketed-paste markers so Claude treats it as a paste, not keystrokes:
```
\x1b[200~<payload>\x1b[201~\n
```

The trailing `\n` after `\x1b[201~` submits the paste so Claude sees it as a single message rather than waiting for the user to press Enter.

### 6. Dispatch + fallback
1. Resolve `EZVIBES_FOLDER` — a constant defined near the top of `panel-mode.js`, set to the absolute path of this repo. (Captured once at module load via `await api.getInitialPath()`-style lookup? **No.** A hard constant is simpler and the app already runs from this directory; the user can edit the constant if they ever move the project. Listed as a known limitation.)
2. `const sessionWindow = state.windowsByPath.get(EZVIBES_FOLDER)`. (`panel-mode.js` reaches into the shared `state` map; expose `getEzvibesSessionWindow()` from `app.js` rather than importing the whole state map, to keep coupling narrow.)
3. If a window exists and its active tab is alive (`activeTab && activeTab.ptyAlive`), call `api.writeTerminal(activeTab.id, wrappedPayload)`. Show no toast — just close the composer and exit panel mode.
4. Otherwise, call `api.writeClipboard(payload)` (unwrapped — clipboard recipients don't want bracketed-paste markers), reveal the `.panel-mode-composer-toast` inside the composer for ~2.5 seconds with the text *"No active EZvibes Claude session — payload copied to clipboard. Paste it into any Claude session."*, leave the composer open so the user can also Cancel without re-typing.

### 7. Exit lifecycle
- Click toggle while active → `setActive(false)` → remove listeners, hide overlay + composer, clear `body.panel-mode-active`, reset `aria-pressed`, restore `state.currentRegion` / `state.frozen` to null.
- Press `Escape` with composer open → close composer, keep mode active (user can pick another region).
- Press `Escape` with composer closed → `setActive(false)`.
- Successful Send → composer fades, `setActive(false)`.
- Right-click → cancel current hover (so the highlight redraws on next `mousemove`), do not exit.

## Risk / Notes
- **`data-panel-id` is set in builders, so dynamic content automatically inherits it.** Adding a new dynamic region (e.g. a future "history rail") means remembering to add the attribute in its builder; the registry will list it next to its builder line for discoverability.
- **Terminal capture.** Setting `data-panel-id="terminal-pocket"` on `.terminal-pocket` makes the visual frame selectable. We deliberately do not tag `.terminal-host` because xterm's internal canvases shouldn't be selection targets and would also confuse `elementFromPoint` (many small overlay layers).
- **Bracketed paste vs raw write.** Today's clipboard paste handler (`app.js:176-185`) sends raw clipboard text without bracketed-paste markers; that path currently works for Claude. We wrap the panel-mode payload in markers because it is multi-line and the user did not type it — without markers, Claude could interpret embedded newlines as keystroke `Enter` and submit before the whole payload arrives.
- **Z-index above `.new-tab-menu` (2000).** Panel-mode overlay sits at 5000/5001 so a user can still hover the New Tab menu in panel mode and select it. The session-window layer (`z-index: 20`) is far below; session windows are fully covered.
- **`state.windowsByPath` reach-in.** The cleanest narrow surface is a tiny accessor exposed from `app.js`: `function getEzvibesSessionWindow() { return state.windowsByPath.get(EZVIBES_FOLDER); }`. `panel-mode.js` imports just that (via `window.ezvibesInternals = { getEzvibesSessionWindow, getActiveTab }`). No need to expose the full state map.
- **Capture-phase intercept.** Document-level listeners use `{ capture: true }` so panel mode wins against other handlers (folder-card click, context-menu dismiss). The toggle button's own click is allowed through by checking `event.target.closest('#panel-mode-toggle')` first.
- **Composer focus management.** Opening the composer steals focus into its textarea, so the user can immediately type. `Tab` from the textarea goes to Send.
- **Folder-card vs folder-grid disambiguation.** Hovering a folder card should highlight the card, not the grid. `findRegion` resolves this by walking parents from innermost-out and returning the first match — since `folder-card` has `data-panel-id` and is the deeper element, it wins automatically.
- **Multiple EZvibes session windows.** Not possible today (`windowsByPath` is keyed by folder, one window per folder), so "the active Claude tab" is unambiguous.
- **Sending into a Codex tab.** If the EZvibes window's active tab is Codex (not Claude), we still inject. The payload header makes the source obvious; Codex can choose to act or ignore. We do not filter by agent.
- **Long-running mode.** No automatic timeout. The user must explicitly exit.
- **EZvibes path constant.** Hard-coded for now. If the user clones the repo elsewhere, they edit one line. Acceptable trade-off; auto-detection can come later if needed.
