# Research Agent #25 — Notion, Craft, AnyType — Sidebar & Database View UI (2025–2026)

Comprehensive research dump for the **EZvibes "prompt vault" panel**. The goal: pull the most pioneer-level sidebar, database-view, and "everything is a database" UI ideas from the modern wave of knowledge-management apps (Notion, Craft, AnyType, Tana, mem.ai, Affine, AppFlowy, Outline, Trilium, Capacities, Reflect) and translate them into vault-ready patterns for a vanilla-JS Electron app.

---

## 1. The 2026 PKM Landscape — Why It Matters For The Vault

The vault panel is, structurally, the same problem these apps solve: **a navigable, scrollable surface that turns a folder of markdown files into "objects" the user can act on at a glance**. The arms race in this space (2024–2026) has produced a remarkably stable vocabulary you can borrow wholesale:

- **Pinned / Favorites / Teamspaces / Shared / Private** — Notion's section taxonomy (Notion Help). Translated to EZvibes: `Pinned`, `Hand-offs`, `CLAUDE.md`, `Specs`, `Plans`, `Other markdown`.
- **Multiple views over the same data** — Table, list, gallery, board, calendar, timeline (all six exist in Notion, five in Tana, four in AnyType). For EZvibes: at minimum `List` and `Gallery` view of the same `.md` set, with a single toggle.
- **View toolbars** with **Filter / Sort / Group / Display** — Tana introduced this as a horizontal toolbar that turns blue when an option is active, hidden by default and toggled with `Cmd/Ctrl+K`. Borrow this verbatim.
- **Icon + Cover** per object — Notion's emoji/icon/custom upload + banner image system. For markdown files this maps to a parsed first-line emoji, a YAML frontmatter `icon:` field, or a deterministic emoji per extension/path.
- **Sidebar that scales** — Notion's 224px wide, 131px nav block, 30px favourites block, 6px section gap, 22px icon containers, 30px row heights, 8px corner radius. Use these literal pixel values; they are battle-tested.
- **Hover preview / quick peek** — Notion (Oct 2023) shipped link-hover popovers showing the first block of a page. For our markdown vault, a 300ms-delay popover showing the first ~10 lines of the `.md` is the single most ergonomic feature you can add.
- **Command palette + fuzzy search** — `Cmd/Ctrl+K`, fuzzy match, recent commands, keyboard-only navigation (Raycast/Linear/Tana). The vault should be navigable without ever touching the mouse.
- **Local-first / real-folder backing** — Obsidian, AnyType, AppFlowy, Trilium all back their UI directly on the file system. **This is exactly the EZvibes vault model**: drop a `.md` into the folder from any other session and it appears.

---

## 2. Notion — The Reference Implementation

### 2.1 Sidebar Anatomy & Specs

From the *UI Breakdown of Notion's Sidebar* (Medium) and the Notion Help Center, here are the literal measurements you can lift:

| Element | Spec |
|---|---|
| Sidebar width | **224px** (resizable, drag right edge) |
| Top nav section height | **131px** (Search, AI, Home, Inbox) |
| Favorites section height | **30px** |
| Search bar height | **30px** |
| Icon container | **22 × 22px** |
| Section gap | **6px** |
| Corner radius (clickable zones) | **8px** |
| Grid base | **8px** |
| Font weight | Medium |
| System font stack | SF Pro (macOS) / Segoe UI (Windows) — warm grays, not pure black |
| Row hover bg | very low-alpha black (~`rgba(0,0,0,0.04)` light / `rgba(255,255,255,0.06)` dark) |
| Clickable zone | full row width, thumb-friendly |

The sidebar is broken into named sections:

1. **Top global nav** — Search, AI, Home, Inbox.
2. **Favorites** — star-pinned pages.
3. **Teamspaces** — shared org structure. Each teamspace is a top-level collapsible group with nested pages.
4. **Shared** — pages shared to you.
5. **Private** — your personal pages.

Sections can each be collapsed independently. Sections are draggable (you can drag-reorder them). Pages are infinitely nestable — toggles reveal children. A toggle icon (chevron) rotates on expand. Indentation increases progressively, like a file explorer.

A new button at the bottom of the sidebar in the 2024+ redesign lets users browse and add Teamspaces (curation pattern). Notion 2025's "Data Sources" API change (Sept 2025) split databases into **container + data source** — this is the *clearest design principle* for the vault: **the panel is the container; each `.md` is a data source row**.

### 2.2 Notion Database Views — Six Layouts In Detail

From the Notion VIP comparison and Notion Help:

#### Table view
- Columns = properties, rows = pages.
- Bulk editing, filtering, sorting.
- Cell-level "Wrap cells" toggle.
- Calculations row (sum/count/percent).
- **For EZvibes vault:** good for power users who want to see size/modified/frontmatter tags at once.

#### List view
- Vertical column of rows; minimal properties.
- Best for chronological / many-item lists.
- **For EZvibes vault:** the natural default. One row per `.md`, icon left, title middle, last-modified right, "Paste" button on right edge.

#### Board view (Kanban)
- Groups columns by Select/Multi-Select/Person.
- Drag items between groups → updates property.
- Hide groups via `•••`; reorder groups by drag.
- **For EZvibes vault:** group by tag (`#claude` `#codex` `#handoff`) for visual triage.

#### Gallery view
- Mosaic of cards. Three preview sources: page cover, page content (first block), Files & media property.
- Three sizes: small / medium / large.
- "Fit image" toggle — fit-within vs. crop-to-fill.
- Hover-reposition on cropped images.
- Property visibility/order toggle.
- Card title can be hidden entirely.
- **For EZvibes vault:** the *pioneer feature*. Render the first ~50 lines of each `.md` as a mini code-block preview INSIDE the card. Hover lifts the card 4px with a shadow. Click pastes. Right-click context-menu lets you pin/rename/delete.

#### Calendar view
- Monthly grid; items placed by Date property.
- Today button, month nav.
- **For EZvibes vault:** group by hand-off date. Useful if you start dating your hand-offs.

#### Timeline view
- Horizontal bars by start/end date.
- Integrated table strip below the bars.
- Scales: hour → year.
- **For EZvibes vault:** project-tracking. Probably overkill for v1.

### 2.3 Visual treatments — icons, covers, emoji

- Every page can have: emoji, uploaded image icon, or custom-color SVG icon.
- Cover image = full-width banner at top of page.
- **For EZvibes vault:** parse `📝` or `🤝` or `🧠` emoji from the first line of the `.md`, or from `icon:` frontmatter, or fall back to a folder-specific colour gradient swatch. Animated GIF icons are supported in Notion — Notion explicitly supports moving icons in the sidebar.

### 2.4 Notion's hover popover

Shipped Oct 2023: hover any page link → 300ms delay → ~280×180px popover with the first 5–10 lines of content. Critical for vault UX because users want to confirm "is this the right prompt?" before they click-and-paste.

### 2.5 Drag handle pattern

Hover the left edge of any block → six-dot "⋮⋮" handle appears → grab to drag. During drag: ghost shadow + slim horizontal blue insertion line that updates in real time. Drop: 100ms ease-out animation slides items into place. This is the gold standard for in-panel reordering.

### 2.6 Tab strip (top of database)

A row of view tabs at the top of any database (Table | List | Gallery | Board). Active tab gets a 2px underline. Hidden by default in inline databases (Notion 2025 minimalism shift).

---

## 3. Craft — Document Hierarchy & Cards

Craft's *cards* concept is the closest match to the user's vault aesthetic. Where Notion is a database, Craft makes everything feel like a stack of physical cards.

### 3.1 The Folder → Subfolder → Page → Subpage → Block hierarchy

Every paragraph is a Block. Any block that *contains* other blocks is a Page. A Page styled with visual flair is a Card. This is a four-level hierarchy with no theoretical limit on nesting.

### 3.2 Cards: 5 styles in Pro

Craft Pro lets you set a card style on any page-block. 5 size/layout options. You can override:
- Background colour (named palettes)
- Background image
- Font family (Modern / Classy / Fun)
- Size (S / M / L / XL / Hero)
- Content preview behaviour (show first block / show first image / no preview / list nested blocks)

A card is *literally a link* to its nested content with applied styling. Click navigates inside.

### 3.3 Focus / Shaded Blocks

A block can be decorated as:
- **Focus block** — quote-style left bar, larger type, emphasized.
- **Shaded block** — soft fill background, callout-style.

Both stand out from regular blocks. Useful for marking which markdown files are "active hand-offs" vs. archived.

### 3.4 Hide left/right menus

Craft's 2025 Summer Update added a hide-menus toggle for focus mode. **Important for EZvibes**: the vault should be hideable; pressing a hotkey collapses it to a strip on the right edge of the terminal window.

### 3.5 Craft sidebar structure

`Folders → Subfolders → Pages → Subpages`. Folders can be star-favorited. Card thumbnails appear in the sidebar when a card is configured. The keyboard shortcut to enter/exit a block is `Cmd+]` / `Cmd+[`.

---

## 4. AnyType — Knowledge Graph + Widget Sidebar

AnyType is the most progressive of the three on sidebar customization, and it ships natively. Excellent reference for the vault.

### 4.1 Sidebar structure (three sections)

1. **Channel widget** — Search + Members + Settings buttons.
2. **Pinned section** — user-pinned objects, accessed via top-right pin button or right-click → Pin.
3. **Objects section** — every Type in the space, and every Object of every Type.

### 4.2 Widget layouts (per object type)

- **Regular objects** can choose: `compact` or `tree` layout.
- **Queries & Collections** can choose: `compact`, `list`, `compact list`, or `object` layout.

When you pick **object layout** on a query, the widget uses *the view's own layout*. This is the cleanest "smart folder" pattern in any app: the sidebar widget *renders the saved view inline*. For EZvibes vault: a single widget can render either a flat list or a Notion-style gallery based on a saved-view spec.

### 4.3 Graph view

A clickable Graph icon in the sidebar opens a force-directed graph of every object, with controls:
- Toggle title labels
- Toggle arrows
- Toggle icons
- Toggle properties / unlinked objects
- Filter by Type or Relation

Pioneer idea for EZvibes: the vault has a hidden "graph" sub-view — link `.md` files that reference each other (markdown link syntax) and draw a tiny graph in the panel. Single-frame canvas, <100 LOC vanilla JS, huge wow factor.

### 4.4 Type inheritance (2025 update)

Properties and layouts are now *defined per Type*. All objects of that type inherit. Means: change once, propagates everywhere. For vault: define `Hand-off` type → all `*-handoff.md` files inherit the orange tint + the special "Pin to top" property.

---

## 5. Tana — The Outliner-Database Hybrid

Tana's *supertag* + *view toolbar* model is the most powerful "query a folder of stuff" UI in any modern app.

### 5.1 Supertags

Tag any node with `#prompt` or `#handoff` → that node gains structured fields and becomes queryable, filterable, displayable as a database row elsewhere. Built by ex-Notion + ex-Workflowy people.

### 5.2 The View Toolbar

A horizontal bar that drops under any node when activated. Contains:

- **Search on title** — filter the visible set by name.
- **Filter** — dropdown of conditions.
- **Sort** — multi-key sort spec.
- **Group** — pick a property to group by.
- **Display** — choose which fields appear inline below each node.

Buttons turn **blue** when an option is active — instant signal of "filters applied". Hidden by default (preserves focus). Triggered three ways:
1. Right-click → toolbar.
2. Node `•••` menu.
3. `Cmd/Ctrl+K` → palette → toolbar command.

**Pinned fields** on a supertag automatically surface to the top of the toolbar menus. Translate to EZvibes: a `.md` file with frontmatter `pinned: [tags, date]` makes those two filters appear first.

### 5.3 Views in Tana

- List
- Table
- Board
- Calendar
- Plain outline

Same five-view ladder as Notion (minus gallery + timeline). All keyboard-driven.

---

## 6. mem.ai, Capacities, Reflect — AI-Native KM (2025)

### mem.ai
- "AI-first" — no manual organization. Natural-language search.
- Conversational interface; AI suggests connections.
- *Lesson for vault:* a single search input with semantic match (even fuzzy substring is fine for v1) beats a folder tree for many users.

### Capacities
- Object-oriented. Every note IS an object with a type.
- Sidebar shows all object types. Pin types to the sidebar.
- Pin individual objects via `•••` → Pin.
- 2025 features: two-way property linking, label properties (single-property dropdown filters), open-object-in-side-panel.
- *Lesson for vault:* the side-panel-open pattern. Click a `.md` row → it opens in a slide-out side panel BELOW the active terminal, not over it. Terminal stays visible. Paste button at the bottom of the side panel.

### Reflect
- Privacy-first, end-to-end encrypted, manual bidirectional linking.
- Daily notes by default.
- *Lesson for vault:* daily-note grouping. Group hand-offs by date for a "what happened today" view.

---

## 7. Affine, AppFlowy, Outline, Trilium — Open-Source Notion Clones

### Affine (toeverything/affine on GitHub)
- Block editor + Edgeless Mode (whiteboard with shapes, connectors, freehand drawing).
- Left sidebar with `+` button to create new docs.
- Translucent sidebar UI is a toggle.
- AI toggle, font, spellcheck, page width all in settings.
- Drag-and-drop docs in sidebar (with active 2025 feature requests for clearer drop placement).
- **BlockSuite** is the underlying open-source editor framework — could be cribbed for block parsing of the vault's `.md` files.

### AppFlowy
- Flutter + Rust, native (not Electron) — but the layout patterns translate.
- Local-first; data stays on device.
- Open-source. Sidebar mirrors Notion's structure.

### Outline
- Knowledge-base-focused. Beautiful clean dark UI. Real-time collaboration.

### Trilium
- Tree-based notes. Custom attributes per note. Scriptable. Visual graph view. Note cloning (single note in multiple places — *huge* for prompts that belong to multiple categories).

---

## 8. Sidebar UX Patterns — Universal (2026)

### 8.1 The component vocabulary (from shadcn/ui Sidebar, used everywhere)

- `Sidebar` — outer container with collapsible state.
- `SidebarHeader` — logo + workspace switcher.
- `SidebarGroup` — labelled section (e.g., "Pinned", "Hand-offs").
- `SidebarGroupLabel` — uppercase, 11px, muted color.
- `SidebarGroupContent` — the rows.
- `SidebarMenu` / `SidebarMenuItem` — rows with optional badges, actions, submenus.
- `SidebarFooter` — settings + user, sticky bottom.
- `SidebarTrigger` — collapse/expand button.

### 8.2 Collapse/Expand chevron — animation

```css
.sidebar-group-toggle [data-icon="chevron"] {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.sidebar-group[data-state="open"] [data-icon="chevron"] {
  transform: rotate(90deg);
}
```

### 8.3 Nested indentation

Progressive indent classes (`ml-2`, `ml-4`, `ml-6`) per nesting level. Add a vertical guide line at each level for visual continuity:

```css
.sidebar-tree-node[data-depth="1"] { padding-left: 16px; }
.sidebar-tree-node[data-depth="2"] { padding-left: 32px; }
.sidebar-tree-node[data-depth="2"]::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255,255,255,0.06);
}
```

### 8.4 Drag-to-reorder (sortable-tree library)

Marc Dahmen's `sortable-tree` (2025) is dependency-free TypeScript, ~5 KB. Drop-in for our vault:

```typescript
import SortableTree, { SortableTreeNodeData } from "sortable-tree";
import "sortable-tree/dist/sortable-tree.css";

const nodes: SortableTreeNodeData[] = [
  { data: { title: "Hand-offs", icon: "🤝" }, nodes: [...] },
  { data: { title: "Prompts",   icon: "📝" }, nodes: [...] }
];

const tree = new SortableTree({
  nodes,
  element: document.querySelector("#vault-tree"),
  stateId: "EZvibes-vault-tree",
  initCollapseLevel: 1,
  renderLabel: (data) => `<span class="vault-row">
      <span class="vault-icon">${data.icon}</span>
      <span class="vault-title">${data.title}</span>
    </span>`,
  confirm: async (moved, parentNode) => true,
  onChange: ({ movedNode, srcParentNode, targetParentNode }) => {
    // persist parent change to disk via main process
    window.ezvibes.movePromptFile(movedNode.data.path, targetParentNode.data.path);
  },
  onClick: (e, node) => pasteToActiveTerminal(node.data.path)
});
```

Persists collapsed/expanded state across reloads via `stateId`. No deps. Easy to fork.

### 8.5 Other vanilla tree libs worth knowing

- **TreeJS** — folder-tree component, native-like file browser behaviour.
- **file-tree** — web component, async loading.
- **Pickle Tree** — collapsible + sortable + toggleable.
- **yy-tree / davidfig/tree** — pure vanilla drag-and-drop UI tree.
- **DraggableTree (azlarsin)** — multi-select, custom node properties.

For Electron renderer, *all* of the above work — pick by what's needed.

### 8.6 Keyboard navigation (W3C ARIA APG)

Tree views require:
- `↑` / `↓` — move focus between visible nodes.
- `→` — expand a closed node OR move to first child if open.
- `←` — collapse open node OR move to parent if closed.
- `Enter` — activate (in vault: paste to terminal).
- `Home` / `End` — first / last node.
- Type-ahead — typing a letter jumps to next matching node.

Use roving `tabindex` (one node at a time has `tabindex=0`, all others `-1`).

### 8.7 Resize handle

```css
.vault-panel {
  position: relative;
  width: 320px;
  min-width: 240px;
  max-width: 600px;
}
.vault-panel-resizer {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
}
.vault-panel-resizer:hover {
  background: rgba(255, 255, 255, 0.08);
}
```

Listen for `mousedown` → store start width → `mousemove` → set `width` → `mouseup` → persist.

---

## 9. Card UI / Gallery Patterns — 2026

### 9.1 The classic 6 card archetypes

1. **Classic content card** — image + title + description + CTA.
2. **Dashboard / metric card** — large number + trend.
3. **Profile / user card** — avatar + identity + actions.
4. **Action / task card** — status + due + workflow buttons.
5. **Masonry grid card** — variable heights, image-heavy.
6. **Interactive / input card** — forms, toggles in-card.

For EZvibes vault: the **classic content card** is the right primary form — first-line emoji as icon, filename as title, first 3 lines as description, "Paste" button as CTA.

### 9.2 Card recommended specs

- Padding: **24px** all around (feature cards) / **16px** (smaller catalogue cards).
- Border-radius: **8px–10px**.
- Hover: gentle 2–4px lift + subtle shadow expansion. Transition 150ms ease-out.
- Loading: shimmer skeleton placeholder.
- Spacing: **16px** grid gutter.

### 9.3 Hover lift CSS recipe

```css
.vault-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 16px;
  transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1),
              background 150ms ease-out;
  will-change: transform;
}
.vault-card:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.05);
  box-shadow:
    0 8px 32px 0 rgba(0,0,0,0.36),
    0 1px 0 0 rgba(255,255,255,0.04) inset;
}
.vault-card:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.36);
}
```

### 9.4 Masonry vs uniform grid

Two real options:

**Pure CSS masonry (column-count):**
```css
.vault-gallery {
  column-count: 2;
  column-gap: 16px;
}
.vault-gallery > .vault-card {
  break-inside: avoid;
  margin-bottom: 16px;
}
```
Pro: no JS, no library. Con: items flow top-to-bottom *within each column*, not left-to-right.

**CSS Grid masonry (Level 3, native, 2026):**
```css
.vault-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  grid-template-rows: masonry; /* CSS Grid Level 3 */
  gap: 16px;
}
```
Pro: left-to-right ordering preserved. Con: browser support still emerging — fallback to Masonry.js or pure column-count for older browsers.

### 9.5 The view toggle (Gallery / List)

```html
<div class="view-toggle" role="radiogroup">
  <button data-view="list" aria-pressed="true">
    <svg><!-- list icon --></svg>
  </button>
  <button data-view="gallery" aria-pressed="false">
    <svg><!-- gallery icon --></svg>
  </button>
</div>
```

```css
.view-toggle { display: inline-flex; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 2px; }
.view-toggle button { background: transparent; border: 0; padding: 6px 10px; border-radius: 6px; }
.view-toggle button[aria-pressed="true"] { background: rgba(255,255,255,0.08); }
```

Touch-target floor: **44 × 44 CSS px** (WCAG 2.5.5). Booking.com's "List / Grid" labelled toggle is the canonical example. Material Design says max 7 toggle options, ideally 2–5.

---

## 10. Command Palette / Quick Switcher

### 10.1 The three required parts (Destiner)

1. Hotkey trigger (`Cmd/Ctrl+K`, `Cmd+Shift+P`, or `Cmd+P`).
2. Input field.
3. Results list.

### 10.2 What separates good from great

- **Fuzzy search.** Mandatory. Use `microfuzz` (Nozbe, ~1 KB) or `fzf.js` for vanilla.
- **Recent / pinned commands at the top** when input is empty.
- **Show keyboard shortcuts next to each item** (Raycast's keycap glyphs).
- **Multi-level navigation** — selecting one item drills down.
- **Per-item action menu** (`Cmd+K` within `Cmd+K`).

### 10.3 Raycast's visual specs (worth stealing wholesale for the vault palette)

- Surface bg `#07080a` / surface elevated `#101111` / row hover `#121212`.
- Text primary `#f4f4f6` / body `#cdcdcd` / muted `#9c9c9d`.
- Keycap: 20px height, gradient `#121212` → `#0d0d0d`, 4px radius.
- Command-palette card: surface bg, 1px hairline `#242728`, 10px radius.
- Command row: 6–10px padding, hover bg `#121212`, 6px row radius.
- Font: Inter with `font-feature-settings: "ss03"` (the alternate `g`) globally.
- No drop shadows. Depth via surface-color ladder. Hairline borders only.

### 10.4 Tana-style palette flow (deep model)

`Cmd+K` opens palette → type "filter" → arrow-down to "Filter by tag" → Enter → submenu with tags → select → toolbar updates with blue indicator. This is multi-stage palette navigation, fully keyboard, no mouse needed. Pioneer-level for the vault.

---

## 11. Pioneer-Level Patterns Worth Building

Ranked by "wow factor per LOC":

### 11.1 The folder-as-card-stack

When the vault sidebar collapses, the categories (Pinned / Hand-offs / Prompts / CLAUDE.md / etc.) become a **fanned deck of cards** stuck to the right edge of the terminal, each rotated slightly. Hover one → it slides out 80px and you can see the full count badge + a hint of the top item's title. Click → expands to full vault. Inspired by Aceternity UI's `card-stack` component and 22-CSS-stacked-cards collection. Uses pure CSS `transform` and `cubic-bezier` transitions. ~50 LOC.

```css
.vault-deck { position: relative; }
.vault-deck .deck-card {
  position: absolute;
  transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
.vault-deck .deck-card:nth-child(1) { transform: rotate(-3deg) translateX(0); z-index: 5; }
.vault-deck .deck-card:nth-child(2) { transform: rotate(-1deg) translateX(4px); z-index: 4; }
.vault-deck .deck-card:nth-child(3) { transform: rotate(1deg)  translateX(8px); z-index: 3; }
.vault-deck .deck-card:hover {
  transform: rotate(0deg) translateX(80px);
  z-index: 10;
}
```

### 11.2 Inline graph view

Reuse AnyType's graph idea — but for markdown files. Parse `[[wikilink]]` and `[name](path.md)` references. Render a 240×180 SVG force-directed graph at the top of the gallery view. Each node = a markdown file (the emoji is the label), edges = references. Vis.js, Cytoscape.js, or just a hand-rolled 80-LOC force simulation.

### 11.3 Live hover-peek popover

Notion's killer feature, simplified. On row hover (300ms delay), spawn a `<div>` next to the cursor showing the first ~10 lines of the `.md` file, monospace font, faint dotted border. Closes on mouseout. Critical for the "is this the right prompt?" question. Total impl: ~40 LOC.

### 11.4 Dark glassmorphism panel

The vault as a frosted-glass overlay on top of the terminal. Modern, mood-y, fits 2026 trends. Implementation per Cameron Rye / mustbewebcode:

```css
.vault-panel {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 320px;
  background: rgba(15, 16, 18, 0.65);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 0 60px rgba(0, 0, 0, 0.5),
    -1px 0 0 0 rgba(255, 255, 255, 0.04) inset;
}
```

Dark glassmorphism needs a *vibrant background* to be visible — for EZvibes that's the terminal's actual content (xterm canvas), which already has yellow folder + black `Z` aesthetic. The blur will catch the terminal pixels and produce real depth. Add `will-change: transform` for GPU acceleration.

Accessibility fallback for browsers without `backdrop-filter`:
```css
@supports not (backdrop-filter: blur(20px)) {
  .vault-panel { background: rgba(15, 16, 18, 0.95); }
}
```

### 11.5 The view toolbar (Tana's pattern)

A horizontal toolbar at the top of the vault panel, hidden by default. Toggle on with a tiny icon-button OR `Cmd+K`. Five buttons in a row: 🔍 Search · 🧪 Filter · ↕ Sort · 📦 Group · 👁 Display. Each turns **blue** (`#57c1ff`) when active. Pinned-field auto-surface from `.md` frontmatter is the cherry on top.

### 11.6 Per-row "lift to paste" animation

When the user clicks a row, the row card *lifts and slides* horizontally toward the terminal, then fades out as the prompt is pasted. Pure CSS transition. Strong visceral feedback that "the prompt went somewhere".

```css
@keyframes pasteFlight {
  0%   { transform: translateY(0) scale(1);     opacity: 1; }
  40%  { transform: translateY(-8px) scale(1.02); opacity: 1; box-shadow: 0 16px 40px rgba(0,0,0,0.6); }
  100% { transform: translateX(-200px) scale(0.8); opacity: 0; }
}
.vault-card.pasting { animation: pasteFlight 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
```

### 11.7 Watcher-backed live refresh

`chokidar` v5 (ESM-only, Node v20+) — `~30 million repos` use it. Watch the prompt folder; on `add`/`change`/`unlink` emit IPC to renderer; renderer re-renders the affected row only. Add a 600ms "new file" pulse to mark newly-appeared `.md`s in green.

```js
const chokidar = require('chokidar');
const watcher = chokidar.watch(promptDir, {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 100 },
});
watcher.on('add', (path) => mainWindow.webContents.send('vault:added', path));
watcher.on('change', (path) => mainWindow.webContents.send('vault:changed', path));
watcher.on('unlink', (path) => mainWindow.webContents.send('vault:removed', path));
```

### 11.8 Type-by-extension auto-icon

If no emoji is parsed from the `.md`, derive one from the filename:
- `*-handoff.md` → 🤝
- `CLAUDE.md` → 🧠
- `tab-plan.md` → 📐
- `*-spec.md` → 📋
- `*-plan.md` → 🗺
- else → 📝

This is *implicit Notion icons* — zero config, automatic.

### 11.9 Property chips on each row (Notion-style)

Below the title, show 1–3 small pill-shaped chips:

```css
.vault-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
}
.vault-chip[data-kind="handoff"] { background: rgba(255, 165, 0, 0.18); color: #ffba5e; }
.vault-chip[data-kind="claude"]  { background: rgba(255, 197, 0, 0.18); color: #ffd84d; }
.vault-chip[data-kind="codex"]   { background: rgba(0, 200, 200, 0.18); color: #6ce8e8; }
```

Chip content: tag, date relative ("2h ago"), folder name, line count.

### 11.10 Smart folders / saved views

Borrow macOS Smart Folders + Tana saved views. A "smart folder" in the vault is a *saved filter spec*:
- Name: "Recent hand-offs"
- Filter: `name matches *-handoff.md AND modified < 7d`
- Sort: by `modified desc`
- View: list

Saved views appear as pinned items in the vault sidebar above real folders. Click one → vault re-renders with the saved spec applied.

### 11.11 Hidden side-panel side-by-side

Capacities 2025 added: open object in side panel. For EZvibes, this maps to: clicking a `.md` row opens a *resizable preview pane* on the right of the vault (between vault and terminal). Pane shows full rendered markdown. Buttons at the bottom: `Paste`, `Paste & Run`, `Copy raw`, `Edit`, `Delete`. The active terminal stays visible to the right.

### 11.12 The radial action menu

For a *true* pioneer touch: right-click a vault row → instead of a vertical context menu, a **radial menu** fans out around the cursor. Animate UI's Radial Menu is a working React reference; for vanilla JS it's ~150 LOC. 8 actions arranged at compass positions:

- N: Paste to active tab
- NE: Paste & Run
- E: Copy raw
- SE: Open in editor
- S: Pin
- SW: Rename
- W: Move
- NW: Delete

Saves time over scanning a list. Highly memorable. Use `transform: rotate(angle) translate(radius) rotate(-angle)` to position icons around a circle.

---

## 12. The Final Vault Architecture (Synthesized)

A concrete blueprint pulling from all the above:

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ session window — folder name @ folder path             [- □ X] │
├──────────┬──────────────────────────────────────────────────────┤
│  VAULT   │  CLAUDE  │ CODEX 2 │  +                            │
├──────────┼──────────────────────────────────────────────────────┤
│  📌 Pinned                                                      │
│  ⭐ best-handoff.md   2h   [paste]  ← row with chip+button     │
│                                                                  │
│  🤝 Hand-offs (12)   ▾                                          │
│  📝 Prompts (34)     ▾                                          │
│  🧠 CLAUDE.md        ▾                                          │
│  📐 Specs (5)         ▸                                          │
│                                                                  │
│  ─── Smart folders ───                                          │
│  🔍 Recent (7d)                                                  │
│  🔍 Hand-offs unresolved                                         │
│                                                                  │
│  [🔍] [filter] [sort] [group] [👁] [⊞/☰]      ← view toolbar  │
└──────────┴──────────────────────────────────────────────────────┘
```

Vault panel default width **320px**, min 240, max 600, drag-resize on right edge.

### View toggle in upper-right of vault

`⊞` (gallery) and `☰` (list). Pressing `⊞` switches the body to a 2-column masonry of cards; pressing `☰` switches to a one-row-per-file dense list. Toggle persists per session.

### Data flow

1. `main.js` IPC adds `vault:scan` → returns `[{path, title, icon, sizeBytes, mtime, frontmatter, firstLines}]`.
2. `chokidar` watcher streams `vault:added` / `vault:changed` / `vault:removed`.
3. Renderer renders into either `<ul class="vault-list">` or `<div class="vault-gallery">`.
4. Click on row → `vault:paste` IPC → main writes file content to the active tab's PTY via `terminal:input` channel.

### CSS variables (theme tokens)

```css
:root {
  --vault-bg: rgba(15, 16, 18, 0.65);
  --vault-blur: 20px;
  --vault-border: rgba(255, 255, 255, 0.08);
  --vault-row-hover: rgba(255, 255, 255, 0.06);
  --vault-row-active: rgba(255, 255, 255, 0.10);
  --vault-text: #f4f4f6;
  --vault-text-muted: #9c9c9d;
  --vault-chip-bg: rgba(255, 255, 255, 0.06);
  --vault-pinned-bg: rgba(255, 197, 0, 0.12); /* amber to match EZvibes's claude tab */
  --vault-handoff-bg: rgba(255, 165, 0, 0.18);
  --vault-radius: 8px;
  --vault-radius-card: 10px;
  --vault-row-h: 30px;
  --vault-section-gap: 6px;
  --vault-icon-size: 16px;
}
```

These directly mirror Notion's 8px-grid + Raycast's surface-ladder.

### Keybindings

| Key | Action |
|---|---|
| `Cmd/Ctrl+P` | Quick switcher (fuzzy file picker over the vault) |
| `Cmd/Ctrl+K` | Command palette (filter / sort / group / display + actions) |
| `Cmd/Ctrl+B` | Toggle vault panel |
| `Cmd/Ctrl+Shift+G` | Toggle gallery / list view |
| `Cmd/Ctrl+1..9` | Pin a row to that index |
| `↑/↓` | Move row focus |
| `→` | Expand folder OR show preview popover |
| `←` | Collapse folder |
| `Enter` | Paste to active terminal tab |
| `Cmd+Enter` | Paste AND submit (newline) |
| `Cmd+C` | Copy raw markdown |
| `Space` | Show preview popover (Quick Look) |

---

## 13. Library Picks (TL;DR)

| Need | Library | Why |
|---|---|---|
| Tree drag-drop | `sortable-tree` (Marc Dahmen) | 5 KB, vanilla TS, persist state, no deps |
| File watcher | `chokidar` v5 | 30M repos, robust on Windows, ESM |
| Fuzzy search | `microfuzz` (Nozbe) | <1 KB, instant |
| Icons | `Lucide` (1500+ icons, Feather-aesthetic, default in shadcn/ui) | Or **Phosphor** (7700+, 6 weights) if you want maximalism |
| Resize handle | hand-rolled 30 LOC OR `Resizable.js` | Pure JS, MIT |
| Emoji picker | `emoji-picker-element` (nolanlawson) | Vanilla web component |
| Markdown parsing | `marked` or `markdown-it` | Tiny, fast, you only need to render preview popovers — not full edit |
| Optional graph view | `vis-network` or `cytoscape.js` | ~50KB; render at most once per panel open |
| Command palette | hand-rolled (~150 LOC) or `kbar`-style ~10 KB | shadcn/ui's `Command` is good reference if porting |

---

## 14. Style Pillars — Putting It All Together

If you only remember three things from this dump:

1. **Notion's grid system, Raycast's surface ladder.** 8px grid, 30px rows, 8/10px radii, no shadows on chrome, depth from surface-color steps only.
2. **Tana's view toolbar, AnyType's widget layouts.** A single horizontal bar of Filter/Sort/Group/Display, hidden by default, lit blue when active, multiple layouts per widget so the same data renders differently.
3. **Notion's hover popover + Craft's cards + Capacities' side panel.** Hover = peek, click = open in pane, double-click = paste, drag = reorder. Every gesture has a meaning.

---

## 15. The Single Pioneer-Level Idea (My Pick)

**Tana's view-toolbar mechanism applied to the markdown vault — with the toolbar buttons turning blue when active, hidden by default, and auto-surfacing pinned frontmatter fields from each `.md`.**

Why: it converts a passive list of files into a **queryable database surface** without adding any actual database. The user keeps writing plain markdown on disk; the vault gives them the *illusion of Notion* — Filter by tag, Sort by modified, Group by folder, Display the first 3 lines — all driven by parsed YAML frontmatter and filename heuristics. Zero schema. Zero migration. Just `awaiting_review: true` in a frontmatter block automatically becomes a filterable property. Combined with `chokidar` live refresh and a single `Cmd+K` palette to toggle the toolbar, it's the **most "pioneer" UX in this entire research space** because Tana itself is the most pioneer KM tool on the market, and the pattern transposes 1-for-1 onto a plain-file backing store.

The runner-up is the **dark-glassmorphism vault panel** (frosted blur over the live xterm canvas). Visually arresting, technically trivial (`backdrop-filter: blur(20px)` + a hairline border), and uniquely well-suited to EZvibes because the terminal underneath already has saturated content (yellow folder, black Z, amber/teal tab chips) that creates exactly the "vibrant background" dark glassmorphism needs to read.

---

## References / Sources

### Notion
- [Navigate with the sidebar — Notion Help](https://www.notion.com/help/navigate-with-the-sidebar)
- [Sidebar — Notion Academy](https://www.notion.com/help/notion-academy/lesson/sidebar)
- [New sidebar design will help Notion scale](https://www.notion.com/blog/new-sidebar-design)
- [Teamspaces guide](https://www.notion.com/help/guides/teamspaces-give-teams-home-for-important-work)
- [Style and customize your page](https://www.notion.com/help/customize-and-style-your-content)
- [Page icons & covers](https://www.notion.com/help/guides/page-icons-and-covers)
- [Gallery view databases](https://www.notion.com/help/guides/gallery-view-databases)
- [Gallery view — Notion Help](https://www.notion.com/help/galleries)
- [Board view databases](https://www.notion.com/help/guides/board-view-databases)
- [Using database views](https://www.notion.com/help/guides/using-database-views)
- [Views, filters, sorts & groups](https://www.notion.com/help/views-filters-and-sorts)
- [Intro to databases](https://www.notion.com/help/intro-to-databases)
- [Compare Notion's Database Formats — Notion VIP](https://www.notion.vip/insights/compare-and-configure-notion-s-database-formats-tables-lists-galleries-boards-and-timelines)
- [Notion Gallery View Guide (super.so)](https://super.so/blog/notion-gallery-view-a-comprehensive-guide)
- [All Notion Database Views Explained (super.so)](https://super.so/blog/notion-database-views)
- [Notion Sidebar UI Breakdown — Medium](https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d)
- [Filter database entries — Notion API](https://developers.notion.com/reference/post-database-query-filter)
- [Notion Data Sources Update 2025](https://www.notionapps.com/blog/notion-data-sources-update-2025)
- [Notion New UI Design Update — June 2025](https://theorganizednotebook.com/blogs/blog/notion-new-ui-design-update-june-2025)
- [Notion hover preview — Notion on LinkedIn](https://www.linkedin.com/posts/notionhq_you-ever-want-to-peek-at-a-notion-page-activity-7122261070387310594-5sve)

### Craft
- [Cards — Craft Help](https://support.craft.do/hc/en-us/articles/4417189547921-Cards)
- [Documents, Pages and Blocks — Craft Help](https://support.craft.do/hc/en-us/articles/360019555537-Documents-Pages-and-Blocks)
- [Craft Review (MacStories)](https://www.macstories.net/reviews/craft-review-a-powerful-native-notes-and-collaboration-app/)
- [A Beginner's Guide to Craft — The Sweet Setup](https://thesweetsetup.com/a-beginners-guide-to-craft-documents-pages-and-blocks/)
- [Craft 2025 Review — Upbase](https://upbase.io/blog/craft-app-review/)

### AnyType
- [Welcome | Anytype Docs](https://doc.anytype.io/anytype-docs)
- [Sidebar | Anytype Docs](https://doc.anytype.io/anytype-docs/getting-started/customize-and-edit-the-sidebar)
- [Properties | Anytype Docs](https://doc.anytype.io/anytype-docs/getting-started/types/relations)
- [Graph | Anytype Docs](https://doc.anytype.io/anytype-docs/advanced/feature-list-by-platform/graph)
- [Queries | Anytype Docs](https://doc.anytype.io/anytype-docs/getting-started/sets)
- [Object System (DeepWiki)](https://deepwiki.com/anyproto/anytype-ts/4-object-system)
- [Widget System (DeepWiki)](https://deepwiki.com/anyproto/anytype-ts/3.8-graph-visualization)
- [How to Use Anytype 2026](https://www.fahimai.com/how-to-use-anytype)

### Tana
- [Tana View Toolbar](https://outliner.tana.inc/blog/a-flexible-alternative-to-rigid-databases-meet-the-new-view-toolbar-in-tana)
- [Views — Tana Docs](https://tana.inc/docs/views)
- [Fields — Tana Docs](https://tana.inc/docs/fields)
- [Supertags — Tana Docs](https://tana.inc/docs/supertags)
- [What's new in Tana 2025](https://outliner.tana.inc/articles/whats-new-in-tana-2025-product-updates)
- [Tana review (RememberWork)](https://rememberwork.com/tools/second-brain/tana)

### Mem.ai / Capacities / Reflect
- [Mem vs Reflect 2025 — Aloa](https://aloa.co/ai/comparisons/ai-note-taker-comparison/mem-vs-reflect)
- [Capacities vs Mem AI 2025](https://www.fahimai.com/capacities-vs-mem-ai)
- [Capacities Docs — Object Types](https://docs.capacities.io/reference/content-types)
- [Capacities Docs — Properties](https://docs.capacities.io/reference/properties)
- [Capacities Two-way linking release](https://capacities.io/whats-new/release-50/)
- [Capacities Label Properties release](https://capacities.io/whats-new/release-52/)
- [AI KM Tools Compared — TaskFoundry](https://www.taskfoundry.com/2025/06/ai-knowledge-management-tools-mem-reflect-tana.html)

### Affine / AppFlowy / Outline / Trilium
- [AFFiNE on GitHub](https://github.com/toeverything/affine)
- [AFFiNE Docs](https://docs.affine.pro/docs/blocks)
- [AFFiNE What's New](https://affine.pro/what-is-new)
- [AppFlowy on GitHub](https://github.com/AppFlowy-IO/AppFlowy)
- [Notion vs AppFlowy comparison](https://appflowy.com/compare/notion-vs-appflowy)
- [Open-source Notion replacements](https://maketecheasier.com/best-open-source-notion-replacements/)
- [Best Open-Source Notion Alternatives — XWiki](https://xwiki.com/en/Blog/5-alternatives-to-Notion/)

### Sidebar UX, Tree, Drag-Drop
- [Best Sidebar Menu Designs 2026 — Navbar Gallery](https://www.navbar.gallery/blog/best-side-bar-navigation-menu-design-examples)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar)
- [shadcn Nested Sidebar Items](https://www.shadcn.io/patterns/collapsible-sidebar-1)
- [Sortable Tree library (Marc Dahmen)](https://blog.marcdahmen.de/articles/building-sortable-tree-a-lightweight-drag-and-drop-tree)
- [Sortable Tree DEV Community](https://dev.to/marcantondahmen/building-sortable-tree-a-lightweight-drag-drop-tree-in-vanilla-typescript-f7l)
- [10 Best Tree View JS Libraries 2026 — CSS Script](https://www.cssscript.com/best-tree-view/)
- [10 Best Tree View Plugins — jQuery Script](https://www.jqueryscript.net/blog/Best-Tree-View-Plugins-jQuery.html)
- [Top Front-End Drag-and-Drop JS Libraries 2025](https://en.kelen.cc/share/frontend-drag-and-drop-libraries-2025)
- [dnd-kit Sortable Tree on GitHub](https://github.com/Shaddix/dnd-kit-sortable-tree)
- [Implementing Notion-like TOC in JS](https://blog.kowalczyk.info/a-ytv9/implementing-notion-like-table-of-contents-in-javascript.html)
- [W3C ARIA APG — Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [MDN — Keyboard-navigable JS widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets)

### Card UI, Masonry, View Toggle
- [Mastering Card UI Design Patterns 2026 — Layout Scene](https://www.layoutscene.com/card-ui-design-patterns-guide-2026/)
- [10 Card UI Design Examples 2026](https://bricxlabs.com/blogs/card-ui-design-examples)
- [Cards UI-Component — NN/G](https://www.nngroup.com/articles/cards-component/)
- [CSS Masonry — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout)
- [CSS Masonry & CSS Grid — CSS-Tricks](https://css-tricks.com/css-masonry-css-grid/)
- [Toggle Button Patterns — Justinmind](https://www.justinmind.com/ui-design/toggle-button-patterns-examples)
- [Grid/List Toggle in React — Medium](https://medium.com/@layne_celeste/toggle-between-grid-and-list-view-in-react-731df62b829e)
- [Toggle UX Tips — Eleken](https://www.eleken.co/blog-posts/toggle-ux)

### Glassmorphism / Neumorphism / 2026 trends
- [Glassmorphism: What It Is and How to Use It in 2026](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
- [Dark Glassmorphism: The Aesthetic That Will Define UI in 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [Glassmorphism vs Neumorphism 2026](https://www.zignuts.com/blog/neumorphism-vs-glassmorphism)
- [Frostpane: CSS Frosted Glass Library](https://rye.dev/blog/frostpane-liquid-glass-css/)
- [Glassmorphism Generator (Ruixen UI)](https://www.ruixen.com/generator/glass-morphism)
- [44 CSS Glassmorphism Examples](https://wpdean.com/css-glassmorphism/)
- [Neumorphism 2026 Guide — BigHuman](https://www.bighuman.com/blog/neumorphism)

### Command palette, Quick Switcher
- [Designing a Command Palette — Destiner](https://destiner.io/blog/post/designing-a-command-palette/)
- [Command Palette Interfaces — Philip Davis](https://philipcdavis.com/writing/command-palette-interfaces)
- [Raycast Design System](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md)
- [Raycast](https://www.raycast.com/)
- [Obsidian Quick Switcher++](https://github.com/darlal/obsidian-switcher-plus)

### Linear redesign
- [How We Redesigned The Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [A Calmer Interface for a Product in Motion (Linear)](https://linear.app/now/behind-the-latest-design-refresh)
- [The Rise of Linear Style Design — Medium](https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646)
- [Linear Brand Color Palette — Mobbin](https://mobbin.com/colors/brand/linear)

### File watching / Electron
- [Chokidar on GitHub](https://github.com/paulmillr/chokidar)
- [chokidar on npm](https://www.npmjs.com/package/chokidar)
- [Watch Files with Electron — Our Code World](https://ourcodeworld.com/articles/read/160/watch-files-and-directories-with-electron-framework)
- [electron-dockable](https://github.com/electron-utils/electron-dockable)

### Icons
- [Lucide vs Heroicons vs Phosphor 2026 — PkgPulse](https://www.pkgpulse.com/guides/lucide-vs-heroicons-vs-phosphor-react-icon-libraries-2026)
- [Better Than Lucide — Hugeicons](https://hugeicons.com/blog/design/8-lucide-icons-alternatives-that-offer-better-icons)
- [emoji-picker-element (nolanlawson)](https://github.com/nolanlawson/emoji-picker-element)
- [Frimousse emoji picker](https://github.com/liveblocks/frimousse)

### Notion-style block drag
- [Notion-style drag plugin (Obsidian)](https://github.com/wepee/obsidian-block-drag-drop)
- [15 Drag and Drop UI Design Tips 2025 — Bricxlabs](https://bricxlabs.com/blogs/drag-and-drop-ui)
- [Drag and Drop UI examples — Eleken](https://www.eleken.co/blog-posts/drag-and-drop-ui)

### Smart folders / Saved views
- [macOS Smart Folders — MakeUseOf](https://www.makeuseof.com/tag/8-smart-folders-need-mac-set/)
- [Smart Folder View Obsidian plugin](https://github.com/sixtarocyan/smart-folder-view)

### Stacked cards
- [16 CSS Stacked Cards — Free Frontend](https://freefrontend.com/css-stacked-cards/)
- [Aceternity Card Stack](https://ui.aceternity.com/components/card-stack)

### Radial menus
- [Animate UI Radial Menu](https://animate-ui.com/docs/components/community/radial-menu)

### Filter / Search patterns
- [Filter UX Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)
- [15 Filter UI Patterns 2026 — Bricxlabs](https://bricxlabs.com/blogs/universal-search-and-filters-ui)
- [Sticky Headers — NN/G](https://www.nngroup.com/articles/sticky-headers/)

### Prompt libraries (real impl references)
- [Prompt Snippet Library (Chrome)](https://chromewebstore.google.com/detail/prompt-snippet-library/jelbkblpilpcdcbomhlnlbjbolhjpfkm)
- [PromptEditor Markdown Sidebar](https://chromewebstore.google.com/detail/prompteditor-markdown-sid/jabhoojnekfbinmmnflgidlgblpdolng)
- [Prompt Library — Product Hunt](https://www.producthunt.com/products/prompt-library)
- [VS Code Copilot Prompt Files](https://code.visualstudio.com/docs/copilot/customization/prompt-files)
- [GitHub Copilot Reusable Prompts (Visual Studio)](https://devblogs.microsoft.com/visualstudio/boost-your-copilot-collaboration-with-reusable-prompt-files/)
- [Cursor IDE @Prompts organization](https://dredyson.com/how-i-organize-custom-prompts-in-cursor-ide-using-prompts-and-why-its-a-game-changer/)
