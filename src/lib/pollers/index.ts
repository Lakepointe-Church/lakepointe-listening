import type { Poller } from "./types";
import { gdeltPoller } from "./gdelt";
import { gdeltWatchlistPoller } from "./gdelt-watchlist";
import { youtubePoller } from "./youtube";

/**
 * Registry of active pollers, run sequentially by /api/cron/poll. Sources
 * with no working free path from Vercel (X, Meta, web search — and Reddit,
 * whose public RSS 403-blocks datacenter IPs; see config/sources.ts) are not
 * polled — they render as placeholder tiles. The Reddit poller
 * (./reddit.ts) stays built and live-verified for a future non-datacenter
 * egress: re-add redditPoller here to re-enable.
 */
export const POLLERS: Poller[] = [gdeltPoller, gdeltWatchlistPoller, youtubePoller];
