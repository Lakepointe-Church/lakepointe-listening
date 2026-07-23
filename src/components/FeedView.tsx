"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Mention } from "@/lib/types";
import { KEYWORD_FILTERS, SOURCES, type KeywordFilterId } from "@/config/sources";
import { WINDOW_IDS, WINDOW_LABELS, type WindowId } from "@/lib/timeWindow";
import MentionCard from "./MentionCard";
import EmptyState from "./EmptyState";

type SourceFilter = "all" | string;
type KeywordFilter = "all" | KeywordFilterId;

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
        active
          ? "border-lp-orange/40 bg-lp-orange/15 text-lp-orange"
          : "border-lp-taupe/20 text-lp-taupe/70 hover:border-lp-taupe/30 hover:text-lp-taupe"
      }`}
    >
      {label} <span className={active ? "text-lp-orange/70" : "text-lp-taupe/45"}>{count}</span>
    </button>
  );
}

/** Plain nav pill, no count — used for the time-window row (Slice 7). */
function WindowPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
        active
          ? "border-lp-orange/40 bg-lp-orange/15 text-lp-orange"
          : "border-lp-taupe/20 text-lp-taupe/70 hover:border-lp-taupe/30 hover:text-lp-taupe"
      }`}
    >
      {label}
    </button>
  );
}

/** Reverse-chronological mentions, filterable by source, keyword, and time window via pill rows. */
export default function FeedView({
  mentions,
  excludedMentions,
  windowId,
  truncatedSources,
  attentionOnly = false,
  onClearAttentionOnly,
}: {
  mentions: Mention[];
  excludedMentions: Mention[];
  windowId: WindowId;
  truncatedSources: string[];
  /** Drill-down from the summary strip's "needing attention" count (Slice 7). */
  attentionOnly?: boolean;
  onClearAttentionOnly?: () => void;
}) {
  const router = useRouter();
  const [source, setSource] = useState<SourceFilter>("all");
  const [keyword, setKeyword] = useState<KeywordFilter>("all");
  const [showExcluded, setShowExcluded] = useState(false);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of mentions) c.set(m.source, (c.get(m.source) ?? 0) + 1);
    return c;
  }, [mentions]);

  const keywordCounts = useMemo(() => {
    const c = new Map<KeywordFilterId, number>();
    for (const f of KEYWORD_FILTERS) {
      c.set(f.id, mentions.filter((m) => f.queryMatched.includes(m.query_matched)).length);
    }
    return c;
  }, [mentions]);

  // SOURCES order, but only ones actually present in this batch of mentions.
  const present = SOURCES.filter((s) => counts.has(s.id));
  // KEYWORD_FILTERS order, but only ones with at least one matching mention.
  const presentKeywords = KEYWORD_FILTERS.filter((f) => (keywordCounts.get(f.id) ?? 0) > 0);

  const keywordGroup = KEYWORD_FILTERS.find((f) => f.id === keyword);
  const matchesFilters = (m: Mention) =>
    (source === "all" || m.source === source) &&
    (!keywordGroup || keywordGroup.queryMatched.includes(m.query_matched)) &&
    (!attentionOnly || m.entity_classification === "commentary");

  const filtered = mentions.filter(matchesFilters);
  const filteredExcluded = excludedMentions.filter(matchesFilters);

  // Server-computed window (Slice 7, Phase 3/4) — switching windows navigates
  // so `mentions`/`excludedMentions` arrive pre-filtered from the server;
  // every count derived from them below is already window-consistent.
  const timeWindowRow = (
    <div className="mb-2 flex flex-wrap gap-2">
      {WINDOW_IDS.map((id) => (
        <WindowPill
          key={id}
          label={WINDOW_LABELS[id]}
          active={id === windowId}
          onClick={() => router.push(id === "7d" ? "/" : `/?window=${id}`)}
        />
      ))}
    </div>
  );

  if (mentions.length === 0 && excludedMentions.length === 0) {
    return (
      <div>
        {timeWindowRow}
        <EmptyState
          title="No mentions in this window"
          hint="Sources haven't been polled, or nothing landed in the selected time range. Try a wider window, or “All.”"
        />
      </div>
    );
  }

  return (
    <div>
      {timeWindowRow}

      {truncatedSources.length > 0 && (
        <p className="mb-2 text-[11px] text-lp-taupe/50">
          Showing the most recent 1000 items in this window for:{" "}
          {truncatedSources.map((s) => SOURCES.find((x) => x.id === s)?.label ?? s).join(", ")}.
        </p>
      )}

      {attentionOnly && (
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-lp-orange/40 bg-lp-orange/15 px-3 py-1 text-[12px] font-medium text-lp-orange">
            Needs attention
            {onClearAttentionOnly && (
              <button
                onClick={onClearAttentionOnly}
                aria-label="Clear needs-attention filter"
                className="text-lp-orange/70 hover:text-lp-orange"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <FilterPill
          label="All"
          count={mentions.length}
          active={source === "all"}
          onClick={() => setSource("all")}
        />
        {present.map((s) => (
          <FilterPill
            key={s.id}
            label={s.label}
            count={counts.get(s.id) ?? 0}
            active={source === s.id}
            onClick={() => setSource(s.id)}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill
          label="All keywords"
          count={mentions.length}
          active={keyword === "all"}
          onClick={() => setKeyword("all")}
        />
        {presentKeywords.map((f) => (
          <FilterPill
            key={f.id}
            label={f.label}
            count={keywordCounts.get(f.id) ?? 0}
            active={keyword === f.id}
            onClick={() => setKeyword(f.id)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No mentions match these filters"
          hint={
            attentionOnly
              ? "No commentary-classified items in the last 7 days. Clear the “Needs attention” filter to see everything."
              : "Try a different source or keyword, or switch back to All."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <MentionCard key={m.id} m={m} />
          ))}
        </div>
      )}

      {filteredExcluded.length > 0 && (
        <div className="mt-6 border-t border-lp-taupe/10 pt-4">
          <button
            onClick={() => setShowExcluded((v) => !v)}
            className="text-[12px] font-medium text-lp-taupe/55 hover:text-lp-taupe"
          >
            {showExcluded ? "Hide" : "Show"} {filteredExcluded.length} excluded item
            {filteredExcluded.length === 1 ? "" : "s"}
          </button>
          {showExcluded && (
            <div className="mt-4 space-y-4">
              {filteredExcluded.map((m) => (
                <MentionCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
