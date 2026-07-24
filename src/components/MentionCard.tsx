"use client";

import { useState, useTransition } from "react";
import type { Mention } from "@/lib/types";
import { SOURCES, MANUAL_SOURCE_TYPES, KEYWORD_FILTERS } from "@/config/sources";
import { editManualMention } from "@/app/actions";
import EntityTriage from "./EntityTriage";

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));
const MANUAL_TYPE_LABEL = Object.fromEntries(MANUAL_SOURCE_TYPES.map((t) => [t.id, t]));
const TOPIC_LABEL = Object.fromEntries(KEYWORD_FILTERS.map((f) => [f.id, f.label]));

const EXCLUDED_LABEL: Record<string, string> = {
  obituary: "excluded: obituary",
  manual: "excluded: manually",
  "owned-entity": "excluded: owned",
  "reupload-entity": "excluded: reupload",
  "wrong-entity": "excluded: wrong entity",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "date unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const inputClass =
  "w-full rounded-lg border border-lp-taupe/20 bg-lp-gray px-2.5 py-1.5 text-[13px] text-white focus:border-lp-orange/50 focus:outline-none";

/** Inline post-hoc edit form — manual items only (Slice 9, Phase 3.4). Polled items are immutable. */
function EditForm({ m, onDone }: { m: Mention; onDone: () => void }) {
  const [title, setTitle] = useState(m.title ?? "");
  const [note, setNote] = useState(m.excerpt ?? "");
  const [sourceDetail, setSourceDetail] = useState(m.source_detail ?? "");
  const [topics, setTopics] = useState<string[]>(m.topics);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(id: string) {
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await editManualMention(m.id, { title, note, sourceDetail, topics });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="mt-3 space-y-2.5 border-t border-lp-taupe/10 pt-3">
      <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <input
        className={inputClass}
        value={sourceDetail}
        onChange={(e) => setSourceDetail(e.target.value)}
        placeholder="Source detail"
      />
      <textarea
        className={inputClass}
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
      />
      <div className="flex flex-wrap gap-2">
        {KEYWORD_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => toggleTopic(f.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition ${
              topics.includes(f.id)
                ? "border-lp-orange/40 bg-lp-orange/15 text-lp-orange"
                : "border-lp-taupe/20 text-lp-taupe/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[12px] text-lp-orange">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-lp-orange px-3 py-1 text-[12px] font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onDone}
          disabled={pending}
          className="rounded-lg border border-lp-taupe/20 px-3 py-1 text-[12px] font-medium text-lp-taupe/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function MentionCard({ m }: { m: Mention }) {
  const [editing, setEditing] = useState(false);
  const isManual = m.source === "manual_submission";
  const manualType = m.manual_source_type ? MANUAL_TYPE_LABEL[m.manual_source_type] : null;

  const sourceLabel = isManual ? manualType?.label ?? "Manual" : SOURCE_LABEL[m.source] ?? m.source;
  const byline =
    isManual && m.source_detail
      ? `${manualType?.bylinePreposition ?? "via"} ${m.source_detail}`
      : m.author
        ? `by ${m.author}`
        : null;

  return (
    <article className="rounded-xl border border-lp-taupe/15 bg-lp-surface p-5">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="rounded-full border border-lp-taupe/20 px-2 py-0.5 font-medium text-lp-taupe">
          {sourceLabel}
        </span>

        {isManual && m.topics.length > 0 ? (
          m.topics.map((t) => (
            <span key={t} className="rounded-full bg-lp-orange/15 px-2 py-0.5 text-lp-orange">
              {TOPIC_LABEL[t] ?? t}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-lp-orange/15 px-2 py-0.5 text-lp-orange">{m.query_matched}</span>
        )}

        {m.indirect && (
          <span className="rounded-full border border-lp-slate/40 px-2 py-0.5 text-lp-slate/80" title="Content never explicitly names Lakepointe/Josh">
            Indirect
          </span>
        )}

        {m.excluded_reason && (
          <span className="rounded-full border border-lp-taupe/20 px-2 py-0.5 text-lp-taupe/55">
            {EXCLUDED_LABEL[m.excluded_reason] ?? `excluded: ${m.excluded_reason}`}
          </span>
        )}
        <span className="ml-auto text-lp-taupe/50">{fmtDate(m.published_at)}</span>
      </div>

      <h3 className="mt-3 font-medium leading-snug text-white">
        {m.url ? (
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-lp-orange hover:underline"
          >
            {m.title || m.url}
          </a>
        ) : (
          m.title
        )}
      </h3>

      {m.excerpt && (
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-lp-taupe/65">{m.excerpt}</p>
      )}

      {byline && <p className="mt-2 text-[12px] text-lp-taupe/50">{byline}</p>}
      {isManual && m.submitted_by && (
        <p className="mt-0.5 text-[11px] text-lp-taupe/40">added by {m.submitted_by}</p>
      )}

      {isManual && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-[11px] font-medium text-lp-taupe/55 hover:text-lp-taupe"
        >
          Edit
        </button>
      )}
      {isManual && editing && <EditForm m={m} onDone={() => setEditing(false)} />}

      <EntityTriage mention={m} />
    </article>
  );
}
