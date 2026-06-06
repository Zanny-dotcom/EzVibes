# tmux Info

Date researched: June 6, 2026  
Requested freshness window: March 6, 2026 through June 6, 2026

## Executive summary

tmux is a terminal multiplexer. It runs inside a terminal emulator, starts a long-lived tmux server, and lets you create persistent sessions containing windows and panes. Each pane is its own pseudo-terminal running a shell or program. You can detach from a session, close the outer terminal or lose SSH, then reattach later while the programs inside tmux keep running.

tmux is not PowerShell, not a replacement for PowerShell, and not a replacement for Windows Terminal. PowerShell is a shell and scripting language. Windows Terminal is a terminal host. tmux sits between a terminal host and the shell/programs running inside tmux panes.

For AI coding agents such as Codex CLI or Claude Code, tmux is useful as an operational wrapper: it keeps long-running terminal sessions alive, lets you watch or attach from another terminal, captures scrollback, logs future output, and provides scriptable state through commands and control mode. It cannot reveal hidden model reasoning or private chain-of-thought that the agent CLI does not print or expose. It can only observe terminal output, tmux metadata, and agent-specific events that the agent chooses to emit.

As of June 6, 2026, the latest official upstream release is `tmux 3.6b`, released May 20, 2026. In the last three months, the important upstream tmux event was that `3.6b` patch release, which fixed a crash related to SIXEL images in the alternate screen when tmux was built with `--enable-sixel`.

## Current state and last 3 months

### Official upstream releases

| Date | Version | Source | What changed |
| --- | --- | --- | --- |
| May 20, 2026 | `tmux 3.6b` | [GitHub release](https://github.com/tmux/tmux/releases), [3.6b issue #5109](https://github.com/tmux/tmux/issues/5109), [CHANGES](https://raw.githubusercontent.com/tmux/tmux/3.6b/CHANGES) | Bug-fix release. `CHANGES` lists one fix: remove images from the correct list when they are removed while in the alternate screen. Release notes say this can crash tmux with SIXEL images in the alternate screen, only when built with `--enable-sixel`. |
| Dec 5, 2025 | `tmux 3.6a` | [GitHub release](https://github.com/tmux/tmux/releases), [CHANGES](https://raw.githubusercontent.com/tmux/tmux/3.6a/CHANGES) | Previous patch release, outside the requested three-month window. |
| Nov 26, 2025 | `tmux 3.6` | [GitHub release](https://github.com/tmux/tmux/releases), [3.6 issue #4699](https://github.com/tmux/tmux/issues/4699) | Main 3.6 feature release, outside the requested three-month window. |

No other official upstream tmux releases were found in the March 6, 2026 to June 6, 2026 window.

### Current development model

tmux is part of the OpenBSD base system. The [tmux Contributing wiki](https://github.com/tmux/tmux/wiki/Contributing), edited May 27, 2026, says OpenBSD CVS is the primary source repository and GitHub holds the portable version. Main code changes are committed to OpenBSD and then mirrored to GitHub. The same page says tmux currently aims for a new release approximately once a year, not strictly tied to OpenBSD's May/October release schedule.

### Important 3.6-era details still relevant

Although `3.6` itself landed before the three-month window, it is the base for the current `3.6b` line. Relevant 3.6-era changes include scrollbars, better image/alternate-screen handling, improved Unicode handling, improved status line defaults, new format operators and variables, OSC/terminal query improvements, popup/menu refinements, copy-mode improvements, `pane-border-lines "spaces"`, and several mouse/status fixes. See the [current CHANGES file](https://raw.githubusercontent.com/tmux/tmux/master/CHANGES) and the [3.6 release notes issue](https://github.com/tmux/tmux/issues/4699).

## What tmux is

tmux is a terminal multiplexer. The official README says it enables many terminals to be created, accessed, and controlled from one screen, and that it can detach and later reattach while continuing in the background. See the [tmux README](https://raw.githubusercontent.com/tmux/tmux/master/README) and [Getting Started wiki](https://github.com/tmux/tmux/wiki/Getting-Started).

The basic hierarchy is:

| Layer | Meaning |
| --- | --- |
| Server | The long-lived tmux process that stores all sessions, windows, panes, options, buffers, layouts, and history. |
| Client | A terminal attached to the tmux server. Multiple clients can attach to the same session. |
| Session | A persistent workspace. It can be attached or detached. |
| Window | A workspace inside a session. Usually fills the whole client display. |
| Pane | A rectangular split inside a window. Each pane contains a pseudo-terminal and a running program. |

The [tmux manual](https://man.openbsd.org/tmux.1) and [man7 copy](https://man7.org/linux/man-pages/man1/tmux.1.html) describe this as a server managing clients, sessions, windows, and panes. Panes are backed by pseudo-terminals, so programs usually behave as if they are running in normal terminals.

## History that still matters

- July 2007: initial tmux import. It already had session creation, attach/detach, and session listing.
- Late 2007: status line, key bindings, window listing, scrollback, copy/paste, and Linux portability arrived.
- 2008: `~/.tmux.conf`, `source-file`, vi/emacs copy modes, UTF-8 work, OS X support, status-left/right, and early buffer handling became useful.
- 2009: panes became central. `split-window`, pane resizing, multiple panes, socket handling, and multiple servers using `-L` matured. tmux entered OpenBSD base before [OpenBSD 4.6](https://www.openbsd.org/46.html), released October 18, 2009.
- 2010-2013: libevent, `capture-pane`, custom layouts, global buffers, IDs, `wait-for`, copy-pipe, and control mode made tmux scriptable and automation-friendly.
- 2014-2017: RGB color, hooks, user options, better mouse support, and copy-mode key-table changes shaped modern tmux config.
- 2019-2026: popups, menus, multiline status, extended keys, OSC 8 hyperlinks, OSC 52 clipboard behavior, SIXEL support when built in, scrollbars, control-mode subscriptions, and better Unicode handling improved terminal fidelity.

The durable point: tmux started as a persistent terminal/session manager and grew into a programmable terminal workspace layer.

## tmux vs normal terminal vs PowerShell

The normal Windows stack looks like this:

```text
Windows Terminal or conhost
  -> PowerShell
    -> commands
```

A tmux stack usually looks like this:

```text
Windows Terminal, mintty, xterm, iTerm2, SSH terminal, etc.
  -> tmux client
    -> tmux server
      -> pane pseudo-terminal
        -> shell or program
```

### Terminal emulator

A terminal emulator is the app/window that draws text, handles input, colors, fonts, scrollback, clipboard, tabs, panes, and terminal escape sequences. Examples: Windows Terminal, Windows Console Host, mintty, iTerm2, GNOME Terminal, Alacritty, WezTerm.

Microsoft describes [Windows Terminal](https://learn.microsoft.com/en-us/windows/terminal/) as a host application for command-line shells such as PowerShell, Command Prompt, and Bash via WSL. It has its own tabs and panes, but those panes live in the Windows Terminal process and do not provide tmux-style persistent remote sessions.

### Shell

A shell parses commands, expands variables, runs programs, manages pipelines, and provides a scripting language. PowerShell is a shell and task automation platform. Microsoft's [PowerShell overview](https://learn.microsoft.com/en-us/powershell/scripting/overview?view=powershell-7.5) emphasizes that PowerShell includes a command-line shell, scripting language, and configuration management framework, and that unlike text-only shells it accepts and returns .NET objects.

tmux does not replace any of that. If a tmux pane runs PowerShell, PowerShell is still the shell.

### Multiplexer

A multiplexer creates multiple terminal sessions inside one outer terminal and keeps them alive independently of the outer terminal. tmux adds:

- detachable, reattachable sessions
- persistent processes after SSH disconnects or terminal-window closure
- session/window/pane hierarchy
- split panes independent of the terminal app's own panes
- multiple clients attached to one session
- scrollback/copy mode
- a configurable status line
- key bindings
- scripting and automation commands
- control mode for external programs

### What tmux does not replace

tmux does not replace:

- Windows Terminal, iTerm2, xterm, mintty, or another terminal host
- PowerShell, Bash, Zsh, Fish, or CMD
- PowerShell's object pipeline, modules, remoting, language, profiles, or execution policy
- a process supervisor or service manager
- Git worktrees, containers, VMs, or sandboxing
- the agent's own session/resume system
- hidden model telemetry or private reasoning

## Windows and PowerShell usage

tmux is native to Unix-like/POSIX environments. On Windows, the cleanest route is usually:

1. Install WSL using Microsoft's [WSL install guide](https://learn.microsoft.com/en-us/windows/wsl/install).
2. Install a Linux distribution such as Ubuntu.
3. Install tmux in that distribution, for example `sudo apt install tmux`.
4. Open the distro in Windows Terminal.
5. Run `tmux` inside WSL.

This works well for Linux-native tools, SSH sessions, and AI agents running in a Linux workspace. Microsoft notes that WSL lets developers run Linux distributions and Linux command-line tools directly on Windows without a traditional VM or dual boot.

Alternatives:

- Cygwin has a tmux package.
- MSYS2/mintty can run POSIX-style terminal programs, including tmux packages in some setups.
- Native Windows terminal multiplexers and tmux-like projects exist, but they are not upstream tmux.

For native Windows/PowerShell work, Windows Terminal panes plus the agent's own resume controls may be simpler. Use WSL + tmux when you need Unix-style persistence, remote attach/detach, Linux tooling, or long-running terminal work.

## How to use tmux

### Start, detach, attach

```bash
# Start a named session
tmux new-session -s work

# Start detached
tmux new-session -d -s work

# Attach later
tmux attach-session -t work

# Attach read-only, useful for observation
tmux attach-session -t work -r

# Detach from inside tmux
# Press: Ctrl-b then d

# List sessions
tmux list-sessions

# Kill a session
tmux kill-session -t work
```

Default prefix is `Ctrl-b`. Prefix commands are typed as `Ctrl-b` then another key.

Common defaults:

| Key | Action |
| --- | --- |
| `Ctrl-b c` | Create window |
| `Ctrl-b n` | Next window |
| `Ctrl-b p` | Previous window |
| `Ctrl-b ,` | Rename window |
| `Ctrl-b %` | Split pane left/right |
| `Ctrl-b "` | Split pane top/bottom |
| `Ctrl-b arrow` | Move between panes |
| `Ctrl-b z` | Zoom/unzoom pane |
| `Ctrl-b [` | Copy/scrollback mode |
| `Ctrl-b ]` | Paste tmux buffer |
| `Ctrl-b ?` | Show key bindings |

### Windows and panes

```bash
# Create windows and panes
tmux new-window -n editor
tmux split-window -h
tmux split-window -v

# List panes with useful metadata
tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index} pid=#{pane_pid} cmd=#{pane_current_command} path=#{pane_current_path}'

# Send keys to a pane
tmux send-keys -t %1 'npm test' Enter

# Capture current visible pane
tmux capture-pane -p -t %1
```

For scripting, prefer stable IDs. tmux session IDs begin with `$`, window IDs with `@`, and pane IDs with `%`. The manual says IDs are unique for the life of the tmux object.

### Copy mode and scrollback

tmux keeps pane history. The default history length is often 2000 lines, but you can raise it:

```bash
tmux set-option -g history-limit 100000
```

Capture all retained scrollback for a pane:

```bash
tmux capture-pane -pJ -S - -E - -t %1 > pane.log
```

Important limits:

- capture only sees retained tmux history, not unlimited past output
- alternate-screen programs such as full-screen TUIs can behave differently
- secret values printed in the pane will also be captured

### Configuration

tmux config is just tmux commands. Common locations are `~/.tmux.conf` and, in portable builds, XDG config paths may also be used.

Example:

```tmux
set -g mouse on
set -g history-limit 100000
set -g status-interval 5
set -g status-left '#S '
set -g status-right '#{pane_current_command} %H:%M'

bind r source-file ~/.tmux.conf \; display-message 'tmux config reloaded'
bind | split-window -h
bind - split-window -v
```

Reload:

```bash
tmux source-file ~/.tmux.conf
```

### Status line

The status line is programmable. It can show session name, windows, pane title, time, host, current command, and custom shell output.

Useful format examples:

```tmux
set -g status-left '#[bold]#S '
set -g status-right '#{pane_current_command} #{pane_current_path} %H:%M'
```

Format variables are also useful in shell commands:

```bash
tmux display-message -p '#{session_name}:#{window_index}.#{pane_index} #{pane_current_command}'
```

### Plugins

tmux itself does not ship a first-party plugin registry. The common community approach is the Tmux Plugin Manager (TPM), which uses `@plugin` config entries and a final `run` command. Treat plugins as shell/config code that runs in your terminal environment, and review them before installing.

## Scripting and automation

tmux is highly scriptable because its commands work from the shell, config files, key bindings, the prompt, and control mode.

Create a project layout:

```bash
tmux new-session -d -s project -n agent
tmux send-keys -t project:agent 'codex' Enter

tmux new-window -t project -n server
tmux send-keys -t project:server 'npm run dev' Enter

tmux new-window -t project -n tests
tmux send-keys -t project:tests 'npm test -- --watch' Enter

tmux attach -t project
```

Create panes in one window:

```bash
tmux new-session -d -s project -n main
tmux send-keys -t project:main 'codex' Enter
tmux split-window -h -t project:main
tmux send-keys -t project:main.1 'npm run dev' Enter
tmux split-window -v -t project:main.1
tmux send-keys -t project:main.2 'npm test -- --watch' Enter
tmux select-pane -t project:main.0
tmux attach -t project
```

## Control mode

Control mode is tmux's machine-readable text protocol. The manual describes it as a textual interface where applications send tmux commands on stdin and receive output blocks on stdout, plus asynchronous notifications. Start it with:

```bash
tmux -C attach-session -t work
```

Useful facts:

- command replies are wrapped in `%begin` and `%end` or `%error`
- pane output appears as `%output` notifications
- layout/session/window changes appear as `%...` notifications
- output bytes are escaped
- control mode still exposes terminal output and tmux events, not hidden agent internals

Control mode is best when you are writing a dashboard, orchestrator, or monitor that needs structured tmux state.

## Observability for Codex, Claude, and other AI agents

### The core boundary

tmux can observe:

- live terminal screen content
- retained scrollback
- future pane output if `pipe-pane` is enabled
- sessions, windows, panes, layouts, active pane, pane PIDs, current command names, and current paths
- control-mode `%output` and layout/session/window notifications
- anything the agent CLI prints, including visible status messages, command lines, build output, test output, prompts, approval screens, visible reasoning summaries, and visible subagent summaries

tmux cannot observe:

- private chain-of-thought hidden by the model provider
- agent process memory
- API traffic unless some separate proxy/logging layer captures it
- cloud-side worker internals that are not printed locally
- subagent internals unless the CLI prints them or launches them in visible panes
- commands/tools that the agent does not print or log

So the answer to "can I see in real time what agents are doing?" is:

- Yes, if "doing" means what the terminal UI shows, commands/output printed by the CLI, tmux pane state, and future output logs.
- Partially, if the agent provides structured event streams such as Codex `exec --json`, Claude `stream-json`, hooks, telemetry, or in-product agent views.
- No, if "doing" means hidden model thoughts, private chain-of-thought, or internal planning not emitted by the CLI/API.

### tmux mechanisms for watching an agent

| Mechanism | Command | What it shows | Limits |
| --- | --- | --- | --- |
| Live attach | `tmux attach -t work -r` | Current live terminal UI. `-r` makes the client read-only. | Only the rendered terminal surface. |
| Inventory | `tmux list-panes -a -F '...'` | Pane IDs, PIDs, current commands, paths, layout metadata. | Does not reveal full process tree or model state. |
| Snapshot | `tmux capture-pane -p -S -200 -E - -t %1` | Recent retained scrollback. | Capped by `history-limit`. |
| Full retained history | `tmux capture-pane -pJ -S - -E - -t %1` | All retained pane history. | Not output before history limit, and not hidden internals. |
| Future logging | `tmux pipe-pane -o -t %1 'cat >> pane.log'` | Output from now forward. | Does not backfill old output. One pipe per pane. |
| Control mode | `tmux -C attach -t work -r` | Structured command replies and `%output` events. | Escaped terminal output only. |

### Codex-specific observability

Codex CLI itself is the best source for Codex internals. tmux can wrap and observe it, but Codex has its own structured surfaces.

Useful Codex facts from official docs:

- `codex` launches the interactive terminal UI.
- `codex exec` runs non-interactively and can stream results to stdout or JSONL.
- `codex exec --json` emits JSON Lines events while running. Official docs say event types include thread/turn lifecycle, item events, and errors; item types include agent messages, reasoning, command executions, file changes, MCP calls, web searches, and plan updates. See [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive#make-output-machine-readable).
- Codex subagent workflows are surfaced in the Codex app and CLI. Use `/agent` in the CLI to switch between active agent threads and inspect ongoing threads. See [Codex subagents](https://developers.openai.com/codex/subagents).
- Codex can emit OpenTelemetry logs and metrics for API requests, SSE/events, prompts, tool approvals/results, and tool usage if configured. See [Codex advanced configuration](https://developers.openai.com/codex/config-advanced).
- Codex has config keys for reasoning summaries and reasoning visibility, including `model_reasoning_summary`, `hide_agent_reasoning`, and `show_raw_agent_reasoning`. See [Codex config reference](https://developers.openai.com/codex/config-reference).

Good Codex patterns:

```bash
# Interactive in tmux
tmux new-session -s codex -n cli 'codex'

# Passive watch
tmux attach -t codex -r

# Non-interactive structured stream
codex exec --json "summarize the repo structure" | tee codex-events.jsonl

# Log terminal output from an interactive TUI pane
tmux pipe-pane -o -t codex:0.0 'cat >> "$HOME/codex-pane.log"'
```

Interpretation:

- tmux shows the TUI and terminal output.
- `codex exec --json` shows Codex event items for non-interactive runs.
- Codex OTel shows structured telemetry if enabled.
- `/agent`, `/status`, and other in-product commands are better than scraping the pane for Codex-specific status.

### Claude Code-specific observability

Claude Code has its own terminal, background-session, hook, and SDK surfaces. tmux can wrap the visible terminal, but Claude-specific commands are often better for Claude-specific state.

Useful Claude facts from official docs:

- `claude` starts an interactive session; `claude -p` runs print/SDK mode. See [Claude CLI reference](https://code.claude.com/docs/en/cli-usage).
- `claude agents --json` can print live background sessions for scripting; `claude attach <id>` attaches to a background session; `claude logs <id>` prints recent output.
- Claude supports `--output-format json` and `--output-format stream-json` in print mode.
- Claude subagents run in their own context and return results to the main conversation. See [Claude subagents](https://code.claude.com/docs/en/sub-agents).
- Claude hooks can fire on lifecycle and tool events such as `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `TaskCreated`, and `TaskCompleted`. See [Claude hooks reference](https://code.claude.com/docs/en/hooks).
- Claude Code supports native Windows and WSL. On Windows, Git for Windows can provide the Bash tool; otherwise Claude uses PowerShell as the shell tool. See [Claude setup](https://code.claude.com/docs/en/getting-started).

Good Claude patterns:

```bash
# Interactive in tmux
tmux new-session -s claude -n cli 'claude --verbose'

# Passive watch
tmux attach -t claude -r

# Print-mode structured stream
claude -p --output-format stream-json --verbose "run tests" | tee claude-stream.jsonl

# Claude background sessions
claude agents --json
claude logs <id>
claude attach <id>
```

Interpretation:

- tmux sees the visible terminal.
- Claude `stream-json`, hooks, and background-session commands expose more semantic agent data than tmux can infer.
- tmux still cannot recover hidden thinking that Claude does not print.

## Real-time monitoring recipes

### 1. Passive observer for a running session

```bash
tmux attach-session -t work -r
```

Use this when you want to watch without accidentally typing into the agent pane.

### 2. Log all future output from an agent pane

```bash
mkdir -p "$HOME/tmux-logs"
tmux pipe-pane -o -t work:0.0 'cat >> "$HOME/tmux-logs/#S-#I-#P.log"'
```

Stop logging:

```bash
tmux pipe-pane -t work:0.0
```

### 3. Snapshot scrollback for review

```bash
tmux capture-pane -pJ -S - -E - -t work:0.0 > "$HOME/tmux-logs/work-agent-snapshot.log"
```

### 4. Dashboard-friendly pane inventory

```bash
tmux list-panes -a -F '#{pane_id}|#{session_name}|#{window_index}|#{pane_index}|#{pane_pid}|#{pane_current_command}|#{pane_current_path}'
```

### 5. Watch an agent plus dev server and tests

```bash
tmux new-session -d -s ezvibes -n main
tmux send-keys -t ezvibes:main.0 'codex' Enter
tmux split-window -h -t ezvibes:main.0
tmux send-keys -t ezvibes:main.1 'npm run dev' Enter
tmux split-window -v -t ezvibes:main.1
tmux send-keys -t ezvibes:main.2 'npm test -- --watch' Enter
tmux select-pane -t ezvibes:main.0
tmux attach -t ezvibes
```

### 6. Parallel agent work without file conflicts

Use one Git worktree per writable agent:

```bash
git worktree add ../repo-agent-a -b agent-a
git worktree add ../repo-agent-b -b agent-b

tmux new-session -d -s agents -n a 'cd ../repo-agent-a && codex'
tmux new-window -t agents -n b 'cd ../repo-agent-b && codex'
tmux attach -t agents
```

tmux panes do not isolate filesystem writes. Worktrees or separate checkouts do.

## Security and privacy notes

Treat tmux logs as sensitive:

- `capture-pane` can include prompts, code, logs, stack traces, file paths, and secrets accidentally printed by commands.
- `pipe-pane` records future output, including approval prompts or tokens if a tool prints them.
- control-mode logs can include raw terminal output.
- Read-only attach prevents accidental input, but a user with access to the tmux socket can still observe sensitive terminal content.

Avoid using these in passive monitors unless you explicitly want to control the pane:

```bash
tmux send-keys ...
tmux pipe-pane -I ...
```

`pipe-pane -I` sends command output into the pane as if typed. `send-keys` literally types into the pane. They are orchestration tools, not passive monitoring tools.

## Best practical setup for EZvibes-style agent work

For mostly native Windows work:

1. Use Windows Terminal tabs/panes and native Codex/Claude resume features first.
2. Use WSL + tmux when you want Linux tools, long-running sessions, SSH-style persistence, or terminal dashboards.
3. Use one worktree per writable agent.
4. Use agent-native structured output for semantic logs:
   - Codex: `codex exec --json`
   - Claude: `claude -p --output-format stream-json --verbose`
5. Use tmux output capture for terminal-level evidence:
   - `capture-pane` for snapshots
   - `pipe-pane` for future logs
   - `attach -r` for passive live watching
6. Do not expect tmux to show hidden thoughts. It is a terminal multiplexer, not an agent debugger.

## Quick reference

```bash
# Version
tmux -V

# New session
tmux new -s name

# New detached session
tmux new -d -s name

# Attach
tmux attach -t name

# Read-only attach
tmux attach -t name -r

# List sessions/windows/panes
tmux ls
tmux list-windows -a
tmux list-panes -a

# Split panes
tmux split-window -h
tmux split-window -v

# Send command to pane
tmux send-keys -t %1 'npm test' Enter

# Capture scrollback
tmux capture-pane -pJ -S - -E - -t %1 > pane.log

# Log future pane output
tmux pipe-pane -o -t %1 'cat >> pane.log'

# Stop pane logging
tmux pipe-pane -t %1

# Control mode
tmux -C attach -t name
```

## Source list

Primary tmux sources:

- [tmux GitHub releases](https://github.com/tmux/tmux/releases)
- [tmux 3.6b release notes issue #5109](https://github.com/tmux/tmux/issues/5109)
- [tmux CHANGES](https://raw.githubusercontent.com/tmux/tmux/master/CHANGES)
- [tmux README](https://raw.githubusercontent.com/tmux/tmux/master/README)
- [tmux Getting Started wiki](https://github.com/tmux/tmux/wiki/Getting-Started)
- [tmux Installing wiki](https://github.com/tmux/tmux/wiki/Installing)
- [tmux Advanced Use wiki](https://github.com/tmux/tmux/wiki/Advanced-Use)
- [tmux Contributing wiki](https://github.com/tmux/tmux/wiki/Contributing)
- [tmux manual, OpenBSD](https://man.openbsd.org/tmux.1)
- [tmux manual, man7 mirror](https://man7.org/linux/man-pages/man1/tmux.1.html)
- [OpenBSD 4.6 release page](https://www.openbsd.org/46.html)

Windows and PowerShell sources:

- [Windows Terminal overview](https://learn.microsoft.com/en-us/windows/terminal/)
- [PowerShell overview](https://learn.microsoft.com/en-us/powershell/scripting/overview?view=powershell-7.5)
- [Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

Codex sources:

- [Codex non-interactive JSONL output](https://developers.openai.com/codex/noninteractive#make-output-machine-readable)
- [Codex CLI reference](https://developers.openai.com/codex/cli/reference)
- [Codex subagents](https://developers.openai.com/codex/subagents)
- [Codex config reference](https://developers.openai.com/codex/config-reference)
- [Codex advanced configuration and observability](https://developers.openai.com/codex/config-advanced)

Claude Code sources:

- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)
- [Claude Code setup](https://code.claude.com/docs/en/getting-started)
- [Claude Code Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
