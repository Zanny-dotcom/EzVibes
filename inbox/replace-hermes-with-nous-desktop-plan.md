# Replace Hermes app with Nous Research Hermes Desktop — execution plan

**Date:** 2026-06-04
**Working dir:** `C:\Users\Oskari\Documents\hermes-launch`
**Decision:** Fully replace + cleanup (delete old data with NO backup; delete source folders after verification).

## Key discovery — these are TWO DIFFERENT apps

| | Current (being removed) | New (being installed) |
|---|---|---|
| Product | Hermes Agent Desktop — "self-improving AI assistant" | Hermes Setup |
| Maker | `fathah` (github.com/fathah/hermes-desktop) | **Nous Research Inc.** (Austin TX) — Authenticode signature **Valid** |
| Version | 0.3.5 | 0.0.1 |
| Run mode | from source, `npm run dev` (electron-vite) | installed `.exe` |
| Installer | — | `C:\Users\Oskari\Downloads\Hermes-Setup.exe` (7.2 MB) |

They are unrelated products sharing the name "Hermes". The old launcher/watchdog will NOT work with the new app and would relaunch the old pipeline forever if left enabled.

## The old "system" being torn down

- **Launcher:** `hermes-launch\launch-pipeline.ps1` — starts 3 processes.
- **Watchdog:** `hermes-launch\watchdog.ps1` — re-runs launcher if any of bridge(11434)/gateway(8642)/electron missing; scheduled task `HermesWatchdog`.
- **Autostart:** scheduled task `HermesPipeline` (logon).
- **Process 1 – Bridge:** node `server.js` in `Documents\hermes-claude-bridge`, port 11434.
- **Process 2 – Gateway:** `hermes.exe` from `AppData\Local\hermes\hermes-agent\venv` (+ python), port 8642.
- **Process 3 – Desktop:** electron from `Documents\hermes\node_modules\electron`.

## DATA-LOSS WARNING (acknowledged by user)

`HERMES_HOME = C:\Users\Oskari\AppData\Local\hermes`. This folder holds LIVE data, deleted with no backup per user decision:
- `state.db` (4.4 MB, modified today), `kanban.db`, `response_store.db`
- `memories/`, `sessions/`, `skills/`
- `auth.json`, `.env` (23 KB — secrets/API keys), `config.yaml` (+ backups), `SOUL.md`
- the gateway venv lives in the `hermes-agent\` subfolder of this same dir.

`Documents\hermes-bot\home` is a second, older data dir (auth.json, memories, sessions, empty logs) — also deleted.

## Source-folder verification (done before deletion)

- `Documents\hermes`: git `main` tracking `origin/main` (public repo, re-clonable). **No unpushed commits, no stashes.** Only local diffs: `package-lock.json`, `src/main/installer.ts`, untracked 4-byte `CLAUDE.md`. Negligible loss.
- `Documents\hermes-bot\home`: data only, no unique source.
- `Documents\hermes-claude-bridge`: bridge scripts (server.js etc.) — reproducible.

## Execution order (safe → destructive)

1. Disable logon autostart — `uninstall-autostart.ps1` (removes task `HermesPipeline`). Reversible.
2. Remove watchdog — `uninstall-watchdog.ps1` (removes task `HermesWatchdog`). Reversible.
3. Kill running pipeline processes (bridge/gateway/electron). Reversible (could relaunch).
4. Install new app — run `Hermes-Setup.exe`.
5. **DESTRUCTIVE:** delete `C:\Users\Oskari\AppData\Local\hermes` (all data + secrets + gateway). No backup.
6. **DESTRUCTIVE:** delete `Documents\hermes`, `hermes-claude-bridge`, `hermes-bot`.
7. Clear user env var `HERMES_HOME`.
8. (Optional, ask) delete `hermes-launch` itself once the above is done.

Steps 5–7 are irreversible; confirm once more immediately before running them.
