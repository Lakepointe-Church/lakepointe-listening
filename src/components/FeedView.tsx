import type { Mention } from "@/lib/types";
import MentionCard from "./MentionCard";
import EmptyState from "./EmptyState";

/**
 * Reverse-chronological mentions. Slice 1 ships the empty state; filters
 * (source / keyword / status) arrive once there's live data to filter.
 */
export default function FeedView({ mentions }: { mentions: Mention[] }) {
  if (mentions.length === 0) {
    return (
      <EmptyState
        title="No mentions yet"
        hint="Sources haven't been polled. Once GDELT and the others run, mentions of “Lakepointe Church” and “Josh Howerton” land here, newest first."
      />
    );
  }

  return (
    <div className="space-y-4">
      {mentions.map((m) => (
        <MentionCard key={m.id} m={m} />
      ))}
    </div>
  );
}
