import Dashboard from "@/components/Dashboard";
import { getDashboardData } from "@/lib/queries";
import { hasDb } from "@/lib/db";
import { parseWindowId } from "@/lib/timeWindow";

// Always render fresh — this dashboard reflects the latest poll, not a build
// snapshot.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const windowId = parseWindowId((await searchParams).window);
  const { mentions, excludedMentions, health, truncatedSources, summary } =
    await getDashboardData(windowId);

  // Manual refresh runs the live pollers, which need a database to persist into.
  const pollEnabled = hasDb();

  return (
    <Dashboard
      mentions={mentions}
      excludedMentions={excludedMentions}
      health={health}
      pollEnabled={pollEnabled}
      windowId={windowId}
      truncatedSources={truncatedSources}
      summary={summary}
    />
  );
}
