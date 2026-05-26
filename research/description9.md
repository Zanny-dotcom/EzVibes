# Research #9 — File Watcher & Real-Time Folder UI: Visual Treatment When Files Appear

> **Topic.** How to wire a Chrome-grade live "Prompt Vault" inside an Electron 33 / vanilla-JS / node-pty app: which file watcher (`chokidar`, `@parcel/watcher`, `node:fs.watch`) is the right horse on Windows, how to debounce its noise so editor swap files don't strobe the UI, and the most pioneer-level visual treatments (FLIP, shimmer, sparkle, View-Transition API, `@starting-style`) for "new file just arrived from another agent" moments.
>
> The user's mental model: agent A in folder /alpha writes `hand-off.md` to a shared vault path; agent B in folder /beta has its vault panel open — the new file should glide in, glow once, and never miss a beat. Below is a maximum-fidelity dump.

---

## 0. Quick verdict at the top

| Pick | When | Why |
|---|---|---|
| **`chokidar@4` (4.x is CJS, 5.x is ESM-only on Node 20+)** | You're already on it, single-folder vault, low file count (< 5k). | Battle-tested, used by ~30 million repos, ships `awaitWriteFinish` + `atomic` flags built for editors that swap-write `.swp`/`tmp~` files. |
| **`@parcel/watcher`** | Multiple vaults, deep trees, or you ever expect > 5k watched files. | C++ native binding using `ReadDirectoryChangesW` directly + internal event coalescing; used in production by Tailwind, Nx, Nuxt, VSCode. Faster on Windows under churn (`git checkout`, `npm install`). |
| **`node:fs.watch` recursive** | You want zero dependencies and your minimum Node is ≥ 14.6 (recursive on Win/macOS) — still emits noisy paired events, lacks atomic/awaitWriteFinish niceties. | The "primitives" path. Wrap with your own debouncer. |
| **`node:fs.watchFile`** | Polling fallback only. | Last resort. |

The user is on Windows / Electron 33 / vanilla JS / node-pty already rebuilt in `scripts/postinstall.js`. Both `chokidar` and `@parcel/watcher` ship native-or-pure bindings that survive Electron's V8 ABI. `@parcel/watcher` is a native C++ Node module — it must be rebuilt against Electron headers exactly like `node-pty`. That's the only "tax" for switching.

**Pioneer-level pick for this app:** `chokidar` for now (zero added native build risk), but design the IPC channel so swapping in `@parcel/watcher` later is a one-file refactor. Pair it with **`@starting-style` + `auto-animate` for the visual layer**, plus a *one-time sparkle pulse* CSS keyframe on the freshly-arrived item — keyed by a `data-arrived-at="<timestamp>"` attribute so multiple files arriving in the same chokidar batch don't trample each other.

---

## 1. The file-watcher landscape (deep dive)

### 1.1 Why `node:fs.watch` alone is not enough on Windows

`fs.watch` is the lowest-level wrapper around `ReadDirectoryChangesW`. It works, but on Windows specifically it:

* Emits **`rename`** for both **add** and **delete** (you have to `fs.stat()` to disambiguate — and a `rename` of a *file* fires differently from a `rename` of a folder containing it).
* Does **not** wait for a write to finish, so editors that write in chunks (TextEdit, vim with `:set nowritebackup`, Sublime, VSCode under certain conditions) fire one `change` event per chunk — the file UI sees a "size keeps growing" parade.
* Was bug-prone for **recursive watching** on Linux until Node 20, and on Windows recursive has been there since Node 7 but produced duplicates for nested moves.
* Loses events under heavy load — there is a kernel-side buffer ring (`READDIRECTORYCHANGESW`-backed) and once it overflows you get `ERROR_NOTIFY_ENUM_DIR` (Win32) which Node surfaces as either a swallowed event or an `error` event.
* Has zero filtering — every junk file (`.git/index.lock`, `.tmp.driveupload`, `desktop.ini`) shows up unless you build your own ignore filter.

That's why every serious app reaches for chokidar or `@parcel/watcher`.

### 1.2 `chokidar` (the standard)

Latest release path: **v5.0.0 was published in November 2025** and is **ESM-only**, requires **Node ≥ 20**. Electron 33 ships Node 20.18 under the hood. If you can't / won't switch to ESM in `main.js`, pin **chokidar `^4.0.3`** which is the last CJS-friendly release. The Electron Forge / electron-builder ecosystems are still mostly CJS, so `chokidar@4` is the realistic pin.

#### 1.2.1 Install

```powershell
npm install chokidar@^4.0.3
```

Chokidar pulls in `fsevents` as an optional dep (only used on macOS). On Windows it uses `fs.watch` recursive mode underneath, so no native compile is needed and it doesn't go through `node-gyp`. **That means no Electron rebuild dance.** This is its biggest practical advantage over `@parcel/watcher` for your stack.

#### 1.2.2 The full `WatchOptions` schema (v4/v5 are identical here)

| Option | Type | Default | What it does for *your* use case |
|---|---|---|---|
| `persistent` | bool | `true` | Keep the event loop alive while watching. Yes. |
| `ignored` | function / regex / picomatch / array | — | Filter out `.git`, `node_modules`, `.DS_Store`, editor swaps. **Critical.** |
| `ignoreInitial` | bool | `false` | If `true`, no `add` events during the initial scan. **Set this to `false` for the vault** so on app start you can populate the panel; emit *no* sparkle animation for initial entries (see §6.4). |
| `followSymlinks` | bool | `true` | Off unless you specifically want vault to follow shortcuts. |
| `cwd` | string | — | Treat events as relative to this path. Optional. |
| `usePolling` | bool | `false` | Don't enable. Polling burns CPU. |
| `interval` | number | `100` | Only when `usePolling: true`. |
| `binaryInterval` | number | `300` | Same. |
| `alwaysStat` | bool | `false` | Pass `stats` to `add`/`change` handlers — yes you want this because you'll show mtime in the panel. |
| `depth` | number | unlimited | The vault is one folder — set `depth: 0` if you want flat. Set `depth: 2` if you want subdirs. **Big perf win on Windows when you cap depth.** |
| `awaitWriteFinish` | bool / obj | `false` | **Turn ON.** `{ stabilityThreshold: 300, pollInterval: 100 }` is the sweet spot — chokidar polls the file's size every 100 ms and only fires `add`/`change` after the size has been stable for 300 ms. This *eats* the chunked-write parade and gives you ONE event per actual save. |
| `atomic` | bool / number | `true` | **Leave ON.** It collapses a `delete` followed by `add` within 100 ms (the classic editor swap pattern: write to `.tmp`, delete original, rename `.tmp`) into a `change`. |
| `ignorePermissionErrors` | bool | `false` | Probably on for Windows — you don't want `desktop.ini` permission denials to crash the watcher. |

#### 1.2.3 Events emitted

```
'add'        (path, stats?)   — file appeared
'change'     (path, stats?)   — file content changed
'unlink'     (path)           — file deleted
'addDir'     (path, stats?)   — directory appeared
'unlinkDir'  (path)           — directory deleted
'ready'                       — initial scan done
'error'      (err)            — fatal
'all'        (event, path)    — convenience meta-event
'raw'        (event, path, details) — under the hood; rarely needed
```

For the prompt vault you basically only care about `add`, `change`, `unlink`. The "new file arrived from another session" event = `add` (and you *probably* also want `change` for hand-off files that get overwritten in place).

#### 1.2.4 Reference main-process setup (drop-in)

```js
// main.js — add near the IPC section
const path = require('node:path');
const chokidar = require('chokidar');

const vaultWatchers = new Map(); // sessionId -> FSWatcher

function startVaultWatcher(sessionId, vaultPath, webContents) {
  if (vaultWatchers.has(sessionId)) return;

  const watcher = chokidar.watch(vaultPath, {
    ignored: [
      /(^|[\\/])\../,        // dotfiles
      /\.(swp|swo|swn|tmp)$/i,
      /~$/,                  // editor backups
      /[\\/]node_modules[\\/]/,
      /[\\/]\.git[\\/]/,
    ],
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    atomic: 200,             // ms threshold for delete+add collapse
    depth: 2,                // flat-ish vault
    alwaysStat: true,
    ignorePermissionErrors: true,
  });

  let initialBatch = true;
  const buffer = [];
  let flushTimer = null;

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      const batch = buffer.splice(0, buffer.length);
      flushTimer = null;
      if (!webContents.isDestroyed()) {
        webContents.send('vault:events', { sessionId, initial: initialBatch, events: batch });
      }
    }, 60); // 60 ms debounce window — lower than human "now"
  }

  const push = (type, p, stats) => {
    buffer.push({
      type,
      path: p,
      relPath: path.relative(vaultPath, p),
      name: path.basename(p),
      ext: path.extname(p).toLowerCase(),
      size: stats?.size ?? 0,
      mtimeMs: stats?.mtimeMs ?? Date.now(),
      birthtimeMs: stats?.birthtimeMs ?? Date.now(),
    });
    scheduleFlush();
  };

  watcher
    .on('add',    (p, s) => push('add', p, s))
    .on('change', (p, s) => push('change', p, s))
    .on('unlink', (p)    => push('unlink', p))
    .on('ready',  ()     => { initialBatch = false; })
    .on('error',  (err)  => {
      if (!webContents.isDestroyed()) {
        webContents.send('vault:error', { sessionId, message: String(err) });
      }
    });

  vaultWatchers.set(sessionId, watcher);
}

ipcMain.handle('vault:start', async (event, { sessionId, vaultPath }) => {
  startVaultWatcher(sessionId, vaultPath, event.sender);
});

ipcMain.handle('vault:stop', async (_event, { sessionId }) => {
  const w = vaultWatchers.get(sessionId);
  if (w) {
    await w.close();
    vaultWatchers.delete(sessionId);
  }
});
```

**Why the 60 ms `scheduleFlush` debounce above chokidar's own `awaitWriteFinish`?** Because if multiple agents (or `git pull`) drop 12 files at once, you get 12 IPC trips → 12 React (or in your case 12 vanilla DOM) reconciliations. Buffering for 60 ms collapses them into one `vault:events` payload, which lets the renderer do one FLIP pass and one stagger.

#### 1.2.5 The renderer subscriber

```js
// renderer/app.js — extend the IIFE
window.ezvibes.onVaultEvents(({ sessionId, initial, events }) => {
  const session = state.windowsByPath.get(/* lookup by sessionId */);
  if (!session) return;
  for (const ev of events) {
    if (ev.type === 'add')    addVaultEntry(session, ev, { animate: !initial });
    if (ev.type === 'change') updateVaultEntry(session, ev, { pulse: !initial });
    if (ev.type === 'unlink') removeVaultEntry(session, ev);
  }
});
```

(The `preload.js` change: add `onVaultEvents: (cb) => ipcRenderer.on('vault:events', (_e, p) => cb(p))` to the `contextBridge.exposeInMainWorld('ezvibes', { ... })` map.)

#### 1.2.6 Windows-specific chokidar gotchas

* **`fs.watch` recursive on Windows uses `ReadDirectoryChangesW` with the `WATCH_FILE_NOTIFY_ALL` flag.** For folders > 16 KB of pending changes you get **`ERROR_TOO_MANY_CMDS`** which Node surfaces as an `error` event. With your single-vault flat folder this is impossible to hit in practice (would need thousands of files churning).
* **Renames cross filesystems = delete + create.** A user dragging from one drive letter to the vault will fire `add`, not a "moved" event. Chokidar does not synthesize move events.
* **OneDrive / Dropbox sync folders.** If the vault path lives inside a synced folder, OneDrive's placeholder system will fire phantom `change` events when files are reverted to cloud-only. Document this as "use a local-only path."
* **Windows path case.** `C:\Users\Oskari\Documents\vault` and `c:\users\oskari\documents\vault` should be normalized via `path.normalize` + `.toLowerCase()` for the map key.
* **No notifications across mount points.** Don't put the vault on a network drive (`\\server\share`) — `ReadDirectoryChangesW` semantics differ over SMB.

#### 1.2.7 The Hendrik Erz horror story (a cautionary tale for Electron + chokidar)

The Zettlr maintainer documented a four-year saga of "Electron + chokidar + fsevents" CPU thrashing. Summary (paraphrased from his blog post linked in §References): chokidar's `fsevents` optional dep failed to load *silently* in the packaged macOS app because `fsevents.node` wasn't ASAR-unpacked. It then fell back to recursive polling, which hammered the CPU. **The lesson for your Windows build**: when you go to package EZvibes with `electron-builder`, add:

```json
{
  "asar": true,
  "asarUnpack": ["**/*.{node,dll}"]
}
```

For chokidar on Windows specifically you don't have `.node` binaries to unpack (no fsevents), but the *minute* you switch to `@parcel/watcher` you'll have prebuilt `.node` files per arch and you must unpack them or the app will silently fall back to slow paths.

### 1.3 `@parcel/watcher` (the fast option)

Used by Tailwind, Nx, Nuxt, **VSCode**. Native C++ Node module — separate binding per platform (`@parcel/watcher-win32-x64`, `@parcel/watcher-win32-arm64`, `@parcel/watcher-darwin-x64`, `@parcel/watcher-darwin-arm64`, `@parcel/watcher-linux-x64-glibc`, etc.). On Windows it uses **`ReadDirectoryChangesW`** directly with a smarter queue than `fs.watch` provides.

#### 1.3.1 API

```js
const watcher = require('@parcel/watcher');

const subscription = await watcher.subscribe(
  vaultPath,
  (err, events) => {
    if (err) { /* … */ return; }
    // events is an array of { type, path } where type ∈ 'create'|'update'|'delete'
    for (const ev of events) handleEvent(ev);
  },
  {
    ignore: [
      '**/.git/**',
      '**/.*.swp',
      '**/*.tmp',
      '**/node_modules/**',
    ],
    backend: 'windows', // or 'auto' — 'windows' = ReadDirectoryChangesW
  }
);

// later
await subscription.unsubscribe();
```

Notice: **events arrive already batched and coalesced**. The library promises "only one notification per file" — multiple changes to the same file in the same coalesce window arrive as a single `update`, and a `create` immediately followed by `delete` is suppressed entirely. This is what makes it feel snappy under `git checkout`.

Also: **`writeSnapshot` + `getEventsSince`** lets you persist filesystem state and query "what changed while we were closed" — relevant if the user expects "I opened EZvibes yesterday, agent X dropped 3 files overnight, show me what's new on launch."

```js
// On exit:
await watcher.writeSnapshot(vaultPath, snapshotFile);

// On next launch:
const since = await watcher.getEventsSince(vaultPath, snapshotFile);
// since is the same event array as subscribe() would have emitted
```

This is the killer feature for a hand-off vault. Use it.

#### 1.3.2 Install dance on Electron / Windows

```powershell
npm install @parcel/watcher
npx electron-rebuild -f -w @parcel/watcher
```

Or in `scripts/postinstall.js`, after the `node-pty` rebuild:

```js
spawnSync('npx', ['electron-rebuild', '-f', '-w', '@parcel/watcher'], { stdio: 'inherit' });
```

You'll need `node-gyp` ready, Python 3, Visual Studio Build Tools — the same chain `node-pty` already requires.

If you'd rather skip the rebuild gauntlet, there are **prebuild proxies**:

* `@hackolade/watcher` — re-exports `@parcel/watcher` with `optionalDependencies` for every prebuild platform, so npm pulls the right `.node` automatically.
* `@electron-prebuilds-preview/parcel-watcher` — same idea, Electron-specific prebuilds.

In packaging:

```json
{
  "asarUnpack": ["**/node_modules/@parcel/watcher-*/**", "**/*.node"]
}
```

(otherwise chokidar's exact horror story repeats with `@parcel/watcher.node` silently failing in the asar).

#### 1.3.3 Trade-off table

| Property | `chokidar@4` | `@parcel/watcher` |
|---|---|---|
| Native binary | No (pure JS over `fs.watch`) | Yes (per-platform prebuilds) |
| Electron rebuild required | **No** | **Yes** (unless using prebuild proxy) |
| Event coalescing | Optional via `awaitWriteFinish` | Automatic, always-on |
| `git checkout` storm survival | Decent with `awaitWriteFinish`, can still buffer-overflow | Excellent — designed for it |
| Historical "what changed while I was gone" | None | `getEventsSince` 🥇 |
| Glob ignore via `picomatch` | Yes | Yes |
| Bundle size | ~30 KB | Native binary, ~1 MB total prebuilds |
| ESM only? | v5 yes, v4 no | CJS still |

**Recommendation for the vault MVP:** stay on `chokidar@4`, design for swap. The "what changed while away" feature in `@parcel/watcher` is a v2 prize worth coming back for.

### 1.4 Other watchers worth knowing

* **`node-watch`** — Pure JS wrapper around `fs.watch`. No `awaitWriteFinish`, no atomic. Don't use for production vault.
* **`gaze`** — Old, abandoned-ish, polling-heavy.
* **`watchpack`** — Webpack's internal watcher. Wraps chokidar + `fs.watch`. Not meant for end-user code.
* **`filespy`** — A 2023ish "modern" wrapper around chokidar with stricter typings. Niche.
* **`turbowatch`** — Watchman-backed, Linux/macOS focused, basically a no-go on Windows without Watchman daemon.
* **`@hackolade/watcher`** — Just `@parcel/watcher` with the prebuild matrix flattened. Use if you want `@parcel/watcher` minus the rebuild step.

### 1.5 The native Windows API gotcha tier list

Things every watcher author re-learns:

1. **Buffer size matters.** `ReadDirectoryChangesW` takes a buffer; if too small under churn, you get `STATUS_NOTIFY_ENUM_DIR` which means "the kernel gave up tracking individual events — you need to enumerate the directory yourself." Both chokidar and `@parcel/watcher` use 64 KB buffers, which is usually plenty.
2. **Antivirus.** Windows Defender and CrowdStrike Falcon both intercept opens; in worst cases they fire phantom `change` events as they re-write the file's attributes after scanning. Solution: `awaitWriteFinish` smooths this over.
3. **Atomic save patterns differ.** VSCode on Windows: write to `name.ext.tmp`, then `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`. You'll see `unlink` (the original briefly disappears) → `add` (the new arrives). chokidar's `atomic: 100` collapses this into a `change`.
4. **`fs.watch` will sometimes fire `change` twice for one save** on certain Windows file systems (ReFS, network shares, OneDrive). chokidar's `awaitWriteFinish` flattens this.
5. **Path length limits.** Windows MAX_PATH is 260 unless long paths are enabled. Vault path nested too deep + long filename → `ENOENT` on the stat call inside chokidar. Encourage shallow vault placement (e.g. `%USERPROFILE%\.EZvibes\vault`).

---

## 2. Animation toolbox — what the modern web actually uses in 2025

### 2.1 The FLIP technique (foundational, vanilla-JS-friendly)

**F**irst, **L**ast, **I**nvert, **P**lay. Coined by Paul Lewis; popularized by Josh W. Comeau. The single most important technique for "items reordering / arriving in a list" because:

* CSS transitions can't animate the DOM's *layout reflow* — a new `<li>` inserted shoves everything down instantly, no transition.
* FLIP measures positions **before** the DOM change (`First`), lets the DOM change, measures positions **after** (`Last`), then applies an `Invert` transform that visually puts every element back where it was, and finally **`Play`**s a transform-back-to-identity, which the GPU can animate at 60 fps for free.

#### 2.1.1 Vanilla JS FLIP for a vault list

```js
function animateVaultListChange(listEl, mutator) {
  // First: snapshot positions of all current children
  const firstRects = new Map();
  for (const child of listEl.children) {
    firstRects.set(child.dataset.id, child.getBoundingClientRect());
  }

  // Mutate (insert/remove/reorder) — happens synchronously
  mutator();

  // Last: measure new positions
  for (const child of listEl.children) {
    const id = child.dataset.id;
    const newRect = child.getBoundingClientRect();
    const oldRect = firstRects.get(id);
    if (!oldRect) {
      // brand-new node — see §2.4 sparkle entrance
      child.classList.add('vault-arrived');
      child.style.setProperty('--arrived-at', Date.now());
      continue;
    }
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (dx || dy) {
      // Invert: cancel the layout shift visually
      child.style.transform = `translate(${dx}px, ${dy}px)`;
      child.style.transition = 'transform 0s';
      // Play: next frame, animate to identity
      requestAnimationFrame(() => {
        child.style.transform = '';
        child.style.transition = 'transform 350ms cubic-bezier(.2,.7,.2,1)';
      });
    }
  }
}
```

This is ~30 lines and is what auto-animate, react-flip-toolkit, and Framer Motion's `layout` prop all do under the hood.

### 2.2 `@formkit/auto-animate` — FLIP in one line

```powershell
npm install @formkit/auto-animate
```

```js
import autoAnimate from '@formkit/auto-animate';
const vaultList = document.querySelector('.vault-list');
autoAnimate(vaultList, { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
```

That's it. Whenever a child is added, removed, or moved, it FLIPs automatically. **Respects `prefers-reduced-motion`** automatically. **13.8k GitHub stars, ~91 KB unpacked**, MIT, zero peer deps. The closest thing to a "drop in, look pioneer" for vanilla JS.

For custom keyframes (e.g. you want new vault items to *swoop in from the right* rather than the default):

```js
autoAnimate(vaultList, (el, action, oldCoords, newCoords) => {
  let keyframes;
  if (action === 'add') {
    keyframes = [
      { transform: 'translateX(40px) scale(0.92)', opacity: 0, filter: 'brightness(2)' },
      { transform: 'translateX(0) scale(1)',      opacity: 1, filter: 'brightness(1)' },
    ];
  } else if (action === 'remove') {
    keyframes = [
      { transform: 'translateX(0) scale(1)',      opacity: 1 },
      { transform: 'translateX(-30px) scale(0.9)', opacity: 0 },
    ];
  } else if (action === 'remain') {
    const dx = oldCoords.left - newCoords.left;
    const dy = oldCoords.top  - newCoords.top;
    keyframes = [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: 'translate(0,0)' },
    ];
  }
  return new KeyframeEffect(el, keyframes, { duration: 280, easing: 'ease-out' });
});
```

Caveats: only animates *immediate children* of the supplied parent; if your DOM has wrappers, attach autoAnimate to the wrapper that actually contains the items.

### 2.3 `motion` (formerly Framer Motion, vanilla-friendly since 2024)

```powershell
npm install motion
```

```js
import { animate, stagger } from 'motion';

// New arrivals stagger in:
animate(
  '.vault-item.is-new',
  { opacity: [0, 1], y: [12, 0], scale: [0.95, 1] },
  { duration: 0.34, ease: [0.2, 0.7, 0.2, 1], delay: stagger(0.06) }
);
```

`motion` is ~2.3 KB minified for the basic `animate` function. Use it when you want spring physics or scroll-linked animations. For the vault's "new files arriving" pulse, plain CSS keyframes + auto-animate is enough; reserve `motion` for the panel slide-out and the paste-to-terminal "ink fly" effect.

### 2.4 `@starting-style` — the no-JS modern way

Chrome 116+, Edge 116+, Safari 17.4+, Firefox 129+. **Electron 33 uses Chromium 130, so this works.**

```css
.vault-item {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition: opacity 280ms ease-out, transform 280ms cubic-bezier(.2,.7,.2,1);
}
@starting-style {
  .vault-item {
    opacity: 0;
    transform: translateY(12px) scale(0.95);
  }
}
```

When a new `.vault-item` is inserted, the browser auto-transitions from the `@starting-style` block to the normal state. **Zero JS.** This pairs with FLIP/auto-animate — `@starting-style` handles the enter visual; FLIP handles the surrounding items sliding down. Combined, it's the modern recipe.

**Gotcha (Josh Comeau's "big gotcha")**: `@starting-style` only triggers on the *first* style update after element creation, so you cannot use it for "an item already in the list pulses because its content changed." For that → use a one-shot keyframe (§2.6) keyed by a changing data-attribute.

### 2.5 View Transitions API — the nuclear option

```js
function addVaultEntry(session, ev, { animate }) {
  const apply = () => {
    const li = document.createElement('li');
    li.className = 'vault-item';
    li.style.viewTransitionName = `vault-${ev.relPath.replace(/\W/g, '-')}`;
    // ... fill in name, icon, mtime
    session.vaultListEl.appendChild(li);
  };
  if (animate && document.startViewTransition) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}
```

The browser snapshots the old layout, runs `apply`, snapshots the new layout, and **automatically cross-fades + transforms** every element whose `view-transition-name` survived. Works for "items reorder" *and* "items appear/disappear" out of the box.

* Same-document (SPA) view transitions: **Baseline Newly Available October 2025** — Chrome 111+, Edge 111+, Firefox 133+, Safari 18+. Electron's Chromium will support it.
* `view-transition-class` (Chromium 125+, Safari 18.4+): apply one set of `@keyframes` to a whole class of items instead of naming each one. Crucial for a 100-file vault.

Recipe:

```css
.vault-item { view-transition-class: vault-item; }

::view-transition-old(.vault-item) {
  animation: vault-leave 220ms ease-in forwards;
}
::view-transition-new(.vault-item) {
  animation: vault-enter 320ms cubic-bezier(.2,.7,.2,1) forwards;
}

@keyframes vault-enter {
  from { opacity: 0; transform: translateY(14px) scale(0.94); filter: brightness(1.7); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    filter: brightness(1); }
}
@keyframes vault-leave {
  from { opacity: 1; transform: translateX(0)   scale(1);    }
  to   { opacity: 0; transform: translateX(-24px) scale(0.92); }
}
```

You wrap any DOM mutation in `document.startViewTransition(() => mutate())` and the browser handles the rest. **This is the most "pioneer-level" idiom shipping in 2025-2026.**

### 2.6 Sparkle / shimmer / glow — the "this just arrived from another agent" beat

A one-shot keyframe applied for ~2 seconds when an item is newly added:

```css
.vault-item.vault-arrived {
  animation: vault-sparkle 1800ms ease-out;
  animation-fill-mode: forwards;
}

@keyframes vault-sparkle {
  0%   {
    background: linear-gradient(90deg, transparent 0%, rgba(255,200,80,0.35) 50%, transparent 100%);
    background-size: 200% 100%;
    background-position: 200% 0;
    box-shadow:
      0 0 0  0   rgba(255,200,80,0.55),
      0 0 24px 4 rgba(255,200,80,0.0);
  }
  20%  {
    background-position: 80% 0;
    box-shadow:
      0 0 0  0   rgba(255,200,80,0.0),
      0 0 28px 6px rgba(255,200,80,0.55);
  }
  100% {
    background-position: -200% 0;
    box-shadow: none;
  }
}
```

This produces:

1. A horizontal **shimmer band** sliding across the row (the "highlighter" gleam).
2. A **glow burst** that swells then fades (the "ping").
3. Leaves the row looking normal after 1.8 s.

Pair with `@starting-style` for the appearance translateY and you get: **slide-up from below → shimmer sweeps across → glow burst → settle.** That's the "pioneer" beat the user wants.

### 2.7 Sparkle SVG particles (the extra-extra option)

Lottie / iconscout sparkle JSONs can be dropped into the row with `lottie-web`:

```powershell
npm install lottie-web
```

```js
import lottie from 'lottie-web';
// 60 KB minified-gzipped, no native deps
lottie.loadAnimation({
  container: row.querySelector('.sparkle-slot'),
  renderer: 'svg',
  loop: false,
  autoplay: true,
  path: '/anim/sparkle.json',
});
```

Use only on the **first** arrival burst — running Lottie repeatedly burns CPU. For a single moment of delight, it's fine. The free sparkle JSONs from LottieFiles (search "sparkle ✨") render at ~5% CPU on a midrange laptop for 1 second.

### 2.8 Pulse dot — the "you missed something" indicator

When the panel is closed and a file arrives, the panel-open button should pulse:

```css
.vault-toggle-btn[data-unread="true"]::after {
  content: '';
  position: absolute;
  inset: 4px 4px auto auto;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #FFC850;
  box-shadow: 0 0 0 0 rgba(255,200,80,0.7);
  animation: dot-pulse 1.6s infinite cubic-bezier(.4,0,.6,1);
}

@keyframes dot-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(255,200,80,0.7); }
  70%  { box-shadow: 0 0 0 10px rgba(255,200,80,0.0); }
  100% { box-shadow: 0 0 0 0   rgba(255,200,80,0.0); }
}
```

This is the Slack / Discord notification ring. Set `data-unread="true"` whenever an `add` event arrives while the vault panel is hidden; clear it on open.

### 2.9 Staggered entrance — file storm

When 12 files arrive in one chokidar batch:

```css
.vault-item {
  --i: 0; /* set per item from JS */
  animation: vault-enter 280ms cubic-bezier(.2,.7,.2,1) backwards;
  animation-delay: calc(var(--i) * 40ms);
}
```

```js
batchOfNewItems.forEach((li, i) => li.style.setProperty('--i', i));
```

40 ms between items × 12 items = ~480 ms total — comfortably under the 800 ms ceiling humans tolerate before "this is slow." Pioneer move: **cap stagger at the first 10 items** and have 11+ all share `--i: 10` so a giant arrival doesn't drag.

### 2.10 The "ink fly" — clicked file flying into the terminal

When the user clicks a `.md` file to paste, animate a phantom copy of the row arcing into the terminal pocket:

```js
function flyToTerminal(rowEl, terminalHostEl) {
  const from = rowEl.getBoundingClientRect();
  const to   = terminalHostEl.getBoundingClientRect();
  const ghost = rowEl.cloneNode(true);
  ghost.style.position = 'fixed';
  ghost.style.left = `${from.left}px`;
  ghost.style.top  = `${from.top}px`;
  ghost.style.width = `${from.width}px`;
  ghost.style.zIndex = 9999;
  ghost.style.pointerEvents = 'none';
  ghost.style.transformOrigin = 'top left';
  document.body.appendChild(ghost);
  ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)',                opacity: 1 },
      { transform: `translate(${to.left - from.left + to.width/2}px, ${to.top - from.top + 40}px) scale(0.4)`,
        opacity: 0, filter: 'blur(4px)' },
    ],
    { duration: 480, easing: 'cubic-bezier(.7,.0,.5,1)', fill: 'forwards' }
  ).onfinish = () => ghost.remove();
}
```

Drop a single ASCII bullet flash on the terminal at the impact point (cursor shake-and-glow on the active xterm via a CSS class on `.terminal-host`) and you have a *cinematic* paste.

### 2.11 What modern real apps actually use (named names)

* **Linear inbox** — uses native View Transitions for read/unread state changes; new items slide in from the top with translateY + opacity. Linear's "Pulse" personalized feed (launched April 2025) batches arrivals and uses staggered fade-up.
* **Notion sidebar** — uses CSS `transition: transform 200ms` + key-based DOM keys; new pages slide-in from below.
* **VSCode file explorer** — chokidar-backed; reveals new files with a single-frame highlight (subtle blue flash on the row background). No animation library, plain CSS class toggle.
* **Obsidian** — file explorer uses no animation by default; community plugins add scale + fade. The "Notebook Navigator" plugin (2025) adds slide-in from below.
* **Discord** — pulse dot + glow on the channel icon when unread; the channel name itself stays static. New messages within a channel use a 200 ms fade-in with `translateY(8px)`.
* **Slack** — `linear-gradient` shimmer on the channel name (it briefly highlights, then fades); 2025 UI refresh dialed down badge brightness.
* **Telegram** — message effects: 6 free, hundreds with Premium; voice/text/sticker "fly into chat from keyboard" (cubic-bezier easing with a slight overshoot).
* **Cursor** — file watcher highlights new untracked files in the explorer with a 600 ms green tint fade.

---

## 3. The integrated recipe — pioneer-level "Prompt Vault" panel

Putting it all together for EZvibes's specific stack (Electron 33, vanilla JS, node-pty, no React/bundler):

### 3.1 IPC channels (add to existing list)

```
vault:start       (renderer → main)   { sessionId, vaultPath }
vault:stop        (renderer → main)   { sessionId }
vault:read        (renderer → main)   { path } → { content }
vault:events      (main → renderer)   { sessionId, initial, events: [{type,path,...}] }
vault:error       (main → renderer)   { sessionId, message }
```

### 3.2 Renderer panel HTML skeleton

```html
<aside class="vault-panel" data-state="closed" aria-label="Prompt vault">
  <header class="vault-header">
    <h3>Prompts</h3>
    <button class="vault-refresh" title="Re-scan vault">↻</button>
    <button class="vault-close" title="Close">×</button>
  </header>
  <ul class="vault-list" role="listbox"></ul>
</aside>
```

### 3.3 Item template (built in JS)

```js
function buildVaultRow(ev) {
  const li = document.createElement('li');
  li.className = 'vault-item';
  li.dataset.id = ev.relPath;
  li.dataset.path = ev.path;
  li.dataset.ext = ev.ext;
  li.dataset.arrivedAt = String(Date.now());
  li.style.setProperty('--i', '0'); // set by stagger pass

  li.innerHTML = `
    <span class="vault-icon" aria-hidden="true">${iconForExt(ev.ext)}</span>
    <span class="vault-name">${escapeHtml(ev.name)}</span>
    <time class="vault-mtime" datetime="${new Date(ev.mtimeMs).toISOString()}">
      ${relativeTime(ev.mtimeMs)}
    </time>
    <button class="vault-paste" title="Paste into active terminal">⏎</button>
  `;
  return li;
}
```

### 3.4 Click → paste into active terminal

The EZvibes renderer already has the active tab id via `state.windowsByPath` + `activeTabId`. To paste content into that PTY, fetch the file content and send it as an IPC `terminal:input`:

```js
async function pasteVaultItem(li) {
  const path = li.dataset.path;
  const session = currentSession();
  const tab = session.tabs.find(t => t.id === session.activeTabId);
  if (!tab) return;

  const { content } = await window.ezvibes.readVaultFile(path);
  // Strip optional front-matter and shell-quote risky chars:
  const body = content.replace(/^---[\s\S]*?---\s*/m, '');
  window.ezvibes.writeTerminal(tab.id, body);

  flyToTerminal(li, tab.terminalHostEl); // §2.10
  flashTerminal(tab.terminalHostEl);     // brief ::after glow on the terminal-pocket
}
```

(Don't forget: `claude --dangerously-skip-permissions` expects raw stdin; the only thing to watch is that pasting a multi-line .md file with leading `#` is fine for the chat, but if the prompt contains backticks or `$` and the terminal is at a shell prompt, you'll evaluate it. The user's vault is for AI-prompt content so this is acceptable; document the caveat.)

### 3.5 Composed visual choreography for a `vault:events` arrival

1. **Main process flush** — chokidar fires; `awaitWriteFinish` ensures the file is fully written; main batches for 60 ms; sends one `vault:events` IPC with N items.
2. **Renderer receives** — if panel is open: insert all rows in one tick (with assigned `--i` stagger).
3. **Surrounding rows FLIP** via auto-animate; new rows hit `@starting-style` to slide up; one-shot `.vault-arrived` class triggers the shimmer + glow.
4. **Panel-toggle button pulses** if panel is closed (`data-unread="true"`).
5. **After 1.8 s** the `.vault-arrived` class is removed (via `animationend` listener) so the row settles to neutral.

```js
function addVaultEntry(session, ev, { animate }) {
  const list = session.vaultListEl;
  const apply = () => {
    const li = buildVaultRow(ev);
    if (animate) li.classList.add('vault-arrived');
    list.prepend(li); // newest first
    li.style.setProperty('--i', '0');
  };
  if (animate && document.startViewTransition) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
  if (animate && session.vaultPanelEl.dataset.state === 'closed') {
    session.vaultToggleEl.dataset.unread = 'true';
  }
}

document.addEventListener('animationend', (e) => {
  if (e.target.matches('.vault-arrived')) {
    e.target.classList.remove('vault-arrived');
  }
});
```

### 3.6 Hand-off across sessions — the real-world flow

* Session in folder A: agent finishes a task, writes `~/.EZvibes/vault/HANDOFF-2025-05-25T14-22.md` (the agent is a Claude instance running in folder A's terminal; the file path is in a shared "vault" location).
* The watcher attached to the vault path (registered when any session window is opened) emits `add`.
* Every session window subscribed sees `vault:events`. Their vault panels all light up with the same new entry.
* Session B's user double-clicks → paste into terminal of their active tab → Claude in B sees the hand-off content as prompt input.

To support **per-folder vaults** (vault scoped to the folder, not global), call `vault:start` with `{ sessionId, vaultPath: path.join(folderPath, 'prompts') }`. EZvibes's existing `state.windowsByPath` keys this naturally.

To support a **shared global vault** (cross-folder hand-off), call `vault:start` once with a global path like `path.join(app.getPath('userData'), 'shared-vault')` on app launch, and subscribe every session to it. The folder card visual treatment (matches the **orange minimize** convention) for "your vault has 3 unread" can be a small badge in the folder card grid view.

---

## 4. Debouncing, atomic writes, and the "editor swap" minefield

### 4.1 What an "atomic write" looks like

When VSCode (or any modern editor) saves `prompts/hello.md`:

1. Writes content to `prompts/.hello.md.tmp` (or `prompts/hello.md.XXXXXX` random).
2. `rename` `prompts/.hello.md.tmp` → `prompts/hello.md` (this overwrites the original atomically on Windows ≥ Vista via `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`).

What `fs.watch` sees (without chokidar):

* `rename` event on `.hello.md.tmp` (the tmp file appearing)
* `rename` event on `hello.md` (the original disappearing during rename's brief delete phase)
* `rename` event on `hello.md` (the new file appearing)

That's **three** events for one logical save. The user sees the row vanish then reappear with a sparkle — annoying. chokidar's `atomic` option collapses this by noticing a `delete` followed by `add` for the same path within N ms and emitting `change` instead.

### 4.2 The recommended settings (recap)

```js
{
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  atomic: 200,
}
```

`stabilityThreshold: 300` is the magic number — short enough to feel real-time, long enough to absorb the OneDrive / Defender re-write blip.

### 4.3 The "swap file" ignore pattern

```js
ignored: [
  /(^|[\\/])\../,           // any dotfile (`.git`, `.DS_Store`, `.swp`, `.~vscode~`)
  /\.(swp|swo|swn|tmp|partial)$/i,
  /~$/,                      // emacs/vim backup
  /[\\/]node_modules[\\/]/,
  /[\\/]\.git[\\/]/,
  /\$RECYCLE\.BIN/i,         // Windows recycle bin sometimes appears mid-folder
  /Thumbs\.db$/i,
  /desktop\.ini$/i,
]
```

### 4.4 Renderer-side debounce (belt-and-suspenders)

```js
const pending = new Map();

function queueVaultEvent(session, ev) {
  pending.set(`${session.id}:${ev.path}`, { session, ev });
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      const all = Array.from(pending.values());
      pending.clear();
      applyVaultEvents(all);
    });
  }
}
```

Microtask-level debounce flattens rapid `add` + `change` into one DOM update — useful if a single chokidar batch happens to land split across two ticks.

### 4.5 Atomic-write detection at the visual layer

Even with chokidar's `atomic`, sometimes you'll see `unlink` + `add` straddling the threshold. Detect "rapid unlink then add of the same `relPath` within 500 ms" in the renderer and treat as `change`:

```js
const recentUnlinks = new Map();

function applyVaultEvents(events) {
  for (const { session, ev } of events) {
    if (ev.type === 'unlink') {
      recentUnlinks.set(ev.path, Date.now());
      setTimeout(() => {
        if (recentUnlinks.get(ev.path) && Date.now() - recentUnlinks.get(ev.path) > 480) {
          recentUnlinks.delete(ev.path);
          performUnlink(session, ev);
        }
      }, 500);
      continue;
    }
    if (ev.type === 'add' && recentUnlinks.has(ev.path)) {
      recentUnlinks.delete(ev.path);
      performChange(session, ev);
      continue;
    }
    performAddOrChange(session, ev);
  }
}
```

---

## 5. Visual cues for unread / new — the full taxonomy

| Cue | When to use | CSS / JS |
|---|---|---|
| **Sparkle/shimmer band** | One-shot, single arrival | `@keyframes` with background-position sweep (see §2.6) |
| **Glow burst** | One-shot, single arrival | `box-shadow` keyframe |
| **Pulse dot** | Persistent until viewed | Infinite keyframe with expanding `box-shadow` |
| **NEW badge** | Persistent until viewed | Inline `<span>` with CSS shape, fade-out on hover |
| **Border accent** | Mild, ambient | `border-left: 3px solid var(--accent-warm)` |
| **Background tint** | Mild, ambient | `background: linear-gradient(to right, rgba(255,200,80,0.06), transparent 60%)` |
| **Bold text** | Like Linear inbox | `font-weight: 600` until clicked |
| **Stagger entrance** | Multiple arrivals at once | `animation-delay: calc(var(--i) * 40ms)` |
| **View transition** | Layout reflow | `document.startViewTransition()` |
| **FLIP transform** | Reorders | Manual `getBoundingClientRect` or auto-animate |

**Pioneer combination for EZvibes:** sparkle + glow on arrival → bold text + warm border-left until clicked → bold drops + border fades to neutral after first click. Mirror Linear's "read state" pattern but with EZvibes's amber palette (matches the existing orange-minimized convention).

---

## 6. Pitfalls and edge cases (the long list)

### 6.1 Editor "lock" files

Notepad++, Sublime, JetBrains products create `.~lock.hello.md#` style files when opened — your watcher will see them appear. Ignore pattern `/[\\/]\.~lock/`.

### 6.2 Cloud-sync placeholders

OneDrive and Dropbox use sparse files with reparse points to keep files "cloud-only." chokidar will see them as `add` events when the placeholder is materialized on demand. Render the vault row immediately, but lazy-load the `content` only on click — never read on `add`.

### 6.3 Initial scan storm

A vault folder with 200 existing files will fire 200 `add` events on `ready: false`. To prevent a sparkle storm at app launch:

```js
let initialBatch = true;
// renderer:
function addVaultEntry(session, ev, { animate }) {
  // animate = !initial
  // only stagger and sparkle when !initial
}
// main:
watcher.on('ready', () => { initialBatch = false; });
```

The `vault:events` IPC payload includes `initial: true` for the initial scan batch — the renderer skips animation classes.

### 6.4 Hidden terminal hosts and IntersectionObserver

The vault panel might be open in tab A but tab A might not be the active tab — its `.terminal-host` is `hidden`. Animating items in a hidden host is wasted GPU work. Use `IntersectionObserver` to pause sparkle animations on items in offscreen panels:

```js
const visibilityObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    entry.target.classList.toggle('vault-paused', !entry.isIntersecting);
  }
});
// then for each vault-list:
visibilityObserver.observe(session.vaultListEl);
```

```css
.vault-list.vault-paused .vault-item { animation-play-state: paused; }
```

### 6.5 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .vault-item,
  .vault-item.vault-arrived,
  .vault-toggle-btn[data-unread="true"]::after {
    animation: none !important;
    transition: none !important;
  }
  .vault-item.vault-arrived {
    /* still indicate, just without movement */
    outline: 2px solid var(--accent-warm);
    outline-offset: -2px;
  }
}
```

`auto-animate` already respects this; the rest is on you.

### 6.6 Memory leaks on long sessions

Each session window subscribes; on close, `vault:stop` MUST be called or chokidar's `FSWatcher` will keep firing into a destroyed `webContents`. The main-process map should hold weak refs or be cleaned up in the `terminal:close` flow. Pattern:

```js
mainWindow.on('closed', () => {
  for (const [id, watcher] of vaultWatchers) watcher.close();
  vaultWatchers.clear();
});
```

### 6.7 Path normalization

Mixed `C:\` and `c:\` paths break the `Map` lookup. Always `path.normalize` + lowercase the drive letter:

```js
function normalizeKey(p) {
  const n = path.normalize(p);
  return n.replace(/^([A-Za-z]):/, (_m, l) => l.toLowerCase() + ':');
}
```

### 6.8 Large file content

If a hand-off `.md` is, say, 12 MB (someone pasted a Git log), the read-on-click should stream not slurp. For < 256 KB, `fs.readFile` synchronously is fine. For > 256 KB, prompt the user before pasting (do you really want to dump 12 MB into Claude?). Or chunk with `terminal:input` calls of 4 KB at a time with `await new Promise(r => setTimeout(r, 4))` between, to give xterm time to render.

### 6.9 Renaming files via the vault

If you add an inline-rename UI to the vault row, the watcher will see `unlink` + `add` (Windows rename = atomic move). With `atomic: 200` chokidar emits `change`. **But the `relPath` changes** — your map keyed by old path needs to follow the rename. Solution: in the renderer, track renames optimistically (update the DOM immediately before the IPC round-trip).

### 6.10 Cross-drive moves

Dragging a file from `D:\` to `C:\Users\Oskari\Documents\vault` is a copy, then delete. The watcher sees `add`. Treat as new arrival, sparkle and all.

### 6.11 Antivirus scan delay

Windows Defender briefly opens new files for inspection — chokidar might fire `change` ~250ms after the `add`. Filter: drop `change` events that arrive within 500 ms of an `add` for the same path.

```js
const recentAdds = new Map();
watcher.on('add', (p) => { recentAdds.set(p, Date.now()); push('add', p); });
watcher.on('change', (p, s) => {
  if (recentAdds.has(p) && Date.now() - recentAdds.get(p) < 500) return;
  push('change', p, s);
});
```

### 6.12 Symlinks pointing outside the vault

If `vault/shared.md` is a symlink to `D:\shared\global.md`, chokidar with `followSymlinks: true` watches the target too. Could be surprising; default to `followSymlinks: false` for vaults.

### 6.13 Long-running app and watcher exhaustion

`ReadDirectoryChangesW` allocates kernel-side resources per watch. With one vault folder this is irrelevant. With many folders or recursive watching of a deep tree (thousands of subdirectories), Windows will eventually return `ERROR_NO_SYSTEM_RESOURCES`. Document: "Vaults are flat-ish; don't point them at `C:\`."

---

## 7. The IPC + preload glue (concrete EZvibes-shaped code)

### 7.1 `preload.js` additions

```js
contextBridge.exposeInMainWorld('ezvibes', {
  // ... existing methods ...
  startVaultWatcher: (sessionId, vaultPath) =>
    ipcRenderer.invoke('vault:start', { sessionId, vaultPath }),
  stopVaultWatcher: (sessionId) =>
    ipcRenderer.invoke('vault:stop', { sessionId }),
  readVaultFile: (path) =>
    ipcRenderer.invoke('vault:read', { path }),
  onVaultEvents: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('vault:events', handler);
    return () => ipcRenderer.removeListener('vault:events', handler);
  },
  onVaultError: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('vault:error', handler);
    return () => ipcRenderer.removeListener('vault:error', handler);
  },
});
```

### 7.2 `main.js` additions

Already sketched in §1.2.4. Add the read handler:

```js
const fs = require('node:fs/promises');
ipcMain.handle('vault:read', async (_e, { path }) => {
  const stat = await fs.stat(path);
  if (stat.size > 1024 * 1024) {
    return { error: 'file_too_large', size: stat.size };
  }
  const content = await fs.readFile(path, 'utf8');
  return { content };
});
```

### 7.3 `renderer/app.js` integration sketch

```js
// when opening a session window:
const VAULT_PATH_FOR_SESSION = path.join(
  /* userData via IPC */, 'shared-vault'
);
window.ezvibes.startVaultWatcher(session.id, VAULT_PATH_FOR_SESSION);

window.ezvibes.onVaultEvents(({ sessionId, initial, events }) => {
  const session = findSessionById(sessionId);
  if (!session) return;
  for (const ev of events) {
    if (ev.type === 'add')    addVaultEntry(session, ev, { animate: !initial });
    if (ev.type === 'change') updateVaultEntry(session, ev, { pulse: !initial });
    if (ev.type === 'unlink') removeVaultEntry(session, ev);
  }
});
```

### 7.4 Closing the watcher when the session window closes

```js
function closeSession(session) {
  window.ezvibes.stopVaultWatcher(session.id);
  // existing tab teardown
}
```

---

## 8. The "pioneer-level" north-star UX

Combining the above into the single most ambitious version:

1. **The vault panel materializes** when the user drags a special "Vault" chip from the tab strip — it slides out from the right edge with a glass blur (`backdrop-filter: blur(14px) saturate(140%)`, RGBA dark panel — EZvibes-flavored amber accent).
2. **New arrivals**: `document.startViewTransition()` wraps the insert; new row enters with `@starting-style` translateY + scale, runs the **shimmer + glow** keyframe, the surrounding rows FLIP downward via `auto-animate`. Lottie sparkles burst from the right edge of the row for 600 ms then despawn.
3. **Unread indicator on closed panel**: amber dot pulses on the vault toggle button. Tab title gets a small `[•]` prefix.
4. **Click → fly to terminal**: row clones into a ghost, arcs across the panel into the terminal pocket using a Bezier curve, scales down to a single character glyph at the cursor location, the terminal pocket fires its own glow burst, the PTY receives the prompt text. Tab chip briefly brightens to "tab just got fed."
5. **Right-click on a vault row**: contextual menu — `Paste to active tab`, `Paste to all tabs in this window`, `Send to specific tab → (submenu)`, `Open in editor`, `Reveal in folder`, `Pin to top`. The pin uses a CSS-only `:has` selector to float the row above the rest.
6. **Per-tab "drop target"**: drop a file directly onto a tab chip → that tab gets it pasted. The drag indicator: amber rim + drag ghost preview.
7. **Hand-off mode**: a CLAUDE.md or AGENTS.md file gets a different icon and an "auto-paste on session start" toggle, so when you launch a new tab, that .md is sent first. Configurable per-tab.
8. **Vault search**: type-ahead with `.vault-list[data-filter]` + a CSS `:not(:matches(...))` style. Matches highlight with `<mark>`.
9. **Vault sort**: by name / mtime / recently arrived. Switching modes uses View Transitions for a full grid reflow animation.
10. **Cross-session conversation**: if agent A drops `to-claude-in-folder-B.md`, the file name encodes the routing. EZvibes recognises the convention and auto-pastes into folder B's active tab (the user can toggle this opt-in). The recipient row glows a different color (cyan instead of amber) to show "this was directed at you."

---

## 9. Library list with versions (May 2026 lock)

| Lib | Version | Why | Native build? |
|---|---|---|---|
| `chokidar` | `^4.0.3` | File watcher | No |
| `@parcel/watcher` | `^2.5.x` | Future fast watcher | Yes (rebuild) |
| `@formkit/auto-animate` | `^0.9.x` | One-line FLIP | No |
| `motion` | `^11.x` (or `^12.x` if available) | Vanilla `animate()` for the panel slide and ink-fly | No |
| `lottie-web` | `^5.x` | Optional sparkle SVG burst | No |
| `picomatch` | `^4.x` | If you go to `@parcel/watcher`, you'll want its glob helper | No |

Total bundle impact (renderer side): `auto-animate` ~91 KB raw → ~7 KB minified+gzipped, `motion` ~12 KB, `lottie-web` ~62 KB minified+gzipped. Without bundler (your stack), use ESM CDN imports in the renderer's `index.html`:

```html
<script type="module">
  import autoAnimate from 'https://cdn.jsdelivr.net/npm/@formkit/auto-animate@0.9.0/+esm';
  import { animate, stagger } from 'https://cdn.jsdelivr.net/npm/motion@latest/+esm';
  window.autoAnimate = autoAnimate;
  window.motion = { animate, stagger };
</script>
```

Or vendor them locally as `renderer/vendor/auto-animate.js` since EZvibes is offline-first.

---

## 10. Final concrete file plan (what to add to EZvibes)

| File | Action |
|---|---|
| `main.js` | + `chokidar` require, vault IPC handlers, `vaultWatchers` Map, debounced flush |
| `preload.js` | + `startVaultWatcher`, `stopVaultWatcher`, `readVaultFile`, `onVaultEvents`, `onVaultError` |
| `renderer/index.html` | + `<aside class="vault-panel">` markup, + vault toggle button on tab strip |
| `renderer/app.js` | + `addVaultEntry`, `updateVaultEntry`, `removeVaultEntry`, `pasteVaultItem`, `flyToTerminal`, `flashTerminal`, IntersectionObserver pause |
| `renderer/styles.css` | + `.vault-panel`, `.vault-list`, `.vault-item`, `.vault-arrived`, `@starting-style`, sparkle keyframes, glassmorphic backdrop, pulse dot keyframes, `prefers-reduced-motion` block |
| `package.json` | + `chokidar` (and optional `@formkit/auto-animate`, `motion`) |
| `CLAUDE.md` | + IPC channel list, + vault path constant, + caution about prefers-reduced-motion + atomic writes |

---

## References (full URL list)

* [Chokidar GitHub (Paul Millr)](https://github.com/paulmillr/chokidar) — the watcher repo, v5 release notes.
* [@parcel/watcher GitHub](https://github.com/parcel-bundler/watcher) — native C++ watcher used by Tailwind/VSCode.
* [chokidar awaitWriteFinish & ignoreInitial issue #594](https://github.com/paulmillr/chokidar/issues/594) — known limitation.
* [@formkit/auto-animate](https://auto-animate.formkit.com/) — official docs.
* [@formkit/auto-animate on GitHub](https://github.com/formkit/auto-animate) — source + plugin API.
* [Motion (formerly Framer Motion) quick start](https://motion.dev/docs/quick-start) — vanilla JS animate / stagger.
* [Motion docs root](https://motion.dev/docs)
* [Motion stagger docs](https://motion.dev/docs/stagger)
* [The FLIP technique — Josh W. Comeau](https://www.joshwcomeau.com/react/animating-the-unanimatable/) — definitive tutorial.
* [react-flip-move](https://github.com/joshwcomeau/react-flip-move) — historic React FLIP lib.
* [The Big Gotcha With @starting-style — Josh W. Comeau](https://www.joshwcomeau.com/css/starting-style/) — common pitfalls.
* [@starting-style on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style)
* [View Transition API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
* [Smooth transitions with the View Transition API — Chrome Devs](https://developer.chrome.com/docs/web-platform/view-transitions)
* [View Transitions API browser support — CanIUse](https://caniuse.com/view-transitions)
* [BuildUI Animated List recipe](https://buildui.com/recipes/animated-list) — Framer Motion AnimatePresence pattern.
* [Linear changelog: Pulse personalized feed (April 2025)](https://linear.app/changelog/2025-04-16-pulse)
* [Linear Inbox docs](https://linear.app/docs/inbox)
* [Linear UI Refresh changelog 2026-03-12](https://linear.app/changelog/2026-03-12-ui-refresh)
* [CSS-Tricks: A handy little system for animated entrances in CSS](https://css-tricks.com/a-handy-little-system-for-animated-entrances-in-css/)
* [CSS-Tricks: Different approaches for staggered animation](https://css-tricks.com/different-approaches-for-creating-a-staggered-animation/)
* [GSAP Staggers](https://gsap.com/resources/getting-started/Staggers/)
* [Smashing Magazine: Keyframes Tokens (Nov 2025)](https://www.smashingmagazine.com/2025/11/keyframes-tokens-standardizing-animation-across-projects/)
* [Smashing: Transitioning Top-Layer Entries (Jan 2025)](https://www.smashingmagazine.com/2025/01/transitioning-top-layer-entries-display-property-css/)
* [web.dev: prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)
* [Hendrik Erz: Electron, chokidar, and native Node modules — horror story](https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell) — the cautionary tale on ASAR unpacking.
* [Electron docs: Using Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
* [@electron/rebuild on npm](https://www.npmjs.com/package/@electron/rebuild)
* [debounce-watch on npm](https://www.npmjs.com/package/@bscotch/debounce-watch) — chokidar batching.
* [@parcel/watcher releases](https://github.com/parcel-bundler/watcher/releases)
* [@parcel/watcher Electron prebuild issue #181](https://github.com/parcel-bundler/watcher/issues/181) — Windows ia32 prebuild trap.
* [el3um4s/ipc-for-electron-chokidar](https://github.com/el3um4s/ipc-for-electron-chokidar) — example IPC wrapper.
* [mdtail terminal markdown viewer](https://mdtail.dev/) — proves the "watch a folder of .md files and react to changes" pattern.
* [Marky markdown viewer](https://github.com/GRVYDEV/marky) — "open a folder, files reload live as they change on disk from Claude" — basically a sibling to your idea.
* [Telegram message effects](https://core.telegram.org/api/effects) — inspiration for celebratory single-arrival animations.
* [MindStudio: Agent Handoff Pattern](https://www.mindstudio.ai/blog/what-is-agent-handoff-pattern) — the conceptual framing.
* [Visual Studio Magazine: In Agentic AI, It's All About the Markdown (Feb 2026)](https://visualstudiomagazine.com/articles/2026/02/24/in-agentic-ai-its-all-about-the-markdown.aspx) — case for using .md as inter-agent currency.

---

*End of description #9.*
