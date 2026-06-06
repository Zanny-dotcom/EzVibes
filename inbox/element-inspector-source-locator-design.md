# Element Inspector — Source-Locator Upgrade (Design)

> **Status:** Approved design, ready for implementation planning.
> **Predecessor:** `docs/2026-06-02-visual-element-inspector-plan.md` (built the feature).
> **Hardened by:** the `docs/element-inspector-hardening-workflow.js` ultracode run (10 agents: per-category taxonomy stress-test, guest-API feasibility, two adversarial skeptics, synthesis).

## Problem

The Visual Element Inspector lets a user, inside the in-app Brave `<webview>`, click the crosshair toggle ("Pick an element to send to an agent (sticky)"), click any element on their **localhost** page, type a change, pick a session, and have the instruction + element context injected into that Claude/Codex PTY. The receiving agent runs in the **same folder that serves the page**, so it has filesystem + grep access to the page's source.

**The bug:** the captured payload only describes how the element *renders* — `outerHTML`, **computed** CSS, a bounding box, and a live-DOM `selector`. None of it points at *source*, and the computed CSS actively **misleads**: it reports `background-color: rgb(201, 168, 76)` when the source says `background: var(--gold)`, so grepping the value finds nothing and sends the agent down a wrong path. The live-DOM selector rarely matches source (especially framework apps with hashed classes). There is no first-class text/id/class/attribute fingerprint and no source/component hint.

**This was observed live:** during an unrelated "make this button white" task, the computed value `rgb(223,192,106)` did not match the authored `var(--gold)`, costing several wrong-path steps.

## Goal

A web-design workflow where the user (a web designer) can click **any** element/text/button/header/footer item/table cell/chatbox/input/widget/icon on their localhost page and the agent **reliably finds the exact place in source code** and edits it. "Any element" — including text-less and duplicated elements — is the hard requirement. The system must **never mislead**: when a signal is render-time-only (computed CSS, live selector), it is labelled as such; when no greppable signal exists, the prompt says so honestly rather than guessing.

## Approach (chosen: "B — enrich capture + rewrite prompt")

All changes stay inside the single pure, dual-exported, `node:test`-covered module:
`renderer/features/element-inspector/element-inspector.payload.js` and its test file.

**No** new IPC, **no** main-process code, **no** edits to other features. Feature isolation (CLAUDE.md) is preserved. Two seams:

- `snapshot(el)` — runs as a **string** inside the guest webview (serialized into the picker IIFE). Captures the new greppable signals.
- `composePrompt(instruction, ctx)` — runs in the renderer. Formats the captured signals into the injected prompt.

The contract between them is the `ctx` object. It is extended **additively**: every existing key (`html`, `css`, `rect`, `selector`, `url`) keeps its exact shape so all current tests pass; every new field is optional and defaults to empty on capture failure.

Rejected alternatives: a main-process grep round-trip before injection (out of scope, breaks isolation, and the receiving agent already greps better); doing a source-map resolve now (deferred — `source` is left as an extensible hook).

---

## Constraints (from `CLAUDE.md` + guest-context reality)

1. **Vanilla JS, CommonJS** in the node-tested module. No TypeScript, no bundler, no new dependencies.
2. **`snapshot()` runs as a guest string.** Only vanilla DOM APIs available. **A single uncaught throw rejects the entire capture → silent no-op.** Therefore every field is individually try/caught and degrades to a default.
3. **All changes in `element-inspector.payload.js` + its test.** No cross-feature edits.
4. **`composePrompt` tolerates missing/old `ctx` fields** (existing back-compat test must keep passing; it is NOT tightened).
5. Constants (selectors, allowlists, caps) are serialized into the IIFE via `JSON.stringify` alongside the existing `PROPS`, so there is **one source of truth**.
6. **`onMove` stays cheap** (only `elementFromPoint` + box positioning). All heavy capture runs **only in the click handler**. `innerText` (forces reflow) is never called on move.

---

## Data shape — the extended `ctx`

Captured by `snapshot()`. Grouped by tier (all tiers are in v1; tiers describe *why* each field exists). Every field has a default for the throw-safe path.

### Existing fields — KEPT (back-compat), some re-labelled in the prompt

| Field | Type | Source | Guard | Purpose |
|---|---|---|---|---|
| `url` | string | `location.href` | → `'(unknown URL)'` | Page route; last-resort anchor. Asserted by a test. |
| `selector` | string | `uniqueSelector(el)` (unchanged live-DOM path) | try/catch → `''` | Live-DOM **orientation only**. Demoted to the bottom; `:nth-of-type` labelled "rendered position, NOT a source path." Asserted by a test. |
| `html` | string | `el.outerHTML`, **cap lowered 4000→1500**, inline `<svg><path d="…">` coordinate runs collapsed | try/catch → `''` | Raw markup so the agent sees entity encodings (`&copy;`) and nested structure. De-emphasized below hooks. Asserted by a test. |
| `css` | object | `getComputedStyle` + `CAPTURED_CSS_PROPS` (unchanged allowlist) | try/catch → `{}` | **COMPUTED** values. Re-labelled "do NOT grep these"; moved below `matchedRules`. The core anti-mislead fix. Asserted by a test. |
| `rect` | `{x,y,w,h}` | `getBoundingClientRect()` rounded | try/catch → `{x:0,y:0,w:0,h:0}` | On-screen position; weak ordinal hint. Asserted by a test. |

### Tier 1 — Core (the 80% win)

| Field | Type | Source | Purpose |
|---|---|---|---|
| `text` | string | `innerText` → `textContent`, whitespace-collapsed, cap 200 | #1 grep key for unique copy/headings/labels. Captured on clicked node AND ancestor. Labelled "may include CSS-generated content" so a missed grep reads as wrong-key, not absent. |
| `directText` | string | concat of `childNodes` where `nodeType===3` only, collapsed, cap 200 | The element's **own** contiguous text token, excluding descendants. Solves split-across-spans phantoms ("Plans for teams" exists in no file; "for teams" does) and joined-container blobs. |
| `textIsLiteralCandidate` | boolean | true iff exactly one child and it is a Text node | Confidence flag. When false, the prompt downgrades text-grep confidence and triggers interpolation recovery. |
| `tag` | string | `el.tagName.toLowerCase()` | First-class tag; scopes greps, reveals heading level / semantic region; bridges to `<Link>`/`<router-link>` with a caveat. |
| `id` | string | `el.id` | Exact anchor when authored; flagged "maybe build-generated" if it matches React `useId` shape (`:r..:`). |
| `classes` | string[] | `Array.prototype.slice.call(el.classList)` — **never** `className.split` (SVG `SVGAnimatedString` throws) | Authored class tokens as an array; bridge to template/CSS; sometimes the only hook for text-less marks. |
| `attrs` | object | `getAttribute` over an allowlist + every `data-*` (RAW hyphenated names) | Selective locators that disambiguate duplicated/short text. **`getAttribute`, never the resolved property** (`el.href` → absolute URL → zero source hits). Allowlist: `href, src, srcset, poster, alt, title, role, type, name, value, placeholder, aria-label, for`, plus `xlink:href`, plus all `data-*`. Per-value cap 200. |
| `matchedRules` | `[{selector, css}]` | iterate `document.styleSheets` + `adoptedStyleSheets`; per-sheet try around `.cssRules`; `rule.type===1`; `el.matches(selectorText)` per-rule try; push `{selectorText, style.cssText}`; **hard cap 20** | **AUTHORED CSS** so the agent greps `background: var(--gold)`, not computed `rgb()`. The headline anti-mislead fix. Best for plain CSS / CSS-modules; weak for CSS-in-JS (noted). |
| `ancestor` | object \| null | `el.closest(MEANINGFUL_SELECTOR)`, captured via a **light** `snapNode` (no `matchedRules`/`css`) | **SMART TARGET.** Clicking the text/svg/path inside a button/cell/list-item resolves to the real source element. The single strongest field in the design. `MEANINGFUL_SELECTOR` = `button, a[href], [role="button"|"link"|"tab"|"menuitem"|"checkbox"|"switch"], input, select, textarea, label, th, td, summary, [onclick], [tabindex], [data-testid], [data-component], [aria-label], nav, form, header, footer, article, section, figure, li, h1..h6`; also accept an ancestor whose class matches `/btn|button|nav|menu|card|cta/i`; null if it equals the clicked node or is `body`/`html`. |

### Tier 2 — "Click anything" coverage (the hard element types)

| Field | Type | Source | Purpose |
|---|---|---|---|
| `accLabel` | string | `aria-label` \| `aria-labelledby` target text \| `closest('[aria-label],[title]')` \| `el.title` | The accessible name — the entire locating story for **icon-only buttons** with empty text. Ranked just under visible text when `text===''`. |
| `labelText` | string | for controls: `label[for=el.id]` text \| wrapping `closest('label')` \| `aria-label` | Recovers the human string for **textless inputs/checkboxes/selects**. |
| `asset` | `{rawUrl, basename}` \| null | `img`/`source` → `src`; else `getComputedStyle().backgroundImage` `url()`; strip origin/query/#/dir + trailing content-hash → basename | Image/background locator. Source uses a relative path/import whose filename contains the basename (`hero`); the rendered URL is absolute+hashed (a grep trap). Prompt presents basename, warns NOT to grep `rawUrl`. |
| `iconRef` | string | if node/descendant is `<use>`, its `href`\|`xlink:href` (e.g. `#icon-search`) | Ties a rendered **SVG-sprite glyph** to its `<symbol id>` / icon name in source. |
| `pseudoContent` | `{before, after}` \| null | `getComputedStyle(el,'::before'/'::after').content` when meaningful | Flags **CSS-generated / icon-font text** (`content:'New'`, `\f002`) invisible to `textContent`. Signals the word lives in CSS, not HTML. (A signal more than a directly greppable key — serialized form has quotes/escapes.) |
| `classHints` | `{hashed[], utility[], stems[]}` | partition `classes`: hashed (`css-`/`sc-`/`emotion-`/`__`/trailing `[-_][a-z0-9]{5,}`), utility (`^(p|m|px|py|gap|text|flex|grid|bg|w|h|items|justify)-`), stems (de-hashed human part) | Lets the prompt downrank build-generated/atomic classes and suggest grepping the **stem** (`Card_link__a1b2c` → `Card`/`link`/`styles.link`). |
| `cssCrossOrigin` | boolean | true if ANY sheet's `.cssRules` threw `SecurityError` during `matchedRules` | Distinguishes "`matchedRules` empty = no authored rules" from "empty = every sheet was cross-origin" (CDN Tailwind/Bootstrap/FontAwesome). When true + empty, the prompt suppresses computed CSS as a hook and says so. |
| `stylesheetsBlocked` | string[] | `href` of each cross-origin sheet that threw | Names the CDN origins so the prompt can say "styling lives off-disk — grep the class list / Tailwind config, not a local stylesheet." |
| `siblingIndex` | `{self:{index,of}, repeatedAncestor:{tag,cls,index,of}\|null}` \| null | clicked node's index among same-tag siblings; nearest ancestor with ≥2 same-tag + overlapping-class siblings → its index/of | Reframes a **duplicate** ("Read more" ×50, one table cell of hundreds) as a **data index** ("item 37 of 50"), not a CSS `:nth` path — tells the agent to find the array entry / template. |
| `rowContext` | string[] | on the ancestor (and clicked node if it's a row/card): `directText` of its first ~6 direct element children, each cap ~60 | Hands the agent the **distinctive sibling value** ("Acme Corp", a primary key) to uniquely locate the data row, instead of the high-collision clicked value ("Active"). |

### Tier 3 — Flags + future-proofing (small, real edge cases)

| Field | Type | Source | Purpose |
|---|---|---|---|
| `source` | object (extensible, `{}` on static) | React fiber walk (find `__reactFiber$*`/`__reactInternalInstance$*` by prefix, walk `.return` ≤30 hops to a function-typed fiber, `displayName`\|`name` with identifier-shape guard, unwrap `forwardRef`/`memo`) + Vue (`__vueParentComponent.type.name`/`__name`/`__file`, legacy `__vue__`) + dev source-locator attrs (`data-v-inspector`, `data-inspector-*`, `data-source-loc`, `data-component-*`) + React≤18 `_debugSource` | The template bridge when text is data-driven/i18n/hashed. `__file` (absolute SFC path) and `data-v-inspector` (`file:line:col`) are **ground-truth** and short-circuit grepping. **Extensible so a future source-map resolver drops in with no format change.** Note: React 19 removed `_debugSource` → `{}` expected on most React pages (a deliberate, acknowledged outcome, not a failure). |
| `isCustomElement` | boolean | `tag.indexOf('-') !== -1` | Any hyphenated tag is a **web component**. Prompt says "grep `customElements.define("my-icon"`" and surfaces its attrs as the content driver (shadow-DOM text is absent). |

---

## `snapshot()` logic (guest-side, throw-safe)

1. **Wrap everything.** The entire `snapshot(el)` body is a top-level try around per-field inner try/catch blocks. Every field degrades to a default (`''`, `[]`, `{}`, `null`, `false`); nothing propagates. (A single uncaught throw → rejected promise → silent no-op.)
2. **Step 0 — inner helpers + serialized constants.** Define string-embedded helpers: `snapWhitespace(s)` (collapse+trim+cap), `basenameOf(url)`, `isHashyClass(c)`, `isUtilityClass(c)`. Serialize `MEANINGFUL_SELECTOR`, `ATTR_ALLOWLIST`, `LOC_ATTRS`, and caps into the IIFE via `JSON.stringify` alongside the existing `PROPS` (one source of truth).
3. **Step 1 — `snapNode(el, opts)`**, the reusable per-element capturer. Used for both the clicked node (full) and the ancestor (`opts.skipExpensive` → skip `matchedRules` + `css`). Each field in its own try/catch:
   - **1a tag/id/classes** → derive `classHints`, `isCustomElement`.
   - **1b text** → `innerText`→`textContent` (collapse, cap 200); `directText` (text childNodes only); `textIsLiteralCandidate`. `innerText` only here (click), never `onMove`.
   - **1c attrs** → `getAttribute` over `ATTR_ALLOWLIST` (RAW), `xlink:href`, every `data-*` by raw name; cap 200; drop empties.
   - **1d accessible name** → `accLabel`, `labelText` (each DOM hop guarded).
   - **1e media** → `asset` (img/source `src` or background-image), `iconRef` (`<use>`), `pseudoContent`.
   - **1f source object** → one shared try/catch for the whole block (highest throw risk): React fiber walk → Vue → `LOC_ATTRS` → React≤18 `_debugSource`. Absence ⇒ `{}`.
   - **1g matchedRules** (clicked node only): **three nested guards** — outer field try; per-sheet try (cross-origin `SecurityError` → set `cssCrossOrigin`, push to `stylesheetsBlocked`, **continue**); per-rule try (`SyntaxError` on pseudo/invalid → continue). `rule.type===1` only. **Hard cap 20** matched rules; bound total scan to avoid multi-second freeze on Tailwind pages.
4. **Step 2 — clicked node** = `snapNode(el, {full:true})`, plus `css` (computed allowlist, re-labelled later), `rect`, the unchanged `selector`, capped+path-collapsed `html`, `url`.
5. **Step 3 — SMART TARGET** = `el.closest(MEANINGFUL_SELECTOR)` in try/catch; reject if `=== el`/`body`/`documentElement`; if kept, `snapNode(ancestor, {skipExpensive:true})` (light) + compute its `rowContext`.
6. **Step 4 — siblingIndex** = self index among same-tag siblings; walk up to the nearest ancestor with ≥2 same-tag siblings sharing a class → `{tag,cls,index,of}`. All guarded; null on failure.
7. **Step 5 — assemble flat `ctx`.** Spread clicked-node fields at top level (back-compat: `html`/`css`/`rect`/`selector`/`url` keep exact shapes/keys), plus the new fields and `ancestor{...}`/`rowContext`. Return it. `onMove` stays cheap; all the above runs only in the click handler.

---

## `composePrompt()` output format (ranked to locate source; mislead-proof)

Sections are emitted **only when their field is present/non-empty** (same gating style as the existing `if (ctx.css && Object.keys(ctx.css).length)`).

1. **Header + instruction** (unchanged top): `"I'm looking at this element on the page <url>"` / blank / `"My request: <instruction>"`. Keeps `url` + instruction tests passing.
2. **FIND-IN-SOURCE directive:** this is a localhost page whose source is in **this** folder; locate the exact source by the ranked SEARCH HOOKS below, **NOT** by computed CSS or the live selector. States the rg convention (`rg -F` / `-iF`, widen to substrings).
3. **SEARCH HOOKS — ranked, each with a ready `rg` command:** (a) visible text / `directText` (#1, uses `directText` when `textIsLiteralCandidate`, flagged "may include CSS-generated content"); (b) accessible label (`accLabel`) when text empty; (c) high-precision attrs: `data-testid`, `data-component`, then LITERAL `href`/`to` slug, `name`, `value`, `placeholder`, `alt`, `iconRef` sprite id, `asset.basename`; (d) `source`: `__file`/`data-v-inspector` printed as "OPEN DIRECTLY (ground truth)", else component name; (e) class **stems** + id, labelled "maybe build-generated — skip hash-like tokens; atomic utilities are not selective"; (f) tag, with the "`<a>` may be `<Link>`/`<router-link>`; hyphenated tag = custom element, grep `customElements.define`" caveats.
4. **SMART-TARGET pair:** "Clicked node" vs "Nearest meaningful container", each showing tag + own text/`directText` + attrs. Container marked as the likely intended edit target when the clicked node is a bare leaf/icon/text.
5. **REPEATED-ELEMENT block** (only when `siblingIndex.of > 1` or identical-shaped siblings): "this is item N of M (`article.card`)"; reframes N as a DATA index, not a CSS position; re-ranks selective per-instance attrs (href slug, `data-id`, `data-key`) ABOVE text; prints `rowContext` as "grep the MOST DISTINCTIVE value ("Acme Corp")"; labels `matchedRules` as "shared styling for all M instances."
6. **INTERPOLATION / I18N RECOVERY** (always present, short): "If a text hook is NOT found as a literal: (1) search by tag+class/component; (2) retry `-iF` / as a property value; (3) for locale hits grep the KEY (`cta.readMore`); (4) find the `.map()`/`v-for`/`{#each}`/`{% for %}`; (5) widen to data files `--glob *.{js,ts,json,yaml,yml,md,mdx}`." Confidence note when `textIsLiteralCandidate` is false.
7. **AUTHORED CSS (`matchedRules`)** — "grep these tokens, e.g. `var(--gold)`". If empty AND `cssCrossOrigin`: emit the honest cross-origin block naming `stylesheetsBlocked` origins; grep the class list / Tailwind config, not a local stylesheet, not the computed values.
8. **COMPUTED (rendered) styles** — the existing `css` block, re-titled: "**these are how it looks now, NOT what the source says. Do NOT grep these (e.g. do NOT grep `rgb(223,192,106)` — source likely says `var(--gold)`).**" Kept for back-compat, explicitly de-trusted.
9. **RAW MARKUP** — the existing `html` block (path-data-collapsed, lower cap): "for entity encodings like `&copy;` and nested structure."
10. **DE-EMPHASIZED ORIENTATION** — Selector + Position at the very bottom. Selector caveated "Live rendered-DOM position — NOT a source path"; when it contains `:nth-of-type`/`:nth-child`, the stronger "the literal Nth position does NOT exist in source if this is looped/hashed — search the template."
11. **HONEST-FAILURE override:** `composePrompt` computes a greppability score from present fields (text/`directText`/`accLabel`/`labelText`/non-hashed class/distinctive attr/`asset.basename`/`iconRef`/`isCustomElement`/`source`). If NONE are greppable, REPLACE the confident framing with a WARNING: "no reliable source-greppable signal — do NOT guess. Weak anchors only: tag, nearest labelled ancestor text, url route, on-screen rect. Search where a `<tag>`/this section's heading is created, or ask the user to confirm the file."

**Back-compat guarantee:** every new section is gated on its field. An old/partial `ctx` (e.g. the test's `{url, selector, html}`) composes without throwing and still contains `url`/`selector`/`html`/`css`/`rect`, so all existing tests pass. New tests are added; the tolerant tests are NOT tightened.

---

## Example composed prompt (clicking "Stay Updated")

```
I'm looking at this element on the page http://localhost:3000/

My request: change the Stay Updated button colour to a deeper gold

=== FIND THIS IN THE SOURCE ===
This page is served from THIS folder, so its source is on disk and grep-able. Locate the EXACT
source of this element using the ranked SEARCH HOOKS below — search by text/attributes/authored-CSS,
NOT by the computed rgb() values or the live DOM selector (those are how it renders, not what the
source says). Use ripgrep; prefer fixed-string (rg -F), and if an exact match returns nothing, widen
to a distinctive substring or retry case-insensitively (rg -iF).

--- Search hooks (ranked; try top-down) ---
1. Visible text (PRIMARY):  "Stay Updated"
     rg -F "Stay Updated"
2. Class stem (maybe build-generated; skip hash-like tokens):  nav-cta
     rg -F "nav-cta"
3. Authored CSS selector (see AUTHORED CSS below):  .nav-cta
     rg -F "nav-cta"
   tag: a  (heads-up: a DOM <a> may be a framework <Link>/<router-link>/<NavLink> in source —
            bridge via the href value below)

--- Smart target (you clicked inside the button) ---
Clicked node:      <span class="label">  text:"Stay Updated"
Nearest container: <a class="nav-cta" href="#newsletter">  text:"Stay Updated"   ← most likely the
                   element you mean to edit ("the button")
     literal href hook:  rg -F 'href="#newsletter"'   (authored relative value, not the resolved URL)

--- If a text hook isn't found as a literal ---
It may be interpolated, loop-rendered, or i18n-keyed. Then: (1) search by tag+class/component; (2)
retry case-insensitively / as a property value (rg -iF "stay updated"); (3) if you find it only in a
locale file, grep the KEY (e.g. nav.stayUpdated) to find usages; (4) find the .map()/v-for emitting
it; (5) widen to data files: --glob *.{js,ts,json,yaml,yml,md,mdx}.

--- AUTHORED CSS (from the page's own stylesheets — GREP THESE) ---
.nav-cta { background: var(--gold); color: #0b0b0b; padding: 0.5rem 1rem; border-radius: 6px; }
(So the colour is the CSS variable --gold — grep `--gold` to find/redefine it, e.g. `rg -F "--gold"`.
 Edit the variable or this rule; do NOT grep the rgb() below.)

--- COMPUTED (rendered) values — NOT source; do NOT grep these ---
background-color: rgb(201, 168, 76);   (source says var(--gold) — grepping this rgb finds nothing)
color: rgb(11, 11, 11);
font-size: 14px;
border-radius: 6px;

--- Raw markup (for entity/structure context) ---
<a href="#newsletter" class="nav-cta"><span class="label">Stay Updated</span></a>

--- Orientation only (NOT a source path) ---
Selector (live rendered-DOM position, not source): body > nav.nav > a.nav-cta
Position: x:1180 y:24 w:132 h:40
```

---

## Testing strategy

All tests in `element-inspector.payload.test.js`, run with `node --test`. TDD: write failing test → implement → pass.

**Existing tests (all 6 must keep passing, untouched):** `CAPTURED_CSS_PROPS` shape; `composePrompt` embeds instruction/url/selector/html/css/rect (note: this asserts the computed `background-color: rgb(255, 255, 255)` value appears **verbatim** — so the re-labelled computed-CSS block MUST still print `<prop>: <value>;`); `composePrompt` tolerates missing css/rect; `buildPickerScript` returns an IIFE string mentioning the hooks; persistent flag toggle; `buildTeardownScript` nulls the namespace.

**New tests for `composePrompt`** (pure, the bulk of coverage):
- Emits the FIND-IN-SOURCE directive and ranked Search Hooks with `rg` commands.
- Ranks visible `text` first; uses `directText` when `textIsLiteralCandidate` is false; falls to `accLabel` when `text` is empty.
- Surfaces LITERAL `href`/`data-testid`/`asset.basename`/`iconRef` as hooks.
- Emits AUTHORED CSS from `matchedRules`; the computed `css` block carries the "do NOT grep" label and sits **after** `matchedRules`.
- Cross-origin path: `matchedRules` empty + `cssCrossOrigin` → honest block naming `stylesheetsBlocked`.
- Repeated-element block appears only when `siblingIndex.of > 1`; re-ranks per-instance attrs; prints `rowContext`.
- Smart-target pair prints clicked node vs container.
- Honest-failure: a `ctx` with no greppable signal → warning framing, no fabricated hook.
- Back-compat: the legacy `{url, selector, html}` ctx composes without throwing.

**New tests for `buildPickerScript`** (string-level, since the guest body can't run under `node:test`): the serialized source contains `MEANINGFUL_SELECTOR`, the attr allowlist, `getAttribute(` (not `.href`), `classList` (not `className.split`), the three-guard `matchedRules` markers, and the `data-*` iteration — guarding against regressions of the specific landmines.

*(Guest-runtime behaviour — actual DOM capture — is verified manually in-app per the manual-verification task, since `executeJavaScript` needs a live webview.)*

---

## Out of scope / deferred (with rationale)

- **Real source-map resolution** — deferred; `source` is the extensible hook so it drops in later with no format change.
- **New IPC / main-process grep** before injection — violates feature isolation; the receiving agent already greps better.
- **`matchedRules` for the ancestor** — YAGNI/cost (a second O(sheets×rules) scan per click); ancestor gets a light snapshot.
- **`@media`/`@supports` rule recursion** — too costly + re-introduces throw surface; top-level `CSSStyleRule` only.
- **Piercing shadow DOM** — `closest()` can't cross it; instead detect the custom-element tag and point at `customElements.define`.
- Reading `el.href`/`el.src`/`el.dataset` — actively harmful (resolved-absolute / camelCased keys); always `getAttribute` with raw names.
- Calling `innerText` during `onMove` — forces reflow; click-only.

## Open risks (acknowledged, not solved)

1. **`source:{}` is common on real React pages** (React 19 removed `_debugSource`); component name is the best React hook and may be minified. The durable fix (source-map resolver) is deferred.
2. **Remote-CMS/API text** lives in no committed file — unlocatable by any signal; the prompt points at the template and says so.
3. **One looped template = one source literal**; `siblingIndex`+`rowContext` find the DOM instance and data row, but "edit just this one duplicate" can be impossible without reachable per-item data.
4. **`matchedRules` can be empty same-origin** (CSS-in-JS `insertRule`, inline `style`, constructed sheets) or miss a governing rule in a media query / descendant selector — so the computed-CSS trap can persist for some elements; mitigated by hash demotion + honest wording, not eliminated.
5. **Whitespace/normalization drift** can defeat an exact grep even on unique text; mitigated by `directText` + "widen to substring/`-iF`", not guaranteed across a source line break.
6. **Content-free graphics** (bare `<canvas>`/decorative spacer, hashed class, no text/label/asset) have no element-level source token — the honest-failure path admits this rather than misleading. Deliberate non-resolution.
7. **Large stylesheets:** even capped, `matches()` across thousands of rules runs per click — a brief hitch possible on pathological pages; acceptable for one-shot click, never `onMove`.
8. **Prompt bloat:** many sections + raw html + computed css compound; mitigated by per-field caps and emit-if-present gating, but a deeply nested element with many `data-*` can still be long.
9. **Repeated-sibling detection is a heuristic** — may false-positive (noisy "item N of M") or false-negative on hashed per-instance classes.
10. **`pseudoContent`** is a CSS-serialized string (quotes, escaped `\f002`) — a signal that text is CSS-generated more than a verbatim grep key.

---

## Files touched

- **Modify:** `renderer/features/element-inspector/element-inspector.payload.js` — extend `snapshot()` (inside `buildPickerScript`), rewrite `composePrompt()`, add serialized constants/helpers.
- **Modify:** `renderer/features/element-inspector/element-inspector.payload.test.js` — new `composePrompt` + `buildPickerScript` tests.
- **No other files.** Renderer already passes `ctx` straight to `composePrompt`; the picker builder already serializes constants. (`.claude/rules/element-inspector.md` / `FEATURE-MAP.md` get a one-line note that the payload now captures source-locating signals — docs only.)
