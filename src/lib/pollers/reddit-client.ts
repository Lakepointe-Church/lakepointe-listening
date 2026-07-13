import "server-only";
import { XMLParser } from "fast-xml-parser";

/**
 * Reddit public search RSS client (no auth — self-serve OAuth app creation is
 * dead per Reddit's Responsible Builder Policy). Uses fast-xml-parser 5.10.0;
 * option names (`ignoreAttributes`, `attributeNamePrefix`, `textNodeName`)
 * confirmed against the installed package's src/fxp.d.ts, not from memory.
 *
 * Verified live (this session, July 2026) against
 * https://www.reddit.com/search.rss?q=...&sort=new for all three KEYWORDS
 * entries, separately and OR-combined in one query:
 *   - Feed mixes result kinds: entries with `<id>` prefixed `t5_` are
 *     subreddit/community results, not posts. REV4's field mapping assumed
 *     `t3_` fullnames throughout; only `t3_`-prefixed entries are posts —
 *     `t5_` entries must be filtered out or they'd be mis-mapped as posts.
 *   - `<link href>` is the Reddit comments permalink (not the external URL
 *     the post links to, which — if any — is only reachable by scraping the
 *     `<content>` HTML). Using the permalink as `url` matches REV4's mapping
 *     and is always present, unlike an external link.
 *   - `<updated>` is already ISO 8601 with a numeric offset (e.g.
 *     "2026-07-09T16:58:00+00:00") — no custom parsing needed, unlike
 *     GDELT's compact seendate format.
 *   - No official rate-limit docs exist for this unauthenticated endpoint,
 *     but live responses carry `x-ratelimit-*` headers, and a second request
 *     made ~2s after a first (while `x-ratelimit-remaining: 0.0` was still in
 *     effect, ~50-60s reset window) came back HTTP 200 with a completely
 *     EMPTY body — not a 429, not valid XML, not an empty-but-valid feed.
 *     fast-xml-parser silently returns `{}` for that, so `!parsed.feed` is
 *     the loud-error signal here, distinct from "valid feed, no <entry>"
 *     (genuine zero results).
 *   - A single OR-combined query (`"a" OR "b" OR "c"`) returns real matches
 *     for all three KEYWORDS terms in one call (spot-checked: a result whose
 *     title had no obvious brand terms turned out to mention "Pastor Josh
 *     Howerton" in the body). One combined call per run — vs. one call per
 *     keyword like the GDELT pollers — sidesteps the ~50-60s per-request
 *     throttle window entirely fitting comfortably in the 60s per-source
 *     budget. Trade-off: Reddit's result cap (observed ~22-24 entries per
 *     feed regardless of query) is shared across all three terms instead of
 *     each getting its own window, so a spike in one term's matches could
 *     in theory crowd out another's. Flagged, not solved — acceptable for a
 *     v1, once-daily, 2-day-lookback tool.
 */

const ENDPOINT = "https://www.reddit.com/search.rss";
const USER_AGENT = "web:lakepointe-listening:v1.0 (internal monitoring)";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

export type RedditEntry = {
  id?: string;
  title?: string;
  link?: { "@_href"?: string };
  author?: { name?: string };
  updated?: string;
  content?: { "#text"?: string } | string;
};

/** Thrown on HTTP 429 or an empty/unparseable body — both are the live rate-limit signature. */
export class RedditRateLimitError extends Error {}

/**
 * One search.rss call. Throws RedditRateLimitError on 429 or an empty/
 * malformed body (see module doc — Reddit returns 200 with no body when
 * called inside its undocumented throttle window, not a 429). Throws a plain
 * Error on any other non-OK HTTP. A valid feed with no `<entry>` at all is a
 * genuine zero and returns [].
 */
export async function fetchRedditEntries(query: string): Promise<RedditEntry[]> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&sort=new`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  const body = await res.text();

  if (res.status === 429) {
    throw new RedditRateLimitError(`Reddit RSS rate limit for "${query}": ${body.slice(0, 160)}`);
  }
  if (!res.ok) {
    throw new Error(`Reddit RSS HTTP ${res.status} for "${query}": ${body.slice(0, 160)}`);
  }

  const parsed = parser.parse(body) as { feed?: { entry?: RedditEntry | RedditEntry[] } };
  if (!parsed.feed) {
    throw new RedditRateLimitError(
      `Reddit RSS returned an empty/unparseable body for "${query}" (HTTP ${res.status}) — ` +
        `likely the undocumented per-request throttle, not a genuine zero`,
    );
  }

  const entry = parsed.feed.entry;
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}
