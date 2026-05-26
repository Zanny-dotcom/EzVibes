# Drag-and-Drop Interactions for the Prompt Vault (2025-2026 Research)

Research agent #29 for the EZvibes "prompt vault" feature. The goal: a panel inside each terminal session window where markdown files (prompts, hand-offs, CLAUDE.md) can be discovered, picked, dropped onto the terminal, dragged from outside, reordered, and tagged — all with **pioneer-level** drag interactions.

EZvibes is **vanilla JavaScript** (no React, no bundler). That shapes every recommendation: native HTML5 DnD + Pointer Events, optionally SortableJS, optionally Pragmatic drag-and-drop (the only major library that ships a clean vanilla-friendly API and supports external file drops).

---

## 1. Library landscape (2026 reality check)

### 1.1 Quick verdict for EZvibes

EZvibes has no React. That **eliminates** `@dnd-kit`, `hello-pangea/dnd`, `formkit/drag-and-drop`'s React wrapper, and `react-dnd` from the "drop-in" list. They can still be studied for inspiration but cannot ship without a JSX/bundler stack the project explicitly rejects.

The viable drop-ins are:

| Library | Bundle | Why it fits EZvibes |
|---|---|---|
| **Pragmatic drag and drop** | ~4.7 kB core, framework-agnostic | Modular, handles native file drops from Explorer, used by Trello/Jira, vanilla-friendly |
| **SortableJS** | ~12 kB | Pure vanilla, zero deps, drag-handle support, cross-list groups, MIT |
| **interact.js** | ~16 kB | Drag + resize + multi-touch + snapping + inertia, also vanilla, but file-drop is weaker than Pragmatic |
| **Native HTML5 DnD + Pointer Events** | 0 kB | Maximum control, works for the "drag prompt onto terminal pocket → paste" core flow |

For EZvibes's prompt vault, the **strongest stack** is:
- Native HTML5 DnD for the marquee interaction (vault → terminal "paste-on-drop").
- SortableJS for reordering pinned prompts inside the vault list.
- Pragmatic-DnD's `external` adapter (or raw `webUtils.getPathForFile`) for accepting `.md` files dragged in from Windows Explorer.

The mistake to avoid is using just one library for everything. Pragmatic-DnD is more lightweight than SortableJS but provides only "basic drop indicators" and asks you to render every visual yourself. SortableJS hands you ghost classes and animations out of the box. For the prompt list you want SortableJS's polish; for the file-drop pipe you want Pragmatic's flexibility (or the raw API).

### 1.2 Pragmatic drag and drop — deep dive

Atlassian's framework-agnostic library is the spiritual successor to `react-beautiful-dnd` (which is now deprecated). It powers Trello, Jira, and Confluence. Core docs are at `atlassian.design/components/pragmatic-drag-and-drop`. Key facts from the 2026 ecosystem:

- **Tiny core**: ~4.7 kB. Optional pieces (hitbox, auto-scroll, react-accessibility, react-drop-indicator) load only when used.
- **Three adapter families**:
  - `element/adapter` — drag DOM elements between drop targets in the page.
  - `text-selection/adapter` — drag selected text.
  - `external/adapter` — accept drag operations that **started outside the window** (OS file drops, cross-window text/HTML drops, etc.). This is exactly what you need to receive a `.md` file dropped from Explorer.
- **Three primitives**: `draggable`, `dropTarget*`, `monitor*`. Each returns a cleanup function so you can wire/unwire on tab switch without leaks.
- **Headless**: ships no UI. You render the drop indicator yourself (`@atlaskit/pragmatic-drag-and-drop-react-drop-indicator` exists for React; for EZvibes you'd write ~10 lines of CSS).
- **Closest-edge hitbox**: import `attachClosestEdge` / `extractClosestEdge` from `@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge` to know whether the pointer is closer to the top or bottom of a drop target — perfect for insertion-line markers.
- **License**: Apache 2.0 (not MIT). Sync model: one-way mirror from Atlassian's monorepo, daily. Not currently accepting outside code contributions, but issues are welcome.

Install (npm names use the `@atlaskit/` scope despite the project being branded "Pragmatic"):

```bash
npm i @atlaskit/pragmatic-drag-and-drop @atlaskit/pragmatic-drag-and-drop-hitbox tiny-invariant
```

Minimum-viable element-to-element drag (vanilla JS, no React):

```js
import { draggable, dropTargetForElements, monitorForElements }
  from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';

const cleanupDraggable = draggable({
  element: promptCardEl,
  getInitialData: () => ({ kind: 'prompt', path: '/EZvibes/prompts/hand-off-2.md' }),
  onDragStart: () => promptCardEl.classList.add('is-dragging'),
  onDrop:      () => promptCardEl.classList.remove('is-dragging'),
});

const cleanupDropTarget = dropTargetForElements({
  element: terminalPocketEl,
  getData:        () => ({ kind: 'terminal-pocket', tabId: 'abc123' }),
  onDragEnter:    () => terminalPocketEl.classList.add('is-drop-target'),
  onDragLeave:    () => terminalPocketEl.classList.remove('is-drop-target'),
  onDrop:         () => terminalPocketEl.classList.remove('is-drop-target'),
});

const cleanupMonitor = monitorForElements({
  onDrop({ source, location }) {
    if (source.data.kind !== 'prompt') return;
    const target = location.current.dropTargets[0];
    if (!target || target.data.kind !== 'terminal-pocket') return;
    pasteFileIntoTerminal(target.data.tabId, source.data.path);
  },
});
```

External-file adapter (paste a `.md` file from Explorer into the vault):

```js
import { dropTargetForExternal, monitorForExternal }
  from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import { containsFiles, getFiles }
  from '@atlaskit/pragmatic-drag-and-drop/external/file';
import { preventUnhandled }
  from '@atlaskit/pragmatic-drag-and-drop/prevent-unhandled';

preventUnhandled.start(); // stops the browser from "navigating to" a dropped file

dropTargetForExternal({
  element: vaultListEl,
  canDrop: ({ source }) => containsFiles({ source }),
  onDragEnter: () => vaultListEl.classList.add('is-receiving-files'),
  onDragLeave: () => vaultListEl.classList.remove('is-receiving-files'),
  onDrop: ({ source }) => {
    const files = getFiles({ source });          // File[]
    files
      .filter(f => f.name.toLowerCase().endsWith('.md'))
      .forEach(f => importMdIntoVault(f));        // call your IPC
    vaultListEl.classList.remove('is-receiving-files');
  },
});
```

In Electron this is the cleanest path because the external adapter normalizes whatever `dataTransfer` actually contains and gives you typed accessors. The only thing it does **not** do is hand you absolute file paths — for that you still need `webUtils.getPathForFile` (see §3).

### 1.3 SortableJS — vanilla JS reorder/drop-between-lists

- No jQuery, no framework, IE9+ but you care about Electron's Chromium.
- Built on the native HTML5 DnD API (so it does **not** inherit the touch-event quirks of pointer-only solutions and works on Windows trackpads).
- Ships ghost classes, drag handle support, cross-list `group:` semantics, programmatic `.toArray()` serialization, plug-ins for MultiDrag/Swap/AutoScroll/OnSpill, and a `store` interface for persisting order.

Minimal vault list with handle + smooth swap animation:

```js
import Sortable from 'sortablejs';

const list = document.getElementById('vault-list');
const sortable = Sortable.create(list, {
  animation: 200,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',  // "snappy out"
  handle: '.prompt-grip',                     // only the grip is grabbable
  ghostClass: 'prompt--ghost',                // placeholder hole styling
  chosenClass: 'prompt--chosen',              // item being held
  dragClass: 'prompt--dragging',              // the floating clone
  forceFallback: true,                        // use SortableJS's own clone, lets us style via CSS
  fallbackTolerance: 4,                       // a couple px wiggle before drag starts (kills accidental drags)
  swapThreshold: 0.65,
  invertSwap: true,
  store: {
    get: s => (localStorage.getItem('vaultOrder-' + s.options.group?.name) || '').split('|').filter(Boolean),
    set: s => localStorage.setItem('vaultOrder-' + s.options.group?.name, s.toArray().join('|')),
  },
  group: { name: 'vault-prompts', pull: 'clone', put: false }, // cloneable, can be dragged onto terminal
  onEnd: evt => publishVaultEvent({ from: evt.oldIndex, to: evt.newIndex }),
});
```

The `forceFallback: true` flag is the secret weapon for the prompt vault. By default the browser uses the OS's drag-image which **cannot be styled with CSS** (you can only swap it for an image via `setDragImage`). With `forceFallback: true`, SortableJS skips the native dragstart and creates a clone DOM element you can style — glass blur, glow, scale, whatever. Use this when you want the ghost to look like the rest of your UI rather than a sad PNG screenshot.

### 1.4 interact.js (mentioned for completeness)

`interact.js` adds drag + resize + multi-touch + snapping + inertia in one package and is vanilla. Snap-to-grid is a one-liner:

```js
interact('.prompt-card').draggable({
  inertia: true,
  modifiers: [
    interact.modifiers.snap({
      targets: [interact.snappers.grid({ x: 8, y: 8 })],
      range: Infinity,
      relativePoints: [{ x: 0, y: 0 }],
    }),
    interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true }),
  ],
});
```

For EZvibes, snapping isn't really needed inside a list — but if you ever build a free-form pinboard view for prompts, interact.js gives you snap, grid, and inertia for almost no code.

### 1.5 What about `@dnd-kit`?

Worth knowing what it does even though you can't ship it directly. The 2026 update redesigned the event-type system to follow the DOM `EventMap` pattern (`DragDropEventMap`, `DragDropEventHandlers`). The new **Feedback plugin** promotes the dragged element into the browser's **top-layer** via the **Popover API** — meaning the floating preview escapes every stacking-context and overflow:hidden container on the page automatically. They also fixed the `@layer` cascade to integrate cleanly with Tailwind v4. The **OptimisticSortingPlugin** is enabled by default for sortables and reorders DOM optimistically each `dragover` for a janky-free feel.

The **idea you can steal even without React**: promote your floating ghost to `position: fixed; z-index: 999999; pointer-events: none;` and append it to `document.body` so it never gets clipped. That gives you the same "escapes everything" feel as `dnd-kit`'s top-layer trick, without the Popover API.

---

## 2. Native HTML5 DnD vs Pointer Events — when to use which

You have **two competing APIs** for "user grabs a thing and moves it." They overlap, but each has hard edges.

### 2.1 HTML5 Drag and Drop API

- Events: `dragstart`, `drag`, `dragend` on the source; `dragenter`, `dragover`, `dragleave`, `drop` on the target.
- **You must `preventDefault()` on `dragover`** or `drop` will never fire. This is the most common bug.
- Carries a `DataTransfer` object with `items`, `files`, `types`, `setData`, `getData`, `setDragImage`, `dropEffect` ('copy'|'move'|'link'|'none'), and `effectAllowed`.
- **Free OS integration**: dropping a `.md` file from Explorer fires `drop` with `e.dataTransfer.files` populated. Dragging an internal item with `event.dataTransfer.setData('text/plain', ...)` lets you drop **into other apps** like Notepad.
- **Limitations**:
  - The default drag-image is the element's screenshot, semi-transparent — you cannot CSS it. Override only via `setDragImage(canvasOrImg, x, y)`.
  - Inconsistent touch support (iOS Safari especially).
  - `dragstart`/`dragend` do **not** fire for OS file drops.
  - The DataTransfer object is locked outside `dragstart` / `drop` (security: you can't snoop dragged data with mousemove-equivalent events).

### 2.2 Pointer Events API

- Events: `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, plus `gotpointercapture` / `lostpointercapture`.
- A **single API across mouse / touch / pen**. Each pointer has an ID; multi-touch is one Map keyed by `pointerId`.
- The killer feature: `element.setPointerCapture(e.pointerId)` re-routes every subsequent pointer event for that ID to that element, even when the cursor leaves it. That's how you implement a slider/drag without losing the cursor.
- Need `touch-action: none` on the draggable element (or a child drag-handle) to stop the browser from interpreting the gesture as a scroll. Apply only to the drag handle if the parent must remain scrollable.
- **Does not** integrate with the OS clipboard / file system. Cannot accept files from Explorer.
- **Floating-point precision** for `clientX/Y` (vs HTML5's integer `movementX/Y` accumulation drift).

### 2.3 Decision matrix for EZvibes

| Interaction | Use | Why |
|---|---|---|
| Drag prompt card → drop on terminal pocket → paste | **HTML5 DnD** | You probably want this to also work as "drag prompt to Notepad" out of the app. The free OS integration is worth it. |
| Reorder pinned prompts inside the vault | **SortableJS** (which itself uses HTML5 DnD with `forceFallback` clone) | Built-in ghost class, autoscroll, animations. |
| Receive `.md` files dropped from Windows Explorer | **HTML5 DnD** (`dataTransfer.files` + `webUtils.getPathForFile`) | Only HTML5 DnD speaks to the OS. |
| Resize the vault panel | **Pointer Events + `setPointerCapture`** | Slider behavior — capturing the pointer is the only way to keep it smooth across the divider. |
| Drag the entire vault panel out to detach (future) | **Pointer Events** | Custom physics, escape from the page boundary, smoother. |
| Custom canvas drag preview (Genie animation) | **HTML5 DnD + `setDragImage(canvas, x, y)`** | Only HTML5 lets you swap the ghost. |

### 2.4 The hybrid pattern Linear / Notion / Figma actually use

Modern apps **don't pick one** — they layer them. Linear's tab popover uses `@dnd-kit` (Pointer Events under the hood). The Linear board uses a custom HTML5-based system with insertion lines. Notion's `⋮⋮` handle uses a hybrid: Pointer Events for the press-and-hold-to-start gesture, then promotes to HTML5 DnD on actual drag so dragging out into another window works. **For EZvibes, do the same**: use `pointerdown` to detect intent (5-pixel threshold), then call `el.setAttribute('draggable', 'true')` and trigger HTML5 DnD. The reverse is `el.removeAttribute('draggable')` on `pointerup` before threshold so click-to-paste still works on tap.

---

## 3. Electron-specific file drop reality (2026 edition)

This is the single most painful corner of the research. **There is a known regression** (`electron/electron#44600`) where `webUtils.getPathForFile()` returns an empty string for `File` objects produced by `drop` events on macOS in Electron 30-33. EZvibes is on Electron 33 → **you will hit this on Mac**. On Windows it works.

### 3.1 The correct 2026 pattern (Electron 32+)

`File.path` was removed; you must use `webUtils`. The pattern that still works on Windows (and degrades gracefully on Mac):

**preload.js**

```js
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('ezvibes', {
  // ... existing exports ...
  getDroppedFilePaths: (files) => {
    // `files` is an array passed from a renderer drop handler.
    return Array.from(files).map(f => webUtils.getPathForFile(f));
  },
});
```

**renderer/app.js** (drop handler)

```js
vaultPanelEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  vaultPanelEl.classList.add('is-receiving-files');
});

vaultPanelEl.addEventListener('dragleave', () => {
  vaultPanelEl.classList.remove('is-receiving-files');
});

vaultPanelEl.addEventListener('drop', async (e) => {
  e.preventDefault();
  vaultPanelEl.classList.remove('is-receiving-files');

  const fileList = [...e.dataTransfer.items]
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean);

  const paths = window.ezvibes.getDroppedFilePaths(fileList);
  for (const p of paths) {
    if (p && p.toLowerCase().endsWith('.md')) {
      await importPromptFromAbsolutePath(p);   // IPC to copy/symlink into vault folder
    }
  }
});

// Crucial: stop the browser from "navigating to" the file if it lands outside any drop zone
window.addEventListener('dragover', e => {
  if ([...e.dataTransfer.items].some(i => i.kind === 'file')) e.preventDefault();
});
window.addEventListener('drop', e => {
  if ([...e.dataTransfer.items].some(i => i.kind === 'file')) e.preventDefault();
});
```

### 3.2 `dataTransfer.items` vs `.files` — pick `items`

- `items` is a `DataTransferItemList`. Each item has `kind: 'file' | 'string'` and a MIME `type`. You can filter to files cleanly, and inspect type early during `dragover` (so the drop-zone can show "Markdown" vs "PDF — won't accept" cues).
- `.files` is a flat `FileList`. Use only as a fallback.

### 3.3 Dragging files **out of** the Electron app

The pattern most users want next: drag a vault prompt out of EZvibes into another app. Electron supports this via `webContents.startDrag(item)`:

**preload.js**
```js
contextBridge.exposeInMainWorld('ezvibes', {
  startDragPromptFile: (absolutePath) => ipcRenderer.send('vault:start-drag', absolutePath),
});
```

**main.js**
```js
const path = require('path');
const { ipcMain, nativeImage } = require('electron');
const dragIcon = nativeImage.createFromPath(path.join(__dirname, 'renderer/icons/md.png'));

ipcMain.on('vault:start-drag', (event, filePath) => {
  event.sender.startDrag({ file: filePath, icon: dragIcon });
});
```

**renderer/app.js**
```js
promptCardEl.addEventListener('dragstart', (e) => {
  e.preventDefault();                          // required so Electron handles it natively
  window.ezvibes.startDragPromptFile(prompt.absolutePath);
});
```

After this, the user can drag an EZvibes prompt **out** of the app and drop it onto Notepad, Obsidian, or anywhere that accepts files. Obsidian, for example, will turn it into a markdown link automatically.

---

## 4. Visual-feedback patterns (the "make it pioneer-level cool" part)

### 4.1 The microstate flow (NN/Group + 2026 UX articles)

Every drag interaction is a five-step state machine. Every one of these should have a distinct, intentional visual:

`idle → hover → grab → move → drop → settle (back to idle or success)`

- **idle**: card sits flat. Subtle drop-shadow.
- **hover**: cursor changes to `grab`; card lifts 1-2 px; reveal the drag-handle ▤ icon at left.
- **grab** (mousedown / pointerdown): cursor switches to `grabbing`; card scales to 1.04, increases shadow, slight rotation (1-3°) like Trello does.
- **move**: ghost follows pointer. Drop-zone glows pulse.
- **drop** (mouseup over valid target): drop-zone flashes accent, ghost snap-animates to its slot.
- **settle**: 100-160 ms cubic-bezier ease-out back to idle. The 100 ms timing is the magic NN/Group number — slower feels mushy, faster feels twitchy.

### 4.2 Ghost preview — three rendering strategies

**Strategy A: native `setDragImage` with a canvas**

```js
promptCardEl.addEventListener('dragstart', (e) => {
  const ghostCanvas = document.createElement('canvas');
  ghostCanvas.width = 280;
  ghostCanvas.height = 56;
  const ctx = ghostCanvas.getContext('2d');
  // Frosted-glass background
  ctx.fillStyle = 'rgba(20, 22, 27, 0.86)';
  ctx.fillRect(0, 0, 280, 56);
  // Accent border
  ctx.strokeStyle = '#f5a524';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, 280, 56);
  // Text
  ctx.fillStyle = '#fff';
  ctx.font = '600 13px Inter, system-ui';
  ctx.fillText(prompt.name, 16, 34);
  // Markdown glyph
  ctx.fillStyle = '#f5a524';
  ctx.font = '700 11px monospace';
  ctx.fillText('.md', 240, 34);

  e.dataTransfer.setDragImage(ghostCanvas, 14, 28);
  e.dataTransfer.effectAllowed = 'copyLink';
  e.dataTransfer.setData('text/plain', prompt.absolutePath);
});
```

The canvas must be in the DOM **at the moment of `setDragImage`**, or off-screen but visible to the layout engine. A common gotcha: the canvas image is captured the instant `setDragImage` is called — animating the canvas afterwards has no effect.

**Strategy B: SortableJS `forceFallback` clone**

When you use `forceFallback: true`, SortableJS clones the dragged element into the DOM, gives it the `sortable-drag` class, and positions it under the cursor. You style it freely:

```css
.prompt--dragging {
  opacity: 0.95;
  transform: rotate(2deg) scale(1.04);
  background: rgba(20, 22, 27, 0.8);
  backdrop-filter: blur(14px) saturate(180%);
  -webkit-backdrop-filter: blur(14px) saturate(180%);
  box-shadow:
    0 24px 60px -16px rgba(0,0,0,0.6),
    0 0 0 1px rgba(245, 165, 36, 0.6),
    0 0 24px rgba(245, 165, 36, 0.25);
  transition: transform 80ms ease-out;
}

.prompt--ghost {           /* the hole left behind */
  opacity: 0.25;
  background: linear-gradient(90deg,
    rgba(245,165,36,0.08), rgba(245,165,36,0.02));
  border: 1px dashed rgba(245,165,36,0.4);
}
```

This is the **highest-fidelity option** because the ghost actually IS your styled DOM. It looks identical to the rest of the UI.

**Strategy C: custom React-style ghost without React (manual)**

For maximum control (this is the pattern from Medium's "Custom drag ghost in React: the way that actually works"):

```js
// On pointerdown, hide original to opacity ~0.05, create a fixed-position clone, follow pointer.
let ghost = null, offsetX = 0, offsetY = 0;

promptCardEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const rect = promptCardEl.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  ghost = promptCardEl.cloneNode(true);
  ghost.classList.add('prompt--floating-ghost');
  ghost.style.position = 'fixed';
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.pointerEvents = 'none';
  document.body.appendChild(ghost);
  promptCardEl.style.opacity = '0.05';
  promptCardEl.setPointerCapture(e.pointerId);
});

promptCardEl.addEventListener('pointermove', (e) => {
  if (!ghost) return;
  ghost.style.left = `${e.clientX - offsetX}px`;
  ghost.style.top  = `${e.clientY - offsetY}px`;
});

promptCardEl.addEventListener('pointerup', (e) => {
  if (!ghost) return;
  ghost.remove();
  ghost = null;
  promptCardEl.style.opacity = '';
  promptCardEl.releasePointerCapture(e.pointerId);
});
```

This gives you smooth 60-fps drag with full styling control and bypasses the HTML5 DnD opacity quirk entirely. Downside: you lose the OS file-drop integration. **Use this for in-app drag only.**

### 4.3 Drop-zone highlight patterns

**Pattern 1: pulsing glow border** (classic, still feels great)

```css
.terminal-pocket.is-drop-target {
  outline: 2px solid rgba(245, 165, 36, 0.6);
  outline-offset: -2px;
  animation: pocket-pulse 1.2s ease-in-out infinite;
}

@keyframes pocket-pulse {
  0%, 100% { box-shadow: inset 0 0 0 0 rgba(245,165,36,0.0); }
  50%      { box-shadow: inset 0 0 60px 0 rgba(245,165,36,0.18); }
}
```

**Pattern 2: dotted-line drop frame** (Google Drive, Figma)

```css
.vault-list.is-receiving-files::before {
  content: '';
  position: absolute; inset: 8px;
  border: 2px dashed rgba(245,165,36,0.55);
  border-radius: 14px;
  pointer-events: none;
}
```

**Pattern 3: staged feedback intensity** (2026 best practice from bricxlabs)

States ramp:
- **available** (something is being dragged, you accept it): faint dashed border.
- **proximate** (within ~80 px): dashed becomes solid, accent.
- **active** (cursor inside): glow + slight background tint.
- **success** (drop fired): bright flash, scale-pop, then settle.

```js
let proxAnim = null;
document.addEventListener('drag', (e) => {
  const rect = terminalPocketEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
  const intensity = Math.max(0, Math.min(1, 1 - (dist - 80) / 280));
  terminalPocketEl.style.setProperty('--drop-intensity', intensity);
});
```

```css
.terminal-pocket {
  --drop-intensity: 0;
  box-shadow:
    inset 0 0 calc(60px * var(--drop-intensity)) calc(2px * var(--drop-intensity)) rgba(245,165,36,0.25);
  border-color: hsl(36, 90%, calc(50% + 20% * var(--drop-intensity)));
}
```

This is the **pioneer move**. Drop zones don't just light up — they glow stronger as the user approaches, like a magnet field visualizer.

### 4.4 Insertion-line markers (between items in the vault list)

Three approaches, in order of polish:

**Approach 1: SortableJS native ghost-class**
Already handles this for free — `ghostClass: 'prompt--ghost'` paints the placeholder, items slide into place via CSS transform. Use this for the typical case.

**Approach 2: Pragmatic-DnD's `attachClosestEdge`**
For each card, attach the closest edge ('top' or 'bottom') to the drop-target data. Render a small `<div class="drop-indicator" />` absolutely-positioned at the top or bottom of the hovered card.

```js
dropTargetForElements({
  element: cardEl,
  getData: ({ input, element }) =>
    attachClosestEdge({ kind: 'prompt-card', cardId: card.id },
      { input, element, allowedEdges: ['top', 'bottom'] }),
  onDrag: ({ self }) => {
    const edge = extractClosestEdge(self.data);
    cardEl.dataset.closestEdge = edge ?? '';
  },
  onDragLeave: () => { cardEl.dataset.closestEdge = ''; },
  onDrop:      () => { cardEl.dataset.closestEdge = ''; },
});
```

```css
.prompt-card { position: relative; }
.prompt-card[data-closest-edge="top"]::before,
.prompt-card[data-closest-edge="bottom"]::after {
  content: '';
  position: absolute; left: 6px; right: 6px; height: 2px;
  background: linear-gradient(90deg, transparent, #f5a524 12%, #f5a524 88%, transparent);
  border-radius: 2px;
  box-shadow: 0 0 12px rgba(245,165,36,0.55);
}
.prompt-card[data-closest-edge="top"]::before    { top: -4px; }
.prompt-card[data-closest-edge="bottom"]::after  { bottom: -4px; }
```

**Approach 3: Proximity-based "closest centroid" algorithm** (from Julik Tarkhanov's drag-reordering blog, 2022 — still the best vanilla pattern in 2026)

Compute centroids of every list item once. On `dragover`, find the closest centroid by Euclidean distance, then decide INTENT_BEFORE / INTENT_AFTER by which side of the centroid the pointer is on. This handles **grids, vertical lists, horizontal galleries, and the empty list edges** uniformly:

```js
const DIR_V = 'v', DIR_H = 'h';

function centroid(el) {
  const r = el.getBoundingClientRect();
  return { x: (r.left + r.right) / 2 + scrollX, y: (r.top + r.bottom) / 2 + scrollY };
}

function predictDirection(items) {
  if (items.length < 2) return DIR_V;
  const a = centroid(items[0]), b = centroid(items[1]);
  return Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? DIR_H : DIR_V;
}

list.addEventListener('dragover', (e) => {
  e.preventDefault();
  const dir = predictDirection([...list.children]);
  const ranked = [...list.children].map(el => {
    const c = centroid(el);
    return { el, c, d: Math.hypot(c.x - (e.clientX + scrollX), c.y - (e.clientY + scrollY)) };
  }).sort((a, b) => a.d - b.d);

  const { el, c } = ranked[0];
  const before = dir === DIR_V
    ? (e.clientY + scrollY) < c.y
    : (e.clientX + scrollX) < c.x;

  [...list.children].forEach(n => { delete n.dataset.insert; });
  el.dataset.insert = before ? 'before' : 'after';
});
```

CSS draws the line at the `before` or `after` boundary. **This is bulletproof across any layout** and is what to reach for if you want one drop-system to also serve a future "prompt board" view.

### 4.5 Snap-to-grid (future prompt-board feature)

For a free-form pinboard of prompts, `interact.js` is the cleanest one-liner. For pure vanilla, snap by rounding `pointermove` deltas to the grid:

```js
const GRID = 8;
const snap = (v) => Math.round(v / GRID) * GRID;

cardEl.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  cardEl.style.transform = `translate(${snap(e.clientX - startX)}px, ${snap(e.clientY - startY)}px)`;
});
```

Magnetic alignment guides (Figma-style): on every pointermove, compute the dragged item's edges vs every sibling's edges; if within ~4 px, draw a thin pink line at that y/x and snap. This was the headline feature in Figma's "smart guides" launch and is what makes their drag feel "psychic."

### 4.6 "Release to drop" hint

A small tooltip that appears beside the cursor when hovering over a valid drop target, e.g. "Release to paste into terminal" — works wonders for discoverability:

```js
let hint = null;
terminalPocketEl.addEventListener('dragenter', () => {
  hint = document.createElement('div');
  hint.className = 'drop-hint';
  hint.textContent = 'Release to paste';
  document.body.appendChild(hint);
});
terminalPocketEl.addEventListener('dragover', (e) => {
  if (!hint) return;
  hint.style.left = `${e.clientX + 14}px`;
  hint.style.top  = `${e.clientY + 14}px`;
});
['dragleave','drop'].forEach(ev => terminalPocketEl.addEventListener(ev, () => { hint?.remove(); hint = null; }));
```

```css
.drop-hint {
  position: fixed; z-index: 99999;
  pointer-events: none;
  background: rgba(20,22,27,0.92);
  color: #f5a524;
  padding: 6px 10px; border-radius: 8px;
  font: 600 11px Inter; letter-spacing: 0.02em;
  box-shadow: 0 8px 28px -8px rgba(0,0,0,0.6);
  backdrop-filter: blur(10px) saturate(160%);
  transform: translateY(-2px);
  animation: hint-in 100ms ease-out;
}
@keyframes hint-in {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(-2px); }
}
```

---

## 5. Drag-to-tag pattern (cool, low-cost addition)

Koos Looijesteijn's "Drag to Tag" pattern: rather than a typed input, the user drags a tag chip onto a word/file to assign it. For EZvibes this would be elegant:

- Tag chips ("`hand-off`", "`debug`", "`schema`") live at the top of the vault.
- Users drag a chip onto a prompt card → that prompt gets the tag.
- Alternatively, drag a prompt card onto a chip → same result.
- macOS Finder shipped this in 2013 for filesystem tags; it's still considered the easiest tagging UX ever shipped.

```js
// Each chip is both draggable and a drop target.
chipEl.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('application/x-vault-tag', tag);
  e.dataTransfer.effectAllowed = 'link';
});

promptCardEl.addEventListener('dragover', (e) => {
  if ([...e.dataTransfer.types].includes('application/x-vault-tag')) e.preventDefault();
});

promptCardEl.addEventListener('drop', (e) => {
  const tag = e.dataTransfer.getData('application/x-vault-tag');
  if (tag) applyTagToPrompt(prompt.id, tag);
});
```

Use a **custom MIME type** (`application/x-vault-tag`) so the drop handler can distinguish tags from prompts from files. This is the single most underrated feature of the HTML5 DnD API — `setData(type, value)` lets you scope drops precisely without ever inspecting strings.

---

## 6. Real apps in 2026 — what they actually do

### 6.1 Trello (Atlassian)

Powered by `pragmatic-drag-and-drop`. Cards have a 2-3° rotation while dragged, drop shadow, and slide-into-place animation. The bullseye trick: **cards never displace before you commit** — you see a thin highlight line for the insertion point, and other cards stay still until the drop fires. This is faster and less twitchy than the dnd-kit OptimisticSortingPlugin approach.

### 6.2 Linear

Uses `dnd-kit`. Two drag modes:
- **Popover mode**: drag tabs around in a small popover for fine reordering. Tabs that are visually hidden are kept in the DOM via `visibility: hidden` so they hold their slot — preventing layout-flicker.
- **Inline mode**: drag issues between groups in the main board view. Dropping into a new group automatically updates the issue's status field as a side effect.

The Linear lesson: **the drop should mean something semantically**. A drag isn't just a reorder — it's a state change in your data model.

### 6.3 Notion

The `⋮⋮` left-margin handle is famous. Behavior:
- Hover-only: handle appears only when the row is hovered.
- **Shift+click on multiple handles** = multi-select drag.
- **Drag slightly right** = nest under parent block (Notion's tab/shift+tab made spatial).
- **Hold Alt while dropping** = duplicate instead of move.

The Notion lesson: **modifier keys turn one gesture into four.** Build your drop handler to read `e.altKey`, `e.shiftKey`, `e.ctrlKey/metaKey` and branch — almost no cost, huge expressive power.

### 6.4 Figma

Drag interaction = first-class prototyping primitive. In 2026, smart-guides + magnetic alignment are still the gold standard. When you drag a shape, Figma:
1. Snaps to a 4-px grid by default.
2. Shows pink alignment lines when edges match siblings' edges/centers.
3. Renders a numeric label showing distance to neighbors as you drag near them.
4. Inertia-scrolls the canvas when you reach the viewport edge.

The Figma lesson: **distance labels** while dragging. For EZvibes this could be a small "↓ 3" overlay showing what slot in the vault list the prompt will land in.

### 6.5 Obsidian (most relevant to EZvibes)

The vault model EZvibes is building IS Obsidian's, basically. Obsidian's drag features:
- Drag a file from vault tree onto a tab header → opens it there.
- Drag a file into a note's editor → inserts as a markdown link.
- Drag with **Ctrl held** → inserts an absolute `file:///` link instead of a relative one.
- Drag an Obsidian note OUT of the app → drops as an `obsidian://` URL into the receiving app.
- HTML pasted from a browser auto-converts to markdown when dropped into an editor.

The Obsidian playbook is essentially the spec for EZvibes's prompt vault: **drag = transclude into terminal**, drag-with-modifier = different paste mode (raw, with metadata header, as filename only, etc.), drag-out = export as `.md` to another app.

### 6.6 Awwwards 2025-2026 experiments worth noting

- **"Drag and Release 3D Experience"** — release physics with bounce, WebGL ground rebound. Could be the "prompt slingshot": fling a prompt at the terminal, it arcs through the air, bounces once, and lands as pasted text.
- **"Drag Navigation Chrome Experiment"** — drag-to-navigate on an infinite canvas. Inspiration for a "prompt pinboard" view where prompts live spatially.
- **"Hyper Reality 2016"** — skeuomorphic ribbon drag. Inspiration for a "drag-to-summon" gesture where pulling down on the vault tab reveals it with elastic resistance.

---

## 7. Putting it all together — recommended EZvibes design

### 7.1 Vault panel data flow

```
[ Vault panel ]                                            [ Terminal pocket ]
  prompt list  ────drag (HTML5 DnD)────>  drop  ───── IPC: vault:paste ─────> ptyWrite(content)
  tag chips    ────drag────>  prompt cards (same panel)        |
  + ───── Explorer file ──drop──> getPathForFile ── add to vault folder
```

### 7.2 The vault item — the "card" itself

A single vault row should:
- Show file name, modification time, first 1-2 lines of content.
- Have a left-edge grip (`⋮⋮`-style) that's the only `touch-action: none` zone.
- Be clickable = preview (popover with full content + "Paste" / "Copy" buttons).
- Be **double-click** = paste immediately (`xterm.write(content + '\r')` or pty input).
- Be **drag** = paste-on-drop, plus also draggable out of the app (creates `.md` file copy).
- Be **right-click** = context menu (Paste, Paste as `cat` heredoc, Copy path, Rename, Delete).
- Show a **live "fresh" pulse** for ~30 s after a hand-off.md is written by another session (file watcher).

### 7.3 Suggested vanilla-JS architecture for EZvibes

```js
// renderer/vault.js (new file)
class VaultPanel {
  constructor(sessionWindowEl, folderPath, terminal) {
    this.folderPath = folderPath;
    this.terminal = terminal;
    this.el = sessionWindowEl.querySelector('.vault-panel');
    this.listEl = this.el.querySelector('.vault-list');
    this.sortable = null;
    this.cleanups = [];
    this.initSortable();
    this.initFileDropZone();
    this.initWatcher();
    this.refresh();
  }

  initSortable() {
    this.sortable = Sortable.create(this.listEl, {
      animation: 200,
      handle: '.prompt-grip',
      ghostClass: 'prompt--ghost',
      dragClass: 'prompt--dragging',
      forceFallback: true,
      group: { name: 'vault-' + this.folderPath, pull: 'clone', put: ['vault-*'] },
      store: {
        get: s => JSON.parse(localStorage.getItem('vault-order-' + this.folderPath) || '[]'),
        set: s => localStorage.setItem('vault-order-' + this.folderPath, JSON.stringify(s.toArray())),
      },
    });
  }

  initFileDropZone() {
    const onDragOver = (e) => {
      if (![...e.dataTransfer.items].some(i => i.kind === 'file')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      this.el.classList.add('is-receiving-files');
    };
    const onDragLeave = () => this.el.classList.remove('is-receiving-files');
    const onDrop = async (e) => {
      e.preventDefault();
      this.el.classList.remove('is-receiving-files');
      const files = [...e.dataTransfer.items]
        .filter(i => i.kind === 'file')
        .map(i => i.getAsFile())
        .filter(Boolean);
      const paths = window.ezvibes.getDroppedFilePaths(files);
      for (const p of paths) {
        if (p?.toLowerCase().endsWith('.md')) {
          await window.ezvibes.importMdToVault(this.folderPath, p);
        }
      }
      this.refresh();
    };
    this.el.addEventListener('dragover', onDragOver);
    this.el.addEventListener('dragleave', onDragLeave);
    this.el.addEventListener('drop', onDrop);
    this.cleanups.push(() => {
      this.el.removeEventListener('dragover', onDragOver);
      this.el.removeEventListener('dragleave', onDragLeave);
      this.el.removeEventListener('drop', onDrop);
    });
  }

  attachCardListeners(cardEl, prompt) {
    // Outbound drag - paste into terminal or export
    cardEl.setAttribute('draggable', 'true');
    cardEl.addEventListener('dragstart', (e) => {
      // 1. Internal drop into terminal pocket
      e.dataTransfer.setData('application/x-vault-prompt', JSON.stringify({
        path: prompt.absolutePath, name: prompt.name,
      }));
      // 2. Fallback: dragging to Notepad or any text app drops the path
      e.dataTransfer.setData('text/plain', prompt.absolutePath);
      e.dataTransfer.effectAllowed = 'copyLink';

      // Custom canvas ghost
      const ghost = this.buildGhostCanvas(prompt);
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 14, 28);
      setTimeout(() => ghost.remove(), 0);

      cardEl.classList.add('is-dragging');
    });
    cardEl.addEventListener('dragend', () => cardEl.classList.remove('is-dragging'));

    // Double-click = paste immediately
    cardEl.addEventListener('dblclick', () => this.pasteToTerminal(prompt));
  }

  buildGhostCanvas(prompt) {
    const c = document.createElement('canvas');
    c.width = 280; c.height = 56;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(20,22,27,0.92)'; ctx.fillRect(0,0,280,56);
    ctx.strokeStyle = '#f5a524'; ctx.lineWidth = 1.5; ctx.strokeRect(0,0,280,56);
    ctx.fillStyle = '#fff'; ctx.font = '600 13px Inter';
    ctx.fillText(prompt.name.slice(0,32), 16, 24);
    ctx.fillStyle = '#888'; ctx.font = '500 11px Inter';
    ctx.fillText(prompt.preview.slice(0,40), 16, 44);
    ctx.fillStyle = '#f5a524'; ctx.font = '700 11px monospace';
    ctx.fillText('.md', 248, 44);
    c.style.position = 'absolute'; c.style.top = '-9999px';
    return c;
  }

  async pasteToTerminal(prompt) {
    const content = await window.ezvibes.readVaultFile(prompt.absolutePath);
    window.ezvibes.writeTerminal(this.terminal.sessionId, content);
  }
}

// terminal pocket drop handling — wire in renderer/app.js where terminal-pocket is created
function wireTerminalPocketAsDropTarget(pocketEl, sessionId) {
  pocketEl.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('application/x-vault-prompt')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    pocketEl.classList.add('is-drop-target');
  });
  pocketEl.addEventListener('dragleave', () => pocketEl.classList.remove('is-drop-target'));
  pocketEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    pocketEl.classList.remove('is-drop-target');
    const data = e.dataTransfer.getData('application/x-vault-prompt');
    if (!data) return;
    const { path } = JSON.parse(data);
    const content = await window.ezvibes.readVaultFile(path);
    // Bonus: with Alt held = wrap in `cat <<'EOF'` heredoc
    const final = e.altKey
      ? `cat <<'EOF'\n${content}\nEOF\n`
      : content;
    window.ezvibes.writeTerminal(sessionId, final);
    // Drop-success animation
    pocketEl.classList.add('drop-flash');
    setTimeout(() => pocketEl.classList.remove('drop-flash'), 280);
  });
}
```

### 7.4 Pioneer-level details to layer in

1. **Proximity-glow on the terminal pocket** while dragging (§4.3 Pattern 3). Drop intensity is a CSS var driven by distance from cursor.
2. **Drag-out to Notepad** works for free because we set `text/plain` data — but enhance by also setting `text/markdown` and `text/uri-list` so the receiving app picks the best representation.
3. **Custom MIME `application/x-vault-prompt`** scopes the terminal-pocket drop to vault items only. Random files don't paste; they ignore.
4. **Modifier-key power**: Alt = paste-as-heredoc, Shift = paste with filename header (`### prompt: hand-off-2.md`), Ctrl = paste path only (no content). Documented in a small `?` tooltip on the vault title.
5. **Hand-off pulse**: file watcher in main.js fires `vault:file-added`. Renderer adds `.is-fresh` class for 30s. CSS animates a one-shot golden ring around the card. **This is what makes "another session saved into your vault" feel magical instead of silent.**
6. **Drag-to-tag** (§5) — tag chips at the panel top, drop a prompt on them to apply.
7. **Drop-zone "release to" hint tooltip** (§4.6) — appears 200 ms after entering the terminal pocket if user hasn't dropped yet.
8. **Genie-style return on cancel**: if the user drags but releases over nothing, animate the floating ghost back to its origin slot using FLIP technique. (Match the existing folder-Genie aesthetic in EZvibes — this would feel like a real continuation of the project's visual language.)

---

## 8. Code snippets cheat sheet (vanilla, all real)

### Full pointer-event drag with capture (no library)

```js
function makeDraggable(el, { onMove, onDrop }) {
  el.style.touchAction = 'none';
  el.style.userSelect = 'none';
  let active = null;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    active = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-pressing');
    const startX = e.clientX, startY = e.clientY;
    const rect = el.getBoundingClientRect();

    function move(ev) {
      if (ev.pointerId !== active) return;
      onMove?.({ dx: ev.clientX - startX, dy: ev.clientY - startY, rect, ev });
    }
    function up(ev) {
      if (ev.pointerId !== active) return;
      el.releasePointerCapture(ev.pointerId);
      el.classList.remove('is-pressing');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      active = null;
      onDrop?.({ ev });
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}
```

### Closest-edge insertion line (drop target side)

```js
function attachClosestEdgeBehavior(cardEl, dropFn) {
  cardEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-vault-prompt')) return;
    e.preventDefault();
    const r = cardEl.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    cardEl.dataset.insert = (e.clientY < mid) ? 'before' : 'after';
  });
  cardEl.addEventListener('dragleave', () => { delete cardEl.dataset.insert; });
  cardEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const where = cardEl.dataset.insert;
    delete cardEl.dataset.insert;
    dropFn({ event: e, where, target: cardEl });
  });
}
```

```css
.prompt-card[data-insert="before"]::before,
.prompt-card[data-insert="after"]::after {
  content: '';
  position: absolute; left: 8px; right: 8px; height: 2px;
  background: #f5a524;
  box-shadow: 0 0 12px rgba(245,165,36,0.6);
  border-radius: 1px;
  pointer-events: none;
}
.prompt-card[data-insert="before"]::before { top: -1px; }
.prompt-card[data-insert="after"]::after   { bottom: -1px; }
```

### Custom MIME types for surgical drop routing

```js
e.dataTransfer.setData('application/x-vault-prompt', JSON.stringify(payload));
e.dataTransfer.setData('text/plain', payload.absolutePath); // fallback for external apps
e.dataTransfer.setData('text/markdown', payload.content);   // rich consumers can read it
e.dataTransfer.setData('text/uri-list', 'file://' + payload.absolutePath);
```

### Detecting "dragging over me FROM outside the app"

```js
// e.dataTransfer.types contains "Files" when an OS file is being dragged
el.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    el.dataset.dropMode = 'external-file';
  } else if (e.dataTransfer.types.includes('application/x-vault-prompt')) {
    e.preventDefault();
    el.dataset.dropMode = 'internal-prompt';
  }
});
```

Different `data-drop-mode` values can paint different drop indicators (e.g. blue for external, amber for internal).

---

## 9. Performance notes (2026)

- **`requestAnimationFrame` your pointermove updates.** Don't restyle in the raw event — schedule one frame and consolidate.
- **`will-change: transform` on the floating ghost** — promotes to GPU layer, kills jank.
- **`contain: layout style paint` on the vault list** — confines repaints during drag.
- **Pragmatic-DnD's monitor isolates rerenders** — only registered drop targets get notified, not the whole tree. dnd-kit's older versions evaluated every droppable on every pointermove, causing 1000+ item lists to drop frames; PDND's hitbox model is constant-time per drop target.
- **CSS transforms over top/left**: animating `transform: translate3d()` is GPU-accelerated and never causes layout reflow. CSS `top`/`left` causes layout every frame — 40 % frame-time penalty on large lists.
- **Memoize centroid calculations** for the closest-element algorithm. Recompute only on `dragstart`, not every `dragover`.

---

## 10. Accessibility (don't skip)

- **Keyboard alternative**: every drag should also be doable with `Tab` to focus, `Space` to pick up, `Arrow` keys to move, `Space` again to drop, `Esc` to cancel. This is dnd-kit's built-in pattern; SortableJS has no built-in keyboard support so you'd have to layer it.
- **ARIA live region**: announce "prompt hand-off-2.md picked up", "moved to position 3", "dropped on terminal". One `<div aria-live="polite">` updated on each event.
- **`role="listbox"` + `role="option"`** for the vault list; `aria-selected`, `aria-grabbed` (deprecated but still supported by screen readers).
- **Cursor hierarchy**: `cursor: grab` on idle, `cursor: grabbing` during press. Custom cursors lose screen-reader users — stick to platform defaults.
- **Touch-target size**: vault items should be at least 44 px tall on touch (per Apple HIG). Drag handle should be at least 24 × 24 px.

---

## 11. References

### Libraries
- [dnd-kit](https://github.com/clauderic/dnd-kit) - The modern toolkit for building drag and drop interfaces
- [dnd-kit homepage](https://dndkit.com/) - Docs, plugin docs (Feedback plugin)
- [Pragmatic drag and drop on GitHub](https://github.com/atlassian/pragmatic-drag-and-drop)
- [Pragmatic drag and drop docs - Atlassian Design](https://atlassian.design/components/pragmatic-drag-and-drop/)
- [External adapter docs](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/adapters/external/)
- [SortableJS](https://github.com/SortableJS/Sortable)
- [interact.js](https://interactjs.io/)
- [Motion (Framer Motion) - React drag docs](https://motion.dev/docs/react-drag)
- [Motion Reorder component](https://motion.dev/docs/react-reorder)

### Library comparisons
- [Top 5 Drag-and-Drop Libraries for React in 2026 - Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- [dnd-kit vs react-beautiful-dnd vs Pragmatic DnD 2026 - PkgPulse](https://www.pkgpulse.com/blog/dnd-kit-vs-react-beautiful-dnd-vs-pragmatic-drag-drop-2026)
- [Top Front-End Drag-and-Drop JS Libraries 2025 - Kelen](https://en.kelen.cc/share/frontend-drag-and-drop-libraries-2025)

### Native APIs
- [HTML Drag and Drop API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [File drag and drop tutorial - MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop)
- [DataTransfer.setDragImage() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/setDragImage)
- [Pointer Events - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [Element.setPointerCapture() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- [Pointer Events 3 spec (CR 2025)](https://www.w3.org/TR/2025/CR-pointerevents3-20251106/)
- [touch-action CSS property - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)

### Electron file drops
- [Native File Drag & Drop - Electron docs](https://www.electronjs.org/docs/latest/tutorial/native-file-drag-drop)
- [Electron drag and drop file selection (Apr 2025)](https://jiaopucun.com/2025/04/04/drag-drop-files-electron-file-paths/)
- [Issue #44600 - webUtils.getPathForFile breakage](https://github.com/electron/electron/issues/44600)

### Visual feedback / UX
- [Drag-and-Drop: How to Design for Ease of Use - NN/Group](https://www.nngroup.com/articles/drag-drop/)
- [15 Drag and Drop UI Design Tips - Bricx Labs 2026](https://bricxlabs.com/blogs/drag-and-drop-ui)
- [Drag and drop UI examples - Eleken](https://www.eleken.co/blog-posts/drag-and-drop-ui)
- [Visual cues for drag-and-drop - UX Movement](https://uxmovement.com/buttons/visual-cues-to-help-users-perceive-drag-and-drop/)
- [Drag-and-Drop UX Guidelines - Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/)
- [Drag To Tag pattern - Koos Looijesteijn](https://www.kooslooijesteijn.net/blog/drag-to-tag)

### Implementation deep-dives
- [Implement Pragmatic drag and drop - LogRocket](https://blog.logrocket.com/implement-pragmatic-drag-drop-library-guide/)
- [Drag reordering algorithm - Julik Tarkhanov](https://blog.julik.nl/2022/10/drag-reordering)
- [Custom drag ghost in React - Medium](https://medium.com/@shojib116/custom-drag-ghost-in-react-the-way-that-actually-works-c802e4ec7128)
- [Complete Guide to Pointer Events 2025 - Carlos Rojas](https://stories.carlosrojas.dev/2025/10/13/the-complete-guide-to-pointer-events/)
- [Smooth Drag Interactions with Pointer Events - dev.to](https://dev.to/nishinoshake/smooth-drag-interactions-with-pointer-events-5e2j)
- [Drag with setPointerCapture - r0b blog](https://blog.r0b.io/post/creating-drag-interactions-with-set-pointer-capture-in-java-script/)

### Real apps
- [Linear changelog: Improved Drag & Drop](https://linear.app/changelog/2023-04-27-improved-drag-and-drop)
- [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Obsidian drag and drop docs](https://obsidian.md/help/drag-and-drop)
- [Notion drag-and-drop reordering guide](https://ones.com/blog/master-notion-block-drag-drop-reordering/)
- [Designed for delight - Pragmatic DnD - Atlassian](https://www.atlassian.com/blog/design/designed-for-delight-built-for-performance)
- [Awwwards: drag & gesture interactions](https://www.awwwards.com/click-and-hold-drag-and-gesture-interactions-in-web-design.html)

### Inspiration
- [React Flow drag-and-drop example](https://reactflow.dev/examples/interaction/drag-and-drop) - sidebar-to-canvas pattern
- [Glassmorphism in 2025 UI design - atvoid](https://www.atvoid.com/blog/what-is-glassmorphism-the-transparent-trend-defining-2025-ui-design)
- [Setting a custom ghost image - kryogenix](https://www.kryogenix.org/code/browser/custom-drag-image.html)
