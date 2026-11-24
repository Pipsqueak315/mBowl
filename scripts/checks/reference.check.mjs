// Phase 30B checks against the REAL src/referenceUpgrade.ts + src/referenceContent.ts.
import {
  upgradeReference,
  REFERENCE_VERSION,
  SWITCH_GUIDE_V1,
  LANE_READS_V1,
  DIAGNOSTICS_V1,
} from '../../src/referenceUpgrade.ts';
import {
  SWITCH_GUIDE_V2,
  LANE_READS_V2,
  DIAGNOSTICS_V2,
  YOUR_NUMBERS_KNOWN,
} from '../../src/referenceContent.ts';
import { CARD_LEAVE_KEYS } from '../../src/leaveFixes.ts';
import { check, eq, done } from './lib.mjs';

const clone = v => JSON.parse(JSON.stringify(v));
const v1Blob = () => ({
  position: [{ scenario: 'Default Stance', feet: 'Board 20', eyes: 'Board 12', notes: 'x' }],
  mentalCues: [{ label: 'a', body: 'b' }],
  yourNumbers: { ballSpeed: '', revRate: '', axisTilt: '', axisRotation: '', pap: '', dominantMiss: '', layDownBoard: '' },
  speedNotes: 'my notes',
  releaseNotes: '',
  pressureTendencies: '',
  signals: { switchGuide: clone(SWITCH_GUIDE_V1), arsenal: [{ name: 'Spare Ball', strength: 1, motionProfile: 'm', whenToUse: 'w' }], laneReads: clone(LANE_READS_V1) },
  pocketDiagnostics: { cards: clone(DIAGNOSTICS_V1) },
  patterns: { keep: true },
});

// --- v2 content sanity ---------------------------------------------------
const BALLS = /Phaze|Physix|Blackout|Summit|Pearl|Crux|Primal|\bSolid\b|Idol/;
const visible = [
  ...SWITCH_GUIDE_V2.flatMap(r => [r.whatYoureSeeing, r.cause, r.feet, r.direction]),
  ...LANE_READS_V2.flatMap(r => [r.whatYoureSeeing, r.whatItMeans, r.recommendation]),
  ...DIAGNOSTICS_V2.flatMap(c => [c.why, c.fix, c.pattern]),
];
check(visible.every(t => !BALLS.test(t)), 'v2: no ball names in visible text', visible.find(t => BALLS.test(t)));
eq(DIAGNOSTICS_V2.map(c => c.name).sort(), DIAGNOSTICS_V1.map(c => c.name).sort(), 'v2: same 14 card names as v1');
check(Object.keys(CARD_LEAVE_KEYS).every(n => DIAGNOSTICS_V2.some(c => c.name === n)), 'v2: every mapped card exists');
// Right-handed rule: hooking early / dry → LEFT; skidding / too much oil → RIGHT.
for (const r of SWITCH_GUIDE_V2) {
  if (/early|rolling out|Game 3/i.test(r.whatYoureSeeing)) check(/^Left/.test(r.feet), `v2 switch: "${r.whatYoureSeeing}" moves left`);
  if (/skid/i.test(r.whatYoureSeeing)) check(/^Right/.test(r.feet), `v2 switch: "${r.whatYoureSeeing}" moves right`);
}
for (const r of LANE_READS_V2) {
  if (/early/i.test(r.whatYoureSeeing)) check(/^Left/.test(r.recommendation), `v2 lane: "${r.whatYoureSeeing}" moves left`);
  if (/skid/i.test(r.whatYoureSeeing)) check(/^Right/.test(r.recommendation), `v2 lane: "${r.whatYoureSeeing}" moves right`);
}
check(SWITCH_GUIDE_V2.every(r => /^(🟢|🔴|🟡)/.test(r.direction)), 'v2: every direction starts with a color dot');

// --- untouched v1 copy -> full v2 --------------------------------------
{
  const up = upgradeReference(v1Blob());
  check(up.changed, 'upgrade: v1 copy changes');
  eq(up.value.referenceVersion, REFERENCE_VERSION, 'upgrade: version stamped');
  eq(up.value.signals.switchGuide, SWITCH_GUIDE_V2, 'upgrade: untouched switch guide → v2');
  eq(up.value.signals.laneReads, LANE_READS_V2, 'upgrade: untouched lane reads → v2');
  eq(up.value.pocketDiagnostics.cards, DIAGNOSTICS_V2, 'upgrade: untouched cards → v2');
  eq(up.value.yourNumbers.pap, YOUR_NUMBERS_KNOWN.pap, 'upgrade: blank PAP filled');
  eq(up.value.speedNotes, 'my notes', 'upgrade: notes untouched');
  eq(up.value.signals.arsenal.length, 1, 'upgrade: hidden arsenal untouched');
  eq(up.value.patterns, { keep: true }, 'upgrade: hidden patterns untouched');
  eq(up.value.position.length, 1, 'upgrade: hidden position untouched');
  eq(upgradeReference(up.value).changed, false, 'upgrade: runs once (idempotent)');
}

// --- edited rows are kept ------------------------------------------------
{
  const b = v1Blob();
  b.signals.switchGuide[1] = { ...b.signals.switchGuide[1], feet: 'MY OWN NOTE' };
  b.pocketDiagnostics.cards[0] = { ...b.pocketDiagnostics.cards[0], fix: 'my fix' };
  b.yourNumbers.pap = '6 over';
  const up = upgradeReference(b);
  const sg = up.value.signals.switchGuide;
  check(sg.some(r => r.feet === 'MY OWN NOTE'), 'edited: Marcus\'s row kept');
  eq(sg.filter(r => r.whatYoureSeeing === SWITCH_GUIDE_V2[0].whatYoureSeeing).length, 1, 'edited: two v1 rows merged into one v2 row appear once');
  check(!sg.some(r => /VE Blackout|Physix #1 too arcy|ringing 10/i.test(r.whatYoureSeeing)), 'edited: unedited dropped rows gone');
  check(sg.some(r => r.whatYoureSeeing === 'Just switched balls'), 'edited: brand-new v2 row added');
  check(!sg.some(r => r.whatYoureSeeing === SWITCH_GUIDE_V2[1].whatYoureSeeing), 'edited: no v2 copy of the row Marcus edited');
  eq(up.value.pocketDiagnostics.cards[0].fix, 'my fix', 'edited: Marcus\'s card kept');
  eq(up.value.pocketDiagnostics.cards[1], DIAGNOSTICS_V2.find(c => c.name === DIAGNOSTICS_V1[1].name), 'edited: other cards upgraded');
  eq(up.value.yourNumbers.pap, '6 over', 'edited: a filled PAP is never replaced');
  eq(up.value.signals.laneReads, LANE_READS_V2, 'edited: an untouched list in the same blob still → v2');
}

// --- nothing stored / already v2 ---------------------------------------
eq(upgradeReference({}).changed, false, 'empty: nothing stored, nothing written');
eq(upgradeReference({ referenceVersion: 2, speedNotes: 'x' }).changed, false, 'v2: already upgraded');

done('reference');
