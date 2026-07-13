# Lakepointe Listening

Internal brand & name monitoring dashboard. Polls free data sources for mentions
of **"Lakepointe Church"** / **"Lake Pointe Church"** and **"Josh Howerton"**,
normalizes them into Neon Postgres, and renders a brand-dark dashboard on Vercel.

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS v4, Recharts
- Neon serverless Postgres
- Vercel (Hobby) — one daily cron, plus a manual "Refresh now"

## Data sources

| Source | Auth | Notes |
|---|---|---|
| GDELT keyword sweep | none | News outlets only — the tripwire backbone |
| GDELT watchlist sweep | none | `domainis:` OR-list from the curated domain research |
| Reddit | none (public RSS) | Posts only, via `search.rss` — self-serve OAuth apps are dead |
| YouTube Data v3 | API key | `search.list`, 3 queries/day (one per keyword) |
| X / Twitter, Meta, Web search | — | No free mention-search API — rendered as "not connected" |

Google CSE was evaluated and dropped (Google closed the Custom Search JSON API
to new projects) — its watchlist role is covered by the GDELT watchlist sweep.
Open-web search beyond that is future roadmap (see the build prompt, F6).

## Env vars

Exactly three:

- `DATABASE_URL` — Neon connection string
- `YOUTUBE_API_KEY` — Google Cloud project `lakepointe-social-dashboard`
- `CRON_SECRET` — guards the poll route

No Reddit credentials, no Google CSE key/cx.

## Build slices

1. **Reconciliation + schema + brand-dark shell** ← current — tables, theme,
   placeholder tiles for every source in the roster above.
2. GDELT pollers (keyword sweep + watchlist sweep).
3. Reddit (public RSS).
4. YouTube.
5. X/Meta/Web-search placeholders + the daily cron orchestrator and Refresh wiring.

Full build spec: [`new-listening-dashboard-claude-code-prompt.md`](new-listening-dashboard-claude-code-prompt.md).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL etc.
npm run dev
```

The schema lives in [`db/schema.sql`](db/schema.sql) and is mirrored by
`ensureSchema()` in [`src/lib/db.ts`](src/lib/db.ts) (idempotent).

## Operating principles

- **Verified-only data** — confirm live response shapes before mapping fields.
- **Loud failure over silent zeros** — every source writes an `ok | error`
  `poll_run` row; failures surface in a banner, never as a fake zero.
- **Partial success is success** — sources run sequentially and persist
  immediately; one failing never blanks the dashboard.
- **Placeholder-first** — unavailable sources render as visible "not connected"
  tiles, never hidden.
