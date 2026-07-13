import { NextResponse } from "next/server";
import { runPoll } from "@/lib/poll/orchestrator";

// All poll logic lives in runPoll() (src/lib/poll/orchestrator.ts), invoked here
// by the daily Vercel cron and reused by the manual "Refresh now" server action.
// Keeping it behind this plain HTTP route means an external scheduler (GitHub
// Actions / cron-job.org) can hit the same endpoint with the Bearer secret for
// higher-than-daily frequency later, with no architecture change.

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Hobby cron hard cap; runPoll budgets each source

/**
 * Daily cron entry point. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` for configured crons; we require it so
 * the endpoint can't be triggered anonymously.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { results } = await runPoll();
  const anyError = results.some((r) => r.status === "error");
  return NextResponse.json({ ok: !anyError, results });
}
