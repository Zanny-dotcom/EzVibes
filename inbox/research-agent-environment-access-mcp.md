# Research: Sophisticated, Safe Environment Access for AI Agents (MCP, Sandboxes, Permissions)

> Slice A-? of a 10-way parallel research effort. Sibling slices own the embedded terminal (A6), agent inbox (A8), agent code/.md modification (A9), and self-sustaining loops (A10). This slice covers **everything else** an agent needs to "really touch" a project safely.

---

## 1. How to Look at This Correctly (Meta)

When you evaluate an agent's "access surface," do not ask "does it have tools?" Ask through these lenses:

**Lens 1 — Granularity vs. token cost.** A single mega-tool (`run_anything`) is easy to expose but disastrous for the agent: it has to relearn argument shape every call and you cannot audit intent. The opposite extreme — one tool per API endpoint — burns context just listing tools. Anthropic's own guidance is "build a few thoughtful tools targeting specific high-impact workflows," consolidating operations like `schedule_event` instead of `list_users`+`list_events`+`create_event`. The new Tool Search Tool and Programmatic Tool Calling features extend this: surface tools on-demand, let the agent orchestrate them in code rather than per-turn round-trips.

**Lens 2 — Safety boundary (where does the blast radius end?).** Five concentric rings: (a) protocol-level consent (MCP requires explicit user approval per tool invocation, in theory); (b) permission rules in the host (Claude Code's allow/deny lists); (c) classifier review (Claude's auto-mode classifier reads each pending action); (d) OS/container sandbox (chroot, Docker, Firecracker microVM); (e) network egress proxy with allowlist. Real systems stack at least three of these. A single ring is not a sandbox — "containers aren't a sandbox for AI agents" is a recurring 2026 refrain.

**Lens 3 — Statefulness and reversibility.** Does the environment persist between calls? E2B and Daytona keep filesystem and process state across tool calls (so agents can `cd`, write, then `pytest`); WebContainers run state in a single browser tab. Reversibility matters more than persistence: an agent should prefer staging directories, branches, or temp clones over irreversible operations. Claude Code's "reversibility-weighted risk assessment" makes this explicit — destructive actions need stronger gates than additive ones.

**Lens 4 — Discoverability and composability.** Can the agent learn what's available without re-prompting? MCP's `tools/list`, `resources/list`, `prompts/list`, plus the 2025-11-25 spec's cacheable `ttlMs` on these listings, make discovery first-class. Tools compose if they accept and return canonical identifiers — `user_id` not `user`, structured JSON not free text. Anthropic explicitly calls out namespacing (`asana_projects_search`, `asana_users_search`) as a composability lever.

**Lens 5 — Auditability.** Every action should leave a trace the human (or a fresh review agent) can replay. MCP's 2026-07-28 release candidate bakes in W3C Trace Context (`traceparent`, `tracestate`) so distributed traces correlate across SDKs and gateways. Claude Code's `/permissions` view tracks recently denied actions, and Pluto Security's Managed Agents teardown shows Claude's egress proxy logs every CONNECT with a session-scoped JWT for forensic replay.

If any lens scores zero, the agent is not "sophisticated" — it is exposed.

---

## 2. Current State of the Art

### 2.1 Model Context Protocol (MCP)

**Spec version cited: 2025-11-25 (current stable) + 2026-07-28 release candidate.** MCP is now the de-facto LSP-equivalent for AI tools. Architecture: Hosts (LLM apps) connect via Clients to Servers (services exposing capabilities) over JSON-RPC 2.0. Servers offer **Tools** (functions to execute), **Resources** (context/data), and **Prompts** (templates). Clients can offer **Sampling** (server-initiated LLM calls), **Roots** (filesystem/URI boundaries), and **Elicitation** (asking the user for input mid-flow).

The 2026 release candidate is a major shift: the protocol becomes **stateless at the transport layer**. New `Mcp-Method` and `Mcp-Name` headers let load balancers and gateways route without inspecting bodies. List/resource responses carry `ttlMs` + `cacheScope` modeled on HTTP Cache-Control. This unlocks horizontally-scaled remote MCP servers behind plain round-robin LBs.

**Ecosystem size:** PulseMCP tracks ~15,930 servers, Smithery ~7,300, the official registry ~2,000 (preview launched Sept 2025, crossed 800 in April 2026, ~9,400 distinct servers across the four canonical registries by mid-April 2026). Quality is uneven: the official Anthropic reference repo ships only 7 actively-maintained servers (filesystem, fetch, sequentialthinking, etc.); 14 more are archived. Vendor-official servers (GitHub, Stripe, Postgres, Sentry) are now the trusted core.

**MCP security surface — non-trivial.** The protocol explicitly cannot enforce consent; it delegates to the host. Two documented Anthropic sandbox bypasses (Penligent + Aonan Guan, early 2026) showed that even Claude's egress allowlist could be defeated via DNS rebinding and malformed-host headers. Hardening checklist: exact-host allowlists (no wildcards), IP-level deny rules, canonicalization of all URLs, regression tests against bypass attempts.

### 2.2 Sandboxes for Agents (2026 landscape)

| Provider | Isolation | Cold Start | Price/vCPU-hr | Session | GPU | Notes |
|---|---|---|---|---|---|---|
| **E2B** | Firecracker microVM | ~150ms | $0.0504 | unlimited | no | Largest template catalog; Hobby tier $100 one-time, 20 concurrent |
| **Daytona** | Docker container | ~27-90ms | $0.0504 (~$0.067 small) | unlimited | yes | Fastest cold start; $200 free credit |
| **Modal** | gVisor/Firecracker | sub-second | ~$0.142 | unlimited | yes (extensive) | Sandboxes are one product in a serverless GPU platform |
| **Vercel Sandbox** | microVM | fast | $0.128 | 5 hr (Pro) | no | Tight Next.js integration |
| **Cloudflare** | V8 isolates / containers | 2-3s | $0.072 | configurable | no | Edge-distributed |
| **Blaxel** | microVM | ~25ms | varies | unlimited | no | Newest, fastest cold start in marketing |
| **Beam** | Firecracker | varies | $0.190 | 24h+ | yes | GPU-focused |
| **Docker Sandboxes (sbx)** | microVM, local | local | free (your hw) | local | local | Purpose-built for Claude Code, Codex, Gemini CLI; isolated Docker daemon per sandbox |
| **WebContainers (StackBlitz)** | WASM in browser | instant | free (public) | browser tab | no | Node.js on WASM; no remote infra; ideal for in-page demos |
| **Dev Containers** | Docker + VS Code spec | ~seconds | local | local | local | The `.devcontainer` standard; Claude Code ships official config |

**Pick rules:** Daytona for cold-start sensitivity; E2B for Python-iterative workloads needing Firecracker isolation; Modal if GPU is involved; WebContainers if the sandbox must live entirely in the browser; Docker sbx + Dev Containers if you want local, no-vendor lock-in.

### 2.3 Permission and Approval Patterns

**Claude Code modes (v2.1.83+):**

| Mode | Auto-allowed | Best for |
|---|---|---|
| `default` | Reads only | Sensitive work |
| `acceptEdits` | Reads + file edits + `mkdir/touch/mv/cp/sed` in CWD | Iterating with `git diff` review |
| `plan` | Reads only, no writes at all | Exploration |
| `auto` | Everything, but classifier reviews each action | Long tasks (Opus 4.6/4.7, Sonnet 4.6 only) |
| `dontAsk` | Only pre-approved allow rules; everything else denied | Locked-down CI |
| `bypassPermissions` | Everything, no checks | Isolated containers/VMs only |

The **auto mode classifier** is the most interesting innovation: a separate model reviews each pending action against trusted-infrastructure config + user-stated boundaries (e.g. "don't push"), blocking `curl|bash`, exfiltration to external endpoints, production deploys, mass deletion, IAM grants, force-push to main. Protected paths (`.git`, `.vscode`, `.claude`, `.mcp.json`, shell rcfiles) never auto-approve in any mode except `bypassPermissions`. Sub-agents inherit classifier review; their `permissionMode` frontmatter is ignored in auto mode.

**Cursor's "auto-approve"** and **OpenHands' "confirmation mode"** sit between Claude's `default` and `auto` — Cursor toggles per-tool auto-approval globally; OpenHands surfaces each shell command for approval unless explicitly trusted. None has Claude's classifier yet.

### 2.4 Filesystem Access Patterns

The reference **MCP filesystem server** demonstrates the canonical pattern: directories specified as CLI args OR dynamically via the **Roots** protocol (`roots/list_changed` from client to server fully replaces the allowed set at runtime). Read-only mounts are flagged with `ro`. The Rust implementation defaults to read-only and refuses Roots updates unless explicitly enabled. Path validation rejects anything outside roots — symlink traversal, `..` escapes, etc. This is the model to copy: explicit roots, read-only by default, dynamic boundary updates over MCP, no host-OS chroot needed because the protocol enforces it.

### 2.5 Network Access Patterns

**Egress proxy with JWT-authenticated allowlist** is the 2026 standard, popularized by Claude Managed Agents:

1. All outbound traffic routes through a forward proxy with TLS inspection.
2. JWT contains org metadata, session ID, full allowed-host list.
3. Three independent layers prevent bypass: proxy enforcement, no direct DNS in the container, network-level firewall blocks all direct outbound TCP.
4. Proxy checks CONNECT method against exact-host allowlist before TLS handshake.
5. AWS Bedrock's domain-control feature does the equivalent for Bedrock agents.

The two documented Claude sandbox bypasses both hit the allowlist layer specifically (DNS rebinding, malformed Host header) — proving Lens 2's "multiple rings" requirement is not theoretical.

### 2.6 Browser Access for Agents

**Playwright MCP (Microsoft, 2025) is now standard.** Key insight: send the **accessibility tree** to the model, not screenshots or raw HTML. Token efficiency is ~4x better than CLI Playwright (~27k vs ~114k tokens for a typical task). Five competing servers exist by 2026 (each disagrees with Microsoft on one trade-off) but the protocol has consolidated. Alternatives include **browser-use** (vision + DOM hybrid), **Skyvern** (visual-first), and the **AIO Sandbox** all-in-one (browser + shell + VSCode in one Docker container).

---

## 3. Implementation Guidance — Recommended Stack

For the Retteli orchestration platform (depth-1 orchestrator with parallel skill-based agents on Windows), the access stack should be:

**Layer 1 — Local sandbox: Dev Containers + Docker Sandboxes (`sbx`).** The user is on Windows; WSL2 + Docker Desktop + the Docker Sandboxes CLI gives Claude Code, Codex, and any future CLI agent identical isolation. Each agent gets its own Docker daemon, filesystem, and network namespace. Zero vendor lock-in, free, runs on the user's hardware.

**Layer 2 — Permission model: `acceptEdits` as default, `auto` for long unattended runs.** Configure `~/.claude/settings.json` with `defaultMode: "acceptEdits"` and project-level `.claude/settings.json` with explicit allow rules for `Bash(npm test)`, `Bash(git status)`, `Bash(git diff)`, etc. Keep `bypassPermissions` reserved for inside the sandbox only. When auto mode is enabled, the classifier handles network and shell escalation automatically.

**Layer 3 — MCP servers (essentials only — resist the urge to bolt on 50):**
- `@modelcontextprotocol/server-filesystem` — scoped to project root, read-only mount for sibling projects.
- `playwright-mcp` (Microsoft) — for any QA, scraping, or web-touching skill.
- `github` MCP — for PR review, issue triage, branch operations.
- `context7` (already installed) — library docs.
- A **custom inbox MCP** owned by sibling slice A8 — agent-to-agent messaging.
- A **custom plan MCP** that reads/writes `CURRENT_PLAN.md` with structured operations instead of free-text edits (sibling A9).

**Layer 4 — Network egress.** For local Docker Sandboxes, use Docker's built-in `--network` flag with a custom bridge + iptables allowlist. For any cloud sandbox (E2B if you adopt one), use the provider's egress controls. Block direct outbound TCP, require an HTTP proxy with exact-host allowlist (registry.npmjs.org, github.com, api.anthropic.com, registry.modelcontextprotocol.io, plus per-project additions).

**Layer 5 — Audit.** Every MCP call should pass through a logging gateway (Mintlify's MintMCP, Truefoundry, or a custom hook on Claude Code's `PreToolUse`). The existing handoff-chain convention (`.handoffs/hand-off-XXX.md`) already gives plan-level audit; tool-level audit closes the loop.

**Order of adoption:** Layers 2 and 3 first (already partly in place), Layer 1 (Docker Sandboxes) next, Layers 4-5 last when multi-agent autonomy increases.

---

## 4. Cross-References to Sibling Research

- **A6 (terminal):** Sandboxes from Section 2.2 host the embedded terminal. The choice of sandbox dictates terminal capabilities (PTY, history, env vars).
- **A8 (agent inbox):** Mentioned as a custom MCP server in Section 3, Layer 3. The inbox is the right shape for a stateful MCP server with resources (messages) and tools (send/ack).
- **A9 (code/.md/rules modification):** The protected-paths rule (Section 2.3) explicitly covers `.claude/`, `.mcp.json`, and `CURRENT_PLAN.md` edits. A9 must define the gate for these.
- **A10 (self-sustaining loops):** Auto mode + Docker Sandboxes + egress allowlist (Sections 2.3-2.5) are the prerequisites for any safe autonomy. Without all three, loops are unsafe.

---

## 5. Sources

- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP 2026-07-28 Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
- [2026 MCP Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [MCP Filesystem Server (reference)](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md)
- [MCP Ecosystem Tracker 2026](https://www.digitalapplied.com/blog/mcp-server-ecosystem-tracker-50-servers-cataloged-2026)
- [Claude Code Permission Modes](https://code.claude.com/docs/en/permission-modes)
- [Anthropic: Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Anthropic: Claude Code Auto Mode](https://www.anthropic.com/engineering/claude-code-auto-mode)
- [Anthropic: Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- [AI Code Sandbox Benchmark 2026 (Superagent)](https://www.superagent.sh/blog/ai-code-sandbox-benchmark-2026)
- [Daytona vs E2B vs Modal vs Vercel (StartupHub)](https://www.startuphub.ai/ai-news/artificial-intelligence/2026/daytona-vs-e2b-vs-modal-vs-vercel-sandbox-2026)
- [Northflank: AI Sandbox Pricing 2026](https://northflank.com/blog/ai-sandbox-pricing)
- [Docker Sandboxes Docs](https://docs.docker.com/ai/sandboxes/)
- [StackBlitz WebContainers Core](https://github.com/stackblitz/webcontainer-core)
- [Containers Aren't a Sandbox for AI Agents](https://dev.to/siddhantkcode/containers-arent-a-sandbox-for-ai-agents-215o)
- [AIO Sandbox (all-in-one Docker)](https://github.com/agent-infra/sandbox)
- [Pluto Security: Inside Claude Managed Agents](https://pluto.security/blog/inside-claude-managed-agents/)
- [Claude Code Sandbox Bypass (Penligent)](https://www.penligent.ai/hackinglabs/claude-code-sandbox-bypass/)
- [Second Claude Sandbox Bypass (Aonan Guan)](https://oddguan.com/blog/second-time-same-sandbox-anthropic-claude-code-network-allowlist-bypass-data-exfiltration/)
- [AWS: Control AI Agent Domains](https://aws.amazon.com/blogs/machine-learning/control-which-domains-your-ai-agents-can-access/)
- [NVIDIA: Sandboxing Agentic Workflows](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/)
- [INNOQ: Sandboxed Coding Agents Network Control](https://www.innoq.com/en/blog/2026/03/dev-sandbox-network/)
- [Playwright MCP (Microsoft)](https://playwright.dev/docs/getting-started-mcp)
- [6 Popular Playwright MCP Servers 2026](https://bug0.com/blog/playwright-mcp-servers-ai-testing)
- [Securely Deploying AI Agents (Anthropic)](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)
