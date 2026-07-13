const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode numeric (&#32;, &#x20;) and the handful of named XML/HTML entities we see in Reddit content. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => NAMED_ENTITIES[name]);
}

/**
 * Strip HTML tags from Reddit's `<content type="html">` and collapse
 * whitespace, for use as a plain-text excerpt. Best-effort, not a sanitizer —
 * this text is never rendered as HTML.
 */
export function stripHtml(html: string, maxLength = 280): string {
  const text = decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text;
}
