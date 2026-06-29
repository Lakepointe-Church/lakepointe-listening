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
    blurb: "Global news & media articles. No key, no daily cap — the backbone.",
    slice: 2,
  },
  {
    id: "reddit",
    label: "Reddit",
    kind: "live",
    blurb: "Posts & comments across all subreddits via OAuth search.",
    slice: 3,
  },
  {
    id: "youtube",
    label: "YouTube",
    kind: "live",
    blurb: "Videos matching either keyword, newest first.",
    slice: 4,
  },
  {
    id: "google_cse",
    label: "Google Search",
    kind: "live",
    blurb: "Programmable Search across the open web (100 queries/day).",
    slice: 5,
  },
  {
    id: "x",
    label: "X / Twitter",
    kind: "unavailable",
    blurb: "No free API path for mention search — not connected.",
    slice: 6,
  },
  {
    id: "meta",
    label: "Meta",
    kind: "unavailable",
    blurb: "Facebook / Instagram have no free mention search — not connected.",
    slice: 6,
  },
];

/** The two brand terms every source searches for. */
export const KEYWORDS = ["lakepointe church", "josh howerton"] as const;
export type Keyword = (typeof KEYWORDS)[number];
