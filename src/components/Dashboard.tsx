"use client";

import { useState } from "react";
import type { Mention, SourceHealth } from "@/lib/types";
import RefreshButton from "./RefreshButton";
import ErrorBanner from "./ErrorBanner";
import FeedView from "./FeedView";
import BySourceView from "./BySourceView";
import ReviewView from "./ReviewView";

type Tab = "feed" | "bysource" | "review";

const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "bysource", label: "By source" },
  { id: "review", label: "Review queue" },
];

export default function Dashboard({
  mentions,
  health,
  pollEnabled,
}: {
  mentions: Mention[];
  health: SourceHealth[];
  pollEnabled: boolean;
}) {
  const [tab, setTab] = useState<Tab>("feed");
  const reviewCount = mentions.filter((m) => m.status === "new").length;

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

      <ErrorBanner health={health} />

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
              {t.id === "review" && reviewCount > 0 && (
                <span className="ml-1.5 rounded-full bg-lp-orange/20 px-1.5 py-0.5 text-[11px] text-lp-orange">
                  {reviewCount}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-lp-orange" />
              )}
            </button>
          );
        })}
      </nav>

      {tab === "feed" && <FeedView mentions={mentions} />}
      {tab === "bysource" && <BySourceView health={health} />}
      {tab === "review" && <ReviewView mentions={mentions} />}
    </div>
  );
}
