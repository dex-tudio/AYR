import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, AppState, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ledgerService } from '../src/ledger/service';
import { assertSnapshotMoney } from '../src/ledger/contracts';
import type { AppSnapshot } from '../src/ledger/contracts';
import { TodaySummary } from '../src/components/TodaySummary';
import { useTheme } from '../src/theme';

export default function Today() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The latest request wins, including after leaving or re-entering the screen.
  const [requests] = useState(() => ({ latest: 0 }));
  const reload = useCallback(async () => {
    const request = ++requests.latest;
    setRefreshing(true);
    try {
      const next = assertSnapshotMoney(await ledgerService.getSnapshot());
      if (request !== requests.latest) return;
      setSnapshot(next);
      setError(null);
    } catch (failure) {
      if (request === requests.latest) setError(failure instanceof Error ? failure.message : '기록을 불러오지 못했어요.');
    } finally {
      if (request === requests.latest) setRefreshing(false);
    }
  }, [requests]);
  useFocusEffect(useCallback(() => {
    void reload();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void reload(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void reload(); }, 30000);
    return () => { ++requests.latest; subscription.remove(); clearInterval(timer); };
  }, [reload, requests]));
  const message = error ?? snapshot?.error?.message;
  // Root marker shown only after getSnapshot succeeded without a read error, whether or not onboarding is done.
  const connected = snapshot !== null && !error && !snapshot.error;
  return <SafeAreaView testID={connected ? (Platform.OS === 'ios' ? 'ayr-native-connected' : 'ayr-preview-connected') : undefined}
    style={[styles.safe, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} />}>
      {Platform.OS === 'web' && <View style={[styles.preview, { backgroundColor: theme.lime }]}>
        <Text style={{ color: theme.limeInk, fontSize: 14, fontWeight: '700' }}>미리보기 · 가짜 기록</Text>
        <Text style={{ color: theme.limeInk, fontSize: 12 }}>실제 장부와 연결되지 않아요. 잠금화면 표시는 iPhone에서 가능해요.</Text>
      </View>}
      <Text style={[styles.title, { color: theme.ink }]}>오늘</Text>
      {!snapshot && !error && <View accessibilityRole="progressbar"><ActivityIndicator color={theme.ink} /><Text style={{ color: theme.secondary }}>기록을 불러오고 있어요.</Text></View>}
      {message && <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.exceeded, fontSize: 16 }}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.button}><Text style={{ color: theme.ink }}>다시 불러오기</Text></Pressable>
      </View>}
      {snapshot?.ledger && !snapshot.ledger.onboardingCompleted && <View style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.ink, fontSize: 20, fontWeight: '700' }}>시작 설정을 먼저 마쳐주세요</Text>
        <Text style={{ color: theme.secondary }}>신분·하루 기준·결제 수단을 설정하면 오늘 지출을 볼 수 있어요.</Text>
      </View>}
      {snapshot?.ledger?.onboardingCompleted && <TodaySummary snapshot={snapshot} />}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  preview: { padding: 14, borderRadius: 14, gap: 6 }, title: { fontSize: 28, fontWeight: '800', marginTop: 12 },
  notice: { padding: 20, borderRadius: 20, gap: 12 }, button: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
});
