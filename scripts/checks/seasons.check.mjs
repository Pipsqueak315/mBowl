// Season model + shared filter checks against the REAL src/seasons.ts and
// src/sessionFilter.ts (Phase 26A.2). Runs on the 18 seed sessions — the real
// backup never enters the repo. Use /backup-check for the real file.
import { DEFAULT_SEASONS, getSeasons, resolveSeasonRanges, seasonForDate, currentSeason } from '../../src/seasons.ts';
import { filterSessions, ALL_TIME } from '../../src/sessionFilter.ts';
import { SEED_SESSIONS } from '../../src/seeds.js';
import { check, eq, done } from './lib.mjs';

const seasons = getSeasons({}); // no settings.seasons → DEFAULT_SEASONS
eq(seasons.map(s => s.id), DEFAULT_SEASONS.map(s => s.id), 'missing settings.seasons → defaults');

// Gapless: each season ends the day before the next starts; last is open.
const ranges = resolveSeasonRanges(seasons);
for (let i = 0; i < ranges.length - 1; i++) {
  const nextStart = new Date(ranges[i + 1].start + 'T00:00:00Z');
  nextStart.setUTCDate(nextStart.getUTCDate() - 1);
  eq(ranges[i].end, nextStart.toISOString().slice(0, 10), `${ranges[i].id} ends the day before ${ranges[i + 1].id}`);
}
eq(ranges[ranges.length - 1].end, null, 'latest season is open-ended');

// Boundaries land on the right side.
for (const r of ranges) {
  eq(seasonForDate(r.start, seasons), r.id, `${r.start} (a start date) → ${r.id}`);
}
const first = ranges[0];
eq(seasonForDate('2000-01-01', seasons), null, 'a date before the first season → null');
eq(currentSeason(seasons, '2099-01-01')?.id, ranges[ranges.length - 1].id, 'far future → latest season');
check(first != null, 'at least one season');

// Every seed lands in exactly one season; season buckets sum to the total.
let bucketed = 0;
for (const r of ranges) bucketed += filterSessions(SEED_SESSIONS, r.id, seasons, 'all').length;
eq(bucketed, SEED_SESSIONS.length, 'season buckets sum to all seed sessions (gapless)');
for (const s of SEED_SESSIONS) check(seasonForDate(s.date, seasons) != null, `seed ${s.id} (${s.date}) is in a season`);

// All-Time is the full set; type filter narrows it.
eq(filterSessions(SEED_SESSIONS, ALL_TIME, seasons, 'all').length, SEED_SESSIONS.length, 'All-Time = every session');
const league = filterSessions(SEED_SESSIONS, ALL_TIME, seasons, 'league');
check(league.every(s => s.type === 'league'), "type 'league' returns only league sessions");
eq(filterSessions([], ALL_TIME, seasons, 'all'), [], 'empty input → empty output');

done('seasons');
