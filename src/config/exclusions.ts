/**
 * Funeral/obituary exclusion rules (Slice 6). A mention matching either list
 * gets `excluded_reason = 'obituary'` at ingest — filtered from the default
 * feed but never deleted (see src/lib/exclusions.ts).
 *
 * Seed list verified against live Google News data 2026-07-21: the original
 * three (legacy.com, dignitymemorial.com, restlandfuneralhome.com) plus four
 * more funeral-home domains found in existing rows.
 */
export const OBITUARY_DOMAIN_BLOCKLIST: string[] = [
  "legacy.com",
  "dignitymemorial.com",
  "restlandfuneralhome.com",
  "newhopefh.com",
  "westsidechapelfuneralhome.com",
  "neptunesociety.com",
  "mynattfh.com",
];

/** Case-insensitive substring match against the title. */
export const OBITUARY_TITLE_PATTERNS: string[] = [
  "obituary",
  "visitation & funeral",
  "funeral information",
  "funeral home",
];
