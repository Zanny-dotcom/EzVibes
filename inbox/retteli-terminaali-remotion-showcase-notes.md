# Retteli Terminaali — 12s Remotion Showcase

A self-contained Remotion project that renders a 12-second product-promo video
for the Retteli Terminaali Electron terminal. Lives **outside** the app's
feature-isolated source so it can't interfere with the codebase.

## Where it lives

```
C:\Users\Oskari\Documents\Terminal-Emulator\showcase\
├─ package.json            # own deps (remotion 4.0.290, react 19)
├─ remotion.config.ts
├─ tsconfig.json
├─ .gitignore              # ignores node_modules/, out/
└─ src\
   ├─ index.ts             # registerRoot
   ├─ Root.tsx             # <Composition id="Showcase" 1920x1080 @30fps, 360 frames>
   ├─ Showcase.tsx         # the timeline / beat orchestration
   ├─ theme.ts             # design tokens mirrored from the app (dark + red #e23b3b)
   ├─ helpers.ts           # fade / pop / typed / cursor helpers
   └─ components\
      ├─ AppFrame.tsx          # window chrome (rail + tabbar + center + sidebar)
      ├─ WorkspaceRail.tsx     # left 168px workspace tiles
      ├─ TabBar.tsx            # Chrome-style top tabs
      ├─ Sidebar.tsx           # right image/docs sidebar w/ faux brave thumbs
      ├─ TerminalPane.tsx      # Claude Code boot + typing prompt
      ├─ BrowserPane.tsx       # mock "Featured Projects" portfolio page
      ├─ InspectorOverlay.tsx  # crosshair + highlight box + "describe change" bubble
      ├─ GridView.tsx          # 2x2 security-cam tiles (color-coded)
      ├─ Callout.tsx           # lower feature captions
      ├─ TitleIntro.tsx        # opening title card
      ├─ EndCard.tsx           # closing card + tech chips
      └─ Logo.tsx              # 8x8 pixel mascot (bitmap-drawn, scales crisp)
```

## Output

`showcase\out\retteli-showcase.mp4` — H.264, 1920×1080, 30fps, 12.05s, ~2.6 MB.

## How to regenerate / edit

```powershell
cd C:\Users\Oskari\Documents\Terminal-Emulator\showcase
npm install                 # first time only
npm start                   # opens Remotion Studio (live preview + scrubbing)
npm run render              # writes out\retteli-showcase.mp4
npm run still -- --frame=N  # single PNG for quick checks (or: npx remotion still Showcase out\f.png --frame=N)
```

## Timeline (360 frames = 12.0s, four ~3s beats)

| Frames | Beat | Content |
|---|---|---|
| 0–90   | Title + frame assembles | pixel logo, "Retteli Terminaali / The terminal that runs your AI agents", chrome slides in |
| 90–180 | Agents in workspaces    | `> claude --dangerously-skip-permissions` types in the terminal pane; callout "Folder-bound workspaces · Claude & Codex" |
| 180–270| Browser + element inspector | center crossfades to a mock Brave portfolio page; crosshair sweeps to the PROJECTS nav, highlight box snaps on, "describe the change" bubble pops; callout "Point. Describe. Inject into the agent." |
| 270–360| Grid + outro            | 2×2 security-cam grid (red Claude / green Researcher / amber localhost / blue Codex) tiles in; end card with logo + tagline + tech chips |

Everything is drawn in code (no screenshot assets) so it stays crisp at any
resolution and has no asset dependency. Colors, the pixel mascot, the red focus
borders, and the sidebar/tab layout are matched to the real app screenshots.

## Tweak points

- **Duration/format:** `src/theme.ts` → `VIDEO` (width/height/fps/durationInFrames).
- **Beat timing:** `src/Showcase.tsx` → `B2`/`B3`/`B4` constants + the per-element
  `interpolate`/`fade` windows.
- **Copy:** callout strings in `Showcase.tsx`; title/end-card text in
  `TitleIntro.tsx` / `EndCard.tsx`.
- **Inspector target:** `InspectorOverlay.tsx` → `TARGET` rect (pane-local px).
- Add a soundtrack with an `<Audio>` tag in `Showcase.tsx` (currently silent).
