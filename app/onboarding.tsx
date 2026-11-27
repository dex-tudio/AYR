import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AutomationGuide, ConnectionCheck, DisplayGuide } from '../src/components/Guides';
import { IdentityBudgetFields } from '../src/components/IdentityBudgetFields';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { SourcePicker } from '../src/components/SourcePicker';
import { Alert, Body, Button, Card } from '../src/components/ui';
import { supportedTitles } from '../src/ledger/contracts';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';
import { useSettingsDraft } from '../src/state/useSettingsDraft';
import { useTheme } from '../src/theme';

// The interrogation room is dark in both color schemes, so these do not follow the theme.
const room = { background: '#1B1B22', ink: '#FFFFFF', dim: '#C9C9D2', track: '#3A3A46', fill: '#FFD43B' };
const titles = ['님 정체가 뭐임?', '어떻게 결제하나요?', '잠금화면에서 만나요.', '문자가 오면, 자동으로.', '이제 연결을 확인해요.'];

export default function Onboarding() {
  const theme = useTheme();
  const { store, snapshot, failure, mutating } = useLedger();
  const [step, setStep] = useState(1);
  const router = useRouter();
  const close = useClose('/settings');
  // `?again=1` (from settings) walks the same steps over a finished onboarding: records stay and collection never pauses,
  // because the ledger stays finished and each step saves like the settings editor.
  const again = useLocalSearchParams<{ again?: string }>().again === '1';
  useActiveRefresh();
  useEffect(() => { store.clearFailure(); }, [store]);
  const ledger = snapshot?.ledger;
  const { draft, metadata, update, pickIdentity, request: requestFor } = useSettingsDraft(snapshot);
  if (ledger?.onboardingCompleted && !again) return <Redirect href="/" />;
  const request = requestFor(step === 5);
  // Moving on saves first; a failed save keeps the step and the failure, and the same button retries.
  const advance = async () => {
    if (!request || mutating) return;
    if (!await store.saveSettings(request)) return;
    if (step < 5) setStep(step + 1);
    else if (again) router.replace('/');
  };
  return <ScreenFrame title={titles[step - 1]} background={room.background} ink={room.ink} onBack={again ? close : undefined} backLabel={again ? '그만하기' : undefined}>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 5, now: step, text: `5단계 중 ${step}단계` }} style={[styles.progress, { backgroundColor: room.track }]}>
      <View style={[styles.fill, { width: `${step * 20}%`, backgroundColor: room.fill }]} />
    </View>
    <Text style={{ color: room.dim, fontSize: 12 }}>심문 {step}/5</Text>
    {draft && snapshot && metadata && <>
      {step === 1 && <Card title="내 생활에 맞는 기준">
        <IdentityBudgetFields metadata={metadata} identity={draft.identity} budget={draft.dailyBudget}
          onIdentity={pickIdentity} onBudget={dailyBudget => update({ dailyBudget })} />
        <Body>하루에 이 정도면 적당하겠다 싶은 금액을 정해주세요. 나중에 바꿔도 오늘 쓴 돈은 그대로예요.</Body>
      </Card>}
      {step === 2 && <>
        <Card title="결제 수단">
          <SourcePicker metadata={metadata} selected={draft.sources} onChange={sources => update({ sources })} />
          {draft.sources.length === 0 && <Text style={{ color: theme.exceeded, fontSize: 14 }}>연결할 결제 수단을 하나 골라주세요.</Text>}
        </Card>
        <Text style={{ color: room.dim, fontSize: 14, lineHeight: 22 }}>지금은 {supportedTitles(metadata)}을(를) 연결할 수 있어요. 같은 결제가 두 번 더해지지 않도록 자동화는 하나만 만들어주세요.</Text>
      </>}
      {step === 3 && <DisplayGuide snapshot={snapshot} />}
      {step === 4 && <AutomationGuide snapshot={snapshot} />}
      {step === 5 && <ConnectionCheck snapshot={snapshot} />}
      {failure?.source === 'settings' && <Alert title="저장하지 못했어요" message={failure.message} />}
      <View style={styles.nav}>
        {step > 1 && <Pressable accessibilityRole="button" accessibilityLabel="이전" accessibilityState={{ disabled: mutating }} disabled={mutating}
          onPress={() => setStep(step - 1)} style={[styles.back, { opacity: mutating ? 0.5 : 1 }]}>
          <Text style={{ color: room.ink, fontSize: 16 }}>이전</Text>
        </Pressable>}
        <Button label={step === 5 ? '시작하기' : '다음'} tone="primary" disabled={!request || mutating} onPress={() => void advance()} />
      </View>
    </>}
    <Text style={{ color: room.dim, fontSize: 12, textAlign: 'center' }}>기록은 이 폰 밖으로 안 나갑니다.</Text>
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  progress: { height: 6, borderRadius: 3, overflow: 'hidden' }, fill: { height: 6, borderRadius: 3 },
  back: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  nav: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'flex-end' },
});
