# Slice 7 — Classification Everywhere, Collapsed Triage UI, and the Executive Layer

**Project:** lakepointe-listening (Vercel team: plafatas-projects, Neon Postgres)
**Mode:** Show-before-commit at every step. No code until Phase 0 discovery is complete and findings are reported back.

**Context:** Slice 6 shipped (channel classification for YouTube, obit exclusion, keyword filter, excluded-items toggle). Manual triage of YouTube channels is done. This slice does three things: (1) extends classification beyond YouTube, (2) reworks the triage controls so they read as status badges instead of an always-open button row, and (3) adds the layer that makes the page legible to a stakeholder opening it cold — a summary strip, time filtering, and calm source status.

---

## Phase 0 — Discovery Gate (REQUIRED FIRST, no code)

1. Read the current schema: items table, `excluded_reason` values in use, `channel_reputation` table shape (confirm whether classification keys on channel ID or channel title).
2. Read the feed card component(s) and how the YouTube classification buttons are wired (state, mutation endpoint, retroactive re-application behavior).
3. Confirm what author/source identity fields exist for Reddit items (subreddit? username?) and Google News items (the `via` source domain). These determine what classification can key on per source.
4. Confirm how the source-status error banner is populated and where the raw error body comes from.
5. Report findings + revised plan. **STOP for approval.**

---

## Phase 1 — Classification Beyond YouTube

**Goal:** every item in the feed has a suppression path, not just YouTube.

1. **Generalize the reputation table** from YouTube channels to a source-scoped entity table, e.g. `entity_reputation`: (`source` [youtube|reddit|google_news], `entity_key`, `classification`, `updated_at`). Migrate existing channel rows into it (additive migration; keep old table until verified, then propose cleanup).
2. **Entity keys per source** (confirm against Phase 0 findings):
   - YouTube → channel (as today)
   - Reddit → author username (e.g. `/u/JustAoplogize`) — subreddit-level classification is OUT of scope for now; author is the right grain (one prolific hostile poster ≠ suppress all of r/Rockwall, and we don't want to hide criticism anyway, just wrong-entity noise)
   - Google News → source domain (the `via` value, e.g. `legacy.com` — note this partially overlaps the obit domain blocklist; classification should NOT replace that mechanism, they coexist)
3. **Add a classification value: `wrong_entity`.** This covers: the options-trader Josh Howerton, the Farmington police chief, LakePointe City Church (Hot Springs), Pokémon Go "Lake Pointe Church" gym posts, Rockwall cheer spotlights, etc. Rename or keep `other_church` — propose whichever is cleaner given existing data (if `other_church` rows exist, `wrong_entity` can supersede it or coexist; Claude Code proposes, Jolie decides at gate).
   - Full classification set after this slice: `owned` | `reupload` | `commentary` | `wrong_entity` | `unclassified` (+ `other_church` if retained).
   - `wrong_entity` items are excluded from the default feed and appear under the excluded toggle, same as `reupload`.
4. **Per-item exclude (escape hatch).** Some noise won't map cleanly to a reusable entity (a one-off Reddit post from a throwaway account, a single odd Google News hit). Add a per-item "Exclude this item" action setting `excluded_reason = 'manual'`. Recoverable via the excluded toggle like everything else. This is deliberately item-level, not entity-level — no reputation row created.
5. Entity classification remains retroactive: classifying `/u/somebot` as `wrong_entity` hides all their existing and future items.

## Phase 2 — Collapsed Triage UI

**Goal:** classification reads as a status tag, and casual viewers can't reclassify by accident.

1. **Default card state:** show a single small badge with the current classification (e.g. `Commentary`, `Unclassified`). No button row. Badge styling per lakepointe-brand skill conventions — read `~/.claude/skills/lakepointe-brand/` equivalent in this repo (or existing theme tokens) before styling; muted/neutral tones, not orange, since these are metadata not calls to action. `Unclassified` should be visually quiet, not alarming.
2. **Edit affordance:** a small chevron/kebab on the badge opens a compact menu (dropdown or popover) with the classification options + the per-item "Exclude this item" action. Selecting closes the menu and updates immediately. One extra click is the point — it prevents drive-by clicking by stakeholders.
3. This replaces the current always-visible four-button row on YouTube cards, and is the same component across YouTube, Reddit, and Google News cards (menu contents adapt to source-appropriate options).
4. No auth/roles in this slice — the dropdown is friction, not security. (Real access control stays deferred, consistent with the CIP decision to defer auth until the dashboard matures.)

## Phase 3 — Executive Layer: Summary Strip

**Goal:** answer "should I be worried?" in the first five seconds, before the feed.

1. Add a summary strip between the header and the feed with, computed from non-excluded items:
   - **Volume:** mentions in the last 7 days, with comparison to the prior 7 days (e.g. "23 mentions this week, ↑ from 15"). Pure count from existing data — no new ingestion.
   - **By source:** compact counts (YouTube 4 · Reddit 9 · News 10) for the same window.
   - **Needs attention:** count of items in the window from `commentary`-classified entities + (future) negative-phrase hits. Until scoring exists (Slice 8), commentary classification is the proxy for "someone is talking ABOUT us."
2. No LLM calls, no sentiment, no editorializing — just counts. The strip is honest math over existing rows. Anything smarter waits for the scoring slice.
3. Keep it visually light: one row, brand-neutral, no red unless a poller is down (see Phase 5).

## Phase 4 — Time Window Filter

1. Add a time filter alongside source/keyword filters: **7 days (default) / 30 days / 90 days / All**.
2. Default view = last 7 days. The full multi-year archive stays one click away under "All."
3. All counts (source tabs, keyword chips, summary strip, excluded count) respect the active window so numbers stay mutually consistent — inconsistent counts are worse than no counts.

## Phase 5 — Calm Source Status

**Goal:** loud failure for Jolie, quiet status for everyone else. No behavior change to polling/retry logic — presentation only.

1. Replace the top error banner with a **compact status line**: e.g. "6 of 8 sources healthy · last updated 8:13 PM" with a subtle warning tint when something is failing. Clicking expands the per-source detail (current banner content, improved per below).
2. **Truncate error payloads.** Store/display at most ~200 chars of any error body and strip HTML tags before display. "Reddit RSS HTTP 403 (blocked)" is the signal; Reddit's block-page CSS is noise. Full raw error can still go to logs — truncation is display-side (or bounded at write time; propose based on where the message is stored).
3. **Degraded-source state.** Add a per-source flag (config or DB) marking a source as `degraded` (known-unreliable: GDELT now, possibly Reddit if the 403 persists). Degraded sources show as "degraded (known issue)" in the expanded status rather than as a fresh red alert every day. Flipping the flag is a config/DB change, not a UI control.
4. This does NOT soften anything in logs or reduce retry/reporting — loud failure principle holds at the data layer; only the front-door presentation calms down.

## Out of Scope (do not build)

- Scoring/weighting/negative-phrase integration (Slice 8, blocked on locating the Cowork phrase list)
- Sentiment analysis or any LLM calls
- Weekly email digest (post-scoring)
- Auth/roles
- Any changes to poller logic, retries, or the Reddit 403 itself (that's an infrastructure investigation, tracked separately)
- Subreddit-level classification

## Gates

- Gate A: Phase 0 findings + revised plan → approval
- Gate B: entity table migration + proposed classification-set changes (wrong_entity vs other_church) → approval
- Gate C: summary strip + status line mockup/description before implementation → approval
- Show diffs before every write throughout.

## Open Question for Jolie (answer at Gate A)

Reddit's `via`-style author grain: if Phase 0 shows Reddit items only store display author (`/u/name`) as free text, classification keys on that string — acceptable, but note a renamed account escapes it. Fine for v1?
