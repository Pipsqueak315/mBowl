---
name: feature
description: Turn a rough mBowl feature idea into a decision brief (pros, cons, effort, risk level, OTA or native, data impact, recommendation) before any code is written. Use when Marcus describes a new feature or change.
---

# /feature — the decision brief

Step 2 of the loop in `docs/mBowl-DuoPlan.md` → "How we work". Marcus describes a
feature; you return this brief and **write no code** until he says go.

## Before writing the brief
1. Read `CLAUDE.md`. Read the latest `mBowl-SessionBrief-REV*.md` START HERE section.
2. Check the **Locked Decisions** table and Non-Negotiable Rules. If the idea
   conflicts with one (a 5th tab, light mode, a new storage engine, custom
   fonts), say so first and offer the closest version that fits.
3. Read the files the feature would touch. Name them in the brief.

## The brief (same format every time, plain English, no jargon without a gloss)

**What you'd get** — 2–3 sentences from the bowler's point of view.

**Risk level** — 1 (UI / read-time stats), 2 (touches stored data: saving,
backup/restore, scoring, storage keys, migrations), or 3 (native: new native
module, SDK upgrade, `app.json` native fields). One line on why.

**Ships how** — OTA (`eas update`, lands next app open) or native build
(iloader reinstall). Native if it needs a module not already in the binary.

**Touches your data?** — yes/no. If yes: which keys, and whether old data
needs converting. Level 2 adds three gates: read-only audit first, a fresh
backup copied off the phone, and Marcus's explicit "ship it".

**Pros** / **Cons** — 2–4 bullets each. Honest; include "not worth it" when true.

**Effort** — small (one session) / medium (2–3) / large (a phase).

**Options** — if there are real alternatives, 2–3 with the trade-off of each.

**Recommendation** — one clear pick and why. Push back if the idea doesn't
serve his goals (consistency, a 190 average, low-friction logging on league night).

**Open questions** — only ones whose answer changes what gets built.

End with: "Say **go**, change it, or park it."

When he decides, add a line to the session brief's Session Notes recording
the decision, then build on a branch.
