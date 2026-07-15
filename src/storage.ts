import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, Ball, Settings, DraftData } from './types';

export const KEYS: Record<string, string> = {
  SESSIONS:        'mbowl_sessions_v1',
  SESSIONS_BACKUP: 'mbowl_sessions_backup_v1',
  BALLS:           'mbowl_balls_v1',
  BALLS_BACKUP:    'mbowl_balls_backup_v1',
  REFERENCE:       'mbowl_reference_v1',
  SETTINGS:        'mbowl_settings_v1',
  DRAFT:           'mbowl_draft_v1',
  SEEDED_FLAG:     'mbowl_seeded_v1',
};

// ---------------------------------------------------------------------------
// Read states (S9–S12 root cause)
//
// A bare `[]` cannot tell a caller whether the store is genuinely empty, was
// never written, holds corrupt data, or simply failed to read. Callers that
// seed / back up / overwrite need that distinction, so reads report it:
//
//   'missing' — key has never been written. Only this state may be seeded.
//   'ok'      — parsed and fully validated. `value` is trustworthy, [] included
//               (a genuinely emptied store).
//   'invalid' — key exists but is unparseable or fails validation. Real data may
//               be underneath: never overwrite on the strength of this.
//   'error'   — the storage layer itself threw. Says nothing about the contents.
// ---------------------------------------------------------------------------
export type ReadStatus = 'ok' | 'missing' | 'invalid' | 'error';
export type ReadResult<T> = { status: ReadStatus; value: T };

function isSessionLike(v: unknown): v is Session {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as Partial<Session>;
  if (typeof s.id === 'undefined' || s.id === null) return false;
  if (!Array.isArray(s.games)) return false;
  // computeLeaveStats walks `game.frames` — a null game element throws there.
  return s.games.every(g => g !== null && typeof g === 'object' && !Array.isArray(g));
}

/**
 * S12: every element is validated, not just [0]. A partially-corrupt array
 * such as [valid, null] used to pass here and then blow up in computeLeaveStats.
 * True for [] — an empty array is a well-formed session array.
 */
export function isSessionArray(data: unknown): data is Session[] {
  return Array.isArray(data) && data.every(isSessionLike);
}

/** Valid AND non-empty — the bar for "worth restoring over what's live". */
export function isValidSessionArray(data: unknown): data is Session[] {
  return isSessionArray(data) && data.length > 0;
}

function isBallLike(v: unknown): v is Ball {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  return typeof (v as Partial<Ball>).id !== 'undefined';
}

export function isBallArray(data: unknown): data is Ball[] {
  return Array.isArray(data) && data.every(isBallLike);
}

/** A plain object — not null, not an array. */
export function isPlainObject(data: unknown): data is Record<string, unknown> {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}

type RawRead = { status: 'ok'; raw: string } | { status: 'missing' } | { status: 'error' };

/** Separates "key absent" from "storage threw" — `read()` below collapses both. */
async function readRaw(key: string): Promise<RawRead> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? { status: 'missing' } : { status: 'ok', raw };
  } catch (e) {
    console.error('[storage] read failed for key:', key, e);
    return { status: 'error' };
  }
}

async function readValidated<T>(
  key: string,
  isValid: (d: unknown) => d is T,
  fallback: T,
): Promise<ReadResult<T>> {
  const rawRead = await readRaw(key);
  if (rawRead.status === 'missing') return { status: 'missing', value: fallback };
  if (rawRead.status === 'error') return { status: 'error', value: fallback };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawRead.raw);
  } catch (e) {
    console.warn('[storage] invalid JSON for key:', key, e);
    return { status: 'invalid', value: fallback };
  }
  if (!isValid(parsed)) {
    console.warn('[storage] invalid data shape for key:', key);
    return { status: 'invalid', value: fallback };
  }
  return { status: 'ok', value: parsed };
}

async function read(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[storage] read failed for key:', key, e);
    return null;
  }
}

// Step 8: write never throws — log and move on
async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[storage] write failed for key:', key, e);
  }
}

/**
 * Full read state. Use this anywhere a `[]` would be acted on — seeding,
 * backing up, restoring, overwriting. See ReadStatus above.
 */
export async function readSessionsResult(): Promise<ReadResult<Session[]>> {
  return readValidated(KEYS.SESSIONS, isSessionArray, [] as Session[]);
}

// Step 5 + 6: validate on read, return [] on missing/invalid/error.
// Display-only callers keep this shape; anything that WRITES based on the
// result must use readSessionsResult() instead.
export async function readSessions(): Promise<Session[]> {
  return (await readSessionsResult()).value;
}

// Step 3: write to both primary and backup on every save
export async function writeSessions(data: Session[]): Promise<void> {
  await write(KEYS.SESSIONS, data);
  await write(KEYS.SESSIONS_BACKUP, data);
}

export async function readBallsResult(): Promise<ReadResult<Ball[]>> {
  return readValidated(KEYS.BALLS, isBallArray, [] as Ball[]);
}

// Step 6: safe default []
export async function readBalls(): Promise<Ball[]> {
  return (await readBallsResult()).value;
}

// Step 4: write to both primary and backup on every save
export async function writeBalls(data: Ball[]): Promise<void> {
  await write(KEYS.BALLS, data);
  await write(KEYS.BALLS_BACKUP, data);
}

// Step 6: safe default {}
export async function readReference(): Promise<Record<string, unknown>> {
  const data = await read(KEYS.REFERENCE);
  return data != null ? (data as Record<string, unknown>) : {};
}

export async function writeReference(data: Record<string, unknown>): Promise<void> {
  return write(KEYS.REFERENCE, data);
}

// Step 6: safe default { seasonStart: null, seasonEnd: null }
export async function readSettings(): Promise<Settings> {
  const data = await read(KEYS.SETTINGS);
  return data != null ? (data as Settings) : { seasonStart: null, seasonEnd: null };
}

export async function writeSettings(data: Settings): Promise<void> {
  return write(KEYS.SETTINGS, data);
}

// Step 7: validate draft before returning — discard if corrupt
export async function readDraft(): Promise<DraftData | null> {
  const data = await read(KEYS.DRAFT);
  if (data === null) return null;
  if (
    typeof data !== 'object' ||
    Array.isArray(data) ||
    typeof (data as Record<string, unknown>).sessionType === 'undefined'
  ) {
    console.warn('[storage] readDraft: invalid draft discarded');
    await writeDraft(null);
    return null;
  }
  return data as DraftData;
}

// Step 8: removeItem path wrapped in try/catch, write path covered by write()
export async function writeDraft(data: DraftData | null): Promise<void> {
  if (data === null) {
    try {
      await AsyncStorage.removeItem(KEYS.DRAFT);
    } catch (e) {
      console.error('[storage] write failed for key:', KEYS.DRAFT, e);
    }
  } else {
    return write(KEYS.DRAFT, data);
  }
}
