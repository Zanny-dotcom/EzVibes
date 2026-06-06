# SlickShot → Flagship Windows Screenshot Tool — Design Spec

**Date:** 2026-06-02
**Status:** Approved design (brainstorming complete) → ready for implementation plan
**Source of truth for code:** `C:\Users\Oskari\Documents\slickshot\slickshot.py` (single file, ~607 lines, PyQt5 only)

---

## 0. Decisions locked with the user

| Decision | Choice |
|---|---|
| Ambition | **Best-in-class, kitchen-sink** — match/beat CleanShot X + ShareX (screenshots only) |
| Dependencies | **Whatever it takes** — PySide6, winrt/Tesseract, requests, numpy/Pillow, boto3, Inno Setup all acceptable |
| AI approach | **Local-first, cloud optional** — on-device Windows OCR + regex PII by default; optional BYO-key cloud LLM, off by default |
| Recording / GIF | **Out of scope** — stays a screenshot tool |
| Qt foundation | **Migrate to PySide6 (Qt6)** — native multi-monitor/HiDPI, LGPL, future-proof |
| Code structure | **Refactor into a `slickshot/` package** |
| Distribution | **Polished installer (Inno Setup) + auto-update + code-signing** |

`slickshot_standalone.py` has been removed by the user; `slickshot.py` is the single canonical app.

---

## 1. Product positioning

**Wedge:** *The fastest, most private, pixel-precise capture-and-mark tool on Windows.*

SlickShot already nails two things competitors charge for or lack:
- A **floating preview widget with drag-to-app** (Snipaste/CleanShot gate this).
- **True local-first, zero-account, zero-cloud** operation.

We double down on those, fill every table-stake gap, and use **local-first AI** (on-device Windows OCR + regex PII redaction) as the differentiator the big suites structurally can't copy (they gate it behind cloud/paywalls).

### Market context (mid-2026, from verified research)
The market has bifurcated: heavyweight suites (CleanShot X, Snagit, ShareX) piled on recording, scrolling capture, cloud, 200+ effects, and AI (ShareX 19.0 Jan 2026 added BYO-key ChatGPT/Gemini/OpenRouter analysis; Snagit 2026 has AI Smart Redact; Windows Snipping Tool now bundles on-device OCR + Quick Redact + QR + color picker + video, free). Lightweight tools (Snipaste, Flameshot, Shottr, Greenshot) compete on speed/pixel-precision/pinning/privacy and deliberately avoid AI. Hardened 2025–2026 table-stakes: immediate annotation toolbars, OCR, blur/pixelate redaction, undo/redo, pinned floating shots, multi-monitor + HiDPI correctness, searchable local history, and beautification.

### Anti-features (explicitly NOT building)
- ❌ Screen recording / GIF / video (biggest scope sink: ffmpeg/audio/timeline/codecs).
- ❌ Cloud SaaS with accounts/links/comments/push (contradicts privacy wedge). One *optional* uploader only.
- ❌ Content-aware "magic eraser" / AI upscaling / screenshot-to-code (heavy models, off-wedge; research showed even ShareX's "Smart Eraser" only samples a background color — we ship honest blur/pixelate).
- ❌ AI on-by-default or any cloud-default behavior. All cloud AI opt-in, BYO-key, off by default.
- ❌ ShareX's 70-uploader / 232-effect sprawl, 3D device mockups/tilt, VFX filters, templates/PowerPoint export, full photo editor.

### Verified-real 2026 features (research fact-check, 24/24 claims confirmed or corrected)
Notable corrections vs. common assumptions: ShareX AI analysis is **v19.0 (Jan 2026)**, opt-in/BYO-key; ShareX SQLite history is **v18.0.0 (Aug 2025)**, not 2026; ShareX Background Beautifier (**v20.0, Apr 2026**) is **manual-config**, not automatic; ShareX "Smart Eraser" only **samples a color** (not content-aware). On-device OCR is now table-stakes. Excluded as cutting-edge/unverified/privacy-fraught: semantic history search, screenshot-to-code, "redaction that learns," OpenAI Chronicle-style memory.

---

## 2. Architecture

### 2a. Keystone: non-destructive annotation model
Today `DrawingCanvas` paints strokes directly onto the pixmap — destructive, no undo, freehand-only. Every wanted annotation feature is impossible on that model. The fix:

```
Document
  base_image: QImage          # the capture, untouched
  layers: list[Annotation]    # ordered, z-sorted
  render(target_dpr) -> QImage   # composite for display
  flatten() -> QImage            # composite for save/copy/drag (redaction baked in irreversibly)

Annotation (base; one subclass per tool), QGraphicsItem-based:
  ArrowAnnotation / RectAnnotation / EllipseAnnotation / LineAnnotation
  TextAnnotation / FreehandAnnotation / HighlightAnnotation
  CounterAnnotation (auto-incrementing numbered step)
  BlurAnnotation / PixelateAnnotation (redaction)
  each: geometry, style(color/width/fill/font), z, bounding_rect, hit_test(), paint(), serialize()
```

Buys us:
- **Undo/redo for free** via `QUndoStack` — each action is a `QUndoCommand`.
- **Irreversible redaction**: `flatten()` is the *only* pixel-export path; blur/pixelate baked there, raw pixels never leave the app.

**Implementation:** `QGraphicsScene`/`QGraphicsView` with base image as bottom `QGraphicsPixmapItem`, each annotation a `QGraphicsItem` subclass — hit-testing, selection handles, move/resize, z-order come from the framework. Export = render scene to `QImage`.

### 2b. Package layout (PySide6)
```
slickshot.py                  # tiny launcher → app.main()
slickshot/
  app.py                      # controller, tray, lifecycle, wiring
  config/ settings.py paths.py
  capture/ overlay.py screens.py modes.py window_detect.py
  hotkey/ win32_hotkey.py
  editor/ document.py annotations.py commands.py editor_window.py tools.py
  preview/ widget.py pin.py
  beautify/ compositor.py
  ocr/ win_ocr.py redact.py
  ai/ cloud.py                # OPTIONAL, opt-in, BYO-key, disabled by default
  history/ store.py panel.py
  share/ uploader.py discord.py s3.py
  util/ logging.py images.py
tests/
packaging/ slickshot.spec installer.iss update_check.py
```

Boundaries: each subsystem has a narrow interface (a `Capture`/`Document` flows between them), independently testable. `ocr/` and `ai/` are isolated so the local-first default is structurally separate from the optional cloud path — a screenshot cannot leak to cloud from the OCR path.

### 2c. Data flow (one capture's life)
```
hotkey/win32 → app.start_capture(mode)
  → capture/ grabs across all screens at correct DPR → Capture(QImage, source_meta)
  → preview/widget shows floating thumbnail (Save/Copy/Edit/Pin/Delete + drag)
     ├─ Edit  → editor/ opens Document(base=capture); annotate; flatten() on save/copy/drag
     ├─ OCR   → ocr/win_ocr → text to clipboard;  redact → suggested blur regions into editor
     ├─ Pin   → preview/pin pins always-on-top
     ├─ Beautify → beautify/compositor → share-ready export
     └─ Save  → config/paths + filename pattern;  history/store indexes it (+OCR text for search)
```
Cross-cutting principles: (1) `flatten()` is the only pixel-export path (redaction integrity + single output reasoning point); (2) settings + history live in `%APPDATA%/SlickShot/`, not the repo or a hard-coded path.

---

## 3. Phased feature tiers

Effort: **S** ≈ <1 day · **M** ≈ 1–3 days · **L** ≈ multi-day. Dep "—" = pure PySide6/stdlib. Earlier tiers gate later ones.

### Tier 0 — Foundation & correctness
| # | Feature | Effort | Dep |
|---|---|---|---|
| 0.1 | Migrate PyQt5 → PySide6 (enums, signals, drop `QApplication.desktop()`) | M | PySide6 |
| 0.2 | Multi-monitor + virtual-desktop capture (`QGuiApplication.screens()`, union geometry) | M | — |
| 0.3 | Per-monitor HiDPI / `devicePixelRatio` correctness | M | — |
| 0.4 | Package refactor into `slickshot/` (§2b) | L | — |
| 0.5 | Registered global hotkey via `RegisterHotKey` + native event filter (kills 100ms poll) | S–M | — (ctypes) |
| 0.6 | System tray icon + menu (Capture ▸ / Recent / Settings / Quit) | S | — |
| 0.7 | Settings store (JSON in `%APPDATA%`) + save-location & filename patterns (`%date%`,`%window%`,counter) | S–M | — |
| 0.8 | Structured logging → `%APPDATA%/SlickShot/log.txt` | S | — |
| 0.9 | Non-destructive `Document` / annotation object model (§2a keystone) | L | — |
| 0.10 | Temp `.tmp/` cleanup on startup + staging hygiene (the 156-file leak) | S | — |

### Tier 1 — Capture & flow polish
| # | Feature | Effort | Dep |
|---|---|---|---|
| 1.1 | Pin-to-screen (always-on-top, draggable, resizable, opacity; double-click→edit) | S | — |
| 1.2 | Magnifier loupe + live HEX/RGB readout during region select | S–M | — |
| 1.3 | Window/element auto-detect snapping (`EnumWindows`+`GetWindowRect`) | M | — (ctypes) |
| 1.4 | Window capture mode (click a window → clean capture) | M | — (ctypes) |
| 1.5 | Fullscreen + active-monitor one-key capture | S | — |
| 1.6 | Delayed / self-timer capture (3/5/10s countdown overlay) | S | — |
| 1.7 | Repeat-last-region capture | S | — |
| 1.8 | Undo/redo in editor (`QUndoStack`) | S–M | — |
| 1.9 | Preview UX polish: hover-only toolbar, Copied/Saved toast, right-click menu (Reveal/Copy path/Rename) | S–M | — |

### Tier 2 — Modern annotation editor
| # | Feature | Effort | Dep |
|---|---|---|---|
| 2.1 | Shapes: arrow (multiple styles), rectangle, ellipse, line | M | — |
| 2.2 | Text tool (font/size/color, editable) | M | — |
| 2.3 | Blur / pixelate redaction tool (baked irreversibly in `flatten()`) | M | — (opt. numpy/Pillow) |
| 2.4 | Full color palette + adjustable stroke width + saved custom colors | S | — |
| 2.5 | Highlighter (semi-transparent) | S | — |
| 2.6 | Counter / numbered-step tool (auto-incrementing) | S | — |
| 2.7 | Crop / trim within editor | S–M | — |
| 2.8 | Spotlight / dim-surroundings effect | S | — |
| 2.9 | Standalone color-picker tool + screen ruler / pixel measure | S each | — |
| 2.10 | Re-open & re-edit saved screenshots | S–M | — |
| 2.11 | Editor shortcuts (`Ctrl+C/S/Z/Shift+Z`, tool hotkeys, `Esc`) | S | — |

### Tier 3 — Beautify & share
| # | Feature | Effort | Dep |
|---|---|---|---|
| 3.1 | Beautify export: padding, rounded corners, drop shadow, solid/gradient bg, social aspect presets | M–L | — (skip mesh-gradient/3D initially) |
| 3.2 | Auto-balance / center within frame | S–M | — |
| 3.3 | Optional watermark / branding overlay | S | — |
| 3.4 | Multi-format export (PNG/JPG/WebP, quality slider) | S | — |
| 3.5 | One optional uploader: Discord webhook and/or S3/R2; link→clipboard; secrets in Windows Credential Manager | S / M | requests; boto3 (S3 only) |
| 3.6 | Copy file path / Reveal in Explorer / Save-to-watched-folder | S | — |

### Tier 4 — Local-first AI (the wedge)
*On-device first; cloud strictly opt-in, off by default. OCR-unpackaged feasibility verified.*
| # | Feature | Effort | Dep |
|---|---|---|---|
| 4.1 | On-device OCR — copy text via `Windows.Media.Ocr`; Tesseract fallback (**flagship**) | M | winrt-* (or Tesseract+pytesseract) |
| 4.2 | OCR utilities: copy-all / select-region text, linebreak removal | S | — |
| 4.3 | Pattern-based PII auto-redaction: email/phone/CC(Luhn)/IP/API-key shapes → suggested blur boxes → accept/reject → bake | M | builds on 4.1+2.3; regex stdlib |
| 4.4 | OCR-powered history search (search captures by recognized text) | S–M | — (SQLite FTS) |
| 4.5 | Optional cloud "explain/ask about this screenshot" — BYO-key, disabled by default, labeled "leaves your device" | M | requests / provider SDK |

### Tier 5 — Library, scale & distribution
| # | Feature | Effort | Dep |
|---|---|---|---|
| 5.1 | Local capture history/library — SQLite-indexed thumbnail grid: reopen/copy/save-as/reveal/delete | M | — (stdlib sqlite3) |
| 5.2 | History metadata + tags (id, ts, mode, window title, dimensions, OCR text, tags) | S–M | — |
| 5.3 | Scrolling capture (guided scroll-and-stitch, overlap template-matching) — **experimental, honestly labeled** | L | numpy/OpenCV + input simulation |
| 5.4 | Polished installer (Inno Setup) replacing loose 38MB exe | M | Inno Setup |
| 5.5 | Auto-update check vs GitHub Releases JSON manifest on startup | S–M | — (requests) |
| 5.6 | Code-signing the binary to avoid SmartScreen | S | signing cert (user-supplied) |
| 5.7 | pytest suite + GitHub Actions build-on-tag → attach exe to release | M | pytest / CI |

**Totals:** ~50 features, 6 tiers. New deps: PySide6 (foundation); winrt-*/Tesseract (OCR); requests (upload/AI/update); numpy/Pillow (optional, image-op speed); boto3 (S3 only); Inno Setup (packaging). Else pure Qt6/stdlib.

---

## 4. Testing strategy
Pure-logic units that are high-value and easy to test (pytest):
- **Redaction irreversibility**: `flatten()` output contains no recoverable source pixels under a `BlurAnnotation`/`PixelateAnnotation`.
- **Document/flatten** geometry & z-order compositing.
- **Luhn** credit-card validation + each PII regex (true/false positives).
- **Filename pattern** expansion (`%date%`/`%time%`/`%window%`/counter) + collision avoidance.
- **Settings IO** round-trip + defaults/migration.
- **Multi-monitor geometry math** (virtual-desktop union, per-screen DPR mapping) with mocked screen layouts.
GUI-heavy paths (overlay, editor interactions) get smoke tests; CI builds the exe on tag-push.

## 5. Build order & sequencing notes
- **Tier 0 is mandatory-first** — the PySide6 migration + `Document` object model gate nearly everything.
- Recommended sequence **0 → 1 → 2 → 3 → 4 → 5**. Rationale: OCR-based redaction (4.3) depends on the blur tool (2.3), so the editor must land before AI; pin/flow (Tier 1) is the cheapest high-impact win after foundation.
- **Scrolling capture (5.3)** kept as an honest "experimental" item (high value, fragile on Windows without DOM access).
- Each tier is independently shippable — the tool is better and still coherent after any tier boundary.

## 6. Open implementation questions (for the plan phase)
- OCR binding: ship `winrt-*` packages vs. bundle Tesseract (binary size vs. accuracy/offline-language trade-off). Default: try WinRT first, Tesseract fallback.
- Beautify gradient engine: linear/radial only initially (mesh gradients deferred).
- Uploader set: Discord webhook is the cheapest first target; S3/R2 only if desired.
