# Slice 7 (v2) — Classification Everywhere, Collapsed Triage UI, Server-Side Time Windows, and the Executive Layer

**Project:** lakepointe-listening (Vercel team: plafatas-projects, Neon Postgres)
**Mode:** Show-before-commit at every step.
**Status:** Phase 0 discovery is COMPLETE (findings reviewed and incorporated below). This v2 supersedes the original Slice 7 spec. Build against this document only — prior spec + thread corrections are folded in.

**Decisions locked at Gate A:**
- Time filtering becomes a real **server-side date parameter** (option a). The 200-row-per-source cap is replaced/parameterized — this also unblocks correct summary-strip math.
- **`other-church` merges into `wrong-entity`.** One "this isn't us" category. Hyphenated naming throughout, matching the existing `owned` / `reupload` / `commentary` convention.
- Reddit entity grain = bare author string as stored (`JustAoplogize`, no `/u/` prefix — that's display-only). Renamed accounts escaping classification is accepted for v1.
- Exclusion architecture stays **derived-at-read via reputation JOIN** (preserves instant retroactivity). Stored `excluded_reason` values are only `'obituary'` and new `'manual'`; add a real CHECK constraint for those two stored values.

---

## Confirmed Phase 0 Findings (build against these, do not re-derive)

- `mention` table has **no persisted domain column** for Google News; `MentionInput.domain` is transient (used once at ingest for obit classification, db.ts:143) and the domain otherwise survives only as "via X" free text in `excerpt`.
- Reddit stores `e.author.name.trim()` — bare string (reddit.ts:62).
- `channel_reputation.classification` CHECK uses hyphenated values: `owned`, `reupload`, `commentary`, `other-church`. Classification keys on **channel title**, not channel ID.
- Feed reads are capped at **200 rows per source per included/excluded partition** (`rn <= 200` window function in queries.ts); FeedView filters client-side over that capped array; no server-side date param exists.
- `excluded_reason` is unconstrained free text; the enum in schema.sql is a comment, not a constraint. Channel-based exclusion values (`owned-channel` etc.) are never written — computed live via the `channel_reputation` JOIN.
- All four poller clients already truncate error bodies to 160–300 chars at four separate ad-hoc `.slice()` call sites; none strip HTML; truncation can land mid-tag.
- `src/lib/types.ts` `Mention.excluded_reason` comment is stale (missing `other-church-channel`).
- sources.ts shows Reddit re-verified live from cle1 (the earlier 403 was transient or resolved) — do not re-demote; treat as healthy unless it fails again.

---

## Phase 1 — Entity Reputation (Classification Beyond YouTube)

1. **New table `entity_reputation`:** (`source` TEXT CHECK IN ('youtube','reddit','google_news'), `entity_key` TEXT, `classification` TEXT CHECK IN ('owned','reupload','commentary','wrong-entity'), `updated_at`, PK (`source`,`entity_key`)).
   - Migrate existing `channel_reputation` rows in: `source='youtube'`, `entity_key`=channel title, classification carried over with **`other-church` rewritten to `wrong-entity`** in the same migration.
   - Keep `channel_reputation` intact until the read path is verified against `entity_reputation`, then propose a cleanup migration as a separate approved step.
2. **Entity keys per source:**
   - YouTube → channel title (as today; ID-keying is a possible future improvement, out of scope)
   - Reddit → bare author string as stored
   - Google News → **new persisted `domain` column** (see step 3)
3. **Persist Google News domain (additive migration + backfill):**
   - Add nullable `domain` TEXT column to `mention`. Populate at ingest for Google News going forward (the value already exists transiently at that point).
   - One-time backfill for existing Google News rows by parsing the "via X" pattern from `excerpt`. **Show the parsed (id, excerpt-fragment → domain) preview and row count BEFORE executing.** Rows that don't parse stay NULL — report the count; NULL-domain items simply can't be entity-classified, which is acceptable.
   - Note: domain-keyed classification **coexists with** the obit domain blocklist; it does not replace it. `legacy.com` can appear in both mechanisms — that's fine, they exclude for different reasons.
4. **Classification semantics:** `owned` and `reupload` and `wrong-entity` exclude from the default feed (visible under the excluded toggle); `commentary` always shows and feeds the summary strip's "needs attention" count; unclassified (no row) shows.
5. **Exclusion stays derived at read time** via the `entity_reputation` JOIN — no classification-derived values are ever written to `excluded_reason`. This preserves instant retroactivity on reclassification with zero backfills.
6. **Per-item manual exclude:** "Exclude this item" action sets `excluded_reason = 'manual'`. Item-level only; creates no reputation row. Recoverable via the excluded toggle.
7. **CHECK constraint on stored `excluded_reason`:** allow only `'obituary'`, `'manual'`, NULL. Verify no other values exist in the column before applying (report if any do).
8. **Doc hygiene (required in same PR):** update the `types.ts` `Mention.excluded_reason` comment and the schema.sql comment to reflect reality (stored: obituary/manual; derived: entity classification). Going forward, any classification-set change must update these comments in the same PR.

## Phase 2 — Collapsed Triage UI

1. **Default card state:** one small status badge showing current classification (`Commentary`, `Reupload`, `Unclassified`, …). No button row. Muted/neutral styling per existing brand tokens — these are metadata, not calls to action; do not use brand orange. `Unclassified` renders visually quiet.
2. **Edit affordance:** small chevron/kebab on the badge opens a compact dropdown/popover containing the classification options (source-appropriate) plus "Exclude this item." Select → close → apply immediately. The extra click is intentional friction against stakeholder drive-by clicks. No auth in this slice.
3. One shared component across YouTube, Reddit, and Google News cards. Replaces the current always-visible four-button row on YouTube cards.
4. Google News cards with NULL domain (unparseable backfill rows) show only the per-item exclude option, no entity classification.

## Phase 3 — Server-Side Time Windows (prerequisite for Phase 4)

1. Replace the fixed `rn <= 200` cap with a **server-side date-window parameter** on the feed query: window ∈ {7d, 30d, 90d, all}. Within a window, a generous safety cap (e.g. 1000/source) may remain to bound payloads — if it ever triggers, the UI must say "showing most recent N in this window" rather than truncate silently. Silent truncation is a bug (established principle).
2. All aggregate counts (source tabs, keyword chips, excluded count, summary strip) are computed **server-side for the same window** so every number on the page is mutually consistent.
3. Propose the API/query shape at Gate B before implementing (this touches queries.ts's core read path — show the new SQL).

## Phase 4 — Time Filter UI

1. Filter control alongside source/keyword filters: **7 days (default) / 30 days / 90 days / All.**
2. Default view = last 7 days; the archive is one click away under "All" — now genuinely all, backed by Phase 3.

## Phase 5 — Executive Summary Strip

1. Strip between header and feed, computed server-side from non-excluded items:
   - **Volume:** mentions in the last 7 days vs. prior 7 days ("23 mentions this week, ↑ from 15"). The comparison window is always trailing-7-vs-prior-7 regardless of the active feed filter (it's a pulse, not a filter readout) — note this in a tooltip or label so the numbers aren't mistaken for the filtered view.
   - **By source:** compact counts for the trailing 7 days.
   - **Needs attention:** count of trailing-7-day items from `commentary`-classified entities. (Negative-phrase hits join this in Slice 8.)
2. Counts only. No LLM, no sentiment, no editorializing. Visually light, brand-neutral, one row.

## Phase 6 — Calm Source Status

1. Replace the top error banner with a **compact status line**: "N of M sources healthy · last updated {time}", subtle warning tint when something is failing. Click expands per-source detail.
2. **Consolidate error truncation:** replace the four ad-hoc `.slice()` call sites in the poller clients with one shared helper (e.g. `formatPollError(body, max=200)`) that strips HTML tags and avoids mid-tag truncation before storing to `poll_run.error_message`. (Truncation largely exists already — this is consolidation + HTML stripping, not net-new.) Full raw errors may still go to logs.
3. **Degraded-source flag** (config or DB, propose which): sources marked `degraded` (GDELT now) show "degraded — known issue" in expanded status instead of a fresh daily alert. Reddit is currently healthy per sources.ts — do NOT mark it degraded; flip only if the 403 recurs.
4. No changes to polling, retry, or reporting logic. Loud failure holds at the data layer; only presentation calms down.

## Documentation Task (parallel, required before slice close)

**Backport production-discovered collisions into `lakepointe-disambiguation.md`:**
- Add to §2g (Other churches / collisions): LakePointe City Church (Hot Springs), Lakepoint Church, Lake Point Online, the options-trader Josh Howerton, Farmington police chief Josh Howerton context, Pokémon Go "Lake Pointe Church" gym landmark, Rockwall cheer/local-news incidental uses.
- Revise §4's "low-collision" verdict — production data has falsified it for both "Josh Howerton" and "Lake Pointe Church."
- Snapshot the current `channel_reputation` rows into §2g (or an appendix) so seed-classification knowledge lives somewhere durable before the table migration, not only in DB rows.
- Sequencing: the §2g snapshot happens **before Gate B** (pre-migration record); the rest may land in parallel with the build.

## Out of Scope (do not build)

- Scoring/weighting/negative-phrase integration (Slice 8, blocked on locating the Cowork phrase list)
- Sentiment analysis or any LLM calls
- Weekly email digest (post-scoring)
- Auth/roles (dropdown is friction, not security)
- Subreddit-level classification; YouTube channel-ID keying
- Any poller/retry logic changes; any Reddit-403 infrastructure work

## Gates

- **Gate B:** proposed migrations (entity_reputation + other-church→wrong-entity rewrite, domain column, excluded_reason CHECK) + Google News backfill preview (parsed rows, NULL count) + new server-side query/API shape (SQL shown) → approval
- **Gate C:** summary strip + status line mockup/description → approval
- Show diffs before every write throughout. `channel_reputation` cleanup migration is its own approval after read-path verification.
