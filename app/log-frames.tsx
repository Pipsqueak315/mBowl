import { View, Text, StyleSheet } from 'react-native';

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
