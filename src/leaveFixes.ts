// ---------------------------------------------------------------------------
// Leave -> fix (Phase 30A)
//
// Links the leaves Marcus actually leaves (computeLeaveStats, pin data) to the
// Pocket Diagnostics cards in Reference. CARD_LEAVE_KEYS is the single source
// of truth for which card covers which leaveUtils leave name -- the Pocket
// Diagnostics "My Data" view and the Stats "Leave -> fix" card both use it.
// Read-time only; the cards come from mbowl_reference_v1 (editable text) with
// DEFAULT_DIAGNOSTICS as the fallback, nothing is written.
// ---------------------------------------------------------------------------

/** Pocket Diagnostics card name -> the leaveUtils leave name(s) it covers. */
export const CARD_LEAVE_KEYS: Record<string, string[]> = {
  'Ringing 10 pin': ['10 Pin'],
  'Solid 8 pin': ['8 Pin'],
  'Ringing 7 pin': ['7 Pin'],
  'Big 4 (4-6-7-10)': ['Big 4'],
  '6-7-10': ['6-7-10'],
  Washout: [],
  'Corner pin (7 or 10)': ['7 Pin', '10 Pin'],
  '2-8-10 bucket': ['2-8-10 Bucket'],
  '2-4-5-8 bucket': ['2-4-5-8 Bucket'],
  '4-6 split': ['4-6 Split'],
  '5-7 split': ['5-7 Split'],
  'Baby split (2-7 or 3-10)': ['Baby Split (2-7)', 'Baby Split (3-10)'],
  '4-7-9 cluster': ['4-7-9 Cluster'],
  'Sleeper pocket (2-8 or 3-9)': ['Sleeper (2-8)', 'Sleeper (3-9)'],
};

export interface FixCard {
  name: string;
  fix: string;
}

export interface LeaveCount {
  name: string;
  count: number;
  converted: number;
}

export interface LeaveFix {
  leave: string;
  count: number;
  converted: number;
  /** Share of all first-ball leaves in the data, 0-100. */
  sharePct: number;
  card: string;
  fix: string;
}

/**
 * The card that covers a leave. When more than one does (the 10 pin is both
 * "Ringing 10 pin" and "Corner pin (7 or 10)"), the most specific card -- the
 * one covering the fewest leaves -- wins.
 */
export function cardForLeave(leave: string, cards: FixCard[]): FixCard | null {
  let best: FixCard | null = null;
  let bestSize = Infinity;
  for (const card of cards) {
    const keys = CARD_LEAVE_KEYS[card.name];
    if (!keys || !keys.includes(leave)) continue;
    if (keys.length < bestSize) {
      best = card;
      bestSize = keys.length;
    }
  }
  return best;
}

/** Valid cards out of a stored reference blob, else the given defaults. */
export function cardsFromReference(reference: unknown, defaults: FixCard[]): FixCard[] {
  const pd = (reference as { pocketDiagnostics?: { cards?: unknown } } | null)?.pocketDiagnostics;
  const raw = pd && Array.isArray(pd.cards) ? pd.cards : null;
  if (!raw) return defaults;
  const cards = raw.filter(
    (c): c is FixCard =>
      !!c && typeof (c as FixCard).name === 'string' && typeof (c as FixCard).fix === 'string',
  );
  return cards.length > 0 ? cards : defaults;
}

/**
 * The most common leaves that a Pocket Diagnostics card covers, with that
 * card's fix. `leaves` is computeLeaveStats().leaves (all first-ball leaves,
 * any order); leaves no card covers are skipped (they still count toward the
 * share's denominator).
 */
export function topLeaveFixes(leaves: LeaveCount[], cards: FixCard[], n = 3): LeaveFix[] {
  const total = leaves.reduce((sum, l) => sum + l.count, 0);
  if (total === 0) return [];
  const out: LeaveFix[] = [];
  for (const l of [...leaves].sort((a, b) => b.count - a.count)) {
    const card = cardForLeave(l.name, cards);
    if (!card || !card.fix.trim()) continue;
    out.push({
      leave: l.name,
      count: l.count,
      converted: l.converted,
      sharePct: (l.count / total) * 100,
      card: card.name,
      fix: card.fix.trim(),
    });
    if (out.length >= n) break;
  }
  return out;
}
