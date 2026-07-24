import type { SourceDef } from "@/config/sources";
import type { SourceHealth } from "@/lib/types";

/** Relative "x minutes ago" with an absolute fallback. */
function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const STATE_META: Record<
  SourceHealth["state"],
  { label: string; dot: string; text: string }
> = {
  ok: { label: "OK", dot: "bg-lp-slate", text: "text-lp-slate" },
  zero: { label: "No new mentions", dot: "bg-lp-taupe/50", text: "text-lp-taupe/70" },
  error: { label: "Error", dot: "bg-lp-orange", text: "text-lp-orange" },
  never: { label: "Not yet polled", dot: "bg-lp-taupe/40", text: "text-lp-taupe/60" },
};

export default function SourceTile({
  def,
  health,
  manualCount,
}: {
  def: SourceDef;
  health: SourceHealth | undefined;
  /** Slice 9: item count for kind === "manual" tiles — no poll_run ever exists for these. */
  manualCount?: number;
}) {
  if (def.kind === "manual") {
    return (
      <div className="rounded-xl border border-lp-taupe/15 bg-lp-surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-white">{def.label}</h3>
          <span className="rounded-full border border-lp-slate/40 px-2 py-0.5 text-[11px] uppercase tracking-wide text-lp-slate/80">
            Manually monitored
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-lp-taupe/55">{def.blurb}</p>
        <div className="mt-4 flex items-end justify-between border-t border-lp-taupe/10 pt-3">
          <div>
            <div className="text-2xl font-bold tabular-nums text-lp-orange">{manualCount ?? 0}</div>
            <div className="text-[11px] uppercase tracking-wide text-lp-taupe/45">this week</div>
          </div>
          <div className="text-right text-[12px] text-lp-taupe/50">
            <a href="/add" className="text-lp-orange hover:underline">
              Add mention
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Sources with no free API path render as an explicit "not connected" tile —
  // visibly distinct, never faked.
  if (def.kind === "unavailable") {
    return (
      <div className="rounded-xl border border-dashed border-lp-taupe/20 bg-lp-surface/40 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lp-taupe">{def.label}</h3>
          <span className="rounded-full border border-lp-taupe/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-lp-taupe/60">
            Not connected
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-lp-taupe/55">{def.blurb}</p>
      </div>
    );
  }

  // Has a real, working poller but is paused on a known, documented issue
  // (Slice 7 Phase 6) — distinct from "unavailable" (no free path exists at
  // all). Calm framing: this isn't a fresh alert, it's an accepted state.
  if (def.kind === "degraded") {
    return (
      <div className="rounded-xl border border-dashed border-lp-orange/25 bg-lp-surface/40 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lp-taupe">{def.label}</h3>
          <span className="rounded-full border border-lp-orange/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-lp-orange/70">
            Degraded — known issue
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-lp-taupe/55">{def.blurb}</p>
      </div>
    );
  }

  const state = health?.state ?? "never";
  const meta = STATE_META[state];
  const lastRun = health?.lastRun ?? null;

  return (
    <div className="rounded-xl border border-lp-taupe/15 bg-lp-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">{def.label}</h3>
        <span className={`flex items-center gap-1.5 text-[12px] ${meta.text}`}>
          <span
            className={`h-2 w-2 rounded-full ${meta.dot} ${
              state === "never" ? "lp-awaiting-dot" : ""
            }`}
          />
          {meta.label}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-snug text-lp-taupe/60">{def.blurb}</p>

      <div className="mt-4 flex items-end justify-between border-t border-lp-taupe/10 pt-3">
        <div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              state === "ok" ? "text-lp-orange" : "text-lp-taupe/50"
            }`}
          >
            {lastRun ? lastRun.new_mentions : "—"}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-lp-taupe/45">
            new last run
          </div>
        </div>
        <div className="text-right text-[12px] text-lp-taupe/50">
          {lastRun ? timeAgo(lastRun.ran_at) : "awaiting first poll"}
        </div>
      </div>
    </div>
  );
}
