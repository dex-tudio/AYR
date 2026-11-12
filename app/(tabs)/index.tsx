import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supportedTitles } from '../../src/ledger/contracts';
import { ReceptionStatus } from '../../src/components/ReceptionStatus';
import { TodaySummary } from '../../src/components/TodaySummary';
import { Button } from '../../src/components/ui';
import { useActiveRefresh, useLedger } from '../../src/state/LedgerProvider';
import { useTheme } from '../../src/theme';

export default function Today() {
  const theme = useTheme();
  const router = useRouter();
  const { store, snapshot, readError, refreshing } = useLedger();
  useActiveRefresh();
  const message = readError ?? snapshot?.error?.message;
  const ready = snapshot?.ledger?.onboardingCompleted === true;
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void store.reload()} />}>
      <Text testID={Platform.OS === 'ios' && snapshot && !message ? 'ayr-native-connected' : undefined}
        accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>오늘</Text>
      {!snapshot && !readError && <View accessibilityRole="progressbar"><ActivityIndicator color={theme.ink} /><Text style={{ color: theme.secondary }}>기록을 불러오고 있어요.</Text></View>}
      {message && <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.exceeded, fontSize: 16 }}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={() => void store.reload()} style={styles.button}><Text style={{ color: theme.ink }}>다시 불러오기</Text></Pressable>
      </View>}
      {snapshot && ready && <TodaySummary snapshot={snapshot} />}
      {snapshot && ready && <Pressable accessibilityRole="link" onPress={() => router.push('/spending')}
        style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700', minHeight: 44, textAlignVertical: 'center' }}>오늘 지출 보기 · 추가 · 삭제</Text>
      </Pressable>}
      {snapshot?.ledger && ready && <View style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>문자가 오면, 알아서</Text>
        <Text style={{ color: theme.secondary, fontSize: 14, lineHeight: 22 }}>{supportedTitles(snapshot.metadata)}을(를) 연결하면 오늘 쓴 돈에 자동으로 더해져요.</Text>
        <ReceptionStatus ledger={snapshot.ledger} />
        <Pressable accessibilityRole="link" onPress={() => router.push('/connection')} style={styles.button}>
          <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>결제 문자 연결하기</Text>
        </Pressable>
      </View>}
      {snapshot && ready && <View style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>잠금화면에서도 바로</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/display')} style={styles.button}>
          <Text style={{ color: theme.ink, fontSize: 16 }}>잠금화면 설정하기</Text>
        </Pressable>
        {Platform.OS === 'ios' && <Button label="잠금화면에서 보기" disabled={refreshing} onPress={() => void store.refreshActivity()} />}
        {snapshot.activityNotice && <Text accessibilityRole="alert" style={{ color: theme.exceeded, fontSize: 14 }}>{snapshot.activityNotice}</Text>}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 12 },
  notice: { padding: 20, borderRadius: 20, gap: 12 }, button: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
});
