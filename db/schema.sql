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
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL,          -- 'gdelt' | 'gdelt_watchlist' | 'reddit' | 'youtube' | 'google_news'
  source_uid     text NOT NULL,          -- platform-native stable id (e.g. reddit fullname 't3_xxx')
  url            text NOT NULL,
  normalized_url text,                   -- canonicalized URL for cross-source duplicate grouping
  title          text,
  excerpt        text,
  author         text,
  query_matched  text NOT NULL,          -- which keyword (or 'watchlist') produced this row
  published_at   timestamptz,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  sentiment      text,                   -- NULL for v1 (deferred); kept for forward-compat
  status         text NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'dismissed'
  title_match    boolean,                -- google_news only: keyword found in title (UI sort hint, never a filter)
  subreddit      text,                   -- reddit only: bare subreddit name from <category term>
  excluded_reason text,                  -- Slice 6: 'obituary' | NULL. Never delete rows — additive, auditable.
  channel_id     text,                   -- Slice 6, youtube only: captured going forward; legacy rows have none
  UNIQUE (source, source_uid)
);

-- Migration for pre-existing installs (CREATE TABLE IF NOT EXISTS above is a
-- no-op once the table exists, so new columns need an explicit ADD).
ALTER TABLE mention ADD COLUMN IF NOT EXISTS normalized_url text;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS title_match boolean;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS subreddit text;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS excluded_reason text;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS channel_id text;

CREATE INDEX IF NOT EXISTS mention_fetched_idx  ON mention (fetched_at DESC);
CREATE INDEX IF NOT EXISTS mention_source_idx   ON mention (source);
CREATE INDEX IF NOT EXISTS mention_status_idx   ON mention (status);
CREATE INDEX IF NOT EXISTS mention_norm_url_idx ON mention (normalized_url);
CREATE INDEX IF NOT EXISTS mention_excluded_idx ON mention (excluded_reason);

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

-- YouTube channel-reputation triage (Slice 6). channel_title is the join key
-- (not channel_id): every historical row only ever captured the channel
-- title, so title stays the reliable, universal identity; channel_id is
-- best-effort extra metadata for rows ingested going forward.
CREATE TABLE IF NOT EXISTS channel_reputation (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_title  text NOT NULL UNIQUE,
  channel_id     text,
  classification text NOT NULL DEFAULT 'unclassified'
    CHECK (classification IN ('owned', 'reupload', 'commentary', 'other-church', 'unclassified')),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
