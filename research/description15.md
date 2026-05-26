# Pinning, Favoriting & "Starred"/Recents Surfaces (2025–2026)

> Research agent #15 of 30 — focus: **how modern apps surface recents/pinned/favorites, and how to weave them into the EZvibes prompt vault.**

This document is a deep, opinionated reference for designing the **pinned/recent/all** surfaces in the EZvibes prompt vault. It covers:

1. Real production examples (Arc, Apple Notes, Notion, Linear, Slack, Discord, Obsidian, VS Code, Raycast, Spotlight, PromptVault, Promptlight)
2. Frecency (frequency + recency hybrid) algorithms with **executable code**
3. Visual treatments — accent strips, glow halos, sticky headers, separators
4. Animation patterns — FLIP, View Transitions API, framer-motion `layoutId`, spring physics, "fly-to" motion
5. Persistence options (localStorage, IndexedDB, JSON file beside the vault)
6. Drag-to-pin gestures and gesture-based reordering
7. Concrete CSS, JS, IPC, and architectural patterns for our **Electron + vanilla JS** stack
8. A pioneer-tier synthesis that the rest of the prompt-vault team can build against

---

## 1. The taxonomy: pinned vs. starred vs. favorited vs. bookmarked vs. recent

Naming matters because each word implies a different mental model. From the
BookStack issue ["Favourites vs Starred vs Bookmarks vs Pinned vs Something
Else"](https://github.com/BookStackApp/BookStack/issues/2063) and the
[ui-patterns.com Favorites pattern](https://ui-patterns.com/patterns/favorites)
reference:

| Term | Mental model | Where you see it | Implied action |
| --- | --- | --- | --- |
| **Star / Starred** | Personal rating-ish indicator. Lightweight. | Gmail, Slack channels, Linear views | Toggle a flag on the item itself |
| **Favorite** | Curated personal collection. | Notion, Linear, Microsoft Edge | "Add to my favorites" — implies a list |
| **Pin** | Visually anchors to top of a surface. | Apple Notes, Arc tabs, VS Code tabs, Discord servers | Affects sort order, sometimes also visibility |
| **Bookmark** | Reference/return-to. Often deep links into specific positions (heading, block). | Obsidian (replaced "starred"), browsers | Quick navigation; can be hierarchical |
| **Sticky** | Pure positional behavior. | Pinned posts, Trello sticky lists | Behaves like a special "always on top" slot |
| **Recent** | Time-ordered, no curation. | macOS Recents, VS Code Open Recent | Sorted by `lastAccessed` desc |
| **Frequent** | Usage-frequency, no curation. | Slack quick switcher, browser frequent sites | Sorted by visit count |
| **Frecent (Frecency)** | Hybrid. The "smart default." | Firefox URL bar, Slack switcher, Raycast | Sorted by combined `f(frequency, recency)` |
| **Most-used-this-week** | A windowed frequent. | Raycast smart suggestions | Sorted by visit count in trailing 7d |

For our prompt vault: **the user's mental model is closest to "pin"** (they
explicitly say "pinned to the top" in the original brief) but they also want
hand-offs to be **always-visible** (which is technically pinning by *type* —
auto-pin via filename pattern). So the vault needs:

1. **Explicit pins** (toggled by user)
2. **Auto-pins** (e.g. files named `hand-off*.md`, `HAND-OFF*.md`, `handoff*.md`)
3. **Frecent recents** — the rest sorted by hybrid score
4. **All** — last resort alphabetic for "I know it's in there somewhere"

This gives the vault three implicit sections: **Pinned · Frecent · All**.
Obsidian replaced its "Starred" plugin with "Bookmarks" specifically because
the bookmark mental model accommodates groups and hierarchical organization
better than a flat star list ([Obsidian Bookmarks docs](https://help.obsidian.md/Plugins/Bookmarks)).

---

## 2. Real production examples — what they look like and what to steal

### 2.1 Arc Browser — pinned tabs as a visual zone

[Arc's pinned tabs](https://resources.arc.net/hc/en-us/articles/19231060187159-Pinned-Tabs-Tabs-you-want-to-stick-around)
live in the **upper region of the vertical sidebar, above a horizontal
separator line**. Pinned tabs:

- Never auto-archive (regular tabs auto-close after 12 hours)
- Can be grouped into folders
- Show a readable title alongside the favicon (not just the favicon)
- Persist across app launches
- Pin via hover → pin icon on each tab
- Drag to reorder freely; drag past the separator to unpin
- "Favorites" is a *third* tier above pinned — top-of-sidebar, icon-only,
  visible across all Spaces

What we steal for the vault:

- The **horizontal separator line + section heading** pattern (`──── Pinned ────`)
- The **hover → action icon** pattern (don't pollute the chrome with always-visible pin icons; only show on hover)
- The **drag past the separator to unpin** affordance — a satisfying gesture
- Different visual *weight* for the favorites/pinned/regular tiers

### 2.2 Apple Notes — pin-by-section with drag-zone unpinning

[Apple Notes' pinning behavior](https://support.apple.com/guide/notes/sort-and-pin-notes-apdb54e469b6/mac)
is the canonical "two list zones" pattern:

- Notes split into a **Pinned** section (top) and **Notes** section (rest)
- Right-swipe two-finger gesture toggles a pin
- **Drag from Pinned section into Notes section unpins** — and vice versa
- The section headings only render when at least one item exists in that section
- Pinned items are styled identically to regular items (no extra accent) — the *section heading itself* is the signal

What we steal:

- Section-only-renders-if-nonempty (hide the "Pinned" header when no pins exist)
- Drag *out of* a section as the inverse action

### 2.3 Notion — sidebar favorites at 30px, 6px gap

[Notion's sidebar](https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d):

- Overall sidebar width: **224 px**
- The Favorites section header is **30 px tall**
- **6 px gap** separates sections to "let your eyes register the shift without breaking the flow"
- Click ⭐ in the page title bar → adds to Favorites
- Drag and drop to reorder within Favorites
- Removed from Favorites by clicking ⭐ again (toggle)
- Folder support inside Favorites (sub-grouping)

What we steal:

- The specific spacing numbers (30px section heading height, 6px gap) — clean and intentional
- The toggleable star icon located on the item itself, not in a separate menu

### 2.4 Linear — favorites + folders + customizable nav

[Linear's favorites](https://linear.app/docs/favorites):

- Favorite an *issue, view, project, doc, initiative, or even a search*
- A "Favorites" section appears above teams in the sidebar
- **Folders** can be created and dragged into — these collapse/expand
- Right-click any sidebar item → "Customize sidebar" → reorder
- Pin specific projects via the item's `⋯` menu (separate from "favorite")
- The personalized sidebar update from late 2024 added drag-to-reorder
  on every sidebar element

What we steal:

- **Folders inside favorites** — for users with 20+ pinned prompts, grouping
  into "Refactors / Debugging / Spec writing" matters
- **Two-tier pinning** — at-item "star" and at-section "pin position"

### 2.5 Slack — Starred channels + Quick Switcher frecency

[Slack starred channels](https://slack.com/help/articles/201331016-Star-channels-and-direct-messages):

- Star an item → it jumps to the top in a **Starred** sidebar section
- The Starred section is one of several **custom sections** users can create
  on paid plans
- "Saved items" became distinct from "starred channels" — Slack split them
  to clarify intent

[Slack's frecency-powered Quick Switcher](https://slack.engineering/a-faster-smarter-quick-switcher/)
is the **most-cited frecency reference in production**. See Section 3 for
the algorithm with exact numbers.

What we steal:

- The split between **explicit user curation** (Starred) and **algorithmic
  recents** (Quick Switcher) — these are different surfaces

### 2.6 Discord — favorites with custom category grouping

[Discord Favorites](https://support.discord.com/hc/en-us/articles/38810584460439):
- Users can favorite chats and **group them into custom categories**
- Each category has a header you can collapse
- A long-press on mobile or right-click on desktop adds to favorites

What we steal:

- The **collapsible category header** with a chevron indicator
- A "uncategorized favorites" implicit bucket

### 2.7 Obsidian Bookmarks plugin — bookmarks with groups

[Obsidian Bookmarks](https://help.obsidian.md/Plugins/Bookmarks):

- Replaces the older "Starred" plugin
- Can bookmark: files, folders, graphs, searches, headings, blocks
- **Bookmark Groups** are collapsible folders for organization
- Hotkey support (top-9 bookmarks) via the [Hotkeys for Bookmarks plugin](https://www.obsidianstats.com/plugins/obsidian-shortcuts-for-starred-files)
- Drag-and-drop reordering

What we steal:

- **Deep-linkable bookmarks** — for prompts, we could bookmark a specific
  heading inside a prompt file (paste only that section into the terminal)
- Hotkey access to top-N pinned items (`Ctrl+1`..`Ctrl+9`)

### 2.8 VS Code — pinned editor tabs

[VS Code's pinned tabs](https://github.com/microsoft/vscode/issues/98160):

- `Ctrl+K Shift+Enter` toggles pin
- Pinned tabs shift to the left of the tab strip
- Pin icon shown even on inactive tabs
- Pin + dirty (unsaved) state share the same visual location (icon flips
  between pin and dot)
- Pinned tabs are protected from "close others / close all to the right"
- Discussion ongoing about a **secondary tab row** specifically for pinned tabs

What we steal:

- **Pinned items are protected from bulk actions** — if we ever add "Clear
  all recents" we must skip pinned
- Pin icon always-visible on pinned items (signals state without hover)
- Keyboard shortcut to toggle pin on hovered/focused item

### 2.9 Raycast — frecency-as-default-sort

[Raycast's `useFrecencySorting` hook](https://developers.raycast.com/utilities/react-hooks/usefrecencysorting):

- Every extension can opt-in to "sort results by frecency"
- API surface: `visitItem(item)`, `resetRanking(item)`, `frecencyData`
- Namespaced storage so multiple extensions don't clash
- A "Pin to top" command in the action menu manually overrides frecency
- Custom unvisited-item ordering (alphabetic / original / random)

What we steal:

- A `useFrecency`-equivalent module for our renderer
- An "always visible regardless of frecency" override (= manual pin)
- A namespace per folder (`vault:${folderPath}`)

### 2.10 Promptlight & PromptVault — direct prior art

[Promptlight](https://promptlight.app/markdown-prompt-library):
- Markdown files as the source of truth (no proprietary format)
- Star a prompt → pinned for quick access
- Files synced via iCloud / Dropbox / Git → instant cross-device updates
- Fuzzy search front and center
- Keyboard-first

[PromptVault](https://promptvault.de/):
- 5-star rating system (not just binary favorite)
- Sort by rating quality, filter by theme/tags/rating/favorites
- Offline-first

[Promptzy](https://promptzy.app/blog/best-ai-prompt-managers-mac-2026):
- **Per-prompt global keyboard shortcuts** — bind `Cmd+Opt+R` to a specific
  prompt and fire from anywhere

What we steal from this entire space:

- Plain markdown files = the canonical store (matches the user's vault concept)
- A **rating** is overkill; a binary pin is enough for v1
- Per-prompt keyboard shortcuts is a **pioneer-grade** v2 idea

---

## 3. Frecency — the algorithm, with executable code

Frecency is the central algorithm for "Recents" sorting that doesn't suck.
Mozilla coined the term in 2008 for Firefox 3's Awesome Bar. Slack
popularized it in 2016. Raycast standardized it for app launchers.

### 3.1 Mozilla's modern formulation (exponential decay)

From [Mozilla's NewFrecency wiki](https://wiki.mozilla.org/User:Jesse/NewFrecency):

- Decay rate constant: **λ = ln(2) / 30 days** (half-life of one month)
- Each visit's contribution: `visit_type_points × e^(-λ × visit_age_days)`
- Total score: sum of all current visit contributions for that item
- **Genius storage trick**: rather than recomputing, store a single
  forward-dated value `t = ln(score) / λ`; then the *implicit* decay happens
  whenever you compare it to `now()`. The "score reaches 1" timestamp *is*
  the score.

This is the "best" frecency formulation mathematically — continuous,
monotonic, never needs periodic recomputation. But it's harder to reason about than Slack's bucket version, so for **a prompt vault**, the bucket
approach is the right tradeoff (clearer code, easier to debug, totally
adequate at the scale of 100–500 prompts).

### 3.2 Slack Quick Switcher buckets (the canonical UX answer)

From [Slack Engineering's blog](https://slack.engineering/a-faster-smarter-quick-switcher/):

```
For each query/destination pair, store:
  - up to 10 most-recent timestamps
  - a count (total visits ever, capped or uncapped)
  - the destination id

For each timestamp t in the stored history, assign points by bucket:
  age <= 4 hours    → 100 points
  age <= 1 day      →  80 points
  age <= 3 days     →  60 points
  age <= 1 week     →  40 points
  age <= 1 month    →  20 points
  age <= 90 days    →  10 points
  age > 90 days     →   0 points

Final score = (totalCount × sum_of_bucket_points) / number_of_timestamps
```

Slack also stores both query→id and id→id transitions, with the id→id
edges contributing half-points so that frequently-typed queries don't
totally drown out alternative paths. For our prompt vault we don't have
"queries" per se — every prompt is its own item — so this simplifies.

### 3.3 A complete vanilla-JS frecency module for the vault

```javascript
// renderer/lib/frecency.js
// Frecency for the prompt vault. Slack-style buckets, vanilla JS, no deps.
// State persists via window.localStorage under the key `vault:${namespace}`.

const BUCKETS = [
  { maxAgeMs:        4 * 60 * 60 * 1000, points: 100 }, // 4 hours
  { maxAgeMs:       24 * 60 * 60 * 1000, points:  80 }, // 1 day
  { maxAgeMs:   3 *  24 * 60 * 60 * 1000, points:  60 }, // 3 days
  { maxAgeMs:   7 *  24 * 60 * 60 * 1000, points:  40 }, // 1 week
  { maxAgeMs:  30 *  24 * 60 * 60 * 1000, points:  20 }, // 1 month
  { maxAgeMs:  90 *  24 * 60 * 60 * 1000, points:  10 }, // 90 days
];
const MAX_TIMESTAMPS = 10;

function scoreFor(history, now = Date.now()) {
  if (!history || !history.timestamps?.length) return 0;
  const bucketSum = history.timestamps.reduce((acc, ts) => {
    const age = now - ts;
    const bucket = BUCKETS.find(b => age <= b.maxAgeMs);
    return acc + (bucket ? bucket.points : 0);
  }, 0);
  return (history.count * bucketSum) / history.timestamps.length;
}

export class VaultFrecency {
  constructor(namespace) {
    this.key = `vault:frecency:${namespace}`;
    try {
      this.data = JSON.parse(localStorage.getItem(this.key) || '{}');
    } catch {
      this.data = {};
    }
  }

  /** Call this on every paste of a prompt into the terminal. */
  visit(itemId) {
    const entry = this.data[itemId] ?? { count: 0, timestamps: [] };
    entry.count += 1;
    entry.timestamps.unshift(Date.now());
    entry.timestamps = entry.timestamps.slice(0, MAX_TIMESTAMPS);
    this.data[itemId] = entry;
    this._persist();
  }

  reset(itemId) {
    delete this.data[itemId];
    this._persist();
  }

  /** Returns items sorted by frecency desc. Unvisited items end up at 0. */
  sort(items, getId = item => item.id) {
    const now = Date.now();
    return [...items].sort((a, b) => {
      const sa = scoreFor(this.data[getId(a)], now);
      const sb = scoreFor(this.data[getId(b)], now);
      if (sa !== sb) return sb - sa;
      // Tiebreaker: most recent visit wins
      const ra = this.data[getId(a)]?.timestamps[0] ?? 0;
      const rb = this.data[getId(b)]?.timestamps[0] ?? 0;
      return rb - ra;
    });
  }

  /** Top-N most frecent (for the "Recents" section). */
  topN(items, n, getId = item => item.id) {
    return this.sort(items, getId)
      .filter(item => this.data[getId(item)])
      .slice(0, n);
  }

  /** "Most used this week" — windowed frequent. */
  mostUsedThisWeek(items, getId = item => item.id) {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return [...items]
      .map(item => {
        const ts = this.data[getId(item)]?.timestamps ?? [];
        const recentVisits = ts.filter(t => t >= cutoff).length;
        return { item, recentVisits };
      })
      .filter(x => x.recentVisits > 0)
      .sort((a, b) => b.recentVisits - a.recentVisits)
      .map(x => x.item);
  }

  _persist() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {
      // QuotaExceeded? Drop oldest items.
      console.warn('frecency persist failed', e);
    }
  }
}
```

Reference implementations to cross-check against:
[`mixmaxhq/frecency`](https://github.com/mixmaxhq/frecency) (the
de-facto npm package, Slack-derived) and
[`johnsylvain/frecent`](https://github.com/johnsylvain/frecent) (lighter,
with hour/day/week/month configurable decay).

Mixmax-style configuration we should expose (the parameter ergonomics
work well in practice):

| Option | Default | Purpose |
| --- | --- | --- |
| `exactQueryMatchWeight` | 1.0 | Score multiplier when search query exactly matches stored query |
| `subQueryMatchWeight` | 0.7 | Multiplier when stored query is a prefix of current query |
| `recentSelectionsMatchWeight` | 0.5 | Multiplier for "id seen recently regardless of query" |
| `timeStampsLimit` | 10 | Max timestamps per item — Slack uses 10 |
| `recentSelectionsLimit` | 100 | Max distinct items tracked total |

### 3.4 Frecency state for hand-offs vs. prompts

Hand-off files are usually one-shot — written by another session, read once,
then deleted. They shouldn't compete in the frecency ranking against
high-traffic prompts. The vault should partition state:

```javascript
// Detect file class from filename / content
function classify(file) {
  const name = file.name.toLowerCase();
  if (name.startsWith('hand-off') || name.startsWith('handoff')) return 'handoff';
  if (name === 'claude.md' || name === 'plan.md' || name === 'spec.md') return 'doc';
  return 'prompt';
}

// One frecency store per class so hand-offs don't pollute prompt rank
const promptFrecency  = new VaultFrecency(`${folderPath}:prompt`);
const handoffFrecency = new VaultFrecency(`${folderPath}:handoff`);
```

Hand-offs in the vault get **auto-pinned** simply because they're new and
unread — no frecency needed. Once read, they fade.

---

## 4. Visual hierarchy: pinned vs. recent vs. all

### 4.1 The three-zone vault layout

```
┌────────────────────────────────────────┐
│  ⚓ Pinned · 3                          │  ← sticky section header, smaller
├────────────────────────────────────────┤
│   ⭐ refactor-mode.md                   │  ← accent strip on left
│   ⭐ debugging-checklist.md             │
│   ⭐ HAND-OFF-from-codex-tab-2.md       │  ← auto-pinned (handoff)
├────────────────────────────────────────┤
│  🕒 Frecent · 7                         │
├────────────────────────────────────────┤
│   spec-template.md                     │
│   testing-prompt.md                    │
│   plan.md                              │
│   …                                    │
├────────────────────────────────────────┤
│  📂 All · 42                            │  ← collapsible
├────────────────────────────────────────┤
│   …                                    │
└────────────────────────────────────────┘
```

Visual hierarchy rules from
[Visual Hierarchy in Web Design (Clay 2026)](https://clay.global/blog/web-design-guide/visual-hierarchy):

- 3–5 hierarchy levels max. We have **3** (pinned > frecent > all). ✓
- Pinned items get the highest visual weight: **accent strip + brighter
  text + larger icon**.
- Frecent items get baseline weight.
- "All" gets *reduced* contrast (it's the fallback).

### 4.2 The accent-strip pattern (CSS)

The cleanest signal for "this is pinned" in 2025 is a **4px left border
in your accent color**. Slack, Linear, Discord, Notion all use a variant.

```css
.vault-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 14px;
  border-left: 3px solid transparent;
  border-radius: 0 6px 6px 0;
  transition: background-color 0.15s ease, border-left-color 0.2s ease;
}

.vault-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.vault-item--pinned {
  border-left-color: var(--accent-amber, #f59e0b);
  background: linear-gradient(
    to right,
    rgba(245, 158, 11, 0.08),
    rgba(245, 158, 11, 0)
  );
}

.vault-item--pinned .vault-item__title {
  color: #fff;
  font-weight: 500;
}

.vault-item--handoff {
  border-left-color: var(--accent-teal, #14b8a6);
  background: linear-gradient(
    to right,
    rgba(20, 184, 166, 0.08),
    rgba(20, 184, 166, 0)
  );
}

/* Unread / freshly-arrived handoff: subtle pulsing glow */
.vault-item--handoff.is-unread {
  animation: vault-pulse 2.5s ease-in-out infinite;
}

@keyframes vault-pulse {
  0%, 100% { box-shadow: inset 3px 0 0 rgba(20, 184, 166, 1); }
  50%       { box-shadow: inset 3px 0 0 rgba(20, 184, 166, 0.4),
                          0 0 12px rgba(20, 184, 166, 0.25); }
}
```

The gradient-overlay-with-accent-on-the-left is borrowed from Linear's
sidebar — it makes the pin feel solid without looking like a colored
button. The pulse on unread hand-offs uses the
[CSS glow effect](https://codersblock.com/blog/creating-glow-effects-with-css/)
technique: layered `box-shadow` with `inset` and outer values, animated
via `@keyframes`.

### 4.3 Sticky section headers

The vault should keep section headings visible while scrolling — this is
the [classic sticky pattern](https://www.smashingmagazine.com/2024/09/sticky-headers-full-height-elements-tricky-combination/),
but inside a scrollable inner panel:

```css
.vault-scroll {
  overflow-y: auto;
  position: relative;
}

.vault-section__header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: linear-gradient(
    to bottom,
    var(--vault-bg, #0d0d0d) 80%,
    rgba(13, 13, 13, 0)
  );
  padding: 8px 12px 12px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 6px;
}

.vault-section__header::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0)
  );
}

.vault-section__count {
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.35);
}
```

The trailing horizontal-gradient line is the modern (2025–2026) refinement
of "divider line under heading" — it fades out so it feels expensive rather
than utilitarian.

**Critical:** `overflow: auto` on an ancestor will silently break
`position: sticky` ([CSS-Tricks article on sticky troubleshooting](https://blog.logrocket.com/troubleshooting-css-sticky-positioning/)).
Apply `overflow` only to the `.vault-scroll` element itself.

### 4.4 Spacing tokens (Notion-derived)

```css
.vault {
  --vault-section-header-height: 30px;
  --vault-section-gap: 6px;
  --vault-item-height: 28px;
  --vault-item-padding-x: 10px;
  --vault-accent-strip-width: 3px;
  --vault-accent-amber: #f59e0b;
  --vault-accent-teal:  #14b8a6;
}
```

These mirror Notion's spacing rhythm. 30/6/28 reads as deliberate
hierarchy without being heavy.

---

## 5. Animations — making pin/unpin feel pioneer-tier

### 5.1 Choices summary

| Technique | When to use | Browser support | Code burden |
| --- | --- | --- | --- |
| **View Transitions API** (`document.startViewTransition`) | Reorder, pin-to-top, full DOM swaps. Best DX. | Chrome 111+, Firefox 144+ (Oct 2025), Safari TP. Electron 33 = Chromium 130+ = ✓. | Low |
| **FLIP** (manual) | When you need cross-browser fallback or fine control | Universal | Medium |
| **CSS `transition` only** | Static layouts, no reorder | Universal | Low |
| **`Reorder.Group` (framer-motion)** | If you ever bring in React | N/A here | Low |
| **Web Animations API** (`element.animate(...)`) | Spring physics, custom easings | Universal | Medium |
| **Spring physics** (handwritten) | When you want truly organic motion | Universal | Medium-High |

We're on Electron 33 with vanilla JS, so **View Transitions API is the
right pick** for pin-to-top.

### 5.2 View Transitions API — pin a prompt to the top

Electron 33 ships Chromium 130-ish — View Transitions are first-class.
This is the **flagship interaction** for the vault.

```javascript
// In the click handler that toggles pin
async function togglePin(file) {
  const action = () => {
    file.pinned = !file.pinned;
    rerenderVault(); // updates the DOM order
  };

  // Skip the animation if the user has reduced motion
  if (!document.startViewTransition || prefersReducedMotion()) {
    action();
    return;
  }

  const transition = document.startViewTransition(action);
  await transition.finished;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

The CSS that gives this its character:

```css
/* Each vault item gets an auto view-transition-name (Chrome 140+) */
.vault-item {
  view-transition-name: match-element;
  view-transition-class: vault-item;
}

/* Customize the animation curve for the pin "fly" */
::view-transition-group(*.vault-item) {
  animation-duration: 350ms;
  animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); /* gentle overshoot */
}

/* The item that just got pinned gets a special kick-flip */
.vault-item.is-pinning {
  view-transition-name: pinning-item;
}

::view-transition-old(pinning-item) {
  animation: pin-shrink 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
::view-transition-new(pinning-item) {
  animation: pin-land 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pin-shrink {
  to {
    opacity: 0;
    transform: scale(0.92);
  }
}

@keyframes pin-land {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  50% {
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.35);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    box-shadow: 0 0 0 transparent;
  }
}
```

Reference: [Frontend Masters' "View Transition List Reordering"](https://frontendmasters.com/blog/view-transition-list-reordering-with-a-kick-flip/)
introduces a "kick flip" — a special animation only the moving element gets.
For pinning, a soft glow that fades during the trip is the perfect signal.

### 5.3 FLIP fallback (for the manual route)

If you ever want to support a non-Chromium target or you need finer control:

```javascript
// From Aerotwist's FLIP explainer:
// https://aerotwist.com/blog/flip-your-animations/

function flipReorder(container, mutate) {
  const items = Array.from(container.children);
  // F: First — capture starting positions
  const firsts = new Map(items.map(el => [el, el.getBoundingClientRect()]));

  // L: Last — mutate the DOM
  mutate();

  // I: Invert — translate each item to its old position
  items.forEach(el => {
    const last = el.getBoundingClientRect();
    const first = firsts.get(el);
    if (!first) return;
    const dx = first.left - last.left;
    const dy = first.top  - last.top;
    if (dx === 0 && dy === 0) return;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = 'none';
  });

  // P: Play — release into final position with a transition
  requestAnimationFrame(() => {
    items.forEach(el => {
      el.style.transition = 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = '';
    });
  });
}

// Usage:
flipReorder(vaultEl, () => {
  vaultEl.insertBefore(itemEl, vaultEl.firstChild);
});
```

### 5.4 Spring physics for the "land" beat

Pin-to-top motion feels much more satisfying with a tiny spring overshoot
when the item lands. The
[Josh Comeau spring intro](https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/)
breaks down the math. For our case, the
[`cubic-bezier(0.34, 1.56, 0.64, 1)`](https://easings.net/#easeOutBack)
preset (= `easeOutBack`) is a cheap approximation that doesn't need a
physics engine.

If we ever want true spring physics in vanilla JS:

```javascript
// Minimal spring solver
function spring({ from = 0, to = 1, stiffness = 170, damping = 26, mass = 1, onUpdate, onComplete }) {
  let position = from, velocity = 0;
  const dt = 1 / 60;
  let raf;
  function tick() {
    const force = -stiffness * (position - to);
    const damp = -damping * velocity;
    const accel = (force + damp) / mass;
    velocity += accel * dt;
    position += velocity * dt;
    onUpdate(position);
    if (Math.abs(velocity) < 0.01 && Math.abs(position - to) < 0.01) {
      position = to;
      onUpdate(position);
      onComplete?.();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
```

### 5.5 Pin-icon micro-interaction

When the user clicks the pin icon, the icon itself should react:

```css
.pin-icon {
  width: 14px;
  height: 14px;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.15s, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}

.pin-icon:hover {
  color: var(--vault-accent-amber);
  transform: rotate(-15deg) scale(1.1);
}

.pin-icon.is-pinned {
  color: var(--vault-accent-amber);
  transform: rotate(45deg); /* thumbtack stuck in */
}

.pin-icon.is-pinned:active {
  transform: rotate(45deg) scale(0.85);
}
```

The 45° rotation + amber fill conveys "stuck in" the way a real pushpin
does in a corkboard. Many SVG pin icons render at 45° natively — you may
need a flat baseline orientation, then rotate to 45° on pin (rather than
already being at 45° in the SVG).

### 5.6 Ripple on click (Material-style feedback)

Optional — a subtle ripple on the pinned item gives confirmation:

```css
.vault-item__ripple {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  background: rgba(245, 158, 11, 0.35);
  transform: scale(0);
  animation: ripple 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}
```

```javascript
function spawnRipple(el, event) {
  const r = el.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'vault-item__ripple';
  const size = Math.max(r.width, r.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - r.left - size / 2}px`;
  ripple.style.top  = `${event.clientY - r.top  - size / 2}px`;
  el.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}
```

---

## 6. Drag-to-pin and drag-to-unpin

[Apple Notes' drag-from-section-to-section](https://support.apple.com/guide/notes/sort-and-pin-notes-apdb54e469b6/mac)
is the gold standard: **dragging an item from "Notes" into "Pinned" pins
it; dragging back unpins it**. This is gesturally beautiful because the
section labels are the affordance.

[Taha Shashtari's vanilla JS drag-to-reorder tutorial](https://tahazsh.com/blog/seamless-ui-with-js-drag-to-reorder-example/)
gives a complete working implementation that we can adapt — see code dump
in Section 4 of this research file. Key adaptations for cross-section
dragging:

```javascript
function onDragEnd(item) {
  // Detect which section the item ended up in via getBoundingClientRect
  // against the section header elements
  const itemMid = item.getBoundingClientRect().top + item.offsetHeight / 2;
  const pinnedHeader = document.querySelector('.vault-section[data-section="pinned"] .vault-section__header');
  const frecentHeader = document.querySelector('.vault-section[data-section="frecent"] .vault-section__header');

  const pinnedBottom = pinnedHeader.parentElement.getBoundingClientRect().bottom;

  if (itemMid <= pinnedBottom && !item.dataset.pinned) {
    setPinned(item.dataset.id, true);
  } else if (itemMid > pinnedBottom && item.dataset.pinned) {
    setPinned(item.dataset.id, false);
  }
}
```

Combined with the View Transitions API, the drag-and-drop reorder
becomes free — once you commit the DOM mutation inside
`startViewTransition`, the browser animates everything that moved.

### 6.1 The drop zones — visual scaffolding while dragging

While dragging, both section headers should "open up" with a subtle hover
indicator to signal where dropping would land the item:

```css
.vault-section.is-drop-target {
  background: rgba(245, 158, 11, 0.04);
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.3);
  transition: background 0.15s, box-shadow 0.15s;
}

.vault-section.is-drop-target .vault-section__header::before {
  content: "↓ Drop to ";
  color: var(--vault-accent-amber);
}

.vault-section[data-section="pinned"].is-drop-target .vault-section__header::after {
  content: "pin";
}

.vault-section[data-section="frecent"].is-drop-target .vault-section__header::after {
  content: "unpin";
}
```

---

## 7. Keyboard shortcuts (pioneer territory)

Drawing from Obsidian's [Hotkeys for Bookmarks plugin](https://www.obsidianstats.com/plugins/obsidian-shortcuts-for-starred-files)
and Promptzy's per-prompt global shortcuts:

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+P` | Open the vault from the active terminal tab |
| `Up/Down` | Move focus within the vault |
| `Enter` | Paste the focused prompt into the terminal |
| `Cmd/Ctrl+Enter` | Paste **and** send (newline after) |
| `Cmd/Ctrl+1`..`9` | Paste the Nth pinned prompt |
| `Cmd/Ctrl+Shift+P` | Toggle pin on focused item |
| `Esc` | Close vault, return focus to terminal |
| `/` or `Cmd/Ctrl+F` | Focus the vault's search input |

The `Cmd+1..9` shortcuts are the **secret weapon**: any prompt the user
hits multiple times per day gets bound to muscle memory in days. This is
what Obsidian's top-9-bookmarks plugin gets right.

---

## 8. Persistence

Three options ordered by complexity:

### 8.1 localStorage (simplest, what I'd ship first)

- **Pros:** zero infra, sync API, instant.
- **Cons:** 5–10 MB limit (fine for our scale), per-renderer-process (each
  session window has its own), not portable across machines.
- **What to store:**
  ```json
  {
    "vault:frecency:C:\\Users\\Oskari\\Documents\\EZvibes:prompt": {
      "refactor.md": { "count": 23, "timestamps": [...] }
    },
    "vault:pins:C:\\Users\\Oskari\\Documents\\EZvibes": ["refactor.md", "debug.md"]
  }
  ```

### 8.2 IndexedDB via `localForage`

[`localForage`](https://github.com/localForage/localForage) gives you a
localStorage-compatible API backed by IndexedDB — same code, no quota
issues, async. Use this if frecency state ever balloons (cross-folder
analytics, long timestamps lists). For 100 prompts, localStorage is fine.

### 8.3 JSON sidecar in the vault folder itself

Write `.vault-meta.json` next to the prompt files:

```json
{
  "pins": ["refactor.md", "HAND-OFF-from-codex.md"],
  "frecency": { ... },
  "schemaVersion": 1
}
```

- **Pros:** portable across machines, syncs via Git/Dropbox, survives
  re-installs.
- **Cons:** clutters the prompt folder, needs file locking if multiple
  sessions write concurrently.

**My recommendation for v1:** localStorage. Move to JSON sidecar in v2
when users start syncing.

---

## 9. Live updates from other sessions (hand-offs)

The user explicitly called out: "other sessions can save directly into
this folder, and then its visible instantly in the app." That's a
[chokidar](https://github.com/paulmillr/chokidar) watch in main process,
forwarded over IPC.

### 9.1 IPC channels to add

```javascript
// In main.js — new channels for the vault
ipcMain.handle('vault:list',     (event, folderPath) => /* return file list */);
ipcMain.handle('vault:read',     (event, filePath) => /* return content */);
ipcMain.handle('vault:watch',    (event, folderPath) => /* start chokidar */);
ipcMain.handle('vault:unwatch',  (event, folderPath) => /* stop chokidar */);
// Renderer subscribes to:
//   'vault:added'   — new file arrived (likely a handoff!)
//   'vault:changed' — file content changed
//   'vault:removed' — file deleted
```

### 9.2 The "newly arrived hand-off" affordance

When chokidar fires `add` for a file matching `handoff*.md`:

1. **Auto-pin** the new hand-off to the top of the pinned section
2. **Pulse-glow** the item with the teal accent (see CSS earlier)
3. **Optional toast** in the corner of the session window: "📩 Hand-off from another session"
4. After the user opens it once, drop the pulse but keep the pin

This is the inter-session telepathy moment that makes the feature feel
alive.

---

## 10. Putting it together — the vault component sketch

```html
<!-- inside renderer/index.html, inside the terminal popup -->
<div class="vault" data-folder-path="...">
  <div class="vault__header">
    <input class="vault__search" placeholder="Type to filter..." />
    <button class="vault__close">×</button>
  </div>

  <div class="vault-scroll">

    <!-- only rendered if there are pins -->
    <section class="vault-section" data-section="pinned">
      <header class="vault-section__header">
        <span>⚓ Pinned</span>
        <span class="vault-section__count">3</span>
      </header>
      <ul class="vault-section__items">
        <li class="vault-item vault-item--pinned vault-item--handoff is-unread" data-id="handoff-...md">
          <span class="vault-item__icon">📨</span>
          <span class="vault-item__title">HAND-OFF from codex tab 2</span>
          <button class="vault-item__pin pin-icon is-pinned" title="Unpin"></button>
        </li>
        <!-- ... -->
      </ul>
    </section>

    <section class="vault-section" data-section="frecent">
      <header class="vault-section__header">
        <span>🕒 Frecent</span>
        <span class="vault-section__count">7</span>
      </header>
      <ul class="vault-section__items">
        <!-- ... -->
      </ul>
    </section>

    <section class="vault-section vault-section--collapsible" data-section="all">
      <header class="vault-section__header is-collapsible">
        <span>📂 All</span>
        <span class="vault-section__count">42</span>
        <span class="vault-section__chevron">▾</span>
      </header>
      <ul class="vault-section__items">
        <!-- ... -->
      </ul>
    </section>

  </div>
</div>
```

```javascript
// renderer/vault.js (sketch)
import { VaultFrecency } from './lib/frecency.js';

function classify(file) {
  const n = file.name.toLowerCase();
  if (n.startsWith('hand-off') || n.startsWith('handoff')) return 'handoff';
  return 'prompt';
}

function partition(files, pinned) {
  const pinnedSet = new Set(pinned);
  const handoffs = files.filter(f => classify(f) === 'handoff');
  const explicitPins = files.filter(f => pinnedSet.has(f.path) && !handoffs.includes(f));
  const allPinned = [...handoffs, ...explicitPins]; // handoffs always first

  const others = files.filter(f => !pinnedSet.has(f.path) && !handoffs.includes(f));
  return { pinned: allPinned, others };
}

export function renderVault(rootEl, folderPath) {
  const frecency = new VaultFrecency(`${folderPath}:prompt`);
  const pins = JSON.parse(localStorage.getItem(`vault:pins:${folderPath}`) || '[]');

  async function refresh() {
    const files = await window.ezvibes.vaultList(folderPath);
    const { pinned, others } = partition(files, pins);
    const frecent  = frecency.topN(others, 7);
    const frecentSet = new Set(frecent.map(f => f.path));
    const all = others.filter(f => !frecentSet.has(f));

    const action = () => {
      rootEl.querySelector('[data-section="pinned"] ul').replaceChildren(...pinned.map(renderItem));
      rootEl.querySelector('[data-section="frecent"] ul').replaceChildren(...frecent.map(renderItem));
      rootEl.querySelector('[data-section="all"] ul').replaceChildren(...all.map(renderItem));
      hideEmptySections(rootEl);
    };

    if (document.startViewTransition && !prefersReducedMotion()) {
      document.startViewTransition(action);
    } else {
      action();
    }
  }

  // Wire up the file watcher for live handoff arrival
  window.ezvibes.onVaultAdded(folderPath, (file) => {
    refresh();
    if (classify(file) === 'handoff') {
      flashHandoffToast(file);
    }
  });

  refresh();

  // Pin/unpin handler
  rootEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.vault-item__pin');
    if (!btn) return;
    const id = btn.closest('.vault-item').dataset.id;
    const idx = pins.indexOf(id);
    if (idx >= 0) pins.splice(idx, 1); else pins.unshift(id);
    localStorage.setItem(`vault:pins:${folderPath}`, JSON.stringify(pins));
    refresh();
  });

  // Click-to-paste handler
  rootEl.addEventListener('click', async (e) => {
    if (e.target.closest('.vault-item__pin')) return;
    const item = e.target.closest('.vault-item');
    if (!item) return;
    const content = await window.ezvibes.vaultRead(item.dataset.path);
    window.ezvibes.writeTerminal(currentSessionId, content);
    frecency.visit(item.dataset.path);
    spawnRipple(item, e);
  });
}
```

---

## 11. Pioneer-grade ideas (the "wow" tier)

These are the moves competitors haven't yet made — they should set the
prompt vault apart.

### 11.1 The "constellation" view — visualizing your prompt galaxy

Replace the flat list with a force-directed graph where:
- Each prompt is a node sized by frecency score
- Pinned prompts are bright stars; the rest are dim
- Edges connect prompts that are commonly used together (= pasted within
  the same session window within ±10 min of each other)
- Hover a star → preview content; click → paste

This turns the vault into a *map of your workflow*. None of the existing
prompt managers do this.

### 11.2 Auto-naming pinned shortcuts (per-prompt hotkeys without setup)

When a prompt enters the top-3 frecent slots, **automatically bind it to
`Cmd+1/2/3`** for the next 24h. After 24h of non-use, the binding lapses.
The user gets keyboard speed for the things they actually do without ever
configuring shortcuts.

### 11.3 The drag-into-terminal teleport

Instead of click-to-paste, support **drag a vault item directly into the
xterm terminal area**. As the user drags over the terminal, the terminal
gets a ghost preview ("paste this content?") with an outlined drop zone.
Release = paste. This is the most physical, satisfying expression of
"prompt → terminal." Apple Notes does this with a similar drag affordance
for inline images.

### 11.4 Time-banded subsections of frecent

Sub-divide "Frecent" into **Today / This Week / Older**:

```
🕒 Frecent
   Today (4)
     refactor-mode.md
     ...
   This Week (3)
     debugging-checklist.md
     ...
```

Calendar-app pattern, applied to prompt history. Apple Mail and Slack do
this with messages; for prompts it's a fresh take.

### 11.5 Hand-off provenance trail

Each hand-off file shows where it came from (which session/tab wrote it)
as a subtle metadata line:

```
📨 HAND-OFF-from-codex-tab-2
   ↳ from codex --yolo in C:\…\EZvibes, 2 min ago
```

This makes the inter-session feature feel like a *messaging system* rather
than a file dump.

### 11.6 Sticky "section breath" — the section header expands on hover

When the user hovers a section heading, the divider line stretches and
becomes more saturated, and the count number scales up slightly. A
tiny detail that makes the headers feel alive without animation noise
when idle.

### 11.7 Live "neighbor" search

When the user clicks a prompt, the vault re-sorts the *unpinned* portion
to show prompts that have been paired with this one in past sessions
("neighbors"). Two more clicks of related prompts, you've executed a
3-prompt sequence with one click each. This is essentially **collaborative
filtering applied to your own past behavior**.

### 11.8 Pinned-item "spotlight" mode

Hold `Alt` while the vault is open → unpinned items dim to 20% opacity.
Lets you focus on your curated set instantly without scrolling or
filtering.

---

## 12. Failure modes & gotchas

- **`overflow: hidden` on a vault ancestor breaks sticky headers.** Apply
  overflow only to `.vault-scroll`.
- **Hidden xterm tabs measure 0×0** (per `CLAUDE.md`'s caution). If you
  put the vault inside the inactive-tab DOM, sticky positioning and any
  `getBoundingClientRect` reads will be junk. Either render the vault
  outside the tab subtree or only when the tab is active.
- **localStorage quota.** Empirically 5–10 MB. 100 prompts × 10 timestamps
  per prompt × ~30 bytes each ≈ 30 KB. Comfortable.
- **View Transition API + multiple windows.** The API works per-document.
  Each session window has its own document, so no clashes.
- **Reduced motion.** Always check `prefers-reduced-motion` before any
  view transition, FLIP, or spring animation. Disable the kick-flip but
  keep the immediate state change.
- **Hand-off files mid-write.** Chokidar's `add` event can fire before
  the file is fully flushed. Use `awaitWriteFinish: { stabilityThreshold: 200 }`
  so we don't read truncated content.
- **Pinning a hand-off file that gets deleted by the originating session.**
  Either fail gracefully (remove the pin if file disappears) or treat the
  pin as a tombstone with a "file gone" indicator.

---

## 13. References (URLs)

- Slack Engineering — A faster, smarter Quick Switcher: <https://slack.engineering/a-faster-smarter-quick-switcher/>
- Mozilla NewFrecency wiki: <https://wiki.mozilla.org/User:Jesse/NewFrecency>
- Mozilla Places Frecency Algorithm: <https://udn.realityripple.com/docs/Mozilla/Tech/Places/Frecency_algorithm>
- Raycast `useFrecencySorting`: <https://developers.raycast.com/utilities/react-hooks/usefrecencysorting>
- `mixmaxhq/frecency` library: <https://github.com/mixmaxhq/frecency>
- `johnsylvain/frecent` library: <https://github.com/johnsylvain/frecent>
- Frecency Python library: <https://frecency.readthedocs.io/>
- Arc Pinned Tabs: <https://resources.arc.net/hc/en-us/articles/19231060187159-Pinned-Tabs-Tabs-you-want-to-stick-around>
- Arc Favorites: <https://resources.arc.net/hc/en-us/articles/19230755904151-Favorites-Top-Tabs-Across-Every-Space>
- Apple Notes sort and pin: <https://support.apple.com/guide/notes/sort-and-pin-notes-apdb54e469b6/mac>
- Notion sidebar guide: <https://www.notion.com/help/navigate-with-the-sidebar>
- Notion sidebar UI breakdown: <https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d>
- Linear Favorites docs: <https://linear.app/docs/favorites>
- Linear personalized sidebar changelog: <https://linear.app/changelog/2024-12-18-personalized-sidebar>
- Slack starred channels: <https://slack.com/help/articles/201331016-Star-channels-and-direct-messages>
- Discord Favorites FAQ: <https://support.discord.com/hc/en-us/articles/38810584460439-Favorites-FAQ>
- Obsidian Bookmarks core plugin: <https://help.obsidian.md/Plugins/Bookmarks>
- Obsidian Prominent starred files: <https://github.com/javalent/prominent-files>
- Hotkeys for Bookmarks (Obsidian): <https://www.obsidianstats.com/plugins/obsidian-shortcuts-for-starred-files>
- VS Code pinned tabs issue (#98160): <https://github.com/microsoft/vscode/issues/98160>
- Favorites design pattern: <https://ui-patterns.com/patterns/favorites>
- BookStack "Favourites vs Starred vs Bookmarks" debate: <https://github.com/BookStackApp/BookStack/issues/2063>
- Smashing Magazine — Sticky Headers and Full-Height Elements: <https://www.smashingmagazine.com/2024/09/sticky-headers-full-height-elements-tricky-combination/>
- CSS-Tricks — Animating Layouts with FLIP: <https://css-tricks.com/animating-layouts-with-the-flip-technique/>
- Aerotwist — FLIP Your Animations: <https://aerotwist.com/blog/flip-your-animations/>
- Motion (framer-motion) Reorder: <https://motion.dev/docs/react-reorder>
- Motion layout animations: <https://motion.dev/docs/react-layout-animations>
- View Transitions API (MDN): <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>
- View Transitions in 2025: <https://developer.chrome.com/blog/view-transitions-in-2025>
- View Transition List Reordering with a Kick Flip: <https://frontendmasters.com/blog/view-transition-list-reordering-with-a-kick-flip/>
- Josh Comeau — Spring Physics Animation: <https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/>
- Coder's Block — Creating Glow Effects with CSS: <https://codersblock.com/blog/creating-glow-effects-with-css/>
- Taha Shashtari — Seamless Drag-to-Reorder Vanilla JS: <https://tahazsh.com/blog/seamless-ui-with-js-drag-to-reorder-example/>
- chokidar: <https://github.com/paulmillr/chokidar>
- localForage: <https://github.com/localForage/localForage>
- Promptlight Markdown Prompt Library: <https://promptlight.app/markdown-prompt-library>
- PromptVault: <https://promptvault.de/>
- Promptzy 2026 Mac prompt manager review: <https://promptzy.app/blog/best-ai-prompt-managers-mac-2026>
- ComfyUI PromptManager (5-star rating, dashboard analytics): <https://github.com/ComfyAssets/ComfyUI_PromptManager>
- Visual Hierarchy 2026 guide (Clay): <https://clay.global/blog/web-design-guide/visual-hierarchy-web-design>

---

## 14. TL;DR for the orchestrator

**Three sections — Pinned / Frecent / All** — with sticky headers, accent
left-strips for pinned items, and a chokidar file watcher that auto-pins
any newly arriving `hand-off*.md` with a teal pulse glow.

**Frecency** = Slack's bucket algorithm (4h/1d/3d/1w/1mo/90d → 100/80/60/40/20/10
points) with 10 timestamps per item, persisted in `localStorage` under
`vault:frecency:${folderPath}`.

**The single most exciting pioneer idea**: combine **View Transitions
API** (`document.startViewTransition`) with **drag-from-section-to-section**
pinning so that dragging an item across the "Pinned ──── Frecent" divider
*automatically* animates the entire list reorder with a kick-flip — the
moving item gets a custom amber glow trail while every other item slides
into its new home via the browser's built-in shared-element machinery. The
user sees their pin "fly home" with a satisfying overshoot, the rest of
the list shuffles like Apple Notes, and it's literally **one CSS
declaration plus one `document.startViewTransition(() => mutate())` call**
to get there. Zero animation libraries, zero React. Pure 2026 Chromium
magic.
