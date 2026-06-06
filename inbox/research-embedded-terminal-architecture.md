# Research: Embedded Terminal Architecture for Agent-Enabled IDEs

> Slice A6 of 10. Scope: how AI-first IDEs wire a PTY through to a UI and expose it to an agent that both reads output and writes input safely. Siblings own broader environment access (A7), agent messaging (A8), code/file editing (A9), and long-running loops (A10).

## 1. How to Look at This Correctly (Meta)

Five evaluation lenses an agent-facing terminal embedding must answer for. Pick a stance on each before writing code:

**Lens 1 — Transport: PTY vs. raw subprocess.** A naked `child_process.spawn` is fine for one-shot non-interactive commands, but the moment a command is interactive (`vim`, `npm init`, `ssh`, `python` REPL, prompts for credentials) the program inspects `isatty(stdout)` and behaves differently — colour vanishes, progress bars die, prompts deadlock. A **pseudo-terminal** (PTY) gives the child a real `/dev/pts/N` (or ConPTY handle on Windows) so it believes a human is on the other end. Every serious embedding (VS Code, Warp, Cursor, OpenHands) uses a PTY; the only credible exception is "run once, capture stdout" tool calls like Claude's classic Bash tool. Agent terminals lean PTY because agents now must drive REPLs, `npm create`, and debuggers.

**Lens 2 — Output representation: byte-stream vs. structured blocks.** Traditional emulators (xterm.js, hterm, Alacritty) accept a stream of bytes, parse ANSI/VT escapes, and mutate a 2D grid. Agents see junk: raw 0x1B[... sequences, cursor moves, line redraws — token-expensive and lossy. Warp's reframing — every prompt-command-output triple is a structured **Block** with stable ID, exit code, duration, working directory — is the single biggest architectural shift for agent consumption. VS Code arrives at the same place via OSC 633 shell-integration sequences (`A` prompt-start, `B` prompt-end, `C` exec-start, `D` exec-finished+exit-code, `E` command-line+nonce), giving the agent the same structured view without a custom renderer.

**Lens 3 — Read/write surface for the agent.** Three escalation tiers: (a) **one-shot exec** — agent submits command, gets stdout/stderr/exit (Claude's `bash_20250124`); (b) **background shell with poll** — `run_in_background: true` returns a `shell_id`; agent later calls `BashOutput(shell_id)` which returns only *new* output since last check; (c) **full duplex on an existing terminal** — VS Code 1.115+ `send_to_terminal` and `get_terminal_output` let the agent type into a foreground REPL the human is also using. Each tier widens capability and danger.

**Lens 4 — Safety surface.** Allowlists beat denylists every time. Backslash's Cursor audit and the Trail of Bits "prompts become shells" research show denylists fall to trivial bypasses (`/proc/self/root/usr/bin/npx`, `go test -exec 'bash -c ...'`, env-var substitution). Defence-in-depth: (i) explicit per-command allowlist, (ii) shell-operator rejection (`&&`, `|`, backticks, `$()`), (iii) OS sandbox (macOS Seatbelt, Linux Landlock/Bubblewrap, Windows WSL2 or job objects), (iv) container isolation (OpenHands' Docker runtime), (v) per-thread network allowlist. Anthropic's own Bash-tool docs ship an allowlist-with-`shlex` reference because they observed denylist bypasses in the wild.

**Lens 5 — Persistence and multiplicity.** Does the session survive a page refresh or agent restart? Web SSH historically lost everything. The fix is server-side state: either (a) keep the `node-pty` handle alive on the server and reattach the socket on reconnect, or (b) wrap the shell in `tmux`/`dtach` so the kernel keeps the process group even if the bridge dies — VS Code Remote, Coder, and Gitpod all do variants of this. Multiplicity question: one shared terminal for all agents, or one terminal per agent? Zed 1.0's bet — one terminal-thread per agent, each in its own git worktree — is the emerging consensus because it eliminates write contention and makes attribution trivial (the `shell_id` *is* the agent ID).

## 2. Current State of the Art (Stack + Tools)

**xterm.js + node-pty** is the de-facto stack. xterm.js is a TypeScript terminal *emulator* for the browser (DOM/Canvas/WebGL renderer, 256-colour, mouse, addons). It does **not** spawn processes — it only renders bytes and emits keystrokes. node-pty is the server-side bridge: `pty.spawn(shell, args, {cols, rows})` returns a handle with `.write(data)`, `.onData(cb)`, `.onExit(cb)`, `.resize(c, r)`. The two are glued by a WebSocket: xterm's `onData` -> socket -> `pty.write`; `pty.onData` -> socket -> `xterm.write`. This is the bones of VS Code's integrated terminal, Theia, code-server, Coder, Gitpod, RStudio Server, JupyterLab terminal, and basically every web IDE shipped in the last decade.

**Windows: ConPTY**. Pre-2018 the only way to get a Unix-style PTY on Windows was the third-party `winpty` library, which scraped the off-screen console buffer — slow, fragile, prone to garbled output. Windows 10 build 18309 shipped `CreatePseudoConsole` / `ResizePseudoConsole` / `ClosePseudoConsole`, baking PTY semantics into ConHost itself: it translates between the legacy Console API used by `cmd.exe` and VT/UTF-8 sequences for the outside world. `node-pty` v1+ dropped winpty entirely and requires Windows 10 1809+. Practical implication: target ConPTY, ignore winpty unless you must support Windows 7/8.

**Warp's terminal-as-data**. Warp ditches the linear grid for a block model: each command emits a Block (prompt-grid + input-grid + output-grid + exit-code + duration + stable ID). Internally the grid is a rotating circular buffer indexed by `(bottom_row, length)` so scrolling is O(1). For agents, the win is enormous — instead of regexing a byte stream the LLM sees `Block { id, cwd, command, exit_code, output_lines[] }`. Warp's Agent Mode exploits this directly to attribute commands to agents and replay them.

**VS Code shell integration (OSC 633)**. Even without Warp's custom renderer you can get the structured view for free by sourcing VS Code's shell-integration script for bash/zsh/fish/pwsh — it injects the OSC 633 escapes (`A`/`B`/`C`/`D`/`E`) into `PROMPT_COMMAND` / `precmd` so a parser can carve the stream into command boundaries with exit codes. `suin/osc633-parser` shows a 100-line implementation. This is how VS Code's Copilot Agent reads terminal output today.

**Claude Code's Bash + BashOutput**. Two complementary tools. Foreground: `Bash({ command, timeout })` runs to completion, returns combined stdout/stderr (truncated to a line cap), persists `cd`, `export`, and shell functions between calls because the underlying subprocess is reused — this is the "persistent bash session" the Anthropic docs describe. Background: `Bash({ command, run_in_background: true })` returns a `shell_id` immediately; `BashOutput({ shell_id, filter? })` returns only **new** output since last poll plus shell status (`running`/`completed`/`killed`) and an optional regex filter for noise reduction. `KillShell({ shell_id })` reaps it. Known limitation: no token-by-token streaming yet (issue #26983) — output is buffered until the call returns, which matters for long builds.

**Cursor**. Same xterm.js shell, but the agent's terminal commands run inside a per-OS sandbox: macOS Seatbelt, Linux Landlock v3 with Bubblewrap fallback, Windows via WSL2. The sandbox is read-only outside the workspace, network-blocked except for a 60+ domain default allowlist (`registry.npmjs.org`, `*.cloudflarestorage.com`, etc.), and exposes `CURSOR_SANDBOX` / `CURSOR_AGENT` env vars so shells can detect agent context and skip Powerlevel10k init. Three auto-run modes: Allowlist, Allowlist+Sandbox, Run-Everything. GHSA-82wg-qcm4-fp2w documents a recent allowlist bypass via env-var substitution — the cat-and-mouse continues.

**Zed**. Rust + GPU-rendered terminal, but the agent integration is what matters: **Terminal Threads** in the Threads Sidebar, one per agent, each scoped to its own git worktree. Per-profile permission tiers (Write / Ask / Minimal) gate tool invocations. The Agent Client Protocol (ACP) is an open wire-format Zed published so Claude Agent, OpenAI Codex, Gemini CLI, OpenCode, etc. plug in identically. This is the cleanest existing instantiation of "one terminal per agent."

**OpenHands**. The most opinionated isolation model. Every session spins a Docker container from an OH-runtime image; inside, an `ActionExecutor` REST server holds a bash shell, Jupyter kernel, headless Chromium, and an optional VS Code Server on a tokenised URL. The agent never talks to a PTY directly — it POSTs an `Action` (CmdRunAction, IPythonRunCellAction), the executor runs it, returns an `Observation`. Every action+observation is an immutable event in an EventStream, enabling pause/resume/replay. This is overkill for a desktop IDE but exactly right for a hosted multi-tenant platform.

**Devin for Terminal / Aider**. Devin pairs a local Rust-rendered terminal with cloud handoff (the agent migrates to a sandboxed VM "with its own computer" when the laptop closes) and tiered permissions: normal (read auto, write+shell prompt), accept-edits, bypass, autonomous (OS-level sandbox required). Aider is simpler — it shells out from the user's own terminal with explicit `/run` invocations, leaning entirely on the user as the safety boundary.

**Streaming output to LLMs — the four hard problems**. (1) **ANSI noise** — a coloured `pytest` run can be 15 KB of escapes for 200 B of content; Anthropic issue #26373 shows untreated ANSI escapes blowing the context window and crashing the agent. Strip with `strip-ansi` or a state-machine before serialising. (2) **Chunk boundaries** — a UTF-8 codepoint, an OSC sequence, or a markup tag may straddle two reads; buffer the tail until the next byte arrives. (3) **Truncation strategy** — head+tail with elision marker beats pure-head (most signal is at the end); show byte and line counts; spill full output to disk and return a path. (4) **Terminal DiLLMa** — LLM output may itself contain ANSI; if you render it in a terminal you've handed prompt injection a control channel. Strip ANSI from LLM output before displaying.

## 3. Implementation Guidance — Reference Architecture

```
+----------------+   WebSocket    +----------------------+   PTY    +-----------+
|   Browser UI   |  binary frames |  Node bridge server  |  master  | bash /    |
|  (xterm.js)    | <============> |   - node-pty handle  | <======> | zsh /pwsh |
|                |                |   - OSC 633 parser   |  slave   |  (child)  |
+--^----------^--+                |   - block builder    |          +-----------+
   |          |                   |   - allowlist guard  |
   | input    | output            +----^------------^----+
   | events   | bytes                  |            |
   |          |                  blocks|         poll|
   |          |                        v            v
   |          |                  +-----------------------+
   |          |                  |  Session state store  |
   |          |                  |  {shell_id -> Block[]}|
   |          |                  +-----------^-----------+
   |          |                              |
   |          |                       structured query
   |          |                              |
   |          |                  +-----------+-----------+
   +----------+----------------> |  Agent runner (LLM)   |
       Optional: agent types     |  tools: exec, read,   |
       into the live terminal    |  sendInput, kill      |
                                 +-----------------------+
```

Three planes: render (xterm.js), transport+structure (Node bridge with OSC 633 parser building Warp-style Blocks), agent (LLM with four tools — `exec`, `readOutput(shellId, sinceCursor)`, `sendInput(shellId, text)`, `kill(shellId)`). Persistence: store the Block array keyed by `shell_id`; on reconnect, replay tail. For survival across server restarts, wrap the inner shell in `tmux new-session -d -s $shell_id` and reattach with `tmux attach -t $shell_id` — the PTY dies but the process group lives.

Minimal bridge (TypeScript, ~40 lines, error handling elided):

```ts
import * as pty from 'node-pty';
import { WebSocketServer } from 'ws';
import stripAnsi from 'strip-ansi';

const ALLOW = /^(ls|cat|pwd|git|npm|pnpm|node|python|pytest)(\s|$)/;
const sessions = new Map<string, { p: pty.IPty; blocks: Block[]; cursor: number }>();
type Block = { id: string; cmd: string; out: string; exit?: number; ts: number };

const wss = new WebSocketServer({ port: 7681 });
wss.on('connection', (ws, req) => {
  const id = new URL(req.url!, 'http://x').searchParams.get('id') ?? crypto.randomUUID();
  let s = sessions.get(id);
  if (!s) {
    const p = pty.spawn(process.platform === 'win32' ? 'pwsh.exe' : 'bash',
      [], { name: 'xterm-256color', cols: 120, rows: 30, cwd: process.cwd(), env: process.env });
    s = { p, blocks: [], cursor: 0 };
    sessions.set(id, s);
    // OSC 633 parser would carve p.onData into Blocks; omitted for brevity.
    p.onData(d => { s!.blocks.push({ id: crypto.randomUUID(), cmd: '', out: stripAnsi(d), ts: Date.now() }); ws.send(d); });
  }
  ws.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'input') s!.p.write(msg.data);          // human or agent typing
    if (msg.type === 'resize') s!.p.resize(msg.cols, msg.rows);
    if (msg.type === 'exec' && ALLOW.test(msg.cmd)) s!.p.write(msg.cmd + '\r');
  });
});

// Agent-facing tool: poll new output since cursor
export function readOutput(id: string) {
  const s = sessions.get(id)!;
  const newBlocks = s.blocks.slice(s.cursor);
  s.cursor = s.blocks.length;
  return newBlocks;
}
```

Rules to follow: (1) keep ANSI in the WebSocket stream to xterm.js but strip it on the agent side; (2) per-shell line-count cap (Claude uses ~30k chars) with head+tail truncation; (3) bind allowlist *before* `shlex.split` and reject every shell operator; (4) run the bridge under a Linux user namespace or inside Docker; (5) require an explicit `approve` round-trip for any non-allowlisted command; (6) emit an audit log line per command with shell_id, command, exit, duration.

## 4. Cross-References to Sibling Research

- **A7 (broader environment access)**: terminal is *one* tool; MCP servers, file APIs, browsers, custom tools live there. Defer non-shell environment design to A7.
- **A8 (agent-to-agent messaging)**: when you have N parallel terminal-threads à la Zed, inter-agent comms is A8's problem, not A7's tmux pipe.
- **A9 (code & .md edits)**: agents *should* use the text-editor tool for files, not `cat > file <<EOF` through the terminal — A9 owns that boundary.
- **A10 (long-running autonomous loops)**: background shells (`BashOutput`-style) are the substrate, but the loop control logic (when to poll, when to interrupt, drift detection) lives in A10.

## 5. Sources

1. [xtermjs/xterm.js — GitHub](https://github.com/xtermjs/xterm.js)
2. [microsoft/node-pty — GitHub](https://github.com/microsoft/node-pty)
3. [Introducing the Windows Pseudo Console (ConPTY) — Microsoft Devblog](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/)
4. [The data structure behind terminals — Warp blog](https://www.warp.dev/blog/the-data-structure-behind-terminals)
5. [The Block Model Behind Warp's Agentic Development Environment](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)
6. [Terminal Shell Integration (OSC 633) — VS Code docs](https://code.visualstudio.com/docs/terminal/shell-integration)
7. [suin/osc633-parser — reference OSC 633 parser](https://github.com/suin/osc633-parser)
8. [VS Code agent terminal control update — Visual Studio Magazine](https://visualstudiomagazine.com/articles/2026/04/16/vs-code-updates-boost-ai-agents-terminal-control-and-copilot-workflow.aspx)
9. [Anthropic Bash tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/bash-tool)
10. [Anthropic issue #26373 — ANSI escapes overflow context](https://github.com/anthropics/claude-code/issues/26373)
11. [Anthropic issue #26983 — Stream Bash output in real time](https://github.com/anthropics/claude-code/issues/26983)
12. [Cursor terminal docs](https://cursor.com/docs/agent/tools/terminal)
13. [Cursor GHSA-82wg-qcm4-fp2w — Allowlist Bypass via Env Vars](https://github.com/cursor/cursor/security/advisories/GHSA-82wg-qcm4-fp2w)
14. [Backslash — The Denylist Delusion](https://www.backslash.security/blog/cursor-ai-security-flaw-autorun-denylist)
15. [Trail of Bits — Prompt injection to RCE in AI agents](https://blog.trailofbits.com/2025/10/22/prompt-injection-to-rce-in-ai-agents/)
16. [OpenHands Runtime Architecture](https://docs.openhands.dev/openhands/usage/architecture/runtime)
17. [The OpenHands Software Agent SDK — arXiv 2511.03690](https://arxiv.org/abs/2511.03690)
18. [Zed Parallel Agents blog](https://zed.dev/blog/parallel-agents)
19. [Zed Parallel Agents docs](https://zed.dev/docs/ai/parallel-agents)
20. [Devin for Terminal — Cognition blog](https://cognition.ai/blog/devin-for-terminal)
21. [Devin for Terminal permissions reference](https://cli.devin.ai/docs/reference/permissions)
22. [Terminal DiLLMa — Embrace The Red on ANSI hijack](https://embracethered.com/blog/posts/2024/terminal-dillmas-prompt-injection-ansi-sequences/)
23. [Microsoft Security — When prompts become shells](https://www.microsoft.com/en-us/security/blog/2026/05/07/prompts-become-shells-rce-vulnerabilities-ai-agent-frameworks/)
24. [Persistent VS Code remote terminals with tmux — Wenbo Pan](https://www.wenbo.io/en-US/Tools/Persistent-VSCode-Remote-Terminals)
25. [Creating a browser-based interactive terminal — Eddy Mens](https://www.eddymens.com/blog/creating-a-browser-based-interactive-terminal-using-xtermjs-and-nodejs)
