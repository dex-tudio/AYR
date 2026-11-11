import { DisplayGuide } from '../src/components/Guides';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { Alert, Body } from '../src/components/ui';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';

export default function Display() {
  const close = useClose('/settings');
  const { snapshot, readError } = useLedger();
  useActiveRefresh();
  return <ScreenFrame title="잠금화면 표시" onBack={close}>
    {readError && <Alert message={readError} />}
    {snapshot ? <DisplayGuide snapshot={snapshot} /> : !readError && <Body>기록을 불러오고 있어요.</Body>}
  </ScreenFrame>;
}
