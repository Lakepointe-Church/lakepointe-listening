# Slice 9 — Manual Mention Submission

**Project:** lakepointe-listening (Vercel team: plafatas-projects, Neon Postgres)
**Mode:** Show-before-commit at every step. Phase 0 discovery before any code.

**Context:** Two categories of signal are unreachable by any poller: (1) posts in private/local Facebook groups (no legitimate API exists — Groups API removed, scraping ruled out on ToS + ethics), and (2) unnamed/indirect mentions — content about Josh Howerton or Lakepointe that never contains a matchable string (e.g., a Substack essay understood to be about Josh without naming him). Staff who see these become the sensor; this slice builds the capture path. Also covers X and any other source manually until/unless real integrations exist.

**Decisions locked:**
- URL-duplication check on submit: warn, don't block (Jolie approved).
- Manual field entry only — NO auto-fetch of URL metadata in this slice (deferred as later polish).
- NO "sensitive" flag/visibility mechanism. Instead: neutral-language guidance baked into form placeholder text (see Phase 2.4), and an open item for Paul on pre-auth comfort level for interpretive entries. Real protection waits for auth (long-deferred).
- "Podcast" included in the source picker now (PodcastIndex slice 8 on hold pending auth email; future polled podcast items dedupe against manual ones by URL).

---

## Phase 0 — Discovery Gate (no code)

1. Read the current mention table schema and confirm which existing columns can carry manual-entry data vs. what needs adding. Expected additions (verify, don't assume): content-date vs. ingested-at handling, submitted_by, indirect flag, source_detail, topic storage for multi-topic.
2. Confirm how matched keyword is stored/rendered (Slice 6/7 work) so topic assignment maps cleanly into the existing keyword filter — including whether one item can currently carry multiple keywords, since multi-topic manual items need it (report the gap if not).
3. Confirm the per-item exclude path (`excluded_reason = 'manual'` from Slice 7) exists and works — note the naming collision: `'manual'` currently means "manually excluded." This slice introduces source `manual` (manually *added*). Propose non-confusing naming (e.g., source value `manual_submission` or `staff`, or rename the excluded_reason value) at the gate — do not ship both meanings of "manual" unlabeled.
4. Report + revised plan. **STOP for approval.**

## Phase 1 — Data Model

1. Manual items live in the same mention table (one feed, one machinery). New/confirmed fields per Phase 0, expected:
   - `source` = the manual-source value decided at gate; `source_detail` TEXT (which group / newsletter / show)
   - `manual_source_type` or equivalent: `facebook_group | x | newsletter | news_article | podcast | other` (drives the source chip label)
   - content published date (drives time windows) AND entered-at timestamp (audit) — both stored
   - `submitted_by` TEXT (simple name, no auth — honest attribution, not security)
   - `indirect` BOOLEAN default false
   - topic(s): maps into the keyword mechanism so the existing keyword filter works; multi-topic supported
   - URL nullable — but enforce at the API layer: URL required unless source type is `facebook_group`; if URL is null, note is required
2. Additive migration only. CHECK constraints consistent with Slice 7 conventions (hyphenated enums where applicable).
3. Manual items bypass entity_reputation (they're pre-filtered signal by definition) but remain excludable via the existing per-item exclude, and fully participate in: time windows, keyword filter, summary strip counts, and future scoring at full weight.

## Phase 2 — Submission Form

1. **Entry point:** "Add mention" button in the dashboard header. Must be usable on mobile — the primary capture scenario is seeing a Facebook group post on a phone. Implement as a dedicated `/add` route (bookmarkable / add-to-home-screen) rather than a modal.
2. **Fields:**
   - URL (required except facebook_group; on blur, run the duplicate check — if the URL already exists in the mention table, show a warning with a link to the existing item; allow submission anyway)
   - Source type picker: Facebook group / X / Newsletter–Substack / News article / Podcast / Other
   - Source detail (free text; label adapts to picker: "Which group?" / "Which newsletter?" etc.)
   - Title (required; for group posts, a staff-written one-liner)
   - Topic multi-select: Josh Howerton / Lakepointe Church / Live Free (at least one required)
   - Content date (date picker, defaults to today)
   - Note (free text, multi-line; required when URL is empty)
   - Indirect reference checkbox: "Doesn't explicitly name Lakepointe/Josh"
   - Submitted by (text, remembered via localStorage or equivalent client persistence — NOTE: if this renders inside an artifact-style context localStorage is unavailable, but this is the Next.js app, where it's fine)
3. **Placeholder/guidance text (required, verbatim intent):**
   - Note field placeholder: "Context for future readers — why this matters. For private group posts: paraphrase, don't quote members verbatim. For indirect mentions: describe relevance neutrally (e.g., 'circulating in circles adjacent to LP; relevance per comms team') rather than as a declarative claim."
4. Submit → append-only insert → redirect/return to feed with the new item visible. No review/approval step.

## Phase 3 — Feed Rendering

1. Manual items render as standard cards with: source chip from `manual_source_type` (labeled naturally: "Facebook group", "X", "Newsletter", …), source detail as the byline ("in Rockwall Word of Mouth" / "by Mary DeMuth's Substack"), topic chip(s), note displayed as the excerpt, date = content date.
2. **Indirect badge:** distinct, quiet badge ("Indirect") on flagged items so readers immediately understand why the linked content won't contain the name.
3. A small "added by {name}" attribution line (muted).
4. **Edit for manual items only:** title, note, topics, source detail editable post-hoc (typos, better context). Polled items remain immutable. No hard delete — removal = existing per-item exclude.
5. Manual sources appear in Connected sources view as their own group ("Manually monitored: Facebook groups, X, …") — this finally replaces the X/Meta placeholder tiles' "no path" story with an honest "manually monitored" state. Update those tiles' copy accordingly.

## Phase 4 — Counts & Summary Strip

1. Manual items count in the summary strip volume and per-source counts (grouped as their source types or as one "Manual" bucket — propose at Gate B; lean: group by source type so "Facebook groups: 3" reads meaningfully).
2. Time-window filtering keys on content date, not entered-at.

## Open Item for Paul (note in spec, not a build task)

Pre-auth comfort level for interpretive/sensitive manual entries (unnamed-mention class): confirm the neutral-language working rule suffices until auth ships, or whether this accelerates the auth timeline. No mechanism in this slice either way.

## Out of Scope

- URL metadata auto-fetch (later polish slice if entry friction warrants)
- Sensitive flag / visibility controls / auth
- Any Facebook or X API work, scraping, or session automation
- Scoring (still pending negative-phrase list)
- Browser-extension or share-target capture (possible future polish; `/add` route is the v1)

## Gates

- **Gate A:** Phase 0 findings + naming resolution for the manual/manual collision + field mapping → approval
- **Gate B:** migration diff + form implementation plan + summary-strip grouping decision → approval
- **Gate C:** UI diffs (form, cards, Connected sources copy changes) → approval
- Show diffs before every write throughout.
