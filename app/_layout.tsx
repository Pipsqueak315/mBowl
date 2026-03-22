import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSessions, writeSessions, readBalls, writeBalls, isValidSessionArray, KEYS } from '../src/storage';
import { writeBackup } from '../src/backup';
import type { Session, Ball } from '../src/types';
import { SEED_SESSIONS } from '../src/seeds';
import { INITIAL_BALLS } from '../src/balls';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  useEffect(() => {
    async function initStorage() {
      // Step 2: Seed flag — seeds run at most once, ever
      const seeded = await AsyncStorage.getItem(KEYS.SEEDED_FLAG);
      if (seeded !== 'true') {
        // Migration-safe: only seed what isn't already there
        const existingSessions = await readSessions();
        const existingBalls = await readBalls();
        if (existingSessions.length === 0) {
          await writeSessions(SEED_SESSIONS as Session[]);
        }
        if (existingBalls.length === 0) {
          await writeBalls(INITIAL_BALLS as Ball[]);
        }
        await AsyncStorage.setItem(KEYS.SEEDED_FLAG, 'true');
        return;
      }

      // Steps 3 & 4: Restore check — only runs on subsequent launches
      // Sessions
      const sessions = await readSessions();
      if (sessions.length === 0) {
        try {
          const raw = await AsyncStorage.getItem(KEYS.SESSIONS_BACKUP);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (isValidSessionArray(parsed)) {
              await writeSessions(parsed);
              console.warn('[mBowl] sessions restored from backup');
            }
          }
        } catch (e) {
          console.error('[storage] session restore failed', e);
        }
      }

      // Balls
      const balls = await readBalls();
      if (balls.length === 0) {
        try {
          const raw = await AsyncStorage.getItem(KEYS.BALLS_BACKUP);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await writeBalls(parsed);
              console.warn('[mBowl] balls restored from backup');
            }
          }
        } catch (e) {
          console.error('[storage] balls restore failed', e);
        }
      }
    }
    initStorage().then(() => { void writeBackup(); });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="log-frames" options={{ title: 'Log Frames' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
