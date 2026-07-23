/** Row shapes shared between the pollers, the API routes, and the UI. */

export type MentionStatus = "new" | "reviewed" | "dismissed";

export type Mention = {
  id: string;
  source: string;
  source_uid: string;
  url: string;
  title: string | null;
  excerpt: string | null;
  author: string | null;
  query_matched: string;
  published_at: string | null; // ISO
  fetched_at: string; // ISO
  sentiment: string | null; // NULL in v1
  status: MentionStatus;
  title_match: boolean | null; // google_news only
  subreddit: string | null; // reddit only
  domain: string | null; // google_news only: publisher domain (Slice 7)
  // Stored on the row: 'obituary' | 'manual' | null (see mention_excluded_reason_check).
  // Entity-classification exclusions ('owned-entity' | 'reupload-entity' | 'wrong-entity')
  // are never stored — derived live via the entity_reputation JOIN in queries.ts, so
  // reclassifying an entity retroactively changes visibility with no backfill.
  excluded_reason: string | null;
  channel_id: string | null; // youtube only, captured going forward
  // Slice 7: raw entity_reputation classification (null = no row = unclassified
  // and not yet triaged), independent of whether it results in exclusion —
  // this is what the triage badge displays.
  entity_classification: EntityClassification | null;
};

/** Slice 7: generalized beyond YouTube channels to any (source, entity_key) pair. */
export type EntityClassification =
  | "owned"
  | "reupload"
  | "commentary"
  | "wrong-entity"
  | "unclassified";

export type PollStatus = "ok" | "error";

export type PollRun = {
  id: string;
  source: string;
  ran_at: string; // ISO
  status: PollStatus;
  new_mentions: number;
  error_message: string | null;
  duration_ms: number | null;
};

/**
 * Per-source health, derived from the most-recent poll_run. `state` collapses
 * the run into the three things the UI cares about:
 *   - "never"  → no run yet (Slice 1, or a source not yet built)
 *   - "ok"     → last run succeeded with ≥1 new mention
 *   - "zero"   → last run succeeded but found nothing new (a genuine zero)
 *   - "error"  → last run failed (loud — surfaced in a banner)
 */
export type SourceHealthState = "never" | "ok" | "zero" | "error";

export type SourceHealth = {
  source: string;
  state: SourceHealthState;
  lastRun: PollRun | null;
};

/**
 * Slice 7, Phase 5 — executive summary strip. Always trailing-7-vs-prior-7
 * from now, regardless of the feed's active time-window filter (it's a
 * pulse, not a filter readout). Computed over non-excluded mentions only
 * (same derived entity-classification exclusion as the feed).
 */
export type SummaryStats = {
  currentWeekTotal: number;
  priorWeekTotal: number;
  bySource: { source: string; count: number }[]; // trailing 7 days
  needsAttention: number; // trailing 7 days, commentary-classified entities
};
