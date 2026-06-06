# Master Index — Modern Web Theme + Agent Infrastructure Research

**Date:** 2026-05-27
**Scope:** 10 parallel research slices, non-overlapping, each two-phase (meta evaluation lenses → subject deep-dive)
**Goal:** Brief a sophisticated agent-enabled web platform with a dark-blue liquid-glass aesthetic AND with deep-access agent infrastructure (embedded terminals, MCP, inbox messaging, embedded agents, autonomous loops)

---

## 1. The 10 Reports

| # | File | One-line takeaway |
|---|---|---|
| A1 | `research-trust-psychology-modern-web.md` | Modern trust is conveyed by **substance over signal**: restraint, AAA contrast, calm motion (3–6s ambient / 150–200ms interactive), and confident microcopy — not badge walls or stock-photo teams. |
| A2 | `research-dark-navy-color-systems.md` | Use **OKLCH** with hue locked (~260°), a **4-layer elevation stack** (lighter-on-darker), **APCA Lc 60–75 "Silver"** for body text — Radix dark + Tailwind v4 are the authoritative palettes; never use one flat near-black. |
| A3 | `research-liquid-glass-glassmorphism.md` | Real liquid glass needs **refraction + specular + edge highlight + content distortion**, not just `backdrop-filter: blur`. Production path: SVG `feDisplacementMap`/`feSpecularLighting` for Chromium + dark-navy-tuned pseudo-element fallback for Safari/Firefox. |
| A4 | `research-corners-bezels-hairlines.md` | The "premium" feeling is **carved-not-pasted**: 1px hairline at `rgba(255,255,255,0.08–0.12)` + inset top highlight `inset 0 1px 0 rgba(255,255,255,0.06)` + nested-radius rule `inner = outer − padding`. Border-image cannot combine with border-radius — use the two-layer `background-clip` trick. |
| A5 | `research-reference-sites-audit.md` | Eight benchmarks split into **two schools**: cool-dark technical (Linear, Vercel, Stripe, Arc, Raycast, Cursor, Zed) and warm-light editorial (Anthropic). The highest-leverage single move is **investing in a non-Inter display face** with `-0.02em` to `-0.04em` tracking on display sizes. Make the signature interactive element *be* the product UI. |
| A6 | `research-embedded-terminal-architecture.md` | Stack is **xterm.js + node-pty/ConPTY**, but the architectural lift is **structured blocks** (Warp / VS Code OSC 633) rather than byte streams — that's what makes terminal output legible to an LLM. Bridge: render plane / transport+structure plane / agent plane. Allowlist > denylist on commands. |
| A7 | `research-agent-environment-access-mcp.md` | **MCP** (spec 2025-11-25 stable, ~9,400 servers but quality-gated) + **sandboxes** (Daytona ~27–90ms cold start, E2B price-matched, Modal for GPU) + Claude Code's **`auto` mode classifier** (strips broad allows on entry, blocks `curl|bash`) is the current ceiling. Two documented sandbox bypasses early 2026 — multi-ring security is non-negotiable. |
| A8 | `research-agent-inbox-communication.md` | The repo's existing `.handoffs/` is a **degenerate blackboard with total ordering** — extend with `.inboxes/<agent>/{pending,in-progress,done}/` for parallel multi-recipient work. Use filesystem `mv` for atomic state transitions. A2A's 8-state task lifecycle is the canonical reference. Top failure modes: missing termination, telephone-game, orphaned messages without acks. |
| A9 | `research-embedded-agents-in-codebases.md` | **`AGENTS.md`** is now the cross-tool surface (Linux Foundation, Dec 2025) — Claude imports it via `@AGENTS.md` in `CLAUDE.md`. Split by failure mode: **hooks** for *guarantee*, **skills** for *competence*, **rules** for *context*. Fence INVARIANTS blocks and route discovered learnings to auto-memory (not curated rules) to manage drift. LLM-generated rules degrade success in 5/8 settings — keep them human-curated. |
| A10 | `research-self-sustaining-agent-loops.md` | Claude Code `/loop` + `CronCreate` (7-day expiry, 50-task cap) is the available substrate. Survivability comes from a **12-item halt checklist** + **drift defense via re-reading `CURRENT_PLAN.md` each iteration** + **independent verifier** (your existing QualityGate skill). Never let a loop self-modify its own halt conditions. Distinguish "shipped" from "demoed" when sourcing claims. |

---

## 2. Cross-Report Convergences

Patterns that emerged independently in multiple reports — **these are the load-bearing decisions**.

1. **Layered elevation is universal.** A2 (4-layer OKLCH stack), A4 (carved-vs-floating), A5 (Linear's 6-step grayscale ladder). One flat near-black is the tell of an amateur dark UI.
2. **Specular highlight is the cheapest premium signal.** A3 (specular + edge highlight), A4 (`inset 0 1px 0 rgba(255,255,255,0.06)`), A5 (Linear/Vercel both use it). A single line of CSS that separates "carved-in" from "pasted-on."
3. **AAA contrast on dark backgrounds, not AA.** A1 (trust target), A2 (APCA Lc 60–75 Silver). The legal AA floor reads as cheap on dark.
4. **Structure over stream.** A6 (Warp blocks, VS Code OSC 633) and A8 (typed inbox messages with status lifecycle) both move from free-form text to schema'd structure to make outputs legible to agents. Same principle, different layers.
5. **Allowlist > denylist + multi-ring security.** A6 (terminal command policy), A7 (sandbox + permission classifier + egress proxy). Two documented Claude bypasses in 2026 confirms this is structural, not theoretical.
6. **Independent verification at every step.** A9 (visual-qa subagent), A10 (QualityGate as halt-condition gatekeeper). Self-grading is the AutoGPT trap.
7. **Human-curated rules, machine-discovered learnings.** A9 finding that LLM-generated context files *reduce* success in 5/8 settings — keep `CLAUDE.md` / `AGENTS.md` hand-edited; route the rest to auto-memory or the inbox.

---

## 3. Recommended Implementation Order

Sequenced because earlier decisions constrain later ones.

**Phase 0 — Foundations (1–2 days)**
1. Lock the **OKLCH palette** from A2 (4-layer base + text tokens + indigo accent + semantics, hue 260°).
2. Lock the **type stack** decision: ship the platform on **a licensed display face** (per A5: Inter alone is the floor, not the ceiling — borrow Anthropic's editorial discipline even in a technical UI).
3. Lock the **radius scale** (A4: prefer shadcn's `calc()`-derived scale from one `--radius` token, default 0.625rem; document the nested-radius rule in the design system file).

**Phase 1 — Chrome (3–5 days)**
4. Build the **card primitive** with hairline border + glass edge inset shadow (A4) on top of the 4-layer elevation (A2).
5. Build the **universal glass tier** first (A3 tier 1–2: `backdrop-filter` + dual inset shadows + `@supports` + `prefers-reduced-transparency`). Defer the SVG/Chromium-only tier until the look is right.
6. Pick **one signature interactive element** (A5 cross-pattern): make it *be* the product UI, not an abstract render.

**Phase 2 — Trust Polish (2–3 days)**
7. Apply A1's microcopy and motion rules across hero/CTA: ambient 3–6s ease-in-out, interactive 150–200ms, AAA contrast on every primary surface.
8. Audit density: one screen, one decision. Cut by 30%.

**Phase 3 — Agent Infrastructure (parallel with Phase 1–2)**
9. Stand up the **MCP server set** from A7 (filesystem + playwright + github + context7 + custom inbox/plan) inside a Daytona or Docker sandbox.
10. Wire the **embedded terminal** from A6 (xterm.js + node-pty bridge with structured blocks + allowlist).
11. Adopt the `.inboxes/<agent>/{pending,in-progress,done}/` extension from A8 alongside the existing `.handoffs/` numbered chain.

**Phase 4 — Embedding & Autonomy (after Phase 3 is solid)**
12. Author `AGENTS.md` per A9; import via `@AGENTS.md` in `CLAUDE.md`; fence the INVARIANTS block; add a `PreToolUse` invariant-guard hook.
13. Build the `visual-qa` subagent (A9) — Playwright + screenshot diff — as the deterministic gate for design-system regressions.
14. Only then enable **`/loop` + `CronCreate`** with A10's 12-item halt checklist and QualityGate as independent verifier. Never sooner.

---

## 4. Top Decisions the User Must Make

The reports converge on these as the high-leverage choices — none are obvious from the code, all are yours:

1. **Display face for the platform.** Stay on Inter (free, ubiquitous, "AI default") or invest in a licensed/custom face? A5 strongly recommends the latter; A1 says it carries massive editorial signal.
2. **Glass tier ambition.** Ship universal `backdrop-filter` only (works everywhere, looks 2020-glass) or commit to the SVG-displacement Chromium-best path with a graceful Safari fallback (A3)? Affects engineering budget by ~3–5 days.
3. **Sandbox vendor.** Daytona (fastest cold start) vs E2B (largest ecosystem) vs Docker Sandboxes (in-cluster, no third party) — A7 lays out the tradeoffs.
4. **Loop scope.** Will autonomous loops actually run unattended for hours (cron + Routines) or is the goal interactive babysit-style (foreground `/loop`)? A10's halt checklist differs in strictness.

---

## 5. Notable Risks Flagged Across Reports

- **Inter ubiquity problem** (A1, A5) — using only Inter is the AI-default tell.
- **`backdrop-filter` + SVG filter is Chromium-only** (A3) — silent failure in Safari/Firefox unless you build the fallback.
- **`border-image` + `border-radius` does not compose** (A4) — the two-layer `background-clip` trick is mandatory for rounded gradient borders.
- **Two documented Claude sandbox bypasses in 2026** (A7) — perimeter ≠ security.
- **LLM-generated rule files reduce success in 5/8 settings + 20–23% inference cost** (A9) — keep `AGENTS.md` / `CLAUDE.md` human-curated.
- **Self-grading is the AutoGPT failure mode** (A10) — never let the same agent verify its own halt.
- **`backdrop-filter` GPU cost** (A3) — budget the effect for hero/CTAs only, not every card.
- **Routines preview cap: 15 runs/day** (A10) — affects how aggressively you can schedule.

---

## 6. Sibling Cross-Reference Map

How the reports depend on each other (built from each agent's stated cross-refs):

```
A1 (trust)     ──── informs ───→ A5 (which trust patterns to lift)
A2 (palette)   ──── feeds ─────→ A3 (translucent fill), A4 (border colors), A5 (palette comparison)
A3 (glass)     ──── requires ──→ A4 (edge highlight), A2 (light bleed)
A4 (chrome)    ──── pairs with ─→ A2 (which whites/opacities work)
A5 (sites)     ──── validates ──→ A1, A2, A3, A4 (real-world examples)

A6 (terminal)  ──── slice of ───→ A7 (one of many env-access surfaces)
A7 (env)       ──── consumes ───→ A8 (uses inbox as one tool)
A8 (inbox)     ──── timed by ───→ A10 (when messages send)
A9 (embedding) ──── static side of A10 (which is the temporal side)
A10 (loops)    ──── verifies via QualityGate (project skill, not in this research)
```

---

## 7. Pointers Back to the Project

- `CURRENT_PLAN.md` (project root) — next-step status for normal work
- `.handoffs/hand-off-XXX.md` — heavyweight orchestration chain
- `.claude/skills/` — existing skill library the loop should respect (QualityGate, UltraThinker, UltraBuilder, handoff-protocol)
- This file lives in `C:\Users\Oskari\Documents\EZvibes\inbox\` per the global markdown-routing rule

All ten reports + this index are in the same directory, ready to read end-to-end.
