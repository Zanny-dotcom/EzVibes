# Element Inspector — Source-Locator Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Element Inspector capture *source-locating* signals (visible text, authored attributes, authored CSS rules, a smart-target ancestor, and many fallbacks) so the agent receiving the injected prompt can find the exact place in the page's source code for **any** clicked element — and never be misled by render-time values.

**Architecture:** All changes stay inside one pure, dual-exported, `node:test`-covered module — `renderer/features/element-inspector/element-inspector.payload.js` — and its test file. Two seams: `composePrompt(instruction, ctx)` (renderer-side formatter; the testable bulk) and `snapshot(el)` (a string injected into the guest webview via `executeJavaScript`; captures the new fields). No new IPC, no main-process code, no edits to other features. Every `ctx` field is additive and optional; existing keys (`html`, `css`, `rect`, `selector`, `url`) keep their exact shapes so all 6 existing tests pass untouched.

**Tech Stack:** Vanilla JS (CommonJS in the node-tested module, IIFE-string for the guest body), `node:test` + `node:assert/strict`, Electron `<webview>.executeJavaScript`. No new dependencies.

**Reference:** Design spec at `docs/2026-06-02-element-inspector-source-locator-design.md`. Read it first — it has the full field table, the example composed prompt, and the open risks. This plan implements that spec.

---

## Orientation (read before Task 1)

The module today (`renderer/features/element-inspector/element-inspector.payload.js`) exports four things: `composePrompt`, `CAPTURED_CSS_PROPS`, `buildPickerScript`, `buildTeardownScript`. Key facts:

- `composePrompt(instruction, ctx)` builds a plain-text string from `ctx` and returns it. **Pure** — fully unit-testable.
- `buildPickerScript(opts)` returns a **string** — an IIFE that runs inside the guest webview. Inside it, `snapshot(el)` (a function defined *within that string*) captures `{html, css, rect, selector, url}`. The CSS allowlist is serialized into the string via `JSON.stringify(CAPTURED_CSS_PROPS)` as `PROPS`. The string body **cannot run under `node:test`**, so we test it at the **string level** (assert the source contains the right tokens) plus **manual in-app** verification.
- A single uncaught throw in `snapshot()` rejects the whole `executeJavaScript` promise → the user's click silently does nothing. **Every new capture must be individually try/caught.**
- The renderer (`element-inspector.renderer.js`) passes `ctx` straight through to `composePrompt` with no enrichment — so we touch neither it nor any other file.

**Build order rationale:** We build `composePrompt` first (Tasks 1–6), because it's pure and test-drivable, and its expected output *defines* exactly which `ctx` fields `snapshot()` must produce. Then we extend `snapshot()` (Tasks 7–10) to produce those fields, tested at string level. Task 11 is manual end-to-end verification. Task 12 is docs.

**A note on testing `composePrompt`:** every new section is gated on its field (`if (ctx.text) {...}`), mirroring the existing `if (ctx.css && Object.keys(ctx.css).length)`. Tests build a `ctx` object literal and assert on the returned string. This needs **no** browser.

---

## File Structure

- **Modify:** `renderer/features/element-inspector/element-inspector.payload.js`
  - Rewrite `composePrompt` into a sectioned builder (helpers + ranked hooks + labelled blocks + honest-failure path).
  - Extend `snapshot()` (inside `buildPickerScript`) with `snapNode()` and the new captures; add serialized constants (`MEANINGFUL_SELECTOR`, `ATTR_ALLOWLIST`, `LOC_ATTRS`, caps) and string-embedded helpers.
- **Modify:** `renderer/features/element-inspector/element-inspector.payload.test.js`
  - Add `composePrompt` behaviour tests (Tasks 1–6) and `buildPickerScript` string-level tests (Tasks 7–10).
- **Docs only (Task 12):** one-line notes in `FEATURE-MAP.md` and `.claude/rules/element-inspector.md`.

No other files.

---

## Conventions for every task

- Run tests from the repo root with: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
- Code style (from CLAUDE.md): CommonJS, semicolons, single quotes, camelCase functions, 2-space indent.
- The new `composePrompt` keeps the **existing** header lines and the `css`/`rect`/`selector`/`html` blocks (re-labelled/reordered) so the 6 existing tests keep passing. **Do not tighten or delete existing tests.**
- Commit after each task with the message shown.

---

## Task 1: Sectioned `composePrompt` skeleton + FIND-IN-SOURCE directive

Rebuild `composePrompt` as an ordered list of section-emitters, preserving existing output, and add the new top-of-prompt directive. This task changes structure without yet adding hooks, so the 3 existing `composePrompt` assertions must still pass.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js` (the `composePrompt` function)
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

Append to the test file:

```js
test('composePrompt emits the FIND-IN-SOURCE directive and keeps the header', () => {
  const out = composePrompt('make it red', { url: 'http://localhost:3000/', selector: 's', html: '<i></i>' });
  assert.match(out, /I'm looking at this element on the page http:\/\/localhost:3000\//);
  assert.match(out, /My request: make it red/);
  assert.match(out, /FIND THIS IN THE SOURCE/);
  assert.match(out, /do NOT/i);            // the "don't grep computed/selector" steer
  assert.match(out, /rg -F/);              // ripgrep convention mentioned
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — the new test errors (no `FIND THIS IN THE SOURCE` in output). The 5 existing tests still pass.

- [ ] **Step 3: Write minimal implementation**

Replace the entire `composePrompt` function with this sectioned version. (Later tasks add more `push*` sections; this establishes the skeleton + directive and preserves the existing blocks.)

```js
function composePrompt(instruction, ctx) {
  ctx = ctx || {};
  const L = [];

  // 1. Header + instruction (unchanged — existing tests assert these).
  L.push(`I'm looking at this element on the page ${ctx.url || '(unknown URL)'}`);
  L.push('');
  L.push(`My request: ${instruction || '(no instruction given)'}`);
  L.push('');

  // 2. Find-in-source directive.
  L.push('=== FIND THIS IN THE SOURCE ===');
  L.push(
    'This page is served from THIS folder, so its source is on disk and grep-able. Locate the EXACT ' +
    'source of this element using the ranked SEARCH HOOKS below — search by text/attributes/authored-CSS, ' +
    'NOT by the computed rgb() values or the live DOM selector (those are how it renders, not what the ' +
    'source says). Use ripgrep; prefer fixed-string (rg -F), and if an exact match returns nothing, widen ' +
    'to a distinctive substring or retry case-insensitively (rg -iF).');
  L.push('');

  // (Search hooks, smart target, repeated-element, recovery, authored CSS — added in later tasks.)

  // 8. Computed styles — KEPT for back-compat, re-labelled "do NOT grep".
  if (ctx.css && Object.keys(ctx.css).length) {
    L.push('--- COMPUTED (rendered) values — NOT source; do NOT grep these ---');
    L.push('(these are how it looks now; source likely uses a variable/class — e.g. do NOT grep rgb(...), source may say var(--gold))');
    for (const key of Object.keys(ctx.css)) {
      L.push(`${key}: ${ctx.css[key]};`);
    }
    L.push('');
  }

  // 9. Raw markup — KEPT, de-emphasized.
  if (ctx.html) {
    L.push('--- Raw markup (for entity encodings like &copy; and nested structure) ---');
    L.push(ctx.html);
    L.push('');
  }

  // 10. Orientation only — selector + position at the very bottom.
  L.push('--- Orientation only (NOT a source path) ---');
  L.push(`Selector (live rendered-DOM position, not source): ${ctx.selector || '(unknown)'}`);
  if (ctx.rect) {
    L.push(`Position: x:${ctx.rect.x} y:${ctx.rect.y} w:${ctx.rect.w} h:${ctx.rect.h}`);
  }

  return L.join('\n');
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — the new test passes; the existing `composePrompt embeds instruction, url, selector, html, css and rect` test still passes (selector, html, css value, rect, instruction, url are all still present), and `tolerates missing css/rect` still passes.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "refactor(element-inspector): sectioned composePrompt + find-in-source directive"
```

---

## Task 2: Ranked SEARCH HOOKS (text, label, attrs, class stems, tag)

Add the ranked hooks block — the heart of the fix. Each non-empty signal becomes a numbered line with a ready `rg` command.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js`
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('composePrompt ranks visible text first with an rg command', () => {
  const out = composePrompt('x', { text: 'Stay Updated', classes: ['nav-cta'], tag: 'a' });
  assert.match(out, /Search hooks/i);
  assert.match(out, /Stay Updated/);
  assert.match(out, /rg -F "Stay Updated"/);
});

test('composePrompt uses directText when text is not a literal candidate', () => {
  const out = composePrompt('x', { text: 'Plans for teams', directText: 'for teams', textIsLiteralCandidate: false, tag: 'h2' });
  assert.match(out, /rg -F "for teams"/);          // the contiguous segment, not the phantom join
});

test('composePrompt falls back to accessible label when text is empty', () => {
  const out = composePrompt('x', { text: '', accLabel: 'Search', tag: 'button' });
  assert.match(out, /Search/);
  assert.match(out, /label/i);
});

test('composePrompt surfaces literal href and data-testid as hooks', () => {
  const out = composePrompt('x', { text: 'Home', attrs: { href: '/about', 'data-testid': 'nav-home' } });
  assert.match(out, /rg -F 'href="\/about"'/);
  assert.match(out, /data-testid/);
  assert.match(out, /nav-home/);
});

test('composePrompt downranks hashed classes and suggests the stem', () => {
  const out = composePrompt('x', { text: '', classes: ['Card_link__a1b2c'], classHints: { hashed: ['Card_link__a1b2c'], utility: [], stems: ['Card', 'link'] } });
  assert.match(out, /Card/);
  assert.match(out, /build-generated|stem/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — no "Search hooks" section yet.

- [ ] **Step 3: Write minimal implementation**

Add a helper near the top of the module (above `composePrompt`), and insert the hooks section into `composePrompt` right after the FIND-IN-SOURCE directive block (where the comment `// (Search hooks, ...)` is).

Helper (module scope):

```js
// Quote a value for an `rg -F` command, choosing single/double quotes so the value's
// own quotes don't break the command. Used to print ready-to-run search commands.
function rgFixed(value) {
  if (value == null) return '';
  const s = String(value);
  return s.indexOf('"') === -1 ? `rg -F "${s}"` : `rg -F '${s}'`;
}
```

Hooks section (replace the `// (Search hooks, ...)` comment line):

```js
  // 3. Ranked search hooks — only non-empty lines.
  const hooks = [];
  let n = 0;
  const primaryText = (ctx.textIsLiteralCandidate === false && ctx.directText) ? ctx.directText : ctx.text;
  if (primaryText) {
    hooks.push(`${++n}. Visible text (PRIMARY):  "${primaryText}"`);
    hooks.push(`     ${rgFixed(primaryText)}`);
  } else if (ctx.accLabel) {
    hooks.push(`${++n}. Accessible label (no visible text):  "${ctx.accLabel}"`);
    hooks.push(`     ${rgFixed(ctx.accLabel)}`);
  } else if (ctx.labelText) {
    hooks.push(`${++n}. Form label:  "${ctx.labelText}"`);
    hooks.push(`     ${rgFixed(ctx.labelText)}`);
  }
  const a = ctx.attrs || {};
  const PRECISION_ATTRS = ['data-testid', 'data-component', 'href', 'to', 'name', 'value', 'placeholder', 'alt'];
  for (const key of PRECISION_ATTRS) {
    if (a[key]) {
      hooks.push(`${++n}. Attribute ${key}="${a[key]}":`);
      hooks.push(`     ${rgFixed(`${key}="${a[key]}"`)}`);
    }
  }
  if (ctx.iconRef) {
    hooks.push(`${++n}. SVG sprite id ${ctx.iconRef} (grep the matching <symbol id> / icon name):`);
    hooks.push(`     ${rgFixed(ctx.iconRef.replace(/^#/, ''))}`);
  }
  if (ctx.asset && ctx.asset.basename) {
    hooks.push(`${++n}. Asset filename "${ctx.asset.basename}" (source uses a relative path/import with this name; do NOT grep the full rendered URL):`);
    hooks.push(`     ${rgFixed(ctx.asset.basename)}`);
  }
  const stems = (ctx.classHints && ctx.classHints.stems) || [];
  const plainClasses = (ctx.classes || []).filter((c) => {
    const hashed = (ctx.classHints && ctx.classHints.hashed) || [];
    const util = (ctx.classHints && ctx.classHints.utility) || [];
    return hashed.indexOf(c) === -1 && util.indexOf(c) === -1;
  });
  const classKeys = (stems.length ? stems : plainClasses);
  if (classKeys.length) {
    hooks.push(`${++n}. Class stem(s) (maybe build-generated — skip hash-like tokens; atomic utilities are not selective):  ${classKeys.join(', ')}`);
    hooks.push(`     ${rgFixed(classKeys[0])}`);
  }
  if (ctx.tag) {
    let tagLine = `${++n}. Tag: ${ctx.tag}`;
    if (ctx.tag === 'a') tagLine += '  (heads-up: a DOM <a> may be a framework <Link>/<router-link>/<NavLink> — bridge via the href hook above)';
    if (ctx.isCustomElement) tagLine += `  (custom element — grep customElements.define("${ctx.tag}"))`;
    hooks.push(tagLine);
  }
  if (hooks.length) {
    L.push('--- Search hooks (ranked; try top-down) ---');
    for (const line of hooks) L.push(line);
    L.push('');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — all new hook tests pass; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): ranked search hooks (text/label/attrs/class-stems/tag)"
```

---

## Task 3: Smart-target pair + source ground-truth line

Print the "clicked node vs nearest container" pair, and a ground-truth "OPEN DIRECTLY" line when `source` carries a file path.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js`
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('composePrompt prints a smart-target pair (clicked vs container)', () => {
  const ctx = {
    text: 'Stay Updated', tag: 'span', classes: ['label'],
    ancestor: { tag: 'a', classes: ['nav-cta'], text: 'Stay Updated', attrs: { href: '#newsletter' } },
  };
  const out = composePrompt('x', ctx);
  assert.match(out, /Smart target/i);
  assert.match(out, /Clicked node/);
  assert.match(out, /Nearest .*container/i);
  assert.match(out, /nav-cta/);
  assert.match(out, /href="#newsletter"/);
});

test('composePrompt prints OPEN DIRECTLY when source has a file path', () => {
  const out = composePrompt('x', { text: 'Hi', source: { file: 'src/components/Hero.vue', line: 42 } });
  assert.match(out, /OPEN DIRECTLY|ground truth/i);
  assert.match(out, /src\/components\/Hero\.vue/);
});

test('composePrompt prints component name when source has no file', () => {
  const out = composePrompt('x', { text: 'Hi', source: { component: 'NavCta' } });
  assert.match(out, /NavCta/);
  assert.match(out, /component/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — no smart-target / source lines yet.

- [ ] **Step 3: Write minimal implementation**

Insert into `composePrompt` immediately after the hooks block (after its closing `L.push('')`).

```js
  // 3d. Source ground-truth / component (printed as a high-value hook when present).
  if (ctx.source && (ctx.source.file || ctx.source.component)) {
    L.push('--- Source hint ---');
    if (ctx.source.file) {
      const loc = ctx.source.line != null ? `${ctx.source.file}:${ctx.source.line}` : ctx.source.file;
      L.push(`OPEN DIRECTLY (ground truth): ${loc}`);
    }
    if (ctx.source.component) {
      L.push(`Framework component: <${ctx.source.component}> — grep its definition, e.g. ${rgFixed(ctx.source.component)}`);
    }
    L.push('');
  }

  // 4. Smart-target pair.
  if (ctx.ancestor) {
    const anc = ctx.ancestor;
    const ancHref = anc.attrs && anc.attrs.href ? ` href="${anc.attrs.href}"` : '';
    const selfClasses = (ctx.classes && ctx.classes.length) ? '.' + ctx.classes.join('.') : '';
    const ancClasses = (anc.classes && anc.classes.length) ? '.' + anc.classes.join('.') : '';
    L.push('--- Smart target (you may have clicked inside the element you mean) ---');
    L.push(`Clicked node:      <${ctx.tag || '?'}${selfClasses}>  text:"${ctx.text || ''}"`);
    L.push(`Nearest container: <${anc.tag || '?'}${ancClasses}${ancHref}>  text:"${anc.text || ''}"   <- most likely the element you mean to edit`);
    if (anc.attrs && anc.attrs.href) {
      L.push(`     literal href hook:  ${rgFixed(`href="${anc.attrs.href}"`)}   (authored relative value, not the resolved URL)`);
    }
    L.push('');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): smart-target pair + source ground-truth line"
```

---

## Task 4: Repeated-element block + interpolation/i18n recovery

Add the duplicate-disambiguation block (only when there are repeats) and the always-present recovery block.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js`
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('composePrompt adds repeated-element block only when there are repeats', () => {
  const single = composePrompt('x', { text: 'Read more', siblingIndex: { self: { index: 0, of: 1 }, repeatedAncestor: null } });
  assert.doesNotMatch(single, /item \d+ of \d+/i);

  const dup = composePrompt('x', {
    text: 'Read more',
    siblingIndex: { self: { index: 36, of: 50 }, repeatedAncestor: { tag: 'article', cls: 'card', index: 36, of: 50 } },
    rowContext: ['Acme Corp', 'Active', '2026-06-01'],
  });
  assert.match(dup, /item 37 of 50/i);          // index 36 -> human "37"
  assert.match(dup, /Acme Corp/);                // the distinctive row value
  assert.match(dup, /data index|not a CSS/i);
});

test('composePrompt always includes an interpolation/i18n recovery block', () => {
  const out = composePrompt('x', { text: 'Hi' });
  assert.match(out, /isn't found as a literal|interpolat/i);
  assert.match(out, /\.map\(\)|v-for|for /);
  assert.match(out, /--glob/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — neither block present.

- [ ] **Step 3: Write minimal implementation**

Insert into `composePrompt` after the smart-target block.

```js
  // 5. Repeated-element block (only when duplicates exist).
  const si = ctx.siblingIndex;
  const rep = si && (si.repeatedAncestor || (si.self && si.self.of > 1));
  if (rep) {
    const r = si.repeatedAncestor || si.self;
    const human = (r.index != null ? r.index + 1 : '?');
    const of = (r.of != null ? r.of : '?');
    const what = si.repeatedAncestor ? `${si.repeatedAncestor.tag}.${si.repeatedAncestor.cls}` : 'sibling';
    L.push('--- Repeated element ---');
    L.push(`This is item ${human} of ${of} (${what}). Treat ${human} as a DATA index, NOT a CSS :nth position — in source there is likely ONE looped template/array, not ${of} unique elements.`);
    L.push('To edit ONE instance, find its data entry; to restyle ALL, edit the shared rule/template.');
    if (ctx.rowContext && ctx.rowContext.length) {
      L.push(`Sibling/row context — grep the MOST DISTINCTIVE value to find this row: ${ctx.rowContext.map((v) => `"${v}"`).join(', ')}`);
    }
    L.push('');
  }

  // 6. Interpolation / i18n recovery (always present).
  L.push('--- If a text hook isn\'t found as a literal ---');
  L.push(
    'It may be interpolated, loop-rendered, or i18n-keyed. Then: (1) search by tag+class/component instead; ' +
    '(2) retry case-insensitively / as a property value (rg -iF); (3) if you find it only in a locale file, grep ' +
    'the KEY (e.g. nav.stayUpdated) to find usages; (4) find the .map()/v-for/{#each}/{% for %} that emits this ' +
    'element; (5) widen to data files: --glob *.{js,ts,json,yaml,yml,md,mdx}.');
  if (ctx.textIsLiteralCandidate === false) {
    L.push('(NOTE: this element\'s text is assembled from multiple children or interpolated — an exact full-text grep will likely miss; use the contiguous segment above or a structural hook.)');
  }
  L.push('');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): repeated-element disambiguation + i18n recovery block"
```

---

## Task 5: Authored CSS block + honest cross-origin fallback

Print `matchedRules` (authored CSS — the anti-mislead headline) above the computed block, and the honest cross-origin message when stylesheets were unreadable.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js`
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('composePrompt prints AUTHORED CSS from matchedRules above computed', () => {
  const ctx = {
    text: 'Stay Updated',
    matchedRules: [{ selector: '.nav-cta', css: 'background: var(--gold); color: #0b0b0b;' }],
    css: { 'background-color': 'rgb(201, 168, 76)' },
  };
  const out = composePrompt('x', ctx);
  assert.match(out, /AUTHORED CSS/);
  assert.match(out, /background: var\(--gold\)/);
  // authored block must appear BEFORE the computed block
  assert.ok(out.indexOf('AUTHORED CSS') < out.indexOf('COMPUTED (rendered)'));
});

test('composePrompt emits honest cross-origin block when stylesheets blocked', () => {
  const ctx = {
    text: 'Buy', matchedRules: [], cssCrossOrigin: true,
    stylesheetsBlocked: ['https://cdn.tailwindcss.com/styles.css'],
  };
  const out = composePrompt('x', ctx);
  assert.match(out, /cross-origin|off-disk|CDN/i);
  assert.match(out, /cdn\.tailwindcss\.com/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — no AUTHORED CSS block.

- [ ] **Step 3: Write minimal implementation**

Insert into `composePrompt` **before** the existing computed-CSS block (i.e., before `// 8. Computed styles`).

```js
  // 7. Authored CSS (matchedRules) — the anti-mislead headline; print ABOVE computed.
  if (ctx.matchedRules && ctx.matchedRules.length) {
    L.push('--- AUTHORED CSS (from the page\'s own stylesheets — GREP THESE tokens, e.g. var(--gold)) ---');
    for (const r of ctx.matchedRules) {
      L.push(`${r.selector} { ${r.css} }`);
    }
    L.push('(Edit the variable or this rule. Do NOT grep the computed rgb() values below.)');
    L.push('');
  } else if (ctx.cssCrossOrigin) {
    L.push('--- Styling is off-disk (cross-origin stylesheets) ---');
    const origins = (ctx.stylesheetsBlocked || []).join(', ') || '(external CDN)';
    L.push(`The element's CSS comes from cross-origin stylesheets this tool can't read: ${origins}. ` +
      'Do NOT grep the computed values below. Grep the class list / your Tailwind/Bootstrap config / build setup instead.');
    L.push('');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — note the existing test asserting `background-color: rgb(255, 255, 255)` is still present (computed block unchanged); ordering assertion passes.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): authored-CSS block + honest cross-origin fallback"
```

---

## Task 6: Honest-failure override (no greppable signal)

When `ctx` has no greppable signal, replace the confident directive with a warning and weak-anchors-only guidance. This is the "never mislead" guarantee.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js`
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('composePrompt warns (no fabricated hook) when nothing is greppable', () => {
  // a bare decorative div: no text, only a hashed class, no attrs/label/asset
  const ctx = {
    tag: 'div',
    classes: ['sc-a1b2c3'],
    classHints: { hashed: ['sc-a1b2c3'], utility: [], stems: [] },
    css: { opacity: '1' },
    rect: { x: 0, y: 0, w: 10, h: 10 },
    selector: 'body > div.sc-a1b2c3',
  };
  const out = composePrompt('x', ctx);
  assert.match(out, /no reliable source-greppable signal/i);
  assert.match(out, /do NOT guess/i);
  assert.doesNotMatch(out, /rg -F "/);     // no fabricated fixed-string hook line
});

test('composePrompt keeps confident framing when a signal exists', () => {
  const out = composePrompt('x', { text: 'Hello world' });
  assert.match(out, /FIND THIS IN THE SOURCE/);
  assert.doesNotMatch(out, /no reliable source-greppable signal/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — the bare-div case still prints the confident directive and may print a class stem hook.

- [ ] **Step 3: Write minimal implementation**

Add a greppability helper at module scope:

```js
// True if ctx carries at least one signal an agent can realistically grep against source.
function hasGreppableSignal(ctx) {
  const a = ctx.attrs || {};
  const distinctiveAttr = ['data-testid', 'data-component', 'href', 'to', 'name', 'alt', 'placeholder', 'value']
    .some((k) => a[k]);
  const stems = (ctx.classHints && ctx.classHints.stems) || [];
  const plainClass = (ctx.classes || []).some((c) => {
    const hashed = (ctx.classHints && ctx.classHints.hashed) || [];
    const util = (ctx.classHints && ctx.classHints.utility) || [];
    return hashed.indexOf(c) === -1 && util.indexOf(c) === -1;
  });
  return !!(
    ctx.text || ctx.directText || ctx.accLabel || ctx.labelText ||
    distinctiveAttr || ctx.iconRef || (ctx.asset && ctx.asset.basename) ||
    ctx.isCustomElement || stems.length || plainClass ||
    (ctx.source && (ctx.source.file || ctx.source.component)) ||
    (ctx.ancestor && (ctx.ancestor.text || (ctx.ancestor.attrs && ctx.ancestor.attrs.href)))
  );
}
```

Then in `composePrompt`, replace the FIND-IN-SOURCE directive block (Section 2) with a branch:

```js
  // 2. Find-in-source directive — OR honest-failure warning when nothing is greppable.
  if (hasGreppableSignal(ctx)) {
    L.push('=== FIND THIS IN THE SOURCE ===');
    L.push(
      'This page is served from THIS folder, so its source is on disk and grep-able. Locate the EXACT ' +
      'source of this element using the ranked SEARCH HOOKS below — search by text/attributes/authored-CSS, ' +
      'NOT by the computed rgb() values or the live DOM selector (those are how it renders, not what the ' +
      'source says). Use ripgrep; prefer fixed-string (rg -F), and if an exact match returns nothing, widen ' +
      'to a distinctive substring or retry case-insensitively (rg -iF).');
  } else {
    L.push('=== WEAK SIGNAL — DO NOT GUESS ===');
    L.push(
      'This element has no reliable source-greppable signal (no text, no stable id/class, no label, no asset ' +
      'name, no component). Do NOT guess a file. Weak anchors only: the tag, the nearest labelled ancestor\'s ' +
      'text, the url route, and the on-screen position below. Look for where a <' + (ctx.tag || 'element') + '> ' +
      'or this section (its heading) is created, or ask the user to confirm the file.');
  }
  L.push('');
```

To make the second test's `doesNotMatch(out, /rg -F "/)` pass, guard the whole hooks block so it is skipped when there is no greppable signal. Change the hooks-section guard from `if (hooks.length)` to:

```js
  if (hooks.length && hasGreppableSignal(ctx)) {
```

(With a bare hashed-only div, `classKeys` is empty — `stems` is `[]` and the only class is hashed — so no `rg` line is produced anyway; the guard is belt-and-suspenders for the hashed-class case.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — all `composePrompt` tests (existing + new) green.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): honest-failure override when no greppable signal"
```

---

## Task 7: Guest capture — serialized constants + `snapNode` basics (tag/id/classes/text)

Now extend the guest `snapshot()`. This task adds the serialized constants, the string-embedded helpers, and a `snapNode` that captures the Tier-1 basics. Tested at **string level** (the guest body can't run under `node:test`).

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js` (inside `buildPickerScript`)
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('buildPickerScript serializes the meaningful-ancestor selector and attr allowlist', () => {
  const src = buildPickerScript({ persistent: false });
  assert.match(src, /MEANINGFUL_SELECTOR/);
  assert.match(src, /data-testid/);          // in the attr allowlist / selector
  assert.match(src, /ATTR_ALLOWLIST/);
});

test('buildPickerScript captures text safely (classList not className.split; innerText guarded)', () => {
  const src = buildPickerScript({ persistent: false });
  assert.match(src, /classList/);
  assert.doesNotMatch(src, /className\s*\.\s*split/);   // the SVG-throwing pattern must NOT be used
  assert.match(src, /innerText/);
  assert.match(src, /textContent/);
  assert.match(src, /nodeType\s*===?\s*3/);              // directText via text nodes
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — no `MEANINGFUL_SELECTOR`/`ATTR_ALLOWLIST` yet.

- [ ] **Step 3: Write minimal implementation**

In `buildPickerScript`, just below the existing `const props = JSON.stringify(CAPTURED_CSS_PROPS);`, add serialized constants:

```js
  const meaningfulSelector = JSON.stringify(
    'button,a[href],[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],' +
    '[role="switch"],input,select,textarea,label,th,td,summary,[onclick],[tabindex],[data-testid],' +
    '[data-component],[aria-label],nav,form,header,footer,article,section,figure,li,h1,h2,h3,h4,h5,h6'
  );
  const attrAllowlist = JSON.stringify(
    ['href', 'src', 'srcset', 'poster', 'alt', 'title', 'role', 'type', 'name', 'value', 'placeholder', 'aria-label', 'for']
  );
  const locAttrs = JSON.stringify(['data-v-inspector', 'data-source-loc', 'data-component-name', 'data-inspector-line']);
```

Then, inside the returned IIFE string, add these declarations near the top (after the existing `var PROPS = ${props};` line):

```js
  var MEANINGFUL_SELECTOR = ${meaningfulSelector};
  var ATTR_ALLOWLIST = ${attrAllowlist};
  var LOC_ATTRS = ${locAttrs};
  var CAP = 200;

  function snapWhitespace(s) {
    if (s == null) return '';
    return String(s).replace(/\\s+/g, ' ').trim().slice(0, CAP);
  }
  function isHashyClass(c) {
    return /(css|sc|emotion|jss)-|__|[-_][a-z0-9]{5,}$/.test(c);
  }
  function isUtilityClass(c) {
    return /^(p|m|px|py|mx|my|gap|text|flex|grid|bg|w|h|items|justify)-/.test(c);
  }
```

Now add a `snapNode` function inside the IIFE (above the existing `snapshot` function):

```js
  function snapNode(el, opts) {
    opts = opts || {};
    var out = {};
    try { out.tag = el.tagName ? el.tagName.toLowerCase() : ''; } catch (e) { out.tag = ''; }
    try { out.id = el.id || ''; } catch (e) { out.id = ''; }
    try { out.classes = Array.prototype.slice.call(el.classList || []); } catch (e) { out.classes = []; }
    try {
      var hashed = [], utility = [], stems = [];
      out.classes.forEach(function (c) {
        if (isUtilityClass(c)) { utility.push(c); }
        else if (isHashyClass(c)) {
          hashed.push(c);
          var human = c.split(/[_-]/).filter(function (p) { return p && !/^[a-z0-9]{5,}$/.test(p) && !/^(css|sc|emotion|jss)$/.test(p); });
          human.forEach(function (h) { if (stems.indexOf(h) === -1) stems.push(h); });
        } else { stems.push(c); }
      });
      out.classHints = { hashed: hashed, utility: utility, stems: stems };
    } catch (e) { out.classHints = { hashed: [], utility: [], stems: [] }; }
    try { out.isCustomElement = (out.tag.indexOf('-') !== -1); } catch (e) { out.isCustomElement = false; }
    try {
      var t = '';
      try { t = el.innerText; } catch (e2) { t = ''; }
      if (!t) { t = el.textContent || ''; }
      out.text = snapWhitespace(t);
    } catch (e) { out.text = ''; }
    try {
      var direct = '';
      var kids = el.childNodes || [];
      for (var i = 0; i < kids.length; i++) { if (kids[i].nodeType === 3) direct += kids[i].nodeValue; }
      out.directText = snapWhitespace(direct);
    } catch (e) { out.directText = ''; }
    try { out.textIsLiteralCandidate = (el.childNodes && el.childNodes.length === 1 && el.childNodes[0].nodeType === 3); } catch (e) { out.textIsLiteralCandidate = false; }
    return out;
  }
```

(Attrs, accessible name, media, source, and matchedRules are added in Tasks 8–10. `snapshot()` is wired to call `snapNode` in Task 10.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — the string-level assertions find the new tokens; existing `buildPickerScript` tests still pass.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): guest snapNode basics + serialized constants/helpers"
```

---

## Task 8: Guest capture — attrs, accessible name, media (asset/iconRef/pseudo)

Extend `snapNode` with the attribute allowlist (raw `getAttribute`, all `data-*`), accessible name, and media locators.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js` (inside `buildPickerScript`)
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('buildPickerScript uses getAttribute (not resolved props) and captures data-*', () => {
  const src = buildPickerScript({ persistent: false });
  assert.match(src, /getAttribute/);
  assert.doesNotMatch(src, /\bel\.href\b/);      // must NOT read the resolved-absolute property
  assert.match(src, /xlink:href/);                // legacy SVG sprite href
  assert.match(src, /indexOf\('data-'\)|startsWith\('data-'\)|\/\^data-\//);  // data-* iteration
});

test('buildPickerScript captures accessible name and asset basename', () => {
  const src = buildPickerScript({ persistent: false });
  assert.match(src, /aria-label/);
  assert.match(src, /backgroundImage/);           // background-image asset path
  assert.match(src, /basename|replace\(/);        // basename extraction
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — no `getAttribute`/`aria-label`/`backgroundImage` capture yet.

- [ ] **Step 3: Write minimal implementation**

Add to `snapNode` (before `return out;`):

```js
    try {
      var attrs = {};
      for (var ai = 0; ai < ATTR_ALLOWLIST.length; ai++) {
        var name = ATTR_ALLOWLIST[ai];
        var v = el.getAttribute ? el.getAttribute(name) : null;
        if (v) attrs[name] = String(v).slice(0, CAP);
      }
      try { var xh = el.getAttribute && el.getAttribute('xlink:href'); if (xh) attrs['xlink:href'] = String(xh).slice(0, CAP); } catch (e2) {}
      var all = el.attributes || [];
      for (var bi = 0; bi < all.length; bi++) {
        var an = all[bi].name;
        if (an && an.indexOf('data-') === 0) { var av = all[bi].value; if (av) attrs[an] = String(av).slice(0, CAP); }
      }
      out.attrs = attrs;
    } catch (e) { out.attrs = {}; }

    try {
      var acc = '';
      if (el.getAttribute) acc = el.getAttribute('aria-label') || '';
      if (!acc && el.getAttribute) {
        var labelledby = el.getAttribute('aria-labelledby');
        if (labelledby) { var lb = document.getElementById(labelledby); if (lb) acc = lb.textContent || ''; }
      }
      if (!acc) { var anc = el.closest && el.closest('[aria-label],[title]'); if (anc) acc = anc.getAttribute('aria-label') || anc.getAttribute('title') || ''; }
      if (!acc && el.title) acc = el.title;
      out.accLabel = snapWhitespace(acc);
    } catch (e) { out.accLabel = ''; }

    try {
      var lt = '';
      if (el.id) { var lab = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]'); if (lab) lt = lab.textContent || ''; }
      if (!lt && el.closest) { var wrap = el.closest('label'); if (wrap) lt = wrap.textContent || ''; }
      if (!lt && el.getAttribute) lt = el.getAttribute('aria-label') || '';
      out.labelText = snapWhitespace(lt);
    } catch (e) { out.labelText = ''; }

    try {
      var asset = null, rawUrl = '';
      if (out.tag === 'img' || out.tag === 'source') { rawUrl = (el.getAttribute && el.getAttribute('src')) || ''; }
      if (!rawUrl) {
        var bg = '';
        try { bg = getComputedStyle(el).backgroundImage || ''; } catch (e2) { bg = ''; }
        var m = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
        if (m) rawUrl = m[1];
      }
      if (rawUrl) {
        var clean = rawUrl.split('?')[0].split('#')[0];
        var base = clean.substring(clean.lastIndexOf('/') + 1).replace(/\\.[a-f0-9]{6,}(?=\\.[a-z0-9]+$)/i, '');
        asset = { rawUrl: rawUrl.slice(0, CAP), basename: base };
      }
      out.asset = asset;
    } catch (e) { out.asset = null; }

    try {
      var iconRef = '';
      var use = (out.tag === 'use') ? el : (el.querySelector && el.querySelector('use'));
      if (use) iconRef = (use.getAttribute('href') || use.getAttribute('xlink:href') || '');
      out.iconRef = iconRef;
    } catch (e) { out.iconRef = ''; }

    try {
      var pb = '', pa = '';
      try { var cb = getComputedStyle(el, '::before').content; if (cb && cb !== 'none' && cb !== 'normal') pb = cb; } catch (e2) {}
      try { var ca = getComputedStyle(el, '::after').content; if (ca && ca !== 'none' && ca !== 'normal') pa = ca; } catch (e3) {}
      out.pseudoContent = (pb || pa) ? { before: pb, after: pa } : null;
    } catch (e) { out.pseudoContent = null; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): guest capture of attrs/accessible-name/media"
```

---

## Task 9: Guest capture — `matchedRules` (triple-guarded) + `source` object

Add the authored-CSS scan (the anti-mislead capture) with its three nested guards, and the framework `source` introspection.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js` (inside `buildPickerScript`)
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('buildPickerScript scans stylesheets with per-sheet and per-rule guards + cap', () => {
  const src = buildPickerScript({ persistent: false });
  assert.match(src, /styleSheets/);
  assert.match(src, /cssRules/);
  assert.match(src, /matches\(/);
  assert.match(src, /cssCrossOrigin/);
  assert.match(src, /stylesheetsBlocked/);
  assert.match(src, /20/);                         // the hard cap on matched rules
});

test('buildPickerScript introspects React/Vue source without hardcoding the fiber suffix', () => {
  const src = buildPickerScript({ persistent: false });
  assert.match(src, /__reactFiber\$|__reactInternalInstance\$/);
  assert.match(src, /__vueParentComponent|__vue__/);
  assert.match(src, /__file/);                     // Vue SFC absolute path = ground truth
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — no `styleSheets`/fiber scan yet.

- [ ] **Step 3: Write minimal implementation**

Add a standalone `matchedRulesFor(el, sink)` function inside the IIFE (above `snapshot`), and a `sourceOf(el)`:

```js
  function matchedRulesFor(el, sink) {
    var rules = [];
    try {
      var sheets = [];
      try { sheets = Array.prototype.slice.call(document.styleSheets || []); } catch (e0) { sheets = []; }
      try { if (document.adoptedStyleSheets) sheets = sheets.concat(Array.prototype.slice.call(document.adoptedStyleSheets)); } catch (e0b) {}
      for (var s = 0; s < sheets.length && rules.length < 20; s++) {
        var cssRules = null;
        try { cssRules = sheets[s].cssRules; }
        catch (eSheet) { sink.cssCrossOrigin = true; try { if (sheets[s].href) sink.stylesheetsBlocked.push(sheets[s].href); } catch (e1) {} continue; }
        if (!cssRules) continue;
        for (var r = 0; r < cssRules.length && rules.length < 20; r++) {
          var rule = cssRules[r];
          if (!rule || rule.type !== 1 || !rule.selectorText) continue;
          var ok = false;
          try { ok = el.matches(rule.selectorText); } catch (eRule) { continue; }
          if (ok) rules.push({ selector: rule.selectorText, css: snapWhitespace(rule.style ? rule.style.cssText : '') });
        }
      }
    } catch (e) { /* whole-field guard */ }
    return rules;
  }

  function sourceOf(el) {
    var src = {};
    try {
      // React: find the fiber key by prefix (suffix is random per page load).
      var fiberKey = null, keys = Object.keys(el);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('__reactFiber$') === 0 || keys[i].indexOf('__reactInternalInstance$') === 0) { fiberKey = keys[i]; break; }
      }
      if (fiberKey) {
        var node = el[fiberKey], hops = 0;
        while (node && hops < 30) {
          var t = node.type;
          if (typeof t === 'function') {
            var nm = t.displayName || t.name;
            if (nm && /^[A-Za-z]/.test(nm) && nm.length > 1) { src.component = nm; break; }
          } else if (t && typeof t === 'object') {
            var inner = t.render || t.type;     // forwardRef / memo
            if (typeof inner === 'function' && (inner.displayName || inner.name)) { src.component = inner.displayName || inner.name; break; }
          }
          if (node._debugSource && node._debugSource.fileName) { src.file = node._debugSource.fileName; src.line = node._debugSource.lineNumber; break; }
          node = node.return; hops++;
        }
      }
      // Vue.
      if (!src.component && !src.file) {
        var vc = el.__vueParentComponent || (el.__vue__ && { type: el.__vue__.$options });
        if (vc && vc.type) {
          if (vc.type.__file) src.file = vc.type.__file;
          src.component = vc.type.name || vc.type.__name || src.component;
        }
      }
      // Dev source-locator attributes (Vite plugins etc.).
      if (el.getAttribute) {
        for (var li = 0; li < LOC_ATTRS.length; li++) {
          var lv = el.getAttribute(LOC_ATTRS[li]);
          if (lv) { src.file = src.file || lv; break; }
        }
      }
    } catch (e) { /* absence => {} is the common, correct outcome */ }
    return src;
  }
```

Then wire them into `snapNode` (before `return out;`), but **only for the clicked node** (gate on `!opts.skipExpensive`):

```js
    if (!opts.skipExpensive) {
      out.cssCrossOriginSink = { cssCrossOrigin: false, stylesheetsBlocked: [] };
      out.matchedRules = matchedRulesFor(el, out.cssCrossOriginSink);
      out.cssCrossOrigin = out.cssCrossOriginSink.cssCrossOrigin;
      out.stylesheetsBlocked = out.cssCrossOriginSink.stylesheetsBlocked;
      delete out.cssCrossOriginSink;
      out.source = sourceOf(el);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): guest matchedRules (guarded) + react/vue source introspection"
```

---

## Task 10: Wire `snapshot()` — smart target, siblingIndex, rowContext, assemble flat ctx

Replace the body of the existing `snapshot(el)` to use `snapNode`, add the smart-target ancestor, sibling index, row context, and assemble the flat back-compat `ctx`.

**Files:**
- Modify: `renderer/features/element-inspector/element-inspector.payload.js` (the `snapshot` function inside `buildPickerScript`)
- Test: `renderer/features/element-inspector/element-inspector.payload.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('buildPickerScript snapshot computes smart-target ancestor + siblingIndex', () => {
  const src = buildPickerScript({ persistent: false });
  assert.match(src, /closest\(MEANINGFUL_SELECTOR\)/);
  assert.match(src, /skipExpensive\s*:\s*true/);    // ancestor uses the light snapshot
  assert.match(src, /siblingIndex/);
  assert.match(src, /rowContext/);
});

test('buildPickerScript snapshot still returns the back-compat keys', () => {
  const src = buildPickerScript({ persistent: false });
  // these literal keys must remain in the assembled object
  assert.match(src, /html:/);
  assert.match(src, /css:/);
  assert.match(src, /rect:/);
  assert.match(src, /selector:/);
  assert.match(src, /url:/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: FAIL — `closest(MEANINGFUL_SELECTOR)` / `siblingIndex` not present.

- [ ] **Step 3: Write minimal implementation**

Replace the **entire existing** `snapshot` function inside the IIFE with:

```js
  function snapshot(el) {
    var ctx = {};
    try {
      // Clicked node — full capture.
      var node = snapNode(el, { full: true });
      for (var k in node) { if (node.hasOwnProperty(k)) ctx[k] = node[k]; }

      // Back-compat fields (exact keys/shapes the existing tests assert).
      try {
        var cs = getComputedStyle(el); var css = {};
        PROPS.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) css[p] = v.trim(); });
        ctx.css = css;
      } catch (e) { ctx.css = {}; }
      try { var rr = el.getBoundingClientRect(); ctx.rect = { x: Math.round(rr.left), y: Math.round(rr.top), w: Math.round(rr.width), h: Math.round(rr.height) }; } catch (e) { ctx.rect = { x: 0, y: 0, w: 0, h: 0 }; }
      try {
        var html = el.outerHTML || '';
        html = html.replace(/(\\sd=")[^"]{40,}(")/g, '$1…$2');   // collapse long <path d="…"> runs
        if (html.length > 1500) html = html.slice(0, 1500) + '\\n<!-- …truncated… -->';
        ctx.html = html;
      } catch (e) { ctx.html = ''; }
      try { ctx.selector = uniqueSelector(el); } catch (e) { ctx.selector = ''; }
      ctx.url = location.href;

      // Smart target — nearest meaningful ancestor (light snapshot).
      try {
        var anc = el.closest ? el.closest(MEANINGFUL_SELECTOR) : null;
        if (anc && anc !== el && anc !== document.body && anc !== document.documentElement) {
          ctx.ancestor = snapNode(anc, { skipExpensive: true });
          try {
            var rc = [], rkids = anc.children || [];
            for (var ci = 0; ci < rkids.length && ci < 6; ci++) { var dt = (rkids[ci].textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60); if (dt) rc.push(dt); }
            ctx.rowContext = rc;
          } catch (e2) { ctx.rowContext = []; }
        }
      } catch (e) { /* no ancestor */ }

      // Sibling index — reframe duplicates as a data index.
      try {
        var self = null;
        if (el.parentElement) {
          var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.tagName === el.tagName; });
          self = { index: sibs.indexOf(el), of: sibs.length };
        }
        var repeated = null, walk = el.parentElement, whops = 0;
        while (walk && whops < 8) {
          if (walk.parentElement) {
            var ws = Array.prototype.filter.call(walk.parentElement.children, function (c) {
              return c.tagName === walk.tagName && c.className && walk.className && String(c.className) === String(walk.className);
            });
            if (ws.length > 1) { repeated = { tag: walk.tagName.toLowerCase(), cls: (walk.classList[0] || ''), index: ws.indexOf(walk), of: ws.length }; break; }
          }
          walk = walk.parentElement; whops++;
        }
        ctx.siblingIndex = { self: self, repeatedAncestor: repeated };
      } catch (e) { ctx.siblingIndex = null; }
    } catch (e) { /* top-level guard: return whatever we have */ }
    return ctx;
  }
```

**Important:** the click handler already calls `snapshot(NS.current)` and resolves with its return value — no change needed there. Verify the existing `NS.onClick` still reads `var data = snapshot(NS.current);`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — all string-level + all `composePrompt` tests green.

- [ ] **Step 5: Run the FULL suite once more and verify the count**

Run: `node --test renderer/features/element-inspector/element-inspector.payload.test.js`
Expected: PASS — 0 failures. (Existing 6 + the new tests from Tasks 1–10.)

- [ ] **Step 6: Commit**

```bash
git add renderer/features/element-inspector/element-inspector.payload.js renderer/features/element-inspector/element-inspector.payload.test.js
git commit -m "feat(element-inspector): wire snapshot — smart target + siblingIndex + back-compat assemble"
```

---

## Task 11: Manual end-to-end verification (in-app)

The guest body only runs in a real webview, so this is manual. **The dev app hosts this session — do NOT `npm start`/restart/kill it.** Reload the renderer with Ctrl+R in a focused app window, or verify on the user's next launch. If any step fails, debug with `superpowers:systematic-debugging` before claiming completion.

- [ ] **Step 1: Parse check**

Run: `node --check renderer/features/element-inspector/element-inspector.payload.js`
Expected: exit 0 (no syntax error).

- [ ] **Step 2: Static site — text element**

In the in-app Brave tab, open a static page (e.g. the user's `http://localhost:5500/` oskariozan site). Toggle the crosshair ON, click a heading or the footer text. Pick an agent session. Expected injected prompt: a `FIND THIS IN THE SOURCE` block, a `Search hooks` section whose #1 is the visible text with an `rg -F "…"` command, an `AUTHORED CSS` block (if same-origin CSS matched), and the computed CSS clearly labelled "do NOT grep". No live-selector at the top.

- [ ] **Step 3: Static site — the "Stay Updated" nav button (smart target)**

Click the text **inside** the `.nav-cta` button. Expected: the `Smart target` pair shows the clicked node (span/text) AND the nearest container `<a class="nav-cta" href="#newsletter">`, marked as the likely edit target, with `rg -F 'href="#newsletter"'`. Confirm the agent can locate `.nav-cta` in `styles.css` and `var(--gold)` in the AUTHORED CSS block (this is the original bug, fixed).

- [ ] **Step 4: Icon-only / image element**

Click an icon-only control or an `<img>` (e.g. the ragbot mascot). Expected: when there is no visible text, the hooks lead with the accessible label (`aria-label`/`alt`) or the asset basename; no fabricated text hook.

- [ ] **Step 5: Duplicated element**

On a page with repeated cards/links (or the Knowledge Base cards), click one of several similar items. Expected: a `Repeated element` block ("item N of M"), `rowContext` listing the distinctive sibling value, and per-instance attrs ranked above the shared text.

- [ ] **Step 6: Honest-failure**

Click a purely decorative element with no text/label/stable class (e.g. a spacer/grain overlay div). Expected: the `WEAK SIGNAL — DO NOT GUESS` framing, weak anchors only, and NO `rg -F "…"` fabricated hook line.

- [ ] **Step 7: No silent-failure regression**

Confirm that for every click above, a prompt WAS injected (the capture never threw and silently no-op'd). If a click produced nothing, capture the guest console error and debug before proceeding.

- [ ] **Step 8: Record results (no code change)**

If all steps pass, the feature is verified. Note any element type that produced a weak/wrong locator for a possible follow-up; do not silently ignore it.

---

## Task 12: Docs — FEATURE-MAP + rules note

**Files:**
- Modify: `FEATURE-MAP.md`
- Modify: `.claude/rules/element-inspector.md`

- [ ] **Step 1: Update the Element Inspector entry in `FEATURE-MAP.md`**

Add one line under the Element Inspector section noting: "The payload now captures source-locating signals (text, directText, authored attrs, matchedRules = authored CSS, smart-target ancestor, accLabel/asset/iconRef, siblingIndex/rowContext, framework source) and composePrompt ranks them as grep hooks; computed CSS is de-trusted. All still in `element-inspector.payload.js`."

- [ ] **Step 2: Note the contract in `.claude/rules/element-inspector.md`**

Add: "`snapshot()` is throw-safe (every field individually try/caught — a single throw rejects the whole capture). Capture uses `getAttribute` (raw), never resolved properties (`el.href`), and `classList`, never `className.split` (SVG throws). `composePrompt` is mislead-proof: computed CSS labelled 'do NOT grep', authored CSS (`matchedRules`) ranked above it, and an honest-failure path when no signal is greppable. The `source` field is the extensible hook for a future source-map resolver. New `ctx` fields are additive; the 6 original tests stay green."

- [ ] **Step 3: Commit**

```bash
git add FEATURE-MAP.md .claude/rules/element-inspector.md
git commit -m "docs(element-inspector): note source-locating capture + mislead-proof prompt"
```

---

## Self-Review Notes

- **Spec coverage:** ctx data shape (existing + Tier 1/2/3) → Tasks 7–10 capture; composePrompt format sections 1–11 → Tasks 1–6 (directive/T1; hooks/T2; smart-target+source/T3; repeated+recovery/T4; authored-CSS+cross-origin/T5; honest-failure/T6). snapshot throw-safety + landmines (getAttribute/classList/triple-guard/innerText-click-only) → Tasks 7–10 + asserted at string level. Back-compat (6 tests, additive fields, verbatim computed `rgb()`) → preserved in Task 1 and re-checked in Tasks 5 & 10. Manual webview verification → Task 11. Docs → Task 12. ✓
- **Placeholder scan:** every code step contains full code; no TBD/TODO. ✓
- **Type/name consistency:** `ctx` field names used in `composePrompt` (Tasks 1–6) exactly match those produced by `snapNode`/`snapshot` (Tasks 7–10): `text, directText, textIsLiteralCandidate, tag, id, classes, classHints{hashed,utility,stems}, attrs, accLabel, labelText, asset{rawUrl,basename}, iconRef, pseudoContent, matchedRules[{selector,css}], cssCrossOrigin, stylesheetsBlocked, source{component?,file?,line?}, isCustomElement, ancestor(snapNode light), rowContext, siblingIndex{self{index,of},repeatedAncestor{tag,cls,index,of}|null}`. Helpers `rgFixed`/`hasGreppableSignal` (module scope) vs `snapWhitespace`/`isHashyClass`/`isUtilityClass`/`snapNode`/`matchedRulesFor`/`sourceOf` (guest-string scope) are kept on the correct side of the string boundary. ✓
- **Back-compat guard:** Task 1 keeps header/css/rect/selector/html; Task 5 keeps the computed block (verbatim value) and only adds the authored block above it; Task 10 assembles `css/rect/html/selector/url` with their exact keys. The 3 tolerant/asserting existing `composePrompt` tests and the 3 `buildPickerScript`/`buildTeardownScript` tests are never modified. ✓
