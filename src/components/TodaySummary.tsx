import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../ledger/contracts';
import type { AppSnapshot, Band } from '../ledger/contracts';
import { amountLabel, convertAmount, nextUnit, pokeLine, type AmountUnit } from '../fun';
import { FitAmount } from './FitAmount';
import { WalletCritter } from './WalletCritter';
import { fonts, useTheme } from '../theme';

// Title is the screen's header element; the chip beside it names the chosen identity and daily budget.
export function TodaySummary({ snapshot, title }: { snapshot: AppSnapshot; title: ReactNode }) {
  const theme = useTheme();
  const [unit, setUnit] = useState<AmountUnit>('won');
  const [poked, setPoked] = useState({ band: 'calm' as Band, count: 0 });
  const ledger = snapshot.ledger;
  if (!ledger) return null;
  const { band, current } = ledger;
  const pokes = poked.band === band ? poked.count : 0; // a new band starts the lines over
  const identity = snapshot.metadata.identities.find(item => item.raw === ledger.settings.identity);
  const total = BigInt(current.total), budget = BigInt(current.budget);
  const percent = budget === 0n ? 100 : Number(total >= budget ? 100n : (total * 100n) / budget);
  const { text, caption } = convertAmount(current.total, unit);
  const ink = theme.moodInk;
  return <View style={styles.page}>
    <View style={styles.row}>
      {title}
      <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <Text style={{ color: theme.ink, fontSize: 13, fontWeight: '700' }}>{identity?.title} · 기준 {formatMoney(current.budget)}</Text>
      </View>
    </View>
    <View style={[styles.bubble, { backgroundColor: theme.surface, borderColor: theme.line, shadowColor: theme.shadow }]}>
      <Text maxFontSizeMultiplier={1.3} style={{ color: theme.ink, fontSize: 34, lineHeight: 42, fontFamily: fonts.display, fontWeight: '400' }}>{ledger.phrase}</Text>
      <Text style={{ color: theme.secondary, fontSize: 15, lineHeight: 22 }}>지갑이: “{pokeLine(band, pokes)}”</Text>
      <View style={[styles.tail, { backgroundColor: theme.surface, borderColor: theme.line }]} />
    </View>
    <WalletCritter band={band} size={240} onPoke={() => setPoked({ band, count: pokes + 1 })} />
    <Text style={[styles.hint, { color: ink }]}>지갑이를 찔러 보세요</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={amountLabel(current.total, unit)} accessibilityHint="누르면 단위가 바뀌어요"
      onPress={() => setUnit(nextUnit(unit))} style={styles.amount}>
      <FitAmount text={text} testID="today-total" label={amountLabel(current.total, unit)} max={56} color={ink} fontFamily={fonts.display} />
    </Pressable>
    <Text style={[styles.detail, { color: ink }]}>{caption} · 숫자를 누르면 단위가 바뀝니다</Text>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.gauge, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={{ width: `${percent}%`, height: '100%', backgroundColor: theme.ink }} />
    </View>
    <Text style={[styles.detail, { color: ink, fontWeight: '700' }]}>
      {total < budget ? `기준까지 ${formatMoney((budget - total).toString())} 남음` : `기준보다 ${formatMoney((total - budget).toString())} 더 씀`}
    </Text>
    <Text style={[styles.detail, { color: ink }]}>{current.day.replaceAll('-', '. ')}</Text>
    {snapshot.error && <Text style={[styles.detail, { color: ink, fontWeight: '700' }]}>마지막으로 불러온 기록이에요.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  page: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  chip: { borderWidth: 2.5, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  bubble: { borderWidth: 3, borderRadius: 22, padding: 20, gap: 8, marginBottom: 14, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  tail: { position: 'absolute', right: 56, bottom: -15, width: 26, height: 26, borderRightWidth: 3, borderBottomWidth: 3, transform: [{ rotate: '45deg' }] },
  hint: { fontSize: 12, textAlign: 'center' },
  amount: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  gauge: { height: 22, borderWidth: 3, borderRadius: 11, overflow: 'hidden' },
  detail: { fontSize: 14, lineHeight: 22 },
});
