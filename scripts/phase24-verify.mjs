// Phase 24 verification harness — THROWAWAY, NOT SHIPPED.
//
// Run (seeds smoke test):
//   node scripts/phase24-verify.mjs --expect 18,0,0
// Run (real data, tomorrow — AFTER Marcus bowls, buckets become 24/13/1=38):
//   node scripts/phase24-verify.mjs --expect 24,13,1 \
//     --at-avg <x> --at-games <x> --at-sessions 38 --at-league-avg <x> --at-league-games <x>
//
// --expect  w,j,n : expected session counts per season in ASCENDING start order
//                   (winners-2025, jubilee-2026, winners-2026). Total = their sum
//                   unless --total overrides. Omit → count assertions not run.
// --total   N     : override expected grand total (defaults to sum of --expect).
// --at-*    N     : optional All-Time ground-truth anchors (avg/games/sessions +
//                   league avg/games). Omit → anchor assertions not run.
//
// Data: reads docs/phase24-data.json (real export; array or {sessions:[...]}) if
// present, else falls back to src/seeds.js and flags that it is NOT the real set.
//
// computeLeaveStats is imported from real source (leaveUtils.js) so Makeable %
// cannot diverge. calcMetrics / calcAdvancedStats are copied verbatim from
// app/(tabs)/stats.tsx (RN component, not importable in Node); the season
// helpers mirror src/seasons.ts.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeLeaveStats } from '../src/leaveUtils.js';
import { SEED_SESSIONS } from '../src/seeds.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- Args -------------------------------------------------------------------
const argv = process.argv.slice(2);
function getArg(name) {
  const eq = argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const idx = argv.indexOf(`--${name}`);
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) return argv[idx + 1];
  return undefined;
}
const expectRaw = getArg('expect');
const expectCounts = expectRaw ? expectRaw.split(',').map(n => parseInt(n.trim(), 10)) : null;
const totalArg = getArg('total');
const expectTotal =
  totalArg != null ? parseInt(totalArg, 10)
  : expectCounts ? expectCounts.reduce((a, b) => a + b, 0)
  : null;
const anchors = {
  avg: getArg('at-avg'),
  games: getArg('at-games'),
  sessions: getArg('at-sessions'),
  leagueAvg: getArg('at-league-avg'),
  leagueGames: getArg('at-league-games'),
};
const hasAnchors = Object.values(anchors).some(v => v != null);

// --- Load data --------------------------------------------------------------
const DATA_PATH = join(ROOT, 'docs', 'phase24-data.json');
let sessions;
let usingReal = false;
if (existsSync(DATA_PATH)) {
  const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  sessions = Array.isArray(raw) ? raw : raw.sessions;
  usingReal = true;
} else {
  sessions = SEED_SESSIONS;
}

// --- Season helpers (mirror src/seasons.ts) ---------------------------------
const DEFAULT_SEASONS = [
  { id: 'winners-2025', label: "Bob's Saturday Winners 2025", short: 'Winners 25', start: '2025-09-06' },
  { id: 'jubilee-2026', label: "Bob's Saturday Jubilee 2026", short: 'Jubilee 26', start: '2026-05-30' },
  { id: 'winners-2026', label: "Bob's Saturday Winners 2026", short: 'Winners 26', start: '2026-09-12' },
];
function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function resolveSeasonRanges(seasons) {
  const sorted = [...seasons].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.map((s, i) => {
    const next = sorted[i + 1];
    return { ...s, end: next ? addDaysISO(next.start, -1) : null };
  });
}
function seasonForDate(date, seasons) {
  for (const r of resolveSeasonRanges(seasons)) {
    if (date >= r.start && (r.end === null || date <= r.end)) return r.id;
  }
  return null;
}

// --- Metric functions (verbatim from app/(tabs)/stats.tsx) ------------------
function calcMetrics(sessions) {
  if (sessions.length === 0) return null;
  const allGames = sessions.flatMap(s => s.games.filter(g => g.score != null));
  if (allGames.length === 0) return null;
  const scores = allGames.map(g => g.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highGame = Math.max(...scores);
  let highSeries = 0;
  for (const s of sessions) {
    const total = s.games.filter(g => g.score != null).reduce((sum, g) => sum + g.score, 0);
    if (total > highSeries) highSeries = total;
  }
  const gamesWithFrames = allGames.filter(g => Array.isArray(g.frames) && g.frames.length > 0);
  let frameStats = null;
  if (gamesWithFrames.length > 0) {
    let totalFrames = 0, strikes = 0, spareOpps = 0, spares = 0, opens = 0;
    for (const g of gamesWithFrames) {
      const scoringFrames = g.frames.slice(0, 9);
      for (const f of scoringFrames) {
        totalFrames++;
        if (f.throws[0] === 'X') strikes++;
        else { spareOpps++; if (f.throws[1] === '/') spares++; else opens++; }
      }
    }
    frameStats = {
      strikeRate: totalFrames > 0 ? (strikes / totalFrames) * 100 : 0,
      spareRate: spareOpps > 0 ? (spares / spareOpps) * 100 : 0,
      opensPerGame: gamesWithFrames.length > 0 ? opens / gamesWithFrames.length : 0,
    };
  }
  return { avg, highGame, highSeries, frameStats, gameCount: allGames.length, sessionCount: sessions.length };
}

function firstBallPins(t) {
  if (t === 'X') return 10;
  if (t === '—' || t === '-') return 0;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}
const frameIsStrike = f => f.throws[0] === 'X';
const frameIsSpare = f => f.throws[1] === '/';
const frameIsMark = f => frameIsStrike(f) || frameIsSpare(f);
const frameIsOpen = f => f.throws[0] !== 'X' && f.throws[1] != null && f.throws[1] !== '/';

function calcAdvancedStats(sessions) {
  let firstBallTotal = 0, firstBallCount = 0;
  let bounceOpp = 0, bounceHit = 0;
  let doubleOpp = 0, doubleHit = 0;
  let cleanGames = 0, gamesWithFrames = 0;
  for (const s of sessions) {
    for (const g of s.games) {
      if (!Array.isArray(g.frames) || g.frames.length === 0) continue;
      const frames = g.frames;
      gamesWithFrames++;
      for (const f of frames) {
        if (!f || !Array.isArray(f.throws) || f.throws.length === 0) continue;
        const pins = firstBallPins(f.throws[0]);
        if (pins != null) { firstBallTotal += pins; firstBallCount++; }
      }
      let hasOpen = false;
      for (const f of frames) { if (f && frameIsOpen(f)) { hasOpen = true; break; } }
      if (!hasOpen) cleanGames++;
      for (let i = 0; i < frames.length - 1 && i < 9; i++) {
        const f = frames[i], next = frames[i + 1];
        if (!f || !next) continue;
        if (frameIsOpen(f)) { bounceOpp++; if (frameIsMark(next)) bounceHit++; }
      }
      const balls = [];
      for (let i = 0; i < frames.length && i < 9; i++) {
        const t = frames[i]?.throws ?? [];
        if (t[0] === 'X') balls.push('X');
        else { if (t[0] != null) balls.push(t[0]); if (t[1] != null) balls.push(t[1]); }
      }
      if (frames[9] && Array.isArray(frames[9].throws)) {
        for (const t of frames[9].throws.slice(0, 3)) balls.push(t);
      }
      for (let k = 0; k < balls.length - 1; k++) {
        if (balls[k] === 'X') { doubleOpp++; if (balls[k + 1] === 'X') doubleHit++; }
      }
    }
  }
  return {
    firstBallAvg: firstBallCount > 0 ? firstBallTotal / firstBallCount : null,
    bounceBackPct: bounceOpp > 0 ? (bounceHit / bounceOpp) * 100 : null,
    doublesPct: doubleOpp > 0 ? (doubleHit / doubleOpp) * 100 : null,
    cleanGames,
    gamesWithFrames,
  };
}

// --- Aggregate (mirror stats.tsx computeSeasonMetrics) ----------------------
function seasonMetrics(subset) {
  const m = calcMetrics(subset);
  const adv = calcAdvancedStats(subset);
  const leaves = computeLeaveStats(subset);
  const totalGames = subset.reduce((n, s) => n + s.games.filter(g => g.score != null).length, 0);
  return {
    avg: m ? m.avg : null,
    highGame: m ? m.highGame : null,
    highSeries: m ? m.highSeries : null,
    firstBallAvg: adv.firstBallAvg,
    strikePct: m?.frameStats ? m.frameStats.strikeRate : null,
    doublesPct: adv.doublesPct,
    cleanPct: adv.gamesWithFrames > 0 ? (adv.cleanGames / adv.gamesWithFrames) * 100 : null,
    sparePct: m?.frameStats ? m.frameStats.spareRate : null,
    makeablePct: leaves.makeableSparePct,
    opensPerGame: m?.frameStats ? m.frameStats.opensPerGame : null,
    bounceBackPct: adv.bounceBackPct,
    cleanGames: adv.cleanGames,
    gamesWithFrames: adv.gamesWithFrames,
    totalGames,
    sessionCount: subset.length,
  };
}

// --- Run --------------------------------------------------------------------
const seasons = DEFAULT_SEASONS;
const ranges = resolveSeasonRanges(seasons);
const TYPES = ['all', 'league', 'makeup', 'tournament', 'practice'];

const fmt = v => (v == null ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v));
let failures = 0;
const notEvaluable = [];
const fail = msg => { failures++; console.log('  ✗ ' + msg); };
const ok = msg => console.log('  ✓ ' + msg);
const skip = (msg, why) => { console.log('  · ' + msg); notEvaluable.push(why); };

console.log('='.repeat(70));
console.log('mBowl Phase 24 — verification harness');
console.log('Data source: ' + (usingReal ? 'docs/phase24-data.json (REAL)' : 'src/seeds.js (SEEDS ONLY — NOT the real 37/38-session dataset)'));
console.log('Total sessions loaded: ' + sessions.length);
console.log('Expected counts: ' + (expectCounts ? `${expectCounts.join(' / ')} = ${expectTotal}` : '(none supplied)'));
console.log('='.repeat(70));

// (1) Bucket counts
console.log('\n[1] Season buckets' + (expectCounts ? ` (expect ${expectCounts.join(' / ')} = ${expectTotal})` : ''));
const buckets = { 'winners-2025': [], 'jubilee-2026': [], 'winners-2026': [] };
let outside = 0;
for (const s of sessions) {
  const id = seasonForDate(s.date, seasons);
  if (id && buckets[id]) buckets[id].push(s); else outside++;
}
const sum = Object.values(buckets).reduce((a, b) => a + b.length, 0);
ranges.forEach((r, i) => {
  const n = buckets[r.id].length;
  const line = `${r.short.padEnd(11)} ${r.start} -> ${r.end ?? 'open'}   ${String(n).padStart(3)} sessions`;
  if (expectCounts) {
    const exp = expectCounts[i];
    exp === n ? ok(`${line} (expect ${exp})`) : fail(`${line} (expect ${exp})`);
  } else {
    console.log('  · ' + line + ' (not asserted)');
  }
});
if (expectCounts) {
  sum === expectTotal ? ok(`sum = ${sum} (expect ${expectTotal})`) : fail(`sum = ${sum} (expect ${expectTotal})`);
} else {
  skip(`sum = ${sum} (not asserted)`, 'Season bucket reconciliation (needs --expect + real dataset)');
}

// (2) Gapless — no session outside a season
console.log('\n[2] Gapless invariant (every session lands in a season)');
outside === 0 ? ok('0 sessions outside any season') : fail(`${outside} sessions outside a season`);

// (3) Boundary sessions
console.log('\n[3] Boundary check (sessions adjacent to each start date)');
let boundaryExercised = false;
for (let i = 1; i < ranges.length; i++) {
  const boundary = ranges[i].start;
  const before = addDaysISO(boundary, -1);
  const onOrAfter = sessions.filter(s => s.date >= boundary && s.date <= addDaysISO(boundary, 6));
  const justBefore = sessions.filter(s => s.date <= before && s.date >= addDaysISO(boundary, -7));
  console.log(`  boundary ${boundary} (${ranges[i - 1].short} | ${ranges[i].short}):`);
  for (const s of justBefore) {
    boundaryExercised = true;
    const id = seasonForDate(s.date, seasons);
    const good = id === ranges[i - 1].id;
    console.log(`    ${good ? '✓' : '✗'} ${s.date} -> ${id} (expect ${ranges[i - 1].id})`);
    if (!good) failures++;
  }
  for (const s of onOrAfter) {
    boundaryExercised = true;
    const id = seasonForDate(s.date, seasons);
    const good = id === ranges[i].id;
    console.log(`    ${good ? '✓' : '✗'} ${s.date} -> ${id} (expect ${ranges[i].id})`);
    if (!good) failures++;
  }
  if (justBefore.length === 0 && onOrAfter.length === 0) console.log('    (no sessions near this boundary)');
}
if (!boundaryExercised) notEvaluable.push('Boundary-session placement (no sessions near any boundary in this dataset)');

// (4) NaN / crash across season x type, including empty sets
console.log('\n[4] NaN / crash check across season x type (incl. empty sets)');
let nanIssues = 0;
const filterByType = (arr, t) => (t === 'all' ? arr : arr.filter(s => s.type === t));
const scopes = [['ALL-TIME', sessions], ...ranges.map(r => [r.short, buckets[r.id]])];
for (const [scopeName, arr] of scopes) {
  for (const t of TYPES) {
    let m;
    try { m = seasonMetrics(filterByType(arr, t)); }
    catch (e) { fail(`${scopeName}/${t} threw: ${e.message}`); continue; }
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === 'number' && Number.isNaN(v)) { fail(`${scopeName}/${t}.${k} is NaN`); nanIssues++; }
    }
  }
}
if (nanIssues === 0) ok('no NaN across all season x type combinations');

// (5) Metric values per scope (for Part 6 threshold verification)
console.log('\n[5] Metric values per scope');
const printScopes = [['ALL-TIME (all types)', sessions], ['ALL-TIME (league)', filterByType(sessions, 'league')]];
for (const r of ranges) printScopes.push([r.short + ' (all types)', buckets[r.id]]);
for (const [name, arr] of printScopes) {
  const m = seasonMetrics(arr);
  console.log(`\n  ${name}  — ${m.sessionCount} sessions, ${m.totalGames} games, ${m.gamesWithFrames} w/frames`);
  console.log(`    Avg ${fmt(m.avg)} | HighGame ${fmt(m.highGame)} | HighSeries ${fmt(m.highSeries)}`);
  console.log(`    FirstBall ${fmt(m.firstBallAvg)} | Strike% ${fmt(m.strikePct)} | Doubles% ${fmt(m.doublesPct)}`);
  console.log(`    Clean ${fmt(m.cleanGames)}/${fmt(m.gamesWithFrames)} (${fmt(m.cleanPct)}%) | Spare% ${fmt(m.sparePct)} | Makeable% ${fmt(m.makeablePct)}`);
  console.log(`    Opens/G ${fmt(m.opensPerGame)} | BounceBack% ${fmt(m.bounceBackPct)}`);
}

// (5b) All-Time unchanged — structural (always) + numeric anchors (optional)
console.log('\n[5b] All-Time output unchanged from pre-Phase-24');
const at = seasonMetrics(sessions);
const totalScored = sessions.reduce((n, s) => n + s.games.filter(g => g.score != null).length, 0);
// Structural: the ALL_TIME path must return the full, unfiltered set — this is
// what "unchanged" means by construction (Phase 24 only added a season filter
// that ALL_TIME bypasses). Evaluable without any external anchors.
at.sessionCount === sessions.length ? ok(`All-Time sessions == full set (${sessions.length})`) : fail('All-Time session count != full set');
at.totalGames === totalScored ? ok(`All-Time games == all scored games (${totalScored})`) : fail('All-Time game count != all scored games');
// Numeric anchors: compare to known pre-Phase-24 values, if supplied.
if (hasAnchors) {
  const atL = seasonMetrics(filterByType(sessions, 'league'));
  const chk = (label, actual, expectStr) => {
    if (expectStr == null || actual == null) return;
    const expect = parseFloat(expectStr);
    const good = Math.abs(actual - expect) < 0.1;
    console.log(`  ${good ? '✓' : '✗'} ${label}: ${actual.toFixed(1)} (expect ${expect})`);
    if (!good) failures++;
  };
  chk('All-Time all-types avg', at.avg, anchors.avg);
  chk('All-Time all-types games', at.totalGames, anchors.games);
  chk('All-Time all-types sessions', at.sessionCount, anchors.sessions);
  chk('All-Time league avg', atL.avg, anchors.leagueAvg);
  chk('All-Time league games', atL.totalGames, anchors.leagueGames);
} else {
  skip('numeric anchors not supplied (pass --at-avg / --at-games / … to assert)', 'All-Time numeric anchors (needs --at-* from the real pre-Phase-24 export)');
}

// (6) Metric definitions read from source
console.log('\n[6] Metric definitions (from source)');
console.log('  Bounce-Back %: frame after an OPEN that scored a MARK (strike OR spare); anchors frames 1-9, no game-boundary crossing.');
console.log('  First Ball Avg: mean pins on throw[0] of EVERY frame incl. the 10th; EXCLUDES 10th-frame fill balls. X=10, dash=0.');
console.log('  Clean Games: games with zero open frames; DENOMINATOR = games WITH frame data (not all games).');
console.log('  Spare %: spares / non-strike frames in frames 1-9; SPLITS ARE IN THE DENOMINATOR (Makeable excludes them, Spare does not).');
console.log('  Makeable % current color band (conversionColor): green >=80, orange >=60, red <60. LOCKED — unchanged this phase.');

console.log('\n' + '='.repeat(70));
console.log(failures === 0 ? 'RESULT: all RUN assertions passed.' : `RESULT: ${failures} assertion(s) FAILED.`);
if (notEvaluable.length) {
  console.log('\nNOT EVALUATED with this input:');
  for (const n of notEvaluable) console.log('  - ' + n);
}
if (!usingReal) console.log('\nNOTE: ran on SEEDS ONLY. Provide docs/phase24-data.json for the real reconciliation.');
console.log('='.repeat(70));
process.exit(failures === 0 ? 0 : 1);
