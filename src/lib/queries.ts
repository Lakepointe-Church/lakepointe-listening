import { getDb, hasDb } from "./db";
import { SOURCES } from "@/config/sources";
import type {
  Mention,
  PollRun,
  SourceHealth,
  SourceHealthState,
} from "./types";

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

  const sql = getDb();

  const mentions = (await sql`
    SELECT id, source, source_uid, url, title, excerpt, author,
           query_matched, published_at, fetched_at, sentiment, status
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

  const runBySource = new Map(latestRuns.map((r) => [r.source, r]));
  const health: SourceHealth[] = SOURCES.map((s) => {
    const run = runBySource.get(s.id) ?? null;
    return { source: s.id, state: deriveState(run), lastRun: run };
  });

  return { mentions, health };
}
