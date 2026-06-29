import type { SourceHealth } from "@/lib/types";
import { SOURCES } from "@/config/sources";

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Loud failure banner. Renders only when a source's most-recent poll_run was an
 * error — so a genuine "zero new mentions" never trips it. Surfaces which
 * source failed and when, and reassures that last-good data is still shown.
 */
export default function ErrorBanner({ health }: { health: SourceHealth[] }) {
  const failed = health.filter((h) => h.state === "error");
  if (failed.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-lp-orange/40 bg-lp-orange/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-lp-orange" />
        <div className="text-[13px] leading-relaxed text-lp-taupe">
          <p className="font-medium text-white">
            {failed.length === 1
              ? "A source failed its last poll."
              : `${failed.length} sources failed their last poll.`}{" "}
            Showing last good data.
          </p>
          <ul className="mt-1 space-y-0.5 text-lp-taupe/75">
            {failed.map((h) => (
              <li key={h.source}>
                <span className="font-medium text-lp-orange">
                  {SOURCE_LABEL[h.source] ?? h.source}
                </span>{" "}
                failed
                {h.lastRun ? ` at ${fmtTime(h.lastRun.ran_at)}` : ""}
                {h.lastRun?.error_message ? ` — ${h.lastRun.error_message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
