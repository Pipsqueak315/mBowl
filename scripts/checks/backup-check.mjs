// /backup-check — read an mBowl-backup.json and report what's in it (26A.4).
//
//   node --import ./scripts/checks/register.mjs scripts/checks/backup-check.mjs <path-to-backup.json>
//
// Read-only. Uses the REAL season model (src/seasons.ts) so the buckets match
// the app. Use it before/after a restore, a phone move, or an SDK upgrade:
// every number must match.
import { readFileSync } from 'node:fs';
import { getSeasons, resolveSeasonRanges, seasonForDate } from '../../src/seasons.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: backup-check.mjs <path-to-mBowl-backup.json>');
  process.exit(2);
}
const raw = JSON.parse(readFileSync(file, 'utf8'));
const sessions = Array.isArray(raw) ? raw : raw.sessions;
if (!Array.isArray(sessions)) {
  console.error('✗ no sessions array in this file — not an mBowl backup?');
  process.exit(1);
}

const scored = s => s.games.filter(g => g.score != null);
const allGames = sessions.flatMap(scored);
const avg = gs => (gs.length ? (gs.reduce((a, g) => a + g.score, 0) / gs.length).toFixed(1) : '—');
const dates = sessions.map(s => s.date).sort();
const withFrames = allGames.filter(g => Array.isArray(g.frames) && g.frames.length > 0);
const pinFrames = withFrames.flatMap(g => g.frames).filter(f => Array.isArray(f?.pinsStanding) && f.pinsStanding.length > 0);

console.log(`File:        ${file}`);
if (raw.exportedAt) console.log(`Exported:    ${raw.exportedAt} (format v${raw.version ?? '?'})`);
console.log(`Sessions:    ${sessions.length}   (${dates[0] ?? '—'} → ${dates[dates.length - 1] ?? '—'})`);
console.log(`Games:       ${allGames.length}   average ${avg(allGames)}   high ${allGames.length ? Math.max(...allGames.map(g => g.score)) : '—'}`);
console.log(`Frame data:  ${withFrames.length} games with frames, ${pinFrames.length} frames with pins`);

const byType = {};
for (const s of sessions) byType[s.type] = (byType[s.type] ?? 0) + 1;
console.log(`By type:     ${Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(' · ')}`);

const seasons = getSeasons(raw.settings ?? {});
console.log('By season:');
let total = 0;
for (const r of resolveSeasonRanges(seasons)) {
  const inSeason = sessions.filter(s => seasonForDate(s.date, seasons) === r.id);
  total += inSeason.length;
  const gs = inSeason.flatMap(scored);
  console.log(`  ${r.short.padEnd(12)} ${r.start} → ${r.end ?? 'open      '}  ${String(inSeason.length).padStart(3)} sessions  ${String(gs.length).padStart(4)} games  avg ${avg(gs)}`);
}
const outside = sessions.length - total;
console.log(outside === 0 ? '  ✓ every session lands in a season' : `  ✗ ${outside} session(s) fall outside every season`);

if (Array.isArray(raw.balls)) console.log(`Balls:       ${raw.balls.length}`);
if (raw.settings) {
  const { targetAverage, targetSeries } = raw.settings;
  console.log(`Goals:       target average ${targetAverage ?? '—'}, target series ${targetSeries ?? '—'}`);
}
process.exitCode = outside === 0 ? 0 : 1;
