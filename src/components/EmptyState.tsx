/** Neutral empty state. Distinct from an error — this means "nothing here yet". */
export default function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-lp-taupe/15 bg-lp-surface/30 px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
        <span className="lp-awaiting-dot h-3 w-3 rounded-full bg-lp-taupe/40" />
      </div>
      <p className="font-medium text-lp-taupe">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-lp-taupe/55">{hint}</p>}
    </div>
  );
}
