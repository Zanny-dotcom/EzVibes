# Prompt Vault Research — Summary

Synthesis of 30 parallel research dumps (`description1.md` … `description30.md`, ~194,500 words total) on pioneer-level UI/UX for a clickable, paste-to-terminal prompt vault inside EZvibes.

---

## Convergent themes

Patterns multiple agents independently arrived at — strong signal that these are the foundation.

| Theme | What it is | Why it matters | Cited in |
|---|---|---|---|
| **Apple Liquid Glass (WWDC25)** | `backdrop-filter` + SVG `feDisplacementMap` + specular rim. Chromium-only. | Defining 2026 aesthetic. Electron renderer gets it free. | #1, #2, #5, #8, #11, #20, #23, #27, #28 |
| **View Transitions API** | `document.startViewTransition()` for shared-element animations on paste / file arrival. | One-call cross-component motion, zero animation library. Native in Electron 33. | #3, #9, #15, #17, #26 |
| **chokidar v5 + `awaitWriteFinish`** | File watcher with `{ stabilityThreshold: 80–300 }` to debounce editor swap-files. | The plumbing under every cross-session hand-off idea. | #7, #8, #9, #22, #24, #25 |
| **Bracketed paste** (`\x1b[200~ … \x1b[201~`) | Wraps text written via `pty.write()` so the shell treats it as paste, not typed input. | The only safe way to inject markdown into the active xterm. `term.write()` is a trap. | #4, #7, #22 |
| **OKLCH color tokens** | `oklch(L C H)` semantic tokens; one hue slider repaints the whole vault via relative color syntax. | Perceptually uniform; Tailwind v4 default; P3 wide-gamut on Mac retina. | #14, #19, #26, #30 |
| **Cross-session hand-off as a visible event** | Another Claude session writes `HANDOFF.md`; recipient session's vault animates the arrival. | The single most-repeated "wow" pattern. The feature the Paint sketch is actually about. | #3, #6, #7, #14, #17, #22, #23, #24 |

---

## Top pioneer-level ideas

The standout one-of-a-kind ideas from across the swarm.

1. **Translucent xterm over Mica** (#28) — set `allowTransparency: true` + `theme.background: 'rgba(20,16,12,0.40)'` on xterm so terminal output reveals Mica/Liquid Glass behind it. No terminal app ships this.
2. **Vault folder as a live shared mailbox** (#22, #23) — recipient session's vault auto-scrolls to a new `HANDOFF.md`, pulses lime, the tab chip flashes lime — *while the user is in a different tab*.
3. **Liquid Glass paste button sampling xterm pixels** (#1) — vault's `--glass-alpha` adapts live to terminal brightness via WebGL `readPixels`; click spawns an "ink splash" via `mix-blend-mode: overlay`.
4. **Paste-laser preview** (#11) — Floating UI safe-polygon corridor with chevron physically angled at the active xterm caret's pixel position; ghost line flies to cursor on click.
5. **Vault Map view** (#27) — 2D spatial constellation of Liquid Glass cards, pannable/zoomable, faint lines between cross-session hand-offs.
6. **Kinetic variable-axis typography** (#18) — file names breathe `wght`/`slnt` when a hand-off arrives; pure `transition: font-variation-settings`, zero JS.
7. **Tag-color "rooms" + handoff comets** (#14) — clicking a tag tints the entire panel chrome that hue; new files arrive as comets trailing their tag color.
8. **Magnetic drop-zone glow** (#29) — `--drop-intensity` CSS var driven by Euclidean distance from cursor to terminal pocket; pocket glows brighter as drag approaches.
9. **Tidy Vault** (#21) — ask the active Claude tab to propose a folder structure for loose `.md`s; one click approves. Recursive in a good way.
10. **Bank vault door with combination dial** (#2) — Rive-driven brushed-steel dial swings open to reveal a filing cabinet of manila-folder paper chips, each a `.md` file.
11. **Shiki Magic Move + View Transitions** (#8) — token-by-token morph during paste; row flies into cursor while code blocks materialize from ghost into highlighted real content.
12. **Mark-Ahead Radial Casting** (#16) — right-click + flick gesture; slow press shows the pie menu (novice), fast flick skips it (expert). Same input teaches and executes.
13. **Scroll-stitched hand-off ribbon** (#17) — SVG path from new file row down to the active tab indicator, drawn via `animation-timeline: scroll(self)` as user scrolls.
14. **In-browser semantic search** (#13) — `@xenova/transformers` + `gte-small` + Orama vectors. 30 MB one-time download, 20–30 ms embed per query, fully offline, no API keys.
15. **Material Symbols `FILL` axis morph** (#20) — outline-to-filled icon transition in 200 ms via `transition: font-variation-settings`. One line of CSS, no second icon.
16. **Single hue slider repaints the vault** (#19) — relative OKLCH (`oklch(from var(--accent) calc(l + 0.06) c h)`) derives every shade from one user-chosen hue. Zero recompute.
17. **Agent-tinted accent** (#30) — vault accent automatically tints peach for Claude tabs, teal for Codex tabs. Same tokens, one class swap.
18. **Time-Travel Hand-Off Ribbon** (#24) — horizontal strip across vault top showing every `.md` modified in the last 60 min, colored by author, decaying glow on arrivals.
19. **Stripe-flashlight grid + per-card spotlight** (#12) — single `pointermove` updates `--x`/`--y` on every card; radial gradient pinned to local mouse coords. 5 lines JS, 30 lines CSS, 60 fps on compositor thread.
20. **Tana-style view toolbar** (#25) — `Cmd+K`-toggled Filter/Sort/Group/Display bar over a flat folder of markdown. Notion-grade database UX, zero schema.

---

## How the ideas combine — recommended composition

If picking one cohesive direction, these stack cleanly without conflict:

- **Chrome:** Frameless Electron 33 window with `backgroundMaterial: 'mica'` (Windows) + `vibrancy: 'sidebar'` (macOS) and custom drag region.
- **Vault panel:** `backdrop-filter: blur(24px) saturate(180%)` with a Liquid-Glass SVG displacement layer for the paste button only. Mica behind, frosted CSS card on top, one displacement element for the hero affordance.
- **Type:** Inter Variable (UI) + Geist Mono or Berkeley Mono (code blocks). Wire `font-variation-settings` transition so file names breathe on hand-off.
- **Color:** OKLCH tokens. `--vault-accent` derived from `--vault-base-hue`. Auto-tint per tab agent.
- **Layout:** Three-pane (Tags | File List | Hover Preview) inspired by Apple Notes, with a Cmd+K command palette (`cmdk` patterns) as the keyboard path.
- **File watch:** chokidar v5, `awaitWriteFinish: { stabilityThreshold: 80 }`, IPC to renderer.
- **Hand-off feedback:** `document.startViewTransition()` for the row insert, mint pulse border, lime tab-chip dot if window isn't focused.
- **Paste:** Bracketed-paste via `pty.write('\x1b[200~' + body + '\x1b[201~')`. Ghost row clones via `element.animate()` along a Bezier into the terminal pocket. Genie animation reuse from existing EZvibes minimize.

That's the canonical 2026 vault. Every piece has a citation in the 30 files.

---

## Critical implementation gotchas (flagged by multiple agents)

- **Never use `transparent: true`** with Mica — use `backgroundColor: '#00000000'` (zero-alpha) instead.
- **`File.path` was removed in Electron 32+** — use `webUtils.getPathForFile()` from preload for file drops.
- **`term.write()` is a trap** — it draws to the screen buffer without going through the shell. Use `pty.write()` with bracketed-paste wrappers.
- **Hidden xterm hosts measure 0×0** — only fit the active tab; refit on tab switch after a layout frame.
- **chokidar `.node` files need ASAR-unpack** in production builds.
- **Atomic writes from editors** (write to temp + rename) and `.swp` files will create phantom `change` events without `awaitWriteFinish`.
- **`overflow:hidden` / `opacity<1` / `filter`** flatten 3D contexts — kills depth/parallax effects.
- **Tahoe + Electron <36.9.2** has a private-API GPU lag — pin to ≥36.9.2 if shipping for macOS 26.

---

## File index

| # | Topic |
|---|---|
| 1 | Glassmorphism, Acrylic, Mica, translucent panels |
| 2 | Skeuomorphic vault & physical-object UI revival |
| 3 | Bento grid & modular card layouts |
| 4 | Command palette & launcher UX |
| 5 | visionOS-inspired spatial UI / layered depth |
| 6 | Neumorphism 2.0 / soft tactile UI |
| 7 | Clipboard manager UI patterns |
| 8 | Markdown preview rendering libraries 2026 |
| 9 | File watcher & real-time folder UI |
| 10 | Drawer & slide-out panel patterns |
| 11 | Hover Quick Look & peek interactions |
| 12 | Card-based grid layouts |
| 13 | Search & fuzzy filter UX |
| 14 | Tag, category & color-coding systems |
| 15 | Pinning, favoriting & "starred" surfaces |
| 16 | Radial / pie menus & innovative context menus |
| 17 | Microanimations & motion design 2026 |
| 18 | Variable fonts & typographic hierarchy |
| 19 | OKLCH & P3 wide-gamut color systems |
| 20 | Iconography systems 2026 |
| 21 | Arc browser-style spaces & sidebar innovation |
| 22 | Warp / Wave / Ghostty terminal UI |
| 23 | Cursor / Zed AI-first IDE panel design |
| 24 | Obsidian / Logseq / Heynote markdown vault UIs |
| 25 | Notion / Craft sidebar & database views |
| 26 | Linear / Vercel / Geist design system |
| 27 | Apple Notes / Bear / Day One folder UX |
| 28 | Custom Electron title bars & window chrome |
| 29 | Drag-and-drop interactions |
| 30 | Dark themes & color schemes |
