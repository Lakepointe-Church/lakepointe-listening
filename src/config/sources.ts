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
    // Demoted to placeholder 2026-07-21 (Slice 6): 16/16 recorded poll_run
    // attempts failed, every single one back to 2026-07-16 — either a
    // straight "fetch failed" or a 429 from GDELT's shared-egress-IP rate
    // limit. Zero mentions ever captured. Not a transient blip; treated the
    // same as X/Meta/websearch until a working vantage point exists.
    kind: "unavailable",
    blurb: "Not reachable from this deployment — 0 successful pulls ever recorded.",
    slice: 2,
  },
  {
    id: "gdelt_watchlist",
    label: "GDELT Watchlist",
    // Demoted alongside gdelt (same root cause) — see comment above.
    kind: "unavailable",
    blurb: "Not reachable from this deployment — 0 successful pulls ever recorded.",
    slice: 2,
  },
  {
    id: "reddit",
    label: "Reddit",
    // Demoted to placeholder 2026-07-13 (403 from Vercel's iad1 datacenter
    // IPs). Re-verified live 2026-07-16 from cle1 (Slice 5 Step 1 egress
    // check) — the block doesn't reproduce from this region, so it's back to
    // "live". Public RSS, no auth; one call per keyword, politely gapped.
    kind: "live",
    blurb: "Posts matching any keyword, newest first.",
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
    id: "google_news",
    label: "Google News",
    kind: "live",
    blurb: "News coverage via Google News search RSS — no key, no daily cap.",
    slice: 6,
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
 *
 * "Live Free" is qualified with "Josh Howerton" — bare "Live Free" is far
 * too generic a phrase to poll on its own (Slice 6, approved).
 */
export const KEYWORDS = [
  '"Lakepointe Church"',
  '"Lake Pointe Church"',
  '"Josh Howerton"',
  '"Live Free" "Josh Howerton"',
] as const;
export type Keyword = (typeof KEYWORDS)[number];

/**
 * Feed keyword-filter groups (Slice 6). Maps a filter chip to the exact
 * `mention.query_matched` values it covers — explicit config, not
 * fuzzy-matching, so variant styling ("Lakepointe Church" / "Lake Pointe
 * Church") groups under one chip without any string heuristics at read time.
 *
 * GDELT's combined-sweep rows (`query_matched` = "keyword (combined)" or
 * "watchlist") don't map to a single phrase and are intentionally left out —
 * they only show up under "All".
 */
export type KeywordFilterId = "lakepointe" | "howerton" | "live-free";

export const KEYWORD_FILTERS: { id: KeywordFilterId; label: string; queryMatched: string[] }[] = [
  {
    id: "lakepointe",
    label: "Lakepointe Church",
    queryMatched: ['"Lakepointe Church"', '"Lake Pointe Church"'],
  },
  {
    id: "howerton",
    label: "Josh Howerton",
    queryMatched: ['"Josh Howerton"'],
  },
  {
    id: "live-free",
    label: "Live Free",
    queryMatched: ['"Live Free" "Josh Howerton"'],
  },
];
