import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { formatMoney, positiveMoney } from '../src/ledger/contracts';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';
import { useTheme } from '../src/theme';

export default function AddSpending() {
  const theme = useTheme();
  const close = useClose('/spending');
  const { store, snapshot, readError, failure, mutating } = useLedger();
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  // The day shown when the form opened; the request names it so a midnight in between is rejected, not misfiled.
  const [expectedDay, setExpectedDay] = useState<string | null>(null);
  // Set synchronously once the ledger confirmed the save, so a late press while the form is closing cannot save again.
  const saved = useRef(false);
  useActiveRefresh();
  useEffect(() => { store.clearFailure(); return () => store.clearFailure(); }, [store]);
  const ledger = snapshot?.ledger;
  const today = ledger?.current.day ?? null;
  useEffect(() => { if (expectedDay === null && today !== null) setExpectedDay(today); }, [expectedDay, today]);
  const maximum = snapshot?.metadata.maximumMoney ?? '0';
  const amount = positiveMoney(text, maximum);
  const dayChanged = expectedDay !== null && today !== null && today !== expectedDay;
  const canSave = !done && !mutating && amount !== null && expectedDay !== null && !dayChanged && ledger?.onboardingCompleted === true;
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.line }];
  const save = async () => {
    if (saved.current || !canSave || expectedDay === null || amount === null) return;
    // The form closes only after the ledger confirmed the save; on failure the typed amount stays.
    if (await store.addSpending(amount, expectedDay)) { saved.current = true; setDone(true); close(); }
  };
  const confirmDay = async () => {
    await store.reload();
    const next = store.getState();
    if (!next.readError && next.snapshot?.ledger) { setExpectedDay(next.snapshot.ledger.current.day); store.clearFailure(); }
  };
  return <ScreenFrame title="지출 추가" onBack={close}>
    {ledger && !ledger.onboardingCompleted && <View style={card}>
      <Text style={{ color: theme.ink, fontSize: 18, fontWeight: '700' }}>시작 설정을 먼저 마쳐주세요</Text>
    </View>}
    {ledger?.onboardingCompleted && <>
      <View style={card}>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>오늘 지출 금액</Text>
        <TextInput accessibilityLabel="금액(원)" placeholder="금액(원)" placeholderTextColor={theme.secondary}
          value={text} onChangeText={setText} keyboardType="number-pad" inputMode="numeric" editable={!mutating}
          style={[styles.input, { color: theme.ink, borderColor: theme.line }]} />
        <Text style={{ color: theme.secondary, fontSize: 14 }}>1~{formatMoney(maximum)} 사이의 숫자로 적어주세요.</Text>
        {amount !== null && <Text testID="add-preview" style={{ color: theme.ink, fontSize: 16 }}>{formatMoney(amount)}을 더해요</Text>}
      </View>
      <Text style={{ color: theme.secondary, fontSize: 14, lineHeight: 22 }}>결제 문자가 오기 전에 직접 적으면 두 번 더해질 수 있어요. 겹친 지출은 오늘 지출 목록에서 지워주세요.</Text>
      {dayChanged && <View accessibilityRole="alert" style={card}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>날짜가 바뀌었어요</Text>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>적어둔 금액은 그대로예요. 오늘 쓴 돈에 더하려면 날짜를 다시 확인해주세요.</Text>
        <Pressable accessibilityRole="button" onPress={() => void confirmDay()} style={styles.button}>
          <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>오늘 날짜로 바꾸기</Text>
        </Pressable>
      </View>}
      {failure?.source === 'add' && <View accessibilityRole="alert" style={card}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.exceeded }]}>저장하지 못했어요</Text>
        <Text style={{ color: theme.exceeded, fontSize: 16 }}>{failure.message}</Text>
      </View>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSave }} disabled={!canSave} onPress={() => void save()}
        style={[styles.add, { backgroundColor: theme.lime, opacity: canSave ? 1 : 0.5 }]}>
        <Text style={{ color: theme.limeInk, fontSize: 16, fontWeight: '700' }}>추가</Text>
      </Pressable>
    </>}
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  card: { padding: 20, borderWidth: 1, borderRadius: 20, gap: 12 }, heading: { fontSize: 18, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 18 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  add: { minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
