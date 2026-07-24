import AddMentionForm from "@/components/AddMentionForm";

// Slice 9: dedicated, bookmarkable route (not a modal) — the primary capture
// scenario is seeing a Facebook group post on a phone and wanting to
// add-to-home-screen this page.
export default function AddMentionPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-bold tracking-tight text-white">
        Add <span className="text-lp-orange">mention</span>
      </h1>
      <p className="mt-1 text-[13px] text-lp-taupe/60">
        For content no automated source can reach — private group posts, X,
        indirect mentions, and anything else you spot manually.
      </p>
      <AddMentionForm />
    </div>
  );
}
