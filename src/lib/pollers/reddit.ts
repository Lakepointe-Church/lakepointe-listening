import type { MentionInput, Poller } from "./types";
import { KEYWORDS } from "@/config/sources";
import { fetchRedditEntries, type RedditEntry } from "./reddit-client";
import { stripHtml } from "@/lib/stripHtml";

// Reddit public search RSS — posts only, no auth. One OR-combined query
// covering all of KEYWORDS (see reddit-client.ts for why: Reddit's
// undocumented per-request throttle makes one-call-per-keyword, like the
// GDELT pollers, blow the 60s per-source budget).
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function isPost(e: RedditEntry): boolean {
  return typeof e.id === "string" && e.id.startsWith("t3_");
}

function contentText(e: RedditEntry): string | null {
  const c = e.content;
  if (!c) return null;
  const raw = typeof c === "string" ? c : c["#text"];
  return raw ? stripHtml(raw) : null;
}

// Reddit's search is token-based, not strict phrase matching (a post can
// come back with the brand term only in body text, not the title) — this
// mirrors REV4's "mentioning church/Howerton near Lakepointe" noise filter
// and also recovers which KEYWORDS entry actually matched, for query_matched.
function matchedKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const k of KEYWORDS) {
    if (lower.includes(k.replace(/"/g, "").toLowerCase())) return k;
  }
  const hasLakepointe = /lake\s*pointe/.test(lower);
  const hasChurch = lower.includes("church");
  const hasHowerton = lower.includes("howerton");
  return (hasLakepointe && hasChurch) || hasHowerton ? "keyword (combined)" : null;
}

export const redditPoller: Poller = {
  id: "reddit",
  label: "Reddit",
  async run() {
    const query = KEYWORDS.join(" OR ");
    const entries = await fetchRedditEntries(query);
    const cutoff = Date.now() - TWO_DAYS_MS;

    const out: MentionInput[] = [];
    for (const e of entries) {
      if (!isPost(e)) continue; // drop t5_ subreddit/community results — see reddit-client.ts

      const url = e.link?.["@_href"];
      if (!url) continue;

      const publishedAt = e.updated ? Date.parse(e.updated) : NaN;
      if (Number.isNaN(publishedAt) || publishedAt < cutoff) continue;

      const excerpt = contentText(e);
      const title = e.title?.trim() || null;
      const query_matched = matchedKeyword(`${title ?? ""} ${excerpt ?? ""}`);
      if (!query_matched) continue; // noise filter: no brand term found in title or body

      out.push({
        source: "reddit",
        source_uid: e.id?.trim() || url,
        url,
        title,
        excerpt,
        author: e.author?.name?.trim() || null,
        query_matched,
        published_at: new Date(publishedAt).toISOString(),
      });
    }
    return out;
  },
};
