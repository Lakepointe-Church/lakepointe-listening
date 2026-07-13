import type { Poller } from "./types";
import { gdeltPoller } from "./gdelt";
import { gdeltWatchlistPoller } from "./gdelt-watchlist";

/**
 * Registry of active pollers, run sequentially by /api/cron/poll. Each later
 * slice appends its source here (Reddit, YouTube). Sources with no free API
 * path (X, Meta, web search) are not pollers — they render as placeholder tiles.
 */
export const POLLERS: Poller[] = [gdeltPoller, gdeltWatchlistPoller];
