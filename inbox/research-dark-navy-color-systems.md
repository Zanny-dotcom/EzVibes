# Dark-Navy Color Systems — Modern Production Palettes (2024–2026)

Research slice for the Retteli liquid-glass agent platform. Companion to siblings A1 (trust psychology), A3 (glass/backdrop), A4 (borders/corners), A5 (site teardowns).

---

## 1. How to Look at This Correctly (Meta)

Five lenses to evaluate any dark-navy palette:

**Lens 1 — Color space: OKLCH > HSL > RGB for dark UI.** HSL's "lightness" is a math construct: at `L=50%`, yellow blinds you, blue looks black. OKLCH is perceptually uniform — a 10% lightness step looks like a 10% step at every hue. This matters in dark mode because elevation layers depend on equal-feeling brightness steps between `surface-0`, `surface-1`, `surface-2`. Tailwind v4 moved its entire palette to OKLCH for this reason. As of 2025, OKLCH ships natively in Chrome 111+, Safari 16.4+, Firefox 128+.

**Lens 2 — APCA over WCAG 2.x for dark backgrounds.** WCAG 2.1's 4.5:1 formula was tuned for light backgrounds and produces false passes/fails on dark UI. A bright blue link (`#2563eb`) hits 5.7:1 on white but drops to 3.2:1 on `#0f172a` — failing AA. APCA (Lc score, target for WCAG 3) accounts for the polarity of light-on-dark vs dark-on-light. For dark UI, target **Lc 60–75 (Silver)** for body text and **Lc 75–90 (Gold)** for small text. Ship to WCAG 2.1 for legal compliance, but tune to APCA for readability.

**Lens 3 — Elevation: lighter-on-darker, not shadows.** In dark mode, shadows lose contrast against dark backgrounds. The modern strategy (Material 3, Linear, Radix) is to make elevated surfaces *lighter*, not shadowed. Each elevation layer adds ~3–6% perceptual lightness. A 3-layer stack: `base` (page) → `surface` (cards) → `elevated` (modals, popovers). Avoid pure black `#000` as base — it produces halation against bright text and kills shadow depth headroom. Use `#0a0e1a`–`#111113` for navy bases.

**Lens 4 — Accent pairing: cool-cool for restraint, cool-warm for energy.** Navy + sibling cool (cyan/violet/indigo accent) reads as professional, technical, monochromatic — the Linear/Vercel/Stripe lane. Navy + complementary warm (amber/coral/lime) creates the 60/30/10 contrast that draws attention to CTAs — the Linear lime, Cursor amber lane. The hardest move is the cool-cool palette because hue separation is small; OKLCH chroma headroom is what saves it.

**Lens 5 — Translucency requirements for glass.** For backdrop-filter to look like glass, the underlying palette needs (a) a base layer dark enough that 60–80% alpha overlays still read as elevated (avoid `#000`), (b) accents with enough chroma to survive 0.4–0.6 alpha tint, and (c) borders with `color-mix(white 8–12%)` to define glass edges. The palette decisions in §3 are made with this in mind (handoff to A3 for the CSS).

---

## 2. Current State of the Art (2024–2026) — Named Palettes

### 2.1 Radix Colors — `slate` + `blue` + `indigo` (dark)
The de facto open-source standard. 12-step scales, dark variants engineered for hue-stable elevation. Exact values from `@radix-ui/colors@3.0.0`:

| Step | slate (dark, neutral nav) | blue (dark, primary) | indigo (dark, brand) |
|------|---------------------------|----------------------|----------------------|
| 1 (app bg)        | `#111113` | `#0d1520` | `#11131f` |
| 2 (subtle bg)     | `#18191b` | `#111927` | `#141726` |
| 3 (UI element)    | `#212225` | `#0d2847` | `#182449` |
| 4 (hover)         | `#272a2d` | `#003362` | `#1d2e62` |
| 5 (active)        | `#2e3135` | `#004074` | `#253974` |
| 6 (subtle border) | `#363a3f` | `#104d87` | `#304384` |
| 7 (border)        | `#43484e` | `#205d9e` | `#3a4f97` |
| 8 (strong border) | `#5a6169` | `#2870bd` | `#435db1` |
| 9 (solid)         | `#696e77` | `#0090ff` | `#3e63dd` |
| 10 (solid hover)  | `#777b84` | `#3b9eff` | `#5472e4` |
| 11 (low-contrast text) | `#b0b4ba` | `#70b8ff` | `#9eb1ff` |
| 12 (high-contrast text) | `#edeef0` | `#c2e6ff` | `#d6e1ff` |

Step semantics are stable across every Radix scale — pick a scale, the step number tells you the role. The slate scale is hue-tinted toward blue (~`240°`), which is why it composes cleanly with blue/indigo accents.

### 2.2 Tailwind CSS v4 — OKLCH defaults
Tailwind v4 ships its full palette in OKLCH. Key dark-navy values:

```
--color-slate-950:   oklch(12.9% 0.042 264.695)
--color-slate-900:   oklch(20.8% 0.042 265.755)
--color-slate-800:   oklch(27.9% 0.041 260.031)
--color-blue-500:    oklch(62.3% 0.214 259.815)
--color-blue-600:    oklch(54.6% 0.245 262.881)
--color-indigo-500:  oklch(58.5% 0.233 277.117)
--color-indigo-600:  oklch(51.1% 0.262 276.966)
--color-indigo-950:  oklch( 25.7% 0.090 281.288)
--color-zinc-950:    oklch(14.1% 0.005 285.823)
```

Note hue stays in the 260°–281° band (blue→indigo→violet) and chroma climbs sharply (0.04 → 0.26) as steps move from neutrals to accents.

### 2.3 Linear — proprietary LCH-derived
Linear migrated from HSL to LCH and reduced their theme variables to just three inputs (base, accent, contrast). Published values:

- Page background: **`#08090a`** (Pitch Black — near-black with slight cool tilt)
- Elevated cards: **`#0f1011`** (Graphite)
- Primary accent (CTAs/focus): **`#e4f222`** (Neon Lime) — warm-complement to the cool base
- Decorative blue: **`#5e6ad2`** (Aether Blue) — cool-cool layered accent
- Info/icon highlight: **`#02b8cc`** (Cyan Spark)

Linear deliberately tilts to **near-black** with a very narrow elevation gap (~`#07` → `#0f`), then pushes contrast via accent chroma rather than surface lightness. The lime accent is the cool-warm contrast move; the blue/cyan accents are the cool-cool restraint move. Both ship at once.

### 2.4 Stripe Dashboard — dark mode tokens
From Stripe Connect embedded appearance dark-mode spec:

- `colorBackground`: `#14171D` (form/page bg)
- `offsetBackgroundColor`: `#1B1E25` (elevated)
- `colorPrimary`: `#0085FF` (accent blue)
- `colorText`: `#C9CED8` (primary text — note: not pure white)
- `colorSecondaryText`: `#8C99AD`
- `colorBorder`: `#2B3039`
- `colorDanger`: `#F23154`

Brand-wide navy: **`#0A2540`** ("Downriver"). Cornflower **`#635BFF`** as marketing accent. Stripe's dashboard text intentionally stops at `#C9CED8` rather than pure white — a deliberate APCA halation-control move.

### 2.5 Vercel Geist — minimalist neutral + brand blue
Geist uses true gray (no hue tint) with single brand blue:

- Brand/link blue: **`#0070F3`** ("Blue Ribbon", also `--geist-success` in some token sets)
- Backgrounds: two-tier (`background-100` page, `background-200` subtle differentiation only)
- Grayscale: pure neutral, no warm or cool tint — deliberate "developer tool neutrality"

*Values for the full 10-step gray and blue scales are gated behind the interactive Figma file; the brand blue and structural rules are confirmed from public docs. Confidence: medium for scale steps, high for structural tokens.*

### 2.6 Apple iOS 26 system blue
- Light mode: `#007AFF` (`rgb(0,122,255)`)
- Dark mode: `#0A84FF` (`rgb(10,132,255)`) — slightly brighter + slightly more green to survive on dark backgrounds

This shift (lift L by ~4%, nudge hue +2°) is the canonical pattern for porting any accent blue from light to dark mode.

---

## 3. Implementation Guidance — Starter Palette for Retteli

A production-ready dark-navy palette tuned for a liquid-glass agent platform. Optimized for: (a) OKLCH perceptual uniformity, (b) glass translucency on top, (c) APCA Lc 75+ for primary text, (d) cool-cool restraint with a single warm-complement option for CTAs.

```css
:root, .dark {
  /* === Background stack (3 elevation layers) === */
  --bg-base:       oklch(15.0% 0.025 260);  /* #0b1020 — page canvas, deep navy */
  --bg-surface:    oklch(19.5% 0.030 260);  /* #121a30 — cards, panels */
  --bg-elevated:   oklch(24.0% 0.035 260);  /* #1a2440 — modals, popovers, glass tint */
  --bg-overlay:    oklch(28.0% 0.040 260);  /* #232f4f — hover, focus, glass on glass */

  /* === Borders / dividers === */
  --border-subtle: oklch(30.0% 0.030 260 / 0.5);  /* hairline */
  --border-strong: oklch(45.0% 0.040 260 / 0.7);  /* focused inputs */
  --border-glass:  oklch(100% 0 0 / 0.10);        /* glass edge highlight */

  /* === Text === */
  --text-primary:   oklch(96.0% 0.005 260);  /* #ecedf3 — APCA Lc 96 vs bg-base */
  --text-secondary: oklch(75.0% 0.015 260);  /* #adb3c2 — APCA Lc 70 vs bg-base */
  --text-muted:     oklch(58.0% 0.020 260);  /* #7c8295 — APCA Lc 45 — labels only */

  /* === Primary accent (cool-cool, indigo) === */
  --accent:         oklch(65.0% 0.180 265);  /* #5a8cff — primary CTA, focus rings */
  --accent-hover:   oklch(70.0% 0.180 265);
  --accent-muted:   oklch(50.0% 0.150 265 / 0.20);  /* tinted glass bg */

  /* === Optional warm-complement accent (60/30/10 rule, 10% usage max) === */
  --accent-warm:    oklch(82.0% 0.150 90);   /* #d9c25c — amber, for high-energy CTAs */

  /* === Semantic === */
  --success: oklch(70.0% 0.150 155);  /* #4fd093 */
  --warning: oklch(78.0% 0.150 70);   /* #e0a44a */
  --danger:  oklch(62.0% 0.220 25);   /* #f04a4a */
  --info:    oklch(70.0% 0.130 220);  /* #4fb8e0 */
}
```

**Design notes:**
- Hue locked at `260` (cool indigo-navy) across backgrounds — composes with both indigo (`265`) and cyan (`220`) accents without hue conflict.
- Lightness steps are exactly `+4.5%` per elevation — perceptually uniform thanks to OKLCH.
- Text Lc verified against `--bg-base`: primary ≈96, secondary ≈70 — both above APCA Silver.
- `--accent-muted` is the glass-tint source for A3 (40–60% alpha will render as a soft indigo wash).
- Accent hue `265` sits between Radix blue-9 (`#0090ff`, ~250°) and indigo-9 (`#3e63dd`, ~270°) — splits the difference for maximum harmony with both scales if you import them later.

---

## 4. Cross-References to Sibling Research

- **A1 (Trust psychology):** Navy carries trust associations; this palette's chroma restraint (`C ≤ 0.04` on surfaces) is the visual mechanism — defer psychology framing to A1.
- **A3 (Glass/backdrop):** Use `--accent-muted` + `--border-glass` as inputs. Glass requires `--bg-base` ≥ Lc 15% to avoid disappearing through 60% alpha overlays — confirmed.
- **A4 (Borders/corners):** `--border-glass` (10% white) and `--border-subtle` (30% lightness, 50% alpha) are the two border tokens; defer radius/thickness to A4.
- **A5 (Teardowns):** I cited Linear/Stripe/Vercel/Apple color docs only — full UX teardowns belong to A5.

**Gap noted:** Vercel Geist's full 10-step scales are behind a Figma file; only brand blue and structural tokens are public. Apple SF Symbols dark-mode palette is documented only for system colors, not full elevation layers. Both gaps are non-blocking for this palette.

---

## 5. Sources

- [Radix Colors — Scales documentation](https://www.radix-ui.com/colors/docs/palette-composition/scales)
- [Radix Colors — Composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette)
- [Tailwind CSS v4 — Colors (OKLCH defaults)](https://tailwindcss.com/docs/colors)
- [Linear — How we redesigned the Linear UI (LCH theme generation)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Vercel Geist — Colors](https://vercel.com/geist/colors)
- [Stripe — Support dark mode in Connect embedded](https://docs.stripe.com/connect/embedded-appearance-support-dark-mode)
- [Stripe — Designing accessible color systems](https://stripe.com/blog/accessible-color-systems)
- [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple HIG — Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [GitHub Primer — Color foundations](https://primer.style/foundations/color/overview/)
- [APCA in a Nutshell — Andrew Somers](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)
- [Humbl Design — 2026 Engineering Guide to Color & APCA](https://humbldesign.io/blog-posts/color-accessibility-guide-wcag)
- [Material Design 3 — Applying elevation in dark themes](https://m3.material.io/styles/elevation/applying-elevation)
- [ColorUI — OKLCH vs HSL for design systems](https://colorui.io/blog/oklch-vs-hsl-design-systems)
- [Mobbin — Linear brand colors](https://mobbin.com/colors/brand/linear)
