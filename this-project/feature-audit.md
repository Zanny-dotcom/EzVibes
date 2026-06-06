# EZvibes Feature Audit

Audit date: 2026-06-06

This audit covers the complete project at `C:\Users\Oskari\Documents\EZvibes`.
It is a feature, UX, and operational-needs inventory only. It intentionally does
not review the code for bugs.

The audit was assembled from parallel read-only sub-agent passes over:

- Renderer UX: `renderer/index.html`, `renderer/app.js`, `renderer/panel-mode.js`, `renderer/styles.css`
- Electron/runtime surface: `main.js`, `preload.js`, `lib/`, `scripts/`, `startup/`, tests, package files
- Documentation/positioning/marketing: `CLAUDE.md`, `docs/`, `inbox/`, `research/`, `marketing/remotion/`

## Executive Summary

EZvibes is a local Windows-oriented Electron desktop app that turns folders into
agent-powered projects. Its core product loop is:

1. Browse folders in an Explorer-style grid.
2. Launch a Claude terminal session scoped to a folder.
3. Keep that session in an embedded folder-shaped terminal window.
4. Add Claude or Codex tabs for the same folder.
5. Use visual helpers like minimized orange folders, "What Was Made",
   `inbox`, `ACTIVATE`, Live Log, and Panel Mode to work with those agents.

EZvibes itself does not directly call Anthropic, OpenAI, or any other cloud API.
It launches local command-line tools (`claude` and `codex`) inside a pseudo
terminal. Any model authentication, paid plan, subscription, or API credit
requirement belongs to those external CLI tools, not to EZvibes directly.

The repo also contains a Remotion marketing-video project. That project is real
and runnable, but it is separate from the Electron app.

## Product Positioning

The strongest implemented positioning is:

> EZvibes turns folders into agent-powered projects.

The current app is not a full IDE, browser workspace, visual HTML editor, hosted
service, or packaged commercial installer yet. It is a local folder launcher for
Claude/Codex terminal sessions with visual UX affordances aimed at making
agentic coding feel more approachable.

The broader planning and marketing documents point toward a future non-coder
"vibecoding" product: prompt vaults, browser previews, click-to-edit webpage
elements, visual HTML editing, and less terminal anxiety. Those broader ideas
are not all implemented in the current app.

## Implemented App Features

### 1. Electron Desktop Shell

Sources: `main.js`, `preload.js`, `renderer/index.html`, `renderer/styles.css`

- Runs as a standalone Electron app.
- Main entry point is `main.js`.
- Renderer shell is `renderer/index.html`.
- Uses a preload bridge exposed as `window.ezvibes`.
- Uses a fixed local app page, not a remote web app.
- Creates a desktop window titled `EZvibes`.
- Default window size is 1500x930 with minimum size 980x640.
- Uses `renderer/ezvibes.ico` as the app icon.
- Sets Windows AppUserModelID to `com.ezvibes.app`.
- Hides the default Electron application menu and menu bar.
- Blocks new windows and prevents navigation away from the local app file.
- Denies renderer permission requests/checks through Electron session handlers.
- Has a topbar with:
  - EZvibes title
  - Back button
  - Up button
  - Refresh button
  - Current path bar
  - Folder search input
  - "What Was Made" toggle
  - Panel Mode toggle
  - `LOG` Live Log toggle

### 2. Folder-First Project Browser

Sources: `renderer/app.js`, `main.js`, `preload.js`

- Starts in the user's Documents folder.
- Displays filesystem entries in an Explorer-style folder grid.
- Directories and files are both displayed.
- Directories are sorted before files.
- Entry cards show the entry name and an icon style.
- Folder/file data includes:
  - name
  - absolute path
  - kind (`directory` or `file`)
  - size
  - modified time
  - hidden flag
- Sidebar "Places" quick paths are supplied by main process:
  - Home
  - Desktop
  - Documents
  - Downloads
  - EZvibes, when present under Documents
- Back navigation uses an in-memory history stack.
- Up navigation goes to the parent folder.
- Refresh re-reads the current directory.
- Path bar displays the current absolute folder path.
- Search filters visible entries by entry name.
- Folder count text changes based on normal view vs active-session view.
- Single-clicking a folder selects/previews it.
- Preview selection also drives the current folder context for "What Was Made".
- Context-menu "Open Folder" navigates into a directory.
- Dragging a disk-backed folder/file into the app outside a terminal can navigate
  to the dropped path if the path is a directory.
- Files currently appear in the grid, but file-specific actions are not a
  shipped feature beyond display and drag/path behavior.

### 3. Active Sessions View

Sources: `renderer/app.js`, `renderer/index.html`

- Sidebar has an `ACTIVE SESSIONS` button.
- Switching to this view replaces the normal folder grid with session-root
  folders.
- Shows a count like `No active sessions`, `1 active session`, or
  `N active sessions`.
- Search also filters the active-session list.
- Empty state explains that launching Claude in a folder will populate the view.
- Session cards reflect minimized/open/attention states.

### 4. Folder Operations

Sources: `renderer/app.js`, `main.js`, `lib/path-safety.js`, `test/path-safety.test.js`

#### New Folder

- Command bar has a `New Folder` button.
- `Ctrl+Shift+N` also starts folder creation.
- Creation happens through an inline draft card in the grid.
- Draft input placeholder is `Folder name`.
- `Enter` commits.
- Blur commits if non-empty, or cancels if empty.
- `Escape` cancels.
- Visible inline error text appears for invalid names or failed creation.
- Main process validates folder names.
- Main process creates the folder with filesystem APIs.
- New folder is selected after creation.
- Creation adds a narration event for the folder context.

#### Rename Folder

- Folder context menu has `Rename`.
- Rename is inline on the folder card.
- `Enter` commits.
- Blur commits if changed.
- `Escape` cancels.
- Visible inline error text appears on invalid names or failed rename.
- Rename is disabled when the folder has a live session.
- Main process validates the new name and performs the rename.
- Case-only renames on Windows are handled by a temporary intermediate rename.
- Rename adds a narration event.

#### Delete Folder

- Folder context menu has danger-styled `Delete`.
- Delete asks for confirmation in an alert dialog.
- Confirm label is `Delete`; cancel label is `Cancel`.
- Delete moves the folder to the OS trash/recycle bin through Electron
  `shell.trashItem`.
- Renderer refuses deletion if a live session exists at or under the folder.
- Main process also enforces immediate-child containment and live-session guards.
- Delete is disabled while the exact folder has a live session.
- Delete adds a narration event after success.

#### Context Menu Folder Actions

Directory cards expose:

- `Open Folder`
- `Launch Claude`
- `Restore Session` or `Minimize Session`, when a session exists
- `Close Session`, when a session exists
- `Rename`
- `Delete`

File cards currently expose `No folder actions`.

### 5. Claude/Codex Session Windows

Sources: `renderer/app.js`, `main.js`, `preload.js`, `CLAUDE.md`

- `Launch Claude Here` starts a Claude session for the current folder.
- Folder context menu `Launch Claude` starts a Claude session for that folder.
- Double-clicking a folder card launches or restores a Claude session for that
  folder.
- There is one session window per folder path.
- Launching a folder that already has a session restores/focuses that session
  instead of creating a duplicate session window.
- Session windows are folder-shaped popups.
- The session window displays:
  - yellow folder-like frame
  - tab strip
  - folder-name label
  - minimize control
  - close control
  - terminal pocket
- Folder-name label shows the basename of the session folder.
- Hovering the folder-name label exposes the full path through the title text.
- Opening uses a Genie-style animation from the folder card when possible.
- Minimizing animates back toward the source folder card when possible.
- Minimized session windows are hidden but their PTYs keep running.
- A folder card turns orange / minimized-styled while its session window is
  minimized.
- Restoring clears session attention state and refocuses the active tab.
- Closing a session window closes every tab and kills every associated PTY.
- Closing a live session window asks for confirmation.
- Closing the app while live PTYs exist asks for confirmation before exit.

### 6. Terminal Tabs

Sources: `renderer/app.js`, `main.js`

- Each session window has a Chrome-style tab strip.
- First tab for a newly launched folder is always Claude.
- Tabs are independent PTY sessions in the same folder.
- Supported agent types are currently:
  - Claude
  - Codex
- Claude tab chips use a Claude/amber visual identity.
- Codex tab chips use a distinct teal visual identity.
- Tab chips show short agent badges:
  - `CL` for Claude
  - `CX` for Codex
- Default labels are:
  - `CLAUDE`
  - `CODEX`
  - `CLAUDE 2`, `CODEX 3`, etc. for later tabs
- Per-window tab counters are monotonic and are not reused after a tab closes.
- Active, hover, and exited states are styled on tab chips.
- Each tab has a close button.
- Closing an exited/failed tab does not require confirmation.
- Closing a live mid-window tab closes that tab without closing the whole window.
- Closing the last live tab asks for confirmation because it closes the session
  window.
- Right-clicking a tab exposes `Rename`.
- Custom tab names override the default label.
- Entering the literal default label clears the custom name.
- The `+` button opens a new-tab menu with:
  - `New Claude tab`
  - `New Codex tab`
- Right-clicking the `+` button also creates a Codex tab.
- Tab keyboard support includes:
  - ArrowLeft / ArrowRight to move between tabs
  - Home / End
  - Delete to close a tab
  - F6 or Shift+Tab from terminal back to tab focus
- New-tab menu keyboard support includes:
  - ArrowUp / ArrowDown
  - Escape
  - Tab close behavior

### 7. Embedded Terminal UX

Sources: `renderer/app.js`, `preload.js`, `main.js`, `package.json`

- Terminal rendering uses `@xterm/xterm`.
- Terminal fitting uses `@xterm/addon-fit`.
- PTY sessions use `node-pty`.
- Terminals open inside `.terminal-host` inside a `.terminal-pocket`.
- The renderer waits for usable visible layout before fitting terminals.
- Visible active terminals are refit on:
  - open animation completion
  - font readiness
  - resize
  - focus/visibility return
  - restore from minimized
  - tab activation
- Hidden/inactive terminals are marked for repair and refreshed when revealed.
- Terminal scroll position is tracked so reveal/resize can preserve bottom scroll
  behavior.
- Terminal output is written into xterm.
- Terminal input is written through IPC to the PTY.
- Terminal exits append a visible exit line in the terminal.
- Failed launches write the error message into the terminal.

#### Terminal Copy/Paste

- Terminal context menu provides:
  - Copy
  - Paste
  - Select All
- Copy is disabled when there is no terminal selection.
- Clipboard access goes through Electron main process.
- `Ctrl+C` in terminal preserves terminal interrupt behavior unless text is
  selected.
- `Ctrl+V` pastes clipboard text into the terminal.
- Editable inputs also support app-level Ctrl+C/Ctrl+V/Ctrl+X/Ctrl+A handling.
- Paste into terminal uses xterm paste when available.
- Fallback paste normalizes newlines to carriage returns.
- Bracketed paste mode is respected when available.

#### Terminal Drag and Drop

- Dragging files over a terminal highlights the drop target.
- Dropping disk-backed files into a terminal inserts quoted file paths.
- Multiple paths are joined with spaces.
- Dropping files into editable inputs inserts paths into that input.
- Dropping outside terminals can navigate to the first dropped disk-backed path.
- Pathless dropped image files are supported by saving them to disk first.
- Supported dropped image extensions include:
  - `.png`
  - `.jpg`
  - `.jpeg`
  - `.gif`
  - `.webp`
  - `.bmp`
  - `.tif`
  - `.tiff`
- Pathless dropped images are saved under:
  - `<terminal cwd>\.ezvibes-drops\YYYY-MM-DD\...`
- Dropped image limits:
  - max 20 files per drop
  - max 50 MB per image
  - max 150 MB total per drop

#### Terminal Notifications and Attention

- Renderer parses OSC notification sequences from terminal output.
- Supported notification families include OSC 9 and OSC 777 notify patterns.
- Notifications are classified as:
  - needs attention
  - completed
  - generic notification
- Needs-attention notifications mark the tab/session.
- Minimized folder cards can show attention styling.
- Completed notifications can update narration summary.

### 8. Agent Launching

Sources: `main.js`, `CLAUDE.md`

EZvibes supports two agent profiles:

#### Claude

- Search commands:
  - `claude.exe`
  - `claude.cmd`
  - `claude.ps1`
  - `claude`
- Launch arguments:
  - `--dangerously-skip-permissions`
- Initial folder session uses Claude.
- `Launch Claude Here` always uses Claude.

#### Codex

- Search commands:
  - `codex.exe`
  - `codex.cmd`
  - `codex.ps1`
  - `codex`
- Launch arguments:
  - `--yolo`
- Main process has extra logic to find native binaries from installed
  `@openai/codex` package roots.
- Platform package probing includes Windows, macOS, and Linux target names, but
  the surrounding startup/shortcut system is Windows-oriented.
- Codex tabs are created from the session `+` menu or right-clicking the `+`
  button.

#### Launch Wrappers

Main process can launch direct executables, `.cmd` wrappers, and `.ps1` wrappers:

- `.cmd` wrappers are run through `cmd.exe` / `ComSpec`.
- `.ps1` wrappers are run through `powershell.exe -NoProfile -ExecutionPolicy Bypass`.

### 9. PTY Environment Handling

Sources: `main.js`

When launching Claude/Codex, EZvibes does not pass the entire parent process
environment. It builds a smaller PTY environment.

Allowed environment basics include:

- command resolution paths such as `PATH` and `PATHEXT`
- Windows system roots/drives
- user profile paths
- temp paths
- npm and `.local\bin` command folders
- `CLAUDE_` / `CLAUDECODE` prefixed variables when not classified as sensitive

Sensitive-looking variables are filtered out. This includes variables whose
names contain:

- `KEY`
- `TOKEN`
- `SECRET`

Provider/security prefixes are also stripped:

- `AWS_`
- `AZURE_`
- `OPENAI_`
- `ANTHROPIC_`

Operational meaning: if an external CLI depends only on environment variables
like `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, those variables will not be passed
to the spawned PTY. The intended operating mode is that Claude/Codex CLIs are
installed and authenticated through their own normal local credential/session
mechanisms outside EZvibes.

### 10. Inbox Feature

Sources: `renderer/app.js`, `main.js`, `preload.js`, `inbox/`

- Command bar has an `inbox` button.
- Clicking opens an Inbox popover.
- Main process lists markdown files from repo-local `inbox/`.
- Only `.md` files are listed.
- Inbox popover states:
  - loading
  - unavailable/error
  - empty
  - file list
- Inbox subtitle shows the inbox path.
- Inbox count shows the number of markdown files.
- Listed files show display names without `.md`.
- Clicking listed files is suppressed; the main interaction is hold-drag.
- Holding and dragging the `inbox` button creates a draggable inbox-path ghost.
- Holding and dragging an inbox markdown file creates a draggable file ghost.
- Dropping the ghost onto an open Claude/Codex tab sends data to that terminal.
- Dropping on no valid terminal shows a toast.
- Dropping on a terminal that is not ready shows an error toast.
- For markdown files with fewer than 50 words, the app may send the file content
  instead of the path.
- Otherwise it sends the file path.
- Successful send shows a toast like `Path sent to Claude.`

### 11. ACTIVATE Feature

Sources: `renderer/app.js`, `main.js`, `preload.js`, `activate/Ezvibes.md`

- Command bar has an `ACTIVATE` button.
- Main process ensures repo-local `activate/Ezvibes.md` exists on startup.
- Single-click behavior:
  - gets the activate file path
  - sends that path to the current ready terminal tab when available
  - focuses the terminal when visible
  - falls back to copying the path to clipboard if no ready terminal exists
- Double-click behavior:
  - opens `activate/Ezvibes.md` in Notepad
- The activate markdown file currently instructs generated markdown outputs to
  be saved in the repo `inbox/` folder with kebab-case names.

### 12. "What Was Made" Narration Sidebar

Sources: `renderer/app.js`, `renderer/index.html`, docs/superpowers narration plans

- Topbar has a narration toggle.
- Sidebar title is `What Was Made`.
- Sidebar shows the selected/previewed folder path or current folder path.
- Narration is tracked per folder path in memory.
- Empty state explains there is no Claude activity yet.
- Narration includes:
  - status chip
  - summary text
  - timeline of events
  - event times
  - event descriptions
- Status values include:
  - idle
  - active
  - waiting
  - completed
  - closed
  - error
- Events can be added for:
  - session started
  - tab created
  - tab started
  - tab closed
  - session closed
  - folder created
  - folder renamed
  - folder deleted
  - user task entered in terminal
  - agent notification
  - agent attention needed
  - agent completion
  - launch errors
- Terminal input buffering captures submitted user text and records it as
  `User asked: "..."`
- Terminal output scanning looks for broad hints such as sub-agent activity or
  plan creation and records narration hints.
- Narration is in-memory only and is lost on app restart.

### 13. Live Log

Sources: `renderer/app.js`, `main.js`, `preload.js`, `CLAUDE.md`

- Topbar has a `LOG` button.
- Opens a right-side Live Log drawer.
- Drawer shows:
  - title `Live Log`
  - current disk log file path
  - recent log rows
- Main process keeps an in-memory live-log ring of 500 entries.
- Renderer displays the most recent 300 rows.
- Disk logs are JSONL files under:
  - Electron `app.getPath('userData')\logs\ezvibes-YYYY-MM-DD.jsonl`
  - fallback: `%USERPROFILE%\AppData\Roaming\EZvibes\logs`
- Log entries include:
  - timestamp
  - level
  - event name
  - pid
  - sanitized details
- Live logs cover app/window lifecycle, close attempts, renderer events, PTY
  creation/exits/kills, dropped-file events, and related diagnostics.
- Project docs state logs intentionally do not record terminal input/output,
  prompts, model responses, or shell scrollback.

### 14. Panel Mode

Sources: `renderer/panel-mode.js`, `renderer/app.js`, `renderer/index.html`,
`renderer/styles.css`, panel-mode docs

Panel Mode is an in-app UI selection and request composer for modifying EZvibes
itself.

- Topbar has a Panel Mode toggle.
- When active, the app body gets panel-mode styling.
- Hovering registered UI regions shows a highlight overlay.
- Highlight chip displays the friendly region name.
- Clicking a registered region opens a composer.
- Normal app clicks are swallowed while selecting a panel region.
- Right-click clears highlight while active.
- Escape:
  - closes composer if composer is open
  - otherwise exits Panel Mode
- Composer shows:
  - region name
  - selector such as `[data-panel-id="..."]`
  - source file and line metadata from the registry
  - region description
  - textarea placeholder `Describe the change...`
  - Cancel button
  - Send button
- `Ctrl+Enter` / `Cmd+Enter` sends from the textarea.
- Payload format includes:
  - `[EZvibes panel-mode request]`
  - target region name
  - selector
  - source file/line
  - region description
  - user's request text
- Dispatch target:
  - active live terminal tab for the hard-coded EZvibes folder path
  - clipboard fallback when no matching live terminal is available
- Terminal dispatch wraps the payload in bracketed-paste markers.
- Clipboard fallback shows a composer toast.
- Static selectable regions are tagged in `renderer/index.html`.
- Dynamic selectable regions are tagged in `renderer/app.js`.
- Region registry includes:
  - topbar
  - nav buttons
  - path bar
  - search
  - narration toggle
  - panel toggle
  - live-log toggle
  - sidebar
  - active sessions link
  - Places list
  - content area
  - command bar
  - Launch Claude Here button
  - inbox button
  - ACTIVATE button
  - New Folder button
  - folder count
  - folder grid
  - narration sidebar
  - live-log drawer
  - folder cards
  - session windows
  - tab strip
  - session header
  - tab chips
  - new-tab button
  - folder-name label
  - session controls
  - terminal pocket

Panel Mode depends on `window.ezvibesInternals` from `renderer/app.js` and a
hard-coded path:

- `C:\Users\Oskari\Documents\EZvibes`

If the repo moves, Panel Mode's direct-to-terminal dispatch path needs that
constant updated or it will fall back to clipboard.

### 15. App Close and Destructive Action Confirmations

Sources: `renderer/app.js`, `main.js`

- Closing a live terminal/session can show an in-app modal confirmation.
- Closing the last tab in a live session asks for confirmation.
- Closing a session window with live tabs asks for confirmation.
- Closing the whole app while live PTYs exist asks for confirmation.
- App-close confirmation copy explains that exiting ends Claude/Codex sessions
  and loses terminal scrollback.
- Safe default for app close is to stay in the app.
- Delete-folder confirmation explains the folder is moved to Recycle Bin.
- Dialogs use alertdialog-style semantics and return focus when possible.

### 16. Keyboard and Accessibility-Oriented UX

Sources: `renderer/app.js`, `renderer/index.html`, `renderer/panel-mode.js`

Implemented keyboard/interaction affordances include:

- Back/Up/Refresh buttons.
- Search input.
- `Ctrl+Shift+N` for New Folder.
- Escape dismisses context menu, inbox hold/popover, and Panel Mode state.
- Inline new-folder and rename inputs:
  - Enter commit
  - Escape cancel
  - blur commit/cancel depending state
- Terminal focus escape:
  - F6
  - Shift+Tab
- Tab strip:
  - ArrowLeft
  - ArrowRight
  - Home
  - End
  - Delete
- New-tab menu:
  - ArrowUp
  - ArrowDown
  - Escape
  - Tab
- Modal confirmation:
  - Escape cancels
  - Tab cycles between buttons
  - Enter confirms only when confirm button is focused
- Inbox popover has dialog semantics and restores focus to the inbox button
  when closed through its close control.
- Toasts use status/aria-live semantics.

### 17. Visual Design and UX Language

Sources: `renderer/styles.css`, `renderer/index.html`, Remotion marketing scenes

The implemented app visual language includes:

- dark desktop-app background
- Explorer-like topbar/sidebar/content layout
- folder-card grid
- CSS-drawn folder/file icons
- yellow folder-shaped terminal windows
- orange minimized folder state
- teal Codex chip accents
- amber/Claude chip accents
- green/attention/success states
- glassy Inbox popover styling
- right-side side panels for narration and logs
- hover/active/exited tab states
- Genie-like open/minimize motion
- panel-mode highlight overlay and composer

Primary on-screen terminology includes:

- `EZvibes`
- `Places`
- `ACTIVE SESSIONS`
- `Launch Claude Here`
- `inbox`
- `ACTIVATE`
- `New Folder`
- `What Was Made`
- `Panel Mode`
- `Live Log`
- `CLAUDE`
- `CODEX`

## Runtime Needs

### Operating System

The project is strongly Windows-oriented.

Windows-specific pieces include:

- `notepad.exe` for ACTIVATE double-click.
- `wscript.exe` launcher through `ezvibes.vbs`.
- PowerShell startup/shortcut scripts.
- Start Menu shortcut creation.
- optional Startup folder shortcut.
- taskbar pin refresh.
- Windows AppUserModelID.
- Windows icon cache refresh through `ie4uinit.exe`.
- Windows reserved filename validation.
- `.cmd` and `.ps1` launcher handling.
- Recycle Bin behavior through Electron shell.

Some lower-level code has cross-platform branches, but the product, docs, paths,
startup flow, and operational scripts are Windows-first.

### Node/NPM/Electron

Root app requirements:

- Node.js `>=22.12.0`
- npm
- Electron `^42.2.0`
- native `node-pty` build support
- installed `node_modules`

Root app npm scripts:

- `npm start`: run Electron app
- `npm test`: run Node built-in tests
- `npm run check:syntax`: syntax-check main/preload/renderer/scripts
- `npm run electron:install`: preinstall Electron runtime
- `npm run rebuild:native`: rebuild `node-pty` against Electron
- `npm run rebuild`: run postinstall rebuild flow

Fresh setup flow documented by the repo:

```powershell
npm install
npm run electron:install
npm run rebuild:native
npm start
```

Shortcut setup flow:

```powershell
npm install
npm run electron:install
npm run rebuild:native
./startup/Install-EzvibesShortcuts.ps1
```

Optional auto-launch at sign-in:

```powershell
./startup/Install-EzvibesShortcuts.ps1 -CreateStartupShortcut
```

### Native Build Toolchain

Because the app uses `node-pty`, setup/rebuild requires a working native build
toolchain for Electron native modules on the host machine. On Windows, that
usually means the appropriate Visual Studio C++ build tools and Python/node-gyp
environment expected by native Node packages.

The repo includes `scripts/postinstall.js`, which:

- patches `node-pty` build files
- disables Spectre mitigation settings in generated/native build files
- runs local `electron-rebuild`
- rebuilds `node-pty` from source for Electron

### Root App Dependencies

Runtime dependencies from root `package.json`:

- `@xterm/xterm`
- `@xterm/addon-fit`
- `node-pty`

Development/runtime launcher dependencies:

- `electron`
- `@electron/rebuild`

### External Agent Executables

For the main product loop, the machine needs:

- Claude CLI installed and discoverable on PATH, or via one of the checked
  command names.
- Codex CLI installed and discoverable on PATH or installed as an `@openai/codex`
  package in a probed npm location.

Checked Claude command names:

- `claude.exe`
- `claude.cmd`
- `claude.ps1`
- `claude`

Checked Codex command names:

- `codex.exe`
- `codex.cmd`
- `codex.ps1`
- `codex`

Codex native package roots are also probed under:

- global npm location under `%APPDATA%\npm\node_modules\@openai\codex`
- package roots inferred from codex shims
- project-local `node_modules\@openai\codex`

### Filesystem Access

EZvibes needs the current Windows user to have permission to:

- read directories being browsed
- create folders
- rename folders
- move folders to Recycle Bin
- write `.ezvibes-drops` images into terminal working directories
- read repo-local `inbox/*.md`
- create/read repo-local `activate/Ezvibes.md`
- write app log files under Electron user data/AppData
- create user Start Menu shortcuts when running the startup installer
- optionally create a user Startup shortcut
- optionally refresh an existing taskbar pin

No admin-only operation is visible for normal app runtime. Some environments may
still require PowerShell execution-policy allowance for running setup scripts.

### Clipboard Access

EZvibes uses Electron clipboard APIs for:

- copying terminal selections
- pasting into terminals
- copy/cut/paste in editable inputs
- ACTIVATE fallback when no terminal is ready
- Panel Mode fallback when no target terminal is found

Clipboard is therefore part of the UX contract and can communicate data to/from
other desktop apps through normal OS clipboard behavior.

### Local Persistent Storage

EZvibes persists or creates:

- `activate/Ezvibes.md`
- `inbox/` markdown folder
- `.ezvibes-drops/YYYY-MM-DD/` inside terminal working directories
- AppData/userData logs:
  - `logs/ezvibes-YYYY-MM-DD.jsonl`
- Start Menu shortcut:
  - `%APPDATA%\Microsoft\Windows\Start Menu\Programs\ezvibes.lnk`
- optional Startup shortcut:
  - `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ezvibes.lnk`
- refreshed existing taskbar pin when present
- `node_modules/`
- Remotion output files under `marketing/remotion/out/` when rendered

In-memory only:

- open session windows
- tab state
- custom tab names
- folder preview
- active sessions view state
- narration events
- minimized/open card state
- live log ring

These in-memory states are lost when the app exits.

## External Communications

### Direct Communications by EZvibes

The Electron app directly communicates with:

- local filesystem
- Electron main/renderer IPC
- Windows shell services
- OS clipboard
- Windows Recycle Bin / trash API through Electron shell
- local PTY child processes
- `notepad.exe`
- `cmd.exe` or `powershell.exe` when needed for launch wrappers
- `wscript.exe` when launched from the VBS shortcut
- Start Menu/taskbar shortcut locations through setup scripts

### Network Communications

No direct runtime network API integration is present in the Electron app code.
There is no app-owned backend URL, fetch client, WebSocket client, SDK client,
database client, telemetry vendor, or OAuth callback flow in the implemented app
surface.

Network use can still happen indirectly:

- Claude CLI may communicate with Anthropic/Claude services.
- Codex CLI may communicate with OpenAI/Codex services.
- npm install downloads packages from npm registries.
- `npm run electron:install` downloads/installs the Electron runtime when needed.
- Remotion first render may download Chromium as part of its rendering toolchain.
- Remotion Studio opens a local development UI in the browser.

### Other Desktop Apps It Communicates With

Directly or indirectly, the project uses:

- Claude CLI
- Codex CLI
- Notepad
- Electron runtime
- Windows Script Host (`wscript.exe`)
- PowerShell
- Command Prompt / `cmd.exe`
- Windows Explorer shell services / Start Menu / taskbar shortcut system
- Windows clipboard
- default browser for Remotion Studio
- Chromium for Remotion rendering

## Authentication, API Keys, and Subscriptions

### Required Directly by EZvibes

No direct API keys are required by EZvibes itself.

No direct app-owned authentication system is present:

- no user login screen
- no OAuth client
- no `.env` API-key loading in the app
- no hosted backend credentials
- no database credentials
- no cloud bucket credentials
- no Anthropic SDK integration
- no OpenAI SDK integration
- no Stripe/payment integration
- no telemetry service key

Normal runtime does require the user to be logged into Windows and have local
filesystem/process permissions.

### Required by External Agent CLIs

To actually use the agent terminal features, the external command-line tools
need to be installed and authenticated outside EZvibes:

- Claude CLI must be installed and authenticated according to that CLI's current
  requirements.
- Codex CLI must be installed and authenticated according to that CLI's current
  requirements.

Depending on the user's provider setup, those tools may require:

- a Claude/Anthropic account, subscription, or API credit arrangement
- an OpenAI/Codex account, subscription, or API credit arrangement
- local CLI login/session files
- provider-specific command-line configuration

The repo does not define those credentials. EZvibes only spawns the CLI process.

Important operational detail: EZvibes intentionally strips environment variables
whose names look like keys, tokens, secrets, or provider credentials before
launching PTYs. That means provider API keys in environment variables are not
the reliable auth path for spawned agents in this app. Local CLI login/session
configuration is the expected path.

### Required by Setup and Marketing Tools

- npm registry access is needed to install packages unless dependencies are
  already cached.
- No private npm package/auth requirement is visible in package files.
- Remotion local rendering does not show a required cloud subscription.
- Remotion audio/music is optional and not currently built into the video.
- Publishing/uploading marketing output to social platforms would require those
  platforms' accounts, but that is outside this repo.

## Remotion Marketing Project

Sources: `marketing/remotion/package.json`, `marketing/remotion/src/`,
`inbox/remotion-marketing-video-setup.md`

The repo includes a separate Remotion project at:

```text
marketing/remotion
```

Purpose:

- 120-second EZvibes marketing video
- targeted at complete non-coders curious about "vibecoding"
- emphasizes making app creation feel like opening a folder

Compositions:

- `EZvibesMain`
  - 1920x1080
  - landscape / website hero
- `EZvibesShorts`
  - 1080x1920
  - vertical / TikTok / Instagram / Shorts

Remotion scripts:

- `npm start`
  - opens Remotion Studio
- `npm run build`
  - renders `EZvibesMain` to `out/ezvibes-main.mp4`
- `npm run build:shorts`
  - renders `EZvibesShorts` to `out/ezvibes-shorts.mp4`
- `npm run build:all`
  - renders both
- `npm run upgrade`
  - runs Remotion upgrade tooling

Remotion dependencies:

- `@remotion/cli`
- `@remotion/google-fonts`
- `react`
- `react-dom`
- `remotion`
- TypeScript types/tooling

Marketing scene sequence:

1. `SceneWall`
   - scary terminal wall
   - frames the intimidation problem
2. `ScenePromise`
   - warm folder metaphor
   - "What if making apps was as easy as opening a folder?"
3. `SceneReveal`
   - first look at EZvibes folder grid
   - every folder is a project
4. `ScenePickAndAsk`
   - right-click Launch Claude
   - folder unfolds into session window
   - user asks for a birthday-card website in plain English
5. `SceneMagic`
   - upcoming Add-a-Feature flow
   - step cards and "+1 feature added today"
   - this appears to be planned/marketing, not a shipped Electron feature
6. `SceneWin`
   - multi-project view
   - orange minimized folders
   - Claude/Codex chips
   - What Was Made sidebar
   - Panel Mode demo
7. `SceneCTA`
   - EZvibes logo
   - tagline / reassurance pills

Marketing needs:

- optional music/audio if desired
- final CTA/URL decisions
- vertical composition polish
- careful separation between implemented features and planned Add-a-Feature
  marketing sequence

## Startup, Shortcut, and Launch Features

Sources: `startup/README.md`, `startup/Install-EzvibesShortcuts.ps1`,
`ezvibes.vbs`, `scripts/build-ezvibes-icon.ps1`

Implemented support:

- VBS launcher starts Electron without a console window flash.
- Launcher checks for `node_modules\electron\dist\electron.exe`.
- If Electron runtime is missing, launcher shows a message telling the user to
  run setup commands.
- Shortcut installer creates user Start Menu shortcut.
- Shortcut installer stamps AppUserModelID on shortcuts.
- Shortcut installer uses `renderer/ezvibes.ico`.
- Shortcut installer can refresh an existing taskbar pin.
- Shortcut installer can create an optional Startup shortcut for auto-launch at
  sign-in.
- First-time taskbar pinning still requires a manual Windows action.
- Icon generator can rebuild `renderer/ezvibes.ico`.

Startup files created/used:

- `ezvibes.vbs`
- `renderer/ezvibes.ico`
- Start Menu `ezvibes.lnk`
- optional taskbar `ezvibes.lnk`
- optional Startup `ezvibes.lnk`

## Testing and Verification Features

Sources: `package.json`, `lib/path-safety.js`, `test/path-safety.test.js`

Implemented test/verification commands:

- `npm test`
  - Node built-in test runner
- `npm run check:syntax`
  - syntax-checks main/preload/renderer/scripts

Implemented unit-test coverage:

- `isPathInside`
- `isImmediateChildOf`
- `liveSessionAtOrUnder`

These tests cover the pure path-safety helpers used by main-process folder
operation guards.

## Planned or Adjacent Features Mentioned in Docs

These appear in docs, plans, research, or marketing notes, but should not be
treated as fully shipped app features unless separately implemented later.

### Prompt Vault

Planned/adjacent idea:

- clickable markdown prompt vault
- fuzzy search
- tags
- hover preview
- bracketed-paste into terminal
- likely file watching
- likely `chokidar`
- Liquid Glass / Mica-style design

### Browser Workspace / Browser Design Mode

Planned/adjacent idea:

- localhost preview tabs attached to folder sessions
- web page element selection
- targeted design requests sent to Claude/Codex
- secure preview isolation
- likely `WebContentsView`
- localhost-only navigation constraints

Docs explicitly separate EZvibes Panel Mode from future webpage/browser design
mode. Current Panel Mode selects EZvibes app UI, not arbitrary webpages.

### Visual HTML Editor / Locomotor

Adjacent/sibling-product idea:

- open `.html`
- visually edit DOM elements
- save back to file
- use embedded Claude terminal
- non-coder editing workflow

### Element Inspector

Adjacent/sibling-product idea:

- select DOM elements in browser/preview
- send lean structured payloads to agents
- source-locator/context handoff

### Workspace/Grid Redesigns

Some inbox docs describe different terminal-emulator/workspace architectures.
These should be treated as planning or sibling-product context, not current
EZvibes app behavior.

### Add-a-Feature Flow

The Remotion marketing video includes an Add-a-Feature sequence with step cards
and a "+1 feature added today" counter. This is marketing/upcoming context, not
clearly implemented in the current Electron app.

### Packaging / Distribution

Docs point toward future packaged distribution:

- electron-builder
- NSIS installer
- ASAR unpack handling for `node-pty`

Current repo has shortcut/startup support, but no complete packaged installer
configuration.

## Needs Not Found

The following needs were not found in the implemented app:

- no app backend server
- no database
- no cloud storage
- no direct Anthropic API call
- no direct OpenAI API call
- no OpenAI/Anthropic SDK dependency in the root app
- no `.env`-driven app configuration
- no app-specific OAuth flow
- no browser extension
- no packaged installer config
- no persistent session restore
- no multi-window support
- no filesystem watcher for live folder refresh
- no prompt vault implementation in the current renderer
- no browser preview/design-mode implementation in the current renderer
- no visual HTML editor implementation in the current renderer

## Source Map

Primary implementation sources:

- `package.json`
- `main.js`
- `preload.js`
- `renderer/index.html`
- `renderer/app.js`
- `renderer/panel-mode.js`
- `renderer/styles.css`
- `lib/path-safety.js`
- `scripts/postinstall.js`
- `scripts/build-ezvibes-icon.ps1`
- `startup/README.md`
- `startup/Install-EzvibesShortcuts.ps1`
- `ezvibes.vbs`
- `test/path-safety.test.js`

Primary documentation/positioning sources:

- `CLAUDE.md`
- `best-way.md`
- `summary_recap.md`
- `activate/Ezvibes.md`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `inbox/`
- `research/`

Marketing project sources:

- `marketing/remotion/package.json`
- `marketing/remotion/src/Root.tsx`
- `marketing/remotion/src/compositions/MainVideo.tsx`
- `marketing/remotion/src/theme/tokens.ts`
- `marketing/remotion/src/scenes/`
- `marketing/remotion/src/components/`
- `inbox/remotion-marketing-video-setup.md`

