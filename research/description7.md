# Research Brief #7 — Clipboard Manager UI Patterns & Prompt-Vault Design

> Scope: How real clipboard managers, snippet expanders, and command palettes solve the exact UX you sketched — **click a markdown file in a vault panel, paste it into the active terminal tab**. Plus the deeper terminal-injection plumbing needed to make it work with `node-pty` + xterm.js, and the most pioneer-level visual ideas from 2025–2026.

This document is a knowledge dump, not a summary. It is intentionally long and dense. Pull whatever you want from it.

---

## 0. Why clipboard managers are the right reference design

The user's sketch (a dark vault panel, listed `.md` files, a "Paste" arrow into a terminal) is a *clipboard manager pattern* with three constraints flipped:

1. The "history" isn't transient — it's a **persistent folder of authored prompts** that other Claude/Codex sessions can drop hand-offs into.
2. The "paste" target isn't the focused app — it's a **specific xterm.js tab in our own renderer**, which is much easier than the OS-level focus-tracking work Maccy/Paste/Ditto have to do.
3. The "item" isn't text — it's a **markdown file on disk**, which means we get cheap features like live reload, drag-and-drop, "open in editor", and cross-session file watching for free.

So the heavy UX research has already been done by the clipboard-manager community. We just remix it. The rest of this brief is the catalog.

---

## 1. The seven canonical clipboard-manager layouts

Every clipboard manager / snippet vault collapses into one of these seven layout primitives. I'll describe each, name the apps that use it, and call out what to steal.

### 1.1 Centered HUD + dense list (Maccy, Alfred, Raycast)

- A floating, centered window. Search field at top, list of items below.
- One-row-per-item. Type icon on the left (text "A", image thumbnail, file glyph, URL favicon), single line of text, optional source-app icon and timestamp on the right.
- Hover or arrow-key focus shows a **right-side preview popover** with the full content rendered (multi-line, syntax-highlighted code, image thumbnail, etc.).
- Enter pastes into the *previously focused* app. `Cmd/Ctrl+Number` jumps to item N. `Cmd+Shift+V` opens the HUD.
- Maccy adds pinned-items-on-top with permanent shortcuts (`Option+P` to pin). Raycast adds type filters (`Cmd+P` cycles text / images / files / links / emails / colors).
- Pioneer detail (Raycast v2): "**Paste as…**" — Enter pastes as the original format, `Cmd+Enter` lets you pick rich text vs plain text vs RTF vs HTML for the same item. The format mode is per-paste, not per-item.

**Steal:** the right-side preview popover is the single highest-impact pattern. For us it becomes: highlight a `.md` row → right pane renders the rendered markdown (headings styled, code blocks syntax-highlit). It tells the user *what they're about to paste* in real time.

### 1.2 Finder-style multi-pane sidebar (Pastebot, Paste, PasteBar)

- Mac Finder/Mail-style three-column layout.
- **Left sidebar:** sources / pinboards / collections / tags / saved filters.
- **Middle column:** the items in the active source — long scrolling list.
- **Right column:** the full preview of the selected item, with inline editing.
- Pastebot lets you build *filter chains* on the right (e.g., "Convert to plain text" → "Wrap in `<pre>`" → "Lowercase") with a live preview that updates as you drag steps around.
- Paste calls collections "**pinboards**" and lets you drag from history into a board, drag items between boards, edit in place, and share/export a whole board.

**Steal:** the pinboard concept. Our analog: **prompt sets** — saved combos of markdown files you commonly paste together (e.g., "review session" = `CLAUDE.md` + `HANDOFF.md` + `style-guide.md`). Click a set → paste all three in sequence with separators.

### 1.3 Horizontal carousel / strip dock (Paste original, Paste 4 iOS, Droppy notch shelf)

- Items appear as **horizontal cards along the bottom or top edge** of the screen, like macOS Dock.
- Card front shows a preview thumbnail, you scroll left/right.
- Paste on macOS pioneered this with a slide-in-from-bottom strip.
- Droppy (2025) puts the strip *inside the MacBook notch* — content is "stored in the notch" as a literal physical-feeling shelf.

**Steal:** thin horizontal strip variant — runs along the top of the terminal pocket, just under the tab strip. Each prompt is a square chip, click to paste. Frees up the sidebar for the file tree. Visually communicates "these are tools at hand."

### 1.4 Grid of preview tiles (Pastebot grid view, ComfyUI_PromptManager)

- 2D grid of cards. Each card big enough to show the first ~3 lines of text or full image thumbnail.
- Star rating badge in the corner, tag chips along the bottom of the card.
- Best for visual content but also surprisingly nice for prompts — you can recognize a prompt by its shape (heading + code block looks different from a long paragraph).

**Steal:** alternate "grid" view for when the vault has 30+ items. CSS Grid `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` with cards roughly `220 × 140 px`, internal padding `12px`, a 6-line clamped markdown preview.

### 1.5 Bento grid (2025–2026 trend — Apple, Linear, Vercel)

- Variable-size tiles in one strict grid. A "hero" prompt gets a 2×2 cell, secondary prompts get 1×1, recently-changed ones get 1×2 to fit the highlight badge.
- Visual hierarchy by size means the user's eye is pulled to important prompts (the file the other agent just dropped, or a pinned one).
- Implemented in pure CSS Grid — no JS layout engine needed, way lighter than masonry. Static order means it works with virtual scrolling.

**Steal:** treat hand-off files (`HANDOFF.md`, anything modified in the last 30 seconds) as the 2×2 hero cells with a pulsing border. Everything else 1×1. The vault becomes a *dashboard*, not just a list.

### 1.6 Floating bubble overlay (RaptorBlingx/PromptVault, Advanced Clipboard Chrome ext, Droppy basket)

- Small persistent dot/bubble somewhere on the screen edge. Click it to expand into a full panel; click outside to collapse to a dot again.
- Bubble itself is draggable. Often round, 44–56 px.
- Great for "ambient" availability without taking up real estate.

**Steal:** in our case, this could be a floating "vault" gem that lives over the terminal pocket — click it, panel slides out from the side. Free-floating, doesn't disrupt the tab strip.

### 1.7 Inline command-palette (cmdk, kbar, Warp Drive prompts, Cursor `@` mentions)

- Triggered by a hotkey (Cmd/Ctrl+K). Modal centered on screen.
- A single search input with a results list directly below.
- Items are filtered live by fuzzy search.
- Arrow keys to navigate; Enter to execute the action attached to the item.
- Warp Drive's prompt system literally is this — they're "parameterized natural-language queries" you save, type `prompts:` in the command palette to surface them all.
- Cursor's `@` mentions are the *inline* version of this — typing `@filename` in the chat surfaces file matches as you type.

**Steal:** an inline command-palette mode of the vault. Press `Ctrl+P` inside a terminal tab and the cmdk-style palette overlays the terminal area. Type any fuzzy fragment (`hdf`, `hand`, `claude`) and it filters the vault's `.md` files. Enter pastes. This is the **keyboard-first power-user** path next to the visual click-first path.

---

## 2. Specific apps + UI patterns worth stealing

### Maccy (open-source, macOS, Swift)

- 500 ms polling of the system clipboard (configurable). For us: file watcher fires immediately, no polling needed.
- "Pinned items remain on top of the list" with permanent keyboard shortcuts.
- New search-highlight-matches mode highlights matching characters in *yellow, Safari-style*, not a generic background tint. Subtle but readable.
- The window is **resizable like any other window** with a scrollable history list.
- Source-app icons (Settings → Appearance) — toggleable. The user can see "this snippet came from Slack" at a glance.
- Pasted item ordering: when an item is re-used, it bubbles to the top.
- Repo: <https://github.com/p0deje/Maccy>

### Paste (FiPlab, macOS)

- "Pinboards" are color-coded collections. Each pinboard gets a hue tag along its tile edge.
- Drag-and-drop between pinboards is the primary organizational gesture.
- Search returns results across *all* pinboards plus the running history.
- Image and link items get rich previews — link items get an OG-image-style card with title + favicon + description.
- iCloud sync across devices, including an iOS keyboard extension that drops items straight into any text field via tap.
- Site: <https://pasteapp.io>

### Pastebot (Tapbots, macOS)

- The killer feature is **filters** — text-mutation pipelines that run on paste.
- Filter UI: a list of filter types you chain (each row has a gear menu to reorder or remove); a live preview window shows the input/output as you build the chain.
- Available filter types include Create List, Wrap in Paragraph Tags, Convert to Plain Text, Change Case, Emoji Remover, **Run Shell Script**.
- For prompts this maps perfectly: a filter could inject the active folder path, inject the active branch name, expand `{{variable}}` placeholders, or wrap in a bracketed-paste-safe envelope before sending to the PTY.
- Docs: <https://tapbots.com/pastebot/help/05_filters/>

### Raycast (cross-platform, hybrid Swift/.NET/React/WebView)

- v2 architecture: native shell (Swift on macOS, C#/.NET 8/WPF on Windows) + React/TS in a system WebView + Rust core for indexing. **Single React codebase serves both platforms via WebView.**
- They deliberately **eliminated `cursor: pointer`** because it's a web-not-desktop convention.
- They **removed hover highlights** on list items because that's "non-native."
- Settings open in **separate native windows**, never as modals.
- Popovers and tooltips render as **native windows** that can extend past the main window bounds.
- Adopted **Liquid Glass** material on macOS Tahoe for the visual treatment, and acrylic on Windows via WebView2.
- Custom "ss03" stylistic set of Inter is *the* signature typographic detail.
- **Keycap glyphs** are subtle gradient-filled rounded badges showing keyboard shortcuts inline.
- Hero red diagonal stripes — three diagonal bars layered like a motion-blur launch banner.
- Memory baseline 350–450 MB (acknowledged as a trade-off vs v1's 200–300 MB).
- Article: <https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast>

For us this means: even though our renderer is web-tech, we should *act native*. No `cursor: pointer` on list rows; instead, use the focus ring + a left-edge accent bar. No hover-highlight that "spotlights" only what the mouse is over; let the keyboard focus state be the strongest visual indicator.

### Raycast Clipboard History (subset of above)

- `Cmd+P` filters by type: Text / Images / Files / Links / Emails / Colors.
- `Cmd+.` pins. `Cmd+E` renames an entry (gives it a human label).
- "Paste as…" lets you switch between *all the original formats the source provided* — they preserve the full pasteboard, not just one representation.
- Recent update: search-text-highlighting now lights up the matched substring in results.

### Raycast Snippets

- Tags (added in v2) — every snippet gets one or more tags; filter view collapses to a tag.
- `{calculator}` and similar dynamic placeholders evaluate at expansion time.
- Snippets and clipboard history share the same UI surface. The "All Snippets" entry at the top of the clipboard viewer flips into the snippets browser.

### Alfred Clipboard + Snippets

- `Cmd+L` previews clipboard contents as **Large Type** — full-screen high-contrast text. Useful for reading long snippets without paste.
- `Cmd+Y` Quick Look preview (same gesture as Finder).
- `{clipboard}` `{clipboard:1}` `{clipboard:2}` ... placeholders inside snippets, so you can author a snippet that interpolates whatever's in slots 0..N of the history.
- Snippets viewer is reachable from the clipboard viewer via an "All Snippets" item at the top of the list — single surface, two modes.
- Docs: <https://www.alfredapp.com/help/features/clipboard/>

### Ditto (Windows, free, native Win32, ~15 MB RAM)

- Per-application paste-shortcut rules — e.g., paste with `Shift+Insert` into PuTTY but `Ctrl+V` into Notepad. The mapping is keyed by the focused window.
- "Groups" let you bundle related items: phone + email + address into one Contact group.
- Light + dark themes (with a "don't blind me at night" pitch).
- Native Win32 — feels like a built-in Windows utility.
- Site: <https://sabrogden.github.io/Ditto/>

### CopyQ (cross-platform, Qt, JS scripting engine)

- **Tabs** at the top of the window for organizing items (this is interesting — our session windows already have tabs, but CopyQ uses tabs to *segment the clipboard itself* into named compartments).
- F2 to edit an item in place. Drag/Ctrl+Up/Down to reorder.
- Custom commands run on F6.
- **Full scripting engine** — JS-like macros that can transform, filter, route items, run on triggers.
- Site: <https://hluk.github.io/CopyQ/>

### PasteBar (Mac + Windows, free, open-source, Tauri)

- Collections / tabs / boards three-level organization.
- Syntax highlighting for code snippets (Python, JS, Java, Go, Rust, etc.).
- Type-specific previews — text differently from image differently from URL differently from code.
- Lock screen + passcode protection for the whole vault.
- "History masking" hides clipped sensitive content (passwords, keys) but keeps it pasteable.
- Site: <https://www.pastebar.app>

### Snippety (macOS, iOS — text expander + snippet manager)

- Keyboard trigger expansion (you type a trigger, it expands).
- AI Assistant *inside* the snippet editor — "fix typos," "summarize," "translate," "reply to email" on the snippet content itself.
- iCloud sync, formatting toolbar above the iOS keyboard.
- Site: <https://snippety.app>

### Espanso + EspansoEdit (cross-platform, Rust)

- Espanso itself is **YAML-only** — no built-in GUI. Snippets are matches in `.yml` files.
- Triggers (`:date`, `:sig`) expand inline as you type, anywhere on the OS.
- Built-in extensions: dates, shell commands, scripts, clipboard content, random, choice dialogs, forms.
- **Forms** are runtime dialogs with input fields that fill in `{{name}}` `{{email}}` placeholders before expansion. (This is exactly Warp Drive's variable-prompt pattern, two years earlier.)
- The Espanso Hub is a package ecosystem — `espanso install`-style commands fetch community snippet bundles.
- EspansoEdit GUI (third-party): treeview of triggers, sortable by name/sequence, find-as-you-type, match builder dialog with 30+ "building blocks" and live syntax-highlighted preview, dark/light theme, code folding for trigger blocks.
- Espanso repo: <https://github.com/espanso/espanso>
- EspansoEdit features: <https://ee.qqv.com.au/usage/features/>

### TextExpander (paid, multi-platform)

- Heavy on **collaboration / shared libraries** — teams share snippet sets.
- **Fill-in fields** for personalization (same idea as Espanso's forms).
- Usage analytics — how often each snippet is fired, time saved.

### Warp (modern terminal w/ AI)

- **Warp Drive Prompts** — saved parameterized NL queries usable from the Command Palette by name or by typing `prompts:` to list all.
- Arguments declared as `{{argument}}` in the prompt body; `Shift+Tab` cycles through arguments at fire-time.
- New prompts created from Warp Drive with a `+` button → "Prompt."
- **Pattern match**: this is exactly what we want — saved files with template variables that you select, then a small form pops up to fill in vars before paste.
- Docs: <https://docs.warp.dev/knowledge-and-collaboration/warp-drive/prompts/>

### Cursor (`.cursorrules`, `.cursor/rules/*.mdc`)

- Moved from one top-level `.cursorrules` file to a `.cursor/rules/` folder of `.mdc` files with YAML frontmatter (`description`, `globs`, `alwaysApply`).
- Glob-scoped rules auto-attach when matching files are touched.
- **The relevance for us**: the same `.mdc` markdown-with-frontmatter format is the perfect format for the vault's prompt files. Each `.md` could have frontmatter: `title`, `tags`, `pinned`, `agent` (claude/codex), `args` (for forms).

### CopyMagic (semantic clipboard, 2025)

- Embeddings-based search: type "the partiful invite I copied last week" and it finds it without exact text match.
- Local — runs on-device.
- $30 lifetime as of late 2025.

### VeloxClip (AI clipboard, macOS)

- OCR on screenshots — copy a screenshot, the text inside becomes searchable.
- Same semantic-search engine as CopyMagic.

### PowerToys Advanced Paste (Windows, free)

- Microsoft's native answer. "Paste as Markdown / Plain Text / JSON" runs an LLM on the clipboard contents at paste time.
- Built into Windows 11. Open-source.
- Docs: <https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste>

### UiPath Clipboard AI

- Enterprise RPA. "Semantic automation" — understands which fields map to which between two apps. Copy from Excel → it knows which Salesforce fields each column maps to.
- Way out of scope but interesting as a north star.

### Droppy (notch shelf, 2025, macOS)

- Uses the MacBook display notch as physical storage space.
- Hover the notch → drawer slides down with stored items.
- Drag files into the notch to stash them.
- Hardware integration + native HUDs replace overlay-style approaches.

---

## 3. Visual / motion patterns I'd actually steal

### 3.1 Right-side preview popover

A floating panel anchored to the focused row, sliding in 60 ms with `transform: translateX()` and a tiny fade. Width about `360–420 px`. Renders the markdown — headings stylized, code blocks with monospace + line numbers + a `Copy` button. The popover is the **safety net**: the user sees the full content before paste, no surprise.

CSS sketch:

```css
.vault-preview {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  width: 380px;
  max-height: 70vh;
  padding: 16px 20px;
  background: rgba(28, 28, 30, 0.86);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  overflow-y: auto;
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 80ms ease, transform 80ms ease;
  pointer-events: none;
}
.vault-row:focus-within ~ .vault-preview,
.vault-row:hover ~ .vault-preview {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
```

### 3.2 Liquid-Glass / acrylic panel material

Apple's Tahoe Liquid Glass and Windows 11's Mica/Acrylic look the same in spirit: a semi-translucent surface with hue-bleed from whatever's below, plus a soft border.

```css
.vault-panel {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.0)),
    rgba(20, 20, 22, 0.72);
  backdrop-filter: blur(28px) saturate(160%) brightness(0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 24px 64px -16px rgba(0, 0, 0, 0.55);
}
```

Important caveat from the Raycast deep-dive: **disable WebKit/WebView throttling** if you put this in a WebView (`windowOcclusionDetectionEnabled = false` on macOS WKWebView; for Electron BrowserWindow this is mostly fine, but `backgroundThrottling: false` on the `webPreferences` is the right knob).

### 3.3 Search-highlight in yellow (Safari/Maccy)

```css
mark.vault-match {
  background: rgba(255, 214, 10, 0.32);
  color: inherit;
  border-radius: 2px;
  padding: 0 2px;
  box-shadow: 0 0 0 1px rgba(255, 214, 10, 0.18);
}
```

When you implement fuzzy search, wrap matched characters in `<mark class="vault-match">` so users can see the match logic.

### 3.4 Keycap glyphs (Raycast)

```css
.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font: 600 11px/1 ui-sans-serif, system-ui;
  background: linear-gradient(180deg, #3a3a3d, #2c2c2e);
  color: #f5f5f7;
  border: 1px solid rgba(255,255,255,0.08);
  border-bottom-width: 2px;
  border-radius: 5px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.4);
}
```

Use these inline next to every row label that has a shortcut, like Raycast does. They communicate "this is keyboard-driveable."

### 3.5 Hero-stripe accent

For "fresh hand-off" prompts, a Raycast-style three-stripe accent (red/orange/yellow) ribboned across the corner of the card. Cheap visual loudness, very identifiable.

```css
.vault-card.fresh::before {
  content: "";
  position: absolute;
  top: -2px; right: -2px;
  width: 56px; height: 56px;
  background:
    repeating-linear-gradient(
      135deg,
      #ff3b30 0, #ff3b30 6px,
      #ff9500 6px, #ff9500 12px,
      #ffcc00 12px, #ffcc00 18px
    );
  clip-path: polygon(100% 0, 100% 100%, 0 0);
  border-top-right-radius: 12px;
}
```

### 3.6 FLIP card list-to-detail expansion

GSAP's FLIP technique animates a card going from a list row to a full-detail expanded view by recording first/last positions and inverting/playing the transform. Beautiful for "click prompt → expand to show full body before paste":

```js
// vanilla version, no GSAP needed
const first = el.getBoundingClientRect();
el.classList.add("expanded");
const last = el.getBoundingClientRect();
const dx = first.left - last.left;
const dy = first.top - last.top;
const sx = first.width / last.width;
const sy = first.height / last.height;
el.animate(
  [
    { transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
    { transformOrigin: "top left", transform: "translate(0, 0) scale(1, 1)" }
  ],
  { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" }
);
```

### 3.7 Genie consistency

You already have Genie minimize/restore animation for session windows. **Apply the same animation to the vault panel** — opens with a Genie effect from the "vault" icon in the tab strip, collapses back to that icon. Brand consistency.

### 3.8 Drop-zone halo

When the user is dragging a file into the vault (or hovering one), the panel border lights up:

```css
.vault-panel.drop-target {
  outline: 2px solid #ffcc00;
  outline-offset: -2px;
  box-shadow:
    0 0 0 6px rgba(255, 204, 0, 0.12),
    0 0 32px rgba(255, 204, 0, 0.32);
  transition: outline-color 120ms, box-shadow 120ms;
}
```

### 3.9 "Pulsing fresh" indicator

A subtle 1.5-second-cycle pulse on the row of a `.md` file that was modified in the last 30 seconds. Tells the user "another session just wrote this":

```css
@keyframes vault-fresh-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(255, 204, 0, 0.4); }
  60%  { box-shadow: 0 0 0 8px rgba(255, 204, 0, 0);   }
  100% { box-shadow: 0 0 0 0   rgba(255, 204, 0, 0);   }
}
.vault-row.fresh { animation: vault-fresh-pulse 1.5s ease-out 4; }
```

After 4 cycles it stops — long enough to grab attention, short enough not to be annoying.

---

## 4. Visual treatment for different content types

Steal Raycast's filter set: Text / Images / Files / Links / Emails / Colors. For our vault, map to: **Prompt / Hand-off / Rules / Spec / Notes / Untyped**. The categorization can be by:

1. **Filename prefix** — `prompt-*.md`, `handoff-*.md`, `rules-*.md`, `spec-*.md`.
2. **Frontmatter** — `type: handoff` in YAML.
3. **Directory** — `prompts/` vs `handoff/` vs `rules/`.

Each type gets a glyph + accent color:

| Type | Glyph | Accent | Notes |
|---|---|---|---|
| Prompt | `>` chevron | amber `#ffcc00` | Your default agent prompt |
| Hand-off | arrow `→` | hot pink `#ff2d92` | Fresh files pulse |
| Rules | shield | teal `#5ac8fa` | `.cursorrules`-style |
| Spec | document | blue `#0a84ff` | Long-form design |
| Notes | dot grid | gray `#8e8e93` | Generic |

Code blocks inside the preview should be syntax-highlit. Use [Shiki](https://github.com/shikijs/shiki) (textmate-grammar-based, same engine as VS Code; you can ship it as a single ESM import in vanilla JS) or [highlight.js](https://highlightjs.org/) (cheaper but less accurate). For markdown rendering, [marked](https://marked.js.org/) is a single-file zero-dep library that works in vanilla JS.

---

## 5. Architecture — putting the vault into your Electron app

### 5.1 Where the data lives

Per the user's vision: **the vault is a folder on disk**. Each session window's vault is rooted at a per-folder path, e.g. `<sessionFolder>/.vault/` or `<sessionFolder>/prompts/`.

This is a perfect fit because:

- Other Claude/Codex sessions running in that folder can drop `.md` files in directly.
- A file watcher (`chokidar`) gives you live UI updates with no IPC dance.
- Files are portable, versionable in git, and human-readable.
- A "user global" vault at `~/.ezvibes/prompts/` can be a fallback layer, with per-folder vault as an overlay.

Frontmatter spec (steal from Cursor `.mdc`):

```yaml
---
title: "Hand-off: refactor terminal-host sizing"
type: handoff           # prompt | handoff | rules | spec | notes
pinned: true
tags: [terminal, sizing]
agent: claude           # paste-only-when-claude | codex | both (default)
created: 2026-05-25T12:34:56Z
modified: 2026-05-25T12:34:56Z
---

The body of the prompt goes here. Anything below the second `---` is
the actual prompt text that pastes into the terminal.
```

### 5.2 The file watcher

`chokidar` is the standard. Already battle-tested across all platforms, handles macOS FSEvents quirks, Linux inotify, Windows ReadDirectoryChangesW. Use the renderer-process bridge pattern your project already uses.

```js
// main.js
const chokidar = require("chokidar");
const watchers = new Map(); // sessionWindowId -> watcher

ipcMain.handle("vault:watch", (e, { sessionWindowId, vaultPath }) => {
  const w = chokidar.watch(vaultPath, {
    ignored: /(^|[/\\])\../, // skip dotfiles
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 40 }, // wait until writes settle
  });
  const send = (event) => (path) =>
    e.sender.send("vault:event", { sessionWindowId, event, path });
  w.on("add", send("add"))
   .on("change", send("change"))
   .on("unlink", send("unlink"));
  watchers.set(sessionWindowId, w);
});

ipcMain.handle("vault:unwatch", (e, { sessionWindowId }) => {
  watchers.get(sessionWindowId)?.close();
  watchers.delete(sessionWindowId);
});
```

The `awaitWriteFinish` option is *crucial* — Claude/Codex might write a file in chunks, and you don't want to render half-written prompts. 80 ms stability threshold is a sweet spot.

For initial scan (`ignoreInitial: false`), every existing file fires `add` on watcher start. That's how you get the initial list "for free" in the same code path as updates.

### 5.3 The IPC channels you need

Add to `preload.js`:

```js
contextBridge.exposeInMainWorld("ezvibes", {
  // existing...
  vaultWatch:   (sessionWindowId, vaultPath) =>
    ipcRenderer.invoke("vault:watch", { sessionWindowId, vaultPath }),
  vaultUnwatch: (sessionWindowId) =>
    ipcRenderer.invoke("vault:unwatch", { sessionWindowId }),
  vaultRead:    (filePath) => ipcRenderer.invoke("vault:read", { filePath }),
  vaultWrite:   (filePath, contents) => ipcRenderer.invoke("vault:write", { filePath, contents }),
  vaultRename:  (oldPath, newPath) => ipcRenderer.invoke("vault:rename", { oldPath, newPath }),
  vaultDelete:  (filePath) => ipcRenderer.invoke("vault:delete", { filePath }),
  vaultRevealInOS: (filePath) => ipcRenderer.invoke("vault:reveal", { filePath }),
  onVaultEvent: (callback) =>
    ipcRenderer.on("vault:event", (_, payload) => callback(payload)),
});
```

### 5.4 The paste mechanism — the actual money question

You have `node-pty` PTY sessions keyed by `sessionId`. To paste a prompt into the active terminal tab, the renderer fires:

```js
window.ezvibes.writeTerminal(activeTabSessionId, promptText);
```

…which in `main.js` resolves to:

```js
ptySessions.get(sessionId).pty.write(promptText);
```

The PTY sees this as if the user typed it. Two gotchas:

#### 5.4.1 Bracketed paste mode

If the shell supports it (modern PowerShell, zsh, bash with readline 7+), wrap the payload in DEC special bracket sequences so the shell knows it's pasted:

```js
const BRACKET_START = "\x1b[200~";
const BRACKET_END   = "\x1b[201~";

function pasteToPty(pty, text) {
  // Strip embedded bracket-end so payload can't break out (Wikipedia: bracketed-paste)
  const safe = text.replace(/\x1b\[201~/g, "");
  pty.write(BRACKET_START + safe + BRACKET_END);
}
```

This means a multi-line prompt does *not* execute on each newline. It lands as a single editable buffer. Critical for safety. Note: the `claude` and `codex` CLIs may or may not respect bracketed-paste — test both. PowerShell PSReadLine *does* (since 2018-ish).

#### 5.4.2 Newline handling

Different shells / CLIs want different line terminators. PowerShell wants `\r`, bash wants `\n`, the terminal itself converts. Inside bracketed paste, **send raw `\n`** — don't pre-translate. Outside bracketed paste, send `\r` on Windows PowerShell. Detect via the spawn-time shell info you already track in `main.js`.

#### 5.4.3 The xterm.js `write()` myth

A common confusion: you might think you call `term.write(text)` on the xterm Terminal instance. That actually writes to the **screen buffer** — it makes text *appear* without going through the shell. The shell never sees it, so it can't execute. You must go through the PTY. `term.write()` is only useful for echoing things like banner text or system status.

The xterm.js `paste()` API doesn't exist as a stable public method — it's been requested since 2017 (issue #284, #2390) but the official recommendation is "use the data event handler with `term.onData` to send to PTY." Which is what you're already doing.

### 5.5 Variable forms (Warp Drive / Espanso pattern)

If a prompt contains `{{variable}}` placeholders, show a tiny modal before paste:

```js
function expandVariables(text) {
  const vars = [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
  if (vars.length === 0) return Promise.resolve(text);
  return new Promise((resolve) => {
    showFormModal(vars, (values) => {
      const expanded = text.replace(/\{\{(\w+)\}\}/g, (_, v) => values[v] ?? "");
      resolve(expanded);
    });
  });
}
```

Modal styling: same Liquid-Glass treatment as the vault. One input per variable, `Enter` to commit, `Esc` to cancel.

### 5.6 Virtual scrolling for large vaults

When the vault has 200+ files, plain DOM rendering will choke. Use a simple windowed virtual scroller — ~150 LOC of vanilla JS:

```js
class VirtualList {
  constructor({ container, itemHeight, buffer = 5, renderItem }) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.buffer = buffer;
    this.renderItem = renderItem;
    this.items = [];
    this.viewport = container.querySelector(".vlist-viewport");
    this.spacer   = container.querySelector(".vlist-spacer");
    container.addEventListener("scroll", () => this.render());
  }
  setItems(items) {
    this.items = items;
    this.spacer.style.height = `${items.length * this.itemHeight}px`;
    this.render();
  }
  render() {
    const top = this.container.scrollTop;
    const h   = this.container.clientHeight;
    const start = Math.max(0, Math.floor(top / this.itemHeight) - this.buffer);
    const end   = Math.min(this.items.length, Math.ceil((top + h) / this.itemHeight) + this.buffer);
    this.viewport.style.transform = `translateY(${start * this.itemHeight}px)`;
    this.viewport.innerHTML = "";
    for (let i = start; i < end; i++) {
      this.viewport.appendChild(this.renderItem(this.items[i], i));
    }
  }
}
```

Fixed row height makes the math trivial. `translateY` keeps GPU compositing instead of layout reflow. 50 LOC of CSS:

```css
.vault-list { position: relative; overflow-y: auto; height: 100%; }
.vlist-spacer { width: 1px; }
.vlist-viewport { position: absolute; top: 0; left: 0; right: 0; }
```

### 5.7 Fuzzy search

cmdk uses `command-score`. kbar uses Fuse.js. For our needs, [Fuse.js](https://www.fusejs.io/) is the simplest drop-in (single file, zero-dep, options for threshold, keys, etc.):

```js
import Fuse from "fuse.js";
const fuse = new Fuse(vaultFiles, {
  keys: ["title", "tags", "body"],
  threshold: 0.35,
  includeMatches: true, // gives us per-character match indices for highlighting
});
const results = fuse.search(query);
```

For an even lighter zero-dep approach, [uFuzzy](https://github.com/leeoniya/uFuzzy) is faster than Fuse for typical sizes and only 7 KB.

---

## 6. The "paste preview" mental model

This is the single most-stolen UX pattern across all of these apps and worth calling out separately.

The user hovers an item → a peek-window appears with the **rendered full content**.

It accomplishes three things simultaneously:

1. **Safety** — user sees what's about to be pasted, no surprises.
2. **Recognition** — when the user is looking for prompt-X among 30 prompts, the visual shape helps them spot it without reading.
3. **Type-affordance** — markdown rendered as markdown screams "this is a prompt," raw text vs code vs image looks distinctly different.

Implementations vary on **anchoring**:

- Anchored to the row (Raycast, Alfred Quick Look): preview pane is always in the same spot, the user's eye doesn't jump.
- Floating from the cursor (Maccy tooltip, Pastebot grid hover): more immersive but harder to track.
- Inline expand (Linear list-to-detail FLIP): the row itself grows. No second window, but only one item visible at a time.
- Detached secondary window (Alfred Large Type / Cmd+L): full-screen treatment of a single item.

I'd implement **anchored on the right** for our list view (most consistent with Raycast/Finder/Mail) and **inline expand** for the grid view.

Show preview after a **180 ms hover delay**. Less than 120 ms and it pops on accidental mouse-pass. More than 300 ms feels laggy.

```js
let previewTimer = null;
row.addEventListener("mouseenter", () => {
  previewTimer = setTimeout(() => showPreview(row), 180);
});
row.addEventListener("mouseleave", () => {
  clearTimeout(previewTimer);
  hidePreview();
});
row.addEventListener("focus", () => showPreview(row)); // immediate on keyboard focus
```

---

## 7. Interaction grammar — keyboard contract

The single biggest thing every "pioneer" desktop app of 2026 does right is **keyboard-first then mouse-second**. Steal the Raycast/Linear/cmdk contract literally:

| Action | Binding |
|---|---|
| Open vault | `Ctrl+P` (Windows) / `Cmd+P` (Mac) — like VS Code "Open File" |
| Close vault | `Esc` |
| Move focus | `↑` / `↓` (and `Ctrl+J` / `Ctrl+K` vim-style as alt) |
| Move focus across columns | `←` / `→` |
| Type-filter / open search | start typing; search input auto-focuses |
| Paste focused prompt | `Enter` |
| Paste focused prompt as plain text (strip frontmatter) | `Shift+Enter` |
| Paste with variable form | `Cmd/Ctrl+Enter` |
| Pin/unpin focused | `Ctrl+.` |
| Rename | `F2` (or `Ctrl+R`) |
| Reveal file in Explorer/Finder | `Ctrl+Shift+R` |
| Edit file in default editor | `Ctrl+E` |
| Delete focused | `Delete` (with confirm) |
| Jump to pinned slot N | `Ctrl+1`..`Ctrl+9` |
| Switch list/grid view | `Ctrl+\` |
| Cycle type filter | `Ctrl+Shift+F` |
| New prompt from clipboard | `Ctrl+Shift+N` |

For non-modal browsing inside a session window, an inline search input *is* the search; you don't need a separate command-palette toggle. The cmdk modal is more for cross-window or global search.

---

## 8. Pioneer-level ideas worth highlighting

These are the "if you only steal one thing" patterns ranked by how distinctive they'd feel inside EZvibes.

### 8.1 ★ Hot-reload hand-off detection with pulsing hero card

This is the killer feature uniquely enabled by your architecture:

- A subagent in session A writes `HANDOFF.md` into its vault folder.
- Session B (or session A's main agent) has the vault panel open. The file appears with a pulsing hero-stripe hero card *immediately* (chokidar fires in <50 ms).
- Hovering the card shows the rendered preview. Enter pastes it straight into the terminal.

No clipboard manager has this. It's clipboard-manager UX *for the multi-agent age*. The pulse + bento hero placement + Genie animation in one combined moment is the single most pioneer-level beat you can land.

### 8.2 ★ Variable forms with shell-aware preview

Espanso forms + Pastebot filters + Warp Drive prompts combined. Open a prompt that has `{{branch}}` and `{{cwd}}` placeholders → a tiny inline form appears below the preview. Inputs default-fill with values from the active terminal tab (the PTY knows its own cwd; you can run `git branch --show-current` once and cache). User tabs through fields, hits Enter, sees the *final* expanded text in the preview, hits Enter again to paste. Two-step confirm.

### 8.3 ★ Filter chain (Pastebot-style) for paste pipeline

Each vault file can have an optional "filter chain" in frontmatter:

```yaml
filters:
  - strip-frontmatter
  - replace-paths-with-relative
  - bracket-safe
```

Filters live in `~/.ezvibes/filters/*.js`. Each filter is a function `(text, ctx) => text`. The chain runs before paste. This is *the* feature that turns the vault from a clipboard into a programmable paste pipeline.

### 8.4 Drag from vault → drop on terminal tab to paste

Drag a vault row onto a different tab in the same session window (or even a different session window) → drop initiates a paste on that target. Visual feedback: drop-zones light up on every tab chip while a drag is in flight.

### 8.5 Recently-pasted "tape" timeline at the bottom

Below the terminal pocket, a thin horizontal strip of the last 8 things you pasted (from vault, clipboard, or typed in). Click any chip to re-paste. This is Pastebot's recent-clip strip but applied to the *output side* (what was sent to PTY), not the system clipboard.

### 8.6 Semantic search of the vault (à la CopyMagic)

Local embeddings (Xenova/transformers.js with `Xenova/all-MiniLM-L6-v2` in a worker) embed every `.md` on save. Search becomes semantic — "the prompt about refactoring xterm sizing" finds it even if those words aren't in the file. Stretch goal but very 2026.

### 8.7 Multi-session "hand-off arrows" between vaults

When session A's vault drops a file with frontmatter `target: <other-session-folder>`, the vault UI in session B shows a literal arrow drawn from a tiny session-A folder badge into the new card. Visual hand-off you can see across the desktop.

---

## 9. Stack pieces you can pull off the shelf

| Concern | Library | Footprint | Why |
|---|---|---|---|
| File watcher | [`chokidar`](https://github.com/paulmillr/chokidar) | ~75 KB | Industry standard; handles all platforms |
| Markdown rendering | [`marked`](https://marked.js.org/) | ~30 KB | Single file, no deps, fast |
| Syntax highlight | [`shiki`](https://shiki.style/) | ~280 KB + grammars | VS Code-grade |
| Lighter syntax highlight | [`highlight.js`](https://highlightjs.org/) | ~60 KB | Smaller |
| Fuzzy search | [`fuse.js`](https://fusejs.io/) | ~17 KB | Battle-tested |
| Lighter fuzzy | [`ufuzzy`](https://github.com/leeoniya/uFuzzy) | 7 KB | Faster, smaller |
| Drag-and-drop | Native HTML5 DnD | 0 KB | Sufficient for our needs |
| Floating positioning | [`@floating-ui/dom`](https://floating-ui.com) | ~15 KB | For preview popover anchoring |
| YAML frontmatter | [`gray-matter`](https://github.com/jonschlinkert/gray-matter) | ~50 KB | Parses `.md` with `---` frontmatter |
| Embeddings (stretch) | [`@xenova/transformers`](https://github.com/xenova/transformers.js) | ~9 MB (with model) | Local semantic search |
| Cmd palette (if you want one) | [`cmdk`](https://cmdk.paco.me/) | requires React | …or write 200 LOC vanilla |
| Or vanilla command bar | [`kbar`](https://github.com/timc1/kbar) | requires React | same caveat |

You're vanilla-JS only; the React ones are off-table. The combo I'd actually ship: `chokidar + marked + shiki + fuse.js + gray-matter + @floating-ui/dom`. Total ~390 KB unminified.

---

## 10. References and reading

Apps:

- Maccy — <https://maccy.app> / <https://github.com/p0deje/Maccy>
- Paste (FiPlab) — <https://pasteapp.io>
- Pastebot (Tapbots) — <https://tapbots.com/pastebot/>
- Raycast — <https://www.raycast.com> / Clipboard History: <https://manual.raycast.com/clipboard-history>
- Raycast technical deep dive — <https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast>
- Alfred Clipboard / Snippets — <https://www.alfredapp.com/help/features/clipboard/>
- Ditto — <https://sabrogden.github.io/Ditto/>
- CopyQ — <https://hluk.github.io/CopyQ/>
- PasteBar — <https://www.pastebar.app>
- Snippety — <https://snippety.app>
- Espanso — <https://espanso.org> / <https://github.com/espanso/espanso>
- EspansoEdit — <https://ee.qqv.com.au/usage/features/>
- TextExpander — <https://textexpander.com>
- Warp Drive Prompts — <https://docs.warp.dev/knowledge-and-collaboration/warp-drive/prompts/>
- Cursor Rules — <https://github.com/PatrickJS/awesome-cursorrules>
- CopyMagic — <https://copymagic.app>
- VeloxClip — <https://ilikebug.github.io/VeloxClip/>
- PowerToys Advanced Paste — <https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste>
- Droppy — <https://www.productcool.com/product/droppy-3>
- RaptorBlingx/PromptVault — <https://github.com/RaptorBlingx/PromptVault>

Libraries / patterns:

- cmdk — <https://cmdk.paco.me/>
- kbar — <https://kbar.vercel.app/> / <https://github.com/timc1/kbar>
- floating-ui — <https://floating-ui.com/>
- node-pty — <https://github.com/microsoft/node-pty>
- node-pty Electron example — <https://github.com/microsoft/node-pty/tree/main/examples/electron>
- xterm.js paste discussion — <https://github.com/xtermjs/xterm.js/issues/2390>
- Bracketed paste — <https://en.wikipedia.org/wiki/Bracketed-paste>
- chokidar — <https://github.com/paulmillr/chokidar>
- Virtual list pattern — <https://www.patterns.dev/vanilla/virtual-lists/> / <https://dev.to/anishkumar/150-lines-or-less-implementing-virtual-scroll-for-web-from-scratch-4363>
- Bento grid trend — <https://senorit.de/en/blog/bento-grid-design-trend-2025>
- Raycast design system notes — <https://getdesign.md/raycast/design-md>
- Liquid Glass examples — <https://www.mockplus.com/blog/post/liquid-glass-effect-design-examples>
- FLIP technique (animation) — Paul Lewis original article; GSAP's [Flip Plugin](https://gsap.com/docs/v3/Plugins/Flip/)
- Multi-agent hand-off doc patterns — <https://medium.com/@ohadrubin/useful-pattern-iterative-handoff-prompting-407d39cf2879> / <https://kenhuangus.substack.com/p/claude-code-pattern-7-multi-agent>

---

## 11. Concrete next steps for EZvibes

If I were turning this into code today:

1. **Add a "vault" button to the session window tab strip** — next to the `+` chip. Click toggles a side-anchored vault panel, Genie-style.
2. **Wire chokidar** in `main.js` keyed by session window. Default vault path: `<sessionFolder>/.vault/`. Auto-create on first use.
3. **List view first** — single column on the right of the terminal pocket, `~340 px` wide, with the right-side preview popover *inside* the panel (no second floating window).
4. **Liquid-Glass material** + amber/pink/blue type accents.
5. **Click row → bracketed-paste-wrapped `pty.write()`**. Hover-preview after 180 ms.
6. **File watcher pulse animation** for hand-off detection — 4-cycle pulse on fresh files.
7. **`Ctrl+P` inline command palette** as the keyboard-driven complement.
8. **Frontmatter parsing** via `gray-matter`, treat the YAML body as content to paste (strip frontmatter by default, toggle in settings).
9. **Variable forms** for `{{var}}` placeholders.
10. **Grid view + bento hero hand-off cards** as a stretch second view.

The infrastructure work is small. The product feel — folder-shaped windows, Genie minimize, orange minimized state — is already differentiating. Adding the vault on top makes the *whole point* of EZvibes click: this isn't an Explorer + terminal launcher, it's a **multi-agent control surface** where each folder is a workspace, each session window is an agent, and the vault is the shared whiteboard those agents pass notes through.
