import "server-only";
import { XMLParser } from "fast-xml-parser";
import { formatPollError } from "./formatPollError";

/**
 * Google News search RSS client — no auth, no key. Verified live 2026-07-16
 * (both from a residential network and from Vercel's cle1 egress — see
 * src/app/api/cron/egress-check/route.ts) against
 * https://news.google.com/rss/search?q=...&hl=en-US&gl=US&ceid=US:en for
 * "Josh Howerton" (100 items) and "Lakepointe Church":
 *   - RSS 2.0. `<guid isPermaLink="false">` and `<source url="...">` both
 *     parse as fast-xml-parser objects (`{ "#text", "@_..." }`), same shape
 *     as Reddit's `<link href>` attribute handling in reddit-client.ts —
 *     confirmed present on all 100 live items, no plain-string variant seen.
 *   - Ordering is RELEVANCE, not recency: live pubDates in one pull spanned
 *     2016-2026. This is expected (first ingest = historical backfill);
 *     guid-based dedupe, not a date window, is what prevents re-ingest.
 *   - No rate-limit signature observed (unlike GDELT/Reddit) in this
 *     session's live calls — no retry/backoff built in; add one if a real
 *     429 ever surfaces.
 */

const ENDPOINT = "https://news.google.com/rss/search";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

type AttrText = { "#text"?: string; "@_isPermaLink"?: string; "@_url"?: string };

export type GoogleNewsItem = {
  title?: string;
  link?: string;
  guid?: AttrText | string;
  pubDate?: string;
  description?: string;
  source?: AttrText | string;
};

/** `{ "#text": "x", ... } | "x" | undefined` -> `"x" | null`. */
export function attrText(v: AttrText | string | undefined): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  return v["#text"]?.trim() || null;
}

/** The publisher domain from `<source url="...">`, e.g. "churchleaders.com". */
export function sourceDomain(v: AttrText | string | undefined): string | null {
  if (v == null || typeof v === "string") return null;
  const url = v["@_url"];
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * One search RSS call for a single keyword phrase. Throws loudly on a
 * non-200 or a response that doesn't parse to the expected `rss.channel`
 * shape (distinct from a genuine "no items" zero, which is a valid empty
 * channel and returns []).
 */
export async function fetchGoogleNewsItems(query: string): Promise<GoogleNewsItem[]> {
  const url =
    `${ENDPOINT}?q=${encodeURIComponent(query)}` + `&hl=en-US&gl=US&ceid=US:en`;
  console.log(`[google_news] fetching: ${url}`);

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Google News RSS HTTP ${res.status} for "${query}": ${formatPollError(body)}`);
  }

  let parsed: { rss?: { channel?: { item?: GoogleNewsItem | GoogleNewsItem[] } } };
  try {
    parsed = parser.parse(body);
  } catch (err) {
    throw new Error(
      `Google News RSS unparseable for "${query}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed.rss?.channel) {
    throw new Error(
      `Google News RSS returned an unexpected shape for "${query}" (no rss.channel): ${formatPollError(body)}`,
    );
  }

  const item = parsed.rss.channel.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/** RFC-822 (e.g. "Wed, 18 Mar 2026 07:00:00 GMT") -> ISO 8601, or null if unparseable. */
export function parsePubDate(s: string | undefined): string | null {
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}
