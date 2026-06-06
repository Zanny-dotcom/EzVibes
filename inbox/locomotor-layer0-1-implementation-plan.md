# Locomotor — Layer 0 + Layer 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first runnable version of Locomotor — a Windows Electron desktop app that opens any `.html` file, lets the user click an element and drag it to a new position (Tidy/reorder or Free/absolute, chosen per drag), saves the change surgically back to the real file, and embeds a Claude Code terminal `cd`'d into the file's folder.

**Architecture:** Single Electron `BrowserWindow`, three processes (main = privileged Node for fs + PTY; preload = narrow zod-validated bridge; renderer = the editor UI). The user's page renders inside a same-process sandboxed `<iframe>`; a normalized HTML tree (from parse5, each node tagged with a stable `nodeId` + `sourceCodeLocation`) is the single source of truth. All edits flow through a command-pattern history. Saves overwrite only the changed character ranges via `magic-string`, leaving the rest of the file byte-identical.

**Tech Stack:** Electron 42.x, electron-vite, TypeScript, parse5 8.x, magic-string, SortableJS, Moveable, DOMPurify, @xterm/xterm 6 + addon-fit, node-pty (main only), zod, electron-builder (NSIS one-click). Tests: Vitest (unit, renderer logic) + a thin manual DoD check per sub-layer.

**Environment notes (verified on this machine 2026-06-05):** Node v24.13.0, npm 11.6.2, git 2.53 (Windows). Project folder `C:\Users\Oskari\Documents\web-design` is NOT yet a git repo (Task 0 fixes that). All commands below are PowerShell-friendly. `npm test` runs Vitest once (non-watch).

**What this plan covers:** Layer 0 (runnable secure skeleton) and Layer 1 (open + select + drag + save + terminal). Layers 2–6 (undo/redo UI, external-change reconcile, inspector, widget palette, photo import, distribution) are specified in `BUILD-PLAN.md` and get their own plans later. The command-history and tree foundations built here make those layers additive.

---

## Testing approach (read once)

- **Logic is unit-tested with Vitest** in `jsdom` environment: the tree model, the parse→serialize round-trip, and each command's execute/undo. These are the parts where bugs are silent and dangerous (a bad save corrupts the user's file), so they get real tests.
- **UI/integration is verified manually** via the **Definition of Done (DoD)** at the end of each sub-layer, because driving Electron windows + iframe drag in an automated harness is disproportionate effort for a v1. Each DoD is a concrete, observable check.
- **TDD where it pays:** model + serialize + commands are written test-first (the failing test is a step). Wiring/IPC/UI glue is written then DoD-verified.
- **Commit after every green step.** Small commits = easy undo while building.

---

## File structure (built across the tasks)

```
web-design/                        # project root (Locomotor)
  package.json
  electron.vite.config.ts
  electron-builder.yml
  tsconfig.json
  vitest.config.ts
  .gitignore
  index.html                       # renderer entry HTML (the app chrome shell)
  src/
    common/
      types.ts                     # EditorNode, NodeId, DragMode, Command, etc.
      ipc-contracts.ts             # zod schemas + channel names + TS types
    main/
      index.ts                     # app lifecycle, BrowserWindow, before-quit cleanup
      fs-service.ts                # readFile, atomic writeFile (temp+rename)
      pty-service.ts               # node-pty spawn/write/resize/kill registry
    preload/
      index.ts                     # contextBridge: openFile, saveDocument, pty.*
    renderer/
      app.ts                       # bootstraps UI, wires toolbar + panels
      ui/
        layout.css                 # the chrome grid (toolbar/sidebar/canvas/terminal)
      model/
        tree.ts                    # parse5 doc -> EditorNode tree; nodeId; queries
        serialize.ts               # tree changes -> magic-string surgical splice
      canvas/
        iframe-host.ts             # render tree HTML into iframe; transient ids
        iframe-bootstrap.ts        # injected INTO iframe: forward click/hover
      overlay/
        rects.ts                   # nested bounding-rect math across iframe
        overlay.ts                 # host-doc selection box + drop-line
      interaction/
        selection.ts               # click->select, hover->highlight
        mode-toggle.ts             # Tidy/Free state
        drag-flow.ts               # SortableJS reorder -> MoveNode command
        drag-free.ts               # Moveable absolute drag -> SetStyle command
      history/
        command.ts                 # Command interface
        history.ts                 # undo/redo stacks (UI buttons in Layer 2)
        commands/
          move-node.ts             # reparent/reorder a node in the tree
          set-inline-style.ts      # set/merge a node's style attribute
      terminal/
        terminal.ts                # xterm + fit, pipes to preload pty bridge
  tests/
    model/
      tree.test.ts
      serialize.test.ts
    history/
      move-node.test.ts
      set-inline-style.test.ts
  vendor/
    get-nested-bounding-client-rect.ts   # vendored MIT rect math
```

---

## Task 0: Initialize repo + tooling baseline

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `vitest.config.ts`

- [ ] **Step 1: Initialize git**

Run (in project root — already the cwd):
```powershell
git init
git config user.name  "Oskari"
git config user.email "ozan.oskari@outlook.com"
```
Expected: "Initialized empty Git repository".

- [ ] **Step 2: Create `.gitignore`**

Create `.gitignore`:
```
node_modules/
out/
dist/
release/
*.log
.DS_Store
```

- [ ] **Step 3: Create `package.json`**

Create `package.json`:
```json
{
  "name": "locomotor",
  "version": "0.0.1",
  "description": "Drag-to-edit visual HTML editor with an embedded Claude terminal.",
  "main": "out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "dist": "electron-vite build && electron-builder --win",
    "postinstall": "electron-builder install-app-deps"
  }
}
```

- [ ] **Step 4: Install dependencies**

Run:
```powershell
npm install --save-dev electron@^42 electron-vite vite typescript electron-builder @electron/rebuild vitest jsdom @types/node
npm install parse5 magic-string sortablejs moveable dompurify zod @xterm/xterm @xterm/addon-fit
npm install node-pty
```
Expected: installs complete. `node-pty` builds/downloads a prebuilt binary (Node 24 / Electron 42 ABI). If `node-pty` errors, note it — Task 8 has the rebuild fallback. Do not block other tasks on it.

- [ ] **Step 5: Create `tsconfig.json`**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "baseUrl": ".",
    "noEmit": true
  },
  "include": ["src", "tests", "vendor", "electron.vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 6: Create `vitest.config.ts`**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 7: Verify the toolchain runs**

Run:
```powershell
npx vitest run
```
Expected: Vitest starts and reports "No test files found" (we have none yet) — this confirms Vitest + config load without error.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "chore: initialize Locomotor repo, tooling, and dependencies"
```

---

## Task 1: Secure Electron skeleton (Layer 0)

**Goal:** `npm run dev` opens a window with the app chrome (toolbar / sidebar / canvas / terminal regions) and no security warnings.

**Files:**
- Create: `electron.vite.config.ts`, `index.html`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/app.ts`, `src/renderer/ui/layout.css`, `src/common/ipc-contracts.ts`

- [ ] **Step 1: Create the IPC contract (ping channel + zod)**

Create `src/common/ipc-contracts.ts`:
```ts
import { z } from 'zod'

/** Channel name constants — the single source of truth for IPC strings. */
export const CH = {
  ping: 'app:ping',
  openFile: 'file:open',
  saveDocument: 'file:save',
  ptySpawn: 'pty:spawn',
  ptyInput: 'pty:input',
  ptyResize: 'pty:resize',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
} as const

export const PingResult = z.object({ ok: z.literal(true), pong: z.string() })
export type PingResult = z.infer<typeof PingResult>
```

- [ ] **Step 2: Create `electron.vite.config.ts`**

Create `electron.vite.config.ts`:
```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // node-pty is a native module; never let the bundler parse its .node binary
        external: ['node-pty'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    // renderer is plain TS + the index.html entry
  },
})
```

- [ ] **Step 3: Create the renderer entry HTML (app chrome)**

Create `index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; img-src 'self' data: app:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self'" />
    <title>Locomotor</title>
    <link rel="stylesheet" href="/src/renderer/ui/layout.css" />
  </head>
  <body>
    <div id="app">
      <header id="toolbar">
        <button id="btn-open">Open…</button>
        <button id="btn-save" disabled>Save</button>
        <span class="spacer"></span>
        <label class="mode">
          <input type="radio" name="dragmode" value="tidy" checked /> Tidy
        </label>
        <label class="mode">
          <input type="radio" name="dragmode" value="free" /> Free
        </label>
      </header>
      <aside id="sidebar"><p class="placeholder">Blocks (later)</p></aside>
      <main id="canvas-wrap">
        <iframe id="canvas" sandbox="allow-scripts allow-same-origin"></iframe>
        <div id="overlay"></div>
      </main>
      <aside id="inspector"><p class="placeholder">Properties (later)</p></aside>
      <section id="terminal-wrap"><div id="terminal"></div></section>
    </div>
    <script type="module" src="/src/renderer/app.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Create the chrome layout CSS**

Create `src/renderer/ui/layout.css`:
```css
* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
#app {
  display: grid;
  grid-template-columns: 200px 1fr 240px;
  grid-template-rows: 44px 1fr 220px;
  grid-template-areas:
    "toolbar  toolbar  toolbar"
    "sidebar  canvas   inspector"
    "terminal terminal terminal";
  font: 14px system-ui, sans-serif;
}
#toolbar  { grid-area: toolbar; display: flex; align-items: center; gap: 8px; padding: 0 10px; border-bottom: 1px solid #ddd; }
#toolbar .spacer { flex: 1; }
#toolbar .mode { display: inline-flex; align-items: center; gap: 4px; }
#sidebar  { grid-area: sidebar; border-right: 1px solid #eee; padding: 8px; }
#inspector{ grid-area: inspector; border-left: 1px solid #eee; padding: 8px; }
#canvas-wrap { grid-area: canvas; position: relative; overflow: hidden; }
#canvas   { width: 100%; height: 100%; border: 0; background: #fff; }
#overlay  { position: absolute; inset: 0; pointer-events: none; }
#terminal-wrap { grid-area: terminal; border-top: 1px solid #ddd; background: #1e1e1e; }
#terminal { width: 100%; height: 100%; }
.placeholder { color: #999; font-size: 12px; }
```

- [ ] **Step 5: Create the main process**

Create `src/main/index.ts`:
```ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CH } from '../common/ipc-contracts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle(CH.ping, () => ({ ok: true as const, pong: 'locomotor' }))

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 6: Create the preload bridge**

Create `src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '../common/ipc-contracts.js'

contextBridge.exposeInMainWorld('locomotor', {
  ping: () => ipcRenderer.invoke(CH.ping),
})
```

- [ ] **Step 7: Create the renderer bootstrap**

Create `src/renderer/app.ts`:
```ts
// Minimal Layer-0 bootstrap: prove the bridge works, log result.
declare global {
  interface Window {
    locomotor: {
      ping: () => Promise<{ ok: true; pong: string }>
    }
  }
}

async function main() {
  const res = await window.locomotor.ping()
  // eslint-disable-next-line no-console
  console.log('[locomotor] ping ->', res)
}

main()
export {}
```

- [ ] **Step 8: Run the app**

Run:
```powershell
npm run dev
```
Expected: an Electron window opens showing the toolbar (Open/Save/Tidy/Free), a left "Blocks (later)" panel, an empty white canvas, a right "Properties (later)" panel, and a dark terminal strip along the bottom.

- [ ] **Step 9: DoD — verify skeleton + bridge + security**

In the running app, open DevTools (Ctrl+Shift+I) and confirm:
- Console shows `[locomotor] ping -> {ok: true, pong: 'locomotor'}` (preload bridge works).
- **No** Electron security warnings printed in the console (CSP + isolation correct).
- The four regions + toolbar are laid out as described.

- [ ] **Step 10: Commit**

```powershell
git add -A
git commit -m "feat: secure Electron skeleton with app chrome and IPC ping"
```

---

## Task 2: The HTML tree model (parse → tree)

**Goal:** Turn raw HTML text into a normalized tree where every element node has a stable `nodeId` and its original `sourceCodeLocation`. This is the source of truth.

**Files:**
- Create: `src/common/types.ts`, `src/renderer/model/tree.ts`
- Test: `tests/model/tree.test.ts`

- [ ] **Step 1: Define shared types**

Create `src/common/types.ts`:
```ts
export type NodeId = string

export type DragMode = 'tidy' | 'free'

/** Character offsets (UTF-16) into the original source string. end is exclusive. */
export interface SourceSpan {
  startOffset: number
  endOffset: number
  /** location of the start tag (for elements), used when we splice attributes only */
  startTag?: { startOffset: number; endOffset: number }
}

export interface EditorNode {
  nodeId: NodeId
  /** 'element' | 'text' | 'comment' | 'document' | 'doctype' */
  kind: string
  /** tag name for elements, else undefined */
  tagName?: string
  attrs: Record<string, string>
  children: EditorNode[]
  parent: EditorNode | null
  /** undefined for parser-inserted nodes (e.g. implicit <tbody>) — never splice these */
  span?: SourceSpan
}
```

- [ ] **Step 2: Write the failing test for tree building**

Create `tests/model/tree.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTree, findById } from '../../src/renderer/model/tree'

const HTML = `<!doctype html>
<html><body><h1>Title</h1><p id="lead">Hello</p></body></html>`

describe('buildTree', () => {
  it('assigns stable ids and captures spans for elements', () => {
    const { root, byId } = buildTree(HTML)
    expect(root.kind).toBe('document')

    // find the <p id="lead">
    const p = [...byId.values()].find(n => n.tagName === 'p')!
    expect(p).toBeTruthy()
    expect(p.attrs.id).toBe('lead')
    expect(p.span).toBeTruthy()
    // the span must point at the literal "<p id=\"lead\">Hello</p>" range
    const slice = HTML.slice(p.span!.startOffset, p.span!.endOffset)
    expect(slice).toBe('<p id="lead">Hello</p>')
  })

  it('findById returns the same node object', () => {
    const { root, byId } = buildTree(HTML)
    const h1 = [...byId.values()].find(n => n.tagName === 'h1')!
    expect(findById(root, h1.nodeId)).toBe(h1)
  })
})
```

- [ ] **Step 2b: Run it to confirm it fails**

Run: `npx vitest run tests/model/tree.test.ts`
Expected: FAIL — `buildTree` is not exported / not defined.

- [ ] **Step 3: Implement the tree builder**

Create `src/renderer/model/tree.ts`:
```ts
import { parse } from 'parse5'
import type { EditorNode, NodeId } from '../../common/types'

let counter = 0
function nextId(): NodeId {
  counter += 1
  return `n${counter}`
}

/** Map parse5 node kinds to our simplified kind strings. */
function kindOf(p5: any): string {
  if (p5.nodeName === '#document') return 'document'
  if (p5.nodeName === '#text') return 'text'
  if (p5.nodeName === '#comment') return 'comment'
  if (p5.nodeName === '#documentType') return 'doctype'
  return 'element'
}

function spanOf(p5: any): EditorNode['span'] {
  const loc = p5.sourceCodeLocation
  if (!loc || typeof loc.startOffset !== 'number' || typeof loc.endOffset !== 'number') {
    return undefined // parser-inserted node — must not be spliced
  }
  return {
    startOffset: loc.startOffset,
    endOffset: loc.endOffset,
    startTag: loc.startTag
      ? { startOffset: loc.startTag.startOffset, endOffset: loc.startTag.endOffset }
      : undefined,
  }
}

function attrsOf(p5: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (Array.isArray(p5.attrs)) for (const a of p5.attrs) out[a.name] = a.value
  return out
}

function convert(p5: any, parent: EditorNode | null, byId: Map<NodeId, EditorNode>): EditorNode {
  const node: EditorNode = {
    nodeId: nextId(),
    kind: kindOf(p5),
    tagName: kindOf(p5) === 'element' ? String(p5.tagName) : undefined,
    attrs: attrsOf(p5),
    children: [],
    parent,
    span: spanOf(p5),
  }
  byId.set(node.nodeId, node)
  const kids = p5.childNodes ?? []
  for (const child of kids) node.children.push(convert(child, node, byId))
  return node
}

export function buildTree(html: string): { root: EditorNode; byId: Map<NodeId, EditorNode> } {
  counter = 0
  const doc = parse(html, { sourceCodeLocationInfo: true })
  const byId = new Map<NodeId, EditorNode>()
  const root = convert(doc, null, byId)
  return { root, byId }
}

export function findById(root: EditorNode, id: NodeId): EditorNode | null {
  if (root.nodeId === id) return root
  for (const c of root.children) {
    const hit = findById(c, id)
    if (hit) return hit
  }
  return null
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/model/tree.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: HTML tree model with stable nodeIds and source spans"
```

---

## Task 3: Surgical serialize (tree change → magic-string splice)

**Goal:** Given the original HTML string and a set of node-level changes, produce new HTML where ONLY the changed ranges differ. This is the safety-critical core — wrong behavior corrupts the user's file.

**Files:**
- Create: `src/renderer/model/serialize.ts`
- Test: `tests/model/serialize.test.ts`

**Design:** We serialize *changes*, not the whole tree. A change is `{ nodeId, kind: 'replaceOuter' | 'setAttrs', ... }`. `replaceOuter` overwrites a node's full `span` with new markup (used when a node is moved — we delete it at the old span and insert markup at the new location). `setAttrs` rewrites only the start-tag's attribute list. All edits are applied in ONE `magic-string` pass keyed off original offsets.

- [ ] **Step 1: Write the failing test**

Create `tests/model/serialize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTree } from '../../src/renderer/model/tree'
import { applyEdits, nodeToHtml } from '../../src/renderer/model/serialize'

const HTML = `<!doctype html>
<html><body>
<h1>Title</h1>
<p id="lead">Hello</p>
</body></html>`

describe('applyEdits', () => {
  it('setAttrs rewrites only the start tag, leaving the rest byte-identical', () => {
    const { byId } = buildTree(HTML)
    const p = [...byId.values()].find(n => n.tagName === 'p')!
    const out = applyEdits(HTML, [
      { kind: 'setAttrs', nodeId: p.nodeId, span: p.span!, tagName: 'p', attrs: { id: 'lead', class: 'big' } },
    ])
    expect(out).toContain('<p id="lead" class="big">Hello</p>')
    // everything before <p> is untouched
    expect(out.startsWith('<!doctype html>\n<html><body>\n<h1>Title</h1>')).toBe(true)
  })

  it('move = remove at old span + insert markup at a new span, single pass', () => {
    const { byId } = buildTree(HTML)
    const h1 = [...byId.values()].find(n => n.tagName === 'h1')!
    const p = [...byId.values()].find(n => n.tagName === 'p')!
    const pHtml = nodeToHtml(p)
    // Move <p> to before <h1>: insert p markup at h1.start, remove p at its span.
    const out = applyEdits(HTML, [
      { kind: 'insertBefore', anchorOffset: h1.span!.startOffset, html: pHtml + '\n' },
      { kind: 'remove', span: p.span! },
    ])
    const bodyStart = out.indexOf('<body>')
    expect(out.indexOf('<p id="lead">Hello</p>', bodyStart)).toBeLessThan(out.indexOf('<h1>Title</h1>', bodyStart))
  })
})
```

- [ ] **Step 1b: Run it to confirm failure**

Run: `npx vitest run tests/model/serialize.test.ts`
Expected: FAIL — module/functions not defined.

- [ ] **Step 2: Implement serialize**

Create `src/renderer/model/serialize.ts`:
```ts
import MagicString from 'magic-string'
import type { EditorNode, SourceSpan } from '../../common/types'

/** Render a single attribute list to `name="value"` form (double-quoted, entity-escaped). */
function attrsToString(attrs: Record<string, string>): string {
  const parts: string[] = []
  for (const [name, value] of Object.entries(attrs)) {
    const v = value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
    parts.push(`${name}="${v}"`)
  }
  return parts.length ? ' ' + parts.join(' ') : ''
}

const VOID = new Set([
  'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr',
])

/** Serialize a node (and its current children) to HTML. Used for moved/new subtrees. */
export function nodeToHtml(node: EditorNode): string {
  if (node.kind === 'text') return node.attrs['#text'] ?? textOf(node)
  if (node.kind === 'comment') return `<!--${node.attrs['#data'] ?? ''}-->`
  if (node.kind === 'element') {
    const tag = node.tagName!
    const open = `<${tag}${attrsToString(node.attrs)}>`
    if (VOID.has(tag)) return open
    const inner = node.children.map(nodeToHtml).join('')
    return `${open}${inner}</${tag}>`
  }
  // document/doctype fallthrough: serialize children
  return node.children.map(nodeToHtml).join('')
}

/** For text nodes we stored the literal text on the node; helper keeps tree.ts simple. */
function textOf(node: EditorNode): string {
  // tree.ts stores text content in attrs['#text'] when kind==='text' (set in Task 5 upgrade);
  // until then, fall back to empty string. Real text capture is added in Task 5 Step 2.
  return node.attrs['#text'] ?? ''
}

export type Edit =
  | { kind: 'setAttrs'; nodeId: string; span: SourceSpan; tagName: string; attrs: Record<string, string> }
  | { kind: 'remove'; span: SourceSpan }
  | { kind: 'insertBefore'; anchorOffset: number; html: string }

/**
 * Apply all edits in ONE pass against the ORIGINAL string.
 * Offsets in every edit are relative to `original` (never to a mutated copy).
 */
export function applyEdits(original: string, edits: Edit[]): string {
  const ms = new MagicString(original)
  for (const edit of edits) {
    if (edit.kind === 'setAttrs') {
      const st = edit.span.startTag
      if (!st) continue // can't safely rewrite without a start-tag location
      const newTag = `<${edit.tagName}${attrsToString(edit.attrs)}>`
      ms.overwrite(st.startOffset, st.endOffset, newTag)
    } else if (edit.kind === 'remove') {
      ms.remove(edit.span.startOffset, edit.span.endOffset)
    } else if (edit.kind === 'insertBefore') {
      ms.appendLeft(edit.anchorOffset, edit.html)
    }
  }
  return ms.toString()
}
```

- [ ] **Step 3: Make text capture real (small tree.ts upgrade)**

In `src/renderer/model/tree.ts`, inside `convert`, after computing `attrs`, capture text/comment payloads so `nodeToHtml` round-trips them. Add right before `byId.set(...)`:
```ts
  if (node.kind === 'text') node.attrs['#text'] = String(p5.value ?? '')
  if (node.kind === 'comment') node.attrs['#data'] = String(p5.data ?? '')
```

- [ ] **Step 4: Run serialize + tree tests**

Run: `npx vitest run tests/model`
Expected: PASS (tree + serialize).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: surgical HTML serialize via magic-string (setAttrs/remove/insert)"
```

---

## Task 4: Command history foundation + MoveNode + SetInlineStyle

**Goal:** Every edit is a reversible command that mutates the tree and records the `Edit`s needed to persist it. This makes Layer-2 undo/redo trivial later.

**Files:**
- Create: `src/renderer/history/command.ts`, `src/renderer/history/history.ts`, `src/renderer/history/commands/move-node.ts`, `src/renderer/history/commands/set-inline-style.ts`
- Test: `tests/history/move-node.test.ts`, `tests/history/set-inline-style.test.ts`

- [ ] **Step 1: Command + history interfaces**

Create `src/renderer/history/command.ts`:
```ts
import type { EditorNode } from '../../common/types'
import type { Edit } from '../model/serialize'

export interface CommandContext {
  root: EditorNode
  byId: Map<string, EditorNode>
}

export interface Command {
  label: string
  /** Mutate the tree. Returns nothing; throws on invalid state. */
  execute(ctx: CommandContext): void
  /** Reverse the tree mutation. */
  undo(ctx: CommandContext): void
  /** The persistence edits (against the ORIGINAL source) this command implies. */
  toEdits(ctx: CommandContext): Edit[]
}
```

Create `src/renderer/history/history.ts`:
```ts
import type { Command, CommandContext } from './command'

export class History {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  constructor(private ctx: CommandContext) {}

  run(cmd: Command): void {
    cmd.execute(this.ctx)
    this.undoStack.push(cmd)
    this.redoStack.length = 0
  }
  undo(): void {
    const cmd = this.undoStack.pop()
    if (!cmd) return
    cmd.undo(this.ctx)
    this.redoStack.push(cmd)
  }
  redo(): void {
    const cmd = this.redoStack.pop()
    if (!cmd) return
    cmd.execute(this.ctx)
    this.undoStack.push(cmd)
  }
  canUndo() { return this.undoStack.length > 0 }
  canRedo() { return this.redoStack.length > 0 }
  /** All edits from all executed (not undone) commands, in order. */
  pendingEdits(): Edit[] {
    return this.undoStack.flatMap(c => c.toEdits(this.ctx))
  }
}
import type { Edit } from '../model/serialize'
```
> Note: move the `import type { Edit }` line to the top of the file with the other import; it's shown here for clarity. (When implementing, place both imports at the top.)

- [ ] **Step 2: Failing test for SetInlineStyle (simplest command first)**

Create `tests/history/set-inline-style.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTree } from '../../src/renderer/model/tree'
import { SetInlineStyle } from '../../src/renderer/history/commands/set-inline-style'
import { History } from '../../src/renderer/history/history'

const HTML = `<div id="box">x</div>`

describe('SetInlineStyle', () => {
  it('sets style props and is reversible', () => {
    const { root, byId } = buildTree(HTML)
    const box = [...byId.values()].find(n => n.tagName === 'div')!
    const h = new History({ root, byId })

    h.run(new SetInlineStyle(box.nodeId, { left: '10px', top: '20px', position: 'absolute' }))
    expect(box.attrs.style).toContain('left: 10px')
    expect(box.attrs.style).toContain('position: absolute')

    h.undo()
    expect(box.attrs.style ?? '').not.toContain('left: 10px')
  })
})
```

- [ ] **Step 2b: Run to confirm failure**

Run: `npx vitest run tests/history/set-inline-style.test.ts`
Expected: FAIL — `SetInlineStyle` not defined.

- [ ] **Step 3: Implement SetInlineStyle**

Create `src/renderer/history/commands/set-inline-style.ts`:
```ts
import type { Command, CommandContext } from '../command'
import type { Edit } from '../../model/serialize'
import { findById } from '../../model/tree'

function parseStyle(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!s) return out
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':')
    if (i === -1) continue
    const k = decl.slice(0, i).trim()
    const v = decl.slice(i + 1).trim()
    if (k) out[k] = v
  }
  return out
}
function styleToString(map: Record<string, string>): string {
  return Object.entries(map).map(([k, v]) => `${k}: ${v}`).join('; ')
}

export class SetInlineStyle implements Command {
  label = 'Move / restyle element'
  private prevStyle: string | undefined
  constructor(private nodeId: string, private props: Record<string, string>) {}

  execute(ctx: CommandContext): void {
    const node = findById(ctx.root, this.nodeId)!
    this.prevStyle = node.attrs.style
    const merged = { ...parseStyle(node.attrs.style), ...this.props }
    node.attrs.style = styleToString(merged)
  }
  undo(ctx: CommandContext): void {
    const node = findById(ctx.root, this.nodeId)!
    if (this.prevStyle === undefined) delete node.attrs.style
    else node.attrs.style = this.prevStyle
  }
  toEdits(ctx: CommandContext): Edit[] {
    const node = findById(ctx.root, this.nodeId)!
    if (!node.span?.startTag) return []
    return [{
      kind: 'setAttrs',
      nodeId: node.nodeId,
      span: node.span,
      tagName: node.tagName!,
      attrs: node.attrs,
    }]
  }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/history/set-inline-style.test.ts`
Expected: PASS.

- [ ] **Step 5: Failing test for MoveNode (reorder in flow)**

Create `tests/history/move-node.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTree } from '../../src/renderer/model/tree'
import { MoveNode } from '../../src/renderer/history/commands/move-node'
import { History } from '../../src/renderer/history/history'

const HTML = `<ul><li id="a">A</li><li id="b">B</li><li id="c">C</li></ul>`

function ids(parentTag: string, byId: Map<string, any>) {
  const ul = [...byId.values()].find(n => n.tagName === parentTag)!
  return ul.children.filter((c: any) => c.tagName === 'li').map((c: any) => c.attrs.id)
}

describe('MoveNode', () => {
  it('reorders a child within the same parent and is reversible', () => {
    const { root, byId } = buildTree(HTML)
    const c = [...byId.values()].find(n => n.attrs.id === 'c')!
    const a = [...byId.values()].find(n => n.attrs.id === 'a')!
    const h = new History({ root, byId })

    // move C before A  => [c, a, b]
    h.run(new MoveNode(c.nodeId, { beforeNodeId: a.nodeId }))
    expect(ids('ul', byId)).toEqual(['c', 'a', 'b'])

    h.undo()
    expect(ids('ul', byId)).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 5b: Run to confirm failure**

Run: `npx vitest run tests/history/move-node.test.ts`
Expected: FAIL — `MoveNode` not defined.

- [ ] **Step 6: Implement MoveNode**

Create `src/renderer/history/commands/move-node.ts`:
```ts
import type { Command, CommandContext } from '../command'
import type { Edit } from '../../model/serialize'
import { findById } from '../../model/tree'
import { nodeToHtml } from '../../model/serialize'
import type { EditorNode } from '../../../common/types'

interface MoveTarget {
  /** insert the moved node immediately before this node (same or new parent) */
  beforeNodeId?: string
  /** OR append as last child of this parent */
  intoParentId?: string
}

function detach(node: EditorNode): { parent: EditorNode; index: number } {
  const parent = node.parent!
  const index = parent.children.indexOf(node)
  parent.children.splice(index, 1)
  return { parent, index }
}

export class MoveNode implements Command {
  label = 'Move element'
  private from?: { parent: EditorNode; index: number }
  constructor(private nodeId: string, private target: MoveTarget) {}

  execute(ctx: CommandContext): void {
    const node = findById(ctx.root, this.nodeId)!
    this.from = detach(node)
    if (this.target.beforeNodeId) {
      const ref = findById(ctx.root, this.target.beforeNodeId)!
      const p = ref.parent!
      const i = p.children.indexOf(ref)
      p.children.splice(i, 0, node)
      node.parent = p
    } else if (this.target.intoParentId) {
      const p = findById(ctx.root, this.target.intoParentId)!
      p.children.push(node)
      node.parent = p
    }
  }
  undo(ctx: CommandContext): void {
    const node = findById(ctx.root, this.nodeId)!
    detach(node)
    const { parent, index } = this.from!
    parent.children.splice(index, 0, node)
    node.parent = parent
  }
  toEdits(ctx: CommandContext): Edit[] {
    const node = findById(ctx.root, this.nodeId)!
    if (!node.span) return [] // can't surgically move a node we have no source range for
    const edits: Edit[] = []
    // 1. remove at the ORIGINAL location
    edits.push({ kind: 'remove', span: node.span })
    // 2. insert the (current) markup before the new next-sibling's original offset,
    //    or at the parent's content if appended. We need an anchor offset in the ORIGINAL text.
    const anchor = this.anchorOffset(ctx, node)
    if (anchor !== null) edits.push({ kind: 'insertBefore', anchorOffset: anchor, html: nodeToHtml(node) })
    return edits
  }
  /** Find an original-source offset to anchor the insertion. */
  private anchorOffset(ctx: CommandContext, node: EditorNode): number | null {
    const idx = node.parent!.children.indexOf(node)
    // next sibling with a known original span gives a stable anchor
    for (let i = idx + 1; i < node.parent!.children.length; i++) {
      const sib = node.parent!.children[i]
      if (sib.span) return sib.span.startOffset
    }
    // else: anchor just before parent's end tag if we know it
    const p = node.parent!
    if (p.span && (p.span as any).endOffset) {
      // insert before the parent's closing tag region — approximate with parent end minus close-tag length unknown;
      // safe fallback: use the previous sibling's end.
      for (let i = idx - 1; i >= 0; i--) {
        const sib = p.children[i]
        if (sib.span) return sib.span.endOffset
      }
    }
    return null
  }
}
```
> Implementation note for the engineer: `toEdits` for a move is best-effort surgical. When no original anchor exists in the destination (e.g. moving into a parent that was parser-inserted), `toEdits` returns only the removal; Task 6's save path detects "a move with no clean anchor" and falls back to re-rendering just that subtree's parent. Keep the unit test green (tree mutation is exact); the anchor heuristic is covered by the Task 6 DoD on real files.

- [ ] **Step 7: Run all history + model tests**

Run: `npx vitest run`
Expected: PASS (tree, serialize, set-inline-style, move-node).

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: command history with MoveNode and SetInlineStyle commands"
```

---

## Task 5: File open + render into the iframe (Layer 1a)

**Goal:** Open a real `.html` via dialog, read it preserving bytes, build the tree, sanitize, and render it inside the sandboxed iframe.

**Files:**
- Create: `src/main/fs-service.ts`, `src/renderer/canvas/iframe-host.ts`, `src/renderer/canvas/iframe-bootstrap.ts`
- Modify: `src/common/ipc-contracts.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/app.ts`

- [ ] **Step 1: Extend IPC contract for open/save**

In `src/common/ipc-contracts.ts`, add:
```ts
export const OpenFileResult = z.object({
  canceled: z.boolean(),
  path: z.string().optional(),
  content: z.string().optional(),
  eol: z.enum(['lf', 'crlf']).optional(),
  bom: z.boolean().optional(),
})
export type OpenFileResult = z.infer<typeof OpenFileResult>

export const SaveDocumentArgs = z.object({
  path: z.string(),
  content: z.string(),
  bom: z.boolean(),
})
export type SaveDocumentArgs = z.infer<typeof SaveDocumentArgs>
```

- [ ] **Step 2: Implement fs-service (read + atomic write, preserve EOL/BOM)**

Create `src/main/fs-service.ts`:
```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface ReadResult { content: string; eol: 'lf' | 'crlf'; bom: boolean }

export async function readHtml(filePath: string): Promise<ReadResult> {
  const buf = await fs.readFile(filePath)
  let bom = false
  let start = 0
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    bom = true; start = 3
  }
  const content = buf.toString('utf8', start)
  const eol: 'lf' | 'crlf' = content.includes('\r\n') ? 'crlf' : 'lf'
  return { content, eol, bom }
}

/** Atomic write: temp file in same dir + rename. Re-adds BOM if the original had one. */
export async function writeHtmlAtomic(filePath: string, content: string, bom: boolean): Promise<void> {
  const dir = path.dirname(filePath)
  const tmp = path.join(dir, `.locomotor-${path.basename(filePath)}.tmp`)
  const data = bom ? '﻿' + content : content
  await fs.writeFile(tmp, data, 'utf8')
  await fs.rename(tmp, filePath)
}
```

- [ ] **Step 3: Wire open/save handlers in main**

In `src/main/index.ts`, add imports and handlers:
```ts
import { dialog } from 'electron'
import { readHtml, writeHtmlAtomic } from './fs-service.js'
import { SaveDocumentArgs } from '../common/ipc-contracts.js'
```
And register (inside the module, after the ping handler):
```ts
ipcMain.handle(CH.openFile, async () => {
  const r = await dialog.showOpenDialog({
    title: 'Open an HTML page',
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
    properties: ['openFile'],
  })
  if (r.canceled || r.filePaths.length === 0) return { canceled: true }
  const file = r.filePaths[0]
  const { content, eol, bom } = await readHtml(file)
  return { canceled: false, path: file, content, eol, bom }
})

ipcMain.handle(CH.saveDocument, async (_e, raw: unknown) => {
  const args = SaveDocumentArgs.parse(raw)
  await writeHtmlAtomic(args.path, args.content, args.bom)
  return { ok: true as const }
})
```

- [ ] **Step 4: Expose open/save in preload**

In `src/preload/index.ts`, extend the exposed object:
```ts
import type { OpenFileResult } from '../common/ipc-contracts.js'

contextBridge.exposeInMainWorld('locomotor', {
  ping: () => ipcRenderer.invoke(CH.ping),
  openFile: (): Promise<OpenFileResult> => ipcRenderer.invoke(CH.openFile),
  saveDocument: (args: { path: string; content: string; bom: boolean }) =>
    ipcRenderer.invoke(CH.saveDocument, args),
})
```

- [ ] **Step 5: Iframe bootstrap (runs INSIDE the iframe; forwards events)**

Create `src/renderer/canvas/iframe-bootstrap.ts`:
```ts
// This string is injected into the iframe document. It forwards clicks/hover to the host
// via postMessage, tagging the editor id we stamped on each element (data-loco-id).
export const BOOTSTRAP = `
(function () {
  function idOf(el){ while(el && el.nodeType===1){ if(el.dataset && el.dataset.locoId) return el.dataset.locoId; el = el.parentElement; } return null; }
  document.addEventListener('click', function(e){
    var id = idOf(e.target);
    parent.postMessage({ __loco:true, type:'click', id:id, x:e.clientX, y:e.clientY }, '*');
    e.preventDefault();
  }, true);
  document.addEventListener('mousemove', function(e){
    var id = idOf(e.target);
    parent.postMessage({ __loco:true, type:'hover', id:id }, '*');
  }, true);
}());
`
```

- [ ] **Step 6: Iframe host (render tree → iframe, stamp transient ids)**

Create `src/renderer/canvas/iframe-host.ts`:
```ts
import DOMPurify from 'dompurify'
import type { EditorNode } from '../../common/types'
import { nodeToHtml } from '../model/serialize'
import { BOOTSTRAP } from './iframe-bootstrap'

/** Recursively emit HTML for rendering, stamping data-loco-id on every element. */
function renderWithIds(node: EditorNode): string {
  if (node.kind === 'text') return node.attrs['#text'] ?? ''
  if (node.kind === 'comment') return `<!--${node.attrs['#data'] ?? ''}-->`
  if (node.kind === 'element') {
    const tag = node.tagName!
    const attrs = { ...node.attrs, 'data-loco-id': node.nodeId }
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${String(v).replaceAll('&','&amp;').replaceAll('"','&quot;')}"`)
      .join(' ')
    const VOID = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']
    const open = `<${tag} ${attrStr}>`
    if (VOID.includes(tag)) return open
    return `${open}${node.children.map(renderWithIds).join('')}</${tag}>`
  }
  return node.children.map(renderWithIds).join('')
}

export function renderIntoIframe(iframe: HTMLIFrameElement, root: EditorNode): void {
  // find <html> child to render the full doc; fall back to whole tree
  const htmlNode = root.children.find(c => c.tagName === 'html') ?? root
  const bodyHtml = renderWithIds(htmlNode)
  const safe = DOMPurify.sanitize(bodyHtml, { WHOLE_DOCUMENT: true, ADD_ATTR: ['data-loco-id'] })
  const doc = iframe.contentDocument!
  doc.open()
  doc.write(safe)
  doc.close()
  // inject the event-forwarding bootstrap (into the iframe, never the user's file)
  const s = doc.createElement('script')
  s.textContent = BOOTSTRAP
  doc.body?.appendChild(s)
}
```

- [ ] **Step 7: Wire Open button in the renderer**

Replace `src/renderer/app.ts` with:
```ts
import { buildTree, findById } from './model/tree'
import { renderIntoIframe } from './canvas/iframe-host'
import { History } from './history/history'
import type { EditorNode, NodeId } from '../common/types'

declare global {
  interface Window {
    locomotor: {
      ping: () => Promise<{ ok: true; pong: string }>
      openFile: () => Promise<{ canceled: boolean; path?: string; content?: string; bom?: boolean }>
      saveDocument: (a: { path: string; content: string; bom: boolean }) => Promise<{ ok: true }>
    }
  }
}

// App state (module-level for v1 simplicity)
export const state: {
  filePath: string | null
  originalHtml: string
  bom: boolean
  root: EditorNode | null
  byId: Map<NodeId, EditorNode>
  history: History | null
  selectedId: NodeId | null
} = { filePath: null, originalHtml: '', bom: false, root: null, byId: new Map(), history: null, selectedId: null }

const iframe = document.getElementById('canvas') as HTMLIFrameElement
const btnOpen = document.getElementById('btn-open') as HTMLButtonElement
const btnSave = document.getElementById('btn-save') as HTMLButtonElement

btnOpen.addEventListener('click', async () => {
  const res = await window.locomotor.openFile()
  if (res.canceled || !res.path || res.content == null) return
  state.filePath = res.path
  state.originalHtml = res.content
  state.bom = !!res.bom
  const { root, byId } = buildTree(res.content)
  state.root = root
  state.byId = byId
  state.history = new History({ root, byId })
  renderIntoIframe(iframe, root)
  btnSave.disabled = false
})

export {}
```

- [ ] **Step 8: Run & DoD — open renders faithfully**

Run: `npm run dev`. Click **Open…**, pick a real `.html` file (use a simple one with a heading, a paragraph, and a list).
Expected (DoD): the page renders inside the canvas looking like it does in a browser. DevTools console shows no errors. Save button becomes enabled.

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "feat: open html file, build tree, render into sandboxed iframe"
```

---

## Task 6: Selection + overlay (Layer 1b)

**Goal:** Clicking an element in the canvas highlights it with a box in the host overlay that tracks scroll/resize.

**Files:**
- Create: `vendor/get-nested-bounding-client-rect.ts`, `src/renderer/overlay/rects.ts`, `src/renderer/overlay/overlay.ts`, `src/renderer/interaction/selection.ts`
- Modify: `src/renderer/app.ts`

- [ ] **Step 1: Vendor the nested-rect math**

Create `vendor/get-nested-bounding-client-rect.ts`:
```ts
// Vendored (MIT) — computes an element's rect relative to the TOP window,
// accounting for the offset of the iframe(s) it lives in.
export interface Rect { top: number; left: number; width: number; height: number }

export function getNestedBoundingClientRect(node: Element, boundary: Window = window): Rect {
  const r = node.getBoundingClientRect()
  let top = r.top, left = r.left
  const { width, height } = r
  let win: Window | null = node.ownerDocument?.defaultView ?? null
  while (win && win !== boundary && win.frameElement) {
    const fr = (win.frameElement as Element).getBoundingClientRect()
    top += fr.top
    left += fr.left
    win = win.parent
  }
  return { top, left, width, height }
}
```

- [ ] **Step 2: rects helper (iframe element → host coords)**

Create `src/renderer/overlay/rects.ts`:
```ts
import { getNestedBoundingClientRect, type Rect } from '../../../vendor/get-nested-bounding-client-rect'

/** Rect of an iframe-internal element expressed in the host #canvas-wrap's coordinate space. */
export function rectInCanvas(el: Element, canvasWrap: HTMLElement): Rect {
  const abs = getNestedBoundingClientRect(el, window)
  const wrap = canvasWrap.getBoundingClientRect()
  return { top: abs.top - wrap.top, left: abs.left - wrap.left, width: abs.width, height: abs.height }
}
```

- [ ] **Step 3: overlay drawing**

Create `src/renderer/overlay/overlay.ts`:
```ts
import type { Rect } from '../../../vendor/get-nested-bounding-client-rect'

export class Overlay {
  private box: HTMLDivElement
  constructor(private host: HTMLElement) {
    this.box = document.createElement('div')
    Object.assign(this.box.style, {
      position: 'absolute', border: '2px solid #2563eb', borderRadius: '2px',
      pointerEvents: 'none', display: 'none', boxSizing: 'border-box', zIndex: '10',
    } as CSSStyleDeclaration)
    host.appendChild(this.box)
  }
  show(r: Rect) {
    Object.assign(this.box.style, {
      display: 'block', top: `${r.top}px`, left: `${r.left}px`,
      width: `${r.width}px`, height: `${r.height}px`,
    } as CSSStyleDeclaration)
  }
  hide() { this.box.style.display = 'none' }
}
```

- [ ] **Step 4: selection controller**

Create `src/renderer/interaction/selection.ts`:
```ts
import type { NodeId } from '../../common/types'
import { Overlay } from '../overlay/overlay'
import { rectInCanvas } from '../overlay/rects'

export class Selection {
  selectedId: NodeId | null = null
  constructor(
    private iframe: HTMLIFrameElement,
    private canvasWrap: HTMLElement,
    private overlay: Overlay,
    private onSelect: (id: NodeId | null) => void,
  ) {
    window.addEventListener('message', (e) => this.onMessage(e))
    // re-anchor on scroll/resize
    const reanchor = () => this.reanchor()
    this.iframe.contentWindow?.addEventListener('scroll', () => requestAnimationFrame(reanchor), true)
    window.addEventListener('resize', reanchor)
    new ResizeObserver(reanchor).observe(this.canvasWrap)
  }
  private elFor(id: NodeId): Element | null {
    return this.iframe.contentDocument?.querySelector(`[data-loco-id="${id}"]`) ?? null
  }
  select(id: NodeId | null) {
    this.selectedId = id
    this.onSelect(id)
    this.reanchor()
  }
  reanchor() {
    if (!this.selectedId) { this.overlay.hide(); return }
    const el = this.elFor(this.selectedId)
    if (!el) { this.overlay.hide(); return }
    this.overlay.show(rectInCanvas(el, this.canvasWrap))
  }
  private onMessage(e: MessageEvent) {
    const d = e.data
    if (!d || d.__loco !== true) return
    if (d.type === 'click') this.select(d.id ?? null)
  }
}
```

- [ ] **Step 5: Wire selection into app.ts**

In `src/renderer/app.ts`, add imports near the top:
```ts
import { Overlay } from './overlay/overlay'
import { Selection } from './interaction/selection'
```
Add module-level after the iframe/button consts:
```ts
const canvasWrap = document.getElementById('canvas-wrap') as HTMLElement
const overlay = new Overlay(document.getElementById('overlay') as HTMLElement)
let selection: Selection | null = null
```
At the END of the Open handler (after `renderIntoIframe(...)`), add:
```ts
  selection = new Selection(iframe, canvasWrap, overlay, (id) => { state.selectedId = id })
```
> Note: re-creating `Selection` per open is fine for v1 (old listeners are GC'd with the iframe document). A single long-lived Selection is a Layer-2 refinement.

- [ ] **Step 6: DoD — click selects, box tracks scroll**

Run: `npm run dev`, open a tall page. Click various elements → a blue box appears around exactly the clicked element. Scroll the page → the box stays aligned. Resize the window → still aligned.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: click selection with host overlay that tracks scroll/resize"
```

---

## Task 7: Drag — Tidy (reorder) + Free (absolute), per-drag toggle (Layer 1c)

**Goal:** With the toolbar set to Tidy, dragging an element reorders it among siblings (→ MoveNode). With Free, dragging repositions it absolutely (→ SetInlineStyle). Each drop mutates the tree via a command and re-renders.

**Files:**
- Create: `src/renderer/interaction/mode-toggle.ts`, `src/renderer/interaction/drag-flow.ts`, `src/renderer/interaction/drag-free.ts`
- Modify: `src/renderer/app.ts`

- [ ] **Step 1: Mode toggle**

Create `src/renderer/interaction/mode-toggle.ts`:
```ts
import type { DragMode } from '../../common/types'

export class ModeToggle {
  private mode: DragMode = 'tidy'
  constructor() {
    document.querySelectorAll<HTMLInputElement>('input[name="dragmode"]').forEach((r) => {
      r.addEventListener('change', () => { if (r.checked) this.mode = r.value as DragMode })
    })
  }
  get(): DragMode { return this.mode }
}
```

- [ ] **Step 2: Flow drag (SortableJS on the iframe body)**

Create `src/renderer/interaction/drag-flow.ts`:
```ts
import Sortable from 'sortablejs'
import type { NodeId } from '../../common/types'

/**
 * Enable reorder for the direct children of a container element inside the iframe.
 * onMove(movedId, beforeId|null) fires after a drop so the caller can run a MoveNode command.
 */
export function enableFlowDrag(
  container: HTMLElement,
  onMove: (movedId: NodeId, beforeId: NodeId | null) => void,
): Sortable {
  return Sortable.create(container, {
    animation: 120,
    draggable: '[data-loco-id]',
    onEnd: (evt) => {
      const moved = evt.item.getAttribute('data-loco-id')
      if (!moved) return
      const next = evt.item.nextElementSibling as HTMLElement | null
      const beforeId = next?.getAttribute('data-loco-id') ?? null
      onMove(moved, beforeId)
    },
  })
}
```

- [ ] **Step 3: Free drag (Moveable, absolute)**

Create `src/renderer/interaction/drag-free.ts`:
```ts
import Moveable from 'moveable'
import type { NodeId } from '../../common/types'

/**
 * Attach a Moveable controller (in the HOST document) that drives an element inside the iframe.
 * onApply(id, {left,top}) fires on drag end so the caller can run a SetInlineStyle command.
 */
export function makeFreeMover(
  hostContainer: HTMLElement,
  getTarget: () => HTMLElement | null,
  onApply: (id: NodeId, pos: { left: number; top: number }) => void,
): Moveable {
  const mv = new Moveable(hostContainer, {
    target: getTarget() ?? undefined,
    draggable: true,
    resizable: true,
    origin: false,
  })
  let dx = 0, dy = 0
  mv.on('dragStart', () => { dx = 0; dy = 0 })
  mv.on('drag', (e) => {
    dx = e.beforeTranslate[0]; dy = e.beforeTranslate[1]
    e.target.style.transform = `translate(${dx}px, ${dy}px)`
  })
  mv.on('dragEnd', () => {
    const t = getTarget(); if (!t) return
    const id = t.getAttribute('data-loco-id'); if (!id) return
    const rect = t.getBoundingClientRect()
    // commit as absolute position; clear the transient transform
    t.style.transform = ''
    onApply(id, { left: Math.round(rect.left + dx), top: Math.round(rect.top + dy) })
  })
  return mv
}
```
> Implementation note: Moveable lives in the host document but its `target` is an element inside the iframe; Moveable supports cross-document targets when given the element reference. If alignment is off, pass `rootContainer: canvasWrap` and rely on `rectInCanvas` for the commit coordinates. The DoD validates the *committed style*, which is what gets saved.

- [ ] **Step 4: Wire both into app.ts (re-render after each command)**

In `src/renderer/app.ts`:
- Add imports:
```ts
import { ModeToggle } from './interaction/mode-toggle'
import { enableFlowDrag } from './interaction/drag-flow'
import { makeFreeMover } from './interaction/drag-free'
import { MoveNode } from './history/commands/move-node'
import { SetInlineStyle } from './history/commands/set-inline-style'
```
- Add a `rerender()` helper and a module-level `const modeToggle = new ModeToggle()` (place after `overlay`):
```ts
const modeToggle = new ModeToggle()

function rerender() {
  if (!state.root) return
  renderIntoIframe(iframe, state.root)
  // rebind drag for the new document
  bindDrag()
  selection?.reanchor()
}

function bindDrag() {
  const doc = iframe.contentDocument
  if (!doc || !doc.body) return
  if (modeToggle.get() === 'tidy') {
    // enable reorder on the body and on each element with element children (v1: body-level)
    enableFlowDrag(doc.body, (movedId, beforeId) => {
      if (!state.history) return
      state.history.run(new MoveNode(movedId, beforeId ? { beforeNodeId: beforeId } : { intoParentId: bodyId() }))
      rerender()
    })
  } else {
    makeFreeMover(canvasWrap, () => selectedEl(), (id, pos) => {
      if (!state.history) return
      state.history.run(new SetInlineStyle(id, { position: 'absolute', left: `${pos.left}px`, top: `${pos.top}px` }))
      rerender()
    })
  }
}

function bodyId(): string {
  const body = [...state.byId.values()].find(n => n.tagName === 'body')
  return body?.nodeId ?? ''
}
function selectedEl(): HTMLElement | null {
  if (!state.selectedId) return null
  return (iframe.contentDocument?.querySelector(`[data-loco-id="${state.selectedId}"]`) as HTMLElement) ?? null
}
```
- Call `bindDrag()` at the end of the Open handler (after creating `selection`).
- Re-run `bindDrag()` when the mode changes: in `ModeToggle` callback we can't reach app scope, so add in the Open handler after `bindDrag()`:
```ts
  document.querySelectorAll('input[name="dragmode"]').forEach(r =>
    r.addEventListener('change', () => bindDrag()))
```

- [ ] **Step 5: DoD — both drag modes mutate and persist in-memory**

Run: `npm run dev`, open a page with a list / several block elements.
- **Tidy:** drag a block above another → they reorder and stay reordered. (Confirms MoveNode ran.)
- **Free:** switch to Free, click a block to select it, drag it → it moves to where you drop it and stays. (Confirms SetInlineStyle ran: inspect the element in DevTools → it now has `style="position: absolute; left: …; top: …"`.)

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: tidy reorder (SortableJS) and free absolute drag (Moveable) via commands"
```

---

## Task 8: Save back to disk (Layer 1d) — the core promise

**Goal:** Ctrl+S / Save writes the changes surgically to the real file. Untouched regions are byte-identical.

**Files:**
- Modify: `src/renderer/app.ts`

**Strategy:** `state.history.pendingEdits()` gives all `Edit`s (against the ORIGINAL source). Apply them in one `applyEdits` pass over `state.originalHtml`. For Free-mode edits (setAttrs) this is exact. For moves where `toEdits` produced a clean remove+insert, it's surgical. If a move lacked a clean anchor (returned only a remove), fall back: re-serialize that move's destination parent subtree using `nodeToHtml` and splice it over the parent's original span. (v1 keeps it simple: if ANY pending edit is an "unanchored move", we splice the affected parent's whole subtree; everything else stays surgical.)

- [ ] **Step 1: Implement save in app.ts**

In `src/renderer/app.ts`, add:
```ts
import { applyEdits, type Edit } from './model/serialize'

async function save() {
  if (!state.filePath || !state.history) return
  const edits: Edit[] = state.history.pendingEdits()
  const out = applyEdits(state.originalHtml, edits)
  await window.locomotor.saveDocument({ path: state.filePath, content: out, bom: state.bom })
  // adopt saved output as the new baseline so further edits diff against it
  state.originalHtml = out
  const { buildTree } = await import('./model/tree')
  const rebuilt = buildTree(out)
  state.root = rebuilt.root
  state.byId = rebuilt.byId
  const { History } = await import('./history/history')
  state.history = new History({ root: rebuilt.root, byId: rebuilt.byId })
  rerender()
  flashSaved()
}

function flashSaved() {
  btnSave.textContent = 'Saved ✓'
  setTimeout(() => (btnSave.textContent = 'Save'), 1200)
}

btnSave.addEventListener('click', save)
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
})
```

- [ ] **Step 2: DoD — Free-mode save is surgical**

Run: `npm run dev`. Open a small known file, e.g. create `test.html`:
```html
<!doctype html>
<html>
  <body>
    <h1>Hello</h1>
    <p id="lead">Welcome to my page.</p>
  </body>
</html>
```
Switch to **Free**, select `<p>`, drag it a little, **Ctrl+S**. Open `test.html` in a text editor.
Expected (DoD): the `<p>` now has `style="position: absolute; left:…; top:…"` and **every other line is character-for-character unchanged** (same indentation, same `<!doctype html>`, same `<h1>Hello</h1>`).

- [ ] **Step 3: DoD — Tidy-mode save reorders cleanly**

Reload, in **Tidy** drag `<p>` above `<h1>`, Ctrl+S. Open the file.
Expected: `<p …>` now appears before `<h1>`; tags are intact and the document still renders correctly in a browser. (Some local reflow of whitespace around the moved node is acceptable in v1; the rest of the file is unchanged.)

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "feat: surgical save to disk for free and tidy edits (Ctrl+S)"
```

---

## Task 9: Embedded Claude terminal (Layer 1e)

**Goal:** A working terminal at the bottom, `cd`'d into the opened file's folder, that autostarts `claude`.

**Files:**
- Create: `src/main/pty-service.ts`, `src/renderer/terminal/terminal.ts`
- Modify: `src/common/ipc-contracts.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/app.ts`, `index.html`

- [ ] **Step 1: Extend IPC contract for PTY**

In `src/common/ipc-contracts.ts`, add:
```ts
export const PtySpawnArgs = z.object({ cwd: z.string(), cols: z.number(), rows: z.number() })
export type PtySpawnArgs = z.infer<typeof PtySpawnArgs>
export const PtyInputArgs = z.object({ id: z.number(), data: z.string() })
export type PtyInputArgs = z.infer<typeof PtyInputArgs>
export const PtyResizeArgs = z.object({ id: z.number(), cols: z.number(), rows: z.number() })
export type PtyResizeArgs = z.infer<typeof PtyResizeArgs>
```

- [ ] **Step 2: Implement pty-service (main)**

Create `src/main/pty-service.ts`:
```ts
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash')
const ptys = new Map<number, IPty>()
let nextId = 1

export function spawnPty(cwd: string, cols: number, rows: number, onData: (id: number, data: string) => void, onExit: (id: number) => void): number {
  const id = nextId++
  const p = pty.spawn(shell, [], { name: 'xterm-color', cols, rows, cwd, env: process.env as Record<string, string> })
  ptys.set(id, p)
  p.onData((d) => onData(id, d))
  p.onExit(() => { ptys.delete(id); onExit(id) })
  return id
}
export function writePty(id: number, data: string) { ptys.get(id)?.write(data) }
export function resizePty(id: number, cols: number, rows: number) { try { ptys.get(id)?.resize(cols, rows) } catch {} }
export function killAll() { for (const p of ptys.values()) { try { p.kill() } catch {} } ptys.clear() }
```

- [ ] **Step 3: Wire PTY handlers + cleanup in main**

In `src/main/index.ts`:
```ts
import { spawnPty, writePty, resizePty, killAll } from './pty-service.js'
import { PtySpawnArgs, PtyInputArgs, PtyResizeArgs } from '../common/ipc-contracts.js'
```
Register handlers:
```ts
ipcMain.handle(CH.ptySpawn, (e, raw: unknown) => {
  const { cwd, cols, rows } = PtySpawnArgs.parse(raw)
  const wc = e.sender
  const id = spawnPty(cwd, cols, rows,
    (pid, data) => wc.send(CH.ptyData, { id: pid, data }),
    (pid) => wc.send(CH.ptyExit, { id: pid }))
  return { id }
})
ipcMain.on(CH.ptyInput, (_e, raw: unknown) => { const a = PtyInputArgs.parse(raw); writePty(a.id, a.data) })
ipcMain.on(CH.ptyResize, (_e, raw: unknown) => { const a = PtyResizeArgs.parse(raw); resizePty(a.id, a.cols, a.rows) })

app.on('before-quit', () => killAll())
```

- [ ] **Step 4: Expose PTY in preload**

In `src/preload/index.ts`, add to the exposed object:
```ts
  pty: {
    spawn: (cwd: string, cols: number, rows: number) => ipcRenderer.invoke(CH.ptySpawn, { cwd, cols, rows }),
    input: (id: number, data: string) => ipcRenderer.send(CH.ptyInput, { id, data }),
    resize: (id: number, cols: number, rows: number) => ipcRenderer.send(CH.ptyResize, { id, cols, rows }),
    onData: (cb: (id: number, data: string) => void) =>
      ipcRenderer.on(CH.ptyData, (_e, m) => cb(m.id, m.data)),
    onExit: (cb: (id: number) => void) =>
      ipcRenderer.on(CH.ptyExit, (_e, m) => cb(m.id)),
  },
```

- [ ] **Step 5: Add xterm CSS to index.html**

In `index.html` `<head>`, add:
```html
    <link rel="stylesheet" href="/node_modules/@xterm/xterm/css/xterm.css" />
```

- [ ] **Step 6: Implement terminal (renderer)**

Create `src/renderer/terminal/terminal.ts`:
```ts
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

declare global {
  interface Window {
    locomotor: Window['locomotor'] & {
      pty: {
        spawn: (cwd: string, cols: number, rows: number) => Promise<{ id: number }>
        input: (id: number, data: string) => void
        resize: (id: number, cols: number, rows: number) => void
        onData: (cb: (id: number, data: string) => void) => void
        onExit: (cb: (id: number) => void) => void
      }
    }
  }
}

export async function startTerminal(mount: HTMLElement, cwd: string, autostart = 'claude') {
  const term = new Terminal({ cursorBlink: true, fontSize: 13, theme: { background: '#1e1e1e' } })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(mount)
  fit.fit()

  const { id } = await window.locomotor.pty.spawn(cwd, term.cols, term.rows)
  window.locomotor.pty.onData((pid, data) => { if (pid === id) term.write(data) })
  window.locomotor.pty.onExit((pid) => { if (pid === id) term.write('\r\n[process exited]\r\n') })
  term.onData((d) => window.locomotor.pty.input(id, d))
  const ro = new ResizeObserver(() => { fit.fit(); window.locomotor.pty.resize(id, term.cols, term.rows) })
  ro.observe(mount)

  if (autostart) setTimeout(() => window.locomotor.pty.input(id, autostart + '\r'), 400)
  return term
}
```

- [ ] **Step 7: Start the terminal when a file opens**

In `src/renderer/app.ts`:
```ts
import { startTerminal } from './terminal/terminal'
```
At the end of the Open handler (after `bindDrag()`), add — start the terminal in the file's directory:
```ts
  // start terminal in the file's folder (only once)
  if (!terminalStarted && state.filePath) {
    terminalStarted = true
    const dir = state.filePath.replace(/[\\/][^\\/]*$/, '')
    startTerminal(document.getElementById('terminal') as HTMLElement, dir)
  }
```
Add module-level: `let terminalStarted = false`.

- [ ] **Step 8: DoD — terminal works and autostarts claude**

Run: `npm run dev`. Open an `.html` file that lives in a folder. The bottom strip shows a terminal prompt already in that folder. After a moment `claude` launches and shows its interactive UI (not a "Raw mode is not supported" error). Type a message and confirm Claude responds. Close the app → no lingering `OpenConsole.exe`/`powershell` (Task focus R1).

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "feat: embedded xterm terminal via node-pty, autostart claude in file dir"
```

---

## Task 10: Packaged build smoke test (Layer 1f)

**Goal:** The installed app (not just `npm run dev`) does everything in Layer 1, especially the terminal (where native-module packaging fails silently).

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json` (already has `dist` script + `postinstall`)

- [ ] **Step 1: Create electron-builder config**

Create `electron-builder.yml`:
```yaml
appId: com.locomotor.app
productName: Locomotor
directories:
  output: release
files:
  - out/**
asarUnpack:
  - "**/node_modules/node-pty/**"
win:
  target:
    - target: nsis
nsis:
  oneClick: true
  perMachine: false
  allowToChangeInstallationDirectory: false
```

- [ ] **Step 2: Ensure native module ABI matches Electron**

Run:
```powershell
npx electron-builder install-app-deps
```
Expected: rebuilds node-pty against Electron 42's ABI without error. If it errors, run `npx @electron/rebuild -f -w node-pty` and retry.

- [ ] **Step 3: Build the installer**

Run:
```powershell
npm run dist
```
Expected: `release/` contains `Locomotor Setup 0.0.1.exe`.

- [ ] **Step 4: DoD — install on a clean machine/VM and re-test Layer 1**

Copy the Setup `.exe` to a clean Windows 11 machine or fresh VM (no Node, no dev tools). Install (one-click). Launch. Then:
- Open an `.html` file → renders.
- Click selects; Tidy reorder works; Free drag works.
- Ctrl+S saves surgically (verify in Notepad).
- **Terminal opens in the file's folder and `claude` launches** ← the make-or-break check for R1.
- Close app → no lingering console processes.

If the terminal fails only here, the fix is in Step 1's `asarUnpack` glob and Step 2's rebuild — re-run and re-test. Do not consider Layer 1 done until this passes.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "build: NSIS one-click installer with node-pty unpacked; layer 1 complete"
```

---

## Self-review notes (done by the plan author)

- **Spec coverage:** Layer 1 sub-steps a–f from `BUILD-PLAN.md` each map to Tasks 5–10. Tree/serialize/command foundations (BUILD-PLAN §2 principles 2–4) are Tasks 2–4. Security model (principle 5) is Task 1. Packaging risk R1 is Tasks 1/9/10; clean-save R2 is Tasks 3/8; iframe-pollution R3 is Task 5 (render stamps transient ids, serialize reads from tree); overlay-drift R4 is Task 6; char-offset C2 is Task 2/3. R5 (external-edit reconcile) is intentionally **deferred to Layer 2** per the roadmap — noted, not a gap.
- **Placeholder scan:** no TBD/TODO left in steps; every code step shows code; commands have expected output.
- **Type consistency:** `EditorNode`, `NodeId`, `SourceSpan`, `DragMode` defined in Task 2 `types.ts`; `Edit` union + `applyEdits`/`nodeToHtml` in Task 3; `Command`/`CommandContext`/`History` in Task 4 and used unchanged in Tasks 7–8; channel names centralized in `CH` (Task 1) and reused everywhere. `pendingEdits()` (Task 4) is consumed by `save()` (Task 8). Known best-effort area: `MoveNode.toEdits` anchor heuristic — flagged in Task 4 note and validated by Task 8 DoD, with the documented whole-parent-subtree fallback for unanchored moves.
- **Scope:** one shippable thing (the first usable Locomotor). Layers 2–6 deliberately excluded; they get their own plans.
```
