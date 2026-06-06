# SlickShot editor + images integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the older bundled SlickShot with the 22 KB build (crop → annotate → save), keep its Alt+Shift+4 hotkey, and make Save land `image{N}.png` files in the terminal's `images/` folder so they appear in the sidebar.

**Architecture:** Port-and-replace inside the isolated `slickshot` feature. The Electron app already auto-spawns whatever `.py` sits at `SLICKSHOT_PATH` and kills it on quit (`src/main/index.js:135,149`). We swap in the better script and have `slickshot.main.js` pass `IMAGES_DIR` to it as a launch argument; the script reads `argv[1]` as its save dir (fallback: `<project>/images` relative to the script).

**Tech Stack:** Python 3 + PyQt5 (the screenshot widget), Node/Electron `child_process.spawn` (the launcher), `python -m unittest` (stdlib) for the one piece of new Python logic.

**Project:** Terminal-Emulator (canonical copy: `docs/2026-05-30-slickshot-editor-images-integration-plan.md`)
**Design doc:** `docs/2026-05-29-slickshot-editor-images-integration-design.md`

**On commits:** This project's owner commits manually (full working tree). **Do not auto-commit.** The `git` steps below are included for plan completeness — run them only if the user explicitly asks; otherwise leave changes for the user to review.

**On testing the live app:** The running terminal **hosts this session — never restart or `npm start` it.** The currently-running app already spawned the OLD slickshot at its launch, so the new behavior (Alt+Shift+4 → save to `images/`) only takes effect the **next time the user starts the app themselves.** In-session we verify with `py_compile`, a unit test, and `node --check`; the GUI capture flow is verified by the user after their next launch (see Task 4).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `slickshot/slickshot.py` | Replace + edit | The screenshot widget (crop, annotate, save, drag). Save dir from `argv[1]`. |
| `slickshot/test_slickshot.py` | Create | Unit test for the `resolve_save_dir` save-dir logic. |
| `src/main/features/slickshot/slickshot.main.js` | Modify | Pass `IMAGES_DIR` as the second spawn arg. |
| `FEATURE-MAP.md` | Modify | Document the `.py` payload + `argv[1]` contract. |
| `.claude/rules/slickshot.md` | Modify | Same, for the feature-rule scope. |

---

## Task 1: Port the 22 KB build into the project and redirect its save dir

**Files:**
- Modify (replace then edit): `slickshot/slickshot.py`
- Test: `slickshot/test_slickshot.py`

- [ ] **Step 1: Copy the 22 KB build over the bundled copy**

PowerShell:
```powershell
Copy-Item "C:\Users\Oskari\Documents\slickshot\slickshot.py" "C:\Users\Oskari\Documents\Terminal-Emulator\slickshot\slickshot.py" -Force
```

- [ ] **Step 2: Write the failing test**

Create `slickshot/test_slickshot.py`:
```python
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import slickshot  # the bundled slickshot.py in this folder


class ResolveSaveDirTests(unittest.TestCase):
    SCRIPT = r"C:\proj\slickshot\slickshot.py"

    def test_uses_argv_when_provided(self):
        result = slickshot.resolve_save_dir(["slickshot.py", r"C:\proj\images"], self.SCRIPT)
        self.assertEqual(result, r"C:\proj\images")

    def test_falls_back_to_relative_images_when_no_arg(self):
        result = slickshot.resolve_save_dir(["slickshot.py"], self.SCRIPT)
        self.assertEqual(result, os.path.join(r"C:\proj", "images"))

    def test_blank_arg_falls_back(self):
        result = slickshot.resolve_save_dir(["slickshot.py", "   "], self.SCRIPT)
        self.assertEqual(result, os.path.join(r"C:\proj", "images"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the test and confirm it fails for the right reason**

Run:
```powershell
python slickshot\test_slickshot.py -v
```
Expected: errors with `AttributeError: module 'slickshot' has no attribute 'resolve_save_dir'`.
(Importing the raw copied file runs its module-level `os.makedirs(~/Documents/screenshots)` once — harmless; Step 4 removes that side effect.)

- [ ] **Step 4: Replace the hardcoded save dir with `resolve_save_dir`**

In `slickshot/slickshot.py`, replace these four lines (currently lines 17–20):
```python
SAVE_DIR = os.path.join(os.path.expanduser("~"), "Documents", "screenshots")
STAGING_DIR = os.path.join(SAVE_DIR, ".tmp")
os.makedirs(SAVE_DIR, exist_ok=True)
os.makedirs(STAGING_DIR, exist_ok=True)
```
with:
```python
def resolve_save_dir(argv, script_path):
    """Save dir is passed by the Electron app as argv[1]. Fall back to
    <project>/images (relative to this script) so the tool still runs standalone."""
    if len(argv) > 1 and argv[1].strip():
        return argv[1]
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(script_path))), "images")


SAVE_DIR = resolve_save_dir(sys.argv, __file__)
STAGING_DIR = os.path.join(SAVE_DIR, ".tmp")
```
(`sys` and `os` are already imported at the top of the file. The `os.makedirs` calls move to Step 5.)

- [ ] **Step 5: Create the save/staging dirs at startup instead of import time**

In `slickshot/slickshot.py`, find the `run` method of `SlickShotApp` (currently lines 600–602):
```python
    def run(self):
        print(f"SlickShot running. Press Alt+Shift+4 to capture. Saving to {SAVE_DIR}. Ctrl+C to quit.")
        sys.exit(self.app.exec_())
```
Replace it with:
```python
    def run(self):
        os.makedirs(SAVE_DIR, exist_ok=True)
        os.makedirs(STAGING_DIR, exist_ok=True)
        print(f"SlickShot running. Press Alt+Shift+4 to capture. Saving to {SAVE_DIR}. Ctrl+C to quit.")
        sys.exit(self.app.exec_())
```
(This keeps `import slickshot` side-effect-free so the test can import it cleanly, and still guarantees the folders exist before the first capture.)

- [ ] **Step 6: Run the test and confirm it passes**

Run:
```powershell
python slickshot\test_slickshot.py -v
```
Expected: `Ran 3 tests` ... `OK`.

- [ ] **Step 7: Confirm the full script still parses**

Run:
```powershell
python -m py_compile slickshot\slickshot.py
```
Expected: no output, exit code 0.

- [ ] **Step 8: Commit** *(only if the user asked — see header)*

```powershell
git add slickshot/slickshot.py slickshot/test_slickshot.py
git commit -m "feat(slickshot): port 22KB build with editor; save dir from argv[1]"
```

---

## Task 2: Pass `IMAGES_DIR` to the spawned script

**Files:**
- Modify: `src/main/features/slickshot/slickshot.main.js`

- [ ] **Step 1: Import `IMAGES_DIR` alongside `SLICKSHOT_PATH`**

In `src/main/features/slickshot/slickshot.main.js`, change:
```js
const { SLICKSHOT_PATH } = require('../../shared/paths');
```
to:
```js
const { SLICKSHOT_PATH, IMAGES_DIR } = require('../../shared/paths');
```

- [ ] **Step 2: Pass `IMAGES_DIR` as the second spawn argument**

In the same file, change:
```js
    slickshotProcess = spawnProcess('python', [SLICKSHOT_PATH], {
```
to:
```js
    slickshotProcess = spawnProcess('python', [SLICKSHOT_PATH, IMAGES_DIR], {
```

- [ ] **Step 3: Confirm the file still parses**

Run:
```powershell
node --check src\main\features\slickshot\slickshot.main.js
```
Expected: no output, exit code 0.

(No unit test added here: the change adds an already-exported constant to the args array; `paths.js` dereferences `electron.app` at load so the module can't be `require`d outside Electron, and the file has no existing test harness. The save-dir behavior is covered by Task 1's test, and end-to-end by Task 4. Adding a `child_process` mock would be disproportionate.)

- [ ] **Step 4: Commit** *(only if the user asked — see header)*

```powershell
git add src/main/features/slickshot/slickshot.main.js
git commit -m "feat(slickshot): pass IMAGES_DIR as the screenshot save dir"
```

---

## Task 3: Update the feature docs

**Files:**
- Modify: `FEATURE-MAP.md`
- Modify: `.claude/rules/slickshot.md`

- [ ] **Step 1: Update the SlickShot section in `FEATURE-MAP.md`**

Replace the current SlickShot block:
```markdown
## SlickShot
**What it does:** Spawns/manages the SlickShot Python screenshot widget
**Files:**
- `src/main/features/slickshot/slickshot.main.js`
**IPC Channels:** None
**Depends On:** `src/main/shared/paths.js`
**Safe to Edit Alone:** YES
```
with:
```markdown
## SlickShot
**What it does:** Spawns/manages the SlickShot Python screenshot widget (crop → annotate → save). Global hotkey Alt+Shift+4; Save writes `image{N}.png` into `images/` (the sidebar's Images folder).
**Files:**
- `src/main/features/slickshot/slickshot.main.js`
- `slickshot/slickshot.py` (bundled PyQt5 payload the feature spawns; receives the save dir as `argv[1]`)
- `slickshot/test_slickshot.py` (unit test for the save-dir resolution)
**IPC Channels:** None
**Depends On:** `src/main/shared/paths.js` (`SLICKSHOT_PATH`, `IMAGES_DIR`)
**Note:** `slickshot.main.js` passes `IMAGES_DIR` as the second spawn arg so screenshots land in the sidebar's images folder. The `.py` falls back to `<project>/images` (relative to the script) when launched with no arg. Staging happens in `images/.tmp/`, which the sidebar ignores (non-recursive, extension-filtered listing).
**Safe to Edit Alone:** YES
```

- [ ] **Step 2: Update `.claude/rules/slickshot.md`**

Replace the file contents with:
```markdown
---
paths:
  - src/main/features/slickshot/**
  - slickshot/**
---

You are editing the SLICKSHOT feature. Your files:
- `src/main/features/slickshot/slickshot.main.js` (spawn/kill lifecycle; passes `IMAGES_DIR` as the save-dir arg)
- `slickshot/slickshot.py` (bundled PyQt5 screenshot widget; save dir from `argv[1]`, fallback `<project>/images`)
- `slickshot/test_slickshot.py` (unit test for `resolve_save_dir`)

No IPC channels. No renderer component.
Depends on: `shared/paths.js` (for `SLICKSHOT_PATH` and `IMAGES_DIR`)

DO NOT edit files from other features.
```

- [ ] **Step 3: Commit** *(only if the user asked — see header)*

```powershell
git add FEATURE-MAP.md .claude/rules/slickshot.md
git commit -m "docs(slickshot): document .py payload and IMAGES_DIR save-dir contract"
```

---

## Task 4: Verification (in-session checks done; GUI check is the user's)

- [ ] **Step 1: In-session checks (already green from Tasks 1–2)**
  - `python slickshot\test_slickshot.py -v` → `OK` (3 tests)
  - `python -m py_compile slickshot\slickshot.py` → no output
  - `node --check src\main\features\slickshot\slickshot.main.js` → no output

- [ ] **Step 2: User GUI check (after the user's NEXT app launch — not during this session)**
  1. Start the terminal app (the user does this; we never restart the host app).
  2. Press **Alt+Shift+4** → the crop overlay appears.
  3. Drag a box → the floating widget appears bottom-left with Del / ✕ / Save / **Edit** / Copy.
  4. Click **Edit**, scribble in red/green, **Save** → editor closes, widget shows the annotated image.
  5. Click **Save** on the widget.
  6. Confirm a new `image{N}.png` appears in `Terminal-Emulator\images\` **and** in the sidebar's Images tab.

- [ ] **Step 3: Note for the user**
  The standalone `C:\Users\Oskari\Documents\slickshot\slickshot.py` is unchanged — it remains the dev sandbox and still saves to `~/Documents/screenshots`. The project copy is now the integrated one.

---

## Self-Review (done by the plan author)

- **Spec coverage:** hotkey Alt+Shift+4 (no code change — preserved by the copy, asserted in Task 4) ✓; save dir via `argv[1]` (Task 1 Step 4 + Task 2) ✓; `image{N}.png` (unchanged in the 22 KB build) ✓; `images/.tmp` staging (unchanged; documented in Task 3) ✓; editor preserved (whole-file copy) ✓; files touched = Tasks 1–3 ✓; not-touched (`paths.js`/`security.js`/`index.js`/sidebar) confirmed in design ✓.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code.
- **Type consistency:** `resolve_save_dir(argv, script_path)`, `SAVE_DIR`, `STAGING_DIR`, `IMAGES_DIR` used identically across tasks.
