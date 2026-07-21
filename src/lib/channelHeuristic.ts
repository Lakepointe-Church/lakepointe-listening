import { CHANNEL_REUPLOAD_HEURISTIC_TERMS } from "@/config/channel-heuristics";

/** Default classification for a channel never seen before — see config for rationale. */
export function heuristicClassification(channelTitle: string): "reupload" | "unclassified" {
  const lower = channelTitle.toLowerCase();
  const matches = CHANNEL_REUPLOAD_HEURISTIC_TERMS.some((t) => lower.includes(t.toLowerCase()));
  return matches ? "reupload" : "unclassified";
}
