"use server";

import { revalidatePath } from "next/cache";
import { runPoll } from "@/lib/poll/orchestrator";

/**
 * Manual "Refresh now" trigger. Runs the same orchestrator as the daily cron,
 * but as a Server Action — it executes server-side and is same-origin /
 * CSRF-protected by Next, so staff can trigger a pull without the CRON_SECRET
 * ever reaching the browser. Returns a per-source summary for the UI to show.
 */
export async function refreshNow() {
  const { results } = await runPoll();
  revalidatePath("/");
  const newTotal = results.reduce((n, r) => n + r.new_mentions, 0);
  const errors = results.filter((r) => r.status === "error");
  return {
    ok: errors.length === 0,
    newTotal,
    errors: errors.map((e) => `${e.source}: ${e.error_message}`),
  };
}
