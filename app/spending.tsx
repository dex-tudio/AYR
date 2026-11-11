import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { formatMoney } from '../src/ledger/contracts';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';
import { useTheme } from '../src/theme';

type Removal = { index: number; amount: string; expectedCurrent: string };

export default function Spending() {
  const theme = useTheme();
  const router = useRouter();
  const close = useClose('/');
  const { store, snapshot, readError, failure, mutating } = useLedger();
  // Captured when the delete button is pressed, so the request names what the user actually saw.
  const [removal, setRemoval] = useState<Removal | null>(null);
  useActiveRefresh();
  useEffect(() => { store.clearFailure(); }, [store]);
  const ledger = snapshot?.ledger;
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.line }];
  const confirmRemoval = async () => {
    if (!removal) return;
    await store.removeSpending(removal.index, removal.expectedCurrent);
    setRemoval(null);
  };
  return <ScreenFrame title="오늘 지출" onBack={close}>
    {!snapshot && !readError && <View accessibilityRole="progressbar"><ActivityIndicator color={theme.ink} /></View>}
    {readError && <View accessibilityRole="alert" style={card}>
      <Text style={{ color: theme.exceeded, fontSize: 16 }}>{readError}</Text>
      <Pressable accessibilityRole="button" onPress={() => void store.reload()} style={styles.button}><Text style={{ color: theme.ink }}>다시 불러오기</Text></Pressable>
    </View>}
    {ledger && !ledger.onboardingCompleted && <View style={card}>
      <Text style={{ color: theme.ink, fontSize: 18, fontWeight: '700' }}>시작 설정을 먼저 마쳐주세요</Text>
    </View>}
    {ledger?.onboardingCompleted && <>
      <View style={card}>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>오늘 합계</Text>
        <Text testID="spending-total" style={{ color: theme.ink, fontSize: 28, fontWeight: '800' }}>{formatMoney(ledger.current.total)}</Text>
        <Text style={{ color: theme[ledger.band], fontSize: 20, fontWeight: '700' }}>{ledger.phrase}</Text>
      </View>
      {BigInt(ledger.current.carriedTotal) > 0n && <View style={card}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>합계로 남은 지출</Text>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>이전 합계 {formatMoney(ledger.current.carriedTotal)}</Text>
        <Text style={{ color: theme.secondary, fontSize: 14, lineHeight: 22 }}>날짜나 시간대가 바뀌기 전에 합계로 남긴 기록이에요. 이 금액은 바꿀 수 없고, 아래 지출만 하나씩 지울 수 있어요.</Text>
      </View>}
      <View style={card}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>새로 기록된 지출 {ledger.current.approvals.length}건</Text>
        {ledger.current.approvals.length === 0 && <Text style={{ color: theme.secondary, fontSize: 16 }}>새로 기록된 지출이 없어요.</Text>}
        {ledger.current.approvals.map((amount, index) => <View key={index} testID={`spending-row-${index}`} style={styles.row}>
          <Text style={{ color: theme.secondary, fontSize: 16 }}>지출 {index + 1}</Text>
          <Text style={{ color: theme.ink, fontSize: 16, flex: 1, textAlign: 'right' }}>{formatMoney(amount)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}번째 지출 ${formatMoney(amount)} 삭제`}
            disabled={mutating} onPress={() => setRemoval({ index, amount: formatMoney(amount), expectedCurrent: ledger.current.expectedCurrent })}
            style={[styles.delete, { opacity: mutating ? 0.5 : 1 }]}>
            <Text style={{ color: theme.exceeded, fontSize: 14 }}>삭제</Text>
          </Pressable>
        </View>)}
      </View>
      {removal && <View accessibilityRole="alert" style={card}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>이 지출을 삭제할까요?</Text>
        <Text style={{ color: theme.secondary, fontSize: 14, lineHeight: 22 }}>오늘 쓴 돈과 이번 달 합계에서 빠져요. 같은 결제 문자가 다시 오면 다시 더해질 수 있어요.</Text>
        <Pressable accessibilityRole="button" disabled={mutating} onPress={() => void confirmRemoval()} style={[styles.button, { opacity: mutating ? 0.5 : 1 }]}>
          <Text style={{ color: theme.exceeded, fontSize: 16, fontWeight: '700' }}>{removal.amount} 삭제</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={mutating} onPress={() => setRemoval(null)} style={styles.button}>
          <Text style={{ color: theme.ink, fontSize: 16 }}>취소</Text>
        </Pressable>
      </View>}
      {failure?.source === 'remove' && <View accessibilityRole="alert" style={card}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.exceeded }]}>반영하지 못했어요</Text>
        <Text style={{ color: theme.exceeded, fontSize: 16 }}>{failure.message}</Text>
      </View>}
      <Pressable accessibilityRole="button" onPress={() => router.push('/add-spending')} style={[styles.add, { backgroundColor: theme.lime }]}>
        <Text style={{ color: theme.limeInk, fontSize: 16, fontWeight: '700' }}>지출 추가</Text>
      </Pressable>
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.secondary, fontSize: 14, lineHeight: 22 }}>자동으로 더해졌든 직접 적었든, 위 목록의 지출은 지울 수 있어요. 합계로 남은 기록은 바꿀 수 없어요. 금액만 보관하며 지난 날짜의 지출은 수정할 수 없어요.</Text>
        <Text style={{ color: theme.secondary, fontSize: 12, lineHeight: 20 }}>직접 적거나 지운 결제도 문자가 다시 오면 한 번 더 더해져요. 겹친 지출은 이 목록에서 지워주세요.</Text>
      </View>
    </>}
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  card: { padding: 20, borderWidth: 1, borderRadius: 20, gap: 12 }, heading: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  delete: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  add: { minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
