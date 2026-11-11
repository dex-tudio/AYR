import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IdentityBudgetFields, MoneyField } from '../src/components/IdentityBudgetFields';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { SourcePicker } from '../src/components/SourcePicker';
import { Alert, Body, Button, Card } from '../src/components/ui';
import { formatMoney, settingsRequest } from '../src/ledger/contracts';
import type { SettingsDraft } from '../src/ledger/contracts';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';
import { useTheme } from '../src/theme';

export default function EditSettings() {
  const theme = useTheme();
  const close = useClose('/settings');
  const { store, snapshot, readError, failure, mutating } = useLedger();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  // Set once the ledger confirmed the save, so a late press while the screen closes cannot save again.
  const saved = useRef(false);
  useActiveRefresh();
  useEffect(() => { store.clearFailure(); return () => store.clearFailure(); }, [store]);
  const ledger = snapshot?.ledger;
  // The draft starts from the saved settings once; later reads never overwrite what the user typed.
  useEffect(() => {
    if (draft === null && ledger) {
      const { identity, dailyBudget, monthlyBudget, sources } = ledger.settings;
      setDraft({ identity, dailyBudget, customMonthly: monthlyBudget !== null, monthlyBudget: monthlyBudget ?? '', sources });
    }
  }, [draft, ledger]);
  const metadata = snapshot?.metadata;
  const request = draft && metadata ? settingsRequest(draft, metadata, false) : null;
  const save = async () => {
    if (saved.current || !request || mutating) return;
    if (await store.saveSettings(request)) { saved.current = true; close(); }
  };
  return <ScreenFrame title="내 기준 바꾸기" onBack={close}>
    {readError && <Alert message={readError} />}
    {!draft || !metadata ? <Body>기록을 불러오고 있어요.</Body> : <>
      <Card title="신분·하루 기준">
        <IdentityBudgetFields metadata={metadata} identity={draft.identity} budget={draft.dailyBudget}
          onIdentity={(identity, dailyBudget) => setDraft({ ...draft, identity, dailyBudget })} onBudget={dailyBudget => setDraft({ ...draft, dailyBudget })} />
        <Body>오늘 쓴 돈은 그대로 두고 한마디만 새 기준에 맞춰 바꿔요. 시간대를 바꿔 다시 보는 날짜에는 당시 기준을 사용하고, 새 기준은 이후 날짜부터 적용해요.</Body>
      </Card>
      <Card title="월 예산">
        <Pressable accessibilityRole="switch" accessibilityLabel="월 예산 직접 입력" aria-checked={draft.customMonthly}
          onPress={() => setDraft({ ...draft, customMonthly: !draft.customMonthly })} style={styles.toggle}>
          <Text style={{ color: theme.ink, fontSize: 16 }}>{draft.customMonthly ? '☑ ' : '☐ '}직접 입력</Text>
        </Pressable>
        {draft.customMonthly
          ? <MoneyField label="월 예산(원)" value={draft.monthlyBudget} onChange={monthlyBudget => setDraft({ ...draft, monthlyBudget })} />
          : <Body>하루 기준에 그 달의 일수를 곱해 정해요.</Body>}
        <Body>바꾼 예산은 이번 달부터 적용돼요. 지난달 예산은 그대로 두고, 직접 정한 금액은 다음 달에도 이어서 사용해요.</Body>
      </Card>
      <Card title="결제 수단">
        <SourcePicker metadata={metadata} selected={draft.sources} onChange={sources => setDraft({ ...draft, sources })} />
      </Card>
      {request === null && <Text style={{ color: theme.exceeded, fontSize: 14 }}>금액은 1~{formatMoney(metadata.maximumMoney)} 사이의 숫자로 적고, 연결할 수 있는 결제 수단을 골라주세요.</Text>}
      {failure?.source === 'settings' && <Alert title="저장하지 못했어요" message={failure.message} />}
      <View style={styles.nav}>
        <Button label="취소" disabled={mutating} onPress={close} />
        <Button label="저장" tone="primary" disabled={!request || mutating} onPress={() => void save()} />
      </View>
    </>}
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  toggle: { minHeight: 44, justifyContent: 'center' }, nav: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'flex-end' },
});
