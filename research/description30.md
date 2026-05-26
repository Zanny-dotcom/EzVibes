# Dark Themes and Color Schemes for Dev Tools (2025-2026)

## Comprehensive Research for the EZvibes Vault Feature

This document collects the canonical color palettes, design tokens, and theming patterns currently dominating dev tooling. Every section is structured so colors can be lifted directly into the EZvibes - dropped into `renderer/styles.css` as CSS variables, fed into xterm.js `theme: {}` blocks, or used to skin markdown previews inside the new vault panel.

---

## Table of Contents

1. The "Modern Dim" Movement and 2026 Trends
2. Tokyo Night (Night, Storm, Moon, Day)
3. Catppuccin (Mocha, Macchiato, Frappe, Latte)
4. Rose Pine (Main, Moon, Dawn)
5. Nord
6. Dracula and Dracula Pro
7. Atom One Dark and One Dark Pro
8. Monokai Pro (Classic, Pro, Octagon, Machine, Ristretto, Spectrum)
9. GitHub (Dark, Dark Dimmed, Light, High Contrast)
10. Solarized Dark, Solarized Light, Solarized Osaka
11. Night Owl
12. Cobalt2
13. Kanagawa (Wave, Dragon, Lotus)
14. Everforest
15. Gruvbox and Gruvbox Material
16. Ayu (Dark, Mirage, Light)
17. Vitesse (Dark and Light by Antfu)
18. Vesper (Rauno Freiberg)
19. Poimandres (pmndrs)
20. Andromeda
21. Synthwave 84 and Cyberpunk Variants
22. Tailwind v3/v4 Neutral Families (Zinc, Slate, Stone, Gray, Neutral)
23. shadcn/ui Theming Patterns
24. Vercel Geist
25. OKLCH and Modern Color Spaces
26. xterm.js Theme Object Reference
27. Suggested Themes for the Vault Panel
28. Sources

---

## 1. The "Modern Dim" Movement and 2026 Trends

A central design shift in 2025-2026 is the rejection of pure `#000000` backgrounds. Designers have realized that a screen showing pure black surrounded by even slightly off-black surfaces produces visible "halos" on OLED panels and harsh contrast on LCDs. The 2026 standard is what designers now call "tinted neutrals" - a near-black with a slight hue (usually a cool blue cast or a warm brown cast) and surfaces stepped up in luminance rather than shadow.

### Key trend values, distilled

| Token | Hex | Note |
|---|---|---|
| The "new black" | `#09090B` | Zinc-tinted near-black, replaces `#000000` |
| The "new white" | `#FAFAFA` | Soft warm white, replaces `#FFFFFF` |
| Card background | `#18181B` | Zinc-800 of Tailwind v3 |
| Elevated panel | `#27272A` | Zinc-700 |
| Border | `#3F3F46` | Zinc-600 |
| Subtle text | `#A1A1AA` | Zinc-400 |
| Strong text | `#FAFAFA` | Zinc-50 |

This is the same palette shadcn/ui uses by default and what Vercel, Linear, Resend, Cal.com, and most "AI-style" 2026 apps use.

### Surface elevation by luminance, not shadow

In 2026 most dark UIs avoid drop shadows on dark backgrounds (they tend to look muddy). Instead, a small step in luminance signals depth:

```
Background:  oklch(14% 0.005 285)   ~  #09090B
Surface 1:   oklch(20% 0.008 285)   ~  #18181B   (cards)
Surface 2:   oklch(28% 0.010 285)   ~  #27272A   (popovers, elevated panels)
Surface 3:   oklch(35% 0.012 285)   ~  #3F3F46   (borders, dividers)
Surface 4:   oklch(42% 0.014 285)   ~  #52525B   (button hover)
```

For the vault panel specifically, this means: dark `Background`, slightly lighter `Surface 1` for the panel container, `Surface 2` for each .md row tile, `Surface 3` for the row's hover state, and an accent `Highlight` only on the active/selected file row.

### Dark Glassmorphism (carefully)

The current trend is to layer translucent panels above the main UI but only sparingly - tooltip/popover only, not the whole vault. Ambient color "orbs" (very low-saturation glow gradients) behind the panel help defeat the "muddy dark panel" problem. Recipe:

```css
.vault-panel {
  background: rgba(24, 24, 27, 0.72);          /* zinc-800 @ 72% */
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 20px 60px -20px rgba(0, 0, 0, 0.6);
}
```

---

## 2. Tokyo Night

Three official variants - Night (default), Storm, and Light - plus a fourth (Moon) shipped by the Neovim port. The cleanest, most universally used dark theme in 2025-2026; Tokyo Night has over 8 million VS Code marketplace installs.

### Tokyo Night (Night - default)

```js
const tokyoNight = {
  // Core UI
  background:    "#1a1b26",
  foreground:    "#a9b1d6",
  sidebar:       "#16161e",
  activityBar:   "#16161e",
  statusBar:     "#16161e",
  panel:         "#16161e",
  border:        "#101014",
  selection:     "#515c7e4d",
  focusBorder:   "#545c7e33",
  input:         "#14141b",
  buttonBg:      "#3d59a1dd",
  hoverBg:       "#20222c",
  lineNumber:    "#363b54",
  cursor:        "#c0caf5",

  // Syntax
  comment:       "#51597d",
  string:        "#9ece6a",
  number:        "#ff9e64",
  keyword:       "#bb9af7",
  function:      "#7aa2f7",
  variable:      "#c0caf5",
  parameter:     "#e0af68",
  storageType:   "#bb9af7",
  class:         "#0db9d7",
  tag:           "#f7768e",
  property:      "#73daca",
  operator:      "#89ddff",
  importExport:  "#7dcfff",

  // ANSI (terminal)
  red:           "#f7768e",
  green:         "#73daca",
  yellow:        "#e0af68",
  blue:          "#7aa2f7",
  magenta:       "#bb9af7",
  cyan:          "#7dcfff",

  // Diagnostics
  error:         "#db4b4b",
  warning:       "#e0af68",
  info:          "#0da0ba",
  hint:          "#0da0ba",
};
```

### Tokyo Night Storm

Identical syntax palette; the entire base gets shifted to slightly bluer, more saturated dark.

```
background:    #24283b
sidebar:       #1f2335
selection:     #283457
comment:       #565f89
text:          #c0caf5
```

### Tokyo Night Light (the official light variant)

```
background:    #d5d6db
foreground:    #343b58
sidebar:       #cbccd1
selection:     #b7c1e3
comment:       #9699a3
keyword:       #5a4a78
string:        #485e30
function:      #34548a
red:           #8c4351
green:         #485e30
yellow:        #8f5e15
blue:          #34548a
magenta:       #5a4a78
cyan:          #0f4b6e
```

### Tokyo Night Moon (Neovim port)

```
background:    #222436
sidebar:       #1e2030
text:          #c8d3f5
selection:     #2d3f76
comment:       #636da6
red:           #ff757f
green:         #c3e88d
yellow:        #ffc777
blue:          #82aaff
magenta:       #c099ff
cyan:          #86e1fc
```

### Full xterm.js theme block (Tokyo Night)

```js
{
  background:        "#1a1b26",
  foreground:        "#c0caf5",
  cursor:            "#c0caf5",
  cursorAccent:      "#1a1b26",
  selectionBackground: "#283457",
  black:         "#15161e",
  red:           "#f7768e",
  green:         "#9ece6a",
  yellow:        "#e0af68",
  blue:          "#7aa2f7",
  magenta:       "#bb9af7",
  cyan:          "#7dcfff",
  white:         "#a9b1d6",
  brightBlack:   "#414868",
  brightRed:     "#f7768e",
  brightGreen:   "#9ece6a",
  brightYellow:  "#e0af68",
  brightBlue:    "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan:    "#7dcfff",
  brightWhite:   "#c0caf5",
}
```

---

## 3. Catppuccin

26 colors x 4 flavors. The most aggressively-themed library in 2025-2026, with first-party ports for over 200 apps. Each color has a fixed semantic role so themes are inter-convertible.

### Mocha (darkest, default)

```
// Surfaces
crust:      #11111b   // outermost
mantle:     #181825   // sidebar / window chrome
base:       #1e1e2e   // editor background
surface0:   #313244   // raised
surface1:   #45475a
surface2:   #585b70

// Overlays
overlay0:   #6c7086
overlay1:   #7f849c
overlay2:   #9399b2

// Text
subtext0:   #a6adc8
subtext1:   #bac2de
text:       #cdd6f4

// Accents (24 ANSI-ish slots)
rosewater:  #f5e0dc
flamingo:   #f2cdcd
pink:       #f5c2e7
mauve:      #cba6f7
red:        #f38ba8
maroon:     #eba0ac
peach:      #fab387
yellow:     #f9e2af
green:      #a6e3a1
teal:       #94e2d5
sky:        #89dceb
sapphire:   #74c7ec
blue:       #89b4fa
lavender:   #b4befe
```

### Macchiato

```
crust:      #181926
mantle:     #1e2030
base:       #24273a
surface0:   #363a4f
surface1:   #494d64
surface2:   #5b6078
overlay0:   #6e738d
overlay1:   #8087a2
overlay2:   #939ab7
subtext0:   #a5adcb
subtext1:   #b8c0e0
text:       #cad3f5
rosewater:  #f4dbd6
flamingo:   #f0c6c6
pink:       #f5bde6
mauve:      #c6a0f6
red:        #ed8796
maroon:     #ee99a0
peach:      #f5a97f
yellow:     #eed49f
green:      #a6da95
teal:       #8bd5ca
sky:        #91d7e3
sapphire:   #7dc4e4
blue:       #8aadf4
lavender:   #b7bdf8
```

### Frappe

```
crust:      #232634
mantle:     #292c3c
base:       #303446
surface0:   #414559
surface1:   #51576d
surface2:   #626880
overlay0:   #737994
overlay1:   #838ba7
overlay2:   #949cbb
subtext0:   #a5adce
subtext1:   #b5bfe2
text:       #c6d0f5
rosewater:  #f2d5cf
flamingo:   #eebebe
pink:       #f4b8e4
mauve:      #ca9ee6
red:        #e78284
maroon:     #ea999c
peach:      #ef9f76
yellow:     #e5c890
green:      #a6d189
teal:       #81c8be
sky:        #99d1db
sapphire:   #85c1dc
blue:       #8caaee
lavender:   #babbf1
```

### Latte (the light variant)

```
crust:      #dce0e8
mantle:     #e6e9ef
base:       #eff1f5
surface0:   #ccd0da
surface1:   #bcc0cc
surface2:   #acb0be
overlay0:   #9ca0b0
overlay1:   #8c8fa1
overlay2:   #7c7f93
subtext0:   #6c6f85
subtext1:   #5c5f77
text:       #4c4f69
rosewater:  #dc8a78
flamingo:   #dd7878
pink:       #ea76cb
mauve:      #8839ef
red:        #d20f39
maroon:     #e64553
peach:      #fe640b
yellow:     #df8e1d
green:      #40a02b
teal:       #179299
sky:        #04a5e5
sapphire:   #209fb5
blue:       #1e66f5
lavender:   #7287fd
```

### Catppuccin Mocha xterm.js block

```js
{
  background:        "#1e1e2e",   // base
  foreground:        "#cdd6f4",   // text
  cursor:            "#f5e0dc",   // rosewater
  cursorAccent:      "#1e1e2e",
  selectionBackground: "#585b70", // surface2
  black:         "#45475a",
  red:           "#f38ba8",
  green:         "#a6e3a1",
  yellow:        "#f9e2af",
  blue:          "#89b4fa",
  magenta:       "#f5c2e7",
  cyan:          "#94e2d5",
  white:         "#bac2de",
  brightBlack:   "#585b70",
  brightRed:     "#f38ba8",
  brightGreen:   "#a6e3a1",
  brightYellow:  "#f9e2af",
  brightBlue:    "#89b4fa",
  brightMagenta: "#f5c2e7",
  brightCyan:    "#94e2d5",
  brightWhite:   "#a6adc8",
}
```

---

## 4. Rose Pine

Soho-vibes pastel theme; three flavors (main, moon, dawn). Especially popular in Neovim and minimal-dev circles in 2026 (used by ThePrimeagen / TJ DeVries content).

### Rose Pine (main - default dark)

```
base:            #191724
surface:         #1f1d2e
overlay:         #26233a
muted:           #6e6a86
subtle:          #908caa
text:            #e0def4
love:            #eb6f92    // red/error
gold:            #f6c177    // yellow/warning
rose:            #ebbcba    // soft pink
pine:            #31748f    // teal/blue accent
foam:            #9ccfd8    // soft cyan
iris:            #c4a7e7    // lavender
highlightLow:    #21202e
highlightMed:    #403d52
highlightHigh:   #524f67
```

### Rose Pine Moon (darker, more saturated)

```
base:            #232136
surface:         #2a273f
overlay:         #393552
muted:           #6e6a86
subtle:          #908caa
text:            #e0def4
love:            #eb6f92
gold:            #f6c177
rose:            #ea9a97
pine:            #3e8fb0
foam:            #9ccfd8
iris:            #c4a7e7
highlightLow:    #2a283e
highlightMed:    #44415a
highlightHigh:   #56526e
```

### Rose Pine Dawn (light)

```
base:            #faf4ed
surface:         #fffaf3
overlay:         #f2e9e1
muted:           #9893a5
subtle:          #797593
text:            #575279
love:            #b4637a
gold:            #ea9d34
rose:            #d7827e
pine:            #286983
foam:            #56949f
iris:            #907aa9
highlightLow:    #f4ede8
highlightMed:    #dfdad9
highlightHigh:   #cecacd
```

### Why Rose Pine works well for a vault panel

The `overlay` and `surface` tones are barely different in luminance but distinct enough to read as separate panels - exactly the look the user's Paint mockup is going for. `iris` (#c4a7e7) and `gold` (#f6c177) read as a "magical artifact" pair on the dark base.

---

## 5. Nord

Arctic-bluish dark theme. Less popular in 2026 (some critique it as low-contrast) but still the canonical reference for "calm" dark palettes.

```
// Polar Night (bg)
nord0:   #2e3440   // background
nord1:   #3b4252   // brighter
nord2:   #434c5e   // selection
nord3:   #4c566a   // comments

// Snow Storm (fg)
nord4:   #d8dee9   // text
nord5:   #e5e9f0
nord6:   #eceff4

// Frost (cool accents)
nord7:   #8fbcbb   // types
nord8:   #88c0d0   // accent (brightest cyan)
nord9:   #81a1c1   // muted blue
nord10:  #5e81ac   // deep blue, links

// Aurora (warm accents)
nord11:  #bf616a   // red / error
nord12:  #d08770   // orange / decorators
nord13:  #ebcb8b   // yellow / warnings
nord14:  #a3be8c   // green / strings, success
nord15:  #b48ead   // purple / numbers
```

---

## 6. Dracula and Dracula Pro

Classic high-saturation theme. Background is dark blue-purple, not pure dark.

### Dracula (classic, free)

```
background:    #282A36
currentLine:   #44475A
selection:     #44475A
foreground:    #F8F8F2
comment:       #6272A4
red:           #FF5555
orange:        #FFB86C
yellow:        #F1FA8C
green:         #50FA7B
cyan:          #8BE9FD
purple:        #BD93F9
pink:          #FF79C6
```

### Dracula Pro

Same hues, "normalized" lightness and slightly softer purples (paid; sold by Zeno Rocha). The "Van Helsing" variant uses `#22212C` background. The "Lilac" variant uses `#1C1B23`.

### Alucard (Dracula Light)

```
background:    #FFFBEB
currentLine:   #6C664B
selection:     #CFCFDE
foreground:    #1F1F1F
comment:       #6C664B
red:           #CB3A2A
orange:        #A34D14
yellow:        #846E15
green:         #14710A
cyan:          #036A96
purple:        #644AC9
pink:          #A3144D
```

---

## 7. Atom One Dark and One Dark Pro

The originator of "modern dark UI." Still ships as the default look-and-feel in many tools that fork from old Atom (including most "IDE-style" Electron apps from 2018-2022).

### Atom One Dark (canonical)

```
background:    #282c34
foreground:    #abb2bf
gutterGrey:    #4b5263
commentGrey:   #5c6370
lightRed:      #e06c75
darkRed:       #be5046
green:         #98c379
lightYellow:   #e5c07b
darkYellow:    #d19a66
blue:          #61afef
magenta:       #c678dd
cyan:          #56b6c2
accent:        #528bff
sidebarBg:     #21252b
occurrence:    #434957
```

### One Dark Pro (Binaryify port, the #1 VS Code dark theme by installs)

Same hues, slightly tweaked saturation. Adds these UI colors:

```
button:        #4d78cc
focusBorder:   #528bff
sidebar:       #21252b
statusBar:     #21252b
panel:         #1d1f23
border:        #181a1f
```

---

## 8. Monokai Pro

Six "filters" - same syntax mapping, different base palettes. The Filter Octagon (default in recent versions) is the most loved.

### Filter Octagon

```
dark:       #19181a
black:      #221f22
text:       #fcfcfa

red:        #ff6188     // accent1
orange:     #fc9867     // accent2
yellow:     #ffd866     // accent3
green:      #a9dc76     // accent4
cyan:       #78dce8     // accent5
purple:     #ab9df2     // accent6

dimmed1:    #c1c0c0
dimmed2:    #939293
dimmed3:    #727072
dimmed4:    #5b595c
dimmed5:    #403e41
```

### Other filters (background only, the rest scales the same)

```
Pro:        bg #2D2A2E    black #221F22
Classic:    bg #272822    black #1E1F1C
Machine:    bg #273136    black #1D2528
Octagon:    bg #282A3A    black #1F2030
Ristretto:  bg #2C2525    black #211C1B
Spectrum:   bg #222222    black #131313
```

---

## 9. GitHub (Primer)

GitHub's Primer design system ships four "official" syntax themes: Light, Dark, Dark Dimmed, Dark High Contrast, plus colorblind variants for each.

### GitHub Dark Dimmed (the favorite of "I'm tired of pure black" people)

```
background:    #22272e
foreground:    #adbac7
sidebar:       #2d333b
selection:     #1c6cbb40
comment:       #768390
keyword:       #f47067
string:        #96d0ff
function:      #dcbdfb
class:         #f69d50
constant:      #6cb6ff
added:         #8ddb8c
deleted:       #ff938a
border:        #444c56
panel:         #2d333b
```

### GitHub Dark (default)

```
background:    #0d1117
foreground:    #c9d1d9
sidebar:       #161b22
border:        #30363d
red:           #ff7b72
orange:        #ffa657
yellow:        #d29922
green:         #7ee787
blue:          #79c0ff
purple:        #d2a8ff
pink:          #ff9eed
```

### GitHub Light

```
background:    #ffffff
foreground:    #24292f
sidebar:       #f6f8fa
border:        #d0d7de
red:           #cf222e
orange:        #fb8500
yellow:        #9a6700
green:         #1a7f37
blue:          #0969da
purple:        #8250df
pink:          #bf3989
```

---

## 10. Solarized

The most studied palette ever (CIELAB-balanced). 16 colors total - 8 monotones + 8 accents.

### Solarized (works for both Dark and Light)

```
base03:        #002b36   // dark bg (Solarized Dark uses this)
base02:        #073642   // bg highlights
base01:        #586e75   // optional content tones
base00:        #657b83   // emphasized content (dark)
base0:         #839496   // body text (dark)
base1:         #93a1a1   // comments / secondary
base2:         #eee8d5   // bg highlights (light)
base3:         #fdf6e3   // light bg (Solarized Light uses this)

yellow:        #b58900
orange:        #cb4b16
red:           #dc322f
magenta:       #d33682
violet:        #6c71c4
blue:          #268bd2
cyan:          #2aa198
green:         #859900
```

### Solarized Osaka (craftzdog's modern remix, very popular in 2026)

Replaces base03 with a darker, more saturated cyan-tinted background:

```
background:    #00141a
foreground:    #839495
bgHighlight:   #002d38
black:         #00141a
red:           #dc312e
green:         #859900
yellow:        #b38600
blue:          #278bd3
magenta:       #d33682
cyan:          #2aa298
white:         #ede7d4
brightRed:     #f65351
brightGreen:   #b7fa00
brightYellow:  #ffbf00
brightBlue:    #47adf5
brightMagenta: #f254a1
brightCyan:    #2beede
brightWhite:   #fdf6e2
```

---

## 11. Night Owl (by Sarah Drasner)

The "designed for nighttime use" theme - intentionally dimmer than most. Deep navy base, soft pastel accents.

```
background:    #011627
foreground:    #d6deeb
selection:     #4373c2
border:        #122d42
lineNumber:    #4b6479
activeLine:    #C5E4FD
cursor:        #80a4c2

comment:       #637777
string:        #ecc48d
number:        #F78C6C
keyword:       #c792ea
constant:      #82AAFF
variable:      #c5e478
function:      #82AAFF
class:         #ffcb8b
tag:           #caece6
attribute:     #c5e478
operator:      #7fdbca

// Terminal
red:           #EF5350
green:         #22da6e
yellow:        #c5e478
blue:          #82AAFF
cyan:          #21c7a8
magenta:       #C792EA

modified:      #a2bffc
added:         #9CCC65
deleted:       #EF5350
searchMatch:   #5f7e9779
wordHighlight: #f6bbe533
```

### Light Owl (light variant)

```
background:    #FBFBFB
foreground:    #403f53
selection:     #E0E0E0
comment:       #989FB1
string:        #c96765
keyword:       #994cc3
function:      #4876d6
```

---

## 12. Cobalt2 (Wes Bos)

Hot yellow on deep blue. Distinctive, "developer brand" theme. Use as accent inspiration, not a primary vault palette.

```
background:    #193549
darkerBg:      #15232D
dustyBlue:     #35434d
yellow:        #ffc600    // primary accent
orange:        #ff9d00
red:           #ff2c70
green:         #3ad900
blue:          #9effff
pink:          #ff5ed4
white:         #ffffff
```

---

## 13. Kanagawa

Inspired by Hokusai's Great Wave painting. Earthy, japanese-aesthetic palette. The 2024-2026 favorite of "Japanese coffee shop" coder aesthetic.

### Kanagawa Wave (default dark)

```
sumiInk0:      #16161D    // darkest bg
sumiInk1:      #1F1F28    // default bg
sumiInk2:      #2A2A37    // lighter
sumiInk3:      #363646    // popups
sumiInk4:      #54546D    // borders / dark fg

fujiWhite:     #DCD7BA    // default fg
oldWhite:      #C8C093    // dark fg
springViolet1: #938AA9    // light fg
springViolet2: #9CABCA    // brackets

waveAqua1:     #6A9589    // info
waveAqua2:     #7AA89F    // types
crystalBlue:   #7E9CD8    // functions
springGreen:   #98BB6C    // strings
autumnGreen:   #76946A    // git add
autumnYellow:  #DCA561    // attributes
boatYellow1:   #938056    // boolean operators
boatYellow2:   #C0A36E    // string regex
carpYellow:    #E6C384    // namespaces, constants

samuraiRed:    #E82424    // error
roninYellow:   #FF9E3B    // warning
peachRed:      #FF5D62    // standout
surimiOrange:  #FFA066    // constants/booleans
sakuraPink:    #D27E99    // numbers
waveRed:       #E46876    // statements
oniViolet:     #957FB8    // keywords
autumnRed:     #C34043    // git delete
```

### Kanagawa Dragon (darker, more saturated)

```
dragonBlack0:  #0d0c0c
dragonBlack1:  #12120f
dragonBlack2:  #1D1C19
dragonBlack3:  #181616
dragonBlack4:  #282727
dragonBlack5:  #393836
dragonBlack6:  #625e5a
dragonWhite:   #c5c9c5
```

### Kanagawa Lotus (light)

```
lotusInk1:     #545464
lotusInk2:     #43436c
lotusGray:     #dcd7ba
lotusGray2:    #716e61
lotusGray3:    #8a8980
lotusWhite0:   #d5cea3
lotusWhite1:   #dcd5ac
lotusWhite2:   #e5ddb0
lotusWhite3:   #f2ecbc
lotusWhite4:   #e7dba0
lotusWhite5:   #e4d794
```

---

## 14. Everforest (sainnhe)

Soft, organic, green-tinted. Designed explicitly to be easy on the eyes for long sessions. Three contrast levels (soft, medium, hard).

### Dark variants (background hierarchy)

**Hard contrast:**
```
bg_dim:   #1E2326
bg0:      #272E33
bg1:      #2E383C
bg2:      #374145
bg3:      #414B50
bg4:      #495156
bg5:      #4F5B58
```

**Medium (default):**
```
bg_dim:   #232A2E
bg0:      #2D353B
bg1:      #343F44
bg2:      #3D484D
bg3:      #475258
bg4:      #4F585E
bg5:      #56635F
```

**Soft contrast:**
```
bg_dim:   #293136
bg0:      #333C43
bg1:      #3A464C
bg2:      #434F55
bg3:      #4D5960
bg4:      #555F66
bg5:      #5D6B66
```

### Accent colors (same across all dark contrasts)

```
fg:       #D3C6AA
grey0:    #7A8478
grey1:    #859289
grey2:    #9DA9A0

red:      #E67E80
orange:   #E69875
yellow:   #DBBC7F
green:    #A7C080
aqua:     #83C092
blue:     #7FBBB3
purple:   #D699B6
```

### Light variants

**Hard:**
```
bg_dim:   #F2EFDF
bg0:      #FFFBEF
bg1:      #F8F5E4
bg3:      #EDEADA
bg4:      #E8E5D5
bg5:      #BEC5B2
```

**Medium:**
```
bg_dim:   #EFEBD4
bg0:      #FDF6E3
bg1:      #F4F0D9
bg3:      #E6E2CC
bg4:      #E0DCC7
bg5:      #BDC3AF
```

**Light accents:**
```
fg:       #5C6A72
red:      #F85552
orange:   #F57D26
yellow:   #DFA000
green:    #8DA101
aqua:     #35A77C
blue:     #3A94C5
purple:   #DF69BA
```

---

## 15. Gruvbox

Retro-groove warm palette. Two contrast levels (Soft / Medium / Hard), Dark + Light.

### Gruvbox Dark (full 27-color set)

```
// Backgrounds
bg0_h:    #1d2021   // hard bg
bg:       #282828   // default bg
bg0_s:    #32302f   // soft bg
bg1:      #3c3836
bg2:      #504945
bg3:      #665c54
bg4:      #7c6f64

// Foregrounds
gray:     #928374
fg4:      #a89984
fg3:      #bdae93
fg2:      #d5c4a1
fg1:      #ebdbb2   // default fg
fg0:      #fbf1c7

// Accents (bright)
red:      #fb4934
green:    #b8bb26
yellow:   #fabd2f
blue:     #83a598
purple:   #d3869b
aqua:     #8ec07c
orange:   #fe8019

// Accents (neutral / faded)
red_n:    #cc241d
green_n:  #98971a
yellow_n: #d79921
blue_n:   #458588
purple_n: #b16286
aqua_n:   #689d6a
orange_n: #d65d0e
```

### Gruvbox Material (softer contrast version)

Same accent hex set, but the bg0 and bg1 are pulled together (#282828 -> #1d2021 default, very subtle backgrounds), and dimming is increased. Most users in 2025-2026 prefer Material over the original.

---

## 16. Ayu

Three official variants - Dark, Mirage, Light - all sharing a warm orange accent (`#FFCC66` / `#FFB454` family).

### Ayu Dark

```
common.bg:        #0f1419
common.fg:        #BFBDB6
common.ui:        #E6E1CF
common.accent:    #E6B450   // signature warm yellow

syntax.tag:       #39bae6
syntax.func:      #ffb454
syntax.entity:    #59c2ff
syntax.string:    #aad94c
syntax.regexp:    #95e6cb
syntax.markup:    #f07178
syntax.keyword:   #FF8F40
syntax.special:   #E6B673
syntax.comment:   #ACB6BF8C
syntax.constant:  #d2a6ff
syntax.operator:  #f29668
syntax.error:     #d95757
```

### Ayu Mirage (the softer middle)

```
common.bg:        #1f2430
common.fg:        #cbccc6
common.ui:        #707A8C
common.accent:    #FFCC66

syntax.tag:       #5ccfe6
syntax.func:      #ffd57f
syntax.entity:    #73d0ff
syntax.string:    #bae67e
syntax.regexp:    #95e6cb
syntax.markup:    #f28779
syntax.keyword:   #FFA759
syntax.special:   #FFE6B3
syntax.comment:   #5C6773
syntax.constant:  #d4bfff
syntax.operator:  #f29e74
syntax.error:     #ff3333
```

### Ayu Light

```
common.bg:        #FAFAFA
common.fg:        #5C6166
common.ui:        #8A9199
common.accent:    #FF9940

syntax.tag:       #55b4d4
syntax.func:      #f2ae49
syntax.entity:    #399ee6
syntax.string:    #86b300
syntax.regexp:    #4cbf99
syntax.markup:    #f07171
syntax.keyword:   #fa8d3e
syntax.special:   #e6ba7e
syntax.comment:   #ABADB1
syntax.constant:  #a37acc
syntax.operator:  #ed9366
syntax.error:     #f51818
```

---

## 17. Vitesse (by Antfu, creator of Slidev / VueUse)

A "no-pop" muted theme - everything is desaturated. Calm coding palette. Has Dark and Light.

### Vitesse Dark

```
background:    #121212
secondaryBg:   #181818
border:        #191919
foreground:    #dbd7caee
lineHighlight: #181818
selection:     #eeeeee18

// Syntax - all muted
keyword:       #4d9375
string:        #c98a7d
comment:       #758575dd
function:      #80a665
variable:      #bd976a
constant:      #c99076
storage:       #cb7676
operator:      #cb7676
namespace:     #db889a
property:      #b8a965
interface:     #5d99a9
class:         #6872ab

// Terminal
red:           #cb7676
green:         #4d9375
blue:          #6394bf
yellow:        #e6cc77
magenta:       #d9739f
cyan:          #5eaab5

// Status
error:         #cb7676
warning:       #d4976c
info:          #6394bf
added:         #4d9375
deleted:       #ab5959
```

### Vitesse Light

Inverted; `bg #ffffff`, foreground `#393a34`. Accent hex hues remain similar but slightly darkened for AA contrast on white.

---

## 18. Vesper (by Rauno Freiberg / Vercel)

"Peppermint & orange flavored." Extremely minimal: only 5 colors do the heavy lifting. Heavily-cloned in 2025-2026.

```
background:    #101010
foreground:    #ffffff
sidebar:       #101010
activityBar:   #101010
statusBar:     #101010
tabActive:     #161616
buttonBg:      #FFC799   // signature peach
buttonHover:   #FFCFA8
input:         #1C1C1C
selection:     rgba(255, 255, 255, 0.145)
border:        #1C1C1C
lineNumber:    #505050

// Syntax - intentionally sparse
keyword:       #A0A0A0      // gray, no color!
storage:       #A0A0A0
string:        #99FFE4      // peppermint
function:      #FFC799      // peach
comment:       rgba(139, 139, 139, 0.58)
number:        #FFC799
constant:      #FFC799
invalid:       #FF8080
variable:      #ffffff
```

This is the "less is more" approach - the editor stays mostly grayscale, and only strings + functions+ numbers get color. Very on-trend for 2026 minimalist dev tools.

---

## 19. Poimandres (pmndrs)

By drcmda (founder of React Three Fiber / pmndrs). Blueberry-deep dark with mint and turquoise accents.

```
bg:              #1b1e28
focus:           #303340    // panels
gray:            #a6accd    // primary text
darkerGray:      #767c9d    // muted text
bluishGray:      #506477    // borders
offWhite:        #e4f0fb    // highlights bg

brightMint:      #5DE4c7    // primary accent
strongTurquoise: #00CED1    // secondary
lowerMint:       #5fb3a1    // active states
lightBlue:       #ADD7FF    // highlights
lowerBlue:       #89ddff    // links
desaturatedGreen:#7AC6B6    // secondary light
hotRed:          #d0679d    // errors
pink:            #f087bd    // numbers
```

Of all the dark themes in this document, Poimandres has perhaps the most distinctive "future-tech" feel - perfect for a "vault" UI that should look like an artifact from the future.

---

## 20. Andromeda (Eliver Lara)

Space-themed. Soft pinks, mint, deep slate. Used in design-influencer dev streams.

```
background:    #23262E
foreground:    #D5CED9
selection:     #746f77
sidebar:       #23262E
statusBar:     #23262E

accent:        #00e8c6   // mint
button:        #00e8c5cc
buttonHover:   #07d4b6cc
badge:         #00b0ff

// Syntax
comment:       rgba(160, 161, 167, 0.8)
variable:      #00e8c6
orange:        #f39c12
yellow:        #FFE66D
pink:          #ff00aa
hotPink:       #f92672
purple:        #c74ded
blue:          #7cb7ff
red:           #ee5d43
green:         #96E072
progressBar:   #C668BA

// Status
error:         #FC644D
warning:       #FF9F2E
info:          #3A6395
```

---

## 21. Synthwave 84 and Cyberpunk Variants

The "neon dreams" family. Lower readability but extreme branding.

### SynthWave 84

```
background:    #2a2139    // deep purple
foreground:    #ffffff
neonPink:      #f92aad
neonPurple:    #c000c1
neonCyan:      #03edf9
neonGreen:     #72f1b8
yellow:        #fede5d
white:         #ffffff
selection:     rgba(255, 255, 255, 0.06)
gridLines:     rgba(255, 78, 255, 0.32)

// The signature glow effect:
// text-shadow: 0 0 2px #100c0f, 0 0 5px #f92aad, 0 0 10px rgba(249, 42, 173, 0.4);
```

### Cyberpunk 2077-style palette

```
background:    #050505 / #0B0D17
neonYellow:    #FCEE0A    // signature 2077 yellow
neonCyan:      #00E5FF
neonMagenta:   #FF2DAA
electricViolet:#7C4DFF
hotPink:       #FF2E88
```

---

## 22. Tailwind v3 / v4 Neutral Families

The de-facto "designer's neutral palette" of 2025-2026. Use these as base background tones for the vault and overall UI chrome.

### Tailwind v3 Zinc (cool, slight blue cast)

```
zinc-50:   #fafafa
zinc-100:  #f4f4f5
zinc-200:  #e4e4e7
zinc-300:  #d4d4d8
zinc-400:  #a1a1aa
zinc-500:  #71717a
zinc-600:  #52525b
zinc-700:  #3f3f46
zinc-800:  #27272a
zinc-900:  #18181b
zinc-950:  #09090b
```

### Tailwind v3 Slate (bluer, data-heavy UIs)

```
slate-50:  #f8fafc
slate-100: #f1f5f9
slate-200: #e2e8f0
slate-300: #cbd5e1
slate-400: #94a3b8
slate-500: #64748b
slate-600: #475569
slate-700: #334155
slate-800: #1e293b
slate-900: #0f172a
slate-950: #020617
```

### Tailwind v3 Neutral (pure gray, no hue)

```
neutral-50:  #fafafa
neutral-100: #f5f5f5
neutral-200: #e5e5e5
neutral-300: #d4d4d4
neutral-400: #a3a3a3
neutral-500: #737373
neutral-600: #525252
neutral-700: #404040
neutral-800: #262626
neutral-900: #171717
neutral-950: #0a0a0a
```

### Tailwind v3 Gray (slight warm cast)

```
gray-50:   #f9fafb
gray-100:  #f3f4f6
gray-200:  #e5e7eb
gray-300:  #d1d5db
gray-400:  #9ca3af
gray-500:  #6b7280
gray-600:  #4b5563
gray-700:  #374151
gray-800:  #1f2937
gray-900:  #111827
gray-950:  #030712
```

### Tailwind v3 Stone (warm gray, designer favorite)

```
stone-50:  #fafaf9
stone-100: #f5f5f4
stone-200: #e7e5e4
stone-300: #d6d3d1
stone-400: #a8a29e
stone-500: #78716c
stone-600: #57534e
stone-700: #44403c
stone-800: #292524
stone-900: #1c1917
stone-950: #0c0a09
```

### Tailwind v4 (OKLCH-based)

In v4 these same families exist but are defined in OKLCH for wider gamut (P3) screens. The OKLCH values from the v4 spec:

```css
--color-zinc-50: oklch(98.5% 0 0);
--color-zinc-100: oklch(96.7% 0.001 286.375);
--color-zinc-200: oklch(92% 0.004 286.32);
--color-zinc-300: oklch(87.1% 0.006 286.286);
--color-zinc-400: oklch(70.5% 0.015 286.067);
--color-zinc-500: oklch(55.2% 0.016 285.938);
--color-zinc-600: oklch(44.2% 0.017 285.786);
--color-zinc-700: oklch(37% 0.013 285.805);
--color-zinc-800: oklch(27.4% 0.006 286.033);
--color-zinc-900: oklch(21% 0.006 285.885);
--color-zinc-950: oklch(14.1% 0.005 285.823);
```

---

## 23. shadcn/ui Theming Patterns

shadcn/ui dominates 2025-2026 dev UIs because it ships a tiny, focused theme system based on CSS variables in HSL. Every component reads from these tokens, so swapping the theme is a single `:root` override.

### Default shadcn dark theme tokens (HSL, with hex translation)

```css
:root.dark {
  --background:            240 10% 3.9%;     /* #09090B  - zinc-950 */
  --foreground:            0 0% 98%;         /* #FAFAFA */
  --card:                  240 10% 3.9%;     /* #09090B */
  --card-foreground:       0 0% 98%;         /* #FAFAFA */
  --popover:               240 10% 3.9%;     /* #09090B */
  --popover-foreground:    0 0% 98%;
  --primary:               0 0% 98%;         /* #FAFAFA */
  --primary-foreground:    240 5.9% 10%;     /* #18181B */
  --secondary:             240 3.7% 15.9%;   /* #27272A */
  --secondary-foreground:  0 0% 98%;
  --muted:                 240 3.7% 15.9%;   /* #27272A */
  --muted-foreground:      240 5% 64.9%;     /* #A1A1AA */
  --accent:                240 3.7% 15.9%;   /* #27272A */
  --accent-foreground:     0 0% 98%;
  --destructive:           0 62.8% 30.6%;    /* #7F1D1D */
  --destructive-foreground:0 0% 98%;
  --border:                240 3.7% 15.9%;   /* #27272A */
  --input:                 240 3.7% 15.9%;
  --ring:                  240 4.9% 83.9%;   /* #D4D4D8 */
}
```

The genius here is that `background` and `card` are the same, but `secondary` / `muted` / `accent` / `border` all share `#27272A`. So a single dim step from the base creates every "layer above" by reuse.

### shadcn "Stone" variant

```
--background: 0 0% 100%;            /* #FFFFFF light */
--background-dark: 20 14.3% 4.1%;   /* #0C0A09 dark - stone-950 */
--foreground-dark: 60 9.1% 97.8%;   /* #FAFAF9 */
--primary-dark: 20.5 90.2% 48.2%;   /* warm orange accent */
```

### shadcn "Slate" variant

```
--background-dark:        222.2 84% 4.9%;     /* #020617 - slate-950 */
--card-dark:              222.2 84% 4.9%;
--primary-dark:           210 40% 98%;
--secondary-dark:         217.2 32.6% 17.5%;  /* #1E293B */
--muted-dark:             217.2 32.6% 17.5%;
--border-dark:            217.2 32.6% 17.5%;
```

---

## 24. Vercel Geist

```
background:        #000000  / "Geist 100"
backgroundSecondary:#0A0A0A
accents-1:         #111111
accents-2:         #333333
accents-3:         #444444
accents-4:         #666666
accents-5:         #888888
accents-6:         #999999
accents-7:         #EAEAEA
accents-8:         #FAFAFA
foreground:        #FFFFFF

// Brand accents
geistBlue:         #0070F3
geistPurple:       #F81CE5
geistCyan:         #79FFE1
geistRed:          #FF0000
geistOrange:       #F5A623
geistYellow:       #F7B955
```

Geist uses pure `#000000` background - the only major 2026 system that does. The bet: when the chrome is invisible (true black), the content stands out maximally. Works because they pair it with an extremely tight typography system (the Geist font).

---

## 25. OKLCH and Modern Color Spaces

Since 2024, OKLCH has displaced HSL as the "right" color space for design systems. Key reason: in HSL, "lightness 50%" looks different at different hues (a yellow at L=50% appears MUCH brighter than a blue at L=50%). OKLCH fixes this - L is perceptually uniform.

### What this means for the vault feature

You can write the surface elevation as:

```css
:root {
  --vault-base-hue: 285;     /* a faint cool blue */
  --vault-base-chroma: 0.005;

  --vault-bg:       oklch(14% var(--vault-base-chroma) var(--vault-base-hue));
  --vault-surface1: oklch(20% var(--vault-base-chroma) var(--vault-base-hue));
  --vault-surface2: oklch(27% var(--vault-base-chroma) var(--vault-base-hue));
  --vault-border:   oklch(35% var(--vault-base-chroma) var(--vault-base-hue));
  --vault-text:     oklch(95% 0.005 var(--vault-base-hue));
  --vault-muted:    oklch(65% 0.010 var(--vault-base-hue));
  --vault-accent:   oklch(72% 0.20  150);    /* mint */
}
```

And then "themes" become just two custom property overrides:

```css
.theme-tokyo-night    { --vault-base-hue: 230; --vault-accent: oklch(72% 0.18 250); }
.theme-catppuccin     { --vault-base-hue: 270; --vault-accent: oklch(80% 0.15 320); }
.theme-rose-pine      { --vault-base-hue: 310; --vault-accent: oklch(80% 0.10 30); }
.theme-everforest     { --vault-base-hue: 150; --vault-accent: oklch(75% 0.12 150); }
.theme-vesper         { --vault-base-hue: 0;   --vault-accent: oklch(85% 0.10 60); }
.theme-poimandres     { --vault-base-hue: 230; --vault-accent: oklch(82% 0.16 175); }
.theme-modern-dim     { --vault-base-hue: 285; --vault-accent: oklch(70% 0.18 150); }
```

Each theme is a 2-line declaration. The vault, panels, terminal, and markdown preview all derive from the same `oklch()` math. Switching themes is instant.

Browser support: Chrome 111+, Edge 111+, Safari 15.4+, Firefox 113+. Electron is Chromium so this is safe.

### Relative color syntax (also Baseline 2024)

```css
.vault-row:hover {
  background: oklch(from var(--vault-surface1) calc(l * 1.15) c h);
}
```

That single line lightens the row's surface by 15% on hover, in any theme, without redefining a hover color per theme.

---

## 26. xterm.js Theme Object Reference

Full `ITheme` interface props that the vault terminal can be themed against:

```js
interface ITheme {
  // Base
  foreground?: string;
  background?: string;
  cursor?: string;
  cursorAccent?: string;            // shown over the cursor for inverted text

  // Selection
  selectionBackground?: string;
  selectionForeground?: string;
  selectionInactiveBackground?: string;

  // Standard ANSI (0-7)
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;

  // Bright ANSI (8-15)
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;

  // UI
  scrollbarSliderBackground?: string;       // defaults to foreground @ low alpha
  scrollbarSliderHoverBackground?: string;
  scrollbarSliderActiveBackground?: string;
  overviewRulerBorder?: string;

  // 256-color extension
  extendedAnsi?: string[];                  // 16-255
}
```

Wire-up example for EZvibes's `renderer/app.js`:

```js
const themes = {
  tokyoNight:      require('./themes/tokyo-night.js'),
  catppuccinMocha: require('./themes/catppuccin-mocha.js'),
  rosePine:        require('./themes/rose-pine.js'),
  // ...
};

term = new Terminal({
  fontFamily: 'JetBrainsMono Nerd Font, Consolas, monospace',
  fontSize: 14,
  theme: themes[state.activeTheme],
  cursorBlink: true,
  allowTransparency: true,
});
```

And a CSS theme attribute on the host:

```js
sessionWindow.dataset.theme = state.activeTheme;
```

```css
[data-theme="tokyo-night"] {
  --vault-bg: #1a1b26;
  --vault-surface1: #1f2335;
  --vault-surface2: #24283b;
  --vault-text: #c0caf5;
  --vault-muted: #565f89;
  --vault-accent: #7aa2f7;
  --vault-border: #292e42;
}
```

---

## 27. Suggested Themes for the Vault Panel

Based on the user's Paint mockup (dark panel listing .md files, "paste" button accent), here are my top recommendations ranked by fit for the "pioneer-level cool vault" brief:

### Tier 1 - Strongly recommended (perfect fit for vault)

1. **Modern Dim (Tailwind Zinc 950 base)** - The 2026 default. zinc-950 background, zinc-800 panel, zinc-400 muted text, single accent (mint `#5DE4C7` or peach `#FFC799`). This is what shadcn ships and what 90% of new 2026 SaaS apps look like.

2. **Catppuccin Mocha** - High-vibrancy enough to feel like a "magical vault." `#1e1e2e` base, `mauve` (#cba6f7) accent for file icons, `lavender` (#b4befe) for "paste" button. Has a huge community-provided markdown renderer theme.

3. **Tokyo Night** - The "developer's developer" choice. Clean, recognizable, and renders markdown beautifully with `#7aa2f7` for headings, `#9ece6a` for code blocks. The 8M-install heavyweight.

4. **Vesper** - The minimalist pick. Pure `#101010` base, only the active row tints to peach `#FFC799`. This is the closest to the user's mockup aesthetic ("dark vault with one orange accent").

5. **Poimandres** - The "ancient artifact" vibe. `#1b1e28` deep blueberry, `#5DE4c7` brightmint accent for the "active" file. Reads as a "hand-off vault from the future."

### Tier 2 - Strong stylistic options

6. **Rose Pine Moon** - Soft purple/blue. Great for a calm, soho-coder vibe. `#232136` base, `#c4a7e7` iris accent.

7. **Kanagawa Wave** - Japanese woodblock aesthetic. `#1F1F28` base + `#7E9CD8` crystalBlue. Tasteful and original.

8. **Everforest Medium** - Forest-soft, easy on the eyes for 8+ hour sessions. `#2D353B` base, `#A7C080` green accent.

9. **Solarized Osaka** - For the "deep ocean" feel. `#00141a` deep cyan-black base, the rare `#2aa298` cyan accent that doesn't feel cliché.

10. **Andromeda** - Space-themed. `#23262E` base, `#00e8c6` mint primary. Good for a "code in a starship console" vibe.

### Tier 3 - Light variants for fans

11. **Catppuccin Latte** - `#eff1f5` base, `#1e66f5` blue accent. The light variant most users actually like.
12. **Rose Pine Dawn** - `#faf4ed` base, `#907aa9` iris accent.
13. **Solarized Light** - `#fdf6e3` base. The classic, low-key.
14. **GitHub Light** - `#ffffff` base. Familiar.
15. **Tokyo Night Light** - `#d5d6db` base. The official light variant.

### Tier 4 - Stylistic statement, not for default

16. **Synthwave 84** - Hot pink/cyan glow. Toggle it on for fun.
17. **Cobalt2** - Hot yellow on deep blue.
18. **Cyberpunk 2077-style** - Neon yellow accent.

### My recommendation for the vault feature

Ship **Modern Dim** (zinc/shadcn) as the default, with a theme picker in the top-right of the vault panel that offers Tokyo Night, Catppuccin Mocha, Rose Pine Moon, Vesper, Poimandres, Kanagawa, Everforest, Gruvbox Material, Dracula, Nord, Solarized Osaka, Synthwave 84 (for fun), and Catppuccin Latte (for light-mode fans). That's 12 themes, covers every major aesthetic, and each is a 2-line OKLCH override.

### Pioneer-level theme stack (the bold pick)

If you want to feel genuinely 2026, base the vault on OKLCH-derived tokens (section 25) with a Catppuccin Mocha palette projected onto it. Then ship a setting where the active terminal tab tints the vault: a Claude tab gives the vault a warm peach accent, a Codex tab tints it teal. Same tokens, different `--vault-accent` from a single CSS class. This idea - "the vault is theme-responsive to whoever's writing prompts" - is a feature no existing dev tool ships.

---

## 28. Sources

### Theme repositories

- [Tokyo Night VS Code Theme](https://github.com/tokyo-night/tokyo-night-vscode-theme) - Official Tokyo Night palette JSON
- [Tokyo Night for Neovim (folke)](https://github.com/folke/tokyonight.nvim) - 4 variants (storm, moon, night, day)
- [Catppuccin](https://github.com/catppuccin/catppuccin) - Soothing pastel theme
- [Catppuccin Palette](https://catppuccin.com/palette/) - Official 4-flavor color palette
- [Catppuccin Windows Terminal](https://github.com/catppuccin/windows-terminal) - Terminal-format theme
- [Rose Pine Palette](https://github.com/rose-pine/palette) - All 3 variants
- [Rose Pine Theme site](https://rosepinetheme.com/palette/) - Interactive palette
- [Nord Theme](https://www.nordtheme.com/docs/colors-and-palettes/) - Official 16-color spec
- [Dracula Theme](https://draculatheme.com/spec) - Official syntax highlighting spec
- [GitHub - Atom One Dark Theme](https://github.com/joshdick/onedark.vim) - The canonical port
- [OneDark Pro (Binaryify)](https://github.com/Binaryify/OneDark-Pro) - VS Code One Dark Pro
- [GitHub - Monokai Pro Neovim port](https://github.com/loctvl842/monokai-pro.nvim) - Filter variants
- [Monokai Pro official](https://monokai.pro/) - Original
- [Primer GitHub VS Code Theme](https://github.com/primer/github-vscode-theme) - Light, Dark, Dark Dimmed
- [GitHub Dark Dimmed Pygments](https://pygments-styles.org/styles/github-dark-dimmed/) - Color spec
- [Solarized official](https://ethanschoonover.com/solarized/) - Ethan Schoonover's CIELAB-balanced palette
- [Solarized GitHub](https://github.com/altercation/solarized) - Reference implementation
- [Solarized Osaka (craftzdog)](https://github.com/craftzdog/solarized-osaka.nvim) - Modern Solarized remix
- [Night Owl (Sarah Drasner)](https://github.com/sdras/night-owl-vscode-theme) - VS Code dark theme
- [Cobalt2 (Wes Bos)](https://github.com/wesbos/cobalt2) - The iconic blue/yellow theme
- [Cobalt2 VS Code](https://github.com/wesbos/cobalt2-vscode) - VS Code port
- [Kanagawa](https://github.com/rebelot/kanagawa.nvim) - Hokusai-inspired theme
- [Everforest](https://github.com/sainnhe/everforest) - Comfortable green theme
- [Everforest palette](https://github.com/sainnhe/everforest/blob/master/palette.md) - All contrast levels
- [Gruvbox (morhetz)](https://github.com/morhetz/gruvbox) - Retro groove palette
- [Gruvbox Material](https://github.com/sainnhe/gruvbox-material) - Softer contrast variant
- [Ayu Colors](https://github.com/ayu-theme/ayu-colors) - Dark, Mirage, Light
- [Vitesse (antfu)](https://github.com/antfu/vscode-theme-vitesse) - Muted dev theme
- [Vesper (Rauno Freiberg)](https://github.com/raunofreiberg/vesper) - Minimal peppermint/orange
- [Vesper Windows Terminal port](https://github.com/torbato/vesper-windows-terminal)
- [Poimandres (drcmda)](https://github.com/drcmda/poimandres-theme) - Blueberry minimal
- [Poimandres Neovim port](https://github.com/olivercederborg/poimandres.nvim)
- [Andromeda (Eliver Lara)](https://github.com/EliverLara/Andromeda) - Space-themed dark

### Design system references

- [Tailwind CSS Colors](https://tailwindcss.com/docs/colors) - v4 official color spec (OKLCH)
- [shadcn/ui Colors](https://ui.shadcn.com/colors) - Tailwind in every format
- [shadcn/ui Theming docs](https://ui.shadcn.com/docs/theming) - HSL token system
- [Primer Design System Colors](https://primer.style/primitives/colors/) - GitHub's design system
- [Vercel Geist Colors](https://vercel.com/geist/colors) - Vercel's design system
- [Material Design 3 Elevation](https://m3.material.io/styles/elevation) - Tonal surfaces
- [Material 3 Tone-based Surfaces](https://m3.material.io/blog/tone-based-surface-color-m3)

### Modern color science

- [The Ultimate OKLCH Guide](https://oklch.org/posts/ultimate-oklch-guide) - 2025 reference
- [OKLCH on CSS-Tricks](https://css-tricks.com/almanac/functions/o/oklch/)
- [MDN oklch() docs](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch)
- [web.dev: Color themes with Baseline CSS](https://web.dev/articles/baseline-in-action-color-theme)

### 2026 trend articles

- [Recursion: 2026 UI Color Trends](https://recursion.agency/blog/ui-color-trends-2026) - The "new black" / "new white"
- [Smashing Magazine: Inclusive Dark Mode](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/) - Designing accessible dark themes
- [Muz.li: Dark Mode Design Systems](https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/) - Patterns and hierarchy
- [Medium: The Rise of Dark Minimalism in 2025](https://medium.com/@harzeno/the-rise-of-dark-minimalism-in-2025-50f0e6c23594)
- [Medium: Dark Glassmorphism Will Define UI in 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [Webtoolshub: CSS Variables & Design Tokens 2026](https://www.webtoolshub.online/blog/css-variables-design-tokens-dark-mode-system-2026)

### Terminal emulator and tooling

- [Calmops: Modern Terminal Emulators 2026](https://calmops.com/tools/modern-terminal-emulators-2026-ghostty-wezterm-alacritty/) - Ghostty/WezTerm/Alacritty
- [TerminalColors](https://terminalcolors.com/tags/dark/) - Dark theme downloads
- [terminal.sexy](https://terminal.sexy/) - Color scheme designer
- [Paletty](https://paletty.dev/) - Terminal theme generator
- [Windows Terminal Themes](https://windowsterminalthemes.dev/)
- [xterm.js ITheme docs](https://xtermjs.org/docs/api/terminal/interfaces/itheme/) - Theme API reference
- [Oliver Roick: Setting Colours in Xterm.js](https://oliverroick.net/learnings/2024/setting-colours-in-xterm-js.html)
- [Bubble Tea v2: 10x Faster Terminal UIs](https://byteiota.com/bubble-tea-v2-10x-faster-terminal-uis-for-go-developers/) - Charm's TUI framework

### Theme aggregators

- [VS Code Themes browser](https://vscodethemes.com/) - Preview thousands of themes
- [zed-themes.com](https://zed-themes.com/) - Zed theme gallery
- [Cmux Themes](https://cmuxthemes.com/) - Multi-app theme catalog
- [Dotfyle: Top Neovim Colorschemes 2026](https://dotfyle.com/neovim/colorscheme/top) - Trending list
- [neoland.dev](https://neoland.dev/color-schemes) - Neovim scheme gallery
