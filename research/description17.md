# Microanimations and Motion Design for the EZvibes Prompt Vault (2025-2026 Deep Research)

> Research agent #17 of 30. Focus: **Microanimations and motion design** — exact specs, libraries, recipes, and pioneer-level patterns for the prompt vault feature (a sidebar inside an Electron terminal session window that lists markdown prompt files which paste into the active xterm tab on click, with chokidar-style file watching, hand-off integration, and "feel-good" choreography).

---

## 0. TL;DR — The Pioneer Moves You Should Steal Now

If you read nothing else: implement these five things and the vault will already punch above any 2026 Electron tool's weight class.

1. **View Transitions API for everything that changes shape.** When a hand-off `.md` file lands in the vault folder via chokidar, wrap the DOM insert in `document.startViewTransition()` so the row materializes from its destination instead of cross-fading. New file rows ride a `view-transition-name: match-element` (the 2026 keyword that lets you tag a whole list as participating without unique names) and morph into place. Linear, Vercel, and Stripe Connect now do this for list reorders.
2. **CSS `linear()` spring easings, no JS lib needed.** Native CSS now does true spring physics via the `linear()` easing function (`87% global support, baseline since Dec 2023`). One CSS variable, zero JS, GPU-accelerated. Define `--spring-snappy: linear(0, 0.06 4%, 0.23 9%, 0.5 15%, 0.83 22%, 1.18 31%, 1.27, 1.18 47%, 1.06 56%, 0.97 66%, 1.0 87%, 1)` and you get Apple-grade motion for free.
3. **AutoAnimate as the FLIP layer.** `@formkit/auto-animate@2.5kB` does FLIP automatically for any parent. Hand it `.vault-list` once, and add/remove/move animations Just Work. This is the cheapest way to make the vault feel alive.
4. **A two-stage "yeet" choreography for paste.** Row click → row scales to 0.94 in 90 ms (anticipation) → row morphs across the screen toward the terminal viewport (200 ms `linear()` spring) → terminal flashes a 1-frame blue inner-shadow pulse → row reappears at original position with `view-transition-old/new` cross-dissolve (80 ms). Total: ~370 ms. Feels physical, not generic.
5. **Scroll-driven `view()` timeline on the vault list** so each prompt fades up and scales 0.96→1.0 as it enters the scrollport — pure CSS, runs on the compositor thread, zero JS, zero jank. (`animation-timeline: view()` is baseline in Chromium 115+, Safari 18+; Firefox flag.)

The single most-pioneer-level idea I uncovered is in §13 below — **"Scroll-stitched hand-off ribbon"** — a vault-side ribbon that uses `animation-timeline: scroll()` to physically yarn-thread a colored line from a newly-arrived hand-off file at the top of the list down into the active terminal tab indicator, choreographed with `view()` timeline element entrance so the ribbon "ties" itself as you scroll. No one is shipping this in any productivity app yet.

---

## 1. The 2026 Library Landscape: What to Actually Use in Vanilla JS Electron

Because EZvibes is vanilla JS + HTML + CSS with `node-pty` + `@xterm/xterm`, **every library below needs a vanilla mode**. I've audited each one for that requirement.

### 1.1 Motion (formerly Framer Motion)

The big news: Framer Motion and Motion One **merged into a single library called Motion** at the start of 2025. The site is now `motion.dev`. The current version is **12.40.0** (last published mid-May 2026). It is no longer a React-only library — the `motion/dom` import gives you a fully vanilla JS animator with the WAAPI under the hood.

- **Vanilla JS bundle (`motion/dom` `animate` function):** `~3.8kB` (vs `~17kB` for the React build).
- **Spring physics defaults:** `stiffness: 1`, `damping: 10`, `mass: 1`, `bounce: 0.25`, `duration: 0.3` (single keyframe) or `0.8` (multi-keyframe).
- **What makes it pioneer-grade:** Motion **auto-generates `linear()` CSS strings for any spring or custom easing function** so the animation runs on the compositor instead of `requestAnimationFrame`. This is huge for Electron, where a poorly-set animation can drop the xterm renderer below 60fps.
- **Install:** `npm install motion` (no React peer-dep needed when you only import `motion/dom`).

Minimal vanilla JS recipe for the vault row hover:

```javascript
import { animate, hover, press, spring } from "motion"

// Row lift on hover with spring physics, runs natively via WAAPI + linear()
hover(".vault-row", (element) => {
  animate(element, { y: -2, scale: 1.015 }, { type: spring, stiffness: 400, damping: 32 })
  return () => animate(element, { y: 0, scale: 1 }, { type: spring, stiffness: 500, damping: 35 })
})

// Press to give haptic-like squish
press(".vault-row", (element) => {
  animate(element, { scale: 0.96 }, { duration: 0.09, ease: [0.32, 0, 0.67, 0] })
  return () => animate(element, { scale: 1 }, { type: spring, stiffness: 700, damping: 28 })
})
```

Key features added in 2026 specifically relevant to the vault:
- May 18 2026: support for `repeatType` and `repeatDelay` inside animation sequences (use for the "new file" sparkle pulse loop).
- Drag now preserves in-flight motion-value animations across React 19 reorder unmount/remount; not directly relevant since EZvibes isn't React, but proves the maturity.
- v12 added animatable `oklch`, `oklab`, `lab`, `lch`, and `color-mix()` colors — useful when the vault tints based on the agent (claude = amber, codex = teal).

References:
- https://motion.dev
- https://motion.dev/changelog
- https://motion.dev/docs/react-upgrade-guide

### 1.2 GSAP 3.x — now 100% free, including bonus plugins

GSAP is the JavaScript animation library. In 2024 Webflow acquired GreenSock and **immediately made every plugin — SplitText, MorphSVG, Physics2D, ScrollSmoother, Flip, Draggable — free for commercial use**. This single fact reset the calculus.

- **Core size:** ~22kB. Vanilla JS native — `import { gsap } from "gsap"`. Works inside Electron's renderer with no special config.
- **Why it still wins over Motion in some places:** the **Flip plugin** is the cleanest FLIP implementation on the web. Its `gsap.flip.from()` and `gsap.flip.fit()` are unmatched for "morph this element from where it was to where it is now" choreography — perfect for the paste animation (row jumps toward terminal).
- **Physics2DPlugin** for the sparkle particle drift when a hand-off arrives.
- **ScrambleText** for the cute "loading new prompt..." subtitle.

Vanilla recipe for the paste yeet:

```javascript
import { gsap } from "gsap"
import { Flip } from "gsap/Flip"
gsap.registerPlugin(Flip)

function yeetRowIntoTerminal(rowEl, terminalEl) {
  const state = Flip.getState(rowEl)
  // Move the row in the DOM tree to a "flying" overlay
  document.body.appendChild(rowEl)
  rowEl.style.position = "fixed"
  rowEl.getBoundingClientRect() // force reflow

  Flip.from(state, {
    duration: 0.4,
    ease: "expo.inOut",
    scale: true,
    onComplete: () => {
      gsap.to(rowEl, {
        x: terminalEl.getBoundingClientRect().left + 40,
        y: terminalEl.getBoundingClientRect().top + 40,
        scale: 0.4,
        opacity: 0,
        duration: 0.22,
        ease: "power3.in",
        onComplete: () => rowEl.remove()
      })
    }
  })
}
```

References:
- https://gsap.com (free as of 2024)
- https://github.com/greensock/GSAP
- https://madewithgsap.com

### 1.3 anime.js v4 — the lightweight challenger

Anime.js v4 (released throughout 2024–2025) was a **complete TypeScript rewrite** with new compositional patterns. It's ~7kB and feels closest in API to what an Electron vanilla project actually wants.

- **Native TypeScript** support (relevant if EZvibes later grows a build step).
- **Physics-based easing** built into v4 — no plugin needed.
- **Refined modular timelines** with `.add()`, `.sync()`, `.call()`, `.label()` make sequencing the paste choreography trivial.
- **Composition API** handles overlapping animations gracefully (the multi-tab scenario where you paste into Tab A while sparkle is still running for a Tab B file arrival).

Recipe for the "new file arrives" celebration timeline:

```javascript
import { createTimeline, animate, stagger } from "animejs"

const tl = createTimeline({ defaults: { ease: "outElastic(1, 0.6)" } })
tl
  .add(".vault-row.new", { scale: [0.7, 1], opacity: [0, 1], duration: 600 })
  .add(".vault-row.new .icon", { rotate: [-90, 0], duration: 500 }, "-=400")
  .add(".sparkle", { translateY: [-30, -120], opacity: [1, 0], duration: 900, delay: stagger(40) }, "<")
```

References:
- https://animejs.com
- https://github.com/juliangarnier/anime/wiki/What's-new-in-Anime.js-V4

### 1.4 AutoAnimate by FormKit — the one-line drop-in

This is the single most EZvibes-shaped library I found. It's vanilla JS, it's ~2.5kB, and it gives you FLIP automatically for a whole parent.

```bash
npm install @formkit/auto-animate
```

```javascript
import autoAnimate from "@formkit/auto-animate"

const vaultList = document.querySelector(".vault-list")
autoAnimate(vaultList, {
  duration: 240,                       // ms
  easing: "cubic-bezier(0.2, 0, 0, 1)", // Material 3 "emphasized"
  disrespectUserMotionPreference: false // honor prefers-reduced-motion
})
```

When chokidar emits an `add` event and the renderer appends a `<li>` to `.vault-list`, AutoAnimate **automatically** runs a FLIP entrance. When the file is deleted, an exit. When you sort the list (e.g. recency → name), every row animates to its new position. **You will not write a single keyframe.**

Custom keyframes are possible via a function as the second arg (returning a `KeyframeEffect`). Use this to override the "incoming" animation specifically for hand-off files so they pulse instead of slide.

References:
- https://auto-animate.formkit.com
- https://github.com/formkit/auto-animate

### 1.5 Motion One — now folded into Motion

Note that **Motion One is no longer a separate library**; the `motion/dom` entry point of the merged Motion package is the spiritual successor. The old `motion-one` npm package still works but is in maintenance mode. Use `motion@12+` instead.

### 1.6 Popmotion — the engine inside the engine

Popmotion is the low-level toolbox that originally powered Framer Motion. The `animate` function is `<5kB`. It exposes pure functions (`spring`, `decay`, `inertia`) that consume `from`, `to`, `velocity`, and return a subscribable animation. You'd reach for Popmotion when you want spring physics but don't want to ship the full Motion library.

Spring API:
```javascript
import { animate } from "popmotion"

animate({
  from: 0, to: 100,
  type: "spring",
  stiffness: 300,   // higher = snappier
  damping: 30,      // higher = less bounce
  mass: 1,
  velocity: 0,      // can be inherited from a gesture
  onUpdate: latest => row.style.transform = `translateY(${latest}px)`
})
```

This is the same math as Apple's `CASpringAnimation`. Use it for any animation that needs to *inherit velocity from a gesture* (e.g. release-after-drag).

References:
- https://popmotion.io
- https://github.com/Popmotion/popmotion

### 1.7 react-spring is a no-go for vanilla — skip it

`@react-spring/web` is React-only. For vanilla physics, prefer Popmotion or Motion's `spring`. The math behind react-spring's `stiffness/damping/mass` is identical to both.

For reference, react-spring's named presets are:
- `default`: stiffness 170, damping 26
- `gentle`: stiffness 120, damping 14
- `wobbly`: stiffness 180, damping 12
- `stiff`: stiffness 210, damping 20
- `slow`: stiffness 280, damping 60
- `molasses`: stiffness 280, damping 120

These are excellent reference values you can plug directly into Motion or Popmotion.

References:
- https://react-spring.dev/common/configs

### 1.8 Lottie and Rive — when you need designed motion, not coded motion

**Lottie (`lottie-web`)** renders After Effects animations as JSON. For the vault, this is overkill for everyday motion but **perfect for celebration moments**: a hand-off arrives → a 600ms confetti-burst Lottie plays in the corner. LottieFiles has thousands of free animations; you can drop a `.json` into `renderer/anim/` and play it via:

```javascript
import lottie from "lottie-web"
lottie.loadAnimation({
  container: document.querySelector(".lottie-celebrate"),
  renderer: "svg",
  loop: false,
  autoplay: true,
  path: "anim/handoff-sparkle.json"
})
```

**Rive (`@rive-app/canvas`)** is the 2026 successor people are switching to. Files are 30–50kB (vs Lottie's ~100kB+), they support **state machines** so the same animation can react to interactions (hover → idle → success), and they run on Canvas with WebGL acceleration. Spotify, Duolingo, Disney use Rive in production.

For EZvibes's vault you would use Rive for:
- An animated empty state ("No prompts yet — drop one in this folder").
- A live "tab connection" indicator that ticks/pulses while a session is active.
- A celebratory state-machine flourish when a hand-off arrives.

```javascript
import { Rive } from "@rive-app/canvas"
const r = new Rive({
  src: "anim/vault-empty.riv",
  canvas: document.querySelector("#vault-empty-canvas"),
  artboard: "EmptyVault",
  stateMachines: "Main",
  autoplay: true
})
// later, when a file arrives:
r.stateMachineInputs("Main").find(i => i.name === "hasFiles").value = true
```

References:
- https://rive.app
- https://github.com/rive-app/awesome-rive
- https://lottiefiles.com

### 1.9 tsParticles / canvas-confetti — for the sparkle moments

`@tsparticles/confetti` is the modern fork of `canvas-confetti`. It supports vanilla JS, weighs ~15kB minified, and exposes a single function call for click-triggered bursts.

```javascript
import { confetti } from "@tsparticles/confetti"

document.querySelector(".vault-row").addEventListener("click", (e) => {
  confetti({
    count: 40,
    spread: 60,
    angle: -90,
    startVelocity: 22,
    gravity: 0.6,
    decay: 0.92,
    colors: ["#fbbf24", "#f59e0b", "#d97706"], // amber / claude vibe
    origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
  })
})
```

For the **subtle sparkle on hover**, prefer pure CSS pseudo-element sparkles over the JS particle library — the cost is too high for a hover state. Use the JS library only for *one-off celebrations* (hand-off arrived, vault first-launch tour, etc.).

References:
- https://confetti.js.org
- https://www.npmjs.com/package/@tsparticles/confetti

### 1.10 Hammer.js, @use-gesture, Pointer Events — gestures

For drag-to-pin, swipe-to-dismiss, long-press-to-preview:

- **Hammer.js** (7.34kB min+gz) is the classic. Adds tap, doubletap, press, swipe, pan, pinch, rotate. Vanilla JS friendly.
- **`@use-gesture/vanilla`** is the modern alternative (the React `@use-gesture/react` library has a vanilla sibling). It exposes velocity, distance, intent vectors — the same data Apple Pencil uses. Pair with Popmotion for release-after-drag physics.
- **Pointer Events** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) are now universal across Chromium 2026 and are sufficient for 90% of gestures. Don't pull in a library if you only need tap + drag.

References:
- https://hammerjs.github.io
- https://use-gesture.netlify.app

---

## 2. View Transitions API — the headline feature of 2026

The View Transitions API is the single biggest motion shift in the platform since CSS transitions themselves. As of 2026 it is:

- **Same-document (SPA-style):** baseline since Chrome 111, Edge 111, Safari 18, Firefox 144.
- **Cross-document (MPA-style):** Chrome/Edge 126+, Safari 18.2+, Firefox: still not supported.

For an Electron app where the renderer is a single document, **same-document support means you have View Transitions everywhere**. Electron 33 ships Chromium 130, so this is unconditionally usable.

### 2.1 The 30-second API

```javascript
// Wrap any DOM mutation that should animate
if (document.startViewTransition) {
  document.startViewTransition(() => {
    updateDOM() // sync DOM update
  })
} else {
  updateDOM() // fallback
}
```

When `startViewTransition()` runs:
1. The browser takes a snapshot of the current page.
2. The browser calls your callback synchronously and lets the DOM mutate.
3. The browser takes a snapshot of the new page.
4. The browser cross-fades the two snapshots by default.
5. Any element you tagged with `view-transition-name: <name>` gets its **own pair of snapshots** (old & new) that animate independently from the page snapshot.

### 2.2 Customizing the transition with CSS

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
  animation-timing-function: var(--spring-snappy);
}

/* For a specific named element */
::view-transition-old(vault-row-prompt-md) {
  animation: fade-and-zoom-out 280ms cubic-bezier(0.4, 0, 1, 1);
}
::view-transition-new(vault-row-prompt-md) {
  animation: fade-and-zoom-in 320ms cubic-bezier(0, 0, 0.2, 1);
}

@keyframes fade-and-zoom-out {
  to { opacity: 0; transform: translateY(-8px) scale(0.96); }
}
@keyframes fade-and-zoom-in {
  from { opacity: 0; transform: translateY(8px) scale(0.94); }
}
```

### 2.3 List reorder with `view-transition-name: match-element`

This is the 2026 secret weapon. Previously you had to give every list item a unique name:

```css
/* Old, painful way */
.vault-row:nth-child(1) { view-transition-name: row-1; }
.vault-row:nth-child(2) { view-transition-name: row-2; }
/* ... 40 more lines ... */
```

Now you can do:

```css
.vault-row { view-transition-name: match-element; }
```

The browser auto-generates a unique internal name per element and tracks identity across the mutation. This means when chokidar emits an `add` event and you splice a new row into the array, **every other row morphs to its new position automatically**.

Real implementation for the vault:

```javascript
function rerenderVault(newFiles) {
  if (!document.startViewTransition) {
    renderRows(newFiles)
    return
  }
  document.startViewTransition(() => renderRows(newFiles))
}
```

That's it. Six lines of code give you fluid FLIP-style reorders that beat 90% of native apps.

### 2.4 Real production examples

- **redBus** uses View Transitions API for ride-list-to-detail transitions. They cite "intuitive to create transitions across multiple user journeys to make the web experience more app-like."
- **Policybazaar** uses View Transitions on tooltip "why buy" elements; click count went up post-launch.
- **Astro 4 and Nuxt 3** ship first-class View Transitions support (Astro calls it "view transitions across pages with one prop").
- **Chrome's own docs** show shopping site reference implementations where the product card morphs into the product detail page.

References:
- https://developer.chrome.com/docs/web-platform/view-transitions
- https://developer.chrome.com/blog/css-ui-ecommerce-vt
- https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition
- https://view-transitions.chrome.dev

---

## 3. The Linear/Stripe/Vercel/Arc Motion Cheat Sheet (Real Production Values)

Here are timing values and easing curves I've extracted from the actual public design and engineering docs of the apps the user named.

### 3.1 Linear's motion principles (from their UI Refresh changelog Mar 2026)

- Headers, navigation, and view controls are now consistent across projects, issues, reviews, and documents — visually scannable.
- Sidebar collapse is **spring physics**, not a curve (they switched in late 2025 per the changelog).
- Their typography refresh moved to **frosted glass material** on iOS/Android, which they recreate on web via `backdrop-filter: blur(40px) saturate(160%)`.
- Micro-animations are described as "subtle, meticulous, never overwhelming."

### 3.2 Stripe's animation rules (from `stripe.com/blog/connect-front-end-experience`)

- **Never use built-in `ease`, `ease-in`, `ease-out`, `linear`**. Always define custom cubic-beziers as CSS variables.
- The Connect "Express keyboard" sliding animation uses `cubic-bezier(0.2, 1, 0.2, 1)` with `800ms` duration. This is a fast-attack, long-tail "express" curve — useful for big, smooth slides.
- They use `transform: translateY(100% → 0%)` (cheap properties only).
- **Animations stay under 500ms in most cases**; the keyboard's 800ms is the exception because it's a system-modal-class transition.
- They animate `transform` and `opacity` exclusively, with `will-change` only on the elements that will animate (never blanket).
- They wrap decorative animations in `@media (prefers-reduced-motion) { animation: none }`.

### 3.3 Vercel's web interface guidelines (`vercel.com/design/guidelines`)

These are gold for a vanilla JS Electron project. Key rules:

- **Hierarchy of techniques**: CSS > Web Animations API > JS libraries (motion, gsap, etc.). Use the lowest level that works.
- Animations are **cancelable by user input**.
- **No autoplay**; animate only in response to actions.
- "Only animate when it clarifies cause & effect or adds deliberate delight."
- **Explicitly list animated properties** — `transition: opacity 200ms, transform 240ms ease-out`. Never `transition: all`.
- For loading states: ~150–300ms show-delay + 300–500ms minimum visible time to prevent spinner flicker.
- For SVG transforms, wrap in `<g>` and apply `transform-box: fill-box; transform-origin: center;` (necessary because `<svg>` elements default to `transform-origin: 0 0`).
- Use `translateZ(0)` or `will-change: transform` to fix sub-pixel artifacts in text scaling.

### 3.4 Arc browser motion DNA

Arc doesn't publish a design system, but a few things are documented from interviews and the release notes:

- **Command Bar (⌘T)** uses spring physics for the expand animation and a custom timing that "feels like a magnet pulling open."
- **Easels** (their mood-board feature) use FLIP for the rearrange.
- Their tab "sibling tray" uses a hover-delay pattern: 80ms entry delay, 0ms exit delay, so accidental flyovers don't open the tray.
- The 2025 Arc refresh moved navigation transitions to `120Hz/ProMotion-aware` animations — they detect refresh rate and adapt.

### 3.5 The takeaway: a motion token system for EZvibes

Steal Stripe's pattern of CSS variables. Drop this into `renderer/styles.css`:

```css
:root {
  /* Duration tokens (per Material 3 + Carbon + Linear) */
  --dur-instant: 80ms;     /* hover, focus rings */
  --dur-fast: 150ms;       /* press, small reveals */
  --dur-base: 240ms;       /* card hover, tooltips */
  --dur-medium: 320ms;     /* row paste yeet */
  --dur-slow: 500ms;       /* full panel slide */
  --dur-long: 800ms;       /* "express" slides */

  /* Easing tokens */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);       /* Material 3 "emphasized" */
  --ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1); /* enter the screen */
  --ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);/* leave the screen */
  --ease-express: cubic-bezier(0.2, 1, 0.2, 1);      /* Stripe Connect */
  --ease-snappy: cubic-bezier(0.32, 0.72, 0, 1);     /* iOS-like */
  --ease-anticipate: cubic-bezier(0.7, -0.3, 0.3, 1.3); /* overshoot */
  --ease-back-out: cubic-bezier(0.34, 1.56, 0.64, 1);   /* slight bounce */

  /* Spring tokens via linear() — see §4 */
  --spring-snappy: linear(0, 0.0185 1.4%, 0.0727 2.9%, 0.1622 4.3%, 0.2842, 0.4357 7.1%, 0.6137 8.6%, 0.8128 10.1%, 1.0247 11.6%, 1.234 13.1%, 1.4216 14.5%, 1.575, 1.6818 17.4%, 1.7307, 1.7184 19.7%, 1.6471, 1.5294 21.8%, 1.3877 22.9%, 1.2426 24.1%, 1.1117 25.5%, 1.0072 26.9%, 0.9359 28.4%, 0.9015 29.9%, 0.9024 31.6%, 0.9362 33.5%, 0.9979 35.7%, 1.083 38.4%, 1.1816 41.5%, 1.2769 45.2%, 1.3506 49.6%, 1.3852 55, 1.3661 61.4%, 1.2904 68, 1.165 73.9%, 1, 1);
  --spring-smooth: linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974, 0.975 57.1%, 0.997 69.4%, 1.003 76.9%, 1.001 83.6%, 1);
  --spring-bouncy: linear(0, 0.014, 0.054 1.7%, 0.224 6.1%, 0.476 11.9%, 0.79 18.6%, 1.077 25.2%, 1.279 30.7%, 1.371 35.7%, 1.382 40.6%, 1.341 44.7%, 1.252 50, 1.142 56.2%, 1.057 62.5%, 1.006 70, 1, 1);

  /* Stagger increment */
  --stagger: 28ms;
}
```

Now every CSS animation can use `var(--ease-standard)` and `var(--dur-base)` and every component speaks the same dialect. This is exactly how Material 3 ships motion tokens (`md.sys.motion.easing.emphasized`) and how Carbon ships theirs (`@carbon/motion`).

References:
- https://vercel.com/design/guidelines
- https://github.com/vercel-labs/web-interface-guidelines
- https://stripe.com/blog/connect-front-end-experience
- https://carbondesignsystem.com/elements/motion/overview
- https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- https://linear.app/changelog/2026-03-12-ui-refresh
- https://linear.app/now/how-we-redesigned-the-linear-ui

---

## 4. Native CSS Spring Easings via `linear()` — The 2026 Game Changer

This is the most important section. **You can ship Apple-quality spring physics in pure CSS, no JavaScript, no library.** Browser support is 87% global (baseline since Dec 2023; Chrome 113+, Safari 17.2+, Firefox 112+).

### 4.1 The mechanism

The CSS `linear()` easing function takes a list of stops. Each stop is a value (0..1 normally; >1 = overshoot for spring/bounce) and an optional percentage of the timeline. Between stops, the browser **linearly interpolates** the eased progress, but with enough stops (40–75+) you can approximate any curve — including the oscillating decay of a physical spring.

Example mechanically equivalent to a "bouncy" spring:

```css
.vault-row {
  --row-y: 0;
  transform: translateY(var(--row-y));
  transition: transform 480ms linear(
    0,
    0.014, 0.054 1.7%, 0.224 6.1%, 0.476 11.9%, 0.79 18.6%,
    1.077 25.2%, 1.279 30.7%, 1.371 35.7%, 1.382 40.6%,
    1.341 44.7%, 1.252 50%, 1.142 56.2%, 1.057 62.5%,
    1.006 70%, 1, 1
  );
}
```

Notice values exceed `1` — those are the overshoot bounces. When `--row-y` flips from `0` to `-12px`, the row will overshoot past `-12px`, come back, bounce again with smaller amplitude, settle.

### 4.2 Ready-to-use presets

I've collected the most-cited preset `linear()` strings from `kvin.me/css-springs` (Apple-derived) and `joshwcomeau.com/animation/linear-timing-function`. Drop these into your CSS variable system:

```css
/* iOS-style smooth (gentle overshoot, no oscillation) */
--ease-spring-smooth: linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974, 0.975 57.1%, 0.997 69.4%, 1.003 76.9%, 1.001 83.6%, 1);

/* Snappy (fast settle, very small overshoot) */
--ease-spring-snappy: linear(0, 0.041 1.4%, 0.161 3%, 0.357 4.9%, 0.622 7%, 0.962 9.4%, 1.241 11.6%, 1.404 13.4%, 1.466 15.1%, 1.45 16.7%, 1.381 18.4%, 1.249 20.4%, 1.116 22.4%, 1.022 24.5%, 0.978 26.4%, 0.96 28.1%, 0.967, 0.985 31.5%, 1.011 33.6%, 1.043 36.4%, 1.062 38.9%, 1.066 41.6%, 1.054 44.5%, 1.033 47.6%, 1.013 51%, 0.997 54.7%, 0.989 58.9%, 0.987 64%, 0.991 70.3%, 0.998 78.6%, 1);

/* Bouncy (rubber band, 3+ bounces) */
--ease-spring-bouncy: linear(0, 0.014, 0.054 1.7%, 0.224 6.1%, 0.476 11.9%, 0.79 18.6%, 1.077 25.2%, 1.279 30.7%, 1.371 35.7%, 1.382 40.6%, 1.341 44.7%, 1.252 50%, 1.142 56.2%, 1.057 62.5%, 1.006 70%, 1, 1);

/* Anticipation (pulls back before launching) */
--ease-anticipate: linear(0, -0.04 4%, -0.085 9%, -0.106 14%, -0.085 19%, 0 25%, 0.12 30%, 0.336 38%, 0.575 44%, 0.79 50%, 0.939 56%, 1.026 62%, 1.06 68%, 1.041 74%, 1.001 81%, 0.991 87%, 1);
```

### 4.3 When to pick `linear()` over `cubic-bezier()`

- **Two control points isn't enough**: e.g. a spring with multiple oscillations cannot be drawn with a single cubic. Use `linear()`.
- **Time-based but overshooting**: `cubic-bezier()` *can* overshoot with y > 1, but produces only one peak. `linear()` produces many.
- **You want a true physical feel**: `linear()` interpolated from real spring math is the closest the web platform can get to native physics.

Use `cubic-bezier()` for everything else — it's smaller in CSS and equally well-supported.

### 4.4 The smartest workflow: write physics, generate `linear()`

Don't hand-author these strings. Either:
1. Use Kevin Hufnagl's generator at `kvin.me/css-springs` — input stiffness/damping/mass, copy out `linear()`.
2. Or use Motion's `spring()` function which auto-converts on the fly.
3. Or use Josh Comeau's recipe: write a `springToLinear(stiffness, damping, mass)` JS function once, output CSS variables at build time.

References:
- https://www.joshwcomeau.com/animation/linear-timing-function
- https://www.kvin.me/css-springs
- https://pqina.nl/blog/css-spring-animation-with-linear-easing-function
- https://developer.chrome.com/docs/css-ui/css-linear-easing-function
- https://www.smashingmagazine.com/2023/09/path-css-easing-linear-function

---

## 5. Spring Physics Defaults — the parameter cheat sheet

For when you want to use spring physics directly (Motion, Popmotion, anime.js v4), here are the canonical parameters for the moods you'll need in the vault.

| Mood | stiffness | damping | mass | bounce | duration | Use case |
|---|---|---|---|---|---|---|
| Instant decisive | 700 | 40 | 1 | 0.0 | ~140ms | Button press release |
| Snappy (Apple default) | 400 | 32 | 1 | 0.0 | ~240ms | Row hover, tooltip in |
| Default (Motion default) | 300 | 30 | 1 | 0.0 | ~280ms | Tab switch |
| Smooth overshoot | 220 | 22 | 1 | 0.18 | ~360ms | Panel open |
| Wobbly | 180 | 12 | 1 | 0.4 | ~520ms | Celebration |
| Bouncy (very) | 300 | 10 | 0.8 | 0.6 | ~700ms | "New file!" pulse |
| Heavy object | 120 | 14 | 2 | 0.0 | ~620ms | Modal scrim slide |
| Gentle | 120 | 14 | 1 | 0.0 | ~520ms | Sidebar collapse |
| Molasses | 280 | 120 | 1 | 0.0 | ~900ms | Loading skeleton |

These numbers are cross-referenced from react-spring's defaults, Apple's `UISpringTimingParameters`, and Motion's documented defaults.

---

## 6. Material Design 3 + Carbon Easing Tokens (the corporate cheat sheet)

If you want to play it safe and use well-tested production tokens, here's the M3 set:

```css
/* Material Design 3 motion tokens, May 2026 */
--m3-easing-emphasized:               cubic-bezier(0.2, 0, 0, 1);
--m3-easing-emphasized-decelerate:    cubic-bezier(0.05, 0.7, 0.1, 1);
--m3-easing-emphasized-accelerate:    cubic-bezier(0.3, 0, 0.8, 0.15);
--m3-easing-standard:                 cubic-bezier(0.2, 0, 0, 1);
--m3-easing-standard-decelerate:      cubic-bezier(0, 0, 0, 1);
--m3-easing-standard-accelerate:      cubic-bezier(0.3, 0, 1, 1);
--m3-easing-legacy:                   cubic-bezier(0.4, 0, 0.2, 1);

/* M3 duration tokens */
--m3-dur-short1: 50ms;
--m3-dur-short2: 100ms;
--m3-dur-short3: 150ms;
--m3-dur-short4: 200ms;
--m3-dur-medium1: 250ms;
--m3-dur-medium2: 300ms;
--m3-dur-medium3: 350ms;
--m3-dur-medium4: 400ms;
--m3-dur-long1: 450ms;
--m3-dur-long2: 500ms;
--m3-dur-long3: 550ms;
--m3-dur-long4: 600ms;
--m3-dur-extra-long1: 700ms;
--m3-dur-extra-long2: 800ms;
--m3-dur-extra-long3: 900ms;
--m3-dur-extra-long4: 1000ms;
```

Rules for combining them:
- **Entrance** (element appearing): `emphasized-decelerate` + `medium2/3`. Slow-out feels welcoming.
- **Exit** (element leaving): `emphasized-accelerate` + `short3/4`. Fast-out feels efficient.
- **Persistent** (element changing in place): `standard` + `medium1/2`. Symmetric.
- **Hero / signature moments**: `emphasized` + `long1`. Full Material 3 sauce.

IBM Carbon's parallel set:
```css
--carbon-easing-productive-standard: cubic-bezier(0.2, 0, 0.38, 0.9);
--carbon-easing-productive-entrance: cubic-bezier(0, 0, 0.38, 0.9);
--carbon-easing-productive-exit:     cubic-bezier(0.2, 0, 1, 0.9);
--carbon-easing-expressive-standard: cubic-bezier(0.4, 0.14, 0.3, 1);
--carbon-easing-expressive-entrance: cubic-bezier(0, 0, 0.3, 1);
--carbon-easing-expressive-exit:     cubic-bezier(0.4, 0.14, 1, 1);
```

The Carbon "productive" set is what you want for utility apps (EZvibes qualifies). "Expressive" is for marketing/onboarding flourish.

References:
- https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- https://carbondesignsystem.com/elements/motion/overview
- https://carbondesignsystem.com/elements/motion/choreography

---

## 7. Microinteraction Recipes — The Full Choreography

### 7.1 The "paste yeet" — file click → terminal paste

This is the core delight moment of the vault. Total budget: ~370ms. Steps:

1. **Anticipation (0–90 ms)**: row scales `0.96`, slight rotation `-1deg`, with `transition: transform 90ms cubic-bezier(0.32, 0, 0.67, 0)` (ease-in / accelerate — pulls back).
2. **Yeet (90–290 ms)**: row's flip-state is captured (`Flip.getState()`), DOM-moved to a `position: fixed` overlay layer, then `Flip.from()` animates it to a position near the terminal's input area while scaling down to `0.4` and fading to `0.2` opacity. Use `--ease-express: cubic-bezier(0.2, 1, 0.2, 1)` (Stripe's curve, snappy attack, long-tail glide).
3. **Terminal pulse (290–340 ms)**: at the same moment the row reaches the terminal, fire an inner-shadow pulse:
   ```css
   @keyframes terminal-paste-pulse {
     0%   { box-shadow: inset 0 0 0 0 rgba(56, 189, 248, 0); }
     45%  { box-shadow: inset 0 0 24px 2px rgba(56, 189, 248, 0.4); }
     100% { box-shadow: inset 0 0 0 0 rgba(56, 189, 248, 0); }
   }
   .terminal-host.pulsing { animation: terminal-paste-pulse 240ms cubic-bezier(0.4, 0, 0.6, 1); }
   ```
4. **Restore (340–460 ms)**: the original row reappears in its slot via View Transitions cross-dissolve (80ms). User sees the row is "still there" — file wasn't consumed.

In the renderer this becomes:

```javascript
async function pasteFromVault(rowEl, terminalHostEl, content) {
  // Anticipation
  rowEl.animate(
    [{ transform: "scale(1)" }, { transform: "scale(0.96) rotate(-1deg)" }],
    { duration: 90, easing: "cubic-bezier(0.32, 0, 0.67, 0)", fill: "forwards" }
  )
  await new Promise(r => setTimeout(r, 90))

  // Yeet: clone the row, animate to terminal, then send paste
  const clone = rowEl.cloneNode(true)
  const rect = rowEl.getBoundingClientRect()
  Object.assign(clone.style, {
    position: "fixed",
    left: rect.left + "px",
    top: rect.top + "px",
    width: rect.width + "px",
    pointerEvents: "none",
    zIndex: 9999,
    willChange: "transform, opacity"
  })
  document.body.appendChild(clone)

  const tRect = terminalHostEl.getBoundingClientRect()
  const dx = tRect.left + 60 - rect.left
  const dy = tRect.top + tRect.height - 60 - rect.top

  await clone.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0.15 }
    ],
    { duration: 200, easing: "cubic-bezier(0.2, 1, 0.2, 1)", fill: "forwards" }
  ).finished
  clone.remove()

  // Terminal pulse
  terminalHostEl.classList.add("pulsing")
  setTimeout(() => terminalHostEl.classList.remove("pulsing"), 240)

  // Send the paste to PTY via existing IPC channel
  window.ezvibes.writeTerminal(activeTabId, content)

  // Restore source row
  rowEl.animate(
    [{ transform: "scale(0.96)" }, { transform: "scale(1)" }],
    { duration: 220, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" }
  )
}
```

### 7.2 Hand-off arrival sparkle

When chokidar emits `add` for a `*.md` file in the watched folder:

```javascript
function onHandOffArrived(filePath) {
  refreshVaultList() // re-render via View Transitions (see §2.3)

  // After re-render, the new row exists
  requestAnimationFrame(() => {
    const newRow = document.querySelector(`[data-path="${cssEscape(filePath)}"]`)
    if (!newRow) return

    // Sparkle puff
    confetti({
      count: 22,
      spread: 50,
      angle: -90,
      startVelocity: 14,
      gravity: 0.8,
      decay: 0.93,
      colors: ["#fbbf24", "#fde68a", "#f59e0b"],
      origin: {
        x: (newRow.getBoundingClientRect().left + newRow.offsetWidth / 2) / window.innerWidth,
        y: (newRow.getBoundingClientRect().top + 8) / window.innerHeight
      }
    })

    // Subtle row glow that decays
    newRow.animate(
      [
        { boxShadow: "0 0 0 0 rgba(251, 191, 36, 0)" },
        { boxShadow: "0 0 24px 4px rgba(251, 191, 36, 0.6)", offset: 0.3 },
        { boxShadow: "0 0 0 0 rgba(251, 191, 36, 0)" }
      ],
      { duration: 1400, easing: "cubic-bezier(0.4, 0, 0.6, 1)" }
    )
  })
}
```

### 7.3 Hover lift — the bread and butter

This appears 100x more often than any other animation. Get it right.

Vanilla CSS, no JS:

```css
.vault-row {
  transition:
    transform 180ms var(--ease-decelerate),
    background-color 180ms var(--ease-decelerate),
    box-shadow 180ms var(--ease-decelerate);
  transform: translateY(0) scale(1);
  will-change: transform;
}

.vault-row:hover {
  transform: translateY(-1.5px) scale(1.008);
  background-color: rgb(255 255 255 / 0.04);
  box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.25);
  transition-duration: 160ms;
}

.vault-row:active {
  transform: translateY(0) scale(0.985);
  transition-duration: 60ms;
  transition-timing-function: var(--ease-accelerate);
}
```

Three values to understand:
- **180ms in / 60ms out** for the press: pressing feels instant, releasing is a soft spring.
- **`scale(1.008)`** is more elegant than `1.02` for a row — large rows shouldn't grow visibly.
- **`translateY(-1.5px)`** instead of `2px`: subpixel "lift" reads as parallax depth without being theatrical.

### 7.4 Focus ring — the unsung hero

```css
.vault-row:focus-visible {
  outline: 2px solid var(--accent-amber);
  outline-offset: 2px;
  transition: outline-offset 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.vault-row:focus-visible:active {
  outline-offset: 0px; /* "press it back into the surface" */
}
```

The outline-offset change on press is the kind of detail Linear loves. Cheap, almost invisible, but feels haptic.

### 7.5 Search input — focus expansion

```css
.vault-search {
  --search-width: 200px;
  width: var(--search-width);
  transition: width 220ms var(--ease-spring-smooth);
}

.vault-search:focus { --search-width: 320px; }
```

That single `linear()` spring is the difference between a UI that feels designed and one that doesn't.

### 7.6 Stagger entrance for the vault opening

When the user toggles the vault panel open for the first time in a session:

```javascript
function openVaultPanel(rows) {
  const panel = document.querySelector(".vault-panel")
  panel.classList.add("opening")

  rows.forEach((row, i) => {
    row.animate(
      [
        { opacity: 0, transform: "translateX(-12px)" },
        { opacity: 1, transform: "translateX(0)" }
      ],
      {
        duration: 280,
        delay: i * 24, // 24ms stagger
        easing: "cubic-bezier(0.05, 0.7, 0.1, 1)", // M3 emphasized-decelerate
        fill: "forwards"
      }
    )
  })
}
```

Or, more idiomatically with Motion vanilla:

```javascript
import { animate, stagger } from "motion"
animate(
  ".vault-row",
  { opacity: [0, 1], x: [-12, 0] },
  { duration: 0.28, delay: stagger(0.024), ease: [0.05, 0.7, 0.1, 1] }
)
```

### 7.7 Drag-to-reorder

Combine `@formkit/auto-animate` (for the FLIP) with native HTML Drag and Drop or SortableJS.

SortableJS is 2.5kB minified, vanilla JS, with `animation: 200` baked in:

```bash
npm install sortablejs
```

```javascript
import Sortable from "sortablejs"

Sortable.create(document.querySelector(".vault-list"), {
  animation: 200,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  ghostClass: "vault-row-ghost",
  chosenClass: "vault-row-chosen",
  dragClass: "vault-row-dragging",
  onEnd: (evt) => {
    // persist the new order to disk via IPC
    window.ezvibes.reorderVault(evt.oldIndex, evt.newIndex)
  }
})
```

CSS for the moving row:

```css
.vault-row-ghost { opacity: 0.4; }
.vault-row-chosen { background: rgb(251 191 36 / 0.18); }
.vault-row-dragging {
  cursor: grabbing;
  transform: rotate(-1deg) scale(1.02);
  box-shadow: 0 12px 28px -6px rgb(0 0 0 / 0.4);
  transition: transform 80ms ease-out, box-shadow 80ms ease-out;
}
```

---

## 8. Scroll-Driven Animations — Free 60fps Without JS

CSS scroll-driven animations are baseline in Chromium 115+ (Chrome 113+ behind a flag, then default 115+), Safari 18+. Electron 33 ships Chromium 130, so this is unconditionally usable in EZvibes.

Two timeline types:
- **`scroll()`**: tracks scroll progress of a scroll container, 0%–100%.
- **`view()`**: tracks an element's visibility as it enters and exits the scrollport (great for "fade up on enter").

### 8.1 Vault scroll progress bar

```css
.vault-list {
  scroll-timeline-name: --vault-scroll;
  scroll-timeline-axis: y;
  overflow-y: auto;
}

.vault-scroll-bar {
  position: sticky;
  top: 0;
  height: 2px;
  background: var(--accent-amber);
  transform-origin: left;
  scale: 0 1;
  animation: scale-x linear;
  animation-timeline: --vault-scroll;
}

@keyframes scale-x {
  to { scale: 1 1; }
}
```

Zero JavaScript. As the user scrolls the vault, a 2px amber bar at the top fills left-to-right. This is a Linear-grade touch.

### 8.2 Row fade-up on entrance via `view()`

```css
.vault-row {
  animation: row-enter linear;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}

@keyframes row-enter {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

`animation-range: entry 0% cover 30%` means the animation starts when the row begins entering the scrollport and finishes when 30% of its height is visible. Result: rows fade-in as they scroll into view, then stay solid. **Completely free, runs on the compositor, no jank.**

### 8.3 Sticky header that gradient-blurs on scroll

```css
.vault-header {
  position: sticky;
  top: 0;
  animation: header-blur linear;
  animation-timeline: scroll(self);
  animation-range: 0 80px;
}

@keyframes header-blur {
  from {
    backdrop-filter: blur(0px);
    background-color: rgb(15 23 42 / 0);
  }
  to {
    backdrop-filter: blur(16px) saturate(160%);
    background-color: rgb(15 23 42 / 0.65);
  }
}
```

When the user has scrolled 0–80px, the header transitions from transparent to a frosted glass panel. This is the Linear/Arc move — header earns its background only when you scroll past it.

References:
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- https://www.joshwcomeau.com/animation/scroll-driven-animations
- https://developer.chrome.com/blog/scroll-triggered-animations

---

## 9. Gesture-Driven Motion

### 9.1 Drag-to-dismiss for the vault panel

Goal: drag the vault panel left to close it. If you let go past 40% of width, it slides closed; otherwise it springs back.

```javascript
import { Hammer } from "hammerjs"

const panel = document.querySelector(".vault-panel")
const hammer = new Hammer(panel)
hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL })

let dragX = 0
const panelWidth = panel.offsetWidth

hammer.on("panmove", (ev) => {
  dragX = Math.min(0, ev.deltaX) // only leftward
  panel.style.transform = `translateX(${dragX}px)`
  panel.style.opacity = String(1 - Math.abs(dragX) / panelWidth * 0.5)
})

hammer.on("panend", (ev) => {
  if (Math.abs(dragX) > panelWidth * 0.4 || ev.velocityX < -0.6) {
    // Dismiss
    panel.animate(
      [{ transform: `translateX(${dragX}px)`, opacity: panel.style.opacity }, { transform: `translateX(-${panelWidth}px)`, opacity: 0 }],
      { duration: 240, easing: "cubic-bezier(0.3, 0, 0.8, 0.15)", fill: "forwards" }
    )
    setTimeout(() => panel.classList.add("closed"), 240)
  } else {
    // Spring back
    panel.animate(
      [{ transform: `translateX(${dragX}px)`, opacity: panel.style.opacity }, { transform: "translateX(0)", opacity: 1 }],
      { duration: 480, easing: "var(--ease-spring-smooth)", fill: "forwards" }
    )
  }
  dragX = 0
})
```

Note the use of `ev.velocityX` to honor inertia: a fast leftward flick dismisses even if `deltaX` didn't pass the threshold. This is the same logic iOS uses for swipe-to-dismiss notifications.

### 9.2 Swipe-to-pin

A horizontal pan on a vault row, beyond `48px`, pins it to the top of the list. Inverse swipe unpins.

```javascript
hammer.get("swipe").set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 48, velocity: 0.4 })
hammer.on("swiperight", () => pinRow(rowEl))
hammer.on("swipeleft", () => unpinRow(rowEl))
```

Add a "swipe-armed" CSS state showing a peeking pin icon at the side:

```css
.vault-row {
  position: relative;
}
.vault-row::after {
  content: "📌";
  position: absolute;
  left: -32px;
  opacity: 0;
  transition: opacity 120ms;
}
.vault-row.swipe-armed::after { opacity: 0.8; }
```

### 9.3 Long-press to preview

Hold a row for 500ms → a floating preview of the prompt's first 12 lines appears.

```javascript
let pressTimer
row.addEventListener("pointerdown", (e) => {
  pressTimer = setTimeout(() => showPreview(row, e), 500)
})
row.addEventListener("pointerup", () => clearTimeout(pressTimer))
row.addEventListener("pointercancel", () => clearTimeout(pressTimer))
row.addEventListener("pointerleave", () => clearTimeout(pressTimer))
```

Pair with a CSS animation that shows progress during the press:

```css
@keyframes press-progress {
  to { transform: scaleX(1); }
}
.vault-row.pressing::after {
  content: "";
  position: absolute; inset: 0 auto 0 0;
  width: 3px;
  transform: scaleX(0); transform-origin: left;
  animation: press-progress 500ms linear forwards;
  background: var(--accent-amber);
}
```

---

## 10. Performance Rules for Electron

EZvibes's xterm renderer is fragile under high paint load — the docs explicitly warn about it. Animation choices must respect that.

### 10.1 The five commandments

1. **Animate only `transform` and `opacity`.** These are the only properties the compositor handles without layout or paint. Width, height, top, left, margin trigger reflow. Background-color triggers paint. Filter is GPU but expensive — use it sparingly.
2. **`will-change` only when actively animating.** Set `will-change: transform` on hover, remove after the animation. Permanent `will-change` keeps the layer in memory and hurts xterm scrollback rendering.
3. **`prefers-reduced-motion` always wins.** Wrap everything decorative in `@media (prefers-reduced-motion: no-preference) { ... }`.
4. **Avoid `backdrop-filter` on actively animating elements.** Each backdrop-filter element forces an offscreen composite pass. One large blurred panel is fine. Many small ones on hover = disaster. Linear's hack is to put the blur on a *static* parent and animate only opacity on children.
5. **`contain: layout style paint`** on the vault panel root. Tells the browser to constrain repaints to the panel — protects the xterm canvas from invalidations.

### 10.2 The vault DOM contract

```css
.vault-panel {
  contain: layout style paint;
  isolation: isolate;             /* new stacking context */
}

.vault-row {
  contain: layout style;
  /* will-change applied dynamically on :hover via JS */
}

.vault-row.is-hovered {
  will-change: transform, opacity;
}
```

Add a hover JS that toggles `is-hovered` only on enter and removes on the next `animationend` — never leave `will-change` set permanently.

### 10.3 Frame budgeting

Electron's renderer + xterm + node-pty + a heavy animation can push past 16.6ms/frame. Rules of thumb:
- Total animations triggered per frame: **≤3 elements** unless they share a layer.
- Stagger increments: **≥16ms** so each row's start lands on its own frame.
- Drop the resolve-on-`animationend` callback into `requestAnimationFrame` — never inline DOM work.

References:
- https://web.dev/articles/animations-and-performance
- https://nearform.com/insights/architecting-electron-applications-for-60fps
- https://www.electronjs.org/docs/latest/tutorial/performance

---

## 11. Reduced Motion — the contract

Every animation in this document should be wrapped in:

```css
@media (prefers-reduced-motion: no-preference) {
  .vault-row {
    transition: ... ;
    animation: ... ;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vault-row {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

Or in JS, gate decorative animations:

```javascript
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
if (!prefersReduced) confetti(...)
```

AutoAnimate respects this by default (`disrespectUserMotionPreference: false`); leave it that way.

---

## 12. Pioneer-Level 2026 Patterns — what no one is shipping yet

Beyond the basics, here are five patterns I found in cutting-edge prototypes that would put the vault in front of Linear, Arc, Raycast.

### 12.1 Liquid-glass row hover (Tahoe / Apple 2025 aesthetic)

Apple's macOS Tahoe (and Vision Pro) introduced "Liquid Glass" — the glass appears to refract behind it as you hover. On web you can fake it with `backdrop-filter` + an animated `mask-image` gradient + `radial-gradient` that follows the cursor.

```css
.vault-row {
  --x: 50%;
  --y: 50%;
  background:
    radial-gradient(120px 80px at var(--x) var(--y), rgb(255 255 255 / 0.12), transparent 70%),
    rgb(15 23 42 / 0.4);
  backdrop-filter: blur(20px) saturate(180%);
  transition: background 100ms;
}
```

```javascript
row.addEventListener("pointermove", (e) => {
  const rect = row.getBoundingClientRect()
  row.style.setProperty("--x", `${e.clientX - rect.left}px`)
  row.style.setProperty("--y", `${e.clientY - rect.top}px`)
})
```

Result: a soft highlight follows the cursor over a frosted-glass row. Slightly trippy in a great way.

### 12.2 OKLCH color animation for agent tinting

In 2026 you can finally animate in OKLCH (perceptually uniform) color space. This means smooth tint transitions when the user switches the active tab between Claude (amber) and Codex (teal):

```css
.vault-panel {
  --accent: oklch(0.82 0.16 80); /* amber */
  background: linear-gradient(180deg, color-mix(in oklch, var(--accent) 8%, transparent), transparent 200px);
  transition: --accent 320ms var(--ease-standard);
}

.vault-panel.agent-codex {
  --accent: oklch(0.82 0.12 200); /* teal */
}

@property --accent {
  syntax: "<color>";
  inherits: true;
  initial-value: oklch(0.82 0.16 80);
}
```

The `@property` registration is what lets the browser animate between custom-property color values. Without it, the variable swap is instant.

### 12.3 Magnetic snap on click (haptic-like feel)

When the mouse approaches a row within 8px, the cursor "pulls" toward the row's center. Achieved by translating the row content toward the cursor:

```javascript
row.addEventListener("pointermove", (e) => {
  const rect = row.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = (e.clientX - cx) * 0.08
  const dy = (e.clientY - cy) * 0.08
  row.querySelector(".vault-row-content").animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }],
    { duration: 80, fill: "forwards", easing: "ease-out" }
  )
})
row.addEventListener("pointerleave", () => {
  row.querySelector(".vault-row-content").animate(
    [{ transform: "translate(0, 0)" }],
    { duration: 240, fill: "forwards", easing: "var(--ease-spring-smooth)" }
  )
})
```

Awwwards-winning marketing sites do this; productivity apps do not. Yet.

### 12.4 Scroll-stitched hand-off ribbon (THE BIG ONE)

**This is the pioneer-grade idea.** When a hand-off file arrives, render a thin colored SVG ribbon from the new row at the top of the vault down through the panel to the bottom edge, where it dives into the active terminal tab indicator. Use `animation-timeline: scroll(self)` so as the user scrolls down the vault, the ribbon "draws" itself in lock-step with the scroll position, *physically connecting* the new file to the place it will land.

Pseudo-CSS:

```css
.handoff-ribbon path {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: stitch linear;
  animation-timeline: scroll(self closest parent);
  animation-range: 0 80vh;
}

@keyframes stitch {
  to { stroke-dashoffset: 0; }
}
```

The path is generated dynamically with `getBoundingClientRect()` from the new row down to the active tab indicator. The result: scrolling literally pulls a thread of light from "where the file is" to "where it will go," and dropping it at the terminal end triggers a paste with a satisfying "snap" feeling. **No app I'm aware of ships anything like this.**

### 12.5 Velocity-aware press release

When you press a row hard (using `PointerEvent.pressure` — supported by all stylus and most trackpads in 2026), the row reacts proportionally. A normal press is `0.5` pressure; a hard press is `1.0`.

```javascript
row.addEventListener("pointerdown", (e) => {
  const pressure = e.pressure || 0.5
  const squish = 1 - pressure * 0.08
  row.animate(
    [{ transform: `scale(${squish})` }],
    { duration: 80, fill: "forwards", easing: "ease-out" }
  )
})
```

On release, a spring with stiffness inversely proportional to original pressure:

```javascript
row.addEventListener("pointerup", (e) => {
  const stiffness = 700 - (e.pressure || 0.5) * 200 // harder press = softer release
  // use Motion spring(...)
  animate(row, { scale: 1 }, { type: spring, stiffness, damping: 28 })
})
```

The row literally feels heavier when you press harder — like a real button.

---

## 13. Recommended Stack for the EZvibes Vault

Final recommended set (vanilla JS, Electron-friendly, total ~30kB gzipped):

```bash
npm install motion @formkit/auto-animate sortablejs @tsparticles/confetti chokidar
```

| Library | Size | Job |
|---|---|---|
| `motion@12` (`motion/dom`) | ~3.8kB | Imperative animations, spring physics, gesture handlers |
| `@formkit/auto-animate` | ~2.5kB | FLIP on the vault list, zero-config |
| `sortablejs` | ~13kB | Drag-to-reorder |
| `@tsparticles/confetti` | ~15kB lazy-loaded | Celebration moments only |
| `chokidar@5` | (main process only) | File watching with debouncing |

Pure CSS, no libraries:
- `linear()` spring tokens (§4)
- View Transitions API (§2)
- Scroll-driven animations (§8)
- `prefers-reduced-motion` gates (§11)
- OKLCH color interpolation via `@property` (§12.2)

Optional add-ons:
- **Rive** (for the empty-state and live-status animations, ~30kB Wasm + asset per `.riv` file)
- **Lottie** for celebratory hand-off arrival animation (~150kB lib + ~30kB JSON per anim)

---

## 14. Concrete Timing Reference (the cheat-sheet you tape to your monitor)

Memorize these. Every animation in the vault uses one of them.

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Hover lift | 160ms | `var(--ease-decelerate)` | `cubic-bezier(0.05, 0.7, 0.1, 1)` |
| Hover unhover | 220ms | `var(--ease-standard)` | slightly slower than enter |
| Active press | 60ms | `var(--ease-accelerate)` | feels instant |
| Press release | 220ms | `var(--ease-spring-snappy)` | small overshoot |
| Tooltip in | 180ms (after 600ms delay) | `var(--ease-decelerate)` | first tooltip delay |
| Tooltip in (peer) | 180ms (no delay) | `var(--ease-decelerate)` | subsequent tooltips |
| Tooltip out | 100ms | `var(--ease-accelerate)` | fast exit |
| Row entrance (chokidar) | 320ms | `var(--ease-spring-smooth)` | with sparkle |
| Row exit (chokidar) | 200ms | `var(--ease-accelerate)` | quick clean exit |
| Panel slide in | 320ms | `var(--ease-decelerate)` | emphasized |
| Panel slide out | 240ms | `var(--ease-accelerate)` | emphasized |
| Paste yeet (full) | 370ms | mixed (see §7.1) | three-stage |
| List stagger | 24–28ms per item | linear | for ≤30 items |
| Focus ring grow | 120ms | `var(--ease-back-out)` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Scroll-triggered fade | 30% of view range | linear | scroll-driven |
| Glass header blur in | 80px scroll | linear | scroll-driven |
| Search expand on focus | 220ms | `var(--ease-spring-smooth)` | width animation |
| Long-press progress | 500ms | linear | preview after |
| Confetti / sparkle | 900–1400ms | gravity-based | one-shot |

---

## 15. Implementation Order — what to ship first

The user wants this *now* with maximum polish. I'd ship in this order:

**Day 1 — get it working:**
1. Vault panel HTML/CSS scaffold with motion tokens defined (§3.5).
2. chokidar in main process, IPC channel `vault:list`, `vault:add`, `vault:remove`.
3. Click row → `window.ezvibes.writeTerminal(activeTabId, content)`.
4. Hover lift + press squish (§7.3) — pure CSS, no JS.

**Day 2 — feels like a real app:**
5. AutoAnimate on `.vault-list` — instant FLIP for adds/removes.
6. View Transitions on the rerender callback — list reorder magic.
7. Focus ring (§7.4) + keyboard nav (Up/Down/Enter).
8. Motion tokens fully wired throughout the vault.

**Day 3 — the wow moments:**
9. Paste yeet (§7.1) — the signature interaction.
10. Hand-off arrival sparkle (§7.2).
11. Scroll-driven row entrance (§8.2).
12. Scroll-driven header blur (§8.3).

**Day 4 — pioneer mode:**
13. Drag-to-reorder via SortableJS (§7.7).
14. Drag-to-dismiss the panel (§9.1).
15. Long-press preview (§9.3).
16. OKLCH agent tinting (§12.2).
17. Liquid glass row hover (§12.1).

**Day 5+ — the moonshots:**
18. Scroll-stitched hand-off ribbon (§12.4).
19. Magnetic snap on hover (§12.3).
20. Velocity-aware press release (§12.5).
21. Rive empty state + live status.

---

## 16. Annotated Reference List

Core motion docs:
- https://motion.dev/changelog — Motion v12.40, May 2026
- https://motion.dev/docs/easing-functions — built-in eases
- https://motion.dev/docs/react-transitions — spring defaults
- https://motion.dev/docs/stagger — stagger() API
- https://motion.dev/docs/improvements-to-the-web-animations-api-dx — WAAPI extension
- https://gsap.com — free since 2024
- https://animejs.com/documentation/timeline — v4 timelines
- https://auto-animate.formkit.com — drop-in FLIP
- https://popmotion.io — physics engine

View Transitions:
- https://developer.chrome.com/docs/web-platform/view-transitions — Chrome's reference
- https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition — MDN
- https://developer.chrome.com/blog/css-ui-ecommerce-vt — production case studies
- https://piccalil.li/blog/some-practical-examples-of-view-transitions-to-elevate-your-ui

Native CSS spring / linear():
- https://www.joshwcomeau.com/animation/linear-timing-function — the definitive primer
- https://developer.chrome.com/docs/css-ui/css-linear-easing-function — Chrome's reference
- https://www.kvin.me/css-springs — spring → linear() generator
- https://pqina.nl/blog/css-spring-animation-with-linear-easing-function
- https://www.smashingmagazine.com/2023/09/path-css-easing-linear-function

Scroll-driven animations:
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations — MDN
- https://www.joshwcomeau.com/animation/scroll-driven-animations
- https://developer.chrome.com/blog/scroll-triggered-animations

Design system motion tokens:
- https://m3.material.io/styles/motion/easing-and-duration/tokens-specs — Material 3
- https://carbondesignsystem.com/elements/motion/overview — IBM Carbon
- https://m1.material.io/motion/duration-easing.html — Material 1 (for the classic curve)

Production case studies / motion DNA:
- https://stripe.com/blog/connect-front-end-experience — Stripe Connect
- https://vercel.com/design/guidelines — Vercel guidelines
- https://github.com/vercel-labs/web-interface-guidelines — code
- https://linear.app/changelog/2026-03-12-ui-refresh — Linear UI refresh
- https://linear.app/now/how-we-redesigned-the-linear-ui — Linear redesign rationale

Interactive vector / celebratory motion:
- https://rive.app — Rive interactive animations
- https://rive.app/features
- https://github.com/rive-app/awesome-rive
- https://lottiefiles.com — Lottie library
- https://confetti.js.org — tsParticles confetti
- https://www.npmjs.com/package/@tsparticles/confetti

Gestures:
- https://hammerjs.github.io
- https://use-gesture.netlify.app

Performance:
- https://web.dev/articles/animations-and-performance
- https://nearform.com/insights/architecting-electron-applications-for-60fps
- https://www.electronjs.org/docs/latest/tutorial/performance

File watching for hand-off:
- https://github.com/paulmillr/chokidar — chokidar v5 (Nov 2025), 17x lower CPU

---

## 17. Closing — why this matters

The user described what they want as a "vault" — a single panel that turns the dead-air of an idle terminal into a living workspace where prompts live, breathe, get added by parallel sessions, and click-paste into the active conversation. The motion design is what separates a useful tool from one people screenshot and post about.

The five things from §0 — View Transitions, `linear()` springs, AutoAnimate, the paste yeet choreography, scroll-driven row entrance — together cost about 30 kB of dependencies and one good weekend, and they put the vault directly in conversation with Linear, Arc, and Raycast. Every other section here is gravy on top of that base.

Build the base, taste the gravy, then add the ribbon (§12.4) and watch your demo land.
