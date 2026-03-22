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

// Step 5: schema validation helper — exported so _layout.tsx can use it for backup restore
export function isValidSessionArray(data: unknown): data is Session[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data[0] != null &&
    typeof data[0].id !== 'undefined' &&
    Array.isArray(data[0].games)
  );
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

// Step 5 + 6: validate on read, return [] on null/invalid
export async function readSessions(): Promise<Session[]> {
  const data = await read(KEYS.SESSIONS);
  if (!isValidSessionArray(data)) {
    if (data !== null) {
      console.warn('[storage] readSessions: invalid data shape, returning []');
    }
    return [];
  }
  return data;
}

// Step 3: write to both primary and backup on every save
export async function writeSessions(data: Session[]): Promise<void> {
  await write(KEYS.SESSIONS, data);
  await write(KEYS.SESSIONS_BACKUP, data);
}

// Step 6: safe default []
export async function readBalls(): Promise<Ball[]> {
  const data = await read(KEYS.BALLS);
  return Array.isArray(data) ? (data as Ball[]) : [];
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
