import { NextResponse } from "next/server";

// Slice 5 (Google News + Reddit RSS) Step 1 — DISCOVERY route, not a poller.
// Reddit's public RSS is known to 403-block Vercel's datacenter IPs (see
// config/sources.ts); Google News RSS's egress behavior from Vercel was
// unverified as of 2026-07-16. This makes ONE request to each, live, so we
// know before building either poller's trust-path whether it can ever
// succeed from this deployment. Kept (not deleted) behind the cron secret
// for future re-checks if egress conditions change (e.g. a region move).

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GOOGLE_NEWS_URL =
  "https://news.google.com/rss/search?q=%22Lakepointe+Church%22&hl=en-US&gl=US&ceid=US:en";
const GOOGLE_NEWS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const REDDIT_URL = "https://www.reddit.com/search.rss?q=test&sort=new";
const REDDIT_UA = "lakepointe-listening/1.0 (internal brand monitor)";

type CheckResult = {
  url: string;
  status: number | null;
  contentType: string | null;
  bodyPreview: string | null;
  error: string | null;
  errorCause: string | null;
};

async function check(url: string, userAgent: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent },
      cache: "no-store",
    });
    const body = await res.text();
    return {
      url,
      status: res.status,
      contentType: res.headers.get("content-type"),
      bodyPreview: body.slice(0, 500),
      error: null,
      errorCause: null,
    };
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    return {
      url,
      status: null,
      contentType: null,
      bodyPreview: null,
      error: err instanceof Error ? err.message : String(err),
      errorCause: cause instanceof Error ? cause.message : cause ? String(cause) : null,
    };
  }
}

/**
 * One-shot egress check for both feeds, guarded the same way as the cron
 * poll route (`Authorization: Bearer $CRON_SECRET`). Not wired into the
 * orchestrator or POLLERS — this never touches the mention/poll_run tables.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [googleNews, reddit] = await Promise.all([
    check(GOOGLE_NEWS_URL, GOOGLE_NEWS_UA),
    check(REDDIT_URL, REDDIT_UA),
  ]);

  return NextResponse.json({ googleNews, reddit });
}
