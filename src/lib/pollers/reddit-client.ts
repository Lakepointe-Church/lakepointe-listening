import "server-only";
import { XMLParser } from "fast-xml-parser";

/**
 * Reddit public search RSS client (no auth — self-serve OAuth app creation is
 * dead per Reddit's Responsible Builder Policy). Uses fast-xml-parser 5.10.0;
 * option names (`ignoreAttributes`, `attributeNamePrefix`, `textNodeName`)
 * confirmed against the installed package's src/fxp.d.ts, not from memory.
 *
 * Re-verified live 2026-07-16 (Slice 5 build prompt), superseding the prior
 * session's combined-OR-query design:
 *   - UA and endpoint reconfirmed from a live curl:
 *     `https://www.reddit.com/search.rss?q=...&sort=new` with
 *     `lakepointe-listening/1.0 (internal brand monitor)`.
 *   - Egress from Vercel (cle1) was reconfirmed reachable in this session's
 *     Step 1 (src/app/api/cron/egress-check/route.ts) — the prior demotion to
 *     a placeholder tile (403 from iad1) does not reproduce from cle1.
 *   - One call PER KEYWORDS entry (not one OR-combined call) per this
 *     session's spec, with an explicit ≥2s politeness gap between
 *     consecutive requests to reddit.com within a run — see `politeGap`.
 *   - Feed mixes result kinds: entries with `<id>` prefixed `t5_` are
 *     subreddit/community results, not posts; only `t3_`-prefixed entries
 *     are posts (unchanged from the prior session's finding).
 *   - `<published>` and `<updated>` were identical across all 22 real t3_
 *     posts in this session's live pull — `published` is used per spec
 *     (post creation time, not last-edit time), falling back to `updated`
 *     for the (unverified) case where they'd ever diverge.
 *   - `<category term="..." label="r/...">` carries the subreddit: `term` is
 *     the bare name (e.g. "Christianmarriage"), `label` adds the "r/" prefix
 *     — confirmed live.
 *   - No official rate-limit docs exist for this unauthenticated endpoint,
 *     but live responses carry `x-ratelimit-*` headers, and a second request
 *     made ~2s after a first (while `x-ratelimit-remaining: 0.0` was still in
 *     effect) came back HTTP 200 with a completely EMPTY body — not a 429,
 *     not valid XML, not an empty-but-valid feed. fast-xml-parser silently
 *     returns `{}` for that, so `!parsed.feed` is the loud-error signal here,
 *     distinct from "valid feed, no <entry>" (genuine zero).
 */

const ENDPOINT = "https://www.reddit.com/search.rss";
const USER_AGENT = "lakepointe-listening/1.0 (internal brand monitor)";

/** Minimum gap between consecutive requests to reddit.com within one run (spec: "≥2s"). */
const MIN_GAP_MS = 2000;
let lastCallAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  published?: string;
  updated?: string;
  category?: { "@_term"?: string; "@_label"?: string };
  content?: { "#text"?: string } | string;
};

/** Thrown on HTTP 429 or an empty/unparseable body — both are the live rate-limit signature. */
export class RedditRateLimitError extends Error {}

/**
 * One search.rss call for a single keyword phrase, gapped ≥2s from the
 * previous call to this host within the run (politeness, not a rate-limit
 * workaround — no retry here; a 429 or the empty-body signature both throw
 * RedditRateLimitError and the caller decides whether to keep going).
 */
export async function fetchRedditEntries(query: string): Promise<RedditEntry[]> {
  const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
  if (lastCallAt > 0 && wait > 0) await sleep(wait);
  lastCallAt = Date.now();

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
