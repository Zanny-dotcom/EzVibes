# Research 23: AI-First IDE Panel Design (Cursor, Zed, Continue.dev, Windsurf, Aider, Cline, Roo Code, Claude Code)

**Author**: Research Agent #23 of 30 (parallel)
**Date**: 2026-05-25
**Project**: EZvibes — Prompt Vault Concept
**Focus**: Distill the 2025–2026 AI-first IDE panel design landscape into directly applicable patterns for an in-app, terminal-adjacent prompt vault.

---

## Executive Brief

The 2025–2026 AI-IDE field has converged on a small but powerful family of UI patterns:

1. **Sidebar agent panels with @-mention pickers** (Cursor, Zed, Continue, Windsurf, Cline, Roo Code).
2. **Markdown-as-source-of-truth** for rules, prompts, skills, and commands — every major tool now reads markdown files from disk and surfaces them by directory convention (`.cursor/rules/`, `.cursor/commands/`, `.claude/skills/`, `.claude/commands/`, `.continue/rules`, `.rules`, `.windsurfrules`, `.clinerules`).
3. **Typeahead command pickers** (`/`-trigger popovers) layered over a chat composer.
4. **Glassmorphism / Apple Liquid Glass / Linear's dark-foreground palette** as the dominant 2026 aesthetic.
5. **Parallel agent management** (Cursor 3 "Glass", Windsurf's Kanban, Zed's thread sidebar) — multiple chats visible at once.

For the EZvibes **prompt vault**, the strongest synthesis is:

- **Treat the vault as a watched directory of markdown files** (Cursor `.cursor/commands/` model). Any session — running locally or remotely — can drop a `hand-off-2026-05-25.md` into a known folder and the vault updates live.
- **Surface each `.md` as a clickable card or row with one-click "Paste to Active Tab"** (mirrors Cursor's `/` command insertion behavior — the *entire markdown body* becomes the next prompt).
- **Layer a cmdk-style fuzzy command palette** on top of the vault for the keyboard-driven path (the Linear/Vercel/Raycast pattern).
- **Make the vault dockable like Zed's Agent Panel** — left/right/bottom dock with persistent width settings, but in your case it's per-session-window.
- **Glassmorphism dark panel with a 12 px backdrop blur and a 10–20 % opacity fill** is the de-facto 2026 panel surface treatment.

The single most exciting pioneer-level idea (detailed at the end): **The "Cursor `/commands` model as Genie folder."** Each markdown file in a watched directory becomes a **physical folder-card in the vault**; clicking *types* the file body into the open xterm tab via `terminal.paste()` bracketed-paste, exactly like Cursor's `/commands` slash-insert — but with your folder-shaped, genie-animated UX. It's `claude-code/.claude/commands/` made into a tactile, in-terminal-popup file system.

---

## Section 1 — Cursor (the OG agentic IDE)

Cursor is "the OG agentic IDE, and the team has continued to pioneer new features in the field." ([Builder.io: best agentic IDEs heading into 2026](https://www.builder.io/blog/agentic-ide)). Cursor 3 ("Glass") shipped April 2, 2026 and is the dominant reference design for everyone else.

### 1.1 The chat sidebar (Cursor 1.x / 2.x baseline)

The classic Cursor chat is a right-docked panel (you can dock it left, right, or floating). Key visual ingredients:

- **Composer textarea at the bottom** with auto-resize and `Cmd+I` (Inline Edit) / `Cmd+L` (Chat) shortcuts.
- **Above the composer**: an "Add Context" pill row showing currently attached files as removable chips.
- **Above that**: scrollable message list with rounded bubbles, the assistant message rendering streaming code blocks with **inline diff chunks** (alternating red/green highlights). ([forum.cursor.com — inline diffs](https://forum.cursor.com/t/no-longer-seeing-inline-diffs-from-composer/52319))
- **At the top of every message**: model name (`Claude Sonnet 4.7`), token count, and an "Apply" / "Reject" trio for any code change in that message.
- **Ghost-text autocomplete** (the Tab completion) is grey, monospace, context-aware, and accepted with Tab / dismissed with Esc. ([stevekinney.net Cursor ghost mode](https://github.com/stevekinney/stevekinney.net))

Visual treatment: Cursor uses a near-black `#0E0E10`-ish background, a slightly-lighter foreground for the chat panel (Linear's "lift the modal" trick), and accent colors that vary per model badge.

### 1.2 Composer / Agent mode

When you hit `Cmd+I` you get the Composer (Cursor 2.x) — a heavier dialog that does multi-file edits. The Composer shows:

- A **prompt input** with the same `@` and `/` triggers as Chat.
- A **file tree pane** showing which files the agent has touched, with green +/red − stats.
- An **inline accept/reject control per hunk** (Cursor's signature "accept this hunk, reject that one") rendered as alternating red/green chunks in the IDE main window. ([Cursor 2026 guide DeployHQ](https://www.deployhq.com/guides/cursor))

In Cursor 3 "Glass" (April 2026), the Composer pane was **replaced** by an **Agents Window** — a full-screen workspace where you spin up multiple parallel agents, each in its own **Agent Tab**, viewable side-by-side or in a grid. ([dev.to / Cursor 3 Glass](https://dev.to/gabrielanhaia/cursor-3-glass-replaced-composer-with-an-agents-window-1pcg), [cursor.com/changelog/3-0](https://cursor.com/changelog/3-0))

Key takeaway for EZvibes: the **side-by-side tab grid** is the new norm. Your existing Chrome-style tab strip per session window is already on this trajectory — adding a "split tabs" view would make EZvibes feel modern.

### 1.3 The `@`-mention context picker (the single most-imitated UI of 2026)

When you type `@` in Cursor's composer, a popover opens with categorized options:

- `@Files` — fuzzy file search across the workspace
- `@Folders` — directory picker
- `@Code` — symbol search via tree-sitter / LSP
- `@Docs` — indexed documentation (custom URLs the user added)
- `@Git` — `@Commit`, `@Diff of Working State`, `@Branch`, `@Pull Request`
- `@Web` — actually does a web fetch and pipes results in
- `@Past Chats` — pull context from prior conversations
- `@Terminals` — pipe terminal output
- `@Browser` — content from the built-in browser

([cursor.com/docs/context/mentions](https://cursor.com/docs/context/mentions))

The picker is a **floating cmdk-style popover anchored at the `@` caret position**, with categorized headings (uppercase, dimmed labels), keyboard-arrow navigation, and Enter to select.

Attached items render in the input as **atomic chip blocks**: pressing Backspace once removes the entire chip. ([jcshawn.medium.com — Cursor @-mention](https://jcshawn.medium.com/building-an-mention-feature-like-cursor-in-your-website-2025-b7986d8f685d))

CSS pattern observed:
```css
.mention-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(96, 165, 250, 0.15);   /* blue-400 / 15 */
  color: rgb(147, 197, 253);              /* blue-300 */
  font-size: 12px;
  font-family: ui-monospace, "JetBrains Mono", monospace;
  user-select: none;                       /* atomic */
  cursor: default;
}
.mention-chip .x {
  opacity: 0.6;
}
.mention-chip:hover .x {
  opacity: 1;
}
```

For EZvibes: when a user clicks a vault prompt, you could **also** insert it as a chip into the composer of an outside chat (or just paste verbatim into xterm). The chip pattern is universally legible.

### 1.4 `.cursor/rules/` — the foundational vault pattern

This is the single most directly applicable pattern to the prompt vault concept.

**File layout** ([cursor.com/docs/rules](https://cursor.com/docs/rules)):

```
.cursor/rules/
  react-patterns.mdc
  api-guidelines.md
  frontend/
    components.md
    typography.md
  testing/
    playwright.mdc
```

**`.mdc` frontmatter** is YAML, with three fields that determine when the rule applies:

```yaml
---
description: "RPC service conventions for backend"
alwaysApply: false
globs: src/services/**/*.ts
---

# RPC Service Rules

When editing files in `src/services/`, follow these conventions:
- Each service is a single file with a default export class
- Methods are `async` and return `Result<T, ErrorCode>`
- Always validate inputs with Zod schemas (see `src/schemas/`)
```

Four behavior modes derived from the frontmatter combinations:

| `alwaysApply` | `description` | `globs`  | Behavior |
|:--|:--|:--|:--|
| `true` | — | — | Always included in every chat |
| `false` | — | provided | Auto-attached when files matching glob are opened |
| `false` | provided | — | Agent decides based on description ("Apply Intelligently") |
| `false` | — | — | Manual `@rule-name` mention only |

**UI surface**: Rules appear in **Cursor Settings → Rules, Commands** as a list with status badges. Users can add via `+ Add Rule` or chat `/create-rule` command. ([cursor.com/docs/rules](https://cursor.com/docs/rules))

**For EZvibes**: This is the single most powerful blueprint for the vault. Drop your `.md` / `.mdc` / hand-off files into a known directory; show them in a list/grid; let any session write to it; show frontmatter `description` as a subtitle.

### 1.5 `.cursor/commands/` — the slash-prompt vault (newer, 2025+)

This is **even more directly relevant** to your vault concept. Introduced in Cursor 1.6.

**File layout**:

```
.cursor/commands/
  debug-issue.md
  fix-compile-errors.md
  add-documentation.md
  refactor-component.md
  write-tests.md
```

Each file is a plain markdown file. Typing `/` in the chat input opens a popover that lists every command from your project + your global library (`~/.cursor/commands/`). Selecting one **inserts the entire markdown body as the prompt**. ([dev.to: cursor slash commands](https://dev.to/subprime2010/claude-code-custom-slash-commands-the-commands-directory-youre-probably-not-using-5a18), [ezablocki.com](https://ezablocki.com/posts/cursor-slash-commands/))

This is *exactly* the user's intuition: "click a markdown file, paste it into the terminal." Cursor proves the workflow works.

Example `debug-issue.md`:
```markdown
You are debugging an issue. Follow this protocol:

1. Read the error message and stack trace carefully.
2. Identify the source file and line number.
3. Search for related code with `grep` and read with `cat`.
4. Form a hypothesis BEFORE touching any code.
5. Validate the hypothesis with a minimal probe (a print, a unit test).
6. Only after confirmation, propose a fix.
7. After the fix, write a regression test.

Do not skip steps. State each step out loud as you do it.
```

Click → entire body becomes the prompt. Done.

**Pioneer move for EZvibes**: Make every `.md` in your vault folder *literally* clickable to paste — but render the file as a *folder-shaped card* (matching EZvibes's existing Explorer aesthetic). The body of the file flows into the active terminal tab via xterm's bracketed-paste API.

---

## Section 2 — Zed (clean-slate native panel)

Zed is a high-performance native editor written in Rust. The Agent Panel is the relevant feature.

### 2.1 The Agent Panel layout ([zed.dev/docs/ai/agent-panel](https://zed.dev/docs/ai/agent-panel))

- Opens via `agent: new thread` or the ✨ icon in the status bar.
- **Dockable left/right/bottom** via `"dock": "right"` setting.
- Width and height persisted.
- The message input supports `@` mentions for **files, directories, symbols, previous threads, rules files, and diagnostics**.
- Multi-line code pasted from a buffer auto-formats as a `@` mention block.
- A `+` menu beside the input gives you "Add Selection" and "Add Image."
- A **model selector** sits next to the profile selector, with token usage live-displayed.
- `cmd-shift-escape` / `shift-alt-escape` toggles an expanded input view.
- Above the input: an **accordion bar** that surfaces "edited file counts, line changes." Clicking "Review Changes" (`shift-ctrl-r`) opens a multi-buffer tab with all diffs and per-hunk accept/reject.
- **Threads Sidebar** (`cmd-alt-j`) lists all threads grouped by project, with archive functionality.
- Each thread response is rendered as a **card with right-click context menu** (Copy text, Open Thread as Markdown, etc.).
- **Scroll arrow buttons** at the bottom of the panel jump between the most recent prompt and the thread beginning.
- A **crosshair icon** enables "follow agent file edits" — the editor scrolls along with the agent.

### 2.2 Rules Library ([zed.dev/docs/ai/rules](https://zed.dev/docs/ai/rules))

Zed supports **9 different rule file conventions** at the project root, with this exact precedence:

1. `.rules`
2. `.cursorrules`
3. `.windsurfrules`
4. `.clinerules`
5. `.github/copilot-instructions.md`
6. `AGENT.md`
7. `AGENTS.md`
8. `CLAUDE.md`
9. `GEMINI.md`

This is a **pioneer move** in its own right — Zed acts as a polyglot reader for every other AI tool's convention.

Access the Rules Library via Agent Panel menu (`...`) → `Rules…`, or `agent: open rules library` command, or `cmd-alt-l` keybinding. The library opens a **full editor with syntax highlighting** of each rule file.

The **paper-clip icon button** in the top-right of any rule editor designates it as **default** — applied to every new thread automatically.

### 2.3 Slash commands ([zed.dev/docs/extensions/slash-commands](https://zed.dev/docs/extensions/slash-commands))

Zed extensions can provide custom slash commands. They show up in the agent panel input via a `/`-trigger popover with a description string and an action callback.

Built-ins include `/file`, `/symbols`, `/diagnostic`, `/active`, `/default`, `/search`, `/now` etc. Most were migrated to `@`-mentions in 2025 since `@` is a more uniform handle.

### 2.4 For EZvibes — Zed lessons

- **Dockable panels** with persistent width/height settings.
- **Paper-clip-to-pin-default** is a charming, discoverable UI metaphor — you can re-use it for "always paste this rule into new sessions."
- The **polyglot reader for 9 rule file formats** is something EZvibes should adopt: if a user's folder has any of those, surface them in the vault panel.

---

## Section 3 — Continue.dev (the open-source workhorse)

Continue.dev is an open-source VS Code/JetBrains plugin with a React webview sidebar.

### 3.1 UI architecture ([deepwiki — continuedev/continue](https://deepwiki.com/continuedev/continue/6-vs-code-extension))

The repo splits into:

- `core/` — extension logic
- `gui/` — React-based UI for the side panel webview
- `extensions/vscode/` — VS Code wrapper

The webview pattern is the standard `registerWebviewViewProvider` + `postMessage` / `onDidReceiveMessage` IPC bus, exactly like EZvibes's preload/IPC pattern.

### 3.2 Custom prompts ([docs.continue.dev/customize/deep-dives/prompts](https://docs.continue.dev/customize/deep-dives/prompts))

Prompts in Continue are markdown files with YAML frontmatter:

```markdown
---
name: Code Review
description: Perform a thorough code review of the staged changes
invokable: true
---

You are reviewing staged code changes. Be thorough and direct.

1. Read the diff carefully.
2. Identify any bugs, security issues, or style violations.
3. Suggest concrete improvements with line references.
4. End with a "Ship It" or "Needs Changes" verdict.
```

`invokable: true` makes the prompt available as a slash command. You can reference prompts by namespace path on the Continue Hub (e.g. `supabase/create-functions`) — a marketplace-style federation.

CLI flag: `cn --prompt supabase/create-functions "your instruction"` lets you invoke prompts headlessly.

### 3.3 Rules ([docs.continue.dev/customize/deep-dives/rules](https://docs.continue.dev/customize/deep-dives/rules))

Continue rules live in `.continue/rules/*.md` (workspace) or `~/.continue/rules/*.md` (global). Frontmatter:

```yaml
---
name: TypeScript Best Practices
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
description: TypeScript style and pattern guidance
---
```

Rules load in this order: Hub assistant → referenced Hub → local workspace → global. Within each tier, alphabetical (so prefix with `01-`, `02-` to enforce order).

### 3.4 Recommendation for sidebar position

The Continue extension's docs **explicitly recommend moving Continue to VS Code's right sidebar** to keep the file explorer open. Keyboard toggle: `Cmd/Ctrl+L`.

This is a hint: chat panels feel best **on the opposite side from the file tree**. For EZvibes, this means: if your folder browser is left, the prompt vault belongs right. (Or in EZvibes's case, the vault is *inside the session window*, so it can dock right within that window.)

---

## Section 4 — Windsurf / Codeium (Cascade panel)

Windsurf is Codeium's AI-native IDE, built on VS Code. The flagship is **Cascade**, an agentic system inside the editor.

### 4.1 Cascade UI ([windsurf.com/cascade](https://windsurf.com/cascade), [docs.codeium.com/windsurf/cascade](https://docs.codeium.com/windsurf/cascade))

- Cascade is a right-side panel by default.
- It is **not just chat** — it shows a structured plan, tool calls, file edits, terminal output, and lint diagnostics inline.
- Multi-step actions are visualized as a **vertical timeline of "events"** with collapsible sections per event.
- Windsurf manages every agent — local Cascade sessions and cloud Devin sessions — in **one unified Kanban-style dashboard**. ([MindStudio: Windsurf](https://www.mindstudio.ai/blog/what-is-windsurf))

### 4.2 `.windsurfrules`

Single root-level file (older convention). Newer versions of Windsurf adopt `.windsurf/rules/` (multiple files).

### 4.3 Pioneer move: Kanban for agents

Windsurf's **Kanban view for parallel agents** is a major design innovation. Each card represents a running agent (or a paused one). Drag between columns: To Do → In Progress → Awaiting Approval → Done.

This is *deeply* applicable to EZvibes because EZvibes already has **per-folder session windows**. A "global agents view" that shows every running session as a Kanban card across all folders would be a unique EZvibes take.

---

## Section 5 — Claude Code (terminal-native, MD-first)

Claude Code is Anthropic's official CLI. It lives in the terminal but has a rich convention for surfacing prompts, skills, and commands via markdown files.

### 5.1 Skills (`/.claude/skills/`) — the post-`/commands` standard ([code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills))

A skill is a directory:

```
.claude/skills/
  prompt-engineering/
    SKILL.md
    examples/
      example-1.md
      example-2.md
```

`SKILL.md` has YAML frontmatter:

```yaml
---
name: prompt-engineering
description: Use when crafting or revising prompts for LLMs.
---

# Prompt Engineering Best Practices

[1500-2000 words of guidance]
```

The **description is critical** because Claude reads only `name` + `description` (~100 tokens per skill) when deciding whether to load the full body (under 5K tokens). This is "progressive disclosure" — install dozens without context bloat. ([dev.to: Claude Code Skills](https://dev.to/muhammad_moeed/claude-code-skills-a-practical-guide-for-2026-3f6p))

### 5.2 Commands (`/.claude/commands/`)

The pre-Skills convention. Each `.md` file in `.claude/commands/` (project) or `~/.claude/commands/` (user-global) becomes a `/<name>` slash command. They still work but Skills are the new recommended approach.

### 5.3 CLAUDE.md

A root-level markdown file Claude reads automatically as a persistent system prompt for that directory. ([humanlayer.dev — writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md))

Best practice: keep it concise. Don't paste code; reference `file:line` to point Claude to authoritative context.

### 5.4 For EZvibes — Claude Code is the closest sibling

EZvibes literally launches `claude --dangerously-skip-permissions`. So the vault should:

- **Surface `.claude/commands/*.md`** of the active folder by default.
- **Watch `.claude/skills/` and surface SKILL.md descriptions.**
- **Auto-detect CLAUDE.md / AGENTS.md** at the folder root and pin them to the top of the vault.

This single-pass directory scan gives the user a "smart vault" with zero configuration.

---

## Section 6 — Cline, Roo Code, Aider (the remaining AI-IDE family)

### 6.1 Cline ([cline.bot](https://cline.bot))

- Operates as a sidebar panel in VS Code, JetBrains, Cursor, Windsurf, Zed, Neovim.
- Plan / Act mode toggle: explicit two-phase workflow.
- `.clinerules` file (single root file, like `.cursorrules`).
- Step-by-step approval UI.

### 6.2 Roo Code ([docs.roocode.com](https://docs.roocode.com))

- Forked from Cline, adds **modes**: Code, Architect, Ask, Debug, Orchestrator (default modes); plus user-defined custom modes.
- Mode selector dropdown above the chat input.
- Each mode is essentially a different system prompt + tool restriction set.
- Custom modes editable via `Edit Global Modes` or `Edit Project Modes (.roomodes)` in YAML.
- "Roo Cline Prompts menu" accessible from the panel header.

For EZvibes: the **mode-toggle dropdown** is a clean primary-UI affordance for switching between "Claude" and "Codex" — your existing `+` right-click for Codex could become a mode toggle.

### 6.3 Aider (terminal-native, REPL-style)

Aider is the terminal-only cousin. Its UI lessons are interaction-level:

- `/add <path>` — add a file to chat scope.
- `/drop <path>` — remove a file.
- `/run <command>` — run a shell command and pipe output.
- `/web <url>` — fetch a webpage and add to context.
- `/help`, `/clear`, `/commit` — meta-commands.

Aider's `Commands` class auto-discovers methods prefixed `cmd_` and exposes them as slash commands. ([deepwiki — Aider command processing](https://deepwiki.com/Aider-AI/aider/2.3-command-processing))

For EZvibes this is a hint: you can build a JS function dispatcher where any `cmd_<name>` exported function becomes a vault entry automatically.

---

## Section 7 — UI Foundations for the Prompt Vault

Now we synthesize the actual design vocabulary you should adopt.

### 7.1 The cmdk pattern (Linear / Raycast / Vercel / Cursor)

`cmdk` is Paco Coursey's React component used in Linear, Raycast, and Vercel's command menu. ([github.com/pacocoursey/cmdk](https://github.com/pacocoursey/cmdk), [react-cmdk.com](https://react-cmdk.com/))

EZvibes doesn't use React, but the same primitives translate to vanilla JS in <200 lines:

**Behavior**:
- Dialog opens on `Ctrl+K`.
- Search input at the top with placeholder ("Type to search prompts…").
- A virtualized list below.
- Items grouped by category (uppercase, dimmed labels: `RULES`, `COMMANDS`, `HAND-OFFS`, `SKILLS`).
- **Fuzzy match** ranked by `command-score` or `fuse.js`.
- **Cyan-highlighted matching characters** so the user sees exactly what their query matched. ([uxpatterns.dev — command palette](https://uxpatterns.dev/patterns/advanced/command-palette))
- **Arrow keys + Enter + Esc** for full keyboard control.
- **Monospace shortcut hints** on the right (e.g., `⌘1`, `⌘2`).

Visual treatment (cmdk in dark/Linear):
```css
.cmdk-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 999;
}
.cmdk-dialog {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, 90vw);
  max-height: 70vh;
  background: rgba(20, 20, 24, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 30px 80px -10px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cmdk-input {
  border: 0;
  background: transparent;
  padding: 18px 20px;
  font-size: 15px;
  color: #f0f0f0;
  outline: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.cmdk-list {
  overflow-y: auto;
  padding: 8px;
  flex: 1;
}
.cmdk-group-heading {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  padding: 12px 12px 4px;
}
.cmdk-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.85);
}
.cmdk-item[data-selected="true"] {
  background: rgba(255, 255, 255, 0.06);
}
.cmdk-item .shortcut {
  margin-left: auto;
  font-family: ui-monospace, "JetBrains Mono", monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  padding: 2px 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.cmdk-match {
  color: rgb(125, 211, 252); /* cyan-300 */
  font-weight: 600;
}
```

### 7.2 Glassmorphism / Apple Liquid Glass

The 2025/2026 panel surface treatment of choice is **dark glassmorphism**, codified by Apple's Liquid Glass (announced WWDC 2025). ([apple.com/newsroom/2025/06](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/))

Core ingredients:

- `backdrop-filter: blur(12px)` (or 10–20 px).
- `background: rgba(10, 10, 14, 0.6)` to `rgba(20, 20, 24, 0.85)`.
- Thin border `1px solid rgba(255, 255, 255, 0.08)` for separation.
- **Adaptive shadow** — Apple's Liquid Glass *increases shadow opacity when the surface is over text, decreases when over a solid light background.* You can mimic this by tracking the underlying CSS variable for the page brightness.
- Subtle **specular highlight** with `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1)`.

This is dramatically different from flat material design and gives the vault a "tactile floating object" feel that matches EZvibes's folder-popup aesthetic perfectly. The folder popup is *already* a floating object — the vault is naturally another one stacked on top.

### 7.3 Message bubbles (the supporting cast)

EZvibes probably won't render full chat history in the vault itself (the terminal handles that), but if you ever do, the 2026 conventions are:

- **Dark blue bubbles with white text** show 90% better readability than lighter combinations. ([bricxlabs.com chat UI patterns](https://bricxlabs.com/blogs/message-screen-ui-deisgn))
- User messages right-aligned with `#3b82f6` blue tint (`rgba(59, 130, 246, 0.18)`).
- Assistant messages left-aligned with `#374151` dark grey.
- Padding: 20 top / 10 sides / 15 bottom.
- A trend in 2026 (Cursor, Zed) is moving **away from bubbles toward cards**: "AI Assistant Cards" with clearly delimited tool calls, reasoning blocks, and code diffs each in its own subsection. ([multitaskai.com chat UI trends](https://multitaskai.com/blog/chat-ui-design/))

### 7.4 The Vercel AI Elements / Shadcn vocabulary

Vercel's `ai-elements` library (built on shadcn/ui) is **the de facto component vocabulary** for 2025–2026 AI UIs. ([vercel.com/changelog/introducing-ai-elements](https://vercel.com/changelog/introducing-ai-elements), [elements.ai-sdk.dev](https://elements.ai-sdk.dev/))

Components relevant to your vault:

| Component | What it is | Fit for EZvibes vault |
|---|---|---|
| `PromptInput` | textarea + attachments header + tools footer + model selector | Could replace the active terminal's "preview area" if you ever add one |
| `Message` / `MessageContent` / `MessageResponse` | chat bubble primitives | n/a if you stick with xterm |
| `Conversation` | streams messages with auto-scroll | n/a |
| `Suggestion` | clickable prompt chips before the input | **Directly useful** — vault entries can render as `Suggestion` chips |
| `FileTree` | recursive file/folder tree | **Directly useful** — render `.claude/commands/` as a FileTree |
| `Snippet` | code block with copy button | **Directly useful** — when previewing a prompt body |
| `Sources` | citation / reference list | n/a |
| `Tool` | render a tool call (collapsible) | n/a |
| `CodeBlock` | syntax-highlighted code | Use for previews |
| `Artifact` | a side panel for a single artifact | Could be the *preview pane* of a vault entry |

Even if EZvibes stays vanilla JS, copying the component **anatomy** (auto-resizing textarea, attachments header, tool footer) gives you a battle-tested layout.

### 7.5 Animations (framer-motion 12 / motion / CSS keyframes)

The 2025 spec for panel transitions:

- **Slide-in from edge**: `transform: translateX(100%)` → `0` over 220 ms with spring physics.
- **Fade-in glass**: `opacity: 0` → `1` over 180 ms.
- **Layout shift via layout animations**: when an item is added/removed, framer's `layout` prop animates the gap automatically; in vanilla you use FLIP (First-Last-Invert-Play).
- **Stagger** on first paint: each vault entry fades+slides in with a 30–50 ms stagger.
- **Spring physics for x/scale, duration-based ease for opacity** is the framer-motion convention. ([framer-motion docs](https://www.framer.com/motion/animation/))

CSS-only spring-ish curve (Linear's tone): `cubic-bezier(0.16, 1, 0.3, 1)` (the "ease out expo" with overshoot dampened) for 220–260 ms.

### 7.6 File watching (chokidar 5)

For the "any agent writes a hand-off and it appears live" workflow, **chokidar** is the de facto Node file-watcher.

```js
const chokidar = require('chokidar');
const watcher = chokidar.watch(path.join(folder, '.claude/commands'), {
  ignored: /(^|[\/\\])\../, // dotfiles other than the .claude root
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 30 }
});
watcher.on('add', file => mainWindow.webContents.send('vault:add', file));
watcher.on('change', file => mainWindow.webContents.send('vault:change', file));
watcher.on('unlink', file => mainWindow.webContents.send('vault:remove', file));
```

`awaitWriteFinish` is critical — without it you'll fire on partial writes from another agent and the vault flickers.

`chokidar@5` is ESM-only and requires Node 20+. ([github.com/paulmillr/chokidar](https://github.com/paulmillr/chokidar))

### 7.7 xterm.js bracketed-paste

To make a vault click **actually paste into the live xterm tab**, you need:

```js
// In main process — send to PTY:
function pasteIntoTab(sessionId, content) {
  const tab = terminals.get(sessionId);
  if (!tab) return;
  // Bracketed-paste mode: \e[200~ <content> \e[201~
  const wrapped = `\x1b[200~${content}\x1b[201~`;
  tab.pty.write(wrapped);
}
```

Most modern shells (PowerShell 7+, bash, zsh) enable bracketed-paste, so the content arrives as "pasted text," not as keystrokes — which:

1. Disables auto-indent (Vim, Emacs).
2. Prevents accidental command execution mid-paste if there are embedded `\r`.
3. Allows the shell to display the entire blob and then let the user hit Enter.

If the shell doesn't support bracketed-paste, `\e[200~` literally lands as garbage — so feature-detect first by sniffing `$TERM` and shell type.

xterm.js itself has a `paste(data: string)` method on the `Terminal` instance ([xtermjs.org/docs/api](https://xtermjs.org/docs/api/terminal/classes/terminal/)), but for EZvibes — where you talk to node-pty, not to xterm directly — you write to PTY stdin.

---

## Section 8 — Specific Pioneer-Level Ideas (the highlights reel)

Ranked by "would make EZvibes feel 2026-cutting-edge."

### 8.1 Folder-shaped vault cards with click-to-paste (the headline idea)

Render every markdown in the watched directory as a **mini folder card** that matches EZvibes's existing Explorer folder aesthetic — but stacked inside the session window, like a drawer of folders that opens to the right of the active terminal tab.

**Interaction**: single click on a folder card → its body is bracketed-paste-inserted into the active terminal's PTY. The card animates a "ripple" outward as feedback. The folder card shows the file's `description` frontmatter as a subtitle and the first line of the body as a preview.

**Why it's pioneer-level**: It mirrors the **Genie minimize/restore animation** the user already loves, but applied to the *outbound* direction (prompt content flying from card → terminal). No other AI IDE has tied prompt insertion to folder-shaped UI.

### 8.2 Live cross-session hand-off

The vault directory is the **shared mailbox** between sessions. The "tick-md" pattern. ([purplehorizons.io/blog/tick-md-multi-agent-coordination-markdown](https://purplehorizons.io/blog/tick-md-multi-agent-coordination-markdown))

A running Claude session can `write_file('.claude/handoffs/session-foo-to-bar.md', '...')` and:

1. Chokidar fires.
2. The vault panel in *every open session window for that folder* shows a new card with a **green pulse** and "NEW" badge.
3. The badge persists until clicked.
4. Right-click a hand-off card → "Pin to top" (Zed's paper-clip metaphor).

This solves the user's explicit request: *"other sessions can save directly into this folder, and then its visible instantly in the app."*

### 8.3 The vault as a Liquid Glass overlay (`Cmd+P` quick palette)

In addition to the docked vault panel, bind `Ctrl+P` (or another shortcut) to open a **cmdk-style fuzzy palette** that searches across:

- All `.md` in `.claude/commands/`, `.claude/skills/`, `.cursor/rules/`, `.cursor/commands/`, `.windsurf/workflows/`, `.continue/rules/`
- The 9 root-level rule files Zed reads (`CLAUDE.md`, `AGENTS.md`, etc.)
- All `.md` in your **global** `~/.claude/commands/`

This is the **Raycast Spotlight pattern** applied to your vault: a single shortcut, fuzzy-search anything, hit Enter to paste.

Visual: glassmorphic overlay, 80% width, 60% max-height, dark glass with cyan match highlights, monospace hints on the right.

### 8.4 Mode dropdown above the active tab

Cursor 3's Agent Tabs each carry their own model/mode. Roo Code's mode dropdown shows above the input. **For EZvibes**, add a small mode badge to the active tab chip (you already differentiate Claude vs Codex by color). Clicking the badge opens a popover with:

- Mode: Claude / Codex / *(new agent)*
- Default rule pin: a paper-clip selector for which vault entry is auto-prepended.
- Token budget hint: "~2.4K tokens preloaded from CLAUDE.md."

### 8.5 Card-based message rendering for non-terminal output

When the user does something like "show me the history of this session," instead of dumping plain text, render **AI Assistant Cards**: each card is a distinct event (file edit, tool call, terminal output), collapsible, with its own border and slight gradient. This is Windsurf Cascade's pattern. ([windsurf.com/cascade](https://windsurf.com/cascade))

For EZvibes, this is mostly useful if you build a "session timeline" view that the narration sidebar can graduate into.

### 8.6 Drag-and-drop into the composer (or directly into terminal)

Cursor and Zed support drag-and-drop of files onto the chat input. EZvibes should accept **drag of a vault card directly into a terminal tab**:

- Drag start on a card → set `dataTransfer` text/plain to the file path.
- Drop on a tab chip → paste the file body into that tab's PTY (not the active tab — the *target* tab).

Multi-tab paste: drag onto multiple tabs while holding Shift to fan out.

### 8.7 The vault directory is *also* the rules library

Don't make this a separate concept. The same `.md` files that are clickable prompts are *also* the rules. If a file has `alwaysApply: true` in frontmatter, pin it to the top with a paper-clip badge and auto-prepend it to every new tab in this folder. (Cursor's exact model.)

This means: when an outside agent writes `.claude/hand-offs/2026-05-25-redesign.md` with `alwaysApply: true`, your next Claude tab in that folder *automatically* receives that hand-off as its first message.

### 8.8 Search-as-you-type with virtualized list

For folders with hundreds of `.md` files, use **virtualized rendering** (TanStack Virtual or hand-roll with `IntersectionObserver`) so the panel stays buttery at 60–120 fps even with 5,000+ entries. ([the-expert-developer.medium.com](https://the-expert-developer.medium.com/build-a-spotlight-style-command-palette-global-hotkeys-in-react-2025-fuzzy-search-7a04d30b7089))

### 8.9 Folder-tree view toggle

Some users want a flat list; some want hierarchy. Toggle button at the top of the vault panel:

- **List view**: flat alphabetical, with relative-time stamps ("3 min ago" — perfect for hand-offs).
- **Tree view**: nested folders rendered using Vercel's `FileTree` component or similar.

### 8.10 Inline preview pane (Artifact pattern)

Hovering a vault card for 500 ms opens an **inline preview** to the right showing the rendered markdown. Like macOS Quick Look. Clicking still pastes; hover just previews.

If you want to be extra-cool: the preview pane is itself a Liquid Glass card that floats over the terminal with the original card connected by a hairline curve (Apple Vision-style).

---

## Section 9 — A Concrete EZvibes-Native Sketch

Tying this all together for the user's actual app:

```
┌─ Session Window: ~/Code/EZvibes (Claude tab active) ────────────────────┐
│ ┌──────────┬──────────┬──────────┬──────────┐    ┌──[Vault]──┐    │
│ │ CLAUDE   │ CODEX 2  │ CLAUDE 3 │   + ▼    │    │ ⌕ search  │    │
│ └──────────┴──────────┴──────────┴──────────┘    ├───────────┤    │
│ ╔═══════════════════════════════════════════╗    │ 📌 Rules  │    │
│ ║                                           ║    │ CLAUDE.md │    │
│ ║   xterm tab — claude --dangerously...     ║    │ AGENTS.md │    │
│ ║                                           ║    ├───────────┤    │
│ ║   > /                                     ║    │ Commands  │    │
│ ║                                           ║    │ 📂 debug- │    │
│ ║                                           ║    │ 📂 refact-│    │
│ ║                                           ║    │ 📂 review-│    │
│ ║                                           ║    ├───────────┤    │
│ ║                                           ║    │ Hand-offs │    │
│ ║                                           ║    │ 🟢 NEW    │    │
│ ║                                           ║    │ 📂 2026-  │    │
│ ║                                           ║    │ 05-25...  │    │
│ ║                                           ║    └───────────┘    │
│ ╚═══════════════════════════════════════════╝                     │
└─────────────────────────────────────────────────────────────────────┘
```

Right-side vault panel, dockable, glassmorphic. Three sections: Rules (auto-pinned files), Commands (clickable to paste), Hand-offs (live-updated by chokidar). Click any card → paste into active terminal via bracketed-paste. `Ctrl+P` opens a full-screen cmdk overlay.

---

## Section 10 — References & Sources

### Cursor
- [Cursor — Build Software with AI Agents](https://cursor.com/product)
- [Cursor 3 Interface Changelog](https://cursor.com/changelog/3-0)
- [Cursor Docs — Rules](https://cursor.com/docs/rules)
- [Cursor Docs — @-Mentions](https://cursor.com/docs/context/mentions)
- [Cursor Docs — Agents Window](https://cursor.com/docs/agent/agents-window)
- [Cursor 3 Glass — Dev.to write-up](https://dev.to/gabrielanhaia/cursor-3-glass-replaced-composer-with-an-agents-window-1pcg)
- [Cursor Slash Commands — ezablocki.com](https://ezablocki.com/posts/cursor-slash-commands/)
- [Custom slash commands — Dev.to](https://dev.to/subprime2010/claude-code-custom-slash-commands-the-commands-directory-youre-probably-not-using-5a18)
- [InfoQ — Cursor 3 Agent-First Interface](https://www.infoq.com/news/2026/04/cursor-3-agent-first-interface/)
- [Ewan Mak — Cursor 3 ships an agent-first interface](https://medium.com/@tentenco/cursor-3-ships-an-agent-first-interface-heres-what-it-actually-changes-1f2bf8f383e2)
- [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules)
- [Cursor Rules Complete Guide 2026](https://www.vibecodingacademy.ai/blog/cursor-rules-complete-guide)

### Zed
- [Zed Docs — Agent Panel](https://zed.dev/docs/ai/agent-panel)
- [Zed Docs — Rules / AI Rules](https://zed.dev/docs/ai/rules)
- [Zed Docs — Slash Commands](https://zed.dev/docs/extensions/slash-commands)
- [Zed Docs — External Agents](https://zed.dev/docs/ai/external-agents)
- [Zed 2025 Recap](https://zed.dev/2025)
- [DeepWiki — Zed Agent Panel and UI](https://deepwiki.com/zed-industries/zed/8.1-agent-panel-and-ui)

### Continue.dev
- [Continue Docs — Customization Overview](https://docs.continue.dev/customize/overview)
- [Continue Docs — Prompts](https://docs.continue.dev/customize/deep-dives/prompts)
- [Continue Docs — Rules](https://docs.continue.dev/customize/deep-dives/rules)
- [Continue Docs — Chat Mode Quick Start](https://docs.continue.dev/ide-extensions/chat/quick-start)
- [Continue Docs — Agent Codebase/Docs](https://docs.continue.dev/guides/codebase-documentation-awareness)
- [DeepWiki — Continue VS Code Extension](https://deepwiki.com/continuedev/continue/6-vs-code-extension)
- [SitePoint — Continue.dev Complete Setup](https://www.sitepoint.com/continuedev-for-developers-the-complete-local-ai-coding-assistant-setup/)

### Windsurf / Codeium
- [Windsurf Editor](https://windsurf.com/editor)
- [Windsurf Cascade](https://windsurf.com/cascade)
- [Codeium Docs — Cascade](https://docs.codeium.com/windsurf/cascade)
- [MindStudio — What Is Windsurf](https://www.mindstudio.ai/blog/what-is-windsurf)

### Cline / Roo Code
- [Cline.bot](https://cline.bot/)
- [Cline GitHub](https://github.com/cline/cline)
- [Roo Code Docs — Custom Modes](https://docs.roocode.com/features/custom-modes)
- [Roo Code Docs — Slash Commands](https://docs.roocode.com/features/slash-commands)
- [Roo Code vs Cline — Qodo](https://www.qodo.ai/blog/roo-code-vs-cline/)

### Aider
- [Aider Docs — Usage](https://aider.chat/docs/usage.html)
- [Aider Docs — Command Processing](https://deepwiki.com/Aider-AI/aider/2.3-command-processing)
- [Aider Prompting Guide 2026](https://sureprompts.com/blog/aider-prompting-guide)

### Claude Code
- [Claude Code Docs — Best Practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code Docs — Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Docs — Slash Commands in SDK](https://code.claude.com/docs/en/agent-sdk/slash-commands)
- [Claude Code Custom Slash Commands — Dev.to](https://dev.to/subprime2010/claude-code-custom-slash-commands-the-commands-directory-youre-probably-not-using-5a18)
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- [Writing a Good CLAUDE.md — HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Claude Code Skills Practical 2026 Guide — Nimbalyst](https://nimbalyst.com/blog/claude-code-skills-guide/)
- [Best Claude Code Skills 2026 — Firecrawl](https://www.firecrawl.dev/blog/best-claude-code-skills)

### UI Foundations
- [Vercel AI Elements](https://vercel.com/changelog/introducing-ai-elements)
- [vercel/ai-elements GitHub](https://github.com/vercel/ai-elements)
- [AI Elements Browser](https://elements.ai-sdk.dev/)
- [Shadcn AI Chat with Sidebar Block](https://www.shadcn.io/blocks/ai-chat-with-sidebar)
- [Shadcn Command (cmdk)](https://www.shadcn.io/ui/command)
- [cmdk GitHub](https://github.com/pacocoursey/cmdk)
- [react-cmdk](https://react-cmdk.com/)
- [Liquid Glass — Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- [Glassmorphism 2025 — EverydayUX](https://www.everydayux.net/glassmorphism-apple-liquid-glass-interface-design/)
- [Dark Glassmorphism — Medium](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [Linear UI Redesign Part II](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear Design Analysis](https://getdesign.md/linear.app/design-md)
- [Framer Motion Animation Docs](https://www.framer.com/motion/animation/)
- [Animating React UIs in 2025 — Hooked on UI](https://hookedonui.com/animating-react-uis-in-2025-framer-motion-12-vs-react-spring-10/)
- [React Bits](https://reactbits.dev/)
- [Aceternity UI](https://ui.aceternity.com/)
- [Spotlight Command Palette in React 2025](https://the-expert-developer.medium.com/build-a-spotlight-style-command-palette-global-hotkeys-in-react-2025-fuzzy-search-7a04d30b7089)
- [Command Palette UX Patterns](https://uxpatterns.dev/patterns/advanced/command-palette)
- [Chat UI Best Practices 2026 — TheFrontKit](https://thefrontkit.com/blogs/ai-chat-ui-best-practices)
- [Chat UI Design Patterns — BricxLabs](https://bricxlabs.com/blogs/message-screen-ui-deisgn)
- [AI UI Patterns — patterns.dev](https://www.patterns.dev/react/ai-ui-patterns/)
- [Chatbot UI Design Guide 2026 — FuselabCreative](https://fuselabcreative.com/chatbot-interface-design-guide/)
- [Innovative Chat UI Trends 2025 — MultitaskAI](https://multitaskai.com/blog/chat-ui-design/)
- [Building @-Mention Feature Like Cursor — Medium](https://jcshawn.medium.com/building-an-mention-feature-like-cursor-in-your-website-2025-b7986d8f685d)
- [Badges vs Pills vs Chips vs Tags](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/)

### Terminal Integration
- [xterm.js](https://xtermjs.org/)
- [xterm.js API — Terminal class](https://xtermjs.org/docs/api/terminal/classes/terminal/)
- [Bracketed Paste — XTerm](https://invisible-island.net/xterm/xterm-paste64.html)
- [Bracketed Paste — Wikipedia](https://en.wikipedia.org/wiki/Bracketed-paste)
- [chokidar GitHub](https://github.com/paulmillr/chokidar)
- [Lean Obsidian Terminal](https://github.com/sdkasper/lean-obsidian-terminal)

### Multi-Agent & Hand-off Coordination
- [tick-md Multi-Agent Coordination](https://purplehorizons.io/blog/tick-md-multi-agent-coordination-markdown)
- [Agent Handoff Patterns — Augment Code](https://www.augmentcode.com/guides/agent-handoff-patterns-human-agent-interface)
- [Multi-Agent Workflows — Microsoft Agent Framework](https://medium.com/data-science-collective/creating-multi-agent-workflows-with-microsoft-agent-framework-8c68df1ec0ea)
- [Claude Code Agent Teams — Terry Cho](https://medium.com/@terrycho/claude-code-agent-teams-one-ai-isnt-enough-anymore-7022f70076a6)
- [How Agent Handoffs Work — Towards Data Science](https://towardsdatascience.com/how-agent-handoffs-work-in-multi-agent-systems/)

### Snippet & Prompt Managers (for inspiration)
- [Raycast Snippets](https://manual.raycast.com/snippets)
- [PromptVault VS Code](https://marketplace.visualstudio.com/items?itemName=zameerkh2932.prompt-vault)
- [Pieces for Developers — Dev.to](https://dev.to/andrewbaisden/exploring-the-pieces-for-developers-ai-app-my-initial-thoughts-cc5)
- [SnapPrompt Chrome Extension](https://chromewebstore.google.com/detail/snapprompt/mfempofkejniiaimjcdddboiddofcemp)
- [Snippety](https://snippety.app/)

---

## Closing

The 2025–2026 AI-IDE landscape has, in effect, **agreed on the user's vault concept** — they just call it different things (`.cursor/commands`, `.claude/skills`, Continue prompts, Zed Rules Library). Every tool independently arrived at: **watch a directory of markdown files, surface them as clickable / typeable entries, let the user invoke one to inject its body as the next prompt.**

What EZvibes can uniquely contribute is the **physical-folder aesthetic**: render each entry as a tactile mini-folder card, dock it inside the session window next to the terminal, animate inserts with the same Genie language EZvibes already uses for minimize/restore. Combine that with a Liquid Glass dark surface, a `Ctrl+P` cmdk overlay, and live chokidar hand-off updates, and you have the first AI-coding EZvibes that *feels* like macOS Tahoe + Linear + Cursor while keeping EZvibes's signature explorer warmth.
