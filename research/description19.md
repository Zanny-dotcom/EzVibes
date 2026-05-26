# OKLCH & P3 Wide-Gamut Color Systems for the Prompt Vault (2025–2026)

> Research dossier for the EZvibes — agent #19 of 30.
> Focus: a 2026-grade color system for the in-app "vault" panel, built on OKLCH semantic tokens and Display-P3 wide gamut, designed to look pioneer-level cool in dark mode while passing modern accessibility math.

---

## 0. Why this matters for the vault

The vault is a dark panel of clickable markdown cards docked inside an Electron + xterm session window. Three constraints make color choice unusually load-bearing:

1. **It floats over a live terminal.** Whatever palette we pick has to coexist with xterm's 16-color ANSI rendering without smearing into it. We need a chromatic identity that is *clearly UI, not text*, so the user's eye separates the two layers instantly.
2. **It is a long-stare surface.** A user will scroll, hover, and click prompt files repeatedly. Tiny perceptual misses in HSL/RGB compound: a "muted gray-blue" that drifts purple at 35% lightness will look amateur after the third scroll. OKLCH eliminates that drift.
3. **Pioneer-grade hardware exists in the install base.** Most modern MacBooks since 2016, every recent iMac/iPad Pro, the Studio Display, and many high-end Windows laptops (LG, Dell UltraSharp, ASUS ProArt, MSI Creator, ROG Strix) ship Display-P3 panels. Designing only in sRGB on those displays *throws away* roughly 25–35% of available color volume. P3 gradients and accents feel "physically brighter" than the same pixels would in any RGB-on-the-internet design from 2019.

OKLCH plus a P3 progressive enhancement layer is how Linear, Arc, Vercel, Raycast, Radix, and Tailwind v4 ship in 2025–2026. This document is the recipe for matching them in EZvibes.

---

## 1. OKLCH primer (2026 status)

### 1.1 Components

`oklch(L C H / alpha)`

- **L (Lightness)** — perceived lightness, `0` (black) → `1` (white). Critically, equal-step deltas of L feel like equal brightness changes across all hues. This is *not* true in HSL, HSV, or sRGB.
- **C (Chroma)** — absolute colorfulness, `0` (gray) → ~`0.37` (sRGB max), ~`0.40+` (P3 max). Unlike HSL "saturation," chroma is a real distance, not a normalized percentage, so a chroma of `0.20` means the same intensity at L=0.50 as at L=0.80 (capped by gamut limits).
- **H (Hue)** — `0°–360°` angle in the perceptual color wheel. Approximate landmarks:
  - `0–30°` reds (`20°` ≈ tomato)
  - `30–60°` orange (`55°` ≈ pumpkin)
  - `60–110°` yellow / chartreuse (`90°` ≈ pure yellow)
  - `110–180°` green / teal (`145°` ≈ leaf green, `180°` ≈ cyan-teal)
  - `180–240°` cyan → blue (`220°` ≈ cornflower blue)
  - `240–300°` blue → violet (`270°` ≈ indigo, `290°` ≈ violet)
  - `300–360°` magenta → pink (`330°` ≈ hot pink, `355°` ≈ rose-red)

### 1.2 Browser support (Q2 2026)

| Feature | Chrome | Firefox | Safari | Edge | Electron 33+ |
|---|---|---|---|---|---|
| `oklch()` value | 111+ | 113+ | 15.4+ | 111+ | Yes (Chromium 130+) |
| `color(display-p3 ...)` | 111+ | 113+ | 15+ | 111+ | Yes |
| Relative color syntax `oklch(from ...)` | 119+ | 128+ | 16.4+ | 119+ | Yes |
| `color-mix(in oklch, ...)` | 111+ | 113+ | 16.2+ | 111+ | Yes |
| `light-dark()` | 123+ | 120+ | 17.5+ | 123+ | Yes |
| `@property` | 85+ | 128+ | 16.4+ | 85+ | Yes |
| `@media (color-gamut: p3)` | 58+ | 110+ | 10+ | 79+ | Yes |

Electron 33 ships Chromium 130 — every feature in this document is natively supported. **No PostCSS polyfills required for the vault.**

### 1.3 Why OKLCH beats HSL and CIE LCH

- **HSL**: `hsl(60 100% 50%)` is searing yellow at L=50%; `hsl(240 100% 50%)` is dark navy at the same L=50%. Brightness is not normalized to perception, only to RGB component math. This is why HSL "darken by 10%" produces wildly different visual deltas across hues.
- **CIE LCH**: better than HSL but has a known *hue-shift bug* in the blue range (270–330°). Cranking chroma at hue 290° drifts the color toward purple. OKLCH was specifically designed by Björn Ottosson (2020) to fix this — its blues stay blue across all chroma changes.
- **OKLCH**: perceptual lightness is essentially linear, hue is stable under chroma changes, and the color space cleanly encodes P3 (and even Rec.2020) values that RGB/HSL/hex literally cannot represent.

### 1.4 The killer property for design systems

You can pick a target lightness curve once — say, `[0.985, 0.96, 0.92, 0.87, 0.71, 0.55, 0.45, 0.37, 0.28, 0.21, 0.13]` — and **every hue family on that curve will feel visually balanced.** No more "the green-500 feels too dark next to red-500." Tailwind v4 made OKLCH the default for exactly this reason.

---

## 2. Display-P3 wide-gamut: the pioneer layer

### 2.1 What P3 buys you

DCI/Display-P3 contains roughly **25% more colors than sRGB**, mostly in the saturated greens, oranges, and magentas — exactly the hues that "pop" in dark UI. The Adobe RGB / Rec.2020 spaces extend further still, but P3 is the practical shipping target for 2026: it matches the native gamut of every Mac retina display, iPad Pro, modern iPhone, and a growing share of premium Windows laptops.

### 2.2 Detection patterns

```css
/* Native CSS detection */
@media (color-gamut: p3) {
  :root {
    /* Push chroma further on capable displays */
    --vault-accent: oklch(0.74 0.21 70);
  }
}

/* JS gate (rarely needed; CSS handles it) */
const isP3 = matchMedia('(color-gamut: p3)').matches;
```

### 2.3 The clean OKLCH-on-P3 pattern

OKLCH already knows about gamuts. If you specify a chroma value that exists in P3 but not in sRGB, the browser performs gamut mapping for sRGB-only displays — it lowers chroma minimally to land back inside sRGB without shifting hue or lightness. This means you can write a **single** OKLCH variable and trust the browser:

```css
/* Browser auto-maps to sRGB on standard displays */
--vault-accent: oklch(0.74 0.21 70);  /* warm amber, blooms on P3 */
```

For pioneer-grade aggressiveness, layer an explicit P3 override:

```css
:root {
  --vault-accent: oklch(0.74 0.17 70);          /* sRGB-safe baseline */
}
@media (color-gamut: p3) {
  :root {
    --vault-accent: oklch(0.74 0.21 70);        /* +24% chroma on P3 */
  }
}
```

### 2.4 Where P3 visibly slaps

- **Hover halos and focus rings** — push to chroma 0.18–0.24 in the 50–80° (amber) or 145–155° (green-teal) hue ranges.
- **Active selection highlights** behind a markdown card — a P3 oklch teal at `oklch(0.62 0.18 170)` glows.
- **Linear-gradient strokes** — animated gradients in OKLCH look 2026; the same gradient in `srgb` interpolation looks like 2018.
- **The vault's title chrome / brand stripe** — one saturated P3 hue here is the single best "wow on first open" lever.

---

## 3. Tailwind v4 default palette (full OKLCH reference)

Tailwind v4 made OKLCH the default in early 2025. This is the canonical reference list — use these values as a starting point or steal whole rows.

### 3.1 Neutrals (use these for the vault chrome)

```css
/* Slate — neutral with cool blue undertone */
--slate-50:  oklch(98.4% 0.003 247.858);
--slate-100: oklch(96.8% 0.007 247.896);
--slate-200: oklch(92.9% 0.013 255.508);
--slate-300: oklch(86.9% 0.022 252.894);
--slate-400: oklch(70.4% 0.040 256.788);
--slate-500: oklch(55.4% 0.046 257.417);
--slate-600: oklch(44.6% 0.043 257.281);
--slate-700: oklch(37.2% 0.044 257.287);
--slate-800: oklch(27.9% 0.041 260.031);
--slate-900: oklch(20.8% 0.042 265.755);
--slate-950: oklch(12.9% 0.042 264.695);

/* Zinc — neutral with warm violet undertone */
--zinc-50:  oklch(98.5% 0     0);
--zinc-100: oklch(96.7% 0.001 286.375);
--zinc-200: oklch(92.0% 0.004 286.32);
--zinc-300: oklch(87.1% 0.006 286.286);
--zinc-400: oklch(70.5% 0.015 286.067);
--zinc-500: oklch(55.2% 0.016 285.938);
--zinc-600: oklch(44.2% 0.017 285.786);
--zinc-700: oklch(37.0% 0.013 285.805);
--zinc-800: oklch(27.4% 0.006 286.033);
--zinc-900: oklch(21.0% 0.006 285.885);
--zinc-950: oklch(14.1% 0.005 285.823);

/* Neutral — pure grayscale, zero chroma */
--neutral-50:  oklch(98.5% 0 0);
--neutral-100: oklch(97.0% 0 0);
--neutral-200: oklch(92.2% 0 0);
--neutral-300: oklch(87.0% 0 0);
--neutral-400: oklch(70.8% 0 0);
--neutral-500: oklch(55.6% 0 0);
--neutral-600: oklch(43.9% 0 0);
--neutral-700: oklch(37.1% 0 0);
--neutral-800: oklch(26.9% 0 0);
--neutral-900: oklch(20.5% 0 0);
--neutral-950: oklch(14.5% 0 0);

/* Stone — warm neutral with brown undertone */
--stone-50:  oklch(98.5% 0.001 106.423);
--stone-100: oklch(97.0% 0.001 106.424);
--stone-200: oklch(92.3% 0.003 48.717);
--stone-300: oklch(86.9% 0.005 56.366);
--stone-400: oklch(70.9% 0.010 56.259);
--stone-500: oklch(55.3% 0.013 58.071);
--stone-600: oklch(44.4% 0.011 73.639);
--stone-700: oklch(37.4% 0.010 67.558);
--stone-800: oklch(26.8% 0.007 34.298);
--stone-900: oklch(21.6% 0.006 56.043);
--stone-950: oklch(14.7% 0.004 49.250);
```

### 3.2 Warm accents (vault status badges, "new file" pulse)

```css
/* Amber — the EZvibes brand color (matches existing claude chips) */
--amber-300: oklch(87.9% 0.169 91.605);
--amber-400: oklch(82.8% 0.189 84.429);
--amber-500: oklch(76.9% 0.188 70.080);
--amber-600: oklch(66.6% 0.179 58.318);
--amber-700: oklch(55.5% 0.163 48.998);

/* Orange — warmer than amber, leans red */
--orange-400: oklch(75.0% 0.183 55.934);
--orange-500: oklch(70.5% 0.213 47.604);
--orange-600: oklch(64.6% 0.222 41.116);

/* Red — destructive / delete */
--red-400: oklch(70.4% 0.191 22.216);
--red-500: oklch(63.7% 0.237 25.331);
--red-600: oklch(57.7% 0.245 27.325);

/* Yellow — highlight / "favorite" */
--yellow-400: oklch(85.2% 0.199 91.936);
--yellow-500: oklch(79.5% 0.184 86.047);
```

### 3.3 Cool accents (vault "codex" tab, links, info)

```css
/* Teal — matches existing codex chips */
--teal-400: oklch(77.7% 0.152 181.912);
--teal-500: oklch(70.4% 0.140 182.503);
--teal-600: oklch(60.0% 0.118 184.704);

/* Cyan — fresh, "live data" feel */
--cyan-400: oklch(78.9% 0.154 211.530);
--cyan-500: oklch(71.5% 0.143 215.221);

/* Blue — links, primary action */
--blue-400: oklch(70.7% 0.165 254.624);
--blue-500: oklch(62.3% 0.214 259.815);
--blue-600: oklch(54.6% 0.245 262.881);

/* Indigo — deep, "command palette" vibe */
--indigo-400: oklch(67.3% 0.182 276.935);
--indigo-500: oklch(58.5% 0.233 277.117);
```

### 3.4 Greens / Magentas

```css
/* Emerald — success */
--emerald-400: oklch(76.5% 0.177 163.223);
--emerald-500: oklch(69.6% 0.170 162.480);

/* Green — softer success */
--green-400: oklch(79.2% 0.209 151.711);
--green-500: oklch(72.3% 0.219 149.579);

/* Violet — "magical", AI-feel accents */
--violet-400: oklch(70.2% 0.183 293.541);
--violet-500: oklch(60.6% 0.250 292.717);

/* Fuchsia — pioneer-tier accent on P3 displays */
--fuchsia-400: oklch(74.0% 0.238 322.160);
--fuchsia-500: oklch(66.7% 0.295 322.150);

/* Pink — soft attention */
--pink-400: oklch(71.8% 0.202 349.761);
--pink-500: oklch(65.6% 0.241 354.308);
```

These are the *building blocks*. The vault uses a semantic token layer on top so we never call colors by Crayola name in components.

---

## 4. Radix Colors: the 12-step semantic ladder

Radix Colors is the most rigorously thought-out 12-step UI scale in the industry. Every Radix family uses the same role assignments per step number, so swapping `mauve` for `iris` swaps a whole theme. The 2025 release added an OKLCH-tuned P3 layer.

**The canonical 12-step role map:**

| Step | Role | Use |
|---|---|---|
| 1 | App background | The deepest surface; whole-app body color. |
| 2 | Subtle background | Sidebars, gentle panels, "behind cards" wash. |
| 3 | UI element BG (rest) | Button rest, input fill, chip rest. |
| 4 | UI element BG (hover) | Hover state of step 3. |
| 5 | UI element BG (active) | Pressed / selected. |
| 6 | Subtle border | Non-interactive separator. |
| 7 | UI element border | Interactive element border. |
| 8 | Hover border / focus ring | High-emphasis interactive outline. |
| 9 | Solid color | Brand accent fill — *highest chroma step*. |
| 10 | Solid hover | Hover for step 9. |
| 11 | Low-contrast text | Secondary text, captions. |
| 12 | High-contrast text | Body text, headings. |

**Contrast guarantee:** Radix tunes every scale so that **text on its own background passes APCA** at each pairing. Step 11 text on step 1/2 background is always readable.

**Vault application:**

```
.vault                       → background step 2
.vault__header               → background step 1 (deepest)
.vault__file-card            → background step 3
.vault__file-card:hover      → background step 4
.vault__file-card.active     → background step 5  + border step 8
.vault__file-card-border     → border step 6
.vault__file-card-title      → text step 12
.vault__file-card-mtime      → text step 11
.vault__paste-button         → background step 9, text step 12 (or contrasting white)
.vault__paste-button:hover   → background step 10
.vault__focus-ring           → step 8 (1.5–2px outline)
```

**Alpha scales:** Radix ships parallel "alpha" scales (e.g., `amberA1`–`amberA12`) of the same colors expressed as RGBA. These are essential for layering color over arbitrary backgrounds (like the live terminal underneath). For the vault, we want the alpha variants for the hover / active backgrounds so the terminal can subtly bleed through.

---

## 5. Production color systems in the wild

### 5.1 Linear

- **Approach**: dark-first design, perceptually uniform LCH/OKLCH ramps generated programmatically.
- **Reported philosophy**: define semantic role tokens (foregroundPrimary, backgroundSecondary, outlineTertiary), then a `ProColor` accessor resolves to the right stop for light/dark.
- **Backgrounds**: extremely dark cool neutrals at `oklch(0.16 0.012 250)` ish, with surface elevation in 4–6% L steps.
- **Accents**: their famous purple-blue gradient lands around `oklch(0.55 0.20 275)` to `oklch(0.62 0.24 290)`.

### 5.2 Vercel Geist

- **10 color scales**: Gray, Gray Alpha, Blue, Red, Amber, Green, Teal, Purple, Pink (+ background pair).
- **Semantic role naming (10-step):**
  - Color 1: default background
  - Color 2: hover background
  - Color 3: active background
  - Color 4–6: borders (default / hover / active)
  - Color 7–8: high-contrast background + hover
  - Color 9: secondary text/icons
  - Color 10: primary text/icons
- **P3**: explicitly states "P3 colors are used on supported browsers and displays."
- **Brand stance**: pure black `#000000` and pure white `#FFFFFF` as the chrome anchors. Use this if you want minimal, billboard-clean.

### 5.3 GitHub Primer Prism

- Tool philosophy: lock the lightness curve, vary chroma and hue, generate any palette from a single hue input.
- Originally HSLuv; the new Figma "Prism — OKLCH Color Palette Generator" uses OKLCH for the same job.

### 5.4 Raycast

- Strict dark-first. ANSI-flavored named colors map to OKLCH stops near `L≈0.65`, `C≈0.15`, hues at 0, 30, 60, 120, 200, 270, 330.

### 5.5 Tailwind v4

- Default palette in OKLCH (full table above).
- Brand accents typically `L≈0.55–0.70`, `C≈0.15–0.25`.

### 5.6 Apple HIG dark mode

- "Off-black" surfaces, not pure black: targets `#0A0A0A`–`#1C1C1E`.
- Tonal elevation: each elevated surface is a slightly *lighter* version of the base, by 4–8% L.
- Text colors avoid pure white: `#E0E0E0`–`#F2F2F2` (≈ `oklch(0.92 0 0)` to `oklch(0.96 0 0)`).
- Saturation bump of 10–20% for accents in dark mode to compensate for perceived washout.

### 5.7 shadcn/ui

- Default token list (CSS variables, OKLCH values):
  - `--background`, `--foreground`
  - `--card`, `--card-foreground`
  - `--popover`, `--popover-foreground`
  - `--primary`, `--primary-foreground`
  - `--secondary`, `--secondary-foreground`
  - `--muted`, `--muted-foreground`
  - `--accent`, `--accent-foreground`
  - `--destructive`, `--destructive-foreground`
  - `--border`, `--input`, `--ring`
  - `--chart-1` … `--chart-5`
  - `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`
  - `--radius` (base, with derived sm/md/lg/xl)

This is essentially the de-facto naming convention for 2026 apps. Steal it for the vault.

---

## 6. Semantic token taxonomy for the vault

Two-tier system: **primitives** (Crayola-named OKLCH values) → **semantic tokens** (intent-named). Components only ever consume semantic tokens.

### 6.1 Primitives (tier 1)

```css
:root {
  /* Brand hues — locked once, hue stays constant across scale */
  --hue-amber:   75;
  --hue-teal:    170;
  --hue-violet:  290;
  --hue-rose:    15;
  --hue-cool:    250;   /* base neutral hue */

  /* Lightness curve — same numbers every hue */
  --L-1:  0.985;
  --L-2:  0.96;
  --L-3:  0.92;
  --L-4:  0.87;
  --L-5:  0.71;
  --L-6:  0.55;
  --L-7:  0.45;
  --L-8:  0.37;
  --L-9:  0.28;
  --L-10: 0.21;
  --L-11: 0.13;
}
```

### 6.2 Semantic tokens (tier 2) — dark mode default

```css
:root,
.dark {
  /* App canvas (3 elevation steps, each +6% L from previous) */
  --bg-base:        oklch(0.13 0.012 250);   /* deepest — vault outer */
  --bg-elevated:    oklch(0.18 0.014 250);   /* card surface */
  --bg-overlay:     oklch(0.24 0.016 250);   /* hover / popover */
  --bg-canvas:      oklch(0.08 0.008 250);   /* even deeper — modal */

  /* Borders / dividers — keep chroma tiny */
  --border-subtle:  oklch(0.28 0.014 250);
  --border-default: oklch(0.36 0.020 250);
  --border-strong:  oklch(0.50 0.030 250);
  --border-focus:   oklch(0.74 0.18  75);    /* amber focus ring */

  /* Text — never pure white */
  --text-primary:   oklch(0.96 0.005 250);
  --text-secondary: oklch(0.78 0.012 250);
  --text-muted:     oklch(0.62 0.018 250);
  --text-faint:     oklch(0.48 0.020 250);
  --text-inverse:   oklch(0.12 0.008 250);   /* used on accent buttons */

  /* Accent (amber — the EZvibes signature) */
  --accent-default: oklch(0.74 0.17  75);
  --accent-hover:   oklch(0.80 0.18  75);
  --accent-active:  oklch(0.66 0.16  75);
  --accent-subtle:  oklch(0.28 0.05  75);   /* tinted background */
  --accent-text:    oklch(0.86 0.18  75);   /* on dark surfaces */

  /* Secondary accent (teal — codex / info) */
  --info-default:   oklch(0.70 0.14 170);
  --info-hover:     oklch(0.76 0.15 170);
  --info-subtle:    oklch(0.26 0.05 170);

  /* Status */
  --success: oklch(0.72 0.18 145);
  --warning: oklch(0.78 0.19  85);
  --danger:  oklch(0.65 0.24  25);

  /* Surfaces with translucency — to layer over xterm */
  --bg-elevated-alpha: oklch(0.18 0.014 250 / 0.82);
  --bg-overlay-alpha:  oklch(0.24 0.016 250 / 0.92);
}

/* Push chroma harder on P3 displays */
@media (color-gamut: p3) {
  :root {
    --accent-default: oklch(0.74 0.21  75);
    --accent-hover:   oklch(0.80 0.23  75);
    --info-default:   oklch(0.70 0.18 170);
    --success:        oklch(0.72 0.23 145);
    --warning:        oklch(0.78 0.23  85);
    --danger:         oklch(0.65 0.29  25);
  }
}
```

### 6.3 Optional light theme (if the user toggles)

```css
.light {
  --bg-base:        oklch(0.985 0.003 250);
  --bg-elevated:    oklch(0.96  0.005 250);
  --bg-overlay:     oklch(0.92  0.007 250);

  --border-subtle:  oklch(0.90 0.010 250);
  --border-default: oklch(0.84 0.014 250);
  --border-strong:  oklch(0.72 0.020 250);

  --text-primary:   oklch(0.18 0.012 250);
  --text-secondary: oklch(0.40 0.018 250);
  --text-muted:     oklch(0.55 0.020 250);

  --accent-default: oklch(0.65 0.18 75);
  --accent-hover:   oklch(0.58 0.20 75);
  --accent-text:    oklch(0.40 0.20 75);
}
```

### 6.4 `light-dark()` alternative (cleaner for some teams)

```css
:root {
  color-scheme: light dark;

  --bg-base:      light-dark(oklch(0.985 0.003 250), oklch(0.13 0.012 250));
  --bg-elevated:  light-dark(oklch(0.96  0.005 250), oklch(0.18 0.014 250));
  --text-primary: light-dark(oklch(0.18  0.012 250), oklch(0.96 0.005 250));
  --accent-default: light-dark(oklch(0.65 0.18 75), oklch(0.74 0.17 75));
}
```

`light-dark()` eliminates the `@media` duplication. Browser support is Chrome/Edge 123+, Firefox 120+, Safari 17.5+ — all green in Electron 33.

---

## 7. Building palettes with relative color syntax

This is the 2026 superpower: derive an entire scale from one accent.

### 7.1 The whole palette from a single token

```css
:root {
  --accent: oklch(0.74 0.17 75);   /* one source of truth */

  /* Tonal scale (lighter → darker) using relative color syntax */
  --accent-50:  oklch(from var(--accent) 0.985 calc(c * 0.10) h);
  --accent-100: oklch(from var(--accent) 0.96  calc(c * 0.20) h);
  --accent-200: oklch(from var(--accent) 0.92  calc(c * 0.35) h);
  --accent-300: oklch(from var(--accent) 0.87  calc(c * 0.55) h);
  --accent-400: oklch(from var(--accent) 0.78  calc(c * 0.80) h);
  --accent-500: oklch(from var(--accent) 0.71      c          h);  /* base */
  --accent-600: oklch(from var(--accent) 0.62  calc(c * 0.95) h);
  --accent-700: oklch(from var(--accent) 0.52  calc(c * 0.80) h);
  --accent-800: oklch(from var(--accent) 0.42  calc(c * 0.65) h);
  --accent-900: oklch(from var(--accent) 0.32  calc(c * 0.50) h);
  --accent-950: oklch(from var(--accent) 0.20  calc(c * 0.40) h);
}
```

Change `--accent` once → the whole vault rethemes instantly. Combined with `localStorage`, this gives the user a 1-slider theme picker.

### 7.2 Interactive states

```css
.vault-card {
  background: var(--accent-500);
}
.vault-card:hover {
  background: oklch(from var(--accent-500) calc(l + 0.06) c h);
}
.vault-card:active {
  background: oklch(from var(--accent-500) calc(l - 0.04) c h);
}
.vault-card.selected {
  background: oklch(from var(--accent-500) calc(l + 0.04) calc(c * 1.10) h);
  outline: 1px solid oklch(from var(--accent-500) 0.80 c h);
}
```

### 7.3 Triadic / complementary accents on demand

```css
:root {
  --accent: oklch(0.74 0.17 75);                        /* amber */
  --accent-complement: oklch(from var(--accent) l c calc(h + 180));    /* blue 255 */
  --accent-triadic-a:  oklch(from var(--accent) l c calc(h + 120));    /* green 195 */
  --accent-triadic-b:  oklch(from var(--accent) l c calc(h - 120));    /* magenta 315 */
  --accent-analog-a:   oklch(from var(--accent) l c calc(h + 25));     /* yellow 100 */
  --accent-analog-b:   oklch(from var(--accent) l c calc(h - 25));     /* orange 50 */
}
```

---

## 8. `color-mix()` patterns

`color-mix(in oklch, ...)` does perceptual interpolation. Use it for:

### 8.1 Translucency without `rgba`

```css
.vault {
  background: color-mix(in oklch, var(--bg-elevated) 80%, transparent);
}
```

### 8.2 Hover tint over surface

```css
.vault-card:hover {
  background: color-mix(in oklch, var(--bg-elevated), var(--accent) 12%);
}
```

This is the single best "premium feel" trick — a hover that gently breathes the accent through the surface instead of changing the whole fill.

### 8.3 Synthetic borders

```css
.vault-card {
  border: 1px solid color-mix(in oklch, var(--accent) 22%, var(--bg-elevated));
}
.vault-card.selected {
  border-color: color-mix(in oklch, var(--accent) 70%, var(--bg-elevated));
}
```

### 8.4 Smooth gradients

```css
.vault__brand-stripe {
  background: linear-gradient(
    in oklch 90deg,
    var(--accent) 0%,
    color-mix(in oklch, var(--accent), var(--accent-complement) 50%) 100%
  );
}
```

The `in oklch` color interpolation hint is what makes the gradient feel modern — sRGB-interpolated gradients muddy through gray in the middle.

---

## 9. Animation: `@property` + OKLCH

Color animations only smooth if the property is *registered* as a typed custom property. Without `@property`, browsers can't tween between two colors.

```css
@property --vault-glow-hue {
  syntax: '<number>';
  inherits: false;
  initial-value: 75;
}

.vault.is-active {
  --vault-glow-hue: 75;
  box-shadow:
    0 0 0 1px oklch(0.50 0.10 var(--vault-glow-hue)),
    0 0 24px -4px oklch(0.74 0.20 var(--vault-glow-hue) / 0.55);
  animation: hue-breathe 8s ease-in-out infinite alternate;
}

@keyframes hue-breathe {
  from { --vault-glow-hue: 75;  }   /* amber */
  to   { --vault-glow-hue: 105; }   /* shift toward chartreuse */
}
```

The vault's signature "this prompt panel is alive" effect can be exactly this: a subtle 8-second hue drift on the glow, locked to a constant L/C so it never feels frenetic.

---

## 10. Accessible contrast (APCA + WCAG)

### 10.1 The math

WCAG 2.x uses a luminance ratio (4.5:1 for body text). It works but is well known to be wrong at the dark end — it labels many readable dark UIs as failing.

**APCA (Advanced Perceptual Contrast Algorithm)** is the WCAG 3.0 candidate. It outputs a contrast value (Lc) in the −108 to +106 range, factoring in font size, weight, polarity (light-on-dark vs dark-on-light), and perceptual luminance.

Rule of thumb:
- `Lc 75+` for body text
- `Lc 60+` for large/bold text
- `Lc 45+` for non-text UI / icons

### 10.2 Lock the lightness curve, sleep at night

Because OKLCH lightness is perceptually linear, you can encode contrast as a target ΔL. The Canonical/Ubuntu design team published a heuristic: **maintain |ΔL| ≥ 0.40** between any text and its background for safe body-text contrast.

```
Background L = 0.18  →  Text L ≥ 0.58 (low-emphasis) or 0.85+ (body)
Background L = 0.13  →  Text L ≥ 0.53 (low-emphasis) or 0.80+ (body)
Background L = 0.985 →  Text L ≤ 0.55 (low-emphasis) or 0.20 (body)
```

The semantic tokens in §6.2 already satisfy this for the vault's dark theme.

### 10.3 Future-proof with `contrast-color()`

CSS Color Level 5 is shipping the `contrast-color()` function (Chrome 125+, behind a flag in others). It returns black or white based on background luminance:

```css
.vault-card {
  background: var(--accent);
  color: contrast-color(var(--accent));
}
```

Until it ships everywhere, fall back to a `--accent-text` token (which we already define).

---

## 11. Common pitfalls

| Pitfall | Fix |
|---|---|
| Pure black background | Use `oklch(0.13 0.012 250)`. Pure black + pure white creates retinal stress. |
| Same chroma across all hues | Greens look duller than reds at C=0.20. Use Tailwind v4 values or cap green chroma to ~0.18. |
| Lightness-only dark mode flip | Light mode `oklch(60% 0.15 240)` → dark mode wants `oklch(75% 0.15 240)`. Lightness bumps 15–20%. |
| Out-of-gamut chroma | Cap at C ≤ 0.32 for sRGB safety, ≤ 0.40 for P3. Run `oklch.com` gamut check. |
| Borders chromatic-matching the surface | Borders should carry **less chroma** than the surface, not more, or they "glow" weirdly. |
| Using opacity for text hierarchy | Prefer lightness deltas. Opacity stacks with background and looks washed in dark mode. |
| No fallback in old Electron | Electron 33 = Chromium 130. You are safe. Older versions need `@supports` blocks. |
| Forgetting `color-scheme` | Always declare `color-scheme: dark` (or `light dark`) so native form controls match. |

---

## 12. Complete vault stylesheet (drop-in starter)

```css
/*
 * vault.css — 2026-grade dark theme for the prompt vault
 * Place inside renderer/styles.css or import after it.
 */

:root {
  color-scheme: dark;

  /* ── Lightness curve ────────────────────────────────── */
  --L-canvas:   0.08;
  --L-base:     0.13;
  --L-elev:     0.18;
  --L-overlay:  0.24;
  --L-border:   0.28;
  --L-strong:   0.36;
  --L-divider:  0.50;
  --L-text-3:   0.48;
  --L-text-2:   0.62;
  --L-text-1:   0.78;
  --L-text-0:   0.96;

  /* ── Brand hues ────────────────────────────────────── */
  --hue-cool:   250;
  --hue-amber:  75;
  --hue-teal:   170;
  --hue-rose:   15;

  /* ── Surfaces ──────────────────────────────────────── */
  --vault-bg-canvas:   oklch(var(--L-canvas)  0.008 var(--hue-cool));
  --vault-bg-base:     oklch(var(--L-base)    0.012 var(--hue-cool));
  --vault-bg-elev:     oklch(var(--L-elev)    0.014 var(--hue-cool));
  --vault-bg-overlay:  oklch(var(--L-overlay) 0.016 var(--hue-cool));

  /* Translucent versions for layering over the live terminal */
  --vault-bg-elev-a:   oklch(var(--L-elev)    0.014 var(--hue-cool) / 0.84);
  --vault-bg-overlay-a:oklch(var(--L-overlay) 0.016 var(--hue-cool) / 0.92);

  /* ── Borders ───────────────────────────────────────── */
  --vault-border:        oklch(var(--L-border)  0.014 var(--hue-cool));
  --vault-border-strong: oklch(var(--L-strong)  0.020 var(--hue-cool));
  --vault-divider:       oklch(var(--L-divider) 0.030 var(--hue-cool));

  /* ── Text ──────────────────────────────────────────── */
  --vault-text-primary:   oklch(var(--L-text-0) 0.005 var(--hue-cool));
  --vault-text-secondary: oklch(var(--L-text-1) 0.012 var(--hue-cool));
  --vault-text-muted:     oklch(var(--L-text-2) 0.018 var(--hue-cool));
  --vault-text-faint:     oklch(var(--L-text-3) 0.020 var(--hue-cool));
  --vault-text-on-accent: oklch(0.12            0.008 var(--hue-cool));

  /* ── Accent (amber, EZvibes signature) ──────────────────── */
  --vault-accent:         oklch(0.74 0.17 var(--hue-amber));
  --vault-accent-hover:   oklch(0.80 0.18 var(--hue-amber));
  --vault-accent-active:  oklch(0.66 0.16 var(--hue-amber));
  --vault-accent-subtle:  oklch(0.28 0.05 var(--hue-amber));
  --vault-accent-text:    oklch(0.86 0.18 var(--hue-amber));

  /* ── Info (teal, codex parity) ─────────────────────── */
  --vault-info:           oklch(0.70 0.14 var(--hue-teal));
  --vault-info-hover:     oklch(0.76 0.15 var(--hue-teal));
  --vault-info-subtle:    oklch(0.26 0.05 var(--hue-teal));

  /* ── Status ────────────────────────────────────────── */
  --vault-success: oklch(0.72 0.18 145);
  --vault-warning: oklch(0.78 0.19  85);
  --vault-danger:  oklch(0.65 0.24  25);

  /* ── Focus ─────────────────────────────────────────── */
  --vault-focus-ring: oklch(0.74 0.18 var(--hue-amber));

  /* ── Radius / shadow tokens ────────────────────────── */
  --vault-radius-sm: 6px;
  --vault-radius:    10px;
  --vault-radius-lg: 14px;

  --vault-shadow-1: 0 1px 2px oklch(0 0 0 / 0.4),
                    0 0 0 1px var(--vault-border) inset;
  --vault-shadow-2: 0 8px 24px -8px oklch(0 0 0 / 0.6),
                    0 0 0 1px var(--vault-border) inset;
  --vault-shadow-glow:
                    0 0 0 1px oklch(0.50 0.12 var(--hue-amber) / 0.5),
                    0 0 28px -4px oklch(0.74 0.22 var(--hue-amber) / 0.55);
}

/* P3 wide-gamut overrides (auto-applied where supported) */
@media (color-gamut: p3) {
  :root {
    --vault-accent:        oklch(0.74 0.21 var(--hue-amber));
    --vault-accent-hover:  oklch(0.80 0.23 var(--hue-amber));
    --vault-accent-active: oklch(0.66 0.20 var(--hue-amber));
    --vault-accent-text:   oklch(0.86 0.22 var(--hue-amber));
    --vault-info:          oklch(0.70 0.18 var(--hue-teal));
    --vault-info-hover:    oklch(0.76 0.20 var(--hue-teal));
    --vault-success:       oklch(0.72 0.23 145);
    --vault-warning:       oklch(0.78 0.23  85);
    --vault-danger:        oklch(0.65 0.29  25);
    --vault-focus-ring:    oklch(0.74 0.22 var(--hue-amber));
    --vault-shadow-glow:
                           0 0 0 1px oklch(0.50 0.16 var(--hue-amber) / 0.55),
                           0 0 32px -4px oklch(0.74 0.27 var(--hue-amber) / 0.6);
  }
}

/* User-toggleable hue (one slider for the whole theme) */
.vault[data-theme="teal"]   { --vault-accent: oklch(0.74 0.17 170); --hue-amber: 170; }
.vault[data-theme="violet"] { --vault-accent: oklch(0.74 0.18 290); --hue-amber: 290; }
.vault[data-theme="rose"]   { --vault-accent: oklch(0.74 0.20  15); --hue-amber:  15; }
.vault[data-theme="lime"]   { --vault-accent: oklch(0.78 0.20 125); --hue-amber: 125; }

/* ── Vault component ─────────────────────────────────── */
.vault {
  background: var(--vault-bg-elev-a);
  color: var(--vault-text-primary);
  backdrop-filter: blur(10px) saturate(1.2);
  border: 1px solid var(--vault-border);
  border-radius: var(--vault-radius-lg);
  box-shadow: var(--vault-shadow-2);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif;
}

.vault__header {
  background: linear-gradient(
    in oklch 180deg,
    color-mix(in oklch, var(--vault-bg-overlay) 70%, var(--vault-accent) 4%),
    var(--vault-bg-elev)
  );
  border-bottom: 1px solid var(--vault-divider);
  padding: 12px 16px;
}

.vault__title {
  color: var(--vault-text-primary);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.vault__count {
  color: var(--vault-text-muted);
  font-variant-numeric: tabular-nums;
}

/* A clickable prompt card */
.vault-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--vault-radius);
  background: transparent;
  color: var(--vault-text-secondary);
  border: 1px solid transparent;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.vault-card:hover {
  background: color-mix(in oklch, var(--vault-bg-overlay), var(--vault-accent) 8%);
  color: var(--vault-text-primary);
  border-color: color-mix(in oklch, var(--vault-accent) 32%, transparent);
}

.vault-card.is-selected {
  background: color-mix(in oklch, var(--vault-bg-overlay), var(--vault-accent) 18%);
  color: var(--vault-text-primary);
  border-color: color-mix(in oklch, var(--vault-accent) 70%, transparent);
}

.vault-card__title { font-weight: 500; }
.vault-card__meta  { color: var(--vault-text-faint); font-size: 0.78em; }

/* Paste button — the hero CTA */
.vault-card__paste {
  background: var(--vault-accent);
  color: var(--vault-text-on-accent);
  padding: 4px 10px;
  border-radius: var(--vault-radius-sm);
  font-weight: 600;
  font-size: 0.78em;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  transition: background 100ms ease, transform 80ms ease;
}
.vault-card__paste:hover  { background: var(--vault-accent-hover); }
.vault-card__paste:active { background: var(--vault-accent-active); transform: scale(0.98); }

/* Focus ring */
.vault-card:focus-visible {
  outline: 2px solid var(--vault-focus-ring);
  outline-offset: 2px;
}

/* Status badges */
.vault-badge--new       { color: var(--vault-success); }
.vault-badge--hand-off  { color: var(--vault-warning); }
.vault-badge--archived  { color: var(--vault-text-faint); }

/* Hue breathe — the pioneer flourish */
@property --vault-glow-hue {
  syntax: '<number>';
  inherits: true;
  initial-value: 75;
}

.vault.is-fresh-arrival {
  animation: vault-fresh 2200ms ease-out;
}
@keyframes vault-fresh {
  0%   { --vault-glow-hue: 75;  box-shadow: var(--vault-shadow-glow); }
  60%  { --vault-glow-hue: 115; box-shadow: var(--vault-shadow-glow); }
  100% { --vault-glow-hue: 75;  box-shadow: var(--vault-shadow-2);    }
}
```

---

## 13. JSON token export (for tooling parity)

If we ever generate Figma styles or pipe tokens through Style Dictionary, the JSON form is:

```json
{
  "vault": {
    "bg": {
      "canvas":  { "$value": "oklch(0.08 0.008 250)", "$type": "color" },
      "base":    { "$value": "oklch(0.13 0.012 250)", "$type": "color" },
      "elev":    { "$value": "oklch(0.18 0.014 250)", "$type": "color" },
      "overlay": { "$value": "oklch(0.24 0.016 250)", "$type": "color" }
    },
    "border": {
      "subtle":  { "$value": "oklch(0.28 0.014 250)", "$type": "color" },
      "default": { "$value": "oklch(0.36 0.020 250)", "$type": "color" },
      "strong":  { "$value": "oklch(0.50 0.030 250)", "$type": "color" }
    },
    "text": {
      "primary":   { "$value": "oklch(0.96 0.005 250)", "$type": "color" },
      "secondary": { "$value": "oklch(0.78 0.012 250)", "$type": "color" },
      "muted":     { "$value": "oklch(0.62 0.018 250)", "$type": "color" },
      "faint":     { "$value": "oklch(0.48 0.020 250)", "$type": "color" },
      "inverse":   { "$value": "oklch(0.12 0.008 250)", "$type": "color" }
    },
    "accent": {
      "default": { "$value": "oklch(0.74 0.17 75)",  "$type": "color" },
      "hover":   { "$value": "oklch(0.80 0.18 75)",  "$type": "color" },
      "active":  { "$value": "oklch(0.66 0.16 75)",  "$type": "color" },
      "subtle":  { "$value": "oklch(0.28 0.05 75)",  "$type": "color" }
    },
    "info": {
      "default": { "$value": "oklch(0.70 0.14 170)", "$type": "color" },
      "hover":   { "$value": "oklch(0.76 0.15 170)", "$type": "color" }
    },
    "status": {
      "success": { "$value": "oklch(0.72 0.18 145)", "$type": "color" },
      "warning": { "$value": "oklch(0.78 0.19  85)", "$type": "color" },
      "danger":  { "$value": "oklch(0.65 0.24  25)", "$type": "color" }
    }
  }
}
```

This conforms to the Design Tokens Format Module 2025.10 spec released by the W3C Design Tokens Community Group in October 2025.

---

## 14. Pioneer-level moves (rank-ordered)

1. **One-slider theme picker.** A single `--accent: oklch(L C H)` token + relative color syntax means the user can drag a hue slider in settings and recolor the whole vault in 0ms. Persist `H` to localStorage. No build step, no library.
2. **P3-aware accent.** Bake a `@media (color-gamut: p3)` block that pushes chroma 20–30% higher. Mac users will think it's a totally different (better) app.
3. **`@property` hue-breathing glow.** When a new prompt arrives via file watcher, the vault's outer glow performs a 2.2-second hue drift from amber → chartreuse → amber. Subtle but distinctly 2026.
4. **`color-mix(in oklch, surface, accent X%)` hovers.** Most apps still ship hover with a flat opacity tint. OKLCH-mixed hovers look perceptually correct and feel premium.
5. **APCA-validated, but locked through ΔL.** Don't run JS contrast checks; just lock text lightness to ≥0.78 against any surface ≤0.30 L. Free APCA pass.
6. **Translucent surfaces over xterm.** `oklch(L C H / 0.85)` + `backdrop-filter: blur(10px) saturate(1.2)` lets the live terminal bleed through faintly. Saturate(1.2) makes the OKLCH chroma feel even richer.
7. **OKLCH gradient interpolation hint (`in oklch`).** Every gradient in 2026-tier apps uses `linear-gradient(in oklch 90deg, ...)` instead of default sRGB. The midpoints stay vivid instead of muddying through gray.
8. **`light-dark()` instead of `@media (prefers-color-scheme)`.** One line per token, both modes in one place. Cleaner stylesheet, fewer bugs.
9. **Semantic 12-step scale (Radix model).** Don't ship `--bg-1`, `--bg-2`, `--bg-3`; ship `--surface-canvas`, `--surface-elevated`, `--surface-overlay`. Intent travels with the token.
10. **Tier-1 / Tier-2 token split.** Primitives (`oklch(...)` values) live in a `:root` block; semantic tokens (component-facing) live in `:root` and `.dark`. Components only consume semantic. Refactoring brand color is a one-line change.

---

## 15. References

### Core articles
- [OKLCH in CSS: why we moved from RGB and HSL — Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- [Better dynamic themes in Tailwind with OKLCH color magic — Evil Martians](https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic)
- [OKLCH and the Modern CSS Color Stack — Carmen Ansio](https://www.carmenansio.com/articles/oklch-and-the-modern-color-stack)
- [The Ultimate OKLCH Guide: Modern CSS Color Redefined](https://oklch.org/posts/ultimate-oklch-guide)
- [OKLCH in CSS: Real-World Lessons from the Trenches](https://oklch.click/blog/oklch-css-real-world)
- [OKLCH in CSS: Consistent, accessible color palettes — LogRocket](https://blog.logrocket.com/oklch-css-consistent-accessible-color-palettes)
- [Easy Theming with OKLCH colors — Manuel Strehl](https://manuel-strehl.de/easy_theming_with_oklch)
- [Color themes with Baseline CSS features — web.dev](https://web.dev/articles/baseline-in-action-color-theme)
- [Designing Luminance-First Color Systems with OKLCH — BoldVanta](https://www.boldvanta.com/design/designing-luminance-cefirst-color-systems-with-oklch-tokens-ramps-and-real-ceworld-pitfalls.html)
- [Generating colors with the CSS oklch() function — Chris Ferdinandi](https://gomakethings.com/generating-colors-with-the-css-oklch-function/)
- [CSS Grid, OKLCH & Dark Mode: What Shipped and How it Works — Builderius](https://builderius.io/css-grid-oklch-dark-mode-what-shipped-and-how-it-works/)

### Wide-gamut / P3
- [Wide Gamut Color in CSS with Display-P3 — WebKit](https://webkit.org/blog/10042/wide-gamut-color-in-css-with-display-p3/)
- [How to use P3 colors with SVGs — Evil Martians](https://evilmartians.com/chronicles/how-to-use-p3-colors-in-svg)
- [Applying P3 colours on an existing project — Piccalilli](https://piccalil.li/blog/applying-p3-colours-on-an-existing-project/)
- [color-gamut CSS media feature — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/color-gamut)

### Design systems
- [Radix Colors — scales documentation](https://www.radix-ui.com/colors/docs/palette-composition/scales)
- [Radix Themes — color tokens](https://www.radix-ui.com/themes/docs/theme/color)
- [Vercel Geist — Colors](https://vercel.com/geist/colors)
- [shadcn/ui — Theming](https://ui.shadcn.com/docs/theming)
- [Tailwind CSS v4 — Colors](https://tailwindcss.com/docs/colors)
- [Tailwind v4 OKLCH variables — Kyrylo Silin](https://kyrylo.org/css/2025/02/09/oklch-css-variables-for-tailwind-v4-colors.html)
- [GitHub Primer Prism](https://github.com/primer/prism)
- [Adobe Leonardo Color](https://leonardocolor.io/)
- [Tinte — agent-native design system infrastructure](https://www.tinte.dev/)

### Accessibility & contrast
- [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)
- [Generating accessible color palettes inspired by APCA — Canonical](https://canonical.design/blog/generating-color-palettes-for-design-systems-inspired-by-apca)
- [The Practical Guide to WCAG Contrast — Design Systems Collective](https://www.designsystemscollective.com/the-practical-guide-to-wcag-contrast-updated-for-wcag-2-2-apca-preview-19f1a4ca6be4)

### Tools
- [OKLCH Color Picker & Converter — Evil Martians](https://oklch.com/)
- [oklch.fyi — OKLCH Color Picker, Generator and Converter](https://oklch.fyi/)
- [Oklchroma — OKLCH CSS variable pattern generator](https://utilitybend.com/blog/oklchroma-an-oklch-color-pattern-generator-that-generates-css-variables)
- [OKLCH Terminal Themes Picker](https://williamzujkowski.github.io/oklch-terminal-themes/)
- [shadcn Theme Generator with OKLCH](https://shadcn.rlabs.art/)
- [ColorTokensKit-Swift (Linear-style ramps)](https://github.com/metasidd/ColorTokensKit-Swift)

### Specs
- [Design Tokens Format Module 2025.10 — W3C](https://www.designtokens.org/tr/drafts/format/)
- [Design Tokens Color Module 2025.10 — W3C](https://www.designtokens.org/tr/drafts/color/)
- [CSS Color Module Level 4 — W3C](https://www.w3.org/TR/css-color-4/)
- [CSS Color Module Level 5 (relative color, color-mix, contrast-color) — W3C](https://www.w3.org/TR/css-color-5/)

### MDN
- [oklch() — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch)
- [Using relative colors — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors)
- [light-dark() — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)
- [@property — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@property)

---

## TL;DR for the vault

Build the vault on a two-tier OKLCH token system with a Radix-style 12-role semantic layer, anchored to a single `--vault-accent` hue (default amber 75°) and a fixed lightness curve. Layer Display-P3 chroma boosts via `@media (color-gamut: p3)`. Use `color-mix(in oklch, surface, accent X%)` for every hover, `linear-gradient(in oklch ...)` for every gradient, `@property` + keyframes for any color animation, and `light-dark()` so the same stylesheet handles both modes. Expose one hue slider to the user and persist it — that single control retones the entire vault in real time. This matches how Linear, Vercel, Raycast, Tailwind v4, shadcn/ui, and Radix Themes 3 are built in 2026.
