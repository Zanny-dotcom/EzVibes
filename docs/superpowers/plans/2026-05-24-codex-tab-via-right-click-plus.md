# Codex Tab via Right-Click "+" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-clicking the `+` on a session window's tab strip launches a new `codex --yolo` tab in the same folder. Left-click stays Claude. Tab labels become agent names (`CLAUDE`, `CODEX`, `CLAUDE 2`, `CODEX 3` …), and codex chips are tinted distinct from claude chips.

**Architecture:** A small, optional `agent` field flows from the renderer → IPC → main → PTY spawn args. Three files change: `main.js` (command branching), `renderer/app.js` (tab data + right-click handler + label formula + narration text), `renderer/styles.css` (codex chip variant). `CLAUDE.md` is updated last. No new files, no new IPC channels, no schema changes elsewhere.

**Tech Stack:** Electron 33, node-pty 1.1, @xterm/xterm 5.5, vanilla JS/HTML/CSS (no bundler, no tests).

**Spec:** `docs/superpowers/specs/2026-05-24-codex-tab-via-right-click-plus-design.md`

---

## File Plan

| File | Change |
|---|---|
| `main.js` | `buildShellArgs(shell, cwd, agent)` branches command. `terminal:create` reads `payload.agent`. Non-PowerShell fallback also branches. |
| `renderer/app.js` | `tab.agent` field. `buildTab` / `createTab` accept agent. `launchClaudeForPath` + `createSessionWindow` pass `'claude'` explicitly. New `defaultTabLabel(tab)`; `getTabLabel` delegates to it; `startTabRename` compares restoration against it. Right-click handler on `+`. Narration strings agent-aware. Chip `data-agent` attribute. |
| `renderer/styles.css` | New `[data-agent="codex"]` chip ruleset mirroring claude's inactive / active / exited states with a muted teal palette. |
| `CLAUDE.md` | UX section + cautions documenting right-click `+`, codex command, and the new default-label rule. |

No tests exist in this project (per `CLAUDE.md` "No tests yet."). Verification at the end is manual: launch the app and confirm each branch behaves as specified.

---

## Task 1: Plumb `agent` through main.js

**Files:**
- Modify: `main.js:38-47` (`buildShellArgs`)
- Modify: `main.js:136-185` (`terminal:create` handler — agent read + non-PowerShell fallback)

- [ ] **Step 1: Update `buildShellArgs` to take agent and branch the command**

Replace lines 38-47 with:

```js
const AGENT_COMMANDS = {
  claude: 'claude --dangerously-skip-permissions',
  codex: 'codex --yolo',
};

function resolveAgentCommand(agent) {
  return AGENT_COMMANDS[agent] || AGENT_COMMANDS.claude;
}

function buildShellArgs(shell, cwd, agent) {
  if (!isPowerShell(shell)) return [];
  const script = [
    PWSH_PROMPT_WRAPPER,
    `Set-Location -LiteralPath ${quotePowerShellLiteral(cwd)}`,
    resolveAgentCommand(agent),
  ].join('\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return ['-NoExit', '-EncodedCommand', encoded];
}
```

- [ ] **Step 2: Read `agent` in `terminal:create` and pass it through**

Inside the `terminal:create` handler, after the existing `assertDirectory` block and before `const shell = detectShell();`, add:

```js
const agent = (payload && payload.agent === 'codex') ? 'codex' : 'claude';
```

Change the line `const args = buildShellArgs(shell, cwd);` to:

```js
const args = buildShellArgs(shell, cwd, agent);
```

- [ ] **Step 3: Branch the non-PowerShell fallback on agent**

Replace this block (originally at `main.js:162-168`):

```js
if (!isPowerShell(shell)) {
  setTimeout(() => {
    try {
      terminalProcess.write('claude --dangerously-skip-permissions\r\n');
    } catch {}
  }, 500);
}
```

with:

```js
if (!isPowerShell(shell)) {
  const command = resolveAgentCommand(agent);
  setTimeout(() => {
    try {
      terminalProcess.write(`${command}\r\n`);
    } catch {}
  }, 500);
}
```

- [ ] **Step 4: Smoke-check main.js syntax**

Run: `node --check main.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "Codex step 1: plumb agent through terminal:create"
```

---

## Task 2: Plumb `agent` through renderer tab data + IPC

**Files:**
- Modify: `renderer/app.js` (`buildTab`, `createTab`, `createSessionWindow`, `launchClaudeForPath`)

- [ ] **Step 1: Make `buildTab` accept and store `agent`**

Replace the `buildTab` function (`renderer/app.js:588-619`) with:

```js
function buildTab(sessionWindow, terminalEl, agent) {
  const id = makeId();
  terminalEl.dataset.tabId = id;

  const term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Cascadia Mono, Consolas, "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.15,
    theme: XTERM_THEME,
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  const tab = {
    id,
    sessionWindow,
    agent: agent === 'codex' ? 'codex' : 'claude',
    numericLabel: sessionWindow.nextTabNumber++,
    customName: null,
    ptyAlive: true,
    exited: false,
    inputBuffer: '',
    term,
    fitAddon,
    terminalEl,
    tabChipEl: null,
    tabLabelEl: null,
    closeBtnEl: null,
  };

  return tab;
}
```

- [ ] **Step 2: Make `createTab` accept `{ agent }` and pass it to IPC**

Replace the `createTab` function (`renderer/app.js:704-752`) with:

```js
async function createTab(sessionWindow, options) {
  if (!sessionWindow) return null;
  const opts = options || {};
  const agent = opts.agent === 'codex' ? 'codex' : 'claude';
  const agentLabel = agent === 'codex' ? 'Codex' : 'Claude';

  // Build the new terminal-host inside the pocket.
  const terminalEl = document.createElement('div');
  terminalEl.className = 'terminal-host';
  sessionWindow.terminalPocketEl.appendChild(terminalEl);

  const tab = buildTab(sessionWindow, terminalEl, agent);
  sessionWindow.tabs.push(tab);
  state.tabsById.set(tab.id, tab);
  attachTabChip(sessionWindow, tab, { active: false });

  tab.term.open(tab.terminalEl);
  tab.term.onData((data) => handleTerminalInput(tab, data));

  terminalEl.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showTerminalContextMenu(tab, event.clientX, event.clientY);
  });

  // Activate it so this tab becomes visible and fits properly.
  activateTab(sessionWindow, tab.id, { focus: true });

  addNarrationEvent(sessionWindow.folderPath, 'tab-opened', `Opened tab ${getTabLabel(tab)} in ${basename(sessionWindow.folderPath)}.`);

  let result;
  try {
    result = await api.createTerminal({
      sessionId: tab.id,
      cwd: sessionWindow.folderPath,
      cols: tab.term.cols,
      rows: tab.term.rows,
      agent,
    });
  } catch (error) {
    result = { success: false, error: (error && error.message) || String(error) };
  }

  if (!result || !result.success) {
    const message = (result && result.error) || `Failed to launch ${agentLabel}.`;
    tab.ptyAlive = false;
    tab.term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
    if (tab.tabChipEl) tab.tabChipEl.classList.add('is-exited');
    addNarrationEvent(sessionWindow.folderPath, 'error', `Failed to launch ${agentLabel} in tab ${getTabLabel(tab)}: ${message}`);
  }

  return tab;
}
```

- [ ] **Step 3: Pass `'claude'` when building the first tab inside `createSessionWindow`**

In `renderer/app.js:508`, change:

```js
const firstTab = buildTab(sessionWindow, terminalEl);
```

to:

```js
const firstTab = buildTab(sessionWindow, terminalEl, 'claude');
```

- [ ] **Step 4: Pass `agent: 'claude'` in the IPC call inside `launchClaudeForPath`**

In `renderer/app.js:402-407`, change:

```js
result = await api.createTerminal({
  sessionId: tab.id,
  cwd: folderPath,
  cols: tab.term.cols,
  rows: tab.term.rows,
});
```

to:

```js
result = await api.createTerminal({
  sessionId: tab.id,
  cwd: folderPath,
  cols: tab.term.cols,
  rows: tab.term.rows,
  agent: 'claude',
});
```

- [ ] **Step 5: Commit**

```bash
git add renderer/app.js
git commit -m "Codex step 2: plumb agent through renderer tabs and IPC"
```

---

## Task 3: Agent-derived default labels + clean restore-to-default in rename

**Files:**
- Modify: `renderer/app.js` (`getTabLabel`, `startTabRename`)

- [ ] **Step 1: Introduce `defaultTabLabel` and route `getTabLabel` through it**

Replace `getTabLabel` (`renderer/app.js:455-458`) with:

```js
function defaultTabLabel(tab) {
  const agentName = (tab && tab.agent === 'codex') ? 'CODEX' : 'CLAUDE';
  return tab && tab.numericLabel > 1 ? `${agentName} ${tab.numericLabel}` : agentName;
}

function getTabLabel(tab) {
  if (!tab) return '';
  return tab.customName || defaultTabLabel(tab);
}
```

- [ ] **Step 2: Use `defaultTabLabel` as the restore-default check in `startTabRename`**

In `renderer/app.js:1001-1058`, change the two lines that compute and consume `numericFallback`:

```js
const numericFallback = String(tab.numericLabel);
```

becomes:

```js
const restoreDefault = defaultTabLabel(tab);
```

And:

```js
if (!trimmed || trimmed === numericFallback) {
  tab.customName = null;
} else {
  tab.customName = trimmed;
}
```

becomes:

```js
if (!trimmed || trimmed === restoreDefault) {
  tab.customName = null;
} else {
  tab.customName = trimmed;
}
```

- [ ] **Step 3: Commit**

```bash
git add renderer/app.js
git commit -m "Codex step 3: agent-derived default tab labels"
```

---

## Task 4: Agent-aware narration strings + chip `data-agent`

**Files:**
- Modify: `renderer/app.js` (`launchClaudeForPath` narration, `onTerminalExit` log line, `attachTabChip`)

- [ ] **Step 1: Set `data-agent` on each chip in `attachTabChip`**

In `renderer/app.js:532-586`, immediately after `chip.dataset.tabId = tab.id;` (around line 538), add:

```js
chip.dataset.agent = tab.agent === 'codex' ? 'codex' : 'claude';
```

- [ ] **Step 2: Make the exit log + narration agent-aware**

Replace the `onTerminalExit` body inside `bindTerminalEvents` (`renderer/app.js:218-235`) with:

```js
api.onTerminalExit(({ sessionId, exitCode }) => {
  const tab = state.tabsById.get(sessionId);
  if (!tab) return;
  tab.ptyAlive = false;
  tab.exited = true;
  const agentLabel = tab.agent === 'codex' ? 'Codex' : 'Claude';
  tab.term.writeln(`\r\n\x1b[90m[${agentLabel} session exited with code ${exitCode}]\x1b[0m`);
  if (tab.tabChipEl) tab.tabChipEl.classList.add('is-exited');
  const isError = exitCode !== 0;
  const folderPath = tab.sessionWindow.folderPath;
  const label = getTabLabel(tab);
  addNarrationEvent(folderPath, isError ? 'error' : 'completed', `Tab ${label}: ${agentLabel} session exited with code ${exitCode}.`);
  const allDead = tab.sessionWindow.tabs.every((t) => !t.ptyAlive);
  if (allDead) {
    setNarrationSummary(folderPath, isError ? 'error' : 'completed', isError ? `Exited with error code ${exitCode}.` : 'Session completed.');
  }
});
```

(The narration summary text stays generic — once all tabs are dead, there can be a mix of agents, so we no longer name one.)

- [ ] **Step 3: Update the "Failed to launch" error in `launchClaudeForPath`**

In `renderer/app.js:412-418`, replace:

```js
if (!result || !result.success) {
  const message = (result && result.error) || 'Failed to launch Claude.';
  tab.ptyAlive = false;
  tab.term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
  if (tab.tabChipEl) tab.tabChipEl.classList.add('is-exited');
  addNarrationEvent(folderPath, 'error', `Failed to launch Claude: ${message}`);
}
```

with:

```js
if (!result || !result.success) {
  const message = (result && result.error) || 'Failed to launch Claude.';
  tab.ptyAlive = false;
  tab.term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
  if (tab.tabChipEl) tab.tabChipEl.classList.add('is-exited');
  addNarrationEvent(folderPath, 'error', `Failed to launch Claude in ${basename(folderPath)}: ${message}`);
}
```

(`launchClaudeForPath` is the always-claude code path, so the agent name stays hard-coded `Claude`. Adding the folder name makes the log read more naturally now that there can be parallel claude/codex narration entries.)

The "Claude launched" / "Claude session started" lines above (`renderer/app.js:389-390`) stay as-is — first-tab in a session window is always Claude.

- [ ] **Step 4: Commit**

```bash
git add renderer/app.js
git commit -m "Codex step 4: agent-aware narration and chip data-agent"
```

---

## Task 5: Right-click handler on `+`, tooltip update

**Files:**
- Modify: `renderer/app.js` (`createSessionWindow` — add tab button block + tooltip)

- [ ] **Step 1: Update the `+` button title for both interactions**

In `renderer/app.js:480-485`, replace:

```js
const addTabBtnEl = document.createElement('button');
addTabBtnEl.type = 'button';
addTabBtnEl.className = 'folder-terminal-tab-add';
addTabBtnEl.title = 'New tab';
addTabBtnEl.textContent = '+';
tabStripEl.appendChild(addTabBtnEl);
```

with:

```js
const addTabBtnEl = document.createElement('button');
addTabBtnEl.type = 'button';
addTabBtnEl.className = 'folder-terminal-tab-add';
addTabBtnEl.title = 'Left-click: new Claude tab  —  Right-click: new Codex tab';
addTabBtnEl.textContent = '+';
tabStripEl.appendChild(addTabBtnEl);
```

- [ ] **Step 2: Add the contextmenu listener that creates a codex tab**

In `renderer/app.js:517-520`, replace:

```js
addTabBtnEl.addEventListener('click', (event) => {
  event.stopPropagation();
  createTab(sessionWindow);
});
```

with:

```js
addTabBtnEl.addEventListener('click', (event) => {
  event.stopPropagation();
  createTab(sessionWindow, { agent: 'claude' });
});

addTabBtnEl.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  event.stopPropagation();
  createTab(sessionWindow, { agent: 'codex' });
});
```

- [ ] **Step 3: Commit**

```bash
git add renderer/app.js
git commit -m "Codex step 5: right-click + opens codex tab"
```

---

## Task 6: Codex chip CSS variant

**Files:**
- Modify: `renderer/styles.css` (append codex chip ruleset after existing chip rules)

- [ ] **Step 1: Add codex chip styling**

In `renderer/styles.css`, immediately after the existing block that ends at line 531 (the last `.folder-terminal-tab-chip.is-exited .tab-label` rule), and before the `+` button rules that begin at line 533, insert:

```css
/* Codex chip variant: muted teal, mirrors the claude chip layout so all
   sizing, hover, close-button and exited rules stay in sync. */
.folder-terminal-tab-chip[data-agent="codex"] {
  border-color: #2e6f80;
  background: linear-gradient(180deg, #3a8294, #1c5564);
  color: #e6f6fb;
}

.folder-terminal-tab-chip[data-agent="codex"]:hover:not(.is-active) {
  background: linear-gradient(180deg, #4a98ac, #226778);
  color: #ffffff;
}

.folder-terminal-tab-chip[data-agent="codex"].is-active {
  border-color: #4ec2db;
  background: linear-gradient(180deg, #6ddaee, #2ea6c0);
  color: #06222a;
}

.folder-terminal-tab-chip[data-agent="codex"].is-exited {
  background: linear-gradient(180deg, #336573, #1a3e48);
}

.folder-terminal-tab-chip[data-agent="codex"].is-exited.is-active {
  background: linear-gradient(180deg, #4d8b9b, #2a5e6c);
}

.folder-terminal-tab-chip[data-agent="codex"].is-exited:hover:not(.is-active) {
  background: linear-gradient(180deg, #336573, #1a3e48);
}
```

- [ ] **Step 2: Commit**

```bash
git add renderer/styles.css
git commit -m "Codex step 6: tinted codex chip variant"
```

---

## Task 7: Manual verification

**Files:**
- None (smoke test the running app)

- [ ] **Step 1: Launch the app**

Run: `npm start`
Expected: the EZvibes window opens at the user's Documents folder.

- [ ] **Step 2: Verify first-tab default label**

Double-click any folder (e.g. `EZvibes`). A session window appears, with one tab chip labelled exactly `CLAUDE`. The chip uses the existing amber color. A claude session starts in the terminal.

- [ ] **Step 3: Verify left-click `+` adds another claude tab**

Click the `+` once. A second chip appears labelled `CLAUDE 2`, also amber. A second claude session starts in its terminal.

- [ ] **Step 4: Verify right-click `+` adds a codex tab**

Right-click the `+`. A new chip appears labelled `CODEX 3`. The chip is visibly tinted teal/cyan (not amber). The terminal runs `codex --yolo` in the same folder. (If `codex` is not on PATH, the terminal prints a "command not found"–style message and the chip turns into the dimmed `is-exited` style — that confirms the agent routing reached `pty.spawn`.)

- [ ] **Step 5: Verify hover tooltip**

Hover over the `+`. The tooltip reads: `Left-click: new Claude tab  —  Right-click: new Codex tab`.

- [ ] **Step 6: Verify rename round-trip on a codex tab**

Right-click the `CODEX 3` chip → Rename → type `notes` → Enter. The chip now reads `notes` and stays tinted teal. Right-click → Rename → clear the field and type `CODEX 3` → Enter. The chip reverts to its agent-default styling (no `customName`) — i.e. the literal default string clears the custom name back to null.

- [ ] **Step 7: Verify minimize / restore preserves both agents**

Minimize the session window. The source folder turns orange. Double-click that folder. The window restores with all three tabs intact (`CLAUDE`, `CLAUDE 2`, `CODEX 3` or your renamed variant), still colored correctly, and the active tab is focused.

- [ ] **Step 8: Verify narration mentions both agents**

Open the narration sidebar (top-right toggle). Select the same folder card. The timeline shows: `Claude launched in <folder>`, `Opened tab CLAUDE 2 in <folder>`, `Opened tab CODEX 3 in <folder>` (or your renamed value).

- [ ] **Step 9: Verify closing the codex tab works**

Hover the codex chip, click its `×`. Chip disappears, its PTY is killed (kill the running `codex` via `Ctrl+C` first if it's still alive — the close still removes the tab unconditionally). The remaining claude tabs stay running. The narration log gets a `Closed tab …` entry using the codex-derived label.

If any of those steps fail, **do not commit the verification step** — go back and fix the offending earlier task, then re-run from Step 1.

- [ ] **Step 10: Quit the app**

Close the main window. The app exits, all PTYs are killed via the existing `before-quit` cleanup.

---

## Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (`Current UX` and `Cautions` sections)

- [ ] **Step 1: Document the new behavior in the Current UX section**

Open `CLAUDE.md`. In the `## Current UX` bullet list, replace the bullet:

```
- The `+` button on the strip starts another independent Claude instance in the same folder.
```

with:

```
- The `+` button on the strip is dual-action: **left-click** starts another `claude --dangerously-skip-permissions` tab in the same folder; **right-click** starts a `codex --yolo` tab instead.
- Tabs are labelled by their agent: the default labels are `CLAUDE` / `CODEX`, and the second-and-later tabs in a window get a numeric suffix (`CLAUDE 2`, `CODEX 3`). Custom names from right-click → Rename override the default.
- Codex chips are tinted teal to be visually distinct from the amber Claude chips.
```

Also replace the earlier bullet:

```
- Tabs are labeled numerically by default (`1`, `2`, `3`, …) and numbers are never reused after a tab closes.
```

with:

```
- A monotonic counter (`nextTabNumber`) still drives the numeric suffix and is never reused after a tab closes; the chip just renders the agent name + (suffix when > 1).
```

- [ ] **Step 2: Add a caution about the agent enum**

Append to the `## Cautions` section:

```
- The `agent` field in the `terminal:create` IPC payload is currently a two-value enum (`'claude'` | `'codex'`); `main.js` defaults unknown values to `'claude'`. Adding a third agent means updating `AGENT_COMMANDS` in `main.js` *and* the `agent === 'codex' ? ... : ...` ternaries in `renderer/app.js` (`buildTab`, `createTab`, `attachTabChip`, `defaultTabLabel`, the exit handler). If a third agent is on the roadmap, prefer normalizing those into a single `KNOWN_AGENTS` set in one place.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Codex step 7: document right-click + and codex tab"
```

---

## Self-Review Notes

Spec coverage check (against `2026-05-24-codex-tab-via-right-click-plus-design.md`):
- IPC `agent` field + main.js branching → Task 1 ✓
- Renderer tab data + contextmenu listener → Tasks 2, 5 ✓
- `defaultTabLabel` helper + `getTabLabel` + `startTabRename` rewire → Task 3 ✓
- Chip `data-agent` + narration text → Task 4 ✓
- Codex chip CSS variant → Task 6 ✓
- CLAUDE.md update → Task 8 ✓
- Manual verification (no tests in repo) → Task 7 ✓

No placeholders. Function names are consistent across tasks (`defaultTabLabel`, `resolveAgentCommand`, `AGENT_COMMANDS`).
