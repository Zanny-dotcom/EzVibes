# Research — Corners, Bezels & Hairline Borders (2024–2026)

Slice A4 of 10. Owns: hairline border systems, corner-radius math, two-tone/inset highlights, modern token systems. Out of scope: trust (A1), palette values (A2), liquid-glass fill (A3), site teardowns (A5).

---

## 1. How to Look at This Correctly (Meta)

The "slim, refined chrome" that defines Linear, Vercel, Arc, Raycast and Zed is not one trick — it is a stack of small decisions evaluated through five lenses. Most "premium" UIs fail because they only optimise one or two.

**Lens 1 — Stroke thickness vs perceived density.** A 1px CSS border is rendered at the device pixel ratio of the screen, so on a 2x/3x display the stroke is physically thinner than on a 1x display, which is the whole reason "hairline" feels native on Retina. The evaluator question: *does the border still read as a line at 1x, and does it stay a line — not a slab — at 3x?* This is why premium UIs use `1px` (not `0.5px`) plus a low-opacity colour: opacity is the variable that survives DPR changes, not sub-pixel width.

**Lens 2 — Border colour strategy in dark mode.** A `#23252a` hard-coded border (Linear's actual Charcoal Grey token per the published palette) survives recolouring; `rgba(255,255,255,0.08)` follows the background but breaks if the background is not dark. shadcn/ui ships `oklch(1 0 0 / 10%)` for dark borders — white at 10% opacity expressed in OKLCH. The evaluator question: *if the background brightness changes, does the border still read as one step lighter (carved) or one step darker (embossed)?*

**Lens 3 — Nested radius coherence.** The single rule that separates pro UI from amateur UI is `outer_radius = inner_radius + padding`. When violated, arcs become non-concentric and the eye reads "wrong" without knowing why. Evaluator question: *do parent and child arcs share a centre?*

**Lens 4 — Carved vs floating.** A "card with a border" sits on top of the background. A "card carved into the background" combines a top inset highlight (`inset 0 1px 0 rgba(255,255,255,0.06)`) with a bottom outer shadow — this is the glass-edge convention. Evaluator question: *does the top edge appear to catch light?*

**Lens 5 — Curvature continuity.** Apple's `RoundedCornerStyle.continuous` (the iOS squircle) uses a Lamé superellipse, not a circular arc. CSS `border-radius` is circular, which leaves visible G1 discontinuities at the corner. For a dense grid (favicons, app-icon grids) this matters; for a button in isolation it does not. Evaluator question: *is this asset in a grid? If yes, ship a squircle clip-path; if no, `border-radius` is fine.*

---

## 2. Current State of the Art (2024–2026)

**Hairline borders.** The 2024–2026 default for premium dark UI is `1px solid rgba(255,255,255,0.08–0.12)`. Linear uses a hard-coded `#23252a` for borders against a `#08090a` background, which lands near that same effective lightness. shadcn/ui's published default is `oklch(1 0 0 / 10%)` for `--border` in dark mode — the same idea, but it scales with the OKLCH-based palette rather than freezing a hex.

**Border-image vs background-clip.** `border-image` with a gradient *cannot* be combined with `border-radius` (MDN), so the modern technique for a rounded gradient border is the **two-layer background-clip method**: a `padding-box`-clipped fill on top of a `border-box`-clipped gradient. This is what shadcn-style "fancy border" components ship today, and it is the only single-element approach that gives a rounded gradient hairline.

**Two-tone / bevel borders.** A physical bevel is two inset shadows stacked: a light one offset down from the top, a dark one offset up from the bottom. With `box-shadow` (not the legacy `border-style: outset`) the bevel does not affect the box model. The dominant 2025 pattern is the **single top highlight**: drop the bottom-dark stroke and keep only `inset 0 1px 0 rgba(255,255,255,0.06)` — this is the "glass edge" that catches light without making the surface look skeuomorphic.

**Nested radius systems.** Tailwind v4 ships `--radius-xs` through `--radius-4xl` as CSS variables (2px → 32px), with `rounded-full` as `calc(infinity * 1px)`. shadcn/ui builds a *derived* scale from a single `--radius` (default `0.625rem` / 10px) using calc multipliers (`* 0.6`, `* 0.8`, `* 1.4`, `* 1.8`, `* 2.2`, `* 2.6`) — so one variable change cascades to the whole scale. Both approaches assume the developer applies the nested-radius rule by hand; neither tokenises padding into the radius itself.

**Micro-bezels in IDEs.** Zed's `active_pane_modifiers.border_size` defaults to `0.0` — no pane border at all. The "bezel" between panels is created entirely by the background-colour step between editor surface and panel chrome, not by a stroke. Cursor and Zed have effectively retired the panel border; VS Code still ships a `panel.border` token but most popular themes set it to a 1px hairline in the same hue family as the chrome.

**Squircle vs rounded-rect.** No CSS property ships continuous corners yet. The 2025 production options are: `clip-path: path(...)` with a precomputed superellipse, or a Houdini paint worklet (Chromium-only), or one of the JS libraries (squircle.js, react-ios-corners, CornerKit). For most product UI (buttons, cards) the visual gain is marginal; for app-icon grids and tightly packed thumbnail rails it is the single biggest "Apple-feel" upgrade you can ship.

**Continuous tokens, derived scales.** The shadcn pattern of one `--radius` driving the whole scale via `calc()` is now the dominant token architecture, copied across most 2025 design systems. It collapses radius, palette, and density into a small set of root variables that can be themed without rewriting components.

---

## 3. Implementation Guidance

### 3.1 Hairline border + glass-edge highlight (single card)

```css
/* Premium dark-mode card. Hairline + top highlight + soft outer shadow. */
.card {
  background: #0b0c0e;                         /* near-pitch surface */
  border: 1px solid rgba(255, 255, 255, 0.08); /* hairline, DPR-safe */
  border-radius: 12px;                         /* outer radius */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),   /* glass-edge top highlight */
    0 1px 0 rgba(0, 0, 0, 0.4),                /* 1px sit-down shadow */
    0 8px 24px -8px rgba(0, 0, 0, 0.5);        /* soft ambient lift */
}

/* OKLCH equivalent (shadcn/ui v4 style) */
:root {
  --border: oklch(1 0 0 / 10%);
  --radius: 0.625rem;
}
.card-oklch {
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
```

The `inset 0 1px 0` line is the one that makes the surface read as carved rather than pasted. Drop it and the card looks generic; keep it and it feels like Linear/Vercel.

### 3.2 Nested radius — concentric arcs

```css
/* Rule: inner_radius = outer_radius - padding */
:root {
  --radius-card: 16px;
  --pad-card: 8px;
  --radius-inner: calc(var(--radius-card) - var(--pad-card)); /* 8px */
}

.card {
  border-radius: var(--radius-card);  /* 16px */
  padding: var(--pad-card);           /* 8px */
}
.card > .button {
  border-radius: var(--radius-inner); /* 8px — concentric with parent */
}

/* Edge case: if inner radius computes <= 0, floor at 2–4px for softness */
.card-tight > .button {
  border-radius: max(2px, calc(var(--radius-card) - var(--pad-card)));
}
```

### 3.3 Rounded gradient hairline (background-clip technique)

```css
/* border-image cannot combine with border-radius (MDN).
   The two-layer background-clip trick is the only single-element fix. */
.fancy-border {
  border-radius: 12px;
  background:
    linear-gradient(#0b0c0e, #0b0c0e) padding-box,           /* fill */
    linear-gradient(180deg,
      rgba(255,255,255,0.14),
      rgba(255,255,255,0.04)) border-box;                    /* hairline */
  border: 1px solid transparent;                             /* reveals border-box layer */
}
```

---

## 4. Cross-References to Sibling Research

- **A1 (trust psychology):** hairline borders and nested radii are *trust signals* — they are read pre-attentively as "made by someone who measures things." Tie this slice's evaluator lenses to A1's trust framework.
- **A2 (palette):** every value above is expressed as `rgba(255,255,255, α)` or `oklch(1 0 0 / α)` so it composites onto whatever neutral A2 picks. Do not hard-code border hex values unless following Linear's locked-palette approach.
- **A3 (liquid glass):** A3 owns `backdrop-filter` and translucent fills. This slice's `inset 0 1px 0` highlight is the same "edge catches light" idea applied to opaque surfaces — pair them on glass surfaces, do not duplicate.
- **A5 (teardowns):** A5 should verify that the Linear `#23252a` border, Zed's zero-border pane, and shadcn's `oklch(1 0 0 / 10%)` are still current at audit time — palettes drift quarterly.

Common practice, not specced: the specific `inset 0 1px 0 rgba(255,255,255,0.06)` recipe is a convention popularised by Vercel/Linear-style sites; there is no W3C spec for "glass edge". Treat as community standard, not standardised.

---

## 5. Sources

1. [Your radius nesting guide — Hype4 Academy](https://hype4.academy/articles/design/your-radius-nesting-guide) — canonical formula `inner = outer − padding`.
2. [Nested rounded corners — Ondřej Konečný](https://www.ondrejkonecny.com/blog/nested-rounded-corners/) — concentric-arc explanation, edge cases.
3. [BetterCorners — Mathematically correct border radius](https://bettercorners.io/) — concentric arc math demo.
4. [Tailwind CSS v4 border-radius docs](https://tailwindcss.com/docs/border-radius) — `--radius-*` token table, logical properties.
5. [shadcn/ui theming docs](https://ui.shadcn.com/docs/theming) — derived-scale pattern from single `--radius`, `oklch(1 0 0 / 10%)` dark border.
6. [Linear design system reference (Refero)](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1) — Linear palette including `#23252a` border, 6px radius convention.
7. [How we redesigned the Linear UI — Linear](https://linear.app/now/how-we-redesigned-the-linear-ui) — LCH-based theming, three-variable colour system.
8. [MDN: border-image](https://developer.mozilla.org/en-US/docs/Web/CSS/border-image) — confirms incompatibility with `border-radius`.
9. [Gradient Borders in CSS — CSS-Tricks](https://css-tricks.com/gradient-borders-in-css/) — background-clip two-layer technique.
10. [conic-gradient() — web.dev](https://web.dev/articles/conic-gradient-border) — rotating/shine borders with `@property`.
11. [Squircles in Apple design — squircle.js](https://squircle.js.org/blog/squircles-in-apple-design) — Lamé superellipse rationale, G1 discontinuity argument.
12. [RoundedCornerStyle.continuous — Apple Developer](https://developer.apple.com/documentation/swiftui/roundedcornerstyle/continuous) — Apple's official continuous-corner API.
13. [Smooth corners with CSS Houdini — Vincent De Oliveira](https://iamvdo.me/en/blog/smooth-corners-with-css-houdini) — Houdini paint-worklet squircle approach.
14. [Zed visual customization docs](https://zed.dev/docs/visual-customization) — `active_pane_modifiers.border_size: 0.0` default.
15. [Dark Glassmorphism — Medium](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) — `inset 0 1px 0 rgba(255,255,255,0.1)` glass-edge recipe.
16. [box-shadow — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow) — inset shadow spec, layering semantics.

Word count: ~1,290.
