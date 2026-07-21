"use client";

import { useMemo, useState } from "react";
import type { Mention } from "@/lib/types";
import { SOURCES } from "@/config/sources";
import MentionCard from "./MentionCard";
import EmptyState from "./EmptyState";

type SourceFilter = "all" | string;

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

/** Reverse-chronological mentions, filterable by source via a pill row. */
export default function FeedView({ mentions }: { mentions: Mention[] }) {
  const [source, setSource] = useState<SourceFilter>("all");

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of mentions) c.set(m.source, (c.get(m.source) ?? 0) + 1);
    return c;
  }, [mentions]);

  // SOURCES order, but only ones actually present in this batch of mentions.
  const present = SOURCES.filter((s) => counts.has(s.id));

  if (mentions.length === 0) {
    return (
      <EmptyState
        title="No mentions yet"
        hint="Sources haven't been polled. Once GDELT and the others run, mentions of “Lakepointe Church” and “Josh Howerton” land here, newest first."
      />
    );
  }

  const filtered = source === "all" ? mentions : mentions.filter((m) => m.source === source);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
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

      {filtered.length === 0 ? (
        <EmptyState
          title="No mentions from this source"
          hint="Try a different source, or switch back to All."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <MentionCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
