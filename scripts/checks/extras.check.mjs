// Phase 31 checks against the real src helpers. Hand-built data only.
import { framesParam } from '../../src/framesParam.ts';
import {
  parseSpeed, parseBoard, parseSwitchFrame, gameExtrasFromForm, gameExtrasToForm,
  normalizeDrill, drillTotals, drillShots, gamesSince, startHere, computeMissStats,
  computeSeasonRecap, sessionsToCsv, lastHouse, computeConditionStats, computeSpeedStats,
} from '../../src/extras.ts';
import { check, eq, done } from './lib.mjs';

// --- N23: frames route param survives URL decoding -------------------------
{
  const frames = [
    { throws: ['X'], note: 'a %22 b + c 100% \\%41', throwNotes: { 0: '50%+' }, pinsStanding: null },
    { throws: ['7', '/'], note: null },
  ];
  const p = framesParam(frames);
  check(!p.includes('%') && !p.includes('+'), 'no raw % or + left in the param');
  eq(JSON.stringify(JSON.parse(p)), JSON.stringify(frames), 'parses back to the same frames');
  eq(decodeURIComponent(p), p, 'one decode is a no-op');
  eq(decodeURIComponent(decodeURIComponent(p)), p, 'two decodes are a no-op');
}

// --- Phase 31B form parsing -------------------------------------------------
eq(parseSpeed('16.44'), 16.4, 'speed rounds to one decimal');
eq(parseSpeed('5'), null, 'speed below 8 mph refused');
eq(parseSpeed(''), null, 'blank speed = null');
eq(parseBoard('20'), 20, 'board 20');
eq(parseBoard('40'), null, 'board 40 refused');
eq(parseSwitchFrame('1'), null, 'switch at frame 1 refused');
eq(parseSwitchFrame('6'), 6, 'switch at frame 6');
eq(JSON.stringify(gameExtrasFromForm({ speed: '', feet: '', target: '', switchFrame: '', switchBall: 'Phaze' })), '{}',
  'blank form saves nothing (switch ball without a frame is dropped)');
eq(JSON.stringify(gameExtrasFromForm({ speed: '16.2', feet: '20', target: '12', switchFrame: '7', switchBall: ' Phaze ' })),
  JSON.stringify({ speed: 16.2, feet: 20, target: 12, switchFrame: 7, switchBall: 'Phaze' }), 'full form');
eq(JSON.stringify(gameExtrasToForm({ speed: 16.2, feet: 20 })),
  JSON.stringify({ speed: '16.2', feet: '20', target: '', switchFrame: '', switchBall: '' }), 'saved -> form');

// --- drill -------------------------------------------------------------------
eq(normalizeDrill(null), null, 'no drill');
eq(normalizeDrill({ tenPin: { made: 0, missed: 0 } }), null, 'all-zero drill = none');
{
  const d = normalizeDrill({ tenPin: { made: 3, missed: -2 }, junk: 1, multi: { made: 'x', missed: 2 } });
  eq(d.tenPin.made, 3, 'drill made kept');
  eq(d.tenPin.missed, 0, 'negative count -> 0');
  eq(d.multi.made, 0, 'bad count -> 0');
  eq(drillShots(d), 5, 'drill shots');
  const t = drillTotals([{ drill: d, games: [] }, { drill: { tenPin: { made: 1, missed: 1 } }, games: [] }, { games: [] }]);
  eq(t.tenPin.made, 4, 'drill totals add up');
}

// --- ball wear + start here ---------------------------------------------------
const g = (ball, score, extra = {}) => ({ game: 1, score, ball, frames: null, notes: null, ...extra });
const sess = (date, games, extra = {}) => ({ id: date, type: 'league', date, week: 1, opponent: null, name: null,
  format: null, pattern: null, madeCut: null, placement: null, notes: null, games, ...extra });
{
  const list = [
    sess('2026-10-01', [g('Phaze', 180), g('Phaze', 190), g('Hyroad', 170)]),
    sess('2026-10-08', [g('Phaze', 200), g('Hyroad', 160, { switchFrame: 5, switchBall: 'Phaze' }), g('Phaze', null)]),
  ];
  eq(gamesSince(list, 'Phaze', '2026-10-01'), 4, 'service day counts; switch into the ball counts; unbowled game skipped');
  eq(gamesSince(list, 'Phaze', '2026-10-02'), 2, 'only games after the date');
  const withLine = [
    sess('2026-10-01', [g('Phaze', 180, { feet: 20, target: 12 })]),
    sess('2026-10-08', [g('Phaze', 210, { feet: 22, target: 13 }), g('Phaze', 190, { feet: 23, target: 14 })]),
    sess('2026-10-15', [g('Phaze', 170)]),
  ];
  const sh = startHere(withLine, 'Phaze');
  eq(sh && [sh.feet, sh.target, sh.score].join('-'), '23-14-190', 'start here = latest game with a line');
  eq(startHere(withLine, 'Hyroad'), null, 'no line for that ball');
  eq(lastHouse([sess('2026-10-01', [], { house: 'Sea Bowl' }), sess('2026-09-01', [], { house: 'Old' })]), 'Sea Bowl', 'last house');
  eq(lastHouse([]), "Earl Anthony's", 'default house');
}

// --- miss tags ------------------------------------------------------------------
{
  const fr = (tag) => ({ throws: ['7', '/'], ...(tag ? { missTag: tag } : {}) });
  const frames = (tags) => Array.from({ length: 10 }, (_, i) => fr(tags[i]));
  const list = [
    sess('2026-10-01', [
      { game: 1, score: 150, ball: null, notes: null, frames: frames(['yank', 'yank', 'fast']) },
      { game: 2, score: 190, ball: null, notes: null, frames: frames(['target']) },
      { game: 3, score: 200, ball: null, notes: null, frames: frames([]) },
    ]),
  ];
  const m = computeMissStats(list);
  eq(m.counts.yank, 2, 'yank count');
  eq(m.taggedGames, 2, 'untagged game is not a tagged game');
  eq(m.firstBalls, 30, 'first balls');
  eq(m.avgWithYank, 150, 'avg with yank');
  eq(m.avgWithoutYank, 190, 'avg without yank (tagged games only)');
  eq(m.byGame.map((x) => x.game).join(','), '1,2', 'per game number');
}

// --- recap, conditions, speed, CSV ----------------------------------------------
{
  const list = [
    sess('2026-10-01', [g('Phaze', 180), g('Phaze', 200), g('Hyroad', 190)], { condition: 'fresh' }),
    sess('2026-10-08', [g('Phaze', 230), g('Phaze', 150), g('Phaze', 160)], { condition: 'broken' }),
    sess('2026-10-15', [g('Phaze', 120)]),
  ];
  const r = computeSeasonRecap(list);
  eq(r.highGame.score, 230, 'high game');
  eq(r.highSeries.score, 570, 'high series (3-game nights only; first of a tie kept)');
  eq(r.bestNight.date, '2026-10-01', 'best night: first of two 190-avg nights');
  eq(r.topBall.name, 'Phaze', 'most used ball');
  const c = computeConditionStats(list);
  eq(c.map((x) => x.key).join(','), 'fresh,broken,unset', 'condition rows');
  const sp = computeSpeedStats([sess('d', [g('a', 200, { speed: 17 }), g('a', 150, { speed: 15 }), g('a', 180, { speed: 16 })])]);
  eq(sp.median, 16, 'median speed');
  eq(sp.fasterAvg, 200, 'faster avg');
  const csv = sessionsToCsv([sess('2026-10-01', [g('Phaze, "Pearl"', 180, { notes: 'line\nbreak' })], { notes: 'n' })]);
  check(csv.startsWith('date,type,week'), 'csv header');
  check(csv.includes('"Phaze, ""Pearl"""'), 'csv quotes commas and quotes');
  check(csv.includes('"line\nbreak"'), 'csv quotes newlines');
}

done('extras');
