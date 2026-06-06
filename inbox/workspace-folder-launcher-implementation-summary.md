# Workspace Folder Launcher — Implementation Summary

**Date:** 2026-05-29
**Repo:** `C:\Users\Oskari\documents\terminal-emulator` (branch `main`)
**Plan:** `docs/2026-05-29-workspace-folder-launcher-plan.md` (all checkboxes ticked except the `npm start` manual steps)

## What landed

Workspaces are now **folder-bound**: creating one always picks a folder (custom in-app grid over one configured root), the workspace is auto-named after the folder, and every tab launches an agent (Claude/Codex) or a Brave browser already running in that folder. The bare-shell experience is gone. Recent-Paths was removed. Persistence bumped to schema v3 (legacy state wiped → fresh start). Zero workspaces shows a "Create workspace" empty state.

## Post-implementation check: "app won't open" — NOT a code bug

The user reported the app wouldn't open. **Root cause is the single-instance lock**, not a code defect: `src/main/index.js` calls `app.requestSingleInstanceLock()`, so launching a 2nd copy while one runs just focuses the existing window (calls `mainWindow.show()/focus()`) — the new code never executes. That is the "nothing happens." To load the new code the user must FULLY QUIT the running instance (which ends the in-app Claude session) and relaunch.

`renderer/index.html` was audited (via node, after flaky shell output) and is healthy: all 18 required `<script>` tags present, each exactly once, no duplicates, recent-paths removed. No fix commit was needed (HEAD remains `3f8cb78`). NOTE for the record: during this audit I briefly mis-reported an index.html duplication from garbled tool output and started a fix — that was a false alarm; no such corruption existed and nothing was committed for it.

## Commits (9, all on `main`)

```
3f8cb78 docs: document launcher feature, schema v3, and remove recent-paths references
15f5da4 refactor: remove Recent-Paths feature (obsolete under folder-bound workspaces)
fed6104 feat(workspaces): folder-bound creation, auto-name, empty state, close-to-empty
c0167ed feat(tabs): + opens Claude/Codex/Brave menu; openAgentTab; folder-aware fallbacks
abcaefb feat(tabs): schema v3 — wipe legacy state, add workspace folder, zero-workspace default
e7c54b6 feat(terminal): persist agent launch info so restores relaunch the agent
d2ba21f feat(launcher): folder-picker modal + renderer API
3576825 feat(launcher): main-process root storage + subfolder listing + native dialog IPC
4e4457c feat(launcher): add agent command map (claude/codex/brave)
```

## Automated verification (all green)

- `node --test renderer/features/launcher/launcher.agents.test.js` → 3 pass
- `node --test src/main/features/launcher/launcher.main.test.js` → 2 pass
- `node --test src/main/shared/argv.test.js` → 8 pass (no regression)
- `node renderer/features/tabs/tabs.state.test.js` → PASS (v3 migration cases)
- `node --check` on every modified renderer JS file → OK

## ⚠️ Manual verification still required (I could NOT run the app)

This dev session runs *inside* the terminal-emulator app, so I never ran `npm start`/restart (it would kill the session). **The renderer-side behavior has only been statically verified (syntax + grep), never executed.** Please restart the app and walk through:

1. **First launch / empty state** → "No workspaces yet" + "Create workspace" button.
2. Click **Create workspace** → native folder dialog (first time only, sets the root) → the **subfolder grid** appears.
3. Pick a subfolder → workspace auto-named after it; its **first tab is Claude already running in that folder** (no `cd` line, no bare prompt).
4. Top-right **`+`** → menu **New Claude / New Codex / New Brave**. Codex opens in the same folder; Brave is a browser tab. Right-click `+` now does nothing (removed).
5. **`Ctrl+T`** → Claude tab in the active folder. **`Ctrl+Shift+T`** → opens the folder picker.
6. Second workspace in another folder → its agents run in *that* folder.
7. Close a workspace with >1 remaining → switches to a neighbor. Close the **last** workspace → back to the empty state (no auto-recreate).
8. **Restart** → workspaces + tabs restore, each agent relaunching in its folder; Brave reopens its URL.
9. Regressions: grid view (Ctrl+Shift+G), drag-from-sidebar onto a tile, tab/workspace theming + rename, and Explorer-emulator launch (`electron . --cwd "<path>" --cmd "claude"`).

## Notes / things to watch

- **Empty-state overlay positioning:** `#workspace-empty-state` is `position:absolute; inset:0`. I did **not** add `position:relative` to `#terminal-container`/`#app` (the plan said check first, don't add blindly). On first launch covering the whole window is fine; if it ever needs to cover only the terminal area, add the positioned ancestor.
- **Closing a workspace's PTYs:** the new `close()` activates the fallback workspace *before* closing the outgoing tabs — this matches the **pre-existing** order in the old code (not a new regression). Worth confirming during manual test that closing a workspace actually terminates its agents (if outgoing PTYs linger, it's a pre-existing `closeTab`/`tabOrder` interaction, not introduced here).
- **`codex --yolo`** is taken verbatim from the spec — confirm it's the intended invocation.
- **Plan-vs-reality drift:** the live renderer files were more evolved than the plan's "OLD" snapshots in several spots (e.g. `closeTab` uses `if (tabOrder.length === 0)`, `bootInitialTabs` already used `getActiveWorkspace`, real `close()` already activated fallback-first, `PALETTE` is an object array). Edits were adapted faithfully to the real code and re-verified by grep + `node --check`.
- **One deviation from the plan's literal code (pre-approved by the user):** `launcher.main.js` lazy-requires `shared/config` inside `getRoot`/`setRoot` so the module stays node-testable (a top-level require pulls `shared/paths` → `electron.app` at load, which crashes under `node --test`).

## Not done (by design)

- `npm start` walkthrough (Task 10 Steps 2–3) — deferred to you (see checklist above).
- No push to any remote (not requested).
