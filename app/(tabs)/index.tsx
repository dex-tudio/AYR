import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supportedTitles } from '../../src/ledger/contracts';
import { ReceptionStatus } from '../../src/components/ReceptionStatus';
import { TodaySummary } from '../../src/components/TodaySummary';
import { Alert, Button, Card } from '../../src/components/ui';
import { useActiveRefresh, useLedger } from '../../src/state/LedgerProvider';
import { fonts, moodBackground, useTheme } from '../../src/theme';

export default function Today() {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const router = useRouter();
  const { store, snapshot, readError, refreshing } = useLedger();
  useActiveRefresh();
  const message = readError ?? snapshot?.error?.message;
  const ready = snapshot?.ledger?.onboardingCompleted === true;
  const background = ready && snapshot?.ledger ? moodBackground(snapshot.ledger.band, dark) : theme.background;
  const color = ready ? theme.moodInk : theme.ink;
  const title = <Text testID={Platform.OS === 'ios' && snapshot && !message ? 'ayr-native-connected' : undefined}
    accessibilityRole="header" maxFontSizeMultiplier={1.3}
    style={ready ? [styles.brand, { color }] : [styles.title, { color }]}>{ready ? '님 부자임?' : '오늘'}</Text>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void store.reload()} />}>
      {!(snapshot && ready) && title}
      {!snapshot && !readError && <View accessibilityRole="progressbar"><ActivityIndicator color={theme.ink} /><Text style={{ color: theme.secondary }}>기록을 불러오고 있어요.</Text></View>}
      {message && <Alert message={message} onRetry={() => void store.reload()} />}
      {snapshot && ready && <TodaySummary snapshot={snapshot} title={title} />}
      {snapshot && ready && <Pressable accessibilityRole="link" onPress={() => router.push('/spending')}>
        <Card><Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700', minHeight: 44, textAlignVertical: 'center' }}>오늘의 범행 기록 보기</Text></Card>
      </Pressable>}
      {snapshot?.ledger && ready && <Card title="문자가 오면, 알아서">
        <Text style={{ color: theme.secondary, fontSize: 14, lineHeight: 22 }}>{supportedTitles(snapshot.metadata)}을(를) 연결하면 오늘 쓴 돈에 자동으로 더해져요.</Text>
        <ReceptionStatus ledger={snapshot.ledger} />
        <Pressable accessibilityRole="link" onPress={() => router.push('/connection')} style={styles.button}>
          <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>결제 문자 연결하기</Text>
        </Pressable>
      </Card>}
      {snapshot && ready && <Card title="잠금화면에서도 바로">
        <Pressable accessibilityRole="link" onPress={() => router.push('/display')} style={styles.button}>
          <Text style={{ color: theme.ink, fontSize: 16 }}>잠금화면 설정하기</Text>
        </Pressable>
        {Platform.OS === 'ios' && <Button label="잠금화면에서 보기" disabled={refreshing} onPress={() => void store.refreshActivity()} />}
        {snapshot.activityNotice && <Text accessibilityRole="alert" style={{ color: theme.exceeded, fontSize: 14 }}>{snapshot.activityNotice}</Text>}
      </Card>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 12 },
  brand: { fontSize: 22, fontFamily: fonts.display, fontWeight: '400' },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
});
