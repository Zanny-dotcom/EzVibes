# MD output routing rule (mirror of global CLAUDE.md)

This file is a copy of the rule that lives in the global Claude Code instructions at `C:\Users\Oskari\.claude\CLAUDE.md`. It is mirrored here per its own directive ("every .md file goes in the inbox").

## The rule

Every Markdown (`.md`) file Claude produces — plans, hand-offs, summaries, notes, audits, CLAUDE.md derivatives, anything — **must** be written to:

```
C:\Users\Oskari\Documents\EZvibes\inbox
```

Filenames must be **descriptive kebab-case**, never generic single-word names.

- Good: `summary-for-ezvibes.md`, `audit-project-rules.md`, `orchestrate-sub-agents-task.md`
- Bad: `summary.md`, `plan.md`, `notes.md`

Applies across all projects and sessions on this PC.

**Source of truth:** `C:\Users\Oskari\Documents\ezvibes\activate\Ezvibes.md`
**Enforcement layer:** `C:\Users\Oskari\.claude\CLAUDE.md` (loaded into every Claude Code session on this machine)

## Only exception

Files that *must* live at a fixed path for the tooling to read them — the global CLAUDE.md itself, a project-root CLAUDE.md when `/init` writes it there, config files like `settings.json`. When such an exception applies, a kebab-named copy is also dropped here so this inbox stays a complete record.
