import {
  SWITCH_GUIDE_V2,
  LANE_READS_V2,
  DIAGNOSTICS_V2,
  YOUR_NUMBERS_KNOWN,
} from './referenceContent';

// ---------------------------------------------------------------------------
// Reference upgrade v1 -> v2 (Phase 30B, Nov 24)
//
// mbowl_reference_v1 holds Marcus's copy of the Reference text, and it wins
// over the app's defaults -- so new default text never reaches the phone on
// its own. This upgrades the stored copy ONCE (referenceVersion 2):
//
//  - A row / card that still matches the old v1 default EXACTLY is replaced by
//    its v2 text. Anything Marcus edited is left exactly as he wrote it.
//  - Switch Guide / Lane Reads: when the whole list is still the v1 default,
//    the list becomes the v2 list. When any row was edited, the edited rows
//    stay where they are; each unedited v1 row becomes its v2 counterpart
//    (once -- two v1 rows that merged into one v2 row appear once), unedited
//    v1 rows with no counterpart are dropped (nothing Marcus wrote is lost),
//    and v2 rows nothing mapped to are added at the end.
//  - Pocket Diagnostics: by card name (names are unchanged in v2).
//  - Your Numbers: PAP and dominant miss filled in only when blank.
//  - Everything else (hidden Position / Patterns / Ball Arsenal / switchTo,
//    mental cues, notes) is untouched.
//
// Pure: returns the upgraded value and whether anything changed. The Reference
// tab writes it (REFERENCE has no shadow key -- only after a clean read);
// Stats only uses it in memory.
// ---------------------------------------------------------------------------

export const REFERENCE_VERSION = 2;

// ---- v1 defaults, copied verbatim from the pre-Nov 24 app ----

type Row = Record<string, unknown>;

export const SWITCH_GUIDE_V1: Row[] = [
    {
      whatYoureSeeing: 'Ball rolling out before the pins',
      cause: 'Too strong for current oil',
      switchTo: 'Pearl or Phaze 5',
      feet: 'Right 1–2 first',
      direction: '🟢 Down',
    },
    {
      whatYoureSeeing: 'Ball skidding through, weak entry',
      cause: 'Too clean, not enough ball',
      switchTo: 'Solid → Summit → Physix #2',
      feet: 'Left 1–2 simultaneously',
      direction: '🔴 Up',
    },
    {
      whatYoureSeeing: 'Ball reading too early, over-hooking',
      cause: 'Burned track or dry outside',
      switchTo: 'Pearl or Phaze 5',
      feet: 'Right 1–3, eyes stay at 12',
      direction: '🟢 Down',
    },
    {
      whatYoureSeeing: 'Good shape but leaving corners (7 or 10)',
      cause: 'Entry angle — not a ball issue',
      switchTo: 'Stay',
      feet: 'Left 1 board only',
      direction: '🟡 Feet only',
    },
    {
      whatYoureSeeing: 'Leaving ringing 10 consistently',
      cause: 'Too much entry angle',
      switchTo: 'Solid or Summit',
      feet: 'Left 1 board',
      direction: '🔴 Slightly up',
    },
    {
      whatYoureSeeing: 'Leaving solid 8 consistently',
      cause: 'Entry too flush, deflection loss',
      switchTo: 'Pearl',
      feet: 'Right 1 board',
      direction: '🟢 More angle',
    },
    {
      whatYoureSeeing: 'Score dropping Game 3, losing pocket',
      cause: 'Mid-transition, ball not reading friction',
      switchTo: 'Phaze 5 → Solid → VE Blackout',
      feet: 'Left 2–3 from current',
      direction: '🔴 Up',
    },
    {
      whatYoureSeeing: 'Fresh pair, unfamiliar condition',
      cause: 'Unknown — read first',
      switchTo: 'Summit or Physix #1',
      feet: 'Board 20, eyes 12 — adjust after shot 1',
      direction: '🟡 Conservative',
    },
    {
      whatYoureSeeing: 'VE Blackout reads too early, rolling out',
      cause: 'Lanes broken down, need more length',
      switchTo: 'Primal Rage Evolution',
      feet: 'Right 1–2, let ball breathe longer',
      direction: '🟢 Down in strength, up in length',
    },
    {
      whatYoureSeeing: 'On fresh long oil pattern',
      cause: 'Need controlled early roll, not angular',
      switchTo: 'Physix #2 Pin Down',
      feet: 'Board 20, eyes 12 baseline',
      direction: '🔴 Strong but controlled',
    },
    {
      whatYoureSeeing: 'Physix #1 too arcy, not finishing',
      cause: 'Need more angle on fresh shot',
      switchTo: 'Pearl or Phaze 5',
      feet: 'Right 1–2, open angle',
      direction: '🟢 Down, more snap',
    },
  ];

export const LANE_READS_V1: Row[] = [
    {
      whatYoureSeeing: 'Ball exits clean, snaps hard at the break',
      whatItMeans: 'Sharp oil line with clear friction boundary. Ideal condition.',
      recommendation: 'Stay with current ball. This is your window. Be precise with your line.',
    },
    {
      whatYoureSeeing: 'Ball reads oil early, rolls flat to pins',
      whatItMeans: 'Short oil or flooded heads. Ball finding traction too soon.',
      recommendation: 'Move right 1–2 boards or step down to a longer, cleaner ball.',
    },
    {
      whatYoureSeeing: 'Ball skids through, no reaction at the break',
      whatItMeans: 'Very heavy oil or slick backends. Ball not finding friction.',
      recommendation:
        'Step up in ball strength. If already strong, adjust angle to find the friction zone.',
    },
    {
      whatYoureSeeing: 'Ball rolls up and loses energy before the pins',
      whatItMeans: 'Track area is burned or dry. Ball over-reading the worn spot.',
      recommendation: 'Move right 2–3 boards to fresh oil. Consider stepping down in surface.',
    },
    {
      whatYoureSeeing: 'Reaction inconsistent shot to shot',
      whatItMeans: 'Uneven oil — gaps in the pattern creating unpredictable reads.',
      recommendation:
        'Go to a benchmark ball (Summit or Physix #1) to read through the noise.',
    },
    {
      whatYoureSeeing: 'Ball arcs smoothly, no defined snap',
      whatItMeans: 'Blended medium-oil condition. No hard friction boundary.',
      recommendation:
        'Predictable but low-ceiling condition. Hold position, prioritize consistency over angle.',
    },
    {
      whatYoureSeeing: 'Reaction changing progressively through the set',
      whatItMeans: 'Oil breaking down. Pattern shifting as volume builds.',
      recommendation:
        'Expect to move left as the set goes on. Have your next ball ready before you need it.',
    },
  ];

export const DIAGNOSTICS_V1: Row[] = [
    {
      name: 'Ringing 10 pin',
      frequency: 'High Frequency',
      why: 'Entry angle too aggressive. Ball drives through the 6 and deflects past the 10.',
      fix: 'Move left 1 board or step down slightly in strength to tighten entry angle.',
      pattern:
        "If it's happening every time you strike, your angle is too sharp. It's a success diagnostic, not a miss.",
    },
    {
      name: 'Solid 8 pin',
      frequency: 'High Frequency',
      why: 'Hit too flush. Ball deflects straight back through the 5 instead of driving diagonally into the 8.',
      fix: 'Move right 1 board or use a ball with more backend to sharpen entry angle.',
      pattern:
        'Consistent solid 8s mean your entry is too flat. Check your ball path, not your spare shooting.',
    },
    {
      name: 'Ringing 7 pin',
      frequency: 'High Frequency',
      why: 'Hit too high on the headpin. 2-pin kicks the 4, but the 4 misses the 7.',
      fix: 'Move right 1–2 boards to hit the headpin slightly lighter and drive pins left.',
      pattern:
        "Pairs with ringing 10 — if you're getting both, your line is too direct. Open up slightly.",
    },
    {
      name: 'Big 4 (4-6-7-10)',
      frequency: 'High Frequency',
      why: 'High flush hit with zero angle. Ball drives straight through without spreading pins.',
      fix: 'Critical read — your ball is going straight in. Revisit your entire line.',
      pattern:
        'If this happens more than once in a session, stop adjusting feet and change the ball.',
    },
    {
      name: '6-7-10',
      frequency: 'High Frequency',
      why: 'Extreme high hit. 6-pin knocked flat across both corners.',
      fix: 'Very light hit — move right 2+ boards to hit fuller on the headpin.',
      pattern:
        "Rare. If you see it twice in a night, you're playing too straight or too far outside.",
    },
    {
      name: 'Washout',
      frequency: 'High Frequency',
      why: 'Missed the headpin. Ball went high or wide, leaving a non-pocket split with the headpin.',
      fix: 'Execution miss — headpin must be hit for a washout to become a spare.',
      pattern:
        'Recurring washouts = inconsistent release or misread on the line. Check your target.',
    },
    {
      name: 'Corner pin (7 or 10)',
      frequency: 'Common',
      why: 'Slightly light hit leaving the far corner. Common on good shots — not always a ball issue.',
      fix: 'Not necessarily a problem. If consistent, fine-tune entry angle by 1 board.',
      pattern:
        "If you're leaving the same corner 3+ times in a session, it's a pattern. Move 1 board toward that corner.",
    },
    {
      name: '2-8-10 bucket',
      frequency: 'Common',
      why: "Light hit on the headpin. 2-pin kicks back to the 8 but doesn't bridge to the 10.",
      fix: 'Move left 1–2 boards to hit fuller and drive the 2-pin harder.',
      pattern:
        "Buckets are a light-hit diagnostic. If it's recurring, you're missing your target right.",
    },
    {
      name: '2-4-5-8 bucket',
      frequency: 'Common',
      why: 'Entry angle too inside. Ball hits the 1-2 pocket with insufficient angle to scatter the cluster.',
      fix: 'Open your angle — move left, target deeper, hit the 2-pin more squarely.',
      pattern: "Repeat buckets on this side = you're playing too far inside. Open up.",
    },
    {
      name: '4-6 split',
      frequency: 'Common',
      why: 'Dead flush hit, zero entry angle. Ball goes straight through without deflecting pins outward.',
      fix: 'Carry issue — check entry angle first, then consider a sharper backend ball.',
      pattern:
        "If this shows up early in a set, your line is too direct. You need angle, not more speed.",
    },
    {
      name: '5-7 split',
      frequency: 'Common',
      why: 'Light left hit. Headpin deflects right, 5-pin goes left and misses the 7.',
      fix: 'Move right slightly to hit fuller and drive the headpin left into the 7.',
      pattern: 'Consistent 5-7s = missing left. Your target is drifting.',
    },
    {
      name: 'Baby split (2-7 or 3-10)',
      frequency: 'Common',
      why: 'Slightly light or slightly wide hit. One pin deflects the wrong direction.',
      fix: 'Adjust 1 board toward the missed side. Execution more than ball.',
      pattern:
        "If you're getting the same baby split repeatedly, your ball is missing the same direction every time.",
    },
    {
      name: '4-7-9 cluster',
      frequency: 'Common',
      why: 'Hit too far left of the pocket. Ball deflected left side pins but left a cluster.',
      fix: 'Move right to hit more toward the pocket center.',
      pattern:
        "Consistent 4-7-9 = you're pulling the ball or your feet are too far left.",
    },
    {
      name: 'Sleeper pocket (2-8 or 3-9)',
      frequency: 'Situational',
      why: "Hit the pocket but the 5-pin didn't fall. Light hit or deflection loss.",
      fix: 'Increase entry angle or step up in ball strength to drive through the 5-pin harder.',
      pattern:
        "If it shows up in Game 3, your ball is losing energy. Time to switch.",
    },
  ];

// v1 Switch Guide index -> v2 index (null = dropped in v2: ringing 10 / solid 8
// now live in Pocket Diagnostics; the two ball-name rows are gone). Used only
// when some rows were edited; an untouched list is replaced whole.
const SWITCH_GUIDE_MAP: Array<number | null> = [0, 1, 0, 3, null, null, 2, 5, null, 6, null];
// v1 Lane Reads index -> v2 index.
const LANE_READS_MAP: Array<number | null> = [0, 1, 2, 1, 3, 4, 5];

// ---- helpers ----

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Same keys as the v1 row, every value identical. */
function sameAs(row: unknown, v1: Row): boolean {
  if (!isObj(row)) return false;
  const keys = Object.keys(v1);
  if (Object.keys(row).length !== keys.length) return false;
  return keys.every(k => row[k] === v1[k]);
}

function upgradeList(
  stored: unknown,
  v1: Row[],
  v2: Row[],
  map: Array<number | null>,
): { value: unknown; changed: boolean } {
  if (!Array.isArray(stored)) return { value: stored, changed: false };
  const untouched =
    stored.length === v1.length && stored.every((row, i) => sameAs(row, v1[i]));
  if (untouched) return { value: v2.map(r => ({ ...r })), changed: true };
  let changed = false;
  const emitted = new Set<number>();
  const value: unknown[] = [];
  for (const row of stored) {
    const i = v1.findIndex(r => sameAs(row, r));
    if (i < 0) {
      value.push(row); // edited (or unknown) -- Marcus's text, kept as is
      continue;
    }
    changed = true;
    const j = map[i];
    if (j == null || emitted.has(j)) continue; // dropped in v2, or already shown
    emitted.add(j);
    value.push({ ...v2[j] });
  }
  if (changed) {
    v2.forEach((r, j) => {
      if (!emitted.has(j) && !map.includes(j)) value.push({ ...r }); // brand-new v2 rows
    });
  }
  return { value, changed };
}

export function upgradeReference(stored: Record<string, unknown>): {
  value: Record<string, unknown>;
  changed: boolean;
} {
  if (!isObj(stored) || Object.keys(stored).length === 0) return { value: stored, changed: false };
  if (typeof stored.referenceVersion === 'number' && stored.referenceVersion >= REFERENCE_VERSION) {
    return { value: stored, changed: false };
  }
  const next: Record<string, unknown> = { ...stored };

  if (isObj(stored.signals)) {
    const sig = { ...stored.signals };
    sig.switchGuide = upgradeList(sig.switchGuide, SWITCH_GUIDE_V1, SWITCH_GUIDE_V2 as unknown as Row[], SWITCH_GUIDE_MAP).value;
    sig.laneReads = upgradeList(sig.laneReads, LANE_READS_V1, LANE_READS_V2 as unknown as Row[], LANE_READS_MAP).value;
    next.signals = sig;
  }

  if (isObj(stored.pocketDiagnostics) && Array.isArray(stored.pocketDiagnostics.cards)) {
    const cards = stored.pocketDiagnostics.cards.map(card => {
      if (!isObj(card) || typeof card.name !== 'string') return card;
      const v1 = DIAGNOSTICS_V1.find(c => c.name === card.name);
      const v2 = DIAGNOSTICS_V2.find(c => c.name === card.name);
      return v1 && v2 && sameAs(card, v1) ? { ...v2 } : card;
    });
    next.pocketDiagnostics = { ...stored.pocketDiagnostics, cards };
  }

  if (isObj(stored.yourNumbers)) {
    const yn = { ...stored.yourNumbers };
    if (yn.pap === '' || yn.pap == null) yn.pap = YOUR_NUMBERS_KNOWN.pap;
    if (yn.dominantMiss === '' || yn.dominantMiss == null) yn.dominantMiss = YOUR_NUMBERS_KNOWN.dominantMiss;
    next.yourNumbers = yn;
  }

  next.referenceVersion = REFERENCE_VERSION;
  // Always "changed" below v2: at minimum the version stamp is new, so the
  // upgrade runs (and writes) once and never again.
  return { value: next, changed: true };
}
