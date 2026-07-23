"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Mention, SourceHealth, SummaryStats } from "@/lib/types";
import type { WindowId } from "@/lib/timeWindow";
import RefreshButton from "./RefreshButton";
import SourceStatusLine from "./SourceStatusLine";
import SummaryStrip from "./SummaryStrip";
import FeedView from "./FeedView";
import BySourceView from "./BySourceView";

type Tab = "feed" | "bysource";

const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "bysource", label: "Connected sources" },
];

export default function Dashboard({
  mentions,
  excludedMentions,
  health,
  pollEnabled,
  windowId,
  truncatedSources,
  summary,
}: {
  mentions: Mention[];
  excludedMentions: Mention[];
  health: SourceHealth[];
  pollEnabled: boolean;
  windowId: WindowId;
  truncatedSources: string[];
  summary: SummaryStats;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("feed");
  const [attentionOnly, setAttentionOnly] = useState(false);

  // "Needing attention" is always trailing-7-days (see SummaryStrip) — force
  // the feed to the matching 7d window so the drill-down list can't show
  // more items than the number the user just clicked.
  function handleNeedsAttentionClick() {
    setTab("feed");
    setAttentionOnly(true);
    if (windowId !== "7d") router.push("/");
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Lakepointe <span className="text-lp-orange">Listening</span>
          </h1>
          <p className="mt-1 text-[13px] text-lp-taupe/60">
            Brand & name monitoring — mentions of “Lakepointe Church” and “Josh
            Howerton” across the open web.
          </p>
        </div>
        <RefreshButton enabled={pollEnabled} />
      </header>

      <SourceStatusLine health={health} />
      <SummaryStrip summary={summary} onNeedsAttentionClick={handleNeedsAttentionClick} />

      <nav className="mb-6 flex gap-1 border-b border-lp-taupe/15">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2.5 text-[13px] font-medium transition ${
                active
                  ? "text-lp-orange"
                  : "text-lp-taupe/60 hover:text-lp-taupe"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-lp-orange" />
              )}
            </button>
          );
        })}
      </nav>

      {tab === "feed" && (
        <FeedView
          mentions={mentions}
          excludedMentions={excludedMentions}
          windowId={windowId}
          truncatedSources={truncatedSources}
          attentionOnly={attentionOnly}
          onClearAttentionOnly={() => setAttentionOnly(false)}
        />
      )}
      {tab === "bysource" && <BySourceView health={health} />}
    </div>
  );
}
