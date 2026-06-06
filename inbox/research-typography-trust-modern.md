# Typography for Trust — Modern Trust-Forward Sites

Research slice 5 of 10. Aesthetic target: dark blue, modern, liquid-glass, slim and feature-rich, smart and trustworthy.

---

## 1. Why type signals trust

Trust-forward type is **neutral, neo-grotesque, and engineered for screens**. It avoids three failure modes:

- **Playful** (rounded geometrics like Circular, Poppins, Nunito): friendly but reads as consumer-y, not infrastructural.
- **Corporate-stiff** (Helvetica, Arial, generic system stacks): reads as default, lazy, untrusted — "we did not choose this."
- **Decorative / brand-y display fonts**: signal marketing, not engineering.

A trustworthy site instead reads as **calm, exact, lightly cold**. The letterforms are tight but not condensed, with even rhythm, low contrast strokes, and clean apertures. MIT-cited research shows users form credibility judgments in <100 ms, before they read a single word — type is doing that work. The pattern that wins in 2026 is a **single neo-grotesque family** (display + body unified), occasionally augmented by a **monospace** for code, numerics, or technical labels, and rarely by a **serif** when the brand wants intellectual / editorial gravitas (Anthropic, Stripe Press, OpenAI long-form).

The "smart and trustworthy" feeling comes from **systemic restraint**: one family, a strict 6-step weight ramp, and disciplined micro-typography (negative tracking on display, tabular numerics, ss/cv stylistic alternates that swap out the weakest glyphs).

---

## 2. The 6–8 typefaces dominating trust-forward sites (2026)

| Typeface | Foundry / Status | 1-line characterization |
|---|---|---|
| **Inter** | Rasmus Andersson — OFL (free, commercial OK) | The default UI workhorse — variable, screen-optimized, ss01/cv11 fix the curly `a` and tail-less `l` for that "Inter-but-better" look. Used by Linear, Figma, GitHub. |
| **Geist** (Sans + Mono) | Vercel / Basement — OFL (free) | Inter's friendlier cousin — slightly rounder apertures, more breathing room, paired with Geist Mono. Default Next.js stack. |
| **Söhne** (Sans + Mono + Breit) | Klim Type Foundry — **commercial license** (~$300+ for web) | The premium standard for serious infrastructure brands. Akzidenz-Grotesk reinterpretation. Used by Stripe, OpenAI, Mercury. |
| **SF Pro** | Apple — license restricted to Apple-platform UIs | The macOS/iOS native. Beautiful on retina, but legally only for Apple ecosystem apps; web sites often substitute Inter. |
| **IBM Plex** (Sans + Mono + Serif) | IBM — OFL (free) | Slightly engineered/technical character. Free, comprehensive family, strong mono. Used in enterprise / dev-tools / docs. |
| **GT America** | Grilli Type — **commercial license** | Hybrid American gothic + European grotesque. Six widths × six weights = systematic flexibility. Used by Notion, Figma marketing. |
| **JetBrains Mono** | JetBrains — OFL (free) | The premier free monospace for code blocks and technical labels. Ligature support, generous x-height. |
| **Styrene A/B** | Commercial Type — **commercial license** | Narrow, squared, slightly weird letterforms — Anthropic's display face. Distinctive without being decorative. |
| **Tiempos Text** | Klim Type Foundry — **commercial license** | The serif pair to Söhne. Editorial, calm, used by Anthropic body text and Stripe Press. |

Licensing flag: **Söhne, GT America, Styrene, Tiempos** are paid commercial licenses (web font fees scale with pageviews). If budget-constrained, **Inter + Geist Mono** or **IBM Plex Sans + Mono** are free near-equivalents.

---

## 3. Reference type stacks from real sites

| Brand | Display | Body | Mono | Notes |
|---|---|---|---|---|
| **Stripe** | Söhne Breit / Söhne | Söhne | Söhne Mono | Single family, full system. Cold, exact. |
| **Linear** | Inter (heavy weights) | Inter | Berkeley Mono / system mono | Inter with ss01 + cv11 enabled, -0.022em display tracking. |
| **Vercel** | Geist Sans | Geist Sans | Geist Mono | Bundled via `next/font/google`. |
| **Anthropic** | Styrene B | Tiempos Text (serif body for long-form) + Styrene A (UI) | — | Sans/serif pair signals "intellectual, calm, not aggressive AI." |
| **OpenAI** | Söhne | Söhne | Söhne Mono | Same family as Stripe, different weight rhythm. |
| **Mercury** | Söhne Breit | Söhne | Söhne Mono | Premium fintech standard. |
| **Apple** | SF Pro Display | SF Pro Text | SF Mono | Optical sizes — `Display` for ≥20px, `Text` for <20px. |

**Recommended pattern** for the user's brief (dark blue, liquid-glass, slim, trustworthy): **Geist Sans (display + body) + Geist Mono (numerics, labels, code)** — free, OFL, ships with Next.js, hits the exact "engineer-grade calm" register without licensing overhead. Upgrade path to Söhne if budget allows.

---

## 4. Weight contrast strategies

The modern trust pattern uses a **compressed weight palette**, not the full 100–900 range:

- **Conservative / institutional** (Stripe, OpenAI, Linear): `400 / 500 / 600` only. Display goes to 600 max — never 700+. Hierarchy comes from **size** and **color**, not weight.
- **Slightly more expressive** (Vercel, Mercury): `400 / 500 / 600 / 700`. The 700 is reserved for hero headlines.
- **Editorial / AI-lab** (Anthropic): `400 (Tiempos) body + 500/600 (Styrene) UI`. Mixes weights across families.
- **Avoid**: Light weights (300 or lower) on dark backgrounds at small sizes — they fail accessibility and break the trust register by feeling "fashion-y." Reserve 300 only for very large display (96px+).

A clean 6-step ramp that works in 95% of trust-forward sites:

```
font-weight: 400  body, captions
font-weight: 450  emphasized body, button labels  (variable fonts only)
font-weight: 500  subtle UI emphasis, small headings
font-weight: 600  H3 / H2
font-weight: 700  H1 / hero display
font-weight: 500  for monospace (mono looks bolder optically)
```

---

## 5. Micro-typography — tracking, leading, font-features

**Letter-spacing (tracking)**
- Display 48–96px: `-0.025em` to `-0.04em` (tighter = more authoritative)
- H2 32–40px: `-0.015em` to `-0.02em`
- H3 24px: `-0.01em`
- Body 16px: `0` (let the typeface designer's defaults stand)
- Small caps / uppercase labels 11–13px: `+0.04em` to `+0.08em` (open up to compensate for cap density)

**Line-height (leading)**
- Display: `1.05` to `1.1` (tight, monumental)
- H2/H3: `1.15` to `1.25`
- Body 16px: `1.5` to `1.65` (1.5 is the WCAG minimum for AAA; 1.6 is the sweet spot)
- Code / mono: `1.5` to `1.7`
- Line length: 50–75 characters, 66 ideal.

**font-feature-settings — the trust-sharpening features**
- `"tnum"` — tabular numerals: **mandatory** for any column of numbers, prices, dates, tables. Stops them from "dancing."
- `"ss01"` (Inter) — replaces single-storey `a` with double-storey, removes the `f`-`t` ligature curl. Makes Inter look more like Söhne.
- `"cv11"` (Inter) — flat-tail `l`, prevents `I`/`l`/`1` confusion in code-heavy UIs.
- `"calt"` on, `"liga"` on — contextual + standard ligatures, default-on for most cases.
- `"ss03"` (Geist) — open `4`, removes the slashed zero ambiguity.
- `"zero"` — slashed zero in monospace contexts (mandatory for technical numerics).
- `"case"` — case-sensitive forms — adjusts punctuation height when using all-caps labels.

CSS pattern (cascade-safe via `font-variant-*` where possible):

```css
body {
  font-family: "Geist", "Inter", system-ui, sans-serif;
  font-feature-settings: "ss01", "cv11", "calt";
  font-variant-numeric: tabular-nums;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Optical sizing**: variable fonts with `opsz` axis (e.g. Inter v4, SF Pro) should expose `font-optical-sizing: auto` so display sizes get tighter spacing and body sizes get more open counters automatically.

---

## 6. Sources

- [Four design principles behind Stripe, Linear, and Vercel — Pixel Darts](https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel)
- [How Stripe, Linear, and Vercel Ship Premium UI — Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)
- [SaaS Typography Playbook: What 50 Companies Actually Use — FullStop Insights](https://fullstop360.com/blog/insights/branding/saas-typography-playbook-what-leading-companies-use)
- [Your SaaS Has a Trust Problem And Typography Might Be the Reason — Fontly](https://fontly.io/your-saas-has-a-trust-problem-and-typography-might-be-the-reason/)
- [Inter Font: License, Pairings & Why It's the #1 UI Typeface of 2026 — Made Good Designs](https://madegooddesigns.com/inter-font/)
- [Geist Sans + Inter pairing — MaxiBestOf](https://maxibestof.one/typefaces/geist/pairing/inter)
- [Styrene in use: Anthropic — Type.Today](https://type.today/en/journal/anthropic)
- [How to use Inter stylistic sets and OpenType features — Lexington Themes](https://lexingtonthemes.com/blog/inter-stylistic-sets-css-tailwind)
- [OpenType features in CSS — Typotheque](https://www.typotheque.com/articles/opentype-features-in-css)
- [font-feature-settings — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-feature-settings)
- [Letter Spacing Guide 2026 — Inkbot Design](https://inkbotdesign.com/letter-spacing-guide/)
- [Typography Best Practices: The Ultimate 2026 Guide — Adoc Studio](https://www.adoc-studio.app/blog/typography-guide)
- [IBM Plex LICENSE — GitHub](https://github.com/IBM/plex/blob/master/LICENSE.txt)
- [JetBrains Mono OpenType features — GitHub Wiki](https://github.com/JetBrains/JetBrainsMono/wiki/OpenType-features)
