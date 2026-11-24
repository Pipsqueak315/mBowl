// ---------------------------------------------------------------------------
// Reference content, v2 (Phase 30B, Nov 24)
//
// Rewritten after a content check against coaching sources (bowlingball.com
// BowlVersity, Bowling This Month, National Bowling Academy, Storm):
//  - RIGHT-HANDED directions. The v1 text had several moves mirrored (move
//    right when the ball hooks early, etc.). Rule used everywhere: miss left
//    (high / hooks early) -> move left; miss right (light / skids) -> move
//    right; feet 2 boards, eyes 1 ("2 and 1").
//  - No ball names (Marcus, Nov 11: "let me decide which ball on the fly") --
//    "weaker / stronger / smoother ball" instead.
//  - Short. One line per field.
// The v1 text lives in src/referenceUpgrade.ts so an unedited copy on the
// phone can be upgraded; anything Marcus edited is never touched.
// ---------------------------------------------------------------------------

export interface SwitchGuideRowV2 {
  whatYoureSeeing: string;
  cause: string;
  switchTo: string; // hidden since Nov 15; kept so the shape round-trips
  feet: string;
  direction: string;
}

export interface LaneReadV2 {
  whatYoureSeeing: string;
  whatItMeans: string;
  recommendation: string;
}

export type FrequencyTierV2 = 'High Frequency' | 'Common' | 'Situational';

export interface DiagnosticCardV2 {
  name: string; // must stay the same as v1 -- CARD_LEAVE_KEYS + the upgrade key on it
  frequency: FrequencyTierV2;
  why: string;
  fix: string;
  pattern: string;
}

const WATCH_THE_HIT = 'Watch the hit: high → left 1; light → right 1.';
const WATCH_THE_BALL = 'Watch the ball: skidded → right 1–2; died early → left 1–2.';

export const SWITCH_GUIDE_V2: SwitchGuideRowV2[] = [
  {
    whatYoureSeeing: 'Hooking early or rolling out',
    cause: 'Lane is drying. Too much friction for this ball.',
    switchTo: '',
    feet: 'Left 2, eyes left 1. Still early after that → weaker ball.',
    direction: '🟢 Down',
  },
  {
    whatYoureSeeing: 'Skidding through, coming in light',
    cause: 'Too much oil for this ball.',
    switchTo: '',
    feet: 'Right 2, eyes right 1. Still skidding → stronger ball.',
    direction: '🔴 Up',
  },
  {
    whatYoureSeeing: 'Game 3, losing the pocket',
    cause: 'Lanes breaking down. The track is drying.',
    switchTo: '',
    feet: 'Left 2–3, eyes left 1. Have your next ball ready.',
    direction: '🟢 Down',
  },
  {
    whatYoureSeeing: 'Good shape, leaving a corner pin',
    cause: 'Carry, not ball choice.',
    switchTo: '',
    feet: `Only if it repeats. ${WATCH_THE_HIT}`,
    direction: '🟡 Feet only',
  },
  {
    whatYoureSeeing: 'Just switched balls',
    cause: 'New ball, new read.',
    switchTo: '',
    feet: 'Same feet and eyes for the first shot. Then adjust 2 and 1 from what it does.',
    direction: '🟡 Read first',
  },
  {
    whatYoureSeeing: 'Fresh pair, unfamiliar lanes',
    cause: 'Unknown. Read before you move.',
    switchTo: '',
    feet: 'Baseline: board 20, eyes 12. Two shots before any move.',
    direction: '🟡 Read first',
  },
  {
    whatYoureSeeing: 'Long or heavy oil (tournament)',
    cause: 'The ball needs to read the oil, not skid through it.',
    switchTo: '',
    feet: 'Play straighter, with less angle.',
    direction: '🔴 Up',
  },
];

export const LANE_READS_V2: LaneReadV2[] = [
  {
    whatYoureSeeing: 'Clean through the front, strong move at the break',
    whatItMeans: 'Clear oil line. The best condition.',
    recommendation: 'Stay put and hit your mark.',
  },
  {
    whatYoureSeeing: 'Reads early, rolls flat or dies before the pins',
    whatItMeans: 'Ball finds friction too soon (dry or burned track).',
    recommendation: 'Left 2, eyes left 1, or a weaker ball.',
  },
  {
    whatYoureSeeing: 'Skids through, no move at the break',
    whatItMeans: 'Too much oil for this ball.',
    recommendation: 'Right 2, eyes right 1, or a stronger ball.',
  },
  {
    whatYoureSeeing: 'Different reaction every shot',
    whatItMeans: 'Uneven oil, or your release.',
    recommendation: "Check the miss first. A yank or extra speed is you, not the lane. Don't chase it.",
  },
  {
    whatYoureSeeing: 'Smooth arc, no defined move',
    whatItMeans: 'Blended, medium oil.',
    recommendation: 'Hold your line. Consistency over angle.',
  },
  {
    whatYoureSeeing: 'Reaction changing through the set',
    whatItMeans: 'Oil breaking down.',
    recommendation: 'Expect to move left. Have your next ball ready.',
  },
];

export const DIAGNOSTICS_V2: DiagnosticCardV2[] = [
  {
    name: 'Ringing 10 pin',
    frequency: 'High Frequency',
    why: 'The 6 wraps around the 10. A light hit or too much angle.',
    fix: 'Light → right 1 board. Too much angle → smoother ball.',
    pattern: 'One is a good shot. 3+ in a set → adjust.',
  },
  {
    name: 'Solid 8 pin',
    frequency: 'Common',
    why: 'Good pocket hit, bad break.',
    fix: "Don't adjust for one. Make the spare.",
    pattern: 'Repeats → small change only (1 board or a smoother ball).',
  },
  {
    name: 'Ringing 7 pin',
    frequency: 'Common',
    why: 'Slightly off pocket hit. The 4 missed the 7.',
    fix: WATCH_THE_HIT,
    pattern: 'One is a tap. Repeats mean your hit is drifting.',
  },
  {
    name: 'Big 4 (4-6-7-10)',
    frequency: 'Situational',
    why: 'High, flush hit on the headpin.',
    fix: 'Left 2, eyes left 1, or a weaker ball.',
    pattern: 'Twice in a night → the lane changed. Make the move.',
  },
  {
    name: '6-7-10',
    frequency: 'Situational',
    why: 'Off-pocket hit.',
    fix: 'Watch the hit: high → left 1–2; light → right 1–2.',
    pattern: 'Rare. Twice in a night → move.',
  },
  {
    name: 'Washout',
    frequency: 'Situational',
    why: 'Missed the headpin. Came in light.',
    fix: 'Hit your mark? Right 1–2. Missed it? No move, fix the shot.',
    pattern: 'Repeats → check your target, not the lane.',
  },
  {
    name: 'Corner pin (7 or 10)',
    frequency: 'High Frequency',
    why: "Good shot that didn't carry.",
    fix: `Don't chase one. If it repeats: ${WATCH_THE_HIT.replace('Watch the hit: ', '')}`,
    pattern: 'Same corner 3+ times in a set → move 1 board.',
  },
  {
    name: '2-8-10 bucket',
    frequency: 'Situational',
    why: 'Came in light: skidded past the break, or died early.',
    fix: WATCH_THE_BALL,
    pattern: 'Repeats → your read on the lane is off.',
  },
  {
    name: '2-4-5-8 bucket',
    frequency: 'Common',
    why: 'The ball rolled out and died early, so it came in weak.',
    fix: 'Left 2, eyes left 1, or a weaker ball.',
    pattern: 'Repeats → the lane is drying. Move before it gets worse.',
  },
  {
    name: '4-6 split',
    frequency: 'Situational',
    why: 'High, flush hit.',
    fix: 'Left 1–2 boards.',
    pattern: "Repeats → move, don't wait.",
  },
  {
    name: '5-7 split',
    frequency: 'Common',
    why: 'Came in light: skidded past the break, or died early.',
    fix: WATCH_THE_BALL,
    pattern: 'Repeats → your target is drifting.',
  },
  {
    name: 'Baby split (2-7 or 3-10)',
    frequency: 'Common',
    why: 'Thin hit, slightly off the pocket.',
    fix: WATCH_THE_HIT,
    pattern: 'Same split twice → same miss twice.',
  },
  {
    name: '4-7-9 cluster',
    frequency: 'Situational',
    why: 'Off-pocket hit.',
    fix: WATCH_THE_HIT,
    pattern: 'Repeats → watch where you hit, not the pins.',
  },
  {
    name: 'Sleeper pocket (2-8 or 3-9)',
    frequency: 'Situational',
    why: 'Pocket hit. The back pin hid behind the front one.',
    fix: "Don't move for one.",
    pattern: 'Late in game 3 → the ball is losing energy. Time to switch.',
  },
];

/** "Your numbers" Marcus has stated (memory, Nov 2026). Filled only where blank. */
export const YOUR_NUMBERS_KNOWN = {
  pap: '7 over / 1-9/16 up',
  dominantMiss: 'Left (yank)',
} as const;
