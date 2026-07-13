const STRIP_PARAM_PREFIXES = ["utm_"];
const STRIP_PARAMS = new Set(["fbclid", "gclid"]);

/**
 * Canonicalize a URL for cross-source duplicate grouping (mention.normalized_url):
 * lowercase host, strip utm_-prefixed/fbclid/gclid params, drop the fragment
 * and any trailing slash. Returns null for unparseable URLs — grouping is
 * best-effort, never blocks the insert.
 */
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (STRIP_PARAMS.has(lower) || STRIP_PARAM_PREFIXES.some((p) => lower.startsWith(p))) {
      u.searchParams.delete(key);
    }
  }
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}
