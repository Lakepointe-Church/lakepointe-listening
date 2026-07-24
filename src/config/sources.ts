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
export type SourceKind = "live" | "degraded" | "unavailable" | "manual";

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
    // Demoted 2026-07-21 (Slice 6): 16/16 recorded poll_run attempts failed,
    // every single one back to 2026-07-16 — either a straight "fetch failed"
    // or a 429 from GDELT's shared-egress-IP rate limit. Zero mentions ever
    // captured. Reclassified "unavailable" -> "degraded" in Slice 7 Phase 6:
    // unlike X/Meta/websearch (no free API path exists, full stop), GDELT
    // has a real, working poller (left in place, not deleted) that's simply
    // paused on this known, documented issue — a status line should say so
    // calmly rather than lump it in with "not connected."
    kind: "degraded",
    blurb: "Not reachable from this deployment — 0 successful pulls ever recorded.",
    slice: 2,
  },
  {
    id: "gdelt_watchlist",
    label: "GDELT Watchlist",
    // Demoted alongside gdelt (same root cause) — see comment above.
    kind: "degraded",
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
    // Copy updated Slice 9: this is no longer a dead end — staff cover the
    // gap via "Add mention" (see the Manually monitored section above).
    blurb: "No free API path for automated mention search. Monitored manually by staff — see Manually monitored.",
    slice: 5,
  },
  {
    id: "meta",
    label: "Meta",
    kind: "unavailable",
    blurb: "Facebook / Instagram have no free mention search. Monitored manually by staff — see Manually monitored.",
    slice: 5,
  },
  {
    id: "websearch",
    label: "Web Search",
    kind: "unavailable",
    blurb: "No free API path — Google CSE closed to new projects. Not manually monitored.",
    slice: 5,
  },
  {
    id: "manual_submission",
    label: "Manual submissions",
    // Slice 9: staff-submitted items — private Facebook groups and indirect
    // mentions no poller can ever reach. Not a poll-health tile (no
    // poll_run is ever recorded for this source); the tile shows a volume
    // count instead. See BySourceView for the "Manually monitored" section.
    kind: "manual",
    blurb: "Staff-submitted items from sources with no automated path — Facebook groups, X, newsletters, and more.",
    slice: 9,
  },
];

/**
 * Slice 9: manual_source_type CHECK values, with the label each drives on
 * the source chip and the source-detail field's adaptive prompt ("Which
 * group?" / "Which newsletter?"). Single source of truth for the form
 * picker, MentionCard chip, and the summary-strip byManualType breakdown.
 */
export const MANUAL_SOURCE_TYPES: {
  id: "facebook-group" | "x" | "newsletter" | "news-article" | "podcast" | "other";
  label: string;
  detailLabel: string;
  requiresUrl: boolean;
  // Byline preposition on the card, e.g. "in Rockwall Word of Mouth" /
  // "by Mary DeMuth's Substack" (Phase 3.1's own worked examples).
  bylinePreposition: string;
}[] = [
  { id: "facebook-group", label: "Facebook group", detailLabel: "Which group?", requiresUrl: false, bylinePreposition: "in" },
  { id: "x", label: "X", detailLabel: "Which account? (optional)", requiresUrl: true, bylinePreposition: "on" },
  { id: "newsletter", label: "Newsletter", detailLabel: "Which newsletter?", requiresUrl: true, bylinePreposition: "by" },
  { id: "news-article", label: "News article", detailLabel: "Which outlet? (optional)", requiresUrl: true, bylinePreposition: "via" },
  { id: "podcast", label: "Podcast", detailLabel: "Which show?", requiresUrl: true, bylinePreposition: "on" },
  { id: "other", label: "Other", detailLabel: "Source detail", requiresUrl: true, bylinePreposition: "via" },
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
