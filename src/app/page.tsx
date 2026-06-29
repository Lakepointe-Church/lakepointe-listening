import Dashboard from "@/components/Dashboard";
import { getDashboardData } from "@/lib/queries";

// Always render fresh — this dashboard reflects the latest poll, not a build
// snapshot.
export const dynamic = "force-dynamic";

export default async function Page() {
  const { mentions, health } = await getDashboardData();

  // The poll route is wired in Slice 6; until then the Refresh button reports
  // that polling isn't connected rather than hitting a 404.
  const pollEnabled = false;

  return (
    <Dashboard mentions={mentions} health={health} pollEnabled={pollEnabled} />
  );
}
