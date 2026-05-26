# Iconography Systems 2025-2026 — A Pioneer-Level Research Dump for the EZvibes Prompt Vault

> Research agent #20 of 30. Focus: **iconography systems** that could power the prompt-vault panel inside EZvibes's session windows. The vault sits inside an Electron 33 app (vanilla JS, no React, no bundler), so every recommendation is judged on three axes simultaneously: visual quality at 16/20/24 px, friction in vanilla-JS / no-build pipelines, and "pioneer feel" in 2025-2026.

---

## 0. Executive frame — why iconography is load-bearing for this feature

The prompt vault is a list of clickable files where each click pastes the contents into the active xterm tab. That single interaction surface needs icons to do four very different jobs in the same 320-400 px wide panel:

1. **File-type identification** at row level (markdown, hand-off, CLAUDE.md, prompt, YAML). The user must see at a glance "this is a hand-off, this is a system prompt, this is a snippet."
2. **Action affordances** per row (Paste, Copy, Pin, Star, Reveal-in-folder, Open-in-editor) shown either inline on hover or in a row-level context menu.
3. **Status / state markers** (recently modified, freshly written by another session — the "hand-off" arrival glow), tab and folder indicators, and the active-paste pulse the user wants.
4. **Header / chrome ornament** — the "VAULT" label area, sort/filter chevrons, the search lens, the close-pin "X."

Most apps use ONE icon library for all of these. Pioneer-level apps (Linear, Arc, Raycast, Warp, Cursor, t3.chat, Lovable, Vercel v0) instead orchestrate **two or three** icon registers with shared design tokens so each register punches above its weight. The research below maps out which libraries deliver what, what's free, what's paid, what's pixel-perfect at 16 px (terminal scale), and the code shapes that work without a bundler.

---

## 1. The Big Five open-source icon libraries of 2025-2026

### 1.1 Phosphor Icons — the chameleon of 2025-2026

**Why it matters:** Phosphor has become the indie-developer favorite in 2025-2026 specifically because of its **six weights** per icon. One library gives you a thin functional UI scale, a heavy bold marketing register, a filled "selected-state" set, and a duotone illustration register — all hand-drawn to align on the same metrics. That makes Phosphor the only single-source library that can carry the vault's full visual stack (file-type at 18 px → action at 16 px → vault-header at 32 px → "this is a hand-off!" hero glyph at 64 px) without ever mixing visual languages.

**Stats:**
- ~9,000+ icons (was 7,700+ in 2024, grew through 2025).
- Six weights: `thin`, `light`, `regular`, `bold`, `fill`, `duotone`.
- 1 px stroke base, 24 px grid, MIT licensed.
- Maintained by Toby Fried and Helena Zhang; original Figma file is the canonical source.
- Three distribution channels: `@phosphor-icons/web` (icon-font / CSS, vanilla-JS friendly), `@phosphor-icons/react`, `@phosphor-icons/webcomponents` (custom elements — works in any HTML).

**Vanilla JS / no-bundler install (matches EZvibes's stack):**

```html
<!-- Drop these into renderer/index.html <head> -->
<link rel="stylesheet" href="node_modules/@phosphor-icons/web/src/regular/style.css">
<link rel="stylesheet" href="node_modules/@phosphor-icons/web/src/fill/style.css">
<link rel="stylesheet" href="node_modules/@phosphor-icons/web/src/duotone/style.css">

<!-- Use anywhere -->
<i class="ph ph-file-text"></i>            <!-- regular -->
<i class="ph-fill ph-file-text"></i>       <!-- filled -->
<i class="ph-duotone ph-file-text"></i>    <!-- two-color -->
```

The icons are real font glyphs mapped to Unicode Private Use Area. Styling is just `font-size`, `color`, `text-shadow` — perfectly fitting EZvibes's vanilla CSS. The cost: loading all six weights pulls ~3 MB of WOFF2; for the vault you'd ship only the 2-3 weights you use (regular + fill for file-type vs active; duotone optionally for the header hero).

**Web Components alternative** (no Node deps, no font):

```html
<script type="module" src="https://unpkg.com/@phosphor-icons/webcomponents"></script>
<ph-file-text size="20" color="#e6c98e" weight="regular"></ph-file-text>
<ph-file-text size="20" color="#e6c98e" weight="fill"></ph-file-text>
```

This is the sweet-spot for EZvibes: no bundle, no font, real SVG in the DOM, `currentColor` inheritance for free.

**Pioneer-level trick — weight as state.** Phosphor was the first to popularize using `weight` as a state toggle in the same way you'd use a `selected` boolean: pinned prompts swap from `regular` → `fill`; the "currently being pasted" row swaps to `duotone` so the icon literally fills with the action color while the row pulses. Compare to Lucide where you'd have to swap to a different icon name entirely.

**File icons in Phosphor relevant to the vault:**
- `ph-file-text` — Markdown / plain prompts.
- `ph-file-code` — `.json`, `.yaml`, structured prompts.
- `ph-file-md` — explicit markdown variant (added in 2.x).
- `ph-scroll` — long-form prompts / hand-off documents.
- `ph-vault` — the literal vault metaphor.
- `ph-package` — a CLAUDE.md "context bundle."
- `ph-clipboard-text`, `ph-clipboard` — paste actions.
- `ph-paperclip`, `ph-pushpin`, `ph-pushpin-simple` — pin actions.
- `ph-star`, `ph-star-half`, `ph-star-four` — favorite states.
- `ph-arrow-square-out` — reveal-in-folder.
- `ph-hand-arrow-down` — hand-off (very pioneer; the icon is literally a hand catching an arrow).
- `ph-bookmark`, `ph-bookmark-simple` — saved prompts.
- `ph-magic-wand` — AI-generated prompt indicator.
- `ph-flask`, `ph-flask-fill` — experimental prompts.
- `ph-cube`, `ph-cube-focus` — context-bundle metaphor.

**Phosphor bundle math:** When you import via the React package, the tree-shakable build adds ~45-55 kB for 10 icons across all six weights. For the vanilla / web-components path the per-icon SVG is ~400-900 bytes. For EZvibes you'd ship the dozen file/action icons inline.

### 1.2 Lucide — the default UI icon library of the React/Tailwind world (also fine for vanilla)

**Why it matters:** Lucide is the modern fork of Feather Icons. By 2026 it is statistically the default icon set: **34M+ weekly npm downloads** for `lucide-react` alone, used in 10,400+ projects on npm. It's baked into shadcn/ui, Vercel v0, Lovable, Raycast extensions, Astro starters, and most "create-x-app" templates. If you've seen a 2025-2026 React app, you've seen Lucide.

**Stats:**
- 1,700+ icons in 2026 (grew from 1,400 in 2024).
- One single weight: 2 px stroke on a 24 × 24 grid, round line caps.
- ISC license (very permissive).
- First-party packages for React, Vue, Svelte, Angular, Preact, Solid, Astro, Lit, Flutter, React Native, plus a plain ESM `lucide` package and an `<icon>` web-component build.

**Vanilla JS install (matches EZvibes's stack):**

```html
<!-- via UNPKG, no build step -->
<script src="https://unpkg.com/lucide@latest"></script>

<!-- in renderer -->
<i data-lucide="file-text"  width="20" height="20"></i>
<i data-lucide="clipboard-paste" width="16" height="16"></i>

<script>
  lucide.createIcons();   // walks the DOM and replaces <i> with inline <svg>
</script>
```

`lucide.createIcons()` swaps every `<i data-lucide="…">` for an inline SVG, so you get `currentColor` inheritance, no font loading, instant re-render via `MutationObserver` on dynamic content. For EZvibes's per-row icons this is genuinely the minimum-friction option.

**Lucide file icons relevant to the vault:**
- `file`, `file-text`, `file-code`, `file-json`, `file-type`, `file-symlink`, `files`, `folder-open`, `folder-input`, `folder-output`.
- `notebook-text`, `notebook-pen`, `book-marked`, `book-open-text`, `scroll-text`, `scroll`.
- Action icons: `clipboard`, `clipboard-paste`, `clipboard-copy`, `clipboard-check`, `clipboard-list`, `clipboard-pen-line`.
- Status: `pin`, `pin-off`, `star`, `star-off`, `heart`, `bookmark`, `bookmark-check`, `flag`.
- Vault metaphor: `vault`, `archive`, `archive-restore`, `package`, `package-open`, `package-2`.
- AI vibes: `sparkles`, `wand-sparkles`, `bot`, `brain-circuit`, `terminal`, `terminal-square`.

**Customization in vanilla:** Every Lucide icon accepts `stroke-width`, `width`, `height`, `color` as attributes on the `<i>` placeholder; after `createIcons()` they become real SVG attributes. The `absoluteStrokeWidth` mode keeps strokes at 2 px in screen pixels regardless of the icon's logical size — useful so a 16 px vault row and a 32 px header both render with identical visual weight.

**Pioneer-level trick — composition.** Lucide's "Lab" extension and several community plugins let you stack two Lucide icons with absolute positioning to make compound icons that don't exist yet (e.g. `file-text` + a tiny `sparkles` overlay = "AI-generated prompt"). Several 2026 apps use this to brand-new effect.

### 1.3 Tabler Icons — 6,300+ icons in two styles, the workhorse

**Stats:**
- 6,300+ icons (2026), MIT.
- Two styles: `outline` (1.5-2 px stroke, 24 px grid) and `filled` (solid).
- First-party React, Vue, Svelte, Solid, Angular, Preact, Flutter packages; standalone SVG download; CDN; Figma plugin.
- Same design DNA as Lucide (clean stroke), but ~4× the icon count.

**Vanilla install:**

```html
<link rel="stylesheet" href="https://unpkg.com/@tabler/icons-webfont@latest/tabler-icons.min.css">
<i class="ti ti-file-text"></i>
<i class="ti ti-clipboard-text"></i>
```

Tabler is the right call when you find Lucide is missing the niche file-type or action glyph you need (`ti-file-orientation`, `ti-file-zip`, `ti-file-spreadsheet`, `ti-hand-grab`, `ti-keyboard-show`, etc.).

### 1.4 Heroicons — the curated Tailwind set with the famously good *micro* tier

**Stats:**
- 316 icons in 2026, MIT, by the Tailwind Labs team.
- Four sizes hand-redrawn per size class:
  - `24/outline` (1.5 px stroke) — primary UI scale.
  - `24/solid` — filled state.
  - `20/solid` — designed for buttons and chips.
  - `16/solid` ("**Micro**") — designed *specifically* for the tightest, highest-density UIs where 16 px would normally collapse.
- First-party React and Vue packages, plus raw SVG.

**Why Heroicons matter for the vault:** The 16/solid micro set is hand-drawn at that size, meaning each icon was redrawn — not down-scaled — to read crisply at 16 × 16. For EZvibes's vault, which is dense and lives at 16-20 px per icon, this is the only set with a literal 16 px design language. If a row is 24 px tall and you want a 16 px file-type marker, Heroicons Micro is the genre-defining choice in 2026.

**Vanilla install — easiest:** Just download the SVG files (the repo ships them flat in `optimized/16/solid/`) and inline them.

### 1.5 Iconify — the meta-library (200,000+ icons unified)

**Stats:**
- 294,661 icons across 211 icon sets (May 2026).
- One unified API + framework — every icon set above (and many more) accessible via the same syntax.
- Web component `iconify-icon` works in vanilla HTML with zero build, lazy-loads from the Iconify API.

**Vanilla install:**

```html
<script src="https://code.iconify.design/iconify-icon/3.0.0/iconify-icon.min.js"></script>

<iconify-icon icon="ph:file-text-duotone"  width="20" height="20"></iconify-icon>
<iconify-icon icon="lucide:clipboard-paste" width="16" height="16"></iconify-icon>
<iconify-icon icon="tabler:vault"           width="32" height="32"></iconify-icon>
<iconify-icon icon="heroicons:sparkles-16-solid" width="16" height="16"></iconify-icon>
```

**Why Iconify is the pioneer choice for the vault:** With one tag you can mix Phosphor (file-type), Lucide (actions), Heroicons-Micro (16 px controls), Tabler (specialty), Pixelarticons (the literal "vault terminal" Easter-egg style), and Lordicon-converted Lottie animations — all with consistent `<iconify-icon>` markup and `currentColor` inheritance. For Electron + vanilla-JS this is the lowest-friction maximum-flexibility option that exists in 2026.

You can also host icons offline by downloading the JSON bundles you need (each icon set is one JSON file). The EZvibes app can ship a single `iconify-bundle.json` with exactly the icons it needs from any/all of the 211 sets, completely offline-capable.

---

## 2. Material Symbols — the variable-font monster you can use without React

Google's Material Symbols are different from every other library in this list: they are a single **variable font** with four CSS-controllable axes. One font file → infinite icon variations.

**Axes:**
- **Weight** 100-700 (Thin → Bold). Lets you go from a hairline UI icon to a heavy mobile-touch icon by changing a CSS variable.
- **Fill** 0-100. Animates from outline → filled smoothly (perfect for selected/active states).
- **Optical size** 20-48 px. Stroke weight automatically optically corrects when icon size changes — a 16 px icon doesn't render with the same stroke as a 48 px icon because each is drawn for its size.
- **Grade** -50 to 200. Subtle visual weight adjustment for dark vs. light themes (a glyph in dark mode wants slightly less ink to read the same).

**Vanilla install:**

```html
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">

<span class="material-symbols-rounded" style="font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;">
  description
</span>
```

You can animate ANY axis with `transition: font-variation-settings 200ms`. So hovering a vault row could smoothly fill its file icon from 0 → 100 in 200 ms. That's a *single CSS transition*, no JS, no second icon, no morph library. **This is genuinely a pioneer-level trick for the EZvibes vault.**

Three variants: Outlined, Rounded, Sharp. Rounded matches Lucide's aesthetic; Sharp matches Tabler; Outlined matches Heroicons.

**Limitation:** It's a font, so it loads only one set of glyphs (you pick at link time). And the inverted version doesn't ship — to make a "filled circle around a fileText", you'd compose.

---

## 3. The hand-drawn / character register — Streamline, Mariam, Iconoir

When the user said "pioneer-level cool" they almost certainly want at least *some* of the vault to feel hand-made rather than corporate. 2025-2026's biggest aesthetic shift has been a return to **character** in icons: less Bauhaus geometry, more designer-with-a-pen feel.

### 3.1 Streamline (paid, world's largest)

- ~120,000+ icons in 2026, organized into 80+ icon families.
- Notable families relevant to the vault: **Core** (the minimal Lucide-ish base), **Plump** (friendly with extra curves), **Sharp** (brutalist 1px lines), **Freehand** (literally hand-drawn with imperfect strokes), **Mini** (16 px native), **Duotone**.
- $19/month or one-time license tiers, but offers a free tier of ~30,000 PNG icons.
- File formats: SVG, PDF, AI, PNG, WebFont, Figma library.

For a project like EZvibes where you're shipping locally, paying once for the Freehand family alone would be visually transformative — the vault could feel like a designer hand-painted it, while still being pixel-aligned at small sizes (something most hand-drawn sets fail at).

### 3.2 Iconoir — the only premium-feeling FREE library

- 1,600+ icons, 24 px grid, MIT.
- Designed by Luca Burgio with a deliberately distinctive geometric flair — slightly heavier than Lucide, slightly more rounded.
- Excellent for products that want to avoid the "default Lucide app" look while staying free.

```html
<!-- vanilla CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/iconoir-icons/iconoir@main/css/iconoir.css">
<i class="iconoir-page-edit"></i>
```

### 3.3 Mariam / Doodle Icons / "freehand" niche

The "Mariam" set (the user referenced) is a smaller free hand-drawn set (~400 icons) leaning into intentionally wobbly strokes. Similar competitors that came up in research: **Freehand Vector Icons** (11,100 free icons, doodle aesthetic), **Doodle Icons** (400+ free), Streamline's **Freehand** family (paid premium). These are best as decorative or "Easter egg" registers rather than dense functional UI.

For the vault, a wise pattern is:
- Functional small-icon register: Lucide or Phosphor regular (16-20 px).
- Hero / header / empty-state register: Streamline Freehand or Doodle Icons at 64-128 px.

The two registers don't compete because they live in different size buckets. This is how Linear and Arc actually compose their icon systems: a tight functional set in the chrome, a looser illustrative set in empty states and onboarding.

---

## 4. The retro / pixel / "vault terminal" register

The user's mockup of a "vault" in a terminal session has strong retro-terminal energy. Two libraries dominate this aesthetic in 2026:

### 4.1 Pixelarticons

- 4,052 hand-crafted pixel icons in 2026, drawn on a strict 24 × 24 pixel grid.
- Four families: `Base` (clean outlines), `Sharp` (angular), `Glyph` (filled detailed), `Solid` (fully filled).
- 816 icons are free forever via `npm install pixelarticons`; the full 4,052 are a one-time Pro purchase ($29-ish).
- Scale ONLY in multiples of 24 (24/48/72/96) for crisp rendering — anti-aliased upscaling kills the aesthetic.

```js
// Vanilla: each icon ships as an SVG file at pixelarticons/svg/...
import vaultSvg from 'pixelarticons/svg/vault.svg';
```

For the EZvibes vault, Pixelarticons would be a chef's-kiss easter egg if you used it ONLY for the vault header glyph and the close pin — turning the panel into a literal "8-bit safe in your terminal." Don't use Pixelarticons for row-level file icons; they're designed for personality, not density.

### 4.2 Nerd Fonts (the terminal-icons heritage line)

Nerd Fonts pre-merge popular monospace fonts with icons from Font Awesome, Material Icons, Octicons, Devicons, and Powerline glyphs. They live inside terminal text. The PowerShell module `Terminal-Icons` uses them to show file-type icons in `ls` listings.

If EZvibes's vault wanted *the most ridiculous* level of pioneer integration, you could match the row icon in the vault list to the icon that the terminal itself would show if the file were rendered there. That kind of "the panel and the terminal speak the same icon language" detail is what gives Arc and Raycast their cult feel.

---

## 5. Animated icons — Lordicon, Lottie, motion/react, CSS-only

The user wants the vault to feel alive. Three approaches stack from heaviest to lightest:

### 5.1 Lordicon (43,900+ animated icons, freemium)

- 43,900+ premium and free animated icons in 2026.
- Native formats: Lottie JSON, GIF, MP4, WEBP, APNG, SVG (animated), PNG, JSON.
- Triggers built into the player: `hover`, `click`, `loop`, `loop-on-hover`, `morph`, `morph-two-way`, `boomerang`, `in-reveal`.
- Free tier: 7,000+ icons, attribution required.
- Pro tier: $39/year or one-time pricing for the full library, no attribution.

**Vanilla install (web component, no build):**

```html
<script src="https://cdn.lordicon.com/lordicon.js"></script>

<lord-icon
  src="https://cdn.lordicon.com/wloilxuq.json"
  trigger="hover"
  style="width:32px;height:32px"
  colors="primary:#e6c98e,secondary:#cd853f">
</lord-icon>
```

`lord-icon` is a real custom element; the `colors` attribute swaps the Lottie's color tokens at runtime, so you can theme to EZvibes's amber Claude / teal Codex palette.

**Pioneer-level trick for the vault:** Use Lordicon's `morph` trigger on the paste icon so when the user clicks, the `clipboard` icon literally morphs into a `check-mark` for 1.2 s before snapping back. That single micro-interaction is what makes a vault feel "alive" versus "static."

### 5.2 Lottie (Skottie / lottie-web)

For full creative control, drop in `lottie-web` and play hand-authored animations:

```html
<script src="https://cdn.jsdelivr.net/npm/lottie-web@latest/build/player/lottie.min.js"></script>
<div id="paste-anim" style="width:24px;height:24px"></div>
<script>
  lottie.loadAnimation({
    container: document.getElementById('paste-anim'),
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: 'animations/paste-success.json'
  });
</script>
```

You then `.playSegments([0, 60], true)` on click. Files at LottieFiles.com, IconScout, Useanimations.com all offer copy/paste/clipboard animation packs free or paid.

### 5.3 CSS-only morphing (the right call for EZvibes)

For a vanilla-JS Electron app you genuinely do not need a Lottie runtime. With Material Symbols's variable axes you get morph-quality animation for free:

```css
.vault-row__file-icon {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
  transition: font-variation-settings 220ms cubic-bezier(.2,.7,.2,1),
              color 220ms ease;
}
.vault-row:hover .vault-row__file-icon,
.vault-row.is-pasting .vault-row__file-icon {
  font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 100, 'opsz' 20;
  color: var(--amber-accent);
}
```

That's a real morph from outline-thin to filled-bold-graded purely in CSS. No JS, no Lottie, no library — but it reads as "premium" because the actual character glyph is interpolating.

Combine with a tiny SVG path morph for the click-confirm:

```html
<svg class="paste-confirm" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
  <path class="paste-confirm__path" d="M9 12l2 2 4-4"/>
</svg>
```

```css
.paste-confirm__path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  transition: stroke-dashoffset 280ms cubic-bezier(.2,.7,.2,1);
}
.vault-row.is-pasted .paste-confirm__path {
  stroke-dashoffset: 0;
}
```

A drawn-on checkmark is one of those classic micro-interactions that always reads as premium.

### 5.4 Itshover — the React animated-icon library

Mentioned for completeness — only useful if/when EZvibes migrates to a build pipeline. Itshover uses motion/react and bakes purposeful motion into each icon. Not applicable to the current no-bundler stack but worth noting as an evolution path.

---

## 6. Variable-color & multi-layer icon systems (Phosphor Duotone, DuoIcons, SF Symbols)

A multi-color icon is the secret weapon for differentiating *types* of vault entries with zero added cognitive load: a `CLAUDE.md` could be amber, a `hand-off.md` could be teal, a regular prompt could be neutral — using the SAME icon shape but different color layers.

### 6.1 Phosphor Duotone

Each duotone icon has a primary and a secondary path that you can independently color. In CSS this becomes:

```css
.ph-duotone.ph-file-text { color: var(--icon-primary); }
.ph-duotone.ph-file-text::after { color: var(--icon-secondary); opacity: 0.4; }
```

(Phosphor uses `:before` for the main glyph and `:after` for the secondary layer. Don't override `content` on these or you break the icon.)

### 6.2 DuoIcons

Free, MIT, ~600 hand-drawn duotone icons with explicit `primary-color` / `secondary-color` props. React, Vue, Svelte, Tailwind, Alpine, vanilla, RN, Flutter packages.

```html
<svg class="duoicon" viewBox="0 0 24 24">
  <path class="duoicon-primary-layer"   fill="currentColor"/>
  <path class="duoicon-secondary-layer" fill="currentColor" opacity="0.4"/>
</svg>
```

Default 40 % opacity on the secondary layer is the convention.

### 6.3 SF Symbols 7 (Apple, Mac-only) — for inspiration

Not usable directly in Electron because the font is sandboxed to Apple platforms, but the *design patterns* are heavily influential for 2026 indie UI:
- **Variable Color** with `.iterative` (one layer at a time) and `.cumulative` (each layer adds on top), plus optional reversing.
- **Variable Draw** — same layers can be re-purposed as draw-progress indicators (perfect mental model for a "prompt has been pasted N% into the terminal" if you ever wanted progress on long prompts).
- **Magic Replace** — a transition when one symbol becomes another (e.g. `play` → `pause`) where shared geometry is preserved and only the differential animates.

For EZvibes, the philosophical takeaway: **design your icon set so the file-type icon and the action icon share enough geometry that you can morph between them.** A `file-text` morphing into a `clipboard-check` on paste-success is much more delightful than two independent icons fading in/out.

---

## 7. Iconography in real 2025-2026 production apps

The exemplar list:

- **Linear** — Lucide (with custom Linear-shaped icons for branded actions like the cycle progress arcs). Tight functional register, no decorative icons, uniform 16 px stroke 1.5 px.
- **Arc browser** — Custom hand-drawn icon set with intentional asymmetry. Several community Arc Browser custom-icon packs ship on Gumroad / Icons8 in "outline hand-drawn" style; the user can theme Arc itself with these.
- **Raycast** — Custom icon set with Phosphor as fallback; uses heavy round-rect file-type icons with single-color accents per type. Their extension marketplace uses Lucide.
- **Cursor** — Lucide + custom Cursor icons; uses `sparkles` and `wand` heavily for AI moments.
- **Warp** — Phosphor + custom for command-palette glyphs.
- **Vercel v0 / Lovable** — Lucide via shadcn/ui default.
- **t3.chat** — Lucide + custom branding icons.
- **Obsidian** — Lucide internally + plugin-installable icon packs (Iconize plugin supports Phosphor, Tabler, Remix, Bootstrap, and custom packs simultaneously — the most "anything goes" iconography of any indie productivity app).
- **Notion** — Custom Notion icon set (proprietary). Notable for the "select your file emoji" interaction, which is the loosest cousin of EZvibes's vault concept.
- **VSCode** — Material Icon Theme is the de-facto standard file-type icon pack (4,800+ folder icons too), with Seti UI as the elegant minimal alternative.
- **GitHub Desktop / GitHub.com** — Octicons (GitHub's own ~340-icon library).
- **macOS Tahoe 26 system icons (2025-2026)** — Liquid Glass: every system icon redesigned as multi-layer glass with real-time reflection of background light. Even Apple's own icons now ship with `Light`, `Dark`, `Tinted`, and the new `Clear` variants. The `.icon` format is a folder of resources, not a single file. For desktop apps in 2026, having tinted variants per theme is now table stakes.

The Liquid Glass aesthetic specifically — translucent layered glass icons that refract the background — is the **single most-copied design language of 2026**. If the vault's hero icon (the big "VAULT" glyph at the top of the panel) were a custom liquid-glass treatment of `ph-vault-duotone`, that would feel cutting-edge to anyone who's spent time on a 2026 Mac.

---

## 8. Sizing — the unsexy but load-bearing detail

Here's the cheat-sheet for the vault's specific dimensions. Industry conventions in 2025-2026:

| Context | Size | Stroke (if outline) | Typical library |
|---|---|---|---|
| Inline text icon (in a sentence) | 16 px | 1.25 px | Heroicons Micro, Phosphor `thin`/`light`, Lucide @ stroke 1.5 |
| Dense list row icon (vault file) | 16-20 px | 1.5 px | Lucide, Phosphor `regular`, Heroicons 20/solid |
| Button-internal icon | 16-20 px | 1.5-2 px | Lucide, Phosphor `bold` |
| Standalone button (icon-only) | 24 px | 2 px | Lucide, Tabler, Phosphor `regular` |
| Card / header chrome | 24-32 px | 2 px | Phosphor `bold`/`duotone`, Lucide |
| Hero / empty state | 48-128 px | 2-3 px | Phosphor `duotone`, Streamline `Plump`/`Freehand`, Doodle Icons |

For EZvibes's vault, the inferred rhythm from the mockup is:
- Header glyph: 28-32 px (vault icon, slightly larger than row icons).
- Row file-type icon: 18-20 px.
- Row action icons (Paste, Pin, Star on hover): 16 px Heroicons Micro or Phosphor `bold` @ 16.
- Search/filter chevrons in the toolbar: 14-16 px.
- Empty state ("No prompts yet — drop a `.md` here") hero: 80-96 px duotone or freehand.

---

## 9. SVG icon-component pattern — the canonical 2026 recipe

For EZvibes's vanilla-JS renderer, the simplest hand-rolled icon-component pattern looks like this:

```js
// renderer/icons.js
const ICONS = {
  'file-text': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>`,
  // ... other icons
};

export function icon(name, { size = 20, color = 'currentColor', className = '' } = {}) {
  const svg = ICONS[name];
  if (!svg) return '';
  const el = document.createRange().createContextualFragment(svg).firstElementChild;
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('aria-hidden', 'true');
  if (color !== 'currentColor') el.style.color = color;
  if (className) el.setAttribute('class', className);
  return el.outerHTML;
}
```

The pattern:
1. SVG strings live as constants, never re-parsed from network.
2. `currentColor` for fill/stroke — icon color is just the parent's text color.
3. `aria-hidden="true"` because icons inside text are decorative; the row label carries the accessible name.
4. Inline in the DOM — no `<img src>` (would break currentColor and cost an HTTP request), no `<use href>` (sprites have caching benefits but cost cross-document references which Electron handles oddly).

**Sprite vs inline tradeoff (2026 consensus):**
- **Inline SVG** wins for ≤50 unique icons used multiple times. No HTTP cost, full styling control. Cloud Four's benchmarks confirm Chrome/Edge handles inline SVG faster than external symbol sprites.
- **External sprite** (`<svg><use href="#icon-name">`) wins for huge libraries (200+ icons) used heavily because the cache hits once and reuses. Safari treats external sprites as the fastest technique regardless.
- **Web component / `iconify-icon`** wins for vanilla apps with dynamic icon sets — no build step, lazy loading, automatic caching, mixed-source.

For EZvibes, **inline SVG via a vanilla helper** is the right answer for the ~30-40 icons the vault actually needs. If the vault ever lets users pick custom icons for their pinned prompts, switch to `iconify-icon` for the bottomless catalog.

---

## 10. "Liquid / glassy / metallic" stylized icons (2026's defining trend)

Beyond Apple's macOS Tahoe, the broader 2026 web is full of icons that go beyond flat:

- **Liquid Glass** — multi-layer glass with reflection. Achievable in CSS with stacked SVG + `backdrop-filter: blur()` + a subtle `mix-blend-mode: overlay` highlight stroke.
- **Metallic** — chrome gradients with hard specular highlights. Achievable with SVG `<linearGradient>` from `#fefefe` → `#a0a0a0` plus a 1 px white highlight stroke on top edges.
- **Glossy plastic** (the 2007 OS X return) — soft radial gradient + inner shadow + 1 px highlight.
- **3D embossed** — a base layer + a colored fill layer + a darker shadow layer, all SVG path duplicates with translate offsets.

For EZvibes's vault, the most striking single design choice would be:
- Keep all the *functional* icons (file types, actions) flat and minimal.
- Make the *one* hero glyph in the panel header (the vault itself) a custom 4-layer SVG with liquid-glass treatment. That one detail anchors the panel as "premium" and is the kind of thing that gets screenshotted.

A vanilla recipe for a glass icon:

```html
<svg class="glass-vault" viewBox="0 0 64 64" width="48" height="48">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(255,255,255,.45)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,.05)"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="0.6"/></filter>
  </defs>
  <!-- back shadow layer -->
  <rect x="8" y="12" width="48" height="44" rx="8" fill="rgba(0,0,0,.25)" filter="url(#blur)"/>
  <!-- the glass body -->
  <rect x="8" y="10" width="48" height="44" rx="8" fill="url(#g1)" stroke="rgba(255,255,255,.5)"/>
  <!-- specular highlight on top edge -->
  <path d="M10 14 Q32 6 54 14" stroke="rgba(255,255,255,.9)" stroke-width="1" fill="none"/>
  <!-- vault dial -->
  <circle cx="32" cy="32" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
  <circle cx="32" cy="32" r="2" fill="currentColor"/>
</svg>
```

That's a one-file glassy vault icon with shadow, specular, and functional symbol — the kind of detail Linear and Arc do in 2026.

---

## 11. Specifically for the EZvibes prompt vault — a recommended icon stack

Based on everything above, the **recommended pioneer-level icon stack** for the EZvibes vault, ordered by where each library shows up in the UI:

1. **Row file-type icons (16-20 px)** — **Lucide** via the vanilla `<i data-lucide="…">` loader. Tight, default-friendly, vast file-type coverage:
   - `file-text` → generic `.md` prompt.
   - `file-code` → `.yaml`, `.json`, structured prompt.
   - `notebook-text` → CLAUDE.md / system prompt with notebook framing.
   - `scroll-text` → long-form hand-off.
   - `wand-sparkles` → AI-generated prompt.
   - `book-marked` → pinned / starred prompt.

2. **Row action icons on hover (16 px)** — **Heroicons Micro** (the only library hand-drawn at 16 px):
   - `clipboard-document-check-16-solid` → paste action.
   - `bookmark-16-solid` / `bookmark-square-16-solid` → pin.
   - `star-16-solid` → favorite.
   - `arrow-top-right-on-square-16-solid` → reveal in folder.

3. **Vault header glyph (32-48 px)** — **Phosphor Duotone** `ph-vault-duotone`, OR a custom hand-drawn liquid-glass vault SVG. This is the "pioneer" register; this icon should look hand-made vs. the rest of the panel.

4. **Empty state hero (96-128 px)** — **Doodle Icons** or **Streamline Freehand** for a literal hand-drawn "no prompts here yet" illustration with a single accent color.

5. **Status indicators (paste-success morph)** — **CSS-only morph** of a Lucide `clipboard` → `clipboard-check` via stroke-dashoffset draw-on for the checkmark. No runtime library needed.

6. **Optional easter egg** — On Ctrl+Shift+P (or similar), swap the vault header to a **Pixelarticons** `vault` glyph for a retro-terminal moment. A delight detail that doesn't cost compatibility.

7. **Optional theming layer** — Set `--icon-primary`, `--icon-secondary`, `--icon-accent` as CSS variables on the vault root. Both Phosphor Duotone and DuoIcons honor these via `currentColor` and per-layer opacity. The Claude (amber) vs Codex (teal) tabs already have palettes — extend them to the vault automatically.

---

## 12. Free vs paid in 2026 — the honest budget breakdown

**Genuinely free (MIT or ISC) and high-quality enough to ship a serious app on:**
- Lucide (ISC) — the safe default.
- Phosphor (MIT) — six weights, biggest range.
- Tabler (MIT) — biggest count among stroke libraries.
- Heroicons (MIT) — best at 16 px.
- Radix Icons (MIT) — 300 icons, beautiful 15 × 15 design.
- Iconoir (MIT) — premium-feeling free hand.
- Material Symbols (Apache 2.0) — variable-font wizardry.
- Bootstrap Icons (MIT) — fine but generally beaten by the above.
- Octicons (MIT) — only if you want GitHub vibes.
- Carbon Icons (Apache 2.0) — IBM's 2,300+ design-system set.
- Feather (MIT) — paused; use Lucide instead.
- DuoIcons (MIT) — the only proper duotone open-source set besides Phosphor.
- Pixelarticons (MIT, 816 free, paid for full).

**Paid but worth it for visual character:**
- Streamline (~$19/mo or one-time) — universe-largest library, multiple aesthetic registers.
- Hugeicons Pro (~$99/year) — 51,000+ icons in 10 styles.
- Untitled UI Icons (~$149 lifetime) — designer-curated 4,600+ icons in 4 styles, the Figma-native cousin of Lucide.
- Lordicon Pro (~$39+/year) — the only large-scale animated icon library.
- Iconscout / Flaticon subscriptions — broad but uneven quality.

For EZvibes specifically, you can ship a maximum-pioneer vault for **$0** by combining Lucide + Heroicons Micro + Phosphor Duotone + Iconoir for hero + CSS morphs. The only paid additions worth a moment's thought are **Streamline Freehand** (for personality in empty states) and **Lordicon Pro** (only if you want full-Lottie morph animations rather than CSS draws).

---

## 13. Pioneer-level moves you can pull right now in EZvibes

Distilled from everything above, the highest-leverage things to do in the vault that would feel "2026 cutting-edge":

1. **Mix sources via `iconify-icon`** — a single web component swap lets you ship Phosphor, Lucide, Heroicons Micro, Tabler, Pixelarticons all under one tag. Few competing apps do this; it's a moat.
2. **Use Phosphor `weight` (or Material Symbols `FILL` axis) as a state machine** — pinned rows are `fill`, hover is `bold`, idle is `regular`. One library, no icon swap, no flicker.
3. **CSS-only checkmark draw-on after paste** — the cheapest, most premium-feeling micro-interaction in the book.
4. **Liquid-glass hero vault icon** — anchor the panel with one over-designed 4-layer SVG that screenshots beautifully.
5. **Per-row color tokens for Claude vs Codex tabs** — file icons in a Claude-active session glow amber on hover; Codex-active glows teal. Same icon, different `--icon-accent`.
6. **Pixelarticons easter egg** for the vault header when a hidden keybinding fires — pure delight, zero compatibility cost.
7. **Hand-off marker animation** — when another session writes a `hand-off.md` to the watched folder, the vault row appears with a Lordicon `magic-wand` morph or a CSS scale-in + amber pulse. The "live arrival" feeling is what makes the cross-session magic land.
8. **Variable-font morph instead of icon swap** for paste-confirm — Material Symbols `description → check_circle` with `FILL` interpolation reads more sophisticated than two crossfading PNGs.
9. **Drawn-on stroke for the active paste pulse** — give the paste button a `stroke-dasharray` outline that draws on every time you hover (Linear and Raycast both do this).
10. **Custom file-type ribbon strip down the row's left edge** — 3 px vertical color stripe per file type matches the icon's accent; eyes scan the strip before the icon, like Apple Mail's labels.

---

## 14. References / URLs (curated)

**Phosphor**
- Homepage: https://phosphoricons.com/
- Web (vanilla JS): https://github.com/phosphor-icons/web
- React: https://github.com/phosphor-icons/react
- Web Components: https://github.com/phosphor-icons/webcomponents
- npm `@phosphor-icons/web`: https://www.npmjs.com/package/@phosphor-icons/web

**Lucide**
- Homepage: https://lucide.dev/
- React guide: https://lucide.dev/guide/packages/lucide-react
- Vanilla JS guide: https://lucide.dev/guide/lucide
- Color/stroke docs: https://lucide.dev/guide/react/basics/color
- GitHub: https://github.com/lucide-icons/lucide

**Tabler**
- Homepage: https://tabler.io/icons
- GitHub: https://github.com/tabler/tabler-icons
- Docs (static SVG): https://docs.tabler.io/icons/static-files/svg

**Heroicons**
- Homepage: https://heroicons.com/
- GitHub: https://github.com/tailwindlabs/heroicons
- Micro tier announcement: https://tailwindcss.com/blog/heroicons-micro

**Iconify**
- Homepage: https://iconify.design/
- Icon sets: https://icon-sets.iconify.design/
- npm `iconify-icon`: https://www.npmjs.com/package/iconify-icon
- 2026 updates: https://iconify.design/news/2026.html

**Material Symbols**
- Guide: https://developers.google.com/fonts/docs/material_symbols
- npm `material-symbols`: https://www.npmjs.com/package/material-symbols
- GitHub: https://github.com/google/material-design-icons

**Radix Icons**
- Homepage: https://www.radix-ui.com/icons
- GitHub: https://github.com/radix-ui/icons

**Streamline**
- Homepage: https://www.streamlinehq.com/

**Iconoir**
- Homepage: https://iconoir.com/
- GitHub: https://github.com/iconoir-icons/iconoir

**Pixelarticons**
- Homepage: https://pixelarticons.com/
- GitHub: https://github.com/halfmage/pixelarticons

**Lordicon**
- Homepage: https://lordicon.com/
- Web docs: https://lordicon.com/docs/web
- Customization: https://lordicon.com/docs/customization-formats

**DuoIcons**
- Homepage: https://duoicons.vercel.app/

**SF Symbols 7 (reference only)**
- Homepage: https://developer.apple.com/sf-symbols/
- WWDC25 session: https://developer.apple.com/videos/play/wwdc2025/337/

**Untitled UI Icons**
- Homepage: https://www.untitledui.com/icons

**Hugeicons**
- Homepage: https://hugeicons.com/
- React docs: https://hugeicons.com/docs/integrations/react/quick-start

**Carbon Icons**
- Homepage: https://carbondesignsystem.com/elements/icons/code/
- GitHub: https://github.com/carbon-design-system/carbon-icons

**macOS Tahoe Liquid Glass icons**
- Apple Insider overview: https://appleinsider.com/articles/25/09/15/macos-tahoe-with-liquid-glass-clipboard-history-and-more-is-now-available
- Successful Software write-up: https://successfulsoftware.net/2025/09/26/updating-application-icons-for-macos-26-tahoe-and-liquid-glass/

**Comparison / context articles**
- Lucide vs Heroicons vs Phosphor 2026: https://www.pkgpulse.com/guides/lucide-vs-heroicons-vs-phosphor-react-icon-libraries-2026
- Best React Icon Libraries 2026 (Mighil): https://mighil.com/best-react-icon-libraries
- 25+ Best Open Source Icon Libraries 2026 (Hugeicons): https://hugeicons.com/blog/development/best-open-source-icon-libraries
- Best Free Icon Libraries 2026 (Muzli): https://muz.li/blog/best-free-icon-libraries-for-ui-design-in-2026/
- Best Icon Libraries for shadcn/ui 2026: https://iconsearch.info/blog/best-icons-for-shadcn-ui-2026
- All SVG Icons comparison tool: https://allsvgicons.com/compare/
- Iconography style trends 2026 (Envato): https://elements.envato.com/learn/icon-design-trends

**SVG patterns**
- currentColor pattern guide: https://mayashavin.com/articles/svg-icons-currentcolor
- Sprite vs inline (Cloud Four benchmarks): https://cloudfour.com/thinks/svg-icon-stress-test/
- SVG morphing guide: https://www.svggenie.com/blog/svg-animations-complete-guide

---

## 15. TL;DR for the orchestrator

For the EZvibes prompt vault, the optimal 2026 icon stack is a layered system: **Lucide** (via the vanilla `<i data-lucide="…">` loader) handles dense row-level file-type and action icons; **Heroicons Micro** handles 16 px hover-action affordances at hand-drawn precision; **Phosphor Duotone** handles the vault hero glyph and any "this is special" markers; and either **Iconify** (mix-and-match registry) or **Material Symbols** (variable font with FILL/wght/GRAD/opsz axes) handles the morph-on-hover/active-state magic without needing a Lottie runtime. The single most pioneer-level move is to **animate Material Symbols' `FILL` axis from 0 → 100** in 200 ms on hover/paste — true outline-to-filled morphing in one CSS line, no second icon, no JS, no third-party runtime. Pair this with a custom liquid-glass SVG vault hero icon and a `currentColor`-driven amber/teal palette tied to the active tab, and the vault will feel like it belongs in 2026 alongside Linear, Arc, and Raycast.
