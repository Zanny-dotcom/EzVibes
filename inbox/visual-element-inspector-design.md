# Visual Element Inspector — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorming complete)

## Overview

A visual element-targeting tool. Point at a DOM element in a browser tab (pointed at a
localhost app), describe a change in plain words, then hand that task to a running agent
session picked from grid view. The selected agent receives the instruction plus the
element's HTML, applied CSS, bounding box, CSS-selector path, and page URL — injected
directly into its PTY.

## Workflow

1. **Toggle ON** — click the crosshair button (⌖) in the `#sidebar-actions` row (next to
   📂 / Auto / ✕). **Sticky**: stays on until clicked off.
2. **Hover & click** — in the active browser tab, an injected overlay highlights the element
   under the cursor (DevTools-style). Click locks it in and captures context.
3. **Describe** — a floating prompt box appears; type the instruction (e.g. "make this red")
   and hit **Apply**.
4. **Select window** — grid view opens in "select window" mode (agent sessions only). Banner:
   "Click a session to send this task."
5. **Inject** — click a session tile → composed prompt is written into that session's PTY via
   `terminalAPI.send(tabId, …)`. An **auto-submit** toggle decides whether a trailing Enter is
   sent (run it) or not (typed, user edits first).
6. Toggle stays ON → pick another element and repeat. Click crosshair off to exit.

## Architecture

New isolated feature, renderer-only:

```
renderer/features/element-inspector/
  element-inspector.renderer.js   // toggle state, picker lifecycle, prompt box,
                                   // Apply → pickWindow → compose → inject
  element-inspector.styles.css
```

Cross-cutting integration (like Workspaces). Each existing feature exposes exactly ONE new
hook; the inspector orchestrates.

| Seam | Owner → Caller | Signature | Purpose |
|---|---|---|---|
| `captureElement(tabId)` | Browser → Inspector | `async () → {html, css, rect, selector, url} \| null` | Runs the picker script inside the tab's `<webview>` via `executeJavaScript`; resolves on element click, or null on cancel. Only Browser may touch the guest webview. |
| `setPickerActive(tabId, bool)` | Browser → Inspector | toggles the persistent hover overlay | Keeps select-mode live across clicks while the sticky toggle is on. |
| `pickWindow(opts)` | GridView → Inspector | `async () → tabId \| null` | Enters grid in "select" mode, shows banner, resolves with the clicked tile's tabId. |
| `injectIntoSession` | (existing preload) | `terminalAPI.send(tabId, text + (submit ? '\r' : ''))` | PTY injection — no new hook needed. |

The inspector READS `TabsFeature.getActiveTabId()` / `getTypeOf(tabId)` to verify the active
tab is a browser tab before entering select mode. No existing feature imports the inspector.

Touches three feature folders (browser, grid-view, element-inspector) + `index.html`. Documented
in each `.claude/rules/*.md` and FEATURE-MAP.md.

## The picker (injected into the webview)

`captureElement(tabId)` injects a self-contained IIFE via `webview.executeJavaScript(script, true)`:

- Fixed-position highlight `<div>` (high z-index, `pointer-events:none`) follows `mousemove`,
  sized/positioned to `getBoundingClientRect()` of `document.elementFromPoint(x,y)`.
- `click` (capture phase, `preventDefault` + `stopPropagation` so the page doesn't navigate)
  captures the element and resolves.
- Returns `{ html: outerHTML (capped ~4KB), css: <curated computed subset>, rect:{x,y,w,h},
  selector: <unique path>, url: location.href }`.
- `Esc` cancels → resolves `null`.

Computed CSS is a curated ~30-property subset (layout / box / typography / color / flex / grid),
not all 300+, to keep the prompt readable. Selector path walks parents using `id` →
`nth-of-type` for uniqueness.

`setPickerActive(tabId, true)` installs a persistent variant so select-mode survives across
clicks (sticky toggle); `setPickerActive(tabId, false)` tears it down.

## Prompt box & composed payload

Floating panel (inspector-owned) appears after an element is locked in: a `<textarea>` + **Apply**
button + **auto-submit** checkbox (default checked = send with Enter).

Composed prompt:

```
I'm looking at this element on the page http://localhost:3000/

My request: make this button red

--- Element ---
Selector: body > main > button.cta
<button class="cta">Buy now</button>

--- Applied styles ---
background-color: rgb(255,255,255); color: rgb(17,17,17); padding: 12px 20px; ...

--- Position ---
x:420 y:180 w:140 h:44
```

## Grid "select window" mode

`pickWindow()` calls `GridViewFeature.enterGrid()` with a new `selectMode` flag: shows a banner;
the next tile click resolves the promise with that `tabId` (instead of only focusing). On resolve,
grid exits to the chosen session so the user sees the task arrive. Then
`terminalAPI.send(tabId, composed + (submit ? '\r' : ''))`.

Grid already excludes browser tabs and (with folder-bound workspaces auto-creating
Claude/Codex/Browser tabs) shows no empty terminals — so the tiles are exactly the agent
sessions, no extra filtering needed.

## Error handling

- Toggle clicked while active tab isn't a browser tab → brief inline hint, no-op.
- `captureElement` throws (unreachable/odd page) → resolve null, show hint.
- Zero agent sessions when `pickWindow` runs → hint "no sessions to send to," abort.
- `Esc` cancels the in-flight pick/prompt and tears down overlays cleanly.

## Out of scope (YAGNI)

- No "Apply the change to the live page" preview — the agent makes the real code change; the
  page updates on the app's own reload. (The user's "make this red" is an instruction to the
  agent, not a live CSS edit.)
- No multi-element queuing before picking a window — one element → one task → one session.
- No persistence of the toggle state across restarts.
