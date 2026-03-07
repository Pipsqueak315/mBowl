import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { readSessions, writeSessions, readBalls, writeBalls } from '../src/storage';
import { SEED_SESSIONS } from '../src/seeds';
import { INITIAL_BALLS } from '../src/balls';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  useEffect(() => {
    async function seedIfNeeded() {
      const sessions = await readSessions();
      if (!sessions || sessions.length === 0) {
        await writeSessions(SEED_SESSIONS);
      }
      const balls = await readBalls();
      if (!balls || balls.length === 0) {
        await writeBalls(INITIAL_BALLS);
      }
    }
    seedIfNeeded();
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="log-frames" options={{ title: 'Log Frames' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
