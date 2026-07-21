import type { MentionInput, Poller } from "./types";
import { KEYWORDS } from "@/config/sources";
import { fetchRedditEntries, type RedditEntry } from "./reddit-client";
import { stripHtml } from "@/lib/stripHtml";

// Reddit public search RSS — one call per KEYWORDS entry (spec change from
// the prior session's OR-combined query, now that egress from Vercel is
// reconfirmed reachable — see reddit-client.ts), politely gapped ≥2s apart.

function isPost(e: RedditEntry): boolean {
  return typeof e.id === "string" && e.id.startsWith("t3_");
}

function contentText(e: RedditEntry): string | null {
  const c = e.content;
  if (!c) return null;
  const raw = typeof c === "string" ? c : c["#text"];
  return raw ? stripHtml(raw) : null;
}

export const redditPoller: Poller = {
  id: "reddit",
  label: "Reddit",
  // Every successful call leaves x-ratelimit-remaining at 0, so every
  // keyword after the first needs the client's wait-and-retry. Observed
  // live reset windows ranged 14-58s across two test runs (variable, not a
  // fixed ~20s) — worst case is 2 keywords each waiting the client's 60s
  // cap, well past the default 60s budget.
  budgetMs: 160_000,
  async run() {
    const out: MentionInput[] = [];
    let skippedCommunities = 0;

    for (const keyword of KEYWORDS) {
      let entries;
      try {
        entries = await fetchRedditEntries(keyword);
      } catch (err) {
        // Keep whatever earlier keywords already produced; fail loudly for the run.
        return {
          mentions: out,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      for (const e of entries) {
        if (!isPost(e)) {
          skippedCommunities++; // t5_ subreddit/community result, not a post
          continue;
        }

        const url = e.link?.["@_href"];
        if (!url) continue;

        const publishedAt = Date.parse(e.published ?? e.updated ?? "");
        out.push({
          source: "reddit",
          source_uid: e.id?.trim() || url,
          url,
          title: e.title?.trim() || null,
          excerpt: contentText(e),
          author: e.author?.name?.trim() || null,
          query_matched: keyword,
          published_at: Number.isNaN(publishedAt) ? null : new Date(publishedAt).toISOString(),
          subreddit: e.category?.["@_term"]?.trim() || null,
        });
      }
    }

    if (skippedCommunities > 0) {
      console.log(`[reddit] skipped ${skippedCommunities} t5_ subreddit/community result(s)`);
    }
    return { mentions: out };
  },
};
