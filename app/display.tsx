import { DisplayGuide } from '../src/components/Guides';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';

export default function Display() {
  const close = useClose('/settings');
  const { snapshot } = useLedger();
  useActiveRefresh();
  return <ScreenFrame title="잠금화면 표시" onBack={close}>
    {snapshot && <DisplayGuide snapshot={snapshot} />}
  </ScreenFrame>;
}
