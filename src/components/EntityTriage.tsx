"use client";

import { useState, useTransition } from "react";
import { classifyEntity, excludeItem } from "@/app/actions";
import type { EntityClassification, Mention } from "@/lib/types";

const CLASSIFICATION_LABEL: Record<EntityClassification, string> = {
  owned: "Owned",
  reupload: "Reupload",
  commentary: "Commentary",
  "wrong-entity": "Wrong entity",
  unclassified: "Unclassified",
};

const OPTIONS: { id: EntityClassification; label: string }[] = [
  { id: "commentary", label: "Commentary" },
  { id: "reupload", label: "Reupload" },
  { id: "wrong-entity", label: "Wrong entity" },
  { id: "owned", label: "Owned" },
];

/** The (source, entity_key) pair this mention's classification would apply to. */
function entityKeyFor(m: Mention): string | null {
  return m.source === "google_news" ? m.domain : m.author;
}

/**
 * Collapsed classification badge + edit menu (Slice 7, Phase 2). Replaces the
 * old always-visible four-button row: default state is one quiet badge — the
 * extra click to open the menu is deliberate friction against stakeholder
 * drive-by reclassification, not security. One shared component across
 * YouTube, Reddit, and Google News cards; classifying applies to all of that
 * entity's items, existing and future (joined at read time, see queries.ts).
 */
export default function EntityTriage({ mention }: { mention: Mention }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const entityKey = entityKeyFor(mention);

  function classify(classification: EntityClassification) {
    if (!entityKey) return;
    setOpen(false);
    setNote(null);
    startTransition(async () => {
      await classifyEntity(mention.source, entityKey, classification);
      setNote(`Marked ${CLASSIFICATION_LABEL[classification].toLowerCase()}`);
    });
  }

  function exclude() {
    setOpen(false);
    setNote(null);
    startTransition(async () => {
      await excludeItem(mention.id);
      setNote("Excluded");
    });
  }

  const badgeLabel = CLASSIFICATION_LABEL[mention.entity_classification ?? "unclassified"];

  return (
    <div className="relative mt-3 border-t border-lp-taupe/10 pt-2.5 text-[11px]">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex items-center gap-1 rounded-full border border-lp-taupe/20 px-2 py-0.5 font-medium text-lp-taupe/60 transition hover:border-lp-taupe/35 hover:text-lp-taupe disabled:opacity-50"
      >
        {badgeLabel}
        <span className="text-lp-taupe/40">⌄</span>
      </button>
      {note && <span className="ml-2 text-lp-taupe/45">{note}</span>}

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[9rem] rounded-lg border border-lp-taupe/20 bg-lp-surface p-1 shadow-lg">
          {entityKey ? (
            OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => classify(o.id)}
                className="block w-full rounded px-2.5 py-1.5 text-left text-lp-taupe/80 transition hover:bg-lp-taupe/10 hover:text-white"
              >
                {o.label}
              </button>
            ))
          ) : (
            <p className="px-2.5 py-1.5 text-lp-taupe/45">No stable entity to classify</p>
          )}
          <div className="my-1 border-t border-lp-taupe/10" />
          <button
            onClick={exclude}
            className="block w-full rounded px-2.5 py-1.5 text-left text-lp-taupe/80 transition hover:bg-lp-taupe/10 hover:text-white"
          >
            Exclude this item
          </button>
        </div>
      )}
    </div>
  );
}
