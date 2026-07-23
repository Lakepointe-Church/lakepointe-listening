import { stripHtml } from "@/lib/stripHtml";

/**
 * Single formatting point for poller HTTP/parse error bodies before they're
 * stored in `poll_run.error_message`. Consolidates what used to be nine
 * ad-hoc `body.slice(0, 160-300)` call sites across the four poller clients.
 * Strips tags first (GDELT/Google News/API error pages can embed markup) so
 * truncation always lands on a tag boundary, never mid-tag. Full raw bodies
 * still go to console/logs at the throw site if a caller wants them.
 */
export function formatPollError(body: string, max = 200): string {
  return stripHtml(body, max);
}
