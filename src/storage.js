import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SESSIONS:  'mbowl_sessions_v1',
  BALLS:     'mbowl_balls_v1',
  REFERENCE: 'mbowl_reference_v1',
  SETTINGS:  'mbowl_settings_v1',
  DRAFT:     'mbowl_draft_v1',
};

async function read(key) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function write(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
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
export async function writeDraft(data)     { return write(KEYS.DRAFT, data); }
