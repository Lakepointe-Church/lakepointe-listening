"use server";

import { revalidatePath } from "next/cache";
import { runPoll, type SourceResult } from "@/lib/poll/orchestrator";
import { setEntityClassification, setManualExclude } from "@/lib/db";
import type { EntityClassification } from "@/lib/types";

/**
 * Manual "Refresh now" trigger. Executes server-side (same-origin /
 * CSRF-protected by Next), so staff can trigger a pull without the
 * CRON_SECRET ever reaching the browser.
 *
 * On Vercel this PROXIES to /api/cron/poll (adding the Bearer secret
 * server-to-server) instead of calling runPoll() directly, so manual and
 * scheduled polls share one entry point: same region (vercel.json pins all
 * functions to cle1 — see the route file for why), same code path, same
 * poll_run provenance. Locally (no Vercel env) it runs the pollers
 * in-process.
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

/**
 * Entity triage (Slice 6 for YouTube, generalized to Reddit/Google News in
 * Slice 7). Applies to all existing and future items from that entity —
 * classification is joined at read time (see queries.ts), never rewritten
 * onto historical mention rows.
 */
export async function classifyEntity(
  source: string,
  entityKey: string,
  classification: EntityClassification,
) {
  await setEntityClassification(source, entityKey, classification);
  revalidatePath("/");
}

/**
 * Per-item manual exclude (Slice 7) — the escape hatch for noise that
 * doesn't map to a reusable entity (a one-off post, a single odd article).
 * Item-level only; creates no reputation row.
 */
export async function excludeItem(mentionId: string) {
  await setManualExclude(mentionId);
  revalidatePath("/");
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
