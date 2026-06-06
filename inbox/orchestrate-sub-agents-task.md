Apply the briefing-subagents skill, then dispatch 2 fresh sub-agents in parallel to research the SUBJECT   
  below. Each agent prompt MUST contain the four elements + escape hatch:

  1. Objective — one-paragraph task + parent goal (deepen my understanding of SUBJECT)
  2. Scope boundaries — name what the sibling agent owns; forbid overlap
  3. Output format — Markdown with 3 fixed sections, hard 350-word cap
  4. Tool/effort budget — WebSearch + WebFetch only, max 6 tool calls, stop when hit
  + Escape hatch — return {status:"needs_clarification", question:"..."} rather than guessing or padding

  Slice the work into two non-overlapping angles (you pick the split). Dispatch both in ONE message so they
  run in parallel. When both return, present a consolidated synthesis under 400 words: top patterns, top
  anti-patterns/gotchas, one well-attributed quote, source list.

  SUBJECT: