import type { MentionInput, Poller } from "./types";
import { KEYWORDS } from "@/config/sources";
import { fetchYouTubeVideos } from "./youtube-client";
import { decodeEntities } from "@/lib/stripHtml";

// YouTube Data v3 poller — one search.list call per KEYWORDS entry (3 calls =
// 300 quota units/day; see youtube-client.ts for the quota budget). The same
// video matching multiple keywords produces duplicate rows within one run;
// the DB's ON CONFLICT (source, source_uid) DO NOTHING absorbs them, same as
// the GDELT pollers' cross-keyword URL overlaps.
export const youtubePoller: Poller = {
  id: "youtube",
  label: "YouTube",
  async run() {
    const out: MentionInput[] = [];
    for (const keyword of KEYWORDS) {
      let items;
      try {
        items = await fetchYouTubeVideos(keyword);
      } catch (err) {
        // e.g. quota exhausted mid-sweep: keep earlier keywords' results,
        // fail loudly for the run.
        return {
          mentions: out,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      for (const item of items) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;
        const s = item.snippet ?? {};
        out.push({
          source: "youtube",
          source_uid: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          // search.list returns HTML-escaped text (verified live) — decode it.
          title: s.title ? decodeEntities(s.title).trim() || null : null,
          excerpt: s.description ? decodeEntities(s.description).trim() || null : null,
          author: s.channelTitle?.trim() || null,
          query_matched: keyword,
          published_at: s.publishedAt ?? null,
          channel_id: s.channelId?.trim() || null,
        });
      }
    }
    return { mentions: out };
  },
};
