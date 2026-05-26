# Research #27 — Apple Notes, Bear, Day One, Drafts, iA Writer & macOS Tahoe (Liquid Glass) — Note/Folder UX Patterns for a Prompt-Vault Side Panel

> **Context:** EZvibes is a Windows Electron 33 app. The user wants a "prompt vault" panel inside each session window. Click an `.md` file → its contents paste into the active xterm tab. Cross-session hand-offs land in the same folder and become visible instantly. The user envisioned this as a "vault" with a Paste button per row. They want it to feel **pioneer-level cool** by stealing the best ideas from the most polished native note apps of 2025–2026.
>
> This document distills how Apple Notes (iOS 26 / macOS Tahoe 26), Bear 2.7 (TagCons), Day One, Drafts 5+, iA Writer, and Ulysses lay out their three- and four-pane interfaces; how macOS Tahoe's Liquid Glass material can be ported to CSS/SVG inside an Electron renderer; and concrete, copy-pasteable techniques the EZvibes vault can adopt.

---

## TABLE OF CONTENTS

1. [Why these apps matter for a prompt vault](#1-why-these-apps-matter-for-a-prompt-vault)
2. [Apple Notes — the canonical three-pane](#2-apple-notes--the-canonical-three-pane)
3. [Apple Notes iOS 26 / macOS Tahoe 26 Liquid Glass redesign](#3-apple-notes-ios-26--macos-tahoe-26-liquid-glass-redesign)
4. [Bear — typography-first markdown + nested tags + TagCons](#4-bear--typography-first-markdown--nested-tags--tagcons)
5. [Day One — timeline, photo grid, calendar, map](#5-day-one--timeline-photo-grid-calendar-map)
6. [Drafts — capture-first + Workspaces (saved searches)](#6-drafts--capture-first--workspaces-saved-searches)
7. [iA Writer — Library / Organizer + Focus Mode](#7-ia-writer--library--organizer--focus-mode)
8. [Ulysses — the gold standard four-pane writing app](#8-ulysses--the-gold-standard-four-pane-writing-app)
9. [Liquid Glass for Electron — CSS + SVG ports](#9-liquid-glass-for-electron--css--svg-ports)
10. [Smart Folders — implementation rules for a `.md` vault](#10-smart-folders--implementation-rules-for-a-md-vault)
11. [Sidebar polish — selection, hover, scrolling, drag-reorder](#11-sidebar-polish--selection-hover-scrolling-drag-reorder)
12. [Concrete architecture for the EZvibes prompt vault](#12-concrete-architecture-for-the-EZvibes-prompt-vault)
13. [Pioneer-level ideas + one bold suggestion](#13-pioneer-level-ideas--one-bold-suggestion)
14. [References / URLs](#14-references--urls)

---

## 1. Why these apps matter for a prompt vault

A "prompt vault" is structurally identical to a markdown note app: a tree of folders, a flat list of files inside the current folder, a preview pane on the right, and some action (open, copy, paste). The Apple-ecosystem note apps have spent fifteen years polishing exactly this interaction.

For the EZvibes project, the goal is **not** to clone Notes — it is to steal the patterns that make Notes feel "right": the *three-pane rhythm*, the *selection sweep*, the *typography breathing*, the *sidebar pill selection*, and the *Liquid Glass refraction*. The Electron renderer can copy every single one of these via CSS, `backdrop-filter`, SVG filters, and `chokidar` file-watching.

The mental model: the user is in a **terminal session window** running Claude. They press a sidebar toggle. A **vault drawer** slides in from the right or left of the terminal frame. Inside the drawer they see three columns:

```
[ TAG / FOLDER COLUMN ] [ FILE LIST COLUMN ] [ PREVIEW + PASTE BUTTON ]
```

That's it. That's Apple Notes. That's Bear. That's Ulysses. That's what we steal.

---

## 2. Apple Notes — the canonical three-pane

### Macro layout

Apple Notes on the Mac is the most-shipped, most-tested three-pane interface on the planet. The structure is:

| Column | Width | Content |
|---|---|---|
| **Sidebar** (folders + tag pane) | ~220 px (resizable) | iCloud account, folders tree, smart folders (gear icon), Tags browser at the bottom |
| **Note list** | ~280 px (resizable) | Pinned section (sticky), then notes sorted by date/edited/title; each row shows title + 2-line preview + timestamp |
| **Note editor** | flex 1 | The actual note content |

The sidebar can be hidden entirely by dragging its separator all the way left, leaving a two-pane list+editor layout. macOS users can toggle **View → Show Folders / Hide Folders**, **View → as Gallery**, **View → as List**.

### The pinned section

Pinned notes appear in a separate **"Pinned"** section at the top of every folder's list, with a small disclosure arrow that lets the user collapse it. The section is sticky as you scroll — *pinned never leaves the viewport*. Below pinned comes the normal sorted list. This is exactly what the EZvibes vault needs for **hand-off `.md` files** — they should be pinned automatically so that "the file the other Claude session just dropped" is always at the top of the vault.

### The Tags browser

Once you add a `#tag` inline in any note, the tag appears in a **"Tags"** section pinned to the bottom of the folder list view. From macOS Monterey forward the Tags browser is its own collapsible region. Tags are flat (Apple Notes does not nest tags like Bear does — that is a Bear-specific feature). Tapping a tag filters the note list to just notes with that tag.

### Smart Folders

Smart Folders are virtual folders defined by **filter rules** rather than physical location. They appear in the sidebar with a **gear icon** (the only visual cue that distinguishes them from regular folders). Available filter dimensions on macOS:

- **Tags** — has all of / any of / none of a tag set
- **Date Created** — before / after / between
- **Date Edited** — before / after / between
- **Shared** — yes / no
- **Mentions** — contains an @-mention
- **Checklists** — contains a checklist
- **Attachments** — has an image / PDF / scan / video / link / drawing
- **Folders** — note is in folder X
- **Quick Notes** — was captured as a quick note
- **Pinned Notes** — is currently pinned
- **Locked** — is password-locked

A user can chain multiple filters with **All / Any** semantics (AND / OR). The smart folder updates live — when a note acquires a matching tag or a new attachment, it slides into the smart folder instantly.

### Gallery view

`View → as Gallery` switches the middle column from a vertical list of rows to a **2D grid of thumbnail cards**. Each card shows: small preview image (if the note has an image near the top), title, snippet, date. Users can pinch-zoom on iPad to change card density. For the EZvibes vault, this is a great alternative to the row-based list when the user has dozens of short snippets — visually scanning a 3-column grid of "title cards" is faster than scrolling a single-column list.

### Three-pane CSS scaffold

A minimal Electron port of this three-pane structure:

```html
<aside class="vault">
  <nav class="vault__sidebar">…folders + tags…</nav>
  <div class="vault__list">…file rows…</div>
  <main class="vault__preview">…markdown render + paste button…</main>
</aside>
```

```css
.vault {
  display: grid;
  grid-template-columns: 220px 280px 1fr;
  height: 100%;
  background: rgba(28, 28, 30, 0.72);          /* macOS Tahoe sidebar tint */
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  backdrop-filter: blur(40px) saturate(180%);
  color: #e5e5ea;
  font-family: -apple-system, "SF Pro Text", "Segoe UI Variable", system-ui, sans-serif;
}

.vault__sidebar,
.vault__list {
  border-right: 1px solid rgba(255,255,255,0.08);
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.vault__row {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 2px;
  padding: 10px 14px;
  border-radius: 8px;
  margin: 2px 6px;
  cursor: default;
}

.vault__row:hover { background: rgba(255,255,255,0.06); }

.vault__row[aria-selected="true"] {
  background: rgba(10, 132, 255, 0.85);        /* macOS system blue */
  color: white;
}
```

The `grid-template-columns: 220px 280px 1fr` is *exactly* the Apple Notes proportion on a 1440-wide window. Resizing the separators is a vanilla JS pointer-drag updating those grid track sizes.

---

## 3. Apple Notes iOS 26 / macOS Tahoe 26 Liquid Glass redesign

WWDC 2025 (June 9, 2025) introduced **Liquid Glass** — Apple's most significant material change since iOS 7's flat design. Liquid Glass is a translucent, dynamically refracting material applied across the entire OS: dock, sidebar, toolbar, tab bars, menus, sheets, and even desktop icons in Tahoe.

### What changed for Notes specifically

According to 9to5Mac's iOS 26 Notes roundup and MacRumors' iOS 26 guide, the changes are:

- **Toolbar** has rounded corners and a frosted glass look. Buttons at the top are circles or pills with the Liquid Glass effect.
- **Search bar** moved to the bottom of the Folders view, always visible (no more pull-down to reveal).
- **Adaptive toolbar** above the keyboard changes contextually (formatting tools when typing text, list tools when a checklist row is selected).
- **Toolbar horizontal swipe** — users can swipe through the toolbar to reveal more tool options instead of tapping to expand a submenu.
- **Markdown export/import** is now native (`.md` files via the share sheet — directly relevant to EZvibes).
- **Line spacing** throughout the app was bumped for readability.
- **App icon** redesigned, multi-layered, refractive.
- **Folder customization** — folders can now be tinted in seven colors (Green, Red, Orange, Blue, Purple, Gray, Yellow) and stamped with an emoji or SF Symbol in the center. This is now a system-wide pattern available in Files and Notes both.

### The Liquid Glass material properties

Liquid Glass has these documented physical behaviors:

1. **Refraction (lensing)** — content behind the glass is *displaced* (not just blurred), as if you were looking through real curved glass. Edges show stronger refraction than centers.
2. **Specular highlight** — a thin bright highlight runs along the top edge of a glass panel, responding to device tilt on iPhone/iPad.
3. **Adaptive shadow** — a soft shadow underneath the panel that respects the content beneath, not a fixed `rgba(0,0,0,0.2)`.
4. **Dynamic tint** — Apple's API supports `.regular`, `.clear`, and tinted variants. The glass *adapts to the brightness of content behind it* — dark content → glass goes darker, light content → glass goes lighter.
5. **Morphing** — when a glass element transitions (button → sheet → toolbar), the effect *morphs* with a fluid animation rather than cross-fading.

In SwiftUI you get this with `.glassEffect(.regular, in: RoundedRectangle(cornerRadius: 20))` and `GlassEffectContainer`. In CSS you get an approximation with `backdrop-filter`, gradients, and (in Chromium) SVG `feDisplacementMap`. See section 9.

### macOS Tahoe sidebar specifics

In iPadOS and macOS, the new sidebars **refract content behind them, while reflecting the user's wallpaper from around them**. The implication: the sidebar is no longer a flat slab next to the content — it's a piece of frosted glass *floating above* the content, with the content area extending edge-to-edge beneath it. Apps like the new Apple TV and Apple Music show this pattern most clearly.

For an Electron vault drawer, this means: don't paint the drawer with a solid dark color. Paint it with `rgba(28, 28, 30, 0.62)` + `backdrop-filter: blur(40px)`. The xterm content behind the drawer is *visible through* the drawer, with a soft frosted blur. This is the single biggest "feels native" upgrade we can ship.

### Folder customization (color + emoji)

Tahoe 26 adds folder icon customization to Finder and Notes:

| Available colors | Hex (approx) |
|---|---|
| Red | `#FF453A` |
| Orange | `#FF9F0A` |
| Yellow | `#FFD60A` |
| Green | `#30D158` |
| Blue | `#0A84FF` (default) |
| Purple | `#BF5AF2` |
| Gray | `#98989D` |

Users can additionally place an emoji or SF Symbol in the center of the folder icon. For the EZvibes vault this means: when the user has `prompts/`, `handoffs/`, `claude-md/` folders, each can carry a color + emoji that the vault sidebar reads from `.vaultmeta.json` (or similar) and renders.

---

## 4. Bear — typography-first markdown + nested tags + TagCons

Bear is the markdown-first counterpart to Apple Notes. It is the most aesthetically influential markdown app on Mac, and it has *the best tag UX of any consumer app*.

### Layout

Bear is a **three-pane layout**:

| Column | Content |
|---|---|
| **Sidebar** | Notes (all), Untagged, Trash, Archive, plus the entire tag tree (with nested disclosure) |
| **Note list** | Title + first line preview + date + tag chips per row |
| **Editor** | Live-preview markdown with hidden syntax (`**bold**` renders as **bold** as you type) |

### Red Graphite color palette (default theme)

Blake Crosley's design study documents these exact values:

```
Accent (Bear red):    #D14C3E
Sidebar background:   #F7F7F7   (light)
Editor background:    #FFFFFF
Primary text:         #333333
Secondary text:       #888888
Code background:      #F5F5F5
Tags:                 #D14C3E
```

Dark Graphite (Bear's classic dark) inverts to:

```
Background:           #1E1E1E   (true graphite, not black)
Sidebar tint:         #252525
Text:                 #E5E5E5
Secondary text:       #888888
Accent:               #FF6B5A   (slightly warmer red for dark)
```

OLED variant **Dieci** uses `#000000` for battery efficiency.

### Nested tag system (this is the big one)

Bear is uniquely good at hierarchical organization via tags. You type `#work/active/project-alpha` and Bear automatically builds the tree in the sidebar:

```
▼ work
  ▼ active
    • project-alpha
    • project-beta
  ▶ archive
▼ personal
  …
```

The forward slash is the only delimiter. Each level shows a disclosure caret. Levels nest infinitely. Clicking a parent shows *all* notes tagged with that parent or any child. Clicking a leaf shows only that leaf.

**For EZvibes vault:** users will dump `.md` files into subfolders like `prompts/coding/refactor.md` or `handoffs/claude-to-codex/auth-system.md`. The sidebar can mirror Bear's nesting exactly — render the actual filesystem tree with disclosure carets. Don't use a fancy alternative pattern, this one is solved.

### TagCons (Bear 2.7, March 2026)

In March 2026 Bear shipped a major redesign of TagCons: tag-attached icons that appear *next to* the tag chip in both sidebar and editor. The library expanded from ~40 to **260 TagCons**, covering: writing, travel, business, games, ideas, wildlife, sports, pop culture, hobbies. The icons are auto-applied by string matching (e.g. `#travel` → suitcase icon).

Users can also use emoji directly in tag names (`#🏡home`, `#🏢work`) and these sort to the top of the sidebar alphabetically.

**For EZvibes vault:** map common folder names to icons. `prompts/` → wand icon, `handoffs/` → arrow-right icon, `CLAUDE.md` lives → robot icon, `agents.md` → people icon. Show each folder row with a small 16px monochrome SF-style glyph + the name + (optionally) a tail count of `.md` files inside.

### Typography settings

Bear gives users granular control:

- **Font** — any installed OS font; defaults include Avenir Next, Helvetica, custom Bear typeface
- **Size** — 11pt to 24pt
- **Line height** — default `1.6` multiplier; range 1.2–2.0
- **Line width** — narrow (~60 ch), comfortable (~75 ch), wide (full)
- **Paragraph spacing** — controllable

Maximum editor line width is 680 px (about 75 characters) — that's the optimal scanline length for serif/sans body copy.

### Sidebar typography rule of thumb

Per the design study, sidebar labels are 13–14 px (large enough to scan, small enough to fit), `font-weight: 500`, with `letter-spacing: -0.01em` for tightness. Hover states do *not* change color — they shift the background by `~6%` lightness. Selected states use the accent color with white text.

---

## 5. Day One — timeline, photo grid, calendar, map

Day One is a journal app, but its **multi-view shell** is the most over-engineered timeline UI on the Mac. It offers four orthogonal views of the same dataset:

| View | What it shows |
|---|---|
| **Timeline** | Chronological list, newest first, with date headers and inline thumbnails |
| **Photos** | Pure media gallery — all images extracted from all entries, grid layout, filterable |
| **Map** | Map pins for entries with geolocation; clicking a pin opens that entry |
| **Calendar** | Month grid; days with entries are tinted; favorited photo shown as the date's image |

A button bar at the top lets you switch instantly. Clicking the same view icon twice scrolls to the top — a tiny detail that prevents long scroll-back-to-top journeys.

### The 2023 timeline redesign (and its criticism)

Day One redesigned the Timeline in 2023.15 to a card-based layout with bigger photos. The Day One forums lit up — users wanted to see 8 entries on screen but the new design only showed 5.5, and 2–3 photo entries got their image split awkwardly. Lesson learned: **respect information density**. A vault drawer should not waste vertical space.

### Multi-photo entry layout

Day One uses a smart layout for entries with multiple photos:

- 1 photo → big square
- 2 photos → side-by-side
- 3 photos → one large left + two small stacked right
- 4+ photos → 2×2 grid with "+N" overlay on the last

This is the Instagram pattern — and worth stealing for EZvibes if a prompt `.md` includes multiple code-fence blocks, we can show "3 code blocks" as a small tile preview.

### Patterns we can steal

1. **Multi-view shell** — Timeline / Gallery / Map / Calendar. For the prompt vault, "Map" doesn't apply, but **Timeline (by `mtime`)** and **Gallery (by title + token count + tag chip)** absolutely do.
2. **Date headers** — sticky date headers ("Today", "Yesterday", "This week", "2 weeks ago", "October 2024") above timeline rows. Sticky header sticks to top of viewport as you scroll. Gives a constant sense of time.
3. **"Today" button** — a floating quick-return button.
4. **Favorited entries** — starred items get a special tint and sort first within their date group.

### Sticky date header CSS

```css
.vault__date-header {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 6px 14px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.55);
  background: rgba(28, 28, 30, 0.85);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
```

That `backdrop-filter` on the sticky header is critical — as you scroll, content slides *under* the header and the header keeps reading because of the blur.

---

## 6. Drafts — capture-first + Workspaces (saved searches)

Drafts is the spiritual ancestor of the "blank page that's always one tap away" pattern. It launches *into* a blank editor — typing immediately starts a new draft, no decision required.

### Workspaces

The killer feature for our purposes is **Workspaces** — saved combinations of filters that the user can swap between with one tap. A workspace bundles:

- **Tag filters** — All / Any / Not, multi-tag logic with `!` prefix to exclude
- **Search query** — a fixed text query
- **Date filter** — created/modified/accessed before/after
- **Sort order** — per-tab (Inbox, Flagged, Archive, All)
- **Display options** — show/hide preview body, recent actions, tags
- **Active list tab** — which tab loads on open
- **Action group** — which actions appear in the toolbar
- **Theme** — optional theme override

The UI is a downward chevron in a circle above the draft list. Tap to open a popover of saved workspaces. Swipe left on one to edit. Share button exports the workspace as a `.draftsWorkspace` file.

**For EZvibes vault:** this is exactly the pattern for **saved prompt collections**. A user might want:

- "All hand-offs received in the last 24h" (a smart filter)
- "My Claude system prompts" (tag = `system-prompt`)
- "Codex refactor prompts" (tag = `codex` AND tag = `refactor`)
- "Pinned prompts for this folder" (pinned = true AND folder = current)

These could live as **Workspaces** in the vault sidebar, accessible via a small chevron at the top.

### Multi-tag mode

In Drafts you can chain multiple tags. The mode toggle is between "any" (OR) and "all" (AND) — and you can exclude tags by tapping them once more to put `!` in front. This is more powerful than Apple Notes' filter UI because it lets you build set algebra: `#work AND #urgent AND NOT #archived`.

### Capture-first philosophy

Drafts opens to a blank document with the cursor blinking. Typing creates a draft instantly, no save action required. This is "capture before classify" — type first, decide what folder/tag it belongs to later. The implication for EZvibes: the vault should also have a **"Quick Capture" button** that opens a new empty `.md` in the current folder, focus immediately on the body. The handoffs flow especially benefits — you might want to dump a thought from one Claude session into the vault for another session to pick up.

---

## 7. iA Writer — Library / Organizer + Focus Mode

iA Writer's interface is famously minimal: a three-pane structure that collapses gracefully.

### Library layout

| Pane | Content |
|---|---|
| **Organizer** | List of *file locations* — iCloud Drive, Dropbox, Google Drive, OneDrive, local. Tap a location to view its tree. |
| **File List** | Flat list of files in the selected location/folder, with folders inline |
| **Editor** | Markdown editor |
| **Preview** | (optional 4th pane) Rendered HTML preview |

Files sort by Modification Date / Name / Kind. Folders and subfolders appear inline in the list with a small folder icon.

The Organizer is meta — it's a list of *where files live* rather than *what they contain*. For EZvibes this is the equivalent of "Recent folders", "Pinned folders", "All `CLAUDE.md` files anywhere", "All `handoff*.md` files anywhere". It's a level-0 router above the actual file tree.

### Focus Mode

iA Writer's Focus Mode has three sub-modes:

| Mode | Effect |
|---|---|
| **Sentence** | Fades all sentences except the one you're typing in to ~30% opacity |
| **Paragraph** | Fades all paragraphs except the current one |
| **Typewriter** | Vertically centers the current line in the editor; lines scroll past as you type |

The editor uses iA's custom monospaced typefaces:

- **iA Mono** — true monospace
- **iA Duo** — duospaced (i, l, t are narrow; m, w are wide)
- **iA Quattro** — four-width variable monospace

For the vault preview pane, a duospaced font like Quattro would beautifully render code-fenced markdown with terminal-feel monospace but readable prose.

### Quick Tour design

The interface shows toggleable icons at the top corners — `cmd+1` toggles Library, `cmd+2` toggles Preview. This pattern (`cmd+1` / `cmd+2` / `cmd+3` for sidebar / list / editor) is shared with Ulysses. For EZvibes, mapping `Ctrl+1`/`Ctrl+2`/`Ctrl+3` to the vault's three panes would be familiar to anyone coming from Mac.

---

## 8. Ulysses — the gold standard four-pane writing app

Ulysses pushes the pattern further than anyone else with **four panes**:

| Pane | Width | Content |
|---|---|---|
| Group sidebar | ~200 px | Library — top-level groups (Inbox, Projects, Notes, Trash), filters, custom groups |
| Sheet list | ~250 px | List of sheets in the selected group |
| Editor | flex 1 | Markdown editor |
| Attachments | ~250 px | Sheet attachments, notes, keywords, goals, images |

Keyboard shortcuts:

- `⌘1` → toggle Library (group sidebar)
- `⌘2` → toggle sheet list
- `⌘3` → editor only
- `⌘4` → toggle Attachments

### Responsive collapsing

When the window is narrow (or in Apple's Fullscreen Split View), Ulysses **automatically collapses** sidebars so the editor stays usable. Collapsed sidebars then re-open as **overlays on top of the editor**, not as additional columns. Clicking back in the editor dismisses them.

### Group customization

Each Group (folder) can have:

- A custom icon (from a built-in set of ~50 SF-symbol-style glyphs)
- A custom color (~12 colors)
- A name
- A description (markdown)
- Goal tracking (word count target)

This visual color-coding plus icon-coding makes the sidebar instantly scannable. For EZvibes: extend the existing folder-color customization concept by letting each vault subfolder have an icon + color + optional description that shows as a header above its file list.

### Two-finger swipe sidebars

Ulysses opens/closes the Library and Attachments sidebars with a **two-finger horizontal swipe on the trackpad**. On Magic Mouse it's a one-finger swipe. This is a great power-user pattern — and Electron supports it via `scroll-touch-down` / `scroll-touch-up` events + wheel events for swipe gestures.

---

## 9. Liquid Glass for Electron — CSS + SVG ports

Electron renderers are Chromium. That means: full `backdrop-filter` support, full SVG filter support, full CSS Houdini paint workers. We can replicate Liquid Glass at ~80% fidelity using pure web tech.

### Tier 1 — Basic frosted glass (works everywhere)

```css
.vault-glass {
  background: rgba(255, 255, 255, 0.12);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);  /* top edge highlight */
}
```

The two CSS box-shadows are critical:

1. `0 8px 32px rgba(0,0,0,0.35)` — soft drop shadow under the panel
2. `inset 0 1px 0 rgba(255,255,255,0.22)` — **one-pixel inset highlight at the top edge** — this is the "specular highlight" that sells the glass feeling

### Tier 2 — Multi-layer with shine pseudo-element

From Kevin Bismark's DEV.to article on recreating Liquid Glass:

```css
.glass {
  position: relative;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(2px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 2rem;
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.2),
    inset 0 4px 20px rgba(255, 255, 255, 0.3);
}

.glass::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(1px);
  box-shadow:
    inset -10px -8px 0 -11px rgba(255, 255, 255, 1),
    inset   0px -9px 0  -8px rgba(255, 255, 255, 1);
  opacity: 0.6;
  z-index: -1;
  filter: blur(1px) drop-shadow(10px 4px 6px rgba(0,0,0,0.6)) brightness(115%);
}
```

The `::after` pseudo-element adds a *bottom-edge highlight* using clever inset shadows — the `-10px -8px 0 -11px` creates a thin bright line that wraps the bottom-right corner. That diagonal asymmetry is what makes the glass look *lit from above-left*.

### Tier 3 — SVG displacement refraction (Chromium / Electron only)

Apple's real Liquid Glass distorts content beneath the glass — light bends as it crosses the curved surface (Snell's law, n₁sin(θ₁) = n₂sin(θ₂), with n=1.5 for glass). CSS `backdrop-filter: blur()` only blurs; it doesn't *displace*. To displace pixels you need SVG's `<feDisplacementMap>`.

The technique (kube.io, nikdelvin's `liquid-glass` repo):

1. Generate a **displacement map** image where red and green channels encode X/Y offsets per pixel.
2. Reference it via an inline SVG filter using `feImage` → `feDisplacementMap`.
3. Apply the filter to the panel via `backdrop-filter: url(#filterId)`.

```html
<svg style="position:absolute; width:0; height:0;">
  <filter id="liquidGlass" color-interpolation-filters="sRGB">
    <feImage href="data:image/png;base64,…displacementMap…" result="dispMap"/>
    <feDisplacementMap in="SourceGraphic" in2="dispMap" scale="20"
                       xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="2"/>
  </filter>
</svg>
```

```css
.vault-glass-pioneer {
  backdrop-filter: url(#liquidGlass);
}
```

The `scale="20"` means "displace pixels up to ±10 px based on red/green channel intensity". The displacement map is procedurally generated — encode a "convex circle" surface profile (bigger displacement near edges, zero in the center) and you get a magnifying-glass look. Encode a "lip" profile and you get a button-bezel look.

Generating the map: red = `128 + cos(angle) × magnitude × 127`, green = `128 + sin(angle) × magnitude × 127`, where `angle` and `magnitude` come from the height-derivative of your chosen surface function.

**Caveat:** only Chromium supports SVG filters as `backdrop-filter`. Electron is Chromium, so we're fine. Safari falls back gracefully to plain blur.

### Tier 4 — Interactive lensing on hover

To make panels feel "alive", listen to pointer position and update a CSS custom property that controls a radial gradient:

```css
.vault-card {
  background:
    radial-gradient(circle at var(--mx, 50%) var(--my, 50%),
                    rgba(255,255,255,0.18) 0%,
                    rgba(255,255,255,0.06) 60%,
                    transparent 100%),
    rgba(255,255,255,0.10);
  transition: background-position 80ms ease-out;
}
```

```js
card.addEventListener('pointermove', e => {
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
});
```

A subtle bright spot follows your cursor across the panel. This is what makes Apple's Liquid Glass feel responsive — and we can ship it in 8 lines of CSS + JS.

### Tier 5 — Color-adaptive tint

Liquid Glass adapts: dark content beneath → glass goes darker; light content beneath → glass goes lighter. To replicate, sample the average color of the area behind the panel periodically (`document.elementFromPoint` + `getComputedStyle`, or for `<canvas>` content read pixels) and update a CSS custom property `--vault-tint`. The panel background becomes `color-mix(in oklch, var(--vault-tint) 30%, rgba(255,255,255,0.10))`.

This is overkill for a first version but is the single thing that separates "frosted glass" from "Liquid Glass".

---

## 10. Smart Folders — implementation rules for a `.md` vault

Smart Folders in Apple Notes, Drafts Workspaces in Drafts, and Filters in Ulysses all map to the same underlying primitive: **a saved query that re-runs every time you open it**. For a markdown vault, the query operates on filesystem metadata + file contents.

### Filter dimensions to support

| Dimension | Source | Example query |
|---|---|---|
| Filename pattern | filesystem | `*.md`, `handoff-*.md`, `CLAUDE.md` |
| Path glob | filesystem | `prompts/**/*.md` |
| Frontmatter tag | parsed YAML | `tags: [refactor, urgent]` |
| Inline `#tag` | parsed body | `#claude-prompt` anywhere in body |
| Modification date | `fs.stat` `mtime` | `> 24h ago`, `between Mar 1–Mar 15` |
| Creation date | `fs.stat` `birthtime` | `> 7 days ago` |
| Size | `fs.stat` `size` | `< 1 KB`, `> 10 KB` |
| Token count | `gpt-3-tokenizer` estimate | `< 100 tokens` |
| Contains text | full-text search | "claude --dangerously-skip-permissions" |
| Has code fence | regex on body | `\`\`\`[a-z]*\n` |
| Pinned | sidecar `.vaultmeta.json` | `pinned: true` |
| Type guess | extension or content | `handoff`, `prompt`, `claude-md`, `system-prompt` |

### Smart Folder definitions (JSON schema)

```jsonc
{
  "id": "smart-recent-handoffs",
  "name": "Recent hand-offs",
  "icon": "📥",
  "color": "#FF9F0A",
  "filters": {
    "match": "all",                 // "all" = AND, "any" = OR
    "rules": [
      { "field": "filename", "op": "glob", "value": "handoff-*.md" },
      { "field": "mtime",    "op": "within", "value": "24h" }
    ]
  },
  "sort": "mtime-desc",
  "view": "list"                    // "list" | "gallery" | "timeline"
}
```

Default smart folders for the EZvibes vault:

1. **All hand-offs** — `filename = handoff-*.md OR tag = handoff`
2. **Today** — `mtime within 24h`
3. **This week** — `mtime within 7d`
4. **Pinned** — `pinned = true`
5. **Untagged** — `tags == []`
6. **`CLAUDE.md` directives** — `filename = CLAUDE.md OR filename = claude.md OR filename matches \\.claude\\.md$`
7. **System prompts** — `tag = system-prompt`
8. **Last from Codex** — `frontmatter.from = codex AND mtime within 24h`

### Live-updating with chokidar

```js
const chokidar = require('chokidar');
const watcher = chokidar.watch(vaultRoot, {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 100 },
});
watcher
  .on('add',    p => indexer.upsert(p))
  .on('change', p => indexer.upsert(p))
  .on('unlink', p => indexer.remove(p));
```

On every event, re-run all active smart folder queries against the in-memory index and broadcast the updated lists to the renderer via IPC. Debounce to ~60 ms so multiple changes coalesce.

`awaitWriteFinish` is critical for cross-session hand-offs: when another Claude session writes a 50 KB markdown file, you don't want the watcher to fire while the file is half-written.

---

## 11. Sidebar polish — selection, hover, scrolling, drag-reorder

### Selection pill (macOS Tahoe style)

```css
.vault__row {
  margin: 1px 6px;
  padding: 8px 12px;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 16px 1fr auto;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  color: rgba(255,255,255,0.86);
  transition: background-color 120ms ease;
}

.vault__row:hover {
  background: rgba(255,255,255,0.06);
}

.vault__row[aria-selected="true"] {
  background: rgba(10, 132, 255, 0.85);   /* SF blue, alpha so wallpaper bleeds */
  color: white;
}

.vault__row[aria-selected="true"]:focus-visible {
  outline: 2px solid rgba(255,255,255,0.5);
  outline-offset: -2px;
}
```

The selection background uses `rgba` not solid hex — when combined with the `backdrop-filter` on the parent, this lets a hint of wallpaper bleed through, which is exactly how Tahoe selection pills look.

### Hover state subtlety

Bear's design study notes: hover states should NOT change text color; they shift the background by ~6% lightness. Aggressive hover color changes feel "webby". Subtle background shifts feel "native".

### Momentum / overscroll

```css
.vault__list {
  overflow-y: auto;
  overscroll-behavior: contain;            /* prevent rubber-band bleed to window */
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}

.vault__list::-webkit-scrollbar { width: 8px; }
.vault__list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 4px;
}
.vault__list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
.vault__list::-webkit-scrollbar-track { background: transparent; }
```

Electron on macOS can enable `scrollBounce` on the `BrowserWindow` to get rubber-band overscroll. On Windows we can fake the same with a small JS scroll overshoot + `transform: translateY` snap-back.

### Drag-to-reorder (vanilla, no library)

The pattern from LogRocket and CSS-Tricks:

```js
let dragRow = null;
list.addEventListener('dragstart', e => {
  dragRow = e.target.closest('.vault__row');
  dragRow.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
});
list.addEventListener('dragover', e => {
  e.preventDefault();
  const after = getDragAfterElement(list, e.clientY);
  if (after == null) list.appendChild(dragRow);
  else list.insertBefore(dragRow, after);
});
list.addEventListener('dragend', () => dragRow?.classList.remove('is-dragging'));

function getDragAfterElement(container, y) {
  const rows = [...container.querySelectorAll('.vault__row:not(.is-dragging)')];
  return rows.reduce((closest, row) => {
    const box = row.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: row };
    return closest;
  }, { offset: -Infinity }).element;
}
```

Style:

```css
.vault__row.is-dragging {
  opacity: 0.4;
  transform: scale(0.98);
}

.vault__row { transition: transform 200ms ease, opacity 120ms ease; }
```

The midpoint-detection (the `offset < 0` test) is what gives drag-to-reorder its "decisive" feel — the drop indicator snaps to the nearest gap rather than tracking the raw cursor.

---

## 12. Concrete architecture for the EZvibes prompt vault

Putting it all together — a recommended implementation for the EZvibes:

### Filesystem layout

```
<session-folder>/
  .vault/
    handoffs/
      handoff-2026-05-25-auth-system.md
      handoff-2026-05-25-cleanup.md
    prompts/
      coding/
        refactor.md
        explain-this.md
      writing/
        summarize.md
    CLAUDE.md
    .vaultmeta.json     ← pinned, custom names, smart folders, ordering
```

`.vaultmeta.json` example:

```json
{
  "smartFolders": [
    { "id": "recent-handoffs", "name": "Recent hand-offs",
      "icon": "📥", "color": "#FF9F0A",
      "filters": { "match": "all", "rules": [
        { "field": "path", "op": "glob", "value": "handoffs/**/*.md" },
        { "field": "mtime", "op": "within", "value": "24h" }
      ]}
    }
  ],
  "pinned": ["CLAUDE.md", "handoffs/handoff-2026-05-25-auth-system.md"],
  "folderMeta": {
    "prompts/": { "icon": "wand", "color": "#0A84FF" },
    "handoffs/": { "icon": "tray", "color": "#FF9F0A" }
  }
}
```

### Three-pane shell (HTML)

```html
<aside class="vault" data-state="open">
  <header class="vault__header">
    <button class="vault__toggle" aria-label="Toggle vault"></button>
    <div class="vault__title">Vault</div>
    <button class="vault__capture" aria-label="New prompt"></button>
  </header>

  <div class="vault__body">
    <nav class="vault__sidebar">
      <section class="vault__section">
        <h3>Smart Folders</h3>
        <ul>
          <li data-id="recent-handoffs" data-smart>
            <span class="vault__icon">📥</span>
            <span class="vault__label">Recent hand-offs</span>
            <span class="vault__count">3</span>
          </li>
          <li data-id="today" data-smart>…</li>
          <li data-id="pinned" data-smart>…</li>
        </ul>
      </section>
      <section class="vault__section">
        <h3>Folders</h3>
        <ul class="vault__tree" data-tree>
          <!-- recursive folder tree with disclosure carets -->
        </ul>
      </section>
    </nav>

    <div class="vault__list">
      <div class="vault__date-header">Today</div>
      <article class="vault__row" data-path="handoffs/handoff-2026-05-25-auth-system.md" aria-selected="true">
        <span class="vault__row-icon">📄</span>
        <div class="vault__row-body">
          <div class="vault__row-title">handoff-auth-system</div>
          <div class="vault__row-preview">The auth system needs OAuth2 PKCE flow…</div>
        </div>
        <div class="vault__row-meta">
          <span class="vault__row-time">2m</span>
          <button class="vault__row-paste" title="Paste into terminal">⌘V</button>
        </div>
      </article>
      …
    </div>

    <main class="vault__preview">
      <header class="vault__preview-header">
        <h2>handoff-auth-system.md</h2>
        <div class="vault__preview-actions">
          <button class="vault__action-paste">Paste into Tab</button>
          <button class="vault__action-copy">Copy</button>
          <button class="vault__action-pin">Pin</button>
        </div>
      </header>
      <article class="vault__preview-body markdown-rendered">…</article>
    </main>
  </div>
</aside>
```

### Paste-into-terminal IPC

Tie the **Paste** button (and double-click on a row) to an IPC call:

```js
// renderer
btn.addEventListener('click', () => {
  const path = row.dataset.path;
  const content = await vaultStore.read(path);
  await ezvibes.writeTerminal(activeTabId, content);
  flashRow(row, 'pasted');
});
```

```js
// main.js — already has terminal:input
// just pass the markdown content as the input to the active tab's PTY
ipcMain.handle('terminal:input', (e, sessionId, text) => {
  const session = sessions.get(sessionId);
  session?.pty.write(text);
});
```

The **flash** animation is the chef's kiss — a brief golden glow on the row that confirms the paste happened. Borrow Bear's tag-flash idea:

```css
@keyframes paste-flash {
  0% { background: rgba(255, 214, 10, 0.85); }
  100% { background: var(--row-bg, transparent); }
}
.vault__row.is-pasted { animation: paste-flash 600ms ease-out; }
```

### Cross-session hand-offs (the killer feature)

When a different Claude session writes `handoffs/handoff-X.md`, chokidar fires `add`. The vault's smart folder query re-runs. The "Recent hand-offs" smart folder count jumps from 0 to 1, with a brief number badge pulse. The user — sitting in *this* session — sees the new file appear at the top of the list automatically, and a small toast notification:

> *📥 New hand-off received — `handoff-auth-system.md`*

Clicking the toast scrolls the vault to that row, selects it, and shows the preview. One click on the Paste button drops it into the terminal.

This is the genuine "pioneer-level" interaction: **AI sessions communicating with each other through a shared filesystem inbox, with live UI updates and one-click paste**.

### Keyboard model

| Shortcut | Action |
|---|---|
| `Ctrl+\`  | Toggle vault drawer |
| `Ctrl+1` | Focus sidebar (folders + smart folders) |
| `Ctrl+2` | Focus file list |
| `Ctrl+3` | Focus preview |
| `↑ / ↓` (in list) | Move selection |
| `Enter` (in list) | Paste into active terminal |
| `Cmd/Ctrl+Enter` | Paste + close vault drawer |
| `Cmd/Ctrl+N` (in vault) | New blank `.md` capture in current folder |
| `Cmd/Ctrl+K` | Open command palette / quick switcher |

The quick switcher (`Ctrl+K`) is borrowed from Obsidian's Better Command Palette plugin: a centered popover with a fuzzy search input that matches against all `.md` files in the vault. Type → see matches → arrow keys → Enter pastes.

---

## 13. Pioneer-level ideas + one bold suggestion

The conventional patterns from sections 2–11 will give you a solid native-feeling vault. But the user asked for **"pioneer-level cool"**. Here are the bold moves:

### 1. Live "hand-off inbox" toast + ambient unread badge

When another session writes to the vault, surface it with:

- A momentary translucent toast across the bottom of the terminal frame ("New hand-off: `auth-system.md` from Codex session"), with two buttons: **Paste** | **Dismiss**.
- A subtle pulsing badge on the vault toggle button.
- The orange "session is busy" tint on the source folder card in the main grid.

### 2. Vault as an inverted Liquid Glass *lens* over the terminal

Don't open the vault as a side drawer. Open it as a **circular glass lens** that the user drags over their terminal. Inside the lens: the file list, rendered as a vertical scroll wheel like the iOS picker. Spin the wheel with mouse-wheel; the selected file shows its title in a label below the lens; click to paste. **This is a literal "magnifying glass over the codebase" metaphor.** Snell-displacement makes the terminal text behind the lens appear *magnified* and *bent*, just like a real magnifier.

### 3. Diffview between hand-offs

When two hand-off `.md` files have similar names (`handoff-auth-v1.md`, `handoff-auth-v2.md`), the vault can offer a **side-by-side diff view** in the preview pane. This makes iterative AI hand-offs ("here's v2 of my plan") visible and traceable.

### 4. Token-budget visualizer per file

Each file row shows a thin colored bar under the title indicating its token count relative to a budget (e.g. 200K tokens). The bar fills green → yellow → red. Hover shows "~3,200 tokens". This tells the user at a glance which prompts are too big to drop wholesale.

### 5. Live-render markdown in the row preview

Instead of showing raw `# heading` and `**bold**` in the row preview, render the first 80 characters of the markdown *with* formatting. Headings show big and bold, code shows in mono font, etc. This is how Notion previews look in their gallery.

### 6. Drag a file from vault → into the terminal pane

Direct drag-and-drop of a `.md` row onto the terminal area pastes its contents. The drop zone highlights with a green outline as you hover. This sidesteps the need to click the Paste button at all.

### 7. **THE BIG IDEA: A "Vault Map" view**

(This is my single recommendation as the pioneer move.)

Instead of (or in addition to) a list, offer a **2D spatial map** view of the vault — every `.md` file is a small Liquid-Glass card floating in a constellation. Cards are clustered by tag/folder. Cards that hand off between sessions are connected by faint lines. The user can pan and zoom with `wheel` + drag.

Why this is pioneer-level: it borrows from Day One's Map view, Apple's Photos Memories Map, Obsidian's Graph view, Heptabase's whiteboard, and Notion's Calendar — but applied to AI prompts. The user sees their **entire prompt history as a topology**. Hand-offs are arrows. Newest cards glow. Pinned cards have a gold halo.

Click a card → it zooms in (CSS `transform: scale()`) and reveals the preview. Click the Paste button on the card → it visibly *animates* down to the terminal and bursts into the tab. This is the kind of interaction nobody is shipping in 2026 because everyone is still doing list views.

CSS sketch:

```css
.vault-map {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center,
                              rgba(30,30,40,0.6) 0%,
                              rgba(10,10,20,0.95) 100%);
  overflow: hidden;
  cursor: grab;
}

.vault-map__card {
  position: absolute;
  width: 160px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.10);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.20);
  box-shadow:
    0 4px 24px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.25);
  transition: transform 280ms cubic-bezier(.2,.8,.2,1),
              box-shadow 280ms ease;
  cursor: pointer;
}

.vault-map__card:hover {
  transform: scale(1.08) translateZ(0);
  box-shadow:
    0 12px 36px rgba(0,0,0,0.6),
    inset 0 1px 0 rgba(255,255,255,0.4),
    0 0 0 1px rgba(10, 132, 255, 0.6);
}

.vault-map__card.is-pinned::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 14px;
  background: linear-gradient(135deg, #FFD60A, #FF9F0A);
  z-index: -1;
  opacity: 0.6;
  filter: blur(6px);
}

.vault-map__edge {
  position: absolute;
  height: 1px;
  background: linear-gradient(90deg,
                              transparent,
                              rgba(10,132,255,0.4),
                              transparent);
  transform-origin: left center;
  pointer-events: none;
}
```

Combine with the SVG displacement filter from section 9 and you get genuine Liquid Glass cards floating in a spatial map. **Nobody else has this.**

---

## 14. References / URLs

### Apple Notes / iOS 26 / macOS Tahoe Liquid Glass

- [Apple Newsroom — Apple introduces a delightful and elegant new software design](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- [macOS Tahoe — Wikipedia](https://en.wikipedia.org/wiki/MacOS_Tahoe)
- [MacRumors — macOS Tahoe roundup](https://www.macrumors.com/roundup/macos-26/)
- [MacRumors — 50 New macOS Tahoe Features](https://www.macrumors.com/2025/09/24/all-the-new-macos-tahoe-features/)
- [Apple Developer — Liquid Glass design gallery](https://developer.apple.com/design/new-design-gallery-2026/)
- [9to5Mac — Everything new for Apple Notes in iOS 26](https://9to5mac.com/2025/10/16/heres-everything-new-for-apple-notes-in-ios-26/)
- [MacRumors — iOS 26 Notes & Reminders guide](https://www.macrumors.com/guide/ios-26-notes-app-reminders-app/)
- [iDownloadBlog — Use color, emoji, or icons to customize folders](https://www.idownloadblog.com/2025/06/26/customize-mac-folder-icon/)
- [Successful Software — Updating application icons for macOS 26 Tahoe](https://successfulsoftware.net/2025/09/26/updating-application-icons-for-macos-26-tahoe-and-liquid-glass/)
- [Apple Support — Use Smart Folders in Notes on Mac](https://support.apple.com/guide/notes/use-smart-folders-apd58edc7964/mac)
- [The Sweet Setup — A Closer Look at Apple Notes's Smart Folders](https://thesweetsetup.com/a-closer-look-at-apple-notess-smart-folders/)
- [Apple Support — Use Tags and Smart Folders in Notes](https://support.apple.com/en-us/102288)
- [Apple Developer — Disclosure controls (HIG)](https://developer.apple.com/design/human-interface-guidelines/components/layout-and-organization/disclosure-controls)
- [Apple Developer — Sidebars (HIG)](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Apple Developer — Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)

### Liquid Glass implementation (CSS / SVG / SwiftUI)

- [Kube.io — Liquid Glass in the Browser: Refraction with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/)
- [GitHub — nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)
- [GitHub — conorluddy/LiquidGlassReference](https://github.com/conorluddy/LiquidGlassReference)
- [GitHub — dambertmunoz/dm-swift-swiftui-liquid-glass](https://github.com/dambertmunoz/dm-swift-swiftui-liquid-glass)
- [GitHub — naughtyduk/liquidGL](https://github.com/naughtyduk/liquidGL)
- [Liquid Glass Kit — Developer Resources](https://liquidglass-kit.dev/)
- [Yarinsa (Medium) — Creating Liquid Glass Effects with CSS](https://yarinsa.medium.com/creating-liquid-glass-effects-with-css-the-art-of-digital-transparency-ebda92699993)
- [DEV.to — Kevin Bismark — Recreating Apple's Liquid Glass Effect with Pure CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)
- [DEV.to — Ananthujp — Build a Mac-Style Liquid Glass UI](https://dev.to/ananthujp/build-a-mac-style-liquid-glass-ui-in-minutes-with-a-dock-navbar-more-4llo)
- [ekino-france (Medium) — Liquid Glass in CSS (and SVG)](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- [Inverness Design Studio — Glassmorphism in 2026](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
- [DesignFast — CSS Liquid Glass Effects](https://designfast.io/liquid-glass)
- [Mockplus — Liquid Glass Effect Design 2025](https://www.mockplus.com/blog/post/liquid-glass-effect-design-examples)
- [Skyscraper — Apple Liquid Glass in iOS 26: Complete SwiftUI Guide](https://getskyscraper.com/blog/apple-liquid-glass-ios-26-swiftui-guide)

### Bear

- [Bear FAQ — How to make nested tags](https://bear.app/faq/nested-tags/)
- [Bear FAQ — How TagCons work](https://bear.app/faq/how-tagcons-work/)
- [Bear FAQ — How to use tags in Bear](https://bear.app/faq/how-to-use-tags-in-bear/)
- [Bear FAQ — Editor Typography Options](https://bear.app/faq/typography-options/)
- [Bear FAQ — Free and Pro themes](https://bear.app/faq/about-free-and-pro-themes-in-bear/)
- [Bear Blog — Write your way with beautiful themes](https://blog.bear.app/2018/10/write-your-way-with-beautiful-themes-and-bear-pro/)
- [Bear Blog — Bear 2.7: A fresh look for TagCons](https://blog.bear.app/2026/03/bear-2-7-a-fresh-look-for-tagcons/)
- [Bear Blog — Bear Tips: TagCons](https://blog.bear.app/2018/08/bear-tips-make-your-important-tags-stand-out-with-tagcons/)
- [Bear Blog — Organize notes with nested tags](https://blog.bear.app/2017/08/bear-tips-organize-notes-with-tags-and-infinite-nested-tags/)
- [MacStories — Bear 1.5 review](https://www.macstories.net/reviews/bear-15-new-tag-icons-note-archiving-an-additional-export-option-and-more/)
- [Blake Crosley — Bear: Typography-First Writing design study](https://blakecrosley.com/guides/design/bear)
- [Bear Community — Panda Sneak Peek](https://community.bear.app/t/panda-sneak-peek-a-work-in-progress-markdown-editor-and-library/12332)
- [TapSmart — How Bear made note-taking fast and beautiful](https://www.tapsmart.com/features/classics-bear/)

### Day One

- [Day One — Journal views in Day One for macOS](https://dayoneapp.com/guides/day-one-for-mac/journal-views-in-day-one-for-macos/)
- [Day One — List view customization](https://dayoneapp.com/guides/tips-and-tutorials/timeline-view-customization/)
- [Day One — Adding Media](https://dayoneapp.com/guides/getting-started-with-day-one/adding-media-in-day-one/)
- [Day One — Gallery Improvements for Web](https://dayoneapp.com/releases/gallery-improvements-for-web/)
- [Day One Forums — Entry previews redesign critique](https://forums.dayoneapp.com/forums/topic/the-new-entry-previews-are-unfortunately-really-bad-ideas-on-how-to-fix/)
- [Day One Wikipedia](https://en.wikipedia.org/wiki/Day_One_(app))
- [The Sweet Setup — Day One in Depth](https://thesweetsetup.com/dayone/)

### Drafts

- [Drafts Docs — Workspaces](https://docs.getdrafts.com/docs/drafts/workspaces)
- [Drafts Docs — Flags & Tagging](https://docs.getdrafts.com/docs/drafts/tagging)
- [Drafts Docs — Search & Filtering](https://docs.getdrafts.com/docs/drafts/filtering)
- [The Sweet Setup — Set Up Your Drafts Workspaces](https://thesweetsetup.com/set-up-your-drafts-workspaces-for-an-improved-writing-experience/)
- [MacStories — Drafts 5 review](https://www.macstories.net/reviews/drafts-5-the-macstories-review/2/)

### iA Writer / Ulysses

- [iA Writer — Quick Tour](https://ia.net/writer/how-to/quick-tour)
- [iA Writer — Settings](https://ia.net/writer/support/basics/settings)
- [iA Writer — Features](https://ia.net/writer/support/basics/features)
- [MacStories — iA Writer 5.2](https://www.macstories.net/ios/ia-writer-5-2-better-typography-and-external-library-locations/)
- [Ulysses — Sheets & Groups](https://help.ulysses.app/en_US/the-library/567894-sheets-groups)
- [Ulysses — Ulysses' Library](https://help.ulysses.app/en_US/the-library/ulysses-library)
- [Ulysses Blog — Navigate With Ease](https://blog.ulysses.app/navigate-with-ease/)
- [Ulysses Blog — Manage Your Sheets and Attachments Better](https://blog.ulysses.app/manage-your-sheets-and-attachments-better-with-the-new-sidebars/)

### Patterns / supporting

- [Pocket-lint — Smart Folders make me rethink how I organize my Mac](https://www.pocket-lint.com/smart-folders-macos-file-filter/)
- [GitHub — chokidar for file watching in Electron](https://github.com/paulmillr/chokidar)
- [LogRocket — Drag-and-drop UI examples and patterns](https://blog.logrocket.com/ux-design/drag-and-drop-ui-examples/)
- [CSS-Tricks — Draggable Elements That Push Others Out Of Way](https://css-tricks.com/draggable-elements-push-others-way/)
- [GitHub — tadashi-aikawa/obsidian-another-quick-switcher](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher)
- [60fps.design — Notes iOS App animations](https://60fps.design/apps/notes)
- [Tokie — Side Peek panel for markdown](https://tokie.is/blog/the-best-markdown-note-taking-app-on-mac-in-2025)

---

## CLOSING NOTE

The EZvibes vault doesn't need to invent a new interaction. It needs to remix the three-pane structure of Apple Notes, the nested-tag taxonomy of Bear, the saved-search Workspaces of Drafts, the focus discipline of iA Writer, the multi-view shell of Day One, and the keyboard rigor of Ulysses — and then apply the **Liquid Glass material** (via `backdrop-filter` + SVG displacement) and the **live filesystem hand-off** semantics on top. Each of those ideas is mature and battle-tested in production apps; together they make a single vault drawer that nobody else will have shipped in 2026.

The single most exciting pioneer-level move: **the Vault Map** — a 2D spatial constellation of Liquid Glass cards representing every `.md`, with arrows between hand-offs, that you can pan/zoom/pluck-from, with a click animating the card down into the active terminal tab. This is the metaphor that will make Twitter scream "what app is that?" — and it's all achievable with vanilla CSS + SVG filters in an Electron renderer.
