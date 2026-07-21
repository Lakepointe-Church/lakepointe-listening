"use client";

import { useState, useTransition } from "react";
import { classifyChannel } from "@/app/actions";
import type { ChannelClassification } from "@/lib/types";

const OPTIONS: { id: ChannelClassification; label: string }[] = [
  { id: "reupload", label: "Reupload" },
  { id: "commentary", label: "Commentary" },
  { id: "owned", label: "Owned" },
  { id: "other-church", label: "Other church" },
];

/**
 * Per-channel triage control on YouTube feed cards (Slice 6, Phase 4). Sets
 * the channel's classification for ALL of its items, existing and future —
 * this is the only way `channel_reputation` gets populated beyond the
 * ingest-time heuristic; no content-similarity detection.
 */
export default function ChannelTriage({ channelTitle }: { channelTitle: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function set(classification: ChannelClassification) {
    setNote(null);
    startTransition(async () => {
      await classifyChannel(channelTitle, classification);
      setNote(`Marked ${classification}`);
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-lp-taupe/10 pt-2.5 text-[11px]">
      <span className="text-lp-taupe/45">Channel:</span>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => set(o.id)}
          disabled={pending}
          className="rounded-full border border-lp-taupe/20 px-2 py-0.5 font-medium text-lp-taupe/70 transition hover:border-lp-orange/40 hover:text-lp-orange disabled:opacity-50"
        >
          {o.label}
        </button>
      ))}
      {note && <span className="text-lp-taupe/45">{note}</span>}
    </div>
  );
}
