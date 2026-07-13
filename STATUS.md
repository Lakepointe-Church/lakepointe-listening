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

**Next action (handoff for a new session):** Show Slice 4 to the user, then
Slice 5 (placeholder tiles exist already; remaining work = `vercel.json` cron
wiring + final look-over). Before the first deployed poll run: the user must
replace the corrupted YOUTUBE_API_KEY on Vercel (see Slice 4 notes). Three
carried-forward loose ends, none blocking: (1) Slice 2's GDELT output still
needs a real 200 response from a network that isn't rate-limited, to confirm
the artlist field shape and the `repeat2`/watchlist-batching open questions.
(2) `npm run lint` fails repo-wide with a pre-existing `TypeError: Converting
circular structure to JSON` inside `eslint-config-next`'s flat-config loading
— predates Slice 3, not yet root-caused; `npx tsc --noEmit` and `npm run
build` both pass clean. (3) Reddit's per-feed result cap is shared across
the OR-combined query (see Slice 3 notes).

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
