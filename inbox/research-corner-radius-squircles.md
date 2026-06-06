# Corner Radius & Squircles — Research

Slice 8 of 10. Aesthetic target: dark blue, modern, liquid-glass, slim, trustworthy.

## 1. Why corner shape signals brand maturity

Corner radius is the cheapest, most legible signal of brand temperament. Zero radius reads engineered, blueprint, "we ship infra" (Vercel). 2-8px reads precise, calm, tool-like (Linear, Stripe). 12-24px reads consumer, friendly, modern SaaS (Notion, Figma). 28px+ slides into playful or toy. For a "smart and trustworthy" studio brand, the sweet spot sits 6-16px on cards and 8-12px on interactive controls — small enough to read as engineered, large enough to escape the brutalist 0px aesthetic that is now a cliché.

The second-order signal is **curvature continuity**. A standard `border-radius` joins a flat edge to a circular arc; curvature jumps from 0 to 1/r at the seam. Squircles (superellipses) keep curvature continuous — the eye reads them as "carved from one piece" rather than "rectangle with corners chopped." This is the difference between "looks fine" and "feels expensive." Apple has used squircles since iOS 7 (2013) for exactly this reason; the icon corner is ~22.37% of width with a curvature parameter that maps to Figma's "60% smoothing."

## 2. Squircles vs standard border-radius — visual & mathematical

A rounded rectangle is two primitives glued together: straight line + circular arc. The squircle is one curve, the superellipse, governed by `|x/a|^n + |y/b|^n = 1` with `n > 2`. As `n` grows, the shape flattens toward a square; at `n = 2` it's a pure ellipse. iOS uses `n ≈ 5`. Visually:

- Rounded rect: the corner "starts" suddenly. You can feel the join even if you can't name it.
- Squircle: the bend begins earlier and tapers smoothly into the side. Looks "softer" at the same nominal radius, but reads more confident, not more playful.

Designers call this G2 continuity (curvature-continuous) vs G1 (tangent-continuous only). G2 is why Apple icons, Tesla UI, and modern Figma cards feel premium.

## 3. Reference radius scales

| Brand / System    | Scale (px)                         | Character |
|-------------------|------------------------------------|-----------|
| Vercel            | 0, 2, 4                            | Brutalist, engineered, near-zero |
| Stripe            | 1 (sm), 4 (md), 8 (lg)             | Calm, precise, financial-trust |
| Linear            | 2 (tags), 6 (buttons/cards/inputs) | Tight, tool-like, signature |
| Tailwind default  | 2, 4, 6, 8, 12, 16, 24             | Even doubling-ish, broadly safe |
| Material 3        | 0, 4, 8, 12, 16, 28, full          | Friendly, consumer SaaS |
| Apple iOS icon    | 22.37% of side (continuous-curve)  | Squircle, premium consumer |

For a dark-blue, glass-surface, "studio crew" identity, the strongest defensible scales are:

- **Linear-style tight scale: `2 / 6 / 10 / 14`** — small jumps, reads precise.
- **Stripe-extended scale: `4 / 8 / 12 / 16 / 24`** — generous doubling, hits the modern-SaaS pocket without going Material-friendly. **Recommended.**

Avoid odd one-offs (5, 7, 11) and avoid jumping straight from 8 to 20 — the eye reads the gap as inconsistency.

## 4. Nested radius rule

The single most overlooked detail. When a child sits inside a parent with padding `p`:

```
outerRadius = innerRadius + padding
inner = outer − padding   (clamp at 0 if negative)
```

Example: card with `border-radius: 16px` and `padding: 8px` → inner element gets `8px`. Using `16px` on both produces uneven gaps that the eye reads instantly even if it can't name them. Implement once with a custom property:

```css
.card { --r: 16px; --p: 8px; border-radius: var(--r); padding: var(--p); }
.card > * { border-radius: max(0px, calc(var(--r) - var(--p))); }
```

This rule compounds: button (8) inside input row (12) inside card (16) inside section (24) — every layer subtracts its padding.

## 5. Implementing squircles on the web today (May 2026)

Three options, ranked by readiness:

1. **CSS `corner-shape: squircle` (progressive enhancement).** Shipped in Chrome 139+, ~66-67% global support, no Safari or Firefox yet. Companion to `border-radius`, not a replacement. Also supports `superellipse(n)` for fine control — `superellipse(0)` = bevel, `0.5` = between round and squircle, `1` = squircle. Use inside `@supports (corner-shape: squircle)` and let the rest fall back to standard rounding — degrades gracefully.

   ```css
   .card { border-radius: 16px; }
   @supports (corner-shape: squircle) {
     .card { corner-shape: squircle; }
   }
   ```

2. **`squircle.js` / `figma-squircle` / `CornerKit`** — JS libraries that emit SVG `clip-path` or border-image. Universal browser support, ~2-4kb gzipped, works on any element. Cost: extra DOM/JS, harder to animate, can clip box-shadows. Best for hero elements where the squircle is load-bearing brand.

3. **Hand-authored SVG `clip-path`** — for one-off hero shapes only. Don't scale this across a system.

For a brand-defining studio site in 2026, **ship `corner-shape: squircle` with `border-radius` fallback** on a small set of hero surfaces (avatar, primary CTA, hero card). Keep the rest on plain `border-radius`. Squircle everywhere becomes noise; squircle on three elements becomes a signature.

A squircle at the same nominal radius reads ~10-15% softer than a circular round, so when retrofitting, you may want to bump radius up one step on squircled elements.

## 6. Sources

- Smashing Magazine — [Beyond border-radius: CSS corner-shape](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/)
- MDN — [`corner-shape` property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/corner-shape)
- Chrome Status — [Corner shaping (corner-shape, superellipse, squircle)](https://chromestatus.com/feature/5357329815699456)
- Squircle.js — [How Apple uses squircles](https://squircle.js.org/blog/squircles-in-apple-design), [Math behind squircles](https://squircle.js.org/blog/math-behind-squircles)
- Figma Blog — [Desperately seeking squircles](https://www.figma.com/blog/desperately-seeking-squircles/)
- John D. Cook — [Squircles, Apple design, and curvature](https://www.johndcook.com/blog/2018/02/13/squircle-curvature/)
- Linear — [Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)
- Mantlr — [How Stripe, Linear, Vercel ship premium UI](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)
- Tailwind CSS — [border-radius docs](https://tailwindcss.com/docs/border-radius)
- Material 3 — [Shape / corner radius scale](https://m3.material.io/styles/shape/corner-radius-scale)
- Cloud Four — [Math behind nesting rounded corners](https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/)
- Frontend Masters — [Classic border-radius advice, plus an unusual trick](https://frontendmasters.com/blog/the-classic-border-radius-advice-plus-an-unusual-trick/)
