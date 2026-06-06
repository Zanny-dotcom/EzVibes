# EZvibes Browser Workspace + Browser Design Mode Plan

Last updated: 2026-05-27

## Goal

Add browser tabs to EZvibes project session windows, then add a separate in-browser Browser Design Mode so the user can click real elements inside a localhost preview and send targeted design/change requests to the Claude or Codex tab for that same project.

Browser Design Mode should borrow the useful ideas from the existing EZvibes Panel Mode, but it should not be implemented as the same mode operating across two DOM worlds. App Panel Mode selects EZvibes UI regions. Browser Design Mode selects runtime webpage DOM inside a `WebContentsView`.

Target project shape:

- Project A session window:
  - Claude tab.
  - Codex tab.
  - Browser tab showing `http://localhost:5173/`.
- Project B session window:
  - Claude tab.
  - Codex tab.
  - Browser tab showing `http://localhost:3000/`.
- Project C session window:
  - Its own independent terminal tabs and browser tab.

Each browser tab belongs to one EZvibes session window and one project folder. Minimized session windows hide their browser surfaces without destroying them. Restoring the session window shows the same live page again.

## Product Vision

The feature turns a folder session into a compact web-project workspace:

1. Open a project folder in EZvibes.
2. Launch Claude and optionally Codex in that folder.
3. Add a browser tab from the session `+` menu.
4. Load a localhost URL for that project.
5. Click the existing Panel Mode button while the browser tab is active. Internally, EZvibes routes this to Browser Design Mode.
6. Hover and click an element in the actual preview page.
7. Type a change request such as `make this pricing table more compact`.
8. EZvibes sends Claude/Codex a structured request with the selected element metadata, page URL, project folder, and user instruction.

The user should not have to manually describe where the element is. The selected DOM context should do that work.

## Scope

### V1 Browser Tabs

- Add a browser tab type beside Claude and Codex terminal tabs.
- Support localhost-only navigation:
  - `http://localhost:*`
  - `https://localhost:*`
  - `http://127.0.0.1:*`
  - `https://127.0.0.1:*`
  - `http://[::1]:*`
  - `https://[::1]:*`
- Add URL toolbar controls:
  - address input
  - back
  - forward
  - reload / stop
- Keep one independent browser view per browser tab.
- Hide and restore browser views correctly during tab switches, minimize/restore, app hide/show, and session close.

### V2 Browser Design Mode

- When the Panel Mode button is toggled while a browser tab is active, enter Browser Design Mode inside that browser page.
- Highlight elements on hover inside the localhost page.
- Click an element to open a prompt composer.
- Send a structured payload to a terminal tab in the same project session window.
- Default dispatch target:
  - Prefer the last focused live terminal tab in the same session window.
  - Otherwise prefer a live Claude tab.
  - Otherwise prefer a live Codex tab.
  - If no live terminal exists, copy the payload to clipboard and show a visible status.
- Allow choosing Claude/Codex from the composer when both are live.

### Non-Goals

- No standalone browser windows outside EZvibes session windows.
- No general internet browsing.
- No `file://` preview loading. Static HTML projects should be served through localhost.
- No saved passwords, downloads, bookmarks, extensions, or full browser profile UI.
- No automatic dev-server launching in the first implementation.
- No guaranteed framework source-file mapping in the first Browser Design Mode implementation.
- No arbitrary page JavaScript execution API exposed to the EZvibes renderer.

## Existing Code Context

### Browser Tab Foundation

Relevant files:

- `main.js`
  - Owns `BrowserWindow`, IPC, terminal PTY lifecycle, close confirmation, permission denial, and app navigation lockdown.
- `preload.js`
  - Exposes the narrow `window.ezvibes` bridge.
- `renderer/app.js`
  - Owns session windows, tab strip, xterm tabs, activation, close lifecycle, narration, resize handling, and Panel Mode toggle wiring.
- `renderer/styles.css`
  - Owns tab strip, terminal pocket, terminal host, and Panel Mode styling.

Current renderer tab code assumes every tab is a terminal tab. Browser support requires an explicit tab type and terminal-only guards.

### Current Panel Mode

Relevant file:

- `renderer/panel-mode.js`

Current behavior:

- Finds app UI regions through `[data-panel-id]`.
- Draws a highlight in the EZvibes app renderer DOM.
- Opens a composer in the EZvibes app renderer DOM.
- Builds a text payload.
- Dispatches to a terminal tab through `window.ezvibes.writeTerminal`.

Current limitations to fix:

- It uses a hard-coded `EZVIBES_FOLDER`.
- It only understands EZvibes app DOM, not DOM inside `WebContentsView`.
- App DOM overlays may not paint above a native `WebContentsView`.
- It has no concept of "send to a terminal tab in the same project as this browser tab."

### Design Decision: Separate Mode, Shared Pattern

Do not make `renderer/panel-mode.js` directly operate inside browser pages.

Keep two implementations:

- App Panel Mode:
  - Existing EZvibes UI selection system.
  - Uses `[data-panel-id]`.
  - Opens its composer in the trusted EZvibes app renderer.
  - Good for modifying EZvibes itself.
- Browser Design Mode:
  - New localhost-page selection system.
  - Runs inside the preview `WebContentsView` through a dedicated preload.
  - Opens its composer inside the preview page, preferably in shadow DOM.
  - Good for designing/modifying the user's webpage project.

Share only the reusable pieces:

- global toolbar toggle routing
- terminal target selection
- terminal paste dispatch
- clipboard fallback
- prompt payload formatting conventions
- visual language where it helps consistency

This split avoids forcing one app-specific Panel Mode implementation to span the trusted EZvibes renderer and an untrusted browser preview.

## Architecture

### Main Process

Add a browser manager in `main.js` initially. Extract to `browser-manager.js` later if it grows.

Main owns:

- Browser view creation.
- Browser view lifecycle.
- Localhost-only navigation policy.
- Browser view bounds and visibility.
- Browser preview preload path.
- Preview-to-app Browser Design Mode event relay.
- Cleanup when renderer, window, app, or browser tab closes.

Add state:

```js
const browserViews = new Map();
const browserViewsByPreviewWebContentsId = new Map();
```

Browser record:

```js
{
  id,
  ownerWebContentsId,
  previewWebContentsId,
  windowId,
  view,
  url,
  title,
  loading,
  visible,
  bounds,
  designModeActive,
  designSelection,
}
```

Ownership rule:

- The app renderer that created a browser view is the only app renderer allowed to navigate, resize, show, hide, close, or activate Browser Design Mode for that view.
- Preview preload events are accepted only when `event.sender.id` maps to a known browser preview webContents.

### Preview WebContents

Use `WebContentsView` for the browser surface.

Preview `webPreferences`:

```js
{
  preload: path.join(__dirname, 'browser-design-preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  devTools: true,
  partition: `ezvibes-browser-${browserId}`
}
```

Use an in-memory partition by default. Do not use `persist:` for V1/V2 because saved browser profiles are a non-goal.

The preview preload must not expose `window.ezvibes`. It only installs dormant Browser Design Mode listeners and talks to main through a small set of IPC messages.

### Browser Design Preload

Add a new file:

- `browser-design-preload.js`

Responsibilities:

- Listen for main-process commands:
  - activate/deactivate picker
  - reset picker on navigation
  - optionally focus composer
- Install capture-phase mouse and keyboard listeners while picker is active.
- Highlight hovered DOM elements inside the preview page.
- Open an in-page shadow DOM composer after element selection.
- Build selected-element metadata.
- Send selected payload and user instruction to main.

Why the composer should live inside the preview page:

- `WebContentsView` is a native surface and may paint above EZvibes app DOM.
- An app-renderer composer can be obscured by the browser surface.
- A shadow DOM composer inside the preview surface remains visible above the selected webpage.
- Main can still relay the finished request to the trusted EZvibes renderer for terminal dispatch.

The composer can visually match the current Panel Mode composer, but implementation should be separate and browser-page-native enough to avoid fighting native view layering.

### Renderer

Renderer owns:

- Session window tab model.
- Browser tab DOM placeholder and toolbar.
- Browser bounds reporting.
- Browser tab activation and visibility.
- Dispatch target selection among terminal tabs in the same session window.
- Final terminal write or clipboard fallback.
- Global Panel Mode button routing.

Do not turn `renderer/panel-mode.js` into a cross-webContents controller. Instead:

- Keep `renderer/panel-mode.js` responsible for app UI Panel Mode.
- Add a Browser Design Mode controller in `renderer/app.js` or a new renderer module.
- Extract shared terminal dispatch helpers so both modes can send useful requests without duplicating paste/clipboard logic.
- Let the global Panel Mode button decide which mode to activate based on the active tab type.

## Tab Data Model

Add explicit tab type:

```js
{
  id,
  type: 'terminal' | 'browser',
  agent: 'claude' | 'codex' | null,
  sessionWindow,
  numericLabel,
  customName,
  tabChipEl,
  tabLabelEl,
  tabBadgeEl,
  closeBtnEl,

  // terminal-only
  ptyAlive,
  exited,
  failed,
  term,
  fitAddon,
  terminalEl,
  ptyCreated,
  terminalDisposables,

  // browser-only
  browserCreated,
  browserUrl,
  browserTitle,
  browserLoading,
  browserError,
  browserHostEl,
  browserToolbarEl,
  browserViewportEl,
  browserAddressEl,
}
```

Add helpers:

```js
function isTerminalTab(tab) {
  return !!tab && tab.type === 'terminal';
}

function isBrowserTab(tab) {
  return !!tab && tab.type === 'browser';
}

function isTabLive(tab) {
  return isTerminalTab(tab)
    && tab.ptyAlive === true
    && tab.exited !== true
    && tab.failed !== true;
}

function isTabReadyForInput(tab) {
  return isTabLive(tab) && tab.ptyCreated === true;
}
```

Use labels:

- Claude: `CLAUDE`, badge `CL`
- Codex: `CODEX`, badge `CX`
- Browser: `BROWSER`, badge `BR`

Recommended numbering:

- Keep terminal numbering as-is for compatibility.
- Add per-type browser numbering so the first browser tab is `BROWSER`, not `BROWSER 3`.

## IPC Design

### App Renderer To Main

Browser lifecycle:

- `browser:create`
- `browser:navigate`
- `browser:set-bounds`
- `browser:show`
- `browser:hide`
- `browser:close`
- `browser:go-back`
- `browser:go-forward`
- `browser:reload`
- `browser:stop`

Browser Design Mode:

- `browser-design:set-active`
  - payload: `{ browserId, active }`
- `browser-design:cancel`
  - payload: `{ browserId }`

### Main To App Renderer

Browser status:

- `browser:status`
- `browser:title`
- `browser:url`
- `browser:loading`
- `browser:navigation-state`
- `browser:load-error`
- `browser:navigation-blocked`
- `browser:destroyed`

Browser Design Mode:

- `browser-design:ready`
- `browser-design:selected`
- `browser-design:submit`
- `browser-design:cancelled`
- `browser-design:error`

`browser-design:submit` payload:

```js
{
  browserId,
  url,
  title,
  selection,
  message,
}
```

Renderer handles this by finding the browser tab, then choosing a live terminal tab in the same `sessionWindow`.

### Main To Preview Preload

- `browser-design:state`
  - payload: `{ active }`
- `browser-design:reset`
- `browser-design:show-error`
  - payload: `{ message }`

### Preview Preload To Main

- `browser-design:preload-ready`
- `browser-design:hover`
- `browser-design:selected`
- `browser-design:submit`
- `browser-design:cancelled`

Main validates:

- Sender must be a known preview webContents.
- Browser record must exist.
- Browser record must have `designModeActive === true` for selection and submit events.
- Payload strings and snippets must be length-limited.

## Navigation Policy

Main process is authoritative.

Allow only localhost URLs:

```js
function isAllowedBrowserUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  const protocolAllowed = parsed.protocol === 'http:' || parsed.protocol === 'https:';
  const hostname = parsed.hostname.toLowerCase();
  return protocolAllowed && (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname === '::1'
  );
}
```

Enforce in:

- `browser:navigate`
- preview `will-navigate`
- preview `will-frame-navigate`
- preview `setWindowOpenHandler`
- redirects, via navigation events

For blocked URLs:

- prevent navigation
- keep the previous page visible
- send `browser:navigation-blocked` to renderer
- show concise status in the browser toolbar

## Browser Tab UI

Inside `.terminal-pocket`, add browser host panels:

```html
<div class="browser-host" role="tabpanel">
  <div class="browser-toolbar">
    <button class="browser-back">Back</button>
    <button class="browser-forward">Forward</button>
    <button class="browser-reload">Reload</button>
    <form class="browser-address-form">
      <input class="browser-address" type="text" spellcheck="false" />
    </form>
  </div>
  <div class="browser-viewport"></div>
  <div class="browser-status" hidden></div>
</div>
```

The `.browser-viewport` is a placeholder for bounds. The real page surface is the `WebContentsView` owned by main.

URL normalization in renderer:

- `localhost:5173` -> `http://localhost:5173/`
- `127.0.0.1:3000` -> `http://127.0.0.1:3000/`
- `[::1]:5173` -> `http://[::1]:5173/`
- `http://localhost:5173` remains as provided

Main still validates the final URL.

## Browser Bounds And Visibility

Renderer sends bounds from `browserViewportEl.getBoundingClientRect()` in CSS pixels relative to the app window content:

```js
{
  x: Math.round(rect.left),
  y: Math.round(rect.top),
  width: Math.round(rect.width),
  height: Math.round(rect.height)
}
```

Main applies:

```js
view.setBounds(bounds);
view.setVisible(visible);
```

Rules:

- Only the active browser tab in a visible, non-minimized session window may have a visible view.
- Hide browser views while opening/minimizing animations run.
- Hide browser views while app close confirmations or app-level modals appear above the session area.
- Hide inactive browser views when switching to terminal tabs.
- Resync active browser bounds after resize, restore, navigation toolbar layout changes, and animation end.

## Browser Design Mode UX

### Activation

When the user clicks the global Panel Mode button:

- If the active session tab is a browser tab:
  - activate Browser Design Mode for that browser tab.
  - keep the browser view visible.
  - put the page into element-pick mode.
- Otherwise:
  - use existing app UI Panel Mode.

When Browser Design Mode is active:

- Hover highlights page elements.
- Click selects an element.
- Page clicks are swallowed and do not trigger page app actions.
- Escape cancels selection or exits Browser Design Mode.
- Right-click cancels the current hover/selection.
- The browser toolbar remains usable only after exiting Browser Design Mode.

### Selection

On hover:

- Draw highlight inside the preview page.
- Label the element with a compact name:
  - `button.primary`
  - `table.pricing`
  - `h2`
  - `img.hero`

On click:

- Freeze the highlight.
- Build element metadata.
- Open an in-page composer near the selected element.
- The composer includes:
  - selected element label
  - URL
  - target terminal selector when multiple live terminal tabs exist
  - textarea for the change request
  - Cancel
  - Send

### Dispatch

On Send:

1. Preview preload sends `{ browserId, selection, message }` to main.
2. Main validates and relays to the owning app renderer.
3. Renderer finds the browser tab and its `sessionWindow`.
4. Renderer chooses the target terminal tab in the same session window.
5. Renderer builds the terminal payload.
6. Renderer writes a bracketed paste to the target terminal.
7. Browser Design Mode exits and the page returns to normal interaction.

Payload should use CR line breaks for terminal paste compatibility, matching existing Panel Mode behavior.

## Element Metadata

Collect enough context for Claude/Codex to identify and modify the element without dumping the full page.

Selection payload:

```js
{
  label,
  tagName,
  id,
  className,
  role,
  ariaLabel,
  text,
  selector,
  cssPath,
  rect,
  viewport,
  computed,
  attributes,
  ancestorChain,
  nearbyText,
  outerHTMLSnippet,
  tableContext,
  mediaContext,
  formContext,
}
```

Limits:

- `text`: max 500 chars
- `nearbyText`: max 1000 chars
- `outerHTMLSnippet`: max 4000 chars
- `ancestorChain`: max 8 ancestors
- `attributes`: allowlist common attributes and truncate values

Computed styles to include:

- display
- position
- width / height
- margin / padding
- color / background-color
- font-family / font-size / font-weight / line-height
- border / border-radius
- flex / grid related properties
- text-align
- opacity
- z-index

Special context:

- For tables:
  - table selector
  - row index
  - column index
  - header text for the selected column
  - row text
- For images:
  - `src`
  - `alt`
  - rendered size
  - natural size if available
- For form controls:
  - label text
  - placeholder
  - input type
  - name
- For links/buttons:
  - visible text
  - href/type
  - accessible label

Do not collect:

- cookies
- localStorage
- sessionStorage
- full page HTML
- request headers
- passwords or hidden input values

## Terminal Prompt Payload

Renderer builds a message like:

```text
[EZvibes browser design-mode request]
Project folder: C:\path\to\project
Preview URL: http://localhost:5173/pricing
Page title: Pricing
Target browser tab: BROWSER
Selected element: table.pricing td.price
Selector: main .pricing-table tbody tr:nth-child(2) td:nth-child(3)
Element text: $19 / month
Element rect: x=412 y=284 width=112 height=44

DOM context:
<td class="price">$19 / month</td>

Nearby context:
Column header: Pro
Row text: Monthly Pro $19 / month ...

Relevant computed styles:
display: table-cell
font-size: 16px
font-weight: 600
text-align: right
padding: 16px 20px

User request:
Make this pricing column more compact and align the prices better.
```

The prompt should explicitly instruct the agent to inspect and edit source files in the current project folder rather than assume the DOM selector maps directly to a file.

Add this line near the top:

```text
Use the selected DOM context to locate the responsible source files in this project. Do not rely on the selector being a source-file path.
```

## Implementation Milestones

### Milestone 1: Browser IPC Skeleton

Deliverables:

- Add `WebContentsView` import.
- Add `browserViews` maps.
- Add browser lifecycle IPC handlers.
- Add ownership checks.
- Add localhost URL validation.
- Add cleanup on owner renderer destruction, window close, render-process-gone, app quit.
- Add preload API methods.

Acceptance:

- Renderer can create and close a hidden browser view.
- App close destroys browser views.
- `npm run check:syntax` passes.

### Milestone 2: Browser Tab Type

Deliverables:

- Add `tab.type`.
- Add terminal/browser helper guards.
- Split terminal tab creation from generic tab creation.
- Add browser tab chip labels and badge.
- Add `Open Browser` to the session `+` menu.
- Right-click `+` opens the menu instead of directly creating Codex.
- Add browser host DOM placeholder.

Acceptance:

- Claude/Codex tabs still work.
- Browser tabs can be created, selected, and closed.
- Switching between terminal and browser tabs does not throw.

### Milestone 3: Browser Bounds And Navigation

Deliverables:

- Add toolbar UI.
- Add URL normalization.
- Add `syncBrowserBounds`.
- Show browser view only for active visible browser tab.
- Hide browser view on tab switch, minimize, close confirmations, and app hide.
- Add back/forward/reload/stop.

Acceptance:

- `localhost:5173` loads as `http://localhost:5173/`.
- Three session windows can each own a separate browser tab and URL.
- Minimized project browser views do not float over other projects.
- Restored project browser views reappear with the same page.

### Milestone 4: Shared Dispatch Refactor

Deliverables:

- Remove hard-coded `EZVIBES_FOLDER` from `renderer/panel-mode.js`.
- Add internals for:
  - active session window
  - active tab
  - terminal tabs in a session window
  - preferred terminal dispatch target
- Extract reusable payload dispatch helper.
- Add clipboard fallback that does not assume a specific folder.
- Keep app Panel Mode and Browser Design Mode as separate callers of the shared dispatch helper.

Acceptance:

- Existing EZvibes app Panel Mode still works.
- App Panel Mode sends to the active project terminal, not a hard-coded folder.
- No behavior change for normal terminal input.

### Milestone 5: Browser Design Preload Skeleton

Deliverables:

- Add `browser-design-preload.js`.
- Configure browser `WebContentsView` to use it.
- Add preview preload ready event.
- Add main-to-preview active/inactive messages.
- Add preview-to-main cancel/selected/submit event relay.
- Add validation and payload truncation in main.

Acceptance:

- Activating Browser Design Mode on a browser tab toggles page picker state.
- Reloading the page reinitializes the preload.
- Deactivating Browser Design Mode removes page listeners and overlays.

### Milestone 6: In-Page Picker And Composer

Deliverables:

- Add hover highlight inside the browser page.
- Add click-to-freeze selection.
- Add shadow DOM composer inside the browser page.
- Add keyboard handling:
  - Escape cancels/ exits.
  - Ctrl+Enter sends.
- Add target terminal selector if multiple live terminal tabs exist.

Acceptance:

- User can select real DOM elements inside a localhost page.
- Page app clicks are suppressed while picking.
- Composer remains visible above the preview page.
- Cancel restores normal page interaction.

### Milestone 7: Element Metadata And Prompt Quality

Deliverables:

- Add selector generator.
- Add element metadata collector.
- Add table/image/form/button/link special cases.
- Add computed style allowlist.
- Add terminal payload builder.
- Add log events for selection and dispatch without logging page content beyond safe summaries.

Acceptance:

- Clicking a table cell gives row/column/header context.
- Clicking a hero/image/button gives useful source-identifying context.
- Payload is concise enough for terminal paste but detailed enough for source edits.

### Milestone 8: Lifecycle Polish

Deliverables:

- Deactivate Browser Design Mode on browser tab close.
- Deactivate or pause on minimize.
- Restore active picker state only when the same browser tab remains active.
- Clear overlays on navigation.
- Resend picker active state after page reload.
- Hide browser view only where native layering requires it.
- Add narration events for browser tab creation, navigation, design selection, and dispatch.

Acceptance:

- Browser Design Mode never remains active on a hidden/minimized/destroyed view.
- Switching projects while Browser Design Mode is active does not leave stale overlays.
- Existing app Panel Mode and Live Log panels still behave.

### Milestone 9: Safety And Regression Testing

Deliverables:

- Add `renderer/panel-mode.js` and `browser-design-preload.js` to `npm run check:syntax`.
- Add unit-testable helper functions where practical:
  - URL normalization
  - localhost validation
  - selector generation
  - payload truncation
  - terminal target selection
- Add manual smoke checklist.

Acceptance:

- `npm run check:syntax` passes.
- Three project sessions can run independent browser tabs.
- Browser Design Mode can dispatch to the correct project terminal.
- Terminal tab close/resize/paste behavior remains intact.

## Security Model

Trust boundaries:

- EZvibes app renderer is trusted app UI.
- Localhost browser page is untrusted preview content, even if it is the user's project.
- Main process owns native capabilities and PTY sessions.
- Browser preload is privileged enough to inspect page DOM, but it must not expose terminal, filesystem, clipboard, or app-control APIs to the page.

Rules:

- Browser pages never receive `window.ezvibes`.
- Browser pages run with:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webSecurity: true`
- Browser partition is in-memory by default.
- Permission requests are denied for browser partitions.
- Main validates every navigation.
- Main validates browser ownership for every IPC command.
- Main validates preview sender identity for every Browser Design Mode event.
- Browser Design Mode submit only opens a user-mediated terminal dispatch path.
- No cookies, storage, headers, passwords, hidden inputs, or full page HTML are sent.

Known acceptable limitation:

- A localhost page can change its own DOM. The selected metadata represents the runtime DOM the user clicked, not a trusted source-file mapping.

## Logging

Main log events:

- `browser.created`
- `browser.closed`
- `browser.navigate`
- `browser.navigation_blocked`
- `browser.load_failed`
- `browser.bounds_rejected`
- `browser_design.activated`
- `browser_design.deactivated`
- `browser_design.selection_received`
- `browser_design.submit_received`
- `browser_design.event_rejected`

Renderer log events:

- `renderer.browser_tab.created`
- `renderer.browser_tab.closed`
- `renderer.browser.navigate_requested`
- `renderer.browser_design.activated`
- `renderer.browser_design.dispatched`
- `renderer.browser_design.clipboard_fallback`

Do not log full DOM snippets or user request bodies by default. Log short labels, URL origin/path, browserId, tabId, and status.

## Manual Smoke Checklist

Run:

```powershell
npm run check:syntax
npm start
```

Browser tab smoke:

1. Open project A.
2. Launch Claude.
3. Add Codex tab.
4. Add Browser tab.
5. Load `localhost:5173`.
6. Open project B.
7. Add Browser tab.
8. Load `localhost:3000`.
9. Switch between projects and confirm browser views stay attached to the correct session.
10. Minimize project A and confirm its browser view disappears.
11. Restore project A and confirm its page returns.
12. Close a browser tab and confirm the view is destroyed.

Browser Design Mode smoke:

1. With project A browser tab active, toggle Panel Mode.
2. Hover page elements and confirm highlight follows.
3. Click a button or table cell.
4. Confirm composer appears inside the preview.
5. Send a request to Claude.
6. Confirm the prompt lands in the Claude terminal for project A, not project B.
7. Repeat with Codex selected as target.
8. Press Escape during selection and confirm normal page interaction returns.
9. Reload the page and confirm Browser Design Mode can be activated again.
10. Switch to another tab while picker is active and confirm old overlay is cleared.

Regression smoke:

1. Existing app Panel Mode still highlights EZvibes UI panels.
2. Existing terminal tabs still resize correctly.
3. Existing terminal paste/drop behavior still works.
4. Closing a live terminal still uses the destructive close confirmation.
5. Closing a browser tab does not show terminal close confirmation.

## Key Risks And Mitigations

### Native View Layering

Risk:

- `WebContentsView` can paint over app renderer DOM.

Mitigation:

- Put Browser Design Mode highlight and composer inside the preview page.
- Hide browser views only for app-level modals that must appear above the browser surface.

### Source Mapping Is Hard

Risk:

- Runtime DOM does not directly identify source files in React/Vite/Svelte/etc.

Mitigation:

- Payload tells the agent to inspect project files using URL, text, selector, classes, and DOM context.
- Add source-map or framework-specific mapping later.

### Terminal Target Confusion

Risk:

- Active tab is the browser tab, so "active tab" cannot receive terminal input.

Mitigation:

- Dispatch only to terminal tabs in the same session window.
- Prefer last focused live terminal in that session.
- Provide a target selector when multiple live terminals exist.

### Browser View Drift

Risk:

- Native browser bounds can drift from the DOM placeholder.

Mitigation:

- Use `ResizeObserver`.
- Sync on activation, resize, restore, animation end, toolbar layout change, and visibility events.

### Security Regression

Risk:

- Browser preview content could receive app capabilities.

Mitigation:

- No `window.ezvibes` in preview pages.
- No terminal/fs/clipboard APIs exposed to preview pages.
- Main validates all preview events and only relays user-mediated Browser Design Mode submissions.

## Recommended First Patch

Do not start with Browser Design Mode. First implement and stabilize independent browser tabs.

First patch should include:

- Browser IPC skeleton.
- Browser tab type.
- `Open Browser` menu item.
- Manual localhost URL toolbar.
- Per-tab `WebContentsView`.
- Correct show/hide/close cleanup.

Second patch:

- Refactor existing Panel Mode dispatch to remove the hard-coded folder.
- Add terminal target selection helpers per session window.

Third patch:

- Add browser-page Browser Design Mode preload, picker, composer, metadata, and dispatch.

This keeps the native browser integration testable before adding the more complex in-page element picker.
