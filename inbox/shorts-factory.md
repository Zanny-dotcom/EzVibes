# ShortsFactory — Project Plan

> **Working name** (easy to rename). A local-first pipeline that turns one long clip into several caption-ready vertical shorts, dropped into a folder for posting.
>
> **Status:** Plan / pre-build. **Date:** 2026-05-30. **Owner:** Oskari.
> **Rollout decision:** Start at **Phase C (render-only)**; upgrade to **Phase B (auto-distribute)** once clip quality is dialed in.

---

## 1. What it does

Feed it one clip (tuned for ~1–10 min). It:

1. Transcribes the audio with word-level timing.
2. Uses Claude to pick the ~4 strongest self-contained moments.
3. Cuts each one and reframes 16:9 → 9:16 vertical (1080×1920).
4. Burns in animated, word-by-word "karaoke" captions (the #1 retention driver on shorts).
5. Writes per-platform titles, descriptions, and hashtags.
6. **Phase C:** drops finished shorts + a `POST-ME.md` into `output/` for manual posting.
   **Phase B (later):** auto-uploads to YouTube and queues TikTok/IG.

This is the "Opus Clip / Klap" category — but self-hosted, mostly free, and yours to learn from end to end.

---

## 2. Why this is a great first AI build

**You already own most of the pipeline.** The only genuinely new piece is Whisper.

| Pipeline step | Tool | Status |
|---|---|---|
| Cut & reframe to 9:16 | **ffmpeg** | ✅ installed |
| Transcribe (word-level timing) | **faster-whisper** (local, RTX 2070) | free/fast — needs install |
| Pick best moments + write metadata | **Claude** | ✅ available |
| Animated captions + final render | **Remotion** (programmatic) | ✅ set up in `marketing/remotion` |
| Orchestration | **Node** | ✅ installed |
| Post to platforms | platform APIs / scheduler | ⚠️ Phase B only — see §6 |

The "AI brain" (transcription + moment-selection + captions) is **free and local**. Money/approvals only enter at the *posting* leg, which Phase C avoids entirely.

---

## 3. Architecture

**Principle: filesystem as the interface between stages.** Every stage reads files and writes files (JSON + media). That makes the pipeline inspectable, resumable, debuggable — and easy to *learn from*, because you can run any stage alone and look at its output.

```
input/long-clip.mp4
   │
   ▼
[0] Ingest ─ ffmpeg ─────────► work/<id>/audio.wav + meta.json
   │
   ▼
[1] Transcribe ─ faster-whisper (GPU) ─► work/<id>/transcript.json   (word-level timing)
   │
   ▼
[2] Select moments ─ Claude ──────────► work/<id>/clips.json   (~4 hooks: start/end/title/why)
   │
   ▼
[3] Cut + reframe ─ ffmpeg ───────────► work/<id>/segment-N.mp4   (trimmed source for 9:16)
   │
   ▼
[4] Caption + render ─ Remotion ──────► output/<id>/short-N.mp4   (1080×1920, captions)
   │
   ▼
[5] Metadata ─ Claude ────────────────► output/<id>/short-N.json + POST-ME.md
   │
   ▼  ─────────── Phase C ends here: you post manually from output/ ───────────
   │
   ▼
[6] Distribute ─ (Phase B) ───────────► YouTube auto-upload + TikTok/IG queued
```

### Stage detail

- **[0] Ingest** — ffmpeg probes the clip and extracts mono 16 kHz WAV for Whisper. Writes `meta.json` (duration, fps, resolution, has-audio).
- **[1] Transcribe** — `faster-whisper` (CTranslate2 backend; runs well on 8 GB with `compute_type=int8_float16`). Model `medium` or `large-v3` quantized. Emits segments **and** per-word `{word, start, end}`. *(Upgrade path: WhisperX for tighter forced-alignment + speaker labels.)*
- **[2] Select moments** — Claude reads `transcript.json` and returns `clips.json`: an array of `{start, end, title, why_it_works, caption_style}`. Selection prompt favors: a hook in the first 1–2 s, a self-contained idea, 15–45 s length, an emotional/surprising/insightful peak, a clean ending. **Default strategy assumes spoken-word content.** For gameplay / music / low-speech footage, fall back to scene-change detection (ffmpeg `select='gt(scene,0.4)'` or PySceneDetect) + audio-loudness peaks instead of transcript.
- **[3] Cut + reframe** — ffmpeg trims each segment (`-ss/-to`) into a short source file. Reframe handled in Stage 4 by Remotion so framing stays fully controllable. *(v1 framing: centered video on a blurred fill, so no faces get cropped. Upgrade: face/active-speaker-aware crop via OpenCV/mediapipe.)*
- **[4] Caption + render** — a Remotion composition `Short` takes props `{ videoSrc, words[], title, style }` and renders the vertical video + animated word-by-word captions + optional hook title / progress bar / watermark. Driven **programmatically** from Node via `@remotion/renderer`'s `renderMedia()` — this is what makes it a pipeline instead of a manual Studio session. Reuses fonts/components from `marketing/remotion`.
- **[5] Metadata** — Claude writes per-platform title/description/hashtags + a suggested thumbnail frame. Outputs machine JSON **and** a human `POST-ME.md` — the Phase-C "everything you need to post by hand, in one place" sheet.
- **[6] Distribute (Phase B)** — see §6.

### Orchestration

- One Node CLI: `node shorts.mjs ./input/long-clip.mp4` runs stages 0–5.
- Each stage is a module with a clean `(input) → output` contract that reads/writes files, so stages can be run individually and the pipeline can resume after a failure.
- `shorts.config.json`: number of clips, min/max length, caption style, crop mode, Whisper model, etc.

---

## 4. Tech choices & rationale

- **faster-whisper** — local, free, GPU, gives word timestamps, fits 8 GB via int8. The one new dependency (small Python env + CUDA). Verifying this also settles the earlier `nvidia-smi`/NVML question — i.e. confirms CUDA actually works on the RTX 2070.
- **Claude for Stages 2 & 5** — two options:
  - **(a) Anthropic API** with structured/JSON output — most reliable for machine-readable `clips.json`. Needs `ANTHROPIC_API_KEY`.
  - **(b) Headless Claude Code** (`claude -p "..."`) — reuses existing auth, potentially no extra key/cost, but less structured. *Recommendation: API for reliability; (b) as a zero-extra-cost fallback.*
- **ffmpeg** — trims/probes/extracts. Already installed.
- **Remotion** — data-driven captions + final render, programmatic. Already installed.
- **Node** — orchestrator; matches Remotion + the EZvibes codebase.

---

## 5. Phased rollout

- **Phase C — "Render factory" (NOW).** Stages 0–5. Output = finished captioned shorts + `POST-ME.md`; you post manually. **Goal: make the clips good enough that you'd actually post them.** Done when: drop a clip in → get post-worthy vertical shorts with accurate captions and decent moment-selection, no hand-editing needed.
- **Phase B — "Auto-distribute" (NEXT, once C is dialed in).** Add Stage 6: YouTube auto-upload (official Data API) + TikTok/IG to a scheduler or drafts. Done when: drop a clip in → YouTube short publishes itself, TikTok/IG land queued for a one-tap post. ~95% hands-off.
- **Phase A — "Full auto" (MAYBE).** Official TikTok/IG direct-publish via developer-app review. Only worth the paperwork if posting volume justifies it.

---

## 6. The honest posting catch (carried forward for Phase B)

- **YouTube Shorts** — official Data API v3, clean OAuth resumable upload, set title/desc/tags/schedule. Fully automatable. ✅ (Default quota ≈ a handful of uploads/day; request more if needed.)
- **TikTok & Instagram Reels** — official "post directly" APIs exist but are **gated behind developer-app review**; until approved you can typically only push to *drafts/private*. Unofficial headless-browser uploaders violate ToS and risk account bans.
- **Pragmatic Phase-B path:** YouTube via official API + TikTok/IG via a self-hosted scheduler (**Postiz**) or **Buffer/Metricool**, or as drafts. Confirm each platform's current rules at build time — they shift.

---

## 7. Learning payoffs (this build *is* the AI curriculum)

- Stage 1 → automatic speech recognition: Whisper, quantization, GPU inference.
- Stage 2 → LLM orchestration: structured output, prompt design, the real "agentic" skill.
- Stage 4 → programmatic video: Remotion composition, data-driven rendering, timing.
- Whole thing → pipeline architecture: filesystem-as-interface, idempotent/resumable stages.
- Natural next lessons it sets up: computer vision (face-aware cropping), and **local generative video** (Wan/LTX on the 2070) as a future "AI b-roll" stage.

---

## 8. Open questions (resolve before/while building)

1. **Source content type** — spoken-word vs gameplay/visual. Changes Stage-2 selection strategy. *(Default: spoken-word; visual fallback noted.)* ← still unanswered.
2. **Claude wiring** — Anthropic API (key) vs headless Claude Code for Stages 2/5.
3. **Caption style** — bold karaoke / minimal / branded. Decide while building Stage 4.
4. **Phase-B scheduler** — Postiz (self-host) vs Buffer/Metricool.

---

## 9. First build steps (Phase C, stage by stage)

1. Scaffold `shorts-factory/` workspace + `shorts.config.json`.
2. **Stages 0–1:** set up Python env + CUDA, run faster-whisper on a real clip → verify `transcript.json`. *(Confirms the GPU works for ML.)*
3. **Stage 2:** Claude selection → `clips.json`.
4. **Stages 3–4:** ffmpeg cut + Remotion caption render → **first real short.** ← the milestone.
5. **Stage 5:** metadata + `POST-ME.md`.
6. Tune selection + captions until output is post-worthy → Phase C done.
