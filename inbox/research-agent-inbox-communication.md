# Research: Agent-to-Agent Communication via File-Based Inbox Systems

**Slice A8 of 10 — parallel research.** Word budget: ~1800. Focus: how multi-agent systems pass context between agents using durable, file-based mailboxes, handoff chains, and shared blackboards.

---

## 1. How to Look at This Correctly (Meta)

Before surveying frameworks, fix the design lenses. Every agent-to-agent comms system answers the same 5 questions — and ignoring any of them is how production multi-agent systems silently break.

**(a) Synchronous vs asynchronous.** Sync = caller blocks until the callee finishes (OpenAI Swarm/Agents SDK handoffs, CrewAI `DelegateWorkTool`). Async = sender drops a message into a queue and walks away (LobsterMail's email inboxes, Anthropic's parallel sub-agents, Claude Code's `.handoffs/` chain). Sync is simpler to reason about but serializes work and is fragile under crashes. Async unlocks parallelism but demands durability and explicit status tracking. **For local LLM orchestration on a developer workstation, async-via-filesystem is the sweet spot** — it survives crashes, is human-readable, and requires no daemon.

**(b) Durable vs ephemeral.** In-memory state (LangGraph's `StateGraph`, AutoGen's GroupChat history) vanishes on crash. Filesystem state (this repo's `.handoffs/`, MCP Agent Mail's Git-backed store) survives. The cost of durability is roughly zero on a developer workstation; the cost of losing a 90-minute Opus run because the orchestrator crashed is not zero. **Default to durable.**

**(c) Addressing modality.** Three patterns dominate:
- **Direct / inbox** — sender names a specific recipient (`agents/Builder/inbox/`). Cleanest mental model. Used by MCP Agent Mail, Claude Code agent teams.
- **Channel / topic** — agents subscribe to topics (AutoGen's group-chat topic + per-agent topic; Google A2A's `contextId`). Good for broadcast and observability.
- **Blackboard** — no addressing at all; everyone reads/writes a shared space and a control shell picks who runs next ([blackboard pattern](https://callsphere.ai/blog/blackboard-architecture-multi-agent-systems-shared-knowledge-spaces), Hearsay-II 1970s, LangGraph shared state). Best for emergent problems where the agent graph is web-shaped, not chain-shaped.

The numbered-handoff pattern in this very repo (`.handoffs/hand-off-001.md`) is a **degenerate blackboard with a strict total ordering** — every agent reads the whole chain, sees the world state, and appends.

**(d) Message schema strictness.** Free-form markdown (this repo, MCP Agent Mail bodies) is human-auditable and LLM-native, but parsing for state machines is fragile. Strict JSON (A2A, LangGraph state schemas, Claude Code agent-team inbox protocol messages) is machine-actionable but rigid. **The winning hybrid is frontmatter-JSON + markdown body** — MCP Agent Mail does exactly this, and so should any new system.

**(e) Acknowledgement, status, and termination.** The single biggest failure mode in multi-agent systems is **missing termination conditions** — the [arXiv survey on why multi-agent LLM systems fail](https://arxiv.org/html/2503.13657v1) ranks this in the top 3. Every message needs a status lifecycle (`pending` → `in-progress` → `done` / `fix-required` / `blocked`) and every chain needs a clear terminal predicate the orchestrator can check. Read receipts (`read_ts`) and acknowledgements (`ack_ts`) prevent silent drops. A2A's 8-state task lifecycle (`SUBMITTED`, `WORKING`, `COMPLETED`, `FAILED`, `CANCELED`, `INPUT_REQUIRED`, `REJECTED`, `AUTH_REQUIRED`) is a good reference.

---

## 2. Current State of the Art

### Blackboard architecture (1970s, still the conceptual root)

Originally built for Hearsay-II speech recognition at CMU, the [blackboard pattern](https://medium.com/@edoardo.schepis/patterns-for-democratic-multi-agent-ai-blackboard-architecture-part-1-69fed2b958b4) has three pieces: a **shared knowledge space**, independent **knowledge sources** (specialists), and a **control shell** that picks who runs next. Modern multi-agent systems are mostly rediscoveries. The [LLM-Based Multi-Agent Blackboard System paper (arXiv 2510.01285)](https://arxiv.org/pdf/2510.01285) and the [agent-blackboard GitHub project](https://github.com/claudioed/agent-blackboard) (9 specialist agents over a shared board) show the pattern is fully alive.

### Google A2A (Agent2Agent) — the emerging open standard

Announced April 2025, [v0.2.5+ as of 2026](https://a2a-protocol.org/latest/specification/), now under the Linux Foundation with 150+ org backers (Microsoft, AWS, Salesforce, SAP, ServiceNow). Transport is **HTTP + JSON-RPC 2.0 + SSE**. Agents publish an **Agent Card** at `/.well-known/agent-card.json` advertising name, capabilities, and skills. Messages carry `messageId`, `contextId`, `taskId`, `role` (USER/AGENT), `parts[]`, `metadata`, `extensions[]`. Core RPC methods: `SendMessage`, `SendStreamingMessage`, `GetTask`, `ListTasks`, `CancelTask`, `SubscribeToTask`, `CreateTaskPushNotificationConfig`. Task lifecycle has 8 states (above). **A2A is for cross-org / cross-framework remote agents** — not the right primitive for local file-based orchestration, but its message and lifecycle schemas are the best reference designs available.

### LangGraph — shared-state channels

[LangGraph](https://docs.langchain.com/oss/python/langgraph/graph-api) (30k+ stars in 2026) treats agents as nodes on a graph with a shared `State` dict. Each key is a **channel** with a **reducer** specifying merge semantics (overwrite, append, etc.):
```python
class State(TypedDict):
    messages: Annotated[list[str], add]
```
The `Send` primitive enables dynamic fan-out (`Send("worker", payload)`), and `Command(update={...}, goto="next")` combines state update + routing in one op. Persistence is via `PostgresSaver` or `SqliteSaver` (Postgres in production). **Strength:** type-checked schemas. **Weakness:** schema migrations break persisted checkpoints; ephemeral by default.

### AutoGen — group chat as conversation

[AutoGen's GroupChat](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html) uses two topics per agent: a shared **group-chat topic** + a personal topic for `RequestToSpeak` signals. The `GroupChatManager` orchestrates turn-taking. Messages are `GroupChatMessage` envelopes around `UserMessage` bodies. **Strength:** natural LLM conversation flow. **Weakness:** chat history grows unbounded; the [history-clearing knobs](https://microsoft.github.io/autogen/0.2/docs/reference/agentchat/groupchat/) are blunt instruments.

### CrewAI — hierarchical delegation

A manager agent uses `DelegateWorkTool(task, context, coworker)` to dispatch to specialists ([docs](https://docs.crewai.com/en/concepts/collaboration)). The notorious failure is the **["Delegation Ping-Pong"](https://azguards.com/technical/the-delegation-ping-pong-breaking-infinite-handoff-loops-in-crewai-hierarchical-topologies/)** — two agents with `allow_delegation=True` infinite-loop, burn tokens, OOM the context window. Mitigation: unidirectional chains, `max_iter` bounds, at least one terminal agent with delegation off.

### OpenAI Swarm → Agents SDK — typed handoffs

[Swarm](https://github.com/openai/swarm) (now archived/educational) introduced the **handoff = function-that-returns-an-agent** idiom. Migrated to the [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/handoffs/), which adds guardrails, tracing, managed handoffs, and Sessions for persistent memory. The new agent inherits prior conversation history by default; input filters let you trim what passes across. **Synchronous handoffs only** — not durable.

### File-based inbox systems — the most relevant prior art

Two reference implementations matter:

**1. MCP Agent Mail** ([github](https://github.com/Dicklesworthstone/mcp_agent_mail)) — production-grade. Git-backed message store with the following layout:
```
<store>/projects/<slug>/
  agents/<AgentName>/profile.json
  agents/<AgentName>/inbox/YYYY/MM/<msg-id>.md
  agents/<AgentName>/outbox/YYYY/MM/<msg-id>.md
  messages/threads/<thread-id>.md
  file_reservations/<sha1>.json
```
Messages are **markdown with JSON frontmatter**. SQLite + FTS5 for fast querying. Exposes resources `resource://inbox/{agent}` and tools `fetch_inbox()`, `send_message()`, `acknowledge_message()`. Includes **advisory file leases** to prevent concurrent edits — directly addresses the file-ownership rule in this repo's CLAUDE.md.

**2. Claude Code Agent Teams** (described in [the OpenCode port](https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol) and [Multi-Agent Swarm writeup](https://dev.to/oldeucryptoboi/how-the-multi-agent-swarm-actually-works-285n)) — uses `~/.claude/teams/{team}/inboxes/{agent}.json` as a per-agent JSON-array inbox. Messages carry sender, timestamp, `read: false`, message-ID. Protocol messages (`shutdown_request`, `permission_request`, `idle` with reason `available|interrupted|failed`) are typed and machine-dispatched; free-text messages go to the LLM. Priority ordering in the idle loop prevents starvation: shutdown > team-lead > FIFO peer > unclaimed tasks. Concurrency is handled by **re-read after lock acquisition** to prevent overwrites.

### Anti-patterns (what kills these systems)

- **Telephone-game context loss** — [Anthropic's research-system writeup](https://www.anthropic.com/engineering/multi-agent-research-system) explicitly works around this by letting sub-agents emit artifacts directly to a filesystem rather than serializing through the lead. Fix: artifacts pattern + structured handoffs, never nested conversational summarization.
- **Infinite handoff loops** — CrewAI ping-pong; AutoGen agents that never recognize termination. Fix: `max_iter`, terminal predicates, semantic-loop detection.
- **Orphaned messages** — no read receipts, sender assumes delivery. Fix: `ack_required` + `ack_ts`.
- **Schema drift** — JSON keys change between sessions, LangGraph checkpoints become unloadable. Fix: version every schema (`schema: v3`).
- **Race conditions on shared files** — two agents write `hand-off-007.md` concurrently. Fix: monotonic file IDs + write-once semantics (this repo's rule).
- **Conversation-history bloat** — AutoGen GroupChat without `clear_history` knobs. Fix: bounded history + summary checkpoints.

---

## 3. Implementation Guidance — Proposed Spec for the Retteli Inbox

The user's current `.handoffs/` chain (numbered markdown files, sequential, append-only) is **already a working blackboard-with-total-order**. To upgrade it to a multi-recipient inbox system while preserving the existing chain, here's a **synthesized** layout (this is a proposal, not a cited schema — labelled as such):

```
.handoffs/                              # existing global chain (orchestrator timeline)
  hand-off-001.md ...
.inboxes/                               # NEW — per-agent mailboxes
  <agent-name>/
    pending/<ISO8601>-<sender>-<msg-id>.md   # unread
    in-progress/...                          # claimed, not done
    done/<YYYY-MM>/<msg-id>.md              # archived after ack
    profile.json                             # agent identity, model, capabilities
.broadcasts/                             # NEW — fan-out / blackboard
  <topic>/<ISO8601>-<msg-id>.md
.locks/                                  # advisory file leases (per MCP Agent Mail)
  <sha1-of-target-path>.json
```

**Message schema** (markdown body with YAML/JSON frontmatter — proposed, synthesizing MCP Agent Mail + A2A conventions):

```yaml
---
schema: v1
msg_id: 2026-05-27T14-22-11Z-builder-7f3a
thread_id: feature-template-gallery
context_id: hand-off-005             # links into numbered chain
from: UltraBuilder
to: [QualityGate]
cc: [Orchestrator]
created: 2026-05-27T14:22:11Z
status: pending                       # pending | in-progress | done | fix-required | blocked
importance: high                      # normal | high | urgent
ack_required: true
references:
  - .handoffs/hand-off-004.md
  - src/components/Gallery.tsx
deadline: 2026-05-27T16:00:00Z        # optional; orchestrator escalates past this
schema_version: 1
---

## Summary
Built template gallery per spec in hand-off-004.

## Files Changed
- src/components/Gallery.tsx (new)
...

## Verification Needed
- Run `npm test`
- Check responsive layout at 320px / 768px / 1440px
```

**Status lifecycle** (mirrors A2A):
`pending` → `in-progress` → `done` (terminal happy) | `fix-required` (re-dispatch) | `blocked` (needs orchestrator) | `expired` (deadline missed)

**Atomic move semantics:** transitions are filesystem `mv` from one status directory to another — atomic on POSIX, near-atomic on NTFS via `MoveFileEx`. No file is ever edited in-place after creation except to append an `ack:` block.

**Failure handling:**
1. Orchestrator scans `pending/` older than deadline → escalates.
2. Two agents claiming the same message → file-lease in `.locks/` with TTL; loser retries.
3. Sender expects ack, none arrives in N seconds → mark `blocked`, log to `CURRENT_PLAN.md`.
4. Schema mismatch → reject with `fix-required` and a typed error message.

**Why this works for Retteli specifically:** preserves the existing `.handoffs/` chain (orchestrator's master timeline), adds per-agent inboxes for parallel work (the CLAUDE.md "wide parallelism" goal), uses Git-friendly markdown (every message is a commit-worthy artifact), and is fully inspectable without tooling.

---

## 4. Cross-References to Sibling Research

- **A6 (terminal):** the inbox files this spec proposes are exactly what an embedded terminal would `ls` / `cat` to surface to the user — natural pairing.
- **A7 (env / MCP):** MCP Agent Mail is itself an MCP server; A7's MCP analysis should evaluate it as a candidate transport for this inbox.
- **A9 (agents touching code):** file-leases in `.locks/` are the mechanism that prevents agents from clobbering each other's edits — directly relevant to A9's safety model.
- **A10 (cron / long-running autonomy):** the `deadline` field and orchestrator scanning of `pending/` is where A10's scheduler hooks in.

---

## 5. Sources

1. [A2A Protocol Specification (latest)](https://a2a-protocol.org/latest/specification/)
2. [A2A Protocol GitHub repo (a2aproject/A2A)](https://github.com/a2aproject/A2A)
3. [Google Developers Blog — Developer's Guide to AI Agent Protocols](https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/)
4. [MCP Agent Mail (Dicklesworthstone)](https://github.com/Dicklesworthstone/mcp_agent_mail)
5. [LangGraph Graph API docs](https://docs.langchain.com/oss/python/langgraph/graph-api)
6. [AutoGen Group Chat design pattern](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html)
7. [CrewAI Collaboration docs](https://docs.crewai.com/en/concepts/collaboration)
8. [CrewAI Delegation Ping-Pong analysis (Azguards)](https://azguards.com/technical/the-delegation-ping-pong-breaking-infinite-handoff-loops-in-crewai-hierarchical-topologies/)
9. [OpenAI Swarm GitHub](https://github.com/openai/swarm)
10. [OpenAI Agents SDK — Handoffs](https://openai.github.io/openai-agents-python/handoffs/)
11. [Anthropic Engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
12. [Blackboard Architecture for Multi-Agent Systems (CallSphere)](https://callsphere.ai/blog/blackboard-architecture-multi-agent-systems-shared-knowledge-spaces)
13. [Patterns for Democratic Multi-Agent AI: Blackboard Architecture (Schepis)](https://medium.com/@edoardo.schepis/patterns-for-democratic-multi-agent-ai-blackboard-architecture-part-1-69fed2b958b4)
14. [LLM-Based Multi-Agent Blackboard System (arXiv 2510.01285)](https://arxiv.org/pdf/2510.01285)
15. [Why Do Multi-Agent LLM Systems Fail? (arXiv 2503.13657)](https://arxiv.org/html/2503.13657v1)
16. [How the Multi-Agent Swarm Actually Works (Claude Code teams writeup)](https://dev.to/oldeucryptoboi/how-the-multi-agent-swarm-actually-works-285n)
17. [Porting Claude Code Agent Teams to OpenCode](https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol)
18. [LobsterMail — Multi-agent email coordination](https://lobstermail.ai/blog/multi-agent-email-coordination-how-ai-agents-use-inboxes-to-work-together)
19. [agent-blackboard GitHub (claudioed)](https://github.com/claudioed/agent-blackboard)
20. [AutoGen Conversation Patterns v0.2](https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns/)

*Versions noted where stale: A2A as of v0.2.5+ / Linux Foundation v1.0 (April 2026); LangGraph as of 2026 best-practices; AutoGen docs cite both 0.2 (stable patterns) and the current stable user guide. OpenAI Swarm is archived/educational — production code should use OpenAI Agents SDK.*
