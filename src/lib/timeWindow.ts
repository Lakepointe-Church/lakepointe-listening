/** Slice 7: feed time-window filter, shared between the page and the query layer. */
export type WindowId = "7d" | "30d" | "90d" | "all";

export const WINDOW_IDS: WindowId[] = ["7d", "30d", "90d", "all"];

export const WINDOW_LABELS: Record<WindowId, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All",
};

const WINDOW_DAYS: Record<Exclude<WindowId, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** The cutoff timestamp for a window, or null for "all" (no lower bound). */
export function windowSince(id: WindowId): Date | null {
  if (id === "all") return null;
  return new Date(Date.now() - WINDOW_DAYS[id] * 24 * 60 * 60 * 1000);
}

export function parseWindowId(value: string | undefined): WindowId {
  return value && (WINDOW_IDS as string[]).includes(value) ? (value as WindowId) : "7d";
}
