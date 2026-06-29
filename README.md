# Lakepointe Listening

Internal brand & name monitoring dashboard. Polls free data sources for mentions
of **"Lakepointe Church"** and **"Josh Howerton"**, normalizes them into Neon
Postgres, and renders a brand-dark dashboard on Vercel.

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS v4, Recharts
- Neon serverless Postgres
- Vercel (Hobby) — one daily cron, plus a manual "Refresh now"

## Data sources

| Source | Auth | Notes |
|---|---|---|
| GDELT DOC 2.0 | none | News/media backbone — no key, no daily cap |
| Reddit | OAuth2 (script) | Posts/comments search, non-commercial use |
| YouTube Data v3 | API key | `search.list`, 2 queries/day |
| Google CSE | API key + cx | 100 queries/day |
| X / Twitter, Meta | — | No free mention API — rendered as "not connected" |

## Build slices

1. **Schema + brand-dark shell** ← current — tables, theme, placeholder tiles.
2. GDELT poller. 3. Reddit. 4. YouTube. 5. Google CSE.
6. X/Meta placeholders + the daily cron orchestrator and Refresh wiring.

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
