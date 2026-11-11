---
name: audit
description: Run the mBowl multi-agent, read-only, full-tree audit (the Phase 20 method) and produce a triaged fix list with a hallucination-filter verification pass. Use before a native build, an SDK upgrade, or when Marcus asks for an audit.
---

# /audit — multi-agent read-only audit

Method from `docs/PHASE20-AUDIT.md` (16 agents, 4 tiers, verification pass).
**Read-only: no agent edits any file.** The output is a document, not fixes.

## 1. Scope
State the tree being audited: `git rev-parse --short HEAD` plus any
uncommitted files. Read `CLAUDE.md`, the latest session brief, and the
previous audit doc so known items aren't re-reported as new.

## 2. Fan out (parallel subagents, each read-only)
Give each agent ONE slice and the project rules (CLAUDE.md Non-Negotiables,
Storage Keys + read-state rules, Locked Decisions). Suggested slices:
- **Data safety:** `src/storage.ts`, `src/backup.ts`, `app/_layout.tsx` seed path.
- **Scoring:** `app/log-frames.tsx` scorer, frame entry, 10th frame, edit-from-History path.
- **Draft + Log:** `app/(tabs)/log/index.tsx` draft save/restore/submit.
- **History + edit:** `app/(tabs)/history/index.tsx`, `components/EditSessionModal.tsx`, the FRAME_RESULT hand-off.
- **Stats math:** `app/(tabs)/stats/index.tsx`, `src/leaveUtils.js`, `src/seasons.ts`, `src/sessionFilter.ts`.
- **Settings:** `components/SettingsContent.tsx` (seasons CRUD, balls, export/restore).
- **Reference tab + subtabs.**
- **Native/config:** `app.json`, `package.json`, notifications, OTA channel.
- **Screen size:** fixed sizes, `Dimensions.get`, safe areas (the Duo's cover + inner screens).
Each agent returns findings as: severity (MUST / SHOULD / NICE), `file:line`,
a concrete failure scenario (inputs → wrong output / crash / data loss), and
the evidence lines.

## 3. Verify (separate agent that did not write any finding)
Re-read the cited code for every finding. Mark CONFIRMED, PLAUSIBLE, or CUT
(false positive, with the reason). Nothing reaches the list unverified.

## 4. Write the doc
`docs/PHASE<N>-AUDIT.md`: an AGREED TRIAGE block first (what blocks the next
build, what defers to OTA, what's docs-only), then MUST → SHOULD → NICE, then
the cut list with reasons. IDs continue from the previous audit.

## 5. Report to Marcus
Counts per severity, the blocking items in one line each, and a recommendation.
