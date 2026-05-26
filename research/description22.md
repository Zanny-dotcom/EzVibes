# Description 22 — Modern Terminal UI Innovation (2025 - 2026)

*Research focus for the EZvibes "prompt vault" feature.*

This document is a deep, opinionated knowledge dump on the state-of-the-art in terminal user-interface design between roughly March 2025 and May 2026. The goal is to inform the design of a side-mounted **"prompt vault"** inside EZvibes session windows: a panel that lists the markdown files in a folder, lets the user click a file, and instantly pastes the file's text into the currently active xterm.js terminal tab. We want to land on something that feels **pioneer-level** rather than another file picker, so this report intentionally over-collects ideas, exact code values, and conceptual primitives from the most innovative shipping products.

The report is split into four large sections:

1. **The competitive landscape** — eight terminal applications and what they each get right (Warp, Wave, Ghostty, WezTerm, Hyper, Tabby, cmux, Windows Terminal).
2. **The vault-adjacent ideas** — Warp Drive, VS Code prompt files, Cursor Skills, Raycast Snippets, Obsidian, and other prompt-stash patterns to steal from.
3. **Aesthetics 2026** — glass, Liquid Glass, dark-mode tokens, fonts, motion design, ASCII boot sequences.
4. **The pioneer-level synthesis** — a concrete proposal that fuses the above into a vault feature for EZvibes.

---

## 1. The Competitive Landscape — What Modern Terminals Are Actually Doing

### 1.1 Warp — the block-based pioneer

Warp is the most directly relevant product on the market because it has solved, at scale, exactly the problem EZvibes is now trying to solve: *make a terminal feel like a modern, editable, content-rich application without breaking the underlying TTY*. Its block model is the single most copied idea in 2025–2026 terminal design.

**The block model in detail.** Warp doesn't render a traditional 2D character grid as the top-level scene. Instead, it renders a `BlockList` — an ordered list of typed blocks. Each block is "a self-contained unit of content that stacks vertically and scrolls together." Two block types exist today: **terminal blocks** (which internally still have a command-side grid and an output grid, both row-by-column matrices of cells) and **rich-content blocks** (arbitrary UI views injected at a specific position — most notably Agent conversation cards, diff cards, and AI reasoning panes).

Under the hood Warp uses a **`SumTree`** keyed on block heights so that any viewport-query is O(log n). Rendering is virtualized twice: only blocks that intersect the viewport render, and within those blocks only the intersecting rows render. Storage is dual: a mutable **`GridStorage`** for the active region where the cursor can still write, and a packed-byte **`FlatStorage`** for scrollback with per-byte styling kept in interval maps. The killer practical consequence is that styled scrollback survives a window resize cheaply — only the row index has to rebuild, not the bytes.

Shell integration happens via **escape-sequence-wrapped JSON events** emitted by `precmd`/`preexec` hooks in zsh / bash / fish / PowerShell. That contract — "the shell tells the terminal where blocks begin and end via OSC sequences" — is the same trick we use today for our cwd reporting prompt wrapper. For a vault feature, the takeaway is: terminals can carry a *lot* of in-band metadata if you stay disciplined about OSC namespaces.

**Visible features per block** include: copy-command, copy-output, scroll-to-output-start, re-input the command, share command+output (with formatting preserved), bookmark, and red-on-error sidebar coloring. Non-zero exit codes color the whole block sidebar red. Every block is independently addressable, which is what makes a block-feed feel structured instead of "endless scroll."

**Why it matters for the vault.** If we ever wanted to fold the *vault itself* into the scrollback as a rich-content block ("I just used `claude-handoff.md` — record that as a block in the session log"), Warp's model is the existence proof that this is possible inside an Electron-style stack. EZvibes already groups terminals into per-folder session windows; folding a prompt-paste into a "vault block" pinned at the bottom of the active tab would feel state-of-the-art.

**Sources used.** [Warp - block model behind the agentic dev environment](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment), [Terminal Block Basics](https://docs.warp.dev/terminal/blocks/block-basics/), [Block Actions](https://docs.warp.dev/terminal/blocks/block-actions/), [Warp modern terminal](https://www.warp.dev/modern-terminal).

### 1.2 Warp Drive — the most directly applicable prior art

**Warp Drive is the feature to study most carefully.** It is, almost exactly, the prompt-vault concept Oskari sketched, except built into Warp's terminal instead of into a separate Electron shell.

**What Warp Drive contains:**

- **Workflows** — parameterized shell commands with `{{argument}}` placeholders. Used to be YAML files; the modern form is editable via a GUI.
- **Notebooks** — markdown-flavored interactive documents that can embed Workflows as runnable blocks. Like a Jupyter notebook but for the shell.
- **Prompts** — parameterized natural-language queries you save and reuse with Agent Mode. Each prompt has a name, a description (indexed for fuzzy search), a body (the natural-language query), and zero or more typed arguments.
- **Environment variables** — saved & shared.
- **Rules / MCP configurations** — shared agent context.

**How the UI works (from documentation analysis).**

- Warp Drive opens as a **side panel** alongside the terminal. The terminal is never replaced.
- A **`+` icon** at the top of the panel creates new items, and a dropdown picks the type (Prompt / Workflow / Notebook / etc).
- Searching is **always via the Command Palette** (`CMD+P` on macOS, `CTRL+SHIFT+P` on Windows/Linux). You can prefix `prompts:` or `workflows:` to scope the search.
- A second shortcut `CTRL+R` is the universal "command search" — it searches **history, workflows, and AI commands** in one combined ranked list. Three buttons at the top of the result list filter by category.
- Notebooks are created via `SHIFT+OPTION+CMD+J` (or `SHIFT+CTRL+ALT+J` on Windows). They are rendered with markdown headings, code blocks, and **executable code blocks** — click or press a key to run the block in the adjacent terminal.
- **Tab cycling through arguments**: when a workflow/prompt is selected, it pastes into the terminal input editor and `SHIFT+TAB` cycles through the `{{arguments}}`. Two argument types exist: **text** (free-form) and **enum** (dropdown). Enum lists can either be static or come from the live output of a shell command — a fantastic idea we should probably steal.
- **Sharing**: Personal vs Team drives. Drag-and-drop between them transfers ownership. Concurrent edit collisions are resolved by "you must re-fetch before saving" — pessimistic.
- **AI semantic indexing** — Warp Drive items are indexed and become context for Agent Mode. So when you ask "deploy the staging environment," Warp can surface your `deploy-staging` workflow as the answer.

**The actual interaction loop, exactly as Oskari described it.**

1. You're inside a terminal session.
2. You hit `CMD+P` (or click a Drive icon).
3. A palette / side panel slides in.
4. You either browse a list of saved prompts/workflows or fuzzy-search by name.
5. Click → the command is **pasted into the active terminal's input editor**, *not* executed.
6. You edit any `{{arg}}` placeholders, `Enter` to run.

That last detail — "pasted into the input editor, not executed" — is the safety property that lets users vet a command before running it. EZvibes must replicate this in the vault (paste into xterm.js as keystrokes, *with bracketed-paste mode on*, *do not* append `\r`).

**Sources used.** [Warp Drive Prompts](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/prompts/), [Warp Drive Workflows](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/workflows/), [Warp Drive Notebooks](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/notebooks/), [Introducing Notebooks in Warp Drive](https://www.warp.dev/blog/notebooks-in-warp-drive), [Warp Drive overview](https://www.warp.dev/warp-drive), [Warp Command Palette](https://docs.warp.dev/terminal/command-palette/), [Warp Keyboard Shortcuts](https://docs.warp.dev/getting-started/keyboard-shortcuts/).

### 1.3 Warp's 2026 redesign and AI layer

A handful of 2026 Warp changes are worth knowing because they hint at where the whole product space is moving:

- **Vertical Tabs sidebar** (April 2026, v0.2026.04.08). Switching to vertical tabs reclaims horizontal space and lets the tab list double as a folder/agent overview. Each tab row has an **icon + title** with optional subtitle. A *hover detail sidecar* shows un-clipped metadata when the mouse rests on a tab. Tabs are searchable and reorderable.
- **Conversation Details Sidebar** — a unified info panel for Agent conversations, with metadata, artifacts, and run statistics.
- **Agent Modality Redesign** — Warp now distinguishes a *clean terminal* mode from a *conversation* view for multi-turn AI workflows.
- **Active AI suggestions** — Warp watches your shell (cwd, recent commands, exit codes, branch, recent block I/O) and surfaces *contextual prompts* via a banner ("Looks like a failing test — run a `claude` agent on it?"). The banner offers an Agent-Mode prompt with one click.
- **Block-level badges** are folded up into tab badges; bell indicators on the chip when a block produces an error.
- **Global Search Panel** — `CMD+F`/`CTRL+SHIFT+F`. Full-codebase file search visible alongside the terminal.
- **Save as Workflow / Save as Prompt** from Block Actions — any executed block can be promoted into the Drive vault with a click. **This is the killer hand-off pattern**: any Claude or Codex output that ends up being useful can be one-click crystallized into a reusable prompt.

**Sources used.** [Warp 2026 changelog](https://docs.warp.dev/changelog/2026/), [Vertical Tabs docs](https://docs.warp.dev/terminal/windows/vertical-tabs/), [Configurable toolbar](https://docs.warp.dev/terminal/windows/configurable-toolbar/), [Warp Guide 2026 / DeployHQ](https://www.deployhq.com/guides/warp).

### 1.4 Wave Terminal — the most flexible block-and-widget Electron stack

Wave Terminal (waveterm.dev) is the open-source AI-integrated terminal that ships natively as macOS / Linux / Windows. **Of all the terminals surveyed, Wave has the layout system that is most architecturally similar to what EZvibes needs.**

**What Wave is.** A flexible **drag-and-drop tiling workspace** where the building block is the "Block." A Block can be a terminal, a markdown / code editor (Monaco), a web browser, an SSH shell, an AI assistant, a file preview, a directory preview, a process viewer, or any custom widget. Blocks are arranged in tabs and split horizontally/vertically. Tabs can be horizontal *or vertical* (since v0.14.4 — same trend as Warp).

**Block features visible in the UI.**

- **Magnified block mode** — temporarily blow a single block up to full-screen without disturbing the layout. Press a key, the block fills the window; press again, the layout snaps back. This is the right interaction for a vault preview: hit a key, the prompt expands to a readable full-screen viewer; hit again, you're back.
- **Block-level badges** with priority that bubble up to the tab title. A pretty good pattern for surfacing "this folder's vault has 3 new hand-off files" in the tab chip.
- **Vim-style block navigation** with `Ctrl+Shift+H/J/K/L`.
- **Block splitting buttons** in the block header (opt-in `app:showsplitbuttons`), `F2` rename.
- **Cursor customization per block** (block / bar / underline + blink).
- **Focus-follows-cursor** option.
- **Directory preview** with zebra-striped rows, context menus, drag-and-drop file moves.
- **Markdown preview** with GitHub-flavored markdown, alerts, Mermaid diagrams.

**Widgets sidebar (v0.14.5).** This is Wave's most relevant gem. The sidebar lives at the left edge and is toggleable per workspace. You can drag widgets into the workspace from it. Widgets are *user-extensible* — you write a block type (e.g. a database browser, a Kubernetes pod viewer, a Markdown vault) in TypeScript/React and hot-reload it. This is the cleanest existence proof that an embedded "prompt vault" widget is a viable architectural choice inside an Electron terminal.

**Wave's `wsh` command.** A CLI tool you run *from inside a Wave terminal* that talks to the Wave host. `wsh ai` pipes content into the AI panel. This is the inverse of what we want: Wave lets the terminal talk to the GUI; in EZvibes the GUI vault talks to the terminal. The point is that the IPC plumbing exists and is real.

**Quake mode.** A global hotkey toggles Wave window visibility. Worth borrowing for EZvibes eventually — a global hotkey that summons the running EZvibes window from anywhere.

**Sources used.** [Wave Terminal GitHub](https://github.com/wavetermdev/waveterm), [Wave Terminal release notes](https://docs.waveterm.dev/releasenotes), [Wave Terminal review (BrightCoding)](https://www.blog.brightcoding.dev/2025/09/13/wave-terminal-the-open-source-terminal-that-blends-command-line-power-with-modern-visual-tools), [Wave Terminal: AI-Powered (TrishTech)](https://www.trishtech.com/2025/03/wave-terminal-a-modern-ai-powered-command-line-tool/), [UnderCode review](https://undercodenews.com/wave-terminal-review-why-this-ai-powered-terminal-is-becoming-the-new-developer-favorite/), [apidog write-up](https://apidog.com/blog/wave-open-source-terminal-wave/).

### 1.5 Ghostty — the platform-native baseline

Mitchell Hashimoto's Ghostty is the *anti-Electron* terminal: a Zig core compiled to a C-ABI library, with platform-native GUIs on top (Swift + AppKit/SwiftUI on macOS, GTK4 in Zig on Linux, with Windows in progress). It does **not** ship a vault, sidebar, or prompt panel — it's purposely minimal. So why does it matter for EZvibes?

**Two things matter:**

1. **Typography and rendering quality are now the table-stakes.** Ghostty's font rendering, ligature support, and GPU-accelerated rendering at 240 fps redefined "fast and feature-rich" for the whole space. If we ship a vault that looks even slightly grainy, dated, or stuttery against this backdrop, we lose. xterm.js's WebGL renderer addon is the right floor.
2. **The `libghostty` direction is the future.** It's an existence proof of "terminal engine as embeddable library" — exactly what a few brand-new 2026 products (notably **cmux**, see below) are building on. Knowing that this option exists is strategic: we don't have to bet eternally on node-pty + xterm.js.

Ghostty also added (Discussion #3708) vim-like navigation in scrollback with `j/k` and an "open output in a new tab" command — both useful UX patterns.

**Sources used.** [About Ghostty](https://ghostty.org/docs/about), [Mitchell Hashimoto: Introducing Ghostty and Some Useful Zig Patterns](https://mitchellh.com/writing/ghostty-and-useful-zig-patterns), [Ghostty 1.0 is Coming](https://mitchellh.com/writing/ghostty-is-coming), [Libghostty Is Coming](https://mitchellh.com/writing/libghostty-is-coming), [Ghostty review (THE.Hosting)](https://the.hosting/en/help/review-of-the-ghostty-terminal-application), [Ghostty vim-nav discussion #3708](https://github.com/ghostty-org/ghostty/discussions/3708), [Terminal Trove interview with Hashimoto](https://terminaltrove.com/blog/terminal-trove-talks-with-mitchell-hashimoto-ghostty/).

### 1.6 WezTerm — the multiplexing reference

WezTerm's relevant influence is its **workspace/domain** model. A *domain* is a distinct set of windows and tabs (local default, SSH, Unix-socket, TLS). A *workspace* groups windows/tabs/panes into a logical session. Crucially, **mux operations are scriptable via Lua** — the `wezterm.mux` module lets you rename workspaces, switch context, programmatically spawn panes, etc.

For EZvibes, the directly portable idea is the **scriptable workspace**: a session window's whole composition (which tabs are open, which agents are running, where the cursor is, which vault file was last pasted) should be expressible as a tiny JSON or YAML document. That document is your hand-off file — drop it in a folder and another agent can replay the entire session. WezTerm proves the pattern.

The other WezTerm UX feature worth borrowing: **scrollback search overlay** triggered by `CTRL+SHIFT+F` / `CMD+F`. Persistent per-pane scrollback. EZvibes doesn't have this yet but the vault could be the place we add it — "search across all .md files in this folder and all currently visible terminal scrollback."

WezTerm also has the **`PromptInputLine`** action — prompt the user for a line of text from the chrome and act on it. Very useful for "rename tab," "rename workspace," "save current selection as a vault prompt."

**Sources used.** [WezTerm features](https://wezterm.org/features.html), [WezTerm scrollback](https://wezterm.org/scrollback.html), [WezTerm multiplexing](https://wezterm.org/multiplexing.html), [WezTerm changelog](https://wezterm.org/changelog.html), [Alex Plescan: I really like WezTerm](https://alexplescan.com/posts/2024/08/10/wezterm/), [MakeUseOf: I replaced Windows Terminal with WezTerm](https://www.makeuseof.com/i-replaced-windows-terminal-with-this-gpu-accelerated-emulator/).

### 1.7 Hyper — the Electron precedent

Hyper (`hyper.is`, by Vercel) is the original Electron terminal. It's slow and dated by 2026 standards, but its architecture is *the* prior art for "Electron + xterm.js + plugin system." Useful patterns from Hyper:

- **Hot-reloadable plugin system.** Plugins are universal Node.js modules loaded by both Electron and the renderer process; `Command+R` refreshes them live. This is the architecture for a future "plugin vault" — third parties drop plugins into a folder and they appear in the UI immediately.
- **React + Redux** is the rendering stack — Hyper composes UI with React components and dispatches Redux actions for state. EZvibes stays vanilla JS, but the *idea* of a single Redux-style state tree (`windowsByPath`, `tabsById`, etc) is already what we have.
- **`hyper-vertical-tabs`** plugin and a long history of vertical-tabs requests: this is the same pattern Warp and Wave now ship by default.
- **Theme-as-plugin.** Hyper themes are just npm packages. We could do the same with vault prompt packs ("the dotfiles-prompt-pack", "the rust-prompt-pack").

**Sources used.** [Hyper homepage](https://hyper.is/), [awesome-hyper](https://github.com/bnb/awesome-hyper), [Hyper PLUGINS.md](https://github.com/vercel/hyper/blob/canary/PLUGINS.md), [Hyper's architecture (ReadOSS)](https://readoss.com/en/vercel/hyper/hypers-architecture-navigating-electron-terminal-emulator-codebase), [Supercharge Your Hyper Terminal (DEV)](https://dev.to/abhijith_p_subash/supercharge-your-hyper-terminal-must-have-plugins-tips-tricks-3pmj).

### 1.8 Tabby — the rich Electron terminal everyone forgot about

Tabby (formerly Terminus) is Eugeny's Electron+Angular terminal. Of interest:

- **Quick-commands plugin** (`tabby-quick-cmds`) — sends a saved command to one or all open tabs. Closest existing thing to "click a prompt and broadcast it to all my Claude/Codex tabs at once." A nice mode for the EZvibes vault: "paste this prompt into every tab in the window."
- **HACKING.md** documents a clean plugin SDK with services like `AppService`, `TerminalService`, `ConfigService`, `HotkeysService`. Useful naming if we ever break the vault into modules.
- **Long-standing Issue #6164** asks for a "VS-Code-style command palette" — not yet shipped. So Tabby is also a cautionary tale: don't ship a vault that needs a palette without also shipping the palette.

**Sources used.** [Tabby repo](https://github.com/Eugeny/tabby), [Tabby releases](https://github.com/Eugeny/tabby/releases), [Tabby.sh](https://tabby.sh/), [Tabby Issue #6164 — command palette](https://github.com/Eugeny/tabby/issues/6164), [Tabby HACKING.md](https://github.com/Eugeny/tabby/blob/master/HACKING.md), [Morrolinux Tabby write-up (LPI)](https://www.lpi.org/blog/2025/03/19/morrolinux-tabby-your-friendly-foss-neighborhood-terminal/).

### 1.9 cmux and wmux — the brand-new 2026 multi-agent terminals

These are the *closest existing analogues to EZvibes itself.*

- **cmux** (February 2026, macOS-only): a native terminal built specifically for running multiple AI coding agents (Claude Code, Codex, etc). Uses libghostty for GPU rendering. Adds vertical tabs with git-branch status, split panes, notification rings, an embedded scriptable browser, session restore, and **dedicated UI for multi-agent comparison**. Free and open-source.
- **wmux** (Windows): a port of cmux to Windows for AI agents. Includes a 7-step interactive onboarding ("learn workspaces, splits, tabs, browser panel, notifications in under 2 minutes") — a *fantastic* onboarding pattern that EZvibes should consider stealing.

The lesson is: in 2026 the "AI agent terminal" is its own product category. EZvibes is squarely in that category. The vault is what differentiates EZvibes from cmux — cmux comparisons output side-by-side; EZvibes could prompt agents side-by-side from a shared vault.

**Sources used.** [cmux vs tmux (Soloterm)](https://soloterm.com/cmux-vs-tmux), [wmux GitHub](https://github.com/amirlehmam/wmux), [Cursor 2.0 and multi-agent rethink (CometAPI)](https://www.cometapi.com/cursor-2-0-what-changed-and-why-it-matters/).

### 1.10 Windows Terminal — the JSON-themed sleeper

Windows Terminal isn't innovative anymore, but its **JSON-driven theming model** is the cleanest example of "user-editable theming" for an Electron-adjacent terminal. The relevant settings:

```jsonc
"profiles": {
  "defaults": {
    "useAcrylic": true,
    "opacity": 70,
    "backgroundImage": null,
    "experimental.retroTerminalEffect": false,
    "font": { "face": "Cascadia Code", "size": 11.0 }
  }
}
```

`useAcrylic` triggers Windows 11's native acrylic material; `opacity` is 0–100. The acrylic effect is only visible when the window has focus (Win11 design rule). EZvibes's BrowserWindow can do exactly this on Win11 22H2+ via `setBackgroundMaterial('acrylic'|'mica'|'tabbed'|'auto')`.

**Sources used.** [Windows Terminal Themes docs (MS Learn)](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/themes), [Acrylic material docs (MS Learn)](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic), [Mica material docs (MS Learn)](https://learn.microsoft.com/en-us/windows/apps/design/style/mica), [Windows Terminal looks dull (HowToGeek)](https://www.howtogeek.com/the-windows-terminal-looks-dull-so-i-made-it-look-cool/).

---

## 2. Prompt-Stash Patterns Worth Stealing

### 2.1 VS Code prompt files — `.prompt.md` as the file format

GitHub Copilot in VS Code (and Visual Studio) **standardized on `.prompt.md` as the on-disk format for reusable prompts** in 2025–2026. The pattern that emerged:

- Files live in **`.github/prompts/`** at workspace scope, or in the user profile directory at user scope.
- They are auto-discovered. Once present, they appear as **slash commands in chat** — `/my-prompt-name`.
- An optional **YAML frontmatter** at the top configures the prompt's behavior:

```markdown
---
mode: agent
description: Refactor the selected file to TypeScript
tools: [filesystem, terminal]
---

You are refactoring {{file}} from JavaScript to TypeScript.
Preserve all behavior, add type annotations, ...
```

- The agent field can be `ask`, `agent`, `plan`, or a custom agent name.
- Users invoke them with `/create-prompt` to interactively bootstrap a new file.
- The 2026 GitHub Copilot SDK consumes *the same* `.prompt.md` files — so the format has become a *de facto cross-tool standard.*

**Implication for EZvibes.** If our vault stores plain `.md` files (and especially `.prompt.md` and `HANDOFF.md`), it's automatically interoperable with VS Code, Cursor, and the broader Copilot ecosystem. **We should use exactly the same convention** — at minimum, files in a folder are flat markdown; preferably we honor `.prompt.md` and parse YAML frontmatter for display metadata (title, description, icon, color).

**Sources used.** [VS Code prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files), [VS Code Copilot customization overview](https://code.visualstudio.com/docs/copilot/customization/overview), [GitHub Docs: your first prompt file](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files/your-first-prompt-file), [.NET Blog: prompt files vs instruction files](https://devblogs.microsoft.com/dotnet/prompt-files-and-instructions-files-explained/), [Visual Studio Blog: reusable prompt files](https://devblogs.microsoft.com/visualstudio/boost-your-copilot-collaboration-with-reusable-prompt-files/).

### 2.2 Cursor Skills + Composer 2.5 + multi-agent handoffs

Cursor 2.0's "Skills" feature shipped early 2026 (nightly channel) and is the bleeding-edge analogue of prompt files:

- **A Skill is a procedural "how-to" markdown file** invoked on demand via a slash command.
- Skills support **hooks** that integrate with security tools and secrets managers.
- Cursor team administrators can define custom commands, rules, and prompts from a central dashboard and they **distribute via deeplinks** — `cursor://install-prompt/...`. No local file storage required for end users.
- Cursor 2.0 runs up to **eight agents in parallel** with **git-worktree isolation** between them. Each agent has its own working directory branched from the same repo. A unified UI compares outputs.
- The **CLI** has a model picker, a status bar, non-interactive (script) mode, and **cloud handoff** — a button to push the in-progress task to a cloud agent and keep working on your laptop.

**Hand-off as a first-class concept.** The pattern that's emerging: a session-ending markdown file (`HANDOFF.md`) is dropped in the folder; the next session's first action is to ingest it. EZvibes's vault should treat `HANDOFF.md` (and any file matching `handoff*.md`) as a distinguished entry — pin it to the top, give it a distinct color, surface it in the tab chip.

**Sources used.** [Cursor 3 / Composer 2 explainer (aitrending.live)](https://aitrending.live/blog/cursor-3-composer-2-agent-first-coding-environment), [Cursor 2.0 multi-agent guide (Towards Data Engineering)](https://medium.com/towards-data-engineering/parallel-ai-agents-in-cursor-2-0-a-practical-guide-e808f89cffb9), [Cursor 2.0: Agent-First Architecture Complete Guide](https://www.digitalapplied.com/blog/cursor-2-0-agent-first-architecture-guide), [Cursor CLI write-up (Peerlist)](https://peerlist.io/crisesarmiento/articles/cursor-cli-the-terminal-agent-thats-straightup-changing-how-), [Mastering Cursor Composer 2.5 (DEV)](https://dev.to/om_shree_0709/cursor-just-released-composer-25-heres-what-actually-changed-for-ai-coding-agents-51fc).

### 2.3 Raycast Snippets & Quicklinks — the launcher metaphor

Raycast is the design north-star for "keyboard-first launcher UI" in 2026. Two relevant primitives:

- **Snippets**: typed abbreviation triggers (`;;sig` expands to your signature). 2026 added **tags** so you can group by client/project/language. Snippets can include placeholders like `{cursor}` and `{date}`. Snippets fire **anywhere in macOS** via the system text engine.
- **Quicklinks**: stored URLs / file-paths / deeplinks pinned at the top of Root Search. 2026 added pinning, tagging, and a `{calculator}` placeholder that evaluates math expressions inline on open.
- The 2026 Raycast UI redesign explicitly uses **Liquid Glass surfaces in tasteful ways** ("to enhance the functional nature of a launcher")— the app stays familiar while feeling fresh on macOS Tahoe.

**Implication for EZvibes vault.** The Raycast metaphor argues that *a vault entry is also a launcher target*. We should let vault entries be more than `.md` files: they can be Quicklinks-like records that bundle (title, body, default args, color tag, hotkey). The on-disk representation can still be a markdown file with YAML frontmatter — but the vault UI should treat them with launcher affordances (pin, tag, hotkey, recency).

**Sources used.** [Raycast Snippets manual](https://manual.raycast.com/snippets), [Raycast Quicklinks manual](https://manual.raycast.com/quicklinks), [The new Raycast (blog)](https://www.raycast.com/blog/the-new-raycast), [What's new in Raycast for Mac v2](https://manual.raycast.com/new-in-v2), [Raycast in 2026 (DEV)](https://dev.to/dharanidharan_d_tech/raycast-in-2026-the-mac-launcher-that-replaced-4-apps-in-my-dev-workflow-3pka), [What's New in Raycast 2026](https://raycast-discount-code.com/blog/raycast-2026-updates).

### 2.4 Obsidian — the markdown-vault gold standard

Obsidian is the most-loved markdown vault on the planet, and its UI moves are widely copied. What's directly relevant to EZvibes:

- **Sidebar with rainbow-colored folders.** The community plugin "Rainbow-Colored Sidebar" assigns automatic theme-based colors to vault folders and files (9 schemes including rainbow gradients, blue palettes, accessibility-friendly modes). The aesthetic value of folder color-tagging is dramatic; EZvibes should tag prompt categories the same way.
- **Custom Sidebar Icons.** Lets users assign Lucide icons (or arbitrary URLs / local PNGs) per file or folder. Means files in the vault don't have to be visually identical.
- **Hide Sidebars on Window Resize.** Auto-collapses below a threshold width — handy for the small EZvibes popup state.
- **Cycle In Sidebar.** Hotkeys cycle through sidebar tabs.
- **Mobile Sidebar Notes** — even mobile gets a sidebar-mounted note panel. For us this is just confirmation: the sidebar metaphor is universal.

**Sources used.** [Obsidian Sidebar Help](https://help.obsidian.md/User+interface/Sidebar), [Obsidian Stats: all sidebar plugins](https://www.obsidianstats.com/tags/sidebar), [Custom Sidebar Icons plugin](https://www.obsidianstats.com/plugins/custom-sidebar-icons), [The Obsidian UI and settings (Fork My Brain)](https://notes.nicolevanderhoeven.com/obsidian-playbook/Using+Obsidian/01+First+steps+with+Obsidian/The+Obsidian+UI+and+settings), [Knowledge workflow 2026 updates (Péter Balázs Polgár)](https://polgarp.com/blog/Knowledge-workflow-2026-updates/).

### 2.5 Open-source prompt-vault projects (existing prior art)

A handful of small projects already exist named "prompt vault." None of them are terminal-integrated. Useful as a UI reference:

- **`bharathkumar-12/prompt-vault`** (GitHub): browser-only, no build step, ratings on prompts, 500-char notes per prompt, JSON import/export.
- **PromptVault Chrome extension**: ~April 2026 update, "glass morphic UI," hierarchical variable presets, injects directly into ChatGPT / Claude / Gemini interfaces.
- **MrXie23/PromptLibrary**: multilingual categorized prompt repo.
- **prompts.chat**: 143k+ GitHub stars, the world's largest open-source prompt library.

**The recurring patterns across these projects:**

1. **Card list** as the primary view.
2. **Tags + categories** for filtering.
3. **Click → copy to clipboard** (the universal interaction).
4. **Ratings + notes** for user re-ranking.
5. **JSON import/export** for portability.
6. **Glass-morphic styling** is the default visual treatment in 2026.

**Sources used.** [bharathkumar-12/prompt-vault](https://github.com/bharathkumar-12/prompt-vault), [w512/Prompt-Vault](https://github.com/w512/Prompt-Vault), [PromptVault Chrome extension](https://chromewebstore.google.com/detail/prompt-vault/ojlamjfhdbmifmgeepgbjcfbfgjfbimd), [MrXie23/PromptLibrary](https://github.com/MrXie23/PromptLibrary), [ZeroGrav Prompt Vault](https://zerograv.dev/), [Vault iOS app](https://apps.apple.com/us/app/vault-ai-prompt-library/id6745626357), [PromptVault Chrome](https://chromewebstore.google.com/detail/promptvault-ai-prompt-lib/dnedgbcncppfkealibjjfjjiiinhmiag), [Best prompt libraries (Pinggy)](https://pinggy.io/blog/best_prompt_libraries_for_ai_assisted_software_development/), [Best Prompt Libraries Developers Actually Use in 2026 (DEV)](https://dev.to/lightningdev123/best-prompt-libraries-developers-actually-use-in-2026-2fo6).

### 2.6 Claude Code subagents & memory — the hand-off model in production

The wider Claude Code ecosystem (which EZvibes is built around) has its own pattern for hand-offs:

- A subagent has its own context window, system prompt, and toolset.
- The subagent's YAML frontmatter can specify `memory: project` (or `user` or `local`). When set, Claude Code maintains a persistent directory `~/.claude/agent-memory/<name>/` (user scope) or `.claude/agent-memory/<name>/` (project scope) and auto-injects the first 200 lines of `MEMORY.md` from that directory into the system prompt at every invocation.
- `HANDOFF.md` is the community convention for "what to tell the next session" — a single file that another fresh Claude session reads first.
- Subagents are defined as markdown files in `.claude/agents/` (project) or `~/.claude/agents/` (user). The file name is the agent name; the body is the system prompt.

**This means EZvibes's vault feature should display three distinct, visually-distinguished file categories:**

1. **Prompts** — `prompt-*.md`, `.prompt.md`, or whatever the user wants. Pasted as user input.
2. **Hand-offs** — `HANDOFF*.md`, `handoff-*.md`. Pinned, colored distinctly (lime / lime-green seems right). Should also surface a tiny "new since last open" badge on the tab chip.
3. **Memory / context** — `CLAUDE.md`, `MEMORY.md`, `AGENTS.md`. These are usually *injected* not pasted, but the vault should still surface them with a "send to active agent as context" action.

**Sources used.** [Create custom subagents (code.claude.com)](https://code.claude.com/docs/en/sub-agents), [Multi-agent coordination patterns (Anthropic)](https://claude.com/blog/multi-agent-coordination-patterns), [Embracing the parallel coding agent lifestyle (Simon Willison)](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/), [Claude Code workflow patterns (MindStudio)](https://www.mindstudio.ai/blog/claude-code-agentic-workflow-patterns), [My Claude Code Setup (psantanna)](https://psantanna.com/claude-code-my-workflow/workflow-guide.html), [am-will/swarms (GitHub)](https://github.com/am-will/swarms), [Inside Claude Code's System Prompt (ClaudeCodeCamp)](https://www.claudecodecamp.com/p/inside-claude-code-s-system-prompt), [How Prompt Caching Actually Works in Claude Code](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code), [Inside Claude Code architecture (Penligent)](https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/).

### 2.7 Zed editor — palette + agent panel + rules library

Zed 1.0 (2026) reached the same equilibrium independently: **command palette + dedicated agent panel + rules library**.

- `Cmd+Shift+P` → command palette is the gateway to every action.
- `Cmd+R` → "Open Recent" with branch context.
- **Agent Panel** opens via `agent: new thread` action or the ✨ sparkles icon in the status bar. Inline Assistant via `Ctrl+Enter` inside any editor, including the terminal panel and the rules library.
- 2026 added GIF previews in Markdown rendering, bookmarks, `editor: convert to base64` / `editor: convert from base64` palette actions, `git: view commit` palette actions.

The relevant pattern: **inline assistant in the terminal panel.** If the vault has a "smart" mode, clicking a vault entry could optionally route through an inline assistant ("apply this prompt to the current file in the editor") instead of pasting raw.

**Sources used.** [Zed command palette](https://zed.dev/docs/command-palette), [Zed Agent Panel](https://zed.dev/docs/ai/agent-panel), [Zed Inline Assistant](https://zed.dev/docs/ai/inline-assistant), [Zed release notes (Releasebot)](https://releasebot.io/updates/zed), [Zed features](https://zed.dev/features).

---

## 3. The 2026 Aesthetic — Glass, Motion, Color, Type

### 3.1 Liquid Glass (Apple, June 2025 — May 2026)

Apple's WWDC 2025 redesign introduced **Liquid Glass** as a material — translucent, reflecting and refracting its surroundings, dynamically transforming to bring focus to content. It's the design layer across iOS 26, iPadOS 26, macOS Tahoe 26, watchOS 26, and tvOS 26. macOS Tahoe icons, the Dock, the menu bar, Control Center, all in-app navigation, toolbars, and menus now use it.

**Three foundational principles:**

1. **Controls float above content** using glass layers instead of solid blocks.
2. **UI elements align with Apple hardware's rounded geometry**, HDR displays, and edge-to-edge screens.
3. **One design system across watch, phone, tablet, desktop, TV, and spatial computing.**

Apple ships APIs for SwiftUI, UIKit, and AppKit. There is **no first-class web port**, but the look is achievable with CSS.

**Web-replication recipe** (the cleanest version found):

```css
.glass-card {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.35);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

**For a dark terminal vault, tweak:**

```css
.vault-card {
  background: rgba(20, 22, 28, 0.55);                    /* deep neutral, ~55% opaque */
  backdrop-filter: blur(20px) saturate(140%);            /* more blur, slight color punch */
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.08);           /* very faint highlight */
  border-radius: 12px;
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.05) inset,            /* inner top highlight */
    0 10px 30px -10px rgba(0, 0, 0, 0.6),                 /* drop shadow */
    0 0 0 0.5px rgba(255, 255, 255, 0.02);                /* hairline outline */
}

.vault-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 200, 80, 0.35);                /* amber on hover, matches Claude chip */
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.07) inset,
    0 14px 40px -10px rgba(0, 0, 0, 0.7);
  transition: transform 180ms cubic-bezier(0.2, 0, 0, 1),
              border-color 180ms ease-out,
              box-shadow 220ms ease-out;
}
```

**Glassmorphism 2.0** (the 2026 evolution) goes further: relative-color syntax, mask-image gradients, multi-layer backdrop filters. `backdrop-filter` has 97%+ global browser support, so Electron with Chromium gets it free.

**Sources used.** [Apple newsroom announcement](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/), [Apple Developer: Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass), [Apple Developer: New design gallery 2026](https://developer.apple.com/design/new-design-gallery-2026/), [Liquid Glass 2026 explained (Medium)](https://medium.com/@expertappdevs/liquid-glass-2026-apples-new-design-language-6a709e49ca8b), [macOS Tahoe Liquid Glass apps (OpenMark)](https://openmarkapp.com/blog/macos-tahoe-apps-liquid-glass), [Apple's Liquid Glass: CSS examples (grusz.dev)](https://blog.grusz.dev/apples-liquid-glass-glassmorphism-is-shaping-ui-design-in-2025-with-css-code-examples), [Implementing Liquid Glass in React (macos-tahoe.com)](https://macos-tahoe.com/blog/liquid-glass-react-implementation-guide/), [Glassmorphism 2.0 (WebLogTrips)](https://weblogtrips.com/technology/glassmorphism-2-0-css-techniques-2026/), [Backdrop Filter & Glassmorphism (CSS-Zone)](https://css-zone.com/blog/backdrop-filter-glass-morphism), [Glassmorphism guide (Intellure)](https://intellure.co/blog/glassmorphism-guide).

### 3.2 Mica & Acrylic on Windows 11 — the Electron path

Native Windows 11 22H2+ supports background materials via `BrowserWindow.setBackgroundMaterial('acrylic' | 'mica' | 'tabbed' | 'auto' | 'none')`. **Mica** is opaque, dynamic, pulls in theme and desktop wallpaper — Microsoft recommends it for long-lived primary windows (Settings, Edge, Notepad). **Acrylic** is the semi-transparent frosted-glass material — recommended for transient surfaces (flyouts, command bars, *sidebars*, *side panels*).

That maps perfectly to EZvibes:

- The main session window background: **Mica** (long-lived, primary surface).
- The vault sidebar: **Acrylic** (transient overlay), or a CSS approximation if Mica is already set on the parent.

```javascript
// main.js — for the EZvibes session window
const win = new BrowserWindow({
  backgroundMaterial: 'acrylic',  // or 'mica' for primary
  vibrancy: 'sidebar',            // macOS: 'sidebar' or 'menu'
  visualEffectState: 'active',
  transparent: true,              // required for true acrylic
  frame: false,                   // required for full-window material
  // ...
});
```

There are still occasional Electron bugs on Win11 (notably `backgroundMaterial` disappears after maximize/restore on frameless windows in some versions, and "Energy saver" mode flattens the effect to gray). Live with it — the alternative is no glass.

Third-party libraries that smooth out edge cases: **`glasstron`** (cross-platform composition effects, Win/Linux/macOS, Electron 7.1+), **`electron-acrylic-window`** (Win-only, exposes 'acrylic' or 'blur'), **`pykeio/vibe`** (native Win10/11 acrylic for Electron).

**Sources used.** [Electron BaseWindow API](https://www.electronjs.org/docs/latest/api/base-window), [Electron BaseWindowConstructorOptions](https://www.electronjs.org/docs/latest/api/structures/base-window-options), [Electron PR #38163: Mica/Acrylic on Windows](https://github.com/electron/electron/pull/38163/files), [Microsoft Learn: Mica material](https://learn.microsoft.com/en-us/windows/apps/design/style/mica), [Microsoft Learn: Acrylic material](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic), [Microsoft Learn: Materials overview](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials), [Electron Issue #29937 Mica request](https://github.com/electron/electron/issues/29937), [Electron Issue #46753 Material inconsistencies](https://github.com/electron/electron/issues/46753), [glasstron npm](https://www.npmjs.com/package/glasstron), [electron-acrylic-window npm](https://www.npmjs.com/package/electron-acrylic-window), [pykeio/vibe (GitHub)](https://github.com/pykeio/vibe), [Implementing Win11 Mica & Acrylic in Electron](https://coldfusion-example.blogspot.com/2025/12/implementing-windows-11-mica-acrylic.html), [Codestudy: Blur background in transparent Electron](https://www.codestudy.net/blog/how-do-i-blur-an-electron-browserwindow-with-transparency/).

### 3.3 Color palettes 2026 — never pure black, always tinted

Linear's 2026 redesign reset the bar for dark-mode color systems. The relevant findings:

- **Migrated from HSL to LCH** for theme generation — LCH is perceptually uniform.
- **Three core variables per theme** (base color, accent color, contrast) instead of 98.
- **High-contrast variant** built in for accessibility.
- **Switched from blue-cool to warmer gray** — "less saturated but still crisp."
- **Inter** for body text, **Inter Display** for headings.

Industry-wide dark-mode rules for 2026:

- **Never pure black `#000000`.** The base background is `#09090B` — a "zinc-tinted near-black that feels deep without being a void."
- **Sidebar tints:** `#343a40` (warm slate), `#1a1a2e` (deep navy), `#0d1117` (GitHub dark). Avoid `#000`.
- **Text colors:** **never pure white `#FFFFFF`.** Use off-whites: `#E0E0E0`, `#C9D1D9` (GitHub's choice), `#EDEDED`. Reduces eye strain.
- **Pure gray `#808080` is dated.** Use *tinted neutrals* (warm gray, cool gray, zinc, slate).

A recommended dark vault palette built on these rules:

```css
:root {
  /* Background layers */
  --bg-base:        #0a0a0e;             /* darkest, behind everything */
  --bg-surface:     #14161c;             /* card surface (matches glass) */
  --bg-elevated:    #1a1d24;             /* hover / selected card */
  --bg-overlay:     rgba(20, 22, 28, 0.55);  /* glass surface */

  /* Borders */
  --border-subtle:  rgba(255, 255, 255, 0.06);
  --border-clear:   rgba(255, 255, 255, 0.12);
  --border-strong:  rgba(255, 255, 255, 0.18);

  /* Text */
  --text-primary:   #ECEDEE;
  --text-secondary: #A1A1AA;
  --text-tertiary:  #71717A;

  /* Accents that match the existing EZvibes palette */
  --accent-claude:  #F0B433;      /* the existing EZvibes amber */
  --accent-codex:   #2DD4BF;      /* the existing teal */
  --accent-handoff: #84CC16;      /* lime — visually distinct from both */
  --accent-danger:  #F87171;
  --accent-vault:   #A78BFA;      /* violet — the vault's own brand color */

  /* Glow / focus rings */
  --glow-claude:    0 0 24px rgba(240, 180, 51, 0.35);
  --glow-codex:     0 0 24px rgba(45, 212, 191, 0.35);
  --glow-vault:     0 0 32px rgba(167, 139, 250, 0.45);
}
```

**Sources used.** [Linear redesign part II](https://linear.app/now/how-we-redesigned-the-linear-ui), [Linear: a calmer interface](https://linear.app/now/behind-the-latest-design-refresh), [UI Color Trends 2026 (Recursion)](https://recursion.software/blog/ui-color-trends-2026), [UI Color Trends to Watch in 2026 (Updivision)](https://updivision.com/blog/post/ui-color-trends-to-watch-in-2026), [Dark Mode Design Systems guide (Muzli)](https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/), [Best Practices for Dark Mode in Web Design 2026 (NateBal)](https://natebal.com/best-practices-for-dark-mode/), [Best Dark Mode UI 2026 inspiration (Muzli)](https://muz.li/inspiration/dark-mode/), [Dark mode UI design / variables and naming (Medium)](https://medium.com/design-bootcamp/dark-mode-ui-design-organizing-color-variables-and-naming-df3fa005ae77), [Accessible Linear design across modes (LogRocket)](https://blog.logrocket.com/how-do-you-implement-accessible-linear-design-across-light-and-dark-modes/).

### 3.4 Synthwave / Tron / Neon mode — the cool secondary theme

For a "pioneer" feel a synthwave / Tron-inspired alt-theme is the right secondary palette. Confirmed working in modern Chromium-Electron:

- **The Gridcn** is a shadcn/ui port specifically themed Tron-style — 50+ components with authentic neon glows, scanlines, HUD elements. Uses modern `oklch()` colors. Six Greek-god-themed palettes.
- **SynthWave '84** for VS Code added the glow effect with no external extensions as of v0.1.0 — proves that hard-glowing text is doable purely with CSS `text-shadow`.
- **Neonrender / Neon Dreams** — a terminal renderer that paints CLI output with synthwave gradient color (magenta → cyan).

Glow recipes:

```css
.vault-title--neon {
  color: #FF71CE;
  text-shadow:
    0 0 4px #FF71CE,
    0 0 11px #FF71CE,
    0 0 19px #FF71CE,
    0 0 40px #B967FF,
    0 0 80px #B967FF;
}

.scanline-overlay::before {
  content: "";
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 2px,
      rgba(255, 255, 255, 0.025) 2px,
      rgba(255, 255, 255, 0.025) 3px
    );
  pointer-events: none;
}
```

**Sources used.** [The Gridcn](https://thegridcn.com/), [synthwave-vscode](https://github.com/robb0wen/synthwave-vscode), [tron-vscode](https://github.com/gsmith077/tron-vscode), [Tron Legacy Theme](https://vscodethemes.com/e/DigitalSanctuary.tron-legacy-theme/tron-legacy-theme-light), [Neon Dreams: terminal renderer (Zak El Fassi)](https://zakelfassi.com/neon-dreams-terminal-glow-repository-story).

### 3.5 Fonts — the 2026 typography landscape

Five fonts dominate developer terminals in 2026:

1. **Berkeley Mono** (US Graphics Co) — the **most-coveted paid font of 2026**. Squared terminals, "honest mechanical proportions." Works at 13px in a terminal and at 96px on a magazine cover.
2. **JetBrains Mono** — free, 138 ligatures, five weights, true italic, excellent character disambiguation. *The safe default.*
3. **Cascadia Code** (Microsoft, open-source) — two flavors (Code with ligatures, Mono without), compact proportions, optional cursive italic. Default in Windows Terminal.
4. **MonoLisa** — paid (€59 personal). Strong, well-documented ligature set.
5. **Fira Code** — the open-source ligature pioneer, still hugely popular.

For EZvibes, **JetBrains Mono** is the right default for the terminal itself (free, ligatures, broad support). **Inter** or **Inter Display** for the chrome / sidebar / vault labels (matching Linear's choice). If we want to flex, ship a one-click Berkeley Mono toggle in settings.

**xterm.js ligature support:** the official `@xterm/addon-ligatures` addon enables ligatures with the WebGL renderer. Worth turning on:

```javascript
import { LigaturesAddon } from '@xterm/addon-ligatures';
const ligatures = new LigaturesAddon();
term.loadAddon(ligatures);
```

**Sources used.** [Best programming fonts 2026 (madegooddesigns)](https://madegooddesigns.com/best-programming-fonts-2026/), [Best monospace fonts 2026 (madegooddesigns)](https://madegooddesigns.com/best-monospace-fonts-2026/), [Best code fonts 2026 (Impex Infotech)](https://impexinfotech.com/blog-post/best-code-fonts-for-developers-and-programmers-in-2026-the-definitive-guide/), [Analysis of 5 monospaced ligature fonts (Better Web Type)](https://betterwebtype.com/5-monospaced-fonts-with-coding-ligatures/), [Best coding fonts 2026 (madegooddesigns)](https://madegooddesigns.com/coding-fonts/), [15 best programming fonts (Kinsta)](https://kinsta.com/blog/best-programming-fonts/).

### 3.6 Motion & micro-interactions

The 2026 consensus is **functional, restrained motion**:

- **Duration:** 180–250ms for most things; 300ms ceiling. Anything longer feels slow.
- **Easing:** `cubic-bezier(0.2, 0, 0, 1)` ("ease-out-quint" feel) for entering, `cubic-bezier(0.4, 0, 1, 1)` for exiting. The Material "standard" easing is `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Compositor-only animation:** stick to `transform` and `opacity`. Never `left`/`top`/`width`/`height`. This keeps 60fps (and 120fps on ProMotion / OLED Windows) without compositor jank.
- **Lift on hover:** `transform: translateY(-2px)` (or `-4px` for stronger), paired with a deepening box-shadow. Standard pattern.
- **Glow-from-zero:** start with a zero-spread transparent shadow and transition to a visible one; avoids the popping artefact of a shadow appearing from nothing.

For the vault, the entry animation should be a slide-in from the right edge:

```css
@keyframes vault-enter {
  from { transform: translateX(8px); opacity: 0; }
  to   { transform: translateX(0);   opacity: 1; }
}

.vault-panel {
  animation: vault-enter 220ms cubic-bezier(0.2, 0, 0, 1);
}

@keyframes vault-card-cascade {
  from { transform: translateY(6px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

.vault-card {
  animation: vault-card-cascade 180ms cubic-bezier(0.2, 0, 0, 1) both;
}

/* stagger via JS or CSS variable */
.vault-card:nth-child(1) { animation-delay: 0ms; }
.vault-card:nth-child(2) { animation-delay: 30ms; }
.vault-card:nth-child(3) { animation-delay: 60ms; }
.vault-card:nth-child(4) { animation-delay: 90ms; }
/* ... cap at ~10 visible cascades, then 0 delay */
```

**Sources used.** [UI Animation Trends 2026 (Ripplix)](https://www.ripplix.com/blog/principles-of-animation-ui-design), [UI animation practical guide 2026 (Ripplix)](https://www.ripplix.com/blog/ui-animation-practical-guide-for-2026), [Web Animation Best Practices (uxderrick gist)](https://gist.github.com/uxderrick/07b81ca63932865ef1a7dc94fbe07838), [Modern Card Hover Animations (DEV)](https://dev.to/kadenwildauer/modern-card-hover-animations-css-and-javascript-3cg3), [CSS Hover Effects 2025 (cssauthor)](https://cssauthor.com/css-hover-effects/), [25 Modern CSS Cards (veebilehed24)](https://veebilehed24.ee/en/blog/css-effects/25-modern-css-cards-for-websites-html-css-examples/), [Shadow transition (cssShowcase)](https://www.cssshowcase.com/snippets/animation/shadow-transition), [Top web design trends 2026 (Figma)](https://www.figma.com/resource-library/web-design-trends/), [10 CSS Card Hover Effect examples (Subframe)](https://www.subframe.com/tips/css-card-hover-effect-examples).

### 3.7 Card UI 2026 — what cards actually look like

The 2026 card-UI rules (synthesized from a dozen design-trend posts):

- **Visual depth and texture comeback** — after years of flat design, layered surfaces, sculpted edges, subtle 3D elements are back.
- **Intentional incompleteness** — "raw, schematic, brutally clear layouts" that don't decorate data. Less is more for technical UIs.
- **Proposal cards / Agentic UX** — cards present AI-generated solutions the user only validates or adjusts. Implication: vault cards should sometimes be auto-generated suggestions ("Save current selection as a new prompt").
- **Hover lift + glow** is the canonical interaction. Glass cards + lift on hover is now expected.
- **Micro-interactions** guide users through complex interfaces — but only when functional.
- **3D-ish tilt** based on cursor position is in fashion for premium / pioneer-feeling interfaces.

**Sources used.** [7 UI Design Trends of 2026 (Tubik)](https://blog.tubikstudio.com/ui-design-trends-2026/), [Mastering Card UI Design Patterns 2026 (Layoutscene)](https://www.layoutscene.com/card-ui-design-patterns-guide-2026/), [10 Card UI Examples That Actually Work 2026 (BricxLabs)](https://bricxlabs.com/blogs/card-ui-design-examples), [UI/UX Trends 2026 (Blog-UX)](https://blog-ux.com/en/ux-ui-trends-2026-the-new-rules-of-design/), [12 UI/UX Design Trends 2026 (Index.dev)](https://www.index.dev/blog/ui-ux-design-trends), [UI trends 2026 (Lummi)](https://www.lummi.ai/blog/ui-trends-2026), [11 essentials 2026 (Promodo)](https://www.promodo.com/blog/key-ux-ui-design-trends), [Ultimate guide to UI Design 2026 (WebDesignerDepot)](https://webdesignerdepot.com/the-ultimate-guide-to-ui-design-in-2026/), [23 UI Design Trends 2026 (Musemind)](https://musemind.agency/blog/ui-design-trends).

### 3.8 ASCII boot sequence / signature splash

This is a pure-flex item, but: GitHub's Copilot CLI shipped a **custom-engineered animated ASCII banner** at launch (Feb 2026 blog post). Multiple terminal ricers ship animated ASCII art on each session open (`ASCII-Art-Splash-Screen`, `nsplash`, `ascii-splash`). EZvibes's vault could ship a small *vault-opening* ASCII animation — a one-second neon glyph that's the difference between "looks like a sidebar" and "looks designed."

**Sources used.** [GitHub Copilot CLI ASCII banner engineering (GitHub Blog)](https://github.blog/engineering/from-pixels-to-characters-the-engineering-behind-github-copilot-clis-animated-ascii-banner/), [reowens/ascii-splash](https://github.com/reowens/ascii-splash), [DanCRichards/ASCII-Art-Splash-Screen](https://github.com/DanCRichards/ASCII-Art-Splash-Screen), [Building Animated ASCII Art in the Terminal](https://medium.com/@PowerUpSkills/building-animated-ascii-art-in-the-terminal-6cb03ab242dc).

---

## 4. The Pioneer-Level Synthesis — A Vault Proposal

Fusing all of the above, here is what would qualify as 2026-pioneer-level for the EZvibes prompt vault. Treat this as a design brief, not a prescriptive implementation.

### 4.1 The architectural primitive — "Vault Block"

Borrow Warp's block model conceptually but stay native to EZvibes. **Introduce a new first-class UI primitive: the Vault Block.** A Vault Block is:

- Pinned to the right edge of a session window (mirroring the existing narration sidebar on the left).
- Width 280–320px, resizable.
- Layered with Mica (parent window) + acrylic-like CSS glass (the block itself).
- Slides in/out with a 220ms ease-out-quint animation.
- Toggled via `Ctrl+Shift+V` (V for Vault). A small **floating-FAB-style trigger** lives in the bottom-right of the terminal pocket when the vault is closed.
- One vault per session window. Bound to the folder.

### 4.2 The folder contract

The vault watches the session window's folder for a configurable list of patterns:

| Pattern | Section in vault | Default color | Tab badge |
|---|---|---|---|
| `*.prompt.md` / `prompts/*.md` | **Prompts** | violet (`#A78BFA`) | — |
| `HANDOFF*.md` / `handoff*.md` | **Hand-offs** | lime (`#84CC16`) | "new since last seen" |
| `CLAUDE.md`, `AGENTS.md`, `MEMORY.md` | **Context** | amber (`#F0B433`) | — |
| `*.md` (everything else) | **Notes** | slate | — |

Live file-watching via **chokidar v5** (ESM-only, requires Node 20+). Auto-refresh on add/change/unlink. **This is the hand-off magic**: when one session writes a `HANDOFF.md`, every other open session window for the same folder sees it appear instantly. *That's the "pioneer" bit Oskari sketched in the Paint mockup.*

### 4.3 The interaction model — one click, three options

A Vault Block card is fundamentally a button. The default action is **paste into the active terminal tab**. But to satisfy "click to paste" without overshooting into "click to fire-and-forget," we ship three modifiers:

| Interaction | Action | Visual feedback |
|---|---|---|
| **Single click on card body** | Paste raw text into active tab via `term.write` (bracketed-paste wrapped). Do **not** append `\r`. | Card flashes amber border; small "pasted" toast bottom-left for 1.2s. |
| **`Shift`-click** | Paste **and** submit (`\r` appended). | Card flashes lime; toast says "submitted." |
| **Right-click → "Send as context"** | Inject into the running agent (e.g. via the `@` mention pattern Warp uses for third-party CLI agents) without putting it on the user-input line. | Inline highlight in the terminal scrollback. |
| **`Cmd/Ctrl`-click on title** | Open the file in the system editor (or an inline magnified preview block). | Magnified preview slides over the terminal for 0.5s before transferring focus. |
| **Drag a card from one vault** | Drop it into another session window's terminal — pastes there. | Drop-shadow ghost while dragging; recipient terminal pulses violet on drop. |

### 4.4 The Card design — what each entry looks like

Each card is a glass tile:

```
┌────────────────────────────────────────┐
│ ╭─╮                                    │
│ │📜│  refactor-react-to-ts.prompt.md   │
│ ╰─╯                                    │
│                                        │
│  Refactor selected file to TypeScript  │  ← description from frontmatter
│  Preserve behavior, add types...       │  ← first 2 lines of body, dimmed
│                                        │
│  ⌥ Args: file, mode    ⏱ 3 days ago    │
└────────────────────────────────────────┘
```

- **Glass background** (`rgba(20, 22, 28, 0.55)` + `backdrop-filter: blur(20px) saturate(140%)`).
- **Lucide icon** in the corner, color-coded by category (Obsidian-style).
- **Bold title** = filename, optionally prettified from frontmatter `title:`.
- **Description** = frontmatter `description:` (one-line, dimmed).
- **Body preview** = first 2 lines of the file content, single-line ellipsized at the card edge, monospace, 60% opacity.
- **Args chip** — if the file contains `{{argument}}` placeholders, a small chip lists them.
- **Mtime** — relative time ("3 days ago"). Live-updating.
- **Hover** = lift 2px + amber border (matches Claude chip color) + 220ms transitions.
- **Active / focused** = violet glow (`box-shadow: 0 0 32px rgba(167, 139, 250, 0.45)`).

### 4.5 Top of the panel — search + filter chips + actions

Above the card list:

- **Fuzzy-search input** — uses `fuse.js` (under 100ms for thousands of entries). Type to filter by title, description, body, tag.
- **Filter chips** — `All`, `Prompts`, `Hand-offs`, `Context`, `Notes`. Click to scope.
- **`+ New` button** — opens a small modal to create a new file in the current folder, with a dropdown to pick the type (becomes the filename prefix and the section).
- **`Sort` toggle** — Recent / Alphabetical / Most-used (recency hash kept in localStorage). 
- **`Pin` indicator** — pinned cards are at the top.

### 4.6 Mid-panel — keyboard navigation

- **`↑` / `↓`** moves selection. Selected card has the violet glow.
- **`Enter`** = paste (same as click).
- **`Shift+Enter`** = paste + submit.
- **`/` or `Ctrl+K`** = focus search input.
- **`j` / `k`** also navigate (vim-style; toggleable).
- **`p` while a card is focused** = pin/unpin.
- **`Esc`** = collapse the panel.

### 4.7 Bottom of the panel — the "Stash" capture

A small input box at the bottom: "Stash text..." 

- Type or paste any text, hit Enter, a new `stash-YYYYMMDD-HHMMSS.md` file is written to the folder.
- **Drag-and-drop a text snippet from anywhere** (including a Claude / Codex terminal block) onto the stash zone → a new file is written.
- This closes the loop: every session can stash, every session can read.

### 4.8 The hand-off badge — the pioneer detail

When a file matching `HANDOFF*.md` appears in the folder while a session window is open (or while EZvibes itself is in the background):

- The tab chip pulses lime for 1.5s, then settles into a steady lime dot in the corner.
- The vault panel, if open, scrolls to the new card and gives it a 3-pulse violet halo.
- A non-blocking toast appears bottom-right of the session window: "`HANDOFF.md` updated by another session. Click to open."
- If EZvibes is in the background, a Windows toast notification fires.

This is what gives the feature its "alive" feel — *the vault becomes a passive radar for cross-session activity*.

### 4.9 The optional "vault block in scrollback" — Warp-style

If we want to push further into pioneer territory, *also* render a record of each paste into the terminal scrollback as a small in-band rich-content card. Click on the card to re-paste. This is exactly Warp's rich-content-block pattern, scaled down. EZvibes's existing `narration` sidebar can hold the same data; this is the additional UI flourish that makes the experience feel block-based even though the underlying terminal is still grid-based.

Implementation sketch: when the vault pastes, also `term.writeln('\x1b[2m─── pasted from vault: refactor-react-to-ts.md ───\x1b[0m')` (dim divider). The renderer treats lines matching that pattern as virtual blocks and overlays a small inline card.

### 4.10 The aesthetic gestalt — what it feels like

- **Background:** Mica on the window. Glass on the vault.
- **Font:** Inter / Inter Display on chrome, JetBrains Mono in the terminal (with ligatures via `@xterm/addon-ligatures`).
- **Colors:** the tinted-zinc palette from §3.3 plus the EZvibes-existing amber and teal accents. The vault adds violet (`#A78BFA`) as the brand color, lime (`#84CC16`) for hand-offs.
- **Motion:** 180–250ms ease-out-quint everywhere. Cascading 30ms-staggered card entrances. Lift + glow on hover. Pulse on update.
- **Sound (optional):** a soft "tick" when a paste happens, a gentle "ding" on hand-off arrival. Off by default.
- **Boot animation:** the first time a vault opens for a folder, render a 1-second ASCII glyph swap (a tiny violet vault icon → expands into the panel). Skip on subsequent opens.

---

## 5. References, Libraries, Code Cheat Sheet

### 5.1 Libraries to evaluate

| Library | Purpose | Notes |
|---|---|---|
| `chokidar@5` | File watching | ESM-only, Node 20+, fastest cross-platform option |
| `fuse.js` | Fuzzy search | Pure JS, zero deps, ideal for under 10k entries |
| `minisearch` | Full-text search | Faster than Fuse for large datasets; ES module |
| `flexsearch` | Full-text search | Fastest at 100k+ documents |
| `marked` | Markdown render | Lightweight, no deps, customizable renderer |
| `gray-matter` | YAML frontmatter parse | Standard for `.prompt.md` frontmatter |
| `@xterm/addon-ligatures` | Ligature support | Works with WebGL renderer |
| `@xterm/addon-webgl` | GPU rendering | Use over canvas renderer for performance |
| `@xterm/addon-search` | Scrollback search overlay | For the eventual "search vault + scrollback" feature |
| `glasstron` | Cross-platform glass | Wraps BrowserWindow with composition effects |
| `electron-acrylic-window` | Win-only acrylic | Drop-in for Mica/Acrylic on Win10/11 |
| `lucide` | Icons | The 2026 default icon library (forked from Feather) |

### 5.2 The bracketed-paste injection pattern

When pasting markdown into the terminal, wrap it so the shell knows it's a paste and doesn't auto-execute multi-line content:

```javascript
function pasteIntoActiveTab(text, { submit = false } = {}) {
  const tab = state.activeTab();
  if (!tab) return;
  // Bracketed-paste start
  tab.pty.write('\x1b[200~');
  tab.pty.write(text);
  // Bracketed-paste end
  tab.pty.write('\x1b[201~');
  if (submit) tab.pty.write('\r');
}
```

This pairs cleanly with **xterm.js's `ignoreBracketedPasteMode: false`** (the default) and the **`safe-paste` oh-my-zsh plugin** so that multi-line content arrives as a single editable command, not as a sequence of run-immediately lines. Required reading: [xterm.js PR #1097 — bracketed paste mode](https://github.com/xtermjs/xterm.js/pull/1097), [xterm.js Issue #1122](https://github.com/xtermjs/xterm.js/issues/1122).

### 5.3 The Electron 33 BrowserWindow setup for glass on Windows 11

```javascript
const win = new BrowserWindow({
  width: 1280, height: 800,
  frame: false,
  transparent: true,                 // required for true blend
  backgroundMaterial: 'mica',        // 'mica' | 'acrylic' | 'tabbed' | 'auto'
  vibrancy: 'sidebar',               // macOS only — 'sidebar' is the best match
  visualEffectState: 'active',
  webPreferences: { preload, contextIsolation: true, sandbox: false }
});

// If material disappears on Win11 maximize/restore (known bug), reapply on event:
win.on('maximize', () => win.setBackgroundMaterial('mica'));
win.on('unmaximize', () => win.setBackgroundMaterial('mica'));
```

### 5.4 Full sources index

A consolidated list of every URL used in this report:

**Terminals**

- Warp: [block-basics](https://docs.warp.dev/terminal/blocks/block-basics/), [block-actions](https://docs.warp.dev/terminal/blocks/block-actions/), [block-model blog](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment), [modern terminal](https://www.warp.dev/modern-terminal), [how Warp works](https://www.warp.dev/blog/how-warp-works), [Warp 2026 changelog](https://docs.warp.dev/changelog/2026/), [vertical tabs](https://docs.warp.dev/terminal/windows/vertical-tabs/), [configurable toolbar](https://docs.warp.dev/terminal/windows/configurable-toolbar/), [windows and tabs](https://docs.warp.dev/terminal/windows/), [command palette](https://docs.warp.dev/terminal/command-palette/), [Warp 2026 first-person guide](https://thelinuxcode.com/warp-terminal-in-2026-a-first-person-guide-to-fast-ai-first-command-work/), [DeployHQ Warp 2026 guide](https://www.deployhq.com/guides/warp), [AI Tools DevPro guide](https://aitoolsdevpro.com/ai-tools/warp-guide/), [Warp AI Terminal 2026 (DigitalApplied)](https://www.digitalapplied.com/blog/warp-ai-terminal-agentic-cli-workflows-guide), [Warp - intelligent AI terminal (KDnuggets)](https://www.kdnuggets.com/warp-the-intelligent-ai-powered-terminal), [Warp design analysis (getdesign.md)](https://getdesign.md/warp/design-md), [How Warp Uses Warp](https://www.warp.dev/blog/how-warp-uses-warp).
- Warp Drive: [overview](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/), [prompts](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/prompts/), [workflows](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/workflows/), [notebooks](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/notebooks/), [Drive landing page](https://www.warp.dev/warp-drive), [Introducing Notebooks blog](https://www.warp.dev/blog/notebooks-in-warp-drive), [Warp AI landing](https://www.warp.dev/ai), [Warp AI features](https://www.warp.dev/warp-ai), [agents docs](https://docs.warp.dev/agents/using-agents), [all features](https://www.warp.dev/all-features), [Master Workflows (Toolify)](https://www.toolify.ai/ai-news/master-commands-with-warp-workflows-385229), [MeshWorld cheatsheet](https://meshworld.in/blog/cheatsheets/warp-terminal-cheatsheet/), [Cheatography Warp](https://cheatography.com/mrbeverage/cheat-sheets/warp-console/).
- Wave: [GitHub](https://github.com/wavetermdev/waveterm), [release notes](https://docs.waveterm.dev/releasenotes), [LinkedIn](https://www.linkedin.com/company/wavetermdev), [BrightCoding review](https://www.blog.brightcoding.dev/2025/09/13/wave-terminal-the-open-source-terminal-that-blends-command-line-power-with-modern-visual-tools), [TrishTech review](https://www.trishtech.com/2025/03/wave-terminal-a-modern-ai-powered-command-line-tool/), [Apidog write-up](https://apidog.com/blog/wave-open-source-terminal-wave/), [UnderCode review](https://undercodenews.com/wave-terminal-review-why-this-ai-powered-terminal-is-becoming-the-new-developer-favorite/).
- Ghostty: [About](https://ghostty.org/docs/about), [GitHub](https://github.com/ghostty-org/ghostty), [Hashimoto blog: Ghostty + Zig](https://mitchellh.com/writing/ghostty-and-useful-zig-patterns), [Hashimoto: Ghostty 1.0 is coming](https://mitchellh.com/writing/ghostty-is-coming), [Hashimoto: Libghostty is coming](https://mitchellh.com/writing/libghostty-is-coming), [Trove interview](https://terminaltrove.com/blog/terminal-trove-talks-with-mitchell-hashimoto-ghostty/), [THE.Hosting review](https://the.hosting/en/help/review-of-the-ghostty-terminal-application), [Calmops Ghostty Zig](https://calmops.com/programming/ghostty-terminal-zig/), [Ghostty 1.0 (Dan Sasser)](https://dansasser.me/posts/ghostty-1-0-a-terminal-emulator-built-for-speed-features-and-native-integration/), [Ghostty for AmazingRDP](https://amazingrdp.com/2025/01/why-ghostty-is-the-ultimate-open-source-terminal/), [Ghostty discussion 3708](https://github.com/ghostty-org/ghostty/discussions/3708).
- WezTerm: [home](https://wezterm.org/index.html), [features](https://wezterm.org/features.html), [scrollback](https://wezterm.org/scrollback.html), [multiplexing](https://wezterm.org/multiplexing.html), [changelog](https://wezterm.org/changelog.html), [WezTerm.com](https://wezterm.com/), [GPU-accelerated emulator (MakeUseOf)](https://www.makeuseof.com/i-replaced-windows-terminal-with-this-gpu-accelerated-emulator/), [Alex Plescan: I really like WezTerm](https://alexplescan.com/posts/2024/08/10/wezterm/), [Terminal Guide WezTerm](https://www.terminal.guide/tools/terminal-emulator/wezterm/).
- Hyper: [hyper.is](https://hyper.is/), [awesome-hyper](https://github.com/bnb/awesome-hyper), [Hyper PLUGINS.md](https://github.com/vercel/hyper/blob/canary/PLUGINS.md), [Hyper architecture (ReadOSS)](https://readoss.com/en/vercel/hyper/hypers-architecture-navigating-electron-terminal-emulator-codebase), [Hyper a beautiful terminal (Medium)](https://medium.com/@radityasurya/hyper-a-beautiful-terminal-8edb6f822732), [Terminal.guide Hyper](https://www.terminal.guide/tools/terminal-emulator/hyper/), [DEV: Supercharge Hyper](https://dev.to/abhijith_p_subash/supercharge-your-hyper-terminal-must-have-plugins-tips-tricks-3pmj), [Third and Grove Hyper review](https://www.thirdandgrove.com/hyper-terminal-thats-worth-look), [Hyper open source (Our Code World)](https://ourcodeworld.com/articles/read/529/hyper-an-open-source-terminal-built-on-web-technologies), [Hyper terminal emulator (trmn.sh)](https://www.trmn.sh/terminals/hyper).
- Tabby: [Eugeny/tabby](https://github.com/Eugeny/tabby), [tabby releases](https://github.com/Eugeny/tabby/releases), [tabby.sh](https://tabby.sh/), [HACKING.md](https://github.com/Eugeny/tabby/blob/master/HACKING.md), [Tabby Issue #6164](https://github.com/Eugeny/tabby/issues/6164), [DeepWiki Tabby theming](https://deepwiki.com/Eugeny/tabby/5.4-appearance-and-theming), [Morrolinux Tabby (LPI)](https://www.lpi.org/blog/2025/03/19/morrolinux-tabby-your-friendly-foss-neighborhood-terminal/), [Tabby Command class docs](https://docs.tabby.sh/classes/Command.html).
- cmux / wmux: [cmux vs tmux](https://soloterm.com/cmux-vs-tmux), [wmux GitHub](https://github.com/amirlehmam/wmux).
- Windows Terminal: [MS Learn themes](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/themes), [MS Learn profile appearance](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/profile-appearance), [HowToGeek: dull Windows Terminal](https://www.howtogeek.com/the-windows-terminal-looks-dull-so-i-made-it-look-cool/), [Zimmergren transparent bg](https://zimmergren.net/enable-transparent-background-in-windows-terminal/), [TheWindowsClub transparent](https://www.thewindowsclub.com/how-to-enable-transparent-background-in-windows-terminal), [Pureinfotech transparent](https://pureinfotech.com/enable-transparent-background-windows-terminal/), [Mattgadient macOS themes](https://mattgadient.com/once-again-macos-themes-for-the-windows-terminal/).

**Prompt files & related ecosystem**

- VS Code prompt files: [docs](https://code.visualstudio.com/docs/copilot/customization/prompt-files), [docs source](https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/customization/prompt-files.md), [Copilot customization overview](https://code.visualstudio.com/docs/copilot/customization/overview), [GitHub Docs first prompt file](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files/your-first-prompt-file), [Custom instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions), [.NET Blog](https://devblogs.microsoft.com/dotnet/prompt-files-and-instructions-files-explained/), [Visual Studio Blog](https://devblogs.microsoft.com/visualstudio/boost-your-copilot-collaboration-with-reusable-prompt-files/), [Supercharge VS Code (DEV)](https://dev.to/pwd9000/supercharge-vscode-github-copilot-using-instructions-and-prompt-files-2p5e), [Dario's learning journey](https://darioairoldi.github.io/Learn/03.00-tech/05.02-prompt-engineering/02-getting-started/01.00-how_github_copilot_uses_markdown_and_prompt_folders.html), [Copilot That Jawn](https://copilotthatjawn.com/tips/copilot-instructions-prompt-files.md).
- Cursor: [Cursor 2.0 (CometAPI)](https://www.cometapi.com/cursor-2-0-what-changed-and-why-it-matters/), [Cursor third era (aitrending)](https://aitrending.live/blog/cursor-3-composer-2-agent-first-coding-environment), [Cursor SDK (DevOps.com)](https://devops.com/cursors-new-sdk-turns-ai-coding-agents-into-deployable-infrastructure/), [Cursor 2.0 (Codecademy)](https://www.codecademy.com/article/cursor-2-0-new-ai-model-explained), [Parallel AI Agents in Cursor 2.0 (Medium)](https://medium.com/towards-data-engineering/parallel-ai-agents-in-cursor-2-0-a-practical-guide-e808f89cffb9), [Cursor 2.0 Agent-First architecture](https://www.digitalapplied.com/blog/cursor-2-0-agent-first-architecture-guide), [Cursor Composer 2.5 (DEV)](https://dev.to/om_shree_0709/cursor-just-released-composer-25-heres-what-actually-changed-for-ai-coding-agents-51fc), [Cursor CLI (Peerlist)](https://peerlist.io/crisesarmiento/articles/cursor-cli-the-terminal-agent-thats-straightup-changing-how-), [Mastering Cursor (slava-kudzinau)](https://github.com/slava-kudzinau/cursor-guide), [Tech Insider Cursor 2026](https://tech-insider.org/cursor-tutorial-ai-code-editor-2026/), [Vibe coding Cursor Composer](https://vibecoding.app/blog/mastering-cursor-composer), [Cursor 2026 guide (AICC)](https://www.ai.cc/blogs/how-to-use-cursor-ai-2026-beginner-to-pro-guide/), [Cursor 2026 (DeployHQ)](https://www.deployhq.com/guides/cursor), [Cursor IDE 2026 (TechJack)](https://techjacksolutions.com/ai/ai-development/cursor-ide-what-it-is/), [Cursor AI tips](https://github.com/murataslan1/cursor-ai-tips), [Cursor 2026 guide (Petronella)](https://petronellatech.com/blog/cursor-ai-ide-setup-guide), [Cursor AI agents guide (apidog)](https://apidog.com/blog/cursor-ai-agents/).
- Claude Code: [Subagents docs](https://code.claude.com/docs/en/sub-agents), [Claude Code commands cheat sheet](https://www.scriptbyai.com/claude-code-commands-cheat-sheet/), [Alexi Taylor cheat sheet](https://alexitaylor.com/blog/claude-code-cheatsheet/), [Claude Code commands (Gradually)](https://www.gradually.ai/en/claude-code-commands/), [CodeSignal custom slash commands](https://codesignal.com/learn/courses/customizing-claude-code-for-reusable-visualization-workflows/lessons/creating-custom-slash-commands), [SmartScope Claude reference](https://smartscope.blog/en/generative-ai/claude/claude-code-reference-guide/), [Agent SDK slash commands](https://code.claude.com/docs/en/agent-sdk/slash-commands), [danielrosehill slash commands](https://github.com/danielrosehill/Claude-Slash-Commands), [Claude Code cheat sheet 2026 (claudedirectory)](https://www.claudedirectory.org/blog/claude-code-cheat-sheet), [Learnia slash commands](https://learn-prompting.fr/blog/claude-code-slash-commands-reference), [Ultimate guide to Claude CLI](https://skywork.ai/skypage/en/claude-cli-slash-commands/2044677663294705664), [Multi-agent patterns blog](https://claude.com/blog/multi-agent-coordination-patterns), [Tuning Claude Code (Medium)](https://medium.com/data-science-collective/i-spent-6-months-tuning-claude-code-heres-the-exact-setup-that-finally-worked-b41c67628478), [Token-saving guide (knightli)](https://knightli.com/en/2026/05/18/claude-code-prompt-cache-token-optimization/), [Subagents lose CLAUDE.md (Issue #40459)](https://github.com/anthropics/claude-code/issues/40459), [claude-howto memory](https://github.com/luongnv89/claude-howto/blob/main/02-memory/README.md), [Inside Claude Code system prompt](https://www.claudecodecamp.com/p/inside-claude-code-s-system-prompt), [Inside Claude Code architecture (Penligent)](https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/), [How prompt caching works](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code), [Hindsight: Subagents don't share what they learn](https://hindsight.vectorize.io/blog/2026/05/06/claude-code-subagents-shared-memory), [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts), [Simon Willison parallel agents](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/), [am-will/swarms](https://github.com/am-will/swarms), [Claude Code workflow patterns (MindStudio)](https://www.mindstudio.ai/blog/claude-code-agentic-workflow-patterns), [My Claude Code Setup](https://psantanna.com/claude-code-my-workflow/workflow-guide.html), [Claude Code Agent View (BuildFastWithAI)](https://www.buildfastwithai.com/blogs/claude-code-agent-view-guide).
- Raycast: [Snippets manual](https://manual.raycast.com/snippets), [Quicklinks manual](https://manual.raycast.com/quicklinks), [Quicklinks landing](https://www.raycast.com/core-features/quicklinks), [Quicklinks Windows](https://manual.raycast.com/windows/quicklinks), [The new Raycast](https://www.raycast.com/blog/the-new-raycast), [Raycast for Mac v2](https://manual.raycast.com/new-in-v2), [VSCode for Raycast](https://www.raycast.com/thomas/visual-studio-code), [Raycast 2026 updates](https://raycast-discount-code.com/blog/raycast-2026-updates), [Raycast Windows](https://raycast-discount-code.com/blog/raycast-windows), [Raycast Windows alternatives](https://raycast-discount-code.com/blog/raycast-windows-alternatives), [Raycast in 2026 (DEV)](https://dev.to/dharanidharan_d_tech/raycast-in-2026-the-mac-launcher-that-replaced-4-apps-in-my-dev-workflow-3pka), [Raycast review 2026](https://devtoolsreviewed.com/raycast-review/), [Raycast on Windows (Windows Forum)](https://windowsforum.com/threads/raycast-on-windows-a-keyboard-first-command-palette-for-fast-actions.395552/), [Keyboard Shortcut Sequences for Raycast](https://www.raycast.com/HelloImSteven/keyboard-shortcut-sequences).
- Obsidian: [Sidebar help](https://help.obsidian.md/User+interface/Sidebar), [Obsidian Stats sidebar](https://www.obsidianstats.com/tags/sidebar), [Mobile Sidebar Notes](https://www.obsidianstats.com/plugins/mobile-sidebar-notes), [Custom Sidebar Icons](https://www.obsidianstats.com/plugins/custom-sidebar-icons), [Custom viewer UI for md (Obsidian Forum)](https://forum.obsidian.md/t/custom-viewer-ui-for-certain-markdown-files/108104), [Fork My Brain UI](https://notes.nicolevanderhoeven.com/obsidian-playbook/Using+Obsidian/01+First+steps+with+Obsidian/The+Obsidian+UI+and+settings), [Simple Side Notes](https://forum.obsidian.md/t/simple-side-notes/109043), [Fleeting Notes new UI](https://www.fleetingnotes.app/newsletters/2023-02-02), [Knowledge workflow 2026 updates (Polgar)](https://polgarp.com/blog/Knowledge-workflow-2026-updates/).
- Open prompt vaults: [bharathkumar-12 prompt-vault](https://github.com/bharathkumar-12/prompt-vault), [w512 Prompt-Vault](https://github.com/w512/Prompt-Vault), [MrXie23 PromptLibrary](https://github.com/MrXie23/PromptLibrary), [PromptVault Chrome ext](https://chromewebstore.google.com/detail/prompt-vault/ojlamjfhdbmifmgeepgbjcfbfgjfbimd), [PromptVault AI Chrome](https://chromewebstore.google.com/detail/promptvault-ai-prompt-lib/dnedgbcncppfkealibjjfjjiiinhmiag), [Vault iOS app](https://apps.apple.com/us/app/vault-ai-prompt-library/id6745626357), [ZeroGrav Prompt Vault](https://zerograv.dev/), [promptvault demo](https://prompt-vault-app.vercel.app/), [prompts.chat](https://prompts.chat/), [BrightCoding prompts.chat](https://www.blog.brightcoding.dev/2026/04/10/promptschat-the-revolutionary-ai-prompt-library-every-developer-needs), [GitHub topic image-prompts](https://github.com/topics/image-prompts), [Knowledge Vault Devpost](https://devpost.com/software/knowledge-vault), [Vault knowledge base 2026](https://www.blog-des-telecoms.com/en/blog/vault-knowledge-base-7-decisions/), [Best prompt libraries (Pinggy)](https://pinggy.io/blog/best_prompt_libraries_for_ai_assisted_software_development/), [Best prompt libraries (DEV)](https://dev.to/lightningdev123/best-prompt-libraries-developers-actually-use-in-2026-2fo6), [AI UI prompts (0xminds)](https://0xminds.com/blog/guides/ai-prompt-templates-complete-collection), [Claude prompts for design (AI Academy)](https://academy.techpresso.co/prompts/claude-prompts-design).
- Zed: [command palette](https://zed.dev/docs/command-palette), [agent panel](https://zed.dev/docs/ai/agent-panel), [inline assistant](https://zed.dev/docs/ai/inline-assistant), [agent settings](https://zed.dev/docs/ai/agent-settings), [getting started](https://zed.dev/docs/getting-started), [features](https://zed.dev/features), [Zed release notes (Releasebot)](https://releasebot.io/updates/zed), [Zed Hub agent panel](https://zedhub.dev/ai/agent-panel), [Zed setup 2026 (Petronella)](https://petronellatech.com/blog/zed-editor-setup-guide-2026).

**Aesthetics, motion, colors, fonts**

- Liquid Glass: [Apple newsroom announcement](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/), [Apple Developer Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass), [Apple Developer new design gallery](https://developer.apple.com/design/new-design-gallery-2026/), [Liquid Glass UI 2026 (Medium)](https://medium.com/@expertappdevs/liquid-glass-2026-apples-new-design-language-6a709e49ca8b), [macOS Tahoe apps (OpenMark)](https://openmarkapp.com/blog/macos-tahoe-apps-liquid-glass), [macOS Tahoe (MacRumors)](https://www.macrumors.com/roundup/macos-26/), [Liquid Glass best practices (DEV)](https://dev.to/diskcleankit/liquid-glass-in-swift-official-best-practices-for-ios-26-macos-tahoe-1coo), [Folder IT designer notes](https://folderit.net/apples-liquid-glass-ui-what-designers-need-to-know-now/), [GETTR adoption](https://macdailynews.com/2026/04/27/gettr-adopts-apples-liquid-glass-design-language-across-ios-ipados-and-macos/), [Blurry or Beautiful (MacSales)](https://eshop.macsales.com/blog/97650-blurry-or-beautiful-the-tweaks-and-tenets-of-apples-controversial-liquid-glass-design-in-macos-tahoe/), [MacRumors Forum reaction](https://forums.macrumors.com/threads/macos-tahoe-brings-a-pleasant-design-refresh-with-liquid-glass-and-great-new-features.2477300/), [Project Wizards Tahoe tips](https://www.projectwizards.net/en/blog/2025/09/macos26-ios26-tips), [macos-tahoe React guide](https://macos-tahoe.com/blog/liquid-glass-react-implementation-guide/), [Apple design resources update (AppleInsider)](https://appleinsider.com/articles/25/06/11/apple-design-resources-update-helps-developer-make-liquid-glass-apps-for-ios-26-macos-tahoe), [macOS Tahoe complete guide 2025](https://macos-tahoe.com/blog/macos-tahoe-complete-guide-2025/), [Apple Liquid Glass CSS examples (grusz.dev)](https://blog.grusz.dev/apples-liquid-glass-glassmorphism-is-shaping-ui-design-in-2025-with-css-code-examples).
- Glassmorphism: [Code Formatter generator](https://www.codeformatter.in/blog-glassmorphism-generator.html), [FreeFrontend 69 examples](https://freefrontend.com/css-glassmorphism/), [DEV: glassmorphism with backdrop-filter](https://dev.to/nickbenksim/glassmorphism-effect-with-backdrop-filter-16jh), [Glassmorphism 2.0 (WebLogTrips)](https://weblogtrips.com/technology/glassmorphism-2-0-css-techniques-2026/), [TestMu intuitive guide](https://www.testmuai.com/blog/css-glassmorphism/), [Glassmorphism templates 2026 (DEV)](https://dev.to/imran_khan_a3cc224344dbcf/glassmorphism-ui-template-complete-guide-free-downloads-2026-5c80), [CSS-Zone backdrop-filter](https://css-zone.com/blog/backdrop-filter-glass-morphism), [Inverness Design Studio](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026), [StudioLimb tutorial](https://www.studiolimb.com/guides/glassmorphism-css-tutorial.html), [Intellure guide](https://intellure.co/blog/glassmorphism-guide).
- Electron glass libs: [glasstron](https://www.npmjs.com/package/glasstron), [electron-acrylic-window](https://www.npmjs.com/package/electron-acrylic-window), [pykeio/vibe](https://github.com/pykeio/vibe), [Implementing Win11 Mica & Acrylic](https://coldfusion-example.blogspot.com/2025/12/implementing-windows-11-mica-acrylic.html), [Codestudy: blur Electron BrowserWindow](https://www.codestudy.net/blog/how-do-i-blur-an-electron-browserwindow-with-transparency/), [Electron Issue #29937 Mica](https://github.com/electron/electron/issues/29937), [Electron Issue #46753 material maximize](https://github.com/electron/electron/issues/46753), [Electron Issue #48031 backgroundMaterial](https://github.com/electron/electron/issues/48031), [Electron Issue #38532 full frame Mica](https://github.com/electron/electron/issues/38532), [Electron Issue #42393 maximized window](https://github.com/electron/electron/issues/42393), [Electron PR #38163 Mica/Acrylic support](https://github.com/electron/electron/pull/38163/files), [Electron BaseWindow](https://www.electronjs.org/docs/latest/api/base-window), [Electron BaseWindow constructor options](https://www.electronjs.org/docs/latest/api/structures/base-window-options), [Microsoft Learn Mica](https://learn.microsoft.com/en-us/windows/apps/design/style/mica), [Microsoft Learn Acrylic](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic), [Microsoft Learn Materials](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials), [MicaMaterial Wiki](https://github.com/Leghari-K/MicaMaterial/wiki/Windows-11-Mica-Material), [Chrome Mica makeover](https://www.windowslatest.com/2025/10/26/chrome-for-windows-11-is-still-getting-a-mica-design-makeover-hopefully/).
- Color systems: [Linear redesign part II](https://linear.app/now/how-we-redesigned-the-linear-ui), [Linear calmer interface](https://linear.app/now/behind-the-latest-design-refresh), [Recursion modern color palette](https://recursion.software/blog/ui-color-trends-2026), [Muzli dark mode systems guide](https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/), [NateBal dark mode best practices](https://natebal.com/best-practices-for-dark-mode/), [Updivision UI Color Trends](https://updivision.com/blog/post/ui-color-trends-to-watch-in-2026), [Muzli 60+ dark mode inspiration](https://muz.li/inspiration/dark-mode/), [Vosidiy dark mode UI](https://medium.com/design-bootcamp/dark-mode-ui-design-organizing-color-variables-and-naming-df3fa005ae77), [LogRocket accessible Linear design](https://blog.logrocket.com/how-do-you-implement-accessible-linear-design-across-light-and-dark-modes/), [AdminLTE schemes guide](https://adminlte.io/blog/best-admin-dashboard-color-schemes/).
- Fonts: [Best programming fonts 2026](https://madegooddesigns.com/best-programming-fonts-2026/), [Best monospace fonts 2026](https://madegooddesigns.com/best-monospace-fonts-2026/), [Best code fonts 2026 (Impex)](https://impexinfotech.com/blog-post/best-code-fonts-for-developers-and-programmers-in-2026-the-definitive-guide/), [Better Web Type analysis](https://betterwebtype.com/5-monospaced-fonts-with-coding-ligatures/), [Coding fonts 2026 (madegooddesigns)](https://madegooddesigns.com/coding-fonts/), [DEV: top 5 fonts](https://dev.to/paulhalliday/my-favourite-top-5-programming-fonts-30e0), [Kinsta 15 best programming fonts](https://kinsta.com/blog/best-programming-fonts/).
- Motion / cards: [UI animation trends 2026 (Ripplix)](https://www.ripplix.com/blog/principles-of-animation-ui-design), [UI animation practical guide (Ripplix)](https://www.ripplix.com/blog/ui-animation-practical-guide-for-2026), [uxderrick web animation gist](https://gist.github.com/uxderrick/07b81ca63932865ef1a7dc94fbe07838), [DEV modern card hover](https://dev.to/kadenwildauer/modern-card-hover-animations-css-and-javascript-3cg3), [Medium modern card hover](https://medium.com/@serkadenwildauer/modern-card-hover-animations-css-and-javascript-b3a358e54d49), [CSS author hover effects](https://cssauthor.com/css-hover-effects/), [WPDean 40 card hover effects](https://wpdean.com/css-card-hover-effects/), [FreeFrontend 43 card hover](https://freefrontend.com/css-card-hover-effects/), [Veebilehed24 25 modern cards](https://veebilehed24.ee/en/blog/css-effects/25-modern-css-cards-for-websites-html-css-examples/), [Subframe 10 hover effects](https://www.subframe.com/tips/css-card-hover-effect-examples), [Quackit hover card template](https://www.quackit.com/html/templates/cards/card_with_hover_effects.cfm), [Shadow transition cssShowcase](https://www.cssshowcase.com/snippets/animation/shadow-transition), [uicookies card flip 2026](https://uicookies.com/css-card-flip/), [CodeMyUI profile card](https://gist.github.com/CodeMyUI/c279708aaddac154284d), [Figma 2026 web design trends](https://www.figma.com/resource-library/web-design-trends/), [Elementor 2026 design trends](https://elementor.com/blog/web-design-trends-2026/), [Layout Scene card UI 2026](https://www.layoutscene.com/card-ui-design-patterns-guide-2026/), [Bricx Labs 10 card UI examples](https://bricxlabs.com/blogs/card-ui-design-examples), [Blog-UX 2026 trends](https://blog-ux.com/en/ux-ui-trends-2026-the-new-rules-of-design/), [Index.dev 12 trends](https://www.index.dev/blog/ui-ux-design-trends), [Lummi UI trends](https://www.lummi.ai/blog/ui-trends-2026), [Promodo 11 essentials](https://www.promodo.com/blog/key-ux-ui-design-trends), [Webdesignerdepot 2026 ultimate guide](https://webdesignerdepot.com/the-ultimate-guide-to-ui-design-in-2026/), [Punit Chawla 2026 trends (Muzli)](https://medium.muz.li/ux-ui-design-trends-for-2026-from-ai-to-xr-to-vibe-creation-7c5f8e35dc1d), [Musemind 23 trends](https://musemind.agency/blog/ui-design-trends), [Tubik 7 UI design trends](https://blog.tubikstudio.com/ui-design-trends-2026/).
- Synthwave / Tron: [The Gridcn](https://thegridcn.com/), [Synthwave VSCode (robb0wen)](https://github.com/robb0wen/synthwave-vscode), [Synthwave legacy README](https://github.com/robb0wen/synthwave-vscode/blob/master/README_LEGACY.md), [Tron VSCode (gsmith077)](https://github.com/gsmith077/tron-vscode), [Tron Legacy Theme](https://vscodethemes.com/e/DigitalSanctuary.tron-legacy-theme/tron-legacy-theme-light), [Neon Dreams (Zak El Fassi)](https://zakelfassi.com/neon-dreams-terminal-glow-repository-story), [Synthwave 84 YouTube demo](https://www.youtube.com/watch?v=UUSg75ksTXI), [All Utility CSS Gridcn](https://allutilitycss.com/components/the-gridcn/).
- ASCII art: [GitHub Copilot CLI banner engineering](https://github.blog/engineering/from-pixels-to-characters-the-engineering-behind-github-copilot-clis-animated-ascii-banner/), [reowens ascii-splash](https://github.com/reowens/ascii-splash), [DanCRichards splash](https://github.com/DanCRichards/ASCII-Art-Splash-Screen), [m4ch1n4 splash](https://github.com/m4ch1n4/ASCII-Art-Splash-Screen), [nickarchive nsplash](https://github.com/nickarchive/nsplash), [Building animated ASCII (Medium)](https://medium.com/@PowerUpSkills/building-animated-ascii-art-in-the-terminal-6cb03ab242dc), [DIY ASCII splash (Arch Linux)](https://bbs.archlinux.org/viewtopic.php?id=130084), [Dewbase ASCII art tool](https://dewbase.com/tools/ascii-art/).
- eDEX-UI: [eDEX-UI GitHub](https://github.com/GitSquared/edex-ui), [Terminals are sexy](https://github.com/k4m4/terminals-are-sexy), [Terminal ricing for AI (MOLTamp)](https://moltamp.com/blog/terminal-ricing-for-ai-developers/).

**Implementation building blocks**

- xterm.js: [official site](https://xtermjs.org/), [GitHub](https://github.com/xtermjs/xterm.js), [css dir](https://github.com/xtermjs/xterm.js/tree/master/css), [releases](https://github.com/xtermjs/xterm.js/releases), [Issue #1719 bg color](https://github.com/xtermjs/xterm.js/issues/1719), [Issue #3124 customize input](https://github.com/xtermjs/xterm.js/issues/3124), [ITheme interface](https://xtermjs.org/docs/api/terminal/interfaces/itheme/), [ITerminalOptions](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/), [@industry-theme/xterm-terminal-panel](https://www.npmjs.com/package/@industry-theme/xterm-terminal-panel), [Tabnine code library](https://www.tabnine.com/code/javascript/classes/xterm/Terminal), [PR #1097 bracketed paste](https://github.com/xtermjs/xterm.js/pull/1097), [Issue #1122 bracketed paste](https://github.com/xtermjs/xterm.js/issues/1122), [Commit 1dbcf70 bracketed paste](https://github.com/xtermjs/xterm.js/commit/1dbcf70cee9ae88c69cf9724745cbdb7e5364dcc), [xterm bracketed paste explainer](https://invisible-island.net/xterm/xterm-paste64.html), [VSCode Issue #142525 multi-line paste warning](https://github.com/microsoft/vscode/issues/142525), [zsh-workers bracketed paste discussion](https://zsh-workers.zsh.narkive.com/Kd3evJ7t/bracketed-paste-mode-in-xterm-and-urxvt), [FreeBSD bracketed paste](https://forums.freebsd.org/threads/bracketed-paste.81314/), [eddymens browser terminal](https://www.eddymens.com/blog/creating-a-browser-based-interactive-terminal-using-xtermjs-and-nodejs).
- node-pty: [GitHub](https://github.com/microsoft/node-pty), [npm](https://www.npmjs.com/package/node-pty), [Snyk advisor examples](https://snyk.io/advisor/npm-package/node-pty/example), [Issue #429 sending commands](https://github.com/microsoft/node-pty/issues/429).
- Electron file watching: [Native File Drag & Drop (Electron)](https://www.electronjs.org/docs/latest/tutorial/native-file-drag-drop), [paulmillr/chokidar](https://github.com/paulmillr/chokidar), [Watch files with Electron (Our Code World)](https://ourcodeworld.com/articles/read/160/watch-files-and-directories-with-electron-framework), [Electron Forge WatchOptions](https://js.electronforge.io/interfaces/_electron_forge_plugin_vite.InternalOptions.WatchOptions.html), [@el3um4s/renderer-for-electron-chokidar](https://www.npmjs.com/package/@el3um4s/renderer-for-electron-chokidar), [BezKoder watch folder](https://www.bezkoder.com/node-js-watch-folder-changes/), [Native drag drop docs alt](https://pbelay.github.io/electron/tutorial/native-file-drag-drop.html), [w3cubdocs native drag drop](https://docs.w3cub.com/electron/tutorial/native-file-drag-drop), [electron native drag drop gist](https://gist.github.com/timpulver/452670e4a0ec9619a06347ff61c3f60c).
- Fuzzy search: [Fuse.js](https://www.fusejs.io/), [Fuse.js fuzzy-search docs](https://www.fusejs.io/fuzzy-search.html), [Fuse.js deep dive (DEV)](https://dev.to/koushikmaratha/a-deep-dive-into-fusejs-advanced-use-cases-and-benchmarking-357p), [microfuzz](https://github.com/Nozbe/microfuzz), [npm-compare elasticlunr/flexsearch/fuse/minisearch](https://npm-compare.com/elasticlunr,flexsearch,fuse.js,minisearch), [uFuzzy.js HN](https://news.ycombinator.com/item?id=33035580), [Best search packages (Mattermost)](https://mattermost.com/blog/best-search-packages-for-javascript/).
- Command palette: [Designing a Command Palette (Destiner)](https://destiner.io/blog/post/designing-a-command-palette/), [Command Palette Developer skills (LobeHub)](https://lobehub.com/skills/aaronbassett-paneful-creating-command-palettes), [Command Palette UI Kit (Figma)](https://www.figma.com/community/file/1612991689196679856/command-palette-ui-kit), [stefanjudis awesome-command-palette](https://github.com/stefanjudis/awesome-command-palette), [kaito-http palette](https://github.com/kaito-http/palette), [DEV Electron Adventures 35](https://dev.to/taw/electron-adventures-episode-35-command-palette-h5g), [Tabby Command class docs](https://docs.tabby.sh/classes/Command.html).
- Card components / UI kits: [Shadcn Vaults](https://shadcn-vaults.vercel.app/), [AllShadcn Vaults](https://allshadcn.com/blocks/shadcnui-vaults/), [shadcn/ui](https://ui.shadcn.com/), [shadcn changelog](https://ui.shadcn.com/docs/changelog), [awesome-shadcn-ui](https://github.com/birobirobiro/awesome-shadcn-ui), [Aldhanekaa ShadcnVaults](https://github.com/Aldhanekaa/ShadcnVaults), [Student Rosedale tool vault](https://www.student.rosedale.edu/tool/shadcnui/), [shadcnblockscom UI blocks](https://github.com/shadcnblockscom/shadcn-ui-blocks), [Aceternity Card Stack](https://ui.aceternity.com/components/card-stack), [196 CSS Cards (FreeFrontend)](https://freefrontend.com/css-cards/), [Card Stack UI (Dribbble Korzan)](https://dribbble.com/shots/3553414-Card-Stack-UI), [Dribbble card-stack tag](https://dribbble.com/tags/card-stack), [Dribbble prompt-builder tag](https://dribbble.com/tags/prompt-builder), [Dribbble prompt-builder search](https://dribbble.com/search/prompt-builder), [Twitch preview card animation (Dribbble)](https://dribbble.com/shots/10889678-Preview-Card-Hover-Animation).
- Copy-paste UI patterns: [PatternFly clipboard copy](https://www.patternfly.org/components/clipboard-copy/design-guidelines/), [Carbon code snippet](https://carbondesignsystem.com/components/code-snippet/usage/), [UI-patterns Copy Box](https://ui-patterns.com/patterns/CopyBox), [NN/G UI copy](https://www.nngroup.com/articles/ui-copy/), [Adding clarity (UX Backstage)](https://medium.com/ux-backstage/adding-clarity-by-removing-information-282c778b443a), [PatternFly Drawer](https://www.patternfly.org/components/drawer/design-guidelines/), [MUI React Drawer](https://mui.com/material-ui/react-drawer/), [Mobbin Drawer](https://mobbin.com/glossary/drawer), [Oracle Alta drawer patterns](https://www.oracle.com/webfolder/ux/middleware/alta/patterns/Drawers.html), [Nicelydone drawer examples](https://nicelydone.club/components/side-sheet-drawer), [ui-patterns.com](https://ui-patterns.com/).
- Split panes / file tree: [Ant Design Splitter](https://ant.design/components/splitter/), [npm-compare split-pane/dock/resize](https://npm-compare.com/react-dock,react-resize-panel,react-split-pane), [Syncfusion Angular splitter](https://www.syncfusion.com/angular-components/angular-splitter), [orefalo svelte-splitpanes](https://github.com/orefalo/svelte-splitpanes), [mflorence99 el-file](https://github.com/mflorence99/el-file), [m-Pawlowicz electron-file-tree](https://github.com/m-Pawlowicz/electron-file-tree), [DevTools Daily file tree](https://www.devtoolsdaily.com/blog/file-tree-view-react/), [jojomondag markdown-viewer](https://github.com/jojomondag/Markdown-Viewer), [kazuar markdown app](https://kazuar.github.io/markdown-app/), [MacMD Viewer best md mac apps 2026](https://macmdviewer.com/blog/markdown-viewer-macos), [Freecommander general](https://freecommander.com/fchelpxe/en/General1.html).
- Electron context menu: [Electron Context Menu](https://www.electronjs.org/docs/latest/tutorial/context-menu), [sindresorhus electron-context-menu](https://github.com/sindresorhus/electron-context-menu), [mixmaxhq electron-editor-context-menu](https://github.com/mixmaxhq/electron-editor-context-menu), [VSCode file context (Issue #204354)](https://github.com/microsoft/vscode/issues/204354), [Element-web context menu issue #2958](https://github.com/element-hq/element-web/issues/2958).
- Electron BrowserView/WebContentsView: [BrowserView docs](https://www.electronjs.org/docs/latest/api/browser-view), [WebContentsView migration](https://www.electronjs.org/blog/migrate-to-webcontentsview), [BrowserWindow docs](https://www.electronjs.org/docs/latest/api/browser-window), [WebContentsView Mamezou blog](https://developer.mamezou-tech.com/en/blogs/2024/03/06/electron-webcontentsview/), [WebContentsView app structure](https://developer.mamezou-tech.com/en/blogs/2024/08/28/electron-webcontentsview-app-structure/), [webContents docs](https://www.electronjs.org/docs/latest/api/web-contents), [webContents alt](https://freesoftwaredevlopment.github.io/electron/docs/api/web-contents.html), [BrowserView API source](https://github.com/electron/electron/blob/main/docs/api/browser-view.md), [Ika Building a Browser](https://www.ika.im/posts/building-a-browser-in-electron), [Tutorial first app (Electron)](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app), [Building menu bar (LogRocket)](https://blog.logrocket.com/building-menu-bar-application-electron-react/), [Tray Menu (Electron)](https://www.electronjs.org/docs/latest/tutorial/tray), [Top Electron app examples (Esparkinfo)](https://www.esparkinfo.com/blog/electron-app-examples), [HashiCorp Vault UI tutorial](https://developer.hashicorp.com/vault/tutorials/get-started/learn-ui).
- Markdown / marked: [markedjs/marked](https://github.com/markedjs/marked), [Marked docs](https://marked.js.org/), [Marked using advanced](https://marked.js.org/using_advanced), [marked npm](https://www.npmjs.com/package/marked), [Snyk marked Renderer](https://snyk.io/advisor/npm-package/marked/functions/marked.Renderer), [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown), [Markdown previewer build (Medium)](https://medium.com/@benjaminadk/build-a-markdown-previewer-96af2622dd9a).
- Electron animation: [Smooth animations for browser windows (WebDeveloper)](https://webdeveloper.com/community/398856-can-you-create-smooth-animations-for-browser-windows-in-electron/), [Fade in/out window (Issue #2407)](https://github.com/electron/electron/issues/2407), [Animating BrowserWindow (Medium)](https://wachidmudi.medium.com/electron-js-struggle-c272eef2ea80), [Electron keyboard shortcuts](https://www.electronjs.org/docs/tutorial/keyboard-shortcuts), [Pracucci copy paste](https://pracucci.com/atom-electron-enable-copy-and-paste.html), [Supporting copy & paste (Medium)](https://medium.com/fantageek/supporting-copy-and-paste-in-electron-30bff250e564), [VSCode paste no longer works (Issue #238609)](https://github.com/microsoft/vscode/issues/238609), [Seeed Studio reTerminal UI guide](https://wiki.seeedstudio.com/reTerminal-build-UI-using-Electron/).
- Multi-agent terminal / Cursor SDK / Codex: [Cursor 2.0 new model (CodeAcademy)](https://www.codecademy.com/article/cursor-2-0-new-ai-model-explained), [Cursor SDK (DevOps.com)](https://devops.com/cursors-new-sdk-turns-ai-coding-agents-into-deployable-infrastructure/), [Cursor CLI Peerlist](https://peerlist.io/crisesarmiento/articles/cursor-cli-the-terminal-agent-thats-straightup-changing-how-), [Mastering Cursor Composer 2.5 DEV](https://dev.to/om_shree_0709/cursor-just-released-composer-25-heres-what-actually-changed-for-ai-coding-agents-51fc), [Towards Data Eng parallel agents](https://medium.com/towards-data-engineering/parallel-ai-agents-in-cursor-2-0-a-practical-guide-e808f89cffb9), [Cursor digital applied](https://www.digitalapplied.com/blog/cursor-2-0-agent-first-architecture-guide), [Cursor 3 aitrending](https://aitrending.live/blog/cursor-3-composer-2-agent-first-coding-environment), [cmux soloterm](https://soloterm.com/cmux-vs-tmux).
- Generative UI / chat: [Generative UI frameworks 2026 (Medium)](https://medium.com/@akshaychame2/the-complete-guide-to-generative-ui-frameworks-in-2026-fde71c4fa8cc), [I evaluated every AI chat UI library 2026 (DEV)](https://dev.to/alexander_lukashov/i-evaluated-every-ai-chat-ui-library-in-2026-heres-what-i-found-and-what-i-built-4p10), [Overview UI libs 2026 (Lukashov)](https://alexander-lukashov.medium.com/the-overview-of-ui-libraries-for-ai-chat-interfaces-in-2026-146a1492114a), [9 open-source chatbot frameworks (Fastio)](https://fast.io/resources/best-open-source-ai-chatbot-frameworks/), [Best open-source LLMs (HuggingFace blog)](https://huggingface.co/blog/daya-shankar/open-source-llms), [hashbuilds 252 UI patterns](https://www.hashbuilds.com/patterns), [SaaS UI workflow patterns gist](https://gist.github.com/mpaiva-cc/d4ef3a652872cb5a91aa529db98d62dd).
- Lazygit / Lazydocker (panel-TUI design): [DokaDev lazytui](https://github.com/DokaDev/lazytui), [Craigderington lazyrestic](https://github.com/craigderington/lazyrestic), [Jesse Duffield lazydocker](https://github.com/jesseduffield/lazydocker), [lazydocker.com](https://lazydocker.com/), [X-CMD lazydocker](https://www.x-cmd.com/pkg/lazydocker/), [X-CMD lazygit](https://www.x-cmd.com/pkg/lazygit/), [9 TUI apps so good (Medium)](https://medium.com/the-software-journal/9-tui-apps-so-good-i-stopped-opening-my-browser-a4c622e438c0), [Lazygit ByteSizeGo](https://www.bytesizego.com/blog/lazygit-the-terminal-ui-that-makes-git-actually-usable), [Lazydocker post (Abanoub Hanna)](https://abanoubhanna.com/posts/lazydocker/), [Tired of switching (X-CMD)](https://www.x-cmd.com/install/lazydocker/).
- Misc warp tutorials: [Warp DataCamp tutorial](https://www.datacamp.com/tutorial/warp-terminal-tutorial), [Warp blog](https://www.warp.dev/blog), [Warp terminal](https://www.warp.dev/terminal), [Customizing Warp](https://docs.warp.dev/getting-started/customizing-warp), [Warp Issue #6648 paste screenshots](https://github.com/warpdotdev/Warp/issues/6648), [Warp Issue #2243 block screenshots](https://github.com/warpdotdev/Warp/issues/2243), [Warp Issue #6930 agent-based prompt management](https://github.com/warpdotdev/warp/issues/6930), [Warp Issue #4759 screenshot a block](https://github.com/warpdotdev/Warp/issues/4759), [Warp images as context](https://docs.warp.dev/university/how-warp-uses-warp/using-images-as-context-with-warp), [Warp embracing open source 2026 (The Coders Blog)](https://thecodersblog.com/warp-terminal-goes-open-source-2026/), [Warp 2.0 evolves (SD Times)](https://sdtimes.com/ai/warp-2-0-evolves-its-terminal-experience-into-an-agentic-development-environment/), [DeepWiki Warp AI & agents](https://deepwiki.com/warpdotdev/Warp/4-ai-and-agent-system), [Warp - redefining CLI (Medium)](https://medium.com/@afimaamedufie/warp-redefining-command-line-intelligence-b500e8a6dfdd), [Warp revolutionizing CLI (DEV)](https://dev.to/omriluz1/warp-terminal-revolutionizing-command-line-interfaces-with-modern-ux-and-ai-477p), [Warp tutorial techwithkunal](https://www.techwithkunal.com/blog/warp-terminal), [WARP GeeksForGeeks](https://www.geeksforgeeks.org/data-science/introduction-to-warp/), [Warp Console - Tech Dots](https://www.techdots.dev/blog/how-to-use-warp-ai-terminal-for-developer), [Warp Console mvolkmann](https://mvolkmann.github.io/blog/warp/?v=1.1.1), [Warp inputzen](https://inputzen.com/shortcuts/warp/), [Warp keyboard shortcuts docs alt](https://docs.warp.dev/features/keyboard-shortcuts), [Warp command palette docs alt](https://docs.warp.dev/features/command-palette), [The Data Exchange podcast (Zach Lloyd)](https://thedataexchange.media/warp-zach-lloyd-/), [Warp Drive workflows md mirror](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/workflows.md), [Warp Drive prompts md mirror](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/prompts.md), [Warp getting started](https://docs.warp.dev/), [Warp all settings reference](https://docs.warp.dev/terminal/settings/all-settings/).

---

## 6. One-Paragraph TL;DR for the Orchestrator

The single most-developed prior art is **Warp Drive**, which is functionally the prompt vault Oskari sketched, just built into Warp's own terminal. Its model — a side panel of saved Prompts/Workflows/Notebooks, fuzzy-searchable from the Command Palette, clicked to paste into the active terminal as bracketed-paste keystrokes (never auto-executed), with `{{argument}}` placeholders cycled by `Shift+Tab` — is the safest, best-validated interaction loop to copy. Wave Terminal proves the block-and-widget sidebar pattern works inside Electron with vanilla web tech. **The pioneer-level idea worth chasing** is hand-off as a passive radar: chokidar-watch the folder so when another Claude/Codex session writes `HANDOFF.md` the recipient session's vault scrolls to it and pulses lime *while the user is mid-conversation in a different tab*. That's the moment the vault stops feeling like a file picker and starts feeling like *living mailroom between agents* — exactly the magic Oskari is reaching for in the Paint sketch.
