import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Body, Button, Card } from '../../src/components/ui';
import { formatMoney } from '../../src/ledger/contracts';
import { useActiveRefresh, useLedger } from '../../src/state/LedgerProvider';
import { useTheme } from '../../src/theme';

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={styles.row}>
    <Text style={{ color: theme.secondary, fontSize: 16 }}>{label}</Text>
    <Text style={{ color: theme.ink, fontSize: 16, flex: 1, textAlign: 'right' }}>{value}</Text>
  </View>;
}

export default function Settings() {
  const theme = useTheme();
  const router = useRouter();
  const { store, snapshot, readError, refreshing } = useLedger();
  useActiveRefresh();
  const ledger = snapshot?.ledger;
  const identity = ledger && snapshot.metadata.identities.find(item => item.raw === ledger.settings.identity);
  const link = (label: string, href: '/connection' | '/display') => <Pressable accessibilityRole="link" onPress={() => router.push(href)} style={styles.link}>
    <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void store.reload()} />}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>설정</Text>
      {readError && <Alert message={readError} />}
      {ledger && <>
        <Card title="생활 기준">
          <Row label="신분" value={identity?.title ?? ledger.settings.identity} />
          <Row label="하루 기준" value={formatMoney(ledger.settings.dailyBudget)} />
          <Row label="월 예산" value={ledger.settings.monthlyBudget === null ? '하루 기준 × 그 달 일수' : formatMoney(ledger.settings.monthlyBudget)} />
          <Button label="내 기준 바꾸기" onPress={() => router.push('/edit-settings')} />
        </Card>
        <Card title="연결·표시">
          {link('결제 문자 연결하기', '/connection')}
          {link('잠금화면 설정하기', '/display')}
        </Card>
        <Card title="기기 안에만 보관해요">
          <Body>오늘의 개별 지출 금액과 최근 12개월의 날짜별 합계·기준 금액만 보관해요. 문자 내용과 가게 이름은 저장하지 않아요.</Body>
          <Body>자동화가 꺼져 놓친 결제도 0원으로 보일 수 있어요. 같은 문자가 다시 오면 두 번 더해질 수 있고, KB 결제 취소는 아직 반영되지 않아요.</Body>
        </Card>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 12 }, row: { flexDirection: 'row', gap: 12, minHeight: 32, alignItems: 'center' },
  link: { minHeight: 44, justifyContent: 'center' },
});
