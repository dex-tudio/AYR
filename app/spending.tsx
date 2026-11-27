import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { Alert, Body, Card } from '../src/components/ui';
import { formatMoney } from '../src/ledger/contracts';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';
import { fonts, palette, useTheme } from '../src/theme';

type Removal = { index: number; amount: string; expectedCurrent: string };

// The receipt paper stays light in dark mode too, so its colors are fixed and the band color is the light-mode one.
const PAPER = '#FBFAF6';
const INK = '#111111';
const mono = Platform.select({ ios: 'Menlo', default: 'monospace' })!;
const receiptText = { color: INK, fontFamily: mono, fontSize: 14, lineHeight: 22 } as const;
const TOOTH = 8;

// 2px dashed line: the inner box is taller than the clip, so only its top border shows (uniform borders dash the same on iOS and web).
function Rule() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 2, overflow: 'hidden' }}>
    <View style={{ height: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: INK }} />
  </View>;
}
// Torn bottom edge: downward triangles in paper color; the row is clipped to the receipt width.
function Teeth() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', height: TOOTH, overflow: 'hidden' }}>
    {Array.from({ length: 40 }, (_, i) => <View key={i} style={{
      width: 0, height: 0, flexShrink: 0, borderLeftWidth: TOOTH, borderRightWidth: TOOTH, borderTopWidth: TOOTH,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: PAPER,
    }} />)}
  </View>;
}

export default function Spending() {
  const theme = useTheme();
  const router = useRouter();
  const close = useClose('/');
  const { store, snapshot, failure, mutating } = useLedger();
  // Captured when the delete button is pressed, so the request names what the user actually saw.
  const [removal, setRemoval] = useState<Removal | null>(null);
  useActiveRefresh();
  useEffect(() => { store.clearFailure(); }, [store]);
  const ledger = snapshot?.ledger;
  const identity = snapshot?.metadata.identities.find(item => item.raw === ledger?.settings.identity);
  const confirmRemoval = async () => {
    if (!removal) return;
    await store.removeSpending(removal.index, removal.expectedCurrent);
    // Same as SwiftUI TodaySpendingView: the dialog closes whether or not it saved. A failure is shown below the list
    // and the user selects again from the latest list (docs/mvp-spec.md 날짜·목록 변경, 실패).
    setRemoval(null);
  };
  return <ScreenFrame title="오늘의 범행 기록" onBack={close} background="#17171A" ink="#FFFFFF">
    {ledger && !ledger.onboardingCompleted && <Card title="시작 설정을 먼저 마쳐주세요">{null}</Card>}
    {ledger?.onboardingCompleted && <>
      <View>
        <View style={styles.paper}>
          <Text style={[receiptText, { fontWeight: '700', textAlign: 'center' }]}>** 님 부자임? 상회 **</Text>
          <Text style={[receiptText, { fontSize: 12, textAlign: 'center' }]}>{ledger.current.day} · {identity?.title} · 기준 {formatMoney(ledger.current.budget)}</Text>
          <Rule />
          <Text accessibilityRole="header" style={[receiptText, { fontWeight: '700' }]}>새로 기록된 지출 {ledger.current.approvals.length}건</Text>
          {ledger.current.approvals.length === 0 && <Text style={receiptText}>새로 기록된 지출이 없어요.</Text>}
          {ledger.current.approvals.map((amount, index) => <View key={index} testID={`spending-row-${index}`}>
            <View style={styles.row}>
              <Text style={receiptText}>지출 {index + 1}</Text>
              <Text style={[receiptText, { flex: 1, textAlign: 'right' }]}>{formatMoney(amount)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}번째 지출 ${formatMoney(amount)} 없던 일로`}
                disabled={mutating} onPress={() => setRemoval({ index, amount: formatMoney(amount), expectedCurrent: ledger.current.expectedCurrent })}
                style={[styles.press, { opacity: mutating ? 0.5 : 1 }]}>
                <Text style={[receiptText, { color: palette(false).exceeded, fontWeight: '700' }]}>없던 일로</Text>
              </Pressable>
            </View>
            {removal?.index === index && <View accessibilityRole="alert" style={styles.confirm}>
              <Text accessibilityRole="header" style={[receiptText, { fontWeight: '700' }]}>진짜 없던 일로?</Text>
              <Text style={[receiptText, { fontSize: 12, lineHeight: 20 }]}>오늘 쓴 돈과 이번 달 합계에서 빠져요. 같은 결제 문자가 다시 오면 다시 더해질 수 있어요.</Text>
              <Pressable accessibilityRole="button" disabled={mutating} onPress={() => void confirmRemoval()} style={[styles.press, { alignItems: 'flex-start', opacity: mutating ? 0.5 : 1 }]}>
                <Text style={[receiptText, { color: palette(false).exceeded, fontWeight: '700' }]}>{removal.amount} 지우기</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={mutating} onPress={() => setRemoval(null)} style={[styles.press, { alignItems: 'flex-start' }]}>
                <Text style={receiptText}>아니</Text>
              </Pressable>
            </View>}
          </View>)}
          <Rule />
          <View style={styles.row}>
            <Text style={[receiptText, { fontWeight: '700' }]}>합계</Text>
            <Text testID="spending-total" style={[receiptText, { flex: 1, textAlign: 'right', fontWeight: '700', fontSize: 18 }]}>{formatMoney(ledger.current.total)}</Text>
          </View>
          <Text style={[receiptText, { color: palette(false)[ledger.band], fontWeight: '700', fontSize: 16 }]}>{ledger.phrase}</Text>
          <Text style={[receiptText, { fontSize: 11, lineHeight: 18, textAlign: 'center' }]}>본 영수증은 지갑이의 눈물로 인쇄되었습니다</Text>
        </View>
        <Teeth />
      </View>
      {BigInt(ledger.current.carriedTotal) > 0n && <Card title="합계로 남은 지출">
        <Text style={{ color: theme.secondary, fontSize: 16 }}>이전 합계 {formatMoney(ledger.current.carriedTotal)}</Text>
        <Body>날짜나 시간대가 바뀌기 전에 합계로 남긴 기록이에요. 이 금액은 바꿀 수 없고, 아래 지출만 하나씩 지울 수 있어요.</Body>
      </Card>}
      {failure?.source === 'remove' && <Alert title="반영하지 못했어요" message={failure.message} />}
      <Pressable accessibilityRole="button" onPress={() => router.push('/add-spending')}
        style={[styles.add, { backgroundColor: theme.lime, borderColor: theme.line, shadowColor: theme.shadow }]}>
        <Text style={{ color: theme.limeInk, fontSize: 22, fontFamily: fonts.display, fontWeight: '400' }}>자백하기</Text>
      </Pressable>
      <View style={{ gap: 8 }}>
        <Text style={{ color: palette(true).secondary, fontSize: 14, lineHeight: 22 }}>자동으로 더해졌든 직접 적었든, 위 목록의 지출은 지울 수 있어요. 합계로 남은 기록은 바꿀 수 없어요. 금액만 보관하며 지난 날짜의 지출은 수정할 수 없어요.</Text>
        <Text style={{ color: palette(true).secondary, fontSize: 12, lineHeight: 20 }}>직접 적거나 지운 결제도 문자가 다시 오면 한 번 더 더해져요. 겹친 지출은 이 목록에서 지워주세요.</Text>
      </View>
    </>}
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  paper: { backgroundColor: PAPER, padding: 20, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  press: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  confirm: { gap: 6, paddingVertical: 8 },
  add: { minHeight: 56, borderRadius: 16, borderWidth: 3, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, justifyContent: 'center', alignItems: 'center' },
});
