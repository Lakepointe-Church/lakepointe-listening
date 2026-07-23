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
  -- Stored values: 'obituary' | 'manual' | NULL (mention_excluded_reason_check,
  -- Slice 7). Entity-classification exclusions (owned/reupload/wrong-entity)
  -- are NEVER stored here — derived live via the entity_reputation JOIN in
  -- queries.ts, so reclassifying an entity retroactively changes visibility
  -- for all of its rows with zero backfill. Never delete rows — additive, auditable.
  excluded_reason text,
  channel_id     text,                   -- Slice 6, youtube only: captured going forward; legacy rows have none
  domain         text,                   -- Slice 7, google_news only: publisher domain, for entity classification
  UNIQUE (source, source_uid)
);

-- Migration for pre-existing installs (CREATE TABLE IF NOT EXISTS above is a
-- no-op once the table exists, so new columns need an explicit ADD).
ALTER TABLE mention ADD COLUMN IF NOT EXISTS normalized_url text;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS title_match boolean;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS subreddit text;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS excluded_reason text;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS channel_id text;
ALTER TABLE mention ADD COLUMN IF NOT EXISTS domain text;

-- Slice 7: one-time backfill of `domain` for pre-existing Google News rows,
-- parsed from the "via {domain}" free text baked into `excerpt` (the only
-- place the domain survived before this column existed). Idempotent — only
-- touches rows still NULL. Verified live 2026-07-21: 197/197 existing rows
-- parsed cleanly, 0 held back as NULL.
UPDATE mention
SET domain = substring(excerpt from 'via (.+)$')
WHERE source = 'google_news' AND domain IS NULL AND excerpt ~ '^via ';

-- Slice 7: constrain the previously-unconstrained excluded_reason column now
-- that its only stored values are known ('obituary', and new 'manual' for the
-- per-item exclude escape hatch). Entity-derived reasons are never stored, so
-- they don't need to be in this list. Drop-then-add is idempotent.
ALTER TABLE mention DROP CONSTRAINT IF EXISTS mention_excluded_reason_check;
ALTER TABLE mention ADD CONSTRAINT mention_excluded_reason_check
  CHECK (excluded_reason IN ('obituary', 'manual') OR excluded_reason IS NULL);

CREATE INDEX IF NOT EXISTS mention_fetched_idx  ON mention (fetched_at DESC);
CREATE INDEX IF NOT EXISTS mention_source_idx   ON mention (source);
CREATE INDEX IF NOT EXISTS mention_status_idx   ON mention (status);
CREATE INDEX IF NOT EXISTS mention_norm_url_idx ON mention (normalized_url);
CREATE INDEX IF NOT EXISTS mention_excluded_idx ON mention (excluded_reason);
CREATE INDEX IF NOT EXISTS mention_domain_idx   ON mention (domain);

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

-- YouTube channel-reputation triage (Slice 6). SUPERSEDED by entity_reputation
-- below (Slice 7) — kept in place, untouched, as the Slice 7 migration source
-- until the entity_reputation read path is verified in production; a cleanup
-- migration to drop this table is a separate, later approval.
CREATE TABLE IF NOT EXISTS channel_reputation (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_title  text NOT NULL UNIQUE,
  channel_id     text,
  classification text NOT NULL DEFAULT 'unclassified'
    CHECK (classification IN ('owned', 'reupload', 'commentary', 'other-church', 'unclassified')),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Slice 7: entity-reputation triage generalized beyond YouTube channels to
-- any (source, entity_key) pair — Reddit (bare author string, as stored,
-- "/u/" prefix included) and Google News (publisher domain) join Youtube
-- (channel title, unchanged) under one mechanism. `other-church` is retired;
-- `wrong-entity` is the one "this isn't us" category going forward.
CREATE TABLE IF NOT EXISTS entity_reputation (
  source         text NOT NULL CHECK (source IN ('youtube', 'reddit', 'google_news')),
  entity_key     text NOT NULL,
  classification text NOT NULL DEFAULT 'unclassified'
    CHECK (classification IN ('owned', 'reupload', 'commentary', 'wrong-entity', 'unclassified')),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, entity_key)
);

CREATE INDEX IF NOT EXISTS entity_reputation_source_idx ON entity_reputation (source);

-- One-time migration of existing channel_reputation rows into
-- entity_reputation, rewriting other-church -> wrong-entity. Idempotent via
-- ON CONFLICT DO NOTHING — safe to re-run every deploy.
INSERT INTO entity_reputation (source, entity_key, classification, updated_at)
SELECT 'youtube', channel_title,
       CASE WHEN classification = 'other-church' THEN 'wrong-entity' ELSE classification END,
       updated_at
FROM channel_reputation
ON CONFLICT (source, entity_key) DO NOTHING;
