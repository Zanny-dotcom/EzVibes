# EZvibes Exit Safety and Live Diagnostics Plan

Date: 2026-05-26

## Incident readout

The recent close could not be tied to a Claude/Codex `taskkill`, `Stop-Process`, or explicit Electron-kill command from shell or agent history.

Evidence found:

- Windows Error Reporting has an older `electron.exe` hang report at 2026-05-26 12:39:30, type `AppHangXProcB1`. Its archive is access-denied from this shell, so it cannot be conclusively attributed to EZvibes.
- EZvibes user data was touched at 2026-05-26 15:12:59, with no matching Windows crash report afterward.
- Recent Claude/Codex logs around that window show normal project work and no direct OS command to kill EZvibes.
- The code had no top-level close guard. Closing the main Electron window immediately reaches `window-all-closed`, then `app.quit()`, and `before-quit`/window cleanup kills all PTYs.

Most likely cause: a normal window close path or external WM_CLOSE-style close around 15:12, not a native crash. This cannot be proven with existing logs because EZvibes did not keep durable runtime logs.

## Implemented safety layer

1. Durable JSONL app log

- Main process writes structured JSONL to `%APPDATA%\EZvibes\logs\ezvibes-YYYY-MM-DD.jsonl`.
- Records app/window lifecycle, close prompts, close decisions, terminal create/exit/kill, renderer crash/hang signals, failed loads, and renderer diagnostic events.
- Does not log terminal input/output contents.

2. Live log drawer

- Header `Live Log` control opens an in-app live diagnostics drawer.
- Drawer shows recent in-memory events and the current log file path.
- Uses `textContent` only for rendering details.

3. Top-level exit guard

- Main process intercepts app/window close when live PTYs exist.
- Renderer shows `Exit EZvibes?` with `Stay` focused by default.
- Confirming exits and kills sessions; cancelling leaves the app and PTYs running.

## Next hardening phases

1. Crash forensics

- Add Electron `crashReporter` with local upload disabled.
- On startup, scan for unsubmitted crash dumps and surface them in Live Log.
- Add an "Open log folder" command once shell-open IPC is designed safely.

2. Session recovery

- Persist lightweight session metadata: folder path, agent, tab label, start time, last exit reason.
- On startup after abnormal exit, show "Previous session ended unexpectedly" with last log path and affected folders.
- Do not attempt automatic PTY resurrection; Claude/Codex TUI state is not safely recoverable today.

3. Log hygiene

- Add rotation by size and age.
- Add a redaction pass for paths or environment-like strings if future events become more detailed.
- Keep terminal transcript logging out of durable logs unless explicitly enabled for a single debug run.

4. More close sources

- Log and review `will-navigate` cleanup behavior. Today, a navigation attempt kills sessions before preventing non-app navigation.
- Consider changing that to prevent first, then kill only for intentional app reloads.
- Add a visible "Reload app" command that warns about PTYs instead of relying on browser-style navigation.

5. Verification checklist

- Start EZvibes, launch Claude and Codex tabs, click the window X, choose Stay, confirm PTYs remain active.
- Repeat and choose Exit EZvibes, confirm JSONL logs include close requested, confirmed, window closed, terminal kill/exit.
- Open Live Log and confirm new events stream without showing raw terminal text.
- Force a renderer crash in a dev-only path later and confirm `render_process_gone` logs before cleanup.
