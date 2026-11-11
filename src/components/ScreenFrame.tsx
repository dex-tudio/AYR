import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

// Direct entry (browser reload) has no history, so fall back to the spending list.
export function useClose(fallback: '/spending' | '/') {
  const router = useRouter();
  return () => { if (router.canGoBack()) router.back(); else router.replace(fallback); };
}

export function ScreenFrame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const theme = useTheme();
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={styles.back}>
        <Text style={{ color: theme.ink, fontSize: 16 }}>‹ 뒤로</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>{title}</Text>
      {children}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  back: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 28, fontWeight: '800' },
});
