# Claude Code Build Prompt — Lakepointe Listening Dashboard (Tool 1)

> Internal brand/name monitoring dashboard. Polls free data sources for mentions of
> **"Lakepointe Church"** and **"Josh Howerton"**, normalizes them into Neon Postgres,
> and renders a brand-dark dashboard on Vercel. Build in the vertical-slice order below.
> **Show me each slice before committing.**

---

## 0. Operating principles (apply throughout — these are non-negotiable)

1. **Verified-only data.** Do not invent API field names, response shapes, or endpoints. Where a
   field name is uncertain, log the raw response first and confirm the shape against live data
   before mapping it. Flag anything you're inferring.
2. **Loud failure over silent zeros.** An API error must be visibly distinct from a genuine
   "zero new mentions." Never swallow errors. No `Promise.allSettled` + silent coercion to `[]`.
   Each source records an explicit `ok | error` status per run, surfaced in the UI.
3. **Partial success is success.** Sources run sequentially; if source #4 fails, sources #1–3 are
   already persisted. One source failing never blanks the dashboard or aborts the run.
4. **Placeholder-first.** Ship visible placeholder tiles for unbuilt/unavailable sources rather
   than hiding them. X/Twitter and Meta render as "No free API path — not connected" tiles.
5. **Show before commit.** At each slice, show the diff/output and wait for approval before
   committing.

---

## 1. Stack & environment (already in use — match it)

- Next.js (App Router), React 19, Tailwind CSS, Recharts
- Neon Postgres (serverless), Vercel (Hobby plan), GitHub `plafatas-projects` org
- Env vars to expect (do not hardcode secrets):
  - `DATABASE_URL` (Neon)
  - `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME` (for User-Agent)
  - `YOUTUBE_API_KEY`
  - `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX`
  - `CRON_SECRET` (to authenticate the cron route)

---

## 2. ⚠️ Vercel Hobby cron constraint — design around this

Verified limits on Hobby (June 2026): **100 cron jobs per project, but each runs at most once
per day**; cron timing has **±59 min jitter**; cron-triggered functions are capped at a
**300-second (5-min) execution limit**.

**Therefore:**
- ONE cron job, declared in `vercel.json`, scheduled `0 13 * * *` (~8am Central after jitter).
- It calls ONE route: `GET /api/cron/poll` (guarded by `CRON_SECRET` via the `Authorization`
  header — Vercel sends this automatically for configured crons).
- The route runs all sources **sequentially** with a **per-source time budget** (~60s each) so the
  total stays safely under 300s. Persist each source's results **immediately** after it completes —
  do not batch all writes to the end. If a source exceeds its budget or throws, record an `error`
  run-status row for it and move on.
- **Do not** attempt sub-daily polling via Vercel Cron on Hobby — it isn't supported. Keep the poll
  logic entirely inside the HTTP route so an external scheduler (GitHub Actions / cron-job.org) can
  later hit the same route for higher frequency without an architecture change. Add a brief comment
  to that effect in the route.
- Also expose a manual **"Refresh now"** button in the UI that POSTs to the same poll route
  (guarded), so staff can trigger an on-demand pull without waiting for the daily cron.

---

## 3. Data model (Neon) — build this FIRST, before any poller

Two tables.

```sql
-- One row per discovered mention, deduped across runs.
CREATE TABLE IF NOT EXISTS mention (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,          -- 'gdelt' | 'reddit' | 'youtube' | 'google_cse'
  source_uid    text NOT NULL,          -- platform-native stable id (e.g. reddit fullname 't3_xxx')
  url           text NOT NULL,
  title         text,
  excerpt       text,
  author        text,
  query_matched text NOT NULL,          -- 'lakepointe church' | 'josh howerton'
  published_at  timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  sentiment     text,                   -- NULL for v1 (deferred); keep column for forward-compat
  status        text NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'dismissed'
  UNIQUE (source, source_uid)
);

CREATE INDEX IF NOT EXISTS mention_fetched_idx  ON mention (fetched_at DESC);
CREATE INDEX IF NOT EXISTS mention_source_idx   ON mention (source);
CREATE INDEX IF NOT EXISTS mention_status_idx   ON mention (status);

-- One row per source per poll run — this is how the UI knows a source SUCCEEDED vs FAILED
-- vs returned zero. This table is what makes "loud failure" real.
CREATE TABLE IF NOT EXISTS poll_run (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,
  ran_at        timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL,          -- 'ok' | 'error'
  new_mentions  integer NOT NULL DEFAULT 0,
  error_message text,                   -- populated when status='error'
  duration_ms   integer
);

CREATE INDEX IF NOT EXISTS poll_run_source_idx ON poll_run (source, ran_at DESC);
```

Dedup is enforced at the DB level via `UNIQUE (source, source_uid)`. Inserts use
`ON CONFLICT (source, source_uid) DO NOTHING` and count actually-inserted rows for `new_mentions`.

---

## 4. Build order (vertical slices — show me each before commit)

### Slice 1 — Schema + skeleton + brand-dark shell
- Apply the SQL above to Neon.
- Scaffold the Next.js dashboard shell with the brand-dark theme (Section 6) and **all source
  tiles as placeholders** showing "not yet polled." Nothing live yet. This proves the theme and
  layout before any data.

### Slice 2 — GDELT poller (the backbone: no key, no daily cap)
- Endpoint: `https://api.gdeltproject.org/api/v2/doc/doc`
- Params: `query="Lakepointe Church"` (and a second call for `"Josh Howerton"`),
  `mode=artlist`, `format=json`, `maxrecords=250`, `timespan=1d` on the daily run.
- **Required:** send a real browser-style `User-Agent` header — GDELT returns rate-limit errors
  without one. (Verified: GDELT throttles requests lacking a User-Agent.)
- Use the `repeat` operator to require the keyword appear ≥2 times, reducing false positives from
  the many unrelated "Lakepointe" places nationwide. Confirm the exact query syntax against a live
  test call and show me the raw JSON shape before mapping fields.
- Map to `mention`. GDELT artlist returns `url`, `title`, `seendate`, `domain`, `socialimage`,
  `language`, `sourcecountry` — confirm empirically. Use the article `url` as `source_uid` (GDELT
  has no stable per-article id; URL is the dedup key).
- Write a `poll_run` row (`ok`/`error`) for GDELT.
- Render the GDELT tile + feed live. **This is the first working dashboard — stop and show me.**

### Slice 3 — Reddit poller (toggled ON; internal non-commercial use)
- OAuth2 client-credentials (script app). 60 req/min free ceiling — far more than needed.
- **Required User-Agent format** (Reddit throttles hard without it):
  `web:lakepointe-listening:v1.0 (by /u/<REDDIT_USERNAME>)`
- Search both keywords via `/search` (sort=new, restrict_sr=false, limit=100). Confirm response
  shape live before mapping.
- `source_uid` = Reddit fullname (e.g. `t3_abc123` for posts). Map `title`, `selftext`→`excerpt`,
  `author`, `permalink`→`url` (prefix with `https://reddit.com`), `created_utc`→`published_at`.
- Light noise filter: keep results whose text mentions "church" or "Howerton" near "Lakepointe"
  to cut unrelated place-name hits.
- **ToS note in code comment:** non-commercial internal use; do not treat the Neon copy as a
  permanent public archive (Reddit ToS expects removal of content later deleted on Reddit). Low
  stakes for internal monitoring, but note it.
- `poll_run` row + live tile. Show me.

### Slice 4 — YouTube poller (quota-aware)
- `search.list` (`part=snippet`, `q=<keyword>`, `type=video`, `order=date`, `maxResults=50`).
- **Verified quota:** 10,000 units/day; `search.list` costs 100 units. Two keyword searches per
  daily run = 200 units. Trivially within budget; do NOT add per-video or comment calls (quota-
  expensive) in v1.
- `source_uid` = video id. Map `title`, `description`→`excerpt`, `channelTitle`→`author`,
  `publishedAt`→`published_at`, watch URL from video id. Confirm shape live first.
- `poll_run` row + live tile. Show me.

### Slice 5 — Google Programmable Search (CSE) poller
- **Verified quota:** 100 queries/day free. Use sparingly — one query per keyword per daily run.
- `https://www.googleapis.com/customsearch/v1?key=<KEY>&cx=<CX>&q=<keyword>`
- `source_uid` = result `link` (no stable id; URL is the dedup key). Map `title`, `snippet`→
  `excerpt`, `link`→`url`. CSE has no reliable published date — leave `published_at` NULL.
- `poll_run` row + live tile. Show me.

### Slice 6 — X / Meta placeholder tiles + the cron wiring
- Render X (Twitter) and Meta (Facebook/Instagram) tiles as **"No free API path — not connected."**
  Do NOT fake data. (Verified: no viable free mention-search exists for these.)
- Wire `vercel.json` cron (Section 2) and the `/api/cron/poll` orchestrator that runs Slices 2–5
  sequentially with per-source budgets and incremental persistence.
- Wire the manual "Refresh now" button to the same guarded poll route.

---

## 5. Dashboard UI (brand-dark)

Three views/tabs:

1. **Feed** — reverse-chronological mentions. Each card: source badge, title (links out), excerpt,
   author, published date, matched keyword. Filters: source, keyword, status. A **loud error
   banner** at top if any source's most-recent `poll_run` was `error` ("GDELT poll failed at
   8:04am — showing last good data").
2. **By source** — for each source: last-run timestamp, last-run status (ok/error/zero), and new-
   mentions count. This is the at-a-glance health view; a stale or failed source must be obvious.
3. **Review queue** — mentions with `status='new'`; buttons to mark `reviewed` or `dismissed`
   (this is the "keep an eye on it" workflow). Optimistic UI, persisted to Neon.

Sentiment is **out for v1** (column exists, stays NULL, no UI). Do not add sentiment scoring.

---

## 6. Brand-dark theme (Lakepointe) — exact tokens, apply via the brand skill

Use the `lakepointe-brand` skill. Mode: **brand-dark**. Apply the orange-on-neutral rule:
dark-gray surfaces, orange reserved for what matters (active states, the focal count, key CTAs),
slate as the only secondary color. **No** gold `#E8B84B`, no dot-grid, no rainbow of source colors.

**Tailwind `theme.extend` (merge in):**
```js
colors: {
  lp: {
    orange: "#F04B28", // accent / pop — sparingly
    gray:   "#323232", // dark base, text, structure
    taupe:  "#DED7CC", // warm neutral / softer text in dark mode
    slate:  "#7AA3AA", // complementary support color
  },
},
fontFamily: {
  gotham: ["Gotham","Futura","Avenir","Century Gothic","Helvetica Neue","Helvetica","Calibri","system-ui","sans-serif"],
},
```

**Brand-dark surface usage:**
- Page background: `bg-lp-gray` (`#323232`)
- Cards/surfaces: lifted gray `bg-[#3c3c3c]` with border `border-lp-taupe/15`
- Primary text: `text-white`; softer/secondary text: `text-lp-taupe`
- Accent: `text-lp-orange` (replaces any legacy gold). Use it for the focal mention count, active
  tab, "new" status dots, and the Refresh CTA — not for large fills.

**Gotham fonts:** copy `assets/fonts/` from the skill into the project's public font dir and add the
`@font-face` block from the skill's `references/typography.css`, fixing `url()` paths.
**License note:** Gotham web embedding needs a web license — the team has confirmed one is held, so
embedding is fine. If that ever changes, the fallback stack above degrades to system fonts.

**Recharts (if/when charts are added — e.g. a mentions-over-time line on By Source):** use the
skill's `lpChart` dark theme object. Orange = focal series, slate = secondary, muted taupe axes/grid.
For v1 the dashboard may ship without charts; if you add a volume sparkline, theme it this way.

---

## 7. Per-source reference (verified June 2026 — for your sanity-checking, not to be trusted over live responses)

| Source | Auth | Free limit | source_uid | published_at |
|---|---|---|---|---|
| GDELT DOC 2.0 | none | rate-limited, no daily cap, 250 rec/query, needs User-Agent | article URL | seendate |
| Reddit | OAuth2 (script) | 60 req/min; non-commercial | fullname (t3_…) | created_utc |
| YouTube Data v3 | API key | 10k units/day; search.list=100 units | video id | publishedAt |
| Google CSE | API key + cx | 100 queries/day | result link | (none — NULL) |
| X / Meta | — | no free mention-search | — | — |

Always confirm the live response shape before committing field mappings. If any source's real
response differs from the table above, trust the live response and tell me.
