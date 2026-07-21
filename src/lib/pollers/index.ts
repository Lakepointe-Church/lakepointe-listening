import type { Poller } from "./types";
import { youtubePoller } from "./youtube";
import { googleNewsPoller } from "./google-news";
import { redditPoller } from "./reddit";

/**
 * Registry of active pollers, run sequentially by /api/cron/poll. Sources
 * with no working free path from Vercel (X, Meta, web search) are not
 * polled — they render as placeholder tiles (config/sources.ts). Reddit was
 * previously demoted here too (403 from iad1's datacenter IPs), but Slice 5's
 * Step 1 egress check reconfirmed it's reachable from cle1, so it's back.
 *
 * GDELT and GDELT Watchlist were demoted here too (Slice 6, 2026-07-21):
 * 16/16 recorded runs failed with zero mentions ever captured — see
 * config/sources.ts. The gdelt.ts / gdelt-watchlist.ts / gdelt-client.ts
 * poller code is left in place, not deleted, in case a working vantage
 * point ever turns up.
 */
export const POLLERS: Poller[] = [youtubePoller, googleNewsPoller, redditPoller];
