# Research: Self-Sustaining Agent Loops (A5)

Scope: agents that operate autonomously for periods of time without continuous human input. Cron-based scheduling, autonomous loops, watch-and-react, self-monitoring, drift detection, budget guards, when to halt, and the 2024–2026 production examples. One of 10 parallel research slices.

---

## 1. How to Look at This Correctly (Meta)

Autonomous loops fail in predictable ways. AutoGPT's 2023 post-mortems showed agents doing 300+ API calls over 2 hours on "research the latest trends in renewable energy" with no summary ever produced — the agent kept deciding existing research was incomplete. The Downloads-folder-cleanup story is canonical: 15+ reorganizations using different schemes, thousands of file moves, system performance degraded. Root causes: vague completion metrics, no state tracking to detect repetition, no resource awareness, no circuit breakers. Every modern design choice is a reaction to those failures.

**Lens 1 — Trigger model.** Four primitives, pick deliberately:
- **Cron / fixed interval** — predictable, cheap, simple. Wastes work when nothing has changed. Use for polling and reminders.
- **Event / webhook** — reactive, no idle cost. Requires an upstream that emits events (GitHub, CI, Slack). Use for "react to PR opened."
- **Watch / monitor (long-poll)** — a script streams output; the agent wakes on each line. Claude Code's Monitor tool implements this; it is "often more token-efficient and responsive than re-running a prompt on an interval."
- **Continuous / self-paced** — the agent picks its own next delay (Claude `/loop` with no interval picks 1m–1h based on context). Most expensive, most flexible.

**Lens 2 — Halt conditions are non-negotiable.** OpenHands ships three defaults that every agent loop needs: `MAX_ITERATIONS` (default ~100), `LLM_NUM_RETRIES` (default 8), and an accumulated-cost cutoff. AutoGen calls them termination conditions: `MaxMessageTermination`, `TextMentionTermination`, `TokenUsageTermination`, `TimeoutTermination` — typically combined. The "three root causes cover 90% of cases" line from AutoGen docs is exact: missing max_turns, a termination function that never returns True, and agents whose system prompts don't include a clear "done" signal.

**Lens 3 — Self-verification is suspect.** AutoGPT's defining bug was the agent grading its own work: it relied on natural-language assessment of whether a goal was complete, which defaulted to "more work needed." The fix the industry converged on: don't let the worker grade itself. Use a separate verifier (Retteli's QualityGate skill mirrors this), or use objective checks (tests pass, build green, exit code 0). If you must let the agent self-grade, require a delta summary on every iteration past the first ("if you cannot name a meaningful change vs. last plan, stop") — that breaks the recursive-verification loop.

**Lens 4 — Drift over long runs is real and quiet.** The Agent Drift paper (arXiv 2601.04170) projects up to 42% reduction in task success in long-running multi-agent systems through semantic drift (deviation from intent), coordination drift (consensus breakdown), and behavioral drift (unintended strategies emerging). It's hidden — "in most production systems, the model continues to respond while dashboards stay reassuringly green." Mitigation: episodic memory consolidation, drift-aware routing, adaptive behavioral anchoring. Practical solo-dev version: each iteration of a long-running loop should re-read the canonical plan file, not rely on accumulated context.

**Lens 5 — HITL is structural, not optional.** "AI coding agents like Claude Code and Codex default to autonomous execution — writing files, running shell commands, and making architectural decisions without pausing for review. Human-in-the-loop approval gates fix this by inserting explicit confirmation checkpoints for high-stakes operations while letting agents move freely on safe ones." Thresholds escalate when confidence is low, risk is high, or ambiguity is high. The industry's "central lesson, repeated by Anthropic, LangChain, and Karpathy in nearly identical language: start with the simplest solution, increase autonomy only when needed, and always maintain human control checkpoints."

---

## 2. Current State of the Art

**Claude Code `/loop` + Cron tools (v2.1.72+, March 2026).** Session-scoped scheduler with three tools: `CronCreate`, `CronList`, `CronDelete`. 5-field cron expressions. Three modes: interval+prompt (fixed cadence), prompt-only (Claude picks delay 1m–1h dynamically, can also use the Monitor tool to stream rather than poll), nothing (runs built-in maintenance prompt or `.claude/loop.md`). **Built-in halt mechanics:** 7-day expiry on recurring tasks (auto-deletes after one final fire), 50 tasks/session cap, Esc cancels pending wakeup, `CLAUDE_CODE_DISABLE_CRON=1` kills the scheduler. Jitter built in to avoid thundering-herd. Critical limitation: tasks only fire while Claude Code is running and idle; closing the terminal stops them.

**Claude Code Routines (April 14, 2026 research preview).** Cloud-resident persistent autonomous agents. Three trigger types: schedule (min interval 1 hour), per-routine HTTP endpoint with bearer token, GitHub webhook events. Runs on Anthropic infrastructure, no local machine needed, fresh clone each run (no local files). Available on Pro/Max/Team/Enterprise. Reported daily cap: 15 runs/account in preview. Distinct from `/schedule` CLI command which configures Routines.

**Claude Code on GitHub Actions** (`anthropics/claude-code-action@v1`, launched Sept 29, 2025 with Claude Code 2.0). Uses `schedule:` cron trigger or `issues.opened` event. Opus 4.7 available in the action since April 16, 2026. Free runner minutes are the de facto budget guard.

**Devin (Cognition).** Autonomy via "ACU" billing — 1 ACU ≈ 15 min of active autonomous work. Core $20/mo + $2.25/ACU (~$9/hr autonomous); Team $500/mo includes 250 ACUs ($2.00/ACU ≈ $8/hr, ~62.5 hrs/mo). Feb 2026 added parallel sessions and improved context retention; still session-scoped, no long-term cross-session memory. Guardrails are external: required PR review, status checks, branch protections, isolated execution, env-var scrubbing.

**OpenHands (formerly OpenDevin).** Open-source. V0→V1 split Nov 2025 (modular Software Agent SDK). Defaults: `MAX_ITERATIONS=100`, `LLM_NUM_RETRIES=8`, hard accumulated-cost cutoff. Typical cost: $0.05–$0.30 trivial, $0.50–$3 SWE-Bench-style fix, $5–$30 multi-hour run.

**Cursor Cloud (Background) Agents.** Up to 8 in parallel. Isolated Ubuntu VM per task, dedicated `agent/<slug>` branch from main, opens PR when done. Requires Pro ($20/mo); always runs in Max Mode. ~$0.30–$0.60 for a 50-step task, up to $4–$5 for complex. Pro plans include $20 monthly credit pool.

**AutoGen.** `max_turns` defaults to None (= no limit) — the source of most infinite-loop incidents. Best practice: combine `MaxMessageTermination` + `TextMentionTermination("TERMINATE")` + `TimeoutTermination`. The framework now ships these as composable terminators.

**BabyAGI / AutoGPT lineage.** What they got wrong: subjective natural-language completion criteria; missing state to recognize repeated actions ("loop identical search queries although it successfully got Google results"); no cost awareness; no circuit breakers. The infamous AutoGPT pattern: complete task → check completion → decide check wasn't thorough → check again → repeat. BabyAGI specifically lacked memory of completed tasks, so it kept reinventing the plan in circles.

**Sourcegraph.** Discontinued Cody Free/Pro July 23, 2025. Pivoted to Amp (agentic) and Cody Enterprise. Coding Agents (code review, migration, testing, docs, notification) announced Jan 29, 2025 — early-access program, marketed > shipped at scale.

**Babysit pattern** (a5c.ai babysitter, Codex `babysit-pr` skill, AddyOsmani long-running-agents). Watcher continues polling autonomously until a strict stop condition is met; summarizes only status changes with heartbeats during quiet periods; explicit plan file + explicit progress file + refusal to stop early.

**Cost-control infrastructure.** Production teams converging on: per-request token ceilings, per-session budgets, per-key monthly caps, model-tier routing, and a circuit breaker that suspends the agent when per-session cost exceeds a hard ceiling. Best implemented at gateway level (HTTP proxy returns 429 when budget hit) — works across frameworks. "An agent calling Claude-Sonnet 200 times a day can reach an $8 budget before lunch."

---

## 3. Implementation Guidance — Solo-Dev "Self-Sustains for N Hours" Recipe

Target: a loop that runs for 4–24 hours unattended, makes useful progress, halts cleanly, and never costs more than $X.

**Architecture (Retteli context).** Use `CURRENT_PLAN.md` as the durable state file the loop re-reads each iteration (defeats drift). Use the `.handoffs/` chain only when verification is needed. The QualityGate skill is the second-agent verifier — never let the worker self-grade.

**Trigger choice.** Default to Claude Code `/loop <interval> <prompt>` for sessions you keep open overnight. Promote to Routines (cloud) when the work must survive the laptop closing. Use GitHub Actions only when the trigger is naturally a repo event.

**Halt-condition checklist (mandatory — every loop must answer YES to all):**

```
[ ] Hard iteration cap set (e.g. MAX_ITERATIONS=20 for solo-dev loops)
[ ] Hard wall-clock cap set (e.g. 4h, with Esc/cancel path)
[ ] Hard token/$ budget set per run, separate from per-session
[ ] Success criterion is objective (tests pass / build green / file exists / PR merged)
    — NOT "the agent thinks it is done"
[ ] No-progress detector: if iteration N produces same-hash output as N-1, stop
[ ] Delta-summary required on iteration >= 2; if no meaningful delta, stop
[ ] Drift check: every K iterations, re-read CURRENT_PLAN.md from disk
    (do not trust accumulated context)
[ ] Independent verifier (QualityGate) gates progression — not the worker itself
[ ] HITL escalation path: low confidence, high risk, or ambiguity -> pause + ping inbox
[ ] Circuit breaker: 3 consecutive errors / same tool with same args -> halt
[ ] Auto-expiry: recurring loops self-delete after a chosen TTL
    (Claude Code's 7-day default is sensible)
[ ] Kill switch: a single env var or file flag stops everything (CLAUDE_CODE_DISABLE_CRON=1)
```

**Concrete recipe.**
1. Write the loop prompt to `.claude/loop.md` — it gets truncated at 25 KB, so keep it tight: success criterion, what counts as a delta, when to escalate.
2. Start with `/loop 15m /loop` (fixed 15-min interval; predictable cost). Promote to bare `/loop` (self-paced) only after the loop has run cleanly for a few cycles.
3. Set wall-clock cap explicitly: cancel the recurring task after 4 hrs (or rely on 7-day auto-expiry as the longest backstop).
4. Use Channels (event-driven) for CI failures rather than polling the build — cheaper and faster.
5. After each iteration, the loop writes a one-line entry to `CURRENT_PLAN.md` session log. If three consecutive entries are identical, the next iteration halts with an inbox message.
6. Wrap any cost-bearing action behind a QualityGate dispatch — independent verification by a fresh agent is the structural antidote to self-grading drift.
7. Budget enforcement: solo dev on Pro plan has ~$20/mo credit. Treat each loop as costing $1–$5/hr (Cursor/Devin range); cap at 5 hrs/day default.

**Anti-patterns to refuse.**
- Bare `/loop` with no prompt on a fresh repo where `loop.md` doesn't exist — the built-in maintenance prompt assumes a transcript context that isn't there.
- Self-modifying loops (the agent rewrites its own loop.md). Recursive self-improvement is an open research problem with active 2025–2026 safety papers (SAHOO, AGrail, AgentDoG); don't ship it.
- Trusting the agent's "I am done" without an objective check.
- Running loops on protected branches without HITL on push/merge.

---

## 4. Cross-References to Sibling Research

- **A6 (Embedded terminal):** the loop's success criterion often runs in that terminal; long-running watches use Monitor (streams stdout) — terminal capabilities determine what counts as "objective check."
- **A7 (Env access / MCP):** the budget gateway sits in MCP-land; quota enforcement is environment-side, the loop just receives 429s.
- **A8 (Inbox messaging):** I specify WHEN the loop pings (HITL escalation, halt, drift detected). A8 owns HOW the message is shaped and delivered.
- **A9 (Static codebase / rules):** A9 owns `loop.md`, `CLAUDE.md`, plan files as static artifacts. I cover the runtime/temporal layer — what reads them each iteration, how often, how state changes.

---

## 5. Sources

- [Claude Code — Run prompts on a schedule (official docs)](https://code.claude.com/docs/en/scheduled-tasks)
- [Claude Code — Routines (official docs)](https://code.claude.com/docs/en/routines)
- [Claude Code — GitHub Actions (official docs)](https://code.claude.com/docs/en/github-actions)
- [anthropics/claude-code-action (GitHub)](https://github.com/anthropics/claude-code-action)
- [Anthropic Claude Code Cron Scheduling launch (Winbuzzer, Mar 2026)](https://winbuzzer.com/2026/03/09/anthropic-claude-code-cron-scheduling-background-worker-loop-xcxwbn/)
- [Anthropic Claude Code Routines launch (Winbuzzer, Apr 2026)](https://winbuzzer.com/2026/04/16/anthropic-claude-code-routines-scheduled-ai-automation-xcxwbn/)
- [Devin Pricing (official)](https://devin.ai/pricing/)
- [Devin Pricing & ACU breakdown 2026 (Brainroad)](https://brainroad.com/devin-pricing-in-2026-real-cost-hidden-spend-and-alternatives/)
- [Devin Aftermath: production realities (SitePoint)](https://www.sitepoint.com/devin-ai-engineers-production-realities/)
- [OpenHands official site](https://www.openhands.dev/)
- [OpenHands deep-dive (DEV)](https://dev.to/truongpx396/openhands-deep-dive-build-your-own-guide-1al0)
- [Cursor Background Agents guide (Blink)](https://blink.new/blog/cursor-background-agent)
- [Cursor Agent Mode 2026 (Morph)](https://www.morphllm.com/cursor-agent-mode)
- [AutoGen Termination docs](https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/tutorial/termination.html)
- [Fix Infinite Loops in Multi-Agent Chat (Markaicode)](https://markaicode.com/fix-infinite-loops-multi-agent-chat/)
- [awesome-agent-failures — AutoGPT planning failures (vectara)](https://github.com/vectara/awesome-agent-failures/blob/main/docs/case-studies/autogpt-planning-failures.md)
- [The Autonomy Dial (Tao An, Medium)](https://tao-hpu.medium.com/the-autonomy-dial-why-every-ai-agent-builder-landed-on-the-same-design-trick-e795cc9ae713)
- [Notorious Agent Loops (Srikanth Machiraju)](https://techtalkwithsriks.medium.com/notorious-agent-loops-c4cc05b859b5)
- [Agent Drift paper (arXiv 2601.04170)](https://arxiv.org/abs/2601.04170)
- [LLM Drift Detection (InsightFinder)](https://insightfinder.com/blog/hidden-cost-llm-drift-detection/)
- [Long-Running Agents (Addy Osmani)](https://addyosmani.com/blog/long-running-agents/)
- [a5c.ai Babysitter (GitHub)](https://github.com/a5c-ai/babysitter)
- [Codex babysit-pr skill (explainx.ai)](https://explainx.ai/skills/openai/codex/babysit-pr)
- [Human-in-the-Loop Approval Gates (Machine Learning Mastery)](https://machinelearningmastery.com/building-a-human-in-the-loop-approval-gate-for-autonomous-agents/)
- [Stopping Conditions That Actually Stop Multi-Agent Loops (DEV)](https://dev.to/dowhatmatters/stopping-conditions-that-actually-stop-multi-agent-loops-bnb)
- [AI Agent Circuit Breakers (DEV)](https://dev.to/waxell/ai-agent-circuit-breakers-the-reliability-pattern-production-teams-are-missing-5bpg)
- [LLM Token Budget Strategies (AI Security Gateway)](https://aisecuritygateway.ai/blog/llm-token-budget-strategies-for-agents)
- [Agent Budget Guard MCP (Dev Journal)](https://earezki.com/ai-news/2026-03-02-i-built-an-mcp-server-so-my-ai-agent-can-track-its-own-spending/)
- [Sourcegraph unveils AI coding agents (InfoWorld)](https://www.infoworld.com/article/3812799/sourcegraph-unveils-ai-coding-agents.html)
- [Is research into recursive self-improvement becoming a safety hazard? (foom magazine)](https://www.foommagazine.org/is-research-into-recursive-self-improvement-becoming-a-safety-hazard/)

**Caveats on shipped-vs-demoed.** Devin's "62.5 hrs/mo of autonomous engineering" is a billing translation, not a guarantee of useful output — multiple 2026 reviews note real tasks consume more ACUs than expected. Sourcegraph's Coding Agents announcement (Jan 2025) was early-access; broad-availability claims are softer than the marketing. Cursor's "8 parallel background agents" is the documented cap; real throughput depends on Max Mode credit burn, which is fast. Claude Code Routines daily cap of 15 runs/account is from a preview-period dashboard screenshot, not a stable pricing commitment.
