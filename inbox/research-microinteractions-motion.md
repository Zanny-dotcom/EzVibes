# Micro-Interactions & Motion — Research Findings

**Aesthetic target:** dark blue, modern, liquid-glass, trustworthy, slick — *premium restraint*, not flair.
**Scope:** motion *values* and *patterns*. Tooling deep-dive is owned by another agent.

---

## 1. Modern motion language — restrained vs. gimmicky

Premium trust-forward sites (Linear, Vercel, Stripe, Apple, Arc) share five tells:

1. **Short durations, snappy easing.** UI feedback under 200ms. Anything over 500ms for routine interactions feels sluggish.
2. **No browser defaults.** `ease`, `ease-in-out`, and stock CSS curves look amateurish. Every interaction uses a tokenized custom curve.
3. **Property-scoped transitions.** They animate `transform`/`opacity` explicitly (`transition-[transform,opacity]`), never `transition-all`. This avoids the "everything wobbles when I add a color" smell.
4. **Six microstates per interactive element.** default, hover, focus-visible, active/pressed, disabled, loading — each with its own visual + motion.
5. **Motion serves orientation.** Page transitions, list reorderings, modal openings — motion teaches the user *where things went*. Decorative motion (autoplay particles, ambient parallax with no payload) reads as "trying too hard."

**Gimmicky tells to avoid:** bouncing every button, magnetic cursors on >2 elements per viewport, scroll-jacking, full-page parallax layers with >50px travel, splash-text reveals on every paragraph, "wow" landing animations longer than 800ms.

---

## 2. Duration scale (recommended)

A 5-step scale, geometric-ish progression. Use these as design tokens:

```css
--dur-instant: 80ms;   /* tooltip flash, focus ring, icon swap */
--dur-fast:    160ms;  /* hover, button press, small color shift */
--dur-base:    240ms;  /* default — most state changes, dropdowns */
--dur-slow:    400ms;  /* modal open, drawer slide, accordion */
--dur-page:    600ms;  /* page/route transition, hero reveal */
```

**Reasoning.** Material 3 uses 50/100/200/300/400/500/700/1000ms (8 stops). That's overkill for most product sites. Five stops covers 95% of cases. The "hover=150ms, state=300ms, page=500ms" heuristic (Linear/Vercel-style) maps cleanly into this scale. Keep `--dur-fast` (160ms) as the default `transition-duration` for hover states.

---

## 3. Easing curves with cubic-bezier values

```css
/* Standard — default UI motion, balanced in/out */
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1);

/* Out — element entering/settling. The "decelerate" curve. Use most often. */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);            /* "expo out", slick */
--ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);      /* gentler */

/* In — element exiting. Use sparingly; ease-out for entry is more common. */
--ease-in: cubic-bezier(0.7, 0, 0.84, 0);

/* In-Out — moves that travel through a path (drawer, page transition) */
--ease-in-out: cubic-bezier(0.83, 0, 0.17, 1);        /* "expo in-out" */

/* Emphasized — Material 3 hero motion. Strong, confident. */
--ease-emphasized: cubic-bezier(0.2, 0.0, 0.0, 1.0);

/* Spring-ish bounce (CSS only, use sparingly — toasts, success ticks) */
--ease-back-out: cubic-bezier(0.34, 1.56, 0.64, 1);
```

**When to use each.**
- `--ease-out` is the workhorse — 70% of micro-interactions. Elements arrive feeling "placed."
- `--ease-in-out` for things that travel a distance (drawer slide, route swap).
- `--ease-in` only for *exits* (modal dismiss, toast leave) — never entries.
- `--ease-back-out` overshoots ~15%. Confirmation checkmarks, "add to cart" snaps. Don't put on hover.
- Linear is wrong for almost everything. Reserve for loops (spinners, marquees).

---

## 4. Spring configs (Framer Motion / `motion`)

Motion's default is `stiffness: 100, damping: 10, mass: 1` — too bouncy for trust-forward UI.

```js
// Snappy — default for buttons, toggles, small layout shifts
const snappy = { type: 'spring', stiffness: 400, damping: 32, mass: 0.8 };

// Smooth — drawers, sheets, larger surfaces. No visible bounce.
const smooth = { type: 'spring', stiffness: 260, damping: 30 };

// Gentle — hero text reveal, large hero card lifts
const gentle = { type: 'spring', stiffness: 170, damping: 26 };

// Bouncy — success states only. Use rarely.
const bouncy = { type: 'spring', stiffness: 500, damping: 18 };

// Layout — for <motion.div layout> on grid reorders
const layout = { type: 'spring', stiffness: 350, damping: 35 };
```

For tweens (no physics), prefer `{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }`.

---

## 5. Scroll-triggered motion — when to use, when to skip

**Use Intersection Observer + CSS classes** (not JS-driven scroll animations) for almost everything. The pattern: observer adds `.in-view`, CSS handles the actual animation. Stays on the compositor at 60fps.

```css
.reveal { opacity: 0; transform: translateY(12px); transition: opacity 240ms var(--ease-out), transform 240ms var(--ease-out); }
.reveal.in-view { opacity: 1; transform: none; }
```

In Motion (Framer): use `whileInView={{ opacity: 1, y: 0 }}` with `viewport={{ once: true, margin: '-10% 0px' }}`. The `once: true` is non-negotiable for trust-forward — re-animating on every scroll feels chaotic.

**Travel distance.** Max 16-24px on reveals. Larger displacements (the 100px-translate trend) feel cheap.

**Skip scroll motion when:** dense data UI, tables, dashboards, pricing tables, anything the user came to *read*. Reserve reveals for marketing/landing surfaces.

**GSAP ScrollTrigger or scroll-linked CSS animations** (`animation-timeline: view()`) only for hero-grade moments — one or two per landing page max.

**Magnetic cursor / parallax.** Allowed on hero-only, max one element, max 8px magnetic offset, max 30px parallax travel. Disable on touch + reduced motion.

---

## 6. prefers-reduced-motion strategy

Required for WCAG 2.1. Pattern:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Better — keep *necessary* state-change motion under 100ms but kill *decorative* motion:

```js
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const transition = reduced ? { duration: 0 } : snappy;
```

In Motion: wrap with `<MotionConfig reducedMotion="user">` to auto-respect the OS setting and disable transforms while keeping opacity fades (the recommended degradation).

View Transitions API: gate it. `if (!document.startViewTransition || reduced) { /* fallback */ }`.

---

## 7. Reference sites

1. **Linear (linear.app)** — Canonical example. Hover ~150ms, state changes ~250ms, no decorative motion. Cursor is a normal cursor. Karri Saarinen's "motion curves are designed, not defaulted" governs.
2. **Vercel (vercel.com)** — Rauno Freiberg's micro-interactions: command palette spring opens, page transitions feel like film cuts. Page-route motion uses `ease-out` with ~400ms.
3. **Stripe (stripe.com)** — Hero gradient is GPU-cheap, scroll reveals are <16px translate + opacity, navigation hover is 120-160ms. No magnetic cursor.
4. **Arc Browser (arc.net)** — Spring physics on every layout shift. Stiffness ~400, damping ~30. Demonstrates layout transitions done right.
5. **Apple (apple.com/iphone)** — Scroll-linked hero animations (now native via `animation-timeline`). Easing leans heavily on `ease-out`-style decel curves. Restrained, never autoplay-heavy.
6. **Rauno Freiberg (rauno.me)** — Demos of focus rings, list reorders, magnetic buttons done tastefully. Reference for "how much is enough."
7. **Framer (framer.com)** — Their own marketing site is the canonical Motion showcase. Spring presets visible across every interaction.

*Limitation:* exact production values for these sites require DevTools inspection in a real browser session (out of scope here).

---

## 8. Sources

- Material Design 3 motion tokens: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- Motion (Framer) transitions: https://www.framer.com/motion/transition/
- Motion `inView` scroll API: https://motion.dev/docs/inview
- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Mantlr — Stripe/Linear/Vercel premium UI: https://mantlr.com/blog/stripe-linear-vercel-premium-ui
- Vercel motion guide: https://motionguide.vercel.app/
- Maxime Heckel — physics of spring animations: https://blog.maximeheckel.com/posts/the-physics-behind-spring-animations/
- Josh Collinsworth — easing curves: https://joshcollinsworth.com/blog/easing-curves
- Easings cheat sheet: https://easings.net/
- View Transitions API 2026 guide: https://dev.to/krish_kakadiya_5f0eaf6342/mastering-smooth-page-transitions-with-the-view-transitions-api-in-2026-31of
- Awwwards parallax/cursor collections: https://www.awwwards.com/websites/parallax/
