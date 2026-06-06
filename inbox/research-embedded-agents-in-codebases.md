# Research: Embedding AI Agents Deeply Into a Codebase

**Slice:** Static embedding of agents into a repo (rule files, skills, subagents, hooks).
**Date-stamped:** May 2026. Conventions in this space are evolving monthly — re-verify before shipping.
**Sibling slices:** A6 (embedded terminal), A7 (MCP/env), A8 (agent messaging), A10 (cron/temporal self-sustainment).

---

## 1. How to Look at This Correctly (Meta)

Embedding agents into a codebase is **information architecture**, not prompt engineering. The model is generic; the repo is specific. Five lenses:

**1.1 Read / Modify / Leave-alone partitioning.** Every file in a repo falls into one of three buckets for an agent: *substrate* it reads to understand the system (source, tests, README), *surface* it actively edits (feature code, rules it is told to update), and *contracts* it must not touch (lockfiles, generated code, schema migrations, managed-policy CLAUDE.md, secrets). Make this explicit in your top-level rule file — agents do not infer immutability, they need a list. Anthropic recommends negative rules ("never commit `.env`", "no SSR") as load-bearing as positive ones ([Anthropic best practices](https://code.claude.com/docs/en/best-practices)).

**1.2 Rule-file hierarchy mirrors blast radius.** A clean model: *managed-policy* (org, immutable from inside the repo) > *user* (`~/.claude/CLAUDE.md`, personal preferences) > *project* (`./CLAUDE.md`, team-shared, version-controlled) > *local* (`./CLAUDE.local.md`, gitignored, per-machine) > *conversation* (in-chat instructions, ephemeral). Lower layers shouldn't be allowed to override invariants set at higher layers. Claude Code now enforces this: managed-policy CLAUDE.md cannot be excluded by `claudeMdExcludes` from inside the repo ([Claude memory docs](https://code.claude.com/docs/en/memory)).

**1.3 Skills vs. rules vs. hooks — choose by failure mode.** This is the most-missed distinction. A **rule** (CLAUDE.md / AGENTS.md / `.cursor/rules/*.mdc`) is *passive context* loaded into every session; cheap, drift-prone, no enforcement. A **skill** (`.claude/skills/<name>/SKILL.md`) is *task-scoped behaviour* that loads on demand (~100 tokens of frontmatter scan, ~5K when triggered) — use it when work is procedural and only sometimes relevant. A **hook** (`.claude/settings.json`) is *deterministic shell code* that runs at lifecycle events and can block tool calls regardless of LLM decisions — use it when "the model must never X" matters more than "the model usually shouldn't X" ([Anthropic hooks reference](https://code.claude.com/docs/en/hooks)). The rule of thumb: if you need *guarantee*, write a hook; if you need *competence*, write a skill; if you need *context*, write a rule.

**1.4 Drift is structural, not accidental.** When agents are allowed to edit their own rules (e.g., `/memory` adds a line to CLAUDE.md, auto-memory writes to `MEMORY.md`), the rule file becomes a feedback loop. Without invariants, the file slowly mutates toward whatever shortcuts the model preferred this week. Two countermeasures: (a) declare a fenced **INVARIANTS** block at the top of CLAUDE.md that agents are forbidden to touch, and (b) route discovered learnings to a separate `MEMORY.md` / auto-memory location so the human-curated rules stay clean ([amattn on drift](https://amattn.com/p/using_agentsmd_or_claudemd_to_counteract_agent_drift.html)).

**1.5 Auditability via git + numbered handoffs.** Treat every agent-authored change as a reviewable diff: commits are the audit log, and for multi-agent work a numbered handoff chain (`.handoffs/hand-off-NNN.md`, immutable, sequential) makes each agent's contribution legible to the next ([Retteli's own handoff-protocol skill](file:///C:/Users/Oskari/Documents/cleanup/Retteli/.claude/skills/handoff-protocol/SKILL.md)). Rollback is then `git revert` plus optionally archiving the handoff chain — no custom infra.

---

## 2. Current State of the Art — Rule-File Conventions

| File | Tool | Format | Scope mechanism | Best for |
|---|---|---|---|---|
| `CLAUDE.md` (+ `.claude/CLAUDE.md`) | Claude Code | Markdown, supports `@path` imports up to 4 hops | 4 layers: managed / user / project / local | Persistent project rules, build/test commands, invariants ([memory docs](https://code.claude.com/docs/en/memory)) |
| `.claude/rules/*.md` | Claude Code | Markdown + YAML frontmatter (`paths: ["src/**/*.ts"]`) | Path-globbed; load on demand when matching files are touched | Topic-specific guidance that shouldn't bloat the root file ([memory docs](https://code.claude.com/docs/en/memory)) |
| `.claude/skills/<name>/SKILL.md` | Claude Code, OpenClaw, Codex CLI | Markdown + frontmatter (`name`, `description`, `when_to_use`, optional `hooks`, `manual-only`) | Description-driven trigger; ~100 tokens scanned per session | Procedural workflows: "create-pr", "run-tests", "draft-release-notes" ([Claude skills docs](https://code.claude.com/docs/en/skills), [SKILL.md spec](https://www.agensi.io/learn/skill-md-format-reference)) |
| `.claude/agents/<name>.md` | Claude Code subagents (v2.1.33+) | Markdown + frontmatter (`name`, `description`, `tools`, `model`) | Delegated by main agent based on `description`; runs in its own context window | Specialised expert (security reviewer, test runner, doc writer) — use when same role is spawned repeatedly ([subagent docs](https://code.claude.com/docs/en/sub-agents)) |
| `.claude/settings.json` | Claude Code hooks | JSON with `hooks.<EventName>[].hooks[]` entries | Lifecycle event matchers (tool name, glob, command type) | Deterministic guarantees: format-on-write, secret scan, block destructive commands ([hooks reference](https://code.claude.com/docs/en/hooks)) |
| `MEMORY.md` (auto-memory) | Claude Code v2.1.59+ | Markdown index + topic files in `~/.claude/projects/<proj>/memory/` | First 200 lines / 25KB auto-loaded each session | Agent-discovered patterns that shouldn't pollute the human-authored CLAUDE.md |
| `AGENTS.md` | Cross-tool standard (Codex, Cursor, Gemini, Copilot, Windsurf, Jules, Aider, Zed, ~20 tools) | Plain Markdown, no fixed schema; closest file wins in monorepos | One file at repo root, optionally nested | The portable layer — write project conventions here so every tool reads them ([agents.md spec](https://agents.md/), [Codex AGENTS.md docs](https://developers.openai.com/codex/guides/agents-md)) |
| `.cursor/rules/*.mdc` (new) and `.cursorrules` (legacy) | Cursor | MDC: YAML frontmatter (`description`, `globs`, `alwaysApply: bool`) + Markdown body | Four activation modes: Always / Auto-attached (globs) / Agent-requested (description) / Manual (`@rule-name`) | Per-domain Cursor rules; the legacy single `.cursorrules` is being phased out ([Cursor MDC guide](https://www.vibecodingacademy.ai/blog/cursor-rules-complete-guide), [MDC vs .cursorrules](https://thepromptshelf.dev/blog/cursorrules-vs-mdc-format-guide-2026/)) |
| `.windsurf/rules/*.md` (new) and `.windsurfrules` (legacy) | Windsurf / Codeium Cascade | Markdown, GUI-wrapped | 3 levels: global (6KB cap) / workspace (12KB cap) / enterprise system | Cascade-specific instructions; workspace file is committed, global is per-user ([.windsurfrules guide](https://thepromptshelf.dev/blog/windsurfrules-complete-guide-2026/)) |
| `GEMINI.md` | Gemini CLI / Code Assist | Markdown | Repo-root, similar to CLAUDE.md but Gemini-specific | Gemini-only overrides; many teams now just symlink to `AGENTS.md` |

**Convergence trend:** `AGENTS.md` was donated to the Linux Foundation's Agentic AI Foundation in December 2025 alongside Anthropic's MCP and Block's Goose; it is now the de-facto cross-tool standard ([AAIF announcement coverage](https://www.augmentcode.com/guides/how-to-build-agents-md)). Claude Code itself reads `CLAUDE.md`, not `AGENTS.md`, but the docs explicitly recommend either symlinking or importing `@AGENTS.md` from the top of `CLAUDE.md` ([Claude memory docs](https://code.claude.com/docs/en/memory)).

**Empirical caveat:** an arXiv study cited across 2026 reviews found that *LLM-generated* context files **reduce** task success in 5 of 8 settings and add 20–23% inference cost ([Augment Code summary](https://www.augmentcode.com/guides/how-to-build-agents-md)). Human-curated rule files are still the gold standard; auto-memory is a complement, not a replacement.

---

## 3. Implementation Guidance — A Concrete Layout for the Dark-Blue Liquid-Glass Agent Platform

Target: a Retteli-style orchestration template that drops into any project, embeds agents deeply, and is portable across Claude Code, Codex, Cursor, and Windsurf. Tuned for the user's "dark-blue liquid-glass agent platform."

```
project-root/
├── AGENTS.md                          # Cross-tool surface. Plain Markdown. Build/test/lint commands,
│                                      # repo map, "do/don't" list. Every coding agent reads this first.
├── CLAUDE.md                          # Claude-specific. Starts with: @AGENTS.md
│                                      # Adds: handoff-chain workflow, skill-discovery rules,
│                                      # liquid-glass UI invariants (token names, no inline styles).
│                                      # Hard cap: 200 lines. Includes INVARIANTS fenced block.
├── CLAUDE.local.md                    # Gitignored. Per-machine sandbox URLs, dev API keys, tool paths.
├── .cursor/rules/
│   ├── frontmatter-symlink-to-agents-md.mdc   # alwaysApply: true, imports AGENTS.md content
│   ├── liquid-glass-tokens.mdc                # globs: ["src/styles/**/*.{ts,css}"]
│   └── orchestration-skills.mdc               # globs: [".claude/skills/**"], description-triggered
├── .windsurf/rules/
│   └── agents-md.md                   # Symlink or copy of AGENTS.md (Windsurf reads its own dir)
├── GEMINI.md                          # Symlink to AGENTS.md
├── CURRENT_PLAN.md                    # Live project status. Updated at session end. Lightweight.
├── .claude/
│   ├── CLAUDE.md                      # Optional alternate location for project rules
│   ├── settings.json                  # Hooks (committed, team-shared)
│   ├── settings.local.json            # Per-developer hooks (gitignored)
│   ├── skills/
│   │   ├── ultra-thinker/SKILL.md     # Deep analysis archetype
│   │   ├── ultra-builder/SKILL.md     # Zero-error implementation
│   │   ├── quality-gate/SKILL.md      # Fresh-context verification
│   │   ├── handoff-protocol/SKILL.md  # Numbered chain spec
│   │   ├── auto-bootstrap/SKILL.md    # First-use repo discovery
│   │   └── liquid-glass-ui/SKILL.md   # Project-specific: enforces dark-blue token palette,
│   │                                  # blur backdrop rules, motion tokens, never inline hex
│   ├── agents/
│   │   ├── security-reviewer.md       # Subagent: read-only tools, runs on PR open
│   │   ├── visual-qa.md               # Subagent: Playwright + screenshot diff for UI changes
│   │   └── doc-keeper.md              # Subagent: keeps AGENTS.md and CLAUDE.md in sync after refactors
│   ├── hooks/
│   │   ├── session-log.ps1            # Stop hook: appends session log to CURRENT_PLAN.md
│   │   ├── invariant-guard.ps1        # PreToolUse(Edit|Write): rejects edits to fenced INVARIANTS block
│   │   ├── format-on-write.ps1        # PostToolUse(Write): runs prettier/biome on touched files
│   │   └── secret-scan.ps1            # PreToolUse(Write|Edit): block commits containing API keys
│   └── worktrees/                     # Isolated workspaces for parallel agent runs
├── .handoffs/                         # Numbered handoff chain (gitignored or archived)
│   ├── hand-off-001.md
│   └── hand-off-002.md
└── src/                               # Touch freely. Standard agent surface.
```

**Where each rule type goes — quick decision tree:**

- *"Every agent in every tool must know this"* → `AGENTS.md`.
- *"Only Claude needs this; only on launch"* → `CLAUDE.md` (imports `@AGENTS.md`).
- *"Only relevant when working in `src/billing/`"* → `.claude/rules/billing.md` with `paths` frontmatter.
- *"This is a repeatable procedure"* → `.claude/skills/<name>/SKILL.md`.
- *"This must never happen, regardless of what the model decides"* → `.claude/settings.json` hook with `exit 2`.
- *"This is a specialist sub-context I keep spawning"* → `.claude/agents/<name>.md`.
- *"Claude figured this out itself; don't pollute the curated rules"* → auto-memory `MEMORY.md`.

**Liquid-glass-specific recommendations:**

1. Put a `## INVARIANTS` block at the top of `AGENTS.md` listing the dark-blue palette tokens, blur/backdrop rules, motion tokens, and the "no inline hex, no inline styles" rule. Guard it with `invariant-guard.ps1` as a PreToolUse hook so even an aggressive refactor agent can't strip the fence.
2. Create a `liquid-glass-ui` skill that loads when files in `src/components/**` are touched; the skill body cites the tokens and shows one canonical example component. Skills outperform rules here because UI work is procedural.
3. The `visual-qa` subagent (Playwright + screenshot diff) is the deterministic check — rules describe the look, the subagent verifies it.
4. Self-update via `doc-keeper` subagent runs after large refactors: it diffs the file tree against `AGENTS.md`'s repo-map section and proposes (does not auto-apply) updates. Human review preserves the invariants.

**Mature reference repos worth studying:** [openai/codex](https://github.com/openai/codex/blob/main/AGENTS.md) (canonical AGENTS.md with Rust+TUI conventions), [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (100+ subagent definitions), [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) (curated skills/hooks/agents index), [anthropics/skills](https://github.com/anthropics/skills) (Anthropic's official skill examples including `skill-creator`).

---

## 4. Cross-References to Sibling Research

- **A6 (embedded terminal):** the hooks defined here run *in* that terminal; coordinate `command` hook handlers with whatever shell A6 standardises (PowerShell on Windows here).
- **A7 (env / MCP):** MCP servers are surfaced to agents via `.claude/settings.json` too; A7 covers the *server* side, this slice covers the *config* side. The `mcp_tool` hook handler bridges them.
- **A8 (agent-to-agent messaging):** the numbered handoff chain in `.handoffs/` is the static, file-based version of agent messaging. A8 covers the live/async version.
- **A10 (cron / temporal self-sustainment):** A10 schedules *when* agents run autonomously; this slice defines *what context* they have when they wake up. Cron-triggered agents read the same CLAUDE.md / AGENTS.md / skills as interactive ones.

---

## 5. Sources

- [How Claude remembers your project — Claude Code Docs](https://code.claude.com/docs/en/memory)
- [Hooks reference — Claude Code Docs](https://code.claude.com/docs/en/hooks)
- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Best practices for Claude Code — Claude Code Docs](https://code.claude.com/docs/en/best-practices)
- [AGENTS.md spec (agents.md)](https://agents.md/)
- [Custom instructions with AGENTS.md — OpenAI Codex](https://developers.openai.com/codex/guides/agents-md)
- [openai/codex AGENTS.md (canonical example)](https://github.com/openai/codex/blob/main/AGENTS.md)
- [SKILL.md Spec: Every Field and Frontmatter Key — agensi.io](https://www.agensi.io/learn/skill-md-format-reference)
- [Cursor Rules: Complete .mdc Guide & 15 Templates (2026)](https://www.vibecodingacademy.ai/blog/cursor-rules-complete-guide)
- [.cursorrules vs .cursor/rules (MDC): Which Format to Use in 2026](https://thepromptshelf.dev/blog/cursorrules-vs-mdc-format-guide-2026/)
- [.windsurfrules: The Complete Guide to Windsurf AI Rules (2026)](https://thepromptshelf.dev/blog/windsurfrules-complete-guide-2026/)
- [Using AGENTS.md or CLAUDE.md to Counteract Agent Drift — amattn](https://amattn.com/p/using_agentsmd_or_claudemd_to_counteract_agent_drift.html)
- [How to Build Your AGENTS.md (2026) — Augment Code](https://www.augmentcode.com/guides/how-to-build-agents-md)
- [Agent-Ready Repo Structure (2026) — Huseyin Kaplan, Medium](https://medium.com/@huseyinkaplandev/agent-ready-repo-structure-2026-90af2ac8aed2)
- [The Complete Guide to CLAUDE.md — Bijit Ghosh, Medium](https://medium.com/@bijit211987/the-complete-guide-to-claude-md-memory-rules-loading-and-cross-tool-compression-97cc12ed037b)
- [VoltAgent/awesome-claude-code-subagents (100+ subagents)](https://github.com/VoltAgent/awesome-claude-code-subagents)
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- [anthropics/skills (official skill repository)](https://github.com/anthropics/skills)
- [Claude Code Hooks: Complete Guide to All 12 Lifecycle Events](https://claudefa.st/blog/tools/hooks/hooks-guide)
- [Repository Intelligence Graph: Deterministic Architectural Map for LLM Code Assistants — arXiv 2601.10112](https://arxiv.org/pdf/2601.10112)
