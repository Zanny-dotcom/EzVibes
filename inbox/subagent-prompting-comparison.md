# Sub-Agent Prompting: Comprehensive Guide

## Why This Matters

Sub-agents start with **fresh context**. They cannot see your conversation, parent goal, prior tool output, or what siblings are doing. Vague prompts produce duplicated work, scope drift, hallucinated context, and padded output. Structured prompts produce sharper non-overlapping output in fewer tool calls.

Rule of thumb: a sub-agent costs roughly 15× the tokens of doing the work inline. Use sub-agents to **exclude verbose context** (log scans, web research, long file reads) or to **parallelize independent work** — not to shave a 30-second task.

## The Contract: Every Prompt Must Contain Five Things

| # | Element | Purpose |
|---|---------|---------|
| 1 | **Objective** | One paragraph: the task plus the parent goal (why it matters). |
| 2 | **Scope boundaries** | What is *out* of scope. Especially what siblings own. |
| 3 | **Output format** | Exact shape — schema, section headers, word cap. |
| 4 | **Tool / effort budget** | Allowed tools, max calls, when to stop. |
| 5 | **Escape hatch** | If blocked or uncertain, return a structured "needs_clarification" signal instead of guessing. |

If any element is missing, the prompt is incomplete. Stop and add it before dispatching.

## Full Template

```text
Role:
Parent Goal:
Task:
Out of Scope:
Context / Inputs:
Tools and Autonomy:
Method:
Deliverable Contract:
Success Criteria:
Communication Back:
Gaps or Uncertainty:
```

Minimal version when the work is small:

```text
Objective: {task} — needed because {parent goal}.
Out of scope: {what siblings own / what to skip}.
Output: {schema or section list, max N words}.
Budget: {tools allowed, max N tool calls, stop when ...}.
Escape: if blocked, return {status: 'needs_clarification', question: '...'}.
```

## Per-Element Guidance

### Objective

Bad: "Research the semiconductor shortage."
Good: "Compare the 2021 auto-chip crisis with current AI-GPU supply constraints. User is writing a 2026 strategy brief; the comparison must surface causes, durations, and recovery patterns."

State the parent goal so the agent can make judgment calls when the prompt under-specifies edge cases. Cognition's Flappy Bird failure: a worker told to "build a green pipe background" produced Mario-style art because it never knew the parent was building Flappy Bird.

### Scope boundaries

Without this, parallel siblings silently overlap. Name what siblings own.

Good: "Cover 2021 automotive crisis only. Sibling agent owns 2024+ AI-GPU scope. Do not cite anything post-2023."

### Output format

Prescribe the exact shape. Schema, headers, hard word cap.

Good: "Return JSON `{causes:[], duration_months:int, citations:[url]}`. Max 350 words. Three sections in fixed order: causes, duration, recovery."

Bad: "Return what you find."

### Tool / effort budget

Restrict tools to enforce focus — a read-only researcher should not have Edit/Write. Cap calls.

Good: "WebSearch + WebFetch only. Max 6 tool calls. Stop after attributing 5 distinct rules."

Stop conditions must be enforceable counts, not vibes. One LangGraph supervisor looped 47 iterations because the limit was a sentence, not a counter.

### Escape hatch

Required. Without it, the agent will pad or invent to fill the schema.

Good: "If a source is paywalled, contradicts another, or the count cannot be hit honestly, return `{status: 'needs_clarification', question: '...'}` instead of fabricating."

## Patterns by Use Case

### Research sub-agent

- Specify source priorities (vendor docs > community posts > training-data recall).
- Require source URL + one-line relevance note per claim.
- Require a freshness check on time-sensitive claims (state the source date).
- Require a "gaps or uncertainty" section so the parent knows what was *not* covered.

### Code analysis sub-agent

- Hand over the exact entry points: file paths, function names, line numbers.
- Require `file:line` citations, not paraphrased descriptions.
- Restrict to read-only tools (Read, Glob, Grep) — withhold Edit/Write.

### Parallel fan-out

- Slice scope explicitly per sibling. "Agent A: directories X, Y. Agent B: directories Z, W."
- Tell each agent what siblings own so they do not duplicate.
- Prescribe a shared output schema so the parent can merge mechanically.
- Stop conditions per sibling, not shared, so one slow agent does not block.

### Evaluator / verifier sub-agent

- Pass only the artifact under review, not the conversation that produced it (avoid anchor bias).
- Require structured findings: claim → evidence → severity → recommendation.
- Require an explicit "no issues found in section X" rather than silent omission.

### Agent-as-tool vs. handoff

Decide before dispatching:

- **Tool**: parent synthesizes; sub-agent returns raw findings; parent owns the user-facing answer.
- **Handoff**: sub-agent owns the full task, speaks to the user, parent steps out.

This decides who synthesizes, who speaks to the user, and what shape the return takes.

## Failure Modes and Safeguards

| Failure | Safeguard |
|---------|-----------|
| Ambiguous delegation → duplicate work, gaps | Task contract: objective, scope, sources, schema, non-goals. |
| No single owner → weak synthesis | Name one integrator. Define handoff rules and decision rights. |
| Over-broad / stale context → confusion, truncation | Pass only high-signal facts. Require source dates. Have the agent state assumptions. |
| Unsafe autonomy → uncontrolled tool use, loops | Max-turn limits. Risk-rated tools. Human approval for irreversible actions. |
| Poor output format → integration breaks | Require structured output: claims, evidence, confidence, what was not checked. Validate before synthesis. |
| No verification → plausible-but-wrong outputs ship | Independent verifier pass. Citation spot-check. Executable validation where possible. |
| Coordination drift → ignored findings, contradictions | Coverage / contradiction matrix. Force reconciliation before synthesis. |
| Accuracy-only eval → cost and fragility hidden | Compare against a simpler baseline. Track cost, variance, trace quality. |

## Red Flags — Stop Before Dispatching

- Prompt under 100 words AND parallel siblings → missing scope boundaries.
- No output schema → you will get prose when you wanted a list.
- No tool budget → agent will over-research.
- No escape hatch → agent will pad or invent.
- Tempted to paste the whole conversation → extract the 3–5 facts the agent actually needs.
- "I will let the agent decide what to focus on" → that is the failure mode, not the strategy.
- Worker is asked to *decide* rather than *execute* → routing belongs in the orchestrator.

## Review Checklist (after sub-agent returns, before using output)

1. Restate the parent task, success criteria, out-of-scope items.
2. Validate output schema. Reject malformed output rather than salvaging.
3. Build coverage matrix: requirement → sub-agent output → evidence → status.
4. Mark duplicates, gaps, contradictions, unsupported claims, stale sources, speculation.
5. Verify cited sources, dates, calculations, code or tests.
6. Inspect traces for loops, premature termination, ignored instructions, unsafe tool calls.
7. Reconcile conflicts explicitly. Do not average incompatible claims.
8. Record trust level: accept, accept with caveats, retry, reject.

## Evaluation Metrics (for tuning your prompts over time)

- Task completion rate and requirement coverage.
- Evidence quality, citation accuracy, source freshness.
- Duplicate-work rate. Uncovered-scope rate.
- Contradiction rate across sibling outputs.
- Schema compliance rate.
- Verification pass rate. Defects caught after sub-agent completion.
- Tool calls, tokens, latency, cost per successful task.
- Repeat-run variance.
- Delta vs. single-agent baseline. Multi-agent only justifies its cost on parallelizable, high-value work.

## Worked Example: Loose vs. Structured

Same research question, two prompts, observed delta:

**Loose** — "Research best practices for prompting sub-agents."

- 20 tool calls.
- Sibling overlap: both cited the same 3 sources.
- Attribution: "Anthropic blog."

**Structured** — Full template, scope boundaries, schema, 6-call budget, escape hatch.

- 12 tool calls (~40% fewer).
- Sibling overlap: zero.
- Attribution: "Claude Agent SDK / Subagents page — `tools` / `disallowedTools` fields."
- Tight scope forced the agent past the obvious results into a deeper postmortem the loose run never found.

The structured version does not produce radically new principles. It makes the output easier to trust, merge, evaluate, and reuse.

## Sources

- Anthropic — Multi-agent research system writeup.
- Anthropic — Building effective agents.
- Anthropic — Effective context engineering for AI agents.
- OpenAI — Agents SDK orchestration, guardrails, evaluation, tracing docs.
- OpenAI — Practical guide to building AI agents.
- LangChain — Sub-agent and handoff docs.
- Microsoft — AutoGen / Magentic-One architecture notes.
- Google ADK — Agent collaboration docs.
- CrewAI — Task docs.
- MASFT paper — "Why Do Multi-Agent LLM Systems Fail?"
- "AI Agents That Matter."
- Cognition — "Don't Build Multi-Agents" (Flappy Bird example).
