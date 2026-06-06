# Synthesis — Modern Trust Website Theme

**Brief:** Dark blue, modern, liquid-glass, slick corners, slim bezels, slim/feature-rich, smart, trustworthy.

**Method:** 10 parallel research agents, non-overlapping slices. Full per-slice writeups in this same `inbox` folder (see Index at bottom).

---

## The Single Most Important Findings

1. **Dark blue is over-saturated as a trust signal.** Anthropic — the most trust-coded AI brand in 2026 — deliberately *rejected* dark blue (warm near-black `#141413` + coral `#D97757`). Use dark blue, but earn differentiation from execution quality, not the palette choice itself.
2. **The "liquid glass" feel in 2026 isn't blur. It's `saturate(180%)`.** That single CSS value is what separates current Apple Liquid Glass from 2020-era glassmorphism. Without it, glass looks dated.
3. **Trust signals plateau fast.** Baymard: 1–3 well-chosen signals beat 7+ by ~8% conversion. Stuff less, choose better.
4. **Squircle everywhere = noise. Squircle on 3 surfaces = signature.** Reserve `corner-shape: squircle` (Chrome 139+) for hero card, primary CTA, avatar. Standard `border-radius` everywhere else.
5. **Default to off-black, not `#000`.** Pure black causes halation and kills luminance-based elevation. `#0E1116`–`#121417` outperforms.

---

## Recommended Stack (Concrete Defaults)

### Color
- **Base**: Tailwind Slate stack — `#020617` canvas, `#0F172A` surface, `#1E293B` elevated, `#334155` border.
- **Accent**: electric cyan (Stripe-style `#008CDD` or GitHub Primer `#58A6FF`).
- **Reserve**: 1 micro-gold for "premium" / paid states only.
- **Token taxonomy**: `bg.canvas / bg.surface / bg.surface-raised / bg.surface-overlay / bg.surface-sunken`, borders in 3 weights (`subtle / default / strong`), fg in 4 tiers (`primary ~15:1 / secondary ~9:1 / muted ≥4.5:1 / disabled`).
- **Contrast rules**:
  1. WCAG 2.2 AA is the legal target; APCA is *draft*, not claimable.
  2. Focus rings ≥3:1 against every adjacent color (two-color ring trick).
  3. Off-black > pure-black except OLED hero media.

### Liquid Glass — Production Recipe
```css
.glass {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px) saturate(180%);
  -webkit-backdrop-filter: blur(14px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(255, 255, 255, 0.04),
    0 8px 32px rgba(0, 0, 0, 0.36);
  transform: translateZ(0);
}
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: rgba(20, 24, 32, 0.92); }
}
```
**Pitfall:** `overflow: hidden` on ancestors silently kills `backdrop-filter`. Use `overflow: clip`. Text on glass needs a `rgba(0,0,0,0.15–0.25)` underlay to hit WCAG AA.

### Corners
- **Scale**: `4 / 8 / 12 / 16 / 24` (Stripe-extended).
- **Nested radius rule**: `inner = outer − padding`.
- **Squircles**: `corner-shape: squircle` behind `@supports` on 3 signature surfaces only.

### Typography
- **Stack**: Geist Sans (display + body) + Geist Mono. Free OFL, ships with Next.js via `next/font/google`.
- **Weights**: `400 / 500 / 600 / 700` — 700 hero only. No <400.
- **Micro-type**: display `letter-spacing: -0.03em`, body `0`, uppercase labels `+0.06em`. Line-height 1.1 display / 1.6 body.
- **Must-haves**: `font-variant-numeric: tabular-nums`, `font-feature-settings: "ss01", "cv11", "calt"`.

### Motion
- **Duration scale**: `80 / 160 / 240 / 400 / 600 ms`. Default hover 160ms; default state change 240ms.
- **Default easing**: `cubic-bezier(0.16, 1, 0.3, 1)` — "expo out", the workhorse.
- **In-out easing**: `cubic-bezier(0.83, 0, 0.17, 1)` for drawers / route transitions.
- **Default spring** (Motion lib): `{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }`.
- **No decorative motion.** Property-scoped transitions, six-state interactives, restraint over cleverness.

### Layout — Slim Bezel
- Decouple **section width** from **content width**. Backgrounds bleed to viewport edge, text re-constrains to 720–960px.
- Sticky-glass nav respecting outer gutter (Linear/Vercel) or floating pill nav with margin (Arc/Granola).
- Asymmetric screenshot bleed for depth.
- Use `container-type: inline-size` + `cqw` units, not `100vw` (scrollbar-gutter trap).

### Trust UX (in priority order)
1. **Named, verifiable customer logos with context line** — 69% conversion lift in one comScore A/B.
2. **Specific attributed testimonials** (name + role + photo + quantified outcome) — generic 2–5%, specific 15–25%, video 30–40%.
3. **Transparent pricing, no "Contact Sales"** — ~50% trust lift, 15–25% conversion lift.
4. **Operational transparency**: changelog + status page + Trust Center hub.
5. **Footer fundamentals**: NAP, real team page, linked policies.

### Implementation Stack (all versions context7-verified)
- `next@15` (App Router) + `react@19`
- `tailwindcss@4` (CSS-first, `@theme` block, OKLCH colors)
- `shadcn` CLI + Radix primitives, `cssVariables: true`, `baseColor: neutral`
- `motion@12` (rebranded framer-motion) — import from `motion/react`
- `next-themes` (`attribute="class"`), `next.config.ts` `experimental.viewTransition: true`
- Polish: `lucide-react`, `sonner`, `vaul`, `cmdk`, `tw-animate-css`
- Class plumbing: `clsx` + `tailwind-merge` + `cva`

---

## Reference Sites (Highest Signal)

1. **Raycast** — closest aesthetic match. Steal: 1.5px bezel + top-edge highlight + soft inner shadow + 30–40% blur on product chrome.
2. **Linear** — best "smart through restraint." Steal: 1px hairline borders at ~8% white opacity replacing drop shadows; one accent gradient per hero.
3. **Vercel** — best monochrome-only chrome with type carrying the brand. Steal: pointer-tracking surface highlight on cards.
4. **Anthropic** (counter-reference) — proves the same trust feel can come from warm/serif. Use it as a corrective if dark-blue glass starts feeling cold; lift its pacing without changing palette.

---

## The Differentiation Move

Everyone using this aesthetic stack converges on the same look. Three ways to break out:

- **One signature material.** Pick squircle, or animated grain, or refracting glass — not all three. Apply it on 2–3 surfaces only.
- **Pacing.** Borrow Anthropic's slow declarative headline pacing inside the dark frame.
- **Numbers.** Tabular-nums + specific quantified outcomes do more for the "smart" feel than any motion or glass effect.

---

## Index of Detailed Research Files

All in `C:\Users\Oskari\Documents\EZvibes\inbox\`:

1. `research-dark-blue-color-systems.md` — 7 reference palettes with hex codes.
2. `research-liquid-glass-glassmorphism.md` — full CSS recipe + pitfalls.
3. `research-corner-radius-squircles.md` — radius scales + squircle implementation.
4. `research-edge-to-edge-slim-bezel.md` — full-bleed + floating nav patterns.
5. `research-typography-trust-modern.md` — typeface stack + micro-typography rules.
6. `research-trust-ux-patterns.md` — top 5 trust signals ranked by impact.
7. `research-microinteractions-motion.md` — durations, easings, springs.
8. `research-dark-mode-tokens-contrast.md` — token taxonomy + WCAG/APCA tables.
9. `research-reference-site-teardown.md` — 8 site teardowns.
10. `research-implementation-stack-tailwind-motion.md` — Next 15 / Tailwind 4 / shadcn / motion@12.
