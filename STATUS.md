# STATUS — Master Project Tracker

Master tracking file for Lakepointe internal tooling projects. One entry per project.
Last updated: 2026-07-10.

---

## Listening Dashboard (Tool 1)

**Status:** Spec complete (REV 4), repo scaffolded, build in progress with
Claude Code. Slice 1 (reconciliation) and Slice 2 (GDELT keyword + watchlist
sweeps) are committed. Slice 3 (Reddit RSS poller) is built and verified live,
not yet committed — see handoff note below.

**Pre-build setup checklist:**

- [x] YouTube Data v3 API key (`listening-dashboard` key, Google Cloud project
      `lakepointe-social-dashboard` — rotated after accidental exposure)
- [x] Neon Postgres database
- [x] Repo creation
- [x] `CRON_SECRET` generated
- [x] Curated watchlist domain research (`search-domains.md`) and disambiguation
      dataset (`lakepointe-disambiguation.md`) delivered
- ~~Reddit app~~ — dropped: Reddit's Responsible Builder Policy killed self-serve
  OAuth app creation. Reddit is now polled via public `search.rss`, no credentials.
- ~~Google CSE~~ — dropped: Google closed the Custom Search JSON API to new
  projects. Its watchlist role moved into a second GDELT sweep using
  `domainis:` operators against the curated domain list.

**Key decisions:**

- Free-tier, DIY sources: GDELT (keyword + watchlist sweep) / Reddit RSS / YouTube.
- Once-daily Vercel Hobby cron accepted (no more frequent polling on Hobby tier).
- Sentiment analysis is OUT for v1.
- X / Meta / open-web search rendered as placeholder ("not connected") tiles;
  Brave Search API is the leading open-web-search candidate if ever built (F6,
  not started).

**Build progress:**

- [x] Slice 1 — reconciliation (stale docs, `normalized_url` schema migration,
      source roster, brand-dark shell). Commit `12d334c`.
- [x] Slice 2 — GDELT keyword sweep + watchlist sweep, shared rate-limited
      client, `normalized_url` computed on every insert. Commit `f02936c`.
      **Unverified caveat (carried forward, see handoff below):** could not
      get a live 200 response from GDELT this session (429s / timeouts even
      with 20s+ spacing — looked like a saturated sandbox egress IP, not our
      own rate). Shipped the documented conservative fallbacks: phrase-only
      queries (no `repeat2`) and 3 batches of 20 domains for the watchlist
      OR-chain. **Needs a real live check before the first live cron run** —
      either from the deployed Vercel function or a different network.
- [x] Slice 3 — Reddit poller (public RSS), built and live-verified this
      session (unlike Slice 2, this network could reach Reddit fine). Live
      findings that changed the implementation from REV 4's literal text:
      - The feed mixes result kinds: `<id>` entries prefixed `t5_` are
        subreddit/community results, not posts — only `t3_`-prefixed entries
        are posts. Filtered out in `reddit.ts`.
      - No official rate-limit docs, but live responses carry
        `x-ratelimit-*` headers and a request made ~2s after a prior one
        (within the ~50-60s reset window) came back **HTTP 200 with a
        completely empty body** — not a 429. `fast-xml-parser` silently
        parses that to `{}`, so `reddit-client.ts` treats a missing `feed`
        key as a loud error, distinct from "valid feed, no `<entry>`" (a
        genuine zero).
      - Switched to **one OR-combined query covering all of KEYWORDS**
        instead of one call per keyword (GDELT's pattern) — the ~50-60s
        throttle window would blow the 60s per-source budget across 3 calls.
        Spot-checked live that the combined query surfaces real matches for
        all three terms. Trade-off: Reddit's ~22-24-result-per-feed cap is
        now shared across all three terms instead of each having its own —
        flagged, not solved.
      - `query_matched` is recovered post-hoc by checking which KEYWORDS
        phrase (or the church/Howerton/Lakepointe noise-filter heuristic)
        actually appears in the title+body, since Reddit doesn't report
        which OR clause matched.
      - `<updated>` is already ISO 8601 with an offset — no custom date
        parsing needed, unlike GDELT's `seendate`.
      Added `fast-xml-parser@5.10.0` (option names confirmed against the
      installed package's type defs, not memory). Uncommitted — same
      show-before-commit checkpoint as prior slices.
- [x] Slice 4 — YouTube poller, built and live-verified end-to-end this
      session (real search.list 200s for all three keywords; 59 mentions
      mapped cleanly, 0 rows missing required fields). Live findings:
      - `search.list` returns HTML-escaped titles/descriptions (`&amp;`,
        `&#39;` — 8 of 45 live titles). Decoded via the shared
        `decodeEntities` before storing.
      - The API returns fewer items than `maxResults` (45 of a claimed 76
        totalResults at maxResults=50). One page only per the spec — no
        pagination.
      - Added `server-only` as a real dependency (Next aliases it internally,
        but standalone test scripts need the actual package).
      **Env-var saga, important for future sessions:** ALL env vars on this
      Vercel project are `sensitive`-type — write-only. `vercel env pull`
      returns empty strings for every secret BY DESIGN (this misled an
      entire debugging session; the values were often fine). Local dev needs
      secrets placed in `.env.local` by hand. Separately, the YouTube key in
      the user's notes was hand-transcribed and corrupted (ALza vs AIza, plus
      at least one more invisible typo) — the working key came from a fresh
      copy-paste out of Google Cloud Console. ⚠️ At the time of writing, the
      YOUTUBE_API_KEY stored on Vercel is still the corrupted notes version
      and MUST be replaced (fresh console copy, via
      `cat keyfile | vercel env add ...`) before the first deployed poll run.
      Uncommitted — show-before-commit checkpoint.
- [ ] Slice 5 — X/Meta/Web-search placeholder tiles + cron wiring. **Partially
      pre-built, uncommitted, in the working tree**: `src/app/actions.ts`,
      `src/app/api/cron/poll/route.ts`, `src/lib/poll/orchestrator.ts`, and
      wiring in `src/app/page.tsx` / `src/components/RefreshButton.tsx`. This
      code is source-agnostic (iterates the `POLLERS` registry generically) so
      it's already compatible with the two GDELT pollers — it was just built
      before the reconciliation and never committed. Needs `vercel.json` (cron
      schedule) still, and a look-over once Slices 3–4 land before committing
      as Slice 5.

**First deployed poll run (2026-07-13, via Refresh now) — findings & fixes:**
All four sources failed loudly (the error-banner design worked exactly as
intended). Diagnosis and outcomes:

- **GDELT watchlist:** rejected with "Your query was too short or too long" —
  that's GDELT's generic PARSE error, not a length limit. Root cause: REV4's
  example query double-parenthesizes the term group, and GDELT's docs state
  "Boolean OR blocks cannot be nested at this time." Fixed: one level of
  parens per OR group, plus adaptive batch-halving if a genuine length limit
  ever surfaces (none is documented; no vantage point available to bisect —
  GDELT 429s every shared egress IP we can reach from here). Watchlist poller
  got a `budgetMs` override (150s) for the worst-case splitting path.
- **GDELT keyword sweep:** 429 on first call — intermittent collision on
  Vercel's shared egress IP (the watchlist call got through 5.5s later, so
  the IP is not permanently saturated). No code change; spec forbids
  retry-hammering. Expect occasional one-run GDELT misses; chronic misses
  would justify an external scheduler (the route design already supports it).
- **Reddit:** 403 block page from Vercel — Reddit blocks datacenter IPs for
  unauthenticated requests (works from residential; verified both live).
  USER DECISION 2026-07-13: demoted to placeholder tile ("blocked from cloud
  IPs"). Poller code stays, live-verified; re-enable = flip `kind` in
  config/sources.ts + re-add to POLLERS registry. queries.ts now gives
  unavailable sources a static "never" state so Reddit's stale error
  poll_run can't trip the banner forever.
- **YouTube:** "API key not valid" — the user's dashboard swap didn't hold a
  valid value (same hand-transcription problem as before). The old entries
  were REMOVED from Vercel; the user must re-add from the verified-good
  local .env.local value via
  `awk -F= '/^YOUTUBE_API_KEY/{v=substr($0,index($0,"=")+1); gsub(/^"|"$/,"",v); printf "%s", v}' .env.local | vercel env add YOUTUBE_API_KEY production`
  (and again with `preview`). Env changes need a redeploy to take effect.
- Also fixed earlier the same day: production 500 (digest 115513156) on
  every page load — fresh DB had no tables since ensureSchema() only ran
  inside polls. getDashboardData now self-heals on Postgres 42P01 only.

**Second deployed run (2026-07-13):** YouTube fully live (53 mentions);
Reddit demotion clean; watchlist query no longer parse-rejected (nesting fix
verified in production — its failure became a plain 429). Both GDELT sweeps
lost the shared-egress-IP 429 lottery, and the keyword sweep's kw-1 data was
discarded when kw-2 threw. Two follow-up changes:

- **Partial success now persists:** Poller contract returns
  `{ mentions, error? }`; a mid-sweep failure keeps everything fetched
  before it AND records a loud error poll_run. Orchestrator inserts before
  checking error.
- **One polite 429 retry (DELIBERATE REV4 DEVIATION, per its Section 10):**
  REV4 said "on 429 stop GDELT for this run," assuming the 429 meant our own
  rate. Both deployed runs proved the 429s are collisions with other tenants
  on Vercel's shared egress IP (each ≥5.5s-spaced call independently wins or
  loses). gdelt-client now retries ONCE per call after 20s; a second 429
  aborts the sweep loudly. Never a hammer. GDELT pollers' budgets raised
  (120s / 150s) for the retry worst case; total run stays under the 300s cap.

**Third deployed run (2026-07-14):** YouTube green (queue 53→80); the 20s
retry and partial persistence worked as designed — but GDELT still failed
from iad1 (keyword sweep 429'd through its retry; watchlist then got a
dropped connection, "fetch failed"). Three runs = iad1's shared egress IPs
are saturated with other tenants' GDELT traffic around the clock. Fix
shipped: all functions pinned to cle1 (low tenant density, ~30ms from
GDELT) via `vercel.json` `regions` — NOTE: `preferredRegion` in the route
file did NOT work (Node functions ignore it; it's Edge-runtime-only;
verified via x-vercel-id still showing iad1). `refreshNow` proxies to the
poll route server-to-server with the Bearer secret so manual + cron polls
share one entry point/code path. Locally (no VERCEL env) refreshNow runs
pollers in-process. If cle1's IPs turn out saturated too, next levers:
another quiet region, or an external scheduler hitting the route from a
non-datacenter IP.

- [x] Slice 5 — placeholder tiles (done earlier) + cron wiring: vercel.json
      now sets `crons` (`0 13 * * *` → GET /api/cron/poll, ~8am Central
      after Hobby's ±59min jitter) and `regions: ["cle1"]`. v1 wiring
      complete.

**Next action (handoff for a new session):** Refresh now again — expect all
three live tiles green now that polling runs from cle1 (verify via
x-vercel-id on /api/cron/poll showing ::cle1::). Then confirm the first
scheduled cron run lands (~8am Central) and v1 is done. Then Slice 5 wrap-up:
`vercel.json` cron wiring + final look-over. Carried loose ends: (1)
`repeat2:` query variant still unverified (needs a GDELT 200 from a testable
vantage). (2) `npm run lint` fails repo-wide (pre-existing eslint-config-next
circular-JSON error); tsc + build pass. (3) Reddit's per-feed cap note from
Slice 3 is moot while demoted.

---

## Live Free Content Recommender (Tool 2)

**Status:** Spec complete (REV 2, standalone-repo decision), pushed to Notion.

**Blocked on:**

- Transcript format confirmation — *unknown*. Could be a scope change if the input turns out to be raw audio rather than text transcripts.
- Tool 1's pollers existing to copy from.

**Key decisions:**

- Lightweight keyword profile (no CSE).
- YouTube capped at 5 terms, sharing a quota ledger with Tool 1.
- Scoring constants are untuned defaults for now.

**Next action:** After Tool 1 Slices 1–3 exist, obtain sample transcripts.
