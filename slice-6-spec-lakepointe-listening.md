# Slice 6 — Feed Cleanup: Keyword Filter, Obit Exclusion, Reupload Suppression, UI Simplification

**Project:** lakepointe-listening (Vercel team: plafatas-projects, Neon Postgres)
**Mode:** Show-before-commit at every step. Do NOT write any code until Phase 0 discovery is complete and findings are reported back.

---

## Phase 0 — Discovery Gate (REQUIRED FIRST, no code)

Read and report back on the actual current state before proposing changes:

1. Read the Neon schema for the mentions/items table(s). Report exact table names, column names, and types. Do not assume field names from this spec — confirm them.
2. Read the feed page component and any filter/tab components. Report how the current "Feed" / "By source" / "Review queue" tabs are implemented and where counts come from.
3. Read the ingest/poller code paths for YouTube, Reddit RSS, and Google News RSS. Report where per-item metadata is captured — specifically: matched keyword, source, channel name (YouTube), and source domain (Google News `via` attribution).
4. Confirm whether matched keyword is stored per item (the UI renders keyword chips, so it appears to be — verify the column).
5. Report whether any "reviewed/dismissed" state exists in the schema or is UI-only.

**STOP after Phase 0. Present findings and a revised plan mapped to the real schema. Wait for approval before Phase 1.**

---

## Phase 1 — UI Simplification

1. **Remove the Review Queue entirely.** Remove the tab, the count badge, and any related state/handlers. If a dismissed/reviewed column exists in the schema, leave the column in place (append-only posture; do not run destructive migrations) but remove all UI and read paths that reference it. Note in the report if a column is orphaned.
2. **Rename "By source" → "Connected sources".** Label change only unless discovery reveals it's a distinct view worth touching.
3. The default view is the Feed. No other navigation changes.

## Phase 2 — Keyword Filter

1. Add a filter control on the Feed (chips or a select, matching existing UI patterns) with three options plus "All":
   - **Lakepointe Church** — groups all stored variants (e.g. "Lakepointe Church", "Lake Pointe Church" — confirm actual variant list from stored data in Phase 0, query `SELECT DISTINCT` on the keyword column)
   - **Josh Howerton**
   - **Live Free**
2. Variant grouping must be a small explicit mapping in config (e.g. alongside existing keyword config), not string fuzzy-matching.
3. If "Live Free" is not currently a tracked/polled keyword, report that in Phase 0 — adding it as a poll term is IN SCOPE for this slice (YouTube, Reddit RSS, Google News RSS), but show the proposed query strings before implementing. Suggested phrase: `"Live Free" "Josh Howerton"` or `"Live Free podcast"` — bare "Live Free" is far too generic; propose and get approval.
4. Filter combines with the source filter (e.g. Reddit + Josh Howerton).

## Phase 3 — Funeral/Obituary Exclusion

1. Add an `excluded_reason` (nullable text) column to the items table via additive migration. Never delete rows — excluded items are filtered from default views but remain in the database and are recoverable.
2. At ingest, mark items `excluded_reason = 'obituary'` when EITHER:
   - Source domain matches a config blocklist. Seed list (verify against real data in Phase 0): `legacy.com`, `dignitymemorial.com`, `restlandfuneralhome.com`, plus any other funeral-home domains found in existing Google News rows.
   - Title matches (case-insensitive): `obituary`, `visitation & funeral`, `funeral information`, `funeral home`. Keep the pattern list in config, not inline.
3. Run a one-time backfill script against existing rows using the same rules. Show the list of rows it would mark BEFORE executing (loud, inspectable — no silent filtering).
4. Feed queries exclude rows where `excluded_reason IS NOT NULL`. Add a small, unobtrusive "N excluded items" link/toggle at the bottom of the feed that reveals them — exclusions must be auditable.

## Phase 4 — YouTube Channel Reputation (Reupload Suppression)

1. New table, e.g. `channel_reputation`: channel identifier (use whatever unique channel field the YouTube poller actually captures — confirm in Phase 0 whether that's channel ID or only channel title; if only title, use title and note the limitation), `classification` enum: `owned` | `reupload` | `commentary` | `unclassified`, `updated_at`.
2. Classifications:
   - **owned** — official Lakepointe channels. These are OUR content, not listening signal: excluded from the default feed (`excluded_reason = 'owned-channel'` at ingest, or filtered via join — propose whichever fits the schema better in Phase 0 report).
   - **reupload** — stolen clips/full sermons rehosted. Excluded from default feed (`excluded_reason = 'reupload-channel'`), visible via the excluded toggle.
   - **commentary** — third parties discussing/responding (e.g. Paulogia, The Rabyd Atheist). Always shown; this is the real signal.
   - **unclassified** — default; shown in feed.
3. **Auto-classification heuristic at ingest:** a channel whose name contains "Josh Howerton", "Howerton", "Lakepointe", "Lake Pointe", or "PJH" AND is not on the owned list defaults to `reupload`. All other new channels default to `unclassified`. Heuristic terms live in config.
4. **Triage UI:** on each YouTube feed card, a small control to set the channel's classification (reupload / commentary / owned). Setting it applies to all existing and future items from that channel. This is how the reputation table gets populated over time — no attempt at content-similarity detection.
5. **Seed data:** propose an initial classification list derived from channels currently in the database (query distinct channels + counts), present it for approval before inserting. Known owned: "Lakepointe Church". Do NOT assume — e.g. "Lakepointe Church The Voice", "Lakepointe Gospel", "Lakepoint Church", "LakePointe City Church", and "Lake Point Online" are NOT ours (different churches or reuploaders) — flag ambiguous ones for human review rather than guessing.
6. Reclassification must retroactively update visibility of that channel's existing items.

## Out of Scope for This Slice (do not build)

- Scoring/weighting/sort-by-importance (Slice 7, pending negative-phrase list)
- Sentiment analysis / LLM calls at ingest
- Any changes to GDELT, X, or Meta tiles
- Reviewed/dismissed functionality (explicitly removed, not deferred)

## Gates

- Gate A: Phase 0 findings + revised plan → approval
- Gate B: proposed migrations + backfill preview (rows to be marked) → approval
- Gate C: seed channel classification list → approval
- Show diffs before every write throughout.
