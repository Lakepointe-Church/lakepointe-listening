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
  excluded_reason: string | null; // 'obituary' | 'owned-channel' | 'reupload-channel' | null
  channel_id: string | null; // youtube only, captured going forward
};

export type ChannelClassification =
  | "owned"
  | "reupload"
  | "commentary"
  | "other-church"
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
