import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import type { AppSnapshot } from '../ledger/contracts';
import { simulateTestReception } from '../ledger/service';
import { runSystemAction } from '../state/actions';
import { useActivePolling, useLedger } from '../state/LedgerProvider';
import { useTheme } from '../theme';
import { ReceptionStatus } from './ReceptionStatus';
import { Body, Button, Card } from './ui';

const web = Platform.OS === 'web';
type Ledger = NonNullable<AppSnapshot['ledger']>;
// Connectable sources are the selected, supported ones that have a trigger phrase; support is read from metadata.
const automationSources = (snapshot: AppSnapshot, ledger: Ledger) =>
  snapshot.metadata.sources.filter(source => source.isSupported && source.filterKeyword && ledger.settings.sources.includes(source.raw));

function CopyButton({ label, accessibilityLabel, text }: { label: string; accessibilityLabel: string; text: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const theme = useTheme();
  const copy = async () => {
    const failure = await runSystemAction(() => Clipboard.setStringAsync(text), '복사하지 못했어요. 문구를 길게 눌러 직접 복사해주세요.');
    setNotice(failure ?? '복사했어요.');
  };
  return <>
    <Button label={label} accessibilityLabel={accessibilityLabel} onPress={() => void copy()} />
    {notice && <Text accessibilityLiveRegion="polite" style={{ color: notice === '복사했어요.' ? theme.calm : theme.exceeded, fontSize: 14 }}>{notice}</Text>}
  </>;
}

function Opener({ label, action, failure, webNote }: { label: string; action: () => Promise<unknown>; failure: string; webNote: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const theme = useTheme();
  // The browser cannot open Settings or Shortcuts, so it only explains what happens on iPhone.
  if (web) return <Body>{label} · {webNote}</Body>;
  return <>
    <Pressable accessibilityRole="link" onPress={() => void runSystemAction(action, failure).then(setNotice)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: theme.ink, fontSize: 16, textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
    {notice && <Text accessibilityRole="alert" style={{ color: theme.exceeded, fontSize: 14 }}>{notice}</Text>}
  </>;
}

export function DisplayGuide({ snapshot }: { snapshot: AppSnapshot }) {
  const theme = useTheme();
  return <>
    <Card title="실시간 지출">
      {web
        ? <Body>iPhone에서 가능한 기능이에요. 이 미리보기는 화면 디자인만 보여주고 실제 잠금화면에는 표시되지 않아요.</Body>
        : <Text style={{ color: theme.ink, fontSize: 16 }}>{snapshot.activityEnabled ? '✓ 잠금화면에 표시할 수 있어요' : '설정에서 허용해주세요'}</Text>}
      <Body>설정을 마치면 앱을 열거나 결제 문자가 올 때 오늘 쓴 돈을 보여줘요. 실시간 표시는 최대 8시간 유지되고, 잠금화면에서도 최대 12시간 뒤 사라져요.</Body>
      <Opener label="AYR 설정 열기" action={() => Linking.openSettings()} failure="설정 앱을 열지 못했어요. 설정 앱에서 AYR을 직접 찾아 열어주세요."
        webNote="iPhone에서 설정 앱이 열려요." />
    </Card>
    <Card title="잠금화면 위젯">
      <Body>1. 잠금화면을 길게 누르고 사용자화를 선택하세요.</Body>
      <Body>2. 잠금화면 → 위젯 추가 → AYR을 선택하세요.</Body>
      <Body>3. 오늘 쓴 돈과 한마디가 보이는 위젯을 추가하세요.</Body>
      <Body small>새날이 되면 0원부터 다시 보여줘요. 화면이 바뀌는 시점은 iOS가 정해 반영이 늦어질 수 있어요.</Body>
    </Card>
  </>;
}

export function AutomationGuide({ snapshot }: { snapshot: AppSnapshot }) {
  const ledger = snapshot.ledger;
  if (!ledger) return null;
  const sources = automationSources(snapshot, ledger);
  return <>
    <Card title="한 번 연결하면, 알아서.">
      <Body>아래 순서대로 단축어 자동화를 설정해주세요.</Body>
      {web && <Body small>자동화는 iPhone의 단축어 앱에서 만들어요. 이 미리보기는 안내 화면만 보여줘요.</Body>}
    </Card>
    {sources.length === 0 && <Card title="연결할 수단이 없어요"><Body>온보딩이나 설정에서 연결할 수 있는 결제 수단을 먼저 선택해주세요.</Body></Card>}
    {sources.map(source => <Card key={source.raw} title={source.title}>
      <Text selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 16 }}>{source.filterKeyword}</Text>
      <CopyButton label="연결 문구 복사" accessibilityLabel={`${source.title} 연결 문구 복사`} text={source.filterKeyword ?? ''} />
    </Card>)}
    {sources.length > 0 && <Card title="공통 설정 순서">
      <Body>선택한 수단의 연결 문구를 복사한 뒤 같은 순서로 설정해주세요.</Body>
      <Opener label="1. 단축어 앱 열기" action={() => Linking.openURL('shortcuts://')} failure="단축어 앱을 열지 못했어요. 단축어 앱을 직접 열어주세요."
        webNote="iPhone에서 단축어 앱이 열려요." />
      <Body>2. 자동화 탭에서 새 자동화를 만들고 메시지를 선택하세요.</Body>
      <Body>3. 메시지에 포함되는 문구에 복사한 문구를 붙여 넣고, 즉시 실행을 선택하세요.</Body>
      <Body>4. 동작에서 AYR 결제 처리를 추가하세요.</Body>
      <Body>5. 문자 본문에 단축어 입력의 메시지 본문을 연결하세요. 고정된 문구를 입력하지 마세요.</Body>
    </Card>}
    <Card>
      <Body>자동화는 단축어 앱에서 직접 만들어주세요. iOS 버전에 따라 메뉴 이름이 조금 다를 수 있어요. 같은 문자가 여러 자동화에 걸리면 두 번 더해질 수 있어요. 연결 문구가 겹치는 자동화는 하나만 유지해주세요.</Body>
      <Body>문자 본문 전체를 전달하면 앱이 결제 수단과 금액을 확인해요. 단축어에서 금액을 따로 추출하지 않아도 돼요.</Body>
      <Body>일정 금액 이상만 문자를 받으면 소액 결제가 빠져요. 카드사의 문자 알림 조건도 확인해주세요.</Body>
      <Body>결제 문자와 금액, 가게 이름이 메모나 외부 서비스에 남지 않도록 다른 동작은 추가하지 마세요.</Body>
    </Card>
  </>;
}

// The last automation call is global: it is whatever the ledger says, not a result of this screen's own action.
export function ConnectionCheck({ snapshot }: { snapshot: AppSnapshot }) {
  const { store } = useLedger();
  // While this check is on screen and the app is active, read the ledger every 3 seconds.
  useActivePolling(3000);
  const ledger = snapshot.ledger;
  if (!ledger) return null;
  const sources = automationSources(snapshot, ledger);
  return <>
    <Card>
      <Body>선택한 수단의 확인용 문구를 복사해 나에게 문자로 보내보세요. 오늘 쓴 돈에는 더해지지 않아요.</Body>
      {sources.length === 0 && <Body>온보딩이나 설정에서 연결할 수 있는 결제 수단을 먼저 선택해주세요.</Body>}
    </Card>
    {sources.map(source => <Card key={source.raw} title={source.title}>
      <Text selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 16 }}>{source.testText}</Text>
      <CopyButton label="확인용 문구 복사" accessibilityLabel={`${source.title} 확인용 문구 복사`} text={source.testText} />
    </Card>)}
    <Card title="마지막 자동화 호출">
      <Button label="다시 확인하기" onPress={() => void store.reload()} />
      <ReceptionStatus ledger={ledger} />
      {simulateTestReception && <>
        <Button label="미리보기: 확인용 문자 도착 시뮬레이션" onPress={() => { simulateTestReception?.(); void store.reload(); }} />
        {ledger.lastAttempt?.status === 'test' && <Body small>미리보기 시뮬레이션이에요. 실제 문자 자동화 결과가 아니에요.</Body>}
      </>}
    </Card>
    <Card>
      <Body>나에게 보낸 문자는 자동화가 실행되지 않을 수도 있어요. 시작하기를 눌러 설정을 마친 뒤, 다음 평소 결제 때 확인해도 괜찮아요. 설정을 마치기 전에는 실제 결제도 더해지지 않아요. 확인하려고 새로 결제할 필요는 없어요.</Body>
      <Body small>연결 확인은 나중에 해도 돼요. 확인용 문자가 도착해도 실제 결제가 잘 더해지는지는 다음 결제 때 확인해주세요.</Body>
    </Card>
  </>;
}
