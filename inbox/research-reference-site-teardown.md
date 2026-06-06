# Reference Site Teardown — Dark Blue, Liquid-Glass, Slim, Trustworthy

Holistic, whole-site analysis of eight sites that most strongly carry the target aesthetic. Each entry covers the dominant color, type, surface, motion, and layout moves, then what to steal and what to avoid. Sibling agents own the isolated principle layers — this document only references those principles as they cohere into a site-level *feeling*.

---

## 1. Linear — https://linear.app

- **Color:** Near-black background (`#08090A`) with a faint cool tilt — not pure black, which kills the OLED-bloom problem; gives a subtle "graphite" warmth. Brand cyan/violet appear *only* on hero gradients and accent dots, never as chrome. Restraint is the move: 90% of the surface is one color.
- **Type:** Inter Display / custom-cut Inter. Tight tracking on display sizes, generous leading on body. Headlines are *quiet but enormous* — confidence through size, not weight.
- **Surface:** Hairline 1px borders at ~8% white opacity replace shadows almost entirely. Cards are flat panels delineated by these borders, not floated by drop-shadow. This is what makes Linear feel "engineered" instead of decorated.
- **Motion:** Scroll-linked reveals at small amplitude (8–16px translate, 200ms). The product mockups have parallax that is *barely there* — you notice it only on reload. No bounce, no spring overshoot.
- **Layout:** Strict 12-col grid, content capped around 1200px, asymmetric section starts to break monotony. Heavy use of left-aligned text blocks paired with right-side product chrome.
- **Steal:** The 1px-border-over-shadow paradigm. The "barely there" parallax. The single restrained accent gradient per hero.
- **Avoid:** Cargo-culting the cyan glow into every component. Linear's cyan works because 95% of the site has no color at all. If you copy the glow without the restraint, you get a Web3 startup.

## 2. Vercel — https://vercel.com

- **Color:** Pure black `#000` background, pure white text, geist-grey scales for everything in between. Conversion-critical CTAs use a single inverted white-on-black or vice-versa — no brand color at all on most pages. This is rare and powerful.
- **Type:** Geist Sans (their own typeface). Extremely tight letter-spacing on display, optical sizing, and a monospace sibling (Geist Mono) deployed in the same surfaces as the sans. Type *is* the brand.
- **Surface:** Geometric "globe" and "deploy" hero visuals use thin-line vector overlays with subtle radial gradients. Cards are nearly invisible until hover. The famous deploy-button glow is a sharp inner-stroke + soft outer bloom, not a generic shadow.
- **Motion:** Pulse animations on infrastructure dots (real-time-activity metaphor). Hover states are tight — 100ms ease-out, no bounce. The cursor frequently triggers a slight surface highlight that *follows the pointer* across cards.
- **Layout:** A signature is the **edge-bleed grid** — section dividers extend to the viewport edge as hairlines, creating an almost CAD-like blueprint feel.
- **Steal:** Monochrome-only chrome with type doing all the brand work. Pointer-tracking surface highlight on cards. Edge-bleed dividers.
- **Avoid:** The pure-black + pure-white extreme — it only works because Geist is a custom typeface tuned for it. With a generic Inter setup, the same palette feels cold and undifferentiated.

## 3. Stripe — https://stripe.com

- **Color:** The signature animated indigo→violet→teal gradient backdrop. Dark mode is bluer than Linear, with a softer purple undertone that reads as "premium financial." Foreground stays neutral.
- **Type:** Sohne Variable. Larger optical sizes get a slight humanist warmth; small sizes get geometric precision. The typeface alone separates Stripe from every competitor.
- **Surface:** Cards float with very soft long shadows (15–30px blur, low alpha) on the dark hero, then transition to flat-with-borders deeper in the page. The **wave-form mesh gradient** is the iconic move — it's a static raster, not a runtime shader, which keeps it crisp on low-end devices.
- **Motion:** The hero gradient is famously *not* animated in CSS — it's a pre-rendered loop. Page-level motion is otherwise nearly absent: Stripe is confident enough to be still.
- **Layout:** Asymmetric, almost editorial — text blocks rarely align to the same column as their adjacent imagery. Generous whitespace at 1.6–2x what most B2B sites use.
- **Steal:** The pre-rendered mesh gradient (cheap, beautiful, doesn't tax the GPU). Editorial asymmetry. The confidence to leave motion out.
- **Avoid:** Trying to do "Stripe gradient" without their type pairing — the gradient alone is now so widely copied it reads as generic SaaS unless paired with a distinctive typeface.

## 4. Anthropic — https://anthropic.com

- **Color:** Warm off-white default with a *book-paper* base, not pure white. Dark mode uses warm graphite, not blue. This is **the opposite** of the dark-blue brief — but instructive: Anthropic earns trust by *rejecting* the techbro palette entirely.
- **Type:** Custom serif (Tiempos-like) for editorial headlines paired with Styrene/sans for UI. The serif is the trust marker.
- **Surface:** Almost no glass, almost no gradient. Soft 16px radii, generous whitespace, occasional textured paper backgrounds.
- **Motion:** Minimal. Page is essentially static.
- **Layout:** Centered single-column hero, long-form editorial below, very book-like.
- **Steal:** The lesson, not the look — *trust comes from restraint*. If your dark-blue site is loud, you can borrow Anthropic's pacing (slow, declarative section headlines, plenty of room to breathe) without copying its palette.
- **Avoid:** Copying directly. A dark-blue site cannot also be book-warm without internal contradiction.

## 5. Arc Browser — https://arc.net

- **Color:** Soft pastel washes (peach, mint, cream) on a near-white base for marketing; the product itself is dark with glassy chrome. The site intentionally contrasts marketing softness with product slickness.
- **Type:** Large serif display headlines ("Arc is the Chrome replacement…") paired with clean sans body. The serif move signals "we are not a typical Chromium fork."
- **Surface:** The product screenshots are pure liquid glass — sidebar with frosted blur, slim rounded bezels (~12px), heavy depth-of-field behind active panels. Marketing surfaces are *flat*; only the product is glass.
- **Motion:** Video loops of the product carry all the motion. Marketing layout itself barely moves.
- **Layout:** Tall vertical rhythm, single-column emphasis, generous spacing between sections.
- **Steal:** Letting **the product mockups carry the glass aesthetic** while keeping marketing chrome simple. This avoids "everything is glass everywhere" overload.
- **Avoid:** Mixing pastel marketing palette with a dark-blue brief — the techniques don't transfer.

## 6. Raycast — https://raycast.com

- **Color:** Deep near-black with a blue cast, plus saturated red-orange brand accent used sparingly. The product UI shots feature frosted-blue glass surfaces that *are* the brief's aesthetic.
- **Type:** SF-style sans, tight tracking, modest size. Type is utilitarian — the screenshots do the selling.
- **Surface:** This is the cleanest commercial example of "liquid-glass with slim bezels." The Raycast command bar has ~10px corner radius, hairline white bezel at low opacity, a soft backdrop blur, and an inner highlight on the top edge that mimics macOS Sonoma's chrome. Vertical-stack layouts of "frame within frame" panels create extreme depth without ever feeling busy.
- **Motion:** Keystroke-driven micro-animations in product demos. Marketing scroll motion is restrained.
- **Layout:** Centered narrow hero, full-bleed video below, then alternating left/right feature cards. Predictable rhythm, very calm.
- **Steal:** The exact glass formula — slim bezel + top-edge highlight + soft inner shadow + 30–40% backdrop-blur. The "frame within frame" recursion as a way to show depth.
- **Avoid:** The signature red-orange accent — it's too specific to Raycast's brand. Use cyan or sky-blue for the same role.

## 7. Cursor — https://cursor.com

- **Color:** Near-black with subtle indigo undertone. Brand uses a soft gradient pill on CTAs (lavender→ice-blue).
- **Type:** Inter again, but the move here is *huge* hero type — display sizes well above 100px — paired with a single-line value prop. Confidence through size.
- **Surface:** Product screenshots with slim 1.5px bezels, mild glass, very pronounced rounded corners (~14px) on the editor chrome. The dark-blue brief lives in Cursor's product screenshots more than any other site here.
- **Motion:** Looping product demos showing AI completion. Marketing motion is light, mainly fade-in on scroll.
- **Layout:** Hero → demo video → trust logos → features → pricing. Standard order executed with unusual confidence in whitespace.
- **Steal:** Massive hero type as primary brand statement. The 1.5px bezel on product chrome.
- **Avoid:** The lavender CTA pill if your palette is strictly blue — purple drift weakens dark-blue commitments.

## 8. Framer (marketing site) — https://framer.com

- **Color:** Dark mode hero with vivid cyan (`#35E2EB` "Holo Shader") and magenta accents. More saturated than the rest of this list.
- **Type:** Bold sans, generous leading, italic editorial accents in mid-page sections.
- **Surface:** Real shader effects (holographic, iridescent) on hero visuals — distinguishes Framer from the pre-rendered-gradient crowd. Cards have soft inner glow + hairline border.
- **Motion:** This is where Framer flexes. Spring-physics on every transition, magnetic hover on buttons, scroll-tied parallax on hero shapes. Effects are tasteful enough to not feel toy-like.
- **Layout:** Sectional with strong full-bleed alternation. Hero often takes 100vh.
- **Steal:** Spring physics on micro-interactions (translates to "magnetic" hover targets). Shader-style holographic accent on a *single* hero element.
- **Avoid:** Animating everything. Framer can do it because the product *is* a motion tool — for a "smart and trustworthy" site, over-animation reads as nervous.

---

## Highest-signal references for this brief

Ranked top 3 of the eight for a dark-blue, liquid-glass, slim, trustworthy target:

1. **Raycast** — Most direct match. The exact glass-bezel formula in product chrome, paired with restrained marketing layout. Single most stealable move: the *slim-bezel + top-edge-highlight + soft inner-shadow + 30–40% backdrop-blur* glass recipe.

2. **Linear** — Best demonstration of how restraint produces "smart and trustworthy." Single most stealable move: replace drop-shadows with 1px hairline borders at ~8% white opacity, and use one restrained accent gradient per hero rather than color on every component.

3. **Vercel** — Best example of letting typography and monochrome chrome do the brand work without resorting to color. Single most stealable move: pointer-tracking surface highlight on cards (cursor-following gradient overlay) — high-perceived-quality, low implementation cost, ages well.

Honorable mention: Stripe's pre-rendered mesh gradient as a static hero asset — cheaper than a shader, more durable than a CSS gradient, and instantly readable as "premium financial." A close fourth pick.

Anti-pattern call-out: Anthropic is in the set as a **counter-reference**. It proves the brief's target can also be achieved by going *the other direction* (warm, editorial, serif). If at any point the dark-blue glass surfaces start to feel cold or generic, lift Anthropic's pacing — slow declarative headlines, long whitespace gaps — into the dark-blue frame to re-introduce warmth.
