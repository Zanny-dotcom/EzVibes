# Tag, Category & Color-Coding Systems for Libraries (2025–2026)

> Research dossier for the EZvibes "prompt vault" feature.
> Focus: how 2025-2026 pioneer apps tag, color-code, and organize libraries of files / prompts / categories — translated to an Electron, vanilla-JS, dark-mode terminal-adjacent context.

---

## 1. The big picture — why tags matter for the vault

The user's vault holds heterogeneous markdown: `prompt.md`, `handoff.md`, `CLAUDE.md`, `SPEC.md`, `REFAC-2.md`, `BUG-fix.md`, etc. Folder-only organisation collapses under that load. **Tags are an orthogonal axis to folders**: any prompt can be `#frontend` + `#refactor` + `#urgent` regardless of which folder it physically lives in. macOS Finder Tags ([Apple Support](https://support.apple.com/guide/mac-help/tag-files-and-folders-mchlp15236/mac)) call this "labels layered on top of an existing folder system," and that's exactly the right mental model.

The 2025-2026 pioneer move is to **make tags pull double duty as both filters AND visual identity** (the chip's color becomes the dot prefix on the file in the list, becomes the accent border on the open prompt panel, becomes the glow on the paste button). One color, several visual states, total instant recognition. This dossier collects every pattern I could find for doing that well.

---

## 2. Reference apps — what each one teaches us

### 2.1 Notion — the disciplined 10-color palette

Notion's design team famously caps itself at exactly **10 tag colors**: Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red ([Notion Color Limitations 2026](https://digitalbiztalk.com/article/notion-s-color-problem-why-users-are-frustrated-in-2026)). CEO Ivan Zhao is reportedly extremely selective and refuses to expand it. The discipline matters: 10 colors is the boundary of what humans can recognise at a glance, and the constraint forces users to assign *semantic* meaning rather than picking favorites.

**Exact Notion hex values** ([Matthias Frank](https://matthiasfrank.de/en/notion-colors/) — verified):

Light mode:
| Color   | Text    | Background | Icon    |
|---------|---------|------------|---------|
| Default | #373530 | #FFFFFF    | #55534E |
| Gray    | #787774 | #F1F1EF    | #A6A299 |
| Brown   | #976D57 | #F3EEEE    | #9F6B53 |
| Orange  | #CC782F | #F8ECDF    | #D87620 |
| Yellow  | #C29343 | #FAF3DD    | #CB912F |
| Green   | #548164 | #EEF3ED    | #448361 |
| Blue    | #487CA5 | #E9F3F7    | #337EA9 |
| Purple  | #8A67AB | #F6F3F8    | #9065B0 |
| Pink    | #B35488 | #F9F2F5    | #C14C8A |
| Red     | #C4554D | #FAECEC    | #D44C47 |

Dark mode:
| Color   | Text    | Background | Icon    |
|---------|---------|------------|---------|
| Default | #D4D4D4 | #191919    | #D3D3D3 |
| Gray    | #9B9B9B | #252525    | #7F7F7F |
| Brown   | #A27763 | #2E2724    | #AA755F |
| Orange  | #CB7B37 | #36291F    | #D9730D |
| Yellow  | #C19138 | #372E20    | #CA8E1B |
| Green   | #4F9768 | #242B26    | #2D9964 |
| Blue    | #447ACB | #1F282D    | #2E7CD1 |
| Purple  | #865DBB | #2A2430    | #8D5BC1 |
| Pink    | #BA4A78 | #2E2328    | #C94079 |
| Red     | #BE524B | #332523    | #CD4945 |

Three observations that matter for the EZvibes vault:

1. **Three slots per color**: text, background, icon. The icon is more saturated/vibrant than the text. That's how Notion gets a "color identity" that stays legible against white *and* dark surfaces.
2. **The dark-mode background is the same hue at ~10% luminosity** — they're hue-locked, not just "dimmer." Very useful when you're using CSS `oklch()` and just need to dial down `L`.
3. **The palette is dual-purpose**: same 10 colors for tags, callouts, page covers, and text highlights. One color picker, everywhere.

Notion's accessibility weakness (some pairs have <4.5:1 text-on-background contrast for body text) is now widely criticized. If you copy Notion's hexes verbatim, you inherit that bug. The fix is to ramp the lightness independently per channel — OKLCH makes this trivial.

### 2.2 Linear — LCH-based theming with 3 inputs

Linear's redesign moved to **LCH color space** with only three knobs: base color, accent color, and contrast ([Linear's redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)). Replacing the previous 98 per-theme variables. Their reasoning: "LCH gives perceptual uniformity — a red and a yellow with L=50 appear equally light."

Pioneer-level idea worth stealing: **3-input theme = (Base hue, Accent hue, Contrast level)**. The whole sidebar / chip / hover-state system regenerates from those three. The EZvibes vault could let the user pick "vault accent = teal" and every related chrome (chip glow, paste button ring, source-folder badge) recolours instantly.

Linear's **issue-status colored circles** (Backlog / Todo / In Progress / In Review / Done / Canceled) use solid hue circles with a clipped arc/checkmark — an unbelievably efficient visual ([Linear Docs - Issue status](https://linear.app/docs/configuring-workflows)). For the vault, every file type could carry one of those: PROMPT (blue circle), HANDOFF (purple half-circle), SPEC (green full circle), BUG (red dashed).

### 2.3 Bear — nested tags + TagCons

Bear's tag system uses **hashtag syntax inline in the markdown body** (`#frontend/react`), supports infinite nesting via `/`, and lets users attach a small **TagCon icon** to each tag in the sidebar ([Bear FAQ](https://bear.app/faq/how-to-use-tags-in-bear/)). Multi-word tags use `#word with spaces#`. Tags can be escaped with `\#`.

The TagCon idea is brilliant for a prompt vault: each tag isn't just a color, it's a tiny custom glyph next to it. `#refactor` could have a wrench TagCon; `#handoff` could have a baton. **Bear lets users browse a built-in TagCon catalog and search for one.** That's pioneer-level fidget-friendly micro-detail.

Sidebar features Bear gets right that the vault should mimic:
- **Pin tags** to top via right-click.
- **Rename tags** by right-clicking — the rename rewrites all `#oldname` → `#newname` in every note. Bulletproof refactor.
- **Disclosure arrow** for nested tags so they tree-expand like folders.

### 2.4 Things 3 — color through tag + structure, not folder colors

Things deliberately doesn't allow folder color customization at all ([Things 3 Review](https://thedigitalprojectmanager.com/tools/things-3-review/)). Instead, the visual differentiation is achieved by:
- **Areas** (broad scopes, slate icons)
- **Projects** (round progress-ring icons)
- **Headings** (typographic dividers inside projects)

For the vault, this is the anti-trend warning: don't *also* color the folders if the tags already carry hue. The eye gets confused. Pick one channel of color, lean into it.

### 2.5 Apple Notes — Smart Folders + Tags

Apple Notes 2025 uses **tag-driven Smart Folders** — saved query bundles that auto-populate from criteria like `tag:`, `mention:`, `hasChecklist:`, `created:` ([Geeky Gadgets](https://www.geeky-gadgets.com/apple-notes-organization-tips-2025/)). No folder colors. The genius: the user *uses* the smart folder by clicking it, and it acts like a real folder but is actually a live query.

**For the EZvibes vault**: imagine a "Smart Vault" entry that shows "all `*.md` files tagged `#handoff` modified in the last 7 days across all EZvibes folders." It would always be at the top of the vault panel, and clicking refreshes the live query.

### 2.6 macOS Finder Tags — 7 colors + name freedom

The Finder model is small: **7 colors** (red, orange, yellow, green, blue, purple, grey) ([Apple Support](https://support.apple.com/guide/mac-help/tag-files-and-folders-mchlp15236/mac)). Each tag has TWO parts: a color (or none) AND a text label. Multiple tags per file. Shortcuts Control-1 through Control-7. A colored dot appears beside the filename in Finder list view — perfect precedent for the vault.

### 2.7 GitHub Labels — hex-free customisation

GitHub Issues lets you set **any hex color** for a label, but it ships with 14 sensible defaults (e.g. `bug` = `#d73a4a`, `enhancement` = `#a2eeef`, `documentation` = `#0075ca`, `good first issue` = `#7057ff`) ([GitHub default label palette gist](https://gist.github.com/borekb/d61cdc45f0c92606a92b15388cf80185)). The pioneer move is the **shuffle button** next to the hex input — random label color suggestion. Three lines of JS, and users feel like they have agency.

### 2.8 Trello — 30 named colors + colorblind name tooltip

Trello quietly expanded from 10 to ~30 named label colors in 2023, naming each one (e.g. "dark lime") so colorblind users see the **label name as tooltip** ([Trello label colors update](https://atlstg.reaktivdev.com/trello/20-new-trello-label-colors/)). That's an accessibility lesson: the color carries one message, the tooltip name carries the same message redundantly. The classic Trello palette is: `#0079bf, #70b500, #ff9f1a, #eb5a46, #f2d600, #c377e0, #ff78cb, #00c2e0, #51e898, #c4c9cc` ([Design Pieces](https://www.designpieces.com/palette/trello-color-palette-hex-and-rgb/)).

### 2.9 Raycast — tag-based filtering for AI Commands & Snippets

Raycast added **multi-tag assignment to Snippets and AI Commands**, plus filter-by-tag in the search view ([Raycast Manual - Snippets](https://manual.raycast.com/snippets), [AI Commands](https://manual.raycast.com/ai/ai-commands)). Each tag is a small pill in a horizontal scroll bar at the top of the list. Tap the pill → list filters. Cmd+tag to multi-select.

Raycast's chrome is "near-black canvas with hairline 1px borders, command-palette cards with 6-16px corner radius, Inter typography, a single white CTA pill" ([Raycast DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md)). The signature color is purple, chosen because *"UI design research showed it had the highest correlation with perceived speed."*

For the vault: a **single-row horizontal filter bar of tag pills** at the top is the Raycast-grade pattern.

### 2.10 Obsidian — community-built color sidebars

Obsidian's plugin ecosystem has converged on a few patterns:
- **Color Folders and Files plugin** ([Obsidian Stats](https://www.obsidianstats.com/plugins/color-folders-files)): right-click → color picker → choose bg + text + font-weight + opacity → applied to that folder/file.
- **Notebook Navigator** ([GitHub](https://github.com/johansan/notebook-navigator)): replaces the file explorer with a 2-pane "folder tree | file list" and adds color + icon + tag-property bindings.
- **Colored Sidebar by CyanVoxel** ([GitHub](https://github.com/CyanVoxel/Obsidian-Colored-Sidebar)): targets folders by numbered prefix (`00-Inbox`, `01-Projects`, `99-Archive`) via `[data-path^="00"]` attribute selector. Pure CSS, no plugin needed.

The CyanVoxel approach is gorgeous for the vault because it works **purely on naming convention** — name a vault file `00-PROMPTS.md` and CSS auto-paints it the inbox color. Zero metadata required.

### 2.11 TagSpaces — tag = color + emoji + name

TagSpaces is a local-first file tagger that lets each tag carry **a name + a color + an emoji** ([TagSpaces](https://www.tagspaces.org/)). The triple is what makes the chip scan-friendly: emoji catches the eye, color catches the peripheral vision, name confirms intent.

### 2.12 ForkLift 4.3 — Finder tags surfaced in sidebar

ForkLift 4.3 ([Binary Nights blog](https://blog.binarynights.com/2025/04/01/forklift-4-3-is-available/)) added a **Tags favorite group in the sidebar** that reads Finder's tag database and shows each tag as a sidebar item with the right colored dot. Drag-and-drop to reorder, right-click to edit. The vault could do this for handoff types — drag `#frontend` above `#backend` to set its prominence.

---

## 3. Color systems & generation strategies

### 3.1 The OKLCH revolution

OKLCH is **the** 2025 frontier for tag color palettes. It's `oklch(L C H)`:
- **L** = perceptual lightness 0-100% (humans see equal jumps as equal jumps)
- **C** = chroma 0-0.4ish (saturation, perceptual)
- **H** = hue 0-360°

Browser support is excellent now: Chrome 111+, Edge 111+, Safari 15.4+, Firefox 113+ (≈95%+ of users) ([HexPickr OKLCH guide](https://hexpickr.com/learn/oklch-css-guide)).

**Why this is huge for tags**: pick a single L for all your tag backgrounds, and they will all *appear* equally light to the eye no matter the hue. Contrast against text becomes mathematically consistent. Whereas in HSL, "yellow at L=50%" actually looks much brighter than "blue at L=50%" — the OKLCH system fixes that.

Evil Martians' canonical Tailwind-x-OKLCH guide ([Better dynamic themes in Tailwind with OKLCH](https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic)) lays out an 11-step ramp:

```js
// 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
const L = [97.78, 93.56, 88.11, 82.67, 74.22, 64.78, 57.33, 46.89, 39.44, 32, 23.78];

// Optimal consistency chroma values (per shade, manually tuned)
const C = [0.0108, 0.0321, 0.0609, 0.0908, 0.1398, 0.1472, 0.1299, 0.1067, 0.0898, 0.0726, 0.054];
```

The CSS pattern looks like:

```css
:root {
  --vault-tag-h: 220;        /* one variable per tag, the only thing that changes */
  --vault-tag-bg:     oklch(0.95 0.04 var(--vault-tag-h));
  --vault-tag-border: oklch(0.85 0.10 var(--vault-tag-h));
  --vault-tag-fg:     oklch(0.35 0.12 var(--vault-tag-h));
  --vault-tag-glow:   oklch(0.65 0.18 var(--vault-tag-h));
}
@media (prefers-color-scheme: dark) {
  :root {
    --vault-tag-bg:     oklch(0.22 0.04 var(--vault-tag-h));
    --vault-tag-border: oklch(0.38 0.10 var(--vault-tag-h));
    --vault-tag-fg:     oklch(0.82 0.12 var(--vault-tag-h));
    --vault-tag-glow:   oklch(0.65 0.20 var(--vault-tag-h));
  }
}
```

A **single integer (the hue 0-360)** is the entire color definition. To onboard a new tag, the user only picks a hue from a 360° wheel; the four CSS variables follow. This is the cleanest possible mental model for "one tag = one color."

### 3.2 Deterministic colors from string hashes

When the user doesn't want to pick a color, hash the tag name. **Color-Hash** ([GitHub](https://github.com/zenozeng/color-hash)) does it best in HSL:

```js
const colorHash = new ColorHash({
  lightness: [0.35, 0.5, 0.65],
  saturation: [0.5, 0.6, 0.7]
});
colorHash.hex('frontend');       // always '#8796c5'
colorHash.hex('handoff');        // always '#c58787' (or whatever)
colorHash.hsl('refactor');       // [225, 0.65, 0.35]
```

For pastel output specifically, fix saturation ~30 and lightness ~80. For a dark-mode terminal-ish aesthetic, fix saturation ~50 and lightness ~50 — chips will be vivid but not garish.

Translate to OKLCH for perceptual consistency:

```js
// Deterministic hue from any string
function hashHue(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return Math.abs(h) % 360;
}

function tagColor(str, role = 'bg') {
  const h = hashHue(str);
  const map = {
    bg:     `oklch(0.22 0.04 ${h})`,
    border: `oklch(0.38 0.10 ${h})`,
    fg:     `oklch(0.82 0.12 ${h})`,
    glow:   `oklch(0.65 0.20 ${h})`,
  };
  return map[role];
}
```

This means *every new prompt tag the user types instantly has a unique, consistent color* — no picker required.

### 3.3 Notion-style locked palette (10 hand-picked hues)

A defensible middle ground: hard-code 10 OKLCH hues but expose them as `--tag-color-1` through `--tag-color-10`. Each new user-created tag rotates through the next available slot until 10, then the picker forces them to reuse an existing one.

```js
const PALETTE = [
  { name: 'gray',   h: 0,   c: 0.0 },
  { name: 'brown',  h: 50,  c: 0.06 },
  { name: 'orange', h: 60,  c: 0.16 },
  { name: 'yellow', h: 90,  c: 0.14 },
  { name: 'green',  h: 145, c: 0.12 },
  { name: 'teal',   h: 180, c: 0.12 },
  { name: 'blue',   h: 240, c: 0.14 },
  { name: 'purple', h: 290, c: 0.14 },
  { name: 'pink',   h: 340, c: 0.13 },
  { name: 'red',    h: 25,  c: 0.18 },
];
```

This palette has a discipline benefit (forces semantic naming: blue = "info", red = "danger") and an accessibility benefit (all 10 are pre-vetted).

### 3.4 Material You / dynamic palette extraction

Material You ([Android Open Source Project](https://source.android.com/docs/core/display/material)) extracts a seed color from the user's wallpaper and expands it into 5 tonal palettes (Primary, Secondary, Tertiary, Neutral, Neutral-variant), each with 13 tonal stops, totalling 65 colors. The libraries are open: **material-color-utilities** ([GitHub](https://github.com/material-foundation/material-color-utilities)) and **materialyoucolor (Python)** ([PyPI](https://pypi.org/project/materialyoucolor/1.2.0/)).

For the EZvibes vault: drop an image into the vault settings → extract the wallpaper's seed → regenerate the entire chip palette. That would be silly cool. Even pulling the user's Windows accent color would do (`SystemParametersInfo(SPI_GETIMMERSIVECOLORS)`).

### 3.5 Open Color — 13 families × 10 shades

The **Open Color** palette ([yeun.github.io/open-color](https://yeun.github.io/open-color/), MIT) is a battle-tested 130-color base. Tag chips could use a fixed mapping: family for the tag category, shade for the state:

```css
:root {
  --oc-gray-0: #f8f9fa; --oc-gray-9: #212529;
  --oc-red-0: #fff5f5; --oc-red-9: #c92a2a;
  --oc-pink-0: #fff0f6; --oc-pink-9: #a61e4d;
  --oc-grape-0: #f8f0fc; --oc-grape-9: #862e9c;
  --oc-violet-0: #f3f0ff; --oc-violet-9: #5f3dc4;
  --oc-indigo-0: #edf2ff; --oc-indigo-9: #364fc7;
  --oc-blue-0: #e7f5ff; --oc-blue-9: #1864ab;
  --oc-cyan-0: #e3fafc; --oc-cyan-9: #0b7285;
  --oc-teal-0: #e6fcf5; --oc-teal-9: #087f5b;
  --oc-green-0: #ebfbee; --oc-green-9: #2b8a3e;
  --oc-lime-0: #f4fce3; --oc-lime-9: #5c940d;
  --oc-yellow-0: #fff9db; --oc-yellow-9: #e67700;
  --oc-orange-0: #fff4e6; --oc-orange-9: #d9480f;
}
```

Convention: chip background = `family-1`, border = `family-3`, foreground = `family-7`, hover-bg = `family-2`. Done.

### 3.6 Radix Colors — 12-step semantic scale

Radix Colors ([radix-ui.com/colors](https://www.radix-ui.com/colors)) provides 30 families × 12 steps. The killer feature is **semantic step assignments** that work the same across every family:

| Step  | Use                                  |
|-------|--------------------------------------|
| 1     | App background                       |
| 2     | Subtle background                    |
| 3     | UI element background                |
| 4     | Hovered UI element background        |
| 5     | Active / Selected UI element bg      |
| 6     | Subtle borders, separators           |
| 7     | UI element border / focus rings      |
| 8     | Hovered UI element border            |
| 9     | Solid backgrounds                    |
| 10    | Hovered solid backgrounds            |
| 11    | Low-contrast text                    |
| 12    | High-contrast text                   |

So every tag chip in the vault could be `background: var(--tag-3); border: var(--tag-7); color: var(--tag-11)` and look correct for every color and theme. Dark mode is automatic via `.dark` class.

### 3.7 Color-blind safety

ColorBrewer ([colorbrewer2.org](https://colorbrewer2.org/)) is the canonical resource. Important truth: **the only categorical color-blind-safe palette is Set2 with ≤4 categories**, because red/green/orange/yellow are indistinguishable to many users. For more than 4 categories, you must combine color with shape/icon/text. That's why every well-designed tag system pairs the color with **either** an emoji **or** a name shown on hover.

Tableau 10, IBM Design Language, and ColorBrewer Set2 are the three most-cited color-blind-friendly categorical palettes ([Cleanchart 2026 guide](https://www.cleanchart.app/blog/data-visualization-color-palettes)).

---

## 4. Chip / pill / tag visual anatomy (the 2025-2026 vocabulary)

Setproduct ([chip UI guide](https://www.setproduct.com/blog/chip-ui-design)) decomposes the chip into 7 parts:

```
[ container  [icon] [label] [counter] [close x] ]
   border      ↑       ↑       ↑          ↑
   bg-fill     dot   text     pill       close
```

**Variants used in 2025 pioneer apps:**

1. **Filled** — solid pastel bg + bold text (Notion, GitHub, Linear)
2. **Outlined** — transparent bg + 1px colored border (Things 3, Apple HIG)
3. **Dot prefix** — small leading filled circle + neutral chip body (Linear status, GitHub Issues hover, macOS Finder)
4. **Avatar prefix** — emoji or icon stamp at left (Bear TagCons, TagSpaces)
5. **Color stripe** — left vertical accent bar 3-4px (admin dashboards, IDE issue gutters)
6. **Glassmorphic** — frosted bg + colored border (iOS 26 Liquid Glass, macOS Tahoe)
7. **Glow ring** — outer box-shadow with the tag color at low alpha (game/streaming overlays)
8. **Underline** — text + colored underline (minimalist editorial — used by Linear's recent redesign in lots of places)
9. **Checkmark inside** — selected state (Material 3 Filter Chip)
10. **Removable** — close button with cross-fade out

Material 3 has 4 chip types ([m3.material.io/components/chips](https://m3.material.io/components/chips)):
- **Assist** chip — suggested action
- **Filter** chip — toggle filter
- **Input** chip — represents a selected entity (best for our use case)
- **Suggestion** chip — what to type next

### 4.1 Reference CSS — the "perfect 2025 dark-mode tag chip"

```css
.tag-chip {
  --h: 220; /* hue is the only var we change per tag */

  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px 2px 8px;
  height: 22px;
  border-radius: 9999px;

  font: 500 11px/1 -apple-system, "Inter Display", Inter, sans-serif;
  letter-spacing: 0.01em;

  background: oklch(0.22 0.04 var(--h));
  border: 1px solid oklch(0.40 0.10 var(--h) / 0.6);
  color: oklch(0.85 0.12 var(--h));

  cursor: pointer;
  transition: transform 120ms ease, box-shadow 200ms ease, background 160ms ease;
  user-select: none;
}

.tag-chip::before {
  content: "";
  width: 6px; height: 6px; border-radius: 50%;
  background: oklch(0.65 0.20 var(--h));
  box-shadow: 0 0 4px oklch(0.65 0.20 var(--h) / 0.8);
}

.tag-chip:hover {
  background: oklch(0.28 0.06 var(--h));
  border-color: oklch(0.50 0.12 var(--h));
  box-shadow: 0 0 0 3px oklch(0.65 0.20 var(--h) / 0.18);
  transform: translateY(-1px);
}

.tag-chip[aria-pressed="true"] {
  background: oklch(0.55 0.18 var(--h));
  border-color: oklch(0.65 0.22 var(--h));
  color: oklch(0.10 0.04 var(--h));
}

.tag-chip[aria-pressed="true"]::before {
  background: oklch(0.10 0.04 var(--h));
  box-shadow: none;
}

/* per-tag hue */
.tag-chip[data-tag="frontend"] { --h: 200; }
.tag-chip[data-tag="backend"]  { --h: 270; }
.tag-chip[data-tag="refactor"] { --h: 30;  }
.tag-chip[data-tag="handoff"]  { --h: 145; }
.tag-chip[data-tag="spec"]     { --h: 95;  }
.tag-chip[data-tag="bug"]      { --h: 0;   }
.tag-chip[data-tag="docs"]     { --h: 220; }
.tag-chip[data-tag="urgent"]   { --h: 15;  }
```

That's about 50 lines and you have hover, focus, selected, dot prefix, glow, and per-tag hue — all derived from one number.

### 4.2 Frosted-glass tag chip (Liquid Glass 2025 idiom)

For the *high-luxury* version of the chip, riding the Apple Liquid Glass aesthetic announced at WWDC 2025 ([Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)):

```css
.tag-chip.glass {
  background: oklch(0.30 0.05 var(--h) / 0.35);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid oklch(0.70 0.15 var(--h) / 0.4);
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.12),
    0 1px 2px oklch(0 0 0 / 0.3);
}
```

Pair with a dark, subtly blurred surface behind (e.g. a folder card with a noisy gradient) and the chip looks like a stamped foil sticker.

### 4.3 Color-stripe vault entry (file row in the prompt vault)

The most useful pattern for the vault: a **left vertical 3px stripe** colored by the file's primary tag.

```css
.vault-row {
  --h: 220;
  position: relative;
  display: grid;
  grid-template-columns: 16px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 16px;
  background: oklch(0.18 0.005 220);
  border-radius: 6px;
  margin: 2px 0;
  transition: background 140ms ease, transform 140ms ease;
}
.vault-row::before {
  content: "";
  position: absolute;
  left: 4px; top: 8px; bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: oklch(0.65 0.18 var(--h));
  box-shadow: 0 0 6px oklch(0.65 0.20 var(--h) / 0.5);
}
.vault-row:hover {
  background: oklch(0.22 0.01 var(--h));
  transform: translateX(2px);
}
.vault-row .filename {
  font: 500 13px/1.2 "Inter", -apple-system, sans-serif;
  color: oklch(0.92 0.01 220);
}
.vault-row .mini-tags {
  display: flex; gap: 4px;
}
```

Right-click on the row → "Set color stripe" opens a hue wheel (or palette).

---

## 5. Tag picker UI patterns

### 5.1 Multi-select with inline color swatch

The 2025 standard, as used by Linear/Notion/Raycast, is a dropdown that combines: search input + colored dot per item + checkbox state + "+ Create '{query}'" footer when the query doesn't match any existing tag.

```html
<div class="tag-picker" role="combobox">
  <input class="tag-picker-search" placeholder="Add or find a tag…"
         aria-controls="tag-list" aria-expanded="true" />
  <ul id="tag-list" role="listbox">
    <li role="option" aria-selected="true">
      <span class="dot" style="--h:200"></span>
      frontend
      <span class="check">✓</span>
    </li>
    <li role="option" aria-selected="false">
      <span class="dot" style="--h:270"></span>
      backend
    </li>
    <!-- … -->
    <li class="create-row" role="option">
      <span class="plus">+</span>
      Create "<strong>{{query}}</strong>"
    </li>
  </ul>
</div>
```

```css
.tag-picker {
  width: 240px;
  background: oklch(0.16 0.005 220);
  border: 1px solid oklch(0.30 0.01 220);
  border-radius: 8px;
  padding: 6px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.45);
}
.tag-picker-search {
  width: 100%;
  padding: 6px 8px;
  background: transparent;
  border: none;
  color: oklch(0.95 0.01 220);
  outline: none;
  font: 500 12px/1 Inter, sans-serif;
}
#tag-list { list-style: none; margin: 4px 0 0; padding: 0; max-height: 260px; overflow-y: auto; }
#tag-list [role="option"] {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 5px; cursor: pointer;
  font: 500 12px/1 Inter, sans-serif;
  color: oklch(0.85 0.01 220);
}
#tag-list [role="option"]:hover, #tag-list [role="option"][aria-selected="true"] {
  background: oklch(0.22 0.01 220);
}
#tag-list .dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: oklch(0.65 0.20 var(--h));
  box-shadow: 0 0 4px oklch(0.65 0.20 var(--h) / 0.6);
}
.create-row { color: oklch(0.55 0.05 220); border-top: 1px solid oklch(0.22 0.01 220); margin-top: 4px; padding-top: 8px; }
```

### 5.2 Tag bar — horizontal scrollable pill row (Raycast pattern)

For the vault's *top* filter row:

```html
<div class="tag-bar" role="tablist" aria-label="Filter prompts by tag">
  <button role="tab" aria-selected="true" class="tag-chip" data-tag="all" style="--h:0">All</button>
  <button role="tab" class="tag-chip" data-tag="frontend" style="--h:200">frontend</button>
  <button role="tab" class="tag-chip" data-tag="backend"  style="--h:270">backend</button>
  <button role="tab" class="tag-chip" data-tag="refactor" style="--h:30">refactor</button>
  <button role="tab" class="tag-chip" data-tag="handoff"  style="--h:145">handoff</button>
  <button role="tab" class="tag-chip" data-tag="urgent"   style="--h:15">urgent</button>
</div>
```

```css
.tag-bar {
  display: flex; gap: 6px;
  overflow-x: auto; scroll-behavior: smooth;
  padding: 6px 8px;
  scrollbar-width: thin;
  scrollbar-color: oklch(0.30 0.01 220) transparent;
  /* fade out at edges so the scroll feels infinite */
  mask-image: linear-gradient(to right, transparent 0, black 18px, black calc(100% - 18px), transparent 100%);
}
.tag-bar::-webkit-scrollbar { height: 4px; }
.tag-bar::-webkit-scrollbar-thumb { background: oklch(0.30 0.01 220); border-radius: 2px; }
```

The mask-image edge-fade is the 2026 polish move — chips fade out instead of being cut off by the container.

### 5.3 Hierarchical (nested) tag tree — Bear pattern

When `#frontend/react/hooks` exists, render as a tree:

```
▼  frontend                 (12)
   ▼  react                 (8)
       hooks                (3)
       components           (5)
   vue                      (4)
▶  backend                  (5)
```

CSS for the tree uses `padding-left: calc(var(--depth) * 16px)` and a `::before` arrow that rotates 90° when expanded. Shadcn's tree-view template ([shadcn Tree View](https://www.shadcn.io/template/mrlightful-shadcn-tree-view)) is a clean React reference; vanilla equivalent is ~40 lines.

---

## 6. Frontmatter as the canonical source of truth

Every vault file should carry tags in its YAML frontmatter so the truth lives in the markdown, not a separate DB. This is the Obsidian/Astro/Hugo standard ([Obsidian YAML front matter](https://help.obsidian.md/Advanced+topics/YAML+front+matter)).

```yaml
---
title: "Refactor terminal popup fit logic"
tags: [frontend, refactor, urgent]
category: refactor
color: 30                # OPTIONAL: override; otherwise derived from tags[0]
icon: "wrench"
created: 2026-05-21T14:32:00Z
updated: 2026-05-25T09:11:00Z
author: claude-opus-4.7
handoff_from: ses-2025-05-20-001
status: ready
---

# Prompt body goes here…
```

Parse it on file watch with a tiny YAML parser (~3KB minified) like `gray-matter` ([npm](https://www.npmjs.com/package/gray-matter)) or a regex-based one if you want zero deps:

```js
function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const [k, ...v] = line.split(':');
    if (!k) continue;
    let val = v.join(':').trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      val = val.replace(/^['"]|['"]$/g, '');
    }
    data[k.trim()] = val;
  }
  return { data, body: m[2] };
}
```

The `tags` array drives the chip render. `color: 30` (hue) overrides if present. `category` is the dominant tag (used for the color stripe). `icon: "wrench"` is a TagCon mapping.

**Frontmatter-derived per-tag count cache** lives in memory:

```js
const tagIndex = new Map(); // tag -> Set<path>
function indexFile(path, fm) {
  for (const tag of (fm.tags || [])) {
    if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
    tagIndex.get(tag).add(path);
  }
}
```

Count badge on each chip = `tagIndex.get(tag).size`.

---

## 7. Concrete palette presets for the EZvibes vault

Given EZvibes's existing chrome (yellow folder accents, amber Claude chips, teal Codex chips), here are the recommended tag families. Each is given as a hue (OKLCH) and a hex fallback:

| Tag        | OKLCH hue | Hex (mid)  | Vibe                           |
|------------|-----------|------------|--------------------------------|
| frontend   | 200       | #4A9FE0    | sky / UI / clean cyan          |
| backend    | 270       | #8A6FE0    | deep purple / "wizardry"       |
| refactor   | 30        | #D69850    | warm orange / "rework"         |
| handoff    | 145       | #4FB37A    | mint / "passing the baton"     |
| spec       | 95        | #9FAA40    | olive / "doc, formal"          |
| bug        | 15        | #D75A4E    | red / urgency                  |
| docs       | 220       | #6190CB    | indigo / "official"            |
| urgent     | 5         | #D74C57    | hot red                        |
| ideas      | 320       | #C26CB0    | magenta / "creative"           |
| archive    | 0         | #888       | desaturated gray               |
| claude     | 50        | #D4A04C    | matches existing Claude amber  |
| codex      | 180       | #2EB3A0    | matches existing Codex teal    |

In CSS:

```css
:root {
  --tag-frontend: 200;
  --tag-backend:  270;
  --tag-refactor: 30;
  --tag-handoff:  145;
  --tag-spec:     95;
  --tag-bug:      15;
  --tag-docs:     220;
  --tag-urgent:   5;
  --tag-ideas:    320;
  --tag-archive:  0;
  --tag-claude:   50;
  --tag-codex:    180;
}
```

Use as `style="--h: var(--tag-frontend);"`.

---

## 8. Dynamic per-folder accent (the user-chosen color)

The EZvibes "folder turns orange when minimized session is open" already proves the user accepts per-folder color state. Extend it:

1. User right-clicks a folder → "Pick folder color"
2. Hue wheel popup (or hex input)
3. Selection saved to `.EZvibes-meta.json` in that folder OR to an Electron `app.getPath('userData')/folder-colors.json` map
4. Folder card's left stripe + active-session glow both shift to that hue
5. The terminal popup window's chrome takes the same hue (subtle 1px border bottom of title bar)
6. The vault panel inside that session shows the hue as its top accent

This is the **Linear 3-input theme model** applied at folder granularity. Pioneer-level cool because the user feels "this is *my* React project, this is *my* infra project" by color alone.

```js
// main.js side
const folderColors = readJSONOr({}, path.join(userDataPath, 'folder-colors.json'));
function setFolderHue(folderPath, hue) {
  folderColors[folderPath] = hue;
  fs.writeFileSync(path.join(userDataPath, 'folder-colors.json'), JSON.stringify(folderColors));
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('folder:color-changed', { folderPath, hue });
  }
}
```

```js
// renderer
window.ezvibes.onFolderColorChanged(({ folderPath, hue }) => {
  document.querySelectorAll(`[data-folder-path="${folderPath}"]`).forEach(el => {
    el.style.setProperty('--h', hue);
  });
});
```

---

## 9. Pioneer-level ideas (the wild ones)

These are the *"oh dang"* moves you can land if you want the vault to feel 2026.

### 9.1 Tag-as-shader

Each tag gets a tiny **animated SVG/Canvas filter** assigned to it, rendered behind the chip when hovered. `#frontend` could be a gentle hue-shift gradient; `#handoff` a slow-traveling wave; `#urgent` a pulsing glow. WebGL Shader Toy-ish effects in 16x16 chip backdrops. Done with `mix-blend-mode: overlay` and a 60fps `requestAnimationFrame` only when hovered.

### 9.2 Color-tag rooms

The vault is a "room" whose walls (sidebar bg, top bar accent, paste-button glow, scroll-bar thumb) are tinted by the *currently-filtered tag*. Click `#frontend` chip → entire room subtly shifts to a sky-blue tint. Click `#bug` → red-tinted urgency. Tactile, instant context.

### 9.3 Conditional emoji TagCons via Unicode 17

Unicode 17.0 brings 133 new emojis to Samsung's One UI 8.5 and the cross-platform set ([Sammy Fans](https://www.sammyfans.com/2026/04/02/samsung-one-ui-8-5-brings-133-new-emojis/)). The vault can ship with a TagCon picker that lets you assign any emoji as the chip prefix. A 32-row × 30-column emoji grid that filters by name as the user types. Saved to frontmatter `icon: 🔧`.

### 9.4 Tag-color extracted from a referenced file

If the prompt has `references: [./mockup.png]` in frontmatter, sample the dominant color from that image (use `node-vibrant` or a tiny pixel histogram) and use it as the tag hue. The prompt for "redesign the dashboard" automatically gets the hue of the dashboard's mockup.

### 9.5 Live "color paths"

When the vault filters by `#frontend`, draw a subtle 1px line in the active tab's bottom border that follows the source's hue. Sustained visual cue: "the active terminal is paste-ready for frontend prompts."

### 9.6 The handoff comet

When another session writes a new `handoff-*.md` to the vault folder, a **comet animation** flies from the top of the vault panel to its new file row, leaves a trailing color stripe of the file's category color, then fades. Tactile signal that *something new arrived from another agent*. CSS `@keyframes` + `transform: translateY` + canvas trail.

### 9.7 Material You wallpaper extraction

Drop any image into vault settings → extract its seed → regenerate the entire 12-tag palette in OKLCH. Implementable in ~80 lines using `material-color-utilities`. Brilliantly fun.

### 9.8 Color memory via natural-language hashes

Hash the tag's first usage context (e.g. "user typed `#frontend` while editing `react-hooks.md`") to derive a hue. The same tag would always come back the same color across machines if the seed is deterministic — but uniquely *yours*. A subtle ownership signal.

### 9.9 Quantum chips (multiple tags blended)

When a file has 3 tags (e.g. `frontend`, `refactor`, `urgent`), the row's stripe is a 3-stop gradient blending those 3 hues. Easy with `linear-gradient(to bottom, var(--h1), var(--h2), var(--h3))`. The chip text shows all three abbreviated initials inside a single pill: `F·R·U`. Compact and unmistakable.

### 9.10 Color sync with terminal prompt

When the active filter is `#frontend`, the terminal's bash/PowerShell prompt color also shifts (via PROMPT_COMMAND or PSReadLine `Set-PSReadLineOption -Colors`). The vault and the shell are united by hue. Pure magic.

---

## 10. Accessibility checklist (don't skip)

- **Contrast**: every chip text-on-bg must hit 4.5:1 minimum (WCAG 2.2 AA). With OKLCH at fixed L difference (e.g. text L=85, bg L=22 in dark mode), this is automatic across hues ([accessibility.build](https://www.accessibility.build/tools/color-palette-generator)).
- **Don't use color alone**: pair color with emoji/icon/name tooltip. Trello's "dark lime" tooltip is the model.
- **Color-blind safety**: ColorBrewer reminds us — at ≥5 categories, ALWAYS pair color with a second cue.
- **Respect `prefers-reduced-motion`**: kill the glow pulses and comet trails when user opts out.
- **Respect `prefers-color-scheme`**: dark-mode and light-mode OKLCH variants both authored. Same hue, swap L's.
- **Keyboard navigation**: chips are buttons or tabs, focusable, `aria-pressed` toggles, arrow keys to traverse the tag-bar.
- **Hover ≠ tap**: tap targets ≥24x24px even though the visual chip can be smaller (use invisible padding).

---

## 11. Implementation cheat sheet for the EZvibes vault

A 30-second mental model that combines everything above:

1. **Storage**: tags live in YAML frontmatter (`tags: [frontend, refactor]`). On file save (chokidar watcher), reindex.
2. **Color**: each tag's hue is either user-picked (stored in `.EZvibes/tag-colors.json`) or deterministically hashed from the tag name.
3. **Rendering**:
   - File row in the vault: 3px left stripe colored by `tags[0]` (the "category" tag), filename, secondary mini-tags as small chips on the right, counter on hover.
   - Tag bar at top: horizontal scrolling row of filterable tag chips. Click toggles filter, Cmd-click multi-selects.
   - Tag picker: combobox with search + colored dots + checkboxes + "Create new" footer.
4. **Filtering**: filter is in-memory; updates the `[data-visible]` attribute on each row; CSS hides hidden rows.
5. **Sidebar groups** ([Mintlify-style](https://www.mintlify.com/docs/organize/navigation)): top-level "Prompts", "Hand-offs", "Specs" each with a tag count badge.
6. **Per-folder accent**: each EZvibes folder can set its own master hue, which paints the vault panel, the session window border, and the "minimized" folder badge state.

Total UI surface: ~400 lines of HTML, ~600 lines of CSS, ~300 lines of JS, and you have a Linear-grade vault.

---

## 12. Library / npm dependency list (zero-ish required)

- **gray-matter** (~25KB) — robust YAML frontmatter parsing. Or roll your own regex if you want zero-dep.
- **chokidar** (~50KB) — file watcher already in the Electron ecosystem; perfect for live vault updates.
- **culori** (~30KB) — OKLCH ↔ hex conversion when you need to display a hex code in the picker. Only load when settings open.
- **color-hash** (~5KB) — deterministic tag color from name. Optional.
- **material-color-utilities** (~40KB) — wallpaper-seed palette extraction. Only load when user opts in.
- **node-vibrant** (~100KB) — extract dominant colors from a referenced image. Only load on demand.
- **fuse.js** (~10KB) — fuzzy tag search in the picker. Optional but nice.

For an EZvibes-style vanilla JS app, you can ship without any of these. OKLCH parsing is native CSS; hashing is 5 lines of JS; chokidar is the only non-trivial one (and it's already a node-pty dependency-adjacent territory).

---

## 13. Inspiration links (curated)

**Color systems**:
- [OKLCH Color Picker & Converter](https://oklch.com/) — Björn Ottosson's tool.
- [Evil Martians — OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- [Evil Martians — Dynamic themes with OKLCH](https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic)
- [Open Color palette](https://yeun.github.io/open-color/)
- [Radix Colors](https://www.radix-ui.com/colors)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/colors)
- [ColorBrewer 2.0](https://colorbrewer2.org/)
- [Inclusive Colors generator](https://www.inclusivecolors.com/)
- [Material Color Utilities](https://github.com/material-foundation/material-color-utilities)

**Reference apps & their docs**:
- [Notion exact hex values](https://matthiasfrank.de/en/notion-colors/)
- [Linear UI redesign retrospective](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Bear tag system](https://bear.app/faq/how-to-use-tags-in-bear/)
- [Apple Notes Smart Folders](https://support.apple.com/guide/iphone/use-smart-folders-iphc43adabc2/ios)
- [macOS Finder Tags](https://support.apple.com/guide/mac-help/tag-files-and-folders-mchlp15236/mac)
- [Raycast Snippets manual](https://manual.raycast.com/snippets)
- [Raycast AI Commands](https://manual.raycast.com/ai/ai-commands)
- [GitHub label management docs](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)
- [Default GitHub labels gist](https://gist.github.com/borekb/d61cdc45f0c92606a92b15388cf80185)
- [Trello 20 new label colors](https://atlstg.reaktivdev.com/trello/20-new-trello-label-colors/)
- [Apple Liquid Glass announcement](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)

**Component libraries**:
- [Material 3 Chips](https://m3.material.io/components/chips)
- [Ant Design Tag](https://ant.design/components/tag/)
- [shadcn Badge](https://ui.shadcn.com/docs/components/radix/badge)
- [Untitled UI Tags](https://www.untitledui.com/components/tags)
- [Setproduct Chip UI guide](https://www.setproduct.com/blog/chip-ui-design)
- [Smart Interface Design — Badges vs Pills vs Chips vs Tags](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/)

**Obsidian community color plugins** (great pattern references):
- [Color Folders and Files plugin](https://www.obsidianstats.com/plugins/color-folders-files)
- [Notebook Navigator](https://github.com/johansan/notebook-navigator)
- [Colored Sidebar by CyanVoxel](https://github.com/CyanVoxel/Obsidian-Colored-Sidebar)

**Utilities**:
- [color-hash (zenozeng)](https://github.com/zenozeng/color-hash)
- [Untitled UI color palette tool](https://www.untitledui.com/components/color-styles)
- [tints.dev — Tailwind palette generator](https://www.tints.dev/)
- [Coolors palette tool](https://coolors.co/)
- [TagSpaces (local-first tag manager)](https://www.tagspaces.org/)

**Design-system references for AI agents**:
- [VoltAgent awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
- [Raycast DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md)

---

## 14. The single boldest recommendation

If you implement only one idea from this dossier, make it this: **OKLCH-driven per-tag hue, with one CSS variable `--h` per tag, deterministically hashed from the tag name on first use, overridable via a hue-wheel popup**. Plus a left **3px color stripe** on each vault file row and a horizontally-scrollable **filter pill bar** at the top of the vault panel.

That gives you:
- ~100 lines of CSS for the entire chip system (every state derives from one number)
- Zero color metadata files needed for the default case
- Every new tag the user invents *instantly* has a unique, consistent color
- Pioneer-level cool, because each prompt file in the vault has its own colored gutter ribbon that you can scan at a glance like a library spine

Combined with frontmatter-driven categories, emoji TagCons, smart folders for live queries, and the "tag-color-rooms" idea (entire vault subtly tinted by the currently-filtered tag), it lands the user squarely in 2026 territory.

Pad it with the **handoff comet** animation for new cross-session files arriving in the vault — when another Claude session writes `handoff-2026-05-25.md`, a colored comet flies down to its row in the open vault panel of any session that's looking. *That* is what "feels alive" looks like.
