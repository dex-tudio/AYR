import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AutomationGuide, ConnectionCheck, DisplayGuide } from '../src/components/Guides';
import { IdentityBudgetFields } from '../src/components/IdentityBudgetFields';
import { ScreenFrame } from '../src/components/ScreenFrame';
import { SourcePicker } from '../src/components/SourcePicker';
import { Alert, Body, Button, Card } from '../src/components/ui';
import { settingsRequest } from '../src/ledger/contracts';
import type { SettingsDraft } from '../src/ledger/contracts';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';
import { useTheme } from '../src/theme';

const titles = ['내 소비의 기준부터.', '어떻게 결제하나요?', '잠금화면에서 만나요.', '문자가 오면, 자동으로.', '이제 연결을 확인해요.'];

export default function Onboarding() {
  const theme = useTheme();
  const { store, snapshot, readError, failure, mutating } = useLedger();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  useActiveRefresh();
  useEffect(() => { store.clearFailure(); }, [store]);
  const ledger = snapshot?.ledger;
  // The draft starts from the saved settings once; later reads never overwrite what the user typed.
  useEffect(() => {
    if (draft === null && ledger) {
      const { identity, dailyBudget, monthlyBudget, sources } = ledger.settings;
      setDraft({ identity, dailyBudget, customMonthly: monthlyBudget !== null, monthlyBudget: monthlyBudget ?? '', sources });
    }
  }, [draft, ledger]);
  if (ledger?.onboardingCompleted) return <Redirect href="/" />;
  const metadata = snapshot?.metadata;
  const request = draft && metadata ? settingsRequest(draft, metadata, step === 5) : null;
  // Moving on saves first; a failed save keeps the step and the failure, and the same button retries.
  const advance = async () => {
    if (!request || mutating) return;
    if (await store.saveSettings(request) && step < 5) setStep(step + 1);
  };
  return <ScreenFrame title={titles[step - 1]}>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 5, now: step, text: `5단계 중 ${step}단계` }} style={styles.progress}>
      <View style={[styles.fill, { width: `${step * 20}%`, backgroundColor: theme.lime }]} />
    </View>
    <Text style={{ color: theme.secondary, fontSize: 12 }}>시작하기 {step}/5</Text>
    {readError && <Alert message={readError} />}
    {!draft || !snapshot || !metadata ? <Body>기록을 불러오고 있어요.</Body> : <>
      {step === 1 && <Card title="내 생활에 맞는 기준">
        <IdentityBudgetFields metadata={metadata} identity={draft.identity} budget={draft.dailyBudget}
          onIdentity={(identity, dailyBudget) => setDraft({ ...draft, identity, dailyBudget })} onBudget={dailyBudget => setDraft({ ...draft, dailyBudget })} />
        <Body>하루에 이 정도면 적당하겠다 싶은 금액을 정해주세요. 나중에 바꿔도 오늘 쓴 돈은 그대로예요.</Body>
      </Card>}
      {step === 2 && <>
        <Card title="결제 수단">
          <SourcePicker metadata={metadata} selected={draft.sources} onChange={sources => setDraft({ ...draft, sources })} />
          {draft.sources.length === 0 && <Text style={{ color: theme.exceeded, fontSize: 14 }}>연결할 결제 수단을 하나 골라주세요.</Text>}
        </Card>
        <Body>지금은 KB국민 체크카드 문자를 연결할 수 있어요. 같은 결제가 두 번 더해지지 않도록 자동화는 하나만 만들어주세요.</Body>
      </>}
      {step === 3 && <DisplayGuide snapshot={snapshot} />}
      {step === 4 && <AutomationGuide snapshot={snapshot} />}
      {step === 5 && <ConnectionCheck snapshot={snapshot} />}
      {failure?.source === 'settings' && <Alert title="저장하지 못했어요" message={failure.message} />}
      <View style={styles.nav}>
        {step > 1 && <Button label="이전" disabled={mutating} onPress={() => setStep(step - 1)} />}
        <Button label={step === 5 ? '시작하기' : '다음'} tone="primary" disabled={!request || mutating} onPress={() => void advance()} />
      </View>
    </>}
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  progress: { height: 6, borderRadius: 3, backgroundColor: '#8884', overflow: 'hidden' }, fill: { height: 6, borderRadius: 3 },
  nav: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'flex-end' },
});
