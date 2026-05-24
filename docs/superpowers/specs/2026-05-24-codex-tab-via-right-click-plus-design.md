# Codex Tab via Right-Click "+"

## Goal
Let the `+` button on a session window's tab strip launch a `codex --yolo` tab when right-clicked, in addition to its existing left-click behavior of launching a `claude --dangerously-skip-permissions` tab. Both run in the session window's folder. The two agent types coexist in the same session window and are visually distinguishable on the tab strip.

## Current State
- Each session window holds N tabs. Each tab is a PTY spawned by `main.js` via `node-pty`.
- `terminal:create` IPC takes `{ sessionId, cwd, cols, rows }`. `main.js` always builds the shell args around `claude --dangerously-skip-permissions` (via `buildShellArgs`), or writes that command after a delay for non-PowerShell shells.
- The `+` button (`addTabBtnEl` in `createSessionWindow`) has only a `click` handler that calls `createTab(sessionWindow)`. There is no `contextmenu` handler — right-clicking it currently does nothing app-side and may surface a stray Electron menu.
- Tab labels are numeric: `tab.numericLabel` is the per-window monotonic counter assigned at `buildTab` time. `getTabLabel(tab)` returns `tab.customName || String(tab.numericLabel)`.
- Tab chip styling lives in `renderer/styles.css` keyed off `.folder-terminal-tab-chip` and its `.is-active`, `.is-exited` modifiers.

## Target State
- Right-clicking the `+` button creates a new tab in the session window's folder running `codex --yolo`. Otherwise the tab's lifecycle is identical to a Claude tab (minimize/restore, close, rename, narration log, exit code handling, etc.).
- Left-clicking the `+` continues to create a Claude tab (no behavior change).
- The initial tab created when launching a session window via folder double-click / right-click → Launch Claude / Launch Claude Here remains a Claude tab.
- Default tab label is the agent name in uppercase: `CLAUDE` or `CODEX`. When `numericLabel > 1`, the label is suffixed with the number: `CLAUDE 2`, `CODEX 3`. The custom-name rename flow continues to override the default.
- Each chip carries `data-agent="claude"` or `data-agent="codex"`. CSS gives codex chips a subtly tinted border + background so they are distinguishable at a glance. Active/exited modifiers continue to work in both variants.
- Narration log entries reference the agent ("Claude launched in X" / "Codex launched in X", "Claude session exited" / "Codex session exited").
- `+` button tooltip hints at the right-click behavior.

## Out of Scope
- Letting the user pick the agent for the *first* tab when launching a session window for a folder. (Folder double-click and "Launch Claude" always start with Claude.)
- Configurable agents beyond the two hard-coded options.
- Adding a graphical agent picker, menu, or modal on the `+`. Right-click is the entire UX surface for codex.
- Detecting whether `codex` is on PATH ahead of time. If not, the spawned PTY will surface its own error and the existing exit-code handling will mark the tab `is-exited` — same as a missing `claude` binary today.
- Persisting tab state (including agent) across app restarts. Tabs remain in-memory only.

## Components

### 1. Main process — `main.js`
- Change `buildShellArgs(shell, cwd)` → `buildShellArgs(shell, cwd, agent)`. Map `agent` to a command string:
  - `'claude'` (default) → `claude --dangerously-skip-permissions`
  - `'codex'` → `codex --yolo`
- For PowerShell shells, that command string is the third line of the encoded script (the line that today is `'claude --dangerously-skip-permissions'`).
- For non-PowerShell shells, the `setTimeout` block that writes `claude --dangerously-skip-permissions\r\n` becomes the agent-resolved command.
- In `ipcMain.handle('terminal:create', ...)`, read `payload.agent`. Coerce to one of the known values (`'claude'` | `'codex'`); fall back to `'claude'` for anything else. Pass through to `buildShellArgs` and the non-PowerShell fallback.

### 2. Renderer — `renderer/app.js`
- `buildTab(sessionWindow, terminalEl, agent)`: accept `agent` param, store as `tab.agent`. Default `'claude'` when omitted.
- `createTab(sessionWindow, options)`: accept `{ agent }`. Pass `agent` to `buildTab` and to `api.createTerminal({ ..., agent })`. Default `'claude'`.
- `launchClaudeForPath`: pass `agent: 'claude'` explicitly to `api.createTerminal`. The initial tab is built via `buildTab(... terminalEl)` inside `createSessionWindow`; pass `'claude'` there too.
- `createSessionWindow`: in addition to the existing `addTabBtnEl.addEventListener('click', ...)`, add a `contextmenu` listener that calls `event.preventDefault()`, `event.stopPropagation()`, then `createTab(sessionWindow, { agent: 'codex' })`. The button's `title` becomes `"Left-click: new Claude tab  —  Right-click: new Codex tab"`.
- `attachTabChip`: set `chip.dataset.agent = tab.agent;` so CSS can tint by agent.
- `getTabLabel(tab)`:
  ```js
  if (!tab) return '';
  if (tab.customName) return tab.customName;
  const agentName = (tab.agent || 'claude').toUpperCase();
  return tab.numericLabel === 1 ? agentName : `${agentName} ${tab.numericLabel}`;
  ```
- Narration call sites that today say "Claude launched in …", "Claude session exited with code …", and "Failed to launch Claude …" read the tab's agent and use the capitalized agent name (`Claude` / `Codex`). The first-tab narration inside `launchClaudeForPath` stays hard-coded `Claude` because that path always creates a Claude tab.
- Add a small helper `defaultTabLabel(tab)` that computes the agent-derived default (the body of `getTabLabel` minus the `customName` short-circuit). `getTabLabel` calls it when `customName` is null. `startTabRename`'s "restore default" check (today: `trimmed === numericFallback`) becomes `trimmed === defaultTabLabel(tab)`, so typing `CLAUDE` / `CODEX 2` etc. clears `customName` back to null. One source of truth for the default label.

### 3. Styles — `renderer/styles.css`
- Existing `.folder-terminal-tab-chip` rules stay as the Claude baseline. Add a sibling rule keyed on `[data-agent="codex"]` that overrides border-color and background-color to a tinted variant. Mirror for `.is-active` and `.is-exited` so codex tabs have a coherent visual stack.
- Choose tint colors that read as "different but related" against the existing warm/amber palette. A muted cyan/teal works because it doesn't fight with the orange minimized state or the yellow folder-tab nubbin.

## Data Flow

```
right-click "+"
  → contextmenu listener (renderer/app.js)
  → createTab(sessionWindow, { agent: 'codex' })
  → buildTab(... 'codex')                                    [tab.agent = 'codex']
  → attachTabChip(...)                                       [chip.dataset.agent = 'codex']
  → api.createTerminal({ sessionId, cwd, cols, rows, agent: 'codex' })
  → IPC terminal:create handler (main.js)
  → buildShellArgs(shell, cwd, 'codex')                      [substitutes codex --yolo]
  → pty.spawn(shell, args, { cwd })
  → onData / onExit wired as today, keyed by sessionId
```

## Error Handling
- Unknown / missing `agent` in IPC payload → main.js defaults to `'claude'`. (Renderer is the only caller, so this is belt-and-braces.)
- `codex` not installed → PTY surfaces a "command not found" line from PowerShell and exits non-zero. `onTerminalExit` already writes the exit-code line, marks the chip `is-exited`, and updates narration with status `error`. The new code path adds nothing here; the agent name in the narration message just becomes "Codex" instead of "Claude".

## Risk / Notes
- The `+` button's existing `event.stopPropagation()` in the left-click handler prevents bubbling to the tab strip / chip handlers; the new `contextmenu` listener does the same plus `preventDefault()` to suppress any default browser/Electron context menu.
- Right-click anywhere else in the window (tab chips, the terminal area) keeps its current behavior — tab chips show the Rename context menu, the terminal shows Copy/Paste/Select All. The new listener attaches only to `addTabBtnEl`.
- Label-format change affects every tab, including pre-existing Claude flows: a window's only tab now reads `CLAUDE` instead of `1`. This is an intentional UX change per the design.
- `numericLabel` continues to be assigned monotonically per window (`nextTabNumber++`), so a window's first tab will always start at 1 regardless of agent, keeping the "no number" rule simple. Closing tab 1 and opening a new tab gives `CLAUDE 4` (or whatever the counter is at), which is acceptable — the contract is "never reuse," not "always show 1 when only one tab."
- Narration log lines that today reference "Tab N" (e.g., `Closed tab 2 in …`) now reference the new label (`Closed tab CODEX 2 in …`); this is a side-effect of routing through `getTabLabel`. Acceptable.
