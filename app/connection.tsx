import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AutomationGuide } from '../src/components/Guides';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { Body, Card } from '../src/components/ui';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';
import { useTheme } from '../src/theme';

export default function Connection() {
  const theme = useTheme();
  const router = useRouter();
  const close = useClose('/settings');
  const { snapshot } = useLedger();
  useActiveRefresh();
  return <ScreenFrame title="결제 문자 연결" onBack={close}>
    {snapshot?.ledger && <>
      <Body>결제 문자가 오늘 쓴 돈에 더해지도록 연결해요.</Body>
      <AutomationGuide snapshot={snapshot} />
      <Card>
        <Pressable accessibilityRole="link" onPress={() => router.push('/connection-check')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '700' }}>연결 확인하기</Text>
        </Pressable>
      </Card>
    </>}
  </ScreenFrame>;
}
