import type { Poller } from "./types";
import { gdeltPoller } from "./gdelt";
import { gdeltWatchlistPoller } from "./gdelt-watchlist";
import { redditPoller } from "./reddit";

/**
 * Registry of active pollers, run sequentially by /api/cron/poll. Each later
 * slice appends its source here (YouTube next). Sources with no free API
 * path (X, Meta, web search) are not pollers — they render as placeholder tiles.
 */
export const POLLERS: Poller[] = [gdeltPoller, gdeltWatchlistPoller, redditPoller];
