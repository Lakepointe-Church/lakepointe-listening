import { neon } from "@neondatabase/serverless";
import type { MentionInput } from "./pollers/types";
import { normalizeUrl } from "./normalizeUrl";

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

  await sql`CREATE INDEX IF NOT EXISTS mention_fetched_idx  ON mention (fetched_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_source_idx   ON mention (source)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_status_idx   ON mention (status)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_norm_url_idx ON mention (normalized_url)`;

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
}

/**
 * Bulk-insert mentions, deduped at the DB level via UNIQUE (source, source_uid).
 * Uses ON CONFLICT DO NOTHING and RETURNING so the row count reflects ONLY
 * actually-inserted (new) rows — that's the `new_mentions` figure. One round
 * trip via UNNEST, regardless of batch size. Returns the new-mention count.
 */
export async function insertMentions(rows: MentionInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sql = getDb();

  const inserted = (await sql.query(
    `INSERT INTO mention
       (source, source_uid, url, normalized_url, title, excerpt, author, query_matched, published_at, title_match, subreddit)
     SELECT * FROM UNNEST(
       $1::text[], $2::text[], $3::text[], $4::text[],
       $5::text[], $6::text[], $7::text[], $8::text[], $9::timestamptz[], $10::boolean[], $11::text[]
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
    ],
  )) as { id: string }[];

  return inserted.length;
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
