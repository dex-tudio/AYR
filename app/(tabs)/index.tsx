import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supportedTitles } from '../../src/ledger/contracts';
import { ReceptionStatus } from '../../src/components/ReceptionStatus';
import { TodaySummary } from '../../src/components/TodaySummary';
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
      {Platform.OS === 'web' && <View style={[styles.preview, { backgroundColor: theme.lime }]}>
        <Text style={{ color: theme.limeInk, fontSize: 14, fontWeight: '700' }}>미리보기 · 가짜 기록</Text>
        <Text style={{ color: theme.limeInk, fontSize: 12 }}>실제 장부와 연결되지 않아요. 잠금화면 표시는 iPhone에서 가능해요.</Text>
      </View>}
      <Text style={[styles.title, { color: theme.ink }]}>오늘</Text>
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
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  preview: { padding: 14, borderRadius: 14, gap: 6 }, title: { fontSize: 28, fontWeight: '800', marginTop: 12 },
  notice: { padding: 20, borderRadius: 20, gap: 12 }, button: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
});
