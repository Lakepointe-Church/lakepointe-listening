"use client";

import { useState } from "react";
import type { SourceHealth } from "@/lib/types";
import { SOURCES } from "@/config/sources";

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Slice 7 Phase 6 — replaces the loud ErrorBanner with a compact status line.
 * No change to polling/retry/reporting: a source that fails still writes an
 * error poll_run exactly as before. Only the presentation calms down —
 * "degraded" sources (known, accepted issue) never trip the warning tint,
 * and detail is opt-in via click instead of always-on.
 */
export default function SourceStatusLine({ health }: { health: SourceHealth[] }) {
  const [expanded, setExpanded] = useState(false);

  const liveIds = new Set(SOURCES.filter((s) => s.kind === "live").map((s) => s.id));
  const degradedIds = new Set(SOURCES.filter((s) => s.kind === "degraded").map((s) => s.id));
  const byId = new Map(health.map((h) => [h.source, h]));

  const liveHealth = health.filter((h) => liveIds.has(h.source));
  const failed = liveHealth.filter((h) => h.state === "error");
  const healthyCount = liveHealth.length - failed.length;
  const lastUpdated = liveHealth.reduce<string | null>((latest, h) => {
    if (!h.lastRun) return latest;
    if (!latest || h.lastRun.ran_at > latest) return h.lastRun.ran_at;
    return latest;
  }, null);

  const hasWarning = failed.length > 0;
  const degradedSources = SOURCES.filter((s) => degradedIds.has(s.id));

  return (
    <div
      className={`mb-6 rounded-xl border px-4 py-2.5 text-[13px] ${
        hasWarning
          ? "border-lp-orange/30 bg-lp-orange/5 text-lp-taupe"
          : "border-lp-taupe/15 bg-lp-surface/40 text-lp-taupe/70"
      }`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            hasWarning ? "bg-lp-orange" : "bg-lp-slate"
          }`}
        />
        <span className={hasWarning ? "font-medium text-white" : ""}>
          {healthyCount} of {liveHealth.length} sources healthy
        </span>
        <span className="text-lp-taupe/45">·</span>
        <span className="text-lp-taupe/55">updated {timeAgo(lastUpdated)}</span>
        <span className="ml-auto text-lp-taupe/40">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-1 border-t border-lp-taupe/10 pt-2.5">
          {Array.from(liveIds).map((id) => {
            const h = byId.get(id);
            const label = SOURCE_LABEL[id] ?? id;
            if (!h || h.state !== "error") {
              return (
                <p key={id} className="text-lp-taupe/60">
                  <span className="font-medium text-lp-taupe/80">{label}</span> —{" "}
                  {h?.lastRun ? `last polled ${fmtTime(h.lastRun.ran_at)}` : "not yet polled"}
                </p>
              );
            }
            return (
              <p key={id} className="text-lp-taupe/75">
                <span className="font-medium text-lp-orange">{label}</span> failed
                {h.lastRun ? ` at ${fmtTime(h.lastRun.ran_at)}` : ""}
                {h.lastRun?.error_message ? ` — ${h.lastRun.error_message}` : ""}
              </p>
            );
          })}
          {degradedSources.map((s) => (
            <p key={s.id} className="text-lp-taupe/50">
              <span className="font-medium text-lp-taupe/70">{s.label}</span> — degraded, known
              issue
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
