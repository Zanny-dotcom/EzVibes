# Research #8 — Markdown Preview Rendering Libraries & UI Styles in 2026

> Scope: a maximum-context dossier of the markdown rendering stack, syntax highlighting tech, hover/peek UI patterns, frontmatter handling, and the "pioneer-level" visual languages that would suit a vault-style prompt panel inside a vanilla-JS Electron terminal app (xterm + node-pty). Every recommendation below is wired for the specific constraint that this is **vanilla JS Electron with no React, no bundler** — so install paths and module loading get explicit attention.

---

## 0. TL;DR — Which Stack to Pick for the EZvibes "Vault"

If you only have time to read one paragraph, the stack you want is:

- **Parser**: `marked@^18` (small, sync, plugin friendly). Reach for `markdown-it@^14` only if you need GFM tables/footnotes/containers + a richer plugin ecosystem.
- **Sanitizer**: `dompurify@^3.4` (still required even in 2026 — the standardised HTML Sanitizer API only shipped in Firefox 148 in Feb 2026 and is not yet Baseline).
- **Syntax highlighter**: `shiki@^4.1` — the de-facto standard, VS Code grammars + themes, **HTML with inline styles by default** (so it works inside a sandboxed Electron renderer with no extra CSS plumbing). Pair with `@shikijs/transformers` for diff/highlight/notation features and optionally `shiki-magic-move` for animated code morphs.
- **Frontmatter**: `gray-matter@^4` (YAML by default, TOML/JSON via parsers; battle-tested by VitePress, Astro, Eleventy, Slidev).
- **Math (optional)**: `katex@^0.16` via `marked-katex-extension` or `@vscode/markdown-it-katex`.
- **Diagrams (optional)**: `mermaid@^11` (renders on-demand from `\`\`\`mermaid` fences).
- **File watcher (already idiomatic in this repo)**: `chokidar@^5` (ESM-only since Nov 2025) inside the Electron main process, IPC-forwarding `add/change/unlink` to the renderer so the Vault list refreshes instantly when another Claude session drops a `hand-off.md` into the folder.
- **Typography**: Inter (UI) + JetBrains Mono (code) — the canonical 2026 dev-tool pairing, matched x-heights, calm contrast.
- **Skin**: "dark glassmorphism" panel (backdrop-filter blur 24–32 px, 6% white fill, 1 px white/8% hairline) with Catppuccin/Rosé Pine/Things-style accents. This is the look that's defining 2026 dev UI (Linear, Raycast, Vercel, Apple "Liquid Glass", MS Fluent).

The most pioneer-level single move (see §13): use **Shiki Magic Move** so that when a user clicks a prompt and the contents are *staged* in the vault preview, the code blocks inside the markdown morph token-by-token from a placeholder ghost into the highlighted real prompt — same FLIP technique Keynote uses. Nothing else on the Electron side feels remotely as forward-leaning right now.

---

## 1. Markdown Parsers: The 2026 Field

### 1.1 marked — the lean speed-pick

- Repo: <https://github.com/markedjs/marked>
- Current release: **v18.0.4 (May 19, 2026)**.
- Weekly downloads: ~15M.
- Bundle size: **~23 KB gzipped** (the lightest mainstream option).
- Architecture: single-pass token → render. No AST middleware, no plugins-via-pipeline.
- Strengths: extreme speed (parses long docs in <1 ms), trivial sync API, browser/Node/CLI all from one package, no native modules.
- Weaknesses: limited transformation surface; you can't easily walk an AST and mutate nodes the way `remark`/`unified` allow.
- Marked **does not sanitize HTML** (this is a deliberate decision — pair with DOMPurify).

Install for the EZvibes renderer (vanilla JS, no bundler):

```html
<!-- ESM (preferred) -->
<script type="module">
  import { marked } from 'https://cdn.jsdelivr.net/npm/marked@18/lib/marked.esm.js';
  import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.es.mjs';

  const html = DOMPurify.sanitize(marked.parse(mdString, { gfm: true, breaks: true }));
  document.querySelector('#vault-preview').innerHTML = html;
</script>

<!-- or UMD if you want to keep <script> tags non-module -->
<script src="https://cdn.jsdelivr.net/npm/marked@18/lib/marked.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
```

Or, since the existing project uses `npm install`:

```powershell
npm install marked@^18 dompurify@^3 marked-shiki shiki
```

then in `renderer/vault.js`:

```javascript
import { Marked } from 'marked';
import markedShiki from 'marked-shiki';
import { codeToHtml } from 'shiki';
import DOMPurify from 'dompurify';

// One instance, not the global — keeps options local & avoids extension leaks.
const marked = new Marked({ gfm: true, breaks: true })
  .use(markedShiki({
    async highlight(code, lang, props) {
      return codeToHtml(code, {
        lang: lang || 'text',
        themes: { light: 'github-light', dark: 'github-dark-dimmed' },
        defaultColor: 'dark',
      });
    },
  }));

export async function renderMarkdown(md) {
  const dirty = await marked.parse(md);
  return DOMPurify.sanitize(dirty);
}
```

The `marked.use()` extension API is the right pattern — but only call it once per module (calling it inside repeatedly-invoked functions causes recursive registration errors). If you want isolated instances per panel, use `new Marked()` rather than the global `marked.use`.

### 1.2 markdown-it — the plugin-rich workhorse

- Repo: <https://github.com/markdown-it/markdown-it>
- Current branch: 14.x, ~21.5k stars, ~20M weekly downloads (most popular by downloads).
- Bundle size: ~32 KB gzipped (heavier but includes safer defaults + far larger plugin garden).
- ~150 published plugins: TOC, anchors, footnotes, math (KaTeX), containers, definition lists, mark/insert, attrs, emoji, task lists, image figures, mermaid, etc.
- Synchronous core (which means Shiki can't be plugged in directly — see §1.4 "async caveat").

Minimal renderer use:

```javascript
import markdownit from 'markdown-it';
import mdKatex from '@vscode/markdown-it-katex';
import mdFootnote from 'markdown-it-footnote';
import mdAnchor from 'markdown-it-anchor';
import mdTaskLists from 'markdown-it-task-lists';

const md = markdownit({ html: false, linkify: true, typographer: true })
  .use(mdKatex)
  .use(mdFootnote)
  .use(mdAnchor)
  .use(mdTaskLists, { enabled: true });

document.querySelector('#out').innerHTML = DOMPurify.sanitize(md.render(text));
```

### 1.3 remark / unified — the AST powerhouse

- The full pipeline: `remark` (parse to mdast) → plugins → `remark-rehype` → `rehype` (transform hast) → `rehype-stringify` (HTML) or `rehype-react`.
- 2026 status: the de-facto choice for content build pipelines (Astro, Next, Hugo's `markdown-it` fork, Docusaurus). Plug-in oriented; slower than marked.
- For a *runtime* Electron sidebar this is overkill — you'd be paying ~150 KB+ for transformations you don't need. Mention it for completeness; do **not** ship it in the renderer for the vault.

### 1.4 react-markdown / MDX

- `react-markdown` wraps remark + rehype + React renderers, supports `MarkdownAsync`/`MarkdownHooks` variants for async plugins (Shiki).
- MDX inlines JSX/Vue/Svelte components inside markdown, which is gorgeous, but **requires a bundler**. Skip for EZvibes unless you bring in Vite later.

### 1.5 The async caveat (Shiki + markdown-it)

Shiki is async at the language/theme load layer. Markdown-it's `highlight` option is **sync only**, so the canonical workarounds are:

- **`@shikijs/markdown-it`** — the official wrapper that pre-loads themes/langs at construct time so the actual render call ends up sync.
- **`markdown-it-async`** by Anthony Fu — gives you an `async render()`.

Marked, in contrast, has natural async parse support and integrates with Shiki via the `marked-shiki` plugin. **This is the single biggest reason to default to `marked` for the EZvibes renderer.**

### 1.6 Lesser-known but interesting in 2026

- **Cherry Markdown** (Tencent) — a full WYSIWYG-ish editor with cool inline preview; very pretty but ~ 400 KB; ships with its own preview CSS.
- **Vditor** — Typora-like instant render mode + split preview; TS-first, framework-agnostic, ships its own theme set.
- **TOAST UI Editor** — split WYSIWYG / Markdown, Chart + UML extensible, has vanilla JS wrappers.
- **markstream-vue / hepingmogul/vue-markdown-renderer** — streaming markdown for chat-style UIs (handles Monaco-incremental, Mermaid progressive, KaTeX speed). Worth studying for *streaming* preview if you later want live render as a hand-off is being written.

---

## 2. Syntax Highlighting in 2026

### 2.1 Shiki (the obvious 2026 choice)

- Repo: <https://github.com/shikijs/shiki>
- Current: **v4.1.0**.
- Engine: VS Code's own TextMate grammar engine (precise, slow but cached).
- Themes: ~50 built-in (`github-dark`, `github-dark-dimmed`, `github-light`, `vitesse-dark`, `vitesse-light`, `dracula`, `dracula-soft`, `catppuccin-mocha`/`latte`/`frappe`/`macchiato`, `rose-pine`/`rose-pine-moon`/`rose-pine-dawn`, `tokyo-night`, `nord`, `min-dark`, `min-light`, `synthwave-84`, `monokai`, `solarized-dark`/`light`, `one-dark-pro`, `andromeeda`, `aurora-x`, `ayu-dark`, etc.).
- 100+ languages.
- Output: **HTML with inline `style="color:..."` tokens**, so the highlighting is portable — no CSS class plumbing required, perfect for an Electron WebView.

ESM via CDN (no bundler required):

```html
<script type="module">
  import { codeToHtml } from 'https://esm.sh/shiki@4.1.0';
  const html = await codeToHtml('console.log("vault")', {
    lang: 'js',
    theme: 'rose-pine'
  });
  document.getElementById('out').innerHTML = html;
</script>
```

Singleton instance (sync after the warmup) — this is the right pattern inside the EZvibes renderer because you'll call it dozens of times for one prompt list:

```javascript
import { createHighlighter } from 'shiki';

const highlighterPromise = createHighlighter({
  themes: ['github-dark-dimmed', 'rose-pine', 'catppuccin-mocha'],
  langs: ['javascript', 'typescript', 'powershell', 'bash', 'json', 'yaml', 'markdown', 'python', 'go'],
});

export async function highlight(code, lang = 'text') {
  const h = await highlighterPromise;
  return h.codeToHtml(code, { lang: h.getLoadedLanguages().includes(lang) ? lang : 'text', theme: 'rose-pine' });
}

// On-demand load if the file uses a rarely-seen language:
async function ensureLang(lang) {
  const h = await highlighterPromise;
  if (!h.getLoadedLanguages().includes(lang)) await h.loadLanguage(lang);
}
```

**Sizing tip**: a full `shiki` import is ~5 MB on disk because of the WASM grammar engine + JSON theme/lang files; ESM CDN delivery only ships what `codeToHtml` actually requests (~200 KB for a few langs + 1 theme). For a packaged Electron build you'll bundle the subset.

### 2.2 Shiki transformers

`@shikijs/transformers` extends rendered code with rich annotations the same way VitePress/Astro use them:

```javascript
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationFocus,
  transformerNotationErrorLevel,
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerCompactLineOptions,
  transformerNotationWordHighlight,
} from '@shikijs/transformers';
```

Usage inside `marked-shiki`:

```javascript
async highlight(code, lang) {
  return codeToHtml(code, {
    lang,
    themes: { dark: 'github-dark-dimmed', light: 'github-light' },
    transformers: [
      transformerNotationDiff(),         // `// [!code ++]` / `[!code --]`
      transformerNotationHighlight(),    // `// [!code highlight]`
      transformerNotationFocus(),        // `// [!code focus]`
      transformerNotationErrorLevel(),   // `// [!code error]` / `[!code warning]`
    ],
  });
}
```

Two new line-comment markers in 2026 worth noting:

- `// [!code word:foo]` highlights every occurrence of the word `foo` on that line.
- `// [!code focus:3]` focuses the next 3 lines, dimming the rest.

### 2.3 Twoslash

`@shikijs/twoslash` runs TS files through the TypeScript compiler so the rendered HTML carries type info, inline error squiggles, and on-hover popovers that show resolved types. Trigger inside fences with `\`\`\`ts twoslash`. Heavyweight (it bundles `typescript`) but absolutely the most-impressive pioneer move for any technical prompt that has TS code. Pair with `floating-ui` for the hover popovers.

### 2.4 Shiki Magic Move (the secret sauce)

- Repo: <https://github.com/shikijs/shiki-magic-move>
- Latest: 1.3.0 (March 2026).
- What: animates *between* two rendered code states using text diff + the FLIP animation technique (the same morph effect Keynote calls "Magic Move").
- Why it matters here: when a user clicks a prompt, the EZvibes "vault" can do a token-level morph from a ghost placeholder into the loaded prompt content, and when they switch between prompts the changed lines reflow with a smooth animated transition rather than the dumb "innerHTML = newHTML" flash. **No other library currently delivers this aesthetic.**

Minimal vanilla wiring:

```javascript
import { createMagicMoveMachine } from 'shiki-magic-move/core';
import { createHighlighter } from 'shiki';

const highlighter = await createHighlighter({ themes: ['rose-pine'], langs: ['markdown'] });
const machine = createMagicMoveMachine(text => highlighter.codeToTokens(text, { lang: 'markdown', theme: 'rose-pine' }));

function showPrompt(md) {
  const { current, previous } = machine.commit(md);
  renderMagicMove(target, previous, current); // hand-rolled FLIP renderer or import 'shiki-magic-move/web'
}
```

Slidev uses this as a first-class block (` ```md magic-move`); we can copy the idea so a "prompt diff" pops between two hand-off files.

### 2.5 starry-night (GitHub's own engine, OSS port)

- Repo: <https://github.com/wooorm/starry-night>
- Reimplements GitHub's closed-source PrettyLights; ships 600+ TextMate grammars.
- Outputs **HAST with class names**, not inline styles — so it pairs with a CSS theme file (`github-dark.css`, `github-light.css`) which makes dark-mode flipping trivial.
- Bundle (with WASM): ~185 KB gzipped.
- Use this if you'd rather control theming purely via CSS variables and don't care about exact VS Code parity.

### 2.6 The legacy options

- **highlight.js** — 30 KB core + per-language modules, regex-based (not TextMate), ~190 langs, very mature, sync. Renderers do `<span class="hljs-keyword">` etc. Output is *less faithful* than Shiki for niche languages but very predictable.
- **PrismJS** — 2 KB core + per-language modules, also regex-based, basically the same niche as highlight.js. Famous for its plugins (`line-numbers`, `command-line`, `previewers`, `match-braces`, `treeview`). Use if you want minimum download size and you don't care about VS Code parity.
- **Refractor / Prism-React-Renderer** — Prism re-implemented over hast/JSX, niche outside React.

### 2.7 Expressive Code (Shiki + frames + features)

- Repo: <https://github.com/expressive-code/expressive-code>
- Wraps Shiki with: editor & terminal **window-frame chrome**, text markers, diff highlighting, word-wrap with `preserveIndent`, line numbers, copy button — all bundled.
- 2026 added: full `wrap`/`preserveIndent` props; experimental Shiki transformer support (limited to non-text-mutating transformers).
- Big appeal for the vault: each code block can be rendered as a *mini macOS editor window* with title bar, traffic lights and a built-in copy button — that's the exact "wow" detail in the vault picture the user drew.

---

## 3. Frontmatter & Metadata

### 3.1 gray-matter

- Repo: <https://github.com/jonschlinkert/gray-matter>
- Used by VitePress, Astro, Eleventy, Slidev, TinaCMS, Hashicorp, Ant Design, Shopify Polaris.
- Parses YAML, JSON, TOML, CoffeeScript front-matter blocks delimited by `---` (or custom delimiters).
- Returns `{ data, content, excerpt, matter, language }`.

```javascript
import matter from 'gray-matter';

const file = matter(rawMarkdownString);
console.log(file.data);      // { title: 'Refactor module X', tags: ['claude', 'hand-off'] }
console.log(file.content);   // markdown body, frontmatter stripped
```

For EZvibes-specific use: every prompt/hand-off in the vault gets its YAML frontmatter parsed once on file change, and the parsed `data` populates the chip in the vault list — author, tag chips, last-modified, model target, parent session, etc. Frontmatter convention I'd lock down:

```yaml
---
title: "Refactor terminal pocket sizing"
agent: claude            # claude | codex | any
kind: handoff            # prompt | handoff | note | claude-md
tags: [terminal, fit, refactor]
created: 2026-05-25T14:33:20Z
parent_session: 4f8a23
status: ready            # draft | ready | done
---
```

### 3.2 Alternatives

- **front-matter** — older/smaller, YAML-only, no TOML/JSON.
- **remark-frontmatter** — only useful if you're already on unified.
- **yaml-front-matter** — considered legacy in 2026.

Use gray-matter. Done.

---

## 4. Math (KaTeX)

- KaTeX is still the right call in 2026 — it renders math to plain HTML+CSS with **no MathJax-style relayout flicker**, ~ 40 KB JS + 100 KB fonts.
- For marked: `marked-katex-extension`.
- For markdown-it: `@vscode/markdown-it-katex` (the same one VS Code's preview uses) or `markdown-it-texmath`.

Minimal:

```javascript
import katex from 'katex';
import markedKatex from 'marked-katex-extension';

marked.use(markedKatex({ throwOnError: false, output: 'html' }));
```

Ship the CSS once in the renderer shell:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
```

The fonts will be loaded from the same CDN at first render; if you go offline-first, copy `node_modules/katex/dist/fonts` into the renderer assets.

---

## 5. Diagrams: Mermaid, D2, Excalidraw

### 5.1 Mermaid

- Repo: <https://github.com/mermaid-js/mermaid>
- 2026: GitHub, GitLab, Notion, VS Code, Obsidian all render Mermaid in `\`\`\`mermaid` blocks natively.
- Supports: flowchart, sequence, class, state, ER, gantt, mindmap, journey, pie, quadrant, requirement, C4, git, sankey, timeline, packet, kanban, architecture, treemap.
- Render strategy that works in vanilla Electron:

```javascript
import mermaid from 'mermaid';
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });

async function inflateMermaid(container) {
  const blocks = container.querySelectorAll('pre > code.language-mermaid');
  for (const code of blocks) {
    const id = 'm-' + Math.random().toString(36).slice(2);
    const { svg } = await mermaid.render(id, code.textContent);
    code.parentElement.outerHTML = `<div class="mermaid-diagram">${svg}</div>`;
  }
}
```

Hook it on the `marked` walk: every code block whose `info` is `mermaid` becomes a placeholder, then `inflateMermaid()` runs after `innerHTML` swap.

### 5.2 D2

- Modern declarative diagram language, prettier defaults than Mermaid for system diagrams. Browser library `d2-wasm`. Useful for rendering architecture handoffs.

### 5.3 Excalidraw

- Library (`@excalidraw/excalidraw`) is React-only — not usable directly in vanilla EZvibes. But:
- Excalidraw exports a `.excalidraw.png` whose JSON is embedded inside the PNG. The vault could simply *display* the PNG; later, double-click opens it in the Excalidraw web app or an Excalidraw-in-iframe view.
- Obsidian's Excalidraw plugin uses `.excalidraw.md` (markdown file with embedded JSON). If we want the same affordance, parse those files: render the Markdown text below, and render the PNG preview inline.

---

## 6. Sanitization & Security

`marked.parse` and `markdownit.render` both return raw HTML. With `claude --dangerously-skip-permissions` we already accept that the underlying terminal is unsandboxed, **but the renderer should not be**, because a prompt file you didn't author could contain `<script>`. Wire DOMPurify on every render:

```javascript
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(html, {
  USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  ADD_TAGS: ['mermaid-diagram'],
});
```

The standardised `Element.setHTML(html, { sanitizer: 'default' })` API exists in 2026 — Firefox 148 (Feb 2026) was first to ship; Chrome/Edge had it earlier. It is **not yet Baseline**, so DOMPurify (currently v3.4.5) remains the cross-browser fallback.

---

## 7. Beautiful Markdown Preview Styles — A Reference Tour

The user asked for "pioneer-level" cool. The best designs for documents/notes in 2026 cluster into a few clear families. The vault should pick *one* family and commit to it.

### 7.1 GitHub Primer / "GitHub Markdown CSS"

- Repo: <https://github.com/sindresorhus/github-markdown-css>
- Renders identically to GitHub.com (light + dark via `@media (prefers-color-scheme)`).
- Drop-in:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown.css">
<article class="markdown-body" style="max-width:980px; padding:24px;">
  <!-- innerHTML lands here -->
</article>
```

- The "you know what this is at a glance" choice. Best if the EZvibes vault should feel like opening a GitHub PR description.
- Pair with Primer typography variables: `--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif; --font-mono: ui-monospace, "Cascadia Code", "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;`

### 7.2 Obsidian + Minimal Theme (Kepano)

- Repo: <https://github.com/kepano/obsidian-minimal>
- The Obsidian Minimal theme by kepano (Steph Ango) is the gold standard for distraction-free markdown in 2026 — ~500 K downloads.
- Built-in color schemes: Catppuccin, Dracula, Everforest, Gruvbox, macOS, Nord, Solarized, Rosé Pine, Things, Atom, Notion, Sky.
- Line width controls, line-spacing, headings hierarchy emphasised by SIZE rather than colour.
- Things-3-inspired variant: super calm pastels, minimal accent saturation, generous left margin for tags.
- A pioneer move here: ship the Vault's preview with **5 swap-able color schemes baked in**, each available via Cmd+P → "Vault theme: Catppuccin Mocha".

CSS variable pattern (Catppuccin Mocha extract):

```css
.vault-preview[data-theme='catppuccin-mocha'] {
  --bg: #1e1e2e;
  --surface: #313244;
  --text: #cdd6f4;
  --muted: #a6adc8;
  --accent: #cba6f7;     /* mauve */
  --accent-2: #89b4fa;   /* blue */
  --green: #a6e3a1;
  --yellow: #f9e2af;
  --red: #f38ba8;
  --code-bg: #181825;
}
```

### 7.3 Bear / Markdown Edit / Ulysses

- Bear is the canonical Apple-only markdown app: extreme typography focus, customizable themes, generous whitespace, panels separated by a single hairline.
- Bear 2.7 (April 2026) brought the **TagCons** redesign — 260 little tag icons that paint a glyph in front of each tag name. The vault can do an analogous trick: parse `tags:` in frontmatter, look up a glyph (lucide/heroicons SVG) and prepend it to the tag chip.

### 7.4 Typora themes

- Typora ships 12 official themes (Github, Newsprint, Lapis, Pixyll, Vue, Whitey, Night, Quartz, Han, Lit, Liberty, etc.) and the Themeable framework (<https://github.com/jhildenbiddle/typora-themeable>) lets you swap colors with CSS custom properties at runtime. Worth scraping for typography measurements.
- A real value of Typora's design: **drop-cap-free**, **no horizontal rule between paragraphs**, **deep paragraph spacing (~1.4em)**, **section anchors visible on hover only**. This calmness is exactly what a vault scroll wants.

### 7.5 Linear / Vercel / Raycast — the keyboard-first dark family

- Linear: dark-first, **LCH perceptual color space**, three theme variables (base, accent, contrast), Inter / Inter Display, 4 px spacing unit, **~200 ms ease-out**, hairline 1 px panel separators, optimistic updates.
- Raycast: rounded keycaps, command rows, hairline 1 px borders, 6–10 px card radii, accent-color glyphs, dark canvas with a "faint surface ladder" (a 4-level z-shadow palette).
- Vercel: monochrome geometry, almost no chrome, accent shadows.
- This family is what most "pioneer 2026 dev UI" articles point at when they say "keyboard-first command palette".

### 7.6 Dark Glassmorphism / Liquid Glass

- 2026's defining trend, validated by Apple's "Liquid Glass" OS direction and MS Fluent.
- Recipe (works as the Vault panel's chrome):

```css
.vault {
  background: color-mix(in oklch, rgba(255,255,255,0.06) 70%, rgb(20 20 28 / 0.75) 30%);
  backdrop-filter: blur(28px) saturate(140%);
  -webkit-backdrop-filter: blur(28px) saturate(140%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 30px 60px -20px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04);
  border-radius: 14px;
}
```

- For Electron, set `transparent: true` and `vibrancy: 'under-window'` (macOS) or `backgroundMaterial: 'acrylic' | 'mica'` (Windows 11) when creating the BrowserWindow. (EZvibes is Windows-only — `mica` is the right pick, it inherits the wallpaper tint with no extra work.)

### 7.7 Tufte CSS

- Repo: <https://github.com/edwardtufte/tufte-css>
- Brings sidenotes, marginalia, smallcaps, ET Book font — looks like the *Visual Display of Quantitative Information*. Probably wrong tone for an AI-prompt vault, but kept on the table for a "premium documentation" mode toggle.

### 7.8 Suggested EZvibes defaults

A combination that would feel pioneer-level inside the existing orange-folder UX:

- **Chrome**: dark glassmorphism with subtle Mica vibrancy.
- **Typography**: Inter for body, JetBrains Mono for code, 14.5 px body, 1.65 line-height.
- **Theme switcher**: Catppuccin Mocha (default) / Rosé Pine Moon / Tokyo Night / GitHub Dark Dimmed / Things Light.
- **Code blocks**: rendered with Shiki + Expressive Code window frame; copy button top-right; languages indicated by a small Lucide icon in the title bar.
- **Frontmatter banner**: a slim bar at the top of every preview showing tags as colored chips, with a single "Paste into terminal" CTA on the right.

---

## 8. Hover & Peek Patterns

### 8.1 Hover-preview cards (Obsidian Hover Editor inspired)

- Reference: <https://github.com/nothingislost/obsidian-hover-editor>
- Pattern: hover a vault link → a small modal showing rendered markdown, pinnable, resizable.
- 2026 vanilla recipe uses **the native Popover API + `interestfor` + CSS anchor positioning** (Chrome/Edge 135+):

```html
<a class="prompt-chip" interestfor="hover-card-3" href="#">refactor-fit.md</a>
<div id="hover-card-3" popover="hint" anchor="prompt-chip-3" class="hover-card">
  <!-- innerHTML = rendered markdown excerpt -->
</div>
```

```css
.hover-card {
  position: absolute;
  position-anchor: --prompt-chip-3;
  top: anchor(bottom);
  left: anchor(start);
  width: 360px;
  opacity: 0;
  transition: opacity 0.16s, transform 0.16s, display 0.16s allow-discrete;
  transform: translateY(-4px);
}
.hover-card:popover-open {
  opacity: 1;
  transform: translateY(0);
}
@starting-style { .hover-card:popover-open { opacity: 0; transform: translateY(-4px); } }
```

- Chromium is on 135+ in 2026. Electron ships its own Chromium, so this just works.
- Fallback: same animation via JS event handlers + an absolutely positioned `<div>` if running an older Electron.

### 8.2 Inline split preview

- Split the Vault into two panes: file list + live preview. When a chip is focused (mouse hover or arrow keys), the right pane renders that file's contents. Keyboard nav with `j`/`k` or arrows feels great. Pressing `Enter` *commits* — the markdown body is pasted into the active xterm tab.

### 8.3 Peek modal

- Hold a key (e.g. Shift) while hovering → a centered, larger floating window showing the whole file (not just an excerpt). Same animation, just bigger.
- Equivalent to VS Code's *Peek Definition*: the file is *previewed* but never permanently opened. If the user clicks "Open in editor" inside the peek, it opens in a real tab.

### 8.4 Quick-look gesture

- Trackpad two-finger force-touch / `Space` press while hovering → trigger a "Quick Look" like macOS Finder. Many Raycast extensions use this pattern. The Vault could mirror it: Space-bar over a chip = peek modal.

---

## 9. The Vault Panel — Pioneer-Level Interaction Patterns

Combining the references above, here's a menu of interaction ideas worth stealing, ranked by "wow per implementation effort":

### 9.1 Click-to-paste with optimistic flash

When a chip is clicked:

1. The chip pulses with a 200 ms accent-color flash (`color-mix(in oklch, var(--accent) 30%, transparent)`).
2. A small ghost echo of the chip *flies* from the vault into the terminal tab using a View Transition (`document.startViewTransition`), landing on the cursor.
3. Simultaneously, the markdown content is written into the PTY via `terminal:input`.

Code skeleton:

```javascript
chip.addEventListener('click', async () => {
  if (!document.startViewTransition) {
    await pasteIntoActiveTab(chip.dataset.path);
    return;
  }
  await document.startViewTransition(async () => {
    chip.classList.add('flying');                 // CSS handles the FLIP
    await pasteIntoActiveTab(chip.dataset.path);
    chip.classList.remove('flying');
  }).finished;
});
```

Pair with `view-transition-name: chip-${id}` on the chip and a transparent landing target inside the terminal pocket. The View Transition API auto-FLIPs.

### 9.2 Cmd+P quick palette

- Cmd+P inside a session window opens a Raycast-style modal palette listing every `.md` in the vault folder (recursive), with fuzzy search via a tiny `fzf`-style scorer (`fzy.js` or `fuse.js@^7`).
- Enter pastes into the active terminal tab. Cmd+Enter pastes *and* hits Return. Shift+Enter previews. Cmd+Shift+P opens the file in an Obsidian-style editor pane.

### 9.3 Side-by-side mini-IDE

- A toggle in the chrome turns the Vault into a 50/50 split: list on the left, markdown preview on the right, code blocks rendered as Expressive Code window frames.

### 9.4 Persistent "pinned prompts"

- Drag a chip into a thin top strip = pinned. Pinned prompts get a one-key shortcut (1–9) that pastes them instantly into the active tab. Cmd+1 / Cmd+2 / Cmd+3.

### 9.5 Live hand-off awareness

- When another Claude session in another tab/window writes `hand-off.md` into the watched folder, that chip *materialises* in the vault with a small pulsing dot indicator. View Transitions can animate the list reflow (`view-transition-name: chip-${path}`). The chip carries an "📥 from <agent-name>, 12 s ago" subtitle pulled from the frontmatter's `parent_session`.

### 9.6 Shiki Magic Move preview transitions

- When you arrow-key through chips, the preview pane morphs between markdown contents using Shiki Magic Move's FLIP diff. Code blocks reflow tokens, prose paragraphs cross-fade. Pioneer-tier.

### 9.7 Drag-to-terminal

- Drag a chip out of the vault and drop it on a terminal tab's chrome → the file's content pastes into that tab specifically. The drag image is a translucent preview card.

### 9.8 Scroll-driven section reveal

- Inside the preview pane, use CSS scroll-driven animations to fade in section headings as they enter the viewport (`animation-timeline: view()`). No JS scroll listeners.

```css
.vault-preview h2 {
  animation: section-reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 30%;
}
@keyframes section-reveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### 9.9 Twoslash-on-hover popovers for code

- Inside a previewed prompt, code blocks rendered via Twoslash mean hovering an identifier shows the resolved type. Useful for prompts that include code snippets the LLM should reference.

### 9.10 Glow on freshly-written files

- When chokidar reports an `add` for a `hand-off-*.md` inside the past 30 s, that chip glows with a CSS `box-shadow: 0 0 0 1px var(--accent), 0 0 20px 0 color-mix(in oklch, var(--accent) 40%, transparent)` that decays linearly over 30 s. Cheap, gorgeous.

---

## 10. File Watching for Hand-offs

The big requirement: when *another* Claude session (in another tab or another running EZvibes instance) drops a `hand-off.md`, the vault should pop it in **instantly**.

`chokidar@^5` is the right tool — ESM-only since Nov 2025, requires Node 20+, used in ~30M repos.

### 10.1 Main process

```javascript
// main.js — extend existing IPC layer
import chokidar from 'chokidar';

const watchers = new Map(); // folderPath -> watcher

function ensureWatcher(window, folderPath) {
  if (watchers.has(folderPath)) return;
  const w = chokidar.watch(folderPath, {
    ignoreInitial: false,
    depth: 4,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 },
    ignored: (p, stats) => stats?.isFile() && !p.toLowerCase().endsWith('.md'),
  });
  w.on('all', (event, p) => {
    window.webContents.send('vault:event', { folderPath, event, path: p });
  });
  watchers.set(folderPath, w);
}

ipcMain.handle('vault:watch', (e, folderPath) => ensureWatcher(BrowserWindow.fromWebContents(e.sender), folderPath));
ipcMain.handle('vault:unwatch', async (e, folderPath) => {
  await watchers.get(folderPath)?.close();
  watchers.delete(folderPath);
});
```

### 10.2 Renderer

```javascript
window.ezvibes.onVaultEvent(({ folderPath, event, path }) => {
  const v = vaults.get(folderPath);
  if (!v) return;
  if (event === 'add' || event === 'change') v.upsertEntry(path);
  if (event === 'unlink') v.removeEntry(path);
});
```

### 10.3 Cross-session hand-offs

Convention: a session that wants to hand off writes `hand-off-YYYYMMDD-HHmmss-<sessionId>.md` into the folder. The vault sorts hand-offs by `created` frontmatter (preferring it over file mtime). Optionally, an EZvibes terminal command (`/handoff "title"`) calls into the renderer via OSC sequences to materialize a frontmatter-prefilled `hand-off-*.md` and pop it in the vault.

---

## 11. The "Pasting into the Active Terminal" Pipeline

This is the load-bearing interaction. There are three sane ways to get markdown content into the active xterm/node-pty terminal:

1. **Direct PTY write** — `pty.write(text)` from main, triggered by `terminal:input` from the renderer. Already supported by the existing IPC. Use the literal markdown content (or a stripped-of-frontmatter content) and write it. *This is what the user wants.*
2. **Bracketed paste mode** — if the running process supports it (modern bash, zsh, Claude CLI, etc.), wrap the write with `\x1b[200~...\x1b[201~`. Prevents auto-indent/auto-completion from mangling the paste, and the inferior process gets a clean "this was pasted" hint.
3. **xterm.js `paste()` call** — only useful if you want the user to see the text *typed* through xterm rather than written to the underlying PTY.

The right combination for prompts:

```javascript
// renderer/app.js — pseudocode wired into the chip click
async function pasteIntoActiveTab(filePath) {
  const md = await window.ezvibes.readFile(filePath);
  const { content } = matter(md); // strip frontmatter
  const sessionId = state.activeWindow.activeTabId;
  const wrapped = `\x1b[200~${content}\x1b[201~`;
  await window.ezvibes.writeTerminal(sessionId, wrapped);
}
```

`fs.readFile` lives in main; expose it through preload as `readFile(absPath)`.

A subtler pioneer move: **expand `${selection}` / `${cwd}` / `${date}` / `${parent_session}` placeholders** before sending, so prompts can be templates. Use a tiny mustache or just a regex replace.

---

## 12. Visual Inspiration Boards Worth Lifting Wholesale

For the user to feel "pioneer-level", these are the eight aesthetics most worth borrowing 80% of:

1. **Raycast Store extension cards** — small, hairline-bordered, glyph + title + dim subtitle + accent-color tag chip. Great template for the Vault chip.
2. **Linear's Cmd+K modal** — dimmed backdrop, 480-px-wide centered card, 56-px-tall input, results as compact rows with right-aligned shortcut hint. Use as the prompt palette.
3. **Vercel Geist UI** — extreme restraint, pure black/white + 1 accent, hairline 1 px borders. Use as the chrome of a "Focus Mode" version of the vault.
4. **Apple Liquid Glass** (visionOS) — frosted panels with a subtle inner highlight on the top edge. Use `linear-gradient(180deg, rgba(255,255,255,0.06), transparent 30%)` overlaid on the glass.
5. **Obsidian + Things-style theme** — pure whitespace + faint accent dots. Use as the light-mode option.
6. **GitHub Primer Dark Dimmed** — calm, low-saturation greys. Use as the universal "safe" theme.
7. **Catppuccin Mocha** — pastel-on-mauve, deeply forgiving for long reading. Use as the default body theme.
8. **Rosé Pine Moon** — rose/foam/iris accents on muted slate; reads as "after-midnight cozy". Use as a fan-favorite theme.

---

## 13. The Pioneer Picks (Concentrated)

The four pieces that, *combined*, would make the EZvibes Vault feel genuinely 2026 in a way few other Electron apps in the wild currently do:

1. **Shiki + Shiki Magic Move + Expressive Code window frames**. Code blocks inside every previewed prompt morph between states, framed in macOS chrome with traffic lights and a copy button. (Nobody is doing this in a terminal launcher.)
2. **Native Popover API + `interestfor` + CSS anchor positioning** for hover previews. Zero JS positioning, smooth open/close via `@starting-style` + `transition-behavior: allow-discrete`.
3. **View Transitions API for chip-to-terminal flight animation** when you paste. The chip morphs into a "shooting star" that lands on the terminal cursor — a one-line `document.startViewTransition(...)` + a `view-transition-name` per chip.
4. **CSS scroll-driven animations** for preview reveal, list reflow on new hand-offs, and the entire scroll feel of the vault. No JS listeners.

These four are all native-browser-level tech now; they cost almost nothing to ship and they look like *the future*.

---

## 14. Concrete Stack & Bill of Materials

```text
runtime deps (renderer-side, ESM via importmap or via Vite-free <script type=module>):
  marked@^18                             # parser
  marked-shiki                            # shiki bridge
  shiki@^4                                # syntax highlighter
  @shikijs/transformers                   # diff/highlight/focus annotations
  shiki-magic-move@^1.3                   # token-level FLIP morphs
  dompurify@^3.4                          # sanitizer
  gray-matter@^4                          # frontmatter
  katex@^0.16                             # math (optional)
  marked-katex-extension                  # math marked plugin (optional)
  mermaid@^11                             # diagrams (optional)
  fuse.js@^7                              # fuzzy palette search

runtime deps (main-side):
  chokidar@^5                             # file watcher

styles/fonts shipped in renderer/:
  Inter (variable woff2)
  JetBrains Mono (variable woff2)
  KaTeX fonts dir (if math is enabled)
  github-markdown-css@^5 (optional base)
  shiki theme CSS not needed (inline styles)

window flags (main.js BrowserWindow opts):
  transparent: true
  backgroundColor: '#00000000'
  backgroundMaterial: 'mica'        // Windows 11
  vibrancy: 'under-window'          // macOS (future)
  titleBarStyle: 'hidden'
```

---

## 15. Example Full Wiring (vanilla JS, no React, no bundler)

A condensed but complete `renderer/vault.js`:

```javascript
import { Marked } from 'https://esm.sh/marked@18';
import markedShiki from 'https://esm.sh/marked-shiki';
import { createHighlighter } from 'https://esm.sh/shiki@4.1.0';
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationFocus,
} from 'https://esm.sh/@shikijs/transformers';
import DOMPurify from 'https://esm.sh/dompurify@3.4';
import matter from 'https://esm.sh/gray-matter@4';

const highlighter = await createHighlighter({
  themes: ['github-dark-dimmed', 'catppuccin-mocha', 'rose-pine-moon'],
  langs: ['markdown', 'js', 'ts', 'jsx', 'tsx', 'json', 'yaml', 'powershell', 'bash', 'python', 'go', 'rust'],
});

const marked = new Marked({ gfm: true, breaks: true }).use(markedShiki({
  async highlight(code, lang) {
    return highlighter.codeToHtml(code, {
      lang: highlighter.getLoadedLanguages().includes(lang) ? lang : 'text',
      theme: state.theme || 'catppuccin-mocha',
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        transformerNotationFocus(),
      ],
    });
  },
}));

export async function renderEntry(filePath) {
  const raw = await window.ezvibes.readFile(filePath);
  const { data, content } = matter(raw);
  const html = DOMPurify.sanitize(await marked.parse(content), { USE_PROFILES: { html: true, svg: true, svgFilters: true } });
  return { data, content, html };
}

// --- vault list ---
const list = document.querySelector('#vault-list');
const preview = document.querySelector('#vault-preview');

function chip({ data, path }) {
  const el = document.createElement('button');
  el.className = `chip kind-${data.kind || 'prompt'} agent-${data.agent || 'any'}`;
  el.dataset.path = path;
  el.style.setProperty('view-transition-name', `chip-${slug(path)}`);
  el.innerHTML = `
    <span class="chip-glyph">${glyphFor(data.kind)}</span>
    <span class="chip-title">${escape(data.title || basename(path))}</span>
    <span class="chip-tags">${(data.tags || []).map(t => `<i>${t}</i>`).join('')}</span>
    <span class="chip-time">${timeago(data.created || data.mtime)}</span>
  `;
  el.addEventListener('mouseenter', () => peekPreview(path));
  el.addEventListener('click', () => pasteIntoActiveTab(path, el));
  return el;
}

window.ezvibes.onVaultEvent(({ event, path, data }) => {
  if (document.startViewTransition) {
    document.startViewTransition(() => applyVaultEvent(event, path, data));
  } else {
    applyVaultEvent(event, path, data);
  }
});

async function pasteIntoActiveTab(path, chipEl) {
  const { content } = await renderEntry(path);
  const sessionId = window.EZvibes.state.activeSessionId();
  const wrapped = `\x1b[200~${content}\x1b[201~`;
  // animate the chip flying to the terminal cursor
  const fly = chipEl.cloneNode(true);
  fly.classList.add('flying');
  document.body.appendChild(fly);
  const target = window.EZvibes.dom.activeTerminalCursorRect();
  fly.animate(
    [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
     { transform: `translate(${target.x - chipEl.offsetLeft}px, ${target.y - chipEl.offsetTop}px) scale(.2)`, opacity: 0 }],
    { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)' }
  ).onfinish = () => fly.remove();
  await window.ezvibes.writeTerminal(sessionId, wrapped);
}
```

---

## 16. References & Reading List

- **Marked** — <https://github.com/markedjs/marked> · v18.0.4 changelog at <https://github.com/markedjs/marked/releases>
- **marked-shiki** — <https://www.npmjs.com/package/marked-shiki>
- **markdown-it** — <https://github.com/markdown-it/markdown-it> · API at <https://markdown-it.github.io/markdown-it/>
- **Shiki** — <https://shiki.style> · install guide <https://shiki.style/guide/install>
- **Shiki transformers** — <https://shiki.style/packages/transformers>
- **Shiki Twoslash** — <https://shiki.style/packages/twoslash>
- **Shiki Magic Move** — <https://github.com/shikijs/shiki-magic-move>
- **Expressive Code** — <https://expressive-code.com/key-features/syntax-highlighting/>
- **starry-night** — <https://github.com/wooorm/starry-night>
- **gray-matter** — <https://github.com/jonschlinkert/gray-matter>
- **KaTeX** — <https://katex.org/> · marked-katex-extension <https://www.npmjs.com/package/marked-katex-extension>
- **Mermaid** — <https://mermaid.js.org/>
- **github-markdown-css** — <https://github.com/sindresorhus/github-markdown-css>
- **Obsidian Minimal theme** — <https://github.com/kepano/obsidian-minimal>
- **Obsidian Hover Editor** — <https://github.com/nothingislost/obsidian-hover-editor>
- **Typora Themeable** — <https://jhildenbiddle.github.io/typora-themeable/>
- **Typora Primer theme** — <https://github.com/dtinth/typora-primer-theme>
- **DOMPurify** — <https://github.com/cure53/DOMPurify> · v3.4.5
- **chokidar v5** — <https://github.com/paulmillr/chokidar>
- **Catppuccin** — <https://catppuccin.com>
- **Rosé Pine** — <https://rosepinetheme.com>
- **Tokyo Night** — <https://github.com/folke/tokyonight.nvim>
- **Linear Design Patterns** — <https://lobehub.com/skills/marcus-marcus-skills-linear-design-patterns>
- **Raycast Store / Snippet Explorer** — <https://ray.so/snippets>
- **Raycast PromptLab** — <https://www.raycast.com/HelloImSteven/promptlab>
- **View Transition API** — <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>
- **CSS Scroll-driven Animations** — <https://scroll-driven-animations.style/>
- **Native Popover API + interestfor** — <https://modern-css.com/articles/build-a-tooltip-system/>
- **Dark Glassmorphism (2026 trend)** — <https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f>
- **Glassmorphism UI in 2026** — <https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026>
- **AGENTS.md / handoffs in 2026** — <https://chrisreddington.com/blog/building-your-agent-toolbox/>, <https://tessl.io/blog/from-prompts-to-agents-md-what-survives-across-thousands-of-runs/>
- **PkgPulse — Best markdown parsers 2026** — <https://www.pkgpulse.com/guides/best-markdown-parsing-libraries-2026>
- **PkgPulse — marked vs remark vs markdown-it 2026** — <https://www.pkgpulse.com/guides/marked-vs-remark-vs-markdown-it-parsers-2026>

---

*End of dossier.*
