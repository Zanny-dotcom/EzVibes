# Skeuomorphic Vault & Physical-Object UI Revival (2024–2026)

**Research target:** Pioneer-level skeuomorphic visual design for a "prompt vault" panel inside an Electron terminal session window. The user wants a literal vault metaphor — a tactile container of `.md` files, prompts, and hand-off notes that lives inside each session window. Clicking a file pastes its content into the active xterm-based PTY tab.

This document maps the **2024-2026 post-flat-design revival** of physical, tactile, object-oriented UI metaphors, identifies the working CSS / Three.js / Spline / Rive recipes that can be embedded inside a vanilla-JS Electron app, names the apps that pioneered this aesthetic, and offers concrete blueprints for a "vault of prompts" panel that would feel like a pioneer of the trend rather than a follower.

---

## 1. Macro-trend: Why skeuomorphism is back in 2025–2026

Five overlapping currents have pushed physical UI metaphors back to the front of design discourse:

1. **Liquid Glass (Apple, WWDC June 2025).** Apple announced "Liquid Glass" at WWDC 2025 (June 9, 2025) as a unified design language across iOS 26, iPadOS 26, macOS Tahoe 26, tvOS 26, watchOS 26 and visionOS 26. It's the biggest visual shift since iOS 7 (2013) abandoned skeuomorphism for flat. Liquid Glass is described as a "digital material" that reflects and refracts its surroundings while dynamically transforming. The Photos icon was redesigned to mimic **layered stained glass**, the Camera app brought back the high-res lens illustration last seen in iOS 6, and almost every UI element now has translucent, glass-like physical properties.
2. **Frutiger Aero revival.** The early-2000s Windows Aero / iOS 4 aesthetic (glossy buttons, water droplets, bubbles, gradients, optimistic glass) is in full nostalgia cycle. Trend analysts attribute the timing to the standard 20-year nostalgia gap (Frutiger Aero peaked roughly 2004-2013, so 2024-2026 is the sweet spot). Liquid Glass is widely seen as the direct enterprise descendant.
3. **Flat-UI fatigue.** Designers and writers across Kryzalid, Big Human, UXmatters, LogRocket, and the NN/g are openly acknowledging that 10+ years of flat / minimalist UI has left users craving warmth, texture, and emotional resonance — particularly in an era when AI-generated content already feels disembodied.
4. **Hardware enables it.** OLED, 120 Hz, P3 wide-gamut color, and modern GPUs make heavy textures, real-time shaders, blur and SVG filters cheap enough to ship in production.
5. **Spatial computing (Vision Pro, Meta Quest).** Once spatial UI becomes mainstream, every flat app feels stale. Visiting visionOS 26 (spatial widgets that pin to your physical room) creates pressure on 2D apps to feel at least *layered* and *physical*.

The result is a new style that the Big Human guide, hype4.academy, and ecommercewebdesign.agency are calling **"neo-skeuomorphism"** — physical metaphor pared down with modern restraint, layered with neumorphism's soft shadows, often built on grain/noise SVG filters and `backdrop-filter` glass. This is the aesthetic the user is reaching for.

---

## 2. The "Vault" metaphor: literal, glassy, mechanical

The user's Paint mockup shows a list of markdown files inside a dark panel with a red arrow pointing at a "paste" button. They called it a *vault*. Below are the pioneer-level interpretations of "vault" that have emerged in 2024-2026, ranked roughly from cheapest to most ambitious.

### 2.1 The Bank Vault Door

A circular steel door with a spin-dial combination lock, riveted edge, gold pinstripe, and a fat hinge on the left. The door swings open with a CSS 3D rotation to reveal the contents.

- Real reference apps:
  - **Practice Lock Combo - Vault** (iOS, app ID 6751608965) — full-fidelity rotary dial with realistic rotation mechanics, haptic feedback per click, customizable dial appearance, and a timer challenge.
  - **Safe Cracker - Watch Game** (MWM, Apple Watch) — uses the Digital Crown as the dial; haptics fire on each "click" of the wheel pack to imitate the feel of cracking a real safe.
  - **Challenge VAULT** (Sparrows Lock Picks) — a *physical* practice safe; provides the audio/tactile reference for what a digital UI should imitate.
- Visual recipe (production-ready CSS, no images required):
  - **Door body:** a circle 240–320 px wide.
  - **Brushed-steel fill:** stacked `repeating-linear-gradient` strokes (described in §6 below) + a low-amplitude SVG noise overlay (`<feTurbulence baseFrequency="0.9" numOctaves="2">` with 6-8 % opacity).
  - **Rivets:** absolutely-positioned 8 px circles around the perimeter; inner+outer `box-shadow` to give each a tiny dome.
  - **Combination dial:** a smaller circle with `conic-gradient` markings (0-99), an inner radial-gradient highlight at top-left to simulate a brushed knurled finish, and `transform: rotate(var(--angle))` driven by mouse drag (or scroll wheel).
  - **Open animation:** `transform: perspective(1200px) rotateY(-110deg)` with `transform-origin: left center`, easing `cubic-bezier(.2,.8,.1,1)` over 700 ms.

### 2.2 The Filing Cabinet / Drawer Pull

A skeuomorphic steel filing cabinet on the left of the panel, with multiple labeled drawers ("Prompts", "Hand-offs", "CLAUDE.mds", "Snippets"). Clicking a drawer pulls it forward in 3D, revealing markdown files as manila folders with handwritten tab labels.

- Real-world reference: This is the original Xerox PARC desktop metaphor (Kay, Smith et al., 1970), made literal again. Tabs on browsers and notebooks are literally the manila folder metaphor (cf. The Component Gallery's tabs entry).
- 2025 enabling pattern: **shadcn `Drawer`** built on Emil Kowalski's **Vaul** library uses a native-app style slide-out (the same gesture-driven approach Linear and Vercel use). For Electron, the slide-out approach is virtually free and feels native.
- Visual recipe:
  - **Cabinet body:** thick `box-shadow` stack (3-5 shadows, ascending blur, increasing translate-y) for elevation; subtle vertical brushed-metal pattern; a top "label slot" with embossed text via dual `text-shadow`.
  - **Drawer face:** `linear-gradient(to bottom, #d5d2c8, #b8b4a8)` (manila color) with a centered handle pull rendered as a stretched rounded rectangle with inset+outset shadows.
  - **Pull animation:** `transform: translateX(0) → translateX(40%)` plus a perspective `rotateY` of ~6° to fake the drawer rolling on its slides. Manila folders inside fade and translate up sequentially with a 30 ms stagger.

### 2.3 The Treasure Chest / Lid-Hinge Box

Steampunk variant: ornate wooden chest with brass corners. Lid hinges open with a 3D Y-axis rotation; prompts spill out as floating cards. Best used for "discovery" moments (first-time use, completion of a milestone, etc.) rather than daily flow because the animation is heavy.

### 2.4 The Locker Stack

Less common but excellent for **per-tab** prompt storage: vertical column of metal lockers with numbered tags. Each locker corresponds to one open terminal tab. Hovering reveals a small handwritten card showing the most recent prompt. Clicking opens the locker (single hinge, left or right depending on parity) and shoves a card forward.

### 2.5 The Rolodex / Card Deck

A horizontal stack of index cards on a polished wood desk surface. Scrolling rotates them through 3D space (think Mac OS Cover Flow but with paper instead of album art). Hover lifts a card; click slaps it forward and triggers paste.

- 2025 reference: **Hand-Held Card Fan (Lerped) by Geoff Storbeck** — uses `requestAnimationFrame` and damped-lerp transforms; cards fan, open/close smoothly, support hover lift. Animations are `translate3d`/`rotate`/`scale` for GPU acceleration.
- 2025 CSS pattern: cubic-bezier-timed `rotate` + `translate` on each card on hover, lifting the active one and pushing siblings outward; see the "Stacked Card Fan" tutorial on quackit.com.

### 2.6 The Vault-Inside-a-Vault (Pioneer-level)

Combine 2.1 with 2.2: outer Bank Vault Door swings open to reveal the Filing Cabinet inside. The cabinet's drawers contain manila folders, each of which can be pulled out as a card. The card can be dragged to the terminal tab to paste. This is the *most ambitious* and the *most Pioneer-level* — see §10 for a full blueprint.

---

## 3. Apple Liquid Glass: the canonical 2025 reference

Sources: Apple Newsroom 2025/06, Wikipedia "Liquid Glass", AppleMagazine, MobileAction, basicappleguy.com, createwithswift.com, idownloadblog.com.

Key technical / visual properties to copy:

- **Multi-layer composition.** Every icon and every UI surface is a stack of translucent layers: a back-plate color, a tinted glass refraction layer, an edge highlight, a specular reflection that responds to device tilt (gyroscope-driven), and a foreground content layer. In CSS this translates to one DOM element with multiple absolutely-positioned children, each with its own `backdrop-filter` and `mix-blend-mode`.
- **Translucency that reflects + refracts.** Real glass refracts; Apple uses SVG displacement maps + `backdrop-filter: blur()` to fake this. The community has reproduced it in browsers, but only Chromium accepts SVG filters as `backdrop-filter` inputs. Safari/Firefox punt — for Electron (Chromium) we get the full effect.
- **Frutiger Aero influences.** Lots of soft cyan, white-cyan gradients, and glossy hemispherical highlights at the top of every element.
- **Live light interaction.** Each Liquid Glass surface samples the gyroscope/cursor and shifts its specular highlight. In Electron, attach a `mousemove` listener and set CSS custom properties `--mx`/`--my`; use them inside a radial gradient.
- **Icon Composer (free Apple tool).** Apple shipped a designer-facing tool called **Icon Composer** with Xcode 26. It's free and writes a single `.icon` file describing layered Liquid Glass icons. Even if not directly usable from Electron, it's a great visual reference for how Apple thinks about stack ordering and specular curves.

Production cautions (taken from MacDailyNews 2026/05/11 and 9to5Mac 2026/05/10): macOS 27 is already getting fixes for excessive translucency / low contrast / legibility issues introduced by Tahoe. Apple Newsroom and TechRadar quote critics worrying about "grayish mess" backgrounds when content competes with translucency. **Lesson for your vault:** keep the *content* (file names, copy buttons) on opaque rails and reserve Liquid Glass for *chrome* (the panel frame, the vault door, the divider rails).

---

## 4. Physical materials catalogue — CSS-only recipes

### 4.1 Brushed metal

Reference: Simurai's lab article ("Brushed Metal — Repeating background gradients") and CSS-Tricks' write-up.

The trick is three stacked `repeating-linear-gradient`s with different lengths and slight color shifts. A representative recipe (color values approximate, adjust to taste):

```css
.brushed-steel {
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255,255,255,0.04) 0 1px,
      rgba(0,0,0,0.04) 1px 2px,
      rgba(255,255,255,0.02) 2px 4px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(0,0,0,0.05) 0 3px,
      rgba(255,255,255,0.05) 3px 7px
    ),
    linear-gradient(180deg, #c8cdd2 0%, #97a0aa 50%, #6f7782 100%);
  background-blend-mode: overlay, normal, normal;
}
```

For text (the "ENGRAVED VAULT" label on the door), combine with `background-clip: text; color: transparent` and dual `text-shadow` to fake depth — Tanner Nielsen's gold-on-leather technique.

### 4.2 Gold lettering

From Tanner Nielsen's engraved-leather tutorial:

```css
.gold {
  position: relative;
  font-size: 70pt;
}
.gold::before {
  content: attr(data-text);
  text-shadow:
    -3px -3px 5px rgba(0,0,0,.8),
    1px 1px 2px rgba(255,255,255,.45);
}
.gold::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  background-image: url(gold-texture.png); /* or a CSS gradient */
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
```

For a pure-CSS gold (no PNG), substitute the background-image with `linear-gradient(45deg, #b08d29, #fff3a0 35%, #b08d29 70%, #f1d067 100%)`.

### 4.3 Engraved leather

Same Tanner Nielsen pattern. Use a tileable leather PNG (or generate via SVG noise) as the surface. The dual-shadow `::before` etches the letterform into the surface.

### 4.4 Paper / parchment grain (no PNG)

Best technique by freeCodeCamp / CSS-Tricks: SVG `feTurbulence` filter at a baseFrequency of 0.65–4 depending on grain coarseness.

```css
.paper {
  background-color: #f4ecd8;
  background-image: url("data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>\
<filter id='n'>\
<feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>\
<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/>\
</filter>\
<rect width='100%' height='100%' filter='url(%23n)'/>\
</svg>");
}
```

Lower `baseFrequency` = larger blobs (think rough kraft paper). Higher = finer film grain. The `feColorMatrix` shoves the noise into the alpha channel so we keep only soft brown darks.

### 4.5 Wood grain

Several approaches:

- **Online generator** (texturize.app) — tunes ring spacing, turbulence, tone. Export PNG, use as tileable `background-image`.
- **Procedural CSS** — Tim Pietrusky's CodePen uses radially stretched Perlin (SVG `feTurbulence` with X-scale = 80, Y-scale = 1) + a separate concentric ring overlay. The result is genuinely beautiful but ships ~4 KB of CSS per board.
- **transparenttextures.com** wood pattern — tile a 32×32 PNG as `background-repeat` for the cheapest, lowest-quality result.

Best practice for the prompt vault: a *darkstained walnut* desk surface inside the panel, with `background-size` tuned to ~600 px so the grain reads at the panel scale rather than a noisy buzz.

### 4.6 Glass / Liquid Glass

The Kevin Bismark `liquid-glass-effect` repository (github.com/kevinbism/liquid-glass-effect) recreates Apple's effect with pure CSS:

```css
.glass {
  position: relative;
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(2px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.8);
  border-radius: 2rem;
  box-shadow:
    0 8px 32px rgba(31,38,135,0.2),
    inset 0 4px 20px rgba(255,255,255,0.3);
}
.glass::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 2rem;
  backdrop-filter: blur(1px);
  box-shadow:
    inset -10px -8px 0px -11px rgba(255,255,255,1),
    inset   0px -9px 0px  -8px rgba(255,255,255,1);
  opacity: 0.6;
  z-index: -1;
  filter: blur(1px) drop-shadow(10px 4px 6px black) brightness(115%);
}
```

For real refraction (Apple-grade), combine `backdrop-filter` with an SVG displacement map — the kube.io article "Liquid Glass in the Browser: Refraction with CSS and SVG" walks through the full SVG `feDisplacementMap` setup. **Chromium-only** (i.e. Electron-compatible). Pioneer-tier touch.

### 4.7 Conic-gradient combination dial

For the safe dial (and as a bonus for animated highlights):

```css
.dial-face {
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35) 0%, transparent 35%),
    conic-gradient(from 270deg, #1c1c1c 0deg, #3a3a3a 90deg, #1c1c1c 180deg, #3a3a3a 270deg, #1c1c1c 360deg),
    radial-gradient(circle, #222 0%, #050505 80%);
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 6px #888,
    inset 0 0 0 7px #444,
    inset 0 -10px 30px rgba(0,0,0,0.6),
    0 8px 16px rgba(0,0,0,0.6);
}
```

The first two layers (radial highlight + conic shading) sell the knurled metal look. The deep inset rings simulate the metal bezel.

---

## 5. Animation libraries you can drop into Electron 33

The EZvibes app is vanilla JS, no React, no bundler. Each of the following is delivered as a single ESM/UMD file or via `<script>` tag — perfect for the project's constraints.

### 5.1 GSAP (most recommended — Codrops' weapon of choice in 2025)

51 of Codrops' 2025 tutorials used GSAP for tactile motion. Use case: door swing-open easing, drawer pull lerp, card stagger, vault tumbler clicks.

```bash
npm i gsap@3.13.0
```

Codrops "Obys' Design Books" (2026/01) used GSAP to make a tactile *web library* with physical-feel page stacking; scrolling was deliberately "heavy" so the user felt they were moving physical objects. This is exactly the feel you want.

### 5.2 Three.js (3D vault door, drawer cabinet, treasure chest)

Already standard for Electron. The jeromeetienne/electron-threejs-example repo demonstrates transparent Three.js scenes on top of Electron — set `transparent: true; frame: false` in BrowserWindow; in Three.js `setClearColor(0x000000, 0)`. Drop a `<canvas>` into the vault panel and render a GLB model of a safe door / drawer / chest.

Model formats: GLTF/GLB (compressed binary, ships materials + animations, recommended < 5 MB).

For the user's panel, a **2D canvas overlay** showing only the vault door is cheaper than a full Three.js scene. Use `OrthographicCamera` and pre-baked Blender renders if you want true skeuomorphic depth without WebGL cost. There's also an MIT-licensed interactive 3D portfolio (R3F + Three.js + xterm.js) — proof that an embedded xterm + Three.js scene works cleanly together.

### 5.3 Spline (no-code 3D, free embed via iframe)

URL: spline.design. Spline lets you author a 3D vault door / cabinet in a Figma-like editor; export as iframe URL or as code; new (2025) Timeline tool gives keyframe + curve animation; export to GLTF/GLB/USDZ. For Electron, you can either iframe the published scene or download the GLB and feed it to Three.js. The biggest pioneer angle: Spline's drag-to-unlock examples (Webflow + Spline tutorial by Jack Redley) are exactly the metaphor you want — drag a slider to unlock a 3D vault.

### 5.4 Rive (interactive state-machine animations)

URL: rive.app. **The single best Lottie alternative in 2025.**

- File size: typically 10-15× smaller than equivalent Lottie. Duolingo migrated and saw a 15× reduction.
- FPS: ~60 FPS vs Lottie's ~17 FPS on JS/UI threads.
- Built-in state machine — buttons respond to hover, click, drag, *and* live data. Lottie buttons only play pre-set animations.
- Late 2025 update: LottieFiles is fighting back with web-based state machines + generative-AI Lottie creation, narrowing the gap, but Rive still wins on perf.

For a vault: model the door as a state machine with states `Closed → Unlocking → Opening → Open → Closing`. Each state can have its own animation, and transitions can be driven by inputs (e.g., a "unlock progress" 0-100 float).

### 5.5 Lottie (Adobe After Effects → JSON)

Lottie player files are larger and slower than Rive, but the **library of free Lottie animations** for locks, vaults, drawers (lottiefiles.com `free-animations/lock`) is enormous. Quickest path to a polished unlock animation if you can't draw your own.

### 5.6 GSAP Flip / View Transitions API

Native browser View Transitions API became Baseline in October 2025 (Chrome 111+, Edge 111+, Firefox 133+, Safari 18+). Since Electron 33 ships Chromium 130+, it's native. Use it to interpolate between the closed-vault snapshot and the opened-vault snapshot with a single `document.startViewTransition()` call — the browser auto-snapshots, diffs, and animates *on the compositor thread*. JS-based animations can't compete.

---

## 6. Pioneer references — named apps & projects

The orchestrator asked for **real production examples**. Below is the curated list, organized by aesthetic angle, with what they do and why they matter.

### 6.1 Skeuomorphic music players (proof that turntables, knobs, vinyl sells)

- **MD Vinyl** (iPad/iPhone) — turns your tablet into a turntable that connects to Spotify/Apple Music. Widget plays/pauses/skips without opening the app. ~$10. Tons of Reddit/TikTok love in 2025.
- **Charlotte Doughty's "2.Music"** music player concept — vintage turntable with realistic textures, spinning record, interactive elements. Heavily upvoted on Behance/Dribbble.
- **Orbit kinetic turntable** (Lillian Brown, designboom 2025/10/28) — 39 wooden tiles flip in real time as music plays; audio frequencies → tactile visual field. Physical product, but the aesthetic is a deep well of inspiration for clickable card grids.
- **Vintage Radio app by Xiaoming Phan** (Dribbble) — retro-modern fusion, rounded corners, tactile knobs.
- **Hopscotch / similar tactile music apps** — listed in the orchestrator brief; the searchable record is thinner than for MD Vinyl, but the general pattern (touchable analog controls in a digital music app) is well-documented.

### 6.2 Skeuomorphic notes & libraries (proof that paper + book stacks work)

- **Notability** (mature iPad app) — lined paper, handwriting feel; cited by mockplus.com as a flagship.
- **Paperlike, Goodreads, Notability** — listed in uiverse.io's 2025 article as the trio that "make digital mediums feel like paper."
- **Algirdas Jasaitis' Digital Books App** (Dribbble) — bookshelves with realistic book spines and lifelike textures.
- **Obys' Design Books** (codrops 2026/01/12) — **the closest 2026 reference for your vault.** A tactile web library where books on a curated reading list stack physically; scroll is deliberately heavy; pages move and react when clicked. Built with GSAP and no big framework (Obys preferred "total control over animations"). This is genuinely pioneer-tier — it's how the user's vault should *feel*.

### 6.3 Vault / safe-cracking apps

- **Practice Lock Combo - Vault** (iOS 6751608965) — realistic dial mechanics + haptics.
- **Safe Cracker - Watch Game** (MWM) — Apple Watch Digital Crown drives the dial; haptics fire on each wheel "click".
- **Challenge VAULT** (Sparrows, physical) — real safe used for practice; informs the audio/tactile reference set.

### 6.4 Bookshelf / library / shelf apps

- **Shelves Book Library App** (Piyaphon Inthavong, Behance) — wood-grained shelves, embossed book spines.
- **PubLib UI/UX Design** (Vicky Liu Chen) — interactive public-library metaphor.

### 6.5 Pioneering 3D / WebGL sites (Awwwards 2025-2026)

- **Lando Norris official site** (OFF+BRAND studio, Awwwards Site of the Year 2025) — Webflow + WebGL + Rive; lime green typography; rotating 3D helmet. **Proof that Rive + WebGL is the 2025 pioneer stack.**
- **Bruno Simon's 2025 portfolio** (Awwwards Site of the Month, January 2026) — Three.js, drive a tiny vehicle around a 3D world; spatial audio; literally a 3D playground in a browser tab.
- **Messenger (WebGL planet)** — Awwwards Site of the Year 2025 — tiny WebGL planet where someone makes deliveries. *Not* the chat app.

### 6.6 Apple's own neo-skeuomorphic 2025 redesigns (case study set)

- **iOS 26 Photos app icon** — layered stained-glass leaf, gorgeous.
- **iOS 26 Camera app icon** — return of the high-res lens illustration from iOS 6.
- **Liquid Glass throughout iOS 26 / iPadOS 26 / macOS Tahoe / watchOS 26 / visionOS 26 / tvOS 26**.
- **visionOS 26 spatial widgets** — pin floating widget cards (clocks, music, photos) into your physical room; they reappear next time you put on the Vision Pro.

### 6.7 Adjacent claymorphism (puffy, toy-like UI — Michał Malewicz, 2021)

- Android Bugdroid 3D mascot rebrand (2023).
- Reddit Snoo 3D mascot redesign.
- Windows 11 Fluency emoji set — 3D clay-textured.
- Hype4 Academy's claymorphism.com generator.

Claymorphism is the *opposite* end of the physicality spectrum (soft, inflatable) from the vault (hard, mechanical). Knowing it lets you avoid accidentally going claymorphic when you want gunmetal.

---

## 7. Recipes for tactile button styles

These are the specific button treatments that would line the inside of your vault — the "paste", "copy", "rename", "delete prompt" controls.

### 7.1 Embossed metal button (recommended for vault paste action)

```css
.btn-emboss {
  --c1: #c8cdd2;
  --c2: #97a0aa;
  --c3: #6f7782;
  padding: 10px 18px;
  border-radius: 6px;
  color: #1a1a1a;
  font-weight: 700;
  letter-spacing: 0.04em;
  background:
    linear-gradient(180deg, var(--c1) 0%, var(--c2) 50%, var(--c3) 100%);
  border: 1px solid #565d65;
  box-shadow:
    inset 0  1px 0 rgba(255,255,255,0.7),
    inset 0 -1px 0 rgba(0,0,0,0.35),
    0 1px 0 rgba(255,255,255,0.5),
    0 2px 0 #3e434a,
    0 6px 12px rgba(0,0,0,0.4);
  text-shadow:
    0  1px 0 rgba(255,255,255,0.5),
    0 -1px 0 rgba(0,0,0,0.4);
  transition: transform 60ms ease, box-shadow 60ms ease;
}
.btn-emboss:active {
  transform: translateY(2px);
  box-shadow:
    inset 0  2px 4px rgba(0,0,0,0.4),
    0 0 0 #3e434a,
    0 1px 4px rgba(0,0,0,0.4);
}
```

The 5-layer shadow stack (2 inset, 3 outset) creates real-looking thickness. The text gets a *dual* shadow for an embossed feel: light above, dark below.

### 7.2 Leather button (for "lock vault" or premium feel)

Wrap the button in a `div` with a leather background (PNG or SVG noise + brown gradient) and inset `box-shadow` around the edge. Engraved-letter recipe from §4.2.

### 7.3 Paper / parchment chip (for prompt titles)

Each prompt file's title chip in the vault is a small parchment card with a subtle tape strip:

```css
.paper-chip {
  padding: 6px 12px;
  background-color: #f4ecd8;
  background-image: url("data:image/svg+xml;utf8,<svg ...feTurbulence... />");
  border-radius: 2px;
  box-shadow:
    0 1px 2px rgba(0,0,0,0.15),
    0 4px 12px rgba(0,0,0,0.08);
  transform: rotate(var(--tilt, -0.6deg));
  font-family: 'Courier New', monospace;
}
.paper-chip::before {
  content: '';
  position: absolute;
  top: -6px; left: 30%; right: 30%;
  height: 14px;
  background: rgba(255, 240, 180, 0.6);
  filter: blur(0.4px);
  /* fake masking tape */
}
```

Randomize `--tilt` per chip in JS for a natural pinned-paper feel.

### 7.4 Jelly / squishy button (for cute "+" add-prompt action)

CSS-only "jelly wobble" on `:active`:

```css
@keyframes jelly {
  0%   { transform: scale3d(1, 1, 1); }
  30%  { transform: scale3d(1.25, 0.75, 1); }
  40%  { transform: scale3d(0.75, 1.25, 1); }
  50%  { transform: scale3d(1.15, 0.85, 1); }
  65%  { transform: scale3d(0.95, 1.05, 1); }
  75%  { transform: scale3d(1.05, 0.95, 1); }
  100% { transform: scale3d(1, 1, 1); }
}
.btn-jelly:active { animation: jelly 600ms ease; }
```

### 7.5 Mechanical-switch button (for "Eject" / "Reset" / destructive ops)

Reference: hardware tactile switches (the metal dome that flexes on press). Visual recipe: cylindrical body + raised square cap + LED dot. Use Rive for the actual press/click animation (state machine: idle → pressing → pressed → releasing).

### 7.6 Nature-inspired button ("smooth pebble" / "soft leaf")

Mentioned by silphiumdesign.com's 2026 trends piece. Biomorphism: shapes from life + haptic-visual feedback so "every click feels like a natural event." Pair with `oklch()` colors that lean toward warm earth tones (umber, sage, ochre).

### 7.7 Sparkle / AI generation button (for "Re-roll prompt" or "Make this better with AI")

From sliderrevolution.com's 2025 button collection: "Sparkle Generate Button emits a cloud of floating sparkles." Uses CSS variables + lightweight JS to randomize particle paths. Best used sparingly — once per panel.

---

## 8. Modern CSS techniques to bind it all together

### 8.1 View Transitions API (Chromium-native, Baseline Oct 2025)

```js
function openVault() {
  if (!document.startViewTransition) {
    // graceful fallback
    document.querySelector('.vault').classList.add('open');
    return;
  }
  document.startViewTransition(() => {
    document.querySelector('.vault').classList.add('open');
  });
}
```

Pair with `view-transition-name: vault-door` in CSS to make the door specifically a participant in the morph. Compositor-thread animation; no FPS hit.

### 8.2 OKLCH colors

```css
:root {
  --gold:  oklch(0.78 0.14 85);
  --steel: oklch(0.65 0.02 250);
  --paper: oklch(0.92 0.04 80);
  --vault-glass: oklch(0.50 0.05 230 / 0.55);
}
.btn-emboss:hover {
  /* perceptually uniform tint - won't muddy like sRGB */
  background: color-mix(in oklch, var(--steel) 80%, white);
}
```

OKLCH is supported in Chrome 111+, Safari 15.4+, Firefox 113+. Wide-gamut P3 on modern Macs. `color-mix(in oklch, ...)` generates hover/active variants without a build step.

### 8.3 Scroll-driven animations (`animation-timeline: scroll()` / `view()`)

Use a `scroll()` timeline to drive the vault door's open angle by how far the user has scrolled the prompt list:

```css
@keyframes door-creep {
  from { transform: perspective(1200px) rotateY(0); }
  to   { transform: perspective(1200px) rotateY(-110deg); }
}
.vault-door {
  animation: door-creep 1 linear;
  animation-timeline: scroll(self block);
  animation-range: entry 0% cover 30%;
}
```

This is the "Codrops 2025" tactile-web-library trick: scrolling becomes *interaction with a physical object*. Compositor-thread. Stays at 60 fps.

### 8.4 `backdrop-filter` with SVG displacement (Chromium-only)

For genuine Liquid-Glass-grade refraction, use an SVG `feDisplacementMap` as the input to `backdrop-filter`. The kube.io article documents the recipe. Electron 33 / Chromium fully supports it.

### 8.5 Container queries for vault sizing per-tab

Each tab's vault panel can be small (e.g., 280 px wide) or expanded full-width depending on terminal layout. `@container` queries let the vault re-render lockers vs. wide shelves automatically.

### 8.6 `popover` attribute (CSS-only modal vault drawer)

The Frontend Masters article "Popovers Work Pretty Nicely as Slide-Out Drawers" (2024-2025) shows that the native `popover` attribute (Baseline 2024) is now a clean way to do the slide-out drawer with zero JS for state. Combine with `transition-behavior: allow-discrete` to animate in/out.

---

## 9. Library install / drop-in commands

A consolidated list for the EZvibes's vanilla-JS / no-bundler stack:

```bash
# Animation
npm i gsap@^3.13            # tactile motion (door, drawer, cards)
npm i @rive-app/canvas@^2   # state-machine animations (vault dial, locker)
npm i lottie-web@^5.12      # quickest lock/vault Lottie animations

# 3D
npm i three@^0.169          # vault door / cabinet / chest as 3D mesh
npm i @react-three/fiber    # ONLY if migrating to React; skip for vanilla

# Utility
# (these are essentially copy/paste recipes - no install)
# nnnoise (uwarp.design / fffuel.co/nnnoise) - SVG noise generator (use output as data: URL)
# claymorphism.com - shadow generator for clay-style controls
# glasscss.com - Liquid Glass CSS generator
```

For pure-CSS recipes (brushed metal, paper, gold) **no install is needed** — they're stylesheet snippets.

For an Electron-friendly Three.js skeleton, see `jeromeetienne/electron-threejs-example` (transparent canvas on top of Electron, MIT license).

---

## 10. Pioneer-level blueprint: the "Vault Inside the Folder"

This is the synthesis. Use what's above to build a thing nobody else has built.

### 10.1 The structure

Inside each session window, alongside the xterm tab, add a left-edge **vault panel** (~360 px). Default state: closed bank vault door, with a `Z`-emblem on the dial (matching the project's ezvibes brand). The whole panel uses a `dark-walnut` wooden surface as the wallpaper. The door is mounted on the wall with three rivets at top/middle/bottom of the left edge. The door has a brass plaque reading the current folder name in engraved-leather lettering ("DOCUMENTS/EZvibes", "DOCUMENTS/EZvibes/SCRIPTS", etc.).

### 10.2 Open the vault

Three ways:

1. **Spin-dial puzzle (default).** Drag the dial three times. Each correct stop (the current folder hash mod 100 yields 3 numbers) plays a Rive-driven tumbler click, with a deeper bass thud on the third. On the third correct, the door swings open in 700 ms (`cubic-bezier(.2,.8,.1,1)`).
2. **Tap to unlock (low-friction).** Single tap on the dial + a brief unlock animation. For users who don't want the puzzle.
3. **Auto-open** if the user has set a "always open" preference per folder.

The choice fits the EZvibes ethos: launching Claude is fast, but the vault is a *moment* you opt into.

### 10.3 Inside the vault — the cabinet

Behind the door is a **manila-folder filing cabinet** (recipe in §2.2). Each cabinet drawer corresponds to one *kind* of artifact:

- **PROMPTS** — `*.prompt.md`, `*.md` curated by the user as prompts.
- **HAND-OFFS** — any `*.handoff.md` or `*.handoff` file in the folder. Auto-watched (see §10.5).
- **CLAUDE.md** — pinned at top, single drawer that contains exactly the folder's `CLAUDE.md` if present.
- **SCRATCH** — anything ad-hoc the user dropped in (notes, ideas, half-cooked prompts).
- **FROM OTHER SESSIONS** — files saved by other Claude sessions in other EZvibes windows. (This is the "hand-off across sessions" magic the user described.)

Drawers slide open with the brushed-metal pull animation. Inside each drawer, files are rendered as **paper chips** (§7.3), tilted 0.5–1° per chip (randomized) so they look pinned-up rather than printed. Each chip shows the filename and a 1-line preview.

### 10.4 The paste interaction

Three options, all simultaneous:

1. **Click chip** → paste content into active xterm tab. Send a small SVG "ink splat" particle from the chip to the terminal to visually confirm. Optionally trigger a soft `chunk` sound (skip if the project hasn't shipped audio yet).
2. **Drag chip onto terminal area** → pastes on drop. Show a phantom shadow card following the cursor in real time.
3. **Hover chip → preview popover** (with `popover` attribute) showing the full content. Click "Paste" button (embossed metal, §7.1).

The actual mechanism in renderer/app.js: when pasting, write the markdown content into the active session's PTY via the existing `ezvibes.writeTerminal(sessionId, content)` IPC.

### 10.5 Live cross-session hand-off (the killer feature)

Watch the vault directory tree from Electron main with `chokidar` (already in many Electron apps' deps; alternatively `fs.watch`). Whenever any session — including a separate Claude instance running headless somewhere else — writes a `*.handoff.md` into the watched folder, the main process emits `vault:file-added` on IPC. The vault panel animates the new chip *into the drawer*: it floats in from above with a 600 ms cubic-bezier easing, lands at a slight tilt, and pulses gold for 1.5 s.

Now you can:

1. Tell session A: "Write a hand-off note for session B."
2. Session A creates `/path/to/folder/handoff-2026-05-25.md`.
3. Session B's vault panel pops the chip onto the desk in real time.
4. Click → paste → "Resuming where you left off..."

### 10.6 Glass dome

The whole vault contents (cabinet + chips + brass plaque) sit *behind* a Liquid-Glass dome (§4.6). When the dial is being spun (vault closed), the dome is fully opaque, frosted, and the user sees only blurred silhouettes inside — building anticipation. When the dial completes, the dome animates `opacity: 0` and `backdrop-filter` falls off in 400 ms (or use a View Transition to keep it on the compositor thread).

### 10.7 The Z-monogram dial

For the dial face, replace generic combination markings with **the Z-monogram from the ezvibes icon**. This ties the vault back to the project's branding (CLAUDE.md mentions the Z folder icon). Engraved into brushed steel, with gold inlay (§4.1 + §4.2).

### 10.8 Total cost estimate

- Pure-CSS recipes (brushed steel, paper, gold, glass) — zero install, ~6 KB CSS.
- GSAP for door/drawer/chip motion — ~75 KB gz.
- Three.js OR Rive for the dial-and-door (pick one) — Rive ~70 KB gz; Three.js ~150 KB gz.
- Optional: a single 3D safe-door GLB if you want true 3D rather than CSS — ~300 KB.

Comfortably ships in well under 1 MB of net new payload for the entire vault feature. The biggest budget items are *time spent on visual polish*, not bytes.

---

## 11. What competitors are NOT doing (your moat)

Most prompt-management UIs in 2025-2026 are very flat:

- **PromptVault** (Chrome extension) — flat list with copy button.
- **Prompt Vault by bharathkumar-12** (GitHub) — minimal HTML/CSS/JS, no animation.
- **w512/Prompt-Vault** — likewise utility-first.
- **Markagent** (DEV Community, "turn any UI click into a perfect prompt for Claude/Cursor/Codex") — flat panel.
- **GenDesigns / LandingHero / Design+AI prompt libraries** — copy-paste blocks, flat cards, no physicality at all.

There is **no production prompt vault using skeuomorphic / Liquid Glass / 3D vault metaphor as of May 2026**. The user's idea is genuinely a green field. Going pioneer-tier costs maybe 2-3 days of polish; the resulting design moat is real.

---

## 12. Caveats from the trenches

- **Legibility first.** Apple's own macOS 26 Tahoe is getting design fixes in 26.x and 27 because Liquid Glass went too far on translucency. Keep the *file names* on opaque cards inside the vault; reserve glass for the dome.
- **Animation budget.** Each open-vault animation should be no longer than 700–900 ms. Faster than that and it feels skippable; slower and it gets in the way of work.
- **Reduced motion.** Wrap all the heavy transforms in `@media (prefers-reduced-motion: reduce)` and fall back to instant open. The EZvibes is a productivity app first.
- **Performance.** `backdrop-filter: blur()` is expensive — limit to the dome and 1-2 floating buttons. Don't apply to the entire panel.
- **Theme.** Decide early whether the vault sits inside the existing folder/terminal-popup chrome or *replaces* part of it. Aesthetic unity matters more than which specific style you pick.
- **Dark mode.** All recipes above were sketched for the project's existing dark-ish wood + brushed-metal palette. If the user toggles to a "light cabin" theme (oak + white), recolor the gold to brass and the steel to chrome.

---

## 13. References & further reading

### Skeuomorphism revival & trends
- Kryzalid — *Skeuomorphism: an unexpected comeback in 2025* — https://kryzalid.net/en/web-marketing-blog/skeuomorphism-an-unexpected-comeback-in-2025/
- Big Human — *What is Skeuomorphism? A Complete 2026 Guide* — https://www.bighuman.com/blog/guide-to-skeuomorphic-design-style
- Big Human — *What Is Neumorphism in UI Design? A Complete 2026 Guide* — https://www.bighuman.com/blog/neumorphism
- UI Verse — *The Rise of Skeuomorphic Minimalism: UI Design's Unexpected Comeback in 2025* — https://uiverse.io/blog/the-rise-of-skeumorphic-minimalism-ui-designs-unexpected-comeback-in-2025
- Pixite — *Why Skeuomorphism Is Making a Comeback in 2025* — https://pixite.com.au/the-resurgence-of-skeuomorphism/
- UXmatters — *The Renaissance of Skeuomorphic Design in Modern User Experiences* — https://www.uxmatters.com/mt/archives/2024/11/the-renaissance-of-skeuomorphic-design-in-modern-user-experiences-bridging-the-digital-and-the-physi.php
- Strate.in — *Skeuomorphism Design Trend: Why It's Making a Comeback* — https://strate.in/skeuomorphism-design-trend-comeback/
- Mockplus — *20 Best Skeuomorphic UI Design Examples* — https://www.mockplus.com/blog/post/skeuomorphic-design-examples
- LogRocket — *Skeuomorphism in UX: Definitions, examples, and its relevance today* — https://blog.logrocket.com/ux-design/skeuomorphism-ux-design-examples/

### Apple Liquid Glass / iOS 26 / macOS Tahoe
- Apple Newsroom — *Apple introduces a delightful and elegant new software design* — https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- Wikipedia — *Liquid Glass* — https://en.wikipedia.org/wiki/Liquid_Glass
- TechRadar — *Apple's new Liquid Glass design puts the spotlight on skeuomorphism for the first time since iOS 6* — https://www.techradar.com/phones/iphone/apples-new-liquid-glass-design-puts-the-spotlight-on-skeuomorphism-for-the-first-time-since-ios-6-and-im-all-for-it
- Apple Magazine — *Liquid Glass: How Apple's Design Evolved From Skeuomorphism to iOS 26* — https://applemagazine.com/liquid-glass-ios-evolution/
- MobileAction — *Apple Liquid Glass design in iOS 26: Redesign your app icon* — https://www.mobileaction.co/blog/apple-liquid-glass-design/
- Wikipedia — *macOS Tahoe* — https://en.wikipedia.org/wiki/MacOS_Tahoe
- 9to5Mac — *macOS 27 to feature UI tweaks to address some Tahoe design complaints* — https://9to5mac.com/2026/05/10/report-macos-27-to-feature-ui-tweaks-to-address-some-tahoe-design-complaints/
- MacDailyNews — *Apple to refine macOS 27 with 'Liquid Glass' design tweaks after macOS 26 Tahoe backlash* — https://macdailynews.com/2026/05/11/apple-to-refine-macos-27-with-liquid-glass-design-tweaks-after-macos-26-tahoe-backlash/
- Apple Newsroom — *visionOS 26 introduces powerful new spatial experiences for Apple Vision Pro* — https://www.apple.com/newsroom/2025/06/visionos-26-introduces-powerful-new-spatial-experiences-for-apple-vision-pro/
- Apple Developer — *Icon Composer* — https://developer.apple.com/icon-composer/
- createwithswift.com — *Crafting Liquid Glass app icons with Icon Composer* — https://www.createwithswift.com/crafting-liquid-glass-app-icons-with-icon-composer/

### Frutiger Aero revival
- Kittl — *Frutiger Aero aesthetic: The glossy 2000s design trend making a comeback in 2026* — https://www.kittl.com/blogs/frutiger-aero-aesthetic-stl/
- Wikipedia — *Frutiger Aero* — https://en.wikipedia.org/wiki/Frutiger_Aero
- Adobe Express — *What is Frutiger Aero? A retro trend returns* — https://www.adobe.com/uk/express/learn/blog/what-is-frutiger-aero

### CSS technique recipes
- CSS-Tricks — *Grainy Gradients* — https://css-tricks.com/grainy-gradients/
- freeCodeCamp — *How to Create Grainy CSS Backgrounds Using SVG Filters* — https://www.freecodecamp.org/news/grainy-css-backgrounds-using-svg-filters/
- Codrops — *SVG Filter Effects: Creating Texture with feTurbulence* — https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/
- fffuel — *nnnoise: Online SVG Noise Texture Generator* — https://www.fffuel.co/nnnoise/
- CSS-Tricks — *Brushed Metal with CSS Gradients* — https://css-tricks.com/brushed-metal-with-css-gradients/
- Simurai — *Brushed Metal — Repeating background gradients* — https://simurai.com/lab/2011/08/21/brushed-metal
- Speckyboy — *8 Amazing Metallic Effects Built With CSS & JavaScript* — https://speckyboy.com/metallic-effects-css-javascript/
- ibelick — *Creating a metallic effect with CSS* — https://ibelick.com/blog/creating-metallic-effect-with-css
- Tanner Nielsen — *Creating an Engraved Leather Effect with CSS* — https://blog.tannernielsen.com/2019/01/25/creating-an-engraved-leather-effect-with-css/
- CSS Author — *Free Wood Texture and Patterns* — https://cssauthor.com/free-wood-texture-and-patterns/
- Texturize — *Free Wood Texture Generator* — https://texturize.app/generators/wood
- Speckyboy — *8 CSS & JavaScript Snippets That Feature Wood Textures* — https://speckyboy.com/css-javascript-snippets-wood-textures/
- ibelick — *Creating grainy backgrounds with CSS* — https://ibelick.com/blog/create-grainy-backgrounds-with-css
- Tutorialpedia — *How to Create an Old Paper Background Texture Using Pure CSS* — https://www.tutorialpedia.org/blog/old-paper-background-texture-with-just-css/

### Glass / Liquid Glass implementations
- GitHub — *kevinbism/liquid-glass-effect* — https://github.com/kevinbism/liquid-glass-effect
- FreeFrontend — *16 CSS Liquid Glass Effects* — https://freefrontend.com/css-liquid-glass/
- ThatHTMLBlog — *Clever Backdrop Filtering for Eye-catching Glass Effects* — https://thathtml.blog/2025/07/clever-backdrop-filtering-for-eyecatching-glass-effects/
- glasscss.com — *Liquid Glass Generator / CSS Glass Morphism Tool* — https://glasscss.com/
- LogRocket — *How to create Liquid Glass effects with CSS and SVG* — https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/
- kube.io — *Liquid Glass in the Browser: Refraction with CSS and SVG* — https://kube.io/blog/liquid-glass-css-svg/

### Buttons, cards, motion
- SliderRevolution — *Innovative CSS 3D Buttons for Interactive UIs* — https://www.sliderrevolution.com/resources/css-3d-buttons/
- FreeFrontend — *40 CSS 3D Buttons* — https://freefrontend.com/css-3d-buttons/
- WPDean — *35 Awesome CSS 3D Buttons For Web Designers* — https://wpdean.com/css-3d-button/
- FreeFrontend — *33 CSS Paper Effects* — https://freefrontend.com/css-paper-effects/
- Subframe — *10 CSS Paper Effect Examples* — https://www.subframe.com/tips/css-paper-effect-examples
- Josh W. Comeau — *Designing Beautiful Shadows in CSS* — https://www.joshwcomeau.com/css/designing-shadows/
- Storbeck.dev — *Hand-Held Card Fan (Lerped)* — https://www.storbeck.dev/demos/card-deck-lerp
- Codrops — *Obys' Design Books: Turning a Reading List Into a Tactile Web Library* — https://tympanus.net/codrops/2026/01/12/obys-design-books-turning-a-reading-list-into-a-tactile-web-library/
- CodeMyUI — *Pure CSS Drawer Menu / Drawer animations* — https://codemyui.com/pure-css-drawer-menu/
- Frontend Masters — *Popovers Work Pretty Nicely as Slide-Out Drawers* — https://frontendmasters.com/blog/popovers-work-pretty-nicely-as-slide-out-drawers/
- Quackit — *CSS Animation Example: The Stacked Card Fan* — https://www.quackit.com/css/animations/examples/css_animation_stacked_card_fan.cfm

### Animation libraries
- Rive — *Rive vs Lottie* — https://rive.app/blog/rive-as-a-lottie-alternative
- Rive — *Rive — the interactive experience engine* — https://rive.app/
- DEV Community — *Rive vs Lottie: Which Animation Tool Should You Use in 2025?* — https://dev.to/uianimation/rive-vs-lottie-which-animation-tool-should-you-use-in-2025-p4m
- LottieFiles — *LottieFiles or Rive: Which One Fits Your Needs Better?* — https://lottiefiles.com/blog/working-with-lottie-animations/lottiefiles-or-rive
- LottieFiles — *Free Lock Animations* — https://lottiefiles.com/free-animations/lock
- Spline — *3D Web Experiences* — https://spline.design/solutions/3d-web-experiences
- Codrops — *Animating a 3D Scene with Spline's New Timeline Tool* — https://tympanus.net/codrops/2025/11/05/animating-a-3d-scene-with-splines-new-timeline-tool/
- Jack Redley — *Building 3D Web Experiences: Drag-to-Unlock Magic with Webflow + Spline* — https://www.jackredley.design/articles/building-3d-web-experiences-drag-to-unlock-magic-with-webflow-spline
- Three.js — main site — https://threejs.org/
- GitHub — *jeromeetienne/electron-threejs-example* — https://github.com/jeromeetienne/electron-threejs-example

### Modern CSS / browser APIs
- MDN — *View Transition API* — https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Chrome for Developers — *What's new in view transitions (2025 update)* — https://developer.chrome.com/blog/view-transitions-in-2025
- MDN — *CSS scroll-driven animations* — https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- scroll-driven-animations.style — *Scroll-driven Animations* — https://scroll-driven-animations.style/
- Codrops — *Creating 3D Scroll-Driven Text Animations with CSS and GSAP* — https://tympanus.net/codrops/2025/11/04/creating-3d-scroll-driven-text-animations-with-css-and-gsap/
- Evil Martians — *OKLCH in CSS: why we moved from RGB and HSL* — https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- oklch.org — *The Ultimate OKLCH Guide* — https://oklch.org/posts/ultimate-oklch-guide

### Vault / lock apps & references
- App Store — *Practice Lock Combo - Vault* — https://apps.apple.com/us/app/practice-lock-combo-vault/id6751608965
- MWM — *Safe Cracker - Watch Game* — https://mwm.ai/apps/safe-cracker-watch-game/1638618972
- Sparrows Lock Picks — *Challenge VAULT* — https://www.sparrowslockpicks.com/products/challenge-vault
- Wikipedia — *Safe-cracking* — https://en.wikipedia.org/wiki/Safe-cracking

### Misc
- Awwwards — *Annual Awards 2025* — https://www.awwwards.com/annual-awards-2025/
- Awwwards — main site — https://www.awwwards.com/
- hype4.academy — *Claymorphism in User Interfaces* — https://hype4.academy/articles/design/claymorphism-in-user-interfaces
- claymorphism.com — generator — https://claymorphism.com
- Wikipedia — *Desktop metaphor* — https://en.wikipedia.org/wiki/Desktop_metaphor
- Mobbin — *Drawer UI Design: Best practices, Design variants & Examples* — https://mobbin.com/glossary/drawer
- Codrops — *2025: A Very Special Year in Review* — https://tympanus.net/codrops/2025/12/29/2025-a-very-special-year-in-review/
- Codrops — main hub — https://tympanus.net/codrops/
