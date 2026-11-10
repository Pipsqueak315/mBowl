---
name: ship
description: Finish an mBowl change end to end — run every check, get the reviewer agent's pass, commit, push, update the session brief and CLAUDE.md pointer. Use when a change is built and Marcus says ship, or at the end of a phase.
---

# /ship — the end-of-phase protocol, as one routine

Never skip a step. If any step fails, stop and report; nothing ships on a red check.

1. **Checks.** Run `npm run check`. Every check must pass (TypeScript, leaves,
   seasons, rules, stats harness). Fix failures before continuing.
2. **Review.** Run the `reviewer` agent on the diff (`git diff master...HEAD`).
   Fix every BLOCK finding. Report WARN findings to Marcus in one line each.
3. **Risk gate.** Level 2 (stored data) or Level 3 (native) changes need
   Marcus's explicit "ship it" in this conversation. Level 2 also needs a fresh
   backup copied off the phone first (Settings → Export Backup) and
   `npm run backup-check -- <file>` numbers recorded before and after.
4. **Commit + push.** Commit on the feature branch with a message that says
   what changed for the bowler. Push the branch. On Windows: one command at a
   time, multi-line messages via a file and `git commit -F <file>`.
5. **Merge.** Open a PR into master (or merge if Marcus says so). CI
   (`ci.yml`) runs `npm run check` on GitHub.
6. **OTA (Level 1–2 only).** After merge: `npm run ship:ota` on the PC, or run
   the **OTA** workflow on GitHub (Actions → OTA → Run workflow). Never type
   `eas update` by hand — the hook blocks it.
7. **Record.** Bump the session brief REV (copy the latest
   `mBowl-SessionBrief-REV*.md` to the next number), add a Session Notes row,
   update the brief pointer in `CLAUDE.md` (every place it appears), and update
   `docs/mBowl-DuoPlan.md` status if a plan item finished.
8. **Knowledge upload.** Upload the new brief to the Claude.ai project
   ("Bowling stats app & tracker"). This is the step that keeps getting missed.
9. **Tell Marcus** in 2–3 lines: what changed on his phone, what to check
   (about 2 minutes), and how to roll back if it looks wrong.
