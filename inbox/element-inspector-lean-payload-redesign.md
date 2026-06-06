# Element Inspector — lean payload redesign (2026-06-02)

## The problem you raised

When you click an element with the "Pick an element to send to an agent" crosshair, it pasted ~22
lines into the agent. Your example (the `Projects` nav link):

```
I'm looking at this element on the page http://localhost:8765/
My request: make this green!
--- Element ---
Selector: #nav > div.nav-links > a:nth-of-type(1)
<a href="/projects.html">Projects</a>
--- Applied styles ---
display: block; position: relative; box-sizing: border-box;
width: 79.9271px; height: 21.7604px; margin: 0px; padding: 0px;
border: 0px none rgb(240, 237, 232); color: rgb(240, 237, 232);
background-color: rgba(0, 0, 0, 0);
background: rgba(0, 0, 0, 0) none repeat scroll 0% 0% / auto padding-box border-box;
font-family: Inter, ...; font-size: 13.6px; font-weight: 400; line-height: 21.76px;
text-align: start; flex-direction: row; justify-content: normal; align-items: normal;
gap: normal; grid-template-columns: none; grid-template-rows: none;
border-radius: 0px; opacity: 1; z-index: auto; overflow: visible;
--- Position ---
x:1392 y:39 w:80 h:22
```

## What's useful vs useless (the core insight)

The agent receiving this runs **in your project folder with filesystem access**. Its job is to
turn what you pointed at into a `grep`/`rg` query that lands on the **source line**, then edit it.
So the only question that matters: *what is actually greppable in your source code?*

- **Greppable (author-typed):** tag name, attribute values (`href`/`src`/`id`/`class`/`data-*`),
  visible text. All carried by `outerHTML` + the selector.
- **NOT greppable (browser-computed):** everything under `--- Applied styles ---` and `--- Position ---`.

`getComputedStyle` returns **resolved** values, not what's in your source:
- `width: 79.9271px` — a sub-pixel *layout result*. Nobody wrote that.
- `color: rgb(240, 237, 232)` — your source has `#f0ede8` / a CSS var / a utility class, not this rgb.
- `background: ... repeat scroll 0% 0% / auto padding-box border-box` — the fully-expanded shorthand
  of all-default sub-properties. ~60 chars of pure noise.
- `display: block`, `margin: 0`, `opacity: 1`, `z-index: auto`, the whole flex/grid block — browser
  defaults this element never declared.
- `x:1392 y:39 w:80 h:22` — viewport pixels. The agent edits files, not a canvas; this locates nothing.

That's ~13 of 22 lines that get **zero grep hits** and bury the two lines that actually matter.

## What it sends now (the same element)

```
Element to change on http://localhost:8765/
Request: make this green!

Markup: <a href="/projects.html">Projects</a>
Text: "Projects"
Path: #nav > div.nav-links > a:nth-of-type(1)
Nearest stable ancestor: <div> .nav-links (1 level up)
Find it: grep a distinctive token from Markup/Text/Path above (href, data-testid, text, or
ancestor class). Hash-looking classes (sc-/css-/CamelHash) and data-v-* are build artifacts —
don't grep them.
```

~5–8 lines instead of ~22, with *more* locating signal, not less.

### Kept (and why)
- **URL** — one slim line; orients the agent to which served route/page → which template dir.
- **Request** — the task. Non-negotiable.
- **Markup (outerHTML)** — the source line; highest grep signal (`href`, text, attrs).
- **Path (selector)** — kept for its greppable *parts* (`#nav`, `.nav-links`) and the `:nth-of-type`
  ordinal that disambiguates repeated elements; not presented as a literal grep string.

### Added (cheap, load-bearing)
A multi-angle design workflow stress-tested "just selector + outerHTML" against awkward real
elements and proved it isn't always enough — so two ~1-line additions close the gaps:
- **Text** — explicit trimmed `textContent`. For styled-components / emotion components whose
  classes are build hashes (`sc-bdVaJa`, `css-1q2w3e4`), the visible text is the *only* greppable
  token. Labelled "may be JS-injected" so the agent doesn't grep a runtime value (e.g. a cart count).
- **Nearest stable ancestor** — walks up to the first ancestor with a real source hook (`id` →
  `data-testid`/`data-test`/`data-cy` → `aria-label` → a non-hash class). Rescues SVG `<path>`s,
  anonymous `<div>`/`<span>` leaves, and framework components. `data-testid` is the best grep target
  in modern apps.
- **"Find it" steer** — one line telling the agent which token to grep and to ignore build hashes.

### Dropped (intentionally, do not re-add)
- **All 25 computed CSS longhands** — browser-resolved, ungreppable, ~634 chars of noise.
- **Pixel bounding box** — viewport geometry, uncopyable into source.

## What changed in code

Entirely inside the `element-inspector` feature — **no cross-feature edits**:

- `renderer/features/element-inspector/element-inspector.payload.js`
  - `composePrompt` rewritten to the lean 5–8 line format.
  - Removed `CAPTURED_CSS_PROPS` (clean removal — no stub).
  - Guest `snapshot()` now returns `{html, text, selector, anchor, url}` (no `css`, no `rect`); no
    longer calls `getComputedStyle`. Added a `nearestStableAnchor()` helper (with build-hash
    exclusion) into the guest IIFE.
  - The live hover-highlight box still uses `getBoundingClientRect` in its own `onMove` — untouched.
- `renderer/features/element-inspector/element-inspector.payload.test.js` — updated to assert the
  lean format, the new `text`/`anchor` lines, and the **absence** of computed CSS / rect.
- `renderer/features/element-inspector/element-inspector.guest-snapshot.test.js` — **new**: runs the
  guest picker IIFE in a Node `vm` against DOM stubs to verify `snapshot()` / `nearestStableAnchor()`
  (the browser-only logic that can't be imported), incl. the styled-components / data-testid / deep
  anonymous cases.
- Living docs synced: `.claude/rules/element-inspector.md`, `FEATURE-MAP.md`.

## Tests

`node --test renderer/features/element-inspector/*.test.js` → **18 passing** (8 payload + 5
guest-snapshot + 5 lifecycle). The sticky-toggle state machine (re-arm on Esc, refresh-while-armed
recovery) is unaffected.

## Note

There's an older untracked design doc (`docs/2026-06-02-element-inspector-source-locator-*.md`) that
sketched the **opposite** direction — *adding* matched CSS rules, `data-source-loc`, ranked search
hooks. That was never built. Your directive here was subtractive ("only what's necessary to find
what I'm pointing at, efficiently"), and this change implements that. Left the old doc as a
historical record; did not act on it.
