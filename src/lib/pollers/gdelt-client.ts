import "server-only";

/**
 * Shared GDELT DOC 2.0 fetch helper, used by both the keyword sweep
 * (gdelt.ts) and the watchlist sweep (gdelt-watchlist.ts).
 *
 * Verified live (this session, July 2026): GDELT returns HTTP 429 with the
 * plaintext body "Please limit requests to one every 5 seconds..." when the
 * per-IP rate limit is exceeded — confirmed against a real response. Every
 * call made during this session hit that 429, even with 20s+ spacing, which
 * points at a shared/saturated egress IP for this sandbox rather than our
 * own request rate — a real 200 response (empty-`{}` shape, field names,
 * the repeat2 query variant, the watchlist OR-chain length limit) could NOT
 * be independently confirmed here. Field mapping below carries over from the
 * prior session's live-verified shape; reconfirm against a real response
 * (e.g. from the deployed Vercel function) before fully trusting it.
 *
 * lastCallAt is deliberately module-level (not per-run) so the ≥5.5s gap is
 * enforced across BOTH pollers, not just within one — they run back-to-back
 * in the same orchestrator invocation and share the same per-IP limit.
 */
const ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MIN_GAP_MS = 5500;

let lastCallAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thrown on HTTP 429 — callers must let this abort the sweep, never retry. */
export class GdeltRateLimitError extends Error {}

export type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
};

/**
 * One 429 retry per call, after a polite pause. DEVIATION from REV4's "on
 * 429 stop GDELT for this run", flagged per its own Section 10 (reality
 * wins): both deployed runs (July 13, 2026) showed the 429s are collisions
 * with OTHER tenants on Vercel's shared egress IP — one run 429'd on call 1
 * but succeeded on call 2, the next succeeded on call 1 and 429'd on call 2.
 * Our own spacing is already ≥5.5s. A single ~20s-later retry per call turns
 * that per-call coin flip into a mostly-reliable daily run; a second 429
 * still aborts the sweep loudly. This is one polite retry, never a hammer.
 */
const RETRY_AFTER_429_MS = 20_000;

/**
 * GDELT-wide cooldown: once a call 429s through its retry, EVERY GDELT call
 * for the next 10 minutes fails fast without touching the network. Why: in
 * two deployed runs, the watchlist sweep's first call got its connection
 * dropped outright ("fetch failed") immediately after the keyword sweep
 * exhausted a 429 retry — GDELT appears to tar-pit IPs that keep knocking
 * after being limited. Stopping all GDELT for the run (REV4's original rule,
 * applied across both pollers) avoids feeding that. TTL-scoped rather than a
 * boolean so warm serverless instances can't leak the flag into the next
 * day's run (10 min ≪ 24h between runs, > one run's length).
 */
const COOLDOWN_MS = 10 * 60_000;
let cooldownUntil = 0;

/**
 * One spaced GDELT artlist call over a 2-day window, with a single spaced
 * retry if the shared-IP 429 lottery strikes (see above). Empty result comes
 * back as a bare `{}` (no `articles` key) — mapped to `[]`, not an error.
 * Throws GdeltRateLimitError on a second consecutive 429, a plain Error on
 * any other failure (non-OK HTTP, non-JSON body).
 */
export async function fetchGdeltArticles(query: string): Promise<GdeltArticle[]> {
  if (Date.now() < cooldownUntil) {
    throw new GdeltRateLimitError(
      "GDELT skipped: rate-limited earlier in this run, cooling down instead of re-knocking",
    );
  }
  for (let attempt = 0; ; attempt++) {
    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (lastCallAt > 0 && wait > 0) await sleep(wait);
    lastCallAt = Date.now();

    const url =
      `${ENDPOINT}?query=${encodeURIComponent(query)}` +
      `&mode=artlist&format=json&maxrecords=250&timespan=2d`;

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    const body = await res.text();

    if (res.status === 429) {
      if (attempt === 0) {
        await sleep(RETRY_AFTER_429_MS);
        continue;
      }
      cooldownUntil = Date.now() + COOLDOWN_MS;
      throw new GdeltRateLimitError(
        `GDELT rate limit for "${query}" (persisted through one ${RETRY_AFTER_429_MS / 1000}s retry): ${body.slice(0, 160)}`,
      );
    }
    if (!res.ok) {
      throw new Error(`GDELT HTTP ${res.status} for "${query}": ${body.slice(0, 160)}`);
    }

    let json: { articles?: GdeltArticle[] };
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`GDELT non-JSON response for "${query}": ${body.slice(0, 160)}`);
    }
    return json.articles ?? [];
  }
}

/** "20260604T223000Z" -> ISO "2026-06-04T22:30:00Z"; null if unparseable. */
export function parseSeendate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}
