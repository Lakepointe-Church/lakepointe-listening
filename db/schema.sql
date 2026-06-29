-- ════════════════════════════════════════════════════════════════════════════
-- Lakepointe Listening Dashboard — Neon Postgres schema (canonical DDL).
--
-- Two tables:
--   mention   — one row per discovered mention, deduped across runs.
--   poll_run  — one row per source per poll run; this is what makes the UI able
--               to tell SUCCEEDED vs FAILED vs returned-zero ("loud failure").
--
-- Keep this file in sync with ensureSchema() in src/lib/db.ts — both are
-- idempotent and safe to re-run on every deploy.
-- ════════════════════════════════════════════════════════════════════════════

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
  sentiment     text,                   -- NULL for v1 (deferred); kept for forward-compat
  status        text NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'dismissed'
  UNIQUE (source, source_uid)
);

CREATE INDEX IF NOT EXISTS mention_fetched_idx ON mention (fetched_at DESC);
CREATE INDEX IF NOT EXISTS mention_source_idx  ON mention (source);
CREATE INDEX IF NOT EXISTS mention_status_idx  ON mention (status);

-- One row per source per poll run — how the UI knows a source SUCCEEDED vs
-- FAILED vs returned zero. This table is what makes "loud failure" real.
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
