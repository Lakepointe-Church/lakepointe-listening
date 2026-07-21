import { OBITUARY_DOMAIN_BLOCKLIST, OBITUARY_TITLE_PATTERNS } from "@/config/exclusions";

/**
 * Obituary/funeral-notice detector — domain blocklist OR title-pattern match.
 * Domain alone is necessary (not redundant with title matching): at least one
 * live dignitymemorial.com row has no obituary-pattern title.
 */
export function classifyObituary(
  title: string | null,
  domain: string | null,
): "obituary" | null {
  if (domain && OBITUARY_DOMAIN_BLOCKLIST.includes(domain.toLowerCase())) {
    return "obituary";
  }
  if (title) {
    const lower = title.toLowerCase();
    if (OBITUARY_TITLE_PATTERNS.some((p) => lower.includes(p))) {
      return "obituary";
    }
  }
  return null;
}
