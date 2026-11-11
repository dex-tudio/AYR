import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../ledger/contracts';
import type { MonthDayState, MonthViewState } from '../ledger/contracts';
import { useTheme } from '../theme';

const statusText = { noRecord: '기록 없음', future: '아직 오지 않은 날' } as const;

// Weekday header and day cells exactly as Swift reported them (leading blanks, weekday symbols, status, phrase and band).
// An amount is shrunk to its cell, never cut; the exact amount with its unit is also in the accessibility label.
export function MonthlyCalendar({ month }: { month: MonthViewState }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const cell = width / 7;
  // Each amount shrinks to its own cell (0.6em is wider than any digit or comma), so no digit is cut; only extreme amounts get tiny.
  const amountSize = (text: string) => cell ? Math.min(12, Math.max(4, Math.floor((cell - 4) / (text.length * 0.6)))) : 12;
  const label = (day: MonthDayState) => {
    const detail = day.status === 'recorded' ? `${formatMoney(day.total!)}, ${day.phrase}` : statusText[day.status];
    return `${month.title} ${day.day}일, ${detail}`;
  };
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.grid}>
    {month.weekdays.map((symbol, index) => <Text key={`w${index}`} style={[styles.cell, styles.weekday, { color: theme.secondary }]}>{symbol}</Text>)}
    {Array.from({ length: month.leadingBlanks }, (_, index) => <View key={`b${index}`} style={styles.cell} />)}
    {month.days.map(day => {
      const amount = day.total === null ? '' : formatMoney(day.total).slice(0, -1);
      const tint = day.band ? `${theme[day.band]}26` : 'transparent';
      return <View key={day.key} testID={`day-${day.key}`} accessible accessibilityLabel={label(day)}
        style={[styles.cell, styles.day, { backgroundColor: tint, borderColor: day.status === 'recorded' ? 'transparent' : theme.line, opacity: day.status === 'future' ? 0.55 : 1 }]}>
        <Text style={{ color: theme.ink, fontSize: 12, fontWeight: '700' }}>{day.day}</Text>
        {day.total !== null
          ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.3} style={{ color: theme.ink, fontSize: amountSize(amount) }}>{amount}</Text>
          : <Text style={{ color: theme.secondary, fontSize: 12 }}>—</Text>}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 1/7 of the row; a fixed height keeps every week the same size.
  cell: { width: '14.2857%', alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 12, textAlign: 'center', paddingBottom: 6 },
  day: { height: 54, borderWidth: 1, borderRadius: 8, gap: 4 },
});
