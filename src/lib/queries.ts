import { ensureSchema, getDb, hasDb } from "./db";
import { SOURCES } from "@/config/sources";
import type {
  Mention,
  PollRun,
  SourceHealth,
  SourceHealthState,
} from "./types";

/** Postgres "undefined_table" — the one error the dashboard self-heals from. */
const UNDEFINED_TABLE = "42P01";

/** Collapse a source's most-recent poll_run into a single health state. */
function deriveState(run: PollRun | null): SourceHealthState {
  if (!run) return "never";
  if (run.status === "error") return "error";
  return run.new_mentions > 0 ? "ok" : "zero";
}

/**
 * Everything the dashboard renders, in one read. When DATABASE_URL is unset
 * (Slice 1, before a DB is provisioned), returns the empty "not yet polled"
 * shell so the UI is honest rather than erroring.
 */
export async function getDashboardData(): Promise<{
  mentions: Mention[];
  excludedMentions: Mention[];
  health: SourceHealth[];
}> {
  if (!hasDb()) {
    return {
      mentions: [],
      excludedMentions: [],
      health: SOURCES.map((s) => ({
        source: s.id,
        state: "never" as const,
        lastRun: null,
      })),
    };
  }

  let rows: { mentions: Mention[]; excludedMentions: Mention[]; latestRuns: PollRun[] };
  try {
    rows = await readDashboard();
  } catch (err) {
    // Bootstrap: on a fresh database the tables don't exist until the first
    // poll runs ensureSchema() — but the page renders (and 500s) before any
    // poll can be triggered. Self-heal from exactly this condition and let
    // every other error stay loud.
    if ((err as { code?: string }).code !== UNDEFINED_TABLE) throw err;
    await ensureSchema();
    rows = await readDashboard();
  }
  const { mentions, excludedMentions, latestRuns } = rows;

  const runBySource = new Map(latestRuns.map((r) => [r.source, r]));
  const health: SourceHealth[] = SOURCES.map((s) => {
    // Placeholder sources aren't polled — ignore any historical poll_run
    // rows (e.g. from before a source was demoted) so a stale error can't
    // trip the banner forever.
    if (s.kind === "unavailable") {
      return { source: s.id, state: "never" as const, lastRun: null };
    }
    const run = runBySource.get(s.id) ?? null;
    return { source: s.id, state: deriveState(run), lastRun: run };
  });

  return { mentions, excludedMentions, health };
}

/** The dashboard's reads, separated so the bootstrap path can retry them. */
async function readDashboard(): Promise<{
  mentions: Mention[];
  excludedMentions: Mention[];
  latestRuns: PollRun[];
}> {
  const sql = getDb();

  // Per-source cap (not a flat overall LIMIT): a high-volume source like
  // YouTube would otherwise crowd a low-volume one like Reddit or Google
  // News out of the feed entirely, even though their rows are sitting right
  // there in the table — a flat top-200-across-everything cap was found
  // live to zero out Google News (177 real rows) and nearly zero out Reddit
  // (55 real rows) despite both having just been freshly polled.
  //
  // excluded_reason is computed here, not just read: a stored 'obituary'
  // value passes through as-is, but owned/reupload-channel exclusion is
  // derived live from channel_reputation via LEFT JOIN (not stored on the
  // row) so reclassifying a channel retroactively changes visibility for
  // all of its existing mentions with no backfill. Partitioning by
  // (source, excluded_reason IS NULL) gives the active feed and the audit
  // toggle each their own top-200-per-source, from one table scan.
  const rows = (await sql`
    SELECT id, source, source_uid, url, title, excerpt, author,
           query_matched, published_at, fetched_at, sentiment, status,
           title_match, subreddit, channel_id, excluded_reason
    FROM (
      SELECT scored.*, ROW_NUMBER() OVER (
        PARTITION BY scored.source, (scored.excluded_reason IS NULL)
        ORDER BY COALESCE(scored.published_at, scored.fetched_at) DESC
      ) AS rn
      FROM (
        SELECT m.id, m.source, m.source_uid, m.url, m.title, m.excerpt, m.author,
               m.query_matched, m.published_at, m.fetched_at, m.sentiment, m.status,
               m.title_match, m.subreddit, m.channel_id,
               COALESCE(
                 m.excluded_reason,
                 CASE
                   WHEN m.source = 'youtube' AND cr.classification = 'owned' THEN 'owned-channel'
                   WHEN m.source = 'youtube' AND cr.classification = 'reupload' THEN 'reupload-channel'
                   ELSE NULL
                 END
               ) AS excluded_reason
        FROM mention m
        LEFT JOIN channel_reputation cr
          ON m.source = 'youtube' AND cr.channel_title = m.author
      ) scored
    ) ranked
    WHERE rn <= 200
    ORDER BY COALESCE(published_at, fetched_at) DESC
  `) as Mention[];

  const mentions = rows.filter((m) => m.excluded_reason === null);
  const excludedMentions = rows.filter((m) => m.excluded_reason !== null);

  // Most-recent run per source via DISTINCT ON.
  const latestRuns = (await sql`
    SELECT DISTINCT ON (source)
           id, source, ran_at, status, new_mentions, error_message, duration_ms
    FROM poll_run
    ORDER BY source, ran_at DESC
  `) as PollRun[];

  return { mentions, excludedMentions, latestRuns };
}
