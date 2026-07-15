import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readSessionsResult,
  readBalls,
  readSettings,
  readReference,
  isValidSessionArray,
  isBallArray,
  isPlainObject,
  KEYS,
} from './storage';

const BACKUP_FILENAME = 'mBowl-backup.json';

export type BackupPayload = {
  exportedAt: string;
  version: number;
  sessions: unknown;
  balls: unknown;
  settings: unknown;
  reference: unknown;
};

/**
 * How many sessions the backup file on disk currently holds.
 * 0 when there is no file, it is unreadable, or it holds no sessions — i.e.
 * when there is nothing worth protecting from an overwrite.
 */
async function existingBackupSessionCount(file: File): Promise<number> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isPlainObject(parsed) || !Array.isArray(parsed.sessions)) return 0;
    return parsed.sessions.length;
  } catch {
    return 0;
  }
}

export async function writeBackup(): Promise<void> {
  try {
    const [sessionsRead, balls, settings, reference] = await Promise.all([
      readSessionsResult(),
      readBalls(),
      readSettings(),
      readReference(),
    ]);

    // S9: writeBackup runs on every cold launch and every write. A read that
    // failed or came back corrupt must never be allowed to reach the file —
    // this is the last-resort copy, and degrading it to sessions:[] is exactly
    // the failure it exists to protect against.
    if (sessionsRead.status === 'error' || sessionsRead.status === 'invalid') {
      console.warn('[backup] skipped — sessions read returned', sessionsRead.status);
      return;
    }

    const file = new File(Paths.document, BACKUP_FILENAME);

    // Read says zero sessions and is trustworthy ('ok'/'missing'), but a
    // populated backup already exists. Keep the populated one: a stale backup
    // beats an empty one, and the only cost is that a deliberate delete-all
    // doesn't propagate to the file.
    if (sessionsRead.value.length === 0 && (await existingBackupSessionCount(file)) > 0) {
      console.warn('[backup] skipped — refusing to overwrite a populated backup with zero sessions');
      return;
    }

    const payload: BackupPayload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      sessions: sessionsRead.value,
      balls,
      settings,
      reference,
    };

    file.write(JSON.stringify(payload, null, 2));

    console.log('[backup] written to', file.uri);
  } catch (e) {
    console.error('[backup] writeBackup failed', e);
  }
}

export async function restoreBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    const file = new File(Paths.document, BACKUP_FILENAME);
    let json: string;
    try {
      json = await file.text();
    } catch {
      return { success: false, error: 'No backup file found.' };
    }

    // Deliberately `unknown`: nothing off disk is a BackupPayload until the
    // shape checks below say so.
    let payload: unknown;
    try {
      payload = JSON.parse(json);
    } catch {
      return { success: false, error: 'Backup file is corrupted or invalid JSON.' };
    }

    if (!isPlainObject(payload)) {
      return { success: false, error: 'Backup file is corrupted.' };
    }

    // S10: key presence proved nothing — `{ sessions: null }` passed and wrote
    // "null" over live data. Restore is destructive and settings/reference have
    // no shadow key to recover from, so every value is shape-checked here,
    // before the multiSet below touches anything.
    if (!isValidSessionArray(payload.sessions)) {
      return { success: false, error: 'Backup file has no readable sessions — restore cancelled to protect your current data.' };
    }
    if (!isBallArray(payload.balls)) {
      return { success: false, error: 'Backup file has an invalid ball roster — restore cancelled.' };
    }
    if (!isPlainObject(payload.settings)) {
      return { success: false, error: 'Backup file has invalid settings — restore cancelled.' };
    }
    if (!isPlainObject(payload.reference)) {
      return { success: false, error: 'Backup file has invalid reference data — restore cancelled.' };
    }

    // Atomic: write all 4 keys or none
    await AsyncStorage.multiSet([
      [KEYS.SESSIONS, JSON.stringify(payload.sessions)],
      [KEYS.BALLS, JSON.stringify(payload.balls)],
      [KEYS.SETTINGS, JSON.stringify(payload.settings)],
      [KEYS.REFERENCE, JSON.stringify(payload.reference)],
    ]);

    return { success: true };
  } catch (e) {
    console.error('[backup] restoreBackup failed', e);
    return { success: false, error: 'An unexpected error occurred during restore.' };
  }
}
