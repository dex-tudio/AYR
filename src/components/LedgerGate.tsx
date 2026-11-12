import { useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLedger } from '../state/LedgerProvider';
import { useTheme } from '../theme';
import { Alert, Body, Button, Card } from './ui';

// Wraps every screen. A damaged record replaces the app with the recovery screen; otherwise the screens render
// and the root marker appears once a snapshot was read without error (the native smoke test waits for it).
// Reading is left to the screens (useActiveRefresh), so a start does one read, not two.
export function LedgerGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { store, snapshot, readError, failure, mutating } = useLedger();
  const [confirming, setConfirming] = useState(false);
  const damaged = snapshot?.error?.canReset === true || failure?.canReset === true;
  if (damaged) {
    const message = snapshot?.error?.message ?? failure?.message ?? '';
    const reset = async () => { await store.resetRecords(); setConfirming(false); };
    return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>기록을 불러오지 못했어요</Text>
        <Alert message={message} />
        {failure?.source === 'reset' && failure.message !== message && <Alert title="새로 시작하지 못했어요" message={failure.message} />}
        {confirming
          ? <Card title="기록을 새로 시작할까요?">
            <Body>지금 기록은 앱에서 더 이상 볼 수 없어요. 원본은 기기 안에 따로 보관하고, 처음 설정부터 다시 시작해요.</Body>
            <Button label="취소" disabled={mutating} onPress={() => setConfirming(false)} />
            <Button label="원본 보관 후 새로 시작" tone="danger" disabled={mutating} onPress={() => void reset()} />
          </Card>
          : <Button label="원본 보관 후 새로 시작" tone="danger" disabled={mutating} onPress={() => { store.clearFailure(); setConfirming(true); }} />}
        <Button label="다시 불러오기" disabled={mutating} onPress={() => void store.reload()} />
      </ScrollView>
    </SafeAreaView>;
  }
  const connected = snapshot !== null && !readError && !snapshot.error;
  return <View style={styles.safe} testID={connected && Platform.OS === 'web' ? 'ayr-preview-connected' : undefined}>{children}</View>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 12 },
});
