# Build Plan — Visual HTML Editor with Embedded AI Terminal

> **Inbox copy** of the project-root file `C:\Users\Oskari\Documents\web-design\BUILD-PLAN.md` (kept here per the markdown-routing rule; the canonical copy must live in the project root so the project is self-describing).

> **What this is (one line):** a beginner-friendly Windows desktop app that opens any `.html` file, lets a non-coder click+drag elements to reposition them (per-drag toggle: tidy-reorder vs free-placement), saves changes back to the real file cleanly, and embeds a Claude Code terminal already `cd`'d into the file's folder.
>
> Plain-language overview for non-technical readers: project root `README-WHAT-THIS-IS.md`.
> Tool-choice justification + research: `visual-html-editor-electron-decision-brief.md` (this inbox).

**Working name:** PageHands (placeholder — rename freely).
**Target platform:** Windows 11 (primary). Stack is cross-platform; Windows is what we test against.
**Audience for the *app*:** zero coding knowledge. **Audience for *this plan*:** the builder (Claude or a dev).
**Date:** 2026-06-05.

---

## 1. Guiding principles

1. **Layered delivery.** Every layer ends in a runnable app. No layer breaks a previous one. The user only adopts it when fully ready, but we keep it runnable throughout so progress is verifiable.
2. **The model is the truth.** A normalized in-memory HTML tree is the single source of truth. The on-screen page, the overlay chrome, and the saved file are all *derived* from it. Editor chrome (highlight boxes, handles, temporary IDs) is excluded from saved output *by construction*.
3. **Surgical saves.** Default save overwrites only the character ranges that changed (parse5 offsets + `magic-string`). Everything untouched passes through byte-for-byte. No accidental reformatting of the user's file.
4. **Every action is a command.** Move/insert/delete/edit all go through a command-pattern history (execute/undo). Undo/redo, multi-select, and future features layer on *without restructuring*.
5. **Security is not optional.** `contextIsolation` on, `sandbox` on, `nodeIntegration` off. The renderer never touches Node directly; a narrow, zod-validated preload bridge is the only door to privileged fs/PTY operations. User HTML is sanitized on load (a privileged shell + injected XSS = remote code execution).
6. **Test the *packaged* app, not just dev.** The highest-risk failures (native `node-pty`/ConPTY) only appear in the installed build. A clean-machine install test is a release gate.

---

## 2. Locked-in technology stack

All choices below are decided. Versions are June-2026 current; bump on a schedule and re-test.

| Concern | Choice | Short why |
|---|---|---|
| Desktop shell / runtime | **Electron 42.x** (pin 42.3.x; Chromium 148 / Node 24) | One consistent Chromium → what-you-see-is-what-you-get; all-JavaScript → no Rust needed for the PTY terminal; mature packaging + auto-update. |
| Dev scaffolding / bundler | **electron-vite** (Vite, TypeScript) | Fast HMR; clean `main` / `preload` / `renderer` separation. |
| Installer / packaging | **electron-builder**, **NSIS one-click** (`oneClick: true`) | Near-silent double-click install; only Windows target supporting `electron-updater` auto-update; actively maintained. |
| Page canvas | **Same-process sandboxed `<iframe>`** (`sandbox="allow-scripts allow-same-origin"`) | Host must synchronously read the page DOM + align overlays pixel-perfectly. Out-of-process `WebContentsView`/`<webview>` cannot. |
| Editor data model | **Custom normalized DOM tree**, parsed with **parse5 8.0.1** (`sourceCodeLocationInfo: true`); each node carries `sourceCodeLocation` + a stable `nodeId` | Deliverable is *arbitrary editable HTML → real file*. Only an HTML-native model supports "select ANY element" + "clean HTML out." (Puck/craft.js JSON model **cannot ingest arbitrary HTML** — rejected.) |
| Selection / handles / labels | **Custom overlay layer in the host document** (not the iframe), positioned via `getBoundingClientRect` + iframe offset + scroll; re-measured with `ResizeObserver` + rAF-throttled scroll | Chrome lives outside the edited element → never pollutes saved HTML; survives the iframe boundary. |
| Tidy-reorder drag (flow) | **SortableJS** (~3.7M wk dl) | Element stays `position:static`, drops between siblings. |
| Free-placement drag + resize | **Moveable** (daybrush/moveable) — **NOT interact.js** | interact.js is flagged inactive/discontinued; Moveable is maintained. |
| Save / HTML round-trip | **parse5 offsets + magic-string** surgical splice | Overwrite only changed char-ranges, pass the rest verbatim → minimal, clean diffs. |
| Inline text editing | **`contenteditable` one container at a time**; optional Tiptap/ProseMirror later, per-container | Tiptap wants full ownership of its root. |
| Terminal UI (renderer) | **@xterm/xterm 6.0.0** + **@xterm/addon-fit 0.11.0** | Current. Verify 3rd-party addons target v6. |
| Terminal PTY (main only) | **node-pty 1.1.0** (1.2.0-beta newest ABI) in the **main process** | Real PTY → `isTTY` true → Claude Code's Ink UI works. |
| File watching | **chokidar** (`awaitWriteFinish`, watch the *directory*) | Reconcile external edits — including Claude Code editing the same folder. |
| IPC validation | **zod** schemas; check `event.senderFrame.url` | Main holds privileged fs/pty. |
| Native rebuild safety | **@electron/rebuild 4.0.4** / `electron-builder install-app-deps` | ABI insurance for node-pty. |
| HTML sanitization | **DOMPurify** on load | Neutralize XSS before it meets a privileged shell. |
| Language | **TypeScript** everywhere; shared types in `src/common` | One contract across processes. |
| Future: image crop | **react-easy-crop 5.x** | Pinch/zoom; returns `croppedAreaPixels`. |
| Future: asset storage | blob bytes over IPC → `fs` under `userData/<project>/assets/`; serve via **`app://`** | Portable, CSP-safe; never `file://`. |
| Future: dropped-file path | `webUtils.getPathForFile(file)` in **preload** (NOT `File.path`) | Returns `""` for dragged files → fall back to reading bytes over IPC. |

### Hard "do NOT" list (traps the research caught)
- **Do NOT** adopt Puck / craft.js / react-beautiful-dnd (JSON-model can't round-trip arbitrary HTML; rbd deprecated).
- **Do NOT** treat parse5 offsets as *byte* offsets — they're **UTF-16 character** offsets. Guard `sourceCodeLocation === undefined`.
- **Do NOT** rely on parse5 `RewritingStream` for clean output (re-serializes once a listener attaches).
- **Do NOT** save via full re-serialization on the default path.
- **Do NOT** use interact.js for free-placement (unmaintained).
- **Do NOT** ship unsigned to wide distribution without a code-signing cert (SmartScreen). Fine for personal/local use now.

---

## 3. Architecture overview

Single `BrowserWindow`. The **renderer** hosts chrome + a sandboxed `<iframe>` canvas:

```
┌───────────────────────────────────────────────────────────┐
│  Toolbar:  [Open]  [Save]  [Undo] [Redo]   ◉ Tidy ○ Free   │
├──────────────┬──────────────────────────────┬─────────────┤
│  Widget       │     <iframe> CANVAS          │  Inspector   │
│  sidebar      │     = the user's page        │  (LATER)     │
│  (LATER)      │     + host overlay on top    │              │
├──────────────┴──────────────────────────────┴─────────────┤
│  TERMINAL  (xterm.js)  ── Claude Code, cwd = file's folder │
└───────────────────────────────────────────────────────────┘
```

**Process responsibilities**
- **main** (privileged): file open/save (atomic temp+rename), directory watch (chokidar), node-pty, `app://` later. Holds all Node access.
- **preload** (contextBridge): tiny zod-validated API — `openFile`, `saveDocument`, `watch*`, `pty.*`.
- **renderer** (no Node): the editor — parse, iframe render, selection/overlay/drag, command history, xterm.

**Data flow (open → edit → save)**
```
fs.read (main) → IPC → parse5 → normalized tree (nodeId + sourceCodeLocation)
   → render iframe (transient data-editor-id at render only)
   → click → SelectionController → overlay box
   → drag  → MoveNode/InsertNode command
   → command.execute() mutates the TREE → re-render iframe + overlay
   → Ctrl+S → diff changed nodes → magic-string overwrites against ORIGINAL file text
   → IPC → main fs atomic write
```

---

## 4. Module breakdown (target file layout)

```
src/
  main/      index.ts, fs-service.ts, watch-service.ts, pty-service.ts, asset-protocol.ts(LATER)
  preload/   index.ts
  common/    ipc-contracts.ts (zod), types.ts
  renderer/
    app.ts
    model/     parse.ts, serialize.ts, tree.ts
    canvas/    iframe-host.ts, iframe-bootstrap.ts
    overlay/   overlay.ts, rects.ts (vendored nested-rect math)
    interaction/ selection.ts, drag-flow.ts (SortableJS), drag-free.ts (Moveable), mode-toggle.ts
    history/   command.ts, history.ts, commands/ (MoveNode, InsertNode, DeleteNode, SetText, SetStyle…)
    terminal/  terminal.ts (xterm + fit)
    inspector/ (LATER)
    widgets/   (LATER)
electron.vite.config.ts, electron-builder.yml, package.json
```

---

## 5. The layered roadmap

Each layer is independently runnable. **Definition of Done** includes a manual verification step (the app actually doing the thing).

- **Layer 0 — Skeleton that runs.** electron-vite + TS scaffold; secure `BrowserWindow` (`contextIsolation/sandbox` on, `nodeIntegration` off); strict CSP; empty layout regions; one zod-validated IPC ping. *DoD:* window opens, ping returns, no security warnings.

- **Layer 1 — Open + drag/move + auto-save + terminal (first real version).**
  - **1a Open & render** — dialog → `fs.read` (preserve bytes/BOM/CRLF) → parse5 (`sourceCodeLocationInfo`) → tree → DOMPurify → iframe.
  - **1b Select & highlight** — iframe bootstrap forwards events → resolve nodeId → host overlay box, tracks scroll/resize.
  - **1c Drag with Tidy/Free toggle** — Tidy=SortableJS reorder; Free=Moveable absolute drag (+resize); each drop = `MoveNode` command → tree mutate → re-render.
  - **1d Surgical save** — diff changed nodes → ONE batched `magic-string` pass over the original string → atomic temp+rename; preserve BOM/line-endings/trailing newline. *DoD:* in a text editor, only the moved element changed.
  - **1e Embedded Claude terminal** — node-pty (main, `cwd`=file dir) ↔ xterm; autostart `claude`; kill PTYs on `before-quit`.
  - **1f Packaging smoke test** — NSIS one-click; install on a **clean** machine; redo 1a–1e from the installed app.
  - *Risk focus:* R1 (node-pty/ConPTY), R2 (clean save), R4 (overlay drift).

- **Layer 2 — Trust & safety net.** Undo/Redo (Ctrl+Z/Y); external-change reconcile via chokidar (hot-reload if clean, prompt if dirty — never clobber; matters because Claude Code edits the same dir); dirty indicator + save-on-close.

- **Layer 3 — Inspector & basic styling.** Properties panel: text + safe style controls (color/background/spacing/alignment/font-size) as `SetStyle`/`SetText` commands.

- **Layer 4 — Widget palette.** Sidebar of draggable widgets (button/card/list/table/chat box) as HTML templates → `InsertNode`; style variants = class/attr swap (no Puck JSON).

- **Layer 5 — Photo import + crop + "what is this?"** Drag image → read bytes over IPC → react-easy-crop → export webp (<16.78M px) → save under `userData/.../assets/` → `app://` ref → prompt "single image / card / first slide of gallery / banner" → insert matching template + style options.

- **Layer 6 — Polish & distribution.** Onboarding, shortcuts, friendly errors; code-signing (OV/EV) + auto-update endpoint before wide release (skip for personal use).

---

## 6. Risk register

| ID | Risk | Mitigation | Surfaces at |
|---|---|---|---|
| R1 | node-pty native ABI / ConPTY dropped in packaging | install-app-deps; mark external to bundler; `asarUnpack **/node_modules/node-pty/**`; kill on before-quit; clean-machine install test | 1e/1f |
| R2 | Clean save churn | surgical-only default; beautify opt-in + fragment-scoped; one batched pass vs original; preserve BOM/CRLF/newline | 1d |
| R3 | iframe chrome polluting saved HTML | serialize from tree; inject bootstrap into iframe not user file; transient IDs stripped; DOMPurify | 1a/1d |
| R4 | Overlay drift across iframe boundary | fixed host overlay; ResizeObserver + rAF scroll; vendor rect math; `allow-same-origin` | 1b/1c |
| R5 | Save vs external edit (Claude edits same dir) | baseline hash + dirty flag; chokidar awaitWriteFinish; reload-vs-keep-mine prompt | 2 |
| C2 | parse5 char-vs-byte offset corruption | operate on in-memory string by UTF-16 char offsets; guard undefined location | 1d |
| C9 | SmartScreen on unsigned installer | budget code-signing cert before wide distribution | 6 |

---

## 7. Open decisions (not blocking Layer 1)
- App name + icon; exact inspector style controls; first widgets + variant counts; auto-update hosting + signing budget. None block Layer 1.
