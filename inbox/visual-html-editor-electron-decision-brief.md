# Decision Brief: Beginner-Friendly Visual HTML Editor (Electron)

**Scope:** Desktop app that opens any real `.html` file, lets a zero-coding user click+drag elements to reposition (per-drag toggle: reorder-in-flow vs free absolute), saves clean diffs back to the actual file, and hosts an embedded terminal running Claude Code in the file's directory. Future: widget sidebar, drag-in photos with cropping, style variants.

**Author's stance:** This brief makes opinionated single picks. The single most consequential decision — and the one the research data is internally split on — is the editor data model. I resolve it decisively in §1 and explain why in §3.

---

## 1. Recommended Stack

| Layer | Pick (version) | Why (one line) |
|---|---|---|
| **Shell / runtime** | **Electron 42.x** (pin 42.3.x; Chromium 148 / Node 24) | One consistent Chromium = WYSIWYG matches export; all-JS = no Rust for the PTY terminal; mature packaging/auto-update. |
| **Scaffolding** | **electron-vite** (Vite HMR, clean main/preload/renderer split) | Fastest dev loop and the cleanest 3-process layout; you control distribution explicitly via electron-builder. |
| **Packaging / installer** | **electron-builder** with **NSIS one-click** (`oneClick: true`) | Near-silent double-click install AND the only Windows target that supports `electron-updater` auto-update; more actively maintained than Squirrel. |
| **Canvas embedding** | **Same-process sandboxed `<iframe>`** (`allow-scripts allow-same-origin`) | Host renderer must synchronously read the page DOM and align overlays pixel-perfectly — out-of-process `WebContentsView`/`<webview>` cannot. |
| **Editor data model** | **Custom normalized DOM tree as source of truth**, parsed with **parse5 8.0.1** (`sourceCodeLocationInfo: true`) | The deliverable is *arbitrary editable HTML round-tripped to a real file* — only an HTML-native model satisfies "select ANY element" + "clean HTML out." (See §3.) |
| **Selection / overlay UI** | **Custom overlay layer in the host document**, positioned via `getBoundingClientRect` + iframe offset + scroll | Handles/labels/toolbars live outside the edited element so they never pollute saved HTML; re-measured on scroll/resize via `ResizeObserver` + rAF-throttled scroll listeners. |
| **Reorder-in-flow drag** | **SortableJS** (~3.7M wk dl, ~31k stars; vanilla, framework-agnostic) | Flow-mode: element stays `position:static`, drops between siblings, container manages layout. |
| **Free absolute drag + resize** | **Moveable** (daybrush/moveable, ~75-79k wk dl) — **NOT interact.js** | Absolute-mode: drag/resize/snap; actively maintained. interact.js is functional but flagged inactive/discontinued (last release ~2yr ago). |
| **HTML round-trip (save)** | **parse5 source offsets + magic-string** (surgical splice; recast pattern applied to HTML) | The DOM already *is* the HTML; overwrite only the byte… (char) ranges that changed, pass everything else through verbatim → minimal diffs. |
| **Inline text editing** | **contenteditable on one container at a time** (enter/exit edit mode); upgrade to **Tiptap/ProseMirror** later | Tiptap demands full ownership of its `contenteditable` root, so mount it per-text-container, not blanket over every node. |
| **Terminal (front)** | **@xterm/xterm 6.0.0 + @xterm/addon-fit 0.11.0** (renderer) | Standard; v6 is current — verify any third-party addons target v6 not v5. |
| **Terminal (PTY)** | **node-pty 1.1.0** in the **main process only** (1.2.0-beta for newest ABI) | Real PTY → `process.stdin.isTTY` true → Claude Code's Ink UI works (avoids "Raw mode is not supported"). N-API prebuilds incl. ConPTY. |
| **File watching** | **chokidar** (`awaitWriteFinish`, watch the *directory*, atomic-rename handling) | `fs.watch` is unreliable; reconcile external edits against an in-memory baseline hash. |
| **IPC validation** | **zod** schemas in `src/common/ipc-contracts.ts` | Main holds privileged fs/pty — validate every payload and check `event.senderFrame.url`. |
| **Native rebuild** | **@electron/rebuild 4.0.4** (`electron-builder install-app-deps`) | Insurance for node-pty ABI match even though N-API prebuilds usually load directly. |
| **Future: image crop** | **react-easy-crop 5.x** (NOT v3.x — stale label) | Pinch/drag-to-zoom is the most intuitive for non-coders; returns `croppedAreaPixels`, you do the canvas export. |
| **Future: crop→canvas** | Cropper.js path uses **`$toCanvas()`** (v2.1.1), **not** `getCroppedCanvas()` (that's v1) | If you ever swap to Cropper.js for free-form crops, the v2 web-component API renamed the export method. |
| **Future: dropped-file path** | **`webUtils.getPathForFile(file)`** in **preload** (NOT `File.path` — removed in Electron 32) | And note: it returns `""` for *drag-dropped* files on many versions — fall back to reading bytes over IPC. |
| **Future: asset storage** | Write blob bytes over IPC → `fs` under `app.getPath('userData')/<project>/assets/`; serve via **custom `app://` protocol** | Portable, CSP-safe; store relative `app://assets/<id>.webp` refs, never absolute `file://`. |
| **Future: widget palette** | Custom widgets = HTML templates inserted as new subtrees into the tree; style variants = a class/attr swap on the node | Stay HTML-native end-to-end; do **not** introduce Puck's JSON model (see §3). |
| **Language** | **TypeScript** throughout, shared types in `src/common` | One contract for main/preload/renderer. |

**Architecture in one paragraph:** Single `BrowserWindow`. Renderer hosts the chrome (left widget sidebar, right inspector, bottom terminal) plus a sandboxed `<iframe>` canvas. On open: `fs` (main) → IPC → parse5 → normalized tree (each node carries `sourceCodeLocation` + a stable `nodeId`) → render iframe as a disposable view. Edits go through a **command-pattern history** (two stacks, `execute()`/`undo()`, commands mutate the *tree*, not the DOM). Save: translate the changed nodes into `magic-string` overwrites against the original file text, write atomically (temp+rename) via main `fs`. Terminal: node-pty (main) ↔ xterm.js (renderer) over a contextBridge preload, `cwd` = the file's directory, then `write('claude\r')`.

---

## 2. Key Risks & Mitigations

**R1 — node-pty native ABI on Windows / ConPTY packaging (highest operational risk).**
node-pty is a native module; even with N-API prebuilds the bundled binary is not *guaranteed* to load against your exact Electron. Worse, packaging can silently ship `pty.node` but **drop `conpty.dll` + `OpenConsole.exe`**, so the terminal works in `electron .` but fails only in the installed app.
*Mitigate:* keep `install-app-deps`/`@electron/rebuild` in the build pipeline; mark `node-pty` external to the bundler (`build.rollupOptions.external`) so Vite never parses `.node`; add an explicit `asarUnpack` glob `**/node_modules/node-pty/**`; **test the packaged installer on a clean Windows machine**, not just dev. On Win11 ConPTY is used (Win10 1809+). Kill PTYs on `before-quit` or OpenConsole.exe lingers.

**R2 — Clean HTML write-back churn (the core product promise).**
Any full re-serialization (`cheerio $.html()`, jsdom `outerHTML`, parse5 `serialize`, or a whole-file Prettier/js-beautify pass) silently reorders/requotes attributes, re-encodes entities, canonicalizes void elements, and can alter rendering → huge spurious diffs.
*Mitigate:* the **default save path must be surgical-only** — parse5 offsets + `magic-string`, untouched ranges pass through verbatim. Make beautify an explicit opt-in user action, scoped to the changed fragment only, never on `script/style/pre/textarea`/comments. **Batch all edits into one `magic-string` pass against the original string** (offsets are computed against the original; applying sequentially against a mutating string corrupts positions). Preserve CRLF/LF, trailing newline, and any UTF-8 BOM in the raw prefix.

**R3 — iframe injection polluting saved HTML.**
The instrumentation bootstrap, transient `data-editor-id` tags, selection classes, and overlay must never reach disk.
*Mitigate:* the tree is the single source of truth and serialization reads from it (or from the original file text via offsets), so editor chrome is excluded *by construction*. Inject the event-forwarding bootstrap into the iframe document (a local packaged file), **never into the user's file**; add transient IDs at render, strip on serialize; keep the overlay (selection box, handles, drop-line) entirely in the host document. Sanitize parsed user HTML on open (DOMPurify) — model-as-truth keeps editor chrome out but does not make injected user content safe (XSS in the canvas + a privileged shell = RCE).

**R4 — Overlay drift across the iframe boundary (most visible UX bug).**
`getBoundingClientRect` inside an iframe is relative to the *iframe's* document; you must add the iframe element's offset and scroll, and re-measure on scroll/resize/zoom/CSS-transform/`devicePixelRatio`.
*Mitigate:* use a `position:fixed` host overlay that consumes viewport-relative rects directly; re-measure via `ResizeObserver` + rAF-throttled scroll listeners. You may vendor/inline the `get-nested-bounding-client-rect` math (it's MIT but effectively unmaintained since 2018 — copy it, don't depend on it). The iframe must be `allow-same-origin` for cross-frame DOM reads (a deliberate sandbox relaxation, acceptable for the user's own local file).

**R5 — Save vs external-edit conflict.**
User edits visually while another tool (or the embedded Claude Code terminal itself!) rewrites the file → clobbered work. This is acute here because Claude Code *will* edit files in the same directory.
*Mitigate:* track a baseline content hash + dirty flag; chokidar with `awaitWriteFinish`, watching the directory. On external change: hot-reload if not dirty, else surface an explicit reload-vs-keep-mine prompt. Never silently overwrite.

---

## 3. Confidence Notes (verification flagged these — the build author must double-check)

**C1 — Editor model: the research is internally contradictory; I picked HTML-native deliberately.**
Dimension 5 recommends **Puck** (JSON-tree model). Dimension 2's verification **refutes Puck for this exact goal**: Puck/craft.js store a JSON node tree as the source of truth, HTML is only a one-way React-render artifact, they **cannot ingest arbitrary existing HTML**, and every element must be a pre-registered React component — so "open any `.html` file," "select ANY element," and "clean HTML round-trip to the real file" are not first-class. **The stated requirement is editing real arbitrary `.html` files, so HTML-native wins; Puck is a dead end here.** Dimension 5's Puck recommendation silently assumes a *different* product (assemble a page from a fixed React component library, persist JSON). If the product owner ever reframes to "users only build from our widgets and we export," revisit — but as written, do **not** adopt Puck/craft.js. GrapesJS is the only mature *framework* that is HTML-native, but its polished absolute-positioning UX (snap lines, rulers, axis-lock) is behind the commercial **Studio SDK**, not OSS core — verify licensing before leaning on it. **Recommendation stands: build the thin custom tree.**

**C2 — parse5 offsets are CHARACTER offsets, not byte offsets (refuted claim).**
The research repeatedly says "byte-accurate." It is wrong: `startOffset`/`endOffset` are zero-based **UTF-16 character** offsets into the source *string* (`endOffset` is exclusive). Keep all editing on the in-memory string and slice by these offsets — **never seek by byte into a file/Buffer**, or any document with emoji/accents/CJK corrupts. Also: parser-inserted nodes (auto `<tbody>`, moved misnested nodes) have `sourceCodeLocation === undefined` — guard before slicing.

**C3 — parse5 `RewritingStream` does NOT preserve bytes verbatim once a handler is attached (refuted claim).**
The research's "untouched tokens re-emit raw bytes" is only true if you attach **no** listener (or explicitly call `emitRaw(raw)`). If you attach a `startTag`/`text` listener and re-emit via the typed methods, the token is **always** re-serialized — forcing double quotes, re-encoding entities, normalizing inter-attribute whitespace (attribute *order* is preserved). Example: `<head foo='bar"baz"'>` re-emitted unmodified becomes `<head foo="bar&quot;baz&quot;">`. **Do not rely on RewritingStream alone for diff-friendly output.** Use the **parse5 offsets + `magic-string` splice** approach as the primary engine (this is the recommendation already) and treat RewritingStream as optional/streaming-only. Even a node you *do* edit will be normalized on output unless you splice its original-formatted range.

**C4 — `webUtils.getPathForFile()` returns `""` for drag-and-dropped files on many Electron versions (verification caveat).**
It works reliably for `dialog.showOpenDialog` selections but is unreliable specifically via drag-and-drop. For the future photo-import feature, prefer **Flow A** (read dropped bytes over IPC → crop → save a new copy), and only use path-based copy for files chosen via the dialog. Call `getPathForFile` from the **preload** (bundler issues importing `webUtils` into renderer chunks are documented).

**C5 — Cropper.js v2 API rename + react-easy-crop version label (refuted/stale specifics).**
If you use Cropper.js, the v2.1.1 web-component export method is **`$toCanvas()`** (returns a Promise), not v1's `getCroppedCanvas()` — copying v1 tutorials against a v2 install throws "not a function." react-easy-crop is **v5.x** (5.5.x), not "v3.x" as the research labels it (API still holds). The canvas blank-output trigger is **total area > 16,777,216 px**, so cap export dimensions and prefer `image/webp`.

**C6 — interact.js is effectively unmaintained (refuted momentum claim, corrected library).**
The research's "~1k/wk downloads" cited the wrong deprecated alias package; the real `interactjs` is ~558k/wk but last shipped ~2 years ago and is flagged inactive/discontinued. **Use Moveable for the free-positioning/resize role**, or be prepared to implement drag+resize directly on Pointer Events. SortableJS (~3.7M/wk) for flow-reorder is healthy. (If the host ever becomes React, @dnd-kit/sortable ~17M/wk is the flow choice; note react-beautiful-dnd is deprecated — never adopt it.)

**C7 — Electron version: trust 42.x, not 38.x.**
Dimension 6 says "latest stable 38.x in 2026" — that is **stale**; Dimension 1 verified **42.3.3** (Jun 2026, Chromium 148/Node 24), with majors 42/41/40 supported and ~8-week major cadence. Pin a 42.x line, budget routine bumps, and re-test node-pty + the editor on each upgrade (security backports stop once you fall off the supported window).

**C8 — Selection highlight: element-styling is a valid production technique, not just debug (refuted overstatement).**
The research claims the highlight box is "overwhelmingly NOT styling the element." Webflow disproves this — it highlights via CSS `outline`/zero-blur `box-shadow` on the element itself (applied via a transient class, cleared on save, no layout shift). **Handles/labels/toolbars** genuinely belong in the overlay layer; the **highlight box** can go either way. For an iframe canvas, `box-shadow` can clip at the iframe edge — one real reason to push even the highlight into the host overlay. Decide per-element, don't dogmatically force everything into the overlay.

**C9 — Installer choice (refinement, not refutation).**
Squirrel-via-Forge is the simplest no-prompt per-user double-click, but the upstream Squirrel.Windows framework is largely unmaintained and electron-builder deprecates its Squirrel target. I recommend **electron-builder NSIS `oneClick:true`** because it approximates the same silent double-click feel, is actively maintained, and is the **only Windows target supporting `electron-updater`** (MSI/portable do not). Either way, unsigned installers trigger SmartScreen "unknown publisher" — budget a Windows code-signing (OV/EV) cert before wide distribution, and decide the auto-update hosting endpoint (e.g. GitHub Releases) before shipping.

---

### v1 vertical slice (build order)
`openFile` → main `fs` → IPC → parse5 → tree → IframeHost render → **drag widget/element** → DragController → InsertNode/MoveNode command → tree mutate → re-render + overlay → **Ctrl+S** → magic-string surgical splice → `bridge.saveDocument` → main atomic write. Terminal panel (xterm + node-pty, `cwd` = file dir, autostart `claude`) ships alongside. Undo/redo, multi-select, style inspector, live-watch reconcile, photo import, and the widget palette all layer on **without restructuring** because every action already flows through commands on the model.
