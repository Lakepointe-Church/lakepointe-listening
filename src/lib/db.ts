import { neon } from "@neondatabase/serverless";

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
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source        text NOT NULL,
      source_uid    text NOT NULL,
      url           text NOT NULL,
      title         text,
      excerpt       text,
      author        text,
      query_matched text NOT NULL,
      published_at  timestamptz,
      fetched_at    timestamptz NOT NULL DEFAULT now(),
      sentiment     text,
      status        text NOT NULL DEFAULT 'new',
      UNIQUE (source, source_uid)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mention_fetched_idx ON mention (fetched_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_source_idx  ON mention (source)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_status_idx  ON mention (status)`;

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
