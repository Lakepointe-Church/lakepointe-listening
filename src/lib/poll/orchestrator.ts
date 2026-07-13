import "server-only";
import { ensureSchema, insertMentions, recordPollRun } from "@/lib/db";
import { POLLERS } from "@/lib/pollers";

const PER_SOURCE_BUDGET_MS = 60_000; // keeps the full run well under Vercel's 300s cron cap

export type SourceResult = {
  source: string;
  status: "ok" | "error";
  new_mentions: number;
  error_message: string | null;
  duration_ms: number;
};

/** Reject if a poller exceeds its time budget, so one slow source can't blow the run. */
function withBudget<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms budget`)), ms),
    ),
  ]);
}

/**
 * Run every registered poller sequentially. Each source's results are inserted
 * and its poll_run recorded IMMEDIATELY after it finishes — so if source #4
 * throws, sources #1–3 are already persisted (partial success is success). A
 * failing source records a loud `error` poll_run and never aborts the run.
 */
export async function runPoll(): Promise<{ results: SourceResult[] }> {
  await ensureSchema();
  const results: SourceResult[] = [];

  for (const poller of POLLERS) {
    const started = Date.now();
    try {
      const outcome = await withBudget(
        poller.run(),
        poller.budgetMs ?? PER_SOURCE_BUDGET_MS,
        poller.label,
      );
      // Insert whatever the poller fetched even when it reported an error —
      // partial success is success; the error still gets a loud poll_run.
      const newCount = await insertMentions(outcome.mentions);
      const duration_ms = Date.now() - started;
      const result: SourceResult = {
        source: poller.id,
        status: outcome.error ? "error" : "ok",
        new_mentions: newCount,
        error_message: outcome.error ?? null,
        duration_ms,
      };
      await recordPollRun(result);
      results.push(result);
    } catch (err) {
      const duration_ms = Date.now() - started;
      const error_message = err instanceof Error ? err.message : String(err);
      // Loud, not silent: persist the error so the UI surfaces it.
      await recordPollRun({
        source: poller.id,
        status: "error",
        new_mentions: 0,
        error_message,
        duration_ms,
      });
      results.push({
        source: poller.id,
        status: "error",
        new_mentions: 0,
        error_message,
        duration_ms,
      });
    }
  }

  return { results };
}
