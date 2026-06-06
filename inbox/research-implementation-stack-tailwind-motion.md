# Research: Implementation Stack — Tailwind v4 + Motion + shadcn/ui (Agent 9 of 10)

**Aesthetic target**: dark blue, modern, liquid-glass, slick corners with small bezels, slim & feature-rich, smart & trustworthy.
**Scope**: tooling that ships this aesthetic fastest — not the design decisions themselves.

---

## 1. Recommended stack (current versions, May 2026)

| Concern | Package | Version (confirmed via context7 docs) |
|---|---|---|
| Framework | `next` | **15.x** (stable, App Router) |
| Runtime | `react` / `react-dom` | **19.x** |
| CSS engine | `tailwindcss` | **4.x** (CSS-first, `@theme` + `@import "tailwindcss"`) |
| Tailwind PostCSS plugin | `@tailwindcss/postcss` | matches `tailwindcss` v4 |
| Component primitives | `shadcn` CLI + Radix UI | latest — `npx shadcn@latest init` (v4 path) |
| Class utility | `clsx` + `tailwind-merge` | latest — via `lib/utils.ts` `cn()` |
| Variants | `class-variance-authority` (cva) | latest |
| Motion | `motion` (rebranded `framer-motion`) | **12.x** — import from `motion/react` |
| Icons | `lucide-react` | latest — single tree-shakable set |
| Toasts | `sonner` | latest — slot-friendly with shadcn |
| Drawers | `vaul` | latest — Radix-compatible |
| Command palette | `cmdk` | latest — wraps as `<Command />` |
| Theme switch | `next-themes` | latest — `attribute="class"` for `.dark` |
| Fonts | `next/font/google` | built into Next 15 |

Optional polish: `@tailwindcss/typography` for prose blocks, `tw-animate-css` if you want the original tailwindcss-animate utilities (the new shadcn v4 templates ship with it).

---

## 2. Tailwind v4 `@theme` token pattern

Tailwind v4 is **CSS-first**: there is no `tailwind.config.js` by default. Tokens defined in `@theme` are emitted to `:root` as CSS variables *and* automatically generate utility classes (`bg-glass-base`, `text-ink-primary`, `shadow-bezel`, etc.).

```css
/* app/globals.css */
@import "tailwindcss";

/* Selector-based dark mode (paired with next-themes attribute="class") */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Brand surface — dark blue base. OKLCH so colour math stays perceptual. */
  --color-abyss-950: oklch(0.16 0.04 255);   /* page background */
  --color-abyss-900: oklch(0.20 0.05 255);   /* card base */
  --color-abyss-800: oklch(0.25 0.06 255);   /* elevated surface */
  --color-ink-primary: oklch(0.97 0.01 255);
  --color-ink-muted:   oklch(0.74 0.02 255);
  --color-accent:      oklch(0.78 0.16 235); /* trust-blue highlight */

  /* Liquid-glass surface tokens (alpha values consumed via color-mix) */
  --color-glass-base:   color-mix(in oklch, var(--color-abyss-900) 60%, transparent);
  --color-glass-stroke: color-mix(in oklch, white 12%, transparent);

  /* Slick small-bezel radii */
  --radius-bezel-sm: 10px;
  --radius-bezel:    14px;
  --radius-bezel-lg: 20px;

  /* Motion tokens used by both CSS and Motion library */
  --ease-fluid:  cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
  --duration-quick: 180ms;
}

/* Reusable liquid-glass class — small bezel + backdrop blur + faint stroke */
@layer components {
  .glass-panel {
    background: var(--color-glass-base);
    border: 1px solid var(--color-glass-stroke);
    border-radius: var(--radius-bezel);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
  }
}
```

Key v4 rules: `@theme` blocks must be top-level (no nesting); namespaced prefixes (`--color-*`, `--font-*`, `--radius-*`, `--ease-*`, `--breakpoint-*`, `--shadow-*`) auto-generate matching utilities.

---

## 3. shadcn/ui theming pattern for dark mode

shadcn v4 (new-york / `base-nova` style) splits **raw tokens** (`:root` / `.dark`) from **Tailwind utility registration** (`@theme inline`). Always edit `globals.css` — never create a new CSS file; the shadcn skill enforces this.

```css
/* app/globals.css (continued) */
:root {
  --background: var(--color-abyss-950);
  --foreground: var(--color-ink-primary);
  --card: var(--color-glass-base);
  --card-foreground: var(--color-ink-primary);
  --primary: var(--color-accent);
  --primary-foreground: oklch(0.16 0.04 255);
  --border: var(--color-glass-stroke);
  --ring: var(--color-accent);
  --radius: var(--radius-bezel);
}

.dark {
  /* For an always-dark site, .dark mirrors :root.
     For light/dark toggle, override here with lighter abyss tones. */
}

/* Expose shadcn tokens to Tailwind v4 as utilities (bg-background, etc.) */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}
```

`components.json` should use `"baseColor": "neutral"` (or `"zinc"`) and `"cssVariables": true` so the CLI generates components against your tokens, not hard-coded utilities. Bootstrap with `npx shadcn@latest init` then `npx shadcn@latest add button card dialog dropdown-menu input ...`.

---

## 4. Motion stack — Motion (motion.dev) vs View Transitions

`framer-motion` rebranded to **`motion`** in late 2024. Install `motion`, uninstall `framer-motion`, and import from `motion/react`.

```bash
npm uninstall framer-motion
npm install motion
```

```tsx
// app/components/glass-card.tsx
"use client"
import { motion } from "motion/react"

export function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="glass-panel p-6"
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.5, ease: [0.3, 0, 0, 1] }} // matches --ease-fluid
    >
      {children}
    </motion.div>
  )
}
```

Server-only / RSC path: import from `motion/react-client` (`import * as motion from "motion/react-client"`) — same JSX, no `"use client"` boundary, smaller bundle for static blocks.

**When to use which motion layer**:
- **Motion library** — gesture-driven interactions, layout animations (`layoutId`), scroll-linked effects, hover/tap micro-interactions on glass panels.
- **CSS View Transitions API** — page/route transitions, list reordering, *cross-element morph between routes*. Enable in `next.config.ts`:

```ts
import type { NextConfig } from "next"
const nextConfig: NextConfig = { experimental: { viewTransition: true } }
export default nextConfig
```

Then use React's `<ViewTransition>` wrapper (Next 15 ships the integration). Cheaper than Motion for whole-page swaps; Motion stays the choice for granular component animation.

---

## 5. Typography wiring with `next/font`

Variable fonts via `next/font/google` self-host at build time (no layout shift, no third-party request). Bind two CSS variables so Tailwind v4 can pick them up.

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google"

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} dark`}>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
```

```css
/* globals.css — let Tailwind generate font-sans / font-mono utilities */
@theme {
  --font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, monospace;
}
```

(Agent 5 picks the actual typefaces — this wiring works for any pair.)

---

## 6. Common gotchas

- **Tailwind v3 → v4 migration traps**: no more `tailwind.config.js` required; `@tailwind base/components/utilities` directives are replaced by a single `@import "tailwindcss"`. Custom plugins move to CSS via `@plugin` or `@utility`. `darkMode: "class"` is no longer in JS — declare `@custom-variant dark (&:where(.dark, .dark *));` in CSS.
- **`@theme` placement**: must be top-level — putting it inside `@media`, `:root`, or a selector silently breaks utility generation.
- **`@theme` vs `@theme inline`**: bare `@theme` defines tokens *and* expects them to live in the cascade. `@theme inline` references variables you defined elsewhere (the shadcn pattern) and only registers the utility binding.
- **OKLCH everywhere**: v4 ships colours in OKLCH. Stay in OKLCH for new tokens or `color-mix` blending breaks subtly.
- **React 19 + Next 15 RSC**: Motion components require `"use client"`. For static decorative motion, prefer `motion/react-client` to keep the boundary small. Sonner/cmdk/vaul also need client boundaries.
- **`next-themes` hydration**: wrap `<ThemeProvider>` with `suppressHydrationWarning` on `<html>` to avoid the first-paint flash and a hydration mismatch warning.
- **View Transitions**: still flagged `experimental.viewTransition` in Next 15 — gate any reliance behind a feature check; degrade to a plain Motion fade.
- **shadcn CLI on v4**: pass the v4 path (`npx shadcn@latest init` picks it up automatically when `tailwindcss@4` is detected). Older `shadcn-ui` package name is deprecated — use `shadcn`.
- **Backdrop-filter on Safari**: prefix with `-webkit-backdrop-filter` (the `.glass-panel` block above already does this).

---

## 7. Sources

All sources retrieved via context7 MCP (May 2026):
- Tailwind CSS v4 docs — `/tailwindlabs/tailwindcss.com` (`@theme` directive, dark-mode variant, CSS-first config).
- Next.js 15 docs — `/vercel/next.js` (App Router `next/font/google`, `experimental.viewTransition` config).
- Motion for React — `/websites/motion_dev_react` (install, `motion/react` imports, `motion/react-client` optimized import, framer-motion → motion upgrade).
- shadcn/ui — `/shadcn-ui/ui` (`components.json` `cssVariables: true`, `@theme inline` token registration, OKLCH `:root`/`.dark` pattern, `skills/shadcn/customization.md`).
