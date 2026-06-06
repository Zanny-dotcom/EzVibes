# EZvibes Codebase Audit & Improvement Plan

> **For agentic workers:** This is a **master program plan** spanning six independent subsystems. Each Wave below is intended to become its own executable sub-plan (via `superpowers:writing-plans`) when you start it. REQUIRED SUB-SKILL for execution: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the security, reliability, accessibility, build, and documentation issues found in a parallel audit + internet research pass — **without regressing any existing functionality**.

**Architecture:** EZvibes is a Windows Electron 42.2 launcher (vanilla JS/HTML/CSS, no framework/bundler) that embeds `node-pty` + `@xterm/xterm` terminals running `claude --dangerously-skip-permissions` / `codex --yolo` scoped to a folder. The renderer talks to main only via a `contextBridge` (`window.ezvibes`). This plan changes *internals and guardrails*, never the core interaction model.

**Tech Stack:** Electron 42.2 · node-pty 1.1.0 · @xterm/xterm 5.5.0 · @xterm/addon-fit 0.10.0 · @electron/rebuild 4.0.4 · Node ≥22.12 (repo pins 24.13).

**Date:** 2026-05-28 · **Source files referenced are absolute under** `C:\Users\Oskari\Documents\EZvibes\`.

---

## How this plan was produced

1. **Parallel audit** — 5 read-only sub-agents audited independent domains (main-process/security; `app.js`; panel-mode + CSS/HTML; build/launcher; docs/repo-hygiene). ~47 findings, ID-prefixed `MAIN-`, `APP-`, `UI-`, `BUILD-`, `DOC-`.
2. **Parallel internet research** — 5 sub-agents researched current (2025-2026) best practices for each cluster, each handed the specific finding IDs to address, returning **cited** recommendations (`SEC-R*`, `PTY-R*`, `PKG-R*`, `ARCH-R*`, `A11Y-R*`).
3. **Synthesis** — this document maps every finding to a fix, prioritizes by severity × blast-radius × effort, and sequences the work behind a regression safety net.

Full source list at the end. Confidence is High unless noted.

---

## Executive summary — health verdict

**EZvibes is in good shape and noticeably more security-conscious than a typical Electron app.** The dangerous-by-design core (`--dangerously-skip-permissions`) is wrapped in a hardened renderer (`contextIsolation`/`nodeIntegration:false`/`sandbox`/`webSecurity` all correct), navigation/window lockdown, a real CSP, per-session `webContents`-ownership checks on terminal IPC, multi-path PTY cleanup, and a secret-stripping PTY env allowlist. The terminal fit engine, the tab/window lifecycle, and the native-rebuild script (`postinstall.js`) are genuinely well-built and were independently confirmed as best-practice — **do not "improve" them blindly.**

The real gaps cluster into five themes:

| Theme | Headline issue | Worst severity |
|---|---|---|
| **Filesystem trust** | The renderer is the sole authority for *which* path to list/create/rename/**trash**/launch-an-agent-in. No confinement to trusted roots. | **High** (MAIN-1, MAIN-2) |
| **Quality net** | No tests, no linter, no CI. The "renderer must not use Node" rule is convention-only. No packaged build — runs only from a source checkout. | **High** (BUILD-1, BUILD-2) |
| **Accessibility** | Panel mode, tabs, and context menus are mouse-only; no `prefers-reduced-motion`. | **High** (UI-4, UI-6) |
| **Maintainability** | `app.js` is ~3,668 lines mixing 7 subsystems; agent enum is ternary-sprawled; panel-mode couples to `app.js` via an unguarded global. | **Medium** (APP-5, APP-6, UI-3) |
| **Doc drift** | An entire shipped feature (inbox/ACTIVATE) + 6 IPC channels + 5 preload methods are undocumented; `app.js` size claim off by 3×. | **High** (DOC-2, DOC-3, DOC-4) |

There are **no critical data-loss or RCE bugs** in the current code. The High-severity security items are *latent* (they require a renderer compromise to exploit) but are cheap to close because the correct helper already exists in the codebase.

### Corrections to assumptions (the audit briefs were partly wrong — reality is better)
- `.gitignore`, a committed `package-lock.json` (v3), and `.node-version` **all exist** and are correct. `node_modules` is untracked; **no secrets are committed.**
- A **CSP meta tag is present** and reasonably tight (`default-src 'self'`).
- `postinstall.js` is **robust** (idempotent, fail-loud, prints ABI diagnostics); the forced `--build-from-source` is **correct and necessary** (Electron 42 = ABI 146 ≠ host Node ABI; node-pty's bundled prebuild is not Electron-keyed).

---

## Guiding principles

1. **Safety net first.** Land lint + a launch/render smoke test + CI (Wave 0) *before* refactoring anything, so "keep functionality" is mechanically enforced, not hoped for.
2. **Smallest blast radius first.** Security (Wave 1) is high-severity but tiny-surface — do it early.
3. **One Wave = one PR/branch = one sub-plan.** Don't mix a security fix with a CSS refactor.
4. **Every change keeps the product behavior identical** unless a finding *is* a behavior bug (then the fix restores intended behavior).
5. **Re-run the smoke test + `npm run check:syntax` after every task.** Commit frequently.

### Functionality that MUST NOT regress (guardrail checklist — paste into every Wave's sub-plan)

- [ ] Hardened `webPreferences`: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, `webSecurity:true` — **never loosen.**
- [ ] Navigation/window lockdown: deny-all `setWindowOpenHandler`, `will-navigate` guard, deny-all permission handler.
- [ ] Per-session `webContents`-ownership checks on `terminal:input` / `resize` / `close` / `save-dropped-images`.
- [ ] PTY cleanup on every teardown path (`will-navigate`, `render-process-gone`, `destroyed`, window `closed`, `before-quit`).
- [ ] PTY env **allowlist-then-strip-secrets** ordering; the "never log terminal I/O" invariant.
- [ ] Existing path-confinement guards (dropped images under `cwd`; inbox `.md`-only read; `flag:'wx'` no-overwrite).
- [ ] `argv`-array `pty.spawn` (no shell string in the normal path) — keep; don't reintroduce a shell.
- [ ] XSS-safe rendering: folder/file/path/narration/tab text via `textContent`; the only dynamic `innerHTML` (`showError`) stays routed through `escapeHtml`.
- [ ] The **terminal fit engine** (animation/fonts/stable-layout/finite-`proposeDimensions` guards; never fit hidden 0×0 hosts; `visibleRepairSeq` stale-fit cancel; resize-only-on-change) — research confirms this is correct; **do not touch it except as APP-1 specifies.**
- [ ] Tab→window close cascade + `_closing`/`_minimizing` reentrancy guards; confirmation only on the last live tab.
- [ ] Genie open/minimize animation, **orange minimized folder state**, blue `.session-open` glow.
- [ ] Narration ("What Was Made") per-folder log + summary.
- [ ] In-app `node-pty` terminal (never a detached PowerShell window); xterm opens in `.terminal-host`, not `.terminal-pocket`; `.terminal-host[hidden]{display:none}`.
- [ ] Panel-mode: 4-listener add/remove symmetry on toggle; bracketed-paste **CR-normalization** (`\r?\n → \r`) and `\x1b[200~…\x1b[201~\r` wrap; clipboard fallback + toast when no live tab.
- [ ] Tab chip tinting matrix (amber Claude / teal Codex; active/hover/exited).
- [ ] Silent launch (wscript/VBS, no console flash); AppUserModelID `com.ezvibes.app` taskbar grouping + custom icon.
- [ ] `node-pty` pinned exact; the from-source rebuild remains the correctness fallback.

---

## Decisions needed from you (recommendations included)

These shape Waves 3 and 5. I recommend the **first option** in each case; the plan is written around the recommendation but notes the deltas.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| **D1** | `app.js` modularization delivery | **(a) Classic-script namespacing now** → `app://` protocol later | You can't flip to ES modules under `file://` (Chromium blocks ESM imports). Namespacing needs zero main-process change and starts today; `app://` is the clean medium-term end-state; a bundler (Vite) is *not* warranted for vanilla-no-npm-in-renderer. |
| **D2** | Packager | **electron-builder + NSIS** | Maintained Windows installer + native-module auto-unpack + AUMID + future auto-update in one tool. Forge is the "official" pick but its Windows makers are Squirrel (deprecated)/WiX-MSI. Genuine either/or. |
| **D3** | Code signing | **Defer (ship unsigned) for personal use; adopt Azure Trusted Signing if distributing** | Cheap OV certs no longer clear SmartScreen (EV/hardware-token required since 2023). Trusted Signing is the only economical token-free route — but it's region-gated to US/CA individuals; **confirm your eligibility** before relying on it. |
| **D4** | node-pty rebuild burden | **Stay on 1.1.0 + cache the compiled binary** (MSVC once, not per machine); pilot `1.2.0-beta` prebuilds later | The "drop-in prebuilt fork" (`@homebridge/...`) was **verified to have no Electron-42 prebuild** and would compile from source anyway. Caching is lowest-risk and is what packaging needs regardless. |
| **D5** | The `inbox/` backlog (31 untracked `.md`, ~424 KB) | **Commit a curated subset** (or gitignore `inbox/` if it's scratch) | Substantial research/planning work is currently uncommitted and at risk. Your global markdown-routing rule makes `inbox/` the canonical drop zone, so it probably *should* be in history. |

---

## Wave 0 — Quality safety net (do this FIRST)

**Why first:** every later Wave refactors working code. Lint + a smoke test + CI turn "I think it still works" into "CI says it still works." Addresses **BUILD-2** and unblocks safe execution of Waves 1-6.

**Findings:** BUILD-2. **Research:** ARCH-R5, ARCH-R6.

**Files:**
- Create: `eslint.config.js`, `.prettierrc.json`, `.editorconfig`, `.github/workflows/ci.yml`, `tests/smoke/launch.spec.js`, `playwright.config.js`
- Modify: `package.json` (devDeps + scripts)

- [ ] **0.1 — Install dev tooling.** `npm i -D eslint@9 @eslint/js globals prettier eslint-config-prettier @playwright/test`. Commit `package.json` + lockfile.
- [ ] **0.2 — ESLint flat config with a main/renderer split** (`eslint.config.js`). This is the mechanical enforcement of the "renderer must not use Node" rule:

```js
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  // Main process / preload / scripts: Node allowed
  {
    files: ['main.js', 'preload.js', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node }, ecmaVersion: 2023, sourceType: 'commonjs' },
  },
  // Renderer: browser only — forbid Node APIs
  {
    files: ['renderer/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ezvibes: 'readonly', ezvibesInternals: 'readonly' }, ecmaVersion: 2023 },
    rules: {
      'no-restricted-globals': ['error',
        { name: 'require', message: 'Renderer must use window.ezvibes (preload), not Node.' },
        { name: 'process', message: 'No Node in renderer.' },
        { name: '__dirname', message: 'No Node in renderer.' },
        { name: 'Buffer', message: 'No Node in renderer.' }],
      'no-restricted-imports': ['error', { paths: ['fs','path','os','child_process','electron'] }],
    },
  },
  prettier,
];
```

- [ ] **0.3 — Add `.editorconfig` + `.prettierrc.json`** (2-space indent, single quotes, semicolons — match existing style; do **not** reformat the whole repo in this commit, only set config).
- [ ] **0.4 — Wire scripts** in `package.json`: `"lint": "eslint ."`, `"test:smoke": "playwright test"`, `"verify": "npm run check:syntax && npm run lint && npm run test:smoke"`.
- [ ] **0.5 — Playwright launch/render smoke test** (`tests/smoke/launch.spec.js`). Keep CI to launch+render only — node-pty + `claude.exe` won't exist on a runner, and the app's close-guard blocks exit while sessions live, so **do not spawn a PTY in CI**:

```js
const { test, expect, _electron: electron } = require('@playwright/test');
test('app launches, shows window + folder grid', async () => {
  const app = await electron.launch({ args: ['.'] });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle(/EZvibes/i);
  await win.waitForSelector('[data-panel-id="folder-grid"], #folder-grid', { timeout: 15000 });
  await app.close();
});
```

- [ ] **0.6 — GitHub Actions CI** (`.github/workflows/ci.yml`) on `windows-latest` (matches the node-pty/Windows reality): `npm ci` → `npm run lint` → `npm run check:syntax` → `npm run test:smoke`. (node-pty rebuild runs in `postinstall`; allow it to build from source on the runner, or cache per D4.)
- [ ] **0.7 — Fix the lint errors Wave 0 surfaces** in a *separate* commit (expect some in `app.js`/`panel-mode.js`). Do not change behavior — only satisfy rules (and confirm none reveal a real renderer→Node leak).
- [ ] **0.8 — Verify:** `npm run verify` green locally and in CI. Commit.

> **Caveat (ARCH-R6):** Playwright's Electron support is *Experimental* and requires the `nodeCliInspect` fuse to remain enabled — relevant when Wave 5 flips fuses (SEC-R8). Keep a non-fused dev build for the smoke test, or gate the test accordingly.

---

## Wave 1 — Security hardening (high severity, small surface)

**Why now:** highest-severity findings, smallest code surface, and the correct helper (`isPathInside`, `main.js:259`) already exists. This Wave is detailed to executable granularity.

**Findings:** MAIN-1, MAIN-2, MAIN-3, MAIN-4, MAIN-5, MAIN-6, MAIN-7, MAIN-8, MAIN-9. **Research:** SEC-R1…R8, PTY-R1 (partial).

**Files:** Modify `main.js`, `preload.js`, `renderer/index.html`. Test: `tests/unit/path-confinement.test.js` (node:test).

### Task 1.1 — Confine all filesystem IPC + agent `cwd` to trusted roots (MAIN-1, MAIN-2 · SEC-R1/R2/R3)

The renderer must never be the authority for paths. Model it on VS Code Workspace Trust: an agent/terminal may only be launched, and folders only listed/created/renamed/trashed, **inside an allowlisted root**.

- [ ] **Step 1 — Write failing unit tests** (`tests/unit/path-confinement.test.js`, `node:test`) for a new `assertInsideAllowedRoot`:
  - accepts a path equal to a root and a child of a root;
  - rejects a sibling-prefix escape (`C:\Users\X\Docs-secret` when root is `C:\Users\X\Docs`);
  - rejects `..` traversal and absolute-path injection;
  - is case-insensitive on Windows (`c:\users\…` vs `C:\Users\…`).
- [ ] **Step 2 — Run, verify they fail** (`node --test tests/unit/path-confinement.test.js`).
- [ ] **Step 3 — Implement** in `main.js`, reusing the existing `isPathInside` (`:259`, already `path.relative`-based — correct) and `normalizePathForCompare` (`:422`). **Do NOT** use `startsWith` (the classic prefix-escape bug):

```js
// main.js — near the other path helpers
const ALLOWED_ROOTS = [documentsPath(), homePath(), desktopPath(), downloadsPath(), EZVIBES_ROOT]
  .filter(Boolean)
  .map((p) => path.resolve(p));

function assertInsideAllowedRoot(inputPath) {
  const resolved = assertDirectory(inputPath);           // existing: resolve + statSync().isDirectory()
  const ok = ALLOWED_ROOTS.some((root) => isPathInside(root, resolved)); // existing path.relative check
  if (!ok) throw new Error('Path is outside the allowed roots.');
  return resolved;
}
```
  Source: <https://www.electronjs.org/docs/latest/tutorial/security> (items 17, 20); <https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/>.

- [ ] **Step 4 — Wire it into every handler:** `fs:list-directory` (`:757`), `fs:create-folder` (parent, `:668`), `fs:rename-folder` (resolved entry + parent, `:700`), `fs:delete-folder` (`:733` — currently bypasses even `assertDirectory`; **most exposed**), and `terminal:create` `cwd` (`:1048`). Replace the bare `assertDirectory(...)` call in each with `assertInsideAllowedRoot(...)`.
- [ ] **Step 5 — Run unit tests + smoke test; manually confirm** normal browsing under Documents/Desktop/Downloads/Home/EZvibes still lists, creates, renames, deletes, and launches as before. Commit.

> **Keep-functionality note:** the allowlist must include exactly the roots `app:quick-paths` already exposes plus the EZvibes repo root, so no folder the user can currently reach becomes unreachable. If you navigate via the path bar to somewhere outside these roots today, decide whether to (a) widen roots to "the initial Documents root + any ancestor the user explicitly navigated to," or (b) accept the confinement. Recommend (a) only if free navigation outside Documents is a used feature.

### Task 1.2 — Validate IPC sender on privileged handlers (SEC-R4; defense-in-depth for MAIN-1/2/7/8)

- [ ] Add a `validateSender(event.senderFrame)` guard (parse `frame.url` with `URL`, require it to equal the app's loaded `file://` index — **not** a substring match) at the top of the `fs:*`, `app:log`, and `clipboard:*` handlers. The terminal channels already do per-session owner checks — keep those; this extends the same rigor. Source: <https://www.electronjs.org/docs/latest/tutorial/security> (item 17).

### Task 1.3 — Fix the close-confirmation latch (MAIN-3)

- [ ] `confirmedAppQuit` (`main.js:64`) is a permanent global once set (`:970`), so a later cancelled/aborted quit permanently disarms the "Exit EZvibes?" guard and silently kills live PTYs. **Fix:** scope the confirmation to the specific `requestId`/window, OR reset `confirmedAppQuit = false` after the quit settles (e.g., in a `will-quit`/post-`close` path). Add a regression note; this is the headline data-safety feature.

### Task 1.4 — Harden the renderer-driven log (MAIN-7 · SEC-R5)

- [ ] In `app:log` (`:979`): clamp `level` to `info|warn|error`; coerce/cap `event` to a string (or allowlist); cap `details` bytes (already length-capped per entry via `LOG_TEXT_MAX` — add a total/rate cap); keep stamping server-side `senderWebContentsId`; add a simple per-sender token-bucket rate limit. Prevents log forgery/flood.

### Task 1.5 — Trim the contextBridge surface (MAIN-8 · SEC-R6)

- [ ] Drop the standalone `getPathForFile` from the public `window.ezvibes` API (`preload.js:145`) — the drop handler already resolves paths internally via `resolveTerminalDroppedFiles`. Scope `clipboard:read` (`main.js:1238`) to the panel-mode paste fallback that actually needs it. (Both behind 1.2's sender guard.) **Verify** drag-drop-into-terminal and panel-mode paste still work.

### Task 1.6 — Tighten CSP (don't chase the impossible) (MAIN-9 · SEC-R7)

- [ ] **xterm 5.5 cannot drop `style-src 'unsafe-inline'`** (no nonce API — issue [#4445](https://github.com/xtermjs/xterm.js/issues/4445)). So **do not** try. Instead tighten the *rest* in `renderer/index.html`:
```html
<meta http-equiv="Content-Security-Policy"
 content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
          img-src 'self' data:; font-src 'self' data:; connect-src 'none';
          object-src 'none'; base-uri 'none'; frame-src 'none'">
```
  Add a code comment + CLAUDE.md note that the style exception is dictated by xterm and tracked at #4445. Keep `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`).

### Task 1.7 — Small correctness bugs (MAIN-4, MAIN-5, MAIN-6)

- [ ] **MAIN-4:** drop `pendingCloseRequests` entry on window `'closed'`/`render-process-gone`; add size/retention cap to the JSONL log writer (`:119`).
- [ ] **MAIN-5:** in dropped-image accounting (`:1194`), only add `buffer.length` to `totalBytes` **after** an image is accepted (today a rejected oversized image still inflates the total, spuriously rejecting later valid images).
- [ ] **MAIN-6:** in `buildPtyEnv`, collapse duplicate-case env keys (e.g. `Path`/`PATH`) to one canonical key so `getEnvKey` (`:389`) can't read one while a write targets another.

**Wave 1 verification:** `npm run verify` green; manual pass of browse/create/rename/delete/launch/minimize/restore/drag-image/panel-paste; attempt to list/launch outside an allowed root is rejected. Then write a short **security-review note** to the inbox.

---

## Wave 2 — Renderer reliability fixes (correctness, low-risk)

**Findings:** APP-1, APP-2, APP-3, APP-4, APP-7, APP-9, APP-10, APP-12. **Research:** PTY-R1.

- [ ] **APP-1 (PTY-R1) — deterministic teardown.** Push the `term.onData(...)` disposables (`app.js:1718`, `:2624`) into `tab.terminalDisposables` like `onScroll`/`onResize`; call `disposeTerminalViewportTracking(tab)` **before** `tab.term.dispose()` (`:2582`, `:2760`); null out `tab.term`/`tab.fitAddon` after dispose; guard double-dispose. (Research confirmed the leak is *mostly* mitigated by `dispose()` today, but it's the sole path and is `try/catch`-wrapped — this makes it deterministic.)
- [ ] **APP-2 — animation-listener leak.** `animateOpen` (`:2807`) is the only animation listener with **no timeout fallback**; if `opening` never fires (reduced-motion, hidden, rapid minimize→restore) the listener leaks and the `opening` class sticks. Mirror the `minimizeSessionWindow` pattern: add `setTimeout(finish, 500)` that removes the listener + clears the class. (Coordinates with Wave 4's reduced-motion work.)
- [ ] **APP-3 — stuck "New folder" button.** Always reset `els.newFolderBtn.disabled = false` inside `clearDraftFolder()` and guard the async create with a sequence token (like `inboxLoadSeq`) so a cancel-during-create can't leave the button disabled with no draft visible. (`:777`, `:743-804`).
- [ ] **APP-4 — OSC-9 parsing.** Treat OSC-9 free-text as a single body (don't split on the first `;`) or document `;` as a reserved title/body separator (`:2142`). Low impact (narration text only).
- [ ] **APP-7 / APP-9 / APP-10 (Low, batch):** clear `state.lastActiveTabId` on its tab's close; make `cssEscape` fallback escape backslashes too (or drop it — Electron always has `CSS.escape`); log when the app-close prompt is suppressed by `_modalInFlight`.
- [ ] **APP-12 — de-dup boilerplate.** Extract `positionFloatingMenu(el, x, y)` and `awaitAnimationEnd(el, {timeout})` helpers; replace the 3× context-menu clamp blocks and 3× animationend-with-timeout blocks. (Do this last in the Wave — it touches several sites.)

**Verification:** smoke test + manual open/close/minimize/restore cycles ×N (watch for listener growth in DevTools), folder create/cancel races, tab close.

---

## Wave 3 — Architecture & maintainability

**Findings:** APP-5, APP-6, UI-2, UI-3. **Research:** ARCH-R1…R4. **Depends on:** Wave 0 (lint/CI) as the safety net. **This Wave should become its own detailed sub-plan** (especially the `app.js` decomposition).

### 3.1 — Agent registry (kill ternary sprawl) — APP-6 · ARCH-R4 *(do first: low-risk, high-value)*
- [ ] Replace the ~8 `agent === 'codex' ? … : …` sites (`app.js:1787,1791,2214,2344,2437,2610-2611,1905-1906`) with one frozen `AGENTS` registry: `Object.freeze({ claude: {command,args,label,short,chipClass,…}, codex: {…} })` + a `normalizeAgent(id)` helper (`AGENTS[id] ?? AGENTS.claude`). Mirror the shape in `main.js`'s `AGENT_COMMANDS`. Adding a third agent becomes one entry. Source: registry/object-lookup pattern.

### 3.2 — Guard the `ezvibesInternals` contract — UI-3 · ARCH-R3
- [ ] Replace the unguarded global (`app.js:3653`, consumed `panel-mode.js:191`) with a `defineInternals(obj)` that `Object.freeze`s and stamps a `version`, and an `assertInternals()` at the top of panel-mode init that `console.error`s via `window.ezvibes.logEvent` + disables the feature if a method is missing — so a rename fails **loudly at load**, not silently at click. Add JSDoc `@typedef` + `// @ts-check` for editor-level checking (no TS adoption). Document the contract in CLAUDE.md.

### 3.3 — Panel registry hygiene — UI-2
- [ ] The `PANEL_REGIONS` `file:line` annotations are **already stale/wrong** (e.g. `folder-card` says `~595`, actual 842/1040) and the payload advertises them to the agent. Drop the hand-maintained line numbers (or generate them); centralize `name`/`selector`/`describe` so `openComposer` and `buildPayload` read the single registry entry. (`panel-mode.js:4-41`.)

### 3.4 — Decompose `app.js` — APP-5 · ARCH-R1/R2 *(largest; multi-session)*
- [ ] **Decision D1 gates this.** You **cannot** flip `<script>`→`type="module"` under `loadFile`/`file://` (Chromium CORS-blocks ESM imports — confirmed). Recommended path:
  - **Step A (now, zero main-process change):** introduce one stable seam — `window.EZ = { bus, state, … }` with a tiny pub/sub `bus` — and extract subsystems one at a time into ordered classic `<script>` files (`narration.js`, `inbox-drag.js`, `live-log.js`, `modal.js`, `activate.js`, `session-window.js`, and **terminal last**), each owning its slice of the current ~45-field `state`. Keep `node --check`/lint green per file; smoke test after each extraction.
  - **Step B (medium-term):** if you want real `import`/`export`, register a privileged `app://` scheme (`protocol.registerSchemesAsPrivileged` + `protocol.handle`, ~15 lines in `main.js`) and switch `loadFile`→`loadURL('app://…')`. **Coordinate with the security owner** (touches protocol/origin). Mark this `[verify as an official ESM recipe]` — it's well-attested as a CORS workaround, not a documented Electron ESM recipe.
  - **Do NOT adopt a bundler** purely for modularization — the renderer imports no npm packages (xterm is a global script), so Vite/esbuild buys little here and breaks the no-bundler charter.

---

## Wave 4 — Accessibility, motion & design tokens

**Findings:** UI-4, UI-5, UI-6, UI-7, UI-11 + contrast. **Research:** A11Y-R1…R8. Each item cites WAI-ARIA APG / WCAG 2.2 / MDN.

- [ ] **A11Y-R4 — `prefers-reduced-motion` *(quick win, do first)*.** Add `@media (prefers-reduced-motion: reduce)` blocks that snap-to-final the Genie (`styles.css:1147/1163`), replace the **infinite** `attentionPulse` (`:1515`) with a static high-contrast state, and shorten/disable the modal animations (`:1489/1494`). Mirror in JS via `matchMedia` where motion is JS-driven. Chromium/Electron honors the OS setting.
- [ ] **A11Y-R1 — Tabs pattern.** `role="tablist"` on the strip; `role="tab"` + `aria-selected` + `aria-controls` + roving `tabindex` on chips; `role="tabpanel"` + `aria-labelledby` on the terminal host. **Manual activation** (Enter/Space), Left/Right/Home/End to move, Delete to close — to avoid thrashing the fit logic on every arrow. APG Tabs.
- [ ] **A11Y-R2 — Context menu pattern.** `role="menu"`/`menuitem` on `#context-menu` (`index.html:85`); `aria-disabled` on disabled rows (keep focusable for the tooltip); move focus in on open; Up/Down/Home/End/Enter/Escape + typeahead; **return focus to the invoking card** on close. APG Menu.
- [ ] **A11Y-R3 — Panel mode keyboard nav.** Treat `PANEL_REGIONS` as a roving-tabindex group: Tab/Shift+Tab (or arrows) cycle regions, paint the highlight on `focusin`, Enter/Space open the composer, Escape exits; add a visually-hidden `aria-live="polite"` announcer for the focused region's name + `file:line`. APG keyboard-interface + MDN toolbar role.
- [ ] **A11Y-R5 — Dialog focus management.** Give the composer + modal `role="dialog"` + `aria-modal` + `aria-labelledby`; **trap** Tab/Shift+Tab; return focus to the invoker on close (composer currently focuses its textarea but doesn't trap or restore — `panel-mode.js:159/162`). APG Dialog.
- [ ] **A11Y-R7 — Contrast fixes (computed).** Two states fail WCAG 2.2 AA (4.5:1) at one gradient end: inactive **Claude** text `#2a2008` → **3.58:1** at `#a06d12` (`styles.css:788-789`); inactive **Codex** text `#e6f6fb` → **3.95:1** at `#3a8294` (`:957-960`). Darken the text or adjust the failing gradient stop so the *worst point* clears 4.5:1. (Re-check the two alpha-composited cases — folder-name label, codex badge — with a contrast picker.)
- [ ] **A11Y-R6 / A11Y-R8 — Tokens & z-index scale.** Add a two-tier token set (primitive `--amber-500`/`--teal-500`/`--red-500` → semantic `--color-accent`/`--color-danger`/`--chip-claude-bg`…) and migrate hard-coded colors (codex-teal `:957-982`, danger reds, folder ambers); replace the scattered z-index magic numbers (`:254,297,454,674,724,1032,1118,1313,1389,1420,1577,1603`) with a named scale (`--z-context-menu`, `--z-modal`, `--z-panel`…). Document both in CLAUDE.md.

> Pitfall (A11Y): never add `role`/`aria-*` without the matching keyboard wiring — that's worse than nothing. Roles and keys ship together.

---

## Wave 5 — Build, native deps, packaging & distribution

**Findings:** BUILD-1, BUILD-3, BUILD-4, BUILD-5, BUILD-6, BUILD-7, BUILD-9. **Research:** PKG-R1…R8, PTY-R2/R3, SEC-R8. **This Wave should become its own sub-plan.**

- [ ] **BUILD-7 / PKG-R4 *(prereq)*** — add `author`, `license` (SPDX), `repository` to `package.json` + a `LICENSE` file. (electron-builder warns/blocks without them.)
- [ ] **BUILD-4 / D4 / PTY-R2/R3 — tame the native rebuild.** **Do not** switch to `@homebridge/node-pty-prebuilt-multiarch` — verified to ship no Electron-42/ABI-146 prebuild, so it falls back to the same MSVC compile. Instead: keep `node-pty@1.1.0` and **cache the compiled binary** (commit per-ABI or store as a CI/release artifact) so MSVC is a one-time/CI cost; optionally pilot `node-pty@1.2.0-beta` (or `@lydell/node-pty`) prebuilds behind testing (pre-release; Electron-42 ABI coverage unconfirmed). Document the **VS Build Tools + Desktop C++ workload** prerequisite in CLAUDE.md (BUILD-4) and standardize on `npm ci` (BUILD-5).
- [ ] **BUILD-1 / PKG-R1/R2 — package with electron-builder + NSIS (D2).** Add a `build` config: `appId:"com.ezvibes.app"`, `productName:"EZvibes"`, `win.icon:"renderer/ezvibes.ico"`, NSIS target, and **`asarUnpack:["**/*.node","**/node_modules/node-pty/**"]`** (node-pty ships both a loaded `.node` *and* a spawned ConPTY helper exe — both must be outside the asar, or the packaged app "works in dev, crashes packaged"). Run the ABI-matched `electron-rebuild` **before** packaging.
- [ ] **BUILD-9 / PKG-R3 — retarget the launcher.** Let NSIS create the Start Menu/desktop shortcuts and own the AUMID + icon (`appId` *is* the AUMID for NSIS); keep `app.setAppUserModelId('com.ezvibes.app')` before the first window. The packaged exe launches with no console, so **`ezvibes.vbs` and the COM-AUMID PowerShell installer can be retired for installed users** (keep them for run-from-source dev). For auto-launch use `app.setLoginItemSettings({openAtLogin:true})`.
- [ ] **SEC-R8 — Electron fuses at package time.** Flip `runAsNode:false`, `enableNodeOptionsEnvironmentVariable:false`, `enableNodeCliInspectArguments:false`, `onlyLoadAppFromAsar:true`, `enableEmbeddedAsarIntegrityValidation:true`. (Note the Playwright smoke test needs `nodeCliInspect` — use a separate non-fused dev build for tests.)
- [ ] **D3 / PKG-R5/R6/R7 — signing (optional).** Personal use: ship unsigned (expect a one-time SmartScreen "Unknown publisher" prompt). Distributing: adopt **Azure Trusted Signing** (token-free, ~\$10/mo `[verify pricing + your region eligibility]`); **always RFC-3161 timestamp** (its certs auto-rotate ~every 3 days) and set NSIS `publisherName` to the exact cert subject. Signing does **not** instantly remove SmartScreen — reputation is download-driven.
- [ ] **BUILD-3 / BUILD-6 (Low) — tidy:** declare `node-abi` as an explicit devDep (the `postinstall.js` ABI diagnostic relies on it transitively) or drop that diagnostic; align `engines.node` (`>=22.12`) with `.node-version` (`24.13`).
- [ ] **PKG-R8 — auto-update:** defer (NSIS keeps the door open for `electron-updater` + GitHub Releases later; only worth it with external users + signing).

---

## Wave 6 — Documentation & repo hygiene

**Findings:** DOC-1…DOC-10. Mostly fast; do alongside the relevant Waves (e.g. update CLAUDE.md's IPC list when you touch IPC in Wave 1).

- [ ] **DOC-1 — fix the size claim.** `CLAUDE.md:39` says `app.js` is "~1200 lines"; it's **~3,668** (`wc -l`; PowerShell `Measure-Object -Line` undercounts blank lines — use `wc -l`/`git`). Re-measure at edit time; consider dropping the hard number.
- [ ] **DOC-2/3/4 — document the shipped-but-undocumented surface.** Add an **"Inbox / ACTIVATE"** subsection (Current UX + Key Files); add the **6 missing IPC channels** (`activate:file-path`, `activate:open-file`, `inbox:list-markdown`, `inbox:read-markdown`, `terminal:save-dropped-images`, `app:window-lifecycle [main→renderer]`) and **5 preload methods** (`onWindowLifecycle`, `getActivateFilePath`, `openActivateFile`, `listInboxMarkdownFiles`, `readInboxMarkdown`) to the Runtime-Model lists. Document the `ezvibesInternals` contract (from 3.2).
- [ ] **DOC-10 — fix dangling reference.** Confirm whether `tab-plan.md` still exists at the repo root (`CLAUDE.md:49` references it but it's not in `git ls-files`); drop the line or commit the file.
- [ ] **DOC-5 — add a short `README.md`** (points to CLAUDE.md) + the LICENSE from Wave 5.
- [ ] **DOC-6 — gitignore `marketing/remotion/`** (its source/`out/` are currently NOT ignored — a `git add -A` would commit a whole second Node project).
- [ ] **DOC-7/D5 — decide the `inbox/` policy:** commit a curated subset (recommended — meaningful research is at risk) or gitignore `inbox/` if it's scratch. **DOC-8:** add a CLAUDE.md pointer to where research lives and reconcile `research/` vs `inbox/research-*`. **DOC-9:** delete the stray 0-byte `inbox/New Text Document.txt`.

---

## Verification strategy (every Wave)

1. `npm run verify` (check:syntax + lint + Playwright launch/render smoke) green locally and in CI.
2. **Manual regression pass** against the *Functionality that must not regress* checklist above — minimally: browse → Launch Claude → tab open/close → minimize (orange) → restore → drag image → panel-mode send → narration updates → app-close confirmation with a live session.
3. For Wave 1, add the **path-confinement unit tests** and an explicit "reject outside allowed root" check.
4. Use `superpowers:requesting-code-review` before merging each Wave; write the review/security note to the inbox per the routing rule.

## Suggested sequencing

```
Wave 0 (safety net)  ──►  Wave 1 (security)  ──►  Wave 2 (reliability)
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                            ▼
   Wave 3 (arch)           Wave 4 (a11y/UI)            Wave 5 (build/pkg)
        └──────────────────────────┴───────────────────────────┘
                                   ▼
                          Wave 6 (docs — fold into each Wave as you go)
```
Waves 3/4/5 are independent and can run in parallel branches once 0-2 land. Wave 6 is continuous.

---

## Appendix A — Consolidated findings → Wave map

| ID | Sev | Theme | Wave |
|---|---|---|---|
| MAIN-1 | High | FS confinement (list/create/rename/trash anywhere) | 1.1 |
| MAIN-2 | High | Agent `cwd` unconfined | 1.1 |
| MAIN-3 | Med | `confirmedAppQuit` latch disarms close-guard | 1.3 |
| MAIN-4 | Low | Unbounded `pendingCloseRequests` + JSONL log | 1.7 |
| MAIN-5 | Low | Drop-size accounting over-rejects | 1.7 |
| MAIN-6 | Low | `getEnvKey` case-shadowing | 1.7 |
| MAIN-7 | Low | Renderer `app:log` forgery/flood | 1.4 |
| MAIN-8 | Low | `clipboard:read` / `getPathForFile` exposure | 1.5 |
| MAIN-9 | Low | CSP `style-src 'unsafe-inline'` | 1.6 |
| APP-1 | Med | `onData` disposable not tracked | 2 |
| APP-2 | Med | `animateOpen` listener leak (no timeout) | 2 |
| APP-3 | Med | "New folder" button stuck-disabled | 2 |
| APP-4 | Low | OSC-9 title/body split | 2 |
| APP-5 | Med | 3.6k-line IIFE, 7 subsystems | 3.4 |
| APP-6 | Med | Agent ternary sprawl | 3.1 |
| APP-7/9/10 | Low | stale id / cssEscape / modal-swallow | 2 |
| APP-11 | Low | Narration input reconstruction (document it) | 6 |
| APP-12 | Low | Duplicated menu/animation boilerplate | 2 |
| UI-1 | Med | Hard-coded `EZVIBES_FOLDER` | 3.4 (resolve via runtime path) / 5 (packaged path) |
| UI-2 | Med | Stale `PANEL_REGIONS` line numbers | 3.3 |
| UI-3 | Med | Unguarded `ezvibesInternals` | 3.2 |
| UI-4 | High | Panel mode mouse-only | 4 (A11Y-R3) |
| UI-5 | Med | No `prefers-reduced-motion` | 4 (A11Y-R4) |
| UI-6 | High | Tabs/menus lack ARIA + keyboard | 4 (A11Y-R1/R2) |
| UI-7 | Low | Under-used tokens | 4 (A11Y-R6) |
| UI-8 | Low | Highlight not reconciled on scroll/resize | 4 |
| UI-9 | Low | Bracketed-paste terminator not escaped | 1.5/2 |
| UI-10 | Low | `console.log` vs `logEvent` | 3.2 |
| UI-11 | Low | z-index magic numbers | 4 (A11Y-R8) |
| BUILD-1 | High | No packaging config | 5 |
| BUILD-2 | High | No tests/lint/CI | 0 |
| BUILD-3 | Low | `node-abi` transitive dep | 5 |
| BUILD-4 | Med | Forced from-source rebuild | 5 (D4) |
| BUILD-5 | Med | Dep versioning / `npm ci` | 5 |
| BUILD-6 | Low | `engines` vs `.node-version` | 5 |
| BUILD-7 | Low | Missing license/repo/author | 5 |
| BUILD-8 | Low | Installer needs ExecutionPolicy bypass | 6 (doc) / 5 (retire installer) |
| BUILD-9 | Med | Launcher hard-binds to in-repo electron | 5 |
| DOC-1…10 | High→Low | Doc drift + repo hygiene | 6 |

## Appendix B — Sources (deduped)

**Electron security:** electronjs.org/docs/latest/tutorial/security (20-item checklist; items 7/17/19/20) · github.com/electron/electron tutorial/security.md · nodejsdesignpatterns.com/blog/nodejs-path-traversal-security · code.visualstudio.com/docs/editing/workspaces/workspace-trust (Workspace Trust model) · github.com/xtermjs/xterm.js/issues/4445 (CSP unsafe-inline).
**node-pty / xterm:** github.com/microsoft/node-pty + README (ConPTY, `handleFlowControl`, build-from-source) · npmjs.com/package/node-pty (1.1.0 stable; 1.2.0-beta) · api.github.com/repos/homebridge/node-pty-prebuilt-multiarch/releases/tags/v0.13.1 (**no Electron-42 prebuild**) · xterm PR #1525 (dispose tears down listeners) + issues #3939/#5181/#2351/#4841 · npmjs.com/package/@xterm/addon-webgl.
**Packaging/signing:** electron.build/nsis · electron.build/configuration · electronforge.io/config/plugins/auto-unpack-natives · electronjs.org/docs/latest/tutorial/using-native-node-modules · electronjs.org/docs/latest/tutorial/code-signing · learn.microsoft.com/azure/artifact-signing/* · learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation · electron.build/auto-update.
**Architecture/testing:** electronjs.org/docs/latest/tutorial/esm (file:// blocks ESM) · electronjs.org/docs/latest/tutorial/automated-testing + blog/spectron-deprecation-notice · playwright.dev/docs/api/class-electron · vitest.dev/guide/environment · eslint.org/docs/latest/rules/no-restricted-imports · github.com/eslint/eslint/discussions/18559 (flat-config per-dir globals).
**Accessibility/tokens:** w3.org/WAI/ARIA/apg/patterns/{tabs,menu,dialog-modal} + practices/keyboard-interface · developer.mozilla.org ARIA toolbar role + CSS/@media/prefers-reduced-motion · web.dev/articles/prefers-reduced-motion · w3.org/WAI/WCAG22/Understanding/contrast-minimum · design.gitlab.com/product-foundations/design-tokens-using (primitive vs semantic tokens).

*(Volatile specifics — Trusted Signing pricing/eligibility, node-pty beta ABI coverage, the `app://`-for-ESM recipe — are flagged for confirmation before relying on them.)*
