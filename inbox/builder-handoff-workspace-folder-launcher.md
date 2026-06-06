# Builder hand-off — Workspace Folder Launcher

> Paste everything below the line into a fresh (cleared) Claude Code session opened in the `terminal-emulator` repo.

---

You're picking up an approved, fully-specced feature in the **terminal-emulator** repo (an Electron terminal emulator; vanilla JS, no TypeScript/bundler; Windows-only). A separate planner session designed it — your job is to implement it.

## Objective
Implement the feature described in `docs/2026-05-29-workspace-folder-launcher-plan.md`, end-to-end. **Parent goal:** make each workspace *folder-bound* — creating a workspace always picks a folder (a custom in-app grid over one configured root folder), the workspace is auto-named after it, and every tab launches an agent (Claude/Codex) or a Brave browser **already running in that folder**, so the user never sees or types into a bare shell. Rationale/background is in `docs/2026-05-29-workspace-folder-launcher-design.md`.

## First steps
1. Read `docs/2026-05-29-workspace-folder-launcher-plan.md` in full, then skim the design spec next to it.
2. Read `CLAUDE.md` and `FEATURE-MAP.md` for the project's feature-isolation rules and conventions.
3. Use the **`superpowers:executing-plans`** skill to drive execution.

## How to execute
- Work the **10 tasks strictly in order**. Each lists exact files, code, test commands, and a commit. Tick the `- [ ]` boxes as you complete steps.
- Tasks 1–4 are additive (app keeps working). Tasks 5–7 are an interdependent "flip" — full behavior lands at Task 7. Tasks 8–10 are cleanup, docs, and verification.
- Run the unit-test steps exactly as written: `node --test <file>` for `node:test` files, and `node renderer/features/tabs/tabs.state.test.js` for the self-running one. These are safe.
- Commit per task using the provided messages. End commit messages with the project's Co-Authored-By trailer if configured. **Only `git add` the files each task names** — the working tree has many untracked files (`copied/` etc.); do NOT `git add -A` the whole tree.
- Before each edit, match on the **OLD code block shown in the plan**, not the line number — earlier tasks shift line numbers.
- The user prefers end-to-end execution without per-task approval prompts: keep moving through tasks; only pause for the two reasons below.

## Critical constraints
- ⚠️ **This session is running INSIDE the terminal-emulator app you are modifying.** Do NOT run `npm start`, `electron .`, or kill/restart the app — it will close this session (and any sibling Claude tab). Where the plan says *Run: `npm start`* or *restart the app*, **STOP and ask the user** to launch/restart a separate instance and report what they see.
- This feature is a **deliberate cross-cutting exception** to the strict one-feature-one-folder rule. It touches: `launcher` (new feature), `tabs`, `terminal`, `workspaces`, `grid-view`, `shared/config`, the preload, and `src/main/index.js`. The plan (and its Task 9 docs updates) authorize and document this seam. Do not expand scope beyond what the plan specifies, and do not redesign.
- Any `.md` files you create (notes/summaries) must go to `C:\Users\Oskari\Documents\EZvibes\inbox` with descriptive kebab-case names (global rule in `~/.claude/CLAUDE.md`).

## Escape hatch
If a step is ambiguous, an OLD code block no longer matches the file, a test fails in a way the plan doesn't predict, or an assumption looks wrong — **STOP and ask the user** rather than guessing or improvising a redesign.

Start with **Task 1**.
