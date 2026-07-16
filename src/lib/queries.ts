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
  health: SourceHealth[];
}> {
  if (!hasDb()) {
    return {
      mentions: [],
      health: SOURCES.map((s) => ({
        source: s.id,
        state: "never" as const,
        lastRun: null,
      })),
    };
  }

  let rows: { mentions: Mention[]; latestRuns: PollRun[] };
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
  const { mentions, latestRuns } = rows;

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

  return { mentions, health };
}

/** The dashboard's two reads, separated so the bootstrap path can retry them. */
async function readDashboard(): Promise<{
  mentions: Mention[];
  latestRuns: PollRun[];
}> {
  const sql = getDb();

  const mentions = (await sql`
    SELECT id, source, source_uid, url, title, excerpt, author,
           query_matched, published_at, fetched_at, sentiment, status, title_match
    FROM mention
    ORDER BY COALESCE(published_at, fetched_at) DESC
    LIMIT 200
  `) as Mention[];

  // Most-recent run per source via DISTINCT ON.
  const latestRuns = (await sql`
    SELECT DISTINCT ON (source)
           id, source, ran_at, status, new_mentions, error_message, duration_ms
    FROM poll_run
    ORDER BY source, ran_at DESC
  `) as PollRun[];

  return { mentions, latestRuns };
}
