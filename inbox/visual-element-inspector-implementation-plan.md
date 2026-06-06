# Visual Element Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user point at a DOM element in a browser tab, describe a change in words, pick a running agent session from grid view, and inject that instruction + the element's context (HTML, computed CSS, bounding box, selector, URL) into the chosen session's PTY.

**Architecture:** A new renderer-only `element-inspector` feature orchestrates the flow. It adds ONE hook each to the Browser feature (`captureElement`, `setPickerActive` — only Browser may touch the guest `<webview>`) and the Grid View feature (`pickWindow` — enters grid in select mode, resolves with the clicked tile's tabId). The pure prompt-composition + element-extraction script logic lives in a dual-exported `element-inspector.payload.js` module (testable via `node --test`, mirroring `launcher.agents.js`). PTY injection reuses the existing `terminalAPI.send(tabId, data)` preload bridge — no new IPC.

**Tech Stack:** Vanilla JS (CommonJS in node-tested modules, IIFE module pattern in renderer), Electron `<webview>.executeJavaScript`, xterm.js PTY bridge, `node:test` for unit tests.

---

## File Structure

**Create:**
- `renderer/features/element-inspector/element-inspector.payload.js` — pure functions: `composePrompt(instruction, ctx)`, `buildPickerScript()` (returns the IIFE source string injected into the guest), `CAPTURED_CSS_PROPS` (the curated computed-style allowlist). Dual-exported for `node:test` (guarded `typeof module !== 'undefined'`).
- `renderer/features/element-inspector/element-inspector.payload.test.js` — node tests for `composePrompt` and the CSS allowlist.
- `renderer/features/element-inspector/element-inspector.renderer.js` — IIFE `ElementInspectorFeature`: toggle button creation + sticky state, prompt-box UI, Apply → `pickWindow` → compose → inject, Esc teardown.
- `renderer/features/element-inspector/element-inspector.styles.css` — crosshair toggle button (matches `#sidebar-actions` icon buttons), floating prompt box, grid "select window" banner.

**Modify:**
- `renderer/features/browser/browser.renderer.js` — add `captureElement(tabId)` + `setPickerActive(tabId, active)` to the public return; both use `webviews.get(tabId).executeJavaScript(...)`.
- `renderer/features/grid-view/grid-view.renderer.js` — add `selectMode` state + `pickWindow()` to the public return; tile mousedown resolves the pending pick.
- `renderer/features/grid-view/grid-view.styles.css` — `.grid-select-banner` styles.
- `renderer/index.html` — add the `<script>` (after `grid-view.renderer.js`, before `app.js`) and `<link>` for the new feature; load `element-inspector.payload.js` before `element-inspector.renderer.js`.
- `renderer/app.js` — `ElementInspectorFeature.init()` after `GridViewFeature.init()`.
- `FEATURE-MAP.md` — new feature entry + note the two cross-feature hooks.
- `.claude/rules/browser.md`, `.claude/rules/grid-view.md` — document the new hooks.
- Create `.claude/rules/element-inspector.md`.

---

## Task 1: Pure payload module — `composePrompt` + CSS allowlist (TDD)

**Files:**
- Create: `renderer/features/element-inspector/element-inspector.payload.js`
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
// Run with: node --test renderer/features/element-inspector/element-inspector.payload.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { composePrompt, CAPTURED_CSS_PROPS } = require('./element-inspector.payload.js');

test('CAPTURED_CSS_PROPS is a non-empty array of unique css property names', () => {
  assert.ok(Array.isArray(CAPTURED_CSS_PROPS));
  assert.ok(CAPTURED_CSS_PROPS.length >= 10);
  assert.equal(new Set(CAPTURED_CSS_PROPS).size, CAPTURED_CSS_PROPS.length);
  assert.ok(CAPTURED_CSS_PROPS.includes('background-color'));
  assert.ok(CAPTURED_CSS_PROPS.includes('color'));
});

test('composePrompt embeds instruction, url, selector, html, css and rect', () => {
  const ctx = {
    url: 'http://localhost:3000/',
    selector: 'body > main > button.cta',
    html: '<button class="cta">Buy now</button>',
    css: { 'background-color': 'rgb(255, 255, 255)', color: 'rgb(17, 17, 17)' },
    rect: { x: 420, y: 180, w: 140, h: 44 },
  };
  const out = composePrompt('make this button red', ctx);
  assert.match(out, /make this button red/);
  assert.match(out, /http:\/\/localhost:3000\//);
  assert.match(out, /body > main > button\.cta/);
  assert.match(out, /<button class="cta">Buy now<\/button>/);
  assert.match(out, /background-color: rgb\(255, 255, 255\)/);
  assert.match(out, /x:420 y:180 w:140 h:44/);
});

test('composePrompt tolerates missing css/rect without throwing', () => {
  const out = composePrompt('tweak', { url: 'x', selector: 's', html: '<i></i>' });
  assert.match(out, /tweak/);
  assert.equal(typeof out, 'string');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — `Cannot find module './element-inspector.payload.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// Pure, framework-free payload helpers for the Element Inspector feature.
// Dual-exported: required by node:test AND loaded as a plain <script> in the renderer
// (where it attaches to window via the bottom guard). Mirrors launcher.agents.js.

// Curated subset of computed styles worth sending to the agent. Keeping this small
// keeps the injected prompt readable (getComputedStyle exposes 300+ longhands).
const CAPTURED_CSS_PROPS = [
  'display', 'position', 'box-sizing',
  'width', 'height', 'margin', 'padding', 'border',
  'color', 'background-color', 'background',
  'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
  'flex-direction', 'justify-content', 'align-items', 'gap',
  'grid-template-columns', 'grid-template-rows',
  'border-radius', 'opacity', 'z-index', 'overflow',
];

function composePrompt(instruction, ctx) {
  ctx = ctx || {};
  const lines = [];
  lines.push(`I'm looking at this element on the page ${ctx.url || '(unknown URL)'}`);
  lines.push('');
  lines.push(`My request: ${instruction || '(no instruction given)'}`);
  lines.push('');
  lines.push('--- Element ---');
  lines.push(`Selector: ${ctx.selector || '(unknown)'}`);
  lines.push(ctx.html || '(no markup captured)');
  if (ctx.css && Object.keys(ctx.css).length) {
    lines.push('');
    lines.push('--- Applied styles ---');
    for (const key of Object.keys(ctx.css)) {
      lines.push(`${key}: ${ctx.css[key]};`);
    }
  }
  if (ctx.rect) {
    lines.push('');
    lines.push('--- Position ---');
    lines.push(`x:${ctx.rect.x} y:${ctx.rect.y} w:${ctx.rect.w} h:${ctx.rect.h}`);
  }
  return lines.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { composePrompt, CAPTURED_CSS_PROPS };
}
if (typeof window !== 'undefined') {
  window.ElementInspectorPayload = { composePrompt, CAPTURED_CSS_PROPS };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): pure prompt-composer + css allowlist with tests"
```

---

## Task 2: Picker script builder in the payload module (TDD)

The picker is an IIFE injected into the guest webview via `executeJavaScript`. Because it runs as a string in another context, we BUILD it (and serialize the CSS allowlist into it) in the pure module so the property list has one source of truth and the builder is testable.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js`
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Add failing tests**

Append to `element-inspector.payload.test.js`:

```js
const { buildPickerScript } = require('./element-inspector.payload.js');

test('buildPickerScript returns a string IIFE that mentions our hooks', () => {
  const src = buildPickerScript({ persistent: false });
  assert.equal(typeof src, 'string');
  assert.match(src, /elementFromPoint/);
  assert.match(src, /getBoundingClientRect/);
  assert.match(src, /__retteliInspector/);          // namespace marker on window
  assert.match(src, /background-color/);             // CSS allowlist serialized in
});

test('buildPickerScript persistent flag toggles resolve-vs-stay behavior token', () => {
  assert.match(buildPickerScript({ persistent: true }), /PERSISTENT *= *true/);
  assert.match(buildPickerScript({ persistent: false }), /PERSISTENT *= *false/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — `buildPickerScript is not a function`.

- [ ] **Step 3: Implement `buildPickerScript`**

Add to `element-inspector.payload.js` (before the export guard) and add `buildPickerScript` to BOTH exports:

```js
// Build the self-contained picker IIFE that runs INSIDE the guest webview.
// It must be a string (executeJavaScript runs it in the guest's context, where our
// module scope is unavailable). The result of the last expression is returned to the
// caller via executeJavaScript's promise. We serialize CAPTURED_CSS_PROPS into the
// source so the allowlist stays single-source.
//
// Behavior:
//  - Installs a fixed, pointer-events:none highlight box that tracks mousemove.
//  - capture-phase click → captures {html, css, rect, selector, url}, tears down, resolves.
//  - Esc → tears down, resolves null.
//  - persistent:true keeps the overlay installed across the resolve (sticky select mode):
//    a fresh executeJavaScript call re-arms the click promise without re-installing listeners.
function buildPickerScript(opts) {
  const persistent = !!(opts && opts.persistent);
  const props = JSON.stringify(CAPTURED_CSS_PROPS);
  return `(function () {
  var PERSISTENT = ${persistent};
  var PROPS = ${props};
  var NS = window.__retteliInspector = window.__retteliInspector || {};

  function uniqueSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      var sel = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        sel += '.' + Array.prototype.map.call(node.classList, function (c) { return CSS.escape(c); }).join('.');
      }
      var parent = node.parentElement;
      if (parent) {
        var sibs = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (sibs.length > 1) sel += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
      }
      parts.unshift(sel);
      if (node.id) { parts[0] = '#' + CSS.escape(node.id); break; }
      node = parent;
    }
    return (node === document.body ? 'body > ' : '') + parts.join(' > ');
  }

  function snapshot(el) {
    var cs = getComputedStyle(el);
    var css = {};
    PROPS.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) css[p] = v.trim(); });
    var r = el.getBoundingClientRect();
    var html = el.outerHTML || '';
    if (html.length > 4000) html = html.slice(0, 4000) + '\\n<!-- …truncated… -->';
    return {
      html: html,
      css: css,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      selector: uniqueSelector(el),
      url: location.href,
    };
  }

  function ensureBox() {
    if (NS.box && document.body.contains(NS.box)) return NS.box;
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #34d399;background:rgba(52,211,153,0.18);border-radius:3px;transition:all 0.03s linear;display:none;';
    document.documentElement.appendChild(b);
    NS.box = b;
    return b;
  }

  function teardown() {
    if (NS.onMove) document.removeEventListener('mousemove', NS.onMove, true);
    if (NS.onClick) document.removeEventListener('click', NS.onClick, true);
    if (NS.onKey) document.removeEventListener('keydown', NS.onKey, true);
    if (NS.box && NS.box.parentNode) NS.box.parentNode.removeChild(NS.box);
    NS.box = null; NS.onMove = null; NS.onClick = null; NS.onKey = null; NS.current = null;
  }

  // Re-arm path: listeners already installed (persistent), just return a fresh promise.
  if (NS.installed && PERSISTENT) {
    return new Promise(function (resolve) { NS.resolve = resolve; });
  }

  var box = ensureBox();
  return new Promise(function (resolve) {
    NS.resolve = resolve;
    NS.onMove = function (e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === NS.box) return;
      NS.current = el;
      var r = el.getBoundingClientRect();
      box.style.display = 'block';
      box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
      box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    };
    NS.onClick = function (e) {
      if (!NS.current) return;
      e.preventDefault(); e.stopPropagation();
      var data = snapshot(NS.current);
      if (!PERSISTENT) { teardown(); NS.installed = false; }
      else { box.style.display = 'none'; }
      var r = NS.resolve; NS.resolve = null; if (r) r(data);
    };
    NS.onKey = function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      var r = NS.resolve; NS.resolve = null;
      teardown(); NS.installed = false;
      if (r) r(null);
    };
    document.addEventListener('mousemove', NS.onMove, true);
    document.addEventListener('click', NS.onClick, true);
    document.addEventListener('keydown', NS.onKey, true);
    NS.installed = true;
  });
})();`;
}
```

Also add a teardown-only builder for clean removal when the sticky toggle is switched off:

```js
function buildTeardownScript() {
  return `(function () {
  var NS = window.__retteliInspector; if (!NS) return null;
  if (NS.onMove) document.removeEventListener('mousemove', NS.onMove, true);
  if (NS.onClick) document.removeEventListener('click', NS.onClick, true);
  if (NS.onKey) document.removeEventListener('keydown', NS.onKey, true);
  if (NS.box && NS.box.parentNode) NS.box.parentNode.removeChild(NS.box);
  var r = NS.resolve; NS.resolve = null; if (r) r(null);
  window.__retteliInspector = null;
  return true;
})();`;
}
```

Update both export objects to include `buildPickerScript` and `buildTeardownScript`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): guest picker script builder + teardown (tested)"
```

---

## Task 3: Browser hooks — `captureElement` + `setPickerActive`

**Files:**
- Modify: `renderer/features/browser/browser.renderer.js`

- [ ] **Step 1: Add the two functions inside the IIFE (before `return`)**

Add near `getUrl`/`navigate`:

```js
  // --- Element Inspector seam (added 2026-06-02) ---
  // Only the Browser feature touches the guest <webview>. The inspector feature calls
  // these to run its picker inside the active browser tab's guest page.
  // Script bodies come from ElementInspectorPayload (single source of truth).
  function captureElement(tabId, { persistent } = {}) {
    const wv = webviews.get(tabId);
    if (!wv || typeof window.ElementInspectorPayload === 'undefined') return Promise.resolve(null);
    const src = window.ElementInspectorPayload.buildPickerScript({ persistent: !!persistent });
    try {
      // userGesture=true so the guest treats listener install as gesture-initiated.
      return wv.executeJavaScript(src, true).catch(() => null);
    } catch (_) {
      return Promise.resolve(null);
    }
  }

  function setPickerActive(tabId, active) {
    const wv = webviews.get(tabId);
    if (!wv || typeof window.ElementInspectorPayload === 'undefined') return;
    if (active) return; // arming happens via captureElement; nothing to pre-install
    const src = window.ElementInspectorPayload.buildTeardownScript();
    try { wv.executeJavaScript(src, true).catch(() => {}); } catch (_) {}
  }
```

- [ ] **Step 2: Export them**

Change the return to:

```js
  return { init, getUrl, navigate, captureElement, setPickerActive };
```

- [ ] **Step 3: Verify (manual, in-app)**

The app is already running (do NOT restart it — it hosts this session). Reload the renderer with Ctrl+R inside a focused window if needed, or rely on the next launch. From DevTools console in the renderer:
```js
BrowserFeature.captureElement
```
Expected: `ƒ captureElement(tabId, ...)` — confirms the hook is exported. Full behavior is verified in Task 7.

- [ ] **Step 4: Commit**

```bash
git add renderer/features/browser/browser.renderer.js
git commit -m "feat(browser): captureElement + setPickerActive hooks for element inspector"
```

---

## Task 4: Grid View hook — `pickWindow` select mode

**Files:**
- Modify: `renderer/features/grid-view/grid-view.renderer.js`
- Modify: `renderer/features/grid-view/grid-view.styles.css`

- [ ] **Step 1: Add select-mode state**

In the `state` object at the top, add:

```js
    selectMode: false,
    pickResolve: null,
    banner: null,
```

- [ ] **Step 2: Resolve the pick on tile mousedown**

The existing capture-phase mousedown handler calls `focusTile(panel.dataset.tabId)`. Replace its body with a select-mode branch:

```js
    contentEl.addEventListener('mousedown', (e) => {
      if (!state.active) return;
      const panel = e.target.closest && e.target.closest('.terminal-panel');
      if (!panel) return;
      if (state.selectMode) {
        e.preventDefault();
        e.stopPropagation();
        resolvePick(panel.dataset.tabId);
        return;
      }
      focusTile(panel.dataset.tabId);
    }, true);
```

- [ ] **Step 3: Add `pickWindow`, `resolvePick`, banner helpers (before `isActive`)**

```js
  // --- Element Inspector seam (added 2026-06-02) ---
  // Enter grid in "select window" mode: the next tile click resolves with that tabId
  // instead of focusing. Grid was already entered or not; we ensure it's active, show a
  // banner, and resolve on click (or null on Esc). Grid stays in normal mode afterward.
  function pickWindow() {
    const wasActive = state.active;
    if (!wasActive) enterGrid();
    if (!state.active) return Promise.resolve(null); // enterGrid refused (0 tabs)
    state.selectMode = true;
    showSelectBanner();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); resolvePick(null); }
    };
    state.pickKeyHandler = onKey;
    window.addEventListener('keydown', onKey, true);
    return new Promise((resolve) => { state.pickResolve = resolve; });
  }

  function resolvePick(tabId) {
    if (!state.selectMode) return;
    state.selectMode = false;
    hideSelectBanner();
    if (state.pickKeyHandler) {
      window.removeEventListener('keydown', state.pickKeyHandler, true);
      state.pickKeyHandler = null;
    }
    const r = state.pickResolve; state.pickResolve = null;
    if (tabId) focusTile(tabId);
    if (r) r(tabId || null);
  }

  function showSelectBanner() {
    if (state.banner) return;
    const b = document.createElement('div');
    b.className = 'grid-select-banner';
    b.textContent = 'Click a session to send this task  ·  Esc to cancel';
    contentEl.appendChild(b);
    state.banner = b;
  }

  function hideSelectBanner() {
    if (state.banner && state.banner.parentNode) state.banner.parentNode.removeChild(state.banner);
    state.banner = null;
  }
```

- [ ] **Step 4: Clean up select-mode on forced exit**

In `exitGrid`, after `state.active = false;` add:

```js
    if (state.selectMode) { resolvePick(null); }
```

(Place it as the first line inside `exitGrid` AFTER the `if (!state.active) return;` guard and BEFORE `state.active = false;` so `resolvePick`'s `state.selectMode` check still sees active state — actually call it before flipping active:)

```js
  function exitGrid(opts) {
    if (!state.active) return;
    if (state.selectMode) resolvePick(null);
    opts = opts || {};
    // …rest unchanged…
```

- [ ] **Step 5: Export `pickWindow`**

```js
  return { init, toggle, enterGrid, exitGrid, isActive, focusTile, pickWindow };
```

- [ ] **Step 6: Add banner styles**

Append to `grid-view.styles.css`:

```css
/* Element-inspector "select window" mode banner (added 2026-06-02). */
.grid-select-banner {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646;
  padding: 8px 16px;
  background: var(--accent, #34d399);
  color: #000;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
```

- [ ] **Step 7: Commit**

```bash
git add renderer/features/grid-view/grid-view.renderer.js renderer/features/grid-view/grid-view.styles.css
git commit -m "feat(grid-view): pickWindow select-mode hook + banner for element inspector"
```

---

## Task 5: Inspector renderer — toggle button, prompt box, orchestration

**Files:**
- Create: `renderer/features/element-inspector/element-inspector.renderer.js`

- [ ] **Step 1: Write the feature module**

```js
// Feature: ElementInspector
// Depends on: BrowserFeature (captureElement, setPickerActive), GridViewFeature (pickWindow),
//             TabsFeature (getActiveTabId, getTypeOf), TerminalFeature (—), window.terminalAPI.send
// Provides: ElementInspectorFeature.init()
//
// Flow: sticky crosshair toggle in #sidebar-actions → captureElement on the active browser
// tab → prompt box → Apply → GridViewFeature.pickWindow() → compose prompt → inject into the
// chosen session's PTY (terminalAPI.send), optional trailing Enter (auto-submit).
const ElementInspectorFeature = (function () {
  const state = {
    on: false,         // sticky toggle
    btn: null,
    promptBox: null,
    pendingCtx: null,  // last captured element context awaiting an instruction
    autoSubmit: true,
    busy: false,       // a capture/pick cycle is in flight
  };

  function init() {
    mountToggle();
  }

  function mountToggle() {
    const actions = document.getElementById('sidebar-actions');
    if (!actions) return;
    const btn = document.createElement('button');
    btn.id = 'element-inspector-toggle';
    btn.type = 'button';
    btn.title = 'Pick an element to send to an agent (sticky)';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = '⌖';
    // Insert as the first action so it sits to the LEFT of 📂/Auto/✕ (the green-marked spot).
    actions.insertBefore(btn, actions.firstChild);
    btn.addEventListener('click', toggle);
    state.btn = btn;
  }

  function toggle() {
    state.on = !state.on;
    state.btn.classList.toggle('active', state.on);
    state.btn.setAttribute('aria-pressed', state.on ? 'true' : 'false');
    if (state.on) startPicking();
    else stopPicking();
  }

  function activeBrowserTabId() {
    if (typeof TabsFeature === 'undefined') return null;
    const id = TabsFeature.getActiveTabId();
    if (!id) return null;
    const type = TabsFeature.getTypeOf ? TabsFeature.getTypeOf(id) : null;
    return type === 'browser' ? id : null;
  }

  async function startPicking() {
    const tabId = activeBrowserTabId();
    if (!tabId) { hint('Open a browser tab and view your page first'); return; }
    if (state.busy) return;
    state.busy = true;
    try {
      // persistent:true keeps select mode alive across picks (sticky toggle).
      const ctx = await BrowserFeature.captureElement(tabId, { persistent: true });
      if (!state.on) return;        // toggled off mid-pick
      if (!ctx) { state.busy = false; return; } // Esc/cancel inside guest
      state.pendingCtx = ctx;
      showPromptBox(ctx);
    } finally {
      state.busy = false;
    }
  }

  function stopPicking() {
    const tabId = activeBrowserTabId();
    if (tabId) BrowserFeature.setPickerActive(tabId, false);
    hidePromptBox();
    state.pendingCtx = null;
  }

  function showPromptBox(ctx) {
    hidePromptBox();
    const box = document.createElement('div');
    box.className = 'ei-prompt-box';
    box.innerHTML =
      '<div class="ei-prompt-head">Describe the change</div>' +
      '<div class="ei-prompt-target"></div>' +
      '<textarea class="ei-prompt-input" rows="3" placeholder="e.g. make this button red"></textarea>' +
      '<label class="ei-prompt-submit"><input type="checkbox" class="ei-auto" ' + (state.autoSubmit ? 'checked' : '') + ' /> Send with Enter (run immediately)</label>' +
      '<div class="ei-prompt-actions">' +
      '<button class="ei-cancel" type="button">Cancel</button>' +
      '<button class="ei-apply" type="button">Apply →</button>' +
      '</div>';
    document.body.appendChild(box);
    state.promptBox = box;

    box.querySelector('.ei-prompt-target').textContent = ctx.selector || ctx.url || '';
    const input = box.querySelector('.ei-prompt-input');
    const auto = box.querySelector('.ei-auto');
    input.focus();

    box.querySelector('.ei-cancel').addEventListener('click', () => { hidePromptBox(); resumePicking(); });
    box.querySelector('.ei-apply').addEventListener('click', () => {
      state.autoSubmit = auto.checked;
      apply(input.value.trim());
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); state.autoSubmit = auto.checked; apply(input.value.trim()); }
      if (e.key === 'Escape') { e.preventDefault(); hidePromptBox(); resumePicking(); }
    });
  }

  function hidePromptBox() {
    if (state.promptBox && state.promptBox.parentNode) state.promptBox.parentNode.removeChild(state.promptBox);
    state.promptBox = null;
  }

  // After cancel, re-arm the guest picker so the next hover/click works (sticky).
  function resumePicking() {
    if (state.on) startPicking();
  }

  async function apply(instruction) {
    if (!instruction) { hint('Type what you want changed first'); return; }
    const ctx = state.pendingCtx;
    if (!ctx) return;
    hidePromptBox();

    if (typeof GridViewFeature === 'undefined' || !GridViewFeature.pickWindow) {
      hint('Grid view unavailable'); return;
    }
    const targetTabId = await GridViewFeature.pickWindow();
    if (!targetTabId) { resumePicking(); return; } // cancelled the window pick

    const text = window.ElementInspectorPayload.composePrompt(instruction, ctx);
    const payload = text + (state.autoSubmit ? '\r' : '');
    try {
      window.terminalAPI.send(targetTabId, payload);
    } catch (_) { /* ignore */ }

    // Sticky: stay on, re-arm the picker for the next element.
    resumePicking();
  }

  function hint(msg) {
    // Lightweight transient hint anchored to the toggle button.
    if (!state.btn) return;
    let h = document.getElementById('ei-hint');
    if (!h) {
      h = document.createElement('div');
      h.id = 'ei-hint';
      document.body.appendChild(h);
    }
    h.textContent = msg;
    const r = state.btn.getBoundingClientRect();
    h.style.top = (r.bottom + 6) + 'px';
    h.style.left = Math.max(6, r.right - 220) + 'px';
    h.classList.add('show');
    clearTimeout(h._t);
    h._t = setTimeout(() => h.classList.remove('show'), 2200);
  }

  return { init };
})();
```

- [ ] **Step 2: Verify the file parses**

Run: `node --check renderer/features/element-inspector/element-inspector.renderer.js`
Expected: no output (exit 0) — syntactically valid.

- [ ] **Step 3: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.renderer.js
git commit -m "feat(element-inspector): renderer orchestration (toggle, prompt box, apply→pick→inject)"
```

---

## Task 6: Styles + wiring (index.html, app.js, CSS)

**Files:**
- Create: `renderer/features/element-inspector/element-inspector.styles.css`
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`

- [ ] **Step 1: Write the stylesheet**

```css
/* Element Inspector feature styles (added 2026-06-02). */

/* Toggle button — matches the 22×22 icon buttons in #sidebar-actions. */
#element-inspector-toggle {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.18));
  color: var(--text-dim, #cccccc);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  border-radius: 5px;
  line-height: 1;
  transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.12s;
}
#element-inspector-toggle:hover {
  background: var(--accent-soft, rgba(52, 211, 153, 0.15));
  border-color: var(--accent-border, rgba(52, 211, 153, 0.4));
  color: var(--text, #fff);
  transform: translateY(-1px);
}
#element-inspector-toggle.active {
  background: var(--accent, #34d399);
  border-color: var(--accent, #34d399);
  color: #000;
}

/* Floating "describe the change" box. */
.ei-prompt-box {
  position: fixed;
  top: 64px;
  right: 16px;
  z-index: 2147483646;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(18, 18, 20, 0.98);
  border: 1px solid var(--accent, #34d399);
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
}
.ei-prompt-head { font-size: 12px; font-weight: 700; color: var(--text, #fff); }
.ei-prompt-target {
  font-size: 10px;
  color: var(--text-dim, #aaa);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ei-prompt-input {
  resize: vertical;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 4px;
  color: var(--text, #fff);
  font-size: 12px;
  padding: 6px;
  font-family: inherit;
}
.ei-prompt-input:focus { outline: none; border-color: var(--accent, #34d399); }
.ei-prompt-submit { font-size: 11px; color: var(--text-dim, #ccc); display: flex; align-items: center; gap: 6px; cursor: pointer; }
.ei-prompt-actions { display: flex; justify-content: flex-end; gap: 8px; }
.ei-prompt-actions button {
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 5px;
  cursor: pointer;
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.18));
  background: transparent;
  color: var(--text, #fff);
}
.ei-prompt-actions .ei-apply { background: var(--accent, #34d399); border-color: var(--accent, #34d399); color: #000; font-weight: 700; }

/* Transient hint toast. */
#ei-hint {
  position: fixed;
  z-index: 2147483647;
  max-width: 220px;
  padding: 7px 11px;
  background: rgba(18, 18, 20, 0.98);
  border: 1px solid var(--accent, #34d399);
  border-radius: 6px;
  color: var(--text, #fff);
  font-size: 11px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.15s, transform 0.15s;
  pointer-events: none;
}
#ei-hint.show { opacity: 1; transform: translateY(0); }
```

- [ ] **Step 2: Add the stylesheet `<link>` to `index.html`**

After the `launcher.styles.css` link (line ~19):

```html
  <link rel="stylesheet" href="features/element-inspector/element-inspector.styles.css">
```

- [ ] **Step 3: Add the `<script>` tags to `index.html`**

After the `grid-view.renderer.js` script line and before `app.js`:

```html
  <script src="features/element-inspector/element-inspector.payload.js"></script>
  <script src="features/element-inspector/element-inspector.renderer.js"></script>
```

- [ ] **Step 4: Initialize in `app.js`**

After `GridViewFeature.init();`:

```js
  ElementInspectorFeature.init();
```

- [ ] **Step 5: Verify wiring**

Run: `node --check renderer/app.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.styles.css renderer/index.html renderer/app.js
git commit -m "feat(element-inspector): styles + wire scripts/link/init"
```

---

## Task 7: Manual end-to-end verification

The dev app hosts this session — DO NOT `npm start`/restart/kill it. Verify by reloading the renderer (Ctrl+R in a focused app window) or on the user's next manual launch.

- [ ] **Step 1: Toggle appears**

Open the right sidebar. Confirm a crosshair (⌖) button sits to the LEFT of 📂/Auto/✕ in the sidebar actions row (the green-marked spot in `images/Terminal123.png`).

- [ ] **Step 2: Guard when no browser tab**

With a terminal/agent tab active (not a browser tab), click the crosshair. Expected: hint toast "Open a browser tab and view your page first"; toggle returns to off-state behavior (no picker armed).

- [ ] **Step 3: Pick an element**

Open a Brave/browser tab, navigate to any page (e.g. the Brave landing or a localhost app). Click the crosshair ON. Move the mouse over the page — a green highlight box tracks elements. Click one. Expected: the page does NOT navigate; the "Describe the change" box appears with the selector shown.

- [ ] **Step 4: Apply → select window**

Type "make this red", leave "Send with Enter" checked, click Apply →. Expected: grid view opens with a green banner "Click a session to send this task". Tiles are agent sessions only (no browser tab).

- [ ] **Step 5: Inject**

Click an agent (Claude/Codex) session tile. Expected: grid focuses that tile; the composed prompt (instruction + selector + outerHTML + applied styles + position) is typed into that session and submitted (trailing Enter). The crosshair toggle is STILL on (sticky) — moving the mouse over the browser again re-highlights.

- [ ] **Step 6: Auto-submit off**

Pick another element, type an instruction, UNCHECK "Send with Enter", Apply, pick a session. Expected: prompt is typed into the session but NOT submitted (no trailing newline) — user can edit before pressing Enter.

- [ ] **Step 7: Esc + toggle-off teardown**

Mid-hover, press Esc in the page → highlight disappears. Click the crosshair OFF → `setPickerActive(false)` tears down the guest overlay and namespace. Confirm no lingering green box and the page is interactive again.

- [ ] **Step 8: Commit verification notes (no code change)**

If all steps pass, the feature is complete. If any step fails, debug with `superpowers:systematic-debugging` before claiming completion.

---

## Task 8: Docs — FEATURE-MAP + rules files

**Files:**
- Modify: `FEATURE-MAP.md`
- Modify: `.claude/rules/browser.md`
- Modify: `.claude/rules/grid-view.md`
- Create: `.claude/rules/element-inspector.md`

- [ ] **Step 1: Add the FEATURE-MAP entry**

Add a new `## Element Inspector (cross-cutting)` section near Grid View, listing files, the two cross-feature hooks (`BrowserFeature.captureElement`/`setPickerActive`, `GridViewFeature.pickWindow`), dependency on `terminalAPI.send`, and "Safe to Edit Alone: NO — coordinate with Browser + Grid View".

- [ ] **Step 2: Note the hooks in `browser.md` and `grid-view.md`**

In `browser.md`, add `captureElement(tabId, {persistent})` and `setPickerActive(tabId, active)` to the consumed/public surface, noting the Element Inspector feature is the consumer and the script bodies come from `ElementInspectorPayload`.

In `grid-view.md`, add `pickWindow()` to the "Consumed by" public surface (consumer: Element Inspector), noting select-mode resolves on the next tile click and stays normal-mode afterward.

- [ ] **Step 3: Create `.claude/rules/element-inspector.md`**

Document: files owned, the dependency hooks (Browser, Grid View, TabsFeature reads, `terminalAPI.send`), the sticky-toggle invariant, the single-source-of-truth rule for the guest script (`element-inspector.payload.js`), and "DO NOT edit other features' files; request cross-feature hooks instead."

- [ ] **Step 4: Update the design doc status + commit all docs**

```bash
git add FEATURE-MAP.md .claude/rules/browser.md .claude/rules/grid-view.md .claude/rules/element-inspector.md
git commit -m "docs(element-inspector): FEATURE-MAP entry + feature rules + cross-feature hook notes"
```

---

## Self-Review Notes

- **Spec coverage:** toggle in `#sidebar-actions` (Task 5/6) ✓; sticky toggle (Task 5 `state.on` + `resumePicking`) ✓; DevTools hover-highlight picker (Task 2 guest script) ✓; capture html/css/rect/selector/url (Task 2 `snapshot`) ✓; prompt box + auto-submit toggle (Task 5) ✓; grid "select window" + agent-only tiles (Task 4; browser tabs already excluded by grid CSS) ✓; PTY injection via `terminalAPI.send` (Task 5 `apply`) ✓; error handling — non-browser tab, capture-null, zero sessions (Task 4 `pickWindow` returns null if `enterGrid` refused on 0 tabs), Esc teardown (Tasks 2/4/5) ✓; one hook each on Browser + Grid View (Tasks 3/4) ✓; feature isolation + docs (Task 8) ✓.
- **Placeholder scan:** all code steps contain full code; no TBD/TODO. ✓
- **Type consistency:** `composePrompt(instruction, ctx)`, `buildPickerScript({persistent})`, `buildTeardownScript()`, `CAPTURED_CSS_PROPS` consistent across Tasks 1–3, 5. `captureElement(tabId, {persistent})` / `setPickerActive(tabId, active)` consistent Tasks 3, 5. `pickWindow()` consistent Tasks 4, 5. `ctx` shape `{html, css, rect:{x,y,w,h}, selector, url}` consistent across guest snapshot (Task 2), composePrompt test (Task 1), and renderer (Task 5). ✓
