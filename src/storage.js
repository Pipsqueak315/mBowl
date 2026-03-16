import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SESSIONS:  'mbowl_sessions_v1',
  BALLS:     'mbowl_balls_v1',
  REFERENCE: 'mbowl_reference_v1',
  SETTINGS:  'mbowl_settings_v1',
  DRAFT:     'mbowl_draft_v1',
};

async function read(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[storage] read failed for key:', key, e);
    return null;
  }
}

async function write(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[storage] write failed for key:', key, e);
    throw e;
  }
}

export async function readSessions()       { return read(KEYS.SESSIONS); }
export async function writeSessions(data)  { return write(KEYS.SESSIONS, data); }

export async function readBalls()          { return read(KEYS.BALLS); }
export async function writeBalls(data)     { return write(KEYS.BALLS, data); }

export async function readReference()      { return read(KEYS.REFERENCE); }
export async function writeReference(data) { return write(KEYS.REFERENCE, data); }

export async function readSettings()       { return read(KEYS.SETTINGS); }
export async function writeSettings(data)  { return write(KEYS.SETTINGS, data); }

export async function readDraft()          { return read(KEYS.DRAFT); }
export async function writeDraft(data) {
  if (data === null) {
    await AsyncStorage.removeItem(KEYS.DRAFT);
  } else {
    return write(KEYS.DRAFT, data);
  }
}
