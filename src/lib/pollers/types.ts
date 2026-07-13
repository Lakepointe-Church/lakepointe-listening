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
};

/**
 * A poller fetches from one source and returns normalized mentions. It should
 * throw on a hard failure (network error, non-OK HTTP, rate limit) so the
 * orchestrator records a loud `error` poll_run — never swallow and return [].
 * Returning an empty array means a genuine "zero new mentions".
 */
export type Poller = {
  id: string; // matches mention.source / poll_run.source
  label: string;
  run: () => Promise<MentionInput[]>;
};
