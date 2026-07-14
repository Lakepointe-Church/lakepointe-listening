"use server";

import { revalidatePath } from "next/cache";
import { runPoll, type SourceResult } from "@/lib/poll/orchestrator";

/**
 * Manual "Refresh now" trigger. Executes server-side (same-origin /
 * CSRF-protected by Next), so staff can trigger a pull without the
 * CRON_SECRET ever reaching the browser.
 *
 * On Vercel this PROXIES to /api/cron/poll (adding the Bearer secret
 * server-to-server) instead of calling runPoll() directly: the poll route is
 * region-pinned away from iad1's GDELT-saturated egress IPs (see the route
 * file), and a server action always runs in its page's region — a direct
 * call would put manual polls right back on the bad IPs. Locally (no Vercel
 * env) it just runs the pollers in-process.
 */
export async function refreshNow() {
  const results = process.env.VERCEL
    ? await pollViaRoute()
    : (await runPoll()).results;

  revalidatePath("/");
  const newTotal = results.reduce((n, r) => n + r.new_mentions, 0);
  const errors = results.filter((r) => r.status === "error");
  return {
    ok: errors.length === 0,
    newTotal,
    errors: errors.map((e) => `${e.source}: ${e.error_message}`),
  };
}

async function pollViaRoute(): Promise<SourceResult[]> {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const secret = process.env.CRON_SECRET;
  if (!host || !secret) {
    throw new Error(
      `Refresh misconfigured: ${!host ? "VERCEL_PROJECT_PRODUCTION_URL" : "CRON_SECRET"} not set`,
    );
  }

  const res = await fetch(`https://${host}/api/cron/poll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    results?: SourceResult[];
  } | null;
  if (!body?.results) {
    throw new Error(`Poll route returned HTTP ${res.status} without results`);
  }
  return body.results;
}
