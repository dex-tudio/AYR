import { DisplayGuide } from '../src/components/Guides';
import { LockScreenPreview } from '../src/components/LockScreenPreview';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';

export default function Display() {
  const close = useClose('/settings');
  const { snapshot } = useLedger();
  useActiveRefresh();
  // The iPhone shows the real widget; only the browser build draws a design preview of it.
  return <ScreenFrame title="잠금화면 표시" onBack={close}>
    {snapshot && <LockScreenPreview snapshot={snapshot} />}
    {snapshot && <DisplayGuide snapshot={snapshot} />}
  </ScreenFrame>;
}
