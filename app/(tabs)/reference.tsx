import { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import SettingsContent from '@/components/SettingsContent';

export default function ReferenceScreen() {
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
        <Text style={styles.label}>Reference</Text>
      </View>

      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SettingsContent onClose={() => setSettingsOpen(false)} />
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
});
