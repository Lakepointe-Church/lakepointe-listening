"use client";

import { useState } from "react";

/**
 * Manual "Refresh now" — POSTs to the same guarded poll route the daily cron
 * hits, so staff can trigger an on-demand pull. The route is wired up in
 * Slice 6; until then this reports that polling isn't connected yet rather than
 * pretending to succeed (loud over silent).
 */
export default function RefreshButton({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onClick() {
    if (!enabled) {
      setNote("Polling connects in a later slice — no poll route yet.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/cron/poll", { method: "POST" });
      if (!res.ok) throw new Error(`Poll route returned ${res.status}`);
      // A full reload is the simplest way to re-read freshly polled data.
      window.location.reload();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={busy}
        className="rounded-lg bg-lp-orange px-4 py-2 text-[13px] font-medium text-white transition hover:bg-lp-orange/90 disabled:opacity-60"
      >
        {busy ? "Refreshing…" : "Refresh now"}
      </button>
      {note && <span className="text-[11px] text-lp-taupe/60">{note}</span>}
    </div>
  );
}
