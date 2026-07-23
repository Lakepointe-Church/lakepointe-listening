import "server-only";
import { XMLParser } from "fast-xml-parser";
import { formatPollError } from "./formatPollError";

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
 *     session's spec, with an explicit ≥2s politeness floor between
 *     consecutive requests — see MIN_GAP_MS.
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
 *
 * RATE LIMIT (re-verified live after the first deployed run of this slice
 * hit it): the ≥2s spec floor is NOT enough — every successful call leaves
 * `x-ratelimit-remaining: 0.0`, so a second call within the SAME window
 * 429s immediately. But the endpoint tells you exactly how long to wait:
 * `x-ratelimit-reset` (seconds) was observed at 20/20/14 in one live test
 * and 36/34/56/58 in another — variable, NOT a fixed ~20s or the ~50-60s
 * the prior session assumed. Waiting the reported reset (+2s buffer) and
 * retrying ONCE cleared it every time across both tests (a live run of all
 * 3 KEYWORDS entries: keyword 1 clean, keywords 2 and 3 each 429'd once
 * then succeeded on retry). So: on a 429 (or the empty-body throttle
 * signature below, which carries the same header if present), read
 * `x-ratelimit-reset` and wait that long before the one retry, rather than
 * a blind fixed delay — bounded to [5s, 60s] in case it's ever missing or
 * absurd (see retryWaitMs).
 *   - The empty-body case (undocumented, seen in a prior session): a call
 *     inside the throttle window can come back HTTP 200 with a completely
 *     EMPTY body instead of 429 — not valid XML, not an empty-but-valid
 *     feed. fast-xml-parser silently returns `{}` for that, so `!parsed.feed`
 *     is the loud-error signal here, distinct from "valid feed, no <entry>"
 *     (genuine zero) — and is treated the same as a 429 for retry purposes.
 */

const ENDPOINT = "https://www.reddit.com/search.rss";
const USER_AGENT = "lakepointe-listening/1.0 (internal brand monitor)";

/** Minimum gap between consecutive requests to reddit.com within one run (spec floor: "≥2s"). */
const MIN_GAP_MS = 2000;
/** Fallback wait if a throttled response carries no `x-ratelimit-reset` header. */
const DEFAULT_RETRY_WAIT_MS = 20_000;
/** Bounds on the reported reset value, in case it's ever missing or absurd. */
const MIN_RETRY_WAIT_MS = 5_000;
const MAX_RETRY_WAIT_MS = 60_000;

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

/** Thrown on HTTP 429 or an empty/unparseable body, persisted through the one retry. */
export class RedditRateLimitError extends Error {}

/** How long to wait before retrying, per the response's own `x-ratelimit-reset` header. */
function retryWaitMs(res: Response): number {
  const reported = Number(res.headers.get("x-ratelimit-reset"));
  const seconds = Number.isFinite(reported) && reported > 0 ? reported : DEFAULT_RETRY_WAIT_MS / 1000;
  const bounded = Math.min(Math.max(seconds * 1000, MIN_RETRY_WAIT_MS), MAX_RETRY_WAIT_MS);
  return bounded + 2000; // small buffer past the reported reset
}

async function oneCall(query: string): Promise<{ res: Response; body: string }> {
  const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
  if (lastCallAt > 0 && wait > 0) await sleep(wait);
  lastCallAt = Date.now();

  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&sort=new`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  const body = await res.text();
  return { res, body };
}

/**
 * One search.rss call for a single keyword phrase, with ONE retry if
 * throttled (429, or the empty-body signature) — waiting exactly as long as
 * the response's own `x-ratelimit-reset` header says, not a guess. A second
 * consecutive throttle (after the retry) aborts loudly.
 */
export async function fetchRedditEntries(query: string): Promise<RedditEntry[]> {
  for (let attempt = 0; ; attempt++) {
    const { res, body } = await oneCall(query);

    const throttledStatus = res.status === 429;
    if (!throttledStatus && !res.ok) {
      throw new Error(`Reddit RSS HTTP ${res.status} for "${query}": ${formatPollError(body)}`);
    }

    let parsed: { feed?: { entry?: RedditEntry | RedditEntry[] } } = {};
    if (!throttledStatus) {
      try {
        parsed = parser.parse(body);
      } catch {
        parsed = {};
      }
    }
    const throttledEmptyBody = !throttledStatus && !parsed.feed;

    if (throttledStatus || throttledEmptyBody) {
      if (attempt > 0) {
        throw new RedditRateLimitError(
          `Reddit RSS rate limit for "${query}" (persisted through one retry): ` +
            (throttledStatus ? formatPollError(body) : "empty/unparseable body"),
        );
      }
      await sleep(retryWaitMs(res));
      continue;
    }

    const entry = parsed.feed?.entry;
    if (!entry) return [];
    return Array.isArray(entry) ? entry : [entry];
  }
}
