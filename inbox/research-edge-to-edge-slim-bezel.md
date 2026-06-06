# Edge-to-Edge / Slim-Bezel Web Layouts — Research

Slice: edge-to-edge / slim-bezel layout patterns (1 of 10 parallel research agents).
Scope owned here: full-bleed sections, viewport-edge alignment, floating/sticky nav, hero composition without containers, asymmetric grid breaks, container-query edge patterns.

---

## 1. What "slim bezel" means on the web — viewport-edge layouts vs container layouts

The "slim bezel" feel is the web analogue of an edge-to-edge phone screen: the visible canvas pushes content close to the viewport edge while leaving just enough breathing room that the page never feels cramped. Classic "container-locked" layouts apply a single `max-width` (typically 1200–1440px) with `margin: auto` so the entire page sits inside a rigid track — every section starts and ends at the same x-coordinate, regardless of viewport. The result is a visible "frame" of dead space on large monitors, which reads as dated and brochure-like on modern displays.

Slim-bezel layouts invert the rule. Text columns stay constrained for readability, but **sections (backgrounds, gradients, media, dividers, customer logos, footers) extend to 100% of the viewport width**, while the content *inside* them is re-constrained to a readable column. This produces two simultaneous gutters: a wide "outer" gutter near the viewport edge (often only 16–32px on mobile, 24–48px on desktop) and an "inner" gutter that re-centers text. The page reads as immersive at section level while remaining legible at paragraph level — the same trick a flagship phone uses by killing the chrome around the screen but keeping safe areas for content.

Technically, the cleanest modern recipe (Frontend Masters / CSS-Tricks) uses container query units to avoid the long-standing `100vw` scrollbar bug:

```css
html { container-type: inline-size; }
main { --_m: max(1em, 50cqw - 400px); margin-inline: var(--_m); }
.full-bleed { margin-inline: calc(-1 * var(--_m)); }
```

Container units (`cqw`) reference real available width, unlike `100vw`, which ignores scrollbar gutters and triggers horizontal scroll. This is what lets a section truly hit the viewport edge without breakage.

## 2. Hero patterns that feel edge-to-edge

- **Bleed-everything-but-text**: Vercel and Stripe place a full-bleed gradient, dot grid, or motion canvas behind a centred headline. The background touches both viewport edges; the text sits in a 720–960px column. The eye reads "infinite canvas" first, message second.
- **Asymmetric screenshot strip**: Linear runs the hero product screenshot wider than the text — sometimes wider than 100% via horizontal overflow — so the UI shot bleeds off the right edge, suggesting depth and "more to discover" beyond the fold.
- **Negative-margin media break**: a contained text block introduces the feature, then the visual breaks out with `margin-inline: calc(-1 * var(--gutter))` to hit the edge. This is the technique behind most modern "feature → screenshot" alternations on Stripe and Vercel.
- **Bento on full-bleed background**: a bento grid (cards in an asymmetric 2x3 or 3x4 pattern) sits inside a section whose background is edge-to-edge. The cards themselves keep an inner container, but the section colour does not.
- **No-hero hero**: Anthropic uses a calmer pattern — large type, generous whitespace, content stays inside a narrower container. The "edge feel" comes from the *absence* of a heavy frame, not from media bleeding out. This shows slim-bezel does not require full-bleed imagery; it requires removing visible chrome.

## 3. Navigation patterns: floating, sticky-glass, edge-aligned

Slim-bezel sites reject the heavy, full-width opaque header. Three dominant patterns:

- **Floating pill nav**: a rounded, narrow nav bar that sits *inside* the viewport with margin on all sides — it never touches the edge. Common on Arc, Granola, and newer marketing pages. Anchored with `position: sticky; top: 16px;` and a max-width well below the page width.
- **Sticky-glass full-width nav**: a thin (48–64px) nav that spans the full viewport width with a translucent / backdrop-blurred surface. Vercel and Linear use this — the nav technically is full-bleed, but its low height and glass treatment make it feel like a slim "status bar" rather than a chrome frame.
- **Edge-aligned utility nav**: logo flush-left to the outer gutter, account/CTA flush-right to the same gutter. No internal centering. This deliberately mirrors the section gutters below so the nav reads as continuous with content rather than a separate band.

The shared principle: **the nav respects the same outer gutter as the content sections**, so a vertical line drawn from the logo to the first paragraph stays aligned. Breaking that alignment is the single fastest way to make a site look amateur.

## 4. Common pitfalls

- **Text touching the viewport edge on mobile**: full-bleed sections are fine, but text inside them still needs a minimum inline padding (16–24px). Sites that apply `padding: 0` to the section *and* its text reach the edge and become unreadable below 400px.
- **`100vw` causing horizontal scroll**: classic bug — `100vw` includes the scrollbar gutter on Windows/Linux, so a "full-bleed" element becomes wider than the visible viewport. Use `100%` on a `container-type: inline-size` parent, or `100cqw`.
- **Container break inside flex/grid parents**: negative-margin bleed tricks fail when the parent has `overflow: hidden` or is itself a constrained grid track. The fix is to put bleed sections *outside* the main container, not inside it.
- **Asymmetric breaks that misalign with the nav gutter**: the asymmetric "screenshot bleeds right" trick reads as broken if the nav is centered in a different gutter. Lock both to the same custom property.
- **Floating nav covering content on small screens**: pill navs need to either shrink, hide on scroll-down, or be excluded from sticky behaviour under ~640px.
- **Footer that re-introduces the container frame**: many sites perfect the edge feel for hero/features then snap back to a centered 1200px footer, immediately killing the immersive impression. Footers should also be full-bleed with internal columns.

## 5. Reference sites

- **Linear (linear.app)** — sticky full-width nav, hero screenshot bleeds horizontally past the text column, alternating contained-text + full-bleed-imagery sections.
- **Vercel (vercel.com)** — full-bleed hero with centred type over a Geist grid background; thin sticky-glass nav; section backgrounds touch edges, content re-centers inside.
- **Stripe (stripe.com)** — full-bleed gradient hero (the famous animated mesh), customer logo carousel runs edge-to-edge, bento feature grid inside contained widths, asymmetric staggered case studies.
- **Anthropic (anthropic.com)** — calmer, container-leaning interpretation: edge feel achieved by removing visible chrome and using large type rather than aggressive bleed. Demonstrates slim-bezel ≠ full-bleed everywhere.
- **Arc (arc.net)** — minimal top nav, full-width hero media, stacked feature sections with screenshots breaking the container. Calm spacing rather than dense info.
- **Granola (granola.ai)** — small floating pill nav with margin on all sides; hero centred over a textured full-bleed background; classic "nav floats inside the canvas" pattern.
- **CSS-Tricks / Frontend Masters articles** — canonical write-ups of the modern `cqw`-based full-bleed recipe; reference for the technical pattern itself.

## 6. Sources

- Frontend Masters Blog — *Full-Bleed Layout with Modern CSS* (`https://frontendmasters.com/blog/full-bleed-layout-with-modern-css/`)
- CSS-Tricks — *Full Bleed* (`https://css-tricks.com/full-bleed/`)
- Setproduct — *Vercel aesthetic: Blueprint Grid design* (`https://www.setproduct.com/blog/complete-guide-to-blueprint-grid-design`)
- Mantlr — *How Stripe, Linear, and Vercel Ship Premium UI* (`https://mantlr.com/blog/stripe-linear-vercel-premium-ui`)
- Pixeldarts — *Four design principles behind Stripe, Linear, and Vercel* (`https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel`)
- Direct WebFetch inspections: linear.app, vercel.com, stripe.com, anthropic.com, arc.net (May 2026)
- Limitation: granola.ai was not visually inspected this pass; description is from prior public knowledge of the pattern. Arc and Stripe WebFetches returned reduced detail (localized markup, gated content); inferences supplemented from search-result snippets.
