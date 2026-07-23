import { ensureSchema, getDb, hasDb } from "./db";
import { SOURCES } from "@/config/sources";
import { windowSince, type WindowId } from "./timeWindow";
import type {
  Mention,
  PollRun,
  SourceHealth,
  SourceHealthState,
  SummaryStats,
} from "./types";

/** Postgres "undefined_table" — the one error the dashboard self-heals from. */
const UNDEFINED_TABLE = "42P01";

/**
 * Safety cap per (source, included/excluded) partition — bounds payload size
 * without being a display cap. If a partition genuinely has more rows than
 * this within the active window, `truncatedSources` reports it so the UI can
 * say so rather than silently dropping rows (silent truncation is a bug).
 */
const MAX_ROWS_PER_PARTITION = 1000;

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
 *
 * `windowId` (Slice 7) bounds the feed to a trailing time window — 7/30/90
 * days or "all" — applied server-side so every count on the page (source
 * tabs, keyword chips, excluded count) is computed from the same row set.
 * Source health is NOT windowed — polling reliability isn't a content metric.
 */
export async function getDashboardData(windowId: WindowId = "7d"): Promise<{
  mentions: Mention[];
  excludedMentions: Mention[];
  health: SourceHealth[];
  truncatedSources: string[];
  summary: SummaryStats;
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
      truncatedSources: [],
      summary: { currentWeekTotal: 0, priorWeekTotal: 0, bySource: [], needsAttention: 0 },
    };
  }

  let rows: {
    mentions: Mention[];
    excludedMentions: Mention[];
    latestRuns: PollRun[];
    truncatedSources: string[];
    summary: SummaryStats;
  };
  try {
    rows = await readDashboard(windowSince(windowId));
  } catch (err) {
    // Bootstrap: on a fresh database the tables don't exist until the first
    // poll runs ensureSchema() — but the page renders (and 500s) before any
    // poll can be triggered. Self-heal from exactly this condition and let
    // every other error stay loud.
    if ((err as { code?: string }).code !== UNDEFINED_TABLE) throw err;
    await ensureSchema();
    rows = await readDashboard(windowSince(windowId));
  }
  const { mentions, excludedMentions, latestRuns, truncatedSources, summary } = rows;

  const runBySource = new Map(latestRuns.map((r) => [r.source, r]));
  const health: SourceHealth[] = SOURCES.map((s) => {
    // Placeholder and degraded sources aren't polled — ignore any historical
    // poll_run rows (e.g. from before a source was demoted) so a stale error
    // can't trip the status line forever.
    if (s.kind !== "live") {
      return { source: s.id, state: "never" as const, lastRun: null };
    }
    const run = runBySource.get(s.id) ?? null;
    return { source: s.id, state: deriveState(run), lastRun: run };
  });

  return { mentions, excludedMentions, health, truncatedSources, summary };
}

/** The dashboard's reads, separated so the bootstrap path can retry them. */
async function readDashboard(since: Date | null): Promise<{
  mentions: Mention[];
  excludedMentions: Mention[];
  latestRuns: PollRun[];
  truncatedSources: string[];
  summary: SummaryStats;
}> {
  const sql = getDb();

  // Per-source cap (not a flat overall LIMIT): a high-volume source like
  // YouTube would otherwise crowd a low-volume one like Reddit or Google
  // News out of the feed entirely, even though their rows are sitting right
  // there in the table — a flat top-N-across-everything cap was found live
  // to zero out Google News and nearly zero out Reddit despite both having
  // just been freshly polled.
  //
  // excluded_reason is computed here, not just read: a stored 'obituary' or
  // 'manual' value passes through as-is, but owned/reupload/wrong-entity
  // exclusion is derived live from entity_reputation via LEFT JOIN (not
  // stored on the row) so reclassifying an entity retroactively changes
  // visibility for all of its existing mentions with no backfill. The join
  // key varies by source: YouTube/Reddit key on `author`, Google News keys
  // on `domain` (there's no per-source column, so a CASE picks the right
  // one). Partitioning by (source, excluded_reason IS NULL) gives the active
  // feed and the audit toggle each their own top-N-per-source, from one
  // table scan. `partition_total` (a second window function) is how the UI
  // knows whether the cap actually cut anything, rather than truncating
  // silently.
  const rows = (await sql`
    SELECT id, source, source_uid, url, title, excerpt, author,
           query_matched, published_at, fetched_at, sentiment, status,
           title_match, subreddit, channel_id, domain, excluded_reason,
           entity_classification, partition_total
    FROM (
      SELECT scored.*, ROW_NUMBER() OVER (
        PARTITION BY scored.source, (scored.excluded_reason IS NULL)
        ORDER BY COALESCE(scored.published_at, scored.fetched_at) DESC
      ) AS rn,
      COUNT(*) OVER (
        PARTITION BY scored.source, (scored.excluded_reason IS NULL)
      ) AS partition_total
      FROM (
        SELECT m.id, m.source, m.source_uid, m.url, m.title, m.excerpt, m.author,
               m.query_matched, m.published_at, m.fetched_at, m.sentiment, m.status,
               m.title_match, m.subreddit, m.channel_id, m.domain,
               er.classification AS entity_classification,
               COALESCE(
                 m.excluded_reason,
                 CASE
                   WHEN er.classification = 'owned' THEN 'owned-entity'
                   WHEN er.classification = 'reupload' THEN 'reupload-entity'
                   WHEN er.classification = 'wrong-entity' THEN 'wrong-entity'
                   ELSE NULL
                 END
               ) AS excluded_reason
        FROM mention m
        LEFT JOIN entity_reputation er
          ON er.source = m.source
         AND er.entity_key = CASE m.source WHEN 'google_news' THEN m.domain ELSE m.author END
        WHERE ${since}::timestamptz IS NULL
           OR COALESCE(m.published_at, m.fetched_at) >= ${since}
      ) scored
    ) ranked
    WHERE rn <= ${MAX_ROWS_PER_PARTITION}
    ORDER BY COALESCE(published_at, fetched_at) DESC
  `) as (Mention & { partition_total: number })[];

  const mentions = rows.filter((m) => m.excluded_reason === null);
  const excludedMentions = rows.filter((m) => m.excluded_reason !== null);
  const truncatedSources = [
    ...new Set(
      rows.filter((r) => r.partition_total > MAX_ROWS_PER_PARTITION).map((r) => r.source),
    ),
  ];

  // Most-recent run per source via DISTINCT ON. Health is intentionally NOT
  // windowed — polling reliability isn't a content metric.
  const latestRuns = (await sql`
    SELECT DISTINCT ON (source)
           id, source, ran_at, status, new_mentions, error_message, duration_ms
    FROM poll_run
    ORDER BY source, ran_at DESC
  `) as PollRun[];

  const summary = await readSummaryStats();

  return { mentions, excludedMentions, latestRuns, truncatedSources, summary };
}

/**
 * Executive summary strip (Slice 7, Phase 5). Deliberately NOT windowed by
 * the feed's `windowId` — always a fixed trailing-14-day read (split into
 * current/prior 7-day halves) so the strip is a pulse, not a filter readout.
 * Same derived exclusion as the feed (entity_reputation JOIN, non-excluded
 * only) but no per-source row cap: this only ever aggregates counts, it
 * never returns row-level data, so there's nothing to truncate.
 */
async function readSummaryStats(): Promise<SummaryStats> {
  const sql = getDb();

  const rows = (await sql`
    SELECT source, entity_classification,
           COUNT(*) FILTER (WHERE occurred_at >= now() - interval '7 days')  AS current_week,
           COUNT(*) FILTER (WHERE occurred_at <  now() - interval '7 days') AS prior_week
    FROM (
      SELECT m.source,
             COALESCE(m.published_at, m.fetched_at) AS occurred_at,
             er.classification AS entity_classification,
             COALESCE(
               m.excluded_reason,
               CASE
                 WHEN er.classification = 'owned' THEN 'owned-entity'
                 WHEN er.classification = 'reupload' THEN 'reupload-entity'
                 WHEN er.classification = 'wrong-entity' THEN 'wrong-entity'
                 ELSE NULL
               END
             ) AS excluded_reason
      FROM mention m
      LEFT JOIN entity_reputation er
        ON er.source = m.source
       AND er.entity_key = CASE m.source WHEN 'google_news' THEN m.domain ELSE m.author END
      WHERE COALESCE(m.published_at, m.fetched_at) >= now() - interval '14 days'
    ) scored
    WHERE excluded_reason IS NULL
    GROUP BY source, entity_classification
  `) as { source: string; entity_classification: string | null; current_week: string; prior_week: string }[];

  let currentWeekTotal = 0;
  let priorWeekTotal = 0;
  let needsAttention = 0;
  const bySourceMap = new Map<string, number>();

  for (const r of rows) {
    const current = Number(r.current_week);
    const prior = Number(r.prior_week);
    currentWeekTotal += current;
    priorWeekTotal += prior;
    bySourceMap.set(r.source, (bySourceMap.get(r.source) ?? 0) + current);
    if (r.entity_classification === "commentary") needsAttention += current;
  }

  const bySource = SOURCES.filter((s) => bySourceMap.has(s.id)).map((s) => ({
    source: s.id,
    count: bySourceMap.get(s.id) ?? 0,
  }));

  return { currentWeekTotal, priorWeekTotal, bySource, needsAttention };
}
