# oskariozan.com + rag-chatbot — Full Architecture & Deploy Guide

A complete walk-through of how your website and chatbot actually work today, what lives where, who deploys what, and how to change anything without breaking it. Written 2026-05-28.

---

## 1. The 30-second summary

You have **two separate projects**, each its own GitHub repo:

| Project | Local folder | GitHub repo | Hosted on | Public URL |
|---|---|---|---|---|
| Frontend (static site) | `oskariozan-website/zbikes/` | `Zanny-dotcom/oskariozan.github.io` | **GitHub Pages** | https://www.oskariozan.com |
| Backend (RAG API) | `oskariozan-website/rag-chatbot/` | `Zanny-dotcom/rag-chatbot` | **Hetzner Cloud VPS** (Helsinki, 62.238.9.202) | https://api.oskariozan.com |

The website is pure static HTML/CSS/JS. The chat widget on the bottom-right makes one `POST https://api.oskariozan.com/chat` call per user message. The backend retrieves relevant chunks from your personal markdown notes, sends them + the question to Groq's `llama-3.3-70b-versatile`, and returns a 2-sentence answer with source filenames.

**The cost**: ~€5/month for the Hetzner box (matches their CPX11 / CX22 tier). Groq inference is currently free-tier. GitHub Pages is free. Porkbun is the domain registrar — also small, paid once a year.

---

## 2. Request flow (the big picture)

```
                                                                                    ┌──────────────────┐
                                                                                    │  Groq API        │
                                                                                    │  (LLM inference) │
                                                                                    │  llama-3.3-70b   │
                                                                                    └────────▲─────────┘
                                                                                             │
                                                                                             │ HTTPS
                                                                                             │
   ┌──────────┐   GET /          ┌─────────────────┐                                   ┌─────┴────────────────────────┐
   │ Browser  │ ───────────────▶ │  GitHub Pages   │                                   │  Hetzner VPS                 │
   │          │                  │  (your static   │                                   │  62.238.9.202 (Helsinki)     │
   │          │ ◀─── HTML/JS ─── │  oskariozan.    │                                   │                              │
   │          │                  │  github.io)     │                                   │  ┌────────────────────────┐  │
   │          │                  └─────────────────┘                                   │  │  Caddy (port 443)      │  │
   │          │                                                                        │  │  - TLS termination     │  │
   │          │   POST /chat                                                           │  │  - HTTP/2, HTTP/3      │  │
   │          │   {"message":"…"} ─────────────────── HTTPS ─────────────────────────▶ │  │  - Reverse proxy →     │  │
   │          │                                                                        │  │    127.0.0.1:8000      │  │
   │          │   ◀──── {"answer":"…", "sources":["…"]} ─────────────────────────────  │  └────────────┬───────────┘  │
   └──────────┘                                                                        │               │              │
                                                                                       │  ┌────────────▼───────────┐  │
                                                                                       │  │  uvicorn :8000         │  │
                                                                                       │  │  (systemd:             │  │
                                                                                       │  │   rag-chatbot.service) │  │
                                                                                       │  │  └─ FastAPI app        │  │
                                                                                       │  │     └─ chat() →        │  │
                                                                                       │  │        retrieve top-5  │  │
                                                                                       │  │        from ChromaDB,  │  │
                                                                                       │  │        gate distance,  │  │
                                                                                       │  │        call Groq       │  │
                                                                                       │  └────────────┬───────────┘  │
                                                                                       │               │              │
                                                                                       │  ┌────────────▼───────────┐  │
                                                                                       │  │  ChromaDB (on-disk)    │  │
                                                                                       │  │  ~/rag-chatbot/        │  │
                                                                                       │  │      chroma_db/        │  │
                                                                                       │  │  + bge-small-en-v1.5   │  │
                                                                                       │  │    embedding model     │  │
                                                                                       │  └────────────────────────┘  │
                                                                                       └──────────────────────────────┘
```

DNS path: `api.oskariozan.com` → A record at Porkbun → `62.238.9.202` (Hetzner). Caddy on that box sees the SNI hostname, presents a Let's Encrypt cert it auto-renews, and proxies the request to uvicorn on localhost.

---

## 3. The two repos, side by side

### Frontend: `Zanny-dotcom/oskariozan.github.io`

- Repo name ends in `.github.io` — that's the GitHub Pages convention. Push to `main`, the site goes live within ~30 seconds. No build step.
- The repo contains a `CNAME` file with `www.oskariozan.com`. GitHub Pages reads that and serves your content on the custom domain instead of the default `zanny-dotcom.github.io`.
- DNS is configured at Porkbun: an `A` record on `www` (or apex) pointing to GitHub Pages' IPs (185.199.108.153 / .109.153 / .110.153 / .111.153).
- Files in the repo are served as-is. There's no React, no bundler, no Tailwind. Just `index.html`, `bicycles.html`, `styles.css`, `script.js`, `chat.js`, `images/`.

### Backend: `Zanny-dotcom/rag-chatbot`

- Pure Python. No build, no Docker.
- On the Hetzner box, the code lives in (most likely) `~/rag-chatbot/` — a clone of the GitHub repo. To deploy: SSH in, `git pull`, `sudo systemctl restart rag-chatbot`.
- The ChromaDB vector store (`chroma_db/`) and the `.env` file with `GROQ_API_KEY` are gitignored. Both live on the box but never in the repo. The vector store is rebuilt by running `python -m src.ingest` against the `notes/` folder.

**Important**: these two repos are completely independent. Pushing to one does not touch the other.

---

## 4. The frontend in detail (zbikes/)

### Files

| File | Role |
|---|---|
| `index.html` | Landing page — hero, projects grid, knowledge grid, newsletter form, footer. Loads `script.js` (general site interactions) and `chat.js` (the widget) at the bottom of `<body>`. |
| `bicycles.html` | Secondary "experiments" page — repurposed Z-Bikes redesign. Linked from the footer. |
| `styles.css` | All styling. Black + cream + gold palette, Playfair Display + Inter fonts. |
| `script.js` | Site-wide JS — preloader, mobile menu toggle, scroll reveals, etc. (Not related to the chat.) |
| `chat.js` | The floating chat widget. **Hardcodes `BACKEND_URL = 'https://api.oskariozan.com'` at the top.** If you ever rename the backend, change it here. |
| `CNAME` | Single line `www.oskariozan.com`. GitHub Pages reads this. Don't delete. |
| `sitemap.xml`, `robots.txt` | SEO basics. |
| `images/` | All assets. Includes the RAG bot mascot used on the landing page card. |
| `git-terminology.md` | Personal cheat-sheet — gitignored, local-only. |
| `CLAUDE.MD` | Agent instructions. Has a stale claim ("Porkbun-hosted") — actually GitHub Pages. |

### The chat widget (chat.js)

What it does, line by line:
1. Injects a fixed-position button + collapsed panel into the DOM.
2. On click, opens the panel and focuses the input.
3. On form submit:
   - Optimistically appends the user message to the local `messages` array.
   - Sets `isLoading = true`, re-renders (shows the three-dot loading bubble).
   - `fetch('https://api.oskariozan.com/chat', { method:'POST', body: JSON.stringify({message: text}) })`.
   - On success: appends `{ role:'assistant', text: data.answer, sources: data.sources }`.
   - On failure: shows "Sorry, I couldn't reach the server…" — does not surface the error code to the user.
4. Renders sources as small tag chips below the assistant message.

There is no localStorage, no history across reloads, no user identity, no auth. Refresh the page and the conversation is gone.

### Deploy

```bash
cd zbikes
git add .
git commit -m "describe the change"
git push origin main
```

That's it. GitHub Pages picks up the push and republishes within ~30 seconds. You can watch the deploy at https://github.com/Zanny-dotcom/oskariozan.github.io/actions (Pages uses a built-in workflow).

---

## 5. The backend in detail (rag-chatbot/)

### Files

```
rag-chatbot/
├── src/
│   ├── ingest.py      # one-time: read notes/, chunk, embed, write to ChromaDB
│   ├── query.py       # given a question, return top-k chunks
│   ├── chat.py        # query.py + Groq call → final {answer, sources}
│   └── server.py      # FastAPI wrapper exposing POST /chat and GET /health
├── notes/             # source markdown files (gitignored — private)
├── chroma_db/         # persisted vector store (gitignored)
├── .env               # GROQ_API_KEY (gitignored)
├── .gitignore
├── requirements.txt   # python deps
├── CLAUDE.MD          # agent instructions (note: still says "will eventually deploy to VPS" — stale)
├── message.md         # a stash of SSH debug commands you've used
├── start.bat / ingest.bat / start-cloudflare.bat   # Windows helpers (gitignored, STALE paths — see §9)
```

### The RAG pipeline (read this once; it's the whole thing)

**ingest.py** — runs against the Hetzner box's `notes/` folder. You only need to re-run this when you change the notes.

1. `read_notes()` — glob `notes/*.md`, read each one.
2. `chunk_markdown()` — split on `#`/`##`/`###` headings. Each chunk carries its heading hierarchy prepended as context (so the embedding "knows" what section the text is from). If a section exceeds `CHUNK_THRESHOLD = 1500` chars, `sub_split()` further splits on paragraph breaks.
3. `embed_and_store()`:
   - Loads `sentence-transformers/BAAI/bge-small-en-v1.5` (384-dim, ~33MB) on CUDA if available, else CPU. On the Hetzner box it's CPU.
   - Calls `model.encode(texts, normalize_embeddings=True)` — L2-normalizes the vectors so cosine distance behaves nicely.
   - Connects to a `chromadb.PersistentClient(path=chroma_db/)`.
   - **Drops and recreates the collection** named `notes` (clean slate every run).
   - Creates it with `{"hnsw:space": "cosine"}` — HNSW index, cosine distance.
   - Writes chunks with metadata `{source_file, heading, chunk_index}` and stable IDs `chunk_N`.

**query.py** — module-level loads (one-time cost on uvicorn startup):
- The sentence-transformer (same model as ingest — must match or distances are meaningless).
- The ChromaDB client + the `notes` collection.

`query(question, top_k=5)`:
- Embed the question with the same `normalize_embeddings=True`.
- `collection.query(query_embeddings=[…], n_results=5, include=['documents','metadatas','distances'])`.
- Return list of dicts `{text, source_file, heading, chunk_index, distance}`.

**chat.py** — the RAG orchestration.

```python
DISTANCE_GATE = 0.50
MODEL = "llama-3.3-70b-versatile"
GROQ_TIMEOUT_SECONDS = 15.0
```

`chat(question)`:
1. Retrieve top-5.
2. **Distance gate**: if `results[0]["distance"] > 0.50`, return `"I don't have information on that topic in my notes."` immediately — **no Groq call**. This is what blocks off-topic questions ("what's the capital of Finland?") without burning tokens or risking hallucination.
3. Build the user message as `Context:\n---\n[1] (source: amygdala.md)\n<chunk text>\n\n[2] (source: …)\n…\n---\nQuestion: <question>`.
4. Call Groq with `temperature=0`, the system prompt below, and a 15-second timeout.
5. Dedupe source filenames (preserving order), return `{answer, sources}`.

The system prompt currently in production:
> "You are a concise research assistant. Answer questions based ONLY on the provided context. Maximum 2 short sentences in plain language. No jargon, no study names, no technical terms. Explain it like you're texting a friend. If the context doesn't contain enough information to answer, say so. Do not make up information."

If you want the bot to behave differently (longer answers, cite study names, allow lists) — change `SYSTEM_PROMPT` in `chat.py` and redeploy.

**server.py** — FastAPI wiring.

- `POST /chat` body `{message: str}` (Pydantic-validated, 1-1000 chars), returns `{answer, sources}`. Rate-limited via **slowapi** to **10 requests/minute per remote IP**. Any unhandled exception is caught and converted to a generic `503 "Chat service is temporarily unavailable. Please try again in a moment."` — the real exception goes to the log but is never leaked to the caller.
- `GET /health` returns `{"status":"ok"}`. Used by you (via `curl`) to check it's alive, and could be used by any monitor.
- CORS allow-list:
  - `https://oskariozan.com`
  - `https://www.oskariozan.com`
  - `https://instrumental-resolution-recognize-binary.trycloudflare.com` ← **stale**, from the old Cloudflare-tunnel days. Safe to delete.
  - `http://localhost:3000`, `5173`, `8080` — dev origins.
- Logging is set up at module load (`INFO`, timestamped). A `lifespan` context logs `server starting up` / `server shutting down` on uvicorn boot/quit.

### Dependencies (requirements.txt)

```
sentence-transformers     # for the embedding model (bge-small)
chromadb                  # vector store
groq                      # Groq API client
fastapi                   # web framework
uvicorn[standard]         # ASGI server
python-dotenv             # loads .env in local dev (note: server.py does NOT actually import it — env vars come from systemd in prod, OS shell in dev)
slowapi                   # rate limiting
```

`torch` shows up indirectly because `sentence-transformers` pulls it in. On the Hetzner box it'll be the CPU build — fine, the model is small.

### Local dev artifacts you have on this PC

- `chroma_db/` has two collection UUIDs side by side (`18535cba-…` and `bd5266c4-…`). That's leftover from a previous ingest run — `delete_collection` removes the metadata pointer but leaves the HNSW files on disk. Harmless but messy. Safe to delete the whole `chroma_db/` and re-run ingest if you want a clean rebuild.
- `__pycache__/` — Python bytecode cache. Auto-regenerated, gitignored.
- `.env` — has your `GROQ_API_KEY`. Never commit this. Already gitignored.

---

## 6. Production infrastructure on the Hetzner box

Most of this is **inferred** from `message.md` (the SSH commands you've run before) and the HTTP response headers from `api.oskariozan.com`. The "Verify" column tells you the exact command to confirm each on the box.

| What | Inferred config | Verify |
|---|---|---|
| OS | Some Linux (Ubuntu/Debian most likely, given `sudo systemctl` + the standard `your-server.de` reverse DNS) | `cat /etc/os-release` |
| Web server | **Caddy** (response header `Via: 1.1 Caddy`) | `sudo systemctl status caddy` |
| TLS | Auto-managed by Caddy via Let's Encrypt ACME | `sudo caddy list-certificates` |
| App server | **uvicorn** (response header `Server: uvicorn`) | `sudo systemctl status rag-chatbot` |
| Service manager | **systemd** unit `rag-chatbot.service` | `sudo systemctl cat rag-chatbot` |
| App location | Likely `/root/rag-chatbot/` or `/home/<user>/rag-chatbot/` | `sudo systemctl show rag-chatbot -p WorkingDirectory` |
| Python env | Likely a venv inside the project — `WorkingDirectory/venv/bin/uvicorn` | `sudo systemctl show rag-chatbot -p ExecStart` |
| Internal port | Almost certainly `127.0.0.1:8000` (since Caddy proxies and CORS lists localhost ports for dev) | `sudo ss -ltnp \| grep 8000` |
| Logs | systemd journal | `sudo journalctl -u rag-chatbot -n 100 -f` |
| Caddy config | `/etc/caddy/Caddyfile` | `sudo cat /etc/caddy/Caddyfile` |

### What a typical Caddyfile for this setup looks like

You almost certainly have something close to this:

```caddyfile
api.oskariozan.com {
    reverse_proxy 127.0.0.1:8000
    encode zstd gzip
}
```

That single block gives you auto-HTTPS, HTTP→HTTPS redirect, HTTP/2, HTTP/3, and gzip — everything we see in the response headers.

### What the systemd unit likely looks like

```ini
[Unit]
Description=RAG Chatbot FastAPI service
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/rag-chatbot
EnvironmentFile=/root/rag-chatbot/.env
ExecStart=/root/rag-chatbot/venv/bin/uvicorn src.server:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

That's the canonical pattern for "FastAPI behind Caddy". If you SSH in and find something different, that's fine — but if you find nothing at all, that's the template to copy.

### Things to actually verify on the box (TODOs)

Run these one at a time when you SSH in (`ssh root@62.238.9.202` or whichever user you set up):

```bash
# OS + uptime + free RAM
cat /etc/os-release
uptime
free -h

# The systemd unit — full config and current state
sudo systemctl cat rag-chatbot
sudo systemctl status rag-chatbot --no-pager
sudo systemctl status caddy --no-pager

# Where the app actually lives
sudo systemctl show rag-chatbot -p WorkingDirectory -p ExecStart -p EnvironmentFile

# Caddy config
sudo cat /etc/caddy/Caddyfile

# Recent logs
sudo journalctl -u rag-chatbot -n 50 --no-pager
sudo journalctl -u caddy -n 20 --no-pager

# What's listening on 8000
sudo ss -ltnp | grep -E ':(8000|443|80)\s'

# Disk usage — ChromaDB and the model cache can grow
du -sh ~/rag-chatbot/chroma_db ~/.cache/huggingface 2>/dev/null
df -h /
```

Once you've run these and pasted me the output, I'll update this guide to replace every "likely" / "almost certainly" with the actual values, and I'll capture the prod paths in memory so I can give you exact `cd …` commands later.

---

## 7. Local dev — what's on this PC

The `oskariozan-website/rag-chatbot/` folder on your PC is a git clone of the same backend repo. You can run it locally with the right setup, but most of the helpers here have rotted.

### What's stale (see also §9)

- `start.bat`, `ingest.bat`, `start-cloudflare.bat` — all `cd /d` into `C:\Users\Oskari\Documents\rag-chatbot`, which **no longer exists** (the project has moved under `oskariozan-website/`). Running any of them will silently `cd` to nothing and then fail.
- `start-cloudflare.bat` is conceptually dead: it exposes localhost:8000 via a Cloudflare quick tunnel. That was your old "expose dev backend to the live site" trick before the Hetzner box existed. You don't need it anymore. (The stale tunnel URL still lingers in `server.py`'s CORS list — see §9.)

### To actually run it locally (the right way today)

From `C:\Users\Oskari\Documents\oskariozan-website\rag-chatbot\`:

```powershell
# one-time setup
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# create .env with your Groq key (or copy from elsewhere)
# .env contents:  GROQ_API_KEY=sk_xxx...

# build the vector store from notes/
python -m src.ingest

# start the server
python -m src.server
# OR with auto-reload:
# uvicorn src.server:app --host 0.0.0.0 --port 8000 --reload
```

Then `curl http://localhost:8000/health` should return `{"status":"ok"}`.

To talk to the local backend from the local website during dev, change `BACKEND_URL` in `zbikes/chat.js` to `http://localhost:8000`, open `zbikes/index.html` via `python -m http.server` on one of the CORS-allowed ports (3000, 5173, 8080), and use it.

---

## 8. The deploy workflow — step by step

### Deploying the website

```powershell
cd C:\Users\Oskari\Documents\oskariozan-website\zbikes
# edit files
git status                 # see what changed
git diff                   # see the actual changes
git add <files>            # stage what you mean to ship
git commit -m "concise description of the change"
git push origin main
# wait ~30s, then refresh https://www.oskariozan.com
```

If the deploy is misbehaving: https://github.com/Zanny-dotcom/oskariozan.github.io/actions — the Pages workflow will show green/red.

### Deploying the backend

**Step 1 — push code to GitHub from your PC:**

```powershell
cd C:\Users\Oskari\Documents\oskariozan-website\rag-chatbot
git status
git diff
git add <files>
git commit -m "describe the change"
git push origin main
```

**Step 2 — pull and restart on the Hetzner box:**

```bash
ssh root@62.238.9.202     # or whichever user
cd ~/rag-chatbot          # adjust path if different
git pull
# if requirements.txt changed:
./venv/bin/pip install -r requirements.txt
# restart the app
sudo systemctl restart rag-chatbot
# watch the logs to confirm it came up clean
sudo journalctl -u rag-chatbot -n 30 -f
# in another terminal, smoke test
curl -s https://api.oskariozan.com/health
curl -s -X POST https://api.oskariozan.com/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What did patient SM prove about fear?"}'
```

**Key rule from your saved workflow**: small changes (typo, prompt tweak, logging, CORS) → push straight up. Anything touching `ingest.py`, `query.py`, or the `/chat` contract → test on localhost first.

### Adding or editing notes (and rebuilding the index)

The `notes/` folder is **gitignored on purpose** (private data), so notes are NOT shipped via git. Two options:

**Option A — author notes on the box directly:**
```bash
ssh root@62.238.9.202
cd ~/rag-chatbot
nano notes/new-topic.md
# add your content
python -m src.ingest             # or ./venv/bin/python -m src.ingest
sudo systemctl restart rag-chatbot   # only strictly needed because query.py loads the collection at import time
```

**Option B — author on PC, scp to the box:**
```powershell
# from PC, in rag-chatbot/
scp .\notes\new-topic.md root@62.238.9.202:~/rag-chatbot/notes/
```
Then SSH in and run `python -m src.ingest` + restart.

Either way: ingest wipes and rebuilds the `notes` collection from scratch. There's no incremental indexing.

---

## 9. Stale things to clean up (low-priority but tracked)

A list so future-you doesn't keep tripping over them.

1. **`rag-chatbot/CLAUDE.MD` line**: "This will eventually deploy to a VPS — keep it simple to run." → It's already on Hetzner. Update or delete.
2. **`zbikes/CLAUDE.md` line**: "Personal website hosted on Porkbun via Git push." → Hosted on GitHub Pages. Porkbun is just the registrar.
3. **`server.py` CORS entry**: `"https://instrumental-resolution-recognize-binary.trycloudflare.com"` → leftover from the old Cloudflare tunnel days. Safe to remove and redeploy.
4. **`start.bat`, `ingest.bat`, `start-cloudflare.bat`**: all `cd /d C:\Users\Oskari\Documents\rag-chatbot` — that path no longer exists. Either fix them to point at `C:\Users\Oskari\Documents\oskariozan-website\rag-chatbot`, or delete them in favor of the PowerShell commands in §7.
5. **`start-cloudflare.bat`** specifically: the whole concept is obsolete now that the backend lives on Hetzner. Delete.
6. **`chroma_db/` on this PC**: two HNSW UUID folders side-by-side from old runs. Harmless but messy. `Remove-Item -Recurse -Force chroma_db` and re-run ingest if you want a clean local state (you only need a local ChromaDB if you're doing local dev).
7. **`rag-chatbot/message.md`**: this is your stash of SSH debug commands. Useful, but the filename suggests it was an accidental save from a chat. Consider renaming to `scripts/smoke-test.sh` and making it actually executable, or move the contents into this guide and delete the file.

---

## 10. Glossary — the jargon used above, in plain English

- **Static site** — files (HTML/CSS/JS) served as-is, no server-side processing. Cheap to host, fast to serve. Everything dynamic happens in the browser via JS calling APIs.
- **GitHub Pages** — free static-site hosting from GitHub. You push to a repo, they serve the files.
- **CNAME (file)** — a one-line file in a Pages repo containing the custom domain. GitHub reads it and serves your site on that domain.
- **CNAME (DNS record)** — different thing. A type of DNS record that aliases one hostname to another. Unrelated to the file above, despite the shared name.
- **A record** — a DNS record that maps a hostname to an IPv4 address. `api.oskariozan.com` has one pointing to `62.238.9.202`.
- **Hetzner Cloud** — German VPS provider, cheap and fast. CX22 / CPX11 are the entry tiers at ~€4-5/month.
- **VPS (Virtual Private Server)** — a Linux machine you rent. You SSH in and install whatever you want.
- **systemd** — Linux's service manager. A "unit" file like `rag-chatbot.service` defines how to start/stop/restart your app and what to do if it crashes.
- **Caddy** — modern web server. Killer feature: zero-config automatic HTTPS — it talks to Let's Encrypt and renews certs for you forever.
- **Reverse proxy** — Caddy receives the public HTTPS request, decrypts it, then forwards the plain HTTP request to your app on localhost. Your app never needs to know about TLS.
- **Let's Encrypt / ACME** — free TLS certificate authority + the protocol Caddy uses to request and renew certs automatically.
- **uvicorn** — the ASGI server that actually runs FastAPI. Caddy → uvicorn → FastAPI app.
- **FastAPI** — Python web framework. Decorators turn functions into HTTP endpoints; Pydantic validates request bodies.
- **Pydantic `BaseModel`** — schema definition. `class ChatRequest(BaseModel): message: str = Field(..., min_length=1, max_length=1000)` is what rejects empty or oversize messages with a 422 before your code ever runs.
- **CORS (Cross-Origin Resource Sharing)** — browser security feature. When `oskariozan.com` JS tries to call `api.oskariozan.com`, the browser asks the API "do you allow this origin?" via a preflight `OPTIONS` request. If the API's `Access-Control-Allow-Origin` header doesn't list the caller, the browser blocks the response. That's why `server.py` has an explicit list.
- **Rate limiting (slowapi)** — wraps each endpoint with a per-IP request counter. `@limiter.limit("10/minute")` returns HTTP 429 if a single IP exceeds 10 requests in any 60-second window.
- **RAG (Retrieval-Augmented Generation)** — instead of asking the LLM "what do you know about X?", you first retrieve relevant text chunks from your own data, then ask the LLM "given THIS text, answer the question." Cheaper than fine-tuning, factually grounded, and lets you cite sources.
- **Embedding** — a list of floats (here 384 of them) that represents the meaning of a chunk of text. Similar meanings → similar vectors. Cosine distance between two vectors → semantic similarity.
- **bge-small-en-v1.5** — the embedding model. Small (~33MB), CPU-fast, strong for English. From the Beijing Academy of AI (BAAI).
- **`normalize_embeddings=True`** — divides each vector by its length so all vectors sit on the unit sphere. Makes cosine distance well-behaved (range 0-2 for L2, 0-1 for cosine).
- **ChromaDB** — embedded vector database. Stores the vectors + their metadata in a folder of `.bin` files + a SQLite index.
- **HNSW (Hierarchical Navigable Small World)** — the index algorithm Chroma uses for fast approximate nearest-neighbour search. The `.bin` files in `chroma_db/<uuid>/` are the HNSW graph.
- **Cosine distance** — `1 - cosine_similarity`. 0 = identical direction, 1 = orthogonal, 2 = opposite. Your `DISTANCE_GATE = 0.50` rejects anything where the best match is worse than "orthogonal-ish".
- **Distance gate** — the cheap-but-effective trick of refusing to answer when even the best retrieval is bad. Without it, the LLM gets handed irrelevant context and will hallucinate confidently.
- **Groq** — LLM inference provider. Runs open-weights models (Llama, Mixtral, etc.) on custom hardware, very fast and very cheap.
- **`llama-3.3-70b-versatile`** — current Groq model alias. Meta's Llama 3.3 70B-parameter instruct model. Worth double-checking at https://console.groq.com/docs/models that this is still the recommended pick — Groq deprecates models occasionally.
- **Temperature 0** — make the LLM as deterministic as possible. Reduces creative variation; for a factual Q&A bot, this is what you want.
- **`.env` file** — KEY=VALUE pairs of secrets loaded into the process environment. `python-dotenv` reads it in dev; in prod, systemd's `EnvironmentFile=` directive does the same job.

---

## 11. Useful future improvements (none urgent)

Sorted roughly by leverage:

1. **Monitor `/health` from outside.** Set up a free uptime check (UptimeRobot, Better Stack, etc.) hitting `https://api.oskariozan.com/health` every 5 min. Email you when it's down. Right now if the box dies you won't know until someone tries the chat.
2. **Capture conversation logs.** Currently no record of what people are asking. A single `logger.info("Q: %r", question)` plus rotating journald already gives you that — you'd just `journalctl -u rag-chatbot | grep "Q:"` to see questions. Decide first if you're comfortable logging visitor questions.
3. **Tune the distance gate.** `0.50` is a starting point. Run a handful of "should answer" and "shouldn't answer" questions; if too many are getting blocked, raise it; if junk is getting through, lower it.
4. **Add a reranker for quality.** `bge-reranker-base` re-scores the top-k more carefully. Adds a few hundred ms but bumps relevance noticeably. Only worth it if retrieval quality starts feeling weak.
5. **Cache identical questions.** A tiny in-memory `dict[str, dict]` keyed by exact question string would skip Groq calls for repeats. Cheap. Worth it if usage grows.
6. **Backup the box.** Hetzner offers €1/mo automatic snapshots. Worth turning on so you can roll back if you break something.
7. **Move `.env` to `EnvironmentFile=`-only.** If it's not already (verify in §6 TODOs), removing the local `.env` import path makes prod cleaner.
8. **Containerize (low priority).** A `Dockerfile` + `docker compose up -d` would make the deploy reproducible and would let you test prod-shape locally. Not necessary at current scale.
9. **CI on backend.** A trivial GitHub Action that runs `python -m py_compile src/*.py` + a syntax check on every push would catch dumb mistakes before you `git pull` on the box.

---

## 12. Quick reference — the commands you'll actually use

### From your PC
```powershell
# website edit + ship
cd C:\Users\Oskari\Documents\oskariozan-website\zbikes
git add . ; git commit -m "..." ; git push

# backend edit + ship (step 1: push)
cd C:\Users\Oskari\Documents\oskariozan-website\rag-chatbot
git add . ; git commit -m "..." ; git push

# smoke test prod
curl https://api.oskariozan.com/health
```

### On the Hetzner box
```bash
# backend deploy (step 2)
cd ~/rag-chatbot && git pull && sudo systemctl restart rag-chatbot

# watch logs live
sudo journalctl -u rag-chatbot -f

# rebuild the vector store after editing notes
cd ~/rag-chatbot && python -m src.ingest && sudo systemctl restart rag-chatbot

# is anything broken?
sudo systemctl status rag-chatbot caddy --no-pager
curl http://127.0.0.1:8000/health
curl https://api.oskariozan.com/health
```

---

## Where this guide lives & how to keep it current

- This file: `C:\Users\Oskari\Documents\EZvibes\inbox\oskariozan-rag-chatbot-architecture-and-deploy-guide.md`
- If you want a copy next to the code: `cp` it into `rag-chatbot/` or `oskariozan-website/` — both are fine.
- After your first real SSH session, come back and rewrite §6 with actual values (replace "likely" with confirmed paths, unit definitions, Caddyfile). I can do that for you in a follow-up if you paste the SSH command outputs.

---

*Last updated: 2026-05-28. Reflects local repo state + live HTTP probes against `api.oskariozan.com`. Anything labelled "likely" / "almost certainly" is inference; verify on the box.*
