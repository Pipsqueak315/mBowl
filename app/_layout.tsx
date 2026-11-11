import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readSessionsResult,
  writeSessions,
  readBallsResult,
  writeBalls,
  isValidSessionArray,
  isBallArray,
  KEYS,
} from '../src/storage';
import { writeBackup } from '../src/backup';
import { scheduleCertReminder } from '../src/notifications';
import type { Session, Ball } from '../src/types';
import { SEED_SESSIONS } from '../src/seeds';
import { INITIAL_BALLS } from '../src/balls';

// M2 (Nov 11 audit): no `unstable_settings.anchor` here. In expo-router 58 the
// anchor seeds the root stack as [(tabs), index]; app/index.tsx's Redirect then
// REPLACEs index with a NEW (tabs) route, so every cold launch mounted two tab
// navigators (two LogPages, the hidden one answering Live game taps). Without
// an anchor the seeded state is just [index] and the Redirect leaves exactly
// one (tabs). app/index.tsx stays -- Expo Go needs it.

// 27.0 M1: app.json allows every orientation (native). The JS portrait lock
// that held the app upright until the Phase 28 landscape layouts existed was
// removed Nov 11 (Marcus: no rotation folded or unfolded) -- the app now
// follows the phone, and iOS's own Rotation Lock (Control Center) is the
// switch. expo-screen-orientation stays in the binary, unused.

export default function RootLayout() {
  useEffect(() => {
    async function initStorage() {
      // Step 2: Seed flag — seeds run at most once, ever
      let seeded: string | null = null;
      try {
        seeded = await AsyncStorage.getItem(KEYS.SEEDED_FLAG);
      } catch (e) {
        console.error('[mBowl] seed flag read failed; deferring init', e);
        return;
      }

      if (seeded !== 'true') {
        const sessionsRead = await readSessionsResult();
        const ballsRead = await readBallsResult();

        // A read that threw tells us nothing about what's in the store. Bail
        // without latching the flag so a genuine first launch still seeds later.
        if (sessionsRead.status === 'error' || ballsRead.status === 'error') {
          console.warn('[mBowl] storage read failed; skipping seed this launch');
          return;
        }

        // S11: seed ONLY a key that has never been written. 'ok' (even with
        // zero sessions) and 'invalid' both mean something is already there —
        // seeding over either would destroy real history.
        if (sessionsRead.status === 'missing') {
          await writeSessions(SEED_SESSIONS as Session[]);
        } else if (sessionsRead.status === 'invalid') {
          console.warn('[mBowl] sessions key present but unreadable — not seeding over it');
        }

        if (ballsRead.status === 'missing') {
          await writeBalls(INITIAL_BALLS as Ball[]);
        } else if (ballsRead.status === 'invalid') {
          console.warn('[mBowl] balls key present but unreadable — not seeding over it');
        }

        try {
          await AsyncStorage.setItem(KEYS.SEEDED_FLAG, 'true');
        } catch (e) {
          console.error('[mBowl] seed flag write failed', e);
        }
        // Falls through to the restore check: an 'invalid' store on a
        // never-seeded install can still recover from its shadow key.
      }

      // Steps 3 & 4: Restore check
      // Sessions
      const sessionsRead = await readSessionsResult();
      if (sessionsRead.status !== 'error' && sessionsRead.value.length === 0) {
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
      const ballsRead = await readBallsResult();
      if (ballsRead.status !== 'error' && ballsRead.value.length === 0) {
        try {
          const raw = await AsyncStorage.getItem(KEYS.BALLS_BACKUP);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (isBallArray(parsed) && parsed.length > 0) {
              await writeBalls(parsed);
              console.warn('[mBowl] balls restored from backup');
            }
          }
        } catch (e) {
          console.error('[storage] balls restore failed', e);
        }
      }
    }
    initStorage().then(() => { void writeBackup(); void scheduleCertReminder(); });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* SDK 58: iOS 26+ stack headers default to transparent Liquid Glass
              with content underneath. Keep Log Frames' opaque header (and its
              layout below it) until the Phase 28 WP2 header lands. */}
          <Stack.Screen name="log-frames" options={{ title: 'Log Frames', headerTransparent: false }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
