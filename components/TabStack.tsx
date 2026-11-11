import { Stack } from 'expo-router';

// Phase 27.4: every tab is its own native stack inside NativeTabs (the iOS
// pattern: a tab bar of navigation controllers). NativeTabs draw no header, so
// the title and each screen's navigation.setOptions({ headerRight }) buttons
// (the Settings gear) live in this stack's header.
//
// Setting headerStyle.backgroundColor keeps today's opaque black bar: it opts
// out of SDK 58's default transparent Liquid Glass header (content underneath)
// until the Phase 28 v2 headers land.
export default function TabStack({ title }: { title: string }) {
  return (
    <Stack
      screenOptions={{
        title,
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#FFFFFF',
        headerShadowVisible: false,
      }}
    />
  );
}
