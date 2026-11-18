import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readSessionsResult,
  readBallsResult,
  readSettingsResult,
  readReferenceResult,
  isValidSessionArray,
  isBallArray,
  isPlainObject,
  KEYS,
} from './storage';
import { notifyDataChanged } from './dataEvents';

const BACKUP_FILENAME = 'mBowl-backup.json';

// A5 (F1 + F6, Nov 15): copies of the backup file, kept in Documents/Backups
// (visible in Files -> On My iPhone -> mBowl -> Backups).
//   mBowl-kept-<stamp>.json  -- the file as it was right before an overwrite
//                               that would have dropped a session id (a delete,
//                               a seeded phone, an imported older export).
//   mBowl-daily-<day>.json   -- the file as it was before the first overwrite of
//                               each calendar day (undo for a bad edit).
// Names sort by time, so pruning keeps the newest N by name.
const BACKUPS_DIR = 'Backups';
const KEPT_PREFIX = 'mBowl-kept-';
const DAILY_PREFIX = 'mBowl-daily-';
const KEEP_KEPT = 10;
const KEEP_DAILY = 7;

export type BackupPayload = {
  exportedAt: string;
  version: number;
  sessions: unknown;
  balls: unknown;
  settings: unknown;
  reference: unknown;
};

export type BackupSummary = {
  sessions: number;
  games: number;
  exportedAt: string | null;
};

type Result = { success: boolean; error?: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dayStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeStamp(d: Date): string {
  return `${dayStamp(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function backupFile(): File {
  return new File(Paths.document, BACKUP_FILENAME);
}

function backupsDir(): Directory {
  const dir = new Directory(Paths.document, BACKUPS_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Keep the newest `keep` files whose name starts with `prefix`. Best effort.
 * `protect` names one file that is never deleted (the kept copy holding the
 * most sessions -- so a run of routine deletes can't push out the one copy
 * that mattered, e.g. the one made before a wrong import).
 */
function prune(dir: Directory, prefix: string, keep: number, protect?: string): void {
  try {
    const files = dir
      .list()
      .filter((e): e is File => e instanceof File && e.name.startsWith(prefix))
      .sort((a, b) => b.name.localeCompare(a.name));
    for (const f of files.slice(keep)) {
      if (f.name === protect) continue;
      try {
        f.delete();
      } catch (e) {
        console.warn('[backup] prune failed for', f.name, e);
      }
    }
  } catch (e) {
    console.warn('[backup] prune skipped', e);
  }
}

async function readJson(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text());
  } catch {
    return undefined;
  }
}

/**
 * How many sessions the backup file on disk currently holds.
 * 0 when there is no file, it is unreadable, or it holds no sessions — i.e.
 * when there is nothing worth protecting from an overwrite.
 */
function sessionCountOf(parsed: unknown): number {
  if (!isPlainObject(parsed) || !Array.isArray(parsed.sessions)) return 0;
  return parsed.sessions.length;
}

/** Name of the kept copy with the most sessions (protected from pruning). */
async function largestKept(dir: Directory): Promise<string | undefined> {
  let best: { name: string; n: number } | undefined;
  try {
    for (const e of dir.list()) {
      if (!(e instanceof File) || !e.name.startsWith(KEPT_PREFIX)) continue;
      const n = sessionCountOf(await readJson(e));
      if (!best || n > best.n) best = { name: e.name, n };
    }
  } catch {
    // best effort
  }
  return best?.name;
}

/** Session ids in a parsed backup, as strings (ids are numbers or strings). */
function sessionIdsOf(parsed: unknown): string[] {
  if (!isPlainObject(parsed) || !Array.isArray(parsed.sessions)) return [];
  return parsed.sessions
    .filter(isPlainObject)
    .map(s => String(s.id));
}

/**
 * A5: before the main file is replaced, keep a copy of it when the new
 * contents would drop a session it holds, and once per day regardless.
 * Returns false when a needed "kept" copy could not be made -- the caller then
 * leaves the old file alone (a stale backup beats a lost one).
 */
async function preserveBeforeOverwrite(
  file: File,
  existing: unknown,
  liveIds: Set<string>,
): Promise<boolean> {
  if (!file.exists || sessionCountOf(existing) === 0) return true;
  const now = new Date();
  let dir: Directory;
  try {
    dir = backupsDir();
  } catch (e) {
    console.warn('[backup] could not open the Backups folder', e);
    // Only refuse when a kept copy was actually needed.
    return !sessionIdsOf(existing).some(id => !liveIds.has(id));
  }

  const wouldLose = sessionIdsOf(existing).some(id => !liveIds.has(id));
  if (wouldLose) {
    try {
      await file.copy(new File(dir, `${KEPT_PREFIX}${timeStamp(now)}.json`), { overwrite: true });
      prune(dir, KEPT_PREFIX, KEEP_KEPT, await largestKept(dir));
    } catch (e) {
      console.warn('[backup] kept copy failed -- leaving the old backup in place', e);
      return false;
    }
  }

  const daily = new File(dir, `${DAILY_PREFIX}${dayStamp(now)}.json`);
  if (!daily.exists) {
    try {
      await file.copy(daily);
      prune(dir, DAILY_PREFIX, KEEP_DAILY);
    } catch (e) {
      console.warn('[backup] daily copy failed', e);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function writeBackup(): Promise<void> {
  try {
    const [sessionsRead, ballsRead, settingsRead, referenceRead] = await Promise.all([
      readSessionsResult(),
      readBallsResult(),
      readSettingsResult(),
      readReferenceResult(),
    ]);

    // S9: writeBackup runs on every cold launch and every write. A read that
    // failed or came back corrupt must never be allowed to reach the file —
    // this is the last-resort copy, and degrading it to sessions:[] is exactly
    // the failure it exists to protect against.
    // F15 (Nov 15): the same for balls, settings and reference. Their display
    // readers return defaults on a bad read, and settings + reference have no
    // shadow key, so this file is their only other copy.
    const bad = [sessionsRead, ballsRead, settingsRead, referenceRead]
      .some(r => r.status === 'error' || r.status === 'invalid');
    if (bad) {
      console.warn('[backup] skipped — a read returned error/invalid', {
        sessions: sessionsRead.status,
        balls: ballsRead.status,
        settings: settingsRead.status,
        reference: referenceRead.status,
      });
      return;
    }

    const file = backupFile();
    const existing = file.exists ? await readJson(file) : undefined;

    // Read says zero sessions and is trustworthy ('ok'/'missing'), but a
    // populated backup already exists. Keep the populated one: a stale backup
    // beats an empty one, and the only cost is that a deliberate delete-all
    // doesn't propagate to the file.
    if (sessionsRead.value.length === 0 && sessionCountOf(existing) > 0) {
      console.warn('[backup] skipped — refusing to overwrite a populated backup with zero sessions');
      return;
    }

    const liveIds = new Set(sessionsRead.value.map(s => String(s.id)));
    if (!(await preserveBeforeOverwrite(file, existing, liveIds))) return;

    const payload: BackupPayload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      sessions: sessionsRead.value,
      balls: ballsRead.value,
      settings: settingsRead.value,
      reference: referenceRead.value,
    };

    // SDK 58: File.write() is async. Await it so exportBackup() never shares a
    // half-written file and a failed write lands in the catch below.
    await file.write(JSON.stringify(payload, null, 2));

    console.log('[backup] written to', file.uri);
  } catch (e) {
    console.error('[backup] writeBackup failed', e);
  }
}

/**
 * Export (Phase 26.0b): refresh mBowl-backup.json from live data, then hand it
 * to the iOS share sheet (Save to Files, AirDrop, Mail…). Gets the backup out
 * of the app sandbox without the Files-app dance.
 *
 * writeBackup()'s S9 guards still apply — if the refresh is skipped because a
 * read failed, the previous on-disk backup is what gets shared, never an empty
 * one. Uses expo-sharing, already in the binary (History share), so OTA-safe.
 */
export async function exportBackup(): Promise<Result> {
  try {
    await writeBackup();
    const file = backupFile();
    if (!file.exists) {
      return { success: false, error: 'No backup file could be created.' };
    }
    if (!(await Sharing.isAvailableAsync())) {
      return { success: false, error: 'Sharing is not available on this device.' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Export mBowl backup',
    });
    return { success: true };
  } catch (e) {
    console.error('[backup] exportBackup failed', e);
    return { success: false, error: 'An unexpected error occurred during export.' };
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

type CheckedPayload = { ok: true; payload: Record<string, unknown> & { sessions: unknown[] } } | { ok: false; error: string };

/**
 * S10: key presence proved nothing — `{ sessions: null }` passed and wrote
 * "null" over live data. Restore is destructive and settings/reference have no
 * shadow key to recover from, so every value is shape-checked before anything
 * is written.
 */
function checkPayload(json: string): CheckedPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Backup file is corrupted or invalid JSON.' };
  }
  if (!isPlainObject(payload)) {
    return { ok: false, error: 'Backup file is corrupted.' };
  }
  if (!isValidSessionArray(payload.sessions)) {
    return { ok: false, error: 'Backup file has no readable sessions — restore cancelled to protect your current data.' };
  }
  if (!isBallArray(payload.balls)) {
    return { ok: false, error: 'Backup file has an invalid ball roster — restore cancelled.' };
  }
  if (!isPlainObject(payload.settings)) {
    return { ok: false, error: 'Backup file has invalid settings — restore cancelled.' };
  }
  if (!isPlainObject(payload.reference)) {
    return { ok: false, error: 'Backup file has invalid reference data — restore cancelled.' };
  }
  return { ok: true, payload: payload as Record<string, unknown> & { sessions: unknown[] } };
}

/** Counts shown before a restore from file (A7), or why the file won't restore. */
export function summarizeBackup(json: string): { summary: BackupSummary } | { error: string } {
  const checked = checkPayload(json);
  if (!checked.ok) return { error: checked.error };
  const sessions = checked.payload.sessions as { games?: unknown[] }[];
  const games = sessions.reduce((n, s) => n + (Array.isArray(s.games) ? s.games.length : 0), 0);
  const exportedAt = typeof checked.payload.exportedAt === 'string' ? checked.payload.exportedAt : null;
  return { summary: { sessions: sessions.length, games, exportedAt } };
}

async function restoreFromJson(json: string): Promise<Result> {
  const checked = checkPayload(json);
  if (!checked.ok) return { success: false, error: checked.error };
  const { payload } = checked;

  // One multiSet batch for every key. NOT guaranteed atomic on iOS — the native
  // module writes pair by pair, so a mid-batch failure (e.g. disk full) can
  // leave some keys written; that is why every shape check runs first.
  // N7: the shadow keys are written too —
  // app/_layout.tsx recovers from them on launch when the primary reads back
  // empty, so a stale shadow (e.g. the 18 seeds on a fresh install) could
  // otherwise "recover" the wrong data right after a restore.
  const sessionsJson = JSON.stringify(payload.sessions);
  const ballsJson = JSON.stringify(payload.balls);
  try {
    await AsyncStorage.multiSet([
      [KEYS.SESSIONS, sessionsJson],
      [KEYS.SESSIONS_BACKUP, sessionsJson],
      [KEYS.BALLS, ballsJson],
      [KEYS.BALLS_BACKUP, ballsJson],
      [KEYS.SETTINGS, JSON.stringify(payload.settings)],
      [KEYS.REFERENCE, JSON.stringify(payload.reference)],
    ]);
  } catch (e) {
    console.error('[backup] restore write failed', e);
    // F13: say what a partial failure means instead of a generic error.
    return {
      success: false,
      error:
        'The phone could not finish writing the backup (storage may be full). Some of your data may be partly restored. Free up space, then restore again from the same file before using the app.',
    };
  }
  return { success: true };
}

/**
 * Review fix (Nov 15): before ANY restore, save what's on the phone right now
 * to Backups/mBowl-kept-<stamp>-before-restore.json, straight from storage --
 * not via the main file, which writeBackup() skips when a read is bad (the
 * very case F12 sends Marcus to Restore for). A value that won't parse is kept
 * as its raw text, so nothing is lost even if it can't be restored as-is.
 * Returns false when the copy couldn't be written; the restore then stops.
 */
async function keepCurrentState(): Promise<boolean> {
  try {
    const pairs = await AsyncStorage.multiGet([
      KEYS.SESSIONS,
      KEYS.SESSIONS_BACKUP,
      KEYS.BALLS,
      KEYS.SETTINGS,
      KEYS.REFERENCE,
    ]);
    const raw = Object.fromEntries(pairs) as Record<string, string | null>;
    const parse = (s: string | null | undefined): unknown => {
      if (s == null) return null;
      try {
        return JSON.parse(s);
      } catch {
        return { unparsedRawText: s };
      }
    };
    const sessions = parse(raw[KEYS.SESSIONS]);
    const shadow = parse(raw[KEYS.SESSIONS_BACKUP]);
    if (sessions == null && shadow == null && raw[KEYS.BALLS] == null && raw[KEYS.SETTINGS] == null && raw[KEYS.REFERENCE] == null) {
      return true; // nothing on the phone to keep
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      note: 'mBowl: phone data saved automatically right before a restore',
      // A restorable shape when the primary was readable; otherwise the shadow.
      sessions: Array.isArray(sessions) ? sessions : Array.isArray(shadow) ? shadow : sessions,
      sessionsShadow: shadow,
      balls: parse(raw[KEYS.BALLS]),
      settings: parse(raw[KEYS.SETTINGS]),
      reference: parse(raw[KEYS.REFERENCE]),
    };
    const dir = backupsDir();
    await new File(dir, `${KEPT_PREFIX}${timeStamp(new Date())}-before-restore.json`).write(JSON.stringify(payload, null, 2));
    prune(dir, KEPT_PREFIX, KEEP_KEPT, await largestKept(dir));
    return true;
  } catch (e) {
    console.error('[backup] could not save the current data before restore', e);
    return false;
  }
}

const KEEP_FAILED: Result = {
  success: false,
  error: "Restore cancelled: mBowl couldn't save a copy of what's on the phone first (storage may be full). Nothing was changed.",
};

/** Restore from the in-app file (Documents/mBowl-backup.json). */
export async function restoreBackup(): Promise<Result> {
  try {
    let json: string;
    try {
      json = await backupFile().text();
    } catch {
      return { success: false, error: 'No backup file found.' };
    }
    if (!checkPayload(json).ok) return restoreFromJson(json); // reports why, writes nothing
    if (!(await keepCurrentState())) return KEEP_FAILED;
    const result = await restoreFromJson(json);
    if (result.success) notifyDataChanged('restore');
    return result;
  } catch (e) {
    console.error('[backup] restoreBackup failed', e);
    return { success: false, error: 'An unexpected error occurred during restore.' };
  }
}

/**
 * A7: pick a backup .json with the system document picker (iCloud Drive ->
 * mBowl Backups, or a Backups/ copy). Returns its text, or null if cancelled.
 * Reading through the picker replaces "copy a file into the mBowl folder, then
 * Restore", which the launch backup could overwrite before Restore ran (F1 B).
 */
export async function pickBackupFile(): Promise<{ json: string; name: string } | { error: string } | null> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'public.json', 'public.text', 'public.data'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.length) return null;
    const asset = picked.assets[0];
    const json = await new File(asset.uri).text();
    return { json, name: asset.name };
  } catch (e) {
    console.error('[backup] pickBackupFile failed', e);
    return { error: 'That file could not be opened.' };
  }
}

/**
 * A7: restore from a picked file's text (after the user confirmed its counts).
 * The current data is backed up first, so if the picked file lacks sessions
 * the phone has, the pre-restore state lands in Backups/ as a kept copy.
 */
export async function restoreFromPickedJson(json: string): Promise<Result> {
  try {
    if (!checkPayload(json).ok) return restoreFromJson(json); // reports why, writes nothing
    if (!(await keepCurrentState())) return KEEP_FAILED;
    const result = await restoreFromJson(json);
    if (!result.success) return result;
    await writeBackup(); // main file = the restored data
    notifyDataChanged('restore');
    return result;
  } catch (e) {
    console.error('[backup] restoreFromPickedJson failed', e);
    return { success: false, error: 'An unexpected error occurred during restore.' };
  }
}

/**
 * A6 (F1 scenarios A + C): at a first launch -- seeded flag not set AND the
 * sessions key has never been written -- look for a backup on the phone before
 * seeding: the main file first, then the newest copy in Backups/. If one holds
 * real sessions, restore it (shape-checked, shadows included) and return its
 * session count. Returns 0 when there is nothing to restore (the caller seeds).
 */
export async function restoreForFirstLaunch(): Promise<{ restored: number; failed: boolean }> {
  // Review fix: a readable shadow wins -- the launch shadow recovery restores
  // it (it can be newer than the file, e.g. after a skipped writeBackup).
  try {
    const shadowRaw = await AsyncStorage.getItem(KEYS.SESSIONS_BACKUP);
    if (shadowRaw && isValidSessionArray(JSON.parse(shadowRaw))) return { restored: 0, failed: false, };
  } catch {
    // unreadable shadow: look for a file below
  }
  const candidates: File[] = [];
  try {
    const main = backupFile();
    if (main.exists) candidates.push(main);
  } catch {
    // fall through to Backups/
  }
  try {
    const dir = new Directory(Paths.document, BACKUPS_DIR);
    if (dir.exists) {
      candidates.push(
        ...dir
          .list()
          .filter((e): e is File => e instanceof File && (e.name.startsWith(KEPT_PREFIX) || e.name.startsWith(DAILY_PREFIX)))
          // newest first by modification time; name order breaks ties
          .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0) || b.name.localeCompare(a.name)),
      );
    }
  } catch (e) {
    console.warn('[backup] Backups folder unreadable at first launch', e);
  }

  for (const file of candidates) {
    let json: string;
    try {
      json = await file.text();
    } catch {
      continue;
    }
    const summary = summarizeBackup(json);
    if ('error' in summary) continue;
    const result = await restoreFromJson(json);
    if (result.success) {
      console.warn('[mBowl] first launch: restored', summary.summary.sessions, 'sessions from', file.name);
      return { restored: summary.summary.sessions, failed: false };
    }
    // Review fix: a restore that failed partway (disk full) must not be
    // followed by seeding over it -- stop, and let the next launch retry.
    console.error('[mBowl] first launch: restore from', file.name, 'failed; not seeding');
    return { restored: 0, failed: true };
  }
  return { restored: 0, failed: false };
}
