import { File, Paths } from 'expo-file-system';
import { readSessions, readBalls, readSettings, readReference } from './storage';

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
