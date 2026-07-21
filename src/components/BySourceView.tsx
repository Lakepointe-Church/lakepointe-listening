import { SOURCES } from "@/config/sources";
import type { SourceHealth } from "@/lib/types";
import SourceTile from "./SourceTile";

/**
 * At-a-glance health view. One tile per source; a stale, failed, or not-yet-
 * polled source must be obvious. Live sources first, then the "not connected"
 * placeholders.
 */
export default function BySourceView({ health }: { health: SourceHealth[] }) {
  const byId = new Map(health.map((h) => [h.source, h]));
  const live = SOURCES.filter((s) => s.kind === "live");
  const unavailable = SOURCES.filter((s) => s.kind === "unavailable");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-lp-taupe/55">
          Connected sources
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((def) => (
            <SourceTile key={def.id} def={def} health={byId.get(def.id)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-lp-taupe/55">
          Not connected
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {unavailable.map((def) => (
            <SourceTile key={def.id} def={def} health={byId.get(def.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}
