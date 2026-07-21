import type { MentionInput, Poller } from "./types";
import { KEYWORDS } from "@/config/sources";
import {
  attrText,
  fetchGoogleNewsItems,
  parsePubDate,
  sourceDomain,
} from "./google-news-client";

// Google News search RSS — one call per KEYWORDS phrase (unlike GDELT/Reddit,
// no rate-limit signature was observed live for this endpoint, so no
// OR-combining or spacing lever is needed here — see google-news-client.ts).
// Ordering is relevance, not recency: the first-ever run backfills up to a
// decade of matches (verified live, desired) and guid-based dedupe (the
// mention table's UNIQUE (source, source_uid)) is what keeps every later run
// from re-inserting them, not a date window.

/** Strip the " - Publisher Name" suffix Google appends, when it matches the item's own <source>. */
function stripPublisherSuffix(title: string, publisher: string | null): string {
  if (!publisher) return title;
  const suffix = ` - ${publisher}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

export const googleNewsPoller: Poller = {
  id: "google_news",
  label: "Google News",
  async run() {
    const out: MentionInput[] = [];

    for (const keyword of KEYWORDS) {
      let items;
      try {
        items = await fetchGoogleNewsItems(keyword);
      } catch (err) {
        // Keep whatever earlier keywords already produced; fail loudly for the run.
        return {
          mentions: out,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const bareKeyword = keyword.replace(/"/g, "").toLowerCase();
      for (const item of items) {
        const url = item.link?.trim();
        const externalId = attrText(item.guid);
        if (!url || !externalId) continue; // guid is the item's identity — no guid, no row

        const publisher = attrText(item.source);
        const rawTitle = item.title?.trim() || null;
        const title = rawTitle ? stripPublisherSuffix(rawTitle, publisher) : null;
        const domain = sourceDomain(item.source);

        out.push({
          source: "google_news",
          source_uid: externalId,
          url, // wrapped redirect link, stored as-is — never decoded (out of scope)
          title,
          excerpt: domain ? `via ${domain}` : null,
          author: null,
          query_matched: keyword,
          published_at: parsePubDate(item.pubDate),
          title_match: title ? title.toLowerCase().includes(bareKeyword) : false,
          domain,
        });
      }
    }
    return { mentions: out };
  },
};
