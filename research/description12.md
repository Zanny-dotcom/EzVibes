# Research Description 12: Card-Based Grid Layouts for Content Collections (2025-2026)

**Research Agent**: #12 of 30
**Focus**: Card-based grid layouts for prompt vault / markdown collection panel inside EZvibes
**Target host**: Electron 33 desktop app, vanilla JS/HTML/CSS, no React, no bundler
**Output context**: A side panel ("vault") inside each session window that displays markdown/prompt files as visual cards. Click → paste to terminal.

---

## Executive Summary

In 2025–2026 the "card grid" stopped being a sleepy CMS pattern and became the dominant content-collection UX. The bento grid is on 67% of top SaaS landing pages (up from 25% two years prior), CSS Grid `auto-fill`/`auto-fit` with `minmax()` is the universal recipe, and four big platform shifts are reshaping how cards feel: (1) native CSS masonry / `grid-template-rows: masonry` shipped in Safari 26 and is behind flags in Chrome/Firefox; (2) `@starting-style` enables one-line entry animations with zero JavaScript; (3) `sibling-index()` / `sibling-count()` enable native staggered animations across N children; (4) `corner-shape: squircle` lets cards have Apple-grade Liquid-Glass-style smoothed corners.

The pioneer-level patterns to lift directly into the EZvibes vault are: **the Stripe-flashlight container grid** (radial gradient follows cursor across the whole vault, illuminating cards beneath), **the spotlight-on-active-card pattern** (hovered card stays sharp, other cards blur), **scroll-driven staggered "dealing-cards" entrance** with `animation-timeline: view()`, and **`view-transition-name`-driven morphs** when a card expands into a preview pane.

Everything below is implementation-ready: CSS values, JS code, library names with version notes, and direct mappings to the EZvibes project.

---

## Table of Contents

1. [The Real Apps to Steal From](#1-the-real-apps-to-steal-from)
2. [CSS Grid Recipes: auto-fit vs auto-fill, minmax, responsiveness](#2-css-grid-recipes-auto-fit-vs-auto-fill-minmax-responsiveness)
3. [Masonry Layouts: native CSS, library options, column-count fallback](#3-masonry-layouts-native-css-library-options-column-count-fallback)
4. [Hover Effects: lift, glow, accent slide, content reveal, parallax tilt](#4-hover-effects-lift-glow-accent-slide-content-reveal-parallax-tilt)
5. [Stagger Animations on Card Grid Load](#5-stagger-animations-on-card-grid-load)
6. [Card Aspect Ratios for Markdown Previews](#6-card-aspect-ratios-for-markdown-previews)
7. [Content Density: previews, icons, timestamps, tag chips](#7-content-density-previews-icons-timestamps-tag-chips)
8. [Drag-to-Reorder Cards (vanilla JS friendly)](#8-drag-to-reorder-cards-vanilla-js-friendly)
9. [3D Card Lift (rotate + translate-z) effect](#9-3d-card-lift-rotate--translate-z-effect)
10. [Color Treatments: backgrounds, accent strips, dividers](#10-color-treatments-backgrounds-accent-strips-dividers)
11. [Pioneer-level Bonus Patterns](#11-pioneer-level-bonus-patterns)
12. [Concrete Mapping to the EZvibes Vault](#12-concrete-mapping-to-the-EZvibes-vault)
13. [References](#13-references)

---

## 1. The Real Apps to Steal From

### Notion — Gallery View

- **Card preview options**: "Page cover" (uses cover image), "Page content" (renders first block — if it's an image, that becomes the thumbnail; otherwise renders first lines of markdown rendered), or "Files & media property" (picks the named property).
- **Three card sizes**: Small / Medium / Large (Medium is default). Small cards have ~150–180 px width slots; Large pushes to ~360 px.
- **Recommended cover aspect**: 5:2 (1500 × 600 px) — designed for landscape banner-style art. For prompt cards this is too wide; 4:3 or 1:1 is better.
- **Property visibility toggle** ("eye" icon): hide/show date, tag, status per card.
- **Markdown rendering**: previews render rich text (heading, list, callout, code block) but truncate at ~3 lines.
- **What to copy for the EZvibes vault**: a sliding size selector (S / M / L) baked into the vault header; per-card icon + first markdown heading + last-modified + 2-line preview; tags from frontmatter rendered as chips.

### Linear — Card UI (issue cards, project cards)

- **LCH color space** for theme generation. Surfaces have elevation tokens (background, foreground, panel, dialog, modal).
- **Cards are flat-ish**: 1 px subtle border (`rgba(255,255,255,0.06)` over dark surface) + 12 px border-radius; no heavy shadow. Hover: border lightens to `rgba(255,255,255,0.12)`.
- **Density per card**: title (sm/medium weight), tiny status pill, project icon, assignee avatar — all in a single row. Dates and tags collapse on narrow widths.
- **Active selection**: not a shadow — a 2-px inset accent border (uses LCH for AA contrast). This is the "Linear stripe."
- **2026 redesign**: bold typography, complex gradients on hero cards, glassmorphism on panels overlaying content.

### Raycast — Grid Component

- Native `Grid` UI component (Raycast extensions API) supporting **column count 1–8** with `fit: "contain"` default.
- Each grid item: a large square icon, a title underneath, optional subtitle. Cards are uniform; no masonry.
- Store extension grid: 2-up at desktop, collapsing to 1-up at mobile; horizontal cards (icon left, title + install-button right).
- **What to copy**: the fixed column-count slider as a power-user control, and the "icon dominant, title second" hierarchy — perfect for prompts where the icon is "P", "MD", "HANDOFF" etc.

### Apple Notes — Gallery View (iOS 26 / iPadOS 26)

- **Liquid Glass design** (iOS 26 introduces this): translucent, frosted, softly-glowing card backgrounds with refractive bezel. Built on Apple's new material engine.
- **No sidebar** in gallery view — tap on card opens note full-screen.
- Subfolders surface at the top of the gallery.
- Quick filters for date / type / custom.
- Aspect ratio: **rounded squares**, approximately 1:1 with smoothed-corner squircles.
- **What to copy**: the iOS 26 squircle corner-shape pattern (see Section 11), and the "subfolders first, files second" layout for hand-off folders.

### Bear

- Bear's grid is still primarily a list, but the community has begged for an "XL" card mode that renders markdown previews — recent updates in late 2025 added this.
- The wins: 28+ themes, every typographic detail tweakable, URL paste creates a visual preview card with favicon + title + summary — exactly the metaphor the EZvibes vault could use for `.md` previews.

### Trello

- **3-row top-level grid**: app bar (fixed), board bar (fixed), card lists (Y-overflow auto, X-overflow scroll).
- Inside a column, cards are draggable, with **subtle shadow lift on hover** (`box-shadow: 0 1px 0 #091e4240` → `0 2px 4px #091e4250`). Drag preview gets a 5° rotate for tactile feel.
- 2024–2025 update: hover effects include shadow lift OR scale transform — never both.

### Obsidian Canvas

- An **infinite spatial canvas** where note cards live at arbitrary positions, can be resized, connected by arrows, contain embeds (PDFs, video, images, web pages).
- Cards can run code snippets inline (when configured) — the "live block" pattern.
- For the EZvibes vault: Canvas-style _free placement with arrow connectors_ is overkill, but the inline-code-running idea is exactly what "click to paste to terminal" already does — your vault is essentially a Canvas where every node is a launchable prompt.

### Supernotes

- **Three views**: List, Broadsheet (grid), Graph (nodes).
- "Excellent card format" — short notes with rendered markdown — praised by users.
- Supports rich content per card: math, tables, images, checklists, emoji.
- Horizontal-mode column toggle (full-width cards).

### Pinterest

- The reference masonry grid. Algorithm: greedy column-fill — each new pin goes into the currently-shortest column.
- 2025 native pretexting (the `pretext-masonry` library on GitHub) predicts card height before render to avoid layout shifts.

---

## 2. CSS Grid Recipes: auto-fit vs auto-fill, minmax, responsiveness

### The canonical responsive card grid

```css
.vault-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 16px;
  align-items: start; /* prevents stretched cards */
}
```

That single declaration:
- creates as many columns as fit at ≥ 220 px each;
- if there are 4 columns of space and only 3 cards, **auto-fill** leaves the 4th column slot empty (reserves space);
- **auto-fit** instead collapses unused tracks and stretches existing cards to fill;
- gaps of 12–24 px are the sweet spot — below 8 px tiles merge, above 32 px they feel disconnected.

### The bento grid (asymmetric, named areas)

Bento is now the **default SaaS landing pattern** (67% adoption per 2026 audits). For the vault we don't need full bento, but the principle — let some cards span more cells — is what makes a CLAUDE.md card stand out vs a 1-cell prompt.md card.

```css
.bento {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  padding: 24px;
}

.bento .hero      { grid-column: span 6; grid-row: span 2; }
.bento .feature   { grid-column: span 4; grid-row: span 1; }
.bento .metric    { grid-column: span 3; grid-row: span 1; }
.bento .accent    { grid-column: span 2; grid-row: span 1; }
```

### Named areas (more readable)

```css
.bento {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-areas:
    "hero hero hero hero hero hero metric1 metric1 metric1 metric2 metric2 metric2"
    "hero hero hero hero hero hero chart   chart   chart   chart   alert   alert";
  gap: 16px;
}

.tile-hero    { grid-area: hero; }
.tile-metric1 { grid-area: metric1; }
.tile-chart   { grid-area: chart; }
.tile-alert   { grid-area: alert; }
```

### CSS Subgrid for aligned card internals

Universal browser support hit ~97% global in 2025–2026. Solves the "title row alignment" pain: when cards have different title lengths, all titles still align horizontally because the inner grid inherits row tracks from the outer grid.

```css
.vault-grid { display: grid; gap: 16px; }
.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 4; /* icon | title | preview | meta */
}
```

### Container queries (component-level responsiveness)

When the vault sidebar is narrowed, the inner cards re-flow by **container width**, not viewport width:

```css
.vault-panel { container-type: inline-size; }

.vault-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

@container (max-width: 400px) {
  .vault-grid {
    grid-template-columns: 1fr; /* stack inside narrow panel */
  }
}
```

### Performance rules

- Use **`fr` units** rather than fixed px for tracks.
- Animate **only** `transform` + `opacity` (compositor-only). Box-shadow transitions trigger repaints; use a pseudo-element trick if shadow animation matters.
- For 60 fps, animate `transform: translateY()` instead of `top` / `margin`.

---

## 3. Masonry Layouts: native CSS, library options, column-count fallback

### Native CSS Masonry (a.k.a. "grid-lanes") status — May 2026

| Browser | Status (May 2026) |
|---|---|
| **Safari 26** | First to ship full native support |
| **Chrome / Edge 140+** | Behind `about://flags` → "CSS Masonry Layout" |
| **Firefox** | Prototype + grid-lanes adoption pending; no public timeline |

Final agreed name: `grid-lanes`. WebKit shipped the original `grid-template-rows: masonry` syntax; Chrome favored `grid-lanes`; the spec resolved to reuse grid templating + placement properties.

### Three-tier progressive enhancement

```css
/* 1. Standard grid (always-on baseline) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  align-items: start;
}

/* 2. Masonry value (Safari 26) */
@supports (grid-template-rows: masonry) {
  .card-grid { grid-template-rows: masonry; }
}

/* 3. Future grid-lanes display mode */
@supports (display: grid-lanes) {
  .card-grid {
    display: grid-lanes;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
}
```

Native CSS masonry preserves **DOM order**, fixing the screen-reader/keyboard-tab nightmare of column-count.

### Library options (production today)

| Library | Bundle | Pros | Cons |
|---|---|---|---|
| **masonry-layout** (Desandro) | ~24 KB | Battle-tested, used by Pinterest-like sites since 2013 | jQuery vestige, no virtualization |
| **react-masonry-css** | ~3 KB | Tiny, pure CSS columns, simple breakpoints | No virtualization (renders all items) |
| **Masonic** | ~15 KB | Virtualizes — DOM only holds visible cards | Manual IntersectionObserver for infinite scroll |
| **Masonry Grid** | 1.4 KB | Zero deps, lightweight | Newer, smaller community |
| **pretext-masonry** | — | Predicts height before render → no shift, virtualizes 10K+ | React-specific |

For the EZvibes vault — vanilla JS, max maybe 200 prompt cards — go with the **column-count fallback** (Section below) until Chrome ships native masonry, then progressively enhance.

### Pure CSS column-count fallback (works everywhere, today)

```css
.masonry {
  column-count: 4;
  column-gap: 16px;
}

.masonry > * {
  break-inside: avoid;
  margin-bottom: 16px;
  /* card body */
}

@media (max-width: 1200px) { .masonry { column-count: 3; } }
@media (max-width: 800px)  { .masonry { column-count: 2; } }
@media (max-width: 500px)  { .masonry { column-count: 1; } }
```

**Caveat**: reading order is top-to-bottom inside each column then next column (1-2-3 / 4-5-6 / 7-8-9). Tab order follows DOM — so users may tab "1 → 4 → 7 → 2 → 5 → 8 → 3 → 6 → 9". For a prompt vault sorted by date, this is mostly fine since proximity matters less than recency. If hand-offs are added live, you can sort newest-first and put them in column 1 row 1 — visible immediately.

---

## 4. Hover Effects: lift, glow, accent slide, content reveal, parallax tilt

### 4a. The classic lift (shadow + translate-Y)

```css
.card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 2px 4px oklch(0 0 0 / 0.2);
  transition:
    transform 240ms cubic-bezier(.2,.7,.1,1),
    box-shadow 240ms cubic-bezier(.2,.7,.1,1),
    border-color 240ms;
}

.card:hover,
.card:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px oklch(0 0 0 / 0.35);
  border-color: rgba(255,255,255,0.12);
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card:hover { transform: none; transition: none; }
}
```

Why these values: 240 ms is at the **upper edge of "instant"** — short enough to feel snappy, long enough to read as motion. `oklch()` is perceptually uniform → shadows look correctly weighted in dark mode.

### 4b. Accent border slide (the "Linear" pattern)

Border feels like it slides in from one side. Uses a pseudo-element with `transform: scaleX(0)` and `transform-origin: left`.

```css
.card {
  position: relative;
  isolation: isolate;
}

.card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: linear-gradient(135deg, #f5a623, #ff7e29);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 200ms ease;
}

.card:hover::before { opacity: 1; }
```

This is the **mask-xor "gradient border" trick** — gradient fills a 1.5 px padding ring, and the inner content-box mask carves the middle out.

### 4c. Stripe-flashlight (radial gradient follows cursor)

The most-cloned modern effect. Cursor moves anywhere on the grid; each card under the cursor lights up via a radial gradient pinned to the local mouse position.

**HTML**

```html
<div class="cards" data-flashlight>
  <article class="card">Prompt A</article>
  <article class="card">Prompt B</article>
  <!-- ... -->
</div>
```

**CSS**

```css
.card {
  position: relative;
  background: #1a1a1d;
  border-radius: 14px;
  overflow: hidden;
}

.card::before {
  content: "";
  position: absolute;
  inset: -1px;
  background: radial-gradient(
    250px circle at var(--x, -100px) var(--y, -100px),
    rgba(255, 174, 90, 0.18),
    transparent 40%
  );
  pointer-events: none;
  opacity: 0;
  transition: opacity 200ms;
}

.cards:hover .card::before { opacity: 1; }
```

**JS (vanilla, fits EZvibes renderer)**

```js
const container = document.querySelector('[data-flashlight]');
container.addEventListener('pointermove', (e) => {
  for (const card of container.querySelectorAll('.card')) {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--x', `${e.clientX - r.left}px`);
    card.style.setProperty('--y', `${e.clientY - r.top}px`);
  }
});
```

**Why it works**: a single `pointermove` listener on the parent updates CSS custom properties on each card; the gradient repaints on the compositor thread; reads as if every card has its own "flashlight" without per-card listeners.

### 4d. Spotlight cards (Aceternity / Cruip / Magic-UI)

Same idea, but with **two layers**: an outer "border glow" that follows the cursor and an inner "card spotlight."

```css
.spotlight-card {
  position: relative;
  border-radius: 14px;
  background: #1a1a1d;
  padding: 16px;
}

/* Outer border glow */
.spotlight-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(
    600px circle at var(--mx, 0) var(--my, 0),
    rgba(255, 220, 120, 0.6),
    transparent 40%
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* Inner card spotlight */
.spotlight-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    240px circle at var(--mx, 0) var(--my, 0),
    rgba(255, 220, 120, 0.08),
    transparent 40%
  );
  pointer-events: none;
}
```

Tracked the same way as 4c.

### 4e. Focus cards (hovered = sharp; others = dimmed/blurred)

The vault use case where you scan a grid full of prompts and want **only the one under the cursor** to look "alive."

```css
.vault-grid:has(.card:hover) .card:not(:hover) {
  filter: blur(2px) brightness(0.7);
  transition: filter 200ms;
}

.card:hover {
  filter: none;
  transform: scale(1.02);
  z-index: 2;
}
```

This uses `:has()` (now stable everywhere). When any `.card` is hovered, all sibling cards that aren't get blurred.

### 4f. Content reveal (slide-up panel)

```css
.card {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
}

.card .preview {
  position: absolute;
  inset: auto 0 0 0;
  padding: 16px;
  background: linear-gradient(to top, #0a0a0a 60%, transparent);
  transform: translateY(100%);
  transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover .preview { transform: translateY(0); }
```

`overflow: hidden` clips the panel until hover. Combine with a slight scale on the card icon for tactile feedback.

### 4g. Parallax tilt (vanilla-tilt.js, the gold-standard library)

```html
<script src="vanilla-tilt.js"></script>
<div class="card" data-tilt data-tilt-max="6" data-tilt-glare data-tilt-max-glare="0.2"></div>
```

```js
VanillaTilt.init(document.querySelectorAll('.card'), {
  reverse: false,
  max: 6,                                  // 6° feels luxurious; 15°+ feels arcade
  perspective: 1200,
  easing: 'cubic-bezier(.03,.98,.52,.99)',
  scale: 1.02,
  speed: 400,
  transition: true,
  glare: true,
  'max-glare': 0.2,                        // soft, not blinding
  reset: true,
});
```

Library is ~3 KB, no dependencies, uses `requestAnimationFrame`. The `glare` adds a moving white sheen that tracks the cursor — perfect for a "premium" prompt vault card.

Alternative: **Atropos** (heavier, more features), **Card3d.js** (mobile-gyroscope friendly).

---

## 5. Stagger Animations on Card Grid Load

### 5a. The 2026 pioneer: pure-CSS stagger with `sibling-index()`

`sibling-index()` / `sibling-count()` ship in **Chrome 137+** (May 2026: behind support but actively rolling out; Firefox ticket open). They return integers usable in `calc()`.

```css
.card {
  opacity: 0;
  transform: translateY(8px);
  animation: card-in 400ms ease forwards;
  animation-delay: calc(sibling-index() * 60ms);
}

@keyframes card-in {
  to { opacity: 1; transform: translateY(0); }
}
```

That's the entire stagger. No JS, no loops, no per-element classes. Works for any N.

**With reverse stagger (last-first)**

```css
.card {
  animation-delay: calc((sibling-count() - sibling-index()) * 60ms);
}
```

**With progressive enhancement**

```css
.card {
  animation: card-in 400ms ease forwards;
  animation-delay: 0ms;
}

@supports (animation-delay: calc(sibling-index() * 1ms)) {
  .card {
    animation-delay: calc(sibling-index() * 60ms);
  }
}
```

### 5b. The previous-state-of-the-art: `:nth-child()` ladders

Works in 100% of browsers since forever:

```css
.card {
  opacity: 0;
  transform: translateY(8px);
  animation: card-in 400ms ease forwards;
}

.card:nth-child(1)  { animation-delay:   0ms; }
.card:nth-child(2)  { animation-delay:  60ms; }
.card:nth-child(3)  { animation-delay: 120ms; }
.card:nth-child(4)  { animation-delay: 180ms; }
.card:nth-child(5)  { animation-delay: 240ms; }
/* … up to a sensible N (12–20) */
```

Verbose but bulletproof.

### 5c. `@starting-style` + transitions (Chrome 117+, Safari 17.5+, Firefox 129+; ~87% global)

```css
.card {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 400ms, transform 400ms;

  @starting-style {
    opacity: 0;
    transform: translateY(8px);
  }
}
```

When a card is appended to the DOM, the browser uses the `@starting-style` block as the initial state and transitions to the rule's main values. No JS, no keyframes.

For staggering, combine with `transition-delay: calc(sibling-index() * 60ms)`.

**Gotcha**: `@starting-style` only fires on element first-display. If a card's `display: none` then `display: block`, that re-triggers. JavaScript inline styles override class values via specificity — keep your data attributes / classes and avoid setting `transform` directly via `element.style`.

### 5d. JS approach (works today, every browser)

```js
const cards = document.querySelectorAll('.card');
cards.forEach((card, i) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(8px)';
  card.style.transition = 'opacity 400ms ease, transform 400ms ease';
  card.style.transitionDelay = `${i * 60}ms`;
  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });
});
```

### 5e. Motion library (Framer Motion / Motion One)

```js
import { animate, stagger } from 'motion';

animate(
  '.card',
  { opacity: [0, 1], y: [8, 0] },
  { duration: 0.4, delay: stagger(0.06, { from: 'first' }) }
);
```

`from` accepts: `"first"`, `"center"`, `"last"`, or a numeric index. `ease` can redistribute stagger across total duration via cubic-bezier arrays.

### 5f. Scroll-driven "deal-the-cards" entrance

When new prompts scroll into view, animate them in based on scroll position. Universal browser support landed in 2026.

```css
.card {
  animation: deal-in linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 25%;
}

@keyframes deal-in {
  0%   { opacity: 0; transform: translateY(30px) rotate(-2deg); }
  100% { opacity: 1; transform: translateY(0)    rotate(0); }
}
```

`animation-timeline: view()` ties the animation to whether the card is visible in its scroll port. `animation-range: entry 0% cover 25%` means "animate from when the card just enters the visible region to when it's 25% covered." Zero JS, runs on the compositor.

---

## 6. Card Aspect Ratios for Markdown Previews

| Ratio | padding-top | Good for | Notes |
|---|---|---|---|
| 1:1 | 100% | Icon-dominant prompts, tile galleries | Apple-Notes-gallery vibe |
| 4:3 | 75% | Balanced text + heading | Notion default-ish |
| 3:2 | 66.66% | Slightly wider, "post card" feel | Camera ratio |
| 5:4 | 80% | Editorial, generous title space | Square-ish but breathing |
| 16:9 | 56.25% | Banner-style, cover art | Notion's 5:2 is close |
| Auto | none | Masonry, free flow | Best when length varies |

For a markdown vault with mixed file types (CLAUDE.md huge, prompt.md medium, hand-off.md sometimes short), **mixed aspect ratios via masonry** or **`grid-row: span N` based on content height** is most honest.

A pragmatic compromise:

```css
.card-md      { aspect-ratio: 5 / 4; }   /* default prompt cards */
.card-handoff { aspect-ratio: 4 / 3; }   /* hand-offs read more like notes */
.card-claudemd{ aspect-ratio: 3 / 2; }   /* CLAUDE.md is hero / wider */
.card-doc     { aspect-ratio: 1 / 1; }   /* misc docs */
```

Apply via class. Use `object-fit: cover` for any cover image; for text previews use `mask-image: linear-gradient(180deg, #000 60%, transparent)` to fade the bottom out.

### The aspect-ratio + max-height + overflow trick

```css
.card {
  aspect-ratio: 5 / 4;
  display: grid;
  grid-template-rows: auto 1fr auto; /* header | preview | footer */
}

.card .preview {
  overflow: hidden;
  -webkit-mask: linear-gradient(180deg, #000 60%, transparent 100%);
          mask: linear-gradient(180deg, #000 60%, transparent 100%);
}
```

---

## 7. Content Density: previews, icons, timestamps, tag chips

### 7a. Icon dominant (à la Raycast)

```html
<article class="card">
  <div class="card__icon" aria-hidden="true">📝</div>
  <h3 class="card__title">Refactor terminal sizing</h3>
  <p class="card__preview">Wait for genie + fonts.ready + 2 RAFs before fitAddon.fit()…</p>
  <footer class="card__meta">
    <time datetime="2026-05-23">2 days ago</time>
    <span class="chip">handoff</span>
    <span class="chip chip--accent">EZvibes</span>
  </footer>
</article>
```

For a markdown vault, define icon by extension or filename keyword:

```js
function iconFor(filename) {
  const name = filename.toLowerCase();
  if (name.startsWith('claude'))   return '🅒';
  if (name.includes('handoff'))    return '🤝';
  if (name.includes('prompt'))     return '💬';
  if (name.endsWith('.md'))        return '📄';
  return '📄';
}
```

### 7b. Filename → human title

Extract from frontmatter `title:` or fall back to first `#` heading or filename minus extension. Render with prose font (Inter / Geist) — never monospace.

### 7c. Last-modified, relative

```js
function timeAgo(date) {
  const sec = (Date.now() - date.getTime()) / 1000;
  if (sec <  60)    return 'just now';
  if (sec < 3600)   return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400)  return `${Math.floor(sec/3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec/86400)}d ago`;
  return date.toLocaleDateString();
}
```

Use `Intl.RelativeTimeFormat` if you want locale-aware output.

### 7d. Tag chips

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;            /* pill */
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  line-height: 1.5;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  border: 1px solid rgba(255,255,255,0.04);
}

.chip--accent {
  background: rgba(255,174,90, 0.12);
  color: #ffae5a;
  border-color: rgba(255,174,90, 0.2);
}

.chip--danger {
  background: rgba(255, 90, 90, 0.12);
  color: #ff5a5a;
  border-color: rgba(255, 90, 90, 0.2);
}
```

Sources: Material Design 3 chips (filter, suggest, input, assist); Apple's Capsules; ServiceNow Horizon's `now-pill`. Pill = very-rounded chip (often interchangeable). Chips usually allow icons + close X; pills are simpler.

### 7e. Markdown body preview

Strip frontmatter, strip first H1 (it's the title), trim to 160–240 chars. Keep no markdown syntax (`#`, `-`, `*` confuse readers in small font). Use a lightweight regex or `remark` if you want fidelity:

```js
function plainTextPreview(md, len = 220) {
  return md
    .replace(/^---[\s\S]*?---\n/, '')   // frontmatter
    .replace(/^# .+\n/, '')              // first H1
    .replace(/```[\s\S]*?```/g, '⟨code⟩')// code blocks → marker
    .replace(/[#*>`_~]/g, '')            // markdown chars
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // links → text
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, len) + '…';
}
```

---

## 8. Drag-to-Reorder Cards (vanilla JS friendly)

### Library options

| Library | Notes |
|---|---|
| **SortableJS** | Vanilla JS, framework-agnostic, ~30 KB. Long pedigree (2013→). Best for EZvibes. |
| **@dnd-kit** | React-first, ~10 KB core. Excellent if you ever migrate to React. |
| **react-grid-layout** | Drag + resize + breakpoints; overkill for the vault. |
| **gridstack.js** | Same as above. Useful for dashboard widgets. |

### SortableJS basic usage (vanilla)

```html
<script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
<div id="vault-grid" class="vault-grid">
  <div class="card" data-id="prompt-a.md">Prompt A</div>
  <div class="card" data-id="prompt-b.md">Prompt B</div>
</div>

<script>
  Sortable.create(document.getElementById('vault-grid'), {
    animation: 200,
    ghostClass: 'card--ghost',
    dragClass: 'card--drag',
    onEnd(evt) {
      const order = [...evt.to.children].map(c => c.dataset.id);
      window.ezvibes.saveVaultOrder(order);
    },
  });
</script>
```

```css
.card--ghost { opacity: 0.35; }
.card--drag  { transform: rotate(2deg) scale(1.04); cursor: grabbing; }
```

For the EZvibes vault, drag-to-reorder is **optional** but very modern. The likely "save the order" target: a small `.vaultorder.json` file inside the same folder. Live file-watcher (chokidar) detects the change → other sessions resync.

### Native HTML5 drag API (no library)

Works but is jankier and animations are bad. Use only if the dependency cost matters.

---

## 9. 3D Card Lift (rotate + translate-z) effect

### CSS-only minimal version

```css
.card-stage {
  perspective: 1200px;
}

.card {
  transform-style: preserve-3d;
  transition: transform 240ms cubic-bezier(.2,.7,.1,1);
}

.card:hover {
  transform: rotateX(6deg) rotateY(-6deg) translateZ(20px);
}
```

`perspective` lives on the **parent**, not the card. `transform-style: preserve-3d` on the card lets child elements live at different Z depths.

### Layered depth (parallax inside the card)

```html
<div class="card-stage">
  <div class="card">
    <div class="card__icon  card__layer" style="--z: 60px;">📝</div>
    <h3 class="card__title  card__layer" style="--z: 40px;">Refactor</h3>
    <p   class="card__preview card__layer" style="--z: 20px;">…</p>
    <p   class="card__bg    card__layer" style="--z: 0px;"></p>
  </div>
</div>
```

```css
.card__layer {
  transform: translateZ(0);
  transition: transform 300ms cubic-bezier(.2,.7,.1,1);
}

.card:hover .card__layer {
  transform: translateZ(var(--z));
}
```

Now hovering pops icon further out than title further out than preview — Apple TV poster feel.

### Mouse-driven 3D tilt (no library, vanilla)

```js
function attachTilt(card, maxDeg = 6) {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform =
      `rotateX(${-py * maxDeg * 2}deg) ` +
      `rotateY(${ px * maxDeg * 2}deg) ` +
      `translateZ(20px)`;
  });
  card.addEventListener('pointerleave', () => {
    card.style.transform = '';
  });
}

document.querySelectorAll('.card').forEach(c => attachTilt(c));
```

That's < 20 lines of vanilla JS — perfect for EZvibes.

### Add glare with a moving radial gradient

```css
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    600px circle at var(--mx, 0) var(--my, 0),
    rgba(255,255,255,0.18),
    transparent 40%
  );
  pointer-events: none;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 200ms;
}

.card:hover::after { opacity: 1; }
```

Update `--mx` / `--my` in the same `pointermove` handler.

---

## 10. Color Treatments: backgrounds, accent strips, dividers

### 10a. Card surface tokens

Modern dark-theme card token set (heavily borrowed from Linear + Radix Colors + Tailwind v4 `oklch()`):

```css
:root {
  --vault-bg:          oklch(0.18 0.005 280);
  --card-bg:           oklch(0.22 0.008 280);
  --card-bg-hover:     oklch(0.26 0.010 280);
  --card-bg-active:    oklch(0.30 0.012 280);

  --card-border:       oklch(1 0 0 / 0.06);
  --card-border-hover: oklch(1 0 0 / 0.12);
  --card-border-active:oklch(0.75 0.18 65); /* warm orange */

  --card-text:         oklch(0.96 0 0);
  --card-text-muted:   oklch(0.75 0.005 280);

  --accent-warm:       oklch(0.78 0.18 65);
  --accent-cool:       oklch(0.72 0.14 200);
  --accent-success:    oklch(0.72 0.18 145);
  --accent-danger:     oklch(0.68 0.20 25);
}
```

### 10b. Accent-strip-left (file-type tag)

```css
.card {
  position: relative;
  padding-left: 18px;
}

.card::before {
  content: "";
  position: absolute;
  left: 0; top: 8px; bottom: 8px;
  width: 4px;
  border-radius: 4px;
  background: var(--card-accent, var(--accent-cool));
}

.card[data-type="claudemd"] { --card-accent: var(--accent-warm); }
.card[data-type="handoff"]  { --card-accent: var(--accent-success); }
.card[data-type="prompt"]   { --card-accent: var(--accent-cool); }
.card[data-type="readme"]   { --card-accent: var(--accent-danger); }
```

Instantly conveys file type by color before reading the title.

### 10c. Top-accent strip (alternative)

```css
.card::before {
  left: 8px; right: 8px; top: 0;
  width: auto; height: 3px;
  border-radius: 0 0 3px 3px;
}
```

### 10d. Glassmorphism card (Liquid-Glass-adjacent)

```css
.card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 16px;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.06) inset,    /* top highlight */
    0 8px 24px rgba(0,0,0,0.35);
}
```

Rules of thumb (2026 industry consensus):
- blur: **10–20 px** sweet spot;
- background alpha: **0.05–0.10** in dark mode;
- border alpha: **0.1–0.2** white (subtle rim light);
- never stack more than **3 glass layers** — perf cliff.

### 10e. Mesh gradient background (vault-level, behind cards)

```css
.vault-panel {
  background:
    radial-gradient(at 20% 10%, oklch(0.35 0.08 280) 0%, transparent 50%),
    radial-gradient(at 80% 30%, oklch(0.30 0.08 25)  0%, transparent 50%),
    radial-gradient(at 50% 90%, oklch(0.28 0.08 145) 0%, transparent 50%),
    oklch(0.16 0.005 280);
}
```

Three overlapping radial gradients = freeform mesh, no SVG, < 200 bytes of CSS.

### 10f. Divider styles

```css
.vault-section + .vault-section {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 16px;
  margin-top: 16px;
}

/* Or a gradient hairline */
.vault-section + .vault-section {
  background-image:
    linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 50%, transparent);
  background-size: 100% 1px;
  background-position: top;
  background-repeat: no-repeat;
}
```

---

## 11. Pioneer-level Bonus Patterns

These are the patterns that genuinely feel "2026" — not just trendy.

### 11a. `corner-shape: squircle` (Chrome 139+, May 2026)

```css
.card {
  border-radius: 20px;
  corner-shape: squircle;
}
```

The corners blend smoothly (superellipse) instead of forming circular arcs. This is the iOS "Liquid Glass" look. Set via `superellipse(0..1)` for fine control (0 = bevel, 1 = squircle).

Use with `@supports` for fallback:

```css
.card { border-radius: 20px; }

@supports (corner-shape: squircle) {
  .card { corner-shape: squircle; }
}
```

### 11b. Conic-gradient rotating border (with `@property`)

```css
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.card {
  position: relative;
  border-radius: 14px;
  background: #1a1a1d;
}

.card::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: conic-gradient(
    from var(--angle),
    #ff7e29, #ffae5a, #ff7e29
  );
  z-index: -1;
  animation: rotate 6s linear infinite;
  filter: blur(8px);
  opacity: 0.5;
}

@keyframes rotate { to { --angle: 360deg; } }
```

The `@property` rule registers `--angle` as an animatable angle so the browser interpolates it. `filter: blur(8px)` turns the conic gradient into a soft glow.

Chromium-only as of 2026 (Firefox / Safari haven't shipped `@property`).

### 11c. View-Transitions API morph (card → detail pane)

Cross-browser (Chrome 114+, Edge 114+, Safari 17+, Firefox 125+). Apply a `view-transition-name` to the card you're expanding; the browser auto-morphs position, size, and opacity.

```css
.card[data-active="true"] {
  view-transition-name: active-card;
}

.detail-pane {
  view-transition-name: active-card;
}
```

```js
function openDetail(card) {
  if (!document.startViewTransition) {
    showDetail(card);
    return;
  }
  document.startViewTransition(() => showDetail(card));
}
```

The browser captures the card's bounding box, then captures the detail pane's bounding box, then animates between them with GPU-accelerated frames. No keyframes, no easing curves to write.

### 11d. Scroll-driven masonry reveal

```css
.card {
  opacity: 0;
  transform: translateY(40px) rotate(-2deg);
  animation: deal-in linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}

@keyframes deal-in {
  to { opacity: 1; transform: translateY(0) rotate(0); }
}
```

Cards "deal" themselves onto the screen as they scroll into view. Works without JS, runs on compositor thread.

### 11e. CSS `:has()` parent-driven theming

Vault dims everything else when a card has focus:

```css
.vault-grid:has(.card:focus-within) .card:not(:focus-within) {
  opacity: 0.55;
  filter: saturate(0.6);
  transition: opacity 200ms, filter 200ms;
}
```

Or vault changes accent color when a "handoff" card is focused:

```css
.vault-grid:has(.card[data-type="handoff"]:hover) {
  --vault-glow-color: var(--accent-success);
}
```

### 11f. Live filter chips with `:checked` + `:has()`

```html
<input type="checkbox" id="filter-handoff" class="filter-chip" />
<label for="filter-handoff">handoffs</label>
<input type="checkbox" id="filter-prompt"  class="filter-chip" />
<label for="filter-prompt">prompts</label>

<div class="vault-grid">
  <article class="card" data-type="handoff">…</article>
  <article class="card" data-type="prompt">…</article>
</div>
```

```css
body:has(#filter-handoff:checked) .card:not([data-type="handoff"]) { display: none; }
body:has(#filter-prompt:checked)  .card:not([data-type="prompt"])  { display: none; }
```

Filtering with **zero JavaScript**.

### 11g. Stripe-style ambient grid (the WHOLE container glows)

In addition to per-card flashlight (Section 4c), light a faint halo around the entire vault container at the cursor:

```css
.vault-panel {
  position: relative;
  isolation: isolate;
}

.vault-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    400px circle at var(--vx, 50%) var(--vy, 50%),
    rgba(255, 174, 90, 0.08),
    transparent 60%
  );
  pointer-events: none;
  z-index: -1;
}
```

```js
vaultPanel.addEventListener('pointermove', (e) => {
  const r = vaultPanel.getBoundingClientRect();
  vaultPanel.style.setProperty('--vx', `${e.clientX - r.left}px`);
  vaultPanel.style.setProperty('--vy', `${e.clientY - r.top}px`);
});
```

### 11h. Animated copy-confirmation (the paste-to-terminal moment)

When the user clicks a card and the contents paste into the terminal, the card itself should give immediate feedback. Three layered effects:

```css
@keyframes copied-flash {
  0%   { box-shadow: 0 0 0 0 rgba(255, 220, 120, 0.6); }
  100% { box-shadow: 0 0 0 18px rgba(255, 220, 120, 0); }
}

@keyframes copied-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(0.97); }
}

.card.is-copied {
  animation:
    copied-flash 700ms ease-out,
    copied-pulse 220ms ease-in-out;
}

.card.is-copied .card__icon::after {
  content: "✓";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: oklch(0.72 0.18 145); /* green */
  color: white;
  border-radius: inherit;
  animation: copied-icon-pop 700ms cubic-bezier(.2, 1.6, .4, 1) both;
}

@keyframes copied-icon-pop {
  0%   { opacity: 0; transform: scale(0.6); }
  20%  { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0; transform: scale(1); }
}
```

```js
function flashCopied(card) {
  card.classList.add('is-copied');
  setTimeout(() => card.classList.remove('is-copied'), 700);
}
```

### 11i. Smart-fill (progress sweep across border)

When a hand-off file is being saved by another session and is partial, animate a progress sweep around the border. Conic gradient with the angle as the progress:

```css
.card[data-progress] {
  --progress: 0; /* 0..1 */
}

.card[data-progress]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    var(--accent-warm) calc(var(--progress) * 360deg),
    transparent 0
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}
```

Update `--progress` from JS as bytes-written percentage.

---

## 12. Concrete Mapping to the EZvibes Vault

### Layout

- **Vault panel**: collapsible right-side panel inside each session window (mirror of "What Was Made" narration sidebar already in the renderer).
- **Container**: `container-type: inline-size` so it reflows by width independent of viewport.
- **Grid**: `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))` with `gap: 12px`. Tile size selector (S 140 / M 180 / L 240).
- **Sort**: newest-first by `mtime`. Optional manual reorder via SortableJS.
- **Filter**: chips for type (handoff / prompt / md / claudemd) plus a search input; pure `:has()` filtering.

### Per-card

```html
<button class="card"
        type="button"
        data-type="prompt"
        data-path="C:\Users\Oskari\…\prompt-refactor.md"
        data-mtime="2026-05-23T10:14:00Z">
  <span class="card__icon" aria-hidden="true">💬</span>
  <span class="card__title">Refactor terminal sizing</span>
  <span class="card__preview">Wait for genie + fonts.ready + 2 RAFs before fitAddon.fit()…</span>
  <span class="card__meta">
    <time>2d</time>
    <span class="chip">prompt</span>
  </span>
</button>
```

`<button>` is the right element: keyboard-focusable, screen-reader-friendly, full-card click target.

### Click → paste

```js
card.addEventListener('click', async () => {
  const content = await window.ezvibes.readFile(card.dataset.path);
  const activeTabId = state.activeWindow.activeTabId;
  await window.ezvibes.writeTerminal(activeTabId, content);
  flashCopied(card);
});
```

(Renderer already has `writeTerminal(sessionId, data)` per CLAUDE.md → preload API.)

### Live updates

```js
// main.js
const chokidar = require('chokidar');
const watcher = chokidar.watch(folderPath, {
  ignored: /(^|[\/\\])\../,    // ignore dotfiles
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 200 },
});

watcher.on('add',    file => mainWindow.webContents.send('vault:add',    file));
watcher.on('change', file => mainWindow.webContents.send('vault:change', file));
watcher.on('unlink', file => mainWindow.webContents.send('vault:unlink', file));
```

```js
// renderer
window.ezvibes.onVaultAdd(file => {
  const card = buildCard(file);
  vaultGrid.prepend(card);  // newest-first
  // @starting-style or :nth-child stagger handles entrance
});
```

### Effects to pull in (in priority order)

1. **Stripe-flashlight** (Section 4c). Five lines of JS, beautiful, runs cheap.
2. **Lift + accent border on hover** (Sections 4a + 4b).
3. **Accent strip left** (Section 10b) — keyed by file type.
4. **Copy-confirmation animation** (Section 11h) — communicates "your prompt was pasted."
5. **Pure-CSS stagger** (Section 5a or 5c) on initial vault load and on `add` events.
6. **Squircle corners** (Section 11a) with `@supports` fallback.
7. **Optional**: glassmorphism vault panel background (Section 10d) over a mesh gradient (Section 10e).
8. **Optional**: scroll-driven `deal-in` (Section 11d) when vault has > 30 prompts.

### What NOT to do

- Don't add masonry yet — wait for `grid-lanes` to ship in Chrome stable; bento with explicit sizes is more visually controllable.
- Don't use heavy animation libraries — vanilla CSS + 20 lines of vanilla JS covers 95% of effects above.
- Don't use parallax tilt on every card — it's distracting in a dense grid; reserve for the **active / focused** card.
- Don't auto-render markdown to HTML in the preview — text-only is faster, safer, more grid-uniform. (Render full HTML only on detail-pane open.)

---

## 13. References

### CSS Grid + Layout

- [Auto-placement in grid layout — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Auto-placement)
- [Auto-Sizing Columns in CSS Grid: auto-fill vs auto-fit — CSS-Tricks](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/)
- [Responsive CSS Grid Layouts — Harshal V. Ladhe](https://harshal-ladhe.netlify.app/post/responsive-css-grid-layouts)
- [CSS Grid Best Practices 2026 — TestMu AI](https://www.testmuai.com/blog/css-grid-best-practices/)
- [CSS Grid - Cards Layout & Aspect Ratio — Praveen Bisht](https://prvnbist.com/blog/css-grid-cards-layout-and-aspect-ratio)
- [Card Layout Using CSS Subgrid — DEV](https://dev.to/hlabushkina/card-layout-using-css-subgrid-4ncm)
- [Brand New Layouts with CSS Subgrid — Josh W. Comeau](https://www.joshwcomeau.com/css/subgrid/)

### Bento Grids

- [Bento Grid Dashboard Design Complete Guide 2026 — Orbix](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- [Bento Grid Design 2026 Practical Guide — SaaSFrame](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- [Bento UI Modular Dashboard Interface — Figma](https://www.figma.com/community/file/1509218649122727434/bento-ui-modular-dashboard-interface)
- [Bento Grids 2026 — Galaxy UX](https://www.galaxyux.studio/blog/bento-grids-the-new-standard-for-modular-ui-design/)

### Masonry / Grid-Lanes

- [CSS Grid Lanes (Masonry Layout) Complete Guide 2026 — DEV](https://dev.to/bean_bean/css-grid-lanes-masonry-layout-is-here-a-complete-guide-for-2026-4686)
- [Brick by brick: Help us build CSS Masonry — Chrome](https://developer.chrome.com/blog/masonry-update)
- [Masonry layout — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout)
- [Masonry Layout is Now grid-lanes — CSS-Tricks](https://css-tricks.com/masonry-layout-is-now-grid-lanes/)
- [react-masonry-css on npm](https://www.npmjs.com/package/react-masonry-css)
- [Masonry Grid (1.4 kB) — DEV](https://dev.to/dangreen/masonry-grid-a-14-kb-library-that-actually-works-341n)
- [pretext-masonry on GitHub](https://github.com/ShipItAndPray/pretext-masonry)

### Hover Effects

- [Stripe-Inspired Cards Hover Effect — Free Frontend](https://freefrontend.com/code/stripe-inspired-cards-hover-effect-2026-01-19/)
- [43 CSS Card Hover Effects — Free Frontend](https://freefrontend.com/css-card-hover-effects/)
- [CSS Spotlight Effect — Frontend Masters](https://frontendmasters.com/blog/css-spotlight-effect/)
- [Spotlight Card Hover Effect with Tailwind CSS — Cruip](https://cruip.com/how-to-create-a-spotlight-card-hover-effect-with-tailwind-css/)
- [Spotlight Cards — UI Layouts](https://www.ui-layouts.com/components/spotlight-cards)
- [Magic Card — Magic UI](https://magicui.design/docs/components/magic-card)
- [Glare Hover — Magic UI](https://magicui.design/docs/components/glare-hover)
- [Shine Border — Magic UI](https://magicui.design/docs/components/shine-border)
- [Border Beam — Magic UI](https://magicui.design/docs/components/border-beam)
- [Bento Grid — Magic UI](https://magicui.design/docs/components/bento-grid)
- [10 CSS Card Hover Effect Examples — Subframe](https://www.subframe.com/tips/css-card-hover-effect-examples)
- [Modern Card Hover Animations CSS and JavaScript — DEV](https://dev.to/kadenwildauer/modern-card-hover-animations-css-and-javascript-3cg3)

### 3D & Tilt

- [vanilla-tilt.js](https://micku7zu.github.io/vanilla-tilt.js/)
- [Interactive Parallax Tilt Effect — CSS Script](https://www.cssscript.com/interactive-parallax-tilt-effect-vanilla-javascript-vanilla-tilt-js/)
- [3D Hover Effect Using CSS Transforms — Let's Build UI](https://www.letsbuildui.dev/articles/a-3d-hover-effect-using-css-transforms/)
- [3D Card Effect — Aceternity UI](https://ui.aceternity.com/components/3d-card-effect)

### Stagger & Entry Animations

- [Stagger — Motion](https://motion.dev/motion/stagger/)
- [Staggered Card Library — animata.design](https://animata.design/docs/card/staggered-card)
- [Different Approaches for Creating a Staggered Animation — CSS-Tricks](https://css-tricks.com/different-approaches-for-creating-a-staggered-animation/)
- [Staggered Animation with CSS sibling-* Functions — Frontend Masters](https://frontendmasters.com/blog/staggered-animation-with-css-sibling-functions/)
- [Staggered Animations with CSS Custom Properties — Cloud Four](https://cloudfour.com/thinks/staggered-animations-with-css-custom-properties/)
- [Mathematical Layouts With sibling-index() and sibling-count() — Smashing](https://www.smashingmagazine.com/2026/05/mathematical-layouts-sibling-index-sibling-count/)
- [CSS sibling-index() — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-index)
- [CSS sibling-count() — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-count)
- [@starting-style — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style)
- [The Big Gotcha with @starting-style — Josh W. Comeau](https://www.joshwcomeau.com/css/starting-style/)
- [CSS @starting-style for entry transitions — modern-css.com](https://modern-css.com/entry-animations-without-javascript-timing/)

### Scroll-driven Animations

- [Scroll-Driven Animations — Josh W. Comeau](https://www.joshwcomeau.com/animation/scroll-driven-animations/)
- [Scroll-driven Animations Style](https://scroll-driven-animations.style/)
- [Stacking Cards Demo](https://scroll-driven-animations.style/demos/stacking-cards/css/)
- [CSS scroll-driven animations — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)

### Corner Shape & Squircle

- [Beyond border-radius CSS corner-shape Property — Smashing](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/)
- [Understanding CSS corner-shape and the Superellipse — Frontend Masters](https://frontendmasters.com/blog/understanding-css-corner-shape-and-the-power-of-the-superellipse/)
- [2026 — The Year of the Squircle — FW Press](https://flyingw.press/article/2026-the-year-of-the-squircle/)
- [Squircles in Web Design — Squircle.js](https://squircle.js.org/blog/squircles-in-web-design)

### Glassmorphism

- [Backdrop Filter & Glassmorphism — CSS-Zone](https://css-zone.com/blog/backdrop-filter-glass-morphism)
- [Glassmorphism 2.0 CSS Techniques 2026](https://weblogtrips.com/technology/glassmorphism-2-0-css-techniques-2026/)
- [Next-level frosted glass with backdrop-filter — Josh W. Comeau](https://www.joshwcomeau.com/css/backdrop-filter/)
- [Dark Glassmorphism The Aesthetic That Will Define UI in 2026 — Medium](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [Glassmorphism UI Template 2026 — DEV](https://dev.to/imran_khan_a3cc224344dbcf/glassmorphism-ui-template-complete-guide-free-downloads-2026-5c80)

### Real App References

- [Notion Gallery view — Help Center](https://www.notion.com/help/galleries)
- [Notion Gallery View Guide 2026 — Super.so](https://super.so/blog/notion-gallery-view-a-comprehensive-guide)
- [Notion Gallery View Master Visual Organization 2026 — Notionland](https://www.notionland.co/post/notion-gallery-view)
- [Linear — Product](https://linear.app/)
- [How we redesigned the Linear UI (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Raycast Grid API](https://developers.raycast.com/api-reference/user-interface/grid)
- [Raycast User Interface](https://developers.raycast.com/api-reference/user-interface)
- [Apple Notes Gallery view — iPad Support](https://support.apple.com/en-lb/guide/ipad/ipade2318ee3/ipados)
- [Apple Notes 2026 Features — SimplyMac](https://www.simplymac.com/apps/new-apple-notes-features)
- [Bear — Editor Typography Options](https://bear.app/faq/typography-options/)
- [Supernotes Markdown Reference](https://www.markdownguide.org/tools/supernotes/)
- [Supernotes Help — Graph Layout](https://help.supernotes.app/en/articles/6037989-graph-layout)
- [Obsidian Canvas](https://obsidian.md/canvas)
- [Obsidian Canvas — Help](https://help.obsidian.md/plugins/canvas)
- [My Obsidian Canvas Homepage Dashboard — Medium](https://medium.com/obsidian-observer/my-obsidian-canvas-homepage-dashboard-67c6ce1613c5)
- [Building a Trello Layout with CSS Grid and Flexbox — SitePoint](https://www.sitepoint.com/building-trello-layout-css-grid-flexbox/)

### View Transitions API

- [Smooth transitions with the View Transition API — Chrome](https://developer.chrome.com/docs/web-platform/view-transitions)
- [Mastering Smooth Page Transitions with the View Transitions API in 2026 — DEV](https://dev.to/krish_kakadiya_5f0eaf6342/mastering-smooth-page-transitions-with-the-view-transitions-api-in-2026-31of)
- [View Transitions API Browser Support — TestMu](https://www.testmuai.com/learning-hub/view-transitions-api-browser-support/)

### Drag & Drop

- [dnd-kit Sortable Concepts](https://dndkit.com/concepts/sortable/)
- [SortableJS](https://github.com/SortableJS/Sortable)
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout)
- [The Ultimate Drag-and-Drop Toolkit for React (dnd-kit) — BrightCoding](https://www.blog.brightcoding.dev/2025/08/21/the-ultimate-drag-and-drop-toolkit-for-react-a-deep-dive-into-dnd-kit/)

### File Watching (Electron)

- [chokidar — GitHub](https://github.com/paulmillr/chokidar)
- [chokidar — npm](https://www.npmjs.com/package/chokidar)
- [Watch Files and Directories with Electron — Our Code World](https://ourcodeworld.com/articles/read/160/watch-files-and-directories-with-electron-framework)

### Conic Gradients & @property

- [Animated Border Card with Conic Gradient — DoCode](https://docode.co.in/post/animated-border-card-with-conic-gradient-using-pure-css)
- [conic-gradient() — CSS-Tricks](https://css-tricks.com/almanac/functions/c/conic-gradient/)
- [Animated CSS gradient borders — CodeTV](https://codetv.dev/blog/animated-css-gradient-border)

### Component Libraries

- [Aceternity UI](https://ui.aceternity.com/)
- [Magic UI](https://magicui.design/)
- [shadcn/ui patterns](https://www.shadcn.io/)
- [Aceternity UI vs Magic UI vs shadcn/ui 2026 — PkgPulse](https://www.pkgpulse.com/guides/aceternity-ui-vs-magic-ui-vs-shadcn-animated-react-2026)

### Chips, Pills, Tags

- [Badges vs Pills vs Chips vs Tags — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/)
- [Material Design 3 Chips](https://m3.material.io/components/chips/guidelines)
- [Pill — ServiceNow Horizon](https://horizon.servicenow.com/workspace/components/now-pill)

---

End of description12.md.
