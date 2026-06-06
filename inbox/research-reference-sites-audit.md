# Reference Sites Audit — Eight Production Sites, Teardown for Transferable Patterns

Research slice for the dark-blue liquid-glass agent platform. Goal: extract what makes Linear, Vercel, Stripe, Arc, Raycast, Anthropic, Cursor, and Zed feel premium and trustworthy, in terms specific enough to reuse without copying.

---

## 1. How to Look at This Correctly (Teardown Rubric)

Surface-copying produces pastiches. Pattern-extraction produces compounding craft. The rubric below is applied to every site in Section 2 so cross-site signal emerges instead of vibes.

**(a) Palette + Elevation System.** Two questions: where does the page sit on the cool/warm and dark/light axes, and does the system distinguish *background* (atmosphere) from *surface* (cards, popovers) from *line* (borders, dividers)? Mature systems separate these — Geist literally numbers them Background 1/2 → Color 1–10. Note token vocabulary, not just hex values.

**(b) Typography Pairing and Rhythm.** Headline face vs body face vs mono face. Weight count (most premium systems use 3-4 weights, not 9). Optical sizing (display variant vs text variant of the same family). Line-height ratio at body size. Negative tracking on display sizes is a tell of editorial intent.

**(c) Chrome (Borders / Radius / Shadows).** What is the *consistent* radius — 4, 8, 12, 16? Is the border a 1px hairline at low opacity, or a brand-colored stroke? Are shadows physical (soft, multi-layer) or schematic (single sharp drop)? Dark-theme systems frequently replace shadow with a 1px top-edge highlight to imply elevation.

**(d) Signature Interactive Elements.** The component that defines the site. For Stripe it's the perspective-skewed product card on the gradient. For Raycast it's the command-palette mock. For Linear it's the AI-agent-in-issue panel. Without this, the homepage is undifferentiated.

**(e) Motion Language.** Three flavors dominate: scroll-driven reveal (Stripe, Linear), continuous ambient motion (Stripe gradient, Vercel particles), and product-replay (Raycast, Cursor, Zed). Premium sites pick one and commit; mid-tier sites do all three poorly. Tempo also signals: agentic platforms move slowly (150-300ms), consumer apps snap (80-120ms).

**(f) Information Density.** Editorial sites use a single 720-840px reading column and large negative space (Anthropic). Developer-tool sites pack a 1280-1440px grid with three-column bentos (Vercel, Raycast). The choice signals audience.

**(g) The One Thing No One Else Does.** Reserved for the genuinely distinctive move. Stripe's WebGL silk gradient is technically expensive; Anthropic's Styrene+Tiempos pairing is editorially expensive; Arc's painted "Space" gradients are emotionally expensive. Pick yours deliberately.

---

## 2. Site-by-Site Teardown

### 2.1 Linear (linear.app)

- **Palette + elevation.** Pure cool-dark. Layered grayscale: Pitch Black `#08090A` background, Graphite `#0F1011` surface, Deep Slate `#161718` raised card, Charcoal `#23252A` hover, Muted Ash `#323334` border-ish. Text descends Porcelain `#F7F8F8` → Light Steel `#D0D6E0` → Storm Cloud `#8A8F98` → Fog Grey `#62666D`. Single brand accent: Aether Blue `#5E6AD2` — a desaturated indigo, almost lavender against the near-black. Neon Lime `#E4F222` shows up sparingly for "AI" / interactive moments.
- **Typography.** Inter Variable for body and UI; Inter Display for headlines. Four custom weights: 300 / 400 / 510 / 590. Size ramp 10 → 72px. Letter-spacing tightens from `-0.1` at small sizes to `-0.22` at display sizes — that's the negative-tracking editorial tell.
- **Chrome.** Subtle, not soft. Radii feel like 6-8px on small components, 10-12px on cards. Borders are 1px at very low white opacity over the near-black surface. Elevation is implied through background-color stepping, not drop shadow. Top-of-card highlight (1px white at ~6-10% opacity) suggests glass.
- **Signature elements.** The triplicate hero ("The product development system for teams and agents" repeated three times for emphasis) and the in-product AI-agent panel showing Codex working a ticket inline. Logo-strip and customer quotes hold dark backgrounds with no boxes.
- **Motion.** Slow, deliberate scroll-triggered reveals. No ambient particles. UI mockups animate at product tempo (~200ms), not marketing tempo.
- **Density.** 1200-ish content max. Triple-bento under hero; calm, not stuffed.
- **One thing nobody else does.** The grayscale ladder — six near-black/dark-gray steps that are clearly distinguishable side-by-side, with a single high-saturation accent. Most dark sites collapse this into two or three flat surfaces.

Sources: [linear.app](https://linear.app), [Linear brand](https://linear.app/brand), [Linear color palette on Mobbin](https://mobbin.com/colors/brand/linear), [Linear UI redesign post](https://linear.app/now/how-we-redesigned-the-linear-ui), [Inter on linear.app via Typ.io](https://typ.io/s/2jmp).

---

### 2.2 Vercel (vercel.com) + Geist

- **Palette + elevation.** Dual-mode but the brand voice is monochrome with geometric accent. Geist names *Background 1* (page) and *Background 2* (subtle differentiation); on top of that, *Color 1* (component default) → *Color 2* (hover) → *Color 3* (active) → *Color 4-6* (border states) → *Color 7-8* (high-contrast surface) → *Color 9-10* (secondary / primary text). Nine accent scales beyond gray: Blue, Red, Amber, Green, Teal, Purple, Pink, plus Gray Alpha. P3-aware on capable displays.
- **Typography.** Geist Sans and Geist Mono — Vercel's own family, intentionally engineered for developer text. Sharp, geometric, low-contrast strokes. Hero set ~48-64px bold, secondary heads 24-32px, body 14-16px.
- **Chrome.** Famously minimal. Marketing surfaces are sharp or near-sharp; system tokens are formalized as *Material* — a single type-driven elevation primitive (`base`, `small`/`medium`/`large`, `tooltip`, `menu`, `modal`, `fullscreen`). Designers pick an elevation role, not radii/fill/shadow individually.
- **Signature elements.** Top-nav "Ask AI" inline search box. The diagonal black "Triangle"/Vercel logo wordmark. Mega-menu dropdowns on hover at desktop.
- **Motion.** Restrained. Some hero canvas particles and crisp hover transitions; product demos use cuts and clean fades.
- **Density.** Dense on the homepage — multi-row product bentos — but the 8-column grid is regular and predictable.
- **One thing nobody else does.** *Material as a single token.* Most systems give you radius, fill, stroke, and shadow as four independent decisions; Geist collapses them into a named role bound to a place in the layered hierarchy. That's how Vercel keeps a giant marketing site visually coherent.

Sources: [vercel.com](https://vercel.com), [Geist intro](https://vercel.com/geist/introduction), [Geist colors](https://vercel.com/geist/colors), [Geist material](https://vercel.com/geist/material), [Geist design system breakdown — SeedFlip](https://seedflip.co/blog/vercel-design-system).

---

### 2.3 Stripe (stripe.com)

- **Palette + elevation.** Light hero canvas with iconic animated multi-color gradient as the atmospheric centerpiece. Underneath the gradient: pure white surfaces with crisp shadows. Reverse-engineered gradient stops cycle through approximately `#6EC3F4` cyan, `#3A3AFF` indigo, `#FF61AB` pink, `#E63946` coral.
- **Typography.** Sohne (with `"Helvetica Neue", Arial, sans-serif` fallback). Sohne 800 weight at hero sizes; this is the closest mass-market visual equivalent of a custom corporate sans.
- **Chrome.** Very subtle radii (~4-6px on small UI, 8-10px on cards). Shadows are crisp and short — single-layer `box-shadow` rather than soft glow. Sections are physically *skewed* via `transform: skewY(-12deg)` on container, creating diagonal color bands.
- **Signature elements.** (1) The "silk gradient" — WebGL-rendered, custom-engine called *minigl*, organic noise drives smooth color flow; viewport-aware (ScrollObserver pauses off-screen). (2) Customer-logo carousel. (3) Bento product cards with precise typographic alignment.
- **Motion.** Continuous ambient gradient. Slow scroll-driven section reveals. Mix-blend-mode `color-burn` on hero text overlay so type "burns into" the moving gradient. This is the canonical "fabric" effect.
- **Density.** Generous breathing room on hero; dense product grid below.
- **One thing nobody else does.** The custom WebGL gradient engine. Everyone copies it, no one matches it — because Stripe shipped a tiny purpose-built shader-driven library where everyone else uses CSS gradients with `@keyframes`.

Sources: [stripe.com](https://stripe.com), [Kevin Hufnagl: How To Create the Stripe Website Gradient Effect](https://kevinhufnagl.com/how-to-stripe-website-gradient-effect/), [Bram.us: Stripe Gradient breakdown](https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect/), [stripe-gradient on GitHub](https://github.com/khasty720/stripe-gradient).

---

### 2.4 Arc (arc.net)

- **Palette + elevation.** Clean, near-white canvas as the default state with strong vibrant accents — opposite vibe to Linear. Brand triad `#3139FB` electric blue, `#FF5060` warm coral-red, `#2702C2` deep violet. Per-Space gradients give each user a personalized two-color theme (from-color → to-color → angle).
- **Typography.** Marlin Soft SQ for display moments paired with Inter for UI and body. Marlin reads as a rounded geometric — chosen to look friendly and confident rather than purely technical.
- **Chrome.** Generous radii on Arc's own product chrome (the sidebar, command bar). The site mirrors this with rounded cards. Shadows are soft and short; the site does not lean on glass.
- **Signature elements.** Hero asset shows Arc's "zero-chrome" browser interface — a screenshot designed to surprise people used to Chrome's address bar. Bottom of page leaned heavily on personality copy ("Arc is the Chrome replacement I've been waiting for").
- **Motion.** Custom illustration and product-replay clips with cinematic timing. Not Stripe-busy, not Linear-quiet — somewhere in between with personality.
- **Density.** Editorial, generous; closer to a magazine than a product page.
- **One thing nobody else does.** Personalization-as-brand: the user-customizable Space gradients literally become part of the product's identity. The site signals "your software, your color." This was The Browser Company's emotional moat. (Arc was sunset May 2025; the design DNA persists.)

Sources: [arc.net](https://arc.net), [Arc brand colors on Loftlyy](https://www.loftlyy.com/en/arc-browser), [Paint with the internet](https://start.arc.net/paint-the-internet), [Arc browser through a designer's lens — Medium](https://medium.com/design-bootcamp/arc-browser-rethinking-the-web-through-a-designers-lens-f3922ef2133e), [Arc_Palette on GitHub](https://github.com/neurokitti/Arc_Palette).

---

### 2.5 Raycast (raycast.com)

- **Palette + elevation.** Cool dark. Background pair: `#070A0B` near-black canvas, `#151515` raised surface. Single high-energy accent: `#FF6363` Bittersweet coral-red. Glass-blue tints behind product mockup sections.
- **Typography.** Inter throughout. Hero around 48px+, section heads 24-32px, body 14-16px, label/meta 12px.
- **Chrome.** Moderate radii (8-12px on cards). Genuinely uses frosted-glass: blurred translucent panels with subtle inner highlight. Layered drop shadows on floating product mockups (`shadow-xl`-scale).
- **Signature elements.** (1) The command-palette mock as hero centerpiece ("Search for apps and commands…"). (2) Keyboard-key motif (`fn`, `⌘`, `⌥`) repeated as visual rhythm. (3) Extension cards in a grid with real third-party icons (Linear, Spotify, Slack). (4) Circular avatars from named makers as social proof.
- **Motion.** Product-replay heavy: the command palette animates as if a user is typing. Slow continuous gradient behind glass.
- **Density.** Dense bento for extensions, generous around the keyboard hero.
- **One thing nobody else does.** *Treats the command palette as the brand asset.* The product's primary interface element is also its primary marketing element. There's no separate hero illustration — the UI is the illustration.

Sources: [raycast.com](https://raycast.com), [Raycast brand colors on Loftlyy](https://www.loftlyy.com/en/raycast), [#ff6363 color reference](https://encycolorpedia.com/ff6363), [Raycast API color reference](https://developers.raycast.com/api-reference/user-interface/colors).

---

### 2.6 Anthropic (anthropic.com) + Claude (claude.ai)

- **Palette + elevation.** Warm light, not dark. Cream canvas `#FAF9F5` ("tinted cream"), deliberately warm where every competitor goes cool. Coral primary `#CC785C` (Crail) used scarcely on buttons but generously on full-bleed callout cards. Dark warm-ink text `#141413`. Dark warm-navy mockup cards `#181715` for code/data. Light cream feature cards `#EFE9DE`.
- **Typography.** Editorial pairing: **Styrene** by Berton Hasebe / Commercial Type for headlines and subheads (geometric, slightly extended, distinctive `f`, `j`, `r`, `t` shapes), **Tiempos** by Klim Type Foundry for body. Tiempos Headline / Copernicus shows up at display sizes with negative tracking. JetBrains Mono in code blocks. On `claude.ai` specifically the body falls back to a `ui-serif, Georgia, Cambria, "Times New Roman"` serif stack.
- **Chrome.** Profoundly flat. Almost no shadow. Very generous radii on hero cards (12-16px). Borders are barely there. The page leans on color-temperature contrast (cream vs near-black) for separation, not elevation.
- **Signature elements.** Headlines treated like book covers, not landing-page banners. Coral callout cards. The chat UI styled "like standard messaging apps" — deliberately ordinary, not techy.
- **Motion.** Minimal. Calm. No ambient gradients. Closer to a New Yorker article than a SaaS site.
- **Density.** Editorial single-column dominance. Generous white (cream) space.
- **One thing nobody else does.** The Styrene + Tiempos + cream + coral combination is genuinely without peer in the AI category — every competitor is some shade of cool-gray sans-serif. Anthropic *spends design budget on editorial typography* and that single decision moves them out of the "AI startup" visual bucket into the "thoughtful research lab" bucket.

Sources: [anthropic.com](https://anthropic.com), [Styrene in use — type.today](https://type.today/en/journal/anthropic), [Anthropic brand colors on Loftlyy](https://www.loftlyy.com/en/anthropic), [Claude design system breakdown — MindStudio](https://www.mindstudio.ai/blog/claude-design-avoid-ai-slop-design-system), [My Styrene Soul — Dear Designer](https://deardesigner.substack.com/p/my-styrene-soul-a-short-affair-with).

---

### 2.7 Cursor (cursor.com)

- **Palette + elevation.** Near-black background (`#0A0A0A`-ish). Subtle cyan/blue and purple gradient accents around the editor mockup rather than bold full-screen color. Editor mockups themselves are the brightest element on the page.
- **Typography.** Custom typeface system built by Kimera with "logo ligatures" — the Cursor wordmark is *encoded as a font glyph* so logos and lockups align perfectly with body text. This is unusual and high-effort.
- **Chrome.** Moderate radii (~8-12px) on cards and editor surrounds. Subtle, layered drop shadows imply the editor floats above the page. No frosted glass — the dark surface is opaque.
- **Signature elements.** The hero is the editor itself — *live, in CSS, not a screenshot.* They built mini-versions of the IDE in CSS using Cursor during development. Desktop-environment wallpapers sit behind the live editor mocks.
- **Motion.** Product-replay: agents complete tasks, code appears, mock cursor moves. Tempo is product-tempo (slower than marketing) because they want viewers to actually *read* the code.
- **Density.** Centered on the editor; surrounding sections are quieter.
- **One thing nobody else does.** *The editor mockup is real DOM, not an image.* This is the most aggressive "show, don't tell" stance among code-tool sites — you can inspect the marketing hero and read live code.

Sources: [cursor.com](https://cursor.com), [Cursor themes docs](https://cursor.com/docs/configuration/themes), [How Kimera built Cursor's identity — The Brand Identity](https://the-brandidentity.com/project/how-kimera-built-cursors-identity-around-a-custom-typeface-system).

---

### 2.8 Zed (zed.dev)

- **Palette + elevation.** Dark theme with deep charcoal/black backgrounds and white text. Muted grays for secondary text and dividers. Primary action color is a clean blue (download buttons). Less brand-saturated than Cursor — the visual brand *is* speed, not color.
- **Typography.** Default UI is IBM Plex Sans plus a bundled Iosevka-derived `.ZedSans`. Default editor buffer font historically Lilex / Zed Mono; Berkeley Mono is a popular swap among power users. The product family `zed-fonts` is publicly maintained on GitHub — open-source down to the typeface.
- **Chrome.** Tailwind-flavored: `rounded-lg` (~8px) and `rounded` (~4px) classes visible. `shadow-xl` on floating components. Standard but well-applied — Zed leans on craft of content rather than chrome novelty.
- **Signature elements.** Hero copy "Your last next editor." Inline scheduler component (`scheduler.tsx` visible). Embedded video demos of debugger, agentic editing, Git integration. Prominent "Clone source" link to GitHub.
- **Motion.** Mostly product-replay video clips. Minimal ambient motion.
- **Density.** Documentation-adjacent: dense feature lists, code blocks, GitHub-style social proof.
- **One thing nobody else does.** *Performance as visual identity.* "Written from scratch in Rust," "leverage multiple CPU cores," testimonial "my god it is so fast." Combined with the open-source GitHub link, the site signals craft through proof of substance rather than visual ornament. Open-sourcing the typefaces themselves is the move no one else makes.

Sources: [zed.dev](https://zed.dev), [zed-fonts on GitHub](https://github.com/zed-industries/zed-fonts), [Zed visual customization docs](https://zed.dev/docs/visual-customization), [Zed appearance docs](https://zed.dev/docs/appearance).

---

## 3. Cross-Site Patterns

**Pattern A — Layered grayscale beats flat dark.** Premium dark sites (Linear, Raycast, Cursor, Zed) use 3-6 distinguishable near-black shades, not one. Linear's ladder of six steps from Pitch Black to Muted Ash is the most disciplined version. Flat `#000` on `#111` reads as cheap by comparison.

**Pattern B — One saturated accent, used sparingly.** Linear-Aether-Blue, Raycast-coral-red, Anthropic-Crail-coral, Stripe-multi-gradient (single ribbon, single moment). Premium sites do not use 5 accent colors at hero. The accent appears at maybe 2-4% of pixels but carries the brand recall.

**Pattern C — Custom or near-custom typography is mandatory at this tier.** Vercel→Geist, Linear→Inter Display (essentially custom-tuned), Stripe→Sohne, Anthropic→Styrene+Tiempos, Cursor→Kimera custom, Zed→open-source Iosevka derivative. *Inter alone is the floor*, not the ceiling. Investing in a display face is the single highest-leverage move.

**Pattern D — Negative letter-spacing on display sizes.** Linear: `-0.22` at display. Anthropic: Tiempos Headline with negative tracking. Vercel: Geist hero compressed. This single CSS property (`letter-spacing: -0.02em` to `-0.04em`) carries enormous editorial signal.

**Pattern E — Elevation by background-step, not by shadow.** Dark sites mostly replace `box-shadow` with stacked grayscale layers and a 1px top-edge highlight. Light sites (Stripe) keep crisp shadows. Mixing the two reads as amateur.

**Pattern F — The signature interactive element is the product UI itself.** Raycast = command palette. Cursor = live CSS editor. Linear = agent-in-issue panel. Stripe = checkout/dashboard mocks. Zed = video of the editor. Premium sites do not draw "abstract illustration" — they show real UI elevated by craft of staging.

**Pattern G — Two distinct visual schools exist; pick one.**
- **Cool-dark, single-accent, technical editorial** — Linear, Raycast, Cursor, Zed, dark Vercel. Reads as: precision, speed, developer focus.
- **Warm-light, editorial typography, calm** — Anthropic, light Stripe, Arc. Reads as: trust, thoughtfulness, humanism.

For a *dark-blue liquid-glass agent platform*, school 1 is the home base, but borrowing the editorial typography discipline of school 2 (Styrene-grade display face, negative-tracked headlines) is what separates a generic dark SaaS site from something that feels like it was made by adults.

**Pattern H — Motion as character signature.** Stripe's gradient = continuous ambient. Linear / Cursor / Raycast = product-replay. Anthropic = nearly still. Pick one tempo and commit. Mixing all three is what generic AI sites do.

---

## 4. Cross-References to Sibling Research

- **A1 (Trust psychology).** Linear, Anthropic, and Stripe are the strongest trust archetypes here — cite Linear for "calm dark technical trust," Anthropic for "warm editorial research trust," Stripe for "financial-infrastructure trust through restraint." Specific moves listed in Section 2 are the *evidence*; A1 owns the *why this works*.
- **A2 (Palette).** Concrete hex values cited per site in Section 2 (Linear ladder `#08090A`→`#62666D`+`#5E6AD2`; Anthropic `#FAF9F5`+`#CC785C`+`#141413`; Raycast `#070A0B`+`#FF6363`; Arc `#3139FB`+`#FF5060`+`#2702C2`; Stripe gradient `#6EC3F4`/`#3A3AFF`/`#FF61AB`/`#E63946`). A2 synthesizes into the platform's own dark-blue palette.
- **A3 (Glass technique).** Raycast and Linear are the best concrete examples of dark-theme glass — Raycast's frosted blue panels, Linear's 1px top-edge highlight as glass tell. Stripe's WebGL gradient is liquid-but-not-glass — cited separately under "ambient surface."
- **A4 (Borders / corners).** Radii observations per site: Vercel sharp / 4-6px; Linear / Raycast / Cursor 8-12px; Anthropic 12-16px. A4 generalizes the radius-as-tone signal.
- **A6 / A7 (embedded terminals / agents).** Linear's in-issue agent panel and Cursor's live-DOM editor mock are the strongest reference points — pass forward.

---

## 5. Sources

1. [linear.app](https://linear.app)
2. [Linear brand](https://linear.app/brand)
3. [Linear color palette — Mobbin](https://mobbin.com/colors/brand/linear)
4. [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
5. [Inter on linear.app — Typ.io](https://typ.io/s/2jmp)
6. [vercel.com](https://vercel.com)
7. [Geist Introduction](https://vercel.com/geist/introduction)
8. [Geist Colors](https://vercel.com/geist/colors)
9. [Geist Material](https://vercel.com/geist/material)
10. [Vercel Design System Breakdown — SeedFlip](https://seedflip.co/blog/vercel-design-system)
11. [stripe.com](https://stripe.com)
12. [How To Create the Stripe Website Gradient Effect — Kevin Hufnagl](https://kevinhufnagl.com/how-to-stripe-website-gradient-effect/)
13. [Stripe Gradient breakdown — Bram.us](https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect/)
14. [stripe-gradient on GitHub](https://github.com/khasty720/stripe-gradient)
15. [arc.net](https://arc.net)
16. [Arc brand colors — Loftlyy](https://www.loftlyy.com/en/arc-browser)
17. [Paint with the internet](https://start.arc.net/paint-the-internet)
18. [Arc browser through a designer's lens — Medium](https://medium.com/design-bootcamp/arc-browser-rethinking-the-web-through-a-designers-lens-f3922ef2133e)
19. [raycast.com](https://raycast.com)
20. [Raycast brand colors — Loftlyy](https://www.loftlyy.com/en/raycast)
21. [Raycast API colors](https://developers.raycast.com/api-reference/user-interface/colors)
22. [anthropic.com](https://anthropic.com)
23. [claude.ai](https://claude.ai)
24. [Styrene in use — type.today](https://type.today/en/journal/anthropic)
25. [Anthropic brand colors — Loftlyy](https://www.loftlyy.com/en/anthropic)
26. [Claude design system breakdown — MindStudio](https://www.mindstudio.ai/blog/claude-design-avoid-ai-slop-design-system)
27. [My Styrene Soul — Dear Designer](https://deardesigner.substack.com/p/my-styrene-soul-a-short-affair-with)
28. [cursor.com](https://cursor.com)
29. [Cursor themes docs](https://cursor.com/docs/configuration/themes)
30. [How Kimera built Cursor's identity — The Brand Identity](https://the-brandidentity.com/project/how-kimera-built-cursors-identity-around-a-custom-typeface-system)
31. [zed.dev](https://zed.dev)
32. [zed-fonts on GitHub](https://github.com/zed-industries/zed-fonts)
33. [Zed visual customization docs](https://zed.dev/docs/visual-customization)
34. [Zed appearance docs](https://zed.dev/docs/appearance)
