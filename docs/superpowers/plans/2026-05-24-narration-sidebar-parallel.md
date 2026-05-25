# Contextual Narration Sidebar — Parallel Orchestration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to drive this. The execution model is *parallel sub-agents under a locked contract*, not sequential tasks. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a top-right toggle-able contextual narration sidebar to EZvibes that renders `state.narrationByPath[state.currentPath]` — showing per-folder Claude activity (session start, user prompts, heuristic agent/plan/completion signals, and session exit) without disturbing the existing terminal session pipeline.

**Architecture:** Three renderer files (`renderer/index.html`, `renderer/styles.css`, `renderer/app.js`) change in parallel under a Phase 0 contract that pins every DOM id, CSS class, helper signature, narration shape field, and event-kind string. Each file is owned by exactly one sub-agent — no two agents touch the same file, so they run truly concurrently in the same working tree (no worktrees needed). Narration state lives in renderer memory only (no persistence in v1). The sidebar always reads from `state.currentPath`; renders fire on `navigateTo`, `addNarrationEvent`, `setNarrationSummary`, and toggle clicks.

**Tech Stack:** Electron 33, node-pty 1.1, @xterm/xterm 5.5, @xterm/addon-fit 0.10, vanilla JS/HTML/CSS (no bundler, no framework).

---

## Why parallel sub-agents

The work decomposes naturally by file. HTML defines DOM ids; CSS targets those ids/classes; JS queries the ids and toggles the classes. With a single Phase 0 contract pinning every shared name, the three files can be built simultaneously by three different agents with **zero merge risk** (different files = no overlap).

Each agent runs with **ultrathink** to reason carefully about its slice:
- The HTML agent must place markup at exactly the right grid positions.
- The CSS agent must change the `.topbar` and `.shell` column grids without breaking existing folder-grid or session-window styles.
- The JS agent must wire helpers into 8+ call sites inside an IIFE without breaking the session lifecycle (`launchClaudeForPath`, `onTerminalData`, `onTerminalExit`, `term.onData`, `navigateTo`, plus `init`/`bindEvents`).

---

## Phase 0 — Contract Lock-In (orchestrator, before dispatch)

Every sub-agent prompt embeds this section verbatim. No agent may rename a public identifier listed here.

### DOM IDs (HTML creates, JS queries)

| ID | Element | Owner |
|---|---|---|
| `narration-toggle` | `<button>` in `.topbar` after `.search-wrap` | HTML |
| `narration-sidebar` | `<aside>` inside `<main class="shell">` after `.content` | HTML |
| `narration-close` | `<button>` in sidebar header | HTML |
| `narration-folder` | `<div>` showing the active folder path | HTML |
| `narration-body` | `<div>` timeline scroll container | HTML |

`<main class="shell">` itself stays without an id — JS will look it up via `document.querySelector('main.shell')`.

### CSS class names (HTML applies, CSS styles, JS toggles)

- `.narration-toggle` (modifier on `.icon-button`)
- `.narration-sidebar`, `.narration-header`, `.narration-title`, `.narration-folder`, `.narration-body`
- `.narration-summary`, `.narration-summary-text`
- `.narration-status`, `.narration-status-active`, `.narration-status-waiting`, `.narration-status-completed`, `.narration-status-error`, `.narration-status-idle`
- `.narration-timeline`
- `.narration-event`, `.narration-event-time`, `.narration-event-text`
- `.narration-event-session-started`, `.narration-event-user-task`, `.narration-event-agent-activity`, `.narration-event-plan-created`, `.narration-event-completed`, `.narration-event-error`, `.narration-event-note` (per-kind hook for future styling — defined but unstyled in v1)
- `.narration-empty` (empty-state container)
- `.shell.narration-open` (layout modifier — adds 3rd column)

### JS state additions (in the existing `state` object)

```javascript
narrationByPath: new Map(),
narrationOpen: false,
```

### Narration object shape (the value stored in `state.narrationByPath`)

```javascript
{
  folderPath: string,
  folderName: string,
  status: 'idle' | 'active' | 'waiting' | 'completed' | 'error',
  summary: string,
  events: [
    { id: string, time: number, kind: string, text: string }
  ],
  transcriptBuffer: string,   // last ~20k chars of terminal output
  seenHints: {}               // dedupe map for heuristic events
}
```

**Two deliberate deviations from the user's original spec:**
1. `lastUserInputBuffer` dropped — the per-keystroke buffer lives on the **session** object (`session.inputBuffer`), never on narration. Narration only stores finalized events.
2. `seenHints` is a plain object `{}`, not `new Set()` — so the shape stays JSON-serializable for future persistence.

### JS event kinds (literal strings)

`'session-started'`, `'user-task'`, `'agent-activity'`, `'plan-created'`, `'completed'`, `'error'`, `'note'`.

### Helper function signatures (JS agent must define these exact names)

```javascript
function getNarration(folderPath)              // → narration | null
function ensureNarration(folderPath)           // → narration (creates if absent)
function addNarrationEvent(folderPath, kind, text)
function setNarrationSummary(folderPath, status, summary)
function renderNarrationSidebar()
function handleTerminalInput(session, data)
function handleTerminalOutput(session, data)
function shorten(value, max)                   // utility
```

### Status colors (CSS agent uses these)

- `active`    → `#55b6ff` (matches `var(--accent)`)
- `waiting`   → `#ffb000` (matches existing folder-window amber)
- `completed` → `#5af78e`
- `error`     → `#ff5f57`
- `idle`      → `#9ea7a3` (matches `var(--muted)`)

### Layout sizes

- Topbar grid: `160px auto 1fr 320px auto` (was `160px auto 1fr 320px` — new trailing `auto` is the toggle column).
- Shell grid (open): `190px minmax(0, 1fr) 360px`.
- Shell grid (closed): unchanged (`190px 1fr`).
- Below 900px viewport: sidebar hidden and the 3-column layout collapses to 1 column.

---

## Phase 1 — Parallel Build (dispatch ALL THREE in ONE message)

Use the `Agent` tool with `subagent_type: general-purpose`, three calls in a single message so the runtime fans them out concurrently. Each prompt embeds the Phase 0 contract verbatim plus that agent's slice. Every prompt ends with the literal word **ultrathink** so the sub-agent uses extended reasoning.

### Agent A — HTML markup (`renderer/index.html` ONLY)

**Scope:**
- Insert a toggle button into `.topbar` after `.search-wrap`.
- Insert a narration `<aside>` inside `<main class="shell">` after `.content`.
- Do not touch CSP. Do not touch any other file.

**Exact insertions:**

1. After the `<div class="search-wrap">…</div>` block in `.topbar`:

```html
<button id="narration-toggle" class="icon-button narration-toggle" title="What Was Made" aria-pressed="false">▤</button>
```

2. Inside `<main class="shell">`, after the closing `</section>` of `.content`:

```html
<aside id="narration-sidebar" class="narration-sidebar" hidden>
  <div class="narration-header">
    <div>
      <div class="narration-title">What Was Made</div>
      <div id="narration-folder" class="narration-folder"></div>
    </div>
    <button id="narration-close" class="icon-button" title="Close">X</button>
  </div>
  <div id="narration-body" class="narration-body"></div>
</aside>
```

**Acceptance:**
- All five ids (`narration-toggle`, `narration-sidebar`, `narration-close`, `narration-folder`, `narration-body`) appear exactly once.
- Existing CSP block unchanged.
- Sidebar is `<aside>` (semantic), is a sibling of `.sidebar` and `.content` inside `<main class="shell">`.

### Agent B — CSS styling (`renderer/styles.css` ONLY)

**Scope:** All visual layout for the toggle button, sidebar, status pills, timeline, and the `.shell.narration-open` column change. Add the small-viewport rule INSIDE the existing `@media (max-width: 900px)` block — do not create a new media query.

**Exact changes:**

1. Replace the existing `.topbar` rule (only the `grid-template-columns` line changes):

```css
.topbar {
  display: grid;
  grid-template-columns: 160px auto 1fr 320px auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: #151817;
}
```

2. Add a `.shell.narration-open` modifier rule directly after the existing `.shell` rule:

```css
.shell.narration-open {
  grid-template-columns: 190px minmax(0, 1fr) 360px;
}
```

3. Append (before the existing `@media` block at the bottom of the file):

```css
.narration-toggle {
  font-size: 14px;
}

.narration-toggle[aria-pressed="true"] {
  background: var(--panel-2);
  border-color: var(--accent);
  color: var(--accent);
}

.narration-sidebar {
  min-width: 0;
  border-left: 1px solid var(--line);
  background: #151817;
  display: grid;
  grid-template-rows: auto 1fr;
}

.narration-sidebar[hidden] {
  display: none;
}

.narration-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--line);
}

.narration-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--fg);
}

.narration-folder {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  word-break: break-all;
}

.narration-body {
  overflow: auto;
  padding: 12px 14px;
}

.narration-empty {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-line;
}

.narration-summary {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--line);
}

.narration-status {
  justify-self: start;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.narration-status-active    { background: rgba(85, 182, 255, 0.15);  color: #55b6ff; }
.narration-status-waiting   { background: rgba(255, 176, 0, 0.18);   color: #ffb000; }
.narration-status-completed { background: rgba(90, 247, 142, 0.16);  color: #5af78e; }
.narration-status-error     { background: rgba(255, 95, 87, 0.18);   color: #ff5f57; }
.narration-status-idle      { background: rgba(158, 167, 163, 0.18); color: #9ea7a3; }

.narration-summary-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--fg);
}

.narration-timeline {
  display: grid;
  gap: 12px;
}

.narration-event {
  border-left: 2px solid #394240;
  padding: 0 0 4px 12px;
}

.narration-event-time {
  color: var(--muted);
  font-size: 11px;
}

.narration-event-text {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.4;
}
```

4. Inside the existing `@media (max-width: 900px)` block, ADD (do not replace existing rules in that block):

```css
.shell.narration-open {
  grid-template-columns: 1fr;
}

.narration-sidebar {
  display: none;
}
```

**Acceptance:**
- Existing `.topbar`, `.shell`, `.folder-grid`, `.folder-terminal` rules remain valid.
- All 25+ new selectors from the contract exist.
- Status pill colors match the contract table exactly.
- Sidebar collapses below 900px.

### Agent C — JS state + helpers + integration (`renderer/app.js` ONLY)

**Scope:** Everything renderer-side. Make exactly the eight changes below, in order. Use one focused `Edit` per change.

**Critical preconditions to verify before editing:**
- The whole file is inside an IIFE — all functions must be defined inside it.
- `els.shell` has no id; reference it via `document.querySelector('main.shell')`.
- Existing `api.onTerminalData` / `api.onTerminalExit` handler bodies must be preserved line-for-line; you only ADD new calls.

**Change 1 — Extend the `state` object.** Append two fields (preserve existing fields):

```javascript
const state = {
  currentPath: '',
  parentPath: '',
  entries: [],
  history: [],
  query: '',
  sessionsByPath: new Map(),
  sessionsById: new Map(),
  narrationByPath: new Map(),
  narrationOpen: false,
};
```

**Change 2 — Cache new DOM elements in `init()`.** After the existing `els.newSessionBtn = document.getElementById('new-session-btn');` line, add:

```javascript
els.shell = document.querySelector('main.shell');
els.narrationToggle = document.getElementById('narration-toggle');
els.narrationSidebar = document.getElementById('narration-sidebar');
els.narrationClose = document.getElementById('narration-close');
els.narrationFolder = document.getElementById('narration-folder');
els.narrationBody = document.getElementById('narration-body');
```

**Change 3 — Bind toggle/close in `bindEvents()`.** Add anywhere before the `window.addEventListener('click', …)` line:

```javascript
els.narrationToggle.addEventListener('click', () => {
  state.narrationOpen = !state.narrationOpen;
  els.narrationToggle.setAttribute('aria-pressed', state.narrationOpen ? 'true' : 'false');
  renderNarrationSidebar();
});
els.narrationClose.addEventListener('click', () => {
  state.narrationOpen = false;
  els.narrationToggle.setAttribute('aria-pressed', 'false');
  renderNarrationSidebar();
});
```

**Change 4 — Call `renderNarrationSidebar()` from `navigateTo()`.** Append it as the last statement (after `renderGrid()`).

**Change 5 — Record session-started in `launchClaudeForPath()`.** Immediately after the line `state.sessionsById.set(session.id, session);`, add:

```javascript
addNarrationEvent(folderPath, 'session-started', `Claude launched in ${basename(folderPath)}.`);
setNarrationSummary(folderPath, 'active', 'Claude session started.');
```

**Change 6 — Wrap `term.onData` to capture user input.** Replace the existing line:

```javascript
session.term.onData((data) => api.writeTerminal(session.id, data));
```

with:

```javascript
session.term.onData((data) => handleTerminalInput(session, data));
```

**Change 7 — Extend `bindTerminalEvents()`.** Replace the two handlers wholesale with:

```javascript
function bindTerminalEvents() {
  api.onTerminalData(({ sessionId, data }) => {
    const session = state.sessionsById.get(sessionId);
    if (!session) return;
    session.term.write(data);
    handleTerminalOutput(session, data);
  });

  api.onTerminalExit(({ sessionId, exitCode }) => {
    const session = state.sessionsById.get(sessionId);
    if (!session) return;
    session.exited = true;
    session.term.writeln(`\r\n\x1b[90m[Claude session exited with code ${exitCode}]\x1b[0m`);
    session.windowEl.classList.add('session-exited');
    const subtitle = session.windowEl.querySelector('.session-subtitle');
    if (subtitle) subtitle.textContent = `Exited with code ${exitCode}`;
    const isError = exitCode !== 0;
    addNarrationEvent(session.path, isError ? 'error' : 'completed', `Claude session exited with code ${exitCode}.`);
    setNarrationSummary(session.path, isError ? 'error' : 'completed', isError ? `Exited with error code ${exitCode}.` : 'Session completed.');
  });
}
```

**Change 8 — Add the helper block.** Insert between `escapeHtml` and the closing `window.addEventListener('DOMContentLoaded', init);`:

```javascript
function getNarration(folderPath) {
  return state.narrationByPath.get(folderPath) || null;
}

function ensureNarration(folderPath) {
  let n = state.narrationByPath.get(folderPath);
  if (!n) {
    n = {
      folderPath,
      folderName: basename(folderPath),
      status: 'idle',
      summary: '',
      events: [],
      transcriptBuffer: '',
      seenHints: {},
    };
    state.narrationByPath.set(folderPath, n);
  }
  return n;
}

function addNarrationEvent(folderPath, kind, text) {
  const n = ensureNarration(folderPath);
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  n.events.push({ id, time: Date.now(), kind, text });
  if (state.currentPath === folderPath) renderNarrationSidebar();
}

function setNarrationSummary(folderPath, status, summary) {
  const n = ensureNarration(folderPath);
  n.status = status;
  n.summary = summary;
  if (state.currentPath === folderPath) renderNarrationSidebar();
}

function renderNarrationSidebar() {
  if (!els.narrationSidebar) return;
  els.narrationSidebar.hidden = !state.narrationOpen;
  if (els.shell) els.shell.classList.toggle('narration-open', state.narrationOpen);
  if (!state.narrationOpen) return;

  const folderPath = state.currentPath;
  els.narrationFolder.textContent = folderPath || '';
  els.narrationBody.innerHTML = '';

  const n = getNarration(folderPath);
  if (!n || n.events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'narration-empty';
    empty.textContent = 'No Claude activity for this folder yet.\nRight-click a folder and launch Claude to start a narrated session.';
    els.narrationBody.appendChild(empty);
    return;
  }

  const summary = document.createElement('section');
  summary.className = 'narration-summary';
  const status = document.createElement('span');
  status.className = `narration-status narration-status-${n.status || 'idle'}`;
  status.textContent = n.status || 'idle';
  const summaryText = document.createElement('p');
  summaryText.className = 'narration-summary-text';
  summaryText.textContent = n.summary || '';
  summary.append(status, summaryText);

  const timeline = document.createElement('div');
  timeline.className = 'narration-timeline';
  for (const event of n.events) {
    const item = document.createElement('div');
    item.className = `narration-event narration-event-${event.kind}`;
    const time = document.createElement('div');
    time.className = 'narration-event-time';
    time.textContent = new Date(event.time).toLocaleTimeString();
    const text = document.createElement('div');
    text.className = 'narration-event-text';
    text.textContent = event.text;
    item.append(time, text);
    timeline.appendChild(item);
  }

  els.narrationBody.append(summary, timeline);
  els.narrationBody.scrollTop = els.narrationBody.scrollHeight;
}

function shorten(value, max) {
  const s = String(value || '');
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function handleTerminalInput(session, data) {
  api.writeTerminal(session.id, data);
  if (typeof session.inputBuffer !== 'string') session.inputBuffer = '';
  for (const ch of data) {
    if (ch === '\r' || ch === '\n') {
      const buf = session.inputBuffer.trim();
      session.inputBuffer = '';
      if (buf) {
        addNarrationEvent(session.path, 'user-task', `User asked: "${shorten(buf, 180)}"`);
        setNarrationSummary(session.path, 'active', `Working on: ${shorten(buf, 100)}`);
      }
    } else if (ch === '\x7f' || ch === '\b') {
      session.inputBuffer = session.inputBuffer.slice(0, -1);
    } else if (ch >= ' ') {
      session.inputBuffer += ch;
    }
  }
}

const NARRATION_HINTS = [
  {
    key: 'agent-launched',
    test: (chunk) => /sub.?agents?/i.test(chunk) && /(launch|spawn|started|orchestr)/i.test(chunk),
    kind: 'agent-activity',
    text: 'Claude appears to have launched sub-agents.',
  },
  {
    key: 'agent-returned',
    test: (chunk) => /all .*sub.?agents?.*(returned|complete|finished)/i.test(chunk),
    kind: 'agent-activity',
    text: 'All sub-agents appear to have returned.',
  },
  {
    key: 'plan-created',
    test: (chunk) => /(plan|implementation plan|comprehensive plan)/i.test(chunk) && /(created|drafted|wrote|prepared)/i.test(chunk),
    kind: 'plan-created',
    text: 'Claude created a plan.',
  },
  {
    key: 'completed',
    test: (chunk) => /\b(done|completed|finished)\b/i.test(chunk),
    kind: 'completed',
    text: 'Claude appears to have completed the task.',
    asSummary: true,
  },
];

function handleTerminalOutput(session, data) {
  const n = ensureNarration(session.path);
  n.transcriptBuffer = (n.transcriptBuffer + data).slice(-20000);
  const tail = n.transcriptBuffer.slice(-4000);
  for (const hint of NARRATION_HINTS) {
    if (n.seenHints[hint.key]) continue;
    if (!hint.test(tail)) continue;
    n.seenHints[hint.key] = true;
    if (hint.asSummary) {
      setNarrationSummary(session.path, 'completed', hint.text);
    } else {
      addNarrationEvent(session.path, hint.kind, hint.text);
    }
  }
}
```

(The heuristic test now runs against the last 4k chars of the cumulative buffer instead of the raw chunk so prompts split across PTY chunks still match. `seenHints` prevents re-firing.)

**Acceptance:**
- `node --check renderer\app.js` exits 0.
- Existing session-launch, minimize, restore, and close flows are unchanged.
- Sidebar re-renders only when `state.currentPath === folderPath` (per-folder context honored).
- Sidebar is hidden by default (`narrationOpen: false`).

---

## Phase 2 — Integration Verification (orchestrator, after all three agents return)

- [ ] **Step 1: syntax check both JS entry points**

```powershell
node --check renderer\app.js
node --check main.js
```

Expected: exit code 0 from both, no output.

- [ ] **Step 2: contract grep — every shared name must appear on both producer and consumer**

```
Grep "narration-toggle"   → ≥2 hits (HTML + JS).
Grep "narration-sidebar"  → ≥3 hits (HTML + CSS + JS).
Grep "narration-open"     → ≥2 hits (CSS + JS).
Grep "ensureNarration"    → ≥4 hits (definition + 3 callers).
Grep "narrationByPath"    → ≥2 hits (state init + getNarration/ensureNarration).
```

If any contract name is missing on the consumer side, re-dispatch the offending agent with a focused correction prompt — do not hand-patch.

---

## Phase 3 — Runtime Verification (orchestrator + user)

- [ ] **Step 1: launch the app**

```powershell
npm start
```

- [ ] **Step 2: smoke test checklist** (orchestrator drives; user observes)

1. App opens at Documents — sidebar hidden, `▤` button visible.
2. Click `▤` → sidebar reveals (right column, 360px), `aria-pressed="true"`, empty state for Documents.
3. Navigate into a child folder → folder path in `narration-folder` updates; empty state still shown.
4. Right-click child folder → Launch Claude → genie-open happens AND sidebar shows status pill `active`, summary "Claude session started.", and a timeline event "Claude launched in *foo*."
5. Type a prompt and press Enter → sidebar appends `User asked: "…"` and summary changes to `Working on: …`.
6. Click the minimize button on the terminal window → folder card turns orange, sidebar still shows the same narration.
7. Navigate up to the parent → sidebar empty state for the parent.
8. Navigate back into the child → child's narration reappears intact (because state is keyed by path).
9. Send another prompt → another event appended.
10. Close the session via the X on the terminal window → exit event logged (`completed` for code 0, `error` otherwise) and status pill flips accordingly.

Any failure → re-dispatch only the relevant agent (HTML / CSS / JS) with a focused correction prompt.

---

## Phase 4 — Commit (orchestrator, only after Phase 3 passes)

- [ ] **Step 1: stage and commit**

```powershell
git add renderer/index.html renderer/styles.css renderer/app.js docs/superpowers/plans/2026-05-24-narration-sidebar-parallel.md
git commit -m @'
feat: contextual narration sidebar (per-folder)

Toggle-able right sidebar that shows per-folder Claude activity:
- session start/exit, user prompts, heuristic agent/plan/completion signals
- state keyed by state.currentPath via narrationByPath Map
- in-memory only (no persistence in v1)
'@
```

---

## Sub-Agent Prompt Templates (copy-paste — all three Agent calls go in ONE message)

### Template — Agent A (HTML)

```
You are editing C:\Users\Oskari\Documents\EZvibes\renderer\index.html ONLY. Use the Edit tool. Do not modify any other file. Do not stage or commit.

ultrathink — reason carefully about exact insertion points and indentation. Match the file's existing 2-space indent.

CONTRACT (immutable):
- ids: narration-toggle, narration-sidebar, narration-close, narration-folder, narration-body
- classes on the toggle button: icon-button narration-toggle
- classes on the aside: narration-sidebar
- toggle glyph: ▤ (single char); close glyph: X (ASCII)

INSERTION 1 — Inside `.topbar`, immediately after the existing `<div class="search-wrap">…</div>` block, add:

<button id="narration-toggle" class="icon-button narration-toggle" title="What Was Made" aria-pressed="false">▤</button>

INSERTION 2 — Inside `<main class="shell">`, immediately after the closing `</section>` of `.content`, add:

<aside id="narration-sidebar" class="narration-sidebar" hidden>
  <div class="narration-header">
    <div>
      <div class="narration-title">What Was Made</div>
      <div id="narration-folder" class="narration-folder"></div>
    </div>
    <button id="narration-close" class="icon-button" title="Close">X</button>
  </div>
  <div id="narration-body" class="narration-body"></div>
</aside>

Do not touch the CSP meta tag. Do not touch any other element.

When done, reply with:
1. The unified-diff hunks (Edit summaries are fine).
2. A line-count delta.
3. Any contract deviation. (There should be none.)
```

### Template — Agent B (CSS)

```
You are editing C:\Users\Oskari\Documents\EZvibes\renderer\styles.css ONLY. Use the Edit tool. Do not modify any other file. Do not stage or commit.

ultrathink — reason carefully about cascade. Before editing, read the entire file and confirm that the existing .topbar, .shell, .folder-grid, and .folder-terminal rules will remain valid after your changes.

CONTRACT (immutable):
- topbar grid: 160px auto 1fr 320px auto
- shell open grid: 190px minmax(0, 1fr) 360px
- shell closed grid: unchanged
- status colors: active #55b6ff, waiting #ffb000, completed #5af78e, error #ff5f57, idle #9ea7a3
- sidebar width: 360px
- all selectors listed in the plan's "CSS class names" section must exist

CHANGES (apply in order):
1. Replace the `.topbar` rule, changing only `grid-template-columns` to `160px auto 1fr 320px auto`.
2. Add a `.shell.narration-open { grid-template-columns: 190px minmax(0, 1fr) 360px; }` rule immediately after the existing `.shell` rule.
3. Append the full sidebar/timeline/status block (from the plan's Agent B section) BEFORE the existing `@media (max-width: 900px)` block.
4. Inside the existing `@media (max-width: 900px)` block (do not create a new one), add the two collapse rules from the plan.

When done, reply with:
1. The unified-diff hunks.
2. Confirmation that .topbar/.shell/.folder-grid/.folder-terminal still match.
3. Any contract deviation. (There should be none.)
```

### Template — Agent C (JS)

```
You are editing C:\Users\Oskari\Documents\EZvibes\renderer\app.js ONLY. Use the Edit tool, one focused Edit per change. Do not modify any other file. Do not stage or commit.

ultrathink — this is the largest slice. The whole file lives inside an IIFE; all new functions must be defined inside it. Reason carefully about each call site so the existing terminal session pipeline keeps working. Pay particular attention to:
- `<main class="shell">` has no id — use `document.querySelector('main.shell')`.
- The existing `api.onTerminalData` / `api.onTerminalExit` handler bodies must be preserved line-for-line; only ADD new calls.
- `state.currentPath === folderPath` is the guard that prevents off-folder re-renders.
- `seenHints` is `{}`, never `new Set()`.
- `inputBuffer` lives on the SESSION object, never on narration.

CONTRACT (immutable):
- state additions: narrationByPath (Map), narrationOpen (boolean)
- helper names: getNarration, ensureNarration, addNarrationEvent, setNarrationSummary, renderNarrationSidebar, handleTerminalInput, handleTerminalOutput, shorten
- event kinds: 'session-started' | 'user-task' | 'agent-activity' | 'plan-created' | 'completed' | 'error' | 'note'
- statuses: 'idle' | 'active' | 'waiting' | 'completed' | 'error'
- transcriptBuffer cap: last 20000 chars
- heuristic test runs against last 4000 chars of cumulative buffer (NOT raw chunk)

CHANGES (apply in order; each is one Edit):
1. Extend the `state` object with `narrationByPath: new Map()` and `narrationOpen: false`.
2. In `init()`, after `els.newSessionBtn = …`, cache `els.shell`, `els.narrationToggle`, `els.narrationSidebar`, `els.narrationClose`, `els.narrationFolder`, `els.narrationBody`.
3. In `bindEvents()`, before the `window.addEventListener('click', …)` line, bind toggle and close handlers (set `aria-pressed`, flip `state.narrationOpen`, call `renderNarrationSidebar()`).
4. In `navigateTo()`, append `renderNarrationSidebar();` as the final statement.
5. In `launchClaudeForPath()`, after `state.sessionsById.set(session.id, session);`, add a `'session-started'` event and set status `'active'`.
6. Replace `session.term.onData((data) => api.writeTerminal(session.id, data));` with `session.term.onData((data) => handleTerminalInput(session, data));`.
7. Replace the entire `bindTerminalEvents()` body to also call `handleTerminalOutput` from `onTerminalData` and to log an exit event from `onTerminalExit` (using `exitCode !== 0` as the error discriminator).
8. Add the helper block (getNarration, ensureNarration, addNarrationEvent, setNarrationSummary, renderNarrationSidebar, shorten, handleTerminalInput, NARRATION_HINTS constant, handleTerminalOutput) between `escapeHtml` and the closing `window.addEventListener('DOMContentLoaded', init);`.

The exact code for every change is in `docs/superpowers/plans/2026-05-24-narration-sidebar-parallel.md` under "Agent C". Read that file before starting. Do not deviate from the contract.

When done:
- Run `node --check renderer\app.js` (use the Bash or PowerShell tool) and report the result.
- Reply with: (a) ordered list of the 8 Edits performed (one line each, citing the function modified), (b) the full new helper-functions block as it now exists, (c) any contract deviation, (d) any open questions about ambiguous insertion points.
```

---

## Self-Review Checklist (orchestrator runs before Phase 1 dispatch)

1. **Spec coverage** — every behavior in the original user spec maps to a Phase 1 change:
   - per-folder narration via `narrationByPath[currentPath]` ✓ (Change 8 — `renderNarrationSidebar`)
   - toggle button in `.topbar` ✓ (Agent A insertion 1)
   - empty state ✓ (Change 8 — `renderNarrationSidebar` empty branch)
   - status pill + summary + timeline ✓ (CSS block + render function)
   - session-started recording ✓ (Change 5)
   - user-task recording from xterm onData ✓ (Changes 6 + 8 — `handleTerminalInput`)
   - heuristic agent/plan/completion detection ✓ (Change 8 — `NARRATION_HINTS`)
   - dedupe via `seenHints` ✓
   - minimize/restore still narrates ✓ (because narration is keyed by path, not by session-window visibility)
   - exit event recording with completed/error discriminator ✓ (Change 7)
   - layout grid update for `.shell.narration-open` ✓ (Agent B change 2)
   - no inheriting parent narration in child folders ✓ (each folder has its own key)

2. **Placeholder scan** — no "TBD", "appropriate error handling", "fill in", or unreferenced helpers. Every code block is concrete.

3. **Type consistency** —
   - `narrationByPath` is `new Map()` in state init and treated as a `Map` everywhere (`get`, `set`).
   - `inputBuffer` is `session.inputBuffer`, never `narration.inputBuffer`.
   - `seenHints` is `{}`, never `new Set()`.
   - `els.shell` resolves via `document.querySelector('main.shell')`, not `getElementById`.
   - `addNarrationEvent` and `setNarrationSummary` both call `ensureNarration` first, so they can be called before `session-started`.
   - `crypto.randomUUID` fallback present (renderer is sandboxed; crypto is available but defensive).

4. **Contract drift defense** — every shared identifier appears in the Phase 0 contract; Phase 2 Step 2 greps for them across files before runtime verification.

---

## When *not* to use this orchestration

- If you (or the user) want to extend the v1 to LLM-summarized events or `subagent_type`-aware structured events, write a fresh plan — the architecture recommendation in the original spec stands: keep the UI consuming structured `addNarrationEvent(path, kind, text)` calls; only the event SOURCE changes.
- If persistence is requested, add an IPC layer (main owns `%APPDATA%\ezvibes\narration.json` with atomic writes; renderer sends updates) — that is a separate plan, not a Phase-1 task here.
