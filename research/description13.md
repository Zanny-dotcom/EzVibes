# Research #13 — Search & Fuzzy Filter UX for a Prompt Vault (2025–2026)

> Comprehensive knowledge dump for the **EZvibes** prompt vault.
> Focus: fuzzy search libraries, scoring strategies, typeahead UX, modern command-palette designs (Raycast, Linear, Arc, Spotlight, GitHub, Superhuman), keyboard-first navigation, empty states, recents, semantic search, tag filtering, highlighting, visual treatments.
> Bias: things a vanilla-JS Electron renderer can ship **without** React/bundlers.

---

## 0. Executive summary (read this first)

The prompt vault inside each session window is essentially a **dual-mode command palette**:

1. Title-first fuzzy search across short labels (`prompt.md`, `hand-off.md`, `CLAUDE.md`).
2. Optional full-text + semantic search across the file *contents* for "find the prompt that mentions websockets" queries.

In 2025-2026, the de-facto stack for that is one of three flavors:

- **Tiny + zero-config** — `Fuse.js` (Bitap) is the brand-name default. ~4-8.6 kB, used by Google/Microsoft/Anthropic/Vercel/Spotify/etc. Works fine for <10K items but search latency balloons (~34 s for 162K phrases vs uFuzzy at ~430 ms).
- **Tiny + fast + high-quality ranking** — `uFuzzy` (7.6 kB), `@nozbe/microfuzz` (2 kB), `fuzzysort` (5 kB, <1 ms on 13K files), `fzf-for-js` (FZF algorithm port), or `command-score` (the Superhuman library — boundedset matchiness 0..1).
- **Real search engine in the browser** — `Orama` (~80 kB, 5-10 ms vector queries, supports hybrid BM25 + vector + facets + tags) and `FlexSearch` (fast inverted index; no fuzzy). `MiniSearch` sits in between.

For a prompt-vault with hundreds (not millions) of markdown files in a folder, **uFuzzy or microfuzz for the title list + Orama for content/semantic search** is the pioneer-level combo. Both run entirely client-side, are tiny, and have ~7 ms hot-search performance.

The single most exciting pioneer idea I found: **fully in-browser semantic search using `@xenova/transformers` + `gte-small` (or 2025's `EmbeddingGemma`) with Orama as the vector store**. 30 MB one-time model download, 20-30 ms per query embed, 5-10 ms vector lookup, **zero network round-trips**. You can type `websocket reconnect logic` and it surfaces a hand-off.md you never named — without an API key. Nearform's reference implementation indexes 900 articles into 2-4 MB of quantized embeddings. (See §9.)

The rest of this document is the deep dive.

---

## 1. The library landscape (2025-2026)

### 1.1 At-a-glance matrix

| Library | Size (min) | Algorithm | Fuzzy? | Index time | Search time | Memory | Sweet spot |
|---|---|---|---|---|---|---|---|
| **Fuse.js** v7.3 | ~8.6 kB | Bitap | Yes | 31 ms (162K) | 33,875 ms (162K) | 245 MB peak | <10K short items; "the brand-name default" |
| **uFuzzy** | 7.6 kB | MultiInsert / SingleError DL | Yes | 0.5 ms (162K) | 434 ms (162K) | 28 MB peak | Filter + autocomplete; best memory profile |
| **fuzzysort** | ~6 kB | FZF-style | Yes | 50 ms | <1 ms for 13K files | 175 MB | Per-keystroke filter on short labels |
| **fzf-for-js** | ~10 kB | Port of FZF main algo | Yes | – | very fast | – | Command palette / file finder vibes |
| **command-score** | 1.5 kB | Jquery-fuzzymatch + Chromium FilePathScoreFunction | Yes (matchiness 0-1) | – | – | – | Bounded sets; the Superhuman ranker |
| **@nozbe/microfuzz** | 2 kB | Greedy in-order match | "Limited" | – | 7 ms first, 1.5 ms cached on 4500 labels | tiny | Short labels: names, projects, tasks |
| **MiniSearch** | ~13 kB | Inverted index, BM25 | Optional | 504 ms | – | 67 MB | Modern; field boosting + filters |
| **FlexSearch** | ~6 kB | Inverted index (contextual) | **NO** | very fast | up to 10^6× faster than competitors | – | Docs sites, 100K+ docs, no typos |
| **Orama** (was Lyra) | ~80 kB (claims "<2 kB core") | BM25 + vector | Yes | 70-100 ms | 5-10 ms | 192 MB on 162K | Hybrid full-text + vector + facets |
| **QuickScore** | 9.5 kB | Quicksilver-style | Yes | 10 ms | 6,915 ms | 133 MB | Legacy; supplanted by uFuzzy |
| **Pagefind** | static, ~Rust-built index | Chunked index loaded on demand | Partial | build-time | network-payload < 300 kB on 10K pages | – | Static sites; not the right shape here |

Sources: uFuzzy benchmark (2023-10) on a 162K phrase dataset typing `test, chest, super ma, mania, puzz, prom rem stor, twil` character-by-character, plus npm-compare and PkgPulse comparisons.

### 1.2 Decision tree for a prompt vault

```
Are file titles short (<80 chars) and the dataset <10K? ─ yes ─► uFuzzy or microfuzz
                                                          │
                                                          no
                                                          ▼
Do you want to search inside files (body content)? ─ yes ─► Orama (hybrid BM25)
                                                       │
                                                       no
                                                       ▼
Do you also want "type a feeling, find the prompt"? ─ yes ─► Orama vector mode + transformers.js embeddings
                                                         │
                                                         no
                                                         ▼
Are you bundle-size obsessed? ─ yes ─► command-score (1.5 kB) ranking on already-filtered list
                                  │
                                  no
                                  ▼
Default: Fuse.js (everyone knows it; reasonable for the dataset size you have)
```

---

## 2. Fuse.js — the brand-name baseline

Latest version: **v7.3.0** (April 4, 2026). Builds: **basic ~6.8 kB** (fuzzy only), **full ~8.6 kB** (fuzzy + extended + logical + token search). Trusted by Google, Microsoft, **Anthropic**, Atlassian, Spotify, MongoDB, Vercel, Adobe, Signal, HashiCorp, SAP, IBM, Nvidia, Grafana, Elastic, Datadog, PostHog, Mapbox.

### 2.1 Install + minimal vanilla JS

```bash
npm install fuse.js
```

```html
<script type="module">
  import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.min.mjs';

  const files = [
    { name: 'CLAUDE.md',     tags: ['core','spec'],     body: '...' },
    { name: 'hand-off.md',   tags: ['handoff'],         body: '...' },
    { name: 'prompt-refactor.md', tags: ['refactor'],   body: '...' },
  ];

  const fuse = new Fuse(files, {
    keys: [
      { name: 'name', weight: 0.6 },
      { name: 'tags', weight: 0.3 },
      { name: 'body', weight: 0.1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,   // CRITICAL for body text — see §2.3
    includeMatches: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  console.log(fuse.search('hand'));
</script>
```

### 2.2 The options that actually matter

| Option | Default | Meaning |
|---|---|---|
| `keys` | `[]` | Fields to index. Strings, dot-paths, or `{name, weight}` objects |
| `threshold` | `0.6` | 0 = perfect, 1 = anything. **Lower** = stricter. For a prompt vault start at 0.3-0.4. |
| `distance` | `100` | Max chars between expected location and match. **Combined with `location` it silently caps body search.** |
| `location` | `0` | Where in the string the match is expected to occur. Defaults to start. |
| `ignoreLocation` | `false` | **Set to `true` for long text fields.** Otherwise default = match must be within first ~60 chars. |
| `includeMatches` | `false` | Returns `[start, end]` index ranges per match — required for highlighting |
| `includeScore` | `false` | Returns the relevance score per hit (lower = better) |
| `findAllMatches` | `false` | Don't stop at first match per field |
| `minMatchCharLength` | `1` | Ignore matches shorter than this. Useful for noise reduction |
| `useExtendedSearch` | `false` | Enables `'exact`, `=exact`, `^prefix`, `!negate`, `'|'or` operators |
| `useTokenSearch` | (v7+) | BM25-IDF token mode for multi-word queries |
| `shouldSort` | `true` | Auto-sort by score |
| `getFn` | – | Custom retriever for nested values |
| `sortFn` | default | Custom comparator |
| `ignoreFieldNorm` | `false` | Don't factor in field length |
| `fieldNormWeight` | `1.0` | 0..2 weight of field-length norm |
| `isCaseSensitive` | `false` | – |

### 2.3 The threshold × distance trap

> "With defaults (threshold: 0.6, distance: 100), the pattern must appear within 60 characters of position 0 to match. More specifically, for something to be considered a match, it would have to be within (threshold) 0.6 × (distance) 100 = 60 characters away from the expected location 0."

**For markdown body text, set `ignoreLocation: true`.** Otherwise hits buried deep in a file silently vanish.

### 2.4 Extended-search operator cheat sheet (when `useExtendedSearch: true`)

| Operator | Meaning | Example |
|---|---|---|
| `jscript` | Fuzzy match | `jscript` matches JavaScript |
| `=scheme` | Exact match | – |
| `'word` | Include match | `'js` |
| `!word` | Inverse match | `!python` |
| `^word` | Prefix match | `^pro` |
| `!^word` | Inverse prefix | – |
| `.suffix$` | Suffix match | – |
| `!.suffix$` | Inverse suffix | – |
| `query1 | query2` | OR | – |

Use this in the prompt vault to support advanced power-user queries like `!archive 'react ^use`.

### 2.5 Scoring theory (simplified)

Fuse computes a `score` per hit based on three components:

1. **Fuzziness** — Bitap edit distance to the closest substring window
2. **Location penalty** — distance from `location` divided by `distance`
3. **Field-length norm** — penalize matches in longer fields (unless `ignoreFieldNorm: true`)

Per-field key `weight` multiplies through. Lower final score = better match. `threshold` is the cutoff.

### 2.6 Highlighting (vanilla JS)

```javascript
const highlight = (results, klass = 'fz-hit') => {
  const gen = (text, regions = []) => {
    let out = '', i = 0;
    regions.forEach(([s, e]) => {
      out += text.slice(i, s) + `<span class="${klass}">` + text.slice(s, e + 1) + '</span>';
      i = e + 1;
    });
    return out + text.slice(i);
  };
  return results
    .filter(r => r.matches && r.matches.length)
    .map(r => {
      const item = { ...r.item };
      r.matches.forEach(m => { item[m.key] = gen(m.value, m.indices); });
      return item;
    });
};
```

Pair with:

```css
.fz-hit {
  color: #ffd866;          /* EZvibes amber, matches Claude chips */
  background: rgba(255,216,102,.08);
  border-radius: 2px;
  padding: 0 1px;
  font-weight: 600;
}
```

Sources: [Fuse.js with highlight gist](https://gist.github.com/evenfrost/1ba123656ded32fb7a0cd4651efd4db0), [Fuse.js — Lightweight Fuzzy-Search Library](https://www.fusejs.io/), [Fuse.js GitHub](https://github.com/krisk/Fuse), [PkgPulse 2026 comparison](https://www.pkgpulse.com/blog/fusejs-vs-flexsearch-vs-orama-client-side-search-2026), [CodeStax Fuse.js guide](https://codestax.medium.com/mastering-fuzzy-search-with-fuse-js-a-comprehensive-guide-7c711cace162).

---

## 3. uFuzzy — the pioneer's pick for filter-as-you-type

Maintained by Leon Sorokin (leeoniya). Built specifically to be "a more forgiving String.includes()" — designed for filter lists, autocomplete, and **short-to-medium phrase haystacks** (filenames, titles, names — exactly your prompt vault).

### 3.1 Why it wins for the vault title list

| | uFuzzy | Fuse | fuzzysort |
|---|---|---|---|
| Memory peak (162K) | 28 MB | 245 MB | 175 MB |
| Search time (162K, 7 queries char-by-char) | 434 ms | 33,875 ms | 1,321 ms |
| Init | 0.5 ms | 31 ms | 50 ms |
| Prefix cache speedup | yes (210 ms) | no | – |
| Out-of-order matching | yes (`outOfOrder` flag) | with tokens | – |
| Exclusions | yes (`-term`) | with extended search | – |

### 3.2 Install + vanilla JS

```bash
npm i @leeoniya/ufuzzy
```

```html
<script src="./vendor/uFuzzy.iife.min.js"></script>
<script>
  const haystack = [
    'CLAUDE.md',
    'hand-off.md',
    'feature-spec.md',
    'prompt-refactor.md',
    'review-checklist.md',
  ];
  const uf = new uFuzzy({
    intraMode: 1,        // tolerate one typo
    intraIns: 1,
    interIns: Infinity,
  });

  const [idxs, info, order] = uf.search(haystack, 'hand off', /* outOfOrder */ 1);
  for (const i of order) console.log(haystack[info.idx[i]]);
</script>
```

### 3.3 Highlight with HTML

```javascript
const mark = (part, matched) => matched ? `<mark>${part}</mark>` : part;
for (const i of order) {
  const idx = info.idx[i];
  const html = uFuzzy.highlight(haystack[idx], info.ranges[i], mark);
  // insert html into the DOM
}
```

### 3.4 Mode quick-reference

- **Mode 0 (MultiInsert, default)** — all search chars in sequence, intermediate chars allowed. `cat` matches *cat*, *scatter*, *cantina*.
- **Mode 1 (SingleError)** — one substitution / transposition / insertion / deletion. `example` matches *exemple, exmaple, examplle*.
- **Boundary mode `interLft/interRgt`:** 0 = anywhere, 1 = loose (case-changes ok), 2 = strict (whitespace/punctuation only).

Source: [uFuzzy GitHub](https://github.com/leeoniya/uFuzzy), [HN: Show HN — uFuzzy.js](https://news.ycombinator.com/item?id=33035580).

---

## 4. Other contenders worth knowing

### 4.1 fuzzysort

> "Fast: <1ms to search 13,000 files. Tiny: 1 file, 0 dependencies, 5 kB."

```javascript
import fuzzysort from 'fuzzysort';
const targets = files.map(f => ({ name: f.name, _prepared: fuzzysort.prepare(f.name) }));
const results = fuzzysort.go('hand', targets, { key: 'name', threshold: -1000, limit: 20 });
// results[i].obj    – the original file
// results[i].score  – higher is better
// results[i].indexes – character match positions for highlighting
```

`fuzzysort.highlight(result, '<b>', '</b>')` returns HTML directly. Used historically by Sublime-style file finders.

### 4.2 fzf-for-js

```bash
npm i fzf
```

```javascript
import { Fzf } from 'fzf';
const fzf = new Fzf(haystack, { selector: item => item.name });
const entries = fzf.find('hndof');   // matches "hand-off"
entries.forEach(e => console.log(e.item, e.positions));
```

It is the **exact same scoring algorithm** that powers the famous `fzf` CLI in your terminal. Tiebreakers favor matches on consecutive letters, starts of words, camelCase boundaries.

### 4.3 command-score (Superhuman's library, 1.5 kB)

```javascript
import commandScore from 'command-score';
commandScore('Mark as read', 'mar');    // → 0.83 (matchiness 0..1)
commandScore('Mark as read', 'rea');    // → 0.42
```

Pair with your own ranking:

```javascript
function rank(items, query) {
  return items
    .map(item => ({
      item,
      score: commandScore(item.label, query) * (item.scale ?? 1)  // scale > 1 boosts, < 1 dampens
    }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
```

Superhuman's pattern: store `scale` per command. "`Meeting Link Settings`" gets `scale = 0.5` so it loses to "`Create Meeting`" on the query `meeting`. Use the same trick for prompt files: boost recently-edited files, demote archived ones.

### 4.4 @nozbe/microfuzz

```bash
npm i @nozbe/microfuzz
```

```javascript
import createFuzzySearch from '@nozbe/microfuzz';
const search = createFuzzySearch(promptFiles, {
  key: 'name',
  strategy: 'smart',   // 'off' | 'smart' (default) | 'aggressive'
});
const results = search('handoff react');
// [{ item, score, matches: [[0,3], [5,9]] }, ...]
```

2 kB, latin + cyrillic + rudimentary CJK, diacritic-insensitive, ~7 ms cold / <1.5 ms hot on 4500 labels.

### 4.5 MiniSearch (full-text alternative)

```javascript
import MiniSearch from 'minisearch';

const mini = new MiniSearch({
  fields: ['name', 'body', 'tags'],
  storeFields: ['name', 'path', 'mtime'],
  searchOptions: {
    boost: { name: 3, tags: 2 },
    fuzzy: 0.2,
    prefix: true,
    weights: { fuzzy: 0.5, prefix: 0.7 },
  },
});

mini.addAll(promptFiles);
mini.search('reactor');
```

BM25 inverted index, fuzzy via Levenshtein, no DOM dependency. ~13 kB.

### 4.6 FlexSearch (NOT fuzzy — caveat!)

Maintainer-confirmed in [GitHub issue #452](https://github.com/nextapps-de/flexsearch/issues/452): **FlexSearch has no real fuzzy search.** It is the fastest inverted index out there for clean queries, but typos break it. Skip for a prompt vault that needs `claue` → CLAUDE.md.

### 4.7 Orama — the hybrid pioneer

```bash
npm i @orama/orama
```

```javascript
import { create, insert, search, insertMultiple } from '@orama/orama';

const db = create({
  schema: {
    name: 'string',
    body: 'string',
    tags: 'string[]',
    mtime: 'number',
    embedding: 'vector[384]',     // for semantic mode
  },
});

await insertMultiple(db, promptFiles);

// 1) Full text + facet
await search(db, {
  term: 'react hooks',
  properties: ['name', 'body'],
  boost: { name: 2 },
  where: { tags: ['frontend'] },
  facets: { tags: { size: 8 } },
});

// 2) Vector
await search(db, {
  mode: 'vector',
  vector: { value: queryEmbedding, property: 'embedding' },
  similarity: 0.8,
  limit: 20,
});

// 3) Hybrid (BM25 + vector blended)
await search(db, {
  mode: 'hybrid',
  term: 'react hooks',
  vector: { value: queryEmbedding, property: 'embedding' },
  hybridWeights: { text: 0.7, vector: 0.3 },
});
```

Numbers from Nearform's production demo: **database load 70-100 ms, vector query 5-10 ms, ~80 kB minified, no deps**. The schema supports typo tolerance + filters + facets + sorting + vector all in one query.

Sources: [Orama GitHub](https://github.com/oramasearch/orama), [Orama docs](https://docs.orama.com/), [Browser-based vector search (Nearform)](https://nearform.com/digital-community/browser-based-vector-search-fast-private-and-no-backend-required/), [Orama faceted/filter docs](https://docs.orama.com/open-source/usage/search/facets).

---

## 5. Scoring strategies — title × body × tag × recency

A prompt vault has multiple signals. A single fuzzy score over file names misses obvious wins. Here is the production-grade composite:

```
final_score = (
    title_weight  * title_match
  + body_weight   * body_match
  + tag_weight    * tag_match
  + recency_boost
  + pin_boost
) * scale_factor
```

### 5.1 Title weight ≫ everything else

> Per Superhuman & Retool experience: 60-70% of the final ranking should come from the title (filename). Body weight should be small (5-15%) but non-zero so that "websocket reconnect" surfaces a hand-off file even when the title is bland.

Concrete values for the EZvibes vault:

```javascript
const WEIGHTS = {
  name: 0.65,
  tags: 0.20,
  body: 0.10,
  recency: 0.05,
};
```

### 5.2 Recency boost — exponential decay

```javascript
const HALF_LIFE_DAYS = 14;
function recencyBoost(file) {
  const ageDays = (Date.now() - file.mtime) / 86400_000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);   // 1.0 today → 0.5 in 14 days → 0.25 in 28 days
}
```

For a vault that is constantly receiving hand-offs from other Claude sessions, this is *the* killer feature: the file written 30 seconds ago floats to the top automatically.

Cited approach in Qdrant's "score boosting" docs: `final_score = base_score + boost_1 + boost_2 + ... - penalty_1 - ...` with smooth decay functions on time and distance.

### 5.3 BM25 for body (Orama / MiniSearch use this internally)

The BM25 ranking function:

```
score(D, Q) = Σ idf(q_i) * tf(q_i, D)*(k1+1) / (tf(q_i, D) + k1*(1 - b + b*|D|/avgdl))
```

- `k1` (1.2–2.0): controls term-frequency saturation
- `b` (0.75 default): document-length normalization weight
- `idf(q) = ln((N - n(q) + 0.5) / (n(q) + 0.5) + 1)`: rare terms count more

You don't implement this yourself — Orama and MiniSearch ship it. But understanding the knob means you can dial body weighting against title weighting.

### 5.4 Aliases / synonyms (Superhuman's trick)

```javascript
const aliases = {
  'CLAUDE.md':   ['core', 'spec', 'main'],
  'hand-off.md': ['handoff', 'context', 'pass'],
};
// When indexing, treat aliases as extra `keys`
fuse.add({ name: 'CLAUDE.md', aliases: aliases['CLAUDE.md'].join(' ') });
```

Display the matched alias in parens after the title: `CLAUDE.md (spec)` so users learn the canonical name over time.

### 5.5 Frecency (frequency × recency, Firefox-style)

```javascript
const FREC_DAYS_HALFLIFE = 7;
const FREC_VISIT_BONUS  = 100;
function frecency(file) {
  return file.opens.reduce((acc, ts) => {
    const ageDays = (Date.now() - ts) / 86400_000;
    return acc + FREC_VISIT_BONUS * Math.pow(0.5, ageDays / FREC_DAYS_HALFLIFE);
  }, 0);
}
```

Persist `file.opens: number[]` (recent N timestamps) in `localStorage` or main-process JSON. This delivers the "the prompts I actually use float to the top" feeling Linear and Raycast get praised for.

---

## 6. Typeahead UX — making "instant" actually instant

### 6.1 Debounce vs throttle vs immediate

| Strategy | When to use | Felt latency |
|---|---|---|
| **Immediate (0 ms)** | Local in-memory search of <5K items | Instant — *the bar matches your typing visually* |
| **Throttle 50-100 ms** | Local search of 5K-50K items; preserves rhythm | Imperceptible if jank-free |
| **Debounce 150-300 ms** | Network or expensive index | Adds visible delay; needs spinner |
| **Leading-edge throttle 50 ms + trailing debounce 150 ms** | Hybrid — instant feedback, stable final query | Best of both |

For a prompt vault that runs **entirely in memory** with uFuzzy/microfuzz (<10 ms search), use **0 ms** — search on every input event. Use `requestAnimationFrame` to coalesce paints if the keystrokes outrun the renderer.

```javascript
let pending = null;
input.addEventListener('input', () => {
  if (pending) cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    const hits = uf.search(haystack, input.value);
    renderResults(hits);
  });
});
```

If you ever add semantic / vector search (§9), debounce **only that pipeline** at 120-150 ms. Run the fuzzy pipeline immediately so the title list always reacts.

### 6.2 Empty state (zero keystrokes)

Surface, in this order:

1. **Pinned prompts** (user marked them with `★`)
2. **Recently used** (last 5, by frecency)
3. **Recently created / written by other Claude sessions** (last 5, by `mtime`)
4. **All prompts** (alphabetical fallback)

Use small section headings like Raycast / Linear:

```
PINNED        ────────────────
 ★  CLAUDE.md
 ★  rules.md

RECENTLY USED ────────────────
    hand-off.md           2m ago
    deploy-checklist.md   8m ago

HANDOFFS (NEW) ────────────────
    hand-off.md           NEW  ← dot indicator
```

### 6.3 No-results state

Baymard's 5 strategies adapted to a prompt vault:

1. **Suggest spelling alternatives** — "Did you mean *refactor*?" (use Damerau-Levenshtein on the query against the indexed term vocabulary)
2. **Broaden the search** — "0 in this folder. Search **all** vaults?"
3. **Surface related categories** — "0 prompts named *react*. Browse `frontend` tag (8)"
4. **Show a primary action** — "Paste **as raw text** anyway", "Create *react.md* from this query"
5. **Never a dead end** — always link to "Open vault folder in Explorer"

The mistake to avoid: **50% of sites just say "no results" and stop**. A prompt vault should always offer ≥1 next step.

### 6.4 Loading state

If you ever add an async pipeline:

- **0-150 ms**: nothing (it'll resolve before the user notices)
- **150-1000 ms**: skeleton rows with shimmer; keep the previous results dimmed underneath at `opacity: 0.4`
- **>1000 ms**: spinner + status ("Indexing 3,210 files...")

Never blank the list. Layout shift kills the typeahead feel.

### 6.5 Recently used surfaced

When the search input is empty, the *top half* of the result list should be "Recent" (last 5-7). 7-9 items is the cited sweet spot — less than 10 keeps the user from skimming forever.

When the input has content, push recents below the matching results but keep them visible.

---

## 7. Keyboard-first navigation

The non-negotiable bindings:

| Key | Action |
|---|---|
| `↓` / `↑` | Move selection. Wrap at ends. |
| `Home` / `End` | Jump to first / last |
| `PgDn` / `PgUp` | Page jump |
| `Enter` | **Default: paste into terminal** |
| `Shift + Enter` | Paste **without** trailing newline (or with — pick a default; whichever isn't `Enter` is `Shift+Enter`) |
| `Cmd/Ctrl + Enter` | Open in editor instead of paste |
| `Alt + Enter` | Copy to clipboard (don't paste) |
| `Tab` | Filter by tag at cursor / drill into folder |
| `Backspace` (empty input) | Pop one filter chip |
| `Esc` | Close palette; second `Esc` closes the entire session window? (no — just palette) |
| `Cmd/Ctrl + K` | Open/close prompt vault |
| `Cmd/Ctrl + 1..9` | Jump to result N |
| `/` | Focus the search input from anywhere in the session window |

### Pioneer touch: chord modifiers

Holding modifiers shows *secondary actions inline*. From Raycast and Linear:

```
hand-off.md                            ⏎ Paste
                                  ⌘+⏎ Open in editor
                                  ⌥+⏎ Copy
                                ⇧+⌫ Move to .archive/
```

The hint strip lives at the bottom of the palette, always visible, and *the icon swaps as you hold the modifier* — that micro-interaction is the entire "feel" of Raycast.

### ARIA

```html
<div role="combobox" aria-expanded="true"
     aria-haspopup="listbox" aria-owns="vault-list">
  <input role="searchbox"
         aria-autocomplete="list"
         aria-controls="vault-list"
         aria-activedescendant="vault-item-3">
</div>
<ul id="vault-list" role="listbox">
  <li id="vault-item-3" role="option" aria-selected="true">...</li>
</ul>
```

Visible focus state at 200% zoom, `prefers-reduced-motion` respected on the open animation.

Sources: [UX Patterns command palette](https://uxpatterns.dev/patterns/advanced/command-palette), [Destiner — Designing a Command Palette](https://destiner.io/blog/post/designing-a-command-palette/).

---

## 8. Visual treatments — search bar designs from the heavy hitters

### 8.1 The Raycast school (dark, minimal, surface ladder)

- **Single surface mode: dark.**
- Three-step surface ladder:
  1. Card background — `#1a1a1a`
  2. In-card panel — `#222`
  3. Key-cap glyph backgrounds — `#2c2c2c` with a 1 px lighter top border
- Search bar is **borderless**, fills the top edge of the palette card. No icon to the left — just placeholder text.
- 1 px hairline separator under the input. The selected row has a `rgba(255,255,255,0.06)` highlight, no border.

### 8.2 The Linear school (clean, spacious)

- Slightly more padding (16-20 px) than Raycast.
- Search icon (`U+1F50D 🔍` or a custom 16 px SVG) on the left.
- Subtle focus ring: `box-shadow: 0 0 0 1px rgba(99,102,241,.4)`.
- Result rows have ~36 px height, 12 px left padding, monospaced shortcut hints on the right.

### 8.3 The Spotlight school (rounded, glassmorphic)

- macOS Tahoe 2025-2026: **Liquid Glass**.
- `backdrop-filter: blur(28px) saturate(180%)` + `background: rgba(40,40,40,0.55)`.
- 16-22 px corner radius.
- `transform: translateZ(0)` to GPU-promote.
- Subtle inner light: `box-shadow: inset 0 1px 0 rgba(255,255,255,0.05)`.

### 8.4 The Arc school (categorized launcher)

- Universal bar: top result is one prominent card, below it grouped sections "Open Tabs / History / Actions / Pages".
- Categories use a small label in `font-weight: 500; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px`.
- Active item gets a left **accent bar** (3 px wide gradient) rather than a full background tint.

### 8.5 For EZvibes specifically — pioneer treatment

Match EZvibes's existing palette (folder amber, codex teal, dark background) but layer in 2026 glassmorphism for the vault:

```css
.vault-panel {
  position: absolute;
  inset: 12px;
  border-radius: 14px;
  padding: 8px;
  background: rgba(20, 18, 14, 0.72);          /* warm dark tint to feel of-a-piece with the amber */
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid rgba(255, 216, 102, 0.08); /* faint amber edge */
  box-shadow:
    0 16px 48px rgba(0,0,0,0.6),
    inset 0 1px 0 rgba(255,255,255,0.04);
  transform: translateZ(0);                      /* GPU promote */
}

.vault-input {
  width: 100%;
  height: 44px;
  background: transparent;
  border: none;
  outline: none;
  color: #f7eed5;
  font-size: 15px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255, 216, 102, 0.10);
  transition: border-color .18s ease, box-shadow .18s ease;
}
.vault-input:focus {
  border-color: rgba(255, 216, 102, 0.45);
  box-shadow: 0 1px 0 0 rgba(255, 216, 102, 0.45);  /* one-pixel underline glow */
}

.vault-row {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #d6cdb1;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.vault-row[aria-selected="true"] {
  background: rgba(255, 216, 102, 0.10);
  color: #fff5dc;
}
.vault-row .badge {       /* NEW dot for fresh hand-offs */
  margin-left: auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff6b3d;
  box-shadow: 0 0 6px rgba(255, 107, 61, .6);
}
.vault-row mark {
  background: rgba(255, 216, 102, 0.22);
  color: #fff8e1;
  border-radius: 2px;
  padding: 0 1px;
}
```

### 8.6 Open / focus animations

A subtle "drop-in" rather than a slide:

```css
@keyframes vault-pop {
  from { opacity: 0; transform: translateY(-4px) scale(.985); }
  to   { opacity: 1; transform: none; }
}
.vault-panel { animation: vault-pop 160ms cubic-bezier(.2, .8, .2, 1) both; }

/* gentle pulse on the new-handoff indicator */
@keyframes pulse-amber {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,61,.6); }
  50%      { box-shadow: 0 0 0 6px rgba(255,107,61,0); }
}
.vault-row .badge { animation: pulse-amber 1.6s ease-out infinite; }
```

`prefers-reduced-motion: reduce` should disable the pulse and the pop.

### 8.7 Hover states

Subtle (150-200 ms is plenty). Don't add a shadow on hover — keep it to background tint only — because keyboard navigation is the primary modality.

```css
.vault-row:hover:not([aria-selected="true"]) {
  background: rgba(255,255,255, 0.04);
}
```

Sources: [Magic UI search input](https://magicui.design/blog/search-input-with-icon), [Glassmorphism 2.0 (2026)](https://weblogtrips.com/technology/glassmorphism-2-0-css-techniques-2026/), [Liquid Glass effects CSS/SVG (LogRocket)](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/), [VoltAgent Raycast DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md).

---

## 9. Pioneer-level: in-browser semantic search

This is the **single most exciting** capability you can ship. No server, no API key, no internet — and yet a user can type `auth fails after 5pm with stale jwts` and surface the right hand-off.

### 9.1 The stack (entirely client-side)

| Layer | Tech | Size / Cost |
|---|---|---|
| Embedding model | `gte-small` via `@xenova/transformers` (or `EmbeddingGemma` for 2025+) | ~30 MB one-time download, 384 dims |
| Vector store | Orama `mode: 'vector'` / `'hybrid'` | ~80 kB lib + ~4 KB/embedding |
| Chunker | `@nearform/llm-splitter` | <5 kB |
| Compute | CPU or WebGPU (auto-detect via transformers.js) | 20-30 ms per query |

### 9.2 Walkthrough

```javascript
// 1. Boot — happens once per session window
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers';
import { create, insertMultiple, search } from 'https://cdn.jsdelivr.net/npm/@orama/orama/+esm';

const embedder = await pipeline('feature-extraction', 'Xenova/gte-small', {
  quantized: true,    // 30 MB instead of ~120 MB
});

async function embed(text) {
  const out = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);  // 384-d float32 array
}

// 2. Index the vault folder once. Persist to IndexedDB so re-launch is instant.
const db = create({
  schema: {
    path: 'string',
    name: 'string',
    body: 'string',
    tags: 'string[]',
    mtime: 'number',
    embedding: 'vector[384]',
  },
});

const records = [];
for (const file of vaultFiles) {
  for (const chunk of splitMarkdown(file.body, { tokens: 256 })) {
    records.push({
      path: file.path,
      name: file.name,
      body: chunk.text,
      tags: file.tags,
      mtime: file.mtime,
      embedding: await embed(chunk.text),
    });
  }
}
await insertMultiple(db, records);

// 3. Query
const queryVec = await embed(input.value);
const results = await search(db, {
  mode: 'hybrid',
  term: input.value,
  vector: { value: queryVec, property: 'embedding' },
  hybridWeights: { text: 0.6, vector: 0.4 },
  limit: 25,
});
```

### 9.3 Performance (Nearform's measured numbers)

- **First load** (embedder + db): 1-2 seconds, parallelized
- **Per query embed**: 20-30 ms
- **Vector search**: 5-10 ms
- **Total perceived latency**: indistinguishable from "instant"

### 9.4 Quantization (75% size reduction)

> Compress embeddings from floats to bounded integers, reducing JSON file size by 75% with **negligible precision loss (under 0.08% value delta).**

For 900 articles Nearform got embeddings down from ~16 MB to 2-4 MB.

### 9.5 What you can do that no other prompt manager can

- "What hand-off was about React Suspense?" (no exact word match needed)
- Find duplicates: cosine-similarity > 0.92 → "this prompt is essentially the same as `react-bug.md` you wrote 3 days ago".
- Auto-cluster prompts on a side panel by topic (k-means on the embeddings).
- **Search across all sessions in the entire EZvibes install** — every folder's vault is an Orama collection, joined by a meta index.

Sources: [Browser-based vector search (Nearform)](https://nearform.com/digital-community/browser-based-vector-search-fast-private-and-no-backend-required/), [SemanticFinder demo](https://do-me.github.io/SemanticFinder/), [In-browser semantic search with EmbeddingGemma (Glaforge 2025)](https://glaforge.dev/posts/2025/09/08/in-browser-semantic-search-with-embeddinggemma/), [Transformers.js docs](https://huggingface.co/docs/transformers.js/en/index), [OpenAI embeddings guide](https://developers.openai.com/api/docs/guides/embeddings) (if you ever want to use a hosted model instead).

---

## 10. Tag-based filtering combined with full-text

Markdown front-matter tags are natural for prompts. Combine them with full-text:

### 10.1 Chip-above-input pattern

```
┌─[ react ⓧ ] [ handoff ⓧ ]──────────────────────┐
│ Search prompts...                                │
├──────────────────────────────────────────────────┤
│ ★ hand-off-react-state.md          tags: react, handoff
│ ⊙ react-context-loop-fix.md        tags: react
```

- Each chip is a removable filter. `⌫` on an empty input pops one.
- New chips can be added by typing `react` and pressing `Tab` (suggested completion) — this **promotes a substring search into a tag filter** when an exact tag name matches.
- Multi-select chips OR by default (matches anything tagged `react` OR `handoff`). Hold `Cmd/Ctrl` while clicking the second chip to toggle to AND.

### 10.2 Orama makes this trivial

```javascript
await search(db, {
  term: input.value,
  where: { tags: chipTags },   // array → ANY-of
  facets: { tags: { size: 12 } },
});
```

The returned `facets.tags` gives you the count per tag — render it next to each tag in a "All tags" overflow drawer.

### 10.3 Visual

```css
.vault-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px 0 10px;
  border-radius: 11px;
  font-size: 11px;
  background: rgba(255, 216, 102, 0.10);
  color: #ffd866;
  border: 1px solid rgba(255, 216, 102, 0.20);
}
.vault-chip[data-mode="and"] {
  background: rgba(255, 107, 61, 0.10);
  color: #ff8e6b;
  border-color: rgba(255, 107, 61, 0.20);
}
.vault-chip .remove {
  opacity: 0.5;
  transition: opacity 120ms ease;
}
.vault-chip:hover .remove { opacity: 1; }
```

Sources: [Bricxlabs — 15 Filter UI Patterns 2026](https://bricxlabs.com/blogs/universal-search-and-filters-ui), [Smart Interface Design — Badges vs Pills vs Chips vs Tags](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/), [Orama facets docs](https://docs.orama.com/open-source/usage/search/facets), [Orama filters docs](https://docs.orama.com/open-source/usage/search/filters).

---

## 11. Patterns from the 2025-2026 leaders

### 11.1 Raycast 2026

- Linear 2.0 integration in the palette — typing `linear` then `>` switches into project-specific scope.
- Multi-model AI selection inside the palette (Pro tier). Implication: the prompt vault could also expose an "Ask Claude about this prompt" inline.
- 1500+ open-source extensions. The model: **palette = OS-level launcher**. Inspirational target for EZvibes because the same chord (`Ctrl+K`) inside any terminal tab opens the vault.

### 11.2 Linear

- Cmd+K opens. The list begins with sections **Search results / Workspace / Recently visited / Suggestions**.
- Strong section labels, monospaced shortcut hints right-aligned.
- Their cmdk library (by Paco Coursey) is the canonical web implementation; ports exist for Solid, Svelte, Vue. **Bring its grouping mental model into vanilla JS.**

### 11.3 Arc Command Bar (RIP 2025, but the design lives)

- Universal: tabs + history + actions + site search in one bar.
- Categories shown inline; **best match across categories floats to the top regardless of category**.
- Adoption note: when Arc stopped active development (May 2025), the Browser Company pivoted to Dia, which preserved the Command Bar pattern.

### 11.4 Spotlight (macOS Tahoe 26)

- Liquid Glass surface; rounded corners; subtle drop shadow.
- App Intents — actions executable from search results.
- Intelligent ranking based on usage frequency + recency, **never alphabetical**.

### 11.5 GitHub command palette

- Trigger: `Cmd+K`.
- Tab adds the current selection as scope (e.g., highlight a repo, Tab → "search within this repo").
- Esc closes. Arrows navigate. Enter selects.
- Inline search results — files, issues, PRs, organizations.

### 11.6 Superhuman + command-score

- Per-command `scale` to bias ranking without breaking match relevance.
- Cmd-IDs allow specifying "rank ID X always below ID Y".
- Forgiving typos (`opn`, `oepn` → "Open").

### 11.7 Retool

- Hierarchical scope pills — delete pill = pop scope.
- "Top result / Actions / Components / Code" sections.
- Palette stays open after selecting an entity. Enter once = stay; Enter twice = jump.

Sources: [Raycast in 2026 (DEV)](https://dev.to/dharanidharan_d_tech/raycast-in-2026-the-mac-launcher-that-replaced-4-apps-in-my-dev-workflow-3pka), [Raycast 2026 updates](https://raycast-discount-code.com/blog/raycast-2026-updates), [Cult of Mac — macOS Tahoe Spotlight](https://www.cultofmac.com/how-to/spotlight-mac), [Designing Retool's Command Palette](https://retool.com/blog/designing-the-command-palette), [Superhuman blog](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/), [GitHub command palette docs](https://docs.github.com/en/get-started/accessibility/github-command-palette).

---

## 12. Recommended stack for the EZvibes

After all this: a concrete, opinionated recommendation.

### 12.1 Default (ship-in-a-day)

- **Title search:** `uFuzzy` (7.6 kB IIFE, zero deps).
- **Recents store:** `localStorage` JSON keyed per folder.
- **Highlighting:** `uFuzzy.highlight` with `<mark>` and the amber CSS above.
- **Empty state:** Pinned → Recent → New handoffs → All.
- **No debounce.** `requestAnimationFrame` coalesce.
- **Watching:** chokidar in main, IPC `vault:added/changed/removed` to renderer.

### 12.2 Power-user upgrade (ship-in-a-week)

- Add `Orama` for body + tag + facet search.
- Index file body on `vault:added/changed`. Persist Orama index to disk (`@orama/plugin-data-persistence`) so reopens are instant.
- Add tag chips above the input.

### 12.3 Pioneer (ship-when-ready)

- Add `@xenova/transformers` with `gte-small` (or 2025 EmbeddingGemma).
- Hybrid mode in Orama: `hybridWeights: { text: 0.6, vector: 0.4 }`.
- Lazy-load the embedder only when the user hits the **🧠 Semantic** toggle in the vault toolbar — keeps startup cold-start fast.
- Persist embeddings to IndexedDB to avoid recompute.

### 12.4 Code skeleton (vanilla JS in renderer/app.js)

```javascript
// vault.js
import uFuzzy from './vendor/uFuzzy.iife.min.js';   // 7.6 kB

const state = {
  files: [],          // [{ path, name, body, tags, mtime }]
  recent: [],         // [path]
  pinned: new Set(),  // path
};

const uf = new uFuzzy({ intraMode: 1 });

window.ezvibes.onVaultUpdate(files => {
  state.files = files;
  state.haystack = files.map(f => `${f.name} ${f.tags.join(' ')}`);
  render();
});

const input = document.querySelector('.vault-input');
const list  = document.querySelector('.vault-list');
let selected = 0;

function render() {
  const q = input.value.trim();
  let hits;
  if (!q) {
    hits = surfaceEmpty();
  } else {
    const [idxs, info, order] = uf.search(state.haystack, q, 1);
    hits = (order || []).slice(0, 50).map(o => ({
      file: state.files[info.idx[o]],
      ranges: info.ranges[o],
    }));
  }
  paint(hits);
}

function paint(hits) {
  list.innerHTML = hits.map((h, i) => `
    <li class="vault-row" role="option"
        id="vault-item-${i}"
        aria-selected="${i === selected}"
        data-path="${h.file.path}">
      <span class="name">${highlight(h.file.name, h.ranges)}</span>
      <span class="meta">${h.file.tags.map(t => `<span class="tag">${t}</span>`).join('')}</span>
      ${h.file.isNew ? '<span class="badge"></span>' : ''}
    </li>
  `).join('');
}

input.addEventListener('input', () =>
  requestAnimationFrame(render));

input.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { selected++; render(); e.preventDefault(); }
  if (e.key === 'ArrowUp')   { selected--; render(); e.preventDefault(); }
  if (e.key === 'Enter') {
    const path = list.children[selected].dataset.path;
    window.ezvibes.pasteIntoActiveTab(path);
  }
  if (e.key === 'Escape')    { close(); }
});
```

(Pair with a tiny `window.ezvibes.pasteIntoActiveTab(path)` preload helper that reads the file via main and calls `terminal:input` on the active tab's PTY.)

---

## 13. References

- [Fuse.js — Lightweight Fuzzy-Search Library](https://www.fusejs.io/)
- [Fuse.js GitHub](https://github.com/krisk/Fuse)
- [Fuse.js with highlight (Gist)](https://gist.github.com/evenfrost/1ba123656ded32fb7a0cd4651efd4db0)
- [Mastering Fuzzy Search with Fuse.js (CodeStax)](https://codestax.medium.com/mastering-fuzzy-search-with-fuse-js-a-comprehensive-guide-7c711cace162)
- [uFuzzy GitHub (leeoniya)](https://github.com/leeoniya/uFuzzy)
- [HN — Show HN: uFuzzy.js](https://news.ycombinator.com/item?id=33035580)
- [fuzzysort GitHub (farzher)](https://github.com/farzher/fuzzysort)
- [fzf-for-js GitHub (ajitid)](https://github.com/ajitid/fzf-for-js)
- [command-score npm (Superhuman)](https://www.npmjs.com/package/command-score)
- [microfuzz GitHub (Nozbe)](https://github.com/Nozbe/microfuzz)
- [Orama GitHub](https://github.com/oramasearch/orama)
- [Orama docs](https://docs.orama.com/)
- [Orama facets](https://docs.orama.com/open-source/usage/search/facets)
- [Orama filters](https://docs.orama.com/open-source/usage/search/filters)
- [Browser-based vector search (Nearform)](https://nearform.com/digital-community/browser-based-vector-search-fast-private-and-no-backend-required/)
- [SemanticFinder demo](https://do-me.github.io/SemanticFinder/)
- [In-browser semantic search with EmbeddingGemma (Glaforge 2025)](https://glaforge.dev/posts/2025/09/08/in-browser-semantic-search-with-embeddinggemma/)
- [Transformers.js docs (HF)](https://huggingface.co/docs/transformers.js/en/index)
- [OpenAI embeddings guide](https://developers.openai.com/api/docs/guides/embeddings)
- [Vercel AI SDK 3.2 embeddings](https://vercel.com/blog/introducing-vercel-ai-sdk-3-2)
- [PkgPulse — Fuse.js vs FlexSearch vs Orama 2026](https://www.pkgpulse.com/blog/fusejs-vs-flexsearch-vs-orama-client-side-search-2026)
- [npm-compare elasticlunr vs flexsearch vs fuse.js vs minisearch](https://npm-compare.com/elasticlunr,flexsearch,fuse.js,minisearch)
- [FlexSearch GitHub](https://github.com/nextapps-de/flexsearch)
- [FlexSearch has no fuzzy search (#452)](https://github.com/nextapps-de/flexsearch/issues/452)
- [Pagefind](https://pagefind.app/)
- [Designing a Command Palette (Destiner)](https://destiner.io/blog/post/designing-a-command-palette/)
- [Command Palette Pattern (UX Patterns for Developers)](https://uxpatterns.dev/patterns/advanced/command-palette)
- [Command Palette UX Patterns #1 (Medium)](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [Designing Retool's Command Palette](https://retool.com/blog/designing-the-command-palette)
- [How to build a remarkable command palette (Superhuman)](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [Command Menu (cmdk)](https://cmdk-base.vercel.app/)
- [Snippets management using the command palette (Ghostty #8698)](https://github.com/ghostty-org/ghostty/discussions/8698)
- [GitHub Command Palette docs](https://docs.github.com/en/get-started/accessibility/github-command-palette)
- [Raycast User Interface API](https://developers.raycast.com/api-reference/user-interface)
- [VoltAgent — awesome-design-md/raycast](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md)
- [Raycast in 2026 (DEV)](https://dev.to/dharanidharan_d_tech/raycast-in-2026-the-mac-launcher-that-replaced-4-apps-in-my-dev-workflow-3pka)
- [Cult of Mac — macOS Tahoe Spotlight](https://www.cultofmac.com/how-to/spotlight-mac)
- [Design Engineering 101: Typeahead (Florian Schulz)](https://blog.florianschulz.info/2025/10/typeahead/)
- [Five Simple Steps For Better Autocomplete UX (Smashing)](https://smart-interface-design-patterns.com/articles/autocomplete-ux/)
- [Baymard — 5 UX Strategies for "No Results" Pages](https://baymard.com/blog/no-results-page)
- [Bricxlabs — 15 Filter UI Patterns 2026](https://bricxlabs.com/blogs/universal-search-and-filters-ui)
- [Smart Interface Design — Badges vs Pills vs Chips vs Tags](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/)
- [Magic UI search input](https://magicui.design/blog/search-input-with-icon)
- [Glassmorphism 2.0 (2026)](https://weblogtrips.com/technology/glassmorphism-2-0-css-techniques-2026/)
- [Liquid Glass effects CSS/SVG (LogRocket)](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- [BM25 explained (Evan Schwartz)](https://emschwartz.me/understanding-the-bm25-full-text-search-algorithm/)
- [Okapi BM25 — Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
- [Personalized Search with Qdrant Score Boosting](https://medium.com/@gururaser/learning-to-rank-felt-too-complex-so-i-tried-something-else-22d550dc4b8a)
- [Tailwind UI Command Palettes](https://tailwindcss.com/plus/ui-blocks/application-ui/navigation/command-palettes)
- [shadcn Command](https://shadcnstudio.com/docs/components/command)
