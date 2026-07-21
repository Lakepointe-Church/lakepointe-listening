import type { MentionInput, Poller } from "./types";
import { WATCHLIST_DOMAINS } from "@/config/watchlist-domains";
import { fetchGdeltArticles, GdeltRateLimitError, parseSeendate } from "./gdelt-client";

// GDELT DOC 2.0 watchlist sweep — the CSE replacement: restricts the same
// keyword group to a curated list of domains (search-domains.md) via
// `domainis:`, catching outlet coverage that the bare keyword sweep's
// article-level matching might rank past `maxrecords=250`. Same 2-day
// window and shared ≥5.5s-spaced client as the keyword sweep (gdelt.ts).
//
// Query shape — ONE level of parentheses per OR group:
//   ("Lakepointe" OR "Lake Pointe" OR "Howerton") (domainis:a.com OR domainis:b.com)
// GDELT's docs state "Boolean OR blocks cannot be nested at this time", and
// the first deployed run (July 13, 2026) proved it: REV4's double-parenthesed
// example query was rejected with GDELT's generic parse error ("Your query
// was too short or too long") — that message is about parsing, not length.
//
// Batching: no query-length limit is documented anywhere, and no vantage
// point available to this session could bisect one (GDELT 429s every shared
// egress IP; see git history). So the batcher self-adapts: if GDELT rejects
// a batch with the parse error, the batch is split in half and retried
// (still ≥5.5s-spaced — this is a deterministic parse rejection, NOT rate
// limiting, so splitting doesn't violate the never-retry-hammer rule). A 429
// still aborts the whole sweep loudly.
const WATCHLIST_TERMS = ["Lakepointe", "Lake Pointe", "Howerton"];
const BATCH_SIZE = 20;
const MIN_BATCH = 2;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isParseRejection(err: unknown): boolean {
  return err instanceof Error && !(err instanceof GdeltRateLimitError) &&
    err.message.toLowerCase().includes("too short or too long");
}

export const gdeltWatchlistPoller: Poller = {
  id: "gdelt_watchlist",
  label: "GDELT Watchlist",
  // Worst case (429 retries and/or adaptive splitting) needs more than the
  // default 60s at ≥5.5s per call; the run still sits under the 300s cap.
  budgetMs: 150_000,
  async run() {
    const out: MentionInput[] = [];
    const termGroup = `(${WATCHLIST_TERMS.map((t) => `"${t}"`).join(" OR ")})`;

    const queue = chunk(WATCHLIST_DOMAINS, BATCH_SIZE);
    while (queue.length > 0) {
      const batch = queue.shift()!;
      const domainGroup = `(${batch.map((d) => `domainis:${d}`).join(" OR ")})`;
      const query = `${termGroup} ${domainGroup}`;

      let articles;
      try {
        articles = await fetchGdeltArticles(query);
      } catch (err) {
        if (isParseRejection(err) && batch.length >= MIN_BATCH * 2) {
          const mid = Math.ceil(batch.length / 2);
          queue.unshift(batch.slice(0, mid), batch.slice(mid));
          continue;
        }
        // Persistent 429 (or floor-size rejection) mid-sweep: keep the
        // batches already fetched, fail loudly for the run.
        return {
          mentions: out,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      for (const a of articles) {
        if (!a.url) continue;
        out.push({
          source: "gdelt_watchlist",
          source_uid: a.url,
          url: a.url,
          title: a.title?.trim() || null,
          excerpt: a.domain ? `via ${a.domain}` : null,
          author: null,
          query_matched: "watchlist",
          published_at: parseSeendate(a.seendate),
          domain: a.domain ?? null,
        });
      }
    }
    return { mentions: out };
  },
};
