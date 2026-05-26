# Drawer & Slide-Out Panel Patterns (2025–2026)

Research dossier for the **EZvibes** (vanilla JS / HTML / CSS / node-pty / xterm.js Electron 33 app) – aimed at designing a "**Prompt Vault**" panel that lives inside each session window, with one-click-to-paste markdown prompts, live file-watching, and pioneer-level motion design.

Agent #10 of 30. Focus: **drawer & slide-out panel patterns**.

---

## 0. TL;DR — pick this stack for EZvibes

If you only read one paragraph, this is the recommended composite pattern:

> **Push-content slide-out from the right edge of each session window**, anchored to the terminal pocket. Use the **native `<dialog>` element with `popover` API + `@starting-style`** for in-DOM mount and proper top-layer ordering. Animate with **CSS `linear()` spring easing** at ~260ms, plus a **drag-handle on the left edge** wired to the **Pointer Events API + `setPointerCapture`** that supports **velocity-based snap-to-detent** at `0%`, `42%`, and `100%`. Background: **`backdrop-filter: blur(18px) saturate(180%)`** plus an amber tint that matches the folder-window chrome (Mica-like). When the user picks a `.md` chip, the chip "shoots" toward the terminal via a FLIP-style transition and the contents are written into the active xterm PTY. Use a **`chokidar` file watcher** in the main process to broadcast `prompts:added/changed/removed` IPC events so other sessions writing `hand-off.md` files into the prompts folder cause instant visual updates. Accessibility: focus-trap inside the drawer, `Esc` closes, `Tab` cycles, respects `prefers-reduced-motion`, plus a pinnable "always-open" mode that toggles the drawer between push (content shifts) and overlay (content stays still) modes.

The single most exciting pioneer-level idea is: **a magnetic "Magic Dock" of prompt chips inside the drawer**, where the chip closest to the cursor scales up to ~2.25× with neighbors decaying linearly across a 110-px radius (built from `mouseX` motion value + `useTransform` interpolation, ported to vanilla JS). On click, the magnified chip **launches itself** with a Genie-style transition into the terminal cursor position, and the text streams as if typed character-by-character. The result feels like a haptic, physical "throwing" of a prompt into the shell.

---

## 1. The Vaul library — gold standard for drawer behavior

[Vaul](https://github.com/emilkowalski/vaul) by Emil Kowalski is the de-facto modern drawer reference. The repo is now marked **unmaintained as of late 2025** ("hobby project, no time to work on it"), but the design ideas it crystallized — physics-based snapping, velocity-aware drags, background-scaling, modal/non-modal switching, snap-to-sequential — are the canonical vocabulary of 2026 drawers and have been ported to Vue (`vaul-vue` by unovue), Svelte (`vaul-svelte`), and to non-React libs like [Aioli](https://github.com/94726/aioli).

### Why Vaul matters to a vanilla project
You will not import Vaul (it is React-only). You **will** copy its conceptual API and animation timings.

Key concepts to mirror:

| Vaul concept | What it does | Port to EZvibes |
|---|---|---|
| `snapPoints={[0.4, 0.75, 1]}` | Stops the drawer at 40 %, 75 %, 100 % of its size | `data-snap-points="0.42,0.75,1"` attribute parsed at init |
| `snapToSequentialPoint` | Disables velocity-skipping so each detent is mandatory | Boolean option in your `PromptVault` class |
| `fadeFromIndex` | After this snap index, the backdrop starts fading in | Use to keep the terminal visible while the drawer is at 42 % |
| `modal={false}` | The user can still interact with the page behind the drawer | Critical for EZvibes — terminal must stay focusable |
| `scaleBackground` | Page behind the drawer scales down to ~0.95 (iOS bottom-sheet look) | Lovely effect; scale the terminal pocket on full-open |
| `direction="right"` | Right-side drawer (also `left`, `top`, `bottom`) | EZvibes wants `right` for the vault, possibly `bottom` mode for keyboard-driven peek |
| `dismissible` | Tap-outside or swipe-out to close | True by default |
| `onAnimationEnd` | Fires when slide completes | Use to trigger PTY focus refit |
| Drag handle | A small horizontal/vertical pill at the leading edge | Add to the left edge of the right-side drawer |

### Vaul-style velocity snap algorithm (vanilla JS port)

```js
// Detents expressed as fraction of drawer width (0 = closed, 1 = fully open).
const SNAP_POINTS = [0, 0.42, 0.75, 1];
const VELOCITY_THRESHOLD = 0.5;   // px / ms
const DRAG_THRESHOLD     = 60;    // px

function snap(currentFraction, velocityPxPerMs, direction = +1) {
  // direction = +1 means user dragged toward open
  const absV = Math.abs(velocityPxPerMs);

  if (absV >= VELOCITY_THRESHOLD) {
    // Fast flick — jump to the next/previous detent in the direction of travel.
    const sorted = [...SNAP_POINTS].sort((a, b) => a - b);
    const idx = sorted.findIndex(p => p >= currentFraction);
    return direction > 0
      ? sorted[Math.min(idx + 0, sorted.length - 1)]
      : sorted[Math.max(idx - 1, 0)];
  }

  // Slow drag — snap to nearest detent.
  return SNAP_POINTS.reduce((best, p) =>
    Math.abs(p - currentFraction) < Math.abs(best - currentFraction) ? p : best
  );
}
```

### Vaul-style focus + dismissibility behavior

- Focus is auto-trapped while open (via `inert` on the rest of the document).
- `Esc` closes — but only if `dismissible` is true and there are no unsaved edits.
- Background scroll is locked (we don't have body scroll in EZvibes, but locking the terminal scroll while the drawer is open is overkill — leave terminal scroll alone, that is exactly the cross-talk users want).
- Tap-outside closes the drawer **unless** the drawer is in non-modal mode (`modal={false}`), in which case clicking the terminal just sends focus to xterm without closing the vault.

References: [Vaul repo](https://github.com/emilkowalski/vaul), [Vaul docs site](https://vaul.emilkowal.ski/), [snap-points page](https://vaul.emilkowal.ski/snap-points), [Sliding Into Smooth UI: Journey With Vaul](https://medium.com/@subashnatrayan28/sliding-into-smooth-ui-my-journey-with-vaul-the-react-drawer-library-that-just-gets-you-e509ca68eff1).

---

## 2. Radix Dialog / Headless UI Dialog / Shadcn Sheet (a11y baseline)

Even though EZvibes cannot import these (they are React), every drawer/sheet you ship should respect what they do for accessibility:

- `role="dialog"` + `aria-modal="true"` (or `aria-modal="false"` when in non-modal mode).
- `aria-labelledby` pointing at the drawer title (e.g., "Prompt Vault").
- `aria-describedby` pointing at the helper line ("Click to paste into active tab").
- Focus trap when modal: `Tab` cycles inside; `Shift+Tab` cycles backwards; first-focusable element is auto-focused on open.
- `Esc` closes the drawer **only** if focus is inside it (so Esc in xterm doesn't close the vault, which would be obnoxious).
- Focus returns to the trigger element on close.
- Animations should respect `prefers-reduced-motion`.
- On open, body content gets `inert` (when modal); on close it's removed. Radix automatically waits for animation completion before setting focus.

Implementation note: in Electron renderer code, `inert` works exactly as on the web (Chromium-backed). Use it on the terminal-host elements when the vault is modal:

```js
sessionWindow.querySelector('.terminal-pocket').inert = isVaultModal && isVaultOpen;
```

References: [Radix Dialog primitive](https://www.radix-ui.com/primitives/docs/components/dialog), [Radix accessibility overview](https://www.radix-ui.com/primitives/docs/overview/accessibility), [Dialog/Sheet/Popover a11y blog](https://eastondev.com/blog/en/posts/dev/20260329-dialog-sheet-popover-accessibility/), [Building Accessible Modals with Focus Traps (2026)](https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/).

### Shadcn Sheet vs Drawer differentiation (relevant to your choice)

| Feature | **Sheet** (Radix Dialog under the hood) | **Drawer** (Vaul under the hood) |
|---|---|---|
| Origin | Side of screen (top/right/bottom/left) | Bottom-up, gesture-driven |
| Primary platform | Desktop sidebars, filter panels | Mobile bottom sheets |
| Drag-to-resize | No | Yes |
| Velocity / snap | No | Yes |
| Best for EZvibes | The vault inside a session window | Maybe an optional "swipe-up command picker" |

So for EZvibes's vault you really want **Sheet semantics with Drawer physics** — exactly the composite you'd build by hand.

References: [Shadcn Sheet](https://www.shadcn.io/ui/sheet), [Shadcn Drawer](https://www.shadcn.io/ui/drawer), [What's the difference between Drawer and Sheet (discussion)](https://github.com/shadcn-ui/ui/discussions/3043).

---

## 3. Push-content vs overlay vs persistent — pick **all three** as modes

The three drawer mount strategies have different feels and use cases. Modern apps (Linear, Cursor, Arc) actually switch between them based on viewport width and user preference. EZvibes should support all three because session windows can be resized and the vault doubles as both a "quick picker" and a "permanent toolbox".

### 3.1 Overlay (default)
The drawer is `position: fixed` and floats on top of the terminal. Backdrop optional. Good for "I want to peek then go away."

```css
.prompt-vault[data-mode="overlay"] {
  position: absolute; /* relative to session window */
  inset-block: 0;
  inset-inline-end: 0;
  width: var(--vault-width, 320px);
  transform: translateX(100%);
  transition: transform var(--ease-out-spring) 260ms;
  z-index: 50;
}
.prompt-vault[data-mode="overlay"][data-open] {
  transform: translateX(0);
}
```

### 3.2 Push (content shifts)
Terminal pocket gets a `padding-inline-end` (or a `margin-inline-end`) equal to the vault width, so the terminal resizes to make room. This is what Linear, Notion side-peek, and modern IDEs do for their right rails.

```css
.session-window:has(.prompt-vault[data-mode="push"][data-open]) .terminal-pocket {
  padding-inline-end: var(--vault-width);
  transition: padding-inline-end var(--ease-out-spring) 260ms;
}
```

Important consequence: the xterm `fitAddon.fit()` must be re-run on the `transitionend` event. Otherwise the right side will be clipped exactly as the project CLAUDE.md warns. That's the "delayed stable-fit sequence" issue already documented in EZvibes.

### 3.3 Persistent / pinnable
The vault sits in the layout grid as a third column (Explorer = left, terminal = center, vault = right). A pin button in the vault header toggles this:

```html
<button class="vault-pin" aria-pressed="false" data-action="toggle-pin">
  <svg><!-- pin icon --></svg>
</button>
```

```js
pinBtn.addEventListener('click', () => {
  const pressed = pinBtn.getAttribute('aria-pressed') === 'true';
  pinBtn.setAttribute('aria-pressed', String(!pressed));
  vault.dataset.mode = !pressed ? 'persistent' : 'overlay';
  refitTerminal(state.activeTab);
});
```

### Sources for this section
- [Sidebar Design for Web Apps: UX Best Practices (2026 Guide)](https://www.alfdesigngroup.com/post/improve-your-sidebar-design-for-web-apps)
- [UI/UX Developer's Guide to Sidebar Layout](https://medium.com/@syedabdulmanan191/a-ui-ux-developers-guide-to-creating-a-perfect-sidebar-layout-ac140c1e3f88)
- [UX Design Patterns: Practical Examples (Feb 2026)](https://medium.com/@designstudiouiux/ux-design-patterns-practical-examples-when-to-use-them-eb2b73c42063)
- [8+ Best Sidebar Menu Design Examples of 2026](https://www.navbar.gallery/blog/best-side-bar-navigation-menu-design-examples)

---

## 4. Animation curves & easing — the **CSS `linear()` spring** revolution

The single most important tool added to the CSS toolkit in 2025-2026 is the [`linear()` easing function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/easing-function/linear). It lets you approximate **any** physics-based curve (springs, bounces, anticipation) using a sequence of point-on-curve samples. The browser then linearly interpolates between them — but at 25–50 points the eye reads it as a continuous physics curve.

### 4.1 Tools that generate `linear()` values

- [Linear() Easing Generator](https://linear-easing-generator.netlify.app/) — Jake Archibald + Adam Argyle
- [Easing Wizard](https://easingwizard.com)
- [postcss-spring-easing](https://github.com/okikio/postcss-spring-easing) — compile-time `spring()` → `linear()`
- [Motion CSS Spring skill](https://motion.dev/docs/studio-generate-css) — LLM-aware generator
- [CSS Spring Easing Generator (Kvin Me)](https://www.kvin.me/css-springs/how-to-use)

### 4.2 Production spring presets I recommend for EZvibes

```css
:root {
  /* SMOOTH ENTRY (drawer slide-in) — 1.0s, gentle decel */
  --ease-out-smooth: linear(
    0, 0.013 1.5%, 0.05 3%, 0.105 4.5%, 0.176 6%, 0.262 7.5%, 0.359 9%,
    0.464 10.5%, 0.573 12%, 0.681 13.5%, 0.783 15%, 0.872 16.5%, 0.943 18%,
    0.991 19.5%, 1.013 21%, 1.016 22.5%, 1.007 24%, 0.993 25.5%, 0.981 27%,
    0.976 28.5%, 0.981 30%, 0.994 31.5%, 1.008 33%, 1.014 34.5%, 1.011 36%,
    1.004 37.5%, 0.998 39%, 0.998 42%, 1
  );

  /* SNAPPY (button press, chip launch) — 200ms */
  --ease-snappy: linear(
    0, 0.038, 0.158, 0.349, 0.59, 0.84, 1.025, 1.116, 1.114, 1.04, 0.946, 0.871,
    0.836, 0.844, 0.881, 0.93, 0.974, 1.005, 1.018, 1.015, 1.002, 0.987, 0.978,
    0.978, 0.987, 1
  );

  /* BOUNCY (Genie-style minimize / restore) — 500ms */
  --ease-bouncy: linear(
    0, 0.06, 0.25, 0.56, 1, 0.81, 0.75, 0.81, 1, 0.94, 1 91%, 0.98, 1
  );

  /* Default durations */
  --dur-fast: 160ms;
  --dur-base: 260ms;
  --dur-slow: 420ms;
}
```

### 4.3 Drawer slide CSS that ships

```css
.prompt-vault {
  transform: translateX(100%);
  transition:
    transform var(--dur-base) var(--ease-out-smooth),
    opacity 120ms ease-out;
  will-change: transform;
}
.prompt-vault[data-open] { transform: translateX(0); }

@media (prefers-reduced-motion: reduce) {
  .prompt-vault {
    transition: opacity 100ms linear;
    transform: none;
    opacity: 0;
  }
  .prompt-vault[data-open] { opacity: 1; }
}
```

### 4.4 Fallback for browsers without `linear()`

Chromium 113+, Firefox 112+, Safari 17.5+. Electron 33 ships Chromium 130 so you're fine — no fallback needed. If you ever back-port:

```css
@supports not (animation-timing-function: linear(0, 1)) {
  :root { --ease-out-smooth: cubic-bezier(0.16, 1, 0.3, 1); }
}
```

`cubic-bezier(0.16, 1, 0.3, 1)` is the famous "ease-out-expo" curve — a fine approximation of a smooth-spring without overshoot.

### 4.5 Useful cubic-bezier presets (Penner family)

| Name | Values | Feel |
|---|---|---|
| ease-out-expo | `cubic-bezier(0.16, 1, 0.3, 1)` | Decisive, snappy decel |
| ease-out-quart | `cubic-bezier(0.25, 1, 0.5, 1)` | Smooth, gentle decel |
| ease-out-back | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Light overshoot, "pop" |
| ease-in-out-expo | `cubic-bezier(0.87, 0, 0.13, 1)` | Strong S-curve |
| ease-in-out-circ | `cubic-bezier(0.85, 0, 0.15, 1)` | Mechanical, precise |

References: [Josh Comeau: Springs and Bounces in Native CSS](https://www.joshwcomeau.com/animation/linear-timing-function/), [Advanced CSS Animations with linear()](https://blog.openreplay.com/advanced-animations-with-css-linear/), [Create complex curves in CSS with linear() (Chrome)](https://developer.chrome.com/docs/css-ui/css-linear-easing-function), [MDN: linear() easing](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/easing-function/linear), [Custom easing without cubic-bezier guessing](https://modern-css.com/custom-easing-without-cubic-bezier-guessing/), [Easings cheat sheet](https://easings.net/).

---

## 5. The native HTML drawer: `<dialog>` + `popover` + `@starting-style`

The **biggest 2024-26 platform shift**: you no longer need a JS framework or even a third-party library to make a slide-out. Native HTML now provides everything: top-layer ordering, escape-key handling, focus trap (for modal dialogs), and discrete-property transitions.

### 5.1 The popover API as a drawer

Frontend Masters demonstrates the pattern beautifully — works with **just CSS and a single attribute** ([Popovers Work Pretty Nicely as Slide-Out Drawers](https://frontendmasters.com/blog/popovers-work-pretty-nicely-as-slide-out-drawers/)):

```html
<button popovertarget="prompt-vault">Open Prompts</button>
<div popover id="prompt-vault" class="vault">
  <!-- prompt chips -->
</div>
```

```css
[popover].vault {
  /* When closed: out of the viewport */
  display: block;
  position: fixed;
  inset: 0 0 0 auto;
  width: 360px;
  margin: 0;
  border: 0;
  background: rgb(20 24 32 / 0.85);
  backdrop-filter: blur(18px) saturate(180%);
  box-shadow: -32px 0 64px rgb(0 0 0 / 0.4);
  translate: 100% 0;
  opacity: 0;
  transition:
    translate var(--dur-base) var(--ease-out-smooth),
    opacity 120ms ease-out,
    overlay var(--dur-base) allow-discrete,
    display var(--dur-base) allow-discrete;
}

[popover].vault:popover-open {
  translate: 0 0;
  opacity: 1;
}

@starting-style {
  [popover].vault:popover-open {
    translate: 100% 0;
    opacity: 0;
  }
}

::backdrop {
  background: rgb(0 0 0 / 0);
  transition:
    background var(--dur-base) ease-out,
    display var(--dur-base) allow-discrete,
    overlay var(--dur-base) allow-discrete;
}
[popover].vault:popover-open::backdrop {
  background: rgb(0 0 0 / 0.25);
}
```

Three pieces of new CSS magic at work:
- **`@starting-style`** — declares the "before-entry" frame so transitions can run on mount.
- **`transition-behavior: allow-discrete`** — lets `display`, `visibility`, and `overlay` participate in transitions (otherwise they snap instantly).
- **`::backdrop`** — only renders when the popover/dialog is in top-layer.

### 5.2 `<dialog>` vs `popover` — which one for the vault?

- `<dialog>` opened via `.showModal()` — **modal**: focus-trapped automatically, body inert automatically, dismisses on `Esc`. Best when you want the vault to dim the terminal.
- `<dialog>` opened via `.show()` — non-modal, no focus trap, no inert. Useful when the user wants to keep typing in the terminal.
- `[popover="auto"]` — light-dismiss on outside click, light-dismiss on Esc, **non-modal but in the top layer**. Best for the default "peek" mode of the vault.
- `[popover="manual"]` — same as auto but no light-dismiss. Use for the pinnable persistent mode.

A practical mapping for EZvibes:

| Vault state | Element | Method |
|---|---|---|
| Pinned / persistent | none — render in the layout grid | DOM, no top-layer |
| Push mode | `[popover="manual"]` | `.showPopover()` |
| Overlay mode | `[popover="auto"]` | `.showPopover()` |
| "Distraction-mode" full-screen prompt library | `<dialog>` | `.showModal()` |

References: [Animating dialog and popover with @starting-style](https://blog.logrocket.com/animating-dialog-popover-elements-css-starting-style/), [Four new CSS features for smooth entry/exit (Chrome)](https://developer.chrome.com/blog/entry-exit-animations/), [Popover element entry/exit (Pawel Grzybek)](https://pawelgrzybek.com/popover-element-entry-and-exit-animations-in-a-few-lines-of-css/), [Using the Popover API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using), [Popover API: Native Modals (Calmops)](https://calmops.com/programming/web/popover-api-native-modals/), [Native Dialog and the Popover API](https://www.oidaisdes.org/blog/native-dialog-and-popover/), [MDN: @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style), [MDN: transition-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition-behavior), [CSS @starting-style Examples](https://freefrontend.com/css-@starting-style/), [CSS @starting-style: Entry Animations](https://www.edge-cases.com/css/css-starting-style-entry-animations).

---

## 6. Drag-handle, pull-tab, and velocity-based snap (the Vaul gesture core)

This is the chunk that gives the vault its tactile soul.

### 6.1 Pointer Events + `setPointerCapture`

Pointer Events unify mouse + touch + pen and are the right API in 2026. Crucially, `setPointerCapture(pointerId)` keeps `pointermove` flowing even if the cursor leaves the element — exactly what you want when dragging the vault edge across the screen.

```html
<div class="vault-handle" aria-label="Resize prompt vault" role="separator"
     aria-orientation="vertical" aria-controls="prompt-vault" tabindex="0">
</div>
```

```css
.vault-handle {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 6px;
  cursor: col-resize;
  touch-action: none;            /* critical — see §6.4 */
  user-select: none;
}
.vault-handle::before {
  content: '';
  position: absolute;
  inset-block: 50% 50%;
  inset-inline: 1px;
  width: 4px;
  height: 36px;
  margin-block: auto;
  border-radius: 4px;
  background: color-mix(in oklab, currentColor 30%, transparent);
  transition: background 120ms ease;
}
.vault-handle:hover::before,
.vault-handle:focus-visible::before {
  background: color-mix(in oklab, currentColor 60%, transparent);
}
```

### 6.2 Vanilla JS gesture handler with velocity tracking

```js
class VaultDrag {
  constructor(handle, vault, opts = {}) {
    this.handle  = handle;
    this.vault   = vault;
    this.minPx   = opts.minPx ?? 260;
    this.maxPx   = opts.maxPx ?? 640;
    this.snaps   = opts.snaps ?? [0, 0.42, 0.75, 1];

    this.points  = [];                     // ring buffer for velocity
    this.dragging = false;
    this.startX  = 0;
    this.startW  = 0;

    handle.addEventListener('pointerdown', this.down);
    handle.addEventListener('pointermove', this.move);
    handle.addEventListener('pointerup',   this.up);
    handle.addEventListener('pointercancel', this.up);
    handle.addEventListener('lostpointercapture', this.up);
  }

  down = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    this.handle.setPointerCapture(e.pointerId);
    this.dragging = true;
    this.startX   = e.clientX;
    this.startW   = this.vault.getBoundingClientRect().width;
    this.points.length = 0;
    this.vault.classList.add('is-dragging');   // disables transitions
  };

  move = (e) => {
    if (!this.dragging) return;
    const dx = this.startX - e.clientX;  // dragging left = positive growth
    const newW = clamp(this.startW + dx, this.minPx, this.maxPx);
    this.vault.style.setProperty('--vault-width', newW + 'px');

    // Ring-buffer the last 5 samples for velocity estimation
    this.points.push({ t: e.timeStamp, x: e.clientX });
    if (this.points.length > 5) this.points.shift();
  };

  up = (e) => {
    if (!this.dragging) return;
    this.dragging = false;
    this.handle.releasePointerCapture(e.pointerId);
    this.vault.classList.remove('is-dragging');

    // Velocity = px / ms over last samples
    const first = this.points[0];
    const last  = this.points[this.points.length - 1] ?? first;
    const vx    = first ? (last.x - first.x) / Math.max(1, last.t - first.t) : 0;

    const w        = this.vault.getBoundingClientRect().width;
    const fraction = (w - this.minPx) / (this.maxPx - this.minPx);
    const target   = snapPick(this.snaps, fraction, vx);
    const targetPx = this.minPx + target * (this.maxPx - this.minPx);

    // Spring back with CSS transition
    this.vault.style.setProperty('--vault-width', targetPx + 'px');
  };
}

function snapPick(snaps, fraction, vxPxPerMs) {
  const abs = Math.abs(vxPxPerMs);
  if (abs > 0.5) {
    const dir = vxPxPerMs < 0 ? 1 : -1; // negative dx = grew, so favor "open"
    const sorted = [...snaps].sort((a, b) => a - b);
    const idx = sorted.findIndex(p => p >= fraction);
    return dir > 0
      ? sorted[Math.min(idx, sorted.length - 1)]
      : sorted[Math.max(idx - 1, 0)];
  }
  return snaps.reduce((best, p) =>
    Math.abs(p - fraction) < Math.abs(best - fraction) ? p : best
  );
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
```

### 6.3 The drag-handle visual affordance

Three patterns dominate in 2025-26:

1. **Vertical pill** (Vaul, Linear right rail) — 4 × 36 px, semitransparent, centered.
2. **Hairline + thicker grip on hover** (VS Code, Cursor) — single 1 px column that becomes a 6 px pill on hover.
3. **Notch + chevron** (macOS Finder column view) — a tab with a > glyph that signals "drag me OR click to collapse".

For EZvibes I recommend option 2 because the session window is amber-bordered already — adding a third visual would compete.

### 6.4 Critical CSS: `touch-action: none`

If you forget this, on touch displays Chrome will intercept the gesture for native scroll/zoom and your `pointermove` events stop firing. Always set `touch-action: none` on the drag handle (not the whole drawer, or scrolling inside the drawer will break).

References: [Pointer Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events), [Smooth Drag Interactions with Pointer Events](https://dev.to/nishinoshake/smooth-drag-interactions-with-pointer-events-5e2j), [Pointer Events spec (W3C)](https://www.w3.org/TR/pointerevents/), [Pointing the way forward (Chrome)](https://developer.chrome.com/blog/pointer-events), [Mastering Drag Handle UI](https://ones.com/blog/knowledge/mastering-drag-handle-ui-enhancing-user-experience/), [Cloudscape: Drag-and-drop](https://cloudscape.design/patterns/general/drag-and-drop/), [pmndrs/use-gesture (vanilla)](https://www.npmjs.com/package/@use-gesture/vanilla), [Motion useDragControls](https://motion.dev/docs/react-use-drag-controls).

---

## 7. Magnetic dock — the pioneer-level visual

The **single most exciting** pattern to steal from 2025-26 is the macOS-Dock magnification, ported to your prompt chips list. When the mouse approaches a prompt chip, that chip scales up and its neighbors get nudged sideways, exactly like Dock.app.

### 7.1 The "Magnified Dock" algorithm (Build UI / Magic UI / Aceternity)

The canonical implementation uses three values:

```js
const SCALE    = 2.25;   // max scale factor
const DISTANCE = 110;    // px radius of influence
const NUDGE    = 40;     // px sideways push
const SPRING   = { mass: 0.1, stiffness: 170, damping: 12 };
```

Per chip, compute distance from the cursor to the chip's center on the magnification axis (Y for a vertical list, X for horizontal). Then interpolate:

```js
function magnify(distance, max) {
  if (distance > max || distance < -max) return { scale: 1, nudge: 0 };
  const t = 1 - Math.abs(distance) / max;        // 1 at center, 0 at edge
  const scale = 1 + (SCALE - 1) * t;
  const nudge = -(distance / max) * NUDGE * scale;
  return { scale, nudge };
}
```

### 7.2 Pure-CSS dock magnification (no JavaScript) — clever trick

If you don't want to track mouse position, modern CSS gives you a fallback using `:has()` and the adjacent-sibling combinator. From [Crinkles](https://crinkles.dev/writing/a-modern-css-previous-sibling-combinator/):

```css
.chip:hover { transform: scale(1.5); }

.chip:hover + .chip,
.chip:has(+ .chip:hover) { transform: scale(1.35); }

.chip:hover + .chip + .chip,
.chip:has(+ .chip + .chip:hover) { transform: scale(1.2); }
```

That's literally the whole magnification — no JS, no mouse tracking. The downside: it doesn't follow the cursor inside a chip the way the Build UI version does (and is stuck on `:hover`, which doesn't work on touch).

### 7.3 Vanilla JS port of the Build UI dock (recommended)

```js
function attachMagneticDock(container, axis = 'y') {
  const chips = container.querySelectorAll('.prompt-chip');
  let cursor = -Infinity;

  function update() {
    for (const chip of chips) {
      const rect = chip.getBoundingClientRect();
      const center = axis === 'y'
        ? rect.top  + rect.height / 2
        : rect.left + rect.width  / 2;
      const distance = cursor - center;
      const { scale, nudge } = magnify(distance, 110);
      chip.style.setProperty('--magnify-scale',  scale);
      chip.style.setProperty('--magnify-nudge',  nudge + 'px');
    }
  }

  container.addEventListener('pointermove', (e) => {
    cursor = axis === 'y' ? e.clientY : e.clientX;
    requestAnimationFrame(update);
  });
  container.addEventListener('pointerleave', () => {
    cursor = -Infinity;
    requestAnimationFrame(update);
  });
}
```

```css
.prompt-chip {
  transform-origin: 50% 50%;
  transform:
    translateY(var(--magnify-nudge, 0))
    scale(var(--magnify-scale, 1));
  transition: transform 120ms var(--ease-out-smooth);
  will-change: transform;
}
```

References: [Build UI: Magnified Dock recipe](https://buildui.com/recipes/magnified-dock), [Magic UI Dock component](https://magicui.design/docs/components/dock), [Cult UI Dock](https://www.cult-ui.com/docs/components/dock), [Aceternity Floating Dock](https://ui.aceternity.com/components/floating-dock), [frontend.fyi macOS Dock tutorial](https://www.frontend.fyi/tutorials/macos-dock-hover-animation-with-css), [Crinkles previous-sibling combinator](https://crinkles.dev/writing/a-modern-css-previous-sibling-combinator/), [react-osx-dock](https://github.com/lukehorvat/react-osx-dock), [Pure CSS3 Mac-like Dock](https://codepen.io/herzinger/pen/ANxLpZ).

---

## 8. How Arc, Linear, Cursor, Notion design their side panels (real-world reference)

### 8.1 Arc Browser
- Vertical sidebar with **spaces** (color-themed workspaces) — directly relevant: each session folder in EZvibes could feel like an "Arc space" with its own accent color.
- Sidebar can be auto-hidden, then revealed by hovering near the left edge of the screen with a 200 ms grace timer.
- When hidden, a slim 4-px "pill" stays visible to hint at the edge.
- Springy slide-in on hover (mass ~0.3, damping ~25), much bouncier than Linear.

References: [Arc Browser: Reimagining the Browser Chrome](https://blakecrosley.com/guides/design/arc), [Reproducing ARC Browser's Search Bar Animation in SwiftUI](https://medium.com/@bancarel.paul/from-concept-to-code-reproducing-arc-browsers-search-bar-animation-in-swiftui-cd9fdb60e7a5).

### 8.2 Linear
- Calmer, more conservative motion — 180-240 ms `cubic-bezier(0.22, 1, 0.36, 1)` (very close to ease-out-quart).
- Right-side detail panel is **push-content** (the issue list shrinks to make room) so the user always sees both panes.
- Resizable via dragging the inner edge. Double-click resets to a saved default width (often 40% of viewport).
- No backdrop, no scrim — the panel just exists alongside the list.
- Color tokens for the panel chrome are precisely tuned with hue/chroma/lightness via OKLCH.

References: [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh).

### 8.3 Cursor
- Chat panel toggled via `Ctrl/⌘ + L` — instant show/hide with a 120 ms fade.
- Resizable via dragging the vertical border (no double-click reset until 2026).
- In Cursor 3 (April 2026) the IDE redesigned around an **Agents Window** that uses a *tiled* layout — multiple drawers/panes simultaneously, an inspiration for EZvibes if you ever want multi-vault setups.

References: [How to access AI chat sidebar on Cursor](https://hamsterstack.com/how-to/cursor/access-ai-chat-sidebar/), [Cursor IDE: Complete Guide (2026)](https://codersera.com/blog/cursor-ide-complete-guide-2026/), [Cursor 3 + Composer 2 walkthrough](https://codersera.com/blog/cursor-3-composer-2-walkthrough-2026/), [Cursor Forum: Megathread on layout](https://forum.cursor.com/t/megathread-cursor-layout-and-ui-feedback/146790).

### 8.4 Notion (Side Peek + Center Peek)
- **Side Peek**: opens a row/page in a right-side overlay that occupies ~60% of the viewport. Animates in from the right with a 260 ms ease-out.
- **Center Peek**: a centered modal-style "page". Both Peeks lock body scroll and trap focus.
- Subtle dim layer (8% black) behind side-peek.

References: [How to Open Center Peek in Notion](https://bullet.so/blog/how-to-open-center-peek-notion/), [Efficiently Using Peek Pages in Notion](https://www.sparxno.com/blog/peek-pages-notion).

### 8.5 Raycast / Quick Look
- Floating window slides up from the bottom of a context with a ~200 ms ease-out-back.
- Pinnable as "Floating Notes" — Quick Look variant.
- Native windows (not WebView popovers) so they can extend beyond the parent — Electron lets you do the same with `BrowserWindow` (`alwaysOnTop: true`, `frame: false`).

References: [Raycast Windows Changelog](https://www.raycast.com/changelog/windows), [Technical deep dive into the new Raycast](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast).

### 8.6 Vivaldi 8.0 (relevant model for EZvibes's pin behavior)
- All chrome can auto-hide and reappear on edge-hover with a configurable grace period.
- Each "side panel" has a pin button — pinned panels move into the layout grid.
- Web panels (a sidebar of webview iframes) — direct inspiration for what EZvibes's vault is.

References: [Vivaldi 8.0 design overhaul](https://vivaldi.com/blog/vivaldi-on-desktop-8-0/), [Custom CSS for Vivaldi providing Arc-like auto-hide](https://gist.github.com/Felvesthe/8a13560ed3135ab1fbec2b06a18402da).

---

## 9. Backdrop, scrim, glass — the "is this overlay on top of something?" question

### 9.1 Scrim treatments

- **No scrim**: pure push-content, like Linear. Use when the drawer is non-modal and you want context preserved.
- **Soft scrim** (8-15% black): subtle attention shift without occluding. iOS bottom-sheet default.
- **Heavy scrim** (35-50% black + 4-8px blur): full modal feel. Used by Notion side-peek, Vaul `modal=true`.
- **Glass scrim** (5% black + 20-40px backdrop-blur): turn the background into stained glass. Used by Apple Liquid Glass on macOS Tahoe.

```css
.vault-backdrop[data-open] {
  position: absolute;
  inset: 0;
  background: rgb(8 12 20 / 0.32);
  backdrop-filter: blur(8px) saturate(150%);
  transition: opacity var(--dur-base) ease-out;
}
```

### 9.2 Glass / Mica / Acrylic on the drawer itself

For EZvibes — which is a Windows-first Electron app — combine three layers:

```css
.prompt-vault {
  /* Layer 1: tinted base — same hue as the amber session window chrome */
  background:
    linear-gradient(
      180deg,
      rgb(255 180 88 / 0.06) 0%,
      rgb(180 110 40 / 0.02) 100%
    ),
    rgb(18 22 30 / 0.85);
  /* Layer 2: window blur (works in Electron via BrowserWindow.setBackgroundMaterial) */
  backdrop-filter: blur(20px) saturate(180%) brightness(1.05);
  /* Layer 3: thin glass border */
  border-inline-start: 1px solid rgb(255 220 160 / 0.12);
  box-shadow:
    -32px 0 64px rgb(0 0 0 / 0.55),
    inset 1px 0 0 rgb(255 255 255 / 0.05);
}
```

Add Mica / Acrylic at the **Electron BrowserWindow level** for the proper Windows 11 feel:

```js
const win = new BrowserWindow({
  backgroundMaterial: 'acrylic', // or 'mica' or 'tabbed'
  vibrancy: 'sidebar',           // macOS equivalent
  visualEffectState: 'active',
  transparent: true,
  // ... your existing options
});
```

(`backgroundMaterial` is Windows-only, added in Electron 27.)

### 9.3 Performance caveats

`backdrop-filter` is GPU-heavy. The Nielsen Norman / Frontend Masters consensus for 2026 is:

- 1 or 2 blurred surfaces per screen is fine.
- > 3 stacked blurs at 20+ px will drop frames on integrated GPUs.
- Use `contain: paint` on the drawer to clip composite layers.
- Set `will-change: transform, opacity` on entry, **remove** it after the transition ends (otherwise the GPU keeps it in a separate layer permanently).

References: [Josh Comeau: backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/), [Glassmorphism: Best Practices (NN/G)](https://www.nngroup.com/articles/glassmorphism/), [Glassmorphism What It Is and How to Use It in 2026](https://invernescesigndstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026), [Neumorphism vs Glassmorphism 2026](https://www.zignuts.com/blog/neumorphism-vs-glassmorphism), [Bringing the Glass Back (Mica/Acrylic)](https://www.oreateai.com/blog/bringing-the-glass-back-enhancing-your-windows-explorer-with-blur-acrylic-and-mica-effects/bba32102f3ecbeea9f7e103afafdd131), [Apple Liquid Glass (Wikipedia)](https://en.wikipedia.org/wiki/Liquid_Glass), [Liquid Glass UI 2026 explained](https://medium.com/@expertappdevs/liquid-glass-2026-apples-new-design-language-6a709e49ca8b).

---

## 10. Apple Liquid Glass (WWDC 2025) — the new design north star

Liquid Glass is iOS 26 / macOS Tahoe's unified design language. The traits worth stealing:

- **Light reactivity**: surfaces "bend" highlights based on device motion (we don't have device motion, but we have cursor motion — same idea).
- **Gel-like flex**: on tap/click the surface compresses slightly and rebounds. ~80 ms compress, ~140 ms rebound with mild overshoot.
- **Transparency reveals context**: the drawer's blur is *active*, the surface behind subtly seen.
- **Specular highlights**: a thin gradient line on the leading edge that catches "light" as you scroll or hover.

CSS approximation for a chip's gel response:

```css
.prompt-chip {
  transition: transform 180ms var(--ease-out-back), filter 180ms ease-out;
}
.prompt-chip:active {
  transform: scale(0.97);
  filter: brightness(1.15);
}
```

Cursor-tracked specular highlight on the drawer:

```js
vault.addEventListener('pointermove', (e) => {
  const r = vault.getBoundingClientRect();
  vault.style.setProperty('--gloss-x', `${(e.clientX - r.left) / r.width * 100}%`);
  vault.style.setProperty('--gloss-y', `${(e.clientY - r.top) / r.height * 100}%`);
});
```

```css
.prompt-vault::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    240px circle at var(--gloss-x, 50%) var(--gloss-y, 50%),
    rgb(255 255 255 / 0.10),
    transparent 60%
  );
  mix-blend-mode: overlay;
  transition: background 180ms ease-out;
}
```

References: [Apple Developer: Meet Liquid Glass (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/219/), [Liquid Glass: How Apple's Design Evolved](https://applemagazine.com/liquid-glass-ios-evolution/), [Liquid Glass: What It Means for Your App](https://arctouch.com/blog/apple-liquid-glass), [iOS 27 Refinement (2026)](https://applemagazine.com/ios-27-refinement-2026/), [iOS 26 Liquid Glass SwiftUI Reference](https://medium.com/@madebyluddy/overview-37b3685227aa), [Apple's Liquid Glass UI: What Designers Need to Know](https://folderit.net/apples-liquid-glass-ui-what-designers-need-to-know-now/).

---

## 11. Detents and iOS-style bottom sheets (relevant for the "swipe-up command picker" idea)

If you eventually want a bottom-edge command picker that complements the right-edge vault:

- **Pure Web Bottom Sheet** (`pure-web-bottom-sheet`) — vanilla web component, uses **CSS scroll-snap** for stops. Install with `npm install pure-web-bottom-sheet`.
- **Diaper** (Svelte) and **react-modal-sheet** — JavaScript-based with detents.
- **Apple HIG sheets** — define `medium` and `large` detents; web maps these to `[0.5, 1]` snap point arrays.

Vanilla pattern:

```html
<bottom-sheet swipe-to-dismiss tabindex="0">
  <div slot="snap" style="--snap: 25%"></div>
  <div slot="snap" style="--snap: 50%" class="initial"></div>
  <div slot="snap" style="--snap: 90%"></div>
  <div slot="header"><h2>Quick Prompts</h2></div>
  <prompt-list></prompt-list>
</bottom-sheet>
```

The component emits `snap-position-change` CustomEvents. Wire those to your `refitTerminal()` so the xterm always sizes to the visible area.

References: [Smooth Bottom Sheet Web Component](https://www.cssscript.com/bottom-sheet-native-mobile/), [iOS-Style Bottom Sheet for Svelte (Diaper)](https://next.jqueryscript.net/svelte/ios-bottom-sheet-diaper/), [react-modal-sheet](https://www.npmjs.com/package/react-modal-sheet), [How to Build a Floating Bottom Sheet (SwiftUI)](https://dev.to/sebastienlato/how-to-build-a-floating-bottom-sheet-in-swiftui-drag-snap-blur-lfp), [BottomSheet (Expo)](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/), [gorhom/react-native-bottom-sheet](https://deepwiki.com/gorhom/react-native-bottom-sheet/1-overview).

---

## 12. Accessibility checklist for the EZvibes vault (consolidated)

| Requirement | Implementation |
|---|---|
| Focus trap when modal | `inert` the rest of the session window; cycle Tab/Shift+Tab inside vault |
| Esc closes (when modal) | `vault.addEventListener('keydown', e => e.key === 'Escape' && close())` |
| Focus returns to trigger | Stash `document.activeElement` on open; restore on close |
| `prefers-reduced-motion` | Strip `translate` transition, use 100 ms `opacity` only |
| `role="dialog"` + `aria-labelledby` | On vault root |
| Drag handle has `role="separator"` + `aria-orientation` + `aria-valuemin/max/now` | For screen-reader users |
| Chips are real `<button>` elements | Not divs — keyboard, focus ring, click + Enter + Space all free |
| Vault title is a heading | `<h2 id="vault-title">Prompts</h2>` |
| Each chip's purpose is announced | `aria-describedby` pointing at "Pastes prompt content into active terminal tab" |
| Skip-link from terminal | `Ctrl + ;` toggles vault focus / terminal focus |

References: [Building Accessible Modals with Focus Traps (2026)](https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/), [shadcn/ui and Radix: Accessibility](https://eastondev.com/blog/en/posts/dev/20260330-shadcn-radix-accessibility/), [Radix Accessibility overview](https://www.radix-ui.com/primitives/docs/overview/accessibility), [WCAG 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [Design accessible animation and movement (Pope Tech)](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/), [prefers-reduced-motion (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [Reduced Motion criteria (Apple)](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/), [Complete Accessibility Guide to Animation](https://blog.greeden.me/en/2025/10/06/the-complete-accessibility-guide-to-animation-motion-designing-and-implementing-movement-as-comfortable-information/).

---

## 13. Composite **vanilla JS** drawer — full reference implementation

This is a complete, no-framework, single-class drawer you can drop into `renderer/app.js`. Combines:

- Native `popover` API for top-layer + light-dismiss.
- `@starting-style` for entry animation.
- `linear()` spring easing.
- Pointer-Events drag-handle with velocity snap.
- Focus restore + Esc handling.
- Mode switching: overlay / push / pinned.

### 13.1 HTML (in `renderer/index.html`, inside each session window template)

```html
<aside class="prompt-vault" popover="manual" id="vault-{sessionId}" data-mode="overlay">
  <div class="vault-handle" role="separator" aria-orientation="vertical"
       aria-controls="vault-{sessionId}" tabindex="0"></div>
  <header class="vault-header">
    <h2 id="vault-title-{sessionId}">Prompts</h2>
    <button class="vault-pin" data-action="toggle-pin" aria-pressed="false">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M14 4l6 6-4 2-2 6-6-6-3 1 1-3 6-6z"/>
      </svg>
    </button>
    <button class="vault-close" data-action="close" aria-label="Close prompts">×</button>
  </header>
  <input class="vault-search" type="search" placeholder="Filter prompts..." />
  <ul class="vault-list" role="listbox"></ul>
</aside>
```

### 13.2 CSS

```css
.prompt-vault {
  /* Positioned inside the session window */
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  width: var(--vault-width, 320px);
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 8px;
  padding: 12px 16px 16px;

  /* Glass */
  background:
    linear-gradient(180deg,
      rgb(255 180 88 / 0.06),
      rgb(140 80 30 / 0.02)),
    rgb(18 22 30 / 0.86);
  backdrop-filter: blur(20px) saturate(180%);
  border-inline-start: 1px solid rgb(255 220 160 / 0.12);
  box-shadow: -32px 0 64px rgb(0 0 0 / 0.55);
  color: #f5e9d2;

  /* Closed state */
  translate: 100% 0;
  opacity: 0;
  transition:
    translate var(--dur-base) var(--ease-out-smooth),
    opacity 120ms ease-out,
    width 220ms var(--ease-out-smooth),
    overlay var(--dur-base) allow-discrete,
    display var(--dur-base) allow-discrete;
  will-change: translate, opacity;
}

.prompt-vault.is-dragging { transition: none; }

.prompt-vault:popover-open {
  translate: 0 0;
  opacity: 1;
}
@starting-style {
  .prompt-vault:popover-open {
    translate: 100% 0;
    opacity: 0;
  }
}

/* Push mode: the terminal pocket gets a right margin equal to vault width */
.session-window:has(.prompt-vault[data-mode="push"]:popover-open) .terminal-pocket {
  padding-inline-end: var(--vault-width);
  transition: padding-inline-end var(--dur-base) var(--ease-out-smooth);
}

.vault-handle {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 6px;
  cursor: col-resize;
  touch-action: none;
}
.vault-handle::before {
  content: '';
  position: absolute;
  inset-block: 50% 50%;
  margin-block: auto;
  inset-inline: 1px;
  width: 4px;
  height: 40px;
  border-radius: 4px;
  background: rgb(255 220 160 / 0.18);
  transition: background 120ms ease, height 120ms ease;
}
.vault-handle:hover::before,
.vault-handle:focus-visible::before {
  background: rgb(255 220 160 / 0.55);
  height: 60px;
}

.vault-header { display: flex; gap: 8px; align-items: center; }
.vault-header h2 { font: 600 14px/1 ui-sans-serif; margin: 0; flex: 1; }

.vault-search {
  background: rgb(0 0 0 / 0.3);
  border: 1px solid rgb(255 220 160 / 0.12);
  border-radius: 6px;
  color: inherit;
  padding: 6px 10px;
  font: 13px ui-monospace, Menlo, Consolas;
}
.vault-search:focus-visible {
  outline: 2px solid rgb(255 200 120 / 0.6);
  outline-offset: 1px;
}

.vault-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.prompt-chip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-block: 4px;
  background: rgb(255 200 120 / 0.06);
  border: 1px solid rgb(255 220 160 / 0.08);
  border-radius: 8px;
  color: inherit;
  font: 13px ui-monospace, Consolas, Menlo;
  text-align: start;
  cursor: pointer;
  transform-origin: 50% 50%;
  transform:
    translateX(var(--magnify-nudge, 0))
    scale(var(--magnify-scale, 1));
  transition:
    transform 120ms var(--ease-out-smooth),
    background 120ms ease,
    border-color 120ms ease;
}
.prompt-chip:hover,
.prompt-chip:focus-visible {
  background: rgb(255 200 120 / 0.12);
  border-color: rgb(255 220 160 / 0.32);
}
.prompt-chip:active {
  transform:
    translateX(var(--magnify-nudge, 0))
    scale(calc(var(--magnify-scale, 1) * 0.96));
}

.prompt-chip[data-handoff] {
  /* Special highlight for hand-off.md files */
  border-color: rgb(120 200 255 / 0.5);
  background: rgb(60 140 220 / 0.10);
}

@media (prefers-reduced-motion: reduce) {
  .prompt-vault {
    transition: opacity 120ms linear, width 0ms;
    translate: 0 0;
  }
  .prompt-chip { transition: background 120ms ease; transform: none; }
}
```

### 13.3 JavaScript (the `PromptVault` class)

```js
class PromptVault {
  /**
   * @param {HTMLElement}  el         The .prompt-vault root element
   * @param {object}       options
   * @param {() => any}    options.writeToActiveTab(text)   Pastes text into active xterm
   * @param {() => string} options.activeFolder()           Returns current session folder
   */
  constructor(el, { writeToActiveTab, activeFolder }) {
    this.el = el;
    this.writeToActiveTab = writeToActiveTab;
    this.activeFolder = activeFolder;
    this.lastFocus = null;
    this.prompts = []; // { name, path, body, isHandoff }

    this.handle = el.querySelector('.vault-handle');
    this.list   = el.querySelector('.vault-list');
    this.search = el.querySelector('.vault-search');
    this.closeBtn = el.querySelector('[data-action="close"]');
    this.pinBtn   = el.querySelector('[data-action="toggle-pin"]');

    // Resizer + snap
    this.drag = new VaultDrag(this.handle, el, {
      minPx: 260, maxPx: 640,
      snaps: [0, 0.42, 0.75, 1]
    });

    // Listeners
    el.addEventListener('toggle', this.onToggle);
    this.closeBtn.addEventListener('click', () => this.close());
    this.pinBtn.addEventListener('click', this.togglePin);
    this.search.addEventListener('input', this.filter);
    el.addEventListener('keydown', this.onKey);

    // Magnetic dock on the list
    attachMagneticDock(this.list, 'y');

    // Subscribe to file-watcher IPC
    window.ezvibes.onPromptsUpdated?.(this.render);
  }

  open() {
    this.lastFocus = document.activeElement;
    if (this.el.matches(':popover-open')) return;
    this.el.showPopover();
    this.search.focus();
  }
  close() {
    if (this.el.matches(':popover-open')) this.el.hidePopover();
    this.lastFocus?.focus?.();
  }
  toggle() { this.el.matches(':popover-open') ? this.close() : this.open(); }

  onToggle = (e) => { // fires on open AND close
    if (e.newState === 'open') {
      this.refresh();
    }
  };

  onKey = (e) => {
    if (e.key === 'Escape') { this.close(); e.stopPropagation(); }
    if (e.key === 'Enter' && document.activeElement?.matches('.prompt-chip')) {
      this.paste(document.activeElement.dataset.path);
    }
  };

  togglePin = () => {
    const pressed = this.pinBtn.getAttribute('aria-pressed') === 'true';
    this.pinBtn.setAttribute('aria-pressed', String(!pressed));
    this.el.dataset.mode = !pressed ? 'push' : 'overlay';
    // ⚠ refit terminals after layout settles
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('EZvibes:refit-terminals'));
    }));
  };

  filter = () => {
    const q = this.search.value.toLowerCase();
    for (const li of this.list.children) {
      const txt = (li.dataset.search || '').toLowerCase();
      li.hidden = q && !txt.includes(q);
    }
  };

  refresh = () => {
    // Ask main for the prompts in this folder's .prompts directory
    window.ezvibes.listPrompts?.(this.activeFolder()).then(this.render);
  };

  render = (prompts) => {
    this.prompts = prompts;
    this.list.replaceChildren(...prompts.map(this.chip));
  };

  chip = (p) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'prompt-chip';
    btn.dataset.path = p.path;
    btn.dataset.search = `${p.name} ${p.body?.slice(0, 200) || ''}`;
    if (p.isHandoff) btn.dataset.handoff = 'true';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M6 3h10l4 4v14H6z" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>${escapeHtml(p.name)}</span>
    `;
    btn.addEventListener('click', () => this.paste(p.path, btn));
    li.appendChild(btn);
    return li;
  };

  async paste(path, sourceEl) {
    const text = await window.ezvibes.readPrompt(path);
    if (!text) return;

    // FLIP-style chip-to-terminal animation (the "Genie throw")
    if (sourceEl) this.flyChipToTerminal(sourceEl);

    // Send to PTY
    this.writeToActiveTab(text);
  }

  flyChipToTerminal(chip) {
    const startRect = chip.getBoundingClientRect();
    const termHost  = document.querySelector('.session-window.is-active .terminal-host');
    if (!termHost) return;
    const endRect = termHost.getBoundingClientRect();
    const clone = chip.cloneNode(true);
    clone.style.cssText = `
      position: fixed;
      left: ${startRect.left}px;
      top:  ${startRect.top}px;
      width: ${startRect.width}px;
      height: ${startRect.height}px;
      pointer-events: none;
      z-index: 9999;
      transition: transform 360ms var(--ease-out-smooth), opacity 360ms ease-out;
    `;
    document.body.appendChild(clone);
    requestAnimationFrame(() => {
      const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
      const dy = (endRect.top  + endRect.height) - (startRect.top + startRect.height / 2);
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2) rotate(-8deg)`;
      clone.style.opacity = '0';
    });
    setTimeout(() => clone.remove(), 420);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}
```

### 13.4 IPC additions (`main.js` + `preload.js`)

```js
// preload.js additions
contextBridge.exposeInMainWorld('ezvibes', {
  // ... existing
  listPrompts: (folder) => ipcRenderer.invoke('prompts:list', folder),
  readPrompt:  (path)   => ipcRenderer.invoke('prompts:read', path),
  onPromptsUpdated: (cb) => ipcRenderer.on('prompts:updated', (_, payload) => cb(payload)),
});

// main.js additions
const chokidar = require('chokidar');
const path = require('path');
const fs = require('node:fs/promises');

const watchers = new Map(); // folder -> chokidar watcher
function watchPrompts(folder) {
  const promptsDir = path.join(folder, '.prompts');
  if (watchers.has(promptsDir)) return;
  const w = chokidar.watch(promptsDir, { ignoreInitial: false, awaitWriteFinish: true });
  w.on('all', async (evt, p) => {
    const list = await listPromptsForFolder(folder);
    BrowserWindow.getAllWindows().forEach(win =>
      win.webContents.send('prompts:updated', { folder, list })
    );
  });
  watchers.set(promptsDir, w);
}

async function listPromptsForFolder(folder) {
  const dir = path.join(folder, '.prompts');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.md')) {
        const full = path.join(dir, e.name);
        const stat = await fs.stat(full);
        out.push({
          name: e.name,
          path: full,
          isHandoff: /hand[-_]?off/i.test(e.name),
          mtime: stat.mtimeMs,
        });
      }
    }
    return out.sort((a, b) => b.mtime - a.mtime); // newest first
  } catch { return []; }
}

ipcMain.handle('prompts:list', async (_, folder) => {
  watchPrompts(folder);
  return listPromptsForFolder(folder);
});
ipcMain.handle('prompts:read', async (_, p) => fs.readFile(p, 'utf8'));
```

---

## 14. Pioneer-level extras (rank-ordered by "cool factor")

### 14.1 ★★★★★ Chip-to-terminal "Genie throw"

The FLIP-style flight from `flyChipToTerminal` above is **the** signature gesture. Pair it with a brief amber pulse around the cursor in xterm to reinforce "the prompt arrived". This visual was pioneered by Things 3, Cron Calendar, and Arc's "prepare for action" animation.

### 14.2 ★★★★★ Magnetic dock on chip hover

Already covered in §7. Make the magnification subtle (max 1.35×, not 2.25×) for a productivity feel; reserve 2.25× for special chip types (CLAUDE.md, README.md).

### 14.3 ★★★★☆ "Pin to taskbar"-style sub-windows

Right-click a prompt → **Pop out** opens it as its own tiny BrowserWindow with `alwaysOnTop: true`. The user can keep a hand-off.md visible on a second monitor while typing in the terminal. Very Raycast Floating Notes.

### 14.4 ★★★★☆ Velocity-aware "fling" close

If the user drags the vault rapidly to the right (release velocity > 1.5 px/ms), it skips the partial detents and slams closed with a slight overshoot — same trick that makes Twitter swipe-to-archive feel real.

### 14.5 ★★★★☆ Push-vs-overlay mode switch with shared-element transition

When the user toggles pin, animate the *content* (the chip list) staying in place while the *chrome* transitions between layout positions. Use [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) (now Baseline 2024) for this:

```js
if (!document.startViewTransition) {
  this.swapMode();
} else {
  document.startViewTransition(() => this.swapMode());
}
```

### 14.6 ★★★☆☆ "Slot machine" recently-used reel

A horizontal strip of the last 5 used prompts inside the search box's empty state — they spin into place on open like an airport split-flap board, using the `Fallblatt` animation idiom. Highly memorable.

### 14.7 ★★★☆☆ Hover-edge auto-show when collapsed

When the vault is fully closed, leave a 4-px amber pill on the right edge. Hovering it for 200 ms slides the vault out (overlay mode). This is Arc/Vivaldi's signature trick.

### 14.8 ★★★☆☆ Specular highlight tracking the cursor (Liquid Glass)

Detailed in §10. Adds a subtle but immediately-noticeable "alive" quality.

### 14.9 ★★★☆☆ Multi-vault tear-off

Inspired by [Zag.js Floating Panel](https://zagjs.com/components/react/floating-panel) and Cursor 3's Agents Window: long-press a chip → it detaches as a floating mini-window pinned over the terminal. Drag-to-dock it back.

### 14.10 ★★☆☆☆ Hand-off arrow visualization

When another Claude session writes a file to the prompts folder, briefly draw an SVG arc from the top of the vault down to the new chip, animated with `stroke-dasharray`/`stroke-dashoffset`. Tells the user "this just arrived from another session".

---

## 15. Decisions I'd make for EZvibes today

1. **Drawer technology**: Native `[popover="auto"]` for overlay mode, `[popover="manual"]` for push, plain DOM for pinned. No external library.
2. **Direction**: Right-side, anchored to each session window's terminal area (NOT the whole app).
3. **Default width**: 320 px; min 260 px; max 640 px; saved per-folder in localStorage.
4. **Trigger**: Folder-icon button on the tab strip + `Ctrl + ;` global shortcut + a thin pill on the right edge that fades in on hover-edge.
5. **Animation**: `linear()` spring easing tokens defined globally; 260 ms slide; 120 ms fade.
6. **Glass**: `backdrop-filter: blur(20px) saturate(180%)` + amber tint; on Windows, `backgroundMaterial: 'acrylic'` on the BrowserWindow.
7. **Interaction**: Click chip → write text to PTY + Genie throw. Right-click chip → context menu (Edit in default editor, Reveal in Explorer, Pop out as window, Pin to top, Delete).
8. **File watching**: Per-folder chokidar on `<folder>/.prompts/*.md` with `awaitWriteFinish: true`. Push `prompts:updated` IPC.
9. **A11y**: Full focus trap when modal, `prefers-reduced-motion` respected, every chip is a real button, drag handle is a real separator role, Esc closes only when focus is inside vault.
10. **Pinned mode**: When pinned, vault joins the grid; the terminal pocket shrinks; xterm fit re-runs after `transitionend`.

---

## 16. Master reference list

- Vaul: [GitHub](https://github.com/emilkowalski/vaul), [Docs](https://vaul.emilkowal.ski/), [Snap Points](https://vaul.emilkowal.ski/snap-points), [npm](https://www.npmjs.com/package/vaul), [vaul-vue](https://github.com/unovue/vaul-vue), [Aioli (radix-vue port)](https://github.com/94726/aioli), [Sliding Into Smooth UI](https://medium.com/@subashnatrayan28/sliding-into-smooth-ui-my-journey-with-vaul-the-react-drawer-library-that-just-gets-you-e509ca68eff1)
- Shadcn: [Sheet](https://www.shadcn.io/ui/sheet), [Drawer](https://www.shadcn.io/ui/drawer), [Dialog](https://www.shadcn.io/ui/dialog), [Resizable](https://www.shadcn.io/ui/resizable)
- Radix: [Dialog primitive](https://www.radix-ui.com/primitives/docs/components/dialog), [Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- Animation: [Josh Comeau spring/linear()](https://www.joshwcomeau.com/animation/linear-timing-function/), [LogRocket linear()](https://blog.logrocket.com/dynamic-css-animations-linear-easing-function/), [Chrome linear() docs](https://developer.chrome.com/docs/css-ui/css-linear-easing-function), [Advanced linear()](https://blog.openreplay.com/advanced-animations-with-css-linear/), [okikio/spring-easing](https://github.com/okikio/spring-easing), [postcss-spring-easing](https://github.com/okikio/postcss-spring-easing), [Easing Wizard](https://easingwizard.com)
- Web platform: [Popover API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API), [Using Popover (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using), [@starting-style (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style), [transition-behavior (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition-behavior), [Pointer Events (W3C)](https://www.w3.org/TR/pointerevents/), [Pointer Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events), [Chrome Pointer Events blog](https://developer.chrome.com/blog/pointer-events), [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API), [WAAPI](https://blog.carbonteq.com/web-animation-api/)
- Drawer-as-popover: [Frontend Masters](https://frontendmasters.com/blog/popovers-work-pretty-nicely-as-slide-out-drawers/), [LogRocket](https://blog.logrocket.com/animating-dialog-popover-elements-css-starting-style/), [Pawel Grzybek](https://pawelgrzybek.com/popover-element-entry-and-exit-animations-in-a-few-lines-of-css/), [Chrome 4 new CSS features](https://developer.chrome.com/blog/entry-exit-animations/)
- Dock magnification: [Build UI Magnified Dock](https://buildui.com/recipes/magnified-dock), [Magic UI Dock](https://magicui.design/docs/components/dock), [Cult UI Dock](https://www.cult-ui.com/docs/components/dock), [Aceternity Floating Dock](https://ui.aceternity.com/components/floating-dock), [Frontend.fyi tutorial](https://www.frontend.fyi/tutorials/macos-dock-hover-animation-with-css), [Crinkles previous-sibling](https://crinkles.dev/writing/a-modern-css-previous-sibling-combinator/), [react-osx-dock](https://github.com/lukehorvat/react-osx-dock), [Pure CSS Mac Dock](https://codepen.io/herzinger/pen/ANxLpZ), [GirlieMac Mac dock](https://girliemac.com/blog/2010/06/02/simulating-macos-dock-like-menu-with-css3/)
- Gestures: [@use-gesture/vanilla](https://www.npmjs.com/package/@use-gesture/vanilla), [use-gesture repo](https://github.com/pmndrs/use-gesture), [Motion react-drag](https://motion.dev/docs/react-drag), [Motion useDragControls](https://motion.dev/docs/react-use-drag-controls), [Snapdrag](https://github.com/zheksoon/snapdrag), [Framer Motion drag-snap by OlegWock](https://sinja.io/blog/framer-motion-drag-snap-points), [Smooth drag with Pointer Events](https://dev.to/nishinoshake/smooth-drag-interactions-with-pointer-events-5e2j)
- Bottom sheets: [Pure Web Bottom Sheet](https://www.cssscript.com/bottom-sheet-native-mobile/), [react-modal-sheet](https://www.npmjs.com/package/react-modal-sheet), [Apple HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Diaper for Svelte](https://next.jqueryscript.net/svelte/ios-bottom-sheet-diaper/), [SwiftUI Bottom Sheets](https://21zerixpm.medium.com/bottom-sheets-in-swiftui-modal-presentations-done-right-bc4ab6825d02), [Expo BottomSheet](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/)
- Resizable panels: [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels), [Shadcn Resizable](https://www.shadcn.io/ui/resizable), [Ant Splitter](https://ant.design/components/splitter/), [ResizerTwo.js](https://www.cssscript.com/split-view-resizertwo/), [Obsidian double-click reset request](https://forum.obsidian.md/t/double-click-pane-resize-handle-to-size-panes-evenly-like-vs-code/42626), [Mantine split-pane](https://github.com/gfazioli/mantine-split-pane)
- Vanilla drawer tutorials: [CSS Script Easy Sliding Drawer](https://www.cssscript.com/easy-sliding-drawer/), [CodeHim](https://codehim.com/menu/easy-sliding-drawer-in-vanilla-javascript/), [Side-drawer Web Component](https://www.webcomponents.org/element/side-drawer), [CodyHouse Drawer](https://codyhouse.co/ds/components/info/drawer), [Younessbennaj custom slide-out](https://www.younessbennaj.com/articles/slide-out-menu) (404 at time of fetch — try archive), [Speckyboy slide-out sidebars](https://speckyboy.com/slide-out-sidebars/)
- Linear / Arc / Cursor / Notion / Raycast: [Linear design refresh](https://linear.app/now/behind-the-latest-design-refresh), [Arc browser chrome design](https://blakecrosley.com/guides/design/arc), [ARC search bar SwiftUI repro](https://medium.com/@bancarel.paul/from-concept-to-code-reproducing-arc-browsers-search-bar-animation-in-swiftui-cd9fdb60e7a5), [Cursor chat sidebar 2026](https://hamsterstack.com/how-to/cursor/access-ai-chat-sidebar/), [Cursor 3 walkthrough](https://codersera.com/blog/cursor-3-composer-2-walkthrough-2026/), [Cursor Megathread layout feedback](https://forum.cursor.com/t/megathread-cursor-layout-and-ui-feedback/146790), [Notion side peek](https://www.makeuseof.com/change-notion-side-peek-setting/), [Notion center peek](https://bullet.so/blog/how-to-open-center-peek-notion/), [Raycast deep dive](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast), [Vivaldi 8.0](https://vivaldi.com/blog/vivaldi-on-desktop-8-0/), [Vivaldi Arc-like CSS gist](https://gist.github.com/Felvesthe/8a13560ed3135ab1fbec2b06a18402da)
- Liquid Glass: [Apple WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/), [Liquid Glass Wikipedia](https://en.wikipedia.org/wiki/Liquid_Glass), [Liquid Glass 2026 Medium](https://medium.com/@expertappdevs/liquid-glass-2026-apples-new-design-language-6a709e49ca8b), [ArcTouch on Liquid Glass](https://arctouch.com/blog/apple-liquid-glass), [Apple Developer App redesign](https://www.explosion.com/184758/apple-developer-app-gets-liquid-glass-redesign-for-wwdc-2026/), [iOS 27 Refinement](https://applemagazine.com/ios-27-refinement-2026/), [Designers Need to Know Liquid Glass](https://folderit.net/apples-liquid-glass-ui-what-designers-need-to-know-now/)
- Glass / Mica / Acrylic: [Josh Comeau backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/), [NN/G Glassmorphism](https://www.nngroup.com/articles/glassmorphism/), [Glassmorphism 2026 trend](https://invernescesigndstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026), [Neumorphism vs Glassmorphism](https://www.zignuts.com/blog/neumorphism-vs-glassmorphism), [12 Glassmorphism Best Practices](https://uxpilot.ai/blogs/glassmorphism-ui), [Bringing the Glass Back](https://www.oreateai.com/blog/bringing-the-glass-back-enhancing-your-windows-explorer-with-blur-acrylic-and-mica-effects/bba32102f3ecbeea9f7e103afafdd131), [Backdrop-filter showcase](https://codepen.io/NeonDevil/pen/Jjjmebp), [TestMu Glassmorphism](https://www.testmuai.com/blog/css-glassmorphism/), [What Is Glassmorphism (WP Dean)](https://wpdean.com/what-is-glassmorphism/), [ExplorerBlurMica](https://github.com/Maplespe/ExplorerBlurMica)
- Accessibility: [UXPin Focus Traps 2026](https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/), [Dialog/Sheet/Popover a11y](https://eastondev.com/blog/en/posts/dev/20260329-dialog-sheet-popover-accessibility/), [shadcn/Radix accessibility](https://eastondev.com/blog/en/posts/dev/20260330-shadcn-radix-accessibility/), [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [Pope Tech accessible animation](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/), [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [Sparkbox prefers-reduced-motion](https://sparkbox.com/foundry/prefers_reduced_motion_media_query_CSS_rule_for_WCAG_accessibility), [Apple Reduced Motion](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/), [Greeden Animation accessibility guide](https://blog.greeden.me/en/2025/10/06/the-complete-accessibility-guide-to-animation-motion-designing-and-implementing-movement-as-comfortable-information/)
- Electron infra: [Watch Files in Electron](https://ourcodeworld.com/articles/read/160/watch-files-and-directories-with-electron-framework), [Chokidar repo](https://github.com/paulmillr/chokidar), [Electron Window Customization](https://www.electronjs.org/docs/latest/tutorial/window-customization), [Electron drag npm](https://github.com/kapetan/electron-drag), [Zag Floating Panel](https://zagjs.com/components/react/floating-panel)
- Command palette / floating dock: [cmdk awesome list](https://github.com/stefanjudis/awesome-command-palette), [Raycast manual](https://manual.raycast.com/command-aliases-and-hotkeys), [Aceternity Floating Dock](https://ui.aceternity.com/components/floating-dock), [Kaif Floating Dock](https://kaif-ui.vercel.app/docs/components/floatingdock), [Shadcn Apple Dock](https://shadcnspace.com/components/apple-dock)
- Tickers / split-flap / scroll: [Motion Ticker](https://motion.dev/docs/react-ticker), [Codrops Sticky Grid Scroll](https://tympanus.net/codrops/2026/03/02/sticky-grid-scroll-building-a-scroll-driven-animated-grid/), [Josh Comeau Scroll-Driven Animations](https://www.joshwcomeau.com/animation/scroll-driven-animations/), [jQuery Fallblatt split flap](https://www.jqueryscript.net/animation/split-flap-display-fallblatt.html)
- Bezier presets / tooling: [FWD Tools easing generator](https://fwdtools.com/css-easing-generator/), [WDP cubic-bezier](https://tools.webdevpuneet.com/css-easing-generator), [easings.net](https://easings.net/), [Tailwind transition-timing-function](https://tailwindcss.com/docs/transition-timing-function), [meduzen easings](https://github.com/meduzen/easings), [shadcn easings](https://www.shadcn.io/easings), [CSS Tricks cubic-bezier](https://css-tricks.com/almanac/functions/c/cubic-bezier/)

---

End of agent #10's report.
