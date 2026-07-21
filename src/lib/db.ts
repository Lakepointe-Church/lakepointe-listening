import { neon } from "@neondatabase/serverless";
import type { MentionInput } from "./pollers/types";
import type { ChannelClassification } from "./types";
import { normalizeUrl } from "./normalizeUrl";
import { classifyObituary } from "./exclusions";
import { heuristicClassification } from "./channelHeuristic";

/** Lazily build a Neon SQL client. Throws loudly if the DB URL is unset. */
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }
  return neon(process.env.DATABASE_URL);
}

/** True when a DB connection string is configured (used to gate live reads). */
export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Create the `mention` + `poll_run` tables and their indexes. Idempotent —
 * safe to call on every deploy/poll. The canonical DDL also lives in
 * db/schema.sql; keep the two in sync.
 *
 * Design notes (see db/schema.sql for full rationale):
 *   - Dedup is enforced at the DB level via UNIQUE (source, source_uid); inserts
 *     use ON CONFLICT DO NOTHING and count actually-inserted rows.
 *   - poll_run records an explicit ok|error per source per run so the UI can
 *     distinguish a real failure from a genuine zero (loud failure, not silent).
 */
export async function ensureSchema() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS mention (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source         text NOT NULL,
      source_uid     text NOT NULL,
      url            text NOT NULL,
      normalized_url text,
      title          text,
      excerpt        text,
      author         text,
      query_matched  text NOT NULL,
      published_at   timestamptz,
      fetched_at     timestamptz NOT NULL DEFAULT now(),
      sentiment      text,
      status         text NOT NULL DEFAULT 'new',
      title_match    boolean,
      subreddit      text,
      UNIQUE (source, source_uid)
    )
  `;
  // Pre-existing installs: CREATE TABLE IF NOT EXISTS above is a no-op once
  // the table exists, so new columns need an explicit idempotent ADD.
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS normalized_url text`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS title_match boolean`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS subreddit text`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS excluded_reason text`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS channel_id text`;

  await sql`CREATE INDEX IF NOT EXISTS mention_fetched_idx  ON mention (fetched_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_source_idx   ON mention (source)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_status_idx   ON mention (status)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_norm_url_idx ON mention (normalized_url)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_excluded_idx ON mention (excluded_reason)`;

  await sql`
    CREATE TABLE IF NOT EXISTS poll_run (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source        text NOT NULL,
      ran_at        timestamptz NOT NULL DEFAULT now(),
      status        text NOT NULL,
      new_mentions  integer NOT NULL DEFAULT 0,
      error_message text,
      duration_ms   integer
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS poll_run_source_idx ON poll_run (source, ran_at DESC)`;

  // channel_title is the join key (not channel_id): every historical YouTube
  // row only ever captured the channel title, so title has to stay the
  // reliable, universal identity — channel_id is stored as best-effort extra
  // metadata for rows ingested going forward, not used for matching yet.
  await sql`
    CREATE TABLE IF NOT EXISTS channel_reputation (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_title  text NOT NULL UNIQUE,
      channel_id     text,
      classification text NOT NULL DEFAULT 'unclassified'
        CHECK (classification IN ('owned', 'reupload', 'commentary', 'other-church', 'unclassified')),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Pre-existing installs: widen the CHECK to allow 'other-church' (Slice 6
  // follow-up) — drop-then-add is idempotent and touches no rows.
  await sql`ALTER TABLE channel_reputation DROP CONSTRAINT IF EXISTS channel_reputation_classification_check`;
  await sql`
    ALTER TABLE channel_reputation ADD CONSTRAINT channel_reputation_classification_check
      CHECK (classification IN ('owned', 'reupload', 'commentary', 'other-church', 'unclassified'))
  `;
}

/**
 * Bulk-insert mentions, deduped at the DB level via UNIQUE (source, source_uid).
 * Uses ON CONFLICT DO NOTHING and RETURNING so the row count reflects ONLY
 * actually-inserted (new) rows — that's the `new_mentions` figure. One round
 * trip via UNNEST, regardless of batch size. Returns the new-mention count.
 *
 * Also seeds `channel_reputation` for any brand-new YouTube channel in this
 * batch (ON CONFLICT DO NOTHING — never overwrites a channel a human has
 * already triaged). Owned/reupload-channel exclusion itself is NOT baked
 * into `excluded_reason` here — it's applied via a JOIN at read time (see
 * queries.ts) so reclassifying a channel later retroactively changes
 * visibility for all of its existing rows without a backfill.
 */
export async function insertMentions(rows: MentionInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sql = getDb();

  const inserted = (await sql.query(
    `INSERT INTO mention
       (source, source_uid, url, normalized_url, title, excerpt, author, query_matched, published_at, title_match, subreddit, excluded_reason, channel_id)
     SELECT * FROM UNNEST(
       $1::text[], $2::text[], $3::text[], $4::text[],
       $5::text[], $6::text[], $7::text[], $8::text[], $9::timestamptz[], $10::boolean[], $11::text[], $12::text[], $13::text[]
     )
     ON CONFLICT (source, source_uid) DO NOTHING
     RETURNING id`,
    [
      rows.map((r) => r.source),
      rows.map((r) => r.source_uid),
      rows.map((r) => r.url),
      rows.map((r) => normalizeUrl(r.url)),
      rows.map((r) => r.title),
      rows.map((r) => r.excerpt),
      rows.map((r) => r.author),
      rows.map((r) => r.query_matched),
      rows.map((r) => r.published_at),
      rows.map((r) => r.title_match ?? null),
      rows.map((r) => r.subreddit ?? null),
      rows.map((r) => classifyObituary(r.title, r.domain ?? null)),
      rows.map((r) => r.channel_id ?? null),
    ],
  )) as { id: string }[];

  await seedNewChannels(rows);

  return inserted.length;
}

/** Upsert a heuristic-default row for any YouTube channel not already in channel_reputation. */
async function seedNewChannels(rows: MentionInput[]): Promise<void> {
  const titles = [
    ...new Set(
      rows
        .filter((r) => r.source === "youtube" && r.author)
        .map((r) => r.author as string),
    ),
  ];
  if (titles.length === 0) return;
  const sql = getDb();

  await sql.query(
    `INSERT INTO channel_reputation (channel_title, classification)
     SELECT * FROM UNNEST($1::text[], $2::text[])
     ON CONFLICT (channel_title) DO NOTHING`,
    [titles, titles.map((t) => heuristicClassification(t))],
  );
}

/** Manual triage override — always wins over the ingest-time heuristic. */
export async function setChannelClassification(
  channelTitle: string,
  classification: ChannelClassification,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO channel_reputation (channel_title, classification)
    VALUES (${channelTitle}, ${classification})
    ON CONFLICT (channel_title)
    DO UPDATE SET classification = ${classification}, updated_at = now()
  `;
}

/** Record one poll_run row (the loud ok|error health signal for a source). */
export async function recordPollRun(run: {
  source: string;
  status: "ok" | "error";
  new_mentions: number;
  error_message: string | null;
  duration_ms: number;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO poll_run (source, status, new_mentions, error_message, duration_ms)
    VALUES (${run.source}, ${run.status}, ${run.new_mentions}, ${run.error_message}, ${run.duration_ms})
  `;
}
