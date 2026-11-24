# mBowl -- putting a previous OTA back (Phase 26A.7, Nov 15)

**When:** an over-the-air update misbehaves on the Duo and you want the last good version back *now*, before a fix is ready.

**How (Claude in a cloud session, or Marcus in the GitHub app/site):**
1. Pick the update group to go back to -- the newest one that ran fine on the phone (table below, or the `Update group ID` line in that OTA run's log).
2. Actions -> **Rollback** -> Run workflow (branch `master`) -> paste the **full** group ID -> Run.
   Cloud session: `env -u GH_TOKEN gh api -X POST repos/Pipsqueak315/mBowl/actions/workflows/rollback.yml/dispatches -f ref=master -f 'inputs[group]=<full-id>'`
3. On the Duo: swipe mBowl closed and reopen once or twice (it downloads on launch, applies on the next).
4. Then fix forward on a branch as usual. The next normal OTA from `master` replaces the rollback.

**What it does:** `eas update:republish --group <id>` on the production branch -- the old bundle becomes the newest update. Nothing is built or checked, so only republish a group that already ran fine on the phone. **Data:** a rollback changes code, not saved data -- but code from before a data-shape change could misread newer data. Part A/B (Nov 15) add no data-shape change (one new transient key, `mbowl_frames_in_progress`, which older code simply ignores), so rolling back across them is safe.

**Dry run (26A.8):** republish the group that is live right now -> no visible change on the phone. Proves the workflow + token work before you need them.

**Fallback (still valid):** revert the bad commit on `master` + a normal OTA (`ota.yml`).

## Known update groups (runtime 2.0.0, production)

| Group ID | App code | What | Ran fine on the Duo? |
|---|---|---|---|
| `ee0882ee-f884-41a4-b8d7-c6c69d0f69a5` | `20bfa97` | Pre-league batch (M2, S17-S20), Nov 11 | Yes -- league Week 10 + 11/7 makeup, Nov 14-15 |
| `766e68a8-fbdc-4a50-955f-18e294806e60` | `a8b3dca` | After-league batch A-D (data safety, mid-game save, Reference trim), Nov 18 (OTA run 44336666836) | Yes -- Marcus, Nov 20: "all on my phone, I think we're good" |
| `e7cd0dff-5bfa-455a-bd90-943e5c3a0d61` | `02db869` | Phase 29: Path to goal + Spare leak on Stats, Nov 21 (OTA run 44958332762). Rollback-safe: older code ignores the new optional `Season.weeks` | Yes -- Marcus, Nov 22: "everything checks out" |
| `814db029-5007-4f67-9069-1934733e5df7` | `492209a` | Phase 30A: 190 recipe, Leave -> fix, Tilt cost on Stats, Nov 23 (OTA run 45277551319). Read-only; rollback-safe | Pending -- first look after the update |
| `7ac39a2a-3932-4e0e-a3f1-3ea2b7dcc0f9` | `d9121f3` | Phase 30B: Reference restyle + right-handed content + one-time REFERENCE upgrade, Nov 24 (OTA run 45445539433). **Data:** the upgrade rewrites REFERENCE once (stamp `referenceVersion: 2`); rolling back to 814db029 is safe -- older code ignores the stamp and shows the upgraded text as-is (it won't revert it) | Pending -- first look after the update |

Add a row after every OTA (the `Update group ID` from the run log).
