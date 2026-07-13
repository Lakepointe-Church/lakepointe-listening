import Dashboard from "@/components/Dashboard";
import { getDashboardData } from "@/lib/queries";
import { hasDb } from "@/lib/db";

// Always render fresh — this dashboard reflects the latest poll, not a build
// snapshot.
export const dynamic = "force-dynamic";

export default async function Page() {
  const { mentions, health } = await getDashboardData();

  // Manual refresh runs the live pollers, which need a database to persist into.
  const pollEnabled = hasDb();

  return (
    <Dashboard mentions={mentions} health={health} pollEnabled={pollEnabled} />
  );
}
