import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLedger } from '../state/LedgerProvider';
import { fonts, useTheme } from '../theme';
import { Alert, Body } from './ui';

// Direct entry (browser reload) has no history, so fall back to the spending list.
export function useClose(fallback: '/spending' | '/' | '/settings') {
  const router = useRouter();
  return () => { if (router.canGoBack()) router.back(); else router.replace(fallback); };
}

// Screens share one read-failure alert with a retry button and one loading text, so none repeats them.
export function ScreenFrame({ title, onBack, children, background, ink }: { title: string; onBack?: () => void; children: ReactNode; background?: string; ink?: string }) {
  const theme = useTheme();
  const { store, snapshot, readError } = useLedger();
  // A read that failed inside the ledger (no ledger, an error) is as much a read failure as a thrown one.
  const message = readError ?? snapshot?.error?.message;
  return <SafeAreaView style={[styles.safe, { backgroundColor: background ?? theme.background }]}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {onBack && <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={styles.back}>
        <Text style={{ color: ink ?? theme.ink, fontSize: 16 }}>‹ 뒤로</Text>
      </Pressable>}
      <Text testID={Platform.OS === 'ios' && snapshot && !message ? 'ayr-native-connected' : undefined}
        accessibilityRole="header" style={[styles.title, { color: ink ?? theme.ink }]}>{title}</Text>
      {message ? <Alert message={message} onRetry={() => void store.reload()} /> : !snapshot && (ink
        ? <Text style={{ color: ink, fontSize: 14, lineHeight: 22 }}>기록을 불러오고 있어요.</Text>
        : <Body>기록을 불러오고 있어요.</Body>)}
      {children}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  back: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 30, fontFamily: fonts.display, fontWeight: '400' },
});
