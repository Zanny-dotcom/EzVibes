# EZvibes Marketing Video — Setup & Edit Guide

A 120-second marketing video targeted at **complete non-coders** who hear "vibecoding" and want to try it but are intimidated by terminals. Built with Remotion. Two compositions registered: landscape 1920×1080 (website hero) and vertical 1080×1920 (shorts / TikTok / Instagram).

## Folder

`C:\Users\Oskari\Documents\EZvibes\marketing\remotion`

## Preview (live, scrubbable)

```powershell
cd C:\Users\Oskari\Documents\EZvibes\marketing\remotion
npm start
```

This opens Remotion Studio in your browser. Pick `EZvibesMain` (landscape) or `EZvibesShorts` (vertical) from the left panel. Hit Space to play. Drag the timeline to scrub.

If `node_modules` is missing, run `npm install` first.

## Render to MP4

```powershell
cd C:\Users\Oskari\Documents\EZvibes\marketing\remotion
npm run build           # landscape MP4 -> out/ezvibes-main.mp4
npm run build:shorts    # vertical  MP4 -> out/ezvibes-shorts.mp4
npm run build:all       # both
```

First render downloads Chromium; subsequent renders are fast.

## Render a single still (for thumbnails)

```powershell
npx remotion still EZvibesMain hero.png --frame=1800
```

Frame number is 0…3599 (120s × 30fps).

## The 7 scenes

All seven live in `src/scenes/`. Each is an independent Remotion component; edit one in isolation without breaking the others.

| File | Time | Beat |
|---|---|---|
| `SceneWall.tsx`        |   0–12s  | The scary terminal "wall" that stops normal people from coding today. Dark, intimidating, empathetic. |
| `ScenePromise.tsx`     | 12–22s   | Warm sunrise — one yellow folder rising into a cream background. "What if making apps was as easy as opening a folder?" |
| `SceneReveal.tsx`      | 22–35s   | First look at the EZvibes app: a 12-folder grid with personal hobby names. "Every folder is a project. That's it." |
| `ScenePickAndAsk.tsx`  | 35–55s   | Right-click → Launch Claude → folder unfolds into a session window → user types "A birthday card website for my mom" in plain English. |
| `SceneMagic.tsx`       | 55–80s   | **The upcoming Add-a-Feature flow.** Three step cards (What / Which project / Describe it) → auto build/save/share → green "+1 feature added today" counter bounces into the top-left. |
| `SceneWin.tsx`         | 80–100s  | (A) multi-project view with orange minimized folders, tab chips (CLAUDE / CODEX), "What Was Made" sidebar. (B) Panel Mode demo — point at a button, type "make this rounder and green," watch it transform. |
| `SceneCTA.tsx`         | 100–120s | EZvibes logo, "vibecoding, for everyone," three reassurance pills: "No terminal." "No setup." "No code." |

The timeline is wired in `src/compositions/MainVideo.tsx` and durations come from `sceneRanges` in `src/theme/tokens.ts`.

## Where to edit common things

| You want to change | Open |
|---|---|
| Folder names shown in the app grid | `src/scenes/SceneReveal.tsx` (12-item array near top) and `src/scenes/ScenePickAndAsk.tsx` (2×2 grid) |
| The "user's request" in the terminal | `src/scenes/ScenePickAndAsk.tsx` — search for "A birthday card website for my mom" |
| The Add-a-Feature step card titles / button labels | `src/scenes/SceneMagic.tsx` |
| The "+1 feature added today" label | `src/scenes/SceneMagic.tsx` — the `<GreenChip>` props |
| Panel Mode demo text ("make this rounder and green") | `src/scenes/SceneWin.tsx` |
| Final tagline / pills | `src/scenes/SceneCTA.tsx` |
| Brand colors, fonts, FPS, scene durations | `src/theme/tokens.ts` |
| The whole timeline / scene order | `src/compositions/MainVideo.tsx` |

## Shared components (don't edit unless you mean to)

In `src/components/`:

- `FolderIcon.tsx` — the yellow EZvibes folder shape. States: `default`, `active`, `minimized` (orange).
- `WindowFrame.tsx` — the macOS-style app window frame. Variants: `explorer`, `session`.
- `TerminalMock.tsx` — the dark terminal block with cream/teal text.
- `ContextMenu.tsx` — right-click menu.
- `TabChip.tsx` — Chrome-style CLAUDE / CODEX tab.
- `GreenChip.tsx` — the "+N feature added today" badge.
- `Caption.tsx` — typography wrapper (sizes sm/md/lg/xl).
- `Cursor.tsx` — the animated mouse pointer.

These are shared across all 7 scenes; if you change one, it ripples through the whole video.

## Audio

The video ships silent. Two easy ways to add sound:

1. **In Remotion** — drop an mp3 into `public/` and import via `<Audio src={staticFile('music.mp3')} />` inside `MainVideo`.
2. **In post** — render the MP4 and add VO + music in CapCut / Premiere / Final Cut.

A voiceover script is optional; the captions are written to carry the message silently for muted social autoplay.

## Vertical (TikTok / Instagram Reels) version

Already registered as `EZvibesShorts` (1080×1920). The scene components are layout-aware enough to mostly work, but for a polished vertical cut you'll likely want to tweak font sizes and positions for some scenes. Run `npm start` and view both compositions side by side to spot issues.

## Common follow-up changes

- Make the music swell on the "+1" counter beat (frame 1920, when SceneMagic's GreenChip pops in).
- Swap the typed-in folder names to your real audience's hobbies (book club, knitting, fantasy football, etc.).
- Replace the CTA tagline with a URL or a CTA verb ("Download free," "Try it now").
- Shorten to 60s by cutting SceneWin (panel mode) and tightening SceneReveal — easy because each scene is one file.
