import { NextResponse } from "next/server";
import { runPoll } from "@/lib/poll/orchestrator";

// All poll logic lives in runPoll() (src/lib/poll/orchestrator.ts), invoked here
// by the daily Vercel cron and reused by the manual "Refresh now" server action.
// Keeping it behind this plain HTTP route means an external scheduler (GitHub
// Actions / cron-job.org) can hit the same endpoint with the Bearer secret for
// higher-than-daily frequency later, with no architecture change.

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Hobby cron hard cap; runPoll budgets each source

// Pin polling away from iad1 (Vercel's default region): three deployed runs
// (July 13-14, 2026) showed iad1's shared egress IPs are saturated with other
// tenants' GDELT traffic — most calls 429'd even ≥5.5s apart with a 20s
// retry, and one connection was dropped outright ("fetch failed"). cle1 has
// far fewer tenants sharing egress IPs and sits ~30ms from GDELT's
// us-central servers. Only this route moves; the dashboard page stays in
// iad1 next to the database.
export const preferredRegion = "cle1";

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

// The manual "Refresh now" server action proxies here (POST) so manual polls
// also run in this route's region, not the page's.
export const POST = GET;
