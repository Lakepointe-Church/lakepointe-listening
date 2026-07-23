import type { SummaryStats } from "@/lib/types";
import { SOURCES } from "@/config/sources";

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

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
  const { currentWeekTotal, priorWeekTotal, bySource, needsAttention } = summary;

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

      {bySource.length > 0 && (
        <span className="flex flex-wrap items-center gap-x-3 text-lp-taupe/55">
          {bySource.map(({ source, count }) => (
            <span key={source}>
              {SOURCE_LABEL[source] ?? source} <span className="text-lp-taupe/40">{count}</span>
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
