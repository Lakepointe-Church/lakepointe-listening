"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitMention, checkDuplicateUrl } from "@/app/actions";
import { MANUAL_SOURCE_TYPES, KEYWORD_FILTERS } from "@/config/sources";
import type { DuplicateMentionMatch } from "@/lib/db";

type ManualSourceTypeId = (typeof MANUAL_SOURCE_TYPES)[number]["id"];

const SUBMITTED_BY_KEY = "lp-listening-submitted-by";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  "w-full rounded-lg border border-lp-taupe/20 bg-lp-surface px-3 py-2 text-[13px] text-white placeholder:text-lp-taupe/40 focus:border-lp-orange/50 focus:outline-none";
const labelClass = "mb-1 block text-[12px] font-medium text-lp-taupe/70";

export default function AddMentionForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState<ManualSourceTypeId>(MANUAL_SOURCE_TYPES[0].id);
  const [sourceDetail, setSourceDetail] = useState("");
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [contentDate, setContentDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [indirect, setIndirect] = useState(false);
  const [submittedBy, setSubmittedBy] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(SUBMITTED_BY_KEY) ?? ""),
  );
  const [duplicate, setDuplicate] = useState<DuplicateMentionMatch | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeType = MANUAL_SOURCE_TYPES.find((t) => t.id === sourceType)!;
  const urlRequired = activeType.id !== "facebook-group";
  const noteRequired = url.trim() === "";

  async function handleUrlBlur() {
    if (!url.trim()) {
      setDuplicate(null);
      return;
    }
    setCheckingDup(true);
    try {
      setDuplicate(await checkDuplicateUrl(url.trim()));
    } finally {
      setCheckingDup(false);
    }
  }

  function toggleTopic(id: string) {
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Title is required.");
    if (topics.length === 0) return setError("Pick at least one topic.");
    if (urlRequired && !url.trim()) return setError("URL is required for this source type.");
    if (noteRequired && !note.trim()) return setError("Note is required when URL is empty.");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SUBMITTED_BY_KEY, submittedBy.trim());
    }

    setSubmitting(true);
    try {
      await submitMention({
        url,
        sourceType,
        sourceDetail,
        title,
        topics,
        contentDate,
        note,
        indirect,
        submittedBy,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className={labelClass} htmlFor="url">
          URL {!urlRequired && <span className="text-lp-taupe/40">(optional for Facebook group)</span>}
        </label>
        <input
          id="url"
          type="url"
          inputMode="url"
          className={inputClass}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
          placeholder="https://..."
        />
        {checkingDup && <p className="mt-1 text-[11px] text-lp-taupe/45">Checking for duplicates…</p>}
        {duplicate && (
          <p className="mt-1 text-[11px] text-lp-orange/80">
            This URL may already be tracked:{" "}
            <a href={`/?highlight=${duplicate.id}`} className="underline">
              {duplicate.title || "existing item"}
            </a>{" "}
            — you can still submit.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="sourceType">
          Source type
        </label>
        <select
          id="sourceType"
          className={inputClass}
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as ManualSourceTypeId)}
        >
          {MANUAL_SOURCE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="sourceDetail">
          {activeType.detailLabel}
        </label>
        <input
          id="sourceDetail"
          className={inputClass}
          value={sourceDetail}
          onChange={(e) => setSourceDetail(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A staff-written one-liner"
        />
      </div>

      <div>
        <span className={labelClass}>Topic (at least one)</span>
        <div className="flex flex-wrap gap-2">
          {KEYWORD_FILTERS.map((f) => (
            <button
              type="button"
              key={f.id}
              onClick={() => toggleTopic(f.id)}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                topics.includes(f.id)
                  ? "border-lp-orange/40 bg-lp-orange/15 text-lp-orange"
                  : "border-lp-taupe/20 text-lp-taupe/70 hover:border-lp-taupe/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="contentDate">
          Content date
        </label>
        <input
          id="contentDate"
          type="date"
          className={inputClass}
          value={contentDate}
          onChange={(e) => setContentDate(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="note">
          Note {noteRequired && <span className="text-lp-orange/70">(required)</span>}
        </label>
        <textarea
          id="note"
          rows={4}
          className={inputClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            "Context for future readers — why this matters. For private group posts: paraphrase, don't quote members verbatim. For indirect mentions: describe relevance neutrally (e.g., 'circulating in circles adjacent to LP; relevance per comms team') rather than as a declarative claim."
          }
        />
      </div>

      <label className="flex items-center gap-2 text-[13px] text-lp-taupe/80">
        <input type="checkbox" checked={indirect} onChange={(e) => setIndirect(e.target.checked)} />
        Doesn&apos;t explicitly name Lakepointe/Josh
      </label>

      <div>
        <label className={labelClass} htmlFor="submittedBy">
          Submitted by
        </label>
        <input
          id="submittedBy"
          className={inputClass}
          value={submittedBy}
          onChange={(e) => setSubmittedBy(e.target.value)}
          placeholder="Your name"
        />
      </div>

      {error && <p className="text-[13px] text-lp-orange">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-lp-orange px-4 py-2 text-[13px] font-medium text-white transition hover:bg-lp-orange/90 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Add mention"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-lg border border-lp-taupe/20 px-4 py-2 text-[13px] font-medium text-lp-taupe/70"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
