import type { MentionInput, Poller } from "./types";
import { WATCHLIST_DOMAINS } from "@/config/watchlist-domains";
import { fetchGdeltArticles, parseSeendate } from "./gdelt-client";

// GDELT DOC 2.0 watchlist sweep — the CSE replacement: restricts the same
// keyword group to a curated list of domains (search-domains.md) via
// `domainis:`, catching outlet coverage that the bare keyword sweep's
// article-level matching might rank past `maxrecords=250`. Same 2-day
// window and shared ≥5.5s-spaced client as the keyword sweep (gdelt.ts).
//
// Term group is bare/short forms per REV4's example query, not the
// keyword-sweep's full exact phrases:
//   query=(("Lakepointe" OR "Lake Pointe" OR "Howerton")) (domainis:a.com OR domainis:b.com)
//
// Batching: REV4 flags the OR-of-domainis chain as unverified and says to
// split into 2-3 calls if GDELT rejects a long chain. This sandbox couldn't
// get a live 200 to find the actual limit (see gdelt-client.ts) — chunking
// into 3 conservative batches of 20 is a defensive choice, not a confirmed
// one. Revisit batch size once a real response is available.
const WATCHLIST_TERMS = ["Lakepointe", "Lake Pointe", "Howerton"];
const BATCH_SIZE = 20;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const gdeltWatchlistPoller: Poller = {
  id: "gdelt_watchlist",
  label: "GDELT Watchlist",
  async run() {
    const out: MentionInput[] = [];
    const termGroup = `(${WATCHLIST_TERMS.map((t) => `"${t}"`).join(" OR ")})`;

    for (const batch of chunk(WATCHLIST_DOMAINS, BATCH_SIZE)) {
      const domainGroup = `(${batch.map((d) => `domainis:${d}`).join(" OR ")})`;
      const query = `(${termGroup}) ${domainGroup}`;
      const articles = await fetchGdeltArticles(query);
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
        });
      }
    }
    return out;
  },
};
