import { StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../ledger/contracts';
import type { AppSnapshot } from '../ledger/contracts';
import { FitAmount } from './FitAmount';
import { useTheme } from '../theme';

export function TodaySummary({ snapshot }: { snapshot: AppSnapshot }) {
  const theme = useTheme();
  const ledger = snapshot.ledger;
  if (!ledger) return null;
  const total = formatMoney(ledger.current.total);
  const identity = snapshot.metadata.identities.find(item => item.raw === ledger.settings.identity);
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
    <Text style={[styles.date, { color: theme.secondary }]}>{ledger.current.day.replaceAll('-', '. ')}</Text>
    <Text style={[styles.label, { color: theme.secondary }]}>오늘 쓴 돈</Text>
    <FitAmount text={total} testID="today-total" label={`오늘 쓴 돈 ${total}`} />
    <Text style={[styles.phrase, { color: theme[ledger.band] }]}>{ledger.phrase}</Text>
    <Text style={[styles.detail, { color: theme.secondary }]}>{identity?.title} · 하루 기준 {formatMoney(ledger.current.budget)}</Text>
    {snapshot.error && <Text style={[styles.detail, { color: theme.exceeded }]}>마지막으로 불러온 기록이에요.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 22, borderWidth: 1, borderRadius: 24, gap: 12 },
  date: { fontSize: 14 }, label: { fontSize: 16, marginTop: 20 },
  phrase: { fontSize: 25, fontWeight: '700' }, detail: { fontSize: 14, lineHeight: 22 },
});
