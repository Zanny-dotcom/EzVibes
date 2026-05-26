# Research Pack 11 — Hover Quick Look & Peek Interactions for the Prompt Vault

**Research focus:** how to preview a markdown file *before* it gets pasted into the terminal — i.e. the "hover over a `.md` chip, see the rendered prompt floating beside it" experience. Drawing on the most influential 2025–2026 desktop and web UI work, the macOS Quick Look heritage, and the modern Floating UI / Radix / Popover-API stack.

---

## 0. The Pioneer Vision (TL;DR before the deep dive)

For the EZvibes vault, the **state-of-the-art 2026 interaction** is a three-stage peek:

1. **Hover ≈ 120 ms (mouse stationary 120 ms)** — the row lights up; a 1px chevron appears on the right.
2. **Hover ≈ 400 ms total** — a *Quick Look-style* preview card materialises (frosted Liquid-Glass, rounded 12px, soft 0/8/32 shadow) positioned to the right of the row using **CSS Anchor Positioning** + a Floating-UI `flip()` fallback for screen edges.
3. **Pin-on-click / Space-to-pin** — clicking the row (or pressing Space, à la macOS) "pins" the preview so the user can scroll its contents, copy fragments, or scrub the cursor away without losing it. The right edge of the card grows a "paste" affordance.

This pattern fuses the **macOS Quick Look** mental model with **Arc Glance**, **Notion link previews**, and **Linear's hover card** — three of the most copied desktop UX patterns of the last two years — and uses native browser APIs that didn't exist 18 months ago (CSS Anchor Positioning + Popover API in the top layer, transitionable via `@starting-style` and `allow-discrete`).

The single most exciting pioneer-level idea found in this research: **a "safe-polygon corridor with an embedded paste laser"** — the preview popover stays open as long as the cursor is inside the safe-polygon between the row and the card, but the card itself sprouts a single tracked "paste here" hot-zone that *follows the active terminal tab's cursor position*. So the user's mouse motion from preview → terminal is uninterrupted, and the moment the cursor crosses the card→terminal edge, a 60 ms ghost-line animation shoots from the card to the prompt cursor and the markdown content is committed. This is the closest a web stack has come to making paste feel "spatial". See §11.

---

## 1. The macOS Quick Look heritage — what to copy

macOS Quick Look (Space-to-preview in Finder) has been the gold standard since 2007 and remains the implicit benchmark for **"reveal content without opening the app"**.

Key design choices to copy verbatim:

| Quick Look behaviour | What it does | Apply to the vault |
|---|---|---|
| **Spacebar = open** | Instant, no menu, no modifier | Use **Space** while a vault row has keyboard focus to open the floating preview. Mirrors muscle memory of every Mac user. |
| **Arrow keys cycle** | While preview is open, ↑/↓ in the underlying file list updates the preview live | When the preview is pinned, ↑/↓ in the vault list re-targets the preview at the next file without closing/reopening. |
| **Esc / Space again = close** | Same gesture toggles | Esc dismisses, Space also dismisses. |
| **Zoom transition** | A subtle scale-from-thumbnail animation | Use `transform-origin` at the row position, scale from `0.92 → 1` with opacity over **180 ms** on open and **120 ms** on close (asymmetric — see §6). |
| **Markdown preview is rendered, not raw** | macOS 26 (Tahoe) Quick Look renders `.md` via plugins like **showmd** ([github.com/johannesnagl/showmd](https://github.com/johannesnagl/showmd)) | Render the markdown — never show raw `#` and `*` characters. |
| **No keyboard focus stolen** | Quick Look does not interrupt typing in the source pane | The preview popover must NOT receive focus by default. The terminal stays focused so the moment the user clicks "paste" the keystrokes go into the right pty. |

A direct quote from the macOS design philosophy is worth tattooing on the wall: *"This small interaction captures something essential about macOS design — removing friction wherever possible. Instead of forcing you to open an app just to confirm what a document contains, Quick Look delivers clarity in seconds."* ([applemagazine.com](https://applemagazine.com/quick-look-features-02f2))

**The Apple Liquid Glass design language (2025/iOS 26 / macOS Tahoe 26)** has made Quick Look windows translucent with refractive edges. EZvibes isn't iOS but the visual idiom is now expected for "premium" desktop apps in 2026 — see §9 for CSS.

References:
- [applemagazine.com — Quick Look Features](https://applemagazine.com/quick-look-features-02f2)
- [creativetechs.com — Quick Look on Finder](https://www.creativetechs.com/2024/12/10/use-quick-look-to-preview-files-and-folders-in-the-finder-spotlight-and-open-dialogs/)
- [showmd — Quick Look extension for markdown](https://showmd.yetanother.one/)
- [smittytone — PreviewMarkdown / PreviewCode Quick Look plugins](https://smittytone.net/previewcode/)
- [github.com/rkrug/parquet-spotlight-quicklook — Spotlight + Quick Look integration example](https://github.com/rkrug/parquet-spotlight-quicklook)

---

## 2. The 2026 library landscape — pick **Floating UI**, ignore Tippy.js

The single biggest shift since 2024 is that **Tippy.js is now in maintenance mode** (security patches only) because it depends on Popper, which has been superseded by Floating UI. Tippy's own author wrote Floating UI as the next-gen positioning engine and the larger ecosystem has migrated.

### Library matrix (mid-2026)

| Library | Use it when | Weekly DLs | Notes |
|---|---|---|---|
| **`@floating-ui/dom`** (vanilla) | EZvibes's vanilla JS stack ← **this is the one** | 12M+ | Pure positioning engine, no React deps |
| `@floating-ui/react` | If you ever migrate to React | 12M+ | Adds `useHover`, `useClick`, `useDismiss`, `useTransitionStyles`, `safePolygon`, `FloatingDelayGroup` |
| **Radix Hover Card** (`@radix-ui/react-hover-card`) | React only | — | Default `openDelay: 700ms`, `closeDelay: 300ms` — the de-facto industry numbers |
| **Native `popover` attribute + CSS anchor positioning** | If you want zero JS | n/a | Baseline 2026: Chromium 125+, Firefox 132+, Safari 18.2+ |
| Tippy.js | Legacy | declining | **Don't pick this for a new feature in 2026.** |
| Headless UI Popover, Chakra Popover, Material UI Popover | Component-kit projects | — | All use Floating UI internally |

Sources:
- [pkgpulse — Floating UI vs Tippy.js vs Radix 2026](https://www.pkgpulse.com/blog/floating-ui-vs-tippyjs-vs-radix-tooltip-popover-2026)
- [Floating UI homepage](https://floating-ui.com/)
- [usertourkit — 10 best tooltip libraries for React in 2026](https://usertourkit.com/blog/best-tooltip-libraries-react-2026)

### Why Floating UI for EZvibes specifically

EZvibes is **vanilla JS, no bundler, no React**. `@floating-ui/dom` is the *only* mainstream option that fits without forcing a build step. It ships ESM and works directly from a CDN:

```html
<script type="module">
  import {
    computePosition,
    autoUpdate,
    offset,
    flip,
    shift,
    arrow
  } from 'https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.7.5/+esm';
</script>
```

If you want a local install (consistent with how `node-pty` is vendored):

```powershell
npm install @floating-ui/dom
```

It's ~5 kB gzipped. No transitive deps that conflict with Electron 33.

---

## 3. The hover delay numbers, as actually used in production

This is the most often-screwed-up part of a hover preview. The 2026 consensus:

| Delay | Where it shines | Source |
|---|---|---|
| **0 ms open, 0 ms close** | Instant tooltips for known-state UI like an icon's accessible name | n/a |
| **100–200 ms** open | Feels "alive" — used inside dense tools (Linear, Figma) | various |
| **300–500 ms** open | The Baymard-recommended dropdown range. Reduces flicker as the cursor traverses lists | [baymard.com — Provide a hover delay of 300–500 ms](https://baymard.com/blog/dropdown-menu-flickering-issue) |
| **600 ms** open | macOS Aqua menus, Apple's own bar | classical |
| **700 ms open, 300 ms close** | **The default Radix Hover Card numbers** — what GitHub PR hover cards, Notion link previews, and Linear use | [Radix Primitives — Hover Card](https://www.radix-ui.com/primitives/docs/components/hover-card) |
| **1000 ms** | The "are you sure?" tooltip for power users | various |

> **Above 600 ms users perceive lag; below 200 ms accidental triggering is common; the sweet spot for dropdown menus is 350–400 ms.** ([copyprogramming.com](https://copyprogramming.com/howto/transition-delay-only-on-hover-out-2), [baymard.com](https://baymard.com/blog/dropdown-menu-flickering-issue))

For a **vault with potentially 50+ entries**, copy Radix's defaults verbatim: **`openDelay = 700`, `closeDelay = 300`**. Once the *first* card has been shown though, switch to ~1 ms inside a "group" so subsequent rows feel instant (see §5 on `FloatingDelayGroup`). Notion, Linear, and Slack all do this — it's the magic that makes hover-heavy UIs feel responsive without being flickery.

### Apple's 600 ms — when to deviate

> *"Apple uses 600ms for menus."*

Use ~600 ms only for **first-time** hovers. After the user has shown intent (one preview opened in the last 3 s) drop to 60–120 ms. This is what makes apps feel "warmed up".

### `restMs` — Floating UI's killer ergonomic option

Most libraries treat hover as a single timer. Floating UI exposes a second axis: `restMs` — the cursor must come to rest (low velocity) for N ms before opening. This is the modern reincarnation of jQuery's `hoverIntent`:

```js
useHover(context, {
  restMs: 150,            // open only when cursor has been still 150ms
  delay: { open: 1000 },  // fallback if cursor never stops moving
});
```

The user's velocity is the signal: a fast scroll past a row should never trigger a preview, but a row the user dwells on should preview almost immediately. ([floating-ui.com — useHover](https://floating-ui.com/docs/usehover))

---

## 4. Safe Polygon — the move that makes hovers feel professional

This is the **single most important UX detail** for a hover-preview UI that has any vertical or horizontal distance between the trigger row and the preview card. It traces back to 1986, when **Bruce "Tog" Tognazzini and Jim Batson at Apple's HID team** invented it. ([mayank.co](https://mayank.co/blog/hover-triangles/))

### The problem

User hovers row A. Preview opens to the right. User starts to move cursor diagonally toward the preview to read/click it. Halfway across, the cursor briefly crosses row B. Naïve hover handlers fire `mouseleave` on A and `mouseenter` on B, closing A's preview and opening B's. The user's destination card vanishes from under their cursor. Frustrating. Old Amazon mega-menus did this for years until Ben Kamens wrote ["Breaking Down Amazon's Mega Dropdown" (2013)](https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown).

### The solution

Compute an invisible triangle (or curve) from the cursor position to the four corners of the floating element. While the cursor is *inside* that polygon, suppress close. Once the cursor leaves the polygon, close.

### Modern terminology / brand names

- **Floating UI** calls it `safePolygon` ([floating-ui.com — safePolygon](https://floating-ui.com/docs/usehover))
- **Radix UI Hover Card** has it built into its event handling
- **Ariakit** ships it
- The classical names: **hover triangle**, **amazon triangle**, **hover tunnel**, **extended mouse corridor**

### Floating UI vanilla implementation (for EZvibes)

Floating UI's `safePolygon` only ships in `@floating-ui/react`. For vanilla JS you implement it manually. The Smashing Magazine code skeleton is:

```js
// SVG safe triangle inside the floating card, positioned at cursor on row leave
const svg = document.querySelector('.safe-area');
const path = svg.querySelector('path');
svg.style.pointerEvents = 'none';   // svg lets clicks through
path.style.pointerEvents = 'auto';  // path catches mouse

// On mouseleave from the row:
const update = (e) => {
  const cardRect = floating.getBoundingClientRect();
  const mouseY = e.clientY;
  const submenuY = cardRect.top;
  path.setAttribute('d', `
    M 0,${mouseY - submenuY}
    L ${cardRect.width},${cardRect.height}
    L ${cardRect.width},0
    z
  `);
};
```

The path geometry comes from the [Smashing Magazine article](https://www.smashingmagazine.com/2023/08/better-context-menus-safe-triangles/). Hakim El Hattab's [CSS Day 2019 talk](https://team.slides.com/hakimel/cssday-2019) refined this into an SVG **curve** that arcs *around* nearby interactive elements — see §11 for how to combine this with paste-trigger zones.

> **"A 'safe' polygon is one that a pointer is safe to traverse as it moves off the reference element and toward the floating element after hovering it. If the pointer moves outside of this safe area, the floating element closes."** — Floating UI docs

### `safePolygon` options in Floating UI

```js
useHover(context, {
  handleClose: safePolygon({
    requireIntent: true,   // require cursor velocity toward the floating element
    buffer: 0.5,           // px buffer around the polygon (default 0.5)
    blockPointerEvents: false,
  })
});
```

- `requireIntent: true` (default) — only generate the triangle if cursor velocity is toward the floating element (prevents accidental opens during fast scrolling).
- `buffer: 1` — slightly forgiving for slow movers.
- `buffer: -Infinity` — rectangle-only mode (no triangle, just a rectangle around the floating element).
- `blockPointerEvents: true` — adds `pointer-events: none` to everything outside the polygon, so the user *can't* hover other rows accidentally.

Source: [floating-ui.com — useHover](https://floating-ui.com/docs/usehover)

---

## 5. `FloatingDelayGroup` — the second move that makes hovers feel professional

When you have a **dense list** like a vault of 50 .md files, individual 700 ms delays on each row feel awful (the user scans down the list and nothing previews). The fix is delay grouping: after the first preview opens, subsequent siblings open with effectively zero delay until the group "cools down".

```jsx
// React version, conceptually:
<FloatingDelayGroup delay={{ open: 700, close: 200 }} timeoutMs={500}>
  {files.map(f => <VaultRow key={f.id} file={f} />)}
</FloatingDelayGroup>
```

> *"Provides context for a group of floating elements that should share a delay which temporarily becomes 1 ms after the first floating element of the group opens."* — [floating-ui.com — FloatingDelayGroup](https://floating-ui.com/docs/floatingdelaygroup)

`timeoutMs` extends the "warm" period; set it to ~500 ms so a user scanning the list with quick pauses keeps the instant-open behaviour.

### Vanilla port for EZvibes

Floating UI doesn't ship a vanilla equivalent, but you implement it with a single shared timer:

```js
const vaultGroup = {
  warm: false,
  timer: null,
  warmFor(ms = 500) {
    this.warm = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.warm = false; }, ms);
  }
};

function vaultHover(row) {
  const delay = vaultGroup.warm ? 1 : 700;
  row.timer = setTimeout(() => {
    showPreview(row);
    vaultGroup.warmFor();
  }, delay);
}
```

Slack, Linear, and GitHub all use a variation of this pattern. Once you notice it you'll see it everywhere — the second tooltip you hover in a row is *snappy* in a way the first one isn't.

---

## 6. Animated "staged" reveals — outline → ghost → full content

A reveal that takes 250 ms feels expensive. A reveal that takes 250 ms but visibly progresses through three stages feels **fast**, because each stage gives the eye something to track.

### Stage 1 — Outline (0 → 40 ms)

Just the card frame: a translucent border + shadow, no content. This is what Notion does when it loads a link preview from the network: the outline appears before the API call returns.

```css
.vault-card[data-status='initial'] {
  opacity: 0.4;
  transform: scale(0.96) translateY(4px);
}
```

### Stage 2 — Ghost (40 → 120 ms)

Skeleton shimmer for title + a few lines, in case the markdown render takes >16 ms (it shouldn't, but on a 200-line `.md` it could). The eye sees structure before content. Use a 120 ms linear-gradient sweep:

```css
.vault-card__skeleton {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.10) 50%,
    rgba(255,255,255,0.04) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
```

### Stage 3 — Full content (120 → 250 ms)

Markdown rendered, opacity to 1, transform to identity. Use a **stagger** (35 ms between top-level block elements) so the first paragraph feels alive before the last. This is the [Codrops "Layout with Reveal Animations and Content Preview" technique](https://tympanus.net/codrops/2021/07/28/layout-with-reveal-animations-and-content-preview/) updated for 2026.

### `useTransitionStyles` (Floating UI React) — the easy way

```jsx
const {isMounted, styles} = useTransitionStyles(context, {
  duration: { open: 220, close: 120 },        // asymmetric
  initial: ({side}) => ({
    opacity: 0,
    transform: side === 'left' ? 'translateX(8px)' : 'translateX(-8px)',
  }),
  common: { transformOrigin: 'left center' },
});
```

The asymmetric `{ open: 220, close: 120 }` is a borrowed Apple trick — closing should always feel **snappier** than opening. ([floating-ui.com — useTransition](https://floating-ui.com/docs/usetransition))

### Vanilla version with the Popover API + `@starting-style`

```css
.vault-card {
  /* base styles */
  opacity: 0;
  transform: translateX(8px) scale(0.96);
  transition:
    opacity 220ms ease,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
    display 220ms allow-discrete,
    overlay 220ms allow-discrete;
}

@starting-style {
  .vault-card:popover-open {
    opacity: 0;
    transform: translateX(8px) scale(0.96);
  }
}

.vault-card:popover-open {
  opacity: 1;
  transform: translateX(0) scale(1);
}
```

`@starting-style` and `allow-discrete` are 2026 baseline — they're what allow you to animate `display: none → block` without JS. ([MDN — Popover API / Using](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using))

---

## 7. Pin-on-click — hover preview becomes sticky

The classical hover popover has one fatal flaw on desktop: as soon as the cursor enters the popover content to scroll/select/copy, the popover ought to stay. Modern best practice:

1. Hover → preview shows after `openDelay`.
2. Cursor crosses the safe polygon and enters the floating card → it stays open even if the underlying row loses hover (because the card itself is now hovered).
3. **Click** on the card (anywhere not a button) → the card becomes **pinned** — a small pin icon appears in the corner, the row's "hover state" is locked, and `mouseleave` from the card no longer closes it. Now the user can scroll, select text, copy snippets.
4. Press **Esc**, or click anywhere outside, or click the pin icon → unpin/close.

Obsidian's [Hover Editor](https://github.com/nothingislost/obsidian-hover-editor) is the gold standard for this pattern — quotes from the README:

> *"Transforms the page preview into a fully-fledged editor instance... Pin feature prevents auto-closing and enables multiple simultaneous popovers; auto-pins when dragged or resized... Double-click the drag handle to collapse the window."*

Linear's issue hover card pins on click + Esc unpins. GitHub's PR hover card on the dashboard does the same. **Notion popovers can be torn off into floating panels** since the 2024 redesign.

### Implementation pattern

```js
// State machine
const card = {
  state: 'closed', // 'closed' | 'hovering' | 'pinned'
  trigger: null,
};

function openHover(row) { card.state = 'hovering'; card.trigger = row; render(); }
function pin()          { card.state = 'pinned'; render(); }
function unpin()        { card.state = 'closed'; render(); }

// `useDismiss` (Floating UI) gives you free Esc + outside-click handling
// Or for vanilla, use the Popover API's `auto` light-dismiss when not pinned
// and `manual` mode after pinning.
```

The Popover API even has a perfect API for this state change: just *change the `popover` attribute value* from `"auto"` to `"manual"` when pinned. After pinning, the user can have multiple cards open at once (manual mode allows simultaneous), exactly how Obsidian Hover Editor works.

---

## 8. Inline vs floating preview — the decision tree

| Pattern | When to use | Pros | Cons |
|---|---|---|---|
| **Inline expand** (accordion-style, the card grows in place of the row) | Single-column lists, mobile | Discoverable, no positioning math | Shifts surrounding rows, feels heavy |
| **Floating side-card** (right of the row) | Two-column-friendly layouts ← **EZvibes's case** | Quick Look mental model, no layout shift | Needs flip/shift for edge cases |
| **Bottom drawer** | Mobile, very small screens | Familiar | Wrong feel for desktop |
| **Detail pane (Raycast / Linear)** | Permanent right pane that updates as you arrow through the list | No flicker, very fast | Eats screen real estate |

For EZvibes, **floating side-card** when the user *hovers*, and on a power-user shortcut (Cmd/Ctrl+I) you could **toggle a Raycast-style permanent detail pane** as well — the same preview component, mounted in a sidebar instead of a popover. Raycast's design uses this exact dual-mode: ⌘+Y opens Quick Look in a floating card; ⌘+J toggles the right-side detail pane permanent.

Source: [Raycast — File Search](https://www.raycast.com/core-features/file-search), [Mobbin — Command Palette Design](https://mobbin.com/glossary/command-palette)

---

## 9. The visual style — Liquid Glass / 2026 frosted

For a tool that already has the orange-folder Genie aesthetic, the preview card should feel like **a piece of magic glass laid over the terminal**. Apple's Liquid Glass (introduced at WWDC 2025, shipping in iOS 26 / macOS Tahoe 26) is the obvious reference — but it's incredibly hard to reproduce in pure CSS, and trying to fake it badly looks dated immediately. Here's the calibrated middle road.

### The baseline frosted glass popover (works in Electron 33 / Chromium today)

```css
.vault-card {
  /* Layout */
  position: fixed;            /* or position: absolute when in popover top layer */
  inset: auto;
  width: 380px;
  max-height: 60vh;
  padding: 16px 18px;
  border-radius: 14px;

  /* Glass */
  background: rgba(24, 26, 30, 0.62);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);

  /* Outline + shadow */
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,    /* subtle inner highlight */
    0 8px 24px rgba(0, 0, 0, 0.35),                /* mid shadow */
    0 32px 64px rgba(0, 0, 0, 0.45);               /* far shadow for depth */

  /* Content */
  color: #e8e8e8;
  font: 13px/1.55 -apple-system, "Segoe UI", system-ui, sans-serif;
  overflow: hidden;             /* container is rounded; inner scroller does the scroll */
}

.vault-card__scroller {
  max-height: calc(60vh - 60px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.18) transparent;
  padding-right: 4px;
  /* Allows the rounded corners to still clip nicely */
  mask-image: linear-gradient(to bottom,
    transparent 0, black 12px,
    black calc(100% - 12px), transparent 100%);
}
```

### Pitfalls Josh Comeau enumerated

[Josh Comeau's "Next-level frosted glass with backdrop-filter"](https://www.joshwcomeau.com/css/backdrop-filter/) lists the gotchas:

- `backdrop-filter: blur()` **only considers pixels directly behind**, so when the card sits over the boundary between the terminal and the vault sidebar you can get a hard edge. Extend the blur element 200% and clip with a mask.
- `border-radius` and `mask-image` fight each other — use an SVG mask if you need both *and* a hard cut at the bottom for a "frosted edge" detail.
- `pointer-events: none` on the extended portion so it doesn't capture clicks.
- Add `@supports (backdrop-filter: blur(16px))` fallbacks (Electron 33 is recent enough this is mostly cosmetic).

### Liquid Glass-ish details (cheap wins)

- A **1px inner top highlight** (`box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset`) sells the "real glass edge".
- A **micro saturation boost** in `backdrop-filter: blur(18px) saturate(160%)` makes the terminal text reading through it feel rich rather than washed out.
- A **2 px brighter rim** along the side closest to the trigger row — implemented as a thin border-image gradient — implies refraction.

The full GitHub-hosted Liquid Glass recreations worth studying:
- [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) — SVG-filter–based, pixel-perfect, comes with `LiquidGlass`, `LiquidText`, `LiquidButton`. Heavy but stunning.
- [liquidglassui.org](https://liquidglassui.org/) — React/Next components.
- [css-tricks.com — Getting Clarity on Apple's Liquid Glass](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/) — explains *why* pure CSS can't fully replicate it.
- [LogRocket — Adopting Apple's Liquid Glass](https://blog.logrocket.com/ux-design/adopting-liquid-glass-examples-best-practices/)

For EZvibes, **don't try to ship the SVG-filter version** — it adds 30 lines of `<filter>` markup and a noticeable GPU cost. The baseline frosted+saturated+inner-highlight combo above is 85% of the visual win at 5% of the cost.

### Production recommendation for the vault popover blur

> **12–16 px blur is the ideal range** — enough to read text comfortably, not so much that the background becomes mud. [css-zone.com — Backdrop Filter & Glassmorphism](https://css-zone.com/blog/backdrop-filter-glass-morphism)

---

## 10. Smart positioning — flip when near screen edge

Built-in to Floating UI as the `flip` middleware. Without it, the popover will clip into the right edge of the BrowserWindow when the vault is on the right of the screen, or into the top when the row is near the top.

### Vanilla usage

```js
import {
  computePosition, autoUpdate,
  offset, flip, shift, arrow
} from '@floating-ui/dom';

const arrowEl = card.querySelector('.vault-card__arrow');

function position(reference, floating) {
  return computePosition(reference, floating, {
    placement: 'right-start',
    middleware: [
      offset(12),                            // gap between row and card
      flip({                                  // flip to 'left' if no room
        fallbackPlacements: ['left-start', 'top-start', 'bottom-start'],
        padding: 8,
      }),
      shift({ padding: 8 }),                  // slide within viewport
      arrow({ element: arrowEl, padding: 8 }) // pointer triangle
    ],
  });
}

function attach(reference, floating) {
  return autoUpdate(reference, floating, async () => {
    const {x, y, placement, middlewareData} = await position(reference, floating);
    Object.assign(floating.style, { left: `${x}px`, top: `${y}px` });
    floating.dataset.placement = placement;

    // Arrow positioning
    const {x: ax, y: ay} = middlewareData.arrow ?? {};
    const side = placement.split('-')[0];
    const staticSide = { top:'bottom', right:'left', bottom:'top', left:'right' }[side];
    Object.assign(arrowEl.style, {
      left: ax != null ? `${ax}px` : '',
      top:  ay != null ? `${ay}px` : '',
      [staticSide]: '-4px',
    });
  });
}
```

> **`flip()` must come before `shift()` in the middleware array.** Otherwise `shift` slides the element and then `flip` thinks it has room and won't flip. ([floating-ui.com — flip](https://floating-ui.com/docs/flip))

> **Use `!= null` checks for arrow coords**, because either x or y can legitimately be `0`. ([floating-ui.com — arrow](https://floating-ui.com/docs/arrow))

### `autoUpdate` options

```js
autoUpdate(reference, floating, update, {
  ancestorScroll: true,    // re-position when any ancestor scrolls
  ancestorResize: true,    // re-position on resize events
  elementResize: true,     // ResizeObserver on both elements
  layoutShift: true,       // IntersectionObserver for layout changes
  animationFrame: false,   // true only if the floating element is animating transforms
});
```

Disable `animationFrame` unless you need it — it runs every rAF tick. ([floating-ui.com — autoUpdate](https://floating-ui.com/docs/autoupdate))

### Native CSS Anchor Positioning — no JS at all

If you want a pure-CSS variant (works in EZvibes because Electron 33 ships Chromium 125+):

```html
<button class="vault-row" popovertarget="vault-popover-1" id="row-1">prompt.md</button>
<div id="vault-popover-1" popover class="vault-card">…</div>
```

```css
#row-1 { anchor-name: --row-1; }

#vault-popover-1 {
  position: fixed;
  position-anchor: --row-1;
  position-area: right span-y;   /* card sits to the right, centered vertically */
  position-try-fallbacks:
    --left-anchor,
    --top-anchor,
    --bottom-anchor;
  margin-left: 12px;
  width: 380px;
  max-height: 60vh;
}

@position-try --left-anchor {
  position-area: left span-y;
  margin: 0 12px 0 0;
}
@position-try --top-anchor    { position-area: top span-x;    margin-bottom: 12px; }
@position-try --bottom-anchor { position-area: bottom span-x; margin-top: 12px; }
```

Zero JS for positioning + flipping. The trigger is a normal `<button popovertarget="…">` and the show/hide is browser-native. The light-dismiss (click outside / Esc) is built in. This is genuinely magical and only became viable in 2026.

Sources:
- [pockit.tools — CSS Anchor Positioning Complete Guide](https://pockit.tools/blog/css-anchor-positioning-api-complete-guide/)
- [botmonster.com — CSS Anchor Positioning Tooltips & Popovers](https://botmonster.com/web-dev/css-anchor-positioning-tooltips-popovers/)
- [css-tricks.com — Working With Multiple CSS Anchors and Popovers Inside the WordPress Loop](https://css-tricks.com/working-with-multiple-css-anchors-and-popovers-inside-the-wordpress-loop/)

---

## 11. The pioneer-level synthesis — paste-laser preview

This is the idea I'd actually build into EZvibes if it were my codebase. It combines:

- **Arc Glance / Quick Look** — instant peek of contents.
- **Safe polygon** — corridor from row to card.
- **Liquid Glass** — translucent card over the terminal.
- **The Popover API + Anchor positioning** — native, zero-JS positioning.
- **Custom paste affordance** that's spatially anchored to the active terminal tab.

### The flow

1. **Vault is open as a left rail** inside the session window.
2. User hovers row `Refactor-strategy.md`.
3. `restMs: 120` — once cursor is still for 120 ms, the preview card materialises to the right of the row, anchored to the row via CSS Anchor Positioning. Liquid Glass styling makes the terminal text visible *through* the card, faintly. Staged reveal: outline (0–40 ms) → ghost (40–120 ms) → rendered markdown (120 ms+).
4. User starts moving mouse diagonally toward the card. Safe polygon activates (Floating UI `safePolygon({ requireIntent: true, buffer: 1 })`). Cursor can scrub across other rows without closing the preview.
5. Cursor enters the card. The card subtly highlights its bottom-right "paste here" affordance — a 32 px tall ribbon with a `→` icon and the active tab's name: "Paste into CLAUDE 2".
6. The ribbon's *position* is dynamic: it's anchored to the right edge of the card but **points at the terminal tab's text cursor position** (which we know because we own the xterm instance and can read `term.buffer.active.cursorY`). The ribbon's chevron arrow physically angles toward the prompt.
7. User clicks the ribbon. A 60 ms `View Transition` animation flies the markdown text out of the card as a "ghost line" that lands at the cursor. The PTY receives the content via `terminal:input`. The card stays pinned for 800 ms so the user sees what was sent, then fades out.
8. (Optional power-mode) **Cmd+drag from the card to the terminal** — the markdown drops at whatever line the cursor was on. Spatial drag-and-paste.

### Why each piece matters

- **CSS Anchor Positioning** means the card can re-anchor instantly when the vault scrolls. No `autoUpdate` callbacks, no JS layout thrash. Zero cost.
- **Safe polygon** prevents the "I tried to grab my preview and lost it" frustration that 90% of cheap hover-card implementations have.
- **Spatial paste ribbon** is the part I've never seen anywhere — Notion sends links, GitHub previews PRs, Linear previews issues, but no one **previews a thing and pastes it at a known cursor inside the same window**. EZvibes's unique position (it *owns* the terminal pty) means the paste target is knowable. This is genuinely novel.
- **View Transitions API** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)) lets you animate a snapshot from one position to another even when the DOM completely changes. Chromium 111+, in Electron 33 already.

### The "ghost-line" implementation sketch

```js
// On paste click:
async function pasteWithGhost(card, terminal, markdown) {
  if (!document.startViewTransition) {
    // Fallback: just send the text
    return terminal.send(markdown);
  }

  // 1) Snapshot the markdown text inside the card as a transition pseudo
  card.dataset.transition = 'flying';

  // 2) Compute the terminal cursor's pixel position
  const cursorXY = terminal.getCursorPixelPosition();

  await document.startViewTransition(() => {
    // 3) Move the card text element to a position over the terminal cursor
    const ghost = card.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.left = `${cursorXY.x}px`;
    ghost.style.top  = `${cursorXY.y}px`;
    ghost.style.transform = 'scale(0.4)';
    document.body.append(ghost);
  }).finished;

  // 4) Now actually send the text to the PTY
  terminal.send(markdown);
}
```

The View Transition API takes care of the morph; the user sees the markdown literally fly from the card to the cursor. **This is the pioneer move.**

---

## 12. Render markdown safely

For an Electron app that **runs `claude --dangerously-skip-permissions`**, the markdown files in the vault are intentionally user-trusted, but a single malicious `<img onerror>` in a hand-off file from another session could still XSS the renderer process and from there reach the main process. So sanitise.

### The 2026 stack

| Library | Purpose | Notes |
|---|---|---|
| **`marked`** | Markdown → HTML | Fastest, ~30 kB. `marked.parse(md)` |
| **`DOMPurify`** | HTML sanitiser | Cures all marked vulns by removing dangerous attrs |
| **`@uiw/react-markdown-preview`** | GitHub-style render | React; also has CSS file to copy if you want the look |
| **`react-markdown`** + `remark-gfm` + `rehype-sanitize` | Safe by default | React only |
| **Shiki** | Syntax highlight for code blocks | Beautiful (uses VS Code grammars), heavier than highlight.js |
| **highlight.js** | Syntax highlight | Lighter, auto-detect, 190+ langs |

The recommended pattern for EZvibes (vanilla):

```js
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

marked.use({
  highlight(code, lang) {
    return hljs.highlightAuto(code, [lang]).value;
  }
});

function safeRenderMarkdown(md) {
  const dirty = marked.parse(md);
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','strong','em','ul','ol','li',
                   'code','pre','blockquote','hr','a','img','span','div','br',
                   'table','thead','tbody','tr','td','th'],
    ALLOWED_ATTR: ['href','title','class','src','alt'],
    ALLOW_DATA_ATTR: false,
  });
}
```

A real-world XSS-in-Electron-markdown post-mortem worth reading: [DeepChat openExternal RCE via XSS in Electron](https://blog.securelayer7.net/deepchat-openexternal-rce-via-xss-in-electron/) — same shape of bug, same prevention.

Sources:
- [github.com/cure53/DOMPurify](https://github.com/cure53/DOMPurify)
- [github.com/remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)
- [github.com/uiwjs/react-markdown-preview](https://github.com/uiwjs/react-markdown-preview)
- [strapi.io — React Markdown complete guide 2025 (security & styling)](https://strapi.io/blog/react-markdown-complete-guide-security-styling)

---

## 13. Production examples to study

Open these in a browser and hover/scrub through them. Every one of them is a master-class:

| App | What to watch |
|---|---|
| **GitHub PR hover card** | Default 700/300 ms; safe polygon visible if you move slowly; pins on click |
| **Notion link previews** | Frosted look; favicon → title → tagline staged reveal; clicking pins |
| **Linear issue hover** | Sub-150 ms once warmed (FloatingDelayGroup-style); rich content (status pills, assignee) |
| **Slack user / file hovercards** | Almost instant after first; smooth crossfade between cards |
| **Arc Glance** ([Arc resources](https://resources.arc.net/hc/en-us/articles/19335284431639-Previews-Glance-Top-Sites)) | 5 s hover for AI summary; tab preview overlay |
| **Raycast file search + ⌘Y** | Permanent right-pane Quick Look |
| **Obsidian + Hover Editor** ([github](https://github.com/nothingislost/obsidian-hover-editor)) | Pin + drag + resize popovers; transforms into editor |
| **macOS Finder Space** | The benchmark — instant, full-content, arrow-key scrubs neighbours |
| **showmd** ([site](https://showmd.yetanother.one/)) | What a rendered .md Quick Look *looks* like in 2026 |
| **Apple Contacts Liquid Glass popover** | iOS 26 / macOS Tahoe — the new design language for popovers |
| **VS Code hover provider** | Markdown content in hovers — what code-aware popovers look like |
| **Cursor hover (Cmd+K palette)** | Two-column preview pattern in an AI tool |
| **BerryPeek / Arc Peek (Chrome extensions)** ([BerryPeek](https://github.com/Kain-90/BerryPeek)) | Open-source clones of Arc Peek behaviour; readable code |

---

## 14. Accessibility checklist (WCAG 1.4.13 "Content on Hover or Focus")

Even though our user is a power user on a keyboard-and-mouse desktop, the WCAG rule still applies in spirit, and it's a quality bar:

- **Dismissable** — Esc closes the preview. ✅ (Popover API auto-handles for `popover="auto"`.)
- **Hoverable** — once shown, cursor can enter the preview without it closing. ✅ (Safe polygon + the card itself counts as hovered.)
- **Persistent** — the preview stays for as long as needed; closing is user-initiated. ✅ (When pinned.)
- **Keyboard reachable** — Tab to a row, Space/Enter opens preview, Esc closes. ✅
- **No focus stealing on hover** — the terminal keeps focus so typing isn't interrupted. ✅
- **Screen reader hint** — `aria-describedby` from row to preview. ✅
- **Contrast** — Liquid Glass text needs to maintain 4.5:1 over **the worst case terminal background** which is pure black, so light text @ 88% white = 18:1, safe.

Source: [wcag.com — 1.4.13 Content on Hover or Focus](https://www.wcag.com/authors/1-4-13-content-on-hover-or-focus/)

---

## 15. Recommendations for EZvibes — concrete

Given EZvibes is **Electron 33 + vanilla JS** and the goal is a **2026-pioneer prompt-vault peek**, the minimal viable spec:

1. **Install `@floating-ui/dom@^1.7`** as a dependency. ~5 kB gzipped, ESM, no bundler needed. Already-supported import map style works.
2. **Use the native `popover` attribute + CSS Anchor Positioning** for the *card position*. Use Floating UI only for the *safe-polygon corridor* and for the *first-time programmatic open via JS* (Popover API's auto state needs a click trigger, not a hover trigger). Hybrid: native positioning, JS hover state.
3. **Delay numbers**:
   - First-time open: `openDelay = 700` (Radix default).
   - Subsequent within 500 ms: `1 ms` (FloatingDelayGroup pattern, hand-rolled).
   - Close: `300 ms` (Radix default).
   - `restMs = 120` (require cursor to settle).
4. **Visual style**: 14 px border-radius, `rgba(24,26,30,0.62)` background, 18 px blur + 160% saturate, 1px white-04 border, two-layer dark shadow. Asymmetric open (220 ms ease-out) / close (120 ms ease-in).
5. **Render**: `marked` + `DOMPurify` + `highlight.js` with the dark-theme stylesheet. ~70 kB gzipped total.
6. **Safe polygon**: roll your own from the Smashing Magazine snippet — the React-only Floating UI `safePolygon` is overkill for vanilla.
7. **Pin-on-click**: switch the `popover` attribute from `"auto"` to `"manual"` when pinned. Manual mode allows multiple simultaneous cards.
8. **Keyboard**: Space (when row focused) toggles; Esc unpins/closes; ↑/↓ moves selection and updates preview live (Quick Look heritage).
9. **The paste action**: a single button at the bottom-right of the card that sends `terminal:input` with the markdown content. Initially without the View-Transitions "ghost line" — ship that as v2 for the wow factor.

This stack is ~75 kB total bundle impact, zero build-step changes, and lands the entire pioneer-tier interaction.

---

## Master reference list

### Floating UI core docs
- [Floating UI homepage](https://floating-ui.com/)
- [Tutorial (vanilla JS)](https://floating-ui.com/docs/tutorial)
- [Getting Started](https://floating-ui.com/docs/getting-started)
- [computePosition](https://floating-ui.com/docs/computeposition)
- [autoUpdate](https://floating-ui.com/docs/autoupdate)
- [Popover (React)](https://floating-ui.com/docs/popover)
- [Tooltip](https://floating-ui.com/docs/tooltip)
- [useHover](https://floating-ui.com/docs/usehover)
- [FloatingDelayGroup](https://floating-ui.com/docs/floatingdelaygroup)
- [flip middleware](https://floating-ui.com/docs/flip)
- [arrow middleware](https://floating-ui.com/docs/arrow)
- [Middleware overview](https://floating-ui.com/docs/middleware)
- [useTransitionStyles / useTransitionStatus](https://floating-ui.com/docs/usetransition)
- [GitHub — safePolygon.ts source](https://github.com/floating-ui/floating-ui/blob/master/packages/react/src/safePolygon.ts)

### Radix UI
- [Radix Hover Card](https://www.radix-ui.com/primitives/docs/components/hover-card)
- [Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover)

### Native Web Platform
- [MDN — Popover API / Using](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)
- [MDN — popover global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover)
- [MDN — View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [MDN — Using View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)
- [chrome.com — Smooth transitions with the View Transition API](https://developer.chrome.com/docs/web-platform/view-transitions)
- [css-tricks.com — Cross-Document View Transitions](https://css-tricks.com/cross-document-view-transitions-part-1/)
- [pockit.tools — CSS Anchor Positioning Complete Guide](https://pockit.tools/blog/css-anchor-positioning-api-complete-guide/)
- [botmonster.com — CSS Anchor Positioning Tooltips & Popovers](https://botmonster.com/web-dev/css-anchor-positioning-tooltips-popovers/)
- [css-irl.info — Anchor Positioning and the Popover API for a JS-Free Site Menu](https://css-irl.info/anchor-positioning-and-the-popover-api/)
- [oidaisdes.org — Popover API + CSS Anchor Positioning](https://www.oidaisdes.org/popover-api-accessibility.en/)

### Safe polygon / hover triangle
- [mayank.co — Hover triangles](https://mayank.co/blog/hover-triangles/)
- [Smashing Magazine — Better Context Menus with Safe Triangles](https://www.smashingmagazine.com/2023/08/better-context-menus-safe-triangles/)
- [css-tricks.com — Menus with "Dynamic Hit Areas" (Hakim El Hattab)](https://css-tricks.com/menus-with-dynamic-hit-areas/)
- [Hakim's CSS Day 2019 slides](https://team.slides.com/hakimel/cssday-2019)
- [Ben Kamens — Breaking Down Amazon's Mega Dropdown (2013)](https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown)

### Quick Look / macOS / showmd
- [applemagazine.com — Quick Look Features](https://applemagazine.com/quick-look-features-02f2)
- [creativetechs.com — Quick Look in Finder](https://www.creativetechs.com/2024/12/10/use-quick-look-to-preview-files-and-folders-in-the-finder-spotlight-and-open-dialogs/)
- [showmd — Markdown Quick Look extension](https://showmd.yetanother.one/)
- [github.com/johannesnagl/showmd](https://github.com/johannesnagl/showmd)
- [smittytone.net — PreviewMarkdown / PreviewCode](https://smittytone.net/previewcode/)
- [apple developer — Quick Look](https://developer.apple.com/documentation/QuickLook)
- [eclecticlight.co — Spotlight indexes deep dive](https://eclecticlight.co/2025/07/30/a-deeper-dive-into-spotlight-indexes/)

### Liquid Glass / Glassmorphism
- [Apple Developer — New Design Gallery 2026 (Liquid Glass)](https://developer.apple.com/design/new-design-gallery-2026/)
- [css-tricks.com — Getting Clarity on Apple's Liquid Glass](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/)
- [github.com/nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)
- [github.com/yanglei1826877278/liquid-glass](https://github.com/yanglei1826877278/liquid-glass)
- [liquidglassui.org](https://liquidglassui.org/)
- [LogRocket — Adopting Apple's Liquid Glass best practices](https://blog.logrocket.com/ux-design/adopting-liquid-glass-examples-best-practices/)
- [dev.to — Recreating Apple's Liquid Glass with Pure CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)
- [Josh Comeau — Next-level frosted glass with backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/)
- [weblogtrips.com — Glassmorphism 2.0 CSS Techniques 2026](https://weblogtrips.com/technology/glassmorphism-2-0-css-techniques-2026/)

### Production examples / inspiration
- [resources.arc.net — Previews: Glance Top Sites](https://resources.arc.net/hc/en-us/articles/19335284431639-Previews-Glance-Top-Sites)
- [linkz.ai — Link preview on hover (Arc, SigmaOS, Linkz.ai)](https://linkz.ai/blog/link-preview-on-hover-from-arc-browser-sigmaos-linkz-ai)
- [github.com/Kain-90/BerryPeek](https://github.com/Kain-90/BerryPeek)
- [github.com/nothingislost/obsidian-hover-editor](https://github.com/nothingislost/obsidian-hover-editor)
- [help.obsidian.md — Page preview](https://help.obsidian.md/plugins/page-preview)
- [notion.com — Link previews help](https://www.notion.com/help/link-previews)
- [linear.app — Changelog](https://linear.app/changelog)
- [mobbin.com — Command Palette](https://mobbin.com/glossary/command-palette)
- [mobbin.com — Popover](https://mobbin.com/glossary/popover)
- [raycast.com — File Search](https://www.raycast.com/core-features/file-search)
- [manual.raycast.com — Keyboard Shortcuts](https://manual.raycast.com/keyboard-shortcuts)

### UX research / delay timings
- [baymard.com — Provide a Hover Delay of 300–500ms](https://baymard.com/blog/dropdown-menu-flickering-issue)
- [copyprogramming.com — CSS Transition Delay 2026 Best Practices](https://copyprogramming.com/howto/transition-delay-only-on-hover-out-2)
- [ResearchGate — Optimal Delay for Hover Effects](https://www.researchgate.net/post/What_is_the_optimal_delay_for_Hover_Effects)
- [uxtigers.com — Think-Time UX](https://www.uxtigers.com/post/think-time-ux)
- [Macrumors — Haptic Touch vs 3D Touch](https://www.macrumors.com/guide/haptic-touch-vs-3d-touch-whats-the-difference/) — peek-and-pop history
- [appleinsider.com — Haptic Touch differences](https://appleinsider.com/articles/19/01/15/what-haptic-touch-on-the-iphone-xr-can-do-and-how-it-differs-from-3d-touch-on-the-iphone-xs)

### Accessibility
- [wcag.com — 1.4.13 Content on Hover or Focus](https://www.wcag.com/authors/1-4-13-content-on-hover-or-focus/)
- [inclusive-components.design — Tooltips & Toggletips](https://inclusive-components.design/tooltips-toggletips/)
- [uxpatterns.dev — Tooltip Pattern](https://uxpatterns.dev/patterns/content-management/tooltip)
- [uxpatterns.dev — Popover Pattern](https://uxpatterns.dev/patterns/content-management/popover)

### Markdown rendering / sanitisation
- [marked.js.org](https://marked.js.org/)
- [github.com/cure53/DOMPurify](https://github.com/cure53/DOMPurify)
- [github.com/remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)
- [github.com/uiwjs/react-markdown-preview](https://github.com/uiwjs/react-markdown-preview)
- [github.com/shikijs/shiki](https://github.com/shikijs/shiki)
- [strapi.io — Best Markdown Editors for React](https://strapi.io/blog/top-5-markdown-editors-for-react)
- [strapi.io — React Markdown Complete Guide 2025](https://strapi.io/blog/react-markdown-complete-guide-security-styling)
- [blog.securelayer7.net — DeepChat openExternal RCE via XSS](https://blog.securelayer7.net/deepchat-openexternal-rce-via-xss-in-electron/)
- [pkgpulse — Shiki vs Prism vs highlight.js 2026](https://www.pkgpulse.com/guides/shiki-vs-prismjs-vs-highlightjs-syntax-highlighting-2026)

### Library comparison & misc
- [pkgpulse — Floating UI vs Tippy.js vs Radix Tooltip 2026](https://www.pkgpulse.com/blog/floating-ui-vs-tippyjs-vs-radix-tooltip-popover-2026)
- [usertourkit — Best Tooltip Libraries for React 2026](https://usertourkit.com/blog/best-tooltip-libraries-react-2026)
- [debricked — react-popper-tooltip vs tippy.js vs floating-ui](https://debricked.com/select/compare/npm-@floating-ui/dom-vs-npm-tippy.js-vs-npm-react-popper-tooltip)
- [hover.dev — Animated Card Components for React + Tailwind](https://www.hover.dev/components/cards)
- [Codrops — Layout with Reveal Animations and Content Preview](https://tympanus.net/codrops/2021/07/28/layout-with-reveal-animations-and-content-preview/)
- [Smashing Magazine — Revealing Images With CSS Mask Animations](https://www.smashingmagazine.com/2023/09/revealing-images-css-mask-animations/)
- [motion.dev — Motion for React](https://motion.dev/docs/react)
- [framer.com/motion — Animation docs](https://www.framer.com/motion/animation/)
