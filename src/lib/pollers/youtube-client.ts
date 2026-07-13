import "server-only";

/**
 * YouTube Data API v3 search.list client.
 *
 * Verified live (this session, July 2026) against a real 200 response:
 *   - `items[].id` = { kind: "youtube#video", videoId } — with `type=video`
 *     every item carried a videoId (45/45 checked).
 *   - snippet fields: publishedAt, channelId, title, description, thumbnails,
 *     channelTitle, liveBroadcastContent, publishTime. `publishedAt` is ISO
 *     8601 ("2026-07-13T19:31:38Z") — Date-parseable as-is.
 *   - Titles/descriptions come back HTML-ESCAPED (&amp;, &#39; — 8 of 45 live
 *     titles had entities); callers must decode before storing.
 *   - The API may return fewer items than maxResults (45 of a claimed 76
 *     totalResults with maxResults=50). One page only, per REV4 — no
 *     pagination; each search.list call costs 100 quota units, and paging
 *     would multiply the daily spend for marginal recall.
 *
 * Quota: 100 units per call from the shared 10,000/day pool on the
 * `lakepointe-social-dashboard` Google Cloud project (Social Dashboard uses
 * ~6/day; this tool's 3 calls = 300/day — ample headroom). Do NOT add
 * per-video or comment calls in v1.
 */

const ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

export type YouTubeSearchItem = {
  id?: { kind?: string; videoId?: string };
  snippet?: {
    publishedAt?: string;
    title?: string;
    description?: string;
    channelTitle?: string;
  };
};

/**
 * One search.list call for one keyword over the trailing 2-day window.
 * Throws loudly on any non-OK response (quota exhaustion arrives as a 403 —
 * that must surface as an error poll_run, never as a silent zero). A 200
 * with no `items` key is a genuine zero and returns [].
 */
export async function fetchYouTubeVideos(keyword: string): Promise<YouTubeSearchItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY not set");
  }

  const publishedAfter = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    part: "snippet",
    q: keyword,
    type: "video",
    order: "date",
    maxResults: "50",
    publishedAfter,
    key: apiKey,
  });

  const res = await fetch(`${ENDPOINT}?${params}`, { cache: "no-store" });
  const body = await res.text();

  if (!res.ok) {
    // Trim the error body and make sure the key can't leak into poll_run rows.
    const detail = body.replace(apiKey, "<redacted>").slice(0, 300);
    throw new Error(`YouTube HTTP ${res.status} for ${keyword}: ${detail}`);
  }

  let json: { items?: YouTubeSearchItem[] };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`YouTube non-JSON response for ${keyword}: ${body.slice(0, 160)}`);
  }
  return json.items ?? [];
}
