# EZvibes — Session Recap (2026-05-29)

> Written so the session can be cleared and resumed cleanly. The canonical project doc is **`CLAUDE.md`**; the full improvement roadmap is **`inbox/ezvibes-comprehensive-improvement-plan-2026-05-28.md`**. This file summarizes what changed this session and what's left. (Identical copy of the project-root `summary_recap.md`.)

## Resume in 30 seconds (at a glance)

- **Branch:** `feat/p0-folder-delete-safety` — **4 commits ahead of `main`, NOT merged.**
- **Done & verified this session:** 2 P0 folder-delete data-loss fixes, the launch/new-tab orphan-PTY race fix, CSP hardening, a new unit-test suite, and a CLAUDE.md sync.
- **Tests:** `npm test` → **16 passing** (`node --test`). `npm run check:syntax` clean.
- **Last remaining 🔴-high finding:** folder **context-menu accessibility**.
- **Open decision when paused:** integrate the branch (merge / PR) or keep fixing.

## Step-by-step resume

### Step 1 — Restore your position (Git)

```powershell
cd C:\Users\Oskari\Documents\EZvibes
git status                                    # expect: On branch feat/p0-folder-delete-safety, no tracked changes
git checkout feat/p0-folder-delete-safety     # only if you are not already on it
git --no-pager log --oneline main..HEAD       # expect the 4 commits below
```

Expected 4 commits (newest first) — if these are present, the work is intact:

```
c5beac1 docs(claude-md): record delete guards, launch-race fix, and test suite
32d324d harden(csp): lock down base-uri/object-src/frame-src/form-action
44a95bd fix(session): guard launch/new-tab against window close during async open
024d648 fix(folder-delete): confine deletes to parent + block live-session subfolders
```

### Step 2 — Confirm it still builds and passes

```powershell
npm test                # expect: tests 16 / pass 16
npm run check:syntax    # expect: no errors (silent success)
npm start               # OPTIONAL: launch the app, sanity-check a delete + a session launch
```

⚠️ Do **not** run a bare `npm install` just to add a package — the `postinstall` hook rebuilds node-pty (fragile on Windows). For dev deps use `npm install <pkg> --save-dev --ignore-scripts`.

### Step 3 — Reload context (read in this order)

1. **`CLAUDE.md`** — canonical project doc (updated this session: delete contract, launch guard, test suite).
2. **`summary_recap.md`** (project-root copy of this file) — the findings ledger and prioritized next steps.
3. **`inbox/ezvibes-comprehensive-improvement-plan-2026-05-28.md`** — the full roadmap; look up whichever finding you pick for its `file:line` evidence and functionality-preservation note.

### Step 4 — Resolve the one open decision

**A) Integrate this batch into `main`** (local fast-forward; `main` had not moved when this was written):

```powershell
git checkout main
git merge --ff-only feat/p0-folder-delete-safety
git branch -d feat/p0-folder-delete-safety     # optional cleanup
```

(Prefer review on GitHub and have a remote? `git push -u origin feat/p0-folder-delete-safety`, then open a PR instead.)

**B) Keep fixing on this branch** — start the next item. Recommended: the last 🔴-high, **folder context-menu a11y**. See "Recommended next steps" below for the ordered list.

### Step 5 — Hand a fresh Claude session a clean starting prompt

Copy-paste something like:

> Read `summary_recap.md` and `CLAUDE.md`. I'm on branch `feat/p0-folder-delete-safety` (4 commits ahead of `main`). Continue with **[merge this batch to main / the folder context-menu a11y fix / the Vitest harness]**. Use TDD where there's a main-process seam (pure logic in `lib/`, run with `node --test`); manual-verify renderer-only changes. Pull the finding's `file:line` evidence from `inbox/ezvibes-comprehensive-improvement-plan-2026-05-28.md`.

## What happened this session

### 1. Generated a comprehensive audit + research plan (multi-agent workflow)
A background workflow ran **52 agents**: parallel codebase audit → adversarial verification of every finding → parallel web research → synthesis → completeness critic → finalize.
- **35 findings raised → 32 confirmed real (3 refuted), 7 research subjects, 4 critic gaps fixed.**
- Output: **`inbox/ezvibes-comprehensive-improvement-plan-2026-05-28.md`** — the full prioritized roadmap with `file:line` evidence, functionality-preservation notes, and a phased plan. **Read this first when resuming.**

### 2. Implemented Phase 1 (P0 safety) + related fixes
All on branch `feat/p0-folder-delete-safety` (base `main` @ `45995fa`):

| Commit | What | Key files |
|---|---|---|
| `024d648` | **P0** folder-delete: confine deletes to the declared parent (finding 1.1) + refuse delete when a live session runs at/under the target (finding 1.2) | `main.js`, `renderer/app.js`, `lib/path-safety.js`, `test/path-safety.test.js`, `package.json` |
| `44a95bd` | **Launch race:** `isTabStillAttached()` re-checks in `launchClaudeForPath` + `createTab` — no more orphan PTY / leaked `ResizeObserver` when a window is closed mid-open | `renderer/app.js` |
| `32d324d` | **CSP hardening:** add `base-uri` / `object-src` / `frame-src` / `form-action 'none'` | `renderer/index.html` |
| `c5beac1` | **Docs:** sync `CLAUDE.md` (delete contract, launch guard, test suite) | `CLAUDE.md` |

### New test infrastructure
- `npm test` → `node --test` (Node's built-in runner; **no external framework, no `npm install` required**).
- `lib/path-safety.js` — pure path guards: `isPathInside`, `isImmediateChildOf`, `liveSessionAtOrUnder`.
- `test/path-safety.test.js` — 16 unit tests, all green.

## Verification status

| Change | How verified |
|---|---|
| Delete confinement + subfolder guard | ✅ 16 unit tests + **user manual test** ("delete works perfectly") |
| Launch / new-tab race | ✅ code review + **user manual test** (closed window mid-animation, no orphan) |
| CSP hardening | ✅ near-zero risk (directives the app doesn't use); ⚠️ light smoke-test only |
| All source files | ✅ `npm run check:syntax` clean |
| ❌ Not done | branch not merged; no integration/E2E tests (needs Vitest harness) |

## Findings status — done vs. left (from the plan)

Legend: ✅ done this session · ⬜ open. Severity = adversarially-adjusted grade.

**Security — `main.js` / `preload.js`**
- ✅ 🔴 high — `fs:delete-folder` had no path confinement
- ⬜ low — agent `.cmd/.ps1` fallback via `cmd.exe /c` / `powershell -ExecutionPolicy Bypass` against first PATH match
- ⬜ low — `fs:list-directory` exposes any readable dir (no root confinement)
- ⬜ low — `clipboard:read` returns full system clipboard on demand
- ⬜ low — `app:log` lets renderer write arbitrary entries to the durable JSONL

**Main process / IPC — `main.js`**
- ⬜ medium — `before-quit` can permanently block quit when the main `webContents` is already destroyed
- ⬜ medium — `will-navigate` kills every PTY before deciding if navigation is even allowed
- ⬜ low — node-pty `onData/onExit` disposables never disposed (per-session listener leak)
- ⬜ low — `terminal:exit` still emitted for sessions the renderer explicitly closed
- ⬜ low — quit/close-confirm assumes a single window while `activate` can create more

**Renderer state — `renderer/app.js`**
- ✅ 🔴 high — `launchClaudeForPath` await-gap (orphan PTY + observer leak) — also fixed the twin in `createTab`
- ⬜ low — `closeNewTabMenu` document `mousedown` handler can leak if a window closes with its `+` menu open
- ⬜ low — `nextTabNumber` never reused → large default-label gaps after close/reopen

**Panel mode — `renderer/panel-mode.js`**
- ⬜ medium — dispatch gates on `ptyAlive` only, diverging from `isTabReadyForInput` (can write to a not-yet-spawned / stale tab)
- ⬜ medium — hard-coded absolute `EZVIBES_FOLDER` breaks dispatch if the repo moves
- ⬜ medium — dispatch targets only the EZvibes window's active tab, ignoring `getCurrentInputTab` + sibling live tabs
- ⬜ medium — bracketed-paste payload always appends a trailing CR → auto-submits
- ⬜ low — hard dependency on `window.ezvibesInternals` shape, no contract/versioning

**Build / native / packaging — `package.json`, `scripts/postinstall.js`**
- ⬜ medium — `postinstall` hard-fails `npm install` if node-pty's gyp source strings change
- ⬜ medium — `postinstall` assumes a full MSVC / node-gyp toolchain, no preflight or guidance
- ⬜ low — no packaged-build config (distribution = dev install + native rebuild)
- ⬜ low — `postinstall` `require('node-abi')` depends on a transitive dev dep, not declared directly

**UX / accessibility — `renderer/index.html`, `renderer/styles.css`**
- ⬜ 🔴 high — **folder context menu has no menu semantics, focus, or keyboard operation** ← last remaining high
- ⬜ medium — no `prefers-reduced-motion` support (infinite / large animations always run)
- ⬜ low — glyph-only icon buttons (accessible name not guaranteed)
- ⬜ low — disabled controls / muted text below 4.5:1 contrast on the dark theme
- ⬜ low — tab strip uses `overflow:hidden` with no scroll affordance; extra tabs unreachable

**Logging / data safety — `main.js`, `renderer/app.js`**
- ✅ 🔴 high — folder delete allowed while a live PTY runs in a subfolder (data loss)
- ⬜ medium — every log event does synchronous `mkdirSync`+`appendFileSync` on the main thread and swallows write errors
- ⬜ low — narration / transcript buffers grow unbounded in memory, lost on restart
- ⬜ low — JSONL logs appended forever, no rotation / retention
- ⬜ low — synchronous fs in IPC handlers blocks the app, returns raw error messages

**Research-backed items (web research — NOT adversarially verified; spot-check before trusting):**
- ⚠️ "Add a CSP" → **false positive**: a strict CSP already existed (hardened this session).
- ⬜ node-pty: stop patching Spectre mitigations out of `node_modules`; install Spectre-mitigated MSVC libs + document; pin Electron to an exact version.
- ⬜ xterm: keep the fit pipeline as-is; add `fitAddon.dispose()` on tab/window close; consider `@xterm/addon-webgl` with a context-loss → dispose fallback.
- ⬜ persistence: write a ~30-line atomic JSON store (avoid `electron-store` — ESM-only vs the CommonJS `main.js`); treat PTYs as non-restorable (relaunch, don't reattach).
- ⬜ packaging: `electron-builder` + NSIS with node-pty's `.node` / spawn-helper `asar-unpack`ed.
- ⬜ renderer org: split the ~1200-line IIFE into native ES modules; replace the `window.ezvibesInternals` global with explicit import/export.
- ⬜ testing: Vitest two-project setup (node for `main.js`, jsdom for renderer), mock `window.ezvibes` + node-pty at the boundary.

## Recommended next steps (priority order)

1. **Integrate this batch** — fast-forward merge `feat/p0-folder-delete-safety` into `main`, or open a PR. (4 verified commits; currently unmerged.)
2. **🔴 Folder context-menu a11y** — the last remaining high-severity finding. Renderer work → manual-verify pattern.
3. **Vitest + jsdom harness** — unblocks integration tests; add regression tests for the launch-race + delete IPC path. Install with `--ignore-scripts` to avoid the node-pty rebuild.
4. **Medium clusters** — panel-mode hardening (4 findings), main-process lifecycle (`before-quit` / `will-navigate`), async logging.
5. **Architecture (larger)** — ESM renderer split, session persistence, electron-builder packaging.

## Gotchas for whoever resumes (incl. future me)

- **TDD seam:** pure logic that `main.js` can `require` is testable with `node --test` (see `lib/path-safety.js`). Renderer-internal logic in `app.js` **cannot** be (`contextIsolation`, no `require`) → needs the **Vitest + jsdom** harness. We consciously skipped automated tests for the renderer-only launch-race fix (manual-verified) — add a regression test once the harness exists.
- **Don't run a bare `npm install` casually:** the `postinstall` rebuilds node-pty (fragile on Windows). For dev deps use `npm install <pkg> --save-dev --ignore-scripts`.
- **Folder-op safety is authoritative in `main.js`** — the renderer is not a trust boundary. Keep validating new `fs:*` handlers in main, not only in the renderer.
- **Keep the `isTabStillAttached()` re-checks** after the awaits in `launchClaudeForPath` / `createTab`, or the orphan-PTY race returns.
- **Markdown routing:** per the global `CLAUDE.md` rule, generated `.md` files go to `inbox/` with kebab-case names. The project-root copy is `summary_recap.md` (placed there by explicit request); this is the inbox copy.
