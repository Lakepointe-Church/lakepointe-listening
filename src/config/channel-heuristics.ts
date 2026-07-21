/**
 * YouTube channel-reputation auto-classification (Slice 6, Phase 4).
 *
 * A brand-new channel (no existing channel_reputation row) whose title
 * contains any of these terms, case-insensitive, defaults to `reupload` —
 * these are almost always stolen-clip or full-sermon rehosts, not official
 * Lakepointe channels (those get classified `owned` explicitly, never by this
 * heuristic) and not third-party commentary (those don't brand themselves
 * with Josh Howerton's name). Every other new channel defaults to
 * `unclassified`. Human triage (the feed card control) always wins over this
 * heuristic — it only seeds the FIRST time a channel is seen.
 */
export const CHANNEL_REUPLOAD_HEURISTIC_TERMS: string[] = [
  "Josh Howerton",
  "Howerton",
  "Lakepointe",
  "Lake Pointe",
  "PJH",
];
