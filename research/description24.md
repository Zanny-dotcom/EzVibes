# Research #24 — Markdown Vault UI Design: Obsidian, Logseq, Heynote, Bike, Anytype, iA Writer

> Focus: How the best local-first markdown apps of 2025-2026 design their **vault sidebars, file trees, hover previews, command palettes, and theme tokens** — and exactly which of those patterns and CSS tokens we should steal for the **EZvibes "Prompt Vault" panel**.

This report is intentionally exhaustive. Every important number, hex code, selector, and gesture is captured verbatim so the implementing agent can drop them into our Electron-vanilla-JS host without re-Googling. Each section closes with a **"Translate to EZvibes" note** that maps the technique onto the existing `renderer/` tree.

---

## TABLE OF CONTENTS

1. Why Obsidian is the design north star
2. Minimal (Kepano) — the most copied design system in markdown
3. Things 2 (Colin Eckert) — macOS-native polish
4. AnuPpuccin — rainbow folders + Catppuccin power
5. Catppuccin core palettes (Latte / Frappé / Macchiato / Mocha — full hex)
6. Sanctum — IBM Carbon-derived calm
7. ITS Theme (SlRvb) — readability fanatic
8. Shimmering Focus (pseudometa) — keyboard-only minimalism
9. Royal Velvet — programming-syntax-inspired moodboard
10. Obsidian file-explorer plumbing — every CSS variable + working snippets
11. Tree-view CSS recipes — borderless / dot / line / chip variants
12. Iconize + Iconic — adding emoji & Lucide icons in front of files
13. Banners — Notion-style banner image for the panel header
14. Hover Editor & Page Preview — floating pinnable preview popovers
15. Command palette design — Raycast, Linear, Superhuman lessons + Obsidian Cmd+P
16. Logseq — three-column layout & accent tokens
17. Heynote — block separators we should reuse for prompt cards
18. Bike Outliner — keyboard-first fold/focus interactions
19. Anytype — local-first graph mental model
20. iA Writer — Smart Folders & focus mode
21. Make.md / Obsidianotion — Notion-feel layering
22. Chokidar in Electron — file-watcher best-practices (the gluttonous trap)
23. Glassmorphism 2.0 (the 2026 pioneer-level layer)
24. Pioneer-level synthesis — the design we should ship in EZvibes
25. URL appendix

---

## 1. Why Obsidian is the design north star

Obsidian is an Electron 30+ app that ships a single sidebar with a recursive file tree, a tab strip, a hover-preview popover, and a `Ctrl/Cmd+P` command palette. Its **third-party theme ecosystem** (370+ community themes as of 2026) gives us a fully open, MIT/GPL-licensed buffet of CSS that we can lift wholesale. Every theme below is a public GitHub repo whose CSS we can grep verbatim.

The Obsidian community has converged on a small set of design-token namespaces that are now lingua franca across themes:

- `--background-primary` / `--background-secondary` / `--background-secondary-alt`
- `--text-normal` / `--text-muted` / `--text-faint` / `--text-accent` / `--text-accent-hover`
- `--interactive-normal` / `--interactive-hover` / `--interactive-accent`
- `--nav-item-padding` / `--nav-indentation-guide-width` / `--nav-indentation-guide-color`
- `--vault-profile-display` / `--vault-profile-color` / `--vault-profile-color-hover` / `--vault-profile-font-size` / `--vault-profile-font-weight` (these literally drive the bottom-of-sidebar "vault profile" element and the file-explorer label)

Adopting the same names in EZvibes would mean any user-supplied Obsidian CSS snippet drops into our Prompt Vault without modification — a genuinely pioneer-level move.

---

## 2. Minimal (Kepano) — the most copied design system in markdown

Minimal won Obsidian's official Best Theme award and is at v8.2.0 (May 12, 2026). Its core ideas:

### 2.1 Color philosophy

- **HSL-based** color variables (not raw hex). A single `--accent-h`, `--accent-s`, `--accent-l` triplet drives literally every accent-tinted element, so accent changes ripple coherently across selection, hover, link, scrollbar, etc.
- Light + dark **decoupled**: you pick a light scheme and a dark scheme independently. Built-in schemes: **Catppuccin, Dracula, Everforest, Gruvbox, macOS, Nord, Notion, Solarized, Things**.
- Three background-contrast levels: **low / standard / high**, plus **true black** OLED mode (`#000000` everywhere). This is achieved with three sibling CSS classes on `body`.

### 2.2 Spacing & typography

- Line-width controls (default **88% max-width**) — directly settable per file via `cssclass: max` / `cssclass: wide` / `cssclass: 100`.
- Font-size adjustable in 1px steps via Minimal Settings.
- Font picks: **iA Writer Quattro** / **Inter** / **system-ui** for body; **JetBrains Mono** / **Fira Code** for code.

### 2.3 The "colorful frame"

A single `body.colorful-frame` toggles a 4px-tall accent-colored bar across the top window chrome. Cheap, instantly recognizable. We could put this above the Prompt Vault panel header and tint it per-tab (Claude amber vs Codex teal).

### 2.4 Cards & callouts

Minimal's `cards` CSS class turns lists of links into a responsive grid (1–8 columns via `cards-cols-N`). The same class with `cards-cover` makes the linked file's banner image the card thumbnail. **This is exactly the visual we want for a grid view of prompt cards.** The mental model: a Pinterest-board grid of `.md` files.

### 2.5 Translate to EZvibes

We already have an `ezvibes` accent. Steal:

- The HSL accent triplet pattern
- The 3-level contrast classes
- The `cards-cols-N` grid system for a future "Prompt Vault Gallery" view

---

## 3. Things 2 (Colin Eckert) — macOS-native polish

Things 2 is an Obsidian theme inspired by the macOS task-manager *Things 3* by Cultured Code. Key takeaways:

- Inherits Minimal's base, adds **Things-flavored color tokens** (a soft blue-grey background, signature blue accent ~`#3478f6`).
- Custom **checkbox glyphs**: 16+ statuses (`[x]`, `[/]`, `[?]`, `[!]`, `[-]`, `[*]`, etc.) each render as a real SF-Symbols-ish vector glyph.
- The **Floating Action Button** in the bottom-right corner — a circular FAB with the accent color, used in Things for "+ New". Excellent precedent for a "+ New Prompt" FAB in our vault.
- Style Settings exposes the bold / italic / highlighter / blockquote colors individually.

### Translate to EZvibes

Add a small FAB-style **"Paste current terminal output to .md"** button anchored to the vault panel bottom-right. Same color as the active agent's chip (amber/teal).

---

## 4. AnuPpuccin — rainbow folders + Catppuccin power

AnuPpuccin (by AnubisNekhet) is the wildest, most-configured theme. Key tech:

### 4.1 Rainbow folder snippet (mechanism)

A single CSS file with hundreds of `nth-child(Nn+M)` selectors. Toggleable for:

- **Full Rainbow** — every level recolored (depth-aware).
- **Simple Rainbow** — only first level / direct children.
- Configurable repeat count (1–11) and per-position color (15 choices: Accent / Rosewater / Flamingo / Pink / Mauve / Red / Maroon / Peach / Yellow / Green / Teal / Sky / Sapphire / Blue / Lavender).

The selector pattern:

```css
body.rainbow-repeat-11.rainbow-color-1-accent
  .nav-folder-children > .nav-folder:nth-child(11n+2) {
  --rainbow-folder-color: var(--ctp-accent);
}

.nav-folder[style*="--rainbow-folder-color"] .nav-folder-title-content {
  color: var(--rainbow-folder-color);
}
.nav-folder[style*="--rainbow-folder-color"] .nav-folder-title {
  border-left: 2px solid var(--rainbow-folder-color);
}
```

### 4.2 Custom collapse icon (forum-popular)

Replaces Obsidian's default `>` collapse triangle with an arrow:

```css
.nav-folder-collapse-indicator::after {
  position: absolute;
  content: "↓";
  left: -15px;
  top: -2px;
  font-size: 15px;
  font-weight: bold;
  transition: transform 10ms linear 0s;
}
.is-collapsed .nav-folder-collapse-indicator::after {
  content: "🠖";
}
```

### 4.3 Coloured-frame, custom callouts, seamless embeds

The `![[embed|seamless]]` syntax modifier strips the embed's frame so it bleeds into the page. Useful idea for previewing a `.md` *inside* the vault panel without a card border.

### Translate to EZvibes

Implement an **optional "Rainbow Hand-offs" mode** for our vault. Every `hand-off-N.md` file gets a different color so the eye can find the right one instantly. Use the AnuPpuccin formula but only on files at the top level of the vault folder.

---

## 5. Catppuccin — full hex palettes (the de-facto standard)

Catppuccin is now the single most-cited "good defaults" palette in the entire markdown/dev-tool ecosystem. Adopting it means every EZvibes user already has muscle memory for these colors. Full hex (verbatim from `catppuccin.com/palette`):

### Latte (light)

| Token | Hex | | Token | Hex |
|-|-|-|-|-|
| Rosewater | `#dc8a78` | | Surface 0 | `#ccd0da` |
| Flamingo  | `#dd7878` | | Surface 1 | `#bcc0cc` |
| Pink      | `#ea76cb` | | Surface 2 | `#acb0be` |
| Mauve     | `#8839ef` | | Overlay 0 | `#9ca0b0` |
| Red       | `#d20f39` | | Overlay 1 | `#8c8fa1` |
| Maroon    | `#e64553` | | Overlay 2 | `#7c7f93` |
| Peach     | `#fe640b` | | Subtext 0 | `#6c6f85` |
| Yellow    | `#df8e1d` | | Subtext 1 | `#5c5f77` |
| Green     | `#40a02b` | | Text      | `#4c4f69` |
| Teal      | `#179299` | | Base      | `#eff1f5` |
| Sky       | `#04a5e5` | | Mantle    | `#e6e9ef` |
| Sapphire  | `#209fb5` | | Crust     | `#dce0e8` |
| Blue      | `#1e66f5` | | | |
| Lavender  | `#7287fd` | | | |

### Frappé (dark, warm)

| Token | Hex | | Token | Hex |
|-|-|-|-|-|
| Rosewater | `#f2d5cf` | | Surface 0 | `#414559` |
| Flamingo  | `#eebebe` | | Surface 1 | `#51576d` |
| Pink      | `#f4b8e4` | | Surface 2 | `#626880` |
| Mauve     | `#ca9ee6` | | Overlay 0 | `#737994` |
| Red       | `#e78284` | | Overlay 1 | `#838ba7` |
| Maroon    | `#ea999c` | | Overlay 2 | `#949cbb` |
| Peach     | `#ef9f76` | | Subtext 0 | `#a5adce` |
| Yellow    | `#e5c890` | | Subtext 1 | `#b5bfe2` |
| Green     | `#a6d189` | | Text      | `#c6d0f5` |
| Teal      | `#81c8be` | | Base      | `#303446` |
| Sky       | `#99d1db` | | Mantle    | `#292c3c` |
| Sapphire  | `#85c1dc` | | Crust     | `#232634` |
| Blue      | `#8caaee` | | | |
| Lavender  | `#babbf1` | | | |

### Macchiato (dark, cool)

| Token | Hex | | Token | Hex |
|-|-|-|-|-|
| Rosewater | `#f4dbd6` | | Surface 0 | `#363a4f` |
| Flamingo  | `#f0c6c6` | | Surface 1 | `#494d64` |
| Pink      | `#f5bde6` | | Surface 2 | `#5b6078` |
| Mauve     | `#c6a0f6` | | Overlay 0 | `#6e738d` |
| Red       | `#ed8796` | | Overlay 1 | `#8087a2` |
| Maroon    | `#ee99a0` | | Overlay 2 | `#939ab7` |
| Peach     | `#f5a97f` | | Subtext 0 | `#a5adcb` |
| Yellow    | `#eed49f` | | Subtext 1 | `#b8c0e0` |
| Green     | `#a6da95` | | Text      | `#cad3f5` |
| Teal      | `#8bd5ca` | | Base      | `#24273a` |
| Sky       | `#91d7e3` | | Mantle    | `#1e2030` |
| Sapphire  | `#7dc4e4` | | Crust     | `#181926` |
| Blue      | `#8aadf4` | | | |
| Lavender  | `#b7bdf8` | | | |

### Mocha (dark, deepest — recommended default for EZvibes)

| Token | Hex | | Token | Hex |
|-|-|-|-|-|
| Rosewater | `#f5e0dc` | | Surface 0 | `#313244` |
| Flamingo  | `#f2cdcd` | | Surface 1 | `#45475a` |
| Pink      | `#f5c2e7` | | Surface 2 | `#585b70` |
| Mauve     | `#cba6f7` | | Overlay 0 | `#6c7086` |
| Red       | `#f38ba8` | | Overlay 1 | `#7f849c` |
| Maroon    | `#eba0ac` | | Overlay 2 | `#9399b2` |
| Peach     | `#fab387` | | Subtext 0 | `#a6adc8` |
| Yellow    | `#f9e2af` | | Subtext 1 | `#bac2de` |
| Green     | `#a6e3a1` | | Text      | `#cdd6f4` |
| Teal      | `#94e2d5` | | Base      | `#1e1e2e` |
| Sky       | `#89dceb` | | Mantle    | `#181825` |
| Sapphire  | `#74c7ec` | | Crust     | `#11111b` |
| Blue      | `#89b4fa` | | | |
| Lavender  | `#b4befe` | | | |

### Mapping to EZvibes semantics (suggested)

```css
:root.theme-dark {
  /* Catppuccin Mocha */
  --vault-bg:           #11111b; /* crust  */
  --vault-bg-elev:      #181825; /* mantle */
  --vault-bg-card:      #1e1e2e; /* base   */
  --vault-bg-card-hov:  #313244; /* surface0 */
  --vault-divider:      #45475a; /* surface1 */
  --vault-text:         #cdd6f4; /* text   */
  --vault-text-mute:    #a6adc8; /* subtext0 */
  --vault-text-faint:   #7f849c; /* overlay1 */
  --vault-accent:       #f9e2af; /* yellow  — matches ezvibes */
  --vault-accent-claude:#fab387; /* peach  */
  --vault-accent-codex: #94e2d5; /* teal   */
  --vault-success:      #a6e3a1; /* green  */
  --vault-warning:      #fab387; /* peach  */
  --vault-error:        #f38ba8; /* red    */
}
```

These are real, tested, beautiful, and require zero color decisions from us.

---

## 6. Sanctum — IBM Carbon-derived calm

Sanctum (by jdanielmourao) is built **literally on IBM Carbon Design System's grid, scale, animation curves, and color choices**. Decisions worth borrowing:

- **One font family only**: IBM Plex (Sans / Mono / Serif). No mixing.
- **Same background color across every element** — no chrome separation. A radical "no layers" choice that produces a Zen feel.
- IBM Carbon icon library (open-source SVGs).
- Multi-color highlight system: yellow, blue, pink with auto-contrast text.
- Images **desaturated by default**, restored on hover (`filter: grayscale(1) → grayscale(0)`, `transition: 200ms`).
- Heading sizes scale **fluidly** across viewport sizes via `clamp()`.

This is a precedent for a **calm/no-chrome mode** in our Prompt Vault — handy for big screens where you just want to read.

---

## 7. ITS Theme (SlRvb) — readability fanatic

ITS Theme prioritizes **information density + readability**:

- **Squared edges** everywhere (zero border-radius).
- **Heading underlines** that span the full content column, varying per `h1..h6`.
- **Indent guides for bullet lists, outline panes, folder navigation, AND tag panes** — and *connected* to one another with vertical relationship lines. This is the canonical "JetBrains-style indent guides" execution in Obsidian.
- Fonts: **Calisto MT** for headings; **JetBrains Mono Medium** / **Recursive Mono Casual** for code.
- "Text wrapping" toggle for outline panes, tag panes, file explorer, and embed titles — so long names actually wrap instead of getting cut with ellipsis.

### Translate to EZvibes

Our Prompt Vault should ALWAYS wrap long file names with `word-break: break-word; hyphens: auto;` rather than ellipsis-truncating them. Hand-off files often have long descriptive names.

---

## 8. Shimmering Focus (pseudometa) — keyboard-only minimalism

Winner of Obsidian October 2022, 10th most-downloaded theme. Design rules:

- The **tab bar appears only when more than one tab is open**. Single-tab = zero chrome.
- **Sidebar buttons hidden by default, fade in on hover** of the sidebar (using `opacity: 0; transition: opacity 200ms; .nav:hover & { opacity: 1; }` pattern).
- All UI elements not needed for keyboard nav are removed or `display: none`.
- 100+ Style Settings toggles.
- `h6` blocks become an admonition box (clever recycling of header levels).
- Code blocks always have line numbers.
- Images zoom on click.

### Translate to EZvibes

The "fade-in-on-hover sidebar" pattern is **gold** for the Prompt Vault. When the terminal is the focus, the vault sidebar fades to 30% opacity. Mouse anywhere over it → 100%. No layout shift, just a softening of the visual weight.

---

## 9. Royal Velvet — programming-syntax-inspired moodboard

Royal Velvet is a smaller theme inspired by **the colors of Royal Velvet Obsidian (the rock)** and **syntax-highlighting themes**. Notable Style Settings tokens:

- Inline document title color modes: same-as-heading / disabled / custom / **rainbow**.
- Dark + light support.
- v0.11.8 (Nov 22, 2024), MIT.

The moodboard direction here is "deep purple + bright accent" — feels like a Codex / nighttime / focus session. Not a wholesale steal, but worth referencing for an EZvibes "Codex Theme" preset.

---

## 10. Obsidian file-explorer plumbing — CSS variables + working snippets

### 10.1 Native vault-profile / file-explorer CSS variables

| Variable | Purpose |
|----------|---------|
| `--vault-profile-display` | Show/hide the vault-profile element (`flex` / `none`) |
| `--vault-profile-actions-display` | Show/hide its action buttons |
| `--vault-profile-font-size` | Font size for vault profile text |
| `--vault-profile-font-weight` | Font weight |
| `--vault-profile-color` | Text color |
| `--vault-profile-color-hover` | Hover text color |
| `--nav-item-padding` | Padding of each file/folder row |
| `--nav-item-color` / `--nav-item-color-hover` / `--nav-item-color-active` | Row text colors |
| `--nav-item-background-hover` / `--nav-item-background-active` | Row bg colors |
| `--nav-indentation-guide-width` | Indent-guide line width (commonly 1–2px) |
| `--nav-indentation-guide-color` | Indent-guide color |
| `--nav-collapse-icon-color` | Color of the `>` chevron |
| `--nav-heading-color` | "Folders" section heading |

Obsidian's file explorer shares these variables with the "vault profile" component, so customizing one cascades to both.

### 10.2 Working compact-file-explorer snippet (Obsidian forum classic)

```css
/* Compact + clean file explorer */
.workspace-leaf-content[data-type="file-explorer"] .nav-files-container {
  padding: 4px 8px;
}

.nav-folder-title,
.nav-file-title {
  padding: 2px 8px;
  font-size: 13px;
  line-height: 1.4;
  border-radius: 4px;
  transition: background-color 80ms ease;
}

.nav-folder-title:hover,
.nav-file-title:hover {
  background-color: var(--background-modifier-hover);
}

.nav-file-title.is-active {
  background-color: var(--background-modifier-active-hover);
  color: var(--text-accent);
}

/* Dot-marker for open folders instead of triangle */
.nav-folder-collapse-indicator { display: none; }
.nav-folder.is-collapsed > .nav-folder-title::before { content: "▸  "; opacity: .45; }
.nav-folder:not(.is-collapsed) > .nav-folder-title::before { content: "▾  "; opacity: .65; }

/* Indent guides */
.nav-folder-children {
  position: relative;
  padding-left: 12px;
}
.nav-folder-children::before {
  content: "";
  position: absolute;
  left: 6px; top: 0; bottom: 6px;
  width: 1px;
  background: var(--background-modifier-border);
  opacity: .6;
}
```

### 10.3 Vault-profile (sidebar bottom) hide

```css
/* Hide vault profile in Obsidian */
:root { --vault-profile-display: none; }
```

### 10.4 Hide indent guides entirely

```css
.nav-folder-children { padding-inline-start: 0; }
.nav-folder-children::before,
.nav-folder-children::after { display: none; }
```

### 10.5 Add a dotted indent guide

```css
.nav-folder-children::before {
  background-image: linear-gradient(to bottom,
    var(--background-modifier-border) 0,
    var(--background-modifier-border) 4px,
    transparent 4px,
    transparent 8px
  );
  background-size: 1px 8px;
  background-color: transparent;
}
```

---

## 11. Tree-view CSS recipes — borderless / dot / line / chip

### 11.1 The Kate Morley canonical tree (the one every blog plagiarizes)

```css
.tree {
  --spacing: 1.5rem;
  --radius: 10px;
}
.tree li {
  display: block;
  position: relative;
  padding-left: calc(2 * var(--spacing) - var(--radius) - 2px);
}
.tree ul {
  margin-left: calc(var(--radius) - var(--spacing));
  padding-left: 0;
}
.tree ul li {
  border-left: 2px solid #ddd;
}
.tree ul li:last-child {
  border-color: transparent;
}
.tree ul li::before {
  content: '';
  display: block;
  position: absolute;
  top: calc(var(--spacing) / -2);
  left: -2px;
  width: calc(var(--spacing) + 2px);
  height: calc(var(--spacing) + 1px);
  border: solid #ddd;
  border-width: 0 0 2px 2px;
}
.tree summary {
  display: block;
  cursor: pointer;
}
.tree summary::marker,
.tree summary::-webkit-details-marker { display: none; }
.tree summary:focus { outline: none; }
.tree summary:focus-visible { outline: 1px dotted #000; }
.tree li::after,
.tree summary::before {
  content: '';
  display: block;
  position: absolute;
  top: calc(var(--spacing) / 2 - var(--radius));
  left: calc(var(--spacing) - var(--radius) - 1px);
  width: calc(2 * var(--radius));
  height: calc(2 * var(--radius));
  border-radius: 50%;
  background: #ddd;
}
.tree summary::before {
  z-index: 1;
  background: #696 url('expand-collapse.svg') 0 0;
}
.tree details[open] > summary::before {
  background-position: calc(-2 * var(--radius)) 0;
}
```

This produces **circular bullet markers with hairline L-connectors** — a classic, but feels dated. We can use the same `border-left` + pseudo-element math with a **single hairline only** (no circles) for a cleaner Obsidian-style look.

### 11.2 JetBrains-style indent guides (recommended for EZvibes)

```css
.vault-tree {
  --vault-indent: 16px;
  --vault-guide-color: rgba(205, 214, 244, 0.08);
  --vault-guide-color-hover: rgba(249, 226, 175, 0.30);
}

.vault-tree li ul {
  position: relative;
  padding-left: var(--vault-indent);
}
.vault-tree li ul::before {
  content: '';
  position: absolute;
  inset: 0 auto 8px 6px;
  width: 1px;
  background: var(--vault-guide-color);
  transition: background 150ms ease;
}
.vault-tree li ul:hover::before {
  background: var(--vault-guide-color-hover);
}
```

This is the **"highlight the guide line on parent hover"** trick that JetBrains IDEs use. Immediately reads as a 2026 IDE.

---

## 12. Iconize + Iconic — adding emoji & Lucide icons in front of files

### 12.1 Iconize (FlorianWoelki) — *now deprecated but the canonical implementation*

- Add **any custom SVG** or icon-pack icon before file/folder names.
- Frontmatter integration: `---\nicon: file-text\n---` and the icon appears.
- Per-icon color override.
- Title icon positioning above note headings.

### 12.2 Iconic (gfxholo) — *active successor in 2025-2026*

- 1,700+ **Lucide** icons baked in.
- 1,900+ **emoji** browser.
- **9 theme-responsive colors per icon** that automatically follow the active vault's CSS theme (uses CSS variables, not hex).
- **Rulebook engine** — automate icon assignment based on:
  - File name pattern
  - Extension
  - Parent folder
  - Tags
  - Property values
  - Created / modified date
  - Current time of day (!)
- Click any icon on a tab / sidebar / ribbon / title bar to swap it inline. Secondary-click for color picker.
- Multi-select via `Alt` / `Shift` for bulk icon application.

### Translate to EZvibes

Build the same rule engine. For our vault that means:

```js
const ICONIC_RULES = [
  { match: /^hand-off.*\.md$/i,    icon: 'arrow-right-left',  color: 'peach'   },
  { match: /^CLAUDE\.md$/,         icon: 'sparkles',          color: 'yellow'  },
  { match: /^prompt-.*\.md$/i,     icon: 'message-square',    color: 'mauve'   },
  { match: /^plan-.*\.md$/i,       icon: 'clipboard-list',    color: 'blue'    },
  { match: /^spec-.*\.md$/i,       icon: 'file-text',         color: 'teal'    },
  { match: /^README\.md$/i,        icon: 'book-open',         color: 'green'   },
];
```

Lucide icons are inline SVG strings, MIT-licensed, ship as a single ~700KB JSON.

### 12.3 Adding Lucide via pure CSS (no plugin)

```css
.vault-file[data-name$=".md"] .vault-file-name::before {
  content: "";
  display: inline-block;
  width: 14px; height: 14px;
  margin-right: 6px;
  background-color: currentColor;
  -webkit-mask-image: url('lucide/file-text.svg');
          mask-image: url('lucide/file-text.svg');
  -webkit-mask-size: contain;
          mask-size: contain;
}

.vault-file[data-name^="hand-off"] .vault-file-name::before {
  -webkit-mask-image: url('lucide/arrow-right-left.svg');
          mask-image: url('lucide/arrow-right-left.svg');
  color: #fab387; /* peach */
}
```

Using `mask-image` lets the SVG inherit `currentColor`, which is exactly how Obsidian themes do per-theme icon tints.

---

## 13. Banners — Notion-style banner image for the panel header

The community Banners plugin stores config in YAML frontmatter:

```yaml
---
banner: "assets/wallpaper.jpg"
banner_x: 0.5          # 0..1, horizontal focus
banner_y: 0.3          # 0..1, vertical focus
banner_lock: true
banner_style: gradient # solid | gradient (gradient fades to transparent)
---
```

Two styles: **solid** (sharp container) or **gradient** (fades into transparency).

Implementation core (simplified):

```css
.note-banner-wrap {
  position: relative;
  height: var(--banner-h, 180px);
  margin: -16px -16px 24px;
  overflow: hidden;
  isolation: isolate;
}
.note-banner-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: calc(var(--bx) * 100%) calc(var(--by) * 100%);
}
.note-banner-wrap[data-style="gradient"]::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(to bottom, transparent 40%, var(--background-primary));
  pointer-events: none;
}
```

### Translate to EZvibes

Give the Prompt Vault panel a tiny **banner strip** at the top (~80px) that reads from `vault/.EZvibes-banner.png` if present. Falls back to a procedural gradient otherwise. Lets users brand their vault per project.

---

## 14. Hover Editor & Page Preview — floating pinnable preview popovers

The **Hover Editor** plugin (nothingislost) is technically jaw-dropping. It:

1. Extends Obsidian's built-in `HoverPopover` class via prototype-based inheritance.
2. Uses **interact.js** for drag + resize.
3. Implements **snap-to-screen-edges**, **pin** (popover persists until closed), **minimize**, and **convert-to-workspace-leaf**.
4. Each popover gets a **full Markdown editor instance**, not a static preview.

The 2025 update (Ellane W, Dec 1 2025): "Standardize mouse hover + Ctrl for hover preview" — the gesture is **hold Ctrl + hover** for popover (without Ctrl, no popover, avoiding accidental triggers).

### Translate to EZvibes — THE BIG ONE

Our Prompt Vault should support **Ctrl-hover → popover preview** of any `.md` file. The popover should be:

- 480×320px default
- Draggable by header
- Resizable from bottom-right corner
- "Pin" button → popover persists; can drag away from sidebar
- "Paste" button → injects content into the active terminal tab via existing `terminal:input` IPC channel

Implementation: a normal `position: fixed` div with `pointerdown` drag handler. We don't need `interact.js`; ~80 LOC of vanilla JS gets us there.

---

## 15. Command palette design — Raycast, Linear, Superhuman + Obsidian Cmd+P

Obsidian's command palette (Cmd/Ctrl+P) is itself worth designing toward. **Key obsidian behavior**:

- v1.8.3+: **Recently used commands** sit at the top.
- **Pinnable** commands stay at the top permanently.
- **Fuzzy match by both label and command-id** (better-command-palette plugin adds this).
- Recent + fuzzy = good defaults.

### Raycast design system (extracted from Raycast's marketing-site dump)

**Dark-canvas surface ladder** (no shadows, all elevation = color):

```css
:root {
  --rc-canvas:           #07080a;
  --rc-surface:          #0d0d0d;
  --rc-surface-elev:     #101111;
  --rc-surface-card:     #121212;

  --rc-ink:              #f4f4f6;
  --rc-body:             #cdcdcd;
  --rc-charcoal:         #d3d3d4;
  --rc-mute:             #9c9c9d;
  --rc-ash:              #6a6b6c;
  --rc-stone:            #434345;

  --rc-hairline:         #242728;
  --rc-hairline-soft:    rgba(255,255,255,0.08);
  --rc-hairline-strong:  rgba(255,255,255,0.16);

  --rc-accent-blue:      #57c1ff;
  --rc-accent-red:       #ff6161;
  --rc-accent-green:     #59d499;
  --rc-accent-yellow:    #ffc533;
}
```

**Border radius scale**:
- xs `4px` — keycaps, badges
- sm `6px` — command-palette rows
- md `8px` — buttons, inputs, app-icon tiles
- lg `10px` — feature cards, palette container
- xl `16px` — hero mockups
- full `9999px` — pills

**Typography**: Inter with `font-feature-settings: "calt", "kern", "liga", "ss03";`. The `ss03` set is what gives Raycast its iconic single-story `g`.

**Spacing**: 8px base unit. Tokens: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 96.

**Touch targets**: 36px min height (WCAG AA). Search bars 44px (AAA).

**Elevation philosophy**: **No drop shadows.** Depth is built entirely from the surface-color ladder.

### Linear's command palette (Cmd+K) lessons

- **LCH color space** (not HSL) for perceptual uniformity. Yellow and red with lightness 50 look equally bright. We don't need to ship LCH but it's worth knowing.
- Cmd+K modal is **lighter than its background** to feel "foreground."
- Subtle **glass / backdrop-filter** on the modal (real glassmorphism, see §23).

### Superhuman's "build a remarkable command palette" rules

1. **Universal availability**: one shortcut, everywhere. Captures at app-top focus.
2. **Centralization**: every command lives here.
3. **Omnipotence**: decouple command from UI; add from any module.
4. **Fuzzy with threshold ~0.0015** (command-score lib).
5. **Aliases & synonyms**: `"Mark Done (Archive)"` shows both names.
6. **Relevance scoring**: default weights × context multipliers × "follow" relationships.
7. **Visually imposing**: center it, large, monospaced or generous spacing. Show **5+ items with intentional cut-off** so it feels infinite.
8. **Per-command icon** for instant visual recognition.
9. **Context filtering**: hide irrelevant commands (e.g., "Send" only when draft is focused).

### Translate to EZvibes

Add `Ctrl+P` (or `Ctrl+/`) inside any session window → opens an **Obsidian-style palette** centered on the terminal. Commands include:

- Every `.md` file in the vault (action: "Paste this prompt")
- Recently pasted prompts (with last-paste timestamp)
- "Open Vault Folder in Explorer"
- "Create New Hand-off"
- "Copy current terminal buffer to clipboard"

Use fuzzy-match (no library; ~30 lines of JS). Surface palette with Raycast tokens + Mocha palette colors.

---

## 16. Logseq — three-column layout & accent tokens

Logseq's UI is built on:

- **Three-column layout**: left sidebar (favorites/recents), center content, right sidebar (referenced blocks, page graph, plugin context).
- **CSS custom-property tiers** with prefixes:
  - `--rx-*` → base Radix UI palette values
  - `--lx-*` → component-themed colors
  - `--ls-*` → legacy backwards-compatible variables
- Left sidebar width: `--ls-left-sidebar-width: 240px` (default desktop). When closed, `translate-x: -100%` transition.
- **Radix UI accent system** — 15 color options + "none" + "logseq" (classic teal). Same Radix scale we see in Linear and ShadCN.
- **Theme management** = updating DOM attributes. JS:
  ```js
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.dataset.accent = 'teal';
  ```
- **Block indentation** uses `.block-children-container` for padding, `.block-children-left-border` for the collapse line, `.block-control-wrap` for bullet indicators.

### Translate to EZvibes

A **right-side Prompt Vault** mirrors Logseq's right sidebar idiom. Toggleable. Same 240px default width with drag-to-resize.

---

## 17. Heynote — block separators we should reuse for prompt cards

Heynote (Jonatan Heyman, BSD-3) is a **single-buffer scratchpad** built on **CodeMirror 6 + Vue 3 + Electron**. ~63% JS, ~31% Vue, ~1% Sass.

- Buffer divided into **blocks** by Cmd+Enter.
- Each block has its own **language mode**: C++, C#, Clojure, CSS, Elixir, Erlang, Dart, Go, Groovy, HTML, Java, JavaScript, JSX, Kotlin, TypeScript, TOML, TSX, JSON, Markdown, PHP, Python, Ruby, Rust, Scala, Shell, SQL, Swift, Vue, XML, YAML.
- **Math/calculator** block via Math.js (incl. currency conversion).
- **Auto-language-detect** on paste.
- Multi-cursor, dark/light, spellcheck, **emacs-like or custom** keybindings.

**Block-delimiter shortcuts**:
- `Cmd+Enter` — new block below
- `Cmd+Opt+Enter` — split at cursor
- `Cmd+L` — change block language
- `Cmd+↓` / `Cmd+↑` — jump to next/prev block
- `Cmd+Opt+.` — fold block

Notes stored at:
- macOS: `~/Library/Application Support/Heynote/notes/`
- Windows: `%APPDATA%\Heynote\notes\`
- Linux: `~/.config/Heynote/notes/`

Images live in a hidden `.images/` subdir with **auto-cleanup of unreferenced files older than 24h** — a clever housekeeping detail.

### Translate to EZvibes

Treat each prompt `.md` file in the vault as a **Heynote-style block** in the right sidebar. Render with CodeMirror. Each block has a language pill (`md`, `txt`, `sh`) and a "paste" button. The horizontal separators between blocks should be **soft, ~24px tall, with a centered button row**:

```css
.vault-block + .vault-block {
  position: relative;
  margin-top: 24px;
}
.vault-block + .vault-block::before {
  content: "";
  position: absolute;
  inset: -12px 16px auto 16px;
  height: 1px;
  background: linear-gradient(to right,
    transparent,
    var(--vault-divider) 20%,
    var(--vault-divider) 80%,
    transparent
  );
}
```

---

## 18. Bike Outliner — keyboard-first fold/focus interactions

Bike (Hog Bay Software, macOS native) is **the** keyboard-first outliner. Lessons:

- **Fold + Focus** as separate gestures. Folding collapses children; focusing **hides everything else in the document**, zooming to a sub-outline.
- **Outline Mode** toggle (Esc): the cursor becomes a row-selector. Left/Right arrows = collapse/expand. Up/Down = navigate rows.
- **Navigation bar**: Go Home / Go Back / Go Forward — pure breadcrumb stack, no mouse needed.
- **Focus In** arrows on parent rows when zoomed; **Focus Out** arrows when zoomed in.
- Tab / Shift-Tab = indent / outdent.
- **Apple Shortcuts integration** — every action available from a no-UI scripted call.

### Translate to EZvibes

Add a **Focus mode** to the Prompt Vault: clicking a folder zooms the sidebar into just that folder's contents, hiding the rest of the tree. Press `Esc` to go back. Press `→` on a folder to enter, `←` on any file to exit. Treat the sidebar as a stack-based UI.

---

## 19. Anytype — local-first knowledge graph mental model

Anytype is local-first + P2P-sync + **CRDT-based** (Conflict-Free Replicated Data Types). Notable design choices:

- **Spaces** as the top-level concept (analogous to our "session window per folder").
- **Object-based** organization (every note is a typed Object) — closer to Notion than to a filesystem.
- **Graph view** of the whole space.
- Views per Object collection: Grid / List / Gallery / Kanban.
- Privacy-first: data **encrypted at rest with user-held key**, sync over P2P.

This isn't a model we'd adopt wholesale, but the **Gallery view** of objects (with thumbnails, tags, and titles) is a strong precedent for a "Prompt Gallery" mode of our vault.

---

## 20. iA Writer — Smart Folders & focus mode

iA Writer (iA, mac/iOS/Win) is the cleanest distraction-free markdown editor. Notable:

- **Focus Mode**: Sentence / Paragraph / Typewriter. Everything except the active line is dimmed (~40% opacity).
- **Smart Folders**: dynamic folders that auto-populate based on **hashtags + frontmatter rules**. New files matching the rule appear automatically.
- **Auto Markdown** — markdown rendering happens *as you type*, in-place, without leaving the keyboard.
- **Organizer** sidebar with: Locations (iCloud / Dropbox / Google Drive / local) + Favorites + Smart Folders + Hashtags.
- No buttons, no panels — minimalism to the point of austerity.

### Translate to EZvibes

Add **Smart Folders** to the vault:
- "Hand-offs" — auto-list every `hand-off-*.md` file across all subdirs
- "Today's Files" — files modified in the last 24h (great for spotting fresh hand-offs from background agents)
- "CLAUDE.md files" — all `CLAUDE.md` files in the project, anywhere
- "Pinned" — user-pinned files

Each smart folder is just a saved glob + sort. Live-updated by the chokidar watcher.

---

## 21. Make.md / Obsidianotion — Notion-feel layering

Make.md adds a Notion-style layer on top of Obsidian: **Spaces (databases), Properties, Lists, Tags, and inline blocks**. Obsidianotion is a CSS theme that makes the rest look like Notion.

### Translate to EZvibes

We don't need a full Notion-clone. But the **rounded card style** with subtle shadow is what people expect in 2026. Use it for prompt cards in the gallery view:

```css
.prompt-card {
  background: var(--vault-bg-card);
  border: 1px solid var(--vault-divider);
  border-radius: 10px;
  padding: 16px;
  transition: transform 100ms ease, box-shadow 100ms ease, border-color 100ms ease;
}
.prompt-card:hover {
  transform: translateY(-2px);
  border-color: var(--vault-accent);
  box-shadow: 0 8px 24px -8px rgba(0,0,0,0.5);
}
```

---

## 22. Chokidar in Electron — file-watcher best-practices

The library that makes "live vault" possible. ~30M downloads/repo deployments, written by Paul Millr.

```js
// main.js (renderer cannot touch chokidar directly)
const chokidar = require('chokidar');

const watcher = chokidar.watch(vaultPath, {
  ignored:        /(^|[\/\\])\../, // dotfiles
  persistent:     true,
  ignoreInitial:  false,           // emit 'add' for files already present
  awaitWriteFinish: {
    stabilityThreshold: 200,  // ms of no-writes before considering file done
    pollInterval: 50
  },
  depth:          5,    // don't recurse forever
  usePolling:     false // native fs.watch; flip to true on WSL
});

watcher
  .on('add',       p => send('vault:add',       p))
  .on('change',    p => send('vault:change',    p))
  .on('unlink',    p => send('vault:unlink',    p))
  .on('addDir',    p => send('vault:add-dir',   p))
  .on('unlinkDir', p => send('vault:unlink-dir',p))
  .on('error',     e => console.error('vault watcher', e))
  .on('ready',     () => send('vault:ready'));
```

**Trap to avoid**: chokidar will silently hammer CPU if you watch a folder containing `node_modules/`, build outputs, or `.git/`. ALWAYS pass an `ignored` pattern. The Hendrik Erz "horror story" blog post documents how a misconfigured watcher will eat 100% CPU on Electron + ASAR packaging.

**ASAR caveat**: chokidar uses native bindings indirectly through `fs`; if you bundle with ASAR you don't need to unpack chokidar itself (pure JS) but you must verify your build doesn't drop the fsevents native module.

### Renderer-side animation hook

When a new file appears, animate it in. Listen for `vault:add` in renderer, find the matching DOM row, and play a CSS class:

```css
.vault-file.is-new {
  animation: vault-pop 380ms cubic-bezier(.34,1.56,.64,1) both;
  background: color-mix(in srgb, var(--vault-accent) 18%, transparent);
}
@keyframes vault-pop {
  0%   { opacity: 0; transform: translateX(-8px) scale(.98); }
  60%  { opacity: 1; transform: translateX(0)    scale(1.02); }
  100% { opacity: 1; transform: translateX(0)    scale(1);    background: transparent; }
}
```

Then `setTimeout(() => row.classList.remove('is-new'), 1400);`.

**For hand-offs specifically**, ramp the glow longer (~3s) and color it with `--vault-accent-claude` / `--vault-accent-codex` depending on which agent created the file (the agent can write a frontmatter `author:` field, or we can sniff by filename pattern).

---

## 23. Glassmorphism 2.0 — the 2026 pioneer-level layer

By 2026 backdrop-filter has **97%+ global browser support**. The 2026 evolution of glassmorphism (Linear, Raycast, macOS Sequoia, ChatGPT desktop) emphasizes:

- **Dark glass** (not white tint): `rgba(20, 20, 30, 0.55)` with a thin colored stroke.
- **Multi-layer backdrop filters** (the 2026 evolution): one element does `backdrop-filter: blur(20px) saturate(180%)`, an inner layer does `backdrop-filter: blur(8px)`. Creates a sense of depth without performance lag because only top-level cards do the heavy blur.
- **Mask-image gradients** for fade edges.
- **Relative color syntax** for dynamic accent tinting:

```css
.vault-panel {
  background: color-mix(in srgb, var(--vault-bg-elev) 70%, transparent);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.04),
    0 30px 60px -30px rgba(0,0,0,0.5);
}

.vault-panel-header {
  background: linear-gradient(to bottom,
    rgba(249, 226, 175, 0.06),  /* yellow tint */
    transparent
  );
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

/* Hover-fade pattern (Shimmering Focus + Linear) */
.vault-panel:not(:hover):not(:focus-within) {
  opacity: 0.55;
  transition: opacity 360ms ease;
}
.vault-panel:hover, .vault-panel:focus-within {
  opacity: 1;
  transition: opacity 120ms ease;
}
```

**Best practices**:
- Only the top-level panel does heavy blur; cards inside use plain semi-transparent backgrounds.
- Tint with a 10% color (deep blue/purple for cool, peach/yellow for warm). Avoid white tint.
- For Electron specifically: `BrowserWindow` `vibrancy: 'sidebar'` (macOS) or `backgroundMaterial: 'acrylic'` (Win 11) lets the OS contribute additional native blur — true OS-level glassmorphism.

---

## 24. PIONEER-LEVEL SYNTHESIS — the Prompt Vault we should ship

Distilling the strongest pattern from each app into the final design:

```
+---------------------------------------------------------+
|  [Banner strip - 60px]  procedural gradient fade        |  <- Banners pattern
+---------------------------------------------------------+
|  [tab strip]  CLAUDE  •  CODEX 2  •  +                  |  <- existing EZvibes tab strip
+---------------------------------------------------------+
|                                          |              |
|                                          |  PROMPT      |  <- Logseq right sidebar
|                                          |  VAULT       |     pattern, 280px default
|        xterm.js terminal                 |              |
|                                          |  [search]    |  <- Obsidian Cmd+P style
|                                          |  ─────────── |
|                                          |  ★ Pinned    |  <- Pinned section
|                                          |    📝 CLAUDE.md
|                                          |    💬 prompt-init.md
|                                          |  ─────────── |
|                                          |  ⏰ Recent   |  <- Smart Folder (iA)
|                                          |    🔄 hand-off-2026-05-25.md
|                                          |  ─────────── |
|                                          |  📁 Prompts  |  <- Tree, indent guides
|                                          |    ├─ 🔄 hand-off-N.md
|                                          |    ├─ 💬 chat-N.md
|                                          |    └─ 🗂 archive/
|                                          |  ─────────── |
|                                          |  📁 Plans    |
|                                          |    └─ 📋 plan-N.md
|                                          |              |
|                                          |  ── click ── |
|                                          |  ── ctrl+    |
|                                          |     hover→   |  <- Hover Editor preview
|                                          |     popover  |
|                                          |              |
|                                          |  [+New     ] |  <- Things FAB pattern
+---------------------------------------------------------+
```

### Interaction grammar

| Gesture | Result |
|--|--|
| **Mouse1 click on file** | Paste content into active terminal tab |
| **Mouse1 click on folder** | Toggle expand/collapse |
| **Mouse2 click on file** | Context menu: Paste / Pin / Copy path / Reveal in Explorer |
| **Ctrl + hover on file** | Floating preview popover (drag to pin, resize) |
| **Double-click file** | Open in default editor |
| **Type while sidebar focused** | Filter (fuzzy match by name) |
| **Ctrl+P inside terminal** | Open command palette centered over terminal |
| **Esc** | Exit Focus / close popover / clear filter |
| **→ on folder row** | Focus into folder (Bike-style sub-tree zoom) |
| **← anywhere** | Focus out |
| **Drag file → terminal** | Paste (same as click) but with drop-zone affordance |

### Visual identity

- **Catppuccin Mocha** as the dark default (`--vault-bg = #11111b`)
- **Catppuccin Latte** as the light option
- **Yellow accent** (`#f9e2af`) matches ezvibes branding
- **Peach** (`#fab387`) for Claude hand-offs
- **Teal** (`#94e2d5`) for Codex hand-offs
- **Inter** with `ss03` for UI, **JetBrains Mono** for code blocks, **iA Writer Quattro** for markdown body (optional)
- **No drop shadows** — all elevation from surface ladder
- **JetBrains-style indent guides** that highlight on hover
- **Hover-fade panel** opacity at 55% when not focused
- **Dark glassmorphism** on the panel itself (`backdrop-filter: blur(24px) saturate(180%)`)
- **180-400ms eased pop animation** on newly-watched files

### The single most pioneer move — **"Time-Travel Hand-Off Ribbon"**

Combine:
- chokidar's live add events
- the Banners gradient strip
- AnuPpuccin's rainbow color cycling
- Bike's focus stack

into one feature:

> A **horizontal ribbon at the top of the vault** showing every `.md` file modified in the last 60 minutes, ordered left-to-right by time, colored by author (peach=Claude, teal=Codex, mauve=user). When a sibling session writes a `hand-off.md`, a new chip pops onto the right of the ribbon with an animated glow that decays over 30 seconds. **Click a ribbon chip = instant-paste into terminal.** **Ctrl+click = open popover preview.** **Drag a chip onto a tab = paste into that specific tab.**

It's the chat-app "typing indicator" idiom, but applied to multi-agent file hand-offs. No other markdown app does this — because no other markdown app expects *other AI agents* to be writing into the same vault. This is **the** pioneer move and it falls naturally out of the building blocks above.

---

## 25. URL appendix

### Themes
- Minimal: https://github.com/kepano/obsidian-minimal
- Minimal Settings: https://github.com/kepano/obsidian-minimal-settings
- Things 2: https://github.com/colineckert/obsidian-things
- AnuPpuccin: https://github.com/AnubisNekhet/AnuPpuccin
- Catppuccin Obsidian: https://github.com/catppuccin/obsidian
- Catppuccin palette source: https://catppuccin.com/palette/
- Sanctum: https://github.com/jdanielmourao/obsidian-sanctum
- Sanctum Reborn: https://github.com/antoKeinanen/obsidian-sanctum-reborn
- ITS Theme: https://github.com/SlRvb/Obsidian--ITS-Theme
- Royal Velvet: https://github.com/caro401/royal-velvet
- Shimmering Focus: https://github.com/chrisgrieser/shimmering-focus

### Plugins
- Iconize (deprecated): https://github.com/FlorianWoelki/obsidian-iconize
- Iconic (successor): https://github.com/gfxholo/iconic
- Banners: https://github.com/noatpad/obsidian-banners
- Hover Editor: https://github.com/nothingislost/obsidian-hover-editor
- Style Settings: https://github.com/obsidian-community/obsidian-style-settings
- File Tree Alternative: https://github.com/ozntel/file-tree-alternative
- Smooth Explorer: https://github.com/gasparschott/smooth-explorer
- Quick Explorer: https://github.com/pjeby/quick-explorer
- Better Command Palette: https://github.com/AlexBieg/obsidian-better-command-palette
- Customizable Menu: https://github.com/kzhovn/obsidian-customizable-menu

### Obsidian docs
- File explorer CSS variables: https://docs.obsidian.md/Reference/CSS+variables/Plugins/File+explorer
- Context menus dev docs: https://docs.obsidian.md/Plugins/User+interface/Context+menus
- CSS variables reference: https://deepwiki.com/obsidianmd/obsidian-developer-docs/3.3-css-variables-reference
- Obsidian help — appearance: https://help.obsidian.md/Settings/Appearance

### CSS snippets & tutorials
- Compact + clean file explorer: https://forum.obsidian.md/t/compact-and-clean-file-explorer-css/90085
- Iterative rainbow folders: https://forum.obsidian.md/t/iterative-rainbow-folder-colors-css/21066
- AnuPpuccin custom rainbow colors source: https://github.com/AnubisNekhet/AnuPpuccin/blob/main/snippets/custom-rainbow-colors.css
- Lucide icons in CSS: https://forum.obsidian.md/t/using-lucide-icons-in-css/99336
- Kate Morley canonical tree views: https://iamkate.com/code/tree-views/
- Replete's Minimal-theme snippets (80+): https://github.com/replete/obsidian-minimal-theme-css-snippets
- 27 awesome Obsidian CSS snippets: https://prakashjoshipax.com/obsidian-css-snippets/

### Heynote
- Repo: https://github.com/heyman/heynote
- Docs: https://heynote.com/docs/

### Bike
- Site: https://www.hogbaysoftware.com/bike/
- MacStories review: https://www.macstories.net/reviews/bike-an-elegant-outliner-for-mac-focused-workflows/

### Anytype
- Docs: https://doc.anytype.io/anytype-docs
- Local-first architecture: https://hilton.org.uk/blog/anytype-local-first

### Logseq
- DeepWiki layout & theming: https://deepwiki.com/logseq/logseq/5.1-layout-components-and-theming
- Awesome Logseq: https://github.com/logseq/awesome-logseq
- Logseq Dracula: https://draculatheme.com/logseq

### iA Writer
- Stay Organized: https://ia.net/writer/how-to/stay-organized
- Quick Tour: https://ia.net/writer/how-to/quick-tour

### Command palettes
- Raycast design dump: https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
- Linear redesign part II: https://linear.app/now/how-we-redesigned-the-linear-ui
- Superhuman command palette guide: https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/

### Chokidar
- Repo: https://github.com/paulmillr/chokidar
- Hendrik Erz horror story: https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell

### Glassmorphism 2.0 in 2026
- Glassmorphism 2.0 CSS techniques: https://weblogtrips.com/technology/glassmorphism-2-0-css-techniques-2026/
- Dark glassmorphism: https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f

---

## CLOSING — implementing in EZvibes

We already have:

- `renderer/app.js` with the session/tab state
- `renderer/styles.css` with the Explorer + Genie animations
- `main.js` with IPC + node-pty + the agent enum (`claude` | `codex`)
- The `terminal:input` IPC channel — **this is the rail we paste prompts onto**

Adding the Prompt Vault is therefore:

1. **main.js**: add `chokidar` (already a transitive dep? — `npm install chokidar` either way); add `vault:list` / `vault:read` / `vault:watch:start` / `vault:watch:stop` IPC channels; emit `vault:add` / `vault:change` / `vault:unlink` from main → renderer.
2. **preload.js**: expose `listVault`, `readVaultFile`, `onVaultEvent`, `pasteToTerminal(sessionId, text)`.
3. **renderer/app.js** (new module, e.g. `vault.js` imported from app.js): render the sidebar inside each session window's `.session-window` container, on the right side. State per-window: `expandedFolders: Set<string>`, `pinned: string[]`, `filter: string`, `popoverEl: HTMLElement | null`.
4. **renderer/styles.css**: add a `.prompt-vault` block with the Catppuccin tokens, JetBrains-style indent guides, hover-fade, glassmorphism, pop-in animation.
5. **renderer/icons/**: drop ~20 hand-picked Lucide SVGs (`file-text`, `arrow-right-left`, `sparkles`, `message-square`, `clipboard-list`, `book-open`, `folder`, `folder-open`, `pin`, `paste`, `eye`, …). Reference via `mask-image`.
6. **Click handler**: `await preload.pasteToTerminal(activeTabId, fileContent)`. Main calls `pty.write(fileContent)`. Done.
7. **Ctrl+hover**: a `mouseover` + key-state check that pops a fixed-position `<div class="vault-popover">` with the file's content rendered through a tiny markdown→HTML function (we already have markdown content in narration-sidebar). Make it draggable and resizable in ~50 LOC.
8. **Ribbon**: keep a `recentFiles: { path, mtime, agent }[]` array in window state, capped at 20. Render at top of vault panel as horizontal chips. Each chip = the same click/Ctrl-click contract.

That's it. The hard work was the design vocabulary — and this report gives the implementing agent every token, selector, gesture, and animation curve they need to build it.
