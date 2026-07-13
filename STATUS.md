# STATUS — Master Project Tracker

Master tracking file for Lakepointe internal tooling projects. One entry per project.
Last updated: 2026-07-10.

---

## Listening Dashboard (Tool 1)

**Status:** Spec complete (REV 4), repo scaffolded, build in progress — Slice 1
(reconciliation) underway with Claude Code.

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

**Next action:** Complete Slice 1 reconciliation (stale docs, schema migration,
brand-dark shell), then proceed through Slices 2–5 per the REV 4 prompt.

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
