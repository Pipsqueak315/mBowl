const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\marcus\\Desktop\\mBowl';

function write(rel, content) {
  const full = path.join(BASE, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('Written:', rel);
}

function del(rel) {
  const full = path.join(BASE, rel);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    console.log('Deleted:', rel);
  } else {
    console.log('Not found (skipped):', rel);
  }
}

// ─── app/_layout.tsx ─────────────────────────────────────────────────────────
write('app/_layout.tsx', `import { DarkTheme, ThemeProvider } from '@react-navigation/native';
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
`);

// ─── app/(tabs)/_layout.tsx ───────────────────────────────────────────────────
write('app/(tabs)/_layout.tsx', `import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00CEC9',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: '#38383A',
          borderTopWidth: 0.5,
        },
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#FFFFFF',
        headerShadowVisible: false,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="square.and.pencil" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="chart.bar.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reference"
        options={{
          title: 'Reference',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="book.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
`);

// ─── Tab screen factory ───────────────────────────────────────────────────────
function makeTabScreen(label) {
  return `import { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ${label}Screen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setSettingsOpen(true)}
          style={styles.gearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="gearshape.fill" size={22} color="#8E8E93" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.label}>${label}</Text>
      </View>

      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSettingsOpen(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  gearButton: {
    marginRight: 16,
  },
  modal: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  doneText: {
    color: '#00CEC9',
    fontSize: 17,
    fontWeight: '600',
  },
});
`;
}

write('app/(tabs)/log.tsx', makeTabScreen('Log'));
write('app/(tabs)/stats.tsx', makeTabScreen('Stats'));
write('app/(tabs)/history.tsx', makeTabScreen('History'));
write('app/(tabs)/reference.tsx', makeTabScreen('Reference'));

// ─── app/log-frames.tsx ───────────────────────────────────────────────────────
write('app/log-frames.tsx', `import { View, Text, StyleSheet } from 'react-native';

export default function LogFramesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Log Frames</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
});
`);

// ─── Delete default Expo starter files ───────────────────────────────────────
del('app/(tabs)/index.tsx');
del('app/(tabs)/explore.tsx');

console.log('\nPhase 3 files written successfully.');
