# Claude Code Build Prompt — Lakepointe Listening Dashboard (Tool 1) — REV 4

> Internal brand/name monitoring dashboard. Polls free data sources for mentions of Lakepointe
> Church and Pastor Josh Howerton, normalizes them into Neon Postgres, renders a brand-dark
> dashboard on Vercel. **This repo already exists and is partially built (Slice 1 in progress)** —
> see Section 1 before touching anything. Build in the vertical-slice order below.
> **Show me each slice before committing.**
>
> ## REV 4 changelog (July 10, 2026) — read this first
> - **Google CSE is REMOVED entirely.** Google closed the Custom Search JSON API to new
>   projects (verified via live 403s + multiple 2026 reports). Its watchlist role moves into a
>   second GDELT sweep using `domainis:` operators. Open-web search → roadmap F6.
> - **Reddit uses public RSS, not the OAuth API.** Reddit's Responsible Builder Policy (late
>   2025) killed self-serve app creation. No Reddit credentials exist.
> - **GDELT behaviors verified live (July 2026):** empty result = bare `{}` (not an empty
>   array); rate limit = 429 "one request every 5 seconds" per IP; poller must space GDELT
>   calls ≥5s and treat 429 as a loud error, never retry-hammer.
> - **Keyword list gains the "Lake Pointe" spelling variant** (two words) — a known real-world
>   styling that exact-phrase matching would otherwise miss.
> - **Env vars reduced to three:** `DATABASE_URL`, `YOUTUBE_API_KEY`, `CRON_SECRET`.
> - **Repo reconciliation required:** the repo's README.md and the old prompt .md describe dead
>   integrations (Reddit OAuth, CSE). Slice 1 now includes fixing them.
> - Carried from earlier REVs: 2-day lookbacks (cron jitter), `normalized_url` cross-source
>   grouping, `COALESCE` feed sort, keyword-list-as-parameter, fenced future roadmap.

---

## 0. Operating principles (non-negotiable)

1. **Verified-only data.** Never invent API field names, response shapes, or endpoints. Log raw
   responses and confirm shapes against live data before mapping. Flag anything inferred.
2. **Loud failure over silent zeros.** An API error must be visibly distinct from a genuine
   "zero new mentions." No `Promise.allSettled` + silent `[]` coercion. Every source writes an
   explicit `ok | error` `poll_run` row per run, surfaced in the UI.
3. **Partial success is success.** Sources run sequentially; persist each source's results
   immediately. One source failing never blanks the dashboard or aborts the run.
4. **Placeholder-first.** Unavailable sources render as visible, honest "not connected" tiles.
5. **Show before commit.** Checkpoint at every slice; wait for approval.

---

## 1. Existing repo — reconcile before building

The repo `lakepointe-listening` (in `plafatas-projects`, deployed on a Vercel Hobby project) is
already scaffolded: Next.js 16.2.6 (App Router), React 19.2.4, **Tailwind CSS v4**,
`@neondatabase/serverless`, Recharts, ESLint 9, and a `noindex, nofollow` header in
`next.config.ts` (keep that — this is an internal tool). `db/schema.sql` and an idempotent
`ensureSchema()` in `src/lib/db.ts` exist from earlier Slice 1 work.

**Slice 1 reconciliation tasks (do these before any new feature work):**
- **Fix stale docs.** `README.md` and any old prompt/spec `.md` in the repo describe Reddit
  OAuth, Google CSE, and Reddit "comments search" — all dead or never-true. Update README's
  source table and slice list to match THIS document. Delete or replace the old prompt file with
  this one. Stale docs in-repo are a hazard: future sessions will trust them.
- **Schema migration check.** Compare `db/schema.sql` + `ensureSchema()` against Section 3. The
  earlier schema likely lacks `normalized_url` (and its index) and may list `google_cse` as a
  source value. Add missing columns/indexes via `ALTER TABLE IF NOT EXISTS`-style idempotent
  migration inside `ensureSchema()` — do not drop/recreate tables.
- **Verify the brand-dark shell** matches Section 7 (Tailwind v4 syntax — see the warning
  there), with placeholder tiles for every source in Section 4's roster.
- Show me the reconciled state before proceeding to Slice 2.

**Env vars (exactly three — no Reddit, no CSE):**
- `DATABASE_URL` — Neon connection string
- `YOUTUBE_API_KEY` — the `listening-dashboard` key (Google Cloud project
  `lakepointe-social-dashboard`; user has been advised to rotate it after accidental exposure —
  confirm the env var holds the NEW value)
- `CRON_SECRET` — user-generated random string guarding the poll route

---

## 2. Vercel Hobby cron — accepted constraint: ONCE-DAILY polling

Verified Hobby limits: cron jobs run at most once per day; ±59 min timing jitter; 300-second
function cap. Once-daily is explicitly accepted — do not engineer around it.

- ONE cron job in `vercel.json`: `0 13 * * *` (~8am Central after jitter) → `GET /api/cron/poll`,
  guarded by `CRON_SECRET` via the `Authorization` header (Vercel sends it automatically).
- Sources run **sequentially** with per-source time budgets (~60s each), persisting immediately.
  A source that exceeds budget or throws gets an `error` `poll_run` row; the run continues.
- Poll logic lives in the HTTP route (not cron config) so an external scheduler could later hit
  it for higher frequency without rearchitecting. Note this in a comment.
- Manual **"Refresh now"** button in the UI POSTs to the same guarded route.
- The orchestrator returns a per-source summary object at end of run (response body now; push-
  digest hook later — see F1).
- **Jitter-proof lookback:** every source polls a **2-day window** (consecutive runs can be >24h
  apart). Dedupe makes overlap free.

---

## 3. Data model (Neon) — target schema (migrate existing tables to this)

```sql
CREATE TABLE IF NOT EXISTS mention (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL,          -- 'gdelt' | 'gdelt_watchlist' | 'reddit' | 'youtube'
  source_uid     text NOT NULL,          -- platform-native stable id
  url            text NOT NULL,
  normalized_url text,                   -- canonicalized URL for cross-source duplicate GROUPING
  title          text,
  excerpt        text,
  author         text,
  query_matched  text NOT NULL,          -- which keyword (or 'watchlist') produced this row
  published_at   timestamptz,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  sentiment      text,                   -- NULL in v1 (deferred; keep for forward-compat)
  status         text NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'dismissed'
  UNIQUE (source, source_uid)
);

CREATE INDEX IF NOT EXISTS mention_fetched_idx   ON mention (fetched_at DESC);
CREATE INDEX IF NOT EXISTS mention_source_idx    ON mention (source);
CREATE INDEX IF NOT EXISTS mention_status_idx    ON mention (status);
CREATE INDEX IF NOT EXISTS mention_norm_url_idx  ON mention (normalized_url);

CREATE TABLE IF NOT EXISTS poll_run (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,
  ran_at        timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL,          -- 'ok' | 'error'
  new_mentions  integer NOT NULL DEFAULT 0,
  error_message text,
  duration_ms   integer
);

CREATE INDEX IF NOT EXISTS poll_run_source_idx ON poll_run (source, ran_at DESC);
```

- Dedup: `ON CONFLICT (source, source_uid) DO NOTHING`; count actually-inserted rows.
- **normalized_url** (compute on every insert): lowercase host, strip `utm_*`/`fbclid`/`gclid`
  params, drop trailing slash and fragments. Feed **groups** (never deletes) rows sharing a
  `normalized_url` — "also via …" badge.
- Re-discovered items never reset a `dismissed` status.

---

## 4. Source roster & keyword config

**Keyword list is a parameter** on every poller, from one shared config module. Default:

```ts
export const KEYWORDS = [
  '"Lakepointe Church"',
  '"Lake Pointe Church"',   // legacy two-word styling still in the wild — verified miss risk
  '"Josh Howerton"',
];
// Spelling variants pending: Cowork disambiguation research may add/adjust. Keep this the
// single source of truth; pollers must not hardcode terms.
```

**Live sources (v1):**
| # | Source | Auth | Notes |
|---|---|---|---|
| 1 | GDELT keyword sweep | none | news outlets only; the tripwire backbone |
| 2 | GDELT watchlist sweep | none | `domainis:` OR-list from the Cowork domain research |
| 3 | Reddit via public RSS | none | posts only; endpoint VERIFY LIVE first |
| 4 | YouTube Data v3 | API key | 100 units/search; shared project quota |

**Placeholder tiles (honest gaps):** X/Twitter, Meta (Facebook/Instagram), and **Web search**
("No free API path — not connected"). Never fake data.

---

## 5. Build order (vertical slices — show me each)

### Slice 1 — Reconciliation (Section 1) + schema migration + shell verification
Already partially built. Complete the reconciliation checklist, then stop and show me.

### Slice 2 — GDELT pollers (keyword sweep + watchlist sweep)
- Endpoint: `https://api.gdeltproject.org/api/v2/doc/doc`, `mode=artlist`, `format=json`,
  `maxrecords=250`, `timespan=2d`.
- **Verified live behaviors (July 2026) — encode all three:**
  1. Empty result = bare `{}` — parse as `ok, zero mentions`, NOT an error and NOT a parse
     failure. (An `articles` array appears only when there are results.)
  2. Rate limit: HTTP 429 with "one request every 5 seconds" text, per IP. **Space all GDELT
     calls ≥5 seconds apart** (keyword sweeps + watchlist sweep = several calls; a simple
     `await sleep(5500)` between them is fine within the 60s source budget — if total GDELT
     calls would exceed the budget, batch keywords with OR instead and tell me).
  3. On 429: write an `error` poll_run row and stop GDELT for this run. Never retry-hammer.
- Send a real `User-Agent` header on every call.
- **Keyword sweep:** one call per KEYWORDS entry. The `repeat2:"Lakepointe"` noise filter may be
  combined with the phrase (`query="Lakepointe Church" repeat2:"Lakepointe"` — note the space
  before `repeat2`); this combination is documented but not yet verified with live results, so
  test it once against a query known to return data and fall back to phrase-only + downstream
  noise filter if it misbehaves. Skip `repeat` for "Josh Howerton" (distinctive name).
- **Watchlist sweep:** one call combining watchlist domains:
  `query=(("Lakepointe" OR "Lake Pointe" OR "Howerton")) (domainis:dallasnews.com OR domainis:...)`
  — GDELT supports `domainis:` exact-domain restriction and boolean OR groups (verified from
  GDELT docs). The domain list comes from the Cowork research deliverable; until it arrives, use
  a starter list (dallasnews.com, star-telegram.com, christianitytoday.com, christianpost.com,
  churchleaders.com, religionnews.com) in a config constant. Confirm the OR-of-domainis syntax
  against one live call before finalizing; if GDELT rejects long OR chains, split into 2–3 calls
  (respecting 5s spacing) and tell me.
- Map artlist fields (`url`, `title`, `seendate`, `domain`, `socialimage`, `language`,
  `sourcecountry` — confirm empirically). `source_uid` = article URL. `excerpt` will be empty
  (GDELT returns no article text) — acceptable, note in a comment. `seendate` → `published_at`
  (it's discovery time, close enough for daily monitoring).
- `source` = `gdelt` for keyword sweep rows, `gdelt_watchlist` for watchlist rows. Tile subtexts:
  "news outlets only" / "watchlist domains, news only".
- `poll_run` rows for both sweeps. Live tiles + feed. **Stop and show me.**

### Slice 3 — Reddit poller (PUBLIC RSS — no auth, no credentials)
- **Context:** Reddit's Responsible Builder Policy killed self-serve API apps; RSS is the
  decided v1 path (API upgrade = F5).
- **VERIFY LIVE FIRST:** fetch `https://www.reddit.com/search.rss?q=<urlencoded>&sort=new` once
  per keyword; show me status + first ~50 lines of raw XML before writing any parser. If search
  RSS is dead/empty, STOP — Reddit becomes a placeholder tile pending a decision.
- Parse Atom XML with a maintained parser (no regex XML; verify the parser's option names
  against its current docs — do not assume from memory).
- Historical field mapping (confirm against live feed): entry `<id>` (contains `t3_xxx`
  fullname) → `source_uid` (fallback: permalink); `<title>`; `<link href>` → `url`;
  `<author><name>` → `author`; `<updated>` → `published_at`; `<content type="html">`
  (HTML-stripped, truncated) → `excerpt` (thinner than API selftext — acceptable).
- No date-range param in RSS — filter client-side to the 2-day window.
- Descriptive User-Agent (`web:lakepointe-listening:v1.0 (internal monitoring)`); any 429 =
  loud error, never retry-hammer.
- Noise filter: keep results mentioning "church" or "Howerton" near "Lakepointe".
- Tile subtext: "posts only, via RSS". `poll_run` row + live tile. Show me.

### Slice 4 — YouTube poller (quota-aware)
- `search.list` (`part=snippet`, `q=<keyword>`, `type=video`, `order=date`, `maxResults=50`,
  `publishedAfter=<now − 2d>`). One call per KEYWORDS entry = 3 calls = 300 units/day.
- Quota pools at the Google Cloud project (`lakepointe-social-dashboard`): Social Dashboard ~6
  units/day (measured) + this tool's 300 = ample headroom in 10,000. Future Tool 2 adds ~500.
  Do NOT add per-video or comment calls in v1.
- `source_uid` = video id. Map `title`, `description`→`excerpt`, `channelTitle`→`author`,
  `publishedAt`→`published_at`; construct watch URL. Confirm shape live. `poll_run` + tile.
  Show me.

### Slice 5 — Placeholders + cron wiring
- X/Twitter, Meta, and Web-search tiles: "No free API path — not connected". Do not fake data.
- Wire `vercel.json` cron + `/api/cron/poll` orchestrator (Slices 2–4, sequential, budgeted,
  incremental persistence, end-of-run summary object) + the "Refresh now" button.

---

## 6. Dashboard UI (brand-dark)

1. **Feed** — sorted `COALESCE(published_at, fetched_at) DESC`. Cards: source badge, title
   (links out), excerpt, author, date, matched keyword. Same-`normalized_url` rows grouped with
   "also via …" badge. Filters: source, keyword, status. Loud error banner when any source's
   latest `poll_run` errored ("GDELT poll failed at 8:04am — showing last good data").
2. **By source** — last-run time, status (ok/error/zero), new-mentions count, and the
   coverage-limit subtext per tile. A quiet tile showing "0 new, checked 8:00am ✓" is the system
   working — the UI must make ok-zero, error, and stale visually distinct.
3. **Review queue** — `status='new'` mentions; mark reviewed/dismissed. Optimistic UI.

Sentiment: out for v1 (column exists, stays NULL, no UI).

---

## 7. Brand-dark theme — ⚠️ Tailwind v4 syntax

This repo uses **Tailwind CSS v4**, which is configured in CSS, not `tailwind.config.js`. Do
NOT create a JS config with `theme.extend` — define the brand tokens in the global stylesheet:

```css
@import "tailwindcss";

@theme {
  --color-lp-orange: #F04B28;  /* accent — sparingly */
  --color-lp-gray:   #323232;  /* dark base */
  --color-lp-taupe:  #DED7CC;  /* warm neutral / softer text */
  --color-lp-slate:  #7AA3AA;  /* only secondary color */
  --font-gotham: "Gotham", "Futura", "Avenir", "Century Gothic", "Helvetica Neue",
                 Helvetica, Calibri, system-ui, sans-serif;
}
```

Utilities then work as `bg-lp-gray`, `text-lp-orange`, `font-gotham`, etc. (Verify exact
`@theme` variable naming against Tailwind v4 docs if anything doesn't resolve — do not guess.)

Apply the `lakepointe-brand` skill's brand-dark rules: page `bg-lp-gray`; cards `bg-[#3c3c3c]`
with `border-lp-taupe/15`; primary text white, secondary `text-lp-taupe`; orange ONLY for the
focal count, active tab, "new" dots, Refresh CTA. No gold `#E8B84B`, no dot-grid, no rainbow of
source colors. Gotham `@font-face` files come from the skill's `assets/fonts/` (web license
confirmed held); the stack above degrades gracefully if fonts are absent. Recharts (if a volume
sparkline is added): skill's `lpChart` dark theme — orange focal, slate secondary, muted taupe
axes.

---

## 8. Per-source reference (verified June–July 2026 — never trusted over live responses)

| Source | Auth | Limits | source_uid | published_at | Coverage |
|---|---|---|---|---|---|
| GDELT (both sweeps) | none | 1 req / 5 s per IP; 250 rec/query; ~3-month search window; `{}` = zero | article URL | seendate | news outlets only |
| Reddit RSS | none | public feed; polite once-daily; VERIFY LIVE | fullname from entry id | entry updated | posts only, weak recall, thin excerpts |
| YouTube Data v3 | API key | 10k units/day project pool; search=100 units | video id | publishedAt | — |
| X / Meta / Web search | — | no free path | — | — | placeholders |

---

## 9. 🚫 FUTURE ROADMAP — DO NOT BUILD UNTIL EXPLICITLY INSTRUCTED

Documented so v1 doesn't foreclose them. Do not implement, scaffold, stub, or add dependencies.
Only permitted action: flag if a v1 decision would make one harder.

- **F1 — Push digest:** Slack webhook / email at end of poll run when new mentions or errors.
  Hook = the orchestrator's summary object (built in v1).
- **F2 — Auth gating:** v1 ships unauthenticated (deliberate). Keep the review-queue write
  route in one place so gating is a one-file change. Gate before the URL circulates.
- **F3 — Bluesky source:** believed free public post-search; UNVERIFIED — confirm current docs
  first. Slots into the poller pattern, no schema change.
- **F4 — Sentiment:** column exists; if ever added, label as hint not truth.
- **F5 — Reddit API upgrade:** only if a developers.reddit.com registration is ever approved
  (community-reported odds: poor). Swap touches one module.
- **F6 — Open-web search (VERIFIED July 2026):** Google CSE JSON API closed to new customers —
  not fixable, do not retry it. Best replacement: **Brave Search API** — free tier eliminated
  Feb 2026; now $5/month auto-credit, ~$5 per 1,000 queries metered, credit card required, NO
  spending cap, attribution required. At this tool's ~60 queries/month (~$0.20–0.30), the
  monthly credit covers usage ~16×. Real independent index; no scraping-lawsuit exposure.
  Serper (2,500 free/month) was evaluated and REJECTED: built on scraped Google results with
  active legal exposure — a rug-pull risk we've already been burned by twice. If F6 is ever
  built: set a Brave usage alert, add the attribution line, and re-verify pricing at build time.

---

## 10. Verification discipline

Everything above marked "verified" was checked against live sources or live API calls in
June–July 2026. Everything marked VERIFY LIVE or UNVERIFIED is a discovery task, not an
implementation instruction. Always confirm live response shapes before committing field
mappings; when reality and this document disagree, reality wins — and tell me.
