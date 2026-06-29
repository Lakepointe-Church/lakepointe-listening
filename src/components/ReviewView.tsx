import type { Mention } from "@/lib/types";
import MentionCard from "./MentionCard";
import EmptyState from "./EmptyState";

/**
 * Review queue — mentions with status='new'. The mark reviewed/dismissed
 * workflow (optimistic UI, persisted to Neon) is wired once there's live data;
 * Slice 1 ships the empty state.
 */
export default function ReviewView({ mentions }: { mentions: Mention[] }) {
  const queue = mentions.filter((m) => m.status === "new");

  if (queue.length === 0) {
    return (
      <EmptyState
        title="Review queue is empty"
        hint="New mentions waiting for a look will appear here, with buttons to mark them reviewed or dismissed."
      />
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((m) => (
        <MentionCard key={m.id} m={m} />
      ))}
    </div>
  );
}
