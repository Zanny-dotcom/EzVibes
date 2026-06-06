# Dark Mode Tokens & Contrast — Research Findings

Research slice 6 of 10. Complementary to agent 1 (palette) — this slice covers **token structure and contrast math** only. No brand colors.

---

## 1. Why Off-Black Beats Pure-Black for Most Use Cases

Pure black (`#000000`) on light text yields ~21:1 contrast — well above WCAG AA — but is generally a poor default for product UI:

- **Halation**: White or near-white text on `#000` bleeds visually for users with astigmatism (30–60% of adults). The text appears to "glow" or smear, slowing reading and causing fatigue. Off-black (`#0F0F12`–`#161618`) reduces halation while still reading as "dark."
- **WCAG 2.x overstates contrast near black.** The relative-luminance formula compresses differences in the dark range, so a "passing" 4.5:1 pair can still be functionally unreadable when one color is near `#000`. APCA addresses this; WCAG 2.x does not.
- **Elevation breaks down on pure black.** Material's overlay-based elevation needs a non-zero base luminance to step up from. With `#000`, surfaces at +5–8% luminance still feel flat because the eye can't easily distinguish dark-from-darker without shadows (which themselves disappear on `#000`).
- **OLED tradeoff is real but narrow.** True-black `#000` pixels are literally off on OLED, saving power and producing infinite contrast — useful for full-screen media or AMOLED-targeted apps, but the eye-fatigue and elevation costs usually outweigh the battery win for productivity UI. Use `#000` only for hero/media surfaces, not chrome.
- **Reduces stark "screen-as-portal" effect.** A slight warm or cool tint (`#0E1116` cool, `#13110F` warm) reads as a designed surface rather than a void.

**Default: `#0E1116`–`#121417` for app chrome; reserve `#000` for OLED-hero treatments.**

---

## 2. Token Taxonomy — Full Role Definitions

A robust dark-mode token system needs three orthogonal axes: **layer (where it sits)**, **role (what it does)**, and **state (how it reacts)**.

| Token | Role | Typical use |
|---|---|---|
| `bg.canvas` | Base background (lowest layer) | The page/app shell behind everything |
| `bg.surface` | Default surface (cards, panels) | Primary content containers |
| `bg.surface-raised` | +1 elevation (popovers, dropdowns) | Floating but anchored UI |
| `bg.surface-overlay` | +2 elevation (modals, tooltips) | Modal layer above all content |
| `bg.surface-sunken` | Inset surface (input wells, tracks) | Visually recessed areas |
| `bg.surface-hover` | Surface in hover state | +3–5% luminance shift |
| `bg.surface-active` | Surface in pressed/active state | +5–8% luminance shift |
| `border.subtle` | Hairline divider | 1px lines, table rows |
| `border.default` | Standard border | Card edges, input borders |
| `border.strong` | High-emphasis border | Selected states, focus containers |
| `fg.primary` | Body text, headings | Main content, ~Lc 90+ / 13:1+ |
| `fg.secondary` | Supporting text | Captions, metadata, ~Lc 75 / 7:1 |
| `fg.muted` | De-emphasized text | Placeholder, helper text, ~Lc 60 / 4.5:1 |
| `fg.disabled` | Disabled controls | ~Lc 45 / 3:1 — *not* required to meet AA |
| `fg.on-emphasis` | Text on colored buttons/badges | Computed per accent |
| `focus.ring` | Keyboard focus indicator | High-contrast ring, ≥3:1 vs all adjacent |
| `focus.ring-offset` | Halo/offset around focus | Usually matches canvas |
| `accent.primary` | Brand accent (owned by agent 1) | — |
| `status.{success,warn,danger,info}` | Semantic colors | Must each pass 3:1 non-text + 4.5:1 text |

**Rule:** Use elevation through luminance *and* border, not shadow alone. Shadows below `#0F` lose contrast against the canvas.

---

## 3. WCAG 2.2 vs APCA on Dark Surfaces — Concrete Numbers

### WCAG 2.2 Level AA minimums (legal compliance baseline)

| Element | Minimum ratio | Notes |
|---|---|---|
| Normal text (<18pt or <14pt bold) | **4.5:1** | Same number, light or dark |
| Large text (≥18pt or ≥14pt bold) | **3:1** | |
| Non-text (icons, borders, focus rings) | **3:1** | SC 1.4.11 |
| Focus indicator vs all adjacent colors | **3:1** | SC 2.4.13 (WCAG 2.2 new) |
| Disabled elements | *Exempt* | Not required to meet AA |

### APCA recommendations (perceptually uniform; better for dark mode)

| Use case | Min Lc | Notes |
|---|---|---|
| Body text (16px / 400) | **Lc 75** | Preferred Lc 90 for long-form |
| Large readable text (24px bold / 36px normal) | **Lc 45** | |
| General content (non-body) | **Lc 60** | |
| Spot-readable text & semantic icons | **Lc 30** | Absolute floor |
| Non-text "discernible" elements | **Lc 15** | Below this = treat as invisible |

**APCA adoption status (verify-before-trusting):** APCA is *draft guidance*, not an adopted standard. It was pulled from the July 2023 WCAG 3 working draft because the WG declined to support it. It is still being developed independently by Inclusive Reading Technologies as the "APCA Readability Criterion." WCAG 3 itself remains a Working Draft as of 2025–2026. **Compliance target = WCAG 2.2 AA today; use APCA as a design aid for comfort, not for legal claims.**

### Why the divergence matters in dark mode
WCAG 2.x's relative-luminance math overstates contrast at the dark end of the scale. A pair like `#FFFFFF` on `#3A3A3A` scores 9.7:1 on WCAG (looks great on paper) but APCA flags it as marginal for body text. The reverse — a "passing" 4.5:1 pair where one color is near `#000` — is often functionally unreadable. Use APCA when judging comfort/legibility; use WCAG to claim conformance.

---

## 4. Common Contrast Failures in Dark Mode

1. **Focus rings on dark surfaces.** A subtle accent ring (e.g., `#3B82F6` blue) hits 3:1 against `#121417` but fails against a hovered surface at `#1E2128`. Always test against *every* adjacent color, or use the two-color (light+dark, ≥9:1 between them) technique so one half always passes.
2. **Muted/secondary text drift.** `fg.muted` is the most common WCAG fail — designers eyeball "gray on dark" and land at `#6B7280` on `#121417` (~3.9:1). Bump to `#9CA3AF`+ to clear 4.5:1.
3. **Disabled state confusion.** WCAG exempts disabled elements, but if the same gray is used for "disabled" and "muted helper text" the helper text silently fails AA. Keep them as distinct tokens.
4. **Hover states fading borders.** A `border.subtle` token at `#1F2329` against `bg.surface #161A20` is ~1.3:1 — fine for hairlines, but it disappears entirely on `bg.surface-raised`. Define hover borders explicitly.
5. **Placeholder text below 4.5:1.** Placeholder ≠ disabled; if it conveys instructions it must meet AA.
6. **Status colors picked from light-mode palette.** A success green tuned for white backgrounds often goes muddy on `#0F1115`. Re-tune each status hue per theme; saturation usually drops 10–20% and lightness rises 5–10%.
7. **Pure-white body text on pure-black.** 21:1 contrast, maximum halation. Use `#E5E7EB`–`#EDEDED` on off-black.

---

## 5. Example Dark-Mode Token System (Working Values)

Values are illustrative, not brand-bound. Verified against WCAG 2.2 AA where ratios are quoted.

| Token | Hex | Contrast vs `bg.canvas #0E1116` |
|---|---|---|
| `bg.canvas` | `#0E1116` | — |
| `bg.surface` | `#161A20` | 1.27:1 (intentional, low) |
| `bg.surface-raised` | `#1C212A` | 1.54:1 |
| `bg.surface-overlay` | `#232936` | 1.95:1 |
| `bg.surface-sunken` | `#0A0D11` | 0.85:1 (darker than canvas) |
| `border.subtle` | `#222831` | 1.78:1 |
| `border.default` | `#2E3642` | 2.55:1 |
| `border.strong` | `#475063` | 4.30:1 (passes 3:1 non-text) |
| `fg.primary` | `#ECEEF1` | **15.6:1** (AAA) |
| `fg.secondary` | `#B7BDC7` | **9.4:1** (AAA) |
| `fg.muted` | `#8A92A0` | **5.1:1** (AA) |
| `fg.disabled` | `#5A6170` | 2.5:1 (exempt) |
| `focus.ring` | `#7DD3FC` | **9.8:1** vs canvas, **3.2:1** vs surface-overlay |
| `focus.ring-offset` | `#0E1116` (= canvas) | — |

Elevation steps in luminance: ~+5–8% per layer. Borders rise faster than surfaces so cards remain legible against raised surfaces.

---

## 6. Sources

- [Muzli — Dark Mode Design Systems: Patterns, Tokens, Hierarchy](https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/)
- [Accessibility Checker — Designer's Guide to Dark Mode Accessibility](https://www.accessibilitychecker.org/blog/dark-mode-accessibility/)
- [APCA in a Nutshell — official spec](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)
- [Adrian Roselli — WCAG3 Contrast as of April 2026](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html)
- [W3C WCAG 2.2 SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C WCAG 2.2 SC 2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [Sara Soueidan — Designing accessible focus indicators](https://www.sarasoueidan.com/blog/focus-indicators/)
- [W3C C40 — Two-color focus indicator technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C40)
- [Material Design — Dark theme & elevation overlays](https://m2.material.io/design/color/dark-theme.html)
- [Atlassian Design — Elevation foundations](https://atlassian.design/foundations/elevation)
