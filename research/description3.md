# Research Agent #3 — Bento Grid & Modular Card Layouts for the Prompt Vault (2025-2026)

> Mission: Provide a comprehensive knowledge dump of bento-grid and modular-card-layout patterns from the most influential 2025-2026 design work — specifically aimed at building a **prompt vault** panel inside the EZvibes session window. Pioneer-level, dense, no fluff: think layouts, ratios, tokens, code, animation, hover language, real apps, and what makes the "wow."

---

## 1. Executive framing: why bento is the right primitive for a prompt vault

The prompt vault is a **content-collection UI** dropped inside a terminal session. The vault must:

- Make different prompt files instantly readable at a glance (varied size = varied importance).
- Surface frequent/featured items larger (e.g. a `CLAUDE.md`, a hand-off, the most-recently-touched prompt).
- Show many smaller items in the same viewport (recent files, snippets).
- Live in a dark, technical, dense environment (Linear/Raycast register, not marketing-page register).
- Update reactively when other Claude sessions drop new files into the watched folder.
- Reward a single click (paste into terminal) — the whole layout needs to feel **clickable** and **tactile**.

Bento grid is purpose-built for this. Per the 2025/2026 industry analysis, 67% of the top 100 SaaS sites on ProductHunt now use a bento layout for at least one section, and bento sections lift average time-on-page by 31% versus stacked sections. Eye-tracking studies show users fixate on larger bento tiles **2.6× longer** than on smaller ones, and rate UIs **18% higher on "professionalism"** when corner radii are applied consistently — directly transferable to a vault panel where the user must scan dozens of files quickly. ([Senorit](https://senorit.de/en/blog/bento-grid-design-trend-2025), [Landdding](https://landdding.com/blog/blog-bento-grid-design-guide), [StudioMeyer](https://studiomeyer.io/en/blog/bento-grid-layouts))

**The mental model to steal**: Apple's product pages (camera tile 2× the size of the chip tile) — and the bento "comic-panel" eye-flow ([Medium · Jeffrey Hasan.C](https://medium.com/@jefyjery10/apples-bento-grid-secret-how-a-lunchbox-layout-sells-premium-tech-7c118ce898aa)). Apple uses spatial weight to indicate priority. The vault should do the same: pinned/featured prompts = large tile, recent = mid, archived = small chip.

---

## 2. The four families of bento layouts (and which to use when)

### 2.1 Symmetric uniform grid (NOT bento, but worth contrasting)

Equal-width columns, every tile identical. Use for: deeply repetitive content (huge folders of similarly-weighted files). Reads as a spreadsheet. **Avoid as primary layout for the vault** — kills hierarchy. ([UXPin](https://www.uxpin.com/studio/blog/symmetry-vs-asymmetry-in-design/))

### 2.2 Asymmetric bento (the canonical Apple style)

Mixed tile sizes inside a fixed N-column grid. Tiles span 1–4 columns and 1–3 rows; `grid-auto-flow: dense` fills holes automatically. This is the **default recommendation for the prompt vault**. ([iamsteve](https://iamsteve.me/blog/bento-layout-css-grid))

Canonical span hierarchy from Orbix Studio's 2026 dashboard guide ([orbix.studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)):

- **Tier 1 — Hero**: 4–6 cols × 2 rows. *Vault use*: featured/pinned `CLAUDE.md`, today's hand-off.
- **Tier 2 — Feature**: 3–4 cols × 1–2 rows. *Vault use*: large prompt files (e.g. a system prompt with description).
- **Tier 3 — Metric**: 2–3 cols × 1 row. *Vault use*: standard `.md` files with title + 2-line preview.
- **Tier 4 — Accent**: 1–2 cols × 1 row. *Vault use*: quick snippets, hand-off chips, "paste raw text" buttons.

> **Rule from the same source**: *Tile size must reflect data importance, not data volume.* You can have a tiny tile containing a 5,000-word prompt — what matters is whether the user wants it surfaced.

### 2.3 Masonry / grid-lanes (variable-row-height stack)

Columns stay equal width, row height = content height. Items tile vertically, packed by the algorithm into whichever column has the most room. Great for **mixed-length previews** (some prompts have 1-line names, others have 20-line snippet previews).

In May 2026, **Safari 26 ships native masonry** as `grid-template-rows: masonry` (under the renamed feature *CSS Grid Lanes*). Chrome and Firefox have it behind experimental flags and are expected to ship stable later in 2026. Progressive enhancement is the pattern. ([dev.to/bean_bean](https://dev.to/bean_bean/css-grid-lanes-masonry-layout-is-here-a-complete-guide-for-2026-4686), [CSS-Tricks](https://css-tricks.com/masonry-layout-is-now-grid-lanes/), [MDN masonry](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout))

```css
/* Fallback that works everywhere */
.vault-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  align-items: start;
}

/* Native masonry where it ships */
@supports (grid-template-rows: masonry) {
  .vault-grid { grid-template-rows: masonry; }
}

/* Future formal keyword */
@supports (display: grid-lanes) {
  .vault-grid {
    display: grid-lanes;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
}
```

For JS fallback today: **Masonry.js by Desandro** (the OG, paired with `imagesLoaded` to avoid overlap) or **Muuri** (adds drag-and-drop and filtering with CSS-transform animation — could be useful to let the user manually reorder prompts). ([Masonry · Desandro](https://masonry.desandro.com/), [Muuri overview via Sencha](https://www.sencha.com/blog/must-try-javascript-grid-layouts-for-modern-web-design/))

**When to pick masonry vs bento**: per medevel.com, bento gives *structure with intentional hierarchy*; masonry gives *content-driven packing*. For a vault that's mostly files of similar weight, **masonry plus a single "featured" pinned hero tile at the top** is the best of both worlds. ([medevel.com](https://medevel.com/bento-grid-is-not-masonry-heres-why-and-what-to-use-when-a-quick-guide-for-ui-ux-designers/))

### 2.4 Hybrid: hero strip + masonry tail

Used by Notion's redesigned 2024 home screen, Apple's App Store *Today* view, and Linear's project status pages. Top row contains 1–2 hero tiles (4 cols wide each), then the layout drops into a 3–4 column auto-flow grid of smaller cards. **Strongly recommended for the prompt vault**: a "Today" / "Recently dropped from other sessions" hero, plus the rest as smaller chips.

---

## 3. The core CSS grid recipes (copy-pasteable)

### 3.1 Minimum-viable bento with `dense` auto-flow

From iamsteve.me ([link](https://iamsteve.me/blog/bento-layout-css-grid)) — 12-column root, dense fill, GPU-friendly:

```css
.bento-container {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-flow: dense;
  grid-auto-rows: 1fr; /* keeps rows visually balanced */
  gap: 1rem;
}
.bento-section-primary   { grid-column: span 6; grid-row: span 4; }
.bento-section-secondary { grid-column: span 3; grid-row: span 4; }
.bento-section-tertiary  { grid-column: span 3; grid-row: span 2; }
```

`grid-auto-flow: dense` is the magic — it tells the layout algorithm to fill earlier holes with later items if they fit. Without it you get gaps. ([wearedevelopers](https://www.wearedevelopers.com/en/magazine/682/building-a-bento-grid-layout-with-modern-css-grid-682))

### 3.2 `grid-template-areas` (named-region pattern)

Best when the layout is **deliberately handcrafted** rather than auto-flowing. Reads like ASCII art:

```css
.vault {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: 200px 100px 100px;
  grid-template-areas:
    "hero    hero    hero    pin1 pin1 pin2"
    "recent1 recent2 recent3 pin1 pin1 pin3"
    "recent4 recent5 recent6 chip chip drop";
  gap: 12px;
}
.hero    { grid-area: hero; }
.pin1    { grid-area: pin1; }
/* ...etc */

/* Mobile: rewrite the whole map */
@media (max-width: 768px) {
  .vault {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "hero hero"
      "pin1 pin2"
      "pin1 pin3"
      "recent1 recent2"
      "recent3 recent4";
  }
}
```

The Orbix dashboard guide uses this pattern as the recommended "preset" approach because you can store named layouts as JSON and let users swap them. ([orbix.studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics))

### 3.3 Aspect-ratio + flex-grow (the 9elements technique)

If you want bento tiles to maintain **fixed aspect ratios while also flex-filling rows**, the 9elements approach is elegant ([9elements](https://9elements.com/blog/building-a-combined-css-aspect-ratio-grid/)):

```css
.row {
  display: flex;
  gap: 1rem;
}
.item {
  flex-basis: 0;
  flex-grow: calc(var(--ratio));
  aspect-ratio: var(--ratio);
}
```

```html
<div class="row">
  <div class="item" style="--ratio: 16/9;">CLAUDE.md preview</div>
  <div class="item" style="--ratio: 4/3;">Hand-off card</div>
  <div class="item" style="--ratio: 1;">Snippet chip</div>
</div>
```

**Mixed aspect ratios per tile**: For the vault, choose `1/1` (snippets / chips), `4/3` (mid prompt cards), `16/9` (hero/pin), and `2/3` (tall README/style guide previews). Mixing all three creates the *signature bento rhythm*. ([Mockuuups Studio](https://mockuuups.studio/blog/post/best-bento-grid-design-examples/))

### 3.4 Container queries (the 2026 best practice)

Instead of viewport `@media`, use `@container` queries so the vault adapts to **its own width** (it's in a panel, not the full viewport). ([Senorit](https://senorit.de/en/blog/bento-grid-design-trend-2025))

```css
.vault {
  container-type: inline-size;
  container-name: vault;
}

@container vault (min-width: 600px) {
  .vault-grid { grid-template-columns: repeat(4, 1fr); }
}
@container vault (min-width: 400px) and (max-width: 599px) {
  .vault-grid { grid-template-columns: repeat(3, 1fr); }
}
@container vault (max-width: 399px) {
  .vault-grid { grid-template-columns: repeat(2, 1fr); }
}
```

This is what makes a vault that lives next to a terminal pane (variable width) feel right — it never has dead 1-column space because the user dragged the splitter narrow.

### 3.5 Subgrid for internal tile alignment

CSS subgrid is universally supported as of 2026 (Chrome 117+, Edge 117+, Firefox 71+, Safari 16+). Use it so the **internal anatomy of each tile** (icon-row, title, preview, footer) aligns across cards of different heights — the bento equivalent of "tabular numbers" for layouts. ([web.dev](https://web.dev/articles/css-subgrid))

```css
.bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 4; /* icon, title, body, footer */
}
```

Now the title of card A lines up perfectly with the title of card B even though card A's body is twice as long. **Critical polish detail** — almost no consumer apps do this yet.

### 3.6 The Tailwind `bento-grid` shorthand

Per the Tailwind UI Plus bento-grids reference, the canonical class skeleton is:

```html
<div class="grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
  <div class="lg:col-span-2 lg:row-span-2 rounded-2xl bg-white/5">…hero…</div>
  <div class="rounded-2xl bg-white/5">…</div>
  <div class="rounded-2xl bg-white/5">…</div>
  <div class="lg:col-span-2 rounded-2xl bg-white/5">…</div>
</div>
```

For a non-Tailwind project (like EZvibes), just translate the utility classes into bespoke CSS — but the **`grid-cols-3 / grid-rows-2 / col-span-2 / row-span-2`** pattern is the de-facto industry idiom in 2026. ([Tailwind UI](https://tailwindcss.com/plus/ui-blocks/marketing/sections/bento-grids))

---

## 4. Tile types specifically for the prompt vault

Adapted from Orbix's AI-dashboard tile taxonomy plus Baltech's AI-dashboard write-up. Below: which AI-dashboard tile maps to which prompt-vault tile.

| Vault tile | Cols × Rows | Anatomy | Why |
|---|---|---|---|
| **Hero / Featured Prompt** | 4×2 | Big icon, file name, 6-line preview, "Paste" button | The big juicy paste-now item. |
| **Hand-off Drop** | 3×2 | "Just dropped from session X • 2 min ago", file name, preview, paste | Surfaces files written by *other* Claude sessions. The cross-session magic. |
| **Recent (medium)** | 2×2 | Icon, title, 2-line preview | The most-clicked tile type. |
| **Snippet chip** | 1×1 | Just title + paste icon | For one-shot prompts you paste daily (e.g. "test runner instruction"). |
| **Folder** | 2×1 | Folder icon, count badge ("12 files"), name | Drill-down into a subfolder of prompts. |
| **Search / Spotlight** | full row × 1 | Input + filter chips | Pinned at the top, type-to-filter. |
| **Recent Activity / "What just dropped"** | 2×2 | List of last 5 file changes with timestamps + paste icons | Encourages cross-session awareness. |
| **Pinned section** | sub-grid 2×4 | Several mini-cards bundled as one "shelf" | Lets the user curate a personal favourites row. |
| **Big "Paste raw text" composer** | 4×1 | Text input + send button | Lets you type ad-hoc text and paste into terminal without saving as a file. |
| **Tag/Category chip** | 1×1 | One-word label | Filter the rest of the grid. Hover scales it up. |

Pin the **search**, **hero**, and **hand-off drop** tiles at the top; the rest can scroll inside the vault. (Notion's home redesign does exactly this with pinned-pages getting larger 4-col tiles and recent docs sitting in 2-col tiles ([orbix.studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)).)

---

## 5. Anatomy of an individual tile (the inside of the card)

From Landdding's design guide ([link](https://landdding.com/blog/blog-bento-grid-design-guide)) — successful bento card anatomy:

```
┌──────────────────────────┐
│  [icon]            [···] │  ← top: icon + overflow menu / pin
│                          │
│  CLAUDE.md               │  ← middle: title (semibold)
│  ─────────               │
│  Define personality       │  ← preview (2-3 lines, ellipsis)
│  and constraints for…    │
│                          │
│  3 days ago • 1.2 KB     │  ← bottom: metadata
│                  [Paste] │  ← bottom-right: action button
└──────────────────────────┘
```

Rules of thumb:

- **Border radius**: 12–24 px is the sweet spot. Apple uses **20 px** on iOS. Anything less feels "Bootstrap 2014"; anything more feels playful/mobile.
- **Padding**: 16–24 px (avoid 12px on hero tiles — feels cramped).
- **Gap between tiles**: 12–24 px. Under 8 px makes tiles visually merge; over 32 px breaks them into separate islands. **16 px is the universal default**.
- **Background**: Dark theme uses **layered backgrounds** — `#050505` (panel base), `#0d0d0d` (card surface), `#141414` (elevated/hover). This matches Linear's "elevation by opacity" pattern. ([dev.to/imran_khan](https://dev.to/imran_khan_a3cc224344dbcf/bento-grid-css-complete-tutorial-free-examples-2026-2ci))
- **Border**: A 1 px `rgba(255,255,255,0.08)` hairline. Adds Apple-style "frosted edge" to dark tiles without bloating contrast.
- **Typography hierarchy**: ~13 px metadata · 14–15 px preview body · 16–17 px title · 11 px caps for chips/labels.
- **Color reservation**: ~70% neutral surfaces, ~20% accent color (your existing EZvibes amber/teal), ~10% data viz / loud accents (status dots).
- **Subgrid the internals** so the icon-row, title, body, and footer of every card all line up across the grid. (See §3.5.)

---

## 6. Hover / interaction language (the "pioneer-level" feel)

The Superfiles "10 Premium Bento Interaction Strategies" article ([link](https://www.superfiles.in/interactive-bento-grid-guide.php)) and Aceternity / Magic UI / Launch UI / Framer marketplace components together form the 2026 vocabulary. Here are the techniques, with implementation notes.

### 6.1 "Breath" (the canonical lift)

- Hover: `transform: scale(1.02)` with simultaneous shadow drop (e.g. shadow goes from `0 1px 2px rgba(0,0,0,0.4)` to `0 12px 32px rgba(0,0,0,0.6)`).
- Use a **spring** easing (stiffness ~300, damping ~20) rather than linear. In CSS, approximate with `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Card visually lifts toward the user. **Universal baseline**. Implement on every vault tile.

```css
.tile {
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow  200ms ease-out;
}
.tile:hover {
  transform: translateY(-2px) scale(1.015);
  box-shadow: 0 12px 32px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.10);
}
```

### 6.2 Spotlight ("dim siblings")

When hovering one tile, **dim every other tile** to focus attention. Pure CSS via `:has()`:

```css
.bento-grid:has(.tile:hover) .tile        { opacity: 0.55; filter: saturate(0.7); transition: 200ms; }
.bento-grid:has(.tile:hover) .tile:hover  { opacity: 1; filter: none; }
```

Used by Aceternity. Brutally effective in dense grids. ([Aceternity UI · Bento](https://ui.aceternity.com/components/bento-grid))

### 6.3 Cursor-following spotlight glow

A radial gradient that follows the cursor across the card. Implementation: capture `mousemove`, set CSS variables on the tile, render a pseudo-element with a soft radial-gradient at those coordinates.

```css
.tile::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(
    320px circle at var(--mx, 50%) var(--my, 50%),
    rgba(245, 175, 25, 0.18),
    transparent 40%
  );
  opacity: 0;
  transition: opacity 200ms;
}
.tile:hover::before { opacity: 1; }
```

```js
tile.addEventListener('mousemove', (e) => {
  const r = tile.getBoundingClientRect();
  tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
  tile.style.setProperty('--my', `${e.clientY - r.top }px`);
});
```

This is exactly what Aceternity's `BentoGlow` and the `ctrl-alt-news` neon-glow bento do. Single most important "pioneer" effect: it makes a flat dark tile feel **alive** and **wet with light**. ([Aceternity · Glowing Effect](https://ui.aceternity.com/components/glowing-effect), [ctrl-alt-news](https://www.ctrl-alt-news.com/p/bento-grid-neon-glow-hover-effect-htmlcssjavascript))

### 6.4 Proximity border glow

A border that lights up when the cursor gets *near* a tile, not when it enters. Uses the cursor position relative to the whole grid container; a tile within radius gets a glowing 1 px border via `box-shadow` inset. Inspired by **Cursor's enterprise page** (the AI IDE) — Aceternity packages it as the `Glowing Effect` with `proximity`, `inactiveZone`, `spread`, `blur`, `movementDuration` props. ([Aceternity · Glowing Effect](https://ui.aceternity.com/components/glowing-effect))

### 6.5 3D tilt (mouse-tracked perspective)

Card tilts toward the cursor like a physical object. Add `perspective: 1000px` to the *container*, then on the tile compute `rotateX/rotateY` from the cursor position. Real `<img>` highlights catch light and look glossy.

```js
function tilt(e) {
  const r = tile.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width  - 0.5;
  const y = (e.clientY - r.top ) / r.height - 0.5;
  tile.style.setProperty('--rx', `${-y * 10}deg`);
  tile.style.setProperty('--ry', `${ x * 10}deg`);
}
```

```css
.tile {
  transform: perspective(1000px) rotateX(var(--rx,0)) rotateY(var(--ry,0));
  transform-style: preserve-3d;
  transition: transform 100ms;
}
```

**Use sparingly**. Tilting every tile is overwhelming; tilt only the hero/featured tile, or only on long-hover (>500 ms). ([Let's Build UI · 3D Hover Effects](https://www.letsbuildui.dev/articles/a-3d-hover-effect-using-css-transforms/))

### 6.6 Magnetic pull

Tile physically slides toward the cursor as it approaches. Calculate distance from cursor to tile center; apply `translate3d(dx*0.15, dy*0.15, 0)` when within e.g. 200 px. Inspired by Apple TV remote and Awwwards-level micro-interactions. Same caveat — use on hero only.

### 6.7 "Glass glimmer"

A subtle light glint sweeps across a tile when the mouse passes. Implement with a `linear-gradient(115deg, transparent, rgba(255,255,255,0.07), transparent)` translated across via CSS animation triggered on `:hover`. Adds a **premium / Apple Liquid Glass** vibe to dark surfaces. ([Apple · Liquid Glass WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/))

### 6.8 Micro-haptic on click (squish)

Visual substitute for a phone's tactile vibration: scale to `0.95` on `:active`, snap back. ~100 ms total.

```css
.tile:active { transform: scale(0.97); transition: transform 80ms ease-out; }
```

Critical for the vault: every click is "paste this prompt into terminal" — the squish gives instant feedback that the action happened.

### 6.9 Morphing states (inline-expand)

Clicking a small tile *morphs* it into a bigger preview tile in place (rather than opening a modal). Use the **View Transitions API** (Chrome 111+; baseline as of 2025). ([Bram.us](https://www.bram.us/2023/05/09/rearrange-animate-css-grid-layouts-with-the-view-transition-api/), [patterns.dev](https://www.patterns.dev/vanilla/view-transitions/))

```js
function expandTile(el) {
  if (!document.startViewTransition) { el.classList.toggle('expanded'); return; }
  document.startViewTransition(() => el.classList.toggle('expanded'));
}
```

```css
.tile { view-transition-name: tile-1; contain: layout paint; }
::view-transition-old(tile-1),
::view-transition-new(tile-1) {
  animation-duration: 350ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

Each `.tile` gets a unique `view-transition-name`. The browser captures before/after and tweens position/size automatically. **One of the most "pioneer" patterns** because it eliminates modal dialogs entirely. Apple App Store *Today* view is the canonical example. ([Apple developer · custom hover for visionOS](https://developer.apple.com/videos/play/wwdc2024/10152/))

### 6.10 Ambient motion (auto-play preview)

For tiles representing prompt files that include media or animated demos: muted Lottie / WebM looping in the background. Keep it *very* subtle (8-10% opacity) so it doesn't compete with the title. ([Superfiles](https://www.superfiles.in/interactive-bento-grid-guide.php))

### 6.11 Inline interaction

Embed small controls *into* tiles: a star to favourite, a copy-without-paste icon, a tag chip. Reduces clicks, makes the vault feel like a tool instead of a list. ([Superfiles](https://www.superfiles.in/interactive-bento-grid-guide.php))

### 6.12 Live data badge ("just dropped from session X")

When another Claude session writes a new file into the vault folder, the corresponding tile gets a pulsing dot or a "NEW" pill that fades over 5 seconds. Pair with a discrete `chime` (optional). This is the **cross-session hand-off magic** the user described — make it visceral.

---

## 7. Entry animations: stagger, scroll-driven, View Transitions

### 7.1 Stagger fade-in via Web Animation API

When the vault opens or refreshes, tiles enter with a small stagger:

```js
const tiles = vault.querySelectorAll('.tile');
tiles.forEach((tile, i) => {
  tile.animate(
    [
      { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
      { opacity: 1, transform: 'translateY(0)   scale(1)'    }
    ],
    {
      duration: 320,
      delay: i * 24,                     // 24 ms between tiles
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'backwards'
    }
  );
});
```

This is exactly how Linear's overview animates in. Codrops' "Sticky Grid Scroll" tutorial uses 60 ms per item with GSAP and Lenis for an even more cinematic feel ([Codrops](https://tympanus.net/codrops/2026/03/02/sticky-grid-scroll-building-a-scroll-driven-animated-grid/)).

### 7.2 Scroll-driven entry (Josh Comeau-approved)

```css
@keyframes pop-in {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
.tile {
  animation: pop-in 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}
```

Native scroll-driven. ~85% browser support per caniuse (Firefox behind flag as of May 2026). Zero JS, GPU-accelerated. ([Josh Comeau](https://www.joshwcomeau.com/animation/scroll-driven-animations/), [Chrome for Developers](https://developer.chrome.com/docs/css-ui/scroll-driven-animations))

### 7.3 View Transitions for grid reshuffles

When the file watcher detects a new file and reorders the grid, wrap the DOM mutation in `document.startViewTransition` and the browser animates every tile from old → new position. Bram.us covered the basic recipe in 2023; it's now baseline. ([Bram.us](https://www.bram.us/2023/05/09/rearrange-animate-css-grid-layouts-with-the-view-transition-api/))

```js
function refreshGrid(newOrder) {
  document.startViewTransition(() => renderGrid(newOrder));
}
```

This is *the* effect that makes the vault feel "alive": when another session drops a file, every existing tile slides aside to make room. **Single most impressive demo moment** for the project.

### 7.4 GSAP + Lenis (when you need cinematic)

Total overkill for a panel vault, but if the user wants a "showroom" Vault landing screen on first launch, the Codrops Sticky Grid Scroll pattern is the reference:

```js
const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 1.4 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));

const tl = gsap.timeline({
  scrollTrigger: { trigger: vault, start: 'top 25%', end: 'bottom bottom', scrub: true }
});

columns.forEach((column, i) => {
  const fromTop = i % 2 === 0;
  tl.from(column, {
    y: 240 * (fromTop ? -1 : 1),
    stagger: { each: 0.06, from: fromTop ? 'end' : 'start' },
    ease: 'power1.inOut'
  }, 'grid-reveal');
});
```

([Codrops · Sticky Grid Scroll](https://tympanus.net/codrops/2026/03/02/sticky-grid-scroll-building-a-scroll-driven-animated-grid/))

---

## 8. Color, materials, and tokens (dark theme for terminals)

### 8.1 OKLCH for the palette

Tailwind v4 and CSS Color Level 4 standardize on **OKLCH** because equal numerical lightness == equal perceived brightness. Linear migrated from HSL to LCH for exactly this reason (and collapsed 98 theme variables down to 3). ([Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui), [Manuel Strehl](https://manuel-strehl.de/easy_theming_with_oklch))

Suggested vault tokens:

```css
:root {
  /* Surfaces */
  --vault-bg:          oklch(0.13 0.01 60);  /* near-black panel */
  --vault-card:        oklch(0.17 0.01 60);  /* default tile */
  --vault-card-hover:  oklch(0.22 0.012 60); /* hover tile */
  --vault-hero:        oklch(0.20 0.015 55); /* hero tile */
  --vault-border:      oklch(1 0 0 / 0.08);  /* 8% white hairline */

  /* Text */
  --vault-text-1:      oklch(0.95 0 0);      /* titles */
  --vault-text-2:      oklch(0.75 0 0);      /* body */
  --vault-text-3:      oklch(0.55 0 0);      /* metadata */

  /* Accents tied to EZvibes's existing palette */
  --vault-accent-claude: oklch(0.75 0.16 75);  /* amber for Claude */
  --vault-accent-codex:  oklch(0.75 0.12 195); /* teal for Codex */
  --vault-accent-new:    oklch(0.78 0.20 145); /* mint for newly-dropped files */
}
```

Dark/light swap is just `--vault-bg: oklch(0.97 0 0);` etc. — same hue and chroma, flipped lightness.

### 8.2 Material languages to consider

- **Apple Liquid Glass (WWDC25)**: translucent material that **dynamically refracts** content behind it ("Lensing"), with real-time specular highlights. ([Apple newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)) Implementable in CSS via `backdrop-filter: blur(20px) saturate(180%);` + a thin gradient overlay. Best applied to **floating toolbars and chips**, not entire tiles (too much blur on text kills readability).
- **Glassmorphism 2.0**: not the flat 2021 version. Subtle translucent layers + noise texture + gradient borders + soft shadows. Excels in dark interfaces. (Per Midrocket's 2026 trends roundup.) ([midrocket](https://midrocket.com/en/guides/ui-design-trends-2026/))
- **Neumorphism cameo**: largely gone, but **iPhone 16e marketing page uses neumorphism-bento blend** for buttons. Don't replicate.

### 8.3 Animated gradient borders via @property

This is the trick that makes a tile look like it has a *running light* around its border. ([Ryan Mulligan](https://ryanmulligan.dev/blog/css-property-new-style/), [CSS-Tricks · Animating a CSS Gradient Border](https://css-tricks.com/animating-a-css-gradient-border/))

```css
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes spin { to { --angle: 360deg; } }

.tile.featured {
  position: relative;
  background:
    linear-gradient(var(--vault-card), var(--vault-card)) padding-box,
    conic-gradient(
      from var(--angle),
      transparent 0%,
      var(--vault-accent-claude) 25%,
      transparent 50%
    ) border-box;
  border: 1.5px solid transparent;
  border-radius: 20px;
  animation: spin 6s linear infinite;
}
```

Apply this **only to the featured / newly-dropped tile** so it pulls focus. Disable on `prefers-reduced-motion`.

### 8.4 The CSS `corner-shape` property (Chrome 139+, March 2026)

Bigger than people realize. ([Smashing Magazine](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/), [webdevsimplified](https://blog.webdevsimplified.com/2026-05/corner-shape/))

```css
.tile.featured  { border-radius: 24px; corner-shape: squircle; }   /* iOS-style hybrid */
.tile.handoff   { border-radius: 16px; corner-shape: scoop;    }   /* concave inward — *editorial*  */
.tile.snippet   { border-radius: 12px; corner-shape: bevel;    }   /* angled cut — "gem" */
.tile.alert     { border-radius: 12px; corner-shape: notch;    }   /* sharp concave corner */
.tile.classic   { border-radius: 16px; corner-shape: round;    }   /* baseline */
.tile.mixed     { border-radius: 18px; corner-shape: scoop round bevel squircle; } /* per-corner */
```

Use **squircle** as the vault default — it reads as "modern Apple". Use **scoop** for the hand-off-drop tile so it visually stands out (concave corners are extremely rare in the wild, very pioneer). Graceful fallback to regular `border-radius` in non-Chromium browsers.

---

## 9. Real apps that prove the pattern (study these)

This is the curated list of bento implementations you should actually screenshot for the design doc. Per **SaaSFrame's catalogue** ([saasframe.io](https://www.saasframe.io/patterns/bento-grid)), there are 43+ public examples; the most relevant for the vault are below.

| App | What it does with bento | Why it matters for the vault |
|---|---|---|
| **Linear** (project status, redesigned 2024–25) | Dark, technical, dense, asymmetric tiles. Active sprints = large tiles with progress bars; issue counts = small metric chips. ([Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)) | The vault's mood board: same audience, same density, dark. |
| **Notion** (home screen 2024 redesign) | Pinned pages 4-col tiles, recent docs 2-col tiles, team activity in a hero tile. ([orbix.studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)) | Direct analogue: pinned `CLAUDE.md` = pinned page, recent prompt = recent doc. |
| **Vercel** (homepage refresh) | Edge functions, ISR, image opt, observability, preview deploys — one tile each with a live mini-graphic. | Each tile has a *live visualization* — apply to vault by giving each prompt a 6-line live syntax-highlighted preview rendered in xterm-like colors. |
| **Raycast** (extensions browser) | Uses Raycast's native bento-list hybrid. Built with React, declarative components: `List`, `Grid`, `Detail`, `Form`. | The mental model for a click-to-paste vault: type-ahead search + grid + inline detail panel. ([Raycast developers docs](https://developers.raycast.com/api-reference/user-interface)) |
| **Cursor** (enterprise page) | Bento with the famous *Glowing Effect* — proximity-based border glow on hover. Inspired Aceternity's component. ([Aceternity · Glowing Effect](https://ui.aceternity.com/components/glowing-effect)) | Direct inspiration for §6.4. |
| **Apple iPhone product pages** | Asymmetric bento, hero camera tile dwarfs spec tiles, comic-panel eye flow. ([Medium · Jeffrey Hasan.C](https://medium.com/@jefyjery10/apples-bento-grid-secret-how-a-lunchbox-layout-sells-premium-tech-7c118ce898aa)) | Hierarchy reference: biggest = most important *intent*, not most data. |
| **Apple App Store *Today* view** | Cards expand into full-screen previews while maintaining corner radius (uses native View Transitions equivalent in UIKit). | Direct inspiration for §6.9 morphing. |
| **Datadog dashboards** | 12-column CSS Grid, snap-to-grid, 20+ widget types. Most technically mature bento dashboard. | Reference for the *configurable* vault future where users drag/resize tiles. |
| **Mintlify, GitBook, Attio, WorkOS, Stripe homepage** | All listed in SaaSFrame's bento catalogue. | Steal their tile-anatomy details. |
| **Customer.io, Sequence, Wiza, Mercury, Huly, Plain** | Same catalogue, dark variants. | Same. |
| **OpenBento** (open source, github.com/yoanbernabeu/openbento) | Visual drag-and-drop bento builder with 9×9 grid editor. Exports to React/Vite/Tailwind. | Could be a *future* feature: user drags & resizes prompt tiles to customize their vault. |

### Direct GitHub references

- **starc007/tailwind-bento** — tool for creating/exporting bento layouts.
- **anbrela/react-bento** — dynamic resizable bento with `react-grid-layout` under the hood.
- **christian-luntok/bent-o** — Next.js + Tailwind bento template.
- **xavirn89/bentogridgenerator** — generator that exports HTML/CSS or HTML/Tailwind to clipboard.
- **codrops/GridLayoutMotion** — retro grid with playful motion hover.

### Component libraries to crib code from (free or partly free)

- **Aceternity UI** ([ui.aceternity.com](https://ui.aceternity.com/components/bento-grid)) — `BentoGrid`, `BentoGridItem`, `GlowingEffect`, `HoverBorderGradient`, `EvervaultCard`, `CardStack`, `BackgroundGradientAnimation`. Free, copy-paste React + Framer Motion + Tailwind.
- **Magic UI** ([magicui.design](https://magicui.design/docs/components/bento-grid)) — `BentoGrid` + `BentoCard` with hover-blur/scale transforms, `mask-image` gradient masking, `transform-gpu`. Free copy-paste via shadcn CLI.
- **shadcn/ui Studio** ([shadcnstudio.com/blocks/bento-grid/bento-grid](https://shadcnstudio.com/blocks/bento-grid/bento-grid)) — free + premium bento blocks, dark mode built in.
- **shadcn.io Team Animated Bento** ([shadcn.io/blocks/team-animated-bento](https://www.shadcn.io/blocks/team-animated-bento)) — 2×2 with center-scale entrance + staggered hover lift (Framer Motion).
- **Launch UI** ([launchuicomponents.com/docs/sections/bento-grid](https://www.launchuicomponents.com/docs/sections/bento-grid)) — shadcn-style bento system, masonry-friendly, dark theme baked in.
- **ItsHover** ([allshadcn.com/tools/its-hover](https://allshadcn.com/tools/its-hover/)) — hover-enhanced shadcn components: Animated Pricing Card (hover scale + glow), Feature Card with Depth Lift, Shadow Lift Card.
- **Aceternity Shine Border** ([shadcnspace.com/components/shine-border](https://shadcnspace.com/components/shine-border)) — subtle animated shine around any card/button.
- **Framer marketplace**: **BentoGlow Grid** (Erfan Khakpour), **Dynamic Bento** (Frame Craft), **Spotlight Bento Grid**, **Modern Bento Grid**, **Bento Grid Generator**, **Card Stack Expand** (Soyeb).

---

## 10. Pioneer-level patterns (the "ooh that's new" tier)

These are the rare techniques that make a vault feel **two years ahead** of stock SaaS UI.

### 10.1 Live cross-session hand-off pulse

When another Claude session writes into the vault folder, the corresponding tile **morphs into existence** via the View Transitions API + plays a subtle "freshly dropped" animation:

- A soft mint-green border (`var(--vault-accent-new)`) pulses 3× over 1.2 s.
- A "NEW from session X" pill is overlaid for ~5 s, then fades.
- Tile gets the animated `@property --angle` border for as long as it's "fresh."
- Optional: a tiny chime via `<audio>` (off by default; honor `prefers-reduced-motion`).

This is **the single coolest demo moment** — running two EZvibes sessions side-by-side, dropping a hand-off in session A, seeing it materialize *with motion* in session B's vault. No one ships this today.

### 10.2 Vault-as-window-into-folder

The vault panel itself looks like a *cracked-open folder*: top edge tapered, slight inner shadow, faint dotted edge corners — like the bento tiles are *inside* a real Manila folder. Implement with `clip-path` + the new `corner-shape: scoop` for the panel's top corners (Chrome 139+).

### 10.3 "Spread" gesture (stack → grid)

When the vault opens, all tiles first appear as a small **stack of cards** (3D-rotated, offset by a few px). Then they **fan out** into the bento grid with a 350 ms cubic-bezier animation. Subtle, satisfying. Inspired by macOS Stacks. ([Aceternity Card Stack](https://ui.aceternity.com/components/card-stack))

### 10.4 Type-to-filter with motion choreography

Search-input in the hero row. As the user types, non-matching tiles **fade out and shrink**, matching tiles **flow toward each other via `grid-auto-flow: dense` + View Transitions**. The whole grid choreographs each keystroke.

### 10.5 "Paste preview" tooltip

Hovering a tile for >250 ms shows a **tiny floating preview** of *exactly* what will be pasted into the terminal: a monospaced snippet with syntax highlighting, line-numbered, max 10 lines. This converts the vault from "I think this is the right prompt" to "I'm 100% sure this is the right prompt."

### 10.6 Animated conic-gradient border on the *active* tile

While the file watcher reads/parses a file, the tile shows a **rotating conic border** (the `@property --angle` technique from §8.3). Visual "loading without a spinner." When ready, the rotation slows and stops with one full revolution.

### 10.7 Scroll-driven masonry depth

Tiles further down the vault have **smaller scale and lower opacity** as the user scrolls. Scroll back up to "lift" them. Implement with `animation-timeline: scroll(self)` — pure CSS.

```css
@keyframes lift {
  from { opacity: 0.55; transform: scale(0.94); }
  to   { opacity: 1;    transform: scale(1);    }
}
.tile {
  animation: lift linear both;
  animation-timeline: view(block);
  animation-range: cover 0% cover 35%;
}
```

### 10.8 Per-tile background mini-vis

Each tile's background is a **6-line dim syntax-highlighted preview** of the file, mask-faded toward the bottom. Hovering brightens the preview. Reading a vault tile now means partially reading the actual prompt content without clicking.

```css
.tile .preview {
  position: absolute; inset: 0;
  font: 11px/1.4 ui-monospace, "JetBrains Mono", monospace;
  color: rgba(255,255,255,0.18);
  padding: 16px;
  mask-image: linear-gradient(to bottom, black 0%, transparent 70%);
  pointer-events: none;
  transition: color 200ms;
}
.tile:hover .preview { color: rgba(255,255,255,0.42); }
```

### 10.9 Apple Liquid Glass hero strip

The top row (search + featured + hand-off-drop) gets a **Liquid Glass** treatment — translucent backdrop, faint specular highlights via animated `radial-gradient`. Below the hero is a flat dark bento. The contrast between "glass top / matte bottom" reads as **2026 Apple-tier**. ([Apple Newsroom · Liquid Glass](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/))

### 10.10 "Vault breathes" idle animation

When idle for >30 s, the vault subtly breathes: every tile's brightness ripples up/down by ±2% on a 4 s sine wave with random per-tile offset. Imperceptible when active, magical in peripheral vision. Disable on `prefers-reduced-motion`.

### 10.11 Active-tab integration

The vault shows the *currently focused terminal tab's folder context* by tinting hand-off tiles with that tab's agent color (Claude amber / Codex teal). The grid effectively bridges the tab strip and the file system.

### 10.12 The "x-ray" key (Hold ⌥ / Alt)

While the modifier key is held, every tile flips to show **the raw markdown source preview** instead of a styled card. Lift the key, snap back. Built with `:has()` on a `body[data-modifier="alt"]` toggle.

---

## 11. Anti-patterns to avoid

Distilled from Landdding, Orbix, Senorit, and the Macworld report on macOS Tahoe Finder regressions.

- **Equal-sized tiles**: defeats the entire purpose of bento — it's now just a grid. ([orbix.studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics))
- **More than 2 hero tiles per viewport**: dilutes attention. One big tile, max one secondary "feature" tile.
- **Reducing font size to cram content into small tiles**: means the tile is undersized. Either grow it or summarize the content.
- **15+ visible tiles at once**: cognitive overload. Use scroll or pagination.
- **No `:focus-visible` styling**: kills keyboard navigation. Always include `outline: 2px solid var(--vault-accent-claude); outline-offset: 2px;`.
- **Gap < 8 px** (visual merging) or **gap > 32 px** (disconnection). 16 px is canonical.
- **Tilt/parallax on every tile**: the user gets motion sickness in dense grids. Apply to hero only.
- **Animated borders on every tile**: looks like a Christmas tree. Reserve for *featured* / *just-dropped*.
- **`grid-auto-flow: dense` without explicit semantic order**: violates WCAG 2.1 — DOM order no longer matches visual order. Either keep DOM order matching priority or add `aria-flowto`.
- **Backdrop-blur on tiles containing text**: kills readability. Limit to floating toolbars only.
- **CSS columns for masonry**: items flow top-to-bottom-per-column, breaking accessibility. Use `grid-template-rows: masonry` or JS Masonry. ([dev.to/bean_bean](https://dev.to/bean_bean/css-grid-lanes-masonry-layout-is-here-a-complete-guide-for-2026-4686))

---

## 12. Putting it all together: the recommended vault layout

A concrete layout proposal for the EZvibes prompt vault, synthesized from everything above.

```text
┌────────────────────────────────────────────────────────────────────┐
│ [ search ──── filter chips ──── view: bento ▾ ]    [pin] [refresh] │  ← row 0: search/hero, full width, Liquid Glass material
├──────────────────────────────┬─────────────┬───────────────────────┤
│                              │  HAND-OFF   │   RECENT ACTIVITY     │
│         FEATURED             │   DROP      │   (last 5 changes)    │
│         (CLAUDE.md           │  Just from  │                       │
│         pinned, big          │   session   │                       │
│         preview, paste)      │     A       │                       │
│                              │             │                       │
├──────────────┬───────────────┼─────────────┴───────┬───────────────┤
│  prompt-1.md │  hand-off-2.md│   prompt-3.md       │  CLAUDE.md    │
│              │   (scoop      │                     │   (subfolder)  │
│              │   corners)    │                     │               │
├──────────────┼───────────────┼─────────────────────┼───────────────┤
│ snippet      │ snippet       │ snippet             │  prompt-4.md  │
│  (1×1 chip)  │  (1×1 chip)   │  (1×1 chip)         │               │
├──────────────┴───────────────┴─────────────────────┴───────────────┤
│  [ paste raw text composer — full-width tile ]                     │
└────────────────────────────────────────────────────────────────────┘
```

Implementation skeleton:

```html
<aside class="vault" data-cols="6">
  <header class="vault__hero">
    <input class="vault__search" placeholder="Search prompts… (⌘K)" />
    <div class="vault__chips">…</div>
  </header>

  <div class="vault__grid">
    <article class="tile tile--featured">…CLAUDE.md…</article>
    <article class="tile tile--handoff">…just dropped…</article>
    <article class="tile tile--activity">…last 5 events…</article>
    <article class="tile">…</article>
    <!-- …more tiles… -->
    <article class="tile tile--composer">…raw-text input…</article>
  </div>
</aside>
```

```css
.vault {
  background: var(--vault-bg);
  color: var(--vault-text-1);
  container-type: inline-size;
  container-name: vault;
  padding: 16px;
}
.vault__hero {
  backdrop-filter: blur(20px) saturate(180%);
  background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));
  border: 1px solid var(--vault-border);
  border-radius: 18px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.vault__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-auto-flow: dense;
  grid-auto-rows: 110px;
  gap: 16px;
}
.tile {
  background: var(--vault-card);
  border: 1px solid var(--vault-border);
  border-radius: 18px;
  padding: 14px 16px;
  position: relative;
  overflow: hidden;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
              background-color 200ms ease-out,
              box-shadow 200ms ease-out;
  view-transition-name: var(--vt-name); /* set per tile in JS for animated reshuffles */
}
.tile:hover {
  background: var(--vault-card-hover);
  transform: translateY(-2px) scale(1.015);
  box-shadow: 0 12px 32px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.10);
}
.tile:active { transform: scale(.97); transition: transform 80ms ease-out; }

.tile--featured { grid-column: span 3; grid-row: span 2; corner-shape: squircle; }
.tile--handoff  { grid-column: span 2; grid-row: span 2; corner-shape: scoop; }
.tile--activity { grid-column: span 1; grid-row: span 2; }
.tile--composer { grid-column: 1 / -1; grid-row: span 1; }

@container vault (max-width: 720px) {
  .vault__grid { grid-template-columns: repeat(3, 1fr); }
  .tile--featured { grid-column: span 3; }
  .tile--handoff  { grid-column: span 2; }
  .tile--activity { grid-column: span 1; }
}
@container vault (max-width: 480px) {
  .vault__grid { grid-template-columns: repeat(2, 1fr); }
  .tile--featured, .tile--handoff, .tile--activity, .tile--composer { grid-column: 1 / -1; }
}
```

---

## 13. Quick reference cheatsheet

| Concern | Recommendation | Source |
|---|---|---|
| Grid base | `repeat(6, 1fr)` desktop, container-query down to 2 cols | iamsteve, Senorit |
| Gap | 16 px (12 mobile, 24 hero) | Landdding, Orbix |
| Border radius | 18 px tiles, 20 px hero, 12 px chips | Apple convention |
| Corner shape | `squircle` default, `scoop` for hand-off, `bevel` for snippets | Smashing 03/2026 |
| Tile aspect | Mix 1:1 / 4:3 / 16:9 / 2:3 in same grid | 9elements |
| Hover lift | `scale(1.015) translateY(-2px)` + drop shadow + spring easing | Superfiles |
| Spotlight | `:has(.tile:hover)` to dim siblings | Aceternity |
| Spotlight glow | Mouse-tracked radial gradient via CSS vars | ctrl-alt-news |
| Border glow | `@property --angle` + conic gradient | Ryan Mulligan |
| Color space | OKLCH | Tailwind v4, Linear |
| Layered surfaces | `#050505 → #0d0d0d → #141414` | dev.to/imran_khan |
| Native masonry | `grid-template-rows: masonry` (Safari 26) | dev.to/bean_bean |
| Stagger entry | Web Animations API, 24 ms per tile, cubic-bezier(0.16,1,0.3,1) | Codrops |
| Reshuffle anim | `document.startViewTransition()` | Bram.us, patterns.dev |
| Scroll entry | `animation-timeline: view()` | Josh Comeau |
| Live update | View Transitions + mint-green border pulse + "NEW" pill | (pioneer) |
| Accessibility | `:focus-visible`, `aria-label`, `prefers-reduced-motion` | Orbix, WCAG 2.1 |

---

## 14. References

- [Mockuuups Studio · Best Bento Grid Design Examples 2026](https://mockuuups.studio/blog/post/best-bento-grid-design-examples/)
- [Senorit · Bento Grid Design (2026)](https://senorit.de/en/blog/bento-grid-design-trend-2025)
- [Orbix Studio · Bento Grid Dashboard Design Complete Guide 2026](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- [StudioMeyer · Bento Grid Layouts 2026](https://studiomeyer.io/en/blog/bento-grid-layouts)
- [Landdding · Bento Grid Design Guide](https://landdding.com/blog/blog-bento-grid-design-guide)
- [Landdding · Bento Grid by Website Category 2026](https://landdding.com/blog/bento-grid-design-by-website-category-where-the-pattern-wins)
- [Landdding · UI Design Trends 2026](https://landdding.com/blog/ui-design-trends-2026)
- [Inkbot Design · Bento Grid Design 2026](https://inkbotdesign.com/bento-grid-design/)
- [iamsteve · Build a Bento Grid Layout with CSS](https://iamsteve.me/blog/bento-layout-css-grid)
- [wearedevelopers · Building a Bento Grid Layout with Modern CSS Grid](https://www.wearedevelopers.com/en/magazine/682/building-a-bento-grid-layout-with-modern-css-grid-682)
- [Effect Labs · Bento Grid Layouts: The Complete CSS Guide](https://effect-labs.com/en/pages/blog/bento-grid-layouts.html)
- [dev.to/imran_khan · Bento Grid CSS Complete Tutorial 2026](https://dev.to/imran_khan_a3cc224344dbcf/bento-grid-css-complete-tutorial-free-examples-2026-2ci)
- [Speckyboy · 8 CSS Snippets for Creating Bento Grid Layouts](https://speckyboy.com/css-bento-grid-layouts/)
- [Lil Skyjuice Bytes · Brewbolt Bento UI Tutorial](https://medium.com/@lilskyjuicebytes/design-to-code-1-brewbolt-bento-ui-with-html-css-a128f64ebceb)
- [FreeCodeCamp · How to Use Bento Grids in Web Projects](https://www.freecodecamp.org/news/bento-grids-in-web-design/)
- [Banani · Bento Grid Explained with Examples](https://www.banani.co/definitions/bento-grid)
- [Superfiles · How to Animate Bento Grids: 10 Premium Interaction Strategies](https://www.superfiles.in/interactive-bento-grid-guide.php)
- [Aceternity UI · Bento Grid](https://ui.aceternity.com/components/bento-grid)
- [Aceternity UI · Glowing Effect](https://ui.aceternity.com/components/glowing-effect)
- [Aceternity UI · Hover Border Gradient](https://ui.aceternity.com/components/hover-border-gradient)
- [Aceternity UI · Card Stack](https://ui.aceternity.com/components/card-stack)
- [Magic UI · Bento Grid](https://magicui.design/docs/components/bento-grid)
- [Launch UI · Bento Grid](https://www.launchuicomponents.com/docs/sections/bento-grid)
- [shadcn Studio · Bento Grid Blocks](https://shadcnstudio.com/blocks/bento-grid/bento-grid)
- [shadcn.io · Team Animated Bento](https://www.shadcn.io/blocks/team-animated-bento)
- [Tailwind UI · Bento Grids](https://tailwindcss.com/plus/ui-blocks/marketing/sections/bento-grids)
- [Framer Marketplace · BentoGlow Grid](https://www.framer.com/marketplace/components/bentoglow-grid/)
- [Framer Marketplace · Spotlight Bento Grid](https://www.framer.com/marketplace/components/spotlight-bento-grid/)
- [Framer Marketplace · Modern Bento Grid](https://www.framer.com/marketplace/components/modern-bento-grid/)
- [Framer Marketplace · Dynamic Bento](https://www.framer.com/marketplace/components/dynamic-bento/)
- [Framer Marketplace · Bento Grid Generator](https://www.framer.com/marketplace/components/bento-grid-generator/)
- [shadcnspace · Shine Border](https://shadcnspace.com/components/shine-border)
- [allshadcn · ItsHover](https://allshadcn.com/tools/its-hover/)
- [GitHub · starc007/tailwind-bento](https://github.com/starc007/tailwind-bento)
- [GitHub · anbrela/react-bento](https://github.com/anbrela/react-bento)
- [GitHub · yoanbernabeu/openbento](https://github.com/yoanbernabeu/openbento)
- [GitHub · xavirn89/bentogridgenerator](https://github.com/xavirn89/bentogridgenerator)
- [GitHub · codrops/GridLayoutMotion](https://github.com/codrops/GridLayoutMotion)
- [SaaSFrame · Bento Grid Pattern Catalogue](https://www.saasframe.io/patterns/bento-grid)
- [Muzli · Bento UI Grids](https://muz.li/blog/bento-ui-grids/)
- [Apple Newsroom · Liquid Glass (WWDC25)](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- [Apple Developer · Meet Liquid Glass (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Linear · How We Redesigned the Linear UI (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Raycast Developers · User Interface](https://developers.raycast.com/api-reference/user-interface)
- [MDN · Masonry Layout (Guide)](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout)
- [dev.to/bean_bean · CSS Grid Lanes / Masonry 2026](https://dev.to/bean_bean/css-grid-lanes-masonry-layout-is-here-a-complete-guide-for-2026-4686)
- [CSS-Tricks · Masonry Layout is Now grid-lanes](https://css-tricks.com/masonry-layout-is-now-grid-lanes/)
- [pawelgrzybek · Native CSS masonry layout](https://pawelgrzybek.com/native-css-masonry-layout/)
- [Sencha · 7 JS Grid Layouts for Modern Web Design](https://www.sencha.com/blog/must-try-javascript-grid-layouts-for-modern-web-design/)
- [Desandro · Masonry.js](https://masonry.desandro.com/)
- [medevel.com · Bento Grid is Not Masonry](https://medevel.com/bento-grid-is-not-masonry-heres-why-and-what-to-use-when-a-quick-guide-for-ui-ux-designers/)
- [9elements · Building a combined CSS aspect-ratio grid](https://9elements.com/blog/building-a-combined-css-aspect-ratio-grid/)
- [CSS-Tricks · Aspect Ratios for Grid Items](https://css-tricks.com/aspect-ratios-grid-items/)
- [web.dev · CSS subgrid](https://web.dev/articles/css-subgrid)
- [MDN · CSS Subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Subgrid)
- [Smashing Magazine · Beyond border-radius — CSS corner-shape (March 2026)](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/)
- [webdevsimplified · I Love the New CSS corner-shape Property](https://blog.webdevsimplified.com/2026-05/corner-shape/)
- [Amit Merchant · The modern way to draw squircles using corner-shape in CSS](https://www.amitmerchant.com/the-modern-way-to-draw-squircles-using-corner-shape-in-css/)
- [Ryan Mulligan · CSS @property and the New Style](https://ryanmulligan.dev/blog/css-property-new-style/)
- [CSS-Tricks · Animating a CSS Gradient Border](https://css-tricks.com/animating-a-css-gradient-border/)
- [Codrops · Sticky Grid Scroll (March 2026)](https://tympanus.net/codrops/2026/03/02/sticky-grid-scroll-building-a-scroll-driven-animated-grid/)
- [Codrops · SVG Mask Transitions on Scroll (March 2026)](https://tympanus.net/codrops/2026/03/11/svg-mask-transitions-on-scroll-with-gsap-and-scrolltrigger/)
- [Josh Comeau · Scroll-Driven Animations](https://www.joshwcomeau.com/animation/scroll-driven-animations/)
- [Chrome for Developers · Scroll-driven animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations)
- [DevToolbox · CSS Scroll-Driven Animations Guide](https://devtoolbox.dedyn.io/blog/css-scroll-animations-guide)
- [MDN · CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- [Bram.us · Rearrange / Animate CSS Grid with View Transition API](https://www.bram.us/2023/05/09/rearrange-animate-css-grid-layouts-with-the-view-transition-api/)
- [patterns.dev · Animating View Transitions](https://www.patterns.dev/vanilla/view-transitions/)
- [MDN · View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [Open Props](https://open-props.style/)
- [CSS-Tricks · Open Props and Custom Properties as a System](https://css-tricks.com/open-props-and-custom-properties-as-a-system/)
- [OKLCH ecosystem (Evil Martians)](https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools)
- [Midrocket · UI Design Trends for 2026](https://midrocket.com/en/guides/ui-design-trends-2026/)
- [WriterDock · Bento Grids & Beyond: 7 UI Trends 2026](https://writerdock.in/blog/bento-grids-and-beyond-7-ui-trends-dominating-web-design-2026)
- [SaaSUI · 7 SaaS UI Design Trends 2026](https://www.saasui.design/blog/7-saas-ui-design-trends-2026)
- [LayoutScene · Card UI Design Patterns Guide 2026](https://www.layoutscene.com/card-ui-design-patterns-guide-2026/)
- [Baltech · Bento Grids for AI Dashboards](https://baltech.in/blog/bento-grids-for-ai-dashboards/)
- [Deck.Gallery · Bento Grid Slides from Apple's September '23 Event](https://www.deck.gallery/deck/bento-grid-slides-from-apples-september-23-event)
- [Medium · Jeffrey Hasan.C — Apple's Bento Grid Secret](https://medium.com/@jefyjery10/apples-bento-grid-secret-how-a-lunchbox-layout-sells-premium-tech-7c118ce898aa)
