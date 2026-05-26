# Research Description 16 — Radial / Pie Menus & Innovative Context Menus for the Prompt Vault (2025–2026)

**Research agent 16 of 30.** Focus: radial / pie menus, gesture-driven context menus, and modern context-menu reimaginings — applied to the EZvibes "prompt vault" feature where a right-click on a prompt opens a circular menu with [Paste / Copy / Pin / Edit / Tag / Delete] etc.

This document is a deep, opinionated dump intended to be read while designing the actual implementation. It includes 2026 production examples, code-level math, vanilla-JS / SVG / CSS implementation patterns, library survey, animation recipes, accessibility notes, and a set of "pioneer-level" design ideas tailored to a terminal-adjacent prompt vault inside an Electron app.

---

## Table of Contents

1. The case for radial menus (Hopkins / Kurtenbach / Buxton, and why it matters in 2026)
2. Modern 2025–2026 real-world examples
3. The math: polar coordinates, atan2 hit-testing, SVG arc segments
4. Implementation patterns (vanilla JS / SVG / CSS, no React)
5. Library survey (vanilla, React, native CSS)
6. Animations: scale-in from cursor, segment highlight, segment fly-out, spring physics
7. Gesture-driven context menus & marking menus
8. "Pioneer-level" design ideas for the EZvibes prompt vault
9. Accessibility & keyboard navigation
10. Recommended stack & next steps
11. References

---

## 1. The case for radial menus

### Historical foundation (re-read this in 2026, it's the same)

Pie menus were invented by **Don Hopkins in 1986**. The 1988 ACM CHI paper by **Hopkins, Callahan, and Weiser** showed that pie menus were **~15 % faster than linear menus** with **lower error rates**, because:

- Selection depends on **direction**, not distance — every wedge is equidistant from the cursor's start, so Fitts's law gives all targets the same "amplitude" component.
- Targets are large (a wedge widens as it extends outward).
- Direction is **symbolic** (NE, S, W, etc.), and the body remembers direction far better than positions on a list.

**Gordon Kurtenbach & Bill Buxton** later formalized **marking menus**: a radial menu that auto-pops-up on novice press-and-hold, but a quick "stroke" in the same direction with no menu shown invokes the same command (the **mark-ahead** behavior). They measured **3.5× faster** selection in expert "mark" mode vs. menu-displayed mode.

Three design principles from Kurtenbach to internalize before writing a single line of code for the vault:

1. **Self-revelation** — the menu shows itself when the user pauses, advertising what's available.
2. **Guidance** — the menu visually leads the user through the radial direction.
3. **Rehearsal** — the act of selecting from the visible menu *is the same gesture* as the expert mark. Practice automatically becomes muscle memory.

For a prompt vault inside a busy terminal session, this is gold: a novice right-clicks a prompt, waits 200 ms, sees [Paste / Copy / Pin / Edit / Tag / Delete] fly out around the cursor; an expert right-clicks + flicks NE for "paste" without the menu ever drawing on screen. Same gesture, two skill levels, zero relearning.

### Why this matters again in 2026

Multiple converging trends:

- **Calm design**: Linear, Notion, Arc, Warp, Raycast all converged on dark-first, low-chrome interfaces. A radial menu *is* low-chrome — it only appears at the cursor when invoked and disappears immediately.
- **Spatial memory > verbal memory** for repeated actions. Raycast / Spotlight / Cmd-K palettes require typing; a vault used dozens of times per session benefits from gesture.
- **Native CSS `popover` + anchor positioning + trigonometric functions** (`sin()`/`cos()` in `calc()`) shipped widely, letting you build radial menus with **almost no JavaScript**.
- **GPU-accelerated transform animations** are now table stakes — spring physics on `transform` is buttery on every modern Electron build.
- **Productivity launchers** like Radial (macOS), Pie Menu (macOS), AutoHotPie (Windows), reWASD 7.0 (gaming) have made radial menus mainstream again, not just a sculptor / Maya artist trick.

---

## 2. Modern 2025–2026 real-world examples

A taxonomy of where radial / pie menus and innovative context menus are actually shipping right now. Steal liberally.

### Creative apps (the lineage)

- **Krita** — Multiple community Pie Menu plugins ([viksl/kritapluginpiemenu](https://github.com/viksl/kritapluginpiemenu), [SirPigeonz/krita-pie-menu](https://github.com/SirPigeonz/krita-pie-menu), and the more elaborate **Shortcut Composer 1.4.2**). Custom radial menus for brush presets and tool toggling, opened by a key chord. Excellent reference for "circle of N tools, click or release-on to select."
- **Blender** — Ships the **3D Viewport Pie Menus** add-on (Viewport Pie Menus extension). Press a hotkey, get an eight-direction pie of editing modes. Famously, the move/rotate/scale pie is muscle memory for many 3D artists.
- **Maya** — The **Hotbox + marking menus** invented by Kurtenbach are still the gold standard. Each mouse button × screen quadrant (N/S/E/W) maps to a different pie. Custom marking menus via Hotbox Designer or Maya Quick Menus.
- **ZBrush** — Custom radial menus via ZSwitcher and similar plugins; ZBrush 2024+ also has built-in radial "Quick Pick" menus.
- **Adobe Photoshop** — *Not yet* a true radial menu (open community feature request: [community.adobe.com idea 14256497](https://community.adobe.com/t5/photoshop-ecosystem-ideas/pie-menu-radial-menu-within-photoshop/idi-p/14256497)) but the **Contextual Task Bar** introduced in 2023 and refined through 2025 is a floating, position-pinned, *context-sensitive* mini-bar — a horizontal cousin to a pie menu. Lessons: floating dynamic toolbar that follows selection state is itself a context menu reimagined.
- **Wacom** — On-screen Radial Menu has been a workflow staple for a decade. Customize via Wacom Center → On-screen shortcuts → New Radial menu, assign actions per slice. Open with a tablet button or pen side switch.

### Productivity & launcher apps

- **Radial (macOS)** — [radial.appverge.net](https://radial.appverge.net/). The clearest 2025–2026 productivity radial menu. Context-aware: each app gets its own pie. Supports text snippets, websites, sub-menus, shell scripts, AppleScript. Marketing claim: "few well-built shortcuts in Radial saves most people 15 to 30 minutes a day."
- **Pie Menu (Mac App Store, id 1631568126)** — Different pie for each active app. Open with trackpad gesture / hotkey.
- **Launchy (Mac App Store)** — Combines launcher + radial menu in one.
- **AutoHotPie (Windows, open source)** — [github.com/dumbeau/AutoHotPie](https://github.com/dumbeau/AutoHotPie). **Electron + AutoHotKey.** *This is directly relevant to EZvibes* — it's literally a JavaScript/Electron radial menu for Windows. Read its source.
- **macOS RadialMenu by roc7890** — Open-source, [github.com/roc7890/RadialMenu](https://github.com/roc7890/RadialMenu). Sets up per-app circular shortcut menus.
- **Microsoft Surface Dial** — Hardware radial. Press-and-hold reveals on-screen radial menu of context-aware tools. Adopted in Photoshop, Sketchable, Bluebeam Revu. Pattern: secondary-input + on-screen radial.
- **PowerToys Command Palette Dock** (added in PowerToys 0.98, 2026) — Edge-pinned dock with mini-tools and integrations, command palette evolves into something more like a contextual mini-palette.

### Gaming

- **The Witcher 3** — Tab opens a paused/slow-mo radial for potions / bombs / signs / quick items. Mods (Nexus mods 1221, 11790, 8237, 730, 1537) added more slots and faster interaction. Pattern: time-dilation while radial is open.
- **Skyrim** — Favorites menu via D-pad / Q radial. Pattern: large flat list collapsed into a circle.
- **Cyberpunk 2077** — Hold Tab opens scanner + radial gadget menu.
- **reWASD 7.0** — [help.rewasd.com/mapping-features/radial-menu.html](https://help.rewasd.com/mapping-features/radial-menu.html). **3–16 sectors per main menu, 8 sub-sectors per sector.** Mappable to any keyboard/mouse/gamepad input. Notable for accessibility — adjustable for users with mobility constraints.
- **Spell Wheel VR** — VR title where you draw a wand gesture in a direction and it maps to a spell. Most "magical" presentation of a radial menu in any modern app.

### Editor / IDE context menus

- **VS Code, Cursor, Zed** in 2026 — Still linear context menus, but Zed introduced more contextual *toolbars* (similar to Photoshop's Contextual Task Bar) — small floating UI that appears in the editor with relevant actions.
- **Linear** — Famous "magic hover" effect ([github.com/Beki-D/Magic-Hover](https://github.com/Beki-D/Magic-Hover)). Right-click context menu has soft easing, slight blur background, microscopic motion when items animate in. Asymmetric in/out timing.
- **Notion** — Slash menu (`/`) is *the* command palette pattern. Combined with hover-revealed drag handles (the `⋮⋮` icon). Right-click on any block opens a contextual action menu that adapts to block type.
- **Arc browser** — Cmd-T command bar (now in maintenance, but its lineage continued in Dia). Notable for being floating, glassy, and context-aware (knows what page you're on).

### Mobile / touch

- **Procreate / Affinity Designer 2** — Two-finger / three-finger gestures invoke undo/redo. Affinity has a Contextual Menu that adapts to the active tool. Long-press on iPad brings up small floating action menus.
- **Wavelet menus** ([Inria hal-00953319](https://inria.hal.science/hal-00953319)) — Research-grade. Concentric hierarchical marking menus optimized for small handheld screens. The deeper sub-menu is always centered.

---

## 3. The math

This section is the single most useful part of the document for the EZvibes implementation. Bookmark it.

### 3.1 Polar ↔ Cartesian

Given a center `(cx, cy)` and a radius `r`:

```
x = cx + r * cos(θ)
y = cy + r * sin(θ)
```

Where θ is in **radians**. To convert from degrees: `θ = degrees * Math.PI / 180`.

In SVG and CSS, the **Y axis is inverted** (positive Y goes down). This means:

- **0 rad / 0°** = pointing right (east).
- **π/2 rad / 90°** = pointing **down** (south), not up.
- **−π/2 rad / −90°** = pointing **up** (north).

If you want compass-style "north = top," pre-rotate by `-Math.PI / 2`.

### 3.2 Distributing N items evenly around a circle

```javascript
const N = 6;                          // number of slices
const sliceAngle = (Math.PI * 2) / N; // angle per slice, radians

for (let i = 0; i < N; i++) {
  // center of slice i, starting from "12 o'clock"
  const angle = i * sliceAngle - Math.PI / 2;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  // place item at (x, y)
}
```

For our vault [Paste / Copy / Pin / Edit / Tag / Delete] (6 items), `sliceAngle = 60°`. Each slice covers 60° wide. Eight is the empirical "sweet spot" (Kurtenbach & Buxton), but 4, 6, 8, 12 all work. Six fits exactly the action set above.

### 3.3 atan2 hit-testing (the only hit test you ever need)

When the user moves the mouse around the radial menu, compute the angle from the menu center to the mouse pointer:

```javascript
function hitSlice(mouseX, mouseY, cx, cy, sliceCount) {
  const dx = mouseX - cx;
  const dy = mouseY - cy;
  // atan2 returns [-π, π]; we want [0, 2π) starting at "12 o'clock"
  let theta = Math.atan2(dy, dx);            // -π .. π
  theta += Math.PI / 2;                       // rotate so 0 = up (north)
  if (theta < 0) theta += Math.PI * 2;        // wrap into [0, 2π)
  const sliceAngle = (Math.PI * 2) / sliceCount;
  return Math.floor(theta / sliceAngle);      // slice index 0..N-1
}
```

This is **all the hit testing you need**. It does not depend on radius — any point in the plane belongs to *some* wedge. To require the user to drag *outward* before selecting (the "dead zone" in the middle, à la Maya marking menus), gate the selection on `Math.hypot(dx, dy) > deadZoneRadius`. The dead zone also lets the user cancel by releasing inside it.

### 3.4 SVG arc segments

For visually drawing each wedge as an SVG path (so you can fill, hover-highlight, etc.), use the elliptical arc command:

```
M cx,cy
L x1,y1
A r,r 0 largeArc,1 x2,y2
Z
```

Where:
- `M cx,cy` — move pen to the menu center.
- `L x1,y1` — draw a straight line to the start of the wedge (on the circumference).
- `A r,r 0 largeArc,1 x2,y2` — arc to the end of the wedge.
  - `r,r` = both radii (for circles).
  - `0` = x-axis rotation (irrelevant for circles).
  - `largeArc` = `1` if the slice covers more than 180°, else `0`.
  - `1` = sweep flag (1 = clockwise in SVG's flipped Y system).
- `Z` — close back to the center.

A `wedgePath()` function:

```javascript
function wedgePath(cx, cy, rInner, rOuter, startAngle, endAngle) {
  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

  const xs1 = cx + rOuter * Math.cos(startAngle);
  const ys1 = cy + rOuter * Math.sin(startAngle);
  const xe1 = cx + rOuter * Math.cos(endAngle);
  const ye1 = cy + rOuter * Math.sin(endAngle);

  const xs2 = cx + rInner * Math.cos(startAngle);
  const ys2 = cy + rInner * Math.sin(startAngle);
  const xe2 = cx + rInner * Math.cos(endAngle);
  const ye2 = cy + rInner * Math.sin(endAngle);

  // donut wedge: outer arc CCW, inner arc CW
  return [
    `M ${xs2} ${ys2}`,             // start at inner-start
    `L ${xs1} ${ys1}`,             // line out to outer-start
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${xe1} ${ye1}`, // outer arc
    `L ${xe2} ${ye2}`,             // line in to inner-end
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xs2} ${ys2}`, // inner arc reversed
    'Z'
  ].join(' ');
}
```

The **inner radius hole** (`rInner > 0`) gives a donut shape — practically essential, because:

1. It gives the central "release here to cancel" dead zone.
2. It lets you put a label / icon for the *selected* prompt in the middle.
3. It looks intentional rather than dart-board-y.

### 3.5 Pure-CSS no-JS positioning (the 2024+ trick)

CSS now ships `sin()`, `cos()`, and `tan()` inside `calc()`. Una Kravets demoed a radial menu with zero JS positioning. Each item declares its index:

```html
<ul popover id="vault-actions">
  <li style="--i:0"><button>Paste</button></li>
  <li style="--i:1"><button>Copy</button></li>
  <li style="--i:2"><button>Pin</button></li>
  <li style="--i:3"><button>Edit</button></li>
  <li style="--i:4"><button>Tag</button></li>
  <li style="--i:5"><button>Delete</button></li>
</ul>
<button popovertarget="vault-actions">⋮</button>
```

```css
:root {
  --count: 6;
  --radius: 80px;
}

ul[popover] {
  display: grid;
  place-content: center;
  /* every <li> sits in the same grid cell, stacked over the trigger */
}

ul[popover] li {
  --angle: calc((var(--i) / var(--count)) * 1turn - 0.25turn); /* -90° so item 0 is north */
  grid-area: 1 / 1;
  transform:
    translateX(calc(cos(var(--angle)) * var(--radius)))
    translateY(calc(sin(var(--angle)) * var(--radius)))
    scale(0);
  transition: transform 220ms cubic-bezier(0.25, 1.4, 0.5, 1);
}

ul[popover]:popover-open li {
  transform:
    translateX(calc(cos(var(--angle)) * var(--radius)))
    translateY(calc(sin(var(--angle)) * var(--radius)))
    scale(1);
  transition-delay: calc(var(--i) * 25ms); /* staggered fly-out */
}
```

The Popover API + `anchor()` positioning (anchor positioning isn't universal in Electron 33's Chromium yet, but `Element.showPopover()` is) lets you summon the menu at the trigger's location without writing any layout code.

### 3.6 Combined: SVG wedges + CSS overlay icons

The cleanest implementation for our vault is:

- **SVG layer**: draws the donut wedges, handles hover highlight via `:hover` on each `<path>`.
- **HTML layer overlaid via grid or absolute positioning**: each icon/label is a real `<button>` so it's keyboard-focusable and Tab-cycled. CSS sin/cos positions them in the middle of their slice.

This dual-layer approach is what `react-radial-menu` and `wheelnav` both use internally. SVG for the visual ring, HTML for the focusable controls.

---

## 4. Implementation patterns for the EZvibes prompt vault

EZvibes is **vanilla JS + HTML + CSS, Electron 33, no React, no bundler**. Here's a self-contained pattern that fits the project.

### 4.1 File layout

```
renderer/
  vault/
    radial-menu.js     # the radial UI for prompt actions
    radial-menu.css
    vault.js           # the prompt list + watcher logic (other agents' research)
    vault.css
```

`radial-menu.js` exports a single `openRadialMenu(opts)` function that the vault calls when the user right-clicks a `.prompt-row`.

### 4.2 Self-contained vanilla module

```javascript
// radial-menu.js
// Open a radial action menu centered at (x, y) with N items.
// Returns a Promise that resolves with the chosen action id or null (cancelled).

export function openRadialMenu({ x, y, items, deadZone = 28, radius = 84 }) {
  return new Promise((resolve) => {
    const N = items.length;
    const sliceAngle = (Math.PI * 2) / N;

    // 1. Build the SVG
    const overlay = document.createElement('div');
    overlay.className = 'radial-overlay';
    overlay.innerHTML = `
      <svg class="radial-svg" viewBox="-100 -100 200 200" width="200" height="200"
           style="position:fixed; left:${x - 100}px; top:${y - 100}px; pointer-events:none;">
        <g class="wedges"></g>
        <circle class="hub" r="${deadZone}" />
        <text class="label" text-anchor="middle" dy=".35em"></text>
      </svg>`;
    document.body.appendChild(overlay);

    const wedgeGroup = overlay.querySelector('.wedges');
    const labelEl = overlay.querySelector('.label');

    const wedgePaths = items.map((item, i) => {
      const a0 = i * sliceAngle - Math.PI / 2 - sliceAngle / 2;
      const a1 = a0 + sliceAngle;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', wedgePath(0, 0, deadZone, radius, a0, a1));
      path.setAttribute('class', 'wedge');
      path.style.pointerEvents = 'auto';
      path.dataset.index = i;
      wedgeGroup.appendChild(path);

      // place icon at mid-slice
      const midAngle = (a0 + a1) / 2;
      const ix = (deadZone + radius) / 2 * Math.cos(midAngle);
      const iy = (deadZone + radius) / 2 * Math.sin(midAngle);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', ix);
      text.setAttribute('y', iy);
      text.setAttribute('class', 'wedge-label');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '0.35em');
      text.textContent = item.label;
      wedgeGroup.appendChild(text);

      return path;
    });

    // 2. Hover tracking via global mousemove (faster than per-wedge listeners
    //    and matches the gesture/marking-menu model — the user just flicks).
    let activeIdx = -1;
    function onMove(e) {
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const dist = Math.hypot(dx, dy);
      if (dist < deadZone) {
        if (activeIdx !== -1) clearActive();
        labelEl.textContent = '';
        return;
      }
      let theta = Math.atan2(dy, dx) + Math.PI / 2;
      if (theta < 0) theta += Math.PI * 2;
      const idx = Math.floor(theta / sliceAngle);
      if (idx !== activeIdx) {
        if (activeIdx !== -1) wedgePaths[activeIdx].classList.remove('active');
        wedgePaths[idx].classList.add('active');
        labelEl.textContent = items[idx].label;
        activeIdx = idx;
      }
    }

    function clearActive() {
      if (activeIdx !== -1) wedgePaths[activeIdx].classList.remove('active');
      activeIdx = -1;
    }

    // 3. Commit on mouseup / cancel on Esc or click outside
    function onUp(e) {
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const dist = Math.hypot(dx, dy);
      cleanup();
      if (dist >= deadZone && activeIdx !== -1) {
        resolve(items[activeIdx].id);
      } else {
        resolve(null);
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keydown', onKey);
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 150);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keydown', onKey);

    // Trigger the open animation on next frame
    requestAnimationFrame(() => overlay.classList.add('open'));
  });
}

function wedgePath(cx, cy, rInner, rOuter, startAngle, endAngle) {
  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
  const sx1 = cx + rOuter * Math.cos(startAngle);
  const sy1 = cy + rOuter * Math.sin(startAngle);
  const ex1 = cx + rOuter * Math.cos(endAngle);
  const ey1 = cy + rOuter * Math.sin(endAngle);
  const sx2 = cx + rInner * Math.cos(startAngle);
  const sy2 = cy + rInner * Math.sin(startAngle);
  const ex2 = cx + rInner * Math.cos(endAngle);
  const ey2 = cy + rInner * Math.sin(endAngle);
  return `M ${sx2} ${sy2} L ${sx1} ${sy1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${ex1} ${ey1} L ${ex2} ${ey2} A ${rInner} ${rInner} 0 ${largeArc} 0 ${sx2} ${sy2} Z`;
}
```

Then in the vault:

```javascript
import { openRadialMenu } from './radial-menu.js';

promptRow.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  const choice = await openRadialMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      { id: 'paste',  label: 'Paste' },
      { id: 'copy',   label: 'Copy' },
      { id: 'pin',    label: 'Pin' },
      { id: 'edit',   label: 'Edit' },
      { id: 'tag',    label: 'Tag' },
      { id: 'delete', label: 'Delete' },
    ],
  });
  if (choice === 'paste') pastePromptIntoActiveTab(promptRow.dataset.path);
  if (choice === 'copy')  copyPromptToClipboard(promptRow.dataset.path);
  // ...
});
```

### 4.3 CSS for it

```css
.radial-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

.radial-overlay .radial-svg {
  pointer-events: auto;
  transform-origin: 100px 100px;
  transform: scale(0.7);
  opacity: 0;
  transition: transform 180ms cubic-bezier(0.22, 1.4, 0.36, 1), opacity 120ms ease;
}

.radial-overlay.open .radial-svg {
  transform: scale(1);
  opacity: 1;
}

.radial-overlay.closing .radial-svg {
  transform: scale(0.9);
  opacity: 0;
  transition: transform 100ms ease-in, opacity 100ms ease-in;
}

.wedge {
  fill: rgba(40, 40, 50, 0.85);
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 1;
  transition: fill 120ms ease, transform 200ms cubic-bezier(0.22, 1.4, 0.36, 1);
  transform-origin: 100px 100px;  /* SVG transform-origin = viewBox center */
  backdrop-filter: blur(8px);     /* glassy */
}

.wedge.active {
  fill: rgba(255, 168, 64, 0.95); /* EZvibes's amber */
  transform: scale(1.05);
}

.wedge-label {
  fill: #f0f0f0;
  font: 600 11px ui-sans-serif, system-ui;
  pointer-events: none;
}

.hub {
  fill: rgba(20, 20, 28, 0.95);
  stroke: rgba(255, 255, 255, 0.12);
}

.label {
  font: 600 13px ui-sans-serif, system-ui;
  fill: #f0f0f0;
  pointer-events: none;
}
```

The result: a glassy donut appears at the cursor, segments highlight as the user moves outward, the center label tells them what they'd select on release. Release fires the action. Tiny dead zone (28 px) prevents accidental selection.

### 4.4 Reusing it for the *vault button itself*

The user's Paint mockup shows a vault button that *opens* the vault. You can use the **same primitive** to open the vault: right-click the vault button → radial menu of recent prompt categories (e.g., [Recent / Hand-offs / Pinned / Tagged "react" / Tagged "debug" / New…]). Same animation, same code, different items. Nested menus simply re-open at the same point with new items.

---

## 5. Library survey

If you don't want to write it yourself.

### Vanilla / web

- **[axln/radial-menu-js](https://github.com/axln/radial-menu-js)** — Pure JS+HTML+SVG, nested submenus, keyboard nav (arrows, Enter, Esc/Backspace). Constructor takes parent element, size, item array, click handler. Live demo: axln.github.io/radial-menu-js/.
- **[victorqribeiro/radialMenu](https://github.com/victorqribeiro/radialMenu)** — 405★, MIT. Highly customizable: `innerCircle`, `outerCircle`, `rotation`, `buttonGap`, gradient fills, Font Awesome icon support via Unicode. Methods: `show()`, `hide()`, `setPos(x,y)`, `addButtons(arr)`.
- **[softwaretailoring/wheelnav](https://github.com/softwaretailoring/wheelnav)** — SVG-based, Raphaël.js dependent, very feature-rich (animated transitions between menus, multiple visual styles: pie, donut, marker, basicpie, etc.). Long-standing library.
- **[peachananr/wheel-menu](https://github.com/peachananr/wheel-menu)** — jQuery, Path-like.
- **[itsyub/wheelmenu](https://github.com/itsyub/wheelmenu)** — CSS3-based, almost no JS.
- **[davidvazteixeira/orbit-menu](https://github.com/davidvazteixeira/orbit-menu)** — Lightweight, ESM module, declarative HTML (`data-sector`, `data-rx-offset`, etc.), action callbacks.
- **[gsn1074-svg-examples/svg-radial-menu](https://github.com/gsn1074-svg-examples/svg-radial-menu)** — Showcase of GSAP + jQuery + SVG.
- **[robennett2/RadialMenu](https://github.com/robennett2/RadialMenu)** — Plain JS open source.
- **[SpeciesFileGroup/svg_radial_menu](https://github.com/SpeciesFileGroup/svg_radial_menu)** — Generic SVG radial.

### React (not what we'll use, but useful reference for animation patterns)

- **[spaceymonk/react-radial-menu](https://github.com/spaceymonk/react-radial-menu)** — Submenu support, animations (`fade`, `scale`, `rotate`), dark mode via CSS vars. Components: `<Menu>`, `<MenuItem>`, `<SubMenu>`.
- **[modelab/react-radial](https://github.com/modelab/react-radial)** — SVG, can port into a div, canvas, or WebGL scene.
- **[psychobolt/react-pie-menu](https://github.com/psychobolt/react-pie-menu)** — Configurable.
- **[Antho2407/react-radial-menu](https://github.com/Antho2407/react-radial-menu)** — Older.

### Native / cross-platform

- **[dumbeau/AutoHotPie](https://github.com/dumbeau/AutoHotPie)** — *Electron + AutoHotKey* radial for Windows. Highly relevant because we're also Electron + Windows. Worth reading the source as an architectural reference.
- **[Himanshu-Singh-Chauhan/Pie-Menus](https://github.com/Himanshu-Singh-Chauhan/Pie-Menus)** — Windows pie menus à la Blender.
- **[roc7890/RadialMenu](https://github.com/roc7890/RadialMenu)** — macOS Swift radial menu launcher.
- **[ricky-yosh/RadialMenu](https://github.com/ricky-yosh/RadialMenu)** — macOS quick app-switching radial.
- **[payne911/PieMenu](https://github.com/payne911/PieMenu)** — libGDX, for game UIs.

For EZvibes, do **not** install React just for this. Build it as vanilla JS + SVG using the pattern in section 4. The libraries above are reference-only — none ship Windows-Electron-vanilla-JS specifically.

---

## 6. Animations: scale-in, segment highlight, fly-out, spring

### 6.1 Scale-in from cursor (the canonical opening)

When the radial menu appears, scale it from `0.7 → 1.0` with a slight overshoot (`cubic-bezier(0.22, 1.4, 0.36, 1)` is a good "back-out" ease). Opacity from `0 → 1` is faster (`120 ms`) than the transform (`180 ms`) so the menu *feels* present before it's fully expanded. The transform origin must be set to the menu's center.

For Electron 33 / Chromium, `transform: scale()` + `opacity` are compositor-only, so 60 fps is guaranteed even on the integrated GPU.

### 6.2 Staggered fly-out (items radiate outward)

Each item gets a `transition-delay: calc(var(--i) * 25ms)`. The result: items radiate outward like a peacock fan. Use sparingly — total open time should stay under ~250 ms so it feels instant.

### 6.3 Segment highlight on hover

CSS:

```css
.wedge {
  transition: fill 100ms ease-out, transform 180ms cubic-bezier(0.22, 1.4, 0.36, 1);
}
.wedge.active {
  fill: var(--EZvibes-amber);
  transform: scale(1.06);
}
```

The slight `scale(1.06)` is the most satisfying touch — the wedge visibly bulges toward the cursor. Combine with a *center label* that swaps to show the currently-hovered action's name, plus a *micro-tooltip* describing what it does. The label change is the "rehearsal" Kurtenbach talks about — the user learns by reading.

### 6.4 Spring physics (Motion / Framer Motion equivalents in vanilla JS)

If you want a real spring without a library, the simplest approach is **Web Animations API + cubic-bezier that mimics a spring**:

```javascript
element.animate(
  [
    { transform: 'scale(0.5)', opacity: 0 },
    { transform: 'scale(1.06)', opacity: 1, offset: 0.7 },
    { transform: 'scale(1)', opacity: 1 }
  ],
  { duration: 280, easing: 'cubic-bezier(0.22, 1.4, 0.36, 1)', fill: 'forwards' }
);
```

For physically accurate spring with damping/stiffness/mass parameters, use **[okikio/spring-easing](https://github.com/okikio/spring-easing)** — works with WAAPI, GSAP, animejs, Motion, etc. ~3 KB.

### 6.5 Pointer rotation cue

When you change selection, a small "pointer" (triangle in the center) can rotate toward the active wedge with spring-easing. Looks magical, costs almost nothing:

```css
.radial-pointer {
  transform: rotate(var(--active-angle, 0deg));
  transition: transform 220ms cubic-bezier(0.22, 1.4, 0.36, 1);
}
```

Update `--active-angle` from JS when active slice changes.

---

## 7. Gesture-driven context menus & marking menus

This is where the "pioneer-level" magic lives.

### 7.1 The marking-menu / mark-ahead mode

Implement two behaviors on the same radial:

1. **Press & wait ≥ 200 ms** — menu fades in normally; user moves to the wedge they want.
2. **Press & flick within < 200 ms** — menu *never appears*; the gesture's terminal angle determines the action.

Pseudocode:

```javascript
const POPUP_DELAY = 200; // ms
let popupTimer = null;
let menuVisible = false;
let startTime = 0;
let startX = 0, startY = 0;

function onPress(e) {
  startTime = performance.now();
  startX = e.clientX;
  startY = e.clientY;
  popupTimer = setTimeout(() => {
    menuVisible = true;
    showRadial(startX, startY);
  }, POPUP_DELAY);
}

function onRelease(e) {
  clearTimeout(popupTimer);
  const elapsed = performance.now() - startTime;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const dist = Math.hypot(dx, dy);

  if (dist >= deadZone) {
    // Same hit-test in either mode — the marking gesture lands on a wedge.
    const idx = hitSliceAtPoint(e.clientX, e.clientY, startX, startY, items.length);
    fire(items[idx].id);
  }
  if (menuVisible) hideRadial();
}
```

This is the **single most important pattern** in the whole research dump. It means an expert user who right-clicks a prompt and flicks NE in 80 ms never even sees a menu — the prompt pastes. A new user who right-clicks and pauses sees the same menu open under their cursor with the same N options in the same N directions. They learn by using.

For your EZvibes vault, this maps to:

- Right-click prompt → flick NE = Paste.
- Right-click prompt → flick E = Copy.
- Right-click prompt → flick SE = Pin.
- Right-click prompt → flick S = Edit.
- Right-click prompt → flick SW = Tag.
- Right-click prompt → flick W = Delete.

After a week, your hands paste-by-flicking faster than you can read the menu.

### 7.2 Direction-as-command (no menu UI at all)

Even more pioneer: a "command stroke" overlay that never draws a pie. The user drags from any prompt:

- Drag **right** → Copy (mirrors "send right" mental model).
- Drag **up** (into the active terminal) → Paste into the open tab.
- Drag **left** off the panel → Delete (off-screen = trash).
- Drag **down** → Pin (collapse-into-bottom shelf).

Adopted by mobile apps (swipe-to-archive, swipe-to-delete) — but underused on desktop. The reason it works: the prompt vault is a vertical list, and the *active terminal* is to the right or above. Dragging *toward* a real screen region maps physically to "send the prompt there." That's pioneer-level UX.

### 7.3 Overshoot, fade-away, undo (patents to mimic)

USPTO 8627233 "Radial menu with overshoot, fade away, and undo" describes:

- **Overshoot**: drag past the wedge → triggers a *secondary* variant of the action (e.g., overshoot "Paste" → "Paste & Enter").
- **Fade-away**: pause inside a wedge for >300 ms → submenu fades in for that wedge.
- **Undo**: drag back to the center within 500 ms after release → undo last action.

USPTO 8468466 "Radial menu selection with gestures" describes overloaded slices: same direction + clockwise rotation = different action than direction + counter-clockwise.

These are patented (so check freedom-to-operate if you ever ship commercially) but the patterns are well-known and several have expired.

### 7.4 Pressure / force-touch variants

Force Touch on macOS trackpads still works — a deeper press into a wedge could trigger a "destructive" variant (e.g., deeper press on Delete = "Delete & don't ask again"). Force Touch isn't on Windows trackpads though, so for EZvibes, treat this as future iPad/Mac territory.

### 7.5 Final Cut Pro / DaVinci Resolve drag-to-zoom pattern

Resolve recognizes right-click-and-drag distinct from right-click, using drag distance/direction for timeline zoom or modulation. Pattern for EZvibes: right-click on a prompt without dragging shows the radial; right-click-and-drag (with no menu shown) directly streams the prompt content into the terminal char-by-char, like typing.

---

## 8. Pioneer-level design ideas for the EZvibes prompt vault

This is the imaginative section: things you could ship that would make EZvibes feel ahead of its time.

### 8.1 "Quick Cast" radial — the headline feature

When the user **right-clicks a prompt in the vault**, the radial menu appears with the prompt's filename in the center hub and 6 actions around it:

```
              [Paste & Send ↵]
                    N
  [Tag]                       [Copy]
   NW                            NE
                  (●)
                  ←
  [Delete]                    [Pin]
   SW                           SE
                    S
                 [Edit]
```

- **Default action under mouse** (the one the user releases over) lights up amber.
- **Mark-ahead** works after ~3 uses; the user starts flicking NE for "Copy" without waiting for the visual.
- **Hub center** shows the prompt name + a 2-line preview of the markdown content as a hover tooltip.
- **Esc** cancels.

### 8.2 "Tag wheel" — secondary radial inside a slice

When the user releases on **Tag**, a *second* radial spawns at the same point with tag chips arrayed around. This is **hierarchical marking menus** (Maya-style). They can flick again to a tag, total of two flicks = "Copy this prompt + tag it 'react'."

Two-flick gesture aliases:
- `flick-NE + flick-N` → Copy + tag "frontend"
- `flick-NE + flick-E` → Copy + tag "backend"
- etc.

### 8.3 Gesture aliases as keyboard shortcuts that don't fight Ctrl+C

EZvibes's terminal already captures Ctrl/Cmd combos. Gestures don't conflict. This is a major win — your radial-menu actions become a *parallel* shortcut system that lives entirely in the GUI layer.

### 8.4 Right-click on the *terminal* opens a "Paste recent prompt" radial

The user right-clicks anywhere inside the terminal tab → radial appears showing the **6 most recently used prompts** as wedges, with prompt filename as label. Pick one, it's pasted. Frequency-based ordering. The vault becomes a low-friction "drop-down at the cursor" wherever you need a prompt. This is the most natural extension of the marking-menu idea to a terminal.

### 8.5 Spring-pointer "compass" in the hub

A tiny arrow in the dead-zone hub rotates in real time toward the mouse direction, spring-eased. Gives instant directional feedback even before the user has moved far enough to commit. Cost: ~3 lines of CSS + a single transform update on mousemove.

### 8.6 "Quick Cast scrub" — preview the paste in-place

While the user hovers over **Paste**, the radial menu becomes semi-transparent and a *preview* of the prompt body scrolls under it inside the radial's footprint. Releasing commits the paste; moving off cancels. Essentially turns the menu into a controlled preview.

### 8.7 Hand-off radial

Imagine a prompt called `hand-off.md` lands in the vault from another session. A small spinning dot appears on the file in the vault. **Right-click it** → radial appears with [Read / Paste & Continue / Mark Resolved / Archive / Tag / Open in Editor]. The radial color shifts to a hand-off-blue palette to signal the file's lineage. Visual identity inside the radial = file metadata.

### 8.8 Color-coded radial palettes per agent

The vault opens different radials depending on which tab is active:

- **Claude tab** active → radial uses amber (EZvibes's Claude color).
- **Codex tab** active → radial uses teal (EZvibes's Codex color).

Action labels also subtly adapt: "Paste & Send" for Claude (since Claude reads markdown well), "Paste as code" for Codex by default (since Codex pastes go inside YOLO context). Same gesture, agent-aware semantics.

### 8.9 "Cast trail" particle effect

When the user flicks a gesture (mark-ahead, no menu shown), draw a fading trail of small dots from cursor start to cursor end colored by the destination wedge. Less than 1 second total. Tells the user "you flicked NE, it became Paste." This is the kind of moment-of-delight detail that lands you "pioneer-level."

### 8.10 Radial + Linear "calm-design" composition

The radial is the gesture invocation; the *resolved details* (long action lists, sub-prompts) cascade out into a small linear panel anchored to the chosen wedge. This is the "calm but powerful" 2026 aesthetic. Use Linear-style asymmetric easing (fast in, slow out), `backdrop-filter: blur(12px)`, soft shadow.

### 8.11 Touchpad two-finger swirl gesture (long shot)

On Windows precision touchpads, two-finger circular motion can be hooked. A circular swirl over a prompt = "Cycle to the next variant of this prompt." Niche but novel.

### 8.12 Voice + radial multi-modal

Hold right-click and *speak* "paste it" → the system flashes the Paste wedge and commits. Two-input redundancy. Niche but trending in 2026 multimodal UI.

### 8.13 The "second-tap" radial discoverability training

First three uses of right-click on a prompt = full menu shown for 1.5 s minimum. Fourth+ = menu shows but begins fading after 600 ms, encouraging mark-ahead. After 20 mark-ahead uses, the menu is reduced to a brief flash. The system *teaches* the user to graduate from novice to expert, gracefully. This is the Kurtenbach "rehearsal" principle implemented as a literal training arc.

---

## 9. Accessibility & keyboard navigation

Radial menus have a reputation for being mouse-only. They don't have to be.

### 9.1 Keyboard equivalents

- **Arrow keys** select neighboring slices (rotate `activeIdx` by ±1 or by ±2 if you treat NE/N/NW etc. specially).
- **Tab** moves through slices in clockwise order, **Shift+Tab** counter-clockwise.
- **Enter / Space** commits the selected slice.
- **Esc** cancels.
- **Number keys 1–9** jump directly to slice N.
- **First-letter shortcut** (like macOS context menus) — pressing "P" jumps to Paste / Pin in sequence.

### 9.2 ARIA model

```html
<div role="menu" aria-label="Prompt actions" aria-orientation="radial">
  <button role="menuitem" aria-label="Paste prompt into terminal">…</button>
  …
</div>
```

`aria-orientation="radial"` isn't formally valid, so use `aria-orientation="horizontal"` or omit it. Each menu item is a real `<button>` so screen readers handle it.

### 9.3 Focus management

When the radial opens, focus moves to the first slice. After commit/cancel, focus returns to the right-clicked element. Standard popover focus trap rules apply (Tab cycles within the menu, Esc returns focus).

### 9.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .radial-svg, .wedge { transition: none !important; }
}
```

Open / close becomes instant; no fly-out stagger; no scale-in. The radial still works — it's just snappy.

### 9.5 Color-contrast & focus rings

WCAG 2.4.13 in WCAG 2.2 requires minimum focus indicator contrast and size. The active wedge should have a visible outline (`outline: 3px solid var(--EZvibes-focus);`) when keyboard-focused, distinct from the hover color.

### 9.6 The visible-fallback principle

From 2026 mobile design trends (Muzli, Mobbin): *any gesture-only interaction needs a visible fallback*. For us, this means a small "⋮" overflow button on each prompt row that opens the same radial. That way users who don't know about right-click still discover the actions.

---

## 10. Recommended stack & next steps for EZvibes

### 10.1 Tech choices, opinionated

- **No library.** Build it as ~250 lines of vanilla JS + SVG + CSS. The pattern in §4.2 is enough. EZvibes is vanilla; keep it vanilla.
- **SVG for visual ring**, HTML buttons for accessibility (dual-layer).
- **`Element.animate` (WAAPI)** for transitions; no GSAP, no Framer, no spring lib unless needed.
- **CSS `popover` API** if Electron 33's Chromium supports it (it does — Chromium 114+). Otherwise plain absolute positioning.
- **`atan2` hit-testing** with a dead-zone radius. Do not do per-wedge `mouseover` listeners.
- **Default 6 slices** to match the action set. Reserve the architecture for 4 / 8 / 12 if you add more actions later.
- **Mark-ahead mode** from day one (§7.1). 200 ms threshold. This is the entire reason to ship a radial vs. a linear context menu.
- **Visible "⋮" fallback button** for accessibility.

### 10.2 Implementation order

1. Build `openRadialMenu({ x, y, items, onChoose })` standalone. Verify it works in isolation in EZvibes.
2. Wire it into the vault row right-click handler.
3. Add hub label that names the hovered action.
4. Add mark-ahead (no UI within 200 ms).
5. Add agent-aware coloring (amber/teal).
6. Add the "cast trail" particle when in mark-ahead mode.
7. Add keyboard navigation + ARIA.
8. Add hierarchical secondary radial for Tag.
9. Add right-click-on-terminal "recent prompts" radial.
10. Add the discoverability training arc (§8.13).

### 10.3 Files to add

```
renderer/
  vault/
    radial-menu.js        # ~250 lines
    radial-menu.css       # ~80 lines
    prompts.js            # vault data layer (other agents handle)
```

Hooked into `renderer/app.js` from the existing context-menu code.

---

## 11. References

### Libraries

- [axln/radial-menu-js](https://github.com/axln/radial-menu-js) — Pure JS+HTML+SVG radial menu
- [victorqribeiro/radialMenu](https://github.com/victorqribeiro/radialMenu) — Highly customizable JS radial (405★)
- [softwaretailoring/wheelnav](https://github.com/softwaretailoring/wheelnav) — SVG/VML, Raphaël-based
- [peachananr/wheel-menu](https://github.com/peachananr/wheel-menu) — jQuery Path-like wheel
- [itsyub/wheelmenu](https://github.com/itsyub/wheelmenu) — CSS3-based
- [davidvazteixeira/orbit-menu](https://github.com/davidvazteixeira) — Declarative ESM module
- [spaceymonk/react-radial-menu](https://github.com/spaceymonk/react-radial-menu) — React with submenus and animations
- [modelab/react-radial](https://github.com/modelab/react-radial) — SVG/React/Resonance
- [psychobolt/react-pie-menu](https://github.com/psychobolt/react-pie-menu) — Configurable React pie
- [dumbeau/AutoHotPie](https://github.com/dumbeau/AutoHotPie) — Electron + AutoHotKey radial for Windows
- [Himanshu-Singh-Chauhan/Pie-Menus](https://github.com/Himanshu-Singh-Chauhan/Pie-Menus) — Windows Blender-style pies
- [roc7890/RadialMenu](https://github.com/roc7890/RadialMenu) — macOS open source
- [SpeciesFileGroup/svg_radial_menu](https://github.com/SpeciesFileGroup/svg_radial_menu) — Generic SVG radial
- [okikio/spring-easing](https://github.com/okikio/spring-easing) — Lightweight spring physics for any animation lib

### Apps & products

- [Radial (macOS)](https://radial.appverge.net/) — Productivity radial launcher
- [Pie Menu (Mac App Store)](https://apps.apple.com/us/app/pie-menu/id1631568126?mt=12)
- [pie-menu.com](https://www.pie-menu.com/) — Per-app radial menus on macOS
- [reWASD radial menu](https://help.rewasd.com/mapping-features/radial-menu.html) — Gaming 3–16 sectors, 8 sub-sectors each
- [Wacom On-screen Radial Menu](https://101.wacom.com/userhelp/en/OSS.htm)
- [Krita Pie Menu plugins](https://krita-artists.org/t/plugin-pie-menu-v0-4/15888)
- [Blender Viewport Pie Menus](https://extensions.blender.org/add-ons/viewport-pie-menus/)
- [Photoshop Contextual Task Bar](https://helpx.adobe.com/photoshop/using/contextual-task-bar.html)
- [Microsoft Surface Dial Walkthrough](https://learn.microsoft.com/en-us/windows/apps/develop/input/radialcontroller-walkthrough)

### Research & history

- [Don Hopkins, "Pie Menus: A 30 Year Retrospective"](https://donhopkins.medium.com/pie-menus-936fed383ff1)
- [Don Hopkins, "The Design and Implementation of Pie Menus"](https://donhopkins.medium.com/the-design-and-implementation-of-pie-menus-80db1e1b5293)
- [Bill Buxton, "User Learning and Performance with Marking Menus"](https://www.billbuxton.com/MMUserLearn.html)
- [Bill Buxton, "The limits of expert performance using hierarchic marking menus"](https://www.billbuxton.com/MMExpert.html)
- [Pie menu — Wikipedia](https://en.wikipedia.org/wiki/Pie_menu)
- [Gordon Kurtenbach, "The Design and Evaluation of Marking Menus" (PhD thesis)](https://www.research.autodesk.com/app/uploads/2023/03/the-design-and-evaluation.pdf_recHpUp1v9dc1n2CJ.pdf)
- [Wave Menus / Wavelet Menus (Inria)](https://inria.hal.science/hal-00953319)
- [Touch Means a New Chance for Radial Menus (Big Medium)](https://bigmedium.com/ideas/radial-menus-for-touch-ui.html)
- [Gesture-based Radial Menus (Luis Abreu)](https://lmjabreu.com/post/gesture-based-radial-menus/)

### Tutorials & implementation

- [Una Kravets, "Building a no-JS radial menu with CSS trigonometry, popover, and anchor positioning"](https://una.im/radial-menu)
- [Sara Soueidan, "Building a Circular Navigation with SVG"](https://www.sarasoueidan.com/blog/building-a-circular-navigation-with-svg/)
- [Varun Vachhar, "Polar Coordinates"](https://varun.ca/polar-coords/)
- [Heri Rodriguez, "The math core of a radial menu"](https://codepen.io/soybisonte/post/the-math-core-of-a-radial-menu)
- [Smashing Magazine, "Decoding the SVG Path Element: Curve and Arc Commands"](https://www.smashingmagazine.com/2025/06/decoding-svg-path-element-curve-arc-commands/)
- [Calculating Relative Mouse Angles in JavaScript Using atan2() (Douiri)](https://douiri.org/blog/javascript-mouse-angle/)
- [MDN: SVG Paths](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)
- [CSS-Tricks: atan2()](https://css-tricks.com/almanac/functions/a/atan2/)
- [Animated Circular Menu with HTML, CSS, and JavaScript (Madras Academy)](https://www.madrasacademy.com/animated-circular-menu-with-html-css-and-javascript/)
- [CodyHouse Rounded Animated Navigation](https://codyhouse.co/gem/css-rounded-animated-navigation/)
- [CSS Script: Modern Accessible Circular Menus](https://www.cssscript.com/modern-accessible-circular-menu/)
- [CSS Script: Orbit Menu](https://www.cssscript.com/radial-orbit-menu/)
- [Sketched Pie Menu Generator](https://pmg.softwaretailoring.net/)

### Design context (2026)

- [Spotlight vs Raycast vs Radial Menu (Radial Blog)](https://radial.appverge.net/blog/spotlight-vs-raycast-vs-radial-menu)
- [Designing Effective Contextual Menus (NN/g)](https://www.nngroup.com/articles/contextual-menus-guidelines/)
- [10 UI Patterns Users Still Love in 2026 (Design Shack)](https://designshack.net/articles/ux-design/best-ui-patterns/)
- [What's changing in mobile app design 2026 (Muzli)](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/)
- [PowerToys Command Palette Dock (Windows Latest)](https://www.windowslatest.com/2026/03/26/tested-windows-11-now-has-a-second-taskbar-and-it-works-surprisingly-well/)

### Patents (for prior-art mapping)

- [USPTO 8627233 — Radial menu with overshoot, fade-away, and undo](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8627233)
- [USPTO 8468466 — Radial menu selection with gestures](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8468466)
- [USPTO 9261989 — Interacting with radial menus for touchscreens](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9261989)
- [USPTO 8826181 — Moving radial menus](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8826181)
- [USPTO 9383897 — Spiraling radial menus](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9383897)

---

## Closing note for the orchestrator

The single most pioneering idea here is **Mark-Ahead Radial Casting**: right-click a prompt and flick in a direction *without ever seeing a menu*. The same gesture both teaches (when slow) and executes (when fast), giving you a unified novice-to-expert ramp built into the prompt vault. Combine it with agent-aware coloring, a hierarchical second-flick for tags, and a "cast trail" particle effect, and the vault becomes the most distinctive part of EZvibes — something neither Raycast, Cursor, nor any current AI tool has shipped. It's also small enough to build in a weekend (~250 lines vanilla JS + SVG + CSS).
