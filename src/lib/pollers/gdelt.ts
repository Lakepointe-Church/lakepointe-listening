import type { MentionInput, Poller } from "./types";
import { KEYWORDS } from "@/config/sources";
import { fetchGdeltArticles, parseSeendate } from "./gdelt-client";

// GDELT DOC 2.0 keyword sweep — news outlets only, no key, the tripwire
// backbone. ONE OR-combined call over all of KEYWORDS (a lever REV4
// pre-authorized: "batch keywords with OR instead"), over a 2-day window.
//
// Why one call, not one per keyword: four deployed runs (July 13-14, 2026,
// from two Vercel regions) showed GDELT throttling cloud-provider IP ranges
// wholesale — ≥5.5s-spaced calls still 429'd most of the time, from iad1 and
// cle1 alike. Fewer calls per run = fewer chances to lose that lottery; with
// the watchlist's batches this cuts the run from 6 GDELT calls to 4.
//
// The combined query is a single (non-nested) OR block of quoted phrases —
// GDELT's one documented OR restriction is nesting. query_matched is
// recovered post-hoc from the title (GDELT returns no body text); titles
// that match no specific phrase get "keyword (combined)".
//
// Query: phrase-only for v1. REV4's optional `repeat2:` noise filter remains
// unverified (needs a GDELT 200 from a testable vantage) — revisit if a
// working vantage ever materializes.

function matchedKeyword(title: string | null): string {
  if (title) {
    const lower = title.toLowerCase();
    for (const k of KEYWORDS) {
      if (lower.includes(k.replace(/"/g, "").toLowerCase())) return k;
    }
  }
  return "keyword (combined)";
}

export const gdeltPoller: Poller = {
  id: "gdelt",
  label: "GDELT",
  async run() {
    const out: MentionInput[] = [];
    const query = `(${KEYWORDS.join(" OR ")})`;

    let articles;
    try {
      articles = await fetchGdeltArticles(query);
    } catch (err) {
      return {
        mentions: out,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    for (const a of articles) {
      if (!a.url) continue;
      const title = a.title?.trim() || null;
      out.push({
        source: "gdelt",
        source_uid: a.url, // GDELT has no per-article id; URL is the dedup key
        url: a.url,
        title,
        excerpt: a.domain ? `via ${a.domain}` : null, // GDELT returns no article text
        author: null, // GDELT artlist carries no author
        query_matched: matchedKeyword(title),
        published_at: parseSeendate(a.seendate),
        domain: a.domain ?? null,
      });
    }
    return { mentions: out };
  },
};
