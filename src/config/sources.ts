/**
 * Single source of truth for the sources this dashboard monitors.
 *
 * `kind`:
 *   - "live"        → has (or will have) a real poller; shows a health tile.
 *   - "unavailable" → no free API path exists (X/Twitter, Meta). Renders as a
 *                     "not connected" placeholder. We never fake data for these.
 *
 * Pollers are wired in later slices; in Slice 1 every live source reads as
 * "not yet polled".
 */
export type SourceKind = "live" | "unavailable";

export type SourceDef = {
  id: string; // matches mention.source / poll_run.source
  label: string;
  kind: SourceKind;
  blurb: string; // one-line description of what it watches
  slice: number; // build slice that lights it up (for our own tracking)
};

export const SOURCES: SourceDef[] = [
  {
    id: "gdelt",
    label: "GDELT",
    kind: "live",
    blurb: "News outlets only — the tripwire backbone. No key, no daily cap.",
    slice: 2,
  },
  {
    id: "gdelt_watchlist",
    label: "GDELT Watchlist",
    kind: "live",
    blurb: "Watchlist domains, news only — curated outlets most likely to cover us.",
    slice: 2,
  },
  {
    id: "reddit",
    label: "Reddit",
    // Demoted to placeholder 2026-07-13: Reddit 403-blocks Vercel's
    // datacenter IPs (verified live — works from residential networks, block
    // page from the deployed function). The poller (pollers/reddit.ts) is
    // built and live-verified; re-enable by flipping this to "live" and
    // re-adding redditPoller to the POLLERS registry if the tool ever gets a
    // non-datacenter egress (external scheduler, F5 API upgrade, etc.).
    kind: "unavailable",
    blurb: "Public RSS is blocked from cloud IPs — not connected.",
    slice: 3,
  },
  {
    id: "youtube",
    label: "YouTube",
    kind: "live",
    blurb: "Videos matching any keyword, newest first.",
    slice: 4,
  },
  {
    id: "x",
    label: "X / Twitter",
    kind: "unavailable",
    blurb: "No free API path for mention search — not connected.",
    slice: 5,
  },
  {
    id: "meta",
    label: "Meta",
    kind: "unavailable",
    blurb: "Facebook / Instagram have no free mention search — not connected.",
    slice: 5,
  },
  {
    id: "websearch",
    label: "Web Search",
    kind: "unavailable",
    blurb: "No free API path — not connected. Google CSE closed to new projects.",
    slice: 5,
  },
];

/**
 * Brand terms every poller searches for. Single source of truth — pollers
 * must not hardcode terms. Includes the legacy "Lake Pointe" (two-word)
 * styling still in the wild.
 */
export const KEYWORDS = [
  '"Lakepointe Church"',
  '"Lake Pointe Church"',
  '"Josh Howerton"',
] as const;
export type Keyword = (typeof KEYWORDS)[number];
