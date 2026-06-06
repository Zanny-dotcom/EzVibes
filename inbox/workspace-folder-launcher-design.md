# Workspace Folder Launcher — Design Spec

- **Date:** 2026-05-29
- **Status:** Approved for planning
- **Topic:** Folder-bound workspaces + agent-launch tabs (Claude / Codex / Brave)
- **Canonical copy:** `terminal-emulator/docs/2026-05-29-workspace-folder-launcher-design.md`

## Summary

Today a workspace is an empty container and the user manually `cd`s into a
directory and launches `claude`/`codex` in each tab. This change makes a
**workspace a directory-bound thing**: creating one always asks for a folder
(via a custom picker), the workspace is auto-named after that folder, and
**every tab in the workspace launches an agent already running in that
folder** — the user never sees or types into a bare shell.

Core principle (user's words): **"skip seeing the physical terminal fully."**
There is still a real PowerShell process hosting each agent, but the user
never interacts with a bare prompt during normal use — the shell spawns
directly in the folder (no `cd` line) and the agent boots before the first
prompt.

## Goals

1. Creating a workspace (bottom-left `+`) **always** prompts for a folder.
2. The folder picker is a **custom in-app grid** of the immediate subfolders of
   one configured "main folder" (matches `images/Terminal118.png`), not the OS
   dialog. The OS dialog is used only to set/change that main folder.
3. The workspace is **auto-named** after the chosen folder.
4. The workspace's **first tab auto-opens as Claude**, already running in the
   folder.
5. The top-right `+tab` button shows a menu — **New Claude tab / New Codex tab
   / New Brave tab** (matches `images/Terminal119.png` + a third item) — and
   each new tab launches that agent in the workspace folder (or opens a Brave
   browser tab).
6. The old Recent-Paths "cd suggestion" popup is **removed**.

## Locked decisions

| Question | Decision |
|---|---|
| Folder-list source | **One configured root folder**; its immediate subfolders are the choices |
| Picker navigation | **Flat** — subfolders only (no drill-down, no Browse button) |
| Agent commands | `claude --dangerously-skip-permissions` / `codex --yolo` / Brave = existing browser tab |
| First tab of a new workspace | **Auto-open one Claude tab** |
| Setting the main folder | Native Windows dialog the first time; **"Change main folder"** link in the picker to swap it later |
| Recent-Paths popup | **Remove entirely** |
| Existing Workspace 1 / 2 | **Start fresh** — wipe old workspace state on upgrade |
| Workspace naming | **Auto-name from the folder** (e.g. `EZvibes`) |
| `+tab` menu trigger | **Left-click** the top-right `+` |
| Restart behavior | **Relaunch each agent automatically** (fresh agent session, in its folder; Brave reopens its URL) |
| First launch (no workspaces) | **"Create workspace" empty state** with a button that opens the picker |

## Non-goals / out of scope

- Drill-down navigation or a "Browse…" escape hatch in the picker.
- Picking the **root itself** as a workspace folder (subfolders-only).
- Per-tab folder overrides — every tab in a workspace shares the one folder.
- Reliable `--cmd` injection on **non-PowerShell** shells (keeps today's
  race-prone `setTimeout` fallback; PowerShell remains the supported shell).
- Resuming a *previous* agent session on restart — relaunch starts a **fresh**
  agent.

## Current behavior (for reference)

- **Top-right `+`** (`tabs.renderer.js`): left-click → terminal tab; right-click
  → Brave/browser tab. The Claude/Codex menu in `Terminal119.png` is **not**
  wired up yet.
- **Bottom-left workspace `+`** (`workspaces.renderer.js` `add()`, line 147):
  synchronous; creates an empty `Workspace N`; also called from `close()` to
  auto-recreate the last workspace.
- **Recent-Paths** (`renderer/features/recent-paths/*`): first-click cd popup;
  registered at `renderer/app.js:6`, included at `renderer/index.html:16,76`;
  GridView calls `RecentPathsFeature.setSuppressed(...)`
  (`grid-view.renderer.js:151-152, 197-198`).
- **Terminal spawn** (`terminal.main.js`): `pty.spawn(shell, args, { cwd })`
  sets the directory at spawn (no `cd` shown); `cmd` is injected into the
  PowerShell `-EncodedCommand` startup script (lines 57-63), so it isn't echoed
  as typed text. Tabs auto-title "Claude"/"Codex" by detecting the word in the
  command (`tabs.renderer.js:226-229`).

## Architecture

### New feature: `launcher` (Approach 1 — full feature isolation)

```
src/main/features/launcher/launcher.main.js       # native dialog, subfolder listing, root storage
renderer/features/launcher/launcher.renderer.js   # picker modal + agent→command map (public API)
renderer/features/launcher/launcher.styles.css    # picker modal styles
```

Scaffold with the `add-feature-module` skill, then add the cross-feature seam
(documented below) deliberately — this feature is cross-cutting, like
Workspaces and the CLI-args integration already are.

**IPC channels (main side, `domain:action`):**

| Channel | Kind | Meaning |
|---|---|---|
| `launcher:get-root` | handle | Returns stored main-folder path, or `null` |
| `launcher:choose-root` | handle | Opens native folder dialog (`dialog.showOpenDialog({ properties:['openDirectory'] })`), saves + returns path, or `null` if cancelled |
| `launcher:list-folders` | handle | Returns `[{ name, path }]` of the root's immediate subdirectories (all dirs incl. dotfolders, sorted) |

**Storage:** `config.json` → `launcher.rootFolder`, via the existing
`src/main/shared/config.js` read/write utilities (same pattern other features
use). No new storage file.

**Preload:** add one method per channel to
`contextBridge.exposeInMainWorld('terminalAPI', …)` in
`src/preload/preload.js` (e.g. `launcherGetRoot`, `launcherChooseRoot`,
`launcherListFolders`).

**Renderer public API (`LauncherFeature`):**

- `async pickWorkspaceFolder()` → opens the modal. If `launcher:get-root`
  returns `null`, runs `launcher:choose-root` first. On pick, resolves
  `{ path, name }`; on cancel, resolves `null`.
- `getAgentLaunch(agentType)` → `{ cmd }` for `'claude'` / `'codex'`; `null`
  for `'brave'`. **Single source of truth** for the launch commands.
- `AGENTS` constant: ordered list `[{ type, label }]` for `'claude'`,
  `'codex'`, `'brave'` — consumed by the Tabs `+` menu.

### Folder picker UX (`Terminal118.png`)

- Modal overlay; flat grid of folder tiles (icon + name) from
  `launcher:list-folders`.
- A **"Change main folder"** affordance re-runs `launcher:choose-root`, then
  refreshes the grid.
- **Empty state** when the root has no subfolders: a short message plus the
  "Change main folder" action.
- Cancelling the modal resolves `null` → workspace creation aborts; **no empty
  workspace is left behind.**

## Workspace creation flow (Workspaces feature)

`add()` becomes **async**:

1. `const picked = await LauncherFeature.pickWorkspaceFolder();`
2. If `picked === null` → return without creating anything.
3. Create the workspace record with `folder = picked.path`,
   `name = picked.name`, then `activate(id)`.
4. `TabsFeature.openAgentTab('claude', { cwd: picked.path })` → first tab is
   Claude, already running in the folder.

`close()` last-workspace path: **no longer auto-calls `add()`**. Closing the
final workspace returns to the **first-launch empty state** (below). The
"always at least one workspace" invariant is replaced by "zero workspaces →
empty state."

Hotkey `Ctrl+Shift+T` (new workspace) routes through the same async `add()`.

## `+tab` agent menu (Tabs feature) — `Terminal119.png` + Brave

- **Left-click** the top-right `+` → small popup menu anchored to the button:
  **New Claude tab / New Codex tab / New Brave tab** (built from
  `LauncherFeature.AGENTS`). This replaces today's "left = terminal,
  right = browser" behavior; the right-click-for-browser shortcut is removed
  (Brave is now in the menu).
- New method `TabsFeature.openAgentTab(agentType, { cwd })`:
  - `'claude'` / `'codex'` →
    `addTab(undefined, undefined, { type:'terminal', agentType, launchOptions:{ cwd, cmd: LauncherFeature.getAgentLaunch(agentType).cmd } })`
  - `'brave'` → `addTab(undefined, undefined, { type:'browser' })` (no cwd —
    browser tabs are naturally folder-exempt)
- `cwd` resolves from `WorkspacesFeature.getActiveWorkspace().folder` (Tabs
  already references `WorkspacesFeature` for persistence).
- **Ctrl+T** → `openAgentTab('claude', { cwd: <active workspace folder> })`
  (sensible default; opens Claude rather than the mouse menu).
- Tab titling is free: the existing detector titles the tab "Claude"/"Codex"
  from the injected command.

## Agent commands & the "no terminal" property

- `claude` → `claude --dangerously-skip-permissions`
- `codex` → `codex --yolo`
- `brave` → browser tab (existing `browser` tab type)

Because the PTY spawns **with `cwd` set**, there is **no `cd` line**. The agent
command lives in the `-EncodedCommand` startup script, so it is **not echoed**
as typed text — the user sees the agent boot, not shell scaffolding. The only
bare-shell exposure is *after* an agent exits (PowerShell `-NoExit` leaves a
prompt **in the folder**), which is acceptable.

## Remove Recent-Paths

- Delete `renderer/features/recent-paths/recent-paths.renderer.js` and
  `recent-paths.styles.css`.
- Remove `RecentPathsFeature.init();` at `renderer/app.js:6`.
- Remove the two includes at `renderer/index.html:16` and `:76`.
- **Remove the `RecentPathsFeature.setSuppressed(...)` calls in GridView**
  (`grid-view.renderer.js:151-152, 197-198`) — required cross-feature cleanup.
- History feature (`history:*`, `~/.yourterm/cd-history.json`) is untouched by
  this spec; only the renderer popup is removed. (Recording still happens via
  OSC capture; the read API simply has no consumer. Removing History entirely
  is out of scope.)

## Persistence — schema v3

Owned by Workspaces (`serialize()` / `bootFromState()`); TabsFeature delegates.

- **Workspace record** gains **`folder`** (absolute path string).
- **Terminal-tab records** gain **`agentType`** (`'claude'` | `'codex'`).
  Browser tabs keep their URL payload.
- **Migration:** any persisted `version < 3` is **discarded** ("start fresh")
  → boots into the empty state.

**Restore (relaunch each agent automatically):** on boot / workspace activate,
each terminal tab is **re-created through the agent-launch path** using its
persisted `agentType` and the workspace's `folder` — i.e. restore of an agent
tab is functionally `openAgentTab(agentType, { cwd: ws.folder })`, not a bare
PTY restore. Browser tabs restore via their existing URL payload. Consequence:
on startup every saved agent respawns at once as a **fresh** session.

## First-launch empty state

When there are **zero workspaces** (fresh install, post-wipe, or after closing
the last workspace): show a friendly empty state in the workspace/tab area with
a prominent **"Create workspace"** button. Clicking it runs the same
`add()` → `pickWorkspaceFolder()` flow (native dialog first if the root is
unset). No modal is forced on startup.

## Cross-feature seam (the deliberate isolation exception)

Dependency graph (Launcher is a leaf that the two cross-cutting features call):

- **Workspaces → Launcher** (`pickWorkspaceFolder`) and **→ Tabs**
  (`openAgentTab`, plus existing `setActiveWorkspaceContext` / `closeTab` /
  `requestSave`).
- **Tabs → Launcher** (`getAgentLaunch`, `AGENTS`) and **→ Workspaces**
  (`getActiveWorkspace().folder`; existing `serialize()`).

**Docs to update as part of the work:**

- `CLAUDE.md`: new "Launcher" section + note the new seam.
- `FEATURE-MAP.md`: add **Launcher**; remove **Recent Paths**; update **Tabs**,
  **Workspaces**, **Grid View** dependency lines; note schema v3.
- `.claude/rules/launcher.md`: new rule file for the feature.
- `.claude/rules/workspaces.md`: async `add()`, `folder` field, zero-workspace
  empty state (replaces always-one invariant), `openAgentTab` dependency.
- `.claude/rules/grid-view.md`: drop the `RecentPathsFeature.setSuppressed`
  dependency.
- `.claude/rules/recent-paths.md`: **delete**.
- Tabs rule (if present): the `+` menu, `openAgentTab`, `agentType` persistence.

## Edge cases

- **Root has no subfolders** → picker empty state with "Change main folder".
- **Agent not installed / exits immediately** → bare PowerShell prompt in the
  folder (acceptable; user can relaunch via the menu).
- **Non-PowerShell shell** → command injection uses the existing race-prone
  `cmd + '\r\n'` fallback (pre-existing limitation, unchanged).
- **`codex --yolo`** — flag taken from the user's selection; verify it is the
  intended invocation during implementation.
- **Folder deleted between launches** → `resolveCwd()` already falls back to
  `USERPROFILE`; the relaunched agent would start there. Acceptable; optionally
  warn later (out of scope).

## Assumptions to confirm during planning

- `Ctrl+T` opening a Claude tab (rather than the menu) is acceptable.
- Removing the right-click-for-browser shortcut on `+` is acceptable (Brave is
  in the menu).
- Relaunching every agent on startup (fresh sessions, possibly many at once) is
  the desired trade-off for the "no bare terminal" experience.
