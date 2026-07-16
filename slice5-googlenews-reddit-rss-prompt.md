# Claude Code Build Prompt — Slice 5: Google News RSS + Reddit RSS pollers

> Adds two new free, keyless sources to the Lakepointe Listening Dashboard:
> **Google News search RSS** (news coverage — now the primary news source while GDELT
> is unreliable) and **Reddit search RSS** (already spec'd, never run).
> All endpoint behavior below was **verified live 2026-07-16** via curl from Jolie's
> machine. Build in the step order below. **Show me each step before committing.**

---

## 0. Operating principles (non-negotiable, same as always)

1. **Verified-only data.** Field mappings below come from a live pull, but on first
   run, log the raw response before mapping and confirm the shape matches. Trust live
   responses over this document. Anything marked DISCOVERY is a task, not an instruction.
2. **Loud failure over silent zeros.** Explicit `ok | error` status per source per run.
   No `Promise.allSettled` coercion. A parse failure, a non-200, and "zero new items"
   must all be distinguishable in the DB and the UI.
3. **Partial success is success.** Sequential pollers; earlier sources persist even if
   later ones fail.
4. **Placeholder-first.** Tiles render immediately with awaiting/never states.
5. **Show before commit.** Diff at each step, wait for approval.

---

## 1. Verified endpoint facts (live curl, 2026-07-16)

### Google News search RSS
- URL pattern (VERIFIED, returns 200 with `User-Agent: Mozilla/5.0`):
  `https://news.google.com/rss/search?q=%22Josh+Howerton%22&hl=en-US&gl=US&ceid=US:en`
- Format: **RSS 2.0** (`<rss><channel><item>`)
- Item fields (all verified present):
  - `<title>` — `"Headline - Publisher Name"` (publisher suffix after " - ")
  - `<link>` — **redirect-wrapped**: `https://news.google.com/rss/articles/{token}?oc=5`.
    NOT the article URL. Do **not** attempt to decode or resolve these tokens.
  - `<guid isPermaLink="false">` — the same stable token. **This is the item's identity.**
  - `<pubDate>` — RFC-822 date
  - `<description>` — HTML snippet (anchor + publisher)
  - `<source url="https://publisher.com">Publisher Name</source>` — the real publisher
    domain. Store it.
- **Ordering: relevance, NOT recency.** Verified pubDates in one pull spanned 2016–2026.
  Consequence: the first ingest is a historical backfill (desired), and guid-dedupe is
  what prevents endless re-ingest — not date windows.
- **Matching is loose.** Body-matches, related coverage, and outright noise (obituaries,
  name collisions e.g. a songwriter also named Josh Howerton) all appear. Ingest
  everything; do not filter silently. Add a boolean `title_match` (case-insensitive
  keyword-in-title) as metadata for UI sorting only — never for dropping items.
- Quoted phrases: passing the phrase with URL-encoded quotes (`%22...%22`) was accepted;
  the feed title echoed the quoted phrase.
- ToS note (from the feed's own copyright element): feed is for personal, non-commercial
  use. Same category of call as the Reddit RSS decision — Jolie/Paul's call, already
  consistent with internal non-commercial use. Do not add commentary in code; just noted.

### Reddit search RSS
- URL pattern (VERIFIED, returns 200 from a **residential** network with descriptive UA
  `lakepointe-listening/1.0 (internal brand monitor)`):
  `https://www.reddit.com/search.rss?q=%22Josh+Howerton%22&sort=new`
- Format: **Atom** (`<feed><entry>`) — different element names than RSS 2.0:
  `entry`, `title`, `link href=`, `id`, `published`, `updated` (ISO-8601),
  `author><name`, `category term=` (subreddit), `content type="html"`.
- **Entries mix types**: posts have `id` starting `t3_`; subreddit/community results
  start `t5_`. Ingest `t3_` only; count and log skipped `t5_` entries (loudly, not
  silently — a one-line info log with count).
- Links are real `reddit.com` permalinks → normal `normalized_url` dedupe applies.
- Sorted by new. ✔
- **UNVERIFIED FROM VERCEL**: Reddit is known to block datacenter IPs on
  unauthenticated endpoints. See Step 1 below — connectivity check comes FIRST.

---

## 2. Build steps (in order, show-before-commit at each)

### Step 1 — Vercel egress connectivity check (DISCOVERY, before any poller code)
Add a temporary (or keepable, behind the cron secret) route that makes ONE request to
`https://www.reddit.com/search.rss?q=test&sort=new` with the descriptive User-Agent and
ONE request to the Google News RSS URL for `"Lakepointe Church"`, and reports for each:
HTTP status, response content-type, first 500 chars of body, and any network error with
`error.cause`. Deploy, hit it once, report results. **Do not build the pollers'
trust-path until we know both endpoints answer from Vercel's egress.** If Reddit blocks
datacenter IPs, its tile gets an honest "Reddit blocks our host's IPs — not connected"
state (like the X/Meta tiles) and we stop there for Reddit; Google News proceeds
regardless.

### Step 2 — XML parsing
- DISCOVERY first: check whether an XML parser is already in dependencies. If not,
  propose one (e.g. fast-xml-parser) and confirm its actual parse output shape against
  the logged raw feeds before writing mappers. Do not hand-roll XML parsing with regex.
- One parse layer, two mappers: RSS 2.0 (Google News) and Atom (Reddit).

### Step 3 — google_news poller
- One feed request per keyword phrase, reusing the existing KEYWORDS config (phrases
  already carry their own quotes — URL-encode as-is; log each final URL on first run).
- Map per item: `source='google_news'`, `external_id=` guid token,
  `title` (keep the " - Publisher" suffix or split it — your call, show me),
  `url=` the wrapped link **stored as-is**, publisher domain from `<source url>` into
  the existing dimensions/JSONB or a column consistent with current schema,
  `published_at=` parsed pubDate, plus `title_match` boolean.
- Dedupe on `(source, external_id)`. Do NOT dedupe google_news rows on normalized_url
  (wrapped URLs make it meaningless). Accepted v1 limitation: no cross-source URL match
  between google_news and gdelt items for the same article.
- First run will backfill many historical items — expected and desired. Report the count.

### Step 4 — reddit poller (only if Step 1 passed)
- One request per keyword phrase to `search.rss`, `sort=new`, descriptive User-Agent
  (constant or env var — show me which).
- `t3_` entries only. Map: `source='reddit'`, `external_id=` the `t3_...` id,
  `title`, `url=` permalink (normalized_url dedupe applies normally),
  `published_at=` `published`, subreddit from `category term` into dimensions,
  author name into dimensions.
- Politeness: ≥2s between consecutive requests to the same host within a run.

### Step 5 — orchestrator + UI
- Both pollers run sequentially after existing sources, each with its own per-run
  status row and budget, consistent with existing orchestrator patterns.
- UI: Reddit tile leaves `never` state; new Google News tile added; both follow
  placeholder-first and show per-run ok/error with the error message verbatim.

---

## 3. Explicitly out of scope (do not build)
- Decoding/resolving Google News redirect tokens
- Subreddit-specific feeds (r/lakepointechurch/new.rss, r/joshhowerton/new.rss) —
  future roadmap, noted, not now
- Any sentiment scoring or relevance filtering beyond the `title_match` metadata flag
- Any changes to GDELT pollers (separate workstream)
- `when:` date operators on Google News queries (dedupe makes them unnecessary;
  unverified anyway)

---

## 4. Verification discipline
Everything in §1 was checked live on 2026-07-16 from a residential network. The Vercel
egress path is the one unknown, and Step 1 exists to close it before anything depends
on it. Log raw responses before committing field mappings. Report anything that
deviates from this document — the live response wins.
