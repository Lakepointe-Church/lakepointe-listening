/**
 * Curated news/media domains for the GDELT watchlist sweep — outlets most
 * likely to cover Lakepointe Church / Josh Howerton, from the domain
 * research in ../../search-domains.md (63 domains, researched 2026-07-08).
 *
 * Excludes reddit.com, youtube.com, wikipedia.org from that list: GDELT DOC
 * 2.0 indexes news media, not social/reference pages, so a `domainis:`
 * restriction to those wouldn't meaningfully match there — they're covered
 * by their own dedicated pollers (Reddit RSS, YouTube Data v3) instead.
 */
export const WATCHLIST_DOMAINS: string[] = [
  // Confirmed coverage
  "roysreport.com",
  "baptistnews.com",
  "churchleaders.com",
  "christianpost.com",
  "protestia.com",
  "thewartburgwatch.com",
  "baremarriage.com",
  "faithonview.com",
  "thegospelcoalition.org",
  "outreachmagazine.com",
  "worshipideas.com",
  "wfaa.com",
  "cbn.com",
  "chron.com",
  // Christian / evangelical press
  "christianitytoday.com",
  "religionnews.com",
  "relevantmagazine.com",
  "baptiststandard.com",
  "baptistpress.com",
  "ministrywatch.com",
  "wordandway.org",
  "sojo.net",
  "premierchristianity.com",
  "wng.org",
  "christianheadlines.com",
  "crosswalk.com",
  "faithit.com",
  "juicyecumenism.com",
  // Watchblogs / accountability / ex-vangelical commentary
  "sheologians.com",
  "reformationcharlotte.org",
  "onlysky.media",
  "wonkette.com",
  "substack.com",
  "medium.com",
  // Christian nationalism / political / secular watchdog
  "ffrf.org",
  "au.org",
  "bjconline.org",
  "rightwingwatch.org",
  "mediamatters.org",
  "rollingstone.com",
  "salon.com",
  "theguardian.com",
  "newrepublic.com",
  "motherjones.com",
  "rawstory.com",
  "huffpost.com",
  "msnbc.com",
  "thedispatch.com",
  "texasmonthly.com",
  // DFW / Texas local news
  "dallasnews.com",
  "star-telegram.com",
  "dallasobserver.com",
  "dmagazine.com",
  "nbcdfw.com",
  "fox4news.com",
  "cbsnews.com",
  "keranews.org",
  "texastribune.org",
  "heraldbanner.com",
  "communityimpact.com",
];
