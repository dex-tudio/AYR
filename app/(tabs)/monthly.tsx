import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FitAmount } from '../../src/components/FitAmount';
import { MonthlyCalendar } from '../../src/components/MonthlyCalendar';
import { Alert, Body, Button, Card } from '../../src/components/ui';
import { formatMoney, monthOffsets } from '../../src/ledger/contracts';
import type { MonthViewState } from '../../src/ledger/contracts';
import { useActiveMonthRefresh, useActiveRefresh, useLedger, useMonth } from '../../src/state/LedgerProvider';
import { useTheme } from '../../src/theme';

function comparisonText(comparison: MonthViewState['comparison']) {
  if (!comparison) return '비교할 지난달 기록이 아직 없어요.';
  const amount = formatMoney(comparison.difference);
  if (comparison.direction === 'more') return `지난달 같은 기간보다 ${amount} 더 썼어요.`;
  if (comparison.direction === 'less') return `지난달 같은 기간보다 ${amount} 덜 썼어요.`;
  return '지난달 같은 기간과 같아요.';
}

export default function Monthly() {
  const theme = useTheme();
  const router = useRouter();
  const ledger = useLedger();
  const { store, offset, month, loading, error } = useMonth();
  useActiveRefresh();
  useActiveMonthRefresh();
  const message = error ?? ledger.readError ?? ledger.snapshot?.error?.message;
  const nav = (label: string, mark: string, target: number, enabled: boolean) =>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }} disabled={!enabled}
      onPress={() => store.select(target)} style={[styles.nav, { opacity: enabled ? 1 : 0.35 }]}>
      <Text style={{ color: theme.ink, fontSize: 24 }}>{mark}</Text>
    </Pressable>;
  const refresh = () => { void ledger.store.reload(); void store.reload(); };
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>월별 지출</Text>
      <View style={styles.monthRow}>
        {nav('이전 달', '‹', offset - 1, month?.canGoPrevious ?? offset > monthOffsets.oldest)}
        <Text testID="month-title" accessibilityRole="header" style={{ color: theme.ink, fontSize: 22, fontWeight: '800' }}>{month?.title ?? '…'}</Text>
        {nav('다음 달', '›', offset + 1, month?.canGoNext ?? offset < monthOffsets.newest)}
      </View>
      {message && <Alert message={message} onRetry={refresh} />}
      {!month && !message && <View accessibilityRole="progressbar"><Body>기록을 불러오고 있어요.</Body></View>}
      {month && <>
        {message && <Body>마지막으로 불러온 기록이에요.</Body>}
        <Card title="월 합계">
          <FitAmount text={formatMoney(month.total)} max={34} testID="month-total" label={`월 합계 ${formatMoney(month.total)}`} />
          <Text testID="month-budget" style={{ color: theme.secondary, fontSize: 16 }}>예산 {formatMoney(month.budget)}</Text>
          <Text testID="month-remaining" style={{ color: month.overBudget ? theme.exceeded : theme.calm, fontSize: 16, fontWeight: '700' }}>
            {formatMoney(month.remaining)} {month.overBudget ? '초과' : '남았어요'}
          </Text>
          <Text testID="month-comparison" style={{ color: theme.secondary, fontSize: 14, lineHeight: 22 }}>{comparisonText(month.comparison)}</Text>
          <Button label="월 예산 바꾸기" onPress={() => router.push('/edit-settings')} />
        </Card>
        <Card><MonthlyCalendar month={month} /></Card>
        <Card title="어떤 날들이었나요?">
          {month.phraseCounts.map(item => <View key={item.band} testID={`phrase-${item.band}`} style={styles.row}>
            <Text style={{ color: theme[item.band], fontSize: 16, flex: 1 }}>{item.phrase}</Text>
            <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>{item.days}일</Text>
          </View>)}
        </Card>
        <Body small>기록을 시작하기 전과 아직 오지 않은 날은 비워둬요. 결제가 없는 날은 0원으로 보여요. 자동화가 꺼져 놓친 결제도 0원으로 보일 수 있어요. 기록은 최근 12개월만 보관해요.</Body>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 16, gap: 20 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12, minHeight: 32, alignItems: 'center' },
});
