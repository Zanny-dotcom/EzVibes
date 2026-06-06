# Research — Liquid Glass / Glassmorphism (Slice A3)

**Date:** 2026-05-27
**Scope:** Liquid Glass design language (Apple iOS 26) and web techniques (backdrop-filter, SVG displacement, specular highlights) for a dark-navy agent platform.

---

## 1. How to Look at This Correctly (Meta)

"Glassmorphism" in 2020 meant a translucent rounded rectangle with `backdrop-filter: blur(10px)` and a 1px white border. That cliche is now visually exhausted. Apple's iOS 26 **Liquid Glass** (WWDC 2025) reset the bar: a material is no longer "glass" because it is blurry — it is glass because it **refracts content behind it, catches a specular highlight along a top edge, and reacts to motion / context**. To evaluate any implementation, use these five lenses:

1. **Refraction vs. blur.** Cheap glass blurs; real glass *bends* what is behind it. Refraction shows up as content "warping" near edges (lensing). On the web this requires SVG `feDisplacementMap` driving `backdrop-filter` — pure CSS cannot refract. Implementations that only blur fail this lens.
2. **Specular / edge highlight.** Glass has a bright rim where light grazes the surface. Without it the panel reads as "tinted plastic." A 1px inner white border alone is not enough; you need either inset shadows simulating top-light or a blurred specular layer composited via SVG. Apple ships specular highlights that *animate with device tilt*.
3. **Layer stack discipline.** Production-grade glass is at least three layers: **(a)** distortion/refraction layer (backdrop), **(b)** content-tint layer (color, saturation), **(c)** specular/reflection layer (edge highlight, gradient overlay). Single-element CSS rarely reaches the look.
4. **Performance budget.** `backdrop-filter: blur()` and SVG filters are GPU-bound. Blur >20px is exponentially expensive; SVG-as-backdrop-filter reserves GPU resources even when idle. Rule: floating elements only (nav, modals, toolbars, CTAs) — never the whole page, never long lists. Force compositor layer with `transform: translateZ(0)`.
5. **Accessibility & graceful degradation.** Three real risks: contrast loss on busy backdrops (WCAG 4.5:1 body / 3:1 large), Safari/Firefox not supporting SVG-as-backdrop-filter, and `prefers-reduced-transparency` users. Every glass component must ship a solid fallback gated by `@supports` and the reduced-transparency media query.

If an implementation passes 1–3 it looks "Apple"; if it also passes 4–5 it ships.

---

## 2. Current State of the Art (2024–2026)

### Apple Liquid Glass (iOS 26 / iPadOS 26 / macOS Tahoe 26)
Announced WWDC June 2025, rolled out across iOS/iPadOS/macOS/watchOS/tvOS 26. Differentiators vs 2020 glassmorphism:
- **Real-time lensing** — content behind elements actively refracts.
- **Specular highlights that respond to device motion** — gyroscope-driven rim light.
- **Adaptive frost** — material flips between clear and frosted depending on contrast needs (legibility-aware).
- **Context-aware bubbles** — toolbars float as glass capsules, not pinned bars; they expand/contract.
- **Layered material** — Dock, app icons, widgets are stacks of glass with depth.

Apple's design team prototyped with physical glass samples to calibrate digital refraction. Critics flagged legibility issues in beta (sunlight readability), which Apple addressed by adding opacity controls and bumping nav-bar tint.

### Web Techniques — Stack Hierarchy (cheap to Apple-grade)
| Tier | Technique | Cost | Browsers |
|------|-----------|------|----------|
| 1 | `backdrop-filter: blur() saturate()` + 1px border | Cheap | All modern (97%+) |
| 2 | + multi-layer inset box-shadows for specular | Cheap | All modern |
| 3 | + Comeau's "extended backdrop" trick (mask-gradient to capture nearby pixels) | Cheap | All modern |
| 4 | + SVG `feTurbulence` + `feDisplacementMap` *as* `backdrop-filter` for true refraction | Heavy GPU | **Chromium only** |
| 5 | + WebGL/shader (Three.js, OGL) sampling screen texture into a Perlin-displaced UV | Very heavy | All modern, framework-dependent |

**The browser support cliff** sits between tier 3 and tier 4. `backdrop-filter: url(#svg-filter)` works only in Chromium (Chrome, Edge, Brave, Arc). Safari and Firefox silently fall back. This is the single most important production constraint in 2026.

### Component Libraries Shipping Liquid-Glass Primitives (2025–2026)
- **Aceternity UI** — Tailwind + Framer Motion; ships glass cards, hero sections, animated borders.
- **Magic UI** — 50+ animated components on top of shadcn; over-the-top 3D / shimmer.
- **glasscn-ui** — shadcn fork with explicit glassmorphism variants (drop-in tokens).
- **Ein UI (einui)** — React/Next.js liquid-glass library, shadcn-compatible, accessible, dark-mode built in.
- **FlyonUI** — Tailwind plugin with liquid-glass utilities.

For a dark-navy agent platform, **glasscn-ui** + **Aceternity** for accents + a custom SVG displacement filter for hero/CTA elements is the current pragmatic stack.

---

## 3. Implementation Guidance — Production Code

### 3a. Basic (Tier 1–3): Works everywhere, tuned for dark navy

```css
/* Dark-navy liquid glass panel — universal browser support */
.liquid-glass {
  /* Slight cool tint over a dark navy background */
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );

  /* The frost */
  backdrop-filter: blur(18px) saturate(180%) brightness(110%);
  -webkit-backdrop-filter: blur(18px) saturate(180%) brightness(110%);

  /* Edge highlight — a real 1px hairline */
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;

  /* Specular: top-edge bright line + outer drop, inner inset */
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.22),     /* top specular */
    inset 0 -1px 0 0 rgba(255, 255, 255, 0.04),    /* bottom faint */
    0 8px 32px 0 rgba(2, 6, 23, 0.45),             /* drop on navy */
    0 1px 2px 0 rgba(0, 0, 0, 0.20);

  /* Compositor layer — keeps blur cheap */
  transform: translateZ(0);
  will-change: backdrop-filter;
}

/* Accessibility: respect user system preferences */
@media (prefers-reduced-transparency: reduce) {
  .liquid-glass {
    background: #0f172a;          /* solid navy */
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

/* Progressive enhancement: solid fallback if backdrop-filter is unsupported */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .liquid-glass {
    background: rgba(15, 23, 42, 0.92);
  }
}
```

Key choices for **dark navy**: low-alpha *white* gradient (cool light leak), `saturate(180%)` to counter the desaturation that blur causes on dark backgrounds, and `brightness(110%)` to add the subtle "lift" that distinguishes glass from a flat dark card.

### 3b. Advanced (Tier 4): SVG displacement + specular composite — Chromium-only, with fallback

```html
<!-- SVG filter: define once, reuse everywhere -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="liquid-glass-refraction" x="0%" y="0%" width="100%" height="100%">
      <!-- 1. Generate organic noise (the lensing pattern) -->
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.012 0.018"
        numOctaves="2"
        seed="4"
        result="noise" />

      <!-- 2. Smooth the noise so refraction is buttery, not pixelated -->
      <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />

      <!-- 3. Use the noise to displace pixels (THIS is refraction) -->
      <feDisplacementMap
        in="SourceGraphic"
        in2="softNoise"
        scale="40"
        xChannelSelector="R"
        yChannelSelector="G"
        result="refracted" />

      <!-- 4. Specular: feSpecularLighting gives the rim highlight -->
      <feSpecularLighting
        in="softNoise"
        surfaceScale="3"
        specularConstant="1.2"
        specularExponent="32"
        lighting-color="#ffffff"
        result="spec">
        <feDistantLight azimuth="225" elevation="60" />
      </feSpecularLighting>

      <!-- 5. Composite the specular only where the source is opaque -->
      <feComposite in="spec" in2="SourceGraphic" operator="in" result="specMasked" />

      <!-- 6. Layer specular over the refracted backdrop -->
      <feBlend in="specMasked" in2="refracted" mode="screen" />
    </filter>
  </defs>
</svg>
```

```css
/* Apply the SVG filter as a backdrop-filter (Chromium-only) */
.liquid-glass--refraction {
  position: relative;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.18);
  overflow: hidden;
  isolation: isolate;

  /* Chromium: real refraction. Safari/Firefox: ignored silently. */
  backdrop-filter: url(#liquid-glass-refraction) blur(8px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%); /* Safari fallback path */

  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    inset 0 0 24px rgba(255, 255, 255, 0.04),
    0 12px 40px rgba(2, 6, 23, 0.5);
}

/* Top-edge specular sheen — works in all browsers */
.liquid-glass--refraction::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.04) 22%,
    transparent 50%
  );
  mix-blend-mode: screen;
  z-index: 1;
}

/* Bottom faint inner glow — reads as "light bleed through glass" */
.liquid-glass--refraction::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 50% 120%,
    rgba(99, 179, 237, 0.10) 0%,   /* cool sky-blue light leak */
    transparent 60%
  );
  z-index: 0;
}
```

**Status:** the SVG-as-`backdrop-filter` path is **experimental — Chromium only** (Chrome, Edge, Brave, Arc as of 2026). Safari and Firefox silently ignore the `url()` reference and fall through to the plain `blur()` portion. The `::before` and `::after` specular pseudo-elements are universal and carry the look in non-Chromium browsers. Test in Safari before shipping.

### Notes on combining with dark navy
- Use **cool-white** (not pure white) for specular: `rgba(226, 232, 240, 0.22)` reads more "glass" than `255 255 255` on a navy field.
- Add a 4–8% **sky-blue light leak** at the bottom (radial gradient, `mix-blend-mode: screen`) to suggest backlight through the panel.
- Avoid `backdrop-filter: brightness(>120%)` on navy — washes out the tint. Stay between 105–115%.
- For mesh-gradient backdrops behind the glass, keep mesh saturation high; the glass's `saturate(180%)` is what makes color "pop" through.

---

## 4. Cross-References to Sibling Research
- **A1 (trust psychology)** — Liquid glass connotes "premium / Apple" but can read "gimmick" if overused; pair sparingly with the trust patterns A1 identifies.
- **A2 (color palette)** — assumes navy tokens (`#0f172a`, `#1e293b`); the white-alpha values in §3 may need re-tuning if the navy is darker (`#020617`) — push to `rgba(255,255,255,0.10)` and bump saturate to 200%.
- **A4 (corner radius / border)** — the 1px hairline border in §3 is the entry point for A4's hairline system; specular highlight depends on the border being present, so A4's choices directly affect this look.
- **A5 (site teardowns)** — Apple.com/iOS-26, Linear, Vercel, Arc Browser are the canonical "good glass" references; A5 should document their specific implementations.

---

## 5. Sources

1. [Apple Newsroom — Liquid Glass announcement (June 2025)](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
2. [Wikipedia — Liquid Glass (design language)](https://en.wikipedia.org/wiki/Liquid_Glass)
3. [kube.io — Liquid Glass in the Browser: Refraction with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/)
4. [LogRocket — How to create Liquid Glass effects with CSS and SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
5. [Josh W. Comeau — Next-level frosted glass with backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/)
6. [Atlas Pup Labs — Liquid Glass, but in CSS](https://atlaspuplabs.com/blog/liquid-glass-but-in-css)
7. [Kevin Bism (DEV) — Recreating Apple's Liquid Glass Effect with Pure CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)
8. [Axess Lab — Glassmorphism Meets Accessibility](https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/)
9. [Lucky Graphics — Liquid Glass: Definitive Guide to High-Performance Refractive UI 2026](https://lucky.graphics/learn/liquid-glass-css-glassmorphism-tutorial/)
10. [SVG Genie — Advanced SVG Filters: Glassmorphism and Glitch Effects](https://www.svggenie.com/blog/advanced-svg-filters-glassmorphism-glitch)
11. [Aceternity UI](https://ui.aceternity.com/)
12. [glasscn-ui (GitHub)](https://github.com/itsjavi/glasscn-ui)
13. [Ein UI — Liquid Glass UI Library for React & Next.js](https://ui.eindev.ir/)
14. [FlyonUI — Liquid Glass Effects in Tailwind CSS](https://flyonui.com/blog/liquid-glass-effects-in-tailwind-css/)
15. [liquid-glass.org — Apple Liquid Glass deep dive](https://www.liquid-glass.org/)
