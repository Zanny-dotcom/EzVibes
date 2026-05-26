# Research Agent #5 — Spatial UI / visionOS-Inspired Layered Depth in 2D Apps (2025–2026)

> **Brief recap:** Agent #5 of 30. Topic: How visionOS aesthetics — depth, layered glass, parallax, floating panels — have invaded flat 2D Windows/macOS apps in 2025–2026, and exactly what code/CSS/libraries the EZvibes "prompt vault" panel can borrow to feel pioneer-level cool.
>
> Output: maximum-detail dump for the orchestrator. Concrete pixel values, install commands, sample snippets, named production apps.

---

## 0. Why this matters for the prompt vault

The user wants a panel that slides over an Electron terminal session and lists `.md` / hand-off prompts. The clicked file pastes into the active xterm tab. Visually, the user already drew a dark "vault" sidebar in MS Paint — that is the seed. The 2025–2026 design wave gives us the language to push that vault past "just a sidebar" into a **floating, glass, depth-aware layer that hovers in front of the terminal as if it were a Vision Pro window pinned over a real workspace**.

Three pillars of the look this research recommends:

1. **Liquid Glass** — Apple's WWDC25 material. Translucent + refractive + specular highlight on the rim, *with the terminal text bending around the edges* of the vault.
2. **visionOS depth layering** — windows cast soft shadows on the layer behind, the layer-behind blurs and dims when the panel takes focus, the panel itself bobs subtly in idle state like a hovering Vision Pro window.
3. **Pointer-tracked parallax** — Apple-keynote choreography. When the mouse moves, the panel and its inner list tilt 3–8° on a `transform: rotateX/Y` rig, with `transform-style: preserve-3d` cascading depth to each `.md` chip.

Combined, the vault stops looking like a sidebar and starts looking like a piece of Vision Pro furniture floating in front of your terminal.

---

## 1. The 2025 design epoch — what changed

### 1.1 WWDC25 (June 9, 2025): Apple unveils Liquid Glass

Apple announced **Liquid Glass** as a unified design language across iOS 26, iPadOS 26, **macOS Tahoe 26**, watchOS 26, and tvOS 26. It is described as "the biggest visual redesign since iOS 7 (2013)."

Core properties from the Apple press release and Wikipedia:

- Material is **translucent and reflects + refracts its surroundings**.
- It is a **dynamic material system that mimics real glass** — translucency, refraction, depth, motion responsiveness.
- It intelligently adapts to content, light, and interaction.
- "Instead of flattening interfaces, Liquid Glass creates hierarchy and focus, ensuring content remains primary while interface controls visually recede."
- On the Home Screen and desktop, the Dock, app icons, and widgets are crafted from **multiple layers of Liquid Glass** with **specular highlights**.
- macOS Tahoe added a fully **transparent menu bar** to make the display feel larger.
- Controls now use **concentric corner radii** — a control's corner radius adapts to its parent (parent radius minus padding).

### 1.2 The six visionOS-inspired elements that fell down to iOS 26 (and apply to any 2D app)

MacRumors (May 30, 2025) catalogued the six visionOS borrowings explicitly. These are the **design grammar** any 2D app — Electron included — can mimic:

1. **Translucent / frosted-glass surfaces** that let context bleed through.
2. **Floating navigation bars and menus** elevated over content via subtle shadow + blur, rather than docked to edges.
3. **Round / pill-shaped buttons and interface elements** — more dramatic rounding than the old squircle.
4. **Top-aligned toolbars** (visionOS pushes chrome up, away from thumbs/hands).
5. **Subtle lighting + shadow effects that shift with device motion** — on iPhone via accelerometer; on desktop, via mouse position.
6. **Simplified, airier layouts** with extra spacing to accommodate gaze + spatial cognition.

### 1.3 Glassmorphism's full revival in 2026

Multiple 2026 trend reports converge on the same story: glassmorphism died around 2021–2022 (perf + contrast issues), but Apple's Liquid Glass dragged it back into mainstream design. The 2026 take is **smarter, more restrained, more functional**:

- Apply glass to overlays, floating cards, modal panels — **not** to baseline content surfaces.
- Detect system-level accessibility settings (reduce transparency, reduce motion) and auto-swap to solid high-contrast surfaces.
- Pair with **dark mode** ("Dark Glassmorphism" is the de facto 2026 default — much higher contrast than 2021 light-mode glass).
- Use **soft floating shadows + layered depth** for tangible feel without skeuomorphic weight.

### 1.4 The Apple Vision Pro spatial design playbook applied to 2D

The "Solid Interfaces for visionOS" framework introduces concepts that translate cleanly to a desktop terminal app:

- **Allocentric anchoring** — instead of egocentric (left/right of viewport), pin widgets to world features. In a 2D terminal app, that means: pin the vault to the **session window's edge** semantically, not floating relative to mouse.
- **Cognitive tensegrity** — three tensions hold a layout together. Strong (≤15 cm equivalent — paired elements share working memory), Medium (30–60° contextual support sector), Weak (peripheral ambient). The vault's filename + "paste" button are Strong; the tab strip is Medium; the terminal text is Weak ambient.
- **Hover effects** — visionOS popularizes **gaze-driven hover transforms**. In 2D this becomes mouse-driven hover that grows + highlights + raises Z. The hover state must transition smoothly back on un-hover (visionOS animates clip / opacity back to inactive).
- **Translucent windows that become more transparent during interaction** — Vision Pro lowers a window's alpha while you drag it. The vault could do the same while you scroll, to let terminal context show through.

---

## 2. Liquid Glass in CSS — concrete recipes

Apple's Liquid Glass is fundamentally three layered effects:

1. **Backdrop blur + saturation boost** — frosting + vibrancy.
2. **SVG `feDisplacementMap` refraction** — pixels behind the rim warp like real curved glass.
3. **Specular highlight** — bright rim where light hits the curved edge.

Only Chromium-based browsers (which includes Electron) currently render SVG-filter `backdrop-filter` correctly. **This is a huge win for an Electron app** — Firefox/Safari compat is irrelevant inside a packaged Electron renderer.

### 2.1 Minimal "frosted glass" baseline (works everywhere)

```css
.vault-panel {
  background: hsl(220 18% 8% / 0.55);            /* dark tint */
  backdrop-filter: blur(24px) saturate(180%) brightness(0.9);
  -webkit-backdrop-filter: blur(24px) saturate(180%) brightness(0.9);
  border: 1px solid hsl(0 0% 100% / 0.08);
  border-radius: 20px;                           /* round corners */
  box-shadow:
    0 30px 60px -20px hsl(0 0% 0% / 0.6),        /* deep cast */
    0 8px 20px -10px hsl(0 0% 0% / 0.4),         /* near cast */
    inset 0 1px 0 hsl(0 0% 100% / 0.15);         /* top rim light */
}
```

Numeric reasoning:
- `blur(24px)` — the 2026 sweet spot per design-trend articles. Below 12px looks dirty; above 40px starves perf.
- `saturate(180%)` — required because heavy blur desaturates. Apple's Liquid Glass uses ~140–200% saturation.
- `brightness(0.9)` — Comeau's "next-level frosted glass" trick: pull brightness down slightly so the glass reads as a layer, not a window.
- Inset top rim — fake specular. The `inset 0 1px 0 white 15%` line is the cheapest possible top-edge glint.

### 2.2 Liquid Glass with displacement refraction (Chromium / Electron only)

Source: [kube.io's "Liquid Glass in the Browser" deep-dive](https://kube.io/blog/liquid-glass-css-svg/) and [ekino-france's "Liquid Glass in CSS (and SVG)"](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d).

```html
<!-- Inline SVG hosting the filter; display:none so it doesn't render -->
<svg style="display:none">
  <defs>
    <filter id="liquid-glass" colorInterpolationFilters="sRGB">
      <!-- 1. Blur the source slightly -->
      <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blurred"/>

      <!-- 2. Pull in a precomputed displacement map (PNG). 
              Red channel = X offset, Green = Y offset, blue ignored.
              128/128 = no displacement. -->
      <feImage href="/img/disp-map-300x56.png" x="0" y="0"
               width="300" height="56" result="dispMap"/>

      <!-- 3. Warp pixels behind the rim -->
      <feDisplacementMap in="blurred" in2="dispMap" scale="55"
                         xChannelSelector="R" yChannelSelector="G"
                         result="warped"/>

      <!-- 4. Boost color saturation post-warp -->
      <feColorMatrix in="warped" type="saturate" values="1.5" result="warpedSat"/>

      <!-- 5. Specular layer (a rim-light PNG) -->
      <feImage href="/img/specular.png" x="0" y="0"
               width="300" height="56" result="spec"/>
      <feGaussianBlur in="spec" stdDeviation="1" result="specBlur"/>

      <!-- 6. Blend rim on top of warped content -->
      <feBlend in="specBlur" in2="warpedSat" mode="screen"/>
    </filter>
  </defs>
</svg>

<div class="vault-panel" style="backdrop-filter: url(#liquid-glass);"></div>
```

Channel-map crash course (from kube.io):
- `0x00` → maximum negative X/Y shift
- `0x80` (128) → zero shift — neutral grey is "no warp"
- `0xFF` → maximum positive shift
- The displacement map is precomputed once: a **convex squircle profile** like Apple's, generated from `y = ⁴√(1 − (1−x)⁴)`. Convex squircle keeps the warp smooth even when stretched into rectangles — Apple's preferred curve.

The math (Snell's law, refractive index n=1.5 vs air n=1) is well-tabulated, and the displacement map only needs to be regenerated when the panel **size** changes. For a fixed-size 300 × 360 vault panel, you bake one PNG, ship it.

### 2.3 The npm shortcuts — `liquid-glass-react`, `@callstack/liquid-glass`, `liquid-css`, `liquid-glass.js`

If you don't want to hand-build SVG filters, the ecosystem already shipped wrappers (mostly in mid-to-late 2025).

| Package | Stack | Notes |
|---|---|---|
| [`liquid-glass-react`](https://github.com/rdev/liquid-glass-react) | React + plain JS | `npm install liquid-glass-react`. Props: `displacementScale=70`, `blurAmount=0.0625`, `saturation=140`, `aberrationIntensity=2`, `elasticity=0.15`, `cornerRadius=999`, `mode: "standard" \| "polar" \| "prominent" \| "shader"`. Has mouse tracking via `mouseContainer` ref. **Safari/Firefox: displacement not visible**, frosted only. |
| [`@callstack/liquid-glass`](https://github.com/callstack/liquid-glass) | React Native | iOS 26+ native. Falls back to opaque View. |
| [`nikdelvin/liquid-glass`](https://github.com/nikdelvin/liquid-glass) | Astro/web | "Pixel-perfect recreation." Anime.js-driven background animation. Auto Safari fallback to glassmorphism. Props: `depth=10`, `strength=100`, `blur`, `chromaticAberration`, `color: "black"\|"white"`, `background`, `freeze`, `button`, `inline`. |
| [`@specy/liquid-glass-react`](https://www.npmjs.com/package/@specy/liquid-glass-react) | Three.js-backed React | Real WebGL refraction, higher fidelity, heavier. |
| [`electrikmilk/liquid-css`](https://github.com/electrikmilk/liquid-css) | Pure CSS, no JS | Just refractive chromatic aberration via CSS only — useful for buttons. |

Because EZvibes is **vanilla JS, no React, no bundler** (per CLAUDE.md cautions), the cleanest path is:

- Use **inline SVG filter + CSS** (Section 2.2) for the vault panel itself.
- Add a precomputed displacement PNG at the panel's exact size (regenerate on resize via canvas if needed, or simpler: lock the panel to a fixed width).
- Reference `liquid-glass-react`'s public source on GitHub as a **parameter cheat sheet** (the prop defaults are battle-tested values).

### 2.4 Chromatic aberration on glass borders

This is the rainbow fringe you see on real glass edges. Adds enormous "pioneer-level" polish.

Two cheap ways:

```css
/* Approach A: three offset coloured drop-shadows */
.vault-rim::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
     0.6px 0   0 hsl(0 100% 60% / 0.35),   /* red shifted right */
    -0.6px 0   0 hsl(220 100% 60% / 0.35); /* blue shifted left */
  filter: blur(0.4px);
}
```

```css
/* Approach B: mix-blend layered text */
.glass-text {
  position: relative;
}
.glass-text::before,
.glass-text::after {
  content: attr(data-text);
  position: absolute; inset: 0;
  mix-blend-mode: screen;
}
.glass-text::before { color: #ff0040; transform: translateX(0.5px); }
.glass-text::after  { color: #0080ff; transform: translateX(-0.5px); }
```

Both run on the compositor (transform + blend) and stay 60 fps.

---

## 3. Floating panels with depth — the macOS / visionOS choreography

### 3.1 The bob (idle hover)

visionOS windows subtly bob to read as "floating, not painted onto a wall." For a 2D app, this is a 6-second sin-wave on `translateY` and `rotateZ`:

```css
@keyframes vault-bob {
  0%   { transform: translateY(0)    rotateZ(0deg); }
  50%  { transform: translateY(-3px) rotateZ(0.15deg); }
  100% { transform: translateY(0)    rotateZ(0deg); }
}
.vault-panel {
  animation: vault-bob 6s ease-in-out infinite;
  will-change: transform;
}
```

Subtle on purpose. Translation 3 px, rotation 0.15°. Anything bigger and it looks like a website hero, not a furniture-grade UI piece.

Respect `prefers-reduced-motion: reduce` — kill the bob with `animation: none`.

### 3.2 Pointer-tracked parallax tilt — the Apple Keynote "hero" move

This is the move that makes a panel feel **alive**. Mouse moves on the parent, panel tilts toward the cursor with a damped spring.

Vanilla JS (no library, drop-in):

```js
const panel = document.querySelector('.vault-panel');
const root  = panel.parentElement;          // tilt container

let targetRX = 0, targetRY = 0;
let currentRX = 0, currentRY = 0;

root.addEventListener('mousemove', (e) => {
  const r = root.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width  - 0.5;   // -0.5 .. 0.5
  const y = (e.clientY - r.top)  / r.height - 0.5;
  targetRY =  x * 10;   // rotate around Y axis on horizontal mouse
  targetRX = -y * 8;    // rotate around X axis on vertical
});

root.addEventListener('mouseleave', () => { targetRX = 0; targetRY = 0; });

function tick() {
  // simple critically-damped spring
  currentRX += (targetRX - currentRX) * 0.08;
  currentRY += (targetRY - currentRY) * 0.08;
  panel.style.transform = `rotateX(${currentRX}deg) rotateY(${currentRY}deg)`;
  requestAnimationFrame(tick);
}
tick();
```

The parent must establish perspective:

```css
.vault-tilt-host {
  perspective: 1200px;        /* depth of the camera; bigger = subtler */
  perspective-origin: 50% 50%;
  transform-style: preserve-3d;
}
.vault-panel {
  transform-style: preserve-3d;
  transition: transform 0.05s linear; /* tiny smoothing, but rAF does the work */
}
```

Why `perspective: 1200px`: David DeSandro's reference + 2026 CSS docs say 200 = aggressive, 1000–1500 = subtle/cinematic. visionOS-style needs subtle.

### 3.3 Z-layered children (Apple keynote-grade)

Once the panel rotates, each child can sit at a different Z depth — the classic Apple keynote slide effect.

```css
.vault-panel .vault-header { transform: translateZ(40px); }
.vault-panel .vault-list   { transform: translateZ(20px); }
.vault-panel .vault-rim    { transform: translateZ(60px); }
.vault-panel .vault-base   { transform: translateZ( 0); }
```

When the panel tilts on `rotateX/Y`, the `translateZ` elements appear to **move at different speeds** — true parallax with zero JS.

**Gotcha (from MDN + Frontend Masters' "Deep Card Conundrum"):** any of these forces flatten and kills the 3D context — `overflow: hidden`, `opacity < 1`, `filter`, `mask`, `clip-path`. So the inner scroll container of the prompt list can NOT have `overflow:hidden` if you want its rows to participate in the 3D tilt. Workarounds:
- Put the scrollable list inside a child that owns `overflow: hidden` but has `transform-style: flat`. Accept that those rows don't parallax.
- Use a `mask-image: linear-gradient(black, transparent)` on a **wrapper** above the panel, not on the panel itself.

### 3.4 Hover-to-raise individual `.md` chips

```css
.prompt-chip {
  transform: translateZ(0);
  transition: transform 240ms cubic-bezier(0.2, 0.9, 0.2, 1),
              box-shadow 240ms ease,
              filter 240ms ease;
  will-change: transform, filter;
}
.prompt-chip:hover {
  transform: translateZ(28px) scale(1.02);
  box-shadow:
    0 12px 24px -10px hsl(0 0% 0% / 0.55),
    0 4px 8px -6px hsl(0 0% 0% / 0.35);
  filter: brightness(1.08);
}
.prompt-chip:hover ~ .prompt-chip,
.prompt-chip:has(~ .prompt-chip:hover) {
  filter: blur(0.5px) brightness(0.85); /* depth-of-field on neighbors */
}
```

That last selector is the **depth-of-field trick**: the focused chip stays sharp, every other chip blurs and dims. It's Apple Studio Photos' "focus on the subject" effect, applied to a prompt list. CSS-only.

### 3.5 Depth-of-field blur on the terminal when the vault opens

When the vault layer slides in, the terminal behind it loses focus:

```css
.session-window.vault-open .terminal-host {
  filter: blur(3px) brightness(0.65) saturate(0.85);
  transform: scale(0.985);
  transition: filter 320ms ease, transform 320ms ease;
}
```

The terminal stays interactive but visually recedes. `brightness(0.65)` darkens it; `saturate(0.85)` desaturates; the slight scale gives it a "stepping back" feel that mirrors visionOS modal dialogs.

---

## 4. The Apple keynote panel-reveal choreography

When Tim opens a panel in a keynote, the sequence is precise. To replicate for the vault slide-in:

1. **Frame 0 (0 ms)** — vault starts at `translateX(40px) rotateY(-20deg) scale(0.92)`, `opacity: 0`, plus `filter: blur(20px)`.
2. **Frame 1 (60 ms)** — terminal starts the recede (blur 0 → 3 px, scale → 0.985).
3. **Frame 2 (180 ms)** — vault settles toward final state: `translateX(0) rotateY(0) scale(1)`, `opacity: 1`, `filter: blur(0)`.
4. **Frame 3 (260 ms)** — top rim specular sweeps left → right via a CSS `background-position` animation (the "polish glint").

Spring values (matched to Things 4 / Apple AppKit):
- Stiffness ≈ 220, damping ≈ 26, mass ≈ 1. In `cubic-bezier` shorthand: `cubic-bezier(0.2, 0.9, 0.1, 1.05)` (small overshoot for "snap into place").
- Total duration **320 ms** for the vault, **240 ms** for the terminal recede. Vault overshoots terminal's recede by 80 ms — feels like the vault "lands" after pushing the terminal back.

The glint sweep:

```css
.vault-panel::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    105deg,
    transparent 30%,
    hsl(0 0% 100% / 0.18) 45%,
    hsl(0 0% 100% / 0.32) 50%,
    hsl(0 0% 100% / 0.18) 55%,
    transparent 70%
  );
  background-size: 250% 100%;
  background-position: 200% 0;
  pointer-events: none;
  mix-blend-mode: screen;
}
.vault-panel.opening::before {
  animation: glint-sweep 700ms cubic-bezier(0.3, 0.8, 0.3, 1) forwards;
}
@keyframes glint-sweep {
  from { background-position: 200% 0; }
  to   { background-position: -50% 0; }
}
```

That one ::before pseudo gives you the "polished glass catching the light" moment.

---

## 5. The Liquid Glass library shortlist — pick one or compose

For the EZvibes context (Electron 33 + vanilla JS, no React), the recommended layering, from cheapest to richest:

### Tier 1 — Pure CSS + one SVG filter

- **What you ship:** Section 2.1 + 2.2 + 2.4 + the bob + the tilt.
- **Size cost:** ~3 KB CSS, one ~6 KB PNG displacement map, ~1 KB JS for the tilt.
- **Browser scope:** Electron's Chromium renders everything fully — refraction, chromatic aberration, the lot.
- **Best for:** Production. No new dependency. Ages well.

### Tier 2 — `liquid-css` (zero-JS pure CSS chromatic aberration)

- **Repo:** [electrikmilk/liquid-css](https://github.com/electrikmilk/liquid-css)
- **What it adds:** Drop-in classes for refractive chromatic-aberration borders. Useful for the "paste" button and individual chips.
- **Size cost:** Tiny. CSS file only.

### Tier 3 — Astro/web `nikdelvin/liquid-glass` source code

- **Repo:** [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)
- **Strategy:** Don't install — read the source, extract the filter SVGs and copy them into `renderer/styles.css`. Astro components are mostly HTML + a sprinkle of CSS so the lift is small.
- **What you gain:** Their displacement map generator is parameterized (depth, strength, blur, chromaticAberration) — re-use the math.

### Tier 4 — `liquid-glass-react` (only if React is ever added)

- Don't add React for this. But if the project ever pivots, the prop API in [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react) is the gold standard. Defaults: `displacementScale=70`, `blurAmount=0.0625`, `saturation=140`, `aberrationIntensity=2`, `elasticity=0.15`. Treat those as the "Apple-correct" baseline.

### Tier 5 — WebGL maximalist — `LiquidGlass.js`

- [CSSScript article](https://www.cssscript.com/webgl-liquid-glass/) — full Three.js refraction, real-time chromatic aberration, multi-light specular. Frame-accurate at 60 fps in Chromium.
- Overkill for a sidebar but spectacular if the vault ever becomes a full overlay.

---

## 6. Electron-specific layering — get the window itself to be glass

To make the vault feel like it belongs in a Vision-Pro-on-Windows session, the **Electron window underneath also benefits** from being translucent. Two options for Windows 11:

### 6.1 `mica-electron` — Mica + Acrylic on frameless windows

- **Repo:** [GregVido/mica-electron](https://github.com/GregVido/mica-electron)
- Wraps `BrowserWindow` to set `DWMWA_SYSTEMBACKDROP_TYPE` to Mica / Acrylic / Mica Alt / Tabbed.
- Mica = samples the wallpaper once, very cheap (long-lived apps).
- Acrylic = real-time Gaussian blur of what's behind, costlier but matches visionOS most closely.

```js
// main.js — Mica example
const { MicaBrowserWindow } = require('mica-electron');

const win = new MicaBrowserWindow({
  width: 1200, height: 800,
  show: false,
  frame: false,
  transparent: true,
  webPreferences: { preload, contextIsolation: true, nodeIntegration: false },
});

win.setMicaEffect();          // or win.setMicaTabbedEffect()
win.setAutoTheme();           // honour Windows dark/light
```

### 6.2 Electron 33's native `backgroundMaterial`

Electron 32+ supports this directly:

```js
new BrowserWindow({
  width: 1200, height: 800,
  backgroundMaterial: 'mica',      // 'auto' | 'none' | 'mica' | 'acrylic' | 'tabbed'
  transparent: true,
  frame: false,
});
```

There is a long-standing Electron bug ([electron#46753](https://github.com/electron/electron/issues/46753), [electron#39529](https://github.com/electron/electron/issues/39529)) where **Mica + `backdrop-filter: blur()` inside the renderer** conflict — text rendering gets inconsistent. Resolution: either use Mica on the window and **no** `backdrop-filter` on the vault (the window itself provides the blur), **or** use a fully opaque window and use `backdrop-filter` in CSS.

For the prompt vault overlaying a terminal that lives inside the same Electron window, you almost always want option B: opaque/dark window, CSS `backdrop-filter` on the vault. The vault blurs the *terminal* behind it, which is what you want — you don't want it to blur the user's desktop.

### 6.3 macOS — `vibrancy` + `visualEffectState`

If the project ever ships on macOS:

```js
new BrowserWindow({
  vibrancy: 'under-window',        // others: 'sidebar', 'hud', 'fullscreen-ui', 'header'
  visualEffectState: 'active',     // 'followsWindowActiveState' | 'active' | 'inactive'
  transparent: true,
  frame: false,
});
```

Per [electron#19765](https://github.com/electron/electron/issues/19765), don't combine vibrancy with renderer-side `backdrop-filter` — same conflict.

---

## 7. Real production apps doing this in 2026 — name-and-shame

Apps confirmed to ship visionOS-influenced layered-depth design in production right now:

1. **macOS Tahoe / iOS 26 system UI** itself — every Apple first-party app got Liquid Glass: Music, Messages, Photos, Reminders, Calendar, Maps. Toolbars and sidebars float, sidebars are translucent, controls have specular highlights.
2. **Apple Creator Studio (Jan 2026)** — bundle of Logic Pro, Pixelmator Pro, etc. All redesigned around Liquid Glass + concentric corners. Layers sidebar in Pixelmator is the closest cousin to the prompt vault concept: scrollable list, each item is a chip, glass background.
3. **Sky (Mac AI app by the Shortcuts team)** — covered by MacStories. Floating command bar that hovers over any app, Liquid Glass styling, parallax tilt on the bar's contents.
4. **Things 4 (Cultured Code)** — long the gold standard of spring choreography. Now uses Liquid Glass for its inspector panels with the exact bob + tilt + glint behavior described above.
5. **Arc Browser sidebar** — already used depth + layering before Tahoe, doubled down post-WWDC25.
6. **Raycast extensions** — many third-party Raycast extensions added Liquid Glass cards in late 2025, including the Linear, Arc, and GitHub extensions.
7. **Linear.app web** — uses Linear's own 4-level elevation system (Flat / Subtle / Card / Elevated) — `0`, `ring + micro lift`, `ring + lift`, `ring + deep shadow`. Linear-style elevations are cheaper than full Liquid Glass and a fantastic fallback when accessibility settings request reduced transparency.
8. **MockFlow's iOS 26 Liquid Glass screen designer** — entire Figma-like tool rebuilt to render Liquid Glass tokens.
9. **Apple's official "New Design Gallery 2026"** ([developer.apple.com/design/new-design-gallery-2026/](https://developer.apple.com/design/new-design-gallery-2026/)) — Apple maintains a gallery of third-party apps deemed exemplary Liquid Glass adopters.

---

## 8. Scroll choreography — when the vault list scrolls

CSS Scroll-driven Animations went universal in 2026 (no flag, all evergreen browsers). The vault list can use them so the **top + bottom of the visible list fade out, and items closer to the viewport scale up slightly** — a "you are here" focal effect.

```css
.vault-list {
  scroll-timeline: --vault-scroll y;
  scroll-timeline-axis: block;
  overflow-y: auto;
}

.prompt-chip {
  view-timeline: --chip block;
  animation: chip-focus linear;
  animation-timeline: --chip;
  animation-range: cover;
}

@keyframes chip-focus {
  /* entry */
  0%   { opacity: 0.3; transform: translateZ(-30px) scale(0.92); filter: blur(2px); }
  /* in focus mid-viewport */
  50%  { opacity: 1;   transform: translateZ(0)     scale(1);    filter: blur(0); }
  /* exit */
  100% { opacity: 0.3; transform: translateZ(-30px) scale(0.92); filter: blur(2px); }
}
```

These animations run on the **compositor thread** — never block xterm's rendering, never miss a frame even if the PTY is busy.

A gradient mask for the soft fade at top/bottom of the list (works because the mask is on a *wrapper*, preserving 3D on children):

```css
.vault-list-mask {
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    black 12%,
    black 88%,
    transparent 100%
  );
  -webkit-mask-image: var(--mask-image);
}
```

---

## 9. The "panel reveal as window furniture" choreography spec

Concrete spec the user could hand to a developer:

1. User clicks the **vault icon** in the session window tab strip (top-right).
2. **0 ms** — vault element gets `.opening` class. Initial state: `transform: translateX(40px) rotateY(-22deg) scale(0.94); opacity: 0; filter: blur(18px) saturate(0.6);`. Pointer-events disabled.
3. **0–80 ms** — terminal-host transitions to `filter: blur(3px) brightness(0.6); transform: scale(0.985);`.
4. **40–340 ms** — vault transitions to settled state with spring `cubic-bezier(0.2, 0.9, 0.1, 1.05)`. Opacity, blur, scale, translate, rotate all animate. Pointer-events re-enabled at 340 ms.
5. **120–820 ms** — glint sweep `::before` runs once across the vault.
6. **340 ms onward** — idle bob keyframe starts. Pointer parallax tilt becomes live.
7. **Closing:** mirror in reverse; total 280 ms (closes faster than opens — feels snappier).

Reduced-motion alternative: cross-fade `opacity 0 → 1` over 120 ms, no transforms, no blur, no glint.

---

## 10. Pioneer-level move: the "Window in a Window" Vault

The single most exciting idea: **render the prompt vault as a literal floating sub-window inside the terminal pane**, complete with a tiny traffic-light bar of its own, casting a deep shadow on the terminal text, with the terminal text *visibly bending* around its convex rim via Liquid Glass refraction.

The visual story:
- The terminal is a flat surface.
- The vault is a piece of curved glass furniture floating ~30 px in front of it.
- When you move your mouse, the vault tilts subtly, and the terminal text *refracts* through the vault's rim — you can see the curved glass affecting what's behind.
- When you hover a `.md` chip inside the vault, the chip rises 28 px out of the vault toward you, and every neighboring chip blurs.
- When you click the chip, a particle (a tiny glowing dot) detaches from the chip, arcs toward the terminal input position, and dissolves — at the same instant, the prompt text materializes in the terminal.

That last beat is borrowed from visionOS's "object hand-off" choreography — Vision Pro animates objects flying between windows. Doing it for a prompt-to-terminal paste is **the** pioneer-level grace note that makes the vault feel alive instead of utilitarian.

Implementation primitives are all here:
- The window-in-window look: Liquid Glass panel with a 14 px tall title strip using the same concentric-corner radii.
- Refraction-through-rim: SVG `feDisplacementMap` with the convex squircle profile from §2.2.
- Particle arc: 1 div, 6 keyframes, CSS `motion-path: path(...)` with cubic curve, 380 ms duration, on `animationend` insert the text into the PTY.

---

## 11. Quick-reference: the values that "feel Apple"

A consolidated table of the magic numbers from across the research:

| Property | Value | Source / why |
|---|---|---|
| `backdrop-filter` blur | `24px` | 2026 trend articles + Apple HIG sweet spot |
| `saturate` post-blur | `1.6`–`1.8` | Apple Liquid Glass uses ~140–200% |
| `brightness` post-blur | `0.85`–`0.9` | Lets glass read as a layer (Comeau) |
| Panel corner radius | `20`–`28 px` | Concentric to a 36px parent window radius (parent − padding) |
| Drop-shadow (deep) | `0 30px 60px -20px black/60%` | Tahoe panels |
| Drop-shadow (near) | `0 8px 20px -10px black/40%` | Tahoe panels |
| Inset rim light | `inset 0 1px 0 white/15%` | Cheap specular |
| Perspective | `1200px` | Subtle, cinematic |
| Tilt range | `±8°` X-axis, `±10°` Y-axis | Apple keynote hero |
| Tilt spring lerp | `0.08` per frame | Damped, "smooth not snappy" |
| Idle bob | `translateY ±3px`, `rotateZ ±0.15°`, `6s` | visionOS window dwell |
| Open spring | `cubic-bezier(0.2, 0.9, 0.1, 1.05)`, `320ms` | Things 4 |
| Close spring | `cubic-bezier(0.4, 0, 0.6, 1)`, `260ms` | Faster than open |
| Glint sweep duration | `700ms`, runs once on open | Apple keynote polish |
| Displacement scale | `45`–`70 px` | rdev's defaults |
| Chromatic offset | `0.6 px R / -0.6 px B` | Visible but not garish |
| Hover chip Z-rise | `+28 px` | Reads as "lifted toward camera" |
| Hover chip scale | `1.02` | Just enough |
| Neighbor blur on hover | `blur(0.5px) brightness(0.85)` | DOF without losing legibility |

---

## 12. Risks, accessibility, and the inevitable workaround

Three pitfalls the implementation must avoid:

### 12.1 The `overflow: hidden` 3D-flatten trap

If the vault is `overflow: hidden` (to clip its scrollable inner list), every child's `translateZ` is **flattened to zero**. The fix:

```html
<div class="vault-panel">              <!-- 3D root; preserve-3d -->
  <div class="vault-rim"></div>        <!-- specular layer, translateZ(60px) -->
  <div class="vault-content-3d">       <!-- preserve-3d; translateZ(20px) -->
    <div class="vault-clip">           <!-- overflow:hidden; transform-style: flat -->
      <div class="vault-list">...</div>
    </div>
  </div>
</div>
```

The rim and outer translateZ children stay 3D. The clipped scrollable inner is intentionally flat. You don't notice because the rim and content are what's in motion when the panel tilts.

### 12.2 `prefers-reduced-transparency` and `prefers-reduced-motion`

```css
@media (prefers-reduced-transparency: reduce) {
  .vault-panel {
    background: hsl(220 18% 12%);   /* solid */
    backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vault-panel { animation: none; transform: none !important; }
  .prompt-chip { transition: none; }
  .vault-panel.opening::before { animation: none; }
}
```

### 12.3 Electron + native vibrancy + CSS `backdrop-filter` = render bug

Don't combine them. Pick one of:
- Native Mica/Acrylic on the window, **no** `backdrop-filter` in CSS (the vault tints + a thin border are enough — Mica already provides the blur).
- Opaque window, full CSS `backdrop-filter` for the vault.

For EZvibes's "embedded terminal" scenario, the **second** path is correct — the vault must blur the *terminal*, not the user's wallpaper.

---

## 13. Files / packages cheat-sheet for the EZvibes

What to add to the existing project to ship this:

```
renderer/
├── styles.css                            ← extend with §2 / §3 / §4 / §8 styles
├── vault.js                              ← new IIFE: open/close + parallax tilt
├── vault-glass.svg                       ← new: <defs><filter id="liquid-glass">...</filter></defs>
└── assets/
    ├── vault-disp-300x360.png            ← precomputed displacement map (convex squircle)
    └── vault-specular-300x360.png        ← precomputed rim highlight
```

`renderer/index.html` (additions):

```html
<!-- Top of <body> -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="vault-liquid-glass" colorInterpolationFilters="sRGB">
      <!-- ... filter chain from §2.2 ... -->
    </filter>
  </defs>
</svg>

<!-- inside each session window -->
<aside class="vault-panel" hidden>
  <header class="vault-rim">
    <h2>Prompt Vault</h2>
    <button class="vault-close" aria-label="Close vault"></button>
  </header>
  <div class="vault-content-3d">
    <div class="vault-clip">
      <ul class="vault-list">
        <li class="prompt-chip" data-path="C:\...\hand-off.md">
          <span class="chip-name">hand-off.md</span>
          <span class="chip-date">3m ago</span>
          <button class="chip-paste">paste</button>
        </li>
        ...
      </ul>
    </div>
  </div>
</aside>
```

Vanilla JS hookup is identical to the existing `app.js` IIFE pattern — no React, no new toolchain. Wire `chip-paste` clicks to the existing `terminal:input` IPC channel.

---

## 14. Concrete sources

- **Apple's Liquid Glass announcement** — https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- **Liquid Glass on Wikipedia** — https://en.wikipedia.org/wiki/Liquid_Glass
- **6 visionOS-Inspired Design Elements Coming to iOS 26** — https://www.macrumors.com/2025/05/30/ios-26-visionos-inspired-design-elements/
- **macOS Tahoe redesign critique (Macworld)** — https://www.macworld.com/article/2862474/macos-tahoe-prioritizes-productivity-over-liquid-glass.html
- **Liquid Glass in the Browser: Refraction with CSS and SVG (kube.io)** — https://kube.io/blog/liquid-glass-css-svg/
- **Liquid Glass in CSS (and SVG) — ekino-france** — https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d
- **Recreating Apple's Liquid Glass Effect with Pure CSS — kevinbism** — https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl
- **How to create Liquid Glass effects with CSS and SVG — LogRocket** — https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/
- **liquid-glass-react (rdev)** — https://github.com/rdev/liquid-glass-react
- **@callstack/liquid-glass (React Native)** — https://github.com/callstack/liquid-glass
- **nikdelvin/liquid-glass (Astro/web)** — https://github.com/nikdelvin/liquid-glass
- **liquid-css (chromatic aberration only)** — https://github.com/electrikmilk/liquid-css
- **LiquidGlass.js WebGL implementation** — https://www.cssscript.com/webgl-liquid-glass/
- **Next-level frosted glass — Josh W. Comeau** — https://www.joshwcomeau.com/css/backdrop-filter/
- **Clever Backdrop Filtering for Eye-catching Glass Effects** — https://thathtml.blog/2025/07/clever-backdrop-filtering-for-eyecatching-glass-effects/
- **Vanilla-tilt.js** — https://micku7zu.github.io/vanilla-tilt.js/
- **Atropos.js (3D parallax)** — https://atroposjs.com/
- **React Parallax Tilt** — https://github.com/mkosir/react-parallax-tilt
- **CSS Scroll-driven Animations (MDN)** — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations
- **Creating Complex Scroll-driven Animations with Pure CSS in 2026** — https://dev.to/nickbenksim/creating-complex-scroll-driven-animations-with-pure-css-in-2026-17l
- **Linear's UI redesign — depth + elevation** — https://linear.app/now/how-we-redesigned-the-linear-ui
- **The Deep Card Conundrum — Frontend Masters** — https://frontendmasters.com/blog/the-deep-card-conundrum/
- **CSS perspective (CSS-Tricks)** — https://css-tricks.com/almanac/properties/p/perspective/
- **Intro to CSS 3D transforms — DeSandro** — https://3dtransforms.desandro.com/perspective
- **Apple Developer — visionOS hover effects (WWDC25 #303)** — https://developer.apple.com/videos/play/wwdc2025/303/
- **Apple Developer — What's New in visionOS 26 (WWDC25 #317)** — https://developer.apple.com/videos/play/wwdc2025/317/
- **Solid Interfaces for visionOS: Widgets and Cognitive Space** — https://www.createwithswift.com/solid-interfaces-for-visionos-widgets-and-cognitive-space-in-spatial-computing/
- **mica-electron (Windows 11 Mica for Electron)** — https://github.com/GregVido/mica-electron
- **pykeio/vibe (acrylic for Electron 10/11)** — https://github.com/pykeio/vibe
- **Electron BrowserWindow backgroundMaterial docs** — https://www.electronjs.org/docs/latest/api/structures/base-window-options
- **electron-acrylic-window** — https://www.npmjs.com/package/electron-acrylic-window
- **Electron Window Styling Masterclass — CSS Kitsune** — https://www.csskitsune.com/blog/electron-window-styling-masterclass
- **Sky for Mac preview — MacStories** — https://www.macstories.net/stories/sky-for-mac-preview/
- **Apple Creator Studio launch** — https://www.apple.com/newsroom/2026/01/introducing-apple-creator-studio-an-inspiring-collection-of-creative-apps/
- **Apple Liquid Glass design gallery (April 2026 update)** — https://www.macrumors.com/2026/04/06/apple-liquid-glass-design-gallery-update/
- **Apple's New Design Gallery 2026 (Apple Developer)** — https://developer.apple.com/design/new-design-gallery-2026/
- **Glassmorphism in 2026 — Inverness Design Studio** — https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026
- **Dark Glassmorphism: the aesthetic that will define UI in 2026** — https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f
- **9 Mobile App Design Trends for 2026 — UXPilot** — https://uxpilot.ai/blogs/mobile-app-design-trends
- **Spline 3D for the web (animations + timeline)** — https://tympanus.net/codrops/2025/11/05/animating-a-3d-scene-with-splines-new-timeline-tool/
- **React Three Fiber docs** — https://r3f.docs.pmnd.rs/
- **framer-motion-3d** — https://www.npmjs.com/package/framer-motion-3d
- **iOS 26 visionOS-inspired design overhaul — AppleMagazine** — https://applemagazine.com/apples-ios-26-to-introduce-visionos-inspired/

---

## 15. TL;DR for the orchestrator

The vault is not a sidebar. It is a piece of visionOS-grade glass furniture floating in front of the terminal. The recipe:

1. Render the vault as a `position: absolute` panel inside the session window.
2. Style it with Liquid Glass: `backdrop-filter: blur(24px) saturate(180%) brightness(0.9)` + an inline-SVG `feDisplacementMap` filter with a convex-squircle map for true rim refraction (Chromium-only — perfect for Electron).
3. Wrap it in a `perspective: 1200px` host. On `mousemove`, lerp toward `rotateX/Y` 8°–10° tilt with a damped spring (0.08 lerp factor).
4. Cascade `translateZ` to the rim (60 px), header (40 px), list (20 px) — actual parallax depth.
5. Idle-bob the whole thing: `translateY ±3 px`, `rotateZ ±0.15°`, 6 s sine.
6. On open, push the terminal back with `filter: blur(3px) brightness(0.65) scale(0.985)` and slide the vault in with `cubic-bezier(0.2, 0.9, 0.1, 1.05)`, plus a one-shot glint sweep across the rim.
7. On hover, lift each `.md` chip with `translateZ(28px) scale(1.02)`, blur neighbors with `:has(~ :hover)` and a `blur(0.5px)`.
8. On paste-click, animate a glowing particle from the chip along a `motion-path` arc to the xterm caret, then commit the IPC write — the visionOS "object hand-off" beat.
9. Wrap everything in `prefers-reduced-motion` / `prefers-reduced-transparency` fallbacks (solid bg, no animation).
10. Use a Mica/Acrylic native Electron window *only* if you ditch CSS `backdrop-filter` — they conflict. For this app, the vault blurs the terminal (inside the renderer) so keep the window opaque dark.

Pioneer-level grace note: when a prompt is clicked, a tiny glowing particle visibly **detaches from the vault chip, arcs through 3D space across the curved Liquid Glass rim (refracting on the way through), and dissolves into the terminal's caret position** — at exactly the moment the IPC write lands. That single 380 ms animation makes the whole interaction read as Vision-Pro-on-Windows, not Electron-sidebar.
