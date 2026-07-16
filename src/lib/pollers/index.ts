import type { Poller } from "./types";
import { gdeltPoller } from "./gdelt";
import { gdeltWatchlistPoller } from "./gdelt-watchlist";
import { youtubePoller } from "./youtube";
import { googleNewsPoller } from "./google-news";
import { redditPoller } from "./reddit";

/**
 * Registry of active pollers, run sequentially by /api/cron/poll. Sources
 * with no working free path from Vercel (X, Meta, web search) are not
 * polled — they render as placeholder tiles (config/sources.ts). Reddit was
 * previously demoted here too (403 from iad1's datacenter IPs), but Slice 5's
 * Step 1 egress check reconfirmed it's reachable from cle1, so it's back.
 */
export const POLLERS: Poller[] = [
  gdeltPoller,
  gdeltWatchlistPoller,
  youtubePoller,
  googleNewsPoller,
  redditPoller,
];
