import type { Mention } from "@/lib/types";
import { SOURCES } from "@/config/sources";

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

function fmtDate(iso: string | null): string {
  if (!iso) return "date unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MentionCard({ m }: { m: Mention }) {
  return (
    <article className="rounded-xl border border-lp-taupe/15 bg-lp-surface p-5">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="rounded-full border border-lp-taupe/20 px-2 py-0.5 font-medium text-lp-taupe">
          {SOURCE_LABEL[m.source] ?? m.source}
        </span>
        <span className="rounded-full bg-lp-orange/15 px-2 py-0.5 text-lp-orange">
          {m.query_matched}
        </span>
        {m.status === "new" && (
          <span className="flex items-center gap-1 text-lp-orange">
            <span className="h-1.5 w-1.5 rounded-full bg-lp-orange" />
            new
          </span>
        )}
        <span className="ml-auto text-lp-taupe/50">{fmtDate(m.published_at)}</span>
      </div>

      <h3 className="mt-3 font-medium leading-snug text-white">
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-lp-orange hover:underline"
        >
          {m.title || m.url}
        </a>
      </h3>

      {m.excerpt && (
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-lp-taupe/65">
          {m.excerpt}
        </p>
      )}

      {m.author && (
        <p className="mt-2 text-[12px] text-lp-taupe/50">by {m.author}</p>
      )}
    </article>
  );
}
