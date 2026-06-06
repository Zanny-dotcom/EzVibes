# SlickShot Tier 0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Orchestration note:** Tasks are grouped into **Waves**. Tasks within a wave are independent and may be dispatched in parallel (one subagent each). A wave starts only after the prior wave's tasks are merged. Each task lists its **Depends on:** explicitly so a workflow can build the dependency graph. Pure-logic tasks (Wave A) are fully unit-testable in any environment; GUI/hook tasks (Wave C) require an interactive Windows desktop session and carry **manual test** steps for the user.

**Goal:** Migrate SlickShot to a PySide6 `slickshot/` package with multi-monitor + HiDPI-correct capture, a registered global hotkey, a system tray, a settings store, structured logging, and a non-destructive `Document` annotation model — while the legacy `slickshot.py` (PyQt5) remains runnable until parity.

**Architecture:** A new `slickshot/` package built on PySide6/Qt6 is developed **in parallel** to the existing single-file PyQt5 app. Independent leaf modules (paths, settings, logging) and pure-logic units (filename patterns, multi-monitor geometry, the `Document`/flatten model, temp cleanup) are built and unit-tested first (Wave A). Capture + hotkey systems modules follow (Wave B). The GUI shell (app controller, tray, crop overlay, preview widget) wires them together last (Wave C). The legacy app is only retired in the final task once the new entry point reaches capture→preview→save parity.

**Tech Stack:** Python 3.11, PySide6 (Qt6), `ctypes` (Win32 hotkey + screen metrics), `pytest` 9.x, stdlib (`json`, `pathlib`, `sqlite3` reserved for later tiers, `logging`). New runtime dependency: `PySide6`.

---

## File Structure

New package (created across the tasks below):

```
slickshot.py                  # LEGACY PyQt5 app — stays runnable until Task 18; untouched until then
slickshot_pyside/             # NEW entry shim during parallel phase → `python -m slickshot_pyside`
  __main__.py                 # launches slickshot.app.main()   (Task 14)
slickshot/                    # the new package
  __init__.py                 # (Task 1)
  app.py                      # SlickShotApp controller, lifecycle, wiring   (Task 15)
  config/
    __init__.py
    paths.py                  # %APPDATA%/SlickShot dirs, save/staging/log/history paths   (Task 2)
    settings.py               # JSON settings store, typed get/set, defaults, migration   (Task 4)
    filenames.py              # filename-pattern expansion + collision-free next name   (Task 3)
  util/
    __init__.py
    logging_setup.py          # structured logging to %APPDATA%/SlickShot/log.txt   (Task 5)
    images.py                 # QImage<->QPixmap helpers, pixelate primitive   (Task 8)
  capture/
    __init__.py
    screens.py                # multi-monitor virtual-geometry + per-screen DPR math   (Task 6)
    grab.py                   # grab across all screens at correct DPR -> Capture   (Task 11)
    cleanup.py                # delete stale staging files on startup   (Task 7)
  editor/
    __init__.py
    document.py               # Document = base image + ordered annotations; flatten()   (Task 9)
    annotations.py            # Annotation base + RedactionPixelate (Tier-0 seed)   (Task 10)
  hotkey/
    __init__.py
    win_hotkey.py             # RegisterHotKey + native event filter   (Task 12)
  preview/
    __init__.py
    widget.py                 # ScreenshotWidget ported to PySide6   (Task 16)
  overlay/
    __init__.py
    crop_overlay.py           # CropOverlay ported to PySide6, multi-monitor aware   (Task 13)
  tray/
    __init__.py
    tray_icon.py              # QSystemTrayIcon + menu   (Task 17)
tests/
  __init__.py
  test_filenames.py           # (Task 3)
  test_settings.py            # (Task 4)
  test_paths.py               # (Task 2)
  test_logging_setup.py       # (Task 5)
  test_screens.py             # (Task 6)
  test_cleanup.py             # (Task 7)
  test_images.py              # (Task 8)
  test_document.py            # (Task 9)
  test_annotations.py         # (Task 10)
conftest.py                   # pytest path setup + qapp fixture   (Task 0)
pyproject.toml                # build/deps/pytest config   (Task 1)
```

### Dependency / wave graph

- **Wave A (fully parallel, pure-logic, unit-tested anywhere):** Tasks 2, 3, 4, 5, 6, 7, 8, 9, 10
  - (Task 4 depends on Task 2; Task 3 depends on Task 2; Task 10 depends on Task 9; Task 7 depends on Task 2. Within Wave A, dispatch 2 first, then the rest can fan out. Tasks 6, 8, 9 have no intra-wave deps.)
- **Wave B (parallel, systems modules):** Tasks 11, 12
  - (Task 11 depends on 6 + 8; Task 12 depends on 4.)
- **Wave C (sequential, GUI shell, manual-tested by user):** Tasks 13 → 16 → 17 → 14 → 15 → 18
  - (Each depends on the prior; they share the QApplication wiring.)
- **Setup (must run first, before Wave A):** Tasks 0, 1.

---

## Task 0: Project scaffolding & pytest harness

**Files:**
- Create: `conftest.py`
- Create: `tests/__init__.py`
- Create: `slickshot/__init__.py`
- Create: `slickshot/config/__init__.py`, `slickshot/util/__init__.py`, `slickshot/capture/__init__.py`, `slickshot/editor/__init__.py`, `slickshot/hotkey/__init__.py`, `slickshot/preview/__init__.py`, `slickshot/overlay/__init__.py`, `slickshot/tray/__init__.py`

**Depends on:** nothing. **Run first.**

- [ ] **Step 1: Create the feature branch**

Run:
```bash
git checkout -b tier0-foundation
```
Expected: `Switched to a new branch 'tier0-foundation'`

- [ ] **Step 2: Install PySide6**

Run:
```bash
python -m pip install PySide6
```
Expected: ends with `Successfully installed ... PySide6-6.x.x ...` (Qt6). Verify:
```bash
python -c "import PySide6; from PySide6 import QtWidgets; print('PySide6', PySide6.__version__)"
```
Expected: prints `PySide6 6.x.x`.

- [ ] **Step 3: Create all package `__init__.py` files (empty) and `tests/__init__.py`**

Create each of these as an **empty** file:
`slickshot/__init__.py`, `slickshot/config/__init__.py`, `slickshot/util/__init__.py`, `slickshot/capture/__init__.py`, `slickshot/editor/__init__.py`, `slickshot/hotkey/__init__.py`, `slickshot/preview/__init__.py`, `slickshot/overlay/__init__.py`, `slickshot/tray/__init__.py`, `tests/__init__.py`.

- [ ] **Step 4: Create `conftest.py`**

```python
"""Pytest configuration: make the repo root importable and provide a shared QApplication.

A single QApplication must exist for the whole test session; creating more than one
in a process aborts. GUI-touching tests use the `qapp` fixture; pure-logic tests do
not need it.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

# Headless-safe Qt platform for CI / sandbox. A real desktop overrides this.
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")


@pytest.fixture(scope="session")
def qapp():
    from PySide6.QtWidgets import QApplication

    app = QApplication.instance() or QApplication([])
    yield app
```

- [ ] **Step 5: Verify pytest collects nothing yet (harness works)**

Run:
```bash
python -m pytest -q
```
Expected: `no tests ran` (exit code 5 is fine) — confirms collection works with no errors.

- [ ] **Step 6: Commit**

```bash
git add conftest.py tests/__init__.py slickshot/
git commit -m "chore: scaffold slickshot package + pytest harness; install PySide6"
```

---

## Task 1: `pyproject.toml`

**Files:**
- Create: `pyproject.toml`
- Modify: `requirements.txt`

**Depends on:** Task 0.

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "slickshot"
version = "2.0.0.dev0"
description = "Fast, private, local-first Windows screenshot tool"
requires-python = ">=3.11"
dependencies = [
    "PySide6>=6.6",
]

[project.optional-dependencies]
dev = ["pytest>=8"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"

[tool.setuptools.packages.find]
include = ["slickshot*"]
```

- [ ] **Step 2: Update `requirements.txt`**

Replace its entire contents with:
```text
PySide6>=6.6
```
(The legacy `slickshot.py` still imports PyQt5, which remains installed locally; we no longer pin it as a project dependency because Tier 0 targets PySide6. PyQt5 stays present until Task 18.)

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml requirements.txt
git commit -m "chore: add pyproject.toml, set PySide6 as the project dependency"
```

---

# WAVE A — independent pure-logic & leaf modules (parallelizable)

> All Wave A tasks are unit-testable with no GUI. A workflow may dispatch Task 2 first, then fan out 3–10. Each is committed independently.

## Task 2: `config/paths.py` — app data directories

**Files:**
- Create: `slickshot/config/paths.py`
- Test: `tests/test_paths.py`

**Depends on:** Task 0.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_paths.py
import os
from pathlib import Path

from slickshot.config import paths


def test_app_dir_under_appdata(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    assert paths.app_dir() == tmp_path / "SlickShot"


def test_app_dir_falls_back_when_no_appdata(monkeypatch, tmp_path):
    monkeypatch.delenv("APPDATA", raising=False)
    monkeypatch.setattr(paths.Path, "home", classmethod(lambda cls: tmp_path))
    assert paths.app_dir() == tmp_path / ".slickshot"


def test_ensure_dirs_creates_all(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    paths.ensure_dirs()
    assert paths.app_dir().is_dir()
    assert paths.staging_dir().is_dir()
    assert paths.history_dir().is_dir()
    assert paths.log_path().parent.is_dir()


def test_default_save_dir_is_documents_screenshots(monkeypatch, tmp_path):
    monkeypatch.setattr(paths.Path, "home", classmethod(lambda cls: tmp_path))
    assert paths.default_save_dir() == tmp_path / "Documents" / "screenshots"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_paths.py -v`
Expected: FAIL with `ModuleNotFoundError` / `AttributeError: module 'slickshot.config.paths' has no attribute ...`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/config/paths.py
"""Filesystem locations for SlickShot. All app state lives under %APPDATA%/SlickShot.

Captured screenshots default to ~/Documents/screenshots (matching the legacy app),
but the save directory is user-configurable via settings (see config.settings).
"""
from __future__ import annotations

import os
from pathlib import Path

_APP_FOLDER = "SlickShot"


def app_dir() -> Path:
    """Root directory for SlickShot state. %APPDATA%/SlickShot, or ~/.slickshot."""
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata) / _APP_FOLDER
    return Path.home() / ".slickshot"


def staging_dir() -> Path:
    """Temp directory for staged PNGs that can be dragged to other apps."""
    return app_dir() / "staging"


def history_dir() -> Path:
    """Directory where the capture-history library stores images (later tiers)."""
    return app_dir() / "history"


def log_path() -> Path:
    """Path to the rotating log file."""
    return app_dir() / "log.txt"


def settings_path() -> Path:
    """Path to the JSON settings file."""
    return app_dir() / "settings.json"


def default_save_dir() -> Path:
    """Default folder for saved screenshots (user-overridable)."""
    return Path.home() / "Documents" / "screenshots"


def ensure_dirs() -> None:
    """Create all app directories if missing. Safe to call repeatedly."""
    for d in (app_dir(), staging_dir(), history_dir()):
        d.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_paths.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/config/paths.py tests/test_paths.py
git commit -m "feat(config): app data directory layout under %APPDATA%/SlickShot"
```

---

## Task 3: `config/filenames.py` — filename patterns & collision-free naming

**Files:**
- Create: `slickshot/config/filenames.py`
- Test: `tests/test_filenames.py`

**Depends on:** Task 2.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_filenames.py
from datetime import datetime

from slickshot.config import filenames


FIXED = datetime(2026, 6, 3, 14, 5, 9)


def test_expand_basic_tokens():
    out = filenames.expand_pattern("shot_%Y%M%D_%h%m%s", when=FIXED, window="", counter=1)
    assert out == "shot_20260603_140509"


def test_expand_window_token_sanitized():
    out = filenames.expand_pattern("%window%", when=FIXED, window='Notepad: a/b*c?.txt', counter=1)
    # illegal filename chars removed/replaced
    assert "/" not in out and "*" not in out and "?" not in out
    assert out.startswith("Notepad")


def test_expand_counter_token_padded():
    out = filenames.expand_pattern("image%counter%", when=FIXED, window="", counter=7)
    assert out == "image0007"


def test_next_available_name_skips_existing(tmp_path):
    (tmp_path / "image0001.png").write_bytes(b"x")
    (tmp_path / "image0002.png").write_bytes(b"x")
    name = filenames.next_available_name(tmp_path, "image%counter%", "png", when=FIXED, window="")
    assert name == "image0003.png"


def test_next_available_name_unique_when_no_counter(tmp_path):
    # pattern without %counter%: first use is bare, then _2, _3 on collision
    (tmp_path / "shot.png").write_bytes(b"x")
    name = filenames.next_available_name(tmp_path, "shot", "png", when=FIXED, window="")
    assert name == "shot_2.png"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_filenames.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/config/filenames.py
"""Filename pattern expansion and collision-free naming for saved captures.

Supported tokens (case-sensitive):
  %Y year(4)  %M month(2)  %D day(2)  %h hour(2)  %m minute(2)  %s second(2)
  %window%  active window title (sanitized)
  %counter% zero-padded 4-digit counter
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

_ILLEGAL = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _sanitize(title: str) -> str:
    cleaned = _ILLEGAL.sub("_", title).strip().rstrip(". ")
    return cleaned[:60] or "window"


def expand_pattern(pattern: str, *, when: datetime, window: str, counter: int) -> str:
    """Expand tokens in `pattern`. Does not add an extension."""
    result = pattern
    result = result.replace("%window%", _sanitize(window) if window else "window")
    result = result.replace("%counter%", f"{counter:04d}")
    replacements = {
        "%Y": f"{when.year:04d}", "%M": f"{when.month:02d}", "%D": f"{when.day:02d}",
        "%h": f"{when.hour:02d}", "%m": f"{when.minute:02d}", "%s": f"{when.second:02d}",
    }
    for token, value in replacements.items():
        result = result.replace(token, value)
    return result


def next_available_name(
    directory: Path, pattern: str, ext: str, *, when: datetime, window: str
) -> str:
    """Return a filename (with extension) that does not yet exist in `directory`.

    If the pattern contains %counter%, increment the counter until free.
    Otherwise append _2, _3, ... on collision.
    """
    ext = ext.lstrip(".")
    if "%counter%" in pattern:
        counter = 1
        while True:
            stem = expand_pattern(pattern, when=when, window=window, counter=counter)
            candidate = directory / f"{stem}.{ext}"
            if not candidate.exists():
                return candidate.name
            counter += 1
    stem = expand_pattern(pattern, when=when, window=window, counter=1)
    candidate = directory / f"{stem}.{ext}"
    if not candidate.exists():
        return candidate.name
    n = 2
    while True:
        candidate = directory / f"{stem}_{n}.{ext}"
        if not candidate.exists():
            return candidate.name
        n += 1
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_filenames.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/config/filenames.py tests/test_filenames.py
git commit -m "feat(config): filename pattern expansion + collision-free naming"
```

---

## Task 4: `config/settings.py` — JSON settings store

**Files:**
- Create: `slickshot/config/settings.py`
- Test: `tests/test_settings.py`

**Depends on:** Task 2.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_settings.py
from slickshot.config import settings as settings_mod


def _fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    return settings_mod.Settings.load()


def test_defaults_present(monkeypatch, tmp_path):
    s = _fresh(monkeypatch, tmp_path)
    assert s.get("hotkey") == "alt+shift+4"
    assert s.get("filename_pattern") == "image%counter%"
    assert s.get("hold_b_enabled") is True
    assert s.get("hold_delay_ms") == 400


def test_set_and_persist_roundtrip(monkeypatch, tmp_path):
    s = _fresh(monkeypatch, tmp_path)
    s.set("hold_delay_ms", 250)
    s.save()
    s2 = settings_mod.Settings.load()
    assert s2.get("hold_delay_ms") == 250


def test_unknown_key_returns_default_arg(monkeypatch, tmp_path):
    s = _fresh(monkeypatch, tmp_path)
    assert s.get("does_not_exist", "fallback") == "fallback"


def test_corrupt_file_falls_back_to_defaults(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    path = settings_mod.paths.settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{ not json", encoding="utf-8")
    s = settings_mod.Settings.load()  # must not raise
    assert s.get("hotkey") == "alt+shift+4"


def test_unknown_keys_in_file_are_preserved_but_defaults_fill_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    path = settings_mod.paths.settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('{"hold_delay_ms": 999}', encoding="utf-8")
    s = settings_mod.Settings.load()
    assert s.get("hold_delay_ms") == 999          # value from file wins
    assert s.get("filename_pattern") == "image%counter%"  # missing key filled from defaults
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_settings.py -v`
Expected: FAIL with `ModuleNotFoundError` / `AttributeError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/config/settings.py
"""Typed JSON settings store. Defaults are the source of truth for known keys;
values present in the file override defaults, missing keys are filled from defaults,
and a corrupt file degrades gracefully to defaults.
"""
from __future__ import annotations

import json
from typing import Any

from . import paths

DEFAULTS: dict[str, Any] = {
    # capture / hotkey
    "hotkey": "alt+shift+4",
    "save_dir": "",                       # "" => paths.default_save_dir()
    "filename_pattern": "image%counter%",
    "image_format": "png",
    # hold-B radial menu (Tier 1 feature; settings seeded now)
    "hold_b_enabled": True,
    "hold_b_trigger_key": "b",
    "hold_delay_ms": 400,
    "hold_b_safe_retract": True,
    "hold_b_pause_while_gaming": True,
    # housekeeping
    "staging_ttl_hours": 24,
    "theme": "prism",
}


class Settings:
    def __init__(self, data: dict[str, Any]):
        self._data = data

    @classmethod
    def load(cls) -> "Settings":
        data = dict(DEFAULTS)
        path = paths.settings_path()
        try:
            if path.exists():
                loaded = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    data.update(loaded)
        except (json.JSONDecodeError, OSError):
            pass  # keep defaults
        return cls(data)

    def get(self, key: str, default: Any = None) -> Any:
        if key in self._data:
            return self._data[key]
        if key in DEFAULTS:
            return DEFAULTS[key]
        return default

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value

    def save(self) -> None:
        paths.ensure_dirs()
        tmp = paths.settings_path().with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        tmp.replace(paths.settings_path())  # atomic on Windows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_settings.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/config/settings.py tests/test_settings.py
git commit -m "feat(config): JSON settings store with defaults, merge, atomic save"
```

---

## Task 5: `util/logging_setup.py` — structured logging

**Files:**
- Create: `slickshot/util/logging_setup.py`
- Test: `tests/test_logging_setup.py`

**Depends on:** Task 2.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_logging_setup.py
import logging

from slickshot.util import logging_setup


def test_get_logger_writes_to_log_file(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    logging_setup.reset()  # clear any handlers from a prior test
    log = logging_setup.get_logger("test")
    log.info("hello-world-marker")
    for h in logging.getLogger("slickshot").handlers:
        h.flush()
    from slickshot.config import paths
    content = paths.log_path().read_text(encoding="utf-8")
    assert "hello-world-marker" in content
    assert "INFO" in content


def test_idempotent_no_duplicate_handlers(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    logging_setup.reset()
    logging_setup.get_logger("a")
    logging_setup.get_logger("b")
    handlers = logging.getLogger("slickshot").handlers
    # exactly one file handler regardless of how many child loggers requested
    file_handlers = [h for h in handlers if isinstance(h, logging.FileHandler)]
    assert len(file_handlers) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_logging_setup.py -v`
Expected: FAIL with `ModuleNotFoundError` / missing `reset`/`get_logger`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/util/logging_setup.py
"""Structured logging to %APPDATA%/SlickShot/log.txt.

All modules call get_logger(__name__); the root 'slickshot' logger owns a single
rotating file handler so failures are diagnosable instead of silent.
"""
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from slickshot.config import paths

_ROOT = "slickshot"
_configured = False


def _configure() -> None:
    global _configured
    paths.ensure_dirs()
    root = logging.getLogger(_ROOT)
    root.setLevel(logging.INFO)
    handler = RotatingFileHandler(
        paths.log_path(), maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    root.addHandler(handler)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the 'slickshot' root, configuring once."""
    if not _configured:
        _configure()
    short = name.split(".")[-1]
    return logging.getLogger(f"{_ROOT}.{short}")


def reset() -> None:
    """Tear down handlers (test helper; lets a new APPDATA take effect)."""
    global _configured
    root = logging.getLogger(_ROOT)
    for h in list(root.handlers):
        h.close()
        root.removeHandler(h)
    _configured = False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_logging_setup.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/util/logging_setup.py tests/test_logging_setup.py
git commit -m "feat(util): structured rotating-file logging"
```

---

## Task 6: `capture/screens.py` — multi-monitor geometry & DPR math

**Files:**
- Create: `slickshot/capture/screens.py`
- Test: `tests/test_screens.py`

**Depends on:** Task 0.

> This task isolates the **pure math** of mapping a virtual-desktop layout (each monitor's geometry + device-pixel-ratio) into the rectangles we capture, so it is testable without a real multi-monitor rig. The actual `QScreen` grab lives in Task 11 and consumes these helpers.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_screens.py
from slickshot.capture import screens
from slickshot.capture.screens import MonitorInfo


def test_virtual_bounds_union():
    mons = [
        MonitorInfo(name="A", x=0, y=0, width=1920, height=1080, dpr=1.0),
        MonitorInfo(name="B", x=1920, y=-200, width=2560, height=1440, dpr=1.5),
    ]
    x, y, w, h = screens.virtual_bounds(mons)
    assert (x, y) == (0, -200)
    assert w == 1920 + 2560
    assert h == 1440 + 200  # from y=-200 down to y=1080  => 1280? check below


def test_virtual_bounds_single():
    mons = [MonitorInfo(name="A", x=0, y=0, width=1280, height=720, dpr=1.0)]
    assert screens.virtual_bounds(mons) == (0, 0, 1280, 720)


def test_monitor_at_point():
    mons = [
        MonitorInfo(name="A", x=0, y=0, width=1920, height=1080, dpr=1.0),
        MonitorInfo(name="B", x=1920, y=0, width=2560, height=1440, dpr=1.5),
    ]
    assert screens.monitor_at(mons, 100, 100).name == "A"
    assert screens.monitor_at(mons, 2000, 100).name == "B"
    # point outside all monitors -> nearest by clamping returns something non-None
    assert screens.monitor_at(mons, 99999, 0).name == "B"


def test_device_pixels_for_logical_rect():
    m = MonitorInfo(name="B", x=1920, y=0, width=2560, height=1440, dpr=1.5)
    # a logical 100x100 region at the monitor origin maps to 150x150 device px
    dev = screens.to_device_rect(m, lx=1920, ly=0, lw=100, lh=100)
    assert dev == (0, 0, 150, 150)  # offset is relative to the monitor, scaled by dpr
```

Note: fix the first test's expected height — the union spans y=-200..(0+1080)=1080 **and** y=0..(1440-200)=1240; the lowest top is -200 and the greatest bottom is max(0+1080, -200+1440)=1240, so height = 1240-(-200) = 1440. Use this corrected assertion:

```python
    assert h == 1440
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_screens.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/capture/screens.py
"""Pure geometry helpers for multi-monitor, HiDPI-correct capture.

Qt gives us, per QScreen: geometry() in *logical* virtual-desktop coordinates and
devicePixelRatio(). These helpers compute the union virtual bounds, find the monitor
under a point, and convert a logical rect into device pixels relative to a monitor.
Kept free of Qt imports so they unit-test anywhere.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MonitorInfo:
    name: str
    x: int
    y: int
    width: int
    height: int
    dpr: float


def virtual_bounds(monitors: list[MonitorInfo]) -> tuple[int, int, int, int]:
    """Union bounding box (x, y, w, h) of all monitors in logical coords."""
    left = min(m.x for m in monitors)
    top = min(m.y for m in monitors)
    right = max(m.x + m.width for m in monitors)
    bottom = max(m.y + m.height for m in monitors)
    return left, top, right - left, bottom - top


def monitor_at(monitors: list[MonitorInfo], px: int, py: int) -> MonitorInfo:
    """Monitor containing (px, py); if none, the one whose center is nearest."""
    for m in monitors:
        if m.x <= px < m.x + m.width and m.y <= py < m.y + m.height:
            return m
    def dist2(m: MonitorInfo) -> float:
        cx, cy = m.x + m.width / 2, m.y + m.height / 2
        return (cx - px) ** 2 + (cy - py) ** 2
    return min(monitors, key=dist2)


def to_device_rect(
    m: MonitorInfo, *, lx: int, ly: int, lw: int, lh: int
) -> tuple[int, int, int, int]:
    """Convert a logical rect to device pixels relative to monitor `m`'s origin."""
    rel_x = int(round((lx - m.x) * m.dpr))
    rel_y = int(round((ly - m.y) * m.dpr))
    return rel_x, rel_y, int(round(lw * m.dpr)), int(round(lh * m.dpr))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_screens.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/capture/screens.py tests/test_screens.py
git commit -m "feat(capture): multi-monitor virtual-geometry + DPR math"
```

---

## Task 7: `capture/cleanup.py` — stale staging cleanup

**Files:**
- Create: `slickshot/capture/cleanup.py`
- Test: `tests/test_cleanup.py`

**Depends on:** Task 2.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cleanup.py
import os
import time

from slickshot.capture import cleanup


def test_removes_only_stale_png(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    from slickshot.config import paths
    paths.ensure_dirs()
    staging = paths.staging_dir()

    old = staging / "old.png"
    new = staging / "new.png"
    other = staging / "keep.txt"
    for p in (old, new, other):
        p.write_bytes(b"x")

    old_time = time.time() - 60 * 60 * 48  # 48h ago
    os.utime(old, (old_time, old_time))

    removed = cleanup.clean_staging(ttl_hours=24)
    assert old.name in removed
    assert not old.exists()
    assert new.exists()       # recent -> kept
    assert other.exists()     # non-png -> untouched


def test_handles_missing_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("APPDATA", str(tmp_path / "nope"))
    # staging dir does not exist; must not raise, returns []
    assert cleanup.clean_staging(ttl_hours=24) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_cleanup.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/capture/cleanup.py
"""Delete stale staged PNGs on startup. Fixes the legacy app's leak of .tmp files."""
from __future__ import annotations

import time
from pathlib import Path

from slickshot.config import paths


def clean_staging(ttl_hours: int = 24) -> list[str]:
    """Remove *.png in the staging dir older than ttl_hours. Returns removed names."""
    staging = paths.staging_dir()
    if not staging.is_dir():
        return []
    cutoff = time.time() - ttl_hours * 3600
    removed: list[str] = []
    for entry in staging.glob("*.png"):
        try:
            if entry.stat().st_mtime < cutoff:
                entry.unlink()
                removed.append(entry.name)
        except OSError:
            continue
    return removed
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_cleanup.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/capture/cleanup.py tests/test_cleanup.py
git commit -m "feat(capture): startup cleanup of stale staging PNGs"
```

---

## Task 8: `util/images.py` — image helpers & pixelate primitive

**Files:**
- Create: `slickshot/util/images.py`
- Test: `tests/test_images.py`

**Depends on:** Task 0. Uses PySide6 `QImage` (the `qapp` fixture is **not** required — `QImage` works without a running QApplication).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_images.py
from PySide6.QtGui import QImage, QColor

from slickshot.util import images


def _solid(w, h, color):
    img = QImage(w, h, QImage.Format.Format_ARGB32)
    img.fill(QColor(color))
    return img


def test_pixelate_region_changes_pixels_but_keeps_size():
    img = _solid(40, 40, "white")
    # paint a gradient-ish pattern so pixelation is observable
    for x in range(40):
        for y in range(40):
            img.setPixelColor(x, y, QColor(x * 6 % 256, y * 6 % 256, 0))
    out = images.pixelate_region(img, 0, 0, 40, 40, block=8)
    assert out.size() == img.size()
    # within a single block, all pixels equal the block's averaged color
    c0 = out.pixelColor(0, 0)
    c1 = out.pixelColor(7, 7)
    assert c0 == c1


def test_pixelate_region_out_of_bounds_is_clamped():
    img = _solid(20, 20, "red")
    out = images.pixelate_region(img, 10, 10, 999, 999, block=4)  # must not raise
    assert out.size() == img.size()


def test_qimage_qpixmap_roundtrip(qapp):
    img = _solid(10, 10, "blue")
    pix = images.to_pixmap(img)
    back = images.to_image(pix)
    assert back.pixelColor(5, 5) == QColor("blue")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_images.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/util/images.py
"""Image helpers shared across capture/editor: QImage<->QPixmap and a pixelate
primitive used by the redaction annotation (Task 10) and later tiers.
"""
from __future__ import annotations

from PySide6.QtGui import QImage, QPixmap, QColor


def to_pixmap(img: QImage) -> QPixmap:
    return QPixmap.fromImage(img)


def to_image(pix: QPixmap) -> QImage:
    return pix.toImage()


def pixelate_region(img: QImage, x: int, y: int, w: int, h: int, *, block: int = 12) -> QImage:
    """Return a copy of `img` with the given rect pixelated in `block`-sized cells.

    Each block is filled with the average color of its pixels. The rect is clamped
    to the image bounds. This is the irreversible primitive behind redaction export.
    """
    out = img.convertToFormat(QImage.Format.Format_ARGB32)
    x0 = max(0, x)
    y0 = max(0, y)
    x1 = min(img.width(), x + w)
    y1 = min(img.height(), y + h)
    by = y0
    while by < y1:
        bx = x0
        while bx < x1:
            ex = min(bx + block, x1)
            ey = min(by + block, y1)
            r = g = b = a = count = 0
            for px in range(bx, ex):
                for py in range(by, ey):
                    c = out.pixelColor(px, py)
                    r += c.red(); g += c.green(); b += c.blue(); a += c.alpha()
                    count += 1
            if count:
                avg = QColor(r // count, g // count, b // count, a // count)
                for px in range(bx, ex):
                    for py in range(by, ey):
                        out.setPixelColor(px, py, avg)
            bx += block
        by += block
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_images.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/util/images.py tests/test_images.py
git commit -m "feat(util): QImage/QPixmap helpers + pixelate primitive"
```

---

## Task 9: `editor/document.py` — non-destructive Document + flatten()

**Files:**
- Create: `slickshot/editor/document.py`
- Test: `tests/test_document.py`

**Depends on:** Task 0. (The keystone model from the spec §2a.)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_document.py
from PySide6.QtGui import QImage, QColor, QPainter

from slickshot.editor.document import Document


class _FakeAnnotation:
    """Minimal annotation: fills a rect with a color when painted."""
    def __init__(self, x, y, w, h, color):
        self.rect = (x, y, w, h)
        self.color = color
        self.z = 0

    def paint(self, painter: QPainter) -> None:
        x, y, w, h = self.rect
        painter.fillRect(x, y, w, h, QColor(self.color))


def _base(w=20, h=20, color="white"):
    img = QImage(w, h, QImage.Format.Format_ARGB32)
    img.fill(QColor(color))
    return img


def test_flatten_without_annotations_equals_base():
    doc = Document(_base())
    out = doc.flatten()
    assert out.size() == doc.base_image.size()
    assert out.pixelColor(0, 0) == QColor("white")


def test_flatten_applies_annotation_pixels():
    doc = Document(_base())
    doc.add(_FakeAnnotation(0, 0, 10, 10, "black"))
    out = doc.flatten()
    assert out.pixelColor(5, 5) == QColor("black")     # inside annotation
    assert out.pixelColor(15, 15) == QColor("white")   # outside


def test_flatten_does_not_mutate_base():
    doc = Document(_base())
    doc.add(_FakeAnnotation(0, 0, 20, 20, "black"))
    doc.flatten()
    # base image is untouched: a fresh flatten with annotations removed is white
    doc.clear()
    assert doc.flatten().pixelColor(5, 5) == QColor("white")


def test_z_order_later_paints_on_top():
    doc = Document(_base())
    bottom = _FakeAnnotation(0, 0, 20, 20, "red"); bottom.z = 0
    top = _FakeAnnotation(0, 0, 20, 20, "green"); top.z = 5
    doc.add(top)      # add out of order
    doc.add(bottom)
    out = doc.flatten()
    assert out.pixelColor(10, 10) == QColor("green")  # higher z wins


def test_undo_redo_via_stack():
    doc = Document(_base())
    doc.add(_FakeAnnotation(0, 0, 20, 20, "black"))
    assert len(doc.annotations) == 1
    doc.undo()
    assert len(doc.annotations) == 0
    doc.redo()
    assert len(doc.annotations) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_document.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/editor/document.py
"""The non-destructive editor model (spec §2a).

A Document holds an untouched base QImage and an ordered list of annotation objects.
Nothing mutates base pixels until flatten(), which composites base + annotations
(in z-order) into a NEW QImage. flatten() is the ONLY pixel-export path, so redaction
baked by a redaction annotation is irreversible in the output.

Undo/redo is a simple add/remove history here; Tier 2 will migrate to QUndoStack with
richer commands, but the public surface (add/clear/undo/redo/annotations) stays stable.
"""
from __future__ import annotations

from typing import Protocol

from PySide6.QtGui import QImage, QPainter


class Annotation(Protocol):
    z: int
    def paint(self, painter: QPainter) -> None: ...


class Document:
    def __init__(self, base_image: QImage):
        self.base_image = base_image
        self.annotations: list[Annotation] = []
        self._redo: list[Annotation] = []

    def add(self, annotation: Annotation) -> None:
        self.annotations.append(annotation)
        self._redo.clear()

    def clear(self) -> None:
        self.annotations.clear()
        self._redo.clear()

    def undo(self) -> None:
        if self.annotations:
            self._redo.append(self.annotations.pop())

    def redo(self) -> None:
        if self._redo:
            self.annotations.append(self._redo.pop())

    def flatten(self) -> QImage:
        """Composite base + annotations (ascending z) into a new ARGB32 image."""
        out = self.base_image.convertToFormat(QImage.Format.Format_ARGB32)
        painter = QPainter(out)
        try:
            for ann in sorted(self.annotations, key=lambda a: getattr(a, "z", 0)):
                ann.paint(painter)
        finally:
            painter.end()
        return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_document.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/editor/document.py tests/test_document.py
git commit -m "feat(editor): non-destructive Document model with flatten + undo/redo"
```

---

## Task 10: `editor/annotations.py` — Annotation base + pixelate redaction seed

**Files:**
- Create: `slickshot/editor/annotations.py`
- Test: `tests/test_annotations.py`

**Depends on:** Task 9, Task 8.

> Seeds the annotation hierarchy with the base class and the **redaction** annotation (the privacy-critical one), proving the `Document` interface end-to-end. Tier 2 adds arrow/rect/text/etc. as siblings.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_annotations.py
from PySide6.QtGui import QImage, QColor

from slickshot.editor.document import Document
from slickshot.editor.annotations import PixelateRedaction


def _patterned(w=32, h=32):
    img = QImage(w, h, QImage.Format.Format_ARGB32)
    for x in range(w):
        for y in range(h):
            img.setPixelColor(x, y, QColor((x * 8) % 256, (y * 8) % 256, 128))
    return img


def test_pixelate_redaction_is_irreversible_in_flatten():
    base = _patterned()
    doc = Document(base)
    doc.add(PixelateRedaction(4, 4, 16, 16, block=8))
    out = doc.flatten()
    # within one block of the redacted area, pixels are uniform (detail destroyed)
    assert out.pixelColor(4, 4) == out.pixelColor(11, 11)
    # base image still holds original detail (flatten didn't mutate it)
    assert base.pixelColor(4, 4) != base.pixelColor(11, 11)


def test_redaction_outside_region_untouched():
    base = _patterned()
    doc = Document(base)
    doc.add(PixelateRedaction(0, 0, 8, 8, block=8))
    out = doc.flatten()
    assert out.pixelColor(20, 20) == base.pixelColor(20, 20)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_annotations.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/editor/annotations.py
"""Annotation hierarchy. Tier 0 seeds the base class + the redaction annotation
(privacy-critical). Tier 2 adds arrow/rect/ellipse/text/highlighter/counter siblings.

Each annotation paints itself onto the flatten painter. The redaction annotation
pixelates the *current* pixels under its rect, so once flattened the source detail
is gone from the exported image.
"""
from __future__ import annotations

from PySide6.QtGui import QPainter, QImage

from slickshot.util import images


class Annotation:
    """Base annotation. z controls paint order (higher = on top)."""
    def __init__(self, z: int = 0):
        self.z = z

    def paint(self, painter: QPainter) -> None:  # pragma: no cover - abstract
        raise NotImplementedError


class PixelateRedaction(Annotation):
    def __init__(self, x: int, y: int, w: int, h: int, *, block: int = 12, z: int = 100):
        super().__init__(z=z)
        self.x, self.y, self.w, self.h = x, y, w, h
        self.block = block

    def paint(self, painter: QPainter) -> None:
        device = painter.device()
        if not isinstance(device, QImage):
            return
        pixelated = images.pixelate_region(
            device, self.x, self.y, self.w, self.h, block=self.block
        )
        x0 = max(0, self.x)
        y0 = max(0, self.y)
        x1 = min(device.width(), self.x + self.w)
        y1 = min(device.height(), self.y + self.h)
        painter.drawImage(x0, y0, pixelated, x0, y0, x1 - x0, y1 - y0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_annotations.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/editor/annotations.py tests/test_annotations.py
git commit -m "feat(editor): annotation base + irreversible pixelate redaction"
```

- [ ] **Step 6: Wave A gate — run the full suite**

Run: `python -m pytest -q`
Expected: all tests from Tasks 2–10 PASS. This is the merge gate for Wave A.

---

# WAVE B — systems modules (parallelizable)

## Task 11: `capture/grab.py` — multi-monitor capture

**Files:**
- Create: `slickshot/capture/grab.py`
- Test: `tests/test_grab.py`

**Depends on:** Task 6, Task 8. Requires the `qapp` fixture (needs QGuiApplication for screen enumeration). On a headless/offscreen platform there are no real screens, so the test exercises the **enumeration + fallback** path, not actual pixels.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_grab.py
from slickshot.capture import grab
from slickshot.capture.screens import MonitorInfo


def test_monitors_from_qt_returns_list(qapp):
    mons = grab.enumerate_monitors()
    assert isinstance(mons, list)
    # offscreen platform may report 0 or 1; just assert the type contract
    for m in mons:
        assert isinstance(m, MonitorInfo)


def test_capture_all_returns_none_when_no_screens(qapp, monkeypatch):
    monkeypatch.setattr(grab, "enumerate_monitors", lambda: [])
    assert grab.capture_all() is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_grab.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/capture/grab.py
"""Multi-monitor, HiDPI-correct screen capture built on QScreen.grabWindow.

enumerate_monitors() reads each QScreen's logical geometry + devicePixelRatio.
capture_all() grabs every screen at its native device resolution and composites
them into one QImage spanning the virtual desktop, so secondary and scaled monitors
are captured sharply (fixing the legacy primary-only grab).
"""
from __future__ import annotations

from PySide6.QtGui import QGuiApplication, QImage, QPainter

from slickshot.capture import screens
from slickshot.capture.screens import MonitorInfo
from slickshot.util import logging_setup

log = logging_setup.get_logger(__name__)


def enumerate_monitors() -> list[MonitorInfo]:
    result: list[MonitorInfo] = []
    for s in QGuiApplication.screens():
        g = s.geometry()
        result.append(
            MonitorInfo(
                name=s.name() or f"screen{len(result)}",
                x=g.x(), y=g.y(), width=g.width(), height=g.height(),
                dpr=s.devicePixelRatio(),
            )
        )
    return result


def capture_all() -> QImage | None:
    """Grab all monitors into one device-resolution QImage, or None if no screens."""
    monitors = enumerate_monitors()
    if not monitors:
        log.warning("capture_all: no screens reported")
        return None

    vx, vy, vw, vh = screens.virtual_bounds(monitors)
    max_dpr = max(m.dpr for m in monitors)
    canvas = QImage(int(vw * max_dpr), int(vh * max_dpr), QImage.Format.Format_ARGB32)
    canvas.fill(0)
    painter = QPainter(canvas)
    try:
        qscreens = {s.name(): s for s in QGuiApplication.screens()}
        for m in monitors:
            s = qscreens.get(m.name)
            if s is None:
                continue
            shot = s.grabWindow(0).toImage()  # native device pixels for this screen
            dst_x = int((m.x - vx) * max_dpr)
            dst_y = int((m.y - vy) * max_dpr)
            painter.drawImage(dst_x, dst_y, shot)
    finally:
        painter.end()
    return canvas
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_grab.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Manual test (user, real desktop)**

Create a throwaway `scratch_grab.py`:
```python
from PySide6.QtWidgets import QApplication
from slickshot.capture import grab
app = QApplication([])
img = grab.capture_all()
img.save("scratch_all_monitors.png")
print("saved", img.size())
```
Run: `python scratch_grab.py`
Expected: `scratch_all_monitors.png` shows **all** monitors stitched, sharp on scaled displays. Delete the scratch file after.

- [ ] **Step 6: Commit**

```bash
git add slickshot/capture/grab.py tests/test_grab.py
git commit -m "feat(capture): multi-monitor HiDPI screen grab"
```

---

## Task 12: `hotkey/win_hotkey.py` — registered global hotkey

**Files:**
- Create: `slickshot/hotkey/win_hotkey.py`
- Test: `tests/test_win_hotkey.py`

**Depends on:** Task 4. Requires `qapp`. The registration round-trip needs a real Windows session; the unit test covers the **chord parser** (pure logic), and a manual test covers actual firing.

> NOTE: This is the *one-shot capture chord* (Alt+Shift+4), implemented with `RegisterHotKey` + a Qt native event filter. It is **separate** from the hold-B radial trigger (which uses a low-level hook, specced in the radial addendum §2 and scheduled in Tier 1). Tier 0 ships only this chord hotkey.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_win_hotkey.py
import pytest

from slickshot.hotkey import win_hotkey


def test_parse_chord_basic():
    mods, vk = win_hotkey.parse_chord("alt+shift+4")
    assert vk == 0x34  # '4'
    assert mods & win_hotkey.MOD_ALT
    assert mods & win_hotkey.MOD_SHIFT
    assert not (mods & win_hotkey.MOD_CONTROL)


def test_parse_chord_ctrl_letter():
    mods, vk = win_hotkey.parse_chord("ctrl+b")
    assert vk == ord("B")
    assert mods & win_hotkey.MOD_CONTROL


def test_parse_chord_function_key():
    mods, vk = win_hotkey.parse_chord("f9")
    assert vk == 0x78  # VK_F9
    assert mods == 0


def test_parse_chord_invalid_raises():
    with pytest.raises(ValueError):
        win_hotkey.parse_chord("alt+")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_win_hotkey.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/hotkey/win_hotkey.py
"""Global one-shot hotkey via Win32 RegisterHotKey + a Qt native event filter.

Replaces the legacy 100ms GetAsyncKeyState polling loop. Emits `triggered` when the
configured chord (default Alt+Shift+4) is pressed, with zero polling and no latency.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes

from PySide6.QtCore import QAbstractNativeEventFilter, QObject, Signal

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
_WM_HOTKEY = 0x0312
_HOTKEY_ID = 0xB001

_MOD_NAMES = {"alt": MOD_ALT, "ctrl": MOD_CONTROL, "control": MOD_CONTROL,
              "shift": MOD_SHIFT, "win": MOD_WIN, "super": MOD_WIN}
_FKEYS = {f"f{i}": 0x70 + (i - 1) for i in range(1, 13)}  # F1..F12 = 0x70..0x7B


def parse_chord(chord: str) -> tuple[int, int]:
    """Parse 'alt+shift+4' -> (modifier_mask, virtual_key_code). Raises ValueError."""
    parts = [p.strip().lower() for p in chord.split("+") if p.strip() != ""]
    if len(parts) != len([p for p in chord.split("+")]):
        raise ValueError(f"malformed chord: {chord!r}")
    if not parts:
        raise ValueError("empty chord")
    mods = 0
    key_part = None
    for p in parts:
        if p in _MOD_NAMES:
            mods |= _MOD_NAMES[p]
        else:
            key_part = p
    if key_part is None:
        raise ValueError(f"no key in chord: {chord!r}")
    if key_part in _FKEYS:
        return mods, _FKEYS[key_part]
    if len(key_part) == 1:
        return mods, ord(key_part.upper())
    raise ValueError(f"unsupported key: {key_part!r}")


class HotkeyFilter(QAbstractNativeEventFilter, QObject):
    triggered = Signal()

    def nativeEventFilter(self, event_type, message):  # type: ignore[override]
        if event_type == b"windows_generic_MSG":
            msg = wintypes.MSG.from_address(int(message))
            if msg.message == _WM_HOTKEY and msg.wParam == _HOTKEY_ID:
                self.triggered.emit()
        return False, 0


class GlobalHotkey(QObject):
    triggered = Signal()

    def __init__(self, chord: str):
        super().__init__()
        self._mods, self._vk = parse_chord(chord)
        self._filter = HotkeyFilter()
        self._filter.triggered.connect(self.triggered)
        self._registered = False

    def register(self) -> bool:
        from PySide6.QtWidgets import QApplication
        QApplication.instance().installNativeEventFilter(self._filter)
        ok = bool(ctypes.windll.user32.RegisterHotKey(
            None, _HOTKEY_ID, self._mods | 0x4000, self._vk  # 0x4000 = MOD_NOREPEAT
        ))
        self._registered = ok
        return ok

    def unregister(self) -> None:
        if self._registered:
            ctypes.windll.user32.UnregisterHotKey(None, _HOTKEY_ID)
            self._registered = False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_win_hotkey.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Manual test (user, real desktop)**

Scratch `scratch_hotkey.py`:
```python
from PySide6.QtWidgets import QApplication
from slickshot.hotkey.win_hotkey import GlobalHotkey
app = QApplication([])
hk = GlobalHotkey("alt+shift+4")
print("registered:", hk.register())
hk.triggered.connect(lambda: print("HOTKEY FIRED"))
app.exec()
```
Run it, press **Alt+Shift+4** in any app. Expected: `HOTKEY FIRED` prints each press, no machine-gun repeat. Ctrl+C to quit; delete scratch file.

- [ ] **Step 6: Commit**

```bash
git add slickshot/hotkey/win_hotkey.py tests/test_win_hotkey.py
git commit -m "feat(hotkey): registered global one-shot hotkey via RegisterHotKey"
```

---

# WAVE C — GUI shell (sequential; user manual-tests)

> These tasks wire the verified modules into a running app. They need an interactive Windows desktop. They are ordered and each depends on the previous. Unit tests here are smoke-level; the real verification is the manual steps.

## Task 13: `overlay/crop_overlay.py` — PySide6 crop overlay (multi-monitor)

**Files:**
- Create: `slickshot/overlay/crop_overlay.py`
- Test: `tests/test_crop_overlay.py`

**Depends on:** Task 11.

- [ ] **Step 1: Write the failing smoke test**

```python
# tests/test_crop_overlay.py
def test_crop_overlay_constructs(qapp):
    from slickshot.overlay.crop_overlay import CropOverlay
    captured = []
    ov = CropOverlay(on_region=lambda img: captured.append(img))
    assert ov is not None
    # selection-rect math is testable without showing the widget:
    from PySide6.QtCore import QRect, QPoint
    r = ov._normalized_rect(QPoint(30, 40), QPoint(10, 10))
    assert r == QRect(10, 10, 20, 30)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_crop_overlay.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/overlay/crop_overlay.py
"""Fullscreen dim-and-select overlay, ported to PySide6 and spanning all monitors.

Shows the frozen full-desktop capture darkened; the user drags a rectangle; on release
the selected region is cropped from the capture and handed to the on_region callback.
"""
from __future__ import annotations

from typing import Callable

from PySide6.QtCore import Qt, QRect, QPoint, QSize
from PySide6.QtGui import QPainter, QColor, QPixmap
from PySide6.QtWidgets import QWidget, QRubberBand

from slickshot.capture import grab, screens
from slickshot.util import logging_setup

log = logging_setup.get_logger(__name__)


class CropOverlay(QWidget):
    def __init__(self, on_region: Callable[[QPixmap], None]):
        super().__init__()
        self._on_region = on_region
        self._origin = QPoint()
        self._band: QRubberBand | None = None
        self._frozen: QPixmap | None = None
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setCursor(Qt.CursorShape.CrossCursor)

    @staticmethod
    def _normalized_rect(a: QPoint, b: QPoint) -> QRect:
        return QRect(a, b).normalized()

    def start(self) -> None:
        img = grab.capture_all()
        if img is None:
            log.error("CropOverlay.start: no capture")
            return
        self._frozen = QPixmap.fromImage(img)
        mons = grab.enumerate_monitors()
        vx, vy, vw, vh = screens.virtual_bounds(mons)
        self.setGeometry(vx, vy, vw, vh)
        self.showFullScreen()
        self.setGeometry(vx, vy, vw, vh)
        self.activateWindow()
        self.raise_()

    def paintEvent(self, event):
        if self._frozen is None:
            return
        p = QPainter(self)
        p.drawPixmap(self.rect(), self._frozen)
        p.fillRect(self.rect(), QColor(0, 0, 0, 110))
        if self._band and self._band.isVisible():
            r = self._band.geometry()
            p.drawPixmap(r, self._frozen, r)
            p.setPen(QColor(255, 255, 255, 220))
            p.drawRect(r.adjusted(0, 0, -1, -1))
        p.end()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self._origin = event.position().toPoint()
            if not self._band:
                self._band = QRubberBand(QRubberBand.Shape.Rectangle, self)
            self._band.setGeometry(QRect(self._origin, QSize()))
            self._band.show()

    def mouseMoveEvent(self, event):
        if self._band:
            self._band.setGeometry(self._normalized_rect(self._origin, event.position().toPoint()))
            self.update()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton and self._band:
            r = self._band.geometry()
            self._band.hide()
            self.hide()
            if r.width() > 5 and r.height() > 5 and self._frozen is not None:
                self._on_region(self._frozen.copy(r))

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape:
            self.hide()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_crop_overlay.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/overlay/crop_overlay.py tests/test_crop_overlay.py
git commit -m "feat(overlay): PySide6 multi-monitor crop overlay"
```

---

## Task 16: `preview/widget.py` — PySide6 preview widget

**Files:**
- Create: `slickshot/preview/widget.py`
- Test: `tests/test_preview_widget.py`

**Depends on:** Task 13 (shares Qt patterns), Task 2/3/4 (save path).

> Port the legacy `ScreenshotWidget` to PySide6: aspect-matched floating widget with Save/Copy/Edit/Delete/Close + OS file drag. Save uses `config.filenames` + `config.settings` (no more hard-coded path). Edit is wired to a stub that opens the `Document` (full editor is Tier 2); for Tier 0 "Edit" may simply be disabled/hidden behind a flag to avoid scope creep — keep the button but connect it to a no-op that logs "editor: Tier 2".

- [ ] **Step 1: Write the failing smoke test**

```python
# tests/test_preview_widget.py
def test_save_uses_pattern(monkeypatch, tmp_path, qapp):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    from PySide6.QtGui import QPixmap
    from slickshot.preview.widget import ScreenshotWidget

    saves = {}

    class _App:
        def remove_widget(self, w): saves["removed"] = True

    pix = QPixmap(20, 20)
    pix.fill()
    w = ScreenshotWidget(pix, _App(), save_dir=tmp_path, pattern="image%counter%", fmt="png")
    dest = w._compute_save_path()
    assert dest.name == "image0001.png"
    assert dest.parent == tmp_path
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_preview_widget.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/preview/widget.py
"""Floating preview widget (PySide6 port of the legacy ScreenshotWidget).

Shows the captured pixmap with Save / Copy / Edit / Delete / Close and OS file drag.
Save resolves its destination from config.settings (save_dir + filename_pattern),
fixing the legacy hard-coded path. Edit is a Tier-2 placeholder.
"""
from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, QSize, QTimer, QMimeData, QUrl, QPoint
from PySide6.QtGui import QPixmap, QPainter, QColor, QDrag
from PySide6.QtWidgets import QWidget, QPushButton, QVBoxLayout, QHBoxLayout

from slickshot.config import paths, filenames
from slickshot.util import logging_setup

log = logging_setup.get_logger(__name__)
WIDGET_SIZE = 450
DRAG_THRESHOLD = 5


class ScreenshotWidget(QWidget):
    def __init__(self, pixmap: QPixmap, app_ref, *, save_dir: Path, pattern: str, fmt: str):
        super().__init__()
        self._app = app_ref
        self._pixmap = pixmap
        self._save_dir = Path(save_dir)
        self._pattern = pattern
        self._fmt = fmt
        self._press_pos: QPoint | None = None

        paths.ensure_dirs()
        stamp = time.strftime("%Y%m%d_%H%M%S") + f"_{id(self) % 10000:04d}"
        self._temp_path = paths.staging_dir() / f"slickshot_{stamp}.png"
        self._pixmap.save(str(self._temp_path), "PNG")

        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        pw, ph = max(pixmap.width(), 1), max(pixmap.height(), 1)
        if pw >= ph:
            self._w, self._h = WIDGET_SIZE, max(int(WIDGET_SIZE * ph / pw), 200)
        else:
            self._h, self._w = WIDGET_SIZE, max(int(WIDGET_SIZE * pw / ph), 320)
        self.setFixedSize(self._w, self._h)
        self._build_buttons()
        self._move_bottom_left()

    def _build_buttons(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        row = QHBoxLayout()
        for name, slot in (("Save", self._save), ("Copy", self._copy),
                           ("Edit", self._edit), ("Del", self._delete)):
            b = QPushButton(name)
            b.setFixedHeight(60)
            b.clicked.connect(slot)
            row.addWidget(b)
        layout.addStretch()
        layout.addLayout(row)

    def _move_bottom_left(self) -> None:
        from PySide6.QtGui import QGuiApplication
        geo = QGuiApplication.primaryScreen().availableGeometry()
        self.move(geo.left() + 16, geo.bottom() - self.height() - 16)

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setBrush(QColor(30, 30, 30))
        p.setPen(QColor(80, 80, 80))
        p.drawRoundedRect(self.rect().adjusted(1, 1, -1, -1), 24, 24)
        scaled = self._pixmap.scaled(
            self.size() - QSize(12, 72),
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )
        x = (self.width() - scaled.width()) // 2
        p.drawPixmap(x, 8, scaled)
        p.end()

    def _compute_save_path(self) -> Path:
        self._save_dir.mkdir(parents=True, exist_ok=True)
        name = filenames.next_available_name(
            self._save_dir, self._pattern, self._fmt, when=datetime.now(), window=""
        )
        return self._save_dir / name

    def _save(self) -> None:
        dest = self._compute_save_path()
        if self._pixmap.save(str(dest), self._fmt.upper()):
            log.info("saved %s", dest)
            QTimer.singleShot(500, self._close)
        else:
            log.error("save failed: %s", dest)

    def _copy(self) -> None:
        from PySide6.QtWidgets import QApplication
        QApplication.clipboard().setPixmap(self._pixmap)
        log.info("copied to clipboard")

    def _edit(self) -> None:
        log.info("editor: Tier 2 (not yet implemented)")

    def _delete(self) -> None:
        self._cleanup()
        self._close()

    def _close(self) -> None:
        self._app.remove_widget(self)
        self.close()

    def _cleanup(self) -> None:
        try:
            if self._temp_path.exists():
                self._temp_path.unlink()
        except OSError:
            pass

    # --- OS file drag ---
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self._press_pos = event.globalPosition().toPoint()

    def mouseMoveEvent(self, event):
        if self._press_pos is not None:
            delta = event.globalPosition().toPoint() - self._press_pos
            if delta.manhattanLength() > DRAG_THRESHOLD:
                self._press_pos = None
                drag = QDrag(self)
                mime = QMimeData()
                mime.setUrls([QUrl.fromLocalFile(str(self._temp_path))])
                drag.setMimeData(mime)
                drag.setPixmap(self._pixmap.scaled(64, 64, Qt.AspectRatioMode.KeepAspectRatio))
                drag.exec(Qt.DropAction.CopyAction)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_preview_widget.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/preview/widget.py tests/test_preview_widget.py
git commit -m "feat(preview): PySide6 preview widget with settings-driven save"
```

---

## Task 17: `tray/tray_icon.py` — system tray

**Files:**
- Create: `slickshot/tray/tray_icon.py`
- Test: `tests/test_tray_icon.py`

**Depends on:** Task 16.

- [ ] **Step 1: Write the failing smoke test**

```python
# tests/test_tray_icon.py
def test_tray_builds_menu(qapp):
    from slickshot.tray.tray_icon import build_tray
    calls = {}
    tray = build_tray(
        on_capture=lambda: calls.setdefault("cap", True),
        on_settings=lambda: calls.setdefault("set", True),
        on_quit=lambda: calls.setdefault("quit", True),
    )
    actions = {a.text(): a for a in tray.contextMenu().actions() if a.text()}
    assert "Capture" in actions
    assert "Settings" in actions
    assert "Quit" in actions
    actions["Capture"].trigger()
    assert calls.get("cap") is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_tray_icon.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/tray/tray_icon.py
"""System tray icon + menu: Capture / Settings / Quit. Gives the headless app a
discoverable surface and a clean exit (the legacy app had neither)."""
from __future__ import annotations

from typing import Callable

from PySide6.QtGui import QIcon, QPixmap, QColor, QAction
from PySide6.QtWidgets import QSystemTrayIcon, QMenu


def _placeholder_icon() -> QIcon:
    pix = QPixmap(32, 32)
    pix.fill(QColor(40, 120, 220))
    return QIcon(pix)


def build_tray(
    *, on_capture: Callable[[], None], on_settings: Callable[[], None], on_quit: Callable[[], None]
) -> QSystemTrayIcon:
    tray = QSystemTrayIcon(_placeholder_icon())
    tray.setToolTip("SlickShot")
    menu = QMenu()
    cap = QAction("Capture", menu); cap.triggered.connect(on_capture); menu.addAction(cap)
    settings = QAction("Settings", menu); settings.triggered.connect(on_settings); menu.addAction(settings)
    menu.addSeparator()
    quit_a = QAction("Quit", menu); quit_a.triggered.connect(on_quit); menu.addAction(quit_a)
    tray.setContextMenu(menu)
    tray.activated.connect(
        lambda reason: on_capture() if reason == QSystemTrayIcon.ActivationReason.Trigger else None
    )
    return tray
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_tray_icon.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add slickshot/tray/tray_icon.py tests/test_tray_icon.py
git commit -m "feat(tray): system tray icon with Capture/Settings/Quit"
```

---

## Task 14: `slickshot_pyside/__main__.py` — new entry point

**Files:**
- Create: `slickshot_pyside/__init__.py` (empty)
- Create: `slickshot_pyside/__main__.py`

**Depends on:** Task 15 (imports `app.main`) — **build Task 15 first, then this.** (Listed here to keep entry-point files together; the orchestrator must order 15 before 14's step 3 runs.)

- [ ] **Step 1: Create `slickshot_pyside/__init__.py`** (empty file)

- [ ] **Step 2: Create `slickshot_pyside/__main__.py`**

```python
"""Entry point for the new PySide6 app:  python -m slickshot_pyside"""
from slickshot.app import main

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit**

```bash
git add slickshot_pyside/
git commit -m "feat: add `python -m slickshot_pyside` entry point"
```

---

## Task 15: `app.py` — application controller wiring it all together

**Files:**
- Create: `slickshot/app.py`
- Test: `tests/test_app.py`

**Depends on:** Tasks 4, 5, 7, 11, 12, 13, 16, 17.

- [ ] **Step 1: Write the failing smoke test**

```python
# tests/test_app.py
def test_controller_constructs_and_shows_widget(monkeypatch, tmp_path, qapp):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    from PySide6.QtGui import QPixmap
    from slickshot.app import SlickShotApp

    ctrl = SlickShotApp(install_hotkey=False, show_tray=False)
    assert ctrl.widgets == []
    pix = QPixmap(30, 30); pix.fill()
    ctrl.show_widget(pix)
    assert len(ctrl.widgets) == 1
    ctrl.widgets[0]._cleanup()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_app.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# slickshot/app.py
"""SlickShotApp controller: owns the QApplication, wires the hotkey -> overlay ->
preview flow, the tray, settings, logging, and startup cleanup.

`install_hotkey` and `show_tray` are injectable so tests can construct the controller
headlessly without registering OS hotkeys or a tray icon.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QPixmap

from slickshot.config import settings as settings_mod, paths
from slickshot.capture import cleanup
from slickshot.overlay.crop_overlay import CropOverlay
from slickshot.preview.widget import ScreenshotWidget
from slickshot.util import logging_setup

log = logging_setup.get_logger(__name__)


class SlickShotApp:
    def __init__(self, *, install_hotkey: bool = True, show_tray: bool = True):
        self.app = QApplication.instance() or QApplication(sys.argv)
        self.app.setQuitOnLastWindowClosed(False)
        self.settings = settings_mod.Settings.load()
        paths.ensure_dirs()
        removed = cleanup.clean_staging(self.settings.get("staging_ttl_hours", 24))
        if removed:
            log.info("cleaned %d stale staging files", len(removed))

        self.widgets: list[ScreenshotWidget] = []
        self._overlay = CropOverlay(on_region=self.show_widget)
        self._hotkey = None
        self._tray = None

        if install_hotkey:
            self._setup_hotkey()
        if show_tray:
            self._setup_tray()

    def _setup_hotkey(self) -> None:
        from slickshot.hotkey.win_hotkey import GlobalHotkey
        self._hotkey = GlobalHotkey(self.settings.get("hotkey", "alt+shift+4"))
        self._hotkey.triggered.connect(self.start_capture)
        if not self._hotkey.register():
            log.error("failed to register hotkey %s", self.settings.get("hotkey"))

    def _setup_tray(self) -> None:
        from slickshot.tray.tray_icon import build_tray
        self._tray = build_tray(
            on_capture=self.start_capture,
            on_settings=lambda: log.info("settings dialog: later tier"),
            on_quit=self.quit,
        )
        self._tray.show()

    def _save_params(self) -> tuple[Path, str, str]:
        raw = self.settings.get("save_dir", "")
        save_dir = Path(raw) if raw else paths.default_save_dir()
        return save_dir, self.settings.get("filename_pattern"), self.settings.get("image_format")

    def start_capture(self) -> None:
        self._overlay.start()

    def show_widget(self, pixmap: QPixmap) -> None:
        save_dir, pattern, fmt = self._save_params()
        w = ScreenshotWidget(pixmap, self, save_dir=save_dir, pattern=pattern, fmt=fmt)
        self.widgets.append(w)
        w.show()

    def remove_widget(self, widget: ScreenshotWidget) -> None:
        if widget in self.widgets:
            self.widgets.remove(widget)

    def quit(self) -> None:
        if self._hotkey:
            self._hotkey.unregister()
        self.app.quit()

    def run(self) -> int:
        log.info("SlickShot running; hotkey=%s", self.settings.get("hotkey"))
        return self.app.exec()


def main() -> None:
    sys.exit(SlickShotApp().run())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_app.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Full-suite gate**

Run: `python -m pytest -q`
Expected: every test (Tasks 2–17) passes.

- [ ] **Step 6: Manual end-to-end test (user, real desktop)**

Run: `python -m slickshot_pyside`
Then:
1. A tray icon appears. ✓
2. Press **Alt+Shift+4** → screen dims across **all monitors** → drag a region. ✓
3. A floating preview appears bottom-left. ✓
4. Click **Save** → file lands in `~/Documents/screenshots/image0001.png` (sharp on scaled displays). ✓
5. Click **Copy** → paste into another app works. ✓
6. Drag the preview into another app → file drops. ✓
7. Right-click tray → **Quit** exits cleanly. ✓
8. Check `%APPDATA%/SlickShot/log.txt` has run + save lines. ✓

- [ ] **Step 7: Commit**

```bash
git add slickshot/app.py tests/test_app.py
git commit -m "feat(app): controller wiring hotkey->overlay->preview, tray, cleanup"
```

---

## Task 18: Parity switch — retire the legacy entry point

**Files:**
- Modify: `slickshot.py`
- Modify: `README.md` (create if absent)

**Depends on:** Task 15 (and its manual test passing).

> Only after the manual end-to-end test passes. Keep the legacy code in git history; turn the legacy file into a thin redirect so old muscle memory (`python slickshot.py`) still launches the new app.

- [ ] **Step 1: Replace `slickshot.py` with a redirect**

```python
"""SlickShot launcher (legacy entry kept for compatibility).

The implementation now lives in the `slickshot` package on PySide6.
Run `python -m slickshot_pyside` or just `python slickshot.py`.
"""
from slickshot.app import main

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create/After-write `README.md`**

```markdown
# SlickShot

Fast, private, local-first Windows screenshot tool (PySide6).

## Run
    python -m slickshot_pyside
    # or
    python slickshot.py

## Hotkey
Alt+Shift+4 → drag a region → Save / Copy / Edit / drag-to-app.
Settings live in `%APPDATA%/SlickShot/settings.json`.

## Develop
    pip install -e .[dev]
    pytest
```

- [ ] **Step 3: Run the full suite once more**

Run: `python -m pytest -q`
Expected: all pass.

- [ ] **Step 4: Manual smoke**

Run: `python slickshot.py` → confirms the redirect launches the new app (tray appears).

- [ ] **Step 5: Commit**

```bash
git add slickshot.py README.md
git commit -m "feat: route legacy slickshot.py to the new PySide6 app; add README"
```

- [ ] **Step 6: Push the branch (when the user approves)**

```bash
git push -u origin tier0-foundation
```

---

## Self-Review (completed by plan author)

**Spec coverage (Tier 0 rows from the flagship plan):**
- 0.1 PyQt5→PySide6 → Tasks 0 (install), 13/16/17/15 (PySide6 code), 18 (switch). ✓ (parallel-build approach per user choice)
- 0.2 Multi-monitor capture → Tasks 6 (math) + 11 (grab) + 13 (overlay spans virtual desktop). ✓
- 0.3 Per-monitor HiDPI/DPR → Tasks 6 + 11 (native-resolution per-screen grab). ✓
- 0.4 Package refactor → Tasks 0/1 + every module path. ✓
- 0.5 Registered global hotkey → Task 12. ✓ (low-level hold-B hook is Tier 1, correctly out of Tier 0)
- 0.6 Tray icon + menu → Task 17. ✓
- 0.7 Settings store + filename patterns → Tasks 4 + 3. ✓
- 0.8 Structured logging → Task 5. ✓
- 0.9 Non-destructive Document model → Tasks 9 + 10. ✓
- 0.10 Temp cleanup on startup → Task 7 (wired in Task 15). ✓

**Placeholder scan:** No "TBD"/"handle errors appropriately" — every code step has complete code. "Edit" button is an intentional, documented Tier-2 stub (logs a message), not a placeholder gap. ✓

**Type consistency:** `MonitorInfo` fields consistent across Tasks 6/11; `Document.add/clear/undo/redo/flatten/annotations` consistent across Tasks 9/10/16; `ScreenshotWidget(pixmap, app_ref, *, save_dir, pattern, fmt)` consistent across Tasks 16/15; `Settings.get/set/save/load` consistent across Tasks 4/15; `paths.*` names consistent across Tasks 2/4/5/7/16/15. ✓

**Orchestration note:** Within Wave C, Task 14 imports `slickshot.app.main` (Task 15), so an orchestrator must complete Task 15 before Task 14's commit step. All other intra-wave dependencies are listed per task.
