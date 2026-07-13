import type { Poller } from "./types";
import { gdeltPoller } from "./gdelt";
import { gdeltWatchlistPoller } from "./gdelt-watchlist";
import { redditPoller } from "./reddit";
import { youtubePoller } from "./youtube";

/**
 * Registry of active pollers, run sequentially by /api/cron/poll. All four v1
 * live sources are wired. Sources with no free API path (X, Meta, web search)
 * are not pollers — they render as placeholder tiles.
 */
export const POLLERS: Poller[] = [
  gdeltPoller,
  gdeltWatchlistPoller,
  redditPoller,
  youtubePoller,
];
