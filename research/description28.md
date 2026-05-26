# Custom Electron Title Bars & Window Chrome (2025-2026)

> Research agent #28 / 30 — Pioneer-level title bar and window-chrome inspiration for the EZvibes "session window" + "prompt vault" UI.
>
> Goal: equip EZvibes with the most up-to-date `BrowserWindow` configuration, OS-native materials (Mica / Acrylic / Liquid Glass), drag-region patterns and reference apps so the per-folder session window can host a beautiful "vault" panel without looking like a generic Electron app.

---

## Table of Contents

1. [Why this matters for EZvibes](#1-why-this-matters-for-EZvibes)
2. [Foundation: the modern frameless setup](#2-foundation-the-modern-frameless-setup)
3. [`titleBarStyle` — the four useful values](#3-titlebarstyle--the-four-useful-values)
4. [`titleBarOverlay` — native caption buttons you control](#4-titlebaroverlay--native-caption-buttons-you-control)
5. [Window Controls Overlay API (CSS env vars)](#5-window-controls-overlay-api-css-env-vars)
6. [`-webkit-app-region` — the drag pattern](#6--webkit-app-region--the-drag-pattern)
7. [Custom Windows caption buttons (HTML+CSS+IPC)](#7-custom-windows-caption-buttons-htmlcssipc)
8. [Windows 11 Mica / Acrylic / Tabbed](#8-windows-11-mica--acrylic--tabbed)
9. [macOS vibrancy, traffic lights, Tahoe gotchas](#9-macos-vibrancy-traffic-lights-tahoe-gotchas)
10. [Liquid Glass — the 2025-2026 frontier](#10-liquid-glass--the-2025-2026-frontier)
11. [Tab strip merged into title bar](#11-tab-strip-merged-into-title-bar)
12. [Reference apps with great chrome](#12-reference-apps-with-great-chrome)
13. [Library round-up](#13-library-round-up)
14. [Concrete recipes for EZvibes](#14-concrete-recipes-for-EZvibes)
15. [Accessibility & performance guardrails](#15-accessibility--performance-guardrails)
16. [Pioneer-level ideas](#16-pioneer-level-ideas)
17. [References](#17-references)

---

## 1. Why this matters for EZvibes

The EZvibes already does something most Electron apps don't: it opens **folder-shaped popup terminal windows** that animate genie-style back into their source folder. Plugging the new **prompt vault** into that window — a left-rail panel inside the session window listing every `.md`, `.prompt.md`, `CLAUDE.md`, `HANDOFF.md` from a `prompts/` folder, copy-on-click into the active xterm — only feels "pioneer-level" if the surrounding chrome looks like nothing the user has ever seen in a CMD/PowerShell prompt window.

The 2025-2026 toolkit gives us four big levers:

1. **Frameless + custom title bar** — full control over the top strip so it can fuse with the vault.
2. **Windows 11 `backgroundMaterial`** — `mica`, `acrylic`, or `tabbed` painted by DWM behind everything.
3. **macOS `vibrancy: 'sidebar'` / Liquid Glass** — the new Apple language refracts whatever is behind the window.
4. **CSS-only Liquid Glass** (SVG `feDisplacementMap` + `backdrop-filter`) — works in Chromium/Electron today and lets us simulate Apple's glass on Windows too.

The session window already has a Chrome-style tab strip. With the right `titleBarStyle: 'hidden'` + `titleBarOverlay` combo we can extend that strip into the OS caption area, move the close/min/max into the same row as the tabs, and host the vault button right next to them. That is the **VS Code / Cursor / Linear pattern**.

---

## 2. Foundation: the modern frameless setup

In Electron 33+ the canonical frameless-with-native-overlay pattern looks like this (works on Windows, macOS, and Linux):

```js
// main.js
const { BrowserWindow, nativeTheme } = require('electron');

function createSessionWindow(folderPath) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 480,
    show: false,                  // open hidden, show on 'ready-to-show'
    frame: false,                 // strip the OS frame entirely
    titleBarStyle: 'hidden',      // hide title text on all platforms
    titleBarOverlay: {            // native caption buttons we can re-skin
      color:       '#1f1a14',     // Windows/Linux: caption background
      symbolColor: '#f5b25a',     // Windows: glyph color
      height:      36,            // height of the drag/caption strip (px)
    },
    backgroundMaterial: 'mica',   // Windows 11 only
    vibrancy: 'sidebar',          // macOS only — replaces with Liquid Glass on 26+
    visualEffectState: 'active',  // keep vibrancy live when window loses focus
    trafficLightPosition: { x: 14, y: 11 }, // macOS traffic light inset
    transparent: false,           // do NOT use transparent:true with mica
    backgroundColor: '#00000000', // zero-alpha so DWM/NSVisualEffect shows through
    roundedCorners: true,         // macOS/Windows 11 frameless rounding
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Re-skin caption when the theme flips
  nativeTheme.on('updated', () => {
    win.setTitleBarOverlay({
      color:       nativeTheme.shouldUseDarkColors ? '#1f1a14' : '#fdf9f3',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#f5b25a' : '#2a1f15',
    });
  });

  return win;
}
```

Why these particular values:

- `frame: false` removes the OS title bar **and** any default min/max/close buttons. Combined with `titleBarStyle: 'hidden'` you get a window with **no chrome at all** — the renderer paints everything.
- `titleBarOverlay` is the secret weapon. On Windows/Linux, Electron silently injects native Win32 caption buttons in the upper-right corner that you can re-color and re-size. You do **not** have to draw your own close/min/max anymore.
- `backgroundMaterial: 'mica'` makes DWM paint the desktop wallpaper, blurred, behind everything you render — but only if your CSS leaves areas transparent.
- `backgroundColor: '#00000000'` (eight-character hex with `00` alpha) is the Electron magic that says "don't paint anything; let the system material shine through."
- `vibrancy: 'sidebar'` on macOS now invokes the Tahoe Liquid Glass material on macOS 26+ apps that ship with Electron ≥36.9.2.
- `visualEffectState: 'active'` keeps the vibrancy effect on when the window loses focus (without this, the glass goes flat-gray when you click away).
- `trafficLightPosition: { x, y }` is the only way to vertically center the macOS traffic lights inside a custom 36-40px header strip.

This block alone is the difference between an Electron app that looks like a 2018 prototype and one that looks like Linear or Notion 2026.

---

## 3. `titleBarStyle` — the four useful values

From the official Electron base-window options doc, the platform-relevant values are:

| Value | Windows | macOS | Linux | Effect |
|-------|---------|-------|-------|--------|
| `default` | yes | yes | yes | Standard OS title bar with the OS-drawn close/min/max + a title. |
| `hidden` | yes | yes | yes | Hides the OS title bar; **macOS keeps traffic lights**, Windows/Linux are bare unless you add `titleBarOverlay`. |
| `hiddenInset` | — | yes | — | macOS-only. Like `hidden` but traffic lights are nudged a few pixels inset for a more spacious feel — what Linear uses. |
| `customButtonsOnHover` | — | yes (experimental) | — | macOS traffic lights are invisible until you hover the top-left corner. Arc-style. |

The historic `frame: false` is still around but it's now considered the **nuclear** option: you lose traffic lights on macOS and overlay buttons on Windows. Best practice in 2025 is `titleBarStyle: 'hidden'` (or `'hiddenInset'` on macOS) plus `titleBarOverlay` rather than `frame: false`.

### Per-platform recipe (works in EZvibes)

```js
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

new BrowserWindow({
  frame: !isMac && !isWin,       // keep native frame on Linux for now
  titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
  titleBarOverlay: isWin ? { color: '#1f1a14', symbolColor: '#f5b25a', height: 36 } : undefined,
  trafficLightPosition: isMac ? { x: 14, y: 11 } : undefined,
});
```

`hiddenInset` is preferred over `hidden` on macOS because it nudges the lights down by ~6 px, which lets a 36-40 px header strip swallow them gracefully. With plain `hidden` you usually have to set `trafficLightPosition` manually.

---

## 4. `titleBarOverlay` — native caption buttons you control

This is the Window Controls Overlay (WCO) API, exposed through Electron's `BrowserWindow` since v17 and stabilized through v33+. The constructor option accepts either `true` or a configuration object:

```js
titleBarOverlay: {
  color:       '#1f1a14',  // background of the caption strip (rgba/hsla/#RRGGBBAA)
  symbolColor: '#f5b25a',  // glyph color for the X / square / dash
  height:      36,         // strip height in px (all platforms)
}
```

- All three props accept `rgba()`, `hsla()`, and `#RRGGBBAA` so you can make the caption strip semi-transparent over Mica.
- You can update it at runtime with `win.setTitleBarOverlay({ color: '#ff0', symbolColor: '#000', height: 40 })`. This is how Discord and VS Code keep the caption buttons in sync with their dark/light theme without restarting the window.
- The overlay only renders on Windows and Linux. On macOS, the equivalent is the traffic lights, positioned via `trafficLightPosition`.

### Live theme switching

```js
const { nativeTheme } = require('electron');

function applyOverlay(win) {
  const dark = nativeTheme.shouldUseDarkColors;
  win.setTitleBarOverlay({
    color:       dark ? '#1f1a14' : '#fdf9f3',
    symbolColor: dark ? '#f5b25a' : '#2a1f15',
    height:      36,
  });
}

nativeTheme.on('updated', () => allSessionWindows().forEach(applyOverlay));
```

### Per-window animations

Because `setTitleBarOverlay` is idempotent, you can animate from JS:

```js
function fadeOverlay(win, fromHex, toHex, ms = 250) {
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    win.setTitleBarOverlay({ color: lerpHex(fromHex, toHex, t), height: 36 });
    if (t < 1) setImmediate(tick);
  };
  tick(start);
}
```

This is great for the EZvibes vault: when the vault drawer opens we can fade the caption strip to the vault accent color so the window "earns" a new identity.

---

## 5. Window Controls Overlay API (CSS env vars)

Once `titleBarOverlay` is enabled, Electron also exposes the Web Window Controls Overlay API to the renderer. This gives the renderer:

### CSS environment variables

```css
.title-bar {
  position: fixed;
  top:    env(titlebar-area-y);
  left:   env(titlebar-area-x);
  width:  env(titlebar-area-width);
  height: env(titlebar-area-height);
  -webkit-app-region: drag;
}
```

These four variables describe the **non-button** area of the caption strip — i.e. the area you can fill with your own UI (tabs, vault toggle, search). The width shrinks when the OS buttons appear on the right (Windows) or left (macOS, when you use traffic light position).

### JavaScript API

```js
// Renderer
if (navigator.windowControlsOverlay) {
  const rect = navigator.windowControlsOverlay.getTitlebarAreaRect();
  // rect.x, rect.y, rect.width, rect.height match the env() values

  navigator.windowControlsOverlay.addEventListener('geometrychange', (e) => {
    // Refit the tab strip on RTL switch, window resize, etc.
    console.log('Visible:', e.visible);
  });
}
```

The `geometrychange` event is the one to listen to. It fires whenever the caption strip changes size (right-to-left flip, maximize, fullscreen) so you can resize the embedded tab strip in lockstep with the OS buttons.

---

## 6. `-webkit-app-region` — the drag pattern

The drag region is the part of the renderer that behaves like the OS title bar (drag with mouse to move, double-click to maximize). Two CSS values are key:

```css
/* Everything that should drag the window */
.draggable, .titlebar {
  -webkit-app-region: drag;
}

/* Buttons, links, inputs, tabs — must opt out, otherwise they're un-clickable */
.draggable button,
.draggable a,
.draggable .tab-chip,
.draggable input {
  -webkit-app-region: no-drag;
}
```

### Gotchas

- **Drag regions ignore all pointer events.** A button overlapping a drag region won't fire `click`, `mouseenter`, `mouseleave`. You must mark each interactive child `no-drag`.
- **Text selection conflicts with drag.** Add `user-select: none;` to any draggable element that contains text, otherwise drag will accidentally select it.
- **DevTools can break drag.** Electron docs explicitly warn: "`-webkit-app-region: drag` is known to have problems while the developer tools are open." Closing DevTools restores normal behavior.
- **Only rectangular regions.** Even though you can set border-radius, the **hit-test** is always rectangular. You can't draw a hexagonal title bar that is precisely draggable.
- **Right-click on drag region** triggers the system context menu on Windows. If you want your own, intercept `mousedown` with `event.preventDefault()`, or just keep the system menu (it shows Move/Size/Minimize/Maximize/Close and is genuinely useful).

### Reactive double-click

To replicate macOS' "double-click title bar to minimize-or-maximize" with the user's system preference:

```js
// main.js
ipcMain.on('mac-titlebar-doubleclick', (event) => {
  if (process.platform !== 'darwin') return;
  const win = BrowserWindow.fromWebContents(event.sender);
  const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
  if (action === 'Minimize') win.minimize();
  else if (action === 'Maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
});

// renderer
titlebar.addEventListener('dblclick', (e) => {
  if (e.target === titlebar) window.api.macTitlebarDoubleclick();
});
```

This is from the DoltHub blog and is the canonical 2025 pattern.

---

## 7. Custom Windows caption buttons (HTML+CSS+IPC)

If you want to draw your **own** close/min/max instead of using `titleBarOverlay` (because you want hover animations or non-Windows-11 visuals), here is the full pattern. The `titleBarOverlay` route is preferred for 99% of apps but custom is needed for things like Cursor's animated chevrons.

### HTML structure

```html
<header class="titlebar">
  <div class="drag-region"></div>
  <div class="window-controls" id="winControls">
    <button class="ctl ctl-min" aria-label="Minimize">
      <svg viewBox="0 0 10 1" width="10" height="1"><rect width="10" height="1" /></svg>
    </button>
    <button class="ctl ctl-max" aria-label="Maximize">
      <svg viewBox="0 0 10 10" width="10" height="10"><rect width="9" height="9" x="0.5" y="0.5" fill="none" stroke="currentColor" /></svg>
    </button>
    <button class="ctl ctl-close" aria-label="Close">
      <svg viewBox="0 0 10 10" width="10" height="10">
        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" />
        <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" />
      </svg>
    </button>
  </div>
</header>
```

### CSS — VS Code/Discord style

```css
.titlebar {
  height: 36px;
  display: flex;
  align-items: center;
  background: transparent;     /* lets Mica show */
  position: relative;
  user-select: none;
}

.drag-region {
  position: absolute;
  inset: 0;
  -webkit-app-region: drag;
}

.window-controls {
  margin-left: auto;
  display: flex;
  -webkit-app-region: no-drag;
  z-index: 1; /* above drag-region */
}

.ctl {
  width: 46px;
  height: 36px;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: default;
  display: grid;
  place-items: center;
  transition: background 120ms ease;
}

.ctl:hover { background: rgba(255,255,255,0.07); }
.ctl-close:hover { background: #e81123; color: #fff; }   /* Windows red */
.ctl:focus-visible { outline: 1px solid currentColor; }
```

The 46×36 measurements come from Microsoft's [WinUI guidance](https://learn.microsoft.com/en-us/windows/apps/develop/title-bar) for caption-button hit targets — VS Code, Slack, and Linear all use this size.

### IPC plumbing

```js
// preload.js
contextBridge.exposeInMainWorld('chrome', {
  minimize:    () => ipcRenderer.send('chrome:minimize'),
  maximize:    () => ipcRenderer.send('chrome:maximize'),
  close:       () => ipcRenderer.send('chrome:close'),
  onMaxChange: (cb) => ipcRenderer.on('chrome:max-change', (_, max) => cb(max)),
});

// main.js
ipcMain.on('chrome:minimize', (e) => BrowserWindow.fromWebContents(e.sender).minimize());
ipcMain.on('chrome:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('chrome:close', (e) => BrowserWindow.fromWebContents(e.sender).close());

// notify renderer when state changes so it can flip the icon
function wireMaxChange(win) {
  ['maximize', 'unmaximize'].forEach(ev =>
    win.on(ev, () => win.webContents.send('chrome:max-change', win.isMaximized()))
  );
}
```

```js
// renderer
$('#minBtn').addEventListener('click', () => window.chrome.minimize());
$('#maxBtn').addEventListener('click', () => window.chrome.maximize());
$('#closeBtn').addEventListener('click', () => window.chrome.close());
window.chrome.onMaxChange(max => document.body.classList.toggle('is-max', max));
```

### Important: when to use overlay vs. custom

| Goal | Use `titleBarOverlay` | Draw your own |
|------|----------------------|----------------|
| Match OS exactly (Win11 caption buttons that follow accent color, support snap-layouts hover) | yes | no |
| Custom hover animations (color trails, scale, icon morph) | no | yes |
| Force the same look on all OS versions | no | yes |
| Make sure Snap Layouts (Win+arrow) still work | yes | partial — needs `getSystemContextMenu` |

For EZvibes I recommend the **overlay** — Snap Layouts hover on Windows 11 is incredibly useful when dragging a session window from one half of the screen to the other, and it only works if Windows owns the caption buttons.

---

## 8. Windows 11 Mica / Acrylic / Tabbed

The `backgroundMaterial` constructor option is the Electron wrapper around DWM's `DWMWA_SYSTEMBACKDROP_TYPE` (introduced in Windows 11 22H2 / build 22621). Values:

| Value | DWM type | Best for |
|-------|----------|----------|
| `'mica'` | `DWMSBT_MAINWINDOW` (2) | Main app windows. Wallpaper-tinted, very cheap to render. |
| `'tabbed'` | `DWMSBT_TABBEDWINDOW` (4) | Tabbed apps like browsers. Brighter mica with a slightly different texture (aka Mica Alt). |
| `'acrylic'` | `DWMSBT_TRANSIENTWINDOW` (3) | Transient surfaces (menus, command palette). Blurs the actual content under the window — heavier GPU cost. |
| `'auto'` | DWM picks | Lets DWM choose based on window class. Generally don't use. |
| `'none'` | Off | Default. No DWM material. |

### Minimal recipe

```js
new BrowserWindow({
  width: 1280, height: 800,
  show: false,
  frame: false,
  titleBarStyle: 'hidden',
  titleBarOverlay: { color: '#1a1410', symbolColor: '#ffaa55', height: 36 },
  backgroundColor: '#00000000',  // critical — zero alpha
  backgroundMaterial: 'mica',
});
```

Plus CSS:

```css
html, body { margin: 0; height: 100%; background: transparent; }
.app-frame  { background: rgba(20,16,12,0.55); }   /* over Mica */
.app-chrome { background: rgba(20,16,12,0.85); }   /* less translucent header */
```

### Known pitfalls (still relevant in early 2026)

1. **Never combine `backgroundMaterial: 'mica'` with `transparent: true`**. The two compete for the alpha buffer and one wins, usually `transparent`, which kills DWM rendering. Use `backgroundColor: '#00000000'` to express transparency instead.
2. **Frameless maximize bug.** Before Electron 36 / the Aug 2025 patch (PR #45456), maximizing a frameless mica window turned it black and stripped rounded corners. EZvibes can target Electron 33.x.y or 36+; verify by `win.isMaximized() && win.setBackgroundMaterial('mica')` after maximize.
3. **Energy saver kills Mica.** If Windows 11's "Energy Saver" toggle is on, DWM renders Mica as flat gray. Detect with `systemPreferences.getEffectiveAppearanceName()` and fall back to a CSS gradient.
4. **`titleBarStyle: 'default'` works too**, but you lose the overlay; pick one path or the other.
5. **`backgroundMaterial: 'tabbed'`** is the right choice for EZvibes because each session window is literally a tabbed surface. It gives the same wallpaper tint as `mica` with a subtle bias toward the active tab color.

### Switching materials at runtime

```js
ipcMain.on('chrome:set-material', (e, material) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  win.setBackgroundMaterial(material);   // 'mica' | 'acrylic' | 'tabbed' | 'none'
});
```

Useful for "focus mode" — flip to `'none'` and paint a deep dark background while the user is heads-down typing, then back to `'tabbed'` when they pop the vault open.

### Native fallback via Koffi (for older Electron)

If you ever need Mica on an Electron build that predates the API, the modern community path is calling DWM directly through Koffi (a Node FFI library):

```ts
import koffi from 'koffi';
const dwm = koffi.load('dwmapi.dll');
const DwmSetWindowAttribute = dwm.func('DwmSetWindowAttribute', 'long',
  ['void *', 'int', 'void *', 'uint']);

const DWMWA_SYSTEMBACKDROP_TYPE = 38;
const DWMSBT_MAINWINDOW = 2; // mica

DwmSetWindowAttribute(win.getNativeWindowHandle(),
  DWMWA_SYSTEMBACKDROP_TYPE, [DWMSBT_MAINWINDOW], 4);
```

This is overkill for EZvibes since Electron 33 already exposes `backgroundMaterial`, but it's the canonical workaround if you ever roll back to Electron 22 / 24.

### Third-party Mica libraries

- `mica-electron` (GregVido) — wraps the new `MicaBrowserWindow` constructor with `setMicaEffect()`, `setMicaAcrylicEffect()`, `setMicaTabbedEffect()`, `setRoundedCorner()`. Useful when you want a one-liner.
- `@pyke/vibe` — Rust-based native lib for Win10 + Win11. Exposes `vibe.setup(app)` + `vibe.applyEffect(win, 'acrylic' | 'mica' | 'unified-acrylic')`. Slightly more featured than Electron's built-in.

Recommendation for EZvibes: **stick with the built-in `backgroundMaterial`**. Both libraries are interesting but they add a native build step on Windows, which already costs you the `node-pty` rebuild dance.

---

## 9. macOS vibrancy, traffic lights, Tahoe gotchas

### vibrancy values

`vibrancy: '<type>'` accepts: `appearance-based`, `titlebar`, `selection`, `menu`, `popover`, `sidebar`, `header`, `sheet`, `window`, `hud`, `fullscreen-ui`, `tooltip`, `content`, `under-window`, `under-page`.

For EZvibes the relevant ones are:

| Vibrancy | Use case |
|----------|----------|
| `'sidebar'` | The Notion-style left rail. On macOS 26 this becomes Liquid Glass. |
| `'header'` | Top strip. Liquid Glass-ifies the title bar area. |
| `'under-window'` | A full-window translucent backing — great for a "floating" terminal popup. |
| `'fullscreen-ui'` | The dim translucent backing the OS uses for fullscreen overlays. Cool for a "focus mode." |
| `'hud'` | Heads-up overlay — appropriate for the vault's quick-paste hover preview. |

### traffic light position

```js
new BrowserWindow({
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 14, y: 11 }, // matches a 36px header
});
```

The y value should be `(headerHeight - 14) / 2` where 14 is the traffic light height — that's the formula from DoltHub's 2025 post.

**Tahoe bug:** On macOS 26 the traffic lights regressed to no longer be centered. Electron 36.9.2+ fixed this; if you can't upgrade, manually adjust `trafficLightPosition` with an extra +2 y.

### Tahoe Liquid Glass

On macOS Tahoe (26+), Electron's `vibrancy: 'sidebar'` and `'header'` automatically use the new Liquid Glass material — that's the framework-level upgrade. The Raycast team confirmed they adopted Liquid Glass on day one of the Tahoe SDK simply by upgrading their NSVisualEffectView material.

### Tahoe critical bug to be aware of

In Sept-Nov 2025, Electron apps caused **system-wide GPU lag** on macOS Tahoe because Electron had been calling a private `_cornerMask` API on `ElectronNSWindow`. The fix:

- Electron PR #48376 (Nov 2025): stop overriding the private corner mask API.
- Apple shipped a system-level fix in macOS 26.2 (Nov 2025) that prevents *any* app from doing this regardless.

**Action for EZvibes:** stay on Electron ≥36.9.2 if you target Tahoe. The current default of Electron 33 is safe on Sequoia but may regress on Tahoe.

### Reduce transparency

Always respect the user's accessibility settings:

```js
const reduce = systemPreferences.getUserDefault('AppleReduceTransparency', 'boolean');
if (reduce) win.setVibrancy(null);
```

Or in CSS:

```css
.glass-pane { backdrop-filter: blur(20px); }
@media (prefers-reduced-transparency: reduce) {
  .glass-pane { backdrop-filter: none; background: #1a1410; }
}
```

The `prefers-reduced-transparency` query has been supported in Chrome since v118 (Oct 2023) and is fully usable in any modern Electron.

---

## 10. Liquid Glass — the 2025-2026 frontier

Apple introduced Liquid Glass at WWDC 2025 and made it the design language for iOS 26 / iPadOS 26 / macOS 26 Tahoe. Three things make it different from glassmorphism:

1. **Real-time refraction** — pixels behind the panel are actively bent by an `feDisplacementMap`, not just blurred.
2. **Specular highlights** — a rim light reflects across the panel as the cursor or device moves.
3. **Adaptive contrast** — the material auto-adjusts opacity based on the brightness behind it.

You can re-create the look in pure CSS + SVG in Chromium / Electron today. **This is the killer feature** to make EZvibes feel like 2026.

### The three-layer pattern

Used by every shipping CSS implementation (DesignFast, Lucky Graphics, nikdelvin/liquid-glass):

```css
.glass {
  position: relative;
  border-radius: 18px;
  isolation: isolate;
  overflow: hidden;
}

/* Layer 1: refraction (the backdrop the panel "lenses") */
.glass::before {
  content: '';
  position: absolute;
  inset: -1.5px;            /* extend past the border to hide AA artifacts */
  border-radius: inherit;
  backdrop-filter:
    blur(24px) saturate(180%)
    url(#liquid-glass-refraction);
  z-index: -1;
}

/* Layer 2: tint + inner glow */
.glass {
  background: linear-gradient(
    180deg,
    oklch(20% 0.05 35 / 0.18) 0%,
    oklch(20% 0.05 35 / 0.10) 100%
  );
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.10),
    inset 0 1px 0 0 rgba(255,255,255,0.18),
    0 12px 32px rgba(0,0,0,0.30);
}

/* Layer 3: specular highlight that follows the cursor */
.glass::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    240px circle at var(--cursor-x, 50%) var(--cursor-y, 0%),
    rgba(255,255,255,0.18),
    transparent 60%
  );
  pointer-events: none;
  border-radius: inherit;
  mix-blend-mode: screen;
}
```

```html
<svg width="0" height="0" style="position:absolute">
  <filter id="liquid-glass-refraction">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="3" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="6"
                       xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```

```js
// Specular highlight follows the cursor
glassPane.addEventListener('mousemove', (e) => {
  const r = glassPane.getBoundingClientRect();
  glassPane.style.setProperty('--cursor-x', `${e.clientX - r.left}px`);
  glassPane.style.setProperty('--cursor-y', `${e.clientY - r.top}px`);
});
```

### Critical: `backdrop-filter: url(#…)` only works in Chromium

The `feDisplacementMap` trick depends on Chromium's ability to apply SVG filters as `backdrop-filter`. Safari and Firefox fall back to plain blur. **For Electron this is perfect** — we're always Chromium.

### High-fidelity option: physics-based displacement map

For *real* Apple-level refraction you compute a displacement map from Snell's law and a Squircle surface function (the Kube.io blog walks through this). That gives perfect edge lensing. For EZvibes it's overkill — the turbulence trick above is 95% of the way there with 1% of the complexity.

### Performance budget

Per Lucky Graphics and DesignFast:

- Limit to **≤3 concurrent active glass panels per window**.
- Use blur 8-24 px; saturate 160-200% compensates for the perceived washout.
- Extend panel by 1.5 px past the border to hide AA jitter.
- Drop to opaque background under `prefers-reduced-motion` or `prefers-reduced-transparency`.

For EZvibes: the vault drawer is one glass panel, the title bar is another, the active tab is a third. Stay at three.

---

## 11. Tab strip merged into title bar

This is the single biggest "I didn't realize an Electron app could look like this" win. VS Code, Cursor, Chrome, and Edge all merge their tab strip into the OS title bar so the strip extends right up to the maximize/close buttons.

### The layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [folder name] ▢ [tab 1] [tab 2] [+]              ─ ☐ ✕   <- 36px │
│ ┌─────────┐ ┌────────────────────────────────────────────────┐   │
│ │ vault   │ │ xterm                                          │   │
│ │ panel   │ │                                                │   │
│ │         │ │                                                │   │
│ └─────────┘ └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

The 36px row holds three things in one strip:

1. The folder name / breadcrumb (left).
2. The tab chips (center).
3. Native OS caption buttons (right, owned by `titleBarOverlay`).

### CSS

```css
.session-titlebar {
  position: fixed;
  top:    env(titlebar-area-y, 0);
  left:   env(titlebar-area-x, 0);
  width:  env(titlebar-area-width, 100%);
  height: env(titlebar-area-height, 36px);
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 0 12px;
  -webkit-app-region: drag;
  background: rgba(20,16,12,0.55);
  backdrop-filter: blur(18px) saturate(160%);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  user-select: none;
}

.session-titlebar .tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  -webkit-app-region: no-drag;
}

.session-titlebar .tab-chip {
  -webkit-app-region: no-drag;
  height: 28px;
  padding: 0 12px;
  border-radius: 8px 8px 0 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  color: var(--text-dim);
  transition: background 120ms ease;
}
.session-titlebar .tab-chip:hover {
  background: rgba(255,255,255,0.06);
}
.session-titlebar .tab-chip[data-active] {
  background: rgba(245,178,90,0.18);
  color: var(--text);
}
```

The `env(titlebar-area-*)` variables guarantee the strip stays inside the area Electron *doesn't* paint with caption buttons. On RTL languages or fullscreen the strip auto-shrinks.

### Vault button placement

The vault toggle goes at the **left** of the strip, next to the folder name — that's the spot Cursor reserves for its "Settings" gear and Linear puts its team switcher. It's draggable-by-default surrounding area means the user can grab anywhere except the chips/buttons to move the window.

```html
<header class="session-titlebar">
  <div class="left">
    <span class="folder-name">my-project</span>
    <button class="vault-toggle no-drag" data-tip="Prompts (Ctrl+Shift+P)">
      <svg viewBox="0 0 16 16">…vault icon…</svg>
    </button>
  </div>

  <div class="tabs no-drag" id="tabStrip"></div>

  <!-- right side is owned by titleBarOverlay → just leave empty -->
  <div class="right"></div>
</header>
```

---

## 12. Reference apps with great chrome

### VS Code

Frameless on Windows + Linux (`frame: false` + custom strip), `titleBarStyle: 'hidden'` on macOS with `trafficLightPosition`. Tabs are *part of* the title bar — there is no separate tab row. Settings → `"window.titleBarStyle": "custom"` flips between native and custom. VS Code's strip layout is a great reference for EZvibes. Source: vscode `vs/workbench/browser/parts/titlebar/`.

### Cursor

Same architecture as VS Code (it's a fork) but with animated chevron transitions and a tinted accent color in the title bar that tracks the active sidebar (Composer / Agent / Chat). They draw their own caption buttons because Cursor wants a softer hover than the system's. They show the "Anysphere Dark" tone as the active background.

### Linear

Custom Electron app. On macOS: `titleBarStyle: 'hiddenInset'` + `vibrancy: 'sidebar'`. On Windows: `frame: false` + custom caption (no overlay, drawn buttons). Linear's hallmark is a 56-px header that hosts the workspace switcher, breadcrumbs, and a command palette trigger all in one row. The title-bar background is a flat dark slate (`#101013`) on Windows but on Tahoe it's Liquid Glass'd via `vibrancy: 'header'`. Their 2024 redesign post emphasizes "consistent layout of header bars" — that's the central design principle.

### Notion

Custom wrapper on macOS uses `titleBarStyle: 'hiddenInset'` and `vibrancy: 'sidebar'`. The sidebar's tint reacts to the wallpaper. On Tahoe the sidebar hovers over content with refraction (Notion adopted the new Liquid Glass sidebar in the macOS Tahoe update). The Windows version uses a custom dark-slate strip with `titleBarOverlay`.

### Slack

`frame: false` + custom caption on Windows. macOS: `titleBarStyle: 'hiddenInset'` + traffic lights at `{ x: 12, y: 16 }`. 2024 redesign introduced a "navigator" rail on the far left (above traffic lights) that is wider than the lights — they show the rail's "search" pill aligned with the traffic lights on the y axis. This is a great pattern for EZvibes's vault toggle.

### Discord

Frameless on Windows + Linux with **custom** caption buttons (drawn from scratch — they wanted the "Discord red" close hover and a custom maximize toggle). They have a custom drag region that excludes their channel-list scroller. macOS: `titleBarStyle: 'hidden'` with a top strip used for the search bar + voice control buttons.

### Figma desktop

`frame: false` on all platforms. Their entire toolbar (with file name, share button, viewer count) is draggable + has no-drag chips for each interactive element. The traffic lights and Windows caption buttons are inset into the same row as the file name. Very clean.

### Arc Browser

Sets a precedent for "no title bar at all" — their entire window has a vertical sidebar with tabs, and traffic lights float on hover via `titleBarStyle: 'customButtonsOnHover'`. Arc's recent Windows release uses frameless + custom strip with mica.

### Apple Notes / Reminders (Tahoe)

The post-Tahoe redesign uses Liquid Glass: sidebars hover above content, refracting whatever is below. The window has no visible title bar — traffic lights sit on a transparent strip and the sidebar slides under them. This is the closest analog to what EZvibes could become: a translucent vault sidebar that floats over the terminal content.

### Raycast 2.0

Not Electron — written in Swift/AppKit + WKWebView — but the pattern it pioneered (transparent window with Liquid Glass material, command palette floating over everything) is achievable in Electron via `vibrancy: 'hud'` + Liquid Glass CSS. Worth studying as the gold standard for "command UI over a desktop."

---

## 13. Library round-up

### Built-in (no library needed)

- `BrowserWindow` constructor options: `frame`, `titleBarStyle`, `titleBarOverlay`, `backgroundMaterial`, `vibrancy`, `visualEffectState`, `trafficLightPosition`, `roundedCorners`, `hasShadow`, `transparent`, `backgroundColor`.
- `win.setTitleBarOverlay({ color, symbolColor, height })` — live runtime updates.
- `win.setBackgroundMaterial(material)` — flip materials at runtime.
- `win.setVibrancy(type, { animationDuration })` — runtime macOS vibrancy.
- `win.setWindowButtonVisibility(visible)` — hide/show traffic lights.
- `win.setHasShadow(bool)`, `win.setShape([rects])` — non-rectangular shapes (use sparingly, mouse events stop outside the shape).
- Web `navigator.windowControlsOverlay.getTitlebarAreaRect()` + `geometrychange` event.
- CSS env vars: `env(titlebar-area-x | y | width | height)`.

### Third-party

| Library | Purpose | Notes |
|---------|---------|-------|
| `custom-electron-titlebar` | VS Code-inspired custom title bar with menu integration. | 899 stars on GitHub. Comes with a theme JSON schema, hot-reloadable colors. Last release v4.4.1. Best when you want a *configurable* title bar without writing CSS. |
| `mica-electron` | Adds `MicaBrowserWindow` with `setMicaEffect/setMicaTabbedEffect/setMicaAcrylicEffect`. | Good wrapper if you don't want to remember the constructor knobs. |
| `@pyke/vibe` | Native Rust lib for Win10 + Win11 effects (acrylic, mica, unified-acrylic). | Requires Rust toolchain at build time. Powerful, slightly heavy. |
| `@electron-uikit/titlebar` | Modern web component. Latest v1.4.0. | Lighter than `custom-electron-titlebar`. |
| `electron-titlebar-windows` | Tiny lib for just the Windows caption. | Use if you only ship to Windows. |
| `electron-acrylic-window` | Older lib for blur-behind. | Effectively superseded by built-in `backgroundMaterial`. |
| `nikdelvin/liquid-glass` | Astro/CSS components that render Apple-style liquid glass with chromatic aberration. | Has `LiquidGlass`, `LiquidText`, `LiquidButton`. Inspiration for EZvibes's vault panel. |

### Recommendation for EZvibes

Don't add any of these libraries — Electron 33 already gives you everything except Liquid Glass CSS, and Liquid Glass is just CSS + an inline SVG filter. The dependency surface stays small and you keep full control.

---

## 14. Concrete recipes for EZvibes

### A. Session window — Mica + tabbed strip (Windows)

```js
// main.js
const sessionWindow = new BrowserWindow({
  width: 1280, height: 800,
  minWidth: 720, minHeight: 420,
  show: false,
  frame: false,
  titleBarStyle: 'hidden',
  titleBarOverlay: { color: '#1a1410', symbolColor: '#f5b25a', height: 36 },
  backgroundColor: '#00000000',
  backgroundMaterial: 'tabbed',     // 'mica' is fine too; 'tabbed' suits multi-tab
  roundedCorners: true,
  hasShadow: true,
  icon: path.join(__dirname, 'renderer/ezvibes.ico'),
  webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: false }
});
sessionWindow.once('ready-to-show', () => sessionWindow.show());
```

### B. Session window — Liquid Glass sidebar (macOS)

```js
const sessionWindow = new BrowserWindow({
  width: 1280, height: 800,
  show: false,
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 14, y: 11 },
  vibrancy: 'sidebar',          // becomes Liquid Glass on Tahoe
  visualEffectState: 'active',
  backgroundColor: '#00000000',
  roundedCorners: true,
});
```

### C. Vault drawer — three-layer glass

```html
<aside class="vault">
  <header class="vault-titlebar">PROMPTS</header>
  <ol class="vault-list" id="vaultList"></ol>
</aside>

<svg width="0" height="0" style="position:absolute">
  <filter id="glass-refract">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="2" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```

```css
.vault {
  position: absolute;
  top: 36px;          /* under title strip */
  left: 0;
  bottom: 0;
  width: 280px;
  z-index: 10;
  isolation: isolate;
  border-right: 1px solid rgba(255,255,255,0.07);
  border-top-right-radius: 12px;
  overflow: hidden;
}
.vault::before {
  content: '';
  position: absolute;
  inset: -1.5px;
  backdrop-filter: blur(28px) saturate(180%) url(#glass-refract);
  z-index: -1;
}
.vault {
  background: linear-gradient(180deg,
    oklch(20% 0.05 35 / 0.30),
    oklch(15% 0.04 35 / 0.18));
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.08),
    inset 0 1px 0 0 rgba(255,255,255,0.20),
    8px 0 24px rgba(0,0,0,0.35);
}
.vault::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(220px at var(--cx,50%) var(--cy,0%),
    rgba(255,200,120,0.10), transparent 60%);
  mix-blend-mode: screen;
}

@media (prefers-reduced-transparency: reduce) {
  .vault::before, .vault::after { display: none; }
  .vault { background: #1a1410; }
}
```

```js
const vault = document.querySelector('.vault');
vault.addEventListener('pointermove', (e) => {
  const r = vault.getBoundingClientRect();
  vault.style.setProperty('--cx', `${e.clientX - r.left}px`);
  vault.style.setProperty('--cy', `${e.clientY - r.top}px`);
});
```

### D. Active-tab glow

```css
.tab-chip {
  position: relative;
  transition: background 120ms ease, transform 200ms ease;
}
.tab-chip[data-active]::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: radial-gradient(60% 80% at 50% 100%,
    rgba(245,178,90,0.40), transparent 70%);
  pointer-events: none;
  z-index: -1;
}
```

### E. Genie-fallback when frameless minimize doesn't animate

Windows 11 already animates frameless minimize via Snap. macOS animates via system Genie. If a window is created with `frame: false` + `transparent: true`, macOS may skip Genie. The fix: don't use `transparent: true`. Use `backgroundColor: '#00000000'` instead.

---

## 15. Accessibility & performance guardrails

### Always honor `prefers-reduced-transparency`

```css
@media (prefers-reduced-transparency: reduce) {
  .glass, .vault, .session-titlebar {
    backdrop-filter: none;
    background: var(--solid-fallback);
  }
}
```

### Always honor `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .tab-chip, .ctl, .glass::after {
    transition: none !important;
  }
}
```

### Performance budget

- Max 3 active `backdrop-filter` panels per window.
- Use `transform: translateZ(0)` / `will-change: transform` on glass layers to keep them on a GPU layer.
- Avoid `backdrop-filter: blur(40px)` — anything ≥30 px causes measurable jank. Use 16-24 px and compensate with `saturate(180%)`.
- Don't combine `backdrop-filter` with `transform: scale()` on the parent — Chrome rebuilds the filter each frame.

### Energy Saver detection (Windows 11)

```js
const { systemPreferences } = require('electron');

function maybeFallbackToSolid(win) {
  const battery = systemPreferences.getEffectiveAppearanceName?.();
  // No direct Energy Saver API yet — proxy by detecting Mica failure
  setTimeout(() => {
    if (!win.isVisible()) return;
    const test = win.getBackgroundMaterial?.();
    if (test === 'none') win.webContents.send('chrome:material-fallback');
  }, 500);
}
```

### Sandboxing and `webPreferences`

Custom title bars work fine with `contextIsolation: true` and `sandbox: true`. Only `setupTitlebarAndAttachToWindow` from `custom-electron-titlebar` requires `sandbox: false` — that's another reason to roll your own.

---

## 16. Pioneer-level ideas

These are the moves that would push EZvibes from "nice Electron app" to "I have to screenshot this and tweet it":

### 16.1 Material that morphs as the agent thinks

When the active tab's PTY is idle: `backgroundMaterial: 'mica'` (calm, wallpaper-tinted).
When the agent is mid-response: switch to `'acrylic'` for ~3 seconds with a brightening pulse, then back. Discoverable by watching for token-stream OSC sequences. **Window itself reacts to the AI's cognitive state.**

```js
ptyData.on('data', () => {
  win.setBackgroundMaterial('acrylic');
  clearTimeout(restoreTimer);
  restoreTimer = setTimeout(() => win.setBackgroundMaterial('tabbed'), 3000);
});
```

### 16.2 Vault "shelf" that physically slides out from the folder frame

Use `win.setShape([…])` with a sequence of rectangles to make the *window itself* expand horizontally when the vault opens, then collapse on close. Combine with a CSS transform on the contents so the prompts slide into view as the window grows. This is the kind of effect Arc Browser is famous for and almost no Electron app does.

### 16.3 Specular highlight that follows the OS cursor across the whole window

Subscribe to global mouse position via `screen.getCursorScreenPoint()` polled at 60 Hz and feed it into a CSS variable. The Liquid Glass specular sweeps across the entire window — including the title bar and traffic lights — as you move the mouse anywhere on screen, even outside the window. Apple does this on iOS 26 with device motion. **Nobody does it on desktop yet.**

```js
setInterval(() => {
  const pt = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  win.webContents.send('chrome:cursor', {
    x: pt.x - bounds.x,
    y: pt.y - bounds.y,
  });
}, 16);
```

### 16.4 Mica that bleeds into the terminal

Set the xterm renderer's `theme.background` to `'rgba(20,16,12,0.5)'` and add `background: transparent` to the xterm canvas wrapper. The Mica/Liquid Glass material shows *through the terminal output itself*. The xterm canvas already supports an alpha buffer — but you have to set `allowTransparency: true` on the Terminal constructor.

```js
const term = new Terminal({
  allowTransparency: true,
  theme: { background: 'rgba(20,16,12,0.40)' },
});
```

This is **massively underused**. Terminal apps almost always have an opaque background. Making it translucent over Mica/Liquid Glass would be an EZvibes signature.

### 16.5 Caption strip color follows the active tab's agent

```js
function onActiveTabChanged(tab) {
  const color = tab.agent === 'codex' ? '#0d2f33' : '#1a1410';
  const symbol = tab.agent === 'codex' ? '#4dd6c5' : '#f5b25a';
  win.setTitleBarOverlay({ color, symbolColor: symbol, height: 36 });
}
```

The native Windows caption buttons turn teal when on a Codex tab, amber when on a Claude tab. Subtle and beautiful — and impossible to do with a stock window frame.

### 16.6 Folder-shaped windows for real (not just CSS)

Today EZvibes fakes the folder shape with CSS. With `win.setShape([rects])` you can make the actual hit-tested window shape look like a folder tab, including the genie animation. The downside: only rectangular pieces, and pointer events stop outside the shape. Worth experimenting with for the popup window's initial animation.

### 16.7 Per-tab vibrancy (macOS)

Each tab has its own `vibrancy` flavor: Claude tabs are `'sidebar'` (warm tan), Codex tabs are `'menu'` (cool blue), and switching tabs animates the vibrancy with `win.setVibrancy(type, { animationDuration: 250 })`. The whole window's mood shifts as you swap tabs.

### 16.8 Liquid Glass prompt cards

In the vault, each `.md` is a Liquid Glass card. Hovering one tilts it 3 degrees toward the cursor (CSS `transform: rotate3d`) and the specular highlight follows. Clicking it does a "ripple → fade" before pasting to the terminal. This is iOS 26 home-screen aesthetics applied to a *prompt vault*. **Pioneer move.**

---

## 17. References

### Official Electron docs
- [Window Customization](https://www.electronjs.org/docs/latest/tutorial/window-customization)
- [Custom Title Bar tutorial](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar)
- [Custom Window Interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)
- [Custom Window Styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles)
- [BaseWindowConstructorOptions](https://www.electronjs.org/docs/latest/api/structures/base-window-options)
- [BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)
- [Dark Mode](https://www.electronjs.org/docs/latest/tutorial/dark-mode)
- [Electron 33 release notes](https://www.electronjs.org/blog/electron-33-0)
- [Fiddle: custom-drag-region (v40)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/features/window-customization/custom-title-bar/custom-drag-region)
- [PR #38163 — Mica/Acrylic on Windows](https://github.com/electron/electron/pull/38163)
- [PR #39708 — Frameless Mica/Acrylic fix](https://github.com/electron/electron/pull/39708)
- [PR #45456 — Window maximizing with Mica](https://github.com/electron/electron/pull/45456)
- [PR #48376 — macOS 26 Tahoe corner mask fix](https://github.com/electron/electron/pull/48376)
- [Issue #29937 — Mica feature request](https://github.com/electron/electron/issues/29937)
- [Issue #42393 — Maximized backgroundMaterial bug](https://github.com/electron/electron/issues/42393)
- [Issue #46753 — Material + corners inconsistency](https://github.com/electron/electron/issues/46753)
- [Issue #47514 — macOS 26 rounded corners SDK](https://github.com/electron/electron/issues/47514)
- [Issue #48343 — macOS 26 SDK support](https://github.com/electron/electron/issues/48343)

### Tutorials and write-ups
- [DoltHub — Building a Custom Title Bar (Feb 2025)](https://www.dolthub.com/blog/2025-02-11-building-a-custom-title-bar-in-electron/)
- [DevBlogs.sh — Building a Custom Title Bar](https://devblogs.sh/posts/building-a-custom-title-bar-in-electron)
- [Cold Fusion — Implementing Mica/Acrylic in Electron (Dec 2025)](https://coldfusion-example.blogspot.com/2025/12/implementing-windows-11-mica-acrylic.html)
- [Webtips.dev — Seamless Controls for Electron](https://webtips.dev/seamless-controls-for-your-next-electron-app)
- [Our Code World — VS Code-style title bar](https://ourcodeworld.com/articles/read/938/how-to-create-a-custom-titlebar-inspired-on-visual-studio-code-title-bar-in-electron-framework)
- [GeeksForGeeks — Frameless Window](https://www.geeksforgeeks.org/frameless-window-in-electronjs/)
- [Christian Engvall — Electron frameless](https://www.christianengvall.se/electron-frameless-window/)

### Liquid Glass / CSS
- [Kube.io — Liquid Glass with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/)
- [Lucky Graphics — Liquid Glass High-Performance Guide 2026](https://lucky.graphics/learn/liquid-glass-css-glassmorphism-tutorial/)
- [LogRocket — Liquid Glass with CSS and SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- [Ekino France — Liquid Glass in CSS and SVG](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- [nikdelvin/liquid-glass repo](https://github.com/nikdelvin/liquid-glass)
- [DesignFast — CSS Liquid Glass Effects](https://designfast.io/liquid-glass)
- [Free Frontend — 16 CSS Liquid Glass Effects](https://freefrontend.com/css-liquid-glass/)
- [Everyday UX — Glassmorphism in 2025](https://www.everydayux.net/glassmorphism-apple-liquid-glass-interface-design/)
- [MDN — prefers-reduced-transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency)

### Window Controls Overlay
- [MDN — Window Controls Overlay API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Controls_Overlay_API)
- [MDN — Navigator.windowControlsOverlay](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/windowControlsOverlay)
- [WICG — Window Controls Overlay spec](https://wicg.github.io/window-controls-overlay/)
- [web.dev — Customize PWA title bar](https://web.dev/articles/window-controls-overlay)

### Apple liquid glass / Tahoe context
- [Apple — Introducing the new software design (June 2025)](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- [Apple — All New Features macOS Tahoe (PDF)](https://www.apple.com/os/pdf/All_New_Features_macOS_Tahoe_Sept_2025.pdf)
- [MacRumors — macOS Tahoe roundup](https://www.macrumors.com/roundup/macos-26/)
- [9to5Mac — Tahoe fixes Electron performance](https://9to5mac.com/2025/11/21/mac-tahoe-electron-performance-bug/)
- [Shamelectron — Electron GPU performance tracker](https://avarayr.github.io/shamelectron/)
- [Raycast — Technical Deep Dive into Raycast 2.0](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

### Third-party libraries
- [custom-electron-titlebar (AlexTorresDev)](https://github.com/AlexTorresDev/custom-electron-titlebar)
- [custom-electron-titlebar on npm](https://www.npmjs.com/package/custom-electron-titlebar)
- [mica-electron (GregVido)](https://github.com/GregVido/mica-electron)
- [@pyke/vibe](https://github.com/pykeio/vibe)
- [@electron-uikit/titlebar](https://www.npmjs.com/package/@electron-uikit/titlebar)
- [electron-titlebar (XinYueStudio)](https://github.com/XinYueStudio/electron-titlebar)
- [ngx-electron-titlebar](https://github.com/bennymeg/ngx-electron-titlebar)
- [electron-tinted-with-sidebar](https://github.com/davidcann/electron-tinted-with-sidebar)
- [electron-vibrancy](https://github.com/0x61726b/electron-vibrancy)
- [electron-acrylic-window](https://github.com/Seo-Rii/electron-acrylic-window)

### Reference apps and design analysis
- [Linear — How we redesigned the UI (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear — A calmer interface (design refresh)](https://linear.app/now/behind-the-latest-design-refresh)
- [Arc Browser — Reimagining the Browser Chrome](https://blakecrosley.com/guides/design/arc)
- [Microsoft — Title bar customization (Windows Apps)](https://learn.microsoft.com/en-us/windows/apps/develop/title-bar)
- [VSCode Issue #107123 — Combine tabs and title bar](https://github.com/microsoft/vscode/issues/107123)
- [Jonatan Heyman — VS Code without the title bar](https://heyman.info/2023/vscode-without-the-title-bar)
- [Hacker News — Electron + macOS 26 Tahoe lag thread](https://news.ycombinator.com/item?id=45376977)
- [Suyash Srivastava — Custom title bar Medium post](https://medium.com/@suyash.srivastava14/custom-title-bar-for-electron-app-windows-and-mac-56089ba0aac)

---

*End of research. Total length ~7,000 words. This file is intended to be a single reference doc for EZvibes's session-window chrome design conversation.*
