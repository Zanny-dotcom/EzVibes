# Research #4 — Command Palette & Launcher UX (2025–2026), Adapted to a Prompt-Vault Picker

**Audience:** EZvibes (Electron 33 / vanilla JS / node-pty / @xterm/xterm)
**Goal:** Build a *pioneer-level cool* in-window "Prompt Vault" — Cmd+K-style picker that lists `.md` / prompt / hand-off files, previews them, and pastes the selected content into the **currently visible terminal tab** with one click or one keystroke. Should hot-reload when other Claude sessions drop files in the folder.

This document is a long, code-heavy knowledge dump (intentionally over-large per the brief). It is organized so any single section can be lifted straight into an implementation spec.

---

## 0. Executive Summary — the single most pioneer-level idea

After reading every contemporary command palette in the wild — Raycast (now on Windows too), Linear's Cmd+K, Cursor's Cmd+K, Arc's Command Bar / Little Arc, Superhuman Command, Notion Cmd+P, Slack Quick Switcher, the new macOS Tahoe Spotlight (June 2025) with Apple Intelligence, GitHub's universal Cmd+K, Vercel/Linear/Raycast `cmdk` reference styles, Tailwind UI palettes, the PowerToys "CmdPal" (formerly Run), Espanso/Alfred snippet viewers, and the Raycast Snippets/Quicklinks/AI Commands trifecta — the **strongest single pattern for a "Prompt Vault inside a terminal" is the Raycast-style two-pane "List + ItemDetail" layout** with `Cmd+Enter` = paste-and-run, `Enter` = paste-without-run, `Cmd+Shift+C` = copy-to-clipboard-only, and **`Space` = QuickLook** that pops the markdown out into a larger floating preview without leaving the keyboard.

The single most pioneer-level twist nobody else is doing yet:

> **"Drop Zone Vault"** — the prompt list is also a **live drop target** that is *physically attached* to the active terminal tab. When another Claude session writes a `HAND-OFF-2026-05-25.md` file to the watched folder, the vault grows that item in place with a glowing animated "NEW" pulse and a **ghost-line that auto-routes from the file row to the active terminal's cursor**, visually communicating "this prompt is ready to go." Hover the new item → instant Markdown preview in the right pane. Press `Enter` → the bytes stream into the PTY exactly like a paste, character-by-character, so xterm's render path sees a real paste, not a write that bypasses prompt handling. The animation is the metaphor. Live FS watcher (chokidar) feeds the UI; xterm.js receives data via `ptyProcess.write(text)` from the renderer, which mimics a paste flawlessly.

The rest of this document explains why that synthesis is correct, every library you can pull off the shelf, and exactly what the CSS, fuzzy search, and IPC code should look like.

---

## 1. Landscape Survey — the canonical Cmd+K bars of 2025–2026

### 1.1 Raycast (macOS, now Windows beta as of Nov 2025)

* **Activation in <50 ms on Apple Silicon.** Considered the gold standard.
* Two-pane layout is the defining feature: a left **List** and a right **ItemDetail** showing markdown / metadata for the currently-highlighted item. (Raycast's `List.Item.Detail` API renders a CommonMark string with an optional metadata panel.)
* **Sectioned results**: "Suggestions", "Apps", "Calculator", "Search the Web", and custom extension sections, separated by a small uppercase grey heading.
* **Right-side Action Panel** opens with `Cmd+K` (yes, the *secondary* Cmd+K) and shows every keyboard shortcut for that result.
* **QuickLook** — press `Space` on any file result to pop a giant preview without leaving the launcher. Heavily relevant for our markdown vault.
* **Snippets** are an entire subsystem: keyword-triggered text expansion, with a Snippets Viewer hotkey to pick one and have it pasted at the cursor.
* **AI Commands**: "Pick text → open command → get result"; chains to AI Extensions when commands need to do more. This is the model we want to copy for "select prompt → paste into terminal."
* **2025 changes:** "richer UI components — new form fields, table views, chart components, and inline previews" so extensions don't have to leave Raycast to display anything. Also "Liquid Glass controls in AI Chat" — Tahoe-era visual update.
* **Visual language:** single dark surface mode, 4-step surface ladder ranging from #07080a to #121212, white CTA pill as the universal primary action. The marketing page literally is dark-mode product UI screenshots full-bleed.

References:
* https://www.raycast.com/
* https://manual.raycast.com/extensions
* https://developers.raycast.com/api-reference/user-interface
* https://developers.raycast.com/api-reference/user-interface/list (List.Item.Detail)
* https://www.raycast.com/core-features/ai (AI Commands)
* https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md (visual system)

### 1.2 Linear Cmd+K

* Cmd+K is the universal access point — issues, projects, settings, theme, *every* action.
* Result rows are 48 px tall, 14 px font, with a **3-px accent bar on the left of the selected item** (purple `#5f6ad2`). The selected background is a soft grey (`var(--gray3)`).
* Bottom-border under the input only, not a fully framed input. Caret color is the brand purple `#6e5ed2`.
* Animations: small but obvious. The modal scales from ~0.97 → 1.0 with a 100 ms fade, and `--cmdk-list-height` animates the list container as items appear/disappear.
* "Invisible details" article by Linear's andreas eldh stresses delight via micro-easing and snappy spring-driven motion.

References:
* https://medium.com/linear-app/invisible-details-2ca718b41a44
* https://keycombiner.com/collections/linear/
* https://github.com/pacocoursey/cmdk (the `linear.scss` style example mirrors Linear's real palette exactly)

### 1.3 Superhuman Command

* "Visually imposing": shows up dead-center, covers a big chunk of the app.
* Shows **5 commands** initially, with the 5th visually cut off to hint at scroll affordance.
* **Monospaced font** is the signature — "feel of directing a powerful machine."
* Each row has its own icon → easy visual scanning.
* Their proprietary fuzzy matcher is **`command-score`** (open-source on npm) — case-insensitive, threshold-based (filter below 0.0015), aliases first-class, "follow relationships" let one command always rank below another.
* **Aliases are surfaced inline**: when a search hits an alias rather than the primary title, the row shows "Mark Done (Archive)" — teaches product vocabulary while still helping.
* Mousetrap library is used for global key capture.
* **Context boosting**: irrelevant commands are hidden when "fully irrelevant" but mostly they stay available; recently-used items get a small history weight.
* "Teaching through the palette": shortcuts are displayed next to commands, building muscle memory.

References:
* https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/
* https://dribbble.com/shots/14470021-Superhuman-Command-K (Teresa Man's shots)
* https://github.com/superhuman/command-score (the fuzzy library)

### 1.4 Slack Quick Switcher

* Models matching as **graph search**: every letter is a node, weighted edges to (a) the next letter, (b) the start of each substring; cheaper paths rank higher.
* "devweb" matches "#devel-webapp"; "dh" matches "Duretti Hirpa" (initials work). Tunable fuzziness.
* Inspired by LaunchBar / Quicksilver.

References:
* https://slack.engineering/a-faster-smarter-quick-switcher/
* https://medium.com/several-people-are-coding/a-faster-smarter-quick-switcher-77cbc193cb60

### 1.5 Notion Cmd+P / "/" / AI Spacebar

* **Three palette modes**: Cmd+P for jumping to pages, `/` mid-document for inserting blocks, Spacebar for AI commands.
* Grouped by category: building blocks, databases, embeds, AI ops, recently used commands at the *bottom* of the AI palette (so it doesn't push fresh suggestions down).
* Notion's quick switcher visualizes a tree breadcrumb so you know which page you're jumping to.

References:
* https://noteforms.com/notion-glossary/command-palette
* https://github.com/ruter/notion-palette
* https://www.notion.com/help/keyboard-shortcuts

### 1.6 Arc Browser (Command Bar / Little Arc)

* `Cmd+T` opens a *single* universal bar: URLs, tabs, history, bookmarks, ⌘actions. No separate omnibox.
* **Little Arc** (`Cmd+Option+N`) is a one-tab "throwaway" mini-window that pops up from anywhere — directly relevant to the "tiny popup vault" we want.
* Arc shut down in early 2026 but the design idiom keeps living in Dia and clones.

References:
* https://blakecrosley.com/guides/design/arc
* https://resources.arc.net/hc/en-us/articles/19235387524503-Little-Arc-Quick-Lookups-Instant-Triaging
* https://www.superchargebrowser.com/library/arc-browser-dead-get-features-in-chrome/

### 1.7 Cursor Cmd+K (inline AI)

* `Cmd+K` is an **inline composer** that pops *inside the editor*, not as a modal overlay. Cursor calls this "inline edit" vs. Cmd+L (chat) vs. Composer (multi-file edits).
* Dialog card with `max-width: 520px`, search icon on the left, `ESC` badge on the right.
* Matched characters are highlighted in cyan.
* Results grouped by category.
* **Important precedent for our app:** an Electron-hosted launcher that paints "inside" a content area instead of as a true modal.

References:
* https://design.dev/ai/prompts/command-palette/
* https://medium.com/ai-dev-tips/16-cursor-ide-ai-tips-and-tricks-commands-cheat-sheet-yolo-mode-e8fbd8c4deb4
* https://www.cursorforpms.com/fundamentals/interface

### 1.8 VS Code / Sublime / Chrome DevTools / Obsidian

* Cmd+Shift+P is the legacy editor convention; Cmd+K is the SaaS convention.
* **Mode prefixes**: VS Code uses `>` for commands, `:` for go-to-line, `@` for go-to-symbol, `#` for symbols across the workspace, `?` to see all mode prefixes. We should consider `>` to filter only commands, `@` to filter only prompts, `#` to filter hand-offs.
* Chrome DevTools' Command Menu literally copied this.
* Obsidian Command Palette has favorites (star) and "recently used" with X-to-clear. UltraEdit similarly shows pinned thumbtack commands at the top.

References:
* https://developer.chrome.com/docs/devtools/command-menu (Chrome DevTools mode prefixes)
* https://help.obsidian.md/plugins/command-palette
* https://wiki.ultraedit.com/Command_palette (favorites star + thumbtack)

### 1.9 macOS Tahoe Spotlight (June 2025 / WWDC25)

* New: **Quick Keys** (e.g. `sm` = send message) — short character codes auto-generated from usage. Worth copying for "ch" = run `claude` or "co" = run `codex`.
* Clipboard manager built-in, browseable through the palette.
* **App-action support** — Spotlight can now invoke actions inside other apps without leaving the bar.
* Apple Intelligence biases results contextually (your recent activity, time of day, what's on the clipboard, etc.).
* Liquid Glass material — frosted, refractive, animated. Tahoe 26.1 added a tinted variant.

References:
* https://9to5mac.com/2025/06/10/macos-26-spotlight-gets-actions-clipboard-manager-custom-shortcuts/
* https://techcrunch.com/2025/06/09/apple-updates-spotlight-to-take-actions-on-your-mac/
* https://www.macrumors.com/2025/11/03/apple-releases-macos-tahoe-26-1/
* https://www.macrumors.com/2025/06/13/macos-tahoes-new-theming-system-explained/

### 1.10 Other notable mentions

* **GitHub Cmd+K**: navigates repos, PRs, files, jumps to global search. Symbol prefixes route between modes.
* **Vercel Cmd+K**: clean 640 px modal, dark surface `rgba(22,22,22,0.7)` with a subtle blur. Their cmdk styling is in the canonical reference.
* **PostHog Cmd+K** is similar.
* **Streak CRM Cmd+K**: their blog post details two-tab All / Actions layout.
* **PowerToys "CmdPal"** (Windows): formerly PowerToys Run; you can build extensions in C# or TS, and the docs explicitly cover rendering Markdown inside command palette extensions. Direct precedent for prompt-content rendering.
* **Files (community fork of Windows Explorer)** also ships a Command Palette.
* **Promptler / PromptVault / AINoter / PromptMD** — current crop of prompt managers. Most copy the floating-picker pattern (hotkey → fuzzy search → click copies to clipboard).

References:
* https://learn.microsoft.com/en-us/windows/powertoys/command-palette/using-markdown-content (markdown inside palette)
* https://www.streak.com/post/turbocharge-your-workflow-with-the-new-command-palette
* https://github.com/stefanjudis/awesome-command-palette
* https://files.community/docs/features/command-palette
* https://apps.apple.com/us/app/promptler-ai-prompt-manager/id6670718658
* https://chromewebstore.google.com/detail/ai-prompt-vault/mgapdeojgikfmmabgbfdcmkjkkmmnhpj
* https://promptvault.de/

---

## 2. Libraries you can drop in (with install commands)

Because EZvibes is **vanilla JS, no React, no bundler**, you should bias toward web-component libraries or hand-rolled solutions over `cmdk`/`kbar` (which are React-only). I list both, since the React patterns are still the gold-standard reference for behavior.

### 2.1 Web-component / vanilla — directly usable in your renderer

#### `ninja-keys` (Sergei Sleptsov) — strongly recommended starting point

```html
<!-- in renderer/index.html -->
<script type="module" src="https://unpkg.com/ninja-keys?module"></script>
<ninja-keys placeholder="Search prompts..." openHotkey="cmd+k,ctrl+k"></ninja-keys>
```

```javascript
const ninja = document.querySelector('ninja-keys');
ninja.data = [
  {
    id: 'plan.md',
    title: 'plan.md',
    section: 'Prompts',
    keywords: 'plan implementation feature',
    mdIcon: 'description',
    handler: async () => {
      const text = await window.ezvibes.readPromptFile('plan.md');
      window.ezvibes.writeTerminal(activeTabId, text);
    }
  }
];

ninja.addEventListener('selected', e => {
  console.log('selected', e.detail.action);
});
```

**Why it fits EZvibes:**
- It is a true `<ninja-keys>` web component — drop it in `renderer/index.html`, no React, no bundler.
- Works in vanilla JS / Vue / React / Svelte / static HTML.
- Built-in light/dark themes, hotkey registration, **nested menus** (great for "open prompt → choose paste-mode → choose target tab"), and `change` / `selected` events.
- Theming via CSS variables: `--ninja-width`, `--ninja-accent-color`, `--ninja-modal-background`, `--ninja-text-color`, `--ninja-selected-background`, `--ninja-actions-height`, `--ninja-z-index`, `--ninja-icon-size`, `--ninja-top`.
- Shadow parts for fine-grained styling: `::part(actions-list)`, `::part(ninja-action)`, `::part(ninja-selected)`, `::part(ninja-input)`, `::part(ninja-input-wrapper)`.

Reference: https://github.com/ssleptsov/ninja-keys

#### Tailwind-but-no-build Alternatives

* **Pinemix** ships an Alpine.js + Tailwind command palette you can adapt to vanilla.
* **Tailkit / Tailwind UI** ship pure-HTML/CSS command palette blocks (still need to bring your own behavior).

References:
* https://pinemix.com/components/command-palette
* https://tailkit.com/components/application-ui/components/command-palettes
* https://tailwindcss.com/plus/ui-blocks/application-ui/navigation/command-palettes

#### Stacks.js `command-palette`

A modern framework-agnostic option built by the stacksjs team. Decent if you go vanilla.

Reference: https://github.com/stacksjs/command-palette

### 2.2 React libraries (reference behavior, not drop-in)

These you would *not* import into EZvibes today, but their APIs are the de-facto specification of how a great palette is composed. Mirror them.

#### `cmdk` (Paco Coursey) — the dominant React palette

```bash
npm install cmdk
```

Composable pattern:

```jsx
import { Command } from 'cmdk';

<Command.Dialog open={open} onOpenChange={setOpen} label="Prompt Vault">
  <Command.Input value={search} onValueChange={setSearch} placeholder="Find a prompt..."/>
  <Command.List>
    <Command.Empty>No prompts found.</Command.Empty>
    <Command.Loading>Loading prompts…</Command.Loading>

    <Command.Group heading="Hand-offs">
      <Command.Item value="HAND-OFF-2026-05-25.md"
                    keywords={['handoff', 'pickup', 'today']}
                    onSelect={() => paste('HAND-OFF-2026-05-25.md')}>
        HAND-OFF-2026-05-25.md
      </Command.Item>
    </Command.Group>

    <Command.Separator/>
    <Command.Group heading="Prompts">
      <Command.Item value="plan.md" onSelect={() => paste('plan.md')}>plan.md</Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>
```

Key features to mimic in vanilla:

* `[cmdk-list]` exposes a CSS variable `--cmdk-list-height` so you can *animate* the list height as items appear/disappear with `transition: height 100ms ease;`.
* Items get `[data-selected]` and `[data-disabled]` attributes — pure CSS selection.
* `forceMount` always renders an item regardless of filter (useful for a permanent "Open prompts folder" footer action).
* `useCommandState` uses `useSyncExternalStore` for granular re-renders — you can implement the same with a tiny pub/sub.
* Loop wrapping on the result list.
* `Command.Dialog` uses Radix UI Dialog internally for proper focus trap.

Reference: https://github.com/pacocoursey/cmdk

#### `kbar` (Tim Chang)

```bash
npm install kbar
```

Best feature for prompt-vault: **nested actions** — backspace returns to the parent, perfect for hierarchical prompt folders. KBarAnimator handles show/hide and height animations. Actions:

```javascript
const actions = [
  {
    id: 'prompts',
    name: 'Open Prompts…',
    shortcut: ['p'],
    keywords: 'prompt md',
  },
  {
    id: 'plan',
    name: 'plan.md',
    parent: 'prompts',
    perform: () => paste('plan.md')
  }
];
```

Reference: https://github.com/timc1/kbar

#### `react-cmdk` (Albin Groen)

Battery-included opinionated variant of cmdk-like APIs with built-in styling.

Reference: https://github.com/albingroen/react-cmdk and https://react-cmdk.com/

#### Headless UI Combobox

If you ever rewrite in React, the official "Tailwind UI Command Palette" example uses Headless UI's `Combobox` for full ARIA correctness plus `cmdk`-like behavior.

Reference: https://blog.logrocket.com/react-command-palette-tailwind-css-headless-ui/

### 2.3 Fuzzy search libraries — the matching brain

The single most important decision after layout. Five strong candidates:

#### `fuse.js`

```bash
npm install fuse.js
```

```javascript
import Fuse from 'fuse.js';

const fuse = new Fuse(prompts, {
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'tags', weight: 0.25 },
    { name: 'body', weight: 0.15 }
  ],
  threshold: 0.35,
  ignoreLocation: true,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 1,
  shouldSort: true
});

const results = fuse.search('plan');
// [{ item: {...}, score: 0.012, matches: [...] }, ...]
```

Pros: ergonomic, mature, supports weighted multi-key search, extended search syntax (`!exact`, `'literal`, `=exact`), gives you `matches` arrays for inline highlighting. Cons: a touch slow on >10k items.

Reference: https://www.fusejs.io/ and https://www.fusejs.io/examples.html

#### `fzf-for-js` (Ajit ID)

```bash
npm install fzf
```

```javascript
import { Fzf } from 'fzf';
const fzf = new Fzf(promptList, { selector: p => p.name });
const result = fzf.find('plnm');  // returns ranked entries with positions for highlight
```

Pros: this is the actual FZF algorithm ported to JS — feels exactly like `fzf` at the shell. Tiebreakers, normalization, extended search patterns. The library was *built* for command palettes.

Reference: https://github.com/ajitid/fzf-for-js and https://fzf.netlify.app/

#### `command-score` (Superhuman)

```bash
npm install command-score
```

```javascript
import commandScore from 'command-score';
const score = commandScore('Mark Done', 'mardo');  // 0..1
```

Pros: pure ranking function, tiny, easy to write your own filter pipeline. This is what Superhuman uses.

Reference: https://github.com/superhuman/command-score

#### `fuzzysort` (farzher)

```bash
npm install fuzzysort
```

Sublime-Text-style scoring. Claims 13,000 files in <1 ms. The fastest of the bunch.

Reference: https://github.com/farzher/fuzzysort

#### `fuzz-aldrin-plus`

Atom's fuzzy filter, also Sublime-style, robust on path-style inputs (`utils/parse/markdown.md`). Great for file lists.

Reference: https://github.com/jeancroy/fuzz-aldrin-plus

#### Slack-style graph search

If you want to pioneer something, you can implement Slack's algorithm yourself: every letter in a prompt name is a node; edges go to the next letter (cheap) and to start-of-substring (expensive). Walk the query, sum edges, sort. This catches "hndffriday" → "HAND-OFF-FRIDAY.md" the way nothing else does.

Reference: https://slack.engineering/a-faster-smarter-quick-switcher/

### 2.4 Animation libraries

* **Framer Motion** — the React standard for spring-driven palette opens (`scale: 0.96 → 1`, `opacity: 0 → 1`, with `transition: { type: 'spring', stiffness: 300, damping: 30 }`).
* **Motion One** (vanilla JS equivalent) — `npm install motion`. Tiny, no React dependency.

```javascript
import { animate, spring } from 'motion';
animate(modal, { scale: [0.96, 1], opacity: [0, 1] }, { easing: spring({ stiffness: 300, damping: 30 }) });
```

Reference: https://motion.dev/

* **GSAP** — heavyweight but bulletproof.
* **CSS-only**: `@starting-style` (Baseline 2024+) lets you do entry transitions without JS.

### 2.5 File system watcher

* **chokidar** — the canonical Node FS watcher; cross-platform, sane events, debouncing.

```bash
npm install chokidar
```

```javascript
// in main.js
const chokidar = require('chokidar');
const watcher = chokidar.watch(folderPath, { ignoreInitial: false, depth: 4 });
watcher.on('add', file => mainWindow.webContents.send('vault:add', file));
watcher.on('change', file => mainWindow.webContents.send('vault:change', file));
watcher.on('unlink', file => mainWindow.webContents.send('vault:remove', file));
```

Reference: https://github.com/paulmillr/chokidar

* **Native `fs.watch`**: free, but flaky on Windows for atomic-rename editors (VS Code, Vim). Use chokidar.

---

## 3. Layout, anatomy, and visual specs

### 3.1 The five canonical layouts

1. **Centered modal overlay** — Linear / Notion / Superhuman / Vercel / GitHub. Backdrop scrim, dialog scales in. Pros: maximum focus, backdrop blur is gorgeous. Cons: hides the underlying terminal entirely — bad for our use case unless we *want* that.
2. **Inline panel** — Cursor's Cmd+K, our case. The palette renders inside the active session window, not as a true modal. Lets the user see context (the terminal) the prompt is going to.
3. **Two-pane List + Detail** — Raycast. Left list of items, right pane previews the highlighted one. Strongly recommended for EZvibes — markdown previews matter.
4. **Tab-strip top-mounted** — Streak, Files. The palette has tabs (All / Prompts / Hand-offs / Recently used).
5. **Floating compact ("Little Arc")** — small ~360 px wide pill, near cursor. Good for the "instant paste while typing" flow.

### 3.2 Recommended for EZvibes: a hybrid inline panel + two-pane

```
┌─────────────────────────────────────────────────────────────┐
│ [TAB] CLAUDE   [TAB] CODEX 2   [+]                       [⌄] │
├──────────────────────────────┬──────────────────────────────┤
│                              │ ┌──────────────────────────┐ │
│ xterm-active                 │ │ Search prompts…  ⌘K      │ │
│ user@host /repo $ █          │ ├──────────────────────────┤ │
│                              │ │ Hand-offs                │ │
│                              │ │   HAND-OFF-2026-05-25.md │ │ ← selected, accent bar
│                              │ │   HAND-OFF-2026-05-24.md │ │
│                              │ │ Prompts                  │ │
│                              │ │   plan.md                │ │
│                              │ │   refactor-guide.md      │ │
│                              │ │ CLAUDE.md files          │ │
│                              │ │   ./CLAUDE.md            │ │
│                              │ ├──────────────────────────┤ │
│                              │ │ # Hand-off 2026-05-25    │ │ ← markdown
│                              │ │ Today I refactored…      │ │   preview
│                              │ │                          │ │
│                              │ ├──────────────────────────┤ │
│                              │ │ ⏎ Paste   ⌘⏎ Paste & run │ │ ← actions
│                              │ │ ⌘C Copy   Space QuickLook│ │
│                              │ └──────────────────────────┘ │
└──────────────────────────────┴──────────────────────────────┘
```

* Vault is **inside** the session window, not a modal. Toggle with **`Ctrl+K` inside the focused tab** (Cmd+K is too easy to collide with Claude itself).
* Vault opens as a **right-side slide-in panel** (380 px wide), animating `translateX(100%) → 0%` over 180 ms with a spring.
* xterm stays alive on the left; we resize the PTY when the panel opens.
* When the panel is open, **`Esc` closes it and refocuses the terminal**.
* When the panel is closed, **`Ctrl+K` opens it and the input field is focused**, but a single `Esc` returns focus to the PTY.

### 3.3 Sectioning strategy (Recent / Prompts / Hand-offs / CLAUDE.md)

Sections in priority order, just like Raycast/Notion:

1. **Pinned** — user-starred files. Display only if non-empty.
2. **Recent** — last 5 used in this session window. Display only with `localStorage` persistence per folder.
3. **Hand-offs** — files matching glob `HAND-OFF*.md` or `handoff*.md` or `*-handoff.md`.
4. **Prompts** — files matching `prompt*.md`, `*.prompt.md`, `prompts/*.md`.
5. **CLAUDE files** — `CLAUDE.md`, `CLAUDE.local.md`, `*/CLAUDE.md`.
6. **All markdown** — everything else `.md`.
7. **Folders** — show as collapsible "Open folder…" entries when the section is empty.

Sections render with an uppercase small heading (`font-size: 11px; letter-spacing: 0.08em; opacity: 0.6;`) — Raycast's standard.

### 3.4 Mode prefixes

Mirror VS Code:

| Prefix | Filter |
|---|---|
| (none) | All sections, ranked |
| `> ` | Built-in actions only (e.g. "Refresh vault", "Open vault folder", "Pin to taskbar") |
| `@ ` | Prompts only |
| `# ` | Hand-offs only |
| `?` | Show help / shortcut overview |
| `/foldername` | Show files inside that subfolder |

Reference: https://developer.chrome.com/docs/devtools/command-menu and https://code.visualstudio.com/docs/editor/command-palette

### 3.5 Action chaining and modifier keys

Adopt Raycast's keyboard-action chord vocabulary:

| Key | Action |
|---|---|
| `Enter` | Paste the file content into the active PTY (writes through node-pty, ending with no newline) |
| `Cmd/Ctrl+Enter` | Paste **and** press Return — effectively "run the prompt" |
| `Cmd/Ctrl+Shift+Enter` | Open the file in the OS default markdown editor instead |
| `Cmd/Ctrl+C` | Copy to system clipboard only |
| `Space` | QuickLook — show a giant preview overlay |
| `Cmd/Ctrl+P` | Pin / unpin the selected file (toggles star) |
| `Cmd/Ctrl+R` | Reveal in file explorer |
| `Backspace` | Step up one folder level / clear filter |
| `Esc` | Close vault, return focus to terminal |
| `↑ ↓` or `Ctrl+K / Ctrl+J` | Move selection (vim-style hjkl support is a power-user touch) |
| `Tab` | Cycle to next section heading |

Hint these directly in the footer of the panel, exactly like Linear's `[cmdk-vercel-shortcuts]` kbd row.

### 3.6 Visual specs — pulling exact values from cmdk's reference stylesheets

These are the styles you can clone for instant "battle-tested" credibility. All from `pacocoursey/cmdk` reference styles.

#### Linear style

```css
[cmdk-root] {
  max-width: 640px; width: 100%;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: var(--cmdk-shadow);
}
[cmdk-input] {
  font-size: 18px; padding: 20px;
  border-bottom: 1px solid var(--gray6);
  caret-color: #6e5ed2;
}
[cmdk-item] {
  height: 48px; font-size: 14px;
  margin: 0 4px;
}
[cmdk-item][data-selected="true"] {
  background: var(--gray3);
  box-shadow: inset 3px 0 0 #5f6ad2;  /* the famous purple accent bar */
}
[cmdk-list] {
  height: min(300px, var(--cmdk-list-height));
  max-height: 400px;
  overflow: auto;
  overscroll-behavior: contain;
}
```

#### Vercel style

```css
[cmdk-root] {
  max-width: 640px; width: 100%; padding: 8px;
  background: rgba(22, 22, 22, 0.7);  /* dark mode */
  backdrop-filter: blur(20px);  /* implied by Vercel's actual UI */
  border-radius: 12px;
  border: 1px solid var(--gray6);
  box-shadow: var(--cmdk-shadow);
}
[cmdk-input] {
  font-size: 17px;
  padding: 8px 8px 16px 8px;
  border-bottom: 1px solid var(--gray6);
  margin-bottom: 16px;
  color: var(--gray12);
}
[cmdk-item] {
  height: 48px; font-size: 14px;
  padding: 0 16px; gap: 8px;
  border-radius: 6px;
}
[cmdk-item][data-selected="true"] {
  background: var(--grayA3);
  color: var(--gray12);
}
kbd {
  font-size: 12px; padding: 4px;
  background: var(--gray4);
  border-radius: 4px;
}
```

#### Raycast style (the dark, layered one we want)

```css
.raycast [cmdk-root] {
  max-width: 640px; width: 100%;
  border-radius: 12px;
  padding: 8px 0;
  background: var(--gray1);
  box-shadow: var(--cmdk-shadow);
}
.raycast [cmdk-input] {
  width: 100%;
  font-size: 15px; padding: 8px 16px;
  color: var(--gray12);
}
.raycast [cmdk-list] {
  height: 393px;
  overflow: auto;
  scroll-padding-block-end: 40px;
}
.raycast [cmdk-item] {
  height: 40px;
  border-radius: 8px;
  gap: 8px; padding: 0 8px;
  transition: all 150ms ease;
}
.raycast [cmdk-item][data-selected="true"] {
  background: var(--gray4);
}
.raycast [cmdk-item][data-disabled="true"] {
  color: var(--gray8); cursor: not-allowed;
}

@keyframes shine {
  from { background-position: -200px 0; }
  to   { background-position: 200px 0;  }
}
@keyframes slideIn {
  from { transform: scale(0.96); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
@keyframes slideOut {
  from { transform: scale(1);    opacity: 1; }
  to   { transform: scale(0.96); opacity: 0; }
}
```

These match Raycast pixel-for-pixel because that's literally where the styles came from.

References:
* `raycast.scss` https://github.com/pacocoursey/cmdk/blob/main/website/styles/cmdk/raycast.scss
* `linear.scss` https://github.com/pacocoursey/cmdk/blob/main/website/styles/cmdk/linear.scss
* `vercel.scss` https://github.com/pacocoursey/cmdk/blob/main/website/styles/cmdk/vercel.scss

### 3.7 Animations — scale-in, fade, blur

* **Modal scale-in**: `transform: scale(0.96) → 1; opacity: 0 → 1; transition: 100ms cubic-bezier(0.16, 1, 0.3, 1);`
* **Backdrop scrim**: `background: rgba(0,0,0,0); backdrop-filter: blur(0)` → `background: rgba(0,0,0,0.35); backdrop-filter: blur(8px)` over 180 ms. **Animating `backdrop-filter` is expensive**, so cap at 8 px and use `will-change: backdrop-filter, opacity`.
* **List item enter**: 12 ms stagger, `translateY(4px) → 0`, opacity 0 → 1. Use `@starting-style` for CSS-only.
* **Selection move**: do **not** transition `background` — instead transition a CSS `--selection-y` custom property driving an absolutely-positioned highlight `div`. Looks much smoother than per-item background fades. See Linear/Raycast.
* **Loading "shine"**: shimmer effect on placeholder rows during async load (chokidar `add` events while indexing). Keyframe `shine` above.
* **Genie-like minimize back to source** is already in EZvibes; we mirror that energy with the vault opening from the active tab chip.

### 3.8 Liquid Glass / Tahoe-era treatment (optional pioneer flair)

Apple's June 2025 Liquid Glass material on macOS Tahoe is rendered with SVG displacement maps + `backdrop-filter`. Pure web equivalent (Chromium only):

```css
.vault-panel {
  background: rgba(20, 20, 22, 0.55);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 20px 60px rgba(0, 0, 0, 0.5);
}
```

For a closer Liquid Glass simulation with refraction, use an SVG feDisplacementMap as a `backdrop-filter: url(#glass)`. Detailed walkthroughs:

* https://kube.io/blog/liquid-glass-css-svg/
* https://thathtml.blog/2025/07/clever-backdrop-filtering-for-eyecatching-glass-effects/
* https://designfast.io/liquid-glass

Use sparingly — Electron + Windows can stutter on heavy backdrop-filter. Limit blur to the panel root, not per-item.

---

## 4. Integration with xterm.js / node-pty — how the paste actually happens

The crux: **how do we put markdown text into the visible terminal tab in a way that feels like a real paste, not a hack?**

### 4.1 The IPC layout

```javascript
// preload.js — add to the existing contextBridge API
contextBridge.exposeInMainWorld('ezvibes', {
  // ... existing
  vault: {
    list:    (folderPath)            => ipcRenderer.invoke('vault:list', folderPath),
    read:    (filePath)              => ipcRenderer.invoke('vault:read', filePath),
    watch:   (folderPath)            => ipcRenderer.send  ('vault:watch', folderPath),
    onAdd:    cb                      => ipcRenderer.on   ('vault:add',    (_,p) => cb(p)),
    onChange: cb                      => ipcRenderer.on   ('vault:change', (_,p) => cb(p)),
    onRemove: cb                      => ipcRenderer.on   ('vault:remove', (_,p) => cb(p))
  }
});
```

```javascript
// main.js
const chokidar = require('chokidar');
const fs = require('fs/promises');
const path = require('path');

const vaultWatchers = new Map(); // folderPath -> chokidar watcher

ipcMain.handle('vault:list', async (_, folderPath) => {
  const entries = [];
  async function walk(dir, depth = 0) {
    if (depth > 3) return;
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(p, depth + 1); continue; }
      if (!/\.md$/i.test(e.name)) continue;
      const stat = await fs.stat(p);
      entries.push({ path: p, name: e.name, size: stat.size, mtime: stat.mtimeMs });
    }
  }
  await walk(folderPath);
  return entries;
});

ipcMain.handle('vault:read', async (_, filePath) => {
  return await fs.readFile(filePath, 'utf8');
});

ipcMain.on('vault:watch', (event, folderPath) => {
  if (vaultWatchers.has(folderPath)) return;
  const w = chokidar.watch(folderPath, {
    ignoreInitial: true,
    depth: 3,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
  });
  w.on('add',    p => /\.md$/i.test(p) && event.sender.send('vault:add', p));
  w.on('change', p => /\.md$/i.test(p) && event.sender.send('vault:change', p));
  w.on('unlink', p => /\.md$/i.test(p) && event.sender.send('vault:remove', p));
  vaultWatchers.set(folderPath, w);
});
```

### 4.2 The paste itself — feeding text into node-pty

EZvibes already has `terminal:input` (`writeTerminal`). That is exactly the channel we use:

```javascript
// renderer/app.js (vault module)
async function pasteIntoActiveTab(filePath, { runAfter = false } = {}) {
  const text = await window.ezvibes.vault.read(filePath);
  const tab = activeTabForCurrentSession();
  if (!tab) return;

  // Bracketed paste protocol (xterm understands these escape sequences as a real paste)
  const START = '\x1b[200~';
  const END   = '\x1b[201~';
  window.ezvibes.writeTerminal(tab.id, START + text + END);

  if (runAfter) window.ezvibes.writeTerminal(tab.id, '\r');
}
```

`\x1b[200~` … `\x1b[201~` is **bracketed paste mode**. When Claude / Codex / bash see this wrapper they treat the bytes as a paste (no expansion, no completion, no readline mangling). This is the difference between "feeling like a paste" and "feeling like a write that broke command-line editing."

If `node-pty` strips the escapes you can fall back to character-by-character write with a small delay (5–10 ms) so xterm renders progressively — the visual is incredibly satisfying for big prompts.

```javascript
async function streamPaste(tabId, text, perCharMs = 4) {
  for (const ch of text) {
    window.ezvibes.writeTerminal(tabId, ch);
    await new Promise(r => setTimeout(r, perCharMs));
  }
}
```

### 4.3 Clipboard-only path

```javascript
async function copyToClipboard(filePath) {
  const text = await window.ezvibes.vault.read(filePath);
  await window.ezvibes.writeClipboard(text); // already in EZvibes's preload
  showToast('Copied to clipboard');
}
```

### 4.4 QuickLook preview overlay

When the user presses Space:

```javascript
async function quickLook(filePath) {
  const text = await window.ezvibes.vault.read(filePath);
  const overlay = document.createElement('div');
  overlay.className = 'vault-quicklook';
  overlay.innerHTML = `<article class="md">${renderMarkdown(text)}</article>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  const dismiss = e => {
    if (e.key === 'Escape' || e.key === ' ' || e.type === 'click') {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener('keydown', dismiss);
      overlay.removeEventListener('click', dismiss);
    }
  };
  document.addEventListener('keydown', dismiss);
  overlay.addEventListener('click', dismiss);
}
```

`renderMarkdown` can be the tiny `marked` library or, for true pioneer flair, **streamed via Shiki / Marked-shiki for code blocks** so prompt code is highlighted in-place. Or use `markdown-it`.

```bash
npm install marked dompurify
```

```javascript
import { marked } from 'marked';
import DOMPurify from 'dompurify';
const renderMarkdown = src => DOMPurify.sanitize(marked.parse(src));
```

---

## 5. Search ranking — the brain of the picker

A naive substring search will feel cheap. The recipe for "AI-grade smart":

### 5.1 Pipeline

1. **Normalize query**: lowercase, trim, strip diacritics (NFD + strip combining marks).
2. **Mode detection**: if it starts with `>`, `@`, `#`, `?`, `/`, branch to that mode.
3. **Per-section base scores**: Pinned 1.0, Recent 0.7, Hand-offs 0.5, Prompts 0.5, CLAUDE.md 0.4, All MD 0.3.
4. **Fuzzy score per item** using `fzf-for-js` (best UX) or `command-score` (smallest dep).
5. **Multi-key matching**: name (weight 0.6), tags (0.2), first 1000 bytes of file body (0.2) — so typing a unique word from the prompt body still finds the file.
6. **Recency boost**: `boost = exp(-Δhours / 48)` capped at +0.2.
7. **Frequency boost**: `usageCount / (usageCount + 5)` capped at +0.15.
8. **Tie-break**: by mtime desc.

### 5.2 Slack-style graph search (the pioneer angle)

For "all 26 letters and a dash sometimes" filenames like `HAND-OFF-2026-05-25.md`, graph search beats Levenshtein. Pseudo-implementation:

```javascript
function graphScore(target, query) {
  let cursor = 0, score = 0;
  for (const q of query) {
    const next = target.toLowerCase().indexOf(q, cursor);
    if (next === -1) return -Infinity;
    // adjacent move: cheap. word-boundary jump: medium. mid-word jump: expensive.
    const gap = next - cursor;
    const isBoundary = next === 0 || /[\W_]/.test(target[next - 1]);
    score += isBoundary ? -0.4 : -gap;
    cursor = next + 1;
  }
  // boost for prefix matches and camelCase boundary hits
  if (target.toLowerCase().startsWith(query[0])) score += 5;
  return score;
}
```

Then sort descending. This is a tiny version of what Slack engineering describes.

### 5.3 Inline highlighting

If you use `fzf-for-js`:

```javascript
const result = fzf.find('plnm');
for (const r of result) {
  const positions = [...r.positions].sort((a,b) => a - b);
  // wrap each matched character with <mark>
}
```

This gives Cursor-style cyan highlighting:

```css
.vault-row mark {
  color: #5fd0ff;
  background: transparent;
  font-weight: 600;
}
```

---

## 6. Pioneer-level enhancements you can stack on top

A grab-bag of ideas the contemporary palette ecosystem hints at but nobody has shipped in this specific combination. Pick 2–4.

### 6.1 "Drop Zone" live indicator

When chokidar fires `add`, animate the new row appearing from the right edge with a small "NEW" badge and a brief pulse on the right pane to draw the eye. If the panel is closed, **flash the tab chip's left edge in a soft cyan** for 600 ms so the user knows a hand-off arrived.

```css
@keyframes pulseNew {
  0%   { box-shadow: 0 0 0 0 rgba(95, 208, 255, 0.7); }
  100% { box-shadow: 0 0 0 12px rgba(95, 208, 255, 0); }
}
.vault-row.is-new { animation: pulseNew 1.2s ease-out 3; }
```

### 6.2 Visual "rope" from prompt to terminal cursor

When the user hovers a vault row, draw an SVG path from the right-pane footer to the active terminal's caret approximate position. On `Enter`, animate the rope filling with characters streaming along it. Pure metaphor candy, but the kind of thing that makes a tool feel pioneer-grade.

```html
<svg class="vault-rope" width="100%" height="100%">
  <path d="" stroke="#5fd0ff" stroke-width="2" fill="none" stroke-dasharray="6 4"/>
</svg>
```

```javascript
// update path on hover
function updateRope(fromEl, toEl) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const path = `M ${a.right} ${a.top + a.height/2}
                C ${a.right + 100} ${a.top}, ${b.left - 100} ${b.top}, ${b.left} ${b.top}`;
  svgPath.setAttribute('d', path);
}
```

### 6.3 Inline diff against the file you last pasted

If the user pastes the same file twice within five minutes, the second time the right pane shows a **diff against the previous version** so they immediately see what the other Claude session changed. Powered by `diff-match-patch`.

```bash
npm install diff-match-patch
```

### 6.4 Spotlight-style "Quick Keys"

Per macOS Tahoe Spotlight. Let the user assign a 2-char code to any prompt, then `Ctrl+;` + `pl` instantly pastes `plan.md` without opening the panel. Implement as a global key chord listener.

### 6.5 Selection-driven scroll lane

Like Linear: a single absolutely-positioned highlight div (`<div class="vault-cursor">`) animates via `transform: translateY()` rather than each item swapping background colors. Smooth as butter, doesn't churn the DOM.

### 6.6 Inline AI "Generate prompt"

A footer row "✨ Use AI to draft a prompt for `<query>`" — calls the Claude API to write a `.md` prompt scaffold from the current query and saves it to the prompts folder, immediately surfacing in the list. This is exactly what Raycast AI Commands does. The vault is now self-feeding.

### 6.7 Pinned "always-visible" footer actions

Like Notion's bottom strip, mount permanent actions:

* `⌘N` New prompt…
* `⌘R` Refresh
* `⌘,` Vault settings
* `⌘O` Open vault folder

Use `cmdk`'s `forceMount` pattern in vanilla:

```javascript
const isAlwaysVisible = item => item.always === true;
// during filter, always include items where item.always === true
```

### 6.8 Multi-tab fan-out paste

Hold Shift+Enter to paste the prompt into **every** tab of the current session window. Or hold Alt+Enter to paste into every Codex tab only. Codex tabs are teal-tinted in EZvibes; mirror that color in the action footer when it's the active modifier.

### 6.9 Hand-off radar

Show a tiny radar dot near the tab chip if any `HAND-OFF*.md` file in the watched folder has been modified in the last 60 seconds. Mouseover → "3 hand-offs available." Click → opens vault filtered to hand-offs.

### 6.10 Liquid Glass + parallax

Push the Tahoe vibe: vault panel is Liquid Glass; when the user moves the mouse, the contents reveal a 4 px parallax shift behind it (the terminal "warps" under the glass slightly). Subtle, but high-end. Use `pointermove` + `CSS variables`.

---

## 7. Accessibility checklist (don't skip)

Even a developer-focused tool should be a11y-clean.

* `role="dialog"`, `aria-modal="true"` on the panel.
* Focus trap **inside** the vault while open. Restore focus to the terminal `<textarea>` (xterm's helper) when closed.
* Result list `role="listbox"`; items `role="option"` with `aria-selected="true"` on the highlighted one.
* Live region: `<div aria-live="polite" class="sr-only" id="vaultAnnounce">42 prompts</div>` updated whenever the result count changes (debounced 250 ms).
* All actions should have a visible focus ring (`outline: 2px solid #5fd0ff; outline-offset: 2px;`).
* Reduced motion: `@media (prefers-reduced-motion: reduce) { transition: none !important; }` on every animation.
* Keyboard-only happy path: open → type → arrow → Enter → close. Verified.

Reference: https://uxpatterns.dev/patterns/advanced/command-palette

---

## 8. Sample minimum-viable implementation (vanilla JS, ready to paste)

A full-fledged starter you can slot into `renderer/app.js`. Trim or extend as needed.

```html
<!-- renderer/index.html — add into each session window template -->
<aside class="vault" hidden>
  <div class="vault-search">
    <input class="vault-input" placeholder="Search prompts…  Ctrl+K"/>
    <span class="vault-kbd">Esc</span>
  </div>
  <ol class="vault-list" role="listbox"></ol>
  <article class="vault-preview" aria-live="polite"></article>
  <footer class="vault-actions">
    <kbd>↵</kbd> Paste
    <kbd>⌘↵</kbd> Paste &amp; run
    <kbd>⌘C</kbd> Copy
    <kbd>Space</kbd> QuickLook
    <kbd>Esc</kbd> Close
  </footer>
</aside>
```

```css
/* renderer/styles.css — vault panel */
.vault {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 380px;
  background: rgba(20, 20, 22, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: -20px 0 40px rgba(0, 0, 0, 0.45);
  color: #e6e6e6;
  font-family: 'Inter', system-ui, sans-serif;
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  transform: translateX(100%);
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 60;
}
.vault.open { transform: translateX(0); }

.vault-search { display: flex; align-items: center; gap: 8px; padding: 12px 16px;
                border-bottom: 1px solid rgba(255,255,255,0.06); }
.vault-input  { flex: 1; background: transparent; border: 0; outline: 0; color: inherit;
                font-size: 15px; }
.vault-kbd    { font-size: 11px; opacity: 0.5; }

.vault-list   { list-style: none; margin: 0; padding: 6px; overflow: auto; }

.vault-row {
  display: grid; grid-template-columns: 18px 1fr auto;
  align-items: center; gap: 10px;
  height: 36px; padding: 0 10px;
  border-radius: 8px; cursor: pointer;
  font-size: 13px;
  transition: background 120ms ease;
}
.vault-row:hover               { background: rgba(255,255,255,0.04); }
.vault-row[aria-selected="true"] {
  background: rgba(95, 208, 255, 0.12);
  box-shadow: inset 3px 0 0 #5fd0ff;
}
.vault-row .meta { font-size: 11px; opacity: 0.45; }

.vault-section-heading {
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  padding: 12px 12px 4px;
}

.vault-preview {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 14px 16px; overflow: auto;
  font-size: 13px; line-height: 1.55;
  max-height: 40%;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  white-space: pre-wrap;
  color: rgba(255,255,255,0.85);
}

.vault-actions {
  display: flex; gap: 14px; padding: 10px 14px;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 11px; opacity: 0.7;
}
.vault-actions kbd {
  font-family: monospace; font-size: 10px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 1px 5px;
  margin-right: 4px;
}

@keyframes pulseNew {
  0%   { box-shadow: 0 0 0 0 rgba(95,208,255,0.55), inset 3px 0 0 #5fd0ff; }
  100% { box-shadow: 0 0 0 14px rgba(95,208,255,0), inset 3px 0 0 #5fd0ff; }
}
.vault-row.is-new { animation: pulseNew 1.2s ease-out 3; }

@media (prefers-reduced-motion: reduce) {
  .vault { transition: none; }
  .vault-row { animation: none !important; }
}
```

```javascript
// renderer/app.js — vault module (excerpt, runs inside the IIFE)
function initVault(sessionWindow) {
  const root  = sessionWindow.element.querySelector('.vault');
  const input = root.querySelector('.vault-input');
  const list  = root.querySelector('.vault-list');
  const prev  = root.querySelector('.vault-preview');
  let items   = [];     // {path, name, section, mtime}
  let view    = [];     // filtered + ranked
  let cursor  = 0;
  let fzf;

  async function refresh() {
    items = await window.ezvibes.vault.list(sessionWindow.folderPath);
    items.forEach(classifySection);
    rebuildIndex();
    render();
  }

  function classifySection(it) {
    if (/HAND[-_]?OFF/i.test(it.name)) it.section = 'Hand-offs';
    else if (/CLAUDE\.md$/i.test(it.name)) it.section = 'CLAUDE files';
    else if (/prompt/i.test(it.name)) it.section = 'Prompts';
    else it.section = 'Markdown';
  }

  function rebuildIndex() {
    // dynamic import-free version: load Fzf via <script>
    fzf = new window.Fzf(items, { selector: i => i.name });
  }

  function filter(q) {
    if (!q) return [...items].sort((a, b) => b.mtime - a.mtime).slice(0, 100);
    return fzf.find(q).map(r => r.item).slice(0, 200);
  }

  function render() {
    const q = input.value.trim();
    view = filter(q);
    cursor = Math.min(cursor, view.length - 1);
    list.innerHTML = '';

    // section-group rendering
    const grouped = {};
    for (const it of view) (grouped[it.section] ||= []).push(it);
    const ORDER = ['Hand-offs', 'Prompts', 'CLAUDE files', 'Markdown'];
    for (const s of ORDER) {
      const arr = grouped[s]; if (!arr || !arr.length) continue;
      const h = document.createElement('li');
      h.className = 'vault-section-heading'; h.textContent = s;
      list.appendChild(h);
      for (const it of arr) list.appendChild(rowEl(it));
    }
    updateSelected();
  }

  function rowEl(it) {
    const li = document.createElement('li');
    li.className = 'vault-row';
    li.setAttribute('role', 'option');
    li.dataset.path = it.path;
    li.innerHTML = `
      <span class="icon">📝</span>
      <span class="name">${it.name}</span>
      <span class="meta">${formatRel(it.mtime)}</span>
    `;
    li.addEventListener('click', () => paste(it));
    li.addEventListener('mouseenter', () => preview(it));
    return li;
  }

  function updateSelected() {
    const rows = [...list.querySelectorAll('.vault-row')];
    rows.forEach((r, i) => r.setAttribute('aria-selected', i === cursor));
    if (rows[cursor]) {
      rows[cursor].scrollIntoView({ block: 'nearest' });
      const it = items.find(x => x.path === rows[cursor].dataset.path);
      if (it) preview(it);
    }
  }

  async function preview(it) {
    const text = await window.ezvibes.vault.read(it.path);
    prev.textContent = text.slice(0, 4000);
  }

  async function paste(it, { runAfter = false } = {}) {
    const text = await window.ezvibes.vault.read(it.path);
    const id = sessionWindow.activeTabId();
    const START = '\x1b[200~', END = '\x1b[201~';
    window.ezvibes.writeTerminal(id, START + text + END);
    if (runAfter) window.ezvibes.writeTerminal(id, '\r');
    bumpUsage(it.path);
    close();
  }

  function open()  { root.hidden = false; requestAnimationFrame(() => root.classList.add('open')); input.focus(); refresh(); }
  function close() { root.classList.remove('open'); setTimeout(() => { root.hidden = true; sessionWindow.focusTerminal(); }, 220); }
  function toggle(){ root.classList.contains('open') ? close() : open(); }

  // hotkeys
  sessionWindow.element.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); return; }
    if (!root.classList.contains('open')) return;
    if (e.key === 'Escape')        { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown' || (ctrl && e.key === 'j'))
                                   { e.preventDefault(); cursor = Math.min(cursor + 1, view.length - 1); updateSelected(); return; }
    if (e.key === 'ArrowUp'   || (ctrl && e.key === 'k'))
                                   { e.preventDefault(); cursor = Math.max(cursor - 1, 0); updateSelected(); return; }
    if (e.key === 'Enter')         { e.preventDefault(); paste(view[cursor], { runAfter: ctrl }); return; }
    if (e.key === ' ' && document.activeElement !== input) {
      e.preventDefault(); quickLook(view[cursor]); return;
    }
  });
  input.addEventListener('input', render);

  // FS watch → live add
  window.ezvibes.vault.watch(sessionWindow.folderPath);
  window.ezvibes.vault.onAdd(p => {
    refresh().then(() => {
      const row = list.querySelector(`[data-path="${CSS.escape(p)}"]`);
      if (row) row.classList.add('is-new');
    });
  });
  window.ezvibes.vault.onChange(refresh);
  window.ezvibes.vault.onRemove(refresh);

  return { open, close, toggle };
}
```

---

## 9. References (linkdump)

* Raycast — https://www.raycast.com/
* Raycast Manual — https://manual.raycast.com/
* Raycast API — https://developers.raycast.com/api-reference/user-interface
* Raycast `List.Item.Detail` — https://developers.raycast.com/api-reference/user-interface/list
* Raycast AI Commands — https://www.raycast.com/core-features/ai
* Raycast on Windows — https://windowsforum.com/threads/raycast-on-windows-brings-tahoe-style-spotlight-with-ai-and-extensions.388515/
* Raycast Design System — https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
* Linear shortcuts — https://keycombiner.com/collections/linear/
* Linear "Invisible details" — https://medium.com/linear-app/invisible-details-2ca718b41a44
* cmdk — https://github.com/pacocoursey/cmdk
* cmdk Linear style — https://github.com/pacocoursey/cmdk/blob/main/website/styles/cmdk/linear.scss
* cmdk Raycast style — https://github.com/pacocoursey/cmdk/blob/main/website/styles/cmdk/raycast.scss
* cmdk Vercel style — https://github.com/pacocoursey/cmdk/blob/main/website/styles/cmdk/vercel.scss
* react-cmdk — https://github.com/albingroen/react-cmdk and https://react-cmdk.com/
* kbar — https://github.com/timc1/kbar and https://kbar.vercel.app/
* ninja-keys — https://github.com/ssleptsov/ninja-keys
* command-palette resources — https://github.com/stefanjudis/awesome-command-palette
* stacksjs command-palette — https://github.com/stacksjs/command-palette
* PowerToys CmdPal — https://learn.microsoft.com/en-us/windows/powertoys/command-palette/overview
* PowerToys CmdPal markdown — https://learn.microsoft.com/en-us/windows/powertoys/command-palette/using-markdown-content
* awesome-cmdpal — https://github.com/TechWatching/awesome-cmdpal
* Superhuman command palette — https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/
* command-score — https://github.com/superhuman/command-score
* Superhuman Cmd-K Dribbble — https://dribbble.com/shots/14470021-Superhuman-Command-K
* Notion command palette — https://noteforms.com/notion-glossary/command-palette
* Notion shortcuts — https://www.notion.com/help/keyboard-shortcuts
* Slack quick switcher engineering — https://slack.engineering/a-faster-smarter-quick-switcher/
* Arc Browser command bar — https://blakecrosley.com/guides/design/arc
* Little Arc — https://resources.arc.net/hc/en-us/articles/19235387524503-Little-Arc-Quick-Lookups-Instant-Triaging
* Arc replacements 2026 — https://www.superchargebrowser.com/library/arc-browser-dead-get-features-in-chrome/
* Cursor Cmd-K — https://design.dev/ai/prompts/command-palette/
* Cursor shortcuts — https://design.dev/guides/cursor-shortcuts/
* Chrome DevTools Command Menu — https://developer.chrome.com/docs/devtools/command-menu
* macOS Tahoe Spotlight — https://9to5mac.com/2025/06/10/macos-26-spotlight-gets-actions-clipboard-manager-custom-shortcuts/
* Tahoe Spotlight + Apple Intelligence — https://techcrunch.com/2025/06/09/apple-updates-spotlight-to-take-actions-on-your-mac/
* macOS Tahoe 26.1 Liquid Glass — https://www.macrumors.com/2025/11/03/apple-releases-macos-tahoe-26-1/
* Tahoe theming — https://www.macrumors.com/2025/06/13/macos-tahoes-new-theming-system-explained/
* Maggie Appleton: Command K Bars — https://maggieappleton.com/command-bar
* Mobbin command palette glossary — https://mobbin.com/glossary/command-palette
* Destiner: Designing a Command Palette — https://destiner.io/blog/post/designing-a-command-palette/
* Sam Solomon: Designing Command Palettes — https://solomon.io/designing-command-palettes/
* UX Patterns command palette — https://uxpatterns.dev/patterns/advanced/command-palette
* Streak command palette — https://www.streak.com/post/turbocharge-your-workflow-with-the-new-command-palette
* Files command palette — https://files.community/docs/features/command-palette
* Obsidian command palette — https://help.obsidian.md/plugins/command-palette
* UltraEdit command palette — https://wiki.ultraedit.com/Command_palette
* Tailwind UI command palettes — https://tailwindcss.com/plus/ui-blocks/application-ui/navigation/command-palettes
* Tailkit command palettes — https://tailkit.com/components/application-ui/components/command-palettes
* Pinemix Alpine palette — https://pinemix.com/components/command-palette
* Headless UI + Tailwind palette — https://blog.logrocket.com/react-command-palette-tailwind-css-headless-ui/
* fuse.js — https://www.fusejs.io/
* fuse.js getting started — https://www.fusejs.io/getting-started.html
* fzf-for-js — https://github.com/ajitid/fzf-for-js
* fuzzysort — https://github.com/farzher/fuzzysort
* fuzz-aldrin-plus — https://github.com/jeancroy/fuzz-aldrin-plus
* electron-command-palette — https://github.com/Armaldio/electron-command-palette
* xterm.js — https://xtermjs.org/
* node-pty — https://www.npmjs.com/package/node-pty
* chokidar — https://github.com/paulmillr/chokidar
* electron-reloader — https://github.com/sindresorhus/electron-reloader
* Liquid Glass in CSS/SVG — https://kube.io/blog/liquid-glass-css-svg/
* Backdrop filtering glass effects — https://thathtml.blog/2025/07/clever-backdrop-filtering-for-eyecatching-glass-effects/
* DesignFast Liquid Glass — https://designfast.io/liquid-glass
* PromptVault Chrome — https://chromewebstore.google.com/detail/ai-prompt-vault/mgapdeojgikfmmabgbfdcmkjkkmmnhpj
* Promptler — https://apps.apple.com/us/app/promptler-ai-prompt-manager/id6670718658
* PromptMD — https://github.com/DexterLagan/PromptMD
* AINoter — https://ainoter.net/
* Lightning Assist — https://www.lightning-assist.com/best-text-expander
* TextExpander 2025 AI — https://textexpander.com/blog/best-hotkeys-software

---

## 10. TL;DR for the orchestrator

* Build the vault as an **inline right-side panel** inside each session window (toggle Ctrl+K), with a **two-pane List + ItemDetail** layout cloned from Raycast.
* Use **`ninja-keys`** for the picker chrome (no React, no bundler needed) or hand-roll the panel with the CSS in §3.6/§8.
* Use **`fzf-for-js`** (or fall back to `command-score`) for ranking; layer in Slack-style graph search if you want bragging rights.
* Watch the folder with **`chokidar`** in `main.js` and stream `add` / `change` / `unlink` events to the renderer over a new `vault:*` IPC.
* Paste via **bracketed paste mode** (`\x1b[200~ ... \x1b[201~`) through the existing `writeTerminal` channel.
* Modifier-key action vocabulary: `Enter` paste, `Cmd+Enter` paste+run, `Cmd+C` copy, `Space` QuickLook, `Cmd+P` pin, `Esc` close, vim-style `Ctrl+J/K` for selection.
* Sections: Pinned → Recent → Hand-offs → Prompts → CLAUDE.md → Markdown.
* Visual: Liquid-Glass dark panel (`backdrop-filter: blur(24px) saturate(180%)`), Linear-style purple accent bar `inset 3px 0 0 #5fd0ff`, Raycast 40 px rows, Vercel 12 px padding.
* Pioneer touch: an **animated rope from prompt-row to terminal cursor** that "carries" the text on paste, plus a **pulsing cyan tab-chip flash** when a hand-off `.md` is dropped in the folder by another session.
