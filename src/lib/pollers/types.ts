/** Contract every source poller implements. */

/** A normalized mention, ready to insert into the `mention` table. */
export type MentionInput = {
  source: string;
  source_uid: string; // platform-native stable dedup key
  url: string;
  title: string | null;
  excerpt: string | null;
  author: string | null;
  query_matched: string; // which keyword matched
  published_at: string | null; // ISO 8601, or null if the source has no date
  title_match?: boolean; // google_news only: keyword found in title (UI sort hint, never a filter)
  subreddit?: string | null; // reddit only: bare subreddit name from <category term>
  domain?: string | null; // google_news / gdelt / gdelt_watchlist: publisher domain, for exclusion rules
  channel_id?: string | null; // youtube only: stable channel id, captured going forward (legacy rows have none)
};

/**
 * What one poller run produced. `error` set = the run FAILED loudly (the
 * orchestrator records an `error` poll_run) — but any mentions fetched
 * before the failure are still persisted (partial success is success).
 * No `error` + empty mentions = a genuine "zero new mentions".
 */
export type PollOutcome = {
  mentions: MentionInput[];
  error?: string;
};

/**
 * A poller fetches from one source and returns normalized mentions. For a
 * mid-run failure (e.g. rate-limited on keyword 2 of 3), return the mentions
 * collected so far WITH `error` set — never swallow the failure, and never
 * discard already-fetched data. Throwing also records a loud error, but
 * loses partials; prefer it only for failures where nothing was fetched.
 */
export type Poller = {
  id: string; // matches mention.source / poll_run.source
  label: string;
  /** Overrides the orchestrator's default per-source time budget (ms). */
  budgetMs?: number;
  run: () => Promise<PollOutcome>;
};
