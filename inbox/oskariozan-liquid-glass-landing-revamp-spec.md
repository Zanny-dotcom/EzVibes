# oskariozan.com — Liquid Glass Landing Page Revamp (Design Spec)

**Date:** 2026-06-04
**Branch:** `revamp-liquid-glass` (off `main`, repo `Zanny-dotcom/oskariozan.github.io`, working dir `oskariozan/`)
**Status:** Approved via visual brainstorming. Build in progress.
**Constraint:** Static site — vanilla HTML/CSS/JS, **no build step, no npm, no frameworks** (per project CLAUDE.md).

---

## Goal

Completely revamp the `oskariozan.com` landing page (`index.html`) with a modern **Apple "Liquid Glass" (2025)** aesthetic, while **preserving the exact existing colour profile** so it still reads as the same brand — just dramatically more modern. Ship on an isolated branch, previewable in localhost, never auto-deployed. Also produce a reusable `modern-style-design` skill from the methodology.

---

## Decisions (locked via visual companion)

| Decision | Choice |
|---|---|
| Style direction | **A — Liquid Glass** (frosted translucent panels over gold/red light blooms, rim-light edges, glass buttons) |
| Glass intensity | **2 — Balanced** (glass nav + glass cards at moderate blur; featured card gold-glow; text stays crisp) |
| Motion layer | **Scroll reveal, Magnetic glass buttons, Cursor spotlight, Shimmer headline, Refined preloader** (skip 3D tilt) |
| Architecture | **A — Rewrite `styles.css`**, archive old as `styles-classic.css`; `chat.js` logic untouched |

---

## Colour profile — PRESERVED EXACTLY (do not change)

```
--black:#0a0a0a  --black-light:#111  --grey-dark:#1a1a1a  --grey:#2a2a2a  --grey-mid:#3a3a3a  --grey-light:#666
--white:#f0ede8  --white-dim:#b0ada8
--gold:#c9a84c  --gold-light:#dfc06a  --gold-dark:#a8892e
--red:#6b1a1a  --red-accent:#8b2a2a
Fonts: Playfair Display (display serif) + Inter (body)
```

## New tokens — ADDITIVE (layered on top, nothing removed)

```css
--glass-bg: rgba(240,237,232,0.055);     /* warm-white tint, low alpha */
--glass-bg-strong: rgba(240,237,232,0.085);
--glass-border: rgba(255,255,255,0.14);
--glass-rim: inset 0 1px 1px rgba(255,255,255,0.16);
--glass-blur: blur(18px) saturate(150%) brightness(1.06);
--gold-glow: 0 0 24px rgba(201,168,76,0.18);
```

### Reusable recipe
```css
.glass{
  background:var(--glass-bg);
  backdrop-filter:var(--glass-blur);
  -webkit-backdrop-filter:var(--glass-blur);
  border:1px solid var(--glass-border);
  box-shadow:var(--glass-rim),0 10px 30px rgba(0,0,0,.4);
}
```
Featured/accent variant adds `--gold-glow` + gold-tinted border.

---

## Architecture & files

| File | Change |
|---|---|
| `index.html` | Restructured for glass markup. **Same copy, sections, links.** Adds fixed bloom + grain background layers, `.glass` on nav/cards/newsletter, shimmer-headline span, magnetic-button + scroll-reveal hooks. |
| `styles.css` | **Rewritten** for the liquid-glass system. |
| `styles-classic.css` | The current stylesheet, archived (one `git mv` rollback). |
| `script.js` | Extended: magnetic buttons, cursor spotlight, scroll-reveal (IntersectionObserver fallback). Existing nav/preloader/mobile-menu preserved. |
| `chat.js` | **Untouched logic.** Widget restyled to glass via CSS overrides only. |

No build tools / npm / frameworks added.

---

## Page composition (sections — content unchanged)

1. **Background layer** (fixed, `z-index` behind all): dark base + 2–3 radial-gradient blooms (gold-dark + oxblood) + SVG film-grain overlay (`opacity ~0.04`). Gives the blur warm light to refract.
2. **Preloader** — existing pulsing "O.", refined timing, fades into glass hero.
3. **Glass nav** — floating frosted bar; logo `O.`; pills Projects / Knowledge (gold) / Stay Updated; mobile toggle.
4. **Hero** — eyebrow "Builder — Researcher — Maker"; headline "Oskari / *Ozan.*" with **gold shimmer on "Ozan."**; sub copy; magnetic "See Projects" glass button; "Based in Pori, Finland" badge; scroll hint.
5. **Featured Projects** — 3 glass cards; RAG Chatbot highlighted (gold glow + mascot img + "Open Chatbot" wired to `chatToggle`); Dev Tools; This Website. Meta tags preserved.
6. **Knowledge Base** — 3 glass cards (Habits / Focus / Nutrition).
7. **Newsletter** — glass form; email input + Subscribe; success state preserved.
8. **Footer** — brand, Navigate / Connect / Location columns, bottom bar. Links preserved.
9. **Chat widget** — restyled to glass, logic intact.

---

## Motion layer (the 5 chosen)

| Effect | Implementation |
|---|---|
| **Scroll reveal** | Native CSS `animation-timeline: view()`; IntersectionObserver fallback adds `.is-visible`. Fade + rise. |
| **Magnetic buttons** | Vanilla JS: translate button toward cursor on `mousemove`, spring back on leave; gold sheen sweep via `::after`. |
| **Cursor spotlight** | JS sets `--mx/--my` CSS vars on cards; radial gold glow follows cursor through the glass. |
| **Shimmer headline** | Animated gradient (`background-clip:text`) sweeping gold→light→white across "Ozan.". |
| **Refined preloader** | Existing loader, smoother cubic-bezier timing, fade-out into hero. |

All gated behind `@media (prefers-reduced-motion: no-preference)`.

---

## Compatibility & safety

- Glass gated behind `@supports (backdrop-filter: blur(1px))`; fallback = solid `--grey-dark` card + gold border (looks intentional, never broken).
- `-webkit-` prefixes on all `backdrop-filter` / `background-clip`.
- Scroll-driven animations degrade to IntersectionObserver, then to plain visibility.
- **No push.** Preview via `python -m http.server` in `oskariozan/`. Merge to `main` only on explicit approval (every push to `main` = production deploy).

---

## Out of scope

- `bicycles.html`, `projects.html`, `fun/` pages (landing page only this pass).
- Backend / `rag-chatbot` repo (untouched).
- Content/copy changes (visual revamp only).

---

## Deliverables

1. Revamped landing page on `revamp-liquid-glass`, verified in localhost (desktop + mobile, console clean, chat works).
2. `modern-style-design` skill capturing the methodology (research → palette-preserving glass system → motion layer → visual-companion brainstorming flow).
