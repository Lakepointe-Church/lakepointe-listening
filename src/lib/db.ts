import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import type { MentionInput } from "./pollers/types";
import type { EntityClassification, ManualSourceType } from "./types";
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
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS domain text`;
  // Slice 9 (manual mention submission) — all unused by polled sources.
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS source_detail text`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS manual_source_type text`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS submitted_by text`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS indirect boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE mention ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT '{}'`;
  // Manual facebook-group entries may have no URL (note required instead).
  await sql`ALTER TABLE mention ALTER COLUMN url DROP NOT NULL`;
  await sql`ALTER TABLE mention DROP CONSTRAINT IF EXISTS mention_manual_source_type_check`;
  await sql`
    ALTER TABLE mention ADD CONSTRAINT mention_manual_source_type_check
      CHECK (manual_source_type IN ('facebook-group', 'x', 'newsletter', 'news-article', 'podcast', 'other')
             OR manual_source_type IS NULL)
  `;

  // Slice 7: one-time backfill of `domain` for pre-existing Google News rows,
  // parsed from the "via {domain}" text baked into `excerpt` (the only place
  // the domain survived before this column existed). Idempotent (WHERE
  // domain IS NULL) — safe to re-run every deploy.
  await sql`
    UPDATE mention
    SET domain = substring(excerpt from 'via (.+)$')
    WHERE source = 'google_news' AND domain IS NULL AND excerpt ~ '^via '
  `;

  // Slice 7: constrain excluded_reason now that its only stored values are
  // known ('obituary', and new 'manual' for the per-item exclude escape
  // hatch) — entity-derived reasons are computed live, never stored.
  await sql`ALTER TABLE mention DROP CONSTRAINT IF EXISTS mention_excluded_reason_check`;
  await sql`
    ALTER TABLE mention ADD CONSTRAINT mention_excluded_reason_check
      CHECK (excluded_reason IN ('obituary', 'manual') OR excluded_reason IS NULL)
  `;

  await sql`CREATE INDEX IF NOT EXISTS mention_fetched_idx  ON mention (fetched_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_source_idx   ON mention (source)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_status_idx   ON mention (status)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_norm_url_idx ON mention (normalized_url)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_excluded_idx ON mention (excluded_reason)`;
  await sql`CREATE INDEX IF NOT EXISTS mention_domain_idx   ON mention (domain)`;

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
  // SUPERSEDED by entity_reputation below (Slice 7) — kept in place as the
  // migration source until the new read path is verified in production.
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
  await sql`ALTER TABLE channel_reputation DROP CONSTRAINT IF EXISTS channel_reputation_classification_check`;
  await sql`
    ALTER TABLE channel_reputation ADD CONSTRAINT channel_reputation_classification_check
      CHECK (classification IN ('owned', 'reupload', 'commentary', 'other-church', 'unclassified'))
  `;

  // Slice 7: entity-reputation triage generalized beyond YouTube channels to
  // any (source, entity_key) pair. `other-church` is retired; `wrong-entity`
  // is the one "this isn't us" category going forward.
  await sql`
    CREATE TABLE IF NOT EXISTS entity_reputation (
      source         text NOT NULL CHECK (source IN ('youtube', 'reddit', 'google_news')),
      entity_key     text NOT NULL,
      classification text NOT NULL DEFAULT 'unclassified'
        CHECK (classification IN ('owned', 'reupload', 'commentary', 'wrong-entity', 'unclassified')),
      updated_at     timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (source, entity_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS entity_reputation_source_idx ON entity_reputation (source)`;

  // One-time migration of existing channel_reputation rows into
  // entity_reputation, rewriting other-church -> wrong-entity. Idempotent via
  // ON CONFLICT DO NOTHING.
  await sql`
    INSERT INTO entity_reputation (source, entity_key, classification, updated_at)
    SELECT 'youtube', channel_title,
           CASE WHEN classification = 'other-church' THEN 'wrong-entity' ELSE classification END,
           updated_at
    FROM channel_reputation
    ON CONFLICT (source, entity_key) DO NOTHING
  `;
}

/**
 * Bulk-insert mentions, deduped at the DB level via UNIQUE (source, source_uid).
 * Uses ON CONFLICT DO NOTHING and RETURNING so the row count reflects ONLY
 * actually-inserted (new) rows — that's the `new_mentions` figure. One round
 * trip via UNNEST, regardless of batch size. Returns the new-mention count.
 *
 * Also seeds `entity_reputation` for any brand-new YouTube channel in this
 * batch (ON CONFLICT DO NOTHING — never overwrites an entity a human has
 * already triaged; Reddit/Google News entities get no auto-seed, they start
 * unclassified until a human triages them). Classification-derived exclusion
 * is NOT baked into `excluded_reason` here — it's applied via a JOIN at read
 * time (see queries.ts) so reclassifying an entity later retroactively
 * changes visibility for all of its existing rows without a backfill.
 */
export async function insertMentions(rows: MentionInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sql = getDb();

  const inserted = (await sql.query(
    `INSERT INTO mention
       (source, source_uid, url, normalized_url, title, excerpt, author, query_matched, published_at, title_match, subreddit, excluded_reason, channel_id, domain)
     SELECT * FROM UNNEST(
       $1::text[], $2::text[], $3::text[], $4::text[],
       $5::text[], $6::text[], $7::text[], $8::text[], $9::timestamptz[], $10::boolean[], $11::text[], $12::text[], $13::text[], $14::text[]
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
      rows.map((r) => r.domain ?? null),
    ],
  )) as { id: string }[];

  await seedNewEntities(rows);

  return inserted.length;
}

/**
 * Upsert a heuristic-default row for any brand-new YouTube channel in this
 * batch. Reddit authors and Google News domains are NOT auto-seeded — they
 * simply have no entity_reputation row until a human triages them (shown
 * unclassified in the meantime), same as any YouTube channel that doesn't
 * match the reupload heuristic.
 */
async function seedNewEntities(rows: MentionInput[]): Promise<void> {
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
    `INSERT INTO entity_reputation (source, entity_key, classification)
     SELECT 'youtube', t.entity_key, t.classification
     FROM UNNEST($1::text[], $2::text[]) AS t(entity_key, classification)
     ON CONFLICT (source, entity_key) DO NOTHING`,
    [titles, titles.map((t) => heuristicClassification(t))],
  );
}

/** Everything the "Add mention" form collects (Slice 9). */
export type ManualMentionInput = {
  url: string | null;
  sourceType: ManualSourceType;
  sourceDetail: string | null;
  title: string;
  topics: string[]; // KeywordFilterId values, at least one
  contentDate: string; // ISO date (yyyy-mm-dd)
  note: string | null;
  indirect: boolean;
  submittedBy: string | null;
};

/**
 * Insert one staff-submitted mention (Slice 9). Distinct from insertMentions
 * (the poller batch path) because there's no platform-native source_uid to
 * dedup on — a fresh uuid stands in, so the UNIQUE (source, source_uid)
 * constraint is satisfied trivially and every manual row is its own entity.
 * URL-based duplicate warning is a separate, non-blocking check the API layer
 * runs before this (see findMentionByNormalizedUrl) — this function always
 * inserts.
 *
 * source = 'manual_submission' (never bare 'manual' — see the schema comment
 * on excluded_reason for why that token is already taken). query_matched is
 * kept NOT NULL-satisfying via a joined topics string; multi-topic filtering
 * itself reads the `topics` array, not query_matched (see queries.ts).
 * Manual rows never seed entity_reputation and are never obituary-classified
 * (Phase 1.3: pre-filtered signal by definition).
 */
export async function insertManualMention(input: ManualMentionInput): Promise<string> {
  const sql = getDb();
  const id = randomUUID();

  const rows = (await sql`
    INSERT INTO mention (
      id, source, source_uid, url, normalized_url, title, excerpt, author,
      query_matched, published_at, source_detail, manual_source_type,
      submitted_by, indirect, topics
    ) VALUES (
      ${id}, 'manual_submission', ${id}, ${input.url}, ${input.url ? normalizeUrl(input.url) : null},
      ${input.title}, ${input.note}, null,
      ${input.topics.join(", ")}, ${input.contentDate}, ${input.sourceDetail}, ${input.sourceType},
      ${input.submittedBy}, ${input.indirect}, ${input.topics}
    )
    RETURNING id
  `) as { id: string }[];

  return rows[0].id;
}

export type DuplicateMentionMatch = { id: string; source: string; title: string | null };

/** URL-duplication check (Slice 9, warn-don't-block) — first match by normalized URL, or null. */
export async function findMentionByNormalizedUrl(url: string): Promise<DuplicateMentionMatch | null> {
  const sql = getDb();
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const rows = (await sql`
    SELECT id, source, title FROM mention WHERE normalized_url = ${normalized} LIMIT 1
  `) as DuplicateMentionMatch[];
  return rows[0] ?? null;
}

/** Post-hoc edit fields for a manual item (Slice 9, Phase 3.4) — polled items are immutable and never call this. */
export type ManualMentionEdit = {
  title: string;
  note: string | null;
  topics: string[];
  sourceDetail: string | null;
};

export async function updateManualMention(id: string, edit: ManualMentionEdit): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mention
    SET title = ${edit.title},
        excerpt = ${edit.note},
        topics = ${edit.topics},
        query_matched = ${edit.topics.join(", ")},
        source_detail = ${edit.sourceDetail}
    WHERE id = ${id} AND source = 'manual_submission'
  `;
}

/** Manual triage override — always wins over the ingest-time heuristic. */
export async function setEntityClassification(
  source: string,
  entityKey: string,
  classification: EntityClassification,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO entity_reputation (source, entity_key, classification)
    VALUES (${source}, ${entityKey}, ${classification})
    ON CONFLICT (source, entity_key)
    DO UPDATE SET classification = ${classification}, updated_at = now()
  `;
}

/** Per-item manual exclude (escape hatch for noise that doesn't map to a reusable entity). */
export async function setManualExclude(mentionId: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE mention SET excluded_reason = 'manual' WHERE id = ${mentionId}`;
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
