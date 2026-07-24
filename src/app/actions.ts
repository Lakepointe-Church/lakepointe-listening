"use server";

import { revalidatePath } from "next/cache";
import { runPoll, type SourceResult } from "@/lib/poll/orchestrator";
import {
  setEntityClassification,
  setManualExclude,
  insertManualMention,
  findMentionByNormalizedUrl,
  updateManualMention,
  type ManualMentionInput,
  type DuplicateMentionMatch,
  type ManualMentionEdit,
} from "@/lib/db";
import { MANUAL_SOURCE_TYPES, KEYWORD_FILTERS } from "@/config/sources";
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

/**
 * On-blur duplicate check for the "Add mention" form (Slice 9) — warns via a
 * link to the existing item but never blocks submission (Jolie approved).
 */
export async function checkDuplicateUrl(url: string): Promise<DuplicateMentionMatch | null> {
  if (!url.trim()) return null;
  return findMentionByNormalizedUrl(url.trim());
}

/**
 * Submit a staff-entered mention (Slice 9) — the capture path for content no
 * poller can reach: private Facebook groups and indirect/unnamed mentions.
 * Validation lives here (API layer), not the DB, per the spec's field
 * mapping: URL required unless the source is a Facebook group, and a note is
 * required whenever URL is empty. Append-only insert, no review step.
 */
export async function submitMention(input: {
  url: string;
  sourceType: string;
  sourceDetail: string;
  title: string;
  topics: string[];
  contentDate: string;
  note: string;
  indirect: boolean;
  submittedBy: string;
}) {
  const sourceType = MANUAL_SOURCE_TYPES.find((t) => t.id === input.sourceType);
  if (!sourceType) throw new Error("Unknown source type");

  const url = input.url.trim() || null;
  const note = input.note.trim() || null;
  const title = input.title.trim();
  const topics = input.topics.filter((t) => KEYWORD_FILTERS.some((f) => f.id === t));

  if (!title) throw new Error("Title is required");
  if (topics.length === 0) throw new Error("At least one topic is required");
  if (!url && sourceType.id !== "facebook-group") {
    throw new Error("URL is required for this source type");
  }
  if (!url && !note) throw new Error("Note is required when URL is empty");

  const manualInput: ManualMentionInput = {
    url,
    sourceType: sourceType.id,
    sourceDetail: input.sourceDetail.trim() || null,
    title,
    topics,
    contentDate: input.contentDate || new Date().toISOString().slice(0, 10),
    note,
    indirect: input.indirect,
    submittedBy: input.submittedBy.trim() || null,
  };

  const id = await insertManualMention(manualInput);
  revalidatePath("/");
  return { id };
}

/** Post-hoc edit for a manual item only (Slice 9, Phase 3.4) — polled items are immutable. */
export async function editManualMention(id: string, edit: ManualMentionEdit) {
  const title = edit.title.trim();
  const topics = edit.topics.filter((t) => KEYWORD_FILTERS.some((f) => f.id === t));
  if (!title) throw new Error("Title is required");
  if (topics.length === 0) throw new Error("At least one topic is required");

  await updateManualMention(id, {
    title,
    note: edit.note?.trim() || null,
    topics,
    sourceDetail: edit.sourceDetail?.trim() || null,
  });
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
