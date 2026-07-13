"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshNow } from "@/app/actions";

/**
 * Manual "Refresh now" — runs the same orchestrator as the daily cron via a
 * Server Action (guarded server-side; no secret in the browser). Reports the
 * outcome loudly: new-mention count on success, the source error on failure.
 */
export default function RefreshButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function onClick() {
    if (!enabled) {
      setNote("No sources are connected yet.");
      return;
    }
    setNote(null);
    startTransition(async () => {
      try {
        const res = await refreshNow();
        if (!res.ok) {
          setNote(res.errors[0] ?? "A source failed — see the banner.");
        } else {
          setNote(
            res.newTotal > 0
              ? `Added ${res.newTotal} new mention${res.newTotal === 1 ? "" : "s"}.`
              : "No new mentions.",
          );
        }
        router.refresh();
      } catch (err) {
        setNote(err instanceof Error ? err.message : "Refresh failed.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={pending}
        className="rounded-lg bg-lp-orange px-4 py-2 text-[13px] font-medium text-white transition hover:bg-lp-orange/90 disabled:opacity-60"
      >
        {pending ? "Refreshing…" : "Refresh now"}
      </button>
      {note && <span className="text-[11px] text-lp-taupe/60">{note}</span>}
    </div>
  );
}
