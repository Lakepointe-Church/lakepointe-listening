import type { MentionInput, Poller } from "./types";
import { KEYWORDS } from "@/config/sources";
import { fetchGdeltArticles, parseSeendate } from "./gdelt-client";

// GDELT DOC 2.0 keyword sweep — news outlets only, no key, no daily cap, the
// tripwire backbone. One call per KEYWORDS entry (exact-phrase queries,
// already double-quoted in the config), spaced ≥5.5s apart by the shared
// client, over a 2-day window (jitter-proof: consecutive daily cron runs can
// land >24h apart; dedupe makes the overlap free).
//
// Query: phrase-only for v1. REV4 documents an optional `repeat2:` addition
// (`"phrase" repeat2:"token"`) to cut false positives from articles that
// merely mention the phrase once in passing, but it explicitly calls that
// combination unverified and asks for one live test before shipping it. This
// sandbox could not get a live 200 response to run that test — see
// gdelt-client.ts for why — so this ships the documented safe fallback
// (phrase-only) rather than an unverified query. Revisit repeat2 once it can
// be tested against a real response.
//
// Field mapping (url, title, seendate, domain; no author, no excerpt/body,
// no per-article id — url is the dedup key) carries over from the prior
// session's live-verified shape; reconfirm before fully trusting it.

export const gdeltPoller: Poller = {
  id: "gdelt",
  label: "GDELT",
  async run() {
    const out: MentionInput[] = [];
    for (const keyword of KEYWORDS) {
      const articles = await fetchGdeltArticles(keyword);
      for (const a of articles) {
        if (!a.url) continue;
        out.push({
          source: "gdelt",
          source_uid: a.url, // GDELT has no per-article id; URL is the dedup key
          url: a.url,
          title: a.title?.trim() || null,
          excerpt: a.domain ? `via ${a.domain}` : null, // GDELT returns no article text
          author: null, // GDELT artlist carries no author
          query_matched: keyword,
          published_at: parseSeendate(a.seendate),
        });
      }
    }
    return out;
  },
};
