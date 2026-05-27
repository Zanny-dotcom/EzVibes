#12

# Hermes Desktop — Project Summary

**Path:** `C:\Users\Oskari\Documents\hermes`
**Repo:** [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop) (now under NousResearch)
**Version:** 0.3.5 — actively developed
**Branch:** `main` (uncommitted edits in `package-lock.json`, `src/main/installer.ts`)

## What It Is

Cross-platform **Electron desktop GUI** for the [Hermes Agent](https://github.com/NousResearch/hermes-agent) — a self-improving AI assistant with tool use, multi-platform messaging, and a closed learning loop. Replaces hand-managing the Hermes CLI with a one-stop app that handles install, provider setup, and daily use.

## Tech Stack

| Layer | Tech |
|---|---|
| Shell | Electron 39 |
| UI | React 19 + Tailwind CSS 4 |
| Lang | TypeScript 5.9 |
| Build | Vite 7 + electron-vite 5 + electron-builder 26 |
| DB | better-sqlite3 12 (FTS5 full-text search) |
| i18n | i18next 25 / react-i18next 15 |
| Tests | Vitest 4 + Testing Library |
| Markdown | react-markdown + remark-gfm + syntax-highlighter |
| Updater | electron-updater 6 |

## Architecture

- **Main process (`src/main/`)** — Electron backend. Modules:
  - `index.ts` — entrypoint
  - `installer.ts` — runs upstream Hermes install script (currently being edited)
  - `hermes.ts` — agent process lifecycle
  - `config.ts`, `profiles.ts`, `models.ts`, `default-models.ts` — config + provider mgmt
  - `sessions.ts`, `session-cache.ts` — SQLite-backed chat history
  - `skills.ts`, `tools.ts`, `memory.ts`, `soul.ts` — agent capability/persona surfaces
  - `cronjobs.ts` — scheduled task runner
  - `claw3d.ts` — 3D "Office" interface adapter
  - `ssh-tunnel.ts`, `ssh-remote.ts` — remote-mode SSH transport (recent #68)
  - `sse-parser.ts` — streams agent responses
  - `locale.ts`, `utils.ts`, `askpass.ts`
- **Preload (`src/preload/`)** — typed IPC bridge
- **Renderer (`src/renderer/`)** — React UI in `src/`, entry `App.tsx`

## Modes

- **Local:** Hermes runs at `127.0.0.1:8642`, agent files in `~/.hermes/` (you have a non-default `HERMES_HOME` per memory)
- **Remote:** Connect to a Hermes API server with URL + key

## Surface Area

- **12 screens:** Chat, Sessions, Agents, Skills, Models, Memory, Soul, Tools, Schedules, Gateway, Office, Settings
- **11 LLM providers:** OpenRouter, Anthropic, OpenAI, Google (Gemini), xAI (Grok), Nous Portal, Qwen, MiniMax, Hugging Face, Groq, Local (LM Studio / Ollama / vLLM / llama.cpp)
- **16 messaging gateways:** Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email, SMS (Twilio/Vonage), iMessage (BlueBubbles), DingTalk, Feishu/Lark, WeCom, WeChat, Webhooks, Home Assistant
- **14 toolsets:** web, browser, terminal, file, code-exec, vision, image-gen, TTS, skills, memory, session-search, clarify, delegation, MoA, task-planning
- **22 slash commands:** `/new`, `/clear`, `/fast`, `/web`, `/image`, `/browse`, `/code`, `/shell`, `/usage`, `/help`, `/tools`, `/skills`, `/model`, `/memory`, `/persona`, `/version`, `/compact`, `/compress`, `/undo`, `/retry`, `/debug`, `/status`, …

## Notable Features

- SSE-streamed chat with live tool-progress indicators
- Token usage + cost in chat footer
- SQLite session search (FTS5)
- Profile isolation (`~/.hermes/profiles/<name>/`)
- Cron scheduler with 15 delivery targets
- Hermes Office (Claw3d 3D interface)
- Backup/restore, debug dumps, log viewer
- Auto-updater wired via electron-updater
- Winget manifest scaffolding for Windows distribution

## Scripts

```bash
npm run dev          # electron-vite dev
npm run dev:fresh    # dev with fresh HERMES_HOME (mktemp)
npm run typecheck    # node + web tsc passes
npm run lint
npm run test         # vitest run
npm run test:watch
npm run build        # typecheck + electron-vite build
npm run build:win | build:mac | build:linux | build:rpm
```

## Recent Activity (last 5 commits)

- `1d1d2d5` Merge #68 — SSH tunnel
- `e28e00d` Merge #82 — fix auth-json setup detection
- `faa852c` Address SSH config review follow-up
- `50ae7bd` Merge #80 — fix office scroll overflow
- `e67e1bf` fix: detect Hermes auth credentials during setup

## Related Sibling Projects

Per memory: `hermes-desktop` (this), `hermes-control`, `hermes-claude-bridge` live as siblings on disk.

## Gotchas (from memory)

- You run with a **non-default `HERMES_HOME`** — installer/config code should be checked against that.
- **UI overwrites `config.yaml`** when settings change — don't hand-edit the YAML if the app is open.
- Subscriptions are held; provider keys live in `.env` under `HERMES_HOME`.
