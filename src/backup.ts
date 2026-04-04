import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSessions, readBalls, readSettings, readReference, KEYS } from './storage';

const BACKUP_FILENAME = 'mBowl-backup.json';

export type BackupPayload = {
  exportedAt: string;
  version: number;
  sessions: unknown;
  balls: unknown;
  settings: unknown;
  reference: unknown;
};

export async function writeBackup(): Promise<void> {
  try {
    const [sessions, balls, settings, reference] = await Promise.all([
      readSessions(),
      readBalls(),
      readSettings(),
      readReference(),
    ]);

    const payload: BackupPayload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      sessions,
      balls,
      settings,
      reference,
    };

    const file = new File(Paths.document, BACKUP_FILENAME);
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

    let payload: BackupPayload;
    try {
      payload = JSON.parse(json) as BackupPayload;
    } catch {
      return { success: false, error: 'Backup file is corrupted or invalid JSON.' };
    }

    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Backup file is corrupted.' };
    }
    if (!('sessions' in payload) || !('balls' in payload) || !('settings' in payload) || !('reference' in payload)) {
      return { success: false, error: 'Backup file is missing required data.' };
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
