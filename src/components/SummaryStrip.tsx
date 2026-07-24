import type { SummaryStats } from "@/lib/types";
import { SOURCES, MANUAL_SOURCE_TYPES } from "@/config/sources";

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));
const MANUAL_TYPE_LABEL = Object.fromEntries(MANUAL_SOURCE_TYPES.map((t) => [t.id, t.label]));

function trend(current: number, prior: number): string {
  if (current > prior) return "↑";
  if (current < prior) return "↓";
  return "→";
}

/**
 * Executive summary strip (Slice 7, Phase 5). Counts only — no sentiment, no
 * LLM, no editorializing. Always trailing-7-vs-prior-7 from now, independent
 * of the feed's active time-window filter (a pulse, not a filter readout —
 * hence the tooltip on the volume figure). Brand-neutral: metadata, not a
 * call to action, so no orange here.
 */
export default function SummaryStrip({
  summary,
  onNeedsAttentionClick,
}: {
  summary: SummaryStats;
  onNeedsAttentionClick?: () => void;
}) {
  const { currentWeekTotal, priorWeekTotal, bySource, needsAttention, byManualType } = summary;
  // Slice 9: manual_submission's own row is replaced by its byManualType
  // breakdown ("Facebook groups: 3" reads more meaningfully than one lumped
  // "Manual submissions: N" — Phase 4.1's own stated lean).
  const polledBySource = bySource.filter((s) => s.source !== "manual_submission");

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-lp-taupe/15 bg-lp-surface/40 px-4 py-2.5 text-[12px] text-lp-taupe/70">
      <span title="Always the trailing 7 days vs. the 7 days before that — independent of the time filter below.">
        <span className="font-medium text-lp-taupe">
          {currentWeekTotal} mention{currentWeekTotal === 1 ? "" : "s"} this week
        </span>{" "}
        <span className="text-lp-taupe/50">
          {trend(currentWeekTotal, priorWeekTotal)} from {priorWeekTotal}
        </span>
      </span>

      {polledBySource.length > 0 && (
        <span className="flex flex-wrap items-center gap-x-3 text-lp-taupe/55">
          {polledBySource.map(({ source, count }) => (
            <span key={source}>
              {SOURCE_LABEL[source] ?? source} <span className="text-lp-taupe/40">{count}</span>
            </span>
          ))}
        </span>
      )}

      {byManualType.length > 0 && (
        <span className="flex flex-wrap items-center gap-x-3 text-lp-taupe/55">
          {byManualType.map(({ type, count }) => (
            <span key={type}>
              {MANUAL_TYPE_LABEL[type] ?? type} <span className="text-lp-taupe/40">{count}</span>
            </span>
          ))}
        </span>
      )}

      {onNeedsAttentionClick && needsAttention > 0 ? (
        <button
          onClick={onNeedsAttentionClick}
          className="text-lp-taupe/55 underline decoration-lp-taupe/30 underline-offset-2 transition hover:text-lp-taupe hover:decoration-lp-taupe/60"
          title="Show these in the feed, filtered to commentary-classified sources, last 7 days"
        >
          {needsAttention} needing attention
        </button>
      ) : (
        <span className="text-lp-taupe/55">{needsAttention} needing attention</span>
      )}
    </div>
  );
}
