# Variable Fonts & Typographic Hierarchy in Modern UI (2025–2026)

Research dossier for the **EZvibes** prompt-vault feature. This document is a deep-dive into the typography stack that defines pioneer-grade desktop/Electron UI in 2026 — the fonts, the CSS axes, the OpenType tricks, the loading strategies, and the actual stacks shipped by Linear, Raycast, Vercel, GitHub, Stripe, Notion, Apple, and Arc. It is written for the EZvibes vault: the visual hierarchy of a file-list of `.md` prompts that need to feel hand-crafted, fast, and intentional.

---

## 0. Executive summary — why type matters for the vault

A prompt vault is mostly text. There is no chrome, no decorative imagery, no animation hook. The user clicks `intro.md` and a few-hundred-byte string is shoved into a PTY. Everything between *folder* and *terminal paste* has to be carried by **type, color, and spacing alone.** That makes the vault one of the most font-sensitive surfaces in the entire app:

- File names sit in a dense vertical list — every micro-decision about x-height, weight, tracking, and tabular figures compounds.
- A live filename like `2026-05-25-handoff.md` mixes numerals, hyphens, periods, lowercase letters, and an extension. Get the figure style wrong and the column wobbles.
- Inline code previews (the markdown snippet under the title) demand a mono pair that doesn't fight the sans label.
- Status badges ("new", "modified", "✓ pasted") want a small-caps or tabular variant from the *same* variable font, not a second download.

The right answer in 2026 is rarely "Use Helvetica." It's "Pick **one variable sans** for UI + **one variable mono** for code, both with optical-size axes, both subsetted to Latin + symbols, both preloaded as woff2, both wired through `font-feature-settings` for the OpenType moves that productivity tools rely on (tabular nums, slashed zero, contextual alternates)." This document is the catalogue of which fonts to actually choose, with full CSS.

---

## 1. Inter Variable — the de-facto sans (and what the vault should default to)

### 1.1 What it is

Inter is a neo-grotesque sans-serif designed by **Rasmus Andersson** (ex-Spotify, ex-Figma), open-source under the **SIL Open Font License 1.1**. It became *the* UI default of the post-2018 product-design era and is used by Figma, GitHub (alongside Mona Sans), GitLab, Mozilla, NASA, Linear, Notion, Raycast, and a wide swath of the Vercel / Next.js ecosystem (Next ships Inter as a default `next/font` option).

### 1.2 Inter v4 (2023) and v4.1 (Nov 2024) — the version that matters

Inter became variable in v3.19 (2020), but **v4** is the inflection point. Andersson rebuilt curves, regularized construction, and crucially **folded the old separate "Inter Display" family into the same variable file as an optical-size (`opsz`) axis spanning 14 → 32.** This means one file, one `@font-face` rule, and the font auto-adjusts cap height, contrast, tracking, and ink-trap geometry for body vs. display. v4.1 (Nov 2024) is the current pin.

### 1.3 Axes

| Axis | Tag  | Range     | Purpose |
|------|------|-----------|---------|
| Weight | `wght` | 100 – 900 | Thin → Black, continuous |
| Slant  | `slnt` | -10 – 0   | Upright → oblique (separate from true italic) |
| Optical Size | `opsz` | 14 – 32 | Tighter spacing + smaller x-height as size grows |

Each weight has a true italic. Glyph coverage is 2000+ glyphs across 147 languages.

### 1.4 The CDN and the no-bullshit install

```html
<link rel="preconnect" href="https://rsms.me/">
<link rel="stylesheet" href="https://rsms.me/inter/inter.css">
```

```css
:root {
  font-family: Inter, sans-serif;
  font-feature-settings: 'liga' 1, 'calt' 1;
}
@supports (font-variation-settings: normal) {
  :root { font-family: InterVariable, sans-serif; }
}
```

The CDN is sponsored by Cloudflare. For Electron, you should not depend on it — package the file locally. The latest variable file is **`InterVariable.woff2`** (≈ 320 KB, all weights + slant axis).

### 1.5 Inter stylistic sets (the table you actually need)

| Set | Effect |
|-----|--------|
| `ss01` | Open digits (`1`, `4`, `6`, `9`) — more friendly, slightly less "techy" |
| `ss02` | Disambiguation — `I` vs `l` vs `1` distinguished via spurs/tails |
| `ss03` | Curved quotes |
| `ss04` | Square punctuation |
| `ss05` | Single-story `a` (the Raycast move) |
| `ss06` | Compact figures |
| `ss07` | Alternate `&` |
| `ss08` | Alternate `@` |
| `zero` | Slashed zero (vault should turn this on for file dates) |
| `tnum` | Tabular figures (mandatory for file-list columns) |
| `cv11` | Single-story `g` (the *signature* Raycast/Linear look) |

### 1.6 The Raycast signature setting

Raycast ships Inter site-wide with **`font-feature-settings: "calt", "kern", "liga", "ss03"`**. Their `ss03` swaps Inter's `g` to its open single-story alternate, which is the visual signature of "modern, slightly-too-cool launcher." For the EZvibes vault that wants to feel adjacent to Raycast, this is the one-line move:

```css
.vault {
  font-family: InterVariable, system-ui, sans-serif;
  font-feature-settings: 'calt', 'kern', 'liga', 'ss03', 'cv11', 'tnum', 'zero';
  font-variation-settings: 'opsz' 14;
}
.vault__heading {
  font-variation-settings: 'opsz' 28, 'wght' 600;
  letter-spacing: -0.022em;   /* Raycast-grade negative tracking on display */
}
.vault__filename {
  font-variation-settings: 'opsz' 14, 'wght' 500;
  font-variant-numeric: tabular-nums slashed-zero;
}
.vault__meta {
  font-variation-settings: 'opsz' 14, 'wght' 400;
  letter-spacing: 0.04em;  /* positive tracking at small sizes for scannability */
  text-transform: uppercase;
  font-size: 11px;
}
```

### 1.7 Why Inter is the right default for EZvibes

- One file covers thin → black + slant + optical size: a single ~320 KB download.
- It is the **most-shipped UI typeface on the web** in 2026, so users have unconscious familiarity. No "what font is this?" friction.
- Tabular figures and slashed zero are first-class — file dates like `2026-05-25` and times like `13:42:08` will column-align without monospace.
- It pairs naturally with **Geist Mono**, **JetBrains Mono**, or **Monaspace Argon** for inline code in markdown previews.

---

## 2. Geist — Vercel's house font, 2024-built, optimized for code-heavy UI

### 2.1 What it is

**Geist** is the Vercel typeface, designed in 2024 in collaboration with **Basement Studio** and **Andrés Briganti**. It ships as three siblings:

- **Geist Sans** — geometric neo-grotesque, Swiss-inspired, geometric
- **Geist Mono** — the perfect monospace partner for terminals, code editors, diagrams
- **Geist Pixel** — a recently-released bitmap/pixel companion for nostalgic moments (banners, experimental layouts)

All three are open-source under **OFL**.

### 2.2 Weights & axes

Weights: Thin (100), Ultra Light (200), Light (300), Regular (400), Medium (500), Semi Bold (600), Bold (700), Black (800), Ultra Black (900). It ships as a **variable font** alongside static OTFs.

### 2.3 Geist Mono OpenType moves

```css
/* The "vault code preview" recipe */
.vault__snippet {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-feature-settings:
    'ss01' 1,   /* alternate a, g — friendlier */
    'ss02' 1,   /* stricter Swiss/neo-grotesque geometry */
    'ss03' 1,   /* rounded punctuation */
    'ss08' 1,   /* rounded dots */
    'ss11' 1,   /* coding ligatures (moved here in v1.6) */
    'zero' 1,   /* slashed zero */
    'calt' 1;
}
```

> Note: in Geist Mono 1.6 **coding ligatures are no longer enabled by default**. They were moved to `ss11`. The official Google Fonts version strips most OpenType features — **always self-host via `@fontsource-variable/geist-mono` or the npm `geist` package, not Google Fonts**, if you want the full feature set.

### 2.4 Installation

```bash
npm install @fontsource-variable/geist
npm install @fontsource-variable/geist-mono
```

```js
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
```

For Electron with no bundler (our case), drop the `.woff2` files in `renderer/fonts/` and write the `@font-face` rule manually:

```css
@font-face {
  font-family: 'GeistVariable';
  src: url('./fonts/Geist[wght].woff2') format('woff2-variations'),
       url('./fonts/Geist[wght].woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'GeistMonoVariable';
  src: url('./fonts/GeistMono[wght].woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}
```

### 2.5 The Geist type-scale (extracted from Vercel's `vercel.com/geist/typography`)

Vercel exposes their type scale as Tailwind utility classes. The full list:

- **Headings**: `text-heading-72`, `text-heading-64`, `text-heading-56`, `text-heading-48`, `text-heading-40`, `text-heading-32`, `text-heading-24`, `text-heading-20`, `text-heading-16`, `text-heading-14`
- **Buttons**: `text-button-16`, `text-button-14`, `text-button-12`
- **Labels**: `text-label-20` down to `text-label-12`, with `mono` and `Strong/Tabular` modifier variants
- **Copy**: `text-copy-24`, `text-copy-20`, `text-copy-18`, `text-copy-16`, `text-copy-14`, `text-copy-13`, with `text-copy-13-mono`

The scale is curated: **not all sizes exist** (no 18, 14, 22 between headings) — Vercel's system **forces visual rhythm** by limiting choices. That is the lesson worth stealing for EZvibes: don't expose every pixel size; pick 6-8 steps with explicit semantic names (`title`, `label`, `body`, `meta`).

---

## 3. Monaspace — GitHub's "superfamily for code"

### 3.1 The pitch (and why it's pioneer-grade)

**Monaspace** is GitHub Next's open-source experimental monospace **superfamily** released in late 2023, with five visually distinct families that share metrics and can be **mixed-and-matched within a single code block**:

| Family | Genre |
|--------|-------|
| **Neon** | Neo-grotesque sans (the safe default) |
| **Argon** | Humanist sans (warmer, more handwritten feel) |
| **Xenon** | Slab serif (gives code editorial heft) |
| **Radon** | Handwriting style (informal, sketch-feel) |
| **Krypton** | Mechanical sans (technical, industrial) |

Each font is a true variable with three axes: **wght 200–800**, **slnt 0 to -11°**, **wdth 100–125**.

### 3.2 Texture Healing — the killer feature

Monospace fonts have always had a visual-density problem: the `i` next to a `w` looks too sparse, then too cramped. Monaspace's **Texture Healing** uses the OpenType `calt` (contextual alternates) feature to **swap in slight glyph variants** that shift left or right within the cell *without changing the cell width*. The grid stays intact, but the eye reads it as proportional. It works in any editor that respects `calt`. The technical writeup at `https://github.com/githubnext/monaspace/blob/main/docs/Texture%20Healing.md` is worth reading.

### 3.3 Stylistic sets (one per programming-language flavor)

| Set | Ligature group |
|-----|----------------|
| `ss01` | JavaScript equality (`===`, `!==`, `=!=`) |
| `ss02` | Comparison operators (`>=`, `<=`) |
| `ss03` | Arrows (`<-->`, `<->`, `-->`) |
| `ss04` | JSX (`</>`, `<>`) |
| `ss05` | F# operators (`[|`, `|]`, `/\`) |
| `ss06` | Char repetition (`###`, `+++`, `&&&`) |
| `ss07` | Haskell (`-:-`, `=:=`, `::`) |
| `ss08` | Dot operators (`..=`, `..<`) |
| `ss09` | Bit shift (`<<=`, `=>>`) |
| `ss10` | Scheme/Clojure (`#[`, `#()`) |
| `liga` | Repeating separators (`///`, `||`) |

### 3.4 The vault use-case for Monaspace

For inline code-preview chips inside the file-list, **mix Monaspace Argon (the humanist) with Monaspace Neon (the grotesque)**. Body code is Neon. Comments / quoted strings are Argon italic. Now your `// TODO: ...` and your `function foo()` are typographically *distinct* without a single color or weight change. This is a move no other open-source mono can do.

### 3.5 CSS

```css
@font-face {
  font-family: 'Monaspace Neon';
  src: url('./fonts/MonaspaceNeonVarVF.woff2') format('woff2-variations');
  font-weight: 200 800;
  font-stretch: 100% 125%;
  font-style: oblique -11deg 0deg;
}
.code {
  font-family: 'Monaspace Neon', ui-monospace, monospace;
  font-feature-settings: 'calt', 'liga', 'ss01', 'ss02', 'ss03';
}
.code .comment {
  font-family: 'Monaspace Argon';
  font-style: oblique -7deg;
}
```

---

## 4. Berkeley Mono — the premium developer favorite

### 4.1 What it is

**Berkeley Mono** (sold as TX-02 by U.S. Graphics Company at usgraphics.com) is the *cult* paid monospace of 2023–2026. It is unapologetically "a love letter to the golden era of computing" — wears a "UNIX T-shirt," modeled on the visual language of black-on-amber control-panel etch. It costs **$75 for a developer license**.

### 4.2 Berkeley Mono v2.0 (Dec 2024)

- **5 widths** (Compressed → Wide)
- **12 weights** (Hairline → Massive)
- **2 slants** (upright + italic)
- **150+ ligatures** spanning math, FPGA, frontend, compiler operators
- New character variants ("Supertype compiler") that let you build a custom binary with the alts of your choice baked in

### 4.3 Why EZvibes users will *want* it

Berkeley Mono is what Ghostty, WezTerm, and Alacritty enthusiasts wallpaper their terminals with. It's the visual marker of "I take my dev environment seriously." It's **not** OFL — so EZvibes can't ship it — but the vault should let users **point at a local font file via settings**, and if Berkeley Mono is installed, render the snippet previews in it.

### 4.4 Free alternative — `IoskeleyMono`

The community shim is `IoskeleyMono` (a configured Iosevka build that mimics Berkeley Mono closely). It's at github.com/ahatem/IoskeleyMono. Ship this as the **default** for users without Berkeley.

---

## 5. JetBrains Mono — the open-source code default

### 5.1 Specs

- 8 weights (Thin → ExtraBold) × upright + italic = **16 styles**
- Variable font + static formats
- 139 coding ligatures (the largest ligature catalog of any free font)
- Stylistic Sets `ss01-ss20` and Character Variants `cv01-cv99` (added in v2.304)
- Increased x-height for tiny-size legibility
- Free under OFL

### 5.2 Notable v2.x stylistic sets

| Set | Effect |
|-----|--------|
| `ss19` | Cursive italic (Cascadia-style) |
| `ss20` | Alt zero (dotted instead of slashed) |
| `cv99` | The "everything alternate" toggle |

### 5.3 Verdict

JetBrains Mono is the **safe, free, ligature-rich default** for any code surface in EZvibes. If you don't care about provenance and want zero risk, this is it.

---

## 6. Cascadia Code (Microsoft) — the Windows-native pick

### 6.1 Why EZvibes should know it

EZvibes is a **Windows-first Electron app**. Cascadia Code ships preinstalled on Windows 11. The user already has it.

- Variable weight 200–700
- Italic + a **cursive italic** accessed via `ss01`
- Hebrew, Arabic, braille, line-drawing glyphs
- Open-source (OFL), maintained by Microsoft Windows Terminal team
- Cascadia Code = with ligatures; Cascadia Mono = without

### 6.2 The cursive italic move

```json
// VS Code settings.json
"editor.fontLigatures": "'ss01', 'ss02', 'ss03'"
```

In CSS:

```css
.code-italic {
  font-family: 'Cascadia Code', monospace;
  font-feature-settings: 'ss01';   /* swaps italic to cursive variant */
  font-style: italic;
}
```

The cursive italic in Cascadia Code is one of the most beautiful free monospace italics in existence and almost no app outside Operator Mono (paid, $200) offers anything comparable.

---

## 7. IBM Plex — the "corporate but tasteful" alternative

### 7.1 Family

- **IBM Plex Sans** — neo-grotesque
- **IBM Plex Mono** — monospace partner with deliberate glyph disambiguation
- **IBM Plex Serif** — serif companion
- All variable, all OFL, all on Google Fonts

### 7.2 Why it matters

IBM Plex Mono has the **strongest design character** of any open-source monospace. It's not generic. It has personality — slightly humanist, with subtle horizontal stress on lowercase letters. Recommended when EZvibes wants the vault to feel less Vercel-clone and more its own thing.

---

## 8. Apple SF Pro / SF Mono — Mac-only, and how to fake it on Windows

### 8.1 SF Pro Variable

San Francisco Pro Variable consolidates the full SF family — **9 weights, variable optical sizes, 4 widths, rounded variant** — into a single navigable design space. The 2025 SF Pro Variable adds a **fourth axis: Grade (`GRAD`)**, which adjusts visual weight *without* changing letter width. This is the secret to perfect dark-mode adaptation: text on dark backgrounds looks heavier than the same weight on light, so you bump `GRAD` slightly negative.

Axes:

| Axis | Tag | Range |
|------|-----|-------|
| Weight | `wght` | 100–900 |
| Width | `wdth` | 75–125 (Condensed → Expanded) |
| Optical Size | `opsz` | 17–96 |
| Grade | `GRAD` | -50 → +150 |

### 8.2 Licensing reality

SF Pro and SF Mono are licensed **only for Apple-branded apps** (Xcode, Terminal.app, Console.app). EZvibes **cannot legally ship** them. On macOS users they're available via `system-ui` and `ui-monospace`.

### 8.3 The 2026 system-ui stack

```css
:root {
  --font-sans:
    system-ui,
    -apple-system,
    'Segoe UI Variable',
    'Segoe UI',
    Roboto,
    InterVariable,
    'Helvetica Neue',
    Arial,
    sans-serif;

  --font-mono:
    ui-monospace,
    'SF Mono',
    'Cascadia Code',
    'JetBrains Mono',
    Menlo,
    Consolas,
    'Courier New',
    monospace;
}
```

Critical 2025/2026 fact: `-apple-system` and `BlinkMacSystemFont` are *no longer required*. `system-ui` resolves correctly on every modern engine. Keep them only for legacy macOS Safari < 11.

---

## 9. GitHub Mona Sans + Hubot Sans

### 9.1 What they are

**Mona Sans** is GitHub's primary brand variable font (2022), designed in collaboration with Degarism. It's a **strong industrial-era grotesque** with three axes:

- `wght`: ultra thin → extra heavy
- `wdth`: condensed → expanded
- `slnt`: regular → italic

**Hubot Sans** is its "robotic sidekick" with more geometric accents — designed for headers, pull-quotes, splash moments. It is metrics-paired with Mona Sans so you can swap between them on the same line without re-layout.

Both are OFL and downloadable from `github.com/github/mona-sans` and `github.com/github/hubot-sans`.

### 9.2 Why this matters for EZvibes

GitHub uses Mona Sans for headlines, Inter for body, and (recently) Monaspace for code. EZvibes could ape that hierarchy directly:

- Vault panel title → Mona Sans (or Hubot Sans Display, condensed)
- File names → Inter Variable
- Snippet previews → Monaspace Argon

This trio is **all OFL, all free, all variable, ~600 KB total** for the woff2 subsets — a typographic "GitHub aesthetic" out of the box.

---

## 10. Commit Mono — the "neutral" coding font

### 10.1 Pitch

By **Eigil Nikolajsen**. Quote: *"The most effective font is the one you don't notice. No super-high x-height, no geometric construction, no eye-catching design, no confusing ligatures."* Draws on Jasper Morrison's Super Normal manifesto. Free under OFL.

### 10.2 Smart Kerning

Commit Mono's signature feature: an optional **smart kerning** mode that analyzes adjacent characters and shifts narrow chars slightly. The font stays cell-aligned for terminals but reads as proportional. The designer measured an improvement in reading speed *and* accuracy vs. standard monospace.

### 10.3 Customizer

Visit `commitmono.com` and select your alternates (`a`, `g`, `r`, `Q`, `£`, `@` all have variants). The resulting download has your choices baked in. There are **42 cuts** in total. The designer recommends **weight 400 for dark mode, weight 450 for light mode** — a great example of how a single variable font's weight axis can be tuned per theme.

---

## 11. Recursive — the only variable with a "Casual" axis

### 11.1 By Stephen Nixon / Arrow Type

**Recursive Sans & Mono** is the boldest experiment in variable code/UI fonts of the past decade. It has axes for:

- `wght`: weight 300–1000
- `slnt`: slant
- `MONO`: 0 (proportional Sans) → 1 (Mono)
- `CASL`: 0 (Linear, technical) → 1 (Casual, hand-painted brushstroke energy)
- `CRSV`: cursive vs. roman italic style

The **CASL (casual) axis** is the standout: as you increase it, the letterforms physically curve, thicken on terminals, and gain hand-painted "single-stroke sign painter" energy. You can animate it. You can drive it from app state (e.g., the file modified in the last minute pulses to `CASL` 1 then back to 0).

### 11.2 Use case for the vault

The vault is a *living object* — files arrive from other Claude sessions, get pasted, get edited. A typeface whose **letterforms physically move** maps perfectly to "this just changed":

```css
@keyframes vault-arrived {
  from { font-variation-settings: 'CASL' 1, 'wght' 600; }
  to   { font-variation-settings: 'CASL' 0, 'wght' 500; }
}
.vault__filename--new {
  animation: vault-arrived 1.6s ease-out;
}
```

No other font in the open-source ecosystem can do this.

---

## 12. Berkeley Mono / Operator Mono / Dank Mono — the "designer status" fonts

For completeness, the **premium** monospaces favored by 2025–2026 dev influencers:

| Font | Cost | Standout |
|------|------|----------|
| Berkeley Mono v2 | $75 | Retro-computing aesthetic, 5 widths × 12 weights, 150+ ligatures |
| Operator Mono | $200 | True italic with cursive style; the original "make code look like calligraphy" font |
| Dank Mono | £40 | Compact, ligature-rich, originally a paid Fira Code competitor |
| MonoLisa | €69+ | Designed for max readability, used by many design studios |
| PragmataPro | €69+ | Extremely narrow, supports 20+ scripts, beloved by terminal nerds |

EZvibes should let users *point at* these via a settings field. They aren't shippable, but power-users will plug them in.

---

## 13. Iosevka — the customizable workhorse

### 13.1 What it is

**Iosevka** is an open-source (OFL) monospace by **be5invis**, first released in 2017. It's the **most customizable code font in existence** — generated programmatically from source.

### 13.2 Variants

- 6 monospace sub-families (sans/slab × Default/Term/Fixed spacing)
- 2 quasi-proportional sub-families (Aile, Etoile)
- 9 weights (Thin → Heavy)
- 2 widths (Normal, Extended)
- 3 slopes (Upright, Italic, Oblique)
- **143 individually-customizable glyphs**
- **19 stylistic sets** (each mimics another font: Menlo / Monaco / Source Code Pro / Ubuntu Mono / JetBrains Mono / Pragmata-style / etc.)

### 13.3 Custom builds

Visit `typeof.net/Iosevka/customizer` — pick your variants, download a config TOML, run the build. There are pre-baked community variants like **Iosevka-Mayukai** (combines SS04 Menlo + SS07 Monaco + SS09 Source Code + SS12 Ubuntu + SS14 JetBrains + Hack + Nerd Font patching).

---

## 14. Other notable 2025–2026 entrants

### 14.1 Atkinson Hyperlegible Mono (Braille Institute, 2024)

Sister to Atkinson Hyperlegible (which generates **43M weekly impressions** on Google Fonts as of 2025). Designed for *maximum* glyph disambiguation — every character is deliberately distinct (no `0/O`, `1/l/I` confusion). Variable, OFL, free. The right pick for **accessibility-first** EZvibes themes.

### 14.2 Maple Mono (subframe7536, v7 stable 2025)

Open-source monospace with **round corners** (Cascadia-like), built-in Nerd-Font icon glyphs, "infinity font weights" (variable wght), cursive `f i j k l x y` in italic. Strong 2:1 Chinese-English ratio for CJK users. Free, OFL, very 2025-coded.

### 14.3 Departure Mono

A **pixelated retro monospace** that gained real traction in 2025 — used in apps that want "synthwave terminal" aesthetic. Free.

### 14.4 OpenAI Sans (ABC Dinamo, 2025)

OpenAI's bespoke rebrand typeface by Dinamo. Not licensed for general use but worth knowing as a reference for the "AI company brand sans" shape language.

### 14.5 Söhne (Klim Type Foundry, 2019)

The grown-up choice. Designed by **Kris Sowersby**. Captures "the analogue materiality of Standard Medium used in Unimark's NYC Subway wayfinding system." Used by **Stripe** for their whole interface, and reportedly Notion in places. **Paid**, four sub-families (Söhne, Söhne Schmal/Condensed, Söhne Breit/Wide, Söhne Mono), 16 styles each.

### 14.6 ABC Diatype (Dinamo, 2019)

Neo-grotesque sans by **Erkin Karamemet**. Built natively for digital interfaces. Includes Diatype Variable, Diatype Rounded, and **Diatype Mono** (for code/technical). The font of choice for design-conscious agencies in 2024–2026. Used widely in the Linear-adjacent indie SaaS world.

### 14.7 Mononoki

Smooth, designed for low-res displays. Has personality. **No ligatures** (the author refuses, deliberately). Free, OFL. There's a community fork `mononoki-ligatures` that grafts Fira Code's ligatures in.

### 14.8 Hack

A no-frills monospace based on DejaVu Sans Mono, optimized for code. Subset of ligatures only. Free, OFL. Strong choice when you want "good monospace, no fuss."

### 14.9 Fira Code

The OG ligature-rich monospace. 100+ ligatures. Still excellent. Free, OFL.

---

## 15. The 2026 type-tech frontier — what's new and pioneer-level

### 15.1 `font-tech()` and `font-format()` in CSS

CSS now supports `tech()` and `format()` predicates in `src:`:

```css
@font-face {
  font-family: 'Inter';
  src: url('inter.woff2') format('woff2') tech(variations),
       url('inter.woff2') format('woff2');
}
```

This lets the browser choose the variable file *only if it supports variations*, falling back gracefully.

### 15.2 COLRv1 — color & gradient vector fonts

**COLRv1** is the OpenType format that finally makes color fonts performant. Unlike OpenType-SVG (which stored fixed colors per glyph), COLRv1 stores **shapes + a color palette**, separately. That means:

- Colors can be changed at runtime via `font-palette`
- Gradients (linear, radial, conic) and blend modes (multiply, screen, overlay)
- **COLRv1 fonts can also be variable** — animate weight AND color simultaneously
- Browser support: Chrome 98+, Edge, Firefox, Safari (TP)

### 15.3 `@font-palette-values` — repaint your icon font

```css
@font-palette-values --vault-palette {
  font-family: 'Bungee Spice';
  base-palette: 0;
  override-colors: 0 oklch(0.7 0.2 30), 1 oklch(0.5 0.25 250);
}
.vault__icon {
  font-family: 'Bungee Spice';
  font-palette: --vault-palette;
}
```

This is the gateway to **runtime-recolorable** icon fonts. The EZvibes vault could use a single COLRv1 icon font for `.md`, `.txt`, hand-off, prompt — and recolor them per-theme without ever rendering a PNG.

### 15.4 Variable color fonts

Combining variable axes with `font-palette` means an icon font can have:

- `wght` axis for thicker / thinner strokes per density
- `FILL` axis for outline → filled (Material Symbols Variable does this — 1 file, every state)
- Custom palette per theme

**Material Symbols Variable** is the canonical example: one font, infinite icon states. The vault could use it directly for file-type glyphs.

### 15.5 `text-wrap: balance` and `pretty`

Two new CSS values that arrived 2023–2024 and are widely available in 2026:

- `text-wrap: balance` — distributes lines evenly. Perfect for headings and short labels (max 6–10 lines).
- `text-wrap: pretty` — uses a slower, smarter algorithm that minimizes orphans in body text.

```css
.vault__title { text-wrap: balance; }
.vault__description { text-wrap: pretty; }
```

These are computationally expensive — they have line-count caps (10 lines Firefox, 6 lines Chrome for `balance`).

### 15.6 Kinetic typography via `font-variation-settings`

The 2026 frontier is **animating** the variation axes. Inter's `wght` and `slnt` can be transitioned smoothly:

```css
.vault__filename {
  font-variation-settings: 'wght' 400, 'slnt' 0;
  transition: font-variation-settings 200ms ease;
}
.vault__filename:hover {
  font-variation-settings: 'wght' 600, 'slnt' -3;
}
```

The transition is **on the entire variation string** — browsers interpolate every axis simultaneously. Combine with Recursive's `CASL` axis and you get letterforms that physically rearrange on interaction. **This is the move no static font can match.**

### 15.7 OKLCH color + variable type

The 2026 way to color text is `oklch()`, which gives perceptually uniform lightness. Combined with the `GRAD` axis in SF Pro or the weight axis in Inter, you can do:

- Light theme: text at `oklch(0.25 0 0)`, weight 400
- Dark theme: text at `oklch(0.95 0 0)`, weight 380 (slightly lighter to compensate for halation)
- Hover: same color, weight 600 — *no* color change needed

This is the "Apple-grade" trick for dark mode that no app outside Linear / Vercel does well.

---

## 16. Real app type-stacks — the receipts

### 16.1 Linear

```
font-family: "Inter UI", "SF Pro Display", -apple-system, BlinkMacSystemFont,
             system-ui, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell,
             "Open Sans", "Helvetica Neue", sans-serif;
font-weight: 500–800 (heavy);
letter-spacing: -0.011em (display) → +0.073em (tiny metadata);
```

Linear's **letter-spacing curve** is the signature: heavy negative tracking on big text (-1.1% at 56px), heavy positive tracking on small text (+7.3% at 11px). This is the typographic equivalent of "expensive."

### 16.2 Raycast

- Inter Variable everywhere
- `font-feature-settings: "calt", "kern", "liga", "ss03"`
- `ss03` enables the single-story alternate `g` — Raycast's typographic signature
- Self-hosted "Inter Fallback" font for slow connections

### 16.3 Vercel

- Geist Sans + Geist Mono everywhere
- Tailwind utility classes (`text-heading-32`, `text-copy-16`, `text-label-12-mono`)
- Slashed zero on for numerical UI

### 16.4 GitHub

- Mona Sans for marketing/display
- Inter for product UI
- Monaspace for code in github.dev / GitHub Copilot Workspace UI

### 16.5 Stripe

- Söhne for everything since their 2020 rebrand
- Stripe is the **rare** big-tech company with a paid custom-licensed font

### 16.6 Notion

- Inter for everything (after dropping their custom font)
- 400 / 500 / 700 weight, no semibold
- No OpenType feature tweaks (kept simple)

### 16.7 Anthropic

- **Styrene** (Berton Hasebe, Commercial Type) for display
- **Tiempos** (Klim Type Foundry) for body
- Both paid, both pedigreed

### 16.8 Arc browser

- Heavily customized layered system — system-ui + a custom Inter wrap. No public font name confirmed but the visual is Inter-family.

---

## 17. The performance playbook for variable fonts in Electron

### 17.1 The numbers

- WOFF2 vs TTF: **97% browser support, ~40-70% smaller** files
- Subsetting (Latin-only): another **50–80% reduction**
- A variable font replaces **4–8 static font files**, typically smaller than 2–3 static files combined
- Real measurement: 412 KB → 108 KB after WOFF2 + Latin subset; LCP 3.2s → 0.8s

### 17.2 The Electron-specific advice

EZvibes is bundled. There's no remote CDN concern, no FOUT risk on load. But:

1. **Self-host every font.** No `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` in Electron — you don't want a network round-trip on app boot.
2. **Use woff2-variations format** (not the static woff2 files). One file per family.
3. **Subset to Latin + Latin-ext + symbols.** Skip Cyrillic / Greek unless your users actually need them. `pyftsubset` gets you 80–90% smaller files.
4. **Preload** the LCP font at the top of `index.html`:

```html
<link rel="preload" href="./fonts/InterVariable.woff2"
      as="font" type="font/woff2" crossorigin>
```

5. **Always specify `font-display: swap`** in `@font-face`. Even in Electron — it avoids any layout block.
6. **Pair with metric-adjusted fallbacks** if you really care about no-CLS. CSS-Tricks' `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` descriptors on the *fallback* `@font-face` align it metrically to the real font:

```css
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22.5%;
  line-gap-override: 0%;
}
```

7. **`font-feature-settings` globally**, not per-element, to keep CSS shallow:

```css
:root {
  font-feature-settings: 'calt', 'kern', 'liga', 'ss03', 'cv11';
  font-variant-numeric: tabular-nums slashed-zero;
}
```

### 17.3 The Electron-localized rule

Electron's `file://` protocol skips a lot of fetch overhead. You can do this and it's safe:

```css
@font-face {
  font-family: 'InterVariable';
  src: url('./fonts/InterVariable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: block;   /* yes, block — we're local, there's no FOIT risk */
}
```

---

## 18. The vault-specific recommendation (concrete recipe)

For the EZvibes prompt vault, here is the type system I would actually build:

### 18.1 Two fonts, both variable, both OFL

- **Inter Variable** (`InterVariable.woff2`, ~320 KB Latin subset) for all UI text
- **Monaspace Argon** (`MonaspaceArgonVarVF.woff2`, ~120 KB) for snippet previews and inline code in markdown

Total typographic payload: **~440 KB**, one-time, cached locally. That's smaller than a single hero image.

### 18.2 The type scale

```css
:root {
  --font-sans: InterVariable, system-ui, sans-serif;
  --font-mono: 'Monaspace Argon', ui-monospace, monospace;

  /* Type scale — 6 sizes, modular ratio 1.25 (major third) */
  --t-display: clamp(1.5rem, 1.4rem + 0.5vw, 2rem);     /* vault header */
  --t-title:   clamp(1rem,   0.95rem + 0.25vw, 1.125rem); /* file name */
  --t-body:    0.875rem;                                /* body */
  --t-meta:    0.6875rem;                               /* date/size labels */
  --t-code:    0.8125rem;                               /* snippet */
  --t-icon:    1rem;
}
```

### 18.3 Per-element variation settings

```css
.vault__header {
  font-family: var(--font-sans);
  font-size: var(--t-display);
  font-variation-settings: 'opsz' 24, 'wght' 600;
  letter-spacing: -0.022em;
  text-wrap: balance;
}

.vault__filename {
  font-family: var(--font-sans);
  font-size: var(--t-title);
  font-variation-settings: 'opsz' 16, 'wght' 500;
  letter-spacing: -0.005em;
  font-variant-numeric: tabular-nums slashed-zero;
  transition: font-variation-settings 180ms ease;
}
.vault__filename:hover {
  font-variation-settings: 'opsz' 16, 'wght' 600, 'slnt' -2;
}
.vault__filename--new {
  font-variation-settings: 'opsz' 16, 'wght' 650, 'slnt' -4;
  animation: vault-arrived 1.6s ease-out;
}

.vault__meta {
  font-family: var(--font-sans);
  font-size: var(--t-meta);
  font-variation-settings: 'opsz' 14, 'wght' 400;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: oklch(0.55 0.01 240);
  font-variant-numeric: tabular-nums;
}

.vault__snippet {
  font-family: var(--font-mono);
  font-size: var(--t-code);
  font-feature-settings: 'calt', 'liga', 'ss01', 'ss02';   /* texture healing + JS ops */
  font-variation-settings: 'wght' 400;
  letter-spacing: 0;
}
.vault__snippet--comment {
  font-family: 'Monaspace Argon';
  font-style: oblique -7deg;
  color: oklch(0.6 0.03 200);
}
```

### 18.4 The signature interaction

When a hand-off `.md` arrives in the watched folder from another Claude session, the new entry's filename briefly **swells from 500 to 650 weight + slants -4° + then settles back**, driven entirely by `font-variation-settings`. That's a one-line, GPU-cheap, **"this just changed"** signal that no other vault implementation has.

When the user hovers a file, the same axes shift subtly — `wght 500 → 600`, `slnt 0 → -2`. The text feels *alive*.

When the user clicks-to-paste, briefly drive `wght` to 700 for 120ms and back — a tactile typographic "click" feedback.

---

## 19. The most pioneer-level idea I found

> **Kinetic variable-axis feedback for the prompt vault.**
>
> Use Inter Variable's `wght` + `slnt` + `opsz` axes (or Recursive's `CASL` axis) to make the type *physically respond to events*:
>
> - File arrives from another session → letterforms briefly slant -4° and gain weight, then settle (Recursive's `CASL` can go further and make them visibly "wobble" hand-painted).
> - User hovers → weight 500 → 600, slant 0 → -2° smoothly.
> - User clicks-to-paste → 120ms weight-pulse to 700, then back.
> - File is "freshly modified" → `CASL` slowly oscillates 0.2 → 0 over 30s, dying down to neutral.
> - In dark mode, every weight is auto-adjusted by `GRAD -10` for halation correction.
>
> None of this requires JavaScript per-frame work — `font-variation-settings` is GPU-accelerated and animatable directly in CSS. It's free motion. And it gives the vault a tactile "the type is the UI" feeling that no other prompt-list anywhere has.
>
> This is the kind of typographic surface that makes a 2026 power-user say *"what is that font doing?"* — which is exactly the pioneer-level reaction the EZvibes brand should provoke.

---

## 20. References & URLs

- **Inter font** — https://rsms.me/inter/ • https://github.com/rsms/inter
- **Geist** — https://vercel.com/font • https://vercel.com/geist/typography • https://github.com/vercel/geist-font • https://fontsource.org/fonts/geist-mono
- **Monaspace** — https://monaspace.githubnext.com/ • https://github.com/githubnext/monaspace
- **Berkeley Mono** — https://usgraphics.com/products/berkeley-mono • https://reidburke.com/updates/2024/12/berkeley-mono-v2/
- **JetBrains Mono** — https://www.jetbrains.com/lp/mono/ • https://github.com/JetBrains/JetBrainsMono • https://deepwiki.com/JetBrains/JetBrainsMono
- **Cascadia Code** — https://github.com/microsoft/cascadia-code • https://en.wikipedia.org/wiki/Cascadia_Code
- **Mona Sans / Hubot Sans** — https://github.com/github/mona-sans • https://github.com/github/hubot-sans • https://github.blog/news-insights/company-news/introducing-mona-sans-and-hubot-sans/
- **Commit Mono** — https://commitmono.com/ • https://github.com/eigilnikolajsen/commit-mono
- **Recursive** — https://www.recursive.design/ • https://github.com/arrowtype/recursive
- **Iosevka** — https://github.com/be5invis/Iosevka • https://typeof.net/Iosevka/customizer
- **Atkinson Hyperlegible Mono** — https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono • https://github.com/googlefonts/atkinson-hyperlegible-next-mono
- **Maple Mono** — https://github.com/subframe7536/maple-font
- **Söhne / Klim Type Foundry** — https://klim.co.nz/fonts/soehne/
- **IBM Plex** — https://www.ibm.com/plex/
- **Mononoki** — https://madmalik.github.io/mononoki/
- **Nerd Fonts** — https://www.nerdfonts.com/ • https://github.com/ryanoasis/nerd-fonts
- **Modern Font Stacks** — https://modernfontstacks.com/ • https://github.com/system-fonts/modern-font-stacks
- **Apple Fonts (SF Pro, SF Mono)** — https://developer.apple.com/fonts/
- **MDN — `font-variation-settings`** — https://developer.mozilla.org/en-US/docs/Web/CSS/font-variation-settings
- **MDN — Variable fonts guide** — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_fonts/Variable_fonts_guide
- **MDN — `font-variant-numeric`** — https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- **MDN — `font-optical-sizing`** — https://developer.mozilla.org/en-US/docs/Web/CSS/font-optical-sizing
- **Chrome — COLRv1** — https://developer.chrome.com/blog/colrv1-fonts
- **Chrome — text-wrap: pretty** — https://developer.chrome.com/blog/css-text-wrap-pretty
- **Chrome — text-wrap: balance** — https://developer.chrome.com/docs/css-ui/css-text-wrap-balance
- **Adobe — OpenType in CSS** — https://helpx.adobe.com/fonts/using/open-type-syntax.html
- **Texture Healing** — https://github.com/githubnext/monaspace/blob/main/docs/Texture%20Healing.md
- **CSS-Tricks — System font stack** — https://css-tricks.com/snippets/css/system-font-stack/
- **CSS-Tricks — COLRv1 + font-palette** — https://css-tricks.com/colrv1-and-css-font-palette-web-typography/
- **Linear typography (Typ.io)** — https://typ.io/s/2jmp
- **Raycast design notes** — https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
- **Inter v4 — Rasmus discussion** — https://github.com/rsms/inter/discussions/493
- **Lexington Themes — Inter stylistic sets** — https://lexingtonthemes.com/blog/inter-stylistic-sets-css-tailwind
- **Lexington Themes — Geist OpenType features** — https://lexingtonthemes.com/blog/geist-opentype-features
- **DebugBear — Web font preload** — https://www.debugbear.com/blog/preload-web-fonts
- **Web.dev — Optimize web fonts** — https://web.dev/learn/performance/optimize-web-fonts
- **Variable Fonts for Developers** — https://variablefonts.dev/getting-started
- **Variable Fonts catalog** — https://v-fonts.com/
- **Muzli — Best variable fonts 2026** — https://muz.li/blog/best-free-variable-fonts-for-ui-and-web-design-2026/
- **DesignMonks — Best UI fonts 2026** — https://www.designmonks.co/blog/best-fonts-for-ui-design
- **Kittl — Why variable fonts are winning in 2026** — https://www.kittl.com/blogs/why-variable-fonts-are-winning-fnt/
- **MadeGoodDesigns — Best programming fonts 2026** — https://madegooddesigns.com/best-programming-fonts-2026/

---

*End of dossier — agent 18.*
