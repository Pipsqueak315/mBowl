---
name: backup-check
description: Read an mBowl-backup.json and report sessions, games, averages, frame coverage, and per-season counts. Use before and after a restore, a phone move, or an SDK upgrade to prove no data was lost.
---

# /backup-check

1. Get the file. On the phone: Settings → **Export Backup** → Save to Files (or
   AirDrop to the PC). Never commit it — `mBowl-backup.json` and
   `docs/phase24-data.json` are gitignored, and `npm run check` enforces that.
2. Run (read-only):
   ```
   npm run backup-check -- path/to/mBowl-backup.json
   ```
3. Report to Marcus in plain English: exported date, sessions and date range,
   games / average / high game, games with frames, per-season session counts,
   and whether every session landed in a season.
4. **Comparing two files** (before vs after a move or upgrade): run it on both
   and list any number that differs. Every number must match. If anything
   differs, stop: do not continue the move or upgrade until it's explained.
5. For a deeper stats comparison, the Phase 24 harness reads any file:
   ```
   node scripts/phase24-verify.mjs --data path/to/file.json --expect <w25>,<j26>,<w26>
   ```
