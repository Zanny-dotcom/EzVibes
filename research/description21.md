# Research 21 — Arc-Style Spaces, Sidebar Innovation & Successors (2025-2026)

> Target: Translate Arc Browser's "everything is the sidebar" pioneer design language into a **prompt-vault panel** inside the EZvibes's session windows.
> Author lens: applying the Arc design system to a desktop folder-of-prompts UI inside an Electron 33 + vanilla JS + xterm app.

---

## 0. TL;DR — what Arc actually pioneered, and why it matters for the EZvibes vault

When the user sketched a paint-mock "vault" of markdown files docked inside a terminal popup and asked for "pioneer-level" inspiration, the single most influential precedent in the entire desktop/web canon of 2023-2026 is Arc Browser by The Browser Company. Arc didn't invent the sidebar — Vivaldi and Firefox tree-style tabs had them for a decade — but Arc shipped the first sidebar that **was the application**. Every important surface lived in it: tabs, spaces, folders, downloads, history, command bar, AI, snapshots, audio controls. The browser chrome shrank to almost nothing. The center of attention moved off the "page" and onto the sidebar's persistent context. That move — *"the sidebar isn't a navigation menu, the sidebar IS the workspace"* — is exactly the leap the EZvibes vault needs.

**The 7 Arc patterns that translate directly to the prompt vault:**

1. **Vertical sidebar as workspace, not just a list.** 240px expanded, 48px collapsed, transitions over `0.2s ease-out`. Hover to peek when collapsed, with `opacity 0.15s ease-in 0.1s` delay so titles fade in unobtrusively. The vault becomes a third column docked into the session window.
2. **Spaces with their own color gradient and emoji.** Each Claude folder = an Arc Space. Inject `--arc-palette-*` CSS variables into the session window so the vault tint changes per folder. Spring animation on switch (`spring(response: 0.3, dampingFraction: 0.7)`).
3. **Cmd+T command bar.** A 600×400px centered floating launcher with fuzzy search across tabs/history/actions. Translate to vault: Cmd+P (or Ctrl+K) opens fuzzy search across every `.md` in the folder.
4. **Peek-on-hover preview.** Hover an item, after 200-300ms a floating preview panel renders the markdown content. Click to paste, Shift+click to expand to a side pane.
5. **Little Arc as ephemeral floating panel.** A 36px-chrome 600×400 popup that lives on top of any window. Translate to vault: a global Cmd+Option+P that opens the vault as a floating ephemeral surface independent of which session you're on.
6. **Boosts (CSS/JS injection per Space).** Each folder gets its own `boosts.css` that themes the vault. Pure JS, no React.
7. **Auto-archive + live folder watch.** Items in the "Today" section auto-archive after 12 hours of inactivity. Translate: `chokidar` watches the prompts folder so hand-offs dropped by other sessions appear instantly, with a 3-second "NEW" pulse around the item.

The single most exciting pioneer-level idea: **Reset Space + Tidy.** Arc's Cmd-Bar action *"Reset Space → returns all Pinned Tabs in the current Space to their originally pinned URL"*, paired with Tidy *"AI-powered bundling of unkept tabs into a temporary folder with suggested name"*, is exactly the gesture a prompt vault needs. Apply to the vault: a **"Tidy Vault" button** that uses Claude itself (via the active terminal) to group loose markdown files into proposed folders by topic, then a **"Reset Vault"** that restores the original layout — so the vault is alive and editable but always recoverable. No other prompt manager I know of does this.

---

## 1. Arc Browser — anatomy of the sidebar

### 1.1 The sidebar's dimensions and behavior

Arc's sidebar lives on the left and acts as a permanent panel — not a flyout. It has **two states**:

- **Expanded**: `width: 240px` (some clones use 200-280px; Arc itself sits at 240px in the default Mac build).
- **Collapsed**: `width: 48px` (just enough for favicons + a single emoji per Space).

The transition between states is gentle:

```css
.sidebar {
  width: 240px;
  transition: width 0.2s ease-out;
}
.sidebar.collapsed { width: 48px; }
.sidebar.collapsed .tab-title { opacity: 0; }
.sidebar.collapsed:hover .tab-title {
  opacity: 1;
  transition: opacity 0.15s ease-in 0.1s; /* 100ms delay so it doesn't fight hover-out */
}
```

Note the **delayed reveal** — the 100ms delay on the opacity transition is a small detail that makes the difference between feeling "polished" and "twitchy". When you graze the collapsed sidebar with your cursor on the way somewhere else, nothing happens; only deliberate hover triggers the reveal.

### 1.2 The sidebar layout

Top-to-bottom in Arc:

1. **Profile bubble (round avatar)** — 28px circle, lower-left of the sidebar header.
2. **Workspace icon row** — bottom of sidebar shows other Spaces as colored circles you can click. Each circle is a 24×24 disk with a 2px white stroke when active.
3. **Pinned tabs** — fixed list of items the user has explicitly pinned. Cmd+D toggles pin state. Pinned tabs have a "Reset" action that returns them to their originally pinned URL.
4. **Folders** — collapsible, nestable, color-coded. Cmd-Click to multi-select.
5. **Divider line** (`1px solid rgba(255,255,255,0.08)`) between pinned and ephemeral sections.
6. **Today section** — tabs opened today, auto-archived after 12 hours of inactivity.
7. **New Tab button** at the bottom.

For our vault, the analogous layout would be:

1. **Folder bubble** (the Claude folder icon, top of vault).
2. **Pinned prompts** (favorites, marked with Cmd+D).
3. **Hand-off section** (named, color-tinted, expandable group).
4. **Today's drops** (files added in the last 12 hours, pulsing briefly to announce arrival).
5. **Archive** (older content collapsed by default).

### 1.3 Pinned tabs vs Today tabs — the auto-archive principle

Arc separates *permanent* (pinned) from *ephemeral* (Today). Today tabs auto-archive after 12 hours of inactivity unless you pin them. This is what cures "tab anxiety". For the prompt vault this is a **direct translation**: separate **canonical prompts** (committed `.md` you want to keep) from **hand-offs/temporary drops** (other sessions write `HANDOFF-<timestamp>.md` and you read once then archive). The vault can auto-archive `HANDOFF-*.md` to a `.archive/` subfolder after 12 hours, exactly like Arc.

### 1.4 Source-of-truth quote

From Steve Simkins' writeup of Arc:

> *"The sidebar isn't where tabs live. The sidebar is where your work lives. Tabs are just one kind of work."*

Apply that to the vault: the vault isn't where files live. The vault is where your prompts live. Files are just one kind of prompt.

---

## 2. Spaces — the visual identity system

### 2.1 What a Space is

A Space in Arc is a self-contained pinned-tabs + folders + Today section + color theme + emoji + (optionally) profile binding. Switching Spaces is a top-level UI action; the entire sidebar swaps contents. Spaces are reachable via:

- **Cmd+1, Cmd+2, …** for direct jumps.
- **Cmd+Option+→ / ←** for sequential.
- **Two-finger swipe** on a Mac trackpad.
- The **Space switcher icon row** at the bottom of the sidebar.

Each Space has:

- **A 3-color gradient** (`from`, `to`, `angle`).
- **An emoji** (or custom icon) that identifies it in the switcher.
- **A separate "Today" section.**
- **A keyboard shortcut Cmd+N where N is its position.**
- **Optional Container/Profile binding** for cookie isolation.

A ring of color (the Space gradient) surrounds the window's content area, so you always know which Space you're in even when the sidebar is collapsed. This is a critical small detail — the *whole window* picks up the Space's accent color, not just the sidebar.

### 2.2 Translating Spaces to the prompt vault

In the EZvibes world, each **Claude folder** is already an implicit space — every session window is scoped to one folder. So we don't need a separate "Space switcher" at the top level. Instead, the **per-folder vault inherits a Space color** derived from the folder name (or set explicitly via a `.vault-color` file or `vault.json`).

```js
// Derive a stable HSL color from folder name
function spaceColorFor(folderPath) {
  let hash = 0;
  for (const ch of folderPath) hash = (hash << 5) - hash + ch.charCodeAt(0);
  const hue = Math.abs(hash) % 360;
  return { from: `hsl(${hue} 70% 55%)`, to: `hsl(${(hue + 40) % 360} 70% 45%)` };
}
```

Then inject as CSS variables:

```js
const { from, to } = spaceColorFor(folder);
windowEl.style.setProperty('--space-from', from);
windowEl.style.setProperty('--space-to', to);
windowEl.style.setProperty('--space-angle', '135deg');
```

And apply:

```css
.vault-panel {
  background: linear-gradient(
    var(--space-angle, 135deg),
    var(--space-from, #2a2a2a),
    var(--space-to, #1a1a1a)
  );
}
.session-window .terminal-pocket {
  /* Subtle ring of color around the active area */
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--space-from) 30%, transparent);
}
```

### 2.3 The full Arc palette CSS variables

From a real Arc theme export (via `getComputedStyle(document.documentElement)`), the variables Arc injects into every page are:

```css
:root {
  --arc-palette-background:        #001E15FF;  /* Primary dark background */
  --arc-palette-backgroundExtra:   #000F0AFF;  /* Even darker, for cards */
  --arc-palette-title:             #D7E8E3FF;  /* Heading text */
  --arc-palette-subtitle:          #6B7A74FF;  /* Subtitle/secondary text */
  --arc-palette-foregroundPrimary: #D6F4E8FF;  /* Primary text */
  --arc-palette-foregroundSecondary: #51D19BFF; /* Accent text */
  --arc-palette-foregroundTertiary:  #51D19BFF; /* Tertiary text */
  --arc-palette-minContrastColor:  #1A6545FF;  /* Low contrast accent */
  --arc-palette-maxContrastColor:  #D6F4E8FF;  /* High contrast accent */
  --arc-palette-focus:             #3E8269CE;  /* Focus ring */
  --arc-palette-hover:             #4B8E777A;  /* Hover overlay */
  --arc-palette-cutoutColor:       #1A6545FF;  /* Cutout/badge bg */
  --arc-background-gradient-color0: #D2F3E5FF;
  --arc-background-gradient-color1: #D2EBF3FF;
  --arc-background-gradient-overlay-color0: #00000000;
  --arc-background-gradient-overlay-color1: #D5F3D2FF;
}
```

You can detect Arc and re-skin a site:

```js
const usingArc = getComputedStyle(document.documentElement)
  .getPropertyValue('--arc-palette-background') !== '';
```

For the vault, replicate this naming convention so the rest of the app can opt-in to "vault palette":

```css
.vault-panel {
  --vault-palette-background:       hsl(220 25% 12%);
  --vault-palette-title:            hsl(220 15% 92%);
  --vault-palette-subtitle:         hsl(220 10% 60%);
  --vault-palette-accent:           var(--space-from);
  --vault-palette-accent-bg:        color-mix(in srgb, var(--space-from) 12%, transparent);
  --vault-palette-hover:            color-mix(in srgb, var(--space-from) 18%, transparent);
  --vault-palette-focus-ring:       color-mix(in srgb, var(--space-from) 60%, transparent);
}
```

### 2.4 Space switcher animations — the spring details

When you swap Spaces in Arc, the sidebar contents slide horizontally with a **spring**:

```
SwiftUI: spring(response: 0.3, dampingFraction: 0.7)
```

Translated to CSS using a linear() spring approximation (via Josh Comeau's generator pattern):

```css
@keyframes space-slide-in {
  from { transform: translateX(8px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
.vault-content.switching {
  animation: space-slide-in 320ms linear(
    0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%,
    1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%,
    1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%,
    0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1
  );
}
```

That `linear()` easing function is the modern way to do springs in pure CSS without JS. It approximates a `spring(response: 0.3, damping: 0.7)` curve into 30 sample points.

A simpler ease-spring approximation:

```css
.vault-content.switching {
  animation: space-slide-in 280ms cubic-bezier(0.16, 1.2, 0.3, 1);
}
```

The `cubic-bezier(0.16, 1.2, 0.3, 1)` overshoots slightly (the 1.2 in the Y) which gives the springy feel without going full physics.

---

## 3. Command Bar (Cmd+T) — Arc's "unsung hero"

### 3.1 What it does

Press Cmd+T (or Cmd+L for URL-only) in Arc and a floating launcher appears. It searches:

- All open tabs across all Spaces.
- All pinned tabs and folders.
- Browser history.
- Bookmarks/Library.
- Actions (every Cmd-Bar action from §3.2).
- AI ("Ask Anything") — natural language to AI.
- Web search fallback.

Fuzzy search across all of these. Arrow keys to navigate. Enter to execute. Cmd+Enter to open in new tab / split. The current context is preserved underneath — Arc dims the page slightly behind the bar but doesn't navigate away. This contextual preservation is mentioned over and over in reviews as the thing that makes the bar feel "elegant" — *"it doesn't get in your way, it keeps your current context in view, and it's keyboard-centric."*

### 3.2 The full Cmd-Bar action vocabulary

From the official Arc command bar actions doc (categories preserved):

**Navigation**: New Window, Blank Window, New Incognito Window, Little Arc, Toggle Sidebar, Reopen Last Closed Tab, Copy Current URL, Clear Today, Reveal Tab in Sidebar, Reset Space, Go Back/Forward in History, Downloads, Quit Arc.

**Organization**: New Space, Select Next/Previous Space, Focus on [Space Name], Pin/Unpin Tab, Favorite Tab, New Folder, Rename Current Tab, Duplicate Current Tab.

**Tools**: New Note, New Easel, Capture Page, Open Library, Report Bug, Join Call, New [Document Type].

**Split View**: Add/Remove Split View, Expand Current Split.

**Other**: Undo, Redo, Save Page As, Print, Reload Page, Zoom +/-, Light/Dark Mode, Developer Tools, Enter Full Screen, View History, View Archive, Features, Common Shortcuts, Release Notes, Restore Data.

**Settings**: Preferences, Set as Default Browser, Check for Updates, Extension Management.

The lesson for the vault command bar: don't restrict it to file search. Include **actions** (Tidy Vault, Reset Vault, Create Hand-off, Open in Editor, Copy to Clipboard, Paste into Active Terminal), **spaces** (switch folder), and **agent commands** (New Claude tab, New Codex tab) all in one searchable list.

### 3.3 Command bar dimensions and styling

Reverse-engineered from Arc and from `blakecrosley.com/guides/design/arc`:

```css
.command-bar {
  position: fixed;
  top: 20vh;             /* Anchored 20% from top, not centered vertically */
  left: 50%;
  transform: translateX(-50%);
  width: min(600px, 90vw);
  border-radius: 12px;   /* var(--radius-lg) */
  background: rgba(28, 28, 30, 0.92);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  z-index: 9999;
}

.command-bar input {
  width: 100%;
  padding: 16px 20px;
  font-size: 18px;
  background: transparent;
  border: 0;
  color: var(--text-primary);
  outline: none;
}

.command-bar .results {
  max-height: 400px;
  overflow-y: auto;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.command-bar .result {
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.command-bar .result:hover,
.command-bar .result[aria-selected="true"] {
  background: var(--surface-hover, rgba(255,255,255,0.08));
}

.command-bar .shortcut {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary, #888);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}
```

Note the **20vh top offset** — Arc deliberately places the bar in the top-third of the viewport, not centered, so it doesn't cover the content area below.

The **`backdrop-filter: blur(40px) saturate(180%)`** is the Apple-style frosted glass that became one of Arc's signature visual moves. Saturate >100% slightly pops the colors behind the blur. Important: Electron 33 on Windows supports `backdrop-filter` on modern Chromium, but you may need to set `vibrancy: 'fullscreen-ui'` (macOS) or use `BrowserWindow`'s `backgroundMaterial: 'mica'` (Windows 11) for true OS-level blur.

### 3.4 Command bar opening animation

```css
@keyframes command-bar-open {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
.command-bar.open {
  animation: command-bar-open 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.command-bar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  opacity: 0;
  transition: opacity 180ms;
  z-index: 9998;
}
.command-bar-backdrop.open { opacity: 1; }
```

### 3.5 Implementing fuzzy search — vanilla JS, no React

The vault is in vanilla JS, so don't reach for cmdk or kbar. The simplest excellent fuzzy search is **`fzf-for-js`** or **`fuse.js`**. For maximum control with zero deps, here's a 30-line fuzzy matcher inspired by VS Code's matcher:

```js
// Returns { score, matches } or null if no match.
// score: lower is better. matches: array of matched char indices.
function fuzzyMatch(query, target) {
  if (!query) return { score: 0, matches: [] };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0, ti = 0, score = 0, matches = [], lastMatch = -2;
  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      // Bonus: consecutive match
      if (ti === lastMatch + 1) score -= 2;
      // Bonus: word-boundary match
      if (ti === 0 || /[\s\-_./]/.test(t[ti - 1])) score -= 4;
      // Bonus: uppercase / camelCase boundary in original target
      if (target[ti] === target[ti].toUpperCase() && target[ti] !== target[ti].toLowerCase())
        score -= 2;
      matches.push(ti);
      lastMatch = ti;
      qi++;
    } else {
      score += 1; // penalty per skipped char
    }
    ti++;
  }
  return qi === q.length ? { score, matches } : null;
}

function rankPrompts(query, items) {
  return items
    .map(it => {
      const m = fuzzyMatch(query, it.title);
      return m ? { item: it, ...m } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
}
```

With match-highlighting:

```js
function highlight(text, matches) {
  if (!matches?.length) return escapeHtml(text);
  let out = '';
  let mi = 0;
  for (let i = 0; i < text.length; i++) {
    if (mi < matches.length && matches[mi] === i) {
      out += `<mark>${escapeHtml(text[i])}</mark>`;
      mi++;
    } else {
      out += escapeHtml(text[i]);
    }
  }
  return out;
}
```

---

## 4. Peek — link preview on hover

### 4.1 What Peek does

Two distinct behaviors in Arc:

**Tab Peek (hover preview):** Hover over a pinned tab (Gmail, Calendar, Notion) and a preview pops up showing the current state of that tab — your inbox snippet, today's calendar, etc. This isn't a screenshot; it's the live page rendered as a snapshot. Triggered after ~300ms hover.

**Link Peek (in-page link previews):** Click a link in a pinned or favorite tab and instead of replacing the page, a smaller window pops up overlaying the current page. The window has Close (X / Cmd+W), Expand to tab (Cmd+O), and Split View buttons in the upper-right.

**Arc Max Peek (5-second hover):** Hover any link for 5 seconds with Shift held and Arc Max generates an AI summary of the destination. On Google/X this runs automatically.

### 4.2 Implementing hover preview for a markdown prompt vault

The most magical version of the vault is: hover an `.md` file in the list, after 300ms a floating preview panel appears showing the rendered markdown. Move the cursor onto the preview to keep it open; move away to dismiss.

```js
const PREVIEW_DELAY = 250;
const DISMISS_DELAY = 150;
let previewTimer, dismissTimer;
let activePreview = null;

function attachPeek(itemEl, getMarkdown) {
  itemEl.addEventListener('mouseenter', () => {
    clearTimeout(dismissTimer);
    if (activePreview?.dataset.for === itemEl.dataset.path) return;
    previewTimer = setTimeout(async () => {
      const md = await getMarkdown();
      showPeek(itemEl, md);
    }, PREVIEW_DELAY);
  });
  itemEl.addEventListener('mouseleave', () => {
    clearTimeout(previewTimer);
    dismissTimer = setTimeout(hidePeek, DISMISS_DELAY);
  });
}

function showPeek(anchorEl, markdown) {
  const rect = anchorEl.getBoundingClientRect();
  const peek = document.createElement('div');
  peek.className = 'vault-peek';
  peek.dataset.for = anchorEl.dataset.path;
  peek.innerHTML = `
    <div class="vault-peek-header">${escapeHtml(anchorEl.textContent)}</div>
    <div class="vault-peek-body">${renderMarkdown(markdown)}</div>
    <div class="vault-peek-actions">
      <button class="paste">Paste into terminal</button>
      <button class="expand">Open in side pane</button>
      <button class="copy">Copy</button>
    </div>
  `;
  // Position to the right of the vault, vertically aligned with the item
  peek.style.left = `${rect.right + 12}px`;
  peek.style.top = `${rect.top}px`;
  document.body.appendChild(peek);
  activePreview = peek;

  // Keep preview open while cursor is on it
  peek.addEventListener('mouseenter', () => clearTimeout(dismissTimer));
  peek.addEventListener('mouseleave', () => {
    dismissTimer = setTimeout(hidePeek, DISMISS_DELAY);
  });
  // Mount with animation
  requestAnimationFrame(() => peek.classList.add('open'));
}

function hidePeek() {
  if (!activePreview) return;
  activePreview.classList.remove('open');
  const dying = activePreview;
  activePreview = null;
  setTimeout(() => dying.remove(), 180);
}
```

Styling for the peek panel:

```css
.vault-peek {
  position: fixed;
  width: 420px;
  max-height: 60vh;
  background: rgba(28, 28, 30, 0.96);
  backdrop-filter: blur(40px) saturate(180%);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 8px 32px rgba(0,0,0,0.35),
    0 0 0 1px rgba(255,255,255,0.04);
  padding: 12px;
  color: var(--vault-palette-title);
  opacity: 0;
  transform: translateX(-6px) scale(0.97);
  transition: opacity 180ms cubic-bezier(.2,.8,.2,1),
              transform 180ms cubic-bezier(.2,.8,.2,1);
  z-index: 1000;
  pointer-events: none;
  overflow: auto;
}
.vault-peek.open {
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}
.vault-peek-header {
  font-weight: 600;
  font-size: 13px;
  color: var(--vault-palette-subtitle);
  margin-bottom: 8px;
}
.vault-peek-body {
  font-size: 13px;
  line-height: 1.5;
}
.vault-peek-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.vault-peek-actions button {
  padding: 4px 10px;
  background: rgba(255,255,255,0.06);
  border: 0;
  border-radius: 6px;
  color: var(--vault-palette-title);
  font-size: 12px;
  cursor: pointer;
}
.vault-peek-actions button:hover {
  background: var(--vault-palette-hover);
}
```

### 4.3 The "expand" trick (Peek → full panel)

Arc's link peek can expand to a full tab via Cmd+O or the expand button. For the vault, the equivalent is: the peek panel can expand into a **side pane** docked to the right of the terminal. When the user clicks "Open in side pane", the peek's geometry animates from its anchor-relative position to a full side panel:

```js
function expandPeek(peek) {
  const rect = peek.getBoundingClientRect();
  // Capture starting geometry
  peek.style.transition = 'none';
  peek.style.left = `${rect.left}px`;
  peek.style.top = `${rect.top}px`;
  peek.style.width = `${rect.width}px`;
  peek.style.height = `${rect.height}px`;
  peek.style.transform = 'none';
  // Force reflow
  void peek.offsetWidth;
  // Target full side pane
  peek.classList.add('expanded');
  peek.style.transition = 'all 300ms cubic-bezier(.2,.8,.2,1)';
  peek.style.left = '';
  peek.style.top = '';
  peek.style.right = '0';
  peek.style.bottom = '0';
  peek.style.width = '420px';
  peek.style.height = '100%';
}
```

This **FLIP animation** (First, Last, Invert, Play) is the same technique Arc uses for its peek-to-tab expansion. The element looks like it's continuously transforming from "small floating card" to "docked side pane".

---

## 5. Little Arc — ephemeral floating panel

Little Arc is Arc's lightest surface — a 36px-chrome popup window for one-off lookups. Triggered by Cmd+Option+N (or by clicking a link in another macOS app while Cmd-Option is held).

The Browser Company's design rationale: *"one tab, no chrome, distraction-free."* It dissolves back to nothing when you close it; no history is kept in the main browser unless you pin the result.

### Translating Little Arc to the vault

The killer adaptation is: a global hotkey (say **Ctrl+Shift+V**) that opens a floating "Vault Lite" window on top of *any* application — including outside EZvibes. The window contains nothing but the prompts list + command bar. Click a prompt → it copies to clipboard → window vanishes. This means a prompt vault you can summon over Slack, VS Code, anywhere.

Electron makes this easy:

```js
const { globalShortcut, BrowserWindow } = require('electron');

let liteWindow = null;
function showLiteVault() {
  if (liteWindow) {
    liteWindow.focus();
    return;
  }
  liteWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    backgroundColor: '#00000000',
    vibrancy: 'fullscreen-ui',           // mac
    backgroundMaterial: 'acrylic',        // win11
    webPreferences: { preload: path.join(__dirname, 'preload-lite.js') }
  });
  liteWindow.loadFile('renderer/lite.html');
  liteWindow.on('blur', () => liteWindow.close());
  liteWindow.on('closed', () => liteWindow = null);
}

app.whenReady().then(() => {
  globalShortcut.register('Ctrl+Shift+V', showLiteVault);
});
```

Visual specs for the Lite window (matching Arc's Little Arc):

- **600×400** default size.
- **36px header** with just close (X) and "expand to full session" buttons.
- **`frame: false`** with custom `-webkit-app-region: drag` on the header.
- **`transparent: true`** + rounded corners via CSS.
- **`alwaysOnTop: true`** so it floats over your other windows.
- **`blur(40px)` backdrop** for frosted glass.

---

## 6. Boosts — per-Space styling

Boosts let Arc users inject CSS/JS into any site. They're stored per-Space, so the same site can look different in Work vs Personal. The Browser Company's CEO even uses Boosts to add internal-tool buttons to GitHub.

For the vault: each Claude folder can have a `.vault/boost.css` and `.vault/boost.js` that the app injects into the vault panel when the folder is active. This lets power users theme their prompt vaults per-project without forking the app:

```js
// In renderer/app.js when activating a folder:
async function loadFolderBoost(folderPath) {
  const cssPath = path.join(folderPath, '.vault', 'boost.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf-8');
    const styleEl = document.getElementById(`boost-${folderPath}`) ?? document.createElement('style');
    styleEl.id = `boost-${folderPath}`;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}
```

Users can also write a `boost.json` that defines per-vault keyboard shortcuts, color overrides, custom action buttons, etc.

---

## 7. Sigma OS — Arc's "to-do list for tabs" cousin

SigmaOS was the first browser to treat tabs as task items, predating Arc but never reaching its polish. Key ideas worth stealing:

### Locked vs Done tabs

In SigmaOS each tab has a state:

- **Active** (default).
- **Done** — marked complete, fades to gray, eventually auto-archives. Triggered by Cmd+D-like shortcut.
- **Locked** — pinned permanently across sessions.

For the vault: every prompt can be marked **Used Today** (fades when used and pasted into a terminal session at least once today, brightens again tomorrow) or **Pinned** (always at top). This gives users at-a-glance feedback on which prompts they've actually run.

### Spacebar to search everything

In SigmaOS, hitting the spacebar (when no input is focused) opens a universal search across tabs, internet, commands, bookmarks. The lesson: a single-key activation is faster than Cmd+T for keyboard-driven flow.

For the vault: **hitting `/` when no input is focused** opens the vault command bar. Familiar to Slack/Discord users and one keystroke.

---

## 8. Zen Browser — the open-source Arc clone (2025)

Zen is a Firefox fork that mirrors most of Arc. Worth studying because it's open source and you can read the actual implementation. Key Arc-style features Zen ships natively:

- **Vertical sidebar** with customizable width.
- **Workspaces** (Cmd+1..Cmd+8 to switch, Cmd+Shift+E to create).
- **Compact Mode** (Cmd+Alt+C) — collapses sidebar + URL bar into a thin strip at the top.
- **Zen Glance** — hold Alt and click a link to open a floating preview. (Arc's Peek.)
- **Split View** up to 4 tabs in horizontal / vertical / 2x2.
- **Mods system** — click-to-install CSS/JS customizations from a curated catalog. (Arc's Boosts.)
- **Essentials** — like Arc's pinned tabs but drag-and-drop reorderable.

The Zen team's release notes explicitly call out Arc as the model and describe each feature as "our take on Arc's X". The lesson for EZvibes is that you can pretty mechanically translate each Arc concept into the vault without having to invent anything; Zen has already done the homework.

### Compact Mode as a vault idea

Compact Mode in Zen is brilliant for screen real-estate: a single keystroke collapses the sidebar to icons and the URL bar to a thin strip. Translate to the vault: **Cmd+Shift+V** collapses the entire vault to a 40px-wide rail of folder/file icons, leaving max room for the terminal. Hover the rail to peek any item; click an icon to expand it inline.

---

## 9. Vivaldi 8 — the power-user incarnation

Vivaldi's relevance: it's the only Chromium browser that ships **all** of Arc's tentpole features (vertical tabs, workspaces, command palette, tab stacks/tree, split view) out of the box. Useful pieces to lift:

### Tab Stacks → Vault Stacks

Vivaldi groups tabs into hierarchical "stacks" — accordion-style nested groups. For the vault: support **`.md` files grouped in subfolders** rendered as accordion stacks in the panel. Click the stack header to expand/collapse. Visual treatment: stack header has a colored left border using the parent folder's Space color.

### Quick Commands (F2 / Cmd+E)

Vivaldi's F2 command palette is the closest Chromium equivalent to Cmd+T in Arc. The lesson: even with the standard Cmd+P/K conventions, **F2 is a great alternate binding** because it doesn't conflict with anything else in a terminal app (where Ctrl+K is "clear screen" in many shells).

### Tab Tiling vs Split View

Vivaldi supports tiling up to 4 tabs in customizable layouts. For the vault, the equivalent is: select multiple prompts in the vault and "tile" them into a multi-pane preview — useful when you want to compose a final prompt from 3 separate `.md` files.

---

## 10. Dia — the AI-first successor (October 2025)

Dia is The Browser Company's pivot away from Arc. Reached GA on macOS October 8, 2025. Acquired by Atlassian for $610M on September 4, 2025. It runs on a Chromium foundation but ships a new in-house "ADK successor" SDK rather than the original Arc Development Kit.

Key Dia patterns to learn from:

### The omnibox is the AI

Dia merges URL bar + AI assistant into one input. Type a URL → navigate. Type a question → AI answers using the contents of your open tabs as context.

For the vault: the command bar input is also the **AI prompt** input. Type a `.md` filename → it filters. Type a question → Claude (via the active terminal) answers. Both happen in one box. No mode switch.

### Skills — reusable prompt shortcuts

Dia introduced "Skills" — saved prompt templates with variables. E.g. a Skill called "Summarize tab" can be triggered with `/summarize` and reuses a stored prompt template. Variables get filled with context.

This is **exactly the prompt vault use case**, just renamed. The vault's `.md` files ARE skills. Naming convention: any `.md` whose filename starts with `skill-` becomes a quick-triggerable Skill in the command bar.

### Right-hand sidebar as AI panel

Dia, as of the November 2025 update, brought back Arc's left-side sidebar but ALSO has a right-side AI panel. So the layout is: **left = navigation/files, center = content, right = AI chat**. For the EZvibes session window the natural layout is: **left = vault, center = terminal, right = narration / what was made** (which EZvibes already has).

---

## 11. The Arc Development Kit (ADK) — what it is and why it matters

The Browser Company built their own SwiftUI-style internal SDK called the **Arc Development Kit (ADK)** to power Arc and Dia. They've publicly said they won't open-source it because it's *"core to our company's value."*

Why this matters for EZvibes: the ADK is essentially "SwiftUI for browser UIs". It lets a couple of iOS engineers prototype radical browser interfaces without touching C++. The lesson is **don't be afraid to build your own design primitives**. For EZvibes that means: build a `<vault-panel>` custom element, a `<peek-card>` custom element, a `<command-bar>` custom element. Plain Web Components. They become the EZvibes equivalent of ADK primitives — Arc-style declarative UI, in vanilla JS, with the project's own conventions baked in.

### A skeleton vault Web Component

```js
class VaultPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._items = [];
    this._folder = null;
  }

  static get observedAttributes() {
    return ['folder', 'collapsed'];
  }

  attributeChangedCallback(name, _, val) {
    if (name === 'folder') this._loadFolder(val);
    if (name === 'collapsed') this._applyCollapse(val !== null);
  }

  async _loadFolder(folder) {
    this._folder = folder;
    this._items = await window.ezvibes.listMarkdown(folder);
    this._render();
  }

  _applyCollapse(collapsed) {
    this.shadowRoot.host.classList.toggle('collapsed', collapsed);
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 240px; transition: width 0.2s ease-out; }
        :host(.collapsed) { width: 48px; }
        .item { padding: 8px 12px; cursor: pointer; }
        .item:hover { background: var(--vault-palette-hover, rgba(255,255,255,.08)); }
      </style>
      <div class="items">
        ${this._items.map(i => `<div class="item" data-path="${i.path}">${i.title}</div>`).join('')}
      </div>
    `;
    this.shadowRoot.querySelectorAll('.item').forEach(el => {
      el.addEventListener('click', () => this._paste(el.dataset.path));
    });
  }

  async _paste(path) {
    const content = await window.ezvibes.readMarkdown(path);
    this.dispatchEvent(new CustomEvent('paste', { detail: { content, path }, bubbles: true }));
  }
}
customElements.define('vault-panel', VaultPanel);
```

In the session window:

```html
<div class="session-window">
  <vault-panel folder="{folderPath}"></vault-panel>
  <div class="terminal-pocket"><div class="terminal-host"></div></div>
</div>
```

Listen for the paste event in `renderer/app.js`:

```js
sessionWindow.addEventListener('paste', (e) => {
  const { content } = e.detail;
  window.ezvibes.writeTerminal(activeTabId, content);
});
```

This is the **direct integration** the user sketched: click a prompt in the vault → it's typed into the active terminal as if pasted.

---

## 12. The "everything is the sidebar" philosophy — distilled

A list of concrete principles distilled from Arc, Sigma, Zen, Dia, Vivaldi:

1. **Persistence beats transience.** The sidebar is *always there*. It does not get dismissed by navigation.
2. **Context-switching by visual identity.** Each context has a color, an icon, an animation. The user always knows which context they're in.
3. **One keystroke to everything.** Cmd+T, Cmd+P, `/` — one shortcut opens a fuzzy search across every action, every file, every space.
4. **Preview before commit.** Hover to peek. Don't make the user open a thing just to see what it is. 300ms hover, 250ms animate, 150ms dismiss.
5. **Pin what you want forever; archive the rest automatically.** Auto-archive 12h, auto-fade-done tabs, "Reset Space" to restore originals.
6. **Inject color into the whole window.** Not just the sidebar. The Space color leaks into borders, badges, focus rings. The window itself takes on the color.
7. **Boost-friendly.** Let the user inject their own CSS/JS per Space. No two power users have the same setup.
8. **Float over everything.** Little Arc, Peek panels, command bars. None of these displace your current view; they overlay it with backdrop blur.
9. **Spring physics, not linear easing.** Arc's animations use `spring(response: 0.3, dampingFraction: 0.7)`. Translate to `cubic-bezier(0.16, 1.2, 0.3, 1)` or CSS `linear()` springs.
10. **Frosted glass everywhere.** `backdrop-filter: blur(40px) saturate(180%)` is non-negotiable for the modern feel.

---

## 13. Concrete vault implementation plan for EZvibes

Putting it all together, here's how the vault should land inside the existing EZvibes architecture (Electron 33, vanilla JS, xterm, node-pty, no React, no bundler):

### 13.1 File layout

```
renderer/
  vault.js          # All vault logic
  vault.css         # Vault + peek + command bar styles
  vault.html        # Templates (or inline in app.js)
  command-bar.js    # Reusable command bar primitive
  peek.js           # Hover-preview primitive
main.js             # Add IPC: vault:list, vault:read, vault:watch, vault:write-handoff
preload.js          # Expose vault APIs to renderer
```

### 13.2 New IPC channels

```js
// main.js
ipcMain.handle('vault:list', async (_, folder) => {
  const dir = path.join(folder, '.vault');
  if (!fs.existsSync(dir)) return [];
  const files = await fs.promises.readdir(dir);
  return files.filter(f => f.endsWith('.md')).map(f => ({
    path: path.join(dir, f),
    title: f.replace(/\.md$/, ''),
    mtime: fs.statSync(path.join(dir, f)).mtimeMs
  }));
});

ipcMain.handle('vault:read', (_, filePath) =>
  fs.promises.readFile(filePath, 'utf-8'));

// Live watch for hand-offs
const watchers = new Map();
ipcMain.handle('vault:watch', (event, folder) => {
  if (watchers.has(folder)) return;
  const dir = path.join(folder, '.vault');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const watcher = fs.watch(dir, { persistent: false }, (eventType, filename) => {
    event.sender.send('vault:changed', { folder, eventType, filename });
  });
  watchers.set(folder, watcher);
});

ipcMain.handle('vault:write-handoff', async (_, folder, content) => {
  const dir = path.join(folder, '.vault');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const name = `HANDOFF-${Date.now()}.md`;
  await fs.promises.writeFile(path.join(dir, name), content, 'utf-8');
  return name;
});
```

### 13.3 The vault layout in the session window

```html
<div class="session-window">
  <div class="tab-strip">…</div>
  <div class="session-body">
    <vault-panel folder="..." class="vault"></vault-panel>
    <div class="terminal-pocket">
      <div class="terminal-host"></div>
    </div>
  </div>
</div>
```

```css
.session-body {
  display: grid;
  grid-template-columns: var(--vault-width, 240px) 1fr;
  height: 100%;
}
.session-body.vault-collapsed { --vault-width: 48px; }
.vault {
  border-right: 1px solid rgba(255,255,255,0.06);
  background: linear-gradient(
    var(--space-angle, 135deg),
    color-mix(in srgb, var(--space-from) 8%, #1a1a1c),
    color-mix(in srgb, var(--space-to) 12%, #161618)
  );
}
```

### 13.4 Click-to-paste gesture

```js
function pasteToActiveTab(content) {
  const tabId = state.windowsByPath.get(activeFolder).activeTabId;
  window.ezvibes.writeTerminal(tabId, content);
  // Brief visual ack — the item flashes the Space color
  itemEl.classList.add('paste-ack');
  setTimeout(() => itemEl.classList.remove('paste-ack'), 600);
}
```

```css
.vault-item.paste-ack {
  animation: paste-flash 600ms ease-out;
}
@keyframes paste-flash {
  0% { background: var(--space-from); transform: scale(0.99); }
  100% { background: transparent; transform: scale(1); }
}
```

### 13.5 Hand-off live notification

When `vault:changed` fires for a file that didn't exist before, the new item slides in from the top and pulses for 3 seconds:

```js
window.ezvibes.onVaultChanged((event) => {
  if (event.eventType === 'rename') refreshVault();
});

function refreshVault() {
  // Diff old vs new, animate new items
  const newItems = await listVault();
  const oldPaths = new Set(currentItems.map(i => i.path));
  newItems.forEach(item => {
    if (!oldPaths.has(item.path)) {
      const el = renderItem(item);
      el.classList.add('newly-arrived');
      setTimeout(() => el.classList.remove('newly-arrived'), 3000);
    }
  });
}
```

```css
@keyframes newly-arrived-pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--space-from) 40%, transparent); }
}
.newly-arrived {
  animation: newly-arrived-pulse 1500ms ease-in-out 2;
}
```

### 13.6 The command bar — vault edition

```html
<div class="command-bar" hidden>
  <input type="text" placeholder="Search prompts, actions, spaces…" />
  <div class="results" role="listbox"></div>
</div>
```

Action vocabulary for the vault command bar (modeled on Arc):

- `> Paste into active terminal` (default action on selecting a `.md`)
- `> Open in side pane`
- `> Copy to clipboard`
- `> Create new hand-off`
- `> Reset vault` (re-sync from canonical source if present)
- `> Tidy vault` (ask Claude to propose folders for loose `.md`s)
- `> Switch to folder…` (jump between Spaces)
- `> New Claude tab`
- `> New Codex tab`
- `> Toggle vault`
- `> Compact mode`

Hotkey: `Ctrl+K` (or `Ctrl+Shift+P` to avoid conflicting with terminal Ctrl+K = clear).

---

## 14. The most exciting pioneer-level idea

Of all the patterns surveyed, here's the single most unique one to ship in the vault:

### "Reset Space" + "Tidy" = the self-healing prompt vault

Arc's command bar has **Reset Space** ("returns all Pinned Tabs in the current Space to their originally pinned URL") and Tidy ("AI-powered bundling of unkept tabs into a temporary folder with suggested names"). Together these mean a Space is **alive but always recoverable** — you can rearrange freely, knowing you can always Reset to a known-good layout, AND you can periodically run Tidy to have AI propose a cleanup.

Apply to the vault and you get something no prompt manager I've seen does:

1. The vault has a **canonical layout** (committed to git: `.vault/canonical.json` mapping prompt paths to their pinned positions).
2. Users freely **drop hand-offs, edit, rearrange, archive** as they work.
3. **Reset Vault** restores the canonical layout instantly.
4. **Tidy Vault** sends a request to the active Claude tab: *"Look at the files in this vault; propose a folder structure that groups them logically. Reply with a JSON manifest."* Then the vault parses Claude's response and animates the proposed groupings in. User approves with one click → it becomes the new canonical.

This makes the vault a living document that **uses the agent it lives next to** to organize itself. The prompts are organized by the same Claude that uses them. Recursive, in a good way. Nobody else is doing this — Cursor's prompt history, Continue's prompt library, Raycast Snippets, none of them have AI-assisted self-organization tied to a project-local file system with live hand-off ingestion.

---

## 15. References

- [Arc Browser: Reimagining the Browser Chrome — Blake Crosley](https://blakecrosley.com/guides/design/arc)
- [Using Arc Browser's exposed custom properties to theme my website — Ginger.wtf](https://ginger.wtf/posts/creating-a-theme-using-arc/)
- [Using Arc Theme to Style a Website — Devs Love Coffee](https://www.devslovecoffee.com/blog/using-arc-theme-to-style-website)
- [Chrome Vertical Tabs vs Arc Sidebar (2026) — SupaSidebar](https://supasidebar.com/blog/chrome-vertical-tabs-vs-arc-sidebar-2026)
- [Arc Browser Alternative: 7 Mac Apps to Replace Arc in 2026 — SupaSidebar](https://supasidebar.com/blog/arc-browser-alternative-7-mac-apps-2026)
- [Arc Browser Alternative 2026: Complete Guide — SupaSidebar](https://supasidebar.com/blog/arc-browser-alternative-guide)
- [Zen Browser Mac Review (2026) — SupaSidebar](https://supasidebar.com/blog/zen-browser-mac-review-2026)
- [Switching from Arc Browser — SupaSidebar](https://supasidebar.com/blog/switching-from-arc-browser)
- [Open-Source Chromium Browsers With Arc-Like UI (2026) — SupaCharge Browser](https://www.superchargebrowser.com/library/open-source-chromium-arc-like-browsers-2026/)
- [Arc Shut Down? Replicate Its 6 Best Features in Chrome (2026) — SupaCharge Browser](https://www.superchargebrowser.com/library/arc-browser-dead-get-features-in-chrome/)
- [How I Replaced Arc with Zen Browser — Beno](https://beno.so/thoughts/making-zen-browser-feel-like-arc)
- [Arc Browser: Rethinking the Web Through a Designer's Lens — Medium / Bootcamp](https://medium.com/design-bootcamp/arc-browser-rethinking-the-web-through-a-designers-lens-f3922ef2133e)
- [Why are these features in the Arc browser so FUN? — Jolibo](https://www.jolibo.is/blog/arc-features)
- [Arc browser review - redefining the way I browse the web — Danny Spina](https://dannyspina.com/blog/arc_browser)
- [Arc Help Center — Spaces, Distinct Browsing Areas](https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas)
- [Arc Help Center — Split View](https://resources.arc.net/hc/en-us/articles/19335393146775-Split-View-View-Multiple-Tabs-at-Once)
- [Arc Help Center — Little Arc](https://resources.arc.net/hc/en-us/articles/19235387524503-Little-Arc-Quick-Lookups-Instant-Triaging)
- [Arc Help Center — Previews: Glance Top Sites](https://resources.arc.net/hc/en-us/articles/19335284431639-Previews-Glance-Top-Sites)
- [Arc Help Center — Keyboard Shortcuts](https://resources.arc.net/hc/en-us/articles/20595231349911-Keyboard-Shortcuts)
- [Arc Help Center — Boosts: Customize Any Website](https://resources.arc.net/hc/en-us/articles/19212718608151-Boosts-Customize-Any-Website)
- [Arc Command Bar Actions (start.arc.net)](https://start.arc.net/command-bar-actions)
- [Arc Browser Keyboard Shortcuts — Hongkiat](https://www.hongkiat.com/blog/arc-browser-keyboard-shortcuts/)
- [60+ Arc Browser Shortcuts — Hot Key Cheatsheet](https://hotkeycheatsheet.com/hotkey-cheatsheet/arc)
- [Arc Browser Cheat Sheet — MeshWorld](https://meshworld.in/blog/cheatsheets/arc-browser-cheat-sheet/)
- [Arc browser tips and tricks — CSS Wolf](https://csswolf.com/awesome-arc-browser-tips-and-tricks/)
- [Arc Peek — Warren Web Blog](https://blog.warrenweb.net/arc-peek/)
- [Arc Split Views — Warren Web Blog](https://blog.warrenweb.net/arc-split-views/)
- [Arc Peek for Vivaldi — Vivaldi Forum](https://forum.vivaldi.net/topic/117338/arc-peek-for-vivaldi-link-preview-with-arc-native-animation/8)
- [Peek Preview - Arc like link preview — Chrome Web Store](https://chromewebstore.google.com/detail/peek-preview-arc-like-lin/jlllnhfjmihoiagiaallhmlcgdohdocb)
- [peek-preview on GitHub](https://github.com/tomowang/peek-preview)
- [Letter to Arc members 2025 — Browser Company Substack](https://browsercompany.substack.com/p/letter-to-arc-members-2025)
- [The Browser Company mulls selling Arc — TechCrunch](https://techcrunch.com/2025/05/27/the-browser-company-mulls-selling-or-open-sourcing-arc-browser-amid-ai-focused-pivot/)
- [Arc frozen as Browser Company pivots to Dia — The Register](https://www.theregister.com/2025/05/27/arc_browser_development_ends/)
- [Dia's AI browser starts adding Arc's greatest hits — TechCrunch](https://techcrunch.com/2025/11/03/dias-ai-browser-starts-adding-arcs-greatest-hits-to-its-feature-set/)
- [Dia browser gets fan-favorite Arc features — 9to5Mac](https://9to5mac.com/2025/11/03/dia-browser-gets-arc-features/)
- [Arc Browser vs Dia Browser — SupaSidebar](https://supasidebar.com/blog/arc-browser-vs-dia-browser)
- [Dia Browser AI Wiki](https://aiwiki.ai/wiki/dia_browser)
- [SigmaOS — Official site](https://sigmaos.com/)
- [SigmaOS Review — Medium](https://medium.com/@devongnall/sigmaos-review-great-design-horrible-keyboard-shortcuts-3d876478d7eb)
- [SigmaOS Pages docs](https://docs.sigmaos.com/tutorial/clearing)
- [Vivaldi Workspaces docs](https://help.vivaldi.com/desktop/tabs/workspaces/)
- [Auto-Hide Vertical Tabs (Arc Style) — Vivaldi Forum](https://forum.vivaldi.net/topic/107399/auto-hide-vertical-tabs-arc-browser-style)
- [Custom CSS for Vivaldi to Auto-Hide — GitHub Gist](https://gist.github.com/Felvesthe/8a13560ed3135ab1fbec2b06a18402da)
- [Arcify Chrome Extension](https://chromewebstore.google.com/detail/arcify-arc-like-vertical/ghbflkcnhdpkmbbdoflmemnifphjehec)
- [arc-like-chrome-extension on GitHub](https://github.com/Tai-ch0802/arc-like-chrome-extension)
- [ArcWTF Firefox Theme on GitHub](https://github.com/KiKaraage/ArcWTF)
- [How to Get More Out of Arc's Boosts 2.0 — Atomic Spin](https://spin.atomicobject.com/arcs-boosts-2-0/)
- [Springs and Bounces in Native CSS — Josh W. Comeau](https://www.joshwcomeau.com/animation/linear-timing-function/)
- [Designing spring animations for the web — Felix Runquist](https://felixrunquist.com/posts/designing-spring-animations-for-the-web)
- [CSS Spring Animation with Linear Easing — pqina](https://pqina.nl/blog/css-spring-animation-with-linear-easing-function/)
- [cmdk command palette on GitHub](https://github.com/pacocoursey/cmdk)
- [kbar — Cmd+K interface](https://github.com/timc1/kbar)
- [Command Palette Pattern — UX Patterns for Developers](https://uxpatterns.dev/patterns/advanced/command-palette)
- [Command Bars — Chris Coyier](https://chriscoyier.net/2022/12/18/command-bars/)
- [Command Palette UI Design — Mobbin](https://mobbin.com/glossary/command-palette)
- [Multi Blog — Spotlight / Raycast command palette activation behavior](https://multi.app/blog/nailing-the-activation-behavior-of-a-spotlight-raycast-like-command-palette)
- [Raycast — official](https://www.raycast.com/)
- [electron-command-palette on GitHub](https://github.com/Armaldio/electron-command-palette)
- [Floating UI documentation](https://floating-ui.com/docs/react)
- [MDN — backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- [MDN — radial-gradient()](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient)
