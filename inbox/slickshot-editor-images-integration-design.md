# SlickShot editor + images integration — design

- **Date:** 2026-05-29
- **Status:** design (awaiting approval)
- **Scope:** single-feature change (`slickshot`)
- **Project:** Terminal-Emulator (canonical copy: `docs/2026-05-29-slickshot-editor-images-integration-design.md`)

## Goal

Replace the older bundled SlickShot screenshot tool with the newer **22 KB build that has the annotate/Edit feature**, keep it triggered globally by **Alt+Shift+4**, and make its **Save** action write into the terminal's `images/` folder so screenshots appear instantly in the sidebar's Images tab.

## Current state

The terminal **already bundles and auto-spawns** a SlickShot at `Terminal-Emulator/slickshot/slickshot.py` (spawned in `src/main/index.js:135`, killed at `:149`, via `src/main/features/slickshot/slickshot.main.js`). That bundled copy is an **older 15 KB build**:

| Aspect | Bundled 15 KB (current) | Documents 22 KB (target) |
|---|---|---|
| Editor / annotate | none | red/green freehand drawing canvas |
| Saves to | `<project>/images/` (relative-to-script) | `~/Documents/screenshots/` |
| Hotkey | Alt+Shift+**5** | Alt+Shift+**4** |
| Reads shared `~/.yourterm/config.json` | yes (naming) | no |

So "save into `images/`" is **already solved** by the old copy. The real task is **upgrading to the 22 KB build** (for the editor) while **preserving the `images/` save location**.

## Decisions

- **Hotkey:** Alt+Shift+4 — the 22 KB build's native binding, so **no hotkey code change**. (Chosen over Alt+Shift+F4 to avoid a Shift-slip collision with Windows' Alt+F4 close-window.)
- **Save directory:** `IMAGES_DIR` (`<project>/images`), passed to the script as `argv[1]` by `slickshot.main.js`. The script falls back to its relative-to-script path if no arg is supplied (so it still runs standalone).
- **Filename scheme:** `image{N}.png` — the 22 KB build's existing scan-and-increment (no change).
- **Staging:** `images/.tmp/` — required so the widget's OS file-drag works on a real file. Hidden from the sidebar because `getImageFiles()` is non-recursive and extension-filtered (`sidebar.main.js:24-27`).
- **Editor, widget, copy, drag:** kept as-is from the 22 KB build.

## Approach: port-and-replace (stays inside the `slickshot` feature)

1. Replace `Terminal-Emulator/slickshot/slickshot.py` with the 22 KB build.
2. Change its save-dir resolution to read `sys.argv[1]`, with the relative-to-script path as fallback:
   ```python
   SAVE_DIR = sys.argv[1] if len(sys.argv) > 1 else \
       os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "images")
   STAGING_DIR = os.path.join(SAVE_DIR, ".tmp")
   ```
3. In `slickshot.main.js`, import `IMAGES_DIR` from `shared/paths` and pass it as the second spawn arg:
   ```js
   spawnProcess('python', [SLICKSHOT_PATH, IMAGES_DIR], { … });
   ```

### Why the CLI arg over a hardcoded relative path

The relative trick (`dirname(dirname(__file__))/images`) resolves correctly **only in dev**. When the app is packaged, `SLICKSHOT_PATH` lives under `resources/` while `IMAGES_DIR` lives next to the `.exe` — they diverge. Passing the path from `paths.js` (the project's single source of truth for paths) is correct in **both** dev and packaged builds, and is barely more code.

## Files touched (slickshot feature only — no shared edits, no other features)

- `Terminal-Emulator/slickshot/slickshot.py` — replaced with the ported 22 KB build (save dir from `argv[1]`).
- `src/main/features/slickshot/slickshot.main.js` — `require` `IMAGES_DIR` from `shared/paths`; pass it as the second spawn arg.
- `FEATURE-MAP.md` + `.claude/rules/slickshot.md` — note that the bundled `.py` is the feature's payload and receives the save dir as `argv[1]`.

## Not touched (and why)

- `shared/paths.js` — `IMAGES_DIR` and `SLICKSHOT_PATH` are already exported.
- `shared/security.js` — `IMAGES_DIR` is already allowlisted; the sidebar never reads `.tmp`.
- `src/main/index.js` — spawn/kill wiring already exists.
- Sidebar — already watches `IMAGES_DIR`; new files appear automatically via chokidar.

## Rejected alternative

**Point the spawn at the external `C:\Users\Oskari\Documents\slickshot\slickshot.py`.** Machine-specific absolute path, not version-controlled, breaks when packaged, and entangles the standalone dev copy with the app. The Documents copy stays untouched as the user's sandbox; the project copy becomes the integrated one.

## Verification

The **running app hosts this session, so it must not be restarted** to test. Verification:

- `python -m py_compile slickshot.py` to confirm the ported script parses.
- Functional check by the user: press Alt+Shift+4 → crop → Edit → Save → confirm `image{N}.png` lands in `images/` and shows in the sidebar's Images tab.

## Open questions

None — hotkey (Alt+Shift+4) and filename scheme (`image{N}.png`) confirmed with the user.
